import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Scrolls to top on every route change — runs before paint */
export const RouteScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    return () => {
      scrollPositionsRef.current[location.key] = window.scrollY;
    };
  }, [location.key]);

  useLayoutEffect(() => {
    if (location.hash) return;

    if (navigationType !== 'POP') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const previousRootScrollBehavior = root.style.scrollBehavior;
    const previousBodyScrollBehavior = body.style.scrollBehavior;
    const targetScrollTop = navigationType === 'POP'
      ? (scrollPositionsRef.current[location.key] ?? 0)
      : 0;

    root.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';

    window.scrollTo({ top: targetScrollTop, left: 0, behavior: 'auto' });
    root.scrollTop = targetScrollTop;
    body.scrollTop = targetScrollTop;

    const frameId = window.requestAnimationFrame(() => {
      root.style.scrollBehavior = previousRootScrollBehavior;
      body.style.scrollBehavior = previousBodyScrollBehavior;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      root.style.scrollBehavior = previousRootScrollBehavior;
      body.style.scrollBehavior = previousBodyScrollBehavior;
    };
  }, [location.key, location.hash, navigationType]);

  return null;
};

const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-colors"
          aria-label="Scroll to top"
        >
          <ArrowUp size={22} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default ScrollToTop;
