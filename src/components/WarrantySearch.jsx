import React, { useState } from 'react';
import { Search, ShieldCheck, AlertCircle, Car, User, Clock, X, FileText } from 'lucide-react';
import { getStatusStyle, getKategoriStyle, formatDate, formatKm, fetchWarrantyAPI } from '../utils/warrantyConfig';

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 font-medium flex-1 break-words">{value || '-'}</span>
    </div>
  );
}

export default function WarrantySearch() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); // all | no_wo | no_polisi | no_chassis | nama_pelanggan
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedWO, setSelectedWO] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedWO(null);

    try {
      const params = new URLSearchParams({
        endpoint: 'work-order',
        draw: 1,
        start: 0,
        length: 100,
        search: query.trim(),
        status: '',
        from: '',
        to: '',
      });

      const json = await fetchWarrantyAPI(params);

      let data = json.data || [];

      // Client-side filter by search type
      if (searchType !== 'all') {
        const q = query.trim().toLowerCase();
        data = data.filter(row => {
          const val = (row[searchType] || '').toLowerCase();
          return val.includes(q);
        });
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSelectedWO(null);
    setError(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 shrink-0">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Search size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight">Warranty Search</h1>
            <p className="text-xs text-zinc-400 font-medium">Cari data warranty berdasarkan No. WO, plat, chassis, atau nama pelanggan</p>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          {/* Search type selector */}
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="px-3 py-2.5 text-sm border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium md:w-48 shrink-0"
          >
            <option value="all">Semua Field</option>
            <option value="no_wo">No. WO</option>
            <option value="no_polisi">No. Polisi</option>
            <option value="no_chassis">No. Chassis / VIN</option>
            <option value="nama_pelanggan">Nama Pelanggan</option>
          </select>

          {/* Search input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchType === 'no_wo' ? 'Contoh: WO-MOS-0001' :
                searchType === 'no_polisi' ? 'Contoh: BK 1234 AB' :
                searchType === 'no_chassis' ? 'Contoh: LVVDB21B...' :
                searchType === 'nama_pelanggan' ? 'Nama pelanggan...' :
                'Cari No. WO, plat, chassis, nama...'
              }
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900"
              autoFocus
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isLoading ? 'Mencari...' : 'Cari'}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 mb-4">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Gagal mencari data</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400 font-medium">Mencari data warranty...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasSearched && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={32} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-500">Masukkan kata kunci pencarian</p>
              <p className="text-sm text-zinc-400 mt-1">Cari berdasarkan No. WO, No. Polisi, No. Chassis, atau Nama Pelanggan</p>
            </div>
          </div>
        )}

        {!isLoading && hasSearched && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada hasil untuk "{query}"</p>
            <p className="text-xs text-zinc-400">Coba kata kunci lain atau ubah tipe pencarian</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <div className={`grid gap-4 ${selectedWO ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Result list */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                {results.length} hasil ditemukan
              </p>
              {results.map((row, i) => {
                const s = getStatusStyle(row.status);
                const isSelected = selectedWO?.no_wo === row.no_wo;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedWO(isSelected ? null : row)}
                    className={`w-full text-left bg-white rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                      isSelected ? 'border-zinc-900 shadow-md' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-zinc-900 text-sm">{row.no_wo || '-'}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                            {s.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><User size={11} /> {row.nama_pelanggan || '-'}</span>
                          <span className="flex items-center gap-1"><Car size={11} /> {row.no_polisi || '-'} · {row.nama_kendaraan || '-'}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(row.waktu_masuk)}</span>
                        </div>
                      </div>
                      <FileText size={16} className={isSelected ? 'text-zinc-900' : 'text-zinc-300'} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedWO && (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden h-fit sticky top-0">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-black text-zinc-900 text-base">{selectedWO.no_wo}</h2>
                    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border mt-1 ${getStatusStyle(selectedWO.status).bg} ${getStatusStyle(selectedWO.status).text} ${getStatusStyle(selectedWO.status).border}`}>
                      {getStatusStyle(selectedWO.status).label}
                    </div>
                  </div>
                  <button onClick={() => setSelectedWO(null)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3">Informasi Kendaraan</p>
                  <InfoRow label="No. WO DMS" value={selectedWO.no_wo_dms} />
                  <InfoRow label="Kategori" value={selectedWO.kategori} />
                  <InfoRow label="No. Polisi" value={selectedWO.no_polisi} />
                  <InfoRow label="No. Chassis" value={selectedWO.no_chassis} />
                  <InfoRow label="No. Engine" value={selectedWO.no_engine} />
                  <InfoRow label="Kendaraan" value={selectedWO.nama_kendaraan} />
                  <InfoRow label="Tahun" value={selectedWO.tahun_produksi} />
                  <InfoRow label="KM Masuk" value={formatKm(selectedWO.stand_km)} />

                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 mt-5">Informasi Pelanggan</p>
                  <InfoRow label="Nama Pelanggan" value={selectedWO.nama_pelanggan} />
                  <InfoRow label="No. Telp" value={selectedWO.no_telp_pelanggan} />
                  <InfoRow label="Nama Pembawa" value={selectedWO.nama_pembawa} />

                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 mt-5">Tim Pengerjaan</p>
                  <InfoRow label="SA" value={selectedWO.id_karyawan} />
                  <InfoRow label="Mekanik" value={selectedWO.nama_mekanik1} />
                  <InfoRow label="Leader" value={selectedWO.nama_leader1} />
                  {selectedWO.keluhan && <InfoRow label="Keluhan" value={selectedWO.keluhan} />}
                  {selectedWO.perintah && <InfoRow label="Perintah" value={selectedWO.perintah} />}

                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 mt-5">Timeline</p>
                  <InfoRow label="Waktu Masuk" value={formatDate(selectedWO.waktu_masuk)} />
                  <InfoRow label="Simpan Estimasi" value={formatDate(selectedWO.waktu_simpan_estimasi)} />
                  <InfoRow label="Setujui Estimasi" value={formatDate(selectedWO.waktu_setujui_estimasi)} />
                  <InfoRow label="Mulai Pengerjaan" value={formatDate(selectedWO.waktu_mulai)} />
                  <InfoRow label="Checker" value={formatDate(selectedWO.waktu_checker)} />
                  <InfoRow label="Selesai" value={formatDate(selectedWO.waktu_selesai)} />
                  <InfoRow label="Last Update" value={formatDate(selectedWO.last_update)} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
