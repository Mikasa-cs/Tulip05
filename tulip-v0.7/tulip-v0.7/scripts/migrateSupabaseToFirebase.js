/**
 * Data Migration Script: Supabase → Firebase Firestore & Realtime DB
 * 
 * This script exports all data from Supabase and imports it to Firebase.
 * Run this BEFORE removing Supabase.
 * 
 * Usage:
 *   1. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE (service account key)
 *   2. Set FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT (Firebase service account JSON)
 *   3. Run: node scripts/migrateSupabaseToFirebase.js
 */

const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!FIREBASE_PROJECT_ID || !fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Missing Firebase credentials');
  console.error('Set: VITE_FIREBASE_PROJECT_ID');
  console.error('Place firebase-service-account.json in current directory');
  process.exit(1);
}

// ===== IMPORTS =====
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));

// ===== INITIALIZE CLIENTS =====
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: FIREBASE_PROJECT_ID,
});

const firestoreDb = admin.firestore();
const realtimeDb = admin.database();

// ===== UTILITY FUNCTIONS =====

const logProgress = (message) => {
  console.log(`✓ ${message}`);
};

const logError = (message, error) => {
  console.error(`✗ ${message}`, error?.message || error);
};

const convertTimestamp = (dateString) => {
  return dateString ? new Date(dateString).getTime() : Date.now();
};

// ===== MIGRATION FUNCTIONS =====

async function migrateProfiles() {
  console.log('\n📦 Migrating PROFILES...');
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const profile of data || []) {
      await firestoreDb.collection('profiles').doc(profile.id).set({
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        gender: profile.gender,
        avatarUrl: profile.avatar_url,
        role: profile.role,
        joinedAt: admin.firestore.Timestamp.fromDate(new Date(profile.joined_at)),
        address: profile.address,
        city: profile.city,
        pincode: profile.pincode,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(profile.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(profile.updated_at)),
      });
      migrated++;
    }
    logProgress(`Profiles: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate profiles', err);
    return 0;
  }
}

async function migrateAddresses() {
  console.log('\n📦 Migrating ADDRESSES...');
  try {
    const { data, error } = await supabase.from('addresses').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const address of data || []) {
      await firestoreDb.collection('addresses').doc(address.id).set({
        id: address.id,
        userId: address.user_id,
        label: address.label,
        address: address.address,
        city: address.city,
        pincode: address.pincode,
        isDefault: address.is_default,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(address.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(address.updated_at)),
      });
      migrated++;
    }
    logProgress(`Addresses: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate addresses', err);
    return 0;
  }
}

async function migrateProducts() {
  console.log('\n📦 Migrating PRODUCTS...');
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const product of data || []) {
      await firestoreDb.collection('products').doc(product.id).set({
        id: product.id,
        name: product.name,
        brand: product.brand,
        description: product.description,
        price: product.price,
        originalPrice: product.original_price,
        imageUrl: product.image_url,
        hoverImageUrl: product.hover_image_url,
        gender: product.gender,
        masterCategory: product.master_category,
        subCategory: product.sub_category,
        articleType: product.article_type,
        baseColour: product.base_colour,
        season: product.season,
        year: product.year,
        usage: product.usage,
        category: product.category,
        rating: product.rating,
        reviews: product.reviews,
        isNew: product.is_new,
        isTrending: product.is_trending,
        isAIPick: product.is_ai_pick,
        colors: product.colors || [],
        sizes: product.sizes || [],
        material: product.material,
        fit: product.fit,
        skinType: product.skin_type,
        notableEffects: product.notable_effects || [],
        stock: product.stock,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(product.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(product.updated_at)),
      });
      migrated++;
    }
    logProgress(`Products: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate products', err);
    return 0;
  }
}

async function migrateCartItems() {
  console.log('\n📦 Migrating CART ITEMS...');
  try {
    const { data, error } = await supabase.from('cart_items').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const item of data || []) {
      await firestoreDb.collection('cartItems').doc(item.id).set({
        id: item.id,
        userId: item.user_id,
        productId: item.product_id,
        quantity: item.quantity,
        selectedSize: item.selected_size,
        selectedColor: item.selected_color,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(item.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(item.updated_at)),
      });
      migrated++;
    }
    logProgress(`Cart Items: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate cart items', err);
    return 0;
  }
}

