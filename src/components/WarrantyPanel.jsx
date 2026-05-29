import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, AlertCircle, Filter, X, Car, Wrench, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { getStatusStyle, getKategoriStyle, formatDate, formatKm, fetchWarrantyAPI } from '../utils/warrantyConfig';

export default function WarrantyPanel() {
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
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
        kategori: kategoriFilter,
        from: fromDate,
        to: toDate,
      });
      const json = await fetchWarrantyAPI(params);
      setData(json.data || []);
      setTotalRecords(json.recordsFiltered || json.recordsTotal || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, kategoriFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(totalRecords / pageSize);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setStatusFilter('');
    setKategoriFilter(''); setFromDate(''); setToDate(''); setPage(0);
  };

  const hasActiveFilters = search || statusFilter || kategoriFilter || fromDate || toDate;

  return (
    <div className="w-full h-full flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-900 tracking-tight">Work Order Warranty</h1>
            <p className="text-xs text-zinc-400">{isLoading ? 'Memuat...' : `${totalRecords.toLocaleString()} total WO`}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="No. WO, plat, chassis, nama..."
                className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white w-52 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors">Cari</button>
          </form>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${showFilter || hasActiveFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
          >
            <Filter size={14} /> Filter {hasActiveFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>}
          </button>
          <button onClick={fetchData} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="bg-white border-b border-zinc-200 px-6 py-3 flex flex-wrap items-end gap-3 shrink-0">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua Status</option>
              <option value="Open">Open</option>
              <option value="Ready">Ready</option>
              <option value="In Progress">In Progress</option>
              <option value="Checker">Checker</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kategori</label>
            <select value={kategoriFilter} onChange={(e) => { setKategoriFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua Kategori</option>
              <option value="IFS">IFS</option>
              <option value="IKC">IKC</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Dari</label>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sampai</label>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900" />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors">
              <X size={13} /> Reset
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
          <button onClick={fetchData} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400">Memuat data...</p>
          </div>
        ) : data.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ShieldCheck size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada data</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="w-8"></th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. WO</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kategori</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Pelanggan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Polisi</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kendaraan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">KM</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Mekanik</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Waktu Masuk</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.map((row, i) => {
                    const s = getStatusStyle(row.status);
                    const k = getKategoriStyle(row.kategori);
                    const isExpanded = expandedRow === i;
                    return (
                      <React.Fragment key={i}>
                        <tr
                          className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isExpanded ? 'bg-zinc-50' : ''}`}
                          onClick={() => setExpandedRow(isExpanded ? null : i)}
                        >
                          <td className="pl-3 pr-1 py-3 text-zinc-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">{row.no_wo || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${k.bg} ${k.text} ${k.border}`}>{k.label}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700 whitespace-nowrap max-w-[160px] truncate">{row.nama_pelanggan || '-'}</td>
                          <td className="px-4 py-3 font-mono text-zinc-700 whitespace-nowrap">{row.no_polisi || '-'}</td>
                          <td className="px-4 py-3 text-zinc-600 whitespace-nowrap max-w-[180px] truncate">{row.nama_kendaraan || '-'}</td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-xs">{formatKm(row.stand_km)}</td>
                          <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_mekanik1 || '-'}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_masuk)}</td>
                          <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="bg-zinc-50 border-b border-zinc-200">
                            <td colSpan={11} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                {/* Kendaraan */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5"><Car size={11} /> Kendaraan</p>
                                  <div className="space-y-1">
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">No. Chassis</span><span className="font-mono text-zinc-700 text-xs">{row.no_chassis || '-'}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">No. Engine</span><span className="font-mono text-zinc-700 text-xs">{row.no_engine || '-'}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Tahun</span><span className="text-zinc-700">{row.tahun_produksi || '-'}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">KM Masuk</span><span className="text-zinc-700">{formatKm(row.stand_km)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">No. WO DMS</span><span className="text-zinc-700 text-xs">{row.no_wo_dms || '-'}</span></div>
                                  </div>
                                </div>

                                {/* Pengerjaan */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5"><Wrench size={11} /> Pengerjaan</p>
                                  <div className="space-y-1">
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Mekanik</span><span className="text-zinc-700">{row.nama_mekanik1 || '-'}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Leader</span><span className="text-zinc-700">{row.nama_leader1 || '-'}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">SA</span><span className="text-zinc-700">{row.id_karyawan || '-'}</span></div>
                                    {row.keluhan && <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Keluhan</span><span className="text-zinc-700 text-xs">{row.keluhan}</span></div>}
                                    {row.perintah && <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Perintah</span><span className="text-zinc-700 text-xs whitespace-pre-line">{row.perintah}</span></div>}
                                  </div>
                                </div>

                                {/* Timeline */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5"><Clock size={11} /> Timeline</p>
                                  <div className="space-y-1">
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Masuk</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_masuk)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Simpan Est.</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_simpan_estimasi)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Setujui Est.</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_setujui_estimasi)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Mulai</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_mulai)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Checker</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_checker)}</span></div>
                                    <div className="flex gap-2"><span className="text-zinc-400 w-28 shrink-0">Selesai</span><span className="text-zinc-700 text-xs">{formatDate(row.waktu_selesai)}</span></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRecords)} dari {totalRecords.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
