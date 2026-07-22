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
  const newId = Date.now() + Math.floor(Math.random() * 1000);
  const result = await supabase.from('booking').insert({
    id: newId,
    noUrut: 9999,
    tanggal: '2026-07-23',
    jam: '09.30',
    noPlat: 'BK888VIC',
    tipeMobil: 'J6 IWD',
    namaCustomer: 'Ravika Hakim',
    bookingVia: 'Web-Public',
    noTelp: '62 812-6568-606',
    keperluanService: 'Kaca Belakang ga bisa buka , service berkala,spion bermasalah',
    ip_address: '127.0.0.1',
    status: 'accepted'
  });

  console.log('Insert result:', result);
}
run();
