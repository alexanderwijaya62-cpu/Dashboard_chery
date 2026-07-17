import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp, Users, Clock, AlertCircle, ChevronRight, ChevronLeft,
  Search, Calendar, Download, Filter, Car, DollarSign, Activity,
  ShieldCheck, Package, Award, Zap, Star, LayoutDashboard, Database,
  History, Upload, X, BarChart4, CheckCircle, Wrench, Shield, Settings, MessageSquare, Menu, FileSpreadsheet, Key, LogOut
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import CroBookingPanel from './CroBookingPanel';
import HolidaySettings from './HolidaySettings';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import ReactApexChart from 'react-apexcharts';

import { db } from '../utils/dbClient';


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
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [woStatusFilter, setWoStatusFilter] = useState('all');
  const [woTrackingPage, setWoTrackingPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [financialData, setFinancialData] = useState([]);

  const [croHistory, setCroHistory] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const fetchFinancialData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db.select('revenue');
      if (error) throw error;

      // Map columns from snake_case with dots/spaces if any (based on your schema)
      const mapped = (data || []).map(r => ({
        no_wo: r.no_wo,
        wkt_masuk: r.wkt_masuk,
        bk: r.bk, // Catatan: Anda tidak mencantumkan 'bk' di schema revenue Anda tadi, saya asumsikan ada atau gunakan nohp
        tipe_kendaraan: r.tipe_kendaraan,
        jasa: Number(r.jasa || 0),
        s_part: Number(r.s_part || 0),
        g_total: Number(r.g_total || 0),
        sa: r.sa,
        leader: r.leader,
        mekanik: r.mekanik,
        nohp: r.nohp
      }));

      setFinancialData(mapped);
      if (mapped.length === 0) Toastify({ text: "⚠️ Revenue: Data Kosong", style: { background: "orange" } }).showToast();
    } catch (e) {
      console.error("Gagal fetch financial:", e);
      Toastify({ text: `❌ Revenue: ${e.message}`, style: { background: "red" } }).showToast();
    }
    setIsLoading(false);
  }, []);

  const fetchWoHistory = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db.select('laporanwo');
      if (error) throw error;

      // Map dari nama kolom ber-titik dan spasi (No. WO, Wkt.Masuk, dll)
      const mapped = (data || []).map(r => ({
        no_wo: r['No. WO'],
        bk: r['No. Pol'],
        tipe_kendaraan: r['Kendaraan'],
        sa: r['SA'],
        mekanik: r['Mekanik'],
        leader: r['Leader'],
        wkt_masuk: r['Wkt.Masuk'],
        status: r['Status']
      }));

      setWoTrackingData(mapped);
    } catch (e) {
      console.error("Gagal fetch tracking:", e);
    }
    setIsLoading(false);
  }, []);

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
    // Fetch all for export readiness
    fetchFinancialData();
    fetchWoHistory();
    fetchCroHistory();
    fetchUsers();
  }, [fetchFinancialData, fetchWoHistory, fetchCroHistory, fetchUsers]);

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
        // Handle Excel Serial Date if needed, but usually it's string or ISO
        dObj = new Date(val);
      } else {
        let str = String(val).trim();
        // Handle DD/MM/YYYY
        if (str.includes('/')) {
          const p = str.split('/');
          if (p.length === 3) {
            if (p[2].length === 4) dObj = new Date(p[2], p[1] - 1, p[0]);
            else dObj = new Date(p[0], p[1] - 1, p[2]);
          }
        } else {
          // Cek apakah string ini sebenarnya adalah timestamp numerik (ms)
          if (/^\d{10,13}$/.test(str)) {
             dObj = new Date(parseInt(str));
          } else {
             dObj = new Date(str);
          }
        }
      }

      if (isNaN(dObj.getTime())) return '';
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
      acc.s_part += (curr.s_part || 0);
      acc.grandTotal += (curr.g_total || 0);
      return acc;
    }, { jasa: 0, s_part: 0, grandTotal: 0 });
  }, [filteredFinancialDataRaw]);

  const monthlyChartData = useMemo(() => {
    const fullYearMap = {};
    if (timeFilter === 'year') {
      for (let m = 0; m < 12; m++) {
        const mKey = `${selectedYear}-${String(m + 1).padStart(2, '0')}`;
        fullYearMap[mKey] = { jasa: 0, part: 0 };
      }
    } else {
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        fullYearMap[mKey] = { jasa: 0, part: 0 };
      }
    }

    financialData.forEach(item => {
      const dateStr = normalizeDateStr(item.wkt_masuk);
      if (!dateStr) return;
      const mKey = dateStr.substring(0, 7);
      if (fullYearMap[mKey]) {
        fullYearMap[mKey].jasa += (item.jasa || 0);
        fullYearMap[mKey].part += (item.s_part || 0);
      } else if (timeFilter === 'all') {
        fullYearMap[mKey] = { jasa: (item.jasa || 0), part: (item.s_part || 0) };
      }
    });

    const sortedMonths = Object.keys(fullYearMap).sort();
    const categories = sortedMonths.map(tag => {
      const [y, m] = tag.split('-');
      return `${getMonthName(parseInt(m) - 1)} ${y}`;
    });

    const series = [
      { name: 'Jasa Service', data: sortedMonths.map(m => fullYearMap[m].jasa) },
      { name: 'Sparepart', data: sortedMonths.map(m => fullYearMap[m].part) }
    ];
    return { series, categories };
  }, [financialData, timeFilter, selectedYear]);

  const vehicleLeaderboard = useMemo(() => {
    const map = {};
    rawHistory.forEach(item => {
      if (!item.bk) return;
      if (!map[item.bk]) map[item.bk] = { bk: item.bk, tipe: item.tipe, count: 0 };
      map[item.bk].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [rawHistory]);

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
    vehicles: { title: '🚗 Database Mobil', subtitle: 'Frekuensi kunjungan kendaraan' },
    cro_history: { title: '📋 Riwayat CRO', subtitle: 'Follow up customer relation' },
    holidays: { title: '🗓️ Libur Dealer', subtitle: 'Pengaturan hari libur dealer' },
    staff: { title: '👥 Manajemen Staff', subtitle: 'Kelola akses user bengkel' },
  };
  const currentTab = tabMeta[activeTab] || tabMeta.performance;

  return (
    <div className="w-full h-full bg-zinc-100 flex flex-col overflow-hidden font-sans antialiased">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200 px-4 md:px-8 h-20 flex items-center justify-between shrink-0 box-border">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-zinc-900 font-black text-base md:text-lg">{currentTab.title}</h2>
              <p className="text-zinc-500 text-xs font-medium">{currentTab.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPasswordModal(true)}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-all active:scale-95"
              title="Ganti Password">
              <Key size={16} />
            </button>
            <button onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all active:scale-95 text-xs font-bold flex items-center gap-2 shadow-sm"
              title="Logout">
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main
          ref={mainRef}
          className={`flex-1 ${activeTab === 'holidays' ? 'overflow-hidden' : 'overflow-y-auto'} p-4 md:p-8 custom-scrollbar space-y-6 pb-[72px] md:pb-8 overflow-x-hidden`}
        >
        {/* EXPORT SUMMARY - only on Dashboard Utama */}
        {activeTab === 'performance' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-zinc-900 p-3 rounded-lg text-white">
                <FileSpreadsheet size={20} />
             </div>
             <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Ekspor Rangkuman Audit</h3>
                <p className="text-[10px] text-zinc-500 font-medium">4 Laporan Spesifik</p>
             </div>
          </div>
          <button 
            onClick={handleExportSummary}
            disabled={isSyncing}
            className={`w-full sm:w-auto ${isSyncing ? 'bg-zinc-300 text-zinc-500' : 'bg-zinc-900 hover:bg-zinc-800'} text-white px-6 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 min-h-[40px]`}
          >
            {isSyncing ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Memproses...
                </>
            ) : (
                <>
                    <Download size={16} /> Ekspor XLSX
                    <span className="opacity-50 hidden sm:inline">({financialData.length} Data)</span>
                </>
            )}
          </button>
        </div>
        )}
        {activeTab !== 'staff' && (
          <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                {activeTab === 'performance' ? 'Kinerja Tim' : activeTab === 'financial' ? 'Invoice Pelanggan' : activeTab === 'wo_tracking' ? 'Tracking Pengerjaan' : activeTab === 'vehicles' ? 'Data Kendaraan' : activeTab === 'staff' ? 'Manajemen Staff' : activeTab === 'holidays' ? 'Libur Dealer' : 'Riwayat CRO'}
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
        {activeTab !== 'cro_history' && activeTab !== 'staff' && activeTab !== 'booking_mgmt' && activeTab !== 'holidays' && activeTab !== 'vehicles' && (
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
          {activeTab === 'holidays' && (
            <div className="animate-in">
              <HolidaySettings user={user} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="bg-white p-5 md:p-8 border border-zinc-200 rounded-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div><h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Tren Pendapatan Bulanan</h3><p className="text-zinc-400 text-[10px] font-medium mt-1">Analisis Historis Kumulatif</p></div>
                </div>
                <div className="w-full h-[300px] md:h-[400px]">
                  {financialData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs font-medium uppercase tracking-wider">Belum ada data visualisasi</div>
                  ) : (
                    <ReactApexChart
                      options={{
                        legend: {
                          show: true,
                          position: 'top',
                          horizontalAlign: 'right',
                          labels: { colors: '#71717a' },
                          fontFamily: 'Inter',
                          fontWeight: 700,
                          itemMargin: { horizontal: 16 }
                        },
                        chart: { type: 'area', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#000000', '#71717a', '#a1a1aa'],
                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05, stops: [0, 90, 100] } },
                        dataLabels: { enabled: false },
                        stroke: { curve: 'smooth', width: 2 },
                        xaxis: { categories: monthlyChartData.categories, labels: { style: { colors: '#71717a', fontWeight: 700, fontFamily: 'Inter', fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 700, fontSize: '10px' }, formatter: (val) => formatCurrency(val) } },
                        grid: { borderColor: '#e4e4e7', strokeDashArray: 4 },
                        tooltip: { theme: 'light', x: { show: true } }
                      }}
                      series={monthlyChartData.series}
                      type="area"
                      height="100%"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white p-5 md:p-8 border border-zinc-200 rounded-lg">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-5 flex items-center gap-2"><Award className="text-zinc-600" size={18} /> Top Performance SA</h3>
                  <div className="space-y-3">
                    {revenueLeaders.saArr.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-zinc-300 w-5">#{i + 1}</span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-tight block">{s.name}</span>
                            <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">{s.count} Unit Ditangani</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-zinc-900 tabular-nums">{formatCurrency(s.totalJasa)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-5 md:p-8 border border-zinc-200 rounded-lg">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-5 flex items-center gap-2"><Star className="text-zinc-600" size={18} /> Lead Mechanic</h3>
                  <div className="space-y-3">
                    {revenueLeaders.mechArr.slice(0, 5).map((m, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-zinc-300 w-5">#{i + 1}</span>
                          <div>
                            <span className="text-xs font-black uppercase tracking-tight block">{m.name}</span>
                            <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">{m.count} Unit Selesai</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-zinc-900 tabular-nums">{formatCurrency(m.totalJasa)}</span>
                      </div>
                    ))}
                  </div>
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
