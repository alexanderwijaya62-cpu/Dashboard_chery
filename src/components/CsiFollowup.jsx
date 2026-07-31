import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Phone, Calendar, Car, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle, Eye,
  Download, AlertCircle, ChevronLeft, ChevronRight
 } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { CSI_PROXY_URL } from '../utils/config';

const SENT_STATUS_LABEL = {
  optjRRw2sJ: { label: 'Success', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  optBIxMgX1: { label: 'Failed', color: 'bg-rose-100 text-rose-700 border border-rose-200' },
  optqng9Ywq: { label: 'Read', color: 'bg-sky-100 text-sky-700 border border-sky-200' },
  '': { label: 'Belum', color: 'bg-zinc-100 text-zinc-500 border border-zinc-200' },
};

const DEALER_OPTIONS = [
  { id: 'optef3IAAh', name: 'ORIENTAL SM RAJA AMPLAS' },
  { id: 'optGxr0Wc6', name: 'ARTA PLUIT' },
  { id: 'optNvUSS4D', name: 'BINTANG MITRA JOGLO' },
  { id: 'optWLhT4Os', name: 'AEM YASMIN BOGOR' },
  { id: 'opt1hiRpmb', name: 'AEM BANJARMASIN' },
  { id: 'optcV2MXSJ', name: 'ARTA KELAPA GADING' },
  { id: 'optAurtzzR', name: 'MANANG PRAPEN' },
  { id: 'optCWHEIjB', name: 'TRIMEGAH BSD' },
  { id: 'optflTIPSo', name: 'MOBIL CERIA ARJUNO' },
  { id: 'opta7mQheY', name: 'INERTA PAMULANG' },
  { id: 'optPXmyxrS', name: 'CAM CINERE' },
  { id: 'optw2xovPr', name: 'ARTA KARAWANG' },
  { id: 'opt5vPcgGk', name: 'CHERINDO CIBUBUR' },
  { id: 'optnVB8SO6', name: 'ARTA SERPONG' },
  { id: 'optZ7McgtL', name: 'AEM KENDARI' },
  { id: 'optZu6TzL5', name: 'PUSAKA BEKASI TIMUR' },
  { id: 'optKPQjp3g', name: 'DUNIA KARAWACI' },
  { id: 'opt4QtomFg', name: 'AMBARA ARJUNA' },
  { id: 'optKPoBqYL', name: 'GEDONG JEMBAR CIREBON' },
  { id: 'optyWJ6JBj', name: 'BSP SUNTER' },
  { id: 'optQsUh3bx', name: 'CHERINDO VETERAN' },
  { id: 'optoRB1Dxt', name: 'MAJESTY BATAM CENTER' },
  { id: 'optoZ3yzHw', name: 'DWIPA DENPASAR' },
  { id: 'optmVyPKuP', name: 'SUMBER BARU YOGYAKARTA' },
  { id: 'optW0Suygg', name: 'ARTA BEKASI' },
  { id: 'opt0waFQk9', name: 'MAN KALIMALANG' },
  { id: 'optNlAGD3G', name: 'INOVASI SOEKARNO HATTA' },
  { id: 'optS1cylra', name: 'MBI CIKUPA' },
  { id: 'optQPCNCDS', name: 'INTI MOBIL SETIABUDI' },
  { id: 'optpbGRx4B', name: 'TRIMEGAH SILIWANGI' },
  { id: 'optzQ5Jhbm', name: 'ARTA PIK 2' },
  { id: 'opteAPlh10', name: 'AEM BSD CITY' },
  { id: 'optzoSHOq8', name: 'MENTARI CAKRA SURABAYA' },
  { id: 'optadO5zQR', name: 'MAN FATMAWATI' },
  { id: 'optLtJZguH', name: 'INTI MOBIL SOLO' },
  { id: 'optne19ZVJ', name: 'TRIDAYA TELLO' },
  { id: 'optjxzR1Mv', name: 'BINTANG MITRA PONDOK GEDE' },
  { id: 'opts9o154A', name: 'ANTAPURA MT HARYONO' },
  { id: 'optsgEFpIo', name: 'MANANG MAYJEN SUNGKONO' },
  { id: 'optofkfj3k', name: 'ADS BINTARO' },
  { id: 'optoFkvmit', name: 'BINTANG MITRA PURWOKERTO' },
  { id: 'opt7iQEhuv', name: 'OAP PALU' },
  { id: 'optQODkpY2', name: 'DUNIA PALMERAH' },
  { id: 'optTaPmQpC', name: 'HAYYU SAMARINDA' },
  { id: 'optibAiIcm', name: 'CENTRAL SEMARANG' },
  { id: 'optny9eVtf', name: 'WILTOP JAMBI' },
  { id: 'optmuRcR9E', name: 'SMS MARGONDA' },
  { id: 'opt1rLPrju', name: 'INTI MOBIL CEMPAKA PUTIH' },
  { id: 'opt4qEBM4e', name: 'ALTO PURI' },
  { id: 'opt7ReoGyA', name: 'ORIENTAL PEKANBARU' },
  { id: 'optinhYC9C', name: 'BINTANG MITRA MALANG' },
  { id: 'optAgTWeJ8', name: 'MAHKOTA KUPANG' },
  { id: 'optlkiDiXR', name: 'ANEKA PONTIANAK' },
  { id: 'optmiMRniw', name: 'PRADIPTA SOLO BARU' },
  { id: 'optb2yfx81', name: 'CENTRAL KUDUS' },
  { id: 'optjqbtqvz', name: 'SMS GRAHA RAYA' },
  { id: 'opt61sYia9', name: 'INTI MOBIL SEMARANG' },
  { id: 'opt53MaOv4', name: 'CAM PALEMBANG' },
  { id: 'optp8xYGIP', name: 'SMS BALIKPAPAN' },
  { id: 'optdnpiIAb', name: 'MAHKOTA PDK. INDAH' },
  { id: 'optCc4rJme', name: 'ANTAPURA LAMPUNG' },
  { id: 'optn04kcmK', name: 'BINTANG MITRA CIKARANG' },
  { id: 'opt7vm5wyI', name: 'STA PADANG' },
  { id: 'optcQK8Sv4', name: 'OAP MANADO' },
  { id: 'optbLoy0Ge', name: 'AEM KUTA' },
  { id: 'optXFJjjwj', name: 'BINTANG MITRA JEMBER' },
  { id: 'opteyRUbFM', name: 'ORIENTAL ACEH' },
  { id: 'optOm2FZBA', name: 'GALLERIE CIBINONG' },
  { id: 'opt3X576RP', name: 'PERSADA LAMPUNG' },
  { id: 'optCQ1QBdm', name: 'WONDER PAJAJARAN' },
  { id: 'optR7CbNPK', name: 'INTI MOBIL TASIKMALAYA' },
  { id: 'optRefX1G8', name: 'AVANTE MAGELANG' },
  { id: 'optaswoVX3', name: 'AVANTE TEGAL' },
  { id: 'optQgODT01', name: 'ALTO PASTEUR' },
  { id: 'optldt2fta', name: 'Wonder Palembang' },
];

const formatDate = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatPhone = (phone) => {
  if (!phone) return '-';
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('62')) return `+${p}`;
  if (p.startsWith('0')) return `+62${p.slice(1)}`;
  return p;
};

