import React, { useState, useEffect, useMemo, useRef } from 'react';
import ClockDisplay from './ClockDisplay';
import { Bookmark, Zap, Car, Instagram, CheckCircle, Clock, Moon, FileText, X, Activity, CalendarDays, ArrowRight, ChevronLeft, ChevronRight, Megaphone, Droplets, Wrench } from 'lucide-react';
import cheryLogo from '../assets/cherylogo.png';
import { QRCodeSVG } from 'qrcode.react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import { speak } from '../utils/tts';

const DISPLAY_COUNT = 1;
const COMPLETED_DISPLAY_COUNT = 1;
const SLIDE_INTERVAL = 5000;



const isSameDate = (dateA, dateB) => {
   const normalize = (d) => {
      if (!d) return "";
      if (d instanceof Date) {
         const y = d.getFullYear();
         const m = String(d.getMonth() + 1).padStart(2, '0');
         const day = String(d.getDate()).padStart(2, '0');
         return `${y}-${m}-${day}`;
      };
      const str = String(d);
      if (str.includes("/")) {
         const parts = str.split(/[ /,-]/);
         if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
         }
      }
      return str.split(/[T ]/)[0];
   };
   return normalize(dateA) === normalize(dateB);
};

const QueueCard = ({ item, formatTime, setSelectedUnit, user, onStartWork, onComplete }) => {
   const ms = parseInt(item.id);
   const arrivalDate = (!isNaN(ms))
      ? (ms < 10000000000 ? new Date(ms * 1000) : new Date(ms))
      : null;

   const timeIn = arrivalDate
      ? arrivalDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '--:--';
   const dateIn = arrivalDate
      ? arrivalDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
      : '--';

   let timeOut = '--:--';
   const targetTime = parseInt(item.target_time || item.targetTime);

   if (targetTime && targetTime > 0) {
      timeOut = new Date(targetTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
   } else if (arrivalDate) {
      const durasiDetik = parseInt(item.estimasiDefault) || 0;
      const predictedFinish = new Date(arrivalDate.getTime() + (durasiDetik * 1000));
      timeOut = predictedFinish.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
   }

   const isWorking = item.status === 'working';
   const isWashing = item.status === 'sedang_dicuci';
   const isWorkingOrWashing = isWorking || isWashing;
   const isMenginap = item.status === 'menginap';
   const isWaiting = item.status === 'waiting';
   const isIstirahatExpired = item.status === 'istirahat' && (!parseInt(item.estimasiDefault) || parseInt(item.estimasiDefault) <= 0);

   const isScheduled = !item.status || ['accepted', 'waiting confirm', 'synced', 'waiting_approval'].includes(item.status);

   return (
      <div className={`bg-white rounded-2xl border-4 shadow-lg overflow-hidden flex flex-col group/card hover:border-zinc-300 transition-all flex-1 min-h-0 ${isScheduled ? 'border-dashed border-zinc-300 opacity-80' : 'border-zinc-100'}`}>
         <div
            className="h-1.5 md:h-2 w-full shrink-0"
            style={{ backgroundColor: isScheduled ? '#d4d4d8' : isWorking ? '#3b82f6' : isWashing ? '#0891b2' : isMenginap ? '#a855f7' : '#ef4444' }}
         />

         <div className="px-2 py-1.5 md:px-4 md:py-3 flex flex-col gap-0.5 md:gap-1.5 flex-1 min-h-0 justify-between">
            <div className="flex items-center justify-between shrink-0">
               <div className="flex items-center gap-0.5 md:gap-1.5 flex-wrap">
                  <span
                     className="px-1 py-0.5 md:px-2.5 md:py-0.5 rounded-lg md:rounded-xl text-[8px] md:text-xs font-black uppercase tracking-wider flex items-center gap-0.5 md:gap-1 text-white shadow-sm"
                     style={{ backgroundColor: (String(item.category || '').toLowerCase() === 'booking' || String(item.category || '').toLowerCase() === 'booking (late)') ? '#dc2626' : '#4b5563' }}
                  >
                     {(String(item.category || '').toLowerCase() === 'booking' || String(item.category || '').toLowerCase() === 'booking (late)') ? <Bookmark size={8} fill="white" className="md:hidden" /> : <Zap size={8} fill="white" className="md:hidden" />}
                     {(String(item.category || '').toLowerCase() === 'booking' || String(item.category || '').toLowerCase() === 'booking (late)') ? <Bookmark size={12} fill="white" className="hidden md:block" /> : <Zap size={12} fill="white" className="hidden md:block" />}
                     {item.category}
                  </span>
                  <span
                     className="px-1 py-0.5 md:px-2.5 md:py-0.5 rounded-lg md:rounded-xl text-[8px] md:text-xs font-black uppercase tracking-wider text-white shadow-sm"
                     style={{ backgroundColor: isScheduled ? '#dc2626' : isWorking ? '#2563eb' : isWashing ? '#0891b2' : isMenginap ? '#9333ea' : '#ef4444' }}
                  >
                     {isScheduled ? `○ BOOKING ${item.jam} WIB` : isWorking ? '● PROSES' : isWashing ? '● DICUCI' : isMenginap ? '● MENGINAP' : '● ANTRIAN'}
                  </span>
                  {item.isCalled && !isScheduled && (
                     <span className="px-1 py-0.5 md:px-2.5 md:py-0.5 rounded-lg md:rounded-xl text-[8px] md:text-xs font-black uppercase tracking-wider text-white shadow-sm bg-emerald-500 flex items-center gap-0.5 md:gap-1">
                        <Megaphone size={8} fill="white" className="md:hidden" /> <Megaphone size={12} fill="white" className="hidden md:block" /> C-{item.counter || '?'}
                     </span>
                  )}
               </div>
               {!isScheduled && (
                  <button onClick={() => setSelectedUnit(item)} className="p-0.5 md:p-1 text-black hover:text-zinc-600 transition-colors">
                     <FileText size={14} className="md:hidden" />
                     <FileText size={20} className="hidden md:block" />
                  </button>
               )}
            </div>

            <div className="py-0.5 flex-1 flex flex-col justify-center min-h-0">
               <h3 className="text-xl md:text-3xl lg:text-4xl font-black tracking-tight text-black font-mono uppercase leading-tight my-0.5 truncate">{item.bk}</h3>
               <p className="text-xs md:text-sm font-black text-zinc-600 uppercase tracking-widest leading-none truncate">{item.tipe || '—'}</p>
            </div>

            <div className="grid grid-cols-3 gap-0.5 md:gap-2 pt-1 md:pt-1.5 border-t border-zinc-100 font-mono shrink-0">
               {isMenginap ? (
                  <div className="col-span-3">
                     <p className="text-[9px] md:text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1 md:gap-1.5 mb-0.5">
                        <Moon size={10} className="md:hidden text-purple-500" /> <Moon size={12} className="hidden md:block text-purple-500" /> Alasan
                     </p>
                     <p className="text-[10px] md:text-base font-black text-purple-700 leading-none truncate uppercase">
                        {item.menginap_reason || '—'}
                     </p>
                  </div>
               ) : (
                  <>
                     <div>
                        <p className="text-[8px] md:text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-0.5 md:gap-1 mb-0">
                           <Clock size={8} className={`md:hidden ${isScheduled ? 'text-zinc-400' : 'text-blue-500'}`} /> <Clock size={12} className={`hidden md:block ${isScheduled ? 'text-zinc-400' : 'text-blue-500'}`} /> {isScheduled ? 'Jadwal' : 'Datang'}
                        </p>
                        <p className="text-sm md:text-xl font-black text-zinc-900 tabular-nums leading-none">{isScheduled ? item.jam : timeIn}</p>
                        {!isScheduled && <p className="text-[9px] md:text-xs font-bold text-zinc-400 mt-0.5 leading-none">{dateIn}</p>}
                     </div>

                     <div className="col-span-2">
                        <p className="text-[8px] md:text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-0.5 md:gap-1 mb-0">
                           <Activity size={8} className={`md:hidden ${isWorkingOrWashing ? 'text-orange-500' : 'text-zinc-300'}`} /> <Activity size={12} className={`hidden md:block ${isWorkingOrWashing ? 'text-orange-500' : 'text-zinc-300'}`} /> {isScheduled ? 'Keperluan' : 'Estimasi'}
                        </p>
                        <p className={`text-sm md:text-xl font-black tabular-nums leading-none truncate ${isWorkingOrWashing ? (item.estimasi < 300 ? 'text-red-600 animate-pulse' : 'text-orange-600') : 'text-zinc-500'}`}>
                           {isScheduled ? (item.keluhan || '-')?.split('\n').map((l, i, a) => <span key={i}>{l}{i < a.length - 1 ? <br /> : ''}</span>) : isWorkingOrWashing ? formatTime(item.estimasi) : isIstirahatExpired ? 'Menunggu Confirm' : formatTime(parseInt(item.estimasiDefault) || 0)}
                        </p>
                     </div>
                  </>
               )}
            </div>

            <div className="flex items-center gap-0.5 md:gap-3 pt-1 md:pt-1.5 border-t border-zinc-200 shrink-0">
               <div className="flex items-center gap-0.5 md:gap-1.5 min-w-0 flex-1">
                  <div
                     className="w-4 h-4 md:w-6 md:h-6 rounded-lg md:rounded-xl flex items-center justify-center text-white text-[7px] md:text-xs font-black shrink-0 shadow-sm"
                     style={{ backgroundColor: (isScheduled && item.category !== 'Reguler (Late)') ? '#dc2626' : '#1e40af' }}
                  >
                     {(isScheduled && item.category !== 'Reguler (Late)') ? 'CS' : 'SA'}
                  </div>
                  <span className="text-[9px] md:text-xs font-black text-zinc-900 uppercase truncate">
                     {isScheduled ? (item.nama_sa || item.addedBy || 'BOOKING ONLINE') : (item.nama_sa || item.addedBy || '—')}
                  </span>
               </div>
               {!isScheduled && (
                  <>
                     <div className="w-0.5 h-3 md:h-4 bg-zinc-200 shrink-0" />
                     <div className="flex items-center gap-0.5 md:gap-1.5 min-w-0 flex-1">
                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-lg md:rounded-xl bg-[#2563eb] flex items-center justify-center text-white text-[7px] md:text-xs font-black shrink-0 shadow-sm">MK</div>
                        <span className="text-[9px] md:text-xs font-black text-[#2563eb] uppercase truncate">{item.mechanicName || '—'}</span>
                     </div>
                  </>
               )}
            </div>

            {!isScheduled && (() => {
               const bannerMap = {
                  'waiting': { bg: '#d97706', label: 'MENUNGGU ANTRIAN PEKERJAAN', sub: item.cuci_required ? '+ Cuci Mobil' : '' },
                  'working': { bg: '#2563eb', label: `SEDANG DIKERJAKAN`, sub: item.mechanicName || '' },
                  'menunggu_cuci': { bg: '#0d9488', label: 'MENUNGGU ANTRIAN CUCI', sub: item.washQueueNum ? `Antrean Ke-${item.washQueueNum}` : 'Antrean Cuci' },
                  'sedang_dicuci': { bg: '#0891b2', label: 'SEDANG DICUCI', sub: formatTime(item.estimasi) },
                  'request_extension': { bg: '#d97706', label: 'MENUNGGU APPROVAL TAMBAH WAKTU', sub: '' },
                  'menunggu_konfirmasi': { bg: '#f59e0b', label: 'MENUNGGU KONFIRMASI ADMIN', sub: '' },
                  'menunggu_sa': { bg: '#6b7280', label: 'MENUNGGU SA', sub: '' },
                  'menunggu_foreman': { bg: '#7c3aed', label: 'MENUNGGU FOREMAN', sub: '' },
                  'istirahat': { bg: '#eab308', label: 'ISTIRAHAT', sub: '' },
               };
               const cfg = bannerMap[item.status];
               if (!cfg) return null;
               return (
                  <div className="mt-0.5 md:mt-1 px-1.5 py-1 md:px-3 md:py-1.5 rounded-xl border md:border-2 border-white/30 shadow-md shrink-0"
                     style={{ backgroundColor: cfg.bg }}>
                     <div className="flex items-center gap-1 md:gap-1.5 mb-0.5 text-white/80">
                        {item.status === 'menunggu_cuci' || item.status === 'sedang_dicuci' ? (
                           <>
                              <Droplets size={10} className="md:hidden" fill="currentColor" />
                              <Droplets size={14} className="hidden md:block" fill="currentColor" />
                           </>
                        ) : item.status === 'working' ? (
                           <>
                              <Wrench size={10} className="md:hidden" />
                              <Wrench size={14} className="hidden md:block" />
                           </>
                        ) : (
                           <>
                              <Clock size={10} className="md:hidden" />
                              <Clock size={14} className="hidden md:block" />
                           </>
                        )}
                        <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.15em]">{cfg.label}</span>
                     </div>
                     {cfg.sub && (
                        <p className="text-[10px] md:text-sm font-black text-white leading-tight uppercase font-mono truncate">{cfg.sub}</p>
                     )}
                  </div>
               );
            })()}

            {isMenginap && item.menginap_reason && (
               <div className="mt-1 md:mt-1.5 px-3 md:px-4 py-2 bg-[#9333ea] rounded-xl border-2 border-white/30 shadow-md shrink-0">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1 text-white/70">
                     <Moon size={14} fill="currentColor" />
                     <span className="text-xs md:text-sm font-black uppercase tracking-[0.15em]">Keterangan Menginap</span>
                  </div>
                  <p className="text-xs md:text-base font-black text-white leading-tight uppercase font-mono italic truncate">
                     "{item.menginap_reason}"
                  </p>
               </div>
            )}

            {user?.role?.toLowerCase() === 'mekanik' && (
               <div className="pt-2 md:pt-3 border-t-2 border-zinc-100">
                  {item.status === 'waiting' && (!item.mechanicName || item.mechanicName.split(',').includes(user.name)) && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onStartWork(item); }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-4 rounded-xl text-base md:text-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 min-h-[48px] md:min-h-[60px]"
                     >
                        <Zap size={20} fill="white" /> <span className="hidden sm:inline">Mulai </span>Pekerjaan
                     </button>
                  )}
                  {item.status === 'menginap' && (!item.mechanicName || item.mechanicName.split(',').includes(user.name)) && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onStartWork(item); }}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 md:py-4 rounded-xl text-base md:text-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 min-h-[48px] md:min-h-[60px]"
                     >
                        <Zap size={20} fill="white" /> <span className="hidden sm:inline">Lanjutkan </span>Pekerjaan
                     </button>
                  )}
                  {isWorking && item.mechanicName && item.mechanicName.split(',').includes(user.name) && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onComplete(item); }}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 md:py-4 rounded-xl text-base md:text-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 min-h-[48px] md:min-h-[60px]"
                     >
                        <CheckCircle size={20} /> Selesai
                     </button>
                  )}
               </div>
            )}
         </div>
      </div>
   );
};

