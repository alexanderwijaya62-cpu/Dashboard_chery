import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import {
  Users,
  Car,
  Clock,
  TrendingUp,
  Download,
  LogOut,
  Award,
  BarChart3,
  Filter,
  Search,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Calendar,
  AlertCircle,
  X,
  ArrowLeft,
  DollarSign,
  PieChart,
  BarChart4,
  Package,
  Wrench,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';

const GAS_URL = "/api/gas_revenue";
const CRO_GAS_URL = "https://script.google.com/macros/s/AKfycbwf0QGS_vN7QKVX8b5R-VIQuGRRhKRnLoMGDIu-h-TJJkXfQFdsfmYA9nyDYJRgdfMvBQ/exec";
const API_KEY = import.meta.env.VITE_API_KEY || "chery-secret-key-2024";

const customFetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "x-api-key": API_KEY,
    },
  });
};

const formatHMS = (seconds) => {
  if (!seconds || seconds <= 0) return "0 detik";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let res = "";
  if (h > 0) res += h + "j ";
  if (m > 0) res += m + "m ";
  if (s > 0 || res === "") res += s + "d";
  return res;
};

const ManagerPanel = ({ user, handleLogout, queue, rawHistory }) => {
  const [activeTab, setActiveTab] = useState('performance');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('thisMonth');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [Worksheet, setWorksheet] = useState([]);
  const [croData, setCroData] = useState([]);
  const [entityFilter, setEntityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMode, setChartMode] = useState('all'); // all, jasa, part

  const parseDateToTimestamp = (val) => {
    if (!val) return 0;
    const d = isNaN(val) ? new Date(val) : new Date(parseInt(val));
    return d.getTime();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  const getMonthName = (monthIdx) => {
    const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    return names[monthIdx];
  };

  const normalizeDateStr = (val) => {
    if (!val) return '';
    try {
      if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        // Google Sheets US Locale membajak format DD/MM/YYYY menjadi MM/DD/YYYY jika DD <= 12
        // Kembalikan ke yang benar dengan menukar day dan month
        const originalDay = String(val.getUTCMonth() + 1).padStart(2, '0');
        const originalMonth = String(val.getUTCDate()).padStart(2, '0');
        return `${val.getUTCFullYear()}-${originalMonth}-${originalDay}`;
      }
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569.0) * 86400 * 1000));
        // Sama dengan Date, tukar M dan D
        const originalDay = String(d.getUTCMonth() + 1).padStart(2, '0');
        const originalMonth = String(d.getUTCDate()).padStart(2, '0');
        return `${d.getUTCFullYear()}-${originalMonth}-${originalDay}`;
      }

      let str = String(val).trim();

      // Jika dari sistem GAS dengan format ISO string (e.g., 2025-12-31T17:00:00.000Z)
      if (str.includes('T') && str.includes('Z')) {
        const dObj = new Date(str);
        if (!isNaN(dObj.getTime())) {
          const originalDay = String(dObj.getMonth() + 1).padStart(2, '0');
          const originalMonth = String(dObj.getDate()).padStart(2, '0');
          return `${dObj.getFullYear()}-${originalMonth}-${originalDay}`;
        }
      }

      // Jika bentuknya text standard dari Excel (1/1/2026 atau 2026-01-01)
      str = str.split(' ')[0]; // hapus bagian jam (jika dipisah spasi)
      if (str.includes('/') || str.includes('-')) {
        const p = str.split(/[\/\-]+/);
        if (p.length >= 3) {
          const yearIdx = p.findIndex(x => x.length === 4);
          if (yearIdx !== -1) {
            const y = p[yearIdx];
            const m = yearIdx === 0 ? p[1] : p[1];
            const d = yearIdx === 0 ? p[2] : p[0];
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }

      const fallbackDate = new Date(str);
      if (!isNaN(fallbackDate.getTime())) {
        return `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
      }
      return str;
    } catch (e) {
      return String(val);
    }
  };

  const formatDisplayDate = (val) => {
    if (!val) return '---';
    const norm = normalizeDateStr(val);
    if (!norm) return String(val).split('T')[0];
    const p = norm.split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return norm;
  };

  const filteredHistory = useMemo(() => {
    if (timeFilter === 'all') return rawHistory;
    let startLimit = new Date();
    startLimit.setHours(0, 0, 0, 0);
    if (timeFilter === 'thisMonth') {
      startLimit.setDate(1);
    } else if (timeFilter === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return rawHistory.filter(item => {
        const timestamp = parseDateToTimestamp(item.completedAt || item.updatedAt || item.id);
        return timestamp >= start.getTime() && timestamp <= end.getTime();
      });
    }
    return rawHistory.filter(item => {
      const timestamp = parseDateToTimestamp(item.completedAt || item.updatedAt || item.id);
      return timestamp >= startLimit.getTime();
    });
  }, [rawHistory, timeFilter, customRange]);

  const stats = useMemo(() => {
    const totalHandled = filteredHistory.length;
    const workingNow = queue.filter(q => q.status === 'working').length;
    const overnightCount = queue.filter(q => q.status === 'menginap').length;
    const complaintsMap = {};
    filteredHistory.forEach(item => {
      const complaint = item.deskripsi || 'Servis Rutin';
      complaintsMap[complaint] = (complaintsMap[complaint] || 0) + 1;
    });
    const topComplaint = Object.entries(complaintsMap).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
    return { totalHandled, workingNow, overnightCount, topComplaint: topComplaint[0] };
  }, [filteredHistory, queue]);

  const mechanicLeaderboard = useMemo(() => {
    const mechMap = {};
    filteredHistory.forEach(item => {
      if (!item.mechanicName) return;
      const name = item.mechanicName;
      if (!mechMap[name]) mechMap[name] = { name, count: 0, totalTime: 0, countWithTime: 0, dailyCounts: {} };
      mechMap[name].count += 1;
      const start = parseDateToTimestamp(item.id);
      const end = parseDateToTimestamp(item.completedAt);
      if (start > 0 && end > 0) {
        mechMap[name].totalTime += (end - start);
        mechMap[name].countWithTime += 1;
      }
      const dateKey = new Date(parseDateToTimestamp(item.completedAt || item.id)).toDateString();
      mechMap[name].dailyCounts[dateKey] = (mechMap[name].dailyCounts[dateKey] || 0) + 1;
    });
    return Object.values(mechMap).map(m => {
      const maxDaily = Math.max(...Object.values(m.dailyCounts), 0);
      const avgTime = m.countWithTime > 0 ? (m.totalTime / m.countWithTime) / 1000 : 0;
      return { ...m, maxDaily, avgTimeFormatted: formatHMS(avgTime) };
    }).sort((a, b) => b.count - a.count);
  }, [filteredHistory]);

  const adminLeaderboard = useMemo(() => {
    const adminMap = {};
    filteredHistory.forEach(item => {
      const name = item.addedBy || 'Sistem';
      if (!adminMap[name]) adminMap[name] = { name, count: 0 };
      adminMap[name].count += 1;
    });
    queue.forEach(item => {
      const name = item.addedBy || 'Sistem';
      if (!adminMap[name]) adminMap[name] = { name, count: 0 };
      adminMap[name].count += 1;
    });
    return Object.values(adminMap).sort((a, b) => b.count - a.count);
  }, [filteredHistory, queue]);

  const vehicleLeaderboard = useMemo(() => {
    const carMap = {};
    filteredHistory.forEach(item => {
      const bk = item.bk;
      if (!carMap[bk]) carMap[bk] = { bk, tipe: item.tipe, count: 0 };
      carMap[bk].count += 1;
    });
    return Object.values(carMap)
      .filter(c => c.bk.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  }, [filteredHistory, searchTerm]);

  const fetchWorksheet = async () => {
    try {
      const resp = await customFetch(`${GAS_URL}?action=get_workshop&_=${Date.now()}`);
      const result = await resp.json();
      if (result && Array.isArray(result.data)) setWorksheet(result.data);
    } catch (e) { console.error(e); }
  };

  const fetchCroData = async () => {
    try {
      const resp = await fetch(CRO_GAS_URL);
      const data = await resp.json();
      if (Array.isArray(data)) setCroData(data);
    } catch (e) { console.error("CRO Fetch Error:", e); }
  };

  useEffect(() => {
    fetchWorksheet();
    fetchCroData();
    const interval = setInterval(() => {
      fetchWorksheet();
      fetchCroData();
    }, 20000); // Polling 20 detik
    return () => clearInterval(interval);
  }, []);

  const handleWorkshopUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws);
        const processed = rawRows.map(row => {
          const norm = {};
          // Normalize: remove dots, spaces to underscore, lowercase
          Object.keys(row).forEach(k => {
            const cleanKey = k.toLowerCase().trim()
              .replace(/\./g, '') // remove dots
              .replace(/\s+/g, '_'); // spaces to underscore
            norm[cleanKey] = row[k];
          });

          const wktMasuk = norm.wktmasuk || norm.wkt_masuk || norm.tanggal || norm.waktu || '';
          const lc = parseFloat(norm.lc || 0);
          const oli = parseFloat(norm.oli || 0);
          const sm = parseFloat(norm.sm || 0);
          const so = parseFloat(norm.so || 0);
          const s_part = parseFloat(norm.spart || norm.s_part || norm.sparepart || 0);
          const penjualan = parseFloat(norm.penjualan || (lc + oli + sm + so));
          const total = parseFloat(norm.total || (penjualan + s_part));
          const ppn = parseFloat(norm.ppn || (total * 0.11));
          const g_total = parseFloat(norm.gtotal || norm.g_total || (total + ppn));

          return {
            no_wo: norm.nowo || norm.no_wo || norm.no_order || '',
            tipe_kendaraan: norm.kendaraan || norm.tipekendaraan || norm.tipe_kendaraan || norm.tipe || '',
            sa: norm.sa || '',
            mekanik: norm.mekanik || '',
            leader: norm.leader || '',
            wkt_masuk: wktMasuk,
            jasa: penjualan,
            s_part,
            g_total
          };
        }).filter(r => r.no_wo);
        const resp = await customFetch(`${GAS_URL}`, {
          method: "POST",
          body: JSON.stringify({ action: 'add_workshop', data: processed })
        });
        const res = await resp.json();
        if (res.status === 'success') {
          Toastify({ text: `Berhasil mengunggah ${processed.length} data laporan!`, background: "green" }).showToast();
          fetchWorksheet();
        } else throw new Error(res.message);
      } catch (err) {
        Toastify({ text: "Error: " + err.message, background: "red" }).showToast();
      } finally {
        setIsLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredFinancialData = useMemo(() => {
    let startLimit = new Date();
    startLimit.setHours(0, 0, 0, 0);
    let endLimit = new Date();
    endLimit.setHours(23, 59, 59, 999);
    if (timeFilter === 'thisMonth') {
      startLimit.setDate(1);
    } else if (timeFilter === 'custom' && customRange.start && customRange.end) {
      startLimit = new Date(customRange.start);
      endLimit = new Date(customRange.end);
      endLimit.setHours(23, 59, 59, 999);
    }
    return Worksheet.filter(item => {
      const itemDate = new Date(normalizeDateStr(item.wkt_masuk));
      const matchesDate = timeFilter === 'all' || (itemDate >= startLimit && itemDate <= endLimit);

      const woString = (item.no_wo || '').toLowerCase();
      const matchesEntity = entityFilter === 'all' || woString.includes(entityFilter.toLowerCase());

      const matchesSearch = !searchTerm ||
        woString.includes(searchTerm.toLowerCase()) ||
        item.tipe_kendaraan.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDate && matchesEntity && matchesSearch;
    });
  }, [Worksheet, timeFilter, customRange, searchTerm, entityFilter]);

  const financialSummary = useMemo(() => {
    return filteredFinancialData.reduce((acc, curr) => {
      acc.jasa += curr.jasa;
      acc.s_part += curr.s_part;
      acc.grandTotal += curr.g_total;
      return acc;
    }, { jasa: 0, s_part: 0, grandTotal: 0 });
  }, [filteredFinancialData]);

  const monthlyChartData = useMemo(() => {
    const dataMap = {};
    const yr = parseInt(chartYear);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Inisialisasi ALL 12 MONTHS dengan 0 agar grafik terlihat dari Jan ke Des (full year)
    for (let m = 0; m < 12; m++) {
      dataMap[`${monthNames[m]} ${yr}`] = 0;
    }

    Worksheet.forEach(item => {
      // Cek filter entity & pencarian (agar chart sync dengan table)
      const woString = (item.no_wo || '').toLowerCase();
      if (entityFilter !== 'all' && !woString.includes(entityFilter.toLowerCase())) return;
      if (searchTerm && !woString.includes(searchTerm.toLowerCase()) && !(item.tipe_kendaraan || '').toLowerCase().includes(searchTerm.toLowerCase())) return;

      const d = normalizeDateStr(item.wkt_masuk);
      if (!d) return;

      const dateObj = new Date(d);
      // Hanya memproses bulan yang sesuai dengan chartYear yang dipilih
      if (isNaN(dateObj.getTime()) || dateObj.getFullYear() !== yr) return;

      // Ambil nama bulan
      const monthLabel = `${monthNames[dateObj.getMonth()]} ${yr}`;

      const val = chartMode === 'jasa' ? (item.jasa || 0) : chartMode === 'part' ? (item.s_part || 0) : (item.g_total || 0);
      dataMap[monthLabel] += val;
    });

    // Mengembalikan array yang memetakan bulan secara kaku dari Januari ke Desember
    return monthNames.map(m => {
      const label = `${m} ${yr}`;
      return { x: label, y: dataMap[label] };
    });
  }, [Worksheet, chartMode, chartYear, searchTerm, entityFilter]);

  const apexChartOptions = {
    chart: {
      type: 'area',
      stacked: false,
      height: 400,
      zoom: { type: 'x', enabled: true, autoScaleYaxis: true },
      toolbar: { autoSelected: 'zoom', show: true },
      fontFamily: 'Inter, sans-serif',
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    colors: ['#ef4444'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 4 },
    markers: { size: 0, hover: { size: 7 } },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.6,
        opacityTo: 0.05,
        stops: [0, 95, 100]
      },
    },
    yaxis: {
      labels: {
        formatter: (val) => `Rp ${(val / 1000000).toFixed(0)} Jt`,
        style: { fontWeight: 900, colors: '#71717a' }
      },
      title: { text: 'Revenue (dalam Juta)', style: { fontWeight: 900 } },
    },
    xaxis: {
      type: 'category',
      labels: {
        style: { fontWeight: 900, colors: '#71717a' }
      },
      tooltip: { enabled: false }
    },
    tooltip: {
      shared: true,
      x: { show: true },
      y: { formatter: (val) => formatCurrency(val) },
      theme: 'dark'
    },
    grid: { borderColor: '#f4f4f5', strokeDashArray: 4 }
  };

  const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleExportPerformance = () => {
    const mechData = mechanicLeaderboard.map(m => ({ "Tipe": "MEKANIK", "Nama": m.name, "Total Handle": m.count, "Paling Banyak Sehari": m.maxDaily, "Rata-rata Waktu": m.avgTimeFormatted }));
    const adminData = adminLeaderboard.map(a => ({ "Tipe": "ADMIN", "Nama": a.name, "Total Input": a.count, "Paling Banyak Sehari": "-", "Rata-rata Waktu": "-" }));
    exportToExcel([...mechData, ...adminData], "Laporan_Kinerja_Tim");
  };

  const handleExportVehicles = () => {
    const data = vehicleLeaderboard.map(v => ({ "Nomor Plat": v.bk, "Tipe Mobil": v.tipe, "Jumlah Kedatangan": v.count }));
    exportToExcel(data, "Laporan_Frekuensi_Kendaraan");
  };

  return (
    <div className="relative w-screen h-screen bg-[#F2F2F7] overflow-hidden font-sans">
      {/* Floating Hover Sidebar Container */}
      <div className="fixed left-0 top-0 h-full w-[280px] z-[100] group/nav pointer-events-none">
        {/* Hover Handle - A transparent zone that triggers the reveal */}
        <div className="absolute left-0 top-0 h-full w-8 bg-transparent pointer-events-auto z-0 group-hover/nav:w-full transition-all duration-300"></div>

        {/* Real Sidebar Content */}
        <aside className="absolute left-0 top-0 h-full w-full bg-white border-r-2 border-zinc-200 flex flex-col -translate-x-[276px] group-hover/nav:translate-x-0 transition-transform duration-500 ease-in-out shadow-[30px_0_80px_rgba(0,0,0,0.05)] pointer-events-auto">
          {/* Subtle Visual Indicator when hidden */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-20 bg-zinc-900/10 rounded-full group-hover/nav:opacity-0 transition-opacity"></div>

          <div className="p-8 border-b border-zinc-100">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-zinc-900 rounded-2xl text-white shadow-lg"><ShieldCheck size={28} strokeWidth={2.5} /></div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">DASHBOARD <span className="text-red-600">HUB</span></h1>
                <p className="text-[11px] uppercase font-bold text-zinc-400 tracking-widest mt-1">Management Panel</p>
              </div>
            </div>
            <div className="bg-[#F2F2F7] p-5 rounded-2xl border border-zinc-200/50">
              <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1 tracking-widest font-sans">Login: Admin Access</p>
              <p className="font-black text-zinc-900 truncate text-sm italic uppercase tracking-tight">{user?.name}</p>
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-2 font-bold text-xs overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[11px] font-bold uppercase text-zinc-400 tracking-widest mb-4 mt-6">Manajemen & Audit</p>
            {[
              { id: 'performance', icon: BarChart4, label: 'Kinerja Tim' },
              { id: 'financial', icon: TrendingUp, label: 'Laporan Revenue' },
              { id: 'vehicles', icon: Car, label: 'Data Kendaraan' },
              { id: 'cro_history', icon: Users, label: 'Riwayat CRO' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-4 px-6 py-[18px] rounded-2xl transition-all duration-300 group/btn ${activeTab === tab.id ? 'bg-zinc-900 text-white shadow-xl scale-[1.02]' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                <div className={`p-2 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white' : 'bg-zinc-50 text-zinc-400 group-hover/btn:bg-white group-hover/btn:text-zinc-900'}`}><tab.icon size={19} strokeWidth={activeTab === tab.id ? 2.5 : 2} /></div>
                <span className={`font-black uppercase italic tracking-tighter text-[13.5px] ${activeTab === tab.id ? 'opacity-100' : 'opacity-70 group-hover/btn:opacity-100'}`}>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="p-6 mt-auto border-t border-zinc-50">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 rounded-3xl bg-red-50 text-red-600 font-bold text-[12px] uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all shadow-sm">
              <LogOut size={16} /> Logout System
            </button>
          </div>
        </aside>
      </div>

      {/* Main Full-Screen Layout */}
      <main className="w-screen h-screen overflow-hidden bg-[#F2F2F7] flex flex-col">
        <div className="lg:hidden flex justify-between items-center p-5 bg-white border-b border-zinc-200 sticky top-0 z-20">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase italic">MANAGEMENT PANEL</h1>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 bg-zinc-900 text-white rounded-xl shadow-lg"><Filter size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-16">
          <div className="w-full space-y-16">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
              <div className="animate-in">
                <h2 className="text-6xl sm:text-8xl font-black italic uppercase tracking-tighter text-zinc-900 leading-[0.85] mb-4">
                  {activeTab === 'performance' ? 'Kinerja Tim' : activeTab === 'financial' ? 'Aliran Pendapatan' : activeTab === 'vehicles' ? 'Data Kendaraan' : 'Riwayat CRO'}
                </h2>
                <p className="text-zinc-500 font-bold uppercase tracking-[0.4em] text-xs sm:text-sm ml-2">Dashboard Management Real-time</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[2rem] border border-zinc-200 shadow-xl w-full xl:w-auto shrink-0 transition-all">
                {['thisMonth', 'all', 'custom'].map((f) => (
                  <button key={f} onClick={() => setTimeFilter(f)} className={`px-7 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap italic ${timeFilter === f ? 'bg-zinc-900 text-white shadow-2xl scale-[1.05]' : 'text-zinc-500 hover:text-zinc-900'}`}>
                    {f === 'thisMonth' ? 'Bulan Ini' : f === 'all' ? 'Semua' : 'Kustom Range'}
                  </button>
                ))}
              </div>
              {activeTab === 'financial' && (
                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                  <div className="flex bg-zinc-200/50 p-1.5 rounded-2xl border border-zinc-200">
                    {['all', 'EUR', 'IFS', 'IKC'].map(ent => (
                      <button key={ent} onClick={() => setEntityFilter(ent)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all italic ${entityFilter === ent ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-700'}`}>
                        {ent === 'all' ? 'SEMUA ENTITAS' : ent}
                      </button>
                    ))}
                  </div>
                  <input type="file" id="import-btn-header" className="hidden" accept=".xlsx, .xls" onChange={handleWorkshopUpload} />
                  <label htmlFor="import-btn-header" className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-pointer shadow-xl hover:bg-black hover:scale-[1.02] transition-all flex items-center gap-2.5">
                    <Upload size={18} /> Import WO
                  </label>
                </div>
              )}
            </div>

            {timeFilter === 'custom' && (
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-wrap items-center gap-6 animate-in font-bold uppercase">
                {['start', 'end'].map(key => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-zinc-400 ml-1 tracking-widest">{key === 'start' ? 'FROM DATE' : 'TO DATE'}</label>
                    <input type="date" value={customRange[key]} onChange={e => setCustomRange(prev => ({ ...prev, [key]: e.target.value }))} className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-zinc-900 transition-all" />
                  </div>
                ))}
              </div>
            )}

            {activeTab !== 'cro_history' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { l: activeTab === 'financial' ? 'Jasa Service' : 'Unit Selesai', v: activeTab === 'financial' ? formatCurrency(financialSummary.jasa) : stats.totalHandled, i: Zap, c: 'text-blue-600', b: 'bg-blue-50' },
                  { l: activeTab === 'financial' ? 'Sparepart' : 'Working', v: activeTab === 'financial' ? formatCurrency(financialSummary.s_part) : stats.workingNow, i: Package, c: 'text-orange-600', b: 'bg-orange-50' },
                  { l: activeTab === 'financial' ? 'Total Omset' : 'Menginap', v: activeTab === 'financial' ? formatCurrency(financialSummary.grandTotal) : stats.overnightCount, i: DollarSign, c: 'text-emerald-600', b: 'bg-emerald-50' },
                  { l: activeTab === 'financial' ? 'Total WO' : 'Top Complain', v: activeTab === 'financial' ? filteredFinancialData.length : stats.topComplaint.substring(0, 15) + '..', i: BarChart4, c: 'text-purple-600', b: 'bg-purple-50' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-white p-5 sm:p-7 rounded-3xl border border-zinc-200 shadow-sm hover:translate-y-[-2px] transition-all duration-300 flex flex-col gap-5 group">
                    <div className={`w-12 h-12 ${s.b} ${s.c} rounded-2xl flex items-center justify-center shadow-sm group-hover:rotate-3 transition-transform`}><s.i size={24} strokeWidth={2.5} /></div>
                    <div>
                      <p className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider mb-1">{s.l}</p>
                      <p className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight leading-none italic">{s.v}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="grid grid-cols-1 gap-12 animate-in pb-12">
                <div className="bg-white p-8 sm:p-12 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4 pt-4"><Award className="text-yellow-500" size={36} /> Papan Peringkat Mekanik</h3>
                    <button onClick={handleExportPerformance} className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-black transition-all group">
                      <Download size={16} /> Ekspor Laporan
                    </button>
                  </div>
                  <div className="flex items-end justify-center gap-4 sm:gap-12 mb-16 px-4">
                    {mechanicLeaderboard[1] && (
                      <div className="flex flex-col items-center flex-1 max-w-[130px] group/pod">
                        <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-2xl font-black text-zinc-400 border-2 border-white shadow-md mb-6 transition-transform group-hover/pod:-translate-y-1">{mechanicLeaderboard[1].name[0]}</div>
                        <div className="w-full bg-zinc-50 border border-zinc-100 rounded-t-3xl p-6 text-center h-[160px] flex flex-col justify-center">
                          <p className="text-[10px] font-bold uppercase text-zinc-900 mb-1 truncate">{mechanicLeaderboard[1].name.split(' ')[0]}</p>
                          <p className="text-4xl font-black text-zinc-500 italic">0{mechanicLeaderboard[1].count}</p>
                        </div>
                      </div>
                    )}
                    {mechanicLeaderboard[0] && (
                      <div className="flex flex-col items-center flex-1 max-w-[160px] group/pod scale-110">
                        <div className="relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 drop-shadow-lg"><Award size={40} /></div>
                          <div className="w-20 h-20 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center text-4xl font-black text-white border-2 border-white shadow-xl mb-8 transition-transform group-hover/pod:-translate-y-2">{mechanicLeaderboard[0].name[0]}</div>
                        </div>
                        <div className="w-full bg-white border border-zinc-200 rounded-t-[2.5rem] p-8 text-center h-[220px] shadow-lg flex flex-col justify-center">
                          <p className="text-[11px] font-bold uppercase text-zinc-900 mb-1 truncate">{mechanicLeaderboard[0].name.split(' ')[0]}</p>
                          <p className="text-6xl font-black text-zinc-900 italic leading-none">{mechanicLeaderboard[0].count}</p>
                        </div>
                      </div>
                    )}
                    {mechanicLeaderboard[2] && (
                      <div className="flex flex-col items-center flex-1 max-w-[130px] group/pod">
                        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl font-black text-orange-400 border-2 border-white shadow-md mb-6 transition-transform group-hover/pod:-translate-y-1">{mechanicLeaderboard[2].name[0]}</div>
                        <div className="w-full bg-orange-50/20 border border-orange-100 rounded-t-3xl p-6 text-center h-[140px] flex flex-col justify-center">
                          <p className="text-[10px] font-bold uppercase text-zinc-900 mb-1 truncate">{mechanicLeaderboard[2].name.split(' ')[0]}</p>
                          <p className="text-4xl font-black text-orange-400 italic">0{mechanicLeaderboard[2].count}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    {mechanicLeaderboard.slice(3, 11).map((m, i) => (
                      <div key={i} className="group bg-zinc-50 border border-zinc-100 rounded-2xl p-5 flex justify-between items-center hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold text-zinc-300">#{i + 4}</span>
                          <span className="text-[11px] font-bold text-zinc-900 tracking-tight uppercase">{m.name.split(' ')[0]}</span>
                        </div>
                        <span className="text-xl font-black text-zinc-400 group-hover:text-zinc-900 transition-colors tabular-nums italic">{m.count > 9 ? m.count : `0${m.count}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'financial' && (
              <div className="space-y-12 animate-in pb-20">
                <div className="bg-white p-10 sm:p-14 rounded-[4rem] border-2 border-zinc-200 shadow-2xl relative overflow-hidden group">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-16 gap-8 relative z-10">
                    <div>
                      <h3 className="text-4xl font-black italic text-zinc-900 flex items-center gap-6">
                        <TrendingUp className="text-red-500" strokeWidth={4} size={40} /> Tren Pendapatan Tahunan
                      </h3>
                      <p className="text-xs font-black uppercase text-zinc-500 tracking-[0.3em] mt-3">Rangkuman Kinerja Bengkel {chartYear}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Year Selector */}
                      <div className="flex bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200 shadow-inner">
                        {[2024, 2025, 2026].map(y => (
                          <button key={y} onClick={() => setChartYear(y)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${chartYear === y ? 'bg-white text-zinc-900 shadow-md scale-[1.05]' : 'text-zinc-400 hover:text-zinc-600'}`}>{y}</button>
                        ))}
                      </div>

                      {/* Mode Selector */}
                      <div className="flex bg-zinc-900 p-2 rounded-2xl shadow-2xl">
                        {[
                          { id: 'all', label: 'SEMUA' },
                          { id: 'jasa', label: 'JASA ONLY' },
                          { id: 'part', label: 'PART ONLY' }
                        ].map(m => (
                          <button key={m.id} onClick={() => setChartMode(m.id)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all italic ${chartMode === m.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>{m.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full h-[420px] z-10">
                    {monthlyChartData.length === 0 || monthlyChartData.every(d => d[1] === 0) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-[3rem] text-zinc-200 font-black italic uppercase tracking-[1em] p-12 text-center leading-loose">Data belum tersedia... silakan import data</div>
                    ) : (
                      <Chart
                        options={apexChartOptions}
                        series={[{
                          name: chartMode === 'jasa' ? 'Jasa Service' : chartMode === 'part' ? 'Sparepart Bengkel' : 'Total Revenue',
                          data: monthlyChartData
                        }]}
                        type="area"
                        height="100%"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center gap-12 mt-16 font-black text-xs uppercase tracking-[0.4em] text-zinc-800 relative z-10 italic">
                    <div className="flex items-center gap-4"><div className="w-5 h-5 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div> Jasa Service</div>
                    <div className="flex items-center gap-4"><div className="w-5 h-5 bg-orange-600 rounded-full shadow-lg shadow-orange-200"></div> Sparepart Bengkel</div>
                    <div className="flex items-center gap-4"><div className="w-10 h-1 bg-red-500 rounded-full shadow-lg shadow-red-200"></div> Tren Kumulatif</div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[500px]">
                  <div className="p-8 border-b border-zinc-100 bg-zinc-50/20 flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Transaksi Workshop</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Data audit operasional</p>
                    </div>
                    <div className="relative w-full xl:w-auto">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari WO atau Plat..." className="pl-14 pr-6 py-3.5 bg-white border border-zinc-200 rounded-2xl text-[13px] font-bold focus:ring-1 focus:ring-zinc-900 transition-all w-full xl:min-w-[400px] uppercase shadow-sm" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-bold text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-[10px] text-zinc-500 border-b border-zinc-100 uppercase tracking-widest font-black italic">
                          <th className="px-8 py-5">Kendaraan / Order</th>
                          <th className="px-8 py-5">Teknisi / SA</th>
                          <th className="px-8 py-5 text-right text-blue-600 underline">Biaya Jasa</th>
                          <th className="px-8 py-5 text-right text-orange-600 underline">Biaya Part</th>
                          <th className="px-8 py-5 text-right text-zinc-900">Total Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {filteredFinancialData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-zinc-50/50 transition-all group font-black italic uppercase">
                            <td className="px-8 py-8">
                              <p className="text-[16px] text-zinc-900 tracking-tighter">{row.no_wo || 'N/A'}</p>
                              <p className="text-[11px] text-zinc-400 mt-2 font-black">{formatDisplayDate(row.wkt_masuk)}</p>
                            </td>
                            <td className="px-8 py-8">
                              <p className="text-[15px] text-zinc-900 tracking-tight">{row.tipe_kendaraan || 'GENERAL SERVICE'}</p>
                              <p className="text-[11px] text-zinc-400 mt-2">Penerima SA: {row.sa || '---'}</p>
                            </td>
                            <td className="px-8 py-8 text-right text-blue-600 font-black text-lg tabular-nums">{formatCurrency(row.jasa)}</td>
                            <td className="px-8 py-8 text-right text-orange-600 font-black text-lg tabular-nums">{formatCurrency(row.s_part)}</td>
                            <td className="px-8 py-8 text-right font-black text-xl text-zinc-900 border-l border-zinc-50">{formatCurrency(row.g_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vehicles' && (
              <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden animate-in mb-20">
                <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row justify-between items-center gap-10">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter">Database Frekuensi Kendaraan</h3>
                  <div className="relative group">
                    <Search size={22} className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-zinc-900" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Masukkan No Plat..." className="pl-18 pr-10 py-6 bg-white border-2 border-zinc-200 rounded-[2rem] text-sm font-black focus:border-zinc-900 w-full md:min-w-[450px] shadow-sm uppercase italic" />
                  </div>
                </div>
                <div className="p-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 font-black uppercase italic">
                    {vehicleLeaderboard.slice(0, 18).map((car, i) => (
                      <div key={i} onClick={() => setSelectedVehicle(car.bk)} className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[3.5rem] p-12 hover:border-zinc-900 hover:bg-white hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] transition-all cursor-pointer group transform hover:-translate-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-12 relative z-10">
                          <div className="w-16 h-16 bg-zinc-900 text-white rounded-[1.2rem] flex items-center justify-center text-xl shadow-2xl italic">#{i + 1}</div>
                          <div className="px-6 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] shadow-lg tracking-widest border border-zinc-800">{car.count} KUNJUNGAN</div>
                        </div>
                        <p className="text-4xl tracking-tighter mb-1 leading-none italic relative z-10 font-black">{car.bk}</p>
                        <p className="text-[11px] text-zinc-400 tracking-[0.4em] relative z-10">{car.tipe}</p>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-zinc-100/50 rounded-full group-hover:bg-zinc-900/5 transition-colors"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cro_history' && (
              <div className="space-y-10 animate-in pb-20">
                <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden min-h-[600px]">
                  <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-10">
                    <div>
                      <h3 className="text-3xl font-black italic uppercase tracking-tighter">Riwayat Follow Up Customer</h3>
                      <p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] mt-2 italic">Data hasil respon customer CRO</p>
                    </div>
                    <div className="relative w-full xl:w-auto overflow-hidden rounded-[2rem] group">
                      <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
                      <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari Nama, Plat, atau Respon..." className="pl-18 pr-10 py-6 bg-white border-2 border-zinc-200 rounded-[2rem] text-sm font-black focus:border-zinc-900 transition-all w-full xl:min-w-[600px] uppercase shadow-sm" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {/* Desktop Table View */}
                    <table className="hidden md:table w-full text-left font-black uppercase italic">
                      <thead>
                        <tr className="bg-zinc-100/30 text-[10px] text-zinc-600 tracking-[0.2em] border-b border-zinc-200 uppercase font-black italic">
                          <th className="px-12 py-8">Customer / Kendaraan</th>
                          <th className="px-12 py-8 text-center text-blue-600">Status</th>
                          <th className="px-12 py-8">Hasil Respon</th>
                          <th className="px-12 py-8">Lampiran Foto</th>
                          <th className="px-12 py-8 text-right underline">Tgl Follow Up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-zinc-50/50">
                        {croData.filter(x => (x.status || '').toLowerCase() === 'sudah' && (
                          (x.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (x.plat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (x.respon || '').toLowerCase().includes(searchTerm.toLowerCase())
                        )).slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-zinc-50/80 transition-all duration-300 font-black italic uppercase group">
                            <td className="px-12 py-10">
                              <p className="text-[17px] text-zinc-900 tracking-tighter leading-none">{row.nama || '---'}</p>
                              <p className="text-[11px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">{row.plat || '---'}</p>
                            </td>
                            <td className="px-12 py-10 text-center">
                              <span className="bg-green-600 text-white px-8 py-3 rounded-2xl text-[11px] font-black shadow-xl shadow-green-100 italic tracking-[0.2em] border-2 border-green-500">TERHUBUNG</span>
                            </td>
                            <td className="px-12 py-10">
                              <div className="text-[15px] bg-red-50/30 p-6 rounded-3xl border-l-4 border-red-500 max-w-lg italic text-zinc-800 leading-relaxed shadow-sm">
                                "{row.respon || "Belum ada catatan diagnosa..."}"
                              </div>
                            </td>
                            <td className="px-12 py-10">
                              {row.lampiran ? (
                                <div onClick={() => setPreviewImage(row.lampiran)} className="w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 border-white shadow-2xl rotate-3 cursor-pointer hover:scale-110 hover:rotate-0 transition-all shadow-zinc-400 group-hover:shadow-red-500/20">
                                  <img src={row.lampiran} className="w-full h-full object-cover" alt="attachment" />
                                </div>
                              ) : <span className="text-zinc-200 uppercase font-bold text-[10px] tracking-widest">No Visual</span>}
                            </td>
                            <td className="px-12 py-10 text-right" style={{ whiteSpace: 'nowrap' }}>
                              <span className="bg-zinc-900 text-white px-8 py-4 rounded-[1.2rem] text-[12px] shadow-2xl tabular-nums inline-block border border-zinc-700">{row.tanggalFollowUp || "-"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y-2 divide-zinc-100">
                      {croData.filter(x => (x.status || '').toLowerCase() === 'sudah' && (
                        (x.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (x.plat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (x.respon || '').toLowerCase().includes(searchTerm.toLowerCase())
                      )).slice(0, 30).map((row, i) => (
                        <div key={i} className="p-8 space-y-6 font-black uppercase italic">
                          <div className="flex justify-between items-start text-black">
                            <div className="flex-1">
                              <p className="text-xl tracking-tighter leading-none">{row.nama}</p>
                              <p className="text-[11px] text-zinc-400 mt-2 tracking-widest">{row.plat}</p>
                            </div>
                            <span className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] shadow-xl">{row.tanggalFollowUp}</span>
                          </div>
                          <div className="bg-red-50/30 p-6 rounded-3xl border-l-4 border-red-500 text-[14px] text-zinc-800 leading-relaxed shadow-inner italic">
                            "{row.respon || "Tidak ada respon diagnosa..."}"
                          </div>
                          {row.lampiran && (
                            <img src={row.lampiran} onClick={() => setPreviewImage(row.lampiran)} className="w-full h-56 object-cover rounded-[2rem] border-4 border-white cursor-pointer shadow-2xl" alt="attachment mobile" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isLoading && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[20px] z-[500] flex items-center justify-center">
          <div className="bg-zinc-900 text-white px-16 py-10 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 border-2 border-zinc-800 animate-pulse">
            <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-red-500 animate-spin"></div>
            <span className="text-[11px] font-black uppercase tracking-[0.5em] italic text-red-100">Sinkronisasi Matriks Data...</span>
          </div>
        </div>
      )}

      {selectedVehicle && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-3xl" onClick={() => setSelectedVehicle(null)}></div>
          <div className="bg-white w-full max-w-5xl rounded-[5rem] shadow-3xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in border-4 border-white">
            <div className="p-16 border-b-2 border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-10">
                <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl"><Car size={48} /></div>
                <div>
                  <h3 className="text-6xl font-black italic tracking-tighter leading-none mb-3 underline decoration-red-500 underline-offset-8 decoration-4">{selectedVehicle}</h3>
                  <p className="text-[12px] font-black uppercase text-zinc-400 tracking-[0.5em] mt-4">Audit Riwayat Servis Kendaraan</p>
                </div>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="w-20 h-20 border-2 border-zinc-200 rounded-[2rem] hover:bg-black hover:text-white transition-all flex items-center justify-center shadow-xl group">
                <X size={36} className="group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-16 custom-scrollbar font-black uppercase italic">
              <div className="space-y-10">
                {filteredHistory.filter(h => h.bk === selectedVehicle).sort((a, b) => b.id - a.id).map((v, i) => (
                  <div key={i} className="bg-zinc-50 border-2 border-zinc-100 rounded-[3.5rem] p-12 flex flex-col md:flex-row items-center gap-16 group hover:bg-white transition-all hover:shadow-2xl hover:border-zinc-300">
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-400 mb-3 tracking-[0.3em] font-black underline underline-offset-4 decoration-zinc-100">Waktu Kedatangan</p>
                      <p className="text-3xl tracking-tighter text-zinc-900 font-black">{new Date(parseDateToTimestamp(v.id)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-[12px] text-zinc-400 mb-2 tracking-[0.3em] font-black italic underline underline-offset-4 decoration-zinc-100">Personel Yang Bertanggung Jawab</p>
                      <p className="text-sm font-black">Mekanik Lead: <span className="text-blue-600">{v.mechanicName || 'N/A'}</span></p>
                      <p className="text-sm font-black text-zinc-500">Admin Input: {v.addedBy || 'CORE_SYSTEM'}</p>
                    </div>
                    <div className="shrink-0"><span className="bg-zinc-900 text-white px-10 py-5 rounded-[1.8rem] text-[11px] shadow-2xl tracking-[0.4em] border-2 border-zinc-700">TERVERIFIKASI</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-12 border-t-2 border-zinc-100 text-center uppercase tracking-[1em] text-[11px] font-black text-zinc-300 bg-zinc-50/50 italic animate-pulse">Integritas Data Terjamin</div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-10 animate-in">
          <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-2xl" onClick={() => setPreviewImage(null)}></div>
          <div className="relative z-10 bg-white p-2 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.7)] border-4 border-white/20 overflow-hidden transform transition-all hover:scale-[1.01]">
            <img src={previewImage} className="max-w-full max-h-[85vh] rounded-[3rem] h-auto object-contain block shadow-2xl" alt="full preview" />
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #F8F9FC; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #18181b; border-radius: 10px; }
        @keyframes slideUp { from { transform: translateY(60px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-in { animation: slideUp 1s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
      `}</style>
    </div >
  );
};

export default ManagerPanel;
