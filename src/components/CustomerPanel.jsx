import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Car, User, FileText,
  ShieldCheck, ShieldAlert,
  Wrench, MessageCircle,
  Clock, Megaphone, ChevronDown, ChevronUp,
  LogOut, Calendar, RefreshCw, ChevronLeft, ChevronRight, Key
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import Toastify from 'toastify-js';
import { db } from '../utils/dbClient';
import { speak } from '../utils/tts';
import { supabase } from '../utils/supabaseClient';
import { pushSubscribe, pushUnsubscribe } from '../utils/pushClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import { getTodayStr } from '../utils/bookingHelpers';

const HISTORY_CACHE_KEY = 'chery_history_cache';
const HISTORY_CACHE_DURATION = 5 * 60 * 1000;

const getCachedHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp, vin } = JSON.parse(raw);
    if (!data || !timestamp || Date.now() - timestamp > HISTORY_CACHE_DURATION) {
      localStorage.removeItem(HISTORY_CACHE_KEY);
      return null;
    }
    return { data, vin };
  } catch {
    return null;
  }
};

const setCachedHistory = (vin, data) => {
  try {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ data, vin, timestamp: Date.now() }));
  } catch {
  }
};

const CustomerPanel = ({ user, handleLogout, handleChangePassword, setCurrentPage }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedParts, setExpandedParts] = useState({});

  const [myQueue, setMyQueue] = useState(null);
  const [calledItem, setCalledItem] = useState(null);
  const [dismissedNotif, setDismissedNotif] = useState(false);
  const [nowServing, setNowServing] = useState(null);
  const [queueAhead, setQueueAhead] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(() =>
    JSON.parse(localStorage.getItem('chery_voice_enabled') || 'true')
  );

  const [completedInfo, setCompletedInfo] = useState(null);
  const lastQueueRef = useRef(null);
  const completedShownRef = useRef(false);
  const vinAbortRef = useRef(null);

  // Reschedule state
  const [activeBookings, setActiveBookings] = useState([]);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleAllBookings, setRescheduleAllBookings] = useState([]);
  const [rescheduleConfig, setRescheduleConfig] = useState({ slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1 });
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleMonth, setRescheduleMonth] = useState(new Date());

  const formatQueueLabel = (queueNumber, category) => {
    if (!queueNumber || queueNumber === 0) return '';
    return category === 'Booking' ? `Booking ${queueNumber}` : `Reguler ${queueNumber}`;
  };
  const lastCallAtRef = useRef({});
  const confirmedCallsRef = useRef(new Set(
    JSON.parse(sessionStorage.getItem('confirmed_calls') || '[]')
  ));

  const toggleParts = useCallback((id) => {
    setExpandedParts(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const confirmCall = useCallback((callId) => {
    if (!callId) return;
    confirmedCallsRef.current.add(callId);
    sessionStorage.setItem('confirmed_calls', JSON.stringify([...confirmedCallsRef.current]));
    setCalledItem(null);
    setDismissedNotif(true);
  }, []);

  useEffect(() => {
    if (!user.plat_bk) return;

    const fetchQueueInfo = async (queueNumber) => {
      try {
        const { data: working } = await db.select('antrian', {
          select: 'queue_number, bk, counter',
          in: { status: ['working', 'istirahat', 'menginap', 'menunggu_konfirmasi'] },
          order: { column: 'queue_number', ascending: true },
          limit: 1
        });
        if (working && working.length > 0) {
          setNowServing({ queueNumber: working[0].queue_number, bk: working[0].bk, counter: working[0].counter, category: working[0].category });
        } else {
          setNowServing(null);
        }

        if (queueNumber > 0) {
          const { count } = await db.select('antrian', {
            select: 'id',
            head: true,
            eq: { status: 'waiting' },
            lt: { queue_number: queueNumber }
          });
          setQueueAhead(count || 0);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchMyQueue = async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayId = todayStart.getTime();
        const { data, error } = await db.select('antrian', {
          select: '*',
          eq: { bk: user.plat_bk.toUpperCase().replace(/\s+/g, '') },
          in: { status: ['waiting', 'working', 'istirahat', 'menginap', 'menunggu_konfirmasi'] },
          gte: { id: todayId },
          order: { column: 'id', ascending: false },
          limit: 1
        });
        if (error) throw error;
        if (data && data.length > 0) {
          const item = data[0];
          const queueNum = item.queue_number || 0;
          const counter = item.counter || 0;
          setCompletedInfo(null);
          completedShownRef.current = false;
          lastQueueRef.current = {
            queueNumber: queueNum,
            bk: item.bk,
            tipe: item.tipe || item.tipeMobil,
            category: item.category
          };
          setMyQueue({
            queueNumber: queueNum,
            bk: item.bk,
            tipe: item.tipe || item.tipeMobil,
            status: item.status,
            isCalled: item.is_called || false,
            counter: counter,
            calledAt: item.called_at,
            category: item.category
          });
          fetchQueueInfo(queueNum);
          const callKey = item.id + '-' + (item.called_at || '');
          if (item.is_called && lastCallAtRef.current[item.id] !== callKey) {
            lastCallAtRef.current[item.id] = callKey;
            if (!confirmedCallsRef.current.has(item.id)) {
              confirmedCallsRef.current.delete(item.id);
              sessionStorage.setItem('confirmed_calls', JSON.stringify([...confirmedCallsRef.current]));
              setCalledItem({
                id: item.id,
                queueNumber: queueNum,
                counter: counter,
                bk: item.bk,
                category: item.category
              });
            }
          }
        } else {
          if (lastQueueRef.current) {
            const today = new Date().toDateString();
            if (!completedShownRef.current) {
              completedShownRef.current = true;
              setCompletedInfo({ ...lastQueueRef.current, bk: user.plat_bk, time: Date.now(), day: today });
            } else {
              setMyQueue(null);
            }
          } else {
            setCompletedInfo(null);
            setMyQueue(null);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMyQueue();

    const subscription = supabase
      .channel('customer-antrian-' + user.plat_bk)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'antrian',
        filter: `bk=eq.${user.plat_bk.toUpperCase().replace(/\s+/g, '')}`
      }, (payload) => {
        try {
          fetchMyQueue();
          if (payload.eventType === 'DELETE') {
            if (!completedShownRef.current) {
              completedShownRef.current = true;
              const today = new Date().toDateString();
              setCompletedInfo({ ...lastQueueRef.current, bk: user.plat_bk, time: Date.now(), day: today });
            }
            return;
          }
          if (payload.new && payload.new.is_called) {
            const callKey = payload.new.id + '-' + (payload.new.called_at || '');
            if (lastCallAtRef.current[payload.new.id] !== callKey) {
              lastCallAtRef.current[payload.new.id] = callKey;
              if (!confirmedCallsRef.current.has(payload.new.id)) {
                confirmedCallsRef.current.delete(payload.new.id);
                sessionStorage.setItem('confirmed_calls', JSON.stringify([...confirmedCallsRef.current]));
                setCalledItem({ id: payload.new.id, queueNumber: payload.new.queue_number || 0, counter: payload.new.counter || 0, bk: payload.new.noPlat || payload.new.no_plat || payload.new.noplat || payload.new.bk || '', category: payload.new.category || 'Reguler' });
              }
            }
          }
        } catch (e) {
          console.error('Realtime call handler error:', e);
        }
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('Realtime customer subscription status:', status);
        }
      });

    // Polling 30 detik — cuma update "sedang dilayani" & "antrian di depan"
    // (data sendiri udah realtime via subscription)
    let pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchMyQueue();
        if (completedShownRef.current && completedInfo?.day !== new Date().toDateString()) {
          setCompletedInfo(null);
          completedShownRef.current = false;
        }
      }
    }, 30000);

    const onVisibility = () => {
      if (!document.hidden) {
        clearInterval(pollInterval);
        fetchMyQueue();
        pollInterval = setInterval(() => {
          if (!document.hidden) fetchMyQueue();
        }, 30000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user.plat_bk]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    try {
      if (!calledItem || !calledItem.id) return;
      if (confirmedCallsRef.current.has(calledItem.id)) return;
      setDismissedNotif(false);

      const safeBk = calledItem.bk || '';
      const cat = calledItem.category || 'Reguler';
      const qnFormatted = calledItem.queueNumber > 0
        ? (cat === 'Booking' ? `B-${String(calledItem.queueNumber).padStart(2, '0')}` : `R-${String(calledItem.queueNumber).padStart(2, '0')}`)
        : safeBk;
      const ttsText = calledItem.queueNumber > 0
        ? (cat === 'Booking'
          ? `Antrian Booking nomor ${calledItem.queueNumber}, silahkan menuju counter ${calledItem.counter}`
          : `Antrian Reguler nomor ${calledItem.queueNumber}, silahkan menuju counter ${calledItem.counter}`)
        : `Antrian, silahkan menuju counter ${calledItem.counter}`;
      const callLabel = calledItem.queueNumber > 0
        ? (cat === 'Booking' ? `Booking ${calledItem.queueNumber}` : `Reguler ${calledItem.queueNumber}`)
        : safeBk;

      try {
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
      } catch (e) { }

      if ("Notification" in window) {
        try {
          if (Notification.permission === "granted") {
            new Notification(`📢 Dipanggil: ${callLabel}`, {
              body: `Silahkan menuju Counter ${calledItem.counter}`,
              vibrate: [200, 100, 200]
            });
          } else if (Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
              if (permission === "granted") {
                new Notification(`📢 Dipanggil: ${callLabel}`, {
                  body: `Silahkan menuju Counter ${calledItem.counter}`,
                  vibrate: [200, 100, 200]
                });
              }
            }).catch(() => {});
          }
        } catch (e) { }
      }

      if (voiceEnabled) {
        speak(ttsText);
      }

      try {
        Toastify({
          text: `📢 ${callLabel} - Silahkan menuju Counter ${calledItem.counter}`,
          duration: 0,
          close: true,
          gravity: "top",
          position: "center",
          style: { background: "linear-gradient(135deg, #2563eb, #1d4ed8)", borderRadius: "16px", fontWeight: "900", padding: "16px 24px" }
        }).showToast();
      } catch (e) { }

      const timer = setTimeout(() => { setCalledItem(null); setDismissedNotif(true); }, 120000);
      return () => clearTimeout(timer);
    } catch (e) {
      console.error('Called notification error:', e);
    }
  }, [calledItem, voiceEnabled]);

  useEffect(() => {
    if (vinAbortRef.current) vinAbortRef.current.abort();
    const controller = new AbortController();
    vinAbortRef.current = controller;

    const fetchHistory = async () => {
      if (!user.vin) {
        setIsLoading(false);
        return;
      }

      const cached = getCachedHistory();
      if (cached && cached.vin === user.vin) {
        setHistory(cached.data);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/chery_dms?endpoint=warranty-search-vin&vin=${encodeURIComponent(user.vin)}&length=50`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const woList = json.data || [];
        const mapped = woList.map(wo => ({
          id: wo.no_wo || wo.id_wo || '-',
          tanggal: wo.waktu_masuk || '',
          perintah: wo.perintah || '',
          stand_km: wo.stand_km || 0,
          status: wo.status || '',
          parts: [],
          partsLoaded: false,
        }));

        setHistory(mapped);
        setCachedHistory(user.vin, mapped);

        const batchSize = 35;
        for (let i = 0; i < woList.length; i += batchSize) {
          if (controller.signal.aborted) break;
          const batch = woList.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(async (wo) => {
            try {
              const idWo = wo.id_wo || wo.no_wo;
              if (!idWo) return;
              const r = await fetch(`/api/chery_dms?endpoint=warranty-estimasi-detail&id=${idWo}`, { signal: controller.signal });
              const j = await r.json();
              if (j.error || !j.parts) return;
              const updateFn = (prev) => prev.map(h =>
                h.id === (wo.no_wo || wo.id_wo)
                  ? { ...h, parts: j.parts, partsLoaded: true }
                  : h
              );
              setHistory(updateFn);
              setCachedHistory(user.vin, updateFn(mapped));
            } catch { }
          }));
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        Toastify({ text: "Gagal mengambil riwayat servis", style: { background: "#ef4444" } }).showToast();
      } finally {
        if (vinAbortRef.current === controller) setIsLoading(false);
      }
    };
    fetchHistory();
    return () => { controller.abort(); };
  }, [user.vin]);

  // Fetch active bookings for this customer
  useEffect(() => {
    if (!user.plat_bk) return;
    const fetchActiveBookings = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await db.select('booking', {
          select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, status, bookingVia',
          eq: { noPlat: user.plat_bk.toUpperCase().replace(/\s+/g, '') },
          in: { status: ['accepted', 'waiting confirm'] },
          gte: { tanggal: today },
          order: { column: 'jam', ascending: true }
        });
        if (Array.isArray(data)) setActiveBookings(data);
      } catch (e) {
        console.warn('Gagal fetch active bookings:', e);
      }
    };
    fetchActiveBookings();
  }, [user.plat_bk]);

  // Load reschedule config
  useEffect(() => {
    fetchBookingConfig().then(setRescheduleConfig).catch(() => {});
  }, []);

  // Fetch bookings for reschedule date
  const fetchRescheduleBookings = useCallback(async (dateStr) => {
    try {
      const { data } = await db.select('booking', {
        select: 'id, tanggal, jam, noPlat, status',
        eq: { tanggal: dateStr },
        in: { status: ['accepted', 'waiting confirm', 'completed'] }
      });
      if (Array.isArray(data)) setRescheduleAllBookings(data);
    } catch (e) {
      console.warn('Gagal fetch reschedule bookings:', e);
    }
  }, []);

  useEffect(() => {
    if (showRescheduleModal) {
      fetchRescheduleBookings(rescheduleDate);
    }
  }, [showRescheduleModal, rescheduleDate, fetchRescheduleBookings]);

  const openRescheduleModal = (booking) => {
    setRescheduleBooking(booking);
    setRescheduleDate(booking.tanggal || new Date().toISOString().split('T')[0]);
    setShowRescheduleModal(true);
  };

  const handleReschedule = async (newJam) => {
    if (!rescheduleBooking || !newJam) return;
    if (rescheduleDate <= getTodayStr()) {
      Toastify({ text: 'Tidak bisa reschedule ke hari ini! Pilih besok atau setelahnya.', style: { background: '#f97316' } }).showToast();
      return;
    }
    setIsRescheduling(true);
    try {
      const newDate = rescheduleDate;
      const newJamNormalized = newJam.replace(':', '.');
      const oldJamNormalized = String(rescheduleBooking.jam).replace(':', '.');

      // Check if slot is available
      const bookingsAtSlot = rescheduleAllBookings.filter(b =>
        b.jam?.replace(':', '.') === newJamNormalized && b.id !== rescheduleBooking.id
      );
      const slotCap = rescheduleConfig.slotCapacity || 1;
      if (bookingsAtSlot.length >= slotCap) {
        Toastify({ text: 'Slot ini sudah penuh! Pilih jam lain.', style: { background: '#f97316' } }).showToast();
        setIsRescheduling(false);
        return;
      }

      // Update booking
      const { error } = await db.update('booking', {
        tanggal: newDate,
        jam: newJamNormalized,
        status: 'accepted',
        bookingVia: (rescheduleBooking.bookingVia || 'Web') + ' (Reschedule)'
      }, { eq: { id: rescheduleBooking.id } });

      if (error) throw error;

      Toastify({ text: `Booking dipindahkan ke ${newDate} jam ${newJam}!`, style: { background: 'green' } }).showToast();
      setShowRescheduleModal(false);
      setRescheduleBooking(null);

      // Refresh active bookings
      const today = new Date().toISOString().split('T')[0];
      const { data } = await db.select('booking', {
        select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, status, bookingVia',
        eq: { noPlat: user.plat_bk.toUpperCase().replace(/\s+/g, '') },
        in: { status: ['accepted', 'waiting confirm'] },
        gte: { tanggal: today },
        order: { column: 'jam', ascending: true }
      });
      if (Array.isArray(data)) setActiveBookings(data);
    } catch (e) {
      Toastify({ text: `Gagal reschedule: ${e.message}`, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsRescheduling(false);
    }
  };

  const isVerified = user.status === 'active';

  const statusLabels = {
    waiting: 'Menunggu Antrian',
    working: 'Sedang Dikerjakan',
    istirahat: 'Istirahat',
    menginap: 'Menginap',
    menunggu_konfirmasi: 'Menunggu Konfirmasi Admin',
    selesai: 'Selesai',
    completed: 'Selesai',
    s: 'Selesai'
  };
  const cardStatusStyles = {
    waiting: 'bg-white/10 text-zinc-300 border border-white/10',
    working: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    istirahat: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    menginap: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    menunggu_konfirmasi: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    selesai: 'bg-white/20 text-white border border-white/30',
    completed: 'bg-white/20 text-white border border-white/30',
    s: 'bg-white/20 text-white border border-white/30'
  };

  return (
    <div className="min-h-screen bg-white pb-[72px] md:pb-0">
      {calledItem && calledItem.id && !confirmedCallsRef.current.has(calledItem.id) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-2xl text-center animate-fade-in border-4 border-blue-500">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
              <Megaphone size={36} className="text-white fill-white" />
            </div>
            <h2 className="text-3xl font-black text-black mb-2">Dipanggil!</h2>
            <p className="text-6xl font-black text-blue-600 mb-4 font-mono tracking-tight truncate max-w-full">
              {myQueue?.queueNumber > 0 ? formatQueueLabel(myQueue.queueNumber, myQueue.category) : (calledItem.bk || '—')}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-lg font-black text-blue-800">
                Silahkan menuju <span className="text-2xl">Counter {calledItem.counter || 0}</span>
              </p>
            </div>
            <button onClick={() => confirmCall(calledItem.id)}
              className="bg-black text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Konfirmasi
            </button>
          </div>
        </div>
      )}



      <main className="max-w-4xl mx-auto p-6 pt-6 md:pt-8 space-y-6">
        {/* Called Notification Banner */}
        {calledItem && calledItem.id && !dismissedNotif && !confirmedCallsRef.current.has(calledItem.id) && (
          <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl border-2 border-blue-400">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shrink-0 animate-bounce">
                <Megaphone size={28} className="text-white fill-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Panggilan Antrian</p>
                <p className="text-2xl font-black text-white truncate">
                  {myQueue?.queueNumber > 0 ? formatQueueLabel(myQueue.queueNumber, myQueue.category) : (calledItem.bk || '—')}
                </p>
                <p className="text-base font-bold text-blue-100 mt-1">
                  Silahkan menuju <span className="text-white font-black">Counter {calledItem.counter || 0}</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => confirmCall(calledItem.id)}
                  className="bg-white text-blue-700 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-50 transition-all"
                >
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-6 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <Car size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-black">Halo, {user.name}</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-2">
                {user.plat_bk} <span className="w-1 h-1 bg-zinc-200 rounded-full"></span> {user.vin || 'No VIN'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                localStorage.setItem('chery_voice_enabled', JSON.stringify(next));

                if (next) {
                  const ok = await pushSubscribe(user.plat_bk);
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                  if (!ok && isIOS) {
                    Toastify({
                      text: '💡 Aktifkan notifikasi: Buka Safari → Share → Add to Home Screen',
                      duration: 6000,
                      gravity: 'bottom',
                      position: 'center',
                      style: { background: '#1e3a5f', borderRadius: '12px', fontWeight: '700' }
                    }).showToast();
                  }
                  if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission();
                  }
                } else {
                  pushUnsubscribe(user.plat_bk);
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${voiceEnabled ? 'bg-emerald-50 text-emerald-500' : 'bg-zinc-100 text-zinc-400'}`}
              title={voiceEnabled ? 'Suara Nyala' : 'Suara Mati'}
            >
              <Megaphone size={18} />
            </button>
            <div className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${isVerified ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
              {isVerified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              <span className="hidden sm:inline">{isVerified ? 'Terverifikasi' : 'Menunggu Verifikasi'}</span>
            </div>
            <button
              onClick={() => { pushUnsubscribe(user.plat_bk); handleLogout(); }}
              className="hidden md:flex w-10 h-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-full items-center justify-center transition-all active:scale-90"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

        {/* Top Row: Queue + Vehicle Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Queue Container - Left */}
          <div className="md:col-span-2">
            {!user.plat_bk ? (
              <div className="bg-white border border-zinc-100 rounded-[2rem] p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                  <Car size={32} />
                </div>
                <h3 className="text-lg font-black text-black">Belum Ada Plat Nomor</h3>
                <p className="text-zinc-400 text-xs mt-2">
                  Hubungi admin untuk melengkapi data plat nomor kendaraan Anda.
                </p>
              </div>
            ) : !myQueue ? (completedInfo && completedInfo.day === new Date().toDateString()) ? (
              <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <ShieldCheck size={16} className="text-white" />
                    </div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status Antrian Anda</span>
                  </div>
                  {completedInfo.queueNumber > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1">Nomor Antrian</p>
                      <p className="text-5xl md:text-6xl font-black font-mono tracking-tight text-white">
                        {formatQueueLabel(completedInfo.queueNumber, completedInfo.category)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap mt-3">
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl">
                      <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Plat</p>
                      <p className="text-base font-black text-white">{completedInfo.bk}</p>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl">
                      <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Tipe</p>
                      <p className="text-base font-black text-white">{completedInfo.tipe || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Selesai
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-zinc-100 rounded-[2rem] p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                  <Clock size={32} />
                </div>
                <h3 className="text-lg font-black text-black">Tidak Ada Antrian Aktif</h3>
                <p className="text-zinc-400 text-xs mt-2">
                  Anda sedang tidak dalam antrian saat ini.
                </p>
                <button
                  onClick={() => setCurrentPage && setCurrentPage('booking-public')}
                  className="mt-6 bg-black text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto shadow-md"
                >
                  <Calendar size={14} />
                  Booking Sekarang
                </button>
              </div>
            ) : (
              <div className={`${['selesai', 'completed', 's'].includes(myQueue.status) ? 'bg-emerald-600 text-white' : 'bg-black text-white'} p-6 rounded-[2rem] shadow-xl relative overflow-hidden h-full`}>
                <div className={`absolute inset-0 pointer-events-none ${['selesai', 'completed', 's'].includes(myQueue.status) ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-zinc-800 to-black'}`} />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <Megaphone size={16} className="text-white fill-white" />
                    </div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status Antrian Anda</span>
                  </div>
                  {myQueue.queueNumber > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mb-1">Nomor Antrian</p>
                      <p className="text-5xl md:text-6xl font-black font-mono tracking-tight text-white">
                        {formatQueueLabel(myQueue.queueNumber, myQueue.category)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap mt-3">
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl">
                      <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Plat</p>
                      <p className="text-base font-black text-white">{myQueue.bk}</p>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl">
                      <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Tipe</p>
                      <p className="text-base font-black text-white">{myQueue.tipe}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cardStatusStyles[myQueue.status] || 'bg-white/10 text-zinc-300'}`}>
                      {statusLabels[myQueue.status] || myQueue.status}
                    </div>
                  </div>

                  {/* Queue position info */}
                  {myQueue.status === 'waiting' && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-white/10 rounded-xl p-3 text-center">
                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Sedang Dilayani</p>
                        <p className="text-lg font-black text-white font-mono">
                          {nowServing && nowServing.queueNumber > 0
                            ? formatQueueLabel(nowServing.queueNumber, nowServing.category)
                            : '-'}
                        </p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 text-center">
                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Antrian di Depan</p>
                        <p className={`text-lg font-black font-mono ${queueAhead > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {queueAhead > 0 ? `${queueAhead} antrian` : 'Giliran Anda!'}
                        </p>
                      </div>
                    </div>
                  )}

                  {myQueue.status === 'working' && (
                    <div className="bg-blue-500/20 rounded-xl p-3 mt-4 text-center">
                      <p className="text-xs font-black text-blue-200">
                        Mekanik sedang mengerjakan kendaraan Anda
                      </p>
                    </div>
                  )}

                  {myQueue.status === 'menunggu_konfirmasi' && (
                    <div className="bg-emerald-500/20 rounded-xl p-3 mt-4 text-center">
                      <p className="text-xs font-black text-emerald-200">
                        Pekerjaan selesai — Menunggu konfirmasi admin
                      </p>
                    </div>
                  )}

                  {myQueue.isCalled && (
                    <p className="text-xs font-black text-blue-300 mt-2">
                      Dipanggil ke Counter {myQueue.counter}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vehicle Data - Right */}
          <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-zinc-50 rounded-xl flex items-center justify-center">
                <Car size={16} className="text-zinc-600" />
              </div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Data Mobil</span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Plat Nomor</p>
                <p className="text-sm font-black text-black">{user.plat_bk || '-'}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Nomor Rangka (VIN)</p>
                <p className="text-sm font-black text-black font-mono tracking-tight">
                  {user.vin || '-'}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Nama Pemilik</p>
                <p className="text-sm font-black text-black">{user.name || '-'}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">WhatsApp</p>
                <p className="text-sm font-black text-black">{user.username || '-'}</p>
              </div>
              <div>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Status Akun</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isVerified ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                  {isVerified ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                  {isVerified ? 'Aktif' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Alert */}
        {!isVerified && (
          <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-[2rem] text-black shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-zinc-200 p-2.5 rounded-2xl shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="font-black text-base text-black">Akun Sedang Diverifikasi</h3>
                <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                  Terima kasih sudah mendaftar! Admin kami sedang memproses verifikasi akun Anda.
                  Setelah disetujui, Anda bisa melihat riwayat servis dan mengirim keluhan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Bookings */}
        {activeBookings.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center">
                <Calendar size={16} className="text-zinc-600" />
              </div>
              <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Booking Aktif</h2>
            </div>
            <div className="grid gap-3">
              {activeBookings.map((bk) => (
                <div key={bk.id} className="bg-white border border-zinc-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-mono text-sm font-black shrink-0">
                        {bk.jam}
                      </div>
                      <div>
                        <p className="text-xs font-black text-black">{bk.namaCustomer}</p>
                        <p className="text-[9px] text-zinc-400 font-bold mt-0.5">
                          {new Date(bk.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-[9px] text-zinc-400 font-bold">{bk.noPlat} — {bk.tipeMobil || '-'}</p>
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <Clock size={8} /> {bk.status === 'accepted' ? 'Dikonfirmasi' : 'Menunggu'}
                        </span>
                      </div>
                    </div>
                    {bk.tanggal !== getTodayStr() && (
                    <button
                      onClick={() => openRescheduleModal(bk)}
                      className="flex items-center gap-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 border border-zinc-200"
                    >
                      <RefreshCw size={12} /> Reschedule
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service History */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center">
              <Wrench size={16} className="text-zinc-600" />
            </div>
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Riwayat Servis</h2>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-zinc-400 font-bold text-xs">Memuat riwayat...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white border border-zinc-100 rounded-[2rem] p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                <Wrench size={32} />
              </div>
              <h3 className="text-lg font-black text-black">Belum Ada Riwayat</h3>
              <p className="text-zinc-400 text-xs mt-2 max-w-xs mx-auto">
                Sepertinya kendaraan Anda belum memiliki catatan servis di sistem kami.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {history.map((item, idx) => {
                const isExpanded = !!expandedParts[item.id];
                return (
                  <div key={idx} className="bg-white border border-zinc-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all">
                    {/* Basic info - always visible */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 shrink-0">
                        <Wrench size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                            {item.tanggal
                              ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'Tanggal Tidak Tersedia'}
                          </p>
                          {item.status && (
                            <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${
                              item.status.toLowerCase() === 'closed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                              item.status.toLowerCase() === 'open' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                              item.status.toLowerCase() === 'cancel' ? 'bg-red-50 text-red-600 border border-red-200' :
                              'bg-zinc-50 text-zinc-500 border border-zinc-200'
                            }`}>
                              {item.status}
                            </span>
                          )}
                        </div>
                        {item.stand_km > 0 && (
                          <p className="text-[8px] font-black text-zinc-300 mt-0.5">
                            KM: {Number(item.stand_km).toLocaleString('id-ID')} km
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Perintah Pekerjaan - always visible */}
                    {item.perintah && (
                      <div className="mb-3">
                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mb-1.5">Perintah Pekerjaan</p>
                        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-[11px] text-zinc-700 font-semibold leading-relaxed whitespace-pre-line">
                          {item.perintah}
                        </div>
                      </div>
                    )}

                    {/* Toggle button for parts */}
                    <button
                      onClick={() => toggleParts(item.id)}
                      className="w-full flex items-center justify-between bg-zinc-50 hover:bg-zinc-100 transition-colors px-4 py-2.5 rounded-xl text-xs font-black text-zinc-500"
                    >
                      <span>
                        {item.partsLoaded
                          ? `${item.parts.length} Sparepart Digunakan`
                          : 'Lihat Sparepart'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {/* Parts - hidden initially, shown on click */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-zinc-100">
                        {item.parts.length > 0 ? (
                          <div className="grid gap-1.5">
                            {item.parts.map((p, pi) => (
                              <div key={pi} className="flex items-center justify-between bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-black truncate">{p.nama_part || '-'}</p>
                                  <p className="text-[8px] text-zinc-400 font-mono">{p.kode_part || ''}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                  <span className="text-[9px] font-black text-zinc-500">{p.qty || p.jumlah || 1}x</span>
                                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                                    (p.status_permintaan || p.status) === 'Disetujui' || (p.status_permintaan || p.status) === 'VALIDATED'
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                                  }`}>
                                    {p.status_permintaan || p.status || '-'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-300 font-bold italic text-center py-2">
                            {item.partsLoaded ? 'Tidak ada data sparepart' : 'Memuat data sparepart...'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-black text-white p-6 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Reschedule Booking</h3>
                <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-widest mt-1">
                  {rescheduleBooking.noPlat} — {rescheduleBooking.tipeMobil || ''}
                </p>
              </div>
              <button onClick={() => { setShowRescheduleModal(false); setRescheduleBooking(null); }}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Current booking info */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Jadwal Saat Ini</p>
                <p className="text-sm font-black text-black">
                  {new Date(rescheduleBooking.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {rescheduleBooking.jam} WIB
                </p>
              </div>

              {/* Date picker */}
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Pilih Tanggal Baru</label>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => { const d = new Date(rescheduleMonth); d.setMonth(d.getMonth() - 1); setRescheduleMonth(d); }}
                    className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><ChevronLeft size={14} /></button>
                  <span className="text-xs font-black text-black uppercase tracking-wider flex-1 text-center">
                    {rescheduleMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => { const d = new Date(rescheduleMonth); d.setMonth(d.getMonth() + 1); setRescheduleMonth(d); }}
                    className="p-2 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-all"><ChevronRight size={14} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {['Min','Sen','Sel','Rab','Kam','Jum','Sat'].map(d => (
                    <div key={d} className="text-center text-[7px] font-black text-zinc-400 uppercase tracking-widest py-1">{d}</div>
                  ))}
                  {(() => {
                    const m = rescheduleMonth.getMonth();
                    const y = rescheduleMonth.getFullYear();
                    const daysInMonth = new Date(y, m + 1, 0).getDate();
                    const startDay = new Date(y, m, 1).getDay();
                    const cells = [];
                    for (let i = 0; i < startDay; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    return cells.map((day, idx) => {
                      if (!day) return <div key={idx}></div>;
                      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = rescheduleDate === dateStr;
                      const isToday = dateStr === new Date().toISOString().split('T')[0];
                      const isPast = new Date(dateStr) <= new Date().setHours(0, 0, 0, 0);
                      const isSunday = new Date(dateStr).getDay() === 0;
                      const isDisabled = isPast || isSunday;
                      return (
                        <button key={idx} disabled={isDisabled}
                          onClick={() => { setRescheduleDate(dateStr); fetchRescheduleBookings(dateStr); }}
                          className={`aspect-square rounded-xl text-[10px] font-black transition-all ${
                            isDisabled ? 'text-zinc-200 cursor-not-allowed' :
                            isSelected ? 'bg-black text-white shadow-lg' :
                            isToday ? 'bg-zinc-100 text-black border border-zinc-300' :
                            'text-zinc-600 hover:bg-zinc-100'
                          }`}>
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Pilih Jam Baru</label>
                <div className="grid grid-cols-2 gap-2">
                  {generateSlots(rescheduleConfig.slotCount, rescheduleConfig.gapMinutes, rescheduleConfig.startHour, rescheduleConfig.startMinute).map((jam) => {
                    const bookingsAtSlot = rescheduleAllBookings.filter(b =>
                      b.jam?.replace(':', '.') === jam.replace(':', '.')
                    );
                    const isFull = bookingsAtSlot.length >= (rescheduleConfig.slotCapacity || 1);
                    const isCurrent = rescheduleBooking.jam?.replace(':', '.') === jam.replace(':', '.') &&
                      rescheduleBooking.tanggal === rescheduleDate;
                    const isPastTime = rescheduleDate === new Date().toISOString().split('T')[0] && (() => {
                      const [h, m] = jam.split('.');
                      const now = new Date();
                      const slotDate = new Date();
                      slotDate.setHours(parseInt(h), parseInt(m), 0, 0);
                      return slotDate < now;
                    })();

                    return (
                      <button key={jam} disabled={isFull || isCurrent || isPastTime || isRescheduling}
                        onClick={() => handleReschedule(jam)}
                        className={`p-3 rounded-xl text-center font-black transition-all border-2 ${
                          isRescheduling ? 'opacity-50 cursor-wait' :
                          isFull ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed' :
                          isCurrent ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed' :
                          isPastTime ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed' :
                          'bg-white border-zinc-200 text-black hover:border-black hover:shadow-md cursor-pointer active:scale-95'
                        }`}>
                        <span className="text-sm font-mono">{jam}</span>
                        <p className="text-[7px] uppercase tracking-widest mt-1 font-bold">
                          {isFull ? 'Penuh' : isCurrent ? 'Sekarang' : isPastTime ? 'Lewat' : `${rescheduleConfig.slotCapacity - bookingsAtSlot.length} slot`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
    </div>
  );
};

export default CustomerPanel;
