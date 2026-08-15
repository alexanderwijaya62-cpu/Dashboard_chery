import React, { useState, useEffect } from 'react';
import { Search, Loader2, FileText, ChevronLeft, ChevronRight, Download, Eye, X, BookOpen } from 'lucide-react';
import Toastify from 'toastify-js';

export default function BulletinViewer({ user }) {
  const [bills, setBills] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [pageIndex, setPageIndex] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState({}); // frontend pagination cache

  // Selected bulletin state for detail popup/drawer
  const [selectedBill, setSelectedBill] = useState(null);
  const [billDetail, setBillDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // PDF Viewer Modal state
  const [activePdf, setActivePdf] = useState(null); // holds { fileId, fileName }

  // Fetch bulletins
  const fetchBulletins = async (index = pageIndex, size = pageSize, forceFresh = false) => {
    const cacheKey = `${index}_${size}`;
    if (!forceFresh && cache[cacheKey]) {
      const cachedData = cache[cacheKey];
      setBills(cachedData.content || []);
      setTotalElements(cachedData.totalElements || 0);
      setTotalPages(cachedData.totalPages || 0);
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch(`/api/chery_dms?endpoint=announcement-bills&pageIndex=${index}&pageSize=${size}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await resp.json();
      
      const payload = result.payload || result || {};
      const content = payload.content || [];
      
      setBills(content);
      setTotalElements(payload.totalElements || content.length);
      setTotalPages(payload.totalPages || 1);

      // Save to cache
      setCache(prev => ({ ...prev, [cacheKey]: payload }));
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal memuat daftar bulletin", style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBulletins(pageIndex, pageSize);
  }, [pageIndex, pageSize]);

  // Get current auth params for standard links (like iframes) which cannot have custom headers
  const getAuthQueryParams = () => {
    let authUsername = '';
    try {
      const u = JSON.parse(localStorage.getItem('chery_auth_user') || '{}');
      authUsername = u.username || '';
    } catch (e) {}
    const authSessionId = localStorage.getItem('chery_session_id') || '';
    return `&X-Auth-Username=${encodeURIComponent(authUsername)}&X-Auth-Session-Id=${encodeURIComponent(authSessionId)}`;
  };

  // Load details & attachments of a selected bulletin
  const handleSelectBill = async (bill) => {
    setSelectedBill(bill);
    setBillDetail(null);
    setIsLoadingDetail(true);

    try {
      // Default to values in screenshot
      const companyType = '2';
      const companyCode = '10007901';
      const companyName = 'ORIENTAL SM RAJA AMPLAS';
      
      const resp = await fetch(`/api/chery_dms?endpoint=announcement-detail&id=${bill.id}&companyType=${companyType}&companyCode=${companyCode}&companyName=${encodeURIComponent(companyName)}`);
      const result = await resp.json();
      
      const detailObj = result.payload || result || null;
      setBillDetail(detailObj);
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal memuat detail bulletin", style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Directly fetch details and open PDF in iframe modal
  const handleDirectRead = async (bill) => {
    setIsLoading(true);
    try {
      const companyType = '2';
      const companyCode = '10007901';
      const companyName = 'ORIENTAL SM RAJA AMPLAS';
      
      const resp = await fetch(`/api/chery_dms?endpoint=announcement-detail&id=${bill.id}&companyType=${companyType}&companyCode=${companyCode}&companyName=${encodeURIComponent(companyName)}`);
      const result = await resp.json();
      
      const detailObj = result.payload || result || null;
      if (detailObj && detailObj.attachments && detailObj.attachments.length > 0) {
        setActivePdf(detailObj.attachments[0]);
      } else {
        Toastify({ text: "⚠️ Bulletin ini tidak memiliki lampiran file", style: { background: "#eab308" } }).showToast();
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal memuat file bulletin", style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered bills by search query
  const getFilteredBills = () => {
    if (!searchQuery.trim()) return bills;
    const q = searchQuery.toLowerCase().trim();
    return bills.filter(b => 
      (b.title && b.title.toLowerCase().includes(q)) || 
      (b.code && b.code.toLowerCase().includes(q)) || 
      (b.content && b.content.toLowerCase().includes(q))
    );
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) setPageIndex(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (pageIndex < totalPages - 1) setPageIndex(prev => prev + 1);
  };

  return (
    <div className="w-full space-y-6 p-4 md:p-6 bg-zinc-50 min-h-screen">
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="text-zinc-950" size={28} />
            Chery Technical Bulletins
          </h2>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">
            Tutorial perbaikan, regulasi garansi, & bulletin servis resmi Chery
          </p>
        </div>
        <button
          onClick={() => fetchBulletins(pageIndex, pageSize, true)}
          className="bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs px-4 py-2 rounded-lg tracking-wider uppercase transition-all shadow-sm active:scale-95 flex items-center gap-2 h-9 self-start"
        >
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {/* Grid: Search, list & detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left list table: lg:col-span-8 */}
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[500px]">
          <div>
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <input
                  type="text"
                  placeholder="Cari berdasarkan judul, konten, atau kode bulletin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 w-full transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPageIndex(0);
                    setCache({});
                  }}
                  className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-bold text-zinc-700 focus:outline-none"
                >
                  {[10, 15, 20, 40].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">Status</th>
                    <th className="py-3 px-4 w-40">Nomor Dokumen</th>
                    <th className="py-3 px-4">Judul Bulletin</th>
                    <th className="py-3 px-4 w-16 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs font-semibold text-zinc-750">
                  {isLoading ? (
                    <tr>
                      <td colSpan="4" className="py-16 text-center text-zinc-400">
                        <Loader2 className="animate-spin mx-auto text-zinc-600 mb-3" size={28} />
                        <span className="font-bold uppercase tracking-widest text-[10px]">Memuat data bulletin...</span>
                      </td>
                    </tr>
                  ) : getFilteredBills().length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-zinc-400 italic">
                        Tidak ada bulletin yang ditemukan
                      </td>
                    </tr>
                  ) : (
                    getFilteredBills().map((b) => {
                      const isSelected = selectedBill?.id === b.id;
                      return (
                        <tr 
                          key={b.id} 
                          onClick={() => handleSelectBill(b)}
                          className={`cursor-pointer transition-all hover:bg-zinc-50 ${isSelected ? 'bg-zinc-900 text-white hover:bg-zinc-800' : ''}`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${b.status === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {b.status === 3 ? 'Active' : b.status}
                            </span>
                          </td>
                          <td className={`py-3.5 px-4 font-mono text-[11px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>{b.code}</td>
                          <td className={`py-3.5 px-4 truncate max-w-xs ${isSelected ? 'text-white' : 'text-zinc-900'}`} title={b.title}>
                            {b.title}
                          </td>
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDirectRead(b)}
                              className={`p-1.5 rounded-md border transition-all active:scale-95
                                ${isSelected 
                                  ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-white hover:text-zinc-900' 
                                  : 'bg-zinc-50 hover:bg-zinc-900 border-zinc-200 text-zinc-600 hover:text-white'}`}
                              title="Baca Langsung PDF"
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 font-bold shrink-0">
            <span>
              Menampilkan {getFilteredBills().length} dari {totalElements} data
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={pageIndex === 0 || isLoading}
                  className="p-1.5 rounded bg-white hover:bg-zinc-100 border border-zinc-200 disabled:opacity-50 disabled:hover:bg-white text-zinc-600 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-black text-zinc-900 font-mono">
                  {pageIndex + 1} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={pageIndex >= totalPages - 1 || isLoading}
                  className="p-1.5 rounded bg-white hover:bg-zinc-100 border border-zinc-200 disabled:opacity-50 disabled:hover:bg-white text-zinc-600 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right details & attachments: lg:col-span-4 */}
        <div className="lg:col-span-4 space-y-4">
          {!selectedBill ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-400 italic shadow-sm flex flex-col items-center justify-center h-80 gap-3">
              <FileText size={40} className="opacity-10 text-zinc-900" />
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Pilih salah satu bulletin di sebelah kiri untuk melihat lampiran & tutorial</p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
                <h3 className="font-black text-xs uppercase tracking-widest text-zinc-900 flex items-center gap-1.5">
                  <FileText size={15} />
                  Detail Bulletin
                </h3>
                <button 
                  onClick={() => setSelectedBill(null)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Bill brief */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Judul Bulletin</span>
                  <p className="text-xs font-black text-zinc-900 leading-normal">{selectedBill.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Nomor</span>
                    <p className="text-[11px] font-mono font-bold text-zinc-750">{selectedBill.code}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Status</span>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-emerald-100 text-emerald-800">
                      {selectedBill.status === 3 ? 'Active' : selectedBill.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="border-t border-zinc-150 pt-4 space-y-3">
                <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">File Lampiran & Tutorial</h4>
                
                {isLoadingDetail ? (
                  <div className="py-6 text-center text-zinc-400">
                    <Loader2 size={20} className="animate-spin mx-auto text-zinc-500 mb-2" />
                    <span className="text-[9.5px] font-black uppercase tracking-wider">Memuat detail file lampiran...</span>
                  </div>
                ) : !billDetail || !billDetail.attachments || billDetail.attachments.length === 0 ? (
                  <div className="py-4 text-center text-zinc-400 italic text-[11px] bg-zinc-50 border border-zinc-150 rounded-lg">
                    Tidak ada lampiran PDF di bulletin ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {billDetail.attachments.map((file, fIdx) => (
                      <div 
                        key={fIdx} 
                        className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg flex items-center justify-between gap-3 group hover:border-zinc-300 transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText size={16} className="text-red-500 shrink-0" />
                          <span 
                            className="text-xs font-bold text-zinc-800 truncate"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Read directly in Web App */}
                          <button
                            onClick={() => setActivePdf(file)}
                            className="bg-zinc-900 hover:bg-zinc-800 text-white p-1.5 rounded-md transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                            title="Baca langsung di website"
                          >
                            <Eye size={12} />
                            BACA
                          </button>
                          
                          {/* Direct download fallback */}
                          <a
                            href={`/api/chery_dms?endpoint=download_file&id=${file.fileId}${getAuthQueryParams()}`}
                            download={file.fileName}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 p-1.5 rounded-md transition-colors"
                            title="Unduh file ke komputer"
                          >
                            <Download size={12} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Online PDF Viewer Overlay / Modal */}
      {activePdf && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99999] flex flex-col justify-between p-3 md:p-6 transition-all duration-300 animate-in fade-in">
          {/* Header Bar */}
          <div className="bg-zinc-900 text-white rounded-t-xl px-4 py-3 flex items-center justify-between border-b border-zinc-800 shadow-lg select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText size={18} className="text-red-500 shrink-0" />
              <h3 className="font-black text-xs md:text-sm uppercase tracking-wider truncate" title={activePdf.fileName}>
                Membaca: {activePdf.fileName}
              </h3>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={`/api/chery_dms?endpoint=download_file&id=${activePdf.fileId}${getAuthQueryParams()}`}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                <Download size={12} />
                Download
              </a>
              <button 
                onClick={() => setActivePdf(null)}
                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-full transition-colors flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Iframe Viewport Container */}
          <div className="flex-1 bg-zinc-900/60 p-2 flex items-center justify-center relative overflow-hidden">
            <iframe
              src={`/api/chery_dms?endpoint=download_file&inline=true&id=${activePdf.fileId}${getAuthQueryParams()}`}
              className="w-full h-full border-none rounded-b-xl shadow-2xl bg-white"
              title="PDF Reader Frame"
            />
          </div>
        </div>
      )}
    </div>
  );
}
