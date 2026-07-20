import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Plus, Edit3, Bookmark, Zap, AlertCircle, CheckCircle2, Trash2, Check, Moon, X, Clock, Activity, UserCog, FileText, PlusCircle, CheckCircle, Trash, Search, ChevronDown, Car, ShieldCheck, Info, Megaphone, Upload, Download, Loader, Database, Droplets, Key } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import TimeInput from './TimeInput';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import PublicBooking from './PublicBooking';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';

const CAR_MODELS = [
    "OMODA 5", "OMODA 5 EV", "OMODA 5 GT", "CHERY C5", "CHERY C5 CSH",
    "TIGGO 5X", "TIGGO CROSS", "TIGGO CROSS CSH", "TIGGO 7 PRO", "TIGGO 8",
    "TIGGO 8 PRO", "TIGGO 8 PRO MAX", "TIGGO 8 CSH", "TIGGO 9 CSH",
    "J6 IWD", "J6 RWD", "J6T", "J5", "J7 SHS", "J7 ICE", "J8 SHS"
];

const normalizeJam = (j) => {
    if (!j) return "";
    const sj = String(j).replace(':', '.');
    const parts = sj.split('.');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] || '00').padEnd(2, '0');
    return `${h}.${m}`;
};

const AdminPanel = ({ user, handleLogout, handleChangePassword, queue, rawHistory = [], deleteItem, clearQueue, editItem, handleSave, handleCancelEdit, formData, setFormData, isEditing, setIsEditing, errorMessage, isLoadingProcess, formatTime, handleComplete, handleConfirmCompletion, handleSetOvernight, handleCancelOvernight, breakSettings, setBreakSettings, handleAddTask, handleRemoveTask, handleToggleTask, playNotificationSound, handleCallQueue, activeTab: activeTabProp, callCooldown = 120, onApproveExtension, onRejectExtension, handleStartCuci, handleCompleteCuci, showJenis = true, showChecklist = true }) => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [bookingConfigState, setBookingConfigState] = useState({ slotCount: 8, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1 });
    const [currentDay, setCurrentDay] = useState(new Date().toDateString());
    const [adminCounter, setAdminCounter] = useState(() => {
        return parseInt(localStorage.getItem('chery_admin_counter')) || 0;
    });
    const [regulerStartNum, setRegulerStartNum] = useState(6);
    const [showQueueSettings, setShowQueueSettings] = useState(false);

    useEffect(() => {
        db.select('settings', { eq: { key: 'reguler_start_number' }, maybeSingle: true }).then(({ data }) => {
            if (data?.value) setRegulerStartNum(parseInt(data.value));
        });
    }, []);

    const saveRegulerStartNum = async () => {
        const num = Math.max(2, parseInt(regulerStartNum) || 6);
        setRegulerStartNum(num);
        await db.upsert('settings', { key: 'reguler_start_number', value: String(num) }, { onConflict: 'key' });
        Toastify({ text: `✅ Nomor awal Reguler: ${num} (Booking 1-${num - 1})`, style: { background: "#000", borderRadius: "12px" } }).showToast();
    };

    const selectCounter = (c) => {
        setAdminCounter(c);
        localStorage.setItem('chery_admin_counter', String(c));
        Toastify({ text: `✅ Anda memilih Counter ${c}`, style: { background: "#000000", borderRadius: "12px" } }).showToast();
    };

    const [tick, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const getCooldownSisa = (calledAt) => {
        if (!calledAt) return 0;
        const elapsed = Date.now() - new Date(calledAt).getTime();
        return Math.max(0, callCooldown - Math.floor(elapsed / 1000));
    };

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
    const [dmsTodayBookings, setDmsTodayBookings] = useState([]);
    const [dmsMasterBookings, setDmsMasterBookings] = useState([]);

    const normalizeBK = useCallback((bk) => (bk || '').replace(/\s+/g, '').toUpperCase(), []);

    const cleanupPastBookings = useCallback(async () => {
        // No longer delete past bookings — they are kept for audit trail
    }, []);

    const fetchDmsToday = useCallback(async () => {
        try {
            const today = new Date().toLocaleDateString('en-CA');
            const res = await fetch(`/api/chery_dms?endpoint=booking-data&draw=1&start=0&length=200&datefrom=${today}&dateto=${today}&_=${Date.now()}`);
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
                setDmsTodayBookings(json.data);
            }
        } catch (e) {
            console.warn('Gagal fetch DMS hari ini:', e);
        }
    }, []);

    const fetchBookings = useCallback(async () => {
        try {
            await cleanupPastBookings();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

            const { data, error } = await db.select('booking', { select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, status, bookingVia, vin, noTelp, noUrut', gte: { tanggal: dateStr } });
            if (error) throw error;
            if (Array.isArray(data)) setRawBookings(data);

            // === Fetch DMS internal bookings for master table ===
            try {
                const today = new Date().toLocaleDateString('en-CA');
                const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&draw=1&start=0&length=500&datefrom=${dateStr}&dateto=${today}&_=${Date.now()}`);
                if (dmsRes.ok) {
                    const dmsJson = await dmsRes.json();
                    if (Array.isArray(dmsJson.data)) {
                        const normalized = dmsJson.data.map(b => {
                            const sBooking = (b.status_booking || '').toLowerCase();
                            if (['batal', 'expired', 'declined'].includes(sBooking)) return null;
                            const tanggal = (b.janji_datang || '').trim().split(' ')[0] || '';
                            const jamRaw = (b.janji_datang || '').trim().split(' ')[1] || '00:00';
                            const jam = jamRaw.slice(0, 5).replace(':', '.');
                            // Parse DD/MM/YYYY to YYYY-MM-DD
                            const parts = tanggal.split('/');
                            const tgl = parts.length === 3 && parts[2].length === 4 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : tanggal;
                            return {
                                id: `dms_${b.no_booking || b.id || Math.random()}`,
                                _isDms: true,
                                tanggal: tgl,
                                jam,
                                noPlat: b.no_polisi || '',
                                namaCustomer: b.nama_pelanggan || '',
                                tipeMobil: b.nama_kendaraan || '',
                                keperluanService: '',
                                status: 'accepted',
                                bookingVia: b.booking_via || 'DMS Internal',
                                vin: b.no_chassis || '',
                                noTelp: b.no_telp_booking || '',
                            };
                        }).filter(Boolean).filter(b => b.tanggal >= dateStr);
                        setDmsMasterBookings(normalized);
                    }
                }
            } catch (dmsErr) {
                console.warn('Gagal fetch DMS master bookings:', dmsErr);
            }
        } catch (e) {
            console.error('Gagal fetch booking:', e);
        }
    }, [cleanupPastBookings]);

    // Fetch booking config once on mount
    useEffect(() => {
        fetchBookingConfig().then(setBookingConfigState).catch(() => {});
    }, []);

    // 1. Subscribe ONLY ONCE on mount
    useEffect(() => {
        fetchBookings();
        fetchDmsToday();
        const bookingSub = supabase
            .channel('admin-booking-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, () => {
                fetchBookings();
            })
            .subscribe();

        return () => { supabase.removeChannel(bookingSub); };
    }, [fetchBookings, fetchDmsToday]);

    // 2. Process data locally when rawBookings, queue, or rawHistory change
    // Get config slot count for showing all slots
    const { slotCount: maxSlotsAdmin, gapMinutes: gapAdmin, startHour: startAdminH, startMinute: startAdminM, slotCapacity: slotCapacityAdmin } = bookingConfigState;
    const allSlots = useMemo(() => generateSlots(maxSlotsAdmin, gapAdmin, startAdminH, startAdminM), [maxSlotsAdmin, gapAdmin, startAdminH, startAdminM]);

    // Refresh if day changes (midnight)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().toDateString();
            if (now !== currentDay) {
                setCurrentDay(now);
                fetchBookings();
                fetchDmsToday();
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [currentDay, fetchBookings, fetchDmsToday]);

    // Normalize DMS bookings to match Supabase format and merge
    const mergedTodayBookings = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
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

        const normalizedDms = dmsTodayBookings.map(row => {
            const rawTanggal = row.janji_datang?.split(' ')[0] || todayStr;
            const rawJam = row.janji_datang?.split(' ')[1]?.slice(0, 5).replace(':', '.') || '08.00';
            const dmy = rawTanggal.split('/');
            const tanggal = dmy.length === 3 && dmy[2].length === 4 ? `${dmy[2]}-${dmy[1].padStart(2, '0')}-${dmy[0].padStart(2, '0')}` : rawTanggal;
            return {
            id: row.id_booking || `dms-${Date.now()}-${Math.random()}`,
            tanggal,
            jam: rawJam,
            noPlat: row.no_polisi || '-',
            namaCustomer: row.nama_pelanggan || '-',
            tipeMobil: row.nama_kendaraan || '-',
            keperluanService: row.keluhan || '-',
            status: row.status_booking === 'Batal' ? 'cancelled' : 'accepted',
            bookingVia: row.booking_via || 'DMS Internal',
            vin: row.no_chassis || '',
            noTelp: row.no_telp_booking || '',
            noUrut: 0,
            _source: 'dms'
        };
        });

        // Merge with dedup: Supabase first (has edit/delete), DMS only if not already in Supabase
        const dedupKey = (b) => `${normalizeBK(b.noPlat)}_${b.tanggal}_${String(b.jam).replace(':', '.')}`;
        const seenKeys = new Set();
        const allForToday = [];
        rawBookings.forEach(b => {
            const key = dedupKey(b);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allForToday.push(b);
            }
        });
        normalizedDms.forEach(b => {
            const key = dedupKey(b);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allForToday.push(b);
            }
        });
        return allForToday;
    }, [dmsTodayBookings, rawBookings]);

    const todayBookings = useMemo(() => {
        if (!Array.isArray(mergedTodayBookings)) return [];
        
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
        const bookedEntries = mergedTodayBookings
            .filter(b => isSameDay(b.tanggal, todayStr) && b.status !== 'completed' && b.status !== 'declined' && b.status !== 'deleted' && b.status !== 'cancelled')
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

    const handleConfirmBooking = (booking) => {
        if (booking.status !== 'accepted') {
            Toastify({
                text: `⚠️ Booking ${booking.noPlat} belum dikonfirmasi! Harap konfirmasi booking terlebih dahulu sebelum masuk antrian.`,
                duration: 5000,
                style: { background: "#f59e0b", borderRadius: "12px", fontWeight: "900" }
            }).showToast();
            return;
        }
        setFormData({
            ...formData,
            bk: (booking.noPlat || '').toUpperCase().replace(/\s+/g, ''),
            tipe: (booking.tipeMobil || '').toUpperCase(),
            category: 'Booking',
            keluhan: booking.keperluanService || '',
            jam: 0, menit: 30, detik: 0, mechanicName: ''
        });
        fetchVehicleByPlate((booking.noPlat || '').toUpperCase().replace(/\s+/g, ''));
    };

    const [activeTab, setActiveTab] = useState(activeTabProp || 'dashboard'); // 'dashboard' or 'booking'

    // Sync activeTab with prop
    useEffect(() => {
      if (activeTabProp && activeTabProp !== activeTab) {
        setActiveTab(activeTabProp);
      }
    }, [activeTabProp]);

    const [holidays, setHolidays] = useState([]);

    useEffect(() => { fetchHolidays().then(setHolidays); }, []);

    const [bookingSearchTerm, setBookingSearchTerm] = useState('');
    const [bookingDateFilter, setBookingDateFilter] = useState('');
    const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [isCreateBookingModalOpen, setIsCreateBookingModalOpen] = useState(false);
    const [createBookingForm, setCreateBookingForm] = useState({ tanggal: new Date().toISOString().split('T')[0], jam: '08.30', namaCustomer: '', noTelp: '', tipeMobil: '', noPlat: '', keperluanService: 'Service', vin: '' });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const allMasterBookings = useMemo(() => {
        // Merge with dedup: Supabase first (has edit/delete), DMS only if not already in Supabase
        const dedupKey = (b) => `${normalizeBK(b.noPlat)}_${b.tanggal}_${String(b.jam || '').replace(':', '.')}`;
        const seenKeys = new Set();
        const merged = [];
        rawBookings.forEach(b => {
            const key = dedupKey(b);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(b);
            }
        });
        dmsMasterBookings.forEach(b => {
            const key = dedupKey(b);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(b);
            }
        });
        return merged;
    }, [dmsMasterBookings, rawBookings, normalizeBK]);

    const filteredMasterBookings = useMemo(() => {
        return allMasterBookings
            .filter(b => {
                const searchStr = `${b.namaCustomer} ${b.noPlat} ${b.vin} ${b.keperluanService}`.toLowerCase();
                const matchesSearch = searchStr.includes(bookingSearchTerm.toLowerCase());
                const matchesDate = bookingDateFilter ? b.tanggal === bookingDateFilter : true;
                return matchesSearch && matchesDate;
            })
            .sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    }, [allMasterBookings, bookingSearchTerm, bookingDateFilter]);

    const fetchVehicleByPlate = async (plat) => {
        if (!plat || plat.length < 3) return;
        try {
            const res = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${encodeURIComponent(plat)}&_type=query&q=${encodeURIComponent(plat)}`);
            if (!res.ok) return;
            const json = await res.json();
            const matched = Array.isArray(json) && json.find(v =>
                (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === plat.toUpperCase().replace(/\s+/g, '')
            );
            if (matched) {
                setFormData(prev => ({
                    ...prev,
                    tipe: (matched.nama_kendaraan || matched.tipe_kendaraan || prev.tipe || '').toUpperCase(),
                }));
            }
        } catch (e) {
            console.warn('Gagal fetch kendaraan:', e);
        }
    };

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
                    <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                        {[1, 2, 3].map(c => (
                            <button key={c} onClick={() => selectCounter(c)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all min-w-[44px] min-h-[36px] ${adminCounter === c ? 'bg-black text-white shadow-md' : 'text-zinc-400 hover:text-black'}`}
                            >
                                C{c}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowPasswordModal(true)}
                          className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-all active:scale-95"
                          title="Ganti Password">
                          <Key size={16} />
                        </button>
                        <button onClick={() => setShowQueueSettings(!showQueueSettings)}
                            className="p-2 rounded-xl hover:bg-zinc-100 transition-all text-zinc-400 hover:text-black">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                        </button>
                        {showQueueSettings && (
                            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 shadow-sm">
                                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap">Reguler Mulai</span>
                                <input type="number" min="2" max="99"
                                    value={regulerStartNum}
                                    onChange={e => setRegulerStartNum(parseInt(e.target.value) || 6)}
                                    className="w-12 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-black text-black outline-none focus:border-black text-center"
                                />
                                <span className="text-[8px] font-bold text-zinc-400 whitespace-nowrap">Booking 1-{regulerStartNum - 1}</span>
                                <button onClick={saveRegulerStartNum}
                                    className="px-2.5 py-1 bg-black text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-95 whitespace-nowrap">
                                    Simpan
                                </button>
                            </div>
                        )}
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
                                                ) : !b.isEmpty && b.status === 'dipindahkan_reguler' ? (
                                                    <div className="ml-10 mt-1 flex flex-col gap-1">
                                                        <span className="bg-amber-400/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-0.5 w-fit border border-amber-300/50">
                                                            <AlertCircle size={8} /> Terlambat 30m+
                                                        </span>
                                                        <span className="text-[7px] font-bold text-amber-600 uppercase italic leading-none">Dipindahkan ke Reguler</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            {!b.isEmpty ? (
                                                b.status === 'accepted' ? (
                                                <button onClick={() => !b.isArrived && handleConfirmBooking(b)} className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg transition-all flex items-center justify-center shadow-md active:scale-95 ${b.isArrived ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-black hover:bg-zinc-700 text-white'}`}>
                                                    <Plus size={16} strokeWidth={4} />
                                                </button>
                                                ) : (
                                                <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center cursor-not-allowed" title="Booking perlu dikonfirmasi admin/SA dulu">
                                                    <AlertCircle size={16} className="text-amber-400" />
                                                </div>
                                                )
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

                {/* 2. FORM INPUT — REDESIGNED */}
                <div className={`col-span-1 md:col-span-12 lg:col-span-8 lg:row-span-7 bg-white rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${isEditing ? 'border-black ring-4 ring-black/10 shadow-lg' : 'border-zinc-200 shadow-sm'}`}>
                    <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl text-white shadow-sm ${isEditing ? 'bg-black' : 'bg-black'}`}>
                                {isEditing ? <Activity size={16} /> : <Plus size={16} />}
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-black">
                                    {isEditing ? 'Edit Unit' : 'Daftarkan Unit'}
                                </h2>
                                <p className="text-[10px] text-zinc-400 font-semibold">
                                    {isEditing ? 'Koreksi data kendaraan' : 'Input data unit baru'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {errorMessage && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{errorMessage}</span>}
                            {isEditing && (
                                <button onClick={handleCancelEdit} className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-xl transition-all" title="Cancel">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 flex flex-col lg:flex-row gap-6">
                        {/* LEFT — Main Fields */}
                        <div className="flex-1 space-y-5">
                            {/* Row: Plat + No Telp + Tipe + Mekanik */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">No. Polisi</label>
                                    <input type="text" value={formData.bk}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase().replace(/\s+/g, '');
                                            setFormData({ ...formData, bk: val, ...(val ? {} : { tipe: '' }) });
                                            if (val.length >= 3) fetchVehicleByPlate(val);
                                        }}
                                        placeholder="BK 1234 XX"
                                        className="w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-black transition-all uppercase" />
                                </div>
                                <div className="relative" ref={dropdownRef}>
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tipe Mobil</label>
                                    <div onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white transition-all ${isTypeDropdownOpen ? 'border-black bg-white' : ''}`}>
                                        <span className={`text-sm font-bold uppercase ${formData.tipe ? 'text-black' : 'text-zinc-400'}`}>
                                            {formData.tipe || 'Pilih'}
                                        </span>
                                        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                    {isTypeDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-[60] overflow-hidden">
                                            <div className="p-2 border-b border-zinc-100">
                                                <input autoFocus placeholder="Cari..." value={typeSearchTerm}
                                                    onChange={(e) => setTypeSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:border-black" />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-1">
                                                {CAR_MODELS.filter(m => m.toLowerCase().includes(typeSearchTerm.toLowerCase())).map((model, i) => (
                                                    <button key={i} onClick={() => { setFormData({ ...formData, tipe: model }); setIsTypeDropdownOpen(false); setTypeSearchTerm(''); }}
                                                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-black hover:text-white transition-all">
                                                        {model}
                                                    </button>
                                                ))}
                                                {CAR_MODELS.filter(m => m.toLowerCase().includes(typeSearchTerm.toLowerCase())).length === 0 && (
                                                    <div className="p-3 text-center">
                                                        <p className="text-[10px] text-zinc-400 font-bold mb-2">Tidak ditemukan</p>
                                                        <button onClick={() => { setFormData({ ...formData, tipe: typeSearchTerm.toUpperCase() }); setIsTypeDropdownOpen(false); setTypeSearchTerm(''); }}
                                                            className="text-[10px] font-bold text-black border border-black px-3 py-1.5 rounded-full hover:bg-black hover:text-white transition-all">
                                                            Pakai "{typeSearchTerm.toUpperCase()}"
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="relative" ref={mechanicDropdownRef}>
                                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Mekanik</label>
                                    <div onClick={() => setIsMechanicDropdownOpen(!isMechanicDropdownOpen)}
                                        className={`w-full bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white transition-all ${isMechanicDropdownOpen ? 'border-black bg-white' : ''}`}>
                                        <span className={`text-sm font-bold uppercase ${formData.mechanicName ? 'text-black' : 'text-zinc-400'}`}>
                                            {formData.mechanicName || 'Pilih'}
                                        </span>
                                        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isMechanicDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                    {isMechanicDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-[60] overflow-hidden">
                                            <div className="max-h-48 overflow-y-auto p-1">
                                                <button onClick={() => { setFormData({ ...formData, mechanicName: '' }); setIsMechanicDropdownOpen(false); }}
                                                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:bg-zinc-100 transition-all">
                                                    -- Belum Assign --
                                                </button>
                                                {mechanics.map((m, i) => (
                                                    <button key={i} onClick={() => {
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
                                                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-black hover:text-white transition-all flex items-center justify-between">
                                                        {m.name}
                                                        {formData.mechanicName === m.name && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Row: Category */}
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Kategori</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Booking', 'Reguler'].map(cat => (
                                        <button key={cat} onClick={() => setFormData({ ...formData, category: cat })}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border-2 ${formData.category === cat ? 'bg-black text-white border-black shadow-md' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Row: Cuci Mobil */}
                            <div className="flex items-center gap-3 bg-teal-50 border-2 border-teal-200 rounded-2xl px-5 py-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.cuci ? 'bg-teal-600' : 'bg-zinc-200'}`}>
                                    <Droplets size={20} className={formData.cuci ? 'text-white' : 'text-zinc-400'} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-black text-teal-800 uppercase tracking-tight block leading-tight">Cuci Mobil</label>
                                    <p className="text-[9px] font-bold text-teal-600/70">{formData.cuci ? 'Akan dicuci setelah servis' : 'Tidak perlu cuci'}</p>
                                </div>
                                <button onClick={() => setFormData({ ...formData, cuci: !formData.cuci })}
                                    className={`relative w-14 h-7 rounded-full transition-all border-2 ${formData.cuci ? 'bg-teal-600 border-teal-700' : 'bg-zinc-100 border-zinc-200'}`}>
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all ${formData.cuci ? 'left-[30px]' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Row: Jenis Pekerjaan */}
                            {showJenis && (
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Jenis Pekerjaan</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {[
                                            { label: '5.000', hours: 0.75 },
                                            { label: '10.000', hours: 1.2 },
                                            { label: '15.000', hours: 1.2 },
                                            { label: '20.000', hours: 1.8 },
                                            { label: '30.000', hours: 1.8 },
                                            { label: '40.000', hours: 1.8 },
                                            { label: '45.000', hours: 1.2 },
                                            { label: '50.000', hours: 1.2 },
                                            { label: '60.000', hours: 2.5 },
                                        ].map((svc) => {
                                            const isSelected = (formData.jenisPekerjaan || []).includes(svc.label);
                                            return (
                                                <button key={svc.label} onClick={() => {
                                                    const current = formData.jenisPekerjaan || [];
                                                    const nonMileage = current.filter(t => !['5.000', '10.000', '15.000', '20.000', '30.000', '40.000', '45.000', '50.000', '60.000'].includes(t));
                                                    const next = isSelected ? nonMileage : [...nonMileage, svc.label];
                                                    setFormData({
                                                        ...formData,
                                                        jenisPekerjaan: next,
                                                        ...(isSelected ? {} : {
                                                            jam: Math.floor(svc.hours),
                                                            menit: Math.round((svc.hours % 1) * 60),
                                                            detik: 0
                                                        })
                                                    });
                                                }}
                                                    className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all border ${isSelected ? 'bg-black text-white border-black shadow-md' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}>
                                                    {svc.label} KM
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {['Keluhan', 'Update Software', 'General Check Up', 'Service 1000km'].map(type => (
                                            <button key={type} onClick={() => {
                                                const current = formData.jenisPekerjaan || [];
                                                const isSelected = current.includes(type);
                                                const next = isSelected ? current.filter(t => t !== type) : [...current, type];
                                                setFormData({ ...formData, jenisPekerjaan: next });
                                            }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border-2 ${(formData.jenisPekerjaan || []).includes(type) ? 'bg-black text-white border-black shadow-md' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}>
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {(formData.jenisPekerjaan || []).length > 0 && (
                                    <textarea placeholder="Deskripsi keluhan / detail pekerjaan..." value={formData.keluhan || ''} onChange={(e) => setFormData({ ...formData, keluhan: e.target.value })}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-black focus:bg-white transition-all min-h-[60px] mt-2" />
                                )}
                            </div>
                            )}

                            {/* Checklist */}
                            {showChecklist && (
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Job Checklist</label>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" placeholder="Tambah item pekerjaan..."
                                        className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-black focus:bg-white transition-all"
                                        id="initialTaskInput"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value.trim();
                                                if (val) {
                                                    setFormData(prev => ({ ...prev, checklist: [...(prev.checklist || []), { id: Date.now(), text: val, completed: false }] }));
                                                    e.target.value = '';
                                                }
                                            }
                                        }} />
                                    <button onClick={() => {
                                        const input = document.getElementById('initialTaskInput');
                                        const val = input.value.trim();
                                        if (val) {
                                            setFormData(prev => ({ ...prev, checklist: [...(prev.checklist || []), { id: Date.now(), text: val, completed: false }] }));
                                            input.value = '';
                                        }
                                    }} className="bg-black text-white px-4 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shrink-0">+</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(formData.checklist || []).length === 0 ? (
                                        <p className="text-xs text-zinc-300 italic py-1">Belum ada item</p>
                                    ) : (
                                        formData.checklist.map((t, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg">
                                                <span className="text-xs font-bold text-black truncate max-w-[140px]">{t.text}</span>
                                                <button onClick={() => setFormData({ ...formData, checklist: formData.checklist.filter((_, i) => i !== idx) })} className="text-zinc-300 hover:text-red-500 transition-all p-0.5">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            )}

                            {/* Reason Menginap (edit mode only) */}
                            {isEditing && formData.status === 'menginap' && (
                                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Alasan Menginap</label>
                                    <textarea rows="2" placeholder="Alasan menginap..."
                                        className="w-full bg-white border border-purple-200 px-4 py-2.5 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-all resize-none"
                                        value={formData.menginap_reason || ''}
                                        onChange={(e) => setFormData({ ...formData, menginap_reason: e.target.value.toUpperCase() })} />
                                </div>
                            )}
                        </div>

                        {/* RIGHT — Duration + Submit */}
                        <div className="w-full lg:w-56 shrink-0 space-y-4">
                            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center mb-3">Estimasi Durasi</label>
                                <div className="flex items-center justify-center gap-1.5">
                                    <TimeInput label="Jam" value={formData.jam} max={23} onChange={(val) => setFormData({ ...formData, jam: val })} />
                                    <span className="text-zinc-300 font-bold text-lg shrink-0">:</span>
                                    <TimeInput label="Menit" value={formData.menit} max={59} onChange={(val) => setFormData({ ...formData, menit: val })} />
                                    <span className="text-zinc-300 font-bold text-lg shrink-0">:</span>
                                    <TimeInput label="Detik" value={formData.detik} max={59} onChange={(val) => setFormData({ ...formData, detik: val })} />
                                </div>
                                <div className="mt-3 pt-3 border-t border-zinc-200 flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Selesai</span>
                                    <span className="text-sm font-bold text-black">{totalDetik >= 1800 ? previewSelesai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</span>
                                </div>
                            </div>

                            <button onClick={handleSave}
                                className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-black text-white hover:bg-zinc-800">
                                {isEditing ? <CheckCircle2 size={18} /> : <Zap size={18} />}
                                {isEditing ? 'Simpan Perubahan' : 'Aktifkan Unit'}
                            </button>
                        </div>
                    </div>
                </div>

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

                    {/* Mobile Extension Requests */}
                    {queue.filter(q => q.status === 'request_extension').length > 0 && (
                        <div className="md:hidden bg-amber-50 border-2 border-amber-200 rounded-2xl mx-4 p-4 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                                <Clock size={14} /> Request Tambah Waktu
                            </p>
                            {queue.filter(q => q.status === 'request_extension').map(req => {
                                const extraData = req.pendingExtra ? (typeof req.pendingExtra === 'string' ? JSON.parse(req.pendingExtra) : req.pendingExtra) : null;
                                const extraDuration = extraData?.duration || 1800;
                                const extraReason = extraData?.reason || req.menginap_reason?.replace('[TAMBAH WAKTU] ', '') || '';
                                return (
                                    <div key={req.id} className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 border border-amber-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-zinc-900">{req.bk} +{Math.floor(extraDuration / 60)}m</p>
                                            <p className="text-[8px] font-bold text-zinc-500 truncate">{extraReason}</p>
                                            <p className="text-[7px] font-black text-zinc-400 mt-0.5">
                                                <span className="text-amber-600">{req.mechanicName || '-'}</span>
                                                {extraData?.mechanic && extraData.mechanic !== req.mechanicName && <span className="text-zinc-400"> via Foreman ({extraData.mechanic})</span>}
                                            </p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button onClick={() => onApproveExtension(req, extraDuration, extraReason)} className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-[8px] uppercase tracking-widest">Setujui</button>
                                            <button onClick={() => onRejectExtension(req)} className="px-3 py-2 bg-red-500 text-white rounded-xl font-black text-[8px] uppercase tracking-widest">Tolak</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* Desktop Extension Requests */}
                    {queue.filter(q => q.status === 'request_extension').length > 0 && (
                        <div className="hidden md:block bg-amber-50 border-b-2 border-amber-200 px-6 py-3 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                                <Clock size={14} /> Request Tambah Waktu
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {queue.filter(q => q.status === 'request_extension').map(req => {
                                    const extraData = req.pendingExtra ? (typeof req.pendingExtra === 'string' ? JSON.parse(req.pendingExtra) : req.pendingExtra) : null;
                                    const extraDuration = extraData?.duration || 1800;
                                    const extraReason = extraData?.reason || req.menginap_reason?.replace('[TAMBAH WAKTU] ', '') || '';
                                    return (
                                        <div key={req.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 border border-amber-200 shadow-sm">
                                            <div className="flex items-center gap-2 text-xs font-black text-zinc-900">
                                                <span>{req.bk}</span>
                                                <span className="text-amber-600">+{Math.floor(extraDuration / 60)}m</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-zinc-500 truncate max-w-[200px]">{extraReason}</span>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button onClick={() => onApproveExtension(req, extraDuration, extraReason)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[8px] uppercase tracking-widest transition-all">Setujui</button>
                                                <button onClick={() => onRejectExtension(req)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest transition-all">Tolak</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Mobile Queue Cards */}
                    <div className="md:hidden space-y-3 p-4">
                        {queue.length === 0 ? (
                            <div className="py-10 text-center text-zinc-300 font-bold uppercase text-[10px] tracking-widest">Belum ada unit diproses</div>
                        ) : (
                            queue.map((item, index) => {
                                const statusColors = {
                                    'working': 'bg-blue-600 text-white',
                                    'waiting': 'bg-amber-500 text-white',
                                    'completed': 'bg-emerald-500 text-white',
                                    'menunggu_konfirmasi': 'bg-amber-400 text-white',
                                    'menginap': 'bg-purple-700 text-white',
                                    'request_extension': 'bg-amber-600 text-white',
                                    'menunggu_sa': 'bg-yellow-400 text-black',
                                    'menunggu_foreman': 'bg-orange-400 text-white',
                                    'istirahat': 'bg-yellow-400 text-black',
                                };
                                const isOvernight = item.status === 'menginap';
                                const cd = getCooldownSisa(item.calledAt);
                                const inCooldown = cd > 0;
                                const isKonfirmasi = item.status === 'menunggu_konfirmasi';
                                return (
                                    <div key={index} className={`border rounded-2xl p-4 shadow-sm space-y-4 ${isKonfirmasi ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-zinc-200'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md shrink-0">
                                                    {item.category[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {item.queueNumber > 0 && (
                                                            <span className="text-[9px] font-black bg-zinc-800 text-white px-2 py-0.5 rounded-md">{item.category === 'Booking' ? `B-${String(item.queueNumber).padStart(3, '0')}` : `R-${String(item.queueNumber).padStart(3, '0')}`}</span>
                                                        )}
                                                        <span className="text-lg font-black text-black uppercase tracking-tight leading-none">{item.bk}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <span className="text-[9px] font-black text-zinc-500 uppercase">{item.tipe}</span>
                                                        <span className="text-[9px] font-black text-zinc-400">|</span>
                                                        <span className="text-[9px] font-black text-black uppercase">{item.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 ${statusColors[item.status] || 'bg-zinc-400 text-white'}`}>
                                                {isOvernight ? <Moon size={10} /> : (item.status === 'working' ? <Clock size={10} className="animate-spin-slow" /> : null)}
                                                {item.status === 'waiting' ? 'Menunggu' : item.status === 'istirahat' ? 'Istirahat' : item.status}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <User size={12} className="text-zinc-400" />
                                                <span className="font-bold text-zinc-600 uppercase text-[10px]">{item.mechanicName || 'BELUM ASSIGN'}</span>
                                            </div>
                                            <div className={`font-mono font-black tabular-nums ${item.estimasi < 0 ? 'text-rose-500 animate-pulse' : 'text-black'}`}>
                                                {formatTime(item.estimasi)}
                                            </div>
                                        </div>
                                        {item.keluhan && (
                                            <p className="text-[9px] font-bold text-zinc-500 whitespace-pre-wrap leading-relaxed">{item.keluhan}</p>
                                        )}
                                        {item.isCalled && (
                                            <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-center">
                                                ✅ Dipanggil ke Counter {item.counter}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-5 gap-2 pt-1">
                                            {item.status === 'menunggu_sa' ? (
                                                <>
                                                    {(() => {
                                                        const cd = getCooldownSisa(item.calledAt);
                                                        const inCooldown = cd > 0;
                                                        return (
                                                            <button onClick={() => {
                                                                if (!adminCounter) { Toastify({ text: "⚠️ Pilih Counter dulu!", style: { background: "#f59e0b" } }).showToast(); return; }
                                                                if (inCooldown) { Toastify({ text: `⏳ Tunggu ${cd} detik`, duration: 2000, style: { background: "#f59e0b" } }).showToast(); return; }
                                                                if (window.confirm(`Panggil ${item.bk} ke Counter ${adminCounter}?`)) handleCallQueue(item, adminCounter);
                                                            }} className={`col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 ${inCooldown ? 'bg-amber-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                                {inCooldown ? <span className="text-[11px] font-black">{cd}s</span> : <Megaphone size={16} />}
                                                            </button>
                                                        );
                                                    })()}
                                                    <button onClick={() => { editItem(item); Toastify({ text: "Lengkapi Tipe & Keluhan, lalu SIMPAN untuk konfirmasi SA", duration: 5000, style: { background: "#d97706", borderRadius: "12px", fontWeight: "900" } }).showToast(); }}
                                                        className="col-span-2 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 bg-yellow-500 hover:bg-yellow-600 text-[9px] font-black uppercase tracking-wider gap-1">
                                                        <CheckCircle size={14} /> Konfirmasi SA
                                                    </button>
                                                    <button onClick={() => editItem(item)} className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl transition-all active:scale-95 bg-white text-zinc-400 border border-zinc-200 hover:bg-black hover:text-white">
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button onClick={() => { if (window.confirm('Hapus antrian ini?')) deleteItem(item.id); }} className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl transition-all active:scale-95 bg-white text-zinc-400 border border-zinc-200 hover:bg-black hover:text-white">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                            <>
                                            <button onClick={() => {
                                                if (!adminCounter) { Toastify({ text: "⚠️ Pilih Counter dulu!", style: { background: "#f59e0b" } }).showToast(); return; }
                                                if (inCooldown) { Toastify({ text: `⏳ Tunggu ${cd} detik`, duration: 2000, style: { background: "#f59e0b" } }).showToast(); return; }
                                                if (window.confirm(`Panggil ${item.bk} ke Counter ${adminCounter}?`)) handleCallQueue(item, adminCounter);
                                            }} className={`col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 ${inCooldown ? 'bg-amber-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                {inCooldown ? <span className="text-[11px] font-black">{cd}s</span> : <Megaphone size={16} />}
                                            </button>
                                            {isKonfirmasi ? (
                                                <button onClick={() => handleConfirmCompletion(item)} disabled={isLoadingProcess}
                                                    className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700">
                                                    {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={16} />}
                                                </button>
                                            ) : item.status === 'sedang_dicuci' ? (
                                                <button onClick={() => handleCompleteCuci(item)} disabled={isLoadingProcess}
                                                    className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 bg-cyan-600 hover:bg-cyan-700" title="Selesai Cuci">
                                                    {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={16} />}
                                                </button>
                                            ) : (
                                                <button onClick={() => handleComplete(item, true)} disabled={isLoadingProcess || (item.status !== 'working' && item.status !== 'waiting' && item.status !== 'menginap' && item.status !== 'istirahat')}
                                                    className={`col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 ${isLoadingProcess ? 'bg-zinc-400 cursor-not-allowed' : 'bg-emerald-400/80 hover:bg-black'}`}>
                                                    {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Check size={16} strokeWidth={4} />}
                                                </button>
                                            )}
                                            <button onClick={() => {
                                                if (item.status === 'menginap') handleCancelOvernight(item);
                                                else setShowOvernightModal(item);
                                            }} className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl text-white transition-all active:scale-95 bg-black hover:bg-zinc-700">
                                                <Moon size={16} fill="white" />
                                            </button>
                                            <button onClick={() => editItem(item)} className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl transition-all active:scale-95 bg-white text-zinc-400 border border-zinc-200 hover:bg-black hover:text-white">
                                                <Edit3 size={16} />
                                            </button>
                                            <button onClick={() => { if (window.confirm('Hapus antrian ini?')) deleteItem(item.id); }} className="col-span-1 flex items-center justify-center p-2.5 min-h-[44px] rounded-xl transition-all active:scale-95 bg-white text-zinc-400 border border-zinc-200 hover:bg-black hover:text-white">
                                                <Trash2 size={16} />
                                            </button>
                                            </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {/* Desktop Queue Table */}
                    <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm">
                                <tr className="border-b-2 border-zinc-100 bg-zinc-50/50">
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 w-[25%] tracking-widest">Identitas / Antrian</th>
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
                                            'waiting': 'bg-amber-500 text-white shadow-md',
                                            'completed': 'bg-emerald-500 text-white shadow-md',
                                            'menginap': 'bg-purple-700 text-white shadow-md',
                                            'menunggu_konfirmasi': 'bg-emerald-500 text-white shadow-md',
                                            'request_extension': 'bg-amber-600 text-white shadow-md',
                                            'menunggu_sa': 'bg-yellow-400 text-black shadow-md',
                                            'menunggu_foreman': 'bg-orange-400 text-white shadow-md',
                                            'istirahat': 'bg-yellow-400 text-black shadow-md',
                                        };
                                        const isOvernight = item.status === 'menginap';
                                        const isKonfirmasi = item.status === 'menunggu_konfirmasi';
                                        return (
                                            <tr key={index} className={`transition-all border-l-4 duration-200 group border-b border-zinc-100 border-dashed ${isKonfirmasi ? 'bg-emerald-50/80 border-emerald-400 hover:bg-emerald-100/80' : 'hover:bg-zinc-50/50 border-transparent hover:border-black'}`}>
                                                    <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md">
                                                            {item.category[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                {item.queueNumber > 0 && (
                                                                    <span className="text-[9px] font-black bg-zinc-800 text-white px-2 py-0.5 rounded-md tracking-wider">
                                                                        {item.category === 'Booking' ? `B-${String(item.queueNumber).padStart(3, '0')}` : `R-${String(item.queueNumber).padStart(3, '0')}`}
                                                                    </span>
                                                                )}
                                                                <span className="text-xl font-black text-black tabular-nums uppercase tracking-tight leading-none">{item.bk}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{item.tipe}</span>
                                                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                                                <span className="text-[9px] font-black text-black uppercase tracking-widest">{item.category}</span>
                                                                {item.isCalled && (
                                                                    <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                                                        Dipanggil C{item.counter}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex justify-center">
                                                        <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest min-w-[110px] flex items-center justify-center gap-2 transition-transform ${statusColors[item.status] || 'bg-zinc-100'}`}>
                                                            {isOvernight ? <Moon size={12} fill="white" /> : (item.status === 'working' ? <Clock size={12} className="animate-spin-slow" /> : null)}
                                                            {item.status === 'waiting' ? 'Menunggu / Kerjakan' : item.status === 'istirahat' ? 'Istirahat' : item.status}
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
                                                        <p className="text-[9px] font-bold text-zinc-500 whitespace-pre-wrap leading-relaxed max-w-[200px]">
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
                                                        {item.status === 'menunggu_sa' ? (
                                                            <>
                                                            {(() => {
                                                                const cd = getCooldownSisa(item.calledAt);
                                                                const inCooldown = cd > 0;
                                                                return (
                                                                    <button onClick={() => {
                                                                        if (!adminCounter) {
                                                                            Toastify({ text: "⚠️ Pilih Counter dulu!", style: { background: "#f59e0b" } }).showToast();
                                                                            return;
                                                                        }
                                                                        if (inCooldown) {
                                                                            Toastify({ text: `⏳ Tunggu ${cd} detik lagi sebelum panggil ulang`, duration: 2000, style: { background: "#f59e0b", borderRadius: "12px", fontWeight: "900" } }).showToast();
                                                                            return;
                                                                        }
                                                                        if (window.confirm(`Panggil ${item.bk} ke Counter ${adminCounter}?`)) {
                                                                            handleCallQueue(item, adminCounter);
                                                                        }
                                                                    }} className={`p-3 min-w-[44px] min-h-[44px] rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center ${inCooldown ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`} title={inCooldown ? `Tunggu ${cd} detik` : "Panggil Antrian"}>
                                                                        {inCooldown ? (
                                                                            <span className="text-[11px] font-black tabular-nums">{cd}s</span>
                                                                        ) : (
                                                                            <Megaphone size={16} />
                                                                        )}
                                                                    </button>
                                                                );
                                                            })()}
                                                            <button onClick={() => { editItem(item); Toastify({ text: "Lengkapi Tipe & Keluhan, lalu SIMPAN untuk konfirmasi SA", duration: 5000, style: { background: "#d97706", borderRadius: "12px", fontWeight: "900" } }).showToast(); }}
                                                                className="p-3 min-w-[44px] min-h-[44px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider" title="Konfirmasi SA">
                                                                <CheckCircle size={14} /> SA
                                                            </button>
                                                            <button onClick={() => editItem(item)} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Edit Data Unit">
                                                                <Edit3 size={16} />
                                                            </button>
                                            <button onClick={() => { if (window.confirm('Hapus antrian ini?')) deleteItem(item.id); }} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Remove Task">
                                                <Trash2 size={16} />
                                            </button>
                                            </>
                                        ) : (
                                                        <>
                                                        {(() => {
                                                            const cd = getCooldownSisa(item.calledAt);
                                                            const inCooldown = cd > 0;
                                                            return (
                                                                <button onClick={() => {
                                                                    if (!adminCounter) {
                                                                        Toastify({ text: "⚠️ Pilih Counter dulu!", style: { background: "#f59e0b" } }).showToast();
                                                                        return;
                                                                    }
                                                                    if (inCooldown) {
                                                                        Toastify({
                                                                            text: `⏳ Tunggu ${cd} detik lagi sebelum panggil ulang`,
                                                                            duration: 2000,
                                                                            style: { background: "#f59e0b", borderRadius: "12px", fontWeight: "900" }
                                                                        }).showToast();
                                                                        return;
                                                                    }
                                                                    if (window.confirm(`Panggil ${item.bk} ke Counter ${adminCounter}?`)) {
                                                                        handleCallQueue(item, adminCounter);
                                                                    }
                                                                }} className={`p-3 min-w-[44px] min-h-[44px] rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center ${inCooldown ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`} title={inCooldown ? `Tunggu ${cd} detik` : "Panggil Antrian"}>
                                                                    {inCooldown ? (
                                                                        <span className="text-[11px] font-black tabular-nums">{cd}s</span>
                                                                    ) : (
                                                                        <Megaphone size={16} />
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                        {isKonfirmasi ? (
                                                            <button 
                                                                onClick={() => handleConfirmCompletion(item)} 
                                                                disabled={isLoadingProcess}
                                                                className="p-3 min-w-[44px] min-h-[44px] text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700" 
                                                                title="Konfirmasi selesai"
                                                            >
                                                                {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={18} />}
                                                            </button>
                                                        ) : item.status === 'sedang_dicuci' ? (
                                                            <button 
                                                                onClick={() => handleCompleteCuci(item)} 
                                                                disabled={isLoadingProcess}
                                                                className="p-3 min-w-[44px] min-h-[44px] text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center" 
                                                                title="Selesai Cuci"
                                                            >
                                                                {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={18} />}
                                                            </button>
                                                        ) : (
                                                            <>
                                                        {(item.status === 'working' || item.status === 'waiting' || item.status === 'menginap' || item.status === 'istirahat') && (
                                                            <button 
                                                                onClick={() => handleComplete(item, true)} 
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
                                                        </>
                                                        )}
                                                         <button onClick={() => editItem(item)} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Edit Data Unit">
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button onClick={() => { if (window.confirm('Hapus antrian ini?')) deleteItem(item.id); }} className="p-3 min-w-[44px] min-h-[44px] bg-white text-zinc-400 border border-zinc-200 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center" title="Remove Task">
                                                            <Trash2 size={16} />
                                                        </button>
                                                        </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Cuci Queue Section */}
                    {queue.filter(q => q.status === 'menunggu_cuci' || q.status === 'sedang_dicuci').length > 0 && (
                        <div className="shrink-0 bg-gradient-to-r from-teal-50 to-cyan-50 border-t-2 border-teal-200 px-6 py-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center">
                                    <Droplets size={14} className="text-white" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-800">Antrian Cuci Mobil</h4>
                                <span className="text-[8px] font-bold text-teal-600 bg-white px-3 py-1 rounded-full border border-teal-200">
                                    {queue.filter(q => q.status === 'menunggu_cuci').length} Tunggu / {queue.filter(q => q.status === 'sedang_dicuci').length} Dicuci
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {queue.filter(q => q.status === 'menunggu_cuci' || q.status === 'sedang_dicuci')
                                    .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))
                                    .map((item, idx) => {
                                        const isDicuci = item.status === 'sedang_dicuci';
                                        const cuciAntrian = queue.filter(q => q.status === 'menunggu_cuci' && (q.queueNumber || 0) < (item.queueNumber || 0)).length + 1;
                                        return (
                                            <div key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 shadow-sm transition-all ${isDicuci ? 'bg-cyan-100 border-cyan-300 shadow-cyan-200/30' : 'bg-white border-teal-200'}`}>
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-[11px] ${isDicuci ? 'bg-cyan-600' : 'bg-teal-500'}`}>
                                                    <Droplets size={16} fill="white" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-sm text-black uppercase">{item.bk}</span>
                                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider text-white ${isDicuci ? 'bg-cyan-600' : 'bg-teal-500'}`}>
                                                            {isDicuci ? 'SEDANG DICUCI' : `ANTRIAN #${cuciAntrian}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-[8px] font-bold text-zinc-500">Cuci Ke-{cuciAntrian}</span>
                                                        {isDicuci && (
                                                            <span className={`text-[9px] font-black tabular-nums ${item.estimasi < 120 ? 'text-red-600 animate-pulse' : 'text-cyan-700'}`}>
                                                                ⏱ {formatTime(item.estimasi)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5 ml-auto">
                                                    {item.status === 'menunggu_cuci' && handleStartCuci && (
                                                        <button onClick={() => handleStartCuci(item)}
                                                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95">
                                                            Mulai Cuci
                                                        </button>
                                                    )}
                                                    {item.status === 'sedang_dicuci' && handleCompleteCuci && (
                                                        <button onClick={() => handleCompleteCuci(item)}
                                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95">
                                                            Selesai Cuci
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                        {queue.some(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap' && q.status !== 'menunggu_konfirmasi') && (
                            <div className="shrink-0 bg-black text-white px-6 py-3 flex items-center justify-center gap-3 animate-slide-up relative z-40">
                                <AlertCircle size={16} className="animate-bounce" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Sistem Alert: {queue.filter(q => q.estimasi < 0 && q.status !== 'completed' && q.status !== 'menginap' && q.status !== 'menunggu_konfirmasi').length} unit melewati batas waktu.</span>
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

                    {/* EXTENSION REQUESTS BANNER */}
                    {queue.filter(q => q.status === 'request_extension').length > 0 && (
                        <div className="shrink-0 bg-amber-50 border-2 border-amber-200 rounded-2xl mx-4 md:mx-0 md:rounded-none md:border-t-0 md:border-l-0 md:border-r-0 px-4 md:px-8 py-4 space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                                <Clock size={14} /> Request Tambah Waktu
                            </p>
                            {queue.filter(q => q.status === 'request_extension').map(req => {
                                const extraData = req.pendingExtra ? (typeof req.pendingExtra === 'string' ? JSON.parse(req.pendingExtra) : req.pendingExtra) : null;
                                const extraDuration = extraData?.duration || 1800;
                                const extraReason = extraData?.reason || req.menginap_reason?.replace('[TAMBAH WAKTU] ', '') || '';
                                return (
                                    <div key={req.id} className="flex items-center justify-between gap-4 bg-white rounded-xl p-3 border border-amber-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-zinc-900">{req.bk} — <span className="text-amber-600">+{Math.floor(extraDuration / 60)} menit</span></p>
                                            <p className="text-[9px] font-bold text-zinc-500 truncate">{extraReason}</p>
                                            <p className="text-[8px] font-black text-zinc-400 mt-0.5">
                                                <span className="text-amber-600">{req.mechanicName || '-'}</span>
                                                {extraData?.mechanic && extraData.mechanic !== req.mechanicName && <span className="text-zinc-400"> via Foreman ({extraData.mechanic})</span>}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => onApproveExtension(req, extraDuration, extraReason)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                            >
                                                Setujui
                                            </button>
                                            <button onClick={() => onRejectExtension(req)}
                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                            >
                                                Tolak
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

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
                                                    {b._isDms ? (
                                                        <span className="bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md">
                                                            <Database size={14} /> DMS
                                                        </span>
                                                    ) : (
                                                        <>
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
                                                            if(!window.confirm("Hapus booking ini permanen?")) return;
                                                            try {
                                                              const { error } = await db.delete('booking', { eq: { id: b.id } });
                                                              if (error) throw error;
                                                              fetchBookings();
                                                              Toastify({ text: "Booking deleted!", background: "red" }).showToast();
                                                            } catch (e) {
                                                              Toastify({ text: `Gagal hapus: ${e.message}`, background: "red", duration: 5000 }).showToast();
                                                            }
                                                        }}
                                                        className="p-3 min-w-[44px] min-h-[44px] bg-zinc-50 hover:bg-black text-zinc-400 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    </>
                                                    )}
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
                                                const { slotCount, gapMinutes: gapInline, startHour: startInlineH, startMinute: startInlineM, slotCapacity: capInline } = bookingConfigState;
                                                const allSlots = generateSlots(slotCount, gapInline, startInlineH, startInlineM);
                                                
                                                return allSlots.map(s => {
                                                    const bookingsAtSlot = allMasterBookings.filter(b => {
                                                        const isDateSame = b.tanggal === createBookingForm.tanggal;
                                                        const isJamSame = normalizeJam(b.jam) === normalizeJam(s);
                                                        const isActive = b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed';
                                                        return isDateSame && isJamSame && isActive;
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
                                            if (isHolidayOrSunday(createBookingForm.tanggal, holidays)) return Toastify({text: "Tidak bisa booking di hari libur atau Minggu!", background: "red"}).showToast();
                                            const { error: insertError } = await db.insert('booking', [{
                                                id: Date.now() + Math.floor(Math.random() * 1000),
                                                ...createBookingForm,
                                                noPlat: createBookingForm.noPlat.toUpperCase().replace(/\s+/g, ''),
                                                status: 'accepted',
                                                bookingVia: `ADMIN / ${user?.name || 'Authorized'}`,
                                            }]);
                                            if (insertError) Toastify({ text: `Gagal membuat booking: ${insertError.message}`, background: "red", duration: 5000 }).showToast();
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
                                                const { slotCount, gapMinutes: gapInline, startHour: startInlineH, startMinute: startInlineM, slotCapacity: capInline } = bookingConfigState;
                                                const allSlots = generateSlots(slotCount, gapInline, startInlineH, startInlineM);
                                                
                                                return allSlots.map(s => {
                                                    const bookingsAtThisTime = allMasterBookings.filter(b => 
                                                        b.id !== editingBooking.id && // Exclude CURRENT booking being edited
                                                        b.tanggal === editingBooking.tanggal && 
                                                        normalizeJam(b.jam) === normalizeJam(s) &&
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
        <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
        </div>
    );
};

export default AdminPanel;
