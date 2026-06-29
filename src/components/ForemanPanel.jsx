import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, User, Clock, CheckCircle2, Droplets, X, Search, Activity, Check, UserPlus, Eye, EyeOff } from 'lucide-react';
import { db } from '../utils/dbClient';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

const formatTime = (totalSeconds) => {
    if (!totalSeconds && totalSeconds !== 0) return '--:--:--';
    const abs = Math.abs(totalSeconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const EXTENSION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function ForemanPanel({
    user,
    handleLogout,
    queue = [],
    onComplete,
    onRequestExtension,
    isLoadingProcess,
}) {
    const [mechanics, setMechanics] = useState([]);
    const [expandedMechanic, setExpandedMechanic] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [extensionModal, setExtensionModal] = useState({ show: false, item: null, extraMinutes: 30, reason: '' });
    const [completingItems, setCompletingItems] = useState(new Set());

    // Assign Modal (multi-select)
    const [assignModal, setAssignModal] = useState({ show: false, item: null });
    const [assignSearch, setAssignSearch] = useState('');
    const [selectedMechanics, setSelectedMechanics] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);

    // Monitor toggle
    const [showMonitor, setShowMonitor] = useState(false);

    // Fetch mechanics
    useEffect(() => {
        const fetchMechanics = async () => {
            try {
                const { data, error } = await db.select('users', {
                    select: 'name, username, status',
                    eq: { role: 'mekanik' }
                });
                if (!error && data) setMechanics(data.filter(m => m.name));
            } catch (e) {
                console.error('Gagal fetch mekanik:', e);
            }
        };
        fetchMechanics();
        const channel = db.realtime?.channel('foreman-mechanics')
            ?.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchMechanics)
            ?.subscribe();
        return () => { channel?.unsubscribe(); };
    }, []);

    // ---- COMPUTED ----

    const unassignedItems = useMemo(() => {
        return queue.filter(item => {
            const noMechanic = !item.mechanicName || item.mechanicName === '';
            const preWork = item.status === 'waiting' || item.status === 'menginap';
            return noMechanic && preWork;
        });
    }, [queue]);

    const sortedUnassigned = useMemo(() => {
        return [...unassignedItems].sort((a, b) => {
            const aCat = (a.category || 'Reguler').toLowerCase();
            const bCat = (b.category || 'Reguler').toLowerCase();
            if (aCat === 'booking' && bCat !== 'booking') return -1;
            if (aCat !== 'booking' && bCat === 'booking') return 1;
            if (aCat === 'booking' && bCat === 'booking') {
                return (a.jam || 0) - (b.jam || 0);
            }
            return (b.id || 0) - (a.id || 0);
        });
    }, [unassignedItems]);

    const activeMechanics = useMemo(() => {
        return mechanics.filter(m => m.status === 'active' || !m.status);
    }, [mechanics]);

    const filteredMechanics = useMemo(() => {
        if (!assignSearch.trim()) return activeMechanics;
        const term = assignSearch.toLowerCase();
        return activeMechanics.filter(m =>
            m.name.toLowerCase().includes(term) || (m.username || '').toLowerCase().includes(term)
        );
    }, [activeMechanics, assignSearch]);

    // Monitoring computed — split mechanicName so each mechanic sees the job
    const mechanicJobsMap = useMemo(() => {
        const map = {};
        mechanics.forEach(m => { map[m.name] = []; });
        queue.forEach(item => {
            const mName = item.mechanicName;
            if (mName) {
                mName.split(',').forEach(name => {
                    if (map[name]) {
                        map[name].push(item);
                    } else {
                        map[name] = [item];
                    }
                });
            } else {
                if (!map['Unassigned']) map['Unassigned'] = [];
                map['Unassigned'].push(item);
            }
        });
        return map;
    }, [mechanics, queue]);

    const mechanicStats = useMemo(() => {
        const stats = {};
        Object.entries(mechanicJobsMap).forEach(([name, jobs]) => {
            stats[name] = {
                working: jobs.filter(j => j.status === 'working' || j.status === 'request_extension').length,
                waiting: jobs.filter(j => j.status === 'waiting' || j.status === 'menginap').length,
                total: jobs.length
            };
        });
        return stats;
    }, [mechanicJobsMap]);

    const activeExtensions = useMemo(() =>
        queue.filter(q => q.status === 'request_extension'),
        [queue]);

    // ---- HANDLERS ----

    const handleAssign = async () => {
        if (selectedMechanics.length === 0 || !assignModal.item) return;
        setIsAssigning(true);
        const mechanicStr = selectedMechanics.join(',');
        try {
            const { error } = await db.update('antrian', {
                mechanicName: mechanicStr
            }, { eq: { id: assignModal.item.id } });
            if (error) throw error;
            Toastify({
                text: `${assignModal.item.bk}  ${selectedMechanics.length} mekanik`,
                duration: 2000,
                background: '#10b981'
            }).showToast();
            setAssignModal({ show: false, item: null });
            setSelectedMechanics([]);
            setAssignSearch('');
        } catch (e) {
            console.error(e);
            Toastify({ text: 'Gagal assign mekanik', background: '#ef4444' }).showToast();
        } finally {
            setIsAssigning(false);
        }
    };

    const handleOpenAssign = (item) => {
        setAssignModal({ show: true, item });
        setSelectedMechanics([]);
        setAssignSearch('');
    };

    const toggleMechanic = (name) => {
        setSelectedMechanics(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    // Monitoring handlers
    const handleSelesai = async (item) => {
        if (!window.confirm(`Selesaikan pengerjaan unit ${item.bk} (${item.mechanicName || '-'})?`)) return;
        setCompletingItems(prev => new Set(prev).add(item.id));
        try {
            await onComplete(item);
        } finally {
            setCompletingItems(prev => { const next = new Set(prev); next.delete(item.id); return next; });
        }
    };

    const handleOpenExtension = (item) => {
        setExtensionModal({ show: true, item, extraMinutes: 30, reason: '' });
    };

    const handleSubmitExtension = async () => {
        const { item, extraMinutes, reason } = extensionModal;
        if (!reason.trim()) { alert('Harap isi alasan tambah waktu!'); return; }
        setExtensionModal(s => ({ ...s, show: false }));
        try {
            await onRequestExtension(item, extraMinutes * 60, reason.trim());
        } catch (e) { console.error(e); }
    };

    const getStatusBadge = (item) => {
        const statusMap = {
            'working': { label: 'DIKERJAKAN', color: 'bg-blue-600' },
            'waiting': { label: 'MENUNGGU', color: 'bg-amber-500' },
            'menginap': { label: 'MENGINAP', color: 'bg-purple-600' },
            'request_extension': { label: 'REQUEST EXT', color: 'bg-amber-600' },
            'menunggu_konfirmasi': { label: 'MENUNGGU KONFIRMASI', color: 'bg-emerald-600' },
            'menunggu_cuci': { label: 'ANTRIAN CUCI', color: 'bg-teal-600' },
            'sedang_dicuci': { label: 'SEDANG DICUCI', color: 'bg-cyan-600' },
        };
        return statusMap[item.status] || { label: item.status, color: 'bg-zinc-500' };
    };

    const getCategoryBadge = (category) => {
        const catMap = {
            'booking': { label: 'BOOKING', color: 'bg-blue-500' },
            'reguler': { label: 'REGULER', color: 'bg-zinc-500' },
            'warranty': { label: 'WARRANTY', color: 'bg-purple-500' },
        };
        const key = (category || 'reguler').toLowerCase();
        return catMap[key] || { label: category || '-', color: 'bg-zinc-400' };
    };

    // ---- RENDER ----
    return (
        <div className="min-h-screen bg-zinc-50 p-3 md:p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-black p-2.5 md:p-3 rounded-2xl text-white shadow-lg">
                        <Wrench size={20} className="md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-2xl font-black text-black uppercase tracking-tight italic leading-none">Foreman</h1>
                        <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-1">{unassignedItems.length} Antrian</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowMonitor(!showMonitor)}
                        className={`p-2.5 rounded-xl transition-all active:scale-95 border-2 ${showMonitor ? 'bg-black text-white border-black' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}
                        title={showMonitor ? 'Sembunyikan Monitor' : 'Tampilkan Monitor'}>
                        {showMonitor ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={handleLogout}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95">
                        Logout
                    </button>
                </div>
            </div>

            {/* ===== QUEUE LIST ===== */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <UserPlus size={14} className="text-zinc-500" />
                    <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Antrian Pengerjaan — Booking  Reguler</h2>
                </div>

                {sortedUnassigned.length === 0 ? (
                    <div className="bg-white border-2 border-zinc-200 rounded-[2rem] p-8 md:p-12 text-center">
                        <CheckCircle2 size={48} className="text-emerald-300 mx-auto mb-3" />
                        <p className="font-black text-zinc-400 text-sm">Semua unit sudah diassign</p>
                        <p className="text-[10px] text-zinc-300 font-bold mt-1">Tidak ada antrian yang menunggu mekanik</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 md:gap-3">
                        {sortedUnassigned.map(item => {
                            const catBadge = getCategoryBadge(item.category);
                            return (
                                <div key={item.id}
                                    className={`bg-white border-2 rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-md transition-all ${catBadge.label === 'BOOKING' ? 'border-blue-200 bg-blue-50/20' : 'border-zinc-100'}`}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-lg md:text-2xl text-black font-mono leading-none">{item.bk}</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black text-white uppercase tracking-wider ${catBadge.color}`}>{catBadge.label}</span>
                                                {item.status === 'menginap' && (
                                                    <span className="bg-purple-100 text-purple-700 text-[7px] font-black px-1.5 py-0.5 rounded-full">MENGINAP</span>
                                                )}
                                            </div>
                                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.tipe || '-'}</p>
                                        </div>
                                    </div>

                                    {item.keluhan && (
                                        <p className="text-[9px] font-medium text-zinc-500 mb-2 bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-100 leading-relaxed">
                                            {item.keluhan}
                                        </p>
                                    )}

                                    <button
                                        onClick={() => handleOpenAssign(item)}
                                        className="w-full py-2.5 bg-black hover:bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <UserPlus size={14} />
                                        Assign Mekanik
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ===== MONITORING SECTION (toggled) ===== */}
            {showMonitor && (
                <div>
                    {activeExtensions.length > 0 && (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 md:p-4 mb-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className="text-amber-600 shrink-0" />
                                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                    Request Tambah Waktu ({activeExtensions.length})
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {activeExtensions.map(req => {
                                    let extraData = null;
                                    try { extraData = req.pendingExtra ? (typeof req.pendingExtra === 'string' ? JSON.parse(req.pendingExtra) : req.pendingExtra) : null; } catch { }
                                    const dur = extraData?.duration || 1800;
                                    const reason = extraData?.reason || req.menginap_reason?.replace('[TAMBAH WAKTU] ', '') || '';
                                    return (
                                        <div key={req.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-black text-sm text-amber-900 shrink-0">{req.bk}</span>
                                                <span className="text-[8px] font-bold text-zinc-500 truncate">{req.mechanicName}</span>
                                                <span className="text-[8px] font-black text-amber-700 whitespace-nowrap">+{Math.floor(dur / 60)}menit</span>
                                                {reason && <span className="text-[7px] text-zinc-400 truncate hidden md:inline">"{reason}"</span>}
                                            </div>
                                            <span className="text-[7px] font-bold text-amber-500 uppercase shrink-0 ml-2">Menunggu Konfirmasi SA</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="relative mb-4">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Cari mekanik, BK, atau tipe kendaraan..."
                            className="w-full pl-9 pr-4 py-3 bg-white border-2 border-zinc-200 rounded-2xl text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 mb-4">
                        {Object.entries(mechanicStats).filter(([name]) => name !== 'Unassigned').map(([name, stats]) => (
                            <button key={name} onClick={() => setExpandedMechanic(expandedMechanic === name ? null : name)}
                                className={`relative bg-white border-2 rounded-2xl p-3 md:p-4 text-left transition-all active:scale-95 hover:shadow-md ${expandedMechanic === name ? 'border-black shadow-lg' : 'border-zinc-100 shadow-sm'}`}>
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${stats.working > 0 ? 'bg-blue-600' : 'bg-zinc-200 text-zinc-400'}`}>
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-xs md:text-sm text-black truncate leading-tight">{name}</p>
                                        <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider">{stats.total} Unit</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {stats.working > 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-[8px] font-black">{stats.working} kerja</span>}
                                    {stats.waiting > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black">{stats.waiting} tunggu</span>}
                                </div>
                            </button>
                        ))}
                    </div>

                    {expandedMechanic && (
                        <div className="bg-white border-2 border-black rounded-[2rem] p-3 md:p-5 mb-4 shadow-xl">
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                                        <Wrench size={20} className="md:w-6 md:h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-2xl font-black text-black uppercase tracking-tight">{expandedMechanic}</h2>
                                        <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                            {mechanicStats[expandedMechanic]?.working || 0} Dikerjakan · {mechanicStats[expandedMechanic]?.waiting || 0} Menunggu
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setExpandedMechanic(null)}
                                    className="w-8 h-8 md:w-10 md:h-10 bg-zinc-100 hover:bg-zinc-200 rounded-xl flex items-center justify-center transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            {(mechanicJobsMap[expandedMechanic] || []).length > 0 ? (
                                <div className="flex flex-col gap-2 md:gap-3">
                                    {(mechanicJobsMap[expandedMechanic] || []).sort((a, b) => {
                                        const priority = { 'working': 0, 'request_extension': 1, 'waiting': 2, 'menginap': 3, 'sedang_dicuci': 4, 'menunggu_cuci': 5, 'menunggu_konfirmasi': 6 };
                                        return (priority[a.status] ?? 99) - (priority[b.status] ?? 99);
                                    }).map(item => {
                                        const badge = getStatusBadge(item);
                                        const canComplete = ['working', 'request_extension', 'menginap', 'menunggu_cuci'].includes(item.status);
                                        const canExtend = item.status === 'working' || item.status === 'request_extension';
                                        const isCompleting = completingItems.has(item.id);

                                        return (
                                            <div key={item.id}
                                                className={`border-2 rounded-2xl md:rounded-3xl p-3 md:p-4 transition-all ${item.status === 'working' || item.status === 'request_extension' ? 'border-blue-200 bg-blue-50/30' : 'border-zinc-100 bg-white'}`}>
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-black text-lg md:text-2xl text-black font-mono leading-none">{item.bk}</span>
                                                            <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black text-white uppercase tracking-wider ${badge.color}`}>{badge.label}</span>
                                                            {item.cuci_required && (
                                                                <span className="bg-teal-100 text-teal-700 text-[7px] font-black px-1.5 py-0.5 rounded-full border border-teal-200 flex items-center gap-0.5">
                                                                    <Droplets size={8} /> Cuci
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.tipe || '-'}</p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Estimasi</p>
                                                        <p className={`text-lg md:text-xl font-black tabular-nums leading-none ${(item.status === 'working' || item.status === 'request_extension') && item.estimasi < 300 ? 'text-red-600 animate-pulse' : 'text-zinc-900'}`}>
                                                            {item.status === 'working' || item.status === 'request_extension'
                                                                ? formatTime(item.estimasi)
                                                                : item.status === 'sedang_dicuci'
                                                                    ? formatTime(item.estimasi)
                                                                    : '--:--:--'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {item.keluhan && (
                                                    <p className="text-[9px] font-medium text-zinc-500 mb-2 bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-100 leading-relaxed">{item.keluhan}</p>
                                                )}

                                                {(canComplete || canExtend) && (
                                                    <div className="flex gap-2 mt-1">
                                                        {canComplete && (
                                                            <button onClick={() => handleSelesai(item)} disabled={isLoadingProcess || isCompleting}
                                                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                                {isCompleting ? (
                                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 size={14} />
                                                                )}
                                                                {isCompleting ? 'Memproses...' : 'Selesai'}
                                                            </button>
                                                        )}
                                                        {canExtend && (
                                                            <button onClick={() => handleOpenExtension(item)}
                                                                className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                                <Clock size={14} /> +Waktu
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 md:py-12 bg-zinc-50 rounded-2xl">
                                    <Activity size={32} className="text-zinc-300 mx-auto mb-2" />
                                    <p className="font-bold text-zinc-400">Tidak ada unit untuk {expandedMechanic}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ===== ASSIGN MODAL (Multi-Select) ===== */}
            {assignModal.show && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setAssignModal({ show: false, item: null }); setSelectedMechanics([]); setAssignSearch(''); }}>
                    <div className="bg-white rounded-[2rem] p-5 md:p-6 w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4 shrink-0">
                            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                                <UserPlus size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-black text-sm text-black uppercase tracking-tight">Pilih Mekanik</h3>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{assignModal.item?.bk} — {assignModal.item?.tipe || '-'}</p>
                            </div>
                            <button onClick={() => { setAssignModal({ show: false, item: null }); setSelectedMechanics([]); setAssignSearch(''); }}
                                className="w-8 h-8 bg-zinc-100 hover:bg-zinc-200 rounded-xl flex items-center justify-center shrink-0">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="relative mb-3 shrink-0">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                placeholder="Cari nama mekanik..."
                                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all"
                                autoFocus />
                        </div>

                        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
                            {filteredMechanics.length === 0 ? (
                                <div className="text-center py-6">
                                    <Search size={24} className="text-zinc-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-zinc-400">Mekanik tidak ditemukan</p>
                                </div>
                            ) : (
                                filteredMechanics.map(mek => {
                                    const isSelected = selectedMechanics.includes(mek.name);
                                    return (
                                        <button key={mek.name}
                                            onClick={() => toggleMechanic(mek.name)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                                                isSelected
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-zinc-50 text-zinc-700 border-zinc-100 hover:border-zinc-300'
                                            }`}>
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                isSelected ? 'bg-white/20' : 'bg-zinc-200'
                                            }`}>
                                                <User size={12} className={isSelected ? 'text-white' : 'text-zinc-500'} />
                                            </div>
                                            <div className="text-left min-w-0 flex-1">
                                                <p className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-black'}`}>{mek.name}</p>
                                                <p className={`text-[7px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/60' : 'text-zinc-400'}`}>{mek.status || 'active'}</p>
                                            </div>
                                            {isSelected && <Check size={14} className="text-white shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex gap-2 mt-4 shrink-0">
                            <button onClick={() => { setAssignModal({ show: false, item: null }); setSelectedMechanics([]); setAssignSearch(''); }}
                                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
                                Batal
                            </button>
                            <button onClick={handleAssign} disabled={selectedMechanics.length === 0 || isAssigning}
                                className="flex-1 py-3 bg-black hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                {isAssigning ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Check size={14} />
                                )}
                                {isAssigning ? 'Menyimpan...' : `Assign (${selectedMechanics.length} mekanik)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EXTENSION MODAL ===== */}
            {extensionModal.show && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setExtensionModal(s => ({ ...s, show: false }))}>
                    <div className="bg-white rounded-[2rem] p-5 md:p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                                <Clock size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-sm text-black uppercase tracking-tight">Tambah Waktu</h3>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{extensionModal.item?.bk} — {extensionModal.item?.mechanicName}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Durasi Tambahan</p>
                            <div className="grid grid-cols-3 gap-2">
                                {EXTENSION_PRESETS.map(min => (
                                    <button key={min} onClick={() => setExtensionModal(s => ({ ...s, extraMinutes: min }))}
                                        className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 border-2 ${extensionModal.extraMinutes === min ? 'bg-amber-500 text-white border-amber-600' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-amber-300'}`}>
                                        {min} Menit
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-5">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Alasan</p>
                            <textarea value={extensionModal.reason} onChange={e => setExtensionModal(s => ({ ...s, reason: e.target.value }))}
                                placeholder="Alasan request tambahan waktu..."
                                className="w-full px-3 py-3 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 resize-none h-20" />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setExtensionModal(s => ({ ...s, show: false }))}
                                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
                                Batal
                            </button>
                            <button onClick={handleSubmitExtension}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                                Kirim Request
                            </button>
                        </div>
                        <p className="text-[7px] text-zinc-400 text-center mt-3">Request akan dikonfirmasi oleh Admin/SA</p>
                    </div>
                </div>
            )}
        </div>
    );
}
