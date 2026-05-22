import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, Calendar, Edit3, LogOut, Heart,
  ShoppingBag, Package, Camera, Check, X, ChevronRight, Sparkles, Info, Crown, Gem, Star,
  Plus, Trash2, Home, Building2, Briefcase, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, SavedAddress } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, isLoggedIn, updateProfile, logout } = useAuth();
  const { wishlist, items: cartItems } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showTierInfo, setShowTierInfo] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({ label: 'Home', address: '', city: '', pincode: '' });
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    address: user?.address || '',
    city: user?.city || '',
    pincode: user?.pincode || '',
  });

  if (!isLoggedIn || !user) {
    navigate('/login');
    return null;
  }

  const handleSave = async () => {
    try {
      await updateProfile(editForm);
      setIsEditing(false);
      toast({ title: 'Profile updated!', description: 'Your changes have been saved.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update profile right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const addressLabels = [
    { value: 'Home', icon: Home },
    { value: 'Work', icon: Briefcase },
    { value: 'Office', icon: Building2 },
    { value: 'Other', icon: Tag },
  ];

  const addresses = user.addresses || [];

  const createAddressId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const resetAddressForm = () => {
    setAddressForm({ label: 'Home', address: '', city: '', pincode: '' });
    setEditingAddressId(null);
    setShowAddressForm(false);
  };

  const handleSaveAddress = async () => {
    if (!addressForm.address || !addressForm.city || !addressForm.pincode) {
      toast({ title: 'Please fill all address fields', variant: 'destructive' });
      return;
    }
    let updated: SavedAddress[];
    if (editingAddressId) {
      updated = addresses.map((a) =>
        a.id === editingAddressId ? { ...a, ...addressForm } : a
      );
    } else {
      const newAddr: SavedAddress = {
        id: createAddressId(),
        ...addressForm,
        isDefault: addresses.length === 0,
      };
      updated = [...addresses, newAddr];
    }
    try {
      await updateProfile({ addresses: updated });
      resetAddressForm();
      toast({ title: editingAddressId ? 'Address updated!' : 'Address added!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save address right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
      updated[0].isDefault = true;
    }
    try {
      await updateProfile({ addresses: updated });
      toast({ title: 'Address removed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove address right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    const updated = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    try {
      await updateProfile({ addresses: updated });
      toast({ title: 'Default address updated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update default address right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Logged out', description: 'See you soon!' });
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const stats = [
    { label: 'Wishlist', value: wishlist.length, icon: Heart, color: 'text-pink-500', href: '/wishlist' },
    { label: 'In Bag', value: cartItems.length, icon: ShoppingBag, color: 'text-amber-500', href: '/checkout' },
    { label: 'Orders', value: 0, icon: Package, color: 'text-blue-500', href: '/order-history' },
  ];

  const quickLinks = [
    { label: 'My Wishlist', desc: 'Items you saved for later', icon: Heart, href: '/wishlist' },
    { label: 'Shopping Room', desc: 'Your personal style builder', icon: Sparkles, href: '/shop' },
    { label: 'Order History', desc: 'Track your past orders', icon: Package, href: '/order-history' },
  ];

  const profileHighlights = [
    { label: 'Member Since', value: user.joinedDate, icon: Calendar },
    { label: 'Membership', value: 'Classic', icon: Star },
  ];

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/12 to-primary/5" />
        <div className="absolute top-0 left-[20%] w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-[10%] w-64 h-64 bg-primary/8 rounded-full blur-3xl" />

        <div className="container mx-auto px-6 py-12 md:py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mx-auto max-w-5xl rounded-3xl border border-border/60 bg-card/85 backdrop-blur-sm p-6 md:p-8 shadow-soft"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-8">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, delay: 0.1 }}
                className="relative group mx-auto lg:mx-0"
              >
                <motion.div
                  animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.06, 1] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-primary/25 blur-xl"
                />
                <motion.div whileHover={{ scale: 1.03 }} className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-tulip p-[3px] shadow-medium">
                  <div className="w-full h-full rounded-full ring-4 ring-background/90 overflow-hidden bg-card flex items-center justify-center">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full bg-gradient-tulip flex items-center justify-center text-white text-4xl md:text-5xl font-display font-bold">
                        {initials}
                      </span>
                    )}
                  </div>
                </motion.div>
                <button className="absolute bottom-2 right-2 p-2 rounded-full bg-background/95 shadow-md border border-border hover:bg-secondary transition-colors">
                  <Camera size={14} className="text-muted-foreground" />
                </button>
              </motion.div>

              {/* Info */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 text-center lg:text-left"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">
                  <Sparkles size={12} /> Tulip Profile
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">{user.name}</h1>
                <p className="text-muted-foreground flex items-center gap-2 justify-center lg:justify-start mb-3">
                  <Mail size={14} /> {user.email}
                </p>
                <div className="flex items-center gap-2 justify-center lg:justify-start text-sm text-muted-foreground">
                  <Calendar size={14} />
                  <span>Member since {user.joinedDate}</span>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex flex-wrap lg:flex-col items-center justify-center gap-3"
              >
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl min-w-[150px]"
                  onClick={() => {
                    setEditForm({
                      name: user.name,
                      phone: user.phone || '',
                      gender: user.gender || '',
                      address: user.address || '',
                      city: user.city || '',
                      pincode: user.pincode || '',
                    });
                    setIsEditing(true);
                  }}
                >
                  <Edit3 size={16} /> Edit Profile
                </Button>
                <Button variant="outline" className="gap-2 rounded-xl min-w-[150px] text-destructive hover:bg-destructive hover:text-white" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </Button>
              </motion.div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profileHighlights.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.07 }}
                  whileHover={{ y: -4 }}
                  className="rounded-xl border border-border/60 bg-background/70 px-3.5 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 text-primary mb-1.5">
                    <item.icon size={13} />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  </div>
                  <p className="text-sm font-semibold truncate">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 mt-10">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4 md:gap-6 mb-10"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <Link
                to={stat.href}
                className="relative overflow-hidden bg-card rounded-2xl p-5 md:p-6 border border-border/50 hover:shadow-soft hover:border-primary/20 transition-all duration-300 text-center group block"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <stat.icon size={24} className={`relative mx-auto mb-3 ${stat.color} group-hover:scale-110 transition-transform`} />
                <p className="relative text-2xl md:text-3xl font-bold mb-1">{stat.value}</p>
                <p className="relative text-xs md:text-sm text-muted-foreground">{stat.label}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-display font-semibold">Personal Information</h2>
                {isEditing && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="gap-1 text-muted-foreground">
                      <X size={14} /> Cancel
                    </Button>
                    <Button size="sm" variant="hero" onClick={handleSave} className="gap-1">
                      <Check size={14} /> Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 block">Full Name</label>
                    {isEditing ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="h-11 rounded-xl"
                      />
                    ) : (
                      <p className="text-sm font-medium flex items-center gap-2"><User size={14} className="text-muted-foreground" /> {user.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 block">Email</label>
                    <p className="text-sm font-medium flex items-center gap-2"><Mail size={14} className="text-muted-foreground" /> {user.email}</p>
                  </div>
                </div>

                {/* Phone & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 block">Phone</label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Enter phone number"
                        className="h-11 rounded-xl"
                      />
                    ) : (
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        {user.phone || <span className="text-muted-foreground italic">Not provided</span>}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 block">Gender</label>
                    {isEditing ? (
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-body focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                      >
                        <option value="">Select gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer-not">Prefer not to say</option>
                      </select>
                    ) : (
                      <p className="text-sm font-medium capitalize">{user.gender || <span className="text-muted-foreground italic">Not provided</span>}</p>
                    )}
                  </div>
                </div>

                {/* Addresses Section */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Saved Addresses</label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 rounded-lg text-xs"
                      onClick={() => { resetAddressForm(); setShowAddressForm(true); }}
                    >
                      <Plus size={13} /> Add Address
                    </Button>
                  </div>

                  {/* Add/Edit Address Form */}
                  <AnimatePresence>
                    {showAddressForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-4"
                      >
                        <div className="bg-secondary/50 rounded-xl p-4 border border-border/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{editingAddressId ? 'Edit Address' : 'New Address'}</p>
                            <button onClick={resetAddressForm} className="p-1 hover:bg-background rounded-full transition-colors">
                              <X size={16} className="text-muted-foreground" />
                            </button>
                          </div>

                          {/* Label Selector */}
                          <div className="flex gap-2 flex-wrap">
                            {addressLabels.map((l) => (
                              <button
                                key={l.value}
                                onClick={() => setAddressForm((f) => ({ ...f, label: l.value }))}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                  addressForm.label === l.value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <l.icon size={13} /> {l.value}
                              </button>
                            ))}
                          </div>

                          <Input
                            value={addressForm.address}
                            onChange={(e) => setAddressForm((f) => ({ ...f, address: e.target.value }))}
                            placeholder="Street address, apartment, floor..."
                            className="h-10 rounded-lg text-sm"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              value={addressForm.city}
                              onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                              placeholder="City"
                              className="h-10 rounded-lg text-sm"
                            />
                            <Input
                              value={addressForm.pincode}
                              onChange={(e) => setAddressForm((f) => ({ ...f, pincode: e.target.value }))}
                              placeholder="PIN Code"
                              className="h-10 rounded-lg text-sm"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="ghost" onClick={resetAddressForm} className="h-8 text-xs">
                              Cancel
                            </Button>
                            <Button size="sm" variant="hero" onClick={handleSaveAddress} className="h-8 text-xs gap-1">
                              <Check size={13} /> {editingAddressId ? 'Update' : 'Save Address'}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Address List */}
                  {addresses.length === 0 && !showAddressForm ? (
                    <div className="text-center py-8 bg-secondary/30 rounded-xl border border-dashed border-border">
                      <MapPin size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No saved addresses yet</p>
                      <p className="text-xs text-muted-foreground/70">Add your first delivery address</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {addresses.map((addr) => {
                          const labelInfo = addressLabels.find((l) => l.value === addr.label) || addressLabels[3];
                          const LabelIcon = labelInfo.icon;
                          return (
                            <motion.div
                              key={addr.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                                addr.isDefault
                                  ? 'border-primary/40 bg-primary/5'
                                  : 'border-border/50 bg-card hover:border-border'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                addr.isDefault ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                              }`}>
                                <LabelIcon size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-semibold">{addr.label}</span>
                                  {addr.isDefault && (
                                    <span className="text-[10px] uppercase tracking-widest bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Default</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {addr.address}, {addr.city} - {addr.pincode}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!addr.isDefault && (
                                  <button
                                    onClick={() => handleSetDefault(addr.id)}
                                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                    title="Set as default"
                                  >
                                    <Check size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setAddressForm({ label: addr.label, address: addr.address, city: addr.city, pincode: addr.pincode });
                                    setEditingAddressId(addr.id);
                                    setShowAddressForm(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAddress(addr.id)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-lg font-display font-semibold">Quick Links</h2>
              </div>
              <div className="divide-y divide-border">
                {quickLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <link.icon size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Member Card */}
            <div className="mt-6 rounded-2xl bg-gradient-tulip p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-widest text-white/70">Tulip Member</p>
                  <button
                    onClick={() => setShowTierInfo(true)}
                    className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                    aria-label="Tier information"
                  >
                    <Info size={14} />
                  </button>
                </div>
                <p className="text-lg font-display font-bold mb-4">{user.name}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/60">Member Since</p>
                    <p className="text-sm font-medium">{user.joinedDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-white/60">Tier</p>
                    <p className="text-sm font-medium flex items-center gap-1 justify-end"><Star size={13} /> Classic</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Info Modal */}
            <AnimatePresence>
              {showTierInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowTierInfo(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-6 py-5 border-b border-border flex items-center justify-between rounded-t-2xl z-10">
                      <div>
                        <h2 className="text-lg font-display font-bold">Tulip Membership Tiers</h2>
                        <p className="text-xs text-muted-foreground">Unlock rewards as you shop more</p>
                      </div>
                      <button
                        onClick={() => setShowTierInfo(false)}
                        className="p-2 rounded-full hover:bg-secondary transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Classic Tier */}
                      <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 relative">
                        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">Your Tier</span>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-11 h-11 rounded-full bg-gradient-tulip flex items-center justify-center">
                            <Star size={20} className="text-white" />
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-base">Classic</h3>
                            <p className="text-xs text-muted-foreground">All new members start here</p>
                          </div>
                        </div>
                        <ul className="space-y-2.5 text-sm">
                          <li className="flex items-start gap-2"><Check size={15} className="text-primary mt-0.5 shrink-0" /> Free shipping on orders above ₹500</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-primary mt-0.5 shrink-0" /> 7-day easy returns on all products</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-primary mt-0.5 shrink-0" /> Access to seasonal sale previews</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-primary mt-0.5 shrink-0" /> Birthday discount coupon (5% off)</li>
                        </ul>
                      </div>

                      {/* Gold Tier */}
                      <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                            <Crown size={20} className="text-white" />
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-base">Gold</h3>
                            <p className="text-xs text-muted-foreground">Spend ₹10,000+ to unlock</p>
                          </div>
                        </div>
                        <ul className="space-y-2.5 text-sm">
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> All Classic benefits included</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> Free shipping on all orders (no minimum)</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> 10% birthday discount coupon</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> Early access to new arrivals (24 hrs)</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> Priority customer support</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-amber-500 mt-0.5 shrink-0" /> Exclusive Gold-only flash sales</li>
                        </ul>
                      </div>

                      {/* Platinum Tier */}
                      <div className="rounded-xl border border-violet-300/50 bg-violet-50/50 dark:bg-violet-950/20 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                            <Gem size={20} className="text-white" />
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-base">Platinum</h3>
                            <p className="text-xs text-muted-foreground">Spend ₹50,000+ to unlock</p>
                          </div>
                        </div>
                        <ul className="space-y-2.5 text-sm">
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> All Gold benefits included</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> 15% birthday discount coupon</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> Free express delivery on every order</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> 48-hr early access to all new collections</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> Dedicated personal stylist consultation</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> Exclusive Platinum-only collections</li>
                          <li className="flex items-start gap-2"><Check size={15} className="text-violet-500 mt-0.5 shrink-0" /> VIP invites to Tulip events & launches</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
};

export default Profile;
