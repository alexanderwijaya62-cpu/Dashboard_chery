import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, Info, Settings, ShieldCheck, Clock, Save } from 'lucide-react';
import TimeInput from './TimeInput';
import Toastify from 'toastify-js';
import { db } from '../utils/dbClient';
import { normalizeDateStr } from '../utils/holidayHelpers';

export default function HolidaySettings({ user, breakSettings, setBreakSettings, holidays: propsHolidays, setHolidays: propsSetHolidays }) {
    const [localHolidays, setLocalHolidays] = useState([]);
    const holidays = propsHolidays || localHolidays;
    const setHolidays = propsSetHolidays || setLocalHolidays;

    const [isLoading, setIsLoading] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [note, setNote] = useState('');

    const fetchHolidays = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await db.select('libur', { order: { column: 'date', ascending: true } });
            if (error) throw error;
            setHolidays((data || []).map(h => ({ ...h, date: normalizeDateStr(h.date) })));
        } catch (e) {
            console.error('Gagal ambil data libur:', e);
            Toastify({ text: `❌ Gagal memuat data libur: ${e.message}`, style: { background: 'red' } }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    const handleAddHoliday = async (e) => {
        if (e) e.preventDefault();
        if (!newDate) return;
        const normalizedDate = normalizeDateStr(newDate);
        if (!normalizedDate) return;
        setIsLoading(true);
        try {
            const { data: allHolidays } = await db.select('libur', { select: 'id, date' });
            const existing = (allHolidays || []).find(h => normalizeDateStr(h.date) === normalizedDate);

            if (existing) {
                Toastify({
                    text: `⚠️ Duplikat: Tanggal ${normalizedDate} sudah terdaftar sebagai hari libur!`,
                    style: { background: '#f97316' }, duration: 4000
                }).showToast();
                setIsLoading(false);
                return;
            }

            const { error } = await db.insert('libur', { date: normalizedDate, note: note || 'Libur Dealer' });

            if (error) throw error;

            Toastify({ text: '✅ Berhasil menambahkan tanggal libur!', style: { background: 'green' } }).showToast();
            setNewDate('');
            setNote('');
            fetchHolidays();
        } catch (e) {
            console.error(e);
            Toastify({ text: `❌ Gagal menyimpan: ${e.message}`, style: { background: 'red' } }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteHoliday = async (id) => {
        if (!window.confirm('Hapus hari libur ini?')) return;
        setIsLoading(true);
        try {
            const { error } = await db.delete('libur', { eq: { id: id } });
            if (error) throw error;
            Toastify({ text: '🗑️ Tanggal libur dihapus!', style: { background: '#3b82f6' } }).showToast();
            fetchHolidays();
        } catch (e) {
            Toastify({ text: `❌ Gagal menghapus: ${e.message}`, style: { background: 'red' } }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const safeDate = (d) => {
        if (!d) return new Date();
        const str = String(d);
        if (str.includes('/')) {
            const [dd, mm, yyyy] = str.split('/');
            return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
        }
        return new Date(str);
    };

    return (
        <div className="flex flex-col h-full bg-white text-zinc-900 animate-in fade-in duration-500 overflow-hidden">
            {/* Header + Add Form (Fixed Top) */}
            <div className="shrink-0 p-6 border-b border-zinc-100 bg-zinc-50/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-zinc-900 p-3 rounded-2xl text-white shadow-lg">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight leading-none text-zinc-900">Setting Libur Dealer</h1>
                            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-1">Kelola hari libur dan jam istirahat</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddHoliday} className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">Tanggal</label>
                            <input
                                required
                                type="date"
                                className="bg-zinc-50 border border-zinc-100 p-2.5 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                                value={newDate}
                                onChange={e => setNewDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">Keterangan</label>
                            <input
                                type="text"
                                placeholder="Contoh: Idul Fitri"
                                className="w-full bg-zinc-50 border border-zinc-100 p-2.5 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-zinc-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Tambah</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* Main Content Area (Split View) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left: Holiday List (Scrollable) */}
                <div className="flex-1 overflow-hidden flex flex-col border-r border-zinc-50">
                    <div className="p-4 border-b border-zinc-50 flex justify-between items-center bg-zinc-50/20">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                            <Settings size={14} className="text-zinc-400" /> Daftar Hari Libur
                        </h3>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-zinc-100">{holidays.length} UNIT</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-white">
                        {holidays.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4 opacity-50">
                                <Calendar size={48} className="stroke-[1px]" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Belum ada tanggal libur</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                {holidays.sort((a, b) => safeDate(a.date) - safeDate(b.date)).map((item, idx) => {
                                    const dObj = safeDate(item.date);
                                    return (
                                        <div key={idx} className="flex justify-between items-center p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100 group hover:border-zinc-900 hover:bg-white transition-all shadow-sm hover:shadow-md">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-zinc-100 flex flex-col items-center justify-center leading-none shrink-0 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                                    <span className="text-[8px] font-black text-red-500 uppercase">{dObj.toLocaleDateString('id-ID', { month: 'short' })}</span>
                                                    <span className="text-lg font-black">{dObj.getDate()}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-zinc-900 truncate">{item.note}</p>
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{dObj.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteHoliday(item.id)}
                                                className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Break Settings (Fixed Sidebar on Desktop) */}
                <div className="w-full md:w-[320px] lg:w-[400px] shrink-0 bg-zinc-50/30 border-l border-zinc-100 p-6 overflow-y-auto md:overflow-hidden flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-orange-500 p-2.5 rounded-xl text-white shadow-lg shadow-orange-100">
                            <Clock size={20} />
                        </div>
                        <h2 className="text-sm font-black text-zinc-900 uppercase tracking-tight">Jam Istirahat</h2>
                    </div>

                    {!breakSettings ? (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">
                            Loading Settings...
                        </div>
                    ) : (
                        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar no-scrollbar md:block">
                            <div className="space-y-4">
                                <div className="p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                                    <label className="text-[9px] uppercase font-black text-zinc-400 tracking-widest block mb-3">Mulai Istirahat</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <TimeInput label="Jam" value={breakSettings.startHour} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, startHour: parseInt(val) || 0 })} />
                                        <TimeInput label="Mnt" value={breakSettings.startMinute} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, startMinute: parseInt(val) || 0 })} />
                                    </div>
                                </div>

                                <div className="p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                                    <label className="text-[9px] uppercase font-black text-zinc-400 tracking-widest block mb-3">Selesai (Sen-Sab)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <TimeInput label="Jam" value={breakSettings.endHourNormal} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourNormal: parseInt(val) || 0 })} />
                                        <TimeInput label="Mnt" value={breakSettings.endMinuteNormal} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteNormal: parseInt(val) || 0 })} />
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 shadow-sm">
                                    <label className="text-[9px] uppercase font-black text-orange-600 tracking-widest block mb-3">Selesai (Jumat)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <TimeInput label="Jam" value={breakSettings.endHourFriday} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourFriday: parseInt(val) || 0 })} />
                                        <TimeInput label="Mnt" value={breakSettings.endMinuteFriday} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteFriday: parseInt(val) || 0 })} />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white rounded-2xl border border-zinc-100 border-dashed">
                                <div className="flex items-start gap-3">
                                    <Info size={16} className="text-zinc-300 shrink-0 mt-0.5" />
                                    <p className="text-[9px] font-bold text-zinc-400 leading-relaxed uppercase">
                                        Pengerjaan yang sedang berjalan akan <span className="text-zinc-900">Menjeda</span> otomatis pada jam ini.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #F1F1F1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #E4E4E7;
                }
            `}</style>
        </div>
    );
}
