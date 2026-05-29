import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, Clock, CheckCircle2, AlertCircle, Filter, X } from 'lucide-react';

async function fetchWarranty(params) {
  const res = await fetch(`/api/warranty?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

const STATUS_COLORS = {
  'open':       { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Open' },
  'estimasi':   { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Estimasi' },
  'approved':   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Approved' },
  'progress':   { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'In Progress' },
  'checker':    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Checker' },
  'selesai':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Selesai' },
  'closed':     { bg: 'bg-zinc-100',  text: 'text-zinc-600',   border: 'border-zinc-200',   label: 'Closed' },
};

function getStatusStyle(status) {
  const key = (status || '').toLowerCase();
  return STATUS_COLORS[key] || { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200', label: status || '-' };
}

function formatDate(val) {
  if (!val || val === '0000-00-00 00:00:00') return '-';
  try {
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
}

export default function WarrantyPanel() {
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        endpoint: 'work-order',
        draw: page + 1,
        start: page * pageSize,
        length: pageSize,
        search: search,
        status: statusFilter,
        from: fromDate,
        to: toDate,
      });
      const json = await fetchWarranty(params);
      setData(json.data || []);
      setTotalRecords(json.recordsFiltered || json.recordsTotal || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalRecords / pageSize);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const hasActiveFilters = search || statusFilter || fromDate || toDate;

  return (
    <div className="w-full h-full flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight">Warranty Work Order</h1>
            <p className="text-xs text-zinc-400 font-medium">
              {isLoading ? 'Memuat...' : `${totalRecords.toLocaleString()} total data`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari WO, plat, nama..."
                className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white w-56 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors">
              Cari
            </button>
          </form>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${showFilter || hasActiveFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
          >
            <Filter size={15} />
            Filter
            {hasActiveFilters && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-wrap items-end gap-4 shrink-0">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"
            >
              <option value="">Semua Status</option>
              <option value="open">Open</option>
              <option value="estimasi">Estimasi</option>
              <option value="approved">Approved</option>
              <option value="progress">In Progress</option>
              <option value="checker">Checker</option>
              <option value="selesai">Selesai</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200">
              <X size={14} /> Reset Filter
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Gagal memuat data</p>
            <p className="text-xs text-red-500">{error}</p>
          </div>
          <button onClick={fetchData} className="ml-auto px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
            Coba Lagi
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400 font-medium">Memuat data warranty...</p>
          </div>
        ) : data.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ShieldCheck size={40} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada data ditemukan</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. WO</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. WO DMS</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Pelanggan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Polisi</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Chassis</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kendaraan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Masuk</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Mulai</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Selesai</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Mekanik</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Leader</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.map((row, i) => {
                    const statusStyle = getStatusStyle(row.status);
                    return (
                      <tr key={i} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">{row.no_wo || '-'}</td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{row.no_wo_dms || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_pelanggan || '-'}</td>
                        <td className="px-4 py-3 font-mono text-zinc-700 whitespace-nowrap">{row.no_polisi || '-'}</td>
                        <td className="px-4 py-3 font-mono text-zinc-600 text-xs whitespace-nowrap">{row.no_chassis || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_kendaraan || '-'}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_masuk)}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_mulai)}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_selesai)}</td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_mekanik1 || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_leader1 || '-'}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-zinc-200 px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">
            Menampilkan {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRecords)} dari {totalRecords.toLocaleString()} data
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-zinc-700 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
