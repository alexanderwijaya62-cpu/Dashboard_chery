import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://nnscysshaytkxvezejae.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uc2N5c3NoYXl0a3h2ZXplamFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc4NzUxOCwiZXhwIjoyMDkwMzYzNTE4fQ.P9esuhckFZQW6J5tu0yrQltX0xP4W1dID-R-OZ3ruHw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('sparepart_revenue')
    .select('*')
    .range(0, 9999);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total records in db: ${data.length}`);
  
  // Sample some dates
  const dates = data.map(r => r.Tgl).filter(Boolean);
  console.log("Sample dates from database:", dates.slice(0, 20));
  
  // Find date format
  const uniqueMonths = new Set();
  dates.forEach(d => {
    // extract MM/YYYY or similar
    const parts = d.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        uniqueMonths.add(`${parts[1]}/${parts[2]}`);
      } else if (parts[0].length === 4) {
        uniqueMonths.add(`${parts[1]}/${parts[0]}`);
      }
    }
  });

  console.log("Unique months in database:", Array.from(uniqueMonths).sort());
}

main();
