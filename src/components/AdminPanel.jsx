import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, LogOut, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check, Moon, X, Clock, Activity, UserCog, FileText, PlusCircle, CheckCircle, Trash, Search, ChevronDown, Car, ShieldCheck, Info } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import TimeInput from './TimeInput';
import { supabase } from '../utils/supabaseClient';
import PublicBooking from './PublicBooking';

const CAR_MODELS = [
    "OMODA 5", "OMODA 5 EV", "OMODA 5 GT", "CHERY C5", "CHERY C5 CSH",
    "TIGGO 5X", "TIGGO CROSS", "TIGGO CROSS CSH", "TIGGO 7 PRO", "TIGGO 8",
    "TIGGO 8 PRO", "TIGGO 8 PRO MAX", "TIGGO 8 CSH", "TIGGO 9 CSH",
    "J6 IWD", "J6 RWD", "J6T", "J5", "J7 SHS", "J7 ICE", "J8 SHS"
];

const generateSlots = (count) => {
    const slots = [];
    let currentHour = 8;
    let currentMin = 30;
    for (let i = 0; i < count; i++) {
        const h = String(currentHour).padStart(2, '0');
        const m = String(currentMin).padStart(2, '0');
        slots.push(`${h}.${m}`);
        currentMin += 30;
        if (currentMin >= 60) {
            currentHour += 1;
            currentMin = 0;
        }
    }
    return slots;
};

