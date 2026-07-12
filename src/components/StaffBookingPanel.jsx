import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, Send, Plus, X, List, Clock, Check, Car, User, Phone, FileText, Trash2 } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

const TIPE_MOBIL = [
    "Tiggo 5x", "Tiggo Cross", "Tiggo Cross Csh", "Tiggo 7", "Tiggo 8 Pro",
    "Tiggo 8", "Tiggo 8 Csh", "Tiggo 9 Csh", "J5", "J6", "J7", "J8",
    "Omoda 5", "Omoda 5 GT", "Omoda EV", "Omoda 9",
    "Chery C5", "Chery C5 Csh", "Jaecoo J7", "Jaecoo J8"
];

const normalizeModelName = (dmsName) => {
    if (!dmsName) return '';
    const upper = dmsName.toUpperCase().trim();
    const aliasMap = {
        'CHERY C5': 'Chery C5', 'CHERY C5 CSH': 'Chery C5 Csh',
        'OMODA 5': 'Omoda 5', 'OMODA 5 GT': 'Omoda 5 GT', 'OMODA EV': 'Omoda EV', 'OMODA 9': 'Omoda 9',
        'JAECOO J7': 'Jaecoo J7', 'JAECOO J8': 'Jaecoo J8',
        'J5': 'J5', 'J6': 'J6', 'J7': 'J7', 'J8': 'J8',
        'TIGGO 5X': 'Tiggo 5x', 'TIGGO CROSS': 'Tiggo Cross', 'TIGGO CROSS CSH': 'Tiggo Cross Csh',
        'TIGGO 7': 'Tiggo 7', 'TIGGO 8 PRO': 'Tiggo 8 Pro', 'TIGGO 8': 'Tiggo 8',
        'TIGGO 8 CSH': 'Tiggo 8 Csh', 'TIGGO 9 CSH': 'Tiggo 9 Csh',
    };
    if (aliasMap[upper]) return aliasMap[upper];
    const match = TIPE_MOBIL.find(t => t.toUpperCase() === upper);
    return match || dmsName;
};

