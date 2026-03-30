import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings, Calendar, Plus } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

import { API_KEY, GAS_URL, GAS_USERS_URL } from './utils/config';
import { supabase } from './utils/supabaseClient';

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

  // Fetch Data dari Supabase (Disesuaikan dengan Nama Kolom User)
  const fetchQueue = React.useCallback(async () => {
    try {
      const { data: activeQueue, error: qError } = await supabase
        .from('antrian')
        .select('*');
        
      const { data: historyData, error: hError } = await supabase
        .from('history')
        .select('*')
        .order('id', { ascending: false }) // Fallback urutan ID karena tidak ada completed_at
        .limit(100);

      if (qError) throw qError;
      if (hError) throw hError;

      const mapDbToApp = (item) => ({
        id: item.id,
        bk: item.bk,
        tipe: item.tipe,
        category: item.category,
        keluhan: item.keluhan,
        mechanicName: item.mechanicName, // Disesuaikan dari mechanic_name
        status: item.status,
        estimasiDefault: item.estimasiDefault, // Disesuaikan dari estimasi_default
        targetTime: item.targetTime, // Disesuaikan dari target_time
        addedBy: item.addedBy // Disesuaikan dari added_by
      });

      setQueue((activeQueue || []).map(mapDbToApp));
      setRawHistory((historyData || []).map(mapDbToApp));
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

    return () => {
      supabase.removeChannel(antrianSubscription);
      supabase.removeChannel(historySubscription);
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
  // SINGLE SESSION GUARD — Realtime (< 1 detik kick)
  // Jika ada login baru dari perangkat lain, sesi lama LANGSUNG
  // di-logout tanpa menunggu polling.
  // ============================================================
  useEffect(() => {
    if (!user || !sessionId || currentPage === 'display') return;

    // Subscribe ke perubahan baris user ini di Supabase
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

          // Jika sessionId di DB sudah berubah → ada yang login dari perangkat lain
          if (updatedRow.sessionId && updatedRow.sessionId !== sessionId) {
            const where = updatedRow.lastLocation || updatedRow.lastIP || 'perangkat lain';
            const device = updatedRow.lastDevice || 'perangkat tidak dikenal';
            const browser = updatedRow.lastBrowser || '';

            handleLogout();

            // Tampilkan notifikasi yang informatif
            Toastify({
              text: `🔐 Akun Anda dibuka di ${device}${browser ? ` (${browser})` : ''} dari ${where}. Sesi Anda telah berakhir.`,
              duration: 0,
              close: true,
              gravity: 'top',
              position: 'center',
              style: {
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                borderRadius: '16px',
                fontWeight: '800',
                fontSize: '13px',
                padding: '16px 24px',
                maxWidth: '420px',
                boxShadow: '0 20px 60px rgba(220,38,38,0.4)',
              }
            }).showToast();

            // Suara notifikasi
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch (e) {}
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
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua)) browser = 'Safari';

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
        .select('*')
        .eq('username', cleanUsername)
        .eq('password', cleanPassword)
        .single();

      if (data) {
        const { device, browser } = getDeviceInfo();
        const loginTime = new Date().toLocaleString('id-ID');

        // Ambil IP & Lokasi dari API publik (tanpa auth)
        let ipAddress = '-';
        let location = '-';
        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          const geoData = await geoRes.json();
          ipAddress = geoData.ip || '-';
          location = `${geoData.city || ''}, ${geoData.region || ''}, ${geoData.country_name || ''}`.replace(/^, |, $/g, '');
        } catch (_) { /* Gagal ambil IP, lanjutkan saja */ }

        // Simpan semua info ke Supabase sekaligus
        await supabase.from('users').update({
          sessionId: newSessionId,
          lastDevice: device,
          lastBrowser: browser,
          lastIP: ipAddress,
          lastLocation: location,
          lastLogin: loginTime,
          isOnline: true
        }).eq('username', data.username);

        const userData = { name: data.name, username: data.username, role: data.role };
        setUser(userData);
        setSessionId(newSessionId);
        setLoginForm({ username: '', password: '' });

        const targetPage = data.role === 'mekanik' ? 'mechanic' :
          data.role === 'sparepart' ? 'sparepart' :
          data.role === 'cro' ? 'cro' :
          data.role === 'manager' ? 'manager' :
          data.role === 'owner' ? 'owner' : 'admin';
        setCurrentPage(targetPage);
        setErrorMessage('');
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

    let updates = {
      bk: formData.bk.toUpperCase(),
      tipe: formData.tipe,
      category: formData.category,
      keluhan: formData.keluhan || '',
      mechanicName: formData.mechanicName || '', // Disesuaikan
    };

    if (isEditing) {
      updates.id = formData.id;
      if (formData.status === 'working') {
        updates.targetTime = Date.now() + (totalSeconds * 1000); // Disesuaikan
        updates.estimasiDefault = totalSeconds; // Disesuaikan
      } else if (!formData.status) {
        updates.targetTime = Date.now() + (totalSeconds * 1000); // Disesuaikan
        updates.estimasiDefault = totalSeconds;
      } else {
        updates.estimasiDefault = totalSeconds;
      }
    } else {
      updates.id = Date.now(); // Karena id di schema Anda NOT NULL tapi tidak ditulis IDENTITY, kita isi manual
      updates.status = 'waiting';
      updates.addedBy = user.name; // Disesuaikan
      updates.estimasiDefault = totalSeconds;
    }

    try {
      if (isEditing) {
        const { error } = await supabase.from('antrian').update(updates).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('antrian').insert(updates);
        if (error) throw error;
      }
      
      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler', keluhan: '', mechanicName: '' });
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
    if (!user || user.role !== 'mekanik' || isLoadingProcess) return;

    if (item.status === 'menginap' && item.mechanicName && item.mechanicName !== user.name) {
      alert("Hanya mekanik yang mengerjakan sebelumnya yang bisa melanjutkan!");
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

  const handleSetOvernight = async (item) => {
    if (isLoadingProcess) return;
    setIsLoadingProcess(true);

    let sisaDetik = parseInt(item.estimasiDefault) || 0;
    if (item.status === 'working') {
      const targetTime = parseInt(item.targetTime) || Date.now();
      sisaDetik = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    }

    try {
      await supabase.from('antrian').update({
        status: 'menginap',
        estimasiDefault: sisaDetik, // Disesuaikan
        targetTime: 0, // Disesuaikan
        mechanicName: item.mechanicName || '' // Disesuaikan
      }).eq('id', item.id);
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
      await supabase.from('antrian').update({
        status: 'waiting',
        target_time: 0
      }).eq('id', item.id);
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
        waktuSelesai: new Date().toLocaleString() // Sesuaikan dengan format text/string Anda
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
      mechanicName: item.mechanicName || ''
    });
    setIsEditing(true);
  };

  return (
    <div className="bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased h-screen overflow-hidden flex flex-col">
      {/* Navbar Tetap di App.jsx */}
      <div
        onMouseEnter={() => setIsNavbarVisible(true)}
        onMouseLeave={() => setIsNavbarVisible(false)}
        className="fixed top-0 left-0 w-full z-[100] h-14 group"
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
              <button onClick={() => user ? (user.role === 'sparepart' ? setCurrentPage('sparepart') : (user.role === 'cro' && currentPage === 'cro-booking') ? setCurrentPage('cro') : user.role === 'cro' ? setCurrentPage('cro') : user.role === 'manager' ? setCurrentPage('manager') : user.role === 'owner' ? setCurrentPage('owner') : setCurrentPage('admin')) : setCurrentPage('login')}
                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${['admin', 'login', 'sparepart', 'cro', 'manager', 'owner'].includes(currentPage) ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Settings size={14} /> {user?.role === 'sparepart' ? 'Sparepart' : user?.role === 'cro' ? 'CRO Follow Up' : user?.role === 'manager' ? 'Manager Dashboard' : user?.role === 'owner' ? 'Owner Dashboard' : 'Admin'}
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
      {currentPage === 'owner' && user?.role === 'owner' && <OwnerPanel user={user} handleLogout={handleLogout} />}

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