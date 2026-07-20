import React, { useState, useEffect } from 'react';
import { Settings, Save, Clock, Calendar, Sun } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { fetchBookingConfig, saveBookingConfig, generateSlots } from '../utils/bookingConfig';

export default function BookingSettings() {
  const [slotCount, setSlotCount] = useState(4);
  const [gapMinutes, setGapMinutes] = useState(30);
  const [startHour, setStartHour] = useState(8);
  const [startMin, setStartMin] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState(1);
  const [saturdayEnabled, setSaturdayEnabled] = useState(true);
  const [satSlotCount, setSatSlotCount] = useState(4);
  const [satGapMinutes, setSatGapMinutes] = useState(30);
  const [satStartHour, setSatStartHour] = useState(8);
  const [satStartMin, setSatStartMin] = useState(0);
  const [satSlotCapacity, setSatSlotCapacity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await fetchBookingConfig();
        setSlotCount(config.slotCount);
        setGapMinutes(config.gapMinutes);
        setStartHour(config.startHour);
        setStartMin(config.startMinute);
        setSlotCapacity(config.slotCapacity);
        setSaturdayEnabled(config.saturdayEnabled);
        setSatSlotCount(config.satSlotCount);
        setSatGapMinutes(config.satGapMinutes);
        setSatStartHour(config.satStartHour);
        setSatStartMin(config.satStartMinute);
        setSatSlotCapacity(config.satSlotCapacity);
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
    if (saturdayEnabled) {
      if (satSlotCount < 1 || satSlotCount > 50) {
        Toastify({ text: 'Slot Sabtu harus 1–50', background: 'orange' }).showToast();
        return;
      }
      if (satGapMinutes < 10 || satGapMinutes > 240) {
        Toastify({ text: 'Gap Sabtu harus 10–240 menit', background: 'orange' }).showToast();
        return;
      }
    }
    setIsSaving(true);
    try {
      await saveBookingConfig({
        slotCount,
        gapMinutes,
        startHour,
        startMinute: startMin,
        slotCapacity,
        saturdayEnabled,
        satSlotCount,
        satGapMinutes,
        satStartHour,
        satStartMinute: satStartMin,
        satSlotCapacity,
      });
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

  const satPreviewSlots = [];
  {
    let h = satStartHour, m = satStartMin;
    for (let i = 0; i < satSlotCount; i++) {
      satPreviewSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB`);
      m += satGapMinutes;
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

          {/* ═══ SENIN - JUMAT ═══ */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Calendar size={14} /> Senin — Jumat
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

          {/* ═══ SENIN-JUMAT PREVIEW ═══ */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Clock size={14} /> Preview Slot — Senin s/d Jumat
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

          {/* ═══ SABTU ═══ */}
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                <Sun size={14} /> Sabtu (Special)
              </h3>
              <button onClick={() => setSaturdayEnabled(prev => !prev)}
                className={`relative w-12 h-6 rounded-full transition-all ${saturdayEnabled ? 'bg-amber-500' : 'bg-zinc-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${saturdayEnabled ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>

            {saturdayEnabled && (
              <>
                <p className="text-[9px] font-bold text-amber-700 -mt-2">Jam operasional lebih pendek: 08:00 – 14:00</p>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-amber-700">Jumlah Slot Sabtu</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSatSlotCount(Math.max(1, satSlotCount - 1))}
                      className="w-12 h-12 bg-white border-2 border-amber-200 rounded-xl font-black text-lg text-amber-700 hover:border-amber-500 transition-all">−</button>
                    <div className="flex-1 bg-white border-2 border-amber-200 rounded-2xl px-6 py-3 text-center font-black text-2xl text-amber-900">{satSlotCount}</div>
                    <button onClick={() => setSatSlotCount(Math.min(50, satSlotCount + 1))}
                      className="w-12 h-12 bg-white border-2 border-amber-200 rounded-xl font-black text-lg text-amber-700 hover:border-amber-500 transition-all">+</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-amber-700">Jam Mulai</label>
                  <div className="flex items-center gap-3">
                    <select value={satStartHour} onChange={e => setSatStartHour(parseInt(e.target.value))}
                      className="flex-1 bg-white border-2 border-amber-200 rounded-2xl px-5 py-4 text-sm font-black text-amber-900 focus:border-amber-500 outline-none transition-all">
                      {[7, 8, 9].map(h => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-lg font-black text-amber-400">:</span>
                    <select value={satStartMin} onChange={e => setSatStartMin(parseInt(e.target.value))}
                      className="flex-1 bg-white border-2 border-amber-200 rounded-2xl px-5 py-4 text-sm font-black text-amber-900 focus:border-amber-500 outline-none transition-all">
                      <option value={0}>00</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={45}>45</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-amber-700">Kapasitas per Slot (mobil)</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSatSlotCapacity(Math.max(1, satSlotCapacity - 1))}
                      className="w-12 h-12 bg-white border-2 border-amber-200 rounded-xl font-black text-lg text-amber-700 hover:border-amber-500 transition-all">−</button>
                    <div className="flex-1 bg-white border-2 border-amber-200 rounded-2xl px-6 py-3 text-center font-black text-2xl text-amber-900">{satSlotCapacity}</div>
                    <button onClick={() => setSatSlotCapacity(Math.min(20, satSlotCapacity + 1))}
                      className="w-12 h-12 bg-white border-2 border-amber-200 rounded-xl font-black text-lg text-amber-700 hover:border-amber-500 transition-all">+</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-amber-700">Gap Antar Slot</label>
                  <select value={satGapMinutes} onChange={e => setSatGapMinutes(parseInt(e.target.value))}
                    className="w-full bg-white border-2 border-amber-200 rounded-2xl px-5 py-4 text-sm font-black text-amber-900 focus:border-amber-500 outline-none transition-all">
                    <option value={15}>15 menit</option>
                    <option value={30}>30 menit</option>
                    <option value={45}>45 menit</option>
                    <option value={60}>60 menit (1 jam)</option>
                    <option value={90}>90 menit (1.5 jam)</option>
                    <option value={120}>120 menit (2 jam)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* ═══ SABTU PREVIEW ═══ */}
          {saturdayEnabled && (
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Clock size={14} /> Preview Slot — Sabtu
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {satPreviewSlots.map((s, i) => (
                  <div key={i} className="bg-white border-2 border-amber-200 rounded-xl py-3 px-2 text-center font-black text-xs text-amber-900">
                    {s}
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-amber-500">{satSlotCount} slot &times; {satGapMinutes} menit = mulai {String(satStartHour).padStart(2, '0')}:{String(satStartMin).padStart(2, '0')} WIB &mdash; {satSlotCapacity} mobil per slot</p>
            </div>
          )}

          <button onClick={handleSave} disabled={isSaving}
            className="w-full bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-40">
            <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