export default function StaffBookingPanel({ user }) {
    const staffName = user?.name || user?.username || 'Staff';
    const staffRole = (user?.role || '').toLowerCase();
    const bookingPrefix = staffRole === 'spv' ? 'SPV' : 'Sales';

    const [activeTab, setActiveTab] = useState('booking');

    const [plateSearch, setPlateSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [foundVehicle, setFoundVehicle] = useState(null);

    const [formData, setFormData] = useState({
        noPolisi: '',
        atasNama: '',
        noTelp: '',
        modelKendaraan: '',
        keluhan: '',
        tanggal: '',
        jam: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [slotConfig, setSlotConfig] = useState({ count: 4, gap: 30, startH: 8, startM: 30, capacity: 1 });
    const [holidays, setHolidays] = useState([]);
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());

    const [myBookings, setMyBookings] = useState([]);
    const [isLoadingBookings, setIsLoadingBookings] = useState(false);
    const [bookingFilter, setBookingFilter] = useState('all');

    useEffect(() => {
        (async () => {
            const config = await fetchBookingConfig();
            setSlotConfig({ count: config.slotCount, gap: config.gapMinutes, startH: config.startHour, startM: config.startMinute, capacity: config.slotCapacity });
            const hols = await fetchHolidays();
            setHolidays(hols);
        })();
    }, []);

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

    const JAM_PILIHAN = useMemo(
        () => generateSlots(slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM),
        [slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM]
    );

    const fetchMyBookings = useCallback(async () => {
        setIsLoadingBookings(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data } = await db.select('booking', {
                select: 'id,tanggal,jam,noPlat,namaCustomer,tipeMobil,keperluanService,status,bookingVia,noTelp',
                gte: { tanggal: today },
                order: { column: 'tanggal', ascending: false },
                limit: 100,
            });
            if (Array.isArray(data)) {
                const prefixPattern = `${bookingPrefix}: ${staffName}`;
                setMyBookings(data.filter(b => (b.bookingVia || '').startsWith(prefixPattern)));
            }
        } catch (e) {
            console.error('Gagal memuat booking', e);
        } finally {
            setIsLoadingBookings(false);
        }
    }, [bookingPrefix, staffName]);

    useEffect(() => {
        if (activeTab === 'list') fetchMyBookings();
    }, [activeTab, fetchMyBookings]);

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
                    noPolisi: matched.no_polisi || cleanPlat,
                    atasNama: matched.nama_pelanggan || '',
                    noTelp: matched.no_telp || '',
                    modelKendaraan: normalizeModelName(matched.nama_kendaraan || matched.model_kendaraan || ''),
                }));
                Toastify({ text: "Kendaraan ditemukan di DMS!", background: "green" }).showToast();
            } else {
                setSearchError('Tidak ditemukan. Isi data manual.');
                setFormData(prev => ({ ...prev, noPolisi: cleanPlat }));
                Toastify({ text: "Tidak ditemukan di DMS. Isi manual.", background: "orange" }).showToast();
            }
        } catch (err) {
            setSearchError('Gagal menghubungi DMS. Isi manual.');
            setFormData(prev => ({ ...prev, noPolisi: cleanPlat }));
        } finally {
            setIsSearching(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.jam || !formData.atasNama || !formData.noPolisi) {
            Toastify({ text: "Isi plat, nama, dan jam!", background: "orange" }).showToast();
            return;
        }
        if (isHolidayOrSunday(formData.tanggal, holidays)) {
            Toastify({ text: "Hari libur/Minggu!", background: "red" }).showToast();
            return;
        }
        setIsSubmitting(true);
        try {
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
                bookingVia: `${bookingPrefix}: ${staffName}`,
            });
            if (insertErr) throw insertErr;

            let dmsSynced = false;
            if (foundVehicle) {
                try {
                    const targetJam = formData.jam.replace('.', ':') + ':00';
                    const janjiDatang = `${formData.tanggal} ${targetJam}`;
                    const postData = {
                        uniqid: Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
                        id_kendaraan: foundVehicle.id_kendaraan || '',
                        no_polisi: foundVehicle.no_polisi,
                        model_kendaraan: foundVehicle.model_kendaraan || foundVehicle.nama_kendaraan || '',
                        nama_kendaraan: foundVehicle.nama_kendaraan || '',
                        no_pelanggan: foundVehicle.no_pelanggan || '',
                        id_pelanggan: foundVehicle.id_pelanggan || '',
                        nama_pelanggan: foundVehicle.nama_pelanggan || formData.atasNama,
                        no_telp_pelanggan: foundVehicle.no_telp || formData.noTelp,
                        atas_nama_booking: formData.atasNama,
                        no_telp_booking: formData.noTelp,
                        janji_datang: janjiDatang,
                        keluhan: formData.keluhan || '-',
                        booking_via: `${bookingPrefix} Booking`,
                        km: '0'
                    };
                    const body = new URLSearchParams();
                    Object.entries(postData).forEach(([k, v]) => body.set(k, v));
                    const res = await fetch('/api/chery_dms?endpoint=booking-create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: body.toString()
                    });
                    const json = await res.json();
                    if (json.success) {
                        dmsSynced = true;
                        if (inserted && inserted.id) {
                            try { await db.update('booking', { bookingVia: `${bookingPrefix} Booking (DMS Synced)` }, { eq: { id: inserted.id } }); } catch (_) {}
                        }
                    }
                } catch (syncErr) {
                    console.warn('DMS sync error:', syncErr);
                }
            }

            Toastify({
                text: dmsSynced ? 'Booking BERHASIL & tersinkronisasi ke DMS!' : 'Booking BERHASIL!',
                background: 'green', duration: 5000
            }).showToast();

            setFormData({ noPolisi: '', atasNama: '', noTelp: '', modelKendaraan: '', keluhan: '', tanggal: '', jam: '' });
            setPlateSearch('');
            setFoundVehicle(null);
        } catch (err) {
            Toastify({ text: `ERROR: ${err.message}`, background: "red", duration: 5000 }).showToast();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBooking = async (booking) => {
        if (!window.confirm(`Hapus booking ${booking.noPlat} tanggal ${booking.tanggal}?`)) return;
        try {
            await db.update('booking', { status: 'cancelled' }, { eq: { id: booking.id } });
            Toastify({ text: "Booking dibatalkan.", background: "green" }).showToast();
            fetchMyBookings();
        } catch (e) {
            Toastify({ text: "Gagal membatalkan.", background: "red" }).showToast();
        }
    };

    const changeCalMonth = (offset) => {
        const next = new Date(currentCalMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentCalMonth(next);
    };

    const isPastDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return d < now;
    };

    const filteredBookings = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        if (bookingFilter === 'today') return myBookings.filter(b => b.tanggal === today);
        if (bookingFilter === 'upcoming') return myBookings.filter(b => b.tanggal > today);
        return myBookings;
    }, [myBookings, bookingFilter]);

    const formatDate = (d) => {
        try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
    };

    const statusBadge = (status) => {
        const map = {
            'waiting confirm': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Menunggu' },
            'accepted': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Diterima' },
            'completed': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Selesai' },
            'cancelled': { bg: 'bg-red-100', text: 'text-red-700', label: 'Dibatalkan' },
            'no_show': { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'No Show' },
        };
        const s = map[status] || { bg: 'bg-zinc-100', text: 'text-zinc-500', label: status };
        return <span className={`${s.bg} ${s.text} text-[10px] font-black px-2 py-0.5 rounded-full`}>{s.label}</span>;
    };

    return (
        <div className="min-h-screen bg-zinc-50 pb-24">
            <div className="bg-zinc-900 text-white p-4 sticky top-0 z-30">
                <div className="flex items-center gap-2 mb-3">
                    <Car size={20} />
                    <h1 className="text-sm font-black uppercase tracking-wider">Booking {bookingPrefix}</h1>
                    <div className="ml-auto bg-white/10 rounded-full px-3 py-1 text-[10px] font-black">{staffName}</div>
                </div>
                <div className="flex gap-1 bg-white/10 rounded-xl p-1">
                    <button onClick={() => setActiveTab('booking')} className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'booking' ? 'bg-white text-zinc-900' : 'text-white/60'}`}>
                        <Plus size={14} className="inline mr-1" />Booking Baru
                    </button>
                    <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'list' ? 'bg-white text-zinc-900' : 'text-white/60'}`}>
                        <List size={14} className="inline mr-1" />Daftar Booking
                        {myBookings.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 rounded-full">{myBookings.length}</span>}
                    </button>
                </div>
            </div>

            {activeTab === 'booking' && (
                <div className="p-4 space-y-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block">No. Polisi</label>
                        <form onSubmit={handleSearchVehicle} className="flex gap-2">
                            <input
                                value={plateSearch}
                                onChange={e => setPlateSearch(e.target.value.toUpperCase())}
                                placeholder="B 1234 ABC"
                                className="flex-1 bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-black uppercase outline-none focus:border-zinc-900 transition-all min-h-[44px]"
                            />
                            <button type="submit" disabled={isSearching} className="bg-zinc-900 text-white px-4 rounded-xl font-black min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-all disabled:opacity-50">
                                {isSearching ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={18} />}
                            </button>
                        </form>
                        {searchError && <p className="text-[10px] text-orange-500 font-bold mt-2">{searchError}</p>}
                        {foundVehicle && (
                            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <div className="flex items-center gap-2">
                                    <Check size={14} className="text-emerald-600" />
                                    <span className="text-[11px] font-black text-emerald-700">Ditemukan: {foundVehicle.nama_pelanggan} - {foundVehicle.nama_kendaraan || foundVehicle.model_kendaraan}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400">No. Polisi</label>
                            <input value={formData.noPolisi} onChange={e => setFormData({ ...formData, noPolisi: e.target.value.toUpperCase() })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-black uppercase outline-none focus:border-zinc-900 transition-all min-h-[44px]" placeholder="B 1234 ABC" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400">Nama Customer</label>
                            <input value={formData.atasNama} onChange={e => setFormData({ ...formData, atasNama: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all min-h-[44px]" placeholder="Nama pemilik" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-400">No. HP</label>
                                <input value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all min-h-[44px]" placeholder="08xxx" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-400">Tipe Mobil</label>
                                <select value={formData.modelKendaraan} onChange={e => setFormData({ ...formData, modelKendaraan: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all appearance-none min-h-[44px]">
                                    <option value="">Pilih</option>
                                    {TIPE_MOBIL.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400">Keluhan / Kebutuhan</label>
                            <input value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all min-h-[44px]" placeholder="Servis berkala, klaim garansi, dll" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                        <div className="flex items-center justify-between mb-3">
                            <button onClick={() => changeCalMonth(-1)} className="p-2 rounded-xl hover:bg-zinc-100 active:scale-95 transition-all"><ChevronLeft size={18} /></button>
                            <h3 className="text-sm font-black uppercase">{currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                            <button onClick={() => changeCalMonth(1)} className="p-2 rounded-xl hover:bg-zinc-100 active:scale-95 transition-all"><ChevronRight size={18} /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d} className="text-[9px] font-black text-zinc-400 py-1">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {calendarGrid.map((item, idx) => {
                                if (!item.currentMonth) return <div key={idx} className="aspect-square opacity-0"><div /></div>;
                                const isActive = formData.tanggal === item.date;
                                const past = isPastDate(item.date);
                                const holiday = isHolidayOrSunday(item.date, holidays);
                                const disabled = past || holiday;
                                return (
                                    <button key={idx} type="button" disabled={disabled}
                                        onClick={() => setFormData({ ...formData, tanggal: item.date, jam: '' })}
                                        className={`aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all ${disabled ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed opacity-30' : isActive ? 'bg-zinc-900 text-white shadow-lg scale-110' : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-200 active:scale-95'}`}
                                    >{item.day}</button>
                                );
                            })}
                        </div>
                    </div>

                    {formData.tanggal && (
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                            <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-3">Pilih Jam</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {JAM_PILIHAN.map((slot) => {
                                    const [h, m] = slot.split('.');
                                    const isPastTime = formData.tanggal === new Date().toISOString().split('T')[0] && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                                    return (
                                        <button key={slot} type="button" disabled={isPastTime}
                                            onClick={() => setFormData({ ...formData, jam: slot })}
                                            className={`py-3 rounded-xl text-xs font-black transition-all ${formData.jam === slot ? 'bg-zinc-900 text-white shadow-lg' : isPastTime ? 'bg-zinc-50 text-zinc-300 cursor-not-allowed' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-200 active:scale-95'}`}
                                        >
                                            {h}:{m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button onClick={handleFormSubmit} disabled={isSubmitting || !formData.tanggal || !formData.jam || !formData.noPolisi || !formData.atasNama}
                        className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed min-h-[56px]">
                        {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={18} />Booking Sekarang</>}
                    </button>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="p-4 space-y-3">
                    <div className="flex gap-1 bg-white rounded-xl p-1 border border-zinc-100">
                        {[
                            { key: 'all', label: 'Semua' },
                            { key: 'today', label: 'Hari Ini' },
                            { key: 'upcoming', label: 'Mendatang' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setBookingFilter(f.key)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bookingFilter === f.key ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {isLoadingBookings ? (
                        <div className="text-center py-12"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto" /></div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-xs font-bold">Belum ada booking</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredBookings.map(b => (
                                <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-black uppercase">{b.noPlat}</p>
                                            <p className="text-[11px] font-bold text-zinc-500">{b.namaCustomer}</p>
                                        </div>
                                        {statusBadge(b.status)}
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 mb-2">
                                        <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(b.tanggal)}</span>
                                        <span className="flex items-center gap-1"><Clock size={10} />{String(b.jam || '').replace('.', ':')} WIB</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                                        {b.tipeMobil && b.tipeMobil !== '-' && <span className="flex items-center gap-1"><Car size={10} />{b.tipeMobil}</span>}
                                        {b.keperluanService && b.keperluanService !== '-' && <span className="flex items-center gap-1 truncate max-w-[200px]"><FileText size={10} />{b.keperluanService}</span>}
                                    </div>
                                    {(b.status === 'waiting confirm' || b.status === 'accepted') && (
                                        <button onClick={() => handleDeleteBooking(b)}
                                            className="mt-3 flex items-center gap-1 text-[10px] font-black text-red-400 hover:text-red-600 transition-all">
                                            <Trash2 size={12} />Batalkan
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
