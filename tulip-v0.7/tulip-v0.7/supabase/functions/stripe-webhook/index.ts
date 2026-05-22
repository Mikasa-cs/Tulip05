// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno';

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const getAllowedOrigins = () => {
  const rawOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').trim();
  const parsedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsedOrigins.length > 0 ? parsedOrigins : defaultAllowedOrigins;
};

const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};

const buildCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const responseOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

type SnapshotItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
};

type CheckoutSessionRow = {
  id: string;
  user_id: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  order_id: string | null;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_pincode: string;
  notes: string | null;
  cart_snapshot: unknown;
  amount_total: number;
  currency: string;
};

const jsonResponse = (status: number, payload: unknown, origin: string | null = null) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });

const safeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseSnapshotItems = (source: unknown): SnapshotItem[] => {
  if (!Array.isArray(source)) return [];

  const normalizedItems: SnapshotItem[] = [];

  for (const raw of source) {
    if (!raw || typeof raw !== 'object') continue;

    const item = raw as Record<string, unknown>;

    const id = safeString(item.id);
    const name = safeString(item.name);
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    const selectedSize = safeString(item.selectedSize);
    const selectedColor = safeString(item.selectedColor);

    if (!id || !name) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    normalizedItems.push({
      id,
      name,
      price,
      quantity: Math.floor(quantity),
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
    });
  }

  return normalizedItems;
};

const markCheckoutFailed = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  stripeCheckoutSessionId: string,
  reason: string,
) => {
  await supabaseAdmin
    .from('checkout_sessions')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: reason.slice(0, 500),
    })
    .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
    .neq('status', 'completed');
};

const upsertCompletedSession = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  stripeCheckoutSessionId: string,
  updates: { orderId: string; paymentIntentId: string | null },
) => {
  await supabaseAdmin
    .from('checkout_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      order_id: updates.orderId,
      stripe_payment_intent_id: updates.paymentIntentId,
      failure_reason: null,
      failed_at: null,
    })
    .eq('stripe_checkout_session_id', stripeCheckoutSessionId);
};

const handleCheckoutPaid = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  stripeSession: Stripe.Checkout.Session,
) => {
  if (!stripeSession.id) {
    return { status: 'ignored', reason: 'Missing checkout session id' };
  }

  if (stripeSession.payment_status !== 'paid') {
    return { status: 'ignored', reason: 'Checkout payment is not paid yet' };
  }

  const { data: checkoutSessionRow, error: checkoutSessionError } = await supabaseAdmin
    .from('checkout_sessions')
    .select('*')
    .eq('stripe_checkout_session_id', stripeSession.id)
    .maybeSingle<CheckoutSessionRow>();

  if (checkoutSessionError) {
    throw new Error(checkoutSessionError.message);
  }

  if (!checkoutSessionRow) {
    return { status: 'ignored', reason: 'Checkout session not found in database' };
  }

  if (checkoutSessionRow.status === 'completed' && checkoutSessionRow.order_id) {
    return {
      status: 'already_completed',
      orderId: checkoutSessionRow.order_id,
    };
  }

  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('stripe_checkout_session_id', stripeSession.id)
    .maybeSingle();

  if (existingOrderError) {
    throw new Error(existingOrderError.message);
  }

  const paymentIntentId = typeof stripeSession.payment_intent === 'string' ? stripeSession.payment_intent : null;

  if (existingOrder?.id) {
    await upsertCompletedSession(supabaseAdmin, stripeSession.id, {
      orderId: existingOrder.id,
      paymentIntentId,
    });

    return {
      status: 'already_completed',
      orderId: existingOrder.id,
    };
  }

  const snapshotItems = parseSnapshotItems(checkoutSessionRow.cart_snapshot);
  if (snapshotItems.length === 0) {
    await markCheckoutFailed(supabaseAdmin, stripeSession.id, 'Checkout cart snapshot is empty.');
    return { status: 'failed', reason: 'Checkout snapshot empty' };
  }

  const paidAtIso = new Date().toISOString();

  const { data: createdOrder, error: createOrderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: checkoutSessionRow.user_id,
      total_amount: checkoutSessionRow.amount_total,
      currency: checkoutSessionRow.currency,
      shipping_name: checkoutSessionRow.shipping_name,
      shipping_email: checkoutSessionRow.shipping_email,
      shipping_phone: checkoutSessionRow.shipping_phone,
      shipping_address: checkoutSessionRow.shipping_address,
      shipping_city: checkoutSessionRow.shipping_city,
      shipping_pincode: checkoutSessionRow.shipping_pincode,
      notes: checkoutSessionRow.notes,
      payment_gateway: 'stripe',
      payment_status: 'paid',
      stripe_checkout_session_id: stripeSession.id,
      stripe_payment_intent_id: paymentIntentId,
      paid_at: paidAtIso,
      payment_currency: checkoutSessionRow.currency,
    })
    .select('id')
    .single();

  if (createOrderError || !createdOrder?.id) {
    if (createOrderError?.code === '23505') {
      const { data: retryOrder, error: retryOrderError } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('stripe_checkout_session_id', stripeSession.id)
        .maybeSingle();

      if (retryOrderError || !retryOrder?.id) {
        throw new Error(retryOrderError?.message || createOrderError?.message || 'Unable to create order.');
      }

      await upsertCompletedSession(supabaseAdmin, stripeSession.id, {
        orderId: retryOrder.id,
        paymentIntentId,
      });

      return {
        status: 'already_completed',
        orderId: retryOrder.id,
      };
    }

    const message = createOrderError?.message || 'Unable to create order.';
    await markCheckoutFailed(supabaseAdmin, stripeSession.id, message);
    throw new Error(message);
  }

  const orderItemsPayload = snapshotItems.map((item) => ({
    order_id: createdOrder.id,
    product_id: item.id,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    selected_size: item.selectedSize || '',
    selected_color: item.selectedColor || '',
  }));

  const { error: orderItemsError } = await supabaseAdmin
    .from('order_items')
    .insert(orderItemsPayload);

  if (orderItemsError) {
    const fallbackItemSummary = snapshotItems
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ');

    const mergedNotes = [checkoutSessionRow.notes, `Items: ${fallbackItemSummary}`]
      .filter(Boolean)
      .join(' | ');

    const { error: fallbackUpdateError } = await supabaseAdmin
      .from('orders')
      .update({ notes: mergedNotes })
      .eq('id', createdOrder.id);

    if (fallbackUpdateError) {
      await markCheckoutFailed(
        supabaseAdmin,
        stripeSession.id,
        fallbackUpdateError.message,
      );
      throw new Error(fallbackUpdateError.message);
    }
  }

  const { error: cartDeleteError } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('user_id', checkoutSessionRow.user_id);

  if (cartDeleteError) {
    await markCheckoutFailed(supabaseAdmin, stripeSession.id, cartDeleteError.message);
    throw new Error(cartDeleteError.message);
  }

  await upsertCompletedSession(supabaseAdmin, stripeSession.id, {
    orderId: createdOrder.id,
    paymentIntentId,
  });

  return {
    status: 'completed',
    orderId: createdOrder.id,
  };
};

