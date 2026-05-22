import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isLoggedIn, isLoading: authLoading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getSafeCustomerRedirectPath = () => {
    const state = location.state as { from?: unknown } | null;
    const fromPath = typeof state?.from === 'string' ? state.from.trim() : '';

    if (fromPath.startsWith('/')) {
      return fromPath;
    }

    return '/profile';
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) {
      navigate(user?.role === 'admin' ? '/admin' : getSafeCustomerRedirectPath(), { replace: true });
    }
  }, [authLoading, isLoggedIn, location.state, navigate, user?.role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn({ email, password, requireAdmin: isAdminLogin });
      toast({ title: isAdminLogin ? 'Welcome back, Admin! 👑' : 'Welcome back to Tulip! 🌷' });
      navigate(isAdminLogin ? '/admin' : getSafeCustomerRedirectPath(), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
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
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80"
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
              Welcome Back to Tulip
            </h2>
            <p className="font-body text-white/80 text-lg drop-shadow-md">
              Bloom your style again
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
          {/* Glass Card */}
          <div className="bg-background/60 backdrop-blur-2xl border border-border/50 rounded-[20px] p-8 sm:p-10 shadow-medium">
            <div className="text-center mb-8">
              <Link to="/">
                <h1 className="font-display text-3xl font-semibold italic text-foreground mb-2">Tulip</h1>
              </Link>
              
              {/* Login Type Toggle */}
              <div className="flex gap-2 mb-6 bg-background/40 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setIsAdminLogin(false)}
                  className={`flex-1 py-2 px-3 rounded-md font-body text-sm font-medium transition-all ${
                    !isAdminLogin
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  User Login
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdminLogin(true)}
                  className={`flex-1 py-2 px-3 rounded-md font-body text-sm font-medium transition-all ${
                    isAdminLogin
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Admin Login
                </button>
              </div>
              
              <h2 className="font-display text-2xl font-semibold text-foreground">{isAdminLogin ? 'Admin' : 'User'} Login</h2>
              <p className="font-body text-muted-foreground text-sm mt-1">
                {isAdminLogin ? 'Sign in to admin panel' : 'Sign in to your account'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 transition-all font-body"
                />
              </div>

              {/* Password */}
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl border-border/60 bg-background/50 focus:border-primary focus:ring-primary/20 transition-all font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v as boolean)}
                  />
                  <span className="text-sm font-body text-muted-foreground">Remember me</span>
                </label>
                <button type="button" className="text-sm font-body text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </button>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                variant="pink"
                size="lg"
                className="w-full h-12 text-base rounded-xl"
                disabled={isSubmitting || authLoading}
              >
                {isSubmitting ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-body text-muted-foreground uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Social Buttons */}
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

            {/* Sign Up Link */}
            <p className="text-center font-body text-sm text-muted-foreground mt-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary font-medium hover:text-primary/80 transition-colors">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
