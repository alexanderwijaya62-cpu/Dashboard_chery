import React from 'react';
import ClockDisplay from './ClockDisplay';
import { Bookmark, Zap, Car } from 'lucide-react';
import cheryLogo from '../assets/chery.png';

const DisplayBoard = ({ processedQueue, formatTime }) => {
  return (
    <div className="p-6 max-w-[1100px] mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-10 px-4">
        <div className="flex items-center gap-8">
          <img src={cheryLogo} alt="Chery Logo" className="h-24 object-contain" />
          <div className="h-14 w-[2px] bg-zinc-200"></div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Workshop Live Status</span>
            <h2 className="text-4xl font-extrabold tracking-tighter text-zinc-900 leading-none">Antrean Bengkel</h2>
          </div>
        </div>
        <div className="text-right">
          <ClockDisplay />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {processedQueue.map((item, index) => (
          <div 
            key={item.id} 
            className={`relative bg-white border ${item.category === 'Booking' ? 'border-red-200 ring-1 ring-red-50' : 'border-zinc-100'} rounded-[1.2rem] px-8 py-4 flex justify-between items-center shadow-lg shadow-zinc-200/40 transition-all duration-300`}
          >
            <div className="flex items-center gap-10">
              <div className="text-5xl font-black text-zinc-900 italic min-w-[60px] select-none">
                #{index + 1}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${item.category === 'Booking' ? 'bg-red-600 text-white shadow-md shadow-red-100' : 'bg-zinc-100 text-zinc-400 border border-zinc-200'}`}>
                    {item.category === 'Booking' ? <Bookmark size={10} fill="white" /> : <Zap size={10} />}
                    {item.category}
                  </span>
                  {item.estimasi === 0 && (
                    <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                      Selesai
                    </span>
                  )}
                </div>
                <h3 className="text-5xl font-black tracking-tighter text-zinc-900 font-sans uppercase leading-none">
                  {item.bk}
                </h3>
                <p className="text-base text-zinc-700 font-black italic mt-1 uppercase tracking-tight">
                  {item.tipe}
                </p>
                <p className="text-[10px] font-bold text-red-600/70 mt-1 uppercase tracking-widest">
                  Service Advisor: {item.addedBy || 'System'}
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Estimasi Selesai</span>
              <div className={`text-6xl font-black tabular-nums tracking-tighter leading-none ${item.estimasi < 300 && item.estimasi > 0 ? 'text-red-600 animate-pulse' : item.estimasi === 0 ? 'text-green-500' : 'text-zinc-900'}`}>
                {formatTime(item.estimasi)}
              </div>
            </div>
          </div>
        ))}

        {processedQueue.length === 0 && (
          <div className="bg-white border-2 border-dashed border-zinc-200 rounded-[1.2rem] p-24 text-center">
            <Car size={48} className="mx-auto mb-4 text-zinc-100" />
            <h3 className="text-2xl font-bold text-zinc-200 uppercase tracking-widest">Tidak Ada Antrean</h3>
          </div>
        )}
      </div>
      
      <div className="text-center mt-6">
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em]">
          Powered by <span className="text-zinc-900">CHERY Service Indonesia</span>
        </p>
      </div>
    </div>
  );
};

export default DisplayBoard;