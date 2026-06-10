import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cherymedan.web.id');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server authentication not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { username, password, action } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    if (action === 'change-password') {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new password required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('password')
        .eq('username', username)
        .single();

      if (!user) return res.status(404).json({ error: 'User not found' });

      let valid = false;
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        valid = bcrypt.compareSync(oldPassword, user.password);
      } else {
        valid = oldPassword === user.password;
      }

      if (!valid) return res.status(401).json({ error: 'Password lama salah!' });

      const hash = bcrypt.hashSync(newPassword, 10);
      await supabase.from('users').update({ password: hash }).eq('username', username);

      return res.json({ success: true, message: 'Password berhasil diubah!' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, name, role, plat_bk, vin, password')
      .eq('username', username)
      .single();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let valid = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      valid = bcrypt.compareSync(password, user.password);
    } else {
      valid = password === user.password;
      if (valid) {
        const hash = bcrypt.hashSync(password, 10);
        await supabase.from('users').update({ password: hash }).eq('username', username);
      }
    }

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    await supabase.from('users').update({
      sessionId,
      lastLogin: new Date().toLocaleString('id-ID'),
      isOnline: true
    }).eq('username', username);

    return res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      plat_bk: user.plat_bk,
      vin: user.vin,
      sessionId
    });
  } catch (error) {
    console.error('Login API Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
