import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from '../api/chery_dms.js';

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

const mockReq = {
  method: 'GET',
  query: {
    endpoint: 'warranty-invoice-report',
    draw: '1',
    from: '',
    to: '',
    search: ''
  },
  headers: {}
};

const mockRes = {
  status(code) {
    console.log('[Status called]:', code);
    return this;
  },
  json(data) {
    console.log('[JSON called]:', JSON.stringify(data, null, 2).slice(0, 1000));
    return this;
  },
  setHeader(name, value) {
    console.log(`[SetHeader]: ${name} = ${value}`);
  }
};

async function test() {
  try {
    console.log('Testing handler with warranty-invoice-report...');
    await handler(mockReq, mockRes);
    
    console.log('\nTesting handler with warranty-wo...');
    mockReq.query.endpoint = 'warranty-wo';
    mockReq.query.fetchAll = 'true';
    await handler(mockReq, mockRes);
  } catch (e) {
    console.error('Caught error in test execution:', e);
  }
}

test();
