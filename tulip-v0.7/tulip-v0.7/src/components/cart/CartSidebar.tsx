import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { Link } from 'react-router-dom';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const CartSidebar: React.FC = () => {
  const { items, isCartOpen, toggleCart, removeFromCart, updateQuantity, cartTotal } = useCart();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[100]"
            onClick={toggleCart}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background z-[101] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} />
                <h2 className="font-display text-xl">Shopping Bag</h2>
                <span className="text-sm text-muted-foreground">({items.length})</span>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleCart}>
                <X size={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <ShoppingBag size={48} className="text-muted-foreground mb-4" />
                  <p className="font-display text-xl mb-2">Your bag is empty</p>
                  <p className="text-sm text-muted-foreground mb-6">Discover our curated collection</p>
                  <Button variant="pink" onClick={toggleCart}>Continue Shopping</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item, index) => (
                    <motion.div
                      key={`${item.id}-${item.selectedSize || ''}-${item.selectedColor || ''}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4"
                    >
                      <div className="w-24 h-32 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.brand}</p>
                            <p className="font-body font-medium text-sm">{item.name}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id, item.selectedSize, item.selectedColor)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {item.selectedSize && <p className="text-xs text-muted-foreground">Size: {item.selectedSize}</p>}
                        {item.selectedColor && <p className="text-xs text-muted-foreground">Color: {item.selectedColor}</p>}
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center border border-border rounded-full">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                              className="p-2 hover:bg-secondary transition-colors rounded-l-full"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                              className="p-2 hover:bg-secondary transition-colors rounded-r-full"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-border space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-display text-xl">{formatCurrency(cartTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">Shipping and taxes calculated at checkout</p>
                <Button variant="pink" size="lg" className="w-full gap-2" asChild>
                  <Link to="/checkout" onClick={toggleCart}>Checkout <ArrowRight size={16} /></Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={toggleCart}>
                  Continue Shopping
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
