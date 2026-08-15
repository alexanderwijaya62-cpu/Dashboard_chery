import React, { useState, useEffect } from 'react';
import {
  Car, Wrench, Plus, Trash2, Edit2, CheckCircle2, AlertCircle,
  Search, ShieldCheck, DollarSign, Calculator, Layers, RefreshCw,
  ChevronRight, Save, X, Package, Calendar, Gauge, Copy, Clipboard
} from 'lucide-react';
import {
  getStoredFreeMaintenanceData,
  saveStoredFreeMaintenanceData,
  getFreeMaintenanceDataFromDB,
  saveFreeMaintenanceDataToDB,
  deleteFreeMaintenanceVehicleFromDB,
  INITIAL_VEHICLES_DATA
} from '../utils/freeMaintenanceConfig';

export default function FreeMaintenancePage() {
  const [vehicles, setVehicles] = useState(() => getStoredFreeMaintenanceData());
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'config'
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => vehicles[0]?.id || '');
  const [selectedIntervalId, setSelectedIntervalId] = useState('');

  // Fetch online data from Supabase DB on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoadingDB(true);
      const dbVehicles = await getFreeMaintenanceDataFromDB();
      if (isMounted && Array.isArray(dbVehicles) && dbVehicles.length > 0) {
        setVehicles(dbVehicles);
        if (!selectedVehicleId) setSelectedVehicleId(dbVehicles[0]?.id || '');
      }
      if (isMounted) setIsLoadingDB(false);
    })();
    return () => { isMounted = false; };
  }, []);

  // Sync state to Supabase DB & localStorage whenever vehicles state changes
  useEffect(() => {
    if (!isLoadingDB) {
      saveFreeMaintenanceDataToDB(vehicles);
    }
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId, isLoadingDB]);

  // Simulator State
  const [simVehicleId, setSimVehicleId] = useState(() => vehicles[0]?.id || '');
  const [simKm, setSimKm] = useState('');
  const [simBulan, setSimBulan] = useState('');
  const [simResult, setSimResult] = useState(null);

  // Sync simVehicleId if vehicles load from DB
  useEffect(() => {
    if (vehicles.length > 0 && !simVehicleId) {
      setSimVehicleId(vehicles[0].id);
    }
  }, [vehicles, simVehicleId]);

  // Modals / Form States
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ kode_tipe: '', nama_mobil: '', drivetrain: '', drive_layout: '' });

  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [editingInterval, setEditingInterval] = useState(null);
  const [intervalForm, setIntervalForm] = useState({ bulan: '', km: '' });

  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partForm, setPartForm] = useState({ no_part: '', nama_part: '', qty: 1, harga_claim: 0 });

  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];

  useEffect(() => {
    if (currentVehicle && currentVehicle.intervals.length > 0) {
      if (!selectedIntervalId || !currentVehicle.intervals.some(i => i.id === selectedIntervalId)) {
        setSelectedIntervalId(currentVehicle.intervals[0].id);
      }
    } else {
      setSelectedIntervalId('');
    }
  }, [currentVehicle, selectedIntervalId]);

  const currentInterval = currentVehicle?.intervals.find(i => i.id === selectedIntervalId);

  const [isSaving, setIsSaving] = useState(false);
  const [copiedParts, setCopiedParts] = useState(null);
  const [copiedFromLabel, setCopiedFromLabel] = useState('');

  const handleCopyParts = () => {
    if (!currentInterval || currentInterval.parts.length === 0) {
      alert('Tidak ada sparepart untuk disalin.');
      return;
    }
    setCopiedParts(currentInterval.parts);
    setCopiedFromLabel(`${currentVehicle.nama_mobil} (${currentInterval.label})`);
    alert(`Berhasil menyalin ${currentInterval.parts.length} sparepart dari ${currentVehicle.nama_mobil} (${currentInterval.label}).\nSilakan pilih interval/tipe mobil lain lalu klik "Tempel".`);
  };

  const handlePasteParts = async () => {
    if (!copiedParts || copiedParts.length === 0) {
      alert('Belum ada sparepart yang disalin. Salin terlebih dahulu dari interval lain.');
      return;
    }
    if (!currentInterval) return;

    let updatedParts = [...currentInterval.parts];
    if (currentInterval.parts.length > 0) {
      const mode = confirm(
        `Interval tujuan sudah memiliki ${currentInterval.parts.length} sparepart.\n\n` +
        `Klik "OK" untuk TIMPA (menghapus yang lama dan menempel yang baru).\n` +
        `Klik "Batal" (Cancel) untuk GABUNGKAN (menambahkan ke daftar yang sudah ada).`
      );
      if (mode) {
        // Timpa (overwrite)
        updatedParts = copiedParts.map(p => ({ ...p, id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
      } else {
        // Gabungkan (append)
        const newPasted = copiedParts.map(p => ({ ...p, id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
        updatedParts = [...updatedParts, ...newPasted];
      }
    } else {
      updatedParts = copiedParts.map(p => ({ ...p, id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
    }

    const updatedVehicles = vehicles.map(v => {
      if (v.id !== currentVehicle.id) return v;
      return {
        ...v,
        intervals: v.intervals.map(i => {
          if (i.id !== currentInterval.id) return i;
          return { ...i, parts: updatedParts };
        })
      };
    });

    setVehicles(updatedVehicles);
    await saveFreeMaintenanceDataToDB(updatedVehicles);
  };

  // --- VEHICLE ACTIONS ---
  const handleOpenVehicleModal = (v = null) => {
    if (v) {
      setEditingVehicle(v);
      setVehicleForm({ kode_tipe: v.kode_tipe, nama_mobil: v.nama_mobil, drivetrain: v.drivetrain || '', drive_layout: v.drive_layout || '' });
    } else {
      setEditingVehicle(null);
      setVehicleForm({ kode_tipe: '', nama_mobil: '', drivetrain: '', drive_layout: '' });
    }
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const kode = vehicleForm.kode_tipe.trim();
    const nama = vehicleForm.nama_mobil.trim();
    if (!kode || !nama) return;

    // Check duplicate kode_tipe when adding new vehicle
    if (!editingVehicle) {
      const isDuplicate = vehicles.some(v => v.kode_tipe.toLowerCase() === kode.toLowerCase());
      if (isDuplicate) {
        alert(`Kode Tipe "${kode}" sudah terdaftar dalam sistem. Silakan gunakan Kode Tipe lain.`);
        return;
      }
    }

    setIsSaving(true);
    let updatedVehicles;
    if (editingVehicle) {
      updatedVehicles = vehicles.map(v => v.id === editingVehicle.id ? { ...v, kode_tipe: kode, nama_mobil: nama, drivetrain: vehicleForm.drivetrain, drive_layout: vehicleForm.drive_layout } : v);
    } else {
      const nowTs = Date.now();
      const defaultIntervals = [
        { id: `int-${nowTs}-1`, bulan: 1, km: 1000, label: '1.000 KM / 1 Bulan', parts: [] },
        { id: `int-${nowTs}-2`, bulan: 3, km: 5000, label: '5.000 KM / 3 Bulan', parts: [] },
        { id: `int-${nowTs}-3`, bulan: 6, km: 5000, label: '5.000 KM / 6 Bulan', parts: [] },
        { id: `int-${nowTs}-4`, bulan: 12, km: 15000, label: '15.000 KM / 1 Tahun', parts: [] },
        { id: `int-${nowTs}-5`, bulan: 24, km: 30000, label: '30.000 KM / 2 Tahun', parts: [] },
        { id: `int-${nowTs}-6`, bulan: 36, km: 45000, label: '45.000 KM / 3 Tahun', parts: [] },
        { id: `int-${nowTs}-7`, bulan: 48, km: 60000, label: '60.000 KM / 4 Tahun', parts: [] },
      ];

      const newV = {
        id: `vm-${nowTs}`,
        kode_tipe: kode,
        nama_mobil: nama,
        drivetrain: vehicleForm.drivetrain,
        drive_layout: vehicleForm.drive_layout,
        intervals: defaultIntervals
      };
      updatedVehicles = [...vehicles, newV];
      setSelectedVehicleId(newV.id);
    }

    setVehicles(updatedVehicles);
    setShowVehicleModal(false);
    setVehicleForm({ kode_tipe: '', nama_mobil: '', drivetrain: '', drive_layout: '' });

    try {
      await saveFreeMaintenanceDataToDB(updatedVehicles);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus tipe mobil ini?')) {
      setIsSaving(true);
      try {
        const updatedVehicles = await deleteFreeMaintenanceVehicleFromDB(id, vehicles);
        setVehicles(updatedVehicles);
        if (selectedVehicleId === id) {
          setSelectedVehicleId(updatedVehicles[0]?.id || '');
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  // --- INTERVAL ACTIONS ---
  const handleOpenIntervalModal = (int = null) => {
    if (!currentVehicle) return;
    if (int) {
      setEditingInterval(int);
      setIntervalForm({ bulan: int.bulan, km: int.km });
    } else {
      setEditingInterval(null);
      setIntervalForm({ bulan: '', km: '' });
    }
    setShowIntervalModal(true);
  };

  const handleSaveInterval = async (e) => {
    e.preventDefault();
    if (!currentVehicle) return;
    const kmNum = Number(intervalForm.km);
    const bulanNum = Number(intervalForm.bulan);
    if (!kmNum || !bulanNum) return;

    const label = `${kmNum.toLocaleString('id-ID')} KM / ${bulanNum >= 12 ? (bulanNum / 12) + ' Tahun' : bulanNum + ' Bulan'}`;

    setIsSaving(true);
    let updatedVehicles;
    if (editingInterval) {
      updatedVehicles = vehicles.map(v => {
        if (v.id !== currentVehicle.id) return v;
        return {
          ...v,
          intervals: v.intervals.map(i => i.id === editingInterval.id ? { ...i, km: kmNum, bulan: bulanNum, label } : i)
        };
      });
    } else {
      const newInt = {
        id: `int-${Date.now()}`,
        km: kmNum,
        bulan: bulanNum,
        label,
        parts: []
      };
      updatedVehicles = vehicles.map(v => {
        if (v.id !== currentVehicle.id) return v;
        return {
          ...v,
          intervals: [...v.intervals, newInt].sort((a, b) => a.km - b.km)
        };
      });
      setSelectedIntervalId(newInt.id);
    }

    setVehicles(updatedVehicles);
    setShowIntervalModal(false);
    setIntervalForm({ bulan: '', km: '' });

    try {
      await saveFreeMaintenanceDataToDB(updatedVehicles);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInterval = async (intId) => {
    if (!confirm('Apakah Anda yakin menghapus interval ini?')) return;
    setIsSaving(true);
    const updatedVehicles = vehicles.map(v => {
      if (v.id !== currentVehicle.id) return v;
      return { ...v, intervals: v.intervals.filter(i => i.id !== intId) };
    });
    setVehicles(updatedVehicles);
    try {
      await saveFreeMaintenanceDataToDB(updatedVehicles);
    } finally {
      setIsSaving(false);
    }
  };

  // --- PART ACTIONS ---
  const handleOpenPartModal = (part = null) => {
    if (!currentInterval) return;
    if (part) {
      setEditingPart(part);
      setPartForm({ no_part: part.no_part, nama_part: part.nama_part, qty: part.qty, harga_claim: part.harga_claim });
    } else {
      setEditingPart(null);
      setPartForm({ no_part: '', nama_part: '', qty: 1, harga_claim: 0 });
    }
    setShowPartModal(true);
  };

  const handleSavePart = async (e) => {
    e.preventDefault();
    if (!currentInterval || !partForm.nama_part.trim()) return;

    setIsSaving(true);
    let updatedVehicles;
    if (editingPart) {
      updatedVehicles = vehicles.map(v => {
        if (v.id !== currentVehicle.id) return v;
        return {
          ...v,
          intervals: v.intervals.map(i => {
            if (i.id !== currentInterval.id) return i;
            return {
              ...i,
              parts: i.parts.map(p => p.id === editingPart.id ? { ...p, ...partForm, qty: Number(partForm.qty), harga_claim: Number(partForm.harga_claim) } : p)
            };
          })
        };
      });
    } else {
      const newPart = {
        id: `part-${Date.now()}`,
        ...partForm,
        qty: Number(partForm.qty),
        harga_claim: Number(partForm.harga_claim)
      };
      updatedVehicles = vehicles.map(v => {
        if (v.id !== currentVehicle.id) return v;
        return {
          ...v,
          intervals: v.intervals.map(i => {
            if (i.id !== currentInterval.id) return i;
            return { ...i, parts: [...i.parts, newPart] };
          })
        };
      });
    }

    setVehicles(updatedVehicles);
    setShowPartModal(false);
    setPartForm({ no_part: '', nama_part: '', qty: 1, harga_claim: 0 });

    try {
      await saveFreeMaintenanceDataToDB(updatedVehicles);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePart = async (partId) => {
    const updatedVehicles = vehicles.map(v => {
      if (v.id !== currentVehicle.id) return v;
      return {
        ...v,
        intervals: v.intervals.map(i => {
          if (i.id !== currentInterval.id) return i;
          return { ...i, parts: i.parts.filter(p => p.id !== partId) };
        })
      };
    });
    setVehicles(updatedVehicles);
    await saveFreeMaintenanceDataToDB(updatedVehicles);
  };

  const handleRefreshDB = async () => {
    setIsLoadingDB(true);
    const dbVehicles = await getFreeMaintenanceDataFromDB();
    if (Array.isArray(dbVehicles)) {
      setVehicles(dbVehicles);
      if (dbVehicles.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(dbVehicles[0].id);
      }
    }
    setIsLoadingDB(false);
  };

  // --- SIMULATOR LOGIC ---
  const handleCalculateSimulation = (e) => {
    e.preventDefault();
    const v = vehicles.find(item => item.id === simVehicleId);
    if (!v) return;

    const kmInput = simKm ? Number(simKm) : null;
    const bulanInput = simBulan ? Number(simBulan) : null;

    if (kmInput === null && bulanInput === null) {
      alert('Masukkan setidaknya KM Odometer atau Usia Bulan kendaraan.');
      return;
    }

    // Find matched interval (closest lower or equal)
    let matchedInterval = null;
    const sortedIntervals = [...v.intervals].sort((a, b) => b.km - a.km); // descending

    for (const int of sortedIntervals) {
      const matchByKm = kmInput !== null && kmInput >= int.km;
      const matchByBulan = bulanInput !== null && bulanInput >= int.bulan;
      if (matchByKm || matchByBulan) {
        matchedInterval = int;
        break;
      }
    }

    if (!matchedInterval && sortedIntervals.length > 0) {
      // If below smallest interval
      matchedInterval = sortedIntervals[sortedIntervals.length - 1];
    }

    setSimResult({
      vehicle: v,
      matchedInterval,
      inputKm: kmInput,
      inputBulan: bulanInput
    });
  };

  const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-zinc-50">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 text-white rounded-xl shadow-md">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-zinc-900 tracking-tight">Free Maintenance Warranty</h1>
              <p className="text-xs text-zinc-500 font-medium">Manajemen interval service gratis, sparepart & simulasi klaim warranty</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Calculator size={14} /> Simulasi & Cek
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'config'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Wrench size={14} /> Kelola Config Admin
            </button>
          </div>

          <button
            onClick={handleRefreshDB}
            title="Refresh Data dari Database Supabase"
            disabled={isLoadingDB}
            className="p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoadingDB ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ─── TAB 1: SIMULATOR & CEK MAINTENANCE ────────────────────── */}
        {activeTab === 'simulator' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Input Card */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100">
                <Gauge className="text-zinc-900" size={18} />
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Form Cek Kelayakan Free Maintenance</h2>
              </div>

              <form onSubmit={handleCalculateSimulation} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1.5">Tipe / Model Mobil</label>
                  <select
                    value={simVehicleId}
                    onChange={e => setSimVehicleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-medium text-zinc-900"
                  >
                    {vehicles.map(v => {
                      const spec = [v.drivetrain, v.drive_layout].filter(Boolean).join(' ');
                      return (
                        <option key={v.id} value={v.id}>
                          {v.nama_mobil} ({v.kode_tipe}){spec ? ` - ${spec}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1.5">Stand Odometer (KM)</label>
                  <input
                    type="number"
                    value={simKm}
                    onChange={e => setSimKm(e.target.value)}
                    placeholder="Contoh: 30000"
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-medium text-zinc-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1.5">Usia Mobil (Bulan)</label>
                  <input
                    type="number"
                    value={simBulan}
                    onChange={e => setSimBulan(e.target.value)}
                    placeholder="Contoh: 24 (2 Tahun)"
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-medium text-zinc-900"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-5 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Search size={15} /> Hitung Paket Service
                  </button>
                </div>
              </form>
            </div>

            {/* Result Display */}
            {simResult && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                      Hasil Deteksi Paket Maintenance
                    </span>
                    <h2 className="text-2xl font-black text-zinc-900 mt-2">
                      {simResult.vehicle.nama_mobil} <span className="text-base text-zinc-400 font-mono">({simResult.vehicle.kode_tipe})</span>
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium mt-1">
                      Penggerak: <span className="font-bold text-zinc-700">{simResult.vehicle.drivetrain} {simResult.vehicle.drive_layout}</span> |
                      Pencapaian: <span className="font-bold text-zinc-700">{simResult.inputKm ? `${Number(simResult.inputKm).toLocaleString('id-ID')} KM` : '-'}</span> / <span className="font-bold text-zinc-700">{simResult.inputBulan ? `${simResult.inputBulan} Bulan` : '-'}</span>
                    </p>
                  </div>

                  {simResult.matchedInterval && (
                    <div className="bg-zinc-900 text-white p-4 rounded-2xl text-right min-w-[200px]">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Estimasi Paket Service</p>
                      <p className="text-lg font-black text-amber-400 mt-0.5">{simResult.matchedInterval.label}</p>
                    </div>
                  )}
                </div>

                {simResult.matchedInterval ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                        <Package size={14} /> Daftar Sparepart Gratis yang Didapatkan
                      </h3>
                      <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full">
                        {simResult.matchedInterval.parts.length} Item Sparepart
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200">
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">No. Part</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Nama Sparepart</th>
                            <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Quantity</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Harga Claim / Unit</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Subtotal Claim</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {simResult.matchedInterval.parts.map((p, idx) => {
                            const subtotal = (p.qty || 0) * (p.harga_claim || 0);
                            return (
                              <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-zinc-600 font-bold">{p.no_part || '-'}</td>
                                <td className="px-4 py-3 font-medium text-zinc-900">{p.nama_part}</td>
                                <td className="px-4 py-3 text-center font-bold text-zinc-800">{p.qty}</td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatRupiah(p.harga_claim)}</td>
                                <td className="px-4 py-3 text-right font-bold font-mono text-xs text-zinc-900">{formatRupiah(subtotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-zinc-900 text-white font-bold">
                            <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wider">Total Nilai Claim Maintenance:</td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-amber-400">
                              {formatRupiah(
                                simResult.matchedInterval.parts.reduce((sum, item) => sum + (item.qty * item.harga_claim), 0)
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <AlertCircle className="mx-auto text-amber-500 mb-2" size={24} />
                    <p className="text-sm font-bold text-amber-900">Belum ada paket interval maintenance yang terdaftar untuk tipe mobil ini.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: CONFIGURATOR ADMIN ────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Panel: Vehicle Models List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Car size={16} className="text-zinc-900" />
                    <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900">Tipe / Model Mobil</h2>
                  </div>
                  <button
                    onClick={() => handleOpenVehicleModal()}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <Plus size={13} /> Tambah Mobil
                  </button>
                </div>

                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {vehicles.map(v => {
                    const isSel = v.id === selectedVehicleId;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVehicleId(v.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSel
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-md'
                            : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm">{v.nama_mobil}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSel ? 'bg-zinc-800 text-amber-400 border border-zinc-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                {v.kode_tipe}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 ${isSel ? 'text-zinc-300' : 'text-zinc-500'}`}>
                              {[v.drivetrain, v.drive_layout].filter(Boolean).join(' · ') || 'Tipe Mobil'} | {v.intervals.length} Interval Service
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenVehicleModal(v); }}
                              className={`p-1.5 rounded-lg transition-colors ${isSel ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500'}`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(v.id); }}
                              className={`p-1.5 rounded-lg transition-colors ${isSel ? 'hover:bg-zinc-800 text-red-400' : 'hover:bg-zinc-100 text-red-500'}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel: Selected Vehicle Interval & Parts Configurator */}
            <div className="lg:col-span-8 space-y-5">
              {currentVehicle ? (
                <>
                  {/* Vehicle Header Info */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Sedang Dikelola</span>
                      <h2 className="text-xl font-black text-zinc-900 mt-0.5">
                        {currentVehicle.nama_mobil} <span className="font-mono text-zinc-400">({currentVehicle.kode_tipe})</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                        Drivetrain: <span className="font-bold text-zinc-800">{currentVehicle.drivetrain || '-'}</span> | Layout: <span className="font-bold text-zinc-800">{currentVehicle.drive_layout || '-'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenIntervalModal()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                      <Plus size={14} /> Tambah Interval Maintenance
                    </button>
                  </div>

                  {/* Interval Tabs */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        <Calendar size={14} /> Interval Maintenance
                      </h3>
                      {currentInterval && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenIntervalModal(currentInterval)}
                            className="px-2.5 py-1 text-xs font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors flex items-center gap-1"
                          >
                            <Edit2 size={12} /> Edit Interval
                          </button>
                          <button
                            onClick={() => handleDeleteInterval(currentInterval.id)}
                            className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Hapus
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Interval Pill Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {currentVehicle.intervals.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">Belum ada interval service. Klik tombol "Tambah Interval Maintenance" di atas.</p>
                      ) : (
                        currentVehicle.intervals.map(int => {
                          const isSel = int.id === selectedIntervalId;
                          return (
                            <button
                              key={int.id}
                              onClick={() => setSelectedIntervalId(int.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                isSel
                                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                                  : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                              }`}
                            >
                              {int.label}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Parts Table under current interval */}
                    {currentInterval && (
                      <div className="pt-4 border-t border-zinc-100 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-zinc-700">
                              Sparepart Gratis untuk Interval <span className="text-zinc-900 underline font-black">{currentInterval.label}</span>
                            </span>
                            {copiedFromLabel && (
                              <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                Clipboard: Tersalin {copiedParts?.length || 0} item dari {copiedFromLabel}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={handleCopyParts}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                              title="Salin semua item sparepart di interval ini"
                            >
                              <Copy size={12} /> Salin Item
                            </button>
                            <button
                              type="button"
                              onClick={handlePasteParts}
                              disabled={!copiedParts}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Tempel item yang disalin ke interval ini"
                            >
                              <Clipboard size={12} /> Tempel Item
                            </button>
                            <button
                              onClick={() => handleOpenPartModal()}
                              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                              <Plus size={12} /> Tambah Sparepart
                            </button>
                          </div>
                        </div>

                        {currentInterval.parts.length === 0 ? (
                          <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                            <Package className="mx-auto text-zinc-300 mb-2" size={28} />
                            <p className="text-xs font-bold text-zinc-500">Belum ada sparepart di interval ini.</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Klik "Tambah Sparepart & Harga Claim" untuk memasukkan item.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-zinc-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-zinc-50 border-b border-zinc-200">
                                  <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">No. Part</th>
                                  <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">Nama Sparepart</th>
                                  <th className="text-center px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">Qty</th>
                                  <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">Harga Claim/Unit</th>
                                  <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">Subtotal</th>
                                  <th className="w-20"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {currentInterval.parts.map(p => {
                                  const subtotal = (p.qty || 0) * (p.harga_claim || 0);
                                  return (
                                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600 font-bold">{p.no_part || '-'}</td>
                                      <td className="px-4 py-2.5 text-zinc-900 font-medium text-xs">{p.nama_part}</td>
                                      <td className="px-4 py-2.5 text-center font-bold text-xs text-zinc-800">{p.qty}</td>
                                      <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-600">{formatRupiah(p.harga_claim)}</td>
                                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-zinc-900">{formatRupiah(subtotal)}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handleOpenPartModal(p)}
                                            className="p-1 text-zinc-400 hover:text-zinc-900 rounded"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleDeletePart(p.id)}
                                            className="p-1 text-zinc-400 hover:text-red-600 rounded"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 font-medium text-sm">
                  Pilih tipe mobil di panel sebelah kiri.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: ADD / EDIT VEHICLE TYPE ────────────────────────────── */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                {editingVehicle ? 'Edit Tipe Mobil' : 'Tambah Tipe Mobil Baru'}
              </h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Kode Tipe Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: T19"
                  value={vehicleForm.kode_tipe}
                  onChange={e => setVehicleForm({ ...vehicleForm, kode_tipe: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Nama Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Omoda 5"
                  value={vehicleForm.nama_mobil}
                  onChange={e => setVehicleForm({ ...vehicleForm, nama_mobil: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Drivetrain <span className="text-zinc-400 font-normal">(Opsional)</span></label>
                  <select
                    value={vehicleForm.drivetrain}
                    onChange={e => setVehicleForm({ ...vehicleForm, drivetrain: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                  >
                    <option value="">- Kosong -</option>
                    <option value="4x2">4x2</option>
                    <option value="4x4">4x4</option>
                    <option value="AWD">AWD</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Layout <span className="text-zinc-400 font-normal">(Opsional)</span></label>
                  <select
                    value={vehicleForm.drive_layout}
                    onChange={e => setVehicleForm({ ...vehicleForm, drive_layout: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                  >
                    <option value="">- Kosong -</option>
                    <option value="FWD">FWD</option>
                    <option value="IWD">IWD</option>
                    <option value="RWD">RWD</option>
                    <option value="AWD">AWD</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ADD / EDIT INTERVAL ────────────────────────────── */}
      {showIntervalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                {editingInterval ? 'Edit Interval Maintenance' : 'Tambah Interval Maintenance'}
              </h3>
              <button onClick={() => setShowIntervalModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInterval} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Batas KM Odometer</label>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 30000"
                  value={intervalForm.km}
                  onChange={e => setIntervalForm({ ...intervalForm, km: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Batas Usia (Bulan)</label>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 24"
                  value={intervalForm.bulan}
                  onChange={e => setIntervalForm({ ...intervalForm, bulan: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowIntervalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD / EDIT SPAREPART & CLAIM PRICE ────────────────── */}
      {showPartModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                {editingPart ? 'Edit Sparepart Free Maintenance' : 'Tambah Sparepart & Harga Claim'}
              </h3>
              <button onClick={() => setShowPartModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePart} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">No. Part (Nomor Sparepart)</label>
                <input
                  type="text"
                  placeholder="Contoh: 1012010AA"
                  value={partForm.no_part}
                  onChange={e => setPartForm({ ...partForm, no_part: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Nama Sparepart</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Filter Oli (Oil Filter)"
                  value={partForm.nama_part}
                  onChange={e => setPartForm({ ...partForm, nama_part: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Quantity (Jumlah)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    value={partForm.qty}
                    onChange={e => setPartForm({ ...partForm, qty: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Harga Claim / Unit (Rp)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={partForm.harga_claim}
                    onChange={e => setPartForm({ ...partForm, harga_claim: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowPartModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
