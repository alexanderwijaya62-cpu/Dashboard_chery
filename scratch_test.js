import fs from 'fs';
import path from 'path';
import https from 'https';
import urllib from 'url';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const DMS_USER = env.DMS_USER || 'Alex';
const DMS_PASS = env.DMS_PASS || 'Alex123!';
const enterpriseCode = '10007901';

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 5,
    timeout: 30000
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
                    headers: res.headers,
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

async function runTests() {
    console.log("Logging into DMS...");
    const initialResp = await fetchWithHttps('https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });

    const setCookieHeader = initialResp.headers['set-cookie'] || [];
    const initialCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const cookieStr = initialCookies.map(c => c.split(';')[0]).join('; ');

    const loginBody = JSON.stringify({
        enterpriseCode: enterpriseCode,
        username: DMS_USER,
        password: DMS_PASS,
        language: 'en-US'
    });

    const loginResp = await fetchWithHttps('https://dms.chery.co.id/api/v1/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginBody, 'utf8'),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://dms.chery.co.id',
            'Referer': 'https://dms.chery.co.id/login/?redirect_uri=https%3A%2F%2Fdms.chery.co.id%2F',
            'Cookie': cookieStr
        },
        body: loginBody
    });

    const setCookiesHeader = loginResp.headers['set-cookie'] || [];
    const setCookies = Array.isArray(setCookiesHeader) ? setCookiesHeader : [setCookiesHeader];
    const aspNetCookie = setCookies.find(c => c.includes('.AspNetCore.Cookies'));
    const sessionCookie = aspNetCookie.split(';')[0];
    console.log("Logged in!");

    const testId = '133bf2b7-2401-42d7-9a4f-63cec71c4620';
    const candidates = [
        `https://dms.chery.co.id/api/v1/files/${testId}`
    ];
    console.log("Fetching preview page HTML...");
    const res = await fetchWithHttps(candidates[0], {
        headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const html = await res.text();
    console.log("=== HTML START ===");
    console.log(html);
    console.log("=== HTML END ===");
}

runTests();
