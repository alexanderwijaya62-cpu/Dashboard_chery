import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Search, Send, Plus, List, Clock, Check, Car, FileText, Trash2, Key, Users, Edit2 } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig } from '../utils/bookingConfig';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';
import { normalizeDmsBooking, parseDmsDate, parseDmsTime } from '../utils/dateHelpers';
import BookingCalendar from './BookingCalendar';

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

export default function StaffBookingPanel({ user, handleChangePassword }) {
    const staffName = user?.name || user?.username || 'Staff';
    const staffRole = (user?.role || '').toLowerCase();
    const bookingPrefix = staffRole === 'spv' ? 'SPV' : 'Sales';

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [activeTab, setActiveTab] = useState('booking');

    const [plateSearch, setPlateSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [foundVehicle, setFoundVehicle] = useState(null);

    const [formData, setFormData] = useState({
        noPolisi: '', atasNama: '', noTelp: '', modelKendaraan: '', keluhan: '', tanggal: '', jam: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [slotConfig, setSlotConfig] = useState({ count: 4, gap: 30, startH: 8, startM: 30, capacity: 1 });
    const [holidays, setHolidays] = useState([]);

    const [bookings, setBookings] = useState([]);
    const [isLoadingBookings, setIsLoadingBookings] = useState(false);
    const [bookingFilter, setBookingFilter] = useState('all');

    // User management (SPV only)
    const [salesUsers, setSalesUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [showUserForm, setShowUserForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ username: '', password: '', name: '', spv: '', status: 'active' });

    const isSpv = staffRole === 'spv';

    useEffect(() => {
        (async () => {
            const config = await fetchBookingConfig();
            setSlotConfig({ count: config.slotCount, gap: config.gapMinutes, startH: config.startHour, startM: config.startMinute, capacity: config.slotCapacity });
            const hols = await fetchHolidays();
            setHolidays(hols);
        })();
    }, []);

    const fetchBookings = useCallback(async () => {
        setIsLoadingBookings(true);
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            const { data } = await db.select('booking', {
                select: 'id,tanggal,jam,noPlat,namaCustomer,tipeMobil,keperluanService,status,bookingVia,noTelp',
                gte: { tanggal: dateStr },
                order: { column: 'tanggal', ascending: false },
                limit: 200,
            });
            let merged = Array.isArray(data) ? [...data] : [];
            const supabaseData = Array.isArray(data) ? [...data] : [];

            try {
                const now = new Date();
                const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                const to = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
                const dmsRes = await fetch(`/api/chery_dms?endpoint=booking-data&datefrom=${from}&dateto=${to}&length=500`);
                if (dmsRes.ok) {
                    const dmsJson = await dmsRes.json();
                    const dmsAll = dmsJson.data || [];
                    const dmsCancelled = dmsAll.filter(b => (b.status_booking || '').toLowerCase() === 'batal');
                    for (const cancelled of dmsCancelled) {
                        const cDate = parseDmsDate(cancelled.janji_datang);
                        const cJam = parseDmsTime(cancelled.janji_datang);
                        const cPlat = (cancelled.no_polisi || '').replace(/\s+/g, '').toUpperCase();
                        const match = supabaseData.find(sb => {
                            const sbPlat = (sb.noPlat || '').replace(/\s+/g, '').toUpperCase();
                            const sbJam = String(sb.jam || '').replace(':', '.');
                            return sbPlat === cPlat && sb.tanggal === cDate && sbJam === cJam && sb.status !== 'cancelled';
                        });
                        if (match) {
                            try {
                                await db.update('booking', { status: 'cancelled' }, { eq: { id: match.id } });
                                match.status = 'cancelled';
                            } catch (e) {
                                console.warn('Gagal auto-cancel Supabase booking:', e);
                            }
                        }
                    }
                    const dmsEntries = dmsAll.map(normalizeDmsBooking).filter(Boolean).filter(b => b.tanggal >= dateStr);
                    merged = [...merged, ...dmsEntries];
                }
            } catch (dmsErr) {
                console.warn('Gagal fetch DMS bookings:', dmsErr);
            }

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
        } catch (e) {
            console.error('Gagal memuat booking', e);
        } finally {
            setIsLoadingBookings(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
        const channel = supabase
            .channel('staff-booking-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, () => fetchBookings())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchBookings]);

    const myBookings = useMemo(() => {
        const prefixPattern = `${bookingPrefix}: ${staffName}`;
        return bookings.filter(b => {
            const via = b.bookingVia || '';
            return via.startsWith(prefixPattern) || via.includes(staffName);
        });
    }, [bookings, bookingPrefix, staffName]);

    const filteredBookings = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        if (bookingFilter === 'today') return myBookings.filter(b => b.tanggal === today);
        if (bookingFilter === 'upcoming') return myBookings.filter(b => b.tanggal > today);
        return myBookings;
    }, [myBookings, bookingFilter]);

    // === User Management CRUD (SPV only) ===
    const fetchSalesUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await db.select('sales', { order: { column: 'id', ascending: false } });
            if (error) throw error;
            setSalesUsers(data || []);
        } catch (e) {
            console.error('Gagal fetch sales users:', e);
            Toastify({ text: 'Gagal memuat data user', background: '#ef4444' }).showToast();
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users' && isSpv) fetchSalesUsers();
    }, [activeTab, isSpv, fetchSalesUsers]);

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (!userForm.username || !userForm.name) {
            Toastify({ text: 'Username dan Nama wajib diisi!', background: '#f97316' }).showToast();
            return;
        }
        if (!editingUser && !userForm.password) {
            Toastify({ text: 'Password wajib diisi untuk user baru!', background: '#f97316' }).showToast();
            return;
        }
        try {
            if (editingUser) {
                const updates = { name: userForm.name, spv: userForm.spv, status: userForm.status };
                if (userForm.password) updates.password = userForm.password;
                const { error } = await db.update('sales', updates, { eq: { id: editingUser.id } });
                if (error) throw error;
                Toastify({ text: 'User berhasil diupdate!', background: '#22c55e' }).showToast();
            } else {
                const { error } = await db.insert('sales', {
                    username: userForm.username,
                    password: userForm.password,
                    name: userForm.name,
                    spv: userForm.spv,
                    status: userForm.status,
                });
                if (error) throw error;
                Toastify({ text: 'User berhasil ditambahkan!', background: '#22c55e' }).showToast();
            }
            setShowUserForm(false);
            setEditingUser(null);
            setUserForm({ username: '', password: '', name: '', spv: '', status: 'active' });
            fetchSalesUsers();
        } catch (e) {
            console.error('Gagal simpan user:', e);
            Toastify({ text: `Gagal: ${e.message || 'Unknown error'}`, background: '#ef4444' }).showToast();
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`Hapus user "${name}"?`)) return;
        try {
            const { error } = await db.delete('sales', { eq: { id } });
            if (error) throw error;
            Toastify({ text: 'User berhasil dihapus', background: '#22c55e' }).showToast();
            fetchSalesUsers();
        } catch (e) {
            Toastify({ text: `Gagal hapus: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'non-active' : 'active';
        try {
            const { error } = await db.update('sales', { status: newStatus }, { eq: { id } });
            if (error) throw error;
            Toastify({ text: `Status diubah ke ${newStatus}`, background: '#22c55e' }).showToast();
            fetchSalesUsers();
        } catch (e) {
            Toastify({ text: `Gagal: ${e.message}`, background: '#ef4444' }).showToast();
        }
    };

    const handleEditUser = (u) => {
        setEditingUser(u);
        setUserForm({ username: u.username, password: '', name: u.name || '', spv: u.spv || '', status: u.status || 'active' });
        setShowUserForm(true);
    };

    // === End User Management ===

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
                        booking_via: staffName,
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
                            try { await db.update('booking', { bookingVia: `${bookingPrefix}: ${staffName} (DMS Synced)` }, { eq: { id: inserted.id } }); } catch (_) {}
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
            fetchBookings();
        } catch (e) {
            Toastify({ text: "Gagal membatalkan.", background: "red" }).showToast();
        }
    };

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
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setShowPasswordModal(true)}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95"
                            title="Ganti Password">
                            <Key size={16} />
                        </button>
                        <div className="bg-white/10 rounded-full px-3 py-1 text-[10px] font-black">{staffName}</div>
                    </div>
                </div>
                <div className="flex gap-1 bg-white/10 rounded-xl p-1">
                    <button onClick={() => setActiveTab('booking')} className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'booking' ? 'bg-white text-zinc-900' : 'text-white/60'}`}>
                        <Plus size={14} className="inline mr-1" />Booking Baru
                    </button>
                    <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'list' ? 'bg-white text-zinc-900' : 'text-white/60'}`}>
                        <List size={14} className="inline mr-1" />Daftar Booking
                        {myBookings.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 rounded-full">{myBookings.length}</span>}
                    </button>
                    {isSpv && (
                        <button onClick={() => setActiveTab('users')} className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'users' ? 'bg-white text-zinc-900' : 'text-white/60'}`}>
                            <Users size={14} className="inline mr-1" />User
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'booking' && (
                <div className="p-4 space-y-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block">No. Polisi</label>
                        <form onSubmit={handleSearchVehicle} className="flex gap-2">
                            <input value={plateSearch} onChange={e => setPlateSearch(e.target.value.toUpperCase())}
                                placeholder="B 1234 ABC"
                                className="flex-1 bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-black uppercase outline-none focus:border-zinc-900 transition-all min-h-[44px]" />
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
                                    {formData.modelKendaraan && !TIPE_MOBIL.includes(formData.modelKendaraan) && (
                                        <option value={formData.modelKendaraan}>{formData.modelKendaraan}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400">Keluhan / Kebutuhan</label>
                            <input value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all min-h-[44px]" placeholder="Servis berkala, klaim garansi, dll" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                        <BookingCalendar
                            bookings={bookings}
                            slotConfig={slotConfig}
                            selectedDate={formData.tanggal}
                            selectedTime={formData.jam}
                            holidays={holidays}
                            onDateSelect={(date) => setFormData({ ...formData, tanggal: date, jam: '' })}
                            onTimeSelect={(time) => setFormData({ ...formData, jam: time })}
                        />
                    </div>

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

            {activeTab === 'users' && isSpv && (
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Manajemen User Sales</h2>
                        <button onClick={() => { setEditingUser(null); setUserForm({ username: '', password: '', name: '', spv: '', status: 'active' }); setShowUserForm(true); }}
                            className="flex items-center gap-1 bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                            <Plus size={14} />Tambah
                        </button>
                    </div>

                    {isLoadingUsers ? (
                        <div className="text-center py-12"><div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto" /></div>
                    ) : salesUsers.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-zinc-100">
                            <Users size={40} className="mx-auto mb-3 text-zinc-300" />
                            <p className="text-xs font-bold text-zinc-400">Belum ada user sales</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {salesUsers.map(u => (
                                <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-zinc-900">{u.name || u.username}</p>
                                            <p className="text-[10px] font-bold text-zinc-400">@{u.username}</p>
                                            {u.spv && <p className="text-[10px] font-bold text-zinc-500 mt-0.5">SPV: {u.spv}</p>}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                                            {u.status || 'active'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <button onClick={() => handleToggleStatus(u.id, u.status)}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${u.status === 'active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                            {u.status === 'active' ? 'Non-aktifkan' : 'Aktifkan'}
                                        </button>
                                        <button onClick={() => handleEditUser(u)}
                                            className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-zinc-50 text-zinc-600 hover:bg-zinc-100 transition-all active:scale-95 flex items-center gap-1">
                                            <Edit2 size={10} />Edit
                                        </button>
                                        <button onClick={() => handleDeleteUser(u.id, u.name || u.username)}
                                            className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-500 hover:bg-red-100 transition-all active:scale-95 flex items-center gap-1">
                                            <Trash2 size={10} />Hapus
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {showUserForm && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => { setShowUserForm(false); setEditingUser(null); }}>
                            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                                <h3 className="text-lg font-black mb-4">{editingUser ? 'Edit User' : 'Tambah User Baru'}</h3>
                                <form onSubmit={handleSaveUser} className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Username</label>
                                        <input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                            disabled={!!editingUser}
                                            className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all disabled:opacity-50" placeholder="username" required />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Nama Lengkap</label>
                                        <input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                                            className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all" placeholder="Nama lengkap" required />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Password {editingUser && '(kosongkan jika tidak diubah)'}</label>
                                        <input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                            className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all" placeholder="••••••••" required={!editingUser} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">SPV / Atasan</label>
                                        <input value={userForm.spv} onChange={e => setUserForm({ ...userForm, spv: e.target.value })}
                                            className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all" placeholder="Nama SPV" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Status</label>
                                        <select value={userForm.status} onChange={e => setUserForm({ ...userForm, status: e.target.value })}
                                            className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-zinc-900 transition-all">
                                            <option value="active">Active</option>
                                            <option value="non-active">Non-active</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                                            {editingUser ? 'Update' : 'Simpan'}
                                        </button>
                                        <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); }}
                                            className="px-6 py-3 rounded-xl text-zinc-400 text-[11px] font-black uppercase tracking-widest">
                                            Batal
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
        <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
    );
}
