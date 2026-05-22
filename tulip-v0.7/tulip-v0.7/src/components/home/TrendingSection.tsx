import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '@/components/products/ProductCard';
import { products } from '@/data/products';
import { Button } from '@/components/ui/button';

const pickRandomProducts = (items: typeof products, limit = 4) => {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), items.length || 1));
  if (items.length <= safeLimit) {
    return [...items];
  }

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, safeLimit);
};

const TrendingSection: React.FC = () => {
  const trendingProducts = useMemo(
    () => pickRandomProducts(products.filter((product) => product.isTrending), 4),
    [],
  );
  const newProducts = useMemo(
    () => pickRandomProducts(products.filter((product) => product.isNew), 4),
    [],
  );

  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {/* Trending */}
        <div className="mb-24">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                className="w-12 h-12 bg-foreground rounded-full flex items-center justify-center">
                <Flame size={20} className="text-background" />
              </motion.div>
              <div>
                <motion.h2 initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="font-display text-display-sm">Trending Now</motion.h2>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                  className="text-sm text-muted-foreground">Most popular this week</motion.p>
              </div>
            </div>
            <Button variant="outline" className="hidden md:flex gap-2 rounded-full" asChild>
              <Link to="/categories">
                View All <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {trendingProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>

        {/* New Arrivals */}
        <div>
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                className="w-12 h-12 bg-primary rounded-full flex items-center justify-center animate-pulse-glow">
                <TrendingUp size={20} className="text-primary-foreground" />
              </motion.div>
              <div>
                <motion.h2 initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="font-display text-display-sm">New Arrivals</motion.h2>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                  className="text-sm text-muted-foreground">Fresh additions to our garden</motion.p>
              </div>
            </div>
            <Button variant="outline" className="hidden md:flex gap-2 rounded-full" asChild>
              <Link to="/categories">
                View All <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {newProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
