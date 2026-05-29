import React, { useState, useEffect } from 'react';
import { 
  History, Car, Calendar, User, FileText, 
  Search, ShieldCheck, ShieldAlert,
  ChevronRight, Wrench, Package, ArrowLeft
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Toastify from 'toastify-js';

const CustomerPanel = ({ user, handleLogout }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user.plat_bk) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('history')
          .select('*')
          .or(`bk.eq.${user.plat_bk},plat.eq.${user.plat_bk}`)
          .order('id', { ascending: false });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error(err);
        Toastify({ text: "Gagal mengambil riwayat servis", style: { background: "#ef4444" } }).showToast();
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user.plat_bk]);

  return (
    <div className="min-h-screen bg-white pb-[72px] md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-6 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <Car size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-black">Halo, {user.name}</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-2">
                {user.plat_bk} <span className="w-1 h-1 bg-zinc-200 rounded-full"></span> {user.vin || 'No VIN'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${user.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                {user.status === 'approved' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                <span className="hidden sm:inline">{user.status === 'approved' ? 'Terverifikasi' : 'Menunggu Verifikasi'}</span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Verification Alert */}
        {user.status !== 'approved' && (
          <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-[2rem] text-black shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-zinc-200 p-3 rounded-2xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg text-black">Akun Sedang Diverifikasi</h3>
                <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                  Terima kasih sudah melengkapi profil! Admin kami sedang melakukan verifikasi data kendaraan Anda. 
                  Riwayat servis akan muncul otomatis setelah akun Anda disetujui.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl w-fit overflow-x-auto">
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-w-[44px] min-h-[44px] ${activeTab === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Riwayat Servis
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-w-[44px] min-h-[44px] ${activeTab === 'profile' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Data Kendaraan
          </button>
        </div>

        {/* Content */}
        {activeTab === 'history' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-1">Catatan Perbaikan</h2>
            
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-zinc-400 font-bold text-sm">Memuat riwayat...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-300">
                  <History size={40} />
                </div>
                <h3 className="text-xl font-black text-black">Belum Ada Riwayat</h3>
                <p className="text-zinc-400 text-sm mt-2 max-w-xs mx-auto">
                  Sepertinya kendaraan Anda belum memiliki catatan servis di sistem kami.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map((item, idx) => (
                  <div key={idx} className="bg-white border border-zinc-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all group">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-100 group-hover:text-black transition-colors">
                          <Wrench size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">{item.Tanggal || 'Tanggal Tidak Tersedia'}</p>
                          <h4 className="text-base font-black text-black">{item.tipe || 'Servis Kendaraan'}</h4>
                        </div>
                      </div>
                      <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                        Selesai
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1">Mekanik</p>
                        <p className="text-xs font-bold text-black">{item.mechanicName || 'Team Workshop'}</p>
                      </div>
                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1">Kategori</p>
                        <p className="text-xs font-bold text-black">{item.category || 'Reguler'}</p>
                      </div>
                    </div>

                    {item.keluhan && (
                      <div className="mb-6">
                        <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-2 ml-1">Detail Pekerjaan</p>
                        <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 text-xs text-zinc-600 leading-relaxed font-medium">
                          {item.keluhan}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-6 border-t border-zinc-50">
                       <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">ID Servis: {item.id}</span>
                       <button className="flex items-center gap-1 text-[10px] font-black text-black uppercase tracking-widest hover:gap-2 transition-all min-w-[44px] min-h-[44px] justify-center">
                          Lihat Detail <ChevronRight size={14} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
             <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-1">Data Akun & Kendaraan</h2>
             <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-8 shadow-sm divide-y divide-zinc-50">
                <div className="py-6 flex items-center justify-between first:pt-0">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400"><User size={18} /></div>
                      <div>
                         <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Nama Lengkap</p>
                         <p className="text-sm font-black text-black">{user.name}</p>
                      </div>
                   </div>
                </div>
                <div className="py-6 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400"><Car size={18} /></div>
                      <div>
                         <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Plat Kendaraan</p>
                         <p className="text-sm font-black text-black">{user.plat_bk}</p>
                      </div>
                   </div>
                </div>
                <div className="py-6 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400"><FileText size={18} /></div>
                      <div>
                         <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Nomor Rangka (VIN)</p>
                         <p className="text-sm font-black text-black">{user.vin || '-'}</p>
                      </div>
                   </div>
                </div>
                <div className="py-6 flex items-center justify-between last:pb-0">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400"><Package size={18} /></div>
                      <div>
                         <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Username / WhatsApp</p>
                         <p className="text-sm font-black text-black">{user.username}</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerPanel;
