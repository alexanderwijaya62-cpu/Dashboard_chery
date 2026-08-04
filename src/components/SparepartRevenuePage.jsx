import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, DollarSign, Package, ShoppingBag, BarChart4, 
  Calendar, RefreshCw, AlertCircle, Users, ChevronLeft, ChevronRight, Search, FileDown, Filter
} from 'lucide-react';
import { db } from '../utils/dbClient';
import ReactApexChart from 'react-apexcharts';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const SEGMENTS = ["Penjualan Service", "Penjualan Customer", "Partshop", "Lainnya"];

const SEGMENT_COLORS = {
  "Penjualan Service": "#10b981", // Emerald
  "Penjualan Customer": "#3b82f6", // Blue
  "Partshop": "#f59e0b", // Amber
  "Lainnya": "#6b7280" // Gray
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
};

export default function SparepartRevenuePage() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [segmentFilter, setSegmentFilter] = useState('ALL');
  const [timePreset, setTimePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await db.select('sparepart_revenue', { range: { from: 0, to: 99999 } });
      if (err) throw err;
      setRecords(data || []);
    } catch (err) {
      setError(err.message);
      Toastify({ text: '❌ Gagal memuat data sparepart: ' + err.message, style: { background: 'red' } }).showToast();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper date parsing
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    
    // Pattern 1: DD/MM/YYYY
    let parts = s.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const y = parseInt(parts[2]);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 1900) {
        return new Date(y, m, d);
      }
    }
    
    // Pattern 2: YYYY-MM-DD
    parts = s.split('-');
    if (parts.length === 3) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const getSegment = (pelanggan) => {
    const p = String(pelanggan || '').trim().toUpperCase();
    if (p.startsWith('RS0001C')) return 'Penjualan Customer';
    if (p.startsWith('RS0001')) return 'Penjualan Service';
    if (p.startsWith('RMS') || p.startsWith('GJ1') || p.startsWith('PAM')) return 'Partshop';
    return 'Lainnya';
  };

  const years = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      const d = parseDate(r.Tgl);
      if (d) set.add(d.getFullYear());
    });
    const arr = [...set].sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }, [records]);

  // Check if item falls in selected date range
  const isDateInTimeRange = useCallback((dateObj) => {
    if (!dateObj) return false;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (timePreset === 'all') return true;
    
    if (timePreset === 'today') {
      const dCopy = new Date(dateObj);
      dCopy.setHours(0,0,0,0);
      return dCopy.getTime() === today.getTime();
    }
    
    if (timePreset === 'week') {
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return dateObj >= oneWeekAgo && dateObj <= new Date();
    }
    
    if (timePreset === 'month') {
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      return dateObj >= oneMonthAgo && dateObj <= new Date();
    }
    
    if (timePreset === 'year') {
      return dateObj.getFullYear() === selectedYear;
    }
    
    if (timePreset === 'custom') {
      if (!fromDate && !toDate) return true;
      const itemDateStr = dateObj.toISOString().split('T')[0];
      if (fromDate && itemDateStr < fromDate) return false;
      if (toDate && itemDateStr > toDate) return false;
      return true;
    }
    
    return true;
  }, [timePreset, selectedYear, fromDate, toDate]);

  // Process data with active filters (Time range + segment filter + search term)
  const processedData = useMemo(() => {
    const monthlyStats = Array.from({ length: 12 }, () => ({
      qty: 0,
      totalSales: 0,
      segments: {
        "Penjualan Service": { sales: 0, qty: 0 },
        "Penjualan Customer": { sales: 0, qty: 0 },
        "Partshop": { sales: 0, qty: 0 },
        "Lainnya": { sales: 0, qty: 0 }
      }
    }));

    const segmentSummaries = {
      "Penjualan Service": { sales: 0, qty: 0, count: 0 },
      "Penjualan Customer": { sales: 0, qty: 0, count: 0 },
      "Partshop": { sales: 0, qty: 0, count: 0 },
      "Lainnya": { sales: 0, qty: 0, count: 0 }
    };

    let totalQty = 0;
    let totalSales = 0;
    let totalTransactions = 0;

    const filteredForTable = [];

    records.forEach(r => {
      const d = parseDate(r.Tgl);
      if (!d) return;

      // 1. Time Filter
      if (!isDateInTimeRange(d)) return;

      const qty = parseFloat(r.Qty) || 0;
      const rowTotal = parseFloat(r.Total) || 0;
      const segment = getSegment(r.Pelanggan);
      
      // 2. Segment Filter
      if (segmentFilter !== 'ALL' && segment !== segmentFilter) return;

      const month = d.getMonth();

      // Accumulate monthly stats
      monthlyStats[month].qty += qty;
      monthlyStats[month].totalSales += rowTotal;

      monthlyStats[month].segments[segment].qty += qty;
      monthlyStats[month].segments[segment].sales += rowTotal;

      // Accumulate segment summaries
      segmentSummaries[segment].qty += qty;
      segmentSummaries[segment].sales += rowTotal;
      segmentSummaries[segment].count += 1;

      // Global totals
      totalQty += qty;
      totalSales += rowTotal;
      totalTransactions += 1;

      // 3. Search Filter
      const matchesSearch = !searchTerm || 
        (r.PartName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.PartNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.Pelanggan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.NoTransaksi || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (matchesSearch) {
        filteredForTable.push({
          ...r,
          segment
        });
      }
    });

    return {
      monthlyStats,
      segmentSummaries,
      totalQty,
      totalSales,
      totalTransactions,
      filteredForTable
    };
  }, [records, segmentFilter, isDateInTimeRange, searchTerm]);

  // Chart configuration for sales
  const salesChartOptions = useMemo(() => {
    const activeColors = SEGMENTS
      .filter(seg => segmentFilter === 'ALL' || seg === segmentFilter)
      .map(s => SEGMENT_COLORS[s]);

    return {
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      colors: activeColors,
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '45%',
          borderRadius: 4
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: {
        categories: MONTHS,
        labels: {
          style: { colors: '#71717a', fontWeight: 600, fontSize: '10px' }
        }
      },
      yaxis: {
        title: { text: 'Rupiah (IDR)', style: { color: '#71717a', fontWeight: 700 } },
        labels: {
          formatter: (val) => formatCurrency(val).replace(',00', ''),
          style: { colors: '#71717a', fontWeight: 600 }
        }
      },
      fill: { opacity: 1 },
      tooltip: {
        y: {
          formatter: (val) => formatCurrency(val)
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: '#27272a' },
        fontWeight: 700
      }
    };
  }, [segmentFilter]);

  // Filter series based on selected segment
  const salesChartSeries = useMemo(() => {
    return SEGMENTS
      .filter(seg => segmentFilter === 'ALL' || seg === segmentFilter)
      .map(seg => ({
        name: seg,
        data: processedData.monthlyStats.map(m => m.segments[seg].sales)
      }));
  }, [processedData, segmentFilter]);

  const handlePresetChange = (preset) => {
    setTimePreset(preset);
    setPage(0);
    if (preset !== 'custom') {
      setFromDate('');
      setToDate('');
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = processedData.filteredForTable.map(r => ({
        'No. Transaksi': r.NoTransaksi,
        'Tanggal': r.Tgl,
        'No. WO': r.NoWO,
        'Pelanggan': r.Pelanggan,
        'Segmen': r.segment,
        'Part No': r.PartNo,
        'Part Name': r.PartName,
        'Tipe': r.Type,
        'Qty': r.Qty,
        'Harga Satuan': r.HargaSatuan,
        'Diskon': r.Discount,
        'Total Penjualan': r.Total
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan Sparepart');
      XLSX.writeFile(wb, `Laporan_Penjualan_Sparepart_${selectedYear}.xlsx`);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Penjualan Sparepart!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      Toastify({ text: `❌ Gagal Ekspor: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

  const paginatedTableData = useMemo(() => {
    const startIdx = page * pageSize;
    return processedData.filteredForTable.slice(startIdx, startIdx + pageSize);
  }, [processedData.filteredForTable, page]);

  const totalPages = Math.ceil(processedData.filteredForTable.length / pageSize);

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-6 bg-zinc-100 overflow-y-auto">
      
      {/* FILTER CONTROL BAR */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        
        {/* Time Presets */}
        <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'today', label: 'Hari Ini' },
            { id: 'week', label: 'Seminggu' },
            { id: 'month', label: 'Sebulan' },
            { id: 'year', label: 'Setahun' },
            { id: 'custom', label: 'Kustom' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timePreset === p.id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {timePreset === 'custom' && (
          <div className="flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-zinc-400">DARI:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(0); }}
                className="text-xs font-bold bg-transparent outline-none text-zinc-900"
              />
            </div>
            <div className="w-px h-4 bg-zinc-300"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-zinc-400">KE:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(0); }}
                className="text-xs font-bold bg-transparent outline-none text-zinc-900"
              />
            </div>
          </div>
        )}

        {/* Customer Segment Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
            <Filter size={13} className="text-zinc-400" />
            <select
              value={segmentFilter}
              onChange={e => { setSegmentFilter(e.target.value); setPage(0); }}
              className="text-xs font-bold bg-transparent outline-none text-zinc-900 cursor-pointer"
            >
              <option value="ALL">Semua Segmen Pelanggan</option>
              <option value="Penjualan Service">Penjualan Service (RS0001)</option>
              <option value="Penjualan Customer">Penjualan Customer (RS0001C)</option>
              <option value="Partshop">Partshop (RMS/GJ1/PAM)</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Year selector (only visible for 'year' or 'all' filters) */}
          {(timePreset === 'all' || timePreset === 'year') && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
              <Calendar size={13} className="text-zinc-400" />
              <select 
                value={selectedYear} 
                onChange={e => { setSelectedYear(parseInt(e.target.value)); setPage(0); }}
                className="text-xs font-bold bg-transparent outline-none text-zinc-900 cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={fetchData} 
            disabled={isLoading} 
            className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={handleExportExcel} 
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-sm"
          >
            <FileDown size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Penjualan Sparepart</span>
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-900"><ShoppingBag size={16} /></div>
          </div>
          <p className="text-2xl font-black text-zinc-900">{formatCurrency(processedData.totalSales)}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Total Pendapatan Terfilter</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Jumlah Item Terjual</span>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Package size={16} /></div>
          </div>
          <p className="text-2xl font-black text-blue-600">{processedData.totalQty.toLocaleString('id-ID')} Pcs</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Kuantitas Sparepart Terfilter</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Transaksi</span>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><TrendingUp size={16} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-600">{processedData.totalTransactions.toLocaleString('id-ID')} Kali</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Total Baris Transaksi Terfilter</p>
        </div>
      </div>

      {/* SEGMENT SUMMARY CARDS (only show relevant segment if filtered, or show all) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {SEGMENTS.map(seg => {
          const sData = processedData.segmentSummaries[seg] || { sales: 0, qty: 0, count: 0 };
          const color = SEGMENT_COLORS[seg];
          const isDimmed = segmentFilter !== 'ALL' && seg !== segmentFilter;
          
          return (
            <div 
              key={seg} 
              className={`bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-opacity duration-300 ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                  <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">{seg}</span>
                </div>
                <p className="text-base font-black text-zinc-900 mt-2">{formatCurrency(sData.sales)}</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 mt-1 uppercase">
                  <span>Total Sales</span>
                  <span className="text-zinc-600">{sData.qty} Pcs</span>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-3 mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="text-zinc-400">Transaksi:</span>
                  <span className="font-extrabold text-zinc-800">{sData.count} Kali</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHARTS GRAPH SECTION (Full width chart) */}
      <div className="w-full">
        <div className="bg-white p-5 md:p-6 border border-zinc-200 rounded-2xl shadow-sm">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart4 size={14} /> Tren Penjualan per Segmen (12 Bulan)
          </h3>
          <div className="w-full h-[380px]">
            {records.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs">Belum ada data</div>
            ) : (
              <ReactApexChart key={`${segmentFilter}-${selectedYear}-${timePreset}`} options={salesChartOptions} series={salesChartSeries} type="bar" height="100%" />
            )}
          </div>
        </div>
      </div>

      {/* SEARCH AND TABLE VIEW OF TRANSACTIONS */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Detail Penjualan per Baris</h3>
            <span className="text-[10px] text-zinc-400 font-bold">({processedData.filteredForTable.length} transaksi filter)</span>
          </div>

          <form 
            onSubmit={e => { e.preventDefault(); setSearchTerm(searchInput); setPage(0); }} 
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari PartNo, Name, Pelanggan..."
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors">
              Cari
            </button>
          </form>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs min-w-[850px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-zinc-500">No. Transaksi</th>
                <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Tanggal</th>
                <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Pelanggan</th>
                <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Segmen</th>
                <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Part No / Name</th>
                <th className="text-center px-2 py-3 text-[10px] font-black uppercase text-zinc-500">Qty</th>
                <th className="text-right px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Harga Satuan Awal</th>
                <th className="text-right px-3 py-3 text-[10px] font-black uppercase text-red-500">Diskon</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-zinc-900 border-l border-zinc-100">Total Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-400 font-bold">Memuat data...</td>
                </tr>
              ) : paginatedTableData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-400 font-bold">Tidak ada transaksi ditemukan</td>
                </tr>
              ) : (
                paginatedTableData.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900">{r.NoTransaksi || '-'}</td>
                    <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">{r.Tgl}</td>
                    <td className="px-3 py-3 font-semibold text-zinc-700">{r.Pelanggan}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span 
                        className="inline-block px-2 py-0.5 text-[9px] font-black rounded-full text-white"
                        style={{ backgroundColor: SEGMENT_COLORS[r.segment] }}
                      >
                        {r.segment}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[200px] truncate">
                      <span className="font-mono text-zinc-500 block text-[10px]">{r.PartNo}</span>
                      <span className="font-bold text-zinc-800 text-xs block">{r.PartName}</span>
                    </td>
                    <td className="px-2 py-3 text-center font-black text-zinc-900">{r.Qty}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-500">{formatCurrency(r.HargaSatuan)}</td>
                    <td className="px-3 py-3 text-right font-mono text-red-500">{formatCurrency(r.Discount)}</td>
                    <td className="px-4 py-3 text-right font-black text-zinc-950 border-l border-zinc-100">{formatCurrency(r.Total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div className="bg-zinc-50 border-t border-zinc-100 px-5 py-3 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500 font-bold uppercase">
              Menampilkan {page * pageSize + 1}–{Math.min((page + 1) * pageSize, processedData.filteredForTable.length)} dari {processedData.filteredForTable.length} transaksi
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))} 
                disabled={page === 0} 
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                disabled={page >= totalPages - 1} 
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