serve(async (request: Request) => {
  const requestOrigin = request.headers.get('origin');
  const respond = (status: number, payload: unknown) => jsonResponse(status, payload, requestOrigin);

  if (!isAllowedOrigin(requestOrigin)) {
    return respond(403, { error: 'Origin not allowed.' });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(requestOrigin),
    });
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
    return respond(500, { error: 'Server environment is missing required secrets.' });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const stripeSignature = request.headers.get('stripe-signature');
  if (!stripeSignature) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return respond(401, {
        code: 'missing_authorization',
        error: 'Missing authorization header.',
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return respond(401, {
        code: 'invalid_authorization',
        error: 'Invalid authorization header.',
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return respond(401, {
        code: 'invalid_session',
        error: 'Invalid user session.',
      });
    }

    let payload: { sessionId?: string };
    try {
      payload = await request.json() as { sessionId?: string };
    } catch {
      return respond(400, { error: 'Invalid JSON payload.' });
    }

    const manualSessionId = safeString(payload.sessionId);
    if (!manualSessionId) {
      return respond(400, { error: 'Missing sessionId in request body.' });
    }

    const { data: checkoutSessionRow, error: checkoutSessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('user_id, status, order_id')
      .eq('stripe_checkout_session_id', manualSessionId)
      .maybeSingle<{ user_id: string; status: CheckoutSessionRow['status']; order_id: string | null }>();

    if (checkoutSessionError) {
      return respond(500, { error: checkoutSessionError.message });
    }

    if (!checkoutSessionRow) {
      return respond(404, { error: 'Checkout session not found.' });
    }

    if (checkoutSessionRow.user_id !== user.id) {
      return respond(403, { error: 'You are not allowed to verify this checkout session.' });
    }

    if (checkoutSessionRow.status === 'completed' && checkoutSessionRow.order_id) {
      return respond(200, {
        received: true,
        manual: true,
        result: {
          status: 'already_completed',
          orderId: checkoutSessionRow.order_id,
        },
      });
    }

    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(manualSessionId);
      const result = await handleCheckoutPaid(supabaseAdmin, stripeSession);
      return respond(200, { received: true, manual: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manual payment verification failed.';
      return respond(500, { error: message });
    }
  }

  if (!stripeWebhookSecret) {
    return respond(500, { error: 'Server environment is missing required secrets.' });
  }

  const rawPayload = await request.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawPayload, stripeSignature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature.';
    return respond(400, { error: message });
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const stripeSession = event.data.object as Stripe.Checkout.Session;
      const result = await handleCheckoutPaid(supabaseAdmin, stripeSession);
      return respond(200, { received: true, eventType: event.type, result });
    }

    if (event.type === 'checkout.session.expired') {
      const stripeSession = event.data.object as Stripe.Checkout.Session;
      if (stripeSession.id) {
        await supabaseAdmin
          .from('checkout_sessions')
          .update({
            status: 'expired',
            failed_at: new Date().toISOString(),
            failure_reason: 'Stripe checkout session expired.',
          })
          .eq('stripe_checkout_session_id', stripeSession.id)
          .neq('status', 'completed');
      }

      return respond(200, { received: true, eventType: event.type, status: 'expired' });
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const stripeSession = event.data.object as Stripe.Checkout.Session;
      if (stripeSession.id) {
        await markCheckoutFailed(
          supabaseAdmin,
          stripeSession.id,
          'Stripe reported async payment failure.',
        );
      }

      return respond(200, { received: true, eventType: event.type, status: 'failed' });
    }

    return respond(200, { received: true, eventType: event.type, ignored: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return respond(500, { error: message });
  }
});
