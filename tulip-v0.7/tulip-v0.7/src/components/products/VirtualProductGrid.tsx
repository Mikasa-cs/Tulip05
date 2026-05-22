import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, ShoppingBag, Sparkles } from 'lucide-react';
import { Product } from '@/data/products';
import { useCart } from '@/context/CartContext';
import OptimizedImage from './OptimizedImage';

interface VirtualProductGridProps {
  products: Product[];
  columns?: 2 | 3 | 4;
  aspectRatio?: string;
  showSkinType?: boolean;
}

// Memoized single product card
const GridCard = React.memo<{
  product: Product;
  aspectRatio: string;
  showSkinType?: boolean;
}>(({ product, aspectRatio, showSkinType }) => {
  const navigate = useNavigate();
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();
  const inWishlist = isInWishlist(product.id);
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div
      className="group cursor-pointer rounded-2xl bg-background border border-border/40 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-border"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* Image */}
      <div className={`relative ${aspectRatio} overflow-hidden bg-secondary`}>
        <OptimizedImage
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.06]"
          fallbackText={product.name.slice(0, 20)}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-foreground text-background text-[9px] px-2.5 py-0.5 rounded-full font-body font-medium uppercase tracking-wider">
              New
            </span>
          )}
          {discount > 0 && (
            <span className="bg-primary text-primary-foreground text-[9px] px-2.5 py-0.5 rounded-full font-body font-medium">
              -{discount}%
            </span>
          )}
          {product.isAIPick && (
            <span className="bg-background/80 backdrop-blur-sm text-foreground text-[9px] px-2.5 py-0.5 rounded-full font-body font-medium flex items-center gap-1">
              <Sparkles size={8} /> AI Pick
            </span>
          )}
        </div>

        {/* Skin type badge */}
        {showSkinType && product.skinType && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-background/80 backdrop-blur-sm text-foreground text-[9px] px-2.5 py-0.5 rounded-full font-body font-medium">
              {product.skinType}
            </span>
          </div>
        )}

        {/* Wishlist button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            inWishlist ? removeFromWishlist(product.id) : addToWishlist(product);
          }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95 ${
            inWishlist
              ? 'bg-primary text-primary-foreground opacity-100'
              : 'bg-background/80 text-foreground hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart size={13} fill={inWishlist ? 'currentColor' : 'none'} />
        </button>

        {/* Quick Add to Bag */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            className="w-full py-2 bg-foreground/90 backdrop-blur-sm text-background text-xs font-body font-medium rounded-lg flex items-center justify-center gap-1.5 hover:bg-foreground transition-colors"
          >
            <ShoppingBag size={12} /> Add to Bag
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 pt-2.5 space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-body">{product.brand}</p>
        <h4 className="font-body text-sm font-medium truncate group-hover:text-primary transition-colors">
          {product.name}
        </h4>
        <div className="flex items-center gap-1 pt-0.5">
          <Star size={10} className="fill-primary text-primary" />
          <span className="font-body text-xs text-muted-foreground">{product.rating}</span>
          <span className="font-body text-[10px] text-muted-foreground/60">({product.reviews})</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="font-body text-sm font-semibold">₹{product.price.toLocaleString()}</span>
          {product.originalPrice && (
            <span className="font-body text-xs line-through text-muted-foreground">
              ₹{product.originalPrice.toLocaleString()}
            </span>
          )}
          {discount > 0 && (
            <span className="font-body text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">({discount}% off)</span>
          )}
        </div>
      </div>
    </div>
  );
});

GridCard.displayName = 'GridCard';

// Row height = image height + info section (~100px with padding) + gap
const ROW_HEIGHT_MAP: Record<number, number> = { 2: 640, 3: 500, 4: 440 };
const GAP = 24;

const VirtualProductGrid: React.FC<VirtualProductGridProps> = ({
  products,
  columns = 4,
  aspectRatio = 'aspect-[3/4]',
  showSkinType = false,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (listRef.current) {
        const rect = listRef.current.getBoundingClientRect();
        setScrollMargin(rect.top + window.scrollY);
      }
    };
    measure();
    // Re-measure after layout settles
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [products.length]);

  const rowCount = Math.ceil(products.length / columns);
  const estimatedRowHeight = ROW_HEIGHT_MAP[columns] ?? 440;

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: useCallback(() => estimatedRowHeight + GAP, [estimatedRowHeight]),
    overscan: 5,
    scrollMargin,
    measureElement: (el) => {
      // Measure actual rendered height + gap
      return el.getBoundingClientRect().height + GAP;
    },
  });

  const colsClass = columns === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : columns === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div ref={listRef}>
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columns;
          const rowProducts = products.slice(startIdx, startIdx + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={`absolute left-0 w-full grid ${colsClass} gap-4 md:gap-6`}
              style={{
                top: 0,
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              {rowProducts.map((product) => (
                <GridCard
                  key={product.id}
                  product={product}
                  aspectRatio={aspectRatio}
                  showSkinType={showSkinType}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(VirtualProductGrid);
