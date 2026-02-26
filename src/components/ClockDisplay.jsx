import React, { useState, useEffect } from 'react';

const ClockDisplay = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Local Time</span>
      <div className="text-[11px] font-bold text-zinc-600 uppercase tracking-tight mb-1">
        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div className="text-3xl font-black font-sans tracking-tighter text-zinc-900 tabular-nums leading-none">
        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
      </div>
    </div>
  );
};

export default ClockDisplay;