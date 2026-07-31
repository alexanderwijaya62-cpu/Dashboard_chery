async function fetchMonthScore(month) {
  const filter = JSON.stringify({
    conditions: [
      { fieldId: 'fldA9Oa6IA', fieldType: 19, operator: 'contains', value: ['optef3IAAh'], conditionId: 'con2GlKFnL' },
      { fieldId: 'fldc3urooF', fieldType: 20, operator: 'contains', value: [String(month)], conditionId: 'conhboX683' },
      { fieldId: 'fldHYwLI9Z', fieldType: 20, operator: 'contains', value: ['csi-7901-16'], conditionId: 'conQiBWHmX' }
    ],
    conjunction: 'and'
  });

  try {
    const res = await fetch('http://localhost:3099/api/csi-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        view: 'results',
        filter
      })
    });
    const json = await res.json();
    if (json.code !== 0) return 0;
    const records = json.data?.recordMap || {};
    const recordIds = json.data?.recordIDs || [];
    if (recordIds.length === 0) return 0;
    
    let sum = 0;
    let count = 0;
    recordIds.forEach(id => {
      const val = records[id]?.fldKw5T576?.value?.val || records[id]?.fldKw5T576?.value;
      if (val !== undefined && val !== null) {
        sum += Number(val);
        count++;
      }
    });
    return count > 0 ? Math.round(sum / count) : 0;
  } catch (err) {
    return 0;
  }
}

async function run() {
  console.log("Fetching all 12 months in parallel...");
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const startTime = Date.now();
  const scores = await Promise.all(months.map(m => fetchMonthScore(m)));
  console.log("Scores:", scores);
  console.log(`Completed in ${Date.now() - startTime}ms`);
}

run();
