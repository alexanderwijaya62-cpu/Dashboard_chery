import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Edit, FileText, Filter, Phone, RefreshCw, Search, Trash2, Truck, X, XCircle, Database, Settings, RefreshCcw } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import BookingSettings from './BookingSettings';
import { db } from '../utils/dbClient';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';

const STATUS_STYLES = {
  'Baru': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'Aktif': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Mengantri': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Expired': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Batal': { bg: 'bg-zinc-100', text: 'text-zinc-500', border: 'border-zinc-200' },
  'Selesai': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

const getStatusStyle = (status) => {
  if (!status) return { bg: 'bg-zinc-50', text: 'text-zinc-500', border: 'border-zinc-200' };
  const s = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return STATUS_STYLES[s] || { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200' };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function DmsBookingListView({ user, refreshTrigger }) {
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);

  const [supabaseData, setSupabaseData] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const hasActiveFilters = statusFilter || dateFrom || dateTo;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        endpoint: 'booking-data',
        draw: 1,
        start: page * pageSize,
        length: pageSize,
        search: search,
        status: statusFilter,
        datefrom: dateFrom,
        dateto: dateTo,
      });
      const res = await fetch(`/api/chery_dms?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setTotalRecords(json.recordsFiltered || json.recordsTotal || json.data.length);
      } else {
        setData(json.data || []);
        setTotalRecords(json.recordsTotal || 0);
      }
    } catch (err) {
      setError(err.message);
      Toastify({ text: `Gagal fetch data DMS: ${err.message}`, background: 'red' }).showToast();
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, dateFrom, dateTo, refreshTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const filters = {
          select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, noUrut, vin',
          order: { column: 'id', ascending: false },
          limit: 10,
        };
        if (dateFrom) filters.gte = { tanggal: dateFrom };
        if (dateTo) filters.lte = { tanggal: dateTo };
        const { data } = await db.select('booking', filters);
        setSupabaseData(data || []);
      } catch (e) {
        console.error('Gagal fetch local bookings:', e);
      }
    })();
  }, [refreshTrigger, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const normalizedSupabase = useMemo(() => {
    return supabaseData.map(b => ({
      _source: 'local',
      _id: b.id,
      no_booking: `SB-${b.id}`,
      status_booking: b.status === 'waiting confirm' ? 'Baru' : b.status === 'accepted' ? 'Aktif' : b.status === 'completed' ? 'Selesai' : b.status === 'cancelled' ? 'Batal' : b.status || '-',
      nama_pelanggan: b.namaCustomer || '-',
      no_polisi: b.noPlat || '-',
      nama_kendaraan: b.tipeMobil || '-',
      janji_datang: b.tanggal ? `${b.tanggal} ${(b.jam || '').replace('.', ':') || '00:00'}:00` : '-',
      booking_via: b.bookingVia || '-',
      dibuat_oleh: b.bookingVia || '-',
      no_chassis: b.vin || '-',
      km: b.km || '-',
      atas_nama_booking: b.namaCustomer || '-',
      no_telp_booking: b.noTelp || '-',
      keluhan: b.keperluanService || '-',
      created_at: b.tanggal,
    }));
  }, [supabaseData]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSearchInput('');
    setPage(0);
  };

  const handleSyncBooking = async (row) => {
    const syncKey = row.no_booking || row.id_booking;
    if (!syncKey) return;
    setSyncingId(syncKey);
    try {
      const noPlat = (row.no_polisi || '').replace(/\s+/g, '').toUpperCase();
      const janji = row.janji_datang || '';
      const tanggal = janji.split(' ')[0] || '';
      const { data: existing } = await db.select('booking', {
        eq: { noPlat: row.no_polisi },
        limit: 50,
      });
      const match = (existing || []).find(b => {
        const d = (b.tanggal || '').substring(0, 10);
        return d === tanggal && b.namaCustomer === row.nama_pelanggan;
      });
      if (match) {
        Toastify({ text: `Booking ${syncKey} sudah ada di Supabase (ID: ${match.id})`, background: '#22c55e' }).showToast();
      } else {
        const jam = (janji.split(' ')[1] || '00:00').replace(':', '.');
        const { error } = await db.insert('booking', {
          id: Date.now() + Math.floor(Math.random() * 1000),
          tanggal,
          jam,
          noPlat: row.no_polisi || '',
          namaCustomer: row.nama_pelanggan || '',
          noTelp: row.no_telp_booking || '',
          tipeMobil: row.nama_kendaraan || '',
          keperluanService: row.keluhan || '-',
          status: row.status_booking === 'Selesai' ? 'completed' : row.status_booking === 'Batal' ? 'cancelled' : 'accepted',
          bookingVia: `DMS Sync: ${row.booking_via || row.dibuat_oleh || '-'}`,
        });
        if (error) throw error;
        Toastify({ text: `Booking ${syncKey} berhasil disync ke Supabase!`, background: '#22c55e' }).showToast();
        const { data: refreshed } = await db.select('booking', {
          select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, noUrut, vin',
          order: { column: 'id', ascending: false },
          limit: 10,
        });
        setSupabaseData(refreshed || []);
      }
    } catch (e) {
      console.error('Sync error:', e);
      Toastify({ text: `Gagal sync: ${e.message}`, background: '#ef4444' }).showToast();
    } finally {
      setSyncingId(null);
    }
  };

  const handleReschedule = async (id, janjiBaru, alasan) => {
    try {
      const formData = new URLSearchParams();
      formData.set('janji_datang', janjiBaru);
      formData.set('alasan_reschedule', alasan);

      const res = await fetch(`/api/chery_dms?endpoint=booking-reschedule&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const json = await res.json();
      if (json.success) {
        Toastify({ text: '✅ Berhasil reschedule booking!', background: 'green' }).showToast();
        setRescheduleModal(null);
        fetchData();
      } else {
        Toastify({ text: `❌ Gagal: ${json.message}`, background: 'red' }).showToast();
      }
    } catch (err) {
      Toastify({ text: `❌ Error: ${err.message}`, background: 'red' }).showToast();
    }
  };

  const handleEditSubmit = async (id, formDataObj) => {
    try {
      const formData = new URLSearchParams();
      Object.entries(formDataObj).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.set(k, v);
      });

      const res = await fetch(`/api/chery_dms?endpoint=booking-edit&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const json = await res.json();
      if (json.success) {
        Toastify({ text: '✅ Booking berhasil diedit!', background: 'green' }).showToast();
        setEditModal(null);
        fetchData();
      } else {
        Toastify({ text: `❌ Gagal: ${json.message}`, background: 'red' }).showToast();
      }
    } catch (err) {
      Toastify({ text: `❌ Error: ${err.message}`, background: 'red' }).showToast();
    }
  };

  const handleCancel = async (id, alasan) => {
    try {
      const formData = new URLSearchParams();
      formData.set('alasan_pembatalan', alasan);
      formData.set('dibatalkan_oleh', user?.name || 'Unknown');

      const res = await fetch(`/api/chery_dms?endpoint=booking-cancel&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const json = await res.json();
      if (json.success) {
        Toastify({ text: '✅ Booking berhasil dibatalkan!', background: 'green' }).showToast();
        setCancelModal(null);
        fetchData();
      } else {
        Toastify({ text: `❌ Gagal: ${json.message}`, background: 'red' }).showToast();
      }
    } catch (err) {
      Toastify({ text: `❌ Error: ${err.message}`, background: 'red' }).showToast();
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex flex-wrap items-center gap-2 shrink-0">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari no. booking, plat, nama..."
              className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52 text-zinc-900"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors">Cari</button>
        </form>

        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${showFilter || hasActiveFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
        >
          <Filter size={13} /> Filter {hasActiveFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />}
        </button>

        <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors" title="Pengaturan Slot Booking"><Settings size={14} /></button>
        <button onClick={fetchData} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors ml-auto">
          <RefreshCw size={14} className={`${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-zinc-400">{isLoading ? 'Memuat...' : `${totalRecords.toLocaleString()} booking`}</span>
      </div>

      {/* FILTER PANEL */}
      {showFilter && (
        <div className="bg-white border-b border-zinc-200 px-4 py-3 flex flex-wrap items-end gap-3 shrink-0">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
              className="text-sm px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Semua</option>
              <option value="Baru">Baru</option>
              <option value="Aktif">Aktif</option>
              <option value="Mengantri">Mengantri</option>
              <option value="Selesai">Selesai</option>
              <option value="Expired">Expired</option>
              <option value="Batal">Batal</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Dari</label>
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="text-sm px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sampai</label>
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="text-sm px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors">
              <X size={13} /> Reset
            </button>
          )}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={fetchData} className="text-sm font-semibold text-red-700 hover:text-red-900 border border-red-200 px-3 py-1 rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* TABLE */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400">Memuat data...</p>
          </div>
        ) : data.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Calendar size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada data</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="w-10"></th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Booking</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Pelanggan</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">No. Polisi</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Kendaraan</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Janji Datang</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Via</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Dibuat Oleh</th>
                    <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.map((row, i) => {
                    const isExp = expandedRow === `dms_${i}`;
                    const s = getStatusStyle(row.status_booking);
                    const rowKey = row.no_booking || i;
                    return (
                      <React.Fragment key={`dms_${rowKey}`}>
                        <tr
                          className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isExp ? 'bg-zinc-50' : ''}`}
                          onClick={() => setExpandedRow(isExp ? null : `dms_${i}`)}
                        >
                          <td className="pl-3 pr-1 py-3 text-zinc-400">
                            {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap text-sm">{row.no_booking || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
                              {row.status_booking || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-sm max-w-[160px] truncate">{row.nama_pelanggan || '-'}</td>
                          <td className="px-4 py-3 font-mono text-zinc-700 whitespace-nowrap text-sm">{row.no_polisi || '-'}</td>
                          <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-sm max-w-[160px] truncate">{row.nama_kendaraan || '-'}</td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">{formatDateShort(row.janji_datang)}</td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">{row.booking_via || '-'}</td>
                          <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-sm">{row.dibuat_oleh || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleSyncBooking(row)}
                                disabled={syncingId === row.no_booking}
                                className="p-1.5 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all disabled:opacity-50"
                                title="Sync ke Supabase"
                              >
                                {syncingId === row.no_booking ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                              </button>
                              <button
                                onClick={() => setRescheduleModal(row)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:bg-blue-50 hover:text-blue-700 transition-all"
                                title="Reschedule"
                              >
                                <Calendar size={14} />
                              </button>
                              <button
                                onClick={() => setEditModal(row)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => setCancelModal(row)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700 transition-all"
                                title="Batalkan"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDED DETAIL */}
                        {isExp && (
                          <tr className="bg-zinc-50 border-b border-zinc-200">
                            <td colSpan={10} className="px-6 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                    <Truck size={12} /> Kendaraan
                                  </p>
                                  <div className="space-y-1.5">
                                    {[['Chassis', row.no_chassis], ['KM', row.km ? `${row.km} km` : '-'], ['Atas Nama', row.atas_nama_booking || '-'], ['No. Telp', row.no_telp_booking || '-']].map(([label, val]) => (
                                      <div key={label} className="flex justify-between text-sm">
                                        <span className="text-zinc-400 font-medium">{label}</span>
                                        <span className="text-zinc-800 font-semibold">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                    <FileText size={12} /> Detail Booking
                                  </p>
                                  <div className="space-y-1.5">
                                    {[
                                      ['Booking Via', row.booking_via || '-'],
                                      ['Dibuat Oleh', row.dibuat_oleh || '-'],
                                      ['Keluhan', row.keluhan || '-'],
                                      ['Actual Datang', formatDate(row.actual_datang)],
                                    ].map(([label, val]) => (
                                      <div key={label} className="flex justify-between text-sm">
                                        <span className="text-zinc-400 font-medium">{label}</span>
                                        <span className="text-zinc-800 font-semibold max-w-[200px] truncate">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                    <Clock size={12} /> Timeline
                                  </p>
                                  <div className="space-y-1.5">
                                    {[
                                      ['Janji Datang', formatDate(row.janji_datang)],
                                      ['Waktu Selesai', formatDate(row.waktu_selesai)],
                                      ['Alasan Reschedule', row.alasan_reschedule || '-'],
                                      ['Created', formatDate(row.created_at)],
                                    ].map(([label, val]) => (
                                      <div key={label} className="flex justify-between text-sm">
                                        <span className="text-zinc-400 font-medium">{label}</span>
                                        <span className="text-zinc-800 font-semibold">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {row.status_booking === 'Batal' && (
                                    <div className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                                      <p className="text-xs font-bold text-red-700">Dibatalkan: {row.dibatalkan_oleh || '-'}</p>
                                      <p className="text-xs text-red-500 italic">Alasan: {row.alasan_pembatalan || '-'}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* MANUAL BOOKINGS FROM SUPABASE */}
                  {normalizedSupabase.length > 0 && (
                    <>
                      <tr className="bg-amber-50/50">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-700">
                            <Database size={14} /> Manual Bookings ({normalizedSupabase.length})
                          </div>
                        </td>
                      </tr>
                      {normalizedSupabase.map((row, i) => {
                        const isExp = expandedRow === `local_${i}`;
                        const s = getStatusStyle(row.status_booking);
                        return (
                          <React.Fragment key={`local_${row._id || i}`}>
                            <tr
                              className={`hover:bg-amber-50/50 transition-colors cursor-pointer ${isExp ? 'bg-amber-50/50' : ''}`}
                              onClick={() => setExpandedRow(isExp ? null : `local_${i}`)}
                            >
                              <td className="pl-3 pr-1 py-3 text-zinc-400">
                                {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </td>
                              <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap text-sm">
                                <span className="inline-flex items-center gap-1">
                                  {row.no_booking}
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Local</span>
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
                                  {row.status_booking || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-sm max-w-[160px] truncate">{row.nama_pelanggan || '-'}</td>
                              <td className="px-4 py-3 font-mono text-zinc-700 whitespace-nowrap text-sm">{row.no_polisi || '-'}</td>
                              <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-sm max-w-[160px] truncate">{row.nama_kendaraan || '-'}</td>
                              <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">{formatDateShort(row.janji_datang)}</td>
                              <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-sm">{row.booking_via || '-'}</td>
                              <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-sm">{row.dibuat_oleh || '-'}</td>
                              <td className="px-4 py-3 text-center text-xs text-zinc-400 font-bold">—</td>
                            </tr>
                            {isExp && (
                              <tr className="bg-amber-50/30 border-b border-zinc-200">
                                <td colSpan={10} className="px-6 py-5">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                        <Truck size={12} /> Kendaraan
                                      </p>
                                      <div className="space-y-1.5">
                                        {[['No Polisi', row.no_polisi], ['Model', row.nama_kendaraan], ['Atas Nama', row.atas_nama_booking], ['No. Telp', row.no_telp_booking]].map(([label, val]) => (
                                          <div key={label} className="flex justify-between text-sm">
                                            <span className="text-zinc-400 font-medium">{label}</span>
                                            <span className="text-zinc-800 font-semibold">{val}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
                                        <FileText size={12} /> Detail
                                      </p>
                                      <div className="space-y-1.5">
                                        {[['Via', row.booking_via], ['Keluhan', row.keluhan], ['Created', formatDate(row.created_at)]].map(([label, val]) => (
                                          <div key={label} className="flex justify-between text-sm">
                                            <span className="text-zinc-400 font-medium">{label}</span>
                                            <span className="text-zinc-800 font-semibold max-w-[200px] truncate">{val}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
          <p className="text-sm text-zinc-500">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRecords)} dari {totalRecords.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-semibold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isLoading}
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModal && (
        <RescheduleModal
          booking={rescheduleModal}
          onClose={() => setRescheduleModal(null)}
          onSubmit={handleReschedule}
        />
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <EditModal
          booking={editModal}
          onClose={() => setEditModal(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <CancelModal
          booking={cancelModal}
          onClose={() => setCancelModal(null)}
          onSubmit={handleCancel}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-base uppercase tracking-wider">Pengaturan Slot Booking</h3>
              <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BookingSettings />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RescheduleModal({ booking, onClose, onSubmit }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => { fetchHolidays().then(setHolidays); }, []);

  const handleSubmit = async () => {
    if (!date || !time) {
      Toastify({ text: 'Pilih tanggal dan jam baru!', background: 'orange' }).showToast();
      return;
    }
    if (isHolidayOrSunday(date, holidays)) {
      Toastify({ text: 'Tidak bisa reschedule di hari libur atau Minggu!', background: 'red' }).showToast();
      return;
    }
    setLoading(true);
    await onSubmit(booking.no_booking, `${date} ${time}`, alasan);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-black text-base uppercase tracking-wider">Reschedule Booking</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-zinc-50 rounded-xl p-3 text-sm space-y-1">
            <p className="font-bold text-zinc-900">{booking.no_booking}</p>
            <p className="text-zinc-500">{booking.nama_pelanggan} - {booking.no_polisi}</p>
            <p className="text-zinc-400">Janji lama: {formatDate(booking.janji_datang)}</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Tanggal Baru</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Jam Baru</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Alasan Reschedule</label>
            <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Alasan perubahan jadwal..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Batal</button>
          <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ booking, onClose, onSubmit }) {
  const [form, setForm] = useState({
    id_kendaraan: booking.id_kendaraan || '',
    no_polisi: booking.no_polisi || '',
    nama_kendaraan: booking.nama_kendaraan || '',
    no_chassis: booking.no_chassis || '',
    atas_nama_booking: booking.atas_nama_booking || '',
    no_telp_booking: booking.no_telp_booking || '',
    keluhan: booking.keluhan || '',
    booking_via: booking.booking_via || '',
    booking_via_personal: booking.booking_via_personal || '',
    km: booking.km || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(booking.no_booking, form);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <h3 className="font-black text-base uppercase tracking-wider">Edit Booking</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="bg-zinc-50 rounded-xl p-3 text-sm space-y-1">
            <p className="font-bold text-zinc-900">{booking.no_booking}</p>
            <p className="text-zinc-500">{booking.nama_pelanggan}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">No. Polisi</label>
              <input type="text" value={form.no_polisi} onChange={e => setForm({ ...form, no_polisi: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Nama Kendaraan</label>
              <input type="text" value={form.nama_kendaraan} onChange={e => setForm({ ...form, nama_kendaraan: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">No. Chassis</label>
              <input type="text" value={form.no_chassis} onChange={e => setForm({ ...form, no_chassis: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">KM</label>
              <input type="text" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Atas Nama Booking</label>
              <input type="text" value={form.atas_nama_booking} onChange={e => setForm({ ...form, atas_nama_booking: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Kosongkan jika sama STNK" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">No. Telp Booking</label>
              <input type="text" value={form.no_telp_booking} onChange={e => setForm({ ...form, no_telp_booking: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Booking Via</label>
              <select value={form.booking_via} onChange={e => setForm({ ...form, booking_via: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
                <option value="Personal">Personal</option>
                <option value="WA CS Service">WA CS Service</option>
                <option value="Telpon CS Service">Telpon CS Service</option>
                <option value="Datang Langsung">Datang Langsung</option>
                <option value="Import Excel">Import Excel</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Booking Via Personal</label>
              <input type="text" value={form.booking_via_personal} onChange={e => setForm({ ...form, booking_via_personal: e.target.value })} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Nama personal booking" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Keluhan</label>
              <textarea value={form.keluhan} onChange={e => setForm({ ...form, keluhan: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Batal</button>
          <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelModal({ booking, onClose, onSubmit }) {
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!alasan.trim()) {
      Toastify({ text: 'Alasan pembatalan wajib diisi!', background: 'orange' }).showToast();
      return;
    }
    if (!window.confirm(`Yakin ingin membatalkan booking ${booking.no_booking}?`)) return;
    setLoading(true);
    await onSubmit(booking.no_booking, alasan);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-black text-base uppercase tracking-wider text-red-600">Batalkan Booking</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm space-y-1">
            <p className="font-bold text-zinc-900">{booking.no_booking}</p>
            <p className="text-zinc-500">{booking.nama_pelanggan} - {booking.no_polisi}</p>
            <p className="text-zinc-400">Janji: {formatDate(booking.janji_datang)}</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Alasan Pembatalan <span className="text-red-500">*</span></label>
            <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={4} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Tulis alasan pembatalan..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Kembali</button>
          <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Memproses...' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
