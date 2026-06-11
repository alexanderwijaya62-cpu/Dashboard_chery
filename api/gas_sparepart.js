export default async function handler(req, res) {
    try {
        const clientApiKey = req.headers['x-api-key'];
        const expectedGate = process.env.VITE_GATE || 'chery-gate-2024';

        if (!clientApiKey || clientApiKey !== expectedGate) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const targetUrl = process.env.VITE_GAS_SPAREPART_URL;
        if (!targetUrl) {
            return res.status(500).json({ error: "Target URL not configured" });
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

        const options = {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: req.method === 'POST' ? (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body) : undefined
        };

        const proxyResponse = await fetch(urlObj.toString(), options);
        const text = await proxyResponse.text();
        try {
            return res.status(proxyResponse.status).json(JSON.parse(text));
        } catch (e) {
            return res.status(proxyResponse.status).send(text);
        }
    } catch (error) {
        console.error("Proxy Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
}
