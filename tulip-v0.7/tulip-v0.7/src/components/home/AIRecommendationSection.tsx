import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '@/components/products/ProductCard';
import { products, type Product } from '@/data/products';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import {
  getForYouRecommendations,
  getTrendingRecommendations,
  getWishlistInspiredRecommendations,
} from '@/lib/recommendations';

type RecommendationCategoryId = 'for-you' | 'wishlist-inspired' | 'similar';

type RecommendationCategory = {
  id: RecommendationCategoryId;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
};

const DISPLAY_ROW_SIZE = 4;
const RECOMMENDATION_POOL_SIZE = 16;

const fillRecommendationRow = (
  primary: Product[],
  fallback: Product[],
  limit = 4,
  includeCatalogFill = true,
): Product[] => {
  const merged: Product[] = [];
  const seenProductIds = new Set<string>();

  const pushProduct = (product: Product) => {
    const id = String(product.id).trim();
    if (!id || seenProductIds.has(id)) {
      return;
    }

    merged.push(product);
    seenProductIds.add(id);
  };

  for (const product of primary) {
    pushProduct(product);
    if (merged.length >= limit) {
      return merged;
    }
  }

  for (const product of fallback) {
    pushProduct(product);
    if (merged.length >= limit) {
      return merged;
    }
  }

  if (!includeCatalogFill) {
    return merged;
  }

  for (const product of products) {
    pushProduct(product);
    if (merged.length >= limit) {
      return merged;
    }
  }

  return merged;
};

const scoreWishlistSimilarity = (seed: Product, candidate: Product): number => {
  let score = 0;

  if (seed.category === candidate.category) score += 0.34;
  if (seed.masterCategory === candidate.masterCategory) score += 0.22;
  if (seed.subCategory === candidate.subCategory) score += 0.14;
  if (seed.articleType === candidate.articleType) score += 0.12;
  if (seed.gender === candidate.gender) score += 0.08;
  if (seed.usage === candidate.usage) score += 0.04;
  if (seed.baseColour === candidate.baseColour) score += 0.03;
  if (seed.brand === candidate.brand) score += 0.03;

  return score;
};

const buildWishlistAwareFallback = (wishlist: Product[], limit = 4): Product[] => {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 24));
  const normalizedWishlist = wishlist.filter(Boolean);

  if (normalizedWishlist.length === 0) {
    return fillRecommendationRow(products.filter((product) => product.isNew), products, safeLimit, true);
  }

  const wishlistIds = new Set(normalizedWishlist.map((product) => String(product.id).trim()));

  const ranked = products
    .filter((product) => !wishlistIds.has(String(product.id).trim()))
    .map((candidate) => {
      const affinity = normalizedWishlist.reduce(
        (sum, seed, index) => sum + (scoreWishlistSimilarity(seed, candidate) * (1 / (index + 1))),
        0,
      );

      const score = affinity + (candidate.isTrending ? 0.05 : 0) + ((candidate.rating || 0) / 5) * 0.04;
      return { product: candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit)
    .map((entry) => entry.product);

  return fillRecommendationRow(ranked, products.filter((product) => product.isNew), safeLimit, false);
};

const pickRandomProducts = (items: Product[], limit: number): Product[] => {
  const safeLimit = Math.max(1, Math.floor(limit));
  if (items.length <= safeLimit) {
    return items.slice(0, safeLimit);
  }

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, safeLimit);
};

const toDisplayRows = (
  rows: Record<RecommendationCategoryId, Product[]>,
): Record<RecommendationCategoryId, Product[]> => ({
  'for-you': pickRandomProducts(rows['for-you'], DISPLAY_ROW_SIZE),
  'wishlist-inspired': pickRandomProducts(rows['wishlist-inspired'], DISPLAY_ROW_SIZE),
  similar: pickRandomProducts(rows.similar, DISPLAY_ROW_SIZE),
});

