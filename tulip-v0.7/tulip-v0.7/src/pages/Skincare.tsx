import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, X, ChevronDown,
  Sparkles, ArrowUpDown, Grid3X3, LayoutList,
} from 'lucide-react';
import VirtualProductGrid from '@/components/products/VirtualProductGrid';
import { Button } from '@/components/ui/button';
import { products } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { KnowYourSkinModal } from '@/components/home/BrandSection';

// ── Constants ───────────────────────────────────────────────────────────────
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'new', label: 'New Arrivals' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'discount', label: 'Biggest Discount' },
];
const skinTypeOptions = ['Oily', 'Dry', 'Normal', 'Combination', 'Sensitive'];

// ── Subcategory image tabs ──────────────────────────────────────────────────
const subCategoryTabs: { id: string; label: string; image: string; match: string[]; objectPosition?: string }[] = [
  {
    id: 'All',
    label: 'All Skincare',
    image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: [],
  },
  {
    id: 'Face Wash',
    label: 'Cleansers',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Face Wash', 'Cleanser'],
  },
  {
    id: 'Toner',
    label: 'Toners',
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Toner'],
  },
  {
    id: 'Serum',
    label: 'Serums',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Serum'],
  },
  {
    id: 'Moisturizer',
    label: 'Moisturizers',
    image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Moisturizer', 'Cream'],
  },
  {
    id: 'Sunscreen',
    label: 'Sunscreen',
    image: 'https://images.unsplash.com/photo-1532947974-2e3ded9be5a4?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Sunscreen', 'SPF'],
  },
  {
    id: 'Mask',
    label: 'Masks & Peels',
    image: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Mask', 'Peel', 'Exfoliator', 'Scrub'],
  },
  {
    id: 'Eye',
    label: 'Eye Care',
    image: 'https://images.unsplash.com/photo-1583209814683-c023dd293cc6?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Eye'],
  },
];

const skincareHeroBackgroundImage = 'https://images.pexels.com/photos/5113056/pexels-photo-5113056.jpeg';

// ── Skincare-only base set ───────────────────────────────────────────────────
const skincareProducts = products.filter((p) => p.category === 'skincare');

