import https from 'https';

// ============================================================
// EPC Proxy — handles both proxy requests and EPCM login
// Use ?action=login (POST) for login, or ?path=... for proxy
// ============================================================

async function handleLogin(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const username = process.env.DMS_USER || 'Alex';
    const password = process.env.DMS_PASS || 'Alex123$';
    const enterpriseCode = process.env.DMS_ENTERPRISE_CODE || '10007901';

    try {
        const request = (url, options = {}, body = null) => {
            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, text: data }));
                });
                req.on('error', reject);
                const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : "{}";
                req.write(payload);
                req.end();
            });
        };

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=UTF-8',
            'Referer': 'https://qrepcm.mychery.com/',
            'Origin': 'https://qrepcm.mychery.com',
            'X-Requested-With': 'XMLHttpRequest'
        };

        let keyResp = await request('https://qrepcm.mychery.com/api/rest/base/auth/public/key', { method: 'POST', headers });
        let keyData;
        try { keyData = JSON.parse(keyResp.text); } catch (e) {
            return res.status(500).json({ success: false, message: "Parse error: " + keyResp.text.substring(0, 30) });
        }

        if (!keyData.success || !keyData.data || !keyData.data.backgroundImage) {
            return res.status(500).json({ success: false, message: "Gagal memancing gambar puzzle: " + (keyData.message || "Data null") });
        }

        const puzzleX = keyData.data.x;
        const pictureVerifyId = `${username}+Jaecoo`;
        const percentage = (puzzleX / 590).toFixed(4);

        const verifyUrl = `https://qrepcm.mychery.com/api/rest/base/auth/public/verify?percentage=${percentage}&verifyId=${encodeURIComponent(pictureVerifyId)}`;
        await request(verifyUrl, { method: 'GET', headers });

        const loginPayload = { username, password, enterpriseCode, captchaVerification: puzzleX.toString(), pictureVerifyId, registerMethod: "", configInfo: "" };
        const loginResult = await request('https://qrepcm.mychery.com/api/rest/base/auth/in', { method: 'POST', headers }, loginPayload);
        const result = JSON.parse(loginResult.text);

        if (result.success && result.data?.token) {
            return res.status(200).json({ success: true, token: result.data.token });
        } else {
            return res.status(401).json({ success: false, message: result.message || "Gagal Login" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Route: ?action=login → EPCM login
    if (req.query.action === 'login') {
        return handleLogin(req, res);
    }

    // Route: ?path=... → EPC proxy
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
            'Accept-Language': 'en-US,en;q=0.9'
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
