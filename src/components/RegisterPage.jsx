import React, { useState, useRef, useEffect } from 'react';
import { Phone, ArrowRight, AlertCircle, Eye, EyeOff, Lock, MessageCircle, ShieldCheck, Send, RefreshCw } from 'lucide-react';
import { db } from '../utils/dbClient';
import { WA_BASE_URL, WA_INSTANCE } from '../utils/waClient';
import cheryLogo from '../assets/cherylogo.png';
import orientalLogo from '../assets/oriental.jpeg';

const WA_BOT_NUMBER = import.meta.env.VITE_WA_BOT_NUMBER || '628888512596';
const OTP_DURATION = 300; // 5 menit (detik)
const RESEND_COOLDOWN = 60; // 1 menit (detik)
const REGISTRATION_STATE_KEY = 'chery_registration_state';

const saveRegistrationState = (state) => {
  try {
    localStorage.setItem(REGISTRATION_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
};

const clearRegistrationState = () => {
  try {
    localStorage.removeItem(REGISTRATION_STATE_KEY);
  } catch (_) {}
};

const loadRegistrationState = () => {
  try {
    const raw = localStorage.getItem(REGISTRATION_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const RegisterPage = ({ setCurrentPage, setErrorMessage, errorMessage }) => {
  const saved = loadRegistrationState();

  const initialTimeLeft = (() => {
    if (saved && saved.otpExpiresAt) {
      const remaining = Math.max(0, Math.floor((new Date(saved.otpExpiresAt).getTime() - Date.now()) / 1000));
      return remaining;
    }
    return OTP_DURATION;
  })();

  const initialResendCooldown = (() => {
    if (saved && saved.resendCooldownUntil) {
      return Math.max(0, Math.floor((new Date(saved.resendCooldownUntil).getTime() - Date.now()) / 1000));
    }
    return 0;
  })();

  const [phone, setPhone] = useState(saved?.phone || '');
  const [password, setPassword] = useState(saved?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(saved?.step || 'form');
  const [otpCode, setOtpCode] = useState(saved?.otpCode || '');
  const [otpVerified, setOtpVerified] = useState(saved?.otpVerified || false);
  const [socketReady, setSocketReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const [otpExpiresAt, setOtpExpiresAt] = useState(saved?.otpExpiresAt || null);
  const [isOtpExpired, setIsOtpExpired] = useState(saved?.isOtpExpired || (initialTimeLeft <= 0 && saved?.step === 'otp') || false);
  const [resendCooldown, setResendCooldown] = useState(initialResendCooldown);
  const [isResending, setIsResending] = useState(false);
  const socketRef = useRef(null);
  const isSubmitting = useRef(false);

  const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    if (digits.startsWith('62')) return digits;
    return '62' + digits;
  };

  const activateAccount = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      await db.update('customers', { status: 'active', otp: null, otp_expires_at: null }, { eq: { no_hp: phone } });

      await db.insert('notifications', {
        type: 'registration_active',
        message: `Akun pelanggan aktif: ${phone}`,
        target_role: 'owner',
        read: false
      }).catch(() => {});

      setOtpVerified(true);
    } catch (err) {
      console.error(err);
    } finally {
      isSubmitting.current = false;
    }
  };

  // ── Persist registration state to localStorage ──
  useEffect(() => {
    if (otpVerified) {
      clearRegistrationState();
      return;
    }
    saveRegistrationState({
      phone,
      password,
      step,
      otpCode,
      otpVerified,
      isOtpExpired,
      otpExpiresAt,
      resendCooldownUntil: resendCooldown > 0 ? new Date(Date.now() + resendCooldown * 1000).toISOString() : null,
    });
  }, [phone, password, step, otpCode, otpVerified, isOtpExpired, timeLeft, resendCooldown, otpExpiresAt]);

  // ── Countdown OTP ──
  useEffect(() => {
    if (step !== 'otp' || otpVerified || isOtpExpired) return;
    let destroyed = false;

    const update = () => {
      if (destroyed) return;
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsOtpExpired(true);
          return 0;
        }
        return prev - 1;
      });
    };

    const timer = setInterval(update, 1000);
    return () => { destroyed = true; clearInterval(timer); };
  }, [step, otpVerified, isOtpExpired]);

  // ── Resend cooldown ──
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── Polling: cek status jadi active via webhook ──
  useEffect(() => {
    if (step !== 'otp' || otpVerified) return;
    let destroyed = false;
    let timer;

    const checkStatus = async () => {
      if (destroyed) return;
      try {
        const { data } = await db.select('customers', {
          select: 'status',
          eq: { no_hp: phone },
          maybeSingle: true,
        });
        if (data && data.status === 'active') {
          setOtpVerified(true);
        }
      } catch (_) {}
    };

    timer = setInterval(checkStatus, 1500);
    checkStatus();

    return () => {
      destroyed = true;
      clearInterval(timer);
    };
  }, [step, otpVerified, phone]);

  // ── Socket.IO listener ──
  useEffect(() => {
    if (step !== 'otp' || otpVerified || isOtpExpired) return;

    let io = null;
    let socket = null;
    let destroyed = false;

    const waNumber = formatPhone(phone);

    const startSocket = async () => {
      try {
        const modName = 'socket.io-client';
      io = (await import(modName)).io;
        socket = io(WA_BASE_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));

        const eventName = `message:${WA_INSTANCE}`;
        socket.on(eventName, (data) => {
          if (destroyed) return;
          const sender = (data.sender || '').replace(/\D/g, '');
          const msg = (data.text || '').trim();

          if (sender === waNumber && msg === otpCode) {
            activateAccount();
          }
        });
      } catch (e) {
        console.warn('Socket.IO tidak tersedia, fallback ke manual');
      }
    };

    startSocket();

    return () => {
      destroyed = true;
      if (socket) socket.disconnect();
    };
  }, [step, otpVerified, phone, otpCode, isOtpExpired]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    if (!phone || phone.length < 10) {
      alert("Nomor telepon tidak valid!");
      isSubmitting.current = false;
      return;
    }
    if (!password || password.length < 6) {
      alert("Password minimal 6 karakter!");
      isSubmitting.current = false;
      return;
    }

    setIsLoading(true);
    try {
      const { data: existingUsers, error: checkErr } = await db.select('customers', {
        select: 'no_hp, status', eq: { no_hp: phone }, limit: 2
      });

      if (checkErr) throw checkErr;

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_DURATION * 1000).toISOString();

      if (existingUsers && existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        if (existingUser.status === 'pending') {
          // Update the pending registration with new password and OTP
          const { error: updateErr } = await db.update('customers', {
            password: password,
            nama: phone,
            otp: otp,
            otp_expires_at: expiresAt
          }, { eq: { no_hp: phone } });

          if (updateErr) throw updateErr;

          try {
            await db.insert('notifications', {
              type: 'new_registration',
              message: `Pelanggan mendaftar ulang (pending): ${phone}, OTP: ${otp}`,
              target_role: 'owner',
              read: false
            });
          } catch (e) {
            console.warn("Gagal mengirim notifikasi ke owner");
          }

          setOtpCode(otp);
          setOtpExpiresAt(expiresAt);
          setTimeLeft(OTP_DURATION);
          setIsOtpExpired(false);
          setStep('otp');
          return;
        } else {
          alert("Nomor ini sudah terdaftar. Silakan login.");
          (clearRegistrationState(), setCurrentPage('login'));
          return;
        }
      }

      const { error: insertErr } = await db.insert('customers', {
        no_hp: phone,
        password: password,
        nama: phone,
        status: 'pending',
        otp: otp,
        otp_expires_at: expiresAt
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          alert("Nomor ini sudah terdaftar. Silakan login.");
          (clearRegistrationState(), setCurrentPage('login'));
          return;
        }
        throw insertErr;
      }

      try {
        await db.insert('notifications', {
          type: 'new_registration',
          message: `Pelanggan baru mendaftar: ${phone}, OTP: ${otp}`,
          target_role: 'owner',
          read: false
        });
      } catch (e) {
        console.warn("Gagal mengirim notifikasi ke owner");
      }

      setOtpCode(otp);
      setOtpExpiresAt(expiresAt);
      setTimeLeft(OTP_DURATION);
      setIsOtpExpired(false);
      setStep('otp');
    } catch (err) {
      console.error(err);
      alert("Gagal melakukan registrasi.");
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (isSubmitting.current || isResending || resendCooldown > 0) return;
    isSubmitting.current = true;
    setIsResending(true);

    try {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_DURATION * 1000).toISOString();

      await db.update('customers', {
        otp: otp,
        otp_expires_at: expiresAt
      }, { eq: { no_hp: phone } });

      await db.insert('notifications', {
        type: 'otp_resend',
        message: `Pelanggan minta OTP baru: ${phone}, OTP: ${otp}`,
        target_role: 'owner',
        read: false
      }).catch(() => {});

      setOtpCode(otp);
      setOtpExpiresAt(expiresAt);
      setTimeLeft(OTP_DURATION);
      setIsOtpExpired(false);
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      console.error(err);
      alert("Gagal mengirim ulang OTP.");
    } finally {
      setIsResending(false);
      isSubmitting.current = false;
    }
  };

  // ── Manual verify: cek DB langsung (sama kaya polling) ──
  const [isVerifying, setIsVerifying] = useState(false);
  const [manualError, setManualError] = useState('');

  const manualVerifyOtp = async () => {
    if (isVerifying || !phone || !otpCode) return;
    setIsVerifying(true);
    setManualError('');
    try {
      const { data } = await db.select('customers', {
        select: 'status', eq: { no_hp: phone }, maybeSingle: true,
      });
      if (data?.status === 'active') {
        setOtpVerified(true);
      } else {
        setManualError('Status masih pending. Pastikan kode OTP sudah dikirim ke WhatsApp.');
      }
    } catch (_) {
      setManualError('Gagal cek status. Coba lagi.');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── OTP VERIFIED SCREEN ──
  if (otpVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100 text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 mb-2">AKUN AKTIF</h2>
          <p className="text-zinc-400 text-xs font-bold mb-8 uppercase tracking-[0.2em]">Chery Oriental Medan</p>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-8">
            <p className="text-sm text-emerald-800 font-medium">
              Selamat! Akun kamu sudah aktif. Kamu bisa langsung login menggunakan nomor WhatsApp dan password yang didaftarkan.
            </p>
          </div>

          <button
            onClick={() => (clearRegistrationState(), setCurrentPage('login'))}
            className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95"
          >
            Ke Halaman Login
          </button>
        </div>
      </div>
    );
  }

  // ── OTP SCREEN ──
  if (step === 'otp') {
    const isExpired = isOtpExpired;
    const canResend = isExpired && resendCooldown === 0 && !isResending;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isExpired ? 'bg-red-50' : 'bg-blue-50'
          }`}>
            {isExpired ? (
              <AlertCircle size={40} className="text-red-600" />
            ) : (
              <MessageCircle size={40} className="text-blue-600" />
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 mb-2">
            {isExpired ? 'OTP KADALUWARSA' : 'AKTIVASI AKUN'}
          </h2>
          <p className="text-zinc-400 text-xs font-bold mb-6 uppercase tracking-[0.2em]">Chery Oriental Medan</p>

          {!isExpired ? (
            <>
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 mb-6 text-left">
                <p className="text-xs text-zinc-500 font-bold mb-1">Langkah aktivasi:</p>
                <ol className="text-xs text-zinc-700 space-y-2 font-medium">
                  <li>1. Buka WhatsApp kamu</li>
                  <li>2. Kirim pesan ke nomor <strong className="text-blue-600">{WA_BOT_NUMBER}</strong></li>
                  <li>3. Ketik kode: <strong className="text-lg tracking-widest text-blue-600">{otpCode}</strong></li>
                </ol>
              </div>

              {/* Countdown Timer */}
              <div className="mb-4">
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${timeLeft <= 60 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                  <span className={`font-bold text-sm ${timeLeft <= 60 ? 'text-red-600' : 'text-zinc-700'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Sisa waktu verifikasi</p>
              </div>

              {socketReady ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 font-bold">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Menunggu kiriman OTP via WhatsApp...
                  </div>
                  <p className="text-[10px] text-emerald-500 mt-2">
                    Kirim kode <strong>{otpCode}</strong> ke {WA_BOT_NUMBER} via WhatsApp
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-amber-700 font-bold text-center">
                    Kirim kode <strong>{otpCode}</strong> ke {WA_BOT_NUMBER} via WhatsApp
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  if (isSubmitting.current) return;
                  isSubmitting.current = true;
                  const waUrl = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(otpCode)}`;
                  window.open(waUrl, '_blank');
                  setTimeout(() => { isSubmitting.current = false; }, 1000);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 mb-6"
              >
                <Send size={18} /> Kirim OTP via WhatsApp
              </button>

              {manualError && (
                <p className="text-red-500 text-xs font-bold mb-3 flex items-center justify-center gap-2">
                  <AlertCircle size={14} /> {manualError}
                </p>
              )}
              <button
                onClick={manualVerifyOtp}
                disabled={isVerifying}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 mb-4"
              >
                {isVerifying ? 'Memeriksa...' : 'Sudah Kirim? Cek Status'}
              </button>

              <button
                type="button"
                onClick={() => (clearRegistrationState(), setCurrentPage('login'))}
                className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600 transition-colors"
              >
                Sudah punya akun? Login di sini
              </button>
            </>
          ) : (
            <>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-6">
                <p className="text-sm text-red-700 font-medium">
                  Kode OTP telah kadaluwarsa. Silakan kirim ulang kode OTP baru untuk melanjutkan aktivasi.
                </p>
              </div>

              <button
                onClick={handleResendOtp}
                disabled={!canResend || isResending}
                className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isResending ? 'Mengirim...' : resendCooldown > 0 ? (
                  <>Kirim Ulang ({resendCooldown}s)</>
                ) : (
                  <><RefreshCw size={18} /> Kirim Ulang OTP</>
                )}
              </button>

              <p className="text-[10px] text-zinc-400 mb-6">
                Setiap kali kirim ulang, OTP baru akan dibuat dan OTP sebelumnya tidak berlaku.
              </p>

              <button
                type="button"
                onClick={() => (clearRegistrationState(), setCurrentPage('login'))}
                className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600 transition-colors"
              >
                Kembali ke Login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 py-20 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-6 mb-6">
            <img src={cheryLogo} alt="Chery Logo" className="h-16 object-contain" />
            <img src={orientalLogo} alt="Oriental Logo" className="h-16 object-contain rounded-lg" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900">DAFTAR PELANGGAN</h2>
          <p className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]">Chery Oriental Medan</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Nomor WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type="tel"
                required
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold text-zinc-900"
                placeholder="0812xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 pr-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold text-zinc-900"
                placeholder="Buat Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[9px] text-zinc-400 ml-2 italic">* Minimal 6 karakter</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} /> {errorMessage}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : (
              <>
                Daftar Sekarang <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => (clearRegistrationState(), setCurrentPage('login'))}
            className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600 transition-colors"
          >
            Sudah punya akun? Login di sini
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
