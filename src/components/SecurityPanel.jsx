import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, UserPlus, Check, Search, Clock, Calendar, Database, Ban } from 'lucide-react';
import { db } from '../utils/dbClient';
import { supabase } from '../utils/supabaseClient';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

export default function SecurityPanel({ user, handleLogout }) {
  const [tab, setTab] = useState('reguler');
  const [bk, setBk] = useState('');
  const [bookings, setBookings] = useState([]);
  const [confirmedPlates, setConfirmedPlates] = useState(new Map());
  const [allAntrianPlates, setAllAntrianPlates] = useState(new Set());
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchBooking, setSearchBooking] = useState('');
  const [antrianList, setAntrianList] = useState([]);

  const todayStr = new Date().toLocaleDateString('en-CA');

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        (async () => {
          const { data } = await db.select('booking', {
            select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, status, noTelp',
          });
          return ((data || []).filter(b => b.tanggal === todayStr)).map(b => ({ ...b, _source: 'supabase' }));
        })(),
        (async () => {
          const res = await fetch(`/api/chery_dms?endpoint=booking-data&draw=1&start=0&length=200&datefrom=${todayStr}&dateto=${todayStr}&_=${Date.now()}`);
          if (!res.ok) return [];
          const json = await res.json();
          if (!Array.isArray(json.data)) return [];
          return json.data
            .filter(b => {
              const s = (b.status_booking || '').toLowerCase();
              return !['batal', 'expired', 'declined', 'cancelled'].includes(s);
            })
            .map(b => {
              const janji = b.janji_datang || '';
              const parts = janji.split(' ');
              const tgl = parts[0] || todayStr;
              const jamRaw = parts[1] || '';
              const jam = jamRaw ? jamRaw.slice(0, 5) : '';
              return {
                id: `dms_${b.no_booking || b.id || Math.random()}`,
                tanggal: tgl,
                jam,
                noPlat: b.no_polisi || '',
                namaCustomer: b.nama_pelanggan || '',
                tipeMobil: b.nama_kendaraan || '',
                status: 'accepted',
                noTelp: b.no_telp_booking || '',
                _source: 'dms',
                bookingVia: b.booking_via || 'DMS Internal',
              };
            });
        })(),
        (async () => {
          const { data } = await db.select('antrian', {
            select: 'bk, category, queue_number, id, status, tipe',
          });
          const bookingMap = new Map();
          const allPlates = new Set();
          (data || []).forEach(a => {
            const plat = (a.bk || '').replace(/\s+/g, '').toUpperCase();
            if (plat) allPlates.add(plat);
            if (a.category === 'Booking' && plat) {
              bookingMap.set(plat, formatQueueCode('Booking', a.queue_number || 0));
            }
          });
          setConfirmedPlates(bookingMap);
          setAllAntrianPlates(allPlates);
          setAntrianList(data || []);
          return null;
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
            if (b.tanggal === todayStr) merged.push(b);
          });
        }
      });

      setBookings(merged);
    } catch (e) {
      console.error('Gagal fetch data:', e);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchData();
    const channel = supabase?.channel('security-bookings')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, fetchData)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' }, fetchData)
      ?.subscribe();
    return () => { channel?.unsubscribe(); };
  }, [fetchData]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!searchBooking.trim()) return true;
      const q = searchBooking.toLowerCase();
      return (b.noPlat || '').toLowerCase().includes(q) ||
             (b.namaCustomer || '').toLowerCase().includes(q) ||
             (b.jam || '').includes(q);
    });
  }, [bookings, searchBooking]);

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

    if (allAntrianPlates.has(plat)) {
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
        is_called: false,
        counter: 0,
        queue_number: qNum,
      });
      if (error) throw error;
      const code = formatQueueCode('Reguler', qNum);
      Toastify({ text: `✅ ${plat} — ${code}`, duration: 2500, background: '#10b981' }).showToast();
      setBk('');
      setAllAntrianPlates(prev => new Set(prev).add(plat));
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal ambil antrian', background: '#ef4444' }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingSubmit = async () => {
    if (selectedBookingIds.size === 0) { alert('Pilih booking yang sudah datang!'); return; }

    const toInsert = [];
    for (const bookingId of selectedBookingIds) {
      const b = bookings.find(x => x.id === bookingId);
      if (!b) continue;
      const plat = (b.noPlat || '').toUpperCase().replace(/\s+/g, '');
      if (allAntrianPlates.has(plat)) {
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
      let baseQ = await generateQueueNumber('Booking');
      for (const b of toInsert) {
        const qNum = baseQ + success;
        const { error } = await db.insert('antrian', {
          id: Date.now() + Math.floor(Math.random() * 10000) + success,
          bk: b.plat,
          tipe: b.tipeMobil || '',
          category: 'Booking',
          status: 'menunggu_sa',
          estimasiDefault: 1800,
          addedBy: user?.name || 'Security',
          is_called: false,
          counter: 0,
          queue_number: qNum,
        });
        if (!error) {
          success++;
          const code = formatQueueCode('Booking', qNum);
          Toastify({ text: `✅ ${b.plat} — ${code}`, duration: 2500, background: '#10b981' }).showToast();
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

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <div className="bg-white border-b-2 border-zinc-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-xl text-white">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-black uppercase tracking-tight leading-none">Security</h1>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{user?.name}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all active:scale-95">
          Logout
        </button>
      </div>

      <div className="flex mx-4 mt-4 bg-white rounded-2xl border-2 border-zinc-200 overflow-hidden">
        <button onClick={() => setTab('reguler')}
          className={`flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest transition-all ${tab === 'reguler' ? 'bg-black text-white' : 'text-zinc-500'}`}>
          Reguler
        </button>
        <button onClick={() => { setTab('booking'); fetchData(); }}
          className={`flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest transition-all ${tab === 'booking' ? 'bg-black text-white' : 'text-zinc-500'}`}>
          Booking
        </button>
      </div>

      <div className="flex-1 px-4 pb-20 mt-4">
        {tab === 'reguler' ? (
          <div className="bg-white border-2 border-zinc-200 rounded-2xl p-5">
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Input Antrian Reguler</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1 block">No. Plat (BK)</label>
                <input value={bk} onChange={e => setBk(e.target.value)}
                  placeholder="BK 1234 ABC"
                  className="w-full px-4 py-3.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all uppercase"
                  autoFocus />
              </div>
              <button onClick={handleRegulerSubmit} disabled={isLoading || !bk.trim()}
                className="w-full py-4 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                {isLoading ? 'Memproses...' : 'Ambil Antrian Reguler'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Booking Hari Ini</h2>
                <span className="text-[9px] font-bold text-zinc-400">{filteredBookings.length} total</span>
              </div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={searchBooking} onChange={e => setSearchBooking(e.target.value)}
                  placeholder="Cari nama/plat..."
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
              </div>
              {filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={28} className="text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">Tidak ada booking hari ini</p>
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
                            {b.jam ? <span className={`text-[8px] font-bold ${sudahAntri ? 'text-zinc-300' : isSelected ? 'text-white/60' : 'text-zinc-400'}`}>{b.jam}</span> : null}
                            {fromDms && <Database size={10} className={sudahAntri ? 'text-zinc-300' : isSelected ? 'text-white/60' : 'text-zinc-400'} />}
                            {telat && !sudahAntri && <span className="text-[7px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded tracking-widest uppercase">Telat</span>}
                            {telat && sudahAntri && <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded tracking-widest uppercase">Telat</span>}
                          </div>
                          <p className={`text-[8px] font-bold truncate ${sudahAntri ? 'text-zinc-400' : isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{b.namaCustomer || 'Tanpa nama'}</p>
                        </div>
                        {sudahAntri ? (
                          <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest shrink-0">{queueCode}</span>
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
                className="w-full py-4 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {isLoading ? 'Memproses...' : `Konfirmasi Hadir (${selectedBookingIds.size})`}
              </button>
            )}
          </div>
        )}

        {/* Antrian Status List */}
        <div className="mt-4 bg-white border-2 border-zinc-200 rounded-2xl p-4">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
            Status Antrian ({antrianList.length})
          </h3>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {antrianList.length === 0 ? (
              <p className="text-[10px] font-bold text-zinc-300 text-center py-4">Belum ada antrian hari ini</p>
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
                      <span className="text-[10px] font-black text-zinc-900 shrink-0">{code}</span>
                      <span className="text-[10px] font-bold text-zinc-700 truncate">{(a.bk || '').toUpperCase()}</span>
                    </div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 ml-2">{statusLabels[a.status] || a.status || '-'}</span>
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
