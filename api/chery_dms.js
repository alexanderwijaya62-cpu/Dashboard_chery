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

// ============================================================
// WARRANTY HANDLER — login to 103.160.12.43 and fetch WO data
// ============================================================
let warrantyCookie = null;
let warrantyCookieExpiry = 0;

async function warrantyLogin() {
    const BASE = process.env.WARRANTY_BASE_URL || 'https://103.160.12.43';
    const USER = process.env.WARRANTY_USER || 'nisa';
    const PASS = process.env.WARRANTY_PASS || 'qwerty12345';
    const TOKEN = process.env.WARRANTY_TOKEN || '6aad5b';
    const DEALER = process.env.WARRANTY_KODE_DEALER || 'MOS';
    const DEPT = process.env.WARRANTY_DEPT || 'S';

    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
    };

    // Step 1: GET login page for CSRF
    const loginPage = await fetchWithHttps(`${BASE}/aftersales/login`, { headers: baseHeaders });
    const loginHtml = await loginPage.text();
    let jar = {};
    for (const c of loginPage.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const csrfMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    if (!csrf) throw new Error('Cannot extract CSRF from warranty login page');

    // Step 2: POST login
    const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
    const loginRes = await fetchWithHttps(`${BASE}/aftersales/login`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginBody), 'Cookie': Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '), 'Referer': `${BASE}/aftersales/login`, 'Origin': BASE },
        body: loginBody,
    });
    for (const c of loginRes.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    // Step 3: GET token page
    const cookieStr = () => Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');
    const tokenPage = await fetchWithHttps(`${BASE}/aftersales/token`, { headers: { ...baseHeaders, 'Cookie': cookieStr(), 'Referer': `${BASE}/aftersales/` } });
    const tokenHtml = await tokenPage.text();
    for (const c of tokenPage.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const tokenCsrfMatch = tokenHtml.match(/name="_token"\s+value="([^"]+)"/);
    const tokenCsrf = tokenCsrfMatch ? tokenCsrfMatch[1] : csrf;

    // Step 4: POST token selection
    const tokenBody = new URLSearchParams({ _token: tokenCsrf, kode_dealer: DEALER, token: TOKEN, dept_hidden: DEPT }).toString();
    const tokenRes = await fetchWithHttps(`${BASE}/aftersales/token`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody), 'Cookie': cookieStr(), 'Referer': `${BASE}/aftersales/token`, 'Origin': BASE },
        body: tokenBody,
    });
    for (const c of tokenRes.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    warrantyCookie = cookieStr();
    warrantyCookieExpiry = Date.now() + 90 * 60 * 1000;
    console.log('[Warranty] ✅ Login OK');
    return warrantyCookie;
}

