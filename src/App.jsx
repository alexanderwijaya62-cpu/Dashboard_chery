import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings, Calendar, Plus, Zap, FileText, LogOut, Truck } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

import { API_KEY, GAS_URL, GAS_USERS_URL, IS_MAINTENANCE } from './utils/config';
import { supabase } from './utils/supabaseClient';

// Import Komponen Terpisah
import DisplayBoard from './components/DisplayBoard';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import PromosiSparepart from './components/PromosiSparepart';
import QuotationSPA from './quotation/QuotationSPA';
import MechanicPanel from './components/MechanicPanel';
import SparepartPanel from './components/SparepartPanel';
import FollowupPanel from './components/FollowupPanel';
import ManagerPanel from './components/ManagerPanel';
import PublicBooking from './components/PublicBooking';
import CroBookingPanel from './components/CroBookingPanel';
import BookingManager from './components/BookingManager';
import OwnerPanel from './components/OwnerPanel';
import StockComparison from './components/StockComparison';
import { USERS } from './data/users';
import RegisterPage from './components/RegisterPage';
import CustomerProfile from './components/CustomerProfile';
import CustomerPanel from './components/CustomerPanel';
import PublicTracking from './components/PublicTracking';
import DesktopNavBar from './components/DesktopNavBar';
import BottomNavBar from './components/BottomNavBar';
import PublicNavBar from './components/PublicNavBar';
import WarrantyPanel from './components/WarrantyPanel';
import WarrantyDashboard from './components/WarrantyDashboard';
import WarrantySearch from './components/WarrantySearch';
import WarrantyHub from './components/WarrantyHub';
import ProformaInvoice from './components/ProformaInvoice';
import { getNavItems } from './utils/navConfig';

// Helper sanitasi untuk mencegah "Injection" atau karakter berbahaya
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  // Menghapus karakter yang sering digunakan untuk memanipulasi Query/Formula (', ", =, <, >, { , })
  return str.replace(/['"=<>{}[\]]/g, '').trim();
};

const customFetch = (url, options = {}) => {
  const isGAS = url.includes('script.google.com');
  const headers = { ...options.headers };

  if (!isGAS) {
    headers["x-api-key"] = API_KEY;
  }

  return fetch(url, {
    ...options,
    headers
  });
};

// Helper function dipindah ke luar agar tidak di-recreate setiap render
const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const isToday = (time) => {
  if (!time) return false;
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let d;
    if (typeof time === 'number') {
      d = (time < 2000000000) ? new Date(time * 1000) : new Date(time);
    } else if (typeof time === 'string') {
      if (time.includes('/')) {
        const parts = time.split(/[ ,]/)[0].split('/');
        if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
      } else if (time.includes('-')) {
        const parts = time.split(/[ T]/)[0].split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]); // ISO
          else d = new Date(parts[2], parts[1] - 1, parts[0]); // DD-MM-YYYY
        }
      } else {
        d = new Date(time);
      }
    } else {
      d = new Date(time);
    }

    if (!d || isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() === now.getTime();
  } catch (e) {
    return false;
  }
};

