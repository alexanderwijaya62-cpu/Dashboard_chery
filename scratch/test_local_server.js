async function test() {
    const vin = 'MF7G02700SB000561';
    const url = `http://localhost:5173/api/chery_dms?endpoint=warranty-search-vin&vin=${vin}`;
    console.log(`Querying local server at: ${url}`);
    try {
        const resp = await fetch(url);
        console.log("Response status:", resp.status);
        const text = await resp.text();
        console.log("Response length:", text.length);
        console.log("Response text:", text);
    } catch (e) {
        console.error("Failed to query local server:", e.message);
    }
}
test();
