import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Phone, Calendar, Car, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle, Eye,
  Download, AlertCircle
} from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { CSI_PROXY_URL, GATE } from '../utils/config';

const FEISHU_CUSTOMERS_SHARE_TOKEN = 'shrcnisfoFIuULuCRmFBG310qDb';

const SENT_STATUS_LABEL = {
  optjRRw2sJ: { label: 'Success', color: 'bg-green-100 text-green-700' },
  optBIxMgX1: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  optqng9Ywq: { label: 'Read', color: 'bg-blue-100 text-blue-700' },
  '': { label: 'Belum', color: 'bg-zinc-100 text-zinc-500' },
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
  { id: 'optUREGSFC', name: 'AVANTE MAGELANG' },
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

export default function CsiCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dealerFilter, setDealerFilter] = useState('optef3IAAh');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [stats, setStats] = useState({ total: 0, belum: 0, success: 0, failed: 0, read: 0 });
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async () => {
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

      const body = {
        shareToken: FEISHU_CUSTOMERS_SHARE_TOKEN,
        filter: JSON.stringify({
          conditions: filterConditions,
          conjunction: 'and',
        }),
      };

      const res = await fetch(CSI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GATE,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.code === 99991668 || json.code === 99991667) {
        throw new Error('Sesi Feishu expired. Hubungi admin untuk update env FEISHU_COOKIE di Vercel.');
      }
      if (json.code !== 0) throw new Error(json.msg || `Error Feishu: ${json.code}`);

      const records = json.data?.recordMap || {};
      const recordIds = json.data?.recordIDs || [];

      const mapped = recordIds
        .map((id) => {
          const r = records[id];
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

      const total = json.data?.total || 0;
      const statusCounts = { belum: 0, success: 0, failed: 0, read: 0 };
      mapped.forEach((c) => {
        if (c.sentStatus === 'optjRRw2sJ') statusCounts.success++;
        else if (c.sentStatus === 'optBIxMgX1') statusCounts.failed++;
        else if (c.sentStatus === 'optqng9Ywq') statusCounts.read++;
        else statusCounts.belum++;
      });

      setStats({ total, ...statusCounts });
      setCustomers(mapped);
    } catch (err) {
      setError(err.message);
      Toastify({
        text: `${err.message}`,
        style: { background: '#ef4444', borderRadius: '12px' },
      }).showToast();
    } finally {
      setLoading(false);
    }
  }, [dealerFilter]);

  useEffect(() => {
    fetchCustomers();
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

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const header = 'No,Dealer,VIN,Plat Nomor,Telepon,Service Date,Sent Status';
    const rows = filtered.map((c, i) =>
      `${i + 1},"${DEALER_OPTIONS.find((d) => d.id === c.dealer)?.name || '-'}","${c.vin}","${c.plate}","${c.phone}","${formatDate(c.serviceDate)}","${SENT_STATUS_LABEL[c.sentStatus]?.label || 'Belum'}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csi_customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toastify({
      text: `✅ ${filtered.length} data di-export`,
      style: { background: '#10b981', borderRadius: '12px' },
    }).showToast();
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
            CSI Customer Belum Review
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            Daftar pelanggan yang belum mengisi survey kepuasan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-zinc-900', textColor: 'text-white' },
          { label: 'Belum Review', value: stats.belum, color: 'bg-yellow-100 border-yellow-200', textColor: 'text-yellow-800' },
          { label: 'Success', value: stats.success, color: 'bg-green-100 border-green-200', textColor: 'text-green-800' },
          { label: 'Failed', value: stats.failed, color: 'bg-red-100 border-red-200', textColor: 'text-red-800' },
          { label: 'Read', value: stats.read, color: 'bg-blue-100 border-blue-200', textColor: 'text-blue-800' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border-2 p-4 ${s.color} ${s.textColor}`}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{s.label}</div>
            <div className="text-3xl font-black mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari plat, VIN, atau nomor telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={dealerFilter}
            onChange={(e) => setDealerFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-900 transition-colors"
          >
            {DEALER_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-900 transition-colors"
          >
            <option value="all">Semua Status</option>
            <option value="belum">Belum</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="read">Read</option>
          </select>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800 text-sm">Gagal mengambil data</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchCustomers}
            className="text-xs font-bold text-red-700 hover:text-red-900 bg-red-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Table */}
        <div className="bg-white rounded-2xl border-2 border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-200 bg-zinc-50">
                  <th className="text-left p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">No</th>
                  <th className="text-left p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Plat Nomor</th>
                  <th className="text-left p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">VIN</th>
                  <th className="text-left p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Telepon</th>
                  <th className="text-left p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Service Date</th>
                  <th className="text-center p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="text-center p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <RefreshCw size={20} className="animate-spin text-zinc-400" />
                        <span className="text-zinc-500 font-bold">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="text-zinc-300 font-bold text-lg">Tidak ada data</div>
                      <p className="text-zinc-400 text-sm mt-1">Tidak ada pelanggan yang belum review untuk filter ini</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => {
                    const statusInfo = SENT_STATUS_LABEL[c.sentStatus] || SENT_STATUS_LABEL[''];
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                          <td className="p-3 text-zinc-400 font-bold text-xs">{i + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Car size={14} className="text-zinc-400 shrink-0" />
                              <span className="font-bold text-zinc-900">{c.plate || '-'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-xs text-zinc-600">{c.vin || '-'}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-zinc-400 shrink-0" />
                              <span className="text-sm text-zinc-700">{formatPhone(c.phone)}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-zinc-400 shrink-0" />
                              <span className="text-sm text-zinc-700">{formatDate(c.serviceDate)}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleRow(c.id)}
                              className="text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                              {expandedRows.has(c.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>
                        {expandedRows.has(c.id) && (
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            <td colSpan={7} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Record ID</span>
                                  <span className="font-mono text-xs text-zinc-700">{c.id}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Dealer</span>
                                  <span className="font-bold text-zinc-900">{DEALER_OPTIONS.find((d) => d.id === c.dealer)?.name || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">VIN</span>
                                  <span className="font-mono text-xs text-zinc-700">{c.vin || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">WhatsApp</span>
                                  <a
                                    href={`https://wa.me/${formatPhone(c.phone).replace(/[^\d]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-green-600 font-bold hover:underline"
                                  >
                                    <ExternalLink size={12} />
                                    Kirim WA
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

      {/* Info */}
      {customers.length > 0 && (
        <div className="text-center text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
          {customers.length} data ditampilkan dari {stats.total} total record
        </div>
      )}
    </div>
  );
}