const CarouselCol = ({ title, data, colorClass, icon: Icon, formatTime, setSelectedUnit, user, onStartWork, onComplete, subtitle, displayCount = DISPLAY_COUNT }) => {
   const [idx, setIdx] = useState(0);
   const timerRef = useRef(null);
   const totalStops = Math.ceil(data.length / displayCount) || 1;
   const hasMultiple = data.length > displayCount;

   useEffect(() => { setIdx(i => Math.min(i, totalStops - 1)); }, [totalStops]);
   const startTimer = () => {
      clearInterval(timerRef.current);
      if (!hasMultiple) return;
      timerRef.current = setInterval(() => { setIdx(i => (i + 1) % totalStops); }, SLIDE_INTERVAL);
   };
   useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [totalStops]);
   const goToIdx = (i) => { setIdx(i); startTimer(); };
   const visibleItems = data.slice(idx * displayCount, (idx + 1) * displayCount);
   while (visibleItems.length < displayCount) visibleItems.push(null);

   return (
      <div className="flex flex-col bg-white rounded-2xl md:rounded-3xl p-2 md:p-5 border-2 border-dashed border-zinc-200 shadow-sm transition-all hover:shadow-xl overflow-hidden h-full">
         <div className="flex items-center justify-between mb-1.5 md:mb-4 shrink-0 gap-2 px-1">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
               <div className={`w-7 h-7 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl ${colorClass} shrink-0`}>
                  <Icon size={14} fill="currentColor" className="md:hidden" />
                  <Icon size={24} fill="currentColor" className="hidden md:block" />
               </div>
               <div className="min-w-0">
                  <h3 className="text-sm md:text-4xl font-black text-zinc-900 uppercase tracking-tighter leading-tight truncate">{title}</h3>
                  {subtitle ? subtitle : (
                     <p className="text-[9px] md:text-xl font-black text-zinc-400 uppercase tracking-widest mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2 whitespace-nowrap overflow-hidden">
                        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${data.length > 0 ? (colorClass === 'bg-red-600' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse') : 'bg-zinc-300'}`} />
                        {data.length} unit
                     </p>
                  )}
               </div>
            </div>
            {hasMultiple && (
               <div className="flex items-center gap-1 bg-zinc-50 p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-zinc-200 shadow-sm shrink-0">
                  <button onClick={() => { const newIdx = (idx - 1 + totalStops) % totalStops; goToIdx(newIdx); }} className="p-1 hover:bg-zinc-100 rounded-lg md:rounded-xl transition-all text-zinc-400 hover:text-zinc-900 active:scale-95"><ChevronLeft size={12} strokeWidth={4} className="md:hidden" /><ChevronLeft size={16} strokeWidth={4} className="hidden md:block" /></button>
                  <div className="flex flex-col items-center px-1 md:px-2">
                     <span className="text-[9px] md:text-sm font-black text-zinc-400/80 uppercase tracking-widest leading-none">{idx + 1}/{totalStops}</span>
                  </div>
                  <button onClick={() => { const newIdx = (idx + 1) % totalStops; goToIdx(newIdx); }} className="p-1 hover:bg-zinc-100 rounded-lg md:rounded-xl transition-all text-zinc-400 hover:text-zinc-900 active:scale-95"><ChevronRight size={12} strokeWidth={4} className="md:hidden" /><ChevronRight size={16} strokeWidth={4} className="hidden md:block" /></button>
               </div>
            )}
         </div>
         <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain" key={idx}>
            {visibleItems.map((item, i) => item ? (<QueueCard key={item.id} item={item} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} />) : (
               <div key={`empty-${i}`} className="flex-1 rounded-2xl border-4 border-dashed border-zinc-100 opacity-30 flex items-center justify-center">
                  <p className="text-xl font-bold text-zinc-300 uppercase tracking-[0.2em]">Belum ada antrian</p>
               </div>
            ))}
         </div>
      </div>
   );
};

