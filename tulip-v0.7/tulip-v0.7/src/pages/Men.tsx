import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, X, ChevronDown,
  Sparkles, ArrowUpDown, Grid3X3, LayoutList,
} from 'lucide-react';
import VirtualProductGrid from '@/components/products/VirtualProductGrid';
import { Button } from '@/components/ui/button';
import { products, MasterCategory, Usage } from '@/data/products';
import { useCart } from '@/context/CartContext';

// ── Constants ───────────────────────────────────────────────────────────────
const masterCategories: MasterCategory[] = ['Apparel', 'Accessories', 'Footwear', 'Personal Care'];
const usageOptions: Usage[] = ['Casual', 'Ethnic', 'Formal', 'Sports', 'Smart Casual', 'Travel', 'Party'];
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'new', label: 'New Arrivals' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'discount', label: 'Biggest Discount' },
];
const colorOptions = [
  { label: 'Navy', hex: '#1E3A5F' },
  { label: 'Black', hex: '#1a1a1a' },
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Grey', hex: '#718096' },
  { label: 'Blue', hex: '#3182CE' },
  { label: 'Green', hex: '#38A169' },
  { label: 'Brown', hex: '#744210' },
  { label: 'Beige', hex: '#F5E6D3' },
  { label: 'Red', hex: '#E53E3E' },
  { label: 'Orange', hex: '#ED8936' },
];

// ── Subcategory image tabs ──────────────────────────────────────────────────
const subCategoryTabs: { id: string; label: string; image: string; match: string[]; objectPosition?: string }[] = [
  {
    id: 'All',
    label: 'All Men',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
    match: [],
  },
  {
    id: 'Topwear',
    label: 'Topwear',
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center top',
    match: ['Topwear'],
  },
  {
    id: 'Shoes',
    label: 'Footwear',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&fit=crop&auto=format&q=80',
    objectPosition: 'center',
    match: ['Shoes', 'Sandal', 'Flip Flops'],
  },
  {
    id: 'Watches',
    label: 'Watches & Belts',
    image: 'https://images.pexels.com/photos/322207/pexels-photo-322207.jpeg',
    objectPosition: 'center',
    match: ['Watches', 'Belts', 'Wallets', 'Eyewear', 'Ties', 'Headwear', 'Jewellery'],
  },
  {
    id: 'Bottomwear',
    label: 'Bottomwear',
    image: 'https://images.pexels.com/photos/17720474/pexels-photo-17720474.jpeg',
    objectPosition: 'center top',
    match: ['Bottomwear'],
  },
  {
    id: 'Innerwear',
    label: 'Innerwear',
    image: 'data:image/jpeg;base64,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',
    objectPosition: 'center',
    match: ['Innerwear', 'Socks', 'Loungewear and Nightwear'],
  },
  {
    id: 'Fragrance',
    label: 'Fragrance',
    image: 'https://images.pexels.com/photos/8793476/pexels-photo-8793476.jpeg',
    objectPosition: 'center',
    match: ['Fragrance'],
  },
];

const menHeroBackgroundImage = 'https://images.pexels.com/photos/7679877/pexels-photo-7679877.jpeg';

