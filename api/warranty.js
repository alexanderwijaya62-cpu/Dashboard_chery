import https from 'https';
import urllib from 'url';

const BASE_URL = process.env.WARRANTY_BASE_URL || 'https://103.160.12.43';
const WARRANTY_USER = process.env.WARRANTY_USER || 'nisa';
const WARRANTY_PASS = process.env.WARRANTY_PASS || 'qwerty12345';
const WARRANTY_TOKEN = process.env.WARRANTY_TOKEN || '6aad5b';
const KODE_DEALER = process.env.WARRANTY_KODE_DEALER || 'MOS';
const DEPT = process.env.WARRANTY_DEPT || 'S';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 32,
});

let cachedCookie = null;
let cookieExpiry = 0;

// Parse Set-Cookie headers into a cookie jar object
function parseCookies(setCookieArr, existing = {}) {
  const jar = { ...existing };
  for (const c of setCookieArr) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      jar[name] = value;
    }
  }
  return jar;
}

function jarToString(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Low-level fetch — does NOT follow redirects automatically
function rawFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new urllib.URL(urlStr);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: httpsAgent,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          setCookies: (() => {
            const raw = res.headers['set-cookie'];
            return Array.isArray(raw) ? raw : raw ? [raw] : [];
          })(),
          location: res.headers['location'] || null,
          body: buffer.toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Fetch with automatic redirect following, accumulating cookies
async function fetchFollowRedirects(urlStr, options = {}, cookieJar = {}, maxRedirects = 5) {
  let currentUrl = urlStr;
  let currentOptions = { ...options };
  let jar = { ...cookieJar };
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const cookieStr = jarToString(jar);
    const headers = {
      ...currentOptions.headers,
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
    };

    const res = await rawFetch(currentUrl, { ...currentOptions, headers });

    // Accumulate cookies from this response
    jar = parseCookies(res.setCookies, jar);

    if ((res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307) && res.location) {
      // Resolve relative redirects
      let nextUrl = res.location;
      if (nextUrl.startsWith('/')) {
        const u = new urllib.URL(currentUrl);
        nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
      }
      console.log(`[Warranty] Redirect ${res.status} → ${nextUrl}`);
      currentUrl = nextUrl;
      // After redirect, use GET (standard browser behavior for 302/303)
      if (res.status !== 307) {
        const newHeaders = { ...currentOptions.headers };
        delete newHeaders['Content-Length'];
        delete newHeaders['content-length'];
        delete newHeaders['Content-Type'];
        delete newHeaders['content-type'];
        currentOptions = { method: 'GET', headers: newHeaders };
        delete currentOptions.body;
      }
      redirectCount++;
      continue;
    }

    return { ...res, finalUrl: currentUrl, cookieJar: jar };
  }

  throw new Error('Too many redirects');
}

