import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from '../api/csi-proxy.js';

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

const filterConditions = [
  {
    fieldId: 'fldA9Oa6IA',
    fieldType: 19,
    operator: 'contains',
    value: ['optef3IAAh'],
    conditionId: 'con2GlKFnL',
  },
  {
    fieldId: 'fldHYwLI9Z',
    fieldType: 20,
    operator: 'contains',
    value: ['csi-7901-16'],
    conditionId: 'conQiBWHmX',
  },
  {
    fieldId: 'fldc3urooF',
    fieldType: 20,
    operator: 'contains',
    value: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    conditionId: 'conhboX683',
  }
];

const mockReq = {
  method: 'POST',
  body: {
    view: 'results',
    action: 'yearly-trend',
    dealerFilter: 'optef3IAAh'
  },
  headers: {
    'content-type': 'application/json'
  }
};

const mockRes = {
  status(code) {
    console.log('[Status called]:', code);
    return this;
  },
  json(data) {
    console.log('[JSON Output]:', JSON.stringify(data, null, 2));
    return this;
  },
  setHeader(name, value) {
    console.log(`[SetHeader]: ${name} = ${value}`);
  },
  end() {
    console.log('[End called]');
  }
};

async function test() {
  try {
    console.log('Testing csi-proxy handler...');
    await handler(mockReq, mockRes);
  } catch (e) {
    console.error('Caught error in test execution:', e);
  }
}

test();
