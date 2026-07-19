-- ============================================================
-- MANDATORY SPAREPARTS: Add mandatory flag + qty_mandatory
-- Run this in Supabase SQL Editor before deploying
-- ============================================================

-- 1. Add columns to sparepart_master
ALTER TABLE public.sparepart_master ADD COLUMN IF NOT EXISTS mandatory BOOLEAN DEFAULT false;
ALTER TABLE public.sparepart_master ADD COLUMN IF NOT EXISTS qty_mandatory INTEGER DEFAULT 0;

-- 2. Ensure part_number is unique (needed for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sparepart_master_part_number_key'
  ) THEN
    ALTER TABLE public.sparepart_master ADD CONSTRAINT sparepart_master_part_number_key UNIQUE (part_number);
  END IF;
END $$;

-- 3. Create index for fast mandatory filtering
CREATE INDEX IF NOT EXISTS idx_sparepart_master_mandatory ON public.sparepart_master (mandatory) WHERE mandatory = true;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
