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

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
};

type CheckoutSessionRequest = {
  shippingName: string;
  shippingEmail: string;
  shippingPhone?: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingPincode: string;
  notes?: string | null;
  cartItems: CartItem[];
  totalAmount?: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
};

const jsonResponse = (status: number, payload: unknown, origin: string | null = null) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeCartItems = (input: unknown): CartItem[] => {
  if (!Array.isArray(input)) return [];

  const normalizedItems: CartItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;

    const source = raw as Record<string, unknown>;
    const id = toTrimmedString(source.id);
    const name = toTrimmedString(source.name);
    const quantity = Number(source.quantity);
    const price = Number(source.price);
    const selectedSize = toTrimmedString(source.selectedSize);
    const selectedColor = toTrimmedString(source.selectedColor);

    if (!id || !name) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;

    normalizedItems.push({
      id,
      name,
      quantity: Math.floor(quantity),
      price,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
    });
  }

  return normalizedItems;
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
    return respond(500, { error: 'Server environment is missing required secrets.' });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return respond(401, { error: 'Missing authorization header.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return respond(401, { error: 'Invalid authorization format.' });
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
    return respond(401, { error: 'User not found or session invalid.' });
  }

  let payload: CheckoutSessionRequest;
  try {
    payload = (await request.json()) as CheckoutSessionRequest;
  } catch {
    return respond(400, { error: 'Invalid JSON payload.' });
  }

  const shippingName = toTrimmedString(payload.shippingName);
  const shippingEmail = toTrimmedString(payload.shippingEmail).toLowerCase();
  const shippingPhone = toTrimmedString(payload.shippingPhone);
  const shippingAddress = toTrimmedString(payload.shippingAddress);
  const shippingCity = toTrimmedString(payload.shippingCity);
  const shippingPincode = toTrimmedString(payload.shippingPincode);
  const notes = toTrimmedString(payload.notes);
  const successUrl = toTrimmedString(payload.successUrl);
  const cancelUrl = toTrimmedString(payload.cancelUrl);
  const currency = (toTrimmedString(payload.currency) || 'INR').toLowerCase();

  if (!shippingName || !shippingEmail || !shippingAddress || !shippingCity || !shippingPincode) {
    return respond(400, { error: 'Missing required shipping details.' });
  }

  if (!isValidHttpUrl(successUrl) || !isValidHttpUrl(cancelUrl)) {
    return respond(400, { error: 'Invalid success/cancel URL.' });
  }

  const cartItems = normalizeCartItems(payload.cartItems);
  if (cartItems.length === 0) {
    return respond(400, { error: 'Cart is empty.' });
  }

  const maxItemQuantity = 20;
  if (cartItems.some((item) => item.quantity > maxItemQuantity)) {
    return respond(400, { error: `Maximum quantity per item is ${maxItemQuantity}.` });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const uniqueProductIds = [...new Set(cartItems.map((item) => item.id))];
  const { data: productRows, error: productLookupError } = await supabaseAdmin
    .from('products')
    .select('id, name, price, stock')
    .in('id', uniqueProductIds);

  if (productLookupError) {
    return respond(500, { error: 'Unable to validate product pricing right now.' });
  }

  const productsById = new Map(
    (productRows || []).map((product) => {
      const row = product as Record<string, unknown>;
      return [toTrimmedString(row.id), row] as const;
    }),
  );

  if (productsById.size !== uniqueProductIds.length) {
    return respond(400, { error: 'One or more products are unavailable. Please refresh your cart.' });
  }

  const trustedCartItems: CartItem[] = [];

  for (const item of cartItems) {
    const productRow = productsById.get(item.id);

    if (!productRow) {
      return respond(400, { error: 'One or more products are unavailable. Please refresh your cart.' });
    }

    const trustedPrice = Number(productRow.price);
    const availableStock = Number(productRow.stock);
    const trustedName = toTrimmedString(productRow.name) || item.name;

    if (!Number.isFinite(trustedPrice) || trustedPrice < 0) {
      return respond(500, { error: 'Product pricing is not available right now.' });
    }

    if (Number.isFinite(availableStock) && availableStock >= 0 && item.quantity > Math.floor(availableStock)) {
      return respond(400, {
        error: `${trustedName} does not have enough stock for the selected quantity.`,
      });
    }

    trustedCartItems.push({
      ...item,
      name: trustedName,
      price: Number(trustedPrice.toFixed(2)),
    });
  }

  const computedTotal = Number(
    trustedCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
  );

  if (computedTotal <= 0) {
    return respond(400, { error: 'Cart total must be greater than zero.' });
  }

  if (
    typeof payload.totalAmount === 'number'
    && Number.isFinite(payload.totalAmount)
    && Math.abs(payload.totalAmount - computedTotal) > 0.01
  ) {
    return respond(400, { error: 'Cart total mismatch. Please refresh and retry checkout.' });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
  const amountInSmallestUnit = Math.round(computedTotal * 100);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = trustedCartItems.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: Math.round(item.price * 100),
      product_data: {
        name: item.name.slice(0, 250),
        metadata: {
          product_id: item.id,
        },
      },
    },
  }));

  let checkoutSession: Stripe.Checkout.Session;

  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: shippingEmail,
      client_reference_id: user.id,
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        payment_gateway: 'stripe',
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
        },
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
  } catch (stripeError) {
    const message = stripeError instanceof Error ? stripeError.message : 'Unable to create Stripe checkout session.';
    return respond(500, { error: message });
  }

  if (!checkoutSession.url) {
    return respond(500, { error: 'Stripe checkout URL not returned.' });
  }

  const { error: insertError } = await supabaseAdmin.from('checkout_sessions').insert({
    user_id: user.id,
    payment_gateway: 'stripe',
    status: 'pending',
    stripe_checkout_session_id: checkoutSession.id,
    stripe_payment_intent_id: typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : null,
    shipping_name: shippingName,
    shipping_email: shippingEmail,
    shipping_phone: shippingPhone || null,
    shipping_address: shippingAddress,
    shipping_city: shippingCity,
    shipping_pincode: shippingPincode,
    notes: notes || null,
    cart_snapshot: trustedCartItems,
    amount_total: computedTotal,
    currency: currency.toUpperCase(),
    expires_at: checkoutSession.expires_at
      ? new Date(checkoutSession.expires_at * 1000).toISOString()
      : null,
  });

  if (insertError) {
    try {
      await stripe.checkout.sessions.expire(checkoutSession.id);
    } catch {
    }

    return respond(500, { error: insertError.message });
  }

  return respond(200, {
    url: checkoutSession.url,
    sessionId: checkoutSession.id,
    amountInSmallestUnit,
  });
});
