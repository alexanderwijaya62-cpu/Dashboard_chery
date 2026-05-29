import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import urllib from 'url';

const COOKIE_FILE = path.join(os.tmpdir(), 'chery_dms_cookie.txt');
let cachedCookie = null;
let currentLoginPromise = null;

// Native Node.js HTTPS Agent dengan socket pool tinggi agar sangat cepat dan bebas crash libuv
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000
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
                const buffer = Buffer.concat(chunks);
                const responseObj = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()],
                        getSetCookie: () => {
                            const raw = res.headers['set-cookie'];
                            return Array.isArray(raw) ? raw : (raw ? [raw] : []);
                        }
                    },
                    text: async () => buffer.toString('utf8'),
                    json: async () => JSON.parse(buffer.toString('utf8'))
                };
                resolve(responseObj);
            });
        });

        req.on('error', (err) => reject(err));

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

function getStoredCookie() {
    try {
        if (fs.existsSync(COOKIE_FILE)) {
            const stats = fs.statSync(COOKIE_FILE);
            // Cookie valid for 2 hours
            const isFresh = (Date.now() - stats.mtimeMs) < (2 * 60 * 60 * 1000);
            if (isFresh) {
                return fs.readFileSync(COOKIE_FILE, 'utf8');
            }
        }
    } catch (e) {
        console.error("Error reading cookie file:", e.message);
    }
    return null;
}

function saveCookie(cookie) {
    try {
        fs.writeFileSync(COOKIE_FILE, cookie, 'utf8');
    } catch (e) {
        console.error("Error saving cookie file:", e.message);
    }
}

