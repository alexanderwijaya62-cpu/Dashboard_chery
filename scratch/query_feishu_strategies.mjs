import fs from 'fs';

function loadEnv() {
  const envPath = 'd:/chery/Dashboard_chery/.env';
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      env[key] = val;
    }
  });
  return env;
}

const env = loadEnv();
const cookies = env.FEISHU_COOKIE || '';
const FEISHU_BASE = 'https://my-ichery.feishu.cn';

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
const cleanCookies = [
  `session=${tokens.session}`,
  `session_list=${tokens.sessionList}`,
  `passport_app_access_token=${tokens.passportToken}`,
  `sl_session=${tokens.slSession}`,
  `_csrf_token=${tokens.csrfToken}`,
  `swp_csrf_token=${tokens.swpCsrf}`,
].join('; ');

async function tryRequest(endpoint, body, headers, label) {
  const fullHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    ...headers,
  };
  try {
    const response = await fetch(`${FEISHU_BASE}${endpoint}`, {
      method: 'POST',
      headers: fullHeaders,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    console.log(`[${label}] status=${response.status} body=${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`[${label}] Error: ${e.message}`);
  }
}

async function run() {
  const shareToken = 'shrcnisfoFIuULuCRmFBG310qDb';

  // Strategy A: clean cookies + csrf, server-style (no origin/referer)
  await tryRequest(
    '/space/api/bitable/form/external/list_records',
    { shareToken, page_size: 100 },
    { 'x-csrf-token': tokens.csrfToken, 'Cookie': cleanCookies },
    'A: clean cookies + csrf, no origin'
  );

  // Strategy B: All original cookies + csrf, no origin
  await tryRequest(
    '/space/api/bitable/form/external/list_records',
    { shareToken, page_size: 100 },
    { 'x-csrf-token': tokens.csrfToken, 'Cookie': tokens.all },
    'B: all cookies + csrf, no origin'
  );

  // Strategy C: All cookies + csrf + browser headers
  await tryRequest(
    '/space/api/bitable/form/external/list_records',
    { shareToken, page_size: 100 },
    {
      'x-csrf-token': tokens.csrfToken,
      'Cookie': tokens.all,
      'Origin': FEISHU_BASE,
      'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}`,
    },
    'C: all cookies + csrf + browser headers'
  );

  // Strategy D: Only session cookies, no csrf, with browser headers
  await tryRequest(
    '/space/api/bitable/form/external/list_records',
    { shareToken, page_size: 100 },
    { 'Cookie': cleanCookies, 'Origin': FEISHU_BASE, 'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}` },
    'D: session cookies + browser headers (no csrf)'
  );

  // GET_SHARE
  await tryRequest(
    '/space/api/bitable/form/external/get_share',
    { shareToken },
    { 'Cookie': tokens.all },
    'GET_SHARE (all cookies)'
  );
}

run();
