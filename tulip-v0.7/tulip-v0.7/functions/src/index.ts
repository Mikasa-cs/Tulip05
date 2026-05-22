import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const DOMAIN = process.env.DOMAIN || 'https://tulip-ecommerce.com';

// Type definitions
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

interface CheckoutPayload {
  shippingName: string;
  shippingEmail: string;
  shippingPhone?: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingPincode: string;
  notes?: string | null;
  cartItems: CartItem[];
  totalAmount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

interface CheckoutSession {
  status: 'pending' | 'completed' | 'failed' | 'expired';
  stripeCheckoutSessionId: string;
  stripeCustomerId?: string;
  orderId?: string;
  failureReason?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Create Stripe Checkout Session
 * POST /api/create-stripe-checkout-session
 */
export const createStripeCheckoutSession = functions.https.onCall(
  async (data: CheckoutPayload, context) => {
    // Verify authentication
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    try {
      // Validate request data
      if (!data.cartItems || data.cartItems.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Cart is empty');
      }

      if (!data.shippingEmail || !data.shippingName || !data.shippingAddress) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required shipping information');
      }

      // Get or create Stripe customer
      let customerId: string;
      const existingCustomer = await stripe.customers.list({
        email: data.shippingEmail,
        limit: 1,
      });

      if (existingCustomer.data.length > 0) {
        customerId = existingCustomer.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: data.shippingEmail,
          name: data.shippingName,
          phone: data.shippingPhone || undefined,
          address: {
            line1: data.shippingAddress,
            city: data.shippingCity,
            postal_code: data.shippingPincode,
            country: 'IN',
          },
        });
        customerId = customer.id;
      }

      // Prepare line items for Stripe
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = data.cartItems.map((item) => ({
        price_data: {
          currency: data.currency.toLowerCase(),
          product_data: {
            name: item.name,
            metadata: {
              productId: item.id,
              selectedSize: item.selectedSize || '',
              selectedColor: item.selectedColor || '',
            },
          },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      // Create Stripe checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: data.cancelUrl,
        customer_email: data.shippingEmail,
        metadata: {
          userId,
          shippingPhone: data.shippingPhone || '',
          notes: data.notes || '',
        },
      });

      // Store checkout session in Firestore for order tracking
      const checkoutSessionDoc: CheckoutSession = {
        status: 'pending',
        stripeCheckoutSessionId: checkoutSession.id,
        stripeCustomerId: customerId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires in 24 hours
      };

      await db.collection('checkoutSessions').add({
        userId,
        ...checkoutSessionDoc,
      });

      return {
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
    }
  }
);

/**
 * Handle Stripe Webhook Events
 * POST /api/stripe-webhook
 */
const corsHandler = cors({ origin: true });

export const stripeWebhook = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody || Buffer.from(JSON.stringify(req.body)),
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;
        }

        case 'checkout.session.expired': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionExpired(session);
          break;
        }

        case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
  });
});

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  try {
    // Find and update checkout session
    const checkoutSessionDocs = await db
      .collection('checkoutSessions')
      .where('userId', '==', userId)
      .where('stripeCheckoutSessionId', '==', session.id)
      .get();

    if (checkoutSessionDocs.empty) {
      console.error('Checkout session not found:', session.id);
      return;
    }

    const checkoutSessionRef = checkoutSessionDocs.docs[0].ref;

    // Get full session details from Stripe
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'customer_details'],
    });

    // Create order from checkout session
    const orderId = await createOrderFromCheckoutSession(userId, fullSession);

    if (orderId) {
      // Update checkout session with order ID
      await checkoutSessionRef.update({
        status: 'completed',
        orderId,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

/**
 * Create order from checkout session
 */
async function createOrderFromCheckoutSession(
  userId: string,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  try {
    // Extract cart items from line items
    const lineItems = session.line_items?.data || [];

    if (lineItems.length === 0) {
      console.error('No line items in checkout session');
      return null;
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of lineItems) {
      const product = item.price?.product;
      const productName = typeof product === 'string' ? product : (product as any)?.name || 'Unknown';
      const productId = (item.price?.metadata?.productId) || '';

      const orderItem = {
        productId,
        productName,
        quantity: item.quantity || 1,
        price: ((item.amount_subtotal || 0) / 100).toFixed(2), // Convert from cents
      };

      orderItems.push(orderItem);
      totalAmount += item.amount_subtotal || 0;
    }

    // Create order document
    const orderData = {
      userId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      customerId: session.customer,
      status: 'processing' as const,
      totalAmount: (totalAmount / 100).toFixed(2), // Convert from cents
      currency: session.currency?.toUpperCase() || 'INR',
      shippingName: session.customer_details?.name || '',
      shippingEmail: session.customer_details?.email || '',
      shippingAddress: [
        session.customer_details?.address?.line1,
        session.customer_details?.address?.city,
        session.customer_details?.address?.postal_code,
      ]
        .filter(Boolean)
        .join(', '),
      shippingPhone: session.metadata?.shippingPhone || '',
      notes: session.metadata?.notes || '',
      items: orderItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save order
    const orderRef = await db.collection('orders').add(orderData);

    // Clear user's cart
    const cartItemsSnapshot = await db
      .collection('cartItems')
      .where('userId', '==', userId)
      .get();

    const batch = db.batch();
    cartItemsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Order ${orderRef.id} created successfully`);
    return orderRef.id;
  } catch (error) {
    console.error('Error creating order from checkout session:', error);
    return null;
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  try {
    const checkoutSessionDocs = await db
      .collection('checkoutSessions')
      .where('userId', '==', userId)
      .where('stripeCheckoutSessionId', '==', session.id)
      .get();

    if (!checkoutSessionDocs.empty) {
      const checkoutSessionRef = checkoutSessionDocs.docs[0].ref;
      await checkoutSessionRef.update({
        status: 'expired',
        updatedAt: new Date().toISOString(),
      });
    }

    console.log(`Checkout session ${session.id} expired`);
  } catch (error) {
    console.error('Error handling checkout session expired:', error);
  }
}

/**
 * Handle payment failures
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment failed for payment intent: ${paymentIntent.id}`);

  // Find associated checkout session and mark as failed
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent.id,
    limit: 1,
  });

  if (sessions.data.length > 0) {
    const session = sessions.data[0];
    const userId = session.metadata?.userId;

    if (userId) {
      try {
        const checkoutSessionDocs = await db
          .collection('checkoutSessions')
          .where('userId', '==', userId)
          .where('stripeCheckoutSessionId', '==', session.id)
          .get();

        if (!checkoutSessionDocs.empty) {
          const checkoutSessionRef = checkoutSessionDocs.docs[0].ref;
          await checkoutSessionRef.update({
            status: 'failed',
            failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error updating checkout session for payment failure:', error);
      }
    }
  }
}
