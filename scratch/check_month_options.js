import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom parsing of .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      process.env[key] = value.replace(/(^['"]|['"]$)/g, '');
    }
  });
}

async function check() {
  const body = {
    shareToken: process.env.FEISHU_CSI_RESULT_SHARE_TOKEN,
    page_size: 1
  };
  const cookies = process.env.FEISHU_COOKIE || '';
  const match = cookies.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  const csrfToken = match ? match[1] : '';
  if (csrfToken) body.csrf_token = csrfToken;

  const swpMatch = cookies.match(/(?:^|;\s*)swp_csrf_token=([^;]+)/);
  const swpCsrfToken = swpMatch ? swpMatch[1] : '';

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Origin': 'https://my-ichery.feishu.cn',
    'Referer': 'https://my-ichery.feishu.cn/'
  };
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
    headers['x-csrftoken'] = csrfToken;
  }
  if (swpCsrfToken) {
    headers['x-csrf-header'] = swpCsrfToken;
  }

  const res = await fetch('https://my-ichery.feishu.cn/space/api/bitable/form/external/list_records', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const json = await res.json();
  console.log('Response:', JSON.stringify(json, null, 2).slice(0, 1500));
}

check();
