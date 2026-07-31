async function run() {
  const filter = JSON.stringify({
    conditions: [
      { fieldId: 'fldA9Oa6IA', fieldType: 19, operator: 'contains', value: ['optef3IAAh'], conditionId: 'con2GlKFnL' },
      { fieldId: 'fldc3urooF', fieldType: 20, operator: 'contains', value: ['7'], conditionId: 'conhboX683' },
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
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Data keys:", Object.keys(json));
    console.log("Feishu Code:", json.code);
    console.log("Total records in map:", json.data?.recordIDs?.length || 0);
    if (json.data?.recordIDs) {
      console.log("Sample records:", json.data.recordIDs.slice(0, 3));
    }
  } catch (err) {
    console.error("Local proxy results check failed:", err);
  }
}
run();