const recommendationCategories: RecommendationCategory[] = [
  {
    id: 'for-you',
    title: 'Recommended for You',
    subtitle: 'Based on your browsing history',
    icon: Sparkles,
  },
  {
    id: 'wishlist-inspired',
    title: 'Inspired by Your Wishlist',
    subtitle: 'Similar to items you love',
    icon: Heart,
  },
  {
    id: 'similar',
    title: 'Customers Also Viewed',
    subtitle: 'Popular among similar shoppers',
    icon: Eye,
  },
];

const categoryRouteMap: Record<RecommendationCategoryId, string> = {
  'for-you': '/categories',
  'wishlist-inspired': '/wishlist',
  similar: '/categories',
};

const AIRecommendationSection: React.FC = () => {
  const { wishlist } = useCart();

  const fallbackRecommendations = useMemo<Record<RecommendationCategoryId, Product[]>>(() => ({
    'for-you': fillRecommendationRow(
      products.filter((product) => product.isAIPick),
      products,
      RECOMMENDATION_POOL_SIZE,
    ),
    'wishlist-inspired': buildWishlistAwareFallback(wishlist, RECOMMENDATION_POOL_SIZE),
    similar: fillRecommendationRow(
      products.filter((product) => product.isTrending),
      products,
      RECOMMENDATION_POOL_SIZE,
    ),
  }), [wishlist]);

  const [categoryProducts, setCategoryProducts] =
    useState<Record<RecommendationCategoryId, Product[]>>(() => toDisplayRows(fallbackRecommendations));

  useEffect(() => {
    let isCancelled = false;

    const loadRecommendations = async () => {
      try {
        const [forYou, wishlistInspired, trending] = await Promise.all([
          getForYouRecommendations(RECOMMENDATION_POOL_SIZE),
          getWishlistInspiredRecommendations(RECOMMENDATION_POOL_SIZE),
          getTrendingRecommendations(RECOMMENDATION_POOL_SIZE),
        ]);

        if (isCancelled) return;

        const nextRows: Record<RecommendationCategoryId, Product[]> = {
          'for-you': fillRecommendationRow(
            forYou,
            fallbackRecommendations['for-you'],
            RECOMMENDATION_POOL_SIZE,
          ),
          'wishlist-inspired': fillRecommendationRow(
            wishlistInspired,
            fallbackRecommendations['wishlist-inspired'],
            RECOMMENDATION_POOL_SIZE,
            false,
          ),
          similar: fillRecommendationRow(
            trending,
            fallbackRecommendations.similar,
            RECOMMENDATION_POOL_SIZE,
          ),
        };

        setCategoryProducts(toDisplayRows(nextRows));
      } catch {
        if (isCancelled) return;
        setCategoryProducts(toDisplayRows(fallbackRecommendations));
      }
    };

    void loadRecommendations();

    return () => {
      isCancelled = true;
    };
  }, [fallbackRecommendations]);

  return (
    <section className="py-24 md:py-32 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full text-sm mb-6"
          >
            <Sparkles size={16} />
            <span className="uppercase tracking-widest text-xs font-medium">AI Powered</span>
          </motion.div>
          
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="font-display text-display-md mb-4">Personalized For You</motion.h2>
          
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-muted-foreground max-w-xl mx-auto">
            Our AI analyzes your preferences to curate a unique shopping experience
          </motion.p>
        </div>

        <div className="space-y-20">
          {recommendationCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <category.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl md:text-2xl">{category.title}</h3>
                    <p className="text-sm text-muted-foreground">{category.subtitle}</p>
                  </div>
                </div>
                <Button variant="minimal" className="hidden md:flex gap-2" asChild>
                  <Link to={categoryRouteMap[category.id]}>View All</Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {(categoryProducts[category.id] || fallbackRecommendations[category.id]).map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mt-16">
          <Button variant="pink" size="lg" className="gap-2" asChild>
            <Link to="/categories">
              <Sparkles size={18} /> Explore AI Picks
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default AIRecommendationSection;
