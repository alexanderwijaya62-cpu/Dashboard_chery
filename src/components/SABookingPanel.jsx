import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info, Search, Send, Plus, ShieldCheck, Truck, X, Edit3 } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots, getSlotsForDate, getCapacityForDate } from '../utils/bookingConfig';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';
import { normalizeDmsBooking } from '../utils/dateHelpers';
import BookingCalendar from './BookingCalendar';

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

export default function SABookingPanel() {
  const [step, setStep] = useState('search');

  const [plateSearch, setPlateSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundVehicle, setFoundVehicle] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [isManual, setIsManual] = useState(false);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jam: '',
    atasNama: '',
    noTelp: '',
    keluhan: '',
    noPolisi: '',
    modelKendaraan: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentCalMonth, setCurrentCalMonth] = useState(new Date());
  const [slotConfig, setSlotConfig] = useState({ count: 4, gap: 30, startH: 8, startM: 30, capacity: 1, saturdayEnabled: true, satSlotCount: 4, satGap: 30, satStartH: 8, satStartM: 0, satCapacity: 1 });
  const [bookings, setBookings] = useState([]);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => { fetchHolidays().then(setHolidays); }, []);

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
      if (b.status !== 'waiting confirm' && b.status !== 'accepted' && b.status !== 'completed') return;
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

  useEffect(() => {
    (async () => {
      const config = await fetchBookingConfig();
      setSlotConfig({
        count: config.slotCount,
        gap: config.gapMinutes,
        startH: config.startHour,
        startM: config.startMinute,
        capacity: config.slotCapacity,
        saturdayEnabled: config.saturdayEnabled,
        satSlotCount: config.satSlotCount,
        satGap: config.satGapMinutes,
        satStartH: config.satStartHour,
        satStartM: config.satStartMinute,
        satCapacity: config.satSlotCapacity,
      });
    })();
  }, []);

  const fetchBookings = useCallback(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const { data } = await db.select('booking', { select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, status, bookingVia', gte: { tanggal: dateStr } });
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
  }, []);

  useEffect(() => {
    fetchBookings();
    const channel = supabase
      .channel('sa-booking-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'booking' },
        () => fetchBookings()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings]);

  const JAM_PILIHAN = useMemo(() => getSlotsForDate(formData.tanggal, slotConfig), [formData.tanggal, slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM, slotConfig.saturdayEnabled, slotConfig.satSlotCount, slotConfig.satGap, slotConfig.satStartH, slotConfig.satStartM]);

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
          bookingVia: 'SA Booking (Manual)',
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
        bookingVia: 'SA Booking',
      });
      if (insertErr) throw insertErr;

      const bookingId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

      // === Sync ke DMS sebagai bonus ===
      let dmsSynced = false;
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
          booking_via: 'SA Booking Panel',
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
          bookingVia: 'SA Booking (DMS Synced)'
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
    } catch (err) {
      Toastify({ text: `ERROR: ${err.message}`, background: "red", duration: 5000 }).showToast();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPastDate = (dateStr) => {
    return new Date(dateStr) < new Date().setHours(0, 0, 0, 0);
  };

  const isSunday = (dateStr) => new Date(dateStr).getDay() === 0;

  return (
    <div className="flex-1 w-full max-w-[100vw] bg-white relative overflow-hidden flex flex-col h-full animate-fade-in transition-colors duration-500 p-0">
      <div className="flex justify-between items-center px-4 md:px-6 py-3 shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-lg text-white">
            <Calendar size={20} />
          </div>
          <h2 className="text-lg md:text-xl font-black text-zinc-900 leading-none">SA Booking</h2>
        </div>
        <button
          onClick={() => { resetModal(); }}
          className="min-h-[44px] bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-zinc-200 group"
        >
          <Plus size={14} className="group-hover:rotate-90 transition-transform" /> New Booking
        </button>
      </div>

      {step === 'search' ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full px-4">
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
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-10 flex-1 flex flex-col overflow-hidden">
            <div className="mb-6 flex items-center gap-4 border-b border-zinc-100 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-green-500 text-white">1</div>
                <span className="text-xs font-black uppercase tracking-widest text-green-600">Cari Kendaraan</span>
              </div>
              <div className="h-px flex-1 bg-zinc-200 max-w-[60px]"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-black text-white">2</div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-900">Detail Booking</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 flex-1 min-h-0 h-full overflow-hidden">
              <div className="space-y-4 flex flex-col h-full lg:border-r border-zinc-100 lg:pr-6 overflow-y-auto min-h-0">
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
                  />
                </div>
              </div>

              <div className="space-y-6 flex flex-col h-full lg:border-r border-zinc-100 lg:pr-6 overflow-y-auto min-h-0">
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

                <form id="saBookingForm" onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Atas Nama Booking</h4>
                    <input required type="text" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[40px]" placeholder="Nama booking" value={formData.atasNama} onChange={e => setFormData({ ...formData, atasNama: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">No Telp Booking</h4>
                    <input type="tel" className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[40px]" placeholder="08..." value={formData.noTelp} onChange={e => setFormData({ ...formData, noTelp: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Keluhan</h4>
                    <textarea className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-3 text-xs font-bold text-zinc-900 focus:bg-white focus:border-black outline-none transition-all min-h-[80px]" placeholder="Deskripsi keluhan (opsional)" value={formData.keluhan} onChange={e => setFormData({ ...formData, keluhan: e.target.value })} />
                  </div>
                </form>
              </div>

              <div className="space-y-6 flex flex-col h-full bg-zinc-50/50 p-4 md:p-6 lg:border-l border-zinc-100 overflow-y-auto min-h-0">
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
                  <button type="submit" form="saBookingForm" disabled={isSubmitting}
                    className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-zinc-200 transition-all flex items-center justify-center gap-4 active:scale-95 group disabled:opacity-40"
                  >
                    {isSubmitting ? 'Processing...' : 'Konfirmasi Booking'}
                    <Send size={16} className="group-hover:translate-x-2 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
