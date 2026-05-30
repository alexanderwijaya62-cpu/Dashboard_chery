import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  Search, Filter, X, Calendar, DollarSign, CheckCircle2,
  Clock, XCircle, Loader2
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────
const STATUS_MAP = {
  1: { label: 'Draft',        bg: 'bg-zinc-100',    text: 'text-zinc-600',   border: 'border-zinc-200' },
  2: { label: 'Submitted',    bg: 'bg-blue-50',     text: 'text-blue-700',   border: 'border-blue-200' },
  3: { label: 'Under Review', bg: 'bg-yellow-50',   text: 'text-yellow-700', border: 'border-yellow-200' },
  4: { label: 'Approved',     bg: 'bg-green-50',    text: 'text-green-700',  border: 'border-green-200' },
  5: { label: 'Rejected',     bg: 'bg-red-50',      text: 'text-red-700',    border: 'border-red-200' },
  6: { label: 'Paid',         bg: 'bg-emerald-50',  text: 'text-emerald-700',border: 'border-emerald-200' },
  7: { label: 'Cancelled',    bg: 'bg-zinc-100',    text: 'text-zinc-500',   border: 'border-zinc-200' },
  8: { label: 'Pending',      bg: 'bg-orange-50',   text: 'text-orange-700', border: 'border-orange-200' },
  9: { label: 'Settled',      bg: 'bg-teal-50',     text: 'text-teal-700',   border: 'border-teal-200' },
};

const FREE_SERVICE_KEYWORDS = [
  'free service', '5000', '10000', '15000', '30000', '45000', '60000',
  'first maintenance', 'service pertama', 'service kedua', 'service ketiga', 'free 1000',
];

// ─── Helpers ──────────────────────────────────────────────────
function formatRupiah(val) {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(val) {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return val; }
}

