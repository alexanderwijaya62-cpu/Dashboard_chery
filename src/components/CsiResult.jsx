import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart3, ExternalLink, Users, Target, Star,
  TrendingUp, Clock, Wrench, Building2, HeartHandshake,
  Package, Truck, ChevronDown, ChevronUp, Download, Filter,
  RefreshCw, AlertCircle, X, Bug
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { CSI_PROXY_URL, GATE } from '../utils/config';

const FEISHU_CSI_RESULT_SHARE_TOKEN = 'shrcnw2XQ2tFdIyI6iIcfGqJTv0';

const CSI_SUMMARY = {
  dealerCode: '10007901',
  dealerName: 'ORIENTAL SM RAJA AMPLAS',
  month: 6,
  year: 2026,
  totalSample: 6,
  csiScore: 734,
  dimensions: [
    { id: 'fld72xtQlM', name: 'Service Appointment', value: 733, icon: Clock, color: '#3b82f6' },
    { id: 'fldoCOV1H9', name: 'Service Advisor', value: 767, icon: HeartHandshake, color: '#8b5cf6' },
    { id: 'fldwSnxNc2', name: 'Dealer Facility & Service Image', value: 767, icon: Building2, color: '#06b6d4' },
    { id: 'fldeHCGTJE', name: 'Service Quality', value: 767, icon: Star, color: '#f59e0b' },
    { id: 'fld2P5DxKQ', name: 'Leadtime Service', value: 600, icon: Clock, color: '#ef4444' },
    { id: 'fldggEklVL', name: 'Delivery Process', value: 700, icon: Truck, color: '#10b981' },
    { id: 'fldwvPaNZU', name: 'Spare Part Availibility', value: 800, icon: Package, color: '#14b8a6' },
  ],
  links: {
    belumIsiSurvey: 'https://my-ichery.feishu.cn/share/base/query/shrcnisfoFIuULuCRmFBG310qDb',
    detailDataCSI: 'https://my-ichery.feishu.cn/share/base/query/shrcnw2XQ2tFdIyI6iIcfGqJTv0',
  }
};

const SURVEY_RESPONDENTS = [
  {
    id: 'rec27tmjbKH95d', name: 'Edy Gunawan', product: 'J6', vin: 'MF7GB27B8SJ001916',
    q1: 1, q2: 2, q3: 2, q4: 4, q5: 1, q6: 2, q7: 2, overall: 5, recommend: 7,
    comment: 'tingkatkan jumlah bengkel service di daerah kota dan cari sales counter/ advisor yang pengalaman seperti Toyota'
  },
  {
    id: 'rec27yTSDU5c1z', name: 'Ecy suriyani', product: 'OMODA E5', vin: 'MF7ED27B8RJ001683',
    q1: 5, q2: 5, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3, overall: 8, recommend: 9,
    comment: 'Pengadaan suku cadang supaya ready setiap saat karena populasi mobil Chery sudah sangat banyak, dan tingkatkan skill dan pengetahuan mekanik terhadap produk Chery yang tergolong sudah canggih.'
  },
  {
    id: 'rec27yTWZmcvG0', name: 'TONI PARASIAN', product: 'Tiggo 8 Pro', vin: 'MF7CD24B8NJ000054',
    q1: 5, q2: 5, q3: 4, q4: 5, q5: 4, q6: 5, q7: 4, overall: 9, recommend: 9,
    comment: 'Semoga kedepannya semakin lebih baik'
  },
  {
    id: 'rec27AfckfuoLk', name: 'Edy Susanto', product: 'OMODA 5', vin: 'MF7ED21B8PJ000199',
    q1: 5, q2: 5, q3: 5, q4: 5, q5: 4, q6: 5, q7: 5, overall: 8, recommend: 6,
    comment: 'saya konsumen luar kota (6 jam perjalanan darat) jadi pemeriksaan kerusakan harus berulang kali ke bengkel resmi CHERY jadi sangat merepotkan belum lagi kesalahan deteksi kerusakan yang harus berulang kali ke bengkel resmi (6 jam)'
  },
  {
    id: 'rec27C2KtBD0qH', name: 'Edy Wijaya', product: 'Tiggo Cross', vin: 'MF7AD21B8SJ003623',
    q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 5, q7: 5, overall: 10, recommend: 10,
    comment: ''
  },
  {
    id: 'rec27C3clUl3j2', name: 'Budiman', product: 'Tiggo Cross', vin: 'MF7AD21B8SJ002651',
    q1: 1, q2: 1, q3: 4, q4: 1, q5: 1, q6: 1, q7: 5, overall: 5, recommend: 10,
    comment: 'mekanikkuskiluran'
  }
];

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const Q1_LABEL = 'Kemudahan penjadwalan servis';
const Q2_LABEL = 'Layanan resepsionis Service Advisor';
const Q3_LABEL = 'Fasilitas dan lingkungan Dealer';
const Q4_LABEL = 'Profesionalisme teknisi';
const Q5_LABEL = 'Waktu pemeliharaan/servis';
const Q6_LABEL = 'Pengalaman penerimaan kendaraan setelah servis';
const Q7_LABEL = 'Ketepatan waktu penggantian suku cadang';

