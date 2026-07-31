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
const shareToken = 'shrcnisfoFIuULuCRmFBG310qDb';

async function run() {
  const response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Origin': FEISHU_BASE,
      'Referer': `${FEISHU_BASE}/share/base/query/${shareToken}`,
      'x-csrftoken': '0c258be844a1216466cc897ec9ee661c94d01b4c-1784694061'
    },
    body: JSON.stringify({
      shareToken,
      page_size: 100,
      filter: JSON.stringify({
        conditions: [
          { fieldId: 'fldXbpXoZU', fieldType: 3, operator: 'contains', value: ['optef3IAAh'] },
          { fieldId: 'fldTcWjbEB', fieldType: 19, operator: 'contains', value: ['csi-7901-16'] }
        ],
        conjunction: 'and'
      })
    })
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Body preview:");
  console.log(text.slice(0, 1000));
}

run();
