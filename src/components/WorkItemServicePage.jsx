import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, FileText, Wrench, ChevronLeft, ChevronRight,
  X, Clock, Car, Filter
} from 'lucide-react';

const PAGE_SIZE = 50;

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

const WorkItemServicePage = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'workItemCode', direction: 'asc' });
  const [filterKategori, setFilterKategori] = useState('');
  const [lastFetchTime, setLastFetchTime] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/chery_dms?endpoint=work-item-categories&pageIndex=0&pageSize=10000&status=1&sortField=workItemCode&_=${Date.now()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Respons server bukan JSON (HTTP ${resp.status})`);
      }
      const result = await resp.json();
      const items = result?.payload?.content || [];
      setData(items);
      setLastFetchTime(new Date());
    } catch (err) {
      console.error('[WorkItemService] Fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedKey = 'work_item_categories_cache';
    try {
      const cached = sessionStorage.getItem(cachedKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 300000) {
          setData(parsed.data);
          setLastFetchTime(new Date(parsed.ts));
          setIsLoading(false);
          return;
        }
      }
    } catch {}
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data.length > 0) {
      try {
        sessionStorage.setItem('work_item_categories_cache', JSON.stringify({ data, ts: Date.now() }));
      } catch {}
    }
  }, [data]);

  const kategoriList = useMemo(() => {
    const set = new Set(data.map(d => d.productCategoryName).filter(Boolean));
    return [...set].sort();
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data;
    if (filterKategori) {
      result = result.filter(r => r.productCategoryName === filterKategori);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => {
        const hay = [r.workItemCode, r.workItemName, r.productCategoryCode, r.productCategoryName, r.idmsProductCategoryCode]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [data, search, filterKategori]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
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
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const pagedData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, filterKategori]);

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
    { key: 'productCategoryCode', label: 'Kode Kategori', sortable: true },
    { key: 'productCategoryName', label: 'Kategori Kendaraan', sortable: true },
    { key: 'laborHour', label: 'Labor Hour', sortable: true },
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col flex-1 overflow-hidden">

        {/* TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-zinc-200 bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode, nama pekerjaan, kategori..."
                className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 text-xs font-medium outline-none focus:border-zinc-900 transition-all placeholder:text-zinc-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter size={12} className="text-zinc-400" />
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 text-xs font-medium outline-none focus:border-zinc-900 transition-all cursor-pointer appearance-none pr-7"
              >
                <option value="">Semua Kategori</option>
                {kategoriList.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastFetchTime && (
              <span className="text-[9px] font-medium text-zinc-400 flex items-center gap-1">
                <Clock size={10} />
                {lastFetchTime.toLocaleTimeString('id-ID')}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 shrink-0">
          {[
            { label: 'Total Item', value: data.length, icon: Wrench, color: 'text-zinc-700', bg: 'bg-zinc-50' },
            { label: 'Kategori', value: kategoriList.length, icon: Car, color: 'text-zinc-700', bg: 'bg-zinc-50' },
            { label: 'Ditampilkan', value: sortedData.length, icon: FileText, color: 'text-zinc-700', bg: 'bg-zinc-50' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className={`w-8 h-8 ${s.bg} ${s.color} rounded-md flex items-center justify-center mb-2`}>
                <s.icon size={16} strokeWidth={2} />
              </div>
              <p className="text-lg font-black text-zinc-900">{s.value?.toLocaleString()}</p>
              <p className="text-zinc-500 text-[10px] font-medium mt-0.5 uppercase tracking-wider">{s.label}</p>
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
              <button onClick={fetchData} className="text-xs font-bold text-zinc-600 underline hover:text-zinc-900">Coba Lagi</button>
            </div>
          ) : pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-zinc-300" />
              <p className="text-xs font-bold text-zinc-400">Tidak ada data Jasa Pengerjaan</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[800px]">
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
                  return (
                    <tr key={row.id || row.workItemId || i} className="hover:bg-zinc-50 transition-colors">
                      <td className="pl-4 py-2.5 text-center text-zinc-400 font-medium text-[10px]">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.workItemCode || '-'}</td>
                      <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs max-w-[280px] truncate">{row.workItemName || row.workItemLocalName || '-'}</td>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default WorkItemServicePage;