async function login() {
  console.log('[Warranty] Step 1: GET login page for CSRF token...');
  let jar = {};

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  };

  // Step 1: GET login page
  const loginPage = await fetchFollowRedirects(`${BASE_URL}/aftersales/login`, { headers: baseHeaders }, jar);
  jar = loginPage.cookieJar;

  const csrfMatch = loginPage.body.match(/name="_token"\s+value="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  console.log(`[Warranty] CSRF: ${csrfToken ? csrfToken.slice(0, 10) + '...' : 'NOT FOUND'}`);

  if (!csrfToken) {
    console.error('[Warranty] Login page HTML snippet:', loginPage.body.slice(0, 500));
    throw new Error('Could not extract CSRF token from login page');
  }

  // Step 2: POST login
  console.log('[Warranty] Step 2: POST login...');
  const loginBody = new URLSearchParams({
    _token: csrfToken,
    username: WARRANTY_USER,
    password: WARRANTY_PASS,
  }).toString();

  const loginRes = await fetchFollowRedirects(
    `${BASE_URL}/aftersales/login`,
    {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(loginBody)),
        'Referer': `${BASE_URL}/aftersales/login`,
        'Origin': BASE_URL,
      },
      body: loginBody,
    },
    jar
  );
  jar = loginRes.cookieJar;
  console.log(`[Warranty] After login, landed at: ${loginRes.finalUrl}, status: ${loginRes.status}`);

  // Step 3: GET token page
  console.log('[Warranty] Step 3: GET token selection page...');
  const tokenPage = await fetchFollowRedirects(
    `${BASE_URL}/aftersales/token`,
    { headers: { ...baseHeaders, 'Referer': `${BASE_URL}/aftersales/` } },
    jar
  );
  jar = tokenPage.cookieJar;

  const tokenCsrfMatch = tokenPage.body.match(/name="_token"\s+value="([^"]+)"/);
  const tokenCsrf = tokenCsrfMatch ? tokenCsrfMatch[1] : csrfToken;
  console.log(`[Warranty] Token page CSRF: ${tokenCsrf ? tokenCsrf.slice(0, 10) + '...' : 'NOT FOUND'}`);

  // Step 4: POST token (select dealer/dept)
  console.log('[Warranty] Step 4: POST token selection...');
  const tokenBody = new URLSearchParams({
    _token: tokenCsrf,
    kode_dealer: KODE_DEALER,
    token: WARRANTY_TOKEN,
    dept_hidden: DEPT,
  }).toString();

  const tokenRes = await fetchFollowRedirects(
    `${BASE_URL}/aftersales/token`,
    {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(tokenBody)),
        'Referer': `${BASE_URL}/aftersales/token`,
        'Origin': BASE_URL,
      },
      body: tokenBody,
    },
    jar
  );
  jar = tokenRes.cookieJar;
  console.log(`[Warranty] After token POST, landed at: ${tokenRes.finalUrl}, status: ${tokenRes.status}`);

  const cookieStr = jarToString(jar);
  if (!cookieStr) throw new Error('No cookies after login flow');

  cachedCookie = cookieStr;
  cookieExpiry = Date.now() + 90 * 60 * 1000;
  console.log('[Warranty] ✅ Login complete. Cookies:', Object.keys(jar).join(', '));
  return cachedCookie;
}

async function getSession() {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;
  return await login();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = req.query.endpoint || 'work-order';

  try {
    let cookie = await getSession();

    let targetUrl = '';
    if (endpoint === 'work-order') {
      const draw = req.query.draw || 1;
      const start = req.query.start || 0;
      const length = req.query.length || 25;
      const search = req.query.search || '';
      const status = req.query.status || '';
      const from = req.query.from || '';
      const to = req.query.to || '';

      targetUrl =
        `${BASE_URL}/aftersales/work-order/data` +
        `?draw=${draw}&start=${start}&length=${length}` +
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
        `&status=${encodeURIComponent(status)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
        `&_=${Date.now()}`;
    } else {
      return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    }

    let attempts = 0;
    while (attempts < 2) {
      const response = await rawFetch(targetUrl, {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `${BASE_URL}/aftersales/work-order`,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      // Check if we got HTML back (session expired / redirected to login)
      const isHtml = response.body.trimStart().startsWith('<');
      if (response.status === 302 || response.status === 401 || isHtml) {
        console.log(`[Warranty] Session invalid (status=${response.status}, isHtml=${isHtml}), re-logging in...`);
        cachedCookie = null;
        cookie = await login();
        attempts++;
        continue;
      }

      try {
        const data = JSON.parse(response.body);
        return res.status(200).json(data);
      } catch (parseErr) {
        console.error('[Warranty] JSON parse error. Body snippet:', response.body.slice(0, 200));
        return res.status(500).json({ error: 'Server returned non-JSON response', snippet: response.body.slice(0, 200) });
      }
    }

    return res.status(500).json({ error: 'Failed after 2 login attempts' });

  } catch (err) {
    console.error('[Warranty] Error:', err.message);
    cachedCookie = null;
    return res.status(500).json({ error: err.message });
  }
}