const App = () => {
  // --- 1. STATE DEFINITIONS ---
  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('chery_current_page') || 'login';
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chery_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('chery_session_id') || null;
  });
  const [lastLoginDate, setLastLoginDate] = useState(() => {
    return localStorage.getItem('chery_last_login_date') || null;
  });

  // --- EPCM Token URL Listener ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const epcmToken = urlParams.get('epcmToken');
    if (epcmToken) {
      localStorage.setItem('chery_epcm_token', epcmToken);
      // Bersihkan URL tanpa refresh
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      Toastify({ 
        text: "✅ EPCM Token Terhubung!", 
        style: { background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "12px" } 
      }).showToast();
      
      // Kirim event agar komponen yang sedang terbuka bisa update state
      window.dispatchEvent(new Event('epcm_token_updated'));
    }
  }, []);

  const [queue, setQueue] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [formData, setFormData] = useState({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoadingProcess, setIsLoadingProcess] = useState(false);
  const [rawHistory, setRawHistory] = useState([]);
  const [usersData, setUsersData] = useState(USERS);
  const [breakSettings, setBreakSettings] = useState(() => {
    const saved = localStorage.getItem('chery_break_settings');
    return saved ? JSON.parse(saved) : {
      startHour: 12,
      startMinute: 0,
      endHourNormal: 13,
      endMinuteNormal: 0,
      endHourFriday: 13,
      endMinuteFriday: 15
    };
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Refs

  // --- 2. EFFECTS & LOGIC ---
  useEffect(() => {
    localStorage.setItem('chery_current_page', currentPage);
  }, [currentPage]);

  // Update Location & Coordinates whenever App loads with a user
  useEffect(() => {
    if (!user) return;

    const updateGeoData = async () => {
      try {
        let ip = '-';
        let location = 'Unknown';
        let ipCoords = '';

        // Fungsi fetch Geo dari berbagai provider
        const getGeo = async () => {
          // Provider 1: db-ip.com (Sangat stabil & CORS Friendly)
          try {
            const res = await fetch('https://api.db-ip.com/v2/free/self');
            const data = await res.json();
            if (data.latitude) return {
              ip: data.ipAddress,
              loc: `${data.city || ''}, ${data.stateProv || ''}`,
              coords: `${data.latitude}, ${data.longitude}`
            };
          } catch (e) { }

          // Provider 2: ipapi.co (Fallback)
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.latitude) return {
              ip: data.ip,
              loc: `${data.city || ''}, ${data.region || ''}`,
              coords: `${data.latitude}, ${data.longitude}`
            };
          } catch (e) { }

          return null;
        };

        const geo = await getGeo();
        if (geo) {
          ip = geo.ip;
          location = geo.loc;
          ipCoords = geo.coords;
        }

        // Simpan data (Pasti Terisi & Tanpa Prompt Popup)
        const combinedLoc = `${location} (${ipCoords || '0,0'})`;
        await supabase.from('users').update({
          lastIP: ip,
          lastLocation: combinedLoc
        }).eq('username', user.username);

      } catch (e) {
        console.error("Silent Geo Error:", e);
      }
    };

    updateGeoData();
  }, [user?.username]); // Only run when user changes or app loads

  const handleLogout = async (isForced = false) => {
    let networkFailed = false;

    if (user) {
      try {
        // Race the Supabase update against a 2-second timeout to ensure logout completes promptly
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Logout timeout')), 2000)
        );
        await Promise.race([
          supabase
            .from('users')
            .update({ isOnline: false, sessionId: null })
            .eq('username', user.username),
          timeoutPromise
        ]);
      } catch (err) {
        console.error("Gagal update status logout:", err);
        networkFailed = true;
      }
    }

    // Always clear local session and redirect, regardless of network outcome
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('chery_auth_user');
    localStorage.removeItem('chery_session_id');
    setCurrentPage('login');
    window.history.pushState({}, '', '/login');

    // Reset URL to the main public domain
    window.history.pushState({}, '', '/');

    if (!isForced) {
      if (networkFailed) {
        Toastify({
          text: "⚠️ Logout berhasil (sesi remote tidak dapat dihapus)",
          duration: 5000,
          close: true,
          gravity: "top",
          position: "center",
          style: { background: "#000000", borderRadius: "12px", fontWeight: "600" }
        }).showToast();
      } else {
        Toastify({ text: "✅ Berhasil Logout", style: { background: "#000000", borderRadius: "12px" } }).showToast();
      }
    }
  };

  // Handle Pseudo-Routing ( Guards & Redirects )
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const savedUser = localStorage.getItem('chery_auth_user');

    // 1. PUBLIC ROUTES — hanya login yang bisa diakses tanpa auth
    const publicPaths = ['/login'];
    if (publicPaths.includes(path)) {
      // path === '/login'
      if (savedUser && savedUser !== 'null') {
        const u = JSON.parse(savedUser);
        if (u && u.role) {
          const role = u.role.toLowerCase();
          const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(role) ? '/staff' : 
                            (role === 'customer' ? '/customer' : '/karyawan');
          window.history.replaceState({}, '', targetUrl);
          window.location.reload();
        }
      } else {
        setCurrentPage('login');
      }
      return;
    }

    // 2. PROTECTED ROUTES (Semua rute lain butuh login)
    // Root path '/' — redirect to login if not logged in
    if (path === '/' || path === '') {
      if (!savedUser || savedUser === 'null') {
        setCurrentPage('login');
        return;
      }
    }

    if (!savedUser || savedUser === 'null') {
      setCurrentPage('login');
      if (path !== '/login') {
        window.history.replaceState({}, '', '/login');
      }
      return;
    }

    // 4. ROLE-BASED ACCESS (User is Logged In)
    const u = JSON.parse(savedUser || '{}');
    if (!u || !u.role) {
      handleLogout(true); // Invalid user data
      return;
    }

    const savedPage = localStorage.getItem('chery_current_page');
    const role = u.role.toLowerCase();

    // Specific path mapping
    if (path === '/staff' || path === '/' || path === '/display') {
        if (['admin', 'manager', 'cro', 'sparepart', 'owner', 'warranty'].includes(role)) {
          const allowedPages = {
            admin: ['admin', 'admin-booking', 'promo', 'display', 'booking-public'],
            manager: ['manager', 'manager-financial', 'manager-wo', 'manager-vehicles', 'manager-cro', 'manager-holidays', 'manager-staff', 'display', 'booking-public'],
            cro: ['cro', 'cro-sudah', 'cro-freeservice', 'cro-laporan', 'cro-booking', 'cro-holidays', 'display', 'booking-public'],
            sparepart: ['sparepart', 'sparepart-view', 'sparepart-quotation', 'sparepart-profit', 'quotation', 'display', 'booking-public', 'stock-comparison'],
            owner: ['owner', 'owner-workshop', 'owner-dms', 'owner-warranty', 'owner-parts', 'owner-users', 'owner-sound', 'owner-deleted', 'display', 'booking-public', 'stock-comparison'],
            warranty: ['warranty', 'warranty-wo', 'warranty-search', 'warranty-proforma'],
          };

          if (savedPage && allowedPages[role]?.includes(savedPage)) {
            setCurrentPage(savedPage);
          } else {
            setCurrentPage(role === 'cro' ? 'cro' : role);
          }
        } else if (role === 'customer') {
          window.history.replaceState({}, '', '/customer');
          setCurrentPage('customer');
        } else {
          window.history.replaceState({}, '', '/karyawan');
          setCurrentPage('mechanic');
        }
    } else if (path === '/karyawan') {
      if (role === 'mekanik') {
        setCurrentPage('mechanic');
      } else {
        window.history.replaceState({}, '', '/staff');
        setCurrentPage(role === 'cro' ? 'cro' : role);
      }
    } else {
      // If path is unknown but logged in, send to their role's default page or respect saved page
      const defaultPath = ['mekanik'].includes(role) ? '/karyawan' : (role === 'customer' ? '/customer' : '/staff');
      window.history.replaceState({}, '', defaultPath);

      if (savedPage && (
        (role === 'mekanik' && savedPage === 'mechanic') ||
        (role === 'customer' && (savedPage === 'customer' || savedPage === 'booking-public')) ||
        (['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(role))
      )) {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage(role === 'mekanik' ? 'mechanic' : (role === 'customer' ? 'customer' : (role === 'cro' ? 'cro' : role)));
      }
    }
  }, []);

  // REDIRECT dari Vercel ke Custom Domain
  useEffect(() => {
    if (window.location.hostname.endsWith('.vercel.app')) {
      window.location.replace('https://cherymedan.web.id' + window.location.pathname + window.location.search);
    }
  }, []);


  // Save break settings to localStorage
  useEffect(() => {
    localStorage.setItem('chery_break_settings', JSON.stringify(breakSettings));
  }, [breakSettings]);

  // Remote Control Listener: Mendukung Force Refresh dari Admin
  useEffect(() => {
    const refreshChannel = supabase.channel('remote_control')
      .on('broadcast', { event: 'force-refresh' }, () => {
        console.log('Force Refresh command received!');
        window.location.reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(refreshChannel);
    };
  }, []);

  // Auto Logout setelah 1 hari (Reset setiap jam 24:00)
  useEffect(() => {
    const checkDailyLogout = () => {
      const today = new Date().toDateString(); // e.g. "Wed Apr 15 2026"
      const storedDate = localStorage.getItem('chery_last_login_date');

      if (user && storedDate && storedDate !== today) {
        handleLogout(true);
        localStorage.removeItem('chery_last_login_date');
        Toastify({
          text: "⏰ Sesi Anda telah berakhir (Sesi Harian). Silakan login kembali.",
          duration: 0,
          close: true,
          gravity: 'top',
          position: 'center',
          style: { background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderRadius: '16px', fontWeight: '800' }
        }).showToast();
      } else if (user && !storedDate) {
        localStorage.setItem('chery_last_login_date', today);
        setLastLoginDate(today);
      }
    };

    checkDailyLogout();
    // Cek setiap jam untuk memastikan jika aplikasi dibiarkan terbuka melewati tengah malam
    const interval = setInterval(checkDailyLogout, 3600000);
    return () => clearInterval(interval);
  }, [user]);

  // Persist User & Session
  useEffect(() => {
    if (user) localStorage.setItem('chery_auth_user', JSON.stringify(user));
    else localStorage.removeItem('chery_auth_user');
  }, [user]);

  useEffect(() => {
    if (sessionId) localStorage.setItem('chery_session_id', sessionId);
    else localStorage.removeItem('chery_session_id');
  }, [sessionId]);

  const fetchQueue = React.useCallback(async () => {
    try {
      // Optimasi: Pilih hanya kolom yang dibutuhkan untuk mengurangi data egress
      const { data: activeQueue, error: qError } = await supabase
        .from('antrian')
        .select('*');

      const { data: historyData, error: hError } = await supabase
        .from('history')
        .select('*')
        .order('targetTime', { ascending: false })
        .limit(100);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const bookingDateLimit = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: bookingData, error: bError } = await supabase
        .from('booking')
        .select('*')
        .or(`tanggal.gte.${bookingDateLimit},id.eq.999999`);

      if (qError) throw qError;
      if (hError) throw hError;
      if (bError) throw bError;

      const mapDbToApp = (item) => {
        if (!item) return {};
        return {
          id: item.id,
          bk: item.noPlat || item.no_plat || item.bk,
          tipe: item.tipeMobil || item.tipe_mobil || item.tipe,
          category: item.category || 'Reguler',
          keluhan: item.keluhanDetail || item.keluhan_detail || item.keluhan,
          mechanicName: item.mechanicName || item.mechanic_name || '',
          status: item.status,
          estimasiDefault: item.estimasiDefault || item.estimasi_default || 0,
          addedBy: item.addedBy || item.added_by || item.namaCustomer || item.nama_customer || '',
          checklist: item.checklist || [],
          menginap_reason: item.menginap_reason || '',
          waktuSelesai: item.waktuSelesai || item.waktu_selesai || '',
          targetTime: item.targetTime || item.target_time || 0,
          tanggal: item.Tanggal || item.tanggal,
          jam: item.jam,
          noTelp: item.noTelp || item.no_telp
        };
      };

      setQueue((activeQueue || []).map(mapDbToApp));
      setRawHistory((historyData || []).map(mapDbToApp));
      setBookings((bookingData || []).map(mapDbToApp));
    } catch (error) {
      console.error("Gagal mengambil data operasional Supabase", error);
    }
  }, []);

  // Sinkronisasi dengan Supabase Realtime
  useEffect(() => {
    fetchQueue(); // Ambil data pertama kali

    const antrianSubscription = supabase
      .channel('antrian-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' }, payload => {
        fetchQueue();
      })
      .subscribe();

    const historySubscription = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, payload => {
        fetchQueue();
      })
      .subscribe();

    const bookingSubscription = supabase
      .channel('booking-changes-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, payload => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(antrianSubscription);
      supabase.removeChannel(historySubscription);
      supabase.removeChannel(bookingSubscription);
    };
  }, [fetchQueue]);

  // Fallback Polling: Dikurangi frekuensinya menjadi 60 detik untuk hemat egress
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Update waktu lokal setiap detik untuk countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Simpan status user ke LocalStorage
  useEffect(() => {
    localStorage.setItem('chery_auth_user', JSON.stringify(user));
    if (!user) {
      localStorage.removeItem('chery_session_id');
      setSessionId(null);
    }
  }, [user]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chery_session_id', sessionId);
    }
  }, [sessionId]);

  // ============================================================
  // SINGLE SESSION GUARD — Realtime & Initial Check
  // ============================================================
  useEffect(() => {
    if (!user || !sessionId || currentPage === 'display') return;

    // 1. Verifikasi awal saat mount: Cek apakah sessionId masih valid di DB
    const verifySession = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('sessionId')
        .eq('username', user.username)
        .single();

      if (!error && data && data.sessionId && data.sessionId !== sessionId) {
        handleLogout(true);
        Toastify({
          text: "🔐 Sesi Anda berakhir. Akun ini baru saja login di perangkat lain.",
          duration: 0,
          close: true,
          gravity: 'top',
          position: 'center',
          style: { background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderRadius: '16px', fontWeight: '800' }
        }).showToast();
      }
    };
    verifySession();

    // 2. Realtime Listener: Kick jika ada login baru saat sedang aktif
    const channel = supabase
      .channel(`session-guard-${user.username}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `username=eq.${user.username}`,
        },
        (payload) => {
          const updatedRow = payload.new;
          if (updatedRow.sessionId && updatedRow.sessionId !== sessionId) {
            handleLogout(true);
            Toastify({
              text: `🔐 Sesi Berakhir: Akun Anda baru saja digunakan untuk login di perangkat lain.`,
              duration: 0,
              close: true,
              gravity: 'top',
              position: 'center',
              style: {
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                borderRadius: '16px',
                fontWeight: '800',
                padding: '16px 24px',
                boxShadow: '0 20px 60px rgba(220,38,38,0.4)',
              }
            }).showToast();
            try { new Audio('https://raw.githubusercontent.com/shubhamjain/ios-notification-sounds/master/iphone_notification.mp3').play().catch(() => { }); } catch (e) { }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionId, currentPage]);

  const customSoundUrlRef = React.useRef(null);
  const customSoundChecked = React.useRef(false);

  // Fetch custom notification sound URL on mount
  React.useEffect(() => {
    const fetchCustomSound = async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('key', 'notification_sound_url').maybeSingle();
        if (!error && data && data.value) {
          customSoundUrlRef.current = data.value;
        }

        const { data: soundStatus } = await supabase.from('settings').select('*').eq('key', 'notification_sound_enabled').maybeSingle();
        if (soundStatus) setIsSoundEnabled(soundStatus.value === 'true');
      } catch (e) {
        // Silently skip if table missing or other error
      }
      customSoundChecked.current = true;
    };
    fetchCustomSound();

    // Listen for changes to the settings table
    const settingsChannel = supabase.channel('settings-notif-sound')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new) {
          if (payload.new.key === 'notification_sound_url') {
            customSoundUrlRef.current = payload.new.value || null;
          }
          if (payload.new.key === 'notification_sound_enabled') {
            setIsSoundEnabled(payload.new.value === 'true');
          }
        }
        if (payload.eventType === 'DELETE' && payload.old?.key === 'notification_sound_url') {
          customSoundUrlRef.current = null;
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(settingsChannel); };
  }, []);

  // notification sound function

  const lastPlayedRef = React.useRef(0);
  const playedTextsRef = React.useRef(new Set());

  const playNotificationSound = React.useCallback((textOrBk) => {
    if (!isSoundEnabled || !textOrBk || textOrBk === "Unit" || textOrBk === "undefined") return;

    // Debounce: Cegah suara yang sama bunyi berkali-kali dalam 5 detik
    const now = Date.now();
    if (now - lastPlayedRef.current < 5000 && playedTextsRef.current.has(textOrBk)) return;

    lastPlayedRef.current = now;
    playedTextsRef.current.add(textOrBk);
    setTimeout(() => playedTextsRef.current.delete(textOrBk), 10000);

    try {
      const soundUrl = customSoundUrlRef.current || 'https://raw.githubusercontent.com/shubhamjain/ios-notification-sounds/master/iphone_notification.mp3';
      const audio = new Audio(soundUrl);
      audio.play().then(() => {
        // Voice Notification (TTS)
        if ('speechSynthesis' in window) {
          setTimeout(() => {
            let speakText = textOrBk;
            
            // Logika untuk mendeteksi apakah ini plat nomor atau kalimat utuh
            // Plat nomor biasanya pendek (< 20 karakter) dan jumlah kata sedikit (<= 4)
            const words = textOrBk.trim().split(/\s+/);
            const isPlate = words.length <= 4 && textOrBk.length < 20;

            if (isPlate && !textOrBk.toLowerCase().includes('selesai')) {
              // Format plat nomor agar dibaca per huruf/angka
              const formattedBk = textOrBk.toUpperCase().split('').join(' ');
              speakText = `Antrian selesai. Mobil, ${formattedBk}, telah selesai.`;
            }
            
            const utterance = new SpeechSynthesisUtterance(speakText);
            utterance.lang = 'id-ID';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            
            // Hentikan suara lain yang sedang berjalan agar tidak tumpang tindih
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          }, 1000); // Jeda 1 detik setelah bunyi notifikasi
        }
      }).catch(e => console.warn("Audio autoplay blocked by browser:", e));
    } catch (e) {
      console.error("Audio notification error:", e);
    }
  }, [isSoundEnabled]);

  const lastNotifCheckRef = React.useRef(0);
  const notifiedIds = React.useRef(new Set());
  const notifInitialized = React.useRef(false);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // Check for new completed items — runs whenever rawHistory updates
  useEffect(() => {
    if (rawHistory.length === 0) return;

    // Pertama kali: seed semua ID existing agar tidak trigger notif untuk data lama
    if (!notifInitialized.current) {
      rawHistory.forEach(item => notifiedIds.current.add(item.id));
      notifInitialized.current = true;
      return;
    }

    const todayStr = new Date().toDateString();
    const currentMs = Date.now();

    // Throttling notifikasi untuk hemat resource browser
    if (currentMs - lastNotifCheckRef.current < 2000) return;
    lastNotifCheckRef.current = currentMs;

    const newItems = rawHistory.filter(item => {
      if (notifiedIds.current.has(item.id)) return false;
      try {
        const itemDate = new Date(parseInt(item.id) < 2000000000 ? parseInt(item.id) * 1000 : parseInt(item.id));
        return itemDate.toDateString() === todayStr;
      } catch (e) {
        return false;
      }
    });

    if (newItems.length > 0) {
      newItems.forEach(item => {
        notifiedIds.current.add(item.id);
        playNotificationSound(item.bk);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`✅ Mobil Selesai`, { body: `Mobil ${item.bk} (${item.tipe}) sudah selesai.` });
        }
        Toastify({
          text: `✅ Mobil ${item.bk} (${item.tipe}) sudah selesai.`,
          duration: 10000,
          close: true,
          gravity: "top",
          position: "right",
          style: {
            background: "linear-gradient(135deg, #10b981, #059669)",
            borderRadius: "16px",
            fontWeight: "900",
            boxShadow: "0 20px 40px rgba(16,185,129,0.3)",
            border: "1px solid rgba(255,255,255,0.2)"
          }
        }).showToast();
      });
    }
  }, [rawHistory, playNotificationSound]);

  const isAutoUpdating = useRef(false);

  useEffect(() => {
    const checkAutoStatus = async () => {
      if (isAutoUpdating.current || queue.length === 0) return;

      const nowObj = new Date();
      // Ensure we use Jakarta Time (WIB - GMT+7)
      const utc = nowObj.getTime() + (nowObj.getTimezoneOffset() * 60000);
      const jakartaTime = new Date(utc + (3600000 * 7));

      const currentHour = jakartaTime.getHours();
      const currentMinute = jakartaTime.getMinutes();
      const day = jakartaTime.getDay();

      let targetStatus = null;

      // Checking Overnight (menginap)
      if (currentHour >= 19 || currentHour < 8) {
        targetStatus = 'menginap';
      }
      // Checking Break (istirahat) Senin-Sabtu (1-6)
      else if (day >= 1 && day <= 6) {
        const isFriday = day === 5;
        const startTotalMinutes = (breakSettings.startHour * 60) + breakSettings.startMinute;
        const currentTotalMinutes = (currentHour * 60) + currentMinute;

        let endHour = isFriday ? breakSettings.endHourFriday : breakSettings.endHourNormal;
        let endMin = isFriday ? breakSettings.endMinuteFriday : breakSettings.endMinuteNormal;
        const endTotalMinutes = (endHour * 60) + endMin;

        if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes) {
          targetStatus = 'istirahat';
        }
      }

      if (targetStatus) {
        const toUpdateFiltered = queue.filter(q => {
          if (targetStatus === 'menginap') return q.status !== 'menginap' && q.status !== 'completed';
          if (targetStatus === 'istirahat') return q.status === 'working';
          return false;
        });

        if (toUpdateFiltered.length > 0) {
          isAutoUpdating.current = true;
          try {
            for (const item of toUpdateFiltered) {
              let sisaDetik = parseInt(item.estimasiDefault) || 0;
              if (item.status === 'working') {
                const targetTime = parseInt(item.targetTime) || Date.now();
                sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
              }

              await supabase.from('antrian').update({
                status: targetStatus,
                estimasiDefault: sisaDetik,
                targetTime: 0
              }).eq('id', item.id);
            }
          } catch (e) {
            console.error("AutoStatus Error:", e);
          } finally {
            isAutoUpdating.current = false;
            // Realtime will trigger fetchQueue
          }
        }
      } else {
        // Wake up from Istirahat if break time is over
        const toWakeUp = queue.filter(q => q.status === 'istirahat');
        if (toWakeUp.length > 0) {
          isAutoUpdating.current = true;
          try {
            for (const item of toWakeUp) {
              const sisaDetik = parseInt(item.estimasiDefault) || 0;
              const targetTime = Date.now() + (sisaDetik * 1000);
              await supabase.from('antrian').update({
                status: 'working',
                targetTime: targetTime
              }).eq('id', item.id);
            }
          } catch (e) {
            console.error("WakeUp Error:", e);
          } finally {
            isAutoUpdating.current = false;
            // Realtime will trigger fetchQueue
          }
        }
      }
    };

    // Gunakan interval kecil daripada trigger langsung setiap kali 'queue' berubah 
    // untuk mencegah cascade effect yang terlalu cepat.
    const autoTimer = setTimeout(() => {
      checkAutoStatus();
    }, 2000);

    return () => clearTimeout(autoTimer);
  }, [queue, breakSettings]);

  const fullProcessedQueue = useMemo(() => {
    return queue
      .map(item => {
        // Gunakan estimasiDefault yang sudah di-map di atas
        let diff = parseInt(item.estimasiDefault) || 0;

        const tTime = parseInt(item.target_time || item.targetTime);
        if (item.status === 'working' && tTime > 0) {
          diff = Math.max(0, Math.floor((tTime - now) / 1000));
        }

        return { ...item, estimasi: diff };
      })
      .sort((a, b) => {
        // Prioritas Status: Sedang Dikerjakan (Working) paling atas
        const priorityScore = { working: 1, istirahat: 2, waiting: 3, menginap: 4 };
        const scoreA = priorityScore[a.status] || 99;
        const scoreB = priorityScore[b.status] || 99;

        if (scoreA !== scoreB) return scoreA - scoreB;

        // Kedua: Prioritaskan Kategori Booking
        if (a.category === 'Booking' && b.category !== 'Booking') return -1;
        if (a.category !== 'Booking' && b.category === 'Booking') return 1;

        // Ketiga: Siapa yang datang duluan (ID terkecil)
        return parseInt(a.id) - parseInt(b.id);
      });
  }, [queue, now]);

  const processedQueue = useMemo(() => fullProcessedQueue, [fullProcessedQueue]);

  const configSlot = bookings.find(b => b.id === 999999);
  const maxCount = configSlot ? (parseInt(configSlot.namaCustomer || configSlot.addedBy) || 4) : 4;

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = 'Desktop';
    let browser = 'Unknown';

    // Device Detection
    if (/Android/i.test(ua)) device = 'Android Phone';
    else if (/iPhone/i.test(ua)) device = 'iPhone';
    else if (/iPad/i.test(ua)) device = 'iPad';
    else if (/Windows Phone/i.test(ua)) device = 'Windows Phone';
    else if (/Macintosh/i.test(ua)) device = 'Mac';
    else if (/Windows/i.test(ua)) device = 'Windows PC';
    else if (/Linux/i.test(ua)) device = 'Linux PC';

    // Browser Detection
    if (/Edg\//i.test(ua)) browser = 'Edge';
    return { device, browser };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoadingProcess(true);
    try {
      const cleanUsername = sanitizeInput(loginForm.username);
      const cleanPassword = sanitizeInput(loginForm.password);
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

      const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role, plat_bk, vin')
        .eq('username', cleanUsername)
        .eq('password', cleanPassword)
        .single();

      if (data) {
        const { device, browser } = getDeviceInfo();
        const loginTime = new Date().toLocaleString('id-ID');

        const userData = { 
          name: data.name, 
          username: data.username, 
          role: data.role,
          plat_bk: data.plat_bk,
          vin: data.vin
        };
        const today = new Date().toDateString();

        localStorage.setItem('chery_last_login_date', today);
        setLastLoginDate(today);
        setSessionId(newSessionId);
        setUser(userData);
        setLoginForm({ username: '', password: '' });

        await supabase.from('users').update({
          sessionId: newSessionId,
          lastDevice: device,
          lastBrowser: browser,
          lastLogin: loginTime,
          isOnline: true
        }).eq('username', data.username);

        const targetPage = data.role?.toLowerCase() === 'mekanik' ? 'mechanic' :
          data.role?.toLowerCase() === 'sparepart' ? 'sparepart' :
            data.role?.toLowerCase() === 'cro' ? 'cro' :
              data.role?.toLowerCase() === 'manager' ? 'manager' :
                data.role?.toLowerCase() === 'owner' ? 'owner' : 
                  data.role?.toLowerCase() === 'customer' ? 'customer' :
                    data.role?.toLowerCase() === 'display' ? 'display' :
                    data.role?.toLowerCase() === 'warranty' ? 'warranty' : 'admin';

        const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(data.role?.toLowerCase()) ? '/staff' : 
                          (data.role?.toLowerCase() === 'customer' ? '/customer' : 
                            (data.role?.toLowerCase() === 'display' ? '/display' :
                              (data.role?.toLowerCase() === 'warranty' ? '/staff' : '/karyawan')));
        window.history.pushState({}, '', targetUrl);

        setCurrentPage(targetPage);
        setErrorMessage('');

        // Trigger an immediate check after login (useEffect will handle geo)
        setTimeout(() => window.location.reload(), 100);
      } else {
        setErrorMessage('Username atau Password salah!');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (error) {
      console.error('Login Error:', error);
      setErrorMessage('Gagal terhubung ke server keamanan!');
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleChangePassword = async (oldPassword, newPassword) => {
    const currentUser = usersData.find(u => u.username === user.username);

    if (currentUser?.password !== oldPassword) {
      return { success: false, message: "Password lama salah!" };
    }

    try {
      // Mengirim request penggantian password ke Supabase
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password') // Hapus ID karena mungkin tidak ada primary key bigint di schema user Anda
        .eq('username', user.username)
        .single();

      if (fetchError || !userData) {
        return { success: false, message: "Gagal menemukan data user!" };
      }

      if (userData.password !== oldPassword) {
        return { success: false, message: "Password lama salah!" };
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('username', user.username);

      if (updateError) {
        return { success: false, message: updateError.message || "Gagal mengubah password" };
      }

      return { success: true, message: "Password berhasil diubah!" };
    } catch (error) {
      console.error(error);
      return { success: false, message: "Gagal terhubung ke server database!" };
    }
  };



  const handleSave = async (e) => {
    e.preventDefault();
    if (isLoadingProcess) return;

    const totalSeconds = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);

    // VALIDASI: BK dan Tipe tidak boleh kosong
    if (!formData.bk.trim() || !formData.tipe) {
      setErrorMessage("Nomor Polisi dan Tipe Unit wajib diisi!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    if (!isEditing && totalSeconds < 1800) {
      setErrorMessage("Waktu minimal pengerjaan adalah 30 menit!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    setIsLoadingProcess(true);

    let updates = {
      bk: formData.bk.toUpperCase().replace(/\s+/g, ''),
      tipe: formData.tipe,
      category: formData.category,
      keluhan: sanitizeInput(formData.keluhan || ''),
      checklist: formData.checklist || [],
      menginap_reason: formData.menginap_reason || '',
    };

    const mechanicValue = formData.mechanicName || '';
    const addedByValue = user?.name || user?.username || 'System';

    if (isEditing) {
      updates.id = formData.id;
      if (formData.status === 'working') {
        const newTargetTime = Date.now() + (totalSeconds * 1000);
        updates.targetTime = newTargetTime;
        updates.estimasiDefault = totalSeconds;
      } else {
        updates.estimasiDefault = totalSeconds;
        updates.targetTime = 0;
      }
      updates.mechanicName = mechanicValue;
    } else {
      updates.id = Math.floor(Date.now() / 1000);
      updates.status = 'waiting';
      updates.addedBy = addedByValue;
      updates.estimasiDefault = totalSeconds;
      updates.targetTime = 0;
      updates.mechanicName = mechanicValue;
    }

    try {
      if (isEditing) {
        // Try updating antrian first
        const { error, count } = await supabase.from('antrian').update(updates).eq('id', formData.id).select();

        // If not in antrian or update failed, try history (mostly for Owner editing completed units)
        if (!error && (!count || count.length === 0)) {
          // History table may not have all columns (e.g. checklist), so only send safe fields
          const historyUpdates = { ...updates };
          delete historyUpdates.checklist;
          delete historyUpdates.targetTime;
          delete historyUpdates.menginap_reason;
          const { error: hError } = await supabase.from('history').update(historyUpdates).eq('id', formData.id);
          if (hError) throw hError;
        } else if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('antrian').insert(updates);
        if (error) throw error;
      }

      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [], menginap_reason: '' });
      setIsEditing(false);
    } catch (error) {
      console.error("Gagal menyimpan data", error);
      setErrorMessage("Gagal menyimpan data ke Supabase");
      setTimeout(() => setErrorMessage(""), 3000);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const deleteItem = async (id) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      await supabase.from('antrian').delete().eq('id', id);
      await supabase.from('history').delete().eq('id', id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const clearQueue = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua antrean?")) {
      if (isLoadingProcess) return;
      setIsLoadingProcess(true);
      try {
        await supabase.from('antrian').delete().neq('id', 0);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingProcess(false);
      }
    }
  };

  const handleStartWork = async (item) => {
    if (!user || user.role?.toLowerCase() !== 'mekanik' || isLoadingProcess) return;

    if (item.status === 'menginap' && item.mechanicName && item.mechanicName !== user.name) {
      alert("Hanya mekanik yang mengerjakan sebelumnya yang bisa melanjutkan! Jika belum ada penugasan, silakan hubungi Admin.");
      return;
    }

    setIsLoadingProcess(true);

    const estimasiDefaultInt = parseInt(item.estimasiDefault) || 1800;
    const targetTime = Date.now() + (estimasiDefaultInt * 1000);

    try {
      await supabase.from('antrian').update({
        status: 'working',
        targetTime: targetTime, // Disesuaikan
        mechanicName: user.name // Disesuaikan
      }).eq('id', item.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleSetOvernight = async (item, reason = '') => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    let sisaDetik = parseInt(item.estimasiDefault) || 0;
    if (item.status === 'working') {
      const targetTime = parseInt(item.targetTime) || Date.now();
      sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    }

    try {
      const updateData = {
        status: 'menginap',
        estimasiDefault: sisaDetik,
        targetTime: 0,
        mechanicName: item.mechanicName || ''
      };

      if (reason) updateData.menginap_reason = reason;

      const { error } = await supabase.from('antrian').update(updateData).eq('id', item.id);
      if (error) {
        if (error.code === 'PGRST204') {
          // Jika kolom tidak ada, coba update tanpa kolom tersebut sebagai fallback
          delete updateData.menginap_reason;
          await supabase.from('antrian').update(updateData).eq('id', item.id);
          Toastify({
            text: "⚠️ Fitur Alasan Menginap belum aktif di Database. Silakan tambah kolom 'menginap_reason' di Supabase.",
            style: { background: '#f59e0b' }
          }).showToast();
        } else {
          throw error;
        }
      } else {
        Toastify({ text: "✅ Unit berhasil diset MENGINAP!", style: { background: '#9333ea' } }).showToast();
      }
    } catch (err) {
      console.error(err);
      Toastify({ text: "Gagal menyetel status menginap", style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleUpdateChecklist = async (id, newChecklist) => {
    try {
      // Optimistic Update: Update local state immediately so user sees the change instantly
      setQueue(prev => prev.map(q => q.id === id ? { ...q, checklist: newChecklist } : q));

      const { error } = await supabase.from('antrian').update({
        checklist: newChecklist
      }).eq('id', id);

      if (error) {
        // Revert if error? For now just log
        if (error.code === 'PGRST204') {
          Toastify({ text: "⚠️ Fitur Task belum aktif. Silakan tambah kolom 'checklist' di Supabase.", style: { background: '#f59e0b' } }).showToast();
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error("Gagal update checklist:", err);
    }
  };

  const handleAddTask = async (item, taskText) => {
    const currentChecklist = Array.isArray(item.checklist) ? item.checklist : [];
    const newChecklist = [...currentChecklist, { id: Date.now(), text: taskText, completed: false }];
    await handleUpdateChecklist(item.id, newChecklist);
  };

  const handleRemoveTask = async (item, taskId) => {
    const currentChecklist = Array.isArray(item.checklist) ? item.checklist : [];
    const newChecklist = currentChecklist.filter(t => t.id !== taskId);
    await handleUpdateChecklist(item.id, newChecklist);
  };

  const handleToggleTask = async (item, taskId) => {
    const currentChecklist = Array.isArray(item.checklist) ? item.checklist : [];
    const newChecklist = currentChecklist.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    await handleUpdateChecklist(item.id, newChecklist);
  };

  const handleCancelOvernight = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    try {
      await supabase.from('antrian').update({
        status: 'waiting',
        targetTime: 0
      }).eq('id', item.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleComplete = async (item) => {
    if (isLoadingProcess) return;

    // VALIDASI CHECKLIST: Semua task harus selesai sebelum complete pengerjaan
    const checklist = Array.isArray(item.checklist) ? item.checklist : [];
    const isAllDone = checklist.every(t => t.completed);

    if (checklist.length > 0 && !isAllDone) {
      const unfinishedTasks = checklist.filter(t => !t.completed).map(t => t.text || "Tugas tanpa nama");
      const errorText = unfinishedTasks.length > 0
        ? `⚠️ PEKERJAAN BELUM SELESAI: ${unfinishedTasks.join(', ')}`
        : "⚠️ GAGAL SELESAI: Masih ada checklist yang belum tercentang!";

      Toastify({
        text: errorText,
        duration: 6000,
        gravity: "top",
        position: "center",
        style: {
          background: "linear-gradient(135deg, #e11d48, #be123c)",
          padding: "16px 24px",
          fontWeight: "900",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(225,29,72,0.4)",
          fontSize: "14px",
          maxWidth: "400px",
          textAlign: "center"
        }
      }).showToast();
      try { new Audio('https://raw.githubusercontent.com/shubhamjain/ios-notification-sounds/master/iphone_notification.mp3').play().catch(() => { }); } catch (e) { }
      return;
    }

    if (!window.confirm(`Selesaikan pengerjaan unit ${item.bk}?`)) return;

    setIsLoadingProcess(true);
    try {
      const now = new Date();
      // Ensure Jakarta time for string dates
      const jakartaNow = new Date(now.getTime() + (7 * 3600000));

      const itemIdNum = parseInt(item.id);
      const waktuMasukMs = itemIdNum < 2000000000 ? itemIdNum * 1000 : itemIdNum;
      const waktuMasukDate = new Date(waktuMasukMs);
      const waktuSelesaiDate = now;

      // Hitung durasi
      const selisihMs = waktuSelesaiDate.getTime() - waktuMasukDate.getTime();
      const selisihMenit = Math.max(0, Math.round(selisihMs / 60000));
      const jamKerja = Math.floor(selisihMenit / 60);
      const menitKerja = selisihMenit % 60;
      const jarakWaktuStr = jamKerja > 0
        ? `${jamKerja} jam ${menitKerja} menit`
        : `${menitKerja} menit`;

      const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const bulanStr = namaBulan[now.getMonth()];
      const tanggalISO = now.toISOString().split('T')[0];

      // 1. Insert into history
      const historyData = {
        id: item.id,
        bk: item.bk,
        tipe: item.tipe,
        category: item.category,
        keluhan: item.keluhan,
        checklist: checklist,
        mechanicName: item.mechanicName || '',
        status: 'completed',
        estimasiDefault: item.estimasiDefault,
        targetTime: Date.now(),
        addedBy: item.addedBy || '',
        Tanggal: tanggalISO,
        waktuMasuk: waktuMasukDate.toLocaleString('id-ID', { hour12: false }),
        waktuSelesai: waktuSelesaiDate.toLocaleString('id-ID', { hour12: false }),
        'Jarak Waktu': jarakWaktuStr,
        Bulan: bulanStr,
      };

      const { error: insertError } = await supabase.from('history').insert(historyData);

      if (insertError) {
        // Jika error "Conflict" (ID sudah ada), hapus saja dari antrian & anggap sukses
        if (insertError.code === '23505' || insertError.status === 409) {
          console.warn("Item ini sudah ada di history, melanjutkan pembersihan antrian...");
        }
        // Fallback jika kolom checklist belum ada di tabel history Supabase
        else if (insertError.code === 'PGRST204' || (insertError.message && insertError.message.includes('checklist'))) {
          console.warn("Kolom 'checklist' tidak ditemukan di tabel history, mencoba simpan tanpa checklist...");
          const { checklist: _, ...restHistory } = historyData;
          if (checklist.length > 0) {
            const checklistSummary = checklist.map(t => `${t.completed ? '✅' : '❌'} ${t.text}`).join('\n');
            restHistory.keluhan = (restHistory.keluhan ? restHistory.keluhan + '\n\n' : '') + "--- CHECKLIST ---\n" + checklistSummary;
          }

          const { error: retryError } = await supabase.from('history').insert(restHistory);
          if (retryError && retryError.code !== '23505') {
            console.error("Retry Error:", retryError);
            throw new Error(`Database Error (History Retry): ${retryError.message}`);
          }
        } else {
          console.error("History Insert Error:", insertError);
          throw new Error(`Database Error (History): ${insertError.message}`);
        }
      }

      // 2. Delete from antrian
      const { error: deleteError } = await supabase.from('antrian').delete().eq('id', item.id);
      if (deleteError) {
        console.error("Antrian Delete Error:", deleteError);
        throw new Error(`Database Error (Antrian): ${deleteError.message}`);
      }

      // 3. Sync to CRO Table (Customer Relation Officer)
      try {
        const croData = {
          workOrderNo: String(item.id).substring(0, 15),
          nama: item.addedBy || 'Pelanggan Workshop',
          telepon: item.noTelp || '-',
          vin: '-',
          plat: item.bk,
          serviceAdvisor: item.addedBy || '-',
          tipeMobil: item.tipe,
          deskripsi: `• ${item.keluhan || 'Perbaikan Workshop'}`,
          tanggalDatang: tanggalISO.split('-').reverse().join('-'), // format DD-MM-YYYY
          status: 'Belum',
          respon: '',
          lampiran: '[]'
        };
        await supabase.from('cro').insert(croData);
      } catch (e) {
        console.error("CRO Sync Error (Non-Fatal):", e);
      }

      Toastify({
        text: `✅ Berhasil Menyelesaikan Pekerjaan: ${item.bk}`,
        duration: 3000,
        style: { background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "12px" }
      }).showToast();

      // Triggering sound is now handled globally via the rawHistory useEffect listener
      // to prevent double sound (local + server sync).

    } catch (err) {
      console.error("Execution Error:", err);
      Toastify({
        text: `❌ GAGAL: ${err.message || "Terjadi kesalahan sistem"}`,
        duration: 10000,
        close: true,
        style: { background: "#dc2626", borderRadius: "12px" }
      }).showToast();
      setErrorMessage("Gagal menyelesaikan antrean.");
      setTimeout(() => setErrorMessage(""), 3000);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const editItem = (item) => {
    // Saat edit, kita hitung ulang jam/menit/detik dari sisa estimasi saat ini
    setFormData({
      ...item,
      jam: Math.floor(item.estimasi / 3600),
      menit: Math.floor((item.estimasi % 3600) / 60),
      detik: item.estimasi % 60,
      mechanicName: item.mechanicName || '',
      checklist: item.checklist || [],
      menginap_reason: item.menginap_reason || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [], menginap_reason: '' });
    setIsEditing(false);
  };

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (IS_MAINTENANCE && !isLocal) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="relative w-full max-w-lg">
          {/* Decorative Orbs */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

          <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] shadow-2xl text-center overflow-hidden">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-white/5">
                <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-400">404</span>
              </div>

              <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
                Page Not Found
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-xs mx-auto">
                Not Available
              </p>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8"></div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500">Lexx</span>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine if navbars should be shown
  const showNavbar = currentPage !== 'login' && user?.role?.toLowerCase() !== 'display';
  // Check if on a dashboard page (not public)
  const publicPages = ['display', 'booking-public', 'tracking-public', 'login'];
  const isOnDashboard = user && !publicPages.includes(currentPage);
  const hasSidebarItems = user && getNavItems(user.role?.toLowerCase()).length > 0;

  return (
    <div className={`bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased h-screen flex flex-col relative transition-colors duration-500 overflow-hidden ${showNavbar ? 'pb-[64px] md:pb-0' : ''} ${isOnDashboard && hasSidebarItems ? 'pt-14 md:pt-0' : ''}`}>

      {/* Universal Navigation - same navbar for all pages (public & logged in) */}
      {showNavbar && (
        <PublicNavBar
          user={user}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onLogout={handleLogout}
        />
      )}

      {/* Loading Indicator untuk Proses Remote API */}
      {isLoadingProcess && (
        <div className="fixed top-4 right-4 z-[9999] bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
          Processing...
        </div>
      )}

      {/* Render Pages - Full screen scrollable area */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden ${showNavbar ? 'md:ml-[220px]' : ''}`}>
      {currentPage === 'display' && (
        <DisplayBoard
          processedQueue={processedQueue}
          queueLength={queue.length}
          formatTime={formatTime}
          user={user}
          onStartWork={handleStartWork}
          onComplete={handleComplete}
          onToggleTask={handleToggleTask}
          onSetOvernight={handleSetOvernight}
          onCancelOvernight={handleCancelOvernight}
          onLogoDoubleClick={() => setCurrentPage('login')}
          rawHistory={rawHistory}
          bookings={bookings}
        />
      )}

      {/* Logout button for display role — small button bottom-right */}
      {currentPage === 'display' && user?.role?.toLowerCase() === 'display' && (
        <button
          onClick={() => handleLogout()}
          className="fixed bottom-4 right-4 z-[100] bg-zinc-900/80 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-lg transition-all duration-200 opacity-30 hover:opacity-100"
          aria-label="Logout"
        >
          Logout
        </button>
      )}
      {currentPage === 'login' && <LoginPage loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} errorMessage={errorMessage} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} queue={fullProcessedQueue} rawHistory={rawHistory} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} handleCancelEdit={handleCancelEdit} formData={formData} setFormData={setFormData} isEditing={isEditing} setIsEditing={setIsEditing} errorMessage={errorMessage} isLoadingProcess={isLoadingProcess} formatTime={formatTime} handleComplete={handleComplete} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} breakSettings={breakSettings} setBreakSettings={setBreakSettings} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} playNotificationSound={playNotificationSound} activeTab="dashboard" />}
      {currentPage === 'admin-booking' && <AdminPanel user={user} handleLogout={handleLogout} queue={fullProcessedQueue} rawHistory={rawHistory} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} handleCancelEdit={handleCancelEdit} formData={formData} setFormData={setFormData} isEditing={isEditing} setIsEditing={setIsEditing} errorMessage={errorMessage} isLoadingProcess={isLoadingProcess} formatTime={formatTime} handleComplete={handleComplete} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} breakSettings={breakSettings} setBreakSettings={setBreakSettings} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} playNotificationSound={playNotificationSound} activeTab="booking" />}
      {currentPage === 'mechanic' && (
        <MechanicPanel
          user={user}
          handleLogout={handleLogout}
          handleChangePassword={handleChangePassword}
          rawHistory={rawHistory}
          queue={fullProcessedQueue}
          formatTime={formatTime}
          isLoadingProcess={isLoadingProcess}
          onStartWork={handleStartWork}
          onComplete={handleComplete}
          onToggleTask={handleToggleTask}
          onSetOvernight={handleSetOvernight}
          onCancelOvernight={handleCancelOvernight}
        />
      )}
      {currentPage === 'sparepart' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} setCurrentPage={setCurrentPage} activeTab="input" />}
      {currentPage === 'sparepart-view' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} setCurrentPage={setCurrentPage} activeTab="view" />}
      {currentPage === 'sparepart-quotation' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} setCurrentPage={setCurrentPage} activeTab="quotation" />}
      {currentPage === 'sparepart-profit' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} setCurrentPage={setCurrentPage} activeTab="profit" />}
      {currentPage === 'quotation' && <QuotationSPA />}
      {currentPage === 'booking_manager' && <BookingManager user={user} handleLogout={handleLogout} isNavbarVisible={true} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />}
      {currentPage === 'cro' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="belum" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-sudah' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="sudah" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-freeservice' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="free_service" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-laporan' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="laporan" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-booking' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="booking" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-holidays' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} initialTab="holidays" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'booking-public' && <PublicBooking user={user} />}
      {currentPage === 'promo' && <PromosiSparepart />}
      {currentPage === 'manager' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="performance" />}
      {currentPage === 'manager-financial' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="financial" />}
      {currentPage === 'manager-wo' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="wo_tracking" />}
      {currentPage === 'manager-vehicles' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="vehicles" />}
      {currentPage === 'manager-cro' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="cro_history" />}
      {currentPage === 'manager-holidays' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="holidays" />}
      {currentPage === 'manager-staff' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="staff" />}
      {currentPage === 'owner' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="monitoring" />
      )}
      {currentPage === 'owner-workshop' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="workshop" />
      )}
      {currentPage === 'owner-dms' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="dms_search" />
      )}
      {currentPage === 'owner-warranty' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="warranty_search" />
      )}
      {currentPage === 'owner-parts' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="part_orders" />
      )}
      {currentPage === 'owner-users' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="users" />
      )}
      {currentPage === 'owner-sound' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="notification_sound" />
      )}
      {currentPage === 'owner-deleted' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={setCurrentPage} activeTab="deleted_bookings" />
      )}
      {currentPage === 'stock-comparison' && (
        <StockComparison user={user} setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'warranty' && <WarrantyHub activeTab="dashboard" />}
      {currentPage === 'warranty-wo' && <WarrantyHub activeTab="wo" />}
      {currentPage === 'warranty-search' && <WarrantyHub activeTab="search" />}
      {currentPage === 'warranty-proforma' && <ProformaInvoice />}
      {currentPage === 'register' && (
        <RegisterPage 
          setCurrentPage={setCurrentPage} 
          setErrorMessage={setErrorMessage} 
          errorMessage={errorMessage} 
        />
      )}
      {currentPage === 'tracking-public' && (
        <PublicTracking setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'customer' && user?.role === 'customer' && (
        !user.plat_bk ? (
          <CustomerProfile user={user} setUser={setUser} />
        ) : (
          <CustomerPanel user={user} handleLogout={handleLogout} />
        )
      )}

      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }
        .animate-pulse-subtle { animation: pulse-subtle 3s ease-in-out infinite; }
      `}</style>

      {/* Logout is now inside the sidebar menu */}
    </div>
  );
};

export default App;