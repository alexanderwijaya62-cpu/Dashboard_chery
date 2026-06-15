import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  FileText, 
  BarChart3, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  ChevronRight,
  User,
  Percent,
  TrendingUp,
  AlertCircle,
  Package,
  ArrowRight,
  MessageCircle,
  Settings,
  Share2,
  ChevronDown,
  Info,
  Hash,
  ClipboardList,
  RefreshCw,
  Key
} from 'lucide-react';
import { CHERY_DMS_URL, CHERY_EPC_URL, CHERY_EPC_LOGIN_URL, GATE } from '../utils/config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Components ---

export default function QuotationSPA({ onClose }) {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('chery_auth_user') || '{}'); } catch { return {}; }
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [masterParts, setMasterParts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [epcmToken, setEpcmToken] = useState(() => localStorage.getItem('chery_epcm_token') || '');
  const [isEpcLoggingIn, setIsEpcLoggingIn] = useState(false);
  const [epcmImages, setEpcmImages] = useState({});
  
  // Customer Details
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    vehicle: '',
    poNumber: ''
  });

  const [customerPreset, setCustomerPreset] = useState('RATU'); 
  const [customMarkup, setCustomMarkup] = useState(15);
  const [items, setItems] = useState([]);
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);

  const [invoiceMetadata, setInvoiceMetadata] = useState({
    no: `EST/${new Date().getFullYear()}/CHY/${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
  });

  // --- EPCM Auth Listener ---
  useEffect(() => {
    const handleGlobalUpdate = () => {
      const newToken = localStorage.getItem('chery_epcm_token');
      if (newToken) {
        setEpcmToken(newToken);
      }
    };
    window.addEventListener('epcm_token_updated', handleGlobalUpdate);
    return () => window.removeEventListener('epcm_token_updated', handleGlobalUpdate);
  }, []);

  const handleEpcAutoLogin = () => {
    const message = `CARA HUBUNGKAN EPCM (BOOKMARK):\n\n` +
      `1. Buka qrepcm.mychery.com & Pastikan sudah LOGIN.\n` +
      `2. Klik Bookmark 'GET TOKEN EPCM' Anda.\n` +
      `3. Dashboard ini akan otomatis terhubung & refresh.\n\n` +
      `Belum punya Bookmark? Mau masukkan manual?`;
    
    if (confirm(message)) {
      const manualToken = prompt("Masukkan Token EPCM Anda secara manual:");
      if (manualToken && manualToken.trim()) {
        setEpcmToken(manualToken.trim());
        localStorage.setItem('chery_epcm_token', manualToken.trim());
        alert("✅ EPCM Connected!");
      }
    }
  };

  const fetchEpcImages = async (partCode) => {
    if (!epcmToken || !partCode) return;
    try {
      const searchUrl = `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/search/fastSearch/part?keywordNumber=${partCode}&page=1&pageSize=5`)}`;
      const resp = await fetch(searchUrl);
      
      // If token expired (often returns 401 or a specific JSON success:false)
      if (resp.status === 401 || resp.status === 403) {
        setEpcmToken('');
        localStorage.removeItem('chery_epcm_token');
        return;
      }

      const result = await resp.json();
      
      // Check if EPCM API returned failure
      if (result.success === false) {
        if (result.message?.includes("token") || result.code === 401) {
           setEpcmToken('');
           localStorage.removeItem('chery_epcm_token');
        }
        return;
      }

      const contents = result.data?.contents || [];
      const partInfo = contents[0]; 
      
      if (partInfo && partInfo.imageIds && partInfo.imageIds.length > 0) {
        const imageUrls = partInfo.imageIds.map(id => 
          `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/base/file/view/${id}`)}`
        );
        setEpcmImages(prev => ({ ...prev, [partCode]: imageUrls }));
      }
    } catch (e) {
      console.error("EPCM Fetch Error for", partCode, e);
    }
  };

  const fetchDmsParts = async (code) => {
    if (!code || code.length < 3) {
      setMasterParts([]);
      return;
    }
    setIsSearching(true);
    try {
      // Use EXACT URL from OwnerPanel
      const resp = await fetch(`${CHERY_DMS_URL}?pageSize=10&status=1&code=${encodeURIComponent(code)}`, {
        headers: { 'x-api-key': GATE }
      });
      const result = await resp.json();
      const dmsData = result.payload?.content || result.data || result.items || (Array.isArray(result) ? result : []);
      setMasterParts(dmsData);

      if (epcmToken) {
        // Use item.code specifically
        const uniqueCodes = [...new Set(dmsData.map(item => item.code))];
        uniqueCodes.forEach(partCode => {
          if (partCode) fetchEpcImages(partCode);
        });
      }
    } catch (e) {
      console.error("DMS Search Error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => fetchDmsParts(searchTerm), 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, epcmToken]);

  const handleAddItem = (item) => {
    const part_number = item.code || '';
    const existing = items.find(i => i.part_number === part_number);
    
    // Base Price is Retail (Inc Tax)
    const basePrice = item.retailGuidePrice || item.price || 0;
    
    if (existing) {
      setItems(items.map(i => i.part_number === part_number ? { ...i, qty: (i.qty || 1) + 1 } : i));
    } else {
      setItems([...items, { 
        part_number,
        part_name: item.name || '',
        unit_price: basePrice,
        qty: 1, 
        discount: 0 
      }]);
    }
    setSearchTerm('');
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      // Since unit_price is already Inc Tax, we just apply discount
      const itemPriceAfterDiscount = item.unit_price - (item.discount || 0);
      return acc + (itemPriceAfterDiscount * (item.qty || 1));
    }, 0);
    
    const subtotalAfterGlobalDiscount = subtotal * (1 - globalDiscountPercent / 100);
    // If unit prices are Inc Tax, the grand total is just the subtotal after global discount.
    // However, usually we show PPN separately. 
    // If user wants "Retail inc tax" as unit price, maybe they want the breakdown?
    // Let's assume Grand Total = Subtotal (Inc Tax).
    const grandTotal = subtotalAfterGlobalDiscount;
    const ppn = grandTotal - (grandTotal / 1.11);
    const dpp = grandTotal - ppn;
    
    return { 
      subtotalRaw: subtotal,
      globalDiscountAmount: subtotal * (globalDiscountPercent / 100),
      subtotal: dpp, 
      ppn, 
      grandTotal 
    };
  }, [items, globalDiscountPercent]);

  const removeItem = (part_number) => {
    setItems(items.filter(i => i.part_number !== part_number));
  };

  const updateItem = (part_number, field, value) => {
    setItems(items.map(i => i.part_number === part_number ? { ...i, [field]: value } : i));
  };

  const downloadInvoice = () => {
    const userName = currentUser.name || currentUser.username || 'Guest';
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Helper: rupiah format
    const rp = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID');

    // ── Header ──
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, 40, 2, 'F');
    y += 6;
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(26);
    doc.text('ESTIMASI', margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('CHERY AUTHORIZED DEALER', margin, y);

    // Document number on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text('NOMOR DOKUMEN', pageW - margin, margin + 2, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(invoiceMetadata.no, pageW - margin, margin + 8, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Medan, ${invoiceMetadata.date}`, pageW - margin, margin + 16, { align: 'right' });
    if (currentUser.name) {
      doc.setFontSize(6);
      doc.setTextColor(180);
      doc.text(`Dibuat oleh: ${currentUser.name}`, pageW - margin, margin + 21, { align: 'right' });
    }

    y = margin + 28;

    // ── Separator line ──
    doc.setDrawColor(220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // ── Customer Info ──
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F');
    doc.setDrawColor(230);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(180);
    doc.text('DITUJUKAN KEPADA', margin + 5, y + 5);
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text((customerInfo.name || 'PELANGGAN UMUM').toUpperCase(), margin + 5, y + 13);
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(customerInfo.vehicle || 'ALL CHERY MODELS', margin + 5, y + 18);
    if (customerInfo.phone) {
      doc.text(customerInfo.phone, margin + 5, y + 23);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(180);
    doc.text('REFERENSI PO', pageW - margin - 5, y + 5, { align: 'right' });
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(customerInfo.poNumber || '-', pageW - margin - 5, y + 13, { align: 'right' });

    // Draf Estimasi badge
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(pageW - margin - 32, y + 17, 32, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255);
    doc.text('DRAF ESTIMASI', pageW - margin - 5, y + 22, { align: 'right' });

    y += 36;

    // ── Parts Table ──
    const tableHeaders = [['Part Number', 'Nama Part', 'Harga Satuan', 'Qty', 'Subtotal']];
    const tableRows = items.length === 0
      ? [['-', 'Belum ada item yang dipilih', '', '', '']]
      : items.map(item => {
          const fp = item.unit_price - (item.discount || 0);
          return [
            item.part_number,
            item.part_name,
            rp(fp),
            String(item.qty || 1),
            rp(fp * (item.qty || 1)),
          ];
        });

    autoTable(doc, {
      startY: y,
      head: tableHeaders,
      body: tableRows,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        lineColor: [230, 230, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 6,
        textColor: [150, 150, 150],
        cellPadding: { top: 4, right: 3, bottom: 6, left: 3 },
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold', fontSize: 8 },
      },
      didParseCell: function (data) {
        // First column (part number) should be uppercase bold
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.raw = data.cell.raw.toUpperCase();
        }
      },
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });

    // Get the last Y position after the table
    const finalY = doc.lastAutoTable.finalY + 5;

    // ── Totals Section ──
    const totX = pageW - margin - 80;
    let totY = finalY + 3;

    // Gross Subtotal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Gross Subtotal', totX, totY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(rp(totals.subtotalRaw), pageW - margin, totY, { align: 'right' });
    totY += 5;

    // Global Discount (if any)
    if (globalDiscountPercent > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(220, 50, 50);
      doc.text(`Diskon Khusus (${globalDiscountPercent}%)`, totX, totY);
      doc.text(`- ${rp(totals.globalDiscountAmount)}`, pageW - margin, totY, { align: 'right' });
      totY += 5;
    }

    // Separator
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(totX, totY, pageW - margin, totY);
    totY += 4;

    // DPP (Harga Sebelum PPN)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text('DPP (Harga Sebelum PPN)', totX, totY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(rp(totals.subtotal), pageW - margin, totY, { align: 'right' });
    totY += 6;

    // PPN 11%
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text('PPN 11%', totX, totY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(rp(totals.ppn), pageW - margin, totY, { align: 'right' });
    totY += 5;

    // Grand Total separator (thick)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(totX, totY, pageW - margin, totY);
    totY += 5;

    // Grand Total
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text('Total Termasuk PPN', totX, totY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(rp(totals.grandTotal), pageW - margin, totY, { align: 'right' });
    totY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(180);
    doc.text('HARGA SUDAH TERMASUK PPN 11%', pageW - margin, totY, { align: 'right' });

    totY += 10;

    // ── Footer ──
    if (totY > 270) totY = 270; // near bottom
    doc.setDrawColor(210);
    doc.setLineWidth(0.3);
    doc.line(margin, totY, pageW - margin, totY);
    totY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(180);
    doc.text('OFFICIAL QUOTATION', margin, totY);
    totY += 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('Harga tidak mengikat dan dapat berubah sewaktu-waktu. Estimasi berlaku selama 7 hari sejak tanggal diterbitkan.', margin, totY);
    doc.setFont('helvetica', 'bold');
    doc.text('Chery Oriental Medan', pageW - margin, totY - 3, { align: 'right' });
    doc.text(`© ${new Date().getFullYear()}`, pageW - margin, totY + 1, { align: 'right' });

    // ── Save ──
    const fileName = `Quotation_${userName}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const sendWhatsApp = () => {
    const message = `*Official Quotation - Chery Oriental*\n\n` +
      `No: ${invoiceMetadata.no}\n` +
      `Customer: ${customerInfo.name || 'Valued Customer'}\n` +
      `Date: ${invoiceMetadata.date}\n\n` +
      `*Items:*\n` +
      items.map(i => `- ${i.part_name} (${i.qty}x) : Rp ${((i.unit_price - (i.discount || 0)) * i.qty).toLocaleString()}`).join('\n') +
      `\n\n*Total: Rp ${totals.grandTotal.toLocaleString()}*`;
    
    const url = `https://wa.me/${(customerInfo.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-[#F5F5F7] z-[9999] flex flex-col md:flex-row overflow-hidden font-sans selection:bg-black selection:text-white text-black antialiased">
      
      {/* LEFT PANEL: CONFIGURATOR */}
      <aside className="w-full md:w-[380px] bg-white border-r border-gray-200 p-8 flex flex-col h-full overflow-y-auto no-print shadow-2xl z-20">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <FileText className="text-white" size={20} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Configurator</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* EPCM Status Dot */}
            <div className={`w-2.5 h-2.5 rounded-full ${epcmToken ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
            
            {!epcmToken && (
               <button 
                  onClick={handleEpcAutoLogin}
                  disabled={isEpcLoggingIn}
                  className="p-2 text-zinc-400 hover:text-black transition-colors"
                  title="Connect EPCM"
               >
                 {isEpcLoggingIn ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
               </button>
            )}

            <button 
                onClick={() => window.location.reload()} 
                className="p-2 text-gray-300 hover:text-black transition-colors ml-2"
                title="Reset"
            >
              <Trash2 size={16} />
            </button>
            <button 
                onClick={onClose || (() => window.history.back())} 
                className="p-2 text-gray-300 hover:text-black transition-colors"
                title="Back"
            >
              <ArrowRight className="rotate-180" size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-10 flex-1">
          {/* Section 1: Customer & Settings */}
          <div className="space-y-6">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Customer & Pricing</h3>
            
            <div className="grid grid-cols-1 gap-5">
              <input 
                type="text" 
                placeholder="Customer Name"
                className="w-full bg-gray-50 border-b-2 border-black p-3 focus:bg-white transition-colors outline-none font-bold text-sm"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="PO Number"
                className="w-full bg-gray-50 border-b-2 border-black p-3 focus:bg-white transition-colors outline-none font-bold text-sm"
                value={customerInfo.poNumber}
                onChange={(e) => setCustomerInfo({...customerInfo, poNumber: e.target.value})}
              />
            </div>

            <div className="space-y-4 pt-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex justify-between">
                Special Discount (%) <span>{globalDiscountPercent}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="0.5"
                className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                value={globalDiscountPercent}
                onChange={(e) => setGlobalDiscountPercent(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section 2: Part Search */}
          <div className="space-y-6 border-t border-gray-100 pt-10">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Part Inventory</h3>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari part code/nama..."
                  className="w-full bg-gray-50 border-b-2 border-black pl-12 pr-12 py-4 focus:bg-white transition-colors outline-none font-black text-sm uppercase"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Plus size={18} className="text-gray-300" />
                  )}
                </div>

                {searchTerm.length >= 3 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 shadow-2xl z-[100] rounded-xl overflow-hidden divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                    {masterParts.length === 0 && !isSearching ? (
                      <div className="p-6 text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest">Tidak ditemukan</div>
                      ) : masterParts.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAddItem(item)}
                          className="w-full px-6 py-5 text-left hover:bg-gray-50 flex items-center justify-between group transition-colors border-l-4 border-transparent hover:border-black"
                        >
                          <div className="flex items-center gap-4">
                            {/* Image from EPCM if available */}
                            <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-gray-100">
                              {epcmImages[item.code] ? (
                                <img 
                                  src={epcmImages[item.code][0]} 
                                  alt="" 
                                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                                />
                              ) : (
                                <Package size={20} className="text-gray-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-[11px] uppercase text-black leading-none mb-1">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-[9px] text-gray-400 font-bold uppercase tracking-widest">{item.code}</p>
                                {epcmImages[item.code] && (
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[10px]">Rp {(item.retailGuidePrice || 0).toLocaleString()}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selection Summary */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Selected Items</h3>
                <span className="text-[9px] font-black px-2 py-0.5 bg-black text-white rounded-md">{items.length}</span>
              </div>
              
              {items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-100 rounded-2xl py-10 flex flex-col items-center justify-center gap-2 bg-gray-50/50">
                  <Package size={20} className="text-gray-200" />
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Belum ada barang</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4 group hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[10px] uppercase truncate leading-none mb-1">{item.part_name}</p>
                          <p className="font-mono text-[9px] text-gray-400 font-bold uppercase tracking-widest">{item.part_number}</p>
                        </div>
                        <button onClick={() => removeItem(item.part_number)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Quantity</label>
                          <input 
                            type="number" 
                            className="w-full bg-white border-b border-black px-2 py-1 text-xs font-black outline-none"
                            value={item.qty}
                            onChange={(e) => updateItem(item.part_number, 'qty', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="text-right flex flex-col justify-end">
                          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Subtotal</p>
                          <p className="font-black text-xs">
                            {((item.unit_price - (item.discount || 0)) * item.qty).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="mt-auto pt-8 border-t border-gray-100 space-y-3">
          <button 
            onClick={downloadInvoice}
            className="w-full bg-black text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10"
          >
            <Download size={18} /> Simpan PDF
          </button>
          <button 
            onClick={sendWhatsApp}
            className="w-full border-2 border-black py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:bg-black hover:text-white transition-all"
          >
            <Share2 size={18} /> WhatsApp
          </button>
        </div>
      </aside>

      {/* RIGHT PANEL: PREVIEW */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar p-12 lg:p-20 flex flex-col items-center">
        {/* INVOICE SHEET */}
        <div id="invoice-sheet" className="bg-white w-full max-w-[210mm] min-h-[1200px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] flex flex-col p-12 relative origin-top scale-90 md:scale-100">
            
            {/* Header Estimasi */}
            <div className="flex justify-between items-start mb-16 relative z-10">
              <div className="space-y-5">
                <div className="h-1.5 w-20 bg-gradient-to-r from-black to-gray-400"></div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Chery Authorized Dealer</p>
                  <h1 className="text-7xl font-black tracking-tighter leading-none italic uppercase">Estimasi</h1>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nomor Dokumen</p>
                  <p className="font-black text-lg leading-none tracking-tight">{invoiceMetadata.no}</p>
                </div>
                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-6">Medan, {invoiceMetadata.date}</p>
                {currentUser.name && (
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-2">Dibuat oleh: {currentUser.name}</p>
                )}
              </div>
            </div>

            {/* Info Customer & PO */}
            <div className="mb-16 grid grid-cols-2 gap-16 bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-px bg-black"></div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ditujukan Kepada</p>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter mb-1 leading-tight">{customerInfo.name || 'PELANGGAN UMUM'}</h3>
                  <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">{customerInfo.vehicle || 'ALL CHERY MODELS'}</p>
                </div>
                {customerInfo.phone && (
                  <div className="flex items-center gap-2 text-gray-400 font-bold text-[9px] uppercase tracking-widest">
                    <MessageCircle size={11} /> {customerInfo.phone}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-end gap-2 mb-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Referensi PO</p>
                    <div className="w-6 h-px bg-black"></div>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">{customerInfo.poNumber || '-'}</h3>
                </div>
                <div className="inline-block self-end mt-4 px-5 py-2.5 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl">Draf Estimasi</div>
              </div>
            </div>

            {/* Table */}
            <div className="mb-12">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest">
                    <th className="pb-4 w-24 text-gray-400 font-black">Pratinjau</th>
                    <th className="pb-4 text-gray-400 font-black">Detail Part</th>
                    <th className="pb-4 text-right w-36 text-gray-400 font-black">Harga Satuan</th>
                    <th className="pb-4 text-center w-20 text-gray-400 font-black">Qty</th>
                    <th className="pb-4 text-right w-40 text-gray-400 font-black">Subtotal</th>
                  </tr>
                  <tr><th colSpan="5" className="border-b-2 border-black pb-1"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-20 text-center text-gray-200 font-black uppercase tracking-[0.4em] italic text-sm">Belum ada item yang dipilih</td>
                      </tr>
                   ) : items.map((item, index) => {
                      const finalUnitPrice = item.unit_price - (item.discount || 0);
                      return (
                          <tr key={index} className="group hover:bg-gray-50 transition-colors">
                              <td className="py-5">
                                <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center">
                                  {epcmImages[item.part_number] ? (
                                    <img 
                                      src={epcmImages[item.part_number][0]} 
                                      alt={item.part_name} 
                                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                    />
                                  ) : (
                                    <Package size={24} className="text-gray-200" />
                                  )}
                                </div>
                              </td>
                              <td className="py-5">
                                  <div className="font-black text-base tracking-tight text-black uppercase leading-none mb-1.5">{item.part_number}</div>
                                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{item.part_name}</div>
                              </td>
                              <td className="py-5 text-right font-bold text-sm text-gray-600 align-top">Rp {finalUnitPrice.toLocaleString()}</td>
                              <td className="py-5 text-center font-black text-lg align-top">{item.qty}</td>
                              <td className="py-5 text-right font-black text-xl tracking-tight align-top">Rp {(finalUnitPrice * item.qty).toLocaleString()}</td>
                          </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end" style={{ pageBreakInside: 'avoid' }}>
              <div className="w-96 space-y-5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-4 border-b border-gray-100">
                  <span>Gross Subtotal</span>
                  <span className="text-black font-black">Rp {totals.subtotalRaw.toLocaleString()}</span>
                </div>
                {globalDiscountPercent > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black text-red-500 bg-red-50 px-4 py-3 rounded-xl uppercase tracking-widest">
                    <span>Diskon Khusus ({globalDiscountPercent}%)</span>
                    <span>- Rp {totals.globalDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold text-gray-600 border-b border-gray-100 pb-4">
                  <span>DPP (Harga Sebelum PPN)</span>
                  <span className="text-black font-black text-lg">Rp {totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>PPN 11%</span>
                  <span className="text-black font-black">Rp {totals.ppn.toLocaleString()}</span>
                </div>
                <div className="pt-6 border-t-[6px] border-black flex justify-between items-end">
                  <span className="font-black uppercase tracking-tighter text-sm italic">Total Termasuk PPN</span>
                  <div className="text-right">
                    <p className="text-5xl font-black tracking-tighter leading-none">
                      Rp {totals.grandTotal.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] mt-3">Harga Sudah Termasuk PPN 11%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-16 pt-6 border-t border-gray-200 flex justify-between items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-px w-12 bg-gray-300"></div>
                  <p className="text-[8px] font-black tracking-[0.2em] uppercase text-gray-300">Official Quotation</p>
                </div>
                <p className="text-[8px] font-medium text-gray-300 max-w-md leading-relaxed">
                  Harga tidak mengikat dan dapat berubah sewaktu-waktu. Estimasi berlaku selama 7 hari sejak tanggal diterbitkan.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Chery Oriental Medan</p>
                <p className="text-[8px] font-bold text-gray-300 tracking-wider">© {new Date().getFullYear()}</p>
              </div>
            </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }

        @media print {
            @page { size: A4 portrait; margin: 12mm 15mm; }
            .no-print, nav, aside { display: none !important; }
            body, html { background: white !important; margin: 0 !important; padding: 0 !important; }
            .fixed { position: relative !important; overflow: visible !important; height: auto !important; }
            main { overflow: visible !important; padding: 0 !important; }
            #invoice-sheet { 
              box-shadow: none !important; 
              border: none !important; 
              transform: none !important; 
              margin: 0 !important; 
              padding: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border-radius: 0 !important;
              min-height: 0 !important;
              height: auto !important;
              overflow: visible !important;
              scale: 1 !important;
              font-size: 9pt !important;
            }
            .bg-zinc-100, .bg-zinc-50, .bg-gray-50 { background: white !important; }
            #invoice-sheet .text-7xl { font-size: 22pt !important; }
            #invoice-sheet .text-5xl { font-size: 16pt !important; }
            #invoice-sheet .text-4xl { font-size: 14pt !important; }
            #invoice-sheet .text-3xl { font-size: 13pt !important; }
            #invoice-sheet .text-2xl { font-size: 12pt !important; }
            #invoice-sheet .text-xl { font-size: 11pt !important; }
            #invoice-sheet .text-lg { font-size: 10pt !important; }
            #invoice-sheet .text-base { font-size: 9pt !important; }
            #invoice-sheet .text-sm { font-size: 8pt !important; }
            #invoice-sheet .text-xs { font-size: 7.5pt !important; }
            #invoice-sheet table { font-size: 8pt !important; }
            #invoice-sheet .text-\\[10px\\] { font-size: 7pt !important; }
            #invoice-sheet .text-\\[9px\\] { font-size: 6.5pt !important; }
            #invoice-sheet .text-\\[8px\\] { font-size: 6pt !important; }
            #invoice-sheet .mb-16 { margin-bottom: 1rem !important; }
            #invoice-sheet .mb-20 { margin-bottom: 1.25rem !important; }
            #invoice-sheet .mt-24 { margin-top: 1.5rem !important; }
            #invoice-sheet .py-5 { padding-top: 0.3rem !important; padding-bottom: 0.3rem !important; }
            #invoice-sheet .p-8 { padding: 0.75rem !important; }
            #invoice-sheet .px-6 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
            #invoice-sheet .py-4 { padding-top: 0.4rem !important; padding-bottom: 0.4rem !important; }
            #invoice-sheet .w-20 { width: 3rem !important; }
            #invoice-sheet .h-20 { height: 3rem !important; }
            #invoice-sheet .gap-16 { gap: 2rem !important; }
            #invoice-sheet .rounded-3xl { border-radius: 0.5rem !important; }
            #invoice-sheet .rounded-2xl { border-radius: 0.4rem !important; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