const CompletedCarousel = ({ data, formatTime, setSelectedUnit }) => {
   const [idx, setIdx] = useState(0);
   const [displayCount, setDisplayCount] = useState(1);
   const timerRef = useRef(null);

   const getCompletedTime = (item) => {
      try {
         const val = item.waktuSelesai || item.waktu_selesai;
         if (val) {
            if (typeof val === 'string' && (val.includes('T') || val.includes('-') || val.includes(':')) && isNaN(Number(val))) {
               const date = new Date(val);
               return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            const n = parseInt(val);
            if (!isNaN(n) && n > 0) {
               const date = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
               return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
         }
         const fallback = item.targetTime || item.target_time || item.id;
         if (fallback) {
            const n = parseInt(fallback);
            if (!isNaN(n) && n > 0) {
               const date = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
               return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
         }
         return '--:--';
      } catch {
         return '--:--';
      }
   };

   const totalStops = Math.ceil(data.length / displayCount) || 1;
   const hasMultiple = data.length > displayCount;
   useEffect(() => { setIdx(i => Math.min(i, totalStops - 1)); }, [totalStops]);
   const startTimer = () => {
      clearInterval(timerRef.current);
      if (!hasMultiple) return;
      timerRef.current = setInterval(() => { setIdx(i => (i + 1) % totalStops); }, SLIDE_INTERVAL);
   };
   useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [totalStops]);
   const visibleItems = data.slice(idx * displayCount, (idx + 1) * displayCount);
   while (visibleItems.length < displayCount) visibleItems.push(null);

   return (
      <div className="w-full rounded-2xl md:rounded-3xl p-2 md:p-3.5 shadow-2xl relative overflow-hidden group border-4 border-emerald-500/50 flex flex-col justify-center" style={{ backgroundColor: '#059669' }}>
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
         <div className="flex items-center justify-between mb-1 md:mb-2 relative z-10 gap-2">
            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
               <div className="w-6 h-6 md:w-8 md:h-8 bg-white rounded-lg md:rounded-xl flex items-center justify-center text-emerald-600 shadow-xl shrink-0"><CheckCircle size={12} className="md:hidden" /><CheckCircle size={16} className="hidden md:block" /></div>
               <div className="bg-white/10 px-2 md:px-3 py-1 rounded-lg md:rounded-xl backdrop-blur-md border border-white/10 shrink-0">
                  <span className="text-xs md:text-base font-black text-white uppercase tracking-wider md:tracking-widest leading-none">
                     {data.length} <span className="text-emerald-200">SELESAI</span>
                  </span>
               </div>
            </div>
            {hasMultiple && (
               <div className="flex items-center gap-1 bg-white/10 p-1 md:p-1 rounded-xl md:rounded-2xl backdrop-blur-md border border-white/10 shadow-xl shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + totalStops) % totalStops); startTimer(); }} className="p-1 hover:bg-white/20 rounded-lg md:rounded-xl transition-all text-white active:scale-95"><ChevronLeft size={14} strokeWidth={4} className="md:hidden" /><ChevronLeft size={18} strokeWidth={4} className="hidden md:block" /></button>
                  <div className="flex flex-col items-center px-1 md:px-2">
                     <span className="text-xs md:text-sm font-black text-white/80 uppercase tracking-widest leading-none mb-0.5">{idx + 1}/{totalStops}</span>
                     <div className="hidden sm:flex gap-1.5 mt-0.5">
                        {Array.from({ length: Math.min(totalStops, 6) }).map((_, i) => (<button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); startTimer(); }} className={`h-1.5 rounded-full transition-all duration-500 ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/30'}`} />))}
                     </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % totalStops); startTimer(); }} className="p-1 hover:bg-white/20 rounded-lg md:rounded-xl transition-all text-white active:scale-95"><ChevronRight size={14} strokeWidth={4} className="md:hidden" /><ChevronRight size={18} strokeWidth={4} className="hidden md:block" /></button>
               </div>
            )}
         </div>
         <div className="flex-1 flex items-stretch relative z-10" key={idx}>
            {visibleItems.map((item, i) => item ? (
               <div key={item.id} onClick={() => setSelectedUnit(item)} className="flex-1 bg-white rounded-xl md:rounded-2xl p-2 md:p-3 shadow-xl border-2 md:border-4 border-white/50 group/card cursor-pointer hover:bg-white hover:scale-[1.01] transition-all flex flex-col items-center justify-center">
                  <h2 className="text-xl md:text-3xl lg:text-4xl font-black text-black font-mono tracking-tighter mb-0.5 uppercase truncate w-full text-center leading-none">{item.bk || item.noPlat || item.no_plat || '-'}</h2>
                  <p className="text-[10px] md:text-sm font-black text-black/40 uppercase tracking-[0.3em] truncate w-full text-center mt-0.5 leading-none border-t border-zinc-100 pt-1">{item.tipe}</p>
                  <div className="flex items-center gap-1.5 md:gap-2 mt-1 bg-emerald-500/10 px-2 md:px-3 py-0.5 rounded-full border border-emerald-500/20">
                     <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[9px] md:text-xs font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap leading-none">
                        Selesai {getCompletedTime(item)}
                     </span>
                  </div>
               </div>
            ) : (
               <div key={`empty-${i}`} className="flex-1 bg-white/5 rounded-2xl border-4 border-dashed border-white/20 min-h-[60px] md:min-h-[80px] flex items-center justify-center">
                  <p className="text-xl md:text-2xl font-bold text-white/10 uppercase tracking-[0.2em] whitespace-nowrap">Belum ada data</p>
               </div>
            ))}
         </div>
      </div>
   );
};

