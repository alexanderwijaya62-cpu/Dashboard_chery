import React, { useState, useEffect } from 'react';
import { Settings, Save, Clock, Calendar } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { db } from '../utils/dbClient';

export default function BookingSettings() {
  const [slotCount, setSlotCount] = useState(4);
  const [gapMinutes, setGapMinutes] = useState(30);
  const [startHour, setStartHour] = useState(8);
  const [startMin, setStartMin] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await db.select('booking', { select: 'namaCustomer, tipeMobil, vin', eq: { id: 999999 }, maybeSingle: true });
        if (data) {
          const c = parseInt(data.namaCustomer);
          const g = parseInt(data.tipeMobil);
          if (!isNaN(c) && c > 0) setSlotCount(c);
          if (!isNaN(g) && g > 0) setGapMinutes(g);
          if (data.vin) {
            const parts = data.vin.split(':');
            const sh = parseInt(parts[0]);
            const sm = parseInt(parts[1]);
            const sc = parts.length >= 3 ? parseInt(parts[2]) : 1;
            if (!isNaN(sh) && sh >= 0 && sh < 24) setStartHour(sh);
            if (!isNaN(sm) && sm >= 0 && sm < 60) setStartMin(sm);
            if (!isNaN(sc) && sc > 0 && sc <= 20) setSlotCapacity(sc);
          }
        }
      } catch (e) {
        console.error('Gagal load settings:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (slotCount < 1 || slotCount > 50) {
      Toastify({ text: 'Slot harus 1–50', background: 'orange' }).showToast();
      return;
    }
    if (gapMinutes < 10 || gapMinutes > 240) {
      Toastify({ text: 'Gap harus 10–240 menit', background: 'orange' }).showToast();
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        namaCustomer: String(slotCount),
        tipeMobil: String(gapMinutes),
        vin: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:${slotCapacity}`,
      };
      const { data: existing } = await db.select('booking', { select: 'id', eq: { id: 999999 }, maybeSingle: true });
      if (existing) {
        await db.update('booking', payload, { eq: { id: 999999 } });
      } else {
        await db.insert('booking', { id: 999999, ...payload });
      }
      Toastify({ text: 'Pengaturan booking disimpan!', background: 'green' }).showToast();
    } catch (err) {
      Toastify({ text: `Gagal menyimpan: ${err.message}`, background: 'red' }).showToast();
    } finally {
      setIsSaving(false);
    }
  };

  const previewSlots = [];
  {
    let h = startHour, m = startMin;
    for (let i = 0; i < slotCount; i++) {
      previewSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB`);
      m += gapMinutes;
      while (m >= 60) { h += 1; m -= 60; }
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-[100vw] bg-white overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-center px-4 md:px-6 py-3 shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-lg text-white">
            <Settings size={20} />
          </div>
          <h2 className="text-lg md:text-xl font-black text-zinc-900 leading-none">Pengaturan Booking</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full">
        <div className="space-y-8">
          <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Calendar size={14} /> Konfigurasi Slot
            </h3>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">Jumlah Slot per Hari</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSlotCount(Math.max(1, slotCount - 1))}
                  className="w-12 h-12 bg-white border-2 border-zinc-200 rounded-xl font-black text-lg text-zinc-600 hover:border-black hover:text-black transition-all">−</button>
                <div className="flex-1 bg-white border-2 border-zinc-200 rounded-2xl px-6 py-3 text-center font-black text-2xl text-zinc-900">{slotCount}</div>
                <button onClick={() => setSlotCount(Math.min(50, slotCount + 1))}
                  className="w-12 h-12 bg-white border-2 border-zinc-200 rounded-xl font-black text-lg text-zinc-600 hover:border-black hover:text-black transition-all">+</button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">Jam Mulai</label>
              <div className="flex items-center gap-3">
                <select value={startHour} onChange={e => setStartHour(parseInt(e.target.value))}
                  className="flex-1 bg-white border-2 border-zinc-200 rounded-2xl px-5 py-4 text-sm font-black text-zinc-900 focus:border-black outline-none transition-all">
                  {Array.from({ length: 10 }, (_, i) => i + 6).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-lg font-black text-zinc-400">:</span>
                <select value={startMin} onChange={e => setStartMin(parseInt(e.target.value))}
                  className="flex-1 bg-white border-2 border-zinc-200 rounded-2xl px-5 py-4 text-sm font-black text-zinc-900 focus:border-black outline-none transition-all">
                  <option value={0}>00</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">Kapasitas per Slot (mobil)</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSlotCapacity(Math.max(1, slotCapacity - 1))}
                  className="w-12 h-12 bg-white border-2 border-zinc-200 rounded-xl font-black text-lg text-zinc-600 hover:border-black hover:text-black transition-all">−</button>
                <div className="flex-1 bg-white border-2 border-zinc-200 rounded-2xl px-6 py-3 text-center font-black text-2xl text-zinc-900">{slotCapacity}</div>
                <button onClick={() => setSlotCapacity(Math.min(20, slotCapacity + 1))}
                  className="w-12 h-12 bg-white border-2 border-zinc-200 rounded-xl font-black text-lg text-zinc-600 hover:border-black hover:text-black transition-all">+</button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">Gap Antar Slot</label>
              <select value={gapMinutes} onChange={e => setGapMinutes(parseInt(e.target.value))}
                className="w-full bg-white border-2 border-zinc-200 rounded-2xl px-5 py-4 text-sm font-black text-zinc-900 focus:border-black outline-none transition-all">
                <option value={15}>15 menit</option>
                <option value={30}>30 menit</option>
                <option value={45}>45 menit</option>
                <option value={60}>60 menit (1 jam)</option>
                <option value={90}>90 menit (1.5 jam)</option>
                <option value={120}>120 menit (2 jam)</option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Clock size={14} /> Preview Slot
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {previewSlots.map((s, i) => (
                <div key={i} className="bg-white border-2 border-zinc-200 rounded-xl py-3 px-2 text-center font-black text-xs text-zinc-900">
                  {s}
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold text-zinc-400">{slotCount} slot &times; {gapMinutes} menit = mulai {String(startHour).padStart(2, '0')}:{String(startMin).padStart(2, '0')} WIB &mdash; {slotCapacity} mobil per slot</p>
          </div>

          <button onClick={handleSave} disabled={isSaving}
            className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-40">
            <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
