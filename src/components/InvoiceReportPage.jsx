import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, AlertCircle, Clock, FileText, Wrench, Filter, X, ChevronLeft, ChevronRight,
  Car, User, ChevronDown, ChevronUp, DollarSign, Layers, CheckCircle2, TrendingUp, ShieldCheck, Zap, Star, Activity
} from 'lucide-react';
import {
  getStatusStyle, getKategoriStyle, formatDate, formatKm, formatRp
} from '../utils/warrantyConfig';
import { WorkOrderDetailView } from './WorkOrderReportPage';

// Helper to calculate YYYY-MM-DD string with optional day offset
function getFormattedDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Helper to check if a row falls into selected date range based strictly on waktu_masuk
function isRowInSelectedRange(row, fromStr, toStr) {
  if (!fromStr && !toStr) return true;

  const rawDate = row.waktu_masuk || row.created_at;
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

const invReportMemoryCache = new Map();
const INV_CACHE_KEY = 'invoice_report_cache_data';

function getCachedInvData(cacheKey) {
  try {
    if (invReportMemoryCache.has(cacheKey)) {
      return invReportMemoryCache.get(cacheKey).data;
    }
    const raw = localStorage.getItem(`${INV_CACHE_KEY}_${cacheKey}`);
    if (raw) {
      const { data, timestamp } = JSON.parse(raw);
      invReportMemoryCache.set(cacheKey, { data, timestamp });
      return data;
    }
  } catch (e) {}
  return null;
}

function setCachedInvData(cacheKey, data) {
  try {
    const timestamp = Date.now();
    invReportMemoryCache.set(cacheKey, { data, timestamp });
    localStorage.setItem(`${INV_CACHE_KEY}_${cacheKey}`, JSON.stringify({ data, timestamp }));
  } catch (e) {}
}

export default function InvoiceReportPage() {
  const today = getFormattedDate(0);

  const [timePreset, setTimePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');

  const [masterClosedList, setMasterClosedList] = useState(() => {
    return getCachedInvData('all___') || [];
  });
  const [invoiceDetailsMap, setInvoiceDetailsMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Handle Time Preset Buttons
  const handlePresetChange = (preset) => {
    setTimePreset(preset);
    setPage(0);
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

  const activeControllerRef = useRef(null);

  // Fetch Closed Work Orders (Invoices) with server-side 1-request backend aggregator
  const fetchInvoiceData = useCallback(async (forceFresh = false) => {
    const cacheKey = `${timePreset}_${fromDate}_${toDate}_${search}`;
    if (!forceFresh) {
      const cached = getCachedInvData(cacheKey);
      if (cached && cached.length > 0) {
        setMasterClosedList(cached);
        setIsLoading(false);
        return; // ABSOLUTELY 0 NETWORK REQUESTS!
      }
    }

    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        endpoint: 'warranty-invoice-report',
        from: fromDate,
        to: toDate,
        search
      });

      const res = await fetch(`/api/chery_dms?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned non-JSON (${text.slice(0, 50)}...).`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const rawList = Array.isArray(json.data) ? json.data : (json.payload?.content || []);
      const dateFiltered = rawList.filter(row => isRowInSelectedRange(row, fromDate, toDate));
      setMasterClosedList(dateFiltered);
      const cacheKey = `${timePreset}_${fromDate}_${toDate}_${search}`;
      setCachedInvData(cacheKey, dateFiltered);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Fetch invoice data error:", err);
      setError(err.message);
    } finally {
      if (activeControllerRef.current === controller) {
        setIsLoading(false);
        setIsSyncingDetails(false);
      }
    }
  }, [search, fromDate, toDate]);

  useEffect(() => { fetchInvoiceData(); }, [fetchInvoiceData]);

  // Filtered List for Table display
  const displayFilteredData = useMemo(() => {
    return masterClosedList.filter(row => {
      if (kategoriFilter) {
        const k = kategoriFilter.toUpperCase();
        const rowKat = (row.kategori || row.no_wo || '').toUpperCase();
        if (!rowKat.includes(k)) return false;
      }
      return true;
    });
  }, [masterClosedList, kategoriFilter]);

  // Compute category-based Financial Breakdown (IFS, IKC, EUR, IOB, EUK, PDI, etc.)
  const categoryFinancials = useMemo(() => {
    const categoriesMap = {};

    masterClosedList.forEach(row => {
      const kat = (row.kategori || row.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
      if (!categoriesMap[kat]) {
        categoriesMap[kat] = {
          kategori: kat,
          count: 0,
          totalLaborCharge: 0,
          totalSparePart: 0,
          grandTotal: 0
        };
      }

      categoriesMap[kat].count += 1;

      // Extract details if available, or fall back to server pre-calculated values
      const detail = invoiceDetailsMap[row.id_wo];
      let lcTotal = 0;
      let partTotal = 0;

      if (detail) {
        lcTotal = (detail.pekerjaanSummary?.total || 0) || (detail.pekerjaan || []).reduce((s, p) => s + (p.total || p.sub_total || 0), 0);
        partTotal = (detail.partsSummary?.sub_total || 0) || (detail.parts || []).reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
      } else {
        lcTotal = row.lcVal ?? (parseFloat(row.total_jasa || row.jasa || row.biaya_jasa || 0) || 0);
        partTotal = row.partVal ?? (parseFloat(row.total_part || row.sparepart || row.biaya_part || 0) || 0);
        
        const totalBiaya = row.subTotalVal ?? (parseFloat(row.total_biaya || row.grand_total || row.total || 0) || 0);
        if (lcTotal === 0 && partTotal === 0 && totalBiaya > 0) {
          lcTotal = totalBiaya;
        }
      }

      const rowSubtotal = lcTotal + partTotal;
      const rowDpp = rowSubtotal;
      const rowPpn = row.ppnVal ?? Math.round(rowDpp * 0.11);
      const rowGrandTotal = row.grandTotalVal ?? (rowDpp + rowPpn);

      categoriesMap[kat].totalLaborCharge += lcTotal;
      categoriesMap[kat].totalSparePart += partTotal;
      categoriesMap[kat].grandTotal += rowGrandTotal;
    });

    return Object.values(categoriesMap);
  }, [masterClosedList, invoiceDetailsMap]);

  // Global Financial Totals across all Closed Invoices
  const globalFinancials = useMemo(() => {
    const totalCount = masterClosedList.length;
    const totalLaborCharge = categoryFinancials.reduce((s, c) => s + c.totalLaborCharge, 0);
    const totalSparePart = categoryFinancials.reduce((s, c) => s + c.totalSparePart, 0);
    const grandTotal = categoryFinancials.reduce((s, c) => s + c.grandTotal, 0);

    return {
      totalCount,
      totalLaborCharge,
      totalSparePart,
      grandTotal
    };
  }, [masterClosedList, categoryFinancials]);

  const totalRecords = displayFilteredData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const pagedData = useMemo(() => {
    const startIdx = page * pageSize;
    return displayFilteredData.slice(startIdx, startIdx + pageSize);
  }, [displayFilteredData, page, pageSize]);

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-5 bg-zinc-100 overflow-y-auto">

      {/* 4 TOP SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Invoice Closed</span>
            <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900"><CheckCircle2 size={18} /></div>
          </div>
          <p className="text-3xl font-black text-zinc-900">{globalFinancials.totalCount}</p>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Transaksi WO Selesai</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Labor Charge (LC)</span>
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Wrench size={18} /></div>
          </div>
          <p className="text-2xl font-black text-blue-600">{formatRp(globalFinancials.totalLaborCharge)}</p>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Pendapatan Jasa Pekerjaan</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Spare Part</span>
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600"><Layers size={18} /></div>
          </div>
          <p className="text-2xl font-black text-purple-600">{formatRp(globalFinancials.totalSparePart)}</p>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Pendapatan Spare Part</p>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-900 rounded-2xl p-5 shadow-md text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Grand Total Pendapatan</span>
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400"><TrendingUp size={18} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-400">{formatRp(globalFinancials.grandTotal)}</p>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Termasuk PPN 11% (LC + Part)</p>
        </div>
      </div>

      {/* CATEGORY FINANCIAL BREAKDOWN MATRIX */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800 flex items-center gap-2">
            <Layers size={15} className="text-zinc-600"/> Matriks Keuangan Per-Tipe / Kategori WO
          </h2>
          <span className="text-[10px] font-bold text-zinc-400">IFS, IKC, EUR, IOB, EUK, PDI, dll.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {['IFS', 'IKC', 'EUR', 'IOB', 'EUK', 'PDI'].map(katName => {
            const item = categoryFinancials.find(c => c.kategori === katName) || { count: 0, totalLaborCharge: 0, totalSparePart: 0, grandTotal: 0 };
            return (
              <div key={katName} className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200">{katName}</span>
                  <span className="text-[10px] font-bold text-zinc-500">{item.count} Invoice</span>
                </div>
                <div className="space-y-1 pt-1 border-t border-zinc-200/80">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">LC (Jasa):</span>
                    <span className="font-bold text-blue-600">{formatRp(item.totalLaborCharge)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Sparepart:</span>
                    <span className="font-bold text-purple-600">{formatRp(item.totalSparePart)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-200">
                    <span className="text-zinc-700 font-bold">Total:</span>
                    <span className="font-black text-emerald-600">{formatRp(item.grandTotal)}</span>
                  </div>
                </div>
              </div>
            );
          })}
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

        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(0); }} className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari Invoice, Plat, VIN..."
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors">
              Cari
            </button>
          </form>

          <select
            value={kategoriFilter}
            onChange={e => { setKategoriFilter(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-900 outline-none cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            <option value="IFS">IFS</option>
            <option value="IKC">IKC</option>
            <option value="EUR">EUR</option>
            <option value="IOB">IOB</option>
            <option value="EUK">EUK</option>
            <option value="PDI">PDI</option>
          </select>

          <button onClick={fetchInvoiceData} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0"/>
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={fetchInvoiceData} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* INVOICE DATA TABLE */}
      <div className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="overflow-x-auto w-full">
          {isLoading && pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-400 font-bold">Memuat data Laporan Invoice (Closed)...</p>
            </div>
          ) : pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-zinc-300"/>
              <p className="text-xs font-bold text-zinc-400">Tidak ada Invoice Closed untuk kriteria filter ini</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[950px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                  <th className="w-8 pl-3 py-2.5"></th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Invoice / WO</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kategori</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Pelanggan</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Polisi</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kendaraan</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Closed</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Labor Charge (LC)</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Spare Part</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pagedData.map((row, i) => {
                  const k = getKategoriStyle(row.kategori);
                  const isExp = expandedRow === i;
                  const detail = invoiceDetailsMap[row.id_wo];

                  let lcVal = 0;
                  let partVal = 0;
                  if (detail) {
                    lcVal = (detail.pekerjaanSummary?.total || 0) || (detail.pekerjaan || []).reduce((s, p) => s + (p.total || p.sub_total || 0), 0);
                    partVal = (detail.partsSummary?.sub_total || 0) || (detail.parts || []).reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
                  } else {
                    lcVal = row.lcVal ?? (parseFloat(row.total_jasa || row.jasa || row.biaya_jasa || 0) || 0);
                    partVal = row.partVal ?? (parseFloat(row.total_part || row.sparepart || row.biaya_part || 0) || 0);
                  }
                  let subTotalVal = row.subTotalVal ?? (lcVal + partVal);
                  if (subTotalVal === 0 && !detail) {
                    subTotalVal = parseFloat(row.total_biaya || row.grand_total || row.total || 0) || 0;
                    if (lcVal === 0) lcVal = subTotalVal;
                  }
                  const ppnVal = row.ppnVal ?? Math.round(subTotalVal * 0.11);
                  const grandTotalVal = row.grandTotalVal ?? (subTotalVal + ppnVal);

                  return (
                    <React.Fragment key={i}>
                      <tr
                        className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isExp ? 'bg-zinc-50' : ''}`}
                        onClick={() => setExpandedRow(isExp ? null : i)}
                      >
                        <td className="pl-3 pr-1 py-2.5 text-zinc-400">{isExp ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</td>
                        <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.no_wo || '-'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${k.bg} ${k.text} ${k.border}`}>
                            {k.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs max-w-[140px] truncate">{row.nama_pelanggan || '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-700 whitespace-nowrap text-xs">{row.no_polisi || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs max-w-[160px] truncate">{row.nama_kendaraan || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_selesai || row.last_update)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-blue-600 font-bold whitespace-nowrap text-xs">{formatRp(lcVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-purple-600 font-bold whitespace-nowrap text-xs">{formatRp(partVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-black whitespace-nowrap text-xs">{formatRp(grandTotalVal)}</td>
                      </tr>
                      {isExp && (
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <td colSpan={10} className="px-4 py-4">
                            <WorkOrderDetailView
                              row={row}
                              onDetailLoaded={(id, data) => {
                                setInvoiceDetailsMap(prev => (prev[id] ? prev : { ...prev, [id]: data }));
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
            <p className="text-xs text-zinc-500">
              {`${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalRecords)} dari ${totalRecords.toLocaleString()} Invoice`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14}/>
              </button>
              <span className="text-xs font-bold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
