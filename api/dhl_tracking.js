export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { trackingNumber, language = 'en', requesterCountryCode = 'ID', source = 'tt' } = req.query || {};
  if (!trackingNumber) {
    return res.status(400).json({ error: 'trackingNumber is required' });
  }

  const apiKey = process.env.DHL_API_KEY;

  try {
    if (apiKey) {
      // Jika API Key diatur, gunakan API resmi DHL (Shipment Tracking - Unified API)
      const officialUrl = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}&language=${encodeURIComponent(language)}`;
      const response = await fetch(officialUrl, {
        method: 'GET',
        headers: {
          'DHL-API-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `Official DHL API error`, details: text });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } else {
      // Fallback ke public API
      const url = `https://www.dhl.com/utapi?trackingNumber=${encodeURIComponent(trackingNumber)}&language=${encodeURIComponent(language)}&requesterCountryCode=${encodeURIComponent(requesterCountryCode)}&source=${encodeURIComponent(source)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'Referer': 'https://www.dhl.com/id-en/home/tracking.html',
          'Origin': 'https://www.dhl.com',
        },
      });

      if (response.status === 428 || response.status === 403) {
        return res.status(428).json({ error: 'Akamai Challenge Required', details: 'Direct fetch blocked by Akamai.' });
      }

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `DHL API responded with status ${response.status}`, details: text });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch from DHL' });
  }
}
