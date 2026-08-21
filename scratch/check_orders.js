async function main() {
  const CHERY_DMS_URL = "http://localhost:5173/api/chery_dms";
  try {
    const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=0&pageSize=5&isBuyer=true`);
    const result = await resp.json();
    console.log("Full result:", result);
  } catch (e) {
    console.error("Error fetching:", e.message);
  }
}

main();
