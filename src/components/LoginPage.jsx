import React from 'react';
import { User, Lock, AlertCircle } from 'lucide-react';
import cheryLogo from '../assets/chery.png';

const LoginPage = ({ loginForm, setLoginForm, handleLogin, errorMessage, setCurrentPage }) => (
  <div className="min-screen flex items-center justify-center bg-[#F2F2F7] p-6 py-20 animate-fade-in">
    <div className="w-full max-w-md bg-white rounded-[2rem] p-10 shadow-2xl shadow-zinc-200 border border-zinc-100">
      <div className="text-center mb-10">
        <img src={cheryLogo} alt="Chery Logo" className="h-28 mx-auto mb-6 object-contain" />
        <h2 className="text-2xl font-black tracking-tighter text-zinc-900">ADMIN LOGIN</h2>
        <p className="text-zinc-400 text-sm font-medium mt-1 uppercase tracking-widest">Akses Panel Kontrol</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Username</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
            <input 
              type="text" 
              className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
            <input 
              type="password" 
              className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 focus:border-red-600 outline-none transition-all font-bold"
              placeholder="••••••••"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
            />
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center gap-2 animate-shake">
            <AlertCircle size={16} /> {errorMessage}
          </div>
        )}

        <button type="submit" className="w-full bg-zinc-900 hover:bg-black text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95">
          Login ke Sistem
        </button>
        
        <button 
          type="button" 
          onClick={() => setCurrentPage('display')}
          className="w-full text-zinc-400 text-xs font-bold hover:text-zinc-600"
        >
          Kembali ke Tampilan Board
        </button>
      </form>
    </div>
  </div>
);

export default LoginPage;