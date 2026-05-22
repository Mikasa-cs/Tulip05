import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, ShoppingBag, Menu, X, User, ShoppingCart, MapPin, ClockArrowUp, Settings, LogIn, LayoutDashboard, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
const SearchModal = lazy(() => import('@/components/search/SearchModal'));

const profileMenuItems = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Shopping Room', href: '/shop', icon: ShoppingCart },
  { name: 'Community Chat', href: '/chat', icon: MessageCircle },
  { name: 'Track Order', href: '/track-order', icon: MapPin },
  { name: 'Order History', href: '/order-history', icon: ClockArrowUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Women', href: '/women' },
  { name: 'Men', href: '/men' },
  { name: 'Boys', href: '/boys' },
  { name: 'Girls', href: '/girls' },
  { name: 'Footwear', href: '/footwear' },
  { name: 'Skincare', href: '/skincare' },
  { name: 'Categories', href: '/categories' },
];

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { cartCount, wishlist, toggleCart } = useCart();
  const { user, isLoggedIn } = useAuth();
  const isAdmin = isLoggedIn && user?.role === 'admin';
  const menuItems = isAdmin
    ? [{ name: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard }, ...profileMenuItems]
    : profileMenuItems;

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-background/90 backdrop-blur-xl shadow-soft border-b border-border/50'
            : 'bg-transparent'
        }`}
      >

        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile menu */}
            <button
              className="lg:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <img src="/Tulip n icon.png" alt="Tulip Logo" className="h-8 md:h-10 w-auto" />
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight italic">
                Tulip
              </h1>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="font-body text-sm tracking-widest uppercase luxury-underline hover:text-primary transition-colors duration-300"
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="hidden sm:flex">
                <Search size={20} />
              </Button>
              <div ref={profileRef} className="relative hidden sm:block">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsProfileOpen((v) => !v)}
                  className="relative"
                >
                  {isLoggedIn && user ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-tulip flex items-center justify-center text-white text-xs font-bold">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  ) : (
                    <User size={20} />
                  )}
                </Button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-56 rounded-xl bg-background/95 backdrop-blur-xl border border-border shadow-lg overflow-hidden z-50"
                    >
                      {isLoggedIn && user ? (
                        <>
                          <div className="px-4 py-3 border-b border-border bg-secondary/50">
                            <p className="text-sm font-semibold">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="py-1.5">
                            {menuItems.map((item) => (
                              <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors group"
                              >
                                <item.icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="px-4 py-3 border-b border-border bg-secondary/50">
                            <p className="text-sm font-semibold">My Account</p>
                            <p className="text-xs text-muted-foreground">Sign in to manage your account</p>
                          </div>
                          <div className="py-1.5">
                            {menuItems.map((item) => (
                              <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors group"
                              >
                                <item.icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                {item.name}
                              </Link>
                            ))}
                          </div>
                          <div className="border-t border-border py-1.5">
                            <Link
                              to="/login"
                              onClick={() => setIsProfileOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors group text-primary"
                            >
                              <LogIn size={16} className="group-hover:text-primary transition-colors" />
                              Sign In / Sign Up
                            </Link>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Button variant="ghost" size="icon" className="relative">
                <Link to="/wishlist">
                  <Heart size={20} />
                  {wishlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {wishlist.length}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleCart} className="relative">
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </Button>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-background/95 backdrop-blur-xl border-t border-border"
            >
              <div className="container mx-auto px-6 py-6 space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="block font-body text-lg tracking-wide py-2 hover:text-primary transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="pt-4 border-t border-border space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => { setIsMobileMenuOpen(false); setIsSearchOpen(true); }}
                  >
                    <Search size={20} /> Search
                  </Button>
                  {menuItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button variant="ghost" className="w-full justify-start gap-3">
                        <item.icon size={20} /> {item.name}
                      </Button>
                    </Link>
                  ))}
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-primary">
                      <LogIn size={20} /> Sign In / Sign Up
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default Navbar;
