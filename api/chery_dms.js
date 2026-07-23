import https from 'https';
import urllib from 'url';
import fs from 'fs';

let cachedCookie = null;
let currentLoginPromise = null;

// Native Node.js HTTPS Agent dengan socket pool tinggi agar sangat cepat dan bebas crash libuv
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000,
    rejectUnauthorized: true
});

function fetchWithHttps(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
        if (!urlStr || typeof urlStr !== 'string') {
            return reject(new Error('Invalid URL: URL string is missing or invalid'));
        }
        let fullUrl = urlStr;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = 'https://dms.chery.co.id' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        }
        let u;
        try {
            u = new urllib.URL(fullUrl);
        } catch (err) {
            return reject(new Error(`Invalid URL: ${fullUrl}`));
        }
        const reqOptions = {
            hostname: u.hostname,
            port: u.port || (u.protocol === 'http:' ? 80 : 443),
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
                    json: async () => JSON.parse(buffer.toString('utf8')),
                    buffer: async () => buffer
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
    return cachedCookie;
}

function saveCookie(cookie) {
    cachedCookie = cookie;
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
let croCookie = null;
let croCookieExpiry = 0;

async function warrantyGenericLogin(isCro = false) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const PUBLIC_HOST = 'https://dms.chery.co.id';
    const USER = isCro ? (process.env.CRO_USER) : (process.env.WARRANTY_USER);
    const PASS = isCro ? (process.env.CRO_PASS) : (process.env.WARRANTY_PASS);
    const TOKEN = isCro ? (process.env.CRO_TOKEN) : (process.env.WARRANTY_TOKEN);
    const DEALER = process.env.WARRANTY_KODE_DEALER;
    const DEPT = process.env.WARRANTY_DEPT;

    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
    };

    // Step 1: GET login page for CSRF
    const loginPage = await fetchWithHttps(`${BASE}/aftersales/login`, { headers: baseHeaders });
    const loginHtml = await loginPage.text();
    if (loginPage.status === 302 || loginHtml.includes('login') === false && loginHtml.includes('_token') === false) {
        throw new Error(`[${isCro?'CRO':'Warranty'}] Login page status ${loginPage.status} — bukan form login: ${loginHtml.slice(0,200)}`);
    }
    let jar = {};
    for (const c of loginPage.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const csrfMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    if (!csrf) throw new Error(`[${isCro?'CRO':'Warranty'}] Cannot extract CSRF from login page — snippet: ${loginHtml.slice(0,200)}`);

    // Step 2: POST login — gunakan Origin/Referer dari public host
    const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
    const loginRes = await fetchWithHttps(`${BASE}/aftersales/login`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginBody), 'Cookie': Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '), 'Referer': `${PUBLIC_HOST}/aftersales/login`, 'Origin': PUBLIC_HOST },
        body: loginBody,
    });
    if (loginRes.status >= 400) {
        const body = await loginRes.text();
        throw new Error(`[${isCro?'CRO':'Warranty'}] Login POST returned ${loginRes.status}: ${(body||'<empty>').slice(0,200)}`);
    }
    for (const c of loginRes.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    // Step 3: GET token page
    const cookieStr = () => Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');
    const tokenPage = await fetchWithHttps(`${BASE}/aftersales/token`, { headers: { ...baseHeaders, 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/` } });
    if (tokenPage.status === 302) {
        const loc = tokenPage.headers.get('location') || '';
        if (loc.includes('login')) {
            throw new Error(`[${isCro?'CRO':'Warranty'}] Login failed — redirected to login page: ${loc}`);
        }
        // CRO account — token step skipped, cookies from login are enough
        const finalCookie = cookieStr();
        if (isCro) {
            croCookie = finalCookie;
            croCookieExpiry = Date.now() + 90 * 60 * 1000;
            console.log('[CRO] ✅ Login OK (no token step)');
        } else {
            warrantyCookie = finalCookie;
            warrantyCookieExpiry = Date.now() + 90 * 60 * 1000;
            console.log('[Warranty] ✅ Login OK (no token step)');
        }
        return finalCookie;
    }
    const tokenHtml = await tokenPage.text();
    if (tokenPage.status >= 400) {
        throw new Error(`[${isCro?'CRO':'Warranty'}] Token page GET returned ${tokenPage.status}: ${(tokenHtml||'<empty>').slice(0,200)}`);
    }
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
    if (tokenRes.status >= 400) {
        const body = await tokenRes.text();
        throw new Error(`[${isCro?'CRO':'Warranty'}] Token POST returned ${tokenRes.status}: ${(body||'<empty>').slice(0,200)}`);
    }
    for (const c of tokenRes.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const finalCookie = cookieStr();
    if (!finalCookie) throw new Error(`[${isCro?'CRO':'Warranty'}] No cookies after login`);

    if (isCro) {
        croCookie = finalCookie;
        croCookieExpiry = Date.now() + 90 * 60 * 1000;
        console.log('[CRO] ✅ Login OK');
    } else {
        warrantyCookie = finalCookie;
        warrantyCookieExpiry = Date.now() + 90 * 60 * 1000;
        console.log('[Warranty] ✅ Login OK');
    }
    return finalCookie;
}

async function warrantyLogin() {
    return warrantyGenericLogin(false);
}

async function croLogin() {
    return warrantyGenericLogin(true);
}

const warrantyWoCacheStore = new Map();

async function handleWarranty(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const draw = req.query.draw || 1;
    const start = req.query.start || 0;
    const length = req.query.length || 25;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const kategori = req.query.kategori || '';
    const from = req.query.from || '';
    const to = req.query.to || '';

    const cacheKey = `wo_${from}_${to}_${search}_${status}_${kategori}_${start}_${length}`;
    const cached = warrantyWoCacheStore.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 30000)) {
        return res.status(200).json(cached.json);
    }

    let dmsFrom = from;
    let dmsTo = to;
    if (from && from.includes('-')) {
        const [y, m, d] = from.split('-');
        dmsFrom = `${d}/${m}/${y}`;
    }
    if (to && to.includes('-')) {
        const [y, m, d] = to.split('-');
        dmsTo = `${d}/${m}/${y}`;
    }

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
        `&status=${encodeURIComponent(status)}&kategori=${encodeURIComponent(kategori)}&time=waktu_masuk&from=${encodeURIComponent(from || dmsFrom)}&to=${encodeURIComponent(to || dmsTo)}&from_date=${encodeURIComponent(from || dmsFrom)}&to_date=${encodeURIComponent(to || dmsTo)}&_=${Date.now()}`;

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
            const parsed = JSON.parse(body);
            warrantyWoCacheStore.set(cacheKey, { timestamp: Date.now(), json: parsed });
            return res.status(200).json(parsed);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to parse JSON response from DMS', raw: body.slice(0, 200) });
        }
    }
    return res.status(500).json({ error: 'Warranty login failed after 2 attempts' });
}

async function handleWarrantyEstimasiDetail(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing estimasi/WO ID' });

    const targetUrl = `${BASE}/aftersales/estimasi/detail/${id}`;
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        const body = await response.text();
        const isHtml = body.trimStart().startsWith('<');

        const isLoginPage = body.includes('/aftersales/login') ||
                            (body.includes('name="username"') && body.includes('name="password"'));

        if (response.status === 302 || response.status === 401 || !isHtml || isLoginPage) {
            warrantyCookie = null;
            attempts++;
            continue;
        }

        try {
            // 1. Scrape Pekerjaan (LC) Rows
            const pekerjaan = [];
            const tbodyLcMatch = body.match(/<tbody[^>]*id="tbody_lc"[\s\S]*?<\/tbody>/i);
            const lcHtml = tbodyLcMatch ? tbodyLcMatch[0] : body;
            const lcRowRegex = /<tr[^>]*class="lcRow"[^>]*>[\s\S]*?<\/tr>/gi;
            let lcMatch;
            while ((lcMatch = lcRowRegex.exec(lcHtml)) !== null) {
                const tr = lcMatch[0];
                const getVal = (field) => {
                    const r1 = new RegExp(`name="detail_pekerjaan\\[\\d+\\]\\[${field}\\]"[^>]*value="([^"]*)"`, 'i');
                    const r2 = new RegExp(`value="([^"]*)"[^>]*name="detail_pekerjaan\\[\\d+\\]\\[${field}\\]"`, 'i');
                    const r3 = new RegExp(`id="${field}_pekerjaan\\d+"[^>]*value="([^"]*)"`, 'i');
                    const r4 = new RegExp(`value="([^"]*)"[^>]*id="${field}_pekerjaan\\d+"`, 'i');
                    const m = tr.match(r1) || tr.match(r2) || tr.match(r3) || tr.match(r4);
                    return m ? m[1].trim() : '';
                };

                const getTdVal = (className) => {
                    const match = tr.match(new RegExp(`<td[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, 'i'));
                    if (!match) return '';
                    return match[1].replace(/<[^>]*>/g, '').trim();
                };

                const kode_pekerjaan = getVal('kode_pekerjaan') || getTdVal('kodePekerjaan');
                const nama_pekerjaan = getVal('nama_pekerjaan') || getTdVal('namaPekerjaan');

                let sub_total = parseFloat(getVal('sub_total')) || 0;
                if (!sub_total) {
                    sub_total = parseFloat(getTdVal('subTotalPekerjaan').replace(/[^0-9]/g, '')) || 0;
                }

                let diskon_persen = parseFloat(getVal('diskon_persen')) || 0;
                if (!diskon_persen) {
                    diskon_persen = parseFloat(getTdVal('diskonPersenPekerjaan').replace(/[^0-9.]/g, '')) || 0;
                }

                let diskon_nominal = parseFloat(getVal('diskon_nominal')) || 0;
                if (!diskon_nominal) {
                    diskon_nominal = parseFloat(getTdVal('diskonNominalPekerjaan').replace(/[^0-9]/g, '')) || 0;
                }

                let total = parseFloat(getVal('total')) || 0;
                if (!total) {
                    total = parseFloat(getTdVal('totalPekerjaan').replace(/[^0-9]/g, '')) || (sub_total - diskon_nominal);
                }

                if (nama_pekerjaan || kode_pekerjaan || total > 0) {
                    pekerjaan.push({ kode_pekerjaan, nama_pekerjaan, sub_total, diskon_persen, diskon_nominal, total });
                }
            }

            // 2. Scrape Spare Part Rows
            const parts = [];
            const tbodyPartMatch = body.match(/<tbody[^>]*id="tbody_part"[\s\S]*?<\/tbody>/i);
            const partHtml = tbodyPartMatch ? tbodyPartMatch[0] : body;
            const partRowRegex = /<tr[^>]*class="partRow"[^>]*>[\s\S]*?<\/tr>/gi;
            let prMatch;
            while ((prMatch = partRowRegex.exec(partHtml)) !== null) {
                const tr = prMatch[0];
                const getVal = (field) => {
                    const r1 = new RegExp(`name="detail_part\\[\\d+\\]\\[${field}\\]"[^>]*value="([^"]*)"`, 'i');
                    const r2 = new RegExp(`value="([^"]*)"[^>]*name="detail_part\\[\\d+\\]\\[${field}\\]"`, 'i');
                    const r3 = new RegExp(`id="${field}_part\\d+"[^>]*value="([^"]*)"`, 'i');
                    const r4 = new RegExp(`value="([^"]*)"[^>]*id="${field}_part\\d+"`, 'i');
                    const m = tr.match(r1) || tr.match(r2) || tr.match(r3) || tr.match(r4);
                    return m ? m[1].trim() : '';
                };

                const getTdVal = (className) => {
                    const match = tr.match(new RegExp(`<td[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, 'i'));
                    if (!match) return '';
                    return match[1].replace(/<[^>]*>/g, '').trim();
                };

                const kode_part = getVal('kode_part') || getTdVal('kodePart');
                const nama_part = getVal('nama_part') || getTdVal('namaPart');
                const no_transaksi = getVal('no_transaksi') || getTdVal('noTransaksiPart');

                let harga_jual = parseFloat(getVal('harga_jual')) || 0;
                if (!harga_jual) {
                    const tdHarga = getTdVal('hargaJualPart');
                    harga_jual = parseFloat(tdHarga.replace(/[^0-9]/g, '')) || 0;
                }

                let jumlah = parseInt(getVal('jumlah'), 10) || 0;
                if (!jumlah) {
                    const tdJumlah = getTdVal('jumlahPart');
                    jumlah = parseInt(tdJumlah.replace(/[^0-9]/g, ''), 10) || 1;
                }

                let sub_total = parseFloat(getVal('sub_total')) || 0;
                if (!sub_total) {
                    const tdSub = getTdVal('subTotalPart');
                    sub_total = parseFloat(tdSub.replace(/[^0-9]/g, '')) || (harga_jual * jumlah);
                }

                let diskon_persen = parseFloat(getVal('diskon_persen')) || 0;
                if (!diskon_persen) {
                    const tdDiscP = getTdVal('diskonPersenPart');
                    diskon_persen = parseFloat(tdDiscP.replace(/[^0-9.]/g, '')) || 0;
                }

                let diskon_nominal = parseFloat(getVal('diskon_nominal')) || 0;
                if (!diskon_nominal) {
                    const tdDiscN = getTdVal('diskonNominalPart');
                    diskon_nominal = parseFloat(tdDiscN.replace(/[^0-9]/g, '')) || 0;
                }

                let total = parseFloat(getVal('total')) || 0;
                if (!total) {
                    const tdTotal = getTdVal('totalPart');
                    total = parseFloat(tdTotal.replace(/[^0-9]/g, '')) || (sub_total - diskon_nominal);
                }

                const badgeMatch = tr.match(/<span[^>]*class="[^"]*kt-badge[^"]*"[^>]*>\s*([^<]+)\s*<\/span>/i);
                const status_permintaan = badgeMatch ? badgeMatch[1].trim() : 'Dipenuhi';

                if (nama_part || kode_part) {
                    parts.push({ kode_part, nama_part, no_transaksi, harga_jual, jumlah, sub_total, diskon_persen, diskon_nominal, total, status_permintaan, status: status_permintaan });
                }
            }

            // 3. Summaries
            const parseVal = (idOrName) => {
                const match = body.match(new RegExp(`id="${idOrName}"[^>]*>\\s*Rp\\.?\\s*([0-9.,]+)`, 'i')) ||
                              body.match(new RegExp(`name="${idOrName}"[^>]*value="([^"]*)"`, 'i')) ||
                              body.match(new RegExp(`value="([^"]*)"[^>]*name="${idOrName}"`, 'i'));
                if (!match) return null;
                const clean = match[1].replace(/\./g, '').replace(/,/g, '.');
                return parseFloat(clean) || 0;
            };

            const pekSubtotal = parseVal('sub_total_pekerjaan_view') ?? parseVal('sum_sub_total_pekerjaan') ?? pekerjaan.reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
            const pekDiskon = parseVal('diskon_pekerjaan_view') ?? parseVal('sum_diskon_pekerjaan') ?? pekerjaan.reduce((s, p) => s + (p.diskon_nominal || 0), 0);
            const pekTotal = parseVal('total_pekerjaan_view') ?? parseVal('sum_total_pekerjaan') ?? (pekSubtotal - pekDiskon);

            let partSubtotal = parseVal('sub_total_part_view') ?? parseVal('sum_sub_total_part') ?? parts.reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
            const rawGrandSub = parseVal('sub_total_view') ?? parseVal('sum_sub_total') ?? 0;
            if (partSubtotal === 0 && rawGrandSub > pekSubtotal) {
                partSubtotal = rawGrandSub - pekSubtotal;
            }

            // Distribute partSubtotal to individual parts if part.sub_total is 0
            if (partSubtotal > 0 && parts.length > 0) {
                const partsWithZeroSub = parts.filter(p => !p.sub_total && !p.harga_jual);
                if (partsWithZeroSub.length > 0) {
                    const totalQtyZero = partsWithZeroSub.reduce((s, p) => s + (p.jumlah || 1), 0);
                    const zeroSubTotalSum = partSubtotal - parts.filter(p => p.sub_total > 0).reduce((s, p) => s + (p.sub_total || 0), 0);

                    if (zeroSubTotalSum > 0 && totalQtyZero > 0) {
                        partsWithZeroSub.forEach(p => {
                            const ratio = (p.jumlah || 1) / totalQtyZero;
                            p.sub_total = Math.round(zeroSubTotalSum * ratio);
                            p.harga_jual = Math.round(p.sub_total / (p.jumlah || 1));
                            p.total = p.sub_total - (p.diskon_nominal || 0);
                        });
                    }
                }
            }

            const partDiskon = parseVal('diskon_part_view') ?? parseVal('sum_diskon_part') ?? parts.reduce((s, p) => s + (p.diskon_nominal || 0), 0);
            const partDpp = partSubtotal - partDiskon;
            const partPpn = Math.round(partDpp * 0.11);
            const partTotal = partDpp + partPpn;

            const grandSubtotal = pekSubtotal + partSubtotal;
            const grandDiskon = pekDiskon + partDiskon;
            const grandDpp = grandSubtotal - grandDiskon;
            const grandPpn = Math.round(grandDpp * 0.11);
            const grandTotal = grandDpp + grandPpn;

            const totalPekerjaan = pekTotal;
            const perintah = pekerjaan.map(p => p.nama_pekerjaan).filter(Boolean).join(', ');

            return res.status(200).json({
                parts,
                pekerjaan,
                totalPekerjaan,
                perintah,
                pekerjaanSummary: { sub_total: pekSubtotal, diskon: pekDiskon, total: pekTotal },
                partsSummary: { sub_total: partSubtotal, diskon: partDiskon, dpp: partDpp, ppn: partPpn, total: partTotal },
                grandSummary: { sub_total: grandSubtotal, diskon: grandDiskon, dpp: grandDpp, ppn: grandPpn, total: grandTotal }
            });
        } catch (err) {
            return res.status(500).json({ error: 'Failed to parse estimasi details from HTML', message: err.message });
        }
    }
    return res.status(500).json({ error: 'Warranty login failed after 2 attempts' });
}

