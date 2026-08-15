-- ============================================================
-- TRACK SIAPA YANG MENGHAPUS BOOKING (Riwayat Hapus Booking)
-- 1) Tambah kolom audit di tabel booking (soft delete)
-- 2) Jangan blokir slot saat booking ber-status 'deleted'
-- ============================================================

ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT '';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS deleted_by_role TEXT DEFAULT '';
ALTER TABLE public.booking ADD COLUMN IF NOT EXISTS deleted_at TEXT DEFAULT '';

-- Slot tanggal+jam harus bisa dipakai lagi setelah booking dihapus
DROP INDEX IF EXISTS idx_booking_unique_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_unique_active_slot
ON public.booking (tanggal, jam)
WHERE status NOT IN ('declined', 'cancelled', 'no_show', 'deleted');

DROP INDEX IF EXISTS idx_booking_active_slot;
CREATE INDEX IF NOT EXISTS idx_booking_active_slot
ON public.booking (tanggal, jam)
WHERE status NOT IN ('declined', 'cancelled', 'no_show', 'deleted');

NOTIFY pgrst, 'reload schema';