async function migrateWishlistItems() {
  console.log('\n📦 Migrating WISHLIST ITEMS...');
  try {
    const { data, error } = await supabase.from('wishlist_items').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const item of data || []) {
      await firestoreDb.collection('wishlistItems').doc(item.id).set({
        id: item.id,
        userId: item.user_id,
        productId: item.product_id,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(item.created_at)),
      });
      migrated++;
    }
    logProgress(`Wishlist Items: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate wishlist items', err);
    return 0;
  }
}

async function migrateOrders() {
  console.log('\n📦 Migrating ORDERS...');
  try {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const order of data || []) {
      await firestoreDb.collection('orders').doc(order.id).set({
        id: order.id,
        userId: order.user_id,
        status: order.status,
        totalAmount: order.total_amount,
        currency: order.currency,
        shippingName: order.shipping_name,
        shippingEmail: order.shipping_email,
        shippingPhone: order.shipping_phone,
        shippingAddress: order.shipping_address,
        shippingCity: order.shipping_city,
        shippingPincode: order.shipping_pincode,
        notes: order.notes,
        paymentGateway: order.payment_gateway,
        paymentStatus: order.payment_status,
        stripeCheckoutSessionId: order.stripe_checkout_session_id,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        paidAt: order.paid_at ? admin.firestore.Timestamp.fromDate(new Date(order.paid_at)) : null,
        paymentCurrency: order.payment_currency,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(order.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(order.updated_at)),
      });
      migrated++;
    }
    logProgress(`Orders: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate orders', err);
    return 0;
  }
}

async function migrateOrderItems() {
  console.log('\n📦 Migrating ORDER ITEMS...');
  try {
    const { data: orders, error: ordersError } = await supabase.from('orders').select('id');
    if (ordersError) throw ordersError;

    let migrated = 0;
    for (const order of orders || []) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        await firestoreDb
          .collection('orders')
          .doc(order.id)
          .collection('items')
          .doc(item.id)
          .set({
            id: item.id,
            orderId: item.order_id,
            productId: item.product_id,
            productName: item.product_name,
            unitPrice: item.unit_price,
            quantity: item.quantity,
            selectedSize: item.selected_size,
            selectedColor: item.selected_color,
            createdAt: admin.firestore.Timestamp.fromDate(new Date(item.created_at)),
          });
        migrated++;
      }
    }
    logProgress(`Order Items: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate order items', err);
    return 0;
  }
}

async function migrateChatRooms() {
  console.log('\n📦 Migrating CHAT ROOMS (to Realtime DB)...');
  try {
    const { data, error } = await supabase.from('chat_rooms').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const room of data || []) {
      await realtimeDb.ref(`chatRooms/${room.id}`).set({
        id: room.id,
        slug: room.slug,
        name: room.name,
        description: room.description,
        createdBy: room.created_by,
        isPrivate: room.is_private,
        createdAt: convertTimestamp(room.created_at),
        updatedAt: convertTimestamp(room.updated_at),
      });
      migrated++;
    }
    logProgress(`Chat Rooms: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate chat rooms', err);
    return 0;
  }
}

async function migrateChatMessages() {
  console.log('\n📦 Migrating CHAT MESSAGES (to Realtime DB)...');
  try {
    const { data, error } = await supabase.from('chat_messages').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const msg of data || []) {
      await realtimeDb
        .ref(`chatRooms/${msg.room_id}/messages/${msg.id}`)
        .set({
          id: msg.id,
          roomId: msg.room_id,
          userId: msg.user_id,
          content: msg.content,
          messageType: msg.message_type,
          metadata: msg.message_metadata,
          createdAt: convertTimestamp(msg.created_at),
        });
      migrated++;
    }
    logProgress(`Chat Messages: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate chat messages', err);
    return 0;
  }
}

async function migrateProductReviews() {
  console.log('\n📦 Migrating PRODUCT REVIEWS...');
  try {
    const { data, error } = await supabase.from('product_reviews').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const review of data || []) {
      await firestoreDb.collection('productReviews').doc(review.id).set({
        id: review.id,
        productId: review.product_id,
        userId: review.user_id,
        rating: review.rating,
        reviewText: review.review_text,
        roomId: review.room_id,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(review.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(review.updated_at)),
      });
      migrated++;
    }
    logProgress(`Product Reviews: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate product reviews', err);
    return 0;
  }
}

