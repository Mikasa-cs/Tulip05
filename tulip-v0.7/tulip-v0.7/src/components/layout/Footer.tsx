import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, Youtube, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const footerLinks = {
  shop: [
    { name: 'Women', href: '/category/women' },
    { name: 'Men', href: '/category/men' },
    { name: 'Kids', href: '/category/kids' },
    { name: 'Accessories', href: '/category/accessories' },
    { name: 'Beauty', href: '/category/beauty' },
  ],
  help: [
    { name: 'Contact Us', href: '/contact' },
    { name: 'FAQs', href: '/faqs' },
    { name: 'Shipping', href: '/shipping' },
    { name: 'Returns', href: '/returns' },
    { name: 'Size Guide', href: '/size-guide' },
  ],
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Careers', href: '/careers' },
    { name: 'Sustainability', href: '/sustainability' },
    { name: 'Press', href: '/press' },
  ],
};

const Footer: React.FC = () => {
  return (
    <footer className="bg-foreground text-background dark:bg-card dark:text-foreground">
      {/* Newsletter */}
      <div className="border-b border-background/10 dark:border-border/70">
        <div className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="font-display text-3xl md:text-4xl mb-4"
              >
                Join the Tulip Garden
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-background/70 dark:text-muted-foreground"
              >
                Be the first to bloom with new collections, exclusive offers, and style inspiration.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" size={18} />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full bg-background text-foreground py-4 pl-12 pr-4 rounded-full placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <Button variant="pink" size="lg" className="gap-2">
                  Subscribe <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <img
                src="/Tulip%20n%20icon.png"
                alt="Tulip logo"
                className="h-11 w-11 rounded-xl border border-background/20 dark:border-border/70 bg-background/10 dark:bg-background/60 object-cover p-1"
              />
              <h2 className="font-display text-3xl italic">Tulip</h2>
            </Link>
            <p className="text-background/70 dark:text-muted-foreground mb-6 max-w-sm">
              Bloom your style with personalized fashion recommendations. 
              Where elegance meets modern simplicity.
            </p>
            <div className="flex gap-4">
              {[Instagram, Twitter, Facebook, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 border border-background/20 dark:border-border rounded-full flex items-center justify-center hover:bg-background hover:text-foreground dark:hover:bg-secondary transition-colors"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest mb-4">Shop</h4>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-background/70 dark:text-muted-foreground hover:text-background dark:hover:text-foreground transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest mb-4">Help</h4>
            <ul className="space-y-3">
              {footerLinks.help.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-background/70 dark:text-muted-foreground hover:text-background dark:hover:text-foreground transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="text-background/70 dark:text-muted-foreground hover:text-background dark:hover:text-foreground transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 dark:border-border/70 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/50 dark:text-muted-foreground text-sm">© 2026 Tulip. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-background/50 dark:text-muted-foreground">
            <Link to="/privacy" className="hover:text-background dark:hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-background dark:hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
