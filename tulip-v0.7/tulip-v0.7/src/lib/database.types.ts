// ─── Firebase App Types ─────────────────────────────────────────────────────
// Shared type aliases used across the application.
// The legacy Supabase Database type and Row/Insert/Update constructs have been removed.

export type AppRole = 'customer' | 'admin';
export type OrderStatus = 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type CheckoutSessionStatus = 'pending' | 'completed' | 'failed' | 'expired';
export type ChatMessageType = 'text' | 'product_share' | 'review';
