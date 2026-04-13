import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PackageSearch, Plus, Trash2, Check, ArrowLeft, Send, Upload, Search, Filter, X, Menu, FileText, TrendingUp } from 'lucide-react';
import QuotationSPA from '../quotation/QuotationSPA';
import ProfitDashboard from './ProfitDashboard';
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
    const [masterParts, setMasterParts] = useState([]); 
    const [isLoading, setIsLoading] = useState(false);
    
    // Filtering & Search states (Restored)
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState('');
    
    const [searchMaster, setSearchMaster] = useState(''); // Search for Master Data

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

    const fetchMasterParts = async () => {
        try {
            // Load only top 20 as default view to avoid heavy load
            const { data, error } = await supabase.from('sparepart_master').select('*').limit(20);
            if (error) throw error;
            setMasterParts(data || []);
        } catch (e) {
            console.error("Gagal fetch master sparepart:", e);
        }
    };

    useEffect(() => {
        const fetchSearchMaster = async () => {
            if (searchMaster.length < 2) {
                const { data } = await supabase.from('sparepart_master').select('*').limit(20);
                if (data) setMasterParts(data);
                return;
            }
            const { data } = await supabase
                .from('sparepart_master')
                .select('*')
                .or(`part_name.ilike.%${searchMaster}%,part_number.ilike.%${searchMaster}%`)
                .limit(100);
            if (data) setMasterParts(data);
        };
        const tid = setTimeout(fetchSearchMaster, 400);
        return () => clearTimeout(tid);
    }, [searchMaster]);

    useEffect(() => {
        fetchOrders();
        
        const sparepartChannel = supabase.channel('sparepart-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sparepart' }, () => fetchOrders())
            .subscribe();

        const masterChannel = supabase.channel('master-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sparepart_master' }, () => {
                // Refresh search if any change occurs in master data
                if (searchMaster.length >= 2) {
                    setSearchMaster(s => s + ' '); // Trigger tiny change to refetch
                    setTimeout(() => setSearchMaster(s => s.trim()), 10);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sparepartChannel);
            supabase.removeChannel(masterChannel);
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
        <div className="flex h-screen bg-[#FDFDFD] text-zinc-900 font-sans tracking-tight overflow-hidden selection:bg-zinc-200">
            {/* Sidebar - Fixed & Sleek */}
            <div className={`fixed inset-y-0 left-0 bg-zinc-950 text-white z-[60] flex flex-col transition-all duration-500 ease-in-out shadow-[10px_0_40px_rgba(0,0,0,0.1)]
                ${isSidebarOpen ? 'w-72' : 'w-20'}`}
                onMouseEnter={() => setIsSidebarOpen(true)}
                onMouseLeave={() => setIsSidebarOpen(false)}
            >
                <div className="h-20 flex items-center px-6 border-b border-white/5">
                    <div className="bg-white/10 p-2 rounded-xl border border-white/10 shrink-0">
                        <PackageSearch size={22} className="text-white" />
                    </div>
                    <div className={`ml-4 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <h2 className="font-black text-sm uppercase tracking-widest leading-none">Sparepart</h2>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 block">Operational Hub</span>
                    </div>
                </div>

                <div className="flex-1 py-10 flex flex-col gap-1.5 px-3">
                    {[
                        { id: 'input', label: 'Input Order', icon: Plus },
                        { id: 'view', label: 'Daftar Pesanan', icon: Search, badge: pendingOrders.length },
                        { id: 'master', label: 'Master Database', icon: PackageSearch },
                        { id: 'profit', label: 'Analisis Profit', icon: TrendingUp },
                        { id: 'quotation', label: 'Quote Manager', icon: FileText }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 relative group ${
                                    isActive ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Icon size={20} className="shrink-0" />
                                <span className={`font-black text-sm uppercase tracking-tight transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                                    {tab.label}
                                </span>
                                {tab.badge > 0 && !isActive && (
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-white/5">
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-black text-xs text-red-400 hover:bg-red-500/10 transition-all uppercase tracking-widest">
                        <ArrowLeft size={18} />
                        <span className={`transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>Logout System</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col h-screen transition-all duration-500 ml-20 ${isSidebarOpen ? 'lg:ml-72' : 'ml-20'}`}>
                
                {/* Header Bar */}
                <header className="h-20 border-b border-zinc-100 flex items-center justify-between px-10 bg-white/50 backdrop-blur-xl sticky top-0 z-50 shrink-0">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase italic flex items-center gap-3">
                            {activeTab === 'input' ? 'Entry Data Pemesanan' : 
                             activeTab === 'quotation' ? 'Sparepart Quotation' : 
                             activeTab === 'master' ? 'Database Master Part' : 
                             activeTab === 'profit' ? 'Analisis Profit' :
                             'Monitoring Ketersediaan'}
                            <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {activeTab === 'input' && (
                            <>
                                <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current.click()} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all border border-emerald-100">
                                    <Upload size={14} /> Import Master Excel
                                </button>
                            </>
                        )}
                        {activeTab === 'master' && (
                            <button 
                                onClick={async () => {
                                    const file = await new Promise(resolve => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.onchange = e => resolve(e.target.files[0]);
                                        input.click();
                                    });
                                    if (!file) return;
                                    
                                    setIsLoading(true);
                                    const reader = new FileReader();
                                    reader.onload = async (evt) => {
                                        try {
                                            const wb = XLSX.read(evt.target.result, { type: 'binary' });
                                            const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                                            
                                            const parsePrice = (val) => {
                                                if (val === undefined || val === null || val === '') return 0;
                                                if (typeof val === 'number') return val;
                                                
                                                let clean = String(val).replace(/Rp|\s/gi, '').trim();
                                                
                                                if ((clean.match(/\./g) || []).length > 1) {
                                                    clean = clean.replace(/\./g, '');
                                                }
                                                
                                                if (clean.includes(',') && clean.includes('.')) {
                                                    clean = clean.replace(/\./g, '').replace(/,/g, '.');
                                                } else if (clean.includes(',')) {
                                                    const parts = clean.split(',');
                                                    if (parts[parts.length - 1].length === 2) {
                                                        clean = clean.replace(/\./g, '').replace(/,/g, '.');
                                                    } else {
                                                        clean = clean.replace(/,/g, '');
                                                    }
                                                } else if (clean.includes('.')) {
                                                    if (clean.split('.').pop().length === 3) {
                                                        clean = clean.replace(/\./g, '');
                                                    }
                                                }
                                                
                                                const res = parseFloat(clean);
                                                return isNaN(res) ? 0 : res;
                                            };

                                            const formatted = rawData.map(row => {
                                                const normalizedRow = {};
                                                Object.keys(row).forEach(key => {
                                                    normalizedRow[key.trim().toLowerCase()] = row[key];
                                                });

                                                const getVal = (exactName) => normalizedRow[exactName.toLowerCase().trim()];

                                                return {
                                                    part_number: String(getVal('Spare part number') || '').trim(),
                                                    part_name: String(getVal('Spare part name') || '').trim(),
                                                    wholesale_price_no_tax: parsePrice(getVal('Wholesale price without tax')),
                                                    wholesale_price: parsePrice(getVal('Wholesale price')),
                                                    sales_guide_price_no_tax: parsePrice(getVal('Sales guide price excluding tax')),
                                                    sales_guide_price: parsePrice(getVal('sales guide price')),
                                                };
                                            }).filter(r => r.part_number && r.part_name);

                                            if (formatted.length === 0) throw new Error("Format Kolom Tidak Pas. Pastikan nama kolom sama persis dengan yang Anda berikan.");

                                            const { error } = await supabase.from('sparepart_master').upsert(formatted, { onConflict: 'part_number' });
                                            if (error) throw error;
                                            
                                            Toastify({ text: `Impor ${formatted.length} data berhasil!`, background: "black", color: "white" }).showToast();
                                            fetchMasterParts();
                                        } catch (err) {
                                            Toastify({ text: "Gagal impor: " + err.message, background: "red" }).showToast();
                                        } finally {
                                            setIsLoading(false);
                                        }
                                    };
                                    reader.readAsBinaryString(file);
                                }}
                                className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all"
                            >
                                <Upload size={14} /> Import Master CSV/Excel
                            </button>
                        )}
                        {activeTab === 'master' && (
                            <button 
                                onClick={async () => {
                                    if(confirm("Hapus seluruh data Master Sparepart? Tindakan ini tidak bisa dibatalkan.")) {
                                        setIsLoading(true);
                                        const { error } = await supabase.from('sparepart_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                                        setIsLoading(false);
                                        if (error) Toastify({ text: "Gagal: " + error.message, background: "red" }).showToast();
                                        else {
                                            Toastify({ text: "Database master dikosongkan.", background: "black" }).showToast();
                                            fetchMasterParts();
                                        }
                                    }
                                }}
                                className="bg-red-50 text-red-600 border border-red-100 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all"
                            >
                                <Trash2 size={14} /> Hapus Semua
                            </button>
                        )}
                        {activeTab === 'view' && (
                            <div className="flex gap-2">
                                <div className="bg-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending {pendingOrders.length}
                                </div>
                                <div className="bg-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Selesai {arrivedOrders.length}
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


                {/* Main Content Area Wrapper */}
                <main className="flex-1 overflow-y-auto no-scrollbar p-10 animate-fade-in relative">
                    
                    {/* Tab Contents */}
                    {activeTab === 'input' && (
                        <div className="max-w-6xl mx-auto space-y-10">
                            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-zinc-100 p-10">
                                <div className="flex items-center gap-4 mb-10 border-b border-zinc-50 pb-8">
                                    <div className="p-4 bg-zinc-900 text-white rounded-2xl shadow-xl">
                                        <Plus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl tracking-tight uppercase tracking-widest">Informasi Utama</h3>
                                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Detail administratif pesanan</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                                    {[
                                        { label: 'Order Number', value: orderNumber, onChange: setOrderNumber, placeholder: 'QT-2026-X', type: 'text' },
                                        { label: 'Founder / Pemesan', value: namaPemesan, onChange: setNamaPemesan, placeholder: 'Nama staff', type: 'text' },
                                        { label: 'CSI Process Date', value: tanggalCSI, onChange: setTanggalCSI, type: 'date' },
                                        { label: 'Catatan Order', value: orderNotes, onChange: setOrderNotes, placeholder: 'Opsional...', type: 'text' }
                                    ].map((f, i) => (
                                        <div key={i} className="space-y-2">
                                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{f.label}</label>
                                            <input 
                                                type={f.type} 
                                                value={f.value} 
                                                onChange={e => f.onChange(e.target.value)} 
                                                required={i < 2}
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3.5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all placeholder:text-zinc-300" 
                                                placeholder={f.placeholder}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-10 border-t border-zinc-100">
                                    <div className="flex justify-between items-center mb-8">
                                        <div className="flex items-center gap-3">
                                            <PackageSearch size={22} className="text-blue-500" />
                                            <h3 className="font-black text-base uppercase tracking-widest">List Suku Cadang</h3>
                                        </div>
                                        <button type="button" onClick={handleAddItem} className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95">
                                            <Plus size={14} /> Item Baru
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {items.map((item, idx) => (
                                            <div key={idx} className="bg-zinc-50/50 rounded-3xl p-6 border border-zinc-100 flex flex-wrap lg:flex-nowrap gap-6 items-end relative group hover:bg-white hover:shadow-lg transition-all border-dashed hover:border-solid">
                                                <button type="button" onClick={() => handleRemoveItem(idx)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-lg">
                                                    <Trash2 size={14} />
                                                </button>
                                                <div className="flex-[2] min-w-[200px]">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nama Suku Cadang</label>
                                                    <input type="text" value={item.sparePartName} onChange={e => handleItemChange(idx, 'sparePartName', e.target.value)} required className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-zinc-100 transition-all" />
                                                </div>
                                                <div className="flex-1 min-w-[150px]">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Part Number</label>
                                                    <input type="text" value={item.sparePartNumber} onChange={e => handleItemChange(idx, 'sparePartNumber', e.target.value)} required className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-mono font-bold focus:ring-4 focus:ring-zinc-100 transition-all uppercase" />
                                                </div>
                                                <div className="w-24">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1 text-center">Qty</label>
                                                    <input type="number" min="1" value={item.orderAmount} onChange={e => handleItemChange(idx, 'orderAmount', parseInt(e.target.value) || 1)} required className="w-full bg-white border border-zinc-200 rounded-2xl px-2 py-3 text-sm font-black text-center" />
                                                </div>
                                                <div className="flex-[1.5] min-w-[180px]">
                                                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Instruksi / Catatan</label>
                                                    <input type="text" value={item.orderingInstructions} onChange={e => handleItemChange(idx, 'orderingInstructions', e.target.value)} className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-bold" placeholder="Contoh: Urgent" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-16 pt-10 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-10">
                                    {(batchIndex > -1 && pendingBatch.length > 0) ? (
                                        <div className="flex items-center gap-6 bg-zinc-50 px-6 py-3 rounded-[2rem] border border-zinc-100">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-sm shadow-sm">
                                                {batchIndex + 1}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Progress Batch</p>
                                                <p className="font-bold text-sm">Sedang Memproses {pendingBatch.length} Data</p>
                                            </div>
                                            <button type="button" onClick={handleNextBatch} className="ml-4 text-blue-600 font-black text-xs uppercase tracking-widest hover:underline">Skip Data</button>
                                        </div>
                                    ) : <div className="hidden md:block"></div>}
                                    
                                    <button type="submit" className="w-full md:w-auto bg-zinc-950 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:scale-95 text-xs">
                                        <Send size={18} /> {batchIndex > -1 ? 'Simpan & Lanjut' : 'Finalize & Simpan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* VIEW PAGE */}
                    {activeTab === 'view' && (
                        <div className="max-w-7xl mx-auto space-y-10">
                            {/* Search & Filter Bar - Premium Header */}
                            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-zinc-100 flex flex-wrap gap-8 items-end animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex-1 min-w-[300px] space-y-2">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cari Database Pesanan</label>
                                    <div className="relative group">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Masukkan nomor order, nama, atau part..."
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-14 pr-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="w-full md:w-auto space-y-2">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Status Ketersediaan</label>
                                    <div className="relative">
                                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <select
                                            value={filterStatus}
                                            onChange={e => setFilterStatus(e.target.value)}
                                            className="appearance-none bg-zinc-50 border border-zinc-200 rounded-2xl pl-12 pr-10 py-4 font-black text-xs uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all cursor-pointer min-w-[200px]"
                                        >
                                            <option value="all">Semua Data</option>
                                            <option value="pending">Belum Sampai</option>
                                            <option value="partial">Parsial (Sebagian)</option>
                                            <option value="arrived">Sudah Tiba</option>
                                            <option value="confirmed">Konfirmasi Admin</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="w-full md:w-auto space-y-2">
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Filter Tanggal</label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={e => setFilterDate(e.target.value)}
                                        className="bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all h-[54px]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-32">
                                {filteredOrders.length === 0 ? (
                                    <div className="lg:col-span-2 text-center py-40 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-200">
                                        <PackageSearch size={60} className="mx-auto text-zinc-200 mb-6" />
                                        <p className="font-black text-zinc-300 uppercase tracking-widest">Database Kosong</p>
                                    </div>
                                ) : (
                                    filteredOrders.map(order => {
                                        let itemsArray = [];
                                        try { itemsArray = JSON.parse(order.items); } catch (e) { itemsArray = []; }
                                        const isPending = order.status === 'pending' || order.status === 'partial';

                                        return (
                                            <div key={order.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.03)] border border-zinc-100 hover:shadow-xl transition-all duration-500 group">
                                                <div className={`px-10 py-8 flex justify-between items-center border-b border-zinc-50 ${isPending ? 'bg-zinc-50/50' : 'bg-emerald-50/20'}`}>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="font-black text-2xl tracking-tighter uppercase">{order.orderNumber || 'NO-ID'}</h3>
                                                            {order.status === 'partial' && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase">Partial</span>}
                                                            {order.status === 'confirmed' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">Confirmed</span>}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{order.namaPemesan || 'Tanpa Nama'} • {order.tanggalPembuatan || 'Setiap Saat'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {modifiedIds.has(order.id) ? (
                                                            <button onClick={() => handleSaveChanges(order)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                                                Simpan Update
                                                            </button>
                                                        ) : isPending ? (
                                                            <button onClick={() => handleSetArrived(order)} className="bg-zinc-950 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 shadow-xl">
                                                                Terima Semua
                                                            </button>
                                                        ) : (
                                                            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-full border border-emerald-100">
                                                                <Check size={20} strokeWidth={4} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="p-10 space-y-8">
                                                    {order.orderNotes && (
                                                        <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-50 text-xs font-bold text-blue-800 leading-relaxed italic">
                                                            "{order.orderNotes}"
                                                        </div>
                                                    )}

                                                    <div className="space-y-4">
                                                        {itemsArray.map((item, idx) => (
                                                            <div key={idx} className={`p-5 rounded-3xl border transition-all flex items-center justify-between ${item.isArrived ? 'bg-emerald-50/30 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
                                                                <div className="flex-1">
                                                                    <div className="font-black text-sm tracking-tight mb-1">{item.sparePartName}</div>
                                                                    <div className="font-mono text-[10px] text-zinc-400 flex items-center gap-2">
                                                                        {item.sparePartNumber} 
                                                                        <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                                                                        <span className="text-zinc-900 font-black">{item.orderAmount} UNIT</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleCheckItem(order, idx)}
                                                                    disabled={!isPending && !modifiedIds.has(order.id)}
                                                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${item.isArrived ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-zinc-100 text-zinc-200 hover:border-emerald-500 hover:text-emerald-500'}`}
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

                    {activeTab === 'master' && (
                        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
                            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-zinc-100 flex items-center gap-6">
                                <div className="flex-1 relative group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300" size={20} />
                                    <input 
                                        type="text" 
                                        value={searchMaster} 
                                        onChange={e => setSearchMaster(e.target.value)}
                                        placeholder="Cari part number atau nama barang..."
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-14 pr-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-zinc-950 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                                                <th className="px-10 py-6">ID & Part Name</th>
                                                <th className="px-10 py-6">Wholesale (No Tax)</th>
                                                <th className="px-10 py-6">Wholesale (Tax)</th>
                                                <th className="px-10 py-6">Sales Guide (No Tax)</th>
                                                <th className="px-10 py-6">Sales Guide (Tax)</th>
                                                <th className="px-10 py-6 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50">
                                            {masterParts.filter(p => 
                                                p.part_name.toLowerCase().includes(searchMaster.toLowerCase()) || 
                                                p.part_number.toLowerCase().includes(searchMaster.toLowerCase())
                                            ).map((part) => (
                                                <tr key={part.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                    <td className="px-10 py-6">
                                                        <div className="font-black text-xs tracking-tighter uppercase">{part.part_name}</div>
                                                        <div className="font-mono text-[9px] text-zinc-400 mt-1 uppercase tracking-widest">{part.part_number}</div>
                                                    </td>
                                                    <td className="px-10 py-6 font-bold text-xs text-zinc-600">
                                                        Rp {part.wholesale_price_no_tax?.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="font-black text-sm text-zinc-900 border-l-4 border-emerald-500 pl-4 bg-emerald-50/30 py-2 rounded-r-xl">
                                                            Rp {part.wholesale_price?.toLocaleString('id-ID')}
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 font-bold text-xs text-zinc-600">
                                                        Rp {part.sales_guide_price_no_tax?.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="font-black text-sm text-zinc-900 border-l-4 border-blue-500 pl-4 bg-blue-50/30 py-2 rounded-r-xl">
                                                            Rp {part.sales_guide_price?.toLocaleString('id-ID')}
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={async () => {
                                                                    const newName = prompt("Edit Part Name", part.part_name);
                                                                    const newPrice = prompt("Edit Wholesale Price", part.wholesale_price);
                                                                    if (newName && newPrice) {
                                                                        const { error } = await supabase.from('sparepart_master').update({ 
                                                                            part_name: newName, 
                                                                            wholesale_price: parseFloat(newPrice) 
                                                                        }).eq('id', part.id);
                                                                        if (!error) fetchMasterParts();
                                                                    }
                                                                }}
                                                                className="p-3 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                                                            >
                                                                <FileText size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={async () => {
                                                                    if (confirm(`Hapus ${part.part_name}?`)) {
                                                                        const { error } = await supabase.from('sparepart_master').delete().eq('id', part.id);
                                                                        if (!error) fetchMasterParts();
                                                                    }
                                                                }}
                                                                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profit' && (
                        <div className="flex-1 animate-fade-in pb-32">
                           <ProfitDashboard />
                        </div>
                    )}

                    {activeTab === 'quotation' && (
                        <div className="flex-1 animate-fade-in pb-32">
                            <QuotationSPA />
                        </div>
                    )}
                </main>
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
