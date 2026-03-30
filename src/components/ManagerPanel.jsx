import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp, Users, Clock, AlertCircle, ChevronRight, ChevronLeft,
  Search, Calendar, Download, Filter, Car, DollarSign, Activity,
  ShieldCheck, Package, Award, Zap, Star, LayoutDashboard, Database,
  History, Upload, X, BarChart4, CheckCircle, Wrench, Moon, Settings, MessageSquare, Menu
} from 'lucide-react';
import CroBookingPanel from './CroBookingPanel';
import HolidaySettings from './HolidaySettings';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import ReactApexChart from 'react-apexcharts';

import { supabase } from '../utils/supabaseClient';


const ManagerPanel = ({ user, handleLogout, queue = [], rawHistory = [], breakSettings, setBreakSettings, setIsNavbarVisible }) => {
  const [usersData, setUsersData] = useState([]);
  const mainRef = useRef(null);
  const lastScrollY = useRef(0);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', name: '', role: 'mekanik' });
  const [entityFilter, setEntityFilter] = useState('all');
  const [financialPage, setFinancialPage] = useState(1);
  const [woTrackingData, setWoTrackingData] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('chery_manager_tab') || 'performance';
  });

  useEffect(() => {
    localStorage.setItem('chery_manager_tab', activeTab);
  }, [activeTab]);

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const fetchFinancialData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('revenue').select('*');
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
      const { data, error } = await supabase.from('laporanwo').select('*');
      if (error) throw error;
      
      // Map dari nama kolom ber-titik dan spasi (No. WO, Wkt.Masuk, dll)
      const mapped = (data || []).map(r => ({
        no_wo: r['No. WO'],
        bk: r['No. Pol'],
        tipe_kendaraan: r['Kendaraan'],
        sa: r['SA'],
        mekanik: r['Mekanik'],
        leader: r['Leader'],
        wkt_masuk: r['Wkt.Masuk']
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
      const { data, error } = await supabase.from('cro').select('*').eq('status', 'Sudah');
      if (error) throw error;
      setCroHistory(data || []);
    } catch (e) {
      console.error("Gagal fetch CRO:", e);
    }
    setIsLoading(false);
  }, []);

  const fetchUsers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('users').select('username, name, role');
      if (error) throw error;
      if (data) setUsersData(data);
    } catch (e) {
      console.error("Gagal fetch users:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'performance' || activeTab === 'financial') fetchFinancialData();
    if (activeTab === 'wo_tracking') fetchWoHistory();
    if (activeTab === 'cro_history') fetchCroHistory();
    if (activeTab === 'staff') fetchUsers();
  }, [activeTab, fetchFinancialData, fetchWoHistory, fetchCroHistory, fetchUsers]);

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
      const { data:existing } = await supabase.from('users').select('id').eq('username', userFormData.username).single();
      let error;
      if (existing) {
        const updates = { name: userFormData.name, role: userFormData.role };
        if (userFormData.password) updates.password = userFormData.password;
        ({ error } = await supabase.from('users').update(updates).eq('id', existing.id));
      } else {
        ({ error } = await supabase.from('users').insert(userFormData));
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
      const { error } = await supabase.from('users').delete().eq('username', username);
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
          dObj = new Date(str);
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

            mapped.sa = findVal(['Front', 'Pembawa', 'SA', 'Advisor']);
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
        const { data: existingRecords, error: fetchError } = await supabase
          .from(targetTable)
          .select(idField);

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
                no_wo:          keyStr,
                tipe_kendaraan: r.tipe_kendaraan || null,
                sa:             r.sa || null,
                mekanik:        r.mekanik || null,
                leader:         r.leader || null,
                wkt_masuk:      r.wkt_masuk ? r.wkt_masuk.split('T')[0] : null,
                jasa:           Number(r.jasa) || 0,
                s_part:         Number(r.s_part) || 0,
                g_total:        Number(r.g_total) || 0,
                nohp:           r.nohp || null,
              });
            } else {
              // Helper untuk mendapatkan nilai dari object r dengan toleransi variasi nama kolom
              const gv = (keywords, defaultVal = null) => {
                const ky = Object.keys(r).find(k => keywords.some(kw => String(k).toLowerCase().includes(kw.toLowerCase())));
                return (ky !== undefined) ? r[ky] : defaultVal;
              };

              toInsert.push({
                'No. WO':                keyStr,
                'No. WO DMS':            gv(['No. WO DMS', 'No. WO (DMS)', 'No WO DMS']) || null,
                'Status':                gv(['Status']) || null,
                'No. Pol':               gv(['No. Pol', 'No Pol', 'Plat Nomor']) || null,
                'No. Rangka':            gv(['No. Rangka', 'No Rangka', 'VIN']) || null,
                'Kode Tipe':             gv(['Kode Tipe', 'Kode Type']) || null,
                'Kendaraan':             gv(['Kendaraan', 'Tipe Kendaraan', 'Model']) || null,
                'Nama Invoice':          gv(['Nama Invoice', 'Customer']) || null,
                'Pembawa':               gv(['Pembawa', 'Front']) || null,
                'KM Masuk':              gv(['KM Masuk', 'Kilometer']) ? Number(gv(['KM Masuk', 'Kilometer'])) : null,
                'Wkt.Masuk':             gv(['Wkt.Masuk', 'Tanggal Masuk']) || null,
                'Wkt.Estimasi':          gv(['Wkt.Estimasi']) || null,
                'Wkt.Setuju Estimasi':   gv(['Wkt.Setuju Estimasi']) || null,
                'Wkt.Mulai':             gv(['Wkt.Mulai']) || null,
                'Wkt.Selesai':           gv(['Wkt.Selesai']) || null,
                'Wkt.Tutup':             gv(['Wkt.Tutup']) || null,
                'SA':                    gv(['SA', 'Advisor']) || null,
                'Mekanik':               gv(['Mekanik', 'Mkn']) || null,
                'Leader':                gv(['Leader', 'Ldr']) || null,
                'LC':                    gv(['LC', 'Jasa']) || null,
                'Oli':                   gv(['Oli']) || null,
                'SM':                    gv(['SM']) || null,
                'SO':                    gv(['SO']) || null,
                'Penjualan':             gv(['Penjualan']) || null,
                'S. Part':               gv(['S. Part', 'Sparepart']) || null,
                'TOTAL':                 gv(['TOTAL']) || null,
                'PPN':                   gv(['PPN']) || null,
                'G.TOTAL':               gv(['G.TOTAL', 'Grand Total']) || null,
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
        const { error: supaError } = await supabase
          .from(targetTable)
          .insert(toInsert);

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

  return (
    <div className="fixed inset-0 bg-[#F2F2F7] overflow-hidden flex flex-col font-sans antialiased text-zinc-900">
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[55] backdrop-blur-sm" onClick={() => setIsMobileSidebarOpen(false)}></div>
      )}

      {/* Sidebar - Desktop always narrow-to-expand, Mobile toggleable drawer */}
      <aside className={`fixed left-0 top-0 bottom-0 z-[60] bg-white border-r border-zinc-200 transition-all duration-500 ease-in-out flex flex-col shadow-2xl overflow-hidden group
        ${isMobileSidebarOpen ? 'w-[280px] translate-x-0 p-8' : '-translate-x-full md:translate-x-0 md:w-20 md:hover:w-72 p-2 md:p-4 md:hover:p-8'}`}>
        
        <div className={`flex items-center gap-4 mb-12 px-2 transition-all duration-300 whitespace-nowrap
          ${isMobileSidebarOpen ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'}`}>
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 shrink-0">
            <TrendingUp className="text-white" size={24} />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Workshop</h1>
            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">Manager Hub</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {[
            { id: 'performance', label: 'Dashboard Utama', icon: LayoutDashboard },
            { id: 'financial', label: 'Laporan Revenue', icon: DollarSign },
            { id: 'wo_tracking', label: 'Tracking Pengerjaan', icon: Activity },
            { id: 'vehicles', label: 'Database Mobil', icon: Database },
            { id: 'cro_history', label: 'Riwayat CRO', icon: History },
            { id: 'booking_mgmt', label: 'Booking Manager', icon: Calendar },
            { id: 'holidays', label: 'Libur Dealer', icon: Settings },
            { id: 'staff', label: 'Manajemen Staff', icon: Users }
          ].map(item => (
            <button key={item.id} 
              onClick={() => { setActiveTab(item.id); setIsMobileSidebarOpen(false); }} 
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-200 font-bold uppercase text-[10px] tracking-widest whitespace-nowrap
                ${activeTab === item.id ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'}`}>
              <item.icon size={20} strokeWidth={2.5} className="shrink-0" />
              <span className={`transition-all duration-300 ${isMobileSidebarOpen ? 'opacity-100 translate-x-0' : 'md:opacity-0 md:-translate-x-4 md:group-hover:opacity-100 md:group-hover:translate-x-0'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100 flex items-center justify-between px-2 overflow-hidden">
          <div className={`flex items-center gap-4 transition-all duration-300 whitespace-nowrap ${isMobileSidebarOpen ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'}`}>
            <div className="w-10 h-10 rounded-full bg-zinc-100 border-2 border-white shadow-sm flex items-center justify-center font-black text-zinc-400 shrink-0">M</div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-black uppercase tracking-tight truncate">{user?.name || 'Manager'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className={`p-3 text-zinc-300 hover:text-red-500 transition-colors shrink-0 ${isMobileSidebarOpen ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'}`}>
            <X size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content dengan margin-left responsive */}
      <main 
        ref={mainRef}
        className="flex-1 md:ml-20 overflow-y-auto p-4 md:p-12 custom-scrollbar space-y-10 lg:space-y-16 mt-0 pt-16 md:pt-16"
      >
        {/* Toggle Button Mobile */}
        <button 
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden fixed top-6 left-6 z-50 bg-white p-3 rounded-2xl shadow-xl border border-zinc-200 text-zinc-900"
        >
          <Menu size={24} />
        </button>
        {activeTab !== 'staff' && (
          <section className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-12">
            <div className="text-center lg:text-left">
              <h2 className="text-4xl md:text-5xl font-black  uppercase tracking-tighter text-zinc-900 leading-none">
                {activeTab === 'performance' ? 'Kinerja Tim' : activeTab === 'financial' ? 'Invoice Pelanggan' : activeTab === 'wo_tracking' ? 'Tracking Pengerjaan' : activeTab === 'vehicles' ? 'Data Kendaraan' : activeTab === 'staff' ? 'Manajemen Staff' : activeTab === 'booking_mgmt' ? 'Booking Management' : activeTab === 'holidays' ? 'Libur Dealer' : 'Riwayat CRO'}
              </h2>
            </div>
            <div className="flex flex-col gap-4 w-full lg:w-auto">
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 bg-white p-2 rounded-3xl lg:rounded-[2rem] border border-zinc-200 shadow-xl w-full lg:w-auto">
                {['today', 'this_month', 'year', 'custom', 'all'].map(t => (
                  <button
                    key={t} onClick={() => setTimeFilter(t)}
                    className={`px-4 lg:px-6 py-3 lg:py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === t ? 'bg-zinc-900 text-white shadow-lg scale-[1.05]' : 'text-zinc-400 hover:text-zinc-900'}`}
                  >
                    {t === 'today' ? 'Hari Ini' : t === 'this_month' ? 'Bulan Ini' : t === 'year' ? 'Tahunan' : t === 'custom' ? 'Kustom' : 'Semua'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 animate-in">
                {timeFilter === 'year' && (
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-zinc-100 shadow-sm">
                    <Calendar size={14} className="text-zinc-400" />
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="text-[11px] font-black uppercase outline-none cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
                {timeFilter === 'custom' && (
                  <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border-2 border-zinc-200 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-zinc-400">DARI:</span>
                      <input type="date" value={customRange.start} onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })} className="text-[10px] font-black outline-none bg-transparent" />
                    </div>
                    <div className="w-px h-4 bg-zinc-200 mx-2"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-zinc-400">KE:</span>
                      <input type="date" value={customRange.end} onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })} className="text-[10px] font-black outline-none bg-transparent" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Status Indicators */}
        {activeTab !== 'cro_history' && activeTab !== 'staff' && activeTab !== 'booking_mgmt' && activeTab !== 'holidays' && activeTab !== 'vehicles' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in">
            {activeTab === 'wo_tracking' ? (
              [
                { l: 'Total WO', v: stats.totalWo, i: Activity, c: 'text-zinc-600', b: 'bg-zinc-50' },
                { l: 'WO EUR', v: stats.eurCount, i: ShieldCheck, c: 'text-blue-600', b: 'bg-blue-50' },
                { l: 'WO IFS', v: stats.ifsCount, i: Star, c: 'text-orange-600', b: 'bg-orange-50' },
                { l: 'WO IKC', v: stats.ikcCount, i: Zap, c: 'text-emerald-600', b: 'bg-emerald-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-zinc-200 shadow-sm hover:translate-y-[-4px] transition-all duration-300 flex flex-col gap-6 group">
                  <div className={`w-12 h-12 md:w-14 md:h-14 ${s.b} ${s.c} rounded-2xl flex items-center justify-center shadow-sm group-hover:rotate-6 transition-transform`}><s.i size={24} strokeWidth={2.5} /></div>
                  <div><p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">{s.l}</p><p className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter leading-none tabular-nums">{s.v}</p></div>
                </div>
              ))
            ) : activeTab === 'performance' ? (
              [
                { l: 'Mobil Selesai', v: stats.selesaiCount, i: CheckCircle, c: 'text-emerald-600', b: 'bg-emerald-50' },
                { l: 'Proses Pengerjaan', v: stats.workingCount, i: Wrench, c: 'text-blue-600', b: 'bg-blue-50' },
                { l: 'Mobil Menginap', v: stats.overnightCount, i: Moon, c: 'text-zinc-600', b: 'bg-zinc-50' },
                { l: 'Antrian Tunggu', v: stats.waitingCount, i: Clock, c: 'text-orange-600', b: 'bg-orange-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-zinc-200 shadow-sm hover:translate-y-[-4px] transition-all duration-300 flex flex-col gap-6 group">
                  <div className={`w-12 h-12 md:w-14 md:h-14 ${s.b} ${s.c} rounded-2xl flex items-center justify-center shadow-sm group-hover:rotate-6 transition-transform`}><s.i size={24} strokeWidth={2.5} /></div>
                  <div><p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">{s.l}</p><p className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter leading-none tabular-nums">{s.v}</p></div>
                </div>
              ))
            ) : (
              [
                { l: 'Total Jasa (Fee)', v: formatCurrency(financialSummary.jasa), i: Wrench, c: 'text-blue-600', b: 'bg-blue-50' },
                { l: 'Total Sparepart', v: formatCurrency(financialSummary.s_part), i: Package, c: 'text-orange-600', b: 'bg-orange-50' },
                { l: 'Grand Total Revenue', v: formatCurrency(financialSummary.grandTotal), i: DollarSign, c: 'text-emerald-600', b: 'bg-emerald-50' },
                { l: 'Total WO (Unit)', v: (sortedFinancialData?.length || 0), i: Activity, c: 'text-zinc-600', b: 'bg-zinc-50' }
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-zinc-200 shadow-sm hover:translate-y-[-4px] transition-all duration-300 flex flex-col gap-6 group">
                  <div className={`w-12 h-12 md:w-14 md:h-14 ${s.b} ${s.c} rounded-2xl flex items-center justify-center shadow-sm group-hover:rotate-6 transition-transform`}><s.i size={24} strokeWidth={2.5} /></div>
                  <div><p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">{s.l}</p><p className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter leading-none tabular-nums">{s.v}</p></div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dynamic Tab Content */}
        <section className="animate-in">
          {activeTab === 'booking_mgmt' && (
            <div className="h-[calc(100vh-250px)]">
              <CroBookingPanel user={user} />
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="animate-in">
              <HolidaySettings user={user} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-12">
              <div className="bg-zinc-900 p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-bl-full -z-0"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-12">
                  <div><h3 className="text-2xl md:text-3xl font-black text-red-500 uppercase tracking-tighter mb-2">Tren Pendapatan Bulanan</h3><p className="text-zinc-500 text-[10px] font-black tracking-[0.5em] uppercase">Analisis Historis Kumulatif</p></div>
                </div>
                <div className="relative w-full h-[300px] md:h-[450px]">
                  {financialData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/10 rounded-[3rem] text-white font-black  uppercase tracking-[0.5em]">Belum ada data visualisasi</div>
                  ) : (
                    <ReactApexChart
                      options={{
                        legend: {
                          show: true,
                          position: 'top',
                          horizontalAlign: 'right',
                          labels: { colors: '#ffffff' },
                          fontFamily: 'Inter',
                          fontWeight: 900,
                          itemMargin: { horizontal: 20 }
                        },
                        chart: { type: 'area', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
                        colors: ['#2563eb', '#ea580c', '#dc2626'],
                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 90, 100] } },
                        dataLabels: { enabled: false },
                        stroke: { curve: 'smooth', width: 4 },
                        xaxis: { categories: monthlyChartData.categories, labels: { style: { colors: '#71717a', fontWeight: 900, fontFamily: 'Inter' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                        yaxis: { labels: { style: { colors: '#71717a', fontWeight: 900 }, formatter: (val) => formatCurrency(val) } },
                        grid: { borderColor: '#27272a', strokeDashArray: 4 },
                        tooltip: { theme: 'dark', x: { show: true } }
                      }}
                      series={monthlyChartData.series}
                      type="area"
                      height="100%"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border-2 border-zinc-200 shadow-2xl relative group">
                  <h3 className="text-xl md:text-2xl font-black text-zinc-900 uppercase tracking-tighter mb-8 md:mb-10 flex items-center gap-4"><Award className="text-red-600" size={28} /> Top Performance SA</h3>
                  <div className="space-y-4">
                    {revenueLeaders.saArr.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex justify-between items-center p-4 md:p-6 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 hover:scale-[1.02] transition-all hover:bg-white hover:shadow-xl">
                        <div className="flex items-center gap-4 md:gap-6">
                          <span className="text-[10px] font-black text-zinc-300">#{i + 1}</span>
                          <div>
                            <span className="text-sm md:text-lg font-black uppercase tracking-tight block">{s.name}</span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{s.count} UNIT DITANGANI</span>
                          </div>
                        </div>
                        <span className="text-base md:text-xl font-black text-red-600 tabular-nums">{formatCurrency(s.totalJasa)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border-2 border-zinc-200 shadow-2xl relative group">
                  <h3 className="text-xl md:text-2xl font-black text-zinc-900 uppercase tracking-tighter mb-8 md:mb-10 flex items-center gap-4"><Star className="text-blue-600" size={28} /> Lead Mechanic</h3>
                  <div className="space-y-4">
                    {revenueLeaders.mechArr.slice(0, 5).map((m, i) => (
                      <div key={i} className="flex justify-between items-center p-4 md:p-6 bg-zinc-50 rounded-2xl md:rounded-3xl border border-zinc-100 hover:scale-[1.02] transition-all hover:bg-white hover:shadow-xl">
                        <div className="flex items-center gap-4 md:gap-6">
                          <span className="text-[10px] font-black text-zinc-300">#{i + 1}</span>
                          <div>
                            <span className="text-sm md:text-lg font-black uppercase tracking-tight block">{m.name}</span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{m.count} UNIT SELESAI</span>
                          </div>
                        </div>
                        <span className="text-base md:text-xl font-black text-blue-600 tabular-nums">{formatCurrency(m.totalJasa)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden animate-in">
              <div className="p-6 md:p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-6 md:gap-10">
                <div><h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-center md:text-left">Audit Transaksi Workshop</h3><p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] mt-2 text-center md:text-left">Data Finansial Service Operasional</p></div>
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full xl:w-auto">
                  <input type="file" id="import-revenue-btn" className="hidden" accept=".xlsx, .xls" onChange={handleWorkshopUpload} />
                  <label htmlFor="import-revenue-btn" className="w-full md:w-auto bg-red-600 text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4">
                    <Upload size={18} /> Import Invoice Pelanggan
                  </label>
                  <div className="flex bg-zinc-100 p-2 rounded-2xl md:rounded-3xl border border-zinc-200 shadow-inner w-full md:w-auto overflow-x-auto no-scrollbar">
                    {['all', 'EUR', 'IFS', 'IKC'].map(e => (
                      <button key={e} onClick={() => setEntityFilter(e)} className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${entityFilter === e ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-400'}`}>{e === 'all' ? 'SEMUA' : e}</button>
                    ))}
                  </div>
                  <div className="relative w-full xl:min-w-[400px]">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari WO atau No Polisi..." className="pl-14 pr-8 py-5 bg-white border-2 border-zinc-200 rounded-3xl text-[12px] font-black focus:border-zinc-900 transition-all w-full uppercase shadow-sm " />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left font-black uppercase min-w-[1000px] ">
                  <thead>
                    <tr className="bg-zinc-100/30 text-[10px] text-zinc-600 tracking-[0.2em] border-b border-zinc-200 font-black">
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('no_wo')}>Karakteristik Order {sortConfig.key === 'no_wo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('sa')}>Tim Operasional {sortConfig.key === 'sa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 text-right text-blue-600 cursor-pointer" onClick={() => requestSort('jasa')}>Jasa Service {sortConfig.key === 'jasa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 text-right text-orange-600 cursor-pointer" onClick={() => requestSort('s_part')}>Sparepart {sortConfig.key === 's_part' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 text-right underline decoration-4 decoration-zinc-100 cursor-pointer" onClick={() => requestSort('g_total')}>Total Akhir {sortConfig.key === 'g_total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-zinc-50">
                    {sortedFinancialData.slice((financialPage - 1) * rowsPerPage, financialPage * rowsPerPage).map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50/80 transition-all duration-300 font-black uppercase group">
                        <td className="px-12 py-10">
                          <p className="text-[20px] text-zinc-900 tracking-tighter leading-none">{row.no_wo || 'N/A'}</p>
                          <p className="text-[12px] text-zinc-400 mt-2 tracking-widest leading-none flex items-center gap-2"><Calendar size={12} /> {formatDisplayDate(row.wkt_masuk)}</p>
                        </td>
                        <td className="px-12 py-10">
                          <p className="text-[16px] text-zinc-900 tracking-tight leading-none mb-4">{row.tipe_kendaraan || 'GENERAL SERVICE'}</p>
                          <div className="flex items-center gap-3"><span className="text-[10px] bg-zinc-100 px-3 py-1 rounded-lg text-zinc-400 font-black">SA: {row.sa || '---'}</span><span className="text-[10px] bg-blue-50 px-3 py-1 rounded-lg text-blue-600 font-black">MKN: {row.mekanik || '---'}</span></div>
                        </td>
                        <td className="px-12 py-10 text-right text-blue-600 font-black text-xl tabular-nums">{formatCurrency(row.jasa)}</td>
                        <td className="px-12 py-10 text-right text-orange-600 font-black text-xl tabular-nums">{formatCurrency(row.s_part)}</td>
                        <td className="px-12 py-10 text-right font-black text-3xl tabular-nums">{formatCurrency(row.g_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-12 border-t-2 border-zinc-100 flex flex-col md:flex-row justify-between items-center bg-zinc-50/20 gap-8">
                <p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest  whitespace-nowrap">Halaman {financialPage} dari {Math.ceil(sortedFinancialData.length / rowsPerPage)}</p>
                <p className="text-[11px] font-black uppercase text-zinc-900 tracking-widest flex items-center gap-3"><Activity size={18} className="text-red-600" /> TOTAL: {sortedFinancialData.length} UNIT DATA</p>
                <div className="flex gap-4">
                  <button disabled={financialPage === 1} onClick={() => setFinancialPage(p => p - 1)} className={`px-12 py-5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all ${financialPage === 1 ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white shadow-2xl hover:scale-105 active:scale-95'}`}>Prev</button>
                  <button disabled={financialPage * rowsPerPage >= sortedFinancialData.length} onClick={() => setFinancialPage(p => p + 1)} className={`px-12 py-5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all ${financialPage * rowsPerPage >= sortedFinancialData.length ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white shadow-2xl hover:scale-105 active:scale-95'}`}>Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wo_tracking' && (
            <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden animate-in">
              <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-10">
                <div><h3 className="text-3xl font-black  uppercase tracking-tighter">Status Pengerjaan Workshop</h3><p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] mt-2 ">Realtime Workflow Monitoring</p></div>
                <div className="flex flex-col sm:flex-row items-center gap-8 w-full xl:w-auto">
                  <input type="file" id="import-tracking-btn" className="hidden" accept=".xlsx, .xls" onChange={handleWorkshopUpload} />
                  <label htmlFor="import-tracking-btn" className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] cursor-pointer shadow-2xl hover:bg-black hover:scale-110 active:scale-95 transition-all flex items-center gap-4">
                    <Upload size={20} /> Import Excel
                  </label>
                  <div className="flex bg-zinc-100 p-2 rounded-3xl border border-zinc-200 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                    {['all', 'Estimasi', 'On Progress', 'Ready', 'Closed', 'Open', 'Cancelled', 'Pre-Cancelled'].map(s => (
                      <button key={s} onClick={() => setWoStatusFilter(s)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${woStatusFilter === s ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>{s === 'all' ? 'SEMUA' : s}</button>
                    ))}
                  </div>
                  <div className="relative w-full xl:min-w-[400px]">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
                    <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari WO, Plat, Mekanik..." className="pl-18 pr-10 py-6 bg-white border-2 border-zinc-200 rounded-[2rem] text-sm font-black focus:border-zinc-900 shadow-sm uppercase  w-full" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-black uppercase ">
                  <thead>
                    <tr className="bg-zinc-100/30 text-[11px] text-zinc-600 tracking-[0.2em] border-b border-zinc-200 uppercase font-black">
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('no_wo')}>No. WO / Plat {sortConfig.key === 'no_wo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('sa')}>Team Support {sortConfig.key === 'sa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 cursor-pointer hover:text-zinc-900" onClick={() => requestSort('wkt_masuk')}>Waktu Masuk {sortConfig.key === 'wkt_masuk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-12 py-8 text-right underline cursor-pointer" onClick={() => requestSort('wkt_estimasi')}>Estimasi Selesai {sortConfig.key === 'wkt_estimasi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-zinc-50">
                    {sortedWoTrackingData.slice((woTrackingPage - 1) * rowsPerPage, woTrackingPage * rowsPerPage).map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50/80 transition-all duration-300 font-black uppercase group">
                        <td className="px-12 py-10">
                          <p className="text-[20px] text-zinc-900 tracking-tighter leading-none">{row.no_wo || 'N/A'}</p>
                          <p className="text-[12px] text-zinc-400 mt-3 font-bold px-3 py-1 bg-zinc-100 rounded-lg w-max tracking-widest">{row.no_pol || '---'}</p>
                        </td>
                        <td className="px-12 py-10">
                          <span className={`px-8 py-3 rounded-2xl text-[11px] font-black border-2 shadow-xl ${(row.status || '').toLowerCase().includes('selesai') || (row.status || '').toLowerCase().includes('ready') || (row.status || '').toLowerCase().includes('closed') ? 'bg-green-600 text-white border-green-500 shadow-green-100' : (row.status || '').toLowerCase().includes('on progress') ? 'bg-blue-600 text-white border-blue-500 shadow-blue-100' : 'bg-orange-500 text-white border-orange-400 shadow-orange-100'}`}>{row.status || 'PROSES'}</span>
                        </td>
                        <td className="px-12 py-10">
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-zinc-400"></div> <span className="text-[14px]">{row.sa || '---'} (SA)</span></div>
                            <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500"></div> <span className="text-[14px]">{row.mekanik || '---'} (MKN)</span></div>
                          </div>
                        </td>
                        <td className="px-12 py-10 text-[14px] text-zinc-600 tabular-nums">{formatDisplayDate(row.wkt_masuk || row.wktmasuk)}</td>
                        <td className="px-12 py-10 text-right"><span className="bg-zinc-900 text-white px-8 py-4 rounded-[1.2rem] text-[12px] shadow-2xl tabular-nums inline-block border border-zinc-700 font-black">{formatDisplayDate(row.wkt_estimasi || row.wktestimasi)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-12 border-t-2 border-zinc-100 flex flex-col md:flex-row justify-between items-center bg-zinc-50/20 gap-8">
                <div className="flex items-center gap-6">
                  <p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest  whitespace-nowrap">Tampilkan:</p>
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(parseInt(e.target.value))} className="bg-white border-2 border-zinc-200 rounded-2xl px-6 py-3 text-xs font-black outline-none focus:border-zinc-900 cursor-pointer shadow-sm">
                    <option value={10}>10 Baris</option><option value={20}>20 Baris</option><option value={40}>40 Baris</option><option value={100}>100 Baris</option>
                  </select>
                  <p className="text-[11px] font-black uppercase text-zinc-900 tracking-widest  ml-4 flex items-center gap-3"><Activity size={18} className="text-red-600" /> TOTAL: {sortedWoTrackingData.length} UNIT DATA</p>
                </div>
                <div className="flex gap-4">
                  <button disabled={woTrackingPage === 1} onClick={() => setWoTrackingPage(p => p - 1)} className={`px-12 py-5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all ${woTrackingPage === 1 ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white shadow-2xl hover:scale-105 active:scale-95'}`}>Prev</button>
                  <button disabled={woTrackingPage * rowsPerPage >= sortedWoTrackingData.length} onClick={() => setWoTrackingPage(p => p + 1)} className={`px-12 py-5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all ${woTrackingPage * rowsPerPage >= sortedWoTrackingData.length ? 'opacity-30 cursor-not-allowed text-zinc-300' : 'bg-zinc-900 text-white shadow-2xl hover:scale-105 active:scale-95'}`}>Next</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden animate-in">
              <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row justify-between items-center gap-10">
                <h3 className="text-3xl font-black  uppercase tracking-tighter">Database Frekuensi Kendaraan</h3>
                <div className="relative group">
                  <Search size={22} className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-zinc-900" />
                  <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Masukkan No Plat..." className="pl-18 pr-10 py-6 bg-white border-2 border-zinc-200 rounded-[2rem] text-sm font-black focus:border-zinc-900 w-full md:min-w-[450px] shadow-sm uppercase " />
                </div>
              </div>
              <div className="p-6 md:p-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 font-black uppercase ">
                  {vehicleLeaderboard.filter(v => v.bk.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 18).map((car, i) => (
                    <div key={i} onClick={() => setSelectedVehicle(car.bk)} className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 hover:border-zinc-900 hover:bg-white hover:shadow-2xl transition-all cursor-pointer group transform hover:-translate-y-2 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-8 md:mb-12 relative z-10">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-900 text-white rounded-xl flex items-center justify-center text-lg md:text-xl shadow-2xl ">#{i + 1}</div>
                        <div className="px-4 py-2 md:px-6 md:py-3 bg-zinc-900 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] shadow-lg tracking-widest border border-zinc-800">{car.count} KUNJUNGAN</div>
                      </div>
                      <p className="text-3xl md:text-4xl tracking-tighter mb-1 leading-none relative z-10 font-black">{car.bk}</p>
                      <p className="text-[10px] md:text-[11px] text-zinc-400 tracking-[0.4em] relative z-10">{car.tipe}</p>
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-zinc-100/50 rounded-full group-hover:bg-zinc-900/5 transition-colors"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cro_history' && (
            <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden min-h-[600px] animate-in">
              <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col xl:flex-row justify-between items-center gap-10">
                <div><h3 className="text-3xl font-black  uppercase tracking-tighter">Riwayat Follow Up Customer</h3><p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] mt-2 ">Data hasil respon customer CRO</p></div>
                <div className="relative w-full xl:min-w-[500px]">
                  <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
                  <input type="text" value={searchTerm} onChange={x => setSearchTerm(x.target.value)} placeholder="Cari Nama, Plat, atau Respon..." className="pl-18 pr-10 py-6 bg-white border-2 border-zinc-200 rounded-[2rem] text-sm font-black focus:border-zinc-900 transition-all w-full uppercase shadow-sm" />
                </div>
              </div>
              <div className="p-4 md:p-8">
                {isLoading ? (
                  <div className="py-24 text-center text-zinc-400 font-bold  animate-pulse">Memuat Data...</div>
                ) : croHistory.length === 0 ? (
                  <div className="py-24 text-center text-zinc-400 font-bold ">Belum ada riwayat follow up.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {croHistory.filter(item => {
                      const s = searchTerm.toLowerCase();
                      return !s || (item.nama || '').toLowerCase().includes(s) || (item.plat || '').toLowerCase().includes(s) || (item.respon || '').toLowerCase().includes(s);
                    }).map((item, idx) => (
                      <div key={idx} className="bg-white border-2 border-zinc-100 rounded-[2.5rem] p-8 shadow-xl shadow-zinc-100/50 hover:shadow-2xl transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-[4rem] -z-10 group-hover:scale-110 transition-transform"></div>
                        <div className="flex justify-between items-start mb-6">
                          <div className="px-5 py-2 bg-zinc-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-zinc-200">{item.plat}</div>
                          <div className="text-[10px] font-bold text-zinc-400 px-3 py-1 bg-zinc-100 rounded-lg">{item.tanggalFollowUp}</div>
                        </div>
                        {(item.lampiran || item.foto) && (
                          <div
                            className="mb-6 w-full h-48 rounded-3xl overflow-hidden border-2 border-zinc-50 shadow-inner group-hover:scale-[1.02] transition-transform duration-500 cursor-zoom-in"
                            onClick={() => setPreviewImage(item.lampiran || item.foto)}
                          >
                            <img src={item.lampiran || item.foto} alt="Foto CRO" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h4 className="font-black text-2xl text-zinc-900 mb-1 tracking-tight">{item.nama}</h4>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">{item.tipeMobil}</p>
                        <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 relative group-hover:bg-white transition-colors duration-500">
                          <p className="text-sm font-bold text-zinc-700 leading-relaxed  line-clamp-4">"{item.respon || 'Tidak ada respon tertulis.'}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white rounded-[4rem] border-2 border-zinc-200 shadow-3xl overflow-hidden animate-in">
              <div className="p-12 border-b-2 border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row justify-between items-center gap-8 font-black uppercase">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Manajemen Staff</h3>
                  <p className="text-[10px] font-black text-zinc-400 tracking-[0.4em] mt-2 ">Kelola Akses User Bengkel</p>
                </div>
                <button
                  onClick={() => { setUserFormData({ username: '', password: '', name: '', role: 'mekanik' }); setIsUserModalOpen(true); }}
                  className="px-10 py-5 bg-zinc-900 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                >
                  Tambah Staf Baru
                </button>
              </div>
              <div className="max-h-[600px] overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse font-black uppercase min-w-[800px]">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="bg-zinc-50/80 text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] backdrop-blur-md">
                      <th className="px-12 py-8">Nama Lengkap</th>
                      <th className="px-12 py-8">User ID</th>
                      <th className="px-12 py-8">Role / Akses</th>
                      <th className="px-12 py-8 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-zinc-50">
                    {usersData.length === 0 ? (
                      <tr><td colSpan="4" className="px-12 py-20 text-center text-zinc-400 italic font-medium uppercase tracking-[0.2em]">Belum ada data staf / Loading...</td></tr>
                    ) : (
                      usersData.map((u, i) => (
                        <tr key={i} className="hover:bg-zinc-50 transition-all font-black uppercase">
                          <td className="px-12 py-10 flex items-center gap-4 text-zinc-900">
                            <div className="w-10 h-10 bg-zinc-900 text-white flex items-center justify-center rounded-xl text-lg">{u.name?.charAt(0)}</div>
                            <div><p className="text-lg">{u.name}</p></div>
                          </td>
                          <td className="px-12 py-10 text-zinc-400">{u.username}</td>
                          <td className="px-12 py-10">
                            <span className={`px-4 py-2 rounded-lg text-[10px] ${u.role === 'admin' ? 'bg-red-50 text-red-600' : u.role === 'mekanik' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{u.role}</span>
                          </td>
                          <td className="px-12 py-10 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => { setUserFormData({ ...u, password: '' }); setIsUserModalOpen(true); }} className="p-3 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-zinc-900 hover:text-white transition-all"><Settings size={16} /></button>
                              <button onClick={() => handleDeleteUser(u.username)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><X size={16} /></button>
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm animate-in">
              <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl font-black uppercase">
                <div className="p-10 bg-zinc-900 text-white flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Profil Staf</h3>
                  <button onClick={() => setIsUserModalOpen(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleUpsertUser} className="p-10 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Nama Lengkap</label>
                    <input required value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-100 p-5 rounded-2xl font-black uppercase outline-none focus:border-zinc-900 transition-all" placeholder="Contoh: Budi Santoso" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Username</label>
                      <input required value={userFormData.username} onChange={e => setUserFormData({ ...userFormData, username: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-100 p-5 rounded-2xl font-black outline-none focus:border-zinc-900 transition-all uppercase" placeholder="userid" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Password</label>
                      <input value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-100 p-5 rounded-2xl font-black outline-none focus:border-zinc-900 transition-all" type="password" placeholder="••••••••" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Role / Hak Akses</label>
                    <select value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })} className="w-full bg-zinc-50 border-2 border-zinc-100 p-5 rounded-2xl font-black uppercase outline-none focus:border-zinc-900 transition-all appearance-none cursor-pointer">
                      <option value="admin">Admin Service</option>
                      <option value="mekanik">Mekanik Bengkel</option>
                      <option value="sparepart">Sparepart Staff</option>
                      <option value="cro">Customer Relation (CRO)</option>
                      <option value="manager">Manager Hub</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white p-6 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                    {isLoading ? 'Processing...' : 'Simpan Data Staf'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Overlays */}

      {selectedVehicle && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-3xl" onClick={() => setSelectedVehicle(null)}></div>
          <div className="bg-white w-full max-w-5xl rounded-[5rem] shadow-3xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in border-4 border-white">
            <div className="p-16 border-b-2 border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-10">
                <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl text-red-500 scale-110"><Car size={48} /></div>
                <div>
                  <h3 className="text-6xl font-black  tracking-tighter leading-none mb-3 underline decoration-red-500 underline-offset-8 decoration-4">{selectedVehicle}</h3>
                  <p className="text-[12px] font-black uppercase text-zinc-400 tracking-[0.5em] mt-4">Audit Riwayat Servis Kendaraan</p>
                </div>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="w-20 h-20 border-2 border-zinc-200 rounded-[2rem] hover:bg-black hover:text-white transition-all flex items-center justify-center shadow-xl group">
                <X size={36} className="group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-16 custom-scrollbar font-black uppercase ">
              <div className="space-y-10">
                {rawHistory.filter(h => h.bk === selectedVehicle).sort((a, b) => parseDateToTimestamp(b.id) - parseDateToTimestamp(a.id)).map((v, i) => (
                  <div key={i} className="bg-zinc-50 border-2 border-zinc-100 rounded-[3.5rem] p-12 flex flex-col md:flex-row items-center gap-16 group hover:bg-white transition-all hover:shadow-2xl hover:border-zinc-300">
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-400 mb-3 tracking-[0.3em] font-black underline underline-offset-4 decoration-zinc-100 ">Waktu Kedatangan</p>
                      <p className="text-3xl tracking-tighter text-zinc-900 font-black">{formatDisplayDate(v.id)}</p>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-[12px] text-zinc-400 mb-2 tracking-[0.3em] font-black ">Operasional Hub</p>
                      <p className="text-sm font-black">Mekanik Lead: <span className="text-blue-600">{v.mechanicName || 'N/A'}</span></p>
                      <p className="text-sm font-black text-zinc-500">Admin Input: {v.addedBy || 'CORE_SYSTEM'}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-zinc-400 mb-2 tracking-[0.3em] font-black uppercase">Status</p>
                      <p className="text-lg font-black text-zinc-900 leading-tight">{v.keluhan || '---'}</p>
                    </div>
                    <div className="shrink-0"><span className="bg-zinc-900 text-white px-10 py-5 rounded-[1.8rem] text-[11px] shadow-2xl tracking-[0.4em] border-2 border-zinc-700 ">RIWAYAT TERVALIDASI</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-12 border-t-2 border-zinc-100 text-center uppercase tracking-[1em] text-[11px] font-black text-zinc-300 bg-zinc-50/50  animate-pulse">Integritas Data Terjamin</div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #F8F9FC; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #18181b; border-radius: 10px; }
        @keyframes slideUp { from { transform: translateY(60px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-in { animation: slideUp 1s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
      `}</style>
      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-10 animate-in fade-in" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-10 right-10 p-5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-xl border border-white/10"><X size={32} /></button>
          <div className="flex-1 flex items-center justify-center p-10" onClick={e => e.stopPropagation()}>
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_100px_rgba(255,255,255,0.1)] border-4 border-white/10" alt="Preview HD" />
          </div>
          <p className="text-center text-white/40 font-black uppercase text-[10px] tracking-[0.5em] pb-10 ">Ketuk di mana saja untuk menutup</p>
        </div>
      )}
    </div>
  );
};

export default ManagerPanel;
