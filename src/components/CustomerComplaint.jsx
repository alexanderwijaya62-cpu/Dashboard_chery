import React, { useState, useEffect } from 'react';
import { AlertCircle, Send, ArrowLeft, MessageCircle, CheckCircle, ImagePlus, X } from 'lucide-react';
import { db } from '../utils/dbClient';

const formatDate = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const CustomerComplaint = ({ user, onBack }) => {
  const [keluhan, setKeluhan] = useState('');
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    window.history.pushState({ page: 'customer-complaint' }, '');
    const handler = () => { if (typeof onBack === 'function') onBack(); };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [onBack]);

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...newImages].slice(0, 5));
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!keluhan.trim()) {
      alert("Silakan isi keluhan Anda.");
      return;
    }

    setIsLoading(true);
    try {
      const croData = {
        workOrderNo: '-',
        nama: user.name || '-',
        telepon: user.username || '-',
        vin: user.vin || '-',
        plat: user.plat_bk || '-',
        serviceAdvisor: '-',
        tipeMobil: '-',
        deskripsi: keluhan.trim(),
        tanggalDatang: formatDate(),
        status: 'Belum',
        respon: '',
        lampiran: images.length > 0 ? JSON.stringify(images.map(i => i.preview)) : '[]'
      };

      const { error } = await db.insert('cro', croData);
      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Gagal mengirim keluhan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 animate-fade-in">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 mb-2">KELUHAN TERKIRIM</h2>
          <p className="text-zinc-400 text-sm font-medium mb-8 leading-relaxed">
            Keluhan Anda telah kami terima. Tim CRO kami akan menghubungi Anda segera.
          </p>
          <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100 mb-6 text-left">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Isi Keluhan</p>
            <p className="text-sm text-zinc-700 font-medium">{keluhan}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onBack}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[72px] md:pb-0 animate-fade-in">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-5 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-zinc-900">Kirim Keluhan</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Customer Complaint</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Info Section */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-800 mb-1">Keluhan Pekerjaan Belum Selesai</p>
              <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                Silakan sampaikan keluhan Anda jika ada pekerjaan yang belum selesai atau
                ada masalah dengan kendaraan setelah servis. Tim CRO kami akan menindaklanjuti.
              </p>
            </div>
          </div>

          {/* Customer Info (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1">Nama</p>
              <p className="text-sm font-bold text-zinc-800">{user.name || '-'}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1">Plat</p>
              <p className="text-sm font-bold text-zinc-800">{user.plat_bk || '-'}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1">Telepon</p>
              <p className="text-sm font-bold text-zinc-800">{user.username || '-'}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
              <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1">VIN</p>
              <p className="text-sm font-bold text-zinc-800">{user.vin || '-'}</p>
            </div>
          </div>

          {/* Complaint Text */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
              Deskripsi Keluhan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Jelaskan keluhan Anda secara detail..."
              className="w-full bg-zinc-50 border border-zinc-200 p-5 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all text-sm font-medium text-zinc-900 resize-none"
              value={keluhan}
              onChange={(e) => setKeluhan(e.target.value)}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">
              Foto Pendukung (opsional, maks 5)
            </label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-24 h-24 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-zinc-100 transition-colors">
                  <ImagePlus size={20} className="text-zinc-300" />
                  <span className="text-[8px] font-bold text-zinc-300 uppercase">Tambah</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />
                </label>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? (
              'Mengirim...'
            ) : (
              <>
                Kirim Keluhan <Send size={18} />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default CustomerComplaint;