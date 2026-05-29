import React, { useState, useEffect, useMemo, useRef } from 'react';
import ClockDisplay from './ClockDisplay';
import { Bookmark, Zap, Car, Instagram, CheckCircle, Clock, Moon, FileText, X, Activity, CalendarDays, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import cheryLogo from '../assets/cherylogo.png';
import orientalLogo from '../assets/oriental.jpeg';
import { QRCodeSVG } from 'qrcode.react';

const DISPLAY_COUNT = 2; // Default for vertical columns
const COMPLETED_DISPLAY_COUNT = 2; // Show only 2 completed units per slide
const SLIDE_INTERVAL = 10000; // 10 seconds per slide

const generateSlots = (count) => {
   const slots = [];
   let currentHour = 8;
   let currentMin = 30;
   for (let i = 0; i < count; i++) {
      const h = String(currentHour).padStart(2, '0');
      const m = String(currentMin).padStart(2, '0');
      slots.push(`${h}.${m}`);
      currentMin += 30;
      if (currentMin >= 60) {
         currentHour += 1;
         currentMin = 0;
      }
   }
   return slots;
};

const isSameDate = (d1, d2) => {
   const normalize = (d) => {
      if (!d) return "";
      if (d instanceof Date) return d.toLocaleDateString('en-CA');
      let str = String(d).split(/[T ]/)[0];
      if (str.includes("/")) {
         const parts = str.split("/");
         if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            return `${yyyy.split(',')[0]}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
         }
      }
      if (!isNaN(str) && str.length >= 10) {
         const ms = parseInt(str);
         const date = ms < 10000000000 ? new Date(ms * 1000) : new Date(ms);
         return date.toLocaleDateString('en-CA');
      }
      return str;
   };
   return normalize(d1) === normalize(d2);
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
   const isMenginap = item.status === 'menginap';
   const isWaiting = item.status === 'waiting';

   const isScheduled = !item.status || item.status === 'accepted' || item.status === 'waiting confirm';

   return (
      <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden flex flex-col group/card hover:border-zinc-300 transition-all ${isScheduled ? 'border-dashed border-zinc-200 opacity-80' : 'border-zinc-100'}`}>
         {/* Color bar - Standard Hex for TV */}
         <div 
           className="h-1 w-full shrink-0" 
           style={{ backgroundColor: isScheduled ? '#d4d4d8' : isWorking ? '#3b82f6' : isMenginap ? '#a855f7' : '#ef4444' }} 
         />

         <div className="px-4 py-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-1.5 flex-wrap">
                  <span 
                    className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 text-white shadow-sm"
                    style={{ backgroundColor: (item.category === 'Booking' || item.category === 'Booking (Late)') ? '#dc2626' : '#4b5563' }}
                  >
                     {(item.category === 'Booking' || item.category === 'Booking (Late)') ? <Bookmark size={9} fill="white" /> : <Zap size={9} fill="white" />}
                     {item.category}
                  </span>
                  <span 
                    className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: isScheduled ? '#dc2626' : isWorking ? '#2563eb' : isMenginap ? '#9333ea' : '#ef4444' }}
                  >
                     {isScheduled ? `○ BOOKING ${item.jam} WIB` : isWorking ? '● PROSES WIP' : isMenginap ? '● MENGINAP' : '● ANTRIAN'}
                  </span>
               </div>
               {!isScheduled && (
                  <button onClick={() => setSelectedUnit(item)} className="p-1.5 text-black hover:text-zinc-600 transition-colors">
                     <FileText size={16} />
                  </button>
               )}
            </div>

            <div className="py-1">
               <h3 className="text-4xl font-black tracking-tighter text-black font-mono uppercase leading-none">{item.bk}</h3>
               <p className="text-[10px] font-black text-black uppercase tracking-widest mt-0.5">{item.tipe || '—'}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-50 font-mono">
               {isMenginap ? (
                  <div className="col-span-3">
                     <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                        <Moon size={8} className="text-purple-500" /> Alasan Menginap
                     </p>
                     <p className="text-[11px] font-black text-purple-700 leading-none truncate uppercase">
                        {item.menginap_reason || '—'}
                     </p>
                  </div>
               ) : (
                  <>
                     <div>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                           <Clock size={8} className={isScheduled ? 'text-zinc-400' : 'text-blue-500'} /> {isScheduled ? 'Jadwal' : 'Datang'}
                        </p>
                        <p className="text-sm font-black text-zinc-900 tabular-nums leading-none">{isScheduled ? item.jam : timeIn}</p>
                        {!isScheduled && <p className="text-[9px] font-bold text-zinc-400 mt-0.5 leading-none">{dateIn}</p>}
                     </div>

                     <div className="col-span-2">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                           <Activity size={8} className={isWorking ? 'text-orange-500' : 'text-zinc-300'} /> {isScheduled ? 'Keperluan' : 'Estimasi'}
                        </p>
                        <p className={`text-sm font-black tabular-nums leading-none truncate ${isWorking ? (item.estimasi < 300 ? 'text-red-600 animate-pulse' : 'text-orange-600') : 'text-zinc-500'}`}>
                           {isScheduled ? (item.keluhan || '-') : isWorking ? formatTime(item.estimasi) : formatTime(parseInt(item.estimasiDefault) || 0)}
                        </p>
                     </div>
                  </>
               )}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
               <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm" 
                    style={{ backgroundColor: (isScheduled && item.category !== 'Reguler (Late)') ? '#dc2626' : '#1e40af' }}
                  >
                     {(isScheduled && item.category !== 'Reguler (Late)') ? 'CS' : 'SA'}
                  </div>
                  <span className="text-[11px] font-black text-zinc-900 uppercase truncate">
                     {item.category === 'Reguler (Late)' ? '—' : (isScheduled ? (item.addedBy || 'BOOKING ONLINE') : (item.addedBy || '—'))}
                  </span>
               </div>
               {!isScheduled && (
                  <>
                     <div className="w-px h-5 bg-zinc-200 shrink-0" />
                     <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-lg bg-[#2563eb] flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm">MK</div>
                        <span className="text-[11px] font-black text-[#2563eb] uppercase truncate">{item.mechanicName || '—'}</span>
                     </div>
                  </>
               )}
            </div>

            {isMenginap && item.menginap_reason && (
               <div className="mt-2 px-4 py-3 bg-[#9333ea] rounded-2xl border-2 border-white/30 shadow-2xl ring-4 ring-purple-500/20">
                  <div className="flex items-center gap-2 mb-1.5 text-white/70">
                     <Moon size={12} fill="currentColor" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Keterangan Menginap</span>
                  </div>
                  <p className="text-[15px] font-black text-white leading-tight uppercase font-mono italic">
                     "{item.menginap_reason}"
                  </p>
               </div>
            )}

            {user?.role?.toLowerCase() === 'mekanik' && (
               <div className="pt-2 border-t border-zinc-50">
                  {item.status === 'waiting' && (!item.mechanicName || item.mechanicName === user.name) && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onStartWork(item); }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                     >
                        <Zap size={14} fill="white" /> Mulai Pekerjaan
                     </button>
                  )}
                  {item.status === 'menginap' && (!item.mechanicName || item.mechanicName === user.name) && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onStartWork(item); }}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                     >
                        <Zap size={14} fill="white" /> Lanjutkan Pekerjaan
                     </button>
                  )}
                  {isWorking && item.mechanicName === user.name && (
                     <button
                        onClick={(e) => { e.stopPropagation(); onComplete(item); }}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                     >
                        <CheckCircle size={14} /> Selesai Pekerjaan
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
      <div className="flex flex-col bg-white rounded-2xl p-4 md:p-5 border-2 border-dashed border-zinc-200 shadow-sm transition-all hover:shadow-xl h-full">
         <div className="flex items-center justify-between mb-6 shrink-0 gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
               <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${colorClass} shrink-0`}>
                  <Icon size={20} fill="currentColor" />
               </div>
               <div className="min-w-0">
                  <h3 className="text-sm md:text-2xl font-black text-zinc-900 uppercase tracking-tighter leading-tight truncate">{title}</h3>
                  {subtitle ? subtitle : (
                     <p className="text-[9px] md:text-sm font-black text-zinc-400 uppercase tracking-widest mt-0.5 flex items-center gap-1 whitespace-nowrap overflow-hidden">
                        <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${data.length > 0 ? (colorClass === 'bg-red-600' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse') : 'bg-zinc-300'}`} />
                        {data.length} unit
                     </p>
                  )}
               </div>
            </div>
            {hasMultiple && (
               <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 shadow-sm shrink-0">
                  <button onClick={() => { const newIdx = (idx - 1 + totalStops) % totalStops; goToIdx(newIdx); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-all text-zinc-400 hover:text-zinc-900 active:scale-95"><ChevronLeft size={14} strokeWidth={4} /></button>
                  <div className="flex flex-col items-center px-1 md:px-2">
                     <span className="text-[9px] font-black text-zinc-400/80 uppercase tracking-widest leading-none mb-0.5">{idx + 1} / {totalStops}</span>
                     <div className="hidden sm:flex items-center gap-1 mt-0.5">
                        {Array.from({ length: Math.min(totalStops, 10) }).map((_, i) => (<button key={i} onClick={() => goToIdx(i)} className={`rounded-full transition-all duration-500 ${i === idx ? 'w-5 h-1 bg-zinc-900' : 'w-1 h-1 bg-zinc-200'}`} />))}
                     </div>
                  </div>
                  <button onClick={() => { const newIdx = (idx + 1) % totalStops; goToIdx(newIdx); }} className="p-1 hover:bg-zinc-100 rounded-lg transition-all text-zinc-400 hover:text-zinc-900 active:scale-95"><ChevronRight size={14} strokeWidth={4} /></button>
               </div>
            )}
         </div>
         <div className="flex flex-col gap-4" key={idx}>
            {visibleItems.map((item, i) => item ? ( <QueueCard key={item.id} item={item} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} /> ) : ( <div key={`empty-${i}`} className="h-[200px] rounded-2xl border-2 border-dashed border-zinc-50 opacity-20 hidden md:block" /> ) )}
         </div>
      </div>
   );
};

