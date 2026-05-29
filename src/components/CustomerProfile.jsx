import React, { useState } from 'react';
import { User, Car, FileText, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const CustomerProfile = ({ user, setUser }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    plat_bk: user.plat_bk || '',
    vin: user.vin || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.plat_bk || !formData.vin) {
      alert("Semua data wajib diisi!");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          plat_bk: formData.plat_bk.toUpperCase().replace(/\s+/g, ''),
          vin: formData.vin.toUpperCase(),
        })
        .eq('username', user.username);

      if (error) throw error;

      alert("Profil berhasil diperbarui! Silakan tunggu konfirmasi admin untuk melihat riwayat servis.");
      
      const updatedUser = { ...user, ...formData };
      setUser(updatedUser);
      localStorage.setItem('chery_auth_user', JSON.stringify(updatedUser));
      
      // No need to change page manually, App.jsx logic will handle it or user can refresh
      window.location.reload();

    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan profil.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 py-20">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-200">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <User size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-black">LENGKAPI PROFIL</h2>
          <p className="text-zinc-400 text-sm font-medium mt-2">Mohon lengkapi data kendaraan Anda</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type="text"
                required
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all font-bold text-black"
                placeholder="Nama Anda"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Plat BK (No. Polisi)</label>
              <div className="relative">
                <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all font-bold text-black"
                  placeholder="BK 1234 ABC"
                  value={formData.plat_bk}
                  onChange={(e) => setFormData({ ...formData, plat_bk: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Nomor Rangka (VIN)</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all font-bold text-black"
                  placeholder="VIN Kendaraan"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="text-black shrink-0" size={20} />
            <p className="text-[10px] text-black font-medium leading-relaxed">
              Data ini akan digunakan untuk mencocokkan riwayat servis kendaraan Anda di sistem kami secara otomatis.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-black hover:bg-zinc-800 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:bg-zinc-200 disabled:text-zinc-300"
          >
            {isLoading ? 'Menyimpan...' : (
              <>
                Simpan & Lanjutkan <Save size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerProfile;
