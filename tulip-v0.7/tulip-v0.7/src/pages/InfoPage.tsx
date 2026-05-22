import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const contentByPath: Record<string, { title: string; description: string }> = {
  '/contact': {
    title: 'Contact Us',
    description: 'Reach our support team and we will help you with orders, returns, and account assistance.',
  },
  '/faqs': {
    title: 'Frequently Asked Questions',
    description: 'Find quick answers for shopping, shipping, returns, and payment related questions.',
  },
  '/shipping': {
    title: 'Shipping Information',
    description: 'Shipping timelines and delivery updates are available here for all active and upcoming orders.',
  },
  '/returns': {
    title: 'Returns & Refunds',
    description: 'Review return eligibility and refund timelines before creating a return request.',
  },
  '/size-guide': {
    title: 'Size Guide',
    description: 'Use this guide to choose the best fit across apparel, footwear, and accessories.',
  },
  '/about': {
    title: 'About Tulip',
    description: 'Learn more about the brand vision and how Tulip curates modern fashion collections.',
  },
  '/careers': {
    title: 'Careers',
    description: 'Explore opportunities to join the Tulip team across product, design, and operations.',
  },
  '/sustainability': {
    title: 'Sustainability',
    description: 'Read about our sustainability initiatives and responsible sourcing practices.',
  },
  '/press': {
    title: 'Press',
    description: 'Brand assets and media resources are available here for editorial use.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'Review how we collect, use, and protect your personal information.',
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'Understand platform usage terms, order rules, and service conditions.',
  },
};

const InfoPage: React.FC = () => {
  const { pathname } = useLocation();
  const pageContent = contentByPath[pathname] || {
    title: 'Information',
    description: 'The requested information page is not available right now.',
  };

  return (
    <main className="min-h-screen bg-background pt-28 pb-16">
      <section className="container mx-auto px-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Tulip</p>
        <h1 className="font-display text-4xl md:text-5xl mb-4">{pageContent.title}</h1>
        <p className="text-muted-foreground text-base md:text-lg mb-8">{pageContent.description}</p>
        <Link
          to="/"
          className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          Back to Home
        </Link>
      </section>
    </main>
  );
};

export default InfoPage;
