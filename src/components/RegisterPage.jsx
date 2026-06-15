import React, { useState, useRef, useEffect } from 'react';
import { Phone, ArrowRight, AlertCircle, Eye, EyeOff, Lock, MessageCircle, ShieldCheck, Send } from 'lucide-react';
import { db } from '../utils/dbClient';
import { WA_BASE_URL, WA_INSTANCE, sendText } from '../utils/waClient';
import cheryLogo from '../assets/cherylogo.png';
import orientalLogo from '../assets/oriental.jpeg';

const WA_BOT_NUMBER = import.meta.env.VITE_WA_BOT_NUMBER || '628888512596';

const RegisterPage = ({ setCurrentPage, setErrorMessage, errorMessage }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const otpRefs = useRef([]);
  const socketRef = useRef(null);

  const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    if (digits.startsWith('62')) return digits;
    return '62' + digits;
  };

  const activateAccount = async () => {
    try {
      await db.update('customers', { status: 'active', otp: null }, { eq: { no_hp: phone } });

      // Notif ke owner: akun aktif
      await db.insert('notifications', {
        type: 'registration_active',
        message: `Akun pelanggan aktif: ${phone}`,
        target_role: 'owner',
        read: false
      }).catch(() => {});

      // Balas WA konfirmasi ke customer
      const nama = phone;
      sendText(formatPhone(phone),
        `🎉 *Akun Anda sudah aktif!*\n\nTerima kasih sudah mendaftar di Chery Oriental Medan.\n\nSekarang kamu bisa login dan mulai menggunakan fitur-fitur kami.\n\n🔗 https://cherymedan.web.id`
      ).catch(() => {});

      setOtpVerified(true);
    } catch (err) {
      console.error(err);
    }
  };

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

    timer = setInterval(checkStatus, 3000);
    checkStatus();

    return () => {
      destroyed = true;
      clearInterval(timer);
    };
  }, [step, otpVerified, phone]);

  useEffect(() => {
    if (step !== 'otp' || otpVerified) return;

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
  }, [step, otpVerified, phone, otpCode]);

  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otpInput];
    newOtp[idx] = val;
    setOtpInput(newOtp);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpInput[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      alert("Nomor telepon tidak valid!");
      return;
    }
    if (!password || password.length < 6) {
      alert("Password minimal 6 karakter!");
      return;
    }

    setIsLoading(true);
    try {
      const { data: existingUsers, error: checkErr } = await db.select('customers', {
        select: 'no_hp', eq: { no_hp: phone }, limit: 2
      });

      if (checkErr) throw checkErr;

      if (existingUsers && existingUsers.length > 0) {
        alert("Nomor ini sudah terdaftar. Silakan login.");
        setCurrentPage('login');
        return;
      }

      const otp = generateOtp();

      const { error: insertErr } = await db.insert('customers', {
        no_hp: phone,
        password: password,
        nama: phone,
        status: 'pending',
        otp: otp
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          alert("Nomor ini sudah terdaftar. Silakan login.");
          setCurrentPage('login');
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
      setStep('otp');
    } catch (err) {
      console.error(err);
      alert("Gagal melakukan registrasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyManual = async () => {
    const code = otpInput.join('');
    if (code.length < 6) {
      setOtpError('Masukkan 6 digit kode OTP');
      return;
    }

    setIsLoading(true);
    setOtpError('');

    try {
      const { data: user } = await db.select('customers', {
        select: 'otp,status',
        eq: { no_hp: phone },
        maybeSingle: true,
      });

      if (!user) {
        setOtpError('Akun tidak ditemukan. Silakan daftar ulang.');
        return;
      }

      if (user.status === 'active') {
        setOtpVerified(true);
        return;
      }

      if (user.otp !== code) {
        setOtpError('Kode OTP salah. Coba lagi.');
        return;
      }

      await activateAccount();
    } catch (err) {
      console.error(err);
      setOtpError('Gagal verifikasi. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
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
            onClick={() => setCurrentPage('login')}
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle size={40} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 mb-2">AKTIVASI AKUN</h2>
          <p className="text-zinc-400 text-xs font-bold mb-6 uppercase tracking-[0.2em]">Chery Oriental Medan</p>

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 mb-6 text-left">
            <p className="text-xs text-zinc-500 font-bold mb-1">Langkah aktivasi:</p>
            <ol className="text-xs text-zinc-700 space-y-2 font-medium">
              <li>1. Buka WhatsApp kamu</li>
              <li>2. Kirim pesan ke nomor <strong className="text-blue-600">{WA_BOT_NUMBER}</strong></li>
              <li>3. Ketik kode: <strong className="text-lg tracking-widest text-blue-600">{otpCode}</strong></li>
            </ol>
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
              const waUrl = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(otpCode)}`;
              window.open(waUrl, '_blank');
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 mb-6"
          >
            <Send size={18} /> Kirim OTP via WhatsApp
          </button>

          <details className="text-left">
            <summary className="text-[10px] text-zinc-400 font-bold cursor-pointer hover:text-zinc-600">
              Atau masukkan kode secara manual
            </summary>

            <div className="mt-4 space-y-4">
              <div className="flex justify-center gap-3">
                {otpInput.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-2xl font-black bg-zinc-50 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                ))}
              </div>

              {otpError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center justify-center gap-2">
                  <AlertCircle size={16} /> {otpError}
                </div>
              )}

              <button
                onClick={handleVerifyManual}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoading ? 'Memverifikasi...' : (
                  <>Verifikasi <ShieldCheck size={18} /></>
                )}
              </button>
            </div>
          </details>
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
            onClick={() => setCurrentPage('login')}
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
