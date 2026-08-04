import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart3, ExternalLink, Users, Target, Star,
  TrendingUp, Clock, Wrench, Building2, HeartHandshake,
  Package, Truck, ChevronDown, ChevronUp, Download, Filter,
  RefreshCw, AlertCircle, X, Bug, Calendar
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { CSI_PROXY_URL } from '../utils/config';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

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

const ICON_MAP = {
  Clock: Clock,
  HeartHandshake: HeartHandshake,
  Building2: Building2,
  Star: Star,
  Truck: Truck,
  Package: Package
};

const DEFAULT_DIMENSIONS = [
  { id: 'fld72xtQlM', name: 'Service Appointment', value: 0, icon: 'Clock', color: '#3b82f6' },
  { id: 'fldoCOV1H9', name: 'Service Advisor', value: 0, icon: 'HeartHandshake', color: '#8b5cf6' },
  { id: 'fldwSnxNc2', name: 'Dealer Facility & Service Image', value: 0, icon: 'Building2', color: '#06b6d4' },
  { id: 'fldeHCGTJE', name: 'Service Quality', value: 0, icon: 'Star', color: '#f59e0b' },
  { id: 'fld2P5DxKQ', name: 'Leadtime Service', value: 0, icon: 'Clock', color: '#ef4444' },
  { id: 'fldggEklVL', name: 'Delivery Process', value: 0, icon: 'Truck', color: '#10b981' },
  { id: 'fldwvPaNZU', name: 'Spare Part Availibility', value: 0, icon: 'Package', color: '#14b8a6' },
];

const CSI_SUMMARY_FALLBACK = {
  dealerCode: '10007901',
  dealerName: 'ORIENTAL SM RAJA AMPLAS',
  month: 7,
  year: 2026,
  totalSample: 0,
  csiScore: 0,
  dimensions: DEFAULT_DIMENSIONS
};

