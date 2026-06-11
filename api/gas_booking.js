export default async function handler(req, res) {
    // Simple Middleware to secure API from direct browser access
    const clientApiKey = req.headers['x-api-key'];
    const expectedGate = process.env.VITE_GATE || 'chery-gate-2024';

    if (!clientApiKey || clientApiKey !== expectedGate) {
      return res.status(401).json({ error: "Unauthorized access: API key is missing or invalid." });
    }

    const targetUrl = process.env.VITE_GAS_BOOKING_URL;

    if (!targetUrl || targetUrl.includes("YOUR_ACTUAL_BOOKING_URL")) {
        return res.status(500).json({ error: "No GAS BOOKING URL configured in Server. Make sure to set VITE_GAS_BOOKING_URL in Vercel Environment." });
    }

    // Keamanan: Sertakan API Key dalam URL GAS agar sinkron dengan script.google.com
    const urlObj = new URL(targetUrl);
    urlObj.searchParams.set('key', expectedApiKey);

    if (req.query) {
        for (const key in req.query) {
            if (key !== 'key') {
                urlObj.searchParams.set(key, req.query[key]);
            }
        }
    }

    try {
        const options = {
            method: req.method,
        };

        if (req.method === 'POST') {
            options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        }

        const proxyResponse = await fetch(urlObj.toString(), options);
        const contentType = proxyResponse.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await proxyResponse.json();
            return res.status(proxyResponse.status).json(data);
        } else {
            const text = await proxyResponse.text();
            try {
                const data = JSON.parse(text);
                return res.status(proxyResponse.status).json(data);
            } catch (e) {
                return res.status(proxyResponse.status).send(text);
            }
        }
    } catch (error) {
        return res.status(500).json({ error: error.message || "Failed to fetch from Google Script" });
    }
}
