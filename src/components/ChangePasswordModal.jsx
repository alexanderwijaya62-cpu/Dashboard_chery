import React, { useState } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, onClose, onChangePassword }) {
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const toggleShow = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'Semua field wajib diisi!' });
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password baru minimal 6 karakter!' });
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'Password baru dan konfirmasi tidak cocok!' });
            return;
        }
        setIsSubmitting(true);
        const result = await onChangePassword(passwordForm.oldPassword, passwordForm.newPassword);
        setIsSubmitting(false);
        if (result.success) {
            setMessage({ type: 'success', text: result.message || 'Password berhasil diubah!' });
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } else {
            setMessage({ type: 'error', text: result.message || 'Gagal mengubah password!' });
        }
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    const handleClose = () => {
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setMessage({ type: '', text: '' });
        setShowPasswords({ old: false, new: false, confirm: false });
        onClose();
    };

    const inputClass = "w-full bg-zinc-50 border border-zinc-200 p-3 pr-12 rounded-xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-zinc-900 outline-none transition-all min-h-[44px]";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-2 md:p-4" onClick={handleClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-4 md:p-8 border border-zinc-100 animate-fade-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-full -z-10"></div>
                <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                    <div className="bg-zinc-900 p-1.5 rounded-lg text-white"><Key size={18} /></div>
                    Ganti Password
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Lama</label>
                        <div className="relative">
                            <input required type={showPasswords.old ? "text" : "password"} placeholder="••••••••"
                                className={inputClass}
                                value={passwordForm.oldPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => toggleShow('old')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                {showPasswords.old ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Password Baru</label>
                        <div className="relative">
                            <input required type={showPasswords.new ? "text" : "password"} placeholder="••••••••"
                                className={inputClass}
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => toggleShow('new')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest ml-1">Konfirmasi</label>
                        <div className="relative">
                            <input required type={showPasswords.confirm ? "text" : "password"} placeholder="••••••••"
                                className={inputClass}
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => toggleShow('confirm')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {message.text && (
                        <div className={`text-[11px] p-4 rounded-xl border flex items-center gap-2 font-bold bg-zinc-50 text-black border-zinc-300`}>
                            {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                            {message.text}
                        </div>
                    )}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex justify-center items-center gap-2">
                        {isSubmitting ? 'Memproses...' : 'Simpan Password'}
                    </button>
                    <button type="button" onClick={handleClose} className="w-full text-zinc-400 text-[11px] font-black uppercase tracking-widest py-2">Batal</button>
                </form>
            </div>
        </div>
    );
}
