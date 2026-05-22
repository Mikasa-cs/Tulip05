import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { collection, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

type PendingCheckoutPayload = {
  userId: string;
  shippingName: string;
  shippingEmail: string;
  shippingPhone?: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingPincode: string;
  notes?: string | null;
  cartItems: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    selectedSize?: string;
    selectedColor?: string;
  }>;
  totalAmount: number;
  currency: string;
  createdAt: number;
};

const CheckoutSuccess: React.FC = () => {
  const { user } = useAuth();
  const { clearCart, items } = useCart();
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => searchParams.get('session_id')?.trim() || '', [searchParams]);
  const hasClearedCartRef = useRef(false);
  const latestItemsRef = useRef(items);

  useEffect(() => {
    latestItemsRef.current = items;
  }, [items]);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState('Finalizing your order details...');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Session ID is missing from the success URL.');
      return;
    }

    if (!user?.id) {
      setStatus('error');
      setMessage('Your account session is not available. Please sign in and check Order History.');
      return;
    }

    setStatus('loading');
    setMessage('Finalizing your order details...');

    let active = true;

    const confirmPayment = async () => {
      try {
        const firestore = getFirestore();
        const orderRef = doc(firestore, 'orders', sessionId);
        const existingOrder = await getDoc(orderRef);

        if (!existingOrder.exists()) {
          const pendingKey = `tulip_checkout_payload_${sessionId}`;
          const pendingRaw = sessionStorage.getItem(pendingKey);
          let pendingPayload: PendingCheckoutPayload | null = null;

          if (pendingRaw) {
            try {
              pendingPayload = JSON.parse(pendingRaw) as PendingCheckoutPayload;
            } catch {
              pendingPayload = null;
            }
          }

          const fallbackItems = latestItemsRef.current.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            selectedSize: item.selectedSize || '',
            selectedColor: item.selectedColor || '',
          }));

          const orderItems = pendingPayload?.cartItems?.length ? pendingPayload.cartItems : fallbackItems;

          if (orderItems.length === 0) {
            throw new Error('Order details are unavailable for this payment. Please contact support with your payment reference.');
          }

          const nowIso = new Date().toISOString();
          const currency = pendingPayload?.currency || 'INR';
          const totalAmount = Number(
            pendingPayload?.totalAmount ??
              orderItems.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 1), 0),
          );

          const shippingName = pendingPayload?.shippingName || user.name || 'Customer';
          const shippingEmail = pendingPayload?.shippingEmail || user.email || '';
          const shippingPhone = pendingPayload?.shippingPhone || user.phone || null;
          const shippingAddress = pendingPayload?.shippingAddress || user.address || '';
          const shippingCity = pendingPayload?.shippingCity || user.city || '';
          const shippingPincode = pendingPayload?.shippingPincode || user.pincode || '';
          const fallbackNotes = orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ');

          await setDoc(
            orderRef,
            {
              id: sessionId,
              user_id: user.id,
              userId: user.id,
              status: 'processing',
              total_amount: totalAmount,
              totalAmount,
              currency,
              shipping_name: shippingName,
              shippingName,
              shipping_email: shippingEmail,
              shippingEmail,
              shipping_phone: shippingPhone,
              shippingPhone,
              shipping_address: shippingAddress,
              shippingAddress,
              shipping_city: shippingCity,
              shippingCity,
              shipping_pincode: shippingPincode,
              shippingPincode,
              notes: pendingPayload?.notes || (fallbackNotes ? `items: ${fallbackNotes}` : null),
              payment_gateway: 'stripe',
              paymentGateway: 'stripe',
              payment_status: 'paid',
              paymentStatus: 'paid',
              stripe_checkout_session_id: sessionId,
              stripeCheckoutSessionId: sessionId,
              stripe_payment_intent_id: null,
              stripePaymentIntentId: null,
              paid_at: nowIso,
              paidAt: nowIso,
              payment_currency: currency,
              paymentCurrency: currency,
              created_at: nowIso,
              createdAt: nowIso,
              updated_at: nowIso,
              updatedAt: nowIso,
            },
            { merge: true },
          );

          for (let index = 0; index < orderItems.length; index += 1) {
            const item = orderItems[index];
            const productId = String(item.id || `item-${index}`);
            const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, '-');
            const orderItemRef = doc(collection(firestore, 'orderItems'), `${sessionId}_${index}_${safeProductId}`);

            await setDoc(
              orderItemRef,
              {
                id: orderItemRef.id,
                order_id: sessionId,
                orderId: sessionId,
                product_id: productId,
                productId,
                product_name: String(item.name || 'Item'),
                productName: String(item.name || 'Item'),
                unit_price: Number(item.price || 0),
                unitPrice: Number(item.price || 0),
                quantity: Number(item.quantity || 1),
                selected_size: String(item.selectedSize || ''),
                selectedSize: String(item.selectedSize || ''),
                selected_color: String(item.selectedColor || ''),
                selectedColor: String(item.selectedColor || ''),
                created_at: nowIso,
                createdAt: nowIso,
              },
              { merge: true },
            );
          }

          sessionStorage.removeItem(pendingKey);
        }

        if (active) {
          setOrderId(sessionId);
          setStatus('confirmed');
          setMessage('Your payment has been successfully processed!');

          // Clear cart
          if (!hasClearedCartRef.current) {
            clearCart();
            hasClearedCartRef.current = true;
          }
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          const errorMessage = error instanceof Error ? error.message : 'Unable to confirm your payment. Please check Order History.';
          setMessage(errorMessage);
        }
      }
    };

    void confirmPayment();

    return () => {
      active = false;
    };
  }, [clearCart, sessionId, user?.id]);

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-3">
              {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <CardTitle className="text-2xl">
              {status === 'loading' && 'Verifying Payment'}
              {status === 'confirmed' && 'Payment Successful'}
              {status === 'pending' && 'Payment Received'}
              {status === 'error' && 'Unable to Verify Payment'}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {orderId && (
              <div className="rounded-lg border border-border p-4 bg-secondary/30">
                <p className="text-sm text-muted-foreground">Order ID</p>
                <p className="text-sm font-medium break-all">{orderId}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="pink" size="lg" asChild>
                <Link to="/order-history">Order History</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/track-order">Track Orders</Link>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <Link to="/">Continue Shopping</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CheckoutSuccess;
