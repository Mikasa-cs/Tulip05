import { Product, products } from '@/data/products';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';
import { getAuth } from 'firebase/auth';

export type RecommendationType = 'for_you' | 'wishlist_inspired' | 'similar_products' | 'visual_similar' | 'trending';

type RecommendationResponse = {
  items?: Array<{
    product_id?: string | number;
    score?: number;
    reason?: string;
  }>;
};

type RecommendationProxyPayload = {
  recommendationType: RecommendationType;
  limit?: number;
  productId?: string;
  imageBase64?: string;
  imageUrl?: string;
};

const normalizeProductId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).trim();
  }

  return '';
};

const catalogById = new Map(
  products
    .map((product) => [normalizeProductId(product.id), product] as const)
    .filter(([id]) => Boolean(id)),
);
const RECOMMENDATION_ENDPOINT = import.meta.env.VITE_RECOMMENDATION_ENDPOINT || '/functions/v1/recommendations-proxy';
const DIRECT_RECOMMENDER_URL = (import.meta.env.VITE_RECOMMENDER_DIRECT_URL as string | undefined)?.trim() || '';
const DIRECT_RECOMMENDER_API_KEY = (import.meta.env.VITE_RECOMMENDER_DIRECT_API_KEY as string | undefined)?.trim() || '';
const DIRECT_RECOMMENDER_ENABLED =
  ((import.meta.env.VITE_RECOMMENDER_DIRECT_ENABLED as string | undefined)?.trim().toLowerCase() === 'true');
const DIRECT_RECOMMENDER_FALLBACK_TO_PROXY =
  ((import.meta.env.VITE_RECOMMENDER_DIRECT_FALLBACK_TO_PROXY as string | undefined)?.trim().toLowerCase() === 'true');
const IS_DIRECT_RECOMMENDER_MODE = Boolean(import.meta.env.DEV && DIRECT_RECOMMENDER_ENABLED && DIRECT_RECOMMENDER_URL);

const directEndpointByType: Record<RecommendationType, string> = {
  for_you: '/recommendations/for-you',
  wishlist_inspired: '/recommendations/wishlist-inspired',
  similar_products: '/recommendations/similar',
  visual_similar: '/recommendations/visual-similar',
  trending: '/recommendations/trending',
};

const toSafeLimit = (limit: number, fallback: number) => {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.floor(limit), 24));
};

const mergeUniqueProducts = (primary: Product[], secondary: Product[], limit: number): Product[] => {
  const safeLimit = toSafeLimit(limit, 4);
  const mergedProducts: Product[] = [];
  const seenProductIds = new Set<string>();

  const pushProduct = (product: Product) => {
    const normalizedId = normalizeProductId(product.id);
    if (!normalizedId || seenProductIds.has(normalizedId)) {
      return;
    }

    mergedProducts.push(product);
    seenProductIds.add(normalizedId);
  };

  for (const product of primary) {
    pushProduct(product);
    if (mergedProducts.length >= safeLimit) {
      return mergedProducts;
    }
  }

  for (const product of secondary) {
    pushProduct(product);
    if (mergedProducts.length >= safeLimit) {
      return mergedProducts;
    }
  }

  for (const product of products) {
    pushProduct(product);
    if (mergedProducts.length >= safeLimit) {
      return mergedProducts;
    }
  }

  return mergedProducts;
};

const getStaticRecommendationFallback = (
  recommendationType: RecommendationType,
  limit: number,
): Product[] => {
  const safeLimit = toSafeLimit(limit, 4);
  const defaultFallback = products.filter((product) => product.isTrending).slice(0, safeLimit);

  const pickWithFallback = (items: Product[]) => mergeUniqueProducts(items, defaultFallback, safeLimit);

  switch (recommendationType) {
    case 'for_you':
      return pickWithFallback(products.filter((product) => product.isAIPick));
    case 'wishlist_inspired':
      return pickWithFallback(products.filter((product) => product.isNew));
    case 'visual_similar':
      return pickWithFallback(products.filter((product) => product.isTrending || product.isAIPick));
    case 'trending':
      return pickWithFallback(products.filter((product) => product.isTrending));
    default:
      return pickWithFallback(products.filter((product) => product.isTrending));
  }
};

const scoreSimilarity = (source: Product, candidate: Product): number => {
  let score = 0;

  if (source.category === candidate.category) score += 0.30;
  if (source.masterCategory === candidate.masterCategory) score += 0.25;
  if (source.subCategory === candidate.subCategory) score += 0.20;
  if (source.articleType === candidate.articleType) score += 0.10;
  if (source.gender === candidate.gender) score += 0.07;
  if (source.baseColour === candidate.baseColour) score += 0.05;
  if (source.usage === candidate.usage) score += 0.03;

  return score + (candidate.isTrending ? 0.05 : 0) + ((candidate.rating || 0) / 5) * 0.05;
};

export const getStaticSimilarFallback = (productId: string, limit: number): Product[] => {
  const safeLimit = toSafeLimit(limit, 4);
  const source = catalogById.get(normalizeProductId(productId));

  if (!source) {
    return mergeUniqueProducts(
      getStaticRecommendationFallback('trending', safeLimit),
      products,
      safeLimit,
    );
  }

  const similarProducts = products
    .filter((product) => normalizeProductId(product.id) !== normalizeProductId(source.id))
    .map((product) => ({ product, score: scoreSimilarity(source, product) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit)
    .map((entry) => entry.product);

  return mergeUniqueProducts(similarProducts, getStaticRecommendationFallback('trending', safeLimit), safeLimit);
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return null;

    const token = await user.getIdToken(false);
    return token || null;
  } catch {
    return null;
  }
};

const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user?.uid) {
      return null;
    }

    return user.uid;
  } catch {
    return null;
  }
};