async function login(username, password, enterpriseCode) {
    console.log("--- Phase 1: Getting Session Cookies from Home Page ---");
    try {
        const initialResp = await fetchWithHttps('https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        let initialCookies = [];
        if (initialResp.headers.getSetCookie) {
            initialCookies = initialResp.headers.getSetCookie();
        } else {
            const rawCookie = initialResp.headers.get('set-cookie');
            initialCookies = rawCookie ? [rawCookie] : [];
        }

        const cookieStr = initialCookies.map(c => c.split(';')[0]).join('; ');

        console.log("--- Phase 2: Attempting Login (Language: en-US) ---");
        const loginBody = JSON.stringify({
            enterpriseCode: enterpriseCode,
            username: username,
            password: password,
            language: 'en-US'
        });

        const resp = await fetchWithHttps('https://dms.chery.co.id/api/v1/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginBody, 'utf8'),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                'Origin': 'https://dms.chery.co.id',
                'Referer': 'https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F',
                'Cookie': cookieStr,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            },
            body: loginBody
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`Login failed with status ${resp.status}: ${errorText}`);
        }

        let setCookies = [];
        if (resp.headers.getSetCookie) {
            setCookies = resp.headers.getSetCookie();
        } else {
            const raw = resp.headers.get('set-cookie');
            setCookies = raw ? [raw] : [];
        }

        if (setCookies.length > 0) {
            const aspNetCookie = setCookies.find(c => c.includes('.AspNetCore.Cookies'));
            if (aspNetCookie) {
                cachedCookie = aspNetCookie.split(';')[0];
                saveCookie(cachedCookie);
                console.log("✅ Session cookie obtained successfully!");
                return cachedCookie;
            }
        }
        throw new Error("Login successful but no session cookie returned");
    } catch (e) {
        console.error("❌ Login Error:", e.message);
        throw e;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const endpoint = req.query.endpoint || 'parts';

    if (endpoint === 'jagoan_trace') {
        const awb = req.query.awb || req.body?.awb || '';
        const token = req.query.token || req.body?.token || '';
        const postBody = new URLSearchParams({ awb, token }).toString();
        
        console.log(`[Jagoan Proxy] POST to api-trace with awb=${awb}`);
        const jagoanOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Content-Length': Buffer.byteLength(postBody),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Origin': 'https://jagoan-logistics.com',
                'Referer': 'https://jagoan-logistics.com/',
                'Accept': 'application/json, text/javascript, */*; q=0.01'
            },
            body: postBody
        };
        try {
            const jagoanRes = await fetchWithHttps("https://app.jagoan-logistics.com/backend/api/api-trace", jagoanOptions);
            const rawText = await jagoanRes.text();
            return res.status(jagoanRes.status).send(rawText);
        } catch (err) {
            console.error("[Jagoan Proxy] Error:", err.message);
            return res.status(500).json({ success: false, messages: err.message });
        }
    }

    try {
        const username = process.env.DMS_USER;
        const password = process.env.DMS_PASS;
        const enterpriseCode = process.env.DMS_ENTERPRISE_CODE || '10007901';

        if (!username || !password) {
            return res.status(500).json({ error: "DMS_USER and DMS_PASS environment variables not configured" });
        }

        const pageSize = req.query.pageSize || 10;
        const pageIndex = req.query.pageIndex || 0;
        const status = req.query.status || 1;
        const code = req.query.code || '';
        const name = req.query.name || '';
        
        const endpoint = req.query.endpoint || 'parts';
        const claimId = req.query.claimId || '';
        const method = req.method === 'POST' ? 'POST' : 'GET';

        let attempts = 0;
        let data = null;

        while (attempts < 2) {
            if (!cachedCookie) {
                cachedCookie = getStoredCookie();
            }

            if (!cachedCookie) {
                if (!currentLoginPromise) {
                    currentLoginPromise = login(username, password, enterpriseCode)
                        .finally(() => { currentLoginPromise = null; });
                }
                await currentLoginPromise;
            }

            let targetUrl = '';
            
            if (endpoint === 'claims_query') {
                targetUrl = `https://dms.chery.co.id/afterSales/api/v1/claims/query/forCurrentUser?pageIndex=${pageIndex}&pageSize=${pageSize}`;
            } else if (endpoint === 'claim_detail') {
                targetUrl = `https://dms.chery.co.id/afterSales/api/v1/claims/${claimId}`;
            } else if (endpoint === 'part_orders') {
                const orderCode = req.query.orderCode || '';
                targetUrl = `https://dms.chery.co.id/parts/api/v1/partSaleOrders/forCurrentUser?pageIndex=${pageIndex}&pageSize=${pageSize}&isBuyer=true`;
                if (orderCode) targetUrl += `&code=${encodeURIComponent(orderCode)}`;
            } else if (endpoint === 'part_order_detail') {
                const orderId = req.query.orderId || '';
                targetUrl = `https://dms.chery.co.id/parts/api/v1/partSaleOrders/${orderId}`;
            } else if (endpoint === 'part_shipments') {
                const processCode = req.query.processCode || '';
                targetUrl = `https://dms.chery.co.id/parts/api/v1/partShipments/forCurrentUser?pageIndex=${pageIndex}&pageSize=${pageSize}&isDesc=true&sortField=createTime`;
                if (processCode) targetUrl += `&partSaleOrderProcessCode=${encodeURIComponent(processCode)}`;
            } else {
                targetUrl = `https://dms.chery.co.id/parts/api/v1/partSalesProperties/forCurrentUser?pageSize=${pageSize}&status=${status}&pageIndex=${pageIndex}`;
                if (code) targetUrl += `&code=${encodeURIComponent(code)}`;
                if (name) targetUrl += `&name=${encodeURIComponent(name)}`;
                if (req.url.includes('/search')) {
                   const q = req.query.q || '';
                   if (q) targetUrl += `&code=${encodeURIComponent(q)}`;
                }
            }
            
            console.log(`[DMS Proxy] ${method} to ${targetUrl}`);
            
            const fetchOptions = {
                method: method,
                headers: {
                    'Cookie': cachedCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                    'Referer': 'https://dms.chery.co.id/',
                    'Origin': 'https://dms.chery.co.id',
                    'Accept': 'application/json, application/vnd.api+json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/json',
                    'Connection': 'keep-alive'
                }
            };

            if (method === 'POST') {
                const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
                fetchOptions.body = bodyStr;
                fetchOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
            }

            const response = await fetchWithHttps(targetUrl, fetchOptions);

            if (response.status === 401 || response.status === 403) {
                console.log("⚠️ Session expired, retrying login...");
                cachedCookie = null;
                try { if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE); } catch(e) {}
                attempts++;
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`DMS API returned ${response.status}: ${errText}`);
            }

            data = await response.json();
            break;
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("❌ Chery DMS Proxy Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
