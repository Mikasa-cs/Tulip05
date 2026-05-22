-- Stripe Checkout payment tracking schema

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'payment_status'
  ) THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'checkout_session_status'
  ) THEN
    CREATE TYPE public.checkout_session_status AS ENUM ('pending', 'completed', 'failed', 'expired');
  END IF;
END $$;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_currency text NOT NULL DEFAULT 'INR';

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_uidx
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_uidx
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_gateway text NOT NULL DEFAULT 'stripe',
  status public.checkout_session_status NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id text NOT NULL,
  stripe_payment_intent_id text,
  shipping_name text NOT NULL,
  shipping_email text NOT NULL,
  shipping_phone text,
  shipping_address text NOT NULL,
  shipping_city text NOT NULL,
  shipping_pincode text NOT NULL,
  notes text,
  cart_snapshot jsonb NOT NULL,
  amount_total numeric(12,2) NOT NULL CHECK (amount_total >= 0),
  currency text NOT NULL DEFAULT 'INR',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_stripe_session_id_uidx
  ON public.checkout_sessions (stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx
  ON public.checkout_sessions (user_id);

CREATE INDEX IF NOT EXISTS checkout_sessions_status_idx
  ON public.checkout_sessions (status);

CREATE INDEX IF NOT EXISTS checkout_sessions_created_at_idx
  ON public.checkout_sessions (created_at DESC);

DROP TRIGGER IF EXISTS checkout_sessions_set_updated_at ON public.checkout_sessions;
CREATE TRIGGER checkout_sessions_set_updated_at
BEFORE UPDATE ON public.checkout_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_sessions TO authenticated;

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_select_own_or_admin ON public.checkout_sessions;
CREATE POLICY checkout_sessions_select_own_or_admin
ON public.checkout_sessions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS checkout_sessions_insert_own_or_admin ON public.checkout_sessions;
CREATE POLICY checkout_sessions_insert_own_or_admin
ON public.checkout_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS checkout_sessions_admin_update ON public.checkout_sessions;
CREATE POLICY checkout_sessions_admin_update
ON public.checkout_sessions
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS checkout_sessions_admin_delete ON public.checkout_sessions;
CREATE POLICY checkout_sessions_admin_delete
ON public.checkout_sessions
FOR DELETE
USING (public.is_admin(auth.uid()));
