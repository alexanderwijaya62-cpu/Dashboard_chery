import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings, Calendar, Plus, Zap, FileText, LogOut, Truck } from 'lucide-react';
import { Button } from '@heroui/react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

import { GAS_URL, GAS_USERS_URL, IS_MAINTENANCE } from './utils/config';
import { db } from './utils/dbClient';
import { supabase } from './utils/supabaseClient';
import { speak } from './utils/tts';


// Import Komponen Terpisah
import DisplayBoard from './components/DisplayBoard';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import PromosiSparepart from './components/PromosiSparepart';
import QuotationSPA from './quotation/QuotationSPA';
import MechanicPanel from './components/MechanicPanel';
import ForemanPanel from './components/ForemanPanel';
import SparepartPanel from './components/SparepartPanel';
import FollowupPanel from './components/FollowupPanel';
import ManagerPanel from './components/ManagerPanel';
import PublicBooking from './components/PublicBooking';
import CroBookingPanel from './components/CroBookingPanel';
import AdminBookingPanel from './components/AdminBookingPanel';
import BookingManager from './components/BookingManager';
import BookingApprovalQueue from './components/BookingApprovalQueue';
import SABookingPanel from './components/SABookingPanel';
import StaffBookingPanel from './components/StaffBookingPanel';
import BookingSettings from './components/BookingSettings';
import OwnerPanel from './components/OwnerPanel';
import StockComparison from './components/StockComparison';
import RegisterPage from './components/RegisterPage';
import CsiResult from './components/CsiResult';
import CsiCustomers from './components/CsiCustomers';
import CustomerProfile from './components/CustomerProfile';
import CustomerPanel from './components/CustomerPanel';
import CustomerComplaint from './components/CustomerComplaint';
import DesktopNavBar from './components/DesktopNavBar';
import BottomNavBar from './components/BottomNavBar';
import PublicNavBar from './components/PublicNavBar';
import WarrantyPanel from './components/WarrantyPanel';
import WarrantyDashboard from './components/WarrantyDashboard';
import WarrantySearch from './components/WarrantySearch';
import WarrantyHub, { WarrantyWorkOrderPage } from './components/WarrantyHub';
import ProformaInvoice from './components/ProformaInvoice';
import SecurityPanel from './components/SecurityPanel';
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

  // x-api-key dihapus — tidak divalidasi oleh server

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
        const path = window.location.pathname.toLowerCase();
        if (path === '/display') return 'display';
        if (path === '/booking') return 'booking-public';
        return localStorage.getItem('chery_current_page') || 'login';
  });
  const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('chery_auth_user');
    return (savedUser && savedUser !== 'null') ? JSON.parse(savedUser) : null;
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
  const [formData, setFormData] = useState({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', jenisPekerjaan: [], keluhan: '', mechanicName: '', checklist: [], cuci: false });
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoadingProcess, setIsLoadingProcess] = useState(false);
  const [rawHistory, setRawHistory] = useState([]);
  const [usersData, setUsersData] = useState([]);
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
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume();
      audioCtxRef.current = ctx;
      audioUnlockedRef.current = true;
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    });
    return () => window.removeEventListener('click', handler);
  }, [unlockAudio]);

  const [pageStack, setPageStack] = useState([]);
  const [animDir, setAnimDir] = useState('forward');

  const navigate = useCallback((page) => {
    if (page === currentPage) return;
    setAnimDir('forward');
    setPageStack(prev => [...prev, currentPage]);
    setCurrentPage(page);
    localStorage.setItem('chery_current_page', page);
    window.history.pushState({ page }, '');
  }, [currentPage]);

  const goBack = useCallback(() => {
    if (pageStack.length === 0) return;
    setAnimDir('backward');
    const prev = pageStack[pageStack.length - 1];
    setPageStack(prev => prev.slice(0, -1));
    setCurrentPage(prev);
    localStorage.setItem('chery_current_page', prev);
  }, [pageStack]);

  // Intercept browser back button (skip if modal is open)
  useEffect(() => {
    const handler = () => {
      if (window.__modalOpen) return;
      if (pageStack.length > 0) {
        window.history.pushState(null, '', window.location.href);
        goBack();
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [pageStack, goBack]);

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
        await db.update('users', {
          lastIP: '-',
          lastLocation: '-'
        }, { eq: { username: user.username } });

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
          db.update('users', { isOnline: false, sessionId: null }, { eq: { username: user.username } }),
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
    localStorage.removeItem('chery_current_page');
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

    // Map public paths to pages (No Login Required)
    if (path === '/booking') { setCurrentPage('booking-public'); return; }
    if (path === '/display') { setCurrentPage('display'); return; }

    // 1. PUBLIC ROUTES — hanya login yang bisa diakses tanpa auth
    const publicPaths = ['/login', '/register'];
    if (publicPaths.includes(path)) {
      if (savedUser && savedUser !== 'null' && path === '/login') {
        const u = JSON.parse(savedUser);
        if (u && u.role) {
          const role = u.role.toLowerCase();
          const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner', 'warranty', 'foreman', 'security', 'sales', 'spv'].includes(role) ? '/staff' : 
                            (role === 'customer' ? '/customer' : '/karyawan');
          window.history.replaceState({}, '', targetUrl);
          window.location.reload();
        }
      } else {
        setCurrentPage(path === '/register' ? 'register' : 'login');
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
        if (role === 'display') {
          if (path !== '/display') window.history.replaceState({}, '', '/display');
          setCurrentPage('display');
        } else if (['admin', 'manager', 'cro', 'sparepart', 'owner', 'warranty', 'foreman', 'security', 'sales', 'spv'].includes(role)) {
          const allowedPages = {
            admin: ['admin', 'admin-booking', 'admin-wo', 'promo', 'display', 'booking-public', 'sa-booking'],
            manager: ['manager', 'manager-financial', 'manager-wo', 'manager-vehicles', 'manager-cro', 'manager-holidays', 'manager-staff', 'display', 'booking-public'],
            cro: ['cro', 'cro-sudah', 'cro-freeservice', 'cro-laporan', 'cro-booking', 'cro-booking-approval', 'cro-holidays', 'cro-csi', 'cro-customers', 'display', 'booking-public', 'sa-booking', 'booking-settings'],
            sparepart: ['sparepart-dms-order', 'sparepart-dms', 'sparepart-cost', 'sparepart-profit', 'display', 'booking-public', 'stock-comparison'],
            owner: ['owner', 'owner-workshop', 'owner-dms', 'owner-sparepart-cost', 'owner-warranty', 'owner-parts', 'owner-users', 'owner-sound', 'owner-deleted', 'owner-unit-entry', 'display', 'booking-public', 'stock-comparison'],
            warranty: ['warranty', 'warranty-wo', 'warranty-search', 'warranty-proforma'],
            foreman: ['foreman', 'booking-public', 'display'],
            security: ['security', 'display', 'booking-public'],
          sales: ['sales-booking', 'display'],
          spv: ['spv-booking', 'display'],
          };

          if (savedPage && allowedPages[role]?.includes(savedPage)) {
            setCurrentPage(savedPage);
          } else {
            setCurrentPage(role === 'cro' ? 'cro' : role === 'sparepart' ? 'sparepart-dms-order' : role === 'sales' ? 'sales-booking' : role === 'spv' ? 'spv-booking' : role);
          }
        } else if (role === 'customer') {
          const customerPages = ['customer', 'customer-complaint'];
          if (savedPage && customerPages.includes(savedPage)) {
            setCurrentPage(savedPage);
          } else {
            window.history.replaceState({}, '', '/customer');
            setCurrentPage('customer');
          }
        } else {
          window.history.replaceState({}, '', '/karyawan');
          setCurrentPage('mechanic');
        }
    } else if (path === '/karyawan') {
      if (role === 'display') {
        window.history.replaceState({}, '', '/display');
        setCurrentPage('display');
      } else if (role === 'mekanik') {
        setCurrentPage('mechanic');
      } else {
        window.history.replaceState({}, '', '/staff');
        setCurrentPage(role === 'cro' ? 'cro' : role === 'sales' ? 'sales-booking' : role === 'spv' ? 'spv-booking' : role);
      }
    } else {
      // If path is unknown but logged in, send to their role's default page or respect saved page
      if (role === 'display') {
        window.history.replaceState({}, '', '/display');
        setCurrentPage('display');
      } else {
        const defaultPath = ['mekanik'].includes(role) ? '/karyawan' : (role === 'customer' ? '/customer' : '/staff');
        window.history.replaceState({}, '', defaultPath);

        if (savedPage && (
          (role === 'mekanik' && savedPage === 'mechanic') ||
          (role === 'customer' && (savedPage === 'customer' || savedPage === 'booking-public' || savedPage === 'customer-complaint')) ||
          (['admin', 'manager', 'cro', 'sparepart', 'owner', 'foreman', 'security', 'sales', 'spv'].includes(role))
        )) {
          setCurrentPage(savedPage);
        } else {
          setCurrentPage(role === 'mekanik' ? 'mechanic' : (role === 'customer' ? 'customer' : (role === 'cro' ? 'cro' : (role === 'foreman' ? 'foreman' : (role === 'security' ? 'security' : (role === 'sales' ? 'sales-booking' : (role === 'spv' ? 'spv-booking' : role)))))));
        }
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

  // Auto Logout setelah 1 hari — cek tiap 30 detik + pas tab di-focus
  useEffect(() => {
    const checkDailyLogout = () => {
      const today = new Date().toDateString();
      const storedDate = localStorage.getItem('chery_last_login_date');

      if (user && user.role?.toLowerCase() !== 'display' && storedDate && storedDate !== today) {
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
    const interval = setInterval(checkDailyLogout, 30000);
    window.addEventListener('focus', checkDailyLogout);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkDailyLogout();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkDailyLogout);
    };
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

  // Sync state between tabs/windows on the same device
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'chery_auth_user') {
        const newUser = e.newValue && e.newValue !== 'null' ? JSON.parse(e.newValue) : null;
        setUser(newUser);
        if (!newUser) {
          setSessionId(null);
          setCurrentPage('login');
          window.history.pushState({}, '', '/login');
        } else {
          const role = newUser.role?.toLowerCase();
          const targetPage = role === 'mekanik' ? 'mechanic' :
            role === 'sparepart' ? 'sparepart' :
            role === 'cro' ? 'cro' :
            role === 'manager' ? 'manager' :
            role === 'owner' ? 'owner' : 
            role === 'customer' ? 'customer' :
            role === 'display' ? 'display' :
            role === 'warranty' ? 'warranty' :
            role === 'foreman' ? 'foreman' :
            role === 'security' ? 'security' :
            role === 'sales' ? 'sales-booking' :
            role === 'spv' ? 'spv-booking' : 'admin';
          setCurrentPage(targetPage);
        }
      }
      if (e.key === 'chery_session_id') {
        setSessionId(e.newValue || null);
      }
      if (e.key === 'chery_current_page') {
        if (e.newValue) setCurrentPage(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchQueue = React.useCallback(async () => {
    const isPublicDisplay = window.location.pathname === '/display';
    if (!user && !isPublicDisplay) return;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const bookingDateLimit = thirtyDaysAgo.toISOString().split('T')[0];

      const [queueResult, historyResult, bookingResult] = await Promise.allSettled([
        db.select('antrian'),
        db.select('history', { select: 'id,bk,tipe,status,waktuMasuk,waktuSelesai,category,mechanicName,nama_sa', order: { column: 'targetTime', ascending: false }, limit: 100 }),
        db.select('booking', { select: 'id,tanggal,jam,status,noPlat,namaCustomer,tipeMobil,keperluanService,noTelp,bookingVia,vin,noUrut,ip_address', gte: { tanggal: bookingDateLimit } }),
      ]);

      const activeQueue = queueResult.status === 'fulfilled' ? queueResult.value?.data : null;
      const historyData = historyResult.status === 'fulfilled' ? historyResult.value?.data : null;
      const bookingData = bookingResult.status === 'fulfilled' ? bookingResult.value?.data : null;

      if (queueResult.status === 'rejected') console.error('Antrian error:', queueResult.reason);
      if (historyResult.status === 'rejected') console.error('History error:', historyResult.reason);
      if (bookingResult.status === 'rejected') console.error('Booking error:', bookingResult.reason);

      // Auto-clean old menginap items (not from today) to prevent queue buildup
      if (Array.isArray(activeQueue)) {
        const startOfTodayMs = new Date(); startOfTodayMs.setHours(0,0,0,0);
        const staleItems = activeQueue.filter(q => {
          if (q.status !== 'menginap') return false;
          const itemTime = parseInt(q.id);
          if (!itemTime) return false;
          const ts = itemTime < 2000000000 ? itemTime * 1000 : itemTime;
          return ts < startOfTodayMs.getTime();
        });
        if (staleItems.length > 0) {
          for (const item of staleItems) {
            db.delete('antrian', { eq: { id: item.id } }).catch(() => {});
          }
        }
      }

      const mapDbToApp = (item) => {
        if (!item) return {};
        
        let rawCategory = item.category || 'Reguler';
        let normalizedCategory = rawCategory;
        const lowerCat = rawCategory.toLowerCase();
        if (lowerCat === 'booking') {
          normalizedCategory = 'Booking';
        } else if (lowerCat === 'reguler') {
          normalizedCategory = 'Reguler';
        } else if (lowerCat === 'warranty') {
          normalizedCategory = 'Warranty';
        } else if (lowerCat === 'booking (late)') {
          normalizedCategory = 'Booking (Late)';
        } else if (lowerCat === 'reguler (late)') {
          normalizedCategory = 'Reguler (Late)';
        }

        return {
          id: item.id,
          bk: item.noPlat || item.no_plat || item.noplat || item.bk,
          tipe: item.tipeMobil || item.tipe_mobil || item.tipe,
          category: normalizedCategory,
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
          noTelp: item.noTelp || item.no_telp,
          queueNumber: item.queue_number || 0,
          isCalled: item.is_called || false,
          calledAt: item.called_at || null,
          counter: item.counter || 0,
          nama_sa: item.nama_sa || '',
          cuci_required: item.cuci_required === true
        };
      };

      setQueue((activeQueue || []).map(mapDbToApp));
      setRawHistory((historyData || []).map(mapDbToApp));
      const todayStr = new Date().toISOString().split('T')[0];
      const filteredBookings = (bookingData || []).map(mapDbToApp).filter(b => {
        if (b.status === 'no_show' && b.tanggal && b.tanggal < todayStr) return false;
        return true;
      });
      setBookings(filteredBookings);
    } catch (error) {
      console.error("Gagal mengambil data operasional Supabase", error);
    }
  }, []);

  // Debounce fetchQueue: hanya eksekusi sekali dalam 2 detik
  const userRef = useRef(user);
  userRef.current = user;
  const fetchQueueRef = useRef(fetchQueue);
  fetchQueueRef.current = fetchQueue;
  const fetchTimerRef = useRef(null);
  const debouncedFetchQueue = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchQueueRef.current();
    }, 2000);
  }, []);

  // Sinkronisasi dengan Supabase Realtime
  useEffect(() => {
    const isPublicDisplay = window.location.pathname === '/display';
    const shouldFetch = isPublicDisplay || (userRef.current && userRef.current.role !== 'customer');
    if (shouldFetch) fetchQueue();

    const antrianSubscription = supabase
      .channel('antrian-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' }, (payload) => {
        if (isPublicDisplay || (userRef.current && userRef.current.role !== 'customer')) debouncedFetchQueue();
      })
      .subscribe();

    const historySubscription = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, () => {
        if (isPublicDisplay || (userRef.current && userRef.current.role !== 'customer')) debouncedFetchQueue();
      })
      .subscribe();

    const bookingSubscription = supabase
      .channel('booking-changes-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new?.status === payload.old?.status) return;
        if (isPublicDisplay || (userRef.current && userRef.current.role !== 'customer')) debouncedFetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(antrianSubscription);
      supabase.removeChannel(historySubscription);
      supabase.removeChannel(bookingSubscription);
    };
  }, [fetchQueue, debouncedFetchQueue]);

  // Update waktu lokal setiap detik untuk countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic polling — pastikan display selalu fresh meski Realtime delay
  useEffect(() => {
    if (currentPage !== 'display') return;
    const interval = setInterval(() => {
      fetchQueueRef.current();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentPage]);

  // Simpan status user ke LocalStorage
  useEffect(() => {
    if (user) localStorage.setItem('chery_auth_user', JSON.stringify(user));
    else localStorage.removeItem('chery_auth_user');
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
  // SINGLE SESSION GUARD — Disabled: multiple login diizinkan
  // ============================================================
  useEffect(() => {
    if (!user || !sessionId || currentPage === 'display') return;
    // Session guard dinonaktifkan agar tidak logout paksa saat login baru
  }, [user, sessionId, currentPage]);

  const customSoundUrlRef = React.useRef(null);
  const customSoundChecked = React.useRef(false);
  const autoMenginapEnabledRef = React.useRef(true);
  const callCooldownRef = React.useRef(120);
  const adminShowJenisRef = React.useRef(true);
  const adminShowChecklistRef = React.useRef(true);

  // Fetch custom notification sound URL — only when logged in
  React.useEffect(() => {
    if (!user) return;

    const fetchCustomSound = async () => {
      try {
        const { data } = await db.select('settings', {
          or: [
            { op: 'eq', column: 'key', value: 'notification_sound_url' },
            { op: 'eq', column: 'key', value: 'notification_sound_enabled' },
            { op: 'eq', column: 'key', value: 'auto_menginap_enabled' },
            { op: 'eq', column: 'key', value: 'call_cooldown_seconds' },
            { op: 'eq', column: 'key', value: 'admin_show_jenis' },
            { op: 'eq', column: 'key', value: 'admin_show_checklist' },
          ]
        });
        if (Array.isArray(data)) {
          const map = Object.fromEntries(data.map(r => [r.key, r.value]));
          if (map.notification_sound_url) customSoundUrlRef.current = map.notification_sound_url;
          if (map.notification_sound_enabled) setIsSoundEnabled(map.notification_sound_enabled === 'true');
          autoMenginapEnabledRef.current = map.auto_menginap_enabled ? map.auto_menginap_enabled === 'true' : true;
          if (map.call_cooldown_seconds) callCooldownRef.current = parseInt(map.call_cooldown_seconds) || 120;
          if (map.admin_show_jenis) adminShowJenisRef.current = map.admin_show_jenis === 'true';
          if (map.admin_show_checklist) adminShowChecklistRef.current = map.admin_show_checklist === 'true';
        }
      } catch (e) {
        // Silently skip if table missing or other error
      }
      customSoundChecked.current = true;
    };
    fetchCustomSound();

    // Listen for changes to the settings table — only when logged in
    const settingsChannel = supabase.channel('settings-notif-sound')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new) {
          if (payload.new.key === 'notification_sound_url') {
            customSoundUrlRef.current = payload.new.value || null;
          }
          if (payload.new.key === 'notification_sound_enabled') {
            setIsSoundEnabled(payload.new.value === 'true');
          }
          if (payload.new.key === 'auto_menginap_enabled') {
            autoMenginapEnabledRef.current = payload.new.value === 'true';
          }
          if (payload.new.key === 'call_cooldown_seconds') {
            callCooldownRef.current = parseInt(payload.new.value) || 120;
          }
          if (payload.new.key === 'admin_show_jenis') {
            adminShowJenisRef.current = payload.new.value === 'true';
          }
          if (payload.new.key === 'admin_show_checklist') {
            adminShowChecklistRef.current = payload.new.value === 'true';
          }
        }
        if (payload.eventType === 'DELETE') {
          if (payload.old?.key === 'notification_sound_url') {
            customSoundUrlRef.current = null;
          }
          if (payload.old?.key === 'auto_menginap_enabled') {
            autoMenginapEnabledRef.current = true;
          }
          if (payload.old?.key === 'call_cooldown_seconds') {
            callCooldownRef.current = 120;
          }
          if (payload.old?.key === 'admin_show_jenis') {
            adminShowJenisRef.current = true;
          }
          if (payload.old?.key === 'admin_show_checklist') {
            adminShowChecklistRef.current = true;
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(settingsChannel); };
  }, [user]);

  // notification sound function

  const lastPlayedRef = React.useRef(0);
  const playedTextsRef = React.useRef(new Set());

  const playChime = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // Gentle chime: ascending pentatonic notes
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.6);
      });
    } catch (_) {}
  };

  const playTTS = (text) => {
    if (speak(text)) return;
    try {
      const url = `/api/tts?text=${encodeURIComponent(text)}`;
      const audio = new Audio(url);
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  const playNotificationSound = React.useCallback((textOrBk) => {
    if (!isSoundEnabled || !textOrBk || textOrBk === "Unit" || textOrBk === "undefined") return;

    // Debounce: Cegah suara yang sama bunyi berkali-kali dalam 5 detik
    const now = Date.now();
    if (now - lastPlayedRef.current < 5000 && playedTextsRef.current.has(textOrBk)) return;

    lastPlayedRef.current = now;
    playedTextsRef.current.add(textOrBk);
    setTimeout(() => playedTextsRef.current.delete(textOrBk), 10000);

    // Play gentle chime notification sound
    playChime();

    // Voice Notification (TTS) using Google TTS proxy
    setTimeout(() => {
      let speakText = textOrBk;
      const words = textOrBk.trim().split(/\s+/);
      const isPlate = words.length <= 4 && textOrBk.length < 20;

      if (isPlate && !textOrBk.toLowerCase().includes('selesai')) {
        const formattedBk = textOrBk.toUpperCase().split('').join(' ');
        speakText = `Antrian selesai. Mobil, ${formattedBk}, telah selesai.`;
      }

      playTTS(speakText);
    }, 800);
  }, [isSoundEnabled, unlockAudio]);

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
    if (currentPage === 'display') return;

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

        const plat = item.bk || item.noPlat || '(tanpa plat)';
        const tipe = item.tipe || item.tipeMobil || '';
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`✅ Mobil Selesai`, { body: `Mobil ${plat} (${tipe}) sudah selesai.` });
        }
        Toastify({
          text: `✅ Mobil ${plat} (${tipe}) sudah selesai.`,
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
  }, [rawHistory, playNotificationSound, currentPage]);

  const isAutoUpdating = useRef(false);
  const noShowCheckedRef = useRef(false);

  useEffect(() => {
    const checkAutoStatus = async () => {
      if (isAutoUpdating.current || queue.length === 0) return;

      // 1. Otomatis set 'menginap' untuk antrean dari hari-hari sebelumnya
      const prevDayItems = queue.filter(q => {
         const isTodayItem = isToday(parseInt(q.id));
         return !isTodayItem && q.status !== 'menginap' && q.status !== 'working' && q.status !== 'istirahat' && q.status !== 'completed' && q.status !== 'menunggu_konfirmasi' && q.status !== 'request_extension';
      });

      if (prevDayItems.length > 0) {
        isAutoUpdating.current = true;
        try {
          for (const item of prevDayItems) {
            let sisaDetik = parseInt(item.estimasiDefault) || 0;
            if (item.status === 'working') {
              const targetTime = parseInt(item.targetTime) || Date.now();
              sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
            }
            await db.update('antrian', {
              status: 'menginap',
              estimasiDefault: sisaDetik,
              targetTime: 0,
              menginap_reason: item.menginap_reason || 'Pekerjaan Hari Sebelumnya'
            }, { eq: { id: item.id } });
          }
          Toastify({ 
            text: `🌙 ${prevDayItems.length} unit hari sebelumnya diubah ke status menginap!`, 
            style: { background: "#9333ea" } 
          }).showToast();
        } catch (e) {
          console.error("Auto Menginap Prev Day Error:", e);
        } finally {
          isAutoUpdating.current = false;
        }
        return;
      }

      const nowObj = new Date();
      // Ensure we use Jakarta Time (WIB - GMT+7)
      const utc = nowObj.getTime() + (nowObj.getTimezoneOffset() * 60000);
      const jakartaTime = new Date(utc + (3600000 * 7));

      const currentHour = jakartaTime.getHours();
      const currentMinute = jakartaTime.getMinutes();
      const day = jakartaTime.getDay();

      let targetStatus = null;

      // Checking Overnight (menginap)
      if (autoMenginapEnabledRef.current && (currentHour >= 19 || currentHour < 8)) {
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
          if (targetStatus === 'menginap') return q.status !== 'menginap' && q.status !== 'working' && q.status !== 'completed' && q.status !== 'menunggu_konfirmasi' && q.status !== 'request_extension';
          if (targetStatus === 'istirahat') return q.status === 'working' || q.status === 'request_extension';
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

              await db.update('antrian', {
                status: targetStatus,
                estimasiDefault: sisaDetik,
                targetTime: 0
              }, { eq: { id: item.id } });
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
              await db.update('antrian', {
                status: 'working',
                targetTime: targetTime
              }, { eq: { id: item.id } });
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

  // #3: Auto no-show handling — check setiap 60 detik
  useEffect(() => {
    if (!user) return;
    if (noShowCheckedRef.current) return;
    noShowCheckedRef.current = true;

    const checkNoShow = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const { data: todayBookings, error } = await db.select('booking', {
          select: 'id,jam,noPlat,status',
          eq: { tanggal: todayStr },
          in: { status: ['accepted', 'waiting confirm'] }
        });
        if (error || !Array.isArray(todayBookings)) return;

        const antrianPlates = new Set();
        const { data: activeAntrian } = await db.select('antrian', {
          select: 'bk',
          in: { status: ['waiting', 'working', 'istirahat', 'menginap'] }
        });
        if (Array.isArray(activeAntrian)) {
          activeAntrian.forEach(a => { if (a.bk) antrianPlates.add(a.bk.toUpperCase().replace(/\s+/g, '')); });
        }

        for (const b of todayBookings) {
          const jamStr = String(b.jam || '').replace(':', '.');
          const [h, m] = jamStr.split('.');
          if (!h || !m) continue;
          const slotTime = new Date();
          slotTime.setHours(parseInt(h), parseInt(m), 0, 0);
          const diffMin = (now - slotTime) / (1000 * 60);

          if (diffMin > 30) {
            const plat = (b.noPlat || '').toUpperCase().replace(/\s+/g, '');
            if (!plat) continue;
            if (antrianPlates.has(plat)) continue;
            // Atomic: hanya update jika status masih accepted/waiting confirm
            await supabase
              .from('booking')
              .update({ status: 'no_show' })
              .eq('id', b.id)
              .in('status', ['accepted', 'waiting confirm']);
          }
        }
      } catch (e) {
        console.error('No-show check error:', e);
      }
    };

    const interval = setInterval(checkNoShow, 60000);
    checkNoShow();
    return () => clearInterval(interval);
  }, [user]);

  const fullProcessedQueue = useMemo(() => {
    return queue
      .map(item => {
        let remaining = 0;

        const tTime = parseInt(item.target_time || item.targetTime);
        const estDef = parseInt(item.estimasiDefault) || 0;

        if ((item.status === 'working' || item.status === 'sedang_dicuci') && tTime > 0) {
          // COUNTDOWN: remaining time from targetTime
          remaining = Math.max(0, Math.ceil((tTime - now) / 1000));
        } else if (item.status === 'menunggu_konfirmasi') {
          // Show actual elapsed work time, fallback ke stored estimasiDefault
          remaining = parseInt(item.elapsedSeconds) || estDef;
        } else if (item.status === 'request_extension') {
          // Paused countdown while waiting admin approval
          remaining = Math.max(0, estDef);
        } else {
          // waiting, istirahat, menginap: show stored remaining time
          remaining = estDef;
        }

        return { ...item, estimasi: remaining };
      })
      .sort((a, b) => {
        // Prioritas Status: Sedang Dikerjakan (Working) paling atas
        const priorityScore = { menunggu_konfirmasi: 1, working: 2, request_extension: 3, istirahat: 4, waiting: 5, menginap: 6 };
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

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      });
      const json = await res.json();

      if (res.ok && json.username) {
        const { device, browser } = getDeviceInfo();

        const userData = { 
          name: json.name, 
          username: json.username, 
          role: json.role?.toLowerCase(),
          plat_bk: json.plat_bk,
          vin: json.vin,
          status: json.status || 'active'
        };
        const today = new Date().toDateString();

        localStorage.setItem('chery_last_login_date', today);
        setLastLoginDate(today);
        setSessionId(json.sessionId);
        setUser(userData);
        setLoginForm({ username: '', password: '' });

        const targetPage = json.role?.toLowerCase() === 'mekanik' ? 'mechanic' :
          json.role?.toLowerCase() === 'sparepart' ? 'sparepart' :
            json.role?.toLowerCase() === 'cro' ? 'cro' :
              json.role?.toLowerCase() === 'manager' ? 'manager' :
                json.role?.toLowerCase() === 'owner' ? 'owner' : 
                  json.role?.toLowerCase() === 'customer' ? 'customer' :
                    json.role?.toLowerCase() === 'display' ? 'display' :
                    json.role?.toLowerCase() === 'warranty' ? 'warranty' :
                    json.role?.toLowerCase() === 'foreman' ? 'foreman' :
                    json.role?.toLowerCase() === 'security' ? 'security' :
                    json.role?.toLowerCase() === 'sales' ? 'sales-booking' :
                    json.role?.toLowerCase() === 'spv' ? 'spv-booking' : 'admin';

        const targetUrl = ['admin', 'manager', 'cro', 'sparepart', 'owner', 'warranty', 'foreman', 'security', 'sales', 'spv'].includes(json.role?.toLowerCase()) ? '/staff' : 
                          (json.role?.toLowerCase() === 'customer' ? '/customer' : 
                            (json.role?.toLowerCase() === 'display' ? '/display' : '/karyawan'));
        window.history.pushState({}, '', targetUrl);

        setCurrentPage(targetPage);
        setErrorMessage('');

        setTimeout(() => window.location.reload(), 100);
      } else {
        setErrorMessage(json.error || 'Username atau Password salah!');
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
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: user?.username, 
          password: oldPassword,
          action: 'change-password',
          oldPassword,
          newPassword
        })
      });
      const json = await res.json();
      return json;
    } catch (error) {
      console.error(error);
      return { success: false, message: "Gagal terhubung ke server database!" };
    }
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

  const handleSave = async (e) => {
    e.preventDefault();
    if (isLoadingProcess) return;

    let totalSeconds = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
    if (formData.cuci) {
      totalSeconds += 1800; // Tambah 30 menit
    }

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

    // Cegah duplikat plat (cek di seluruh antrian aktif)
    if (!isEditing) {
      const platBaru = formData.bk.toUpperCase().replace(/\s+/g, '');
      const sudahAda = queue.some(q => q.bk?.toUpperCase().replace(/\s+/g, '') === platBaru);
      if (sudahAda) {
        setErrorMessage(`Mobil ${platBaru} sudah terdaftar di antrian!`);
        setTimeout(() => setErrorMessage(""), 4000);
        return;
      }
    }

    setIsLoadingProcess(true);

    let updates = {
      bk: formData.bk.toUpperCase().replace(/\s+/g, ''),
      tipe: formData.tipe,
      category: formData.category,
      keluhan: (() => {
        const pList = (formData.jenisPekerjaan || []).map(p => {
          const mileage = ['5.000', '10.000', '15.000', '20.000', '30.000', '40.000', '45.000', '50.000', '60.000'];
          return mileage.includes(p) ? `Free Service ${p} KM` : p;
        });
        const kText = sanitizeInput(formData.keluhan || '').trim();
        const joined = pList.join('\n');
        if (!joined && !kText) return '';
        if (!joined) return kText;
        return kText ? `${joined}\n${kText}` : joined;
      })(),
      checklist: formData.checklist || [],
      menginap_reason: formData.menginap_reason || '',
      noTelp: formData.noTelp || '',
      cuci_required: formData.cuci || false,
    };

    const mechanicValue = formData.mechanicName || '';
    const addedByValue = user?.name || user?.username || 'System';

      if (isEditing) {
        updates.id = formData.id;
        updates.addedBy = formData.addedBy || addedByValue;
        if (formData.status === 'working') {
          const newTargetTime = Date.now() + (totalSeconds * 1000);
          updates.targetTime = newTargetTime;
          updates.estimasiDefault = totalSeconds;
        } else {
          updates.estimasiDefault = totalSeconds;
          updates.targetTime = 0;
        }
        updates.mechanicName = mechanicValue;
        // SA confirm → maju ke foreman
        if (formData.status === 'menunggu_sa') {
          updates.nama_sa = user?.name || user?.username || 'System';
          updates.status = 'menunggu_foreman';
        } else if (formData.status === 'menunggu_foreman') {
          updates.nama_sa = formData.nama_sa || user?.name || user?.username || 'System';
        } else {
          updates.nama_sa = formData.nama_sa || '';
        }
    } else {
      updates.id = Date.now();
      updates.status = 'waiting';
      updates.addedBy = addedByValue;
      updates.nama_sa = user?.name || user?.username || 'System';
      updates.estimasiDefault = totalSeconds;
      updates.targetTime = 0;
      updates.mechanicName = mechanicValue;
      updates.is_called = false;
      updates.counter = 0;
      updates.queue_number = 0;
    }

    try {
      if (isEditing) {
        let updateError, updatedRows;
        ({ error: updateError, data: updatedRows } = await db.update('antrian', updates, { eq: { id: formData.id } }));
        if (updateError && updateError.code === 'PGRST204') {
          delete updates.cuci_required;
          delete updates.nama_sa;
          ({ error: updateError, data: updatedRows } = await db.update('antrian', updates, { eq: { id: formData.id } }));
        }

        if (!updateError && (!updatedRows || updatedRows.length === 0)) {
          const historyUpdates = { ...updates };
          delete historyUpdates.checklist;
          delete historyUpdates.targetTime;
          delete historyUpdates.menginap_reason;
          const { error: hError } = await db.update('history', historyUpdates, { eq: { id: formData.id } });
          if (hError && hError.code === 'PGRST204') {
            delete historyUpdates.cuci_required;
            const { error: hRetry } = await db.update('history', historyUpdates, { eq: { id: formData.id } });
            if (hRetry) throw hRetry;
          } else if (hError) {
            throw hError;
          }
        } else if (updateError) {
          throw updateError;
        }
      } else {
        const qNum = await generateQueueNumber(updates.category);
        updates.queue_number = qNum;

        const { error } = await db.insert('antrian', updates);
        if (error) {
          if (error.code === 'PGRST204') {
            delete updates.cuci_required;
            const { error: retryError } = await db.insert('antrian', updates);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }

      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '', checklist: [], menginap_reason: '', cuci: false });
      setIsEditing(false);
      fetchQueueRef.current();
    } catch (error) {
      console.error("Gagal menyimpan data", error);
      setErrorMessage("Gagal menyimpan data ke Supabase");
      setTimeout(() => setErrorMessage(""), 3000);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const deleteItem = async (id) => {
    if (isLoadingProcess) {
      Toastify({ text: "⏳ Proses lain sedang berjalan, tunggu sebentar...", style: { background: "#f59e0b", borderRadius: "12px" } }).showToast();
      return;
    }
    // Cari item yang akan dihapus untuk dapat queue_number & category
    const target = queue.find(q => q.id === id);
    setIsLoadingProcess(true);
    try {
      await Promise.all([
        db.delete('antrian', { eq: { id } }),
        db.delete('history', { eq: { id } })
      ]);
      setQueue(prev => prev.filter(q => q.id !== id));
      setRawHistory(prev => prev.filter(h => h.id !== id));
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
        await db.delete('antrian', { neq: { id: 0 } });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingProcess(false);
      }
    }
  };

  // Mekanik minta tambahan waktu → pending admin approval
  const handleRequestExtension = async (item, extraSeconds, reason) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      const payload = {
        pendingExtra: JSON.stringify({ duration: extraSeconds, reason, mechanic: user?.name || '', requestedAt: Date.now() }),
        status: 'request_extension'
      };
      const { error } = await db.update('antrian', payload, { eq: { id: item.id } });
      if (error) {
        if (error.code === 'PGRST204') {
          // Kolom pendingExtra belum ada — simplify: just store reason in menginap_reason
          await db.update('antrian', {
            status: 'request_extension',
            menginap_reason: `[TAMBAH WAKTU] ${extraSeconds} detik - ${reason}`
          }, { eq: { id: item.id } });
        } else {
          throw error;
        }
      }
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, ...payload } : q
      ));
      Toastify({
        text: `⏳ Request tambah waktu ${Math.floor(extraSeconds / 60)} menit dikirim ke admin!`,
        background: '#f59e0b'
      }).showToast();
    } catch (err) {
      console.error(err);
      Toastify({ text: '❌ Gagal kirim request tambah waktu', background: '#ef4444' }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  // Admin approve tambah waktu
  const handleApproveExtension = async (item, extraSeconds, reason) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      const currentRemaining = parseInt(item.estimasiDefault) || 0;
      const newDuration = currentRemaining + extraSeconds;
      const newTargetTime = Date.now() + (newDuration * 1000);
      const payload = {
        status: 'working',
        estimasiDefault: newDuration,
        targetTime: newTargetTime,
        pendingExtra: null,
        menginap_reason: ''
      };
      await db.update('antrian', payload, { eq: { id: item.id } });
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, ...payload } : q
      ));
      Toastify({
        text: `✅ Tambah waktu ${Math.floor(extraSeconds / 60)} menit disetujui!`,
        background: '#10b981'
      }).showToast();
    } catch (err) {
      console.error(err);
      Toastify({ text: '❌ Gagal approve extension', background: '#ef4444' }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  // Foreman tambah waktu → langsung approve tanpa perlu admin
  const handleForemanAddTime = async (item, extraSeconds, reason) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      const currentRemaining = parseInt(item.estimasiDefault) || 0;
      const newDuration = currentRemaining + extraSeconds;
      const newTargetTime = Date.now() + (newDuration * 1000);
      const payload = {
        status: 'working',
        estimasiDefault: newDuration,
        targetTime: newTargetTime,
        pendingExtra: null,
        menginap_reason: ''
      };
      await db.update('antrian', payload, { eq: { id: item.id } });
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, ...payload } : q
      ));
      Toastify({
        text: `✅ Tambah waktu ${Math.floor(extraSeconds / 60)} menit oleh Foreman langsung disetujui!`,
        background: '#10b981'
      }).showToast();
    } catch (err) {
      console.error(err);
      Toastify({ text: '❌ Gagal tambah waktu', background: '#ef4444' }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  // Admin reject tambah waktu
  const handleRejectExtension = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      // Kembalikan ke working dengan sisa waktu yg ada
      const remaining = parseInt(item.estimasiDefault) || 0;
      const targetTime = remaining > 0 ? Date.now() + (remaining * 1000) : Date.now();
      const payload = {
        status: 'working',
        targetTime: targetTime,
        pendingExtra: null,
        menginap_reason: ''
      };
      await db.update('antrian', payload, { eq: { id: item.id } });
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, ...payload } : q
      ));
      Toastify({
        text: '❌ Request tambah waktu ditolak admin',
        background: '#ef4444'
      }).showToast();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleStartWork = async (item) => {
    const role = user?.role?.toLowerCase();
    if (!user || (role !== 'mekanik' && role !== 'foreman') || isLoadingProcess) return;

    if (role === 'mekanik' && item.status === 'menginap' && item.mechanicName && !item.mechanicName.split(',').includes(user.name)) {
      alert("Hanya mekanik yang ditugaskan yang bisa melanjutkan! Silakan hubungi Foreman/Admin.");
      return;
    }

    setIsLoadingProcess(true);

    const estimasiDefaultInt = parseInt(item.estimasiDefault) || 1800;
    const targetTime = Date.now() + (estimasiDefaultInt * 1000);

    // If foreman already assigned mechanics, keep the original mechanicName list
    const updatePayload = {
      status: 'working',
      targetTime: targetTime,
      is_called: false
    };
    if (!item.mechanicName && role === 'mekanik') {
      updatePayload.mechanicName = user.name;
    }

    try {
      await db.update('antrian', updatePayload, { eq: { id: item.id } });
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, ...updatePayload } : q));
      fetchQueueRef.current();
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

      const { error } = await db.update('antrian', updateData, { eq: { id: item.id } });
      if (error) {
        if (error.code === 'PGRST204') {
          delete updateData.menginap_reason;
          await db.update('antrian', updateData, { eq: { id: item.id } });
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

      // Simpan ke local cache untuk draft offline
      localStorage.setItem(`offline_checklist_${id}`, JSON.stringify(newChecklist));

      if (navigator.onLine) {
        const { error } = await db.update('antrian', {
          checklist: newChecklist
        }, { eq: { id } });

        if (!error) {
          localStorage.removeItem(`offline_checklist_${id}`);
        } else if (error.code === 'PGRST204') {
          Toastify({ text: "⚠️ Fitur Task belum aktif. Silakan tambah kolom 'checklist' di Supabase.", style: { background: '#f59e0b' } }).showToast();
        } else {
          throw error;
        }
      } else {
        Toastify({
          text: "⚠️ Koneksi Terputus. Draft disimpan lokal & akan disinkronkan saat online.",
          style: { background: '#f59e0b' }
        }).showToast();
      }
    } catch (err) {
      console.error("Gagal update checklist:", err);
    }
  };

  // Background Sync untuk offline checklists
  useEffect(() => {
    const syncOfflineChecklists = async () => {
      if (!navigator.onLine) return;
      try {
        let keysToSync = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('offline_checklist_')) {
            keysToSync.push(key);
          }
        }

        for (const key of keysToSync) {
          const id = parseInt(key.replace('offline_checklist_', ''));
          const newChecklist = JSON.parse(localStorage.getItem(key));
          
          const { error } = await db.update('antrian', {
            checklist: newChecklist
          }, { eq: { id } });
          
          if (!error) {
            localStorage.removeItem(key);
            console.log(`Synced offline checklist for id ${id}`);
          }
        }
      } catch (err) {
        console.error("Gagal sinkronisasi data offline:", err);
      }
    };

    window.addEventListener('online', syncOfflineChecklists);
    // Jalankan sekali saat mount jika online
    syncOfflineChecklists();

    return () => window.removeEventListener('online', syncOfflineChecklists);
  }, []);

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
      await db.update('antrian', {
        status: 'waiting',
        targetTime: 0
      }, { eq: { id: item.id } });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleComplete = async (item, force = false) => {
    if (isLoadingProcess) return;

    // Auto-complete all tasks if forced by admin/foreman
    let itemChecklist = Array.isArray(item.checklist) ? item.checklist : [];
    if (force && itemChecklist.length > 0) {
      itemChecklist = itemChecklist.map(t => ({ ...t, completed: true }));
    }

    // VALIDASI CHECKLIST: Semua task harus selesai sebelum complete pengerjaan
    const checklist = Array.isArray(item.checklist) ? item.checklist : [];
    const isAllDone = checklist.every(t => t.completed);

    if (!force && checklist.length > 0 && !isAllDone) {
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
      playChime();
      return;
    }

    if (!window.confirm(`Selesaikan pengerjaan unit ${item.bk}?`)) return;

      setIsLoadingProcess(true);
    try {
      const now = new Date();
      const nowISO = now.toISOString();

      // Hitung sisa waktu (remaining) — jangan timpa estimasiDefault biar display konsisten
      const tTime = parseInt(item.target_time || item.targetTime);
      const estDef = parseInt(item.estimasiDefault) || 0;
      const remainingAtComplete = tTime > 0 ? Math.max(0, Math.ceil((tTime - Date.now()) / 1000)) : estDef;

      // Hitung lama pengerjaan aktual untuk riwayat
      let elapsedSeconds = 0;
      if (tTime > 0 && estDef > 0) {
        elapsedSeconds = Math.max(0, estDef - remainingAtComplete);
      }

      // If cuci required → go to cuci queue instead of konfirmasi
      // If cuci required → go to cuci queue instead of konfirmasi
      const isCuci = item.cuci_required === true;
      let finalStatus = 'menunggu_konfirmasi';
      let cuciAdditions = {};

      if (isCuci) {
        const isAnyCarWashing = queue.some(q => q.status === 'sedang_dicuci' && q.id !== item.id);
        if (isAnyCarWashing) {
          finalStatus = 'menunggu_cuci';
        } else {
          finalStatus = 'sedang_dicuci';
          const cuciDurasi = 30 * 60; // 30 menit
          cuciAdditions = {
            cuci_mulai: new Date().toISOString(),
            targetTime: Date.now() + (cuciDurasi * 1000),
            estimasiDefault: cuciDurasi
          };
        }
      }

      const updatePayload = {
        status: finalStatus,
        waktuSelesai: nowISO,
        estimasiDefault: elapsedSeconds || remainingAtComplete,
        elapsedSeconds: elapsedSeconds,
        is_called: false,
        ...(force && itemChecklist.length > 0 ? { checklist: itemChecklist } : {}),
        ...cuciAdditions
      };

      const { error: updateError } = await db.update('antrian', updatePayload, { eq: { id: item.id } });

      if (updateError) {
        if (updateError.code === 'PGRST204') {
          delete updatePayload.elapsedSeconds;
          delete updatePayload.cuci_mulai;
          const { error: retryError } = await db.update('antrian', updatePayload, { eq: { id: item.id } });
          if (retryError) throw retryError;
        } else {
          throw new Error(`Database Error (Update Antrian): ${updateError.message}`);
        }
      }

      Toastify({
        text: isCuci 
          ? (finalStatus === 'sedang_dicuci' ? `🚗 ${item.bk} selesai dikerjakan — Sedang dicuci 30 menit` : `🚗 ${item.bk} selesai dikerjakan — Menunggu antrian cuci`) 
          : `⏳ ${item.bk} selesai dikerjakan — Menunggu konfirmasi admin`,
        duration: 4000,
        style: { background: isCuci ? "linear-gradient(135deg, #0d9488, #0f766e)" : "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: "12px", fontWeight: "900" }
      }).showToast();

      // Optimistic update + immediate re-fetch
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, ...updatePayload } : q
      ));
      fetchQueueRef.current();

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

  const handleConfirmCompletion = async (item) => {
    if (isLoadingProcess) return;
    if (!window.confirm(`Konfirmasi penyelesaian unit ${item.bk}? Data akan dipindahkan ke riwayat.`)) return;

    setIsLoadingProcess(true);
    try {
      const now = new Date();
      const jakartaNow = new Date(now.getTime() + (7 * 3600000));

      // Gunakan elapsedSeconds kalo ada (hasil dari timer countdown)
      const elapsedSec = parseInt(item.elapsedSeconds) || 0;
      let jarakWaktuStr = '-';
      if (elapsedSec > 0) {
        const j = Math.floor(elapsedSec / 3600);
        const m = Math.floor((elapsedSec % 3600) / 60);
        jarakWaktuStr = j > 0 ? `${j} jam ${m} menit` : `${m} menit`;
      } else {
        // Fallback: hitung dari id (waktu dibuat)
        const itemIdNum = parseInt(item.id);
        const waktuMasukMs = itemIdNum < 2000000000 ? itemIdNum * 1000 : itemIdNum;
        const waktuMasukDate = new Date(waktuMasukMs);
        const waktuSelesaiDate = item.waktuSelesai ? new Date(item.waktuSelesai) : now;
        const selisihMs = waktuSelesaiDate.getTime() - waktuMasukDate.getTime();
        const selisihMenit = Math.max(0, Math.round(selisihMs / 60000));
        const jamKerja = Math.floor(selisihMenit / 60);
        const menitKerja = selisihMenit % 60;
        jarakWaktuStr = jamKerja > 0 ? `${jamKerja} jam ${menitKerja} menit` : `${menitKerja} menit`;
      }

      const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const bulanStr = namaBulan[now.getMonth()];
      const tanggalISO = now.toISOString().split('T')[0];
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const tanggalIndo = `${day}-${month}-${year}`;

      // 1. Insert into history
      const checklist = Array.isArray(item.checklist) ? item.checklist : [];
      let historyKeluhan = item.keluhan || '';
      if (checklist.length > 0) {
        const s = checklist.map(t => `${t.completed ? '✅' : '❌'} ${t.text}`).join('\n');
        historyKeluhan = (historyKeluhan ? historyKeluhan + '\n\n' : '') + "--- CHECKLIST ---\n" + s;
      }

      // Hitung waktuMasuk dari item.id (timestamp creation)
      const itemIdNum = parseInt(item.id);
      const waktuMasukMs = itemIdNum < 2000000000 ? itemIdNum * 1000 : itemIdNum;
      const waktuMasukISO = new Date(waktuMasukMs).toISOString();
      // Pakai waktuSelesai dari item (disimpan pas mechanic klik selesai) atau now
      const waktuSelesaiPakai = item.waktuSelesai || now.toISOString();

      let historyAttempt = {
        id: item.id, 
        bk: item.bk || '', 
        tipe: item.tipe || '',
        keluhan: historyKeluhan, 
        status: 'completed',
        mechanicName: item.mechanicName || '',
        category: item.category || 'Reguler',
        addedBy: item.addedBy || user?.name || '',
        checklist: item.checklist || [],
        waktuSelesai: waktuSelesaiPakai,
        targetTime: item.targetTime || 0,
        elapsedSeconds: elapsedSec || 0,
        estimasiDefault: item.estimasiDefault || 0,
        Tanggal: tanggalIndo,
        noTelp: item.noTelp || '',
        jam: item.jam || null,
        menginap_reason: item.menginap_reason || '',
        pendingExtra: item.pendingExtra || null
      };
      let historyError = null;
      for (let i = 0; i < 5; i++) {
        const { error: e } = await db.insert('history', historyAttempt);
        if (!e || e.code === '23505') { historyAttempt = null; historyError = null; break; }
        historyError = e;
        console.error("Gagal insert history (retry " + (i+1) + "):", e);
        if (e.code === '22P02' && historyAttempt.bk !== undefined) {
          const { bk: _, ...rest } = historyAttempt;
          historyAttempt = rest;
          continue;
        }
        if (e.code === 'PGRST204') {
          const m = e.message.match(/'([^']+)'/);
          const bad = m ? m[1] : null;
          if (bad && historyAttempt[bad] !== undefined) {
            const { [bad]: _, ...rest } = historyAttempt;
            historyAttempt = rest;
            continue;
          }
        }
        const key = Object.keys(historyAttempt).find(k => k !== 'id');
        if (!key) break;
        const { [key]: _, ...rest } = historyAttempt;
        historyAttempt = rest;
      }
      if (historyAttempt) {
        const { error: last } = await db.insert('history', { id: item.id, status: 'completed' });
        if (last && last.code !== '23505') {
          historyError = last;
        }
      }
      if (historyError) {
        Toastify({ 
          text: `❌ Gagal Simpan Riwayat: ${historyError.message} (Code: ${historyError.code})`, 
          duration: 10000, 
          style: { background: "#dc2626", borderRadius: "12px", fontWeight: "900" } 
        }).showToast();
        throw new Error(`Database Error (History): ${historyError.message}`);
      }

      // 2. Delete from antrian
      const { error: deleteError } = await db.delete('antrian', { eq: { id: item.id } });
      if (deleteError) {
        console.error("Antrian Delete Error:", deleteError);
        throw new Error(`Database Error (Antrian): ${deleteError.message}`);
      }

      // 3. Sync to CRO Table
      try {
        const croDataBase = {
          id: Date.now(),
          workOrderNo: String(item.id).substring(0, 15),
          nama: item.addedBy || 'Pelanggan Workshop',
          telepon: item.noTelp ? (parseInt(item.noTelp.replace(/\D/g, '')) || 0) : 0,
          vin: 0,
          plat: item.bk,
          serviceAdvisor: item.addedBy || '',
          tipeMobil: item.tipe,
          deskripsi: `• ${item.keluhan || 'Perbaikan Workshop'}`,
          tanggalDatang: tanggalISO.split('-').reverse().join('-'),
          status: 'Belum',
          respon: '',
          lampiran: '[]'
        };
        let croAttempt = { ...croDataBase };
        for (let i = 0; i < 10; i++) {
          const { error: ce } = await db.insert('cro', croAttempt);
          if (!ce || ce.code === '23505') break;
          if (ce.code !== '22P02') break;
          const key = Object.keys(croAttempt).find(k => k !== 'id');
          if (!key) break;
          const { [key]: _, ...rest } = croAttempt;
          croAttempt = rest;
        }
      } catch (e) {}

      // 4. Notify customer
      const plat = item.bk || '';
      const announceText = `${plat} telah selesai, mobil bisa diambil`;

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plat,
          title: '✅ Kendaraan Selesai',
          body: announceText,
          url: '/customer'
        })
      }).catch(() => {});

      Toastify({
        text: `✅ Konfirmasi ${item.bk} berhasil — Data dipindahkan ke riwayat`,
        duration: 4000,
        style: { background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "12px", fontWeight: "900" }
      }).showToast();

      // Optimistic remove + re-fetch
      setQueue(prev => prev.filter(q => q.id !== item.id));
      fetchQueueRef.current();

    } catch (err) {
      console.error("Confirm Completion Error:", err);
      Toastify({
        text: `❌ GAGAL: ${err.message || "Terjadi kesalahan sistem"}`,
        duration: 10000,
        close: true,
        style: { background: "#dc2626", borderRadius: "12px" }
      }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleStartCuci = async (item) => {
    if (isLoadingProcess) return;
    if (!window.confirm(`Mulai pencucian untuk ${item.bk}?`)) return;
    setIsLoadingProcess(true);
    try {
      const cuciDurasi = 30 * 60; // 30 menit
      const targetTime = Date.now() + (cuciDurasi * 1000);
      const cuciPayload = {
        status: 'sedang_dicuci',
        cuci_mulai: new Date().toISOString(),
        targetTime: targetTime,
        estimasiDefault: cuciDurasi,
      };
      const { error } = await db.update('antrian', cuciPayload, { eq: { id: item.id } });
      if (error) {
        if (error.code === 'PGRST204') {
          delete cuciPayload.cuci_mulai;
          const { error: retryError } = await db.update('antrian', cuciPayload, { eq: { id: item.id } });
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'sedang_dicuci', cuci_mulai: new Date().toISOString(), targetTime, estimasiDefault: cuciDurasi } : q
      ));
      fetchQueueRef.current();
      Toastify({ text: `🧽 ${item.bk} sedang dicuci`, background: "#0d9488", borderRadius: "12px", fontWeight: "900" }).showToast();
    } catch (err) {
      Toastify({ text: `❌ Gagal mulai cuci: ${err.message}`, background: "#dc2626", borderRadius: "12px" }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleCompleteCuci = async (item) => {
    if (isLoadingProcess) return;
    if (!window.confirm(`Selesaikan pencucian ${item.bk}?`)) return;
    setIsLoadingProcess(true);
    try {
      const now = new Date().toISOString();
      const { error } = await db.update('antrian', {
        status: 'menunggu_konfirmasi',
        waktuSelesai: now,
      }, { eq: { id: item.id } });
      if (error) throw error;

      // Cari mobil berikutnya di antrian cuci (status = menunggu_cuci)
      const nextInLine = queue
        .filter(q => q.status === 'menunggu_cuci' && q.id !== item.id)
        .sort((a, b) => parseInt(a.id) - parseInt(b.id))[0];

      if (nextInLine) {
        const cuciDurasi = 30 * 60;
        const targetTime = Date.now() + (cuciDurasi * 1000);
        const nextPayload = {
          status: 'sedang_dicuci',
          cuci_mulai: new Date().toISOString(),
          targetTime: targetTime,
          estimasiDefault: cuciDurasi
        };
        await db.update('antrian', nextPayload, { eq: { id: nextInLine.id } });
      }

      setQueue(prev => prev.map(q => {
        if (q.id === item.id) {
          return { ...q, status: 'menunggu_konfirmasi', waktuSelesai: now };
        }
        if (nextInLine && q.id === nextInLine.id) {
          const cuciDurasi = 30 * 60;
          return { ...q, status: 'sedang_dicuci', cuci_mulai: now, targetTime: Date.now() + (cuciDurasi * 1000), estimasiDefault: cuciDurasi };
        }
        return q;
      }));
      fetchQueueRef.current();
      Toastify({ text: `✅ ${item.bk} selesai dicuci — Menunggu konfirmasi admin`, background: "#059669", borderRadius: "12px", fontWeight: "900" }).showToast();
      if (nextInLine) {
        Toastify({ text: `🧼 ${nextInLine.bk} otomatis masuk pencucian`, background: "#0d9488", borderRadius: "12px", fontWeight: "900" }).showToast();
      }
    } catch (err) {
      Toastify({ text: `❌ Gagal selesai cuci: ${err.message}`, background: "#dc2626", borderRadius: "12px" }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleCallQueue = async (item, counterNum) => {
    if (isLoadingProcess) return;

    if (item.calledAt) {
      const cooldownMs = (callCooldownRef.current || 120) * 1000;
      const elapsed = Date.now() - new Date(item.calledAt).getTime();
      if (elapsed < cooldownMs) {
        const sisa = Math.ceil((cooldownMs - elapsed) / 1000);
        Toastify({
          text: `⏳ Tunggu ${sisa} detik lagi sebelum panggil ulang`,
          duration: 3000,
          style: { background: "#f59e0b", borderRadius: "12px", fontWeight: "900" }
        }).showToast();
        return;
      }
    }

    setIsLoadingProcess(true);
    try {
      const now = new Date().toISOString();
      await db.update('antrian', {
        is_called: true,
        counter: counterNum,
        called_at: now
      }, { eq: { id: item.id } });

      const queueNum = item.queueNumber || item.queue_number || '';
      const plat = item.bk || '';
      const cat = item.category === 'Booking' ? 'Booking' : 'Reguler';
      const isFinished = item.status === 'menunggu_konfirmasi' || item.status === 'completed';
      const announceText = isFinished
        ? `${plat} telah selesai, silahkan menuju counter ${counterNum}`
        : `Antrian ${cat} nomor ${queueNum}, silahkan menuju counter ${counterNum}`;

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plat,
          title: '📢 Panggilan Antrian',
          body: announceText,
          url: '/customer'
        })
      }).catch(() => {});

      speak(announceText);

      Toastify({
        text: `📢 ${announceText}`,
        duration: 6000,
        close: true,
        gravity: "top",
        position: "center",
        style: { background: "linear-gradient(135deg, #2563eb, #1d4ed8)", borderRadius: "16px", fontWeight: "900" }
      }).showToast();
    } catch (err) {
      console.error("Gagal memanggil antrian:", err);
      Toastify({ text: "❌ Gagal memanggil antrian", style: { background: "#dc2626" } }).showToast();
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const editItem = (item) => {
    const rawKeluhan = item.keluhan || '';
    let jenisPekerjaan = [];
    let keluhanText = '';
    const kelMatch = rawKeluhan.match(/^((?:FS[123]|Keluhan|Update Software)(?:\s*\+\s*(?:FS[123]|Keluhan|Update Software))*):\s*/);
    if (kelMatch) {
      jenisPekerjaan = kelMatch[1].split(/\s*\+\s*/);
      keluhanText = rawKeluhan.slice(kelMatch[0].length);
    } else if (rawKeluhan) {
      keluhanText = rawKeluhan;
    }
    setFormData({
      ...item,
      jenisPekerjaan,
      keluhan: keluhanText,
      jam: Math.floor(item.estimasi / 3600),
      menit: Math.floor((item.estimasi % 3600) / 60),
      detik: item.estimasi % 60,
      mechanicName: item.mechanicName || '',
      checklist: item.checklist || [],
      menginap_reason: item.menginap_reason || '',
      cuci: item.cuci_required || false,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', jenisPekerjaan: [], keluhan: '', mechanicName: '', checklist: [], menginap_reason: '', noTelp: '' });
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
  const showNavbar = user && currentPage !== 'login' && currentPage !== 'register' && user?.role?.toLowerCase() !== 'display';
  // Check if on a dashboard page (not public)
  const publicPages = ['display', 'booking-public', 'login', 'register'];
  const isOnDashboard = user && !publicPages.includes(currentPage);
  const sidebarItemsCount = user ? getNavItems(user.role?.toLowerCase()).length : 0;
  const showMobileTopBar = isOnDashboard && sidebarItemsCount > 1;

  return (
    <div className={`bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased h-screen flex flex-col relative transition-colors duration-500 overflow-hidden ${showNavbar ? 'pb-[64px] md:pb-0' : ''} ${showMobileTopBar ? 'pt-14 md:pt-0' : ''}`}>

      {/* Universal Navigation - same navbar for all pages (public & logged in) */}
      {showNavbar && (
        <PublicNavBar
          user={user}
          currentPage={currentPage}
          onNavigate={navigate}
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
      <main className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden ${showNavbar ? 'md:ml-[220px]' : ''}`}>
      <div key={currentPage} className={`w-full flex-1 min-h-0 ${animDir === 'forward' ? 'animate-slideInRight' : 'animate-slideInLeft'}`}>
      {currentPage === 'display' && user?.role?.toLowerCase() !== 'customer' && (
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
      {currentPage === 'login' && <LoginPage loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} errorMessage={errorMessage} setCurrentPage={navigate} />}
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={fullProcessedQueue} rawHistory={rawHistory} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} handleCancelEdit={handleCancelEdit} formData={formData} setFormData={setFormData} isEditing={isEditing} setIsEditing={setIsEditing} errorMessage={errorMessage} isLoadingProcess={isLoadingProcess} formatTime={formatTime} handleComplete={handleComplete} handleConfirmCompletion={handleConfirmCompletion} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} breakSettings={breakSettings} setBreakSettings={setBreakSettings} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} playNotificationSound={playNotificationSound} handleCallQueue={handleCallQueue} activeTab="dashboard" callCooldown={callCooldownRef.current} onApproveExtension={handleApproveExtension} onRejectExtension={handleRejectExtension} handleStartCuci={handleStartCuci} handleCompleteCuci={handleCompleteCuci} showJenis={adminShowJenisRef.current} showChecklist={adminShowChecklistRef.current} />}
      {currentPage === 'admin-booking' && <AdminBookingPanel />}
      {currentPage === 'admin-wo' && <WarrantyWorkOrderPage />}
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
          onRequestExtension={handleRequestExtension}
        />
      )}
      {currentPage === 'foreman' && (
        <ForemanPanel
          user={user}
          handleLogout={handleLogout}
          handleChangePassword={handleChangePassword}
          queue={fullProcessedQueue}
          formatTime={formatTime}
          onStartWork={handleStartWork}
          onComplete={handleComplete}
          onRequestExtension={handleRequestExtension}
          onForemanAddTime={handleForemanAddTime}
          isLoadingProcess={isLoadingProcess}
        />
      )}
      {currentPage === 'sparepart-profit' && <SparepartPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} setCurrentPage={navigate} activeTab="profit" />}
      {currentPage === 'sparepart-dms-order' && <SparepartPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} setCurrentPage={navigate} activeTab="dms_order" />}
      {currentPage === 'sparepart-dms' && user?.role === 'sparepart' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="dms_search" />
      )}
      {currentPage === 'sparepart-cost' && user?.role === 'sparepart' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="sparepart_cost" />
      )}
      {currentPage === 'booking_manager' && <BookingManager user={user} handleLogout={handleLogout} isNavbarVisible={true} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />}
      {currentPage === 'cro' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="belum" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-sudah' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="sudah" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-freeservice' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="free_service" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-laporan' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="laporan" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-booking' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="booking" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-booking-approval' && (
        <BookingApprovalQueue user={user} setCurrentPage={navigate} />
      )}
      {currentPage === 'cro-holidays' && (
        <FollowupPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} isNavbarVisible={true} initialTab="holidays" setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
      )}
      {currentPage === 'cro-csi' && (
        <CsiResult />
      )}
      {currentPage === 'cro-customers' && (
        <CsiCustomers />
      )}
      {currentPage === 'booking-public' && <PublicBooking user={user} setCurrentPage={navigate} />}
      {currentPage === 'sa-booking' && <SABookingPanel />}
      {currentPage === 'sales-booking' && user?.role?.toLowerCase() === 'sales' && <StaffBookingPanel user={user} handleChangePassword={handleChangePassword} handleLogout={handleLogout} />}
      {currentPage === 'spv-booking' && user?.role?.toLowerCase() === 'spv' && <StaffBookingPanel user={user} handleChangePassword={handleChangePassword} handleLogout={handleLogout} />}
      {currentPage === 'booking-settings' && <BookingSettings />}
      {currentPage === 'promo' && <PromosiSparepart />}
      {currentPage === 'manager' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="performance" />}
      {currentPage === 'manager-financial' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="financial" />}
      {currentPage === 'manager-wo' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="wo_tracking" />}
      {currentPage === 'manager-vehicles' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="vehicles" />}
      {currentPage === 'manager-cro' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="cro_history" />}
      {currentPage === 'manager-holidays' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="holidays" />}
      {currentPage === 'manager-staff' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} queue={queue} rawHistory={rawHistory} setCurrentPage={navigate} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={() => {}} activeTab="staff" />}
      {currentPage === 'owner' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="monitoring" />
      )}
      {currentPage === 'owner-workshop' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="workshop" />
      )}
      {currentPage === 'owner-dms' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="dms_search" />
      )}
      {currentPage === 'owner-warranty' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="warranty_search" />
      )}
      {currentPage === 'owner-parts' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="part_orders" />
      )}
      {currentPage === 'owner-users' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="users" />
      )}
      {currentPage === 'owner-sound' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="notification_sound" />
      )}
      {currentPage === 'owner-sparepart-cost' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="sparepart_cost" />
      )}
      {currentPage === 'owner-deleted' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="deleted_bookings" />
      )}
      {currentPage === 'owner-unit-entry' && user?.role === 'owner' && (
        <OwnerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} processedQueue={processedQueue} rawHistory={rawHistory} formatTime={formatTime} handleSave={handleSave} deleteItem={deleteItem} editItem={editItem} setFormData={setFormData} formData={formData} isEditing={isEditing} setIsEditing={setIsEditing} handleCancelEdit={handleCancelEdit} handleAddTask={handleAddTask} handleRemoveTask={handleRemoveTask} handleToggleTask={handleToggleTask} isLoadingProcess={isLoadingProcess} setCurrentPage={navigate} activeTab="unit_entry" />
      )}
      {currentPage === 'stock-comparison' && (
        <StockComparison user={user} setCurrentPage={navigate} />
      )}
      {currentPage === 'warranty' && <WarrantyHub activeTab="dashboard" user={user} handleChangePassword={handleChangePassword} />}
      {currentPage === 'warranty-wo' && <WarrantyHub activeTab="wo" user={user} handleChangePassword={handleChangePassword} />}
      {currentPage === 'warranty-search' && <WarrantyHub activeTab="search" user={user} handleChangePassword={handleChangePassword} />}
      {currentPage === 'warranty-proforma' && <ProformaInvoice />}
      {currentPage === 'security' && (
        <SecurityPanel
          user={user}
          handleLogout={handleLogout}
          handleChangePassword={handleChangePassword}
        />
      )}
      {currentPage === 'register' && (
        <RegisterPage 
          setCurrentPage={navigate} 
          setErrorMessage={setErrorMessage} 
          errorMessage={errorMessage} 
        />
      )}
      {currentPage === 'customer' && user?.role === 'customer' && (
        !user.plat_bk ? (
          <CustomerProfile user={user} setUser={setUser} />
        ) : (
          <CustomerPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} setCurrentPage={navigate} />
        )
      )}
      {currentPage === 'customer-complaint' && user?.role === 'customer' && user?.plat_bk && (
        <CustomerComplaint user={user} onBack={goBack} />
      )}

      </div>
      </main>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
        .animate-slideInRight { animation: slideInRight 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
        .animate-slideInLeft { animation: slideInLeft 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
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