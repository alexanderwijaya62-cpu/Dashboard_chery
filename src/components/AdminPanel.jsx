import React, { useState, useEffect } from 'react';
import { User, LogOut, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check, Moon, Sun, X, Package, Clock } from 'lucide-react';
import TimeInput from './TimeInput';

const AdminPanel = ({ user, handleLogout, queue, deleteItem, clearQueue, editItem, handleSave, formData, setFormData, isEditing, errorMessage, formatTime, handleComplete, handleSetOvernight, handleCancelOvernight, breakSettings, setBreakSettings }) => {
  const totalDetik = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
  const now = new Date();
  const previewSelesai = new Date(now.getTime() + (totalDetik * 1000));
  const previewTimeStr = totalDetik >= 1800 ? previewSelesai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  const isToday = (time) => {
    if (!time) return false;
    try {
      // Jika format DD/MM/YYYY HH:mm:ss
      if (typeof time === 'string' && time.includes('/')) {
        const parts = time.split(/[\/\s,:]+/);
        if (parts.length >= 3) {
          const d = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const y = parseInt(parts[2]);
          const date = new Date(y, m, d);
          return date.toDateString() === new Date().toDateString();
        }
      }

      const date = new Date(time);
      if (!isNaN(date.getTime())) {
        return date.toDateString() === new Date().toDateString();
      }

      const ts = parseInt(time);
      if (!isNaN(ts)) {
        return new Date(ts).toDateString() === new Date().toDateString();
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const [sparepartOrders, setSparepartOrders] = useState([]);
  const [dismissedBubbles, setDismissedBubbles] = useState(new Set());

  const fetchSpareparts = async () => {
    try {
      const resp = await fetch("/api/gas_sparepart?action=get", {
        headers: { "x-api-key": import.meta.env.VITE_API_KEY || "chery-secret-key-2024" }
      });
      const data = await resp.json();
      if (data && Array.isArray(data.orders)) {
        const parsedOrders = data.orders.map(o => {
          const oNum = o.orderNumber || o['Handling order number'] || o['Order Number'];
          return {
            ...o,
            id: oNum || o.id || o.ID,
            orderNumber: oNum,
            namaPemesan: o.namaPemesan || o.founder || o['Nama Pemesan']
          };
        });
        setSparepartOrders(parsedOrders);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSpareparts();
    const inv = setInterval(fetchSpareparts, 10000);
    return () => clearInterval(inv);
  }, []);

  const handleConfirmSparepart = async (order) => {
    try {
      // Ambil list admin yang sudah konfirmasi sebelumnya
      const currentConfirmedBy = order.confirmedBy || '';
      const myName = user?.name || 'Admin';

      // Jika nama saya sudah ada di list, jangan tambah lagi (atau anggap sudah konfirmasi)
      if (currentConfirmedBy.includes(myName)) {
        handleDismissBubble(order.id);
        return;
      }

      const newConfirmedBy = currentConfirmedBy ? `${currentConfirmedBy}, ${myName}` : myName;

      // Gunakan formatting yang konsisten DD/MM/YYYY HH:mm:ss
      const now = new Date();
      // Gunakan processing time (tanggalCSI) jika ada, jika tidak gunakan sekarang (sebagai fallback)
      const dateToUse = order.tanggalCSI || order['processing time'] || order['Processing Time'] || order.modified || order['modified date'] || now;
      const d = new Date(dateToUse);
      const finalDate = !isNaN(d.getTime()) ? d : now;

      const formattedDate = `${String(finalDate.getDate()).padStart(2, '0')}/${String(finalDate.getMonth() + 1).padStart(2, '0')}/${finalDate.getFullYear()} ${String(finalDate.getHours()).padStart(2, '0')}:${String(finalDate.getMinutes()).padStart(2, '0')}:${String(finalDate.getSeconds()).padStart(2, '0')}`;

      await fetch(`/api/gas_sparepart?action=update&Handling%20order%20number=${encodeURIComponent(order.id)}`, {
        method: "POST",
        headers: {
          "x-api-key": import.meta.env.VITE_API_KEY || "chery-secret-key-2024",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: 'update', // Coba gunakan action update agar lebih kompatibel
          'Handling order number': order.id,
          confirmedTime: formattedDate,
          confirmedBy: newConfirmedBy,
          status: 'confirmed'
        })
      });
      fetchSpareparts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissBubble = (orderId) => {
    setDismissedBubbles(prev => new Set(prev).add(orderId));
  };

  const arrivedSpareparts = sparepartOrders.filter(o => o.status === 'arrived' || o.status === 'partial');
  // LIST BAWAH: Tampilkan jika status arrived, partial, atau confirmed DAN terjadi hari ini
  const confirmedSpareparts = sparepartOrders.filter(o => {
    const isArrivedStatus = o.status === 'arrived' || o.status === 'partial';
    const isConfirmedStatus = o.status === 'confirmed';
    const timeToCheck = o.confirmedTime || o.tanggalCSI || o['processing time'] || o.arrivedTime || o.modified || o['modified date'] || o.tanggal;

    // Tampilkan jika statusnya sudah di-proses (Arrived/Partial/Confirmed) dan itu hari ini
    return (isArrivedStatus || isConfirmedStatus) && isToday(timeToCheck);
  });

  // Logika Bubble: Muncul jika (Arrived/Partial) ATAU (Sudah Confirmed tapi nama SAYA belum ada di list pelihat)
  const activeNotifications = sparepartOrders.filter(order => {
    const isArrived = order.status === 'arrived' || order.status === 'partial';
    const isConfirmedByOthers = order.status === 'confirmed';
    const myName = user?.name || 'Admin';
    const iHaveConfirmed = order.confirmedBy && order.confirmedBy.includes(myName);

    // Tampilkan jika (belum diconfirm siapapun) ATAU (sudah diconfirm orang lain tapi SAYA belum klik)
    const shouldShow = (isArrived || (isConfirmedByOthers && !iHaveConfirmed)) && !dismissedBubbles.has(order.id);
    return shouldShow;
  });
  const hasNotifications = activeNotifications.length > 0;

  const keluhanParts = (formData.keluhan || '').split(',').map(s => s.trim());
  const selectedFS = keluhanParts.find(p => ['FS1', 'FS2', 'FS3'].includes(p)) || '';
  const selectedUS = keluhanParts.find(p => ['KLH', 'US'].includes(p)) || '';

  const handleFSClick = (val) => {
    const fs = selectedFS === val ? '' : val;
    setFormData({ ...formData, keluhan: [fs, selectedUS].filter(Boolean).join(', ') });
  };

  const handleUSClick = (val) => {
    const us = selectedUS === val ? '' : val;
    setFormData({ ...formData, keluhan: [selectedFS, us].filter(Boolean).join(', ') });
  };

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto animate-fade-in pb-20 relative px-4 sm:px-10">

      {/* Notifikasi Bubble Sparepart - Removed from fixed to be part of grid */}

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Input */}
        <div className={`${hasNotifications ? "lg:col-span-3" : "lg:col-span-4"} lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2 custom-scrollbar`}>
          <div className="bg-white p-8 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40">
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
                  onClick={() => setFormData({ ...formData, category: 'Booking' })}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${formData.category === 'Booking' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}
                >
                  <Bookmark size={14} fill={formData.category === 'Booking' ? 'white' : 'transparent'} /> Booking
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, category: 'Reguler' })}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${formData.category === 'Reguler' ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}
                >
                  <Zap size={14} /> Reguler
                </button>
              </div>

              <div className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-[1.2rem]">
                <div>
                  <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest block mb-2 text-center">Free Service</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['FS1', 'FS2', 'FS3'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleFSClick(val)}
                        className={`py-2 rounded-lg text-[10px] font-black tracking-widest transition-all border ${selectedFS === val ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200/60">
                  <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest block mb-2 text-center">Keluhan Opsional</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['KLH', 'US'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleUSClick(val)}
                        className={`py-2 rounded-lg text-[10px] font-black tracking-widest transition-all border ${selectedUS === val ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Nomor Plat (BK)</label>
                <input required type="text" placeholder="BK 1234 ABC"
                  className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-xl font-bold focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all uppercase"
                  value={formData.bk}
                  onChange={(e) => setFormData({ ...formData, bk: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Tipe Mobil</label>
                <input required type="text" placeholder="Contoh: Omoda 5"
                  className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-xl font-bold focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all"
                  value={formData.tipe}
                  onChange={(e) => setFormData({ ...formData, tipe: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1 text-center block">
                  Estimasi {isEditing ? 'Waktu' : '(Min. 30 Menit)'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <TimeInput label="Jam" value={formData.jam} onChange={(val) => setFormData({ ...formData, jam: val })} />
                  <TimeInput label="Mnt" value={formData.menit} max={59} onChange={(val) => setFormData({ ...formData, menit: val })} />
                  <TimeInput label="Det" value={formData.detik} max={59} onChange={(val) => setFormData({ ...formData, detik: val })} />
                </div>
                <div className="text-center mt-3 bg-blue-50/50 border border-blue-100 p-2 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                    Preview Selesai: {totalDetik >= 1800 ? previewTimeStr : 'Waktu tidak valid'}
                  </span>
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

          <div className="bg-white p-6 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 mt-6 animate-fade-in relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <h2 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="bg-orange-500 p-1.5 rounded-lg text-white">
                <Clock size={18} />
              </div>
              Jam Istirahat
            </h2>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1 mb-2 block">Mulai Istirahat</label>
                <div className="grid grid-cols-2 gap-2">
                  <TimeInput label="Jam" value={breakSettings.startHour} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, startHour: parseInt(val) || 0 })} />
                  <TimeInput label="Mnt" value={breakSettings.startMinute} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, startMinute: parseInt(val) || 0 })} />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-50">
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1 mb-2 block">Selesai (Sen-Kam & Sab)</label>
                <div className="grid grid-cols-2 gap-2">
                  <TimeInput label="Jam" value={breakSettings.endHourNormal} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourNormal: parseInt(val) || 0 })} />
                  <TimeInput label="Mnt" value={breakSettings.endMinuteNormal} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteNormal: parseInt(val) || 0 })} />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-50">
                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1 mb-2 block">Selesai (Jumat)</label>
                <div className="grid grid-cols-2 gap-2">
                  <TimeInput label="Jam" value={breakSettings.endHourFriday} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourFriday: parseInt(val) || 0 })} />
                  <TimeInput label="Mnt" value={breakSettings.endMinuteFriday} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteFriday: parseInt(val) || 0 })} />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
                <p className="text-[9px] text-orange-700 font-bold italic leading-relaxed text-center">
                  * Estimasi pengerjaan akan BERHENTI otomatis pada jam istirahat dan BERLANJUT setelah selesai.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring List */}
        <div className={hasNotifications ? "lg:col-span-6" : "lg:col-span-8"}>
          <div className="bg-white rounded-[1.5rem] border border-zinc-200 overflow-hidden shadow-lg shadow-zinc-200/30">
            <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/30 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black italic tracking-tight uppercase">Monitoring List</h3>
                {queue.length > 0 && (
                  <button onClick={clearQueue} className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">
                    Hapus Semua
                  </button>
                )}
              </div>
              <span className="bg-zinc-900 text-white text-[9px] font-black px-3 py-1 rounded-full">{queue.length} Antrian</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black">Detail Mobil</th>
                    <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black text-center">Waktu Masuk</th>
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
                      <td className="px-8 py-5 text-center flex flex-col items-center justify-center">
                        {!isToday(item.id) && (
                          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest block mb-0.5">
                            {new Date(parseInt(item.id)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        <span className="font-mono text-xl font-black text-zinc-400 tracking-tight">
                          {new Date(parseInt(item.id)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`font-mono text-2xl font-black tabular-nums ${item.estimasi === 0 ? 'text-green-500' : 'text-zinc-800'}`}>
                          {formatTime(item.estimasi)}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleComplete(item)}
                            className={`p-3 rounded-xl transition-all ${item.estimasi === 0 ? 'bg-green-500 text-white shadow-lg animate-pulse' : 'text-green-500 hover:bg-green-50'}`}
                            title="Konfirmasi Selesai"
                          >
                            <Check size={18} />
                          </button>
                          {item.status !== 'menginap' ? (
                            <button onClick={() => handleSetOvernight(item)} className="p-3 text-purple-500 hover:bg-purple-50 rounded-xl transition-all" title="Set Menginap">
                              <Moon size={18} />
                            </button>
                          ) : (
                            <button onClick={() => handleCancelOvernight(item)} className="p-3 text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Batal Menginap">
                              <Sun size={18} />
                            </button>
                          )}
                          <button onClick={() => editItem(item)} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Edit Antrean">
                            <Edit3 size={18} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Hapus">
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

          {/* List Penerimaan Barang Sparepart */}
          {confirmedSpareparts.length > 0 && (
            <div className="bg-white rounded-[1.5rem] border border-zinc-200 overflow-hidden shadow-lg shadow-zinc-200/30 mt-8">
              <div className="px-8 py-6 border-b border-zinc-100 bg-green-50/30 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black italic tracking-tight uppercase text-green-900">List Penerimaan Barang</h3>
                </div>
                <span className="bg-green-600 text-white text-[9px] font-black px-3 py-1 rounded-full">{confirmedSpareparts.length} Diterima</span>
              </div>
              <div className="p-6 grid gap-4">
                {confirmedSpareparts.map(order => {
                  return (
                    <div key={order.id} className="border border-zinc-100 rounded-2xl p-4 bg-zinc-50/50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-lg">{order['Handling order number'] || order.orderNumber || '-'}</p>
                          <p className="text-xs text-zinc-500 font-medium">Pemesan: <span className="font-bold text-zinc-900">{order['founder'] || order.namaPemesan || '-'}</span></p>
                        </div>
                        <div className="text-right text-[10px] text-green-700 bg-green-100 px-3 py-1.5 rounded-lg font-bold">
                          Diketahui {order.confirmedBy}<br />
                          {(() => {
                            const t = order.confirmedTime || order.tanggalCSI || order['processing time'] || order.modified || order['modified date'] || order.arrivedTime;
                            if (!t) return '-';
                            if (typeof t === 'string' && t.includes('/')) return t; // Sudah formatted DD/MM/YYYY
                            try {
                              const d = new Date(t);
                              return !isNaN(d.getTime()) ? d.toLocaleString('id-ID') : t;
                            } catch (e) { return t; }
                          })()}
                        </div>
                      </div>
                      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden p-3">
                        <div className="text-xs font-medium whitespace-pre-line leading-loose text-zinc-800 font-mono">
                          {(() => {
                            if (!order.items) return '-';
                            try {
                              const parsed = JSON.parse(order.items);
                              if (Array.isArray(parsed)) {
                                return parsed.map((item, idx) => (
                                  <div key={idx} className={`py-1 ${item.isArrived === false ? 'text-red-500' : 'text-zinc-800'}`}>
                                    - {item.sparePartNumber} | {item.sparePartName} | Qty: {item.orderAmount} | {item.isArrived === false ? '(BELUM SAMPAI)' : '(SAMPAI)'}
                                  </div>
                                ));
                              }
                            } catch (e) {
                              return order.items;
                            }
                            return order.items;
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Dynamic Notification Column */}
        {hasNotifications && (
          <div className="lg:col-span-3 sticky top-24 flex flex-col gap-4 animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Notifikasi Urgent</h3>
            </div>
            {activeNotifications.map(order => (
              <div key={order.id} className="bg-zinc-900 border border-zinc-800 text-white p-6 rounded-[1.5rem] shadow-2xl flex flex-col gap-4 transform transition-all hover:scale-[1.02]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                    <Package size={16} /> Sparepart Tiba
                  </div>
                  <button onClick={() => handleDismissBubble(order.id)} className="text-zinc-500 hover:text-white transition-colors bg-zinc-800 p-1 rounded-lg">
                    <X size={14} />
                  </button>
                </div>
                <div className="text-sm font-medium leading-relaxed">
                  Pemesanan <span className="font-black text-blue-400">{order.orderNumber || '-'}</span>
                  <div className="mt-1 font-black text-zinc-100 flex flex-col gap-1">
                    {(() => {
                      try {
                        const items = JSON.parse(order.items);
                        if (Array.isArray(items)) {
                          // HANYA TAMPILKAN BARANG YANG SUDAH TIBA
                          const arrivedItems = items.filter(i => i.isArrived);
                          if (arrivedItems.length > 0) {
                            return arrivedItems.map((i, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5 bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-700">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                  <span className="text-[10px] font-mono text-blue-300 uppercase">{i.sparePartNumber}</span>
                                </div>
                                <span className="text-[11px] font-black leading-tight ml-3.5 text-zinc-100">{i.sparePartName}</span>
                                {i.orderingInstructions && (
                                  <span className="text-[9px] text-zinc-400 italic ml-3.5 mt-0.5 border-t border-zinc-700/50 pt-0.5">Note: {i.orderingInstructions}</span>
                                )}
                              </div>
                            ));
                          }
                        }
                      } catch (e) { }
                      return <span className="text-zinc-400 italic">No Arrived Item Data</span>;
                    })()}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <button onClick={() => handleConfirmSparepart(order)} className="w-full bg-green-500 hover:bg-green-400 text-zinc-900 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20 active:scale-95">
                    <Check size={16} strokeWidth={3} /> Konfirmasi
                  </button>
                  <button onClick={() => handleDismissBubble(order.id)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95">
                    Abaikan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E4E4E7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D4D4D8;
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;