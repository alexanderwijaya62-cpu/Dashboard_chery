import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check, Moon, X, Clock, Activity, UserCog, FileText, PlusCircle, CheckCircle, Trash, Search, ChevronDown, Car, ShieldCheck, Info } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import TimeInput from './TimeInput';
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import PublicBooking from './PublicBooking';

const CAR_MODELS = [
    "OMODA 5", "OMODA 5 EV", "OMODA 5 GT", "CHERY C5", "CHERY C5 CSH",
    "TIGGO 5X", "TIGGO CROSS", "TIGGO CROSS CSH", "TIGGO 7 PRO", "TIGGO 8",
    "TIGGO 8 PRO", "TIGGO 8 PRO MAX", "TIGGO 8 CSH", "TIGGO 9 CSH",
    "J6 IWD", "J6 RWD", "J6T", "J5", "J7 SHS", "J7 ICE", "J8 SHS"
];

const generateSlots = (count, gapMinutes = 30, startHour = 8, startMin = 30) => {
    const slots = [];
    let currentHour = startHour;
    let currentMin = startMin;
    for (let i = 0; i < count; i++) {
        const h = String(currentHour).padStart(2, '0');
        const m = String(currentMin).padStart(2, '0');
        slots.push(`${h}.${m}`);
        currentMin += gapMinutes;
        while (currentMin >= 60) {
            currentHour += 1;
            currentMin -= 60;
        }
    }
    return slots;
};

const normalizeJam = (j) => {
    if (!j) return "";
    const sj = String(j).replace(':', '.');
    const parts = sj.split('.');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] || '00').padEnd(2, '0');
    return `${h}.${m}`;
};

