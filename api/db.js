import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = ['users','settings','antrian','history','booking','cro','libur','notifications','revenue','laporanwo','sparepart','customers','push_subscriptions','sparepart_master','sparepart_revenue'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  const { table, action, data, filters } = body;

  if (!table || !action) return res.status(400).json({ error: 'table and action required' });
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });

  // ── Authentication Check ──
  const isPublicBooking = table === 'booking' && action === 'insert';
  const isPublicLibur = table === 'libur' && action === 'select';
  const isPublicSettings = table === 'settings' && action === 'select';
  const isPublicRegister = table === 'customers' && (action === 'insert' || action === 'select' || action === 'update');
  const isPublicNotification = table === 'notifications' && action === 'insert';
  const isPublicPush = table === 'push_subscriptions';

  const isPublic = isPublicBooking || isPublicLibur || isPublicSettings || isPublicRegister || isPublicNotification || isPublicPush;

  if (!isPublic) {
    if (!authUsername || !authSessionId) {
      return res.status(401).json({ error: 'Authentication required. Missing headers.' });
    }

    // Verify session in users table
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('username, sessionId, status')
      .eq('username', authUsername)
      .eq('sessionId', authSessionId)
      .maybeSingle();

    if (userErr || !userRecord || userRecord.status !== 'active') {
      // Also check customer table for active customer account (inbound tracking or feedback)
      const { data: customerRecord, error: custErr } = await supabase
        .from('customers')
        .select('no_hp, sessionId, status')
        .eq('no_hp', authUsername)
        .eq('sessionId', authSessionId)
        .maybeSingle();

      if (custErr || !customerRecord || customerRecord.status !== 'active') {
        return res.status(401).json({ error: 'Invalid or expired session' });
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
        case 'order': q = q.order(f.column, { ascending: f.ascending ?? true, nullsFirst: f.nullsFirst ?? false }); break;
        case 'limit': q = q.limit(f.value); break;
        case 'range': q = q.range(f.from, f.to); break;
        case 'gte': q = q.gte(f.column, f.value); break;
        case 'lte': q = q.lte(f.column, f.value); break;
        case 'gt': q = q.gt(f.column, f.value); break;
        case 'lt': q = q.lt(f.column, f.value); break;
        case 'like': q = q.like(f.column, f.value); break;
        case 'ilike': q = q.ilike(f.column, f.value); break;
        case 'is': q = q.is(f.column, f.value); break;
        case 'in': q = q.in(f.column, f.value); break;
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
    let q = supabase.from(table);
    let result;

    switch (action) {
      case 'select': {
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

          // Baca slotCapacity dari settings
          let slotCapacity = 1;
          const { data: capSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'booking_slot_capacity')
            .maybeSingle();
          if (capSetting?.value) slotCapacity = parseInt(capSetting.value, 10) || 1;

          const { data: conflicts, error: conflictErr } = await supabase
            .from('booking')
            .select('id')
            .eq('tanggal', tanggal)
            .eq('jam', jam)
            .in('status', activeStatuses);
          if (conflictErr) throw conflictErr;
          if (conflicts && conflicts.length >= slotCapacity) {
            return res.status(409).json({
              error: `Slot jam ${jam} pada tanggal ${tanggal} sudah terisi${slotCapacity > 1 ? ' penuh' : ''}`,
              code: 'SLOT_CONFLICT'
            });
          }
        }
        // H1: Whitelist kolom untuk booking publik
        if (table === 'booking' && action === 'insert' && isPublic) {
          const allowed = ['id', 'noUrut', 'tanggal', 'jam', 'noPlat', 'namaCustomer', 'noTelp', 'keperluanService', 'ip_address', 'bookingVia', 'tipeMobil', 'status'];
          const safe = {};
          const raw = data?.values || data;
          for (const k of allowed) { if (raw[k] !== undefined) safe[k] = raw[k]; }
          q = q.insert(safe);
        } else {
          q = q.insert(data?.values || data);
        }
        result = await q.select();
        break;
      }
      case 'update': {
        // K2: Whitelist kolom untuk customers update publik
        let updateValues = data?.values || data;
        if (table === 'customers' && isPublic) {
          const allowed = ['nama', 'no_bk', 'vin', 'password'];
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
    return res.status(500).json({ error: error.message, code: error.code || null, details: error.details || null });
  }
}
