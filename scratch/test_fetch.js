import fs from 'fs';

async function test() {
  try {
    console.log("Fetching invoice report...");
    const invoiceRes = await fetch("http://localhost:5173/api/chery_dms?endpoint=warranty-invoice-report&from=2026-07-01&to=2026-07-31");
    const invoiceJson = await invoiceRes.json();
    const rawInvoices = invoiceJson.data || [];
    
    console.log("Fetching WO report...");
    const woRes = await fetch("http://localhost:5173/api/chery_dms?endpoint=warranty-wo&draw=1&start=0&length=100&fetchAll=true");
    const woJson = await woRes.json();
    const rawWos = woJson.data || [];

    const result = {
      invoiceCount: rawInvoices.length,
      woCount: rawWos.length,
      invoiceSample: rawInvoices.slice(0, 5),
      woSample: rawWos.slice(0, 5)
    };

    fs.writeFileSync('d:/chery/Dashboard_chery/scratch_test_result.json', JSON.stringify(result, null, 2));
    console.log("Done! Result written to scratch_test_result.json");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
