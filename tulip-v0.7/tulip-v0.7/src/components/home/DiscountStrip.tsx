import React from 'react';
import { motion } from 'framer-motion';
import { Tag, Percent, Sparkles, Zap, Gift, Star } from 'lucide-react';

const deals = [
  { icon: <Percent size={14} />, text: 'UP TO 50% OFF', highlight: 'Apparel' },
  { icon: <Zap size={14} />, text: 'FLASH SALE', highlight: 'Today Only' },
  { icon: <Gift size={14} />, text: 'BUY 2 GET 1 FREE', highlight: 'Accessories' },
  { icon: <Tag size={14} />, text: 'EXTRA 20% OFF', highlight: 'Orders ₹2,000+' },
  { icon: <Sparkles size={14} />, text: 'NEW ARRIVALS', highlight: '30% Discount' },
  { icon: <Star size={14} />, text: 'FREE SHIPPING', highlight: 'On All Orders' },
  { icon: <Percent size={14} />, text: 'CLEARANCE SALE', highlight: 'Up to 70% Off' },
  { icon: <Zap size={14} />, text: 'LIMITED TIME', highlight: 'Exclusive Deals' },
];

const DealItem: React.FC<{ icon: React.ReactNode; text: string; highlight: string }> = ({ icon, text, highlight }) => (
  <span className="inline-flex shrink-0 items-center gap-2 mx-10 font-body text-sm whitespace-nowrap">
    <motion.span
      className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {icon}
    </motion.span>
    <span className="font-semibold tracking-wider">{text}</span>
    <span className="text-white/70 font-normal">—</span>
    <motion.span
      className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold tracking-wide"
      animate={{ opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      {highlight}
    </motion.span>
    <span className="ml-6 text-white/30">✦</span>
  </span>
);

const DiscountStrip: React.FC = () => {
  const allDeals = [...deals, ...deals];

  return (
    <section className="relative py-3 overflow-hidden bg-gradient-to-r from-primary via-[hsl(var(--tulip-mid,340_80%_52%))] to-primary text-white">
      {/* Subtle shimmer overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
      />

      {/* Marquee track */}
      <div className="animate-marquee-fast flex w-max min-w-max items-center whitespace-nowrap transform-gpu will-change-transform">
        {allDeals.map((deal, i) => (
          <DealItem key={i} icon={deal.icon} text={deal.text} highlight={deal.highlight} />
        ))}
      </div>
    </section>
  );
};

export default DiscountStrip;
