import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, RefreshCw, AlertCircle, Search, Filter, X,
  Calendar, DollarSign, CheckCircle2, XCircle, Loader2,
  ArrowLeft, ChevronRight, ShieldCheck, Wrench, Clock, Car
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────
const STATUS_MAP = {
  1: { label: 'Draft',        bg: 'bg-zinc-100',   text: 'text-zinc-600',    border: 'border-zinc-200' },
  2: { label: 'Submitted',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  3: { label: 'Under Review', bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  4: { label: 'Approved',     bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  5: { label: 'Rejected',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  6: { label: 'Paid',         bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  7: { label: 'Cancelled',    bg: 'bg-zinc-100',   text: 'text-zinc-500',    border: 'border-zinc-200' },
  8: { label: 'Pending',      bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  9: { label: 'Settled',      bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
};

const FREE_SERVICE_KEYWORDS = [
  'free service', '5000', '10000', '15000', '30000', '45000', '60000',
  'first maintenance', 'service pertama', 'service kedua', 'service ketiga', 'free 1000',
];

// ─── Helpers ──────────────────────────────────────────────────
const formatRupiah = val => {
  if (val == null || val === '') return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : 'Rp ' + n.toLocaleString('id-ID');
};

const formatDate = val => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    return isNaN(d) ? val : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return val; }
};

const getKategori = code => {
  if (!code) return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
  if (code.startsWith('BY')) return { label: 'Free Service', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  if (code.startsWith('BX')) return { label: 'Warranty',     bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200' };
  return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
};

const getStatus = s => STATUS_MAP[s] || { label: String(s || '-'), bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };

const isFreeService = p => p && FREE_SERVICE_KEYWORDS.some(kw => p.toLowerCase().includes(kw));

const getDefaultRange = () => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   fmt(new Date(now.getFullYear(), now.getMonth()+1, 0)),
  };
};

// ─── API ──────────────────────────────────────────────────────
const apiFetch = async (params) => {
  const res = await fetch(`/api/chery_dms?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
};

// ─── Detail Page ──────────────────────────────────────────────
function DetailPage({ settlement, onBack }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [vinData, setVinData] = useState({});
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const json = await apiFetch({ endpoint: 'proforma-detail', id: settlement.id });
      const payload = json.payload || json;
      // DMS detail has separate arrays for maintain (BY) and warranty (BX) orders
      const maintainOrders = payload.maintainOrders || [];
      const warrantyOrders = payload.warrantyOrders || [];
      const adjustmentOrders = payload.expenseAdjustmentOrders || [];
      // Combine all items with type tag
      const list = [
        ...maintainOrders.map(o => ({ ...o, _type: 'maintain' })),
        ...warrantyOrders.map(o => ({ ...o, _type: 'warranty' })),
        ...adjustmentOrders.map(o => ({ ...o, _type: 'adjustment' })),
      ];
      setItems(list);

      // Cross-ref VINs in background
      const vins = [...new Set(list.map(it => it.vin || it.vinCode || it.chassisNo).filter(Boolean))];
      vins.forEach(vin => {
        setVinData(prev => ({ ...prev, [vin]: { wos: [], loading: true } }));
        apiFetch({ endpoint: 'warranty-search-vin', vin, length: 50 })
          .then(r => setVinData(prev => ({ ...prev, [vin]: { wos: r.data || [], loading: false } })))
          .catch(() => setVinData(prev => ({ ...prev, [vin]: { wos: [], loading: false } })));
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settlement.id]);

  useEffect(() => { if (!loaded.current) { loaded.current = true; load(); } }, [load]);

  const code     = settlement.code || '-';
  const st       = getStatus(settlement.status);
  const totalFee = settlement.totalFee ?? 0;
  const laborFee = settlement.laborFee ?? 0;
  const matFee   = settlement.materialFee ?? 0;
  const mgmtFee  = settlement.mgmtFee ?? 0;
  const adjFee   = settlement.adjustmentFee ?? 0;
  const refFee   = settlement.totalRefusePayFee ?? 0;

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-5 py-4 flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors text-sm font-semibold">
          <ArrowLeft size={16}/> Kembali
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={17} className="text-white"/>
          </div>
          <div>
            <h1 className="text-base font-black text-zinc-900 leading-tight">{code}</h1>
            <p className="text-[10px] text-zinc-400">{settlement.dealerName || ''} · {formatDate(settlement.settlementMonth)}</p>
          </div>
        </div>
        <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 shrink-0">
        {[
          { label: 'Total Fee',    value: formatRupiah(totalFee), color: 'bg-zinc-900' },
          { label: 'Labor Fee',    value: formatRupiah(laborFee), color: 'bg-blue-600' },
          { label: 'Material Fee', value: formatRupiah(matFee),   color: 'bg-indigo-600' },
          { label: 'Mgmt Fee',     value: formatRupiah(mgmtFee),  color: 'bg-violet-600' },
          { label: 'Adjustment',   value: formatRupiah(adjFee),   color: 'bg-amber-600' },
          { label: 'Refused Fee',  value: formatRupiah(refFee),   color: 'bg-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.color} rounded-2xl p-3.5 shadow-sm`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p>
            <p className="text-sm font-black mt-1 text-white leading-tight">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-zinc-400">Memuat item claim...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle size={15} className="text-red-500 shrink-0"/>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={load} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText size={36} className="text-zinc-300"/>
            <p className="text-sm font-bold text-zinc-400">Tidak ada item claim</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <span>{items.filter(i => i._type === 'maintain').length} Free Service (BY)</span>
              <span>·</span>
              <span>{items.filter(i => i._type === 'warranty').length} Warranty (BX)</span>
              {items.filter(i => i._type === 'adjustment').length > 0 && <>
                <span>·</span>
                <span>{items.filter(i => i._type === 'adjustment').length} Adjustment</span>
              </>}
            </div>
            {items.map((item, idx) => {
              const itemCode = item.code || item.claimCode || '-';
              const kat      = getKategori(itemCode);

              // Adjustment orders have different structure
              if (item._type === 'adjustment') {
                return (
                  <div key={idx} className="bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3 flex flex-wrap items-center gap-3">
                    <span className="font-bold text-zinc-700 text-xs">{itemCode}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">Adjustment</span>
                    <span className={`text-xs font-bold ml-auto ${Number(item.totalFee) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(item.totalFee)}</span>
                  </div>
                );
              }

              const vin    = item.vin || item.vinCode || item.chassisNo || '';
              const vd     = vinData[vin] || { wos: [], loading: false };
              const matchWO = vd.wos.find(w => (w.no_chassis || '').toLowerCase() === vin.toLowerCase()) || vd.wos[0];
              const perintah = matchWO?.perintah || '';
              const isFree   = isFreeService(perintah);
              const ifsWO    = vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IFS');
              const ikcWO    = vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IKC');

              return (
                <div key={idx} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                  {/* Item header */}
                  <div className="px-5 py-4 border-b border-zinc-100 flex flex-wrap items-center gap-3">
                    <span className="font-black text-zinc-900 text-sm">{itemCode}</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${kat.bg} ${kat.text} ${kat.border}`}>{kat.label}</span>
                    {vin && <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-lg">{vin}</span>}
                    {item.isRefusePay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        <XCircle size={10}/> Refused
                      </span>
                    )}
                    {vd.loading ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 ml-auto">
                        <Loader2 size={10} className="animate-spin"/> cross-ref...
                      </span>
                    ) : perintah ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ml-auto ${isFree ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {isFree ? '✓ Free Service' : '✓ Warranty'}
                      </span>
                    ) : null}
                  </div>

                  {/* Item body */}
                  <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Pelanggan</p>
                      <p className="text-sm font-semibold text-zinc-800">{item.customerName || '-'}</p>
                      {item.customerCellPhoneNumber && <p className="text-xs text-zinc-500 mt-0.5">{item.customerCellPhoneNumber}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Waktu Perbaikan</p>
                      <p className="text-sm font-semibold text-zinc-800">{formatDate(item.repairTime)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Mileage</p>
                      <p className="text-sm font-semibold text-zinc-800">{item.mileage != null ? Number(item.mileage).toLocaleString('id-ID') + ' km' : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Total Fee</p>
                      <p className="text-sm font-black text-zinc-900">{formatRupiah(item.totalFee)}</p>
                      {item.totalRefusePayFee > 0 && <p className="text-xs text-red-500 mt-0.5">Refused: {formatRupiah(item.totalRefusePayFee)}</p>}
                    </div>
                  </div>

                  {/* Perintah & WO cross-ref */}
                  {(perintah || ifsWO || ikcWO) && (
                    <div className="px-5 pb-4 space-y-2">
                      {perintah && (
                        <div className="bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1"><Wrench size={10}/> Perintah Pengerjaan</p>
                          <p className="text-xs text-zinc-700 whitespace-pre-line">{perintah}</p>
                        </div>
                      )}
                      {(ifsWO || ikcWO) && (
                        <div className="flex flex-wrap gap-2">
                          {ifsWO && (
                            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                              <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider">IFS WO</span>
                              <span className="font-mono text-xs font-bold text-sky-800">{ifsWO.no_wo}</span>
                              <span className="text-[10px] text-sky-500">{ifsWO.nama_kendaraan || ''}</span>
                            </div>
                          )}
                          {ikcWO && (
                            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                              <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">IKC WO</span>
                              <span className="font-mono text-xs font-bold text-violet-800">{ikcWO.no_wo}</span>
                              <span className="text-[10px] text-violet-500">{ikcWO.nama_kendaraan || ''}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List Page ────────────────────────────────────────────────
export default function ProformaInvoice() {
  const def = getDefaultRange();
  const [fromDate, setFromDate]   = useState(def.from);
  const [toDate, setToDate]       = useState(def.to);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]       = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('all');
  const [data, setData]           = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage]           = useState(0);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected]   = useState(null); // selected settlement for detail view

  const fetchData = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const beginISO = fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : '';
      const endISO   = toDate   ? new Date(toDate   + 'T23:59:59').toISOString() : '';
      const json = await apiFetch({ endpoint: 'proforma-list', pageIndex: page, pageSize, beginCreateTime: beginISO, endCreateTime: endISO });
      const payload = json.payload || json;
      const rows = payload.content || payload.data || payload.items || [];
      setData(rows);
      setTotalRecords(payload.totalElements || payload.total || rows.length);
    } catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  }, [fromDate, toDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // If a settlement is selected, show detail page
  if (selected) {
    return <DetailPage settlement={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = data.filter(row => {
    const code = row.code || '';
    if (kategoriFilter === 'free-service' && !code.startsWith('BY')) return false;
    if (kategoriFilter === 'warranty'     && !code.startsWith('BX')) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![code, row.vin || '', row.customerName || '', row.dealerName || ''].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(totalRecords / pageSize);
  const hasFilters = search || kategoriFilter !== 'all';
  const totalFeeSum   = filtered.reduce((s, r) => s + Number(r.totalFee || 0), 0);
  const refusedFeeSum = filtered.reduce((s, r) => s + Number(r.totalRefusePayFee || 0), 0);

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-5 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={16} className="text-white"/>
            </div>
            <div>
              <h1 className="text-sm font-black text-zinc-900 leading-tight">Proforma Invoice</h1>
              <p className="text-[10px] text-zinc-400">Claim Settlement DMS</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-zinc-400 shrink-0"/>
            <input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setPage(0);}}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/>
            <span className="text-zinc-400 text-xs">–</span>
            <input type="date" value={toDate} onChange={e=>{setToDate(e.target.value);setPage(0);}}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/>
          </div>

          <form onSubmit={e=>{e.preventDefault();setSearch(searchInput);setPage(0);}} className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input type="text" value={searchInput} onChange={e=>setSearchInput(e.target.value)}
                placeholder="Code, VIN, nama..."
                className="pl-7 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900"/>
            </div>
            <button type="submit" className="px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors">Cari</button>
          </form>

          <button onClick={()=>setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showFilter||hasFilters?'bg-zinc-900 text-white border-zinc-900':'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}>
            <Filter size={12}/> Filter {hasFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full"/>}
          </button>

          <button onClick={fetchData} disabled={isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors ml-auto">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''}/>
          </button>
          <span className="text-xs text-zinc-400">{isLoading ? 'Memuat...' : `${totalRecords} settlement`}</span>
        </div>

        {showFilter && (
          <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-zinc-100">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kategori</label>
              <select value={kategoriFilter} onChange={e=>{setKategoriFilter(e.target.value);setPage(0);}}
                className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
                <option value="all">Semua</option>
                <option value="free-service">Free Service (BY)</option>
                <option value="warranty">Warranty (BX)</option>
              </select>
            </div>
            {hasFilters && (
              <button onClick={()=>{setSearch('');setSearchInput('');setKategoriFilter('all');}}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                <X size={12}/> Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Settlement', value: filtered.length,          color: 'bg-zinc-900', icon: FileText },
          { label: 'Total Fee',        value: formatRupiah(totalFeeSum), color: 'bg-blue-600', icon: DollarSign },
          { label: 'Refused Fee',      value: formatRupiah(refusedFeeSum), color: 'bg-red-600', icon: XCircle },
          { label: 'Settled',          value: filtered.filter(r=>r.status===9).length, color: 'bg-green-600', icon: CheckCircle2 },
        ].map(c => { const Icon = c.icon; return (
          <div key={c.label} className={`${c.color} rounded-2xl p-3.5 flex items-center justify-between shadow-sm`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p>
              <p className="text-lg font-black mt-0.5 text-white leading-tight">{c.value}</p>
            </div>
            <Icon size={24} className="text-white opacity-25"/>
          </div>
        );})}
      </div>

      {error && (
        <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0"/>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={fetchData} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-zinc-400">Memuat data...</p>
          </div>
        ) : filtered.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText size={36} className="text-zinc-300"/>
            <p className="text-sm font-bold text-zinc-400">Tidak ada data proforma</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {['Code','Settlement Month','Status','Labor Fee','Material Fee','Total Fee','Refused Fee',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((row, i) => {
                    const code  = row.code || '-';
                    const st    = getStatus(row.status);
                    const month = row.settlementMonth || row.createTime || '';
                    return (
                      <tr key={i}
                        className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                        onClick={() => setSelected(row)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-black text-zinc-900 text-sm group-hover:text-zinc-700">{code}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">{formatDate(month)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(row.laborFee)}</td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(row.materialFee)}</td>
                        <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap text-xs text-right">{formatRupiah(row.totalFee)}</td>
                        <td className="px-4 py-3 text-red-600 whitespace-nowrap text-xs text-right">{row.totalRefusePayFee ? formatRupiah(row.totalRefusePayFee) : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-zinc-400 group-hover:text-zinc-700 transition-colors">
                            <span className="text-xs font-semibold">Lihat Detail</span>
                            <ChevronRight size={14}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="bg-white border-t border-zinc-200 px-5 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">{page*pageSize+1}–{Math.min((page+1)*pageSize,totalRecords)} dari {totalRecords}</p>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0||isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
            <span className="text-xs font-semibold text-zinc-700 px-2">{page+1} / {totalPages}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1||isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
