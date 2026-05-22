// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const getAllowedOrigins = () => {
  const rawOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').trim();
  const parsedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsedOrigins.length > 0 ? parsedOrigins : defaultAllowedOrigins;
};

const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};

const buildCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const responseOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

const jsonResponse = (status: number, payload: unknown, origin: string | null = null) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });

type RecommendationType = 'for_you' | 'wishlist_inspired' | 'similar_products' | 'visual_similar' | 'trending';

type RecommendationProxyRequest = {
  recommendationType: RecommendationType;
  limit?: number;
  productId?: string;
  imageBase64?: string;
  imageUrl?: string;
};

const endpointByType: Record<RecommendationType, string> = {
  for_you: '/recommendations/for-you',
  wishlist_inspired: '/recommendations/wishlist-inspired',
  similar_products: '/recommendations/similar',
  visual_similar: '/recommendations/visual-similar',
  trending: '/recommendations/trending',
};

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toSafeLimit = (value: unknown, fallback = 8) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), 24));
};

const isRecommendationType = (value: unknown): value is RecommendationType =>
  value === 'for_you'
  || value === 'wishlist_inspired'
  || value === 'similar_products'
  || value === 'visual_similar'
  || value === 'trending';

serve(async (request: Request) => {
  const requestOrigin = request.headers.get('origin');
  const respond = (status: number, payload: unknown) => jsonResponse(status, payload, requestOrigin);

  if (!isAllowedOrigin(requestOrigin)) {
    return respond(403, { error: 'Origin not allowed.' });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(requestOrigin) });
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const recommenderApiUrl = toTrimmedString(Deno.env.get('RECOMMENDER_API_URL'));
  const recommenderApiKey = toTrimmedString(Deno.env.get('RECOMMENDER_API_KEY'));

  if (!supabaseUrl || !supabaseAnonKey || !recommenderApiUrl || !recommenderApiKey) {
    return respond(500, { error: 'Server environment is missing required secrets.' });
  }

  let payload: RecommendationProxyRequest;
  try {
    payload = (await request.json()) as RecommendationProxyRequest;
  } catch {
    return respond(400, { error: 'Invalid JSON payload.' });
  }

  if (!isRecommendationType(payload.recommendationType)) {
    return respond(400, { error: 'Invalid recommendationType.' });
  }

  const recommendationType = payload.recommendationType;
  const limit = toSafeLimit(payload.limit, 8);
  const authHeader = toTrimmedString(request.headers.get('Authorization'));

  let userId: string | null = null;

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser(token);

      if (!userError && user) {
        userId = user.id;
      }
    }
  }

  const needsUserContext = recommendationType === 'for_you' || recommendationType === 'wishlist_inspired';
  if (needsUserContext && !userId) {
    return respond(401, { error: 'Authentication required for personalized recommendations.' });
  }

  if (recommendationType === 'similar_products' && !toTrimmedString(payload.productId)) {
    return respond(400, { error: 'productId is required for similar_products.' });
  }

  if (recommendationType === 'visual_similar') {
    const imageBase64 = toTrimmedString(payload.imageBase64);
    const imageUrl = toTrimmedString(payload.imageUrl);
    if (!imageBase64 && !imageUrl) {
      return respond(400, { error: 'imageBase64 or imageUrl is required for visual_similar.' });
    }
  }

  const endpointPath = endpointByType[recommendationType];
  const upstreamUrl = `${recommenderApiUrl.replace(/\/+$/, '')}${endpointPath}`;

  const upstreamBody: Record<string, unknown> = { limit };

  if (recommendationType === 'similar_products') {
    upstreamBody.product_id = toTrimmedString(payload.productId);
    if (userId) {
      upstreamBody.user_id = userId;
    }
  } else if (recommendationType === 'visual_similar') {
    const imageBase64 = toTrimmedString(payload.imageBase64);
    const imageUrl = toTrimmedString(payload.imageUrl);

    if (imageBase64) {
      upstreamBody.image_base64 = imageBase64;
    }

    if (imageUrl) {
      upstreamBody.image_url = imageUrl;
    }

    if (userId) {
      upstreamBody.user_id = userId;
    }
  } else if (recommendationType === 'trending') {
    if (userId) {
      upstreamBody.user_id = userId;
    }
  } else {
    upstreamBody.user_id = userId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-recommender-api-key': recommenderApiKey,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });

    let upstreamPayload: unknown = null;
    try {
      upstreamPayload = await upstreamResponse.json();
    } catch {
      upstreamPayload = null;
    }

    if (!upstreamResponse.ok) {
      const detail =
        typeof upstreamPayload === 'object' && upstreamPayload !== null
          ? ((upstreamPayload as Record<string, unknown>).detail ?? (upstreamPayload as Record<string, unknown>).error)
          : null;

      return jsonResponse(502, {
        error: 'Recommendation service failed.',
        detail: typeof detail === 'string' ? detail : `HTTP ${upstreamResponse.status}`,
      }, requestOrigin);
    }

    return respond(200, upstreamPayload ?? { items: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recommendation service request failed.';
    return respond(504, { error: message });
  } finally {
    clearTimeout(timeout);
  }
});
