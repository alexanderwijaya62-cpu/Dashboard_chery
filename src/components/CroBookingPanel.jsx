import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, CheckCircle, XCircle, Plus, Trash2, Clock, Car, Phone, Send, X, AlertCircle, ChevronLeft, ChevronRight, Info, Download, Upload } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabaseClient';

const TIPE_MOBIL = [
    "Tiggo 5x", "Tiggo Cross", "Tiggo Cross Csh", "Tiggo 7", "Tiggo 8 Pro",
    "Tiggo 8", "Tiggo 8 Csh", "Tiggo 9 Csh", "J6", "Omoda 5", "Omoda EV",
    "Omoda 5 GT", "Chery C5", "Chery C5 Csh", "J5", "J7", "J8"
];
const generateSlots = (count) => {
    const slots = [];
    let currentHour = 8;
    let currentMin = 30;
    for (let i = 0; i < count; i++) {
        const h = String(currentHour).padStart(2, '0');
        const m = String(currentMin).padStart(2, '0');
        slots.push(`${h}.${m}`);
        currentMin += 30;
        if (currentMin >= 60) {
            currentHour += 1;
            currentMin = 0;
        }
    }
    return slots;
};
const KEPERLUAN = ["Free Service 1", "Free Service 2", "Free Service 3", "Keluhan"];



