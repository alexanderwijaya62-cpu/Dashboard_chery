import React, { useState } from 'react';
import { Search, Truck, Package, CheckCircle2, Clock, AlertCircle, Info, Copy, ExternalLink, ArrowRight, CornerDownRight } from 'lucide-react';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

const PublicTracking = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isBlockedByDhl, setIsBlockedByDhl] = useState(false);
  const [shipments, setShipments] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = trackingNumber.trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMsg(null);
    setIsBlockedByDhl(false);
    setHasSearched(true);
    setShipments([]);

    try {
      const resp = await fetch(`/api/dhl_tracking?trackingNumber=${encodeURIComponent(query)}`);
      
      // Jika DHL memblokir via Akamai (biasanya status 428 atau HTML page challenge)
      if (resp.status === 428 || resp.status === 403) {
        setIsBlockedByDhl(true);
        setIsLoading(false);
        return;
      }

      if (!resp.ok) {
        throw new Error('Gagal mengambil data dari server DHL');
      }
      
      const data = await resp.json();
      
      // Deteksi jika respon diblokir Akamai (berupa object challenge)
      if (data?.['sec-cp-challenge'] || data?.error?.includes('blocked') || data?.details?.includes('blocked')) {
        setIsBlockedByDhl(true);
      } else if (data?.shipments && data.shipments.length > 0) {
        setShipments(data.shipments);
      } else {
        setErrorMsg(`Nomor tracking "${query}" tidak ditemukan atau belum memiliki riwayat pengiriman.`);
      }
    } catch (err) {
      console.error(err);
      // Fallback ke redirect jika API gagal diakses / error CORS
      setIsBlockedByDhl(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    Toastify({
      text: "📋 Nomor tracking berhasil disalin!",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(135deg, #1f2937, #111827)", borderRadius: "12px" }
    }).showToast();
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getStatusConfig = (statusCode) => {
    const code = statusCode?.toLowerCase();
    if (code === 'delivered' || code === 'delivered-to-receiver') {
      return {
        label: 'Tiba di Tujuan',
        color: 'from-emerald-500 to-teal-600 border-emerald-500/20 text-emerald-500',
        bg: 'bg-emerald-50 text-emerald-700',
        icon: <CheckCircle2 className="text-emerald-500" size={24} />
      };
    }
    if (code === 'transit' || code === 'in-transit' || code === 'shipped') {
      return {
        label: 'Dalam Perjalanan',
        color: 'from-blue-500 to-indigo-600 border-blue-500/20 text-blue-500',
        bg: 'bg-blue-50 text-blue-700',
        icon: <Truck className="text-blue-500" size={24} />
      };
    }
    return {
      label: 'Pre-Transit / Proses Gudang',
      color: 'from-amber-500 to-orange-600 border-amber-500/20 text-amber-500',
      bg: 'bg-amber-50 text-amber-700',
      icon: <Clock className="text-amber-500" size={24} />
    };
  };

  const dhlRedirectUrl = `https://www.dhl.com/id-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center w-full px-4 md:px-8 py-8 md:py-12 font-sans">
      
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Banner Header & Form Pencarian */}
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                    DHL Global Tracking
                  </div>
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                    Chery Parts
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Lacak Pengiriman Suku Cadang
                </h2>
                <p className="text-sm text-slate-500 max-w-xl font-medium">
                  Pantau status logistik suku cadang secara real-time langsung dari sistem DHL Global Forwarding.
                </p>
              </div>
              
              <div className="hidden md:flex items-center gap-2 bg-slate-100 p-3 rounded-2xl border border-slate-200">
                <Package className="text-slate-700 animate-pulse" size={28} />
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logistic Portal</p>
                  <p className="text-xs font-black text-slate-700">DMS Integrated</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Masukkan Nomor Resi / Tracking (Contoh: 0281181052)"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 focus:border-yellow-400 focus:bg-white rounded-2xl pl-12 pr-4 py-4 font-mono font-bold text-sm md:text-base outline-none shadow-sm transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-medium"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !trackingNumber.trim()}
                className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 px-8 py-4 rounded-2xl font-black text-sm md:text-base uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    <span>MENCARI...</span>
                  </>
                ) : (
                  <>
                    <span>LACAK BARANG</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Hasil Pelacakan */}
        {hasSearched && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="bg-white rounded-3xl p-12 text-center shadow-md border border-slate-100 space-y-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Menghubungi Server DHL...</h3>
                <p className="text-xs text-slate-400 font-medium">Mengambil status manifest cargo terbaru</p>
              </div>
            ) : isBlockedByDhl ? (
              /* fallback UI jika diblokir sistem Akamai */
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-yellow-100 flex flex-col items-center text-center space-y-6 max-w-xl mx-auto animate-fadeIn">
                <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 shadow-inner">
                  <LockChallengeIcon />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-900">Verifikasi Keamanan Diperlukan</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                    Sistem keamanan DHL (Akamai) memerlukan interaksi manusia untuk membuka detail nomor tracking ini. Silakan klik tombol di bawah untuk membukanya secara instan di portal resmi DHL.
                  </p>
                </div>
                <div className="w-full pt-2">
                  <a 
                    href={dhlRedirectUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-slate-900 hover:bg-black text-white py-4 px-6 rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <span>Lacak di Website Resmi DHL</span>
                    <ExternalLink size={16} />
                  </a>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  No. Tracking: {trackingNumber}
                </div>
              </div>
            ) : errorMsg ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-red-100 shadow-lg max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-900">Resi Tidak Ditemukan</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{errorMsg}</p>
                <p className="text-[11px] text-slate-400">Pastikan nomor tracking yang diinput sudah benar sesuai dengan instruksi dealer.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {shipments.map((shipment, index) => {
                  const statusConf = getStatusConfig(shipment.status?.statusCode);
                  return (
                    <div key={index} className="space-y-6">
                      
                      {/* Ringkasan Status Box */}
                      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INFORMASI RESI</p>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl md:text-2xl font-black font-mono text-slate-800 tracking-wider">
                              {trackingNumber}
                            </h3>
                            <button 
                              onClick={() => handleCopy(trackingNumber)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                              title="Salin Nomor Resi"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <span>Service: <strong className="text-slate-700 font-mono uppercase">{shipment.service || 'DHL'}</strong></span>
                            <span>•</span>
                            <span>Product: <strong className="text-slate-700">{shipment.details?.product?.productName || 'Warehouse Order'}</strong></span>
                          </div>
                        </div>

                        <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4 w-full md:w-auto">
                          <div className={`px-4 py-3 rounded-2xl flex items-center gap-3 border ${statusConf.color} bg-slate-50`}>
                            {statusConf.icon}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Terkini</p>
                              <p className="text-sm font-black text-slate-800">{shipment.status?.status || statusConf.label}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Events & Details */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 space-y-6">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Truck size={18} className="text-yellow-500" />
                            Riwayat Perjalanan Paket
                          </h4>

                          <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-8 py-2">
                            {(shipment.events || []).map((event, eIdx) => {
                              const isFirst = eIdx === 0;
                              return (
                                <div key={eIdx} className="relative group">
                                  <span className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 flex items-center justify-center ${
                                    isFirst 
                                      ? 'bg-yellow-400 border-white ring-4 ring-yellow-400/20' 
                                      : 'bg-white border-slate-300'
                                  }`}></span>

                                  <div className="space-y-1.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                      <h5 className={`text-sm font-black tracking-tight ${isFirst ? 'text-yellow-600' : 'text-slate-700'}`}>
                                        {event.status}
                                      </h5>
                                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                                        {formatDateTime(event.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                      {event.description || 'Proses logistik terdaftar.'}
                                    </p>
                                    
                                    {event.location?.address?.addressLocality && (
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                        <span>📍 Lokasi:</span>
                                        <span className="text-slate-600 font-mono">
                                          {event.location.address.addressLocality}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 space-y-6">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Info size={18} className="text-red-500" />
                            Referensi & ID Sistem
                          </h4>

                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipment ID</p>
                              <p className="text-xs font-mono font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 break-all select-all mt-1">
                                {shipment.id}
                              </p>
                            </div>

                            {shipment.details?.references && shipment.details.references.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">References</p>
                                <div className="space-y-2.5">
                                  {shipment.details.references.map((ref, rIdx) => (
                                    <div key={rIdx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
                                      <CornerDownRight size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                      <div className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none">{ref.type}</p>
                                        <p className="text-xs font-mono font-bold text-slate-800 break-all select-all">{ref.number}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// Ikon Challenge Keamanan Gembok/Kunci custom
const LockChallengeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

export default PublicTracking;
