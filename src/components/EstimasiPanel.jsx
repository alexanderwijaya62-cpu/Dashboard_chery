import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Plus, Trash2, Download, FileText, Wrench, Package, RefreshCw,
  Calculator, Check, CheckCircle, AlertCircle, Car, X
} from 'lucide-react';
import Toastify from 'toastify-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CHERY_DMS_URL } from '../utils/config';

const RATE_PER_HOUR = 285000;
const PPN_PERCENT = 11;
const JASA_MARKUP_PERCENT = 30;

function formatRp(val) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
}

function calculateLaborPrice(h) {
  if (!h && h !== 0) return 0;
  const num = parseFloat(h);
  if (isNaN(num)) return 0;
  const hours = num / 60;
  return Math.round(hours * RATE_PER_HOUR);
}

function calculateMarkupPrice(h) {
  return Math.round(calculateLaborPrice(h) * (1 + JASA_MARKUP_PERCENT / 100));
}

function parseLaborHour(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function resolveLaborHour(svcObj, catCode) {
  const top = parseLaborHour(svcObj?.laborHour);
  if (top > 0) return top;
  const cats = Array.isArray(svcObj?.productCategories) ? svcObj.productCategories : [];
  if (catCode) {
    const match = cats.find(c => (c.productCategoryCode === catCode || c.code === catCode) && parseLaborHour(c.laborHour) > 0);
    if (match) return parseLaborHour(match.laborHour);
  }
  const any = cats.find(c => parseLaborHour(c.laborHour) > 0);
  if (any) return parseLaborHour(any.laborHour);
  return top;
}

function buildSvcObject(svcLike, catCode, laborHourOverride, parentId) {
  const laborHour = (laborHourOverride !== undefined && laborHourOverride !== null)
    ? parseLaborHour(laborHourOverride)
    : resolveLaborHour(svcLike, catCode);
  const svc = {
    workItemId: svcLike.workItemId || svcLike.id,
    workItemCode: svcLike.workItemCode || svcLike.code,
    workItemName: svcLike.workItemName || svcLike.workItemLocalName || svcLike.workItemEnglishName || svcLike.name || '',
    laborHour,
    dmsPrice: calculateLaborPrice(laborHour),
    price: calculateMarkupPrice(laborHour)
  };
  if (parentId) svc.parentId = parentId;
  return svc;
}

function formatLaborHour(h) {
  if (!h && h !== 0) return '-';
  const num = parseFloat(h);
  if (isNaN(num)) return '-';
  if (num >= 60) {
    const hours = Math.floor(num / 60);
    const mins = num % 60;
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  return `${num}m`;
}

const EstimasiPanel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estimation items: { code, name, price, qty, services: [{ workItemCode, workItemName, laborHour, price }] }
  const [items, setItems] = useState([]);

  // Service picker state per item code: { [code]: { query, results, loading, selected } }
  const [servicePick, setServicePick] = useState({});

  // Floating jasa picker: which item's dropdown is currently open
  const [openServiceCode, setOpenServiceCode] = useState(null);
  const serviceWrapRefs = useRef({});
  const serviceModalRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!openServiceCode) return;
      const wrap = serviceWrapRefs.current[openServiceCode];
      const modal = serviceModalRef.current;
      if (wrap && wrap.contains(e.target)) return;
      if (modal && modal.contains(e.target)) return;
      setOpenServiceCode(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openServiceCode]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenServiceCode(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const searchParts = async (query) => {
    const q = (query || '').trim();
    if (!q || q.length < 3) {
      Toastify({ text: '⚠️ Masukkan minimal 3 karakter', style: { background: '#f59e0b' } }).showToast();
      return;
    }
    setIsSearching(true);
    setSearchResults([]);
    try {
      let resp = await fetch(`${CHERY_DMS_URL}?pageSize=10&status=1&pageIndex=0&code=${encodeURIComponent(q)}`);
      let result = await resp.json();
      let data = result.payload?.content || result.data || result.items || (Array.isArray(result) ? result : []);
      if (data.length === 0) {
        resp = await fetch(`${CHERY_DMS_URL}?pageSize=10&status=1&pageIndex=0&name=${encodeURIComponent(q)}`);
        result = await resp.json();
        data = result.payload?.content || result.data || result.items || (Array.isArray(result) ? result : []);
      }
      setSearchResults(data);
      if (data.length === 0) {
        Toastify({ text: '❌ Sparepart tidak ditemukan di DMS', style: { background: '#ef4444' } }).showToast();
      }
    } catch (e) {
      console.error('Estimasi Search Error:', e);
      Toastify({ text: '❌ Gagal mencari: ' + e.message, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsSearching(false);
    }
  };

  const addItem = (part) => {
    const priceExc = part.retailGuidePriceExcludingTax || part.retailGuidePrice || 0;
    setItems(prev => {
      if (prev.find(p => p.code === part.code)) {
        Toastify({ text: `${part.code} sudah ada di daftar`, style: { background: '#f59e0b' } }).showToast();
        return prev;
      }
      return [...prev, {
        code: part.code,
        name: part.name || part.code,
        price: priceExc,
        qty: 1,
        services: []
      }];    });
    setSearchResults(prev => prev.filter(r => r.code !== part.code));
  };

  const removeItem = (code) => {
    setItems(prev => prev.filter(p => p.code !== code));
    setServicePick(prev => { const { [code]: _, ...rest } = prev; return rest; });
  };

  const updateItem = (code, patch) => {
    setItems(prev => prev.map(p => p.code === code ? { ...p, ...patch } : p));
  };

  const searchServices = async (code, query) => {
    const q = (query || '').trim();
    setServicePick(prev => ({ ...prev, [code]: { ...prev[code], loading: true, query: q, results: [], error: null } }));
    try {
      let url = `${CHERY_DMS_URL}?endpoint=work-item-categories&pageIndex=0&pageSize=50&status=1&sortField=workItemCode`;
      // Search by keyword if user typed something; otherwise fall back to the part code
      if (q) {
        url += `&keyword=${encodeURIComponent(q)}`;
      } else {
        url += `&partCode=${encodeURIComponent(code)}`;
      }
      const vf = (vehicleFilter || '').trim();
      if (vf) {
        url += `&search=${encodeURIComponent(vf)}`;
      }
      const resp = await fetch(url);
      const resJson = await resp.json();
      const content = resJson?.payload?.content || [];
      const deduped = [];
      const seen = new Set();
      const seenNameHour = new Set();
      content.forEach(svc => {
        const codeK = svc.workItemCode || svc.workItemId || svc.id;
        const k = codeK || svc.workItemName;
        const nameHour = `${(svc.workItemName || svc.workItemLocalName || svc.workItemEnglishName || '').trim().toLowerCase()}|${svc.laborHour ?? ''}`;
        if (k && seen.has(k)) return;
        if (seenNameHour.has(nameHour)) return;
        if (k) seen.add(k);
        seenNameHour.add(nameHour);
        deduped.push(svc);
      });
      setServicePick(prev => ({ ...prev, [code]: { ...prev[code], loading: false, results: deduped, error: deduped.length === 0 ? 'Tidak ada jasa yang cocok' : null } }));
    } catch (e) {
      console.error('Estimasi Jasa Search Error:', e);
      setServicePick(prev => ({ ...prev, [code]: { ...prev[code], loading: false, error: e.message } }));
    }
  };

  const searchServicesForVehicle = () => {
    if (items.length === 0) {
      Toastify({ text: '⚠️ Tambahkan sparepart dulu ke daftar estimasi', style: { background: '#f59e0b' } }).showToast();
      return;
    }
    items.forEach(item => searchServices(item.code, ''));
  };

  const toggleService = async (itemCode, svc) => {
    const item = items.find(p => p.code === itemCode);
    if (!item) return;
    const targetId = svc.workItemId || svc.id || svc.workItemCode;
    const isSelected = item.services.some(s => s.workItemId === targetId || s.workItemCode === svc.workItemCode);

    if (isSelected) {
      setItems(prev => prev.map(p => {
        if (p.code !== itemCode) return p;
        return {
          ...p,
          services: p.services.filter(s =>
            (s.workItemId !== targetId && s.workItemCode !== svc.workItemCode) &&
            s.parentId !== targetId
          )
        };
      }));
      return;
    }

    try {
      const id = svc.workItemId || svc.id;
      let assistList = [];
      if (id) {
        const resp = await fetch(`/api/chery_dms?endpoint=work-item-detail&id=${id}`);
        if (resp.ok) {
          const detailRes = await resp.json();
          const detail = detailRes.payload || detailRes;
          if (Array.isArray(detail?.assistItems)) {
            assistList = detail.assistItems;
          }
        }
      }

      const catCode = svc.productCategoryCode || svc.productCategoryName || '';
      const mainSvc = buildSvcObject(svc, catCode);
      const mainKey = mainSvc.workItemId || mainSvc.workItemCode;

      const extraSvcs = await Promise.all(assistList.map(async ast => {
        let laborHour = resolveLaborHour(ast, catCode);
        if (laborHour <= 0) {
          const astId = ast.workItemId || ast.id;
          if (astId) {
            try {
              const r = await fetch(`/api/chery_dms?endpoint=work-item-detail&id=${encodeURIComponent(astId)}`);
              if (r.ok) {
                const dd = await r.json();
                const det = dd.payload || dd;
                laborHour = resolveLaborHour(det, catCode);
              }
            } catch (e) {
              console.warn('Gagal mengambil detail jasa assist:', e);
            }
          }
        }
        return buildSvcObject(ast, catCode, laborHour, mainKey);
      }));

      setItems(prev => prev.map(p => {
        if (p.code !== itemCode) return p;
        const updatedServices = [...p.services];
        [mainSvc, ...extraSvcs].forEach(newSvc => {
          const exists = updatedServices.some(s => {
            if (newSvc.workItemId && s.workItemId === newSvc.workItemId) return true;
            if (newSvc.workItemCode && s.workItemCode === newSvc.workItemCode) return true;
            return false;
          });
          if (!exists) {
            updatedServices.push(newSvc);
          }
        });
        return { ...p, services: updatedServices };
      }));

      if (assistList.length > 0) {
        Toastify({
          text: `⚠️ Jasa ini memiliki ${assistList.length} jasa assist — otomatis ditambahkan (termasuk waktu & harga +${JASA_MARKUP_PERCENT}%)`,
          style: { background: '#f59e0b' }
        }).showToast();
      }
    } catch (err) {
      console.error('Gagal mengambil detail jasa pengerjaan:', err);
      setItems(prev => prev.map(p => {
        if (p.code !== itemCode) return p;
        return { ...p, services: [...p.services, buildSvcObject(svc, svc.productCategoryCode || svc.productCategoryName || '')] };
      }));
    }
  };

  const updateServicePrice = (itemCode, svcIndex, price) => {
    setItems(prev => prev.map(p => {
      if (p.code !== itemCode) return p;
      const services = [...p.services];
      services[svcIndex] = { ...services[svcIndex], price: Math.max(0, parseInt(price) || 0) };
      return { ...p, services };
    }));
  };

  const removeService = (itemCode, svcIndex) => {
    setItems(prev => prev.map(p => {
      if (p.code !== itemCode) return p;
      const target = p.services[svcIndex];
      if (!target) return p;
      const targetId = target.workItemId || target.workItemCode;
      return {
        ...p,
        services: p.services.filter(s => {
          const sid = s.workItemId || s.workItemCode;
          return sid !== targetId && s.parentId !== targetId;
        })
      };
    }));
  };

  const totals = useMemo(() => {
    const acc = items.reduce((acc, p) => {
      const qtyNum = parseInt(p.qty, 10) || 1;
      const partTotal = (p.price || 0) * qtyNum;
      const svcTotal = p.services.reduce((s, svc) => s + (svc.price || 0), 0);
      acc.parts += partTotal;
      acc.services += svcTotal;
      acc.grand += partTotal + svcTotal;
      return acc;
    }, { parts: 0, services: 0, grand: 0 });
    acc.ppn = Math.round(acc.grand * (PPN_PERCENT / 100));
    acc.grandInc = acc.grand + acc.ppn;
    return acc;
  }, [items]);

  const generatePdf = () => {
    if (items.length === 0) {
      Toastify({ text: '⚠️ Daftar estimasi masih kosong', style: { background: '#f59e0b' } }).showToast();
      return;
    }

    const doc = new jsPDF('landscape');
    const formatRpPdf = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

    // Build body: one row per sparepart, services summarized
    const pdfBody = items.map((p, i) => {
      const qtyNum = parseInt(p.qty, 10) || 1;
      const svcNames = p.services.map(s => s.workItemName || s.workItemCode).join('\n');
      const svcPrices = p.services.map(s => formatRpPdf(s.price)).join('\n');
      const partTotal = (p.price || 0) * qtyNum;
      const svcDmsTotal = p.services.reduce((s, svc) => s + (svc.price || 0), 0);
      return [
        i + 1,
        p.code,
        p.name,
        qtyNum,
        formatRpPdf(p.price),
        formatRpPdf(partTotal),
        svcNames || '-',
        svcPrices || '-',
        formatRpPdf(partTotal + svcDmsTotal)
      ];
    });

    const pdfSvcTotal = items.reduce((s, p) => s + p.services.reduce((x, svc) => x + (svc.price || 0), 0), 0);
    const pdfPartTotal = items.reduce((s, p) => s + ((p.price || 0) * (parseInt(p.qty, 10) || 1)), 0);
    const pdfGrand = pdfPartTotal + pdfSvcTotal;

    pdfBody.push([
      { content: 'TOTAL', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: formatRpPdf(pdfSvcTotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: formatRpPdf(pdfGrand), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } }
    ]);

    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text('CHERY ESTIMASI SPAREPART', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Tanggal: ${new Date().toLocaleString('id-ID')}`, 14, 26);
    doc.text(`Jumlah Item: ${items.length} sparepart(s)`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [['No', 'Part Number', 'Nama Part', 'Qty', 'Harga/Unit (Exc PPN)', 'Subtotal Part', 'Jasa Pengerjaan', 'Harga Jasa', 'Total']],
      body: pdfBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 55 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 55 },
        7: { cellWidth: 28, halign: 'right' },
        8: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto'
    });

    const finalY = doc.lastAutoTable.finalY || 40;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Estimasi (Exc PPN): ${formatRpPdf(pdfGrand)}`, 14, finalY + 8);
    doc.text(`Total Estimasi (Inc PPN ${PPN_PERCENT}%): ${formatRpPdf(Math.round(pdfGrand * (1 + PPN_PERCENT / 100)))}`, 14, finalY + 14);

    doc.save(`Estimasi_Sparepart_${Date.now()}.pdf`);
    Toastify({ text: '✅ PDF Estimasi berhasil diunduh!', style: { background: '#10b981' } }).showToast();
  };

  const pickerState = (code) => servicePick[code] || { query: '', results: [], loading: false, error: null };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-zinc-50">
      <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
              <Calculator className="text-zinc-900" size={24} />
              Estimasi Sparepart
            </h2>
            <p className="text-sm text-zinc-900 font-semibold mt-0.5">
              Cari sparepart, tentukan harga & qty, lalu pilih jasa pengerjaan yang sesuai
            </p>
          </div>
        </div>

        {/* SEARCH SPAREPART */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <label className="text-sm font-black text-zinc-900 uppercase tracking-[0.15em] ml-1 flex items-center gap-1.5">
            <Package size={15} /> Cari Sparepart (No Part / Nama)
          </label>
          <div className="flex gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setSearchResults([]);
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchParts(searchQuery)}
                placeholder="Contoh: 802000277AA"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 transition-all placeholder:text-zinc-400"
              />
              {isSearching && (
                <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" size={18} />
              )}
            </div>
            <button
              onClick={() => searchParts(searchQuery)}
              disabled={isSearching}
              className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-6 rounded-xl font-black text-sm transition-all active:scale-95"
            >
              CARI
            </button>
          </div>

          {/* VEHICLE TYPE FILTER — membatasi hasil jasa saat pencarian per tipe mobil */}
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchServicesForVehicle()}
                placeholder="Filter tipe mobil (opsional) — misal: TIGGO 8 / J6 / T1E"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* SEARCH RESULTS */}
          {searchResults.length > 0 && (
            <div className="mt-4 border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100">
              <div className="px-4 py-2 bg-zinc-50 flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                  {searchResults.length} hasil ditemukan — klik + untuk menambahkan
                </span>
                <button onClick={() => setSearchResults([])} className="text-xs font-black text-zinc-900 hover:text-zinc-700 uppercase">Tutup</button>
              </div>
              {searchResults.map((r, idx) => (
                <div key={r.code || idx} className="px-4 py-3 bg-white hover:bg-zinc-50 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-zinc-900">{r.code}</span>
                      {r.retailGuidePrice ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          {formatRp(r.retailGuidePriceExcludingTax || r.retailGuidePrice)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-zinc-900 font-semibold truncate mt-0.5">{r.name}</p>
                  </div>
                  <button
                    onClick={() => addItem(r)}
                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-600 transition-all active:scale-90"
                    title="Tambahkan ke estimasi"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ESTIMATION LIST */}
        {items.length === 0 ? (
          <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-10 flex flex-col items-center justify-center text-zinc-900 gap-3">
            <Calculator size={40} className="opacity-30" />
            <p className="text-base font-black">Belum ada sparepart di estimasi</p>
            <p className="text-sm font-semibold text-zinc-900">Cari sparepart di atas lalu klik tombol + untuk menambahkan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, itemIdx) => {
              const picker = pickerState(item.code);
              const qtyNum = parseInt(item.qty, 10) || 1;
              const partTotal = (item.price || 0) * qtyNum;
              const svcTotal = item.services.reduce((s, svc) => s + (svc.price || 0), 0);
              return (
                <div key={item.code} className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                  {/* ITEM HEADER */}
                  <div className="px-4 sm:px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                        {itemIdx + 1}
                      </span>
                      <span className="font-mono text-base font-black text-zinc-900">{item.code}</span>
                      <span className="text-sm text-zinc-900 font-semibold truncate hidden sm:block max-w-[300px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        {formatRp(partTotal + svcTotal)}
                      </span>
                      <button onClick={() => removeItem(item.code)} className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors" title="Hapus item">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* LEFT: HARGA + QTY */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-1 block">Harga Jual / Unit (Exc PPN)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">Rp</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updateItem(item.code, { price: Math.max(0, parseInt(e.target.value) || 0) })}
                              min={0}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-11 pr-3 py-2.5 text-sm font-black text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-1 block">Qty</label>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(item.code, { qty: e.target.value })}
                            onBlur={() => {
                              const n = parseInt(item.qty, 10);
                              updateItem(item.code, { qty: (!item.qty || isNaN(n) || n < 1) ? 1 : n });
                            }}
                            min={0}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-black text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 transition-all"
                          />
                        </div>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">Subtotal Part ({qtyNum} x {formatRp(item.price)})</span>
                        <span className="text-sm font-black text-zinc-900">{formatRp(partTotal)}</span>
                      </div>
                    </div>

                    {/* RIGHT: JASA */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench size={14} /> Jasa Pengerjaan (+{JASA_MARKUP_PERCENT}%) ({item.services.length} dipilih)
                      </label>

                      {/* SELECTED SERVICES */}
                      {item.services.length > 0 && (
                        <div className="space-y-1.5">
                          {item.services.map((svc, svcIdx) => (
                            <div key={`${svc.workItemId || svc.workItemCode || 'svc'}-${svcIdx}`} className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2">
                              <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-zinc-900 truncate">
                                  {svc.workItemCode ? <span className="font-mono text-emerald-700 mr-1">{svc.workItemCode}</span> : null}
                                  {svc.workItemName || '-'}
                                  {svc.parentId && (
                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md ml-1 uppercase align-middle">assist</span>
                                  )}
                                </p>
                                <p className="text-xs text-zinc-900 font-medium">{formatLaborHour(svc.laborHour)}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-zinc-900">Rp</span>
                                <input
                                  type="number"
                                  value={svc.price}
                                  onChange={(e) => updateServicePrice(item.code, svcIdx, e.target.value)}
                                  min={0}
                                  className="w-28 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-right text-sm font-black text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                                <button onClick={() => removeService(item.code, svcIdx)} className="p-1 text-zinc-500 hover:text-red-500 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* FLOATING JASA SEARCH — buka modal overlay */}
                      <div className="relative" ref={el => { serviceWrapRefs.current[item.code] = el; }}>
                        <button
                          onClick={() => {
                            setOpenServiceCode(item.code);
                            if (picker.results.length === 0 && !picker.loading) searchServices(item.code, picker.query);
                          }}
                          className="w-full flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-left transition-all hover:border-zinc-300 hover:bg-white active:scale-[0.99]"
                        >
                          <Wrench size={15} className="text-zinc-400 shrink-0" />
                          <span className="flex-1 text-sm font-semibold text-zinc-500 truncate">
                            {item.services.length > 0
                              ? `${item.services.length} jasa dipilih — ketuk untuk tambah lagi`
                              : 'Cari & pilih jasa pengerjaan (bisa lebih dari satu)...'}
                          </span>
                          {picker.loading ? (
                            <RefreshCw size={15} className="text-zinc-500 animate-spin shrink-0" />
                          ) : (
                            <span className="flex items-center gap-1 bg-zinc-900 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shrink-0">
                              <Search size={11} /> Pilih
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== FLOATING JASA MODAL — muncul di depan layar ===== */}
      {openServiceCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setOpenServiceCode(null)} />
          <div ref={serviceModalRef} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[85vh] flex flex-col">
            {/* MODAL HEADER */}
            <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Wrench size={18} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-wider leading-tight">Pilih Jasa Pengerjaan</p>
                  <p className="text-[11px] text-zinc-400 font-semibold truncate">
                    {items.find(i => i.code === openServiceCode)?.code || ''} — bisa pilih lebih dari satu
                  </p>
                </div>
              </div>
              <button onClick={() => setOpenServiceCode(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Tutup">
                <X size={18} />
              </button>
            </div>

            {/* MODAL SEARCH INPUT */}
            <div className="px-5 pt-4 shrink-0">
              <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zinc-900/15 focus-within:border-zinc-900 transition-all">
                <Search size={16} className="text-zinc-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={servicePick[openServiceCode]?.query || ''}
                  onChange={(e) => searchServices(openServiceCode, e.target.value)}
                  placeholder="Ketik nama / kode jasa..."
                  className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
                />
                {servicePick[openServiceCode]?.loading && <RefreshCw size={15} className="text-zinc-500 animate-spin shrink-0" />}
              </div>
            </div>

            {/* MODAL RESULTS */}
            <div className="px-5 py-3 flex-1 overflow-y-auto custom-scrollbar min-h-0">
              {servicePick[openServiceCode]?.loading ? (
                <div className="py-12 text-center text-sm font-bold text-zinc-400">
                  <RefreshCw size={24} className="inline animate-spin mr-2" /> Mencari jasa...
                </div>
              ) : (servicePick[openServiceCode]?.results?.length || 0) === 0 ? (
                <div className="py-12 text-center text-sm font-bold text-zinc-400">
                  <AlertCircle size={20} className="inline mr-2 text-amber-500" />
                  {servicePick[openServiceCode]?.error || 'Ketik kata kunci untuk mencari jasa'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  <div className="px-1 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                    <span>{servicePick[openServiceCode]?.results.length} jasa ditemukan</span>
                    <span>{items.find(i => i.code === openServiceCode)?.services?.length || 0} sudah dipilih</span>
                  </div>
                  {servicePick[openServiceCode].results.map((svc, svcIdx) => {
                    const isSelected = (items.find(i => i.code === openServiceCode)?.services || []).some(s => s.workItemId === (svc.workItemId || svc.id || svc.workItemCode) || s.workItemCode === svc.workItemCode);
                    const svcPrice = calculateMarkupPrice(svc.laborHour);
                    return (
                      <button
                        key={`${svc.workItemId || svc.id || 'svc'}-${svcIdx}`}
                        onClick={() => toggleService(openServiceCode, svc)}
                        className={`w-full flex items-center gap-3 px-2 py-2.5 text-left transition-colors rounded-lg ${isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-zinc-50'}`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-zinc-300'}`}>
                          {isSelected && <Check size={13} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-zinc-900 truncate">
                            {svc.workItemCode ? <span className="font-mono text-zinc-700 mr-1">{svc.workItemCode}</span> : null}
                            {svc.workItemName || svc.workItemLocalName || '-'}
                          </p>
                          <p className="text-xs text-zinc-900 font-medium">
                            {formatLaborHour(svc.laborHour)} • {svc.productCategoryName || svc.productCategoryCode || ''}
                          </p>
                        </div>
                        <span className="text-sm font-black text-emerald-700 shrink-0">{formatRp(svcPrice)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-zinc-600">
                Dipilih: {items.find(i => i.code === openServiceCode)?.services?.length || 0} jasa
              </span>
              <button
                onClick={() => setOpenServiceCode(null)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                <Check size={14} /> Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM BAR — selalu tampil di bawah layar */}
      {items.length > 0 && (
        <div className="shrink-0 bg-zinc-900 text-white border border-zinc-800 mx-2 sm:mx-4 mb-2 rounded-2xl px-4 sm:px-6 py-3.5 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Sparepart</span>
                <span className="text-base sm:text-lg font-black">{formatRp(totals.parts)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Jasa</span>
                <span className="text-base sm:text-lg font-black">{formatRp(totals.services)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">PPN {PPN_PERCENT}%</span>
                <span className="text-base sm:text-lg font-black">{formatRp(totals.ppn)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Total (Inc PPN)</span>
                <span className="text-lg sm:text-xl font-black text-emerald-400">{formatRp(totals.grandInc)}</span>
              </div>
            </div>
            <button
              onClick={generatePdf}
              className="flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 px-5 sm:px-6 py-2.5 rounded-xl font-black text-sm sm:text-base transition-all active:scale-95 shrink-0"
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .animate-slide-up { animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default EstimasiPanel;
