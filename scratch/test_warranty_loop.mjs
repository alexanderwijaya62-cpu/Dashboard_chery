import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const nativeRequire = createRequire(import.meta.url);
const http = nativeRequire('node:http');
const https = nativeRequire('node:https');
const urllib = nativeRequire('node:url');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom parsing of .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.replace(/\\n/gm, '\n');
      }
      process.env[key] = value.replace(/(^['"]|['"]$)/g, '');
    }
  });
}

const httpsAgent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false
});

function fetchWithHttps(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
        let fullUrl = urlStr;
        let u = new urllib.URL(fullUrl);
        const isHttps = u.protocol === 'https:';
        const client = isHttps ? https : http;
        const timeout = 15000;

        const reqOptions = {
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            agent: isHttps ? httpsAgent : undefined,
            timeout,
        };

        const req = client.request(reqOptions, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    text: () => buffer.toString('utf8'),
                    getSetCookie: () => {
                        const raw = res.headers['set-cookie'];
                        return Array.isArray(raw) ? raw : (raw ? [raw] : []);
                    }
                });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function test() {
    const BASE = process.env.WARRANTY_BASE_URL || 'http://103.160.12.43';
    console.log('Base URL:', BASE);
    const USER = process.env.WARRANTY_USER;
    const PASS = process.env.WARRANTY_PASS;
    const TOKEN = process.env.WARRANTY_TOKEN;
    const DEALER = process.env.WARRANTY_KODE_DEALER;
    const DEPT = process.env.WARRANTY_DEPT;

    console.log(`Creds: user=${USER}, dealer=${DEALER}, dept=${DEPT}`);

    // Step 1: GET login
    console.log('GET login page...');
    const loginPage = await fetchWithHttps(`${BASE}/aftersales/login`);
    console.log('Login page status:', loginPage.status);
    
    let jar = {};
    for (const c of loginPage.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    const html = await loginPage.text();
    const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    console.log('CSRF Token:', csrf);

    // Step 2: POST login
    console.log('POST login...');
    const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
    const loginRes = await fetchWithHttps(`${BASE}/aftersales/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),
        },
        body: loginBody
    });
    console.log('Login POST response status:', loginRes.status);
    for (const c of loginRes.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    // Step 3: GET token
    const cookieStr = () => Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');
    console.log('GET token page...');
    const tokenPage = await fetchWithHttps(`${BASE}/aftersales/token`, {
        headers: { 'Cookie': cookieStr() }
    });
    console.log('Token page status:', tokenPage.status);
    const tokenHtml = await tokenPage.text();
    for (const c of tokenPage.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    const tokenCsrfMatch = tokenHtml.match(/name="_token"\s+value="([^"]+)"/);
    const tokenCsrf = tokenCsrfMatch ? tokenCsrfMatch[1] : csrf;

    // Step 4: POST token
    console.log('POST token select...');
    const tokenBody = new URLSearchParams({ _token: tokenCsrf, kode_dealer: DEALER, token: TOKEN, dept_hidden: DEPT }).toString();
    const tokenRes = await fetchWithHttps(`${BASE}/aftersales/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieStr(),
        },
        body: tokenBody
    });
    console.log('Token POST status:', tokenRes.status);
    for (const c of tokenRes.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }

    // Step 5: Test work-order/data with page size 1000 and 100
    const testFetch = async (length) => {
        const url = `${BASE}/aftersales/work-order/data?draw=1&start=0&length=${length}&status=&kategori=`;
        console.log(`Fetching work orders with length=${length}...`);
        const start = Date.now();
        const res = await fetchWithHttps(url, {
            headers: {
                'Cookie': cookieStr(),
                'X-Requested-With': 'XMLHttpRequest',
            }
        });
        const duration = Date.now() - start;
        console.log(`Fetch duration for length=${length}: ${duration}ms, status: ${res.status}`);
        const text = await res.text();
        console.log(`Body length: ${text.length}`);
        console.log('Snippet:', text.slice(0, 300));
    };

    try {
        await testFetch(100);
        await testFetch(1000);
    } catch (e) {
        console.error('Error during work-order fetch:', e);
    }
}

test().catch(console.error);
