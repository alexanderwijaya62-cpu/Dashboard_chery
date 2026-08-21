-- ============================================================
-- 18. STOCK OPNAME TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_opname (
    id BIGSERIAL PRIMARY KEY,
    opname_no TEXT UNIQUE NOT NULL,
    checker TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, confirmed
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users or disable for simplification to match existing patterns
CREATE POLICY "allow_all_authenticated" ON public.stock_opname FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_access_simplification" ON public.stock_opname FOR ALL TO anon USING (true) WITH CHECK (true);