const DisplayBoard = ({ processedQueue, formatTime, user, onStartWork, onComplete, onToggleTask, onLogoDoubleClick, rawHistory = [], bookings = [] }) => {
   const [selectedUnit, setSelectedUnit] = useState(null);
   const [audioUnlocked, setAudioUnlocked] = useState(() => {
      // For display role (TV kiosk), auto-unlock immediately
      return localStorage.getItem('display_audio_unlocked') === 'true';
   });
   const [lastNotifiedId, setLastNotifiedId] = useState(null);
   const [notificationToast, setNotificationToast] = useState(null);

   // Back button closes modal instead of navigating away
   useEffect(() => {
      if (!selectedUnit) return;
      window.__modalOpen = true;
      window.history.pushState({ modal: true }, '');
      const onBack = () => { setSelectedUnit(null); };
      window.addEventListener('popstate', onBack);
      return () => {
         window.__modalOpen = false;
         window.removeEventListener('popstate', onBack);
      };
   }, [selectedUnit]);

   // Monitor rawHistory to show visual notification on the board itself
   useEffect(() => {
      if (rawHistory.length === 0) return;
      const latest = rawHistory[0];
      // Only notify for items completed in the last 10 seconds to avoid old data toast
      const isNew = (Date.now() - (parseInt(latest.targetTime || latest.target_time) || 0)) < 10000;

      if (latest && latest.id !== lastNotifiedId && isNew) {
         setLastNotifiedId(latest.id);
         setNotificationToast(latest);
         const timer = setTimeout(() => setNotificationToast(null), 8000);
         return () => clearTimeout(timer);
      }
   }, [rawHistory, lastNotifiedId]);

   const audioCtxRef = useRef(null);
   const pendingAnnouncementRef = useRef(null);

   // Auto-unlock AudioContext for display role (TV kiosk - no user tap available)
   useEffect(() => {
      if (user?.role?.toLowerCase() === 'display' && !audioCtxRef.current) {
         try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume();
            audioCtxRef.current = ctx;
            setAudioUnlocked(true);
         } catch (e) {
            console.warn('Auto audio unlock for display role failed:', e);
         }
      }
   }, [user]);

   const playPendingAnnouncement = () => {
      const pending = pendingAnnouncementRef.current;
      if (pending) {
         pendingAnnouncementRef.current = null;
         speakAnnouncement(pending);
      }
   };

   const handleAudioUnlock = () => {
      try {
         const ctx = new (window.AudioContext || window.webkitAudioContext)();
         ctx.resume();
         audioCtxRef.current = ctx;
         // Pre-warm speechSynthesis on some Samsung TV models that may support it
         try { if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); } catch { }
         setAudioUnlocked(true);
         localStorage.setItem('display_audio_unlocked', 'true');
         playPendingAnnouncement();
      } catch (e) {
         console.warn('Audio unlock failed:', e);
         setAudioUnlocked(true);
      }
   };

   const speakAnnouncement = async (text) => {
      // 1. Google Translate TTS via proxy (most reliable on TV browsers)
      try {
         const url = `/api/tts?text=${encodeURIComponent(text)}`;
         const audio = new Audio(url);
         audio.volume = 1;
         await audio.play();
         return;
      } catch (e) {
         console.warn('Google TTS play failed:', e);
      }
      // 2. SpeechSynthesis with Indonesian voice (works on HP/laptop)
      const spoken = speak(text);
      if (spoken) return;
      // 3. Fallback: beep via AudioContext (requires user tap to unlock)
      if (!audioCtxRef.current) {
         pendingAnnouncementRef.current = text;
         return;
      }
      try {
         const ctx = audioCtxRef.current;
         const now = ctx.currentTime;
         for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.3, now + i * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.5 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.5);
            osc.stop(now + i * 0.5 + 0.4);
         }
      } catch (e) {
         console.warn('Beep fallback also failed:', e);
      }
   };

   // ── Queue Call Announcement ──
   const [callAnnouncement, setCallAnnouncement] = useState(null);
   const announcedIdsRef = useRef(new Set());

   useEffect(() => {
      let channel;
      let sb;
      const initSub = async () => {
         const { supabase } = await import('../utils/supabaseClient');
         sb = supabase;
         channel = supabase
            .channel('display-calls')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'antrian', filter: 'is_called=eq.true' }, (payload) => {
               const item = payload.new;
               if (item && item.is_called) {
                  const callKey = item.id + '-' + (item.called_at || '');
                  if (announcedIdsRef.current.has(callKey)) return;
                  announcedIdsRef.current.add(callKey);
                  const queueNum = item.queue_number || 0;
                  const counter = item.counter || 0;
                  const plat = item.noPlat || item.no_plat || item.noplat || item.bk || '';
                  const category = item.category || 'Reguler';
                  setCallAnnouncement({ queueNumber: queueNum, counter, bk: plat, id: item.id, category });
                  const isFinished = item.status === 'menunggu_konfirmasi' || item.status === 'completed';
                  const text = isFinished
                     ? `${plat} telah selesai, silahkan menuju counter ${counter}`
                     : queueNum > 0
                        ? `Antrian ${category === 'Booking' ? 'Booking' : 'Reguler'} nomor ${queueNum}, silahkan menuju counter ${counter}`
                        : `Antrian, silahkan menuju counter ${counter}`;

                  if (user?.role?.toLowerCase() === 'display') speakAnnouncement(text);

                  setTimeout(() => setCallAnnouncement(null), 10000);
               }
            })
            .subscribe();
      };
      initSub();
      return () => { if (channel && sb) sb.removeChannel(channel); };
   }, []);

   const [displayConfig, setDisplayConfig] = useState({ slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1 });
   useEffect(() => {
      fetchBookingConfig().then(setDisplayConfig).catch(() => { });
   }, []);
   const { slotCount: maxCount, gapMinutes, startHour, startMinute, slotCapacity: slotCapacityDisplay } = displayConfig;
   const dynamicJamPilihan = generateSlots(maxCount, gapMinutes, startHour, startMinute);

   const sortQueue = (arr) => [...arr].sort((a, b) => {
      const aScore = a.status === 'working' ? 0 : a.status === 'istirahat' ? 1 : 2;
      const bScore = b.status === 'working' ? 0 : b.status === 'istirahat' ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
   });

   const categories = useMemo(() => {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const washQueue = processedQueue
         .filter(i => i.status === 'menunggu_cuci')
         .sort((a, b) => parseInt(a.id) - parseInt(b.id));

      const queueToUse = processedQueue.map(i => {
         if (i.status === 'menunggu_cuci') {
            const idx = washQueue.findIndex(w => w.id === i.id);
            return { ...i, washQueueNum: idx !== -1 ? idx + 1 : 1 };
         }
         return i;
      });

      const occupiedCount = bookings.filter(b => isSameDate(b.tanggal, todayStr) && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')).length;
      const remainingSlots = Math.max(0, (dynamicJamPilihan.length * slotCapacityDisplay) - occupiedCount);

      const arrivedReguler = queueToUse.filter(i => {
         const s = (i.status || '').toLowerCase();
         const cat = (i.category || '').toLowerCase();
         return (cat === 'reguler' || cat === 'reguler (late)' || !cat) && s !== 'menginap' && s !== 'completed';
      });

      const arrivedBooking = queueToUse.filter(i => {
         const s = (i.status || '').toLowerCase();
         const cat = (i.category || '').toLowerCase();
         return cat === 'booking' && s !== 'menginap' && s !== 'completed';
      });

      const arrivedMenginap = queueToUse.filter(i => (i.status || '').toLowerCase() === 'menginap');

      const mergedBooking = sortQueue([...arrivedBooking]);

      // 0. Ambil semua BK yang sudah SELESAI hari ini (dari history)
      const finishedPlates = new Set(
         rawHistory
            .filter(h => {
               const s = (h.status || '').toLowerCase();
               if (s !== 'completed') return false;

               const now = new Date();
               now.setHours(0, 0, 0, 0);

               const checkDate = (val) => {
                  if (!val) return false;
                  try {
                     let d;
                     if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
                        const n = parseInt(val);
                        d = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
                     } else if (typeof val === 'string') {
                        if (val.includes('/')) {
                           const parts = val.split(/[ ,]/)[0].split('/');
                           if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
                        } else if (val.includes('-')) {
                           const parts = val.split(/[ T]/)[0].split('-');
                           if (parts.length === 3) {
                              if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]);
                              else d = new Date(parts[2], parts[1] - 1, parts[0]);
                           }
                        } else { d = new Date(val); }
                     } else { d = new Date(val); }
                     if (!d || isNaN(d.getTime())) return false;
                     d.setHours(0, 0, 0, 0);
                     return d.getTime() === now.getTime();
                  } catch (e) { return false; }
               };

               return [h.waktuSelesai, h.waktu_selesai, h.targetTime, h.target_time, h.completedAt, h.updatedAt, h.id].some(checkDate);
            })
            .map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase())
      );

      // 1. Ambil semua BK yang sudah ada di Menginap (paling prioritas)
      const menginapPlates = new Set(arrivedMenginap.map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase()));

      // 2. Filter Booking agar tidak menampilkan mobil yang sedang Menginap atau sudah Selesai
      const finalBooking = mergedBooking.filter(i => {
         const sanitizedBK = (i.bk || '').replace(/\s+/g, '').toUpperCase();
         const isScheduledItem = !i.status || i.status === 'accepted' || i.status === 'waiting confirm';
         if (isScheduledItem && finishedPlates.has(sanitizedBK)) return false;
         return !menginapPlates.has(sanitizedBK);
      });

      // 3. Ambil semua BK yang sudah ada di Booking atau Menginap untuk membersihkan Reguler
      const occupiedPlates = new Set([
         ...Array.from(menginapPlates),
         ...finalBooking.map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase())
      ]);

      // 4. Pastikan daftar Reguler bersih dari unit yang sudah ada di Booking atau Menginap
      const finalReguler = sortQueue([...arrivedReguler]).filter(i => {
         const sanitizedBK = (i.bk || '').replace(/\s+/g, '').toUpperCase();
         return !occupiedPlates.has(sanitizedBK);
      });

      return {
         booking: finalBooking,
         reguler: finalReguler,
         menginap: sortQueue(arrivedMenginap),
         remainingSlots
      };
   }, [processedQueue, bookings, dynamicJamPilihan]);

   const currentlyCalled = useMemo(() => {
      const called = processedQueue.filter(item => item.isCalled && item.status !== 'selesai' && item.status !== 'batal');
      const booking = called
         .filter(item => item.category === 'Booking' || item.category === 'Booking (Late)')
         .sort((a, b) => new Date(b.calledAt || b.called_at || 0).getTime() - new Date(a.calledAt || a.called_at || 0).getTime())[0];
      const reguler = called
         .filter(item => item.category !== 'Booking' && item.category !== 'Booking (Late)')
         .sort((a, b) => new Date(b.calledAt || b.called_at || 0).getTime() - new Date(a.calledAt || a.called_at || 0).getTime())[0];
      return { booking, reguler };
   }, [processedQueue]);

   const isCompletedToday = (item) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const check = (val) => {
         if (!val) return false;
         try {
            let d;
            if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
               const n = parseInt(val);
               d = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
            } else if (typeof val === 'string') {
               if (val.includes('/')) {
                  const parts = val.split(/[ ,]/)[0].split('/');
                  if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
               } else if (val.includes('-')) {
                  const parts = val.split(/[ T]/)[0].split('-');
                  if (parts.length === 3) {
                     if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]);
                     else d = new Date(parts[2], parts[1] - 1, parts[0]);
                  }
               } else { d = new Date(val); }
            } else { d = new Date(val); }
            if (!d || isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            return d.getTime() === now.getTime();
         } catch (e) { return false; }
      };
      return [item.waktuSelesai, item.waktu_selesai, item.targetTime, item.target_time, item.completedAt, item.updatedAt, item.id].some(check);
   };

   const todayCompleted = rawHistory.filter(isCompletedToday);
   const getTimeIn = (id) => {
      try {
         const n = parseInt(id);
         if (isNaN(n)) return '--:--';
         const date = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
         return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch { return '--:--'; }
   };
   const getTimeOut = (item) => {
      try {
         const tVal = item.targetTime || item.target_time || item.waktuSelesai || item.completedAt || item.updatedAt || item.id;
         if (!tVal) return '--:--';
         if (typeof tVal === 'string' && (tVal.includes('T') || tVal.includes('-') || tVal.includes(':')) && isNaN(tVal)) {
            const date = new Date(tVal);
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
         }
         const n = parseInt(tVal);
         if (!isNaN(n) && n > 0) {
            const date = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
         }
         return getTimeIn(item.id);
      } catch { return getTimeIn(item.id); }
   };

   return (
      <div className="w-full h-full bg-white flex flex-col overflow-hidden font-sans select-none transition-colors duration-500">

         {/* Audio Unlock Bar - floating bottom, only for display role */}
         {!audioUnlocked && user?.role?.toLowerCase() === 'display' && (
            <div
               className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] cursor-pointer animate-bounce"
               onClick={handleAudioUnlock}
            >
               <div className="bg-blue-600 text-white px-10 py-5 rounded-full shadow-2xl border-4 border-white/30 flex items-center gap-4">
                  <Megaphone size={28} fill="white" />
                  <span className="text-2xl font-black uppercase tracking-wider">Sentuh untuk Aktifkan Suara</span>
               </div>
            </div>
         )}

         {/* Call Announcement */}
         {callAnnouncement && (
            <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-modal-in pointer-events-none">
               <div className="bg-blue-600 text-white px-12 py-8 rounded-[3rem] shadow-[0_20px_60px_rgba(37,99,235,0.4)] border-4 border-white flex items-center gap-8">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                     <Megaphone size={40} fill="white" />
                  </div>
                  <div>
                     <p className="text-2xl font-black uppercase tracking-[0.3em] text-blue-200 mb-1">Panggilan Antrian</p>
                     <h2 className="text-6xl font-black font-mono tracking-tighter uppercase">
                        {callAnnouncement.queueNumber > 0 ? `${callAnnouncement.category === 'Booking' ? 'B' : 'R'}-${String(callAnnouncement.queueNumber).padStart(3, '0')}` : callAnnouncement.bk}
                     </h2>
                     <p className="text-2xl font-black text-white mt-2">
                        Silahkan menuju Counter {callAnnouncement.counter}
                     </p>
                  </div>
                  <div className="ml-6 pl-8 border-l-4 border-white/20 flex flex-col items-center">
                     <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 animate-pulse">
                        <Megaphone size={28} />
                     </div>
                     <span className="text-lg font-black mt-2 uppercase">Memanggil...</span>
                  </div>
               </div>
            </div>
         )}

         <header className="px-3 py-2 md:px-12 md:py-5 flex justify-between items-center bg-white border-b-2 border-zinc-100 z-50 shrink-0">
            <div className="flex items-center gap-3 md:gap-16" onDoubleClick={onLogoDoubleClick}>
               <div className="flex items-center gap-3 md:gap-10 bg-white rounded-xl p-1">
                  <img src={cheryLogo} alt="Chery" className="h-8 md:h-32 object-contain" />
               </div>
               <div className="hidden sm:block">
                  <h1 className="text-xl md:text-4xl font-black tracking-tighter text-black leading-tight">Service <span className="text-black">Dashboard</span></h1>
                  <p className="text-[10px] md:text-lg font-black text-zinc-400 uppercase tracking-[0.3em]">Chery Oriental – Real-time Monitoring</p>
               </div>
            </div>
            <div className="flex items-center gap-2 md:gap-8">
               <div className="hidden md:flex items-center gap-4 bg-zinc-50 border-2 border-zinc-200 rounded-2xl px-6 py-3 shadow-sm">
                  <div className="text-right">
                     <p className="text-lg font-black text-black uppercase tracking-tight leading-none">Booking disini! 👇</p>
                     <p className="text-sm text-zinc-400 font-bold uppercase mt-1">Scan QR ini</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl border-2 border-zinc-200 shadow-sm">
                     <QRCodeSVG value="https://www.cherymedan.web.id" size={64} level="H" />
                  </div>
               </div>
               <div className="hidden md:block h-14 w-0.5 bg-zinc-100" />
               <div className="flex flex-col items-end">
                  <ClockDisplay className="text-2xl md:text-5xl font-black tracking-tighter text-zinc-900 tabular-nums leading-none" />
               </div>
            </div>
         </header>

         <main className="flex-1 overflow-hidden px-3 py-2 md:px-8 md:py-3 flex flex-col gap-1.5 md:gap-3 min-h-0">
            <div className="shrink-0">
               <CompletedCarousel data={todayCompleted} formatTime={formatTime} setSelectedUnit={setSelectedUnit} />
            </div>

            {/* Currently Called: 2-col grid */}
            <div className="shrink-0">
               {currentlyCalled.booking || currentlyCalled.reguler ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                     {currentlyCalled.booking ? (
                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-xl flex items-center gap-3 md:gap-4">
                           <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-red-600 flex items-center justify-center shrink-0 shadow-lg">
                              <Bookmark size={24} fill="white" className="text-white" />
                           </div>
                           <div className="min-w-0 flex-1">
                              <p className="text-[10px] md:text-xs font-black text-red-400 uppercase">Dipanggil Booking</p>
                              <p className="text-lg md:text-2xl font-black text-red-600 uppercase truncate font-mono leading-tight">
                                 {currentlyCalled.booking.queueNumber > 0 ? `Booking ${currentlyCalled.booking.queueNumber}` : currentlyCalled.booking.bk}
                              </p>
                              <p className="text-xs md:text-sm font-black text-red-500">
                                 {currentlyCalled.booking.bk} • Counter {currentlyCalled.booking.counter}
                              </p>
                           </div>
                           <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                        </div>
                     ) : null}
                     {currentlyCalled.reguler ? (
                        <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-xl flex items-center gap-3 md:gap-4">
                           <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0 shadow-lg">
                              <Zap size={24} fill="white" className="text-white" />
                           </div>
                           <div className="min-w-0 flex-1">
                              <p className="text-[10px] md:text-xs font-black text-zinc-400 uppercase">Dipanggil Reguler</p>
                              <p className="text-lg md:text-2xl font-black text-zinc-600 uppercase truncate font-mono leading-tight">
                                 {currentlyCalled.reguler.queueNumber > 0 ? `Reguler ${currentlyCalled.reguler.queueNumber}` : currentlyCalled.reguler.bk}
                              </p>
                              <p className="text-xs md:text-sm font-black text-zinc-500">
                                 {currentlyCalled.reguler.bk} • Counter {currentlyCalled.reguler.counter}
                              </p>
                           </div>
                           <div className="w-3 h-3 rounded-full bg-zinc-400 animate-pulse shrink-0" />
                        </div>
                     ) : null}
                  </div>
               ) : null}
            </div>

            {/* 3 columns: vertical stack, fill remaining height */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 md:gap-4 flex-1 min-h-0">
               <CarouselCol title="Booking" data={categories.booking} colorClass="bg-red-600" icon={Bookmark} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} subtitle={(<div className="flex flex-col mt-1"><div className="flex items-center gap-2 overflow-hidden"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" /><span className="text-xl font-black text-zinc-400 uppercase tracking-widest truncate">{categories.booking.length} Unit Antrian</span></div></div>)} />
               <CarouselCol title="Reguler" data={categories.reguler} colorClass="bg-zinc-800" icon={Zap} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} />
               <CarouselCol title="Menginap" data={categories.menginap} colorClass="bg-purple-600" icon={Moon} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} />
            </div>
         </main>

         {selectedUnit && (() => {
            const liveUnit = processedQueue.find(i => i.id === selectedUnit.id) || selectedUnit;
            return (
               <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[999] flex items-center justify-center p-4 md:p-8" onClick={() => setSelectedUnit(null)}>
                  <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden transition-colors border-4 border-zinc-200" onClick={e => e.stopPropagation()}>
                     <div className="bg-zinc-900 p-6 md:p-10 flex justify-between items-center shrink-0 border-b-4 border-red-600">
                        <div className="flex items-center gap-4 md:gap-8">
                           <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0"><Car size={28} /></div>
                           <div className="flex items-center gap-6 md:gap-12">
                              <div>
                                 <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase leading-none mb-1.5">{selectedUnit.bk}</h2>
                                 <div className="flex items-center gap-3">
                                    <span className="text-red-400 font-black text-xs uppercase tracking-widest px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">{selectedUnit.category}</span>
                                    <span className="text-zinc-400 text-xs uppercase tracking-widest hidden md:inline">{selectedUnit.tipe}</span>
                                 </div>
                              </div>
                              {(liveUnit.status === 'menginap' || selectedUnit.status === 'menginap') && (liveUnit.menginap_reason || selectedUnit.menginap_reason) && (
                                 <div className="hidden sm:flex flex-col border-l-2 border-white/20 pl-6 md:pl-10 animate-fade-in">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1.5"><Moon size={14} fill="currentColor" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Alasan Menginap</span></div>
                                    <h3 className="text-3xl md:text-7xl font-semibold text-white tracking-tight uppercase leading-none">{liveUnit.menginap_reason || selectedUnit.menginap_reason}</h3>
                                 </div>
                              )}
                           </div>
                        </div>
                        <button onClick={() => setSelectedUnit(null)} className="p-3 md:p-4 bg-white/5 hover:bg-red-600 text-white rounded-2xl transition-all"><X size={24} /></button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 custom-scrollbar">
                        <div className="space-y-8">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={12} /> Waktu Datang</p>
                                 <p className="text-2xl font-black text-blue-900">{getTimeIn(selectedUnit.id)}</p>
                              </div>
                              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                                 <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><CheckCircle size={12} /> Target Selesai</p>
                                 <p className="text-2xl font-black text-emerald-900">{getTimeOut(liveUnit)}</p>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 flex-1"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Service Advisor</p><p className="text-lg font-black text-zinc-900 uppercase">{liveUnit.nama_sa || '—'}</p></div>
                              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 flex-1"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Mekanik</p><p className="text-lg font-black text-blue-600 uppercase">{liveUnit.mechanicName || 'Belum ditugaskan'}</p></div>
                           </div>
                           {/* Modal Status Banner */}
                           {(() => {
                              const banMap = {
                                 'waiting': { bg: '#d97706', label: 'MENUNGGU ANTRIAN PEKERJAAN' },
                                 'working': { bg: '#2563eb', label: 'SEDANG DIKERJAKAN' },
                                 'request_extension': { bg: '#d97706', label: 'MENUNGGU APPROVAL TAMBAH WAKTU' },
                                 'menunggu_cuci': { bg: '#0d9488', label: 'MENUNGGU ANTRIAN CUCI' },
                                 'sedang_dicuci': { bg: '#0891b2', label: 'SEDANG DICUCI' },
                                 'menunggu_konfirmasi': { bg: '#f59e0b', label: 'MENUNGGU KONFIRMASI ADMIN' },
                                 'menunggu_sa': { bg: '#6b7280', label: 'MENUNGGU SA' },
                                 'menunggu_foreman': { bg: '#7c3aed', label: 'MENUNGGU FOREMAN' },
                                 'istirahat': { bg: '#eab308', label: 'ISTIRAHAT' },
                              };
                              const bc = banMap[liveUnit.status];
                              if (!bc) return null;
                              return (
                                 <div className="px-5 py-4 rounded-2xl border-2 border-white/30 shadow-2xl" style={{ backgroundColor: bc.bg }}>
                                    <p className="text-xs font-black text-white uppercase tracking-[0.2em] text-center">{bc.label}</p>
                                 </div>
                              );
                           })()}
                           <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14} className="text-black" /> Keluhan Utama</h4>
                              <p className="text-lg font-bold text-zinc-900 leading-tight whitespace-pre-wrap">"{liveUnit.keluhan || 'Tidak ada catatan keluhan'}"</p>
                           </div>
                           <div>
                              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Progress Pekerjaan</h4>
                              <div className="space-y-3">
                                 {(liveUnit.checklist || []).length === 0 ? (
                                    <div className="border-2 border-dashed border-zinc-100 rounded-2xl py-8 flex flex-col items-center opacity-40"><FileText size={36} className="text-black mb-2" /><p className="text-xs font-bold text-zinc-400 uppercase">Belum ada task spesifik</p></div>
                                 ) : liveUnit.checklist.map(task => (
                                    <div key={task.id} className="flex items-center gap-4 p-4 bg-white border border-zinc-100 rounded-xl shadow-sm"><button disabled={!user || user.role !== 'mekanik' || liveUnit.status !== 'working'} onClick={() => onToggleTask(liveUnit, task.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-300 hover:border-emerald-500'}`}>{task.completed ? <CheckCircle size={16} /> : <div className="w-4 h-4 border-2 border-current rounded-full" />}</button><span className={`font-bold uppercase tracking-tight transition-all ${task.completed ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>{task.text}</span></div>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col gap-5">
                           <div className="bg-zinc-900 p-8 rounded-3xl text-center relative overflow-hidden">
                              <div className="absolute inset-0 bg-zinc-800/20" />
                              <p className="text-[11px] font-black text-white/30 uppercase tracking-widest mb-4 relative z-10">
                                 {['menunggu_konfirmasi', 'completed', 'menunggu_cuci', 'sedang_dicuci'].includes(liveUnit.status) ? 'Durasi Pengerjaan' : 'Countdown'}
                              </p>
                              <p className="text-5xl font-black text-white tracking-widest tabular-nums relative z-10">
                                 {liveUnit.status === 'working'
                                    ? formatTime(liveUnit.estimasi)
                                    : ['menunggu_konfirmasi', 'completed', 'menunggu_cuci', 'sedang_dicuci'].includes(liveUnit.status)
                                       ? formatTime(liveUnit.estimasiDefault || liveUnit.elapsedSeconds || 0)
                                       : '--:--:--'}
                              </p>
                              <div className={`mt-4 px-6 py-2 rounded-full inline-block text-[10px] font-black uppercase tracking-widest relative z-10 ${liveUnit.status === 'working' ? 'bg-blue-600 text-white' : liveUnit.status === 'istirahat' ? 'bg-yellow-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                 {liveUnit.status === 'working' ? 'Aktif Diproses' : liveUnit.status === 'istirahat' ? 'Istirahat' : liveUnit.status === 'menginap' ? 'Menginap' : 'Menunggu Antrian'}
                              </div>
                           </div>
                           {user?.role?.toLowerCase() === 'mekanik' && (
                              <div className="flex flex-col gap-3">
                                 {liveUnit.status === 'waiting' && (!liveUnit.mechanicName || liveUnit.mechanicName.split(',').includes(user.name)) && (<button onClick={() => onStartWork(liveUnit)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"><Zap size={18} fill="white" /> Mulai Pekerjaan</button>)}
                                 {liveUnit.status === 'menginap' && (!liveUnit.mechanicName || liveUnit.mechanicName.split(',').includes(user.name)) && (<button onClick={() => onStartWork(liveUnit)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-2"><Zap size={18} fill="white" /> Lanjutkan Pekerjaan</button>)}
                                 {liveUnit.status === 'working' && liveUnit.mechanicName && liveUnit.mechanicName.split(',').includes(user.name) && (<button onClick={() => onComplete(liveUnit)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle size={18} /> Selesai Pekerjaan</button>)}
                              </div>
                           )}
                           {liveUnit.menginap_reason && (
                              <div className="bg-[#7e22ce] p-6 rounded-2xl border-2 border-white/20 shadow-xl"><p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2 flex items-center gap-2"><Moon size={12} fill="currentColor" /> Menginap Karena</p><p className="text-lg font-black text-white italic uppercase">"{liveUnit.menginap_reason}"</p></div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            );
         })()}

         <style>{`
        .footer-marquee { animation: footerScroll 40s linear infinite; }
        @keyframes footerScroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      </div>
   );
};

export default DisplayBoard;