import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, AlertCircle, Clock, FileText, Wrench, Filter, X, ChevronLeft, ChevronRight,
  Car, User, ChevronDown, ChevronUp, ShieldCheck, Zap, Star, Activity
} from 'lucide-react';
import {
  getStatusStyle, getKategoriStyle, formatDate, formatKm, formatRp
} from '../utils/warrantyConfig';

// Helper to calculate YYYY-MM-DD string with optional day offset
function getFormattedDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Helper to check if a row falls into selected date range based strictly on waktu_masuk
function isRowInSelectedRange(row, fromStr, toStr) {
  if (!fromStr && !toStr) return true;

  const rawDate = row.waktu_masuk || row.tgl_invoice || row.created_at || row.waktu_selesai;
  if (!rawDate) return true;

  let yyyymmdd = '';
  const str = String(rawDate).trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY (e.g. 27/07/2026 09:15:00)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyyMatch) {
    const d = ddmmyyyyMatch[1].padStart(2, '0');
    const m = ddmmyyyyMatch[2].padStart(2, '0');
    const y = ddmmyyyyMatch[3];
    yyyymmdd = `${y}-${m}-${d}`;
  } else {
    // Pattern 2: YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-07-27 09:15:00)
    const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyymmddMatch) {
      const y = yyyymmddMatch[1];
      const m = yyyymmddMatch[2].padStart(2, '0');
      const d = yyyymmddMatch[3].padStart(2, '0');
      yyyymmdd = `${y}-${m}-${d}`;
    } else {
      const dateObj = new Date(str);
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        yyyymmdd = `${y}-${m}-${d}`;
      }
    }
  }

  if (!yyyymmdd) return true;

  if (fromStr && yyyymmdd < fromStr) return false;
  if (toStr && yyyymmdd > toStr) return false;
  return true;
}

const estimasiDetailCacheStore = new Map();

