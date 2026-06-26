import React from 'react';

const TimeInput = ({ label, value, max = 99, onChange }) => (
  <div className="space-y-1 text-center group flex-1 min-w-0">
    <input type="number" min="0" max={max}
      className="w-full bg-zinc-50 border border-zinc-200 px-1 py-3 rounded-xl text-center text-xl font-black focus:bg-white focus:ring-2 focus:ring-red-50 focus:border-red-600 outline-none appearance-none transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <span className="text-[9px] font-black text-zinc-400 uppercase group-focus-within:text-red-600 transition-colors">{label}</span>
  </div>
);

export default TimeInput;