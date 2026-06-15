-- ============================================================
-- Enable RLS on ALL tables and DENY all for anon key
-- Semua operasi database sekarang via api/db.js (service_role)
-- ============================================================

-- Enable RLS on each table
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

-- Revoke ALL for anon key (public) on ALL tables
-- service_role key bypasses RLS, so this won't break server-side API
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

-- Note: Realtime subscriptions (supabase.channel) still work
-- because realtime uses a separate permission system.
