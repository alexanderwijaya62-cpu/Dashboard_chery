import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, Send, User, ChevronLeft, ChevronRight, Phone, CheckCircle2, AlertCircle, MapPin, ShieldCheck, Bookmark, X, Car } from 'lucide-react';
import Toastify from 'toastify-js';
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots, getSlotsForDate, getCapacityForDate } from '../utils/bookingConfig';
import cheryLogo from '../assets/chery.png';

const isSameDate = (dateA, dateB) => {
    const normalize = (d) => {
        if (!d) return "";
        if (d instanceof Date) {
            // Gunakan format lokal YYYY-MM-DD agar tidak tergeser timezone UTC
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const str = String(d);
        if (str.includes("/")) {
            const parts = str.split(/[ /,-]/);
            if (parts.length === 3) {
                // Asumsi DD/MM/YYYY atau YYYY/MM/DD
                if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return str.split(/[T ]/)[0];
    };
    return normalize(dateA) === normalize(dateB);
};

const normalizeJam = (j) => {
    if (!j) return "";
    const sj = String(j).replace(':', '.');
    const parts = sj.split('.');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] || '00').padEnd(2, '0');
    return `${h}.${m}`;
};

const VEHICLE_TYPES = [
    "OMODA 5",
    "OMODA E5",
    "OMODA 5 GT",
    "TIGGO 5X",
    "TIGGO 7 PRO",
    "TIGGO 8",
    "TIGGO 8 PRO",
    "TIGGO 8 PRO MAX",
    "TIGGO CROSS",
    "CHERY J6",
    "JAECOO J5",
    "JAECOO J7",
    "JAECOO J8"
];

const CACHE_KEY = 'public_booking_cache';
const CACHE_TTL = 30000;

const loadCache = () => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL) return data;
        return null;
    } catch { return null; }
};

const saveCache = (data) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* quota exceeded */ }
};