async function handleWarranty(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL || 'https://103.160.12.43';
    const draw = req.query.draw || 1;
    const start = req.query.start || 0;
    const length = req.query.length || 25;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const from = req.query.from || '';
    const to = req.query.to || '';

    const targetUrl = `${BASE}/aftersales/work-order/data?draw=${draw}&start=${start}&length=${length}` +
        `&columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false` +
        `&columns[1][data]=no_wo&columns[1][name]=no_wo&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false` +
        `&columns[2][data]=no_wo_dms&columns[2][name]=no_wo_dms&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false` +
        `&columns[3][data]=status&columns[3][name]=status&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false` +
        `&columns[4][data]=nama_pelanggan&columns[4][name]=nama_pelanggan&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false` +
        `&columns[5][data]=no_polisi&columns[5][name]=no_polisi&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false` +
        `&columns[6][data]=no_chassis&columns[6][name]=no_chassis&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false` +
        `&columns[7][data]=nama_kendaraan&columns[7][name]=nama_kendaraan&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false` +
        `&columns[8][data]=waktu_masuk&columns[8][name]=waktu_masuk&columns[8][searchable]=true&columns[8][orderable]=true&columns[8][search][value]=&columns[8][search][regex]=false` +
        `&columns[9][data]=waktu_simpan_estimasi&columns[9][name]=waktu_simpan_estimasi&columns[9][searchable]=true&columns[9][orderable]=true&columns[9][search][value]=&columns[9][search][regex]=false` +
        `&columns[10][data]=waktu_setujui_estimasi&columns[10][name]=waktu_setujui_estimasi&columns[10][searchable]=true&columns[10][orderable]=true&columns[10][search][value]=&columns[10][search][regex]=false` +
        `&columns[11][data]=waktu_mulai&columns[11][name]=waktu_mulai&columns[11][searchable]=true&columns[11][orderable]=true&columns[11][search][value]=&columns[11][search][regex]=false` +
        `&columns[12][data]=waktu_checker&columns[12][name]=waktu_checker&columns[12][searchable]=true&columns[12][orderable]=true&columns[12][search][value]=&columns[12][search][regex]=false` +
        `&columns[13][data]=waktu_selesai&columns[13][name]=waktu_selesai&columns[13][searchable]=true&columns[13][orderable]=true&columns[13][search][value]=&columns[13][search][regex]=false` +
        `&columns[14][data]=nama_pembawa&columns[14][name]=nama_pembawa&columns[14][searchable]=true&columns[14][orderable]=true&columns[14][search][value]=&columns[14][search][regex]=false` +
        `&columns[15][data]=id_karyawan&columns[15][name]=&columns[15][searchable]=true&columns[15][orderable]=true&columns[15][search][value]=&columns[15][search][regex]=false` +
        `&columns[16][data]=nama_mekanik1&columns[16][name]=&columns[16][searchable]=true&columns[16][orderable]=true&columns[16][search][value]=&columns[16][search][regex]=false` +
        `&columns[17][data]=nama_leader1&columns[17][name]=&columns[17][searchable]=true&columns[17][orderable]=true&columns[17][search][value]=&columns[17][search][regex]=false` +
        `&columns[18][data]=last_update&columns[18][name]=last_update&columns[18][searchable]=true&columns[18][orderable]=true&columns[18][search][value]=&columns[18][search][regex]=false` +
        `&order[0][column]=18&order[0][dir]=desc` +
        `&search[value]=${encodeURIComponent(search)}&search[regex]=false` +
        `&status=${encodeURIComponent(status)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&_=${Date.now()}`;

    let attempts = 0;
    while (attempts < 2) {
        if (!warrantyCookie || Date.now() > warrantyCookieExpiry) {
            warrantyCookie = await warrantyLogin();
        }
        const response = await fetchWithHttps(targetUrl, {
            headers: {
                'Cookie': warrantyCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/work-order`,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const body = await response.text();
        const isHtml = body.trimStart().startsWith('<');
        if (response.status === 302 || response.status === 401 || isHtml) {
            warrantyCookie = null;
            attempts++;
            continue;
        }
        try {
            return res.status(200).json(JSON.parse(body));
        } catch {
            return res.status(500).json({ error: 'Non-JSON response', snippet: body.slice(0, 200) });
        }
    }
    return res.status(500).json({ error: 'Warranty login failed after 2 attempts' });
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

    // ============================================================
    // WARRANTY ENDPOINTS — proxied to 103.160.12.43/aftersales
    // ============================================================
    if (endpoint === 'warranty-wo') {
        return handleWarranty(req, res);
    }

    // ============================================================
    // WARRANTY SEARCH BY VIN — proxied to 103.160.12.43/aftersales
    // ============================================================
    if (endpoint === 'warranty-search-vin') {
        const BASE = process.env.WARRANTY_BASE_URL || 'https://103.160.12.43';
        const vin = req.query.vin || '';
        const draw = req.query.draw || 1;
        const start = req.query.start || 0;
        const length = req.query.length || 50;

        const targetUrl = `${BASE}/aftersales/work-order/data?draw=${draw}&start=${start}&length=${length}` +
            `&columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false` +
            `&columns[1][data]=no_wo&columns[1][name]=no_wo&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false` +
            `&columns[2][data]=no_wo_dms&columns[2][name]=no_wo_dms&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false` +
            `&columns[3][data]=status&columns[3][name]=status&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false` +
            `&columns[4][data]=nama_pelanggan&columns[4][name]=nama_pelanggan&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false` +
            `&columns[5][data]=no_polisi&columns[5][name]=no_polisi&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false` +
            `&columns[6][data]=no_chassis&columns[6][name]=no_chassis&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false` +
            `&columns[7][data]=nama_kendaraan&columns[7][name]=nama_kendaraan&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false` +
            `&columns[8][data]=waktu_masuk&columns[8][name]=waktu_masuk&columns[8][searchable]=true&columns[8][orderable]=true&columns[8][search][value]=&columns[8][search][regex]=false` +
            `&columns[9][data]=waktu_simpan_estimasi&columns[9][name]=waktu_simpan_estimasi&columns[9][searchable]=true&columns[9][orderable]=true&columns[9][search][value]=&columns[9][search][regex]=false` +
            `&columns[10][data]=waktu_setujui_estimasi&columns[10][name]=waktu_setujui_estimasi&columns[10][searchable]=true&columns[10][orderable]=true&columns[10][search][value]=&columns[10][search][regex]=false` +
            `&columns[11][data]=waktu_mulai&columns[11][name]=waktu_mulai&columns[11][searchable]=true&columns[11][orderable]=true&columns[11][search][value]=&columns[11][search][regex]=false` +
            `&columns[12][data]=waktu_checker&columns[12][name]=waktu_checker&columns[12][searchable]=true&columns[12][orderable]=true&columns[12][search][value]=&columns[12][search][regex]=false` +
            `&columns[13][data]=waktu_selesai&columns[13][name]=waktu_selesai&columns[13][searchable]=true&columns[13][orderable]=true&columns[13][search][value]=&columns[13][search][regex]=false` +
            `&columns[14][data]=nama_pembawa&columns[14][name]=nama_pembawa&columns[14][searchable]=true&columns[14][orderable]=true&columns[14][search][value]=&columns[14][search][regex]=false` +
            `&columns[15][data]=id_karyawan&columns[15][name]=&columns[15][searchable]=true&columns[15][orderable]=true&columns[15][search][value]=&columns[15][search][regex]=false` +
            `&columns[16][data]=nama_mekanik1&columns[16][name]=&columns[16][searchable]=true&columns[16][orderable]=true&columns[16][search][value]=&columns[16][search][regex]=false` +
            `&columns[17][data]=nama_leader1&columns[17][name]=&columns[17][searchable]=true&columns[17][orderable]=true&columns[17][search][value]=&columns[17][search][regex]=false` +
            `&columns[18][data]=last_update&columns[18][name]=last_update&columns[18][searchable]=true&columns[18][orderable]=true&columns[18][search][value]=&columns[18][search][regex]=false` +
            `&order[0][column]=18&order[0][dir]=desc` +
            `&search[value]=${encodeURIComponent(vin)}&search[regex]=false` +
            `&status=&from=&to=&_=${Date.now()}`;

        let wAttempts = 0;
        while (wAttempts < 2) {
            if (!warrantyCookie || Date.now() > warrantyCookieExpiry) {
                warrantyCookie = await warrantyLogin();
            }
            const response = await fetchWithHttps(targetUrl, {
                headers: {
                    'Cookie': warrantyCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': `${BASE}/aftersales/work-order`,
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const body = await response.text();
            const isHtml = body.trimStart().startsWith('<');
            if (response.status === 302 || response.status === 401 || isHtml) {
                warrantyCookie = null;
                wAttempts++;
                continue;
            }
            try {
                const json = JSON.parse(body);
                return res.status(200).json({ data: json.data || [] });
            } catch {
                return res.status(500).json({ error: 'Non-JSON response', snippet: body.slice(0, 200) });
            }
        }
        return res.status(500).json({ error: 'Warranty login failed after 2 attempts' });
    }

    try {
        const username = process.env.DMS_USER || 'Alex';
        const password = process.env.DMS_PASS || 'Alex123!';
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
            } else if (endpoint === 'proforma-list') {
                const beginCreateTime = req.query.beginCreateTime || '';
                const endCreateTime = req.query.endCreateTime || '';
                targetUrl = `https://dms.chery.co.id/afterSales/api/v1/claimSettlements/forCurrentUser?pageIndex=${pageIndex}&pageSize=${pageSize}`;
                if (beginCreateTime) targetUrl += `&beginCreateTime=${encodeURIComponent(beginCreateTime)}`;
                if (endCreateTime) targetUrl += `&endCreateTime=${encodeURIComponent(endCreateTime)}`;
            } else if (endpoint === 'proforma-detail') {
                const id = req.query.id || '';
                targetUrl = `https://dms.chery.co.id/afterSales/api/v1/claimSettlements/${id}`;
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
