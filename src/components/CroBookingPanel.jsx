import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, CheckCircle, XCircle, Plus, Trash2, Clock, Car, Phone, Send, X, AlertCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { supabase } from '../utils/supabaseClient';

const TIPE_MOBIL = [
    "Tiggo 5x", "Tiggo Cross", "Tiggo Cross Csh", "Tiggo 7", "Tiggo 8 Pro",
    "Tiggo 8", "Tiggo 8 Csh", "Tiggo 9 Csh", "J6", "Omoda 5", "Omoda EV",
    "Omoda 5 GT", "Chery C5", "Chery C5 Csh", "J5", "J7", "J8"
];
const JAM_PILIHAN = ["08.30", "09.00", "09.30", "10.00"];
const KEPERLUAN = ["Free Service 1", "Free Service 2", "Free Service 3", "Keluhan"];

export default function CroBookingPanel({ user }) {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('waiting');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jam: '',
        tipeMobil: '',
        noPlat: '',
        namaCustomer: '',
        keperluanService: '',
        keluhanDetail: '',
        vin: '',
        noTelp: ''
    });


    const fetchBookings = async () => {
        try {
            const { data, error } = await supabase
                .from('booking')
                .select('*')
                .order('tanggal', { ascending: false });
            
            if (error) throw error;
            setBookings(data || []);
        } catch (e) {
            console.error("Fetch Error:", e);
            Toastify({ text: `Gagal fetch data: ${e.message}`, background: "red" }).showToast();
        }
    };

    const fetchHolidays = async () => {
        try {
            const { data, error } = await supabase.from('libur').select('*');
            if (error) throw error;
            setHolidays(data || []);
        } catch (e) {
            console.error("Fetch Libur Error:", e);
        }
    };

    useEffect(() => {
        fetchBookings();
        fetchHolidays();
        const interval = setInterval(fetchBookings, 60000);

        // Listener untuk membuka modal dari luar (navbar)
        const openAddModal = () => {
            setFormData({
                tanggal: new Date().toISOString().split('T')[0],
                jam: '', tipeMobil: '', noPlat: '',
                namaCustomer: '', keperluanService: '', keluhanDetail: '',
                vin: '', noTelp: ''
            });
            setIsModalOpen(true);
        };
        window.addEventListener('open-add-booking', openAddModal);

        return () => {
            clearInterval(interval);
            window.removeEventListener('open-add-booking', openAddModal);
        };
    }, []);

    const handleStatusUpdate = async (id, newStatus) => {
        if (!window.confirm(`Yakin ingin mengubah status menjadi: ${newStatus.toUpperCase()}?`)) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('booking')
                .update({ status: newStatus })
                .eq('id', id);
            
            if (error) throw error;
            
            Toastify({ text: `Status berhasil diubah menjadi ${newStatus}!`, background: "green" }).showToast();
            fetchBookings();
        } catch (e) {
            console.error("Update Status Error:", e);
            Toastify({ text: "Gagal update status", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Hapus data booking ini permanen?")) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('booking')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            Toastify({ text: "Data dihapus!", background: "blue" }).showToast();
            fetchBookings();
        } catch (e) {
            console.error("Delete Error:", e);
            Toastify({ text: "Gagal hapus", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        // 1. Validasi slot sebelum input
        const selectedJamNum = parseFloat(formData.jam.replace('.', '.')) || 0;
        const isConflict = bookings.find(b => 
            isSameDate(b.tanggal, formData.tanggal) && 
            parseFloat(b.jam) === selectedJamNum && 
            (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
        );

        if (isConflict) {
            Toastify({ text: `❌ GAGAL: Slot jam ${formData.jam} pada tanggal ini sudah terisi orang lain (${isConflict.namaCustomer})!`, background: "orange", duration: 5000 }).showToast();
            return;
        }

        setIsLoading(true);
        try {
            const newBooking = {
                id: Date.now(),
                ...formData,
                keperluanService: formData.keperluanService === 'Keluhan' ? `Keluhan: ${formData.keluhanDetail}` : formData.keperluanService,
                jam: selectedJamNum,
                bookingVia: user?.name || 'CRO',
                status: 'accepted'
            };

            const { error } = await supabase
                .from('booking')
                .insert([newBooking]);
            
            if (error) throw error;

            Toastify({ text: "✅ Booking BERHASIL ditambahkan!", background: "green" }).showToast();
            setIsModalOpen(false);
            fetchBookings();
        } catch (e) {
            console.error("Insert Error:", e);
            Toastify({ text: `❌ ERROR SUBMIT: ${e.message || 'Gagal menyimpan data ke database.'}`, background: "red", duration: 5000 }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return "-";
        // Handle format DD/MM/YYYY or YYYY-MM-DD
        if (dateStr.includes("/")) return dateStr; 
        if (dateStr.includes("-")) {
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    };

    const parseDateForSort = (str) => {
        if (!str || str === "-") return new Date(0);
        if (str.includes('/')) {
            const [d, m, y] = str.split('/');
            return new Date(y, parseInt(m) - 1, d);
        }
        if (str.includes('-')) {
            const [y, m, d] = str.split('-');
            if (y?.length === 4) return new Date(y, m - 1, d);
            return new Date(d, m - 1, y);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date(0) : d;
    };

    const isSameDate = (d1, d2) => {
        const normalize = (d) => {
            if (!d) return "";
            if (d instanceof Date) return d.toISOString().split('T')[0];
            const str = String(d);
            if (str.includes("/")) {
                const [dd, mm, yyyy] = str.split("/");
                return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
            }
            return str.split(/[T ]/)[0];
        };
        return normalize(d1) === normalize(d2);
    };

    // CALENDAR LOGIC HELPER
    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const calendarGrid = useMemo(() => {
        const month = currentCalMonth.getMonth();
        const year = currentCalMonth.getFullYear();
        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const startDay = startDayOfMonth(month, year);

        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, currentMonth: false });
        }
        for (let i = 1; i <= daysInMonth(month, year); i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({ day: i, currentMonth: true, date: dateStr });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, currentMonth: false });
        }
        return days;
    }, [currentCalMonth]);

    const changeCalMonth = (offset) => {
        const next = new Date(currentCalMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentCalMonth(next);
    };

    const getDateStatus = (date) => {
        if (!date) return 'none';
        const isHol = holidays.find(h => isSameDate(h.date, date));
        const isSun = new Date(date).getDay() === 0;
        if (isHol || isSun) return 'closed';
        const bCount = bookings.filter(b => isSameDate(b.tanggal, date) && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')).length;
        if (bCount >= JAM_PILIHAN.length) return 'full';
        if (bCount > 0) return 'partial';
        return 'empty';
    };

    const sortedAndFilteredBookings = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        let filtered = bookings.filter(b => {
            const term = searchTerm.toLowerCase();
            const matchSearch =
                String(b.namaCustomer).toLowerCase().includes(term) ||
                String(b.noPlat).toLowerCase().includes(term) ||
                String(b.tipeMobil).toLowerCase().includes(term) ||
                String(b.tanggal).toLowerCase().includes(term) ||
                String(b.jam).toLowerCase().includes(term);

            if (activeTab === 'waiting') return b.status === 'waiting confirm' && matchSearch;
            if (activeTab === 'processed') return (b.status === 'accepted' || b.status === 'declined') && matchSearch;
            return matchSearch;
        });

        // Sorting: Tanggal paling dekat dengan hari ini berada di atas
        return filtered.sort((a, b) => {
            const dateA = parseDateForSort(a.tanggal);
            const dateB = parseDateForSort(b.tanggal);
            // Jarak absolut dari hari ini
            const targetToday = new Date(todayStr);
            const diffA = Math.abs(dateA - targetToday);
            const diffB = Math.abs(dateB - targetToday);
            return diffA - diffB;
        });
    }, [bookings, searchTerm, activeTab]);

    const pendingCount = bookings.filter(b => b.status === 'waiting confirm').length;

    return (
        <div className="flex-1 w-full bg-white rounded-t-[2.5rem] p-4 lg:p-8 shadow-2xl relative overflow-hidden flex flex-col h-full animate-fade-in border-t border-zinc-100">
            {/* HEADER SECTION */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 xl:mb-8 gap-4 xl:gap-6 shrink-0 relative z-10">
                <div className="flex items-center gap-3 xl:gap-4">
                    <div className="bg-red-600 p-3 xl:p-4 rounded-2xl xl:rounded-3xl shadow-lg shadow-red-200 text-white shrink-0">
                        <Calendar size={28} xl:size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl xl:text-3xl font-black text-zinc-900 tracking-tight leading-none mb-1.5 xl:mb-2">Booking Management</h1>
                        <div className="flex items-center gap-2">
                            <span className="flex h-1.5 xl:h-2 w-1.5 xl:w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-[8px] xl:text-[10px] uppercase font-black tracking-widest text-zinc-400">Database Real-time</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:gap-3 w-full xl:w-auto">
                    <div className="flex bg-zinc-100 p-1 rounded-xl xl:rounded-2xl border border-zinc-200 shadow-inner overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveTab('waiting')} className={`px-4 xl:px-6 py-2 xl:py-2.5 text-[8px] xl:text-[10px] font-black uppercase tracking-widest rounded-lg xl:rounded-xl transition-all flex items-center gap-1.5 xl:gap-2 whitespace-nowrap ${activeTab === 'waiting' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            Pending {pendingCount > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-md text-[8px]">{pendingCount}</span>}
                        </button>
                        <button onClick={() => setActiveTab('processed')} className={`px-4 xl:px-6 py-2 xl:py-2.5 text-[8px] xl:text-[10px] font-black uppercase tracking-widest rounded-lg xl:rounded-xl transition-all whitespace-nowrap ${activeTab === 'processed' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            Processed
                        </button>
                        <button onClick={() => setActiveTab('all')} className={`px-4 xl:px-6 py-2 xl:py-2.5 text-[8px] xl:text-[10px] font-black uppercase tracking-widest rounded-lg xl:rounded-xl transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            All
                        </button>
                    </div>

                    <button onClick={() => setIsModalOpen(true)} className="bg-zinc-900 hover:bg-red-600 text-white px-6 xl:px-8 py-2.5 xl:py-3.5 rounded-xl xl:rounded-[1.2rem] font-black text-[9px] xl:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-zinc-200 group flex-1 xl:flex-none">
                        <Plus size={14} xl:size={16} className="group-hover:rotate-90 transition-transform" /> New Booking
                    </button>
                </div>
            </div>

            {/* SEARCH SECTION */}
            <div className="mb-6 shrink-0">
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-red-600 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, plate number, or car type..."
                        className="w-full bg-zinc-50 border border-zinc-100 p-5 pl-14 rounded-[1.5rem] text-sm font-bold text-zinc-900 focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all shadow-sm group-hover:shadow-md"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* TABLE / CARD SECTION */}
            <div className="flex-1 overflow-hidden flex flex-col bg-white border border-zinc-100 rounded-[2rem] shadow-sm">
                {/* Desktop View (Table) */}
                <div className="hidden lg:block overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-50 z-10 border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">No.</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date & Time</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Customer Details</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Unit Info</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Service Plan</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Contact</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {sortedAndFilteredBookings.map((b, idx) => (
                                <tr key={b.id} className="group hover:bg-zinc-50/50 transition-all">
                                    <td className="px-6 py-6 text-[10px] font-black text-zinc-400">#{(b.noUrut || idx + 1).toString().padStart(3, '0')}</td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-1">
                                            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black border border-red-100 block w-fit">
                                                {formatDateDisplay(b.tanggal)}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 pl-1">
                                                <Clock size={12} className="text-zinc-400" /> {typeof b.jam === 'number' ? b.jam.toFixed(2).replace('.', '.') : b.jam} WIB
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-0.5">
                                            <h3 className="font-black text-zinc-900 group-hover:text-red-700 transition-colors uppercase text-sm leading-tight">{b.namaCustomer || '-'}</h3>
                                            <p className="text-[10px] font-bold text-zinc-400 tracking-wide">VIN: {b.vin || '-'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-1">
                                            <span className="flex items-center gap-1.5 text-xs font-black text-zinc-900">
                                                <Car size={14} className="text-zinc-400" /> {String(b.noPlat).toUpperCase()}
                                            </span>
                                            <p className="text-[11px] font-bold text-zinc-500 pl-5">{b.tipeMobil}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-2">
                                            <div className={`px-4 py-2 rounded-xl text-[10px] font-black border flex flex-col gap-1 shadow-sm
                                                ${b.keperluanService?.startsWith('Keluhan') ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-rose-50' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50'}`}>
                                                <span className="uppercase tracking-widest">{b.keperluanService?.split(':')[0]}</span>
                                                {b.keperluanService?.includes(':') && (
                                                    <span className="text-[8px] font-bold text-rose-500 normal-case italic border-t border-rose-100 pt-1 mt-1">
                                                        {b.keperluanService.split(':')[1]}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[9px] font-bold text-zinc-400 pl-1 italic">Via: {b.bookingVia || 'System'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <a href={`https://wa.me/${String(b.noTelp).replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 group/wa">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover/wa:bg-green-600 group-hover/wa:text-white transition-all">
                                                <Phone size={14} />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-600 border-b border-zinc-200 hover:border-green-600 transition-all">{b.noTelp}</span>
                                        </a>
                                    </td>
                                    <td className="px-6 py-6 border-l border-zinc-100/10">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            {b.status === 'waiting confirm' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleStatusUpdate(b.id, 'accepted')} className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-[1rem] shadow-lg shadow-green-100 transition-all active:scale-90" title="Terima Booking">
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button onClick={() => handleStatusUpdate(b.id, 'declined')} className="p-3 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-[1rem] transition-all active:scale-90" title="Tolak Booking">
                                                        <XCircle size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <select 
                                                        value={b.status} 
                                                        onChange={(e) => handleStatusUpdate(b.id, e.target.value)}
                                                        className={`text-[9px] font-black uppercase tracking-[0.05em] px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all
                                                            ${b.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                                                              b.status === 'declined' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 
                                                              b.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 
                                                              'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}
                                                    >
                                                        <option value="accepted">Accepted</option>
                                                        <option value="declined">Declined</option>
                                                        <option value="completed">Completed</option>
                                                        <option value="waiting confirm">Waiting</option>
                                                        <option value="no show">No Show</option>
                                                    </select>
                                                </div>
                                            )}
                                            <button onClick={() => handleDelete(b.id)} className="text-[10px] font-bold text-zinc-300 hover:text-red-500 flex items-center gap-1 transition-all" title="Hapus Data">
                                                <Trash2 size={12} /> Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="lg:hidden flex-1 overflow-y-auto bg-zinc-50/50 p-4 space-y-4">
                    {sortedAndFilteredBookings.map((b, idx) => (
                        <div key={b.id} className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 py-2 px-4 bg-zinc-50 rounded-bl-3xl border-l border-b border-zinc-100 text-[9px] font-black text-zinc-400">
                                #{(b.noUrut || idx + 1).toString().padStart(3, '0')}
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="bg-red-50 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-red-600 border border-red-100 shrink-0">
                                    <span className="text-[10px] font-black leading-none uppercase">{new Date(b.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                    <span className="text-lg font-black leading-none">{new Date(b.tanggal).getDate()}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-zinc-900 text-base leading-tight uppercase">{b.namaCustomer || '-'}</h3>
                                    <p className="text-[10px] font-bold text-zinc-400">Jam: {b.jam} WIB • Via {b.bookingVia || 'Web'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Unit & Plat</p>
                                    <p className="text-xs font-black text-zinc-800 leading-tight">{b.noPlat}</p>
                                    <p className="text-[10px] font-bold text-zinc-500">{b.tipeMobil}</p>
                                </div>
                                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 col-span-2">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Layanan / Plan</p>
                                    <div className={`px-4 py-3 rounded-xl text-[11px] font-black border
                                        ${b.keperluanService?.startsWith('Keluhan') ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                        {b.keperluanService}
                                    </div>
                                    <p className="text-[9px] font-bold text-zinc-400 mt-2 italic px-1">Unit: {b.tipeMobil} • {b.vin || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <a href={`https://wa.me/${String(b.noTelp).replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                                    <Phone size={14} className="text-green-600" />
                                    <span className="text-[11px] font-black text-green-700">{b.noTelp}</span>
                                </a>
                                
                                <div className="flex items-center gap-2">
                                    {b.status === 'waiting confirm' ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleStatusUpdate(b.id, 'accepted')} className="p-2.5 bg-green-500 text-white rounded-xl shadow-lg shadow-green-100">
                                                <CheckCircle size={16} />
                                            </button>
                                            <button onClick={() => handleStatusUpdate(b.id, 'declined')} className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <select 
                                            value={b.status} 
                                            onChange={(e) => handleStatusUpdate(b.id, e.target.value)}
                                            className="text-[9px] font-black px-3 py-1.5 rounded-lg border bg-zinc-50 outline-none"
                                        >
                                            <option value="accepted">Accepted</option>
                                            <option value="declined">Declined</option>
                                            <option value="completed">Completed</option>
                                            <option value="waiting confirm">Waiting</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* NEW BOOKING MODAL - COMPACT 2-COLUMN LAYOUT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4 animate-fade-in overflow-hidden">
                    <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[2.5rem] shadow-2xl relative flex flex-col">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-6 p-2 bg-zinc-50 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-xl transition-all z-20">
                            <X size={18} />
                        </button>

                        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 pb-5">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-black text-zinc-900 uppercase tracking-tight leading-none">New Manual Booking</h2>
                                    <p className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div> CRO ENTRY SYSTEM
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black uppercase text-zinc-400">Ready</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[8px] font-black uppercase text-zinc-400">Partial</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[8px] font-black uppercase text-zinc-400">Full</span></div>
                                </div>
                            </div>

                            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* LEFT COLUMN: SCHEDULING (CALENDAR + TIME) */}
                                <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                                <div className="w-5 h-5 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[8px]">1</div> Select Date
                                            </h3>
                                        </div>

                                        <div className="bg-zinc-50 border border-zinc-100 rounded-[2rem] p-4">
                                            <div className="flex items-center justify-between mb-4 px-1">
                                                <button type="button" onClick={() => changeCalMonth(-1)} className="p-1.5 bg-white border border-zinc-100 rounded-lg hover:bg-zinc-900 hover:text-white transition-all"><ChevronLeft size={14} /></button>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-900">
                                                    {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                                </h4>
                                                <button type="button" onClick={() => changeCalMonth(1)} className="p-1.5 bg-white border border-zinc-100 rounded-lg hover:bg-zinc-900 hover:text-white transition-all"><ChevronRight size={14} /></button>
                                            </div>

                                            <div className="grid grid-cols-7 gap-1 text-center text-[7px] font-black uppercase text-zinc-300 mb-2">
                                                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d}>{d}</div>)}
                                            </div>

                                            <div className="grid grid-cols-7 gap-1.5">
                                                {calendarGrid.map((item, idx) => {
                                                    if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-5"><div className="w-full h-full border border-dashed border-zinc-200 rounded-lg"></div></div>;
                                                    
                                                    const status = getDateStatus(item.date);
                                                    const isActive = formData.tanggal === item.date;
                                                    const isPast = new Date(item.date) < new Date().setHours(0,0,0,0);
                                                    
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            disabled={isPast || status === 'closed'}
                                                            onClick={() => setFormData({ ...formData, tanggal: item.date, jam: '' })}
                                                            className={`relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center transition-all border-2 ${
                                                                isPast || status === 'closed' ? 'bg-zinc-100/30 border-transparent text-zinc-200 cursor-not-allowed opacity-20' :
                                                                isActive ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg z-10' :
                                                                status === 'empty' ? 'bg-white border-zinc-100 text-zinc-800 hover:border-red-400' :
                                                                status === 'partial' ? 'bg-white border-amber-200 text-zinc-800 hover:border-amber-500 shadow-sm' :
                                                                'bg-white border-rose-50 text-rose-200 cursor-not-allowed opacity-50'
                                                            }`}
                                                        >
                                                            <span className="text-[10px] font-black">{item.day}</span>
                                                            {!isPast && status !== 'closed' && (
                                                                <div className={`w-1 h-1 rounded-full mt-1 ${
                                                                    status === 'empty' ? 'bg-emerald-500' : 
                                                                    status === 'partial' ? 'bg-amber-400' : 'bg-rose-500'
                                                                }`} />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                            <div className="w-5 h-5 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[8px]">2</div> Arrival Slot
                                        </h3>
                                        <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                            {JAM_PILIHAN.map(j => {
                                                const isTaken = bookings.some(b => isSameDate(b.tanggal, formData.tanggal) && (parseFloat(b.jam) === parseFloat(j.replace('.', '.'))) && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed'));
                                                const isPastTime = isSameDate(formData.tanggal, new Date()) && (parseFloat(j) < (new Date().getHours() + (new Date().getMinutes() / 100)));
                                                
                                                return (
                                                    <button
                                                        key={j} type="button" disabled={isTaken || isPastTime} onClick={() => setFormData({ ...formData, jam: j })}
                                                        className={`py-2 px-1 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${
                                                            formData.jam === j ? 'bg-red-600 border-red-600 text-white shadow-md' :
                                                            isTaken ? 'bg-zinc-100 border-transparent text-zinc-300 cursor-not-allowed' :
                                                            'bg-white border-zinc-100 text-zinc-400 hover:border-red-100 hover:text-red-600'
                                                        }`}
                                                    >
                                                        {j}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: CUSTOMER & SERVICE DETAILS */}
                                <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6 lg:border-l lg:border-zinc-100 lg:pl-8">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                            <div className="w-5 h-5 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[8px]">3</div> Customer & Unit
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Nama Customer</label>
                                                <input required type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none" placeholder="Input Nama" value={formData.namaCustomer} onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">WhatsApps</label>
                                                <input required type="tel" className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none" placeholder="08..." value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Tipe Unit</label>
                                                <select required className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none" value={formData.tipeMobil} onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })}>
                                                    <option value="">- Pilih Model -</option>
                                                    {TIPE_MOBIL.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">No Polisi</label>
                                                <input required type="text" className="w-full uppercase bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none" placeholder="BK XXXX XX" value={formData.noPlat} onChange={e => setFormData({ ...formData, noPlat: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                                            <div className="w-5 h-5 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[8px]">4</div> Service Plan
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {KEPERLUAN.map(plan => (
                                                <button key={plan} type="button" onClick={() => setFormData({ ...formData, keperluanService: plan })}
                                                    className={`py-2 px-1 rounded-xl border-2 font-black text-[8px] uppercase tracking-wider transition-all text-center leading-tight ${
                                                        formData.keperluanService === plan ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-zinc-50 border-zinc-50 text-zinc-400 hover:border-red-200'
                                                    }`}
                                                >
                                                    {plan}
                                                </button>
                                            ))}
                                        </div>

                                        {formData.keperluanService === 'Keluhan' && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <textarea required className="w-full bg-rose-50/20 border border-rose-100 rounded-xl p-3 text-xs font-bold text-zinc-900 min-h-[70px] outline-none" placeholder="Sebutkan detail keluhan..." value={formData.keluhanDetail} onChange={e => setFormData({ ...formData, keluhanDetail: e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 mt-auto">
                                        <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-black text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-100 transition-all flex items-center justify-center gap-3">
                                            {isLoading ? 'Processing...' : 'Confirm Registration'} <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E4E4E7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #F87171;
                }
            `}</style>
        </div>
    );
}

