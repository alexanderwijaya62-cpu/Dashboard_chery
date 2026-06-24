import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, Search, Filter, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, TrendingUp, Layers, AlertCircle, X, FileSpreadsheet, Package, Download, Trash2 } from 'lucide-react';
import { db } from '../utils/dbClient';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  let parts = s.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 1900) {
      return { day: d, month: m, year: y, monthStr: `${String(m + 1).padStart(2, '0')}/${y}` };
    }
  }
  parts = s.split('-');
  if (parts.length === 3) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), monthStr: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` };
    }
  }
  return null;
};

const formatRupiah = (num) => {
  if (!num && num !== 0) return '-';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
};

export default function SparepartPredictor() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [sortBy, setSortBy] = useState('total_desc');
  const [showUpload, setShowUpload] = useState(false);
  const [pendingData, setPendingData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await db.select('sparepart_revenue', { range: { from: 0, to: 999999 }, order: { column: 'Tgl', ascending: false } });
      if (err) throw err;
      setRecords(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cleanExcelData = (rawRows) => {
    const dataRows = rawRows.slice(3);
    if (dataRows.length === 0) return [];

    const rawHeaders = dataRows[0];
    if (!rawHeaders || typeof rawHeaders.some !== 'function') return [];
    const rows = dataRows.slice(1);

    const headers = rawHeaders.map(h => String(h != null ? h : '').toLowerCase().replace(/\s/g, ''));

    // Cari posisi kolom berdasarkan nama header
    const findPos = (...keywords) => {
      for (const k of keywords) {
        const exact = headers.indexOf(k);
        if (exact !== -1) return exact;
        const fuzzy = headers.findIndex(h => h && h.includes(k));
        if (fuzzy !== -1) return fuzzy;
      }
      return -1;
    };

    const pos = {
      NoTransaksi: findPos('notransaksi', 'transaksi'),
      Tgl: findPos('tgl', 'tanggal', 'date'),
      NoWO: findPos('nowo', 'no_wo'),
      Pelanggan: findPos('pelanggan', 'customer'),
      PartNo: findPos('partno', 'part_no', 'partnumber'),
      PartName: findPos('partname', 'part_name', 'nama_part'),
      Type: findPos('type', 'tipe'),
      Qty: findPos('qty', 'quantity'),
      HargaSatuan: findPos('hargasatuan', 'harga_satuan', 'price'),
      Discount: findPos('discount', 'diskon'),
      HargaJual: findPos('hargajual', 'harga_jual'),
      Total: findPos('total'),
    };

    const cleaned = [];
    rows.forEach(row => {
      if (!row || typeof row.some !== 'function') return;
      if (row.every(cell => cell == null || String(cell).trim() === '')) return;

      const record = {};
      for (const [field, idx] of Object.entries(pos)) {
        if (idx !== -1 && idx < row.length && row[idx] != null && String(row[idx]).trim() !== '') {
          record[field] = row[idx];
        }
      }

      // Jika Qty kosong, coba gabung kolom Q (16) dan R (17)
      if (!record.Qty || String(record.Qty).trim() === '') {
        const colQ = row[16] != null ? String(row[16]).trim() : '';
        const colR = row[17] != null ? String(row[17]).trim() : '';
        const combined = (colQ + colR).replace(/\s/g, '');
        if (combined !== '') {
          record.Qty = isNaN(Number(combined)) ? combined : Number(combined);
        }
      }

      if (record.NoTransaksi || record.PartNo || record.PartName) {
        cleaned.push(record);
      }
    });

    return cleaned;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const cleaned = cleanExcelData(rawRows);
        if (cleaned.length === 0) {
          Toastify({ text: 'Tidak ada data valid ditemukan di Excel.', background: 'red', duration: 5000 }).showToast();
          return;
        }
        setPendingData(cleaned);
        setShowUpload(true);
      } catch (err) {
        Toastify({ text: 'Gagal baca Excel: ' + err.message, background: 'red', duration: 5000 }).showToast();
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (pendingData.length === 0) return;
    setIsImporting(true);
    try {
      // Ambil daftar NoTransaksi yang sudah ada di DB
      const { data: existing } = await db.select('sparepart_revenue', { select: '"NoTransaksi"' });
      const existingSet = new Set((existing || []).map(r => String(r.NoTransaksi || '').trim()));

      // Enrich & filter duplicates
      const enriched = [];
      let skipCount = 0;
      pendingData.forEach(r => {
        const noTrans = String(r.NoTransaksi || '').trim();
        if (!noTrans || existingSet.has(noTrans)) {
          skipCount++;
          return;
        }
        const parsed = parseDate(r.Tgl);
        let month = '';
        let year = '';
        if (parsed) {
          month = `${parsed.month + 1}`;
          year = `${parsed.year}`;
        }
        enriched.push({
          NoTransaksi: noTrans,
          Tgl: String(r.Tgl || '').trim(),
          NoWO: String(r.NoWO || '').trim(),
          Pelanggan: String(r.Pelanggan || '').trim(),
          PartNo: String(r.PartNo || '').trim(),
          PartName: String(r.PartName || '').trim(),
          Type: String(r.Type || '').trim(),
          Qty: parseFloat(r.Qty) || 0,
          HargaSatuan: parseFloat(String(r.HargaSatuan).replace(/[^0-9.,]/g, '').replace(/,/g, '')) || 0,
          Discount: parseFloat(String(r.Discount).replace(/[^0-9.,]/g, '').replace(/,/g, '')) || 0,
          HargaJual: parseFloat(String(r.HargaJual).replace(/[^0-9.,]/g, '').replace(/,/g, '')) || 0,
          Total: parseFloat(String(r.Total).replace(/[^0-9.,]/g, '').replace(/,/g, '')) || 0,
          bulan: month,
          tahun: year,
        });
      });

      if (enriched.length === 0) {
        Toastify({ text: `Semua ${skipCount} record sudah ada di database.`, background: 'blue', duration: 5000 }).showToast();
        setShowUpload(false);
        setPendingData([]);
        setIsImporting(false);
        return;
      }

      const batchSize = 500;
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batch = enriched.slice(i, i + batchSize);
        const { error: err } = await db.insert('sparepart_revenue', batch);
        if (err) throw err;
      }

      const msg = skipCount > 0
        ? `Berhasil import ${enriched.length} record baru (${skipCount} duplikat dilewati)!`
        : `Berhasil import ${enriched.length} record!`;
      Toastify({ text: msg, background: 'green', duration: 5000 }).showToast();
      setShowUpload(false);
      setPendingData([]);
      fetchData();
    } catch (err) {
      Toastify({ text: 'Gagal import: ' + err.message, background: 'red', duration: 5000 }).showToast();
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadCleaned = () => {
    if (pendingData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(pendingData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cleaned');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const buf = new ArrayBuffer(wbout.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < wbout.length; i++) view[i] = wbout.charCodeAt(i) & 0xFF;
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_penjualan_bersih_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Hapus SEMUA data sparepart_revenue? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const { error } = await db.delete('sparepart_revenue', { neq: { id: 0 } });
      if (error) throw error;
      Toastify({ text: `Semua data sparepart_revenue berhasil dihapus`, background: '#059669', duration: 3000 }).showToast();
      setRecords([]);
    } catch (err) {
      Toastify({ text: 'Gagal hapus data: ' + err.message, background: 'red', duration: 5000 }).showToast();
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set();
    records.forEach(r => {
      const p = parseDate(r.Tgl);
      if (p && p.year > 2000) years.add(p.year);
    });
    return [...years].sort((a, b) => b - a);
  }, [records]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        (r.PartName || '').toLowerCase().includes(q) ||
        (r.PartNo || '').toLowerCase().includes(q) ||
        (r.Pelanggan || '').toLowerCase().includes(q) ||
        (r.NoTransaksi || '').toLowerCase().includes(q)
      );
    }
    if (filterMonth) {
      const targetMonth = String(parseInt(filterMonth));
      filtered = filtered.filter(r => {
        const p = parseDate(r.Tgl);
        return p && String(p.month + 1) === targetMonth;
      });
    }
    if (filterYear) {
      filtered = filtered.filter(r => {
        const p = parseDate(r.Tgl);
        return p && String(p.year) === filterYear;
      });
    }
    return filtered;
  }, [records, search, filterMonth, filterYear]);

  const pivotData = useMemo(() => {
    const withDate = filteredRecords.map(r => ({ ...r, _parsed: parseDate(r.Tgl) }));
    const monthSet = new Set();
    const grouped = {};

    withDate.forEach(r => {
      const key = (r.PartName || r.PartNo || 'Unknown').trim();
      if (!grouped[key]) {
        grouped[key] = { partName: key, partNo: r.PartNo || '', total: 0, count: 0, months: {} };
      }
      const qty = parseFloat(r.Qty) || 0;
      grouped[key].total += qty;
      grouped[key].count += 1;
      if (r._parsed) {
        const ms = r._parsed.monthStr;
        monthSet.add(ms);
        grouped[key].months[ms] = (grouped[key].months[ms] || 0) + qty;
      }
    });

    const sortedMonths = [...monthSet].sort();
    let result = Object.values(grouped);

    if (sortBy === 'total_desc') result.sort((a, b) => b.total - a.total);
    else if (sortBy === 'total_asc') result.sort((a, b) => a.total - b.total);
    else if (sortBy === 'name_asc') result.sort((a, b) => a.partName.localeCompare(b.partName));
    else if (sortBy === 'name_desc') result.sort((a, b) => b.partName.localeCompare(a.partName));

    return { pivot: result, months: sortedMonths, totalRecords: withDate.length };
  }, [filteredRecords, sortBy]);

  const totalPages = Math.ceil(pivotData.pivot.length / pageSize);
  const displayPivot = pivotData.pivot.slice(page * pageSize, (page + 1) * pageSize);

  const hasActiveFilters = search || filterMonth || filterYear;
  const clearFilters = () => { setSearch(''); setSearchInput(''); setFilterMonth(''); setFilterYear(''); setPage(0); };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-zinc-50">
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isImporting && setShowUpload(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-black rounded-xl text-white">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">Preview Data</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{pendingData.length} record ditemukan</p>
                </div>
              </div>
              <button onClick={() => !isImporting && setShowUpload(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto border border-zinc-200 rounded-2xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="text-left px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">NoTransaksi</th>
                      <th className="text-left px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">Tgl</th>
                      <th className="text-left px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">PartNo</th>
                      <th className="text-left px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">PartName</th>
                      <th className="text-right px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">Qty</th>
                      <th className="text-right px-3 py-2 font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {pendingData.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-mono font-bold text-zinc-900 whitespace-nowrap">{r.NoTransaksi || '-'}</td>
                        <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">{r.Tgl || '-'}</td>
                        <td className="px-3 py-2 font-mono text-zinc-700 whitespace-nowrap">{r.PartNo || '-'}</td>
                        <td className="px-3 py-2 text-zinc-800 font-semibold truncate max-w-[200px]">{r.PartName || '-'}</td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-900">{r.Qty || 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-700">{formatRupiah(r.Total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingData.length > 50 && (
                <p className="text-center text-[10px] text-zinc-400 font-bold mt-3">...dan {pendingData.length - 50} record lainnya</p>
              )}
            </div>
            <div className="p-6 border-t border-zinc-200 flex justify-end gap-4">
              <button onClick={handleDownloadCleaned} className="px-8 py-3 border border-zinc-200 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center gap-2">
                <Download size={14} /> Download Excel
              </button>
              <button onClick={() => { setShowUpload(false); setPendingData([]); }} disabled={isImporting} className="px-8 py-3 border border-zinc-200 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-all disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleImport} disabled={isImporting} className="px-8 py-3 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2">
                {isImporting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Mengimport...</>
                ) : (
                  <><Upload size={14} /> Import {pendingData.length} Record</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-3 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(0); }} className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Cari PartNo, PartName..." className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-48 text-zinc-900" />
            </div>
            <button type="submit" className="px-3 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors">Cari</button>
          </form>
          <button onClick={() => setShowFilter(!showFilter)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${showFilter || hasActiveFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}>
            <Filter size={13} /> Filter {hasActiveFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>}
          </button>
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors">
            <Upload size={13} /> Import Excel
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDeleteAll} className="p-2 rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 transition-colors" title="Hapus semua data">
            <Trash2 size={14} />
          </button>
          <button onClick={fetchData} disabled={isLoading} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs text-zinc-500 whitespace-nowrap">{isLoading ? 'Memuat...' : `${records.length} record`}</span>
        </div>
      </div>

      {showFilter && (
        <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-3 flex flex-wrap items-end gap-3 shrink-0">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Bulan</label>
            <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(0); }} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua Bulan</option>
              {MONTHS_SHORT.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Tahun</label>
            <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(0); }} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="">Semua Tahun</option>
              {availableYears.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Urutkan</label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }} className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
              <option value="total_desc">Terlaris ↓</option>
              <option value="total_asc">Terlaris ↑</option>
              <option value="name_asc">Nama A-Z</option>
              <option value="name_desc">Nama Z-A</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors">
              <X size={13} /> Reset
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={fetchData} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
          </div>
        )}

        {isLoading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400">Memuat data...</p>
          </div>
        ) : pivotData.pivot.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Package size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Belum ada data penjualan sparepart</p>
            <p className="text-xs text-zinc-400">Import Excel terlebih dahulu untuk melihat rekap</p>
            <button onClick={() => fileInputRef.current.click()} className="mt-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2">
              <Upload size={14} /> Import Excel
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg text-white">
                    <TrendingUp size={16} />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Rekap Penjualan Per Bulan</h3>
                  <span className="text-[10px] text-zinc-400 font-bold">({pivotData.totalRecords} transaksi)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Part Name</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">Part No</th>
                      {pivotData.months.map(m => (
                        <th key={m} className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{m}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap border-l-2 border-zinc-200">Total Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {displayPivot.map((item, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                          <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap max-w-[250px] truncate">{item.partName}</td>
                          <td className="px-4 py-3 font-mono text-zinc-500 whitespace-nowrap text-[11px]">{item.partNo || '-'}</td>
                          {pivotData.months.map(m => (
                            <td key={m} className="px-3 py-3 text-right font-bold text-zinc-800">{item.months[m] || '-'}</td>
                          ))}
                          <td className="px-4 py-3 text-right font-black text-zinc-900 border-l-2 border-zinc-200">{item.total}</td>
                        </tr>
                        {expandedRow === i && (
                          <tr className="bg-zinc-50">
                            <td colSpan={pivotData.months.length + 3} className="px-5 py-4">
                              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-zinc-200">
                                      <th className="text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Tgl</th>
                                      <th className="text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">No Transaksi</th>
                                      <th className="text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Pelanggan</th>
                                      <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Qty</th>
                                      <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Harga Satuan</th>
                                      <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Discount</th>
                                      <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100">
                                    {filteredRecords.filter(r => (r.PartName || r.PartNo || 'Unknown').trim() === item.partName).map((r, j) => (
                                      <tr key={j} className="hover:bg-white">
                                        <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap">{r.Tgl || '-'}</td>
                                        <td className="px-3 py-1.5 font-mono font-bold text-zinc-800 whitespace-nowrap">{r.NoTransaksi || '-'}</td>
                                        <td className="px-3 py-1.5 text-zinc-700 whitespace-nowrap">{r.Pelanggan || '-'}</td>
                                        <td className="px-3 py-1.5 text-right font-bold text-zinc-900">{r.Qty || 0}</td>
                                        <td className="px-3 py-1.5 text-right text-zinc-600">{formatRupiah(r.HargaSatuan)}</td>
                                        <td className="px-3 py-1.5 text-right text-red-500">{r.Discount ? formatRupiah(r.Discount) : '-'}</td>
                                        <td className="px-3 py-1.5 text-right font-bold text-zinc-900">{formatRupiah(r.Total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="bg-white border border-zinc-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
                <p className="text-xs text-zinc-500">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, pivotData.pivot.length)} dari {pivotData.pivot.length} sparepart
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-sm font-semibold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
