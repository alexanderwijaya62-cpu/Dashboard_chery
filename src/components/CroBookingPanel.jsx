import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, CheckCircle, XCircle, Plus, Trash2, Clock, Car, User, Phone, Send, X } from 'lucide-react';
import Toastify from 'toastify-js';
import { API_KEY, GAS_BOOKING_URL } from '../utils/config';

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
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jam: '',
        tipeMobil: '',
        noPlat: '',
        namaCustomer: '',
        keperluanService: '',
        vin: '',
        noTelp: ''
    });

    const customFetch = (url, options = {}) => {
        return fetch(url, { 
            ...options, 
            headers: { 
                ...options.headers, 
                "x-api-key": API_KEY,
                "Content-Type": "application/json" 
            } 
        });
    };

    const fetchBookings = async () => {
        try {
            if (!GAS_BOOKING_URL || GAS_BOOKING_URL.includes("YOUR_ACTUAL")) return;
            const resp = await customFetch(`${GAS_BOOKING_URL}?_=${Date.now()}`);
            const data = await resp.json();
            
            if (data && data.status === 'error') {
                console.error("Backend Error:", data.message);
                Toastify({ text: `Server Error: ${data.message}`, background: "red" }).showToast();
                return;
            }

            if (Array.isArray(data)) {
                // Normalisasi Key agar robust terhadap perbedaan Case di GSheet (ex: Id vs id)
                const normalized = data.map(item => {
                    const newItem = {};
                    Object.keys(item).forEach(key => {
                        let targetKey = key;
                        const lowKey = key.toLowerCase();
                        if (lowKey === 'id') targetKey = 'id';
                        else if (lowKey === 'bookingvia') targetKey = 'bookingVia';
                        else if (lowKey === 'nourut') targetKey = 'noUrut';
                        else if (lowKey === 'tipemobil') targetKey = 'tipeMobil';
                        else if (lowKey === 'noplat') targetKey = 'noPlat';
                        else if (lowKey === 'namacustomer') targetKey = 'namaCustomer';
                        else if (lowKey === 'keperluanservice') targetKey = 'keperluanService';
                        else if (lowKey === 'notelp') targetKey = 'noTelp';
                        
                        newItem[targetKey] = item[key];
                    });
                    return newItem;
                });
                setBookings(normalized);
            } else {
                setBookings([]);
            }
        } catch (e) {
            console.error("Fetch Error:", e);
        }
    };

    useEffect(() => {
        fetchBookings();
        const interval = setInterval(fetchBookings, 60000);

        // Listener untuk membuka modal dari luar (navbar)
        const openAddModal = () => {
            setFormData({
                tanggal: new Date().toISOString().split('T')[0],
                jam: '', tipeMobil: '', noPlat: '',
                namaCustomer: '', keperluanService: '',
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
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update',
                    id: id,
                    updates: { status: newStatus }
                })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: `Status berhasil diubah menjadi ${newStatus}!`, background: "green" }).showToast();
                fetchBookings();
            } else throw new Error();
        } catch {
            Toastify({ text: "Gagal update status", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Hapus data booking ini permanen?")) return;
        setIsLoading(true);
        try {
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'delete', id: id })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: "Data dihapus!", background: "blue" }).showToast();
                fetchBookings();
            } else throw new Error();
        } catch {
            Toastify({ text: "Gagal hapus", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'add',
                    data: { ...formData, bookingVia: user?.name || 'CRO', status: 'accepted' }
                })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: "Booking berhasil ditambahkan!", background: "green" }).showToast();
                setIsModalOpen(false);
                fetchBookings();
            } else throw new Error();
        } catch {
            Toastify({ text: "Gagal menambah booking", background: "red" }).showToast();
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
            if (y.length === 4) return new Date(y, m - 1, d);
            return new Date(d, m - 1, y);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date(0) : d;
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
                                                <Clock size={12} className="text-zinc-400" /> {b.jam} WIB
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
                                        <div className="space-y-1">
                                            <span className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-lg text-[10px] font-black border border-zinc-200">
                                                {b.keperluanService}
                                            </span>
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
                                <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Layanan</p>
                                    <p className="text-xs font-black text-zinc-800 leading-tight truncate">{b.keperluanService}</p>
                                    <p className="text-[10px] font-bold text-zinc-400">{b.vin || '-'}</p>
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

            {/* NEW BOOKING MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-3 bg-zinc-50 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-2xl transition-all">
                            <X size={20} />
                        </button>

                        <div className="p-8 lg:p-12">
                            <h2 className="text-3xl font-black text-zinc-900 mb-2 uppercase tracking-tight">New Manual Booking</h2>
                            <p className="text-zinc-500 font-bold text-sm mb-10 pb-6 border-b border-zinc-100">Input data pelanggan yang melakukan booking via telepon atau walk-in.</p>

                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nama Customer <span className="text-red-500">*</span></label>
                                        <input required type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all" value={formData.namaCustomer} onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">No WhatsApp <span className="text-red-500">*</span></label>
                                        <input required type="tel" className="w-full bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all" value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Jadwal Tanggal <span className="text-red-500">*</span></label>
                                        <input required type="date" className="w-full bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all" value={formData.tanggal} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Pilih Jam <span className="text-red-500">*</span></label>
                                        <select required className="w-full bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all cursor-pointer" value={formData.jam} onChange={e => setFormData({ ...formData, jam: e.target.value })}>
                                            <option value="">- Jam Kedatangan -</option>
                                            {JAM_PILIHAN.map(j => <option key={j} value={j}>{j} WIB</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tipe Unit <span className="text-red-500">*</span></label>
                                        <select required className="w-full bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all cursor-pointer" value={formData.tipeMobil} onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })}>
                                            <option value="">- Pilih Model -</option>
                                            {TIPE_MOBIL.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">No Polisi <span className="text-red-500">*</span></label>
                                        <input required type="text" className="w-full uppercase bg-zinc-50 border border-zinc-100 rounded-[1.2rem] p-4 font-bold text-zinc-900 focus:bg-white focus:border-red-600 outline-none transition-all" placeholder="BK XXXX XX" value={formData.noPlat} onChange={e => setFormData({ ...formData, noPlat: e.target.value })} />
                                    </div>
                                </div>

                                <div className="pt-8">
                                    <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                        {isLoading ? 'Processing...' : 'Save & Confirm Booking'} <Send size={18} />
                                    </button>
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

