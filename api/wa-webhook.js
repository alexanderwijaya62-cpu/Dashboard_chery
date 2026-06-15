import { createClient } from '@supabase/supabase-js';

const WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET || 'rahasia123';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  const { sender, text, secret, instanceId } = req.body || {};

  if (secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!sender || !text) {
    return res.status(400).json({ error: 'sender and text required' });
  }

  const cleanSender = sender.replace(/\D/g, '');
  const cleanText = text.trim();

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

    await supabase
      .from('customers')
      .update({ status: 'active', otp: null })
      .eq('id', customer.id);

    await supabase
      .from('notifications')
      .insert({
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
