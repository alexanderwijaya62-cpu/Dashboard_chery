import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function ensureEnvLoaded() {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
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
    } catch (e) {
      console.warn('Gagal membaca .env di auth.js:', e.message);
    }
  }
}

// Jalankan pembacaan env
ensureEnvLoaded();

export async function validateSession(req) {
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Internal Server Error: Server auth configuration is missing.');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Cek users table (staff / legacy customers)
  const { data: userRecord } = await supabase
    .from('users')
    .select('username, role, status')
    .eq('username', authUsername)
    .eq('sessionId', authSessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (userRecord) return userRecord;

  // 2. Cek customers table
  const { data: customerRecord } = await supabase
    .from('customers')
    .select('no_hp, status')
    .eq('no_hp', authUsername)
    .eq('sessionId', authSessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (customerRecord) {
    return { username: customerRecord.no_hp, role: 'customer' };
  }

  // 3. Cek sales table
  const { data: salesRecord } = await supabase
    .from('sales')
    .select('username, status')
    .eq('username', authUsername)
    .eq('status', 'active')
    .maybeSingle();

  if (salesRecord) {
    return { username: salesRecord.username, role: 'sales' };
  }

  throw new Error('Unauthorized: Sesi tidak valid atau telah kedaluwarsa.');
}

export function sendUnauthorized(req, res, message) {
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('text/html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Akses Ditolak - 401</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: radial-gradient(circle at center, #111827, #030712);
            color: #ffffff;
            font-family: 'Outfit', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            perspective: 1000px;
        }

        .container {
            text-align: center;
            padding: 40px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            max-width: 480px;
            width: 90%;
            transform: translateZ(0);
            animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(1deg); }
        }

        .icon-container {
            margin-bottom: 24px;
            position: relative;
            display: inline-block;
        }

        .lock-icon {
            font-size: 80px;
            animation: shake 2s ease-in-out infinite;
            display: inline-block;
        }

        @keyframes shake {
            0%, 100% { transform: scale(1) rotate(0deg); }
            10%, 30% { transform: scale(1.1) rotate(-8deg); }
            20%, 40% { transform: scale(1.1) rotate(8deg); }
            50% { transform: scale(1) rotate(0deg); }
        }

        .glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120px;
            height: 120px;
            background: radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0) 70%);
            z-index: -1;
            animation: pulse 2s infinite alternate;
        }

        @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
            100% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        }

        h1 {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -1px;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #f87171, #ef4444, #b91c1c);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
        }

        p {
            color: #9ca3af;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .btn {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: #ffffff;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 0.5px;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
            background: linear-gradient(135deg, #f87171, #ef4444);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-container">
            <div class="glow"></div>
            <div class="lock-icon">🛑</div>
        </div>
        <h1>NO NO YA JANGAN COBA COBA</h1>
        <p>${message}</p>
        <a href="https://cherymedan.web.id" class="btn">Kembali ke Beranda</a>
    </div>
</body>
</html>`);
  }
  return res.status(401).json({ error: message });
}
