import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, BarChart2, Search, RefreshCw, AlertCircle,
  TrendingUp, Clock, CheckCircle2, FileText, Wrench,
  Filter, X, ChevronLeft, ChevronRight, Car, User,
  ChevronDown, ChevronUp, Key
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import {
  getStatusStyle, getKategoriStyle, STATUS_COLORS,
  formatDate, formatKm, fetchWarrantyAPI
} from '../utils/warrantyConfig';

const GLOBAL_WARRANTY_CACHE = { dashboard: null, workorder: {}, search: null, partsStatus: {} };

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 font-medium flex-1 break-words">{value || '-'}</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
export function WarrantyDashboardPage({ onNavigate }) {
  const [data, setData] = useState(() => GLOBAL_WARRANTY_CACHE.dashboard?.data || []);
  const [totalRecords, setTotalRecords] = useState(() => GLOBAL_WARRANTY_CACHE.dashboard?.totalRecords || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => GLOBAL_WARRANTY_CACHE.dashboard?.lastUpdated || null);
  const abortRef = useRef(null);

  const fetchInitial = useCallback(async (forceRefresh) => {
    if (!forceRefresh && GLOBAL_WARRANTY_CACHE.dashboard && GLOBAL_WARRANTY_CACHE.dashboard.data.length > 0) {
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ endpoint:'warranty-wo', draw:1, start:0, length:10000, fetchAll:'true', status:'', search:'', from:'', to:'' });
      const res = await fetch(`/api/chery_dms?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const newData = json.data || [];
      const newTotal = json.recordsTotal || newData.length;
      setData(newData);
      setTotalRecords(newTotal);
      setLastUpdated(new Date());
      GLOBAL_WARRANTY_CACHE.dashboard = { data: newData, totalRecords: newTotal, lastUpdated: new Date() };
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }

    // Preload invoice report in background (non-blocking)
    if (!GLOBAL_WARRANTY_CACHE.invoiceReport) {
      setIsLoadingMore(true);
      try {
        const invRes = await fetch('/api/chery_dms?endpoint=warranty-invoice-report', { signal: controller.signal });
        if (invRes.ok) {
          const invJson = await invRes.json();
          GLOBAL_WARRANTY_CACHE.invoiceReport = invJson;
        }
      } catch {}
      finally {
        if (abortRef.current === controller) setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchInitial();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchInitial]);

  const total = data.length;
  const statusCounts = data.reduce((acc, row) => {
    const k = (row.status || 'unknown').toLowerCase();
    acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});
  const activeCount = (statusCounts['open']||0)+(statusCounts['ready']||0)+(statusCounts['in progress']||0)+(statusCounts['checker']||0);
  const selesaiCount = statusCounts['selesai'] || 0;
  const closedCount  = statusCounts['closed']  || 0;
  const topMechanics = Object.entries(data.reduce((a,r)=>{ if(r.nama_mekanik1) a[r.nama_mekanik1]=(a[r.nama_mekanik1]||0)+1; return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topVehicles  = Object.entries(data.reduce((a,r)=>{ if(r.nama_kendaraan) a[r.nama_kendaraan]=(a[r.nama_kendaraan]||0)+1; return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const recentWOs    = [...data].sort((a,b)=>new Date(b.last_update||0)-new Date(a.last_update||0)).slice(0,8);
  const statCards = [
    { label:'Total WO',  value: totalRecords || total, icon:FileText,    color:'bg-zinc-900' },
    { label:'Aktif',     value: activeCount,            icon:Clock,       color:'bg-blue-600' },
    { label:'Selesai',   value: selesaiCount,           icon:CheckCircle2,color:'bg-green-600' },
    { label:'Closed',    value: closedCount,            icon:ShieldCheck, color:'bg-zinc-500' },
  ];

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-12">
      <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-zinc-400">Memuat dashboard...</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"><AlertCircle size={15} className="text-red-500 shrink-0"/><p className="text-sm text-red-700 flex-1">{error}</p><button onClick={() => fetchInitial(true)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button></div>}
      {isLoadingMore && <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-100 rounded-xl px-4 py-2"><div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>Memuat data lengkap di background...</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(c => { const Icon=c.icon; return (
          <div key={c.label} className={`${c.color} rounded-2xl p-4 flex items-center justify-between shadow-sm`}>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p><p className="text-2xl font-black mt-1 text-white">{c.value}</p></div>
            <Icon size={28} className="text-white opacity-25"/>
          </div>
        );})}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
        <h2 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-3">Distribusi Status</h2>
        <div className="space-y-2.5">
          {Object.entries(STATUS_COLORS).map(([key, style]) => {
            const count = statusCounts[key] || 0;
            const pct = total > 0 ? Math.round((count/total)*100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}></div>
                <span className="text-xs text-zinc-700 font-medium w-24 shrink-0">{style.label}</span>
                <div className="flex-1 bg-zinc-100 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${style.dot}`} style={{width:`${pct}%`}}></div></div>
                <span className="text-xs font-bold text-zinc-900 w-7 text-right">{count}</span>
                <span className="text-[10px] text-zinc-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><Wrench size={14} className="text-zinc-500"/><h2 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Top Mekanik</h2></div>
          <div className="space-y-2.5">{topMechanics.map(([name,count],i)=>(
            <div key={name} className="flex items-center gap-2"><span className="text-[10px] font-black text-zinc-400 w-4">{i+1}</span><span className="text-xs text-zinc-700 font-medium flex-1 truncate">{name}</span><div className="w-20 bg-zinc-100 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-zinc-900 rounded-full" style={{width:`${total>0?Math.round((count/total)*100):0}%`}}></div></div><span className="text-xs font-bold text-zinc-900 w-5 text-right">{count}</span></div>
          ))}</div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={14} className="text-zinc-500"/><h2 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Top Kendaraan</h2></div>
          <div className="space-y-2.5">{topVehicles.map(([name,count],i)=>(
            <div key={name} className="flex items-center gap-2"><span className="text-[10px] font-black text-zinc-400 w-4">{i+1}</span><span className="text-xs text-zinc-700 font-medium flex-1 truncate">{name}</span><div className="w-20 bg-zinc-100 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-zinc-900 rounded-full" style={{width:`${total>0?Math.round((count/total)*100):0}%`}}></div></div><span className="text-xs font-bold text-zinc-900 w-5 text-right">{count}</span></div>
          ))}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xs font-black text-zinc-900 uppercase tracking-wider">WO Terbaru</h2>
          {onNavigate && <button onClick={() => onNavigate('warranty-wo')} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors">Lihat Semua →</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-50 border-b border-zinc-100">{['No. WO','Status','Pelanggan','Kendaraan','No. Polisi','Update'].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-zinc-50">
              {recentWOs.map((row,i)=>{ const s=getStatusStyle(row.status); return (
                <tr key={i} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.no_wo||'-'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span></td>
                  <td className="px-4 py-2.5 text-zinc-700 whitespace-nowrap text-xs max-w-[130px] truncate">{row.nama_pelanggan||'-'}</td>
                  <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap text-xs max-w-[150px] truncate">{row.nama_kendaraan||'-'}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-600 whitespace-nowrap text-xs">{row.no_polisi||'-'}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Work Order Page ──────────────────────────────────────────
export function WarrantyWorkOrderPage() {
  const [data, setData] = useState(() => GLOBAL_WARRANTY_CACHE.workorder[`0_____`]?.data || []);
  const [totalRecords, setTotalRecords] = useState(() => GLOBAL_WARRANTY_CACHE.workorder[`0_____`]?.totalRecords || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [sparepartFilter, setSparepartFilter] = useState(() => GLOBAL_WARRANTY_CACHE.lastSparepartFilter || 'all');
  const [partsStatus, setPartsStatus] = useState(() => ({...GLOBAL_WARRANTY_CACHE.partsStatus}));
  const [loadingParts, setLoadingParts] = useState(false);
  const fetchAbortRef = useRef(null);
  const partsAbortRef = useRef(null);

  const getWOCacheKey = () => `${page}_${search}_${statusFilter}_${kategoriFilter}_${fromDate}_${toDate}`;

  const fetchData = useCallback(async (forceRefresh) => {
    const wk = getWOCacheKey();
    if (!forceRefresh && GLOBAL_WARRANTY_CACHE.workorder[wk]) {
      const cached = GLOBAL_WARRANTY_CACHE.workorder[wk];
      setData(cached.data);
      setTotalRecords(cached.totalRecords);
      return;
    }
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ endpoint:'work-order', draw:page+1, start:page*pageSize, length:pageSize, search, status:statusFilter, kategori:kategoriFilter, from:fromDate, to:toDate });
      const res = await fetch(`/api/chery_dms?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const newData = json.data || [];
      const newTotal = json.recordsFiltered || json.recordsTotal || 0;
      setData(newData);
      setTotalRecords(newTotal);
      GLOBAL_WARRANTY_CACHE.workorder[wk] = { data: newData, totalRecords: newTotal };
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (fetchAbortRef.current === controller) setIsLoading(false);
    }
  }, [page, search, statusFilter, kategoriFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
    return () => { if (fetchAbortRef.current) fetchAbortRef.current.abort(); };
  }, [fetchData, page]);

  const loadPartsStatus = useCallback(async (woList) => {
    const toLoad = woList.filter(wo => wo.no_wo && !GLOBAL_WARRANTY_CACHE.partsStatus[wo.no_wo]);
    if (toLoad.length === 0) return;
    if (partsAbortRef.current) partsAbortRef.current.abort();
    const controller = new AbortController();
    partsAbortRef.current = controller;

    setLoadingParts(true);
    toLoad.forEach(wo => { GLOBAL_WARRANTY_CACHE.partsStatus[wo.no_wo] = { loading: true }; });
    setPartsStatus({...GLOBAL_WARRANTY_CACHE.partsStatus});
    const batchSize = 35;
    for (let i = 0; i < toLoad.length; i += batchSize) {
      if (controller.signal.aborted) break;
      const batch = toLoad.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (wo) => {
        try {
          const res = await fetch(`/api/chery_dms?endpoint=warranty-estimasi-detail&id=${wo.id_wo}`, { signal: controller.signal });
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          const parts = json.parts || [];
          let status;
          if (parts.length === 0) {
            status = 'perlu_diisi';
          } else {
            const allFulfilled = parts.every(p =>
              ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(p.status_permintaan || p.status)
            );
            status = allFulfilled ? 'dipenuhi' : 'belum_dipenuhi';
          }
          GLOBAL_WARRANTY_CACHE.partsStatus[wo.no_wo] = { loading: false, status, parts };
        } catch {
          GLOBAL_WARRANTY_CACHE.partsStatus[wo.no_wo] = { loading: false, status: 'perlu_diisi', parts: [] };
        }
      }));
    }
    setPartsStatus({...GLOBAL_WARRANTY_CACHE.partsStatus});
    setLoadingParts(false);
  }, []);

  useEffect(() => {
    GLOBAL_WARRANTY_CACHE.lastSparepartFilter = sparepartFilter;
    if (sparepartFilter !== 'all' && data.length > 0) {
      loadPartsStatus(data);
    }
  }, [sparepartFilter, data, loadPartsStatus]);

  const totalPages = Math.ceil(totalRecords / pageSize);
  const hasActiveFilters = search || statusFilter || kategoriFilter || fromDate || toDate || sparepartFilter !== 'all';
  const clearFilters = () => { setSearch(''); setSearchInput(''); setStatusFilter(''); setKategoriFilter(''); setFromDate(''); setToDate(''); setSparepartFilter('all'); setPage(0); };
  const displayData = (sparepartFilter === 'all')
    ? data
    : data.filter(wo => {
        const ps = partsStatus[wo.no_wo];
        return ps && !ps.loading && ps.status === sparepartFilter;
      });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex flex-wrap items-center gap-2 shrink-0">
        <form onSubmit={e=>{e.preventDefault();setSearch(searchInput);setPage(0);}} className="flex items-center gap-2">
          <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input type="text" value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="No. WO, plat, chassis, nama..." className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52 text-zinc-900"/></div>
          <button type="submit" className="px-3 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors">Cari</button>
        </form>
        <button onClick={()=>setShowFilter(!showFilter)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${showFilter||hasActiveFilters?'bg-zinc-900 text-white border-zinc-900':'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}><Filter size={13}/> Filter {hasActiveFilters&&<span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>}</button>
        <button onClick={() => fetchData(true)} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors ml-auto"><RefreshCw size={14} className={isLoading?'animate-spin':''}/></button>
        <span className="text-xs text-zinc-400">{isLoading?'Memuat...': sparepartFilter !== 'all' ? `${displayData.length} WO (dari ${totalRecords.toLocaleString()})` : `${totalRecords.toLocaleString()} WO`}</span>
      </div>

      {showFilter && (
        <div className="bg-white border-b border-zinc-200 px-4 py-3 flex flex-wrap items-end gap-3 shrink-0">
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Status</label>
            <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(0);}} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua</option><option value="Open">Open</option><option value="Ready">Ready</option><option value="In Progress">In Progress</option><option value="Checker">Checker</option><option value="Selesai">Selesai</option>
            </select></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kategori</label>
            <select value={kategoriFilter} onChange={e=>{setKategoriFilter(e.target.value);setPage(0);}} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua</option><option value="IFS">IFS</option><option value="IKC">IKC</option><option value="EUR">EUR</option>
            </select></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sparepart</label>
            <select value={sparepartFilter} onChange={e=>{setSparepartFilter(e.target.value);setPage(0);if(e.target.value!=='all'&&data.length>0)setLoadingParts(true);}} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="all">Semua</option><option value="dipenuhi">Dipenuhi</option><option value="belum_dipenuhi">Belum Dipenuhi</option><option value="perlu_diisi">Perlu Diisi</option>
            </select></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Dari</label><input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setPage(0);}} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sampai</label><input type="date" value={toDate} onChange={e=>{setToDate(e.target.value);setPage(0);}} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/></div>
          {hasActiveFilters && <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors"><X size={13}/> Reset</button>}
        </div>
      )}

      {error && <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0"><AlertCircle size={14} className="text-red-500 shrink-0"/><p className="text-sm text-red-700 flex-1">{error}</p><button onClick={() => fetchData(true)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button></div>}
      {loadingParts && sparepartFilter !== 'all' && (
        <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-zinc-400 bg-zinc-100 rounded-xl px-4 py-2"><div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>Memuat status sparepart...</div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading && data.length===0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4"><div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div><p className="text-sm text-zinc-400">Memuat data...</p></div>
        ) : sparepartFilter !== 'all' && displayData.length === 0 && !loadingParts ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3"><Filter size={36} className="text-zinc-300"/><p className="text-sm font-bold text-zinc-400">Tidak ada WO dengan status sparepart yang dipilih</p></div>
        ) : sparepartFilter !== 'all' && loadingParts && displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3"><div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div><p className="text-sm font-bold text-zinc-400">Memuat status sparepart...</p></div>
        ) : data.length===0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3"><ShieldCheck size={36} className="text-zinc-300"/><p className="text-sm font-bold text-zinc-400">Tidak ada data</p></div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="w-8"></th>
                  {['No. WO','Kat.','Sparepart','Status','Pelanggan','No. Polisi','Kendaraan','KM','Mekanik','Masuk','Update'].map(h=><th key={h} className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {displayData.map((row,i)=>{
                    const s=getStatusStyle(row.status); const k=getKategoriStyle(row.kategori); const isExp=expandedRow===i;
                    const ps = partsStatus[row.no_wo];
                    return (
                      <React.Fragment key={i}>
                        <tr className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isExp?'bg-zinc-50':''}`} onClick={()=>setExpandedRow(isExp?null:i)}>
                          <td className="pl-3 pr-1 py-2.5 text-zinc-400">{isExp?<ChevronUp size={12}/>:<ChevronDown size={12}/>}</td>
                          <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{row.no_wo||'-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${k.bg} ${k.text} ${k.border}`}>{k.label}</span></td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{(ps && !ps.loading) ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${ps.status === 'dipenuhi' ? 'bg-green-50 text-green-700 border-green-200' : ps.status === 'belum_dipenuhi' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {ps.status === 'dipenuhi' ? 'Dipenuhi' : ps.status === 'belum_dipenuhi' ? 'Belum Dipenuhi' : 'Perlu Diisi'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-300">-</span>
                          )}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span></td>
                          <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs max-w-[120px] truncate">{row.nama_pelanggan||'-'}</td>
                          <td className="px-3 py-2.5 font-mono text-zinc-700 whitespace-nowrap text-xs">{row.no_polisi||'-'}</td>
                          <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs max-w-[140px] truncate">{row.nama_kendaraan||'-'}</td>
                          <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs">{formatKm(row.stand_km)}</td>
                          <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs">{row.nama_mekanik1||'-'}</td>
                          <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_masuk)}</td>
                          <td className="px-3 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
                        </tr>
                        {isExp && (
                          <tr className="bg-zinc-50 border-b border-zinc-200">
                            <td colSpan={12} className="px-5 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1"><Car size={10}/> Kendaraan</p>
                                  {[['Chassis',row.no_chassis],['Engine',row.no_engine],['Tahun',row.tahun_produksi],['KM',formatKm(row.stand_km)],['WO DMS',row.no_wo_dms]].map(([l,v])=><div key={l} className="flex gap-2 py-0.5"><span className="text-zinc-400 w-20 shrink-0 text-xs">{l}</span><span className="text-zinc-700 text-xs font-mono">{v||'-'}</span></div>)}
                                </div>
                                <div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1"><Wrench size={10}/> Pengerjaan</p>
                                  {[['SA',row.id_karyawan],['Mekanik',row.nama_mekanik1],['Leader',row.nama_leader1]].map(([l,v])=><div key={l} className="flex gap-2 py-0.5"><span className="text-zinc-400 w-20 shrink-0 text-xs">{l}</span><span className="text-zinc-700 text-xs">{v||'-'}</span></div>)}
                                  {row.keluhan && <div className="flex gap-2 py-0.5"><span className="text-zinc-400 w-20 shrink-0 text-xs">Keluhan</span><span className="text-zinc-700 text-xs">{row.keluhan}</span></div>}
                                  {row.perintah && <div className="flex gap-2 py-0.5"><span className="text-zinc-400 w-20 shrink-0 text-xs">Perintah</span><span className="text-zinc-700 text-xs whitespace-pre-line">{row.perintah}</span></div>}
                                </div>
                                <div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1"><Clock size={10}/> Timeline</p>
                                  {[['Masuk',row.waktu_masuk],['Simpan Est.',row.waktu_simpan_estimasi],['Setujui Est.',row.waktu_setujui_estimasi],['Mulai',row.waktu_mulai],['Checker',row.waktu_checker],['Selesai',row.waktu_selesai]].map(([l,v])=><div key={l} className="flex gap-2 py-0.5"><span className="text-zinc-400 w-24 shrink-0 text-xs">{l}</span><span className="text-zinc-700 text-xs">{formatDate(v)}</span></div>)}
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

      {(totalPages > 1 || sparepartFilter !== 'all') && (
        <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">{sparepartFilter !== 'all' ? `${page*pageSize+1}–${page*pageSize+displayData.length} WO` : `${page*pageSize+1}–${Math.min((page+1)*pageSize,totalRecords)} dari ${totalRecords.toLocaleString()}`}</p>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0||isLoading} className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={14}/></button>
            <span className="text-sm font-semibold text-zinc-700 px-2">{page+1} / {sparepartFilter !== 'all' ? '?' : totalPages}</span>
            <button onClick={()=>setPage(p=>Math.min((sparepartFilter!=='all'?999:totalPages)-1,p+1))} disabled={page>=totalPages-1||isLoading} className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Page ──────────────────────────────────────────────
export function WarrantySearchPage() {
  const [query, setQuery] = useState(() => GLOBAL_WARRANTY_CACHE.search?.query || '');
  const [searchType, setSearchType] = useState(() => GLOBAL_WARRANTY_CACHE.search?.searchType || 'all');
  const [results, setResults] = useState(() => GLOBAL_WARRANTY_CACHE.search?.results || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(() => !!GLOBAL_WARRANTY_CACHE.search?.hasSearched);
  const [selectedWO, setSelectedWO] = useState(() => GLOBAL_WARRANTY_CACHE.search?.selectedWO || null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true); setError(null); setHasSearched(true); setSelectedWO(null);
    try {
      const params = new URLSearchParams({ endpoint:'work-order', draw:1, start:0, length:100, search:query.trim(), status:'', from:'', to:'' });
      const json = await fetchWarrantyAPI(params);
      let data = json.data || [];
      if (searchType !== 'all') {
        const q = query.trim().toLowerCase();
        data = data.filter(row => (row[searchType]||'').toLowerCase().includes(q));
      }
      setResults(data);
      GLOBAL_WARRANTY_CACHE.search = { query: query.trim(), searchType, results: data, hasSearched: true, selectedWO: null };
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="bg-white border-b border-zinc-200 px-4 py-4 shrink-0">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <select value={searchType} onChange={e=>setSearchType(e.target.value)} className="px-3 py-2.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium md:w-44 shrink-0">
            <option value="all">Semua Field</option><option value="no_wo">No. WO</option><option value="no_polisi">No. Polisi</option><option value="no_chassis">No. Chassis / VIN</option><option value="nama_pelanggan">Nama Pelanggan</option>
          </select>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
            <input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari No. WO, plat, chassis, nama..." className="w-full pl-10 pr-10 py-2.5 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900" autoFocus/>
            {query && <button type="button" onClick={()=>{setQuery('');setResults([]);setHasSearched(false);setSelectedWO(null);GLOBAL_WARRANTY_CACHE.search=null;}} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"><X size={15}/></button>}
          </div>
          <button type="submit" disabled={isLoading||!query.trim()} className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0">{isLoading?'Mencari...':'Cari'}</button>
        </form>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 mb-4"><AlertCircle size={15} className="text-red-500 shrink-0"/><p className="text-sm text-red-700 flex-1">{error}</p></div>}
        {isLoading && <div className="flex flex-col items-center justify-center h-48 gap-4"><div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div><p className="text-sm text-zinc-400">Mencari...</p></div>}
        {!isLoading && !hasSearched && <div className="flex flex-col items-center justify-center h-64 gap-4 text-center"><div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center"><ShieldCheck size={32} className="text-zinc-400"/></div><p className="text-base font-bold text-zinc-500">Masukkan kata kunci pencarian</p><p className="text-sm text-zinc-400">No. WO, No. Polisi, No. Chassis, atau Nama Pelanggan</p></div>}
        {!isLoading && hasSearched && results.length===0 && !error && <div className="flex flex-col items-center justify-center h-48 gap-3"><Search size={36} className="text-zinc-300"/><p className="text-sm font-bold text-zinc-400">Tidak ada hasil untuk "{query}"</p></div>}

        {!isLoading && results.length > 0 && (
          <div className={`grid gap-4 ${selectedWO?'grid-cols-1 lg:grid-cols-2':'grid-cols-1'}`}>
            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{results.length} hasil ditemukan</p>
              {results.map((row,i)=>{ const s=getStatusStyle(row.status); const isSel=selectedWO?.no_wo===row.no_wo; return (
                <button key={i} onClick={()=>setSelectedWO(isSel?null:row)} className={`w-full text-left bg-white rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${isSel?'border-zinc-900 shadow-md':'border-zinc-200 hover:border-zinc-400'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><span className="font-black text-zinc-900 text-sm">{row.no_wo||'-'}</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span></div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><User size={11}/> {row.nama_pelanggan||'-'}</span>
                        <span className="flex items-center gap-1"><Car size={11}/> {row.no_polisi||'-'} · {row.nama_kendaraan||'-'}</span>
                        <span className="flex items-center gap-1"><Clock size={11}/> {formatDate(row.waktu_masuk)}</span>
                      </div>
                    </div>
                    <FileText size={15} className={isSel?'text-zinc-900':'text-zinc-300'}/>
                  </div>
                </button>
              );})}
            </div>
            {selectedWO && (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden h-fit sticky top-0">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                  <div><h2 className="font-black text-zinc-900 text-base">{selectedWO.no_wo}</h2><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border mt-1 ${getStatusStyle(selectedWO.status).bg} ${getStatusStyle(selectedWO.status).text} ${getStatusStyle(selectedWO.status).border}`}>{getStatusStyle(selectedWO.status).label}</span></div>
                  <button onClick={()=>setSelectedWO(null)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"><X size={18}/></button>
                </div>
                <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
                  {[['Kendaraan',[['No. WO DMS',selectedWO.no_wo_dms],['Kategori',selectedWO.kategori],['No. Polisi',selectedWO.no_polisi],['No. Chassis',selectedWO.no_chassis],['No. Engine',selectedWO.no_engine],['Kendaraan',selectedWO.nama_kendaraan],['Tahun',selectedWO.tahun_produksi],['KM Masuk',formatKm(selectedWO.stand_km)]]],
                    ['Pelanggan',[['Nama',selectedWO.nama_pelanggan],['No. Telp',selectedWO.no_telp_pelanggan],['Pembawa',selectedWO.nama_pembawa]]],
                    ['Tim',[['SA',selectedWO.id_karyawan],['Mekanik',selectedWO.nama_mekanik1],['Leader',selectedWO.nama_leader1],['Keluhan',selectedWO.keluhan],['Perintah',selectedWO.perintah]]],
                    ['Timeline',[['Masuk',formatDate(selectedWO.waktu_masuk)],['Simpan Est.',formatDate(selectedWO.waktu_simpan_estimasi)],['Setujui Est.',formatDate(selectedWO.waktu_setujui_estimasi)],['Mulai',formatDate(selectedWO.waktu_mulai)],['Checker',formatDate(selectedWO.waktu_checker)],['Selesai',formatDate(selectedWO.waktu_selesai)],['Last Update',formatDate(selectedWO.last_update)]]]
                  ].map(([section, rows]) => (
                    <div key={section} className="mb-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">{section}</p>
                      {rows.filter(([,v])=>v).map(([l,v])=><InfoRow key={l} label={l} value={v}/>)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Default export for backward compat
export default function WarrantyHub({ activeTab, handleChangePassword }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        {activeTab === 'wo' && <WarrantyWorkOrderPage />}
        {activeTab === 'search' && <WarrantySearchPage />}
        {!activeTab && <WarrantyDashboardPage />}
      </div>
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
    </div>
  );
}
