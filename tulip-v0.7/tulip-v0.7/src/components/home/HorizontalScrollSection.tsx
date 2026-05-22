import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { categories } from '@/data/products';

const HorizontalScrollSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end center"],
  });

  const smoothedProgress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 32,
    mass: 0.22,
    restDelta: 0.001,
  });

  const activeProgress = shouldReduceMotion ? scrollYProgress : smoothedProgress;
  const x = useTransform(activeProgress, [0, 1], ["0%", "-66.666%"]);

  return (
    <section ref={containerRef} className="relative h-[240vh] md:h-[260vh] touch-pan-y">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden touch-pan-y">
        <div className="absolute top-24 left-6 md:left-12 z-10">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-2">Explore</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-display text-display-md">Collections</motion.h2>
        </div>

        <motion.div style={{ x }} className="flex gap-8 pl-6 md:pl-12 pr-6 md:pr-12 will-change-transform transform-gpu">
          <div className="w-[300px] md:w-[400px] flex-shrink-0 flex flex-col justify-center">
            <p className="text-muted-foreground mb-6 font-body leading-relaxed">
              Discover our carefully curated categories, 
              each designed to help your personal style bloom 
              with timeless pieces and contemporary elegance.
            </p>
            <Link to="/categories" className="inline-flex items-center gap-2 text-sm text-primary hover:gap-4 transition-all">
              <span className="uppercase tracking-widest">View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {categories.map((category, index) => (
            <Link key={category.id} to={`/category/${category.id}`} className="group w-[350px] md:w-[450px] flex-shrink-0">
              <motion.div className="relative aspect-[4/5] overflow-hidden rounded-3xl" whileHover={{ scale: 0.98 }} transition={{ duration: 0.4 }}>
                <img src={category.image} alt={category.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p className="text-xs uppercase tracking-[0.3em] text-background/70 mb-2">0{index + 1}</p>
                  <h3 className="font-display text-3xl md:text-4xl text-background mb-3">{category.name}</h3>
                  <p className="text-sm text-background/80 font-body mb-4">{category.description}</p>
                  <div className="flex items-center gap-2 text-background text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="uppercase tracking-widest">Explore</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}

          <div className="w-[300px] md:w-[400px] flex-shrink-0 flex flex-col items-center justify-center bg-secondary rounded-3xl">
            <motion.div className="text-center p-8" whileHover={{ scale: 1.05 }}>
              <p className="font-display text-2xl mb-4">Ready to Bloom?</p>
              <p className="text-sm text-muted-foreground mb-6">Find pieces that speak to your unique style</p>
              <Link to="/shop" className="inline-flex items-center gap-2 bg-gradient-tulip text-primary-foreground px-6 py-3 rounded-full text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
                Shop Now <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-6 md:left-12 right-6 md:right-12">
          <div className="h-[2px] bg-border rounded-full">
            <motion.div className="h-full bg-primary rounded-full origin-left" style={{ scaleX: activeProgress }} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HorizontalScrollSection;