function getKategoriFromCode(code) {
  if (!code) return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
  if (code.startsWith('BY')) return { label: 'Free Service', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  if (code.startsWith('BX')) return { label: 'Warranty',     bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200' };
  return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
}

function getStatusStyle(status) {
  return STATUS_MAP[status] || { label: String(status || '-'), bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
}

function isFreeServicePerintah(perintah) {
  if (!perintah) return false;
  const lower = perintah.toLowerCase();
  return FREE_SERVICE_KEYWORDS.some(kw => lower.includes(kw));
}

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad  = n => String(n).padStart(2, '0');
  const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

// ─── API helpers ──────────────────────────────────────────────
async function fetchProformaList({ pageIndex, pageSize, beginCreateTime, endCreateTime }) {
  const params = new URLSearchParams({
    endpoint: 'proforma-list',
    pageIndex,
    pageSize,
    beginCreateTime,
    endCreateTime,
  });
  const res = await fetch(`/api/chery_dms?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function fetchProformaDetail(id) {
  const params = new URLSearchParams({ endpoint: 'proforma-detail', id });
  const res = await fetch(`/api/chery_dms?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function fetchVinWOs(vin) {
  const params = new URLSearchParams({ endpoint: 'warranty-search-vin', vin, length: 50 });
  const res = await fetch(`/api/chery_dms?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

// ─── Expanded Row Detail ──────────────────────────────────────
function ExpandedDetail({ settlementId }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  // Map vin -> { wos, loading }
  const [vinData, setVinData] = useState({});
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchProformaDetail(settlementId);
      setDetail(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settlementId]);

  useEffect(() => {
    if (!fetchedRef.current) { fetchedRef.current = true; load(); }
  }, [load]);

  // Cross-reference VINs after detail loads
  useEffect(() => {
    if (!detail) return;
    const items = detail.items || detail.claimSettlementItems || detail.data?.items || [];
    const vins = [...new Set(items.map(it => it.vin || it.vinCode || it.chassisNo).filter(Boolean))];
    vins.forEach(vin => {
      if (vinData[vin]) return;
      setVinData(prev => ({ ...prev, [vin]: { wos: [], loading: true } }));
      fetchVinWOs(vin).then(wos => {
        setVinData(prev => ({ ...prev, [vin]: { wos, loading: false } }));
      }).catch(() => {
        setVinData(prev => ({ ...prev, [vin]: { wos: [], loading: false } }));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 px-2 text-zinc-400 text-sm">
      <Loader2 size={14} className="animate-spin"/> Memuat detail...
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-3 py-3 px-2">
      <AlertCircle size={14} className="text-red-500 shrink-0"/>
      <span className="text-sm text-red-600">{error}</span>
      <button onClick={load} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Retry</button>
    </div>
  );
  if (!detail) return null;

  const items = detail.items || detail.claimSettlementItems || detail.data?.items || [];

  if (items.length === 0) return (
    <p className="text-sm text-zinc-400 py-3 px-2 italic">Tidak ada item detail.</p>
  );

  return (
    <div className="space-y-3 py-2">
      {items.map((item, idx) => {
        const vin = item.vin || item.vinCode || item.chassisNo || '';
        const vd  = vinData[vin] || { wos: [], loading: false };
        const matchWO = vd.wos.find(w =>
          (w.no_chassis || '').toLowerCase() === vin.toLowerCase()
        ) || vd.wos[0];
        const perintah = matchWO?.perintah || '';
        const isFree   = isFreeServicePerintah(perintah);
        const ifsWO    = vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IFS');
        const ikcWO    = vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IKC');

        return (
          <div key={idx} className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-black text-zinc-900 text-sm">{item.code || item.claimCode || '-'}</span>
              {vin && <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-lg">{vin}</span>}
              {item.isRefusePay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                  <XCircle size={10}/> Refused
                </span>
              )}
              {perintah ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${isFree ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {isFree ? 'Free Service' : 'Warranty'}
                </span>
              ) : vd.loading ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400"><Loader2 size={9} className="animate-spin"/> cross-ref...</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-zinc-400">Pelanggan</span><p className="font-medium text-zinc-800 truncate">{item.customerName || '-'}</p></div>
              <div><span className="text-zinc-400">Waktu Perbaikan</span><p className="font-medium text-zinc-800">{formatDate(item.repairTime)}</p></div>
              <div><span className="text-zinc-400">Mileage</span><p className="font-medium text-zinc-800">{item.mileage != null ? Number(item.mileage).toLocaleString('id-ID') + ' km' : '-'}</p></div>
              <div><span className="text-zinc-400">Total Fee</span><p className="font-bold text-zinc-900">{formatRupiah(item.totalFee)}</p></div>
            </div>

            {perintah && (
              <div className="text-xs">
                <span className="text-zinc-400">Perintah: </span>
                <span className="text-zinc-700">{perintah}</span>
              </div>
            )}

            {(ifsWO || ikcWO) && (
              <div className="flex flex-wrap gap-3 text-xs pt-1">
                {ifsWO && <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1"><span className="font-bold text-sky-700">IFS WO:</span><span className="font-mono text-sky-800">{ifsWO.no_wo}</span></div>}
                {ikcWO && <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1"><span className="font-bold text-violet-700">IKC WO:</span><span className="font-mono text-violet-800">{ikcWO.no_wo}</span></div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function ProformaInvoice() {
  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate]       = useState(defaults.from);
  const [toDate, setToDate]           = useState(defaults.to);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('all');
  const [data, setData]               = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage]               = useState(0);
  const pageSize = 20;
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFilter, setShowFilter]   = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      // Convert local date strings to ISO with timezone offset
      const beginISO = fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : '';
      const endISO   = toDate   ? new Date(toDate   + 'T23:59:59').toISOString() : '';
      const json = await fetchProformaList({
        pageIndex: page,
        pageSize,
        beginCreateTime: beginISO,
        endCreateTime:   endISO,
      });
      // Support various response shapes
      const rows = json.data || json.items || json.records || json.list || [];
      setData(rows);
      setTotalRecords(json.total || json.totalCount || json.recordsTotal || rows.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filter + search
  const filtered = data.filter(row => {
    const code = row.code || row.settlementCode || '';
    const kat  = getKategoriFromCode(code).label;

    if (kategoriFilter === 'free-service' && !code.startsWith('BY')) return false;
    if (kategoriFilter === 'warranty'     && !code.startsWith('BX')) return false;

    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        code,
        row.vin || row.vinCode || '',
        row.customerName || '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(totalRecords / pageSize);
  const hasFilters = search || kategoriFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setKategoriFilter('all');
  };

  // Summary stats
  const totalFeeSum    = filtered.reduce((s, r) => s + (Number(r.laborFee || 0) + Number(r.materialFee || 0)), 0);
  const refusedFeeSum  = filtered.reduce((s, r) => s + Number(r.refusedFee || r.refuseFee || 0), 0);

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
              <p className="text-[10px] text-zinc-400 font-medium">Claim Settlement DMS</p>
            </div>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-zinc-400 shrink-0"/>
            <input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setPage(0);}}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/>
            <span className="text-zinc-400 text-xs">–</span>
            <input type="date" value={toDate} onChange={e=>{setToDate(e.target.value);setPage(0);}}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"/>
          </div>

          {/* Search */}
          <form onSubmit={e=>{e.preventDefault();setSearch(searchInput);setPage(0);}} className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input type="text" value={searchInput} onChange={e=>setSearchInput(e.target.value)}
                placeholder="Code, VIN, nama..."
                className="pl-7 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900"/>
            </div>
            <button type="submit" className="px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors">Cari</button>
          </form>

          {/* Filter toggle */}
          <button onClick={()=>setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showFilter||hasFilters?'bg-zinc-900 text-white border-zinc-900':'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}>
            <Filter size={12}/> Filter {hasFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full"/>}
          </button>

          {/* Refresh */}
          <button onClick={fetchData} disabled={isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors ml-auto">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''}/>
          </button>
          <span className="text-xs text-zinc-400">{isLoading ? 'Memuat...' : `${totalRecords.toLocaleString()} settlement`}</span>
        </div>

        {/* Filter bar */}
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
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                <X size={12}/> Reset Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Settlement', value: filtered.length, icon: FileText,     color: 'bg-zinc-900' },
          { label: 'Total Fee',        value: formatRupiah(totalFeeSum),   icon: DollarSign,  color: 'bg-blue-600' },
          { label: 'Refused Fee',      value: formatRupiah(refusedFeeSum), icon: XCircle,     color: 'bg-red-600' },
          { label: 'Settled',          value: filtered.filter(r=>(r.status||r.settlementStatus)===9).length, icon: CheckCircle2, color: 'bg-green-600' },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`${c.color} rounded-2xl p-3.5 flex items-center justify-between shadow-sm`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p>
                <p className="text-lg font-black mt-0.5 text-white leading-tight">{c.value}</p>
              </div>
              <Icon size={24} className="text-white opacity-25"/>
            </div>
          );
        })}
      </div>

      {/* Error */}
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
                    <th className="w-8"/>
                    {['Code','Kategori','Settlement Month','Status','Labor Fee','Material Fee','Total Fee','Refused Fee','Action'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((row, i) => {
                    const code    = row.code || row.settlementCode || '-';
                    const kat     = getKategoriFromCode(code);
                    const status  = row.status || row.settlementStatus;
                    const st      = getStatusStyle(status);
                    const isExp   = expandedRow === i;
                    const month   = row.settlementMonth || row.createTime || row.month || '';
                    const laborFee    = row.laborFee    ?? row.labor_fee    ?? 0;
                    const materialFee = row.materialFee ?? row.material_fee ?? 0;
                    const totalFee    = row.totalFee    ?? row.total_fee    ?? (Number(laborFee) + Number(materialFee));
                    const refusedFee  = row.refusedFee  ?? row.refuseFee   ?? row.refused_fee ?? 0;
                    const id          = row.id || row.settlementId || '';

                    return (
                      <React.Fragment key={i}>
                        <tr
                          className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isExp ? 'bg-zinc-50' : ''}`}
                          onClick={() => setExpandedRow(isExp ? null : i)}
                        >
                          <td className="pl-3 pr-1 py-2.5 text-zinc-400">
                            {isExp ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs">{code}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${kat.bg} ${kat.text} ${kat.border}`}>{kat.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs">{formatDate(month)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(laborFee)}</td>
                          <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(materialFee)}</td>
                          <td className="px-3 py-2.5 font-bold text-zinc-900 whitespace-nowrap text-xs text-right">{formatRupiah(totalFee)}</td>
                          <td className="px-3 py-2.5 text-red-600 whitespace-nowrap text-xs text-right">{refusedFee ? formatRupiah(refusedFee) : '-'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedRow(isExp ? null : i); }}
                              className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold rounded-lg transition-colors"
                            >
                              {isExp ? 'Tutup' : 'Detail'}
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-zinc-50 border-b border-zinc-200">
                            <td colSpan={10} className="px-5 py-3">
                              <ExpandedDetail settlementId={id}/>
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
        <div className="bg-white border-t border-zinc-200 px-5 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRecords)} dari {totalRecords.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Prev
            </button>
            <span className="text-xs font-semibold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
