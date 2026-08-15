import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp, Users, User, Clock, AlertCircle, ChevronRight, ChevronLeft,
  Search, Calendar, Download, Filter, Car, DollarSign, Activity,
  ShieldCheck, Package, Award, Zap, Star, LayoutDashboard, Database,
  History, Upload, X, BarChart4, CheckCircle, Wrench, Shield, Settings, MessageSquare, Menu, FileSpreadsheet, Key, LogOut
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import CroBookingPanel from './CroBookingPanel';
import HolidaySettings from './HolidaySettings';
import { fetchWithCache, getCache } from '../utils/dataCache';
import WorkOrderReportPage from './WorkOrderReportPage';
import InvoiceReportPage from './InvoiceReportPage';
import WorkItemServicePage from './WorkItemServicePage';
import SparepartRevenuePage from './SparepartRevenuePage';
import StaffRevenuePage from './StaffRevenuePage';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import ReactApexChart from 'react-apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CSI_PROXY_URL } from '../utils/config';

import { db } from '../utils/dbClient';

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

const ManagerPanel = ({ user, handleLogout, handleChangePassword, queue = [], rawHistory = [], breakSettings, setBreakSettings, setIsNavbarVisible, activeTab: activeTabProp }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [usersData, setUsersData] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const mainRef = useRef(null);
  const lastScrollY = useRef(0);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', name: '', role: 'mekanik' });
  const [entityFilter, setEntityFilter] = useState('all');
  const [financialPage, setFinancialPage] = useState(1);
  const [woTrackingData, setWoTrackingData] = useState([]);
  const [activeTab, setActiveTab] = useState(activeTabProp || 'performance');

  // Sync activeTab with prop
  useEffect(() => {
    if (activeTabProp && activeTabProp !== activeTab) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);

  const [timeFilter, setTimeFilter] = useState('today');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const limitMonthIdx = useMemo(() => {
    const now = new Date();
    return selectedYear === now.getFullYear() ? now.getMonth() : 11;
  }, [selectedYear]);

  const activeMonths = useMemo(() => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return months.slice(0, limitMonthIdx + 1);
  }, [limitMonthIdx]);

  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [woStatusFilter, setWoStatusFilter] = useState('all');
  const [woTrackingPage, setWoTrackingPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [financialData, setFinancialData] = useState([]);
  const [sparepartRevenueData, setSparepartRevenueData] = useState([]);
  const [csiScores, setCsiScores] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [csiMonthlyData, setCsiMonthlyData] = useState([]);
  const [csiActiveMonthRecords, setCsiActiveMonthRecords] = useState(null);

  const fetchSparepartRevenue = React.useCallback(async () => {
    try {
      const { data, error } = await db.select('sparepart_revenue', { range: { from: 0, to: 99999 } });
      if (!error && data) {
        setSparepartRevenueData(data);
      }
    } catch (e) {
      console.error("Gagal fetch sparepart revenue:", e);
    }
  }, []);

  const fetchCsiData = React.useCallback(async () => {
    try {
      const activeMonth = String(limitMonthIdx + 1);
      const res = await fetch(CSI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          view: 'results',
          action: 'yearly-trend',
          dealerFilter: 'optef3IAAh',
          month: activeMonth,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        if (Array.isArray(json.scores)) {
          setCsiScores(json.scores);
        }
        if (Array.isArray(json.monthly)) {
          setCsiMonthlyData(json.monthly);
        }
        if (json.records) {
          setCsiActiveMonthRecords(json.records);
        }
      }
    } catch (e) {
      console.error("Gagal fetch CSI scores:", e);
    }
  }, [limitMonthIdx]);

  const financialGen = useRef(0);
  const woHistoryGen = useRef(0);

  const [croHistory, setCroHistory] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  function mapFinancial(rawList) {
    return rawList.map(item => {
      const kat = (item.kategori || item.no_wo?.split('-')?.[0] || 'LAINNYA').toUpperCase().trim();
      const dateVal = item.waktu_selesai || item.waktu_masuk || item.tgl_invoice || item.created_at;
      
      const parseRpVal = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9]/g, '')) || 0;
      };

      const lc = Number(item.lcVal ?? (parseFloat(item.total_jasa || item.jasa || item.biaya_jasa || 0) || 0));
      const so = parseRpVal(item.sub_order);
      const part = Number(item.partVal ?? (parseFloat(item.total_part || item.sparepart || item.biaya_part || 0) || 0));
      
      return {
        no_wo: item.no_wo,
        wkt_masuk: dateVal,
        bk: item.no_polisi || item.no_pol,
        tipe_kendaraan: item.nama_kendaraan || item.tipe_kendaraan || kat,
        kategori: kat,
        jasa: lc,
        so: so,
        s_part: part,
        g_total: item.grandTotalVal ?? (lc + so + part + Math.round((lc + so + part) * 0.11)),
        sa: item.id_karyawan || item.nama_sa || item.sa || '---',
        leader: '',
        mekanik: '',
        nohp: ''
      };
    });
  }

  const fetchFinancialData = React.useCallback(async () => {
    const cacheKey = `invoice_report_cache_data_all___${selectedYear}`;
    const gen = ++financialGen.current;

    const doFetch = async () => {
      const res = await fetch(`/api/chery_dms?endpoint=warranty-invoice-report&from=${selectedYear}-01-01&to=${selectedYear}-12-31`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : (json.payload?.content || []);
    };

    const rawList = await fetchWithCache(cacheKey, doFetch, {
      ttl: 300000,
      onLoading: (loading) => { setIsLoading(loading); },
      onFreshData: (freshData) => {
        if (gen === financialGen.current) setFinancialData(mapFinancial(freshData));
      },
      onError: (e) => { console.error("Gagal fetch financial:", e); }
    });

    if (rawList && gen === financialGen.current) {
      setFinancialData(mapFinancial(rawList));
    }
  }, [selectedYear]);

  const fetchWoHistory = React.useCallback(async () => {
    const cacheKey = `wo_report_cache_data_wo_report_master__${selectedYear}`;
    const gen = ++woHistoryGen.current;

    const doFetch = async () => {
      const params = new URLSearchParams({
        endpoint: 'warranty-wo',
        draw: 1,
        start: 0,
        length: 1000,
        fetchAll: 'true',
        status: ''
      });
      const res = await fetch(`/api/chery_dms?${params}`);
      const json = await res.json().catch(() => ({}));
      return json.data || [];
    };

    const rawList = await fetchWithCache(cacheKey, doFetch, {
      ttl: 300000,
      onLoading: (loading) => { setIsLoading(loading); },
      onFreshData: (freshData) => {
        if (gen === woHistoryGen.current) setWoTrackingData(buildTrackingData(freshData));
      },
      onError: (e) => { console.error("Gagal fetch tracking:", e); }
    });

    if (rawList && gen === woHistoryGen.current) {
      setWoTrackingData(buildTrackingData(rawList));
    }
  }, [selectedYear]);

  function buildTrackingData(rawList) {
    const dmsMap = new Map();
    rawList.forEach(item => {
      const key = item.id_wo || item.no_wo;
      if (key && !dmsMap.has(key)) {
        dmsMap.set(key, {
          no_wo: item.no_wo,
          bk: item.no_polisi,
          no_chassis: item.no_chassis || item.no_polisi,
          tipe_kendaraan: item.nama_kendaraan,
          sa: item.id_karyawan || item.nama_sa || item.sa || '---',
          mekanik: item.nama_mekanik1 || '---',
          leader: item.nama_leader1 || '---',
          wkt_masuk: item.waktu_masuk,
          status: item.status,
          stand_km: Number(item.stand_km || item.km || 0)
        });
      }
    });
    return Array.from(dmsMap.values());
  }

  const fetchCroHistory = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db.select('cro', { eq: { status: 'Sudah' } });
      if (error) throw error;
      setCroHistory(data || []);
    } catch (e) {
      console.error("Gagal fetch CRO:", e);
    }
    setIsLoading(false);
  }, []);

  const fetchUsers = React.useCallback(async () => {
    try {
      const { data, error } = await db.select('users', { select: 'username, name, role' });
      if (error) throw error;
      if (data) setUsersData(data);
    } catch (e) {
      console.error("Gagal fetch users:", e);
    }
  }, []);

  useEffect(() => {
    // Only fetch tab-specific data lazily when tab is active
    if (activeTab === 'performance') {
      fetchFinancialData();
      fetchWoHistory();
      fetchSparepartRevenue();
      fetchCsiData();
    } else if (activeTab === 'wo_tracking') {
      fetchWoHistory();
    } else if (activeTab === 'staff') {
      fetchUsers();
    } else if (activeTab === 'cro_history') {
      fetchCroHistory();
    }
  }, [activeTab, fetchFinancialData, fetchWoHistory, fetchUsers, fetchCroHistory, fetchSparepartRevenue, fetchCsiData]);

  useEffect(() => {
    setFinancialPage(1);
    setWoTrackingPage(1);
  }, [searchTerm, timeFilter, entityFilter, woStatusFilter, activeTab]);

  const parseDateToTimestamp = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const handleUpsertUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: existing } = await db.select('users', { select: 'id', eq: { username: userFormData.username }, maybeSingle: true });
      let error;
      if (existing) {
        const updates = { name: userFormData.name, role: userFormData.role };
        if (userFormData.password) updates.password = userFormData.password;
        ({ error } = await db.update('users', updates, { eq: { id: existing.id } }));
      } else {
        ({ error } = await db.insert('users', userFormData));
      }
      if (!error) {
        Toastify({ text: `✓ User ${existing ? 'diperbarui' : 'ditambahkan'}`, duration: 3000, gravity: "top", position: "right", style: { background: "#10b981", borderRadius: "10px" } }).showToast();
        setIsUserModalOpen(false);
        setUserFormData({ username: '', password: '', name: '', role: 'mekanik' });
        fetchUsers();
      } else {
        throw error;
      }
    } catch (e) { console.error(e); Toastify({ text: "❌ Gagal simpan user", style: { background: "red" } }).showToast(); } finally { setIsLoading(false); }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Hapus user ${username}?`)) return;
    setIsLoading(true);
    try {
      const { error } = await db.delete('users', { eq: { username } });
      if (!error) {
        Toastify({ text: "✓ User Terhapus", duration: 3000, gravity: "top", position: "right", style: { background: "#ef4444", borderRadius: "10px" } }).showToast();
        fetchUsers();
      } else {
        throw error;
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const normalizeDateStr = (val) => {
    if (!val) return '';
    try {
      let dObj;
      if (val instanceof Date) dObj = val;
      else if (typeof val === 'number') {
        dObj = new Date(val);
      } else {
        let str = String(val).trim();
        // Handle DD/MM/YYYY or DD/MM/YYYY HH:mm
        if (str.includes('/')) {
          const cleanStr = str.split(' ')[0];
          const p = cleanStr.split('/');
          if (p.length === 3) {
            if (p[2].length === 4) dObj = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
            else if (p[0].length === 4) dObj = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
          }
        } else {
          if (/^\d{10,13}$/.test(str)) {
             dObj = new Date(parseInt(str));
          } else {
             dObj = new Date(str);
          }
        }
      }

      if (!dObj || isNaN(dObj.getTime())) return '';
      const dy = String(dObj.getDate()).padStart(2, '0');
      const mt = String(dObj.getMonth() + 1).padStart(2, '0');
      const yr = dObj.getFullYear();
      return `${yr}-${mt}-${dy}`;
    } catch (e) { return ''; }
  };

  const getMonthName = (monthIdx) => {
    const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return names[monthIdx];
  };

  const formatDisplayDate = (val) => {
    if (!val) return '---';
    const norm = normalizeDateStr(val);
    if (!norm) return String(val).split('T')[0].split('-').reverse().join('/');
    const p = norm.split('-');
    if (p.length === 3) {
      const d = parseInt(p[2]);
      const m = parseInt(p[1]) - 1;
      const y = p[0];
      return `${d} ${getMonthName(m)} ${y}`;
    }
    return norm;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
  };

  const filteredHistory = useMemo(() => {
    return rawHistory.filter(item => {
      const itemDateStr = normalizeDateStr(item.id);
      if (!itemDateStr) return false;

      const now = new Date();
      const todayStr = normalizeDateStr(now);

      if (timeFilter === 'today') return itemDateStr === todayStr;
      if (timeFilter === 'this_month') return itemDateStr.startsWith(todayStr.substring(0, 7));
      if (timeFilter === 'year') return itemDateStr.startsWith(String(selectedYear));
      if (timeFilter === 'custom' && customRange.start && customRange.end) {
        return itemDateStr >= customRange.start && itemDateStr <= customRange.end;
      }
      return true; // if 'all'
    });
  }, [rawHistory, timeFilter, selectedYear, customRange]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortData = (data, config) => {
    if (!config.key) return data;
    return [...data].sort((a, b) => {
      let valA = a[config.key], valB = b[config.key];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }
      if (valA < valB) return config.direction === 'asc' ? -1 : 1;
      if (valA > valB) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedWoTrackingData = useMemo(() => {
    const base = woTrackingData.filter(item => {
      // 1. Time Filter
      const itemDateStr = normalizeDateStr(item.wkt_masuk || item.wktmasuk);
      const now = new Date();
      const todayStr = normalizeDateStr(now);

      let matchesTime = true;
      if (itemDateStr) {
        if (timeFilter === 'today') matchesTime = itemDateStr === todayStr;
        else if (timeFilter === 'this_month') matchesTime = itemDateStr.startsWith(todayStr.substring(0, 7));
        else if (timeFilter === 'year') matchesTime = itemDateStr.startsWith(String(selectedYear));
        else if (timeFilter === 'custom' && customRange.start && customRange.end) {
          matchesTime = itemDateStr >= customRange.start && itemDateStr <= customRange.end;
        }
      } else if (timeFilter !== 'all') {
        matchesTime = false;
      }

      // 2. Search & Status Filter
      const s = searchTerm.toLowerCase();
      const matchesSearch = !s || (item.no_wo || '').toLowerCase().includes(s) || (item.bk || '').toLowerCase().includes(s);
      const matchesStatus = woStatusFilter === 'all' || (item.status || '').toLowerCase() === woStatusFilter.toLowerCase();

      return matchesTime && matchesSearch && matchesStatus;
    });
    return sortData(base, sortConfig);
  }, [woTrackingData, timeFilter, selectedYear, customRange, searchTerm, woStatusFilter, sortConfig]);

  const filteredFinancialDataRaw = useMemo(() => {
    return financialData.filter(item => {
      const itemDateStr = normalizeDateStr(item.wkt_masuk);
      if (!itemDateStr) return false;

      const now = new Date();
      const todayStr = normalizeDateStr(now);

      let matchesTime = true;
      if (timeFilter === 'today') matchesTime = itemDateStr === todayStr;
      else if (timeFilter === 'this_month') matchesTime = itemDateStr.startsWith(todayStr.substring(0, 7));
      else if (timeFilter === 'year') matchesTime = itemDateStr.startsWith(String(selectedYear));
      else if (timeFilter === 'custom' && customRange.start && customRange.end) {
        matchesTime = itemDateStr >= customRange.start && itemDateStr <= customRange.end;
      }

      const matchesEntity = entityFilter === 'all' || (item.no_wo || '').toUpperCase().includes(entityFilter.toUpperCase());
      const s = searchTerm.toLowerCase();
      const matchesSearch = !s || (item.no_wo || '').toLowerCase().includes(s) || (item.bk || '').toLowerCase().includes(s) || (item.tipe_kendaraan || '').toLowerCase().includes(s);

      return matchesTime && matchesEntity && matchesSearch;
    });
  }, [financialData, timeFilter, selectedYear, customRange, entityFilter, searchTerm]);

  const sortedFinancialData = useMemo(() => sortData(filteredFinancialDataRaw, sortConfig), [filteredFinancialDataRaw, sortConfig]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = normalizeDateStr(now);
    const selesaiCount = filteredHistory.length;

    const workingNow = queue.filter(q => ['working', 'PROSES'].includes(q.status)).length;
    const overnightCount = queue.filter(q => q.status === 'menginap').length;

    const waitingCount = queue.filter(q => (q.status || '').toLowerCase() === 'waiting').length;

    const totalWo = sortedWoTrackingData.length;
    const eurCount = sortedWoTrackingData.filter(x => String(x.no_wo || '').toUpperCase().includes('EUR')).length;
    const ifsCount = sortedWoTrackingData.filter(x => String(x.no_wo || '').toUpperCase().includes('IFS')).length;
    const ikcCount = sortedWoTrackingData.filter(x => String(x.no_wo || '').toUpperCase().includes('IKC')).length;

    return {
      selesaiCount, workingCount: workingNow, overnightCount, waitingCount,
      totalWo, eurCount, ifsCount, ikcCount
    };
  }, [filteredHistory, queue, sortedWoTrackingData]);

  const financialSummary = useMemo(() => {
    return filteredFinancialDataRaw.reduce((acc, curr) => {
      acc.jasa += (curr.jasa || 0);
      acc.so += (curr.so || 0);
      acc.s_part += (curr.s_part || 0);
      acc.grandTotal += (curr.g_total || 0);
      return acc;
    }, { jasa: 0, so: 0, s_part: 0, grandTotal: 0 });
  }, [filteredFinancialDataRaw]);

  const monthlyChartData = useMemo(() => {
    const targetYear = selectedYear || 2026;
    const fullYearMap = {};
    for (let m = 0; m < 12; m++) {
      const mKey = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
      fullYearMap[mKey] = { jasa: 0, part: 0, grand: 0 };
    }

    financialData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (fullYearMap[mKey]) {
        fullYearMap[mKey].jasa += (item.jasa || 0);
        fullYearMap[mKey].part += (item.s_part || 0);
        fullYearMap[mKey].grand += (item.g_total || (item.jasa || 0) + (item.s_part || 0));
      }
    });

    const sortedMonths = Object.keys(fullYearMap).sort();
    const categories = sortedMonths.map(tag => {
      const [y, m] = tag.split('-');
      return `${getMonthName(parseInt(m) - 1)}`;
    });

    const series = [
      { name: 'Total Keuntungan / Revenue', data: sortedMonths.map(m => fullYearMap[m].grand) },
      { name: 'Jasa Service', data: sortedMonths.map(m => fullYearMap[m].jasa) },
      { name: 'Sparepart', data: sortedMonths.map(m => fullYearMap[m].part) }
    ];
    return { series, categories, year: targetYear };
  }, [financialData, selectedYear]);

  const woMonthlyChartData = useMemo(() => {
    const targetYear = selectedYear || 2026;
    const fullYearMap = {};
    for (let m = 0; m < 12; m++) {
      const mKey = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
      fullYearMap[mKey] = 0;
    }

    woTrackingData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (fullYearMap[mKey] !== undefined) {
        fullYearMap[mKey] += 1;
      }
    });

    const sortedMonths = Object.keys(fullYearMap).sort();
    const categories = sortedMonths.map(tag => {
      const [y, m] = tag.split('-');
      return `${getMonthName(parseInt(m) - 1)}`;
    });

    const series = [
      { name: 'Jumlah Work Order', data: sortedMonths.map(m => fullYearMap[m]) }
    ];
    return { series, categories, year: targetYear };
  }, [woTrackingData, selectedYear]);

  const unitEntryMonthlyChartData = useMemo(() => {
    const targetYear = selectedYear || 2026;
    const fullYearMap = {};
    for (let m = 0; m < 12; m++) {
      const mKey = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
      fullYearMap[mKey] = new Set();
    }

    woTrackingData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (fullYearMap[mKey] !== undefined) {
        const vin = String(item.no_chassis || item.bk || '').trim().toUpperCase();
        if (vin) {
          fullYearMap[mKey].add(vin);
        }
      }
    });

    const sortedMonths = Object.keys(fullYearMap).sort();
    const categories = sortedMonths.map(tag => {
      const [y, m] = tag.split('-');
      return `${getMonthName(parseInt(m) - 1)}`;
    });

    const series = [
      { name: 'Unit Masuk', data: sortedMonths.map(m => fullYearMap[m].size) }
    ];

    const yearVins = new Set();
    woTrackingData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (mKey.startsWith(String(targetYear))) {
        const vin = String(item.no_chassis || item.bk || '').trim().toUpperCase();
        if (vin) yearVins.add(vin);
      }
    });
    const total = yearVins.size;

    return { series, categories, year: targetYear, total };
  }, [woTrackingData, selectedYear]);

  const getSegmentHelper = (pelanggan) => {
    const p = String(pelanggan || '').trim().toUpperCase();
    if (p.startsWith('RS0001C')) return 'Retail / Customer';
    if (p.startsWith('RS0001')) return 'Service';
    if (p.startsWith('RMS') || p.startsWith('GJ1') || p.startsWith('PAM')) return 'Partshop';
    if (p.startsWith('IOB') || p.startsWith('INT')) return 'Internal';
    return 'Retail / Customer';
  };

  const sparepartMonthlyChartData = useMemo(() => {
    const targetYear = selectedYear || 2026;
    const fullYearMap = {};
    for (let m = 0; m < 12; m++) {
      const mKey = `${targetYear}-${String(m + 1).padStart(2, '0')}`;
      fullYearMap[mKey] = { service: 0, partshop: 0, internal: 0, customer: 0 };
    }

    sparepartRevenueData.forEach(item => {
      const dateStr = normalizeDateStr(item.Tgl);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (fullYearMap[mKey] !== undefined) {
        const seg = getSegmentHelper(item.Pelanggan);
        const amt = parseFloat(item.Total) || 0;
        if (seg === 'Service') fullYearMap[mKey].service += amt;
        else if (seg === 'Partshop') fullYearMap[mKey].partshop += amt;
        else if (seg === 'Internal') fullYearMap[mKey].internal += amt;
        else if (seg === 'Retail / Customer') fullYearMap[mKey].customer += amt;
      }
    });

    const sortedMonths = Object.keys(fullYearMap).sort();
    const categories = sortedMonths.map(tag => {
      const [y, m] = tag.split('-');
      return `${getMonthName(parseInt(m) - 1)}`;
    });

    const series = [
      { name: 'Service', data: sortedMonths.map(m => fullYearMap[m].service) },
      { name: 'Partshop', data: sortedMonths.map(m => fullYearMap[m].partshop) },
      { name: 'Internal', data: sortedMonths.map(m => fullYearMap[m].internal) },
      { name: 'Retail / Customer', data: sortedMonths.map(m => fullYearMap[m].customer) }
    ];
    return { series, categories, year: targetYear };
  }, [sparepartRevenueData, selectedYear]);

  const saLeaderboard = useMemo(() => {
    const map = {};
    woTrackingData.forEach(item => {
      const saName = (item.sa || '').trim();
      if (!saName || saName === '---') return;
      if (!map[saName]) map[saName] = 0;
      map[saName]++;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [woTrackingData]);

  const mechanicLeaderboard = useMemo(() => {
    const map = {};
    woTrackingData.forEach(item => {
      const mechName = (item.mekanik || '').trim();
      if (!mechName || mechName === '---') return;
      if (!map[mechName]) map[mechName] = 0;
      map[mechName]++;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [woTrackingData]);

  const vehicleStats = useMemo(() => {
    const map = {};
    woTrackingData.forEach(item => {
      const type = (item.tipe_kendaraan || 'Tipe Tidak Diketahui').trim();
      if (!type || type === '---') return;
      if (!map[type]) map[type] = { type, count: 0, km15k: 0, km30k: 0, km45k: 0, km60k: 0 };
      map[type].count++;
      const km = Number(item.stand_km || 0);
      if (km >= 15000) map[type].km15k++;
      if (km >= 30000) map[type].km30k++;
      if (km >= 45000) map[type].km45k++;
      if (km >= 60000) map[type].km60k++;
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [woTrackingData]);

  const vehicleLeaderboard = useMemo(() => {
    const map = {};
    rawHistory.forEach(item => {
      if (!item.bk) return;
      if (!map[item.bk]) map[item.bk] = { bk: item.bk, tipe: item.tipe, count: 0 };
      map[item.bk].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [rawHistory]);



  const execUnitEntryData = useMemo(() => {
    const monthlyData = Array.from({ length: 12 }, () => ({
      uniqueIFS: new Set(),
      uniqueIKC: new Set(),
      uniqueEUR: new Set(),
      uniqueIOB: new Set(),
      uniqueAll: new Set(),
      woIFS: 0,
      woIKC: 0,
      woEUR: 0,
      woIOB: 0,
      woTotal: 0
    }));

    const ytdSets = {
      IFS: new Set(),
      IKC: new Set(),
      EUR: new Set(),
      IOB: new Set(),
      All: new Set()
    };

    woTrackingData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk || item.wktmasuk);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      const vehicleId = String(item.no_chassis || item.bk || '').trim().toUpperCase();
      if (!vehicleId) return;

      const wo = String(item.no_wo || '').toUpperCase();
      const kat = (item.kategori || item.status || '').toUpperCase();

      if (wo.includes('IFS') || kat.includes('IFS')) {
        monthlyData[m].uniqueIFS.add(vehicleId);
        monthlyData[m].woIFS++;
        ytdSets.IFS.add(vehicleId);
      }
      if (wo.includes('IKC') || kat.includes('IKC')) {
        monthlyData[m].uniqueIKC.add(vehicleId);
        monthlyData[m].woIKC++;
        ytdSets.IKC.add(vehicleId);
      }
      if (wo.includes('EUR') || kat.includes('EUR')) {
        monthlyData[m].uniqueEUR.add(vehicleId);
        monthlyData[m].woEUR++;
        ytdSets.EUR.add(vehicleId);
      }
      if (wo.includes('IOB') || kat.includes('IOB')) {
        monthlyData[m].uniqueIOB.add(vehicleId);
        monthlyData[m].woIOB++;
        ytdSets.IOB.add(vehicleId);
      }
      monthlyData[m].uniqueAll.add(vehicleId);
      monthlyData[m].woTotal++;
      ytdSets.All.add(vehicleId);
    });

    const months = monthlyData.map(m => ({
      uniqueIFS: m.uniqueIFS.size,
      uniqueIKC: m.uniqueIKC.size,
      uniqueEUR: m.uniqueEUR.size,
      uniqueIOB: m.uniqueIOB.size,
      uniqueTotal: m.uniqueAll.size,
      woIFS: m.woIFS,
      woIKC: m.woIKC,
      woEUR: m.woEUR,
      woIOB: m.woIOB,
      woTotal: m.woTotal
    })).slice(0, limitMonthIdx + 1);

    const ytdTotals = {
      uniqueIFS: ytdSets.IFS.size,
      uniqueIKC: ytdSets.IKC.size,
      uniqueEUR: ytdSets.EUR.size,
      uniqueIOB: ytdSets.IOB.size,
      uniqueTotal: ytdSets.All.size,
      woIFS: months.reduce((acc, m) => acc + m.woIFS, 0),
      woIKC: months.reduce((acc, m) => acc + m.woIKC, 0),
      woEUR: months.reduce((acc, m) => acc + m.woEUR, 0),
      woIOB: months.reduce((acc, m) => acc + m.woIOB, 0),
      woTotal: months.reduce((acc, m) => acc + m.woTotal, 0)
    };

    return {
      months,
      ytdTotals
    };
  }, [woTrackingData, selectedYear, limitMonthIdx]);

  const execLaborChargeData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, () => ({ IFS: 0, IKC: 0, EUR: 0, IOB: 0, Total: 0 }));
    financialData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      const val = Number(item.jasa || 0);
      const wo = String(item.no_wo || '').toUpperCase();
      if (wo.includes('IFS')) monthly[m].IFS += val;
      else if (wo.includes('IKC')) monthly[m].IKC += val;
      else if (wo.includes('EUR')) monthly[m].EUR += val;
      else if (wo.includes('IOB')) monthly[m].IOB += val;
      monthly[m].Total += val;
    });
    return monthly.slice(0, limitMonthIdx + 1);
  }, [financialData, selectedYear, limitMonthIdx]);

  const execSubOrderData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, () => ({ IFS: 0, IKC: 0, EUR: 0, IOB: 0, Total: 0 }));
    financialData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      const val = Number(item.so || 0);
      const wo = String(item.no_wo || '').toUpperCase();
      if (wo.includes('IFS')) monthly[m].IFS += val;
      else if (wo.includes('IKC')) monthly[m].IKC += val;
      else if (wo.includes('EUR')) monthly[m].EUR += val;
      else if (wo.includes('IOB')) monthly[m].IOB += val;
      monthly[m].Total += val;
    });
    return monthly.slice(0, limitMonthIdx + 1);
  }, [financialData, selectedYear, limitMonthIdx]);

  const execSparepartWorkshopData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, () => ({
      RS0001: 0,
      '114-I': 0,
      'INT-112': 0,
      Total: 0
    }));
    sparepartRevenueData.forEach(item => {
      const dateStr = normalizeDateStr(item.Tgl);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      const p = String(item.Pelanggan || '').trim().toUpperCase();
      const val = Number(item.Total || 0);

      if (p.startsWith('RS0001') && !p.startsWith('RS0001C')) {
        monthly[m].RS0001 += val;
        monthly[m].Total += val;
      } else if (p.startsWith('114-I') || p.startsWith('114I') || p.includes('114-I') || p.includes('114I')) {
        monthly[m]['114-I'] += val;
        monthly[m].Total += val;
      } else if (p.startsWith('INT-112') || p.startsWith('INT112') || p.startsWith('INT-') || p.startsWith('INT') || p.startsWith('IOB') || p.includes('INT-112') || p.includes('INT112')) {
        monthly[m]['INT-112'] += val;
        monthly[m].Total += val;
      }
    });
    return monthly.slice(0, limitMonthIdx + 1);
  }, [sparepartRevenueData, selectedYear, limitMonthIdx]);

  const execSparepartNonWorkshopData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, () => ({
      retail: 0,
      partshop: 0,
      Total: 0
    }));
    sparepartRevenueData.forEach(item => {
      const dateStr = normalizeDateStr(item.Tgl);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      const seg = getSegmentHelper(item.Pelanggan);
      const val = Number(item.Total || 0);

      if (seg === 'Retail / Customer') {
        monthly[m].retail += val;
        monthly[m].Total += val;
      } else if (seg === 'Partshop') {
        monthly[m].partshop += val;
        monthly[m].Total += val;
      }
    });
    return monthly.slice(0, limitMonthIdx + 1);
  }, [sparepartRevenueData, selectedYear, limitMonthIdx]);

  const execStaffActivityData = useMemo(() => {
    const saMonthly = {};
    const mechMonthly = {};
    woTrackingData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk || item.wktmasuk);
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (date.getFullYear() !== selectedYear) return;
      const m = date.getMonth();
      if (m > limitMonthIdx) return;
      const saName = String(item.sa || '').trim();
      const mechName = String(item.mekanik || '').trim();
      if (saName && saName !== '---') {
        if (!saMonthly[saName]) saMonthly[saName] = Array(limitMonthIdx + 1).fill(0);
        saMonthly[saName][m]++;
      }
      if (mechName && mechName !== '---') {
        if (!mechMonthly[mechName]) mechMonthly[mechName] = Array(limitMonthIdx + 1).fill(0);
        mechMonthly[mechName][m]++;
      }
    });
    return { saMonthly, mechMonthly };
  }, [woTrackingData, selectedYear, limitMonthIdx]);

  const execCsiData = useMemo(() => {
    return csiScores.slice(0, limitMonthIdx + 1);
  }, [csiScores, limitMonthIdx]);

  const activeCsiSummary = useMemo(() => {
    if (csiMonthlyData && csiMonthlyData.length > 0) {
      const activeMonthData = csiMonthlyData[limitMonthIdx];
      if (activeMonthData) {
        return {
          csiScore: activeMonthData.csiScore || 0,
          totalSample: activeMonthData.totalSample || 0,
          dimensions: activeMonthData.dimensions || []
        };
      }
    }
    return {
      csiScore: 0,
      totalSample: 0,
      dimensions: [
        { name: 'Service Appointment', value: 0, color: '#3b82f6' },
        { name: 'Service Advisor', value: 0, color: '#8b5cf6' },
        { name: 'Dealer Facility & Service Image', value: 0, color: '#06b6d4' },
        { name: 'Service Quality', value: 0, color: '#f59e0b' },
        { name: 'Leadtime Service', value: 0, color: '#ef4444' },
        { name: 'Delivery Process', value: 0, color: '#10b981' },
        { name: 'Spare Part Availibility', value: 0, color: '#14b8a6' },
      ]
    };
  }, [csiMonthlyData, limitMonthIdx]);

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
        max: 1000,
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
            fontSize: '11px',
            fontWeight: 700,
            color: '#71717a',
            offsetY: -15,
          },
          value: {
            show: true,
            fontSize: '28px',
            fontWeight: 900,
            color: '#18181b',
            offsetY: 10,
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

  const gaugeSeries = useMemo(() => [activeCsiSummary.csiScore], [activeCsiSummary]);

  const barChartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
    },
    colors: activeCsiSummary.dimensions.map(d => d.color || '#3b82f6'),
    plotOptions: {
      bar: {
        borderRadius: 6,
        horizontal: true,
        distributed: true,
        barHeight: '70%',
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => val,
      style: { fontSize: '11px', fontWeight: 700, colors: ['#fff'] },
      offsetX: -8,
    },
    xaxis: {
      categories: activeCsiSummary.dimensions.map(d => d.name),
      labels: { show: true, style: { fontSize: '10px', fontWeight: 650, colors: '#18181b' } },
      max: 1000,
      tickAmount: 5,
    },
    yaxis: {
      labels: { style: { fontSize: '9px', fontWeight: 700, colors: '#18181b' } },
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
  }), [activeCsiSummary]);

  const barSeries = useMemo(() => [{
    name: 'Score',
    data: activeCsiSummary.dimensions.map(d => d.value)
  }], [activeCsiSummary]);

  const captureSvgChart = async (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const svg = el.querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(rect.width));
    clone.setAttribute('height', String(rect.height));
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);

    const xml = new XMLSerializer().serializeToString(clone);
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = rect.width * scale;
        canvas.height = rect.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), ratio: rect.width / rect.height });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  const addImageFitted = (doc, img, maxW, maxH, x, y) => {
    let w = maxW;
    let h = w / img.ratio;
    if (h > maxH) { h = maxH; w = h * img.ratio; }
    doc.addImage(img.dataUrl, 'JPEG', x + (maxW - w) / 2, y, w, h);
    return y + h + 4;
  };

  const handleExportExecutivePdf = async () => {
    Toastify({
      text: "⏳ Menyiapkan laporan PDF eksekutif manager (landscape)...",
      duration: 3000,
      style: { background: '#6366f1', borderRadius: '12px' },
    }).showToast();

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;

      // Capture charts
      const chart1 = await captureSvgChart('exec-chart-unit-entry');
      const chart2 = await captureSvgChart('exec-chart-labor-charge');
      const chart2_so = await captureSvgChart('exec-chart-sub-order');
      const chart3_1 = await captureSvgChart('exec-chart-sparepart-workshop');
      const chart3_2 = await captureSvgChart('exec-chart-sparepart-non-workshop');
      const chart4 = await captureSvgChart('exec-chart-csi');
      const gaugeImg = await captureSvgChart('csi-gauge-chart');
      const barImg = await captureSvgChart('csi-bar-chart');

      const drawHeader = (title) => {
        doc.setFillColor(24, 24, 27);
        doc.rect(0, 0, pageW, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('LAPORAN EKSEKUTIF MANAGER', margin, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(199, 210, 254);
        doc.text(`${title}  •  Januari - ${activeMonths[limitMonthIdx]} ${selectedYear}`, margin, 17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(161, 161, 170);
        doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`, pageW - margin, 17, { align: 'right' });
      };

      // PAGE 1: Laporan Unit Entry
      drawHeader('Laporan Unit Entry (Work Order)');
      
      const types = ['IFS', 'IKC', 'EUR', 'IOB'];
      const ueRows = [];
      types.forEach(t => {
        const rowWo = [`${t} (Work Order)`];
        activeMonths.forEach((_, mIdx) => {
          rowWo.push(String(execUnitEntryData.months[mIdx]?.[`wo${t}`] || 0));
        });
        rowWo.push(String(execUnitEntryData.ytdTotals[`wo${t}`] || 0));
        ueRows.push(rowWo);

        const rowUe = [`${t} (Unit Entry)`];
        activeMonths.forEach((_, mIdx) => {
          rowUe.push(String(execUnitEntryData.months[mIdx]?.[`unique${t}`] || 0));
        });
        rowUe.push(String(execUnitEntryData.ytdTotals[`unique${t}`] || 0));
        ueRows.push(rowUe);
      });

      const totalRowWo = ['Total (Work Order)'];
      activeMonths.forEach((_, mIdx) => {
        totalRowWo.push(String(execUnitEntryData.months[mIdx]?.woTotal || 0));
      });
      totalRowWo.push(String(execUnitEntryData.ytdTotals.woTotal || 0));
      ueRows.push(totalRowWo);

      const totalRowUe = ['Total (Unit Entry)'];
      activeMonths.forEach((_, mIdx) => {
        totalRowUe.push(String(execUnitEntryData.months[mIdx]?.uniqueTotal || 0));
      });
      totalRowUe.push(String(execUnitEntryData.ytdTotals.uniqueTotal || 0));
      ueRows.push(totalRowUe);

      autoTable(doc, {
        startY: 28,
        head: [['Tipe/Segment', ...activeMonths, 'Total']],
        body: ueRows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index >= data.table.body.length - 2) {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 27, 75];
          }
        }
      });

      if (chart1) {
        addImageFitted(doc, chart1, contentW, 105, margin, doc.lastAutoTable.finalY + 8);
      }

      // PAGE 2: Labor Charge
      doc.addPage();
      drawHeader('Laporan Keuntungan Labor Charge (Jasa)');

      const lcRows = types.map(t => {
        const row = [t];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = execLaborChargeData[mIdx]?.[t] || 0;
          row.push(formatCurrency(val).replace(',00', ''));
          total += val;
        });
        row.push(formatCurrency(total).replace(',00', ''));
        return row;
      });
      // Add Total Row
      const lcTotalRow = ['Total'];
      let lcGrandTotal = 0;
      activeMonths.forEach((_, mIdx) => {
        const sum = types.reduce((acc, t) => acc + (execLaborChargeData[mIdx]?.[t] || 0), 0);
        lcTotalRow.push(formatCurrency(sum).replace(',00', ''));
        lcGrandTotal += sum;
      });
      lcTotalRow.push(formatCurrency(lcGrandTotal).replace(',00', ''));
      lcRows.push(lcTotalRow);

      autoTable(doc, {
        startY: 28,
        head: [['Tipe/Segment', ...activeMonths, 'Total']],
        body: lcRows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 27, 75];
          }
        }
      });

      if (chart2) {
        addImageFitted(doc, chart2, contentW, 105, margin, doc.lastAutoTable.finalY + 8);
      }

      // PAGE 2b: Sub Order (SO)
      doc.addPage();
      drawHeader('Laporan Keuntungan Sub Order (SO)');

      const soRows = types.map(t => {
        const row = [t];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = execSubOrderData[mIdx]?.[t] || 0;
          row.push(formatCurrency(val).replace(',00', ''));
          total += val;
        });
        row.push(formatCurrency(total).replace(',00', ''));
        return row;
      });
      // Add Total Row
      const soTotalRow = ['Total'];
      let soGrandTotal = 0;
      activeMonths.forEach((_, mIdx) => {
        const sum = types.reduce((acc, t) => acc + (execSubOrderData[mIdx]?.[t] || 0), 0);
        soTotalRow.push(formatCurrency(sum).replace(',00', ''));
        soGrandTotal += sum;
      });
      soTotalRow.push(formatCurrency(soGrandTotal).replace(',00', ''));
      soRows.push(soTotalRow);

      autoTable(doc, {
        startY: 28,
        head: [['Tipe/Segment', ...activeMonths, 'Total']],
        body: soRows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 27, 75];
          }
        }
      });

      if (chart2_so) {
        addImageFitted(doc, chart2_so, contentW, 105, margin, doc.lastAutoTable.finalY + 8);
      }

      // PAGE 3: Sparepart Workshop
      doc.addPage();
      drawHeader('Laporan Penjualan Sparepart Workshop');

      const spWorkSegs = [
        { label: 'RS0001 (Service)', key: 'RS0001' },
        { label: '114-I (Asuransi)', key: '114-I' },
        { label: 'INT-112 (Internal)', key: 'INT-112' }
      ];

      const spWorkRows = spWorkSegs.map(s => {
        const row = [s.label];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = execSparepartWorkshopData[mIdx]?.[s.key] || 0;
          row.push(formatCurrency(val).replace(',00', ''));
          total += val;
        });
        row.push(formatCurrency(total).replace(',00', ''));
        return row;
      });
      // Add Total Row
      const spWorkTotalRow = ['Total'];
      let spWorkGrandTotal = 0;
      activeMonths.forEach((_, mIdx) => {
        const sum = spWorkSegs.reduce((acc, s) => acc + (execSparepartWorkshopData[mIdx]?.[s.key] || 0), 0);
        spWorkTotalRow.push(formatCurrency(sum).replace(',00', ''));
        spWorkGrandTotal += sum;
      });
      spWorkTotalRow.push(formatCurrency(spWorkGrandTotal).replace(',00', ''));
      spWorkRows.push(spWorkTotalRow);

      autoTable(doc, {
        startY: 28,
        head: [['Segmen Workshop', ...activeMonths, 'Total']],
        body: spWorkRows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 27, 75];
          }
        }
      });

      if (chart3_1) {
        addImageFitted(doc, chart3_1, contentW, 105, margin, doc.lastAutoTable.finalY + 8);
      }

      // PAGE 4: Sparepart Non-Workshop
      doc.addPage();
      drawHeader('Laporan Penjualan Sparepart Non Workshop');

      const spNonWorkSegs = [
        { label: 'Retail', key: 'retail' },
        { label: 'Partshop', key: 'partshop' }
      ];

      const spNonWorkRows = spNonWorkSegs.map(s => {
        const row = [s.label];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = execSparepartNonWorkshopData[mIdx]?.[s.key] || 0;
          row.push(formatCurrency(val).replace(',00', ''));
          total += val;
        });
        row.push(formatCurrency(total).replace(',00', ''));
        return row;
      });
      // Add Total Row
      const spNonWorkTotalRow = ['Total'];
      let spNonWorkGrandTotal = 0;
      activeMonths.forEach((_, mIdx) => {
        const sum = spNonWorkSegs.reduce((acc, s) => acc + (execSparepartNonWorkshopData[mIdx]?.[s.key] || 0), 0);
        spNonWorkTotalRow.push(formatCurrency(sum).replace(',00', ''));
        spNonWorkGrandTotal += sum;
      });
      spNonWorkTotalRow.push(formatCurrency(spNonWorkGrandTotal).replace(',00', ''));
      spNonWorkRows.push(spNonWorkTotalRow);

      autoTable(doc, {
        startY: 28,
        head: [['Segmen Non-Workshop', ...activeMonths, 'Total']],
        body: spNonWorkRows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = [224, 231, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 27, 75];
          }
        }
      });

      if (chart3_2) {
        addImageFitted(doc, chart3_2, contentW, 105, margin, doc.lastAutoTable.finalY + 8);
      }

      // PAGE 4: Staff Activity SA
      doc.addPage();
      drawHeader('Laporan Kinerja Keaktifan Staff (Service Advisor)');

      const saRows = Object.entries(execStaffActivityData.saMonthly).map(([name, counts]) => {
        const row = [name];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = counts[mIdx] || 0;
          row.push(String(val));
          total += val;
        });
        row.push(String(total));
        return row;
      }).sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]));

      autoTable(doc, {
        startY: 28,
        head: [['Nama Service Advisor', ...activeMonths, 'Total WO']],
        body: saRows,
        theme: 'striped',
        headStyles: { fillColor: [24, 24, 27], fontSize: 7.5, halign: 'center' },
        bodyStyles: { fontSize: 7.5, halign: 'center' },
        margin: { left: margin, right: margin }
      });

      // PAGE 5: Mechanic Activity
      doc.addPage();
      drawHeader('Laporan Kinerja Keaktifan Staff (Mekanik)');

      const mechRows = Object.entries(execStaffActivityData.mechMonthly).map(([name, counts]) => {
        const row = [name];
        let total = 0;
        activeMonths.forEach((_, mIdx) => {
          const val = counts[mIdx] || 0;
          row.push(String(val));
          total += val;
        });
        row.push(String(total));
        return row;
      }).sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]));

      autoTable(doc, {
        startY: 28,
        head: [['Nama Mekanik', ...activeMonths, 'Total WO']],
        body: mechRows,
        theme: 'striped',
        headStyles: { fillColor: [24, 24, 27], fontSize: 7.5, halign: 'center' },
        bodyStyles: { fontSize: 7.5, halign: 'center' },
        margin: { left: margin, right: margin }
      });

      // PAGE 6: CSI Result Dashboard
      doc.addPage();
      const drawCsiHeader = () => {
        doc.setFillColor(24, 24, 27);
        doc.rect(0, 0, pageW, 26, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('CSI RESULT & ANALITIK', margin, 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(199, 210, 254);
        doc.text(`ORIENTAL SM RAJA AMPLAS  •  ${activeMonths[limitMonthIdx]} ${selectedYear}`, margin, 18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text(`${activeCsiSummary.csiScore} pts`, pageW - margin, 11, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(161, 161, 170);
        doc.text('CSI Score • Skala 0 - 1000', pageW - margin, 17, { align: 'right' });
        doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`, pageW - margin, 22, { align: 'right' });
      };
      drawCsiHeader();

      const drawCard = (cx, cy, cw, ch) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(228, 228, 231);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, cy, cw, ch, 2.5, 2.5, 'FD');
      };

      const avgDim = activeCsiSummary.dimensions.length > 0
        ? Math.round(activeCsiSummary.dimensions.reduce((a, d) => a + d.value, 0) / activeCsiSummary.dimensions.length)
        : 0;

      // 3 stat cards
      const stripY = 34;
      const stripH = 22;
      const boxGap = 5;
      const boxW = (contentW - boxGap * 2) / 3;
      const statBoxes = [
        { label: 'CSI Score', value: activeCsiSummary.csiScore, suffix: 'pts', sub: 'Target 1000 pts', fill: [238, 242, 255], border: [199, 210, 254], text: [67, 56, 202] },
        { label: 'Total Responden', value: activeCsiSummary.totalSample, suffix: '', sub: `Ulasan ${activeMonths[limitMonthIdx]}`, fill: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
        { label: 'Rata-rata Dimensi', value: avgDim, suffix: 'pts', sub: '7 dimensi penilaian', fill: [255, 251, 235], border: [253, 230, 138], text: [180, 83, 9] },
      ];
      statBoxes.forEach((b, i) => {
        const bx = margin + i * (boxW + boxGap);
        doc.setFillColor(b.fill[0], b.fill[1], b.fill[2]);
        doc.setDrawColor(b.border[0], b.border[1], b.border[2]);
        doc.setLineWidth(0.4);
        doc.roundedRect(bx, stripY, boxW, stripH, 2.5, 2.5, 'FD');
        doc.setTextColor(113, 113, 122);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(b.label.toUpperCase(), bx + 7, stripY + 8);
        doc.setTextColor(b.text[0], b.text[1], b.text[2]);
        doc.setFontSize(18);
        doc.text(`${b.value}${b.suffix ? ' ' + b.suffix : ''}`, bx + 7, stripY + 18);
        doc.setTextColor(113, 113, 122);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(b.sub, bx + 7, stripY + stripH - 2.5);
      });

      // 2 column layout
      const colGap = 10;
      const leftX = margin;
      const leftW = 112;
      const rightX = leftX + leftW + colGap;
      const rightW = contentW - leftW - colGap;
      let y = stripY + stripH + 8;

      // Kiri atas: Gauge
      const heroH = 50;
      drawCard(leftX, y, leftW, heroH);
      doc.setTextColor(113, 113, 122);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('CSI SCORE BULANAN', leftX + 8, y + 9);
      if (gaugeImg) {
        addImageFitted(doc, gaugeImg, leftW - 20, 39, leftX + 10, y + 10);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(161, 161, 170);
        doc.text('Tidak ada data bulan ini', leftX + 8, y + 25);
      }
      y += heroH + 6;

      // Kiri bawah: Dimensions Table
      const dimH = 196 - y;
      drawCard(leftX, y, leftW, dimH);
      doc.setTextColor(113, 113, 122);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('PENCAPAIAN DIMENSI (POIN)', leftX + 8, y + 8);
      autoTable(doc, {
        startY: y + 12,
        head: [['No', 'Dimensi', 'Poin', '%']],
        body: activeCsiSummary.dimensions.map((d, i) => [
          String(i + 1),
          d.name,
          String(d.value),
          `${Math.round((d.value / 1000) * 100)}%`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], fontSize: 6.5, halign: 'center' },
        bodyStyles: { fontSize: 6.4, cellPadding: 1.1 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: leftX + 8, right: pageW - (leftX + leftW - 8) },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 60, fontStyle: 'bold' },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const v = Number(data.cell.raw);
            data.cell.styles.textColor = v >= 800 ? [22, 101, 52] : v >= 700 ? [133, 77, 14] : [185, 28, 28];
          }
        },
      });

      // Kanan atas: Trend Line Chart
      const trendH = 50;
      drawCard(rightX, 64, rightW, trendH);
      doc.setTextColor(99, 102, 241);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('GRAFIK TREN CSI TAHUNAN', rightX + 8, 72);
      if (chart4) {
        addImageFitted(doc, chart4, rightW - 16, trendH - 12, rightX + 8, 74);
      }

      // Kanan bawah: Bar Chart
      const barTop = 64 + trendH + 6;
      const barH = 196 - barTop;
      drawCard(rightX, barTop, rightW, barH);
      doc.setTextColor(99, 102, 241);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('GRAFIK DIMENSI BULANAN', rightX + 8, barTop + 9);
      if (barImg) {
        addImageFitted(doc, barImg, rightW - 16, barH - 14, rightX + 8, barTop + 11);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(161, 161, 170);
        doc.text('Tidak ada data bulan ini', rightX + 8, barTop + 35);
      }

      // PAGE 7: Skor Responden Table
      if (csiActiveMonthRecords && csiActiveMonthRecords.recordIDs && csiActiveMonthRecords.recordIDs.length > 0) {
        const recordMap = csiActiveMonthRecords.recordMap || {};
        const recordIDs = csiActiveMonthRecords.recordIDs || [];

        const activeRespondents = recordIDs.map(id => {
          const r = recordMap[id];
          if (!r) return null;
          return {
            name: r.fldLOfP6ht?.value?.[0]?.text || '-',
            product: PRODUCT_OPTIONS[r.flduCHkcFO?.value] || r.flduCHkcFO?.value || '-',
            q1: r.fld77RDhPZ?.value || 0,
            q2: r.fldGneeuoD?.value || 0,
            q3: r.fldpOMkOr5?.value || 0,
            q4: r.fldqBAJgeU?.value || 0,
            q5: r.fldvf2MIJv?.value || 0,
            q6: r.fldA6l5y5x?.value || 0,
            q7: r.fldlvE1YfV?.value || 0,
            overall: r.fldKw5T576?.value?.val || r.fldKw5T576?.value || 0,
            recommend: r.fldYktqdva?.value || 0,
            comments: r.fldIfJu5jY?.value?.map(c => c.text).join('\n') || r.fldIfJu5jY?.value || '',
            commentsQ8: r.fld4gEPGVF?.value?.map(c => c.text).join('\n') || r.fld4gEPGVF?.value || '',
          };
        }).filter(Boolean);

        doc.addPage();
        doc.setFillColor(24, 24, 27);
        doc.rect(0, 0, pageW, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`Skor Komputasi Responden (${activeMonths[limitMonthIdx]} ${selectedYear})`, margin, 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(199, 210, 254);
        doc.text('ORIENTAL SM RAJA AMPLAS', margin, 16);

        autoTable(doc, {
          startY: 22,
          head: [['No', 'Nama', 'Produk', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Overall', 'Rekom']],
          body: activeRespondents.map((r, i) => [
            String(i + 1), r.name, r.product, r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.overall, r.recommend
          ]),
          theme: 'striped',
          headStyles: { fillColor: [24, 24, 27], fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { halign: 'left', cellWidth: 50 },
            2: { halign: 'left' },
            10: { fontStyle: 'bold', fillColor: [236, 253, 245] },
            11: { fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 11) {
              const v = Number(data.cell.raw);
              data.cell.styles.textColor = v >= 8 ? [22, 101, 52] : v >= 6 ? [133, 77, 14] : [185, 28, 28];
            }
          },
        });

        // PAGE 8: Ulasan / Comments
        const commentRows = activeRespondents
          .filter(r => r.comments || r.commentsQ8)
          .map(r => [r.name, r.comments || '-', r.commentsQ8 || '-']);
        if (commentRows.length > 0) {
          doc.addPage();
          doc.setFillColor(24, 24, 27);
          doc.rect(0, 0, pageW, 18, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(`Ulasan & Komentar Responden (${activeMonths[limitMonthIdx]} ${selectedYear})`, margin, 11);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(199, 210, 254);
          doc.text('ORIENTAL SM RAJA AMPLAS', margin, 16);

          autoTable(doc, {
            startY: 22,
            head: [['Nama', 'Aspek Ragu Rekomendasi (Q7)', 'Masukan & Komentar Akhir (Q8)']],
            body: commentRows,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], fontSize: 7.5 },
            bodyStyles: { fontSize: 7.5 },
            margin: { left: margin, right: margin },
            columnStyles: {
              0: { cellWidth: 45, fontStyle: 'bold' },
              1: { cellWidth: 110 },
              2: { cellWidth: 110 },
            },
          });
        }
      }

      doc.save(`Laporan_Eksekutif_Manager_${selectedYear}.pdf`);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Eksekutif PDF!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      console.error(e);
      Toastify({ text: `❌ Gagal Ekspor PDF: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

  const handleExportExecutiveExcel = () => {
    if (!XLSX) {
      Toastify({ text: '⚠️ Excel library is loading...', style: { background: '#f59e0b' } }).showToast();
      return;
    }
    Toastify({
      text: "⏳ Menyiapkan laporan Excel eksekutif...",
      duration: 3000,
      style: { background: '#10b981', borderRadius: '12px' },
    }).showToast();

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Unit Entry
      const ueRows = [];
      const types = ['IFS', 'IKC', 'EUR', 'IOB'];
      types.forEach(t => {
        const rWo = { 'Tipe / Segment': `${t} (Work Order)` };
        activeMonths.forEach((m, mIdx) => {
          rWo[m] = execUnitEntryData.months[mIdx]?.[`wo${t}`] || 0;
        });
        rWo['Total YTD'] = execUnitEntryData.ytdTotals[`wo${t}`] || 0;
        ueRows.push(rWo);

        const rUe = { 'Tipe / Segment': `${t} (Unit Entry)` };
        activeMonths.forEach((m, mIdx) => {
          rUe[m] = execUnitEntryData.months[mIdx]?.[`unique${t}`] || 0;
        });
        rUe['Total YTD'] = execUnitEntryData.ytdTotals[`unique${t}`] || 0;
        ueRows.push(rUe);
      });

      const totalWo = { 'Tipe / Segment': 'Total (Work Order)' };
      activeMonths.forEach((m, mIdx) => {
        totalWo[m] = execUnitEntryData.months[mIdx]?.woTotal || 0;
      });
      totalWo['Total YTD'] = execUnitEntryData.ytdTotals.woTotal || 0;
      ueRows.push(totalWo);

      const totalUe = { 'Tipe / Segment': 'Total (Unit Entry)' };
      activeMonths.forEach((m, mIdx) => {
        totalUe[m] = execUnitEntryData.months[mIdx]?.uniqueTotal || 0;
      });
      totalUe['Total YTD'] = execUnitEntryData.ytdTotals.uniqueTotal || 0;
      ueRows.push(totalUe);

      const ws1 = XLSX.utils.json_to_sheet(ueRows);
      XLSX.utils.book_append_sheet(workbook, ws1, "Unit Entry");

      // Sheet 2: Labor Charge
      const lcRows = [];
      types.forEach(t => {
        const r = { 'Tipe / Segment': t };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = execLaborChargeData[mIdx]?.[t] || 0;
          r[m] = val;
          total += val;
        });
        r['Total YTD'] = total;
        lcRows.push(r);
      });
      const lcTotal = { 'Tipe / Segment': 'Total' };
      let lcGrand = 0;
      activeMonths.forEach((m, mIdx) => {
        const sum = types.reduce((acc, t) => acc + (execLaborChargeData[mIdx]?.[t] || 0), 0);
        lcTotal[m] = sum;
        lcGrand += sum;
      });
      lcTotal['Total YTD'] = lcGrand;
      lcRows.push(lcTotal);
      const ws2 = XLSX.utils.json_to_sheet(lcRows);
      XLSX.utils.book_append_sheet(workbook, ws2, "Keuntungan Jasa");

      // Sheet 2b: Sub Order (SO)
      const soRows = [];
      types.forEach(t => {
        const r = { 'Tipe / Segment': t };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = execSubOrderData[mIdx]?.[t] || 0;
          r[m] = val;
          total += val;
        });
        r['Total YTD'] = total;
        soRows.push(r);
      });
      const soTotal = { 'Tipe / Segment': 'Total' };
      let soGrand = 0;
      activeMonths.forEach((m, mIdx) => {
        const sum = types.reduce((acc, t) => acc + (execSubOrderData[mIdx]?.[t] || 0), 0);
        soTotal[m] = sum;
        soGrand += sum;
      });
      soTotal['Total YTD'] = soGrand;
      soRows.push(soTotal);
      const ws2b = XLSX.utils.json_to_sheet(soRows);
      XLSX.utils.book_append_sheet(workbook, ws2b, "Keuntungan Sub Order (SO)");

      // Sheet 3a: Sparepart Workshop
      const spWorkRows = [];
      const spWorkSegs = [
        { label: 'RS0001 (Service)', key: 'RS0001' },
        { label: '114-I (Asuransi)', key: '114-I' },
        { label: 'INT-112 (Internal)', key: 'INT-112' }
      ];
      spWorkSegs.forEach(s => {
        const r = { 'Segmen Sparepart Workshop': s.label };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = execSparepartWorkshopData[mIdx]?.[s.key] || 0;
          r[m] = val;
          total += val;
        });
        r['Total YTD'] = total;
        spWorkRows.push(r);
      });
      const spWorkTotal = { 'Segmen Sparepart Workshop': 'Total' };
      let spWorkGrand = 0;
      activeMonths.forEach((m, mIdx) => {
        const sum = spWorkSegs.reduce((acc, s) => acc + (execSparepartWorkshopData[mIdx]?.[s.key] || 0), 0);
        spWorkTotal[m] = sum;
        spWorkGrand += sum;
      });
      spWorkTotal['Total YTD'] = spWorkGrand;
      spWorkRows.push(spWorkTotal);
      const ws3_1 = XLSX.utils.json_to_sheet(spWorkRows);
      XLSX.utils.book_append_sheet(workbook, ws3_1, "Sparepart Workshop");

      // Sheet 3b: Sparepart Non-Workshop
      const spNonWorkRows = [];
      const spNonWorkSegs = [
        { label: 'Retail', key: 'retail' },
        { label: 'Partshop', key: 'partshop' }
      ];
      spNonWorkSegs.forEach(s => {
        const r = { 'Segmen Sparepart Non Workshop': s.label };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = execSparepartNonWorkshopData[mIdx]?.[s.key] || 0;
          r[m] = val;
          total += val;
        });
        r['Total YTD'] = total;
        spNonWorkRows.push(r);
      });
      const spNonWorkTotal = { 'Segmen Sparepart Non Workshop': 'Total' };
      let spNonWorkGrand = 0;
      activeMonths.forEach((m, mIdx) => {
        const sum = spNonWorkSegs.reduce((acc, s) => acc + (execSparepartNonWorkshopData[mIdx]?.[s.key] || 0), 0);
        spNonWorkTotal[m] = sum;
        spNonWorkGrand += sum;
      });
      spNonWorkTotal['Total YTD'] = spNonWorkGrand;
      spNonWorkRows.push(spNonWorkTotal);
      const ws3_2 = XLSX.utils.json_to_sheet(spNonWorkRows);
      XLSX.utils.book_append_sheet(workbook, ws3_2, "Sparepart Non Workshop");

      // Sheet 4: Staff Activity
      const staffRows = [];
      staffRows.push({ 'Jabatan': '--- SERVICE ADVISOR ---' });
      Object.entries(execStaffActivityData.saMonthly).forEach(([name, counts]) => {
        const r = { 'Nama Karyawan': name, 'Jabatan': 'Service Advisor' };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = counts[mIdx] || 0;
          r[m] = val;
          total += val;
        });
        r['Total WO YTD'] = total;
        staffRows.push(r);
      });
      staffRows.push({ 'Jabatan': '--- MEKANIK ---' });
      Object.entries(execStaffActivityData.mechMonthly).forEach(([name, counts]) => {
        const r = { 'Nama Karyawan': name, 'Jabatan': 'Mekanik' };
        let total = 0;
        activeMonths.forEach((m, mIdx) => {
          const val = counts[mIdx] || 0;
          r[m] = val;
          total += val;
        });
        r['Total WO YTD'] = total;
        staffRows.push(r);
      });
      const ws4 = XLSX.utils.json_to_sheet(staffRows);
      XLSX.utils.book_append_sheet(workbook, ws4, "Keaktifan Staff");

      // Sheet 5: CSI Result
      const csiRows = [];
      const csiRow = { 'Indikator': 'CSI Score' };
      activeMonths.forEach((m, mIdx) => {
        csiRow[m] = execCsiData[mIdx] || 0;
      });
      const activeScores = execCsiData.filter(v => v > 0);
      csiRow['Average YTD'] = activeScores.length > 0 ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length) : 0;
      csiRows.push(csiRow);

      // Append dimension breakdown if available
      if (csiMonthlyData && csiMonthlyData.length > 0) {
        const activeMonthData = csiMonthlyData[limitMonthIdx];
        if (activeMonthData && activeMonthData.dimensions) {
          activeMonthData.dimensions.forEach(d => {
            const dimRow = { 'Indikator': `Dimensi: ${d.name}` };
            activeMonths.forEach((m, mIdx) => {
              dimRow[m] = mIdx === limitMonthIdx ? d.value : '';
            });
            dimRow['Average YTD'] = d.value;
            csiRows.push(dimRow);
          });
        }
      }

      const ws5 = XLSX.utils.json_to_sheet(csiRows);
      XLSX.utils.book_append_sheet(workbook, ws5, "CSI Result");

      // Sheet 6: CSI Responden Detail (jika ada data)
      if (csiActiveMonthRecords && csiActiveMonthRecords.recordIDs && csiActiveMonthRecords.recordIDs.length > 0) {
        const recordMap = csiActiveMonthRecords.recordMap || {};
        const recordIDs = csiActiveMonthRecords.recordIDs || [];

        const respRows = recordIDs.map((id, i) => {
          const r = recordMap[id];
          if (!r) return null;
          return {
            'No': i + 1,
            'Nama': r.fldLOfP6ht?.value?.[0]?.text || '-',
            'Produk': PRODUCT_OPTIONS[r.flduCHkcFO?.value] || r.flduCHkcFO?.value || '-',
            'VIN': r.fldBbJb9CA?.value?.val?.[0]?.text || r.fldBbJb9CA?.value?.[0]?.text || '-',
            'Q1 (Appointment)': r.fld77RDhPZ?.value || 0,
            'Q2 (Advisor)': r.fldGneeuoD?.value || 0,
            'Q3 (Facility)': r.fldpOMkOr5?.value || 0,
            'Q4 (Quality)': r.fldqBAJgeU?.value || 0,
            'Q5 (Maintenance)': r.fldvf2MIJv?.value || 0,
            'Q6 (Delivery)': r.fldA6l5y5x?.value || 0,
            'Q7 (Parts)': r.fldlvE1YfV?.value || 0,
            'Overall Score': r.fldKw5T576?.value?.val || r.fldKw5T576?.value || 0,
            'Rekomendasi (0-10)': r.fldYktqdva?.value || 0,
            'Komentar Masukan': r.fldIfJu5jY?.value?.map(c => c.text).join('\n') || r.fldIfJu5jY?.value || '',
            'Komentar Akhir': r.fld4gEPGVF?.value?.map(c => c.text).join('\n') || r.fld4gEPGVF?.value || '',
          };
        }).filter(Boolean);

        if (respRows.length > 0) {
          const ws6 = XLSX.utils.json_to_sheet(respRows);
          ws6['!cols'] = [
            { wch: 5 }, { wch: 28 }, { wch: 24 }, { wch: 22 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 18 }, { wch: 40 }, { wch: 40 }
          ];
          XLSX.utils.book_append_sheet(workbook, ws6, "CSI Detail Responden");
        }
      }

      XLSX.writeFile(workbook, `Laporan_Eksekutif_Manager_${selectedYear}.xlsx`);
      Toastify({ text: '✅ Berhasil mengekspor Laporan Eksekutif Excel!', style: { background: '#10b981' } }).showToast();
    } catch (e) {
      console.error(e);
      Toastify({ text: `❌ Gagal Ekspor Excel: ${e.message}`, style: { background: 'red' } }).showToast();
    }
  };

    const handleExportSummary = async () => {
        setIsSyncing(true);
        if (!XLSX) {
            Toastify({ text: '⚠️ Excel library is loading...', style: { background: '#f59e0b' } }).showToast();
            setIsSyncing(false);
            return;
        }

        try {
            const workbook = XLSX.utils.book_new();

            // ── SHEET 1: REVENUE BY TYPE ──────────────────────────────────────────
            const revenueByType = [];
            const typeMap = {}; // { prefix: { month: { jasa, part } } }
            
            financialData.forEach(item => {
                const date = new Date(item.wkt_masuk);
                if (isNaN(date.getTime())) return;
                const month = date.getMonth() + 1;
                const prefix = (item.no_wo || 'UNT').substring(0, 3).toUpperCase();
                
                if (!typeMap[prefix]) typeMap[prefix] = {};
                if (!typeMap[prefix][month]) typeMap[prefix][month] = { jasa: 0, part: 0 };
                
                typeMap[prefix][month].jasa += (item.jasa || 0);
                typeMap[prefix][month].part += (item.s_part || 0);
            });

            Object.keys(typeMap).sort().forEach(prefix => {
                for (let m = 1; m <= 12; m++) {
                    const data = typeMap[prefix][m];
                    if (data) {
                        revenueByType.push({
                            'TIPE WO': prefix,
                            'BULAN': m,
                            'TOTAL JASA': data.jasa,
                            'TOTAL SPAREPART': data.part,
                            'GRAND TOTAL': data.jasa + data.part
                        });
                    }
                }
            });
            const ws1 = XLSX.utils.json_to_sheet(revenueByType);
            XLSX.utils.book_append_sheet(workbook, ws1, "Revenue per Tipe");

            // ── SHEET 2: STAFF PERFORMANCE (JASA ONLY) ─────────────────────────────
            const staffPerf = [];
            const staffMap = {}; // { name: { role, [month]: totalJasa } }

            financialData.forEach(item => {
                const date = new Date(item.wkt_masuk);
                if (isNaN(date.getTime())) return;
                const month = date.getMonth() + 1;
                
                const processStaff = (name, role) => {
                    if (!name || name === '---') return;
                    const key = `${name}_${role}`;
                    if (!staffMap[key]) {
                        staffMap[key] = { name, role };
                        for (let i = 1; i <= 12; i++) staffMap[key][i] = 0;
                    }
                    staffMap[key][month] += (item.jasa || 0);
                };

                processStaff(item.sa, 'SERVICE ADVISOR');
                processStaff(item.mekanik, 'MEKANIK');
            });

            Object.values(staffMap).forEach(s => {
                let annualTotal = 0;
                const row = { 'NAMA KARYAWAN': s.name, 'JABATAN': s.role };
                for (let m = 1; m <= 12; m++) {
                    row[`BLN ${m}`] = s[m];
                    annualTotal += s[m];
                }
                row['TOTAL TAHUNAN'] = annualTotal;
                staffPerf.push(row);
            });
            const ws2 = XLSX.utils.json_to_sheet(staffPerf);
            XLSX.utils.book_append_sheet(workbook, ws2, "Performa Karyawan");

            // ── SHEET 3: WO TRACKING STATUS ───────────────────────────────────────
            const woTracking = [];
            const trackMap = {}; // { prefix_status: { [month]: count } }

            woTrackingData.forEach(item => {
                const wkt = item.wkt_masuk;
                const date = new Date(wkt);
                if (isNaN(date.getTime())) return;
                const month = date.getMonth() + 1;
                const prefix = (item.no_wo || 'UNT').substring(0, 3).toUpperCase();
                const status = (item.status || 'OPEN').toUpperCase();
                
                const key = `${prefix}|${status}`;
                if (!trackMap[key]) {
                    trackMap[key] = { prefix, status };
                    for (let i = 1; i <= 12; i++) trackMap[key][i] = 0;
                }
                trackMap[key][month]++;
            });

            Object.values(trackMap).forEach(t => {
                let annualTotal = 0;
                const row = { 'TIPE WO': t.prefix, 'STATUS AKHIR': t.status };
                for (let m = 1; m <= 12; m++) {
                    row[`BLN ${m}`] = t[m];
                    annualTotal += t[m];
                }
                row['TOTAL UNIT'] = annualTotal;
                woTracking.push(row);
            });
            const ws3 = XLSX.utils.json_to_sheet(woTracking);
            XLSX.utils.book_append_sheet(workbook, ws3, "Tracking Status WO");

            // ── SHEET 4: VEHICLE DATABASE FREQUENCY ────────────────────────────────
            const vehicleFreq = [];
            const vehMap = {}; // { tipe: { [month]: count } }

            // Gunakan rawHistory (Antrian) untuk Database Mobil (Group by Tipe)
            rawHistory.forEach(item => {
                const date = new Date(parseInt(item.id) || item.id);
                if (isNaN(date.getTime())) return;
                const month = date.getMonth() + 1;
                const tipe = (item.tipe || 'UNKNOWN').toUpperCase();
                
                if (!vehMap[tipe]) {
                    vehMap[tipe] = {};
                    for (let i = 1; i <= 12; i++) vehMap[tipe][i] = 0;
                }
                vehMap[tipe][month]++;
            });

            Object.entries(vehMap).forEach(([tipe, d]) => {
                let annualTotal = 0;
                const row = { 'MODEL KENDARAAN': tipe };
                for (let m = 1; m <= 12; m++) {
                    row[`BLN ${m}`] = d[m];
                    annualTotal += d[m];
                }
                row['TOTAL KUNJUNGAN'] = annualTotal;
                vehicleFreq.push(row);
            });
            const ws4 = XLSX.utils.json_to_sheet(vehicleFreq);
            XLSX.utils.book_append_sheet(workbook, ws4, "Popularitas Mobil");

            // DOWNLOAD
            const fileName = `Rangkuman_Audit_Workshop_${new Date().getFullYear()}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            Toastify({ text: '✅ Berhasil Mengekspor Audit Multipage!', style: { background: '#10b981' } }).showToast();
        } catch (e) {
            console.error(e);
            Toastify({ text: `❌ Gagal Ekspor: ${e.message}`, style: { background: 'red' } }).showToast();
        } finally {
            setIsSyncing(false);
        }
    };

  const handleWorkshopUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const isRevenue = e.target.id === 'import-revenue-btn';
        const formattedData = data.map(row => {
          const mapped = {};
          // Mapping khusus untuk Revenue berdasarkan format user
          if (isRevenue) {
            // Kita cari key yang mengandung kata tertentu karena user bisa saja mengunggah dengan spasi/huruf besar berbeda
            const findVal = (keywords) => {
              const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
              return key ? row[key] : null;
            };

            mapped.no_wo = findVal(['No. Invoice', 'No Invoice']) || findVal(['Invoice']);
            mapped.wkt_masuk = normalizeDateStr(findVal(['Tgl Invoice', 'Tanggal Invoice', 'Tgl Masuk']));
            mapped.bk = findVal(['No. Pol', 'No Pol', 'Plat']);
            mapped.tipe_kendaraan = findVal(['Type', 'Tipe']);

            // Kolom Keuangan
            const lc = Number(String(findVal(['LC stlh disc', 'LC', 'Jasa']) || 0).replace(/[^\d]/g, ''));
            const part = Number(String(findVal(['S. Part', 'Part', 'Sparepart']) || 0).replace(/[^\d]/g, ''));
            const oli = Number(String(findVal(['Oli']) || 0).replace(/[^\d]/g, ''));
            const sm = Number(String(findVal(['SM']) || 0).replace(/[^\d]/g, ''));
            const so = Number(String(findVal(['SO']) || 0).replace(/[^\d]/g, ''));
            const ppn = Number(String(findVal(['PPN']) || 0).replace(/[^\d]/g, ''));
            const total = Number(String(findVal(['TOTAL', 'Grand Total']) || 0).replace(/[^\d]/g, ''));

            mapped.jasa = lc;
            mapped.s_part = part + oli + sm + so; // Gabungan part, oli, sm, so
            mapped.ppn = ppn;
            mapped.g_total = total || (mapped.jasa + mapped.s_part + mapped.ppn);

            // Gunakan exactly kolom 'Front' untuk nilai SA sesuai permintaan user
            const frontVal = findVal(['Front']);
            mapped.sa = frontVal || findVal(['SA', 'Advisor', 'Service Advisor']);
            mapped.leader = findVal(['Ldr', 'Leader', 'LNN']);
            mapped.mekanik = findVal(['Mkn', 'Mekanik']);
            mapped.nohp = findVal(['No. Telp/HP', 'No Telp', 'HP', 'Telepon']);
          } else {
            // Mapping untuk WO Tracking: Kita simpan original keys agar match dengan db schema nanti
            // dan juga simpan versi normalized untuk kemudahan pencarian
            Object.keys(row).forEach(k => {
              let val = row[k];
              mapped[k] = val; // Original key

              const lowKey = k.toLowerCase();
              if (lowKey.includes('wkt') || lowKey.includes('date') || lowKey.includes('tanggal')) {
                mapped[k] = normalizeDateStr(val);
              }
            });

            // Agar r['No. WO'] atau r['No. WO DMS'] dsb tetap bisa diakses meskipun file excel
            // memiliki variasi kecil seperti huruf besar/kecil atau spasi ekstra
            const findCol = (keywords) => {
              const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().trim().includes(kw.toLowerCase())));
              return key ? row[key] : null;
            };

            // Tambahkan key standar ke mapped object agar logic di bawahnya lebih konsisten
            mapped['No. WO'] = findCol(['No. WO', 'No WO', 'Nomor WO']);
          }
          return mapped;
        });

        // ── Deduplication ──────────────────────────────────────────────────
        // Hapus baris yang no_wo-nya kosong/null
        const filteredData = formattedData.filter(r => {
          const key = isRevenue ? r.no_wo : r['No. WO'];
          return key && String(key).trim() !== '';
        });

        // Hapus duplikat dalam file yang diupload (ambil baris terakhir per key)
        const dedupeMap = new Map();
        filteredData.forEach(r => {
          const key = isRevenue ? r.no_wo : r['No. WO'];
          dedupeMap.set(String(key).trim(), r);
        });
        const uniqueData = Array.from(dedupeMap.values());

        if (uniqueData.length === 0) {
          Toastify({ text: '⚠️ Tidak ada data valid untuk diimport. Pastikan kolom No. WO/Invoice tidak kosong.', style: { background: '#f97316' }, duration: 5000 }).showToast();
          setIsLoading(false);
          return;
        }

        // ── Simpan ke Supabase ──────────────────────────────────────────────
        const targetTable = isRevenue ? 'revenue' : 'laporanwo';
        // Penting: Jika nama kolom mengandung titik (.), harus diapit tanda kutip ganda "" 
        // agar PostgREST tidak salah mengira itu adalah pemanggilan fungsi (seperti sum, avg, dll)
        const idField = isRevenue ? 'no_wo' : '"No. WO"';

        // ── Check Existing Data for De-duplication ───────────────────────────
        const { data: existingRecords, error: fetchError } = await db.select(targetTable, { select: idField });

        if (fetchError) {
          console.error('Fetch error:', fetchError);
          Toastify({ text: '⚠️ Gagal memverifikasi data existing.', style: { background: '#ef4444' } }).showToast();
          setIsLoading(false);
          return;
        }

        const existingSet = new Set(existingRecords.map(r => {
          // r[idField] tidak bekerja jika idField berisi kutipan, kita ambil key aslinya
          const key = isRevenue ? r.no_wo : r['No. WO'];
          return String(key || '').trim();
        }));
        const toInsert = [];
        let duplicateCount = 0;
        let errorCount = 0;

        uniqueData.forEach(r => {
          const key = isRevenue ? r.no_wo : r['No. WO'];
          const keyStr = String(key).trim();

          // 1. Skip Duplicates
          if (existingSet.has(keyStr)) {
            duplicateCount++;
            return;
          }

          // 2. Data Validation & Sanitization (Skip Errors)
          try {
            if (isRevenue) {
              toInsert.push({
                no_wo: keyStr,
                tipe_kendaraan: r.tipe_kendaraan || null,
                sa: r.sa || null,
                mekanik: r.mekanik || null,
                leader: r.leader || null,
                wkt_masuk: r.wkt_masuk ? r.wkt_masuk.split('T')[0] : null,
                jasa: Number(r.jasa) || 0,
                s_part: Number(r.s_part) || 0,
                g_total: Number(r.g_total) || 0,
                nohp: r.nohp || null,
              });
            } else {
              // Helper untuk mendapatkan nilai dari object r dengan toleransi variasi nama kolom
              const gv = (keywords, defaultVal = null) => {
                const ky = Object.keys(r).find(k => keywords.some(kw => String(k).toLowerCase().includes(kw.toLowerCase())));
                return (ky !== undefined) ? r[ky] : defaultVal;
              };

              toInsert.push({
                'No. WO': keyStr,
                'No. WO DMS': gv(['No. WO DMS', 'No. WO (DMS)', 'No WO DMS']) || null,
                'Status': gv(['Status']) || null,
                'No. Pol': gv(['No. Pol', 'No Pol', 'Plat Nomor']) || null,
                'No. Rangka': gv(['No. Rangka', 'No Rangka', 'VIN']) || null,
                'Kode Tipe': gv(['Kode Tipe', 'Kode Type']) || null,
                'Kendaraan': gv(['Kendaraan', 'Tipe Kendaraan', 'Model']) || null,
                'Nama Invoice': gv(['Nama Invoice', 'Customer']) || null,
                'Pembawa': gv(['Pembawa', 'Front']) || null,
                'KM Masuk': gv(['KM Masuk', 'Kilometer']) ? Number(gv(['KM Masuk', 'Kilometer'])) : null,
                'Wkt.Masuk': gv(['Wkt.Masuk', 'Tanggal Masuk']) || null,
                'Wkt.Estimasi': gv(['Wkt.Estimasi']) || null,
                'Wkt.Setuju Estimasi': gv(['Wkt.Setuju Estimasi']) || null,
                'Wkt.Mulai': gv(['Wkt.Mulai']) || null,
                'Wkt.Selesai': gv(['Wkt.Selesai']) || null,
                'Wkt.Tutup': gv(['Wkt.Tutup']) || null,
                'SA': gv(['Front']) || gv(['SA', 'Advisor']) || null,
                'Mekanik': gv(['Mekanik', 'Mkn']) || null,
                'Leader': gv(['Leader', 'Ldr']) || null,
                'LC': gv(['LC', 'Jasa']) || null,
                'Oli': gv(['Oli']) || null,
                'SM': gv(['SM']) || null,
                'SO': gv(['SO']) || null,
                'Penjualan': gv(['Penjualan']) || null,
                'S. Part': gv(['S. Part', 'Sparepart']) || null,
                'TOTAL': gv(['TOTAL']) || null,
                'PPN': gv(['PPN']) || null,
                'G.TOTAL': gv(['G.TOTAL', 'Grand Total']) || null,
              });
            }
          } catch (e) {
            console.warn('Row error:', e, r);
            errorCount++;
          }
        });

        if (toInsert.length === 0) {
          Toastify({
            text: `ℹ️ Tidak ada data baru untuk diimport. (Skipped: ${duplicateCount} Duplikat, ${errorCount} Error)`,
            style: { background: '#3b82f6' },
            duration: 5000
          }).showToast();
          setIsLoading(false);
          return;
        }

        // ── Simpan ke Supabase ──────────────────────────────────────────────
        const { error: supaError } = await db.insert(targetTable, toInsert);

        if (!supaError) {
          Toastify({
            text: `✅ Import Selesai! Berhasil: ${toInsert.length}, Lewati: ${duplicateCount} Duplikat, ${errorCount} Error.`,
            duration: 6000,
            style: { background: '#10b981' }
          }).showToast();
          isRevenue ? fetchFinancialData() : fetchWoHistory();
        } else {
          console.error('Import error:', supaError);
          let errMsg = supaError.message || 'Unknown error';
          if (supaError.code === '23505') errMsg = '❌ Duplikat: Beberapa baris sudah ada di database.';
          else if (supaError.code === '42703') errMsg = '❌ Kolom tidak ditemukan: Nama kolom Excel mismatch.';
          else if (supaError.code === '23502') errMsg = '❌ Data wajib kosong: Kolom NOT NULL tidak terisi.';
          else if (supaError.code === '22P02') errMsg = '❌ Format data salah: Cek tipe data angka/tanggal.';
          else errMsg = `❌ Import Gagal [${supaError.code}]: ${supaError.message}`;

          Toastify({ text: errMsg, duration: 7000, style: { background: '#ef4444' } }).showToast();
        }
      } catch (err) {
        console.error('Import exception:', err);
        Toastify({ text: `❌ Error tidak terduga: ${err.message}`, duration: 5000, style: { background: '#ef4444' } }).showToast();
      }
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const revenueLeaders = useMemo(() => {
    const saMap = {}, mechMap = {};
    financialData.forEach(item => {
      if (item.sa) {
        if (!saMap[item.sa]) saMap[item.sa] = { totalJasa: 0, count: 0 };
        saMap[item.sa].totalJasa += (item.jasa || 0);
        saMap[item.sa].count += 1;
      }
      if (item.mekanik) {
        if (!mechMap[item.mekanik]) mechMap[item.mekanik] = { totalJasa: 0, count: 0 };
        mechMap[item.mekanik].totalJasa += (item.jasa || 0);
        mechMap[item.mekanik].count += 1;
      }
    });
    return {
      saArr: Object.entries(saMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.totalJasa - a.totalJasa),
      mechArr: Object.entries(mechMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.totalJasa - a.totalJasa)
    };
  }, [financialData]);

  // Navbar visibility logic simplified to hover only in App.jsx

  const tabMeta = {
    performance: { title: '📊 Dashboard Utama', subtitle: 'Ringkasan performa workshop & revenue' },
    financial: { title: '💰 Laporan Revenue', subtitle: 'Audit transaksi & finansial service' },
    wo_tracking: { title: '🔧 Tracking Pengerjaan', subtitle: 'Status pengerjaan workshop realtime' },
    laporan_wo: { title: '📄 Laporan Work Order', subtitle: 'Rincian transaksi pekerjaan & spare part Work Order' },
    work_item_service: { title: '🔧 Jasa Pengerjaan Mobil', subtitle: 'Daftar pekerjaan & labor hour dari DMS' },
    vehicles: { title: '🚗 Database Mobil', subtitle: 'Frekuensi kunjungan kendaraan' },
    cro_history: { title: '📋 Riwayat CRO', subtitle: 'Follow up customer relation' },
    holidays: { title: '🗓️ Libur Dealer', subtitle: 'Pengaturan hari libur dealer' },
    staff: { title: '👥 Manajemen Staff', subtitle: 'Kelola akses user bengkel' },
  };
  const currentTab = tabMeta[activeTab] || tabMeta.performance;

  return (
    <div className="w-full h-full bg-zinc-100 flex flex-col overflow-hidden font-sans antialiased">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Content */}
        <main
          ref={mainRef}
          className={`flex-1 ${activeTab === 'holidays' ? 'overflow-hidden' : 'overflow-y-auto'} p-4 md:p-8 custom-scrollbar space-y-6 pb-[72px] md:pb-8 overflow-x-hidden`}
        >
        {activeTab !== 'performance' && activeTab !== 'staff' && activeTab !== 'laporan_wo' && activeTab !== 'laporan_invoice' && activeTab !== 'manager-laporan-invoice' && activeTab !== 'work_item_service' && activeTab !== 'manager-jasa-pengerjaan' && activeTab !== 'sparepart_profit' && activeTab !== 'manager-keuntungan-sparepart' && activeTab !== 'staff_revenue' && activeTab !== 'manager-keuntungan-staff' && (
          <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                {activeTab === 'financial' ? 'Invoice Pelanggan' : activeTab === 'wo_tracking' ? 'Tracking Pengerjaan' : activeTab === 'vehicles' ? 'Data Kendaraan' : activeTab === 'staff' ? 'Manajemen Staff' : activeTab === 'holidays' ? 'Libur Dealer' : 'Riwayat CRO'}
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-zinc-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {['today', 'this_month', 'year', 'custom', 'all'].map(t => (
                  <button
                    key={t} onClick={() => setTimeFilter(t)}
                    className={`px-3 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[36px] ${timeFilter === t ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'}`}
                  >
                    {t === 'today' ? 'Hari Ini' : t === 'this_month' ? 'Bulan Ini' : t === 'year' ? 'Tahunan' : t === 'custom' ? 'Kustom' : 'Semua'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {timeFilter === 'year' && (
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-zinc-200">
                    <Calendar size={12} className="text-zinc-400" />
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="text-[10px] font-black uppercase outline-none cursor-pointer min-h-[36px]"
                    >
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
                {timeFilter === 'custom' && (
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-zinc-400">DARI:</span>
                      <input type="date" value={customRange.start} onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })} className="text-[10px] font-black outline-none bg-transparent min-h-[36px]" />
                    </div>
                    <div className="w-px h-4 bg-zinc-200"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-zinc-400">KE:</span>
                      <input type="date" value={customRange.end} onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })} className="text-[10px] font-black outline-none bg-transparent min-h-[36px]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Status Indicators */}
        {activeTab !== 'cro_history' && activeTab !== 'staff' && activeTab !== 'booking_mgmt' && activeTab !== 'holidays' && activeTab !== 'vehicles' && activeTab !== 'laporan_wo' && activeTab !== 'laporan_invoice' && activeTab !== 'manager-laporan-invoice' && activeTab !== 'work_item_service' && activeTab !== 'manager-jasa-pengerjaan' && activeTab !== 'sparepart_profit' && activeTab !== 'manager-keuntungan-sparepart' && activeTab !== 'staff_revenue' && activeTab !== 'manager-keuntungan-staff' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {activeTab === 'wo_tracking' ? (
              [
                { l: 'Total WO', v: stats.totalWo, i: Activity, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'WO EUR', v: stats.eurCount, i: ShieldCheck, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'WO IFS', v: stats.ifsCount, i: Star, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'WO IKC', v: stats.ikcCount, i: Zap, c: 'text-black', b: 'bg-zinc-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded-lg p-5">
                  <div className={`w-10 h-10 ${s.b} ${s.c} rounded-md flex items-center justify-center mb-3`}><s.i size={20} strokeWidth={2} /></div>
                  <p className="text-2xl font-black text-zinc-900">{s.v}</p>
                  <p className="text-zinc-500 text-[10px] font-medium mt-1 uppercase tracking-wider">{s.l}</p>
                </div>
              ))
            ) : activeTab === 'performance' ? (
              [
                { l: 'Mobil Selesai', v: stats.selesaiCount, i: CheckCircle, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Proses Pengerjaan', v: stats.workingCount, i: Wrench, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Mobil Menginap', v: stats.overnightCount, i: Shield, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Antrian Tunggu', v: stats.waitingCount, i: Clock, c: 'text-black', b: 'bg-zinc-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded-lg p-5">
                  <div className={`w-10 h-10 ${s.b} ${s.c} rounded-md flex items-center justify-center mb-3`}><s.i size={20} strokeWidth={2} /></div>
                  <p className="text-2xl font-black text-zinc-900">{s.v}</p>
                  <p className="text-zinc-500 text-[10px] font-medium mt-1 uppercase tracking-wider">{s.l}</p>
                </div>
              ))
            ) : (
              [
                { l: 'Total Jasa (Fee)', v: formatCurrency(financialSummary.jasa), i: Wrench, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Total Sparepart', v: formatCurrency(financialSummary.s_part), i: Package, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Grand Total Revenue', v: formatCurrency(financialSummary.grandTotal), i: DollarSign, c: 'text-black', b: 'bg-zinc-50' },
                { l: 'Total WO (Unit)', v: (sortedFinancialData?.length || 0), i: Activity, c: 'text-black', b: 'bg-zinc-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded-lg p-5">
                  <div className={`w-10 h-10 ${s.b} ${s.c} rounded-md flex items-center justify-center mb-3`}><s.i size={20} strokeWidth={2} /></div>
                  <p className="text-2xl font-black text-zinc-900">{s.v}</p>
                  <p className="text-zinc-500 text-[10px] font-medium mt-1 uppercase tracking-wider">{s.l}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dynamic Tab Content */}
        <section className="animate-in">
          {(activeTab === 'laporan_invoice' || activeTab === 'manager-laporan-invoice') && (
            <div className="min-h-[calc(100vh-200px)]">
              <InvoiceReportPage />
            </div>
          )}

          {(activeTab === 'laporan_wo' || activeTab === 'manager-laporan-wo') && (
            <div className="min-h-[calc(100vh-200px)]">
              <WorkOrderReportPage />
            </div>
          )}

          {(activeTab === 'sparepart_profit' || activeTab === 'manager-keuntungan-sparepart') && (
            <div className="min-h-[calc(100vh-200px)]">
              <SparepartRevenuePage />
            </div>
          )}

          {(activeTab === 'work_item_service' || activeTab === 'manager-jasa-pengerjaan') && (
            <div className="min-h-[calc(100vh-200px)]">
              <WorkItemServicePage />
            </div>
          )}

          {(activeTab === 'staff_revenue' || activeTab === 'manager-keuntungan-staff') && (
            <div className="min-h-[calc(100vh-200px)]">
              <StaffRevenuePage />
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="animate-in">
              <HolidaySettings user={user} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Executive Reports Section */}
              <div className="bg-white p-6 border border-zinc-200 rounded-xl shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6 border-b border-zinc-100">
                  <div>
                    <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">📈 Laporan Eksekutif Manager ({selectedYear})</h2>
                    <p className="text-zinc-400 text-xs font-medium mt-1">Analisis YTD pergerakan Januari - {activeMonths[limitMonthIdx]} {selectedYear}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl">
                      <Calendar size={14} className="text-zinc-400" />
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="text-xs font-black outline-none bg-transparent cursor-pointer min-h-[28px]"
                      >
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y} M/Y</option>)}
                      </select>
                    </div>
                    <button
                      onClick={handleExportExecutivePdf}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                    >
                      <Download size={14} /> PDF Landscape
                    </button>
                    <button
                      onClick={handleExportExecutiveExcel}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                    >
                      <FileSpreadsheet size={14} /> Excel
                    </button>
                  </div>
                </div>

                {/* 1. Laporan Unit Entry */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">1. Laporan Unit Entry (Work Order)</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Work Order</span>
                  </div>
                  
                  {/* UE KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-sky-600 uppercase tracking-wider">IFS (Unit Entry)</p>
                      <p className="text-lg font-black text-sky-950 mt-1">{execUnitEntryData.ytdTotals.uniqueIFS} Unit</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">IKC (Unit Entry)</p>
                      <p className="text-lg font-black text-emerald-950 mt-1">{execUnitEntryData.ytdTotals.uniqueIKC} Unit</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">EUR (Unit Entry)</p>
                      <p className="text-lg font-black text-rose-950 mt-1">{execUnitEntryData.ytdTotals.uniqueEUR} Unit</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">IOB (Unit Entry)</p>
                      <p className="text-lg font-black text-amber-950 mt-1">{execUnitEntryData.ytdTotals.uniqueIOB} Unit</p>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">TOTAL UNIT YTD</p>
                      <p className="text-lg font-black text-white mt-1">
                        {execUnitEntryData.ytdTotals.uniqueTotal} Unit
                      </p>
                    </div>
                    <div className="bg-zinc-800 p-3 rounded-lg text-center">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">TOTAL WO YTD</p>
                      <p className="text-lg font-black text-white mt-1">
                        {execUnitEntryData.ytdTotals.woTotal} WO
                      </p>
                    </div>
                  </div>

                  {/* UE Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-unit-entry">
                    <ReactApexChart
                      options={{
                        chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'],
                        stroke: { curve: 'smooth', width: 3 },
                        markers: { size: 4 },
                        dataLabels: {
                          enabled: true,
                          formatter: (val) => val || '',
                          style: { fontSize: '9px', fontWeight: 'bold' }
                        },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700 } } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        legend: { show: true, position: 'top', labels: { colors: '#71717a' }, fontWeight: 700 },
                        tooltip: { theme: 'light' }
                      }}
                      series={[
                        { name: 'IFS', data: execUnitEntryData.months.map(d => d.uniqueIFS) },
                        { name: 'IKC', data: execUnitEntryData.months.map(d => d.uniqueIKC) },
                        { name: 'EUR', data: execUnitEntryData.months.map(d => d.uniqueEUR) },
                        { name: 'IOB', data: execUnitEntryData.months.map(d => d.uniqueIOB) }
                      ]}
                      type="line"
                      height="100%"
                    />
                  </div>

                  {/* UE Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Metrik / Tipe</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-center font-bold">Total YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {(() => {
                          const typeColorConfig = {
                            IFS: {
                              woBg: 'bg-sky-50/40 hover:bg-sky-100/30',
                              woText: 'text-sky-700 font-semibold',
                              woValText: 'text-sky-600',
                              woTotalBg: 'bg-sky-100/40 font-bold text-sky-800',
                              ueBg: 'bg-sky-100/60 hover:bg-sky-200/40',
                              ueText: 'text-sky-900 font-bold pl-6',
                              ueValText: 'text-sky-900 font-bold',
                              ueTotalBg: 'bg-sky-200/70 font-black text-sky-950',
                            },
                            IKC: {
                              woBg: 'bg-emerald-50/40 hover:bg-emerald-100/30',
                              woText: 'text-emerald-700 font-semibold',
                              woValText: 'text-emerald-600',
                              woTotalBg: 'bg-emerald-100/40 font-bold text-emerald-800',
                              ueBg: 'bg-emerald-100/60 hover:bg-emerald-200/40',
                              ueText: 'text-emerald-900 font-bold pl-6',
                              ueValText: 'text-emerald-900 font-bold',
                              ueTotalBg: 'bg-emerald-200/70 font-black text-emerald-950',
                            },
                            EUR: {
                              woBg: 'bg-rose-50/40 hover:bg-rose-100/30',
                              woText: 'text-rose-700 font-semibold',
                              woValText: 'text-rose-600',
                              woTotalBg: 'bg-rose-100/40 font-bold text-rose-800',
                              ueBg: 'bg-rose-100/60 hover:bg-rose-200/40',
                              ueText: 'text-rose-900 font-bold pl-6',
                              ueValText: 'text-rose-900 font-bold',
                              ueTotalBg: 'bg-rose-200/70 font-black text-rose-950',
                            },
                            IOB: {
                              woBg: 'bg-amber-50/40 hover:bg-amber-100/30',
                              woText: 'text-amber-700 font-semibold',
                              woValText: 'text-amber-600',
                              woTotalBg: 'bg-amber-100/40 font-bold text-amber-800',
                              ueBg: 'bg-amber-100/60 hover:bg-amber-200/40',
                              ueText: 'text-amber-900 font-bold pl-6',
                              ueValText: 'text-amber-900 font-bold',
                              ueTotalBg: 'bg-amber-200/70 font-black text-amber-950',
                            }
                          };
                          return ['IFS', 'IKC', 'EUR', 'IOB'].map(t => {
                            const conf = typeColorConfig[t];
                            return (
                              <React.Fragment key={t}>
                                <tr className={conf.woBg}>
                                  <td className={`px-4 py-1.5 ${conf.woText}`}>{t} (Work Order)</td>
                                  {activeMonths.map((_, mIdx) => (
                                    <td key={mIdx} className={`px-2 py-1.5 text-center tabular-nums ${conf.woValText}`}>{execUnitEntryData.months[mIdx]?.[`wo${t}`] || 0}</td>
                                  ))}
                                  <td className={`px-4 py-1.5 text-center font-bold tabular-nums ${conf.woTotalBg}`}>{execUnitEntryData.ytdTotals[`wo${t}`] || 0}</td>
                                </tr>
                                <tr className={conf.ueBg}>
                                  <td className={`px-4 py-1.5 ${conf.ueText}`}>{t} (Unit Entry)</td>
                                  {activeMonths.map((_, mIdx) => (
                                    <td key={mIdx} className={`px-2 py-1.5 text-center tabular-nums ${conf.ueValText}`}>{execUnitEntryData.months[mIdx]?.[`unique${t}`] || 0}</td>
                                  ))}
                                  <td className={`px-4 py-1.5 text-center tabular-nums ${conf.ueTotalBg}`}>{execUnitEntryData.ytdTotals[`unique${t}`] || 0}</td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                         <tr className="bg-indigo-50/70 font-bold border-t border-indigo-100 text-indigo-950">
                          <td className="px-4 py-2">Total (Work Order)</td>
                          {activeMonths.map((_, mIdx) => (
                            <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{execUnitEntryData.months[mIdx]?.woTotal || 0}</td>
                          ))}
                          <td className="px-4 py-2 text-center font-black tabular-nums bg-indigo-100/60">{execUnitEntryData.ytdTotals.woTotal || 0}</td>
                        </tr>
                        <tr className="bg-indigo-100/80 font-black border-t border-indigo-200 text-indigo-950">
                          <td className="px-4 py-2">Total (Unit Entry)</td>
                          {activeMonths.map((_, mIdx) => (
                            <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{execUnitEntryData.months[mIdx]?.uniqueTotal || 0}</td>
                          ))}
                          <td className="px-4 py-2 text-center tabular-nums bg-indigo-200/90">{execUnitEntryData.ytdTotals.uniqueTotal || 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 2. Laporan Keuntungan Labor Charge */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">2. Laporan Keuntungan Labor Charge (Jasa)</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Invoice, IOB</span>
                  </div>

                  {/* LC KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {['IFS', 'IKC', 'EUR', 'IOB'].map(t => {
                      const total = execLaborChargeData.reduce((acc, d) => acc + (d[t] || 0), 0);
                      return (
                        <div key={t} className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-lg">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-center">{t}</p>
                          <p className="text-xs font-black text-zinc-950 mt-1 text-center truncate">{formatCurrency(total)}</p>
                        </div>
                      );
                    })}
                    <div className="bg-zinc-900 p-3 rounded-lg col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider text-center">TOTAL JASA YTD</p>
                      <p className="text-xs font-black text-white mt-1 text-center truncate">
                        {formatCurrency(execLaborChargeData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* LC Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-labor-charge">
                    <ReactApexChart
                      options={{
                        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'],
                        stroke: { curve: 'smooth', width: 2 },
                        markers: { size: 3 },
                        fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
                        dataLabels: {
                          enabled: true,
                          formatter: (val) => {
                            if (!val) return '';
                            return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
                          },
                          style: { fontSize: '8px', fontWeight: 'bold' }
                        },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700 }, formatter: (v) => formatCurrency(v).replace(',00', '') } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        legend: { show: true, position: 'top', labels: { colors: '#71717a' }, fontWeight: 700 },
                        tooltip: { theme: 'light', y: { formatter: (v) => formatCurrency(v) } }
                      }}
                      series={[
                        { name: 'IFS', data: execLaborChargeData.map(d => d.IFS) },
                        { name: 'IKC', data: execLaborChargeData.map(d => d.IKC) },
                        { name: 'EUR', data: execLaborChargeData.map(d => d.EUR) },
                        { name: 'IOB', data: execLaborChargeData.map(d => d.IOB) }
                      ]}
                      type="area"
                      height="100%"
                    />
                  </div>

                  {/* LC Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Tipe/Segment</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-right">Total YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {['IFS', 'IKC', 'EUR', 'IOB'].map(t => {
                          const ytdTotal = execLaborChargeData.reduce((acc, d) => acc + (d[t] || 0), 0);
                          return (
                            <tr key={t} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-2 font-bold text-zinc-900">{t}</td>
                              {activeMonths.map((_, mIdx) => (
                                <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(execLaborChargeData[mIdx]?.[t] || 0).replace(',00', '')}</td>
                              ))}
                              <td className="px-4 py-2 text-right font-bold text-zinc-950 tabular-nums bg-zinc-50/30">{formatCurrency(ytdTotal)}</td>
                            </tr>
                          );
                        })}
                         <tr className="bg-indigo-50/70 font-black border-t border-indigo-100 text-indigo-950">
                          <td className="px-4 py-2">Total</td>
                          {activeMonths.map((_, mIdx) => {
                            const sum = ['IFS', 'IKC', 'EUR', 'IOB'].reduce((acc, t) => acc + (execLaborChargeData[mIdx]?.[t] || 0), 0);
                            return <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(sum).replace(',00', '')}</td>;
                          })}
                          <td className="px-4 py-2 text-right tabular-nums bg-indigo-100/60 font-black">
                            {formatCurrency(execLaborChargeData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 2b. Laporan Keuntungan Sub Order (SO) */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">2b. Laporan Keuntungan Sub Order (SO)</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Invoice, IOB</span>
                  </div>

                  {/* SO KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {['IFS', 'IKC', 'EUR', 'IOB'].map(t => {
                      const total = execSubOrderData.reduce((acc, d) => acc + (d[t] || 0), 0);
                      return (
                        <div key={t} className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-lg">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-center">{t}</p>
                          <p className="text-xs font-black text-zinc-950 mt-1 text-center truncate">{formatCurrency(total)}</p>
                        </div>
                      );
                    })}
                    <div className="bg-zinc-900 p-3 rounded-lg col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider text-center">TOTAL SO YTD</p>
                      <p className="text-xs font-black text-white mt-1 text-center truncate">
                        {formatCurrency(execSubOrderData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* SO Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-sub-order">
                    <ReactApexChart
                      options={{
                        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'],
                        stroke: { curve: 'smooth', width: 2 },
                        markers: { size: 3 },
                        fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
                        dataLabels: {
                          enabled: true,
                          formatter: (val) => {
                            if (!val) return '';
                            return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
                          },
                          style: { fontSize: '8px', fontWeight: 'bold' }
                        },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700 }, formatter: (v) => formatCurrency(v).replace(',00', '') } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        legend: { show: true, position: 'top', labels: { colors: '#71717a' }, fontWeight: 700 },
                        tooltip: { theme: 'light', y: { formatter: (v) => formatCurrency(v) } }
                      }}
                      series={[
                        { name: 'IFS', data: execSubOrderData.map(d => d.IFS) },
                        { name: 'IKC', data: execSubOrderData.map(d => d.IKC) },
                        { name: 'EUR', data: execSubOrderData.map(d => d.EUR) },
                        { name: 'IOB', data: execSubOrderData.map(d => d.IOB) }
                      ]}
                      type="area"
                      height="100%"
                    />
                  </div>

                  {/* SO Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Tipe/Segment</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-right">Total YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {['IFS', 'IKC', 'EUR', 'IOB'].map(t => {
                          const ytdTotal = execSubOrderData.reduce((acc, d) => acc + (d[t] || 0), 0);
                          return (
                            <tr key={t} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-2 font-bold text-zinc-900">{t}</td>
                              {activeMonths.map((_, mIdx) => (
                                <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(execSubOrderData[mIdx]?.[t] || 0).replace(',00', '')}</td>
                              ))}
                              <td className="px-4 py-2 text-right font-bold text-zinc-950 tabular-nums bg-zinc-50/30">{formatCurrency(ytdTotal)}</td>
                            </tr>
                          );
                        })}
                         <tr className="bg-indigo-50/70 font-black border-t border-indigo-100 text-indigo-950">
                          <td className="px-4 py-2">Total</td>
                          {activeMonths.map((_, mIdx) => {
                            const sum = ['IFS', 'IKC', 'EUR', 'IOB'].reduce((acc, t) => acc + (execSubOrderData[mIdx]?.[t] || 0), 0);
                            return <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(sum).replace(',00', '')}</td>;
                          })}
                          <td className="px-4 py-2 text-right tabular-nums bg-indigo-100/60 font-black">
                            {formatCurrency(execSubOrderData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 3a. Laporan Sparepart Workshop */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">3a. Laporan Sparepart Workshop</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Sparepart Revenue</span>
                  </div>

                  {/* SP Workshop KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: 'RS0001 (Service)', val: execSparepartWorkshopData.reduce((acc, d) => acc + (d.RS0001 || 0), 0) },
                      { l: '114-I (Asuransi)', val: execSparepartWorkshopData.reduce((acc, d) => acc + (d['114-I'] || 0), 0) },
                      { l: 'INT-112 (Internal)', val: execSparepartWorkshopData.reduce((acc, d) => acc + (d['INT-112'] || 0), 0) }
                    ].map((s, idx) => (
                      <div key={idx} className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-lg">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-center">{s.l}</p>
                        <p className="text-xs font-black text-zinc-950 mt-1 text-center truncate">{formatCurrency(s.val)}</p>
                      </div>
                    ))}
                    <div className="bg-zinc-900 p-3 rounded-lg">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider text-center">TOTAL WORKSHOP YTD</p>
                      <p className="text-xs font-black text-white mt-1 text-center truncate">
                        {formatCurrency(execSparepartWorkshopData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* SP Workshop Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-sparepart-workshop">
                    <ReactApexChart
                      options={{
                        chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#10b981', '#3b82f6', '#f59e0b'],
                        stroke: { curve: 'smooth', width: 3 },
                        markers: { size: 4 },
                        dataLabels: {
                          enabled: true,
                          formatter: (val) => {
                            if (!val) return '';
                            return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
                          },
                          style: { fontSize: '8px', fontWeight: 'bold' }
                        },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700 }, formatter: (v) => formatCurrency(v).replace(',00', '') } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        legend: { show: true, position: 'top', labels: { colors: '#71717a' }, fontWeight: 700 },
                        tooltip: { theme: 'light', y: { formatter: (v) => formatCurrency(v) } }
                      }}
                      series={[
                        { name: 'RS0001 (Service)', data: execSparepartWorkshopData.map(d => d.RS0001) },
                        { name: '114-I (Asuransi)', data: execSparepartWorkshopData.map(d => d['114-I']) },
                        { name: 'INT-112 (Internal)', data: execSparepartWorkshopData.map(d => d['INT-112']) }
                      ]}
                      type="line"
                      height="100%"
                    />
                  </div>

                  {/* SP Workshop Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Segmen Sparepart Workshop</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-right font-bold">Total YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {[
                          { l: 'RS0001 (Service)', k: 'RS0001' },
                          { l: '114-I (Asuransi)', k: '114-I' },
                          { l: 'INT-112 (Internal)', k: 'INT-112' }
                        ].map(s => {
                          const ytdTotal = execSparepartWorkshopData.reduce((acc, d) => acc + (d[s.k] || 0), 0);
                          return (
                            <tr key={s.l} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-2 font-bold text-zinc-900">{s.l}</td>
                              {activeMonths.map((_, mIdx) => (
                                <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(execSparepartWorkshopData[mIdx]?.[s.k] || 0).replace(',00', '')}</td>
                              ))}
                              <td className="px-4 py-2 text-right font-bold text-zinc-950 tabular-nums bg-zinc-50/30">{formatCurrency(ytdTotal)}</td>
                            </tr>
                          );
                        })}
                         <tr className="bg-indigo-50/70 font-black border-t border-indigo-100 text-indigo-950">
                          <td className="px-4 py-2">Total</td>
                          {activeMonths.map((_, mIdx) => {
                            const sum = ['RS0001', '114-I', 'INT-112'].reduce((acc, k) => acc + (execSparepartWorkshopData[mIdx]?.[k] || 0), 0);
                            return <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(sum).replace(',00', '')}</td>;
                          })}
                          <td className="px-4 py-2 text-right tabular-nums bg-indigo-100/60 font-black">
                            {formatCurrency(execSparepartWorkshopData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 3b. Laporan Sparepart Non Workshop */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">3b. Laporan Sparepart Non Workshop</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Sparepart Revenue</span>
                  </div>

                  {/* SP Non Workshop KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { l: 'Retail', val: execSparepartNonWorkshopData.reduce((acc, d) => acc + (d.retail || 0), 0) },
                      { l: 'Partshop', val: execSparepartNonWorkshopData.reduce((acc, d) => acc + (d.partshop || 0), 0) }
                    ].map((s, idx) => (
                      <div key={idx} className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-lg">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-center">{s.l}</p>
                        <p className="text-xs font-black text-zinc-950 mt-1 text-center truncate">{formatCurrency(s.val)}</p>
                      </div>
                    ))}
                    <div className="bg-zinc-900 p-3 rounded-lg col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider text-center">TOTAL NON WORKSHOP YTD</p>
                      <p className="text-xs font-black text-white mt-1 text-center truncate">
                        {formatCurrency(execSparepartNonWorkshopData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* SP Non Workshop Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-sparepart-non-workshop">
                    <ReactApexChart
                      options={{
                        chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#3b82f6', '#f59e0b'],
                        stroke: { curve: 'smooth', width: 3 },
                        markers: { size: 4 },
                        dataLabels: {
                          enabled: true,
                          formatter: (val) => {
                            if (!val) return '';
                            return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
                          },
                          style: { fontSize: '8px', fontWeight: 'bold' }
                        },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700 }, formatter: (v) => formatCurrency(v).replace(',00', '') } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        legend: { show: true, position: 'top', labels: { colors: '#71717a' }, fontWeight: 700 },
                        tooltip: { theme: 'light', y: { formatter: (v) => formatCurrency(v) } }
                      }}
                      series={[
                        { name: 'Retail', data: execSparepartNonWorkshopData.map(d => d.retail) },
                        { name: 'Partshop', data: execSparepartNonWorkshopData.map(d => d.partshop) }
                      ]}
                      type="line"
                      height="100%"
                    />
                  </div>

                  {/* SP Non Workshop Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Segmen Sparepart Non Workshop</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-right font-bold">Total YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {[
                          { l: 'Retail', k: 'retail' },
                          { l: 'Partshop', k: 'partshop' }
                        ].map(s => {
                          const ytdTotal = execSparepartNonWorkshopData.reduce((acc, d) => acc + (d[s.k] || 0), 0);
                          return (
                            <tr key={s.l} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-2 font-bold text-zinc-900">{s.l}</td>
                              {activeMonths.map((_, mIdx) => (
                                <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(execSparepartNonWorkshopData[mIdx]?.[s.k] || 0).replace(',00', '')}</td>
                              ))}
                              <td className="px-4 py-2 text-right font-bold text-zinc-950 tabular-nums bg-zinc-50/30">{formatCurrency(ytdTotal)}</td>
                            </tr>
                          );
                        })}
                         <tr className="bg-indigo-50/70 font-black border-t border-indigo-100 text-indigo-950">
                          <td className="px-4 py-2">Total</td>
                          {activeMonths.map((_, mIdx) => {
                            const sum = ['retail', 'partshop'].reduce((acc, k) => acc + (execSparepartNonWorkshopData[mIdx]?.[k] || 0), 0);
                            return <td key={mIdx} className="px-2 py-2 text-center tabular-nums">{formatCurrency(sum).replace(',00', '')}</td>;
                          })}
                          <td className="px-4 py-2 text-right tabular-nums bg-indigo-100/60 font-black">
                            {formatCurrency(execSparepartNonWorkshopData.reduce((acc, d) => acc + (d.Total || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 4. Laporan Keaktifan Staff */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">4. Laporan Keaktifan & Kinerja Staff</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Kinerja Staff (Work Order)</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* SA Table */}
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                      <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 font-black text-[10px] uppercase text-zinc-700">Service Advisor Activity</div>
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-zinc-100 text-zinc-400 font-bold text-[9px] uppercase">
                              <th className="px-3 py-1.5">Nama</th>
                              {activeMonths.map(m => <th key={m} className="px-1 py-1.5 text-center">{m.substring(0,3)}</th>)}
                              <th className="px-3 py-1.5 text-center">Total YTD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-medium">
                            {(() => {
                              const saEntries = Object.entries(execStaffActivityData.saMonthly);
                              if (saEntries.length === 0) {
                                return <tr><td colSpan={activeMonths.length + 2} className="p-4 text-center text-zinc-400">Tidak ada data</td></tr>;
                              }
                              
                              const maxSaByMonth = activeMonths.map((_, mIdx) => {
                                const values = saEntries.map(([_, counts]) => counts[mIdx] || 0);
                                return values.length > 0 ? Math.max(...values) : 0;
                              });

                              return saEntries
                                .map(([name, counts]) => {
                                  const total = counts.reduce((a, b) => a + b, 0);
                                  const avg = activeMonths.length > 0 ? total / activeMonths.length : 0;
                                  return { name, counts, total, avg };
                                })
                                .sort((a, b) => b.avg - a.avg)
                                .map(({ name, counts, total }) => (
                                  <tr key={name} className="hover:bg-zinc-50/50">
                                    <td className="px-3 py-1.5 font-bold text-zinc-800 uppercase">{name}</td>
                                    {activeMonths.map((_, mIdx) => {
                                      const val = counts[mIdx] || 0;
                                      const isMax = val > 0 && val === maxSaByMonth[mIdx];
                                      return (
                                        <td key={mIdx} className="px-1 py-1.5 text-center tabular-nums">
                                          <span className={isMax ? "bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded border border-emerald-200" : ""}>
                                            {val}
                                          </span>
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-bold text-zinc-950 bg-zinc-50/20">{total}</td>
                                  </tr>
                                ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mechanic Table */}
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                      <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 font-black text-[10px] uppercase text-zinc-700">Mekanik Activity</div>
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-zinc-100 text-zinc-400 font-bold text-[9px] uppercase">
                              <th className="px-3 py-1.5">Nama</th>
                              {activeMonths.map(m => <th key={m} className="px-1 py-1.5 text-center">{m.substring(0,3)}</th>)}
                              <th className="px-3 py-1.5 text-center">Total YTD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-medium">
                            {(() => {
                              const mechEntries = Object.entries(execStaffActivityData.mechMonthly);
                              if (mechEntries.length === 0) {
                                return <tr><td colSpan={activeMonths.length + 2} className="p-4 text-center text-zinc-400">Tidak ada data</td></tr>;
                              }
                              
                              const maxMechByMonth = activeMonths.map((_, mIdx) => {
                                const values = mechEntries.map(([_, counts]) => counts[mIdx] || 0);
                                return values.length > 0 ? Math.max(...values) : 0;
                              });

                              return mechEntries
                                .map(([name, counts]) => {
                                  const total = counts.reduce((a, b) => a + b, 0);
                                  const avg = activeMonths.length > 0 ? total / activeMonths.length : 0;
                                  return { name, counts, total, avg };
                                })
                                .sort((a, b) => b.avg - a.avg)
                                .map(({ name, counts, total }) => (
                                  <tr key={name} className="hover:bg-zinc-50/50">
                                    <td className="px-3 py-1.5 font-bold text-zinc-800 uppercase">{name}</td>
                                    {activeMonths.map((_, mIdx) => {
                                      const val = counts[mIdx] || 0;
                                      const isMax = val > 0 && val === maxMechByMonth[mIdx];
                                      return (
                                        <td key={mIdx} className="px-1 py-1.5 text-center tabular-nums">
                                          <span className={isMax ? "bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded border border-emerald-200" : ""}>
                                            {val}
                                          </span>
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-1.5 text-center font-bold text-zinc-950 bg-zinc-50/20">{total}</td>
                                  </tr>
                                ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* 5. Laporan CSI Result */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">5. Laporan CSI Result</h3>
                    <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">Source: Feishu Integration</span>
                  </div>

                  {/* CSI KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-zinc-950 p-4 rounded-xl text-center border border-zinc-800">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">CSI Average YTD</p>
                      <p className="text-2xl font-black text-emerald-400 mt-1">
                        {(() => {
                          const scs = execCsiData.filter(v => v > 0);
                          return scs.length > 0 ? Math.round(scs.reduce((a, b) => a + b, 0) / scs.length) : 0;
                        })()} pts
                      </p>
                    </div>
                  </div>

                  {/* CSI Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Gauge Chart Card */}
                    <div className="bg-white p-4 border border-zinc-200 rounded-lg flex flex-col justify-between" id="csi-gauge-chart">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Skor CSI Bulan Ini</h4>
                      <div className="h-[200px]">
                        <ReactApexChart
                          options={gaugeOptions}
                          series={gaugeSeries}
                          type="radialBar"
                          height="100%"
                        />
                      </div>
                      <p className="text-[9px] text-zinc-400 text-center font-bold">Total Responden: {activeCsiSummary.totalSample} Ulasan</p>
                    </div>

                    {/* Bar Chart Card */}
                    <div className="bg-white p-4 border border-zinc-200 rounded-lg lg:col-span-2" id="csi-bar-chart">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Pencapaian Dimensi (Bulan Ini)</h4>
                      <div className="h-[200px]">
                        <ReactApexChart
                          options={barChartOptions}
                          series={barSeries}
                          type="bar"
                          height="100%"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CSI Chart */}
                  <div className="w-full h-[240px] border border-zinc-100 rounded-lg p-3 bg-white" id="exec-chart-csi">
                    <ReactApexChart
                      options={{
                        chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#8b5cf6'],
                        stroke: { curve: 'smooth', width: 3 },
                        markers: { size: 4 },
                        xaxis: { categories: activeMonths, labels: { style: { colors: '#71717a', fontWeight: 650, fontSize: '10px' } } },
                        yaxis: { min: 0, max: 1000, labels: { style: { colors: '#71717a', fontWeight: 700 } } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        tooltip: { theme: 'light', y: { formatter: (v) => `${v} pts` } }
                      }}
                      series={[{ name: 'CSI Score', data: execCsiData }]}
                      type="line"
                      height="100%"
                    />
                  </div>

                  {/* CSI Table */}
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[9px]">
                          <th className="px-4 py-2">Indikator</th>
                          {activeMonths.map(m => <th key={m} className="px-2 py-2 text-center">{m.substring(0,3)}</th>)}
                          <th className="px-4 py-2 text-center">Avg YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        <tr className="hover:bg-zinc-50/50">
                          <td className="px-4 py-2 font-bold text-zinc-900">CSI Score</td>
                          {activeMonths.map((_, mIdx) => (
                            <td key={mIdx} className="px-2 py-2 text-center tabular-nums font-bold text-violet-600">{execCsiData[mIdx] || 0}</td>
                          ))}
                          <td className="px-4 py-2 text-center font-bold text-zinc-950 tabular-nums bg-zinc-50/30">
                            {(() => {
                              const scs = execCsiData.filter(v => v > 0);
                              return scs.length > 0 ? Math.round(scs.reduce((a, b) => a + b, 0) / scs.length) : 0;
                            })()} pts
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>


              {/* Container Leaderboard SA & Mekanik */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Container SA */}
                <div className="bg-white p-5 md:p-6 border border-zinc-200 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <User className="text-zinc-700" size={16} /> Leaderboard SA (Service Advisor)
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">{saLeaderboard.length} SA Terdeteksi</span>
                  </div>
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                    {saLeaderboard.length === 0 ? (
                      <p className="text-xs font-medium text-zinc-400 py-4 text-center">Belum ada data SA</p>
                    ) : (
                      saLeaderboard.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl hover:bg-zinc-100/80 transition-all border border-zinc-100">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700 border border-amber-300' : i === 1 ? 'bg-zinc-200 text-zinc-700' : i === 2 ? 'bg-amber-50 text-amber-800' : 'bg-zinc-100 text-zinc-400'}`}>
                              #{i + 1}
                            </span>
                            <div>
                              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight block">{s.name}</span>
                              <span className="text-[9px] font-bold text-zinc-400 uppercase">Service Advisor</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{s.count} WO</span>
                            <span className="text-[9px] font-bold text-emerald-600 block uppercase">Ditangani</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Container Mekanik */}
                <div className="bg-white p-5 md:p-6 border border-zinc-200 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <Wrench className="text-zinc-700" size={16} /> Leaderboard Mekanik Workshop
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">{mechanicLeaderboard.length} Mekanik Terdeteksi</span>
                  </div>
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                    {mechanicLeaderboard.length === 0 ? (
                      <p className="text-xs font-medium text-zinc-400 py-4 text-center">Belum ada data Mekanik</p>
                    ) : (
                      mechanicLeaderboard.map((m, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl hover:bg-zinc-100/80 transition-all border border-zinc-100">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700 border border-amber-300' : i === 1 ? 'bg-zinc-200 text-zinc-700' : i === 2 ? 'bg-amber-50 text-amber-800' : 'bg-zinc-100 text-zinc-400'}`}>
                              #{i + 1}
                            </span>
                            <div>
                              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight block">{m.name}</span>
                              <span className="text-[9px] font-bold text-zinc-400 uppercase">Teknisi / Mekanik</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{m.count} WO</span>
                            <span className="text-[9px] font-bold text-emerald-600 block uppercase">Dikerjakan</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Container Top 10 Tipe Kendaraan & Breakdown KM */}
              <div className="bg-white p-5 md:p-6 border border-zinc-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <Car className="text-zinc-700" size={16} /> Top 10 Tipe Kendaraan & Distribusi KM Masuk
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Top {vehicleStats.length} Model Teratas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicleStats.length === 0 ? (
                    <p className="text-xs font-medium text-zinc-400 py-4 col-span-full text-center">Belum ada data tipe kendaraan</p>
                  ) : (
                    vehicleStats.map((v, i) => (
                      <div key={i} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3 hover:bg-zinc-100/60 transition-all">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-zinc-900 text-white px-2 py-0.5 rounded-md">#{i + 1}</span>
                            <p className="text-xs font-black text-zinc-900 uppercase tracking-tight line-clamp-1">{v.type}</p>
                          </div>
                          <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0">{v.count} Kali Masuk</span>
                        </div>

                        {/* Grid Breakdown Threshold KM */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <div className="bg-white p-2 rounded-lg border border-zinc-200 text-center">
                            <span className="text-[9px] font-black text-zinc-400 block uppercase">KM ≥ 15,000</span>
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{v.km15k} Unit</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-zinc-200 text-center">
                            <span className="text-[9px] font-black text-zinc-400 block uppercase">KM ≥ 30,000</span>
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{v.km30k} Unit</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-zinc-200 text-center">
                            <span className="text-[9px] font-black text-zinc-400 block uppercase">KM ≥ 45,000</span>
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{v.km45k} Unit</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-zinc-200 text-center">
                            <span className="text-[9px] font-black text-zinc-400 block uppercase">KM ≥ 60,000</span>
                            <span className="text-xs font-black text-zinc-900 tabular-nums">{v.km60k} Unit</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div><h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Audit Transaksi Workshop</h3><p className="text-[10px] font-medium text-zinc-400 mt-1">Data Finansial Service Operasional</p></div>
                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                  <input type="file" id="import-revenue-btn" className="hidden" accept=".xlsx, .xls" onChange={handleWorkshopUpload} />
                  <label htmlFor="import-revenue-btn" className="w-full md:w-auto bg-zinc-900 text-white px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 min-h-[36px]">
                    <Upload size={14} /> Import Invoice
                  </label>
                  <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200 w-full md:w-auto overflow-x-auto no-scrollbar">
                    {['all', 'EUR', 'IFS', 'IKC'].map(e => (
                      <button key={e} onClick={() => setEntityFilter(e)} className={`px-3 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[36px] ${entityFilter === e ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}>{e === 'all' ? 'SEMUA' : e}</button>
                    ))}
                  </div>
                  <div className="relative w-full xl:min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari WO atau No Polisi..." className="pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] font-medium focus:border-zinc-900 transition-all w-full min-h-[36px]" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left font-medium min-w-[800px]">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 font-black">
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('no_wo')}>No. WO {sortConfig.key === 'no_wo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('sa')}>Tim Operasional {sortConfig.key === 'sa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 text-right cursor-pointer hover:text-zinc-900" onClick={() => requestSort('jasa')}>Jasa {sortConfig.key === 'jasa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 text-right cursor-pointer hover:text-zinc-900" onClick={() => requestSort('s_part')}>Sparepart {sortConfig.key === 's_part' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 text-right cursor-pointer hover:text-zinc-900" onClick={() => requestSort('g_total')}>Total {sortConfig.key === 'g_total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedFinancialData.slice((financialPage - 1) * rowsPerPage, financialPage * rowsPerPage).map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50 transition-all">
                        <td className="px-4 md:px-6 py-4">
                          <p className="text-sm font-black text-zinc-900">{row.no_wo || 'N/A'}</p>
                          <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1"><Calendar size={10} /> {formatDisplayDate(row.wkt_masuk)}</p>
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <p className="text-xs font-medium text-zinc-700 mb-1">{row.tipe_kendaraan || 'GENERAL SERVICE'}</p>
                          <div className="flex items-center gap-2"><span className="text-[9px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-medium">SA: {row.sa || '---'}</span><span className="text-[9px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-medium">MKN: {row.mekanik || '---'}</span></div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right text-zinc-900 font-black text-sm tabular-nums">{formatCurrency(row.jasa)}</td>
                        <td className="px-4 md:px-6 py-4 text-right text-zinc-900 font-black text-sm tabular-nums">{formatCurrency(row.s_part)}</td>
                        <td className="px-4 md:px-6 py-4 text-right font-black text-sm tabular-nums">{formatCurrency(row.g_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 md:p-6 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center bg-zinc-50/30 gap-3">
                <p className="text-[10px] font-medium uppercase text-zinc-400 tracking-wider whitespace-nowrap">Halaman {financialPage} dari {Math.ceil(sortedFinancialData.length / rowsPerPage)}</p>
                <p className="text-[10px] font-black uppercase text-zinc-900 tracking-wider flex items-center gap-2"><Activity size={14} /> Total: {sortedFinancialData.length}</p>
                <div className="flex gap-2">
                  <button disabled={financialPage === 1} onClick={() => setFinancialPage(p => p - 1)} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all min-h-[36px] ${financialPage === 1 ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>Prev</button>
                  <button disabled={financialPage * rowsPerPage >= sortedFinancialData.length} onClick={() => setFinancialPage(p => p + 1)} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all min-h-[36px] ${financialPage * rowsPerPage >= sortedFinancialData.length ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wo_tracking' && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div><h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Status Pengerjaan Workshop</h3><p className="text-[10px] font-medium text-zinc-400 mt-1">Realtime Workflow Monitoring</p></div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                  <input type="file" id="import-tracking-btn" className="hidden" accept=".xlsx, .xls" onChange={handleWorkshopUpload} />
                  <label htmlFor="import-tracking-btn" className="bg-zinc-900 text-white px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-all flex items-center gap-2 min-h-[36px] w-full sm:w-auto justify-center">
                    <Upload size={14} /> Import Excel
                  </label>
                  <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                    {['all', 'Estimasi', 'On Progress', 'Ready', 'Closed', 'Open', 'Cancelled', 'Pre-Cancelled'].map(s => (
                      <button key={s} onClick={() => setWoStatusFilter(s)} className={`px-3 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[36px] ${woStatusFilter === s ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200'}`}>{s === 'all' ? 'SEMUA' : s}</button>
                    ))}
                  </div>
                  <div className="relative w-full xl:min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari WO, Plat, Mekanik..." className="pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] font-medium focus:border-zinc-900 w-full min-h-[36px]" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-medium min-w-[800px]">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 font-black">
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('no_wo')}>No. WO / Plat {sortConfig.key === 'no_wo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('sa')}>Team Support {sortConfig.key === 'sa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('wkt_masuk')}>Waktu Masuk {sortConfig.key === 'wkt_masuk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-4 md:px-6 py-3 text-right cursor-pointer hover:text-zinc-900" onClick={() => requestSort('wkt_estimasi')}>Estimasi {sortConfig.key === 'wkt_estimasi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedWoTrackingData.slice((woTrackingPage - 1) * rowsPerPage, woTrackingPage * rowsPerPage).map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50 transition-all">
                        <td className="px-4 md:px-6 py-4">
                          <p className="text-sm font-black text-zinc-900">{row.no_wo || 'N/A'}</p>
                          <p className="text-[10px] text-zinc-400 mt-1 px-2 py-0.5 bg-zinc-100 rounded w-max">{row.no_pol || '---'}</p>
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <span className={`px-3 py-1 rounded-md text-[10px] font-black ${(row.status || '').toLowerCase().includes('selesai') || (row.status || '').toLowerCase().includes('ready') || (row.status || '').toLowerCase().includes('closed') ? 'bg-green-50 text-green-700 border border-green-200' : (row.status || '').toLowerCase().includes('on progress') ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>{row.status || 'PROSES'}</span>
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div> <span className="text-xs">{row.sa || '---'} (SA)</span></div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div> <span className="text-xs">{row.mekanik || '---'} (MKN)</span></div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-xs text-zinc-600 tabular-nums">{formatDisplayDate(row.wkt_masuk || row.wktmasuk)}</td>
                        <td className="px-4 md:px-6 py-4 text-right"><span className="bg-zinc-900 text-white px-3 py-1.5 rounded-md text-[10px] tabular-nums inline-block font-black">{formatDisplayDate(row.wkt_estimasi || row.wktestimasi)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 md:p-6 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center bg-zinc-50/30 gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] font-medium uppercase text-zinc-400 tracking-wider whitespace-nowrap">Tampilkan:</p>
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(parseInt(e.target.value))} className="bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-[10px] font-medium outline-none focus:border-zinc-900 cursor-pointer min-h-[36px]">
                    <option value={10}>10</option><option value={20}>20</option><option value={40}>40</option><option value={100}>100</option>
                  </select>
                  <p className="text-[10px] font-black uppercase text-zinc-900 tracking-wider flex items-center gap-2"><Activity size={14} /> Total: {sortedWoTrackingData.length}</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={woTrackingPage === 1} onClick={() => setWoTrackingPage(p => p - 1)} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all min-h-[36px] ${woTrackingPage === 1 ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>Prev</button>
                  <button disabled={woTrackingPage * rowsPerPage >= sortedWoTrackingData.length} onClick={() => setWoTrackingPage(p => p + 1)} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all min-h-[36px] ${woTrackingPage * rowsPerPage >= sortedWoTrackingData.length ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Database Frekuensi Kendaraan</h3>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Masukkan No Plat..." className="pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] font-medium focus:border-zinc-900 w-full md:min-w-[300px] min-h-[36px]" />
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehicleLeaderboard.filter(v => v.bk.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 18).map((car, i) => (
                    <div key={i} onClick={() => setSelectedVehicle(car.bk)} className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 bg-zinc-900 text-white rounded-md flex items-center justify-center text-xs font-black">#{i + 1}</div>
                        <div className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-[9px] font-black tracking-wider">{car.count} KUNJUNGAN</div>
                      </div>
                      <p className="text-sm font-black text-zinc-900 tracking-tight mb-0.5">{car.bk}</p>
                      <p className="text-[10px] text-zinc-400">{car.tipe}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cro_history' && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden min-h-[400px]">
              <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div><h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Riwayat Follow Up Customer</h3><p className="text-[10px] font-medium text-zinc-400 mt-1">Data hasil respon customer CRO</p></div>
                <div className="relative w-full xl:min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                  <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari Nama, Plat, atau Respon..." className="pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] font-medium focus:border-zinc-900 transition-all w-full min-h-[36px]" />
                </div>
              </div>
              <div className="p-4 md:p-6">
                {isLoading ? (
                  <div className="py-16 text-center text-zinc-400 text-xs font-medium animate-pulse">Memuat Data...</div>
                ) : croHistory.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-xs font-medium">Belum ada riwayat follow up.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {croHistory.filter(item => {
                      const s = searchTerm.toLowerCase();
                      return !s || (item.nama || '').toLowerCase().includes(s) || (item.plat || '').toLowerCase().includes(s) || (item.respon || '').toLowerCase().includes(s);
                    }).map((item, idx) => (
                      <div key={idx} className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div className="px-2 py-1 bg-zinc-900 text-white text-[9px] font-black rounded tracking-wider">{item.plat}</div>
                          <div className="text-[9px] font-medium text-zinc-400 px-2 py-1 bg-zinc-50 rounded">{item.tanggalFollowUp}</div>
                        </div>
                        {(item.lampiran || item.foto) && (
                          <div
                            className="mb-3 w-full h-36 rounded-lg overflow-hidden border border-zinc-100 cursor-zoom-in"
                            onClick={() => setPreviewImage(item.lampiran || item.foto)}
                          >
                            <img src={item.lampiran || item.foto} alt="Foto CRO" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h4 className="font-black text-sm text-zinc-900 mb-0.5">{item.nama}</h4>
                        <p className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider mb-3">{item.tipeMobil}</p>
                        <div className="bg-zinc-50 p-3 rounded-lg">
                          <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-3">"{item.respon || 'Tidak ada respon tertulis.'}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Manajemen Staff</h3>
                  <p className="text-[10px] font-medium text-zinc-400 mt-1">Kelola Akses User Bengkel</p>
                </div>
                <button
                  onClick={() => { setUserFormData({ username: '', password: '', name: '', role: 'mekanik' }); setIsUserModalOpen(true); }}
                  className="px-5 py-2.5 bg-zinc-900 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all min-h-[36px]"
                >
                  Tambah Staf Baru
                </button>
              </div>
              <div className="max-h-[500px] overflow-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse font-medium min-w-[700px]">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="bg-zinc-50 text-[10px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-200">
                      <th className="px-4 md:px-6 py-3">Nama Lengkap</th>
                      <th className="px-4 md:px-6 py-3">User ID</th>
                      <th className="px-4 md:px-6 py-3">Role / Akses</th>
                      <th className="px-4 md:px-6 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {usersData.length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-12 text-center text-zinc-400 text-xs font-medium">Belum ada data staf / Loading...</td></tr>
                    ) : (
                      usersData.map((u, i) => (
                        <tr key={i} className="hover:bg-zinc-50 transition-all">
                          <td className="px-4 md:px-6 py-3 flex items-center gap-3 text-zinc-900">
                            <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center rounded-md text-xs font-black">{u.name?.charAt(0)}</div>
                            <span className="text-xs font-black">{u.name}</span>
                          </td>
                          <td className="px-4 md:px-6 py-3 text-zinc-400 text-xs">{u.username}</td>
                          <td className="px-4 md:px-6 py-3">
                            <span className={`px-2 py-1 rounded text-[9px] font-black ${u.role === 'admin' ? 'bg-zinc-900 text-white' : u.role === 'mekanik' ? 'bg-zinc-100 text-black' : 'bg-zinc-200 text-black'}`}>{u.role}</span>
                          </td>
                          <td className="px-4 md:px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setUserFormData({ ...u, password: '' }); setIsUserModalOpen(true); }} className="p-2 bg-zinc-100 text-zinc-900 rounded-md hover:bg-zinc-200 transition-all"><Settings size={14} /></button>
                              <button onClick={() => handleDeleteUser(u.username)} className="p-2 bg-zinc-100 text-black rounded-md hover:bg-red-500 hover:text-white transition-all"><X size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Modal */}
          {isUserModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
              <div className="bg-white rounded-lg w-full max-w-md overflow-hidden shadow-xl">
                <div className="px-6 py-4 bg-zinc-900 text-white flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest">Profil Staf</h3>
                  <button onClick={() => setIsUserModalOpen(false)} className="hover:opacity-70 transition-opacity"><X size={18} /></button>
                </div>
                <form onSubmit={handleUpsertUser} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Nama Lengkap</label>
                    <input required value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-lg text-xs font-medium outline-none focus:border-zinc-900 transition-all" placeholder="Contoh: Budi Santoso" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-400">Username</label>
                      <input required value={userFormData.username} onChange={e => setUserFormData({ ...userFormData, username: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-lg text-xs font-medium outline-none focus:border-zinc-900 transition-all" placeholder="userid" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-400">Password</label>
                      <input value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-lg text-xs font-medium outline-none focus:border-zinc-900 transition-all" type="password" placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Role / Hak Akses</label>
                    <select value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-lg text-xs font-medium outline-none focus:border-zinc-900 transition-all appearance-none cursor-pointer">
                      <option value="admin">Admin Service</option>
                      <option value="mekanik">Mekanik Bengkel</option>
                      <option value="sparepart">Sparepart Staff</option>
                      <option value="cro">Customer Relation (CRO)</option>
                      <option value="sales">Sales</option>
                      <option value="spv">SPV Sales</option>
                      <option value="manager">Manager Hub</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50">
                    {isLoading ? 'Processing...' : 'Simpan Data Staf'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
      </div>

      {/* Overlays */}

      {selectedVehicle && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setSelectedVehicle(null)}></div>
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl relative z-10 flex flex-col max-h-[85vh] overflow-hidden border border-zinc-200">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 text-white rounded-lg flex items-center justify-center"><Car size={20} /></div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">{selectedVehicle}</h3>
                  <p className="text-[10px] font-medium text-zinc-400">Audit Riwayat Servis Kendaraan</p>
                </div>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="w-8 h-8 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-all flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <div className="space-y-3">
                {rawHistory.filter(h => h.bk === selectedVehicle).sort((a, b) => parseDateToTimestamp(b.id) - parseDateToTimestamp(a.id)).map((v, i) => (
                  <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:bg-zinc-100 transition-all">
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1">Waktu Kedatangan</p>
                      <p className="text-sm font-black text-zinc-900">{formatDisplayDate(v.id)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1">Operasional</p>
                      <p className="text-xs font-medium text-zinc-700">Mekanik: {v.mechanicName || 'N/A'}</p>
                      <p className="text-[10px] text-zinc-400">Input: {v.addedBy || 'CORE_SYSTEM'}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1">Status</p>
                      <p className="text-xs font-medium text-zinc-700 leading-relaxed">{v.keluhan || '---'}</p>
                    </div>
                    <div className="shrink-0"><span className="bg-zinc-900 text-white px-3 py-1.5 rounded-md text-[9px] font-black tracking-wider">TERVALIDASI</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col p-6" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm"><X size={24} /></button>
          <div className="flex-1 flex items-center justify-center p-6" onClick={e => e.stopPropagation()}>
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Preview" />
          </div>
          <p className="text-center text-white/30 font-medium text-[10px] uppercase tracking-wider pb-4">Ketuk di mana saja untuk menutup</p>
        </div>
      )}
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
    </div>
  );
};

export default ManagerPanel;
