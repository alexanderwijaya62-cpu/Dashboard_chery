import React, { useState, useEffect } from 'react';
import { User, LogOut, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check, Moon, X, Clock, Activity, UserCog } from 'lucide-react';
import TimeInput from './TimeInput';
import { supabase } from '../utils/supabaseClient';

const AdminPanel = ({ user, handleLogout, queue, rawHistory = [], deleteItem, clearQueue, editItem, handleSave, formData, setFormData, isEditing, setIsEditing, errorMessage, formatTime, handleComplete, handleSetOvernight, handleCancelOvernight, breakSettings, setBreakSettings }) => {
  const totalDetik = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
  const now = new Date();
  const previewSelesai = new Date(now.getTime() + (totalDetik * 1000));
  
  const isToday = (time) => {
    if (!time) return false;
    try {
      if (typeof time === 'string' && time.includes('/')) {
        const parts = time.split(/[\/\s,:]+/);
        if (parts.length >= 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[2]);
            return new Date(y, m, d).toDateString() === new Date().toDateString();
        }
      }
      const dObj = new Date(time);
      if (!isNaN(dObj)) return dObj.toDateString() === new Date().toDateString();
      const ts = parseInt(time);
      if (!isNaN(ts)) return new Date(ts).toDateString() === new Date().toDateString();
      return false;
    } catch (e) { return false; }
  };

  const [todayBookings, setTodayBookings] = useState([]);

  const normalizeBK = (bk) => (bk || '').replace(/\s+/g, '').toUpperCase();

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('booking')
        .select('*');
      
      if (error) throw error;
      
      if (Array.isArray(data)) {
        const activePlates = new Set(queue.map(q => normalizeBK(q.bk)));
        const historyPlatesToday = new Set(
          rawHistory
            .filter(h => isToday(h.id) || isToday(h.waktuSelesai))
            .map(h => normalizeBK(h.bk))
        );

        const processed = data.map(b => {
          const plat = normalizeBK(b.noPlat);
          const isArrived = activePlates.has(plat) || historyPlatesToday.has(plat);
          return { ...b, isArrived };
        }).filter(b => isToday(b.tanggal) && b.status !== 'completed' && b.status !== 'declined');

        setTodayBookings(processed);
      }
    } catch (e) {
      console.error('Gagal fetch booking dari Supabase:', e);
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [queue, rawHistory]);

  const handleConfirmBooking = (booking) => {
    setFormData({
      ...formData,
      bk: (booking.noPlat || '').toUpperCase(),
      tipe: (booking.tipeMobil || '').toUpperCase(),
      category: 'Booking',
      keluhan: `BOOKING: ${booking.keperluanService || ''} (${booking.namaCustomer || ''})`,
      jam: 0, menit: 30, detik: 0, mechanicName: ''
    });
  };

  const handleCancelEdit = () => {
    setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '' });
    setIsEditing(false);
  };

  return (
    <div className="h-screen bg-[#F0F2F5] flex flex-col font-sans overflow-hidden">
      
      {/* COMPACT TOP HEADER */}
      <header className="bg-white border-b border-zinc-200 px-6 py-2.5 flex justify-between items-center z-50 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
                <Zap className="text-white fill-white" size={16} />
            </div>
            <div>
                <h1 className="text-sm font-black tracking-tighter uppercase leading-none text-zinc-900">Admin <span className="text-red-600">Operations</span></h1>
                <p className="text-[9px] font-black text-zinc-400 mt-1 uppercase tracking-widest leading-none">
                    Service Control Center • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right hidden xl:block">
                <p className="text-[10px] font-black uppercase text-zinc-900 leading-none">{user?.name || 'Authorized Admin'}</p>
                <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status: Online</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-widest shadow-sm">
                <LogOut size={14} /> LOGOUT
            </button>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="flex-1 p-3 grid grid-cols-12 lg:grid-rows-12 gap-3 overflow-y-auto lg:overflow-hidden">
        
        {/* 1. BOOKING LIST */}
        <div className="col-span-12 lg:col-span-4 lg:row-span-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden relative min-h-[300px] lg:min-h-0">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div> Kedatangan Booking
                </h3>
                <span className="bg-zinc-100 text-zinc-600 text-[9px] font-black px-3 py-1 rounded-full">{todayBookings.length} Units</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar z-10">
                {todayBookings.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60">
                         <Bookmark size={40} className="mb-3" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No Pending Bookings</p>
                    </div>
                ) : (
                    todayBookings.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:bg-white hover:shadow-md transition-all group/item">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-red-600 font-mono tracking-tighter bg-red-50 px-1.5 py-0.5 rounded">{b.jam} WIB</span>
                                    <h4 className="font-black text-sm text-zinc-900 uppercase tracking-tight">{b.noPlat || 'REGISTER'}</h4>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[140px] pl-[3.5rem]">— {b.namaCustomer}</p>
                                </div>
                                {b.isArrived && (
                                  <div className="pl-[3.5rem] mt-1">
                                    <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 w-fit">
                                      <CheckCircle2 size={8} /> Sudah Datang
                                    </span>
                                  </div>
                                )}
                            </div>
                            <button onClick={() => !b.isArrived && handleConfirmBooking(b)} className={`w-9 h-9 rounded-lg transition-all flex items-center justify-center shadow-md active:scale-95 ${b.isArrived ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-red-600 text-white'}`}>
                                <Plus size={16} strokeWidth={4} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* 2. FORM INPUT */}
        <div className={`col-span-12 lg:col-span-8 lg:row-span-6 bg-white rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden relative min-h-[400px] lg:min-h-0 ${isEditing ? 'border-red-600 ring-2 ring-red-600/20 shadow-lg' : 'border-zinc-200 shadow-sm'}`}>
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white shadow-md ${isEditing ? 'bg-red-600' : 'bg-zinc-900'}`}>
                        {isEditing ? <Activity size={16} /> : <Plus size={16} />}
                    </div>
                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                            {isEditing ? 'Editing Activity Mode' : 'Pendaftaran Unit Kedatangan'}
                        </h2>
                        <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${isEditing ? 'text-red-500' : 'text-zinc-500'}`}>
                            {isEditing ? 'Silahkan koreksi data kendaraan' : 'Input data unit untuk memulai timer operasional'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {errorMessage && <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg uppercase border border-rose-100">{errorMessage}</span>}
                    {isEditing && (
                        <button onClick={handleCancelEdit} className="p-2 bg-zinc-100 hover:bg-rose-500 hover:text-white text-zinc-500 rounded-lg transition-all" title="Cancel Edition">
                            <X size={14} strokeWidth={4} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar lg:flex-row lg:gap-6">
                <div className="flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center gap-1.5 text-zinc-500">
                                <Activity size={10} className="text-red-600" /> Nomor Polisi
                            </label>
                            <input type="text" value={formData.bk} onChange={(e) => setFormData({ ...formData, bk: e.target.value.toUpperCase() })} 
                                placeholder="BK 1XXX MA" className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-base font-black outline-none transition-all uppercase focus:bg-white focus:border-red-600 text-zinc-900 shadow-inner" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center gap-1.5 text-zinc-500">
                                <Activity size={10} className="text-red-600" /> Tipe Unit
                            </label>
                            <input type="text" value={formData.tipe} onChange={(e) => setFormData({ ...formData, tipe: e.target.value })} 
                                placeholder="OMODA / TIGGO" className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-base font-black outline-none transition-all uppercase focus:bg-white focus:border-red-600 text-zinc-900 shadow-inner" />
                        </div>
                    </div>
                                     {/* 3 CONTAINERS CATEGORY - HORIZONTAL */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-2 mb-4 bg-zinc-50 p-3 sm:p-4 rounded-[2rem] border border-zinc-100">
                        {/* Container 1: Category (Single Select) */}
                        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center gap-3">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">TYPE</label>
                            <div className="flex flex-col gap-2 w-full">
                                {['Booking', 'Reguler'].map(cat => (
                                    <button key={cat} onClick={() => setFormData({ ...formData, category: cat })} 
                                        className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 border-2 ${formData.category === cat ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Container 2: Free Service (Single Select) */}
                        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center gap-3">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">MAINTENANCE</label>
                            <div className="flex flex-col gap-2 w-full">
                                {['FS1', 'FS2', 'FS3'].map(val => {
                                    const parts = (formData.keluhan || '').split(', ').map(p => p.trim()).filter(p => p);
                                    const isActive = parts.includes(val);
                                    return (
                                        <button key={val} onClick={() => {
                                            const otherParts = parts.filter(p => !['FS1', 'FS2', 'FS3'].includes(p));
                                            const newParts = isActive ? otherParts : [val, ...otherParts];
                                            setFormData({ ...formData, keluhan: newParts.join(', ') });
                                        }} 
                                            className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                            {val}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Container 3: Issues (Multi Select) */}
                        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center gap-3">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">ISSUES</label>
                            <div className="flex flex-col gap-2 w-full">
                                {['Keluhan', 'Update Software'].map(val => {
                                    const parts = (formData.keluhan || '').split(', ').map(p => p.trim()).filter(p => p);
                                    const isActive = parts.includes(val);
                                    return (
                                        <button key={val} onClick={() => {
                                            const newParts = isActive ? parts.filter(p => p !== val) : [...parts, val];
                                            setFormData({ ...formData, keluhan: newParts.join(', ') });
                                        }} 
                                            className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                            {val}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-64 xl:w-72 flex flex-col justify-between gap-4 shrink-0">
                    <div className="bg-zinc-900 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                        <label className="text-[9px] font-black uppercase text-red-500 tracking-[0.2em] block text-center">Set Durasi</label>
                        <div className="flex items-center justify-center gap-1.5 py-1">
                            <TimeInput label="H" value={formData.jam} max={23} onChange={(val) => setFormData({ ...formData, jam: val })} dark />
                            <span className="text-zinc-600 font-black text-lg">:</span>
                            <TimeInput label="M" value={formData.menit} max={59} onChange={(val) => setFormData({ ...formData, menit: val })} dark />
                            <span className="text-zinc-600 font-black text-lg">:</span>
                            <TimeInput label="S" value={formData.detik} max={59} onChange={(val) => setFormData({ ...formData, detik: val })} dark />
                        </div>
                        <div className="pt-2 border-t border-zinc-800">
                             <p className="text-[8px] font-black text-zinc-500 text-center uppercase tracking-widest">Selesai Pada</p>
                             <p className="text-lg font-black text-white text-center tracking-tighter mt-0.5">{totalDetik >= 1800 ? previewSelesai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                        </div>
                    </div>
                    
                    <button onClick={handleSave} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${isEditing ? 'bg-red-600 text-white hover:bg-zinc-900' : 'bg-zinc-900 text-white hover:bg-black'}`}>
                        {isEditing ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                        {isEditing ? 'Simpan Edit' : 'Aktifkan'}
                    </button>
                </div>
            </div>
        </div>

        {/* 3. MONITORING LIST */}
        <div className="col-span-12 lg:row-span-6 flex flex-col bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm min-h-[500px] lg:min-h-0">
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-md">
                        <Activity size={14} />
                    </div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-900 leading-none">Dashboard Monitoring</h3>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1"></div>
                    </div>
                    <div className="h-4 w-px bg-zinc-200 ml-2"></div>
                    <div className="hidden md:flex items-center gap-4 ml-1">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Total Active</span>
                            <span className="text-xs font-black text-zinc-900 leading-none">{queue.length} <span className="text-[8px] text-zinc-400">UNIT</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">In Process</span>
                            <span className="text-xs font-black text-zinc-900 leading-none">{queue.filter(q => q.status === 'working').length} <span className="text-[8px] text-zinc-400">UNIT</span></span>
                        </div>
                    </div>
                </div>
                <button onClick={clearQueue} className="text-[8px] font-black text-zinc-400 hover:text-red-600 uppercase tracking-widest px-4 py-2 bg-zinc-100 hover:bg-red-50 rounded-lg transition-all border border-transparent">Reset Antrian</button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm">
                        <tr className="border-b border-zinc-100">
                            <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 w-[25%] tracking-widest">Identitas Unit</th>
                            <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 text-center w-[15%] tracking-widest">Status Flow</th>
                            <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 text-center w-[15%] tracking-widest">Timer Realtime</th>
                            <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 w-[25%] tracking-widest">Item Pekerjaan</th>
                            <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 text-right w-[20%] tracking-widest">Controls</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {queue.length === 0 ? (
                            <tr><td colSpan="5" className="py-20 text-center text-zinc-300 font-bold uppercase text-[10px] tracking-widest">Belum ada unit diproses</td></tr>
                        ) : (
                            queue.map((item, index) => {
                                const statusColors = {
                                    'working': 'bg-blue-600 text-white shadow-md',
                                    'waiting': 'bg-zinc-100 text-zinc-500 border border-zinc-200',
                                    'completed': 'bg-emerald-500 text-white shadow-md',
                                    'menginap': 'bg-zinc-900 text-white shadow-md'
                                };
                                const isOvernight = item.status === 'menginap';
                                return (
                                    <tr key={index} className="hover:bg-zinc-50/50 transition-all border-l-4 border-transparent hover:border-red-600 duration-200 group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md">
                                                    {item.category[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xl font-black text-zinc-900 tabular-nums uppercase tracking-tight leading-none">{item.bk}</span>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{item.tipe}</span>
                                                        <div className="w-1 h-1 bg-red-600 rounded-full"></div>
                                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">{item.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex justify-center">
                                                <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest min-w-[110px] flex items-center justify-center gap-2 transition-transform ${statusColors[item.status] || 'bg-zinc-100'}`}>
                                                    {isOvernight ? <Moon size={12} fill="white" /> : (item.status === 'working' ? <Clock size={12} className="animate-spin-slow" /> : null)}
                                                    {item.status}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className={`font-mono text-2xl font-black tabular-nums tracking-tighter ${item.estimasi < 0 ? 'text-red-500 animate-pulse' : 'text-zinc-900'}`}>
                                                {formatTime(item.estimasi)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-zinc-900">
                                                    <User size={12} className="text-red-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">{item.mechanicName || 'BELUM ASSIGN'}</span>
                                                </div>
                                                <p className="text-[9px] font-bold text-zinc-500 uppercase line-clamp-1 max-w-[200px] leading-relaxed">
                                                    {item.keluhan || '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-2.5 opacity-100 lg:opacity-40 group-hover:opacity-100 transition-all duration-300">
                                                {(item.status === 'working' || item.status === 'waiting' || item.status === 'menginap') && (
                                                    <button onClick={() => handleComplete(item)} className="p-3 bg-emerald-500 hover:bg-zinc-900 text-white rounded-xl shadow-sm transition-all active:scale-95" title="Selesai pengerjaan">
                                                        <Check size={18} strokeWidth={4} />
                                                    </button>
                                                )}
                                                {item.status !== 'completed' && (
                                                    !isOvernight ? (
                                                        <button onClick={() => handleSetOvernight(item)} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-sm transition-all active:scale-95" title="Set Menginap">
                                                            <Moon size={18} fill="white" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleCancelOvernight(item)} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-sm transition-all active:scale-95" title="Batal Menginap">
                                                            <Zap size={18} fill="white" />
                                                        </button>
                                                    )
                                                )}
                                                <button onClick={() => editItem(item)} className="p-3 bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm" title="Edit Data Unit">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button onClick={() => deleteItem(item.id)} className="p-3 bg-white text-rose-400 border border-rose-100 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="Remove Task">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {queue.some(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap') && (
                <div className="shrink-0 bg-red-600 text-white px-6 py-3 flex items-center justify-center gap-3 animate-slide-up relative z-40">
                    <AlertCircle size={16} className="animate-bounce" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sistem Alert: {queue.filter(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap').length} unit melewati batas waktu.</span>
                </div>
            )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
        .animate-spin-slow { animation: spin 6s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminPanel;