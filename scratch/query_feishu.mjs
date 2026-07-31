import fs from 'fs';
import path from 'path';

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
const FEISHU_COOKIE = env.FEISHU_COOKIE || '';
const FEISHU_BASE = 'https://my-ichery.feishu.cn';

function extractCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

function extractSwpCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)swp_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

const csrfToken = extractCsrf(FEISHU_COOKIE);
const swpCsrfToken = extractSwpCsrf(FEISHU_COOKIE);

console.log("Cookie loaded length:", FEISHU_COOKIE.length);
console.log("csrfToken extracted:", csrfToken);
console.log("swpCsrfToken extracted:", swpCsrfToken);

async function test(useBodyCsrf, useXCsrfHeader, useXCsrfHeaderSwp) {
  const shareToken = 'shrcnisfoFIuULuCRmFBG310qDb';
  const filter = JSON.stringify({
    conditions: [
      { fieldId: 'fldXbpXoZU', fieldType: 3, operator: 'contains', value: ['optef3IAAh'] },
      { fieldId: 'fldTcWjbEB', fieldType: 19, operator: 'contains', value: ['csi-7901-16'] }
    ],
    conjunction: 'and'
  });

  const body = {
    shareToken,
    filter,
    page_size: 100
  };
  if (useBodyCsrf && csrfToken) body.csrf_token = csrfToken;

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': FEISHU_COOKIE,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Origin': FEISHU_BASE,
    'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}`
  };
  if (useXCsrfHeader && csrfToken) headers['x-csrf-token'] = csrfToken;
  if (useXCsrfHeaderSwp && swpCsrfToken) headers['x-csrf-header'] = swpCsrfToken;

  try {
    const response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    const text = await response.text();
    console.log(`BodyCsrf=${useBodyCsrf}, XCsrfHeader=${useXCsrfHeader}, SwpCsrfHeader=${useXCsrfHeaderSwp} => Status: ${response.status}, Body: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

async function run() {
  console.log("--- Executing tests ---");
  await test(true, true, true);
  await test(true, false, false);
  await test(false, true, false);
  await test(false, false, false);
}

run();
