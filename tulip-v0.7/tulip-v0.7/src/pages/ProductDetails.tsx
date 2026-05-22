import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Star, Truck, RotateCcw, Check, Minus, Plus, Share2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { products, Product } from '@/data/products';
import { useToast } from '@/hooks/use-toast';
import ProductCard from '@/components/products/ProductCard';
import { getSimilarRecommendations, trackRecommendationEvent } from '@/lib/recommendations';
import { listProductReviews, type ProductReviewItem } from '@/lib/chat';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist, addToRecentlyViewed } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [mainImage, setMainImage] = useState<string>('');
  const [isAdded, setIsAdded] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [communityReviews, setCommunityReviews] = useState<ProductReviewItem[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  const getDefaultSizes = (p: Product): string[] => {
    const sub = p.subCategory?.toLowerCase() || '';
    const article = p.articleType?.toLowerCase() || '';
    const master = p.masterCategory?.toLowerCase() || '';

    if (master === 'footwear' || sub === 'shoes' || sub === 'flip flops' || sub === 'sandal') {
      return ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'];
    }
    if (master === 'apparel' || sub === 'topwear' || sub === 'bottomwear' || sub === 'dress' || sub === 'innerwear' || sub === 'loungewear and nightwear' || sub === 'saree' || sub === 'apparel set') {
      return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    }
    if (sub === 'socks') {
      return ['Free Size'];
    }
    if (sub === 'belts') {
      return ['S', 'M', 'L', 'XL'];
    }
    if (article === 'ring') {
      return ['6', '7', '8', '9', '10'];
    }
    // Accessories, personal care, etc. — no size needed
    return [];
  };

  useEffect(() => {
    const foundProduct = products.find((p) => p.id === id);
    if (foundProduct) {
      setProduct(foundProduct);
      setMainImage(foundProduct.image);
      setSelectedColor(foundProduct.colors?.[0] || '');
      const sizes = foundProduct.sizes?.length ? foundProduct.sizes : getDefaultSizes(foundProduct);
      setSelectedSize(sizes[0] || '');
    } else {
      navigate('/');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!product) return;

    let isCancelled = false;

    addToRecentlyViewed(product);
    void trackRecommendationEvent('view_product', product.id, { source: 'product_details' });

    const loadSimilarProducts = async () => {
      const nextProducts = await getSimilarRecommendations(product.id, 4);

      if (isCancelled) return;

      setSimilarProducts(nextProducts.filter((item) => item.id !== product.id).slice(0, 4));
    };

    void loadSimilarProducts();

    return () => {
      isCancelled = true;
    };
  }, [addToRecentlyViewed, product]);

  useEffect(() => {
    if (!product) {
      return;
    }

    let isCancelled = false;

    const loadProductReviews = async () => {
      setIsReviewsLoading(true);
      try {
        const nextReviews = await listProductReviews(product.id, 8);
        if (isCancelled) {
          return;
        }
        setCommunityReviews(nextReviews);
      } catch {
        if (isCancelled) {
          return;
        }
        setCommunityReviews([]);
      } finally {
        if (!isCancelled) {
          setIsReviewsLoading(false);
        }
      }
    };

    void loadProductReviews();

    return () => {
      isCancelled = true;
    };
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = () => {
    const sizes = product.sizes?.length ? product.sizes : getDefaultSizes(product);
    if ((sizes.length > 0 && !selectedSize) || 
        (product.colors && product.colors.length > 0 && !selectedColor)) {
      toast({
        title: 'Please select size and color',
        description: 'Size and color are required to add to cart.',
        variant: 'destructive',
      });
      return false;
    }

    addToCart(product, quantity, selectedSize, selectedColor);
    setIsAdded(true);
    toast({
      title: 'Added to cart!',
      description: `${quantity} item(s) added to your bag.`,
    });

    setTimeout(() => setIsAdded(false), 2000);
    return true;
  };

  const handleOrderNow = () => {
    const addedSuccessfully = handleAddToCart();
    if (!addedSuccessfully) {
      return;
    }

    navigate('/checkout');
  };

  const handleWishlist = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      toast({
        title: 'Removed from wishlist',
        description: `${product.name} has been removed from your wishlist.`,
      });
    } else {
      addToWishlist(product);
      toast({
        title: 'Added to wishlist!',
        description: `${product.name} has been added to your wishlist.`,
      });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on Tulip`,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description: 'Product link copied to clipboard.',
      });
    }
  };

  const handleShareToChat = () => {
    navigate(`/chat?shareProduct=${encodeURIComponent(product.id)}`);
  };

  const formatReviewDate = (value: string) =>
    new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <main className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground mb-8 flex items-center gap-2"
        >
          <button
            onClick={() => navigate('/')}
            className="hover:text-foreground transition-colors"
          >
            Home
          </button>
          <span>/</span>
          <button
            onClick={() => navigate('/')}
            className="hover:text-foreground transition-colors"
          >
            {product.masterCategory}
          </button>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {/* Main Image */}
            <div className="aspect-[3/4] bg-secondary rounded-xl overflow-hidden relative group max-w-md mx-auto w-full">
              <motion.img
                key={mainImage}
                src={mainImage}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isNew && (
                  <Badge variant="default" className="bg-foreground text-background">
                    New Arrival
                  </Badge>
                )}
                {discount > 0 && (
                  <Badge variant="destructive" className="bg-primary">
                    -{discount}%
                  </Badge>
                )}
              </div>

              {/* Wishlist */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleWishlist}
                className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur-sm transition-all ${
                  inWishlist
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/80 text-foreground hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                <Heart size={20} fill={inWishlist ? 'currentColor' : 'none'} />
              </motion.button>
            </div>

            {/* Thumbnail Images */}
            {product.hoverImage && (
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setMainImage(product.image)}
                  className={`aspect-[1/1] rounded-lg overflow-hidden border-2 transition-all ${
                    mainImage === product.image ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={product.image} alt="main" loading="lazy" className="w-full h-full object-cover" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setMainImage(product.hoverImage!)}
                  className={`aspect-[1/1] rounded-lg overflow-hidden border-2 transition-all ${
                    mainImage === product.hoverImage ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={product.hoverImage} alt="hover" loading="lazy" className="w-full h-full object-cover" />
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Details Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Brand and Name */}
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
                {product.brand}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={
                        i < Math.floor(product.rating)
                          ? 'fill-primary text-primary'
                          : 'text-muted-foreground'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating}/5 ({product.reviews} reviews)
                </span>
              </div>
            </div>

            {/* Price Section */}
            <div className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">₹{product.price.toLocaleString()}</span>
                {product.originalPrice && (
                  <>
                    <span className="text-lg line-through text-muted-foreground">
                      ₹{product.originalPrice.toLocaleString()}
                    </span>
                    <Badge variant="destructive">-{discount}% OFF</Badge>
                  </>
                )}
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Free shipping on orders above ₹500</p>
            </div>

            {/* Product Info */}
            <div className="space-y-4">
              {product.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </div>
              )}

              {product.material && (
                <div>
                  <h3 className="font-semibold mb-2">Material</h3>
                  <p className="text-sm text-muted-foreground">{product.material}</p>
                </div>
              )}

              {product.fit && (
                <div>
                  <h3 className="font-semibold mb-2">Fit</h3>
                  <p className="text-sm text-muted-foreground">{product.fit}</p>
                </div>
              )}
            </div>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Color: {selectedColor}</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color) => (
                    <motion.button
                      key={color}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        selectedColor === color
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      {color}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {(() => {
              const sizes = product.sizes?.length ? product.sizes : getDefaultSizes(product);
              return sizes.length > 0 ? (
                <div>
                  <h3 className="font-semibold mb-3">Size: {selectedSize}</h3>
                  <div className="flex gap-2 flex-wrap">
                    {sizes.map((size) => (
                      <motion.button
                        key={size}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                          selectedSize === size
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {size}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Quantity Selector */}
            <div>
              <h3 className="font-semibold mb-3">Quantity</h3>
              <div className="flex items-center gap-4 w-fit bg-secondary rounded-lg p-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 hover:bg-background rounded transition-colors"
                >
                  <Minus size={18} />
                </motion.button>
                <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 hover:bg-background rounded transition-colors"
                >
                  <Plus size={18} />
                </motion.button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <motion.div
                animate={{ scale: isAdded ? [1, 1.02, 1] : 1 }}
                className="flex gap-3"
              >
                <Button
                  variant="hero"
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={handleAddToCart}
                >
                  <ShoppingBag size={20} />
                  {isAdded ? 'Added to Bag!' : 'Add to Bag'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={handleShare}
                >
                  <Share2 size={20} />
                </Button>
              </motion.div>

              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={handleShareToChat}
              >
                <MessageCircle size={18} />
                Share & Discuss in Chat
              </Button>

              <Button
                variant="default"
                size="lg"
                className="w-full bg-gradient-tulip hover:opacity-90 text-primary-foreground gap-2"
                onClick={handleOrderNow}
              >
                <Check size={20} />
                Order Now
              </Button>
            </div>

            {/* Shipping & Returns */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-start gap-3">
                <Truck size={20} className="text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Free Shipping</h4>
                  <p className="text-sm text-muted-foreground">On orders above ₹500</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <RotateCcw size={20} className="text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Easy Returns</h4>
                  <p className="text-sm text-muted-foreground">7 days return policy</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            {
              label: 'Category',
              value: product.masterCategory,
            },
            {
              label: 'Gender',
              value: product.gender,
            },
            {
              label: 'Usage',
              value: product.usage,
            },
          ].map((item, index) => (
            <div key={index} className="bg-secondary rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
              <p className="font-semibold">{item.value}</p>
            </div>
          ))}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Community Reviews</h2>
              <p className="text-sm text-muted-foreground mt-1">Real shopper feedback from Tulip chat room</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleShareToChat}>
              <MessageCircle size={14} />
              Write in Chat
            </Button>
          </div>

          {isReviewsLoading ? (
            <div className="rounded-xl border border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
              Loading reviews...
            </div>
          ) : communityReviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
              <p className="text-sm font-medium">No community reviews yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to review this product in community chat.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communityReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold truncate">{review.userName}</p>
                    <p className="text-[11px] text-muted-foreground">{formatReviewDate(review.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 mb-2.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={`${review.id}-${index}`}
                        size={13}
                        className={index < review.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{review.rating}/5</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.reviewText}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {similarProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Similar Picks For You</h2>
                <p className="text-sm text-muted-foreground mt-1">Recommended based on this product and shopper behavior</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {similarProducts.map((similarProduct, index) => (
                <ProductCard key={similarProduct.id} product={similarProduct} index={index} />
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
};

export default ProductDetails;
