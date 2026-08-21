-- Create table for storing partshop estimations
CREATE TABLE IF NOT EXISTS public.partshop_estimations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    username VARCHAR(255) NOT NULL,
    vin VARCHAR(50),
    total_qty INT DEFAULT 0,
    total_price NUMERIC DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb
);

-- Indexing for faster history lookup
CREATE INDEX IF NOT EXISTS idx_partshop_estimations_username ON public.partshop_estimations(username);
CREATE INDEX IF NOT EXISTS idx_partshop_estimations_created ON public.partshop_estimations(created_at DESC);
