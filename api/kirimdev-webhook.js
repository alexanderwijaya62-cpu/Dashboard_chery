import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Kirimdev webhook — terima & kirim pesan aja

const WEBHOOK_SECRET = (process.env.KIRIM_WEBHOOK_SECRET || '').replace(/^whsec_/, '');

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET || !signatureHeader) return !WEBHOOK_SECRET;

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

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kirim-Signature, X-Kirim-Event');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = webhook verification
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge;
    if (challenge) {
      console.log('Webhook verified:', challenge);
      return res.status(200).send(challenge);
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf-8');

  // Verify HMAC
  const signature = req.headers['x-kirim-signature'];
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    console.error('Kirimdev: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const body = JSON.parse(rawBody);
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    const msg = messages[0];

    if (!msg) return res.status(200).json({ ok: true, no_message: true });

    const sender = (msg.from || '').replace(/[^\d]/g, '');
    const text = (msg.text?.body || '').trim();
    const supabase = getSupabase();

    console.log(`WA received from ${sender}: ${text}`);

    // OTP match → activate account
    if (msg.type === 'text' && text && sender) {
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

      if (customer && (!customer.otp_expires_at || new Date(customer.otp_expires_at) >= new Date())) {
        await supabase
          .from('customers')
          .update({ status: 'active', otp: null, otp_expires_at: null })
          .eq('id', customer.id);

        return res.status(200).json({ matched: true, activated: true });
      }
    }

    return res.status(200).json({ ok: true, received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(200).json({ ok: true });
  }
}
