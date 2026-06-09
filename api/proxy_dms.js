import https from 'https';
import urllib from 'url';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = req.query.endpoint || 'test';

  if (endpoint === 'test') {
    return res.status(200).json({ status: 'ok', message: 'Proxy DMS is working' });
  }

  return res.status(400).json({ error: 'Unknown endpoint' });
}
