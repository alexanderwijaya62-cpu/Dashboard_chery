function extractCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

function extractSwpCsrf(cookieStr) {
  const match = cookieStr.match(/(?:^|;\s*)swp_csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { view, filter, offset, shareToken: bodyShareToken } = req.body || {};
  const shareToken = bodyShareToken || (
    view === 'customers'
      ? process.env.FEISHU_CUSTOMERS_SHARE_TOKEN
      : view === 'results'
        ? process.env.FEISHU_CSI_RESULT_SHARE_TOKEN
        : null
  );
  if (!shareToken) {
    return res.status(400).json({ error: 'shareToken or view is required' });
  }

  const FEISHU_BASE = process.env.FEISHU_BASE_URL || 'https://my-ichery.feishu.cn';
  const cookies = process.env.FEISHU_COOKIE || '';
  const csrfToken = extractCsrf(cookies);
  const swpCsrfToken = extractSwpCsrf(cookies);

  try {
    const body = {
      shareToken,
      page_size: 100,
    };
    if (filter) body.filter = filter;
    if (offset !== undefined) body.offset = offset;
    if (csrfToken) body.csrf_token = csrfToken;

    const headers = {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Origin': FEISHU_BASE,
      'Referer': `${FEISHU_BASE}/`,
    };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    if (swpCsrfToken) headers['x-csrf-header'] = swpCsrfToken;

    const response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch from Feishu' });
  }
}