export default function PublicBooking({ user, setCurrentPage }) {
    const [bookings, setBookings] = useState([]);
    const [bookingConfig, setBookingConfig] = useState({ slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1, saturdayEnabled: true, satSlotCount: 4, satGapMinutes: 30, satStartHour: 8, satStartMinute: 0, satSlotCapacity: 1 });
    const [isLoading, setIsLoading] = useState(false);
    const [isSlotsReady, setIsSlotsReady] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isBookingMode, setIsBookingMode] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const isLoggedIn = !!user && (user.role === 'customer' || user.role);

    const [formData, setFormData] = useState({
        jam: '', noPlat: '', namaCustomer: '', noTelp: '', keluhan: '', tipeMobil: ''
    });

    // Auto-fill form data from logged-in user
    useEffect(() => {
        if (isLoggedIn && user) {
            setFormData(prev => ({
                ...prev,
                namaCustomer: user.name || prev.namaCustomer,
                noTelp: user.username || prev.noTelp,
                noPlat: (user.plat_bk || prev.noPlat).toUpperCase(),
            }));
        }
    }, [isLoggedIn]);
    const [selectedFS, setSelectedFS] = useState([]);

    const getCombinedKeluhan = () => {
        const fsParts = [...selectedFS];
        const hasKeluhan = formData.keluhan.trim().length > 0;
        if (fsParts.length > 0 && hasKeluhan) {
            return `${fsParts.join(' + ')}: ${formData.keluhan.trim()}`;
        } else if (fsParts.length > 0) {
            return fsParts.join(' + ');
        }
        return formData.keluhan || '';
    };

    const [userIP, setUserIP] = useState('');
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [pendingBookJam, setPendingBookJam] = useState('');

    useEffect(() => {
        const getIP = async () => {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                if (data.ip) setUserIP(data.ip);
            } catch (e) { console.warn("Gagal mendapatkan IP User"); }
        };
        getIP();
    }, []);

    const fetchBookings = async (forceFresh = false) => {
        // Try cache first (unless forced fresh, e.g. realtime)
        if (!forceFresh) {
            const cached = loadCache();
            if (cached) {
                console.log('[PublicBooking] Loaded from cache:', cached.length, 'bookings');
                setBookings(cached);
                setIsSlotsReady(true);
                // Still refresh in background
                fetchBookings(true);
                return;
            }
        }

        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];

            console.log('[PublicBooking] Fetching bookings from date:', dateStr);
            const { data: supabaseData, error } = await db.select('booking', {
                select: 'id, tanggal, jam, noPlat, namaCustomer, noTelp, tipeMobil, status, bookingVia, noUrut',
                gte: { tanggal: dateStr }
            });
            console.log('[PublicBooking] Raw API response:', { supabaseData, error });
            if (error) throw error;

            let merged = Array.isArray(supabaseData)
                ? supabaseData.map(b => ({
                    ...b,
                    tanggal: b.Tanggal || b.tanggal || '',
                    noPlat: b.noPlat || b.no_plat || '',
                    namaCustomer: b.namaCustomer || b.nama_customer || '',
                    noTelp: b.noTelp || b.no_telp || '',
                    tipeMobil: b.tipeMobil || b.tipe_mobil || ''
                  }))
                : [];

            console.log('[PublicBooking] Merged bookings:', merged.length, 'items', merged);

            // === Fetch DMS internal booking (blocking — biar ga double book) ===
            try {
                const now = new Date();
                const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                const to = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;

                    const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&datefrom=${from}&dateto=${to}&length=200`);
                if (dmsRes.ok) {
                    const dmsJson = await dmsRes.json();
                    const { normalizeDmsBooking } = await import('../utils/dateHelpers');
                    const dmsBookings = (dmsJson.data || []).map(normalizeDmsBooking).filter(Boolean).filter(b => b.tanggal >= dateStr);
                    merged = [...merged, ...dmsBookings];
                }
            } catch (dmsErr) {
                console.warn('Gagal fetch DMS bookings:', dmsErr);
            }

            saveCache(merged);
            console.log('[PublicBooking] Final merged count:', merged.length, merged.map(b => ({ tgl: b.tanggal, jam: b.jam, status: b.status })));
            setBookings(merged);
            setIsSlotsReady(true);
        } catch (e) {
            console.error('Gagal fetch booking:', e);
            setIsSlotsReady(true); // tetap tampilkan UI meskipun error
        }
    };

    const fetchHolidays = async () => {
        try {
            const { data, error } = await db.select('libur');
            if (error) throw error;
            if (Array.isArray(data)) setHolidays(data);
        } catch (e) { console.error('Gagal fetch libur:', e); }
    };

    useEffect(() => {
        fetchBookings();
        fetchHolidays();
        fetchBookingConfig().then(setBookingConfig).catch(() => {});

        // REAL-TIME: Subscribe to changes in the 'booking' table
        const bookingSubscription = supabase
            .channel('public-booking-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'booking', filter: 'status=neq.declined' },
                (payload) => {
        
                    fetchBookings(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(bookingSubscription);
        };
    }, []);

    const isSunday = (date) => new Date(date).getDay() === 0;
    const getHoliday = (date) => holidays.find(h => isSameDate(h.date, date));
    const isClosed = (date) => isSunday(date) || !!getHoliday(date);

    const getDateAvailability = useCallback((dateStr) => {
        if (isClosed(dateStr)) return 'closed';
        const dynamicJam = getSlotsForDate(dateStr, bookingConfig);
        const dayCapacity = getCapacityForDate(dateStr, bookingConfig);
        
        const isToday = isSameDate(dateStr, new Date());
        const now = new Date();
        
        const dayBookings = bookings.filter(b => isSameDate(b.tanggal, dateStr) && ['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'].includes(b.status));
        
        if (dayBookings.length === 0) return 'empty';
        
        const toMin = (jam) => {
            const p = normalizeJam(jam).split('.');
            return parseInt(p[0]) * 60 + parseInt(p[1]);
        };
        
        const slotMinutes = dynamicJam.map(jam => toMin(jam));
        const slotBookCount = new Array(dynamicJam.length).fill(0);
        
        dayBookings.forEach(b => {
            const bMin = toMin(b.jam);
            let assigned = -1;
            for (let i = dynamicJam.length - 1; i >= 0; i--) {
                if (bMin >= slotMinutes[i]) { assigned = i; break; }
            }
            if (assigned === -1) assigned = 0;
            slotBookCount[assigned]++;
        });
        
        let fullSlotsCount = 0;
        for (let i = 0; i < dynamicJam.length; i++) {
            let effective = slotBookCount[i];
            if (isToday) {
                const [h, m] = dynamicJam[i].split('.');
                const slotDate = new Date();
                slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
                if (slotDate < now && effective < dayCapacity) effective = dayCapacity;
            }
            if (effective >= dayCapacity) fullSlotsCount++;
        }
        
        if (fullSlotsCount >= dynamicJam.length) return 'full';
        return 'partial';
    }, [bookings, holidays, bookingConfig]);

    const JAM_PILIHAN = useMemo(() => selectedDate ? getSlotsForDate(selectedDate, bookingConfig) : generateSlots(bookingConfig.slotCount || 4, bookingConfig.gapMinutes || 30, bookingConfig.startHour || 8, bookingConfig.startMinute || 0), [selectedDate, bookingConfig]);

    const getIsPastTime = useCallback((slotJam) => {
        if (!isSameDate(selectedDate, new Date())) return false;
        
        try {
            const [h, m] = slotJam.split('.');
            const now = new Date();
            const slotDate = new Date();
            slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
            return slotDate < now;
        } catch (e) {
            return false;
        }
    }, [selectedDate]);

    const bookingsForDate = useMemo(() => {
        return bookings.filter(b => isSameDate(b.tanggal, selectedDate) && ['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'].includes(b.status));
    }, [bookings, selectedDate]);

    const handleBookClick = (jam) => {
        setPendingBookJam(jam);
        setShowWarningModal(true);
    };

    const handleConfirmWarning = () => {
        setFormData({ ...formData, jam: pendingBookJam });
        setIsBookingMode(true);
        setShowWarningModal(false);
        setPendingBookJam('');
    };

    const checkDmsVehicle = async (noPlat) => {
        try {
            const cleanPlat = noPlat.toUpperCase().replace(/\s+/g, '');
            const res = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${cleanPlat}&q=${cleanPlat}`);
            if (!res.ok) return null;
            const json = await res.json();
            const matched = Array.isArray(json) && json.find(v =>
                (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === cleanPlat
            );
            return matched || null;
        } catch (e) {
            console.warn("DMS check error:", e);
            return null;
        }
    };

    const createDmsBooking = async (vehicleData) => {
        const cleanPlat = formData.noPlat.toUpperCase().replace(/\s+/g, '');
        const v = vehicleData;
        const bookingPerson = user ? user.name : formData.namaCustomer;
        const dmsBookingPayload = {
            uniqid: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            id_kendaraan: v.id_kendaraan,
            no_polisi: v.no_polisi,
            model_kendaraan: v.model_kendaraan || v.nama_kendaraan || '',
            nama_kendaraan: v.nama_kendaraan || '',
            tipe_kendaraan: v.tipe_kendaraan || '',
            no_chassis: v.no_chassis,
            group_kendaraan: v.group_kendaraan || 'PC',
            no_pelanggan: v.no_pelanggan,
            id_pelanggan: v.id_pelanggan,
            tipe_pelanggan: v.tipe_pelanggan || 'PRIBADI',
            nama_pelanggan: v.nama_pelanggan,
            no_telp_pelanggan: v.no_telp || formData.noTelp,
            alamat_pelanggan: v.alamat || '-',
            atas_nama_booking: formData.namaCustomer,
            no_telp_booking: formData.noTelp,
            janji_datang: `${selectedDate}T${(formData.jam || '08.30').replace('.', ':')}`,
            keluhan: getCombinedKeluhan() || '-',
            booking_via: 'Web-Public',
            booking_via_personal: bookingPerson,
            km: 0
        };

        const res = await fetch('/api/chery_dms?endpoint=booking-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dmsBookingPayload)
        });

        return res.ok;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;

        if (!formData.jam || !formData.noPlat || !formData.namaCustomer || !formData.noTelp || !formData.tipeMobil) {
            Toastify({ text: "Harap isi semua field wajib, termasuk Tipe Mobil!", background: "red" }).showToast();
            return;
        }

        if (getIsPastTime(formData.jam)) {
            Toastify({ text: "Maaf, waktu booking ini sudah lewat!", background: "red" }).showToast();
            return;
        }

        const bookedAtThisTime = bookings.filter(b => 
            isSameDate(b.tanggal, selectedDate) && 
            normalizeJam(b.jam) === normalizeJam(formData.jam) && 
            ['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'].includes(b.status)
        ).length;

        if (bookedAtThisTime >= (getCapacityForDate(selectedDate, bookingConfig) || 1)) { 
            Toastify({ text: `Maaf, slot jam ${formData.jam} baru saja terisi penuh!`, background: "orange" }).showToast();
            setIsBookingMode(false);
            fetchBookings();
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const { data: existingPlatBooking, error: platError } = await db.select('booking', {
            select: 'noPlat, tanggal, jam, status',
            eq: { noPlat: formData.noPlat.toUpperCase().replace(/\s+/g, '') },
            in: { status: ['waiting_approval', 'waiting confirm', 'accepted'] }
        });

        if (platError) {
            console.error("Plat Check Error:", platError);
            Toastify({ text: "⚠️ Gangguan Koneksi! Gagal memvalidasi Plat BK. Silakan coba lagi.", style: { background: '#f97316' } }).showToast();
            setIsLoading(false);
            return;
        }

        if (existingPlatBooking && existingPlatBooking.length > 0) {
            const bItem = existingPlatBooking[0];
            const tglFormatted = new Date(bItem.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            Toastify({
                text: `⚠️ GAGAL: Mobil ${bItem.noPlat} sudah memiliki booking aktif pada ${tglFormatted} pukul ${bItem.jam}.`,
                style: { background: '#ef4444' },
                duration: 8000
            }).showToast();
            setIsLoading(false);
            return;
        }

        const targetJam = normalizeJam(formData.jam);

        const { data: allBookings } = await db.select('booking', { select: 'jam, status', eq: { tanggal: selectedDate }, in: { status: ['waiting confirm', 'accepted', 'completed'] } });

        const isConflict = allBookings?.filter(b => normalizeJam(b.jam) === targetJam).length >= (getCapacityForDate(selectedDate, bookingConfig) || 1);

        if (isConflict) {
            Toastify({ text: `⚠️ Konflik: Slot jam ${formData.jam} baru saja terisi orang lain!`, style: { background: '#f97316' }, duration: 5000 }).showToast();
            setIsBookingMode(false);
            fetchBookings();
            setIsLoading(false);
            return;
        }

        const { data: latestBooking } = await db.select('booking', { select: 'noUrut', order: { column: 'noUrut', ascending: false }, limit: 1, maybeSingle: true });

        const currentMax = Number(latestBooking?.noUrut || 0);
        const nextNoUrut = currentMax + 1;

        const cleanPlat = formData.noPlat.toUpperCase().replace(/\s+/g, '');

        try {
            // 1. CEK DMS DULU
            let dmsSynced = false;
            let dmsBookingStatus = 'accepted';
            let dmsBookingVia = user ? `Booking via: ${user.name}` : 'Web-Public';

            const vehicleData = await checkDmsVehicle(cleanPlat);
            if (vehicleData) {
                const dmsOk = await createDmsBooking(vehicleData);
                if (dmsOk) {
                    dmsSynced = true;
                    dmsBookingVia = 'Web-Public (Synced DMS)';
                }
            }

            // 2. SIMPAN KE SUPABASE
            const newId = Date.now() + Math.floor(Math.random() * 1000);
            const { error } = await db.insert('booking', {
                id: newId,
                noUrut: nextNoUrut,
                tanggal: selectedDate,
                jam: formData.jam,
                noPlat: cleanPlat,
                tipeMobil: formData.tipeMobil || (vehicleData ? (vehicleData.model_kendaraan || vehicleData.nama_kendaraan || '') : ''),
                namaCustomer: formData.namaCustomer,
                bookingVia: dmsBookingVia,
                noTelp: formData.noTelp,
                keperluanService: getCombinedKeluhan(),
                ip_address: userIP,
                status: dmsBookingStatus
            });

            if (error) throw error;

            if (dmsSynced) {
                Toastify({ text: '✅ Booking berhasil & tersinkronisasi ke DMS!', style: { background: 'green' } }).showToast();
            } else {
                Toastify({ text: '✅ Booking berhasil! Silakan datang sesuai jadwal.', style: { background: 'green' } }).showToast();
            }

            setIsBookingMode(false);
            setFormData({ jam: '', noPlat: '', namaCustomer: '', noTelp: '', keluhan: '', tipeMobil: '' });
            setSelectedFS([]);
            fetchBookings();
        } catch (err) {
            console.error('Booking error:', err);
            const msg = err.message?.includes('duplicate') || err.code === 'SLOT_CONFLICT'
                ? '❌ Slot ini sudah dibooking orang lain! Silakan pilih jam lain.'
                : `❌ Gagal booking: ${err.message}`;
            Toastify({ text: msg, style: { background: '#dc2626' }, duration: 5000 }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    // CALENDAR LOGIC
    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const calendarGrid = useMemo(() => {
        const month = currentMonth.getMonth();
        const year = currentMonth.getFullYear();
        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const startDay = startDayOfMonth(month, year);

        // Padding previous month
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, currentMonth: false });
        }
        // Current month
        for (let i = 1; i <= daysInMonth(month, year); i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({ day: i, currentMonth: true, date: dateStr });
        }
        // Padding next month
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, currentMonth: false });
        }
        return days;
    }, [currentMonth]);

    const changeMonth = (offset) => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentMonth(next);
    };

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans relative pb-[72px]">

            {/* COMPACT TOP HEADER */}
            <header className="bg-white border-b-2 border-zinc-200 px-4 md:px-8 py-3 flex justify-between items-center shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                        <CalendarIcon className="text-white w-4 md:w-5" />
                    </div>
                    <div>
                        <h1 className="text-[13px] md:text-base font-black tracking-tight uppercase leading-none italic">Service <span className="text-black">Booking</span></h1>
                        <p className="text-[7.5px] md:text-[9px] font-black text-zinc-400 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={10} className="text-black" /> Chery Oriental Medan
                        </p>
                    </div>
                </div>
                <div className="flex items-center">
                    <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 md:px-4 md:py-2 rounded-full border-2 border-zinc-200 shadow-inner">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest">System Online</span>
                    </div>
                </div>
            </header>

            {/* RESPONSIVE LAYOUT */}
            <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative">

                {/* LOGIN GATE — Must be logged in to book */}
                {!isLoggedIn && (
                    <div className="w-full flex items-center justify-center py-20">
                        <div className="bg-white rounded-[2rem] shadow-2xl border-2 border-zinc-200 p-8 md:p-12 max-w-md w-full text-center">
                            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <User className="text-white w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-wider mb-2">Login Diperlukan</h2>
                            <p className="text-zinc-400 text-xs font-bold mb-8 leading-relaxed">
                                Silakan login terlebih dahulu untuk melakukan booking service kendaraan Anda.
                            </p>
                            <button
                                onClick={() => setCurrentPage('login')}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-150 shadow-xl active:scale-95 flex items-center justify-center gap-3"
                            >
                                <User size={16} /> Login Sekarang
                            </button>
                            <p className="text-zinc-300 text-[9px] font-bold mt-4 uppercase tracking-widest">
                                Belum punya akun? <button onClick={() => setCurrentPage('register')} className="text-zinc-900 font-black underline">Daftar di sini</button>
                            </p>
                        </div>
                    </div>
                )}

                {/* Existing content — only show if logged in */}
                {isLoggedIn && (<>
                {!isSlotsReady && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50/80 backdrop-blur-sm rounded-[2rem]">
                        <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-200 p-8 md:p-12 flex flex-col items-center gap-4 animate-fade-in">
                            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg">
                                <CalendarIcon className="text-white w-8 h-8 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-zinc-900 uppercase tracking-[0.2em]">Memuat Data Booking</p>
                                <p className="text-[10px] font-bold text-zinc-400 mt-2">Mohon tunggu sebentar...</p>
                            </div>
                            <div className="flex gap-1.5 mt-2">
                                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* KIRI/ATAS: CALENDAR SELECTOR */}
                <div className="w-full lg:w-[420px] shrink-0 bg-white rounded-[2rem] border-2 border-dashed border-zinc-300 shadow-sm flex flex-col overflow-hidden relative">
                    <div className="p-4 md:p-6 border-b-2 border-zinc-100 flex items-center justify-between shrink-0 bg-transparent relative z-10">
                        <button onClick={() => changeMonth(-1)} className="p-2 md:p-3 bg-zinc-100 border-2 border-zinc-200 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                            <ChevronLeft size={16} />
                        </button>
                        <h2 className="text-xs md:text-sm font-black text-zinc-900 uppercase tracking-[0.2em] italic">
                            {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="p-2 md:p-3 bg-zinc-100 border-2 border-zinc-200 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="px-4 md:px-6 pt-2 pb-0 grid grid-cols-7 gap-1 font-black text-center text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-600">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d} className="py-2">{d}</div>)}
                    </div>

                    <div className="px-3 md:px-5 pb-4 grid grid-cols-7 gap-1.5 md:gap-2">
                        {calendarGrid.map((item, idx) => {
                            if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-0 flex items-center justify-center"><div className="w-full h-full border border-zinc-100/50 rounded-xl"></div></div>;

                            const availability = getDateAvailability(item.date);
                            const isSelectable = availability !== 'closed';
                            const isActive = selectedDate === item.date;
                            const isPast = new Date(item.date) <= new Date().setHours(0, 0, 0, 0);

                            return (
                                <button
                                    key={idx}
                                    disabled={isPast || !isSelectable}
                                    onClick={() => setSelectedDate(item.date)}
                                    className={`relative aspect-[4/5] rounded-[1rem] flex flex-col items-center justify-center transition-all duration-300 group overflow-hidden border-2 ${isPast ? 'bg-zinc-50 opacity-40 cursor-not-allowed border-transparent text-zinc-400' :
                                        !isSelectable ? 'bg-zinc-100 border-zinc-200 cursor-not-allowed opacity-50 grayscale text-zinc-400' :
                                            isActive ? 'bg-zinc-900 border-black text-white shadow-xl scale-110 z-10 font-bold' :
                                                !isSlotsReady ? 'bg-white border-zinc-200 border-dashed text-zinc-300' :
                                                availability === 'empty' ? 'bg-white border-zinc-100 border-dashed hover:border-emerald-500 hover:shadow-md text-zinc-500' :
                                                    availability === 'partial' ? 'bg-white border-zinc-100 border-dashed hover:border-amber-500 hover:shadow-md text-zinc-500' :
                                                        'bg-white border-rose-100 cursor-not-allowed opacity-70 text-zinc-300'
                                        }`}
                                >
                                    <span className={`text-[13px] md:text-sm tracking-tight ${isActive ? 'font-black' : 'font-bold'}`}>{item.day}</span>
                                    {isSelectable && !isPast && (
                                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${!isSlotsReady ? 'bg-zinc-300 animate-pulse' :
                                            availability === 'empty' ? 'bg-emerald-500' :
                                            availability === 'partial' ? 'bg-amber-400' :
                                                'bg-rose-500'
                                            }`} />
                                    )}
                                    {isActive && <div className="absolute top-1 right-1 opacity-80"><ShieldCheck size={8} className="text-emerald-400 font-bold" /></div>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 md:p-5 bg-zinc-50 border-t-2 border-zinc-100 flex items-center justify-center gap-6 md:gap-8">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            <span className="text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Empty</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
                            <span className="text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Partial</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                            <span className="text-[8px] md:text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Full</span>
                        </div>
                    </div>
                </div>

                {/* KANAN/BAWAH: SLOTS & FORM */}
                <div className="flex-1 bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative">
                    {!isBookingMode ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 md:p-8 flex items-center justify-between z-10 border-b border-white/5 bg-white/5 relative">
                                <div>
                                    <h2 className="text-[14px] md:text-[18px] font-black text-white uppercase tracking-wider mb-2">
                                        {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </h2>
                                    <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Clock size={10} className="text-black" /> Pilih Waktu Kedatangan
                                    </p>
                                </div>
                                 <div className="flex items-center gap-3 md:gap-4 shrink-0">
                                     <div className="bg-[#2A2A2A] px-3 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-white/5 text-center flex flex-col items-center">
                                         <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 leading-none">Total Slots</p>
                                         <p className="text-sm md:text-base font-black text-white leading-none">
                                            {JAM_PILIHAN.length}
                                         </p>
                                     </div>
                                     <div className="bg-emerald-500/10 px-3 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-emerald-500/20 text-center flex flex-col items-center">
                                           <p className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none">Sisa Slot</p>
                                          <p className="text-sm md:text-base font-black text-emerald-400 leading-none">
                                             {!isSlotsReady ? '...' :
                                             (() => {
                                                  const occupiedCount = (bookingsForDate || []).length;
                                                   const totalCapacity = (JAM_PILIHAN.length || 0) * (getCapacityForDate(selectedDate, bookingConfig) || 1);
                                                 return Math.max(0, totalCapacity - occupiedCount);
                                             })()}
                                          </p>
                                      </div>
                                 </div>
                            </div>

                            <div className="flex-1 p-6 md:p-8 flex flex-col z-10 gap-6 md:gap-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {JAM_PILIHAN.map((jam, idx) => {
                                        const slotP = normalizeJam(jam).split('.');
                                        const slotMin = parseInt(slotP[0]) * 60 + parseInt(slotP[1]);
                                        const nextMin = idx < JAM_PILIHAN.length - 1 ? (() => { const np = normalizeJam(JAM_PILIHAN[idx + 1]).split('.'); return parseInt(np[0]) * 60 + parseInt(np[1]); })() : 9999;
                                        const bookingsAtThisTime = bookingsForDate.filter(b => {
                                            const bP = normalizeJam(b.jam).split('.');
                                            const bMin = parseInt(bP[0]) * 60 + parseInt(bP[1]);
                                            return bMin >= slotMin && bMin < nextMin;
                                        });

                                         const isOccupied = bookingsAtThisTime.length >= (getCapacityForDate(selectedDate, bookingConfig) || 1);
                                        const isPastTime = getIsPastTime(jam);
                                        const isDisabled = isOccupied || isPastTime || !isSlotsReady;

                                        return (
                                            <div key={idx} className={`p-4 md:p-5 rounded-[1.5rem] border flex items-center justify-between group/item transition-all ${isDisabled ? 'bg-zinc-200 border-zinc-300 opacity-60 cursor-not-allowed' : 'bg-black border-zinc-800 cursor-pointer hover:bg-zinc-800'
                                                }`} onClick={() => !isDisabled && handleBookClick(jam)}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-mono text-sm md:text-base font-black transition-all bg-white text-zinc-900 shadow-lg
                                                        }${isDisabled ? ' grayscale opacity-50' : ''}`}>
                                                        {jam}
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest mb-1 text-white opacity-80`}>
                                                             {!isSlotsReady ? 'Memuat data...' : isOccupied ? `Slot Penuh (${bookingsAtThisTime.length}/${getCapacityForDate(selectedDate, bookingConfig) || 1})` : isPastTime ? 'Waktu Terlewati' : `Sisa Slot: ${Math.max(0, (getCapacityForDate(selectedDate, bookingConfig) || 1) - bookingsAtThisTime.length)} Unit`}
                                                        </p>
                                                        <h4 className={`text-base md:text-lg font-black tracking-tight text-white`}>
                                                            {!isSlotsReady ? 'LOADING' : isOccupied ? 'FULL BOOKED' : isPastTime ? 'CLOSED' : 'Klik Reservasi'}
                                                        </h4>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-auto px-6 py-8 md:p-8 bg-[#222] border border-white/5 rounded-[2rem] text-center space-y-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-zinc-800/5 mix-blend-overlay pointer-events-none"></div>
                                    <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-widest italic relative z-10">Layanan VIP Chery Oriental</h3>
                                    <p className="text-zinc-500 text-[8px] md:text-[9.5px] font-black leading-relaxed max-w-lg mx-auto uppercase tracking-widest relative z-10">
                                        Nikmati fasilitas ruang tunggu premium, WIFI, snack & minuman gratis selama pengerjaan kendaraan Anda berlangsung.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col h-full bg-[#1A1A1A] animate-fade-in relative z-20">
                            <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-start bg-white/5 shrink-0">
                                <div>
                                    <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[8px] md:text-[9px] mb-1.5 md:mb-2 px-1">Tahap 2: Registrasi</p>
                                    <h2 className="text-xl md:text-2xl font-black text-white tracking-widest uppercase leading-none">Detail <span className="text-white">Kendaraan</span></h2>
                                </div>
                                <button onClick={() => setIsBookingMode(false)} className="p-2 md:p-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-all">
                                    <X size={20} strokeWidth={3} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                                <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                                    <section className="space-y-4 md:space-y-5">
                                        {user && (
                                            <button type="button" onClick={() => setFormData({ ...formData, namaCustomer: user.name || '', noTelp: user.username || '', noPlat: user.plat_bk || '', tipeMobil: '' })}
                                                className="w-full bg-emerald-500/10 border border-emerald-500/30 p-3 md:p-4 rounded-xl flex items-center gap-3 hover:bg-emerald-500/20 transition-all group">
                                                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                                    <User size={14} className="text-emerald-400" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Gunakan Data Saya</p>
                                                    <p className="text-[10px] text-emerald-500/70 font-medium">Isi otomatis dari akun Anda</p>
                                                </div>
                                            </button>
                                        )}
                                        <h3 className="text-[9px] md:text-[10px] font-black uppercase text-white tracking-widest bg-white/5 p-3 md:p-4 rounded-xl border border-white/5 flex items-center gap-2"><User size={14} /> Info Pelanggan</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                    Nama <span className="text-black text-lg leading-none">*</span>
                                                </label>
                                                <input required type="text" value={formData.namaCustomer} onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all uppercase placeholder:text-zinc-600" placeholder="Nama lengkap" />
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                                    No HP <span className="text-black text-lg leading-none">*</span>
                                                </label>
                                                <input required type="tel" value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all placeholder:text-zinc-600" placeholder="081267XXXXX" />
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nomor Polisi (BK)</label>
                                                <input required type="text" value={formData.noPlat} 
                                                    onChange={e => setFormData({ ...formData, noPlat: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all uppercase placeholder:text-zinc-600" placeholder="BK 1234 AB" />
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tipe Mobil / Unit <span className="text-black text-lg leading-none">*</span></label>
                                                <select required value={formData.tipeMobil} onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all uppercase appearance-none cursor-pointer">
                                                    <option value="" disabled className="text-zinc-500 bg-[#2A2A2A]">-- Pilih Tipe Mobil --</option>
                                                    {VEHICLE_TYPES.map((tipe, idx) => (
                                                        <option key={idx} value={tipe} className="bg-zinc-800 text-white font-bold">{tipe}</option>
                                                    ))}
                                                    {/* Jika kendaraan DMS yang terdeteksi tidak ada di list kita, tampilkan secara dinamis */}
                                                    {formData.tipeMobil && !VEHICLE_TYPES.includes(formData.tipeMobil.toUpperCase()) && (
                                                        <option value={formData.tipeMobil} className="bg-zinc-800 text-white font-bold">{formData.tipeMobil.toUpperCase()}</option>
                                                    )}
                                                    <option value="LAINNYA" className="bg-zinc-800 text-white font-bold">LAINNYA / TIPE LAIN</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Free Service</label>
                                                <div className="flex gap-2">
                                                    {['FS1', 'FS2', 'FS3'].map(fs => (
                                                        <button key={fs} type="button" onClick={() => setSelectedFS(prev => prev.includes(fs) ? prev.filter(f => f !== fs) : [...prev, fs])}
                                                            className={`flex-1 py-3 md:py-4 rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all border-2 ${
                                                                selectedFS.includes(fs)
                                                                    ? 'bg-white text-black border-white shadow-lg'
                                                                    : 'bg-[#2A2A2A] text-zinc-400 border-white/5 hover:border-white/30'
                                                            }`}
                                                        >
                                                            {fs}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Keluhan / Catatan</label>
                                                <textarea value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all placeholder:text-zinc-600 min-h-[80px]" placeholder="Deskripsi keluhan (opsional)" />
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <div className="mt-auto border-t border-white/10 bg-black/20 p-6 md:p-8 shrink-0 flex flex-col items-center gap-4">
                                    <button type="submit" disabled={isLoading} className="w-full bg-white hover:bg-zinc-200 text-black py-4 rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-150 shadow-xl active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-300">
                                        {isLoading ? <Clock className="animate-spin w-4 h-4" /> : <Send size={18} />}
                                        {isLoading ? 'Processing Request...' : 'Finalize Reservation'}
                                    </button>
                                    <p className="text-zinc-500 text-[7px] md:text-[8px] font-black uppercase text-center tracking-widest leading-relaxed px-4">
                                        Dengan menekan tombol di atas, System akan otomatis membuat janji dan mengirimkan notifikasi.
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
                </>)}

            </div>

            <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-modal-in { animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .animate-modal-overlay { animation: overlayIn 0.3s ease-out forwards; }
                @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>

            {/* WARNING MODAL */}
            {showWarningModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-overlay" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-modal-in border border-zinc-200">
                        {/* Header with Logo */}
                        <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-8 pt-8 pb-6 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMjBsMjAgMjBNMjAgMjBMMCA0ME0wIDBsMjAgMjBNNDAgMEwyMCAyMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] opacity-50"></div>
                            <img src={cheryLogo} alt="Chery" className="h-16 w-auto mx-auto mb-4 drop-shadow-2xl relative z-10" />
                            <h3 className="text-white font-black text-lg uppercase tracking-wider relative z-10">Informasi Penting</h3>
                            <div className="w-12 h-1 bg-black rounded-full mx-auto mt-3 relative z-10"></div>
                        </div>
                        {/* Content */}
                        <div className="px-8 py-6 text-center">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-200">
                                <AlertCircle className="text-amber-500" size={32} />
                            </div>
                            <h4 className="font-black text-zinc-900 text-base uppercase tracking-wide mb-2">Batas Keterlambatan</h4>
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
                                <p className="text-amber-800 font-black text-xl">Maksimal <span className="text-black">15 Menit</span></p>
                                <p className="text-amber-600 text-xs font-bold mt-1">dari jadwal booking yang dipilih</p>
                            </div>
                            <p className="text-zinc-500 text-xs font-bold leading-relaxed">
                                Jika Anda terlambat lebih dari 30 menit, booking akan otomatis <span className="text-black font-black">dipindahkan ke antrian reguler</span>.
                            </p>
                        </div>
                        {/* Actions */}
                        <div className="px-8 pb-8 flex gap-3">
                            <button 
                                onClick={() => { setShowWarningModal(false); setPendingBookJam(''); }}
                                className="flex-1 py-3.5 rounded-xl bg-zinc-100 text-zinc-600 font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleConfirmWarning}
                                className="flex-1 py-3.5 rounded-xl bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all duration-150 active:scale-95 shadow-lg flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={16} /> Saya Mengerti
                            </button>
                        </div>
                </div>
            </div>
            )}

        </div>
    );
}
