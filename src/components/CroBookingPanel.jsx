import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Info, Search, Send, Plus, ShieldCheck, Truck, X, Edit3, Upload, AlertTriangle, Check as CheckIcon, Database, RefreshCcw, Clock, User, Car, FileText, Activity, Zap, PlusCircle } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import DmsBookingListView from './DmsBookingListView';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots, getSlotsForDate, getCapacityForDate } from '../utils/bookingConfig';
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

export default function CroBookingPanel({ user, holidays: propsHolidays }) {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [step, setStep] = useState('search'); // 'search' | 'form'

    // Slot config from Supabase
    const [slotConfig, setSlotConfig] = useState({ slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1, saturdayEnabled: true, satSlotCount: 4, satGapMinutes: 30, satStartHour: 8, satStartMinute: 0, satSlotCapacity: 1 });
    const [bookings, setBookings] = useState([]);
    useEffect(() => {
        (async () => {
            try {
                const config = await fetchBookingConfig();
                setSlotConfig(config);
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
                    select: 'id, tanggal, jam, noPlat, status',
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
                const dedupKey = (b) => {
                    const plat = (b.noPlat || '').replace(/\s+/g, '').toUpperCase();
                    if (!plat) return `id_${b.id}`;
                    return `${plat}_${b.tanggal}_${String(b.jam || '').replace(':', '.')}`;
                };
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
    const [localHolidays, setLocalHolidays] = useState([]);
    const holidays = propsHolidays || localHolidays;

    useEffect(() => {
        if (!propsHolidays) {
            fetchHolidays().then(setLocalHolidays);
        }
    }, [propsHolidays]);

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
            if (ch === '"') {
                inQuote = !inQuote;
            } else if (ch === '\t' && !inQuote) {
                row.push(field);
                field = '';
            } else if ((ch === '\n' || ch === '\r') && !inQuote) {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                row.push(field);
                field = '';
                if (row.some(c => c.trim())) rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
        if (field.trim() || row.some(c => c.trim())) {
            row.push(field);
            if (row.some(c => c.trim())) rows.push(row);
        }
        const parsed = rows.map((cols, idx) => {
            const stripQuotes = s => s.replace(/^"(.*)"$/s, '$1').trim();
            const dateRaw = stripQuotes(cols[0] || '');
            const jam = stripQuotes(cols[1] || '').replace(':', '.');
            const tipeUnit = stripQuotes(cols[2] || '');
            const noPlat = stripQuotes(cols[3] || '').toUpperCase().replace(/\s+/g, '');
            const namaCustomer = stripQuotes(cols[4] || '');
            let keluhan = stripQuotes(cols[5] || '');
            const km = stripQuotes(cols[6] || '');
            let bookingVia = stripQuotes(cols[7] || '');
            let noTelp = stripQuotes(cols[8] || '');

            // Some DMS rows have "Name 08xxxx" in bookingVia column without separate noTelp column
            if (!noTelp && bookingVia) {
                const phoneMatch = bookingVia.match(/(08[\d\-]+)/);
                if (phoneMatch) {
                    noTelp = phoneMatch[1];
                    bookingVia = bookingVia.replace(phoneMatch[0], '').trim();
                }
            }

            if (!keluhan) keluhan = '-';

            const tanggal = parseDateDMY(dateRaw);
            const issues = [];
            if (!tanggal) issues.push('Tanggal tidak valid (dd/mm/yyyy)');
            if (!jam) issues.push('Jam kosong');
            if (!noPlat) issues.push('Plat kosong');
            if (!namaCustomer) issues.push('Nama kosong');

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
        bookings.forEach(b => {
            if (!['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'].includes(b.status)) return;
            if (!b.tanggal) return;
            const capacity = getCapacityForDate(b.tanggal, slotConfig);
            const slots = getSlotsForDate(b.tanggal, slotConfig);
            const dayTotal = slots.length * capacity;
            map[b.tanggal] = (map[b.tanggal] || { count: 0, total: dayTotal });
            map[b.tanggal].count += 1;
            map[b.tanggal].total = dayTotal;
        });
        Object.keys(map).forEach(d => {
            map[d] = {
                count: map[d].count,
                total: map[d].total,
                full: map[d].count >= map[d].total,
                partial: map[d].count > 0 && map[d].count < map[d].total,
            };
        });
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
        <div className="w-full max-w-[100vw] bg-white relative flex flex-col h-full animate-fade-in transition-colors duration-500 p-0">
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
                <div className="flex-1 min-h-0 overflow-hidden">
                    <DmsBookingListView user={user} refreshTrigger={refreshTrigger} />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <SupabaseBookingList refreshTrigger={refreshTrigger} slotConfig={slotConfig} allBookings={bookings} />
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

                        <div className="px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-4 flex-1 flex flex-col overflow-hidden">
                            {/* Step indicator */}
                            <div className="mb-3 flex items-center gap-4 border-b border-zinc-100 pb-2 shrink-0">
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
                                <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full overflow-y-auto custom-scrollbar py-4">
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
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 overflow-y-auto md:overflow-hidden custom-scrollbar">
                                        {/* Left Column: Calendar + Time Slots (5 cols) */}
                                        <div className="md:col-span-5 flex flex-col gap-2 md:border-r-2 border-zinc-100 md:pr-3 md:overflow-y-auto custom-scrollbar">
                                            <div>
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-1.5 mb-1">
                                                    <div className="w-5 h-5 bg-zinc-900 text-white rounded-md flex items-center justify-center text-[9px]">1</div> Pilih Tanggal & Jam
                                                </h3>

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

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                                    <Clock size={12} className="text-black" /> Jam Kedatangan
                                                </label>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                                    {(() => {
                                                        const slots = getSlotsForDate(formData.tanggal, slotConfig);
                                                        const toMin = (j) => {
                                                            if (!j) return -1;
                                                            const parts = String(j).replace(':', '.').split('.');
                                                            return parseInt(parts[0] || '0', 10) * 60 + parseInt(parts[1] || '0', 10);
                                                        };

                                                        return slots.map((slot, idx) => {
                                                            const [h, m] = slot.split('.');
                                                            const isPastTime = formData.tanggal === new Date().toISOString().split('T')[0] && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                                                            const cap = getCapacityForDate(formData.tanggal, slotConfig);
                                                            const slotMin = toMin(slot);
                                                            const nextMin = idx < slots.length - 1 ? toMin(slots[idx + 1]) : slotMin + 30;

                                                            const count = bookings.filter(b => {
                                                                if (b.tanggal !== formData.tanggal || !['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'].includes(b.status)) return false;
                                                                const bMin = toMin(b.jam);
                                                                return bMin >= slotMin && bMin < nextMin;
                                                            }).length;
                                                            const isFull = count >= cap;
                                                            return (
                                                                <button key={slot} type="button" disabled={isPastTime || (isFull && formData.jam !== slot)}
                                                                    onClick={() => setFormData({ ...formData, jam: slot })}
                                                                    className={`py-2 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5 ${formData.jam === slot ? 'bg-black border-black text-white shadow-lg scale-105 z-10' :
                                                                        isPastTime || isFull ? 'bg-zinc-100 border-zinc-200 text-zinc-300 cursor-not-allowed opacity-100 shadow-inner' : 'bg-white border-zinc-100 text-black hover:border-black'
                                                                    }`}
                                                                >
                                                                    <span>{h}:{m}</span>
                                                                    <span className="text-[6px] opacity-70">{count}/{cap}</span>
                                                                </button>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Vehicle + Form + Summary + Submit (7 cols) */}
                                        <div className="md:col-span-7 flex flex-col gap-2 md:overflow-y-auto custom-scrollbar pb-4">
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-1.5 mb-0.5">
                                                <div className="w-5 h-5 bg-zinc-900 text-white rounded-md flex items-center justify-center text-[9px]">2</div> Data Booking
                                            </h3>
                                            {/* Vehicle Info Badge */}
                                            {isManual ? (
                                                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl shrink-0">
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-700 tracking-widest mb-2">
                                                        <Edit3 size={12} /> Data Manual
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800 ml-1 flex items-center gap-1.5">
                                                                <Activity size={11} /> Nomor Polisi
                                                            </label>
                                                            <input required type="text" placeholder="B 1234 ABC"
                                                                className="w-full bg-white border-2 border-amber-200 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-amber-500 outline-none uppercase shadow-inner"
                                                                value={formData.noPolisi} onChange={e => setFormData({ ...formData, noPolisi: e.target.value.toUpperCase() })} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800 ml-1 flex items-center gap-1.5">
                                                                <Car size={11} /> Model Kendaraan
                                                            </label>
                                                            <input type="text" placeholder="Model (opsional)"
                                                                className="w-full bg-white border-2 border-amber-200 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-amber-500 outline-none shadow-inner"
                                                                value={formData.modelKendaraan} onChange={e => setFormData({ ...formData, modelKendaraan: e.target.value })} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-2.5 bg-zinc-50 border-2 border-zinc-100 rounded-xl shrink-0 flex items-center justify-between text-xs shadow-inner">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                                                        <span className="font-black text-zinc-900 uppercase text-sm">{foundVehicle?.no_polisi}</span>
                                                        <span className="text-zinc-300">&bull;</span>
                                                        <span className="font-bold text-zinc-600 truncate">{foundVehicle?.nama_kendaraan || foundVehicle?.model_kendaraan}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-zinc-500 shrink-0">{foundVehicle?.nama_pelanggan}</span>
                                                </div>
                                            )}

                                            {/* Form Inputs Grid */}
                                            <form id="bookingForm" onSubmit={handleFormSubmit} className="shrink-0">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                            <User size={11} /> Atas Nama Booking
                                                        </label>
                                                        <input required type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" placeholder="Nama booking" value={formData.atasNama} onChange={e => setFormData({ ...formData, atasNama: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                            <Zap size={11} /> No Telp Booking
                                                        </label>
                                                        <input type="tel" className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" placeholder="08..." value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                            <Truck size={11} /> KM Kendaraan
                                                        </label>
                                                        <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" placeholder="Masukkan KM" value={formData.km} onChange={e => setFormData({ ...formData, km: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                            <FileText size={11} /> Keluhan / Catatan
                                                        </label>
                                                        <input type="text" className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" placeholder="Deskripsi keluhan..." value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })} />
                                                    </div>
                                                </div>
                                            </form>

                                            {/* Summary + Submit Buttons */}
                                            <div className="pt-3 border-t-2 border-zinc-100 space-y-2 shrink-0">
                                                <div className="bg-zinc-50 border-2 border-zinc-100 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                                    <div><span className="text-zinc-400 font-black block text-[7px] uppercase tracking-widest">Tanggal</span><strong className="text-zinc-900 font-black text-sm">{formData.tanggal || '-'}</strong></div>
                                                    <div><span className="text-zinc-400 font-black block text-[7px] uppercase tracking-widest">Jam</span><strong className="text-zinc-900 font-black text-sm">{formData.jam ? `${formData.jam.replace('.', ':')} WIB` : '-'}</strong></div>
                                                    <div><span className="text-zinc-400 font-black block text-[7px] uppercase tracking-widest">Plat</span><strong className="text-zinc-900 font-black text-sm">{isManual ? (formData.noPolisi || '-') : foundVehicle?.no_polisi}</strong></div>
                                                    <div><span className="text-zinc-400 font-black block text-[7px] uppercase tracking-widest">Customer</span><strong className="text-zinc-900 font-black text-sm truncate block">{formData.atasNama || '-'}</strong></div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => setStep('search')}
                                                        className="flex-1 py-2.5 bg-white border-2 border-zinc-100 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-black hover:text-black transition-all"
                                                    >
                                                        Kembali
                                                    </button>
                                                    <button type="submit" form="bookingForm" disabled={isSubmitting}
                                                        className="flex-[2] bg-zinc-900 hover:bg-black text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] group disabled:opacity-40"
                                                    >
                                                        {isSubmitting ? 'Processing...' : 'Konfirmasi Booking'}
                                                        <Send size={14} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
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
const normalizeJam = (j) => {
    if (!j) return "";
    const sj = String(j).replace(':', '.');
    const parts = sj.split('.');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] || '00').padEnd(2, '0');
    return `${h}.${m}`;
};

function SupabaseBookingList({ refreshTrigger, slotConfig, allBookings }) {
    const [bookings, setBookings] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [resyncingId, setResyncingId] = useState(null);

    const handleResync = async (b) => {
        setResyncingId(b.id);
        try {
            const cleanPlat = (b.noPlat || '').replace(/\s+/g, '').toUpperCase();
            const vRes = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${cleanPlat}&q=${cleanPlat}`);
            const vJson = await vRes.json();
            const vehicle = Array.isArray(vJson) && vJson.find(v =>
                (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === cleanPlat
            );
            if (!vehicle) {
                Toastify({ text: `❌ Kendaraan ${cleanPlat} tidak ditemukan di DMS`, background: 'orange', duration: 4000 }).showToast();
                await db.update('booking', { bookingVia: 'CRO Booking (DMS Gagal - Tidak Ditemukan)' }, { eq: { id: b.id } });
                setRefreshTrigger(p => p + 1);
                return;
            }
            const targetJam = (b.jam || '08.30').replace('.', ':') + ':00';
            const janjiDatang = `${b.tanggal} ${targetJam}`;
            const postData = {
                uniqid: Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
                id_kendaraan: vehicle.id_kendaraan || '',
                no_polisi: vehicle.no_polisi || cleanPlat,
                model_kendaraan: vehicle.model_kendaraan || vehicle.nama_kendaraan || b.tipeMobil || '',
                nama_kendaraan: vehicle.nama_kendaraan || b.tipeMobil || '',
                tipe_kendaraan: vehicle.tipe_kendaraan || '',
                no_chassis: vehicle.no_chassis || '',
                group_kendaraan: vehicle.group_kendaraan || 'PC',
                no_pelanggan: vehicle.no_pelanggan || '',
                id_pelanggan: vehicle.id_pelanggan || '',
                tipe_pelanggan: vehicle.tipe_pelanggan || 'PRIBADI',
                nama_pelanggan: vehicle.nama_pelanggan || b.namaCustomer || '',
                no_telp_pelanggan: vehicle.no_telp || b.noTelp || '',
                alamat_pelanggan: vehicle.alamat || '-',
                atas_nama_booking: b.namaCustomer || '',
                no_telp_booking: b.noTelp || '',
                janji_datang: janjiDatang,
                keluhan: b.keperluanService || b.keluhanDetail || '-',
                booking_via: 'CRO Booking',
                booking_via_personal: '',
                km: '0'
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
                await db.update('booking', { bookingVia: 'CRO Booking (DMS Synced)' }, { eq: { id: b.id } });
                Toastify({ text: `✅ ${cleanPlat} berhasil re-sync ke DMS!`, background: '#10b981' }).showToast();
            } else {
                await db.update('booking', { bookingVia: `CRO Booking (DMS Gagal: ${(json.message || 'Error').slice(0, 30)})` }, { eq: { id: b.id } });
                Toastify({ text: `❌ DMS menolak: ${json.message}`, background: 'red', duration: 5000 }).showToast();
            }
            setRefreshTrigger(p => p + 1);
        } catch (err) {
            Toastify({ text: `❌ Error re-sync: ${err.message}`, background: 'red' }).showToast();
        } finally {
            setResyncingId(null);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const filters = {
                    select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, keluhanDetail',
                    order: { column: 'id', ascending: false },
                    limit: 500,
                };
                if (startDate) {
                    filters.gte = { tanggal: startDate };
                }
                if (endDate) {
                    filters.lte = { tanggal: endDate };
                }
                const { data } = await db.select('booking', filters);
                setBookings(data || []);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, [refreshTrigger, startDate, endDate]);

    const filtered = useMemo(() => {
        let list = bookings;
        if (startDate) list = list.filter(b => b.tanggal >= startDate);
        if (endDate) list = list.filter(b => b.tanggal <= endDate);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(b =>
                (b.noPlat || '').toLowerCase().includes(q) ||
                (b.namaCustomer || '').toLowerCase().includes(q) ||
                (b.noTelp || '').includes(q)
            );
        }
        return list;
    }, [bookings, search, startDate, endDate]);

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
            const isCancelling = editForm.status === 'declined';
            const oldPlat = editItem.noPlat;
            const oldTanggal = editItem.tanggal;

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

            // Auto-cancel in DMS if status is updated to declined
            if (isCancelling && oldPlat && oldTanggal) {
                try {
                    const cleanPlat = oldPlat.replace(/\s+/g, '').toUpperCase();
                    const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&search=${cleanPlat}&datefrom=${oldTanggal}&dateto=${oldTanggal}`);
                    if (dmsRes.ok) {
                        const dmsJson = await dmsRes.json();
                        const dmsList = dmsJson?.data || [];
                        const matched = dmsList.find(d => 
                            (d.no_polisi || '').replace(/\s+/g, '').toUpperCase() === cleanPlat &&
                            d.status_booking !== 'Batal'
                        );
                        if (matched) {
                            const dmsId = matched.no_booking || matched.id_booking;
                            if (dmsId) {
                                const formDataBody = new URLSearchParams();
                                formDataBody.set('alasan_pembatalan', 'Dibatalkan/Declined via CRO Dashboard (Supabase)');
                                formDataBody.set('dibatalkan_oleh', 'CRO Dashboard');
                                
                                const cancelRes = await fetch(`/api/chery_dms?endpoint=booking-cancel&id=${dmsId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: formDataBody.toString()
                                });
                                const cancelJson = await cancelRes.json();
                                if (cancelJson.success) {
                                    Toastify({ text: 'ℹ️ Booking di DMS juga dibatalkan otomatis', background: '#3b82f6' }).showToast();
                                }
                            }
                        }
                    }
                } catch (dmsErr) {
                    console.warn('Gagal membatalkan booking di DMS:', dmsErr);
                }
            }
            
            // Refresh with current date range
            const filters = {
                select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, keluhanDetail',
                order: { column: 'id', ascending: false },
                limit: 500,
            };
            if (startDate) filters.gte = { tanggal: startDate };
            if (endDate) filters.lte = { tanggal: endDate };
            const { data } = await db.select('booking', filters);
            setBookings(data || []);
        } catch (e) {
            Toastify({ text: `❌ Gagal update: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus booking ini?')) return;
        try {
            const item = bookings.find(b => b.id === id);

            const { error } = await db.delete('booking', { eq: { id } });
            if (error) throw error;
            Toastify({ text: '✅ Booking berhasil dihapus', background: '#10b981' }).showToast();
            setBookings(prev => prev.filter(b => b.id !== id));

            // Auto-cancel in DMS if deleted
            if (item && item.noPlat && item.tanggal) {
                try {
                    const cleanPlat = item.noPlat.replace(/\s+/g, '').toUpperCase();
                    const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&search=${cleanPlat}&datefrom=${item.tanggal}&dateto=${item.tanggal}`);
                    if (dmsRes.ok) {
                        const dmsJson = await dmsRes.json();
                        const dmsList = dmsJson?.data || [];
                        const matched = dmsList.find(d => 
                            (d.no_polisi || '').replace(/\s+/g, '').toUpperCase() === cleanPlat &&
                            d.status_booking !== 'Batal'
                        );
                        if (matched) {
                            const dmsId = matched.no_booking || matched.id_booking;
                            if (dmsId) {
                                const formDataBody = new URLSearchParams();
                                formDataBody.set('alasan_pembatalan', 'Dihapus via CRO Dashboard (Supabase)');
                                formDataBody.set('dibatalkan_oleh', 'CRO Dashboard');
                                
                                const cancelRes = await fetch(`/api/chery_dms?endpoint=booking-cancel&id=${dmsId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: formDataBody.toString()
                                });
                                const cancelJson = await cancelRes.json();
                                if (cancelJson.success) {
                                    Toastify({ text: 'ℹ️ Booking di DMS juga dibatalkan otomatis', background: '#3b82f6' }).showToast();
                                }
                            }
                        }
                    }
                } catch (dmsErr) {
                    console.warn('Gagal membatalkan booking di DMS:', dmsErr);
                }
            }
        } catch (e) {
            Toastify({ text: `❌ Gagal hapus: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cari plat/nama/telp..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Dari:</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Sampai:</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                </div>
                <span className="text-[9px] font-bold text-zinc-400">{filtered.length} booking</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-100 sticky top-0">
                        <tr className="text-zinc-500 font-black uppercase tracking-wider text-xs border-b border-zinc-200">
                            <th className="px-4 py-3 text-left">Tanggal</th>
                            <th className="px-4 py-3 text-left">Jam</th>
                            <th className="px-4 py-3 text-left">No Plat</th>
                            <th className="px-4 py-3 text-left">Nama</th>
                            <th className="px-4 py-3 text-left">Tipe</th>
                            <th className="px-4 py-3 text-left max-w-[200px]">Keluhan</th>
                            <th className="px-4 py-3 text-left">Via</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-center w-[100px]">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" className="p-8 text-center text-zinc-400 font-bold">Memuat...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="9" className="p-8 text-center text-zinc-400 font-bold">Tidak ada booking</td></tr>
                        ) : filtered.map(b => (
                            <tr key={b.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-all">
                                <td className="px-4 py-3 font-bold text-zinc-700">{b.tanggal || '-'}</td>
                                <td className="px-4 py-3 font-bold text-zinc-700">{(b.jam || '').replace('.', ':')}</td>
                                <td className="px-4 py-3 font-black text-zinc-900 uppercase">{b.noPlat || '-'}</td>
                                <td className="px-4 py-3 font-bold text-zinc-700">{b.namaCustomer || '-'}</td>
                                <td className="px-4 py-3 text-zinc-500">{b.tipeMobil || '-'}</td>
                                <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate" title={b.keperluanService}>{b.keperluanService || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded ${(b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {(b.bookingVia || 'Supabase').length > 20 ? (b.bookingVia || '').slice(0, 18) + '...' : (b.bookingVia || 'Supabase')}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded ${b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : b.status === 'accepted' ? 'bg-green-50 text-green-700' : b.status === 'declined' ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-500'}`}>
                                        {b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'Synced (DMS)' : b.status || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1.5">
                                         <button onClick={() => handleResync(b)}
                                             disabled={resyncingId === b.id}
                                             className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all ${resyncingId === b.id ? 'bg-blue-100 text-blue-400 animate-pulse' : (b.bookingVia || '').includes('DMS Synced') ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
                                             title="Re-sync ke DMS Internal">
                                             <RefreshCcw size={12} className={resyncingId === b.id ? 'animate-spin' : ''} />
                                             <span>{(b.bookingVia || '').includes('DMS Synced') ? 'Sync Ulang' : 'Sync DMS'}</span>
                                         </button>
                                        <button onClick={() => openEdit(b)}
                                            className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-800 hover:text-white transition-all text-zinc-500"
                                            title="Edit"><Edit3 size={14} /></button>
                                        <button onClick={() => handleDelete(b.id)}
                                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white transition-all text-red-500"
                                            title="Hapus"><X size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editItem && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 md:p-8" onClick={() => setEditItem(null)}>
                    <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-4xl shadow-2xl border-4 border-black overflow-hidden animate-fade-in relative flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 md:p-8 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-lg md:text-2xl font-black uppercase tracking-tighter text-black">Update Booking Details</h3>
                                <p className="text-xs md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">ID: #{editItem.id} &bull; <span className="text-black font-black">{editItem.noPlat}</span> &bull; {editItem.namaCustomer}</p>
                            </div>
                            <button onClick={() => setEditItem(null)} className="p-3 min-w-[44px] min-h-[44px] bg-white border-2 border-zinc-100 rounded-2xl hover:bg-black hover:text-white transition-all flex items-center justify-center"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                {/* Left Column: Tanggal & Slot Jam */}
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-sm md:text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tanggal Kedatangan</label>
                                        <input type="date" value={editForm.tanggal} onChange={e => setEditForm(p => ({ ...p, tanggal: e.target.value, jam: '' }))}
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 p-3 min-h-[44px] rounded-2xl font-black text-sm text-black focus:border-black outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Status</label>
                                        <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 p-3 min-h-[44px] rounded-2xl font-black text-sm text-black focus:border-black outline-none transition-all">
                                            <option value="accepted">Accepted</option>
                                            <option value="synced">Synced (DMS)</option>
                                            <option value="declined">Declined</option>
                                            <option value="waiting confirm">Waiting Confirm</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                                            <Clock size={12} className="text-black" /> Slot Jam Kedatangan
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {(() => {
                                                const config = slotConfig || { slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1 };
                                                const capacity = getCapacityForDate(editForm.tanggal, config);
                                                const slots = getSlotsForDate(editForm.tanggal, config);
                                                
                                                return slots.map(s => {
                                                    const normalizedS = normalizeJam(s);
                                                    const normalizedCurrent = normalizeJam(editForm.jam);
                                                    
                                                    const bookingsAtThisTime = (allBookings || []).filter(b => 
                                                        b.id !== editItem.id && 
                                                        b.tanggal === editForm.tanggal && 
                                                        normalizeJam(b.jam) === normalizedS &&
                                                        (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
                                                    );
                                                    const isFull = bookingsAtThisTime.length >= capacity;
                                                    const isSelected = normalizedCurrent === normalizedS;
                                                    const isPastTime = editForm.tanggal === new Date().toISOString().split('T')[0] && parseFloat(s) < (new Date().getHours() + new Date().getMinutes() / 60);

                                                    return (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            disabled={isPastTime || (isFull && !isSelected)}
                                                            onClick={() => setEditForm(p => ({ ...p, jam: normalizedS }))}
                                                            className={`py-2.5 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all relative flex flex-col items-center justify-center gap-0.5
                                                                ${isSelected ? 'bg-black border-black text-white shadow-lg scale-105 z-10' : 
                                                                  isPastTime || isFull ? 'bg-zinc-100 border-zinc-200 text-zinc-300 cursor-not-allowed opacity-100 shadow-inner' : 
                                                                  'bg-white border-zinc-100 text-black hover:border-black'}`}
                                                        >
                                                            <span>{s.replace('.', ':')}</span>
                                                            <span className="text-[6px] opacity-70">{isSelected ? 'PILIH' : isFull ? 'FULL' : `${bookingsAtThisTime.length}/${capacity}`}</span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Customer & Vehicle Info */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                <Activity size={11} /> No Polisi
                                            </label>
                                            <input type="text" value={editForm.noPlat} onChange={e => setEditForm(p => ({ ...p, noPlat: e.target.value }))}
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 uppercase focus:border-black outline-none transition-all shadow-inner" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                <User size={11} /> Nama Customer
                                            </label>
                                            <input type="text" value={editForm.namaCustomer} onChange={e => setEditForm(p => ({ ...p, namaCustomer: e.target.value }))}
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                <Zap size={11} /> No Telp
                                            </label>
                                            <input type="text" value={editForm.noTelp} onChange={e => setEditForm(p => ({ ...p, noTelp: e.target.value }))}
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                                <Car size={11} /> Tipe Mobil
                                            </label>
                                            <input type="text" value={editForm.tipeMobil} onChange={e => setEditForm(p => ({ ...p, tipeMobil: e.target.value }))}
                                                className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1.5">
                                            <FileText size={11} /> Keperluan Service / Keluhan
                                        </label>
                                        <input type="text" value={editForm.keperluanService} onChange={e => setEditForm(p => ({ ...p, keperluanService: e.target.value }))}
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 p-2.5 rounded-xl font-black text-sm text-zinc-900 focus:border-black outline-none transition-all shadow-inner" placeholder="Deskripsi keluhan..." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-8 bg-zinc-50 border-t-2 border-zinc-100 flex gap-3 md:gap-4 shrink-0">
                            <button onClick={() => setEditItem(null)}
                                className="flex-1 py-3 min-h-[44px] bg-white border-2 border-zinc-100 text-zinc-400 rounded-[1.5rem] font-black text-xs uppercase hover:border-black hover:text-black transition-all">Batal</button>
                            <button onClick={handleEditSave}
                                className="flex-[2] py-3 min-h-[44px] bg-black text-white rounded-[1.5rem] font-black text-xs uppercase shadow-2xl shadow-zinc-300 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