const CompletedCarousel = ({ data, formatTime, setSelectedUnit }) => {
   const [idx, setIdx] = useState(0);
   const [displayCount, setDisplayCount] = useState(window.innerWidth < 768 ? 1 : 2);
   const timerRef = useRef(null);

   useEffect(() => {
      const handleResize = () => { setDisplayCount(window.innerWidth < 768 ? 1 : 2); };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
   }, []);

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
      <div className="w-full rounded-3xl p-4 md:p-6 shadow-2xl relative overflow-hidden group border-4 border-emerald-500/50 min-h-[220px] md:min-h-[280px] flex flex-col justify-center" style={{ backgroundColor: '#059669' }}>
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
         <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10 gap-2">
            <div className="flex items-center gap-2 min-w-0">
               <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-xl shrink-0"><CheckCircle size={18} /></div>
               <div className="bg-white/10 px-3 md:px-6 py-1.5 md:py-2 rounded-xl backdrop-blur-md border border-white/10 shrink-0">
                  <span className="text-xs md:text-xl font-black text-white uppercase tracking-wider md:tracking-widest leading-none">
                     {data.length} <span className="hidden xs:inline text-emerald-200">UNIT SELESAI</span>
                     <span className="xs:hidden text-emerald-200 ml-1">SELESAI</span>
                  </span>
               </div>
            </div>
            {hasMultiple && (
               <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + totalStops) % totalStops); startTimer(); }} className="p-1 hover:bg-white/20 rounded-lg transition-all text-white active:scale-95"><ChevronLeft size={16} strokeWidth={4} /></button>
                  <div className="flex flex-col items-center px-1 md:px-2">
                     <span className="text-[9px] md:text-[10px] font-black text-white/80 uppercase tracking-widest leading-none mb-0.5">{idx + 1} / {totalStops}</span>
                     <div className="hidden sm:flex gap-1 mt-0.5">
                        {Array.from({ length: Math.min(totalStops, 6) }).map((_, i) => (<button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); startTimer(); }} className={`h-1 rounded-full transition-all duration-500 ${i === idx ? 'w-4 bg-white' : 'w-1 bg-white/30'}`} />))}
                     </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % totalStops); startTimer(); }} className="p-1 hover:bg-white/20 rounded-lg transition-all text-white active:scale-95"><ChevronRight size={16} strokeWidth={4} /></button>
               </div>
            )}
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 relative z-10" key={idx}>
            {visibleItems.map((item, i) => item ? (
                  <div key={item.id} onClick={() => setSelectedUnit(item)} className="bg-white rounded-xl md:rounded-2xl p-3 md:p-6 shadow-xl border-4 border-white/50 group/card cursor-pointer hover:bg-white hover:scale-[1.02] transition-all flex flex-col items-center justify-center h-full min-h-[100px] md:min-h-[130px]">
                     <h2 className="text-2xl md:text-5xl font-black text-black font-mono tracking-tighter mb-1 uppercase truncate w-full text-center leading-none">{item.bk}</h2>
                     <p className="text-[10px] md:text-xs font-black text-black/40 uppercase tracking-[0.3em] truncate w-full text-center mt-1 md:mt-2 leading-none border-t border-zinc-100 pt-2 md:pt-3">{item.tipe}</p>
                     <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-4 bg-emerald-500/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap leading-none">
                           Selesai Pukul {new Date(parseInt(item.targetTime || item.target_time || item.id)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                     </div>
                  </div>
               ) : (
                  <div key={`empty-${i}`} className="bg-white/5 rounded-xl md:rounded-2xl border-2 border-dashed border-white/20 h-full min-h-[100px] md:min-h-[130px] flex items-center justify-center">
                     <p className="text-[10px] md:text-xs font-bold text-white/10 uppercase tracking-[0.2em] whitespace-nowrap">Belum ada data</p>
                  </div>
               ))}
         </div>
      </div>
   );
};

