import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileText, User, Printer, Trash2, Layers, Loader, Eye, RefreshCw, X } from 'lucide-react';
import Toastify from 'toastify-js';

export default function EstimasiHistory({ user }) {
  const [estimations, setEstimations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchVin, setSearchVin] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedEst, setSelectedEst] = useState(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const filters = [
        { op: 'order', column: 'created_at', ascending: false }
      ];

      // If user is partshop, only show their own estimations
      if (user?.role?.toLowerCase() === 'partshop') {
        filters.push({ op: 'eq', column: 'username', value: user.username });
      } else {
        if (searchUser.trim()) {
          filters.push({ op: 'ilike', column: 'username', value: `%${searchUser.trim()}%` });
        }
      }

      if (searchVin.trim()) {
        filters.push({ op: 'ilike', column: 'vin', value: `%${searchVin.trim()}%` });
      }

      if (filterDate) {
        filters.push({ op: 'gte', column: 'created_at', value: `${filterDate}T00:00:00Z` });
        filters.push({ op: 'lte', column: 'created_at', value: `${filterDate}T23:59:59Z` });
      }

      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Username': user?.username || '',
          'X-Auth-Session-Id': localStorage.getItem('chery_session_id') || '',
        },
        body: JSON.stringify({
          table: 'partshop_estimations',
          action: 'select',
          filters
        })
      });

      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      setEstimations(result.data || []);
    } catch (e) {
      console.error(e);
      Toastify({ text: 'Gagal memuat riwayat estimasi: ' + e.message, style: { background: 'red' } }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [searchVin, searchUser, filterDate]);

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus riwayat estimasi ini?')) return;
    try {
      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Username': user?.username || '',
          'X-Auth-Session-Id': localStorage.getItem('chery_session_id') || '',
        },
        body: JSON.stringify({
          table: 'partshop_estimations',
          action: 'delete',
          filters: [{ op: 'eq', column: 'id', value: id }]
        })
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      Toastify({ text: 'Estimasi berhasil dihapus!', style: { background: '#10b981' } }).showToast();
      fetchHistory();
      if (selectedEst?.id === id) setSelectedEst(null);
    } catch (e) {
      Toastify({ text: 'Gagal menghapus: ' + e.message, style: { background: 'red' } }).showToast();
    }
  };

  const reprintPdf = (est) => {
    // Generate simple PDF layout or print window
    const printWindow = window.open('', '_blank');
    const itemsHtml = est.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 10px; font-weight: bold; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; font-family: monospace; font-weight: bold;">${item.code}</td>
        <td style="padding: 10px; text-transform: uppercase;">${item.name}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: ${item.stockStatus === 'READY' ? '#10b981' : '#ef4444'};">${item.stockStatus || 'NOT READY'}</td>
        <td style="padding: 10px; text-align: center;">${item.qty || 1}</td>
        <td style="padding: 10px; text-align: right;">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.priceExc || 0)}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold;">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format((item.priceExc || 0) * (item.qty || 1))}</td>
        <td style="padding: 5px; text-align: center;">
          ${item.image ? `<img src="${item.image}" style="max-height: 45px; max-width: 60px; object-fit: contain; border-radius: 4px;" />` : '<span style="color: #a1a1aa; font-size: 10px;">No Image</span>'}
        </td>
      </tr>
    `).join('');

    const formattedDate = new Date(est.created_at).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Estimasi Sparepart - ${est.vin || 'UMUM'}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #1f2937; margin: 40px; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1f2937; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 13px; }
            .meta-item span { font-weight: bold; color: #6b7280; text-transform: uppercase; font-size: 10px; display: block; }
            .meta-item div { font-size: 14px; font-weight: bold; margin-top: 2px; }
            table { w-full; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th { background-color: #f3f4f6; padding: 10px; text-transform: uppercase; font-weight: 900; }
            .total-section { display: flex; flex-direction: column; align-items: flex-end; font-size: 14px; font-weight: bold; gap: 8px; }
            .total-row { display: flex; justify-content: space-between; width: 300px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ESTIMASI SPAREPART</div>
              <div style="font-size: 12px; color: #6b7280; font-weight: bold; margin-top: 5px;">CHERY MEDAN WORKSHOP</div>
            </div>
            <div style="text-align: right; font-size: 11px; font-weight: bold;">
              <div>No. Estimasi: ${est.id.slice(0, 8).toUpperCase()}</div>
              <div>Tanggal: ${formattedDate}</div>
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-item">
              <span>Partshop / Submitter</span>
              <div>${est.username}</div>
            </div>
            <div class="meta-item">
              <span>Nomor VIN / Rangka</span>
              <div style="font-family: monospace; letter-spacing: 0.5px;">${est.vin || '-'}</div>
            </div>
          </div>

          <table style="width: 100%;">
            <thead>
              <tr>
                <th style="width: 50px;">No</th>
                <th>Part Code</th>
                <th>Part Name</th>
                <th style="width: 100px;">Stok JKT</th>
                <th style="width: 60px;">Qty</th>
                <th style="text-align: right; width: 120px;">Harga Satuan</th>
                <th style="text-align: right; width: 120px;">Total</th>
                <th style="width: 80px;">Preview</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span style="color: #6b7280;">TOTAL QTY:</span>
              <span>${est.total_qty} Item(s)</span>
            </div>
            <div class="total-row" style="font-size: 16px; border-bottom: 3px double #1f2937; padding-bottom: 8px;">
              <span>TOTAL (EXC. PPN):</span>
              <span>${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(est.total_price)}</span>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 bg-zinc-100 flex flex-col overflow-hidden font-sans antialiased">
      {/* Header toolbar */}
      <header className="bg-white border-b border-zinc-200 px-4 md:px-8 h-20 flex items-center justify-between shrink-0 box-border">
        <div>
          <h1 className="text-zinc-900 font-black text-base md:text-lg uppercase tracking-wider">
            Riwayat Estimasi
          </h1>
          <p className="text-zinc-500 text-xs font-medium mt-0.5">
            Daftar estimasi sparepart yang telah diekspor oleh Partshop
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-300 shadow-sm rounded-md transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {/* Filter panel */}
      <div className="bg-white border-b border-zinc-200 px-4 md:px-8 py-3 flex flex-wrap gap-4 items-center">
        {user?.role?.toLowerCase() !== 'partshop' && (
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari User..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="bg-zinc-50 border border-zinc-300 rounded-md pl-9 pr-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 w-44"
            />
          </div>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari VIN / Rangka..."
            value={searchVin}
            onChange={(e) => setSearchVin(e.target.value)}
            className="bg-zinc-50 border border-zinc-300 rounded-md pl-9 pr-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 w-48"
          />
        </div>
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-zinc-50 border border-zinc-300 rounded-md pl-9 pr-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 w-36"
          />
        </div>
        {filterDate && (
          <button 
            onClick={() => setFilterDate('')}
            className="text-xs font-bold text-red-600 hover:text-red-700"
          >
            Clear Date
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex gap-6 min-h-0">
        {/* Left: List Table */}
        <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
                <Loader size={32} className="animate-spin text-zinc-900" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Memuat riwayat estimasi...</span>
              </div>
            ) : estimations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2 p-8 text-center">
                <FileText size={48} className="opacity-10" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Belum ada riwayat estimasi</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-500 uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-3 px-4">Tanggal</th>
                    {user?.role?.toLowerCase() !== 'partshop' && <th className="py-3 px-4">Partshop</th>}
                    <th className="py-3 px-4">VIN / Rangka</th>
                    <th className="py-3 px-4">Preview Part</th>
                    <th className="py-3 px-4 text-center">Total Qty</th>
                    <th className="py-3 px-4 text-right">Total (Exc. PPN)</th>
                    <th className="py-3 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs font-semibold text-zinc-700">
                  {estimations.map((est) => {
                    const isSelected = selectedEst?.id === est.id;
                    return (
                      <tr 
                        key={est.id} 
                        onClick={() => setSelectedEst(est)}
                        className={`cursor-pointer hover:bg-zinc-50 transition-colors ${isSelected ? 'bg-zinc-50 border-l-4 border-zinc-900 pl-3' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-bold">
                          {new Date(est.created_at).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        {user?.role?.toLowerCase() !== 'partshop' && (
                          <td className="py-3.5 px-4 font-bold text-zinc-900">{est.username}</td>
                        )}
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 uppercase">
                          {est.vin || <span className="text-zinc-400 italic">UMUM</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex -space-x-2 overflow-hidden hover:space-x-1 transition-all duration-300">
                            {est.items?.slice(0, 4).map((item, i) => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0" title={item.name}>
                                {item.image ? (
                                  <img src={item.image} className="w-full h-full object-contain" alt="" />
                                ) : (
                                  <span className="text-[7px] text-zinc-400 font-mono font-bold">{item.code?.slice(-3)}</span>
                                )}
                              </div>
                            ))}
                            {est.items?.length > 4 && (
                              <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-800 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm">
                                +{est.items.length - 4}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">{est.total_qty} Pcs</td>
                        <td className="py-3.5 px-4 text-right font-black text-zinc-950">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(est.total_price)}
                        </td>
                        <td className="py-3.5 px-4 flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => reprintPdf(est)}
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-900 border border-zinc-200 hover:border-zinc-900 hover:text-white rounded-md transition-all"
                            title="Reprint PDF Estimasi"
                          >
                            <Printer size={13} />
                          </button>
                          {user?.role?.toLowerCase() !== 'partshop' && (
                            <button
                              onClick={() => handleDelete(est.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-650 hover:text-white rounded-md transition-all"
                              title="Hapus Riwayat"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Selected Estimation Details Card */}
        <div className="w-80 md:w-96 bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
          {selectedEst ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="bg-zinc-50 border-b border-zinc-200 p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-widest text-zinc-900">Rincian Estimasi</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {selectedEst.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <button 
                  onClick={() => setSelectedEst(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Info grid */}
              <div className="p-4 border-b border-zinc-150 text-[11px] space-y-2.5">
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-400 uppercase text-[9px]">VIN / Rangka</span>
                  <span className="font-mono font-bold text-zinc-900 uppercase">{selectedEst.vin || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-400 uppercase text-[9px]">Operator</span>
                  <span className="font-bold text-zinc-900">{selectedEst.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-zinc-400 uppercase text-[9px]">Waktu</span>
                  <span className="font-bold text-zinc-800">
                    {new Date(selectedEst.created_at).toLocaleString('id-ID', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-auto p-4 space-y-2.5 custom-scrollbar bg-zinc-50/50">
                <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Daftar Part ({selectedEst.items?.length || 0})</div>
                {selectedEst.items?.map((item, idx) => (
                  <div key={idx} className="bg-white border border-zinc-200 p-2.5 rounded-lg flex gap-3 items-center">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-200 rounded p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <img src={item.image} className="w-full h-full object-contain" alt="" />
                      ) : (
                        <Layers size={14} className="text-zinc-300" />
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-[10px] text-zinc-900 truncate">{item.code}</span>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0
                            ${item.stockStatus === 'READY' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'}`}
                          >
                            {item.stockStatus || 'NOT READY'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-505">x{item.qty || 1}</span>
                      </div>
                      <div className="text-[9px] font-medium text-zinc-650 uppercase truncate">{item.name}</div>
                      <div className="text-right text-[10px] font-black text-zinc-950 mt-1">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format((item.priceExc || 0) * (item.qty || 1))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total calculations footer */}
              <div className="p-4 border-t border-zinc-200 space-y-2.5 bg-zinc-50">
                <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <span>Total Qty:</span>
                  <span className="text-zinc-900 font-black">{selectedEst.total_qty} Item(s)</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <span>Total Harga (Exc PPN):</span>
                  <span className="text-zinc-950 font-black text-sm">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedEst.total_price)}
                  </span>
                </div>
                <button
                  onClick={() => reprintPdf(selectedEst)}
                  className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-black text-[11px] py-2 rounded-lg tracking-wider uppercase transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Printer size={12} /> Cetak Estimasi PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-2 h-96 p-4 text-center">
              <Eye size={36} className="opacity-15" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Pilih salah satu baris estimasi untuk melihat rincian item</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
