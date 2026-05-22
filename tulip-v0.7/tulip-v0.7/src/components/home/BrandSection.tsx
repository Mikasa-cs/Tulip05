import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Droplets, Leaf, ShieldCheck, Play, X, Sun, CloudRain, Flame, Blend, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const MarqueeSection: React.FC = () => {
  const phrases = [
    'Free Shipping Over ₹999',
    'AI-Powered Recommendations',
    'Premium Quality',
    'Sustainable Fashion',
    'Skincare Essentials',
    'Worldwide Delivery',
  ];

  return (
    <section className="py-5 bg-foreground text-background overflow-hidden">
      <div className="animate-marquee flex whitespace-nowrap">
        {[...phrases, ...phrases].map((phrase, i) => (
          <span key={i} className="mx-8 text-sm uppercase tracking-[0.3em] font-body flex items-center gap-4">
            <span className="text-tulip-light">🌷</span>
            {phrase}
          </span>
        ))}
      </div>
    </section>
  );
};

const highlights = [
  { icon: Droplets, label: 'Hydration', desc: 'Deep moisture formulas' },
  { icon: Leaf, label: 'Natural', desc: 'Clean ingredients' },
  { icon: ShieldCheck, label: 'Derma-Tested', desc: 'Safe for all skin' },
  { icon: Sparkles, label: 'AI Matched', desc: 'Personalized picks' },
];

const stats = [
  { value: '1200+', label: 'Products' },
  { value: '98%', label: 'Satisfaction' },
  { value: '50+', label: 'Top Brands' },
];

const SKINCARE_SECTION_VIDEOS = [
  'https://videos.pexels.com/video-files/6925816/6925816-hd_1080_1920_25fps.mp4',
  'https://www.pexels.com/download/video/6543241/',
  'https://www.pexels.com/download/video/4351023/',
];

/* ── Skin type data ── */
const skinTypes = [
  {
    name: 'Normal Skin',
    icon: Heart,
    color: 'from-green-400/20 to-emerald-400/10',
    border: 'border-green-300/40',
    image: 'https://images.pexels.com/photos/3764013/pexels-photo-3764013.jpeg',
    traits: ['Balanced oil & moisture', 'Small pores', 'Smooth texture', 'Rarely sensitive'],
    routine: 'Gentle cleanser → Lightweight moisturizer → SPF 30+',
    tip: 'Keep it simple! Your skin is naturally balanced — avoid over-treating it.',
  },
  {
    name: 'Oily Skin',
    icon: Droplets,
    color: 'from-blue-400/20 to-cyan-400/10',
    border: 'border-blue-300/40',
    image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&q=80',
    traits: ['Excess sebum', 'Enlarged pores', 'Shiny T-zone', 'Prone to acne'],
    routine: 'Foaming cleanser → Niacinamide serum → Oil-free moisturizer → SPF',
    tip: 'Don\'t skip moisturizer! Dehydrated oily skin produces even more oil.',
  },
  {
    name: 'Dry Skin',
    icon: Sun,
    color: 'from-amber-400/20 to-orange-400/10',
    border: 'border-amber-300/40',
    image: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=400&q=80',
    traits: ['Tight feeling', 'Flaky patches', 'Fine lines visible', 'Dull appearance'],
    routine: 'Cream cleanser → Hyaluronic acid → Rich moisturizer → Face oil → SPF',
    tip: 'Layer hydration and always apply products on damp skin for better absorption.',
  },
  {
    name: 'Combination',
    icon: Blend,
    color: 'from-purple-400/20 to-violet-400/10',
    border: 'border-purple-300/40',
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80',
    traits: ['Oily T-zone', 'Dry cheeks', 'Mixed pore sizes', 'Variable concerns'],
    routine: 'Gel cleanser → Balancing toner → Zone-specific products → SPF',
    tip: 'Use different products for different zones — lightweight on T-zone, richer on cheeks.',
  },
  {
    name: 'Sensitive Skin',
    icon: ShieldCheck,
    color: 'from-rose-400/20 to-pink-400/10',
    border: 'border-rose-300/40',
    image: 'https://images.unsplash.com/photo-1573461160327-b450ce3d8e7f?w=400&q=80',
    traits: ['Easily irritated', 'Redness & flushing', 'Reacts to products', 'Thin skin barrier'],
    routine: 'Micellar water → Centella serum → Barrier cream → Mineral SPF',
    tip: 'Patch test everything! Stick to fragrance-free, minimal-ingredient formulas.',
  },
];

