-- ==============================================================================
-- StudioMaya: Production Hardening, RPC Security & Webhook Lifecycle
-- Migration: 20261015_production_hardening.sql
-- ==============================================================================

-- 1. Table Constraints & Status Enforcements
DO $$
BEGIN
    -- Enforce order status domain integrity
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_orders_status'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT check_orders_status 
        CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded'));
    END IF;

    -- Enforce webhook event status domain integrity
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_webhook_events_status'
    ) THEN
        ALTER TABLE public.processed_webhook_events 
        ADD CONSTRAINT check_webhook_events_status 
        CHECK (status IN ('processing', 'completed', 'failed'));
    END IF;
END $$;

-- 2. Indexes for Query Optimization & Idempotency Lookups
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_provider_status ON public.processed_webhook_events(provider, status);

-- 3. Hardened Transactional Atomic Order Creation RPC
-- Validates JSON structure, verifies products against database, guarantees item price integrity,
-- enforces pending status, and prevents caller forged states.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order jsonb,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_user_id uuid := NULL;
    v_amount numeric;
    v_rzp_order_id text;
    v_customer_name text;
    v_customer_email text;
    v_customer_phone text;
    v_item_count int;
    v_item_product_id uuid;
    v_item_unit_price numeric;
    v_db_product RECORD;
    v_calculated_total numeric := 0;
BEGIN
    -- 1. Payload validation
    IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
        RAISE EXCEPTION 'Invalid order payload: must be a valid JSON object.';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Invalid order items payload: must be a valid JSON array.';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'Invalid order: items list cannot be empty.';
    END IF;

    IF v_item_count > 50 THEN
        RAISE EXCEPTION 'Invalid order: items list exceeds maximum limit of 50 items.';
    END IF;

    -- 2. Validate customer details
    v_customer_name := TRIM(COALESCE(p_order->>'customer_name', ''));
    IF v_customer_name = '' THEN
        RAISE EXCEPTION 'Invalid order: customer_name is required.';
    END IF;

    v_customer_email := LOWER(TRIM(COALESCE(p_order->>'customer_email', '')));
    IF v_customer_email = '' OR position('@' in v_customer_email) = 0 THEN
        RAISE EXCEPTION 'Invalid order: valid customer_email is required.';
    END IF;

    v_customer_phone := NULLIF(TRIM(COALESCE(p_order->>'customer_phone', '')), '');

    -- 3. Validate razorpay_order_id
    v_rzp_order_id := TRIM(COALESCE(p_order->>'razorpay_order_id', ''));
    IF v_rzp_order_id = '' THEN
        RAISE EXCEPTION 'Invalid order: razorpay_order_id is required.';
    END IF;

    -- 4. Validate order total amount
    BEGIN
        v_amount := (p_order->>'amount')::numeric;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid order amount: must be a valid numeric value.';
    END;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid order amount: must be greater than zero.';
    END IF;

    -- 5. Validate user_id if present
    IF p_order ? 'user_id' AND p_order->>'user_id' IS NOT NULL AND TRIM(p_order->>'user_id') <> '' THEN
        BEGIN
            v_user_id := (p_order->>'user_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid user_id: must be a valid UUID.';
        END;
    END IF;

    -- 6. Validate items against database products and verify prices
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF jsonb_typeof(v_item) <> 'object' THEN
            RAISE EXCEPTION 'Invalid item in items array: each item must be a JSON object.';
        END IF;

        BEGIN
            v_item_product_id := (v_item->>'product_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid product_id in item: must be a valid UUID.';
        END;

        -- Verify product exists and is published in public.products
        SELECT id, name, price, status INTO v_db_product
        FROM public.products
        WHERE id = v_item_product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found.', v_item_product_id;
        END IF;

        IF v_db_product.status IS DISTINCT FROM 'Published' THEN
            RAISE EXCEPTION 'Product % is not available for purchase.', v_item_product_id;
        END IF;

        v_item_unit_price := v_db_product.price;
        v_calculated_total := v_calculated_total + v_item_unit_price;
    END LOOP;

    -- Verify that order amount matches sum of published product prices (rounded to 2 decimals)
    IF ROUND(v_amount, 2) <> ROUND(v_calculated_total, 2) THEN
        RAISE EXCEPTION 'Order amount mismatch: expected %, received %.', v_calculated_total, v_amount;
    END IF;

    -- 7. Security Guard: Order creation at checkout MUST ALWAYS initialize in 'pending' status.
    -- Never trust or accept caller-supplied status to prevent forged paid orders.
    INSERT INTO public.orders (
        customer_name,
        customer_email,
        customer_phone,
        razorpay_order_id,
        amount,
        status,
        user_id
    )
    VALUES (
        v_customer_name,
        v_customer_email,
        v_customer_phone,
        v_rzp_order_id,
        v_amount,
        'pending',
        v_user_id
    )
    RETURNING id INTO v_order_id;

    -- 8. Insert associated line items with canonical price and snapshot name from DB
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_product_id := (v_item->>'product_id')::uuid;
        SELECT name, price INTO v_db_product FROM public.products WHERE id = v_item_product_id;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            unit_price,
            product_name_snapshot
        )
        VALUES (
            v_order_id,
            v_item_product_id,
            v_db_product.price,
            COALESCE(NULLIF(TRIM(v_item->>'product_name_snapshot'), ''), v_db_product.name)
        );
    END LOOP;

    RETURN v_order_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- 4. Strict Function Access Permissions
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb, jsonb) TO service_role;
