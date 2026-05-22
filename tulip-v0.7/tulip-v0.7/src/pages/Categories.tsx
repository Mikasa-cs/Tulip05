import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Footprints, Sparkles, Heart, ArrowRight, Star, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { products, MasterCategory } from '@/data/products';

const categoryMeta: Record<MasterCategory, {
  icon: React.ReactNode;
  tagline: string;
  image: string;
  objectPosition?: string;
}> = {
  Apparel: {
    icon: <ShoppingBag size={20} />,
    tagline: 'Dresses, tops, and more',
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
  },
  Accessories: {
    icon: <Sparkles size={20} />,
    tagline: 'Bags, jewellery & accents',
    image: 'https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfa?w=1200&fit=crop&auto=format&q=80',
    objectPosition: 'center',
  },
  Footwear: {
    icon: <Footprints size={20} />,
    tagline: 'Heels, flats & sneakers',
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1200&fit=crop&auto=format&q=80',
    objectPosition: 'center',
  },
  'Personal Care': {
    icon: <Heart size={20} />,
    tagline: 'Skincare & beauty essentials',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&fit=crop&auto=format&q=80',
    objectPosition: 'center',
  },
  Skincare: {
    icon: <Heart size={20} />,
    tagline: 'Targeted skincare essentials',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&fit=crop&auto=format&q=80',
    objectPosition: 'center',
  },
};

const genderList = [
  {
    id: 'Women',
    label: 'Women',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1000&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
  },
  {
    id: 'Men',
    label: 'Men',
    image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=1000&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
  },
  {
    id: 'Boys',
    label: 'Boys',
    image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=1000&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
  },
  {
    id: 'Girls',
    label: 'Girls',
    image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=1000&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
  },
];

const masterCategories: MasterCategory[] = ['Apparel', 'Accessories', 'Footwear', 'Personal Care'];

const genderRouteById: Record<string, string> = {
  women: '/women',
  men: '/men',
  boys: '/boys',
  girls: '/girls',
};

