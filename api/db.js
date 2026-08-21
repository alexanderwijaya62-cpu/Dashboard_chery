import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = ['users','settings','antrian','history','booking','cro','libur','notifications','revenue','laporanwo','sparepart','customers','push_subscriptions','sparepart_master','sparepart_revenue','sales','free_maintenance','stock_opname','partshop_estimations'];

// Default columns per table — cegah over-fetching saat client kirim select: '*'
const DEFAULT_COLUMNS = {
  booking: 'id,tanggal,jam,status,noPlat,namaCustomer,tipeMobil,keperluanService,noTelp,bookingVia,vin,noUrut,ip_address,keluhanDetail,deleted_by,deleted_by_role,deleted_at',
  antrian: '*',
  history: 'id,bk,tipe,status,waktuMasuk,waktuSelesai,category,mechanicName,nama_sa',
  customers: 'id,no_hp,nama,no_bk,vin,status',
  users: 'id,username,name,role,status',
  settings: 'key,value',
  notifications: 'id,type,message,target_role,read,created_at',
  cro: 'id,"workOrderNo",nama,telepon,vin,plat,status,"tanggalDatang"',
  revenue: '*',
  laporanwo: '*',
  sparepart: '*',
  sparepart_master: '*',
  sparepart_revenue: '*',
  libur: '*',
  push_subscriptions: '*',
  free_maintenance: '*',
  stock_opname: '*',
  partshop_estimations: '*',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Username, X-Auth-Session-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uc2N5c3NoYXl0a3h2ZXplamFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTgsImV4cCI6MjA5MDM2MzUxOH0.CAOJg-k8le5wYi4b8xyGnZQQ31yaBTbDSncGOCVB93k';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nnscysshaytkxvezejae.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON || DEFAULT_ANON_KEY;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('DB: SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env — fallback ke anon key. Operasi yang terproteksi RLS (mis. import sparepart revenue) akan gagal.');
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server auth not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const body = req.body || {};

  // ── WA Webhook: verify OTP from incoming message ──
  if (body.secret) {
    const webhookSecret = process.env.WA_WEBHOOK_SECRET || 'rahasia123';
    if (body.secret !== webhookSecret) {
      return res.status(401).json({ error: 'Invalid secret' });
    }
    if (!body.text) {
      return res.status(400).json({ error: 'text required' });
    }

    const cleanText = body.text.trim();
    const cleanSender = (body.sender || '').replace(/[^\d]/g, '');

    try {
      let customer = null;

      // Match berdasarkan nomor pengirim + OTP (dengan normalisasi format)
      if (cleanSender) {
        // Sender dari WhatsApp biasanya format internasional: 62812xxx
        // Tapi no_hp di DB bisa disimpan sebagai 0812xxx atau 62812xxx
        const formats = [cleanSender];
        if (cleanSender.startsWith('62')) {
          formats.push('0' + cleanSender.slice(2));
        }
        if (cleanSender.startsWith('0')) {
          formats.push('62' + cleanSender.slice(1));
        }

        const { data: byNumber } = await supabase
          .from('customers')
          .select('id, no_hp, otp_expires_at')
          .in('no_hp', formats)
          .eq('otp', cleanText)
          .eq('status', 'pending')
          .maybeSingle();

        if (byNumber) {
          // Cek masa berlaku OTP
          if (byNumber.otp_expires_at && new Date(byNumber.otp_expires_at) < new Date()) {
            return res.json({ matched: false, reason: 'expired' });
          }
          customer = byNumber;
        }
      }

      // TIDAK ada fallback OTP-only — hanya aktivasi jika nomor pengirim cocok
      if (!customer) {
        return res.json({ matched: false, reason: 'not_found' });
      }

      await supabase.from('customers').update({ status: 'active', otp: null }).eq('id', customer.id);
      await supabase.from('notifications').insert({
        type: 'registration_active',
        message: `Akun pelanggan aktif via WA: ${customer.no_hp}`,
        target_role: 'owner',
        read: false
      });

      return res.json({ matched: true, no_hp: customer.no_hp });
    } catch (error) {
      console.error('Webhook Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  const authUsername = req.headers['x-auth-username'] || '';
  const authSessionId = req.headers['x-auth-session-id'] || '';

  const { table, action, filters } = body;
  let data = body.data || {};

  if (!table || !action) return res.status(400).json({ error: 'table and action required' });
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });

  // ── Authentication Check ──
  // ── Public Access (no auth required) ──
  const isPublicLibur = table === 'libur' && action === 'select';
  const isPublicRegister = table === 'customers' && (action === 'insert' || action === 'select' || action === 'update');
  const isPublicNotification = table === 'notifications' && action === 'insert';
  const isPublicPush = table === 'push_subscriptions';
  const isPublicFreeMaintenance = table === 'free_maintenance';

  const isPublic = isPublicLibur || isPublicRegister || isPublicNotification || isPublicPush || isPublicFreeMaintenance;

  // Booking requires login — no public bypass
  const requiresAuth = !isPublic;

  if (requiresAuth) {
    if (!authUsername || !authSessionId) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk melakukan booking.' });
    }

    // Single query — cek users, customers, DAN sales dalam 1 request
    const { data: userRecord } = await supabase
      .from('users')
      .select('username, status')
      .eq('username', authUsername)
      .eq('sessionId', authSessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (!userRecord) {
      const { data: customerRecord } = await supabase
        .from('customers')
        .select('no_hp, status')
        .eq('no_hp', authUsername)
        .eq('sessionId', authSessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (!customerRecord) {
        const { data: salesRecord } = await supabase
          .from('sales')
          .select('username, status')
          .eq('username', authUsername)
          .eq('status', 'active')
          .maybeSingle();

        if (!salesRecord) {
          return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
        }
      }
    }
  }

  function applyFilters(q, filters) {
    if (!filters || !Array.isArray(filters)) return q;
    for (const f of filters) {
      switch (f.op) {
        case 'eq': q = q.eq(f.column, f.value); break;
        case 'neq': q = q.neq(f.column, f.value); break;
        case 'in': q = q.in(f.column, f.values); break;
        case 'order': {
          // Kolom dengan spasi/titik (mis. 'Wkt.Masuk') wajib di-quote agar PostgREST bisa parse
          const orderCol = /[\s.]/.test(f.column) ? `"${f.column}"` : f.column;
          q = q.order(orderCol, { ascending: f.ascending ?? true, nullsFirst: f.nullsFirst ?? false });
          break;
        }
        case 'limit': q = q.limit(f.value); break;
        case 'range': q = q.range(f.from, f.to); break;
        case 'gte': q = q.gte(f.column, f.value); break;
        case 'lte': q = q.lte(f.column, f.value); break;
        case 'gt': q = q.gt(f.column, f.value); break;
        case 'lt': q = q.lt(f.column, f.value); break;
        case 'like': q = q.like(f.column, f.value); break;
        case 'ilike': q = q.ilike(f.column, f.value); break;
        case 'is': q = q.is(f.column, f.value); break;
        case 'or': {
          const conditions = f.conditions || [];
          const orParts = conditions.map(c => {
            if (c.op === 'eq') return `${c.column}.eq.${c.value}`;
            if (c.op === 'gte') return `${c.column}.gte.${c.value}`;
            if (c.op === 'lte') return `${c.column}.lte.${c.value}`;
            if (c.op === 'lt') return `${c.column}.lt.${c.value}`;
            if (c.op === 'gt') return `${c.column}.gt.${c.value}`;
            if (c.op === 'neq') return `${c.column}.neq.${c.value}`;
            if (c.op === 'like') return `${c.column}.like.${c.value}`;
            if (c.op === 'ilike') return `${c.column}.ilike.${c.value}`;
            return '';
          }).filter(Boolean);
          if (orParts.length > 0) q = q.or(orParts.join(','));
          break;
        }
      }
    }
    return q;
  }

  try {
    if (table === 'booking') {
      await cleanPastBookings(supabase);
    }
    let q = supabase.from(table);
    let result;

    switch (action) {
      case 'select': {
        // Whitelist kolom untuk customers select publik
        if (table === 'customers' && isPublic) {
          const allowed = ['no_hp', 'status', 'id', 'no_bk', 'nama'];
          const requested = data?.select || '*';
          if (requested === '*') {
            data = { ...data, select: allowed.join(',') };
          } else {
            const cols = requested.split(',').map(c => c.trim());
            const filtered = cols.filter(c => allowed.includes(c));
            data = { ...data, select: filtered.length > 0 ? filtered.join(',') : 'id' };
          }
        }
        // Smart select: kalau client kirim '*', pakai DEFAULT_COLUMNS yang lebih efisien
        else if (table in DEFAULT_COLUMNS) {
          const requested = data?.select || '*';
          if (requested === '*') {
            data = { ...data, select: DEFAULT_COLUMNS[table] };
          } else {
            const allowed = DEFAULT_COLUMNS[table].split(',').map(c => c.trim());
            const cols = requested.split(',').map(c => c.trim());
            if (DEFAULT_COLUMNS[table] !== '*') {
              const filtered = cols.filter(c => allowed.includes(c));
              data = { ...data, select: filtered.length > 0 ? filtered.join(',') : 'id' };
            }
          }
        }
        const headOnly = data?.head === true;
        q = q.select(data?.select || '*', { count: 'exact', head: headOnly });
        if (!headOnly) {
          if (data?.maybeSingle) { q = q.maybeSingle(); }
          else if (data?.single) q = q.single();
        }
        q = applyFilters(q, filters);
        result = await q;
        break;
      }
      case 'insert': {
        // #1: Server-side double-booking prevention for booking table
        if (table === 'booking' && data?.values?.tanggal && data?.values?.jam) {
          const { tanggal, jam } = data.values;
          const activeStatuses = ['waiting_approval', 'waiting confirm', 'accepted', 'completed'];

          const isSat = new Date(tanggal).getDay() === 6;
          const capKey = isSat ? 'booking_sat_slot_capacity' : 'booking_slot_capacity';

          // Baca slotCapacity dari settings (sesuai hari biasa / sabtu)
          let slotCapacity = 2;
          const { data: capSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', capKey)
            .maybeSingle();
          if (capSetting?.value) slotCapacity = parseInt(capSetting.value, 10) || 2;

          const jamDot = String(jam).replace(':', '.');
          const jamColon = String(jam).replace('.', ':');

          const { data: conflicts, error: conflictErr } = await supabase
            .from('booking')
            .select('id')
            .eq('tanggal', tanggal)
            .in('jam', [jamDot, jamColon])
            .in('status', activeStatuses);
          if (conflictErr) throw conflictErr;
          if (conflicts && conflicts.length >= slotCapacity) {
            return res.status(409).json({
              error: `Slot jam ${jam} pada tanggal ${tanggal} sudah terisi${slotCapacity > 1 ? ' penuh' : ''}`,
              code: 'SLOT_CONFLICT'
            });
          }
        }
        // Whitelist kolom untuk booking insert (auth required)
        if (table === 'booking' && action === 'insert') {
          const bAllowed = ['id', 'noUrut', 'tanggal', 'jam', 'noPlat', 'namaCustomer', 'noTelp', 'keperluanService', 'ip_address', 'bookingVia', 'tipeMobil', 'status', 'vin', 'keluhanDetail'];
          const bSafe = {};
          const bRaw = data?.values || data;
          for (const k of bAllowed) { if (bRaw[k] !== undefined) bSafe[k] = bRaw[k]; }
          q = q.insert(bSafe);
        } else if (table === 'customers' && action === 'insert' && isPublic) {
          const cAllowed = ['id', 'no_hp', 'password', 'nama', 'no_bk', 'status', 'otp', 'otp_expires_at'];
          const cSafe = {};
          const cRaw = data?.values || data;
          for (const k of cAllowed) { if (cRaw[k] !== undefined) cSafe[k] = cRaw[k]; }
          q = q.insert(cSafe);
        } else {
          q = q.insert(data?.values || data);
        }
        result = await q.select();
        break;
      }
      case 'update': {
        // Whitelist kolom untuk customers update publik
        let updateValues = data?.values || data;
        if (table === 'customers' && isPublic) {
          const allowed = ['nama', 'no_bk', 'vin', 'status', 'otp', 'otp_expires_at', 'password'];
          const safe = {};
          for (const k of allowed) { if (updateValues[k] !== undefined) safe[k] = updateValues[k]; }
          updateValues = safe;
        }
        // Whitelist kolom untuk booking update (reschedule only)
        if (table === 'booking') {
          const allowed = ['jam', 'tanggal', 'status', 'bookingVia', 'keluhanDetail', 'noPlat', 'namaCustomer', 'noTelp', 'tipeMobil', 'keperluanService', 'deleted_by', 'deleted_by_role', 'deleted_at'];
          const safe = {};
          for (const k of allowed) { if (updateValues[k] !== undefined) safe[k] = updateValues[k]; }
          updateValues = safe;
        }
        q = q.update(updateValues);
        q = applyFilters(q, filters);
        if (data?.select) q = q.select();
        result = await q;
        break;
      }
      case 'delete': {
        // Booking: soft delete + audit siapa yang menghapus (Riwayat Hapus Booking)
        if (table === 'booking') {
          let who = 'System';
          let role = '';
          const { data: auditor } = await supabase
            .from('users')
            .select('name, role')
            .eq('username', authUsername)
            .maybeSingle();
          if (auditor) {
            who = auditor.name;
            role = auditor.role;
          } else {
            // Check sales table
            const { data: salesAuditor } = await supabase
              .from('sales')
              .select('name, role')
              .eq('username', authUsername)
              .maybeSingle();
            if (salesAuditor) {
              who = salesAuditor.name;
              role = salesAuditor.role || 'sales';
            } else {
              // Check customers table
              const { data: custAuditor } = await supabase
                .from('customers')
                .select('nama')
                .eq('no_hp', authUsername)
                .maybeSingle();
              if (custAuditor) {
                who = custAuditor.nama;
                role = 'customer';
              } else {
                who = authUsername || 'System';
              }
            }
          }
          const nowWib = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
          q = supabase
            .from('booking')
            .update({
              status: 'deleted',
              deleted_by: who,
              deleted_by_role: role,
              deleted_at: nowWib,
            });
          if (filters && filters.length > 0) {
            q = applyFilters(q, filters);
          } else {
            q = q.not('id', 'is', null);
          }
          q = q.select();
          result = await q;
          break;
        }
        q = q.delete();
        if (filters && filters.length > 0) {
          q = applyFilters(q, filters);
        } else {
          q = q.not('id', 'is', null);
        }
        result = await q;
        break;
      }
      case 'upsert': {
        q = q.upsert(data?.values || data, data?.upsertOptions || { onConflict: data?.upsertOptions?.onConflict });
        result = await q.select();
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (result?.error) {
      if (result.error.code === '23505' && table === 'booking') {
        const errMsg = result.error.message || '';
        if (errMsg.includes('idx_anti_booking_ganda_final')) {
          const platStr = data?.values?.noPlat ? ` ${data.values.noPlat.toUpperCase()}` : '';
          return res.status(409).json({
            error: `Kendaraan dengan nomor plat${platStr} sudah memiliki booking aktif yang terdaftar. Silakan gunakan plat lain atau selesaikan booking sebelumnya.`,
            code: 'PLATE_CONFLICT'
          });
        }
        return res.status(409).json({
          error: `Slot jam ${data?.values?.jam || ''} pada tanggal ${data?.values?.tanggal || ''} sudah dipesan. Silahkan pilih jam lain.`,
          code: 'SLOT_CONFLICT'
        });
      }
      throw result.error;
    }
    return res.json({ data: result?.data ?? null, count: result?.count ?? null });
  } catch (error) {
    console.error(`DB Error [${table}/${action}]:`, error.message);
    let message = error.message || 'Internal server error';
    if (error.code === '42501' || /row-level security|violates row-level security/i.test(message)) {
      message = 'Akses ditolak oleh row-level security (RLS). SUPABASE_SERVICE_ROLE_KEY belum terisi di .env (lokal) atau Environment Variables (deployment). Ambil dari Supabase Dashboard > Settings > API > service_role key, isi lalu restart server.';
    }
    return res.status(500).json({ error: message, code: error.code || null, details: error.details || null });
  }
}

async function cleanPastBookings(supabase) {
  try {
    const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const y = nowWib.getFullYear();
    const m = String(nowWib.getMonth() + 1).padStart(2, '0');
    const d = String(nowWib.getDate()).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;

    // Delete bookings with date strictly in the past (1 day after the booking day passed)
    // Kecuali status 'deleted' — dipertahankan untuk Riwayat Hapus Booking
    await supabase
      .from('booking')
      .delete()
      .lt('tanggal', currentDateStr)
      .neq('status', 'deleted');
  } catch (e) {
    console.error('Failed to clean past bookings:', e);
  }
}
