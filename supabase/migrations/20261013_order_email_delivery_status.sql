-- ==============================================================================
-- StudioMaya: Order Email Delivery Tracking
-- Migration: 20261013_order_email_delivery_status.sql
-- ==============================================================================

-- Add email_delivery_status column to orders table for reliable delivery retry tracking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS email_delivery_status TEXT DEFAULT 'pending';

-- Index on email_delivery_status for fast queries and admin retry filters
CREATE INDEX IF NOT EXISTS idx_orders_email_delivery_status ON public.orders(email_delivery_status);
