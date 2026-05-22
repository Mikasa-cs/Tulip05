import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

interface CheckoutFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  notes: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

type CreateStripeCheckoutSessionResponse = {
  url?: string;
  sessionId?: string;
};

const Checkout: React.FC = () => {
  const { user } = useAuth();
  const { items, cartTotal } = useCart();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutFormState>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    notes: '',
  });

  const defaultAddress = useMemo(() => {
    if (!user?.addresses || user.addresses.length === 0) return null;
    return user.addresses.find((item) => item.isDefault) || user.addresses[0];
  }, [user?.addresses]);

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: defaultAddress?.address || user.address || '',
      city: defaultAddress?.city || user.city || '',
      pincode: defaultAddress?.pincode || user.pincode || '',
    }));
  }, [
    defaultAddress?.address,
    defaultAddress?.city,
    defaultAddress?.pincode,
    user,
  ]);

  const handleInputChange = (field: keyof CheckoutFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Please enter your full name.';
    if (!form.email.trim()) return 'Please enter your email address.';
    if (!form.address.trim()) return 'Please enter your shipping address.';
    if (!form.city.trim()) return 'Please enter your city.';
    if (!form.pincode.trim()) return 'Please enter your pincode.';
    return null;
  };

  const buildStripeCheckoutPayload = () => ({
    shippingName: form.name.trim(),
    shippingEmail: form.email.trim().toLowerCase(),
    shippingPhone: form.phone.trim() || null,
    shippingAddress: form.address.trim(),
    shippingCity: form.city.trim(),
    shippingPincode: form.pincode.trim(),
    notes: form.notes.trim() || null,
    cartItems: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      selectedSize: item.selectedSize || '',
      selectedColor: item.selectedColor || '',
    })),
    totalAmount: cartTotal,
    currency: 'INR',
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`,
  });

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();

    if (items.length === 0) {
      toast({ title: 'Your cart is empty', description: 'Add items before placing an order.', variant: 'destructive' });
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast({ title: validationError, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('Your login session expired. Please log in again.');
      }

      const checkoutPayload = buildStripeCheckoutPayload();

      // Call checkout API via same-origin path (proxied in dev)
      const configuredCheckoutServerUrl = (import.meta.env.VITE_CHECKOUT_SERVER_URL as string | undefined)?.trim();
      const checkoutEndpoint = configuredCheckoutServerUrl
        ? `${configuredCheckoutServerUrl.replace(/\/$/, '')}/api/create-stripe-checkout`
        : '/api/create-stripe-checkout';

      const response = await fetch(checkoutEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      const checkoutUrl = data?.url?.trim();
      const sessionId = String(data?.sessionId || '').trim();

      if (sessionId) {
        sessionStorage.setItem(
          `tulip_checkout_payload_${sessionId}`,
          JSON.stringify({
            ...checkoutPayload,
            userId: user?.id || currentUser.uid,
            createdAt: Date.now(),
          }),
        );
      }

      if (!checkoutUrl) {
        throw new Error('Stripe checkout URL was not returned. Please retry.');
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to place order right now.';
      const message = /unauthorized|authorization|jwt|login session expired|http 401/i.test(rawMessage)
        ? 'Your login session expired. Please log in again and retry checkout.'
        : rawMessage.includes('CORS')
        ? 'Payment service is unreachable. Please try again in a moment.'
        : rawMessage;
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl">Your cart is empty</CardTitle>
              <CardDescription>Add products to your cart before placing an order.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="pink" asChild>
                <Link to="/categories">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4 px-0">
            <Link to="/" className="inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Continue shopping
            </Link>
          </Button>
          <h1 className="text-3xl font-display font-semibold">Checkout</h1>
          <p className="text-muted-foreground mt-1">Complete your shipping details to continue to secure Stripe payment.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl">Shipping Information</CardTitle>
              <CardDescription>We will use these details to create and deliver your order.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(event) => handleInputChange('name', event.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => handleInputChange('email', event.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => handleInputChange('phone', event.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(event) => handleInputChange('address', event.target.value)}
                    placeholder="House no, street, area"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => handleInputChange('city', event.target.value)}
                      placeholder="Enter your city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={form.pincode}
                      onChange={(event) => handleInputChange('pincode', event.target.value)}
                      placeholder="Enter your pincode"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(event) => handleInputChange('notes', event.target.value)}
                    placeholder="Any delivery instruction?"
                  />
                </div>

                <Button type="submit" variant="pink" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Redirecting to Stripe...' : 'Proceed to Secure Payment'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-xl">Order Summary</CardTitle>
              <CardDescription>{items.length} items in your cart</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={`${item.id}-${item.selectedSize || ''}-${item.selectedColor || ''}`} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity}
                        {item.selectedSize ? ` · Size ${item.selectedSize}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-base pt-1">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Checkout;
