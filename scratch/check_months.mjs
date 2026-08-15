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
const shareToken = 'shrcnw2XQ2tFdIyI6iIcfGqJTv0';

async function fetchForMonth(month) {
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
          { fieldId: 'fldA9Oa6IA', fieldType: 19, operator: 'contains', value: ['optef3IAAh'], conditionId: 'con2GlKFnL' },
          { fieldId: 'fldc3urooF', fieldType: 20, operator: 'contains', value: [String(month)], conditionId: 'conhboX683' },
          { fieldId: 'fldHYwLI9Z', fieldType: 20, operator: 'contains', value: ['csi-7901-16'], conditionId: 'conQiBWHmX' }
        ],
        conjunction: 'and'
      })
    })
  });

  const json = await response.json();
  const records = json.data?.recordMap || {};
  const recordIds = json.data?.recordIDs || [];
  
  const monthVals = recordIds.map(id => records[id].fldXU4Zx8g?.value?.val || records[id].fldXU4Zx8g?.value);
  console.log(`Query month filter: ${month} => Returned ${recordIds.length} records. Unique fldXU4Zx8g values:`, [...new Set(monthVals)]);
}

async function run() {
  for (let m = 1; m <= 12; m++) {
    await fetchForMonth(m);
  }
}

run();