const callDirectRecommender = async (payload: RecommendationProxyPayload): Promise<RecommendationResponse | null> => {
  if (!IS_DIRECT_RECOMMENDER_MODE) {
    return null;
  }

  const endpointPath = directEndpointByType[payload.recommendationType];
  const safeLimit = toSafeLimit(payload.limit ?? 8, 8);
  const userId = await getCurrentUserId();
  const body: Record<string, unknown> = { limit: safeLimit };

  if (payload.recommendationType === 'for_you' || payload.recommendationType === 'wishlist_inspired') {
    if (!userId) {
      return null;
    }
    body.user_id = userId;
  }

  if (payload.recommendationType === 'similar_products') {
    if (!payload.productId?.trim()) {
      return null;
    }
    body.product_id = payload.productId.trim();
    if (userId) {
      body.user_id = userId;
    }
  }

  if (payload.recommendationType === 'visual_similar') {
    const imageBase64 = payload.imageBase64?.trim() || '';
    const imageUrl = payload.imageUrl?.trim() || '';

    if (!imageBase64 && !imageUrl) {
      return null;
    }

    if (imageBase64) {
      body.image_base64 = imageBase64;
    }

    if (imageUrl) {
      body.image_url = imageUrl;
    }

    if (userId) {
      body.user_id = userId;
    }
  }

  if (payload.recommendationType === 'trending' && userId) {
    body.user_id = userId;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (DIRECT_RECOMMENDER_API_KEY) {
    headers['x-recommender-api-key'] = DIRECT_RECOMMENDER_API_KEY;
  }

  const response = await fetch(`${DIRECT_RECOMMENDER_URL.replace(/\/+$/, '')}${endpointPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  try {
    return (await response.json()) as RecommendationResponse;
  } catch {
    return null;
  }
};

const callRecommendationProxy = async (payload: RecommendationProxyPayload): Promise<RecommendationResponse | null> => {
  const authToken = await getAuthToken();
  const needsAuth = payload.recommendationType === 'for_you' || payload.recommendationType === 'wishlist_inspired';
  if (needsAuth && !authToken) {
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  // Support both Supabase and Firebase Cloud Functions endpoints
  let endpoint = RECOMMENDATION_ENDPOINT;
  if (endpoint.startsWith('/functions')) {
    // Relative path - use with current origin
    endpoint = `${window.location.origin}${endpoint}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as RecommendationResponse;
  } catch {
    return null;
  }
};

const mapRecommendationIdsToProducts = (
  recommendationResponse: RecommendationResponse | null,
  limit: number,
): Product[] => {
  if (!recommendationResponse?.items || recommendationResponse.items.length === 0) {
    return [];
  }

  const resolvedProducts: Product[] = [];
  const seenProductIds = new Set<string>();

  for (const item of recommendationResponse.items) {
    const productId = normalizeProductId(item.product_id);
    if (!productId) continue;
    if (seenProductIds.has(productId)) continue;

    const product = catalogById.get(productId);
    if (!product) continue;

    resolvedProducts.push(product);
    seenProductIds.add(productId);

    if (resolvedProducts.length >= limit) break;
  }

  return resolvedProducts;
};

const fetchRecommendationsWithFallback = async (
  recommendationType: RecommendationType,
  limit: number,
  productId?: string,
  imageBase64?: string,
  imageUrl?: string,
): Promise<Product[]> => {
  const safeLimit = toSafeLimit(limit, 4);

  const requestPayload: RecommendationProxyPayload = {
    recommendationType,
    limit: safeLimit,
    productId,
    imageBase64,
    imageUrl,
  };

  try {
    let response: RecommendationResponse | null = null;

    if (IS_DIRECT_RECOMMENDER_MODE) {
      response = await callDirectRecommender(requestPayload);

      if (!response && DIRECT_RECOMMENDER_FALLBACK_TO_PROXY) {
        response = await callRecommendationProxy(requestPayload);
      }
    } else {
      response = await callRecommendationProxy(requestPayload);
    }

    const productsFromApi = mapRecommendationIdsToProducts(response, safeLimit);
    if (productsFromApi.length > 0) {
      return mergeUniqueProducts(
        productsFromApi,
        getStaticRecommendationFallback(recommendationType, safeLimit),
        safeLimit,
      );
    }
  } catch {
  }

  if (recommendationType === 'similar_products' && productId) {
    return mergeUniqueProducts(
      getStaticSimilarFallback(productId, safeLimit),
      getStaticRecommendationFallback('trending', safeLimit),
      safeLimit,
    );
  }

  const fallbackRecommendations = getStaticRecommendationFallback(recommendationType, safeLimit);
  return mergeUniqueProducts(fallbackRecommendations, products, safeLimit);
};

export const getForYouRecommendations = (limit = 4) =>
  fetchRecommendationsWithFallback('for_you', limit);

export const getWishlistInspiredRecommendations = (limit = 4) =>
  fetchRecommendationsWithFallback('wishlist_inspired', limit);

export const getTrendingRecommendations = (limit = 4) =>
  fetchRecommendationsWithFallback('trending', limit);

export const getSimilarRecommendations = (productId: string, limit = 4) =>
  fetchRecommendationsWithFallback('similar_products', limit, productId);

export const getVisualSimilarRecommendations = (imageBase64: string, limit = 8) =>
  fetchRecommendationsWithFallback('visual_similar', limit, undefined, imageBase64);

export { trackRecommendationEvent };