const categoriesHeroImage = 'https://images.pexels.com/photos/5864245/pexels-photo-5864245.jpeg';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMaster, setSelectedMaster] = useState<MasterCategory | null>(null);

  const categoryCards = useMemo(() => masterCategories.map((cat) => {
    const catProducts = products.filter((p) => p.masterCategory === cat);
    return { name: cat, count: catProducts.length, ...categoryMeta[cat] };
  }), []);

  const filteredProducts = useMemo(() => {
    if (!selectedMaster) return [];
    return products.filter((p) => p.masterCategory === selectedMaster);
  }, [selectedMaster]);

  const heroStats = useMemo(
    () => [
      { label: 'Categories', value: masterCategories.length.toString() },
      { label: 'Products', value: `${products.length.toLocaleString()}+` },
      { label: 'New', value: products.filter((p) => p.isNew).length.toString() },
      { label: 'Trending', value: products.filter((p) => p.isTrending).length.toString() },
    ],
    [],
  );

  return (
    <main className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <section className="relative isolate pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={categoriesHeroImage}
            alt="Fashion categories"
            loading="eager"
            className="h-full w-full object-cover object-[center_32%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/60 to-background/95" />
        </div>

        <div className="absolute inset-0 overflow-hidden z-[1]">
          <motion.div
            className="absolute top-16 right-[15%] w-64 h-64 rounded-full bg-primary/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 left-[10%] w-80 h-80 rounded-full bg-primary/8 blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 11, repeat: Infinity }}
          />
        </div>

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-4">Collections</p>
            <h1 className="font-display text-5xl md:text-6xl font-medium leading-[1.1] mb-5">
              Shop by <span className="text-gradient-tulip italic">Category</span>
            </h1>
            <p className="font-body text-muted-foreground text-lg max-w-md">
              Explore our curated selections across fashion, beauty, and lifestyle — crafted for you.
            </p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/60 bg-background/65 backdrop-blur-sm px-3 py-2"
                >
                  <p className="font-display text-lg text-foreground leading-none">{stat.value}</p>
                  <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Category Cards ── */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-2">Browse</p>
              <h2 className="font-display text-3xl md:text-4xl font-medium">All Categories</h2>
              <p className="font-body text-sm text-muted-foreground mt-2">Tap a category to preview top products instantly.</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categoryCards.map((cat, index) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -6 }}
                onClick={() => {
                  setSelectedMaster(cat.name);
                  setTimeout(() => document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                }}
                className="group cursor-pointer"
              >
                <div className="relative h-[390px] rounded-3xl overflow-hidden bg-secondary border border-border/60">
                  <motion.img
                    src={cat.image}
                    alt={cat.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.6 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = categoriesHeroImage;
                    }}
                    style={{ objectPosition: cat.objectPosition ?? 'center' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

                  {/* Icon pill top-left */}
                  <div className="absolute top-4 left-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-foreground text-xs font-medium font-body">
                      {cat.icon}
                      <span>{cat.count} items</span>
                    </div>
                  </div>

                  {/* Active indicator */}
                  {selectedMaster === cat.name && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center rounded-full bg-primary text-primary-foreground text-[10px] px-2.5 py-1 uppercase tracking-wide font-body font-semibold">
                        Selected
                      </span>
                    </div>
                  )}

                  {/* Bottom content */}
                  <div className="absolute left-4 right-4 bottom-4 rounded-xl border border-white/20 bg-black/35 backdrop-blur-sm p-4">
                    <p className="font-body text-white/70 text-xs mb-1">{cat.tagline}</p>
                    <h3 className="font-display text-2xl text-white mb-2">{cat.name}</h3>
                    <span className="inline-flex items-center gap-1.5 text-white/85 group-hover:text-white text-xs font-body transition-colors">
                      Explore
                      <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products Grid ── */}
      <AnimatePresence>
        {selectedMaster && (
          <motion.section
            id="products-section"
            key="products"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="py-20 bg-secondary/30"
          >
            <div className="container">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-2">Now showing</p>
                  <h2 className="font-display text-3xl md:text-4xl font-medium">{selectedMaster}</h2>
                  <p className="font-body text-muted-foreground text-sm mt-1">{filteredProducts.length} products</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-2 font-body"
                  onClick={() => setSelectedMaster(null)}
                >
                  <X size={13} /> Clear
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredProducts.slice(0, 12).map((product, index) => {
                  const discount = product.originalPrice
                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                    : 0;
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -4 }}
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary mb-3">
                        <motion.img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.5 }}
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x400/f3f4f6/a3a3a3?text=${encodeURIComponent(product.name.slice(0,20))}`; }}
                        />
                        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                          {product.isNew && (
                            <span className="bg-foreground text-background text-[10px] px-2.5 py-0.5 rounded-full font-medium font-body uppercase tracking-wider">
                              New
                            </span>
                          )}
                          {discount > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 rounded-full font-medium font-body">
                              -{discount}%
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-body">{product.brand}</p>
                      <h4 className="font-body text-sm font-medium truncate group-hover:text-primary transition-colors mt-0.5">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={11} className="fill-primary text-primary" />
                        <span className="font-body text-xs text-muted-foreground">{product.rating}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-body text-sm font-semibold">₹{product.price.toLocaleString()}</span>
                        {product.originalPrice && (
                          <span className="font-body text-xs line-through text-muted-foreground">
                            ₹{product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filteredProducts.length > 12 && (
                <div className="text-center mt-14">
                  <Button variant="outline" size="lg" className="rounded-full px-10 gap-2 font-body">
                    View All {filteredProducts.length} Products
                    <ArrowRight size={16} />
                  </Button>
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Shop by Gender ── */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-2">For Everyone</p>
            <h2 className="font-display text-3xl md:text-4xl font-medium">Shop by Gender</h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {genderList.map((gender, index) => {
              const count = products.filter((p) => p.gender === gender.id as any).length;
              return (
                <motion.div
                  key={gender.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  onClick={() =>
                    navigate(genderRouteById[gender.id.toLowerCase()] || '/categories')
                  }
                  className="group cursor-pointer"
                >
                  <div className="relative h-56 rounded-3xl overflow-hidden bg-secondary border border-border/60">
                    <motion.img
                      src={gender.image}
                      alt={gender.label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      whileHover={{ scale: 1.07 }}
                      transition={{ duration: 0.6 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = categoriesHeroImage;
                      }}
                      style={{ objectPosition: gender.objectPosition ?? 'center' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background/75 text-foreground backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <ArrowRight size={14} />
                      </span>
                    </div>
                    <div className="absolute left-3 right-3 bottom-3 rounded-xl border border-white/20 bg-black/35 backdrop-blur-sm p-3.5">
                      <h3 className="font-display text-xl text-white mb-0.5">{gender.label}</h3>
                      <p className="font-body text-white/70 text-xs">{count} products</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { value: masterCategories.length, suffix: '', label: 'Categories' },
              { value: products.length, suffix: '+', label: 'Products' },
              { value: 500, suffix: '+', label: 'Premium Brands' },
              { value: products.filter((p) => p.isNew).length, suffix: '', label: 'New Arrivals' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-background rounded-2xl p-7 text-center border border-border/50"
              >
                <p className="font-display text-4xl md:text-5xl font-medium text-primary mb-2">
                  {stat.value.toLocaleString()}{stat.suffix}
                </p>
                <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden bg-foreground px-8 md:px-16 py-16 text-center"
          >
            <div className="absolute inset-0">
              <motion.div
                className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/20 blur-3xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-primary/10 blur-3xl"
                animate={{ scale: [1.2, 1, 1.2] }}
                transition={{ duration: 10, repeat: Infinity }}
              />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-center mb-5">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <Flame size={20} className="text-primary-foreground" />
                </div>
              </div>
              <h2 className="font-display text-3xl md:text-4xl text-background font-medium mb-4">
                Not sure where to start?
              </h2>
              <p className="font-body text-background/60 max-w-md mx-auto mb-8">
                Let our AI recommend the perfect pieces from across all categories, tailored just for you.
              </p>
              <Button
                size="lg"
                className="rounded-full px-10 gap-2 font-body bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate('/')}
              >
                <Sparkles size={16} />
                Get AI Picks
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Categories;