const DisplayBoard = ({ processedQueue, formatTime, user, onStartWork, onComplete, onToggleTask, onLogoDoubleClick, rawHistory = [], bookings = [] }) => {
   const [selectedUnit, setSelectedUnit] = useState(null);
   const [audioUnlocked, setAudioUnlocked] = useState(false);
   const [lastNotifiedId, setLastNotifiedId] = useState(null);
   const [notificationToast, setNotificationToast] = useState(null);
   
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
   const configSlot = bookings.find(b => b.id === 999999);
   const maxCount = configSlot ? (parseInt(configSlot.namaCustomer || configSlot.addedBy) || 4) : 4;
   const dynamicJamPilihan = generateSlots(maxCount);

   const sortQueue = (arr) => [...arr].sort((a, b) => {
      const aScore = a.status === 'working' ? 0 : a.status === 'istirahat' ? 1 : 2;
      const bScore = b.status === 'working' ? 0 : b.status === 'istirahat' ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
   });

   const categories = useMemo(() => {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const todayBookingsRaw = bookings.filter(b => {
         if (!b.tanggal || !isSameDate(b.tanggal, todayStr)) return false;
         if (b.id === 999999) return false;
         if (processedQueue.some(pq => pq.bk === b.bk)) return false;
         return true;
      });

      const todayBookings = [];
      const movedToReguler = [];

      todayBookingsRaw.forEach(b => {
         try {
            const timeStr = String(b.jam).includes('.') ? String(b.jam).replace('.', ':') : `${b.jam}:00`;
            const [jamStr, menitStr] = timeStr.split(':');
            const scheduledTime = new Date();
            scheduledTime.setHours(parseInt(jamStr), parseInt(menitStr), 0, 0);
            
            // Periksa jika sudah lewat 15 menit dari jam booking
            const diffInMinutes = (new Date() - scheduledTime) / (1000 * 60);

            if (diffInMinutes > 15) {
               movedToReguler.push({ ...b, category: 'Reguler (Late)', isLate: true });
            } else {
               todayBookings.push({ ...b, category: 'Booking' });
            }
         } catch (e) { 
            todayBookings.push({ ...b, category: 'Booking' }); 
         }
      });

      const occupiedCount = bookings.filter(b => isSameDate(b.tanggal, todayStr) && b.id !== 999999 && (b.status === 'accepted' || b.status === 'waiting confirm' || b.status === 'completed')).length;
      const remainingSlots = Math.max(0, dynamicJamPilihan.length - occupiedCount);

      const arrivedReguler = processedQueue.filter(i => {
         const s = (i.status || '').toLowerCase();
         const cat = (i.category || '').toLowerCase();
         return (cat === 'reguler' || cat === 'reguler (late)' || !cat) && s !== 'menginap' && s !== 'completed';
      });
      
      const arrivedBooking = processedQueue.filter(i => {
         const s = (i.status || '').toLowerCase();
         return i.category === 'Booking' && s !== 'menginap' && s !== 'completed';
      });

      const arrivedMenginap = processedQueue.filter(i => (i.status || '').toLowerCase() === 'menginap');

      const mergedBooking = [...arrivedBooking, ...todayBookings].sort((a, b) => {
         if (a.status === 'working' && b.status !== 'working') return -1;
         if (a.status !== 'working' && b.status === 'working') return 1;
         return String(a.jam || '').localeCompare(String(b.jam || ''));
      });

      // --- DEDUPLIKASI KETAT (Satu unit hanya boleh di satu kolom & Hilang jika Selesai) ---
      // 0. Ambil semua BK yang sudah SELESAI hari ini (dari history)
      const finishedPlates = new Set(
         rawHistory
            .filter(h => {
               const s = (h.status || '').toLowerCase();
               // Cek jika ID atau Waktu Selesai menunjukkan hari ini
               const todayStr = new Date().toDateString();
               try {
                  const itemDate = new Date(parseInt(h.id) < 2000000000 ? parseInt(h.id) * 1000 : parseInt(h.id));
                  return itemDate.toDateString() === todayStr || s === 'completed';
               } catch (e) { return s === 'completed'; }
            })
            .map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase())
      );

      // 1. Ambil semua BK yang sudah ada di Menginap (paling prioritas)
      const menginapPlates = new Set(arrivedMenginap.map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase()));

      // 2. Filter Booking agar tidak menampilkan mobil yang sedang Menginap atau sudah Selesai
      const finalBooking = mergedBooking.filter(i => {
         const sanitizedBK = (i.bk || '').replace(/\s+/g, '').toUpperCase();
         return !menginapPlates.has(sanitizedBK) && !finishedPlates.has(sanitizedBK);
      });

      // 3. Ambil semua BK yang sudah ada di Booking, Menginap, atau History untuk membersihkan Reguler
      const occupiedPlates = new Set([
         ...Array.from(finishedPlates),
         ...Array.from(menginapPlates),
         ...finalBooking.map(i => (i.bk || '').replace(/\s+/g, '').toUpperCase())
      ]);

      // 4. Pastikan daftar Reguler bersih dari unit yang sudah ada di Booking atau Menginap
      const finalReguler = sortQueue([...arrivedReguler, ...movedToReguler]).filter(i => {
         const sanitizedBK = (i.bk || '').replace(/\s+/g, '').toUpperCase();
         // Jangan tampilkan jika plat sudah ada di kolom lain 
         // ATAU jika unit aslinya sudah ditandai menginap/selesai
         return !occupiedPlates.has(sanitizedBK);
      });

      return {
         booking: finalBooking,
         reguler: finalReguler,
         menginap: sortQueue(arrivedMenginap),
         remainingSlots
      };
   }, [processedQueue, bookings, dynamicJamPilihan]);

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
         const n = parseInt(tVal);
         if (!isNaN(n)) {
            const date = (n < 2000000000) ? new Date(n * 1000) : new Date(n);
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
         }
         return getTimeIn(item.id);
      } catch { return getTimeIn(item.id); }
   };

   return (
      <div className="w-full h-full bg-white flex flex-col overflow-hidden font-sans select-none transition-colors duration-500">
         {/* Floating Notification Toast for TV */}
         {notificationToast && (
            <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-modal-in pointer-events-none">
               <div className="bg-emerald-600 text-white px-10 py-6 rounded-[2.5rem] shadow-[0_20px_60px_rgba(5,150,105,0.4)] border-4 border-white flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                     <Zap size={32} fill="white" />
                  </div>
                  <div>
                     <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-100 mb-1">Unit Telah Selesai</p>
                     <h2 className="text-4xl font-black font-mono tracking-tighter uppercase">{notificationToast.bk}</h2>
                  </div>
                  <div className="ml-4 pl-6 border-l border-white/20 flex flex-col items-center">
                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 animate-pulse">
                        <Activity size={24} />
                     </div>
                     <span className="text-[10px] font-black mt-1 uppercase">Playing Sound</span>
                  </div>
               </div>
            </div>
         )}

         <header className="px-4 md:px-10 py-4 flex justify-between items-center bg-white border-b border-zinc-100 z-50 shrink-0">
            <div className="flex items-center gap-6 md:gap-14" onDoubleClick={onLogoDoubleClick}>
               <div className="flex items-center gap-5 md:gap-10 bg-white rounded-xl p-1">
                  <img src={cheryLogo} alt="Chery" className="h-14 md:h-28 object-contain" />
                  <img src={orientalLogo} alt="Oriental" className="h-14 md:h-28 object-contain" />
               </div>
               <div className="hidden lg:block">
                  <h1 className="text-3xl font-black tracking-tighter text-black leading-tight">Service <span className="text-black">Dashboard</span></h1>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Chery Oriental – Real-time Monitoring</p>
               </div>
            </div>
            <div className="flex items-center gap-3 md:gap-8">
               <div className="hidden md:flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3 shadow-sm">
                  <div className="text-right">
                     <p className="text-[11px] font-black text-black uppercase tracking-tight leading-none">Booking disini! 👇</p>
                     <p className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5">Scan QR ini</p>
                  </div>
                  <div className="bg-white p-1.5 rounded-xl border border-zinc-200 shadow-sm">
                     <QRCodeSVG value="https://www.cherymedan.web.id" size={52} level="H" />
                  </div>
               </div>
               <div className="hidden md:block h-12 w-px bg-zinc-100" />
               <div className="flex flex-col items-end">
                  <ClockDisplay className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 tabular-nums leading-none" />
                  
               </div>
            </div>
         </header>

         <main className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4 flex flex-col gap-3 custom-scrollbar pb-[72px] md:pb-4">
            <CompletedCarousel data={todayCompleted} formatTime={formatTime} setSelectedUnit={setSelectedUnit} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-4 min-h-0">
               <CarouselCol title="Booking" data={categories.booking} colorClass="bg-red-600" icon={Bookmark} formatTime={formatTime} setSelectedUnit={setSelectedUnit} user={user} onStartWork={onStartWork} onComplete={onComplete} subtitle={( <div className="flex flex-col mt-0.5"><div className="flex items-center gap-1.5 overflow-hidden"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" /><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{categories.booking.length} Unit Antrian</span></div></div> )} />
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
                              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 flex-1"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Service Advisor</p><p className="text-lg font-black text-zinc-900 uppercase">{liveUnit.addedBy || '—'}</p></div>
                              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 flex-1"><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Mekanik</p><p className="text-lg font-black text-blue-600 uppercase">{liveUnit.mechanicName || 'Belum ditugaskan'}</p></div>
                           </div>
                           <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14} className="text-black" /> Keluhan Utama</h4>
                              <p className="text-lg font-bold text-zinc-900 leading-tight">"{liveUnit.keluhan || 'Tidak ada catatan keluhan'}"</p>
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
                           <div className="bg-zinc-900 p-8 rounded-3xl text-center relative overflow-hidden"><div className="absolute inset-0 bg-zinc-800/20" /><p className="text-[11px] font-black text-white/30 uppercase tracking-widest mb-4 relative z-10">Countdown</p><p className="text-5xl font-black text-white tracking-widest tabular-nums relative z-10">{liveUnit.status === 'working' ? formatTime(liveUnit.estimasi) : '--:--:--'}</p><div className={`mt-4 px-6 py-2 rounded-full inline-block text-[10px] font-black uppercase tracking-widest relative z-10 ${liveUnit.status === 'working' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/30'}`}>{liveUnit.status === 'working' ? 'Aktif Diproses' : liveUnit.status === 'menginap' ? 'Menginap' : 'Menunggu Antrian'}</div></div>
                           {user?.role?.toLowerCase() === 'mekanik' && (
                              <div className="flex flex-col gap-3">
                                 {liveUnit.status === 'waiting' && (!liveUnit.mechanicName || liveUnit.mechanicName === user.name) && ( <button onClick={() => onStartWork(liveUnit)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"><Zap size={18} fill="white" /> Mulai Pekerjaan</button> )}
                                 {liveUnit.status === 'menginap' && (!liveUnit.mechanicName || liveUnit.mechanicName === user.name) && ( <button onClick={() => onStartWork(liveUnit)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-2"><Zap size={18} fill="white" /> Lanjutkan Pekerjaan</button> )}
                                 {liveUnit.status === 'working' && liveUnit.mechanicName === user.name && ( <button onClick={() => onComplete(liveUnit)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle size={18} /> Selesai Pekerjaan</button> )}
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
      `}</style>
      </div>
   );
};

export default DisplayBoard;