export default function CsiFollowup() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dealerFilter, setDealerFilter] = useState('optef3IAAh');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [stats, setStats] = useState({ total: 0, belum: 0, success: 0, failed: 0, read: 0 });
  const [error, setError] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchCustomers = useCallback(async (isRefresh = false) => {
    // Check sessionStorage cache first if not explicitly refreshing
    const cacheKey = `feishu_csi_followup_cache_${dealerFilter}`;
    if (!isRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          // 5 minutes expiry
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setCustomers(data.mapped);
            setStats(data.stats);
            setCurrentPage(1);
            return;
          }
        } catch (_) {}
      }
    }

    setLoading(true);
    setError(null);
    try {
      const filterConditions = [
        {
          fieldId: 'fldXbpXoZU',
          fieldType: 3,
          operator: 'contains',
          value: [dealerFilter],
          conditionId: 'coneubJhk9',
        },
        {
          fieldId: 'fldTcWjbEB',
          fieldType: 19,
          operator: 'contains',
          value: ['csi-7901-16'],
          conditionId: 'conLSv3LxC',
        },
      ];

      let allRecords = {};
      let allRecordIds = [];
      let hasMore = true;
      let offset = undefined;
      let totalCount = 0;

      // Recursive pagination to fetch all 177+ records
      while (hasMore) {
        const body = {
          view: 'customers',
          filter: JSON.stringify({
            conditions: filterConditions,
            conjunction: 'and',
          }),
          offset
        };

        const res = await fetch(CSI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (json.code === 99991668 || json.code === 99991667) {
          throw new Error('Sesi Feishu expired. Hubungi admin untuk update env FEISHU_COOKIE.');
        }
        if (json.code !== 0) throw new Error(json.msg || `Error Feishu: ${json.code}`);

        const records = json.data?.recordMap || {};
        const recordIds = json.data?.recordIDs || [];
        totalCount = json.data?.total || 0;

        Object.assign(allRecords, records);
        allRecordIds = [...allRecordIds, ...recordIds];

        hasMore = json.data?.hasMore || false;
        offset = json.data?.nextOffset;
      }

      const mapped = allRecordIds
        .map((id) => {
          const r = allRecords[id];
          if (!r) return null;
          const isFilling = r.fldWnp00bO?.value?.val;
          if (!isFilling || isFilling[0] === 'optVoofegw') {
            return {
              id,
              dealer: r.fldXbpXoZU?.value,
              vin: r.fld8vB2Jl0?.value?.[0]?.text || '',
              plate: r.fldQkWE0Me?.value?.[0]?.text || '',
              phone: r.fldXQx3HDS?.value?.[0]?.text || '',
              serviceDate: r.fldKxjArvz?.value,
              sentStatus: r.fldqkGnFzl?.value?.val?.[0] || '',
            };
          }
          return null;
        })
        .filter(Boolean);

      const statusCounts = { belum: 0, success: 0, failed: 0, read: 0 };
      mapped.forEach((c) => {
        if (c.sentStatus === 'optjRRw2sJ') statusCounts.success++;
        else if (c.sentStatus === 'optBIxMgX1') statusCounts.failed++;
        else if (c.sentStatus === 'optqng9Ywq') statusCounts.read++;
        else statusCounts.belum++;
      });

      const statsObj = { total: totalCount, ...statusCounts };
      setStats(statsObj);
      setCustomers(mapped);
      setCurrentPage(1);

      // Save to cache
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: { mapped, stats: statsObj },
        timestamp: Date.now()
      }));
      
      Toastify({
        text: `✅ Berhasil sinkronisasi ${mapped.length} data kustomer CSI!`,
        style: { background: '#10b981', borderRadius: '12px' },
      }).showToast();
    } catch (err) {
      setError(err.message);
      Toastify({
        text: `⚠️ Gagal sinkronisasi: ${err.message}`,
        style: { background: '#ef4444', borderRadius: '12px' },
      }).showToast();
    } finally {
      setLoading(false);
    }
  }, [dealerFilter]);

  useEffect(() => {
    fetchCustomers(false);
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === 'belum' && c.sentStatus) return false;
      if (statusFilter === 'success' && c.sentStatus !== 'optjRRw2sJ') return false;
      if (statusFilter === 'failed' && c.sentStatus !== 'optBIxMgX1') return false;
      if (statusFilter === 'read' && c.sentStatus !== 'optqng9Ywq') return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.plate.toLowerCase().includes(q) ||
          c.vin.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, search, statusFilter]);

  // Paginated records
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleWAUrl = (phone, plate) => {
    const formatted = formatPhone(phone).replace(/[^\d]/g, '');
    const message = `Halo, kami dari Chery. Mengingatkan kembali untuk mengisi survey kepuasan layanan CSI untuk plat kendaraan ${plate}. Terima kasih!`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="p-6 lg:p-10 w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
            CSI Follow-up Panel
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            Pantau dan lakukan follow-up ke pelanggan yang belum melengkapi survey CSI Feishu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCustomers(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-md shadow-zinc-900/10"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sinkronkan Ulang
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Belum Survey', value: stats.belum, color: 'bg-zinc-900 text-white border-zinc-950' },
          { label: 'Total Data', value: stats.total, color: 'bg-white border-zinc-200 text-zinc-800' },
          { label: 'Success', value: stats.success, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
          { label: 'Failed', value: stats.failed, color: 'bg-rose-50 border-rose-200 text-rose-800' },
          { label: 'Read (Dibaca)', value: stats.read, color: 'bg-sky-50 border-sky-200 text-sky-800' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${s.color}`}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{s.label}</div>
            <div className="text-3xl font-black mt-1.5">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari plat nomor, VIN, atau telepon..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          <select
            value={dealerFilter}
            onChange={(e) => setDealerFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 transition-colors cursor-pointer"
          >
            {DEALER_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 transition-colors cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="belum">Belum Followup</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold text-rose-850 text-sm">Gagal Mengambil Data</p>
            <p className="text-rose-600 text-xs mt-1 font-medium">{error}</p>
          </div>
          <button
            onClick={() => fetchCustomers(true)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-100/50 border border-rose-200 px-4 py-2 rounded-xl transition-all shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-12">No</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Plat Nomor</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">VIN (No. Rangka)</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">No. Handphone</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Service Date</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-24">Status</th>
                <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-40">Tindakan</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-zinc-400" />
                      <span className="text-zinc-500 font-bold text-sm">Menyelaraskan data Feishu Bitable...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="text-zinc-300 font-black text-xl">Data Kosong</div>
                    <p className="text-zinc-400 text-sm mt-1.5 font-medium">Tidak ada kustomer dengan status tersebut.</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c, i) => {
                  const statusInfo = SENT_STATUS_LABEL[c.sentStatus] || SENT_STATUS_LABEL[''];
                  const realIndex = (currentPage - 1) * itemsPerPage + i + 1;
                  return (
                    <React.Fragment key={c.id}>
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        <td className="p-4 text-center text-zinc-400 font-bold text-xs">{realIndex}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Car size={16} className="text-zinc-400 shrink-0" />
                            <span className="font-bold text-zinc-950">{c.plate || '-'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-xs text-zinc-600 font-semibold">{c.vin || '-'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-zinc-400 shrink-0" />
                            <span className="text-sm text-zinc-700 font-medium">{formatPhone(c.phone)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-700 font-semibold">{formatDate(c.serviceDate)}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-extrabold ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <a
                            href={handleWAUrl(c.phone, c.plate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                          >
                            <ExternalLink size={12} />
                            Kirim WA
                          </a>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(c.id)}
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            {expandedRows.has(c.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(c.id) && (
                        <tr className="bg-zinc-50/50">
                          <td colSpan={8} className="p-5 border-t border-zinc-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                              <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Record ID</span>
                                <span className="font-mono text-xs text-zinc-700 font-medium">{c.id}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Dealer Cabang</span>
                                <span className="font-bold text-zinc-900">{DEALER_OPTIONS.find((d) => d.id === c.dealer)?.name || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">VIN (No. Rangka)</span>
                                <span className="font-mono text-xs text-zinc-700 font-semibold">{c.vin || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Tautan Langsung WA</span>
                                <a
                                  href={`https://wa.me/${formatPhone(c.phone).replace(/[^\d]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-emerald-600 font-bold hover:underline"
                                >
                                  Chat Tanpa Template
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination Controls */}
      {filtered.length > itemsPerPage && (
        <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-2xl px-6 py-4 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500">
            Menampilkan <span className="font-bold text-zinc-800">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> dari <span className="font-bold text-zinc-800">{filtered.length}</span> data kustomer
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-55 hover:text-zinc-900 transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500"
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-2 text-zinc-400 text-xs">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        currentPage === p
                          ? 'bg-zinc-900 text-white shadow-sm'
                          : 'border border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-55 hover:text-zinc-900 transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      
      {customers.length > 0 && (
        <div className="text-center text-[10px] font-black text-zinc-350 uppercase tracking-widest">
          Total {filtered.length} dari {customers.length} data kustomer CSI terunduh
        </div>
      )}
    </div>
  );
}
