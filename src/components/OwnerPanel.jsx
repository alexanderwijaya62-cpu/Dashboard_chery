import React, { useState, useEffect, useCallback } from 'react';
import {
  Moon, Users, Monitor, Smartphone, Wifi, WifiOff,
  LogOut, RefreshCw, Globe, MapPin, Clock, Lock,
  AlertTriangle, CheckCircle, Trash2, Key, Eye, EyeOff,
  Activity, Crown, XCircle, Menu, X, Car
} from 'lucide-react';
import Toastify from 'toastify-js';
import { supabase } from '../utils/supabaseClient';

const ROLE_COLORS = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  manager: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  admin: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  mekanik: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  cro: { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500' },
  sparepart: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
};

const DeviceIcon = ({ device }) => {
  if (!device) return <Monitor size={16} />;
  const d = device.toLowerCase();
  if (d.includes('phone') || d.includes('iphone') || d.includes('android')) return <Smartphone size={16} />;
  return <Monitor size={16} />;
};

export default function OwnerPanel({ user, handleLogout, processedQueue = [], rawHistory = [], formatTime }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monitoring');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletedBookings, setDeletedBookings] = useState([]);

  const fetchDeletedBookings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('booking').select('*').eq('status', 'deleted').order('tanggal', { ascending: false });
      if (error) throw error;
      setDeletedBookings(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'deleted_bookings') fetchDeletedBookings();
  }, [activeTab, fetchDeletedBookings]);

  // Modal State
  const [modal, setModal] = useState({ type: null, user: null });
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role, isOnline, sessionId, lastLogin, lastDevice, lastBrowser, lastIP, lastLocation');
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error(e);
      Toastify({ text: '❌ Gagal memuat data users', style: { background: '#ef4444' } }).showToast();
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Realtime subscription
    const channel = supabase
      .channel('owner-monitoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchUsers]);

  const handleForceLogout = async (targetUser) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ sessionId: null, isOnline: false, lastAction: 'FORCE_LOGOUT' })
        .eq('username', targetUser.username);

      if (error) throw error;

      Toastify({ text: `✅ ${targetUser.name} telah dikeluarkan.`, style: { background: '#10b981' } }).showToast();
      fetchUsers();
    } catch (e) {
      console.error("Force Logout Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message || 'Error tidak diketahui'}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Toastify({ text: '⚠️ Password minimal 6 karakter', style: { background: '#f97316' } }).showToast();
      return;
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword, sessionId: null, isOnline: false, lastAction: 'PASSWORD_RESET' })
        .eq('username', modal.user.username);

      if (error) throw error;

      Toastify({ text: `✅ Password ${modal.user.name} berhasil direset.`, style: { background: '#10b981' } }).showToast();
      setNewPassword('');
      fetchUsers();
    } catch (e) {
      console.error("Reset Password Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleDeleteUser = async (targetUser) => {
    try {
      await supabase.from('users').delete().eq('username', targetUser.username);
      Toastify({ text: `🗑️ User ${targetUser.name} telah dihapus.`, style: { background: '#6b7280' } }).showToast();
      fetchUsers();
    } catch (e) {
      Toastify({ text: '❌ Gagal menghapus user', style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleResetAllSessions = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ sessionId: null, isOnline: false, lastAction: 'MASS_LOGOUT' })
        .neq('username', user.username);

      if (error) throw error;

      Toastify({ text: '✅ Semua sesi berhasil direset (Kecuali Sesi Anda).', style: { background: '#10b981' } }).showToast();
      fetchUsers();
    } catch (e) {
      console.error("Reset All Sessions Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleRemoteRefresh = async () => {
    try {
      const { error } = await supabase.channel('remote_control').send({
        type: 'broadcast',
        event: 'force-refresh',
        payload: { message: 'Owner triggered refresh' }
      });
      if (error) throw error;
      Toastify({ text: '🚀 Perintah Refresh Seluruh Layar Terkirim!', style: { background: '#8b5cf6' } }).showToast();
    } catch (e) {
      console.error(e);
      Toastify({ text: '❌ Gagal mengirim perintah refresh', style: { background: '#ef4444' } }).showToast();
    }
  };

  const onlineUsers = users.filter(u => u.isOnline && u.sessionId);
  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  const workshopStats = [
    { label: 'Unit Working', value: processedQueue.filter(q => q.status === 'working').length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unit Waiting', value: processedQueue.filter(q => q.status === 'waiting').length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Unit Menginap', value: processedQueue.filter(q => q.status === 'menginap').length, icon: Moon, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Selesai Hari Ini', value: rawHistory.filter(h => new Date(parseInt(h.id)).toDateString() === new Date().toDateString()).length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const userStats = [
    { label: 'Total User', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Sedang Online', value: onlineUsers.length, icon: Wifi, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Offline', value: users.length - onlineUsers.length, icon: WifiOff, color: 'text-zinc-400', bg: 'bg-zinc-50' },
    { label: 'Role Aktif', value: [...new Set(users.map(u => u.role).filter(Boolean))].length, icon: Moon, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const stats = activeTab === 'workshop' ? workshopStats : userStats;

  return (
    <div className="fixed inset-0 bg-[#0F0F14] flex overflow-hidden font-sans antialiased">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative left-0 top-0 bottom-0 z-50 bg-[#18181F] border-r border-white/5 flex flex-col transition-all duration-300 shrink-0
        ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'}`}>

        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-white text-sm tracking-tight">Owner Dashboard</h1>
              <p className="text-[10px] text-white/40 font-medium">Security & Monitoring</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
            { id: 'workshop', label: 'Antrian Workshop', icon: Car },
            { id: 'users', label: 'Manajemen User', icon: Users },
            { id: 'deleted_bookings', label: 'Riwayat Hapus Booking', icon: Trash2 },
          ].map(item => (
            <button key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all
                ${activeTab === item.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center font-black text-white text-sm">
              {user?.name?.[0] || 'O'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.name || 'Owner'}</p>
              <p className="text-[10px] text-white/40 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold text-xs hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-[#18181F] border-b border-white/5 px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-white/60 hover:text-white p-1" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div>
              <h2 className="text-white font-black text-base md:text-lg">
                {activeTab === 'monitoring' ? '🔴 Live Session Monitoring' : activeTab === 'workshop' ? '🚗 Antrian Workshop Realtime' : activeTab === 'users' ? '👥 Manajemen User' : '🗑️ Riwayat Penghapusan Data'}
              </h2>
              <p className="text-white/30 text-xs font-medium">
                {activeTab === 'monitoring'
                  ? `${onlineUsers.length} pengguna aktif saat ini`
                  : activeTab === 'workshop'
                    ? `${processedQueue.length} unit kendaraan dalam sistem`
                    : activeTab === 'users'
                      ? `${users.length} total user terdaftar`
                      : `${deletedBookings.length} data yang terhapus`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'monitoring' && (
              <>
                <button 
                  onClick={handleRemoteRefresh}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/40 border border-indigo-500/50">
                  <RefreshCw size={14} /> Refresh Semua Board
                </button>
                <button 
                  onClick={() => setModal({ type: 'resetAll', user: null })}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/40 border border-red-500/50">
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Reset Semua Login
                </button>
              </>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Realtime Active</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="bg-[#18181F] border border-white/5 rounded-3xl p-5">
                <div className={`w-10 h-10 ${s.bg} rounded-2xl flex items-center justify-center mb-4`}>
                  <s.icon size={20} className={s.color} />
                </div>
                <p className="text-3xl font-black text-white">{s.value}</p>
                <p className="text-white/40 text-xs font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ====== TAB: MONITORING ====== */}
          {activeTab === 'monitoring' && (
            <div className="space-y-4">
              <h3 className="text-white/60 text-xs font-black uppercase tracking-widest">Pengguna Yang Saat Ini Online</h3>

              {onlineUsers.length === 0 ? (
                <div className="bg-[#18181F] border border-white/5 rounded-3xl p-12 text-center">
                  <WifiOff size={40} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/30 font-bold">Tidak ada pengguna yang sedang online</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {onlineUsers.map(u => {
                    const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                    return (
                      <div key={u.username} className="bg-[#18181F] border border-green-500/20 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-center group hover:border-green-500/40 transition-all">

                        {/* Avatar + Status */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center font-black text-green-400 text-xl">
                            {u.name?.[0] || '?'}
                          </div>
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#18181F] animate-pulse" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 space-y-3 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white font-black text-base">{u.name}</span>
                            <span className="text-white/40 text-xs">@{u.username}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>
                              {u.role}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-green-500/10 text-green-400 border border-green-500/20">
                              ● ONLINE
                            </span>
                          </div>

                          {/* Device Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <InfoPill icon={<DeviceIcon device={u.lastDevice} />} label="Perangkat" value={u.lastDevice || 'Tidak Diketahui'} />
                            <InfoPill icon={<Globe size={14} />} label="Browser" value={u.lastBrowser || 'Tidak Diketahui'} />
                            <InfoPill icon={<Wifi size={14} />} label="Alamat IP" value={u.lastIP || '-'} mono />
                            <InfoPill icon={<MapPin size={14} />} label="Lokasi" value={u.lastLocation ? u.lastLocation.split('(')[0].trim() : 'Tidak Diketahui'} />
                            <div className="bg-white/5 rounded-xl px-3 py-2 min-w-0 relative group/coords">
                              <div className="flex items-center gap-1.5 text-white/30 mb-1">
                                <MapPin size={14} className="text-blue-400" />
                                <span className="text-[9px] font-black uppercase tracking-wider">Coordinate</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <p className="text-white/80 text-[10px] font-mono font-bold truncate">
                                  {u.lastLocation && u.lastLocation.includes('(') ? u.lastLocation.split('(')[1].replace(')', '') : 'N/A'}
                                </p>
                                {u.lastLocation && u.lastLocation.includes('(') && (
                                  <button 
                                    onClick={() => {
                                      const coords = u.lastLocation.split('(')[1].replace(')', '');
                                      navigator.clipboard.writeText(coords);
                                      Toastify({ text: "📍 Coordinate Copied!", style: { background: "#3b82f6" }, duration: 2000 }).showToast();
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-md text-blue-400 opacity-0 group-hover/coords:opacity-100 transition-all shrink-0"
                                    title="Copy Coordinates"
                                  >
                                    <Key size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-white/30 text-xs">
                            <Clock size={12} />
                            <span>Login terakhir: <span className="text-white/50 font-medium">{u.lastLogin || '-'}</span></span>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => setModal({ type: 'forceLogout', user: u })}
                          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-2xl transition-all border border-red-500/20 hover:border-red-500/40">
                          <XCircle size={14} /> Force Logout
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Offline Section */}
              {users.filter(u => !u.isOnline || !u.sessionId).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-white/30 text-xs font-black uppercase tracking-widest">Pengguna Offline</h3>
                  <div className="grid gap-3">
                    {users.filter(u => !u.isOnline || !u.sessionId).map(u => {
                      const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                      return (
                        <div key={u.username} className="bg-[#18181F] border border-white/5 rounded-2xl p-4 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-white/40 shrink-0">
                            {u.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white/70 font-bold text-sm">{u.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>{u.role}</span>
                            </div>
                            <p className="text-white/30 text-xs mt-0.5">{u.lastDevice || 'Belum pernah login'} · {u.lastLocation || '-'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-white/20 text-[10px] font-bold uppercase">Offline</span>
                            {u.lastLocation && u.lastLocation.includes('(') && (
                              <button 
                                onClick={() => {
                                  const coords = u.lastLocation.split('(')[1].replace(')', '');
                                  navigator.clipboard.writeText(coords);
                                  Toastify({ text: "📍 Coordinate Copied!", style: { background: "#3b82f6" }, duration: 2000 }).showToast();
                                }}
                                className="text-[9px] font-black text-blue-400/50 hover:text-blue-400 uppercase tracking-widest transition-colors"
                              >
                                Copy Coords
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== TAB: WORKSHOP ====== */}
          {activeTab === 'workshop' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Working Column */}
                <WorkshopColumn
                  title="Sedang Dikerjakan"
                  items={processedQueue.filter(i => i.status === 'working')}
                  color="blue"
                  icon={Clock}
                  formatTime={formatTime}
                />
                {/* Waiting Column */}
                <WorkshopColumn
                  title="Menunggu"
                  items={processedQueue.filter(i => i.status === 'waiting')}
                  color="orange"
                  icon={Activity}
                  formatTime={formatTime}
                />
                {/* Overnight Column */}
                <WorkshopColumn
                  title="Menginap"
                  items={processedQueue.filter(i => i.status === 'menginap')}
                  color="purple"
                  icon={Moon}
                  formatTime={formatTime}
                />
              </div>
            </div>
          )}

          {/* ====== TAB: USERS ====== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="bg-[#18181F] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Users size={16} className="text-white/30" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cari berdasarkan nama, username, atau role..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/20 outline-none font-medium"
                />
                {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-white/30 hover:text-white" /></button>}
              </div>

              {/* User List */}
              <div className="grid gap-3">
                {filteredUsers.map(u => {
                  const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                  const isCurrentUser = u.username === user?.username;
                  const isActiveNow = u.isOnline && u.sessionId;
                  return (
                    <div key={u.username}
                      className={`bg-[#18181F] border rounded-3xl p-5 flex flex-col md:flex-row gap-4 md:items-center transition-all
                        ${isActiveNow ? 'border-green-500/20' : 'border-white/5'}`}>

                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg
                          ${isCurrentUser ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white' : 'bg-white/5 text-white/50'}`}>
                          {u.name?.[0] || '?'}
                        </div>
                        {isActiveNow && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#18181F]" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-bold">{u.name}</span>
                          <span className="text-white/30 text-xs">@{u.username}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>{u.role}</span>
                          {isCurrentUser && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-400">Anda</span>}
                          {isActiveNow && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-green-500/10 text-green-400">● Online</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-white/30 text-[11px]">
                          {u.lastDevice && <span className="flex items-center gap-1"><DeviceIcon device={u.lastDevice} /> {u.lastDevice}</span>}
                          {u.lastBrowser && <span className="flex items-center gap-1"><Globe size={11} /> {u.lastBrowser}</span>}
                          {u.lastIP && <span className="flex items-center gap-1 font-mono"><Wifi size={11} /> {u.lastIP}</span>}
                          {u.lastLocation && <span className="flex items-center gap-1"><MapPin size={11} /> {u.lastLocation}</span>}
                          {u.lastLogin && <span className="flex items-center gap-1"><Clock size={11} /> {u.lastLogin}</span>}
                          {u.lastLocation && u.lastLocation.includes('(') && (
                            <button 
                              onClick={() => {
                                const coords = u.lastLocation.split('(')[1].replace(')', '');
                                navigator.clipboard.writeText(coords);
                                Toastify({ text: "📍 Coordinate Copied!", style: { background: "#3b82f6" }, duration: 2000 }).showToast();
                              }}
                              className="flex items-center gap-1 text-blue-400/60 hover:text-blue-400 transition-colors"
                            >
                              <MapPin size={11} /> {u.lastLocation.split('(')[1].replace(')', '')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {!isCurrentUser && (
                        <div className="flex items-center gap-2 shrink-0">
                          {isActiveNow && (
                            <button onClick={() => setModal({ type: 'forceLogout', user: u })}
                              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all" title="Force Logout">
                              <XCircle size={16} />
                            </button>
                          )}
                          <button onClick={() => { setModal({ type: 'resetPassword', user: u }); setNewPassword(''); }}
                            className="p-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-xl transition-all" title="Reset Password">
                            <Key size={16} />
                          </button>
                          <button onClick={() => setModal({ type: 'deleteUser', user: u })}
                            className="p-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-xl transition-all" title="Hapus User">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====== TAB: RIWAYAT HAPUS ====== */}
          {activeTab === 'deleted_bookings' && (
            <div className="space-y-4">
              {deletedBookings.length === 0 ? (
                <div className="bg-[#18181F] border border-white/5 rounded-3xl p-12 text-center">
                  <Trash2 size={40} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/30 font-bold">Belum ada data booking yang dihapus.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {deletedBookings.map(b => (
                    <div key={b.id} className="bg-[#18181F] border border-red-500/20 rounded-3xl p-5 flex flex-col md:flex-row gap-4 md:items-center transition-all hover:border-red-500/40">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-400/20 flex items-center justify-center font-black text-red-500 text-lg shrink-0">
                        {b.namaCustomer?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-bold text-base">{b.namaCustomer}</span>
                          <span className="text-white/30 text-xs font-mono">{b.noPlat}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            DELETED
                          </span>
                        </div>
                        <p className="text-red-400 text-xs font-bold leading-tight">{b.bookingVia}</p>
                        <p className="text-white/30 text-[10px] mt-1 line-clamp-1">
                          🚗 <span className="font-bold">{b.tipeMobil}</span> • ⏳ {b.tanggal} Jam {b.jam} • 🛠️ {b.keperluanService}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <button onClick={async () => {
                          if(!window.confirm('Kembalikan data ini ke Antrian Booking CRO?')) return;
                          await supabase.from('booking').update({ status: 'waiting confirm', bookingVia: b.bookingVia.replace(/Dihapus_Oleh: .*? - /, '') }).eq('id', b.id);
                          fetchDeletedBookings();
                          Toastify({ text: "✅ Data berhasil di-Restore!", style: { background: "#10b981" } }).showToast();
                        }}
                          className="px-4 py-2 bg-[#18181F] border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                           Restore Data
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ====== MODALS ====== */}
      {modal.type && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E28] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">

            {/* Reset All Sessions Modal */}
            {modal.type === 'resetAll' && (
              <>
                <div className="w-16 h-16 bg-red-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <RefreshCw size={32} className="text-red-500" />
                </div>
                <h3 className="text-white font-black text-xl text-center mb-2">Reset Semua Sesi?</h3>
                <p className="text-white/50 text-center text-sm mb-8">
                  Fitur ini akan <span className="text-red-400 font-bold">memaksa logout</span> semua perangkat dan akun yang saat ini terhubung, <span className="text-white font-bold underline">kecuali akun Anda sendiri</span>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all">
                    Batal
                  </button>
                  <button onClick={handleResetAllSessions}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40">
                    <CheckCircle size={16} /> Ya, Reset Semua
                  </button>
                </div>
              </>
            )}

            {/* Force Logout Modal */}
            {modal.type === 'forceLogout' && (
              <>
                <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={32} className="text-red-400" />
                </div>
                <h3 className="text-white font-black text-xl text-center mb-2">Force Logout?</h3>
                <p className="text-white/50 text-center text-sm mb-8">
                  Pengguna <span className="text-white font-bold">{modal.user?.name}</span> akan segera dikeluarkan dari semua sesi aktif mereka.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all">
                    Batal
                  </button>
                  <button onClick={() => handleForceLogout(modal.user)}
                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                    <LogOut size={16} /> Ya, Keluarkan
                  </button>
                </div>
              </>
            )}

            {/* Reset Password Modal */}
            {modal.type === 'resetPassword' && (
              <>
                <div className="w-16 h-16 bg-yellow-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Key size={32} className="text-yellow-400" />
                </div>
                <h3 className="text-white font-black text-xl text-center mb-2">Reset Password</h3>
                <p className="text-white/50 text-center text-sm mb-6">
                  Atur password baru untuk <span className="text-white font-bold">{modal.user?.name}</span>.
                  User ini akan otomatis dikeluarkan dari sesi aktif.
                </p>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Password baru (min. 6 karakter)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 outline-none focus:border-yellow-500/50 font-medium mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all">
                    Batal
                  </button>
                  <button onClick={handleResetPassword}
                    className="flex-1 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-black text-sm transition-all flex items-center justify-center gap-2">
                    <CheckCircle size={16} /> Simpan Password
                  </button>
                </div>
              </>
            )}

            {/* Delete User Modal */}
            {modal.type === 'deleteUser' && (
              <>
                <div className="w-16 h-16 bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="text-white font-black text-xl text-center mb-2">Hapus User?</h3>
                <p className="text-white/50 text-center text-sm mb-2">
                  Tindakan ini akan <span className="text-red-400 font-bold">menghapus permanen</span> akun milik:
                </p>
                <p className="text-white font-black text-center text-lg mb-8">{modal.user?.name} <span className="text-white/30 font-medium text-sm">(@{modal.user?.username})</span></p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all">
                    Batal
                  </button>
                  <button onClick={() => handleDeleteUser(modal.user)}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Ya, Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}

// Reusable Workshop Column Component
function WorkshopColumn({ title, items, color, icon: Icon, formatTime }) {
  const colors = {
    blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
    orange: { border: 'border-orange-500/20', bg: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' },
    purple: { border: 'border-purple-500/20', bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' },
  };

  const c = colors[color];

  return (
    <div className={`bg-[#18181F] border border-white/5 rounded-3xl p-5 flex flex-col h-full`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 ${c.bg} rounded-2xl flex items-center justify-center`}>
          <Icon size={20} className={c.text} />
        </div>
        <div>
          <h4 className="text-white font-black text-sm uppercase tracking-tight">{title}</h4>
          <p className="text-white/30 text-[10px] font-bold uppercase">{items.length} Unit Terdeteksi</p>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {items.length === 0 ? (
          <div className="h-20 flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl">
            <p className="text-white/20 text-[10px] font-bold uppercase">Kosong</p>
          </div>
        ) : (
          items.map(i => (
            <div key={i.id} className={`bg-white/5 border-l-4 ${c.border} rounded-2xl p-4 space-y-2 group hover:bg-white/10 transition-all`}>
              <div className="flex items-center justify-between">
                <span className="text-white font-black font-mono text-lg">{i.bk}</span>
                {color === 'blue' && (
                  <span className={`text-[10px] font-black font-mono ${i.estimasi < 300 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                    {formatTime(i.estimasi)}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white/40 text-[10px] font-bold uppercase truncate">{i.tipe} · {i.category}</p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/50 font-black shrink-0">MK</div>
                  <p className="text-white/60 text-[10px] font-medium truncate">{i.mechanicName || '—'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Reusable Info Pill Component
function InfoPill({ icon, label, value, mono }) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2 min-w-0">
      <div className="flex items-center gap-1.5 text-white/30 mb-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-white/80 text-xs font-bold truncate ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  );
}
