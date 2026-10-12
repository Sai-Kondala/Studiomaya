-- ==============================================================================
-- StudioMaya: Customer Authentication, Profiles, Persistent Cart & Security
-- Migration: 20261012_customer_auth_and_cart.sql
-- ==============================================================================

-- 1. Create customers table linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on email and user_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- 2. Add customer_id and user_id to orders table (preserving all existing columns & data)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);

-- 3. Create persistent carts table with 7-day activity tracking
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_updated_at ON public.carts(updated_at);

-- 4. Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);

-- 5. Enable Row Level Security (RLS) on user data tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Customers RLS Policies
DROP POLICY IF EXISTS "Customers can view their own profile" ON public.customers;
CREATE POLICY "Customers can view their own profile" ON public.customers
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update their own profile" ON public.customers;
CREATE POLICY "Customers can update their own profile" ON public.customers
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert their own profile" ON public.customers;
CREATE POLICY "Customers can insert their own profile" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Carts RLS Policies
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.carts;
CREATE POLICY "Users can manage their own cart" ON public.carts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Cart items RLS Policies
DROP POLICY IF EXISTS "Users can manage their own cart items" ON public.cart_items;
CREATE POLICY "Users can manage their own cart items" ON public.cart_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.carts 
            WHERE carts.id = cart_items.cart_id 
            AND carts.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.carts 
            WHERE carts.id = cart_items.cart_id 
            AND carts.user_id = auth.uid()
        )
    );

-- Orders RLS Policies (Read-only for customers; checkout handlers insert with service role)
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR 
        customer_email = (auth.jwt() ->> 'email')
    );

-- Order Items RLS Policies (Read-only for customers)
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;
CREATE POLICY "Customers can view their own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.user_id = auth.uid() OR orders.customer_email = (auth.jwt() ->> 'email'))
        )
    );

-- 6. Helper function for idempotent 7-day cart expiration cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_carts()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.carts
    WHERE updated_at < (NOW() - INTERVAL '7 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
