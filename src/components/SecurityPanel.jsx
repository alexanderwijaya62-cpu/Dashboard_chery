import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, UserPlus, Check, Search, Clock, Calendar, Database, Ban, Megaphone, Key } from 'lucide-react';
import { db } from '../utils/dbClient';
import { supabase } from '../utils/supabaseClient';
import { speak } from '../utils/tts';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import ChangePasswordModal from './ChangePasswordModal';

export default function SecurityPanel({ user, handleLogout, handleChangePassword }) {
  const [tab, setTab] = useState('reguler');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [bk, setBk] = useState('');
  const [bookings, setBookings] = useState([]);
  const [confirmedPlates, setConfirmedPlates] = useState(new Map());

  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchBooking, setSearchBooking] = useState('');
  const [antrianList, setAntrianList] = useState([]);
  const [callCounter, setCallCounter] = useState(() => {
    return parseInt(localStorage.getItem('security_call_counter')) || 1;
  });
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualPlat, setManualPlat] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualTipe, setManualTipe] = useState('');
  const [manualNoTelp, setManualNoTelp] = useState('');
  const [manualKeluhan, setManualKeluhan] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [listDate, setListDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [listBookings, setListBookings] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const handleCallAntrian = async (item) => {
    const cooldownMs = 60000;
    if (item.called_at) {
      const elapsed = Date.now() - new Date(item.called_at).getTime();
      if (elapsed < cooldownMs) {
        const sisa = Math.ceil((cooldownMs - elapsed) / 1000);
        Toastify({ text: `⏳ Tunggu ${sisa} detik`, duration: 2000, background: '#f59e0b' }).showToast();
        return;
      }
    }
    try {
      const now = new Date().toISOString();
      await db.update('antrian', {
        is_called: true, counter: callCounter, called_at: now
      }, { eq: { id: item.id } });

      const code = item.category === 'Booking'
        ? `B-${String(item.queue_number || 0).padStart(3, '0')}`
        : `R-${String(item.queue_number || 0).padStart(3, '0')}`;
      const plat = (item.bk || '').toUpperCase();
      const announceText = `Antrian ${code} ${plat}, silahkan menuju counter ${callCounter}`;
      Toastify({ text: `📢 ${announceText}`, duration: 3000, background: '#10b981' }).showToast();

      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plat, title: '📢 Panggilan Antrian', body: announceText, url: '/customer' })
      }).catch(() => {});

      speak(announceText);
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal memanggil', background: '#ef4444' }).showToast();
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA');

  const fetchAntrian = useCallback(async () => {
    try {
      const { data } = await db.select('antrian', {
        select: 'bk, category, queue_number, id, status, tipe',
      });
      const bookingMap = new Map();
      (data || []).forEach(a => {
        const plat = (a.bk || '').replace(/\s+/g, '').toUpperCase();
        if (a.category === 'Booking' && plat) {
          bookingMap.set(plat, formatQueueCode('Booking', a.queue_number || 0));
        }
      });
      setConfirmedPlates(bookingMap);
      setAntrianList(data || []);
    } catch (e) {
      console.error('Gagal fetch antrian:', e);
    }
  }, []);

  const fetchBookingsByDate = useCallback(async (date) => {
    try {
      const results = await Promise.allSettled([
        (async () => {
          const { data } = await db.select('booking', {
            select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, status, noTelp, keperluanService',
          });
          return ((data || []).filter(b => b.tanggal === date)).map(b => ({ ...b, _source: 'supabase' }));
        })(),
        (async () => {
          const res = await fetch(`/api/chery_dms?endpoint=booking-data&draw=1&start=0&length=200&datefrom=${date}&dateto=${date}&_=${Date.now()}`);
          if (!res.ok) return [];
          const json = await res.json();
          if (!Array.isArray(json.data)) return [];
          return json.data
            .filter(b => {
              const s = (b.status_booking || '').toLowerCase();
              return !['batal', 'expired', 'declined', 'cancelled'].includes(s);
            })
            .map(b => {
              const sBooking = (b.status_booking || '').toLowerCase();
              if (['batal', 'expired', 'declined', 'cancelled'].includes(sBooking)) return null;
              const tanggal = (b.janji_datang || '').trim().split(' ')[0] || date;
              const jamRaw = (b.janji_datang || '').trim().split(' ')[1] || '';
              const jam = jamRaw ? jamRaw.slice(0, 5).replace(':', '.') : '';
              const parts = tanggal.split('/');
              const tgl = parts.length === 3 && parts[2].length === 4 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : tanggal;
              return {
                id: `dms_${b.no_booking || b.id || Math.random()}`,
                tanggal: tgl,
                jam,
                noPlat: b.no_polisi || '',
                namaCustomer: b.nama_pelanggan || '',
                tipeMobil: b.nama_kendaraan || '',
                status: 'accepted',
                noTelp: b.no_telp_booking || '',
                keperluanService: b.keperluan || b.keterangan || '',
                _source: 'dms',
                bookingVia: b.booking_via || 'DMS Internal',
              };
            });
        })(),
      ]);

      let merged = [];
      const seenPlates = new Set();

      results.forEach(r => {
        if (r.status !== 'fulfilled' || !r.value) return;
        if (Array.isArray(r.value)) {
          r.value.forEach(b => {
            const plat = (b.noPlat || '').replace(/\s+/g, '').toUpperCase();
            if (!plat) return;
            if (seenPlates.has(plat)) return;
            seenPlates.add(plat);
            if (b.tanggal === date) merged.push(b);
          });
        }
      });

      return merged;
    } catch (e) {
      console.error('Gagal fetch data:', e);
      return [];
    }
  }, []);

  const fetchData = useCallback(async () => {
    const [merged] = await Promise.all([fetchBookingsByDate(bookingDate), fetchAntrian()]);
    setBookings(merged);
  }, [bookingDate, fetchBookingsByDate, fetchAntrian]);

  useEffect(() => {
    fetchData();
    const channel = supabase?.channel('security-bookings')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, fetchData)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' }, fetchData)
      ?.subscribe();
    return () => { channel?.unsubscribe(); };
  }, [fetchData, bookingDate]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!searchBooking.trim()) return true;
      const q = searchBooking.toLowerCase();
      return (b.noPlat || '').toLowerCase().includes(q) ||
             (b.namaCustomer || '').toLowerCase().includes(q) ||
             (b.jam || '').includes(q);
    });
  }, [bookings, searchBooking]);

  const fetchListBookings = useCallback(async (date) => {
    setListLoading(true);
    try {
      const merged = await fetchBookingsByDate(date);
      setListBookings(merged);
    } catch (e) {
      console.error('Gagal fetch list booking:', e);
    } finally {
      setListLoading(false);
    }
  }, [fetchBookingsByDate]);

  useEffect(() => {
    if (tab === 'daftar') fetchListBookings(listDate);
  }, [tab, listDate, fetchListBookings]);

  const filteredListBookings = useMemo(() => {
    return listBookings.filter(b => {
      if (!listSearch.trim()) return true;
      const q = listSearch.toLowerCase();
      return (b.noPlat || '').toLowerCase().includes(q) ||
             (b.namaCustomer || '').toLowerCase().includes(q) ||
             (b.jam || '').includes(q) ||
             (b.tipeMobil || '').toLowerCase().includes(q);
    });
  }, [listBookings, listSearch]);

  const isLate = (jam) => {
    if (!jam) return false;
    const now = new Date();
    const clean = String(jam).replace('.', ':');
    const [h, m] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return false;
    const bookingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    return now > bookingTime;
  };

  const toggleBooking = (id) => {
    setSelectedBookingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRegulerStartNumber = async () => {
    const { data } = await db.select('settings', { eq: { key: 'reguler_start_number' }, maybeSingle: true });
    return data?.value ? parseInt(data.value) : 6;
  };

  const generateQueueNumber = async (category) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const { data: activeItems } = await db.select('antrian', {
      select: 'queue_number',
      eq: { category },
      gte: { id: startOfTodayMs }
    });

    const { data: historyItems } = await db.select('history', {
      select: 'id',
      eq: { category },
      gte: { id: startOfTodayMs }
    });

    const activeCount = activeItems ? activeItems.length : 0;
    const historyCount = historyItems ? historyItems.length : 0;

    let maxActiveNum = 0;
    if (activeItems && activeItems.length > 0) {
      maxActiveNum = Math.max(...activeItems.map(item => item.queue_number || 0));
    }

    let num = Math.max(maxActiveNum + 1, activeCount + historyCount + 1);

    // Reguler starts from configured start number, after Booking numbers
    if (category === 'Reguler') {
      const { data: bookingActive } = await db.select('antrian', {
        select: 'queue_number',
        eq: { category: 'Booking' },
        gte: { id: startOfTodayMs }
      });
      let maxBooking = 0;
      if (bookingActive && bookingActive.length > 0) {
        maxBooking = Math.max(...bookingActive.map(item => item.queue_number || 0));
      }
      const regulerStart = await getRegulerStartNumber();
      num = Math.max(num, maxBooking + 1, regulerStart);
    }

    return num;
  };

  const formatQueueCode = (category, num) => {
    const prefix = category === 'Booking' ? 'B' : 'R';
    return `${prefix}-${String(num).padStart(3, '0')}`;
  };

  const handleRegulerSubmit = async () => {
    const plat = bk.trim().toUpperCase().replace(/\s+/g, '');
    if (!plat) { alert('Masukkan No. Plat!'); return; }

    // Cek langsung ke DB — jangan andalkan state lokal yg mungkin stale
    const { data: dupe } = await db.select('antrian', { select: 'id', eq: { bk: plat } });
    if (dupe && dupe.length > 0) {
      Toastify({ text: `⛔ ${plat} sudah ada di antrian!`, duration: 2500, background: '#ef4444' }).showToast();
      return;
    }

    setIsLoading(true);
    try {
      const qNum = await generateQueueNumber('Reguler');
      const { error } = await db.insert('antrian', {
        id: Date.now() + Math.floor(Math.random() * 1000),
          bk: plat,
          tipe: '',
          category: 'Reguler',
          status: 'menunggu_sa',
        estimasiDefault: 1800,
        addedBy: user?.name || 'Security',
        nama_sa: user?.nama_sa || user?.name || 'Security',
        is_called: false,
        counter: 0,
        queue_number: qNum,
      });
      if (error) throw error;
      const code = formatQueueCode('Reguler', qNum);
      Toastify({ text: `✅ ${plat} — ${code}`, duration: 2500, background: '#10b981' }).showToast();
      setBk('');
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal ambil antrian', background: '#ef4444' }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingSubmit = async () => {
    if (selectedBookingIds.size === 0) { alert('Pilih booking yang sudah datang!'); return; }

    // Kumpulkan plat yg dipilih
    const candidates = [];
    for (const bookingId of selectedBookingIds) {
      const b = bookings.find(x => x.id === bookingId);
      if (!b) continue;
      const plat = (b.noPlat || '').toUpperCase().replace(/\s+/g, '');
      candidates.push({ plat, booking: b });
    }

    // Batch cek duplikat langsung ke DB
    const plateList = candidates.map(c => c.plat);
    const { data: existing } = await db.select('antrian', { select: 'bk', in: { bk: plateList } });
    const existingPlates = new Set((existing || []).map(e => (e.bk || '').replace(/\s+/g, '').toUpperCase()));

    const toInsert = [];
    for (const { plat, booking: b } of candidates) {
      if (existingPlates.has(plat)) {
        Toastify({ text: `⛔ ${plat} sudah diantrikan!`, duration: 2000, background: '#f59e0b' }).showToast();
        continue;
      }
      toInsert.push({ ...b, plat });
    }

    if (toInsert.length === 0) {
      setSelectedBookingIds(new Set());
      return;
    }

    setIsLoading(true);
    let success = 0;
    try {
      for (const b of toInsert) {
        const telat = isLate(b.jam);
        const cat = telat ? 'Reguler' : 'Booking';
        const qNum = await generateQueueNumber(cat);
        const { error } = await db.insert('antrian', {
          id: Date.now() + Math.floor(Math.random() * 10000) + success,
          bk: b.plat,
          tipe: b.tipeMobil || '',
          category: cat,
          status: 'menunggu_sa',
          estimasiDefault: 1800,
          addedBy: b.namaCustomer || user?.name || 'Security',
          nama_sa: b.nama_sa || b.addedBy || user?.name || 'Security',
          keluhan: b.keperluanService || '',
          is_called: false,
          counter: 0,
          queue_number: qNum,
        });
        if (!error) {
          success++;
          const code = formatQueueCode(cat, qNum);
          const msgExtra = telat ? ' (Telat -> Masuk Reguler)' : '';
          Toastify({ text: `✅ ${b.plat} — ${code}${msgExtra}`, duration: 2500, background: '#10b981' }).showToast();
        }
      }
      if (success > 0) {
        setSelectedBookingIds(new Set());
        await fetchData();
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal konfirmasi booking', background: '#ef4444' }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualBookingSubmit = async () => {
    const plat = manualPlat.trim().toUpperCase().replace(/\s+/g, '');
    if (!plat) { alert('Masukkan No. Plat!'); return; }

    const { data: dupe } = await db.select('antrian', { select: 'id', eq: { bk: plat } });
    if (dupe && dupe.length > 0) {
      Toastify({ text: `⛔ ${plat} sudah ada di antrian!`, duration: 2500, background: '#ef4444' }).showToast();
      return;
    }

    setIsLoading(true);
    try {
      const qNum = await generateQueueNumber('Booking');
      const { error } = await db.insert('antrian', {
          id: Date.now() + Math.floor(Math.random() * 10000),
          bk: plat,
          tipe: manualTipe.trim(),
          category: 'Booking',
          status: 'menunggu_sa',
          estimasiDefault: 1800,
          addedBy: manualNama.trim() || user?.name || 'Security',
          nama_sa: user?.name || 'Security',
          noTelp: manualNoTelp.trim(),
          keluhan: manualKeluhan.trim(),
          is_called: false,
          counter: 0,
          queue_number: qNum,
        });
      if (error) throw error;
      const code = formatQueueCode('Booking', qNum);
      Toastify({ text: `✅ ${plat} — ${code}`, duration: 2500, background: '#10b981' }).showToast();
      setManualPlat(''); setManualNama(''); setManualTipe(''); setManualNoTelp(''); setManualKeluhan('');
      setShowManualBooking(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal tambah booking manual', background: '#ef4444' }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <div className="bg-white border-b-2 border-zinc-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-xl text-white">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-black uppercase tracking-tight leading-none">Security</h1>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{user?.name}</p>
          </div>
        </div>
        <button onClick={() => setShowPasswordModal(true)}
          className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-all active:scale-95"
          title="Ganti Password">
          <Key size={16} />
        </button>
        <button onClick={handleLogout}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
          Logout
        </button>
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />

      <div className="flex mx-4 mt-4 bg-white rounded-2xl border-2 border-zinc-200 overflow-hidden">
        <button onClick={() => setTab('reguler')}
          className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${tab === 'reguler' ? 'bg-black text-white' : 'text-zinc-500'}`}>
          Reguler
        </button>
        <button onClick={() => { setTab('booking'); fetchData(); }}
          className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${tab === 'booking' ? 'bg-black text-white' : 'text-zinc-500'}`}>
          Booking
        </button>
        <button onClick={() => setTab('daftar')}
          className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${tab === 'daftar' ? 'bg-black text-white' : 'text-zinc-500'}`}>
          Daftar Booking
        </button>
      </div>

      <div className="flex-1 px-4 pb-20 mt-4">
        {tab === 'reguler' ? (
          <div className="bg-white border-2 border-zinc-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-4">Input Antrian Reguler</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-1 block">No. Plat (BK)</label>
                <input value={bk} onChange={e => setBk(e.target.value)}
                  placeholder="BK 1234 ABC"
                  className="w-full px-4 py-3.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all uppercase"
                  autoFocus />
              </div>
              <button onClick={handleRegulerSubmit} disabled={isLoading || !bk.trim()}
                className="w-full py-4 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                {isLoading ? 'Memproses...' : 'Ambil Antrian Reguler'}
              </button>
            </div>
          </div>
        ) : tab === 'booking' ? (
          <div className="space-y-3">
            <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Daftar Booking</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowManualBooking(prev => !prev)}
                    className="text-sm font-black uppercase tracking-widest px-2 py-1 rounded-lg border-2 transition-all active:scale-95"
                    style={{ borderColor: showManualBooking ? '#000' : '#e4e4e7', color: showManualBooking ? '#fff' : '#a1a1aa', background: showManualBooking ? '#000' : 'transparent' }}>
                    Isi Manual
                  </button>
                  <span className="text-xs font-bold text-zinc-400">{filteredBookings.length} total</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-black transition-all" />
                </div>
              </div>

              {showManualBooking && (
                <div className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-4 mb-4 space-y-3">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Input Booking Manual</h3>
                  <input value={manualPlat} onChange={e => setManualPlat(e.target.value)}
                    placeholder="No. Plat"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all uppercase" />
                  <input value={manualNama} onChange={e => setManualNama(e.target.value)}
                    placeholder="Nama Customer (opsional)"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
                  <input value={manualTipe} onChange={e => setManualTipe(e.target.value)}
                    placeholder="Tipe Mobil (opsional)"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
                  <input value={manualNoTelp} onChange={e => setManualNoTelp(e.target.value)}
                    placeholder="No. Telp (opsional)"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
                  <textarea value={manualKeluhan} onChange={e => setManualKeluhan(e.target.value)}
                    placeholder="Keluhan / Keperluan Service (opsional)"
                    rows="2"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all resize-none" />
                  <button onClick={handleManualBookingSubmit} disabled={isLoading || !manualPlat.trim()}
                    className="w-full py-3 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    {isLoading ? 'Memproses...' : 'Tambah Antrian Booking'}
                  </button>
                </div>
              )}

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={searchBooking} onChange={e => setSearchBooking(e.target.value)}
                  placeholder="Cari nama/plat..."
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
              </div>
              {filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={28} className="text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">Tidak ada booking di tanggal ini</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredBookings.map(b => {
                    const plat = (b.noPlat || '').replace(/\s+/g, '').toUpperCase();
                    const queueCode = confirmedPlates.get(plat);
                    const sudahAntri = !!queueCode;
                    const telat = isLate(b.jam);
                    const isSelected = selectedBookingIds.has(b.id);
                    const fromDms = b._source === 'dms';
                    return (
                      <button key={b.id} onClick={() => { if (!sudahAntri) toggleBooking(b.id); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] text-left ${sudahAntri ? 'bg-zinc-100 border-zinc-200 opacity-60 cursor-default' : isSelected ? 'bg-black text-white border-black' : 'bg-zinc-50 text-zinc-700 border-zinc-100 hover:border-zinc-300'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sudahAntri ? 'bg-zinc-300' : isSelected ? 'bg-white/20' : 'bg-zinc-200'}`}>
                          {sudahAntri ? <Check size={14} className="text-zinc-500" /> : isSelected ? <Check size={14} className="text-white" /> : <Clock size={14} className="text-zinc-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-sm leading-tight ${sudahAntri ? 'text-zinc-400' : isSelected ? 'text-white' : 'text-black'}`}>{b.noPlat || '-'}</span>
                            {b.jam ? <span className={`text-[11px] font-bold ${sudahAntri ? 'text-zinc-300' : isSelected ? 'text-white/60' : 'text-zinc-400'}`}>{b.jam}</span> : null}
                            {fromDms && <Database size={10} className={sudahAntri ? 'text-zinc-300' : isSelected ? 'text-white/60' : 'text-zinc-400'} />}
                            {telat && !sudahAntri && <span className="text-sm font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded tracking-widest uppercase">Telat</span>}
                            {telat && sudahAntri && <span className="text-sm font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded tracking-widest uppercase">Telat</span>}
                          </div>
                          <p className={`text-[11px] font-bold truncate ${sudahAntri ? 'text-zinc-400' : isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{b.namaCustomer || 'Tanpa nama'}</p>
                        </div>
                        {sudahAntri ? (
                          <span className="text-sm font-black text-zinc-400 uppercase tracking-widest shrink-0">{queueCode}</span>
                        ) : (
                          <div className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-zinc-300'}`}>
                            {isSelected && <Check size={12} className="text-black" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedBookingIds.size > 0 && (
              <button onClick={handleBookingSubmit} disabled={isLoading}
                className="w-full py-4 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {isLoading ? 'Memproses...' : `Konfirmasi Hadir (${selectedBookingIds.size})`}
              </button>
            )}
          </div>
        ) : tab === 'daftar' ? (
          <div className="space-y-3">
            <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Daftar Booking</h2>
                <span className="text-xs font-bold text-zinc-400">{filteredListBookings.length} total</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input type="date" value={listDate} onChange={e => setListDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-black transition-all" />
                </div>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="Cari nama/plat/tipe..."
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
              </div>

              {listLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-zinc-300 border-t-black rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">Memuat data...</p>
                </div>
              ) : filteredListBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={28} className="text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">Tidak ada booking di tanggal ini</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                  {filteredListBookings.map((b, idx) => {
                    const fromDms = b._source === 'dms';
                    return (
                      <div key={b.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-zinc-100 bg-zinc-50">
                        <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center shrink-0">
                          <span className="text-sm font-black text-zinc-500">{idx + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm leading-tight text-black">{b.noPlat || '-'}</span>
                            {b.jam ? <span className="text-[11px] font-bold text-zinc-400">{b.jam}</span> : null}
                            {fromDms && <Database size={10} className="text-zinc-400" />}
                          </div>
                          <p className="text-[11px] font-bold text-zinc-500 truncate">{b.namaCustomer || 'Tanpa nama'}</p>
                          {b.tipeMobil ? <p className="text-sm font-bold text-zinc-400 truncate">{b.tipeMobil}</p> : null}
                        </div>
                        {b.keperluanService ? (
                          <span className="text-sm font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-lg shrink-0 max-w-[100px] truncate">{b.keperluanService}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Antrian Status List */}
        <div className="mt-4 bg-white border-2 border-zinc-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              Status Antrian ({antrianList.length})
            </h3>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Counter</span>
              <input type="number" min="1" max="20" value={callCounter}
                onChange={e => { const v = parseInt(e.target.value) || 1; setCallCounter(v); localStorage.setItem('security_call_counter', String(v)); }}
                className="w-10 h-6 text-center text-xs font-black bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-black" />
            </div>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {antrianList.length === 0 ? (
              <p className="text-sm font-bold text-zinc-300 text-center py-4">Belum ada antrian hari ini</p>
            ) : (
              antrianList.map(a => {
                const code = a.category === 'Booking'
                  ? `B-${String(a.queue_number || 0).padStart(3, '0')}`
                  : `R-${String(a.queue_number || 0).padStart(3, '0')}`;
                const statusLabels = {
                  'menunggu_sa': 'Menunggu SA',
                  'waiting': 'Menunggu Mekanik',
                  'working': 'Dikerjakan',
                  'menunggu_foreman': 'Forward ke Foreman',
                  'menunggu_konfirmasi': 'Menunggu Konfirmasi',
                  'completed': 'Selesai'
                };
                return (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-black text-zinc-900 shrink-0">{code}</span>
                      <span className="text-sm font-bold text-zinc-700 truncate">{(a.bk || '').toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {a.status === 'menunggu_sa' && (
                        <button onClick={() => handleCallAntrian(a)}
                          className="flex items-center gap-1 px-2 py-1 bg-black hover:bg-zinc-700 text-white rounded-lg transition-all active:scale-95">
                          <Megaphone size={10} />
                          <span className="text-sm font-black uppercase tracking-wider">Panggil</span>
                        </button>
                      )}
                      <span className={"text-[11px] font-bold uppercase tracking-wider shrink-0 " + (a.status === 'menunggu_sa' ? 'text-zinc-400' : 'text-zinc-500')}>
                        {statusLabels[a.status] || a.status || '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
