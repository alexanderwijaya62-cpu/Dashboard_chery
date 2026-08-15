import https from 'https';
import fs from 'fs';
import nodePath from 'path';
import { createClient } from '@supabase/supabase-js';
import { sendUnauthorized } from './auth.js';

// Local session validation to bypass static import caching in development
async function validateSessionLocal(req) {
  let authUsername = req.headers['x-auth-username'] || req.query?.['X-Auth-Username'] || req.query?.['x-auth-username'] || '';
  let authSessionId = req.headers['x-auth-session-id'] || req.query?.['X-Auth-Session-Id'] || req.query?.['x-auth-session-id'] || '';

  if (!authUsername || !authSessionId) {
    try {
      const urlObj = new URL(req.url || '', 'http://localhost');
      authUsername = urlObj.searchParams.get('X-Auth-Username') || urlObj.searchParams.get('x-auth-username') || '';
      authSessionId = urlObj.searchParams.get('X-Auth-Session-Id') || urlObj.searchParams.get('x-auth-session-id') || '';
    } catch (e) {}
  }

  if (!authUsername || !authSessionId) {
    throw new Error('Unauthorized: Sesi tidak ditemukan. Silakan login kembali.');
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
     try {
       const fs = await import('fs');
       const path = await import('path');
       const envPath = path.resolve(process.cwd(), '.env');
       if (fs.existsSync(envPath)) {
         const content = fs.readFileSync(envPath, 'utf8');
         for (const line of content.split(/\r?\n/)) {
           const trimmed = line.trim();
           if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
             const idx = trimmed.indexOf('=');
             const key = trimmed.slice(0, idx).trim();
             let val = trimmed.slice(idx + 1).trim();
             if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
               val = val.slice(1, -1);
             }
             if (key && !process.env[key]) {
               process.env[key] = val;
             }
           }
         }
       }
     } catch (e) {}
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Internal Server Error: Server auth configuration is missing.');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: userRecord } = await supabase
    .from('users')
    .select('username, role, status')
    .eq('username', authUsername)
    .eq('sessionId', authSessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (userRecord) return userRecord;

  const { data: customerRecord } = await supabase
    .from('customers')
    .select('no_hp, status')
    .eq('no_hp', authUsername)
    .eq('sessionId', authSessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (customerRecord) return { username: customerRecord.no_hp, role: 'customer' };

  const { data: salesRecord } = await supabase
    .from('sales')
    .select('username, status')
    .eq('username', authUsername)
    .eq('status', 'active')
    .maybeSingle();

  if (salesRecord) return { username: salesRecord.username, role: 'sales' };

  throw new Error('Unauthorized: Sesi tidak valid atau telah kedaluwarsa.');
}

// ============================================================
// EPC Proxy — handles both proxy requests and EPCM login
// Use ?action=login (POST) for login, or ?path=... for proxy
// ============================================================

// Global token cache in Node process memory to keep connection alive continuously
let globalEpcmToken = null;

async function performSilentLogin() {
    const username = process.env.DMS_USER;
    const password = process.env.DMS_PASS;
    const enterpriseCode = process.env.DMS_ENTERPRISE_CODE;
    if (!username || !password || !enterpriseCode) return null;

    try {
        const request = (url, options = {}, body = null) => {
            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, text: data }));
                });
                req.on('error', reject);
                const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : "{}";
                req.write(payload);
                req.end();
            });
        };

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=UTF-8',
            'Referer': 'https://qrepcm.mychery.com/',
            'Origin': 'https://qrepcm.mychery.com',
            'X-Requested-With': 'XMLHttpRequest'
        };

        let keyResp = await request('https://qrepcm.mychery.com/api/rest/base/auth/public/key', { method: 'POST', headers });
        let keyData;
        try { keyData = JSON.parse(keyResp.text); } catch (e) { return null; }

        const puzzleX = keyData.data.x;
        const pictureVerifyId = keyData.data.verifyId || keyData.data.id || `${username}+Jaecoo`;
        const percentage = (puzzleX / 590).toFixed(4);

        const verifyUrl = `https://qrepcm.mychery.com/api/rest/base/auth/public/verify?percentage=${percentage}&verifyId=${encodeURIComponent(pictureVerifyId)}`;
        await request(verifyUrl, { method: 'GET', headers });

        const loginPayload = { username, password, enterpriseCode, captchaVerification: puzzleX.toString(), pictureVerifyId, registerMethod: "", configInfo: "" };
        const loginResult = await request('https://qrepcm.mychery.com/api/rest/base/auth/in', { method: 'POST', headers }, loginPayload);
        const result = JSON.parse(loginResult.text);

        if (result.success && result.data?.token) {
            globalEpcmToken = result.data.token;
            return result.data.token;
        }
    } catch (e) {
        console.error("Silent login error:", e);
    }
    return null;
}

