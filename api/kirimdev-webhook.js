import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Kirimdev webhook — validate sender + OTP match

const WEBHOOK_SECRET = (process.env.KIRIM_WEBHOOK_SECRET || '').replace(/^whsec_/, '');

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function normalizePhone(raw) {
  let p = String(raw).replace(/[^\d]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
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

  // Verify HMAC (non-blocking for now — log only)
  const signature = req.headers['x-kirim-signature'] || req.headers['x-kirim-signature-v1'] || req.headers['x-hub-signature-256'] || req.headers['x-webhook-signature'];
  const allHeaders = Object.keys(req.headers || {});
  console.log('All headers:', allHeaders.join(', '));
  console.log('Signature value:', signature);
  console.log('Body length:', rawBody.length);
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    console.warn('Kirimdev: invalid signature (continuing anyway)');
  }

  try {
    const body = JSON.parse(rawBody);
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages || [];
    const msg = messages[0];

    if (!msg) return res.status(200).json({ ok: true, no_message: true });

    const sender = normalizePhone(msg.from || '');
    const text = (msg.text?.body || '').trim();
    const supabase = getSupabase();

    console.log(`WA from ${sender}: "${text}"`);

    // ── Step 1: validate sender exists in Supabase ──
    const senderFormats = [sender, sender.replace(/^62/, '0'), '0' + sender.slice(2)];

    const { data: customer } = await supabase
      .from('customers')
      .select('id, no_hp, status, otp, otp_expires_at, nama')
      .in('no_hp', senderFormats)
      .maybeSingle();

    if (!customer) {
      console.log(`Sender ${sender} not found in customers`);
      return res.status(200).json({ ok: true, unknown_sender: true });
    }

    // ── Step 2: OTP match for pending accounts ──
    if (customer.status === 'pending' && msg.type === 'text' && text) {
      if (customer.otp !== text) {
        console.log(`OTP mismatch for ${sender}: got "${text}", expected "${customer.otp}"`);
        return res.status(200).json({ ok: true, otp_mismatch: true });
      }

      if (customer.otp_expires_at && new Date(customer.otp_expires_at) < new Date()) {
        console.log(`OTP expired for ${sender}`);
        return res.status(200).json({ ok: true, otp_expired: true });
      }

      // Activate account
      await supabase
        .from('customers')
        .update({ status: 'active', otp: null, otp_expires_at: null })
        .eq('id', customer.id);

      console.log(`Account activated: ${sender} (${customer.nama})`);

      try {
        await supabase.from('notifications').insert({
          type: 'registration_active',
          message: `Akun aktif via WA: ${customer.nama || sender}`,
          target_role: 'owner',
          read: false,
        });
      } catch (_) {}

      return res.status(200).json({ matched: true, activated: true });
    }

    // ── Step 3: active customer → process message ──
    if (customer.status === 'active') {
      console.log(`Active customer message from ${sender}: ${text}`);
      return res.status(200).json({ ok: true, active_customer: true, sender });
    }

    return res.status(200).json({ ok: true, processed: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(200).json({ ok: true });
  }
}
