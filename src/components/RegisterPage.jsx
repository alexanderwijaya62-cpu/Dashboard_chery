import React, { useState } from 'react';
import { Phone, ArrowRight, UserPlus, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import cheryLogo from '../assets/cherylogo.png';
import orientalLogo from '../assets/oriental.jpeg';

const RegisterPage = ({ setCurrentPage, setErrorMessage, errorMessage }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      alert("Nomor telepon tidak valid!");
      return;
    }
    if (!password || password.length < 6) {
      alert("Password minimal 6 karakter!");
      return;
    }

    setIsLoading(true);
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', phone)
        .maybeSingle();

      if (existingUser) {
        alert("Nomor ini sudah terdaftar. Silakan login.");
        setCurrentPage('login');
        return;
      }

      // Create user with status 'pending'
      const { error } = await supabase.from('users').insert({
        username: phone,
        password: password, 
        name: phone,
        role: 'customer',
        status: 'pending' // Account needs owner confirmation
      });

      if (error) throw error;

      // Notify Owner (using broadcast or a dedicated table)
      try {
        await supabase.from('notifications').insert({
          type: 'new_registration',
          message: `Pelanggan baru mendaftar: ${phone}`,
          target_role: 'owner',
          read: false
        });
      } catch (e) {
        console.warn("Gagal mengirim notifikasi ke owner");
      }

      alert("Registrasi berhasil! Silakan lengkapi profil Anda.");
      
      // Auto login after registration
      const userData = { username: phone, name: phone, role: 'customer', status: 'pending' };
      localStorage.setItem('chery_auth_user', JSON.stringify(userData));
      window.location.reload(); 

    } catch (err) {
      console.error(err);
      alert("Gagal melakukan registrasi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 py-20 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-6 mb-6">
            <img src={cheryLogo} alt="Chery Logo" className="h-16 object-contain" />
            <img src={orientalLogo} alt="Oriental Logo" className="h-16 object-contain rounded-lg" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900">DAFTAR PELANGGAN</h2>
          <p className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]">Chery Oriental Medan</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Nomor WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type="tel"
                required
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold text-zinc-900"
                placeholder="0812xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 pr-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold text-zinc-900"
                placeholder="Buat Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[9px] text-zinc-400 ml-2 italic">* Minimal 6 karakter</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} /> {errorMessage}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : (
              <>
                Daftar Sekarang <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('login')}
            className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600 transition-colors"
          >
            Sudah punya akun? Login di sini
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
