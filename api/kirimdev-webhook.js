import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Kirimdev webhook: Meta passthrough format
// GET  = webhook verification (challenge)
// POST = message handling

const WEBHOOK_SECRET = (process.env.KIRIM_WEBHOOK_SECRET || '').replace(/^whsec_/, '');
const VERIFY_TOKEN = process.env.KIRIM_WEBHOOK_VERIFY_TOKEN || 'chery-kirimdev-2024';

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

async function logMessage(supabase, data) {
  try {
    await supabase.from('wa_logs').insert(data);
  } catch (e) {
    console.error('Failed to log message:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kirim-Signature, X-Kirim-Event');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Webhook verification ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'] || req.query.mode;
    const token = req.query['hub.verify_token'] || req.query.verify_token;
    const challenge = req.query['hub.challenge'] || req.query.challenge;

    console.log(`Webhook verify: mode=${mode} token=${token} challenge=${challenge}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      console.log('Webhook verified OK');
      return res.status(200).send(challenge);
    }

    console.error('Webhook verify FAILED');
    return res.status(403).json({ error: 'Verification failed' });
  }

  // ── POST: Handle messages ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  console.log(`Webhook POST received: event=${event}`);

  // Handle all events, not just message.received
  if (!event) {
    return res.status(200).json({ ok: true, no_event: true });
  }

  try {
    const body = JSON.parse(rawBody);
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages || [];
    const message = messages[0];

    const supabase = getSupabase();

    // Log ALL incoming messages
    if (message) {
      const sender = (message.from || '').replace(/[^\d]/g, '');
      const text = (message.text?.body || '').trim();
      const msgType = message.type || 'unknown';

      console.log(`Message from ${sender}: [${msgType}] ${text}`);

      await logMessage(supabase, {
        event,
        sender,
        message_type: msgType,
        text: text || null,
        raw_body: body,
        status: 'received',
      });

      // Only process text messages for OTP
      if (message.type === 'text' && text && sender) {
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

        if (customer && (!customer.otp_expires_at || new Date(customer.otp_expires_at) >= new Date())) {
          // Activate account
          await supabase
            .from('customers')
            .update({ status: 'active', otp: null, otp_expires_at: null })
            .eq('id', customer.id);

          await logMessage(supabase, {
            event: 'otp.activated',
            sender,
            message_type: 'otp_match',
            text,
            raw_body: body,
            status: 'activated',
          });

          try {
            await supabase.from('notifications').insert({
              type: 'registration_active',
              message: `Akun pelanggan aktif via WA: ${customer.no_hp}`,
              target_role: 'owner',
              read: false,
            });
          } catch (_) {}

          return res.status(200).json({ matched: true, no_hp: customer.no_hp });
        }
      }
    }

    return res.status(200).json({ ok: true, event });
  } catch (err) {
    console.error('Kirimdev webhook error:', err.message);
    return res.status(200).json({ error: err.message });
  }
}
