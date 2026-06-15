import fs from 'fs';
import path from 'path';
import https from 'https';
import urllib from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env manually
try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
                const key = trimmed.slice(0, idx).trim();
                let value = trimmed.slice(idx + 1).trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.error("Failed to parse .env file:", e);
}

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    timeout: 30000,
    rejectUnauthorized: false
});

function fetchWithHttps(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new urllib.URL(urlStr);
        const reqOptions = {
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            agent: httpsAgent
        };

        const req = https.request(reqOptions, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const responseObj = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()],
                        getSetCookie: () => {
                            const raw = res.headers['set-cookie'];
                            return Array.isArray(raw) ? raw : (raw ? [raw] : []);
                        }
                    },
                    text: async () => buffer.toString('utf8'),
                    json: async () => JSON.parse(buffer.toString('utf8')),
                    buffer: async () => buffer
                };
                resolve(responseObj);
            });
        });

        req.on('error', (err) => reject(err));

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function loginDMS() {
    const username = process.env.DMS_USER;
    const password = process.env.DMS_PASS;
    const enterpriseCode = process.env.DMS_ENTERPRISE_CODE || 'MOS'; // Fallback to MOS

    console.log("Logging in to DMS with:", { username, password, enterpriseCode });
    const initialResp = await fetchWithHttps('https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
        }
    });

    let cookies = initialResp.headers.getSetCookie();
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

    const loginBody = JSON.stringify({
        enterpriseCode,
        username,
        password,
        language: 'en-US'
    });

    const resp = await fetchWithHttps('https://dms.chery.co.id/api/v1/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            'Origin': 'https://dms.chery.co.id',
            'Referer': 'https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F',
            'Cookie': cookieStr
        },
        body: loginBody
    });

    console.log("Login POST Status:", resp.status);
    const text = await resp.text();
    console.log("Login POST Response:", text);

    let setCookies = resp.headers.getSetCookie();
    const aspNetCookie = setCookies.find(c => c.includes('.AspNetCore.Cookies'));
    if (aspNetCookie) {
        return aspNetCookie.split(';')[0];
    }
    throw new Error("DMS login failed");
}

async function run() {
    const dmsCookie = await loginDMS();
    console.log("DMS Authenticated successfully!");
}

run().catch(console.error);
