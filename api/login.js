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
    // ── CHANGE PASSWORD ──
    if (action === 'change-password') {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new password required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter' });
      }

      // Try users table first, then customers
      const { data: user } = await supabase
        .from('users')
        .select('password')
        .eq('username', username)
        .maybeSingle();

      if (user) {
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

      const { data: customer } = await supabase
        .from('customers')
        .select('password')
        .eq('no_hp', username)
        .maybeSingle();

      if (!customer) return res.status(404).json({ error: 'User not found' });

      let valid = false;
      if (customer.password.startsWith('$2b$') || customer.password.startsWith('$2a$')) {
        valid = bcrypt.compareSync(oldPassword, customer.password);
      } else {
        valid = oldPassword === customer.password;
      }
      if (!valid) return res.status(401).json({ error: 'Password lama salah!' });

      const hash = bcrypt.hashSync(newPassword, 10);
      await supabase.from('customers').update({ password: hash }).eq('no_hp', username);
      return res.json({ success: true, message: 'Password berhasil diubah!' });
    }

    // ── LOGIN: try users table (staff/legacy customers) ──
    const { data: user } = await supabase
      .from('users')
      .select('id, username, name, role, plat_bk, vin, password, status')
      .eq('username', username)
      .maybeSingle();

    if (user) {
      if (user.role === 'customer' && user.status === 'pending') {
        return res.status(403).json({ error: 'Akun belum aktif. Silakan verifikasi OTP terlebih dahulu.' });
      }

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
    }

    // ── LOGIN: try customers table ──
    const { data: customer } = await supabase
      .from('customers')
      .select('id, no_hp, nama, vin, no_bk, password, status')
      .eq('no_hp', username)
      .maybeSingle();

    if (!customer) return res.status(401).json({ error: 'Invalid credentials' });

    if (customer.status === 'pending') {
      return res.status(403).json({ error: 'Akun belum aktif. Silakan verifikasi OTP terlebih dahulu.' });
    }

    let valid = false;
    if (customer.password.startsWith('$2b$') || customer.password.startsWith('$2a$')) {
      valid = bcrypt.compareSync(password, customer.password);
    } else {
      valid = password === customer.password;
      if (valid) {
        const hash = bcrypt.hashSync(password, 10);
        await supabase.from('customers').update({ password: hash }).eq('no_hp', username);
      }
    }

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    // Customers don't have sessionId/isOnline columns; tracked via JWT/app state

    return res.json({
      id: customer.id,
      username: customer.no_hp,
      name: customer.nama,
      role: 'customer',
      plat_bk: customer.no_bk,
      vin: customer.vin,
      sessionId
    });
  } catch (error) {
    console.error('Login API Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