const AdminPanel = ({ user, handleLogout, queue, rawHistory = [], deleteItem, clearQueue, editItem, handleSave, handleCancelEdit, formData, setFormData, isEditing, setIsEditing, errorMessage, isLoadingProcess, formatTime, handleComplete, handleSetOvernight, handleCancelOvernight, breakSettings, setBreakSettings, handleAddTask, handleRemoveTask, handleToggleTask, playNotificationSound, activeTab: activeTabProp }) => {
    const [currentDay, setCurrentDay] = useState(new Date().toDateString());

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
                const { data, error } = await db.select('users', { select: 'name', eq: { role: 'mekanik' } });
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
            const todayStr = new Date().toLocaleDateString('en-CA');
            const checkDate = new Date(time);
            if (isNaN(checkDate.getTime())) return false;
            const checkStr = checkDate.toLocaleDateString('en-CA');
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
        // No longer delete past bookings — they are kept for audit trail
    }, []);

    const fetchBookings = useCallback(async () => {
        try {
            await cleanupPastBookings();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

            const { data, error } = await db.select('booking', { select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, status, bookingVia, vin, noTelp, noUrut', or: `tanggal.gte.${dateStr},id.eq.999999` });
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
    // Get config slot count for showing all slots
    const configSlotAdmin = rawBookings.find(b => b.id === 999999);
    const maxSlotsAdmin = configSlotAdmin ? parseInt(configSlotAdmin.namaCustomer) || 8 : 8;
    const gapAdmin = configSlotAdmin ? parseInt(configSlotAdmin.tipeMobil) || 30 : 30;
    const startAdmin = configSlotAdmin?.vin ? (() => { const p = configSlotAdmin.vin.split(':'); return { h: parseInt(p[0]) || 8, m: parseInt(p[1]) || 30 }; })() : { h: 8, m: 30 };
    const slotCapacityAdmin = configSlotAdmin?.vin ? (() => { const p = configSlotAdmin.vin.split(':'); return p.length >= 3 ? parseInt(p[2]) || 1 : 1; })() : 1;
    const allSlots = useMemo(() => generateSlots(maxSlotsAdmin, gapAdmin, startAdmin.h, startAdmin.m), [maxSlotsAdmin, gapAdmin, startAdmin.h, startAdmin.m]);

    // Refresh if day changes (midnight)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().toDateString();
            if (now !== currentDay) {
                setCurrentDay(now);
                fetchBookings();
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [currentDay, fetchBookings]);

    const todayBookings = useMemo(() => {
        if (!Array.isArray(rawBookings)) return [];
        
        const activePlates = new Set(queue.map(q => normalizeBK(q.bk)));
        const historyPlatesToday = new Set(
            rawHistory
                .filter(h => isToday(h.id) || isToday(h.waktuSelesai))
                .map(h => normalizeBK(h.bk))
        );

        const todayStr = new Date().toLocaleDateString('en-CA');

        // Tracker hari ini untuk refresh
        const isSameDay = (d1, d2) => {
            const getStr = (d) => {
                if (!d) return "";
                if (d instanceof Date) return d.toLocaleDateString('en-CA');
                const s = String(d).split(/[T ]/)[0];
                if (s.includes('-') && s.length === 10) return s; 
                const dt = new Date(d);
                return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-CA');
            };
            return getStr(d1) === getStr(d2);
        };

        // Get all booked entries for today
        const bookedEntries = rawBookings
            .filter(b => b.id !== 999999 && isSameDay(b.tanggal, todayStr) && b.status !== 'completed' && b.status !== 'declined' && b.status !== 'deleted')
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

                return { ...b, isArrived, isLate, isEmpty: false };
            });

        // Build a complete list showing ALL slots
        const normalizeJam = (j) => {
            if (!j) return '';
            const s = String(j).replace(':', '.');
            const [h, m] = s.split('.');
            return `${String(h).padStart(2, '0')}.${String(m || '00').padEnd(2, '0')}`;
        };
        const slotList = [];
        
        const bookingsByJam = {};
        bookedEntries.forEach(b => {
             const j = normalizeJam(b.jam);
             if(!bookingsByJam[j]) bookingsByJam[j] = [];
             bookingsByJam[j].push(b);
        });

        const processedSlotTimes = new Set();

        allSlots.forEach(slot => {
            const normalizedSlot = normalizeJam(slot);
            processedSlotTimes.add(normalizedSlot);
            const bookingsAtSlot = bookingsByJam[normalizedSlot] || [];
            
            if (bookingsAtSlot.length > 0) {
                bookingsAtSlot.forEach(b => slotList.push(b));
            }
            // Show empty placeholder for each remaining capacity
            const emptyCount = Math.max(0, slotCapacityAdmin - bookingsAtSlot.length);
            for (let e = 0; e < emptyCount; e++) {
                slotList.push({
                    id: `empty-${slot}-${e}`,
                    jam: slot,
                    tanggal: todayStr,
                    isEmpty: true,
                    isArrived: false,
                    isLate: false,
                    noPlat: '',
                    namaCustomer: '',
                    tipeMobil: '',
                    status: 'empty'
                });
            }
        });

        // MASUKKAN BOOKING YANG TIDAK ADA DI LIST SLOT (Overflow)
        Object.keys(bookingsByJam).forEach(j => {
            if (!processedSlotTimes.has(j)) {
                bookingsByJam[j].forEach(b => slotList.push(b));
            }
        });

        return slotList;
    }, [rawBookings, queue, rawHistory, normalizeBK, allSlots, currentDay]);

    useEffect(() => {
        const checkLate = async () => {
            const lates = todayBookings.filter(b => !b.isEmpty && b.isLate && !b.isArrived && b.status !== 'dipindahkan_reguler');
            for (const b of lates) {
                await db.update('booking', { status: 'dipindahkan_reguler' }, { eq: { id: b.id } });
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

    const [activeTab, setActiveTab] = useState(activeTabProp || 'dashboard'); // 'dashboard' or 'booking'

    // Sync activeTab with prop
    useEffect(() => {
      if (activeTabProp && activeTabProp !== activeTab) {
        setActiveTab(activeTabProp);
      }
    }, [activeTabProp]);

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
        <div className="h-screen max-w-[100vw] bg-zinc-50 flex flex-col font-sans overflow-hidden transition-colors duration-500 text-black">

            {/* COMPACT TOP HEADER */}
            <header className="bg-white border-b border-zinc-200 px-3 md:px-6 py-1.5 flex justify-between items-center z-50 shrink-0 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <div className="w-8 h-8 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 bg-black rounded-xl flex items-center justify-center shadow-md">
                            <Zap className="text-white fill-white" size={16} />
                        </div>
                        <div className="hidden md:block">
                            <h1 className="text-sm font-black tracking-tighter uppercase leading-none text-black">Admin <span className="text-black">Operations</span></h1>
                            <p className="text-[9px] font-black text-zinc-400 mt-1 uppercase tracking-widest leading-none">
                                Service Control Center
                            </p>
                        </div>
                    </div>

                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden xl:block">
                        <p className="text-[10px] font-black uppercase text-black leading-none">{user?.name || 'Authorized Admin'}</p>
                        <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status: Online</p>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'dashboard' ? (
                    <div className="h-full p-2 grid grid-cols-1 md:grid-cols-12 lg:grid-rows-12 gap-2 overflow-y-auto lg:overflow-hidden">

                        {/* 1. BOOKING LIST */}
                        <div className="col-span-1 md:col-span-12 lg:col-span-4 lg:row-span-7 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden relative min-h-[300px] lg:min-h-0">
                            <div className="p-1.5 px-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black flex items-center gap-2">
                                    <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div> Kedatangan Booking
                                </h3>
                                <span className="bg-zinc-100 text-zinc-600 text-[9px] font-black px-3 py-1 rounded-full">{todayBookings.filter(b => !b.isEmpty).length} / {todayBookings.length} Slots</span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar z-10">
                                {todayBookings.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60">
                                        <Bookmark size={40} className="mb-3" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No Pending Bookings</p>
                                    </div>
                                ) : (
                                    todayBookings.map((b, idx) => (
                                        <div key={b.id || idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all group/item ${
                                            b.isEmpty ? 'bg-zinc-50/50 border-dashed border-zinc-200' :
                                            b.isLate ? 'bg-orange-50/50 border-orange-200/60' :
                                            b.isArrived ? 'bg-emerald-50/50 border-emerald-200/60' :
                                            'bg-zinc-50 border-zinc-100 hover:bg-white hover:shadow-md'
                                        }`}>
                                            <div className="flex flex-col gap-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm ${
                                                        b.isEmpty ? 'bg-zinc-300 text-white' :
                                                        b.isLate ? 'bg-orange-400/80 text-white' :
                                                        'bg-black text-white'
                                                    }`}>
                                                       {b.jam} WIB
                                                    </div>
                                                    <h4 className={`font-black text-sm uppercase tracking-tight ${
                                                        b.isEmpty ? 'text-zinc-300 italic' : 'text-black'
                                                    }`}>{b.isEmpty ? 'SLOT KOSONG' : (b.noPlat || 'REGISTER')}</h4>
                                                </div>
                                                {!b.isEmpty && (
                                                    <div className="flex flex-col pl-1 ml-10">
                                                        <p className="text-[10px] font-black text-black uppercase leading-none">{b.namaCustomer}</p>
                                                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                                                            {b.bookingVia ? `Via: ${b.bookingVia} ` : ''}{b.tipeMobil}
                                                        </p>
                                                    </div>
                                                )}
                                                {!b.isEmpty && b.isArrived ? (
                                                    <div className="ml-10 mt-1">
                                                        <span className="bg-emerald-400/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 w-fit">
                                                            <CheckCircle2 size={8} /> Sudah Datang
                                                        </span>
                                                    </div>
                                                ) : !b.isEmpty && (b.isLate || b.status === 'dipindahkan_reguler') ? (
                                                    <div className="ml-10 mt-1 flex flex-col gap-1">
                                                        <span className="bg-amber-400/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5 w-fit border border-amber-300/50">
                                                            <AlertCircle size={8} /> Terlambat 30m+
                                                        </span>
                                                        <span className="text-[7px] font-bold text-amber-600 uppercase italic leading-none">Dipindahkan ke Reguler</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            {!b.isEmpty ? (
                                                <button onClick={() => !b.isArrived && handleConfirmBooking(b)} className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg transition-all flex items-center justify-center shadow-md active:scale-95 ${b.isArrived ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-black hover:bg-zinc-700 text-white'}`}>
                                                    <Plus size={16} strokeWidth={4} />
                                                </button>
                                            ) : (
                                                <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-zinc-100 border border-dashed border-zinc-200 flex items-center justify-center">
                                                    <Clock size={14} className="text-zinc-300" />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                {/* 2. FORM INPUT */}
                <div className={`col-span-1 md:col-span-12 lg:col-span-8 lg:row-span-7 bg-white rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden relative min-h-[400px] lg:min-h-0 ${isEditing ? 'border-black ring-4 ring-black/10 shadow-lg' : 'border-zinc-200 shadow-sm'}`}>
                    <div className="p-1.5 px-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg text-white shadow-md ${isEditing ? 'bg-black' : 'bg-black'}`}>
                                {isEditing ? <Activity size={16} /> : <Plus size={16} />}
                            </div>
                            <div>
                                <h2 className="text-[11px] font-black uppercase tracking-tight text-black">
                                    {isEditing ? 'Editing Activity Mode' : 'Pendaftaran Unit Kedatangan'}
                                </h2>
                                <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${isEditing ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                    {isEditing ? 'Silahkan koreksi data kendaraan' : 'Input data unit untuk memulai timer operasional'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {errorMessage && <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg uppercase border border-rose-100">{errorMessage}</span>}
                            {isEditing && (
                                <button onClick={handleCancelEdit} className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-lg transition-all" title="Cancel Edition">
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
                                        <Activity size={10} className="text-black" /> Nomor Polisi
                                    </label>
                                    <input type="text" value={formData.bk} onChange={(e) => setFormData({ ...formData, bk: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                                        placeholder="BK1XXXMA" className="w-full bg-zinc-50 border border-zinc-200 p-2 min-h-[44px] rounded-xl text-sm font-black outline-none transition-all uppercase focus:bg-white focus:border-black text-black shadow-inner" />
                                </div>
                                <div className="space-y-1.5 relative" ref={dropdownRef}>
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 flex items-center justify-between text-zinc-500">
                                        <div className="flex items-center gap-1.5">
                                            <Car size={10} className="text-black" /> Tipe Unit
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const custom = prompt("Masukkan Tipe Mobil Baru:");
                                                if(custom) setFormData({ ...formData, tipe: custom.toUpperCase() });
                                            }}
                                            className="p-1 hover:bg-zinc-200 text-black rounded-md transition-colors"
                                            title="Tambah Tipe Kustom"
                                        >
                                            <Plus size={10} strokeWidth={4} />
                                        </button>
                                    </label>
                                    <div 
                                        onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 p-2 min-h-[44px] rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white active:scale-[0.98] ${isTypeDropdownOpen ? 'border-black ring-2 ring-black/10 bg-white' : ''}`}
                                    >
                                        <span className={`text-sm font-black uppercase tracking-tight ${formData.tipe ? 'text-black' : 'text-zinc-400'}`}>
                                            {formData.tipe || "Pilih Tipe Mobil"}
                                        </span>
                                        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isTypeDropdownOpen ? 'rotate-180 text-black' : ''}`} />
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
                                                        className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-[11px] font-black uppercase outline-none focus:border-black transition-all"
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
                                                        className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight text-zinc-700 hover:bg-black hover:text-white transition-all flex items-center justify-between group"
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
                                                            className="mt-3 text-[10px] font-black text-black border-2 border-black px-4 py-1.5 rounded-full hover:bg-black hover:text-white transition-all uppercase"
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
                                        <UserCog size={10} className="text-black" /> Mekanik
                                    </label>
                                    <div 
                                        onClick={() => setIsMechanicDropdownOpen(!isMechanicDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 p-2 min-h-[44px] rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white active:scale-[0.98] ${isMechanicDropdownOpen ? 'border-black ring-2 ring-black/10 bg-white' : ''}`}
                                    >
                                        <span className={`text-sm font-black uppercase tracking-tight ${formData.mechanicName ? 'text-black' : 'text-zinc-400'}`}>
                                            {formData.mechanicName || "Pilih Mekanik"}
                                        </span>
                                        <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isMechanicDropdownOpen ? 'rotate-180 text-black' : ''}`} />
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
                                                        className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight text-zinc-700 hover:bg-black hover:text-white transition-all flex items-center justify-between group"
                                                    >
                                                        {m.name}
                                                        <Check size={10} className={`opacity-0 ${formData.mechanicName === m.name ? 'opacity-100 text-black group-hover:text-white' : ''}`} />
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
                                                className={`w-full py-1.5 min-h-[44px] rounded-lg text-sm md:text-[9px] font-black transition-all duration-300 border-2 ${formData.category === cat ? 'bg-black text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-200'}`}>
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
                                                    className={`w-full py-1.5 min-h-[44px] rounded-lg text-sm md:text-[9px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-black text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-200'}`}>
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
                                                    className={`w-full py-1.5 min-h-[44px] rounded-lg text-sm md:text-[9px] font-black transition-all duration-300 border-2 ${isActive ? 'bg-black text-white border-black shadow-md -translate-y-0.5' : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-200'}`}>
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* CHECKLIST & REASON GRID */}
                            <div className={`grid grid-cols-1 ${isEditing && formData.status === 'menginap' ? 'md:grid-cols-2' : ''} gap-2 mb-0.5`}>
                                {/* JOB CHECKLIST BUILDER */}
                                <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 flex flex-col">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-3 mb-2 block flex items-center gap-2">
                                        <FileText size={12} className="text-black" /> Job Checklist
                                    </label>
                                    <div className="flex gap-2 px-3 mb-2">
                                        <input type="text" placeholder="Tambah item..."
                                            className="flex-1 bg-white border border-zinc-200 p-2 min-h-[44px] rounded-xl text-sm md:text-[10px] font-bold focus:border-black outline-none shadow-sm"
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
                                        }} className="bg-black text-white p-2 min-w-[44px] min-h-[44px] rounded-xl shadow-md hover:bg-zinc-700 transition-all flex items-center justify-center"><Plus size={14} strokeWidth={4} /></button>
                                    </div>

                                    <div className="space-y-1 max-h-[60px] overflow-y-auto px-4 custom-scrollbar">
                                        {(formData.checklist || []).length === 0 ? (
                                            <p className="text-center text-[10px] font-bold text-zinc-300 uppercase py-2 italic">No tasks</p>
                                        ) : (
                                            formData.checklist.map((t, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                                    <span className="text-[9px] font-bold text-black uppercase tracking-tight truncate max-w-[120px]">{t.text}</span>
                                                    <button onClick={() => setFormData({ ...formData, checklist: formData.checklist.filter((_, i) => i !== idx) })} className="p-1 text-zinc-300 hover:text-black transition-all"><Trash size={12} /></button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* REASON MENGINAP (Hanya tampil jika sedang EDIT unit MENGINAP) */}
                                {isEditing && formData.status === 'menginap' && (
                                    <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 flex flex-col justify-center animate-fade-in">
                                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-3 mb-1.5 block flex items-center gap-2">
                                            <Moon size={12} className="text-zinc-400" /> Reason Menginap
                                        </label>
                                        <textarea 
                                            rows="3"
                                            placeholder="Alasan menginap..."
                                            className="w-full bg-white border border-zinc-200 p-2.5 rounded-xl text-[10px] font-black uppercase outline-none focus:border-black text-black transition-all shadow-inner resize-none"
                                            value={formData.menginap_reason || ''}
                                            onChange={(e) => setFormData({ ...formData, menginap_reason: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                )}
                            </div>
                            </div> {/* Penutup Kolom Kiri */}

                            {/* KOLOM KANAN: Sidebar (Durasi & Tombol Aktifkan) */}
                            <div className="w-full lg:w-48 xl:w-56 flex flex-col justify-start gap-3 shrink-0">
                                    <div className="bg-white rounded-xl p-2 border border-zinc-200 shadow-sm flex flex-col gap-1.5">
                                        <label className="text-[8px] font-black uppercase text-black tracking-[0.2em] block text-center leading-none">Durasi</label>
                                        <div className="flex items-center justify-center gap-1 py-0">
                                            <TimeInput label="H" value={formData.jam} max={23} onChange={(val) => setFormData({ ...formData, jam: val })} />
                                            <span className="text-zinc-400 font-black text-sm">:</span>
                                            <TimeInput label="M" value={formData.menit} max={59} onChange={(val) => setFormData({ ...formData, menit: val })} />
                                            <span className="text-zinc-400 font-black text-sm">:</span>
                                            <TimeInput label="S" value={formData.detik} max={59} onChange={(val) => setFormData({ ...formData, detik: val })} />
                                        </div>
                                        <div className="pt-1 border-t border-zinc-100 flex justify-between items-center px-1">
                                            <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Selesai</p>
                                            <p className="text-xs font-black text-black tracking-tighter">{totalDetik >= 1800 ? previewSelesai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                                        </div>
                                    </div>

                                    <button onClick={handleSave} className={`w-full py-4 min-h-[44px] rounded-xl font-black text-sm md:text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${isEditing ? 'bg-black text-white hover:bg-zinc-800' : 'bg-black text-white hover:bg-zinc-800'}`}>
                                        {isEditing ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                                        {isEditing ? 'Simpan Edit' : 'Aktifkan'}
                                    </button>
                                </div> {/* Penutup KOLOM KANAN */}
                            </div> {/* Penutup lg:flex-row */}
                        </div> {/* Penutup col-span-8 */}

                {/* 3. MONITORING LIST */}
                <div className="col-span-1 md:col-span-12 lg:row-span-5 flex flex-col bg-white rounded-2xl border border-dashed border-zinc-300 overflow-hidden shadow-sm min-h-[500px] lg:min-h-0">
                    <div className="px-6 py-2 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0 z-20">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white shadow-md">
                                <Activity size={14} />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-[11px] font-black uppercase tracking-tight text-black leading-none">Dashboard Monitoring</h3>
                                <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full animate-pulse ml-1"></div>
                            </div>
                            <div className="h-4 w-px bg-zinc-200 ml-2"></div>
                            <div className="hidden md:flex items-center gap-4 ml-1">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Total Active</span>
                                    <span className="text-xs font-black text-black leading-none">{queue.length} <span className="text-[8px] text-zinc-400">UNIT</span></span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-black uppercase tracking-widest">In Process</span>
                                    <span className="text-xs font-black text-black leading-none">{queue.filter(q => q.status === 'working').length} <span className="text-[8px] text-zinc-400">UNIT</span></span>
                                </div>
                            </div>
                        </div>
                        <button onClick={clearQueue} className="text-sm md:text-[8px] font-black text-zinc-400 hover:text-black uppercase tracking-widest px-4 py-2 min-h-[44px] md:min-h-0 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-all border border-transparent">Reset Antrian</button>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
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
                                            'working': 'bg-zinc-700 text-white shadow-md',
                                            'waiting': 'bg-zinc-100 text-zinc-500 border border-zinc-200',
                                            'completed': 'bg-emerald-400/80 text-white shadow-md',
                                            'menginap': 'bg-black text-white shadow-md'
                                        };
                                        const isOvernight = item.status === 'menginap';
                                        return (
                                            <tr key={index} className="hover:bg-zinc-50/50 transition-all border-l-4 border-transparent hover:border-black duration-200 group border-b border-zinc-100 border-dashed">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md">
                                                            {item.category[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xl font-black text-black tabular-nums uppercase tracking-tight leading-none">{item.bk}</span>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{item.tipe}</span>
                                                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                                                <span className="text-[9px] font-black text-black uppercase tracking-widest">{item.category}</span>
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
                                                    <div className={`font-mono text-2xl font-black tabular-nums tracking-tighter ${item.estimasi < 0 ? 'text-rose-500/80 animate-pulse' : 'text-black'}`}>
                                                        {formatTime(item.estimasi)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-black">
                                                            <User size={12} className="text-zinc-400" />
                                                            <span className="text-[10px] font-black uppercase tracking-tight">{item.mechanicName || 'BELUM ASSIGN'}</span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-zinc-500 uppercase line-clamp-1 max-w-[200px] leading-relaxed">
                                                            {item.keluhan || '-'}
                                                        </p>
                                                        {item.checklist && item.checklist.length > 0 && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <div className="flex -space-x-1">
                                                                    {item.checklist.slice(0, 3).map((t, i) => (
                                                                        <div key={i} className={`w-2.5 h-2.5 rounded-full border border-white ${t.completed ? 'bg-emerald-400/80' : 'bg-zinc-200'}`}></div>
                                                                    ))}
                                                                    {item.checklist.length > 3 && <div className="text-[7px] text-zinc-400 font-bold pl-1.5">+{item.checklist.length - 3}</div>}
                                                                </div>
                                                                <span className="text-[8px] font-black text-emerald-600/80 uppercase tracking-tighter">
                                                                    {item.checklist.filter(t => t.completed).length}/{item.checklist.length} TASK
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex justify-end gap-2.5 opacity-100 lg:opacity-40 group-hover:opacity-100 transition-all duration-300">
                                                        {(item.status === 'working' || item.status === 'waiting' || item.status === 'menginap') && (
                                                            <button 
                                                                onClick={() => handleComplete(item)} 
                                                                disabled={isLoadingProcess}
                                                                className={`p-3 min-w-[44px] min-h-[44px] text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center ${isLoadingProcess ? 'bg-zinc-400 cursor-not-allowed' : 'bg-emerald-400/80 hover:bg-black'}`} 
                                                                title="Selesai pengerjaan"
                                                            >
                                                                {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Check size={18} strokeWidth={4} />}
                                                            </button>
                                                        )}
                                                        {item.status !== 'completed' && (
                                                            !isOvernight ? (
                                                                <button onClick={() => setShowOvernightModal(item)} className="p-3 min-w-[44px] min-h-[44px] bg-black hover:bg-zinc-700 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center" title="Set Menginap">
                                                                    <Moon size={18} fill="white" />
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleCancelOvernight(item)} className="p-3 min-w-[44px] min-h-[44px] bg-zinc-600 hover:bg-zinc-700 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center" title="Batal Menginap">
                                                                    <Zap size={18} fill="white" />
                                                                </button>
                                                            )
                                                        )}
                                                         <button onClick={() => editItem(item)} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Edit Data Unit">
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button onClick={() => deleteItem(item.id)} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Remove Task">
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
                            <div className="shrink-0 bg-black text-white px-6 py-3 flex items-center justify-center gap-3 animate-slide-up relative z-40">
                                <AlertCircle size={16} className="animate-bounce" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Sistem Alert: {queue.filter(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap').length} unit melewati batas waktu.</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col bg-white overflow-hidden p-4 md:p-8 gap-4 md:gap-8">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 md:gap-6 shrink-0">
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="bg-black p-3 md:p-4 rounded-[1.5rem] text-white shadow-2xl">
                                <Bookmark size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-3xl font-black text-black uppercase tracking-tighter italic leading-none">Global Booking <span className="text-zinc-400">Master</span></h2>
                                <div className="text-sm md:text-xs font-black text-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div> Authorized Control Center
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3 md:gap-4 w-full xl:w-auto bg-zinc-50 p-3 rounded-[2rem] border border-zinc-100">
                            <div className="relative group w-full md:w-auto">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black group-focus-within:text-black transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    value={bookingSearchTerm}
                                    onChange={(e) => setBookingSearchTerm(e.target.value)}
                                    placeholder="Search Customer, Plate, or VIN..."
                                    className="bg-white border-2 border-zinc-100 pl-14 pr-6 py-3.5 min-h-[44px] rounded-2xl text-sm font-black text-black outline-none focus:border-black focus:ring-8 focus:ring-zinc-100 transition-all w-full md:min-w-[350px] shadow-sm"
                                />
                            </div>
                            <input 
                                type="date"
                                value={bookingDateFilter}
                                onChange={(e) => setBookingDateFilter(e.target.value)}
                                className="bg-white border-2 border-zinc-100 px-6 py-3.5 min-h-[44px] rounded-2xl text-sm md:text-xs font-black text-black uppercase outline-none focus:border-black shadow-sm cursor-pointer"
                            />
                            <div className="h-px md:h-8 w-full md:w-px bg-zinc-200 mx-0 md:mx-2"></div>
                            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                        <button 
                            onClick={() => playNotificationSound("Mobil anda sudah siap Silahkan ke Ruangan  S A")}
                            className="bg-black hover:bg-zinc-700 text-white px-5 py-3 min-h-[44px] rounded-2xl font-black text-sm md:text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg"
                        >
                            <Zap size={16} fill="white" /> Test Notif
                        </button>
                        <button onClick={clearQueue} className="bg-zinc-50 hover:bg-black text-black hover:text-white px-5 py-3 min-h-[44px] rounded-2xl font-black text-sm md:text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 border-2 border-zinc-200 hover:border-black">
                            <Trash2 size={16} /> Clear
                        </button>
                    </div>
                            <button 
                                onClick={() => {
                                    setCreateBookingForm({ tanggal: new Date().toISOString().split('T')[0], jam: '08.30', namaCustomer: '', noTelp: '', tipeMobil: '', noPlat: '', keperluanService: 'Service', vin: '' });
                                    setIsCreateBookingModalOpen(true);
                                }}
                                className="bg-black hover:bg-zinc-800 text-white px-6 md:px-8 py-3.5 min-h-[44px] rounded-2xl font-black text-sm md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-zinc-200 group"
                            >
                                <Plus size={18} className="group-hover:rotate-90 transition-transform" /> New Booking
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white border-2 border-zinc-100 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-black z-30">
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
                                                    <span className="bg-black text-white px-4 py-2 rounded-xl text-[11px] font-black border border-zinc-800 w-fit shadow-lg">
                                                        {new Date(b.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-sm font-black text-black pl-2 flex items-center gap-2">
                                                        <Clock size={14} className="text-zinc-400" /> {b.jam} WIB
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-base text-black uppercase tracking-tight group-hover:text-zinc-600 transition-colors">{b.namaCustomer || 'N/A'}</span>
                                                    <a href={`tel:${b.noTelp}`} className="text-xs font-black text-black underline decoration-zinc-200 hover:decoration-black transition-all">{b.noTelp || '-'}</a>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-black text-black uppercase flex items-center gap-2">
                                                        <Car size={16} className="text-zinc-400" /> {b.noPlat || '-'}
                                                    </span>
                                                    <span className="text-xs font-black text-black tracking-wide">{b.tipeMobil || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 uppercase">
                                                <span className="text-[11px] font-mono font-black text-black tracking-widest bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                                                    {b.vin || 'NO VIN DATA'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-3">
                                                    <div className={`px-5 py-3 rounded-2xl text-[10px] font-black border-2 w-fit shadow-md uppercase tracking-widest
                                                        ${b.keperluanService?.includes('Keluhan') ? 'bg-amber-50/60 text-amber-700/80 border-amber-200/60 shadow-amber-50' : 'bg-emerald-50/60 text-emerald-700/80 border-emerald-200/60 shadow-emerald-50'}`}>
                                                        {b.keperluanService?.split(':')[0]}
                                                    </div>
                                                    {b.keperluanService?.includes('Edited') && (
                                                        <span className="text-[8px] font-black text-zinc-600 bg-zinc-50 px-2 py-1 rounded-md border border-zinc-200 italic">
                                                            {b.keperluanService.split('Edited')[1]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit border-2 shadow-sm
                                                    ${b.status === 'accepted' ? 'bg-emerald-400/70 text-white border-emerald-500/70' : 
                                                      b.status === 'waiting confirm' ? 'bg-amber-300/70 text-white border-amber-400/70 animate-pulse' : 
                                                      b.status === 'declined' ? 'bg-zinc-200 text-zinc-500 border-zinc-300' : 
                                                      b.status === 'completed' ? 'bg-black text-white border-black' : 
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
                                                        className="p-3 min-w-[44px] min-h-[44px] bg-zinc-100 hover:bg-black text-black hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 font-black text-sm md:text-[10px] uppercase tracking-widest"
                                                    >
                                                        <Edit3 size={16} /> <span className="hidden md:inline">EDIT</span>
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            if(window.confirm("Hapus booking ini permanen?")) {
                                                                await db.delete('booking', { eq: { id: b.id } });
                                                                fetchBookings();
                                                                Toastify({ text: "Booking deleted!", background: "red" }).showToast();
                                                            }
                                                        }}
                                                        className="p-3 min-w-[44px] min-h-[44px] bg-zinc-50 hover:bg-black text-zinc-400 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center"
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
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-8">
                            <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-4xl shadow-2xl border-4 border-black overflow-hidden animate-fade-in relative flex flex-col max-h-[90vh]">
                                <div className="p-4 md:p-8 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-lg md:text-2xl font-black uppercase tracking-tighter text-black">Add New Future Booking</h3>
                                        <p className="text-sm md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 italic">Master Admin Override Mode</p>
                                    </div>
                                    <button onClick={() => setIsCreateBookingModalOpen(false)} className="p-3 min-w-[44px] min-h-[44px] bg-white border-2 border-zinc-100 rounded-2xl hover:bg-black hover:text-white transition-all flex items-center justify-center">
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-3">
                                            <label className="text-sm md:text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tanggal Kedatangan</label>
                                            <input type="date" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 min-h-[44px] rounded-2xl font-black text-sm text-black focus:border-black outline-none transition-all" value={createBookingForm.tanggal} onChange={e => setCreateBookingForm({...createBookingForm, tanggal: e.target.value})} />
                                        </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                            <Clock size={12} className="text-black" /> Arrival Slot Selection
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {(() => {
                                                const config = rawBookings.find(b => b.id === 999999);
                                                const slotCount = config ? parseInt(config.namaCustomer) || 4 : 4;
                                                const gapInline = config ? parseInt(config.tipeMobil) || 30 : 30;
                                                const startInline = config?.vin ? (() => { const p = config.vin.split(':'); return { h: parseInt(p[0]) || 8, m: parseInt(p[1]) || 30 }; })() : { h: 8, m: 30 };
                                                const capInline = config?.vin ? (() => { const p = config.vin.split(':'); return p.length >= 3 ? parseInt(p[2]) || 1 : 1; })() : 1;
                                                const allSlots = generateSlots(slotCount, gapInline, startInline.h, startInline.m);
                                                
                                                return allSlots.map(s => {
                                                    const bookingsAtSlot = rawBookings.filter(b => {
                                                        const isDateSame = b.tanggal === createBookingForm.tanggal;
                                                        const isJamSame = normalizeJam(b.jam) === normalizeJam(s);
                                                        const isActive = b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed';
                                                        return b.id !== 999999 && isDateSame && isJamSame && isActive;
                                                    });
                                                    const isFull = bookingsAtSlot.length >= capInline; 
                                                    const isSelected = createBookingForm.jam === s;
                                                    return (
                                                        <button key={s} type="button" disabled={isFull && !isSelected} onClick={() => setCreateBookingForm({...createBookingForm, jam: s})}
                                                            className={`py-3 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5
                                                                ${isSelected ? 'bg-black border-black text-white shadow-lg scale-105 z-10' : 
                                                                  isFull ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-100 shadow-inner' : 
                                                                  'bg-white border-zinc-100 text-black hover:border-black'}`}>
                                                            <span>{s}</span>
                                                            <span className="text-[6px] opacity-70">{bookingsAtSlot.length}/{capInline}</span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <User size={14} className="text-zinc-400" /> Nama Customer
                                            </label>
                                            <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black uppercase focus:border-black outline-none transition-all shadow-inner" value={createBookingForm.namaCustomer} onChange={e => setCreateBookingForm({...createBookingForm, namaCustomer: e.target.value})} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Zap size={14} className="text-zinc-400" /> WhatsApp
                                            </label>
                                            <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all shadow-inner" value={createBookingForm.noTelp} onChange={e => setCreateBookingForm({...createBookingForm, noTelp: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Car size={14} className="text-zinc-400" /> Model Kendaraan
                                            </label>
                                            <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black uppercase focus:border-black outline-none transition-all shadow-inner" value={createBookingForm.tipeMobil} onChange={e => setCreateBookingForm({...createBookingForm, tipeMobil: e.target.value})} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Activity size={14} className="text-zinc-400" /> Nomor Polisi
                                            </label>
                                            <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black uppercase focus:border-black outline-none transition-all shadow-inner" value={createBookingForm.noPlat} onChange={e => setCreateBookingForm({...createBookingForm, noPlat: e.target.value.toUpperCase().replace(/\s+/g, '')})} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                            <FileText size={14} className="text-zinc-400" /> Keperluan Service
                                        </label>
                                        <textarea className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] font-black text-base md:text-xl text-black min-h-[120px] md:min-h-[150px] focus:border-black outline-none transition-all shadow-inner" value={createBookingForm.keperluanService} onChange={e => setCreateBookingForm({...createBookingForm, keperluanService: e.target.value})} />
                                    </div>
                                </div>
                                <div className="p-4 md:p-8 bg-zinc-50 border-t-2 border-zinc-100 flex gap-3 md:gap-4 shrink-0">
                                    <button onClick={() => setIsCreateBookingModalOpen(false)} className="flex-1 py-4 md:py-5 min-h-[44px] bg-white border-2 border-zinc-100 text-zinc-400 rounded-[1.5rem] font-black text-sm md:text-xs uppercase hover:border-black hover:text-black transition-all">Cancel</button>
                                    <button 
                                        onClick={async () => {
                                            if(!createBookingForm.noPlat || !createBookingForm.tipeMobil) return Toastify({text: "Plat dan Tipe Wajib Diisi", background: "red"}).showToast();
                                            const { error: insertError } = await db.insert('booking', [{
                                                id: Date.now(),
                                                ...createBookingForm,
                                                noPlat: createBookingForm.noPlat.toUpperCase().replace(/\s+/g, ''),
                                                status: 'accepted',
                                                bookingVia: `ADMIN / ${user?.name || 'Authorized'}`
                                            }]);
                                            if (insertError) Toastify({ text: "Gagal membuat booking!", background: "red" }).showToast();
                                            else { Toastify({ text: "Booking berhasil dibuat!", background: "zinc-900" }).showToast(); setIsCreateBookingModalOpen(false); fetchBookings(); }
                                        }}
                                        className="flex-[2] py-4 md:py-5 min-h-[44px] bg-black text-white rounded-[1.5rem] font-black text-sm md:text-xs uppercase shadow-2xl shadow-zinc-300 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
                                    >
                                        <PlusCircle size={18} /> Create Final Booking
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDIT BOOKING MODAL */}
                    {isEditBookingModalOpen && editingBooking && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-8">
                            <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-4xl shadow-2xl border-4 border-black overflow-hidden animate-fade-in relative flex flex-col max-h-[90vh]">
                                <div className="p-4 md:p-8 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-lg md:text-2xl font-black uppercase tracking-tighter text-black">Update Booking Details</h3>
                                        <p className="text-sm md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 italic">Master Admin Override Mode</p>
                                    </div>
                                    <button onClick={() => setIsEditBookingModalOpen(false)} className="p-3 min-w-[44px] min-h-[44px] bg-white border-2 border-zinc-100 rounded-2xl hover:bg-black hover:text-white transition-all flex items-center justify-center">
                                        <X size={24} />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Bookmark size={14} className="text-zinc-400" /> Tanggal Kedatangan
                                            </label>
                                            <input 
                                                type="date" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all shadow-inner"
                                                value={editingBooking.tanggal}
                                                onChange={e => setEditingBooking({...editingBooking, tanggal: e.target.value})}
                                            />
                                        </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                            <Clock size={12} className="text-black" /> Arrival Slot Selection
                                        </label>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {(() => {
                                                const config = rawBookings.find(b => b.id === 999999);
                                                const slotCount = config ? parseInt(config.namaCustomer) || 4 : 4;
                                                const gapInline = config ? parseInt(config.tipeMobil) || 30 : 30;
                                                const startInline = config?.vin ? (() => { const p = config.vin.split(':'); return { h: parseInt(p[0]) || 8, m: parseInt(p[1]) || 30 }; })() : { h: 8, m: 30 };
                                                const capInline = config?.vin ? (() => { const p = config.vin.split(':'); return p.length >= 3 ? parseInt(p[2]) || 1 : 1; })() : 1;
                                                const allSlots = generateSlots(slotCount, gapInline, startInline.h, startInline.m);
                                                
                                                return allSlots.map(s => {
                                                    const bookingsAtThisTime = rawBookings.filter(b => 
                                                        b.id !== 999999 && 
                                                        b.id !== editingBooking.id && // Exclude CURRENT booking being edited
                                                        b.tanggal === editingBooking.tanggal && 
                                                        b.jam === s &&
                                                        (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
                                                    );
                                                    const isFull = bookingsAtThisTime.length >= capInline;
                                                    const isSelected = editingBooking.jam === s;

                                                    return (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            disabled={isFull && !isSelected}
                                                            onClick={() => setEditingBooking({...editingBooking, jam: s})}
                                                            className={`py-3 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5
                                                                ${isSelected ? 'bg-black border-black text-white shadow-lg scale-105 z-10' : 
                                                                  isFull ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed opacity-60' : 
                                                                  'bg-white border-zinc-100 text-black hover:border-black'}`}
                                                        >
                                                            <span>{s}</span>
                                                            <span className={`text-[6px] font-black ${isSelected ? 'text-white/60' : isFull ? 'text-zinc-400' : 'text-zinc-300'}`}>
                                                                {isSelected ? 'CURRENT' : isFull ? 'FULL' : `${bookingsAtThisTime.length}/${capInline}`}
                                                            </span>
                                                            {isFull && !isSelected && <div className="absolute inset-0 bg-white/10 backdrop-grayscale-[0.5]"></div>}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <User size={14} className="text-zinc-400" /> Nama Customer
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all uppercase shadow-inner"
                                                value={editingBooking.namaCustomer}
                                                onChange={e => setEditingBooking({...editingBooking, namaCustomer: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Zap size={14} className="text-zinc-400" /> WhatsApp
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all shadow-inner"
                                                value={editingBooking.noTelp}
                                                onChange={e => setEditingBooking({...editingBooking, noTelp: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Car size={14} className="text-zinc-400" /> Model Kendaraan
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all uppercase shadow-inner"
                                                value={editingBooking.tipeMobil}
                                                onChange={e => setEditingBooking({...editingBooking, tipeMobil: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                                <Activity size={14} className="text-zinc-400" /> Nomor Polisi
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-6 min-h-[44px] rounded-2xl font-black text-base md:text-xl text-black focus:border-black outline-none transition-all uppercase shadow-inner"
                                                value={editingBooking.noPlat}
                                                onChange={e => setEditingBooking({...editingBooking, noPlat: e.target.value.toUpperCase().replace(/\s+/g, '')})}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 ml-1 flex items-center gap-2">
                                            <FileText size={14} className="text-zinc-400" /> Keperluan Service
                                        </label>
                                        <textarea 
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] font-black text-base md:text-xl text-black focus:border-black outline-none transition-all min-h-[120px] md:min-h-[150px] shadow-inner"
                                            value={editingBooking.keperluanService}
                                            onChange={e => setEditingBooking({...editingBooking, keperluanService: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 md:p-8 bg-zinc-50 border-t-2 border-zinc-100 flex gap-3 md:gap-4 shrink-0">
                                    <button onClick={() => setIsEditBookingModalOpen(false)} className="flex-1 py-4 md:py-5 min-h-[44px] bg-white border-2 border-zinc-100 text-zinc-400 rounded-[1.5rem] font-black text-sm md:text-xs uppercase tracking-widest hover:border-black hover:text-black transition-all">Cancel</button>
                                    <button 
                                        onClick={async () => {
                                            const auditStamp = ` | Sudah di edit oleh ${user?.name || 'Admin'} pada ${new Date().toLocaleTimeString('id-id')}`;
                                            const finalNote = editingBooking.keperluanService.includes(' | Sudah di edit') 
                                                ? editingBooking.keperluanService.split(' | Sudah di edit')[0] + auditStamp
                                                : editingBooking.keperluanService + auditStamp;
                                            
                                            const { error } = await db.update('booking', {
                                                    ...editingBooking,
                                                    noPlat: editingBooking.noPlat.toUpperCase().replace(/\s+/g, ''),
                                                    keperluanService: finalNote,
                                                    bookingVia: `${editingBooking.bookingVia} (Edited by ${user?.name || 'Admin'})`
                                                }, { eq: { id: editingBooking.id } });
                                            
                                            if (error) {
                                                Toastify({ text: "Gagal update!", background: "red" }).showToast();
                                            } else {
                                                Toastify({ text: "Booking updated & logged!", background: "zinc-900" }).showToast();
                                                setIsEditBookingModalOpen(false);
                                                fetchBookings();
                                            }
                                        }}
                                        className="flex-[2] py-4 md:py-5 min-h-[44px] bg-black text-white rounded-[1.5rem] font-black text-sm md:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-zinc-300 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
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
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 md:p-8 border border-zinc-100 animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-bl-full -z-10"></div>
                        <h3 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center gap-3">
                            <div className="bg-black p-2 rounded-xl text-white"><Moon size={20} fill="white" /></div>
                            Menginap Karena:
                        </h3>

                        <div className="space-y-3 mb-8">
                            {['Masih belum siap', 'Menunggu part datang'].map(opt => (
                                <button key={opt} onClick={() => { setOvernightReason(opt); setCustomReason(''); }}
                                    className={`w-full p-4 min-h-[44px] rounded-xl font-bold text-sm text-left transition-all border-2 ${overnightReason === opt ? 'bg-black text-white border-black shadow-lg' : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200 hover:bg-zinc-200'}`}>
                                    {opt}
                                </button>
                            ))}
                            <div className="pt-2">
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 mb-2 block">Atau Input Alasan Lain:</label>
                                <input type="text" placeholder="Tulis alasan custom..." className="w-full bg-zinc-50 border border-zinc-200 p-4 min-h-[44px] rounded-xl text-sm font-bold focus:bg-white focus:border-black outline-none transition-all shadow-inner"
                                    value={customReason} onChange={(e) => { setCustomReason(e.target.value); setOvernightReason(''); }} />
                            </div>

                            {(overnightReason || customReason) && (
                                <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Preview Alasan:</p>
                                    <p className="text-xs font-bold text-black italic">"{overnightReason || customReason}"</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => { setShowOvernightModal(null); setOvernightReason(''); setCustomReason(''); }} className="flex-1 py-4 min-h-[44px] bg-zinc-100 text-zinc-500 rounded-xl font-black text-sm md:text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">Batal</button>
                            <button onClick={() => { handleSetOvernight(showOvernightModal, overnightReason || customReason); setShowOvernightModal(null); setOvernightReason(''); setCustomReason(''); }}
                                disabled={!overnightReason && !customReason}
                                className="flex-1 py-4 min-h-[44px] bg-black text-white rounded-xl font-black text-sm md:text-xs uppercase tracking-widest shadow-lg hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:grayscale">Konfirmasi</button>
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
                        <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col border border-zinc-100 animate-fade-in relative overflow-hidden text-black">
                            <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="bg-black p-2.5 rounded-xl text-white shadow-lg"><FileText size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight leading-none">{currentItem.bk}</h3>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1.5">{currentItem.tipe}  Tasks & Checklist</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowChecklistModal(null)} className="p-2 bg-white text-zinc-400 hover:text-black rounded-lg border border-zinc-200 shadow-sm transition-all"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {/* ADD TASK (Admin Only) */}
                                {user?.role === 'admin' && (
                                    <div className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-inner">
                                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 mb-2 block">Tambah Keluhan / Task Maintenance:</label>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Contoh: Lampu rem mati, Ganti oli filter..."
                                                className="flex-1 bg-white border border-zinc-200 p-4 min-h-[44px] rounded-xl text-sm font-bold focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all shadow-sm"
                                                value={newTask} onChange={(e) => setNewTask(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && newTask && (handleAddTask(currentItem, newTask), setNewTask(''))} />
                                            <button onClick={() => newTask && (handleAddTask(currentItem, newTask), setNewTask(''))}
                                                className="bg-black text-white px-6 min-w-[44px] min-h-[44px] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all shadow-lg active:scale-90 flex items-center justify-center">
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
                                                        <span className={`text-sm font-bold uppercase tracking-tight ${t.completed ? 'text-emerald-700/80 line-through opacity-60' : 'text-black'}`}>{t.text}</span>
                                                    </div>
                                                    {user?.role === 'admin' && (
                                                        <button onClick={() => handleRemoveTask(currentItem, t.id)} className="p-2 text-zinc-300 hover:text-black hover:bg-zinc-100 rounded-lg transition-all">
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {user?.role !== 'mekanik' && checklistItems.length > 0 && (
                                        <p className="text-center text-[10px] font-bold text-zinc-400 mt-6 bg-zinc-50 py-3 rounded-xl border border-zinc-100">Hanya <span className="text-black font-black">Role Mekanik</span> yang bisa mencentang task.</p>
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
