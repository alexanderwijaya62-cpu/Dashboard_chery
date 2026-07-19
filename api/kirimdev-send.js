export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, text } = req.body || {};

  if (!to || !text) {
    return res.status(400).json({ error: 'to and text required' });
  }

  const PHONE_ID = process.env.KIRIM_PHONE_ID;
  const API_KEY = process.env.KIRIM_API_KEY;

  if (!PHONE_ID || !API_KEY) {
    return res.status(500).json({ error: 'KIRIM_PHONE_ID or KIRIM_API_KEY not configured' });
  }

  // Normalize phone
  let phone = String(to).replace(/[^\d]/g, '');
  if (phone.startsWith('0')) phone = '62' + phone.slice(1);
  if (!phone.startsWith('+')) phone = '+' + phone;

  try {
    const resp = await fetch(`https://api.kirimdev.com/v1/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Kirimdev send error:', data);
      return res.status(resp.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Kirimdev proxy error:', err.message);
    return res.status(502).json({ error: 'Kirimdev API unreachable' });
  }
}
