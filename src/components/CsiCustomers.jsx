import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Phone, Calendar, Car, RefreshCw,
  ChevronDown, ChevronUp, ChevronRight, ExternalLink, CheckCircle, XCircle, Eye,
  Download, AlertCircle, MessageSquare, Star, MapPin
} from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { CSI_PROXY_URL } from '../utils/config';

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

const PRODUCT_OPTIONS = {
  optxfimvab: 'Tiggo7 Pro',
  optfdcDebe: 'Tiggo 8',
  optxXsi6iC: 'Tiggo 8 Pro',
  optju8SoUb: 'Tiggo 8 Pro MaX',
  optscNaaTz: 'OMODA 5',
  optA4J85zi: 'OMODA 5 GT',
  opt5Xci0JP: 'OMODA E5',
  opt2tAqKT4: 'Tiggo 5X',
  opt9yPXPZ0: 'J6',
  optNVNnTlI: 'Tiggo Cross',
  optEwG7YIW: 'Tiggo 8 CSH',
  opts9CythE: 'Chery C5',
  opttFUGVro: 'Chery E5',
  optn1gyvHX: 'Tiggo 9 CSH',
  optlp3ysj5: 'J6T'
};

export default function CsiCustomers() {
  const today = new Date();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dealerFilter, setDealerFilter] = useState('optef3IAAh');
  const [monthFilter, setMonthFilter] = useState(String(today.getMonth() + 1));
  const [selectedReview, setSelectedReview] = useState(null);
  const [error, setError] = useState(null);

  const fetchReviews = useCallback(async (isRefresh = false) => {
    const cacheKey = `feishu_csi_customers_cache_${dealerFilter}_${monthFilter}`;
    if (!isRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setReviews(data);
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
          fieldId: 'fldA9Oa6IA',
          fieldType: 19,
          operator: 'contains',
          value: [dealerFilter],
          conditionId: 'con2GlKFnL',
        },
        {
          fieldId: 'fldc3urooF',
          fieldType: 20,
          operator: 'contains',
          value: [monthFilter],
          conditionId: 'conhboX683',
        },
        {
          fieldId: 'fldHYwLI9Z',
          fieldType: 20,
          operator: 'contains',
          value: ['csi-7901-16'],
          conditionId: 'conQiBWHmX',
        },
      ];

      const body = {
        view: 'results',
        filter: JSON.stringify({
          conditions: filterConditions,
          conjunction: 'and',
        }),
      };

      const res = await fetch(CSI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!text) throw new Error('Server Feishu tidak merespons (respons kosong). Coba lagi.');
      let json;
      try { json = JSON.parse(text); } catch { json = {}; }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.code === 99991668 || json.code === 99991667) {
        throw new Error('Sesi Feishu expired. Hubungi admin untuk update env FEISHU_COOKIE.');
      }
      if (json.code !== 0) throw new Error(json.msg || `Error Feishu: ${json.code}`);

      const records = json.data?.recordMap || {};
      const recordIds = json.data?.recordIDs || [];

      const mapped = recordIds.map((id) => {
        const r = records[id];
        if (!r) return null;
        
        return {
          id,
          month: r.fldXU4Zx8g?.value?.val || r.fldXU4Zx8g?.value || '-',
          week: r.fldpzQRX9s?.value?.val?.[0]?.text || r.fldpzQRX9s?.value?.[0]?.text || '-',
          name: r.fldLOfP6ht?.value?.[0]?.text || r.fldLOfP6ht?.value || '-',
          product: PRODUCT_OPTIONS[r.flduCHkcFO?.value] || r.flduCHkcFO?.value || '-',
          dealerId: r.fldA9Oa6IA?.value?.val?.[0] || r.fldA9Oa6IA?.value?.[0] || '-',
          ratingOverall: r.fld0l3XtOx?.value || 0,
          comments: r.fldIfJu5jY?.value?.map(c => c.text).join('\n') || r.fldIfJu5jY?.value || '',
          commentsQ8: r.fld4gEPGVF?.value?.map(c => c.text).join('\n') || r.fld4gEPGVF?.value || '',
          recommend: r.fldYktqdva?.value || 0,
          vin: r.fldBbJb9CA?.value?.val?.[0]?.text || r.fldBbJb9CA?.value?.[0]?.text || '-',
          q1: r.fld77RDhPZ?.value || 0,
          q2: r.fldGneeuoD?.value || 0,
          q3: r.fldpOMkOr5?.value || 0,
          q4: r.fldqBAJgeU?.value || 0,
          q5: r.fldvf2MIJv?.value || 0,
          q6: r.fldA6l5y5x?.value || 0,
          q7: r.fldlvE1YfV?.value || 0,
          scoreOverall: r.fldKw5T576?.value?.val || r.fldKw5T576?.value || 0,
          scoreApp: r.fld4QH5nYf?.value?.val || r.fld4QH5nYf?.value || 0,
          scoreAdv: r.fldIgOOJb4?.value?.val || r.fldIgOOJb4?.value || 0,
          scoreFac: r.fldolgjXG7?.value?.val || r.fldolgjXG7?.value || 0,
          scoreQual: r.fldc1yukie?.value?.val || r.fldc1yukie?.value || 0,
          scoreLt: r.fldDMpKDF5?.value?.val || r.fldDMpKDF5?.value || 0,
          scoreDel: r.fld6u1SCVQ?.value?.val || r.fld6u1SCVQ?.value || 0,
          scorePart: r.fldSHHL9LJ?.value?.val || r.fldSHHL9LJ?.value || 0,
        };
      }).filter(Boolean);

      setReviews(mapped);

      // Save to cache
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: mapped, timestamp: Date.now() }));
    } catch (err) {
      setError(err.message);
      Toastify({
        text: `⚠️ Gagal sinkronisasi data review: ${err.message}`,
        style: { background: '#ef4444', borderRadius: '12px' },
      }).showToast();
    } finally {
      setLoading(false);
    }
  }, [dealerFilter, monthFilter]);

  useEffect(() => {
    fetchReviews(false);
  }, [fetchReviews]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q) ||
          r.vin.toLowerCase().includes(q) ||
          r.comments.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, search]);

  const getRatingColor = (val) => {
    if (val >= 9) return 'bg-indigo-600 text-white';
    if (val >= 7) return 'bg-blue-600 text-white';
    if (val >= 5) return 'bg-amber-500 text-white';
    return 'bg-rose-500 text-white';
  };

  const dealerNameMapped = (id) => {
    return DEALER_OPTIONS.find((d) => d.id === id)?.name || id;
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col p-6 lg:p-10 w-full space-y-6 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
            CSI Customer Review
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            Ulasan lengkap kustomer dan skor survei CSI langsung dari Feishu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchReviews(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-md shadow-zinc-900/10"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm shrink-0">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama kustomer, mobil, komentar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 transition-colors cursor-pointer"
          >
            <option value="1">Januari</option>
            <option value="2">Februari</option>
            <option value="3">Maret</option>
            <option value="4">April</option>
            <option value="5">Mei</option>
            <option value="6">Juni</option>
            <option value="7">Juli</option>
            <option value="8">Agustus</option>
            <option value="9">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>
          <select
            value={dealerFilter}
            onChange={(e) => setDealerFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 transition-colors cursor-pointer"
          >
            {DEALER_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left is Cards List, Right is Details Panel if selected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        {/* Cards List */}
        <div className={`space-y-4 h-full overflow-y-auto pr-2 ${selectedReview ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="text-zinc-500 text-xs font-black uppercase tracking-widest pl-2">
            {filtered.length} Results
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <RefreshCw size={24} className="animate-spin text-zinc-400 mx-auto mb-3" />
              <p className="text-zinc-500 font-bold text-sm">Mengambil Ulasan Kustomer...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="text-zinc-300 font-black text-xl">Ulasan Kosong</div>
              <p className="text-zinc-400 text-sm mt-1.5 font-medium">Belum ada review survei untuk filter cabang/bulan ini.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedReview(r)}
                className={`bg-white rounded-2xl border transition-all p-5 flex items-center justify-between cursor-pointer shadow-sm ${
                  selectedReview?.id === r.id ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full pr-4">
                  {/* Left block: Month, Week, Dealer */}
                  <div className="md:col-span-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Month</span>
                        <span className="text-sm font-black text-zinc-900">{r.month}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Score</span>
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded-lg">{r.scoreOverall}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mt-1.5">
                      <div className="text-xs font-semibold text-zinc-600">
                        <span className="text-zinc-400 font-bold">Week:</span> {r.week}
                      </div>
                      <span className="inline-block self-start px-2.5 py-1 bg-violet-55 border border-violet-100 rounded-lg text-[9px] font-extrabold text-violet-700">
                        {dealerNameMapped(r.dealerId)}
                      </span>
                    </div>
                  </div>

                  {/* Middle block: Name, Rating */}
                  <div className="md:col-span-5 space-y-2">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Nama Anda</span>
                      <span className="text-sm font-bold text-zinc-900">{r.name}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-400 block">Bagaimana penilaian Anda...</span>
                      <div className="flex gap-0.5 flex-wrap">
                        {Array.from({ length: 11 }, (_, val) => (
                          <span
                            key={val}
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border ${
                              r.ratingOverall === val
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                : 'bg-zinc-55 text-zinc-400 border-zinc-200'
                            }`}
                          >
                            {val}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right block: Product, Comments */}
                  <div className="md:col-span-4 space-y-1 min-w-0">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Silahkan pilih produk...</span>
                      <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold mt-0.5">
                        {r.product}
                      </span>
                    </div>
                    <div className="min-w-0 mt-1.5">
                      <span className="text-[9px] font-bold text-zinc-400 block">Kami dengan tulus...</span>
                      <p className="text-xs text-zinc-600 font-semibold truncate leading-tight mt-0.5">
                        {r.comments || r.commentsQ8 || <span className="text-zinc-350 italic">No feedback comment</span>}
                      </p>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-zinc-400 shrink-0" />
              </div>
            ))
          )}
        </div>

        {/* Details Panel */}
        {selectedReview && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-6 space-y-6 shadow-md animate-slideInRight h-full overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-150 pb-4">
              <h2 className="text-lg font-black text-zinc-950">Detail Hasil Survei</h2>
              <button
                onClick={() => setSelectedReview(null)}
                className="text-xs font-extrabold text-zinc-400 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 px-3 py-1.5 rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-zinc-900 text-white rounded-xl p-4 flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">Overall Score</span>
                  <span className="font-mono text-[10px] text-zinc-450">VIN: {selectedReview.vin}</span>
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {selectedReview.scoreOverall} <span className="text-[10px] text-zinc-400 font-normal">/ 1000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">1 → Month</span>
                  <span className="font-bold text-zinc-950 text-base">{selectedReview.month}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">2 → Week</span>
                  <span className="font-bold text-zinc-950 text-base">{selectedReview.week}</span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">3 → Nama Anda</span>
                <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl font-bold text-zinc-900">
                  {selectedReview.name}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">4 → Silahkan pilih produk Chery Anda</span>
                <div className="inline-block px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold">
                  {selectedReview.product}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">5 → Dealer Names</span>
                <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl font-semibold text-zinc-700">
                  {dealerNameMapped(selectedReview.dealerId)}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  6 → Bagaimana penilaian Anda mengenai pengalaman layanan purna jual Chery secara keseluruhan di bengkel resmi Chery saat ini?
                </span>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, val) => (
                    <span
                      key={val}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${
                        selectedReview.ratingOverall === val
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                  7 → Aspek pengalaman mana yang membuat Anda ragu untuk merekomendasikan kami?
                </span>
                <div className="p-4 bg-zinc-55 border border-zinc-150 rounded-xl font-semibold text-zinc-700 leading-relaxed min-h-12">
                  {selectedReview.comments || <span className="text-zinc-350 italic">Tidak ada keluhan tertulis</span>}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  8 → Apakah Anda bersedia merekomendasikan CHERY kepada kerabat dan teman Anda?
                </span>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, val) => (
                    <span
                      key={val}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${
                        selectedReview.recommend === val
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                          : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>

              {selectedReview.commentsQ8 && (
                <div className="border-t border-zinc-100 pt-4">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                    Q8. Komentar Akhir & Kebutuhan Spesifik Anda
                  </span>
                  <div className="p-4 bg-zinc-55 border border-zinc-150 rounded-xl font-semibold text-zinc-700 leading-relaxed">
                    {selectedReview.commentsQ8}
                  </div>
                </div>
              )}

              {/* Individual Question Ratings breakdown */}
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  Detail Skor Dimensi & Rating
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    { label: 'Q1. Penjadwalan Servis (Service Appointment)', val: selectedReview.q1, score: selectedReview.scoreApp },
                    { label: 'Q2. Layanan Resepsionis (Service Advisor)', val: selectedReview.q2, score: selectedReview.scoreAdv },
                    { label: 'Q3. Fasilitas & Lingkungan (Dealer Facility)', val: selectedReview.q3, score: selectedReview.scoreFac },
                    { label: 'Q4. Profesionalisme Teknisi (Service Quality)', val: selectedReview.q4, score: selectedReview.scoreQual },
                    { label: 'Q5. Waktu Servis (Maintenance Time)', val: selectedReview.q5, score: selectedReview.scoreLt },
                    { label: 'Q6. Penerimaan Kendaraan (Delivery Process)', val: selectedReview.q6, score: selectedReview.scoreDel },
                    { label: 'Q7. Ketepatan Waktu Part (Spare Part Availibility)', val: selectedReview.q7, score: selectedReview.scorePart },
                  ].map((q, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-zinc-50 border border-zinc-150 rounded-lg">
                      <span className="font-semibold text-zinc-650 truncate w-72" title={q.label}>{q.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-zinc-500 bg-zinc-200/50 px-2 py-0.5 rounded text-[10px]">Rating: {q.val}/5</span>
                        <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px]">{q.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
