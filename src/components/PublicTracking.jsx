import React, { useState, useEffect } from 'react';
import { Search, Truck, Package, CheckCircle2, Clock, ExternalLink, AlertCircle, Info, UserCheck } from 'lucide-react';

const CHERY_DMS_URL = '/api/chery_dms';

// Helper fetch dengan timeout 5 detik
const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

const PublicTracking = ({ setCurrentPage }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Daftar hasil pelacakan lengkap
  const [trackingList, setTrackingList] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    const custInput = customerNameInput.trim();
    if (!query || !custInput) return;

    setIsLoading(true);
    setErrorMsg(null);
    setHasSearched(true);
    setTrackingList([]);

    try {
      let isDirectResi = /^\d+$/.test(query) || (query.startsWith('0') && /^\d+$/.test(query));
      let collectedItems = [];

      if (!isDirectResi) {
        // Ambil kode dasar (hilangkan akhiran _01 jika user terlanjur ketik)
        let baseQuery = query.replace(/_0\d$/, '');

        // 1. Lakukan pencarian cepat ke part_orders untuk mendapatkan semua pesanan
        let matchedOrders = [];
        try {
          const resp = await fetchWithTimeout(`${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=0&pageSize=30&orderCode=${encodeURIComponent(baseQuery)}`, {}, 6000);
          const result = await resp.json();
          let content = result?.payload?.content || [];
          matchedOrders = content.filter(item => item.code?.toUpperCase().includes(baseQuery.toUpperCase()));

          // Jika kosong, coba fallback query dengan pancingan _01
          if (matchedOrders.length === 0) {
            const respFallback = await fetchWithTimeout(`${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=0&pageSize=10&orderCode=${encodeURIComponent(baseQuery + '_01')}`, {}, 5000);
            const resFallback = await respFallback.json();
            const fallbackContent = resFallback?.payload?.content || [];
            if (fallbackContent.length > 0) {
              matchedOrders = fallbackContent;
            }
          }
        } catch (err) {
          console.warn("DMS part_orders fetch timeout or error", err);
        }

        if (matchedOrders.length > 0) {
          // Ambil rincian part & verifikasi Nama/NIK secara paralel
          const detailPromises = matchedOrders.map(async (item) => {
            try {
              const r = await fetchWithTimeout(`${CHERY_DMS_URL}?endpoint=part_order_detail&orderId=${item.id}`, {}, 5000);
              const dRes = await r.json();
              if (dRes?.payload) return dRes.payload;
            } catch (err) {
              console.warn(`Gagal fetch detail order ${item.id}`, err);
            }
            return null;
          });

          const detailsResults = (await Promise.all(detailPromises)).filter(Boolean);
          let foundAnyOrder = detailsResults.length > 0;

          detailsResults.forEach(orderData => {
            const allDetails = orderData.partSaleOrderDetails || orderData.details || [];
            const custLower = custInput.toLowerCase();
            const isAll = custLower === 'all' || custLower === '*' || custLower === 'admin';

            let hasSap = false;

            if (orderData.partSaleOrderProcesses && orderData.partSaleOrderProcesses.length > 0) {
              orderData.partSaleOrderProcesses.forEach(proc => {
                if (proc.sapDeliveryCode) {
                  hasSap = true;
                  let procSpecificParts = [];
                  const pDetails = proc.processDetails || [];

                  pDetails.forEach(pd => {
                    const matchedDetail = allDetails.find(d => d.partId === pd.partId || d.partCode === pd.partCode) || {};
                    const desc = matchedDetail.orderDescription || '';
                    const outQty = (pd.outQuantity !== undefined && pd.outQuantity !== null) ? pd.outQuantity : (pd.deliveryQuantity || pd.processQuantity || 0);

                    if (outQty > 0) {
                      const partName = pd.partName || matchedDetail.partName || pd.name || '-';
                      const partCode = pd.partCode || matchedDetail.partCode || pd.code || '-';

                      const matchCustomer = isAll ||
                        desc.toLowerCase().includes(custLower) ||
                        partName.toLowerCase().includes(custLower) ||
                        partCode.toLowerCase().includes(custLower);

                      if (matchCustomer) {
                        procSpecificParts.push({
                          ...pd,
                          partName,
                          partCode,
                          quantity: outQty,
                          orderDescription: desc
                        });
                      }
                    }
                  });

                  if (procSpecificParts.length > 0) {
                    collectedItems.push({
                      sapCode: proc.sapDeliveryCode,
                      processCode: proc.code,
                      orderCode: orderData.code,
                      orderDate: orderData.createTime,
                      parts: procSpecificParts,
                      submitter: orderData.submitterName || 'Fitria / Admin'
                    });
                  }
                }
              });
            }

            if (!hasSap) {
              let pendingParts = [];
              allDetails.forEach(d => {
                const desc = d.orderDescription || '';
                const partName = d.partName || d.name || '-';
                const partCode = d.partCode || d.code || '-';
                const qty = (d.orderQuantity !== undefined ? d.orderQuantity : (d.quantity || d.count || 1));

                const matchCustomer = isAll ||
                  desc.toLowerCase().includes(custLower) ||
                  partName.toLowerCase().includes(custLower) ||
                  partCode.toLowerCase().includes(custLower);

                if (matchCustomer && qty > 0) {
                  pendingParts.push({
                    ...d,
                    partName,
                    partCode,
                    quantity: qty,
                    orderDescription: desc
                  });
                }
              });

              if (pendingParts.length > 0) {
                collectedItems.push({
                  sapCode: null,
                  processCode: orderData.code,
                  orderCode: orderData.code,
                  orderDate: orderData.createTime,
                  parts: pendingParts,
                  submitter: orderData.submitterName || 'Fitria / Admin'
                });
              }
            }
          });

          if (foundAnyOrder && collectedItems.length === 0) {
            setErrorMsg(`Pemesanan dengan nomor PO "${query}" ditemukan, namun data atas nama / keterangan "${custInput}" tidak ditemukan pada rincian pengiriman. Silakan periksa kembali ejaan nama / NIK / keterangan Anda.`);
            setIsLoading(false);
            return;
          }
        }
      } else {
        // Jika input murni angka resi
        collectedItems.push({
          sapCode: query,
          processCode: "Nomor Resi SAP",
          orderCode: "Nomor Resi SAP",
          orderDate: new Date().toISOString(),
          parts: [],
          submitter: custInput
        });
      }

      // 2. Jika ada item, periksa status kedatangan di gudang DMS
      if (collectedItems.length > 0) {
        const checkPromises = collectedItems.map(async (item) => {
          let dmsShipmentData = null;
          let isReceivedInDms = false;

          if (item.processCode && !item.processCode.includes("Resi")) {
            try {
              const shipResp = await fetchWithTimeout(`${CHERY_DMS_URL}?endpoint=part_shipments&pageIndex=0&pageSize=10&processCode=${encodeURIComponent(item.processCode)}`, {}, 5000);
              const shipJson = await shipResp.json();
              const shipments = shipJson?.payload?.content || [];
              if (shipments.length > 0) {
                dmsShipmentData = shipments[0];
                isReceivedInDms = dmsShipmentData.status == 2 || dmsShipmentData.status == 3 || dmsShipmentData.status === "2";
              }
            } catch (err) { console.warn("Failed fetch part_shipments", err); }
          }

          return { ...item, dmsReceived: isReceivedInDms, dmsShipment: dmsShipmentData };
        });

        const finalResults = await Promise.all(checkPromises);
        setTrackingList(finalResults);
      } else if (!errorMsg) {
        setErrorMsg(`Pemesanan dengan nomor PO atau Resi "${query}" tidak ditemukan di server DMS Chery.`);
      }

    } catch (err) {
      setErrorMsg("Gagal menghubungi server pelacakan DMS Chery. Silakan coba beberapa saat lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center w-full px-3 md:px-8 py-6 md:py-10 animate-fadeIn font-sans">
      {/* Kotak Pencarian Utama */}
      <div className="w-full max-w-6xl bg-black text-white rounded-3xl p-6 md:p-12 shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-zinc-800/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-zinc-700/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-white/10 text-white rounded-2xl backdrop-blur-md flex items-center justify-center mx-auto shadow-inner border border-white/10">
              <Package size={32} />
            </div>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight">Lacak Suku Cadang & Verifikasi Pemesan</h2>
            <p className="text-xs md:text-base text-zinc-300 font-medium max-w-2xl mx-auto leading-relaxed">
              Masukkan nomor Purchase Order / Resi beserta Nama Lengkap atau NIK / No. KTP Anda untuk melihat status kedatangan suku cadang secara aman dan terverifikasi.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-4 pt-2 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={22} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="No. PO / Resi (Contoh: DD2026...)"
                  className="w-full bg-white text-black border-2 border-transparent focus:border-black rounded-2xl pl-14 pr-6 py-4 md:py-5 font-mono font-black text-sm md:text-base outline-none shadow-xl transition-all placeholder:text-zinc-400 placeholder:font-sans placeholder:font-medium"
                />
              </div>
              <div className="relative">
                <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={22} />
                <input 
                  type="text"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  placeholder="Nama Lengkap / NIK / No. KTP Pemesan..."
                  className="w-full bg-white text-black border-2 border-transparent focus:border-black rounded-2xl pl-14 pr-6 py-4 md:py-5 font-sans font-bold text-sm md:text-base outline-none shadow-xl transition-all placeholder:text-zinc-400 placeholder:font-sans placeholder:font-medium"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim() || !customerNameInput.trim()}
              className="w-full bg-white hover:bg-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-300 text-black px-8 py-4 md:py-5 rounded-2xl font-black text-sm md:text-base uppercase tracking-wider shadow-xl transition-all duration-150 flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>MEMVERIFIKASI & MENCARI DATA...</span>
                </>
              ) : (
                <>
                  <Truck size={20} />
                  <span>VERIFIKASI & LACAK PESANAN</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Hasil Pelacakan & Breakdown Suku Cadang */}
      {hasSearched && (
        <div className="w-full max-w-6xl space-y-8 animate-fadeIn">
          {isLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-zinc-200/80 space-y-4 animate-pulse">
              <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="text-lg font-black text-zinc-800 uppercase tracking-wider">Memverifikasi Identitas & Data Pesanan...</h3>
              <p className="text-xs text-zinc-500 font-medium">Mencocokkan Nama/NIK dengan server DMS Chery Indonesia</p>
            </div>
          ) : errorMsg ? (
            <div className="bg-red-50 rounded-3xl p-8 text-center border border-red-200 shadow-xl max-w-xl mx-auto space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-black text-zinc-900">Verifikasi Tidak Sesuai</h3>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed">{errorMsg}</p>
              <p className="text-[11px] text-zinc-400">Pastikan nomor PO dan Nama/NIK yang Anda ketik sama persis dengan saat pendaftaran pesanan di bengkel.</p>
            </div>
          ) : trackingList.length === 0 ? (
            <div className="bg-amber-50 rounded-3xl p-8 text-center border border-amber-200 shadow-xl max-w-xl mx-auto space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Info size={32} />
              </div>
              <h3 className="text-lg font-black text-zinc-900">Pesanan Belum Tercatat</h3>
              <p className="text-xs text-zinc-600 font-medium">Nomor PO "{searchQuery}" tidak memiliki rincian pengiriman di server DMS Chery saat ini.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              {/* Header Rangkuman Hasil */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-900 text-white p-6 rounded-3xl shadow-lg border border-zinc-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400 block tracking-widest font-mono">HASIL PENCARIAN TERVERIFIKASI</span>
                  <h3 className="text-xl md:text-2xl font-black font-mono tracking-wider">{searchQuery.toUpperCase()}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-2 bg-zinc-800 rounded-xl text-xs font-bold border border-zinc-700 flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-400" /> Pemesan: <strong className="text-white font-sans uppercase">{customerNameInput}</strong>
                  </span>
                  <span className="px-4 py-2 bg-zinc-800 rounded-xl text-xs font-bold border border-zinc-700">
                    📦 <strong className="text-white font-mono">{trackingList.length}</strong> Pengiriman Ditemukan
                  </span>
                </div>
              </div>

              {/* Daftar Kartu Pesanan / Resi */}
              <div className="space-y-8">
                {trackingList.map((item, idx) => {
                  const hasResi = !!item.sapCode;
                  const resiClean = hasResi ? item.sapCode.replace(/^0+/, '') : '';
                  const isDelivered = item.dmsReceived;

                  const partsListFormatted = (item.parts || []).map((p, i) => `${i + 1}. ${p.partName || p.name || '-'} (${p.partCode || p.code || '-'}) - ${p.quantity || p.count || 1} Pcs`).join('\n');
                  const waMsgText = `Halo Admin Chery Medan,\nSaya ingin mengonfirmasi pesanan suku cadang saya yang telah tiba di gudang dealer/bengkel.\n\n📌 Nama / NIK Pemesan: ${customerNameInput.trim()}\n📌 Kode Pengiriman: ${item.processCode || item.orderCode}\n📌 Resi SAP: #${item.sapCode || '-'}\n📌 Daftar Suku Cadang:\n${partsListFormatted}\n\nMohon informasi mengenai jadwal pemasangan / pengambilan suku cadang tersebut. Terima kasih!`;
                  const waUrl = `https://api.whatsapp.com/send?phone=6281263656724&text=${encodeURIComponent(waMsgText)}`;

                  return (
                    <div key={idx} className="bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden transition-all hover:border-zinc-300">
                      {/* Banner Status Atas */}
                      <div className={`p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b ${
                        isDelivered 
                          ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 border-emerald-900' 
                          : 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 border-amber-700'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white text-zinc-900 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner shrink-0 font-mono">
                            {item.processCode && item.processCode.includes('_') ? `#${item.processCode.split('_')[1]}` : `#${idx + 1}`}
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-black/30 text-white font-black text-[11px] px-2.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                                PO: {item.processCode || item.orderCode}
                              </span>
                              {hasResi ? (
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="font-mono text-base md:text-lg font-black tracking-wider">RESI SAP: #{item.sapCode}</span>
                                  {isDelivered && (
                                    <span className="bg-emerald-400 text-zinc-950 font-black text-[11px] px-2.5 py-0.5 rounded-md uppercase tracking-wider font-mono shadow">
                                      ✅ GUDANG MASUK (STATUS 2)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-sans text-sm md:text-base font-black tracking-wider uppercase text-amber-100">Menunggu Penjadwalan Kurir</span>
                              )}
                            </div>
                            <p className="text-xs text-white/90 font-bold flex items-center gap-2">
                              <span>Tanggal PO: {item.orderDate ? new Date(item.orderDate).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 md:p-8 space-y-8">
                        {/* Status Kurir / Gudang */}
                        {isDelivered ? (
                          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-emerald-400 animate-fadeIn">
                            <div className="flex items-center gap-5 w-full md:w-auto">
                              <div className="w-14 h-14 bg-white text-emerald-700 rounded-2xl flex items-center justify-center font-black shadow-lg shrink-0">
                                <CheckCircle2 size={32} className="animate-bounce" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-lg font-black uppercase tracking-wider text-white">✅ SUDAH TIBA DI GUDANG BENGKEL / DEALER</h4>
                                <p className="text-xs md:text-sm text-white/90 font-medium leading-relaxed max-w-xl">
                                  Suku cadang pesanan atas nama <strong className="font-bold underline">{customerNameInput}</strong> dengan kode <strong className="font-mono bg-black/20 px-2 py-0.5 rounded text-white">#{item.processCode || item.orderCode}</strong> telah tiba di gudang dealer. Silakan hubungi admin via WhatsApp untuk konfirmasi jadwal pemasangan.
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 w-full md:w-auto">
                              <a 
                                href={waUrl}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full md:w-auto px-6 py-4 bg-white hover:bg-zinc-100 text-emerald-800 font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-black/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                              >
                                💬 Hubungi Admin via WhatsApp
                              </a>
                            </div>
                          </div>
                        ) : hasResi ? (
                          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-amber-400 animate-fadeIn">
                            <div className="flex items-center gap-5 w-full md:w-auto">
                              <div className="w-14 h-14 bg-white text-amber-600 rounded-2xl flex items-center justify-center font-black shadow-lg shrink-0">
                                <Truck size={28} className="animate-bounce" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-lg font-black uppercase tracking-wider text-white">⏳ DALAM PENGIRIMAN KURIR / ON TRANSIT</h4>
                                <p className="text-xs md:text-sm text-white/90 font-medium leading-relaxed max-w-xl">
                                  Suku cadang pesanan atas nama <strong className="font-bold underline">{customerNameInput}</strong> dengan Resi SAP <strong className="font-mono bg-black/20 px-2 py-0.5 rounded text-white">#{item.sapCode}</strong> sedang dalam pengantaran kurir menuju gudang dealer bengkel.
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 w-full md:w-auto">
                              <a 
                                href={`https://jagoan-logistics.com/?track=${resiClean}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full md:w-auto px-6 py-4 bg-white hover:bg-zinc-100 text-amber-800 font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-black/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                              >
                                <ExternalLink size={18} /> Cek Live Posisi Paket di Web Jagoan
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                            <Clock className="text-amber-600 animate-spin shrink-0" size={28} />
                            <div>
                              <h4 className="text-base font-black uppercase text-amber-900">PROSES PENGEMASAN GUDANG PUSAT</h4>
                              <p className="text-xs text-amber-800 font-medium mt-0.5">Suku cadang sedang disiapkan di gudang Chery Indonesia dan menunggu jadwal pickup / alokasi nomor resi kurir.</p>
                            </div>
                          </div>
                        )}

                        {/* DAFTAR PART DALAM PENGIRIMAN INI (TANPA HARGA - UNTUK CUSTOMER) */}
                        {item.parts && item.parts.length > 0 ? (
                          <div className="space-y-4 pt-2">
                            <h4 className="text-xs md:text-sm font-black uppercase tracking-widest text-black flex items-center gap-2 border-l-4 border-black pl-3">
                              <Package size={18} className="text-black" /> Daftar Suku Cadang Terverifikasi ({item.parts.length} Item)
                            </h4>
                            <div className="border border-zinc-200 rounded-2xl overflow-x-auto shadow-sm">
                              <table className="w-full text-left border-collapse text-xs md:text-sm whitespace-nowrap md:whitespace-normal">
                                <thead>
                                  <tr className="bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-wider border-b border-zinc-200">
                                    <th className="px-5 py-3.5 w-16 text-center">No</th>
                                    <th className="px-4 py-3.5 w-48">Kode Part</th>
                                    <th className="px-4 py-3.5">Nama Suku Cadang / Deskripsi</th>
                                    <th className="px-5 py-3.5 w-24 text-center">Qty (Jumlah)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800 font-sans">
                                  {item.parts.map((p, pIdx) => {
                                    const qty = (p.quantity !== undefined ? p.quantity : (p.applyQuantity || p.count || 1));
                                    const cleanDesc = (p.orderDescription || '').replace(/\t/g, ' - ');
                                    return (
                                      <tr key={pIdx} className="hover:bg-zinc-50 transition-colors font-mono">
                                        <td className="px-5 py-3.5 text-center font-bold text-zinc-400">{pIdx + 1}</td>
                                        <td className="px-4 py-3.5 font-bold text-zinc-900">{p.partCode || p.code || '-'}</td>
                                        <td className="px-4 py-3.5 space-y-1">
                                          <div className="font-bold text-zinc-900 uppercase font-sans">{p.partName || p.name || '-'}</div>
                                          {cleanDesc && cleanDesc.trim() && cleanDesc.trim() !== '-' && (
                                            <div className="text-[11px] text-zinc-600 font-sans flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1 rounded-lg w-fit border border-zinc-200 font-medium mt-1">
                                              <span className="text-black font-bold shrink-0">Keterangan / Pemesan:</span>
                                              <span className="text-zinc-800">{cleanDesc}</span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center font-black bg-zinc-50/80 text-black text-base">{qty}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs italic text-zinc-400">Rincian nama suku cadang sedang disinkronisasi oleh sistem...</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Hak Cipta */}
      <div className="mt-16 text-center text-xs text-zinc-400 font-bold uppercase tracking-widest">
        Portal Pelacakan Suku Cadang Terverifikasi Chery DMS © 2026
      </div>
    </div>
  );
};

export default PublicTracking;
