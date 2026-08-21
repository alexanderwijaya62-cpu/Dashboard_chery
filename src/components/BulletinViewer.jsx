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
  const [brandFilter, setBrandFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState({}); // frontend pagination cache

  // PDF Viewer Modal state
  const [activePdf, setActivePdf] = useState(null); // holds { fileId, fileName }
  const [pdfSearchWord, setPdfSearchWord] = useState('');
  const [forceIframeReload, setForceIframeReload] = useState(0);

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
        setPdfSearchWord(''); // Reset search
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

  // Directly fetch details and trigger PDF download
  const handleDirectDownload = async (bill) => {
    setIsLoading(true);
    try {
      const companyType = '2';
      const companyCode = '10007901';
      const companyName = 'ORIENTAL SM RAJA AMPLAS';
      
      const resp = await fetch(`/api/chery_dms?endpoint=announcement-detail&id=${bill.id}&companyType=${companyType}&companyCode=${companyCode}&companyName=${encodeURIComponent(companyName)}`);
      const result = await resp.json();
      
      const detailObj = result.payload || result || null;
      if (detailObj && detailObj.attachments && detailObj.attachments.length > 0) {
        const file = detailObj.attachments[0];
        const downloadUrl = `/api/chery_dms?endpoint=download_file&id=${file.fileId}${getAuthQueryParams()}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Toastify({ text: `📥 Mengunduh: ${file.fileName}`, style: { background: "#10b981" } }).showToast();
      } else {
        Toastify({ text: "⚠️ Bulletin ini tidak memiliki lampiran file", style: { background: "#eab308" } }).showToast();
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal mengunduh file", style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered bills by search query & brand prefix
  const getFilteredBills = () => {
    let filtered = bills;
    
    // Brand prefix filter
    if (brandFilter === 'chery') {
      filtered = filtered.filter(b => 
        (b.title && b.title.trim().toUpperCase().startsWith('CSTB')) || 
        (b.code && b.code.trim().toUpperCase().startsWith('CSTB'))
      );
    } else if (brandFilter === 'jaecoo') {
      filtered = filtered.filter(b => 
        (b.title && b.title.trim().toUpperCase().startsWith('OJWB')) || 
        (b.code && b.code.trim().toUpperCase().startsWith('OJWB'))
      );
    }

    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase().trim();
    return filtered.filter(b => 
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

      {/* Full Width Table Layout */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[500px]">
        <div>
          {/* Brand Tabs Selection */}
          <div className="flex border-b border-zinc-200 bg-zinc-100/50 p-2 gap-2 select-none shrink-0">
            <button
              onClick={() => setBrandFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                ${brandFilter === 'all' 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'bg-transparent text-zinc-650 hover:bg-zinc-200/50'}`}
            >
              Semua Bulletin
            </button>
            <button
              onClick={() => setBrandFilter('chery')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5
                ${brandFilter === 'chery' 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'bg-transparent text-zinc-650 hover:bg-zinc-200/50'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Chery (CSTB)
            </button>
            <button
              onClick={() => setBrandFilter('jaecoo')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5
                ${brandFilter === 'jaecoo' 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'bg-transparent text-zinc-650 hover:bg-zinc-200/50'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              Jaecoo (OJWB)
            </button>
          </div>

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

          {/* Desktop Table View - Hidden on Mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-24 text-center">Status</th>
                  <th className="py-3 px-4 w-48">Nomor Dokumen</th>
                  <th className="py-3 px-4">Judul Bulletin</th>
                  <th className="py-3 px-4 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs font-semibold text-zinc-750">
                {isLoading && bills.length === 0 ? (
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
                  getFilteredBills().map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${b.status === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {b.status === 3 ? 'Active' : b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">{b.code}</td>
                      <td className="py-3.5 px-4 text-zinc-900 font-bold" title={b.title}>
                        {b.title}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDirectRead(b)}
                            className="bg-zinc-950 hover:bg-zinc-800 text-white p-2 rounded-md transition-colors flex items-center justify-center gap-1 text-[10px] font-black uppercase"
                            title="Baca Langsung PDF"
                          >
                            <Eye size={12} />
                            BACA
                          </button>
                          <button
                            onClick={() => handleDirectDownload(b)}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 p-2 rounded-md transition-colors flex items-center justify-center"
                            title="Unduh PDF"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Stack View - Shown only on Mobile */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading && bills.length === 0 ? (
              <div className="py-16 text-center text-zinc-400">
                <Loader2 className="animate-spin mx-auto text-zinc-600 mb-2" size={24} />
                <span className="font-bold uppercase tracking-widest text-[9px]">Memuat data bulletin...</span>
              </div>
            ) : getFilteredBills().length === 0 ? (
              <div className="py-12 text-center text-zinc-400 italic text-xs">
                Tidak ada bulletin yang ditemukan
              </div>
            ) : (
              getFilteredBills().map((b) => (
                <div key={b.id} className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-zinc-500">{b.code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${b.status === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.status === 3 ? 'Active' : b.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-zinc-900 leading-normal">{b.title}</h4>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => handleDirectRead(b)}
                      className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-white py-2 rounded-lg text-center text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1"
                    >
                      <Eye size={12} />
                      BACA
                    </button>
                    <button
                      onClick={() => handleDirectDownload(b)}
                      className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 p-2 rounded-lg flex items-center justify-center"
                      title="Unduh PDF"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
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

      {/* Online PDF Viewer Overlay / Modal */}
      {activePdf && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99999] flex flex-col justify-between p-3 md:p-6 transition-all duration-300 animate-in fade-in">
          {/* Header Bar */}
          <div className="bg-zinc-900 text-white rounded-t-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 shadow-lg select-none gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText size={18} className="text-red-500 shrink-0" />
              <h3 className="font-black text-xs md:text-sm uppercase tracking-wider truncate" title={activePdf.fileName}>
                Membaca: {activePdf.fileName}
              </h3>
            </div>
            
            {/* Search Input In-PDF */}
            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-2.5 py-1">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Cari Teks:</span>
              <input
                type="text"
                value={pdfSearchWord}
                onChange={(e) => setPdfSearchWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setForceIframeReload(prev => prev + 1);
                  }
                }}
                placeholder="Ketik kata kunci & Enter..."
                className="bg-zinc-950 text-white text-[11px] px-2 py-0.5 rounded border border-zinc-700 outline-none w-32 md:w-48 placeholder:text-zinc-650"
              />
              <button 
                onClick={() => setForceIframeReload(prev => prev + 1)}
                className="bg-zinc-700 hover:bg-zinc-600 text-white text-[9px] px-2.5 py-0.5 rounded font-black uppercase transition-colors"
              >
                Cari
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
              <a
                href={`/api/chery_dms?endpoint=download_file&id=${activePdf.fileId}${getAuthQueryParams()}`}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                <Download size={12} />
                Download
              </a>
              <button 
                onClick={() => {
                  setActivePdf(null);
                  setPdfSearchWord('');
                }}
                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-full transition-colors flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Iframe Viewport Container */}
          <div className="flex-1 bg-zinc-900/60 p-2 flex items-center justify-center relative overflow-hidden">
            <iframe
              key={forceIframeReload}
              src={`/api/chery_dms?endpoint=download_file&inline=true&id=${activePdf.fileId}${getAuthQueryParams()}${pdfSearchWord.trim() ? `#search=${encodeURIComponent(pdfSearchWord.trim())}` : ''}`}
              className="w-full h-full border-none rounded-b-xl shadow-2xl bg-white"
              title="PDF Reader Frame"
            />
          </div>
        </div>
      )}

      {/* Global Loader Backdrop during fetches */}
      {isLoading && bills.length > 0 && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100000] flex items-center justify-center select-none pointer-events-none">
          <div className="bg-zinc-950/90 text-white border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-2xl">
            <Loader2 className="animate-spin text-white" size={32} />
            <span className="text-[10px] font-black uppercase tracking-widest">Memproses File DMS...</span>
          </div>
        </div>
      )}
    </div>
  );
}