export function WorkOrderDetailView({ row, onDetailLoaded }) {
  const [detailData, setDetailData] = useState(() => estimasiDetailCacheStore.get(row?.id_wo) || null);
  const [loading, setLoading] = useState(!estimasiDetailCacheStore.has(row?.id_wo));
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('lc');

  useEffect(() => {
    if (!row?.id_wo) return;

    if (estimasiDetailCacheStore.has(row.id_wo)) {
      const cached = estimasiDetailCacheStore.get(row.id_wo);
      setDetailData(cached);
      setLoading(false);
      if (onDetailLoaded) onDetailLoaded(row.id_wo, cached);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    fetch(`/api/chery_dms?endpoint=warranty-estimasi-detail&id=${row.id_wo}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.error) throw new Error(data.error);
        estimasiDetailCacheStore.set(row.id_wo, data);
        setDetailData(data);
        if (onDetailLoaded) onDetailLoaded(row.id_wo, data);
      })
      .catch(err => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [row?.id_wo]);

  const pekerjaan = detailData?.pekerjaan || [];
  const parts = detailData?.parts || [];

  const pekSubtotalCalc = pekerjaan.reduce((s, p) => s + (p.sub_total || p.total || 0), 0);
  const pekDiskonCalc = pekerjaan.reduce((s, p) => s + (p.diskon_nominal || 0), 0);
  const pekTotalCalc = pekSubtotalCalc - pekDiskonCalc;

  const pekSummary = (detailData?.pekerjaanSummary && detailData.pekerjaanSummary.sub_total > 0)
    ? detailData.pekerjaanSummary
    : {
        sub_total: pekSubtotalCalc,
        diskon: pekDiskonCalc,
        total: pekTotalCalc
      };

  const partsSubtotalCalc = parts.reduce((s, p) => s + (p.sub_total || p.total || ((p.harga_jual || 0) * (p.jumlah || 1)) || 0), 0);
  const partsDiskonCalc = parts.reduce((s, p) => s + (p.diskon_nominal || 0), 0);
  const partsDppCalc = partsSubtotalCalc - partsDiskonCalc;
  const partsPpnCalc = Math.round(partsDppCalc * 0.11);
  const partsTotalCalc = partsDppCalc + partsPpnCalc;

  const partsSummary = (detailData?.partsSummary && detailData.partsSummary.sub_total > 0)
    ? detailData.partsSummary
    : {
        sub_total: partsSubtotalCalc,
        diskon: partsDiskonCalc,
        dpp: partsDppCalc,
        ppn: partsPpnCalc,
        total: partsTotalCalc
      };

  const grandSubtotal = pekSummary.sub_total + partsSummary.sub_total;
  const grandDiskon = pekSummary.diskon + partsSummary.diskon;
  const grandDpp = grandSubtotal - grandDiskon;
  const grandPpn = Math.round(grandDpp * 0.11);
  const grandTotal = grandDpp + grandPpn;

  return (
    <div className="space-y-4 text-left w-full">
      {/* Basic WO info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
            <Car size={12}/> Kendaraan
          </p>
          {[
            ['Chassis', row.no_chassis],
            ['Engine', row.no_engine],
            ['Tahun', row.tahun_produksi],
            ['KM', formatKm(row.stand_km)],
            ['WO DMS', row.no_wo_dms]
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2 py-0.5">
              <span className="text-zinc-400 w-20 shrink-0 text-xs">{l}</span>
              <span className="text-zinc-700 text-xs font-mono">{v || '-'}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
            <Wrench size={12}/> Pengerjaan
          </p>
          {[
            ['SA', row.id_karyawan || row.nama_sa || row.sa],
            ['Mekanik', row.nama_mekanik1],
            ['Leader', row.nama_leader1]
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2 py-0.5">
              <span className="text-zinc-400 w-20 shrink-0 text-xs">{l}</span>
              <span className="text-zinc-700 text-xs">{v || '-'}</span>
            </div>
          ))}
          {row.keluhan && (
            <div className="flex gap-2 py-0.5">
              <span className="text-zinc-400 w-20 shrink-0 text-xs">Keluhan</span>
              <span className="text-zinc-700 text-xs">{row.keluhan}</span>
            </div>
          )}
          {row.perintah && (
            <div className="flex gap-2 py-0.5">
              <span className="text-zinc-400 w-20 shrink-0 text-xs">Perintah</span>
              <span className="text-zinc-700 text-xs whitespace-pre-line">{row.perintah}</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
            <Clock size={12}/> Timeline
          </p>
          {[
            ['Masuk', row.waktu_masuk],
            ['Simpan Est.', row.waktu_simpan_estimasi],
            ['Setujui Est.', row.waktu_setujui_estimasi],
            ['Mulai', row.waktu_mulai],
            ['Checker', row.waktu_checker],
            ['Selesai', row.waktu_selesai]
          ].map(([l, v]) => (
            <div key={l} className="flex gap-2 py-0.5">
              <span className="text-zinc-400 w-24 shrink-0 text-xs">{l}</span>
              <span className="text-zinc-700 text-xs">{formatDate(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Financial Breakdown */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="flex border-b border-zinc-200 bg-zinc-50 overflow-x-auto">
          {[
            { id: 'lc', label: `Pekerjaan (LC) (${pekerjaan.length})` },
            { id: 'part', label: `Spare Part (${parts.length})` },
            { id: 'oli', label: 'Oli & Grease, SM' },
            { id: 'sub', label: 'Sub Order' },
            { id: 'mitra', label: 'Pekerjaan Mitra' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-zinc-900 text-zinc-900 bg-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            Memuat rincian estimasi & biaya dari DMS...
          </div>
        ) : error ? (
          <div className="p-4 text-xs text-red-600 bg-red-50">{error}</div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Tab Pekerjaan (LC) */}
            {activeTab === 'lc' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Subtotal</span>
                    <span className="text-sm font-black text-zinc-900">{formatRp(pekSummary.sub_total)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Diskon</span>
                    <span className="text-sm font-black text-red-600">{formatRp(pekSummary.diskon)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total</span>
                    <span className="text-sm font-black text-emerald-600">{formatRp(pekSummary.total)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-100 font-bold text-zinc-600 border-b border-zinc-200">
                      <tr>
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2 text-left">Kode Pekerjaan</th>
                        <th className="p-2 text-left">Nama Pekerjaan</th>
                        <th className="p-2 text-right">Sub Total</th>
                        <th className="p-2 text-right">Disc (%)</th>
                        <th className="p-2 text-right">Total Disc</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {pekerjaan.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-zinc-400">Tidak ada rincian pekerjaan</td></tr>
                      ) : (
                        pekerjaan.map((p, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50">
                            <td className="p-2 text-center text-zinc-400 font-mono">{idx + 1}</td>
                            <td className="p-2 font-mono text-zinc-600">{p.kode_pekerjaan || '-'}</td>
                            <td className="p-2 font-medium text-zinc-900">{p.nama_pekerjaan || '-'}</td>
                            <td className="p-2 text-right font-mono text-zinc-700">{formatRp(p.sub_total || p.total)}</td>
                            <td className="p-2 text-right font-mono text-zinc-500">{(p.diskon_persen || 0).toFixed(2)}%</td>
                            <td className="p-2 text-right font-mono text-red-500">{formatRp(p.diskon_nominal || 0)}</td>
                            <td className="p-2 text-right font-mono font-bold text-zinc-900">{formatRp(p.total || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab Spare Part */}
            {activeTab === 'part' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Subtotal</span>
                    <span className="text-sm font-black text-zinc-900">{formatRp(partsSummary.sub_total)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Diskon</span>
                    <span className="text-sm font-black text-red-600">{formatRp(partsSummary.diskon)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">DPP</span>
                    <span className="text-sm font-black text-zinc-800">{formatRp(partsSummary.dpp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">PPN (11%)</span>
                    <span className="text-sm font-black text-blue-600">{formatRp(partsSummary.ppn)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total</span>
                    <span className="text-sm font-black text-emerald-600">{formatRp(partsSummary.total)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-100 font-bold text-zinc-600 border-b border-zinc-200">
                      <tr>
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2 text-left">Kode Part</th>
                        <th className="p-2 text-left">Nama Part</th>
                        <th className="p-2 text-left">No. Transaksi</th>
                        <th className="p-2 text-right">Harga Jual</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Sub Total</th>
                        <th className="p-2 text-right">Disc (%)</th>
                        <th className="p-2 text-right">Total Disc</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {parts.length === 0 ? (
                        <tr><td colSpan={11} className="p-4 text-center text-zinc-400">Tidak ada rincian spare part</td></tr>
                      ) : (
                        parts.map((pr, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50">
                            <td className="p-2 text-center text-zinc-400 font-mono">{idx + 1}</td>
                            <td className="p-2 font-mono text-zinc-600">{pr.kode_part || '-'}</td>
                            <td className="p-2 font-medium text-zinc-900">{pr.nama_part || '-'}</td>
                            <td className="p-2 font-mono text-zinc-500">{pr.no_transaksi || '-'}</td>
                            <td className="p-2 text-right font-mono text-zinc-700">{formatRp(pr.harga_jual || 0)}</td>
                            <td className="p-2 text-center font-bold text-zinc-900">{pr.jumlah || 1}</td>
                            <td className="p-2 text-right font-mono text-zinc-700">{formatRp(pr.sub_total || pr.total)}</td>
                            <td className="p-2 text-right font-mono text-zinc-500">{(pr.diskon_persen || 0).toFixed(2)}%</td>
                            <td className="p-2 text-right font-mono text-red-500">{formatRp(pr.diskon_nominal || 0)}</td>
                            <td className="p-2 text-right font-mono font-bold text-zinc-900">{formatRp(pr.total || 0)}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(pr.status_permintaan || pr.status)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {pr.status_permintaan || pr.status || 'Dipenuhi'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {['oli', 'sub', 'mitra'].includes(activeTab) && (
              <div className="p-8 text-center text-zinc-400 text-xs">
                Tidak ada data untuk kategori ini
              </div>
            )}
          </div>
        )}

        {/* Grand Total Footer Bar */}
        <div className="bg-zinc-900 text-white p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs w-full overflow-x-auto rounded-b-xl">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">Subtotal</span>
              <span className="font-bold text-zinc-200">{formatRp(grandSubtotal)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">Diskon</span>
              <span className="font-bold text-red-400">{formatRp(grandDiskon)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">DPP</span>
              <span className="font-bold text-zinc-200">{formatRp(grandDpp)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">PPN (11%)</span>
              <span className="font-bold text-blue-400">{formatRp(grandPpn)}</span>
            </div>
          </div>
          <div className="bg-emerald-600 px-4 py-2 rounded-lg font-black text-sm text-white shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0">
            <span>TOTAL:</span>
            <span>{formatRp(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const woReportMemoryCache = new Map();
const WO_CACHE_KEY = 'wo_report_cache_data';

function getCachedWoData(cacheKey) {
  try {
    if (woReportMemoryCache.has(cacheKey)) {
      return woReportMemoryCache.get(cacheKey).data;
    }
    const raw = localStorage.getItem(`${WO_CACHE_KEY}_${cacheKey}`);
    if (raw) {
      const { data, timestamp } = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        woReportMemoryCache.set(cacheKey, { data, timestamp });
        return data;
      }
    }
  } catch (e) {}
  return null;
}

function setCachedWoData(cacheKey, data) {
  try {
    const timestamp = Date.now();
    woReportMemoryCache.set(cacheKey, { data, timestamp });
    localStorage.setItem(`${WO_CACHE_KEY}_${cacheKey}`, JSON.stringify({ data, timestamp }));
    // Also save to master fallback key
    localStorage.setItem('wo_report_cache_data_all____', JSON.stringify({ data, timestamp }));
  } catch (e) {}
}

export default function WorkOrderReportPage() {
  const today = getFormattedDate(0);

  const [timePreset, setTimePreset] = useState('all'); // default 'all' (Semua)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');

  const [masterList, setMasterList] = useState(() => {
    return getCachedWoData('wo_report_master__') || getCachedWoData('all____') || [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
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

  // Fetch Work Order data with caching support
  const fetchData = useCallback(async (forceFresh = false) => {
    const masterCacheKey = `wo_report_master_${statusFilter}_${search}`;
    let rawList = [];

    if (!forceFresh) {
      const cached = getCachedWoData(masterCacheKey) || getCachedWoData('all____');
      if (cached && cached.length > 0) {
        rawList = cached;
      }
    }

    if (rawList.length > 0) {
      const dateFiltered = rawList.filter(row => isRowInSelectedRange(row, fromDate, toDate));
      setMasterList(dateFiltered);
      setIsLoading(false);
      if (!forceFresh) return; // Instantly return 0ms if cached and forceFresh is false!
    }

    setIsLoading(rawList.length === 0);
    setIsBackgroundSyncing(rawList.length > 0);
    setError(null);

    const safeFetchJson = async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return { data: [] };
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return { data: [] };
        const json = await res.json();
        return json || { data: [] };
      } catch (e) {
        return { data: [] };
      }
    };

    try {
      const params = new URLSearchParams({
        endpoint: 'warranty-wo',
        draw: 1,
        start: 0,
        length: 1000,
        fetchAll: 'true',
        search,
        status: statusFilter
      });
      const json = await safeFetchJson(`/api/chery_dms?${params}`);
      if (json.error) throw new Error(json.error);

      const freshList = Array.isArray(json.data) ? json.data : [];
      if (freshList.length > 0) {
        setCachedWoData(masterCacheKey, freshList);
        setCachedWoData('all____', freshList);
        const dateFiltered = freshList.filter(row => isRowInSelectedRange(row, fromDate, toDate));
        setMasterList(dateFiltered);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      if (rawList.length === 0) setError(err.message || 'Gagal terhubung ke server DMS');
    } finally {
      setIsLoading(false);
      setIsBackgroundSyncing(false);
    }
  }, [search, statusFilter, timePreset, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Base list filtered by selected Date range (used for metric totals)
  const dateRangeData = useMemo(() => {
    return masterList;
  }, [masterList]);

  // Compute 5 Metrics independently across the date range (including Closed)
  const metrics = useMemo(() => {
    const ifs = dateRangeData.filter(d => (d.kategori || d.no_wo || '').toUpperCase().includes('IFS')).length;
    const ikc = dateRangeData.filter(d => (d.kategori || d.no_wo || '').toUpperCase().includes('IKC')).length;
    const eur = dateRangeData.filter(d => (d.kategori || d.no_wo || '').toUpperCase().includes('EUR')).length;

    // Total Unit: Unique vehicles strictly based on VIN / Chassis or License Plate (No double counting!)
    const uniqueUnitsSet = new Set(
      dateRangeData
        .map(d => (d.no_chassis || d.no_polisi || '').trim().toUpperCase())
        .filter(Boolean)
    );

    return {
      ifs,
      ikc,
      eur,
      totalWo: dateRangeData.length,
      totalUnits: uniqueUnitsSet.size
    };
  }, [dateRangeData]);

  // Final filtered data for Table display (strict Kategori & Status filtering)
  const displayFilteredData = useMemo(() => {
    return masterList.filter(row => {
      // Search Filter
      if (searchInput) {
        const q = searchInput.toLowerCase();
        const noWo = (row.no_wo || '').toLowerCase();
        const noWoDms = (row.no_wo_dms || '').toLowerCase();
        const noPol = (row.no_polisi || '').toLowerCase();
        const noVin = (row.no_chassis || '').toLowerCase();
        const cust = (row.nama_pelanggan || '').toLowerCase();
        if (!noWo.includes(q) && !noWoDms.includes(q) && !noPol.includes(q) && !noVin.includes(q) && !cust.includes(q)) {
          return false;
        }
      }

      // Kategori Filter (IFS / IKC / EUR)
      if (kategoriFilter) {
        const k = kategoriFilter.toUpperCase();
        const rowKat = (row.kategori || row.no_wo || '').toUpperCase();
        if (!rowKat.includes(k)) return false;
      }

      // Status Filter (Open / Ready / In Progress / Checker / Selesai / Closed)
      if (statusFilter) {
        const s = statusFilter.toLowerCase();
        const rowStatus = (row.status || '').toLowerCase();
        if (!rowStatus.includes(s)) return false;
      }

      return true;
    });
  }, [masterList, searchInput, kategoriFilter, statusFilter]);

  const totalRecords = displayFilteredData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Paginated slice for table display
  const pagedData = useMemo(() => {
    const startIdx = page * pageSize;
    return displayFilteredData.slice(startIdx, startIdx + pageSize);
  }, [displayFilteredData, page, pageSize]);

  return (
    <div className="w-full min-h-screen p-3 sm:p-5 flex flex-col space-y-4 bg-zinc-100 overflow-y-auto">
      {/* 5 METRIC CONTAINERS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">WO IFS</span>
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><Star size={14} /></div>
          </div>
          <p className="text-2xl font-black text-amber-600">{metrics.ifs}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Kategori IFS</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">WO IKC</span>
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Zap size={14} /></div>
          </div>
          <p className="text-2xl font-black text-blue-600">{metrics.ikc}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Kategori IKC</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">WO EUR</span>
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600"><ShieldCheck size={14} /></div>
          </div>
          <p className="text-2xl font-black text-purple-600">{metrics.eur}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Kategori EUR</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total WO</span>
            <div className="w-7 h-7 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-900"><Activity size={14} /></div>
          </div>
          <p className="text-2xl font-black text-zinc-900">{metrics.totalWo}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Total Work Order</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Unit</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><Car size={14} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-600">{metrics.totalUnits}</p>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase">Unit Unik (VIN/Plat)</p>
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

        {/* Custom Date Inputs if preset === 'custom' */}
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
          {isBackgroundSyncing && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg animate-pulse flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin"/> Menyinkronkan seluruh data WO...
            </span>
          )}

          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(0); }} className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari WO, Plat, VIN..."
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors">
              Cari
            </button>
          </form>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-900 outline-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Open">Open</option>
            <option value="Ready">Ready</option>
            <option value="In Progress">In Progress</option>
            <option value="Checker">Checker</option>
            <option value="Selesai">Selesai</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={kategoriFilter}
            onChange={e => { setKategoriFilter(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-900 outline-none cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            <option value="IFS">IFS</option>
            <option value="IKC">IKC</option>
            <option value="EUR">EUR</option>
          </select>

          <button onClick={() => fetchData(true)} disabled={isLoading} title="Refresh & ambil data terbaru" className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0"/>
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={fetchData} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* WORK ORDER TABLE - FULLY RESPONSIVE */}
      <div className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className="overflow-x-auto w-full">
          {isLoading && pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-400 font-bold">Memuat data Work Order...</p>
            </div>
          ) : pagedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FileText size={32} className="text-zinc-300"/>
              <p className="text-xs font-bold text-zinc-400">Tidak ada data Work Order untuk kriteria filter ini</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                  <th className="w-8 pl-3 py-2.5"></th>
                  {['No. WO', 'Kat.', 'Status', 'Pelanggan', 'No. Polisi', 'Kendaraan', 'KM', 'Mekanik', 'Masuk', 'Update'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pagedData.map((row, i) => {
                  const s = getStatusStyle(row.status);
                  const k = getKategoriStyle(row.kategori);
                  const isExp = expandedRow === i;
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
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs max-w-[140px] truncate">{row.nama_pelanggan || '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-700 whitespace-nowrap text-xs">{row.no_polisi || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs max-w-[160px] truncate">{row.nama_kendaraan || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap text-xs">{formatKm(row.stand_km)}</td>
                        <td className="px-3 py-2.5 text-zinc-700 whitespace-nowrap text-xs">{row.nama_mekanik1 || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{formatDate(row.waktu_masuk)}</td>
                        <td className="px-3 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
                      </tr>
                      {isExp && (
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <td colSpan={11} className="px-4 py-4">
                            <WorkOrderDetailView row={row} />
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
              {`${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalRecords)} dari ${totalRecords.toLocaleString()} WO`}
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
