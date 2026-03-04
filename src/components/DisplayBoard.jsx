import React from 'react';
import ClockDisplay from './ClockDisplay';
import { Bookmark, Zap, Car, Instagram, CheckCircle, Clock, Moon, Play, Coffee } from 'lucide-react';
import cheryLogo from '../assets/cherylogo.png';
import orientalLogo from '../assets/oriental.jpeg';
import { QRCodeSVG } from 'qrcode.react';

const DisplayBoard = ({ processedQueue, formatTime, user, onStartWork, onLogoDoubleClick, rawHistory = [] }) => {
  const isToday = (timestampStr) => {
    if (!timestampStr) return false;
    const date = new Date(!isNaN(timestampStr) ? parseInt(timestampStr) : timestampStr);
    if (isNaN(date.getTime())) return false;
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const todayCompletedQueue = rawHistory.filter(item => {
    return isToday(item.timestamp) || isToday(item.updatedAt) || isToday(item.completedAt) || isToday(item.id);
  });

  return (
    <>
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-10 px-2 sm:px-4 gap-4 sm:gap-0">
          <div className="flex items-center gap-4 sm:gap-8 transition-transform active:scale-95" onDoubleClick={onLogoDoubleClick}>
            <img src={cheryLogo} alt="Chery Logo" className="h-12 sm:h-24 object-contain" title="Double click to login" />
            <img src={orientalLogo} alt="Oriental Logo" className="h-12 sm:h-24 object-contain" />
            <div className="h-8 sm:h-14 w-[2px] bg-zinc-200"></div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Workshop Live Status</span>
              <h2 className="text-xl sm:text-4xl font-extrabold tracking-tighter text-zinc-900 leading-none">Antrian Bengkel</h2>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-md">
              <div className="text-right">
                <span className="text-xs font-black uppercase text-zinc-900 tracking-widest block">Scan Me</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight block">For Mobile App</span>
              </div>
              <div className="bg-zinc-100 p-2 rounded-xl">
                <QRCodeSVG value="https://dashboard-chery-lexxs-projects-33307765.vercel.app/" size={96} level="Q" marginSize={0} />
              </div>
            </div>
            <div className="text-center sm:text-right">
              <ClockDisplay />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Kolom Booking */}
          <div className="flex flex-col gap-4">
            <div className="bg-red-100 border-2 border-red-300 rounded-xl py-3 px-6 shadow-md flex items-center gap-3">
              <Bookmark size={24} className="text-red-600" fill="currentColor" />
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase tracking-widest leading-none">Antrian Booking</h3>
            </div>

            <div className="flex flex-col gap-4 max-h-[60vh] 2xl:max-h-[700px] overflow-y-auto pr-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
              {processedQueue.filter(i => i.category === 'Booking').map((item, index) => (
                <div
                  key={item.id}
                  className={`relative bg-white border border-red-200 ring-1 ring-red-50 rounded-[1.2rem] px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg shadow-zinc-200/40 transition-all duration-300 gap-4 sm:gap-0`}
                >
                  <div className="flex items-start sm:items-center gap-4 sm:gap-10 w-full sm:w-auto">
                    <div className="text-3xl sm:text-4xl font-black text-zinc-900 italic min-w-[40px] sm:min-w-[50px] select-none mt-1 sm:mt-0">
                      #{index + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                        <span className="px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-red-600 text-white shadow-md shadow-red-100">
                          <Bookmark size={10} fill="white" />
                          {item.category}
                        </span>
                        {item.estimasi === 0 && item.status !== 'waiting' && (
                          <span className="bg-green-500 text-white px-3 sm:px-3 py-1 sm:py-1 rounded-full text-xs sm:text-xs font-black uppercase tracking-widest animate-pulse shadow-md shadow-green-200">
                            Selesai
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter text-zinc-900 font-sans uppercase leading-none mb-1 whitespace-nowrap">
                        {item.bk}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 font-black italic uppercase tracking-tight">
                        {item.tipe}
                      </p>

                      <div className="flex flex-col items-start gap-2 mt-3">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-100/80 px-2.5 py-1.5 rounded-md border border-zinc-200">
                          SA: {item.addedBy || 'System'}
                        </span>
                        {item.mechanicName && (
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md">
                            Mekanik: {item.mechanicName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto border-t border-zinc-100 sm:border-none pt-4 sm:pt-0 mt-3 sm:mt-0 flex flex-col sm:items-end gap-3 sm:gap-0">
                    {(user?.role === 'mekanik' && (!item.status || item.status === 'waiting' || (item.status === 'menginap' && (!item.mechanicName || item.mechanicName === user?.name)))) && (
                      <div className="mb-0 sm:mb-4 w-full sm:w-auto">
                        <button
                          onClick={() => onStartWork(item)}
                          className="w-full sm:w-auto bg-zinc-900 hover:bg-black text-white px-5 sm:px-6 py-4 sm:py-4 rounded-xl font-black text-xs sm:text-xs uppercase tracking-widest transition-all shadow-md shadow-zinc-200 active:scale-95 flex justify-center items-center gap-2"
                        >
                          {item.status === 'menginap' ? <><Play size={16} fill="currentColor" /> Mengerjakan Kembali</> : <><Zap size={16} fill="currentColor" /> Mulai Kerjakan</>}
                        </button>
                      </div>
                    )}

                    {item.status === 'working' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        {item.estimasi === 0 ? (
                          <span className="bg-orange-100 text-orange-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                            Menunggu Konfirmasi
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                            Pengerjaan Sejak {(() => {
                              const stMs = parseInt(item.targetTime) - (parseInt(item.estimasiDefault) * 1000);
                              return !isNaN(stMs) ? new Date(stMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                    {item.status === 'menginap' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        <span className="bg-purple-100 text-purple-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                          <Moon size={14} fill="currentColor" /> Menginap
                        </span>
                      </div>
                    )}
                    {item.status === 'istirahat' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        <span className="bg-amber-100 text-amber-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                          <Coffee size={14} fill="currentColor" /> Waktu Istirahat
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto bg-zinc-50/50 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none border border-zinc-100 sm:border-none">
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1 block">
                          Masuk
                        </span>
                        <div className="text-[10px] sm:text-xs font-bold text-zinc-400 mb-0.5">
                          {new Date(parseInt(item.id)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tighter leading-none text-blue-600">
                          {new Date(parseInt(item.id)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                      </div>

                      <div className="w-[1px] h-10 bg-zinc-200 block sm:hidden"></div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1 block">
                          Sisa Estimasi
                        </span>
                        {(!item.status || item.status === 'waiting') ? (
                          <div className="text-sm sm:text-xl font-black tracking-tighter leading-none text-orange-600 uppercase mt-1 sm:mt-1 border border-orange-200 bg-orange-50 px-2 sm:px-2 py-1 sm:py-1.5 rounded-lg border-dashed inline-block">
                            Menunggu
                          </div>
                        ) : item.status === 'menginap' ? (
                          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none text-purple-600">
                            {formatTime(item.estimasiDefault)}
                          </div>
                        ) : item.status === 'istirahat' ? (
                          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none text-amber-600">
                            {formatTime(item.estimasiDefault)}
                          </div>
                        ) : (
                          <div className={`text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none ${item.estimasi < 300 && item.estimasi > 0 ? 'text-red-600 animate-pulse' : item.estimasi === 0 ? 'text-green-500' : 'text-zinc-900'}`}>
                            {formatTime(item.estimasi)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {processedQueue.filter(i => i.category === 'Booking').length === 0 && (
                <div className="bg-white border-2 border-dashed border-red-100 rounded-[1.2rem] p-16 text-center">
                  <Bookmark size={40} className="mx-auto mb-3 text-red-100" />
                  <h3 className="text-xl font-bold text-red-200 uppercase tracking-widest">Tidak Ada Booking</h3>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Reguler */}
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-100 border-2 border-zinc-300 rounded-xl py-3 px-6 shadow-md flex items-center gap-3">
              <Car size={24} className="text-zinc-600" />
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase tracking-widest leading-none">Antrian Reguler</h3>
            </div>

            <div className="flex flex-col gap-4 max-h-[60vh] 2xl:max-h-[700px] overflow-y-auto pr-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
              {processedQueue.filter(i => i.category !== 'Booking').map((item, index) => (
                <div
                  key={item.id}
                  className={`relative bg-white border border-zinc-100 rounded-[1.2rem] px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg shadow-zinc-200/40 transition-all duration-300 gap-4 sm:gap-0`}
                >
                  <div className="flex items-start sm:items-center gap-4 sm:gap-10 w-full sm:w-auto">
                    <div className="text-3xl sm:text-4xl font-black text-zinc-900 italic min-w-[40px] sm:min-w-[50px] select-none mt-1 sm:mt-0">
                      #{index + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                        <span className="px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-zinc-100 text-zinc-600 border border-zinc-200">
                          <Zap size={10} />
                          {item.category}
                        </span>
                        {item.estimasi === 0 && item.status !== 'waiting' && (
                          <span className="bg-green-500 text-white px-3 sm:px-3 py-1 sm:py-1 rounded-full text-xs sm:text-xs font-black uppercase tracking-widest animate-pulse shadow-md shadow-green-200">
                            Selesai
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter text-zinc-900 font-sans uppercase leading-none mb-1 whitespace-nowrap">
                        {item.bk}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 font-black italic uppercase tracking-tight">
                        {item.tipe}
                      </p>

                      <div className="flex flex-col items-start gap-2 mt-3">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-100/80 px-2.5 py-1.5 rounded-md border border-zinc-200">
                          SA: {item.addedBy || 'System'}
                        </span>
                        {item.mechanicName && (
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md">
                            Mekanik: {item.mechanicName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto border-t border-zinc-100 sm:border-none pt-4 sm:pt-0 mt-3 sm:mt-0 flex flex-col sm:items-end gap-3 sm:gap-0">
                    {(user?.role === 'mekanik' && (!item.status || item.status === 'waiting' || (item.status === 'menginap' && (!item.mechanicName || item.mechanicName === user?.name)))) && (
                      <div className="mb-0 sm:mb-4 w-full sm:w-auto">
                        <button
                          onClick={() => onStartWork(item)}
                          className="w-full sm:w-auto bg-zinc-900 hover:bg-black text-white px-5 sm:px-6 py-4 sm:py-4 rounded-xl font-black text-xs sm:text-xs uppercase tracking-widest transition-all shadow-md shadow-zinc-200 active:scale-95 flex justify-center items-center gap-2"
                        >
                          {item.status === 'menginap' ? <><Play size={16} fill="currentColor" /> Mengerjakan Kembali</> : <><Zap size={16} fill="currentColor" /> Mulai Kerjakan</>}
                        </button>
                      </div>
                    )}

                    {item.status === 'working' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        {item.estimasi === 0 ? (
                          <span className="bg-orange-100 text-orange-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                            Menunggu Konfirmasi
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                            Pengerjaan Sejak {(() => {
                              const stMs = parseInt(item.targetTime) - (parseInt(item.estimasiDefault) * 1000);
                              return !isNaN(stMs) ? new Date(stMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                    {item.status === 'menginap' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        <span className="bg-purple-100 text-purple-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                          <Moon size={14} fill="currentColor" /> Menginap
                        </span>
                      </div>
                    )}
                    {item.status === 'istirahat' && (
                      <div className="mb-2 sm:mb-4 w-full sm:w-auto text-center sm:text-right">
                        <span className="bg-amber-100 text-amber-700 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm animate-pulse">
                          <Coffee size={14} fill="currentColor" /> Waktu Istirahat
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto bg-zinc-50/50 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none border border-zinc-100 sm:border-none">
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1 block">
                          Masuk
                        </span>
                        <div className="text-[10px] sm:text-xs font-bold text-zinc-400 mb-0.5">
                          {new Date(parseInt(item.id)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tighter leading-none text-blue-600">
                          {new Date(parseInt(item.id)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                      </div>

                      <div className="w-[1px] h-10 bg-zinc-200 block sm:hidden"></div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1 block">
                          Sisa Estimasi
                        </span>
                        {(!item.status || item.status === 'waiting') ? (
                          <div className="text-sm sm:text-xl font-black tracking-tighter leading-none text-orange-600 uppercase mt-1 sm:mt-1 border border-orange-200 bg-orange-50 px-2 sm:px-2 py-1 sm:py-1.5 rounded-lg border-dashed inline-block">
                            Menunggu
                          </div>
                        ) : item.status === 'menginap' ? (
                          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none text-purple-600">
                            {formatTime(item.estimasiDefault)}
                          </div>
                        ) : item.status === 'istirahat' ? (
                          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none text-amber-600">
                            {formatTime(item.estimasiDefault)}
                          </div>
                        ) : (
                          <div className={`text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tighter leading-none ${item.estimasi < 300 && item.estimasi > 0 ? 'text-red-600 animate-pulse' : item.estimasi === 0 ? 'text-green-500' : 'text-zinc-900'}`}>
                            {formatTime(item.estimasi)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {processedQueue.filter(i => i.category !== 'Booking').length === 0 && (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-[1.2rem] p-16 text-center">
                  <Car size={40} className="mx-auto mb-3 text-zinc-200" />
                  <h3 className="text-xl font-bold text-zinc-300 uppercase tracking-widest">Tidak Ada Reguler</h3>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Antrian Selesai Hari Ini */}
        <div className="mt-10 mb-4 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <div className="bg-green-100 border-2 border-green-300 rounded-xl py-3 px-4 sm:px-6 shadow-md flex items-center gap-2 sm:gap-3 w-full lg:w-max mb-6">
            <CheckCircle size={24} className="text-green-600 shrink-0" />
            <h3 className="text-base sm:text-2xl font-black text-zinc-900 uppercase tracking-widest leading-none">Antrian Yang Sudah Selesai</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[60vh] 2xl:max-h-[700px] overflow-y-auto pr-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
            {todayCompletedQueue.length > 0 ? (
              todayCompletedQueue.map((item, index) => {
                const masukDate = new Date(parseInt(item.id));
                const masukTime = !isNaN(masukDate.getTime()) ? masukDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                const masukDateFormatted = !isNaN(masukDate.getTime()) ? masukDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                // Waktu selesai
                const selesaiDateRaw = item.completedAt || item.updatedAt || item.timestamp;
                const selesaiDate = selesaiDateRaw ? new Date(!isNaN(selesaiDateRaw) ? parseInt(selesaiDateRaw) : selesaiDateRaw) : null;
                const selesaiTime = selesaiDate && !isNaN(selesaiDate.getTime()) ? selesaiDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Selesai';
                const selesaiDateFormatted = selesaiDate && !isNaN(selesaiDate.getTime()) ? selesaiDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                return (
                  <div
                    key={item.id || index}
                    className="relative bg-white border border-green-200 ring-1 ring-green-50 rounded-[1.2rem] px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg shadow-green-200/40 transition-all duration-300 gap-4 sm:gap-0"
                  >
                    <div className="flex items-start sm:items-center gap-4 sm:gap-10 w-full sm:w-auto">
                      <div className="text-3xl sm:text-4xl font-black text-green-700 italic min-w-[40px] sm:min-w-[50px] select-none mt-1 sm:mt-0">
                        #{index + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                          <span className="px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-zinc-100 text-zinc-600 border border-zinc-200">
                            {item.category === 'Booking' ? <Bookmark size={10} /> : <Zap size={10} />}
                            {item.category || 'REGULER'}
                          </span>
                          <span className="px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-green-500 text-white shadow-md shadow-green-200">
                            <CheckCircle size={10} /> SELESAI
                          </span>
                        </div>

                        <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter text-zinc-900 font-sans uppercase leading-none mb-1 whitespace-nowrap">
                          {item.bk}
                        </h3>
                        <p className="text-xs sm:text-sm text-zinc-500 font-black italic uppercase tracking-tight">
                          {item.tipe}
                        </p>

                        <div className="flex flex-col items-start gap-2 mt-3">
                          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-100/80 px-2.5 py-1.5 rounded-md border border-zinc-200">
                            SA: {item.addedBy || 'System'}
                          </span>
                          {item.mechanicName && (
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md">
                              Mekanik: {item.mechanicName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto border-t border-zinc-100 sm:border-none pt-4 sm:pt-0 mt-3 sm:mt-0 flex flex-col sm:items-end gap-3 sm:gap-0">
                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 w-full sm:w-auto bg-zinc-50/50 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none border border-zinc-100 sm:border-none">
                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1 block">
                            Masuk
                          </span>
                          <div className="text-[10px] sm:text-xs font-bold text-zinc-400 mb-0.5">
                            {masukDateFormatted}
                          </div>
                          <div className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tighter leading-none text-zinc-500">
                            {masukTime}
                          </div>
                        </div>

                        <div className="w-[1px] h-10 bg-zinc-200 block sm:hidden"></div>

                        <div className="text-right shrink-0">
                          <span className="text-[9px] sm:text-[9px] font-black uppercase tracking-widest text-green-600 mb-0.5 sm:mb-1 block">
                            Selesai
                          </span>
                          {selesaiDateFormatted !== '-' && (
                            <div className="text-[10px] sm:text-xs font-bold text-green-500 mb-0.5">
                              {selesaiDateFormatted}
                            </div>
                          )}
                          <div className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tighter leading-none text-green-600">
                            {selesaiTime}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-white border-2 border-dashed border-green-100/50 rounded-[1.2rem] p-12 text-center">
                <CheckCircle size={40} className="mx-auto mb-3 text-green-200" />
                <h3 className="text-lg font-bold text-green-300 uppercase tracking-widest">Belum Ada Selesai Hari Ini</h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Social Icons Fixed Bottom Right */}
      <div className="fixed bottom-14 sm:bottom-12 right-6 flex flex-col gap-4 z-[100]">
        <a
          href="https://www.instagram.com/cherymedan.amplas?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-3 sm:p-4 rounded-full text-white shadow-lg shadow-pink-500/30 hover:scale-110 transition-transform flex items-center justify-center group"
          title="Instagram Chery Medan Amplas"
        >
          <Instagram size={28} className="sm:w-8 sm:h-8" />
        </a>
        <a
          href="https://wa.me/628116017300"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 p-3 sm:p-4 rounded-full text-white shadow-lg shadow-green-500/30 hover:scale-110 transition-transform flex items-center justify-center group"
          title="WhatsApp Chery Medan Amplas"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" className="sm:w-8 sm:h-8">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.808-.72-1.353-1.611-1.511-1.91-.158-.298-.017-.46.132-.609.135-.133.298-.344.446-.516.149-.172.198-.297.298-.496.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
          </svg>
        </a>
      </div>
    </>
  );
};

export default DisplayBoard;