import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const WA_WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET || process.env.KUNCI || 'rahasia123';
  const receivedSecret = body.secret || body.webhook_secret || '';

  if (receivedSecret !== WA_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const sender = (body.sender || body.from || '').replace(/[^\d]/g, '');
  const text = (body.text || body.message || body.body || '').trim();

  if (!sender || !text) {
    return res.status(400).json({ error: 'sender and text required' });
  }

  // Respond dulu biar VPS gak timeout
  res.json({ success: true, message: 'processing' });

  // Proses DB di background (respond udah dikirim)
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const formats = [sender];
    if (sender.startsWith('62')) formats.push('0' + sender.slice(2));
    if (sender.startsWith('0')) formats.push('62' + sender.slice(1));

    const { data: customer } = await supabase
      .from('customers')
      .select('id, no_hp, otp_expires_at')
      .in('no_hp', formats)
      .eq('otp', text)
      .eq('status', 'pending')
      .maybeSingle();

    if (!customer) return;
    if (customer.otp_expires_at && new Date(customer.otp_expires_at) < new Date()) return;

    await supabase
      .from('customers')
      .update({ status: 'active', otp: null, otp_expires_at: null })
      .eq('id', customer.id);

    await supabase
      .from('notifications')
      .insert({
        type: 'registration_active',
        message: `Akun pelanggan aktif via WA: ${customer.no_hp}`,
        target_role: 'owner',
        read: false,
      })
      .catch(() => {});
  } catch (err) {
    console.error('Webhook bg error:', err.message);
  }
}
