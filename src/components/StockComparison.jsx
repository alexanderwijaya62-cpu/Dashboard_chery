import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Search, Filter, ArrowUpDown, 
  AlertTriangle, CheckCircle, Info, ChevronRight,
  Download, RefreshCw, Layers, Upload, Database, HardDrive, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';

export default function StockComparison({ user, setCurrentPage }) {
    const [dmsData, setDmsData] = useState({}); // Keyed by Part Number
    const [internalData, setInternalData] = useState({}); // Keyed by Part Number
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'part_name', direction: 'ascending' });
    const [filterReason, setFilterReason] = useState('all');

    const dmsInputRef = useRef(null);
    const internalInputRef = useRef(null);

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawRows = XLSX.utils.sheet_to_json(ws);

                if (rawRows.length === 0) {
                    Toastify({ text: "File Excel kosong!", style: { background: "#ef4444" } }).showToast();
                    return;
                }

                const dataMap = {};
                rawRows.forEach(row => {
                    let pNum, pName, qty;
                    
                    if (type === 'DMS') {
                        // DMS Headers: Spare part number, Spare part name, Inventory quantity
                        pNum = String(row['Spare part number'] || row['part_number'] || '').trim();
                        pName = String(row['Spare part name'] || row['part_name'] || '').trim();
                        qty = parseInt(row['Inventory quantity'] || row['qty'] || 0);
                    } else {
                        // Internal Headers: Sparepart Number, Sparepart Name, Qty
                        pNum = String(row['Sparepart Number'] || row['part_number'] || '').trim();
                        pName = String(row['Sparepart Name'] || row['part_name'] || '').trim();
                        qty = parseInt(row['Qty'] || row['qty'] || 0);
                    }

                    if (pNum && pNum !== 'undefined') {
                        if (dataMap[pNum]) {
                            dataMap[pNum].qty += qty;
                            // Keep the longest name or the existing one
                            if (pName && pName.length > dataMap[pNum].part_name.length) {
                                dataMap[pNum].part_name = pName;
                            }
                        } else {
                            dataMap[pNum] = { part_number: pNum, part_name: pName, qty };
                        }
                    }
                });

                if (type === 'DMS') setDmsData(dataMap);
                else setInternalData(dataMap);

                Toastify({ 
                    text: `✅ ${type} Data Berhasil Diimpor (${Object.keys(dataMap).length} item)`, 
                    style: { background: "#10b981" } 
                }).showToast();

            } catch (err) {
                console.error("Import error:", err);
                Toastify({ text: "Gagal membaca Excel", style: { background: "#ef4444" } }).showToast();
            } finally {
                setIsLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const clearData = () => {
        setDmsData({});
        setInternalData({});
        Toastify({ text: "🗑️ Data telah dibersihkan", style: { background: "#6b7280" } }).showToast();
    };

    const handleExport = () => {
        if (filteredData.length === 0) {
            Toastify({ text: "Tidak ada data untuk diekspor!", style: { background: "#ef4444" } }).showToast();
            return;
        }

        const exportData = filteredData.map(item => ({
            'Part Number': item.part_number,
            'Part Name': item.part_name,
            'Stock Internal': item.internal_stock,
            'Stock CSI (DMS)': item.csi_stock,
            'Selisih (Miss Qty)': item.miss_parts,
            'Rekomendasi / Alasan': item.reason
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Comparison");
        
        // Auto-size columns
        const colWidths = Object.keys(exportData[0]).map(key => ({
            wch: Math.max(key.length, ...exportData.map(row => String(row[key] || '').length)) + 2
        }));
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `Stock_Comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        Toastify({ 
            text: "✅ Data berhasil diekspor ke Excel", 
            style: { background: "#10b981" } 
        }).showToast();
    };

    const downloadTemplate = (type) => {
        const headers = type === 'DMS' 
            ? ['Spare part number', 'Spare part name', 'Inventory quantity']
            : ['Sparepart Number', 'Sparepart Name', 'Qty'];
            
        const exampleData = [
            type === 'DMS' 
                ? { 'Spare part number': 'P001-X', 'Spare part name': 'Contoh Sparepart DMS', 'Inventory quantity': 10 }
                : { 'Sparepart Number': 'P001-X', 'Sparepart Name': 'Contoh Sparepart Internal', 'Qty': 8 }
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        // Column widths
        ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }];
        
        XLSX.writeFile(wb, `Template_Import_${type}.xlsx`);
        
        Toastify({ 
            text: `✅ Template ${type} berhasil diunduh`, 
            style: { background: "#10b981" } 
        }).showToast();
    };

    const combinedData = useMemo(() => {
        const allPartNumbers = new Set([
            ...Object.keys(dmsData),
            ...Object.keys(internalData)
        ]);

        return Array.from(allPartNumbers).map(pNum => {
            const dms = dmsData[pNum];
            const internal = internalData[pNum];

            const dmsQty = dms ? dms.qty : 0;
            const intQty = internal ? internal.qty : 0;
            const pName = (dms?.part_name || internal?.part_name || 'Tanpa Nama');

            const diff = dmsQty - intQty;
            const missQty = Math.abs(diff);

            let reason = 'Sesuai';
            let type = 'match';

            if (!dms) {
                reason = 'Tidak terdaftar di DMS (CSI)';
                type = 'not_in_dms';
            } else if (!internal) {
                reason = 'habis/ tidak ada di nternal';
                type = 'not_in_internal';
            } else if (dmsQty > intQty) {
                reason = `Input penjualan di csi sebanyak ${missQty} qty`;
                type = 'csi_higher';
            } else if (intQty > dmsQty) {
                reason = 'Perlu penjualan di csi';
                type = 'internal_higher';
            }

            return {
                part_number: pNum,
                part_name: pName,
                csi_stock: dmsQty,
                internal_stock: intQty,
                miss_parts: missQty,
                reason,
                type,
                existsInDms: !!dms,
                existsInInternal: !!internal
            };
        });
    }, [dmsData, internalData]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...combinedData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
                }
                
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                
                if (strA < strB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (strA > strB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [combinedData, sortConfig]);

    const filteredData = useMemo(() => {
        return sortedData.filter(item => {
            const matchesSearch = 
                item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.part_name?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesFilter = 
                filterReason === 'all' ||
                (filterReason === 'miss' && item.type !== 'match') ||
                (filterReason === 'match' && item.type === 'match') ||
                (filterReason === 'not_found' && (item.type === 'not_in_dms' || item.type === 'not_in_internal'));

            return matchesSearch && matchesFilter;
        });
    }, [sortedData, searchTerm, filterReason]);

    const stats = useMemo(() => {
        const total = combinedData.length;
        const miss = combinedData.filter(d => d.type !== 'match').length;
        const matching = total - miss;
        return { total, miss, matching };
    }, [combinedData]);

    return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/30">
            {/* Header section with Glassmorphism */}
            <div className="sticky top-0 z-40 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 md:px-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setCurrentPage(user?.role)}
                            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 group"
                        >
                            <ArrowLeft size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase italic">
                                Stock Comparison <span className="text-indigo-500">Excel Mode</span>
                            </h1>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Inventory Accuracy Hub</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden lg:flex gap-4 mr-4">
                            <StatBadge label="Total Combined" value={stats.total} color="bg-zinc-500/10 text-zinc-400" />
                            <StatBadge label="Miss/Not Found" value={stats.miss} color="bg-orange-500/10 text-orange-400" />
                            <StatBadge label="Sesuai" value={stats.matching} color="bg-emerald-500/10 text-emerald-400" />
                        </div>
                        <button 
                            onClick={handleExport}
                            className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-2"
                            title="Export to Excel"
                        >
                            <Download size={18} />
                            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Export</span>
                        </button>
                        <button 
                            onClick={clearData}
                            className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all"
                            title="Reset Data"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-8">
                
                {/* Upload Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="group relative flex flex-col items-center justify-center p-10 bg-[#18181B] border-2 border-dashed border-indigo-500/30 rounded-[2rem] cursor-pointer hover:border-indigo-500/60 hover:bg-indigo-500/[0.02] transition-all">
                        <input type="file" ref={dmsInputRef} onChange={(e) => handleFileUpload(e, 'DMS')} className="hidden" accept=".xlsx,.xls,.csv" />
                        <div className={`p-4 rounded-2xl mb-4 transition-all ${Object.keys(dmsData).length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400 group-hover:scale-110'}`}>
                            <Database size={32} />
                        </div>
                        <h3 className="text-white font-black text-sm uppercase tracking-widest text-center">1. Import DMS (CSI)<br/><span className="text-[10px] text-zinc-500">Inventory quantity</span></h3>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); downloadTemplate('DMS'); }}
                            className="mt-4 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <Download size={14} />
                            Download Template
                        </button>
                    </label>

                    <label className="group relative flex flex-col items-center justify-center p-10 bg-[#18181B] border-2 border-dashed border-blue-500/30 rounded-[2rem] cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/[0.02] transition-all">
                        <input type="file" ref={internalInputRef} onChange={(e) => handleFileUpload(e, 'Internal')} className="hidden" accept=".xlsx,.xls,.csv" />
                        <div className={`p-4 rounded-2xl mb-4 transition-all ${Object.keys(internalData).length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-400 group-hover:scale-110'}`}>
                            <HardDrive size={32} />
                        </div>
                        <h3 className="text-white font-black text-sm uppercase tracking-widest text-center">2. Import Internal<br/><span className="text-[10px] text-zinc-500">Qty</span></h3>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); downloadTemplate('Internal'); }}
                            className="mt-4 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-500/20 transition-all flex items-center gap-2"
                        >
                            <Download size={14} />
                            Download Template
                        </button>
                    </label>
                </div>

                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Cari part number atau nama sparepart..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#18181B] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-zinc-600"
                        />
                    </div>
                    <div className="md:col-span-4 relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <select 
                            value={filterReason}
                            onChange={(e) => setFilterReason(e.target.value)}
                            className="w-full appearance-none bg-[#18181B] border border-white/5 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                        >
                            <option value="all">Semua Status</option>
                            <option value="miss">Hanya Miss Stock</option>
                            <option value="not_found">Hanya Tidak Terdaftar</option>
                            <option value="match">Hanya Sesuai</option>
                        </select>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-[#121214] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">Processing Comparison...</p>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5">
                                    <th className="px-6 py-6 cursor-pointer hover:bg-white/[0.05] transition-colors group" onClick={() => requestSort('part_number')}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Part Number</span>
                                            <ArrowUpDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 cursor-pointer hover:bg-white/[0.05] transition-colors group" onClick={() => requestSort('part_name')}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Part Name</span>
                                            <ArrowUpDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 cursor-pointer hover:bg-white/[0.05] transition-colors group text-right" onClick={() => requestSort('internal_stock')}>
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Internal</span>
                                            <ArrowUpDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 cursor-pointer hover:bg-white/[0.05] transition-colors group text-right" onClick={() => requestSort('csi_stock')}>
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">CSI (DMS)</span>
                                            <ArrowUpDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 cursor-pointer hover:bg-white/[0.05] transition-colors group text-center" onClick={() => requestSort('miss_parts')}>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Miss Qty</span>
                                            <ArrowUpDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-6">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Action Label</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                <Layers size={40} />
                                                <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Import file untuk memulai perbandingan</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-mono font-bold text-zinc-500 tracking-wider transition-colors group-hover:text-white">
                                                    {item.part_number}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-black text-white">{item.part_name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-black ${item.existsInInternal ? 'text-zinc-400' : 'text-red-500/50'}`}>
                                                    {item.existsInInternal ? item.internal_stock : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-black ${item.existsInDms ? 'text-indigo-400' : 'text-red-500/50'}`}>
                                                    {item.existsInDms ? item.csi_stock : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {item.miss_parts > 0 ? (
                                                    <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full font-black text-sm border border-red-500/20 shadow-lg shadow-red-500/5">
                                                        {item.miss_parts}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-500 font-bold text-sm">0</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <ReasonBadge type={item.type} label={item.reason} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatBadge({ label, value, color }) {
    return (
        <div className={`${color} px-4 py-2 rounded-2xl flex items-center gap-3 border border-current/10`}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <span className="text-sm font-black">{value}</span>
        </div>
    );
}

function ReasonBadge({ type, label }) {
    const baseClass = "flex items-center gap-2 px-4 py-2 rounded-xl w-fit border";
    
    if (type === 'match') {
        return (
            <div className={`${baseClass} bg-emerald-500/10 text-emerald-500 border-emerald-500/20`}>
                <CheckCircle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
        );
    }
    
    if (type === 'csi_higher') {
        return (
            <div className={`${baseClass} bg-orange-500/10 text-orange-400 border-orange-500/20`}>
                <AlertTriangle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
        );
    }

    if (type === 'internal_higher') {
        return (
            <div className={`${baseClass} bg-blue-500/10 text-blue-400 border-blue-500/20`}>
                <Info size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
        );
    }

    // Logic for "Tidak Terdaftar"
    return (
        <div className={`${baseClass} bg-red-500/10 text-red-400 border-red-500/20 animate-pulse`}>
            <AlertTriangle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </div>
    );
}
