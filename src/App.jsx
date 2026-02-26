import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Settings } from 'lucide-react';

// Import Komponen Terpisah
import DisplayBoard from './components/DisplayBoard';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import { USERS } from './data/users';

// Helper function dipindah ke luar agar tidak di-recreate setiap render
const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('display'); 
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('chery_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [queue, setQueue] = useState(() => {
    const savedQueue = localStorage.getItem('chery_workshop_queue');
    return savedQueue ? JSON.parse(savedQueue) : [];
  });
  const [formData, setFormData] = useState({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler' });
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setQueue((prevQueue) => 
        prevQueue.map((item) => ({
          ...item,
          estimasi: item.estimasi > 0 ? item.estimasi - 1 : 0
        }))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simpan data ke LocalStorage setiap kali queue berubah
  useEffect(() => {
    localStorage.setItem('chery_workshop_queue', JSON.stringify(queue));
  }, [queue]);

  // Simpan status user ke LocalStorage
  useEffect(() => {
    localStorage.setItem('chery_auth_user', JSON.stringify(user));
  }, [user]);

  const processedQueue = useMemo(() => {
    return [...queue]
      .sort((a, b) => {
        if (a.category === 'Booking' && b.category !== 'Booking') return -1;
        if (a.category !== 'Booking' && b.category === 'Booking') return 1;
        return 0;
      })
      .slice(0, 5); 
  }, [queue]);

  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = USERS.find(u => u.username === loginForm.username && u.password === loginForm.password);
    
    if (foundUser) {
      setUser({ name: foundUser.name });
      setCurrentPage('admin');
      setErrorMessage("");
    } else {
      setErrorMessage("Username atau Password salah!");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('display');
  };

  const handleSave = (e) => {
    e.preventDefault();
    const totalSeconds = (parseInt(formData.jam || 0) * 3600) + (parseInt(formData.menit || 0) * 60) + parseInt(formData.detik || 0);
    if (!isEditing && totalSeconds < 1800) {
      setErrorMessage("Waktu minimal pengerjaan adalah 30 menit!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    if (isEditing) {
      setQueue(prev => prev.map(q => q.id === formData.id ? { ...formData, estimasi: totalSeconds } : q));
      setIsEditing(false);
    } else {
      setQueue(prev => [...prev, { id: Date.now(), bk: formData.bk.toUpperCase(), tipe: formData.tipe, estimasi: totalSeconds, category: formData.category, addedBy: user.name }]);
    }
    // Reset form setelah save
    setFormData({ id: null, bk: '', tipe: '', jam: 0, menit: 30, detik: 0, category: 'Reguler' });
  };

  const deleteItem = (id) => setQueue(prev => prev.filter(q => q.id !== id));

  const clearQueue = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua antrean?")) {
      setQueue([]);
    }
  };

  const editItem = (item) => {
    setFormData({ ...item, jam: Math.floor(item.estimasi / 3600), menit: Math.floor((item.estimasi % 3600) / 60), detik: item.estimasi % 60 });
    setIsEditing(true);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-zinc-900 font-sans tracking-tight antialiased pb-12">
      {/* Navbar Tetap di App.jsx */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-zinc-200 px-8 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center"></div>
        
        <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
          <button onClick={() => setCurrentPage('display')}
            className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'display' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
            <LayoutDashboard size={14} /> Board
          </button>
          <button onClick={() => user ? setCurrentPage('admin') : setCurrentPage('login')}
            className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${currentPage === 'admin' || currentPage === 'login' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>
            <Settings size={14} /> Admin
          </button>
        </div>
      </nav>

      {/* Render Pages */}
      {currentPage === 'display' && <DisplayBoard processedQueue={processedQueue} queueLength={queue.length} formatTime={formatTime} />}
      {currentPage === 'login' && <LoginPage loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} errorMessage={errorMessage} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && <AdminPanel user={user} handleLogout={handleLogout} queue={queue} deleteItem={deleteItem} clearQueue={clearQueue} editItem={editItem} handleSave={handleSave} formData={formData} setFormData={setFormData} isEditing={isEditing} errorMessage={errorMessage} formatTime={formatTime} />}

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-zinc-200 px-8 py-2 flex justify-between items-center text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Service Operational</span>
          <span className="text-zinc-200">|</span>
          <span>{queue.length} Active Cars</span>
        </div>
        <div className="italic text-zinc-900 opacity-40">CHERY MOTOR INDONESIA</div>
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