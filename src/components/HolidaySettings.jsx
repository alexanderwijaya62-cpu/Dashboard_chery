import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, Info, Settings, ShieldCheck, Clock } from 'lucide-react';
import TimeInput from './TimeInput';
import Toastify from 'toastify-js';
import { API_KEY, GAS_BOOKING_URL } from '../utils/config';

export default function HolidaySettings({ user, breakSettings, setBreakSettings }) {
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [note, setNote] = useState('');

    const customFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "x-api-key": API_KEY,
                "Content-Type": "text/plain;charset=utf-8"
            }
        });
    };

    const fetchHolidays = async () => {
        setIsLoading(true);
        try {
            const resp = await customFetch(`${GAS_BOOKING_URL}?action=get_holidays&_=${Date.now()}`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                setHolidays(data);
            } else if (data.status === 'success' && Array.isArray(data.holidays)) {
                setHolidays(data.holidays);
            }
        } catch (e) {
            console.error("Gagal ambil data libur:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        if (!newDate) return;

        setIsLoading(true);
        try {
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'add_holiday',
                    date: newDate,
                    note: note || 'Libur Dealer'
                })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: "Berhasil menambahkan tanggal libur!", background: "green" }).showToast();
                setNewDate('');
                setNote('');
                fetchHolidays();
            } else {
                throw new Error("Gagal menyimpan");
            }
        } catch (e) {
            Toastify({ text: "Gagal menyimpan. Pastikan GAS Code sudah diupdate!", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteHoliday = async (date) => {
        if (!window.confirm(`Hapus libur pada tanggal ${date}?`)) return;

        setIsLoading(true);
        try {
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'delete_holiday',
                    date: date
                })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: "Tanggal libur dihapus!", background: "blue" }).showToast();
                fetchHolidays();
            }
        } catch (e) {
            Toastify({ text: "Gagal menghapus", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-zinc-200 pb-8">
                <div className="bg-zinc-900 p-4 rounded-3xl text-white shadow-lg shadow-zinc-200">
                    <Calendar size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-none mb-2">Setting Tanggal Libur Dealer</h1>
                    <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase">Input tanggal merah agar booking customer tertutup.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Form Add */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100 flex flex-col gap-6">
                    <h3 className="text-xl font-black text-zinc-800 flex items-center gap-3">
                        <Plus size={20} className="text-red-500" /> Tambah Tanggal Libur
                    </h3>

                    <form onSubmit={handleAddHoliday} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Pilih Tanggal</label>
                            <input
                                required
                                type="date"
                                className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold shadow-inner focus:bg-white outline-none focus:border-red-600 transition-all"
                                value={newDate}
                                onChange={e => setNewDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Keterangan (Opsional)</label>
                            <input
                                type="text"
                                placeholder="Contoh: Idul Fitri / Libur Nasional"
                                className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold shadow-inner focus:bg-white outline-none focus:border-red-600 transition-all"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-red-600 hover:bg-zinc-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            {isLoading ? 'Processing...' : 'Simpan Tanggal Libur'}
                        </button>
                    </form>

                    <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                        <div className="flex items-start gap-3 text-zinc-500">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-bold leading-relaxed">
                                Tanggal yang didaftarkan di sini akan menutup slot booking secara otomatis pada halaman publik.
                            </p>
                        </div>
                    </div>
                </div>

                {/* List Holidays */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100 flex flex-col gap-6">
                    <h3 className="text-xl font-black text-zinc-800 flex items-center gap-3">
                        <Settings size={20} className="text-zinc-400" /> Daftar Hari Libur
                    </h3>

                    <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                        {holidays.length === 0 ? (
                            <div className="py-20 text-center text-zinc-300 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-zinc-50 rounded-3xl">
                                Belum ada tanggal libur
                            </div>
                        ) : (
                            holidays.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:border-red-100 hover:bg-red-50/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-zinc-100 flex flex-col items-center justify-center leading-none">
                                            <span className="text-[10px] font-black text-red-500 uppercase">{new Date(item.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                            <span className="text-xl font-black text-zinc-900">{new Date(item.date).getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-zinc-900">{item.note}</p>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteHoliday(item.date)}
                                        className="p-3 text-zinc-300 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-green-500" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{holidays.length} Tanggal Terdaftar</span>
                    </div>
                </div>
            </div>

            {/* JAM ISTIRAHAT SECTION */}
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border-2 border-zinc-200 shadow-3xl animate-in mt-12">
                <div className="flex items-center gap-6 mb-10">
                    <div className="bg-orange-500 p-4 rounded-3xl text-white shadow-lg shadow-orange-100">
                        <Clock size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-zinc-900 uppercase tracking-tighter">Pengaturan Jam Istirahat</h2>
                        <p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] uppercase mt-1">Estimasi pengerjaan akan otomatis terjeda pada jam ini.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4 p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100">
                        <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest block mb-4">Mulai Istirahat</label>
                        <div className="grid grid-cols-2 gap-3">
                            <TimeInput label="Jam" value={breakSettings.startHour} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, startHour: parseInt(val) || 0 })} />
                            <TimeInput label="Mnt" value={breakSettings.startMinute} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, startMinute: parseInt(val) || 0 })} />
                        </div>
                    </div>

                    <div className="space-y-4 p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100 text-zinc-500">
                        <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest block mb-4">Selesai (Senin-Sabtu)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <TimeInput label="Jam" value={breakSettings.endHourNormal} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourNormal: parseInt(val) || 0 })} />
                            <TimeInput label="Mnt" value={breakSettings.endMinuteNormal} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteNormal: parseInt(val) || 0 })} />
                        </div>
                    </div>

                    <div className="space-y-4 p-8 bg-orange-50/50 rounded-[2rem] border border-orange-100">
                        <label className="text-[10px] uppercase font-black text-orange-400 tracking-widest block mb-4">Selesai (Khusus Jumat)</label>
                        <div className="grid grid-cols-2 gap-3 text-orange-600">
                            <TimeInput label="Jam" value={breakSettings.endHourFriday} max={23} onChange={(val) => setBreakSettings({ ...breakSettings, endHourFriday: parseInt(val) || 0 })} />
                            <TimeInput label="Mnt" value={breakSettings.endMinuteFriday} max={59} onChange={(val) => setBreakSettings({ ...breakSettings, endMinuteFriday: parseInt(val) || 0 })} />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex items-start gap-4 p-6 bg-zinc-900 text-white rounded-3xl">
                    <Info size={24} className="text-orange-500 shrink-0 mt-1" />
                    <div>
                        <p className="font-black text-xs uppercase tracking-widest mb-1 italic">Catatan Sistem:</p>
                        <p className="text-[11px] font-bold text-zinc-400 leading-relaxed uppercase">
                            Sistem akan secara otomatis "Menjeda" durasi pengerjaan mobil pengerjaan yang sedang berjalan (Status Working) ketika mencapai jam mulai, dan akan "Melanjutkan" kembali timer setelah jam istirahat berakhir.
                        </p>
                    </div>
                </div>
            </div>

            {/* GAS UPDATE BLOCK */}

        </div>
    );
}

