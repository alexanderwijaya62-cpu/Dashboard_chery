import fs from 'fs';
import path from 'path';
import https from 'https';
import urllib from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hardcoded credentials
process.env.WARRANTY_USER = 'nisa';
process.env.WARRANTY_PASS = 'qwerty12345';
process.env.WARRANTY_TOKEN = '6aad5b';
process.env.WARRANTY_KODE_DEALER = 'MOS';
process.env.WARRANTY_DEPT = 'S';
process.env.WARRANTY_BASE_URL = 'https://103.160.12.43';

try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
                const key = trimmed.slice(0, idx).trim();
                let value = trimmed.slice(idx + 1).trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.error("Failed to parse .env file:", e);
}

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

async function run() {
    const BASE = process.env.WARRANTY_BASE_URL;
    const PUBLIC_HOST = 'https://dms.chery.co.id';
    const USER = process.env.WARRANTY_USER;
    const PASS = process.env.WARRANTY_PASS;
    const TOKEN = process.env.WARRANTY_TOKEN;
    const DEALER = process.env.WARRANTY_KODE_DEALER;
    const DEPT = process.env.WARRANTY_DEPT;

    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
    };

    console.log("Fetching login page...");
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

    const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
    const loginRes = await fetchWithHttps(`${BASE}/aftersales/login`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginBody), 'Cookie': Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '), 'Referer': `${PUBLIC_HOST}/aftersales/login`, 'Origin': PUBLIC_HOST },
        body: loginBody,
    });
    
    for (const c of loginRes.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const cookieStr = () => Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');
    const tokenPage = await fetchWithHttps(`${BASE}/aftersales/token`, { headers: { ...baseHeaders, 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/` } });
    
    for (const c of tokenPage.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const tokenHtml = await tokenPage.text();
    const tokenCsrfMatch = tokenHtml.match(/name="_token"\s+value="([^"]+)"/);
    const tokenCsrf = tokenCsrfMatch ? tokenCsrfMatch[1] : csrf;

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

    const finalCookie = cookieStr();
    console.log("✅ Authenticated!");

    // Fetch without search value
    const targetUrl = `${BASE}/aftersales/work-order/data?draw=1&start=0&length=20` +
        `&columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false` +
        `&columns[1][data]=no_wo&columns[1][name]=no_wo&columns[1][searchable]=true&columns[1][orderable]=true` +
        `&columns[2][data]=no_wo_dms&columns[2][name]=no_wo_dms&columns[2][searchable]=true&columns[2][orderable]=true` +
        `&columns[3][data]=status&columns[3][name]=status&columns[3][searchable]=true&columns[3][orderable]=true` +
        `&columns[19][data]=kategori&columns[19][name]=kategori&columns[19][searchable]=true&columns[19][orderable]=true` +
        `&columns[20][data]=perintah&columns[20][name]=perintah&columns[20][searchable]=true&columns[20][orderable]=true` +
        `&columns[21][data]=stand_km&columns[21][name]=stand_km&columns[21][searchable]=true&columns[21][orderable]=true` +
        `&columns[22][data]=id_wo&columns[22][name]=id_wo&columns[22][searchable]=true&columns[22][orderable]=true` +
        `&order[0][column]=1&order[0][dir]=desc` +
        `&search[value]=&search[regex]=false` +
        `&status=&from=&to=&_=${Date.now()}`;

    console.log(`Fetching 20 recent work orders...`);
    const dataResp = await fetchWithHttps(targetUrl, {
        headers: {
            'Cookie': finalCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': `${BASE}/aftersales/work-order`,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
        }
    });

    console.log("Response status:", dataResp.status);
    const dataJson = await dataResp.json();
    console.log("Work orders found:", JSON.stringify(dataJson.data ? dataJson.data.slice(0, 5) : [], null, 2));
}

run().catch(console.error);
