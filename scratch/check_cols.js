import fs from 'fs';
import path from 'path';

// Read .env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const url = env['VITE_SUPABASE_URL'];
const key = env['VITE_SUPABASE_ANON'];

console.log('Supabase URL:', url);
console.log('Key length:', key?.length);

async function check() {
  const res = await fetch(`${url}/rest/v1/booking?limit=2`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (!res.ok) {
    console.error('Fetch error:', await res.text());
  } else {
    const json = await res.json();
    console.log('Bookings Sample:', JSON.stringify(json, null, 2));
  }
}

check();
