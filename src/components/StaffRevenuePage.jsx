import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, DollarSign, Wrench, User, Calendar, RefreshCw, AlertCircle, FileText, Search, FileDown, Filter, BarChart3, Info
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const formatCurrency = (val) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
};

export default function StaffRevenuePage() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Diagnostic states
  const [diagInfo, setDiagInfo] = useState({
    invoiceCount: 0,
    woCount: 0,
    matchedCount: 0,
    invoiceError: null,
    woError: null
  });

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1)); // Default current month
  const [woTypeFilter, setWoTypeFilter] = useState('ALL'); // 'ALL', 'EUR', 'IFS', 'IKC', etc.
  const [activeView, setActiveView] = useState('sa'); // 'sa' or 'mekanik'
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Normalize date helper
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    
    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
    let parts = s.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const y = parseInt(parts[2].split(' ')[0]);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 1900) {
        return new Date(y, m, d);
      }
    }
    parts = s.split('-');
    if (parts.length === 3) {
      const d = new Date(s.split(' ')[0]);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDiagInfo({ invoiceCount: 0, woCount: 0, matchedCount: 0, invoiceError: null, woError: null });
    
    try {
      // Query the invoices for the entire selected year to catch WOs opened in previous months but closed in the selected month
      const from = `${selectedYear}-01-01`;
      const to = `${selectedYear}-12-31`;

      // Fetch sequentially to prevent session cookie race conditions
      const invoiceRes = await fetch(`/api/chery_dms?endpoint=warranty-invoice-report&from=${from}&to=${to}`);
      if (!invoiceRes.ok) throw new Error(`Invoice report: HTTP ${invoiceRes.status}`);
      const invoiceJson = await invoiceRes.json();
      if (invoiceJson.error) {
        setDiagInfo(p => ({ ...p, invoiceError: invoiceJson.error }));
        throw new Error(`DMS Invoice Error: ${invoiceJson.error}`);
      }

      const woRes = await fetch(`/api/chery_dms?endpoint=warranty-wo&draw=1&start=0&length=2000&fetchAll=true`);
      if (!woRes.ok) throw new Error(`WO report: HTTP ${woRes.status}`);
      const woJson = await woRes.json();
      if (woJson.error) {
        setDiagInfo(p => ({ ...p, woError: woJson.error }));
        throw new Error(`DMS WO Error: ${woJson.error}`);
      }

      const rawInvoices = Array.isArray(invoiceJson.data) ? invoiceJson.data : (invoiceJson.payload?.content || []);
      const rawWos = Array.isArray(woJson.data) ? woJson.data : (woJson.payload?.content || []);

      setDiagInfo(p => ({ ...p, invoiceCount: rawInvoices.length, woCount: rawWos.length }));

      // Map rawWos by no_wo for quick matching
      const woMap = {};
      rawWos.forEach(wo => {
        if (wo.no_wo) {
          woMap[String(wo.no_wo).trim().toUpperCase()] = wo;
        }
      });

      const parseRpVal = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9]/g, '')) || 0;
      };

      // Filter Invoices strictly by their Close Date (waktu_selesai) matching the selected month and year
      // Exclude IOB category completely to align totals exactly with the Invoice Closed Report
      const filteredInvoices = rawInvoices.filter(inv => {
        const kat = (inv.kategori || inv.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
        if (kat === 'IOB') return false;

        const d = parseDate(inv.waktu_selesai || inv.updated_at || inv.created_at);
        if (!d) return false;
        if (d.getFullYear() !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && String(d.getMonth() + 1) !== selectedMonth) return false;
        return true;
      });

      let matchCount = 0;
      // Map invoice records to their corresponding WOs to extract staff details
      const cleaned = filteredInvoices.map(inv => {
        const woKey = String(inv.no_wo || '').trim().toUpperCase();
        const matchedWo = woMap[woKey] || {};

        // Parse Jasa (labor charge) & SO (sub order) safely using parseRpVal
        const jasa = parseRpVal(inv.lcVal || inv.jasa || inv.biaya_pekerjaan || 0);
        const so = parseRpVal(inv.sub_order);
        
        if (jasa > 0 || so > 0) {
          matchCount++;
        }
        
        const g_total = jasa + so;

        return {
          no_wo: inv.no_wo || matchedWo.no_wo || '',
          wkt_masuk: matchedWo.waktu_masuk || matchedWo.wkt_masuk || inv.waktu_masuk || '',
          wkt_selesai: inv.waktu_selesai || inv.updated_at || matchedWo.waktu_selesai || '',
          bk: inv.no_polisi || inv.no_pol || matchedWo.no_polisi || '',
          tipe_kendaraan: inv.nama_kendaraan || inv.tipe_kendaraan || matchedWo.nama_kendaraan || '',
          jasa,
          so,
          g_total,
          sa: String(matchedWo.id_karyawan || '---').trim().toUpperCase(),
          leader: String(matchedWo.nama_leader1 || '---').trim().toUpperCase(),
          mekanik: String(matchedWo.nama_mekanik1 || '---').trim().toUpperCase()
        };
      }).filter(r => r.no_wo);

      setDiagInfo(p => ({ ...p, matchedCount: matchCount }));
      setRecords(cleaned);
    } catch (err) {
      setError(err.message);
      Toastify({ text: '❌ Gagal memuat data laporan staff: ' + err.message, style: { background: 'red' } }).showToast();
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const years = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      const d = parseDate(r.wkt_selesai);
      if (d) set.add(d.getFullYear());
    });
    const arr = [...set].sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }, [records]);

  // Process and aggregate performance data
  const aggregatedData = useMemo(() => {
    const saMap = {};
    const mekanikMap = {};
    
    let totalJasa = 0;
    let totalSO = 0;
    let totalGrand = 0;
    let totalWoCount = 0;

    records.forEach(r => {
      const d = parseDate(r.wkt_selesai);
      if (!d) return;

      // Filter 1: Year (already filtered on fetch but safe to keep)
      if (d.getFullYear() !== selectedYear) return;
      
      // Filter 2: Month (already filtered on fetch but safe to keep)
      if (selectedMonth !== 'ALL' && String(d.getMonth() + 1) !== selectedMonth) return;

      // Filter 3: WO Type
      const prefix = String(r.no_wo || '').substring(0, 3).toUpperCase();
      if (woTypeFilter !== 'ALL' && prefix !== woTypeFilter) return;

      // Accumulate global totals
      totalJasa += r.jasa;
      totalSO += r.so;
      totalGrand += r.g_total;
      totalWoCount += 1;

      // SA Aggregation
      const saName = r.sa || 'BELUM DITENTUKAN';
      if (!saMap[saName]) {
        saMap[saName] = { name: saName, count: 0, jasa: 0, so: 0, g_total: 0 };
      }
      saMap[saName].count += 1;
      saMap[saName].jasa += r.jasa;
      saMap[saName].so += r.so;
      saMap[saName].g_total += r.g_total;

      // Mechanic Aggregation
      const mekName = r.mekanik || 'BELUM DITENTUKAN';
      if (!mekanikMap[mekName]) {
        mekanikMap[mekName] = { name: mekName, count: 0, jasa: 0, so: 0, g_total: 0 };
      }
      mekanikMap[mekName].count += 1;
      mekanikMap[mekName].jasa += r.jasa;
      mekanikMap[mekName].so += r.so;
      mekanikMap[mekName].g_total += r.g_total;
    });

    // Convert to arrays and sort by Grand Total descending
    const saList = Object.values(saMap).sort((a, b) => b.g_total - a.g_total);
    const mekanikList = Object.values(mekanikMap).sort((a, b) => b.g_total - a.g_total);

    // Apply Search Filter for rendering
    const filterBySearch = (list) => {
      if (!searchTerm) return list;
      return list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    };

    return {
      saList: filterBySearch(saList),
      mekanikList: filterBySearch(mekanikList),
      totalJasa,
      totalSO,
      totalGrand,
      totalWoCount
    };
  }, [records, selectedYear, selectedMonth, woTypeFilter, searchTerm]);

  // Filter list to only plot staff members who generated positive Jasa (Labor Fee) or SO
  const chartDataForPlot = useMemo(() => {
    const list = activeView === 'sa' ? aggregatedData.saList : aggregatedData.mekanikList;
    return list.filter(item => item.g_total > 0).slice(0, 10);
  }, [aggregatedData, activeView]);

  const hasDataToPlot = useMemo(() => {
    return chartDataForPlot.length > 0;
  }, [chartDataForPlot]);

  // Chart configuration for comparing performance (Focus on Grand Total = Jasa + SO)
  const chartOptions = useMemo(() => {
    return {
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      colors: ['#6366f1'], // Indigo
      plotOptions: {
        bar: {
          horizontal: true,
          columnWidth: '55%',
          borderRadius: 0 // Remove border-radius to prevent SVG path calculations on zero values
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: false }, // Disable stroke completely to prevent outline path warnings on zero values
      xaxis: {
        categories: chartDataForPlot.map(item => item.name === '---' ? 'TIDAK DIKETAHUI' : item.name),
        labels: {
          style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#71717a', fontWeight: 600 }
        }
      },
      tooltip: {
        y: { formatter: (val) => formatCurrency(val) }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: '#27272a' },
        fontWeight: 700
      }
    };
  }, [chartDataForPlot]);

  const chartSeries = useMemo(() => {
    return [
      { name: 'Total Revenue (Labor + SO)', data: chartDataForPlot.map(item => item.g_total) }
    ];
  }, [chartDataForPlot]);

  const handleExportExcel = () => {
    try {
      const dataToExport = (activeView === 'sa' ? aggregatedData.saList : aggregatedData.mekanikList).map((r, i) => ({
        'Peringkat': i + 1,
        'Nama Karyawan': r.name === '---' ? 'TIDAK DIKETAHUI' : r.name,
        'Jabatan': activeView === 'sa' ? 'Service Advisor (SA)' : 'Teknisi / Mekanik',
        'Jumlah WO Closed': r.count,
        'Total Jasa (Labor)': r.jasa,
        'Total SO (Sub Order)': r.so,
        'Grand Total': r.g_total
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeView === 'sa' ? 'Revenue SA' : 'Revenue Mekanik');
      XLSX.writeFile(wb, `Laporan_Kinerja_Revenue_${activeView === 'sa' ? 'SA' : 'Mekanik'}_${selectedYear}_${selectedMonth}.xlsx`);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Kinerja Staff!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      Toastify({ text: `❌ Gagal Ekspor: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-6 bg-zinc-100 overflow-y-auto">
      
      {/* FILTER CONTROL BAR */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
            <Calendar size={13} className="text-zinc-400" />
            <select 
              value={selectedMonth} 
              onChange={e => { setSelectedMonth(e.target.value); }}
              className="text-xs font-bold bg-transparent outline-none text-zinc-900 cursor-pointer"
            >
              <option value="ALL">Semua Bulan</option>
              {MONTHS.map((m, idx) => (
                <option key={idx} value={String(idx + 1)}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
            <Calendar size={13} className="text-zinc-400" />
            <select 
              value={selectedYear} 
              onChange={e => { setSelectedYear(parseInt(e.target.value)); }}
              className="text-xs font-bold bg-transparent outline-none text-zinc-900 cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* WO Type Filter */}
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
            <Filter size={13} className="text-zinc-400" />
            <select
              value={woTypeFilter}
              onChange={e => { setWoTypeFilter(e.target.value); }}
              className="text-xs font-bold bg-transparent outline-none text-zinc-900 cursor-pointer"
            >
              <option value="ALL">Semua Kategori WO</option>
              <option value="EUR">Kategori EUR</option>
              <option value="IFS">Kategori IFS</option>
              <option value="IKC">Kategori IKC</option>
            </select>
          </div>

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

        {/* View Switch */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button
            onClick={() => { setActiveView('sa'); setSearchTerm(''); setSearchInput(''); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'sa' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <User size={13} /> Service Advisor
          </button>
          <button
            onClick={() => { setActiveView('mekanik'); setSearchTerm(''); setSearchInput(''); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'mekanik' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Wrench size={13} /> Teknisi / Mekanik
          </button>
        </div>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Work Order (Closed)</span>
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-900"><FileText size={16} /></div>
          </div>
          <p className="text-2xl font-black text-zinc-900">{aggregatedData.totalWoCount} WO</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Jumlah Invoice Selesai</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Jasa (Labor Fee)</span>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><Wrench size={16} /></div>
          </div>
          <p className="text-2xl font-black text-indigo-600">{formatCurrency(aggregatedData.totalJasa)}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Nilai Jasa Bengkel Terfilter</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total SO (Sub Order)</span>
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600"><FileText size={16} /></div>
          </div>
          <p className="text-2xl font-black text-orange-600">{formatCurrency(aggregatedData.totalSO)}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Nilai Pekerjaan Sub Order</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-indigo-900 to-zinc-900 border-indigo-950 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Grand Total Revenue</span>
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-300"><DollarSign size={16} /></div>
          </div>
          <p className="text-2xl font-black text-indigo-300">{formatCurrency(aggregatedData.totalGrand)}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Total Jasa + SO Terfilter</p>
        </div>
      </div>

      {/* TOP 10 CHART COMPILATION */}
      <div className="w-full">
        <div className="bg-white p-5 md:p-6 border border-zinc-200 rounded-2xl shadow-sm">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart3 size={14} /> Perbandingan Revenue 10 {activeView === 'sa' ? 'Service Advisor' : 'Mekanik'} Teratas (Jasa + SO)
          </h3>
          <div className="w-full h-[320px]">
            {!hasDataToPlot ? (
              <div className="w-full h-full flex items-center justify-center border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs font-bold uppercase tracking-wider bg-zinc-50/50">
                Belum ada data pendapatan jasa untuk filter ini
              </div>
            ) : (
              <ReactApexChart 
                key={`${activeView}-${selectedMonth}-${selectedYear}-${woTypeFilter}`} 
                options={chartOptions} 
                series={chartSeries} 
                type="bar" 
                height="100%" 
              />
            )}
          </div>
        </div>
      </div>

      {/* DETAILED TABLE LISTING */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">
              Laporan Kinerja {activeView === 'sa' ? 'Service Advisor' : 'Mekanik'} (Berdasarkan Invoice Closed)
            </h3>
            <span className="text-[10px] text-zinc-400 font-bold">
              ({activeView === 'sa' ? aggregatedData.saList.length : aggregatedData.mekanikList.length} Karyawan Terfilter)
            </span>
          </div>

          <form 
            onSubmit={e => { e.preventDefault(); setSearchTerm(searchInput); }} 
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari nama staff..."
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors">
              Cari
            </button>
          </form>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs min-w-[750px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-zinc-500 w-16">Peringkat</th>
                <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Nama Karyawan</th>
                <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Jumlah WO Closed</th>
                <th className="text-right px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Total Jasa (Labor)</th>
                <th className="text-right px-3 py-3 text-[10px] font-black uppercase text-zinc-500">Total SO (Sub Order)</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-zinc-900 border-l border-zinc-100">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 font-bold">Memuat data...</td>
                </tr>
              ) : (activeView === 'sa' ? aggregatedData.saList : aggregatedData.mekanikList).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 font-bold">Tidak ada data ditemukan</td>
                </tr>
              ) : (
                (activeView === 'sa' ? aggregatedData.saList : aggregatedData.mekanikList).map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-zinc-400">#{i + 1}</td>
                    <td className="px-3 py-3 font-bold text-zinc-900">
                      {r.name === '---' || !r.name ? <span className="text-zinc-300 italic">TIDAK DIKETAHUI / TANPA NAMA</span> : r.name}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-zinc-700">{r.count} WO</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600">{formatCurrency(r.jasa)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-orange-600">{formatCurrency(r.so)}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 border-l border-zinc-100 bg-zinc-50/30">
                      {formatCurrency(r.g_total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIAGNOSTIC INFORMATION PANEL */}
      <div className="bg-zinc-900 text-zinc-400 p-4 rounded-2xl border border-zinc-800 text-[10px] font-mono space-y-2 shadow-inner shrink-0">
        <div className="flex items-center gap-1.5 text-zinc-100 font-bold mb-1 uppercase tracking-wider text-xs">
          <Info size={14} className="text-indigo-400" /> Panel Diagnostik Integrasi DMS
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-zinc-500 block uppercase">Invoices from API:</span>
            <span className="text-emerald-400 font-bold">{diagInfo.invoiceCount} rows</span>
          </div>
          <div>
            <span className="text-zinc-500 block uppercase">WOs from API:</span>
            <span className="text-blue-400 font-bold">{diagInfo.woCount} rows</span>
          </div>
          <div>
            <span className="text-zinc-500 block uppercase">Matched non-zero Jasa:</span>
            <span className="text-purple-400 font-bold">{diagInfo.matchedCount} rows</span>
          </div>
          <div>
            <span className="text-zinc-500 block uppercase">DMS status:</span>
            <span className="text-zinc-200 font-bold">Connected</span>
          </div>
        </div>
        {(diagInfo.invoiceError || diagInfo.woError) && (
          <div className="mt-2 pt-2 border-t border-zinc-800 text-red-400 whitespace-pre-wrap">
            {diagInfo.invoiceError && `Invoice Error: ${diagInfo.invoiceError}\n`}
            {diagInfo.woError && `WO Error: ${diagInfo.woError}`}
          </div>
        )}
      </div>

    </div>
  );
}
