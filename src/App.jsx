import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings, Calendar, Plus } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

import { API_KEY, GAS_URL, GAS_USERS_URL } from './utils/config';

// Import Komponen Terpisah
import DisplayBoard from './components/DisplayBoard';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import PromosiSparepart from './components/PromosiSparepart';
import MechanicPanel from './components/MechanicPanel';
import SparepartPanel from './components/SparepartPanel';
import FollowupPanel from './components/FollowupPanel';
import ManagerPanel from './components/ManagerPanel';
import PublicBooking from './components/PublicBooking';
import CroBookingPanel from './components/CroBookingPanel';
import BookingManager from './components/BookingManager';
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
  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('chery_current_page') || 'display';
  });

  useEffect(() => {
    localStorage.setItem('chery_current_page', currentPage);
  }, [currentPage]);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chery_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('chery_session_id') || null;
  });
  const [queue, setQueue] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [formData, setFormData] = useState({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '' });
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

  // Save break settings to localStorage
  useEffect(() => {
    localStorage.setItem('chery_break_settings', JSON.stringify(breakSettings));
  }, [breakSettings]);

  // Fetch Data dari Apps Script
  const fetchQueue = React.useCallback(async () => {
    try {
      // Fetch Antrean & History (Hanya data operasional, bukan data user)
      const response = await customFetch(GAS_URL);
      const data = await response.json();

      if (data && !Array.isArray(data) && Array.isArray(data.queue)) {
        setQueue(data.queue || []);
        setRawHistory(data.history || []);
      } else if (Array.isArray(data)) {
        const activeQueue = data.filter(item => item.status !== 'completed');
        const historyData = data.filter(item => item.status === 'completed');
        setQueue(activeQueue);
        setRawHistory(historyData);
      } else {
        setQueue([]);
        setRawHistory([]);
      }
      // PENTING: Jangan lagi memanggil GAS_USERS_URL di sini untuk mengambil semua user!
    } catch (error) {
      console.error("Gagal mengambil data operasional", error);
    }
  }, []);

  // Sinkronisasi dengan Google Sheets - OPTIMIZED FOR VERCEL FREE LIMITS
  useEffect(() => {
    fetchQueue(); // Ambil data pertama kali

    const interval = setInterval(() => {
      // 1. CEK VISIBILITAS: Jika tab tidak dibuka (browser di-minimize), BERHENTI POLING TOTAL.
      if (document.visibilityState !== 'visible') return;

      // 2. ADAPTIVE SPEED:
      // - Jika sedang di Board (TV): Cepat (15 detik)
      // - Jika sedang di Laporan/Setting: Lambat (60 detik)
      // - Default: 30 detik
      const currentInterval = (currentPage === 'display') ? 15000 :
        (['manager', 'cro', 'sparepart'].includes(currentPage)) ? 60000 : 30000;

      // Logika agar tidak numpuk request jika interval belum tercapai (pake timestamp)
      const lastFetch = parseInt(localStorage.getItem('last_fetch_raw') || '0');
      if (Date.now() - lastFetch >= currentInterval) {
        fetchQueue();
        localStorage.setItem('last_fetch_raw', Date.now().toString());
      }
    }, 5000); // Cek status tiap 5 detik tanpa narik data berat

    return () => clearInterval(interval);
  }, [fetchQueue, currentPage]);

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

  // Session Check (Single Device Login - Adaptive Real-time)
  useEffect(() => {
    if (!user || !sessionId || currentPage === 'display') return;

    let lastInteraction = Date.now();
    const updateInteraction = () => { lastInteraction = Date.now(); };

    // Listeners for user activity
    window.addEventListener('mousemove', updateInteraction);
    window.addEventListener('keydown', updateInteraction);
    window.addEventListener('scroll', updateInteraction, true);

    const checkSession = async () => {
      try {
        const res = await customFetch(`${GAS_USERS_URL}?action=checkSession`, {
          method: 'POST',
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ username: user.username, sessionId: sessionId })
        });
        const data = await res.json();
        
        if (data.status === 'success' && data.valid === false) {
          handleLogout();
          Toastify({
            text: "⚠️ Seseorang telah login ke akun Anda dari perangkat lain.",
            duration: 0, close: true, gravity: "top", position: "center",
            style: { background: "#ef4444", borderRadius: "12px", fontWeight: "900" }
          }).showToast();
          try { new Audio('/notification.mp3').play().catch(() => {}); } catch(e) {}
        }
      } catch (e) {
        console.error("Session check failed", e);
      }
    };

    const runPolling = async () => {
      await checkSession();
      
      // Adaptive timing
      const idleTime = Date.now() - lastInteraction;
      const isTabHidden = document.visibilityState !== 'visible';
      
      let nextInterval = 5000; // Default REAL-TIME 5s
      
      if (isTabHidden) {
        nextInterval = 300000; // 5 minutes if tab hidden
      } else if (idleTime > 120000) {
        nextInterval = 60000; // 1 minute if idle for 2 mins
      }
      
      timeoutId = setTimeout(runPolling, nextInterval);
    };

    let timeoutId = setTimeout(runPolling, 5000);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', updateInteraction);
      window.removeEventListener('keydown', updateInteraction);
      window.removeEventListener('scroll', updateInteraction, true);
    };
  }, [user, sessionId, currentPage]);

  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const playNotificationSound = React.useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
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

  // Check for new completed items
  useEffect(() => {
    if (rawHistory.length > 0 && notifiedIds.size > 0) {
      const newItems = rawHistory.filter(item => !notifiedIds.has(item.id));
      if (newItems.length > 0) {
        // Mainkan suara notifikasi
        try { playNotificationSound(); } catch (e) { console.error("Audio block", e); }

        if ("Notification" in window && Notification.permission === "granted") {
          newItems.forEach(item => {
            new Notification(`✅ Mobil Selesai`, { body: `Mobil BK ${item.bk} (${item.tipe}) sudah selesai.` });

            // Also show in-app notification to all users currently having the site open
            Toastify({
              text: `✅ Mobil BK ${item.bk} (${item.tipe}) sudah selesai.`,
              duration: 10000,
              close: true,
              gravity: "top",
              position: "right",
              style: {
                background: "#22c55e",
                borderRadius: "12px",
                fontWeight: "900",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
              }
            }).showToast();
          });
        } else {
          newItems.forEach(item => {
            // Fallback if browser push is disabled
            Toastify({
              text: `✅ Mobil BK ${item.bk} (${item.tipe}) sudah selesai.`,
              duration: 10000,
              close: true,
              gravity: "top",
              position: "right",
              style: {
                background: "#22c55e",
                borderRadius: "12px",
                fontWeight: "900",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
              }
            }).showToast();
          })
        }
        setNotifiedIds(prev => {
          const newSet = new Set(prev);
          newItems.forEach(i => newSet.add(i.id));
          return newSet;
        });
      }
    } else if (rawHistory.length > 0 && notifiedIds.size === 0) {
      // First load, don't notify but populate the set
      setNotifiedIds(new Set(rawHistory.map(item => item.id)));
    }
  }, [rawHistory, notifiedIds, playNotificationSound]);

  const isAutoUpdating = useRef(false);

  useEffect(() => {
    const checkAutoStatus = async () => {
      if (isAutoUpdating.current) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const day = now.getDay();

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
              await customFetch(`${GAS_URL}?action=update`, {
                method: "POST",
                body: JSON.stringify({
                  id: item.id,
                  status: targetStatus,
                  estimasiDefault: sisaDetik,
                  mechanicName: item.mechanicName || '',
                  targetTime: 0
                }),
              });
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
              await customFetch(`${GAS_URL}?action=update`, {
                method: "POST",
                body: JSON.stringify({
                  id: item.id,
                  status: 'working',
                  targetTime: targetTime,
                  mechanicName: item.mechanicName || ''
                }),
              });
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
        // Hitung sisa detik berdasarkan target waktu selesai atau default
        let diff = parseInt(item.estimasiDefault) || 0;

        // Cek targetTime valid
        const targetTime = parseInt(item.targetTime);
        if (item.status === 'working' && targetTime && !isNaN(targetTime)) {
          diff = Math.max(0, Math.floor((targetTime - now) / 1000));
        } else if (!item.status && targetTime && !isNaN(targetTime)) {
          diff = Math.max(0, Math.floor((targetTime - now) / 1000));
        }

        return { ...item, estimasi: diff };
      })
      .sort((a, b) => {
        if (a.category === 'Booking' && b.category !== 'Booking') return -1;
        if (a.category !== 'Booking' && b.category === 'Booking') return 1;
        return 0;
      });
  }, [queue, now]);

  const processedQueue = useMemo(() => fullProcessedQueue, [fullProcessedQueue]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoadingProcess(true);

    try {
      // Sanitasi input sebelum dikirim ke server
      const cleanUsername = sanitizeInput(loginForm.username);
      const cleanPassword = sanitizeInput(loginForm.password);

      // Generate New Session ID
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

      // Verifikasi di Sisi Server (GAS)
      const response = await customFetch(`${GAS_USERS_URL}?action=login`, {
        method: 'POST',
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
          sessionId: newSessionId
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Data yang disimpan hanya info dasar, BUKAN PASSWORD
        const userData = { name: data.user.name, username: data.user.username, role: data.user.role };
        setUser(userData);
        setSessionId(newSessionId);
        setLoginForm({ username: '', password: '' });

        const targetPage = data.user.role === 'mekanik' ? 'mechanic' :
          data.user.role === 'sparepart' ? 'sparepart' :
            data.user.role === 'cro' ? 'cro' :
              data.user.role === 'manager' ? 'manager' : 'admin';
        setCurrentPage(targetPage);
        setErrorMessage("");
      } else {
        setErrorMessage("Username atau Password salah!");
        setTimeout(() => setErrorMessage(""), 3000);
      }
    } catch (error) {
      console.error("Login Error:", error);
      setErrorMessage("Gagal terhubung ke server keamanan!");
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
      // Mengirim request penggantian password ke GAS Users Web App
      if (!GAS_USERS_URL || GAS_USERS_URL.trim() === "") {
        return { success: false, message: "URL GAS Users belum di-setting. Anda tidak bisa mengganti password via server." };
      }

      const res = await customFetch(`${GAS_USERS_URL}?action=changePassword`, {
        method: "POST",
        body: JSON.stringify({
          username: user.username,
          newPassword: newPassword
        })
      });
      const data = await res.json();

      if (data.status === 'success') {
        fetchQueue(); // Ambil ulang data users dari sheet
        return { success: true, message: "Password berhasil diubah!" };
      } else {
        return { success: false, message: data.message || "Gagal mengubah password" };
      }
    } catch (error) {
      console.error(error);
      return { success: false, message: "Gagal terhubung ke server!" };
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('display');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isLoadingProcess) return;

    const totalSeconds = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
    if (!isEditing && totalSeconds < 1800) {
      setErrorMessage("Waktu minimal pengerjaan adalah 30 menit!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    setIsLoadingProcess(true);
    let action = isEditing ? 'update' : 'add';

    let updates = {
      id: isEditing ? formData.id : Date.now(),
      bk: formData.bk.toUpperCase(),
      tipe: formData.tipe,
      category: formData.category,
      estimasiDefault: totalSeconds,
      keluhan: formData.keluhan || '',
      mechanicName: formData.mechanicName || '',
    };

    if (isEditing) {
      // Jika status sedang dikerjakan, pastikan targetTime juga diperbarui agar mundurannya relevan
      if (formData.status === 'working') {
        updates.targetTime = Date.now() + (totalSeconds * 1000);
      } else if (!formData.status) {
        // Fallback untuk file lama
        updates.targetTime = Date.now() + (totalSeconds * 1000);
      }
    } else {
      updates.status = 'waiting';
      updates.addedBy = user.name;
    }

    try {
      await customFetch(`${GAS_URL}?action=${action}`, {
        method: "POST",
        body: JSON.stringify(updates),
      });
      // Ambil data terbaru langsung
      fetchQueue();
      // Reset form setelah save
      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '' });
      setIsEditing(false);
    } catch (error) {
      console.error("Gagal menyimpan data", error);
      setErrorMessage("Gagal menyimpan data ke Google Sheets");
      setTimeout(() => setErrorMessage(""), 3000);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const deleteItem = async (id) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);
    try {
      await customFetch(`${GAS_URL}?action=delete`, {
        method: "POST",
        body: JSON.stringify({ id: id }),
      });
      fetchQueue();
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
        await customFetch(`${GAS_URL}?action=clear`, {
          method: "POST",
        });
        fetchQueue();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingProcess(false);
      }
    }
  };

  const handleStartWork = async (item) => {
    if (!user || user.role !== 'mekanik' || isLoadingProcess) return;

    if (item.status === 'menginap' && item.mechanicName && item.mechanicName !== user.name) {
      alert("Hanya mekanik yang mengerjakan sebelumnya yang bisa melanjutkan!");
      return;
    }

    setIsLoadingProcess(true);

    const estimasiDefaultInt = parseInt(item.estimasiDefault) || 1800;
    const targetTime = Date.now() + (estimasiDefaultInt * 1000);

    try {
      await customFetch(`${GAS_URL}?action=update`, {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          status: 'working',
          targetTime: targetTime,
          mechanicName: user.name
        }),
      });
      fetchQueue();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleSetOvernight = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    let sisaDetik = parseInt(item.estimasiDefault) || 0;
    if (item.status === 'working') {
      const targetTime = parseInt(item.targetTime) || Date.now();
      sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    }

    try {
      await customFetch(`${GAS_URL}?action=update`, {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          status: 'menginap',
          estimasiDefault: sisaDetik,
          mechanicName: item.mechanicName || '',
          targetTime: 0
        }),
      });
      fetchQueue();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleCancelOvernight = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    try {
      await customFetch(`${GAS_URL}?action=update`, {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          status: 'waiting',
          targetTime: 0
        }),
      });
      fetchQueue();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handleComplete = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    try {
      await customFetch(`${GAS_URL}?action=complete`, {
        method: "POST",
        body: JSON.stringify({
          id: item.id
        }),
      });

      fetchQueue();
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
      mechanicName: item.mechanicName || ''
    });
    setIsEditing(true);
  };

  return (
    <div className={`bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased ${['sparepart', 'cro'].includes(currentPage) ? 'h-screen overflow-hidden' : 'min-h-screen pb-12 pt-16'}`}>
      {/* Navbar Tetap di App.jsx */}
      <div
        onMouseEnter={() => setIsNavbarVisible(true)}
        onMouseLeave={() => setIsNavbarVisible(false)}
        onClick={() => setIsNavbarVisible(prev => !prev)}
        className="fixed top-0 left-0 w-full z-50 group"
      >
        <nav className={`bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-2.5 flex shadow-sm transition-transform duration-500 ease-in-out ${isNavbarVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="max-w-screen-xl mx-auto w-full flex items-center md:justify-center overflow-x-auto no-scrollbar">
            <div className="flex bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200 shadow-inner flex-nowrap shrink-0">
            <button onClick={() => setCurrentPage('display')}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'display' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
              <LayoutDashboard size={14} /> Board
            </button>
            <button onClick={() => setCurrentPage('booking-public')}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'booking-public' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
              <Calendar size={14} /> Booking
            </button>
            {user?.role === 'mekanik' ? (
              <button onClick={() => setCurrentPage('mechanic')}
                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'mechanic' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Settings size={14} /> Profile
              </button>
            ) : (
              <button onClick={() => user ? (user.role === 'sparepart' ? setCurrentPage('sparepart') : (user.role === 'cro' && currentPage === 'cro-booking') ? setCurrentPage('cro') : user.role === 'cro' ? setCurrentPage('cro') : user.role === 'manager' ? setCurrentPage('manager') : setCurrentPage('admin')) : setCurrentPage('login')}
                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${['admin', 'login', 'sparepart', 'cro', 'manager'].includes(currentPage) ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Settings size={14} /> {user?.role === 'sparepart' ? 'Sparepart' : user?.role === 'cro' ? 'CRO Follow Up' : user?.role === 'manager' ? 'Manager Dashboard' : 'Admin'}
              </button>
            )}
            {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cro') && (
              <>
                <div className="w-[1px] h-6 bg-zinc-200 mx-1 self-center shrink-0"></div>
                {user?.role === 'admin' && (
                  <button onClick={() => setCurrentPage('promo')}
                    className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'promo' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900'}`}>
                    Promo
                  </button>
                )}
                {user?.role === 'manager' && (
                  <button onClick={() => setCurrentPage('manager')}
                    className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${currentPage === 'manager' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900'}`}>
                    Management
                  </button>
                )}
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
      {currentPage === 'display' && <DisplayBoard processedQueue={processedQueue} queueLength={queue.length} formatTime={formatTime} user={user} onStartWork={handleStartWork} onLogoDoubleClick={() => setCurrentPage('login')} rawHistory={rawHistory} />}
      {currentPage === 'login' && <LoginPage loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} errorMessage={errorMessage} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} queue={fullProcessedQueue} rawHistory={rawHistory} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} formData={formData} setFormData={setFormData} isEditing={isEditing} errorMessage={errorMessage} formatTime={formatTime} handleComplete={handleComplete} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />}
      {currentPage === 'mechanic' && <MechanicPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} rawHistory={rawHistory} />}
      {currentPage === 'sparepart' && <SparepartPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} />}
      {currentPage === 'cro' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} initialTab="belum" setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'cro-booking' && (
        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={isNavbarVisible} initialTab="booking" setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'booking-public' && <PublicBooking user={user} />}
      {currentPage === 'promo' && <PromosiSparepart />}
      {currentPage === 'manager' && user?.role === 'manager' && <ManagerPanel user={user} handleLogout={handleLogout} queue={queue} rawHistory={rawHistory} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} setIsNavbarVisible={setIsNavbarVisible} />}

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-zinc-200 px-4 md:px-8 py-2 md:py-2.5 flex flex-col md:flex-row justify-between items-center text-[7px] md:text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] z-50 gap-1 md:gap-0">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> Service Operational</span>
          <span className="text-zinc-200 hidden md:block">|</span>
          <span className="hidden sm:inline">{queue.length} Active Cars</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-zinc-300">© 2026 Chery Oriental Medan</span>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default App;