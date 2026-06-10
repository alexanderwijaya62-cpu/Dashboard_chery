export default async function handler(req, res) {
    const clientApiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.VITE_API_KEY;

    if (!expectedApiKey) {
      return res.status(500).json({ error: "VITE_API_KEY not configured on server" });
    }

    if (!clientApiKey || clientApiKey !== expectedApiKey) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    const targetUrl = process.env.VITE_GAS_LAPORANWO_URL;

    if (!targetUrl) {
        return res.status(500).json({ error: "No Laporan WO GAS URL configured in Server. Check VITE_GAS_LAPORANWO_URL." });
    }

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
        return res.status(500).json({ error: error.message || "Failed to fetch from Laporan WO Google Script" });
    }
}
