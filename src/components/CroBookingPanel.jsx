import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info, Search, Send, Plus, ShieldCheck, Truck, X } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import DmsBookingListView from './DmsBookingListView';

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

    // Vehicle search state
    const [plateSearch, setPlateSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [foundVehicle, setFoundVehicle] = useState(null);
    const [searchError, setSearchError] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jam: '',
        atasNama: '',
        noTelp: '',
        keluhan: '',
        km: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        setStep('form');
    };

    const resetModal = () => {
        setIsModalOpen(false);
        setStep('search');
        setPlateSearch('');
        setFoundVehicle(null);
        setSearchError('');
        setFormData({
            tanggal: new Date().toISOString().split('T')[0],
            jam: '',
            atasNama: '',
            noTelp: '',
            keluhan: '',
            km: ''
        });
        setCurrentCalMonth(new Date());
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (!formData.jam || !formData.atasNama) {
            Toastify({ text: "Harap isi jam dan nama booking!", background: "orange" }).showToast();
            return;
        }

        setIsSubmitting(true);
        try {
            const targetJam = formData.jam.replace('.', ':') + ':00';
            const janjiDatang = `${formData.tanggal} ${targetJam}`;

            const postData = {
                id_kendaraan: foundVehicle.id_kendaraan || '',
                no_polisi: foundVehicle.no_polisi,
                nama_kendaraan: foundVehicle.nama_kendaraan || foundVehicle.model_kendaraan || '',
                no_chassis: foundVehicle.no_chassis || '',
                atas_nama_booking: formData.atasNama,
                no_telp_booking: formData.noTelp,
                janji_datang: janjiDatang,
                keluhan: formData.keluhan || '-',
                booking_via: 'WA CS Service / CRO',
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
                Toastify({ text: "Booking BERHASIL ditambahkan!", background: "green" }).showToast();
                resetModal();
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error(json.message || "Gagal menyimpan booking di DMS");
            }
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
                    <h2 className="text-lg md:text-xl font-black text-zinc-900 leading-none">Booking Management</h2>
                </div>
                <button
                    onClick={() => { resetModal(); setIsModalOpen(true); }}
                    className="min-h-[44px] bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-zinc-200 group"
                >
                    <Plus size={14} className="group-hover:rotate-90 transition-transform" /> New
                </button>
            </div>

            {/* DMS List View */}
            <div className="flex-1 overflow-hidden">
                <DmsBookingListView user={user} refreshTrigger={refreshTrigger} />
            </div>

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

                                        <button type="submit" disabled={isSearching || !plateSearch.trim()}
                                            className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                                        >
                                            {isSearching ? 'Mencari...' : 'Cari Kendaraan'}
                                            <Search size={16} />
                                        </button>
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
                                                <div className="flex items-center justify-between mb-4 px-1">
                                                    <button type="button" onClick={() => changeCalMonth(-1)} className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"><ChevronLeft size={16} /></button>
                                                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-900">
                                                        {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                                    </h4>
                                                    <button type="button" onClick={() => changeCalMonth(1)} className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"><ChevronRight size={16} /></button>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1 text-center text-[8px] font-black uppercase text-zinc-400 mb-2">
                                                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d}>{d}</div>)}
                                                </div>
                                                <div className="grid grid-cols-7 gap-2">
                                                    {calendarGrid.map((item, idx) => {
                                                        if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-5"><div className="w-full h-full border border-dashed border-zinc-200 rounded-xl"></div></div>;
                                                        const isActive = formData.tanggal === item.date;
                                                        const isPast = new Date(item.date) < new Date().setHours(0, 0, 0, 0);
                                                        const isSunday = new Date(item.date).getDay() === 0;
                                                        return (
                                                            <button key={idx} type="button" disabled={isPast || isSunday}
                                                                onClick={() => setFormData({ ...formData, tanggal: item.date, jam: '' })}
                                                                className={`relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center transition-all border-2 ${isPast || isSunday ? 'bg-zinc-100/30 border-transparent text-zinc-200 cursor-not-allowed opacity-20' :
                                                                    isActive ? 'bg-black border-black text-white shadow-lg z-10 scale-110' : 'bg-white border-zinc-100 text-zinc-800 hover:border-zinc-400'
                                                                }`}
                                                            >
                                                                <span className="text-[11px] font-black">{item.day}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Quick time slots */}
                                            <div className="space-y-2">
                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Jam Kedatangan</h4>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {Array.from({ length: 12 }, (_, i) => {
                                                        const h = 8 + Math.floor(i / 2);
                                                        const m = i % 2 === 0 ? '00' : '30';
                                                        const slot = `${h}.${m}`;
                                                        const isPastTime = formData.tanggal === new Date().toISOString().split('T')[0] && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                                                        return (
                                                            <button key={slot} type="button" disabled={isPastTime}
                                                                onClick={() => setFormData({ ...formData, jam: slot })}
                                                                className={`py-2.5 px-2 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all ${formData.jam === slot ? 'bg-black border-black text-white shadow-lg' :
                                                                    isPastTime ? 'bg-zinc-50 border-transparent text-zinc-200 cursor-not-allowed' : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                                                }`}
                                                            >
                                                                {h.toString().padStart(2, '0')}:{m} WIB
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Vehicle info + fields */}
                                        <div className="space-y-6 flex flex-col h-full lg:border-r border-zinc-100 lg:pr-6">
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
                                                        <span className="font-black text-zinc-900">{foundVehicle?.no_polisi}</span>
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
                                                    <p className="text-[10px] font-bold text-zinc-600 leading-relaxed">Booking akan dikirim ke DMS. Pastikan data sudah sesuai.</p>
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
