
import https from 'https';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const username = process.env.DMS_USER || 'Alex';
    const password = process.env.DMS_PASS || 'Alex123$';
    const enterpriseCode = process.env.DMS_ENTERPRISE_CODE || '10007901';

    try {
        const request = (url, options = {}, body = null) => {
            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, text: data }));
                });
                req.on('error', reject);
                // Penting: Kirim "{}" jika body null untuk memancing 'Created successfully'
                const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : "{}";
                req.write(payload);
                req.end();
            });
        };

        console.log("--- Memancing Gambar Puzzle (POST Mode) ---");
        
        // Gunakan Header super lengkap mirip Chrome
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=UTF-8',
            'Referer': 'https://qrepcm.mychery.com/',
            'Origin': 'https://qrepcm.mychery.com',
            'X-Requested-With': 'XMLHttpRequest'
        };

        // 1. Ambil Captcha pakai POST dengan body "{}"
        let keyResp = await request('https://qrepcm.mychery.com/api/rest/base/auth/public/key', { 
            method: 'POST', 
            headers
        });

        let keyData;
        try {
            keyData = JSON.parse(keyResp.text);
        } catch (e) {
            return res.status(500).json({ success: false, message: "Server kirim teks (Mungkin RSA Key): " + keyResp.text.substring(0, 30) });
        }

        if (!keyData.success || !keyData.data || !keyData.data.backgroundImage) {
            return res.status(500).json({ success: false, message: "Gagal memancing gambar puzzle: " + (keyData.message || "Data null") });
        }

        const puzzleX = keyData.data.x;
        const pictureVerifyId = `${username}+Jaecoo`;
        
        // Konstanta lebar gambar EPCM (Biasanya 590 atau 280 tergantung versi)
        // Kita hitung percentage untuk verifikasi
        const imageWidth = 590; 
        const percentage = (puzzleX / imageWidth).toFixed(4);

        console.log(`✅ Puzzle Terpancing! X: ${puzzleX}, Percentage: ${percentage}`);

        // 2. Verifikasi Captcha (PENTING: Tanpa ini, login akan ditolak)
        console.log("--- Melakukan Verifikasi Slider ---");
        const verifyUrl = `https://qrepcm.mychery.com/api/rest/base/auth/public/verify?percentage=${percentage}&verifyId=${encodeURIComponent(pictureVerifyId)}`;
        const verifyResp = await request(verifyUrl, { 
            method: 'GET', 
            headers
        });

        console.log("--- Verify Response ---", verifyResp.text);

        // 3. Login
        console.log("--- Melakukan Login ---");
        const loginPayload = {
            username,
            password,
            enterpriseCode,
            captchaVerification: puzzleX.toString(),
            pictureVerifyId,
            registerMethod: "",
            configInfo: ""
        };

        const loginResult = await request('https://qrepcm.mychery.com/api/rest/base/auth/in', {
            method: 'POST',
            headers
        }, loginPayload);

        const result = JSON.parse(loginResult.text);

        if (result.success && result.data?.token) {
            console.log("✅ EPCM LOGIN SUCCESS!");
            return res.status(200).json({ success: true, token: result.data.token });
        } else {
            console.log("❌ LOGIN FAILED:", result.message);
            return res.status(401).json({ success: false, message: result.message || "Gagal Login" });
        }


    } catch (error) {
        console.error("❌ SCRIPT ERROR:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}
