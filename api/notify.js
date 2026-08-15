import { validateSession, sendUnauthorized } from './auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Username, X-Auth-Session-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await validateSession(req);
  } catch (authErr) {
    return sendUnauthorized(req, res, authErr.message);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseUrl || !serviceKey || !vapidPrivateKey || !vapidPublicKey) {
    return res.status(500).json({ error: 'Push config not set (VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails('mailto:admin@cherymedan.web.id', vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { plat, title, body, url } = req.body;
    if (!plat) return res.status(400).json({ error: 'plat is required' });

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('plat', plat.toUpperCase());

    if (!subs?.length) return res.json({ sent: 0 });

    const payload = JSON.stringify({
      title: title || 'Panggilan Antrian',
      body: body || 'Silahkan menuju counter',
      url: url || '/customer'
    });

    const deadEndpoints = [];
    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload).catch(err => {
        if (err.statusCode === 410) deadEndpoints.push(sub.endpoint);
      }))
    );

    if (deadEndpoints.length > 0) {
      await supabase.from('push_subscriptions')
        .delete()
        .in('endpoint', deadEndpoints);
    }

    return res.json({ sent: results.filter(r => r.status === 'fulfilled').length, total: subs.length });
  } catch (err) {
    console.error('Push error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