async function migrateRecommendationEvents() {
  console.log('\n📦 Migrating RECOMMENDATION EVENTS...');
  try {
    const { data, error } = await supabase.from('recommendation_events').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const event of data || []) {
      await firestoreDb.collection('recommendationEvents').doc(event.id).set({
        id: event.id,
        userId: event.user_id,
        eventType: event.event_type,
        productId: event.product_id,
        metadata: event.metadata,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(event.created_at)),
      });
      migrated++;
    }
    logProgress(`Recommendation Events: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate recommendation events', err);
    return 0;
  }
}

async function migrateCheckoutSessions() {
  console.log('\n📦 Migrating CHECKOUT SESSIONS...');
  try {
    const { data, error } = await supabase.from('checkout_sessions').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const session of data || []) {
      await firestoreDb.collection('checkoutSessions').doc(session.id).set({
        id: session.id,
        userId: session.user_id,
        stripeCheckoutSessionId: session.stripe_checkout_session_id,
        status: session.status,
        cartSnapshot: session.cart_snapshot,
        amountTotal: session.amount_total,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(session.created_at)),
        updatedAt: admin.firestore.Timestamp.fromDate(new Date(session.updated_at)),
      });
      migrated++;
    }
    logProgress(`Checkout Sessions: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate checkout sessions', err);
    return 0;
  }
}

async function migrateAdminAuditLogs() {
  console.log('\n📦 Migrating ADMIN AUDIT LOGS...');
  try {
    const { data, error } = await supabase.from('admin_audit_logs').select('*');
    if (error) throw error;

    let migrated = 0;
    for (const log of data || []) {
      await firestoreDb.collection('adminAuditLogs').doc(log.id).set({
        id: log.id,
        adminId: log.admin_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        metadata: log.metadata,
        createdAt: admin.firestore.Timestamp.fromDate(new Date(log.created_at)),
      });
      migrated++;
    }
    logProgress(`Admin Audit Logs: ${migrated} records`);
    return migrated;
  } catch (err) {
    logError('Failed to migrate admin audit logs', err);
    return 0;
  }
}

// ===== MAIN MIGRATION =====

async function runMigration() {
  console.log('\n🚀 STARTING SUPABASE → FIREBASE MIGRATION\n');
  console.log(`Source: ${SUPABASE_URL}`);
  console.log(`Target: Firebase (Project: ${FIREBASE_PROJECT_ID})\n`);

  const startTime = Date.now();
  const results = {};

  try {
    results.profiles = await migrateProfiles();
    results.addresses = await migrateAddresses();
    results.products = await migrateProducts();
    results.cartItems = await migrateCartItems();
    results.wishlistItems = await migrateWishlistItems();
    results.orders = await migrateOrders();
    results.orderItems = await migrateOrderItems();
    results.chatRooms = await migrateChatRooms();
    results.chatMessages = await migrateChatMessages();
    results.productReviews = await migrateProductReviews();
    results.recommendationEvents = await migrateRecommendationEvents();
    results.checkoutSessions = await migrateCheckoutSessions();
    results.adminAuditLogs = await migrateAdminAuditLogs();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n📊 MIGRATION SUMMARY');
    console.log('====================');
    console.log(`Total records migrated: ${Object.values(results).reduce((a, b) => a + b, 0)}`);
    console.log(`Duration: ${duration}s`);
    console.log('\nBreakdown:');
    Object.entries(results).forEach(([key, count]) => {
      console.log(`  - ${key}: ${count}`);
    });

    console.log('\n✅ MIGRATION COMPLETE');
    console.log('\nNext steps:');
    console.log('1. Verify all data in Firebase Console');
    console.log('2. Update your app to use Firebase (already in code)');
    console.log('3. Run integration tests');
    console.log('4. Delete Supabase project (after verification)');

    process.exit(0);
  } catch (err) {
    logError('Migration failed', err);
    process.exit(1);
  }
}

// Run migration
runMigration();
