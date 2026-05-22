import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Restrict CORS to allowed origins
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:8080,http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Load product catalog for server-side price validation
let productCatalog = new Map();
try {
  const rawData = readFileSync('./src/data/tulipProducts.json', 'utf-8');
  const products = JSON.parse(rawData);
  if (Array.isArray(products)) {
    for (const product of products) {
      productCatalog.set(String(product.id), {
        id: String(product.id),
        name: product.name || '',
        price: Number(product.price) || 0,
      });
    }
  }
  console.log(`📦 Loaded ${productCatalog.size} products for price validation`);
} catch (error) {
  console.warn('⚠️ Could not load product catalog for server-side validation. Falling back to client prices.');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Checkout server is running' });
});

// Create Stripe Checkout Session
app.post('/api/create-stripe-checkout', async (req, res) => {
  try {
    const { 
      cartItems, 
      shippingEmail, 
      shippingName, 
      shippingAddress, 
      shippingCity, 
      shippingPincode, 
      successUrl, 
      cancelUrl 
    } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (cartItems.length > 50) {
      return res.status(400).json({ error: 'Too many items in cart' });
    }

    if (!shippingEmail || !shippingName) {
      return res.status(400).json({ error: 'Missing required shipping information' });
    }

    // Validate and create line items with server-side prices
    const lineItems = [];
    for (const item of cartItems) {
      const productId = String(item.id || '').trim();
      const quantity = Math.max(1, Math.min(Math.floor(Number(item.quantity) || 1), 99));

      if (!productId) {
        return res.status(400).json({ error: `Invalid product in cart` });
      }

      // Use server-side catalog price if available, otherwise reject
      const catalogProduct = productCatalog.get(productId);
      let verifiedPrice;
      let productName;

      if (catalogProduct) {
        verifiedPrice = catalogProduct.price;
        productName = catalogProduct.name;

        // Warn if client price doesn't match server price
        const clientPrice = Number(item.price);
        if (Math.abs(clientPrice - verifiedPrice) > 0.01) {
          console.warn(
            `⚠️ Price mismatch for product ${productId}: client=${clientPrice}, server=${verifiedPrice}. Using server price.`
          );
        }
      } else if (productCatalog.size === 0) {
        // Catalog not loaded — fall back to client price (development only)
        verifiedPrice = Number(item.price);
        productName = item.name || 'Product';
        console.warn(`⚠️ No catalog loaded, using client price for ${productId}: ${verifiedPrice}`);
      } else {
        return res.status(400).json({ error: `Product ${productId} not found in catalog` });
      }

      if (!Number.isFinite(verifiedPrice) || verifiedPrice <= 0) {
        return res.status(400).json({ error: `Invalid price for product ${productId}` });
      }

      lineItems.push({
        price_data: {
          currency: 'inr',
          product_data: {
            name: productName,
            metadata: {
              productId,
            },
          },
          unit_amount: Math.round(verifiedPrice * 100), // Server-verified price
        },
        quantity,
      });
    }

    // Get or create Stripe customer
    const customers = await stripe.customers.list({
      email: shippingEmail,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: shippingEmail,
        name: shippingName,
        address: {
          line1: shippingAddress,
          city: shippingCity,
          postal_code: shippingPincode,
          country: 'IN',
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        shippingAddress,
        shippingCity,
        shippingPincode,
      },
    });

    res.json({ 
      url: session.url, 
      sessionId: session.id,
      success: true 
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create checkout session',
      success: false 
    });
  }
});

const PORT = process.env.CHECKOUT_SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Checkout server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
