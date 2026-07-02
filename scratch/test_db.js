import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.replace(/\\n/gm, '\n');
      }
      process.env[key] = value.replace(/(^['"]|['"]$)/g, '');
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: antrianData } = await supabase.from('antrian').select('*').limit(1);
  const { data: historyData } = await supabase.from('history').select('*').limit(1);
  console.log("Antrian keys:", antrianData ? Object.keys(antrianData[0] || {}) : "No data");
  console.log("History keys:", historyData ? Object.keys(historyData[0] || {}) : "No data");
}
run();
