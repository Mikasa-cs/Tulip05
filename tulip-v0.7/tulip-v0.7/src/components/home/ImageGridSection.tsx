import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { lifestyleImages } from '@/data/products';

const cardLayouts = [
  'sm:col-span-2 lg:col-span-7 lg:row-span-2',
  'lg:col-span-5 lg:row-span-1',
  'lg:col-span-3 lg:row-span-1',
  'lg:col-span-4 lg:row-span-1',
  'lg:col-span-5 lg:row-span-1',
];

const videoLayouts = [
  {
    id: 'video-1',
    title: 'Studio Clip',
    layout: 'lg:col-start-11 lg:col-span-2 lg:row-start-2 lg:row-span-1',
    src: 'https://www.pexels.com/download/video/8798402/',
  },
  {
    id: 'video-2',
    title: 'Style Reel',
    layout: 'lg:col-start-10 lg:col-span-3 lg:row-start-3 lg:row-span-1',
    src: 'https://www.pexels.com/download/video/6764969/',
  },
  {
    id: 'video-3',
    title: 'Bloom Motion',
    layout: 'lg:col-start-8 lg:col-span-5 lg:row-start-4 lg:row-span-2',
    src: 'https://www.pexels.com/download/video/7088588/',
  },
];

const ImageGridSection: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const lifestyleVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const playLifestyleVideo = (id: string) => {
    const videoElement = lifestyleVideoRefs.current[id];
    if (!videoElement) return;

    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      void playPromise.catch(() => undefined);
    }
  };

  const pauseLifestyleVideo = (id: string) => {
    const videoElement = lifestyleVideoRefs.current[id];
    if (!videoElement) return;

    videoElement.pause();
    videoElement.currentTime = 0;
  };

  return (
    <section className="relative overflow-hidden py-24 md:py-32 bg-background">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary mb-5"
          >
            <Sparkles size={14} />
            <span className="text-[11px] uppercase tracking-[0.24em]">Lifestyle Curation</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="font-display text-display-sm md:text-display-md mb-4 leading-tight"
          >
            <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              The Art of Blooming
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-muted-foreground max-w-xl mx-auto"
          >
            Hover to reveal the world in color
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 auto-rows-[220px] md:auto-rows-[250px] gap-4 md:gap-6">
          {lifestyleImages.map((image, index) => (
            <motion.article
              key={image.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30, scale: prefersReducedMotion ? 1 : 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
              whileHover={prefersReducedMotion ? undefined : { y: -8 }}
              onMouseEnter={() => playLifestyleVideo(image.id)}
              onMouseLeave={() => pauseLifestyleVideo(image.id)}
              onFocus={() => playLifestyleVideo(image.id)}
              onBlur={() => pauseLifestyleVideo(image.id)}
              tabIndex={0}
              className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-soft ${cardLayouts[index % cardLayouts.length]}`}
            >
              <motion.video
                ref={(element) => {
                  lifestyleVideoRefs.current[image.id] = element;
                }}
                src={image.src}
                loop
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-out group-hover:grayscale-0"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-500" />

              <div className="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-3">
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.14 + index * 0.05 }}
                >
                  <p className="text-primary-foreground/85 text-[10px] uppercase tracking-[0.22em] mb-1">Lifestyle</p>
                  <h3 className="text-primary-foreground text-sm md:text-base font-medium">{image.alt}</h3>
                </motion.div>

                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { x: 2 }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/25 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary-foreground backdrop-blur-sm"
                >
                  View <ArrowUpRight size={12} />
                </motion.span>
              </div>
            </motion.article>
          ))}

          {videoLayouts.map((video, index) => (
            <motion.article
              key={video.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24, scale: prefersReducedMotion ? 1 : 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: 0.2 + index * 0.08, ease: 'easeOut' }}
              whileHover={prefersReducedMotion ? undefined : { y: -8 }}
              className={`group relative hidden lg:block overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-soft ${video.layout}`}
            >
              <motion.video
                src={video.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/15 to-transparent" />

              <div className="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-primary-foreground/80 text-[10px] uppercase tracking-[0.22em] mb-1">Video</p>
                  <h3 className="text-primary-foreground text-sm md:text-base font-medium">{video.title}</h3>
                </div>

                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { x: 2 }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/25 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary-foreground backdrop-blur-sm"
                >
                  View <ArrowUpRight size={12} />
                </motion.span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImageGridSection;
