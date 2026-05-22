import React, { useState } from 'react';
import HeroSection from '@/components/home/HeroSection';
import HorizontalScrollSection from '@/components/home/HorizontalScrollSection';
import ImageGridSection from '@/components/home/ImageGridSection';
import AIRecommendationSection from '@/components/home/AIRecommendationSection';
import TrendingSection from '@/components/home/TrendingSection';
import { MarqueeSection, BrandStory } from '@/components/home/BrandSection';
import DiscountStrip from '@/components/home/DiscountStrip';
import { Switch } from '@/components/ui/switch';
import { Sparkles } from 'lucide-react';

const Index: React.FC = () => {
  const [showExploreCollections, setShowExploreCollections] = useState(false);
  const exploreToggleBackgroundImage = 'https://images.pexels.com/photos/5325586/pexels-photo-5325586.jpeg';

  return (
    <main>
      <HeroSection />
      <MarqueeSection />
      <DiscountStrip />

      <section className="px-6 md:px-12 py-6">
        <div
          className="max-w-7xl mx-auto relative overflow-hidden rounded-2xl border border-border bg-card"
          style={
            exploreToggleBackgroundImage
              ? {
                  backgroundImage: `url(${exploreToggleBackgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
          <div className="relative flex items-center justify-between px-5 py-5 md:px-7 md:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90">
                <Sparkles size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm md:text-base font-semibold">Explore Collections</p>
                <p className="text-xs md:text-sm text-muted-foreground">Turn on to show this section on the home page.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-border bg-background/85 px-3 py-2 backdrop-blur-sm">
              <span className="text-xs font-medium text-muted-foreground">{showExploreCollections ? 'On' : 'Off'}</span>
              <Switch
                checked={showExploreCollections}
                onCheckedChange={setShowExploreCollections}
                aria-label="Toggle Explore Collections section"
              />
            </div>
          </div>
        </div>
      </section>

      {showExploreCollections && <HorizontalScrollSection />}
      <ImageGridSection />
      <AIRecommendationSection />
      <TrendingSection />
      <BrandStory />
    </main>
  );
};

export default Index;
