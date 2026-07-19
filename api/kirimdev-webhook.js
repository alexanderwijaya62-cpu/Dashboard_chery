import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Kirimdev webhook: Meta passthrough format
// Header: X-Kirim-Event = message.received
// Header: X-Kirim-Signature = t=<timestamp>,v1=<hmac-hex>
// Body: entry[0].changes[0].value.messages[0]

const WEBHOOK_SECRET = (process.env.KIRIM_WEBHOOK_SECRET || '').replace(/^whsec_/, '');

function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET || !signatureHeader) return !WEBHOOK_SECRET; // skip if no secret configured

  const parts = {};
  signatureHeader.split(',').forEach(p => {
    const [k, v] = p.split('=');
    if (k && v) parts[k] = v;
  });

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kirim-Signature, X-Kirim-Event');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Capture raw body for HMAC verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf-8');

  // Verify HMAC signature
  const signature = req.headers['x-kirim-signature'];
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    console.error('Kirimdev webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-kirim-event'];

  // Only handle incoming messages
  if (event !== 'message.received') {
    return res.status(200).json({ ok: true, skipped: true, event });
  }

  try {
    const body = JSON.parse(rawBody);
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages || [];
    const message = messages[0];

    if (!message) {
      return res.status(200).json({ ok: true, no_message: true });
    }

    // Only handle text messages
    if (message.type !== 'text') {
      return res.status(200).json({ ok: true, skipped: true, type: message.type });
    }

    const sender = (message.from || '').replace(/[^\d]/g, '');
    const text = (message.text?.body || '').trim();

    if (!sender || !text) {
      return res.status(200).json({ ok: true, empty: true });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Normalize phone formats
    const formats = [sender];
    if (sender.startsWith('62')) formats.push('0' + sender.slice(2));
    if (sender.startsWith('0')) formats.push('62' + sender.slice(1));

    // Find pending customer with matching OTP
    const { data: customer } = await supabase
      .from('customers')
      .select('id, no_hp, otp_expires_at')
      .in('no_hp', formats)
      .eq('otp', text)
      .eq('status', 'pending')
      .maybeSingle();

    if (!customer) {
      return res.status(200).json({ matched: false, reason: 'not_found' });
    }

    if (customer.otp_expires_at && new Date(customer.otp_expires_at) < new Date()) {
      return res.status(200).json({ matched: false, reason: 'expired' });
    }

    // Activate account
    await supabase
      .from('customers')
      .update({ status: 'active', otp: null, otp_expires_at: null })
      .eq('id', customer.id);

    try {
      await supabase.from('notifications').insert({
        type: 'registration_active',
        message: `Akun pelanggan aktif via WA: ${customer.no_hp}`,
        target_role: 'owner',
        read: false,
      });
    } catch (_) {}

    return res.status(200).json({ matched: true, no_hp: customer.no_hp });
  } catch (err) {
    console.error('Kirimdev webhook error:', err.message);
    return res.status(200).json({ error: err.message });
  }
}
