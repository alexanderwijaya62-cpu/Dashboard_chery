const shareToken = "shrcnw2XQ2tFdIyI6iIcfGqJTv0";
const FEISHU_BASE = process.env.FEISHU_BASE_URL || 'https://my-ichery.feishu.cn';
const cookies = process.env.FEISHU_COOKIE || '';

function extractCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

function extractSwpCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)swp_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

const csrfToken = extractCsrf(cookies);
const swpCsrfToken = extractSwpCsrf(cookies);

console.log("csrfToken extracted:", csrfToken);
console.log("swpCsrfToken extracted:", swpCsrfToken);

async function test(useBodyCsrf, useXCsrfHeader, useXCsrfHeaderSwp) {
  const body = {
    shareToken,
    page_size: 100,
  };
  if (useBodyCsrf && csrfToken) body.csrf_token = csrfToken;

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Origin': FEISHU_BASE,
    'Referer': `${FEISHU_BASE}/`,
  };
  if (useXCsrfHeader && csrfToken) headers['x-csrf-token'] = csrfToken;
  if (useXCsrfHeaderSwp && swpCsrfToken) headers['x-csrf-header'] = swpCsrfToken;

  try {
    const response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    console.log(`BodyCsrf=${useBodyCsrf}, XCsrfHeader=${useXCsrfHeader}, SwpCsrfHeader=${useXCsrfHeaderSwp} => Status: ${response.status}, Body: ${text.slice(0, 150)}`);
  } catch (err) {
    console.error(err);
  }
}

console.log("--- Executing tests ---");
await test(true, true, true);
await test(true, false, false);
await test(false, true, false);
await test(false, false, false);
