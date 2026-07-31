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
let cookies = env.FEISHU_COOKIE || '';
const FEISHU_BASE = 'https://my-ichery.feishu.cn';
const shareToken = 'shrcnisfoFIuULuCRmFBG310qDb';

function parseCookieString(cookieStr) {
  const map = new Map();
  cookieStr.split(';').forEach(c => {
    const trimmed = c.trim();
    if (!trimmed) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    map.set(key, val);
  });
  return map;
}

function serializeCookieMap(map) {
  const arr = [];
  for (const [k, v] of map.entries()) {
    arr.push(`${k}=${v}`);
  }
  return arr.join('; ');
}

async function run() {
  const cookieMap = parseCookieString(cookies);
  
  // Step 1: GET request to initialize session/referer/cookies
  console.log("Making GET request to share page...");
  const getRes = await fetch(`${FEISHU_BASE}/share/base/query/${shareToken}`, {
    headers: {
      'Cookie': serializeCookieMap(cookieMap),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    }
  });
  
  console.log("GET Response status:", getRes.status);
  
  // Update cookies from Set-Cookie header
  const setCookies = getRes.headers.getSetCookie();
  setCookies.forEach(sc => {
    const firstPart = sc.split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx !== -1) {
      const key = firstPart.substring(0, eqIdx).trim();
      const val = firstPart.substring(eqIdx + 1).trim();
      cookieMap.set(key, val);
      console.log(`Updated Cookie: ${key}`);
    }
  });

  const finalCookieStr = serializeCookieMap(cookieMap);
  const csrfToken = cookieMap.get('_csrf_token') || '';
  const swpCsrfToken = cookieMap.get('swp_csrf_token') || '';

  console.log("\nMaking POST request to list_records...");
  console.log("CSRF Token:", csrfToken);

  const postHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Cookie': finalCookieStr,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Origin': FEISHU_BASE,
    'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}`,
  };

  if (csrfToken) postHeaders['x-csrf-token'] = csrfToken;
  if (swpCsrfToken) postHeaders['x-csrf-header'] = swpCsrfToken;

  const postBody = {
    shareToken,
    page_size: 100,
    filter: JSON.stringify({
      conditions: [
        { fieldId: 'fldXbpXoZU', fieldType: 3, operator: 'contains', value: ['optef3IAAh'] },
        { fieldId: 'fldTcWjbEB', fieldType: 19, operator: 'contains', value: ['csi-7901-16'] }
      ],
      conjunction: 'and'
    })
  };

  if (csrfToken) postBody.csrf_token = csrfToken;

  const postRes = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
    method: 'POST',
    headers: postHeaders,
    body: JSON.stringify(postBody)
  });

  const text = await postRes.text();
  console.log("POST Response status:", postRes.status);
  console.log("POST Response body preview:");
  console.log(text.slice(0, 1000));
}

run();
