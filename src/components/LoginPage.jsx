import React, { useState } from 'react';
import { User, Lock, AlertCircle, Eye, EyeOff, Truck } from 'lucide-react';
import cheryLogo from '../assets/cherylogo.png';

const LoginPage = ({ loginForm, setLoginForm, handleLogin, errorMessage, setCurrentPage }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-6 py-20 animate-fade-in transition-colors duration-500">
      <div className="w-full max-w-md bg-white rounded-[2rem] p-10 shadow-2xl shadow-zinc-200 border border-zinc-100 transition-colors duration-500">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-6 mb-6">
            <img src={cheryLogo} alt="Chery Logo" className="h-20 object-contain" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-black">LOGIN</h2>
          <p className="text-zinc-400 text-sm font-medium mt-1 uppercase tracking-widest">Akses Panel Kontrol</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type="text"
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all font-bold text-black"
                placeholder="Username"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 pr-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-zinc-100 focus:border-black outline-none transition-all font-bold text-black"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>



          {errorMessage && (
            <div className="bg-zinc-50 text-black text-xs p-3 rounded-xl border border-zinc-300 flex items-center gap-2 animate-shake">
              <AlertCircle size={16} /> {errorMessage}
            </div>
          )}

          <button type="submit" className="w-full bg-black hover:bg-zinc-800 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all duration-150 active:scale-95">
            Login
          </button>

          <div className="pt-6 border-t border-zinc-100 flex flex-col gap-3">
            
            <button
              type="button"
              onClick={() => setCurrentPage('register')}
              className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600 transition-colors uppercase tracking-widest mt-2"
            >
              Belum punya akun? Daftar Gratis
            </button>
          </div>        </form>
      </div>
    </div>
  );
};

export default LoginPage;