-- ==============================================================================
-- StudioMaya: System Hardening & Atomic Order Processing
-- Migration: 20261014_hardening.sql
-- ==============================================================================

-- 1. Enhance processed_webhook_events with execution status and error tracking
ALTER TABLE public.processed_webhook_events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index on status for operational monitoring
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_status 
ON public.processed_webhook_events(status);

-- 2. Transactional Atomic Order Creation RPC
-- Guarantees that an order and all its items are committed together in one database transaction,
-- eliminating orphaned pending orders due to item insert failures.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order jsonb,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_user_id uuid := NULL;
BEGIN
    IF p_order ? 'user_id' AND p_order->>'user_id' IS NOT NULL AND p_order->>'user_id' <> '' THEN
        v_user_id := (p_order->>'user_id')::uuid;
    END IF;

    -- Insert parent order
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
        p_order->>'customer_name',
        p_order->>'customer_email',
        NULLIF(p_order->>'customer_phone', ''),
        p_order->>'razorpay_order_id',
        (p_order->>'amount')::numeric,
        COALESCE(p_order->>'status', 'pending'),
        v_user_id
    )
    RETURNING id INTO v_order_id;

    -- Insert associated line items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            product_id,
            unit_price,
            product_name_snapshot
        )
        VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            (v_item->>'unit_price')::numeric,
            v_item->>'product_name_snapshot'
        );
    END LOOP;

    RETURN v_order_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Automatic rollback on exception in PL/pgSQL
        RAISE;
END;
$$;