async function handleLogin(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const token = await performSilentLogin();
        if (token) {
            return res.status(200).json({ success: true, token });
        } else {
            return res.status(401).json({ success: false, message: "Gagal login ke server Chery EPCM" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token, X-Auth-Username, X-Auth-Session-Id');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Route: ?action=login → EPCM login (Publicly accessible)
    if (req.query.action === 'login') {
        return handleLogin(req, res);
    }

    // Require session validation for all other endpoints
    try {
        await validateSessionLocal(req);
    } catch (authErr) {
        return sendUnauthorized(req, res, authErr.message);
    }

    // Route: ?action=get-active-token → return the currently active global token
    if (req.query.action === 'get-active-token') {
        return res.status(200).json({ success: true, token: globalEpcmToken });
    }

    // Route: ?action=token-bridge → HTML popup for fetching user's EPCM token
    if (req.query.action === 'token-bridge') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>Ambil Token EPCM</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fafafa;color:#18181b;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06)}
h1{font-size:18px;font-weight:800;margin-bottom:8px;letter-spacing:-.02em}
p{color:#71717a;font-size:13px;line-height:1.5;margin-bottom:20px}
.btn{display:block;width:100%;padding:12px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid #d4d4d8;background:#fff;cursor:pointer;transition:all .15s;margin-bottom:10px;text-align:center;text-decoration:none;color:#18181b}
.btn:hover{background:#f4f4f5}
.btn-primary{background:#18181b;color:#fff;border-color:#18181b}
.btn-primary:hover{background:#27272a}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.input{width:100%;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font-size:13px;font-family:monospace;margin-bottom:12px;outline:none}
.input:focus{border-color:#18181b}
.status{font-size:12px;color:#71717a;margin-bottom:16px;padding:8px 12px;background:#f4f4f5;border-radius:6px}
.success{color:#059669;background:#d1fae5}
.error{color:#dc2626;background:#fee2e2}
.hidden{display:none}
.step{font-size:12px;color:#a1a1aa;margin-bottom:4px}
</style></head>
<body>
<div class="card">
  <div id="loading">
    <h1>Mengambil Token EPCM...</h1>
    <p>Mencoba mengambil token dari session EPCM yang sedang login.</p>
    <div class="status">Menghubungi EPCM...</div>
  </div>
  <div id="fallback" class="hidden">
    <h1>Ambil Token EPCM</h1>
    <p class="step">Langkah 1</p>
    <a href="https://qrepcm.mychery.com/api/rest/base/auth/current" target="_blank" class="btn btn-primary" id="openEpcmBtn">Buka Halaman EPCM</a>
    <p style="font-size:12px;color:#a1a1aa;margin-bottom:16px">Login EPCM dulu jika diminta. Nanti muncul JSON, copy token dari field <code style="background:#f4f4f5;padding:1px 5px;border-radius:3px">data.token</code></p>
    <p class="step">Langkah 2</p>
    <input class="input" id="tokenInput" placeholder="Tempel token di sini..." />
    <button class="btn btn-primary" id="sendBtn">Kirim Token ke Aplikasi</button>
    <p style="font-size:11px;color:#a1a1aa;margin-top:12px">Atau gunakan <strong>Auto Login</strong> di halaman utama untuk token dari akun server.</p>
  </div>
</div>
<script>
(async function(){
  try {
    const r = await fetch('https://qrepcm.mychery.com/api/rest/base/auth/current',{
      credentials:'include',
      headers:{'Accept':'application/json'}
    });
    const d = await r.json();
    if(d.success && d.data?.token){
      if(window.opener){
        window.opener.postMessage({type:'EPCM_TOKEN',token:d.data.token},'*');
      }
      document.getElementById('loading').innerHTML='<h1 style="color:#059669">Berhasil! ✅</h1><p>Token ditemukan, mengirim ke aplikasi...</p>';
      setTimeout(()=>window.close(),800);
      return;
    }
  }catch(_){}
  // CORS or session not available → show fallback
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('fallback').classList.remove('hidden');
})();
document.getElementById('sendBtn').onclick=function(){
  const token=document.getElementById('tokenInput').value.trim();
  if(!token)return;
  if(window.opener){
    window.opener.postMessage({type:'EPCM_TOKEN',token:token},'*');
  }
  document.getElementById('sendBtn').textContent='Terkirim!';
  document.getElementById('sendBtn').disabled=true;
  setTimeout(()=>window.close(),500);
};
</script>
</body>
</html>`);
    }

    const path = req.query.path;
    // Token: prefer header, fallback to query param (backward compat)
    const token = req.headers['token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (!path) {
        return res.status(400).json({ error: "Missing path parameter" });
    }

    // Local file cache setup
    const CACHE_DIR = nodePath.join(process.cwd(), 'epc_cache');
    if (!fs.existsSync(CACHE_DIR)) {
        try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}
    }

    // Intercept with cache if available
    let cacheFilePath = null;
    let mimeFilePath = null;
    let isPartlistJson = false;
    let partlistJsonPath = null;

    if (path.startsWith('/api/rest/base/file/view/')) {
        const fileId = path.split('/').pop().split('?')[0];
        if (fileId) {
            cacheFilePath = nodePath.join(CACHE_DIR, `${fileId}.bin`);
            mimeFilePath = nodePath.join(CACHE_DIR, `${fileId}.mime`);
            if (fs.existsSync(cacheFilePath) && fs.existsSync(mimeFilePath)) {
                try {
                    const cachedData = fs.readFileSync(cacheFilePath);
                    const cachedMime = fs.readFileSync(mimeFilePath, 'utf8').trim();
                    res.setHeader('Content-Type', cachedMime);
                    res.setHeader('Cache-Control', 'public, max-age=31536000');
                    return res.send(cachedData);
                } catch (e) {
                    console.error("Cache read error:", e);
                }
            }
        }
    } else if (path.includes('/api/rest/model/partlist/')) {
        const parts = path.split('/');
        const partlistId = parts[parts.indexOf('partlist') + 1]?.split('?')[0];
        if (partlistId) {
            isPartlistJson = true;
            partlistJsonPath = nodePath.join(CACHE_DIR, `partlist_${partlistId}.json`);
            if (fs.existsSync(partlistJsonPath)) {
                try {
                    const cachedJson = JSON.parse(fs.readFileSync(partlistJsonPath, 'utf8'));
                    res.setHeader('Content-Type', 'application/json');
                    return res.status(200).json(cachedJson);
                } catch (e) {
                    console.error("Cache read error for JSON:", e);
                }
            }
        }
    }

    const targetUrl = `https://qrepcm.mychery.com${path}`;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            'Referer': 'https://qrepcm.mychery.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        // Resolve active token: backend-cached token has priority to avoid redundant auto-login on expired client tokens
        let activeToken = globalEpcmToken || token;
        if (!activeToken) {
            console.log("No EPCM token available, performing initial silent login...");
            activeToken = await performSilentLogin();
        }

        if (activeToken) {
            headers['token'] = activeToken.startsWith('Bearer') ? activeToken : `Bearer ${activeToken}`;
            headers['Authorization'] = headers['token'];
        }

        const fetchOptions = {
            method: req.method,
            headers
        };

        if (req.method === 'POST' && req.body) {
            headers['Content-Type'] = req.headers['content-type'] || 'application/json;charset=UTF-8';
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        let response = await fetch(targetUrl, fetchOptions);

        // Auto Refresh & Retry on HTTP 401 Unauthorized status
        if (response.status === 401 && !path.includes('/auth/')) {
            console.log("Token expired (401 status), attempting background auto-refresh & retry...");
            const freshToken = await performSilentLogin();
            if (freshToken) {
                headers['token'] = `Bearer ${freshToken}`;
                headers['Authorization'] = headers['token'];
                fetchOptions.headers = headers;
                response = await fetch(targetUrl, fetchOptions);
            }
        }

        if (!response.ok) {
            const err = await response.text();
            // Purge cache if it was an error
            if (cacheFilePath) {
                try {
                    fs.unlinkSync(cacheFilePath);
                    fs.unlinkSync(mimeFilePath);
                } catch (e) {}
            }
            return res.status(response.status).json({ error: err });
        }

        const contentType = response.headers.get('content-type') || '';
        if (path.includes('/api/rest/base/file/view/') || (contentType && contentType.startsWith('image/'))) {
            const buffer = await response.arrayBuffer();
            let nodeBuffer = Buffer.from(buffer);
            let textHeader = nodeBuffer.slice(0, 200).toString('utf8').trim();
            
            // Auto Refresh & Retry if server returns a JSON 401 error payload inside the file view endpoint
            if (textHeader.startsWith('{') && (textHeader.includes('"success":false') || textHeader.includes('Unauthorized') || textHeader.includes('401'))) {
                console.log("Token expired (JSON 401 payload), attempting background auto-refresh & retry...");
                const freshToken = await performSilentLogin();
                if (freshToken) {
                    headers['token'] = `Bearer ${freshToken}`;
                    headers['Authorization'] = headers['token'];
                    fetchOptions.headers = headers;
                    const retryResponse = await fetch(targetUrl, fetchOptions);
                    if (retryResponse.ok) {
                        const retryBuffer = await retryResponse.arrayBuffer();
                        nodeBuffer = Buffer.from(retryBuffer);
                        textHeader = nodeBuffer.slice(0, 200).toString('utf8').trim();
                    }
                }
            }

            // Self-healing check: if still returning error, delete local cache records and return 401
            if (textHeader.startsWith('{') && (textHeader.includes('"success":false') || textHeader.includes('Unauthorized') || textHeader.includes('401'))) {
                if (cacheFilePath) {
                    try {
                        fs.unlinkSync(cacheFilePath);
                        fs.unlinkSync(mimeFilePath);
                    } catch (e) {}
                }
                res.setHeader('Content-Type', 'application/json');
                return res.status(401).send(nodeBuffer);
            }

            let finalContentType = contentType;
            if (textHeader.startsWith('<svg') || textHeader.startsWith('<?xml') || textHeader.includes('<svg')) {
                finalContentType = 'image/svg+xml';
            } else if (!finalContentType || finalContentType === 'application/octet-stream') {
                finalContentType = 'image/png';
            }
            
            // Save to cache filesystem
            if (cacheFilePath && mimeFilePath) {
                try {
                    fs.writeFileSync(cacheFilePath, nodeBuffer);
                    fs.writeFileSync(mimeFilePath, finalContentType);
                } catch (e) {
                    console.error("Cache write error:", e);
                }
            }

            res.setHeader('Content-Type', finalContentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.send(nodeBuffer);
        }

        const data = await response.json();
        
        // Save partlist details JSON to cache
        if (isPartlistJson && partlistJsonPath && data && data.success !== false) {
            try {
                fs.writeFileSync(partlistJsonPath, JSON.stringify(data));
            } catch (e) {
                console.error("Cache write error for JSON:", e);
            }
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("EPC Proxy Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
