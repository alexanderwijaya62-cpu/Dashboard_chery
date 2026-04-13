import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings, Calendar, Plus, Zap, FileText } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

import { API_KEY, GAS_URL, GAS_USERS_URL } from './utils/config';
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
import { USERS } from './data/users';

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

const App = () => {
  // --- 1. STATE DEFINITIONS ---
  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('chery_current_page') || 'display';
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chery_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('chery_session_id') || null;
  });
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
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

  // Refs
  const navbarTimerRef = useRef(null);

  // --- 2. EFFECTS & LOGIC ---
  useEffect(() => {
    localStorage.setItem('chery_current_page', currentPage);
    // Munculkan navbar setiap ganti halaman
    setIsNavbarVisible(true);
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
          } catch(e) {}

          // Provider 2: ipapi.co (Fallback)
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.latitude) return {
              ip: data.ip,
              loc: `${data.city || ''}, ${data.region || ''}`,
              coords: `${data.latitude}, ${data.longitude}`
            };
          } catch(e) {}

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
    if (user) {
      try {
        await supabase
          .from('users')
          .update({ isOnline: false, sessionId: null })
          .eq('username', user.username);
      } catch (err) {
        console.error("Gagal update status logout:", err);
      }
    }

    setUser(null);
    setSessionId(null);
    setCurrentPage('display');
    
    // Reset URL to the main public domain
    window.history.pushState({}, '', '/');
    
    if (!isForced) {
      Toastify({ text: "✅ Berhasil Logout", style: { background: "#10b981" } }).showToast();
    }
  };

  // Handle Pseudo-Routing ( Guards & Redirects )
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const savedUser = localStorage.getItem('chery_auth_user');
    
    // 1. PUBLIC ROUTES (No Login Required)
    const publicPaths = ['/', '/display', '/board', '/booking', '/public'];
    if (publicPaths.includes(path)) {
      if (savedUser && savedUser !== 'null') {
        // Redir ke staff/karyawan jika refresh di root tapi sudah login
        const u = JSON.parse(savedUser);
        if (u && u.role) {
          const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(u.role.toLowerCase()) ? '/staff' : '/karyawan';
          window.history.replaceState({}, '', targetUrl);
        } else {
          setCurrentPage('display');
          return;
        }
        // Lanjutkan ke bagian ROLE-BASED ACCESS
      } else {
        if (path === '/booking' || path === '/public') {
          setCurrentPage('booking-public');
        } else {
          setCurrentPage('display');
        }
        return;
      }
    }
    
    // 2. LOGIN PAGE 
    if (path === '/login') {
      if (savedUser && savedUser !== 'null') {
        const u = JSON.parse(savedUser);
        if (u && u.role) {
          const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(u.role.toLowerCase()) ? '/staff' : '/karyawan';
          window.history.replaceState({}, '', targetUrl);
          window.location.reload(); 
        }
      } else {
        setCurrentPage('login');
      }
      return;
    }

    // 3. PROTECTED ROUTES (Requires Login)
    if (!savedUser) {
      if (!publicPaths.includes(path)) {
          setCurrentPage('login');
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
      if (['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(role)) {
        const allowedPages = {
          admin: ['admin', 'promo', 'display', 'booking-public'],
          manager: ['manager', 'display', 'booking-public'],
          cro: ['cro', 'cro-booking', 'display', 'booking-public'],
          sparepart: ['sparepart', 'quotation', 'display', 'booking-public'],
          owner: ['owner', 'display', 'booking-public']
        };

        if (savedPage && allowedPages[role]?.includes(savedPage)) {
          setCurrentPage(savedPage);
        } else {
          setCurrentPage(role === 'cro' ? 'cro' : role);
        }
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
      const defaultPath = ['mekanik'].includes(role) ? '/karyawan' : '/staff';
      window.history.replaceState({}, '', defaultPath);
      
      if (savedPage && (
        (role === 'mekanik' && savedPage === 'mechanic') ||
        (['admin', 'manager', 'cro', 'sparepart', 'owner'].includes(role))
      )) {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage(role === 'mekanik' ? 'mechanic' : (role === 'cro' ? 'cro' : role));
      }
    }
  }, []);

  // REDIRECT dari Vercel ke Custom Domain
  useEffect(() => {
    if (window.location.hostname.endsWith('.vercel.app')) {
      window.location.replace('https://cherymedan.web.id' + window.location.pathname + window.location.search);
    }
  }, []);
  const resetNavbarTimer = useCallback(() => {
    if (navbarTimerRef.current) clearTimeout(navbarTimerRef.current);
    
    // Navbar tetap muncul di Board & Public Booking jika berada di posisi paling atas
    if (currentPage === 'display' || currentPage === 'booking-public') {
        return;
    }

    navbarTimerRef.current = setTimeout(() => {
      setIsNavbarVisible(false);
    }, 2000);
  }, [currentPage]);

  useEffect(() => {
    if (isNavbarVisible && isAtTop) {
      resetNavbarTimer();
    }
    return () => {
      if (navbarTimerRef.current) clearTimeout(navbarTimerRef.current);
    };
  }, [isNavbarVisible, isAtTop, resetNavbarTimer]);

  // Monitor scroll position
  useEffect(() => {
    const handleScroll = () => {
      const atTop = window.scrollY < 20;
      setIsAtTop(atTop);
      if (!atTop) setIsNavbarVisible(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      const { data: activeQueue, error: qError } = await supabase
        .from('antrian')
        .select('*');

      const { data: historyData, error: hError } = await supabase
        .from('history')
        .select('*')
        .order('targetTime', { ascending: false })
        .limit(200);

      const { data: bookingData, error: bError } = await supabase
        .from('booking')
        .select('*');

      if (qError) throw qError;
      if (hError) throw hError;
      if (bError) throw bError;

      const mapDbToApp = (item) => {
        if (!item) return {};
        return {
          id: item.id,
          bk: item.noPlat || item.no_plat || item.bk,
          tipe: item.tipeMobil || item.tipe_mobil || item.tipe,
          category: item.category || 'Reguler', // Default ke Reguler jika kolom category kosong atau null
          keluhan: item.keluhanDetail || item.keluhan_detail || item.keluhan,
          mechanicName: item.mechanicName || item.mechanic_name || '',
          status: item.status,
          estimasiDefault: item.estimasi_default || item.estimasiDefault || 0,
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
      setBookings((bookingData || []).filter(b => b.id !== 999999).map(mapDbToApp));
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
            try { new Audio('https://raw.githubusercontent.com/shubhamjain/ios-notification-sounds/master/iphone_notification.mp3').play().catch(() => {}); } catch (e) {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionId, currentPage]);

  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const playNotificationSound = React.useCallback(() => {
    try {
      const audio = new Audio('https://raw.githubusercontent.com/shubhamjain/ios-notification-sounds/master/iphone_notification.mp3');
      audio.volume = 1.0;
      audio.play().catch(e => console.error("Audio play prevented:", e));
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // Initial populate notifiedIds from rawHistory
  useEffect(() => {
    if (rawHistory.length > 0 && notifiedIds.size === 0) {
      setNotifiedIds(new Set(rawHistory.map(item => item.id)));
    }
  }, [rawHistory, notifiedIds.size]);

  // Check for new completed items
  useEffect(() => {
    if (rawHistory.length > 0 && notifiedIds.size > 0) {
      const todayStr = new Date().toDateString();
      const newItems = rawHistory.filter(item => {
        const isNotified = notifiedIds.has(item.id);
        if (isNotified) return false;
        
        // Cek apakah item ini selesai hari ini (id adalah timestamp)
        try {
          const itemDate = new Date(parseInt(item.id) * 1000); // ID adalah unix seconds
          return itemDate.toDateString() === todayStr;
        } catch (e) {
          return false;
        }
      });

      if (newItems.length > 0) {
        // Mainkan suara notifikasi
        playNotificationSound();

        newItems.forEach(item => {
          // Push Notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`✅ Mobil Selesai`, { body: `Mobil BK ${item.bk} (${item.tipe}) sudah selesai.` });
          }
          // In-app Notification
          Toastify({
            text: `✅ Mobil BK ${item.bk} (${item.tipe}) sudah selesai.`,
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

        // Update notifiedIds agar tidak berulang
        setNotifiedIds(prev => {
          const next = new Set(prev);
          newItems.forEach(item => next.add(item.id));
          return next;
        });
      }
    }
  }, [rawHistory, notifiedIds, playNotificationSound]);

  const isAutoUpdating = useRef(false);

  useEffect(() => {
    const checkAutoStatus = async () => {
      if (isAutoUpdating.current) return;

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
          if (targetStatus === 'menginap') return q.status !== 'menginap';
          if (targetStatus === 'istirahat') return q.status === 'working';
          return false;
        });

        if (toUpdateFiltered.length > 0) {
          isAutoUpdating.current = true;
          for (const item of toUpdateFiltered) {
            let sisaDetik = parseInt(item.estimasiDefault) || 0;
            if (item.status === 'working') {
              const targetTime = parseInt(item.targetTime) || Date.now();
              sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
            }
            try {
              await supabase.from('antrian').update({
                status: targetStatus,
                estimasiDefault: sisaDetik, // Disesuaikan
                mechanicName: item.mechanicName || '', // Disesuaikan
                targetTime: 0 // Disesuaikan
              }).eq('id', item.id);
            } catch (e) {
              console.error(e);
            }
          }
          fetchQueue();
          isAutoUpdating.current = false;
        }
      } else {
        // Wake up from Istirahat if break time is over
        const toWakeUp = queue.filter(q => q.status === 'istirahat');
        if (toWakeUp.length > 0) {
          isAutoUpdating.current = true;
          for (const item of toWakeUp) {
            const sisaDetik = parseInt(item.estimasiDefault) || 0;
            const targetTime = Date.now() + (sisaDetik * 1000);
            try {
              await supabase.from('antrian').update({
                status: 'working',
                targetTime: targetTime, // Disesuaikan
                mechanicName: item.mechanicName || '' // Disesuaikan
              }).eq('id', item.id);
            } catch (e) { }
          }
          fetchQueue();
          isAutoUpdating.current = false;
        }
      }
    };
    if (queue.length > 0) {
      checkAutoStatus();
    }
  }, [queue, fetchQueue, breakSettings]);

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
        .select('id, username, name, role')
        .eq('username', cleanUsername)
        .eq('password', cleanPassword)
        .single();

      if (data) {
        const { device, browser } = getDeviceInfo();
        const loginTime = new Date().toLocaleString('id-ID');

        const userData = { name: data.name, username: data.username, role: data.role };
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
                data.role?.toLowerCase() === 'owner' ? 'owner' : 'admin';
        
        const targetUrl = ['admin', 'manager', 'cro', 'sparepart'].includes(data.role?.toLowerCase()) ? '/staff' : '/karyawan';
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
        const { error } = await supabase.from('antrian').update(updates).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('antrian').insert(updates);
        if (error) throw error;
      }

      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [] });
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
      Toastify({
        text: "⚠️ GAGAL SELESAI: Masih ada keluhan/maintenance yang belum tercentang!",
        duration: 4000,
        gravity: "top",
        position: "center",
        style: { background: "#e11d48", fontWeight: "black" }
      }).showToast();
      return;
    }

    setIsLoadingProcess(true);
    try {
      // 1. Insert into history (Sesuaikan Nama Kolom & Tambah WaktuSelesai)
      const { error: insertError } = await supabase.from('history').insert({
        id: item.id,
        bk: item.bk,
        tipe: item.tipe,
        category: item.category,
        keluhan: item.keluhan,
        mechanicName: item.mechanicName || '',
        status: 'completed',
        estimasiDefault: item.estimasiDefault,
        targetTime: Date.now(),
        addedBy: item.addedBy || '',
        Tanggal: Date.now(), // Gunakan timestamp (bigint) agar sesuai dengan skema database
        waktuMasuk: new Date(parseInt(item.id) < 2000000000 ? item.id * 1000 : item.id).toLocaleString(),
        waktuSelesai: new Date().toLocaleString('id-ID')
      });
      if (insertError) throw insertError;

      // 2. Delete from antrian
      const { error: deleteError } = await supabase.from('antrian').delete().eq('id', item.id);
      if (deleteError) throw deleteError;

    } catch (err) {
      console.error(err);
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
      checklist: item.checklist || []
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [] });
    setIsEditing(false);
  };

  return (
    <div className={`bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased min-h-screen flex flex-col relative transition-colors duration-500 ${['login', 'promo', 'booking-public'].includes(currentPage) ? 'pt-14 pb-20' : 'pt-0 pb-0'}`}>
      {/* Navbar Marker di Mobile: Muncul saat di atas */}
      {isAtTop && (
        <div className="md:hidden fixed top-0 left-1/2 -translate-x-1/2 z-[150] w-12 h-1.5 bg-zinc-300 rounded-b-full pointer-events-none opacity-50 animate-pulse"></div>
      )}

      {/* Navbar Container: Pointer events none agar tidak menghalangi menu di bawahnya */}
      <div
        className="fixed top-0 left-0 w-full z-[100] h-14 md:h-2 pointer-events-none"
      >
        {/* Detection trigger (invisible but clickable/hoverable) */}
        <div
          onMouseEnter={() => {
            if (isAtTop) {
              setIsNavbarVisible(true);
              if (navbarTimerRef.current) clearTimeout(navbarTimerRef.current);
            }
          }}
          onMouseLeave={() => isAtTop && isNavbarVisible && resetNavbarTimer()}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-full pointer-events-auto cursor-pointer"
          onClick={() => isAtTop && setIsNavbarVisible(!isNavbarVisible)}
        />

        <nav
          onMouseEnter={() => { if (navbarTimerRef.current) clearTimeout(navbarTimerRef.current); }}
          onMouseLeave={() => isAtTop && isNavbarVisible && resetNavbarTimer()}
          className={`fixed top-4 left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-500 ease-out z-[101] pointer-events-auto ${isNavbarVisible && isAtTop ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-12 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="bg-white/70 backdrop-blur-2xl border border-white/40 p-1.5 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-1.5 no-scrollbar overflow-x-auto max-w-[95vw]">
            <div className="flex items-center gap-1 flex-nowrap shrink-0">
              <button onClick={() => setCurrentPage('display')}
                className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'display' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                <LayoutDashboard size={14} className="shrink-0" /> <span>Board</span>
              </button>

              <button onClick={() => setCurrentPage('booking-public')}
                className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'booking-public' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                <Calendar size={14} className="shrink-0" /> <span>Booking</span>
              </button>

              <div className="w-[1px] h-6 bg-zinc-200/50 mx-1 shrink-0"></div>

              {user?.role?.toLowerCase() === 'mekanik' ? (
                <button onClick={() => setCurrentPage('mechanic')}
                  className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'mechanic' ? 'bg-white text-zinc-900 shadow-lg border border-zinc-100' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                  <Settings size={14} className="shrink-0" /> <span>Profile</span>
                </button>
              ) : (
                <button onClick={() => {
                  if (user) {
                    if (user.role === 'sparepart') setCurrentPage('sparepart');
                    else if (user.role === 'cro') setCurrentPage('cro');
                    else if (user.role === 'manager') setCurrentPage('manager');
                    else if (user.role === 'owner') setCurrentPage('owner');
                    else setCurrentPage('admin');
                  } else {
                    setCurrentPage('login');
                    window.history.pushState({}, '', '/login');
                  }
                }}
                  className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${['admin', 'login', 'sparepart', 'cro', 'manager', 'owner'].includes(currentPage) ? 'bg-white text-zinc-900 shadow-md border border-zinc-100' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                  <Settings size={14} className="shrink-0" />
                  <span>
                    {user?.role === 'sparepart' ? 'Sparepart' : user?.role === 'cro' ? 'Follow Up' : user?.role === 'manager' ? 'Management' : user?.role === 'owner' ? 'Owner' : user ? 'Admin' : 'Login'}
                  </span>
                </button>
              )}


              {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cro') && (
                <>
                  <div className="w-[1px] h-6 bg-zinc-200/50 mx-1 shrink-0"></div>
                  {user?.role === 'admin' && (
                    <button onClick={() => setCurrentPage('promo')}
                      className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'promo' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                      Promo
                    </button>
                  )}
                  {user?.role === 'manager' && (
                    <button onClick={() => setCurrentPage('manager')}
                      className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'manager' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                      Report
                    </button>
                  )}
                </>
              )}
              {user?.role?.toLowerCase() === 'sparepart' && (
                <>
                  <div className="w-[1px] h-6 bg-zinc-200/50 mx-1 shrink-0"></div>
                  <button onClick={() => setCurrentPage('quotation')}
                    className={`px-4 md:px-6 py-2.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'quotation' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                    <FileText size={14} className="shrink-0" /> <span>Quotation</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Loading Indicator untuk Proses Remote API */}
      {isLoadingProcess && (
        <div className="fixed top-4 right-4 z-[9999] bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
          Processing...
        </div>
      )}

      {/* Render Pages */}
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
      {currentPage === 'login' && <LoginPage loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} errorMessage={errorMessage} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} queue={fullProcessedQueue} rawHistory={rawHistory} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} handleCancelEdit={handleCancelEdit} formData={formData} setFormData={setFormData} isEditing={isEditing} setIsEditing={setIsEditing} errorMessage={errorMessage} formatTime={formatTime} handleComplete={handleComplete} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} breakSettings={breakSettings} setBreakSettings={setBreakSettings} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} />}
      {currentPage === 'mechanic' && (
        <MechanicPanel
          user={user}
          handleLogout={handleLogout}
          handleChangePassword={handleChangePassword}
          rawHistory={rawHistory}
          queue={fullProcessedQueue}
          formatTime={formatTime}
          onStartWork={handleStartWork}
          onComplete={handleComplete}
          onToggleTask={handleToggleTask}
          onSetOvernight={handleSetOvernight}
          onCancelOvernight={handleCancelOvernight}
        />
      )}
      {currentPage === 'sparepart' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} />}
      {currentPage === 'quotation' && <QuotationSPA />}
      {currentPage === 'booking_manager' && <BookingManager user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />}
      {currentPage === 'cro' && (
         <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} initialTab="belum" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-booking' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} initialTab="booking" setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'booking-public' && <PublicBooking user={user} />}
      {currentPage === 'promo' && <PromosiSparepart />}
      {currentPage === 'manager' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={setIsNavbarVisible} />}
      {currentPage === 'owner' && user?.role === 'owner' && (
        <OwnerPanel
          user={user}
          handleLogout={handleLogout}
          processedQueue={processedQueue}
          rawHistory={rawHistory}
          formatTime={formatTime}
        />
      )}

      {/* Footer */}
      {currentPage !== 'display' && !['admin', 'owner'].includes(currentPage) && (
        <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-zinc-200 px-4 md:px-8 py-2 md:py-2.5 flex flex-col md:flex-row justify-between items-center text-[7px] md:text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] z-50 gap-1 md:gap-0 transition-colors duration-500">
          <div className="flex items-center gap-2 md:gap-4">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> Service Operational</span>
            <span className="text-zinc-200 hidden md:block">|</span>
            <span className="hidden sm:inline">{queue.length} Active Cars</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-300">© 2026 Chery Oriental Medan</span>
          </div>
        </footer>
      )}

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
    </div>
  );
};

export default App;