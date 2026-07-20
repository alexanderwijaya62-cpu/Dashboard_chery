import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from '../api/db.js';

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
const envLocalPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
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

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON;
}
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const mockReq = {
  method: 'POST',
  headers: {
    'x-auth-username': 'testuser',
    'x-auth-session-id': 'testsession'
  },
  body: {
    table: 'customers',
    action: 'update',
    data: { values: { nama: 'Test' } },
    filters: [ { op: 'eq', column: 'id', value: 1 } ]
  }
};

const mockRes = {
  status(code) {
    console.log('Status called with:', code);
    return this;
  },
  json(data) {
    console.log('Json called with:', data);
    return this;
  },
  setHeader(name, value) {
    console.log(`SetHeader ${name} to ${value}`);
  }
};

async function test() {
  try {
    await handler(mockReq, mockRes);
  } catch (e) {
    console.error('Caught error in test execution:', e);
  }
}

test();
