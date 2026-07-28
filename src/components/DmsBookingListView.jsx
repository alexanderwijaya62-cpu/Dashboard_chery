import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

  const [showSettings, setShowSettings] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const hasActiveFilters = statusFilter || dateFrom || dateTo;

  const [allData, setAllData] = useState([]);
  const [allTotal, setAllTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const needsClientFilter = dateFrom || dateTo || statusFilter || search;
      const fetchLength = needsClientFilter ? 1000 : pageSize;
      const fetchStart = needsClientFilter ? 0 : page * pageSize;

      const params = new URLSearchParams({
        endpoint: 'booking-data',
        draw: 1,
        start: fetchStart,
        length: fetchLength,
        search: '',
        status: '',
        datefrom: '',
        dateto: '',
      });
      const res = await fetch(`/api/chery_dms?${params.toString()}`);
      const json = await res.json();
      let raw = json.data || [];
      let total = json.recordsTotal || raw.length;

      if (needsClientFilter) {
        if (search) {
          const q = search.toLowerCase();
          raw = raw.filter(r =>
            (r.no_booking || '').toLowerCase().includes(q) ||
            (r.no_polisi || '').toLowerCase().includes(q) ||
            (r.nama_pelanggan || '').toLowerCase().includes(q) ||
            (r.nama_kendaraan || '').toLowerCase().includes(q)
          );
        }
        if (statusFilter) {
          raw = raw.filter(r => (r.status_booking || '') === statusFilter);
        }
        if (dateFrom) {
          raw = raw.filter(r => {
            const d = (r.janji_datang || '').split(' ')[0];
            return d >= dateFrom;
          });
        }
        if (dateTo) {
          raw = raw.filter(r => {
            const d = (r.janji_datang || '').split(' ')[0];
            return d <= dateTo;
          });
        }
        total = raw.length;
        const start = page * pageSize;
        raw = raw.slice(start, start + pageSize);
      }

      setAllData(raw);
      setAllTotal(total);
      setData(raw);
      setTotalRecords(total);
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

  // Debounce search input to perform search on change
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

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
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  useEffect(() => { fetchHolidays().then(setHolidays); }, []);

  const calGrid = useMemo(() => {
    const m = calMonth.getMonth(), y = calMonth.getFullYear();
    const days = [];
    const prevLast = new Date(y, m, 0).getDate();
    const start = new Date(y, m, 1).getDay();
    for (let i = start - 1; i >= 0; i--) days.push({ day: prevLast - i, currentMonth: false });
    for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const isPast = new Date(ds + 'T00:00:00') < now;
      const isDisabled = isPast || isHolidayOrSunday(ds, holidays);
      days.push({ day: i, currentMonth: true, date: ds, isDisabled });
    }
    const rem = 42 - days.length;
    for (let i = 1; i <= rem; i++) days.push({ day: i, currentMonth: false });
    return days;
  }, [calMonth, holidays]);

  const handleSubmit = async () => {
    if (!date || !time) {
      Toastify({ text: 'Pilih tanggal dan jam baru!', background: 'orange' }).showToast();
      return;
    }
    setLoading(true);
    await onSubmit(booking.id_booking || booking.no_booking, `${date}T${time}`, alasan);
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
            {date && <p className="text-sm font-semibold text-zinc-900 mb-1">{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() - 1); setCalMonth(d); }} className="p-1 hover:bg-zinc-200 rounded-lg"><ChevronLeft size={14} /></button>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-700">{calMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() + 1); setCalMonth(d); }} className="p-1 hover:bg-zinc-200 rounded-lg"><ChevronRight size={14} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['Min','Sen','Sel','Rab','Kam','Jum','Sat'].map(d => (
                  <div key={d} className="text-center text-[7px] font-black text-zinc-400 uppercase tracking-widest py-0.5">{d}</div>
                ))}
                {calGrid.map((item, idx) => {
                  if (!item.currentMonth) return <div key={idx} className="aspect-square" />;
                  const isSelected = date === item.date;
                  return (
                    <button key={idx} type="button" disabled={item.isDisabled}
                      onClick={() => setDate(item.date)}
                      className={`aspect-square rounded-lg text-[10px] font-black transition-all flex items-center justify-center ${
                        item.isDisabled ? 'text-zinc-300 cursor-not-allowed' :
                        isSelected ? 'bg-black text-white shadow' :
                        'text-zinc-700 hover:bg-zinc-200'
                      }`}>{item.day}</button>
                  );
                })}
              </div>
            </div>
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
          <button onClick={handleSubmit} disabled={loading || !date || !time} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
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
    await onSubmit(booking.id_booking || booking.no_booking, form);
    setLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden max-h-[95vh] my-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900">Edit Booking DMS</h3>
            <p className="text-[10px] font-bold text-zinc-400">{booking.no_booking} &bull; {booking.nama_pelanggan}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 space-y-2 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">No. Polisi</label>
              <input type="text" value={form.no_polisi} onChange={e => setForm({ ...form, no_polisi: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Nama Kendaraan</label>
              <input type="text" value={form.nama_kendaraan} onChange={e => setForm({ ...form, nama_kendaraan: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">No. Chassis</label>
              <input type="text" value={form.no_chassis} onChange={e => setForm({ ...form, no_chassis: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">KM</label>
              <input type="text" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Atas Nama Booking</label>
              <input type="text" value={form.atas_nama_booking} onChange={e => setForm({ ...form, atas_nama_booking: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" placeholder="Sama STNK" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">No. Telp Booking</label>
              <input type="text" value={form.no_telp_booking} onChange={e => setForm({ ...form, no_telp_booking: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Booking Via</label>
              <select value={form.booking_via} onChange={e => setForm({ ...form, booking_via: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                <option value="Personal">Personal</option>
                <option value="WA CS Service">WA CS Service</option>
                <option value="Telpon CS Service">Telpon CS Service</option>
                <option value="Datang Langsung">Datang Langsung</option>
                <option value="Import Excel">Import Excel</option>
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Booking Via Personal</label>
              <input type="text" value={form.booking_via_personal} onChange={e => setForm({ ...form, booking_via_personal: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" placeholder="Nama personal" />
            </div>
            <div className="col-span-2">
              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Keluhan</label>
              <input type="text" value={form.keluhan} onChange={e => setForm({ ...form, keluhan: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zinc-900" placeholder="Deskripsi keluhan..." />
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">Batal</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
    await onSubmit(booking.id_booking || booking.no_booking, alasan);
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
