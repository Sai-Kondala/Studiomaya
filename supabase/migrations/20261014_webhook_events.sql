-- ==============================================================================
-- StudioMaya: Processed Webhook Events Schema
-- Migration: 20261014_webhook_events.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    event_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for lookup by order_id
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_order_id 
ON public.processed_webhook_events(order_id);

-- Enable RLS (Service role only access)
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
