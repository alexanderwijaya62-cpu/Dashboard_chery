import React, { useState, useEffect, useMemo } from 'react';
import { User, CheckCircle, Calendar, Key, AlertCircle, TrendingUp, CheckCircle2, Eye, EyeOff, Zap, Shield, Clock, Activity, FileText, X } from 'lucide-react';

const MechanicPanel = ({ user, handleLogout, handleChangePassword, rawHistory = [], queue = [], onStartWork, onComplete, onToggleTask, formatTime }) => {
    const [history, setHistory] = useState([]);
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [isLoadingProcess, setIsLoadingProcess] = useState(false);

    const toggleShow = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

    useEffect(() => {
        let targetHistory = rawHistory;
        if (!targetHistory || targetHistory.length === 0) {
            targetHistory = JSON.parse(localStorage.getItem('chery_history') || '[]');
        }

        const myHistory = targetHistory
            .filter(item => item.mechanicName === user.name)
            .map(item => ({
                ...item,
                completedAt: item.completedAt || item.timestamp || parseInt(item.id) || Date.now()
            }))
            .sort((a, b) => b.completedAt - a.completedAt);

        setHistory(myHistory);
    }, [user.name, rawHistory]);

    const myActiveJobs = useMemo(() => {
        return queue.filter(item => item.status === 'working' && item.mechanicName === user.name);
    }, [queue, user.name]);

    const availableQueue = useMemo(() => {
        return queue.filter(item => {
            if (item.status === 'waiting') {
                // Jika sudah ada mekanik yang ditugaskan (misal oleh Admin), 
                // hanya mekanik tersebut yang bisa melihatnya di antrean.
                // Jika belum ada, semua mekanik bisa lihat.
                return !item.mechanicName || item.mechanicName === user.name;
            }
            if (item.status === 'menginap') {
                // KHUSUS MENGINAP: Hanya boleh untuk mekanik yang sebelumnya sudah menghandle.
                // Jika belum ada mekanik, maka semua mekanik bisa ambil.
                return !item.mechanicName || item.mechanicName === user.name;
            }
            return false;
        });
    }, [queue, user.name]);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfWeekInfo = new Date(now);
        const day = startOfWeekInfo.getDay();
        const diff = startOfWeekInfo.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeekInfo.setDate(diff);
        startOfWeekInfo.setHours(0, 0, 0, 0);
        const startOfWeekTs = startOfWeekInfo.getTime();

        const startOfMonthInfo = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfMonthTs = startOfMonthInfo.getTime();

        let weekly = 0;
        let monthly = 0;
        let total = history.length;

        history.forEach(item => {
            if (item.completedAt >= startOfWeekTs) weekly++;
            if (item.completedAt >= startOfMonthTs) monthly++;
        });

        return { weekly, monthly, total };
    }, [history]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Semua field wajib diisi!' });
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Password baru dan konfirmasi tidak cocok!' });
            return;
        }

        setIsSubmitting(true);
        const result = await handleChangePassword(passwordForm.oldPassword, passwordForm.newPassword);
        setIsSubmitting(false);

        if (result.success) {
            setPasswordMessage({ type: 'success', text: result.message });
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } else {
            setPasswordMessage({ type: 'error', text: result.message });
        }
        setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
    };

    return (
        <div className="p-3 md:p-6 max-w-[1400px] mx-auto animate-fade-in pb-20 text-zinc-900 overflow-x-hidden">
            {/* Header Profile */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 md:mb-8 bg-zinc-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-xl gap-4">
                <div className="flex items-center gap-5 w-full sm:w-auto">
                    <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                        <User className="text-white" size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1.5">Mekanik Workspace</p>
                        <h3 className="text-2xl font-black tracking-tight text-white">{user?.name}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setSelectedUnit('settings')}
                        className="p-3 min-w-[44px] min-h-[44px] bg-white/5 text-white/50 rounded-2xl hover:text-white transition-all ml-auto flex items-center justify-center"
                    >
                        <Key size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 items-start">

                {/* LEFT SIDE: ACTIVE & QUEUE */}
                <div className="lg:col-span-8 flex flex-col gap-4 md:gap-8">

                    {/* MY ACTIVE JOBS */}
                    <section>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
                                <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div> Sedang Dikerjakan
                            </h2>
                            <span className="bg-zinc-50 text-black text-[10px] font-black px-3 py-1 rounded-full border border-black">{myActiveJobs.length} Aktif</span>
                        </div>

                        {myActiveJobs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myActiveJobs.map(item => (
                                    <div key={item.id} className="bg-white border-2 border-dashed border-zinc-300 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="bg-black text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">{item.category}</span>
                                                <h3 className="text-4xl font-black text-zinc-900 tracking-tighter leading-none mb-1 font-mono">{item.bk}</h3>
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">{item.tipe}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Target Selesai</p>
                                                <p className="text-xl font-black text-black leading-none tabular-nums">
                                                    {new Date(parseInt(item.targetTime)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900 border-2 border-black text-white p-5 rounded-3xl mb-5 text-center shadow-xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Estimasi Timer</p>
                                            <p className="text-4xl font-black tracking-[0.2em] tabular-nums">{formatTime(item.estimasi)}</p>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setSelectedUnit(item)}
                                                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 py-4 min-h-[44px] rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-zinc-200 shadow-sm"
                                            >
                                                <FileText size={16} className="text-black" /> Detail & Tasks
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setIsLoadingProcess(true);
                                                    try { await onComplete(item); } catch(e) {}
                                                    setIsLoadingProcess(false);
                                                }}
                                                disabled={isLoadingProcess}
                                                className={`flex-1 py-4 min-h-[44px] rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border-2 ${isLoadingProcess ? 'bg-zinc-200 border-zinc-300 text-zinc-300 cursor-not-allowed' : 'bg-black hover:bg-zinc-800 text-white shadow-lg border-black'}`}
                                            >
                                                {isLoadingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><CheckCircle2 size={16} /> Selesai</>}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-2xl md:rounded-[2.5rem] p-8 md:p-16 text-center">
                                <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Activity size={32} className="text-zinc-300" />
                                </div>
                                <p className="text-zinc-500 font-bold">Belum ada unit yang dikerjakan.</p>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Pilih antrean di bawah untuk memulai.</p>
                            </div>
                        )}
                    </section>

                    {/* AVAILABLE QUEUE */}
                    <section>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
                                <div className="w-2 h-2 bg-zinc-300 rounded-full"></div> Antrean Tersedia
                            </h2>
                            <span className="bg-zinc-100 text-zinc-400 text-[10px] font-black px-3 py-1 rounded-full">{availableQueue.length} Unit</span>
                        </div>

                        <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-zinc-100 overflow-hidden shadow-xl shadow-zinc-200/40">
                            {availableQueue.length > 0 ? (
                                <div className="divide-y divide-zinc-50">
                                    {availableQueue.map(item => (
                                        <div key={item.id} className="p-4 md:p-6 hover:bg-zinc-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${item.status === 'menginap' ? 'bg-zinc-900' : 'bg-black'}`}>
                                                    {item.status === 'menginap' ? <Shield size={18} fill="white" /> : <Zap size={18} fill="white" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                        <h4 className="text-lg md:text-xl font-black text-zinc-900 font-mono leading-none tracking-tight">{item.bk}</h4>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${item.status === 'menginap' ? 'bg-zinc-100 text-zinc-400 border border-zinc-200' : 'bg-zinc-100 text-black border border-black'}`}>{item.status === 'menginap' ? 'Menginap' : item.category}</span>
                                                    </div>
                                                    <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">{item.tipe}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 sm:border-l sm:pl-8 border-zinc-100">
                                                <div className="hidden sm:block">
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">Estimasi Kerja</p>
                                                    <p className="text-lg font-black text-zinc-900 leading-none">{formatTime(item.estimasiDefault)}</p>
                                                </div>
                                                <button
                                                    onClick={() => onStartWork(item)}
                                                    className={`px-6 md:px-8 py-3 min-h-[44px] min-w-[44px] rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${item.status === 'menginap' ? 'bg-black text-white hover:bg-zinc-800' : 'bg-black text-white hover:bg-zinc-800'}`}
                                                >
                                                    <Zap size={14} fill="white" /> {item.status === 'menginap' ? 'Lanjutkan' : 'Mulai'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-16 text-center opacity-30 italic">
                                    <p className="font-bold text-zinc-400">Panggung bersih! Tidak ada antrean yang menunggu.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* RIGHT SIDE: STATS & SETTINGS */}
                <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">

                    {/* STATS CARDS */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] border border-zinc-200 shadow-lg shadow-zinc-200/30">
                            <TrendingUp className="text-black mb-3" size={20} />
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-2">Mingguan</p>
                            <p className="text-3xl md:text-4xl font-black text-zinc-900 leading-none">{stats.weekly}</p>
                        </div>
                        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] border border-zinc-200 shadow-lg shadow-zinc-200/30">
                            <Calendar className="text-black mb-3" size={20} />
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-2">Bulanan</p>
                            <p className="text-3xl md:text-4xl font-black text-zinc-900 leading-none">{stats.monthly}</p>
                        </div>
                        <div className="col-span-2 bg-zinc-900 p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] border border-zinc-800 shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">Total Selesai</p>
                                    <p className="text-3xl md:text-4xl font-black text-white leading-none">{stats.total}</p>
                                </div>
                                <CheckCircle2 className="text-white" size={40} />
                            </div>
                        </div>
                    </div>

                    {/* HISTORY LIST MINI */}
                    <div className="bg-white rounded-2xl md:rounded-[2rem] border border-zinc-200 shadow-xl shadow-zinc-200/30 overflow-hidden flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                        <div className="p-4 md:p-6 border-b border-zinc-50 bg-zinc-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Riwayat Terakhir</h3>
                            <span className="text-[9px] font-bold text-zinc-300">{history.length} ITEMS</span>
                        </div>
                        <div className="divide-y divide-zinc-50">
                            {history.slice(0, 10).map((h, i) => (
                                <div key={i} className="p-4 min-h-[44px] flex justify-between items-center bg-white hover:bg-zinc-50 transition-all">
                                    <div>
                                        <p className="text-sm font-black text-zinc-900 font-mono tracking-tighter leading-none mb-1">{h.bk}</p>
                                        <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{h.tipe}</p>
                                    </div>
                                    <p className="text-[10px] md:text-[11px] font-black text-zinc-400 font-mono">{new Date(h.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                                </div>
                            ))}
                        </div>
                        {history.length === 0 && (
                            <div className="p-10 text-center opacity-30 italic text-xs">Belum ada riwayat</div>
                        )}
                    </div>
                </div>
            </div>

            {/* DETAIL MODAL (Work Progress) */}
            {selectedUnit && selectedUnit !== 'settings' && (() => {
                // Read live data from queue prop so checklist updates real-time while modal is open
                const liveUnit = queue.find(q => q.id === selectedUnit.id) || selectedUnit;

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-2 md:p-4" onClick={() => setSelectedUnit(null)}>
                        <div className="bg-white rounded-2xl md:rounded-[3rem] w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col border border-zinc-100 animate-fade-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="bg-zinc-900 p-4 md:p-8 border-b border-zinc-800 flex justify-between items-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -z-10"></div>
                                <div className="flex items-center gap-3 md:gap-6">
                                    <div className="bg-black p-2.5 md:p-3.5 rounded-xl md:rounded-2xl text-white shadow-xl"><Zap size={20} fill="white" /></div>
                                    <div>
                                        <h3 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-white leading-none mb-1 font-mono">{liveUnit.bk}</h3>
                                        <p className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">{liveUnit.tipe} • Work Progress</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedUnit(null)} className="p-3 min-w-[44px] min-h-[44px] bg-white/10 text-white/50 hover:text-white rounded-xl md:rounded-2xl transition-all border border-white/10 flex items-center justify-center"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                                <div className="mb-6 md:mb-8 p-4 md:p-6 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-200 flex items-start gap-3 md:gap-4">
                                    <div className="p-2 bg-black rounded-lg text-white shrink-0"><Activity size={16} /></div>
                                    <div>
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Keluhan Utama</p>
                                        <p className="text-base md:text-lg font-bold text-zinc-900 leading-tight italic">"{liveUnit.keluhan || 'Tidak ada catatan keluhan'}"</p>
                                    </div>
                                </div>

                                {/* CHECKLIST */}
                                <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1 mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div> Progress Checklist
                                </h4>
                                <div className="space-y-3">
                                    {(liveUnit.checklist || []).length === 0 ? (
                                        <div className="py-12 border-2 border-dashed border-zinc-100 rounded-3xl flex flex-col items-center justify-center opacity-40">
                                            <CheckCircle size={32} className="mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Belum ada task checklist</p>
                                        </div>
                                    ) : liveUnit.checklist.map(task => (
                                        <button
                                            key={task.id}
                                            disabled={false}
                                            onClick={() => onToggleTask(liveUnit, task.id)}
                                            className={`w-full flex items-center gap-3 md:gap-4 p-4 md:p-5 min-h-[44px] rounded-xl md:rounded-2xl transition-all border shadow-sm ${task.completed ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-100 hover:border-black'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${task.completed ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-300'}`}>
                                                <CheckCircle size={18} />
                                            </div>
                                            <span className={`font-bold uppercase tracking-tight text-left text-sm ${task.completed ? 'text-zinc-400 line-through opacity-60' : 'text-zinc-900'}`}>{task.text}</span>
                                        </button>
                                    ))}
                                    {liveUnit.status !== 'working' && (liveUnit.checklist || []).length > 0 && (
                                        <p className="text-center text-[10px] font-black text-zinc-400 mt-6 bg-zinc-50 py-3 rounded-xl border border-zinc-100 uppercase tracking-widest">Status: Menunggu dimulai</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* SETTINGS MODAL */}
            {selectedUnit === 'settings' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-2 md:p-4" onClick={() => setSelectedUnit(null)}>
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] w-full max-w-md shadow-2xl p-4 md:p-8 border border-zinc-100 animate-fade-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10"></div>
                        <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                            <div className="bg-zinc-900 p-1.5 rounded-lg text-white"><Key size={18} /></div>
                            Ganti Password
                        </h3>

                        <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Lama</label>
                                <div className="relative">
                                    <input required type={showPasswords.old ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-3 md:p-4 pr-12 rounded-xl text-base md:text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all min-h-[44px]"
                                        value={passwordForm.oldPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('old')} className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                        {showPasswords.old ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Baru</label>
                                <div className="relative">
                                    <input required type={showPasswords.new ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-3 md:p-4 pr-12 rounded-xl text-base md:text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all min-h-[44px]"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('new')} className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Konfirmasi</label>
                                <div className="relative">
                                    <input required type={showPasswords.confirm ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-3 md:p-4 pr-12 rounded-xl text-base md:text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all min-h-[44px]"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('confirm')} className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {passwordMessage.text && (
                                <div className={`text-[11px] p-4 rounded-xl border flex items-center gap-2 font-bold ${passwordMessage.type === 'error' ? 'bg-zinc-50 text-black border-zinc-300' : 'bg-zinc-50 text-black border-zinc-300'}`}>
                                    {passwordMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                                    {passwordMessage.text}
                                </div>
                            )}

                            <button type="submit" disabled={isSubmitting} className="w-full bg-zinc-900 hover:bg-black text-white py-4 md:py-5 min-h-[44px] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex justify-center items-center gap-2">
                                {isSubmitting ? 'Memproses...' : 'Simpan Password'}
                            </button>
                            <button type="button" onClick={() => setSelectedUnit(null)} className="w-full text-zinc-400 text-[10px] md:text-[11px] font-black uppercase tracking-widest py-2 min-h-[44px]">Batal</button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
            `}</style>

        </div>
    );
};

export default MechanicPanel;
