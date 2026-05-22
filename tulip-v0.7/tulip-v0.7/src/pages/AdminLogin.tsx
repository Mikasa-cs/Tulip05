import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    try {
      await signIn({ email: normalizedEmail, password, requireAdmin: true });
      toast({ title: 'Admin access granted 🔐' });
      navigate('/admin');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in as admin.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/95 via-foreground/85 to-primary/30" />

      {/* Subtle animated orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/15 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10 w-full max-w-md mx-6"
      >
        <div className="bg-background/10 backdrop-blur-2xl border border-primary/20 rounded-[20px] p-8 sm:p-10 shadow-tulip">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/">
              <h1 className="font-display text-3xl font-semibold italic text-white/90 mb-4">Tulip</h1>
            </Link>

            <motion.div
              animate={{ boxShadow: ['0 0 20px hsl(340 70% 65% / 0.3)', '0 0 40px hsl(340 70% 65% / 0.5)', '0 0 20px hsl(340 70% 65% / 0.3)'] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4"
            >
              <ShieldCheck className="w-8 h-8 text-primary" />
            </motion.div>

            <h2 className="font-display text-2xl font-semibold text-white/90">Admin Access</h2>
            <p className="font-body text-white/40 text-xs mt-2 uppercase tracking-[0.2em]">
              Authorized personnel only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <Input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="pl-10 h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 font-body"
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pl-10 pr-10 h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 font-body"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Login Button */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground hover:opacity-90 shadow-tulip font-body tracking-wide"
                disabled={isSubmitting || authLoading}
              >
                <Lock className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Signing in...' : 'Secure Login'}
              </Button>
            </motion.div>
          </form>

          {/* Back link */}
          <p className="text-center font-body text-sm text-white/30 mt-6">
            <Link to="/" className="hover:text-primary transition-colors">
              ← Back to Tulip
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
