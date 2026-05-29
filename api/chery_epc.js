
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { path, token } = req.query;
    
    if (!path) {
        return res.status(400).json({ error: "Missing path parameter" });
    }

    const targetUrl = `https://qrepcm.mychery.com${path}`;
    
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            'Referer': 'https://qrepcm.mychery.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9' // Tambahkan ini agar nama sparepart jadi Bahasa Inggris
        };

        if (token) {
            headers['token'] = token.startsWith('Bearer') ? token : `Bearer ${token}`;
            headers['Authorization'] = headers['token'];
        }

        const response = await fetch(targetUrl, { headers });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.send(Buffer.from(buffer));
        }

        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error("EPC Proxy Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
