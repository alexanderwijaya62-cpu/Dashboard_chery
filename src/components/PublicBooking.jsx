import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, Send, User, ChevronLeft, ChevronRight, Phone, CheckCircle2, AlertCircle, MapPin, ShieldCheck, Bookmark, X } from 'lucide-react';
import Toastify from 'toastify-js';
import { API_KEY, GAS_BOOKING_URL } from '../utils/config';
import orientalLogo from '../assets/cherylogo.png';

const TIPE_MOBIL = [
    "Tiggo 5x", "Tiggo Cross", "Tiggo Cross Csh", "Tiggo 7", "Tiggo 8 Pro",
    "Tiggo 8", "Tiggo 8 Csh", "Tiggo 9 Csh", "J6", "Omoda 5", "Omoda EV",
    "Omoda 5 GT", "Chery C5", "Chery C5 Csh", "J5", "J7", "J8"
];

const JAM_PILIHAN = ["08.30", "09.00", "09.30", "10.00"];
const KEPERLUAN = ["Free Service 1", "Free Service 2", "Free Service 3", "General Repair", "Perawatan Berkala", "Claim Warranty"];

const isSameDate = (dateA, dateB) => {
    const normalize = (d) => {
        if (!d) return "";
        if (d instanceof Date) return d.toISOString().split('T')[0];
        const str = String(d);
        if (str.includes("/")) {
            const [dd, mm, yyyy] = str.split("/");
            return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
        return str.split(/[T ]/)[0];
    };
    return normalize(dateA) === normalize(dateB);
};

export default function PublicBooking({ user }) {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isBookingMode, setIsBookingMode] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const [formData, setFormData] = useState({
        jam: '', tipeMobil: '', noPlat: '', namaCustomer: '', keperluanService: '', vin: '', noTelp: ''
    });

    const customFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: { ...options.headers, "x-api-key": API_KEY }
        });
    };

    const fetchBookings = async () => {
        try {
            if (!GAS_BOOKING_URL) return;
            const resp = await customFetch(GAS_BOOKING_URL);
            const data = await resp.json();
            if (Array.isArray(data)) setBookings(data);
        } catch (e) { console.error(e); }
    };

    const fetchHolidays = async () => {
        try {
            const resp = await customFetch(`${GAS_BOOKING_URL}?action=get_holidays`);
            const data = await resp.json();
            if (Array.isArray(data)) setHolidays(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchBookings();
        fetchHolidays();
        const interval = setInterval(fetchBookings, 60000); 
        return () => clearInterval(interval);
    }, []);

    const isSunday = (date) => new Date(date).getDay() === 0;
    const getHoliday = (date) => holidays.find(h => isSameDate(h.date, date));
    const isClosed = (date) => isSunday(date) || !!getHoliday(date);

    const getDateAvailability = useCallback((dateStr) => {
        if (isClosed(dateStr)) return 'closed';
        const dayBookings = bookings.filter(b => isSameDate(b.tanggal, dateStr) && (b.status === 'waiting confirm' || b.status === 'accepted'));
        if (dayBookings.length >= JAM_PILIHAN.length) return 'full';
        return 'available';
    }, [bookings, holidays]);

    const bookingsForDate = useMemo(() => {
        return bookings.filter(b => isSameDate(b.tanggal, selectedDate) && (b.status === 'waiting confirm' || b.status === 'accepted'));
    }, [bookings, selectedDate]);

    const handleBookClick = (jam) => {
        setFormData({ ...formData, jam });
        setIsBookingMode(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.jam || !formData.tipeMobil || !formData.noPlat || !formData.namaCustomer || !formData.keperluanService || !formData.noTelp) {
            Toastify({ text: "Harap isi semua field wajib!", background: "red" }).showToast();
            return;
        }

        const isConflict = bookings.find(b => isSameDate(b.tanggal, selectedDate) && b.jam === formData.jam && (b.status === 'waiting confirm' || b.status === 'accepted'));
        if (isConflict) {
            Toastify({ text: `Maaf, slot jam ${formData.jam} baru saja terisi!`, background: "orange" }).showToast();
            setIsBookingMode(false);
            fetchBookings();
            return;
        }

        setIsLoading(true);
        const requestData = {
            tanggal: selectedDate,
            jam: formData.jam,
            tipeMobil: formData.tipeMobil,
            noPlat: formData.noPlat,
            namaCustomer: formData.namaCustomer,
            keperluanService: formData.keperluanService,
            vin: formData.vin || '-',
            bookingvia: user ? user.name : 'Web-Public',
            noTelp: formData.noTelp,
            status: 'waiting confirm'
        };

        try {
            const resp = await customFetch(GAS_BOOKING_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'add', data: requestData })
            });
            const data = await resp.json();
            if (data.success) {
                Toastify({ text: "Booking berhasil dikirim!", background: "green" }).showToast();
                let phone = "628116017300";
                const textWA = `Halo Chery, saya mau booking service:\n\nNama: ${formData.namaCustomer}\nTanggal: ${selectedDate}\nJam: ${formData.jam}\nTipe Mobil: ${formData.tipeMobil} (${formData.noPlat})\nKeperluan: ${formData.keperluanService}\nTelp: ${formData.noTelp}\n\nMohon konfirmasi booking saya. Terima kasih.`;
                window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(textWA)}`, '_blank');
                setIsBookingMode(false);
                setFormData({ jam: '', tipeMobil: '', noPlat: '', namaCustomer: '', keperluanService: '', vin: '', noTelp: '' });
                fetchBookings();
            } else {
                throw new Error("Gagal booking");
            }
        } catch (err) {
            Toastify({ text: "Terjadi kesalahan sistem", background: "red" }).showToast();
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
        <div className="min-h-screen bg-[#F4F6F8] flex flex-col font-sans">
            
            {/* COMPACT TOP HEADER */}
            <header className="bg-white border-b border-zinc-100 px-4 md:px-8 py-3 flex justify-between items-center shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                        <CalendarIcon className="text-white w-4 md:w-5" />
                    </div>
                    <div>
                        <h1 className="text-[13px] md:text-base font-black tracking-tight uppercase leading-none">Service <span className="text-red-600">Booking</span></h1>
                        <p className="text-[7.5px] md:text-[9px] font-black text-zinc-400 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                           <MapPin size={10} className="text-red-500" /> Chery Oriental Medan
                        </p>
                    </div>
                </div>
                <div className="flex items-center">
                    <div className="flex items-center gap-2 bg-zinc-100/80 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-zinc-200">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest">System Online</span>
                    </div>
                </div>
            </header>

            {/* RESPONSIVE LAYOUT */}
            <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
                
                {/* KIRI/ATAS: CALENDAR SELECTOR */}
                <div className="w-full lg:w-[420px] shrink-0 bg-white rounded-[2rem] border border-zinc-200 shadow-md flex flex-col overflow-hidden relative">
                    <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between shrink-0 bg-transparent relative z-10">
                        <button onClick={() => changeMonth(-1)} className="p-2 md:p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all">
                            <ChevronLeft size={16} />
                        </button>
                        <h2 className="text-xs md:text-sm font-black text-zinc-900 uppercase tracking-[0.2em]">
                            {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => changeMonth(1)} className="p-2 md:p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="px-4 md:px-6 pt-2 pb-0 grid grid-cols-7 gap-1 font-black text-center text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-300">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d} className="py-2">{d}</div>)}
                    </div>

                    <div className="px-3 md:px-5 pb-4 grid grid-cols-7 gap-1.5 md:gap-2">
                        {calendarGrid.map((item, idx) => {
                            if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-0 flex items-center justify-center"><div className="w-full h-full border border-zinc-100/50 rounded-xl"></div></div>;
                            
                            const availability = getDateAvailability(item.date);
                            const isSelectable = availability !== 'closed';
                            const isActive = selectedDate === item.date;
                            const isPast = new Date(item.date) < new Date().setHours(0,0,0,0);

                            return (
                                <button
                                    key={idx}
                                    disabled={isPast || !isSelectable}
                                    onClick={() => setSelectedDate(item.date)}
                                    className={`relative aspect-[4/5] rounded-[1rem] flex flex-col items-center justify-center transition-all duration-300 group overflow-hidden border ${
                                        isPast ? 'bg-zinc-50/50 opacity-40 cursor-not-allowed border-transparent text-zinc-300' :
                                        !isSelectable ? 'bg-white border-zinc-100 cursor-not-allowed opacity-50 grayscale text-zinc-400' :
                                        isActive ? 'bg-[#18181b] border-[#18181b] text-white shadow-xl scale-110 z-10 font-bold' :
                                        availability === 'available' ? 'bg-white border border-zinc-100 hover:border-emerald-500 hover:shadow-md text-zinc-800' : 
                                        'bg-white border-rose-100 cursor-not-allowed opacity-70 text-zinc-700'
                                    }`}
                                >
                                    <span className={`text-[13px] md:text-sm tracking-tight ${isActive ? 'font-black' : 'font-bold'}`}>{item.day}</span>
                                    {isSelectable && !isPast && (
                                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                                            availability === 'available' ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} />
                                    )}
                                    {isActive && <div className="absolute top-1 right-1 opacity-80"><ShieldCheck size={8} className="text-emerald-400 font-bold" /></div>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 md:p-5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-center gap-6 md:gap-8">
                         <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Available</span>
                         </div>
                         <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                            <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Full / Closed</span>
                         </div>
                    </div>
                </div>

                {/* KANAN/BAWAH: SLOTS & FORM */}
                <div className="flex-1 bg-[#1A1A1A] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative">                    
                    {!isBookingMode ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 md:p-8 flex items-center justify-between z-10 border-b border-white/5 bg-white/5 relative">
                                <div>
                                    <h2 className="text-[14px] md:text-[18px] font-black text-white uppercase tracking-wider mb-2">
                                        {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </h2>
                                    <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Clock size={10} className="text-red-500" /> Pilih Waktu Kedatangan
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 md:gap-4 shrink-0">
                                    <div className="bg-[#2A2A2A] px-3 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-white/5 text-center flex flex-col items-center">
                                        <p className="text-[6.5px] md:text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 leading-none">Total Slots</p>
                                        <p className="text-sm md:text-base font-black text-white leading-none">{JAM_PILIHAN.length}</p>
                                    </div>
                                    <div className="bg-emerald-500/10 px-3 md:px-5 py-3 md:py-4 rounded-2xl md:rounded-3xl border border-emerald-500/20 text-center flex flex-col items-center">
                                        <p className="text-[6.5px] md:text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none">Available</p>
                                        <p className="text-sm md:text-base font-black text-emerald-400 leading-none">{JAM_PILIHAN.length - bookingsForDate.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-6 md:p-8 flex flex-col z-10 gap-6 md:gap-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {JAM_PILIHAN.map((jam, idx) => {
                                        const booking = bookingsForDate.find(b => b.jam === jam);
                                        const isOccupied = !!booking;
                                        return (
                                            <div key={idx} className={`p-4 md:p-5 rounded-[1.5rem] border flex items-center justify-between group/item transition-all ${
                                                isOccupied ? 'bg-[#2A2A2A] border-transparent opacity-50 cursor-not-allowed' : 'bg-[#2A2A2A] border-white/5 cursor-pointer hover:bg-[#333] hover:border-emerald-500/30'
                                            }`} onClick={() => !isOccupied && handleBookClick(jam)}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-mono text-sm md:text-base font-black transition-all ${
                                                        isOccupied ? 'bg-zinc-800 text-zinc-500' : 'bg-[#E50000] text-white shadow-lg'
                                                    }`}>
                                                        {jam}
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <p className={`text-[8.5px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${isOccupied ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                                            {isOccupied ? 'Slot Terisi' : 'Slot Tersedia'}
                                                        </p>
                                                        <h4 className={`text-sm md:text-base font-black tracking-tight ${isOccupied ? 'text-zinc-600' : 'text-white'}`}>
                                                            {isOccupied ? 'BOOKED' : 'Klik Reservasi'}
                                                        </h4>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-auto px-6 py-8 md:p-8 bg-[#222] border border-white/5 rounded-[2rem] text-center space-y-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-red-600/5 mix-blend-overlay pointer-events-none"></div>
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
                                    <p className="text-red-500 font-black uppercase tracking-[0.3em] text-[8px] md:text-[9px] mb-1.5 md:mb-2 px-1">Tahap 2: Registrasi</p>
                                    <h2 className="text-xl md:text-2xl font-black text-white tracking-widest uppercase leading-none">Detail <span className="text-red-600">Kendaraan</span></h2>
                                </div>
                                <button onClick={() => setIsBookingMode(false)} className="p-2 md:p-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-all">
                                    <X size={20} strokeWidth={3} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
                                <div className="p-6 md:p-8 space-y-8 md:space-y-10">
                                    {/* Data Customer */}
                                    <section className="space-y-4 md:space-y-5">
                                        <h3 className="text-[9px] md:text-[10px] font-black uppercase text-white tracking-widest bg-white/5 p-3 md:p-4 rounded-xl border border-white/5">👤 Info Pelanggan</h3>
                                        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 gap-4 md:gap-6">
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Pemilik</label>
                                                <input required type="text" value={formData.namaCustomer} onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all uppercase placeholder:text-zinc-600" placeholder="Contoh: Darma Sutejo" />
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">No WhatsApp (Aktif)</label>
                                                <input required type="tel" value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all placeholder:text-zinc-600" placeholder="081267XXXXX" />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Detail Kendaraan */}
                                    <section className="space-y-4 md:space-y-5">
                                        <h3 className="text-[9px] md:text-[10px] font-black uppercase text-white tracking-widest bg-white/5 p-3 md:p-4 rounded-xl border border-white/5">🚗 Info Unit</h3>
                                        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 gap-4 md:gap-6">
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Model Chery</label>
                                                <select required value={formData.tipeMobil} onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all uppercase appearance-none cursor-pointer">
                                                    <option value="" disabled className="text-zinc-500 bg-zinc-900">Pilih Model</option>
                                                    {TIPE_MOBIL.map(t => <option key={t} value={t} className="bg-zinc-900 text-white">{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nomor Polisi</label>
                                                <input required type="text" value={formData.noPlat} onChange={e => setFormData({ ...formData, noPlat: e.target.value.toUpperCase() })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all uppercase placeholder:text-zinc-600" placeholder="BK 1XXX MA" />
                                            </div>
                                        </div>
                                    </section>
                                    
                                    {/* Kebutuhan */}
                                    <section className="space-y-4 md:space-y-5">
                                        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 gap-4 md:gap-6">
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Kebutuhan Service</label>
                                                <select required value={formData.keperluanService} onChange={e => setFormData({ ...formData, keperluanService: e.target.value })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all uppercase appearance-none cursor-pointer">
                                                    <option value="" disabled className="text-zinc-500 bg-zinc-900">Pilih Layanan</option>
                                                    {KEPERLUAN.map(t => <option key={t} value={t} className="bg-zinc-900 text-white">{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2 md:space-y-3">
                                                <label className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">No Rangka (Vin) - Opsional</label>
                                                <input type="text" value={formData.vin} onChange={e => setFormData({ ...formData, vin: e.target.value.toUpperCase() })} 
                                                    className="w-full bg-[#2A2A2A] border border-white/5 p-4 rounded-xl font-black text-white text-xs md:text-sm focus:bg-[#333] outline-none focus:border-red-600 transition-all uppercase placeholder:text-zinc-600" placeholder="Opsional..." />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                                
                                <div className="mt-auto border-t border-white/10 bg-black/20 p-6 md:p-8 shrink-0 flex flex-col items-center gap-4">
                                    <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-white hover:text-red-900 py-4 rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 disabled:opacity-50">
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

            <style jsx>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
