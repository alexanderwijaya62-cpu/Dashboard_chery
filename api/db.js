import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = ['users','settings','antrian','history','booking','cro','libur','notifications','revenue','laporanwo','sparepart','customers'];

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
    if (!body.sender || !body.text) {
      return res.status(400).json({ error: 'sender and text required' });
    }

    const cleanSender = body.sender.replace(/\D/g, '');
    const cleanText = body.text.trim();

    try {
      const { data: customers, error: findErr } = await supabase
        .from('customers')
        .select('id, no_hp, otp, status')
        .eq('no_hp', cleanSender)
        .eq('status', 'pending')
        .limit(1);

      if (findErr) throw findErr;
      if (!customers || customers.length === 0) {
        return res.json({ matched: false, reason: 'no_pending_customer' });
      }

      const customer = customers[0];
      if (customer.otp !== cleanText) {
        return res.json({ matched: false, reason: 'otp_mismatch' });
      }

      await supabase.from('customers').update({ status: 'active', otp: null }).eq('id', customer.id);
      await supabase.from('notifications').insert({
        type: 'registration_active',
        message: `Akun pelanggan aktif via WA: ${cleanSender}`,
        target_role: 'owner',
        read: false
      });

      return res.json({ matched: true, no_hp: cleanSender });
    } catch (error) {
      console.error('Webhook Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  const { table, action, data, filters } = body;

  if (!table || !action) return res.status(400).json({ error: 'table and action required' });
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });

  function applyFilters(q, filters) {
    if (!filters || !Array.isArray(filters)) return q;
    for (const f of filters) {
      switch (f.op) {
        case 'eq': q = q.eq(f.column, f.value); break;
        case 'neq': q = q.neq(f.column, f.value); break;
        case 'in': q = q.in(f.column, f.values); break;
        case 'order': q = q.order(f.column, { ascending: f.ascending ?? true, nullsFirst: f.nullsFirst ?? false }); break;
        case 'limit': q = q.limit(f.value); break;
        case 'gte': q = q.gte(f.column, f.value); break;
        case 'lte': q = q.lte(f.column, f.value); break;
        case 'like': q = q.like(f.column, f.value); break;
        case 'ilike': q = q.ilike(f.column, f.value); break;
        case 'is': q = q.is(f.column, f.value); break;
      }
    }
    return q;
  }

  try {
    let q = supabase.from(table);
    let result;

    switch (action) {
      case 'select': {
        q = q.select(data?.select || '*');
        if (data?.maybeSingle) { q = q.maybeSingle(); }
        else if (data?.single) q = q.single();
        q = applyFilters(q, filters);
        result = await q;
        break;
      }
      case 'insert': {
        q = q.insert(data?.values || data);
        result = await q.select();
        break;
      }
      case 'update': {
        q = q.update(data?.values || data);
        q = applyFilters(q, filters);
        if (data?.select) q = q.select();
        result = await q;
        break;
      }
      case 'delete': {
        q = q.delete();
        q = applyFilters(q, filters);
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

    if (result?.error) throw result.error;
    return res.json({ data: result?.data ?? null, count: result?.count ?? null });
  } catch (error) {
    console.error(`DB Error [${table}/${action}]:`, error.message);
    return res.status(500).json({ error: error.message, code: error.code || null, details: error.details || null });
  }
}
