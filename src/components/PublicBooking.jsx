import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, Send, User, ChevronLeft, ChevronRight, Phone, CheckCircle2, AlertCircle, MapPin, ShieldCheck, Bookmark, X } from 'lucide-react';
import Toastify from 'toastify-js';
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import orientalLogo from '../assets/oriental.jpeg';
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

export default function PublicBooking({ user }) {
    const [bookings, setBookings] = useState([]);
    const [bookingConfig, setBookingConfig] = useState({ slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1 });
    const [isLoading, setIsLoading] = useState(false);
    const [isSlotsReady, setIsSlotsReady] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isBookingMode, setIsBookingMode] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const [formData, setFormData] = useState({
        jam: '', noPlat: '', namaCustomer: '', noTelp: '', keluhan: ''
    });
    const [userIP, setUserIP] = useState('');
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [pendingBookJam, setPendingBookJam] = useState('');

    useEffect(() => {
        // Ambil IP User untuk pencegahan spam booking ganda
        const getIP = async () => {
            try {
                const res = await fetch('https://ipapi.co/json/');
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

            const { data: supabaseData, error } = await db.select('booking', {
                gte: { tanggal: dateStr }
            });
            if (error) throw error;

            let merged = Array.isArray(supabaseData) ? [...supabaseData] : [];
            saveCache(merged);
            setBookings(merged);
            setIsSlotsReady(true);

            // DMS fetch in background — tidak blocking render
            try {
                const now = new Date();
                const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                const to = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;

                const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&datefrom=${from}&dateto=${to}&length=200`);
                if (dmsRes.ok) {
                    const dmsJson = await dmsRes.json();
                    const dmsBookings = (dmsJson.data || []).map(b => {
                        const janji = b.janji_datang || '';
                        const parts = janji.split(' ');
                        const tgl = parts[0] || '';
                        const jamRaw = parts[1] || '00:00';
                        const jam = jamRaw.replace(':', '.');
                        const sBooking = (b.status_booking || '').toLowerCase();
                        if (['batal', 'expired', 'declined'].includes(sBooking)) return null;
                        return {
                            id: `dms_${b.no_booking || b.id || Math.random()}`,
                            noUrut: 0,
                            tanggal: tgl,
                            jam,
                            noPlat: b.no_polisi || '',
                            namaCustomer: b.nama_pelanggan || '',
                            noTelp: b.no_telp || '',
                            tipeMobil: b.nama_kendaraan || '',
                            keperluanService: '',
                            status: 'accepted',
                            bookingVia: 'DMS Internal',
                        };
                    }).filter(Boolean).filter(b => b.tanggal >= dateStr);
                    merged = [...merged, ...dmsBookings];
                    saveCache(merged);
                    setBookings(merged);
                }
            } catch (dmsErr) {
                console.warn('Gagal fetch DMS bookings:', dmsErr);
            }
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
                    console.log('Change received in Public Booking!', payload);
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
        const { slotCount: maxSlots, gapMinutes, startHour, startMinute, slotCapacity } = bookingConfig;
        const dynamicJam = generateSlots(maxSlots, gapMinutes, startHour, startMinute);
        
        const isToday = isSameDate(dateStr, new Date());
        const now = new Date();
        
        const dayBookings = bookings.filter(b => isSameDate(b.tanggal, dateStr) && (b.status === 'waiting confirm' || b.status === 'accepted' || b.status === 'completed'));
        
        let fullSlotsCount = 0;
        let hasAnyBooking = false;
        
        dynamicJam.forEach(jam => {
            const bookingsAtThisTime = dayBookings.filter(b => normalizeJam(b.jam) === normalizeJam(jam));
            let effectiveCount = bookingsAtThisTime.length;
            
            if (isToday) {
                const [h, m] = jam.split('.');
                const slotDate = new Date();
                slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
                
                if (slotDate < now && effectiveCount < slotCapacity) {
                    effectiveCount = slotCapacity;
                }
            }
            
            if (effectiveCount > 0) hasAnyBooking = true;
            if (effectiveCount >= slotCapacity) fullSlotsCount++;
        });
        
        if (fullSlotsCount >= (dynamicJam.length)) return 'full';
        if (hasAnyBooking) return 'partial';
        return 'empty';
    }, [bookings, holidays, bookingConfig]);

    const { slotCount: maxSlotsCount, gapMinutes: gapConfig, startHour: startConfigH, startMinute: startConfigM, slotCapacity } = bookingConfig;
    const JAM_PILIHAN = useMemo(() => generateSlots(maxSlotsCount, gapConfig, startConfigH, startConfigM), [maxSlotsCount, gapConfig, startConfigH, startConfigM]);

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
        return bookings.filter(b => isSameDate(b.tanggal, selectedDate) && (b.status === 'waiting confirm' || b.status === 'accepted' || b.status === 'completed'));
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
            keluhan: formData.keluhan || '-',
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

        if (!formData.jam || !formData.noPlat || !formData.namaCustomer || !formData.noTelp) {
            Toastify({ text: "Harap isi semua field wajib!", background: "red" }).showToast();
            return;
        }

        if (getIsPastTime(formData.jam)) {
            Toastify({ text: "Maaf, waktu booking ini sudah lewat!", background: "red" }).showToast();
            return;
        }

        const bookedAtThisTime = bookings.filter(b => 
            isSameDate(b.tanggal, selectedDate) && 
            normalizeJam(b.jam) === normalizeJam(formData.jam) && 
            (b.status === 'waiting confirm' || b.status === 'accepted' || b.status === 'completed')
        ).length;

        if (bookedAtThisTime >= (bookingConfig.slotCapacity || 1)) { 
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

        const isConflict = allBookings?.filter(b => normalizeJam(b.jam) === targetJam).length >= (bookingConfig.slotCapacity || 1);

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
            let dmsBookingStatus = 'waiting_approval';
            let dmsBookingVia = user ? `Booking via: ${user.name}` : 'Web-Public';

            const vehicleData = await checkDmsVehicle(cleanPlat);
            if (vehicleData) {
                const dmsOk = await createDmsBooking(vehicleData);
                if (dmsOk) {
                    dmsSynced = true;
                    dmsBookingStatus = 'accepted';
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
                namaCustomer: formData.namaCustomer,
                bookingVia: dmsBookingVia,
                noTelp: formData.noTelp,
                keperluanService: formData.keluhan,
                ip_address: userIP,
                status: dmsBookingStatus
            });

            if (error) throw error;

            // Auto-create customer entry in customers table if new plate
            try {
                const { data: byPlate } = await db.select('customers', {
                    select: 'id',
                    eq: { no_bk: cleanPlat }
                });
                const { data: byPhone } = await db.select('customers', {
                    select: 'id',
                    eq: { no_hp: formData.noTelp }
                });
                if ((!byPlate || byPlate.length === 0) && (!byPhone || byPhone.length === 0)) {
                    const custId = Date.now() + Math.floor(Math.random() * 1000);
                    await db.insert('customers', {
                        id: custId,
                        no_hp: formData.noTelp,
                        password: Math.random().toString(36).slice(2, 10),
                        nama: formData.namaCustomer,
                        no_bk: cleanPlat,
                        status: 'active'
                    }).catch((custErr) => {
                        console.warn('Auto-create customer non-critical:', custErr);
                    });
                }
            } catch (custErr) {
                console.warn('Customer check non-critical:', custErr);
            }

            if (dmsSynced) {
                Toastify({ text: '✅ Booking berhasil! Data kendaraan ditemukan di DMS & langsung aktif.', style: { background: 'green' } }).showToast();
            } else {
                Toastify({ text: '✅ Booking berhasil dikirim! Menunggu konfirmasi admin.', style: { background: 'green' } }).showToast();
            }

            setIsBookingMode(false);
            setFormData({ jam: '', noPlat: '', namaCustomer: '', noTelp: '', keluhan: '' });
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
        <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans relative">

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
            <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">

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
                            const isPast = new Date(item.date) < new Date().setHours(0, 0, 0, 0);

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
                                         <p className="text-[6.5px] md:text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 leading-none">Total Slots</p>
                                         <p className="text-sm md:text-base font-black text-white leading-none">
                                            {JAM_PILIHAN.length}
                                         </p>
                                     </div>
                                     <div className="bg-emerald-500/10 px-3 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-emerald-500/20 text-center flex flex-col items-center">
                                          <p className="text-[6.5px] md:text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none">Sisa Slot</p>
                                          <p className="text-sm md:text-base font-black text-emerald-400 leading-none">
                                             {!isSlotsReady ? '...' :
                                             (() => {
                                                  const occupiedCount = (bookingsForDate || []).length;
                                                  const totalCapacity = (JAM_PILIHAN.length || 0) * slotCapacity;
                                                 return Math.max(0, totalCapacity - occupiedCount);
                                             })()}
                                          </p>
                                      </div>
                                 </div>
                            </div>

                            <div className="flex-1 p-6 md:p-8 flex flex-col z-10 gap-6 md:gap-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {JAM_PILIHAN.map((jam, idx) => {
                                        const bookingsAtThisTime = bookingsForDate.filter(b => {
                                            return normalizeJam(b.jam) === normalizeJam(jam);
                                        });

                                        const isOccupied = bookingsAtThisTime.length >= slotCapacity;
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
                                                        <p className={`text-[8.5px] md:text-[10px] font-black uppercase tracking-widest mb-1 text-white opacity-80`}>
                                                            {!isSlotsReady ? 'Memuat data...' : isOccupied ? `Slot Penuh (${bookingsAtThisTime.length}/${slotCapacity})` : isPastTime ? 'Waktu Terlewati' : `Sisa Slot: ${Math.max(0, slotCapacity - bookingsAtThisTime.length)} Unit`}
                                                        </p>
                                                        <h4 className={`text-sm md:text-base font-black tracking-tight text-white`}>
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
                                    <img src={orientalLogo} alt="Chery VIP" className="h-10 mx-auto -mt-2 mb-3 object-contain opacity-90 drop-shadow-xl" />
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
                                            <button type="button" onClick={() => setFormData({ ...formData, namaCustomer: user.name || '', noTelp: user.username || '', noPlat: user.plat_bk || '' })}
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
                                                <input required type="text" value={formData.noPlat} onChange={e => setFormData({ ...formData, noPlat: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-white transition-all uppercase placeholder:text-zinc-600" placeholder="BK 1234 AB" />
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
