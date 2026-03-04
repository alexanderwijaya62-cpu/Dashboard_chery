import React, { useState, useEffect, useMemo } from 'react';
import { User, LogOut, CheckCircle, Calendar, Key, AlertCircle, TrendingUp, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const MechanicPanel = ({ user, handleLogout, handleChangePassword, rawHistory = [] }) => {
    const [history, setHistory] = useState([]);
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleShow = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

    useEffect(() => {
        // Ambil data history dari props rawHistory (yang difetch dari Google Sheets)
        // Kita bandingkan mechanicName dari Google Sheets dengan user.name
        // Jika rawHistory kosong, fallback ke local storage sementara untuk offline support

        let targetHistory = rawHistory;

        if (!targetHistory || targetHistory.length === 0) {
            targetHistory = JSON.parse(localStorage.getItem('chery_history') || '[]');
        }

        const myHistory = targetHistory
            .filter(item => item.mechanicName === user.name)
            // Jika ada .completedAt (dari localStorage) gunakan, jika tidak pakai .timestamp atau format id array dari sheets
            .map(item => ({
                ...item,
                completedAt: item.completedAt || item.timestamp || parseInt(item.id) || Date.now()
            }))
            .sort((a, b) => b.completedAt - a.completedAt);

        setHistory(myHistory);
    }, [user.name, rawHistory]);

    const stats = useMemo(() => {
        const now = new Date();
        // Reset jam ke 00:00:00 untuk start of week dan start of month

        // Hitung awal minggu ini (Senin atau Minggu, misalnya Senin)
        const startOfWeekInfo = new Date(now);
        const day = startOfWeekInfo.getDay();
        const diff = startOfWeekInfo.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeekInfo.setDate(diff);
        startOfWeekInfo.setHours(0, 0, 0, 0);
        const startOfWeekTs = startOfWeekInfo.getTime();

        // Hitung awal bulan ini
        const startOfMonthInfo = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfMonthTs = startOfMonthInfo.getTime();

        let weekly = 0;
        let monthly = 0;
        let total = history.length;

        history.forEach(item => {
            if (item.completedAt >= startOfWeekTs) {
                weekly++;
            }
            if (item.completedAt >= startOfMonthTs) {
                monthly++;
            }
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
        <div className="p-6 max-w-[1200px] mx-auto animate-fade-in pb-20">
            {/* Header Profile */}
            <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-zinc-900 rounded-xl">
                        <User className="text-white" size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1">Mekanik Workspace</p>
                        <h3 className="text-lg font-black tracking-tight text-zinc-900">{user?.name}</h3>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="bg-red-50 text-red-600 px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                >
                    <LogOut size={16} /> Logout
                </button>
            </div>

            {/* Laporan Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Mingguan</h3>
                    </div>
                    <p className="flex items-end gap-2">
                        <span className="text-5xl font-black text-zinc-900 leading-none">{stats.weekly}</span>
                        <span className="text-xs font-bold text-zinc-400 mb-1 uppercase tracking-widest">Mobil</span>
                    </p>
                </div>

                <div className="bg-white p-6 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Calendar size={24} />
                        </div>
                        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Bulanan</h3>
                    </div>
                    <p className="flex items-end gap-2">
                        <span className="text-5xl font-black text-zinc-900 leading-none">{stats.monthly}</span>
                        <span className="text-xs font-bold text-zinc-400 mb-1 uppercase tracking-widest">Mobil</span>
                    </p>
                </div>

                <div className="bg-white p-6 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Total</h3>
                    </div>
                    <p className="flex items-end gap-2">
                        <span className="text-5xl font-black text-zinc-900 leading-none">{stats.total}</span>
                        <span className="text-xs font-bold text-zinc-400 mb-1 uppercase tracking-widest">Mobil</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form Ganti Password */}
                <div className="lg:col-span-5">
                    <div className="bg-white p-8 rounded-[1.5rem] border border-zinc-200 shadow-xl shadow-zinc-200/40 sticky top-24">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                            <div className="bg-zinc-900 p-1.5 rounded-lg text-white">
                                <Key size={18} />
                            </div>
                            Ganti Password
                        </h2>

                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Lama</label>
                                <div className="relative">
                                    <input required type={showPasswords.old ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-4 pr-12 rounded-xl text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all"
                                        value={passwordForm.oldPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('old')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        {showPasswords.old ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Baru</label>
                                <div className="relative">
                                    <input required type={showPasswords.new ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-4 pr-12 rounded-xl text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('new')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Konfirmasi Password Baru</label>
                                <div className="relative">
                                    <input required type={showPasswords.confirm ? "text" : "password"} placeholder="••••••••"
                                        className="w-full bg-zinc-50 border border-zinc-200 p-4 pr-12 rounded-xl text-lg font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    />
                                    <button type="button" onClick={() => toggleShow('confirm')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {passwordMessage.text && (
                                <div className={`text-[11px] p-4 rounded-xl border flex items-center gap-2 font-bold ${passwordMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                    {passwordMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                                    {passwordMessage.text}
                                </div>
                            )}

                            <button type="submit" disabled={isSubmitting} className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex justify-center items-center gap-2">
                                {isSubmitting ? 'Memproses...' : 'Simpan Password Baru'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History List */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-[1.5rem] border border-zinc-200 overflow-hidden shadow-lg shadow-zinc-200/30">
                        <div className="px-8 py-6 border-b border-zinc-100 bg-zinc-50/30 flex justify-between items-center">
                            <h3 className="text-xl font-black italic tracking-tight uppercase flex items-center gap-3">
                                <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                                    <CheckCircle size={18} />
                                </div>
                                Riwayat Kendaraan
                            </h3>
                            <span className="bg-zinc-900 text-white text-[9px] font-black px-3 py-1 rounded-full">{history.length} Selesai</span>
                        </div>

                        {history.length > 0 ? (
                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b border-zinc-100 sticky top-0 backdrop-blur-md">
                                            <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black">Detail Mobil</th>
                                            <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black text-center">Tipe Reg/Book</th>
                                            <th className="px-8 py-4 text-zinc-400 uppercase tracking-widest text-[9px] font-black text-right">Waktu Selesai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 text-sm">
                                        {history.map((item, index) => (
                                            <tr key={index} className="hover:bg-zinc-50/50 transition-all">
                                                <td className="px-8 py-5">
                                                    <div>
                                                        <p className="text-xl font-black tracking-tight text-zinc-900">{item.bk}</p>
                                                        <p className="text-zinc-500 text-[10px] uppercase font-black">{item.tipe}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${item.category === 'Booking' ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono text-zinc-400 text-sm font-bold">
                                                    {new Date(item.completedAt).toLocaleDateString('id-ID')} {new Date(item.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-16 text-center text-zinc-400 flex flex-col items-center justify-center">
                                <div className="bg-zinc-50 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle size={32} className="text-zinc-300" />
                                </div>
                                <p className="font-bold text-lg text-zinc-500">Belum ada riwayat pengerjaan.</p>
                                <p className="text-sm">Kendaraan yang diselesaikan akan muncul di sini.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MechanicPanel;
