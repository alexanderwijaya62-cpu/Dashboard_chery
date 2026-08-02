import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const nativeRequire = createRequire(import.meta.url);
const http = nativeRequire('node:http');
const https = nativeRequire('node:https');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) process.env[m[1]] = (m[2] || '').replace(/(^['"]|['"]$)/g, '');
  });
}

const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

function fetchWithHttps(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const client = isHttps ? https : http;
    const timeout = options.timeout || 20000;
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
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        text: () => Buffer.concat(chunks).toString('utf8'),
        getSetCookie: () => { const raw = res.headers['set-cookie']; return Array.isArray(raw) ? raw : (raw ? [raw] : []); },
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  const BASE = process.env.WARRANTY_BASE_URL || 'http://103.160.12.43';
  const PUBLIC_HOST = 'https://dms.chery.co.id';
  const USER = process.env.WARRANTY_USER;
  const PASS = process.env.WARRANTY_PASS;
  const TOKEN = process.env.WARRANTY_TOKEN;
  const DEALER = process.env.WARRANTY_KODE_DEALER;
  const DEPT = process.env.WARRANTY_DEPT;

  const loginPage = await fetchWithHttps(`${BASE}/aftersales/login`);
  let jar = {};
  for (const c of loginPage.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  const html = await loginPage.text();
  const csrf = (html.match(/name="_token"\s+value="([^"]+)"/) || [])[1] || '';
  const cookieStr = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const loginBody = new URLSearchParams({ _token: csrf, username: USER, password: PASS }).toString();
  const loginRes = await fetchWithHttps(`${BASE}/aftersales/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/login`, 'Origin': PUBLIC_HOST }, body: loginBody });
  for (const c of loginRes.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  const tokenPage = await fetchWithHttps(`${BASE}/aftersales/token`, { headers: { 'Cookie': cookieStr(), 'Referer': `${PUBLIC_HOST}/aftersales/` } });
  const tokenHtml = await tokenPage.text();
  for (const c of tokenPage.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  const tokenCsrf = (tokenHtml.match(/name="_token"\s+value="([^"]+)"/) || [])[1] || csrf;
  const tokenBody = new URLSearchParams({ _token: tokenCsrf, kode_dealer: DEALER, token: TOKEN, dept_hidden: DEPT }).toString();
  const tokenRes = await fetchWithHttps(`${BASE}/aftersales/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieStr(), 'Referer': `${BASE}/aftersales/token`, 'Origin': BASE }, body: tokenBody });
  for (const c of tokenRes.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }

  const COOKIE = cookieStr();

  const baseCols = 'columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=no_wo&columns[1][name]=no_wo&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=no_wo_dms&columns[2][name]=no_wo_dms&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=status&columns[3][name]=status&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=nama_pelanggan&columns[4][name]=nama_pelanggan&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=no_polisi&columns[5][name]=no_polisi&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=no_chassis&columns[6][name]=no_chassis&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=nama_kendaraan&columns[7][name]=nama_kendaraan&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&columns[8][data]=waktu_masuk&columns[8][name]=waktu_masuk&columns[8][searchable]=true&columns[8][orderable]=true&columns[8][search][value]=&columns[8][search][regex]=false&columns[9][data]=waktu_simpan_estimasi&columns[9][name]=waktu_simpan_estimasi&columns[9][searchable]=true&columns[9][orderable]=true&columns[9][search][value]=&columns[9][search][regex]=false&columns[10][data]=waktu_setujui_estimasi&columns[10][name]=waktu_setujui_estimasi&columns[10][searchable]=true&columns[10][orderable]=true&columns[10][search][value]=&columns[10][search][regex]=false&columns[11][data]=waktu_mulai&columns[11][name]=waktu_mulai&columns[11][searchable]=true&columns[11][orderable]=true&columns[11][search][value]=&columns[11][search][regex]=false&columns[12][data]=waktu_checker&columns[12][name]=waktu_checker&columns[12][searchable]=true&columns[12][orderable]=true&columns[12][search][value]=&columns[12][search][regex]=false&columns[13][data]=waktu_selesai&columns[13][name]=waktu_selesai&columns[13][searchable]=true&columns[13][orderable]=true&columns[13][search][value]=&columns[13][search][regex]=false&columns[14][data]=nama_pembawa&columns[14][name]=nama_pembawa&columns[14][searchable]=true&columns[14][orderable]=true&columns[14][search][value]=&columns[14][search][regex]=false&columns[15][data]=id_karyawan&columns[15][name]=&columns[15][searchable]=true&columns[15][orderable]=true&columns[15][search][value]=&columns[15][search][regex]=false&columns[16][data]=nama_mekanik1&columns[16][name]=&columns[16][searchable]=true&columns[16][orderable]=true&columns[16][search][value]=&columns[16][search][regex]=false&columns[17][data]=nama_leader1&columns[17][searchable]=true&columns[17][orderable]=true&columns[17][search][value]=&columns[17][search][regex]=false&columns[18][data]=last_update&columns[18][name]=last_update&columns[18][searchable]=true&columns[18][orderable]=true&columns[18][search][value]=&columns[18][search][regex]=false&order[0][column]=18&order[0][dir]=desc&search[value]=&search[regex]=false';

  const buildUrl = (st, offset, len) => `${BASE}/aftersales/work-order/data?draw=1&start=${offset}&length=${len}&status=${encodeURIComponent(st)}&kategori=${baseCols}&_=${Date.now()}`;

  // Simulate the new doFetchWarranty fetchAll algorithm (PAGE_SIZE=100, CONC=10, active+closed parallel)
  const PAGE_SIZE = 100;
  const PAGE_CONCURRENCY = 10;

  const fetchPageOnce = async (st, offset, withTotal = false) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetchWithHttps(buildUrl(st, offset, PAGE_SIZE), {
          headers: { 'Cookie': COOKIE, 'X-Requested-With': 'XMLHttpRequest' },
          timeout: 60000,
        });
        const body = await resp.text();
        if (body.trimStart().startsWith('<')) continue;
        const parsed = JSON.parse(body);
        const data = Array.isArray(parsed.data) ? parsed.data : [];
        return withTotal
          ? { data, total: parsed.recordsTotal || parsed.recordsFiltered || data.length }
          : data;
      } catch (e) {
        if (attempt === 1) throw e;
      }
    }
    return withTotal ? { data: [], total: 0 } : [];
  };

  const fetchAllPagesForStatus = async (st) => {
    let allData = [];
    const firstPage = await fetchPageOnce(st, 0, true);
    allData = allData.concat(firstPage.data);
    const total = firstPage.total || firstPage.data.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const remainingOffsets = [];
    for (let p = 1; p < totalPages; p++) remainingOffsets.push(p * PAGE_SIZE);
    for (let i = 0; i < remainingOffsets.length; i += PAGE_CONCURRENCY) {
      const batch = remainingOffsets.slice(i, i + PAGE_CONCURRENCY);
      const results = await Promise.allSettled(batch.map(offset => fetchPageOnce(st, offset, false)));
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) allData = allData.concat(r.value);
      }
    }
    return allData;
  };

  const t0 = Date.now();
  const [activeList, closedList] = await Promise.all([
    fetchAllPagesForStatus(''),
    fetchAllPagesForStatus('Closed'),
  ]);
  const mergedMap = new Map();
  [...activeList, ...closedList].forEach(item => {
    const key = item.id_wo || item.no_wo;
    if (key && !mergedMap.has(key)) mergedMap.set(key, item);
  });
  const combined = Array.from(mergedMap.values());
  console.log(`FULL SIM: active=${activeList.length}, closed=${closedList.length}, merged=${combined.length} in ${Date.now() - t0}ms`);
}

main().catch(console.error);
