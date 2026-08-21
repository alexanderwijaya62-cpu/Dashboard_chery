import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, AlertCircle, Clock, FileText, Wrench, Filter, X, ChevronLeft, ChevronRight,
  Car, User, ChevronDown, ChevronUp, DollarSign, Layers, CheckCircle2, TrendingUp, ShieldCheck, Zap, Star, Activity, FileDown, Droplet
} from 'lucide-react';
import { formatRp } from '../utils/warrantyConfig';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';

// Helper to calculate YYYY-MM-DD string with optional day offset
function getFormattedDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Helper to check if a row falls into selected date range based strictly on waktu_masuk
function isRowInSelectedRange(row, fromStr, toStr) {
  if (!fromStr && !toStr) return true;

  const rawDate = row.waktu_selesai || row.last_update || row.updated_at || row.created_at;
  if (!rawDate) return true;

  let dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    const match = String(rawDate).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) dateObj = new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }

  if (isNaN(dateObj.getTime())) return true;

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const yyyymmdd = `${y}-${m}-${d}`;

  if (fromStr && yyyymmdd < fromStr) return false;
  if (toStr && yyyymmdd > toStr) return false;
  return true;
}

export default function OilFilterReportPage() {
  const [timePreset, setTimePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [masterClosedList, setMasterClosedList] = useState([]);
  const [invoiceDetailsMap, setInvoiceDetailsMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Background loading progress
  const [loadingProgress, setLoadingProgress] = useState({ total: 0, current: 0, active: false });

  // Oil & Filter codes
  const OIL_CODES = ['ZJP-ID5000007', 'XID0000455'];
  const FILTER_CODES = ['480-1012010'];

  const handlePresetChange = (preset) => {
    setTimePreset(preset);
    const nowStr = getFormattedDate(0);
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(nowStr);
      setToDate(nowStr);
    } else if (preset === 'week') {
      setFromDate(getFormattedDate(7));
      setToDate(nowStr);
    } else if (preset === 'month') {
      setFromDate(getFormattedDate(30));
      setToDate(nowStr);
    } else if (preset === 'year') {
      setFromDate(getFormattedDate(365));
      setToDate(nowStr);
    }
  };

  // Fetch Closed Work Orders
  const fetchInvoiceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        endpoint: 'warranty-invoice-report',
        from: fromDate,
        to: toDate,
        search
      });
      const res = await fetch(`/api/chery_dms?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const rawList = Array.isArray(json.data) ? json.data : (json.payload?.content || []);
      const dateFiltered = rawList.filter(row => isRowInSelectedRange(row, fromDate, toDate));
      setMasterClosedList(dateFiltered);
    } catch (err) {
      setError(err.message);
      Toastify({ text: `❌ Gagal memuat data: ${err.message}`, style: { background: 'red' } }).showToast();
    } finally {
      setIsLoading(false);
    }
  }, [search, fromDate, toDate]);

  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  // Batch load details for WOs that are not in cache
  useEffect(() => {
    if (masterClosedList.length === 0) return;

    const unloadWOs = masterClosedList.filter(row => !invoiceDetailsMap[row.id_wo]);
    if (unloadWOs.length === 0) return;

    let active = true;
    setLoadingProgress({ total: unloadWOs.length, current: 0, active: true });

    const loadBatch = async () => {
      const concurrency = 5;
      for (let i = 0; i < unloadWOs.length; i += concurrency) {
        if (!active) break;
        const batch = unloadWOs.slice(i, i + concurrency);
        
        await Promise.all(
          batch.map(async (row) => {
            try {
              const res = await fetch(`/api/chery_dms?endpoint=warranty-estimasi-detail&id=${row.id_wo}`);
              if (!res.ok) return;
              const detail = await res.json();
              if (detail && !detail.error) {
                setInvoiceDetailsMap(prev => ({ ...prev, [row.id_wo]: detail }));
              }
            } catch (err) {
              console.error(`Error loading detail for ${row.id_wo}:`, err);
            }
          })
        );

        setLoadingProgress(prev => ({
          ...prev,
          current: Math.min(prev.total, i + batch.length)
        }));
      }
      setLoadingProgress(prev => ({ ...prev, active: false }));
    };

    loadBatch();

    return () => {
      active = false;
    };
  }, [masterClosedList, invoiceDetailsMap]);

  // Process and Filter data for Oil & Oil Filter Report
  const processedReport = useMemo(() => {
    let totalOilQty = 0;
    let totalFilterQty = 0;
    let totalOilRevenue = 0;
    let totalFilterRevenue = 0;
    let totalSparepartMurni = 0;
    let totalJasa = 0;
    let totalGrand = 0;

    const vehicleRows = [];

    masterClosedList.forEach((row) => {
      const detail = invoiceDetailsMap[row.id_wo];
      if (!detail) return;

      const parts = detail.parts || [];
      const pekerjaan = detail.pekerjaan || [];

      // Find oil & oil filter items in parts
      const oilItems = parts.filter(p => OIL_CODES.includes(String(p.kode_part).trim()));
      const filterItems = parts.filter(p => FILTER_CODES.includes(String(p.kode_part).trim()));

      const hasOilOrFilter = oilItems.length > 0 || filterItems.length > 0;

      // Extract financials
      const lcVal = (detail.pekerjaanSummary?.total || 0) || pekerjaan.reduce((s, p) => s + (p.total || p.sub_total || 0), 0);
      const totalPartVal = (detail.partsSummary?.sub_total || 0) || parts.reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
      const soVal = parseFloat(String(row.sub_order || 0).replace(/[^0-9]/g, '')) || 0;

      let oilVal = 0;
      let filterVal = 0;

      oilItems.forEach(p => {
        const qty = parseFloat(p.jumlah) || 1;
        const total = parseFloat(p.total || p.sub_total || ((p.harga_jual || 0) * qty)) || 0;
        oilVal += total;
        totalOilQty += qty;
      });

      filterItems.forEach(p => {
        const qty = parseFloat(p.jumlah) || 1;
        const total = parseFloat(p.total || p.sub_total || ((p.harga_jual || 0) * qty)) || 0;
        filterVal += total;
        totalFilterQty += qty;
      });

      const oilAndFilterTotal = oilVal + filterVal;
      const pureSparepartsTotal = Math.max(0, totalPartVal - oilAndFilterTotal);

      totalOilRevenue += oilVal;
      totalFilterRevenue += filterVal;
      totalSparepartMurni += pureSparepartsTotal;
      totalJasa += (lcVal + soVal);

      const subTotalVal = lcVal + totalPartVal + soVal;
      const ppnVal = Math.round(subTotalVal * 0.11);
      const grandTotalVal = subTotalVal + ppnVal;

      totalGrand += grandTotalVal;

      if (hasOilOrFilter) {
        vehicleRows.push({
          no_wo: row.no_wo || '-',
          waktu_selesai: row.waktu_selesai || row.last_update || '-',
          no_polisi: row.no_polisi || '-',
          nama_kendaraan: row.nama_kendaraan || '-',
          nama_pelanggan: row.nama_pelanggan || '-',
          oilItems: oilItems.map(p => `${p.kode_part} (${p.jumlah} pcs)`).join(', ') || '-',
          filterItems: filterItems.map(p => `${p.kode_part} (${p.jumlah} pcs)`).join(', ') || '-',
          oilAndFilterTotal,
          pureSparepartsTotal,
          jasa: lcVal + soVal,
          grandTotal: grandTotalVal
        });
      }
    });

    return {
      totalOilQty,
      totalFilterQty,
      totalOilRevenue,
      totalFilterRevenue,
      totalOilAndFilter: totalOilRevenue + totalFilterRevenue,
      totalSparepartMurni,
      totalJasa,
      totalGrand,
      vehicleRows
    };
  }, [masterClosedList, invoiceDetailsMap]);

  const handleExportExcel = () => {
    try {
      const summaryData = [
        { 'Metrik': 'Total Qty Oli Terpakai', 'Nilai': `${processedReport.totalOilQty} Pcs` },
        { 'Metrik': 'Total Qty Filter Oli Terpakai', 'Nilai': `${processedReport.totalFilterQty} Pcs` },
        { 'Metrik': 'Total Revenue Oli', 'Nilai': processedReport.totalOilRevenue },
        { 'Metrik': 'Total Revenue Filter Oli', 'Nilai': processedReport.totalFilterRevenue },
        { 'Metrik': 'Total Revenue Oli & Filter', 'Nilai': processedReport.totalOilAndFilter },
        { 'Metrik': 'Total Revenue Sparepart Murni', 'Nilai': processedReport.totalSparepartMurni },
        { 'Metrik': 'Total Jasa (Labor Charge)', 'Nilai': processedReport.totalJasa },
        { 'Metrik': 'Grand Total Pendapatan', 'Nilai': processedReport.totalGrand }
      ];

      const detailData = processedReport.vehicleRows.map((row, i) => ({
        'No.': i + 1,
        'No. Invoice / WO': row.no_wo,
        'Waktu Closed': row.waktu_selesai,
        'No. Polisi': row.no_polisi,
        'Kendaraan': row.nama_kendaraan,
        'Pelanggan': row.nama_pelanggan,
        'Oli Digunakan': row.oilItems,
        'Filter Oli Digunakan': row.filterItems,
        'Total Oli & Filter (Rp)': row.oilAndFilterTotal,
        'Total Sparepart Murni (Rp)': row.pureSparepartsTotal,
        'Total Jasa (Rp)': row.jasa,
        'Grand Total (Rp)': row.grandTotal
      }));

      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Laporan');

      const wsDetail = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Per-Mobil');

      const fileName = `Laporan_Oli_dan_Oil_Filter_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Oli & Filter!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      Toastify({ text: `❌ Gagal mengekspor: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-5 bg-zinc-100 overflow-y-auto">
      
      {/* 4 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Oli & Filter</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{formatRp(processedReport.totalOilAndFilter)}</p>
            <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Oli: {processedReport.totalOilQty} pcs | Filter: {processedReport.totalFilterQty} pcs</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0"><Droplet size={24} fill="currentColor" /></div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Sparepart Murni</span>
            <p className="text-2xl font-black text-purple-600 mt-1">{formatRp(processedReport.totalSparepartMurni)}</p>
            <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Diluar Oli & Filter Oli</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm shrink-0"><Layers size={24} /></div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Jasa (Labor Charge)</span>
            <p className="text-2xl font-black text-orange-600 mt-1">{formatRp(processedReport.totalJasa)}</p>
            <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Pekerjaan Jasa Workshop</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm shrink-0"><Wrench size={24} /></div>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-900 rounded-2xl p-5 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Grand Total Workshop</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">{formatRp(processedReport.totalGrand)}</p>
            <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Termasuk PPN 11%</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-sm shrink-0"><TrendingUp size={24} /></div>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="bg-white rounded-xl border border-zinc-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
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
                onChange={e => { setFromDate(e.target.value); }}
                className="text-xs font-bold bg-transparent outline-none text-zinc-900"
              />
            </div>
            <div className="w-px h-4 bg-zinc-300"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-zinc-400">KE:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); }}
                className="text-xs font-bold bg-transparent outline-none text-zinc-900"
              />
            </div>
          </div>
        )}

        {/* Search & Action Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari Invoice, Plat..."
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors">
              Cari
            </button>
          </form>

          <button onClick={fetchInvoiceData} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={handleExportExcel} 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-sm"
          >
            <FileDown size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Progress Loading Bar */}
      {loadingProgress.active && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-black text-zinc-700 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin text-blue-600"/> Menganalisis Rincian Estimasi (Oli & Filter Oli)...</span>
            <span>{loadingProgress.current} / {loadingProgress.total} WO</span>
          </div>
          <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* INVOICE OIL DATA TABLE */}
      <div className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="overflow-x-auto w-full">
          {isLoading && processedReport.vehicleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-400 font-bold">Memuat data Laporan Invoice...</p>
            </div>
          ) : processedReport.vehicleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-zinc-300"/>
              <p className="text-xs font-bold text-zinc-400">Tidak ada pengerjaan dengan oli & filter oli terpilih dalam periode ini</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[950px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                  <th className="text-left pl-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Invoice / WO</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Closed</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Polisi</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kendaraan</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Oli</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Filter Oli</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Total Oli & Filter</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Sparepart Murni</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Jasa</th>
                  <th className="text-right pr-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {processedReport.vehicleRows.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="pl-4 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.no_wo}</td>
                    <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{row.waktu_selesai}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-700 whitespace-nowrap text-xs">{row.no_polisi}</td>
                    <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs max-w-[140px] truncate">{row.nama_kendaraan}</td>
                    <td className="px-3 py-2.5 text-blue-600 font-mono text-xs">{row.oilItems}</td>
                    <td className="px-3 py-2.5 text-purple-600 font-mono text-xs">{row.filterItems}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-600 font-bold whitespace-nowrap text-xs">{formatRp(row.oilAndFilterTotal)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-purple-600 font-bold whitespace-nowrap text-xs">{formatRp(row.pureSparepartsTotal)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-orange-600 font-bold whitespace-nowrap text-xs">{formatRp(row.jasa)}</td>
                    <td className="pr-4 py-2.5 text-right font-mono text-emerald-600 font-black whitespace-nowrap text-xs">{formatRp(row.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
