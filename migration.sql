-- ============================================================
-- MIGRATIONS: Fixes for issues #1, #2, #3, #4
-- ============================================================

-- ============================================================
-- #1: Partial index untuk performa query booking active
-- Enforce slot capacity via application logic (api/db.js)
-- ============================================================
DROP INDEX IF EXISTS idx_booking_active_slot;
CREATE INDEX IF NOT EXISTS idx_booking_active_slot
ON public.booking (tanggal, jam)
WHERE status NOT IN ('declined', 'cancelled', 'no_show');

-- ============================================================
-- #1b: UNIQUE partial index untuk cegah double-booking (race condition)
-- Atomic constraint di level database, bukan hanya application logic.
-- ============================================================
DROP INDEX IF EXISTS idx_booking_unique_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_unique_active_slot
ON public.booking (tanggal, jam)
WHERE status NOT IN ('declined', 'cancelled', 'no_show');

-- ============================================================
-- #2: Tambah kolom cancellation_reason di booking
-- ============================================================
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT '';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS noUrut BIGINT DEFAULT 0;
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS bookingVia TEXT DEFAULT 'Web-Public';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT '';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS namaCustomer TEXT DEFAULT '';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS keperluanService TEXT DEFAULT '';

-- ============================================================
-- Z1: Tambah kolom pendingExtra dan elapsedSeconds di antrian & history
-- ============================================================
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS "pendingExtra" JSONB DEFAULT NULL;
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS "elapsedSeconds" INTEGER DEFAULT 0;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "pendingExtra" JSONB DEFAULT NULL;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "elapsedSeconds" INTEGER DEFAULT 0;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS menginap_reason TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS jam INTEGER;

-- ============================================================
-- K1: Tambah kolom sessionId di customers untuk auth
-- ============================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "sessionId" TEXT DEFAULT '';

-- ============================================================
-- #7: Tambah kolom waktuSelesai di antrian untuk tracking waktu mechanic selesai
-- ============================================================
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS "waktuSelesai" TEXT DEFAULT '';

-- ============================================================
-- #3: Tambah kolom di antrian untuk no-show tracking
-- ============================================================
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS queue_number INTEGER DEFAULT 0;
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS is_called BOOLEAN DEFAULT false;
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS called_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS counter INTEGER DEFAULT 0;

-- ============================================================
-- #4: Booking Config via settings table (ganti magic row id=999999)
-- Insert default config jika belum ada
-- ============================================================
INSERT INTO public.settings (key, value) VALUES
('booking_slot_count', '4'),
('booking_gap_minutes', '30'),
('booking_start_hour', '8'),
('booking_start_minute', '30'),
('booking_slot_capacity', '1')
ON CONFLICT (key) DO NOTHING;

-- Migrate existing data dari magic row jika ada
DO $$
DECLARE
  magic RECORD;
BEGIN
  SELECT * INTO magic FROM public.booking WHERE id = 999999;
  IF FOUND THEN
    UPDATE public.settings SET value = COALESCE(NULLIF(magic."namaCustomer", ''), '4') WHERE key = 'booking_slot_count';
    UPDATE public.settings SET value = COALESCE(NULLIF(magic."tipeMobil", ''), '30') WHERE key = 'booking_gap_minutes';
    IF magic.vin IS NOT NULL AND magic.vin <> '' THEN
      UPDATE public.settings SET value = split_part(magic.vin, ':', 1) WHERE key = 'booking_start_hour';
      UPDATE public.settings SET value = split_part(magic.vin, ':', 2) WHERE key = 'booking_start_minute';
      UPDATE public.settings SET value = COALESCE(NULLIF(split_part(magic.vin, ':', 3), ''), '1') WHERE key = 'booking_slot_capacity';
    END IF;
  END IF;
END $$;

-- ============================================================
-- #4: Hapus RLS deny untuk settings agar anon bisa baca via Realtime
-- (settings sudah public read di api/db.js)
-- ============================================================
-- Allow anon to read settings via Realtime (for booking config)
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
CREATE POLICY "anon_read_settings" ON public.settings FOR SELECT TO anon USING (true);

-- ============================================================
-- #5: Tambah kolom di history untuk mendukung fitur checklist & laporan
-- ============================================================
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "waktuMasuk" TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "waktuSelesai" TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "Jarak Waktu" TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "Bulan" TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS estimasiDefault BIGINT DEFAULT 0;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS "targetTime" BIGINT DEFAULT 0;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS mechanicName TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Reguler';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS addedBy TEXT DEFAULT '';

-- ============================================================
-- #8: Tambah kolom nama_sa di antrian untuk tracking Service Advisor
-- ============================================================
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS nama_sa TEXT DEFAULT '';
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS nama_sa TEXT DEFAULT '';
ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS cuci_required BOOLEAN DEFAULT false;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- #6: Table sparepart_revenue untuk data penjualan sparepart
-- imported from Excel via SparepartPredictor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sparepart_revenue (
    id BIGSERIAL PRIMARY KEY,
    "NoTransaksi" TEXT,
    "Tgl" TEXT,
    "NoWO" TEXT,
    "Pelanggan" TEXT,
    "PartNo" TEXT,
    "PartName" TEXT,
    "Type" TEXT,
    "Qty" NUMERIC DEFAULT 0,
    "HargaSatuan" NUMERIC DEFAULT 0,
    "Discount" NUMERIC DEFAULT 0,
    "HargaJual" NUMERIC DEFAULT 0,
    "Total" NUMERIC DEFAULT 0,
    "bulan" TEXT,
    "tahun" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sparepart_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_anon" ON public.sparepart_revenue;
CREATE POLICY "deny_all_anon" ON public.sparepart_revenue FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_sparepart_revenue_bulan ON public.sparepart_revenue("bulan");
CREATE INDEX IF NOT EXISTS idx_sparepart_revenue_tahun ON public.sparepart_revenue("tahun");
CREATE INDEX IF NOT EXISTS idx_sparepart_revenue_partname ON public.sparepart_revenue("PartName");