export default function CsiResult() {
  const [showAllComments, setShowAllComments] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawRecords, setRawRecords] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [liveRespondents, setLiveRespondents] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);

  const fetchCSIData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLiveRespondents(null);
    setLiveSummary(null);
    try {
      const body = {
        shareToken: FEISHU_CSI_RESULT_SHARE_TOKEN,
        page_size: 200,
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
      setRawRecords({ records, recordIds });

      if (recordIds.length > 0) {
        Toastify({
          text: `${recordIds.length} records fetched. Lihat debug untuk field IDs.`,
          style: { background: '#3b82f6', borderRadius: '12px', fontSize: '13px' },
        }).showToast();
      } else {
        Toastify({
          text: 'Data kosong - tidak ada records',
          style: { background: '#f59e0b', borderRadius: '12px' },
        }).showToast();
      }
    } catch (err) {
      setError(err.message);
      Toastify({
        text: `${err.message}`,
        style: { background: '#ef4444', borderRadius: '12px' },
      }).showToast();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCSIData();
  }, [fetchCSIData]);

  const barChartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: CSI_SUMMARY.dimensions.map(d => d.color),
    plotOptions: {
      bar: {
        borderRadius: 8,
        horizontal: true,
        distributed: true,
        barHeight: '70%',
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => val,
      style: { fontSize: '14px', fontWeight: 700, colors: ['#fff'] },
      offsetX: -8,
    },
    xaxis: {
      categories: CSI_SUMMARY.dimensions.map(d => d.name),
      labels: { show: true, style: { fontSize: '12px', fontWeight: 600, colors: '#18181b' } },
      max: 1000,
      tickAmount: 5,
    },
    yaxis: {
      labels: { style: { fontSize: '12px', fontWeight: 700, colors: '#18181b' } },
    },
    grid: {
      borderColor: '#e4e4e7',
      strokeDashArray: 4,
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (val) => `${val} pts` }
    },
    legend: { show: false },
  }), []);

  const barSeries = useMemo(() => [{
    name: 'Score',
    data: CSI_SUMMARY.dimensions.map(d => d.value)
  }], []);

  const gaugeOptions = useMemo(() => ({
    chart: {
      type: 'radialBar',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          margin: 0,
          size: '65%',
          background: 'transparent',
        },
        track: {
          background: '#e4e4e7',
          strokeWidth: '97%',
        },
        dataLabels: {
          show: true,
          name: {
            show: true,
            fontSize: '14px',
            fontWeight: 700,
            color: '#71717a',
            offsetY: -10,
          },
          value: {
            show: true,
            fontSize: '48px',
            fontWeight: 900,
            color: '#18181b',
            offsetY: 5,
            formatter: (val) => `${Math.round(val)}`,
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        gradientToColors: ['#10b981'],
        stops: [0, 100]
      }
    },
    stroke: { lineCap: 'round' },
    labels: ['CSI Score'],
    colors: ['#22c55e'],
  }), []);

  const gaugeSeries = useMemo(() => [CSI_SUMMARY.csiScore / 10], []);

  const activeRespondents = liveRespondents || SURVEY_RESPONDENTS;

  const sortedRespondents = useMemo(() => {
    const sorted = [...activeRespondents];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'overall') cmp = a.overall - b.overall;
      else if (sortBy === 'recommend') cmp = a.recommend - b.recommend;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [sortBy, sortDir, activeRespondents]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const avgRating = (q) => {
    const vals = activeRespondents.map(r => r[q]).filter(v => v != null);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const renderStars = (val, max = 5) => {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${i < val ? 'bg-yellow-400' : 'bg-zinc-200'}`} />
        ))}
      </div>
    );
  };

  const monthName = MONTHS[CSI_SUMMARY.month - 1];

  const scoreColor = (val) => {
    if (val >= 800) return 'text-green-600';
    if (val >= 700) return 'text-yellow-600';
    return 'text-red-600';
  };

  const scoreBg = (val) => {
    if (val >= 800) return 'bg-green-50 border-green-200';
    if (val >= 700) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
            CSI Result
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {(liveSummary || CSI_SUMMARY).dealerName} ({(liveSummary || CSI_SUMMARY).dealerCode}) — {monthName} {(liveSummary || CSI_SUMMARY).year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCSIData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-zinc-200 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <Bug size={16} />
            Debug
          </button>
          <a
            href={CSI_SUMMARY.links.detailDataCSI}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-zinc-200 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <ExternalLink size={16} />
            Detail Data CSI
          </a>
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
            onClick={fetchCSIData}
            className="text-xs font-bold text-red-700 hover:text-red-900 bg-red-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-12 text-center">
          <RefreshCw size={32} className="animate-spin text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-bold">Mengambil data dari Feishu...</p>
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && rawRecords && (
        <div className="bg-zinc-900 rounded-2xl border-2 border-zinc-700 p-6 overflow-auto max-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <Bug size={14} />
              Raw Feishu Records ({rawRecords.recordIds.length} total)
            </h3>
            <button onClick={() => setShowDebug(false)} className="text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4">
            {rawRecords.recordIds.slice(0, 3).map((id) => {
              const rec = rawRecords.records[id];
              return (
                <div key={id} className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-[10px] font-mono text-zinc-500 mb-2">{id}</div>
                  <div className="space-y-1">
                    {Object.entries(rec || {}).map(([fieldId, val]) => {
                      let display = JSON.stringify(val);
                      if (display.length > 80) display = display.slice(0, 80) + '...';
                      return (
                        <div key={fieldId} className="flex gap-3 text-xs">
                          <span className="text-cyan-400 font-mono shrink-0 w-28 truncate">{fieldId}</span>
                          <span className="text-zinc-300 font-mono break-all">{display}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CSI Score Gauge + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6 lg:col-span-1">
          <div className="h-[280px]">
            <ReactApexChart
              options={gaugeOptions}
              series={gaugeSeries}
              type="radialBar"
              height="100%"
            />
          </div>
          <div className="text-center mt-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Total Sample
            </div>
            <div className="text-2xl font-black text-zinc-900 flex items-center justify-center gap-2 mt-1">
              <Users size={20} className="text-zinc-400" />
              {CSI_SUMMARY.totalSample} Responden
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6 lg:col-span-2">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-5">
            Dimensi Penilaian
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CSI_SUMMARY.dimensions.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 ${scoreBg(d.value)} transition-all`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Icon size={20} style={{ color: d.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate">
                      {d.name}
                    </div>
                    <div className={`text-2xl font-black ${scoreColor(d.value)}`}>
                      {d.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6">
        <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-5 flex items-center gap-2">
          <BarChart3 size={16} />
          Grafik Pencapaian Dimensi
        </h2>
        <div className="h-[400px]">
          <ReactApexChart
            options={barChartOptions}
            series={barSeries}
            type="bar"
            height="100%"
          />
        </div>
      </div>

      {/* Computed Scores Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <Target size={16} />
            Skor Komputasi per Responden
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200">
                <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">No</th>
                <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nama</th>
                <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Produk</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q1_LABEL}>Q1</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q2_LABEL}>Q2</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q3_LABEL}>Q3</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q4_LABEL}>Q4</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q5_LABEL}>Q5</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q6_LABEL}>Q6</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest" title={Q7_LABEL}>Q7</th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('overall')}>
                  Overall {sortBy === 'overall' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('recommend')}>
                  Rekomendasi {sortBy === 'recommend' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRespondents.map((r, i) => (
                <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <td className="p-4 text-zinc-400 font-bold text-xs">{i + 1}</td>
                  <td className="p-4 font-bold text-zinc-900 whitespace-nowrap">{r.name}</td>
                  <td className="p-4 text-zinc-600 text-xs">{r.product}</td>
                  <td className="p-4 text-center">{renderStars(r.q1)}</td>
                  <td className="p-4 text-center">{renderStars(r.q2)}</td>
                  <td className="p-4 text-center">{renderStars(r.q3)}</td>
                  <td className="p-4 text-center">{renderStars(r.q4)}</td>
                  <td className="p-4 text-center">{renderStars(r.q5)}</td>
                  <td className="p-4 text-center">{renderStars(r.q6)}</td>
                  <td className="p-4 text-center">{renderStars(r.q7)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${
                      r.overall >= 8 ? 'bg-green-100 text-green-700' :
                      r.overall >= 6 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.overall}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${
                      r.recommend >= 8 ? 'bg-green-100 text-green-700' :
                      r.recommend >= 6 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.recommend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <HeartHandshake size={16} />
            Komentar Responden
          </h2>
          <button
            onClick={() => setShowAllComments(!showAllComments)}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
          >
            {showAllComments ? 'Sembunyikan' : 'Lihat Semua'}
            {showAllComments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="space-y-3">
          {(showAllComments ? activeRespondents : activeRespondents.filter(r => r.comment)).map((r) => (
            <div key={r.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-black">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-900">{r.name}</div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{r.product}</div>
                </div>
              </div>
              {r.comment ? (
                <p className="text-sm text-zinc-600 leading-relaxed ml-11">{r.comment}</p>
              ) : (
                <p className="text-sm text-zinc-300 italic ml-11">Tidak ada komentar</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
