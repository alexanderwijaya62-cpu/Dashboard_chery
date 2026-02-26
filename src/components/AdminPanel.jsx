import React from 'react';
import { User, LogOut, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check } from 'lucide-react';
import TimeInput from './TimeInput';

const AdminPanel = ({ user, handleLogout, queue, deleteItem, editItem, handleSave, formData, setFormData, isEditing, errorMessage, formatTime }) => (
  <div className="p-6 max-w-[1200px] mx-auto animate-fade-in pb-20">
    <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-zinc-900 rounded-xl">
          <User className="text-white" size={24} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Login Sebagai</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900">{user?.name}</h3>
        </div>
      </div>
      <button 
        onClick={handleLogout}
        className="bg-red-50 text-red-600 px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-sm"
      >
        <LogOut size={16} /> Logout
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Form Input */}
      <div className="lg:col-span-4">
        <div className="bg-white p-8 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 sticky top-24">
          <h2 className="text-xl font-black mb-6 flex items-center gap-3">
            <div className="bg-red-600 p-1.5 rounded-lg text-white">
              {isEditing ? <Edit3 size={18} /> : <Plus size={18} />}
            </div>
            {isEditing ? 'Update Antrian' : 'Input Kendaraan'}
          </h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setFormData({...formData, category: 'Booking'})}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${formData.category === 'Booking' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}
              >
                <Bookmark size={14} fill={formData.category === 'Booking' ? 'white' : 'transparent'} /> Booking
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, category: 'Reguler'})}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${formData.category === 'Reguler' ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}
              >
                <Zap size={14} /> Reguler
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Nomor Plat (BK)</label>
              <input required type="text" placeholder="BK 1234 ABC"
                className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-xl font-bold focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all uppercase"
                value={formData.bk}
                onChange={(e) => setFormData({...formData, bk: e.target.value})}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Tipe Mobil</label>
              <input required type="text" placeholder="Contoh: Omoda 5"
                className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-xl font-bold focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all"
                value={formData.tipe}
                onChange={(e) => setFormData({...formData, tipe: e.target.value})}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1 text-center block">
                Estimasi {isEditing ? 'Waktu' : '(Min. 30 Menit)'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <TimeInput label="Jam" value={formData.jam} onChange={(val) => setFormData({...formData, jam: val})} />
                <TimeInput label="Mnt" value={formData.menit} max={59} onChange={(val) => setFormData({...formData, menit: val})} />
                <TimeInput label="Det" value={formData.detik} max={59} onChange={(val) => setFormData({...formData, detik: val})} />
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 text-red-600 text-[11px] p-3 rounded-xl border border-red-100 flex items-center gap-2 font-bold">
                <AlertCircle size={14} /> {errorMessage}
              </div>
            )}

            <button type="submit" className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex justify-center items-center gap-2">
              {isEditing ? <CheckCircle2 size={18} /> : <Plus size={18} />}
              {isEditing ? 'Simpan Perubahan' : 'Input ke Antrian'}
            </button>
          </form>
        </div>
      </div>

      {/* Monitoring List */}
      <div className="lg:col-span-8">
        <div className="bg-white rounded-[1.5rem] border border-zinc-200 overflow-hidden shadow-lg shadow-zinc-200/30">
          <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/30 flex justify-between items-center">
            <h3 className="text-xl font-black italic tracking-tight uppercase">Monitoring List</h3>
            <span className="bg-zinc-900 text-white text-[9px] font-black px-3 py-1 rounded-full">{queue.length} Antrian</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black">Detail Mobil</th>
                <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black text-center">Timer</th>
                <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/50 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase ${item.category === 'Booking' ? 'bg-red-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                        {item.category[0]}
                      </span>
                      <div>
                        <p className="text-xl font-black tracking-tight text-zinc-900">{item.bk}</p>
                        <p className="text-zinc-600 text-[10px] uppercase font-black">{item.tipe}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`font-mono text-2xl font-black tabular-nums ${item.estimasi === 0 ? 'text-green-500' : 'text-zinc-800'}`}>
                      {formatTime(item.estimasi)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => deleteItem(item.id)} 
                        className={`p-3 rounded-xl transition-all ${item.estimasi === 0 ? 'bg-green-500 text-white shadow-lg animate-pulse' : 'text-green-500 hover:bg-green-50'}`}
                        title="Konfirmasi Selesai"
                      >
                        <Check size={18} />
                      </button>
                      <button onClick={() => editItem(item)} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit3 size={18} />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default AdminPanel;