import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // Let's do the exact query that the frontend does:
  const noPlatValue = 'BK888VIC';
  const statusValues = ['waiting_approval', 'waiting confirm', 'accepted'];

  const { data, error } = await supabase
    .from('booking')
    .select('noPlat, tanggal, jam, status')
    .eq('noPlat', noPlatValue)
    .in('status', statusValues);

  console.log('Result for eq(noPlat):', { data, error });
}
run();