export default function CroBookingPanel({ user }) {
    const [bookings, setBookings] = useState([]);
    const [currentView, setCurrentView] = useState('list'); // 'list' or 'booking'
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('waiting');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(null); // id of booking or null
    const [filterKeperluan, setFilterKeperluan] = useState('');
    const [sortAsc, setSortAsc] = useState(true);
    const [filterDate, setFilterDate] = useState('');
    const [holidays, setHolidays] = useState([]);
    const fileInputRef = React.useRef(null);
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jam: '',
        tipeMobil: '',
        noPlat: '',
        namaCustomer: '',
        keperluanService: '',
        keluhanDetail: '',
        vin: '',
        noTelp: ''
    });


    const fetchBookings = async () => {
        try {
            const { data, error } = await supabase
                .from('booking')
                .select('*')
                .order('tanggal', { ascending: false });

            if (error) throw error;
            setBookings(data || []);
        } catch (e) {
            console.error("Fetch Error:", e);
            Toastify({ text: `Gagal fetch data: ${e.message}`, background: "red" }).showToast();
        }
    };

    const fetchHolidays = async () => {
        try {
            const { data, error } = await supabase.from('libur').select('*');
            if (error) throw error;
            setHolidays(data || []);
        } catch (e) {
            console.error("Fetch Libur Error:", e);
        }
    };

    const handleExportTemplate = () => {
        const template = [
            {
                tanggal: '2024-04-15',
                jam: '08.30',
                namaCustomer: 'Contoh Nama',
                noTelp: '08123456789',
                noPlat: 'BK 1234 AB',
                tipeMobil: 'Omoda 5',
                keperluanService: 'Free Service 1',
                vin: '1234567890'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Import_Booking.xlsx");
    };

    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);

                if (rawData.length === 0) {
                    alert("File kosong!");
                    return;
                }

                setIsLoading(true);
                const bookingsToInsert = [];

                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    
                    // Parse Date Safely (Avoiding UTC offset issues for local dates)
                    let finalDate = "";
                    if (typeof row.tanggal === 'number') {
                        // Excel serial number
                        const d = new Date(Math.round((row.tanggal - 25569) * 86400 * 1000));
                        finalDate = d.toLocaleString('sv').split(' ')[0]; // Returns local YYYY-MM-DD
                    } else {
                        const s = String(row.tanggal || '').trim();
                        if (s.includes('/')) {
                            // Convert DD/MM/YYYY or MM/DD/YYYY to YYYY-MM-DD
                            const parts = s.split('/');
                            if (parts[2]?.length === 4) finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            else finalDate = s;
                        } else if (s.includes('-')) {
                            finalDate = s;
                        } else {
                            finalDate = new Date().toLocaleString('sv').split(' ')[0]; // Fallback today
                        }
                    }
                    if (!finalDate || !finalDate.includes('-')) finalDate = new Date().toLocaleString('sv').split(' ')[0];

                    const finalJam = String(row.jam || '08.30').replace(':', '.');

                    // Validation: Duplicate Check against CURRENT ACTIVE bookings
                    const isDuplicate = bookings.some(b => 
                        b.id !== 999999 && 
                        b.status !== 'deleted' && 
                        b.status !== 'declined' && 
                        b.tanggal === finalDate && 
                        String(b.jam).replace(':', '.') === finalJam
                    );

                    if (isDuplicate) {
                        Toastify({ text: `❌ BENTROK: Data pada tanggal ${finalDate} jam ${finalJam} sudah diisi pelanggan lain. Import DIBATALKAN untuk keamanan antrian!`, background: "red", duration: 7000 }).showToast();
                        setIsLoading(false);
                        e.target.value = '';
                        return; // Membatalkan seluruh import
                    }

                    bookingsToInsert.push({
                        id: Date.now() + i,
                        tanggal: finalDate,
                        jam: finalJam,
                        namaCustomer: String(row.namaCustomer || 'N/A'),
                        noTelp: String(row.noTelp || ''),
                        noPlat: String(row.noPlat || '').toUpperCase().replace(/\s+/g, ''),
                        tipeMobil: String(row.tipeMobil || ''),
                        keperluanService: String(row.keperluanService || 'Service'),
                        vin: String(row.vin || ''),
                        status: 'accepted',
                        bookingVia: 'Import Excel'
                    });
                }

                const { error } = await supabase
                    .from('booking')
                    .insert(bookingsToInsert);

                if (error) throw error;

                Toastify({
                    text: `Berhasil import ${bookingsToInsert.length} data!`,
                    duration: 3000,
                    gravity: "top",
                    position: "center",
                    style: { background: "#10b981" }
                }).showToast();

                fetchBookings();
            } catch (err) {
                console.error(err);
                alert("Gagal import! Periksa format excel Anda.");
            } finally {
                setIsLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    useEffect(() => {
        fetchBookings();
        fetchHolidays();

        // REAL-TIME: Subscribe to changes in the 'booking' table
        const bookingSubscription = supabase
            .channel('booking-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'booking' },
                (payload) => {
                    console.log('Change received in CRO Booking Panel!', payload);
                    fetchBookings();
                }
            )
            .subscribe();

        // Listener untuk membuka modal dari luar (navbar)
        const openAddModal = () => {
            setIsEditing(null);
            setFormData({
                tanggal: new Date().toISOString().split('T')[0],
                jam: '', tipeMobil: '', noPlat: '',
                namaCustomer: '', keperluanService: '', keluhanDetail: '',
                vin: '', noTelp: ''
            });
            setIsModalOpen(true);
        };
        window.addEventListener('open-add-booking', openAddModal);

        return () => {
            supabase.removeChannel(bookingSubscription);
            window.removeEventListener('open-add-booking', openAddModal);
        };
    }, []); // Fixed infinite loop by removing bookings from dependency

    const configSlot = bookings.find(b => b.id === 999999);
    const maxSlotsCount = configSlot ? parseInt(configSlot.namaCustomer) || 8 : 8;
    const dynamicJamPilihan = useMemo(() => generateSlots(maxSlotsCount), [maxSlotsCount]);

    const updateMaxSlots = async (val) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('booking')
                .upsert({
                    id: 999999,
                    namaCustomer: val.toString(), // we use namaCustomer to store the count
                    noPlat: 'CONFIG_MAX_SLOTS',
                    tanggal: '1900-01-01',
                    jam: 0,
                    status: 'system'
                });
            if (error) throw error;
            Toastify({ text: `Kapasitas Booking berhasil diubah menjadi ${val} per jam!`, background: "blue" }).showToast();
            fetchBookings();
        } catch (e) {
            console.error("Update Max Slots Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        if (!window.confirm(`Yakin ingin mengubah status menjadi: ${newStatus.toUpperCase()}?`)) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('booking')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            Toastify({ text: `Status berhasil diubah menjadi ${newStatus}!`, background: "green" }).showToast();
            fetchBookings();
        } catch (e) {
            console.error("Update Status Error:", e);
            Toastify({ text: "Gagal update status", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (b) => {
        if (!window.confirm("Hapus data booking ini? Data akan masuk ke Riwayat Hapus Owner.")) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('booking')
                .update({ 
                    status: 'deleted',
                    bookingVia: `Dihapus_Oleh: ${user?.name || 'Unknown'} - ${b.bookingVia || ''}` 
                })
                .eq('id', b.id);

            if (error) throw error;

            Toastify({ text: "Data dipindahkan ke Riwayat Hapus!", background: "blue" }).showToast();
            fetchBookings();
        } catch (e) {
            console.error("Delete Error:", e);
            Toastify({ text: "Gagal hapus", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        // 1. Validasi slot linear (1 slot per jam sekarang)
        if (!isEditing) {
            const bookedAtThisTime = bookings.filter(b => 
                b.id !== 999999 && 
                b.tanggal === formData.tanggal && 
                b.jam === formData.jam && 
                (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
            ).length;

            if (bookedAtThisTime >= 1) {
                Toastify({ text: `❌ GAGAL: Slot jam ${formData.jam} sudah terisi!`, background: "orange", duration: 5000 }).showToast();
                return;
            }
        }

        setIsLoading(true);
        try {
            const isKeluhan = formData.keperluanService.includes('Keluhan');
            const finalKeperluan = isKeluhan ?
                (formData.keperluanService.includes(':') ? formData.keperluanService : `Keluhan: ${formData.keluhanDetail}`) :
                formData.keperluanService;

            if (isEditing) {
                const { error } = await supabase
                    .from('booking')
                    .update({
                        ...formData,
                        noPlat: formData.noPlat.toUpperCase().replace(/\s+/g, ''),
                        keperluanService: finalKeperluan,
                        jam: formData.jam
                    })
                    .eq('id', isEditing);

                if (error) throw error;
                Toastify({ text: "✅ Booking BERHASIL diperbarui!", background: "green" }).showToast();
            } else {
                const { data: latestBooking } = await supabase
                    .from('booking')
                    .select('noUrut')
                    .order('noUrut', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const currentMax = Number(latestBooking?.noUrut || 0);
                const nextNoUrut = currentMax + 1;

                const newBooking = {
                    id: Date.now(),
                    noUrut: nextNoUrut,
                    ...formData,
                    noPlat: formData.noPlat.toUpperCase().replace(/\s+/g, ''),
                    keperluanService: finalKeperluan,
                    jam: formData.jam,
                    bookingVia: user?.name ? `CRO ${user.name}` : 'CRO Portal',
                    status: 'accepted'
                };

                const { error } = await supabase
                    .from('booking')
                    .insert([newBooking]);

                if (error) throw error;
                Toastify({ text: "✅ Booking BERHASIL ditambahkan!", background: "green" }).showToast();
            }
            setIsModalOpen(false);
            fetchBookings();
        } catch (e) {
            console.error("Submit Error:", e);
            Toastify({ text: `❌ ERROR SUBMIT: ${e.message || 'Gagal menyimpan data.'}`, background: "red", duration: 5000 }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return "-";
        if (dateStr.includes("/")) return dateStr;
        if (dateStr.includes("-")) {
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    };

    const parseDateForSort = (str) => {
        if (!str || str === "-") return new Date(0);
        if (str.includes('/')) {
            const [d, m, y] = str.split('/');
            return new Date(y, parseInt(m) - 1, d);
        }
        if (str.includes('-')) {
            const [y, m, d] = str.split('-');
            if (y?.length === 4) return new Date(y, m - 1, d);
            return new Date(d, m - 1, y);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date(0) : d;
    };

    const isSameDate = (d1, d2) => {
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
        return normalize(d1) === normalize(d2);
    };

    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

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

    const getDateStatus = (date) => {
        if (!date) return 'none';
        const isHol = holidays.find(h => isSameDate(h.date, date));
        const isSun = new Date(date).getDay() === 0;
        if (isHol || isSun) return 'closed';
        
        const bCount = bookings.filter(b => b.id !== 999999 && isSameDate(b.tanggal, date) && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')).length;
        if (bCount >= (dynamicJamPilihan.length)) return 'full';
        if (bCount > 0) return 'partial';
        return 'empty';
    };

    const sortedAndFilteredBookings = useMemo(() => {
        let filtered = bookings.filter(b => {
            if (b.status === 'deleted') return false;
            const term = searchTerm.toLowerCase();
            const matchSearch =
                String(b.namaCustomer).toLowerCase().includes(term) ||
                String(b.noPlat).toLowerCase().includes(term) ||
                String(b.tipeMobil).toLowerCase().includes(term) ||
                String(b.tanggal).toLowerCase().includes(term) ||
                String(b.jam).toLowerCase().includes(term);

            const matchDate = !filterDate || isSameDate(b.tanggal, filterDate);
            const matchStatus =
                activeTab === 'waiting' ? b.status === 'waiting confirm' :
                    activeTab === 'processed' ? (b.status === 'accepted' || b.status === 'declined') :
                        true;

            const matchKeperluan = !filterKeperluan || String(b.keperluanService).toLowerCase().includes(filterKeperluan.toLowerCase());

            return matchSearch && matchDate && matchStatus && matchKeperluan;
        });

        return filtered.sort((a, b) => {
            const dateA = parseDateForSort(a.tanggal);
            const dateB = parseDateForSort(b.tanggal);
            let result = 0;
            if (dateA.getTime() !== dateB.getTime()) {
                result = dateA - dateB;
            } else {
                const jamA = parseFloat(String(a.jam).replace('.', '.'));
                const jamB = parseFloat(String(b.jam).replace('.', '.'));
                result = jamA - jamB;
            }
            return sortAsc ? result : -result;
        });
    }, [bookings, searchTerm, activeTab, filterKeperluan, sortAsc, filterDate]);

    const pendingCount = bookings.filter(b => b.status === 'waiting confirm').length;

    const handleEdit = (booking) => {
        setIsEditing(booking.id);
        const [d, m, y] = formatDateDisplay(booking.tanggal).split('/');
        const isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

        let details = '';
        if (booking.keperluanService?.includes(':')) {
            details = booking.keperluanService.split(':')[1].trim();
        }

        setFormData({
            tanggal: isoDate,
            jam: typeof booking.jam === 'number' ? booking.jam.toFixed(2).replace('.', '.') : booking.jam,
            tipeMobil: booking.tipeMobil || '',
            noPlat: booking.noPlat || '',
            namaCustomer: booking.namaCustomer || '',
            keperluanService: booking.keperluanService?.startsWith('Keluhan') ? 'Keluhan' : booking.keperluanService,
            keluhanDetail: details,
            vin: booking.vin || '',
            noTelp: booking.noTelp || ''
        });
        setIsModalOpen(true);
    };

    return (
        <div className="flex-1 w-full bg-white relative overflow-hidden flex flex-col h-full animate-fade-in transition-colors duration-500 p-0">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center px-6 lg:px-8 py-3 mb-0 gap-4 xl:gap-6 shrink-0 relative z-10 border-b border-zinc-100">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-lg text-white">
                            <Calendar size={20} />
                        </div>
                        <h2 className="text-xl font-black text-zinc-900 leading-none">Booking Management</h2>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-3 bg-zinc-50 border border-zinc-200 px-3 md:px-4 py-1.5 rounded-2xl shadow-sm">
                        <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-400 tracking-widest leading-none">Jumlah Slot</span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    if (maxSlotsCount > 1) updateMaxSlots(maxSlotsCount - 1);
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-900 hover:text-white transition-all text-xs font-black shadow-sm"
                            >
                                -
                            </button>
                            <span className="text-xs font-black text-zinc-900 w-4 text-center">
                                {maxSlotsCount}
                            </span>
                            <button 
                                onClick={() => {
                                    updateMaxSlots(maxSlotsCount + 1);
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-900 hover:text-white transition-all text-xs font-black shadow-sm"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:gap-3 w-full xl:w-auto">
                    <nav className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                        <button 
                            onClick={() => setCurrentView('list')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${currentView === 'list' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            List View
                        </button>
                        <button 
                            onClick={() => setCurrentView('booking')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${currentView === 'booking' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Booking System
                        </button>
                    </nav>

                    <div className="h-4 w-px bg-zinc-200 mx-2 hidden xl:block"></div>

                    <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                        <button onClick={() => setActiveTab('waiting')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${activeTab === 'waiting' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            Waiting {pendingCount > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">{pendingCount}</span>}
                        </button>
                        <button onClick={() => setActiveTab('processed')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'processed' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            Processed
                        </button>
                        <button onClick={() => setActiveTab('all')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                            All
                        </button>
                    </div>

                    <div className="flex items-center gap-2 h-full">
                        <button onClick={handleExportTemplate} className="bg-white border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-600 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all">
                            <Download size={14} /> Template
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all">
                            <Upload size={14} /> Import
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                    </div>

                    <button onClick={() => { setIsEditing(null); setIsModalOpen(true); }} className="bg-zinc-900 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-zinc-200 group">
                        <Plus size={14} className="group-hover:rotate-90 transition-transform" /> New
                    </button>
                </div>
            </div>

            {currentView === 'list' ? (
                <>
                    <div className="px-6 lg:px-8 py-3 shrink-0 flex flex-col md:flex-row gap-4 bg-zinc-50/50 border-b border-zinc-100">
                <div className="relative group flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-red-600 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, plate number, or car type..."
                        className="w-full bg-zinc-50 border border-zinc-100 p-3 pl-12 rounded-[1.2rem] text-sm font-bold text-zinc-900 focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all shadow-sm group-hover:shadow-md"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <input
                        type="date"
                        className="bg-zinc-50 border border-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-red-600 cursor-pointer"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />

                    <select
                        className="bg-zinc-50 border border-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase outline-none focus:border-red-600"
                        value={filterKeperluan}
                        onChange={(e) => setFilterKeperluan(e.target.value)}
                    >
                        <option value="">All Services</option>
                        {KEPERLUAN.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>

                    {(filterDate || filterKeperluan || searchTerm) && (
                        <button
                            onClick={() => { setFilterDate(''); setFilterKeperluan(''); setSearchTerm(''); }}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        >
                            Reset
                        </button>
                    )}

                    <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="bg-zinc-50 border border-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-white transition-all"
                    >
                        {sortAsc ? 'Oldest First' : 'Newest First'}
                        <Clock size={14} className={sortAsc ? '' : 'rotate-180 transition-transform'} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <div className="hidden lg:block overflow-y-auto overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-50 z-10 border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">No.</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date & Time</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Customer Details</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Unit Info</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Service Plan</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Contact</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {sortedAndFilteredBookings.map((b, idx) => (
                                <tr key={b.id} className="group hover:bg-zinc-50/50 transition-all">
                                    <td className="px-6 py-6 text-[10px] font-black text-zinc-400">#{(b.noUrut || idx + 1).toString().padStart(3, '0')}</td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-1">
                                            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black border border-red-100 block w-fit">
                                                {formatDateDisplay(b.tanggal)}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 pl-1">
                                                <Clock size={12} className="text-zinc-400" /> {typeof b.jam === 'number' ? b.jam.toFixed(2).replace('.', '.') : b.jam} WIB
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-0.5">
                                            <h3 className="font-black text-zinc-900 group-hover:text-red-700 transition-colors uppercase text-sm leading-tight">{b.namaCustomer || '-'}</h3>
                                            <p className="text-[10px] font-bold text-zinc-400 tracking-wide">VIN: {b.vin || '-'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-1">
                                            <span className="flex items-center gap-1.5 text-xs font-black text-zinc-900">
                                                <Car size={14} className="text-zinc-400" /> {String(b.noPlat).toUpperCase()}
                                            </span>
                                            <p className="text-[11px] font-bold text-zinc-500 pl-5">{b.tipeMobil}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="space-y-2">
                                            <div className={`px-4 py-2 rounded-xl text-[10px] font-black border flex flex-col gap-1 shadow-sm
                                                ${b.keperluanService?.startsWith('Keluhan') ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-rose-50' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50'}`}>
                                                <span className="uppercase tracking-widest">{b.keperluanService?.split(':')[0]}</span>
                                                {b.keperluanService?.includes(':') && (
                                                    <span className="text-[8px] font-bold text-rose-500 normal-case italic border-t border-rose-100 pt-1 mt-1">
                                                        {b.keperluanService.split(':')[1]}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[9px] font-bold text-zinc-400 pl-1 italic">Via: {b.bookingVia || 'System'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <a href={`https://wa.me/${String(b.noTelp).replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 group/wa">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover/wa:bg-green-600 group-hover/wa:text-white transition-all">
                                                <Phone size={14} />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-600 border-b border-zinc-200 hover:border-green-600 transition-all">{b.noTelp}</span>
                                        </a>
                                    </td>
                                    <td className="px-6 py-6 border-l border-zinc-100/10">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            {b.status === 'waiting confirm' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleStatusUpdate(b.id, 'accepted')} className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-[1rem] shadow-lg shadow-green-100 transition-all active:scale-90" title="Terima Booking">
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button onClick={() => handleStatusUpdate(b.id, 'declined')} className="p-3 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-[1rem] transition-all active:scale-90" title="Tolak Booking">
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button onClick={() => handleEdit(b)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Edit Booking">
                                                        <Plus size={16} /> Edit
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <select
                                                            value={b.status}
                                                            onChange={(e) => handleStatusUpdate(b.id, e.target.value)}
                                                            className={`text-[9px] font-black uppercase tracking-[0.05em] px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all
                                                                ${b.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                                                    b.status === 'declined' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                                                        b.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                                                            'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}
                                                        >
                                                            <option value="accepted">Accepted</option>
                                                            <option value="declined">Declined</option>
                                                            <option value="completed">Completed</option>
                                                            <option value="waiting confirm">Waiting</option>
                                                            <option value="no show">No Show</option>
                                                        </select>
                                                        <button onClick={() => handleEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit">
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <button onClick={() => handleDelete(b)} className="text-[10px] font-bold text-zinc-300 hover:text-red-500 flex items-center gap-1 transition-all" title="Hapus Data">
                                                <Trash2 size={12} /> Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="lg:hidden flex-1 overflow-y-auto bg-zinc-50 p-2 space-y-4">
                    {sortedAndFilteredBookings.map((b, idx) => (
                        <div key={b.id} className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 py-2 px-4 bg-zinc-50 rounded-bl-3xl border-l border-b border-zinc-100 text-[9px] font-black text-zinc-400">
                                #{(b.noUrut || idx + 1).toString().padStart(3, '0')}
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="bg-red-50 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-red-600 border border-red-100 shrink-0">
                                    <span className="text-[10px] font-black leading-none uppercase">{parseDateForSort(b.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                    <span className="text-lg font-black leading-none">{parseDateForSort(b.tanggal).getDate()}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-zinc-900 text-base leading-tight uppercase">{b.namaCustomer || '-'}</h3>
                                    <p className="text-[10px] font-bold text-zinc-400">Jam: {b.jam} WIB • Via {b.bookingVia || 'Web'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Unit & Plat</p>
                                    <p className="text-xs font-black text-zinc-800 leading-tight">{b.noPlat}</p>
                                    <p className="text-[10px] font-bold text-zinc-500">{b.tipeMobil}</p>
                                </div>
                                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 col-span-2">
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Layanan / Plan</p>
                                    <div className={`px-4 py-3 rounded-xl text-[11px] font-black border
                                        ${b.keperluanService?.startsWith('Keluhan') ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                        {b.keperluanService}
                                    </div>
                                    <p className="text-[9px] font-bold text-zinc-400 mt-2 italic px-1">Unit: {b.tipeMobil} • {b.vin || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <a href={`https://wa.me/${String(b.noTelp).replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                                    <Phone size={14} className="text-green-600" />
                                    <span className="text-[11px] font-black text-green-700">{b.noTelp}</span>
                                </a>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEdit(b)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl" title="Edit">
                                        <Plus size={16} />
                                    </button>
                                    {b.status === 'waiting confirm' ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleStatusUpdate(b.id, 'accepted')} className="p-2.5 bg-green-500 text-white rounded-xl shadow-lg shadow-green-100">
                                                <CheckCircle size={16} />
                                            </button>
                                            <button onClick={() => handleStatusUpdate(b.id, 'declined')} className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <select
                                            value={b.status}
                                            onChange={(e) => handleStatusUpdate(b.id, e.target.value)}
                                            className="text-[9px] font-black px-3 py-1.5 rounded-lg border bg-zinc-50 outline-none"
                                        >
                                            <option value="accepted">Accepted</option>
                                            <option value="declined">Declined</option>
                                            <option value="completed">Completed</option>
                                            <option value="waiting confirm">Waiting</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-white z-[999] flex flex-col animate-fade-in overflow-hidden">
                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-8 p-3 bg-zinc-100 hover:bg-red-600 text-zinc-900 hover:text-white rounded-2xl transition-all z-[1000] shadow-sm">
                            <X size={24} strokeWidth={3} />
                        </button>

                        <div className="px-8 py-6 md:px-12 md:py-10 flex-1 flex flex-col overflow-hidden">
                            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 pb-6 shrink-0">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-black text-zinc-900 uppercase tracking-tight leading-none">
                                        {isEditing ? 'Edit Existing Booking' : 'New Manual Booking'}
                                    </h2>
                                    <div className="text-zinc-400 font-bold text-[9px] uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div> CRO ENTRY SYSTEM
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black uppercase text-zinc-400">Ready</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[8px] font-black uppercase text-zinc-400">Partial</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[8px] font-black uppercase text-zinc-400">Full</span></div>
                                </div>
                            </div>

                            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12 flex-1 overflow-hidden h-full">
                                {/* Column 1: Date */}
                                <div className="space-y-8 flex flex-col h-full border-r border-zinc-100 pr-10">
                                    <div className="space-y-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                            <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">1</div> Select Date
                                        </h3>

                                        <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 shadow-sm">
                                            <div className="flex items-center justify-between mb-5 px-1">
                                                <button type="button" onClick={() => changeCalMonth(-1)} className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"><ChevronLeft size={16} /></button>
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-900">
                                                    {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                                </h4>
                                                <button type="button" onClick={() => changeCalMonth(1)} className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"><ChevronRight size={16} /></button>
                                            </div>

                                            <div className="grid grid-cols-7 gap-1 text-center text-[8px] font-black uppercase text-zinc-400 mb-3">
                                                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d}>{d}</div>)}
                                            </div>

                                            <div className="grid grid-cols-7 gap-2">
                                                {calendarGrid.map((item, idx) => {
                                                    if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-5"><div className="w-full h-full border border-dashed border-zinc-200 rounded-xl"></div></div>;

                                                    const status = getDateStatus(item.date);
                                                    const isActive = formData.tanggal === item.date;
                                                    const isPast = new Date(item.date) < new Date().setHours(0, 0, 0, 0);

                                                    return (
                                                        <button
                                                            key={idx} type="button" disabled={isPast || status === 'closed'}
                                                            onClick={() => setFormData({ ...formData, tanggal: item.date, jam: '' })}
                                                            className={`relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center transition-all border-2 ${isPast || status === 'closed' ? 'bg-zinc-100/30 border-transparent text-zinc-200 cursor-not-allowed opacity-20' :
                                                                isActive ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg z-10 scale-110' :
                                                                    status === 'empty' ? 'bg-white border-zinc-100 text-zinc-800 hover:border-red-400' :
                                                                        status === 'partial' ? 'bg-white border-amber-200 text-zinc-800 hover:border-amber-500 shadow-sm' :
                                                                            'bg-white border-rose-50 text-rose-200 cursor-not-allowed opacity-50'
                                                                }`}
                                                        >
                                                            <span className="text-[11px] font-black">{item.day}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Arrival & Unit */}
                                <div className="space-y-10 flex flex-col h-full border-r border-zinc-100 pr-10">
                                    <div className="space-y-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                            <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">2</div> Arrival Slot
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {dynamicJamPilihan.map(j => {
                                                const slotBookings = bookings.filter(b => 
                                                    b.id !== 999999 &&
                                                    isSameDate(b.tanggal, formData.tanggal) && 
                                                    b.jam === j && 
                                                    (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')
                                                );
                                                
                                                const isFull = slotBookings.length >= 1;
                                                const isPastTime = isSameDate(formData.tanggal, new Date()) && (parseFloat(j) < (new Date().getHours() + (new Date().getMinutes() / 100)));

                                                return (
                                                    <button
                                                        key={j} type="button" disabled={(isFull && !isEditing) || isPastTime} onClick={() => setFormData({ ...formData, jam: j })}
                                                        className={`relative py-3.5 px-2 rounded-[1.2rem] border-2 font-black text-[10px] uppercase tracking-widest transition-all overflow-hidden ${formData.jam === j ? 'bg-black border-black text-white shadow-lg scale-105' :
                                                            isFull ? 'bg-zinc-100 border-transparent text-zinc-300 cursor-not-allowed grayscale opacity-30 shadow-inner' :
                                                                'bg-white border-zinc-100 text-zinc-400 hover:border-red-200 hover:text-red-700 hover:bg-red-50'}`}
                                                    >
                                                        {j} WIB
                                                        <div className={`absolute bottom-0 right-0 left-0 h-1 ${isFull ? 'bg-red-600' : 'bg-emerald-500/10'}`}></div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                            <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">3</div> Customer & Unit
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nama Customer</label>
                                                    <input required type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all" placeholder="Input Nama" value={formData.namaCustomer} onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">WhatsApp</label>
                                                    <input required type="tel" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all" placeholder="08..." value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Model Unit</label>
                                                    <select required className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all appearance-none cursor-pointer" value={formData.tipeMobil} onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })}>
                                                        <option value="">- Pilih Model -</option>
                                                        {TIPE_MOBIL.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">No Polisi</label>
                                                    <input required type="text" className="w-full uppercase bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all" placeholder="BK XXXX XX" value={formData.noPlat} onChange={e => setFormData({ ...formData, noPlat: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 3: Service Plan & Submit */}
                                <div className="space-y-8 flex flex-col h-full bg-zinc-50/50 p-8 border-l border-zinc-100">
                                    <div className="space-y-6">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 flex items-center gap-3">
                                            <div className="w-6 h-6 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-[10px]">4</div> Service Plan
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {KEPERLUAN.map(plan => (
                                                <button key={plan} type="button" onClick={() => setFormData({ ...formData, keperluanService: plan })}
                                                    className={`py-4 px-2 rounded-2xl border-2 font-black text-[9px] uppercase tracking-widest transition-all text-center leading-tight ${formData.keperluanService === plan ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-zinc-100 text-zinc-400 hover:border-red-200 hover:text-red-600'
                                                        }`}
                                                >
                                                    {plan}
                                                </button>
                                            ))}
                                        </div>

                                        {formData.keperluanService === 'Keluhan' && (
                                            <div className="animate-in fade-in slide-in-from-top-4">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1 mb-2 block">Detail Masalah</label>
                                                <textarea required className="w-full bg-white border border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 min-h-[120px] outline-none focus:border-red-600 transition-all shadow-inner" placeholder="Jelaskan kendala kendaraan Anda secara detail..." value={formData.keluhanDetail} onChange={e => setFormData({ ...formData, keluhanDetail: e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-8 mt-auto flex flex-col gap-4">
                                        <div className="p-4 bg-white rounded-2xl border border-zinc-100">
                                            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5">
                                                <Info size={12} className="text-blue-500" /> Information
                                            </div>
                                            <p className="text-[10px] font-bold text-zinc-600 leading-relaxed">Pastikan data yang diinput sudah sesuai dengan STNK dan keluhan customer.</p>
                                        </div>
                                        <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-zinc-200 transition-all flex items-center justify-center gap-4 active:scale-95 group">
                                            {isLoading ? 'Processing...' : (isEditing ? 'Update Booking' : 'Register Now')}
                                            <Send size={18} className="group-hover:translate-x-2 group-hover:-translate-y-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

                </>
            ) : (
                <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
                    <div className="max-w-[1400px] mx-auto bg-white rounded-[2.5rem] border border-zinc-200 shadow-2xl shadow-zinc-200/50 overflow-hidden flex flex-col lg:flex-row min-h-[700px]">
                        
                        {/* HEADER MOBILE/TABLET */}
                        <div className="lg:hidden p-6 border-b border-zinc-100 bg-zinc-50/50">
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tighter">New Manual Booking</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CRO Entry System</span>
                            </div>
                        </div>

                        {/* COLUMN 1: SELECT DATE */}
                        <div className="lg:w-[400px] shrink-0 p-8 border-r border-zinc-100 flex flex-col">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-sm">1</div>
                                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-[0.2em]">Select Date</h3>
                            </div>

                            <div className="flex-1">
                                <div className="bg-white rounded-[2rem] border-2 border-zinc-100 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <button onClick={() => changeCalMonth(-1)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all"><ChevronLeft size={18} /></button>
                                        <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest italic">
                                            {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </h4>
                                        <button onClick={() => changeCalMonth(1)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all"><ChevronRight size={18} /></button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d} className="py-2">{d}</div>)}
                                    </div>

                                    <div className="grid grid-cols-7 gap-2">
                                        {calendarGrid.map((item, idx) => {
                                            if (!item.currentMonth) return <div key={idx} className="aspect-square opacity-0"></div>;
                                            const status = getDateStatus(item.date);
                                            const isActive = formData.tanggal === item.date;
                                            const isPast = new Date(item.date) < new Date().setHours(0, 0, 0, 0);

                                            return (
                                                <button
                                                    key={idx}
                                                    disabled={isPast || status === 'closed'}
                                                    onClick={() => setFormData({ ...formData, tanggal: item.date })}
                                                    className={`aspect-square rounded-[1rem] flex items-center justify-center text-xs font-black transition-all border-2 relative group
                                                        ${isPast ? 'opacity-20 cursor-not-allowed border-transparent' : 
                                                          status === 'closed' ? 'bg-zinc-50 border-transparent text-zinc-300 cursor-not-allowed' :
                                                          isActive ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-200 scale-110 z-10' :
                                                          'bg-white border-zinc-100 hover:border-red-500 text-zinc-600'
                                                        }`}
                                                >
                                                    {item.day}
                                                    {!isPast && status !== 'closed' && (
                                                        <div className={`absolute bottom-1 w-1 h-1 rounded-full ${
                                                            status === 'empty' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-400' : 'bg-red-500'
                                                        }`} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-center gap-4 text-[8px] font-black uppercase text-zinc-400 tracking-widest">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Ready</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Partial</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> Full</div>
                            </div>
                        </div>

                        {/* COLUMN 2: SLOT & CUSTOMER */}
                        <div className="flex-1 p-8 border-r border-zinc-100 bg-zinc-50/30">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-sm">2</div>
                                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-[0.2em]">Arrival Slot</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-10">
                                {dynamicJamPilihan.map(jam => {
                                    const isBooked = bookings.some(b => b.id !== 999999 && isSameDate(b.tanggal, formData.tanggal) && String(b.jam) === jam && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed'));
                                    return (
                                        <button
                                            key={jam}
                                            disabled={isBooked}
                                            onClick={() => setFormData({ ...formData, jam })}
                                            className={`py-4 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all
                                                ${isBooked ? 'bg-zinc-100 border-transparent text-zinc-300 cursor-not-allowed opacity-50' : 
                                                  formData.jam === jam ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-200' :
                                                  'bg-white border-zinc-100 text-zinc-900 hover:border-zinc-900'
                                                }`}
                                        >
                                            {jam} WIB
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-4 mb-8 pt-4">
                                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-sm">3</div>
                                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-[0.2em]">Customer & Unit</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest pl-1">Nama Customer</label>
                                    <input 
                                        type="text" 
                                        placeholder="Input Nama"
                                        className="w-full bg-white border-2 border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-all shadow-sm"
                                        value={formData.namaCustomer}
                                        onChange={e => setFormData({ ...formData, namaCustomer: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest pl-1">WhatsApp</label>
                                    <input 
                                        type="text" 
                                        placeholder="08.."
                                        className="w-full bg-white border-2 border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-all shadow-sm"
                                        value={formData.noTelp}
                                        onChange={e => setFormData({ ...formData, noTelp: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest pl-1">Model Unit</label>
                                    <select 
                                        className="w-full bg-white border-2 border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-all shadow-sm"
                                        value={formData.tipeMobil}
                                        onChange={e => setFormData({ ...formData, tipeMobil: e.target.value })}
                                    >
                                        <option value="">- Pilih Model -</option>
                                        {TIPE_MOBIL.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest pl-1">No Polisi</label>
                                    <input 
                                        type="text" 
                                        placeholder="BK XXXX XX"
                                        className="w-full bg-white border-2 border-zinc-100 rounded-2xl p-4 text-xs font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-all shadow-sm uppercase"
                                        value={formData.noPlat}
                                        onChange={e => setFormData({ ...formData, noPlat: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: SERVICE PLAN */}
                        <div className="lg:w-[450px] shrink-0 p-8 flex flex-col">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-sm">4</div>
                                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-[0.2em]">Service Plan</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {KEPERLUAN.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setFormData({ ...formData, keperluanService: p })}
                                        className={`py-5 rounded-2xl border-2 text-[9px] font-black uppercase tracking-widest transition-all
                                            ${formData.keperluanService === p ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-200' :
                                              'bg-white border-zinc-100 text-zinc-900 hover:border-zinc-900'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>

                            {formData.keperluanService === 'Keluhan' && (
                                <div className="mb-8 animate-fade-in translate-y-0 opacity-100 transition-all">
                                    <textarea 
                                        className="w-full bg-white border-2 border-zinc-100 rounded-[2rem] p-6 text-xs font-bold text-zinc-900 min-h-[150px] outline-none focus:border-zinc-900 transition-all shadow-inner"
                                        placeholder="Jelaskan kendala secara detail..."
                                        value={formData.keluhanDetail}
                                        onChange={e => setFormData({ ...formData, keluhanDetail: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="mt-auto space-y-6">
                                <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex gap-4">
                                    <Info className="text-blue-500 shrink-0" size={20} />
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest">Information</p>
                                        <p className="text-[10px] font-bold text-blue-900/60 leading-relaxed">Pastikan data yang diinput sudah sesuai dengan STNK dan keluhan customer.</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleFormSubmit}
                                    disabled={isLoading}
                                    className="w-full bg-zinc-900 hover:bg-black text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-zinc-300 transition-all flex items-center justify-center gap-4 active:scale-95 group"
                                >
                                    {isLoading ? 'Processing...' : 'Register Now'}
                                    <Send size={20} className="group-hover:translate-x-2 group-hover:-translate-y-1 transition-transform" />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E4E4E7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #F87171;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }
            `}</style>

        </div>
    );
}
