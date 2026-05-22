import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, ArrowUpRight, Sparkles, ImagePlus, Camera, Loader2 } from 'lucide-react';
import { products } from '@/data/products';
import { getVisualSimilarRecommendations } from '@/lib/recommendations';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2FhYSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
const toSecureImageUrl = (value: string) => value.replace(/^http:\/\//i, 'https://');
const formatPrice = (value: number) => `₹${value.toLocaleString()}`;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const popularSearches = [
  { label: 'Silk Dress', emoji: '👗' },
  { label: 'Cashmere', emoji: '🧥' },
  { label: 'Heels', emoji: '👠' },
  { label: 'Tote Bag', emoji: '👜' },
  { label: 'Linen Shirt', emoji: '👔' },
  { label: 'Sneakers', emoji: '👟' },
];

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(products.slice(0, 8));
  const [searchMode, setSearchMode] = useState<'default' | 'text' | 'visual'>('default');
  const [isVisualSearchLoading, setIsVisualSearchLoading] = useState(false);
  const [visualPreview, setVisualPreview] = useState<string | null>(null);
  const [visualError, setVisualError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchMode === 'visual') {
      return;
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
      setResults(filtered.slice(0, 8));
    } else {
      setResults(products.slice(0, 8));
    }
  }, [query, searchMode]);

  const clearVisualSearch = () => {
    setSearchMode('default');
    setVisualPreview(null);
    setVisualError('');
    setIsVisualSearchLoading(false);
    setResults(products.slice(0, 8));
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read image.'));
      };
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
    });

  const runVisualSearch = async (file: File) => {
    if (!file.type.toLowerCase().startsWith('image/')) {
      setVisualError('Please select a valid image file.');
      return;
    }

    setSearchMode('visual');
    setQuery('');
    setVisualError('');
    setIsVisualSearchLoading(true);

    try {
      const imageDataUrl = await fileToDataUrl(file);
      setVisualPreview(imageDataUrl);

      const visualResults = await getVisualSimilarRecommendations(imageDataUrl, 8);
      if (visualResults.length > 0) {
        setResults(visualResults.slice(0, 8));
      } else {
        setResults(products.slice(0, 8));
      }

      if (visualResults.length === 0) {
        setVisualError('No close visual matches found. Showing featured picks instead.');
      }
    } catch {
      setResults(products.slice(0, 8));
      setVisualError('Image search failed. Showing featured picks instead.');
    } finally {
      setIsVisualSearchLoading(false);
    }
  };

  const onUploadInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      await runVisualSearch(selectedFile);
    }
    event.target.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setSearchMode('default');
      setResults(products.slice(0, 8));
      setVisualPreview(null);
      setVisualError('');
      setIsVisualSearchLoading(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const modeLabel = searchMode === 'visual'
    ? 'Visual Search'
    : (query.trim() ? 'Text Search' : 'Discover');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[99] bg-black/60"
            onClick={onClose}
          />

          {/* Modal panel — centered card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 sm:inset-x-6 top-12 sm:top-16 z-[100] max-w-4xl mx-auto bg-background rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
          >
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <p className="text-sm font-semibold">Search & Discover</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    {modeLabel}
                  </span>
                  <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-border bg-background px-2 text-[10px] text-muted-foreground">
                    Esc
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3 py-2.5">
                <Search size={18} className="text-primary shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search products, brands, categories…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchMode(e.target.value.trim() ? 'text' : 'default');
                    setVisualPreview(null);
                    setVisualError('');
                  }}
                  className="flex-1 bg-transparent text-[15px] font-body placeholder:text-muted-foreground focus:outline-none"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onUploadInputChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onUploadInputChange}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                  title="Upload product image"
                  aria-label="Upload product image"
                >
                  <ImagePlus size={14} />
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                  title="Scan product with camera"
                  aria-label="Scan product with camera"
                >
                  <Camera size={14} />
                </button>

                <AnimatePresence>
                  {query && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      onClick={() => {
                        setQuery('');
                        clearVisualSearch();
                      }}
                      className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="Clear search"
                    >
                      <X size={12} />
                    </motion.button>
                  )}
                </AnimatePresence>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors ml-1"
                  title="Close search"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 pb-6 max-h-[72vh] overflow-y-auto">

              {(searchMode === 'visual' || isVisualSearchLoading || visualError) && (
                <div className="pt-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3.5">
                    {visualPreview ? (
                      <img src={visualPreview} alt="Uploaded product" className="w-20 h-20 rounded-lg object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <ImagePlus size={18} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {isVisualSearchLoading ? 'Scanning image for similar products…' : 'Visual search active'}
                      </p>
                      {visualError ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{visualError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Upload or scan another image to refine matches.</p>
                      )}
                    </div>

                    {isVisualSearchLoading ? (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                      <button
                        onClick={clearVisualSearch}
                        className="text-xs text-primary hover:underline underline-offset-2"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Popular searches ── */}
              <AnimatePresence mode="wait">
                {!query && searchMode !== 'visual' && (
                  <motion.div
                    key="popular"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="pt-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={14} className="text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Popular Right Now
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2.5 rounded-2xl border border-border bg-secondary/20 p-3">
                      {popularSearches.map((item, i) => (
                        <motion.button
                          key={item.label}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => {
                            setSearchMode('text');
                            setVisualPreview(null);
                            setVisualError('');
                            setQuery(item.label);
                          }}
                          className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary hover:text-primary-foreground transition-all duration-200 text-sm font-medium"
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                          <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Section header ── */}
              <div className="flex items-center justify-between mt-6 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {searchMode === 'visual'
                      ? (isVisualSearchLoading
                        ? 'Searching Visual Matches'
                        : (results.length > 0 ? `${results.length} Visual Matches` : 'No Visual Matches'))
                      : (query
                        ? (results.length > 0 ? `${results.length} Results` : 'No Results')
                        : 'Featured Picks')}
                  </span>
                </div>
                {query && searchMode === 'text' && results.length > 0 && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/categories');
                    }}
                    className="text-xs text-primary hover:underline underline-offset-2 transition-all"
                  >
                    View all
                  </button>
                )}
              </div>

              {/* ── Product grid ── */}
              {results.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {results.map((product, i) => (
                    <motion.button
                      key={product.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        onClose();
                        navigate(`/product/${product.id}`);
                      }}
                      className="text-left group relative rounded-xl border border-border/60 bg-background p-2.5 hover:border-primary/40 hover:bg-secondary/20 transition-all duration-200"
                    >
                      {/* Image */}
                      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary mb-2.5">
                        <img
                          src={toSecureImageUrl(product.image || PLACEHOLDER_IMAGE)}
                          alt={product.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            (event.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                          }}
                          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-300 rounded-xl" />
                        {/* Quick-look pill */}
                        <div className="absolute bottom-2 inset-x-2 flex justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 bg-background text-foreground text-[10px] font-semibold px-3 py-1 rounded-full shadow-md">
                            Quick Look
                          </span>
                        </div>
                      </div>
                      {/* Info */}
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate mb-0.5">
                        {product.brand}
                      </p>
                      <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs font-semibold">{formatPrice(product.price)}</p>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate ml-2">
                          {product.category}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-secondary/20 mt-1">
                  <p className="text-3xl mb-3">🔍</p>
                  {searchMode === 'visual' ? (
                    <>
                      <p className="text-sm font-medium">No visual matches found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try another image or capture in better lighting</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">No results for "{query}"</p>
                      <p className="text-xs text-muted-foreground mt-1">Try a different keyword</p>
                    </>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SearchModal;
