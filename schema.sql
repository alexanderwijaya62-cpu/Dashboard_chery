-- ============================================================
-- CHERY DASHBOARD - DATABASE SCHEMA SETUP FOR SUPABASE
-- Run this script inside the Supabase SQL Editor to create
-- all necessary tables and configure Row Level Security (RLS).
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL,
    username TEXT PRIMARY KEY, -- Nomor WhatsApp / Phone / Unique ID
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer', -- customer, mekanik, sparepart, cro, manager, admin, owner, display, warranty
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active, rejected
    otp TEXT,
    plat_bk TEXT, -- Plat Kendaraan Customer
    vin TEXT, -- VIN / Nomor Rangka
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT,
    "lastIP" TEXT DEFAULT '-',
    "lastLocation" TEXT DEFAULT '-',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ANTRIAN TABLE (Active Workshop Queue)
CREATE TABLE IF NOT EXISTS public.antrian (
    id BIGINT PRIMARY KEY, -- Timestamp ID
    "noPlat" TEXT, -- Plat BK
    "tipeMobil" TEXT, -- Model mobil
    category TEXT DEFAULT 'Reguler', -- Reguler, Booking, Warranty
    "keluhanDetail" TEXT,
    "mechanicName" TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, working, istirahat, menginap, completed
    "estimasiDefault" INTEGER DEFAULT 0, -- Estimasi waktu dalam detik
    "addedBy" TEXT DEFAULT '',
    checklist JSONB DEFAULT '[]'::jsonb NOT NULL,
    menginap_reason TEXT DEFAULT '',
    "waktuSelesai" TEXT DEFAULT '',
    "targetTime" BIGINT DEFAULT 0,
    "Tanggal" TEXT,
    jam INTEGER,
    "noTelp" TEXT,
    "pendingExtra" JSONB DEFAULT NULL,
    "elapsedSeconds" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. HISTORY TABLE (Finished Queue Items)
CREATE TABLE IF NOT EXISTS public.history (
    id BIGINT PRIMARY KEY,
    "noPlat" TEXT,
    "tipeMobil" TEXT,
    category TEXT DEFAULT 'Reguler',
    "keluhanDetail" TEXT,
    "mechanicName" TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'completed',
    "estimasiDefault" INTEGER DEFAULT 0,
    "addedBy" TEXT DEFAULT '',
    checklist JSONB DEFAULT '[]'::jsonb NOT NULL,
    menginap_reason TEXT DEFAULT '',
    "waktuSelesai" TEXT DEFAULT '',
    "targetTime" BIGINT DEFAULT 0,
    "Tanggal" TEXT,
    jam INTEGER,
    "noTelp" TEXT,
    "pendingExtra" JSONB DEFAULT NULL,
    "elapsedSeconds" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. BOOKING TABLE (Customer Bookings)
CREATE TABLE IF NOT EXISTS public.booking (
    id BIGSERIAL PRIMARY KEY,
    "noPlat" TEXT,
    "tipeMobil" TEXT,
    category TEXT DEFAULT 'Reguler',
    "keluhanDetail" TEXT,
    "Tanggal" TEXT NOT NULL,
    jam TEXT NOT NULL,
    "noTelp" TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CRO TABLE (Customer Relation Officer followup)
CREATE TABLE IF NOT EXISTS public.cro (
    id BIGSERIAL PRIMARY KEY,
    "workOrderNo" TEXT UNIQUE NOT NULL,
    nama TEXT DEFAULT '-',
    telepon TEXT DEFAULT '-',
    vin TEXT DEFAULT '-',
    plat TEXT DEFAULT '-',
    "serviceAdvisor" TEXT DEFAULT '-',
    "tipeMobil" TEXT DEFAULT '-',
    deskripsi TEXT DEFAULT '',
    "tanggalDatang" TEXT DEFAULT '', -- Format DD-MM-YYYY
    status TEXT DEFAULT 'Belum', -- Belum, Sudah, dsb
    respon TEXT DEFAULT '',
    lampiran TEXT DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. LIBUR TABLE (Dealer Holidays)
CREATE TABLE IF NOT EXISTS public.libur (
    id BIGSERIAL PRIMARY KEY,
    date TEXT UNIQUE NOT NULL, -- Format YYYY-MM-DD
    note TEXT DEFAULT 'Libur Dealer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'owner',
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. REVENUE TABLE (Imported Financial Audit Data)
CREATE TABLE IF NOT EXISTS public.revenue (
    no_wo TEXT PRIMARY KEY,
    tipe_kendaraan TEXT,
    sa TEXT,
    mekanik TEXT,
    leader TEXT,
    wkt_masuk DATE,
    jasa NUMERIC DEFAULT 0,
    s_part NUMERIC DEFAULT 0,
    g_total NUMERIC DEFAULT 0,
    nohp TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. LAPORANWO TABLE (Imported DMS WO Tracking Report)
CREATE TABLE IF NOT EXISTS public.laporanwo (
    "No. WO" TEXT PRIMARY KEY,
    "No. WO DMS" TEXT,
    "Status" TEXT,
    "No. Pol" TEXT,
    "No. Rangka" TEXT,
    "Kode Tipe" TEXT,
    "Kendaraan" TEXT,
    "Nama Invoice" TEXT,
    "Pembawa" TEXT,
    "KM Masuk" NUMERIC,
    "Wkt.Masuk" TEXT,
    "Wkt.Estimasi" TEXT,
    "Wkt.Setuju Estimasi" TEXT,
    "Wkt.Mulai" TEXT,
    "Wkt.Selesai" TEXT,
    "Wkt.Tutup" TEXT,
    "SA" TEXT,
    "Mekanik" TEXT,
    "Leader" TEXT,
    "LC" NUMERIC DEFAULT 0,
    "Oli" NUMERIC DEFAULT 0,
    "SM" NUMERIC DEFAULT 0,
    "SO" NUMERIC DEFAULT 0,
    "Penjualan" NUMERIC DEFAULT 0,
    "S. Part" NUMERIC DEFAULT 0,
    "TOTAL" NUMERIC DEFAULT 0,
    "PPN" NUMERIC DEFAULT 0,
    "G.TOTAL" NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. SPAREPART TABLE (Logistics Order Management)

-- 12. CUSTOMERS TABLE (Separate from users for security isolation)
CREATE TABLE IF NOT EXISTS public.customers (
    id BIGSERIAL PRIMARY KEY,
    no_hp TEXT UNIQUE NOT NULL, -- Nomor WhatsApp sebagai username/login
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    vin TEXT DEFAULT '', -- VIN / Nomor Rangka
    no_bk TEXT DEFAULT '', -- Nomor Plat Kendaraan
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active
    otp TEXT,
    otp_expires_at TIMESTAMP WITH TIME ZONE, -- Waktu kadaluwarsa OTP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.sparepart (
    "Handling order number" TEXT PRIMARY KEY,
    "submission time" TEXT,
    founder TEXT,
    "processing time" TEXT,
    "order notes" TEXT,
    items TEXT, -- JSON string of items
    status TEXT DEFAULT 'pending', -- pending, partial, arrived, confirmed
    "arrivedTime" TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 12. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antrian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporanwo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sparepart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. DEFINE RLS POLICIES FOR SECURE BYPASS (SERVICE ROLE ONLY)
-- Anonymous connections cannot read or write data directly.
-- ============================================================
DROP POLICY IF EXISTS "deny_all_anon" ON public.users;
DROP POLICY IF EXISTS "deny_all_anon" ON public.settings;
DROP POLICY IF EXISTS "deny_all_anon" ON public.antrian;
DROP POLICY IF EXISTS "deny_all_anon" ON public.history;
DROP POLICY IF EXISTS "deny_all_anon" ON public.booking;
DROP POLICY IF EXISTS "deny_all_anon" ON public.cro;
DROP POLICY IF EXISTS "deny_all_anon" ON public.libur;
DROP POLICY IF EXISTS "deny_all_anon" ON public.notifications;
DROP POLICY IF EXISTS "deny_all_anon" ON public.revenue;
DROP POLICY IF EXISTS "deny_all_anon" ON public.laporanwo;
DROP POLICY IF EXISTS "deny_all_anon" ON public.sparepart;
DROP POLICY IF EXISTS "deny_all_anon" ON public.customers;

CREATE POLICY "deny_all_anon" ON public.users FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.settings FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.antrian FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.history FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.booking FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.cro FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.libur FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.notifications FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.revenue FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.laporanwo FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.sparepart FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon" ON public.customers FOR ALL USING (false) WITH CHECK (false);

-- 13. SALES TABLE (SPV/Sales User Management)
CREATE TABLE IF NOT EXISTS public.sales (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'sales',
    spv TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_anon" ON public.sales;
CREATE POLICY "deny_all_anon" ON public.sales FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- 14. ALTER TABLE UPGRADES FOR EXISTING DATABASES
-- Run these if you already have the tables created and only
-- need to add the new columns/configurations:
-- ============================================================
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS otp TEXT;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plat_bk TEXT;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vin TEXT;
-- ALTER TABLE public.cro ADD COLUMN IF NOT EXISTS lampiran TEXT DEFAULT '[]';
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS otp_resend_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 15. ANTRIAN CALLING SYSTEM UPGRADE
-- Tambahkan kolom untuk fitur panggilan antrian + nomor antrian
-- ============================================================
-- ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS queue_number INTEGER DEFAULT 0;
-- ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS is_called BOOLEAN DEFAULT false;
-- ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS called_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE public.antrian ADD COLUMN IF NOT EXISTS counter INTEGER DEFAULT 0;

-- ============================================================
-- 16. PUSH SUBSCRIPTIONS TABLE (Web Push Notification)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    plat TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_plat ON public.push_subscriptions(plat);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Allow anon to insert/delete for their own subscriptions (authenticated by no secret data)
CREATE POLICY "anon_insert_push_sub" ON public.push_subscriptions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_push_sub" ON public.push_subscriptions FOR DELETE TO anon USING (true);

-- ============================================================
-- 17. FREE MAINTENANCE WARRANTY TABLE
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
ALTER TABLE public.free_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_anon" ON public.free_maintenance FOR ALL USING (false) WITH CHECK (false);

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
ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON public.stock_opname FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_access_simplification" ON public.stock_opname FOR ALL TO anon USING (true) WITH CHECK (true);


