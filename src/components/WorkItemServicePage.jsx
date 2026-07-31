import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, FileText, Wrench, ChevronLeft, ChevronRight,
  X, Clock, Car, Filter, Package, DollarSign, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchWithCache, getCache } from '../utils/dataCache';

const PAGE_SIZE = 50;
const RATE_PER_HOUR = 285000;

function getStyleByKategori(kat) {
  if (!kat) return { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200', label: '-' };
  const k = kat.toUpperCase();
  if (k.includes('TIGGO 8')) return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: kat };
  if (k.includes('TIGGO 7')) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: kat };
  if (k.includes('TIGGO 4')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: kat };
  if (k.includes('ARRIZO')) return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: kat };
  if (k.includes('OMODA') || k.includes('JAECOO')) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: kat };
  if (k.includes('CHERY')) return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', label: kat };
  return { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200', label: kat };
}

function formatLaborHour(h) {
  if (!h && h !== 0) return '-';
  const num = parseFloat(h);
  if (isNaN(num)) return '-';
  if (num >= 60) {
    const hours = Math.floor(num / 60);
    const mins = num % 60;
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  return `${num}m`;
}

function calculateLaborPrice(h) {
  if (!h && h !== 0) return 0;
  const num = parseFloat(h);
  if (isNaN(num)) return 0;
  // laborHour is given in minutes in DMS API (e.g. 60 = 1 hr)
  const hours = num / 60;
  return Math.round(hours * RATE_PER_HOUR);
}

function formatRp(val) {
  if (!val && val !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
}

const WorkItemServicePage = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'productCategoryCode', direction: 'asc' });
  const [filterKategori, setFilterKategori] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [useWorkItemsApi, setUseWorkItemsApi] = useState(false);

  const [searchPartCode, setSearchPartCode] = useState('');
  const [partCodeSearchResults, setPartCodeSearchResults] = useState(null);
  const [isSearchingPart, setIsSearchingPart] = useState(false);

  // Export state
  const [exportState, setExportState] = useState(null); // { phase: 'fetching'|'generating'|'done', progress: 0, total: 0 }

  const fetchData = useCallback(async (forceFresh = false) => {
    const cacheKey = 'work_item_categories_cache';

    const doFetch = async () => {
      const resp = await fetch(`/api/chery_dms?endpoint=work-item-categories&pageIndex=0&pageSize=10000&status=1&sortField=workItemCode${useWorkItemsApi ? '&useWorkItems=1' : ''}&_=${Date.now()}`);
      if (!resp.ok) {
        let message = `HTTP ${resp.status}`;
        try {
          const errBody = await resp.json();
          if (errBody?.error) message = errBody.error;
        } catch {}
        throw new Error(message);
      }
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Respons server bukan JSON (HTTP ${resp.status})`);
      }
      const result = await resp.json();
      return result?.payload?.content || [];
    };

    const items = await fetchWithCache(cacheKey, doFetch, {
      ttl: 300000,
      forceFresh,
      onLoading: (loading) => {
        setIsLoading(loading);
        if (loading) setError(null);
      },
      onFreshData: (freshData) => {
        setIsSyncing(false);
        setData(freshData);
      },
      onError: (err) => {
        setIsSyncing(false);
        setError(err.message);
      }
    });

    if (items) {
      setData(items);
    }
  }, [useWorkItemsApi]);

  // Server-side fast lookup when user searches specific partCode
  const handlePartCodeSearch = async (codeToSearch) => {
    const trimmed = codeToSearch.trim();
    if (!trimmed) {
      setPartCodeSearchResults(null);
      return;
    }

    setIsSearchingPart(true);
    try {
      const resp = await fetch(`/api/chery_dms?endpoint=work-item-categories&partCode=${encodeURIComponent(trimmed)}&pageIndex=0&pageSize=50&status=1&sortField=workItemCode&_=${Date.now()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const resJson = await resp.json();
      const content = resJson?.payload?.content || [];
      setPartCodeSearchResults(content);
    } catch (err) {
      console.error('Failed partCode search:', err);
      setPartCodeSearchResults([]);
    } finally {
      setIsSearchingPart(false);
    }
  };

  useEffect(() => {
    const existingEntry = getCache('work_item_categories_cache');
    const hasStaleData = existingEntry && existingEntry.data && existingEntry.data.length > 0 && (Date.now() - existingEntry.timestamp >= 300000);

    if (hasStaleData) {
      setIsSyncing(true);
    }

    fetchData();
  }, [fetchData]);

  // Export to Excel with progress
  const getItemPartCodes = (item) => {
    const codes = new Set();
    if (Array.isArray(item.parts)) {
      item.parts.forEach(p => { const c = typeof p === 'string' ? p : p?.partCode; if (c) codes.add(c); });
    }
    if (Array.isArray(item.workItemParts)) {
      item.workItemParts.forEach(p => { const c = typeof p === 'string' ? p : p?.partCode; if (c) codes.add(c); });
    }
    if (Array.isArray(item.productCategories)) {
      item.productCategories.forEach(cat => {
        if (Array.isArray(cat.parts)) {
          cat.parts.forEach(p => { if (p && p.partCode) codes.add(p.partCode); });
        }
      });
    }
    if (Array.isArray(item.partCodes)) {
      item.partCodes.forEach(c => { if (c) codes.add(c); });
    }
    if (item.partCode) {
      String(item.partCode).split(',').forEach(s => { const t = s.trim(); if (t) codes.add(t); });
    }
    return [...codes].join(', ');
  };

  const handleExport = async () => {
    const itemsToExport = sortedData;
    if (itemsToExport.length === 0) return;

    // Check if we already have parts cached in localStorage
    const CACHE_KEY = 'work_item_parts_cache';
    const cachedParts = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const itemsWithParts = itemsToExport.filter(i => {
      const id = i.workItemId || i.id;
      return id && cachedParts[id];
    });

    if (itemsWithParts.length === itemsToExport.length) {
      // All parts already cached — export immediately
      setExportState({ phase: 'generating', label: 'Menyusun file Excel...', progress: 0, total: itemsToExport.length });
      exportExcel(itemsToExport, cachedParts);
      return;
    }

    // Need to fetch parts — show progress
    setExportState({ phase: 'generating', label: 'Mengambil data sparepart...', progress: 0, total: itemsToExport.length });

    const allIds = itemsToExport.map(i => i.workItemId || i.id).filter(Boolean);
    const MAX_CONCURRENT = 1;
    const BATCH_SEND = 2000; // Send this many IDs per request
    const queue = [...allIds];
    let processedCount = 0;
    const partsData = { ...cachedParts };
    let stopped = false;

    const fetchChunk = async (chunkIds) => {
      if (stopped || chunkIds.length === 0) return;
      try {
        const resp = await fetch('/api/chery_dms?endpoint=work-item-parts-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunkIds }),
        });
        if (!resp.ok) {
          stopped = true;
          setExportState({ phase: 'done', label: 'Gagal mengambil data sparepart', progress: 0, total: 0 });
          setTimeout(() => setExportState(null), 3000);
          return;
        }
        const data = await resp.json();
        if (data.results) {
          data.results.forEach(r => {
            if (r.id) partsData[r.id] = r.partCodes || [];
          });
          processedCount += data.processedCount || 0;
          setExportState(st => ({
            ...st,
            progress: processedCount,
            label: `${processedCount} / ${allIds.length} item diproses...`,
          }));
        }
        // Return unprocessed IDs to queue
        if (Array.isArray(data.unprocessedIds) && data.unprocessedIds.length > 0) {
          queue.unshift(...data.unprocessedIds);
        }
      } catch (err) {
        console.error('Chunk fetch failed:', err);
        // Re-queue the chunk IDs on error
        queue.unshift(...chunkIds);
      }
    };

    // Process chunks with limited concurrency
    const workers = [];
    for (let w = 0; w < MAX_CONCURRENT; w++) {
      workers.push((async () => {
        while (queue.length > 0 && !stopped) {
          const chunkIds = queue.splice(0, BATCH_SEND);
          if (chunkIds.length === 0) break;
          await fetchChunk(chunkIds);
        }
      })());
    }
    await Promise.all(workers);

    if (stopped) return;

    // Save to localStorage cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(partsData));

    // Export with all obtained parts
    setExportState({ phase: 'generating', label: 'Menyusun file Excel...', progress: 0, total: itemsToExport.length });
    exportExcel(itemsToExport, partsData);
  };

  const exportExcel = (items, partsData) => {
    const excelData = items.map((row, idx) => {
      const id = row.workItemId || row.id;
      const cachedPartCodes = id && partsData[id] ? partsData[id] : [];
      const rowParts = getItemPartCodes(row);
      const allParts = [...new Set([
        ...(rowParts ? rowParts.split(', ').filter(Boolean) : []),
        ...(Array.isArray(cachedPartCodes) ? cachedPartCodes : [])
      ])];
      return {
        'No': idx + 1,
        'Kode Jasa': row.workItemCode || '',
        'Nama Pekerjaan': row.workItemName || row.workItemLocalName || '',
        'Part Code (Sparepart)': allParts.join(', '),
        'Kode Kategori': row.productCategoryCode || '',
        'Kategori Kendaraan': row.productCategoryName || '',
        'Labor Hour (menit)': row.laborHour || 0,
        'Total Harga Jasa': calculateLaborPrice(row.laborHour),
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jasa Pengerjaan');

    const colWidths = Object.keys(excelData[0]).map(k => ({
      wch: Math.max(k.length * 2, ...excelData.map(r => String(r[k] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Jasa_Pengerjaan_${new Date().toISOString().slice(0, 10)}.xlsx`);

    setExportState({ phase: 'done', label: `Selesai! ${items.length} item diexport`, progress: items.length, total: items.length });
    setTimeout(() => setExportState(null), 2000);
  };

  const fetchWorkItemDetail = async (row) => {
    const targetId = row.workItemId || row.id;
    if (!targetId) return;
    setLoadingDetailId(targetId);
    try {
      const resp = await fetch(`/api/chery_dms?endpoint=work-item-detail&id=${targetId}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const resJson = await resp.json();
      const payload = resJson?.payload || resJson;
      setSelectedDetail({ ...row, ...payload });
    } catch (err) {
      console.error('Failed to fetch work item detail:', err);
      // Fallback show whatever row data exists
      setSelectedDetail(row);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const kategoriList = useMemo(() => {
    const map = {};
    // Populate categories from all available items (both base data and search results if active)
    const activeSource = partCodeSearchResults !== null ? partCodeSearchResults : data;
    activeSource.forEach(d => {
      const code = d.productCategoryCode;
      const name = d.productCategoryName;
      if (code && !map[code]) map[code] = name || code;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([code, name]) => ({ code, name }));
  }, [data, partCodeSearchResults]);

  const filteredData = useMemo(() => {
    let result = partCodeSearchResults !== null ? partCodeSearchResults : data;
    if (filterKategori) {
      result = result.filter(r => {
        const itemCatCode = String(r.productCategoryCode || '').trim().toUpperCase();
        const filterCatCode = String(filterKategori).trim().toUpperCase();
        return itemCatCode === filterCatCode;
      });
    }
    if (search && partCodeSearchResults === null) {
      const q = search.toLowerCase();
      result = result.filter(r => {
        const partsStr = Array.isArray(r.parts) ? r.parts.map(p => `${p.partCode} ${p.partName}`).join(' ') : (r.partCode || '');
        const hay = [r.workItemCode, r.workItemName, r.productCategoryCode, r.productCategoryName, r.idmsProductCategoryCode, partsStr]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [data, search, filterKategori, partCodeSearchResults]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'totalLaborPrice') {
          aVal = calculateLaborPrice(a.laborHour);
          bVal = calculateLaborPrice(b.laborHour);
        } else {
          aVal = a[sortConfig.key];
          bVal = b[sortConfig.key];
        }
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [filteredData, sortConfig, partCodeSearchResults]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const pagedData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, filterKategori, partCodeSearchResults]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return null;
    return (
      <span className="ml-1 text-zinc-400">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const columns = [
    { key: 'workItemCode', label: 'Kode Jasa', sortable: true },
    { key: 'workItemName', label: 'Nama Pekerjaan', sortable: true },
    { key: 'parts', label: 'Part Code (Sparepart)', sortable: false },
    { key: 'productCategoryCode', label: 'Kode Kategori', sortable: true },
    { key: 'productCategoryName', label: 'Kategori Kendaraan', sortable: true },
    { key: 'laborHour', label: 'Labor Hour', sortable: true },
    { key: 'totalLaborPrice', label: 'Total Harga Jasa (285K/jam)', sortable: true },
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col flex-1 overflow-hidden">

        {/* TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-zinc-200 bg-zinc-50/50 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* SEARCH 1: General search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (searchPartCode) setSearchPartCode('');
                }}
                placeholder="Cari kode, nama pekerjaan, kategori..."
                className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-zinc-900 transition-all placeholder:text-zinc-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* SEARCH 2: Fast Part Code API search */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[280px] max-w-sm">
              <div className="relative flex-1">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                <input
                  type="text"
                  value={searchPartCode}
                  onChange={(e) => {
                    setSearchPartCode(e.target.value);
                    if (!e.target.value.trim()) {
                      setPartCodeSearchResults(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (search) setSearch('');
                      handlePartCodeSearch(searchPartCode);
                    }
                  }}
                  placeholder="Part Code (misal: 602002777)..."
                  className="w-full bg-white border border-emerald-300 rounded-lg pl-9 pr-8 py-2 text-xs font-semibold outline-none focus:border-emerald-600 transition-all placeholder:text-zinc-400 text-emerald-900 bg-emerald-50/20"
                />
                {searchPartCode && (
                  <button 
                    onClick={() => {
                      setSearchPartCode('');
                      setPartCodeSearchResults(null);
                    }} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  if (search) setSearch('');
                  handlePartCodeSearch(searchPartCode);
                }}
                disabled={isSearchingPart || !searchPartCode.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-1 shrink-0"
              >
                {isSearchingPart ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <Search size={11} />
                )}
                Cari Part
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Filter size={12} className="text-zinc-400" />
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-zinc-900 transition-all cursor-pointer appearance-none pr-7"
              >
                <option value="">Semua Kategori</option>
                  {kategoriList.map(k => (
                  <option key={k.code} value={k.code}>{k.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSyncing && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg animate-pulse flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin"/> update...
              </span>
            )}
            <button
              onClick={() => { setUseWorkItemsApi(v => !v); }}
              className={`px-2 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                useWorkItemsApi
                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-500'
              }`}
              title="Toggle API endpoint (workItems vs workItemProductCategories)"
            >
              {useWorkItemsApi ? 'API: workItems' : 'API: default'}
            </button>
            <button
              onClick={handleExport}
              disabled={isLoading || sortedData.length === 0}
              className="p-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-all disabled:opacity-40"
              title="Export ke Excel"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-all disabled:opacity-40"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 shrink-0">
          {[
            { label: 'Total Item Jasa', value: data.length, icon: Wrench, color: 'text-zinc-700', bg: 'bg-zinc-50' },
            { label: 'Kategori Kendaraan', value: kategoriList.length, icon: Car, color: 'text-zinc-700', bg: 'bg-zinc-50' },
            { label: 'Ditampilkan', value: sortedData.length, icon: FileText, color: 'text-zinc-700', bg: 'bg-zinc-50' },
            { label: 'Tarif Jasa / Jam', value: 'Rp 285.000', icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-lg p-3.5">
              <div className={`w-7 h-7 ${s.bg} ${s.color} rounded-md flex items-center justify-center mb-1.5`}>
                <s.icon size={15} strokeWidth={2} />
              </div>
              <p className="text-base font-black text-zinc-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
              <p className="text-zinc-500 text-[9px] font-bold mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {isLoading && data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-400 font-bold">Memuat data Jasa Pengerjaan...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-red-300" />
              <p className="text-xs font-bold text-red-400">Gagal memuat data: {error}</p>
              <button onClick={() => fetchData(true)} className="text-xs font-bold text-zinc-600 underline hover:text-zinc-900">Coba Lagi</button>
            </div>
          ) : pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-zinc-300" />
              <p className="text-xs font-bold text-zinc-400">Tidak ada data Jasa Pengerjaan</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[950px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                  <th className="w-10 pl-4 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-zinc-500">#</th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={`text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-zinc-900 select-none' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pagedData.map((row, i) => {
                  const kat = getStyleByKategori(row.productCategoryName);
                  const totalPrice = calculateLaborPrice(row.laborHour);
                  const rowId = row.workItemId || row.id;

                  // Extract part codes from all potential DMS response fields
                  let partCodes = [];
                  if (Array.isArray(row.parts) && row.parts.length > 0) {
                    partCodes = row.parts.map(p => typeof p === 'string' ? p : p?.partCode).filter(Boolean);
                  } else if (Array.isArray(row.workItemParts) && row.workItemParts.length > 0) {
                    partCodes = row.workItemParts.map(p => typeof p === 'string' ? p : p?.partCode).filter(Boolean);
                  } else if (Array.isArray(row.productCategories)) {
                    row.productCategories.forEach(cat => {
                      if (Array.isArray(cat.parts)) {
                        cat.parts.forEach(p => {
                          if (p && p.partCode && !partCodes.includes(p.partCode)) partCodes.push(p.partCode);
                        });
                      }
                    });
                  } else if (Array.isArray(row.partCodes) && row.partCodes.length > 0) {
                    partCodes = row.partCodes.filter(Boolean);
                  } else if (row.partCode) {
                    partCodes = String(row.partCode).split(',').map(s => s.trim()).filter(Boolean);
                  }

                  return (
                    <tr key={rowId || i} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="pl-4 py-2.5 text-center text-zinc-400 font-medium text-[10px]">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.workItemCode || '-'}</td>
                      <td className="px-3 py-2.5 text-zinc-700 text-xs max-w-[280px] font-medium">{row.workItemName || row.workItemLocalName || '-'}</td>
                      
                      {/* PART CODE (SPAREPART) DIRECT COLUMN */}
                      <td className="px-3 py-2.5 text-xs">
                        {partCodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[260px]">
                            {partCodes.map((pc, idx) => (
                              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[10px] font-bold text-emerald-900">
                                <Package size={9} className="mr-1 text-emerald-600" />
                                {pc}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 font-mono text-zinc-600 whitespace-nowrap text-[10px]">{row.productCategoryCode || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${kat.bg} ${kat.text} ${kat.border}`}>
                          {kat.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                          <Clock size={9} />
                          {formatLaborHour(row.laborHour)}
                        </span>
                      </td>

                      {/* TOTAL HARGA JASA COLUMN */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border bg-emerald-50 text-emerald-800 border-emerald-200">
                          {formatRp(totalPrice)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
            <p className="text-xs text-zinc-500">
              {`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sortedData.length)} dari ${sortedData.length.toLocaleString()} item`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL & SPAREPART MODAL */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold">
                  <Wrench size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900">Rincian Jasa & Sparepart</h3>
                  <p className="text-[10px] text-zinc-400 font-medium">Kode: {selectedDetail.workItemCode || '-'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block uppercase">Nama Pekerjaan</span>
                  <span className="font-bold text-zinc-900">{selectedDetail.workItemName || selectedDetail.workItemLocalName || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block uppercase">Kategori Kendaraan</span>
                  <span className="font-bold text-zinc-900">{selectedDetail.productCategoryName || selectedDetail.productCategoryCode || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block uppercase">Labor Hour</span>
                  <span className="font-bold text-amber-700">{formatLaborHour(selectedDetail.laborHour)} ({selectedDetail.laborHour || 0} menit)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block uppercase">Total Harga Jasa</span>
                  <span className="font-extrabold text-emerald-700">{formatRp(calculateLaborPrice(selectedDetail.laborHour))}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package size={14} className="text-zinc-600" />
                  Daftar Sparepart Terkait ({Array.isArray(selectedDetail.parts) ? selectedDetail.parts.length : 0})
                </h4>

                {Array.isArray(selectedDetail.parts) && selectedDetail.parts.length > 0 ? (
                  <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100">
                    {selectedDetail.parts.map((part, pIdx) => (
                      <div key={part.partId || pIdx} className="p-3 bg-white hover:bg-zinc-50/80 transition-colors flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-2 py-0.5 rounded bg-zinc-900 text-white font-mono text-[10px] font-bold mb-1">
                            {part.partCode}
                          </span>
                          <p className="font-bold text-zinc-800 truncate">{part.partName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                    <p className="text-xs font-medium text-zinc-400">Tidak ada sparepart khusus yang tertaut untuk ID pekerjaan ini.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT PROGRESS MODAL */}
      {exportState && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Download size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900">Export Excel</h3>
                <p className="text-[10px] text-zinc-400 font-medium">{exportState.label}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-zinc-600">{exportState.phase === 'generating' ? `Memproses ${exportState.progress} / ${exportState.total}` : 'Selesai'}</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                {exportState.phase === 'generating' ? (
                  <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: `${Math.min(100, (exportState.progress / exportState.total) * 100)}%` }} />
                ) : (
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default WorkItemServicePage;

