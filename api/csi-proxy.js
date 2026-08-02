const trendCache = new Map();

const DEFAULT_DIMENSIONS = [
  { id: 'fld72xtQlM', name: 'Service Appointment' },
  { id: 'fldoCOV1H9', name: 'Service Advisor' },
  { id: 'fldwSnxNc2', name: 'Dealer Facility & Service Image' },
  { id: 'fldeHCGTJE', name: 'Service Quality' },
  { id: 'fld2P5DxKQ', name: 'Leadtime Service' },
  { id: 'fldggEklVL', name: 'Delivery Process' },
  { id: 'fldwvPaNZU', name: 'Spare Part Availibility' },
];

const DIMENSION_FIELD_MAP = {
  fld72xtQlM: 'fld4QH5nYf',
  fldoCOV1H9: 'fldIgOOJb4',
  fldwSnxNc2: 'fldolgjXG7',
  fldeHCGTJE: 'fldc1yukie',
  fld2P5DxKQ: 'fldDMpKDF5',
  fldggEklVL: 'fld6u1SCVQ',
  fldwvPaNZU: 'fldSHHL9LJ',
};

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

  const { view, filter, offset, shareToken: bodyShareToken, action, dealerFilter } = req.body || {};
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

  if (action === 'yearly-trend') {
    if (!dealerFilter) {
      return res.status(400).json({ error: 'dealerFilter is required for yearly-trend' });
    }

    const forceFresh = req.body.forceFresh === 'true' || req.body.forceFresh === true;
    const activeMonth = req.body.month ? String(req.body.month) : null;
    const cacheKey = `${dealerFilter}`;
    const cached = trendCache.get(cacheKey);

    // Use backend cache for 1 hour
    if (cached && !forceFresh && (Date.now() - cached.timestamp < 3600000)) {
      const response = { code: 0, scores: cached.scores, monthly: cached.monthly };
      if (activeMonth && cached.records && cached.records[activeMonth]) {
        response.records = cached.records[activeMonth];
      }
      return res.status(200).json(response);
    }

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const scores = Array.from({ length: 12 }, () => 0);
    const monthly = months.map(m => ({
      month: m,
      csiScore: 0,
      totalSample: 0,
      dimensions: DEFAULT_DIMENSIONS.map(d => ({ id: d.id, name: d.name, value: 0 })),
    }));
    const recordsByMonth = {};

    const headers = {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Origin': FEISHU_BASE,
      'Referer': `${FEISHU_BASE}/`,
    };
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
      headers['x-csrftoken'] = csrfToken;
    }
    if (swpCsrfToken) headers['x-csrf-header'] = swpCsrfToken;

    try {
      // Process months in batches of 3 to avoid Feishu concurrency rate-limiting
      const batchSize = 3;
      for (let i = 0; i < months.length; i += batchSize) {
        const batch = months.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (month) => {
            const body = {
              shareToken,
              page_size: 100,
              filter: JSON.stringify({
                conditions: [
                  { fieldId: 'fldA9Oa6IA', fieldType: 19, operator: 'contains', value: [dealerFilter], conditionId: 'con2GlKFnL' },
                  { fieldId: 'fldc3urooF', fieldType: 20, operator: 'contains', value: [String(month)], conditionId: 'conhboX683' },
                  { fieldId: 'fldHYwLI9Z', fieldType: 20, operator: 'contains', value: ['csi-7901-16'], conditionId: 'conQiBWHmX' }
                ],
                conjunction: 'and'
              })
            };
            if (csrfToken) body.csrf_token = csrfToken;

            try {
              const response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
              });
              const text = await response.text();
              if (!text) return;
              const json = JSON.parse(text);
              if (json.code !== 0) return;
              const records = json.data?.recordMap || {};
              const recordIds = json.data?.recordIDs || [];

              let sum = 0;
              let count = 0;
              const dimSum = {};
              const dimCount = {};
              DEFAULT_DIMENSIONS.forEach(d => { dimSum[d.id] = 0; dimCount[d.id] = 0; });
              recordIds.forEach(id => {
                const r = records[id];
                const val = r?.fldKw5T576?.value?.val || r?.fldKw5T576?.value;
                if (val !== undefined && val !== null) {
                  sum += Number(val);
                  count++;
                }
                DEFAULT_DIMENSIONS.forEach(d => {
                  const fieldId = DIMENSION_FIELD_MAP[d.id];
                  if (!fieldId) return;
                  const dv = r?.[fieldId]?.value?.val || r?.[fieldId]?.value;
                  if (dv !== undefined && dv !== null) {
                    dimSum[d.id] += Number(dv);
                    dimCount[d.id]++;
                  }
                });
              });

              scores[month - 1] = count > 0 ? Math.round(sum / count) : 0;
              monthly[month - 1].csiScore = scores[month - 1];
              monthly[month - 1].totalSample = count;
              monthly[month - 1].dimensions = DEFAULT_DIMENSIONS.map(d => ({
                id: d.id,
                name: d.name,
                value: dimCount[d.id] > 0 ? Math.round(dimSum[d.id] / dimCount[d.id]) : 0,
              }));

              if (recordIds.length > 0) {
                recordsByMonth[String(month)] = { recordMap: records, recordIDs: recordIds };
              }
            } catch (errMonth) {
              console.error(`Error fetching trend for month ${month}:`, errMonth.message);
            }
          })
        );
      }

      // Save to backend cache
      trendCache.set(cacheKey, {
        scores,
        monthly,
        records: recordsByMonth,
        timestamp: Date.now()
      });

      const response = { code: 0, scores, monthly };
      if (activeMonth && recordsByMonth[activeMonth]) {
        response.records = recordsByMonth[activeMonth];
      }
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
      headers['x-csrftoken'] = csrfToken;
    }
    if (swpCsrfToken) headers['x-csrf-header'] = swpCsrfToken;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(`${FEISHU_BASE}/space/api/bitable/form/external/list_records`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      return res.status(504).json({ error: `Feishu timeout/gagal terhubung: ${error.message || 'Request aborted'}` });
    }
    clearTimeout(timeoutId);

    const text = await response.text();
    if (!text) {
      return res.status(504).json({ error: 'Feishu merespons kosong (timeout). Coba lagi.' });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch from Feishu' });
  }
}
