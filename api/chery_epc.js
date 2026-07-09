import https from 'https';

// ============================================================
// EPC Proxy — handles both proxy requests and EPCM login
// Use ?action=login (POST) for login, or ?path=... for proxy
// ============================================================

async function handleLogin(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const username = process.env.DMS_USER;
    const password = process.env.DMS_PASS;
    const enterpriseCode = process.env.DMS_ENTERPRISE_CODE;

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
        try { keyData = JSON.parse(keyResp.text); } catch (e) {
            return res.status(500).json({ success: false, message: "Parse error: " + keyResp.text.substring(0, 30) });
        }

        if (!keyData.success || !keyData.data || !keyData.data.backgroundImage) {
            return res.status(500).json({ success: false, message: "Gagal memancing gambar puzzle: " + (keyData.message || "Data null") });
        }

        const puzzleX = keyData.data.x;
        const pictureVerifyId = `${username}+Jaecoo`;
        const percentage = (puzzleX / 590).toFixed(4);

        const verifyUrl = `https://qrepcm.mychery.com/api/rest/base/auth/public/verify?percentage=${percentage}&verifyId=${encodeURIComponent(pictureVerifyId)}`;
        await request(verifyUrl, { method: 'GET', headers });

        const loginPayload = { username, password, enterpriseCode, captchaVerification: puzzleX.toString(), pictureVerifyId, registerMethod: "", configInfo: "" };
        const loginResult = await request('https://qrepcm.mychery.com/api/rest/base/auth/in', { method: 'POST', headers }, loginPayload);
        const result = JSON.parse(loginResult.text);

        if (result.success && result.data?.token) {
            return res.status(200).json({ success: true, token: result.data.token });
        } else {
            return res.status(401).json({ success: false, message: result.message || "Gagal Login" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Route: ?action=login → EPCM login
    if (req.query.action === 'login') {
        return handleLogin(req, res);
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

    // Route: ?path=... → EPC proxy
    const path = req.query.path;
    // Token: prefer header, fallback to query param (backward compat)
    const token = req.headers['token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (!path) {
        return res.status(400).json({ error: "Missing path parameter" });
    }

    const targetUrl = `https://qrepcm.mychery.com${path}`;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            'Referer': 'https://qrepcm.mychery.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        if (token) {
            headers['token'] = token.startsWith('Bearer') ? token : `Bearer ${token}`;
            headers['Authorization'] = headers['token'];
        }

        const response = await fetch(targetUrl, { headers });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.send(Buffer.from(buffer));
        }

        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error("EPC Proxy Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
