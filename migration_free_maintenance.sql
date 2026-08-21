-- ============================================================
-- FREE MAINTENANCE: Create free_maintenance table and RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.free_maintenance (
    id TEXT PRIMARY KEY, -- e.g. vm-1738734912903
    kode_tipe TEXT NOT NULL,
    nama_mobil TEXT NOT NULL,
    drivetrain TEXT DEFAULT '4x2',
    drive_layout TEXT DEFAULT 'FWD',
    intervals JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.free_maintenance ENABLE ROW LEVEL SECURITY;

-- Deny all anon (API routes using service_role bypass RLS)
DROP POLICY IF EXISTS "deny_all_anon" ON public.free_maintenance;
CREATE POLICY "deny_all_anon" ON public.free_maintenance FOR ALL USING (false) WITH CHECK (false);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
