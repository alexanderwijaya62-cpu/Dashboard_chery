async function run() {
  const filter = JSON.stringify({
    conditions: [
      { fieldId: 'fldXbpXoZU', fieldType: 3, operator: 'contains', value: ['optef3IAAh'], conditionId: 'conbSxLUox' },
      { fieldId: 'fldTcWjbEB', fieldType: 19, operator: 'contains', value: ['csi-7901-16'], conditionId: 'condbaFdHx' }
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
        view: 'customers',
        filter
      })
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Data keys:", Object.keys(json));
    console.log("Feishu Code:", json.code);
    console.log("Total records in map:", json.data?.recordIDs?.length || 0);
  } catch (err) {
    console.error("Local proxy check failed:", err);
  }
}
run();
