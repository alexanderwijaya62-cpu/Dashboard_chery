import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PackageSearch, Plus, Trash2, Check, ArrowLeft, ArrowRight, Send, Upload, Search, Filter, X, Menu, FileText, TrendingUp, Layers } from 'lucide-react';
import QuotationSPA from '../quotation/QuotationSPA';
import ProfitDashboard from './ProfitDashboard';
import SparepartPredictor from './SparepartPredictor';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { CHERY_DMS_URL, GATE } from '../utils/config';

const normalize = (s) => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    // Jika format asli Excel DD/MM/YYYY atau DD/MM/YYYY HH:mm
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const parts = dateStr.split(/[\/\s:]+/);
        if (parts.length >= 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            // Format yang diterima <input type="date"> adalah YYYY-MM-DD
            if (y.length === 4) return `${y}-${m}-${d}`;
            if (y.length === 2) return `20${y}-${m}-${d}`;
        }
    }
    // Jika format ISO (YYYY-MM-DDTHH:mm:ss.sssZ) ambil bagian tanggalnya saja
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        return dateStr.substring(0, 10);
    }
    return dateStr;
};

export default function SparepartPanel({ user, handleLogout, isNavbarVisible, setCurrentPage, activeTab: activeTabProp }) {
    const [activeTab, setActiveTab] = useState(activeTabProp || 'input');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Sync activeTab with prop
    useEffect(() => {
      if (activeTabProp && activeTabProp !== activeTab) {
        setActiveTab(activeTabProp);
      }
    }, [activeTabProp]);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filtering & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState('');
    
    const [searchDms, setSearchDms] = useState(''); // Live search query for DMS
    const [isDmsLoading, setIsDmsLoading] = useState(false);
    const [dmsResults, setDmsResults] = useState([]);

    // Form State
    const [orderNumber, setOrderNumber] = useState('');
    const [namaPemesan, setNamaPemesan] = useState('');
    const [tanggalCSI, setTanggalCSI] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [items, setItems] = useState([
        { sparePartNumber: '', sparePartName: '', orderAmount: 1, orderingInstructions: '' },
    ]);
    const [pendingBatch, setPendingBatch] = useState([]);
    const [batchIndex, setBatchIndex] = useState(-1);
    const fileInputRef = useRef(null);
    const dmsTimeoutRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                const ordersMap = {};

                // Gunakan header: 1 untuk membaca sebagai array 2D (baris per baris)
                // Ini cara paling aman jika Excel memiliki baris kosong di atas atau header yang aneh
                const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (rawRows.length < 1) throw new Error("File Excel kosong.");

                // 1. Cari baris mana yang merupakan baris JUDUL (Header)
                let headerIdx = -1;
                for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
                    const row = rawRows[i];
                    if (row && row.some(cell => {
                        const s = String(cell || '').toLowerCase();
                        return s.includes('order number') || s.includes('spare part') || s.includes('founder') || s.includes('handling');
                    })) {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) headerIdx = 0; // Default ke baris pertama jika tidak ditemukan

                const headers = rawRows[headerIdx].map(h => String(h || '').toLowerCase().trim());
                const dataRows = rawRows.slice(headerIdx + 1);

                // Fungsi bantu untuk mengambil nilai berdasarkan nama header
                const getVal = (row, targetHeader) => {
                    const target = targetHeader.toLowerCase();
                    // 1. Prioritaskan kecocokan PERSIS (Exact Match)
                    let idx = headers.findIndex(h => h === target);

                    // 2. Jika tidak ada yang persis sama, cari yang mengandung kata tersebut (Fallback)
                    if (idx === -1) {
                        idx = headers.findIndex(h => h.includes(target));
                    }

                    return idx !== -1 ? row[idx] : undefined;
                };

                dataRows.forEach(row => {
                    // AMBIL DATA BERDASARKAN HEADER YANG DIBERIKAN USER
                    // Handling order number / order number
                    let oNum = getVal(row, 'handling order number') || getVal(row, 'order number');
                    oNum = String(oNum !== undefined ? oNum : '').trim();

                    // founder / fitria
                    let fndr = getVal(row, 'founder') || getVal(row, 'fitria') || '-';
                    fndr = String(fndr).trim();

                    // submission time
                    const subTime = String(getVal(row, 'submission time') || '').trim();

                    // processing time -> tanggalCSI
                    let procTime = String(getVal(row, 'processing time') || '').trim();
                    // Normalisasi format untuk input date
                    const normalizedCSI = formatDateForInput(procTime);

                    // order notes
                    const notes = String(getVal(row, 'order notes') || '').trim();

                    // Detail barang
                    const spNum = String(getVal(row, 'spare part number') || '').trim();
                    const spName = String(getVal(row, 'spare part name') || '').trim();

                    // QTY: Cari 'order amount' atau 'qty'
                    const amtVal = getVal(row, 'order amount') || getVal(row, 'qty');
                    const amt = parseInt(amtVal) || 1;

                    // NOTES: Cari 'ordering instructions', 'notes', atau 'remarks'
                    const inst = getVal(row, 'ordering instructions') || getVal(row, 'order notes') || getVal(row, 'notes') || getVal(row, 'remarks') || '';

                    // Validasi: Abaikan baris jika Order Number kosong atau tidak valid
                    if (!oNum || oNum === '' || oNum.toLowerCase() === 'false' || oNum.length < 3) return;

                    if (!ordersMap[oNum]) {
                        ordersMap[oNum] = {
                            orderNumber: oNum,
                            namaPemesan: fndr,
                            tanggalPembuatan: subTime,
                            tanggalCSI: normalizedCSI, // Simpan format YYYY-MM-DD agar masuk ke field input
                            orderNotes: notes, // Catatan Utama Order (dari kolom 'order notes')
                            items: []
                        };
                    }

                    if (spNum || spName) {
                        ordersMap[oNum].items.push({
                            sparePartNumber: spNum,
                            sparePartName: spName,
                            orderAmount: amt,
                            orderingInstructions: String(inst).trim() // Catatan Per Item
                        });
                    }
                });

                // Filter out orders that already exist in the database (Skip Duplicates)
                const { data: existingRecords } = await db.select('sparepart', { select: '"Handling order number"' });
                const existingSet = new Set((existingRecords || []).map(r => normalize(r['Handling order number'])));

                const finalOrders = Object.values(ordersMap).filter(o => !existingSet.has(normalize(o.orderNumber)));
                const duplicateCount = Object.values(ordersMap).length - finalOrders.length;

                if (finalOrders.length > 0) {
                    setPendingBatch(finalOrders);
                    setBatchIndex(0);
                    loadOrderData(finalOrders[0]);
                    Toastify({
                        text: `✅ Excel Berhasil Diimpor! Ditemukan ${finalOrders.length} Pesanan Baru. (Lewati ${duplicateCount} Duplikat)`,
                        background: "green",
                        duration: 5000
                    }).showToast();
                } else {
                    const msg = duplicateCount > 0
                        ? `ℹ️ Tidak ada data baru (Semua ${duplicateCount} data sudah terdaftar).`
                        : "Tidak ditemukan data pesanan yang valid di Excel.";
                    Toastify({ text: msg, background: "#3b82f6", duration: 5000 }).showToast();
                }
            } catch (error) {
                console.error("Import Error:", error);
                Toastify({ text: "Gagal membaca Excel: " + error.message, background: "red", duration: 5000 }).showToast();
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const loadOrderData = (order) => {
        setOrderNumber(order.orderNumber || '');
        setNamaPemesan(order.namaPemesan || '');
        setTanggalCSI(formatDateForInput(order.tanggalCSI) || '');
        setOrderNotes(order.orderNotes || '');
        setItems(order.items && order.items.length > 0 ? order.items : [{ sparePartNumber: '', sparePartName: '', orderAmount: 1, orderingInstructions: '' }]);
    };

    const handleNextBatch = () => {
        if (batchIndex < pendingBatch.length - 1) {
            const nextIdx = batchIndex + 1;
            setBatchIndex(nextIdx);
            loadOrderData(pendingBatch[nextIdx]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Selesai
            setPendingBatch([]);
            setBatchIndex(-1);
            setOrderNumber('');
            setNamaPemesan('');
            setItems([{ sparePartNumber: '', sparePartName: '', orderAmount: 1, orderingInstructions: '' }]);
            Toastify({ text: "Semua antrean batch telah selesai!", background: "blue" }).showToast();
        }
    };

    const fetchOrders = async () => {
        try {
            const { data, error } = await db.select('sparepart', { select: '"Handling order number", founder, items, status, "submission time", "processing time", "order notes"' });

            if (error) throw error;

            if (data && Array.isArray(data)) {
                const parsedOrders = data.map(o => {
                    const rowId = o['Handling order number'] || '';
                    return {
                        ...o,
                        id: rowId,
                        orderNumber: rowId,
                        namaPemesan: o.founder || '-',
                        items: o.items || '[]',
                        status: o.status || 'pending',
                        tanggalPembuatan: o['submission time'] || '-',
                        tanggalCSI: formatDateForInput(o['processing time'] || '')
                    };
                });
                setOrders(parsedOrders);
            }
        } catch (e) {
            console.error("Gagal fetch sparepart:", e);
        }
    };

    const fetchFromDms = async (query = '') => {
        if (!query && !searchDms) return;
        const q = query || searchDms;
        setIsDmsLoading(true);
        try {
            // Search from DMS
            const resp = await fetch(`${CHERY_DMS_URL}/search?q=${q}`, {
                headers: { 'x-api-key': GATE }
            });
            const result = await resp.json();
            
            const dmsData = result.data || result.items || (Array.isArray(result) ? result : []);
            setDmsResults(dmsData.slice(0, 10)); // Top 10 results
        } catch (e) {
            console.error("DMS Fetch Error:", e);
            Toastify({ text: "Gagal mencari di DMS: " + e.message, background: "#ef4444" }).showToast();
        } finally {
            setIsDmsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        
        const sparepartChannel = supabase.channel('sparepart-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sparepart' }, () => fetchOrders())
            .subscribe();

        return () => {
            supabase.removeChannel(sparepartChannel);
        };
    }, []);

    const handleAddItem = () => {
        setItems([...items, { sparePartNumber: '', sparePartName: '', orderAmount: 1, orderingInstructions: '' }]);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!orderNumber || !namaPemesan || items.length === 0) {
            Toastify({ text: "Harap isi Order Number dan Nama Pemesan!", background: "red", duration: 3000 }).showToast();
            return;
        }

        setIsLoading(true);

        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const formattedNow = `${d}/${m}/${y} ${h}:${min}`;

        // Helper untuk menggabungkan data baru dengan data lama jika sudah ada (Smart Merge)
        const getMergedPayload = (inputData) => {
            const searchNum = normalize(inputData.orderNumber);
            const existing = orders.find(o =>
                normalize(o.orderNumber) === searchNum ||
                normalize(o['Handling order number']) === searchNum
            );

            let finalItems = inputData.items.map(i => ({ ...i, isArrived: false }));
            let finalStatus = 'pending';
            let finalDate = inputData.tanggalPembuatan || formattedNow;
            let finalCSI = inputData.tanggalCSI || '';

            if (existing) {
                // Prioritas data lama untuk metadata dasar agar tidak tertimpa
                finalDate = existing.tanggalPembuatan || existing.tanggal || finalDate;
                finalCSI = existing.tanggalCSI || existing['Processing Time'] || finalCSI;

                let existingItems = [];
                try {
                    existingItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : (Array.isArray(existing.items) ? existing.items : []);
                } catch (e) {
                    console.error("Gagal parse existing items:", e);
                }

                // Jika status lama sudah arrived/confirmed, beri perlindungan ekstra
                const isAlreadyFullyArrived = (existing.status === 'arrived' || existing.status === 'confirmed');

                if (Array.isArray(existingItems) && existingItems.length > 0) {
                    finalItems = inputData.items.map(newItem => {
                        // Cari item yang sama di data lama (berdasarkan Part Number atau Part Name)
                        const match = existingItems.find(oldItem => {
                            const oldNum = normalize(oldItem.sparePartNumber);
                            const newNum = normalize(newItem.sparePartNumber);
                            const oldName = normalize(oldItem.sparePartName);
                            const newName = normalize(newItem.sparePartName);

                            return (oldNum && newNum && oldNum === newNum) ||
                                (oldName && newName && oldName === newName);
                        });

                        return {
                            ...newItem,
                            // Jika ditemukan match, ambil status isArrived-nya. 
                            // Jika tidak ditemukan match tapi order lama sudah 'arrived' total, asumsikan true (opsional, tapi lebih aman false sesuai data baru)
                            isArrived: match ? !!match.isArrived : (isAlreadyFullyArrived ? true : false)
                        };
                    });
                } else if (isAlreadyFullyArrived) {
                    // Fallback jika array items lama tidak ada tapi statusnya sudah arrived/confirmed
                    finalItems = inputData.items.map(i => ({ ...i, isArrived: true }));
                }

                // Rekalkulasi status akhir berdasarkan finalItems
                const allArrived = finalItems.length > 0 && finalItems.every(i => i.isArrived);
                const someArrived = finalItems.some(i => i.isArrived);

                if (allArrived) {
                    finalStatus = (existing.status === 'confirmed') ? 'confirmed' : 'arrived';
                } else if (someArrived) {
                    finalStatus = 'partial';
                } else {
                    finalStatus = 'pending';
                }
            }

            return {
                'Handling order number': inputData.orderNumber,
                action: 'add',
                orderNumber: inputData.orderNumber,
                tanggal: finalDate,
                namaPemesan: inputData.namaPemesan,
                tanggalCSI: finalCSI,
                orderNotes: inputData.orderNotes || '',
                items: JSON.stringify(finalItems),
                status: finalStatus,
            };
        };

        try {
            // FORCE FETCH TERBARU: Langsung dari Google Sheets
            const checkResp = await customFetch(`${GAS_SPAREPART_URL}?action=get&_=${Date.now()}`);
            const checkData = await checkResp.json();
            let latestOrders = [];

            if (checkData && Array.isArray(checkData.orders)) {
                latestOrders = checkData.orders;
            }

            // CEK DUPLIKASI: Sangat Agresif & Teliti
            const currentSearch = normalize(orderNumber);
            const duplicateOrder = latestOrders.find(o => {
                // Buat list semua kemungkinan ID dari objek order ini
                const possibleIds = [
                    o['Handling order number'],
                    o.handling_order_number,
                    o.orderNumber,
                    o.ordernumber,
                    o.Number,
                    o.id
                ];

                // Tambahkan versi "tanpa spasi" dari semua key objek
                Object.keys(o).forEach(key => {
                    const cleanKey = key.toLowerCase().replace(/\s/g, '');
                    if (cleanKey === 'handlingordernumber' || cleanKey === 'ordernumber' || cleanKey === 'id') {
                        possibleIds.push(o[key]);
                    }
                });

                // Cek apakah ada yang cocok dengan currentSearch setelah dinormalisasi
                return possibleIds.some(val => val && normalize(val) === currentSearch);
            });

            if (duplicateOrder) {
                console.warn("BLOCKED DUPLICATE:", orderNumber);
                const errorMsg = `DATA GANDA: Order "${orderNumber}" sudah terdaftar di Google Sheets. Sistem memblokir import ini untuk mencegah data tumpang tindih.`;

                Toastify({
                    text: errorMsg,
                    background: "rgba(220, 38, 38, 0.95)",
                    duration: 8000,
                    gravity: "top",
                    position: "center",
                    close: true
                }).showToast();

                if (batchIndex > -1) {
                    setTimeout(handleNextBatch, 1500);
                }
                setIsLoading(false);
                return; // STOP TOTAL - Jangan kirim POST
            }

            // PROSES SIMPAN ke Supabase
            const payload = {
                'Handling order number': orderNumber,
                'submission time': formattedNow,
                'founder': namaPemesan,
                'processing time': tanggalCSI,
                'order notes': orderNotes,
                'items': JSON.stringify(items.map(i => ({ ...i, isArrived: false }))),
                'status': 'pending',
            };

            const { error } = await db.insert('sparepart', [payload]);

            if (error) throw error;

            Toastify({ text: `SUKSES: Pesanan ${orderNumber} berhasil disimpan!`, background: "green" }).showToast();

            if (batchIndex > -1) {
                handleNextBatch();
            } else {
                setOrderNumber('');
                setNamaPemesan('');
                setOrderNotes('');
                setTanggalCSI('');
                setItems([{ sparePartNumber: '', sparePartName: '', orderAmount: 1, orderingInstructions: '' }]);
                fetchOrders();
            }
        } catch (error) {
            console.error("Submit Error:", error);
            Toastify({ text: "Critical Error: " + error.message, background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetArrived = async (order, partialItems = null) => {
        let isPartial = false;
        let newItemsJson = null;

        if (partialItems) {
            const allArrived = partialItems.every(i => i.isArrived);
            const someArrived = partialItems.some(i => i.isArrived);
            if (!someArrived) return; // if nothing is checked
            isPartial = !allArrived;
            newItemsJson = JSON.stringify(partialItems);
        }

        const newStatus = isPartial ? 'partial' : 'arrived';
        const confirmMsg = isPartial ? "Update status menjadi Sebagian Sampai?" : "Apakah sparepart ini benar sudah sampai SELURUHNYA?";
        if (!window.confirm(confirmMsg)) return;

        setIsLoading(true);

        try {
            const { error } = await db.update('sparepart', {
                    status: newStatus,
                    arrivedTime: new Date().toISOString(),
                    items: newItemsJson
                }, { eq: { 'Handling order number': order.id } });

            if (error) throw error;

            Toastify({ text: `Status diperbarui menjadi ${isPartial ? 'Sebagian Sampai' : 'Sampai'}!`, background: "green", duration: 3000 }).showToast();
            fetchOrders();
        } catch (e) {
            console.error(e);
            Toastify({ text: "Gagal update status", background: "red", duration: 3000 }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const [modifiedIds, setModifiedIds] = useState(new Set());

    const handleCheckItem = (order, itemIdx) => {
        let itemsArray = [];
        try { itemsArray = JSON.parse(order.items); } catch (e) { return; }

        const newItems = [...itemsArray];
        newItems[itemIdx].isArrived = !newItems[itemIdx].isArrived;

        const allArrived = newItems.every(i => i.isArrived);
        const someArrived = newItems.some(i => i.isArrived);
        const newStatus = allArrived ? 'arrived' : (someArrived ? 'partial' : 'pending');

        // Local state update only
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, items: JSON.stringify(newItems), status: newStatus } : o));
        setModifiedIds(prev => new Set(prev).add(order.id));
    };

    const handleSaveChanges = async (order) => {
        setIsLoading(true);
        try {
            const { error } = await db.update('sparepart', {
                    status: order.status,
                    arrivedTime: new Date().toISOString(),
                    items: order.items
                }, { eq: { 'Handling order number': order.id } });

            if (error) throw error;

            Toastify({ text: "Perubahan disimpan!", background: "green", duration: 2000 }).showToast();
            setModifiedIds(prev => {
                const copy = new Set(prev);
                copy.delete(order.id);
                return copy;
            });
            fetchOrders();
        } catch (err) {
            Toastify({ text: "Gagal menyimpan: " + err.message, background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const oNum = (o.orderNumber || o['Handling order number'] || '').toLowerCase();
            const oName = (o.namaPemesan || o.founder || '').toLowerCase();
            const oStatus = (o.status || '').toLowerCase();
            const oDate = o.tanggalPembuatan || o['submission time'] || o.tanggal || '';
            const oItems = (o.items || '').toLowerCase();

            // Search Filter (Order Number, Name, Items)
            const matchesSearch = searchTerm === '' ||
                oNum.includes(searchTerm.toLowerCase()) ||
                oName.includes(searchTerm.toLowerCase()) ||
                oItems.includes(searchTerm.toLowerCase());

            // Status Filter
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'pending' && (o.status === 'pending' || o.status === 'partial')) ||
                (filterStatus === 'arrived' && (o.status === 'arrived' || o.status === 'confirmed')) ||
                (filterStatus === 'partial' && o.status === 'partial') ||
                (filterStatus === 'confirmed' && o.status === 'confirmed');

            // Date Filter
            const matchesDate = filterDate === '' || oDate.includes(filterDate);

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [orders, searchTerm, filterStatus, filterDate]);

    const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending' || o.status === 'partial'), [orders]);
    const arrivedOrders = useMemo(() => orders.filter(o => o.status === 'arrived' || o.status === 'confirmed'), [orders]);

    return (
        <div className="flex flex-col w-full h-full bg-zinc-50 text-black font-sans tracking-tight overflow-hidden selection:bg-zinc-200">
            {/* Main Content Area - no internal sidebar */}
            <div className="flex-1 flex flex-col h-full">
                
                {/* Header Bar */}
                <header className="h-auto md:h-24 border-b border-zinc-200 flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-12 py-4 md:py-0 bg-white backdrop-blur-xl sticky top-0 z-40 shrink-0 gap-3 md:gap-0">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase italic flex items-center gap-4 text-black">
                            {activeTab === 'input' ? 'Order Management' : 
                             activeTab === 'quotation' ? 'Quotation Hub' : 
                             activeTab === 'profit' ? 'Stock Predictor' :
                             activeTab === 'predict' ? 'Stock Predictor' :
                             'Logistics Monitor'}
                            <div className="h-2 w-2 bg-black rounded-full animate-pulse"></div>
                        </h1>
                    </div>

                    <div className="flex items-center gap-6">
                        {activeTab === 'input' && (
                            <>
                                <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current.click()} 
                                    className="bg-white text-black border border-black px-8 py-3.5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all hover:bg-zinc-200 active:scale-95 shadow-sm"
                                >
                                    <Upload size={16} className="text-black" /> Bulk Import
                                </button>
                            </>
                        )}
                        {activeTab === 'view' && (
                            <div className="flex gap-4">
                                <div className="bg-zinc-100 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-zinc-200 text-black">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></span> {pendingOrders.length} Pending
                                </div>
                                <div className="bg-zinc-100 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-zinc-200 text-black">
                                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span> {arrivedOrders.length} Arrived
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[999] flex justify-center items-center">
                        <div className="bg-zinc-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3 font-bold shadow-2xl">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                            Memproses...
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 md:p-12 no-scrollbar bg-zinc-50 pb-[72px] md:pb-12">
                    {/* TAB: INPUT */}
                    {activeTab === 'input' && (
                        <div className="max-w-6xl mx-auto space-y-12 pb-32">
                            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 border border-zinc-200 p-12">
                                <div className="flex items-center gap-6 mb-12 border-b border-zinc-100 pb-10">
                                    <div className="p-4 bg-black text-white rounded-2xl shadow-xl shadow-black/10">
                                        <Plus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-2xl tracking-tight uppercase text-black">New Quotation Order</h3>
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Manual entry or live DMS selection</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                                    {[
                                        { label: 'Order Number', value: orderNumber, onChange: setOrderNumber, placeholder: 'QT-2026-X', type: 'text' },
                                        { label: 'Purchaser / Founder', value: namaPemesan, onChange: setNamaPemesan, placeholder: 'Staff Name', type: 'text' },
                                        { label: 'Process Date', value: tanggalCSI, onChange: setTanggalCSI, type: 'date' },
                                        { label: 'Order Notes', value: orderNotes, onChange: setOrderNotes, placeholder: 'Optional internal notes...', type: 'text' }
                                    ].map((f, i) => (
                                        <div key={i} className="space-y-3">
                                            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{f.label}</label>
                                            <input 
                                                type={f.type} 
                                                value={f.value} 
                                                onChange={e => f.onChange(e.target.value)} 
                                                required={i < 2}
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 font-bold text-sm text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black/50 transition-all placeholder:text-zinc-300" 
                                                placeholder={f.placeholder}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-12 border-t border-zinc-100">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-zinc-100 text-black rounded-xl flex items-center justify-center">
                                                <PackageSearch size={20} />
                                            </div>
                                            <h3 className="font-black text-lg uppercase tracking-tight text-black">Spareparts Catalog</h3>
                                        </div>
                                        
                                        <div className="relative w-full md:w-96 group">
                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors" size={18} />
                                            <input 
                                                type="text" 
                                                placeholder="Live Search DMS..."
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-6 py-3.5 text-xs font-bold text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black/50 transition-all"
                                                value={searchDms}
                                                onChange={(e) => {
                                                    setSearchDms(e.target.value);
                                                    const val = e.target.value;
                                                    if (dmsTimeoutRef.current) {
                                                        clearTimeout(dmsTimeoutRef.current);
                                                    }
                                                    if (val.length >= 3) {
                                                        dmsTimeoutRef.current = setTimeout(() => fetchFromDms(val), 500);
                                                    }
                                                }}
                                            />
                                            
                                            {isDmsLoading && (
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            )}

                                            {/* DMS Live Results Overlay */}
                                            {dmsResults.length > 0 && searchDms.length >= 3 && (
                                                <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-zinc-200 rounded-3xl shadow-2xl z-[100] overflow-hidden divide-y divide-zinc-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                    {dmsResults.map((res, idx) => (
                                                        <button 
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                const newItems = [...items];
                                                                // If last item is empty, replace it
                                                                if (newItems.length > 0 && !newItems[newItems.length - 1].sparePartNumber && !newItems[newItems.length - 1].sparePartName) {
                                                                    newItems[newItems.length - 1] = {
                                                                        sparePartNumber: res.partCode || res.partNo || '',
                                                                        sparePartName: res.partName || '',
                                                                        orderAmount: 1,
                                                                        orderingInstructions: ''
                                                                    };
                                                                } else {
                                                                    newItems.push({
                                                                        sparePartNumber: res.partCode || res.partNo || '',
                                                                        sparePartName: res.partName || '',
                                                                        orderAmount: 1,
                                                                        orderingInstructions: ''
                                                                    });
                                                                }
                                                                setItems(newItems);
                                                                setDmsResults([]);
                                                                setSearchDms('');
                                                            }}
                                                            className="w-full px-6 py-4 text-left hover:bg-zinc-100 transition-all flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <p className="font-black text-sm uppercase text-black group-hover:text-zinc-600 transition-colors">{res.partName}</p>
                                                                <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">{res.partCode || res.partNo}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-xs text-black">Rp {res.retailGuidePrice?.toLocaleString()}</p>
                                                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Retail Est.</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {items.map((item, idx) => (
                                            <div key={idx} className="bg-zinc-50/50 rounded-[2rem] p-8 border border-zinc-200/50 flex flex-wrap lg:flex-nowrap gap-8 items-end relative group hover:bg-white hover:shadow-xl transition-all duration-500 hover:border-black/10">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveItem(idx)} 
                                                    className="absolute -top-3 -right-3 bg-white text-zinc-300 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black hover:text-white shadow-xl border border-zinc-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <div className="flex-[2] min-w-[250px] space-y-2">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Part Name</label>
                                                    <input type="text" value={item.sparePartName} onChange={e => handleItemChange(idx, 'sparePartName', e.target.value)} required className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold text-black focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all" />
                                                </div>
                                                <div className="flex-1 min-w-[200px] space-y-2">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Part Number</label>
                                                    <input type="text" value={item.sparePartNumber} onChange={e => handleItemChange(idx, 'sparePartNumber', e.target.value.toUpperCase())} required className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-mono font-bold text-black focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all uppercase" />
                                                </div>
                                                <div className="w-28 space-y-2">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">Quantity</label>
                                                    <input type="number" min="1" value={item.orderAmount} onChange={e => handleItemChange(idx, 'orderAmount', parseInt(e.target.value) || 1)} required className="w-full bg-white border border-zinc-200 rounded-2xl px-3 py-4 text-sm font-black text-center text-black focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all" />
                                                </div>
                                                <div className="flex-[1.5] min-w-[200px] space-y-2">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Notes / Instructions</label>
                                                    <input type="text" value={item.orderingInstructions} onChange={e => handleItemChange(idx, 'orderingInstructions', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold text-black focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all" placeholder="e.g. Urgent Special Order" />
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <button 
                                            type="button" 
                                            onClick={handleAddItem} 
                                            className="w-full border-2 border-dashed border-zinc-200 rounded-[2rem] py-8 text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                                        >
                                            <Plus size={16} /> Add Manual Row
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-20 pt-12 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-10">
                                    {batchIndex > -1 && pendingBatch.length > 0 ? 
                                        <div className="flex items-center gap-6 bg-zinc-100 px-8 py-4 rounded-[2.5rem] border border-zinc-200">
                                            <div className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center font-black text-lg shadow-lg shadow-black/10">
                                                {batchIndex + 1}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-black uppercase tracking-widest">Processing Batch</p>
                                                <p className="font-black text-base text-black">{pendingBatch.length - batchIndex - 1} Remaining in Queue</p>
                                            </div>
                                            <button type="button" onClick={handleNextBatch} className="ml-6 text-zinc-400 hover:text-black font-black text-[10px] uppercase tracking-widest transition-colors">Skip Item</button>
                                        </div>
                                     : <div className="hidden md:block"></div>}
                                    
                                    <button 
                                        type="submit" 
                                        className="w-full md:w-auto bg-black text-white px-16 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-zinc-800 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.15)] active:scale-95 text-xs"
                                    >
                                        {batchIndex > -1 ? 'Submit & Process Next' : 'Finalize Quotation Order'}
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TAB: VIEW */}
                    {activeTab === 'view' && (
                        <div className="max-w-7xl mx-auto space-y-12 pb-32">
                            {/* Filter Bar */}
                            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 border border-zinc-200 flex flex-wrap gap-8 items-end animate-fade-in">
                                <div className="flex-1 min-w-[300px] space-y-3">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Universal Search</label>
                                    <div className="relative group">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Order ID, Customer Name, or SKU..."
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-16 pr-8 py-4.5 font-bold text-sm text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="w-full md:w-auto space-y-3">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Order Status</label>
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="appearance-none bg-zinc-50 border border-zinc-200 rounded-2xl px-10 py-4.5 font-black text-[11px] uppercase tracking-widest text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all cursor-pointer min-w-[220px] shadow-sm"
                                    >
                                        <option value="all">All Orders</option>
                                        <option value="pending">Pending Receipt</option>
                                        <option value="partial">Partial Arrival</option>
                                        <option value="arrived">Fully Received</option>
                                        <option value="confirmed">Admin Confirmed</option>
                                    </select>
                                </div>

                                <div className="w-full md:w-auto space-y-3">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Timeline Filter</label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={e => setFilterDate(e.target.value)}
                                        className="bg-zinc-50 border border-zinc-200 rounded-2xl px-8 py-4.5 font-bold text-sm text-black focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black/30 transition-all h-[58px] shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {filteredOrders.length === 0 ? (
                                    <div className="lg:col-span-2 text-center py-48 bg-white rounded-[3rem] border-2 border-dashed border-zinc-200 shadow-inner">
                                        <PackageSearch size={64} className="mx-auto text-zinc-200 mb-8" />
                                        <p className="font-black text-zinc-300 uppercase tracking-[0.4em] text-sm">Logistics Database Empty</p>
                                    </div>
                                ) : (
                                    filteredOrders.map(order => {
                                        let itemsArray = [];
                                        try { itemsArray = JSON.parse(order.items); } catch (e) { itemsArray = []; }
                                        const isPending = order.status === 'pending' || order.status === 'partial';

                                        return (
                                            <div key={order.id} className="bg-white rounded-[3rem] overflow-hidden shadow-2xl shadow-zinc-900/5 border border-zinc-200 hover:shadow-lg hover:border-black/10 transition-all duration-500 group relative">
                                                <div className={`px-10 py-10 flex justify-between items-center border-b border-zinc-100 ${isPending ? 'bg-zinc-50/30' : 'bg-zinc-50/10'}`}>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-4">
                                                            <h3 className="font-black text-2xl tracking-tighter uppercase text-black">{order.orderNumber || 'NO-ID'}</h3>
                                                            {order.status === 'partial' && <span className="text-[9px] bg-zinc-200 text-black px-3 py-1 rounded-full font-black uppercase tracking-widest">Partial</span>}
                                                            {order.status === 'confirmed' && <span className="text-[9px] bg-zinc-200 text-black px-3 py-1 rounded-full font-black uppercase tracking-widest">Confirmed</span>}
                                                            {order.status === 'pending' && <span className="text-[9px] bg-zinc-100 text-zinc-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">Awaiting</span>}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{order.namaPemesan || 'Staff'} • {order.tanggalPembuatan || 'Now'}</p>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3">
                                                        {modifiedIds.has(order.id) ? (
                                                            <button onClick={() => handleSaveChanges(order)} className="bg-black text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-zinc-800 active:scale-95 transition-all">
                                                                Sync Changes
                                                            </button>
                                                        ) : isPending ? (
                                                            <button onClick={() => handleSetArrived(order)} className="bg-black text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl active:scale-95">
                                                                Receive All
                                                            </button>
                                                        ) : (
                                                            <div className="bg-black text-white p-3 rounded-2xl shadow-lg shadow-black/10">
                                                                <Check size={20} strokeWidth={4} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="p-12 space-y-10">
                                                    {order.orderNotes && (
                                                        <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 text-xs font-bold text-zinc-600 leading-relaxed italic relative">
                                                            <div className="absolute -top-3 left-6 bg-white px-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest">Internal Memo</div>
                                                            "{order.orderNotes}"
                                                        </div>
                                                    )}

                                                    <div className="space-y-4">
                                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1">Consignment Items</p>
                                                        {itemsArray.map((item, idx) => (
                                                            <div key={idx} className={`p-6 rounded-[2rem] border transition-all duration-500 flex items-center justify-between group/item ${item.isArrived ? 'bg-zinc-100 border-zinc-300' : 'bg-white border-zinc-200'}`}>
                                                                <div className="flex-1">
                                                                    <div className="font-black text-base tracking-tight text-black uppercase group-hover/item:text-zinc-600 transition-colors">{item.sparePartName}</div>
                                                                    <div className="font-mono text-[10px] text-zinc-400 flex items-center gap-3 mt-1 uppercase tracking-widest">
                                                                        {item.sparePartNumber} 
                                                                        <span className="w-1.5 h-1.5 bg-zinc-200 rounded-full"></span>
                                                                        <span className="text-black font-black">{item.orderAmount} UNIT</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleCheckItem(order, idx)}
                                                                    disabled={!isPending && !modifiedIds.has(order.id)}
                                                                    className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all shadow-sm ${item.isArrived ? 'bg-black text-white shadow-black/10' : 'bg-zinc-50 border border-zinc-200 text-zinc-200 hover:border-black/30 hover:text-black'}`}
                                                                >
                                                                    <Check size={18} strokeWidth={4} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                    {/* TAB: PREDICTOR (replaces old profit/analysis) */}
                    {activeTab === 'profit' && (
                        <div className="flex-1 overflow-hidden pb-32">
                            <SparepartPredictor />
                        </div>
                    )}

                    {activeTab === 'quotation' && (
                        <div className="flex-1 animate-fade-in h-full">
                            <QuotationSPA onClose={() => setActiveTab('view')} />
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}
