import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, isLoggedIn, isLoading: authLoading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', gender: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  React.useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) navigate('/profile');
  }, [authLoading, isLoggedIn, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!agreed) {
      toast({ title: 'Please agree to the terms', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp({
        name: form.name,
        email: form.email,
        password: form.password,
        gender: form.gender || undefined,
      });

      if (result.requiresEmailConfirmation) {
        toast({
          title: 'Account created! Verify your email to continue.',
          description: 'Check your inbox for the verification link.',
        });
        navigate('/login');
        return;
      }

      toast({ title: 'Welcome to Tulip! 🌷' });
      navigate('/profile');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create account. Please try again.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80"
          alt="Fashion"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h2 className="font-display text-4xl text-white font-semibold mb-3 drop-shadow-lg">
              Join the Tulip Family
            </h2>
            <p className="font-body text-white/80 text-lg drop-shadow-md">
              Your style journey begins here
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Form */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gradient-blush"
      >
        <div className="w-full max-w-md">
          <div className="bg-background/60 backdrop-blur-2xl border border-border/50 rounded-[20px] p-8 sm:p-10 shadow-medium">
            <div className="text-center mb-8">
              <Link to="/">
                <h1 className="font-display text-3xl font-semibold italic text-foreground mb-2">Tulip</h1>
              </Link>
              <h2 className="font-display text-2xl font-semibold text-foreground">Create Your Tulip Account</h2>
              <p className="font-body text-muted-foreground text-sm mt-1">
                Start your style journey
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name */}
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Full Name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 font-body"
                />
              </div>

              {/* Email */}
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 font-body"
                />
              </div>

              {/* Password */}
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 font-body"
                />
              </div>

              {/* Gender */}
              <select
                value={form.gender}
                onChange={(e) => update('gender', e.target.value)}
                className="w-full h-12 rounded-xl border border-border/60 bg-background/50 px-3 font-body text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              >
                <option value="">Gender (optional)</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>

              {/* Terms */}
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v as boolean)}
                  className="mt-0.5"
                />
                <span className="text-xs font-body text-muted-foreground leading-relaxed">
                  I agree to the{' '}
                  <button type="button" className="text-primary hover:underline">Terms of Service</button>{' '}
                  and{' '}
                  <button type="button" className="text-primary hover:underline">Privacy Policy</button>
                </span>
              </label>

              {/* Create Account */}
              <Button
                type="submit"
                variant="pink"
                size="lg"
                className="w-full h-12 text-base rounded-xl"
                disabled={isSubmitting || authLoading}
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-body text-muted-foreground uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Social */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11 rounded-xl gap-2 font-body text-sm">
                <Chrome className="w-4 h-4" />
                Google
              </Button>
              <Button variant="outline" className="flex-1 h-11 rounded-xl gap-2 font-body text-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.44C5.57 7.91 7.13 6.93 8.82 6.91C10.1 6.89 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.87C16.57 6.9 18.39 7.14 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                </svg>
                Apple
              </Button>
            </div>

            {/* Login Link */}
            <p className="text-center font-body text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
                Login
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
