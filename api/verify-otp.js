const VPS_URL = process.env.VPS_API_URL || 'http://202.155.13.9:3000';
const WA_KEY = process.env.VITE_WA_KEY || '';

async function proxyToVPS(endpoint, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = { ...(req.body || {}), key: WA_KEY };

  try {
    const response = await fetch(`${VPS_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(`VPS proxy error [${endpoint}]:`, err.message);
    return res.status(502).json({ error: 'VPS unreachable' });
  }
}

export default async function handler(req, res) {
  return proxyToVPS('/api/verify-otp', req, res);
}