const skincareTips = [
  { emoji: '💧', text: 'Drink at least 8 glasses of water daily' },
  { emoji: '🌙', text: 'Never skip your nighttime routine' },
  { emoji: '☀️', text: 'Wear SPF 30+ every single day' },
  { emoji: '🧴', text: 'Apply products thinnest to thickest' },
  { emoji: '🍎', text: 'Diet directly affects skin health' },
  { emoji: '😴', text: 'Sleep 7-8 hours for skin repair' },
];

/* ── Know Your Skin Modal ── */
const KnowYourSkinModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [activeType, setActiveType] = useState(0);

  if (!open) return null;

  const active = skinTypes[activeType];
  const Icon = active.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-background rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border/50"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-[10px] uppercase tracking-[0.3em] px-4 py-1.5 rounded-full mb-3 font-body border border-primary/20">
                  <Sparkles size={10} /> Skin Guide
                </span>
                <h3 className="font-display text-2xl md:text-3xl">Know Your Skin</h3>
                <p className="text-muted-foreground text-sm font-body mt-2 max-w-md mx-auto">
                  Understanding your skin type is the first step to a perfect routine
                </p>
              </div>
            </div>

            {/* Skin type tabs */}
            <div className="px-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x">
              {skinTypes.map((type, i) => {
                const TabIcon = type.icon;
                return (
                  <button
                    key={type.name}
                    onClick={() => setActiveType(i)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-body font-medium whitespace-nowrap transition-all duration-200 ${
                      i === activeType
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <TabIcon size={13} />
                    {type.name}
                  </button>
                );
              })}
            </div>

            {/* Active skin type content */}
            <div className="p-6 pt-5">
              <motion.div
                key={activeType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="grid md:grid-cols-2 gap-6"
              >
                {/* Left: image */}
                <div className="space-y-4">
                  <div className={`aspect-[4/3] rounded-2xl overflow-hidden border ${active.border}`}>
                    <img
                      src={active.image}
                      alt={active.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {/* Pro tip */}
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${active.color} border ${active.border}`}>
                    <p className="text-xs font-body font-semibold mb-1 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-primary" /> Pro Tip
                    </p>
                    <p className="text-sm font-body text-foreground/80 leading-relaxed">{active.tip}</p>
                  </div>
                </div>

                {/* Right: info */}
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${active.color} flex items-center justify-center border ${active.border}`}>
                        <Icon size={20} className="text-primary" />
                      </div>
                      <div>
                        <h4 className="font-display text-lg">{active.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-body uppercase tracking-widest">Skin Type</p>
                      </div>
                    </div>
                  </div>

                  {/* Key traits */}
                  <div>
                    <p className="text-xs font-body font-semibold uppercase tracking-widest text-muted-foreground mb-2">Key Characteristics</p>
                    <div className="grid grid-cols-2 gap-2">
                      {active.traits.map((trait) => (
                        <div key={trait} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50 text-xs font-body">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {trait}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended routine */}
                  <div>
                    <p className="text-xs font-body font-semibold uppercase tracking-widest text-muted-foreground mb-2">Recommended Routine</p>
                    <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/30">
                      <p className="text-sm font-body leading-relaxed">{active.routine}</p>
                    </div>
                  </div>

                  <Button size="sm" className="gap-2 rounded-full" asChild>
                    <Link to="/skincare" onClick={onClose}>
                      Shop for {active.name} <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* Educational video */}
            <div className="px-6 pb-4">
              <div className="border-t border-border/30 pt-5">
                <p className="text-xs font-body font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
                  Learn Skincare Basics
                </p>
                <div className="aspect-video rounded-2xl overflow-hidden bg-secondary shadow-inner max-w-2xl mx-auto">
                  <video
                    src="https://videos.pexels.com/video-files/6925816/6925816-hd_1080_1920_25fps.mp4"
                    controls
                    playsInline
                    poster="https://images.pexels.com/videos/6925816/pexels-photo-6925816.jpeg?auto=compress&cs=tinysrgb&w=800"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Quick tips row */}
            <div className="px-6 pb-8 pt-2">
              <p className="text-xs font-body font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Daily Skincare Tips
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {skincareTips.map((tip) => (
                  <div key={tip.text} className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/20">
                    <span className="text-lg">{tip.emoji}</span>
                    <span className="text-xs font-body text-foreground/80">{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const BrandStory: React.FC = () => {
  const [skinModalOpen, setSkinModalOpen] = useState(false);
  const [activeSkincareVideoIndex, setActiveSkincareVideoIndex] = useState(0);
  const [activeSkincareVideoSlot, setActiveSkincareVideoSlot] = useState<0 | 1>(0);
  const [skincareVideoSources, setSkincareVideoSources] = useState<[string, string]>([
    SKINCARE_SECTION_VIDEOS[0],
    '',
  ]);
  const skincareVideoRefs = React.useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const isSkincareVideoSwitchingRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const preloadElements = SKINCARE_SECTION_VIDEOS.map((videoSource) => {
      const preloadElement = document.createElement('video');
      preloadElement.src = videoSource;
      preloadElement.preload = 'auto';
      preloadElement.muted = true;
      preloadElement.playsInline = true;
      preloadElement.load();
      return preloadElement;
    });

    return () => {
      preloadElements.forEach((preloadElement) => {
        preloadElement.pause();
        preloadElement.removeAttribute('src');
        preloadElement.load();
      });
    };
  }, []);

  const switchSkincareVideo = React.useCallback((nextIndex: number) => {
    if (isSkincareVideoSwitchingRef.current) {
      return;
    }

    isSkincareVideoSwitchingRef.current = true;

    const incomingSlot: 0 | 1 = activeSkincareVideoSlot === 0 ? 1 : 0;
    const incomingSource = SKINCARE_SECTION_VIDEOS[nextIndex];
    const incomingVideo = skincareVideoRefs.current[incomingSlot];
    const outgoingVideo = skincareVideoRefs.current[activeSkincareVideoSlot];

    setSkincareVideoSources((previousSources) => {
      const updatedSources = [...previousSources] as [string, string];
      updatedSources[incomingSlot] = incomingSource;
      return updatedSources;
    });

    if (!incomingVideo) {
      setActiveSkincareVideoIndex(nextIndex);
      setActiveSkincareVideoSlot(incomingSlot);
      isSkincareVideoSwitchingRef.current = false;
      return;
    }

    const clearListeners = () => {
      incomingVideo.removeEventListener('canplay', handleCanPlay);
      incomingVideo.removeEventListener('error', handleIncomingError);
    };

    const handleCanPlay = () => {
      clearListeners();

      const playPromise = incomingVideo.play();
      if (playPromise !== undefined) {
        void playPromise.catch(() => undefined);
      }

      setActiveSkincareVideoIndex(nextIndex);
      setActiveSkincareVideoSlot(incomingSlot);

      if (outgoingVideo) {
        outgoingVideo.pause();
        outgoingVideo.currentTime = 0;
      }

      isSkincareVideoSwitchingRef.current = false;
    };

    const handleIncomingError = () => {
      clearListeners();
      isSkincareVideoSwitchingRef.current = false;

      if (nextIndex === activeSkincareVideoIndex) {
        return;
      }

      switchSkincareVideo((nextIndex + 1) % SKINCARE_SECTION_VIDEOS.length);
    };

    incomingVideo.src = incomingSource;
    incomingVideo.preload = 'auto';
    incomingVideo.currentTime = 0;
    incomingVideo.load();
    incomingVideo.addEventListener('canplay', handleCanPlay);
    incomingVideo.addEventListener('error', handleIncomingError);
  }, [activeSkincareVideoIndex, activeSkincareVideoSlot]);

  const handleSkincareVideoEnded = React.useCallback((slot: 0 | 1) => {
    if (slot !== activeSkincareVideoSlot || isSkincareVideoSwitchingRef.current) {
      return;
    }

    const nextIndex = (activeSkincareVideoIndex + 1) % SKINCARE_SECTION_VIDEOS.length;
    switchSkincareVideo(nextIndex);
  }, [activeSkincareVideoIndex, activeSkincareVideoSlot, switchSkincareVideo]);

  const handleSkincareVideoError = React.useCallback((slot: 0 | 1) => {
    if (slot !== activeSkincareVideoSlot || isSkincareVideoSwitchingRef.current) {
      return;
    }

    const nextIndex = (activeSkincareVideoIndex + 1) % SKINCARE_SECTION_VIDEOS.length;
    switchSkincareVideo(nextIndex);
  }, [activeSkincareVideoIndex, activeSkincareVideoSlot, switchSkincareVideo]);

  return (
    <section className="relative py-28 md:py-36 overflow-hidden">
      {/* Full-bleed gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50/80 via-background to-rose-50/60 dark:from-pink-950/20 dark:via-background dark:to-rose-950/10" />

      {/* Animated decorative elements */}
      <motion.div
        className="absolute top-20 right-10 w-72 h-72 bg-primary/8 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-10 left-10 w-96 h-96 bg-primary/6 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl pointer-events-none"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating petals */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/15 pointer-events-none text-2xl"
          style={{ left: `${15 + i * 18}%`, top: `${10 + (i % 3) * 30}%` }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 20, -10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.8,
          }}
        >
          🌸
        </motion.div>
      ))}

      <div className="container mx-auto px-6 relative z-10">
        {/* Header with animated underline */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs uppercase tracking-[0.3em] px-5 py-2 rounded-full mb-6 font-body border border-primary/20"
          >
            <Sparkles size={12} />
            Skincare by Tulip
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="font-display text-display-sm md:text-display-md lg:text-display-lg max-w-3xl mx-auto leading-tight"
          >
            Your Skin Deserves
            <span className="relative inline-block mx-2">
              <span className="relative z-10">the Best</span>
              <motion.span
                className="absolute bottom-1 left-0 right-0 h-3 bg-primary/20 -z-0 rounded-sm"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
                style={{ originX: 0 }}
              />
            </span>
            Care
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mt-4 max-w-lg mx-auto font-body"
          >
            AI-curated routines tailored to your unique skin
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Video side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative"
          >
            {/* Decorative frame behind video */}
            <motion.div
              className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            />

            <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 ring-1 ring-white/20">
              <video
                ref={(element) => {
                  skincareVideoRefs.current[0] = element;
                }}
                src={skincareVideoSources[0] || undefined}
                autoPlay={activeSkincareVideoSlot === 0}
                muted
                playsInline
                preload="auto"
                onEnded={() => handleSkincareVideoEnded(0)}
                onError={() => handleSkincareVideoError(0)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeSkincareVideoSlot === 0 ? 'opacity-100' : 'opacity-0'}`}
              />
              <video
                ref={(element) => {
                  skincareVideoRefs.current[1] = element;
                }}
                src={skincareVideoSources[1] || undefined}
                autoPlay={activeSkincareVideoSlot === 1}
                muted
                playsInline
                preload="auto"
                onEnded={() => handleSkincareVideoEnded(1)}
                onError={() => handleSkincareVideoError(1)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeSkincareVideoSlot === 1 ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>

          </motion.div>

          {/* Content side */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-muted-foreground mb-8 leading-relaxed font-body text-base"
            >
              Discover Tulip's curated skincare collection — from hydrating serums to 
              gentle cleansers, every product is handpicked for quality and effectiveness. 
              Our AI recommends the perfect routine tailored to your skin type.
            </motion.p>

            {/* Highlight cards with hover effects */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-2 gap-3 mb-10"
            >
              {highlights.map(({ icon: Icon, label, desc }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/40 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-default"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold leading-tight">{label}</p>
                    <p className="font-body text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45 }}
              className="flex flex-wrap gap-4"
            >
              <Button size="lg" className="gap-2.5 rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow" asChild>
                <Link to="/skincare">
                  Explore Skincare <ArrowRight size={16} />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-full px-8 hover:bg-primary/5 border-primary/30 text-primary hover:border-primary/50"
                onClick={() => setSkinModalOpen(true)}
              >
                <Sparkles size={15} /> Know Your Skin
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Know Your Skin Modal */}
      <KnowYourSkinModal open={skinModalOpen} onClose={() => setSkinModalOpen(false)} />
    </section>
  );
};

export { MarqueeSection, BrandStory, KnowYourSkinModal };
