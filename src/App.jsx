import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutDashboard, Settings } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

// Import Komponen Terpisah
import DisplayBoard from './components/DisplayBoard';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import PromosiSparepart from './components/PromosiSparepart';
import MechanicPanel from './components/MechanicPanel';
import { USERS } from './data/users';

const GAS_URL = "/api/gas";
// MASUKKAN LINK WEB APP UNTUK GOOGLE SHEET USERS DI BAWAH INI:
const GAS_USERS_URL = "/api/gas_users";

// Helper function dipindah ke luar agar tidak di-recreate setiap render
const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('display');
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chery_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [queue, setQueue] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [formData, setFormData] = useState({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler' });
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoadingProcess, setIsLoadingProcess] = useState(false);

  const [rawHistory, setRawHistory] = useState([]);
  const [usersData, setUsersData] = useState(USERS);

  // Fetch Data dari Apps Script
  const fetchQueue = useCallback(async () => {
    try {
      // Fetch Antrean & History
      const response = await fetch(GAS_URL);
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

      // Fetch Data Users jika link GAS_USERS_URL sudah diisi
      if (GAS_USERS_URL && GAS_USERS_URL.trim() !== "") {
        const usersResponse = await fetch(GAS_USERS_URL);
        const usersData = await usersResponse.json();

        if (usersData && usersData.users && Array.isArray(usersData.users) && usersData.users.length > 0) {
          setUsersData(usersData.users);
        }
      }

    } catch (error) {
      console.error("Gagal mengambil data dari Google Sheets", error);
    }
  }, []);

  // Sinkronisasi dengan Google Sheets (Polling ringan untuk hemat kuota API)
  useEffect(() => {
    fetchQueue(); // Ambil data pertama kali
    const interval = setInterval(() => {
      // Hanya lakukan polling ke server/Google Script jika tab browsernya sedang aktif (tidak di-minimize)
      if (document.visibilityState === 'visible') {
        fetchQueue();
      }
    }, 10000);
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
  }, [user]);

  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const playNotificationSound = useCallback(() => {
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
  }, [rawHistory, notifiedIds]);

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
         const startIstirahat = currentHour === 12;
         const endIstirahatHourBreak = isFriday ? (currentHour === 13 && currentMinute < 15) : false;
         
         if (startIstirahat || endIstirahatHourBreak) {
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
                await fetch(`${GAS_URL}?action=update`, {
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
                  await fetch(`${GAS_URL}?action=update`, {
                    method: "POST",
                    body: JSON.stringify({
                      id: item.id,
                      status: 'working',
                      targetTime: targetTime,
                      mechanicName: item.mechanicName || ''
                    }),
                  });
               } catch (e) {}
            }
            fetchQueue();
            isAutoUpdating.current = false;
         }
      }
    };
    if (queue.length > 0) {
      checkAutoStatus();
    }
  }, [queue, fetchQueue]);

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

  const handleLogin = (e) => {
    e.preventDefault();

    const foundUser = usersData.find(u => {
      // Prioritaskan password dari usersData (yang diambil dari GAS), fallback ke data/users.js
      return u.username === loginForm.username && u.password === loginForm.password;
    });

    if (foundUser) {
      setUser({ name: foundUser.name, username: foundUser.username, role: foundUser.role });
      // Clear form
      setLoginForm({ username: '', password: '' });
      setCurrentPage(foundUser.role === 'mekanik' ? 'mechanic' : 'admin');
      setErrorMessage("");
    } else {
      setErrorMessage("Username atau Password salah!");
      setTimeout(() => setErrorMessage(""), 3000);
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

      const res = await fetch(`${GAS_USERS_URL}?action=changePassword`, {
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
      await fetch(`${GAS_URL}?action=${action}`, {
        method: "POST",
        body: JSON.stringify(updates),
      });
      // Ambil data terbaru langsung
      fetchQueue();
      // Reset form setelah save
      setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler' });
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
      await fetch(`${GAS_URL}?action=delete`, {
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
        await fetch(`${GAS_URL}?action=clear`, {
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
      await fetch(`${GAS_URL}?action=update`, {
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
      await fetch(`${GAS_URL}?action=update`, {
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
      await fetch(`${GAS_URL}?action=update`, {
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
      await fetch(`${GAS_URL}?action=complete`, {
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
      detik: item.estimasi % 60
    });
    setIsEditing(true);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased pb-12 pt-16">
      {/* Navbar Tetap di App.jsx */}
      <div
        onMouseEnter={() => setIsNavbarVisible(true)}
        onMouseLeave={() => setIsNavbarVisible(false)}
        className="fixed top-0 left-0 w-full z-50 h-16 group"
      >
        <nav className={`bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-3 flex justify-center items-center shadow-sm transition-transform duration-500 ease-in-out ${isNavbarVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200 shadow-inner">
            <button onClick={() => setCurrentPage('display')}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'display' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
              <LayoutDashboard size={14} /> Board
            </button>
            {user?.role === 'mekanik' ? (
              <button onClick={() => setCurrentPage('mechanic')}
                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'mechanic' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Settings size={14} /> Profile
              </button>
            ) : (
              <button onClick={() => user ? setCurrentPage('admin') : setCurrentPage('login')}
                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'admin' || currentPage === 'login' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <Settings size={14} /> Admin
              </button>
            )}
            {user?.role === 'admin' && (
              <>
                <div className="w-[1px] h-6 bg-zinc-200 mx-1 self-center"></div>
                <button onClick={() => setCurrentPage('promo')}
                  className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'promo' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900'}`}>
                  Promo
                </button>
              </>
            )}
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
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} queue={fullProcessedQueue} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} formData={formData} setFormData={setFormData} isEditing={isEditing} errorMessage={errorMessage} formatTime={formatTime} handleComplete={handleComplete} handleSetOvernight={handleSetOvernight} handleCancelOvernight={handleCancelOvernight} />}
      {currentPage === 'mechanic' && <MechanicPanel user={user} handleLogout={handleLogout} handleChangePassword={handleChangePassword} rawHistory={rawHistory} />}
      {currentPage === 'promo' && <PromosiSparepart />}

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-zinc-200 px-8 py-2 flex justify-between items-center text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> Service Operational (G-Sheets)</span>
          <span className="text-zinc-200">|</span>
          <span>{queue.length} Active Cars</span>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default App;