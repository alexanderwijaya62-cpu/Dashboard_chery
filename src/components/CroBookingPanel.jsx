import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info, Search, Send, Plus, ShieldCheck, Truck, X, Edit3, Upload, AlertTriangle, Check as CheckIcon, Database } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import DmsBookingListView from './DmsBookingListView';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';
import { normalizeDmsBooking } from '../utils/dateHelpers';
import BookingCalendar from './BookingCalendar';

const TIPE_MOBIL = [
    "Tiggo 5x", "Tiggo Cross", "Tiggo Cross Csh", "Tiggo 7", "Tiggo 8 Pro",
    "Tiggo 8", "Tiggo 8 Csh", "Tiggo 9 Csh", "J6", "Omoda 5", "Omoda EV",
    "Omoda 5 GT", "Chery C5", "Chery C5 Csh", "J5", "J7", "J8"
];

const KEPERLUAN = ["Free Service 1", "Free Service 2", "Free Service 3", "General Repair", "Perawatan Berkala", "Claim Warranty"];

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

export default function CroBookingPanel({ user }) {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [step, setStep] = useState('search'); // 'search' | 'form'

    // Slot config from Supabase
    const [slotConfig, setSlotConfig] = useState({ count: 4, gap: 30, startH: 8, startM: 0, slotCapacity: 1 });
    const [bookings, setBookings] = useState([]);
    useEffect(() => {
        (async () => {
            try {
                const config = await fetchBookingConfig();
                setSlotConfig({
                    count: config.slotCount,
                    gap: config.gapMinutes,
                    startH: config.startHour,
                    startM: config.startMinute,
                    slotCapacity: config.slotCapacity,
                });
            } catch (_) {}
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const dateStr = yesterday.toISOString().split('T')[0];
                const { data } = await db.select('booking', {
                    select: 'id, tanggal, jam, status',
                    gte: { tanggal: dateStr }
                });
                let merged = Array.isArray(data) ? [...data] : [];

                // === Fetch DMS internal bookings ===
                try {
                    const now = new Date();
                    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                    const to = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
                    const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&datefrom=${from}&dateto=${to}&length=500`);
                    if (dmsRes.ok) {
                        const dmsJson = await dmsRes.json();
                        const dmsEntries = (dmsJson.data || []).map(normalizeDmsBooking).filter(Boolean).filter(b => b.tanggal >= dateStr);
                        merged = [...merged, ...dmsEntries];
                    }
                } catch (dmsErr) {
                    console.warn('Gagal fetch DMS bookings:', dmsErr);
                }

                // Dedup by plate + date + time (Supabase first, DMS only if not already present)
                const dedupKey = (b) => `${(b.noPlat || '').replace(/\s+/g, '').toUpperCase()}_${b.tanggal}_${String(b.jam || '').replace(':', '.')}`;
                const seenKeys = new Set();
                const deduped = [];
                merged.forEach(b => {
                    const key = dedupKey(b);
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        deduped.push(b);
                    }
                });

                setBookings(deduped);
            } catch (_) {}
        })();
    }, [refreshTrigger]);

    // Vehicle search state
    const [plateSearch, setPlateSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [foundVehicle, setFoundVehicle] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [isManual, setIsManual] = useState(false);
    const [holidays, setHolidays] = useState([]);

    useEffect(() => { fetchHolidays().then(setHolidays); }, []);

    // Form State
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jam: '',
        atasNama: '',
        noTelp: '',
        keluhan: '',
        km: '',
        noPolisi: '',
        modelKendaraan: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tab for booking list view
    const [bookingListTab, setBookingListTab] = useState('dms'); // 'dms' | 'supabase'

    // Import state
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [parsedRows, setParsedRows] = useState([]);
    const [importErrors, setImportErrors] = useState([]);
    const [isImporting, setIsImporting] = useState(false);

    const parseDateDMY = (str) => {
        const trimmed = (str || '').trim();
        // dd/mm/yyyy or d/m/yyyy
        const parts = trimmed.split('/');
        if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y.length === 4) {
                return `${y}-${m}-${d}`;
            }
        }
        return null;
    };

    const parseImportRows = (text) => {
        const rows = [];
        const errs = [];
        let row = [];
        let field = '';
        let inQuote = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuote) {
                if (ch === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuote = false;
                    }
                } else {
                    field += ch;
                }
            } else {
                if (ch === '"' && field === '') {
                    inQuote = true;
                } else if (ch === '\t') {
                    row.push(field);
                    field = '';
                } else if (ch === '\n' || ch === '\r') {
                    if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                    row.push(field);
                    field = '';
                    if (row.some(c => c.trim())) rows.push(row);
                    row = [];
                } else {
                    field += ch;
                }
            }
        }
        if (field.trim() || row.some(c => c.trim())) {
            row.push(field);
            if (row.some(c => c.trim())) rows.push(row);
        }
        const parsed = rows.map((cols, idx) => {
            const dateRaw = (cols[0] || '').trim();
            const jam = (cols[1] || '').trim().replace(':', '.');
            const tipeUnit = (cols[2] || '').trim();
            const noPlat = (cols[3] || '').trim().toUpperCase().replace(/\s+/g, '');
            const namaCustomer = (cols[4] || '').trim();
            const keluhan = (cols[5] || '').trim();
            const km = (cols[6] || '').trim();
            const bookingVia = (cols[7] || '').trim();
            const noTelp = (cols[8] || '').trim();

            const tanggal = parseDateDMY(dateRaw);
            const issues = [];
            if (!tanggal) issues.push('Tanggal tidak valid (dd/mm/yyyy)');
            if (!jam) issues.push('Jam kosong');
            if (!noPlat) issues.push('Plat kosong');
            if (!namaCustomer) issues.push('Nama kosong');
            if (!keluhan) issues.push('Keluhan kosong');
            if (!noTelp) issues.push('No Telp kosong');

            if (issues.length > 0) {
                errs.push({ row: idx + 1, issues, plat: noPlat || '-' });
            }
            return { tanggal, jam, tipeUnit, noPlat, namaCustomer, keluhan, km, bookingVia, noTelp, _valid: issues.length === 0, _rowNum: idx + 1 };
        });
        setParsedRows(parsed);
        setImportErrors(errs);
    };

    const handleImport = async () => {
        const valid = parsedRows.filter(r => r._valid);
        if (valid.length === 0) { Toastify({ text: 'Tidak ada data valid untuk diimport!', background: '#ef4444' }).showToast(); return; }

        // Cek duplikat plat: cari plat yg sudah ada booking active di tanggal yg sama
        const plateList = [...new Set(valid.map(r => r.noPlat))];
        const { data: existing } = await db.select('booking', {
            select: 'noPlat, tanggal, status',
            in: { noPlat: plateList },
        });
        const existingMap = new Map();
        (existing || []).forEach(e => {
            const plat = (e.noPlat || '').replace(/\s+/g, '').toUpperCase();
            if (!existingMap.has(plat)) existingMap.set(plat, []);
            existingMap.get(plat).push(e);
        });

        setIsImporting(true);
        let success = 0;
        let failed = 0;
        let dmsSync = 0;
        const skipReasons = [];

        // Cache DMS vehicle lookups per plate
        const dmsVehicleCache = new Map();

        for (const row of valid) {
            // Cek duplikat per tanggal
            const existingForPlat = existingMap.get(row.noPlat) || [];
            const dupe = existingForPlat.find(e =>
                e.tanggal === row.tanggal &&
                ['waiting_approval', 'waiting confirm', 'accepted', 'synced'].includes(e.status)
            );
            if (dupe) {
                skipReasons.push(`Baris ${row._rowNum}: ${row.noPlat} sudah booking aktif di ${row.tanggal}`);
                failed++;
                continue;
            }

            // Insert ke Supabase dulu
            const { data: inserted, error } = await db.insert('booking', {
                id: Date.now() + Math.floor(Math.random() * 10000) + success,
                tanggal: row.tanggal,
                jam: row.jam,
                noPlat: row.noPlat,
                namaCustomer: row.namaCustomer,
                noTelp: row.noTelp,
                tipeMobil: row.tipeUnit,
                keperluanService: row.keluhan,
                bookingVia: row.bookingVia || 'CRO Import',
                status: 'accepted',
                keluhanDetail: [row.tipeUnit, row.km].filter(Boolean).join(' | '),
            });
            if (error) { failed++; skipReasons.push(`Baris ${row._rowNum}: ${row.noPlat} — ${error.message}`); continue; }

            const bookingId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

            // Sync ke DMS kalau kendaraan terdaftar
            try {
                let vehicle = dmsVehicleCache.get(row.noPlat);
                if (!vehicle) {
                    const res = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${row.noPlat}&q=${row.noPlat}`);
                    const json = await res.json();
                    vehicle = (Array.isArray(json) && json.find(v =>
                        (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === row.noPlat
                    )) || null;
                    dmsVehicleCache.set(row.noPlat, vehicle);
                }

                if (vehicle) {
                    const targetJam = row.jam.replace('.', ':') + ':00';
                    const janjiDatang = `${row.tanggal} ${targetJam}`;
                    const postData = {
                        uniqid: Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
                        id_kendaraan: vehicle.id_kendaraan || '',
                        no_polisi: vehicle.no_polisi,
                        model_kendaraan: vehicle.model_kendaraan || vehicle.nama_kendaraan || row.tipeUnit || '',
                        nama_kendaraan: vehicle.nama_kendaraan || row.tipeUnit || '',
                        tipe_kendaraan: vehicle.tipe_kendaraan || '',
                        no_chassis: vehicle.no_chassis || '',
                        group_kendaraan: vehicle.group_kendaraan || 'PC',
                        no_pelanggan: vehicle.no_pelanggan || '',
                        id_pelanggan: vehicle.id_pelanggan || '',
                        tipe_pelanggan: vehicle.tipe_pelanggan || 'PRIBADI',
                        nama_pelanggan: vehicle.nama_pelanggan || row.namaCustomer,
                        no_telp_pelanggan: vehicle.no_telp || row.noTelp,
                        alamat_pelanggan: vehicle.alamat || '-',
                        atas_nama_booking: row.namaCustomer,
                        no_telp_booking: row.noTelp,
                        janji_datang: janjiDatang,
                        keluhan: row.keluhan || '-',
                        booking_via: row.bookingVia || 'CRO Import',
                        booking_via_personal: row.bookingVia || '',
                        km: row.km || '0'
                    };
                    const formDataBody = new URLSearchParams();
                    Object.entries(postData).forEach(([k, v]) => formDataBody.set(k, v));

                    const dmsRes = await fetch('/api/chery_dms?endpoint=booking-create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formDataBody.toString()
                    });
                    const dmsJson = await dmsRes.json();

                    if (dmsJson.success && bookingId) {
                        dmsSync++;
                        await db.update('booking', {
                            bookingVia: (row.bookingVia || 'CRO Import') + ' (DMS Synced)',
                            status: 'synced'
                        }, { eq: { id: bookingId } });
                    }
                }
            } catch (syncErr) {
                console.warn(`DMS sync error for ${row.noPlat}:`, syncErr);
            }

            success++;
        }

        const syncMsg = dmsSync > 0 ? ` (${dmsSync} sync DMS)` : '';
        Toastify({
            text: `✅ ${success} berhasil diimport${syncMsg}` + (skipReasons.length > 0 ? `, ${skipReasons.length} gagal` : ''),
            background: failed > 0 ? '#f59e0b' : '#10b981',
            duration: 5000
        }).showToast();
        if (skipReasons.length > 0) console.warn('Import skips:', skipReasons.join(' | '));

        if (success > 0) {
            setShowImport(false);
            setImportText('');
            setParsedRows([]);
            setImportErrors([]);
            setRefreshTrigger(prev => prev + 1);
        }
        setIsImporting(false);
    };

    // Calendar
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());

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

    const dateFillMap = useMemo(() => {
        const map = {};
        const allSlots = generateSlots(slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM);
        const totalCapacity = allSlots.length * slotConfig.slotCapacity;
        bookings.forEach(b => {
            if (b.status !== 'waiting confirm' && b.status !== 'accepted' && b.status !== 'completed') return;
            if (!b.tanggal) return;
            map[b.tanggal] = (map[b.tanggal] || 0) + 1;
        });
        Object.keys(map).forEach(d => { map[d] = { count: map[d], total: totalCapacity, full: map[d] >= totalCapacity, partial: map[d] > 0 && map[d] < totalCapacity }; });
        return map;
    }, [bookings, slotConfig]);

    const changeCalMonth = (offset) => {
        const next = new Date(currentCalMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentCalMonth(next);
    };

    const handleSearchVehicle = async (e) => {
        e.preventDefault();
        const cleanPlat = plateSearch.toUpperCase().replace(/\s+/g, '');
        if (!cleanPlat) return;

        setIsSearching(true);
        setSearchError('');
        setFoundVehicle(null);

        try {
            const res = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${cleanPlat}&q=${cleanPlat}`);
            const json = await res.json();

            const matched = Array.isArray(json) && json.find(v =>
                (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === cleanPlat
            );

            if (matched) {
                setFoundVehicle(matched);
                setFormData(prev => ({
                    ...prev,
                    atasNama: matched.nama_pelanggan || '',
                    noTelp: matched.no_telp || ''
                }));
                Toastify({ text: "Kendaraan ditemukan di DMS!", background: "green" }).showToast();
            } else {
                setSearchError('Kendaraan tidak ditemukan di DMS. Periksa no polisi.');
                Toastify({ text: "Kendaraan tidak ditemukan!", background: "orange" }).showToast();
            }
        } catch (err) {
            setSearchError('Gagal mencari kendaraan. Coba lagi.');
            Toastify({ text: `Error: ${err.message}`, background: "red" }).showToast();
        } finally {
            setIsSearching(false);
        }
    };

    const handleUseVehicle = () => {
        setIsManual(false);
        setStep('form');
    };

    const resetModal = () => {
        setIsModalOpen(false);
        setStep('search');
        setPlateSearch('');
        setFoundVehicle(null);
        setSearchError('');
        setIsManual(false);
        setFormData({
            tanggal: new Date().toISOString().split('T')[0],
            jam: '',
            atasNama: '',
            noTelp: '',
            keluhan: '',
            km: '',
            noPolisi: '',
            modelKendaraan: '',
        });
        setCurrentCalMonth(new Date());
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (!formData.jam || !formData.atasNama) {
            Toastify({ text: "Harap isi jam dan nama booking!", background: "orange" }).showToast();
            return;
        }

        if (isHolidayOrSunday(formData.tanggal, holidays)) {
            Toastify({ text: "Tidak bisa booking di hari libur atau Minggu!", background: "red" }).showToast();
            return;
        }

        setIsSubmitting(true);
        try {
            if (isManual) {
                const { error } = await db.insert('booking', {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    tanggal: formData.tanggal,
                    jam: formData.jam,
                    noPlat: formData.noPolisi,
                    namaCustomer: formData.atasNama,
                    noTelp: formData.noTelp,
                    tipeMobil: formData.modelKendaraan || '-',
                    keperluanService: formData.keluhan || '-',
                    status: 'accepted',
                    bookingVia: 'CRO Booking (Manual)',
                });
                if (error) throw error;
                Toastify({ text: "Booking BERHASIL!", background: "green" }).showToast();
                resetModal();
                return;
            }
            // === ALWAYS save to Supabase first ===
            const vehiclePlate = foundVehicle?.no_polisi || formData.noPolisi;
            const vehicleModel = foundVehicle?.nama_kendaraan || foundVehicle?.model_kendaraan || formData.modelKendaraan || '-';

            const { data: inserted, error: insertErr } = await db.insert('booking', {
                id: Date.now() + Math.floor(Math.random() * 1000),
                tanggal: formData.tanggal,
                jam: formData.jam,
                noPlat: vehiclePlate,
                namaCustomer: formData.atasNama,
                noTelp: formData.noTelp,
                tipeMobil: vehicleModel,
                keperluanService: formData.keluhan || '-',
                status: 'accepted',
                bookingVia: 'CRO Booking',
            });
            if (insertErr) throw insertErr;

            const bookingId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

            // === Sync ke DMS sebagai bonus ===
            let dmsSynced = false;
            try {
                const targetJam = formData.jam.replace('.', ':') + ':00';
                const janjiDatang = `${formData.tanggal} ${targetJam}`;

                const postData = {
                    uniqid: Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
                    id_kendaraan: foundVehicle.id_kendaraan || '',
                    no_polisi: foundVehicle.no_polisi,
                    model_kendaraan: foundVehicle.model_kendaraan || foundVehicle.nama_kendaraan || formData.modelKendaraan || '',
                    nama_kendaraan: foundVehicle.nama_kendaraan || formData.modelKendaraan || '',
                    tipe_kendaraan: foundVehicle.tipe_kendaraan || '',
                    no_chassis: foundVehicle.no_chassis || '',
                    group_kendaraan: foundVehicle.group_kendaraan || 'PC',
                    no_pelanggan: foundVehicle.no_pelanggan || '',
                    id_pelanggan: foundVehicle.id_pelanggan || '',
                    tipe_pelanggan: foundVehicle.tipe_pelanggan || 'PRIBADI',
                    nama_pelanggan: foundVehicle.nama_pelanggan || formData.atasNama,
                    no_telp_pelanggan: foundVehicle.no_telp || formData.noTelp,
                    alamat_pelanggan: foundVehicle.alamat || '-',
                    atas_nama_booking: formData.atasNama,
                    no_telp_booking: formData.noTelp,
                    janji_datang: janjiDatang,
                    keluhan: formData.keluhan || '-',
                    booking_via: 'WA CS Service / CRO',
                    booking_via_personal: '',
                    km: formData.km || '0'
                };

                const formDataBody = new URLSearchParams();
                Object.entries(postData).forEach(([k, v]) => formDataBody.set(k, v));

                const res = await fetch('/api/chery_dms?endpoint=booking-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formDataBody.toString()
                });

                const json = await res.json();
                if (json.success) {
                    dmsSynced = true;
                } else {
                    console.warn('DMS booking-create gagal:', json.message);
                }
            } catch (syncErr) {
                console.warn('DMS sync error:', syncErr);
            }

            // === Update bookingVia jika DMS berhasil ===
            if (bookingId && dmsSynced) {
                await db.update('booking', {
                    bookingVia: 'CRO Booking (DMS Synced)'
                }, { eq: { id: bookingId } });
            }

            Toastify({
                text: dmsSynced
                    ? 'Booking BERHASIL & tersinkronisasi ke DMS!'
                    : 'Booking BERHASIL!',
                background: 'green',
                duration: 5000
            }).showToast();
            resetModal();
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            Toastify({ text: `ERROR: ${err.message}`, background: "red", duration: 5000 }).showToast();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 w-full max-w-[100vw] bg-white relative overflow-hidden flex flex-col h-full animate-fade-in transition-colors duration-500 p-0">
            {/* Header */}
            <div className="flex justify-between items-center px-4 md:px-6 py-3 shrink-0 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                    <div className="bg-black p-2 rounded-lg text-white">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-zinc-900 leading-none">Booking Management</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setImportText(''); setParsedRows([]); setImportErrors([]); setShowImport(true); }}
                        className="min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-zinc-200"
                    >
                        <Upload size={14} /> Import
                    </button>
                    <button
                        onClick={() => { resetModal(); setIsModalOpen(true); }}
                        className="min-h-[44px] bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-zinc-200 group"
                    >
                        <Plus size={14} className="group-hover:rotate-90 transition-transform" /> New
                    </button>
                </div>
            </div>

            {/* Tab: DMS vs Supabase */}
            <div className="flex mx-4 md:mx-6 mt-3 bg-zinc-100 rounded-xl p-1 shrink-0">
                <button onClick={() => setBookingListTab('dms')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${bookingListTab === 'dms' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    <Database size={12} className="inline mr-1.5 mb-0.5" />DMS List
                </button>
                <button onClick={() => setBookingListTab('supabase')}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${bookingListTab === 'supabase' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    <Calendar size={12} className="inline mr-1.5 mb-0.5" />Supabase Bookings
                </button>
            </div>

            {/* Content */}
            {bookingListTab === 'dms' ? (
                <div className="flex-1 overflow-hidden">
                    <DmsBookingListView user={user} refreshTrigger={refreshTrigger} />
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <SupabaseBookingList refreshTrigger={refreshTrigger} />
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-white z-[999] flex flex-col animate-fade-in overflow-hidden">
                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <button onClick={() => setShowImport(false)} className="absolute top-6 right-8 p-3 bg-zinc-100 hover:bg-black text-black hover:text-white rounded-2xl transition-all z-[1000] shadow-sm">
                            <X size={24} />
                        </button>

                        <div className="px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-10 flex-1 flex flex-col overflow-hidden">
                            <h2 className="text-xl font-black text-zinc-900 mb-1">Import Booking</h2>
                            <p className="text-xs font-bold text-zinc-400 mb-6">Paste data dari Excel (tab-separated)</p>

                            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                                {/* Left: Input */}
                                <div className="lg:w-1/2 flex flex-col gap-4">
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                                        <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Urutan Kolom (tab-separated)</h3>
                                        <div className="text-[10px] font-mono font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl p-3 leading-relaxed">
                                            1. Tanggal (dd/mm/yyyy) <span className="text-zinc-300">|</span> 2. Jam <span className="text-zinc-300">|</span> 3. Tipe Unit <span className="text-zinc-300">|</span> 4. No Polisi <span className="text-zinc-300">|</span> 5. Nama Customer <span className="text-zinc-300">|</span> 6. Keperluan Service <span className="text-zinc-300">|</span> 7. KM <span className="text-zinc-300">|</span> 8. Booking Via <span className="text-zinc-300">|</span> 9. No Telp
                                        </div>
                                        <p className="text-[8px] font-bold text-zinc-400 mt-1">* opsional</p>
                                    </div>

                                    <textarea value={importText} onChange={e => { setImportText(e.target.value); parseImportRows(e.target.value); }}
                                        placeholder={`11/07/2026\t08:30\tCHERY C5\tBL 1755 DN\tDHARA AFRISSA\tService 15.000km, pasang part dan pentil\t\tSA\t895-0543-0261`}
                                        className="w-full flex-1 min-h-[200px] bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 text-xs font-mono font-bold text-zinc-900 focus:border-black focus:bg-white outline-none transition-all resize-none"
                                    />

                                    <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-400">
                                        <Info size={12} />
                                        {importText.trim() ? `${parsedRows.length} baris terdeteksi` : 'Tempel data dari Excel'}
                                    </div>

                                    {importErrors.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-1 max-h-[120px] overflow-y-auto">
                                            {importErrors.map((e, i) => (
                                                <p key={i} className="text-[9px] font-bold text-red-700">
                                                    Baris {e.row}: {e.issues.join(', ')}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Preview */}
                                <div className="lg:w-1/2 flex flex-col gap-4">
                                    <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                        <CheckIcon size={12} className="text-emerald-500" />
                                        Preview ({parsedRows.filter(r => r._valid).length} valid)
                                    </h3>
                                    <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl">
                                        <table className="w-full text-[9px]">
                                            <thead className="bg-zinc-100 sticky top-0">
                                                <tr className="text-zinc-500 font-black uppercase tracking-wider">
                                                    <th className="p-2 text-left">#</th>
                                                    <th className="p-2 text-left">Tgl</th>
                                                    <th className="p-2 text-left">Jam</th>
                                                    <th className="p-2 text-left">Plat</th>
                                                    <th className="p-2 text-left">Nama</th>
                                                    <th className="p-2 text-left">Telp</th>
                                                    <th className="p-2 text-left">Via</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedRows.map((r, i) => (
                                                    <tr key={i} className={`border-t border-zinc-100 ${r._valid ? '' : 'bg-red-50 text-zinc-400'}`}>
                                                        <td className="p-2 font-bold text-zinc-400">{r._rowNum}</td>
                                                        <td className="p-2 font-bold">{r.tanggal || '-'}</td>
                                                        <td className="p-2 font-bold">{r.jam || '-'}</td>
                                                        <td className="p-2 font-bold">{r.noPlat || '-'}</td>
                                                        <td className="p-2 font-bold truncate max-w-[120px]">{r.namaCustomer || '-'}</td>
                                                        <td className="p-2 font-bold">{r.noTelp || '-'}</td>
                                                        <td className="p-2 font-bold">{r.bookingVia || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button onClick={handleImport} disabled={isImporting || parsedRows.filter(r => r._valid).length === 0}
                                        className="w-full bg-zinc-900 hover:bg-black disabled:bg-zinc-200 text-white disabled:text-zinc-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        {isImporting ? (
                                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
                                        ) : (
                                            <><Upload size={16} /> Import {parsedRows.filter(r => r._valid).length} Booking</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Booking Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-white z-[999] flex flex-col animate-fade-in overflow-hidden">
                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <button onClick={resetModal} className="absolute top-6 right-8 p-3 bg-zinc-100 hover:bg-black text-black hover:text-white rounded-2xl transition-all z-[1000] shadow-sm">
                            <X size={24} />
                        </button>

                        <div className="px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-10 flex-1 flex flex-col overflow-hidden">
                            {/* Step indicator */}
                            <div className="mb-6 flex items-center gap-4 border-b border-zinc-100 pb-4 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${step === 'search' ? 'bg-black text-white' : 'bg-green-500 text-white'}`}>1</div>
                                    <span className={`text-xs font-black uppercase tracking-widest ${step === 'search' ? 'text-zinc-900' : 'text-green-600'}`}>Cari Kendaraan</span>
                                </div>
                                <div className="h-px flex-1 bg-zinc-200 max-w-[60px]"></div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${step === 'form' ? 'bg-black text-white' : 'bg-zinc-200 text-zinc-400'}`}>2</div>
                                    <span className={`text-xs font-black uppercase tracking-widest ${step === 'form' ? 'text-zinc-900' : 'text-zinc-300'}`}>Detail Booking</span>
                                </div>
                            </div>

                            {/* STEP 1: Vehicle Search */}
                            {step === 'search' && (
                                <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                                        <Truck size={28} className="text-zinc-800" />
                                    </div>
                                    <h3 className="text-xl font-black text-zinc-900 mb-2">Cari Kendaraan</h3>
                                    <p className="text-xs font-bold text-zinc-400 mb-8 text-center">Masukkan nomor polisi untuk mencari data kendaraan di DMS</p>

                                    <form onSubmit={handleSearchVehicle} className="w-full space-y-4">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={plateSearch}
                                                onChange={e => { setPlateSearch(e.target.value); setFoundVehicle(null); setSearchError(''); }}
                                                placeholder="BK 1234 AB"
                                                className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 pl-12 text-sm font-bold text-zinc-900 uppercase focus:bg-white focus:border-black outline-none transition-all"
                                                autoFocus
                                            />
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        </div>

                                        {searchError && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2">
                                                <Info size={14} /> {searchError}
                                            </div>
                                        )}

                                        {searchError && (
                                            <div className="relative flex items-center gap-3 py-2">
                                                <div className="flex-1 h-px bg-zinc-200"></div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Atau</span>
                                                <div className="flex-1 h-px bg-zinc-200"></div>
                                            </div>
                                        )}

                                        {searchError ? (
                                            <button type="button" onClick={() => { setIsManual(true); setFormData(prev => ({ ...prev, noPolisi: plateSearch.toUpperCase() })); setStep('form'); }}
                                                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                                            >
                                                <Edit3 size={16} /> Isi Data Manual
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={isSearching || !plateSearch.trim()}
                                                className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                                            >
                                                {isSearching ? 'Mencari...' : 'Cari Kendaraan'}
                                                <Search size={16} />
                                            </button>
                                        )}
                                    </form>

                                    {foundVehicle && (
                                        <div className="w-full mt-6 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                                                <div className="flex items-center gap-2 text-emerald-800 font-black uppercase text-[10px] tracking-wider mb-3">
                                                    <ShieldCheck size={14} /> Data Kendaraan Ditemukan
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-zinc-600 mb-4">
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">No Polisi</span><strong className="text-zinc-900 font-black">{foundVehicle.no_polisi}</strong></div>
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Pemilik</span><strong className="text-zinc-900 font-black">{foundVehicle.nama_pelanggan}</strong></div>
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Model</span><strong className="text-zinc-900 font-black">{foundVehicle.nama_kendaraan || foundVehicle.model_kendaraan || foundVehicle.tipe_kendaraan}</strong></div>
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">No Rangka</span><strong className="text-zinc-900 font-black font-mono">{foundVehicle.no_chassis}</strong></div>
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">No Telp</span><strong className="text-zinc-900 font-black">{foundVehicle.no_telp}</strong></div>
                                                    <div><span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Tipe</span><strong className="text-zinc-900 font-black">{foundVehicle.tipe_kendaraan}</strong></div>
                                                </div>
                                                <button onClick={handleUseVehicle}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                                                >
                                                    Gunakan Kendaraan Ini <Send size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: Booking Form */}
                            {step === 'form' && (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 flex-1 overflow-y-auto lg:overflow-hidden h-full">
                                        {/* Column 1: Calendar */}
                                        <div className="space-y-4 flex flex-col h-full lg:border-r border-zinc-100 lg:pr-6">
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                                <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">1</div> Pilih Tanggal
                                            </h3>

                                            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-5 shadow-sm">
                                                <BookingCalendar
                                                    bookings={bookings}
                                                    slotConfig={slotConfig}
                                                    selectedDate={formData.tanggal}
                                                    selectedTime={formData.jam}
                                                    holidays={holidays}
                                                    onDateSelect={(date) => setFormData({ ...formData, tanggal: date, jam: '' })}
                                                    onTimeSelect={(slot) => setFormData({ ...formData, jam: slot })}
                                                    showTimeSlots={false}
                                                />
                                            </div>

                                            {/* Quick time slots */}
                                            <div className="space-y-2">
                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Jam Kedatangan</h4>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {generateSlots(slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM).map((slot) => {
                                                        const [h, m] = slot.split('.');
                                                        const isPastTime = formData.tanggal === new Date().toISOString().split('T')[0] && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                                                        const count = bookings.filter(b =>
                                                            b.tanggal === formData.tanggal &&
                                                            String(b.jam).replace(':', '.') === slot &&
                                                            (b.status === 'waiting confirm' || b.status === 'accepted' || b.status === 'completed')
                                                        ).length;
                                                        const isFull = count >= slotConfig.slotCapacity;
                                                        return (
                                                            <button key={slot} type="button" disabled={isPastTime || (isFull && formData.jam !== slot)}
                                                                onClick={() => setFormData({ ...formData, jam: slot })}
                                                                className={`py-2.5 px-2 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all ${formData.jam === slot ? 'bg-black border-black text-white shadow-lg' :
                                                                    isPastTime || isFull ? 'bg-zinc-50 border-transparent text-zinc-200 cursor-not-allowed' : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                                                }`}
                                                            >
                                                                {h}:{m} WIB
                                                                <span className="text-[6px] opacity-70 block">{count}/{slotConfig.slotCapacity}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Vehicle info + fields */}
                                        <div className="space-y-6 flex flex-col h-full lg:border-r border-zinc-100 lg:pr-6">
                                            {isManual ? (
                                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase text-amber-700 tracking-wider mb-3">
                                                        <Edit3 size={12} /> Data Manual
                                                    </div>
                                                    <div className="space-y-3">
                                                        <input required type="text" placeholder="No Polisi"
                                                            className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:border-amber-500 outline-none transition-all"
                                                            value={formData.noPolisi} onChange={e => setFormData({ ...formData, noPolisi: e.target.value.toUpperCase() })} />
                                                        <input type="text" placeholder="Model Kendaraan (opsional)"
                                                            className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:border-amber-500 outline-none transition-all"
                                                            value={formData.modelKendaraan} onChange={e => setFormData({ ...formData, modelKendaraan: e.target.value })} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
                                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-2">
                                                        <ShieldCheck size={12} className="text-emerald-600" /> Data Kendaraan
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                                                        <span className="text-zinc-400">No Polisi:</span>
                                                        <span className="font-black text-zinc-900">{foundVehicle?.no_polisi}</span>
                                                        <span className="text-zinc-400">Model:</span>
                                                        <span className="font-black text-zinc-900">{foundVehicle?.nama_kendaraan || foundVehicle?.model_kendaraan}</span>
                                                        <span className="text-zinc-400">Pemilik:</span>
                                                        <span className="font-black text-zinc-900">{foundVehicle?.nama_pelanggan}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <form id="bookingForm" onSubmit={handleFormSubmit} className="space-y-4">
                                                <div className="space-y-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Atas Nama Booking</h4>
                                                    <input required type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[40px]" placeholder="Nama booking" value={formData.atasNama} onChange={e => setFormData({ ...formData, atasNama: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">No Telp Booking</h4>
                                                    <input type="tel" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[40px]" placeholder="08..." value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">KM Kendaraan</h4>
                                                    <input type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[40px]" placeholder="Masukkan KM" value={formData.km} onChange={e => setFormData({ ...formData, km: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Keluhan</h4>
                                                    <textarea className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[80px]" placeholder="Deskripsi keluhan (opsional)" value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })} />
                                                </div>
                                            </form>
                                        </div>

                                        {/* Column 3: Summary & Submit */}
                                        <div className="space-y-6 flex flex-col h-full bg-zinc-50/50 p-4 md:p-6 lg:border-l border-zinc-100">
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                                <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">3</div> Konfirmasi
                                            </h3>

                                            <div className="space-y-3 flex-1">
                                                <div className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-zinc-400 font-bold">Tanggal</span>
                                                        <span className="font-black text-zinc-900">{formData.tanggal || '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-zinc-400 font-bold">Jam</span>
                                                        <span className="font-black text-zinc-900">{formData.jam ? `${formData.jam.replace('.', ':')} WIB` : '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-zinc-400 font-bold">Kendaraan</span>
                                                        <span className="font-black text-zinc-900">{isManual ? formData.noPolisi : foundVehicle?.no_polisi}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-zinc-400 font-bold">Atas Nama</span>
                                                        <span className="font-black text-zinc-900">{formData.atasNama || '-'}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white rounded-2xl border border-zinc-100">
                                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5">
                                                        <Info size={12} className="text-black" /> Informasi
                                                    </div>
                                                    <p className="text-[10px] font-bold text-zinc-600 leading-relaxed">{isManual ? 'Booking akan disimpan ke sistem internal. Data kendaraan bisa dilengkapi nanti.' : 'Booking akan dikirim ke DMS. Pastikan data sudah sesuai.'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <button type="button" onClick={() => setStep('search')}
                                                    className="w-full py-3 rounded-2xl border-2 border-zinc-200 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-all"
                                                >
                                                    Kembali
                                                </button>
                                                <button type="submit" form="bookingForm" disabled={isSubmitting}
                                                    className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-zinc-200 transition-all flex items-center justify-center gap-4 active:scale-95 group disabled:opacity-40"
                                                >
                                                    {isSubmitting ? 'Processing...' : 'Konfirmasi Booking'}
                                                    <Send size={16} className="group-hover:translate-x-2 group-hover:-translate-y-1 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Supabase Booking List ─── */
function SupabaseBookingList({ refreshTrigger }) {
    const [bookings, setBookings] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const today = new Date().toISOString().slice(0, 10);
                const { data } = await db.select('booking', {
                    select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, keluhanDetail',
                    gte: { tanggal: today },
                    order: { column: 'id', ascending: false },
                    limit: 200,
                });
                setBookings(data || []);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, [refreshTrigger]);

    const filtered = useMemo(() => {
        let list = bookings;
        if (filterDate) list = list.filter(b => b.tanggal === filterDate);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(b =>
                (b.noPlat || '').toLowerCase().includes(q) ||
                (b.namaCustomer || '').toLowerCase().includes(q) ||
                (b.noTelp || '').includes(q)
            );
        }
        return list;
    }, [bookings, search, filterDate]);

    const openEdit = (b) => {
        setEditItem(b);
        setEditForm({
            tanggal: b.tanggal || '',
            jam: (b.jam || '').replace('.', ':'),
            noPlat: b.noPlat || '',
            namaCustomer: b.namaCustomer || '',
            noTelp: b.noTelp || '',
            tipeMobil: b.tipeMobil || '',
            keperluanService: b.keperluanService || '',
            keluhanDetail: b.keluhanDetail || '',
            status: b.status || 'accepted',
        });
    };

    const handleEditSave = async () => {
        if (!editItem) return;
        try {
            const { error } = await db.update('booking', {
                tanggal: editForm.tanggal,
                jam: editForm.jam.replace(':', '.'),
                noPlat: editForm.noPlat,
                namaCustomer: editForm.namaCustomer,
                noTelp: editForm.noTelp,
                tipeMobil: editForm.tipeMobil,
                keperluanService: editForm.keperluanService,
                keluhanDetail: editForm.keluhanDetail,
                status: editForm.status,
            }, { eq: { id: editItem.id } });
            if (error) throw error;
            Toastify({ text: '✅ Booking berhasil diupdate', background: '#10b981' }).showToast();
            setEditItem(null);
            const today = new Date().toISOString().slice(0, 10);
            const { data } = await db.select('booking', { select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, keluhanDetail', gte: { tanggal: today }, order: { column: 'id', ascending: false }, limit: 200 });
            setBookings(data || []);
        } catch (e) {
            Toastify({ text: `❌ Gagal update: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus booking ini?')) return;
        try {
            const { error } = await db.delete('booking', { eq: { id } });
            if (error) throw error;
            Toastify({ text: '✅ Booking berhasil dihapus', background: '#10b981' }).showToast();
            setBookings(prev => prev.filter(b => b.id !== id));
        } catch (e) {
            Toastify({ text: `❌ Gagal hapus: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cari plat/nama/telp..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                </div>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                <span className="text-[9px] font-bold text-zinc-400">{filtered.length} booking</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl">
                <table className="w-full text-[10px]">
                    <thead className="bg-zinc-100 sticky top-0">
                        <tr className="text-zinc-500 font-black uppercase tracking-wider">
                            <th className="p-2.5 text-left">Tanggal</th>
                            <th className="p-2.5 text-left">Jam</th>
                            <th className="p-2.5 text-left">No Plat</th>
                            <th className="p-2.5 text-left">Nama</th>
                            <th className="p-2.5 text-left">Tipe</th>
                            <th className="p-2.5 text-left max-w-[200px]">Keluhan</th>
                            <th className="p-2.5 text-left">Via</th>
                            <th className="p-2.5 text-left">Status</th>
                            <th className="p-2.5 text-center w-[80px]">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="p-8 text-center text-zinc-400 font-bold">Memuat...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="9" className="p-8 text-center text-zinc-400 font-bold">Tidak ada booking</td></tr>
                        ) : filtered.map(b => (
                            <tr key={b.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-all">
                                <td className="p-2.5 font-bold text-zinc-700">{b.tanggal || '-'}</td>
                                <td className="p-2.5 font-bold text-zinc-700">{(b.jam || '').replace('.', ':')}</td>
                                <td className="p-2.5 font-black text-zinc-900 uppercase">{b.noPlat || '-'}</td>
                                <td className="p-2.5 font-bold text-zinc-700">{b.namaCustomer || '-'}</td>
                                <td className="p-2.5 text-zinc-500">{b.tipeMobil || '-'}</td>
                                <td className="p-2.5 text-zinc-500 max-w-[200px] truncate" title={b.keperluanService}>{b.keperluanService || '-'}</td>
                                <td className="p-2.5">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${(b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {(b.bookingVia || 'Supabase').length > 20 ? (b.bookingVia || '').slice(0, 18) + '...' : (b.bookingVia || 'Supabase')}
                                    </span>
                                </td>
                                <td className="p-2.5">
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : b.status === 'accepted' ? 'bg-green-50 text-green-700' : b.status === 'declined' ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-500'}`}>
                                        {b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'Synced (DMS)' : b.status || '-'}
                                    </span>
                                </td>
                                <td className="p-2.5">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => openEdit(b)}
                                            className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-800 hover:text-white transition-all text-zinc-500"
                                            title="Edit"><Edit3 size={12} /></button>
                                        <button onClick={() => handleDelete(b.id)}
                                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white transition-all text-red-500"
                                            title="Hapus"><X size={12} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={() => setEditItem(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-zinc-900 uppercase tracking-wider">Edit Booking</h3>
                            <button onClick={() => setEditItem(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={18} /></button>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Tanggal</label>
                                    <input type="date" value={editForm.tanggal} onChange={e => setEditForm(p => ({ ...p, tanggal: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Jam</label>
                                    <input type="time" value={editForm.jam} onChange={e => setEditForm(p => ({ ...p, jam: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">No Polisi</label>
                                <input type="text" value={editForm.noPlat} onChange={e => setEditForm(p => ({ ...p, noPlat: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none uppercase" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Nama Customer</label>
                                <input type="text" value={editForm.namaCustomer} onChange={e => setEditForm(p => ({ ...p, namaCustomer: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">No Telp</label>
                                <input type="text" value={editForm.noTelp} onChange={e => setEditForm(p => ({ ...p, noTelp: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Tipe Mobil</label>
                                <input type="text" value={editForm.tipeMobil} onChange={e => setEditForm(p => ({ ...p, tipeMobil: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Keperluan Service</label>
                                <textarea value={editForm.keperluanService} onChange={e => setEditForm(p => ({ ...p, keperluanService: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none resize-none min-h-[60px]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Status</label>
                                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none">
                                    <option value="accepted">Accepted</option>
                                    <option value="synced">Synced (DMS)</option>
                                    <option value="declined">Declined</option>
                                    <option value="waiting confirm">Waiting Confirm</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setEditItem(null)}
                                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Batal</button>
                            <button onClick={handleEditSave}
                                className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
