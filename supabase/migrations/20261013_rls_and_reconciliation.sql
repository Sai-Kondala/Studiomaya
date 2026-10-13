-- ==============================================================================
-- StudioMaya: Schema Reconciliation & Strict Ownership RLS Policies
-- Migration: 20261013_rls_and_reconciliation.sql
-- ==============================================================================

-- 1. Ensure customer_phone column type is TEXT on orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'orders' 
          AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN customer_phone TYPE TEXT;
    END IF;
END $$;

-- 2. Customer backfill for any existing orders missing customer_id
-- Preserves existing orders and order items; does not duplicate customers
INSERT INTO public.customers (full_name, email, phone)
SELECT DISTINCT 
    COALESCE(NULLIF(TRIM(o.customer_name), ''), split_part(TRIM(o.customer_email), '@', 1), 'Customer'), 
    LOWER(TRIM(o.customer_email)), 
    o.customer_phone
FROM public.orders o
WHERE o.customer_email IS NOT NULL 
  AND o.customer_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(o.customer_email))
  )
ON CONFLICT (email) DO NOTHING;

-- Associate orders missing customer_id with their matching customer profile
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE o.customer_id IS NULL
  AND o.customer_email IS NOT NULL
  AND LOWER(TRIM(o.customer_email)) = LOWER(TRIM(c.email));

-- 3. Row-Level Security (RLS) Reconciliation
-- Ensure Row Level Security is active
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders SELECT Policy:
-- If an order has a user_id, only that authenticated user can read it.
-- Allow email matching ONLY for unassigned guest orders (where user_id IS NULL).
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (
        (user_id IS NOT NULL AND auth.uid() = user_id)
        OR
        (user_id IS NULL AND customer_email = (auth.jwt() ->> 'email'))
    );

-- Order Items SELECT Policy:
-- Authenticated customers can view order items only if the parent order
-- satisfies the same strict ownership rule.
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;
CREATE POLICY "Customers can view their own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (
                (orders.user_id IS NOT NULL AND orders.user_id = auth.uid())
                OR
                (orders.user_id IS NULL AND orders.customer_email = (auth.jwt() ->> 'email'))
            )
        )
    );
