const fetch = require('node-fetch');
require('dotenv').config();

const BASE = process.env.WARRANTY_BASE_URL || 'https://103.160.12.43';
const username = process.env.WARRANTY_USER || 'nisa';
const password = process.env.WARRANTY_PASS || 'qwerty12345';
const token_code = process.env.WARRANTY_TOKEN || '6aad5b';
const kode_dealer = process.env.WARRANTY_KODE_DEALER || 'MOS';
const dept = process.env.WARRANTY_DEPT || 'S';

// Disable SSL verification for testing self-signed certs if needed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
    console.log("Logging in to Aftersales DMS...");
    try {
        const loginUrl = `${BASE}/aftersales/login`;
        const initialResp = await fetch(loginUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = await initialResp.text();
        const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        let cookies = initialResp.headers.raw()['set-cookie'] || [];
        let cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

        const loginFormData = new URLSearchParams();
        loginFormData.set('_token', csrfToken);
        loginFormData.set('username', username);
        loginFormData.set('password', password);
        loginFormData.set('token_code', token_code);
        loginFormData.set('kode_dealer', kode_dealer);
        loginFormData.set('dept', dept);

        const loginResp = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': loginUrl
            },
            body: loginFormData.toString(),
            redirect: 'manual'
        });

        const newCookies = loginResp.headers.raw()['set-cookie'] || [];
        if (newCookies.length > 0) {
            cookieHeader = newCookies.map(c => c.split(';')[0]).join('; ');
        }

        console.log("Login Status Code:", loginResp.status);

        // VIN from screenshot
        const vin = 'MF7G02700SB000561';
        console.log(`Searching for VIN: ${vin}...`);

        const targetUrl = `${BASE}/aftersales/work-order/data?draw=1&start=0&length=50` +
            `&columns[0][data]=action&columns[0][name]=action&columns[0][searchable]=false&columns[0][orderable]=false` +
            `&columns[1][data]=no_wo&columns[1][name]=no_wo&columns[1][searchable]=true&columns[1][orderable]=true` +
            `&columns[2][data]=no_wo_dms&columns[2][name]=no_wo_dms&columns[2][searchable]=true&columns[2][orderable]=true` +
            `&columns[3][data]=status&columns[3][name]=status&columns[3][searchable]=true&columns[3][orderable]=true` +
            `&columns[19][data]=kategori&columns[19][name]=kategori&columns[19][searchable]=true&columns[19][orderable]=true` +
            `&columns[20][data]=perintah&columns[20][name]=perintah&columns[20][searchable]=true&columns[20][orderable]=true` +
            `&columns[21][data]=stand_km&columns[21][name]=stand_km&columns[21][searchable]=true&columns[21][orderable]=true` +
            `&columns[22][data]=id_wo&columns[22][name]=id_wo&columns[22][searchable]=true&columns[22][orderable]=true` +
            `&order[0][column]=1&order[0][dir]=desc` +
            `&search[value]=${encodeURIComponent(vin)}&search[regex]=false` +
            `&status=&from=&to=&_=${Date.now()}`;

        const dataResp = await fetch(targetUrl, {
            headers: {
                'Cookie': cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `${BASE}/aftersales/work-order`,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            }
        });

        const body = await dataResp.text();
        console.log("Response status:", dataResp.status);
        console.log("Response body length:", body.length);
        console.log("Response snippet:", body.slice(0, 1000));
    } catch (err) {
        console.error("Error running test:", err);
    }
}

test();
