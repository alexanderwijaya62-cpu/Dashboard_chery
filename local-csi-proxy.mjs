import http from 'http';
import fs from 'fs';

// Load .env manually if FEISHU_COOKIE is not set in environment
if (!process.env.FEISHU_COOKIE && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const FEISHU_BASE = process.env.FEISHU_BASE_URL || 'https://my-ichery.feishu.cn';
const cookies = process.env.FEISHU_COOKIE || '';

if (!cookies) {
  console.error('FEISHU_COOKIE belum diatur. Set dulu:');
  process.exit(1);
}

function extractAll(cookieStr) {
  const get = (name) => {
    const m = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? m[1] : '';
  };
  return {
    session: get('session'),
    sessionList: get('session_list'),
    passportToken: get('passport_app_access_token'),
    slSession: get('sl_session'),
    csrfToken: get('_csrf_token'),
    swpCsrf: get('swp_csrf_token'),
    all: cookieStr,
  };
}

const tokens = extractAll(cookies);

// Clean cookies - only essential ones
const cleanCookies = [
  `session=${tokens.session}`,
  `session_list=${tokens.sessionList}`,
  `passport_app_access_token=${tokens.passportToken}`,
  `sl_session=${tokens.slSession}`,
  `_csrf_token=${tokens.csrfToken}`,
  `swp_csrf_token=${tokens.swpCsrf}`,
].join('; ');

console.log('Essential cookies extracted');
console.log('  session:', tokens.session?.slice(0, 20) + '...');
console.log('  csrf:', tokens.csrfToken?.slice(0, 20) + '...');
console.log('  swpCsrf:', tokens.swpCsrf?.slice(0, 20) + '...');

async function tryRequest(endpoint, body, headers, label) {
  console.log(`\n--- ${label} ---`);
  const fullHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...headers,
  };
  try {
    const response = await fetch(`${FEISHU_BASE}${endpoint}`, {
      method: 'POST',
      headers: fullHeaders,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    console.log(`status=${response.status} body=${text.slice(0, 800)}`);
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: response.ok && data?.code === 0, data, status: response.status };
  } catch (e) {
    return { ok: false, data: { error: e.message }, status: 0 };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/csi-proxy') {
    res.writeHead(404);
    res.end();
    return;
  }

  let rawBody = '';
  for await (const chunk of req) rawBody += chunk;
  const reqParsed = JSON.parse(rawBody);
  let { shareToken, view, filter, offset, password } = reqParsed;

  if (!shareToken && view) {
    shareToken = view === 'customers'
      ? process.env.FEISHU_CUSTOMERS_SHARE_TOKEN
      : view === 'results'
        ? process.env.FEISHU_CSI_RESULT_SHARE_TOKEN
        : null;
  }

  if (!shareToken) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'shareToken is required' }));
    return;
  }

  console.log('\n====== Request ======');
  console.log('shareToken:', shareToken);

  const requestBody = { shareToken, page_size: 100 };
  if (filter) requestBody.filter = filter;
  if (offset !== undefined) requestBody.offset = offset;

  const results = [];

  // ========== Strategy A: Clean cookies + csrf, server-style (no origin/referer) ==========
  let r = await tryRequest(
    '/space/api/bitable/form/external/list_records',
    requestBody,
    { 'x-csrf-token': tokens.csrfToken, 'x-csrftoken': tokens.csrfToken, 'Cookie': cleanCookies },
    'A: clean cookies + csrf, no origin'
  );
  results.push(r);
  if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);

  // ========== Strategy B: All original cookies + csrf, no origin ==========
  r = await tryRequest(
    '/space/api/bitable/form/external/list_records',
    requestBody,
    { 'x-csrf-token': tokens.csrfToken, 'x-csrftoken': tokens.csrfToken, 'Cookie': tokens.all },
    'B: all cookies + csrf, no origin'
  );
  results.push(r);
  if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);

  // ========== Strategy C: All cookies + csrf + browser headers ==========
  r = await tryRequest(
    '/space/api/bitable/form/external/list_records',
    requestBody,
    {
      'x-csrf-token': tokens.csrfToken,
      'x-csrftoken': tokens.csrfToken,
      'Cookie': tokens.all,
      'Origin': FEISHU_BASE,
      'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}`,
    },
    'C: all cookies + csrf + browser headers'
  );
  results.push(r);
  if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);

  // ========== Strategy D: Only session cookies, no csrf, with browser headers ==========
  r = await tryRequest(
    '/space/api/bitable/form/external/list_records',
    requestBody,
    { 'Cookie': cleanCookies, 'Origin': FEISHU_BASE, 'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}` },
    'D: session cookies + browser headers (no csrf)'
  );
  results.push(r);
  if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);

  // ========== GET_SHARE with various auth ==========
  const shareConfigs = [
    { auth: 'no auth', headers: {} },
    { auth: 'all cookies', headers: { 'Cookie': tokens.all } },
    { auth: 'all cookies + csrf', headers: { 'Cookie': tokens.all, 'x-csrf-token': tokens.csrfToken, 'x-csrftoken': tokens.csrfToken } },
  ];
  for (const cfg of shareConfigs) {
    r = await tryRequest(
      '/space/api/bitable/form/external/get_share',
      { shareToken },
      cfg.headers,
      `GET_SHARE (${cfg.auth})`
    );
    results.push(r);
    if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);
  }

  // ========== With password ==========
  if (password) {
    for (const cfg of shareConfigs) {
      r = await tryRequest(
        '/space/api/bitable/form/external/list_records',
        { shareToken, page_size: 100, password },
        cfg.headers,
        `LIST_RECORDS + password (${cfg.auth})`
      );
      results.push(r);
      if (r.ok && r.data?.code === 0) return sendSuccess(res, r.data);
    }
  }

  // All failed
  console.log('\n====== FAILED ======');
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    error: 'All attempts failed',
    results: results.map((r, i) => ({ i, status: r.status, data: r.data })),
  }));
});

function sendSuccess(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

const PORT = 3099;
server.listen(PORT, () => {
  console.log(`CSI proxy lokal jalan di http://localhost:${PORT}/api/csi-proxy`);
});
