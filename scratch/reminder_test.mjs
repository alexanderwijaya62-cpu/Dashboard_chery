import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// Load .env
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const BASE = (process.env.WARRANTY_BASE_URL || 'http://103.160.12.43').replace('https://103.160.12.43', 'http://103.160.12.43');
const PUBLIC_HOST = 'https://dms.chery.co.id';

function fetchHttps(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false,
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          setCookie: res.headers['set-cookie'] || [],
          text: async () => buf.toString('utf8'),
          json: async () => JSON.parse(buf.toString('utf8')),
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function login(isCro) {
  const USER = isCro ? process.env.CRO_USER : process.env.WARRANTY_USER;
  const PASS = isCro ? process.env.CRO_PASS : process.env.WARRANTY_PASS;
  const TOKEN = isCro ? process.env.CRO_TOKEN : process.env.WARRANTY_TOKEN;
  const DEALER = process.env.WARRANTY_KODE_DEALER;
  const DEPT = process.env.WARRANTY_DEPT;

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
  };

  const loginPage = await fetchHttps(`${BASE}/aftersales/login`, { headers: baseHeaders });
  const loginHtml = await loginPage.text();
  let jar = {};
  for (const c of loginPage.setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  const csrfMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  if (!csrf) throw new Error(`[${isCro ? 'CRO' : 'Warranty'}] no csrf`);

  const cookieStr = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
  const loginRes = await fetchHttps(`${BASE}/aftersales/login`, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginBody), 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/login`, 'Origin': PUBLIC_HOST },
    body: loginBody,
  });
  for (const c of loginRes.setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }

  const tokenPage = await fetchHttps(`${BASE}/aftersales/token`, { headers: { ...baseHeaders, 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/` } });
  if (tokenPage.status === 302) {
    return cookieStr();
  }
  const tokenHtml = await tokenPage.text();
  for (const c of tokenPage.setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  const tokenCsrfMatch = tokenHtml.match(/name="_token"\s+value="([^"]+)"/);
  const tokenCsrf = tokenCsrfMatch ? tokenCsrfMatch[1] : csrf;
  const tokenBody = new URLSearchParams({ _token: tokenCsrf, kode_dealer: DEALER, token: TOKEN, dept_hidden: DEPT }).toString();
  await fetchHttps(`${BASE}/aftersales/token`, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody), 'Cookie': cookieStr(), 'Referer': `${BASE}/aftersales/token`, 'Origin': BASE },
    body: tokenBody,
  });
  for (const c of tokenPage.setCookie) {
    // (cookies usually refreshed here too; re-read below)
  }
  const finalCookie = cookieStr();
  return finalCookie;
}

async function tryAccount(isCro) {
  try {
    console.log(`\n===== Login ${isCro ? 'CRO' : 'Warranty'} =====`);
    const cookie = await login(isCro);
    console.log('cookie length:', cookie.length);

    const doFrom = '01-01-2026';
    const doTo = '31-12-2026';
    const url = `${BASE}/aftersales/reminder-do/data?do_from=${doFrom}&do_to=${doTo}&status_filter=all&grup=&_=${Date.now()}`;
    const resp = await fetchHttps(url, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${BASE}/aftersales/reminder-do`,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const text = await resp.text();
    console.log('status:', resp.status);
    console.log('first 150 chars:', text.slice(0, 150));

    if (resp.status === 302 || text.trimStart().startsWith('<')) {
      console.log('=> Redirected/HTML (session tidak valid untuk akun ini)');
      return null;
    }
    const json = JSON.parse(text);
    console.log('recordsTotal:', json.recordsTotal, 'recordsFiltered:', json.recordsFiltered, 'returned rows:', json.data?.length);
    const first = json.data?.[0];
    if (first) {
      console.log('keys:', Object.keys(first).join(', '));
      console.log('sample: nama=', first.nama, '| no_rangka=', first.no_rangka, '| no_polisi=', first.no_polisi, '| tipe=', first.tipe, '| no_hp=', first.no_hp, '| tgl_do=', first.tgl_do, '| expected_service=', first.expected_service, '| service_terakhir=', first.service_terakhir);
      console.log('wo count:', first.wo?.length);
      if (first.wo?.[0]) {
        console.log('wo[0]: no_wo=', first.wo[0].no_wo, '| kategori=', first.wo[0].kategori, '| waktu_masuk=', first.wo[0].waktu_masuk, '| waktu_selesai=', first.wo[0].waktu_selesai, '| perintah=', first.wo[0].perintah, '| status=', first.wo[0].status);
      }
      const withWo = json.data.find(r => Array.isArray(r.wo) && r.wo.length > 0);
      if (withWo) {
        console.log('\nrecord WITH wo: nama=', withWo.nama, '| no_polisi=', withWo.no_polisi, '| service_terakhir=', withWo.service_terakhir);
        for (const w of withWo.wo) {
          console.log('  - no_wo=', w.no_wo, '| kategori=', w.kategori, '| waktu_masuk=', w.waktu_masuk, '| waktu_selesai=', w.waktu_selesai, '| perintah=', w.perintah, '| status=', w.status);
        }
      } else {
        console.log('\n(no record has wo[] in first page)');
        for (const r of json.data.slice(0, 5)) {
          console.log('wo field for', r.nama, '=> type:', typeof r.wo, r.wo === null ? '(null)' : Array.isArray(r.wo) ? `array len ${r.wo.length}` : String(r.wo).slice(0, 120));
        }
      }
      if (isCro) {
        const doFrom = '07-07-2026';
        const doTo = '06-08-2026';
        for (const [off, len] of [[0, 100], [0, 10], [10, 10]]) {
          const pageUrl = `${BASE}/aftersales/reminder-do/data?draw=1&start=${off}&length=${len}&do_from=${doFrom}&do_to=${doTo}&status_filter=all&grup=&_=${Date.now()}`;
          const pr = await fetchHttps(pageUrl, {
            headers: {
              'Cookie': cookie,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': `${BASE}/aftersales/reminder-do`,
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
            },
          });
          const pt = await pr.text();
          if (pr.status === 302 || pt.trimStart().startsWith('<')) { console.log(`start=${off} len=${len} => HTML/redirect`); continue; }
          const pj = JSON.parse(pt);
          console.log(`start=${off} len=${len} => recordsTotal=${pj.recordsTotal} returned=${pj.data?.length}`);
        }
      }
    }
    return json;
  } catch (e) {
    console.log('error:', e.message);
    return null;
  }
}

await tryAccount(false);
await tryAccount(true);