// ── Men-only base set ────────────────────────────────────────────────────────
const menProducts = products.filter((p) => p.gender === 'Men');

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
const Men: React.FC = () => {
  const navigate = useNavigate();
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();

  const [activeSubCat, setActiveSubCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selectedCats, setSelectedCats] = useState<MasterCategory[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<Usage[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState<number>(10000);
  const [sortBy, setSortBy] = useState('popular');
  const [viewGrid, setViewGrid] = useState<2 | 4>(4);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const dataMaxPrice = useMemo(
    () => Math.ceil(Math.max(...menProducts.map((p) => p.price)) / 500) * 500,
    [],
  );

  const filtered = useMemo(() => {
    let list = [...menProducts];

    if (activeSubCat !== 'All') {
      const tab = subCategoryTabs.find((t) => t.id === activeSubCat);
      if (tab && tab.match.length > 0) {
        list = list.filter((p) => tab.match.some((m) => p.subCategory.toLowerCase().includes(m.toLowerCase())));
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
          p.baseColour.toLowerCase().includes(q),
      );
    }

    if (selectedCats.length) {
      list = list.filter((p) => selectedCats.includes(p.masterCategory));
    }

    if (selectedUsages.length) {
      list = list.filter((p) => selectedUsages.includes(p.usage));
    }

    if (selectedColors.length) {
      list = list.filter((p) =>
        selectedColors.some((c) => p.baseColour.toLowerCase().includes(c.toLowerCase())),
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
  }, [activeSubCat, search, selectedCats, selectedUsages, selectedColors, priceMax, sortBy]);

  const toggleCat = (c: MasterCategory) =>
    setSelectedCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const toggleUsage = (u: Usage) =>
    setSelectedUsages((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  const toggleColor = (c: string) =>
    setSelectedColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const clearAll = () => {
    setSearch('');
    setActiveSubCat('All');
    setSelectedCats([]);
    setSelectedUsages([]);
    setSelectedColors([]);
    setPriceMax(dataMaxPrice);
    setSortBy('popular');
  };

  const activeFilterCount =
    selectedCats.length + selectedUsages.length + selectedColors.length + (priceMax < dataMaxPrice ? 1 : 0);

  return (
    <main className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <section className="relative isolate pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={menHeroBackgroundImage}
            alt="Men fashion collection"
            loading="eager"
            className="h-full w-full object-cover object-[center_24%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/55 to-background/90" />
        </div>

        <div className="absolute inset-0 z-[1] overflow-hidden">
          <motion.div
            className="absolute top-10 right-[10%] w-72 h-72 rounded-full bg-foreground/6 blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 left-[5%] w-96 h-96 rounded-full bg-primary/5 blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 14, repeat: Infinity }}
          />
        </div>

        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="font-body text-xs uppercase tracking-[0.35em] text-primary mb-3">Men</p>
            <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.05] mb-5">
              His Rules,{' '}
              <span className="text-gradient-tulip italic">His Look</span>
            </h1>
            <p className="font-body text-muted-foreground text-lg max-w-lg">
              {menProducts.length.toLocaleString()} curated essentials — from sharp formals to laid-back weekend wear.
            </p>
          </motion.div>

          {/* Subcategory image cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-10"
          >
            {subCategoryTabs.map((tab, i) => {
              const count = tab.id === 'All'
                ? menProducts.length
                : menProducts.filter((p) => tab.match.some((m) => p.subCategory.toLowerCase().includes(m.toLowerCase()))).length;
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
                        event.currentTarget.src = menHeroBackgroundImage;
                      }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ objectPosition: tab.objectPosition ?? 'center' }}
                    />
                    <div className={`absolute inset-0 transition-all duration-300 ${isActive ? 'bg-primary/40' : 'bg-foreground/35 group-hover:bg-foreground/20'}`} />
                    <div className="absolute inset-0 p-2.5 flex flex-col justify-end">
                      <p className="font-display text-[13px] text-white leading-tight font-medium">{tab.label}</p>
                      <p className="font-body text-[10px] text-white/70 mt-0.5">{count} styles</p>
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
                placeholder="Search men's fashion…"
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
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-medium">Filters</h3>
                    {activeFilterCount > 0 && (
                      <button onClick={clearAll} className="font-body text-xs text-primary underline underline-offset-2">
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {masterCategories.map((cat) => (
                        <Pill key={cat} active={selectedCats.includes(cat)} onClick={() => toggleCat(cat)}>
                          {cat}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  {/* Occasion */}
                  <div>
                    <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">Occasion</p>
                    <div className="flex flex-wrap gap-2">
                      {usageOptions.map((u) => (
                        <Pill key={u} active={selectedUsages.includes(u)} onClick={() => toggleUsage(u)}>
                          {u}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  {/* Colour */}
                  <div>
                    <p className="font-body text-xs uppercase tracking-widest text-muted-foreground mb-3">Colour</p>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((c) => (
                        <button
                          key={c.label}
                          title={c.label}
                          onClick={() => toggleColor(c.label)}
                          className={`relative w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                            selectedColors.includes(c.label) ? 'border-primary scale-110' : 'border-border hover:border-muted-foreground'
                          } ${c.label === 'White' ? 'ring-1 ring-border' : ''}`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {selectedColors.includes(c.label) && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold drop-shadow">✓</span>
                          )}
                        </button>
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
                      min={500}
                      max={dataMaxPrice}
                      step={500}
                      value={priceMax}
                      onChange={(e) => setPriceMax(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between font-body text-[10px] text-muted-foreground mt-1">
                      <span>₹500</span>
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
                {selectedCats.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium">
                    {c} <button onClick={() => toggleCat(c)}><X size={11} /></button>
                  </span>
                ))}
                {selectedUsages.map((u) => (
                  <span key={u} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium">
                    {u} <button onClick={() => toggleUsage(u)}><X size={11} /></button>
                  </span>
                ))}
                {selectedColors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium">
                    {c} <button onClick={() => toggleColor(c)}><X size={11} /></button>
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
                  Try adjusting your search or filters to discover more pieces.
                </p>
                <Button variant="outline" className="rounded-full gap-2 font-body" onClick={clearAll}>
                  Clear Filters
                </Button>
              </motion.div>
            )}

            {/* Grid */}
            <VirtualProductGrid products={filtered} columns={viewGrid} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Men;