export default function CsiResult() {
  const today = new Date();
  const [dealerFilter, setDealerFilter] = useState('optef3IAAh');
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));

  const [loading, setLoading] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [error, setError] = useState(null);
  
  const [liveRespondents, setLiveRespondents] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [yearlyScores, setYearlyScores] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const [showAllComments, setShowAllComments] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showDebug, setShowDebug] = useState(false);
  const [rawRecords, setRawRecords] = useState(null);

  // Fetch yearly trend (month 1-12) + active month records in a single query
  const fetchCSIData = useCallback(async (isRefresh = false) => {
    const cacheKey = `feishu_csi_result_full_cache_${dealerFilter}_${selectedMonth}_${selectedYear}`;
    let allRecordsData = null;
    let trendScores = null;

    if (!isRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 minutes cache
            allRecordsData = data.records;
            trendScores = data.scores;
          }
        } catch (_) {}
      }
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch the whole year (months 1-12) + active month records in ONE request
      if (!allRecordsData || !trendScores) {
        setLoadingTrend(true);
        try {
          const res = await fetch(CSI_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              view: 'results',
              action: 'yearly-trend',
              dealerFilter: dealerFilter,
              month: String(selectedMonth),
            }),
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

          if (Array.isArray(json.scores) && json.scores.length === 12) {
            trendScores = json.scores;
          } else {
            trendScores = Array.from({ length: 12 }, () => 0);
          }

          const recordMap = json.records?.recordMap || {};
          const recordIDs = json.records?.recordIDs || [];
          allRecordsData = { recordMap, recordIDs };

          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: { scores: trendScores, records: allRecordsData },
            timestamp: Date.now()
          }));
        } finally {
          setLoadingTrend(false);
        }
      }

      setYearlyScores(trendScores);
    } catch (err) {
      setError(err.message);
      Toastify({
        text: `⚠️ Gagal sinkronisasi data CSI: ${err.message}`,
        style: { background: '#ef4444', borderRadius: '12px' },
      }).showToast();
      setLoading(false);
      return;
    }

    // Process active month records locally
    const { recordMap, recordIDs } = allRecordsData;
    const activeRecordIDs = recordIDs;

    // 3. Map respondents and compute metrics for active month
    if (activeRecordIDs.length > 0) {
      let sumOverall = 0, countOverall = 0;
      let sumApp = 0, countApp = 0;
      let sumAdv = 0, countAdv = 0;
      let sumFac = 0, countFac = 0;
      let sumQual = 0, countQual = 0;
      let sumLt = 0, countLt = 0;
      let sumDel = 0, countDel = 0;
      let sumPart = 0, countPart = 0;

      const mappedRespondents = activeRecordIDs.map((id) => {
        const r = recordMap[id];
        if (!r) return null;

        const overallVal = r.fldKw5T576?.value?.val || r.fldKw5T576?.value;
        if (overallVal !== undefined && overallVal !== null) {
          sumOverall += Number(overallVal);
          countOverall++;
        }

        const appVal = r.fld4QH5nYf?.value?.val || r.fld4QH5nYf?.value;
        if (appVal !== undefined && appVal !== null) { sumApp += Number(appVal); countApp++; }

        const advVal = r.fldIgOOJb4?.value?.val || r.fldIgOOJb4?.value;
        if (advVal !== undefined && advVal !== null) { sumAdv += Number(advVal); countAdv++; }

        const facVal = r.fldolgjXG7?.value?.val || r.fldolgjXG7?.value;
        if (facVal !== undefined && facVal !== null) { sumFac += Number(facVal); countFac++; }

        const qualVal = r.fldc1yukie?.value?.val || r.fldc1yukie?.value;
        if (qualVal !== undefined && qualVal !== null) { sumQual += Number(qualVal); countQual++; }

        const ltVal = r.fldDMpKDF5?.value?.val || r.fldDMpKDF5?.value;
        if (ltVal !== undefined && ltVal !== null) { sumLt += Number(ltVal); countLt++; }

        const delVal = r.fld6u1SCVQ?.value?.val || r.fld6u1SCVQ?.value;
        if (delVal !== undefined && delVal !== null) { sumDel += Number(delVal); countDel++; }

        const partVal = r.fldSHHL9LJ?.value?.val || r.fldSHHL9LJ?.value;
        if (partVal !== undefined && partVal !== null) { sumPart += Number(partVal); countPart++; }

        return {
          id,
          name: r.fldLOfP6ht?.value?.[0]?.text || '-',
          product: PRODUCT_OPTIONS[r.flduCHkcFO?.value] || r.flduCHkcFO?.value || '-',
          vin: r.fldBbJb9CA?.value?.val?.[0]?.text || r.fldBbJb9CA?.value?.[0]?.text || '-',
          q1: r.fld77RDhPZ?.value || 0,
          q2: r.fldGneeuoD?.value || 0,
          q3: r.fldpOMkOr5?.value || 0,
          q4: r.fldqBAJgeU?.value || 0,
          q5: r.fldvf2MIJv?.value || 0,
          q6: r.fldA6l5y5x?.value || 0,
          q7: r.fldlvE1YfV?.value || 0,
          overall: overallVal || 0,
          recommend: r.fldYktqdva?.value || 0,
          comments: r.fldIfJu5jY?.value?.map(c => c.text).join('\n') || r.fldIfJu5jY?.value || '',
          commentsQ8: r.fld4gEPGVF?.value?.map(c => c.text).join('\n') || r.fld4gEPGVF?.value || '',
        };
      }).filter(Boolean);

      const avgOverall = countOverall > 0 ? Math.round(sumOverall / countOverall) : 0;

      const liveSummaryData = {
        dealerName: DEALER_OPTIONS.find(d => d.id === dealerFilter)?.name || dealerFilter,
        month: Number(selectedMonth),
        year: Number(selectedYear),
        totalSample: activeRecordIDs.length,
        csiScore: avgOverall,
        dimensions: [
          { id: 'fld72xtQlM', name: 'Service Appointment', value: countApp > 0 ? Math.round(sumApp / countApp) : 0, icon: 'Clock', color: '#3b82f6' },
          { id: 'fldoCOV1H9', name: 'Service Advisor', value: countAdv > 0 ? Math.round(sumAdv / countAdv) : 0, icon: 'HeartHandshake', color: '#8b5cf6' },
          { id: 'fldwSnxNc2', name: 'Dealer Facility & Service Image', value: countFac > 0 ? Math.round(sumFac / countFac) : 0, icon: 'Building2', color: '#06b6d4' },
          { id: 'fldeHCGTJE', name: 'Service Quality', value: countQual > 0 ? Math.round(sumQual / countQual) : 0, icon: 'Star', color: '#f59e0b' },
          { id: 'fld2P5DxKQ', name: 'Leadtime Service', value: countLt > 0 ? Math.round(sumLt / countLt) : 0, icon: 'Clock', color: '#ef4444' },
          { id: 'fldggEklVL', name: 'Delivery Process', value: countDel > 0 ? Math.round(sumDel / countDel) : 0, icon: 'Truck', color: '#10b981' },
          { id: 'fldwvPaNZU', name: 'Spare Part Availibility', value: countPart > 0 ? Math.round(sumPart / countPart) : 0, icon: 'Package', color: '#14b8a6' },
        ]
      };

      setLiveRespondents(mappedRespondents);
      setLiveSummary(liveSummaryData);

      Toastify({
        text: `✅ Berhasil memuat ${activeRecordIDs.length} data ulasan CSI Bulan ${MONTHS[Number(selectedMonth)-1]}!`,
        style: { background: '#10b981', borderRadius: '12px' },
      }).showToast();
    } else {
      setLiveSummary(null);
      setLiveRespondents([]);
    }
    
    setLoading(false);
  }, [dealerFilter, selectedMonth, selectedYear]);

  // Load active month + trend data on mount / filter changes
  useEffect(() => {
    fetchCSIData(false);
  }, [fetchCSIData]);

  // Yearly Trend Chart configuration
  const trendChartOptions = useMemo(() => ({
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: ['#6366f1'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100]
      }
    },
    xaxis: {
      categories: MONTH_SHORT,
      labels: { style: { fontSize: '11px', fontWeight: 650, colors: '#71717a' } }
    },
    yaxis: {
      min: 0,
      max: 1000,
      labels: { style: { fontSize: '11px', fontWeight: 700, colors: '#71717a' } }
    },
    grid: { borderColor: '#f1f1f4' },
    dataLabels: { enabled: true, style: { fontSize: '10px', fontWeight: 700 } },
    tooltip: { theme: 'light', y: { formatter: (val) => `${val} pts` } }
  }), []);

  const trendSeries = useMemo(() => [{
    name: 'CSI Score',
    data: yearlyScores
  }], [yearlyScores]);

  // Monthly breakdown configurations
  const activeSummary = liveSummary || CSI_SUMMARY_FALLBACK;
  const activeRespondents = liveRespondents;

  const barChartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: activeSummary.dimensions.map(d => d.color),
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
      categories: activeSummary.dimensions.map(d => d.name),
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
  }), [activeSummary]);

  const barSeries = useMemo(() => [{
    name: 'Score',
    data: activeSummary.dimensions.map(d => d.value)
  }], [activeSummary]);

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
        max: 1000, // Maximum rating is 1000 pts
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
            offsetY: -22,
          },
          value: {
            show: true,
            fontSize: '48px',
            fontWeight: 900,
            color: '#18181b',
            offsetY: 15,
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

  const gaugeSeries = useMemo(() => [activeSummary.csiScore], [activeSummary]);

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

  const renderStars = (val, max = 5) => {
    return (
      <div className="flex gap-0.5 justify-center">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < val ? 'bg-yellow-400' : 'bg-zinc-200'}`} />
        ))}
      </div>
    );
  };

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

  const activeMonthName = MONTHS[Number(selectedMonth) - 1];

  return (
    <div className="p-6 lg:p-10 w-full space-y-8 animate-fade-in">
      
      {/* Header & Controls Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 tracking-tight">
            CSI Result & Analitik
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {activeSummary.dealerName} — Tahun {selectedYear}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dealerFilter}
            onChange={(e) => setDealerFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 cursor-pointer"
          >
            {DEALER_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 cursor-pointer"
          >
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
            <option value="2024">Tahun 2024</option>
          </select>
          <button
            onClick={() => fetchCSIData(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={(loading || loadingTrend) ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-zinc-200 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <Bug size={16} />
            Debug
          </button>
        </div>
      </div>

      {/* 1. Yearly Trend Graph */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              Grafik Tren Pencapaian CSI Tahunan ({selectedYear})
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">Menunjukkan pergerakan score bulanan dari skala 0 - 1000</p>
          </div>
          {loadingTrend && <span className="text-xs text-zinc-400 font-bold animate-pulse">Menghitung tren...</span>}
        </div>
        <div className="h-[280px]">
          <ReactApexChart
            options={trendChartOptions}
            series={trendSeries}
            type="area"
            height="100%"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex py-3 items-center">
        <div className="flex-grow border-t border-zinc-200"></div>
        <span className="flex-shrink mx-4 text-xs font-black uppercase text-zinc-400 tracking-widest bg-zinc-50 px-3 py-1 border border-zinc-200 rounded-full">
          Detail Hasil CSI Bulanan
        </span>
        <div className="flex-grow border-t border-zinc-200"></div>
      </div>

      {/* Monthly Filter Panel */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm shrink-0">
        <div>
          <h3 className="text-sm font-black text-zinc-900">Ulasan & Skor CSI Berjalan</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Analisis hasil ulasan bulanan kustomer secara mendalam</p>
        </div>
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-zinc-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-900 cursor-pointer"
          >
            {MONTHS.map((m, idx) => (
              <option key={idx} value={String(idx + 1)}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error & Loading state */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800 text-sm">Gagal mengambil data</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-zinc-250 p-16 text-center">
          <RefreshCw size={32} className="animate-spin text-zinc-350 mx-auto mb-3" />
          <p className="text-zinc-500 font-bold text-sm">Mengambil Ulasan Bulanan Feishu...</p>
        </div>
      ) : activeRespondents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
          <div className="text-zinc-350 font-black text-xl">Data Bulanan Kosong</div>
          <p className="text-zinc-400 text-sm mt-1.5 font-medium">Belum ada ulasan yang terkumpul di bulan {activeMonthName} {selectedYear}.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* CSI Score Gauge + Dimensions Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 lg:col-span-1 shadow-sm flex flex-col justify-between">
              <div className="h-[260px]">
                <ReactApexChart
                  options={gaugeOptions}
                  series={gaugeSeries}
                  type="radialBar"
                  height="100%"
                />
              </div>
              <div className="text-center border-t border-zinc-100 pt-4">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Total Responden ({activeMonthName})
                </div>
                <div className="text-xl font-black text-zinc-900 flex items-center justify-center gap-2 mt-1">
                  <Users size={18} className="text-zinc-400" />
                  {activeSummary.totalSample} Responden
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-6 lg:col-span-2 shadow-sm">
              <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-5">
                Dimensi Penilaian ({activeMonthName})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeSummary.dimensions.map((d) => {
                  const Icon = ICON_MAP[d.icon] || Star;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 ${scoreBg(d.value)} transition-all`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                        <Icon size={20} style={{ color: d.color }} />
                      </div>
                      <div className="flex-grow min-w-0">
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

          {/* Bar Chart Dimension Achievement */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-5 flex items-center gap-2">
              <BarChart3 size={16} />
              Grafik Dimensi Bulan {activeMonthName}
            </h2>
            <div className="h-[360px]">
              <ReactApexChart
                options={barChartOptions}
                series={barSeries}
                type="bar"
                height="100%"
              />
            </div>
          </div>

          {/* Computed Scores Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-6 pb-0">
              <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Target size={16} />
                Skor Komputasi Responden ({activeMonthName})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50">
                    <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">No</th>
                    <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nama</th>
                    <th className="text-left p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Produk</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q1</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q2</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q3</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q4</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q5</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q6</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Q7</th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('overall')}>
                      Overall {sortBy === 'overall' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-center p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('recommend')}>
                      Rekomendasi {sortBy === 'recommend' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sortedRespondents.map((r, i) => (
                    <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4 text-zinc-400 font-bold text-xs">{i + 1}</td>
                      <td className="p-4 font-bold text-zinc-900 whitespace-nowrap">{r.name}</td>
                      <td className="p-4 text-zinc-600 text-xs font-semibold">{r.product}</td>
                      <td className="p-4 text-center">{renderStars(r.q1)}</td>
                      <td className="p-4 text-center">{renderStars(r.q2)}</td>
                      <td className="p-4 text-center">{renderStars(r.q3)}</td>
                      <td className="p-4 text-center">{renderStars(r.q4)}</td>
                      <td className="p-4 text-center">{renderStars(r.q5)}</td>
                      <td className="p-4 text-center">{renderStars(r.q6)}</td>
                      <td className="p-4 text-center">{renderStars(r.q7)}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-xs text-emerald-700">
                          {r.overall}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
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

          {/* Comments List */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5 border-b border-zinc-100 pb-4">
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                <HeartHandshake size={16} className="text-zinc-400" />
                Komentar Responden ({activeMonthName})
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
              {(showAllComments ? activeRespondents : activeRespondents.filter(r => r.comments || r.commentsQ8)).map((r) => (
                <div key={r.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-150">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-black">
                      {r.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900">{r.name}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{r.product}</div>
                    </div>
                  </div>
                  {(r.comments || r.commentsQ8) ? (
                    <div className="ml-11 space-y-2.5">
                      {r.comments && (
                        <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                          <span className="text-[9px] font-extrabold uppercase text-amber-600 tracking-wider block mb-0.5">Aspek Ragu Rekomendasi (Q7)</span>
                          <p className="text-xs font-semibold text-zinc-700 leading-relaxed">{r.comments}</p>
                        </div>
                      )}
                      {r.commentsQ8 && (
                        <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                          <span className="text-[9px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-0.5">Masukan & Komentar Akhir (Q8)</span>
                          <p className="text-xs font-semibold text-zinc-700 leading-relaxed">{r.commentsQ8}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-350 italic ml-11">Tidak ada komentar tertulis</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel rendering */}
      {showDebug && rawRecords && (
        <div className="bg-zinc-900 rounded-2xl border-2 border-zinc-700 p-6 overflow-auto max-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
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
                          <span className="text-zinc-350 font-mono break-all">{display}</span>
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
    </div>
  );
}
