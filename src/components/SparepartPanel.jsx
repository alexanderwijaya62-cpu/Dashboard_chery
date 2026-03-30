import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PackageSearch, Plus, Trash2, Check, ArrowLeft, Send, Upload, Search, Filter, X, Menu } from 'lucide-react';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabaseClient';

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

export default function SparepartPanel({ user, handleLogout, isNavbarVisible }) {
    const [activeTab, setActiveTab] = useState('input');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filtering & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState('');

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
                const { data: existingRecords } = await supabase.from('sparepart').select('Handling order number');
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
            const { data, error } = await supabase
                .from('sparepart')
                .select('*');
            
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

    useEffect(() => {
        fetchOrders();
        // Realtime subscription
        const channel = supabase
            .channel('sparepart-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sparepart' }, () => {
                fetchOrders();
            })
            .subscribe();
        
        return () => supabase.removeChannel(channel);
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

            const { error } = await supabase
                .from('sparepart')
                .insert([payload]);

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
            const { error } = await supabase
                .from('sparepart')
                .update({
                    status: newStatus,
                    arrivedTime: new Date().toISOString(),
                    items: newItemsJson
                })
                .eq('Handling order number', order.id);

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
            const { error } = await supabase
                .from('sparepart')
                .update({
                    status: order.status,
                    arrivedTime: new Date().toISOString(),
                    items: order.items
                })
                .eq('Handling order number', order.id);

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
        <div className="flex h-screen bg-[#F2F2F7] relative">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden transition-opacity duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Hover to open or toggle on mobile */}
            <div
                className={`fixed left-0 top-0 h-full bg-white border-r border-zinc-200 shadow-2xl transition-all duration-300 z-[60] flex flex-col ${isNavbarVisible ? 'pt-[4.5rem]' : 'pt-4'} 
                ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-4 lg:hover:w-64'}`}
                onMouseEnter={() => window.innerWidth > 1024 && setIsSidebarOpen(true)}
                onMouseLeave={() => window.innerWidth > 1024 && setIsSidebarOpen(false)}
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100 relative">
                    <h2 className="font-black text-zinc-900 uppercase tracking-widest text-sm flex items-center gap-2">
                        <PackageSearch size={18} className="text-blue-500" /> Sparepart
                    </h2>
                    {/* Close Button Mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 text-zinc-400 hover:text-zinc-900"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 py-4 flex flex-col gap-2 px-4 overflow-y-auto custom-scrollbar transition-opacity duration-300"
                    style={{ opacity: !isSidebarOpen && window.innerWidth > 1024 ? 0 : 1 }}>
                    <button
                        onClick={() => setActiveTab('input')}
                        className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'input' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                    >
                        Input Pemesanan
                    </button>
                    <button
                        onClick={() => setActiveTab('view')}
                        className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between ${activeTab === 'view' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                    >
                        Daftar Pesanan
                        {pendingOrders.length > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'view' ? 'bg-white text-zinc-900 bg-opacity-20' : 'bg-red-500 text-white'}`}>{pendingOrders.length}</span>
                        )}
                    </button>
                </div>
                <div className="p-4 mt-auto border-t border-zinc-100">
                    <button onClick={handleLogout} className="w-full text-center px-4 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 transition-all duration-300 ${isNavbarVisible ? 'pt-20' : 'pt-8'} px-4 sm:px-8 pb-12 h-screen flex flex-col overflow-hidden ${isSidebarOpen ? 'lg:ml-64' : 'ml-0 lg:ml-4'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 shrink-0 gap-4">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-black text-zinc-900 mb-2">
                            {activeTab === 'input' ? 'Input Pemesanan Sparepart' : 'Daftar Pemesanan Sparepart'}
                        </h1>
                        <p className="text-zinc-500 font-medium text-xs sm:text-base">
                            {activeTab === 'input' ? 'Buat list order sparepart baru ke dalam sistem.' : 'Monitoring status ketersediaan barang pemesanan.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="lg:hidden p-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl shadow-sm active:scale-95 transition-all mr-auto"
                        >
                            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>

                        {activeTab === 'input' ? (
                            <>
                                <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current.click()} className="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all text-xs sm:text-sm">
                                    <Upload size={16} /> Import Excel
                                </button>
                            </>
                        ) : (
                            <div className="flex gap-2">
                                <span className="bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending ({pendingOrders.length})</span>
                                <span className="bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Arrived ({arrivedOrders.length})</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[999] flex justify-center items-center">
                        <div className="bg-zinc-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3 font-bold shadow-2xl">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                            Memproses...
                        </div>
                    </div>
                )}


                {/* Tab Contents */}
                {activeTab === 'input' && (
                    <div className="max-w-4xl w-full mx-auto animate-fade-in relative h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-8 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-4 sm:p-8 shadow-xl border border-zinc-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
                                    <div>
                                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Order Number</label>
                                        <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Contoh: ORD-2026-001" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Nama Pemesan</label>
                                        <input type="text" value={namaPemesan} onChange={e => setNamaPemesan(e.target.value)} required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nama mekanik / admin / customer" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Tanggal di Process CSI</label>
                                        <input type="date" value={tanggalCSI} onChange={e => setTanggalCSI(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Order Notes</label>
                                        <input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Catatan opsional..." />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-zinc-100">
                                    <div className="flex justify-between items-end mb-4">
                                        <label className="block text-sm font-black text-zinc-900 uppercase tracking-widest">List Items</label>
                                        <button type="button" onClick={handleAddItem} className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-blue-200 transition-colors">
                                            <Plus size={14} /> Tambah Item
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        {items.map((item, idx) => (
                                            <div key={idx} className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 flex flex-wrap lg:flex-nowrap gap-4 items-start relative">
                                                <button type="button" onClick={() => handleRemoveItem(idx)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-500 hover:text-white transition-colors" title="Hapus Item">
                                                    <Trash2 size={12} />
                                                </button>
                                                <div className="min-w-[150px] flex-1">
                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Part Number</label>
                                                    <input type="text" value={item.sparePartNumber} onChange={e => handleItemChange(idx, 'sparePartNumber', e.target.value)} required className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500" />
                                                </div>
                                                <div className="min-w-[200px] flex-[2]">
                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Part Name</label>
                                                    <input type="text" value={item.sparePartName} onChange={e => handleItemChange(idx, 'sparePartName', e.target.value)} required className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500" />
                                                </div>
                                                <div className="w-full sm:w-20">
                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Qty</label>
                                                    <input type="number" min="1" value={item.orderAmount} onChange={e => handleItemChange(idx, 'orderAmount', parseInt(e.target.value) || 1)} required className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 text-center focus:outline-none focus:border-blue-500" />
                                                </div>
                                                <div className="min-w-[150px] flex-1">
                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Notes</label>
                                                    <input type="text" value={item.orderingInstructions} onChange={e => handleItemChange(idx, 'orderingInstructions', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    {batchIndex > -1 && pendingBatch.length > 0 && (
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                Order {batchIndex + 1} / {pendingBatch.length}
                                            </div>
                                            {batchIndex < pendingBatch.length - 1 && (
                                                <button type="button" onClick={handleNextBatch} className="text-zinc-500 hover:text-zinc-900 font-bold text-xs flex items-center gap-1 transition-colors">
                                                    Skip <ArrowLeft size={14} className="rotate-180" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="w-full sm:w-auto ml-auto">
                                        <button type="submit" className="w-full bg-zinc-900 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-transform active:scale-95 shadow-lg text-sm">
                                            {batchIndex > -1 && batchIndex < pendingBatch.length - 1 ? 'Simpan & Lanjut' : 'Simpan Pemesanan'} <Send size={16} />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* VIEW PAGE */}
                {activeTab === 'view' && (
                    <div className="max-w-6xl w-full mx-auto animate-fade-in relative h-full flex flex-col">
                        <div className="flex justify-between items-end mb-8 shrink-0">
                            <div>
                                <h1 className="text-3xl font-black text-zinc-900 mb-2">Daftar Pemesanan Sparepart</h1>
                                <p className="text-zinc-500 font-medium">Monitoring status ketersediaan barang pemesanan.</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending ({pendingOrders.length})</span>
                                <span className="bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Arrived/Confirmed ({arrivedOrders.length})</span>
                            </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-zinc-200 mb-8 flex flex-wrap gap-4 items-end shrink-0">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Cari Pesanan</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Cari..."
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="w-full md:w-auto">
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                                <div className="relative">
                                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="appearance-none bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-10 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-inner min-w-[150px]"
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="pending">Pending / Sebagian</option>
                                        <option value="partial">Hanya Sebagian</option>
                                        <option value="arrived">Tiba / Selesai</option>
                                        <option value="confirmed">Confirmed Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="w-full md:w-auto">
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Tanggal</label>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            {(searchTerm || filterStatus !== 'all' || filterDate) && (
                                <button
                                    onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterDate(''); }}
                                    className="h-[50px] px-6 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
                                >
                                    <X size={16} /> Reset
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-8 custom-scrollbar">
                            <div className="grid grid-cols-1 gap-6 pb-20">
                                {filteredOrders.length === 0 ? (
                                    <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200 border-dashed text-zinc-400 font-bold flex flex-col items-center gap-4">
                                        <div className="bg-zinc-50 p-4 rounded-full">
                                            <Search size={40} className="opacity-20" />
                                        </div>
                                        <p>Tidak ada pesanan yang sesuai dengan filter.</p>
                                    </div>
                                ) : (
                                    filteredOrders.map(order => {
                                        let itemsArray = [];
                                        let isLegacyText = false;
                                        try {
                                            itemsArray = JSON.parse(order.items);
                                            if (!Array.isArray(itemsArray)) throw new Error('Not an array');
                                        } catch (e) {
                                            isLegacyText = true;
                                        }

                                        const isPending = order.status === 'pending' || order.status === 'partial';

                                        return (
                                            <div key={order.id} className="bg-white rounded-[1.5rem] overflow-hidden shadow-sm border border-zinc-200 hover:shadow-lg transition-all duration-300">
                                                <div className={`px-8 py-5 flex justify-between items-center border-b border-zinc-100 ${isPending ? (order.status === 'partial' ? 'bg-amber-50' : 'bg-zinc-50') : 'bg-green-50'}`}>
                                                    <div>
                                                        <h3 className="font-black text-xl text-zinc-900 flex items-center gap-3">
                                                            {order.orderNumber || '-'}
                                                            {order.status === 'confirmed' && <span className="text-[10px] bg-green-600 text-white px-2 py-1 rounded uppercase tracking-widest shadow-sm">Confirmed by Admin</span>}
                                                            {order.status === 'partial' && <span className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded uppercase tracking-widest shadow-sm">Sebagian Sampai</span>}
                                                        </h3>
                                                        <div className="flex items-center gap-4 mt-1">
                                                            <p className="text-xs text-zinc-500 font-medium">Pemesan: <span className="font-bold text-zinc-800">{order.namaPemesan || '-'}</span></p>
                                                            <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
                                                                <div className="flex flex-col leading-none">
                                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Dibuat</span>
                                                                    <div className="text-[11px] font-bold text-zinc-700">
                                                                        {(() => {
                                                                            const t = order.tanggalPembuatan || '-';
                                                                            let datePart = t;
                                                                            let timePart = '';
                                                                            if (t.includes(' ')) {
                                                                                const parts = t.split(' ');
                                                                                datePart = parts[0];
                                                                                timePart = parts[1];
                                                                            } else if (t.includes('T')) {
                                                                                const parts = t.split('T');
                                                                                datePart = parts[0];
                                                                                timePart = parts[1].substring(0, 5);
                                                                            }
                                                                            return (
                                                                                <div className="flex flex-col">
                                                                                    <span>{datePart}</span>
                                                                                    <span className="text-[10px] text-zinc-400 font-black">{timePart}</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {modifiedIds.has(order.id) ? (
                                                        <button onClick={() => handleSaveChanges(order)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                                            <Send size={16} /> Simpan Perubahan
                                                        </button>
                                                    ) : isPending ? (
                                                        <button onClick={() => handleSetArrived(order)} className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-zinc-200 hover:scale-105 active:scale-95 transition-transform flex items-center gap-2">
                                                            <Check size={16} /> Terima Semua
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-white font-black text-sm bg-green-500 px-5 py-2.5 rounded-xl shadow-lg shadow-green-100 border border-green-600">
                                                            <Check size={18} strokeWidth={3} /> Sudah Sampai
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-8">
                                                    {order.orderNotes && (
                                                        <div className="mb-6 text-sm text-zinc-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                            <span className="font-black text-blue-800 uppercase tracking-widest text-[10px] block mb-1">Catatan Order:</span> {order.orderNotes}
                                                        </div>
                                                    )}

                                                    <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                                                        {isLegacyText ? (
                                                            <div className="bg-zinc-50 p-6 text-sm font-medium whitespace-pre-line leading-relaxed text-zinc-800 font-mono">
                                                                {order.items || '-'}
                                                            </div>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-left text-sm bg-white">
                                                                    <thead>
                                                                        <tr className="bg-zinc-50 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                                                                            <th className="px-6 py-4 border-b border-zinc-200">Part Info</th>
                                                                            <th className="px-6 py-4 border-b border-zinc-200 text-center">Qty</th>
                                                                            <th className="px-6 py-4 border-b border-zinc-200 w-1/3">Notes</th>
                                                                            <th className="px-6 py-4 border-b border-zinc-200 text-center">Tiba</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-zinc-100">
                                                                        {itemsArray.map((item, idx) => (
                                                                            <tr key={idx} className={`hover:bg-zinc-50/50 transition-colors ${item.isArrived ? 'bg-green-50/30' : ''}`}>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="font-black text-zinc-900 text-base">{item.sparePartName}</div>
                                                                                    <div className="font-mono text-xs font-bold text-zinc-500">{item.sparePartNumber}</div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    <span className="bg-zinc-100 px-3 py-1 rounded-lg font-black">{item.orderAmount}</span>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-zinc-600 font-medium">
                                                                                    {item.orderingInstructions || '-'}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    {/* LOCK ITEM IF IT'S ARRIVED AND NOT MODIFIED (Meaning it's already in DB) */}
                                                                                    {(item.isArrived && !modifiedIds.has(order.id) && !isPending) || (item.isArrived && !modifiedIds.has(order.id) && (order.status === 'arrived' || order.status === 'partial' || order.status === 'confirmed')) ? (
                                                                                        <div className="flex flex-col items-center text-green-600 font-black animate-fade-in">
                                                                                            <Check size={20} className="bg-green-100 rounded-full p-0.5" strokeWidth={4} />
                                                                                            <span className="text-[10px] uppercase tracking-tighter mt-0.5">Sudah Sampai</span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <button
                                                                                            onClick={() => handleCheckItem(order, idx)}
                                                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto border-2 ${item.isArrived ? 'bg-green-500 border-green-600 text-white shadow-lg' : 'bg-zinc-50 border-zinc-200 text-zinc-300 hover:border-green-400 hover:text-green-400 cursor-pointer scale-100 active:scale-90'}`}
                                                                                        >
                                                                                            <Check size={20} className={item.isArrived ? 'opacity-100' : 'opacity-20'} strokeWidth={3} />
                                                                                        </button>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {(order.status === 'confirmed' || order.status === 'arrived' || order.status === 'partial') && order.arrivedTime && (
                                                        <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                            <span className="bg-zinc-100 px-3 py-1.5 rounded-lg inline-block">
                                                                {order.status === 'partial' ? 'Update Terakhir' : 'Sampai'} Pukul: {new Date(order.arrivedTime).toLocaleString('id-ID')}
                                                            </span>
                                                            {order.status === 'confirmed' && order.confirmedBy && (
                                                                <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg inline-block ml-2">
                                                                    Diketahui: {order.confirmedBy} ({new Date(order.confirmedTime).toLocaleString('id-ID')})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
            `}</style>
            </div>
        </div >
    );
}
