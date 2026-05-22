import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Bell, Globe, Moon, Sun, Shield, Eye, Smartphone,
  Mail, CreditCard, Trash2, ChevronRight, LogOut, User, Lock,
  Volume2, VolumeX, Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  applyThemePreference,
  clearThemePreference,
  persistThemePreference,
  readThemePreference,
  type ThemePreference,
} from '@/lib/theme';

interface SettingToggle {
  key: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  defaultValue: boolean;
}

const SETTINGS_STORAGE_KEY = 'tulip_settings';

const readStoredSettings = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, boolean>>((acc, [key, value]) => {
      if (typeof value === 'boolean') {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const notificationSettings: SettingToggle[] = [
  { key: 'push_notifications', label: 'Push Notifications', desc: 'Get notified about orders, offers & updates', icon: Bell, defaultValue: true },
  { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive order updates and promotional emails', icon: Mail, defaultValue: true },
  { key: 'sms_notifications', label: 'SMS Notifications', desc: 'Get text messages for order status', icon: Smartphone, defaultValue: false },
  { key: 'sound', label: 'Sound Effects', desc: 'Play sounds for notifications and actions', icon: Volume2, defaultValue: true },
];

const privacySettings: SettingToggle[] = [
  { key: 'profile_visible', label: 'Profile Visibility', desc: 'Make your profile visible to other users', icon: Eye, defaultValue: false },
  { key: 'activity_tracking', label: 'Activity Tracking', desc: 'Help us improve by sharing usage data', icon: Shield, defaultValue: true },
  { key: 'personalized_ads', label: 'Personalized Recommendations', desc: 'See products based on your browsing history', icon: Globe, defaultValue: true },
];

const themeOptions = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

const SettingsPage: React.FC = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Record<string, boolean>>(() => readStoredSettings());
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleteActionPending, setIsDeleteActionPending] = useState(false);

  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    persistThemePreference(theme);
    applyThemePreference(theme);
  }, [theme]);

  const toggle = (key: string, defaultVal: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultVal) }));
    toast({ title: 'Preference updated' });
  };

  const getVal = (key: string, defaultVal: boolean) => settings[key] ?? defaultVal;

  const allToggleSettings = useMemo(
    () => [...notificationSettings, ...privacySettings],
    [],
  );

  const enabledToggleCount = useMemo(
    () => allToggleSettings.filter((item) => getVal(item.key, item.defaultValue)).length,
    [allToggleSettings, settings],
  );

  const handleClearData = () => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    clearThemePreference();
    setSettings({});
    setTheme('system');
    applyThemePreference('system');
    toast({ title: 'Settings reset', description: 'All preferences restored to defaults.' });
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      toast({ title: 'Logged out' });
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleteActionPending) return;

    const shouldContinue = window.confirm(
      'Account deletion is not fully available yet. You will be signed out for now. Continue?',
    );

    if (!shouldContinue) {
      return;
    }

    setIsDeleteActionPending(true);
    try {
      await logout();
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      clearThemePreference();
      applyThemePreference('system');
      toast({
        title: 'Signed out',
        description: 'Account deletion endpoint will be added in the backend phase.',
      });
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsDeleteActionPending(false);
    }
  };

  const accountLinks = [
    { label: 'Edit Profile', desc: 'Update name, phone, gender & more', icon: User, href: '/profile' },
    { label: 'Change Password', desc: 'Use forgot-password flow from sign-in', icon: Lock, href: '/login' },
    { label: 'Payment & Checkout', desc: 'Review payment flow and shipping details', icon: CreditCard, href: '/checkout' },
  ];

  const renderSettingRow = (item: SettingToggle) => {
    const isEnabled = getVal(item.key, item.defaultValue);
    const Icon = item.key === 'sound' && !isEnabled ? VolumeX : item.icon;

    return (
      <div key={item.key} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            <Icon size={16} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-medium ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
            {isEnabled ? 'On' : 'Off'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={`Toggle ${item.label}`}
            onClick={() => toggle(item.key, item.defaultValue)}
            className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
              isEnabled ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform duration-300 ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      {/* Header */}
      <div className="relative overflow-hidden mb-10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/8 to-primary/5" />
        <div className="absolute top-4 left-[15%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-[20%] w-48 h-48 bg-primary/8 rounded-full blur-3xl" />

        <div className="container mx-auto px-6 py-12 md:py-14 relative">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-tulip mb-4 shadow-lg"
            >
              <Settings size={26} className="text-white" />
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              <span className="text-gradient-tulip">Settings</span>
            </h1>
            <p className="text-muted-foreground">
              {user ? `Customize your Tulip experience, ${user.name.split(' ')[0]}.` : 'Customize your Tulip experience'}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-3xl space-y-8">

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Theme</p>
            <p className="mt-1.5 text-sm font-semibold capitalize">{theme}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Enabled Preferences</p>
            <p className="mt-1.5 text-sm font-semibold">{enabledToggleCount}/{allToggleSettings.length}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Sync</p>
            <p className="mt-1.5 text-sm font-semibold">Auto-saved</p>
          </div>
        </section>

        {/* Appearance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-base font-display font-semibold flex items-center gap-2">
                <Sun size={18} className="text-primary" /> Appearance
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-4">Choose your preferred theme</p>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); toast({ title: `Theme: ${opt.label}` }); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <opt.icon size={22} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-base font-display font-semibold flex items-center gap-2">
                <Bell size={18} className="text-primary" /> Notifications
              </h2>
            </div>
            <div className="divide-y divide-border">{notificationSettings.map(renderSettingRow)}</div>
          </div>
        </motion.section>

        {/* Privacy */}
        <motion.section
          id="security"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-base font-display font-semibold flex items-center gap-2">
                <Shield size={18} className="text-primary" /> Privacy
              </h2>
            </div>
            <div className="divide-y divide-border">{privacySettings.map(renderSettingRow)}</div>
          </div>
        </motion.section>

        {/* Account */}
        <motion.section
          id="payments"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-base font-display font-semibold flex items-center gap-2">
                <User size={18} className="text-primary" /> Account
              </h2>
            </div>
            <div className="divide-y divide-border">
              {accountLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <item.icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <div className="bg-card rounded-2xl border border-destructive/20 overflow-hidden">
            <div className="px-6 py-5 border-b border-destructive/20">
              <h2 className="text-base font-display font-semibold text-destructive flex items-center gap-2">
                <Trash2 size={18} /> Danger Zone
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset All Settings</p>
                  <p className="text-xs text-muted-foreground">Restore all preferences to defaults</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={handleClearData}>
                  Reset
                </Button>
              </div>

              {isLoggedIn && (
                <>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Log Out</p>
                      <p className="text-xs text-muted-foreground">Sign out of your account</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs gap-1.5"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut || isDeleteActionPending}
                    >
                      <LogOut size={13} /> {isLoggingOut ? 'Logging out...' : 'Log Out'}
                    </Button>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-destructive">Delete Account</p>
                      <p className="text-xs text-muted-foreground">Permanently remove your account and data</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-lg text-xs gap-1.5"
                      onClick={() => void handleDeleteAccount()}
                      disabled={isDeleteActionPending || isLoggingOut}
                    >
                      <Trash2 size={13} /> {isDeleteActionPending ? 'Please wait...' : 'Delete'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.section>

      </div>
    </main>
  );
};

export default SettingsPage;
