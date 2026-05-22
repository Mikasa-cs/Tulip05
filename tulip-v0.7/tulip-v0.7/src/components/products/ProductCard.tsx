import React, { useState, useCallback } from 'react';
import { Heart, ShoppingBag, Eye, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { Link } from 'react-router-dom';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2FhYSI+SW1hZ2U8L3RleHQ+PC9zdmc+';

const toSecureImageUrl = (value: string) => value.replace(/^http:\/\//i, 'https://');

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, index = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();

  const inWishlist = isInWishlist(product.id);
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const rawImageSrc = imgError
    ? PLACEHOLDER_IMAGE
    : (isHovered && product.hoverImage ? product.hoverImage : product.image);

  const imageSrc = toSecureImageUrl(rawImageSrc || PLACEHOLDER_IMAGE);

  const handleImgError = useCallback(() => setImgError(true), []);
  const handleImgLoad = useCallback(() => setImgLoaded(true), []);

  return (
    <div
      className="group relative animate-fadeIn rounded-2xl bg-background border border-border/40 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-border"
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="aspect-[3/4] overflow-hidden bg-secondary relative">
        <Link to={`/product/${product.id}`}>
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 bg-secondary animate-pulse" />
          )}
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImgError}
            onLoad={handleImgLoad}
            className={`w-full h-full object-cover transition-all duration-500 ${
              imgLoaded || imgError ? 'opacity-100' : 'opacity-0'
            } ${isHovered ? 'scale-[1.06]' : 'scale-100'}`}
          />
        </Link>

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
              <Sparkles size={10} /> AI Pick
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); inWishlist ? removeFromWishlist(product.id) : addToWishlist(product); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95 ${
            inWishlist
              ? 'bg-primary text-primary-foreground opacity-100'
              : 'bg-background/80 text-foreground hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} />
        </button>

        {/* Quick Actions */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 transition-transform duration-300 ${
            isHovered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="flex gap-2">
            <Button variant="hero" size="sm" className="flex-1 gap-2 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
              <ShoppingBag size={13} /> Add to Bag
            </Button>
            <Button variant="outline" size="icon" className="bg-background/90 backdrop-blur-sm shrink-0 rounded-full" asChild>
              <Link to={`/product/${product.id}`}>
                <Eye size={14} />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 pt-2.5 space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-body">{product.brand}</p>
        <Link to={`/product/${product.id}`} className="block font-body text-sm font-medium truncate group-hover:text-primary transition-colors">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="font-body text-sm font-semibold">₹{product.price.toLocaleString()}</span>
          {product.originalPrice && (
            <span className="font-body text-xs text-muted-foreground line-through">₹{product.originalPrice.toLocaleString()}</span>
          )}
          {discount > 0 && (
            <span className="font-body text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">({discount}% off)</span>
          )}
        </div>
        <div className="flex items-center gap-1 pt-0.5">
          <Star size={10} className="fill-primary text-primary" />
          <span className="font-body text-xs text-muted-foreground">{product.rating}</span>
          <span className="font-body text-[10px] text-muted-foreground/60">({product.reviews})</span>
        </div>
        {product.colors && (
          <div className="flex items-center gap-1.5 pt-1.5">
            {product.colors.slice(0, 4).map((color, i) => (
              <span key={i} className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: color }} />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{product.colors.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