// ── Subcomponent: filter pill ────────────────────────────────────────────────
const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active, onClick, children,
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-body font-medium border transition-all duration-200 whitespace-nowrap ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-foreground border-border hover:border-primary hover:text-primary'
    }`}
  >
    {children}
  </button>
);

// ── Main page ────────────────────────────────────────────────────────────────
const Skincare: React.FC = () => {
  const navigate = useNavigate();
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();

  const [activeSubCat, setActiveSubCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selectedSkinTypes, setSelectedSkinTypes] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState<number>(10000);
  const [sortBy, setSortBy] = useState('popular');
  const [viewGrid, setViewGrid] = useState<2 | 4>(4);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [skinModalOpen, setSkinModalOpen] = useState(false);

  const dataMaxPrice = useMemo(
    () => Math.ceil(Math.max(...skincareProducts.map((p) => p.price), 500) / 500) * 500,
    [],
  );

  const filtered = useMemo(() => {
    let list = [...skincareProducts];

    if (activeSubCat !== 'All') {
      const tab = subCategoryTabs.find((t) => t.id === activeSubCat);
      if (tab && tab.match.length > 0) {
        list = list.filter((p) =>
          tab.match.some((m) => p.subCategory.toLowerCase().includes(m.toLowerCase()) || p.articleType.toLowerCase().includes(m.toLowerCase())),
        );
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.articleType.toLowerCase().includes(q) ||
          p.subCategory.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.notableEffects || '').toLowerCase().includes(q),
      );
    }

    if (selectedSkinTypes.length) {
      list = list.filter((p) =>
        selectedSkinTypes.some((st) => (p.skinType || '').toLowerCase().includes(st.toLowerCase())),
      );
    }

    list = list.filter((p) => p.price <= priceMax);

    switch (sortBy) {
      case 'new':
        list = list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'price-asc':
        list = list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list = list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list = list.sort((a, b) => b.rating - a.rating);
        break;
      case 'discount':
        list = list.sort((a, b) => {
          const da = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
          const db = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
          return db - da;
        });
        break;
      default:
        list = list.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0));
    }

    return list;
  }, [activeSubCat, search, selectedSkinTypes, priceMax, sortBy]);

  const toggleSkinType = (s: string) =>
    setSelectedSkinTypes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const clearAll = () => {
    setSearch('');
    setActiveSubCat('All');
    setSelectedSkinTypes([]);
    setPriceMax(dataMaxPrice);
    setSortBy('popular');
  };

  const activeFilterCount = selectedSkinTypes.length + (priceMax < dataMaxPrice ? 1 : 0);

  return (
    <main className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <section className="relative isolate pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={skincareHeroBackgroundImage}
            alt="Skincare collection"
            loading="eager"
            className="h-full w-full object-cover object-[center_24%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/55 to-background/90" />
        </div>

        <div className="absolute inset-0 z-[1] overflow-hidden">
          <motion.div
            className="absolute top-10 right-[10%] w-72 h-72 rounded-full bg-pink-200/30 blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 left-[5%] w-96 h-96 rounded-full bg-rose-200/20 blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 14, repeat: Infinity }}
          />
        </div>

        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="font-body text-xs uppercase tracking-[0.35em] text-primary mb-3">Skincare</p>
            <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.05] mb-5">
              Glow From{' '}
              <span className="text-gradient-tulip italic">Within</span>
            </h1>
            <p className="font-body text-muted-foreground text-lg max-w-lg">
              {skincareProducts.length.toLocaleString()} premium skincare essentials — cleansers, serums, moisturizers & more.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-5 gap-2 rounded-full px-7 border-primary/30 text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setSkinModalOpen(true)}
            >
              <Sparkles size={15} /> Know Your Skin
            </Button>
          </motion.div>

          {/* Subcategory image cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-10"
          >
            {subCategoryTabs.map((tab, i) => {
              const count = tab.id === 'All'
                ? skincareProducts.length
                : skincareProducts.filter((p) =>
                    tab.match.some((m) => p.subCategory.toLowerCase().includes(m.toLowerCase()) || p.articleType.toLowerCase().includes(m.toLowerCase())),
                  ).length;
              const isActive = activeSubCat === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  whileHover={{ y: -4 }}
                  onClick={() => {
                    setActiveSubCat(tab.id);
                    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className={`relative rounded-2xl overflow-hidden text-left transition-all duration-300 group ${
                    isActive ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                >
                  <div className="relative h-32 sm:h-36">
                    <img
                      src={tab.image}
                      alt={tab.label}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = skincareHeroBackgroundImage;
                      }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ objectPosition: tab.objectPosition ?? 'center' }}
                    />
                    <div className={`absolute inset-0 transition-all duration-300 ${isActive ? 'bg-primary/40' : 'bg-foreground/35 group-hover:bg-foreground/20'}`} />
                    <div className="absolute inset-0 p-2.5 flex flex-col justify-end">
                      <p className="font-display text-[13px] text-white leading-tight font-medium">{tab.label}</p>
                      <p className="font-body text-[10px] text-white/70 mt-0.5">{count} products</p>
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Search + Controls Bar ── */}
      <div id="results" className="sticky top-16 z-30 bg-background/95 backdrop-blur-xl border-b border-border/60 shadow-sm">
        <div className="container py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skincare products…"
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-secondary border border-border focus:border-primary focus:outline-none font-body text-sm transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 font-body shrink-0"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Sort dropdown */}
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-2 font-body"
                onClick={() => setShowSortDropdown((v) => !v)}
              >
                <ArrowUpDown size={14} />
                {sortOptions.find((s) => s.value === sortBy)?.label}
                <ChevronDown size={12} />
              </Button>
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border bg-background shadow-xl z-50 overflow-hidden"
                  >
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                        className={`w-full text-left px-4 py-3 font-body text-sm hover:bg-secondary transition-colors ${
                          sortBy === opt.value ? 'text-primary font-semibold' : ''
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Grid toggle */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <button
                onClick={() => setViewGrid(4)}
                className={`p-2 rounded-lg transition-colors ${viewGrid === 4 ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setViewGrid(2)}
                className={`p-2 rounded-lg transition-colors ${viewGrid === 2 ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
              >
                <LayoutList size={16} />
              </button>
            </div>

            {/* Result count */}
            <p className="font-body text-xs text-muted-foreground shrink-0 hidden md:block">
              {filtered.length.toLocaleString()} results
            </p>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-8">

          {/* ── Sidebar Filters ── */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                key="sidebar"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 260 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 overflow-hidden"
              >
                <div className="w-[260px] space-y-7 pr-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-medium">Filters</h3>
                    {activeFilterCount > 0 && (
                      <button onClick={clearAll} className="font-body text-xs text-primary underline underline-offset-2">
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Skin Type */}
                  <div>
                    <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">Skin Type</p>
                    <div className="flex flex-wrap gap-2">
                      {skinTypeOptions.map((st) => (
                        <Pill key={st} active={selectedSkinTypes.includes(st)} onClick={() => toggleSkinType(st)}>
                          {st}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  {/* Price range */}
                  <div>
                    <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">
                      Max Price — <span className="text-foreground">₹{priceMax.toLocaleString()}</span>
                    </p>
                    <input
                      type="range"
                      min={100}
                      max={dataMaxPrice}
                      step={100}
                      value={priceMax}
                      onChange={(e) => setPriceMax(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between font-body text-[10px] text-muted-foreground mt-1">
                      <span>₹100</span>
                      <span>₹{dataMaxPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* ── Product Grid ── */}
          <div className="flex-1 min-w-0">
            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 mb-6"
              >
                {selectedSkinTypes.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium">
                    {s} <button onClick={() => toggleSkinType(s)}><X size={11} /></button>
                  </span>
                ))}
                {priceMax < dataMaxPrice && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium">
                    ≤ ₹{priceMax.toLocaleString()} <button onClick={() => setPriceMax(dataMaxPrice)}><X size={11} /></button>
                  </span>
                )}
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body text-muted-foreground border border-border hover:border-primary transition-colors"
                >
                  Clear all
                </button>
              </motion.div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <Sparkles size={40} className="text-primary/40 mb-4" />
                <h3 className="font-display text-2xl mb-2">No results found</h3>
                <p className="font-body text-muted-foreground mb-6 max-w-xs">
                  Try adjusting your search or filters to discover more products.
                </p>
                <Button variant="outline" className="rounded-full gap-2 font-body" onClick={clearAll}>
                  Clear Filters
                </Button>
              </motion.div>
            )}

            {/* Grid */}
            <VirtualProductGrid products={filtered} columns={viewGrid} aspectRatio="aspect-square" showSkinType />
          </div>
        </div>
      </div>

      {/* Know Your Skin Modal */}
      <KnowYourSkinModal open={skinModalOpen} onClose={() => setSkinModalOpen(false)} />
    </main>
  );
};

export default Skincare;