async function getCsrfToken(url, cookie) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const pageResp = await fetchWithHttps(url, {
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': `${BASE}/aftersales/booking`,
            'Accept': 'text/html,*/*',
        },
    });
    const pageHtml = await pageResp.text();
    const tokenMatch = pageHtml.match(/name="_token"\s+value="([^"]+)"/);
    if (!tokenMatch) {
        console.error(`[getCsrfToken] No _token found. Status: ${pageResp.status}, isLogin: ${pageHtml.includes('login')}, snippet: ${pageHtml.slice(0, 200)}`);
    }
    return tokenMatch ? tokenMatch[1] : null;
}

async function handleVehicleSelect(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const term = req.query.term || '';
    const q = req.query.q || '';
    const type = req.query._type || 'query';
    const targetUrl = `${BASE}/aftersales/kendaraan/select?term=${encodeURIComponent(term)}&_type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`;

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }
        const response = await fetchWithHttps(targetUrl, {
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const body = await response.text();
        const isHtml = body.trimStart().startsWith('<');
        if (response.status === 302 || response.status === 401 || isHtml) {
            croCookie = null;
            attempts++;
            continue;
        }
        try {
            const raw = JSON.parse(body);
            const sanitized = (Array.isArray(raw) ? raw : [raw]).map(v => ({
                id_kendaraan: v.id_kendaraan,
                no_polisi: v.no_polisi,
                tipe_kendaraan: v.tipe_kendaraan,
                nama_kendaraan: v.nama_kendaraan,
                tahun_produksi: v.tahun_produksi,
                id_pelanggan: v.id_pelanggan,
                nama_pelanggan: v.nama_pelanggan,
            }));
            return res.status(200).json(sanitized);
        } catch {
            return res.status(500).json({ error: 'Non-JSON response from vehicle select', snippet: body.slice(0, 200) });
        }
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleInternalPartStocks(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const draw = req.query.draw || 1;
    const start = req.query.start || 0;
    const length = req.query.length || 100;
    const q = req.query.q || '';

    const targetUrl = `${BASE}/aftersales/part/data?draw=${draw}&start=${start}&length=${length}` +
        `&columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false` +
        `&columns[1][data]=part_no_stok&columns[1][name]=part_no_stok&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false` +
        `&columns[2][data]=part_name_stok&columns[2][name]=part_name_stok&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false` +
        `&columns[3][data]=hrg_jual_stok&columns[3][name]=hrg_jual_stok&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false` +
        `&columns[4][data]=saldo_akhir_stok&columns[4][name]=saldo_akhir_stok&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false` +
        `&columns[5][data]=lokasi_gudang_stok&columns[5][name]=lokasi_gudang_stok&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false` +
        `&columns[6][data]=gudang_stok&columns[6][name]=gudang_stok&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false` +
        `&order[0][column]=1&order[0][dir]=asc&search[value]=${encodeURIComponent(q)}&search[regex]=false`;

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }
        const response = await fetchWithHttps(targetUrl, {
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/part`,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const body = await response.text();
        const isHtml = body.trimStart().startsWith('<');
        if (response.status === 302 || response.status === 401 || isHtml) {
            croCookie = null;
            attempts++;
            continue;
        }
        try {
            return res.status(200).json(JSON.parse(body));
        } catch {
            return res.status(500).json({ error: 'Non-JSON response from internal parts select', snippet: body.slice(0, 200) });
        }
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingCreate(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }

        const csrf = await getCsrfToken(`${BASE}/aftersales/booking`, croCookie);
        if (!csrf) {
            croCookie = null;
            attempts++;
            continue;
        }

        const createUrl = `${BASE}/aftersales/booking`;
        const formData = new URLSearchParams();
        formData.set('_token', csrf);
        
        const fields = [
            'uniqid', 'id_kendaraan', 'no_polisi', 'model_kendaraan', 'nama_kendaraan',
            'tipe_kendaraan', 'no_chassis', 'group_kendaraan', 'no_pelanggan', 'id_pelanggan',
            'tipe_pelanggan', 'nama_pelanggan', 'no_telp_pelanggan', 'alamat_pelanggan',
            'atas_nama_booking', 'no_telp_booking', 'janji_datang', 'keluhan',
            'booking_via', 'booking_via_personal', 'km'
        ];
        for (const f of fields) {
            const val = req.body[f];
            if (val !== undefined && val !== null) formData.set(f, val);
        }

        const response = await fetchWithHttps(createUrl, {
            method: 'POST',
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString()),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: formData.toString(),
        });

        const respBody = await response.text();
        // 302/303 = Laravel redirect on success
        if (response.status === 302 || response.status === 303) {
            return res.status(200).json({ success: true, message: 'Booking created successfully' });
        }
        // HTTP 200 but with error messages in HTML body (e.g. "Kendaraan Tidak Ditemukan")
        if (response.status === 200) {
            const bodyLower = respBody.toLowerCase();
            const hasError = bodyLower.includes('tidak ditemukan') || bodyLower.includes('validation') || bodyLower.includes('error') || bodyLower.includes('gagal');
            if (hasError) {
                const errorMatch = respBody.match(/<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                const errorMsg = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '').trim() : 'DMS returned validation error';
                return res.status(400).json({ success: false, message: errorMsg, snippet: respBody.slice(0, 500) });
            }
            return res.status(200).json({ success: true, message: 'Booking created successfully' });
        }
        
        return res.status(response.status).json({ success: false, message: `Server returned ${response.status}`, snippet: respBody.slice(0, 300) });
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingReschedule(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing booking ID' });

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }

        const csrf = await getCsrfToken(`${BASE}/aftersales/booking`, croCookie);
        if (!csrf) {
            croCookie = null;
            attempts++;
            continue;
        }

        const rescheduleUrl = `${BASE}/aftersales/booking/reschedule/${id}`;
        const formData = new URLSearchParams();
        formData.set('_token', csrf);
        formData.set('_method', 'patch');
        formData.set('janji_datang', req.body.janji_datang);
        formData.set('alasan_reschedule', req.body.alasan_reschedule || '');

        const response = await fetchWithHttps(rescheduleUrl, {
            method: 'POST',
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString()),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: formData.toString(),
        });

        const respBody = await response.text();
        if (response.status === 302 || response.status === 303 || response.status === 200) {
            return res.status(200).json({ success: true, message: 'Booking rescheduled successfully' });
        }

        return res.status(response.status).json({ success: false, message: `Server returned ${response.status}`, snippet: respBody.slice(0, 300) });
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingCancel(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing booking ID' });

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }

        const csrf = await getCsrfToken(`${BASE}/aftersales/booking`, croCookie);
        if (!csrf) {
            croCookie = null;
            attempts++;
            continue;
        }

        const cancelUrl = `${BASE}/aftersales/booking/cancel/${id}`;
        const formData = new URLSearchParams();
        formData.set('_token', csrf);
        formData.set('_method', 'patch');
        formData.set('alasan_pembatalan', req.body.alasan_pembatalan || '');
        formData.set('dibatalkan_oleh', req.body.dibatalkan_oleh || '');

        const response = await fetchWithHttps(cancelUrl, {
            method: 'POST',
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString()),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: formData.toString(),
        });

        const respBody = await response.text();
        if (response.status === 302 || response.status === 303 || response.status === 200) {
            return res.status(200).json({ success: true, message: 'Booking cancelled successfully' });
        }

        return res.status(response.status).json({ success: false, message: `Server returned ${response.status}`, snippet: respBody.slice(0, 300) });
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingEdit(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing booking ID' });

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }

        const csrf = await getCsrfToken(`${BASE}/aftersales/booking`, croCookie);
        if (!csrf) {
            croCookie = null;
            attempts++;
            continue;
        }

        const editUrl = `${BASE}/aftersales/booking/${id}`;
        const formData = new URLSearchParams();
        formData.set('_token', csrf);
        formData.set('_method', 'patch');
        
        const fields = [
            'id_kendaraan', 'no_polisi', 'nama_kendaraan', 'no_chassis',
            'atas_nama_booking', 'no_telp_booking', 'keluhan', 'booking_via',
            'booking_via_personal', 'km'
        ];
        for (const f of fields) {
            const val = req.body[f];
            if (val !== undefined && val !== null) formData.set(f, val);
        }

        const response = await fetchWithHttps(editUrl, {
            method: 'POST',
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString()),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: formData.toString(),
        });

        const respBody = await response.text();
        if (response.status === 302 || response.status === 303 || response.status === 200) {
            return res.status(200).json({ success: true, message: 'Booking edited successfully' });
        }
        
        return res.status(response.status).json({ success: false, message: `Server returned ${response.status}`, snippet: respBody.slice(0, 300) });
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingData(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const draw = req.query.draw || 1;
    const start = req.query.start || 0;
    const length = req.query.length || 25;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const datefrom = req.query.datefrom || '';
    const dateto = req.query.dateto || '';

    const targetUrl = `${BASE}/aftersales/booking/data?draw=${draw}&start=${start}&length=${length}` +
        `&columns[0][data]=no_booking&columns[0][searchable]=true&columns[0][orderable]=true` +
        `&columns[1][data]=status_booking&columns[1][searchable]=true&columns[1][orderable]=true` +
        `&columns[2][data]=nama_pelanggan&columns[2][searchable]=true&columns[2][orderable]=true` +
        `&columns[3][data]=no_polisi&columns[3][searchable]=true&columns[3][orderable]=true` +
        `&columns[4][data]=nama_kendaraan&columns[4][searchable]=true&columns[4][orderable]=true` +
        `&columns[5][data]=janji_datang&columns[5][searchable]=true&columns[5][orderable]=true` +
        `&columns[6][data]=km&columns[6][searchable]=true&columns[6][orderable]=true` +
        `&columns[7][data]=booking_via&columns[7][searchable]=true&columns[7][orderable]=true` +
        `&columns[8][data]=dibuat_oleh&columns[8][searchable]=true&columns[8][orderable]=true` +
        `&order[0][column]=0&order[0][dir]=desc` +
        `&search[value]=${encodeURIComponent(search)}&search[regex]=false` +
        `&status=${encodeURIComponent(status)}&from=${encodeURIComponent(datefrom)}&to=${encodeURIComponent(dateto)}&_=${Date.now()}`;

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }
        const response = await fetchWithHttps(targetUrl, {
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        const body = await response.text();
        const isHtml = body.trimStart().startsWith('<');
        if (response.status === 302 || response.status === 401 || isHtml) {
            croCookie = null;
            attempts++;
            if (attempts >= 2) {
                return res.status(500).json({ error: 'CRO login failed after 2 attempts', detail: `status=${response.status}, snippet=${body.slice(0,300)}` });
            }
            continue;
        }
        try {
            return res.status(200).json(JSON.parse(body));
        } catch {
            return res.status(500).json({ error: 'Non-JSON response from booking data', snippet: body.slice(0, 200) });
        }
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingEditForm(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing booking ID' });

    const targetUrl = `${BASE}/aftersales/booking/${id}/add-kendaraan`;
    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }
        const response = await fetchWithHttps(targetUrl, {
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Accept': 'text/html,application/xhtml+xml,*/*',
            },
        });
        const body = await response.text();

        if (response.status === 302 || response.status === 401 || body.includes('/aftersales/login')) {
            croCookie = null;
            attempts++;
            continue;
        }

        try {
            const tokenMatch = body.match(/name="_token"\s+value="([^"]+)"/);
            const token = tokenMatch ? tokenMatch[1] : '';

            const getVal = (name) => {
                const r = new RegExp(`name="${name}"[^>]*value="([^"]*)"`);
                const m = r.exec(body);
                return m ? m[1] : '';
            };
            const values = {
                no_polisi: getVal('no_polisi'),
                no_chassis: getVal('no_chassis'),
                no_engine: getVal('no_engine'),
                id_tipe: getVal('id_tipe'),
                kode_warna: getVal('kode_warna'),
                nik: getVal('nik'),
                no_telp: getVal('no_telp'),
                nama_pelanggan: getVal('nama_pelanggan'),
                kota: getVal('kota'),
                alamat: getVal('alamat'),
            };

            const extractOptions = (selectName) => {
                const opts = [];
                const selMatch = body.match(new RegExp(`<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i'));
                if (selMatch) {
                    const optRegex = /<option\s+value="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/g;
                    let m;
                    while ((m = optRegex.exec(selMatch[1])) !== null) {
                        opts.push({
                            value: m[1],
                            label: m[3].trim().replace(/<[^>]*>/g, ''),
                            selected: m[2].includes('selected')
                        });
                    }
                }
                return opts;
            };

            return res.status(200).json({
                success: true,
                token,
                values,
                tipeOptions: extractOptions('id_tipe'),
                warnaOptions: extractOptions('kode_warna'),
            });
        } catch (err) {
            return res.status(500).json({ error: 'Failed to parse booking edit form', message: err.message });
        }
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

async function handleBookingUpdate(req, res) {
    const BASE = process.env.WARRANTY_BASE_URL;
    const id = req.query.id || '';
    if (!id) return res.status(400).json({ error: 'Missing booking ID' });

    let attempts = 0;
    while (attempts < 2) {
        if (!croCookie || Date.now() > croCookieExpiry) {
            croCookie = await croLogin();
        }

        const editPageUrl = `${BASE}/aftersales/booking/${id}/add-kendaraan`;
        const editResp = await fetchWithHttps(editPageUrl, {
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking`,
                'Accept': 'text/html,*/*',
            },
        });
        const editHtml = await editResp.text();

        if (editResp.status === 302 || editResp.status === 401 || editHtml.includes('/aftersales/login')) {
            croCookie = null;
            attempts++;
            continue;
        }

        const tokenMatch = editHtml.match(/name="_token"\s+value="([^"]+)"/);
        const csrf = tokenMatch ? tokenMatch[1] : '';
        if (!csrf) {
            return res.status(500).json({ error: 'Cannot extract CSRF token from edit page' });
        }

        const updateUrl = `${BASE}/aftersales/booking/update-kendaraan/${id}`;
        const formData = new URLSearchParams();
        formData.set('_token', csrf);
        formData.set('_method', 'patch');
        const fields = ['no_polisi','no_chassis','no_engine','id_tipe','kode_warna','nik','no_telp','nama_pelanggan','kota','alamat'];
        for (const f of fields) {
            const val = req.body[f];
            if (val !== undefined && val !== null) formData.set(f, val);
        }

        const updateResp = await fetchWithHttps(updateUrl, {
            method: 'POST',
            headers: {
                'Cookie': croCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/booking/${id}/add-kendaraan`,
                'Origin': BASE,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString()),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: formData.toString(),
        });

        const respBody = await updateResp.text();
        const isHtml = respBody.trimStart().startsWith('<');
        if (updateResp.status === 302 || updateResp.status === 303) {
            return res.status(200).json({ success: true, message: 'Booking updated successfully' });
        }
        if (isHtml && respBody.includes('alert-success')) {
            return res.status(200).json({ success: true, message: 'Booking updated successfully' });
        }
        if (isHtml && respBody.includes('alert-danger')) {
            const errMatch = respBody.match(/alert-danger[^>]*>([\s\S]*?)<\/div>/);
            const errMsg = errMatch ? errMatch[1].replace(/<[^>]*>/g, '').trim() : 'Validation error';
            return res.status(400).json({ success: false, message: errMsg });
        }
        if (!isHtml) {
            try {
                const json = JSON.parse(respBody);
                return res.status(updateResp.ok ? 200 : 400).json(json);
            } catch { }
        }

        return res.status(updateResp.ok ? 200 : 400).json({
            success: updateResp.ok,
            message: updateResp.ok ? 'Booking updated' : `Server returned ${updateResp.status}`
        });
    }
    return res.status(500).json({ error: 'CRO login failed after 2 attempts' });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Ensure req.body is parsed if passed as string or Buffer by Vercel
    if (req.body) {
        let rawBody = req.body;
        if (Buffer.isBuffer(rawBody)) {
            rawBody = rawBody.toString('utf8');
        }
        if (typeof rawBody === 'string' && rawBody.trim()) {
            if (req.headers['content-type']?.includes('x-www-form-urlencoded')) {
                try {
                    const parsed = {};
                    const params = new URLSearchParams(rawBody);
                    for (const [key, value] of params.entries()) {
                        parsed[key] = value;
                    }
                    req.body = parsed;
                } catch (e) {
                    console.error('Failed parsing urlencoded body string:', e);
                }
            } else if (req.headers['content-type']?.includes('application/json')) {
                try {
                    req.body = JSON.parse(rawBody);
                } catch (e) {}
            }
        }
    }

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

    if (endpoint === 'warranty-estimasi-detail') {
        return handleWarrantyEstimasiDetail(req, res);
    }

    // ============================================================
    // WARRANTY SEARCH BY VIN — proxied to 103.160.12.43/aftersales
    // ============================================================
    if (endpoint === 'warranty-search-vin') {
        const BASE = process.env.WARRANTY_BASE_URL;
        const vin = req.query.vin || '';
        const draw = req.query.draw || 1;
        const start = req.query.start || 0;
        const length = req.query.length || 50;
        const from = req.query.from || '';
        const to   = req.query.to   || '';

        const columnsConfig =
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
            `&columns[19][data]=kategori&columns[19][name]=kategori&columns[19][searchable]=true&columns[19][orderable]=true&columns[19][search][value]=&columns[19][search][regex]=false` +
            `&columns[20][data]=perintah&columns[20][name]=perintah&columns[20][searchable]=true&columns[20][orderable]=true&columns[20][search][value]=&columns[20][search][regex]=false` +
            `&columns[21][data]=stand_km&columns[21][name]=stand_km&columns[21][searchable]=true&columns[21][orderable]=true&columns[21][search][value]=&columns[21][search][regex]=false` +
            `&columns[22][data]=id_wo&columns[22][name]=id_wo&columns[22][searchable]=true&columns[22][orderable]=true&columns[22][search][value]=&columns[22][search][regex]=false` +
            `&order[0][column]=18&order[0][dir]=desc` +
            `&search[value]=${encodeURIComponent(vin)}&search[regex]=false` +
            `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&_=${Date.now()}`;

        // Fetch ALL statuses in one request (no status filter = all non-excluded statuses)
        const targetUrl = `${BASE}/aftersales/work-order/data?draw=${draw}&start=${start}&length=${length}${columnsConfig}&status=`;
        let wAttempts = 0;
        let allData = [];
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
                const parsed = JSON.parse(body);
                allData = parsed.data && Array.isArray(parsed.data) ? parsed.data : [];
            } catch { /* skip */ }
            break;
        }

        return res.status(200).json({ data: allData });
    }

    if (endpoint === 'vehicle-select' || endpoint === 'internal-part-stocks' || endpoint.startsWith('booking-')) {
        try {
            if (endpoint === 'vehicle-select') return await handleVehicleSelect(req, res);
            if (endpoint === 'internal-part-stocks') return await handleInternalPartStocks(req, res);
            if (endpoint === 'booking-create') return await handleBookingCreate(req, res);
            if (endpoint === 'booking-reschedule') return await handleBookingReschedule(req, res);
            if (endpoint === 'booking-edit') return await handleBookingEdit(req, res);
            if (endpoint === 'booking-cancel') return await handleBookingCancel(req, res);
            if (endpoint === 'booking-data') return await handleBookingData(req, res);
            if (endpoint === 'booking-edit-form') return await handleBookingEditForm(req, res);
            if (endpoint === 'booking-update') return await handleBookingUpdate(req, res);
        } catch (error) {
            console.error('[Booking Error]', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    try {
        const username = process.env.DMS_USER;
        const password = process.env.DMS_PASS;
        const enterpriseCode = process.env.DMS_ENTERPRISE_CODE;

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
            
            if (endpoint === 'download_file') {
                const fileId = req.query.id || '';
                const urls = [
                    `https://dms.chery.co.id/api/v1/files/download/${fileId}`,
                    `https://dms.chery.co.id/afterSales/api/v1/files/download/${fileId}`,
                    `https://dms.chery.co.id/api/v1/files/${fileId}`
                ];
                let fileResp = null;
                const fetchOptions = {
                    method: method,
                    headers: {
                        'Cookie': cachedCookie,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                        'Referer': 'https://dms.chery.co.id/',
                        'Origin': 'https://dms.chery.co.id',
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    }
                };
                for (const url of urls) {
                    const r = await fetchWithHttps(url, fetchOptions);
                    if (r.ok) {
                        fileResp = r;
                        break;
                    }
                }
                if (fileResp) {
                    const contentType = fileResp.headers.get('content-type') || 'image/jpeg';
                    res.setHeader('Content-Type', contentType);
                    const buf = await fileResp.buffer();
                    return res.status(200).send(buf);
                }
                const firstTry = await fetchWithHttps(urls[0], fetchOptions);
                if (firstTry.status === 401 || firstTry.status === 403) {
                    console.log("⚠️ Session expired during file download, retrying login...");
                    cachedCookie = null;
                    attempts++;
                    continue;
                }
                return res.status(404).json({ error: "File not found or unauthorized on any DMS endpoint" });
            }

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
            } else if (endpoint === 'repair-contracts') {
                const beginCreateTime = req.query.beginCreateTime || '';
                const endCreateTime = req.query.endCreateTime || '';
                const rcPageSize = 50;
                targetUrl = `https://dms.chery.co.id/dms/afterSales/api/v1/repairContracts?pageIndex=0&pageSize=${rcPageSize}`;
                if (beginCreateTime) targetUrl += `&beginCreateTime=${encodeURIComponent(beginCreateTime)}`;
                if (endCreateTime) targetUrl += `&endCreateTime=${encodeURIComponent(endCreateTime)}`;
            } else if (endpoint === 'repair-contract-detail') {
                const id = req.query.id || '';
                targetUrl = `https://dms.chery.co.id/afterSales/api/v1/repairContracts/${id}`;
            } else if (endpoint === 'part_orders_search') {
                const q = (req.query.q || '').trim().toLowerCase();
                const opts = {
                    method: 'GET',
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
                const DMS_BASE = 'https://dms.chery.co.id/parts/api/v1/partSaleOrders';

                let directSearchOrders = [];
                if (q) {
                    const queryParams = [`code=${encodeURIComponent(q)}`, `orderCode=${encodeURIComponent(q)}`, `partSaleOrderCode=${encodeURIComponent(q)}`, `chassisNo=${encodeURIComponent(q)}`, `vin=${encodeURIComponent(q)}`];
                    for (const param of queryParams) {
                        try {
                            const sResp = await fetchWithHttps(`${DMS_BASE}/forCurrentUser?pageIndex=0&pageSize=50&isBuyer=true&${param}`, opts);
                            if (sResp.status === 401 || sResp.status === 403) {
                                cachedCookie = null;
                                attempts++;
                                break;
                            }
                            const sRes = await sResp.json();
                            const sContent = (sRes?.payload || sRes)?.content || [];
                            if (Array.isArray(sContent) && sContent.length > 0) {
                                directSearchOrders.push(...sContent);
                            }
                        } catch (e) {}
                    }
                    if (cachedCookie === null && attempts < 2) continue;
                }

                const countResp = await fetchWithHttps(`${DMS_BASE}/forCurrentUser?pageIndex=0&pageSize=50&isBuyer=true`, opts);
                if (countResp.status === 401 || countResp.status === 403) {
                    cachedCookie = null;
                    attempts++;
                    continue;
                }
                const countResult = await countResp.json();
                const payload = countResult?.payload || countResult || {};
                const totalPages = payload.totalPages || 1;
                let orders = Array.isArray(payload.content) ? [...payload.content] : [];

                directSearchOrders.forEach(ds => {
                    if (!orders.some(o => o && o.id === ds.id)) {
                        orders.push(ds);
                    }
                });

                if (totalPages > 1) {
                    const MAX_PAGES = Math.min(totalPages, 20);
                    for (let p = 1; p < MAX_PAGES; p += 5) {
                        const pageBatch = [];
                        for (let j = p; j < Math.min(p + 5, MAX_PAGES); j++) {
                            pageBatch.push(j);
                        }
                        const pageResults = await Promise.allSettled(
                            pageBatch.map(pg =>
                                fetchWithHttps(`${DMS_BASE}/forCurrentUser?pageIndex=${pg}&pageSize=50&isBuyer=true`, opts)
                                    .then(r => r.json())
                            )
                        );
                        pageResults.forEach(r => {
                            if (r.status === 'fulfilled') {
                                const pContent = (r.value?.payload || r.value)?.content || [];
                                if (Array.isArray(pContent)) {
                                    pContent.forEach(item => {
                                        if (item && !orders.some(o => o && o.id === item.id)) {
                                            orders.push(item);
                                        }
                                    });
                                }
                            }
                        });
                    }
                }

                const matchedIds = new Set();
                const unmatched = [];

                orders.forEach(o => {
                    if (!o) return;
                    const orderStr = Object.values(o).filter(v => typeof v === 'string' || typeof v === 'number').join(' ');
                    if (!q || orderStr.toLowerCase().includes(q)) {
                        matchedIds.add(o.id);
                    } else {
                        unmatched.push(o);
                    }
                });

                if (q && unmatched.length > 0) {
                    const BATCH_SIZE = 15;
                    const MAX_DETAIL_FETCHES = 100;
                    const toFetch = unmatched.slice(0, MAX_DETAIL_FETCHES);
                    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
                        const batch = toFetch.slice(i, i + BATCH_SIZE);
                        const detailResults = await Promise.allSettled(
                            batch.map(o =>
                                fetchWithHttps(`${DMS_BASE}/${o.id}`, opts).then(r => r.json())
                            )
                        );
                        detailResults.forEach((r) => {
                            if (r.status === 'fulfilled') {
                                const d = r.value?.payload || r.value;
                                if (!d || !d.id) return;
                                const dStr = JSON.stringify(d).toLowerCase();
                                if (dStr.includes(q)) {
                                    matchedIds.add(d.id);
                                }
                            }
                        });
                    }
                }

                const matchedOrders = orders.filter(o => o && matchedIds.has(o.id));
                const withDetails = await Promise.all(matchedOrders.map(async (o) => {
                    try {
                        const dr = await fetchWithHttps(`${DMS_BASE}/${o.id}`, opts);
                        const dj = await dr.json();
                        return { ...o, _detail: dj?.payload || dj };
                    } catch { return o; }
                }));

                data = { payload: { content: withDetails, totalPages: 1, totalElements: withDetails.length } };
            } else if (endpoint === 'dms-part-stocks') {
                targetUrl = `https://dms.chery.co.id/dms/parts/api/v1/partStocks/forRetail?pageIndex=${pageIndex}&pageSize=${pageSize}`;
                if (code) targetUrl += `&partCode=${encodeURIComponent(code)}`;
                if (name) targetUrl += `&partName=${encodeURIComponent(name)}`;
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

        if (endpoint === 'repair-contracts' && data?.payload) {
            const rcPayload = data.payload;
            const totalPages = rcPayload.totalPages || 1;
            if (totalPages > 1) {
                let allContent = rcPayload.content || [];
                const beginCreateTime = req.query.beginCreateTime || '';
                const endCreateTime = req.query.endCreateTime || '';
                let urlSuffix = '';
                if (beginCreateTime) urlSuffix += `&beginCreateTime=${encodeURIComponent(beginCreateTime)}`;
                if (endCreateTime) urlSuffix += `&endCreateTime=${encodeURIComponent(endCreateTime)}`;

                const rcHeaders = {
                    'Cookie': cachedCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                    'Referer': 'https://dms.chery.co.id/',
                    'Origin': 'https://dms.chery.co.id',
                    'Accept': 'application/json, application/vnd.api+json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/json',
                    'Connection': 'keep-alive'
                };
                const rcPageSize = 50;

                for (let p = 1; p < totalPages && p < 50; p += 5) {
                    const batch = [];
                    for (let j = p; j < Math.min(p + 5, totalPages); j++) {
                        batch.push(j);
                    }
                    const results = await Promise.allSettled(
                        batch.map(pg =>
                            fetchWithHttps(
                                `https://dms.chery.co.id/dms/afterSales/api/v1/repairContracts?pageIndex=${pg}&pageSize=${rcPageSize}${urlSuffix}`,
                                { method: 'GET', headers: rcHeaders }
                            ).then(r => r.json())
                        )
                    );
                    results.forEach(r => {
                        if (r.status === 'fulfilled') {
                            const items = r.value?.payload?.content || r.value?.content || [];
                            allContent = allContent.concat(items);
                        }
                    });
                }

                data = {
                    payload: {
                        content: allContent,
                        pageSize: allContent.length,
                        pageIndex: 0,
                        totalPages: 1,
                        totalElements: allContent.length
                    }
                };
            }
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("❌ Chery DMS Proxy Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
