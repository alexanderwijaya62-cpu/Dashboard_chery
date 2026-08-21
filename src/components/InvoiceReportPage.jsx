import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, AlertCircle, Clock, FileText, Wrench, Filter, X, ChevronLeft, ChevronRight,
  Car, User, ChevronDown, ChevronUp, DollarSign, Layers, CheckCircle2, TrendingUp, ShieldCheck, Zap, Star, Activity, FileDown, Droplet
} from 'lucide-react';
import {
  getStatusStyle, getKategoriStyle, formatDate, formatKm, formatRp
} from '../utils/warrantyConfig';
import { WorkOrderDetailView } from './WorkOrderReportPage';
import { fetchWithCache, getCache } from '../utils/dataCache';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';
import { db } from '../utils/dbClient';

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

const OIL_CODES = ['ZJP-ID5000007', 'XID0000455'];
const FILTER_CODES = ['480-1012010'];

const getCachedDetail = (id_wo) => {
  if (!id_wo) return null;
  try {
    const cached = localStorage.getItem(`invoice_detail_${id_wo}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) { return null; }
};

const saveCachedDetail = (id_wo, data) => {
  if (!id_wo || !data) return;
  try {
    localStorage.setItem(`invoice_detail_${id_wo}`, JSON.stringify(data));
  } catch (e) {}
};

export default function InvoiceReportPage() {
  const today = getFormattedDate(0);

  const [timePreset, setTimePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');

  const [masterClosedList, setMasterClosedList] = useState(() => {
    try {
      const raw = localStorage.getItem('invoice_report_cache_data_all___');
      if (raw) {
        const { data } = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {}
    return [];
  });
  const [invoiceDetailsMap, setInvoiceDetailsMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // DB-based Oil & Filter records
  const [dbOilFilterRecords, setDbOilFilterRecords] = useState([]);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Scanning states for current month fallback
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCount, setScanCount] = useState(0);

  const fetchDbOilFilterData = useCallback(async () => {
    setIsDbLoading(true);
    try {
      const { data, error } = await db.select('sparepart_revenue', {
        in: { PartNo: ['ZJP-ID5000007', 'XID0000455', '480-1012010'] },
        range: { from: 0, to: 99999 }
      });
      if (!error && data) {
        setDbOilFilterRecords(data);
      }
    } catch (e) {
      console.error('Error fetching oil/filter from db:', e);
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbOilFilterData();
  }, [fetchDbOilFilterData]);

  // Calculate WOs for selected period that are neither in DB nor in localStorage cache
  const unscannedWos = useMemo(() => {
    const dbWoSet = new Set(dbOilFilterRecords.map(r => String(r.NoWO || '').toUpperCase().trim()));
    return masterClosedList.filter(row => {
      const woKey = String(row.no_wo || '').toUpperCase().trim();
      if (dbWoSet.has(woKey)) return false;
      return !localStorage.getItem(`invoice_detail_${row.id_wo}`);
    });
  }, [masterClosedList, dbOilFilterRecords]);

  // Sequentially scan details for the selected period
  const handleScanDetails = async () => {
    if (unscannedWos.length === 0) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanCount(0);

    for (let i = 0; i < unscannedWos.length; i++) {
      const row = unscannedWos[i];
      try {
        const res = await fetch(`/api/chery_dms?endpoint=warranty-estimasi-detail&id=${row.id_wo}`);
        if (res.ok) {
          const detail = await res.json();
          if (detail && !detail.error) {
            localStorage.setItem(`invoice_detail_${row.id_wo}`, JSON.stringify(detail));
          }
        }
      } catch (e) {
        console.error(e);
      }
      setScanCount(i + 1);
      setScanProgress(Math.round(((i + 1) / unscannedWos.length) * 100));
      await new Promise(r => setTimeout(r, 100));
    }
    setIsScanning(false);
    Toastify({ text: '✅ Selesai menganalisis rincian invoice baru!', style: { background: '#10b981' } }).showToast();
  };

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

  // Fetch Closed Work Orders (Invoices) with stale-while-revalidate caching
  const fetchInvoiceData = useCallback(async (forceFresh = false) => {
    const cacheKey = 'invoice_report_cache_data_all___';

    const doFetch = async () => {
      const params = new URLSearchParams({
        endpoint: 'warranty-invoice-report',
        from: fromDate,
        to: toDate,
        search
      });
      const res = await fetch(`/api/chery_dms?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned non-JSON (${text.slice(0, 50)}...).`);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const rawList = Array.isArray(json.data) ? json.data : (json.payload?.content || []);
      return rawList;
    };

    const existingEntry = getCache(cacheKey);
    const hasStaleData = existingEntry && existingEntry.data && existingEntry.data.length > 0 && (Date.now() - existingEntry.timestamp >= 300000);

    if (hasStaleData) setIsSyncingDetails(true);

    const rawList = await fetchWithCache(cacheKey, doFetch, {
      ttl: 300000,
      forceFresh,
      onLoading: (loading) => {
        setIsLoading(loading);
        if (loading) setError(null);
      },
      onFreshData: (freshData) => {
        setIsSyncingDetails(false);
        const dateFiltered = freshData.filter(row => isRowInSelectedRange(row, fromDate, toDate));
        setMasterClosedList(dateFiltered);
      },
      onError: (err) => {
        setIsSyncingDetails(false);
        setError(err.message);
      }
    });

    if (rawList) {
      const dateFiltered = rawList.filter(row => isRowInSelectedRange(row, fromDate, toDate));
      setMasterClosedList(dateFiltered);
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
          totalSO: 0,
          grandTotal: 0
        };
      }

      categoriesMap[kat].count += 1;

      // Helper to parse currency strings from DMS
      const parseRpVal = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9]/g, '')) || 0;
      };

      // Extract details if available, or fall back to server pre-calculated values
      const detail = invoiceDetailsMap[row.id_wo];
      let lcTotal = 0;
      let partTotal = 0;
      let soTotal = parseRpVal(row.sub_order);

      if (detail) {
        lcTotal = (detail.pekerjaanSummary?.total || 0) || (detail.pekerjaan || []).reduce((s, p) => s + (p.total || p.sub_total || 0), 0);
        partTotal = (detail.partsSummary?.sub_total || 0) || (detail.parts || []).reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
      } else {
        lcTotal = row.lcVal ?? (parseFloat(row.total_jasa || row.jasa || row.biaya_jasa || 0) || 0);
        partTotal = row.partVal ?? (parseFloat(row.total_part || row.sparepart || row.biaya_part || 0) || 0);
      }

      // Do not count internal IOB financial values
      if (kat === 'IOB') {
        lcTotal = 0;
        partTotal = 0;
        soTotal = 0;
      }

      const rowSubtotal = lcTotal + partTotal + soTotal;
      const rowDpp = rowSubtotal;
      const rowPpn = row.ppnVal ?? Math.round(rowDpp * 0.11);
      const rowGrandTotal = row.grandTotalVal ?? (rowDpp + rowPpn);

      categoriesMap[kat].totalLaborCharge += (lcTotal + soTotal); // Sum SO directly into Labor Charge (LC)
      categoriesMap[kat].totalSparePart += partTotal;
      categoriesMap[kat].totalSO += soTotal;
      categoriesMap[kat].grandTotal += rowGrandTotal;
    });

    return Object.values(categoriesMap);
  }, [masterClosedList, invoiceDetailsMap]);

  // Global Financial Totals across all Closed Invoices
  const globalFinancials = useMemo(() => {
    const nonIobList = masterClosedList.filter(row => {
      const kat = (row.kategori || row.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
      return kat !== 'IOB';
    });
    const totalCount = nonIobList.length;
    const totalLaborCharge = categoryFinancials.filter(c => c.kategori !== 'IOB').reduce((s, c) => s + c.totalLaborCharge, 0);
    const totalSparePart = categoryFinancials.filter(c => c.kategori !== 'IOB').reduce((s, c) => s + c.totalSparePart, 0);
    const totalSO = categoryFinancials.filter(c => c.kategori !== 'IOB').reduce((s, c) => s + (c.totalSO || 0), 0);
    const grandTotal = categoryFinancials.filter(c => c.kategori !== 'IOB').reduce((s, c) => s + c.grandTotal, 0);

    return {
      totalCount,
      totalLaborCharge,
      totalSparePart,
      totalSO,
      grandTotal
    };
  }, [masterClosedList, categoryFinancials]);

  const parseDbDate = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim().split(' ')[0];
    const parts = s.split(/[-/]/);
    if (parts.length === 3) {
      let d = NaN, m = NaN, y = NaN;
      if (parts[2].length === 4) {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
      } else if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        d = parseInt(parts[2], 10);
      }
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
    const rawParse = new Date(dateStr);
    return isNaN(rawParse.getTime()) ? null : rawParse;
  };

  const oilFilterMetrics = useMemo(() => {
    let oilQty = 0;
    let filterQty = 0;
    let oilTotalVal = 0;
    let filterTotalVal = 0;

    const breakdown = {
      IFS: { oilQty: 0, filterQty: 0, totalVal: 0 },
      IKC: { oilQty: 0, filterQty: 0, totalVal: 0 },
      EUR: { oilQty: 0, filterQty: 0, totalVal: 0 }
    };

    // 1. Process database records
    dbOilFilterRecords.forEach(r => {
      const d = parseDbDate(r.Tgl);
      if (!d) return;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const yyyymmdd = `${y}-${m}-${day}`;

      if (fromDate && yyyymmdd < fromDate) return;
      if (toDate && yyyymmdd > toDate) return;

      const qty = parseFloat(r.Qty) || 0;
      const total = parseFloat(r.Total) || 0;
      const code = String(r.PartNo || '').trim();

      const rawCat = String(r.NoWO || '').split('-')[0].toUpperCase().trim();
      const cat = ['IFS', 'IKC', 'EUR'].includes(rawCat) ? rawCat : null;

      if (OIL_CODES.includes(code)) {
        oilQty += qty;
        oilTotalVal += total;
        if (cat) {
          breakdown[cat].oilQty += qty;
          breakdown[cat].totalVal += total;
        }
      } else if (FILTER_CODES.includes(code)) {
        filterQty += qty;
        filterTotalVal += total;
        if (cat) {
          breakdown[cat].filterQty += qty;
          breakdown[cat].totalVal += total;
        }
      }
    });

    // 2. Real-time Fallback for current months (e.g. August 2026) using localStorage
    const dbWoSet = new Set(dbOilFilterRecords.map(r => String(r.NoWO || '').toUpperCase().trim()));

    masterClosedList.forEach(row => {
      const woKey = String(row.no_wo || '').toUpperCase().trim();
      if (dbWoSet.has(woKey)) return;

      const cached = localStorage.getItem(`invoice_detail_${row.id_wo}`);
      if (!cached) return;

      try {
        const detail = JSON.parse(cached);
        if (detail && Array.isArray(detail.parts)) {
          const cat = String(row.kategori || row.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
          const targetCat = ['IFS', 'IKC', 'EUR'].includes(cat) ? cat : null;

          detail.parts.forEach(p => {
            const code = String(p.kode_part || '').trim();
            const qty = parseFloat(p.jumlah) || 0;
            const total = parseFloat(p.total || p.sub_total || ((p.harga_jual || 0) * qty)) || 0;

            if (OIL_CODES.includes(code)) {
              oilQty += qty;
              oilTotalVal += total;
              if (targetCat) {
                breakdown[targetCat].oilQty += qty;
                breakdown[targetCat].totalVal += total;
              }
            } else if (FILTER_CODES.includes(code)) {
              filterQty += qty;
              filterTotalVal += total;
              if (targetCat) {
                breakdown[targetCat].filterQty += qty;
                breakdown[targetCat].totalVal += total;
              }
            }
          });
        }
      } catch (e) {
        console.error('Error parsing localStorage backup:', e);
      }
    });

    return {
      oilQty,
      filterQty,
      oilTotalVal,
      filterTotalVal,
      totalVal: oilTotalVal + filterTotalVal,
      breakdown
    };
  }, [dbOilFilterRecords, masterClosedList, fromDate, toDate]);

  const totalRecords = displayFilteredData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const pagedData = useMemo(() => {
    const startIdx = page * pageSize;
    return displayFilteredData.slice(startIdx, startIdx + pageSize);
  }, [displayFilteredData, page, pageSize]);

  const handleExportExcel = () => {
    try {
      const parseRpVal = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9]/g, '')) || 0;
      };

      const dataToExport = displayFilteredData
        .filter(row => {
          const kat = (row.kategori || row.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
          return kat !== 'IOB';
        })
        .map((row, i) => {
          const detail = invoiceDetailsMap[row.id_wo];
          let lcVal = 0;
          let partVal = 0;
          let soVal = parseRpVal(row.sub_order);

          if (detail) {
            lcVal = (detail.pekerjaanSummary?.total || 0) || (detail.pekerjaan || []).reduce((s, p) => s + (p.total || p.sub_total || 0), 0);
            partVal = (detail.partsSummary?.sub_total || 0) || (detail.parts || []).reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
          } else {
            lcVal = row.lcVal ?? (parseFloat(row.total_jasa || row.jasa || row.biaya_jasa || 0) || 0);
            partVal = row.partVal ?? (parseFloat(row.total_part || row.sparepart || row.biaya_part || 0) || 0);
          }

          const subTotalVal = lcVal + partVal + soVal;
          const ppnVal = row.ppnVal ?? Math.round(subTotalVal * 0.11);
          const grandTotalVal = row.grandTotalVal ?? (subTotalVal + ppnVal);

          return {
            'No.': i + 1,
            'No. Invoice / WO': row.no_wo || '-',
            'Kategori': row.kategori || '-',
            'Pelanggan': row.nama_pelanggan || '-',
            'No. Polisi': row.no_polisi || '-',
            'Kendaraan': row.nama_kendaraan || '-',
            'Waktu Closed': row.waktu_selesai || row.last_update || '-',
            'Sub Order (SO)': soVal,
            'Labor Charge (LC)': lcVal,
            'Spare Part': partVal,
            'PPN (11%)': ppnVal,
            'Grand Total': grandTotalVal
          };
        });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices Closed');

      const summaryRows = [
        {
          'Kategori / Segmen': 'Oli (Qty Pcs)',
          'IFS': oilFilterMetrics.breakdown.IFS.oilQty,
          'IKC': oilFilterMetrics.breakdown.IKC.oilQty,
          'EUR': oilFilterMetrics.breakdown.EUR.oilQty,
          'Total Qty (Pcs)': oilFilterMetrics.oilQty,
          'Total Nilai (Rp)': oilFilterMetrics.oilTotalVal
        },
        {
          'Kategori / Segmen': 'Filter Oli (Qty Pcs)',
          'IFS': oilFilterMetrics.breakdown.IFS.filterQty,
          'IKC': oilFilterMetrics.breakdown.IKC.filterQty,
          'EUR': oilFilterMetrics.breakdown.EUR.filterQty,
          'Total Qty (Pcs)': oilFilterMetrics.filterQty,
          'Total Nilai (Rp)': oilFilterMetrics.filterTotalVal
        },
        {
          'Kategori / Segmen': 'Gabungan Oli + Filter',
          'IFS': '-',
          'IKC': '-',
          'EUR': '-',
          'Total Qty (Pcs)': oilFilterMetrics.oilQty + oilFilterMetrics.filterQty,
          'Total Nilai (Rp)': oilFilterMetrics.totalVal
        }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Rangkuman Oli & Filter');
      
      const fileName = `Laporan_Invoice_Closed_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Invoice!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      Toastify({ text: `❌ Gagal mengekspor: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-5 bg-zinc-100 overflow-y-auto">

      {/* 5 TOP SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Jasa Pekerjaan + SO</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total SO (Sub Order)</span>
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600"><FileText size={18} /></div>
          </div>
          <p className="text-2xl font-black text-orange-600">{formatRp(globalFinancials.totalSO)}</p>
          <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase">Pekerjaan Sub Order</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {['IFS', 'IKC', 'EUR', 'EUK', 'PDI'].map(katName => {
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

      {/* LAPORAN OLI & OIL FILTER CONTAINER */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800 flex items-center gap-2">
              <span className="p-1 bg-blue-50 text-blue-600 rounded-md"><Droplet size={14} fill="currentColor"/></span> Laporan Penggunaan Oli & Filter Oli
            </h2>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Dihitung dari transaksi part berkode ZJP-ID5000007, XID0000455 (Oli) & 480-1012010 (Filter Oli)</p>
          </div>

          <div className="flex items-center gap-2">
            {isDbLoading ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
                <RefreshCw size={11} className="animate-spin" /> Menghitung data...
              </span>
            ) : unscannedWos.length > 0 ? (
              <button
                onClick={handleScanDetails}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Menganalisis ({scanCount}/{unscannedWos.length})...
                  </>
                ) : (
                  `Analisis Rincian Bulan Ini (${unscannedWos.length} WO)`
                )}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                <CheckCircle2 size={11} /> Semua Rincian Ter-analisis
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar if scanning */}
        {isScanning && (
          <div className="space-y-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-zinc-450 uppercase">
              <span>Membaca detail dari DMS...</span>
              <span>{scanProgress}%</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Oli & Filter Oli</span>
              <p className="text-xl font-black text-blue-600 mt-1">{formatRp(oilFilterMetrics.totalVal)}</p>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-bold border-t border-blue-100 pt-2.5 mt-2.5 uppercase">
              <span>Oli: {oilFilterMetrics.oilQty} Pcs</span>
              <span>Filter: {oilFilterMetrics.filterQty} Pcs</span>
            </div>
          </div>

          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider">Spare Part Murni</span>
              <p className="text-xl font-black text-purple-600 mt-1">{formatRp(Math.max(0, globalFinancials.totalSparePart - oilFilterMetrics.totalVal))}</p>
            </div>
            <div className="text-[10px] text-zinc-500 font-bold border-t border-purple-100 pt-2.5 mt-2.5 uppercase">
              Total Spare Part dikurangi Oli & Filter
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Rasio Oli vs Sparepart</span>
              <p className="text-xl font-black text-zinc-700 mt-1">
                {globalFinancials.totalSparePart > 0 
                  ? `${((oilFilterMetrics.totalVal / globalFinancials.totalSparePart) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
            <div className="text-[10px] text-zinc-500 font-bold border-t border-zinc-200 pt-2.5 mt-2.5 uppercase">
              Porsi Oli & Filter dari Total Sparepart
            </div>
          </div>
        </div>

        {/* Category Breakdown (IFS, IKC, EUR) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-100">
          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-sky-600 uppercase tracking-wider">IFS (Oli & Filter)</span>
              <p className="text-base font-black text-zinc-800 mt-0.5">{formatRp(oilFilterMetrics.breakdown.IFS.totalVal)}</p>
            </div>
            <div className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase">
              Oli: {oilFilterMetrics.breakdown.IFS.oilQty} pcs | Filter: {oilFilterMetrics.breakdown.IFS.filterQty} pcs
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">IKC (Oli & Filter)</span>
              <p className="text-base font-black text-zinc-800 mt-0.5">{formatRp(oilFilterMetrics.breakdown.IKC.totalVal)}</p>
            </div>
            <div className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase">
              Oli: {oilFilterMetrics.breakdown.IKC.oilQty} pcs | Filter: {oilFilterMetrics.breakdown.IKC.filterQty} pcs
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">EUR (Oli & Filter)</span>
              <p className="text-base font-black text-zinc-800 mt-0.5">{formatRp(oilFilterMetrics.breakdown.EUR.totalVal)}</p>
            </div>
            <div className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase">
              Oli: {oilFilterMetrics.breakdown.EUR.oilQty} pcs | Filter: {oilFilterMetrics.breakdown.EUR.filterQty} pcs
            </div>
          </div>
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

          <button onClick={() => fetchInvoiceData(true)} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
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

      {isSyncingDetails && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 animate-pulse">
          <RefreshCw size={10} className="animate-spin"/> Menyinkronkan data invoice terbaru...
        </div>
      )}

      {/* ERROR ALERT */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0"/>
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={() => fetchInvoiceData(true)} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
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
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">SO</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Labor Charge (LC)</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Spare Part</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">PPN (11%)</th>
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
                  
                  const parseRpVal = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    return parseFloat(String(val).replace(/[^0-9]/g, '')) || 0;
                  };
                  const soVal = parseRpVal(row.sub_order);
                  const subTotalVal = lcVal + partVal + soVal;
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
                        <td className="px-3 py-2.5 text-right font-mono text-orange-600 font-bold whitespace-nowrap text-xs">{formatRp(soVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-blue-600 font-bold whitespace-nowrap text-xs">{formatRp(lcVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-purple-600 font-bold whitespace-nowrap text-xs">{formatRp(partVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-500 font-bold whitespace-nowrap text-xs">{formatRp(ppnVal)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-black whitespace-nowrap text-xs">{formatRp(grandTotalVal)}</td>
                      </tr>
                      {isExp && (
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <td colSpan={12} className="px-4 py-4">
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
