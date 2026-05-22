import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Trash2, ArrowRight, Star, Sparkles, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2FhYSI+SW1hZ2U8L3RleHQ+PC9zdmc+';

const Wishlist: React.FC = () => {
  const { wishlist, removeFromWishlist, addToCart } = useCart();
  const { toast } = useToast();

  const handleMoveToCart = (product: typeof wishlist[0]) => {
    addToCart(product);
    removeFromWishlist(product.id);
    toast({
      title: 'Moved to bag',
      description: `${product.name} has been added to your bag.`,
    });
  };

  const handleRemove = (product: typeof wishlist[0]) => {
    removeFromWishlist(product.id);
    toast({
      title: 'Removed from wishlist',
      description: `${product.name} has been removed.`,
    });
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-6 left-[10%] w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-[15%] w-56 h-56 bg-primary/15 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 py-12 md:py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-tulip mb-5 shadow-lg"
            >
              <Heart size={28} className="text-white" fill="white" />
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-display font-bold mb-3 tracking-tight">
              My <span className="text-gradient-tulip">Wishlist</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              {wishlist.length === 0
                ? 'Your wishlist is waiting to be filled with beautiful things'
                : (
                    <>
                      You have <span className="font-semibold text-primary">{wishlist.length}</span> item{wishlist.length > 1 ? 's' : ''} saved for later
                    </>
                  )}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6">
        {/* Empty State */}
        {wishlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Heart size={48} className="text-primary/40" />
                </motion.div>
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-primary/20 rounded-full blur-sm"
              />
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
                className="absolute -bottom-1 -left-3 w-6 h-6 bg-primary/15 rounded-full blur-sm"
              />
            </div>

            <h2 className="text-2xl font-display font-semibold mb-3">Nothing here yet</h2>
            <p className="text-muted-foreground mb-10 max-w-md leading-relaxed">
              Explore our curated collections and tap the <Heart size={14} className="inline text-primary" fill="currentColor" /> icon
              on pieces you love to save them here.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="hero" size="lg" className="gap-2 px-8" asChild>
                <Link to="/">
                  <Sparkles size={18} /> Explore Collections
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2 px-8" asChild>
                <Link to="/categories">
                  Browse Categories <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Summary Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-between mb-8 pb-4 border-b border-border"
            >
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{wishlist.length}</span> saved item{wishlist.length > 1 ? 's' : ''}
              </p>
            </motion.div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-7">
              <AnimatePresence mode="popLayout">
                {wishlist.map((product, i) => {
                  const discount = product.originalPrice
                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                    : 0;

                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10, transition: { duration: 0.3 } }}
                      transition={{ duration: 0.4, delay: i * 0.06 }}
                      className="group relative"
                    >
                      {/* Card */}
                      <div className="rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-soft transition-shadow duration-500">
                        {/* Image */}
                        <div className="aspect-[3/4] overflow-hidden bg-secondary relative">
                          <Link to={`/product/${product.id}`}>
                            <img
                              src={product.image}
                              alt={product.name}
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                            />
                          </Link>

                          {/* Gradient overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

                          {/* Badges */}
                          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                            {product.isNew && (
                              <Badge variant="default" className="bg-foreground text-background text-[10px] px-2.5 py-0.5">
                                New
                              </Badge>
                            )}
                            {discount > 0 && (
                              <Badge className="bg-gradient-tulip text-white text-[10px] px-2.5 py-0.5 border-0">
                                -{discount}%
                              </Badge>
                            )}
                          </div>

                          {/* Remove & Quick View Buttons */}
                          <div className="absolute top-3 right-3 flex flex-col gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemove(product)}
                              className="p-2.5 rounded-full bg-background/90 backdrop-blur-sm text-muted-foreground hover:bg-destructive hover:text-white transition-all duration-300 shadow-sm"
                              aria-label="Remove from wishlist"
                            >
                              <Trash2 size={15} />
                            </motion.button>
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 0 }}
                              whileHover={{ scale: 1.1 }}
                              className="group-hover:!opacity-100 transition-opacity duration-300"
                            >
                              <Link
                                to={`/product/${product.id}`}
                                className="flex p-2.5 rounded-full bg-background/90 backdrop-blur-sm text-muted-foreground hover:bg-primary hover:text-white transition-all duration-300 shadow-sm"
                              >
                                <Eye size={15} />
                              </Link>
                            </motion.div>
                          </div>

                          {/* Add to Bag Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out">
                            <Button
                              variant="hero"
                              size="sm"
                              className="w-full gap-2 shadow-lg backdrop-blur-sm rounded-xl"
                              onClick={() => handleMoveToCart(product)}
                            >
                              <ShoppingBag size={14} /> Move to Bag
                            </Button>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                            {product.brand}
                          </p>
                          <Link
                            to={`/product/${product.id}`}
                            className="block font-body text-sm hover:text-primary transition-colors line-clamp-1 font-medium"
                          >
                            {product.name}
                          </Link>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base">₹{product.price.toLocaleString()}</span>
                              {product.originalPrice && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ₹{product.originalPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rating */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <div className="flex items-center gap-0.5">
                              <Star size={11} className="fill-primary text-primary" />
                              <span className="text-xs font-medium">{product.rating.toFixed(1)}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-16 text-center"
            >
              <div className="inline-flex flex-col items-center p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
                <Sparkles size={24} className="text-primary mb-3" />
                <p className="text-lg font-display font-semibold mb-1">Discover more styles</p>
                <p className="text-sm text-muted-foreground mb-5">Find your next favorite piece</p>
                <Button variant="hero" className="gap-2 px-8" asChild>
                  <Link to="/">
                    Continue Shopping <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </main>
  );
};

export default Wishlist;
