import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Custom parsing of .env
if (fs.existsSync('.env')) {
  const lines = fs.readFileSync('.env', 'utf8').split('\n');
  lines.forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      process.env[key] = value.replace(/(^['"]|['"]$)/g, '');
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Get active session
  const { data: users, error } = await supabase
    .from('users')
    .select('username, sessionId')
    .eq('status', 'active')
    .limit(1);

  if (error || !users || users.length === 0) {
    console.error("No active users found:", error);
    return;
  }

  const { username, sessionId } = users[0];
  console.log(`Using active user: ${username}, sessionId: ${sessionId}`);

  // Now query local dev server api/csi-proxy
  const res = await fetch('http://localhost:5173/api/csi-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Username': username,
      'X-Auth-Session-Id': sessionId
    },
    body: JSON.stringify({
      view: 'results',
      action: 'yearly-trend',
      dealerFilter: 'optef3IAAh',
      month: '8',
      forceFresh: true
    })
  });

  const json = await res.json();
  console.log("Status:", res.status);
  console.log("CSI Proxy response codes & monthly scores:");
  console.log("code:", json.code);
  console.log("scores:", json.scores);
  console.log("records exist?:", !!json.records);
  if (json.records) {
    console.log("recordIDs length:", json.records.recordIDs?.length);
  }
}

run();