const AdminPanel = ({ user, handleLogout, queue, rawHistory = [], deleteItem, clearQueue, editItem, handleSave, handleCancelEdit, formData, setFormData, isEditing, setIsEditing, errorMessage, formatTime, handleComplete, handleSetOvernight, handleCancelOvernight, breakSettings, setBreakSettings, handleAddTask, handleRemoveTask, handleToggleTask }) => {
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [typeSearchTerm, setTypeSearchTerm] = useState('');
    const [mechanics, setMechanics] = useState([]);
    const [isMechanicDropdownOpen, setIsMechanicDropdownOpen] = useState(false);
    const mechanicDropdownRef = useRef(null);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsTypeDropdownOpen(false);
            }
            if (mechanicDropdownRef.current && !mechanicDropdownRef.current.contains(event.target)) {
                setIsMechanicDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchMechanics = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('name')
                    .eq('role', 'mekanik');
                if (error) throw error;
                if (data) setMechanics(data);
            } catch (e) {
                console.error('Gagal fetch mekanik:', e);
            }
        };
        fetchMechanics();
    }, []);

    const [showOvernightModal, setShowOvernightModal] = useState(null);
    const [overnightReason, setOvernightReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [showChecklistModal, setShowChecklistModal] = useState(null);
    const [newTask, setNewTask] = useState('');
    const totalDetik = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
    const now = new Date();
    const previewSelesai = new Date(now.getTime() + (totalDetik * 1000));

    const isToday = (time) => {
        if (!time) return false;
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const checkStr = new Date(time).toISOString().split('T')[0];
            return todayStr === checkStr;
        } catch (e) { 
            // Fallback for dd/mm/yyyy
            try {
                if (typeof time === 'string' && time.includes('/')) {
                    const parts = time.split('/');
                    if (parts.length >= 3) {
                        const d = parseInt(parts[0]);
                        const m = parseInt(parts[1]) - 1;
                        const y = parseInt(parts[2]);
                        return new Date(y, m, d).toDateString() === new Date().toDateString();
                    }
                }
            } catch(e2) {}
            return false; 
        }
    };

    const [rawBookings, setRawBookings] = useState([]);

    const normalizeBK = useCallback((bk) => (bk || '').replace(/\s+/g, '').toUpperCase(), []);

    const cleanupPastBookings = useCallback(async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const { error } = await supabase
                .from('booking')
                .delete()
                .lt('tanggal', todayStr)
                .neq('id', 999999); // Don't delete config slot
            if (error) throw error;
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    }, []);

    const fetchBookings = useCallback(async () => {
        try {
            await cleanupPastBookings();
            const { data, error } = await supabase.from('booking').select('*');
            if (error) throw error;
            if (Array.isArray(data)) setRawBookings(data);
        } catch (e) {
            console.error('Gagal fetch booking dari Supabase:', e);
        }
    }, [cleanupPastBookings]);

    // 1. Subscribe ONLY ONCE on mount
    useEffect(() => {
        fetchBookings();
        const bookingSub = supabase
            .channel('admin-booking-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, () => {
                fetchBookings();
            })
            .subscribe();

        return () => { supabase.removeChannel(bookingSub); };
    }, [fetchBookings]);

    // 2. Process data locally when rawBookings, queue, or rawHistory change
    const todayBookings = useMemo(() => {
        if (!Array.isArray(rawBookings)) return [];
        
        const activePlates = new Set(queue.map(q => normalizeBK(q.bk)));
        const historyPlatesToday = new Set(
            rawHistory
                .filter(h => isToday(h.id) || isToday(h.waktuSelesai))
                .map(h => normalizeBK(h.bk))
        );

        return rawBookings
            .map(b => {
                const plat = normalizeBK(b.noPlat);
                const isArrived = activePlates.has(plat) || historyPlatesToday.has(plat);
                
                let isLate = false;
                try {
                    const [jam, menit] = String(b.jam).replace('.', ':').split(':');
                    const scheduledTime = new Date();
                    scheduledTime.setHours(parseInt(jam), parseInt(menit), 0, 0);
                    const diff = (new Date() - scheduledTime) / (1000 * 60);
                    if (diff > 30) isLate = true;
                } catch(e) {}

                return { ...b, isArrived, isLate };
            })
            .filter(b => isToday(b.tanggal) && b.status !== 'completed' && b.status !== 'declined' && b.status !== 'inactive');
    }, [rawBookings, queue, rawHistory, normalizeBK]);

    // Auto-update late bookings to inactive
    useEffect(() => {
        const checkLate = async () => {
            const lates = todayBookings.filter(b => b.isLate && !b.isArrived && b.status !== 'inactive');
            for (const b of lates) {
                await supabase.from('booking').update({ status: 'inactive', keluhanDetail: `TERLAMBAT > 30 MENIT (${b.keluhanDetail || ''})` }).eq('id', b.id);
            }
            if (lates.length > 0) fetchBookings();
        };
        const timer = setInterval(checkLate, 60000); // Check every minute
        checkLate(); // Initial check
        return () => clearInterval(timer);
    }, [todayBookings, fetchBookings]);

    const handleConfirmBooking = (booking) => {
        setFormData({
            ...formData,
            bk: (booking.noPlat || '').toUpperCase().replace(/\s+/g, ''),
            tipe: (booking.tipeMobil || '').toUpperCase(),
            category: booking.isLate ? 'Reguler' : 'Booking',
            keluhan: `${booking.isLate ? 'LATE BOOKING (REGULER):' : 'BOOKING:'} ${booking.keperluanService || ''} (${booking.namaCustomer || ''})`,
            jam: 0, menit: 30, detik: 0, mechanicName: ''
        });
        if (booking.isLate) {
            Toastify({ text: "⚠️ Booking Terlambat > 30 menit. Diubah menjadi REGULER.", background: "orange" }).showToast();
        }
    };

    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'booking'
    const [bookingSearchTerm, setBookingSearchTerm] = useState('');
    const [bookingDateFilter, setBookingDateFilter] = useState('');
    const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [isCreateBookingModalOpen, setIsCreateBookingModalOpen] = useState(false);
    const [createBookingForm, setCreateBookingForm] = useState({ tanggal: new Date().toISOString().split('T')[0], jam: '08.30', namaCustomer: '', noTelp: '', tipeMobil: '', noPlat: '', keperluanService: 'Service', vin: '' });

    const filteredMasterBookings = useMemo(() => {
        return rawBookings
            .filter(b => b.id !== 999999)
            .filter(b => {
                const searchStr = `${b.namaCustomer} ${b.noPlat} ${b.vin} ${b.keperluanService}`.toLowerCase();
                const matchesSearch = searchStr.includes(bookingSearchTerm.toLowerCase());
                const matchesDate = bookingDateFilter ? b.tanggal === bookingDateFilter : true;
                return matchesSearch && matchesDate;
            })
            .sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    }, [rawBookings, bookingSearchTerm, bookingDateFilter]);

    return (
        <div className="h-screen bg-zinc-50 flex flex-col font-sans overflow-hidden transition-colors duration-500 text-zinc-950">

            {/* COMPACT TOP HEADER */}
            <header className="bg-white border-b border-zinc-200 px-6 py-1.5 flex justify-between items-center z-50 shrink-0 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
                            <Zap className="text-white fill-white" size={16} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black tracking-tighter uppercase leading-none text-zinc-900">Admin <span className="text-red-600">Operations</span></h1>
                            <p className="text-[9px] font-black text-zinc-400 mt-1 uppercase tracking-widest leading-none">
                                Service Control Center
                            </p>
                        </div>
                    </div>

                    <nav className="flex items-center gap-1 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200 ml-4">
                        <button 
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-md text-zinc-950' : 'text-zinc-900 hover:text-red-600'}`}
                        >
                            Operations
                        </button>
                        <button 
                            onClick={() => setActiveTab('booking')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'booking' ? 'bg-white shadow-md text-zinc-950' : 'text-zinc-900 hover:text-red-600'}`}
                        >
                            Booking Database
                        </button>
                    </nav>
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

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'dashboard' ? (
                    <div className="h-full p-2 grid grid-cols-12 lg:grid-rows-12 gap-2 overflow-y-auto lg:overflow-hidden">

                        {/* 1. BOOKING LIST */}
                        <div className="col-span-12 lg:col-span-4 lg:row-span-7 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden relative min-h-[300px] lg:min-h-0">
                            <div className="p-1.5 px-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
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
                                            <div className="flex flex-col gap-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">
                                                       {b.jam} WIB
                                                    </div>
                                                    <h4 className="font-black text-sm text-zinc-900 uppercase tracking-tight">{b.noPlat || 'REGISTER'}</h4>
                                                </div>
                                                <div className="flex flex-col pl-1 ml-10">
                                                    <p className="text-[10px] font-black text-zinc-900 uppercase leading-none">{b.namaCustomer}</p>
                                                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Booked: {new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {b.tipeMobil}</p>
                                                </div>
                                                {b.isArrived ? (
                                                    <div className="ml-10 mt-1">
                                                        <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 w-fit">
                                                            <CheckCircle2 size={8} /> Sudah Datang
                                                        </span>
                                                    </div>
                                                ) : b.isLate ? (
                                                    <div className="ml-10 mt-1 flex flex-col gap-1">
                                                        <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5 w-fit animate-pulse border border-rose-400/50">
                                                            <AlertCircle size={8} /> Terlambat 30m+
                                                        </span>
                                                        <span className="text-[7px] font-bold text-rose-500 uppercase italic leading-none">Otomatis Inactive</span>
                                                    </div>
                                                ) : null}
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
                <div className={`col-span-12 lg:col-span-8 lg:row-span-7 bg-white rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden relative min-h-[400px] lg:min-h-0 ${isEditing ? 'border-red-600 ring-4 ring-red-600/10 shadow-lg' : 'border-zinc-200 shadow-sm'}`}>
                    <div className="p-1.5 px-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
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

                    <div className="flex-1 overflow-hidden p-3 flex flex-col lg:flex-row gap-4">
                        {/* LEFT COLUMN: Inputs & Checklist */}
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center gap-1.5 text-zinc-500">
                                        <Activity size={10} className="text-red-600" /> Nomor Polisi
                                    </label>
                                    <input type="text" value={formData.bk} onChange={(e) => setFormData({ ...formData, bk: e.target.value.toUpperCase() })}
                                        placeholder="BK 1XXX MA" className="w-full bg-zinc-50 border border-zinc-200 p-2 rounded-xl text-sm font-black outline-none transition-all uppercase focus:bg-white focus:border-red-600 text-zinc-900 shadow-inner" />
                                </div>
                                <div className="space-y-1.5 relative" ref={dropdownRef}>
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center justify-between text-zinc-500">
                                        <div className="flex items-center gap-1.5">
                                            <Car size={10} className="text-red-600" /> Tipe Unit
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const custom = prompt("Masukkan Tipe Mobil Baru:");
                                                if(custom) setFormData({ ...formData, tipe: custom.toUpperCase() });
                                            }}
                                            className="p-1 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                                            title="Tambah Tipe Kustom"
                                        >
                                            <Plus size={10} strokeWidth={4} />
                                        </button>
                                    </label>
                                    <div 
                                        onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white active:scale-[0.98] ${isTypeDropdownOpen ? 'border-red-600 ring-2 ring-red-600/10 bg-white' : ''}`}
                                    >
                                        <span className={`text-sm font-black uppercase tracking-tight ${formData.tipe ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                            {formData.tipe || "Pilih Tipe Mobil"}
                                        </span>
                                        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isTypeDropdownOpen ? 'rotate-180 text-red-600' : ''}`} />
                                    </div>

                                    {isTypeDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-zinc-100 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="p-2 border-b border-zinc-50 bg-zinc-50/50">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input 
                                                        type="text" 
                                                        autoFocus
                                                        placeholder="Cari tipe mobil..." 
                                                        value={typeSearchTerm}
                                                        onChange={(e) => setTypeSearchTerm(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-[11px] font-black uppercase outline-none focus:border-red-600 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                                                {CAR_MODELS.filter(m => m.toLowerCase().includes(typeSearchTerm.toLowerCase())).map((model, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            setFormData({ ...formData, tipe: model });
                                                            setIsTypeDropdownOpen(false);
                                                            setTypeSearchTerm('');
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight text-zinc-700 hover:bg-red-600 hover:text-white transition-all flex items-center justify-between group"
                                                    >
                                                        {model}
                                                        <ChevronDown size={10} className="rotate-[-90deg] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))}
                                                {CAR_MODELS.filter(m => m.toLowerCase().includes(typeSearchTerm.toLowerCase())).length === 0 && (
                                                    <div className="p-6 text-center">
                                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-loose">Tipe tidak ditemukan</p>
                                                        <button 
                                                            onClick={() => {
                                                                setFormData({ ...formData, tipe: typeSearchTerm.toUpperCase() });
                                                                setIsTypeDropdownOpen(false);
                                                                setTypeSearchTerm('');
                                                            }}
                                                            className="mt-3 text-[10px] font-black text-red-600 border-2 border-red-600 px-4 py-1.5 rounded-full hover:bg-red-600 hover:text-white transition-all uppercase"
                                                        >
                                                            Gunakan "{typeSearchTerm.toUpperCase()}"
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 relative" ref={mechanicDropdownRef}>
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center gap-1.5 text-zinc-500">
                                        <UserCog size={10} className="text-red-600" /> Mekanik
                                    </label>
                                    <div 
                                        onClick={() => setIsMechanicDropdownOpen(!isMechanicDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white active:scale-[0.98] ${isMechanicDropdownOpen ? 'border-red-600 ring-2 ring-red-600/10 bg-white' : ''}`}
                                    >
                                        <span className={`text-sm font-black uppercase tracking-tight ${formData.mechanicName ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                            {formData.mechanicName || "Pilih Mekanik"}
                                        </span>
                                        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isMechanicDropdownOpen ? 'rotate-180 text-red-600' : ''}`} />
                                    </div>

                                    {isMechanicDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-zinc-100 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                                                <button
                                                    onClick={() => {
                                                        setFormData({ ...formData, mechanicName: '' });
                                                        setIsMechanicDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight text-zinc-400 hover:bg-zinc-100 transition-all"
                                                >
                                                    -- BELUM ASSIGN --
                                                </button>
                                                {mechanics.map((m, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            const newMechanic = m.name;
                                                            if (isEditing && formData.mechanicName && formData.mechanicName !== newMechanic) {
                                                                if (window.confirm(`Ganti mekanik dari ${formData.mechanicName} ke ${newMechanic}?`)) {
                                                                    setFormData({ ...formData, mechanicName: newMechanic });
                                                                }
                                                            } else {
                                                                setFormData({ ...formData, mechanicName: newMechanic });
                                                            }
                                                            setIsMechanicDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight text-zinc-700 hover:bg-red-600 hover:text-white transition-all flex items-center justify-between group"
                                                    >
                                                        {m.name}
                                                        <Check size={10} className={`opacity-0 ${formData.mechanicName === m.name ? 'opacity-100 text-red-600 group-hover:text-white' : ''}`} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 3 CONTAINERS CATEGORY - HORIZONTAL */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 w-full mt-1 mb-1 bg-zinc-50 p-2 rounded-2xl border border-zinc-100">
                                {/* Container 1: Category (Single Select) */}
                                <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col items-center gap-3">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">TYPE</label>
                                    <div className="flex flex-col gap-2 w-full">
                                        {['Booking', 'Reguler'].map(cat => (
                                            <button key={cat} onClick={() => setFormData({ ...formData, category: cat })}
                                                className={`w-full py-1.5 rounded-lg text-[9px] font-black transition-all duration-300 border-2 ${formData.category === cat ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Container 2: Free Service (Single Select) */}
                                <div className="bg-white p-2 md:p-3 rounded-xl border border-zinc-200 shadow-sm flex flex-col items-center gap-2">
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
                                                    className={`w-full py-1.5 rounded-lg text-[9px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Container 3: Issues (Multi Select) */}
                                <div className="bg-white p-2 md:p-3 rounded-xl border border-zinc-200 shadow-sm flex flex-col items-center gap-2">
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
                                                    className={`w-full py-1.5 rounded-lg text-[9px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-[#E50000] text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}>
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                                {/* JOB CHECKLIST BUILDER */}
                            <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 mb-0.5">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-3 mb-2 block flex items-center gap-2">
                                        <FileText size={12} className="text-blue-600" /> Job Checklist / Item Pekerjaan
                                    </label>
                                    <div className="flex gap-2 px-3 mb-2">
                                        <input type="text" placeholder="Tambah item pekerjaan..."
                                            className="flex-1 bg-white border border-zinc-200 p-2 rounded-xl text-[10px] font-bold focus:border-blue-600 outline-none shadow-sm"
                                            id="initialTaskInput"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = e.target.value.trim();
                                                    if (val) {
                                                        const newTaskObj = { id: Date.now(), text: val, completed: false };
                                                        setFormData(prev => ({ ...prev, checklist: [...(prev.checklist || []), newTaskObj] }));
                                                        e.target.value = '';
                                                    }
                                                }
                                            }} />
                                        <button onClick={() => {
                                            const input = document.getElementById('initialTaskInput');
                                            const val = input.value.trim();
                                            if (val) {
                                                const newTaskObj = { id: Date.now(), text: val, completed: false };
                                                setFormData(prev => ({ ...prev, checklist: [...(prev.checklist || []), newTaskObj] }));
                                                input.value = '';
                                            }
                                        }} className="bg-blue-600 text-white p-2 rounded-xl shadow-md hover:bg-zinc-900 transition-all"><Plus size={14} strokeWidth={4} /></button>
                                    </div>

                                    <div className="space-y-1 max-h-[60px] overflow-y-auto px-4 custom-scrollbar">
                                        {(formData.checklist || []).length === 0 ? (
                                            <p className="text-center text-[10px] font-bold text-zinc-300 uppercase py-2 italic">Belum ada item ditambahkan</p>
                                        ) : (
                                            formData.checklist.map((t, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-100 shadow-sm animate-fade-in">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-5 h-5 rounded bg-zinc-50 border border-zinc-200 flex items-center justify-center text-[10px] font-black text-zinc-400">{idx + 1}</div>
                                                        <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-tight">{t.text}</span>
                                                    </div>
                                                    <button onClick={() => setFormData({ ...formData, checklist: formData.checklist.filter((_, i) => i !== idx) })} className="p-1.5 text-zinc-300 hover:text-red-500 transition-all"><Trash size={14} /></button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div> {/* Penutup Kolom Kiri */}

                            {/* KOLOM KANAN: Sidebar (Durasi & Tombol Aktifkan) */}
                            <div className="w-full lg:w-48 xl:w-56 flex flex-col justify-start gap-3 shrink-0">
                                    <div className="bg-white rounded-xl p-2 border border-zinc-200 shadow-sm flex flex-col gap-1.5">
                                        <label className="text-[8px] font-black uppercase text-red-600 tracking-[0.2em] block text-center leading-none">Durasi</label>
                                        <div className="flex items-center justify-center gap-1 py-0">
                                            <TimeInput label="H" value={formData.jam} max={23} onChange={(val) => setFormData({ ...formData, jam: val })} />
                                            <span className="text-zinc-400 font-black text-sm">:</span>
                                            <TimeInput label="M" value={formData.menit} max={59} onChange={(val) => setFormData({ ...formData, menit: val })} />
                                            <span className="text-zinc-400 font-black text-sm">:</span>
                                            <TimeInput label="S" value={formData.detik} max={59} onChange={(val) => setFormData({ ...formData, detik: val })} />
                                        </div>
                                        <div className="pt-1 border-t border-zinc-100 flex justify-between items-center px-1">
                                            <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Selesai</p>
                                            <p className="text-xs font-black text-zinc-900 tracking-tighter">{totalDetik >= 1800 ? previewSelesai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                                        </div>
                                    </div>

                                    <button onClick={handleSave} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${isEditing ? 'bg-red-600 text-white hover:bg-zinc-900' : 'bg-zinc-900 text-white hover:bg-black'}`}>
                                        {isEditing ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                                        {isEditing ? 'Simpan Edit' : 'Aktifkan'}
                                    </button>
                                </div> {/* Penutup KOLOM KANAN */}
                            </div> {/* Penutup lg:flex-row */}
                        </div> {/* Penutup col-span-8 */}

                {/* 3. MONITORING LIST */}
                <div className="col-span-12 lg:row-span-5 flex flex-col bg-white rounded-2xl border border-dashed border-zinc-300 overflow-hidden shadow-sm min-h-[500px] lg:min-h-0">
                    <div className="px-6 py-2 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0 z-20">
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
                                <tr className="border-b-2 border-zinc-100 bg-zinc-50/50">
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
                                            <tr key={index} className="hover:bg-zinc-50/50 transition-all border-l-4 border-transparent hover:border-red-600 duration-200 group border-b border-zinc-100 border-dashed">
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
                                                            {item.status === 'waiting' ? 'Menunggu / Kerjakan' : item.status}
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
                                                        {item.checklist && item.checklist.length > 0 && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <div className="flex -space-x-1">
                                                                    {item.checklist.slice(0, 3).map((t, i) => (
                                                                        <div key={i} className={`w-2.5 h-2.5 rounded-full border border-white ${t.completed ? 'bg-emerald-500' : 'bg-zinc-200'}`}></div>
                                                                    ))}
                                                                    {item.checklist.length > 3 && <div className="text-[7px] text-zinc-400 font-bold pl-1.5">+{item.checklist.length - 3}</div>}
                                                                </div>
                                                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">
                                                                    {item.checklist.filter(t => t.completed).length}/{item.checklist.length} TASK
                                                                </span>
                                                            </div>
                                                        )}
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
                                                                <button onClick={() => setShowOvernightModal(item)} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-sm transition-all active:scale-95" title="Set Menginap">
                                                                    <Moon size={18} fill="white" />
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleCancelOvernight(item)} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-sm transition-all active:scale-95" title="Batal Menginap">
                                                                    <Zap size={18} fill="white" />
                                                                </button>
                                                            )
                                                        )}
                                                        <button onClick={() => setShowChecklistModal(item)} className="p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Keluhan & Checklist Pekerjaan">
                                                            <FileText size={16} />
                                                        </button>
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
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Sistem Alert: {queue.filter(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap').length} unit melewati batas waktu.</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col bg-white overflow-hidden p-8 gap-8">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="bg-zinc-950 p-4 rounded-[1.5rem] text-white shadow-2xl">
                                <Bookmark size={28} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter italic leading-none">Global Booking <span className="text-zinc-400">Master</span></h2>
                                <div className="text-xs font-black text-zinc-950 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div> Authorized Control Center
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto bg-zinc-50 p-3 rounded-[2rem] border border-zinc-100">
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-950 group-focus-within:text-red-600 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    value={bookingSearchTerm}
                                    onChange={(e) => setBookingSearchTerm(e.target.value)}
                                    placeholder="Search Customer, Plate, or VIN..."
                                    className="bg-white border-2 border-zinc-100 pl-14 pr-6 py-3.5 rounded-2xl text-sm font-black text-zinc-950 outline-none focus:border-red-600 focus:ring-8 focus:ring-red-50 transition-all min-w-[350px] shadow-sm"
                                />
                            </div>
                            <input 
                                type="date"
                                value={bookingDateFilter}
                                onChange={(e) => setBookingDateFilter(e.target.value)}
                                className="bg-white border-2 border-zinc-100 px-6 py-3.5 rounded-2xl text-xs font-black text-zinc-950 uppercase outline-none focus:border-red-600 shadow-sm cursor-pointer"
                            />
                            <div className="h-8 w-px bg-zinc-200 mx-2"></div>
                            <button 
                                onClick={() => {
                                    setCreateBookingForm({ tanggal: new Date().toISOString().split('T')[0], jam: '08.30', namaCustomer: '', noTelp: '', tipeMobil: '', noPlat: '', keperluanService: 'Service', vin: '' });
                                    setIsCreateBookingModalOpen(true);
                                }}
                                className="bg-zinc-950 hover:bg-red-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-zinc-200 group"
                            >
                                <Plus size={18} className="group-hover:rotate-90 transition-transform" /> New Booking
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white border-2 border-zinc-100 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-zinc-950 z-30">
                                    <tr>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Schedule</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Customer</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Vehicle</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">VIN Data</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Service Plan</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Status</th>
                                        <th className="px-8 py-7 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-zinc-50">
                                    {filteredMasterBookings.map((b, idx) => (
                                        <tr key={idx} className="group hover:bg-zinc-50/80 transition-all">
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-2">
                                                    <span className="bg-red-600 text-white px-4 py-2 rounded-xl text-[11px] font-black border border-red-700 w-fit shadow-lg shadow-red-100">
                                                        {new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-sm font-black text-zinc-950 pl-2 flex items-center gap-2">
                                                        <Clock size={14} className="text-red-500" /> {b.jam} WIB
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-base text-zinc-950 uppercase tracking-tight group-hover:text-red-600 transition-colors">{b.namaCustomer || 'N/A'}</span>
                                                    <a href={`tel:${b.noTelp}`} className="text-xs font-black text-zinc-950 underline decoration-zinc-200 hover:decoration-red-600 transition-all">{b.noTelp || '-'}</a>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-black text-zinc-950 uppercase flex items-center gap-2">
                                                        <Car size={16} className="text-red-500" /> {b.noPlat || '-'}
                                                    </span>
                                                    <span className="text-xs font-black text-zinc-950 tracking-wide">{b.tipeMobil || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 uppercase">
                                                <span className="text-[11px] font-mono font-black text-zinc-950 tracking-widest bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                                                    {b.vin || 'NO VIN DATA'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-3">
                                                    <div className={`px-5 py-3 rounded-2xl text-[10px] font-black border-2 w-fit shadow-md uppercase tracking-widest
                                                        ${b.keperluanService?.includes('Keluhan') ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100'}`}>
                                                        {b.keperluanService?.split(':')[0]}
                                                    </div>
                                                    {b.keperluanService?.includes('Edited') && (
                                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 italic">
                                                            {b.keperluanService.split('Edited')[1]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit border-2 shadow-sm
                                                    ${b.status === 'accepted' ? 'bg-emerald-500 text-white border-emerald-600' : 
                                                      b.status === 'waiting confirm' ? 'bg-amber-400 text-white border-amber-500 animate-pulse' : 
                                                      b.status === 'declined' ? 'bg-zinc-200 text-zinc-500 border-zinc-300' : 
                                                      b.status === 'completed' ? 'bg-zinc-950 text-white border-black' : 
                                                      'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>
                                                    {b.status}
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingBooking(b);
                                                            setIsEditBookingModalOpen(true);
                                                        }}
                                                        className="p-3 bg-zinc-100 hover:bg-zinc-950 text-zinc-950 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                                                    >
                                                        <Edit3 size={16} /> EDIT
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            if(window.confirm("Hapus booking ini permanen?")) {
                                                                await supabase.from('booking').delete().eq('id', b.id);
                                                                fetchBookings();
                                                                Toastify({ text: "Booking deleted!", background: "red" }).showToast();
                                                            }
                                                        }}
                                                        className="p-3 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* CREATE BOOKING MODAL */}
                    {isCreateBookingModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-8">
                            <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl border-4 border-zinc-950 overflow-hidden animate-fade-in relative flex flex-col max-h-[90vh]">
                                <div className="p-8 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter text-zinc-950">Add New Future Booking</h3>
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1 italic">Master Admin Override Mode</p>
                                    </div>
                                    <button onClick={() => setIsCreateBookingModalOpen(false)} className="p-3 bg-white border-2 border-zinc-100 rounded-2xl hover:bg-zinc-950 hover:text-white transition-all">
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tanggal Kedatangan</label>
                                            <input type="date" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all" value={createBookingForm.tanggal} onChange={e => setCreateBookingForm({...createBookingForm, tanggal: e.target.value})} />
                                        </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                            <Clock size={12} className="text-red-600" /> Arrival Slot Selection
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {(() => {
                                                const config = rawBookings.find(b => b.id === 999999);
                                                const slotCount = config ? parseInt(config.namaCustomer) || 4 : 4;
                                                const allSlots = generateSlots(slotCount);
                                                
                                                return allSlots.map(s => {
                                                    const isFull = rawBookings.some(b => b.id !== 999999 && b.tanggal === createBookingForm.tanggal && b.jam === s && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed'));
                                                    const isSelected = createBookingForm.jam === s;
                                                    return (
                                                        <button key={s} type="button" disabled={isFull && !isSelected} onClick={() => setCreateBookingForm({...createBookingForm, jam: s})}
                                                            className={`py-3 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5
                                                                ${isSelected ? 'bg-zinc-950 border-zinc-950 text-white shadow-lg scale-105 z-10' : 
                                                                  isFull ? 'bg-red-50 border-red-100 text-red-200 cursor-not-allowed opacity-60' : 
                                                                  'bg-white border-zinc-100 text-zinc-950 hover:border-red-600'}`}>
                                                            <span>{s}</span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nama Customer</label><input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 uppercase" value={createBookingForm.namaCustomer} onChange={e => setCreateBookingForm({...createBookingForm, namaCustomer: e.target.value})} /></div>
                                        <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">WhatsApp</label><input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950" value={createBookingForm.noTelp} onChange={e => setCreateBookingForm({...createBookingForm, noTelp: e.target.value})} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Model Kendaraan</label><input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 uppercase" value={createBookingForm.tipeMobil} onChange={e => setCreateBookingForm({...createBookingForm, tipeMobil: e.target.value})} /></div>
                                        <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nomor Polisi</label><input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 uppercase" value={createBookingForm.noPlat} onChange={e => setCreateBookingForm({...createBookingForm, noPlat: e.target.value.toUpperCase()})} /></div>
                                    </div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Keperluan Service</label><textarea className="w-full bg-zinc-50 border-2 border-zinc-100 p-6 rounded-[2rem] font-black text-sm text-zinc-950 min-h-[120px]" value={createBookingForm.keperluanService} onChange={e => setCreateBookingForm({...createBookingForm, keperluanService: e.target.value})} /></div>
                                </div>
                                <div className="p-8 bg-zinc-50 border-t-2 border-zinc-100 flex gap-4 shrink-0">
                                    <button onClick={() => setIsCreateBookingModalOpen(false)} className="flex-1 py-5 bg-white border-2 border-zinc-100 text-zinc-400 rounded-[1.5rem] font-black text-xs uppercase hover:border-zinc-950 hover:text-zinc-950 transition-all">Cancel</button>
                                    <button 
                                        onClick={async () => {
                                            if(!createBookingForm.noPlat || !createBookingForm.tipeMobil) return Toastify({text: "Plat dan Tipe Wajib Diisi", background: "red"}).showToast();
                                            const { error } = await supabase.from('booking').insert([{
                                                id: Date.now(),
                                                ...createBookingForm,
                                                noPlat: createBookingForm.noPlat.toUpperCase().replace(/\s+/g, ''),
                                                status: 'accepted',
                                                bookingVia: `ADMIN / ${user?.name || 'Authorized'}`
                                            }]);
                                            if (error) Toastify({ text: "Gagal membuat booking!", background: "red" }).showToast();
                                            else { Toastify({ text: "Booking berhasil dibuat!", background: "zinc-900" }).showToast(); setIsCreateBookingModalOpen(false); fetchBookings(); }
                                        }}
                                        className="flex-[2] py-5 bg-zinc-950 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-2xl shadow-zinc-300 hover:bg-black transition-all flex items-center justify-center gap-3"
                                    >
                                        <PlusCircle size={18} /> Create Final Booking
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDIT BOOKING MODAL */}
                    {isEditBookingModalOpen && editingBooking && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-8">
                            <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl border-4 border-zinc-950 overflow-hidden animate-fade-in relative flex flex-col max-h-[90vh]">
                                <div className="p-8 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter text-zinc-950">Update Booking Details</h3>
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1 italic">Master Admin Override Mode</p>
                                    </div>
                                    <button onClick={() => setIsEditBookingModalOpen(false)} className="p-3 bg-white border-2 border-zinc-100 rounded-2xl hover:bg-zinc-950 hover:text-white transition-all">
                                        <X size={24} />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tanggal Kedatangan</label>
                                            <input 
                                                type="date" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all"
                                                value={editingBooking.tanggal}
                                                onChange={e => setEditingBooking({...editingBooking, tanggal: e.target.value})}
                                            />
                                        </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                            <Clock size={12} className="text-red-600" /> Arrival Slot Selection
                                        </label>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {(() => {
                                                const config = rawBookings.find(b => b.id === 999999);
                                                const slotCount = config ? parseInt(config.namaCustomer) || 4 : 4;
                                                const allSlots = generateSlots(slotCount);
                                                
                                                return allSlots.map(s => {
                                                    const bookingsAtThisTime = rawBookings.filter(b => 
                                                        b.id !== 999999 && 
                                                        b.id !== editingBooking.id && // Exclude CURRENT booking being edited
                                                        b.tanggal === editingBooking.tanggal && 
                                                        b.jam === s &&
                                                        (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
                                                    );
                                                    const isFull = bookingsAtThisTime.length >= 1;
                                                    const isSelected = editingBooking.jam === s;

                                                    return (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            disabled={isFull && !isSelected}
                                                            onClick={() => setEditingBooking({...editingBooking, jam: s})}
                                                            className={`py-3 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5
                                                                ${isSelected ? 'bg-zinc-950 border-zinc-950 text-white shadow-lg scale-105 z-10' : 
                                                                  isFull ? 'bg-red-50 border-red-100 text-red-200 cursor-not-allowed opacity-60' : 
                                                                  'bg-white border-zinc-100 text-zinc-950 hover:border-red-600'}`}
                                                        >
                                                            <span>{s}</span>
                                                            <span className={`text-[6px] font-black ${isSelected ? 'text-white/60' : isFull ? 'text-red-400' : 'text-zinc-300'}`}>
                                                                {isSelected ? 'CURRENT' : isFull ? 'OCCUPIED' : 'AVAIL'}
                                                            </span>
                                                            {isFull && !isSelected && <div className="absolute inset-0 bg-white/10 backdrop-grayscale-[0.5]"></div>}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nama Customer</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all uppercase"
                                                value={editingBooking.namaCustomer}
                                                onChange={e => setEditingBooking({...editingBooking, namaCustomer: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">WhatsApp</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all"
                                                value={editingBooking.noTelp}
                                                onChange={e => setEditingBooking({...editingBooking, noTelp: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Model Kendaraan</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all uppercase"
                                                value={editingBooking.tipeMobil}
                                                onChange={e => setEditingBooking({...editingBooking, tipeMobil: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nomor Polisi</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all uppercase"
                                                value={editingBooking.noPlat}
                                                onChange={e => setEditingBooking({...editingBooking, noPlat: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Keperluan Service</label>
                                        <textarea 
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 p-6 rounded-[2rem] font-black text-sm text-zinc-950 focus:border-red-600 outline-none transition-all min-h-[120px]"
                                            value={editingBooking.keperluanService}
                                            onChange={e => setEditingBooking({...editingBooking, keperluanService: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="p-8 bg-zinc-50 border-t-2 border-zinc-100 flex gap-4 shrink-0">
                                    <button onClick={() => setIsEditBookingModalOpen(false)} className="flex-1 py-5 bg-white border-2 border-zinc-100 text-zinc-400 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:border-zinc-950 hover:text-zinc-950 transition-all">Cancel</button>
                                    <button 
                                        onClick={async () => {
                                            const auditStamp = ` | Sudah di edit oleh ${user?.name || 'Admin'} pada ${new Date().toLocaleTimeString('id-id')}`;
                                            const finalNote = editingBooking.keperluanService.includes(' | Sudah di edit') 
                                                ? editingBooking.keperluanService.split(' | Sudah di edit')[0] + auditStamp
                                                : editingBooking.keperluanService + auditStamp;
                                            
                                            const { error } = await supabase
                                                .from('booking')
                                                .update({
                                                    ...editingBooking,
                                                    noPlat: editingBooking.noPlat.toUpperCase().replace(/\s+/g, ''),
                                                    keperluanService: finalNote,
                                                    bookingVia: `${editingBooking.bookingVia} (Edited by ${user?.name || 'Admin'})`
                                                })
                                                .eq('id', editingBooking.id);
                                            
                                            if (error) {
                                                Toastify({ text: "Gagal update!", background: "red" }).showToast();
                                            } else {
                                                Toastify({ text: "Booking updated & logged!", background: "zinc-900" }).showToast();
                                                setIsEditBookingModalOpen(false);
                                                fetchBookings();
                                            }
                                        }}
                                        className="flex-[2] py-5 bg-zinc-950 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-zinc-300 hover:bg-black transition-all flex items-center justify-center gap-3"
                                    >
                                        <ShieldCheck size={18} /> Save & Apply Master Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>





            {/* MODAL MENGINAP REASON */}
            {showOvernightModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 border border-zinc-100 animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-bl-full -z-10"></div>
                        <h3 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center gap-3">
                            <div className="bg-zinc-900 p-2 rounded-xl text-white"><Moon size={20} fill="white" /></div>
                            Menginap Karena:
                        </h3>

                        <div className="space-y-3 mb-8">
                            {['Masih belum siap', 'Menunggu part datang'].map(opt => (
                                <button key={opt} onClick={() => { setOvernightReason(opt); setCustomReason(''); }}
                                    className={`w-full p-4 rounded-xl font-bold text-sm text-left transition-all border-2 ${overnightReason === opt ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg' : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'}`}>
                                    {opt}
                                </button>
                            ))}
                            <div className="pt-2">
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 mb-2 block">Atau Input Alasan Lain:</label>
                                <input type="text" placeholder="Tulis alasan custom..." className="w-full bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-sm font-bold focus:bg-white focus:border-zinc-900 outline-none transition-all shadow-inner"
                                    value={customReason} onChange={(e) => { setCustomReason(e.target.value); setOvernightReason(''); }} />
                            </div>

                            {(overnightReason || customReason) && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Preview Alasan:</p>
                                    <p className="text-xs font-bold text-red-600 italic">"{overnightReason || customReason}"</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => { setShowOvernightModal(null); setOvernightReason(''); setCustomReason(''); }} className="flex-1 py-4 bg-zinc-100 text-zinc-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">Batal</button>
                            <button onClick={() => { handleSetOvernight(showOvernightModal, overnightReason || customReason); setShowOvernightModal(null); setOvernightReason(''); setCustomReason(''); }}
                                disabled={!overnightReason && !customReason}
                                className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-zinc-900 transition-all disabled:opacity-50 disabled:grayscale">Konfirmasi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHECKLIST / KELUHAN */}
            {showChecklistModal && (() => {
                const currentItem = queue.find(q => q.id === showChecklistModal.id) || showChecklistModal;
                const checklistItems = Array.isArray(currentItem.checklist) ? currentItem.checklist : [];

                return (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col border border-zinc-100 animate-fade-in relative overflow-hidden text-zinc-900">
                            <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg"><FileText size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight leading-none">{currentItem.bk}</h3>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1.5">{currentItem.tipe} • Tasks & Checklist</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowChecklistModal(null)} className="p-2 bg-white text-zinc-400 hover:text-red-500 rounded-lg border border-zinc-200 shadow-sm transition-all"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {/* ADD TASK (Admin Only) */}
                                {user?.role === 'admin' && (
                                    <div className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-inner">
                                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 mb-2 block">Tambah Keluhan / Task Maintenance:</label>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Contoh: Lampu rem mati, Ganti oli filter..."
                                                className="flex-1 bg-white border border-zinc-200 p-4 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-600 outline-none transition-all shadow-sm"
                                                value={newTask} onChange={(e) => setNewTask(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && newTask && (handleAddTask(currentItem, newTask), setNewTask(''))} />
                                            <button onClick={() => newTask && (handleAddTask(currentItem, newTask), setNewTask(''))}
                                                className="bg-blue-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-lg shadow-blue-100 active:scale-90">
                                                <PlusCircle size={20} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Job Checklist
                                    </h4>

                                    {checklistItems.length === 0 ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-zinc-300 opacity-60 bg-zinc-50/50 rounded-3xl border-2 border-dashed border-zinc-100">
                                            <FileText size={48} className="mb-4" />
                                            <p className="text-xs font-black uppercase tracking-[0.2em]">Belum ada task / keluhan</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {checklistItems.map((t) => (
                                                <div key={t.id} className={`flex items-center justify-between p-5 rounded-2xl transition-all border shadow-sm ${t.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-zinc-100'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            disabled={user?.role !== 'mekanik'}
                                                            onClick={() => handleToggleTask(currentItem, t.id)}
                                                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${t.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-zinc-200 text-transparent hover:border-emerald-500'}`}>
                                                            <Check size={18} strokeWidth={4} />
                                                        </button>
                                                        <span className={`text-sm font-bold uppercase tracking-tight ${t.completed ? 'text-emerald-700 line-through opacity-60' : 'text-zinc-900'}`}>{t.text}</span>
                                                    </div>
                                                    {user?.role === 'admin' && (
                                                        <button onClick={() => handleRemoveTask(currentItem, t.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {user?.role !== 'mekanik' && checklistItems.length > 0 && (
                                        <p className="text-center text-[10px] font-bold text-zinc-400 mt-6 bg-zinc-50 py-3 rounded-xl border border-zinc-100">Hanya <span className="text-red-600 font-black">Role Mekanik</span> yang bisa mencentang task.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <style>{`
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