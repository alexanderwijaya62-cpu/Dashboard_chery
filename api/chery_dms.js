import https from 'https';
import urllib from 'url';

let cachedCookie = null;
let currentLoginPromise = null;

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000,
    rejectUnauthorized: false
});

function fetchWithHttps(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new urllib.URL(urlStr);
        const reqOptions = {
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            agent: httpsAgent
        };

        const req = https.request(reqOptions, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    text: async () => body,
                    json: async () => JSON.parse(body),
                    buffer: async () => Buffer.concat(chunks)
                });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

function getStoredCookie() {
    return cachedCookie;
}

async function login(username, password, enterpriseCode) {
    const loginBody = new urllib.URLSearchParams({
        username: username,
        password: password,
        enterpriseCode: enterpriseCode
    }).toString();

    const loginResp = await fetchWithHttps('https://dms.chery.co.id/api/v1/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: loginBody
    });

    if (!loginResp.ok) {
        throw new Error(`DMS Login failed: ${loginResp.status}`);
    }

    const setCookie = loginResp.headers['set-cookie'];
    if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
        cachedCookie = cookieStr.split(';')[0];
    } else {
        throw new Error('No cookie received from DMS login');
    }
    return cachedCookie;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const endpoint = req.query.endpoint || 'test';

    if (endpoint === 'vehicle-select' && req.query.term) {
        try {
            const username = process.env.DMS_USER || 'Alex';
            const password = process.env.DMS_PASS || 'Alex123!';
            const enterpriseCode = process.env.DMS_ENTERPRISE_CODE || '10007901';

            if (!cachedCookie) {
                await login(username, password, enterpriseCode);
            }

            const term = encodeURIComponent(req.query.term);
            const targetUrl = `https://dms.chery.co.id/api/v1/vehicles/forCurrentUser?pageSize=20&pageIndex=0&q=${term}`;

            const response = await fetchWithHttps(targetUrl, {
                headers: {
                    'Cookie': cachedCookie,
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            if (response.status === 401) {
                cachedCookie = null;
                await login(username, password, enterpriseCode);
                const retryResp = await fetchWithHttps(targetUrl, {
                    headers: {
                        'Cookie': cachedCookie,
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                const data = await retryResp.json();
                return res.status(200).json(data.content || data.data || []);
            }

            const data = await response.json();
            return res.status(200).json(data.content || data.data || []);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(200).json({ status: 'ok', message: 'Chery DMS Minimal Proxy', endpoint: endpoint });
}
