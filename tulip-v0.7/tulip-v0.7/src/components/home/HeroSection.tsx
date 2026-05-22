import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const HERO_VIDEO_STORAGE_KEY = 'tulip_hero_video_index';

const HERO_VIDEOS = [
  'https://www.pexels.com/download/video/8738555/',
  'https://www.pexels.com/download/video/8057125/',
  'https://www.pexels.com/download/video/10669632/',
  'https://www.pexels.com/download/video/8738280/',
];

const getInitialHeroVideoIndex = () => {
  if (typeof window === 'undefined') {
    return 0;
  }

  const previousIndexRaw = window.localStorage.getItem(HERO_VIDEO_STORAGE_KEY);
  const previousIndex = previousIndexRaw ? Number(previousIndexRaw) : -1;
  const safePreviousIndex = Number.isFinite(previousIndex) ? previousIndex : -1;

  return (safePreviousIndex + 1) % HERO_VIDEOS.length;
};

const HeroSection: React.FC = () => {
  const [activeVideoIndex, setActiveVideoIndex] = React.useState(getInitialHeroVideoIndex);
  const [activeSlot, setActiveSlot] = React.useState<0 | 1>(0);
  const [videoSources, setVideoSources] = React.useState<[string, string]>(() => {
    const startIndex = getInitialHeroVideoIndex();
    return [HERO_VIDEOS[startIndex], ''];
  });
  const heroVideoRefs = React.useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const isSwitchingRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only preload the next video, not all 4
    const nextIndex = (activeVideoIndex + 1) % HERO_VIDEOS.length;
    const preloadElement = document.createElement('video');
    preloadElement.src = HERO_VIDEOS[nextIndex];
    preloadElement.preload = 'auto';
    preloadElement.muted = true;
    preloadElement.playsInline = true;
    preloadElement.load();

    return () => {
      preloadElement.pause();
      preloadElement.removeAttribute('src');
      preloadElement.load();
    };
  }, [activeVideoIndex]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(HERO_VIDEO_STORAGE_KEY, String(activeVideoIndex));
  }, [activeVideoIndex]);

  const switchToVideo = React.useCallback((nextIndex: number) => {
    if (isSwitchingRef.current) {
      return;
    }

    isSwitchingRef.current = true;

    const incomingSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;
    const incomingSource = HERO_VIDEOS[nextIndex];
    const incomingVideo = heroVideoRefs.current[incomingSlot];
    const outgoingVideo = heroVideoRefs.current[activeSlot];

    setVideoSources((previousSources) => {
      const updatedSources = [...previousSources] as [string, string];
      updatedSources[incomingSlot] = incomingSource;
      return updatedSources;
    });

    if (!incomingVideo) {
      setActiveVideoIndex(nextIndex);
      setActiveSlot(incomingSlot);
      isSwitchingRef.current = false;
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

      setActiveVideoIndex(nextIndex);
      setActiveSlot(incomingSlot);

      if (outgoingVideo) {
        outgoingVideo.pause();
        outgoingVideo.currentTime = 0;
      }

      isSwitchingRef.current = false;
    };

    const handleIncomingError = () => {
      clearListeners();
      isSwitchingRef.current = false;

      if (nextIndex === activeVideoIndex) {
        return;
      }

      switchToVideo((nextIndex + 1) % HERO_VIDEOS.length);
    };

    incomingVideo.src = incomingSource;
    incomingVideo.preload = 'auto';
    incomingVideo.currentTime = 0;
    incomingVideo.load();
    incomingVideo.addEventListener('canplay', handleCanPlay);
    incomingVideo.addEventListener('error', handleIncomingError);
  }, [activeSlot, activeVideoIndex]);

  const handleVideoEnded = React.useCallback((slot: 0 | 1) => {
    if (slot !== activeSlot || isSwitchingRef.current) {
      return;
    }

    const nextIndex = (activeVideoIndex + 1) % HERO_VIDEOS.length;
    switchToVideo(nextIndex);
  }, [activeSlot, activeVideoIndex, switchToVideo]);

  const handleVideoError = React.useCallback((slot: 0 | 1) => {
    if (slot !== activeSlot || isSwitchingRef.current) {
      return;
    }

    const nextIndex = (activeVideoIndex + 1) % HERO_VIDEOS.length;
    switchToVideo(nextIndex);
  }, [activeSlot, activeVideoIndex, switchToVideo]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 right-[10%] w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-blob-pulse"
        />
        <div
          className="absolute bottom-20 left-[10%] w-96 h-96 rounded-full bg-tulip-light/10 blur-3xl animate-blob-pulse-alt"
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-blob-pulse-slow"
        />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-display-xl font-medium mb-6"
            >
              Bloom Your
              <br />
              <span className="text-gradient-tulip">Style</span> with Tulip
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10 font-body"
            >
              Discover personalized fashion recommendations made just for you.
              Elegance redefined through intelligent curation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button variant="pink" size="xl" className="gap-3" asChild>
                <Link to="/shop">Shop Now <ArrowRight size={18} /></Link>
              </Button>
              <Button variant="hero-outline" size="xl" className="gap-3" asChild>
                <Link to="/categories">Browse Collections</Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border"
            >
              {[
                { value: '50K+', label: 'Happy Clients' },
                { value: '200+', label: 'Premium Brands' },
                { value: '99%', label: 'Satisfaction' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="font-display text-2xl md:text-3xl font-medium">{stat.value}</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] max-w-lg mx-auto">
              <div
                className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl animate-float-y"
              >
                <video
                  ref={(element) => {
                    heroVideoRefs.current[0] = element;
                  }}
                  src={videoSources[0] || undefined}
                  autoPlay={activeSlot === 0}
                  muted
                  playsInline
                  preload="auto"
                  onEnded={() => handleVideoEnded(0)}
                  onError={() => handleVideoError(0)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeSlot === 0 ? 'opacity-100' : 'opacity-0'}`}
                />
                <video
                  ref={(element) => {
                    heroVideoRefs.current[1] = element;
                  }}
                  src={videoSources[1] || undefined}
                  autoPlay={activeSlot === 1}
                  muted
                  playsInline
                  preload="auto"
                  onEnded={() => handleVideoEnded(1)}
                  onError={() => handleVideoError(1)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeSlot === 1 ? 'opacity-100' : 'opacity-0'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
              </div>

              {/* Decorative circles */}
              <div
                className="absolute -z-10 -bottom-8 -right-8 w-32 h-32 border border-primary/20 rounded-full animate-spin-slow"
              />
              <div
                className="absolute -z-10 -top-8 -left-8 w-24 h-24 border border-primary/10 rounded-full animate-spin-slow-reverse"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle"
      >
        <div className="w-6 h-10 border-2 border-foreground/30 rounded-full flex justify-center pt-2">
          <div
            className="w-1.5 h-3 bg-primary/60 rounded-full animate-scroll-dot"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
