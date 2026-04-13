import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  TrendingUp, 
  AlertCircle, 
  Package, 
  ArrowRight,
  TrendingDown,
  BarChart3,
  Zap,
  Download,
  Filter
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import * as XLSX from 'xlsx';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

export default function ProfitDashboard() {
  const [masterParts, setMasterParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetDashboardMargin, setTargetDashboardMargin] = useState(30);
  const [ratuDiscount, setRatuDiscount] = useState(12.5);
  const [gjDiscount, setGjDiscount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [marginRangeFilter, setMarginRangeFilter] = useState('ALL'); // ALL, LOSS, 0-10, 10-20, 20-30, 30-50, 50+
  const [fullDataset, setFullDataset] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const searchMaster = async () => {
      setIsLoading(true);
      if (searchTerm.length < 2) {
        // Updated limit to 20 as requested
        const { data } = await supabase.from('sparepart_master').select('*').limit(20);
        if (data) setMasterParts(data);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('sparepart_master')
        .select('*')
        .or(`part_name.ilike.%${searchTerm}%,part_number.ilike.%${searchTerm}%`)
        .limit(250); // Show up to 250 matches
      
      if (!error && data) setMasterParts(data);
      setIsLoading(false);
    };
    
    const tid = setTimeout(searchMaster, 400);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  useEffect(() => {
    const fetchFullDataForAnalysis = async () => {
        // Fetch all 11,000+ items using chunking to bypass Supabase 1000 limit
        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
            const { data, error } = await supabase
                .from('sparepart_master')
                .select('id, part_name, part_number, wholesale_price_no_tax, sales_guide_price_no_tax')
                .range(from, from + step - 1);
            
            if (error) {
                console.error("Fetch Error:", error);
                finished = true;
                break;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < step) {
                    finished = true;
                } else {
                    from += step;
                }
            } else {
                finished = true;
            }
        }
        
        if (allData.length > 0) {
            setFullDataset(allData);
            setIsDataLoaded(true);
        }
    };
    fetchFullDataForAnalysis();
  }, []);

  const totalFilteredCount = useMemo(() => {
    let list = fullDataset;

    // Filter by search
    if (searchTerm.length >= 2) {
        list = list.filter(p => 
            p.part_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Filter by margin
    if (marginRangeFilter === 'LOSS') {
        list = list.filter(part => {
            const base = part.wholesale_price_no_tax || 0;
            const guide = part.sales_guide_price_no_tax || 0;
            const priceRatu = guide * (1 - (ratuDiscount / 100));
            return (priceRatu - base) < 0;
        });
    } else if (marginRangeFilter !== 'ALL') {
        list = list.filter(part => {
            const base = part.wholesale_price_no_tax || 0;
            const guide = part.sales_guide_price_no_tax || 0;
            const pNoDiscount = guide - base;
            const m = base > 0 ? (pNoDiscount / base * 100) : 0;
            
            if (marginRangeFilter === '0-10') return m >= 0 && m < 10;
            if (marginRangeFilter === '10-20') return m >= 10 && m < 20;
            if (marginRangeFilter === '20-30') return m >= 20 && m < 30;
            if (marginRangeFilter === '30-50') return m >= 30 && m < 50;
            if (marginRangeFilter === '50+') return m >= 50;
            return true;
        });
    }

    return list.length;
  }, [fullDataset, marginRangeFilter, searchTerm, ratuDiscount]);

  const filteredItems = useMemo(() => {
    let result = masterParts;
    
    if (marginRangeFilter === 'LOSS') {
      result = result.filter(part => {
        const base = part.wholesale_price_no_tax || 0;
        const guide = part.sales_guide_price_no_tax || 0;
        const priceRatu = guide * (1 - (ratuDiscount / 100));
        return (priceRatu - base) < 0;
      });
    } else if (marginRangeFilter !== 'ALL') {
      result = result.filter(part => {
        const base = part.wholesale_price_no_tax || 0;
        const guide = part.sales_guide_price_no_tax || 0;
        const pNoDiscount = guide - base;
        const m = base > 0 ? (pNoDiscount / base * 100) : 0;
        
        if (marginRangeFilter === '0-10') return m >= 0 && m < 10;
        if (marginRangeFilter === '10-20') return m >= 10 && m < 20;
        if (marginRangeFilter === '20-30') return m >= 20 && m < 30;
        if (marginRangeFilter === '30-50') return m >= 30 && m < 50;
        if (marginRangeFilter === '50+') return m >= 50;
        return true;
      });
    }

    return result;
  }, [masterParts, marginRangeFilter, ratuDiscount]);

  const exportToExcel = async () => {
    if (!isDataLoaded) {
        Toastify({ text: "Data sedang disiapkan... Mohon coba lagi sesaat.", background: "orange" }).showToast();
        return;
    }

    Toastify({
        text: "🚀 Exporting Full Filtered Match...",
        duration: 2000,
        gravity: "top",
        position: "center",
        style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
    }).showToast();

    try {
        // Re-use full dataset for export to be 100% accurate across all 11,000 items
        let finalExportItems = fullDataset;

        // Apply Search
        if (searchTerm.length >= 2) {
            finalExportItems = finalExportItems.filter(p => 
                p.part_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply Filter
        if (marginRangeFilter === 'LOSS') {
            finalExportItems = finalExportItems.filter(part => {
                const base = part.wholesale_price_no_tax || 0;
                const guide = part.sales_guide_price_no_tax || 0;
                const priceRatu = guide * (1 - (ratuDiscount / 100));
                return (priceRatu - base) < 0;
            });
        } else if (marginRangeFilter !== 'ALL') {
            finalExportItems = finalExportItems.filter(part => {
                    const base = part.wholesale_price_no_tax || 0;
                    const guide = part.sales_guide_price_no_tax || 0;
                    const pNoDiscount = guide - base;
                    const m = base > 0 ? (pNoDiscount / base * 100) : 0;
                    
                    if (marginRangeFilter === '0-10') return m >= 0 && m < 10;
                    if (marginRangeFilter === '10-20') return m >= 10 && m < 20;
                    if (marginRangeFilter === '20-30') return m >= 20 && m < 30;
                    if (marginRangeFilter === '30-50') return m >= 30 && m < 50;
                    if (marginRangeFilter === '50+') return m >= 50;
                    return true;
            });
        }

        const dataToExport = finalExportItems.map(part => {
                const base = part.wholesale_price_no_tax || 0;
                const guide = part.sales_guide_price_no_tax || 0;
                const pNoDiscount = guide - base;
                const mNoDiscount = base > 0 ? (pNoDiscount / base * 100).toFixed(1) : 0;
                
                const priceRatu = guide * (1 - (ratuDiscount / 100));
                const pRatu = Math.round(priceRatu - base);
                const mRatu = base > 0 ? (pRatu / base * 100).toFixed(1) : 0;

                const priceGj = guide * (1 - (gjDiscount / 100));
                const pGj = Math.round(priceGj - base);
                const mGj = base > 0 ? (pGj / base * 100).toFixed(1) : 0;

                return {
                    "Part Name": part.part_name,
                    "Part Number": part.part_number,
                    "Guide Price": guide,
                    "COGS (Modal)": base,
                    "Margin No Disc %": mNoDiscount,
                    "RATU Price": priceRatu,
                    "RATU Profit": pRatu,
                    "RATU Margin %": mRatu,
                    "GJ Price": priceGj,
                    "GJ Profit": pGj,
                    "GJ Margin %": mGj,
                    "Status": pRatu < 0 ? "LOSS (RATU)" : "OK"
                };
            });

            if (dataToExport.length === 0) {
                Toastify({ text: "Tidak ada data untuk diexport!", background: "red" }).showToast();
                return;
            }

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Full Export Analysis");
            XLSX.writeFile(wb, `Profit_Full_Export_${marginRangeFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);

            Toastify({ text: `✅ Export Berhasil! (${dataToExport.length} items)`, background: "#10b981" }).showToast();
    } catch (err) {
        console.error(err);
        Toastify({ text: "Gagal Export Data!", background: "red" }).showToast();
    }
  };

  const totalLossItems = useMemo(() => {
    return masterParts.filter(part => {
      const base = part.wholesale_price_no_tax || 0;
      const guide = part.sales_guide_price_no_tax || 0;
      const discountedRatu = guide * (1 - (ratuDiscount / 100));
      return (discountedRatu - base) < 0;
    }).length;
  }, [masterParts]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-6 lg:p-12 font-sans antialiased text-zinc-900 pb-40">
      <div className="max-w-[1600px] mx-auto space-y-12 animate-in">
        
        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
          <div className="space-y-4">
            <h1 className="text-7xl font-black tracking-tighter italic uppercase leading-none text-zinc-950">PROFIT & LOSS<br /><span className="text-zinc-950/40">INTELLIGENCE</span></h1>
            <div className="flex items-center gap-4">
               <div className="h-2 w-16 bg-red-600 rounded-full"></div>
               <p className="text-zinc-950 font-black uppercase tracking-[0.4em] text-[11px]">Strategic Pricing Analyzer v2.0</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
                <div className="bg-white border-2 border-zinc-100 px-10 py-6 rounded-[2.5rem] shadow-xl text-center border-b-8 border-b-zinc-950">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">Catalog Explorer</p>
                    <p className="text-3xl font-black text-zinc-950 leading-none mt-2">{totalFilteredCount.toLocaleString()}</p>
                </div>
               <div className={`px-10 py-6 rounded-[2.5rem] shadow-xl text-center transition-all border-2 border-b-8 ${totalLossItems > 0 ? 'bg-red-50 border-red-200 text-red-600 border-b-red-600' : 'bg-white border-zinc-100 border-b-zinc-950'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 leading-none">Critical Losses</p>
                    <p className="text-3xl font-black leading-none mt-2">{totalLossItems}</p>
               </div>
          </div>
        </div>

        {/* Intelligence Slider & Strategy Panel */}
        <div className="bg-zinc-950 text-white p-12 rounded-[4rem] shadow-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-bl-full blur-3xl"></div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.5em] text-white/50">Strategic Simulation Hub</h3>
                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest">
                            <TrendingUp size={12} className="text-emerald-400" /> Active Profile: Manual
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block ml-1">Target Margin (%)</label>
                            <input 
                                type="number" 
                                value={targetDashboardMargin}
                                onChange={(e) => setTargetDashboardMargin(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white/5 border-2 border-white/10 p-5 rounded-3xl font-black text-2xl text-white outline-none focus:border-red-600 focus:bg-white/10 transition-all text-center"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block ml-1">Ratu Disc (%)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                value={ratuDiscount}
                                onChange={(e) => setRatuDiscount(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white/5 border-2 border-white/10 p-5 rounded-3xl font-black text-2xl text-white outline-none focus:border-red-600 focus:bg-white/10 transition-all text-center"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block ml-1">GJ/PAM Disc (%)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                value={gjDiscount}
                                onChange={(e) => setGjDiscount(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white/5 border-2 border-white/10 p-5 rounded-3xl font-black text-2xl text-white outline-none focus:border-red-600 focus:bg-white/10 transition-all text-center"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 py-4 px-8 bg-white/5 rounded-3xl border border-white/10 w-fit">
                        <AlertCircle size={18} className="text-red-500" />
                        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                            Simulating safe discounts to maintain <span className="text-white font-black">{targetDashboardMargin}%</span> profit margin.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 bg-zinc-950 p-4 rounded-[3.5rem] shadow-2xl">
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-4 no-scrollbar">
                        {[
                            { id: 'ALL', label: 'All Parts' },
                            { id: 'LOSS', label: 'Loss Only', icon: TrendingDown, color: 'text-red-500' },
                            { id: '0-10', label: '0-10%' },
                            { id: '10-20', label: '10-20%' },
                            { id: '20-30', label: '20-30%' },
                            { id: '30-50', label: '30-50%' },
                            { id: '50+', label: '> 50%' }
                        ].map(range => (
                            <button 
                                key={range.id}
                                onClick={() => setMarginRangeFilter(range.id)}
                                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    marginRangeFilter === range.id 
                                    ? 'bg-white text-zinc-950 shadow-xl scale-105' 
                                    : 'text-white/40 hover:text-white border border-white/5 hover:bg-white/5'
                                }`}
                            >
                                {range.icon && <range.icon size={14} className={range.color} />}
                                {range.label}
                            </button>
                        ))}
                    </div>

                    <div className="h-10 w-px bg-white/10 mx-2 hidden md:block"></div>

                    <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-emerald-500/20"
                    >
                        <Download size={18} /> Export Excel
                    </button>
                </div>
            </div>
            <div className="relative group">
                <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-red-600 transition-colors" size={28} />
                <input 
                    type="text"
                    placeholder="Search Catalogue Master (e.g. Brake Pad, Filter...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-[3rem] py-8 pl-20 pr-10 text-xl font-black focus:outline-none focus:border-red-600 focus:bg-white/10 transition-all placeholder:text-white/5 text-white"
                />
            </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white border-2 border-zinc-100 rounded-[3.5rem] shadow-2xl overflow-hidden">
            <div className="p-10 border-b-2 border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                <h3 className="font-black italic tracking-tighter text-3xl uppercase leading-none text-zinc-950">PRICING<br /><span className="text-zinc-950/40">MATRIX</span></h3>
                {isLoading && (
                    <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">
                        Syncing...
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-zinc-950 text-white border-b-4 border-red-600">
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em]">Part Identity</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-right bg-zinc-900/50">Guide Price</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-right">Modal (COGS)</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-center bg-zinc-900 border-x border-white/5">Profit (No Disc)</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-center bg-zinc-800">RATU ({ratuDiscount}%)</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-center bg-zinc-700">GJ/PAM ({gjDiscount}%)</th>
                            <th className="px-8 py-10 text-[11px] font-black uppercase tracking-[0.4em] text-center bg-blue-900 border-l-4 border-blue-400">Max Safe Disc (v {targetDashboardMargin}%)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-12 py-40 text-center">
                                    <p className="font-black text-xl uppercase tracking-[0.5em] text-zinc-200">No Parts Match Search</p>
                                </td>
                            </tr>
                        ) : filteredItems.slice(0, 150).map((part) => {
                            const base = part.wholesale_price_no_tax || 0;
                            const guide = part.sales_guide_price_no_tax || 0;
                            
                            const pNoDiscount = guide - base;
                            const mNoDiscount = base > 0 ? (pNoDiscount / base * 100).toFixed(1) : 0;

                            const priceRatu = guide * (1 - (ratuDiscount / 100));
                            const pRatu = Math.round(priceRatu - base);
                            const mRatu = base > 0 ? (pRatu / base * 100).toFixed(1) : 0;

                            const priceGj = guide * (1 - (gjDiscount / 100));
                            const pGj = Math.round(priceGj - base);
                            const mGj = base > 0 ? (pGj / base * 100).toFixed(1) : 0;
                            
                            // Recommened Max Discount Calculation
                            const minSellingPrice = base * (1 + targetDashboardMargin / 100);
                            const rawSafeDiscount = guide > 0 ? ((guide - minSellingPrice) / guide) * 100 : 0;
                            const maxSafeDiscount = Math.max(0, rawSafeDiscount).toFixed(1);

                            return (
                                <tr key={part.id} className="hover:bg-zinc-50 transition-all group text-sm border-b border-zinc-100">
                                    <td className="px-8 py-12">
                                        <div className="font-black text-2xl tracking-tighter uppercase leading-none mb-3 text-zinc-950 group-hover:text-red-600 transition-colors">{part.part_name}</div>
                                        <div className="font-mono text-lg text-zinc-950 font-black uppercase tracking-widest bg-zinc-100 w-fit px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">{part.part_number}</div>
                                    </td>
                                    <td className="px-8 py-12 text-right font-black text-xl text-zinc-950 bg-zinc-50/20">
                                        Rp {guide.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-12 text-right font-black text-xl text-zinc-950 border-x border-zinc-50 overflow-hidden relative">
                                        <div className="absolute right-0 top-0 text-[60px] font-black opacity-[0.03] select-none pointer-events-none -mr-4 -mt-4">COGS</div>
                                        Rp {base.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-12 text-center bg-zinc-50/30 border-r border-zinc-100 min-w-[200px]">
                                        <div className={`font-black text-2xl tracking-tighter ${pNoDiscount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Rp {pNoDiscount.toLocaleString()}</div>
                                        <div className={`text-sm font-black mt-1 ${pNoDiscount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{mNoDiscount}% Margin</div>
                                    </td>
                                    <td className={`px-8 py-12 text-center font-black border-r border-zinc-100 ${pRatu < 0 ? 'bg-red-50 text-red-700' : 'bg-white text-zinc-950'}`}>
                                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Sell: Rp {priceRatu.toLocaleString()}</div>
                                        <div className="text-2xl tracking-tighter">Rp {pRatu.toLocaleString()}</div>
                                        <div className={`text-xs font-black mt-2 inline-block px-3 py-1 rounded-lg ${pRatu < 0 ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-700'}`}>Profit: {mRatu}%</div>
                                    </td>
                                    <td className={`px-8 py-12 text-center font-black ${pGj < 0 ? 'bg-red-50 text-red-700' : 'bg-zinc-50/40 text-zinc-950'}`}>
                                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Sell: Rp {priceGj.toLocaleString()}</div>
                                        <div className="text-2xl tracking-tighter">Rp {pGj.toLocaleString()}</div>
                                        <div className={`text-xs font-black mt-2 inline-block px-3 py-1 rounded-lg ${pGj < 0 ? 'bg-red-600 text-white' : 'bg-indigo-100 text-indigo-700'}`}>Profit: {mGj}%</div>
                                    </td>
                                    <td className={`px-8 py-12 text-center font-black tracking-tighter relative overflow-hidden ${rawSafeDiscount <= 0 ? 'bg-red-50 text-red-700 border-l-4 border-red-200' : 'bg-blue-50/40 text-blue-700 border-l-4 border-blue-200'}`}>
                                        <div className="flex flex-col items-center justify-center relative z-10">
                                            <div className="text-4xl font-black leading-none mb-2">{maxSafeDiscount}%</div>
                                            <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-4 items-center gap-1 flex"><Zap size={10} className="text-amber-500" /> Max Safe Discount</div>
                                            
                                            <div className="space-y-2 w-full">
                                                {pRatu < 0 || mRatu < targetDashboardMargin ? (
                                                    <div className="px-4 py-2 bg-red-600 text-[9px] text-white rounded-xl uppercase font-black animate-pulse text-center shadow-lg shadow-red-200">
                                                        - { (ratuDiscount - Math.max(0, rawSafeDiscount)).toFixed(1) }% RATU
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 bg-emerald-500 text-[9px] text-white rounded-xl uppercase font-black text-center">
                                                        RATU SAFE
                                                    </div>
                                                )}
                                                
                                                {pGj < 0 || mGj < targetDashboardMargin ? (
                                                    <div className="px-4 py-2 bg-zinc-900 text-[9px] text-white rounded-xl uppercase font-black text-center">
                                                        - { (gjDiscount - Math.max(0, rawSafeDiscount)).toFixed(1) }% GJ/PAM
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 bg-zinc-200 text-[9px] text-zinc-500 rounded-xl uppercase font-black text-center">
                                                        GJ/PAM SAFE
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filteredItems.length > 150 && (
                <div className="p-10 text-center bg-zinc-50 border-t border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Showing first 150 results. Please filter more.</p>
                </div>
            )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes in { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-in { animation: in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
