import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Layers, ArrowLeft, ChevronRight, Hash, Tag, Info } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Toastify from 'toastify-js';

const SparepartGrouping = ({ onBack }) => {
    const [masterParts, setMasterParts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);

    useEffect(() => {
        fetchMasterParts();
    }, []);

    const fetchMasterParts = async () => {
        setIsLoading(true);
        try {
            // Fetch everything from master
            const { data, error } = await supabase
                .from('sparepart_master')
                .select('*');
            
            if (error) throw error;
            setMasterParts(data || []);
        } catch (e) {
            console.error("Error fetching master parts:", e);
            Toastify({ text: "Gagal mengambil data master sparepart", background: "red" }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    // Logical Grouping
    const categorizedParts = useMemo(() => {
        const groups = {};
        
        // Define priority keywords for grouping
        const primaryKeywords = [
            { key: 'HEADLAMP', group: 'HEADLAMP' },
            { key: 'BATTERY', group: 'BATTERY' },
            { key: 'FILTER', group: 'FILTER' },
            { key: 'BRAKE', group: 'BRAKE' },
            { key: 'PAD', group: 'BRAKE' },
            { key: 'OIL', group: 'OIL' },
            { key: 'TIRE', group: 'TIRE' },
            { key: 'WIPER', group: 'WIPER' },
            { key: 'BUMPER', group: 'BODY' },
            { key: 'GRILLE', group: 'BODY' },
            { key: 'MIRROR', group: 'BODY' },
            { key: 'RADIATOR', group: 'COOLING' },
            { key: 'PLUG', group: 'ELECTRICAL' },
            { key: 'FUSE', group: 'ELECTRICAL' }
        ];

        masterParts.forEach(part => {
            const name = (part.part_name || '').toUpperCase();
            
            // Check against primary keywords first
            let matchedGroup = null;
            for (const item of primaryKeywords) {
                if (name.includes(item.key)) {
                    matchedGroup = item.group;
                    break;
                }
            }

            // Fallback to first word if no keyword matches
            const category = matchedGroup || name.split(' ')[0] || 'LAIN-LAIN';
            
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(part);
        });

        // Convert to array and sort by category name
        return Object.keys(groups)
            .sort()
            .map(cat => ({
                name: cat,
                count: groups[cat].length,
                items: groups[cat]
            }));
    }, [masterParts]);

    const filteredCategories = useMemo(() => {
        if (!searchTerm) return categorizedParts;
        
        const term = searchTerm.toLowerCase();
        return categorizedParts.filter(cat => 
            cat.name.toLowerCase().includes(term) || 
            cat.items.some(item => 
                (item.part_name || '').toLowerCase().includes(term) || 
                (item.part_number || '').toLowerCase().includes(term)
            )
        ).map(cat => {
            // If the category itself doesn't match but items do, filter the items
            if (!cat.name.toLowerCase().includes(term)) {
                const matchedItems = cat.items.filter(item => 
                    (item.part_name || '').toLowerCase().includes(term) || 
                    (item.part_number || '').toLowerCase().includes(term)
                );
                return { ...cat, items: matchedItems, count: matchedItems.length };
            }
            return cat;
        });
    }, [categorizedParts, searchTerm]);

    const formatIDR = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans pb-20">
            {/* Premium Header */}
            <div className="bg-white border-b border-zinc-200 sticky top-0 z-40 px-6 py-6 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-zinc-900"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase italic flex items-center gap-2">
                                Kategori <span className="text-blue-600">Sparepart</span>
                                <Layers className="text-zinc-300" size={24} />
                            </h1>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
                                {masterParts.length} Total Master Data • {categorizedParts.length} Categories
                            </p>
                        </div>
                    </div>

                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Cari sparepart atau kategori..."
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-10">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-black uppercase tracking-widest text-zinc-400 text-xs animate-pulse">Mengategorikan Data...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCategories.length > 0 ? (
                            filteredCategories.map((cat) => (
                                <div 
                                    key={cat.name}
                                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                    className={`group relative bg-white border rounded-[2.5rem] p-8 transition-all duration-500 cursor-pointer overflow-hidden
                                        ${selectedCategory === cat.name 
                                            ? 'ring-4 ring-blue-500/10 border-blue-500 shadow-2xl scale-[1.02]' 
                                            : 'border-zinc-100 hover:border-zinc-300 hover:shadow-xl hover:-translate-y-2'
                                        }`}
                                >
                                    {/* Decor */}
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-zinc-50 rounded-full group-hover:bg-blue-50/50 transition-colors duration-500 -z-0"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="p-4 bg-zinc-900 rounded-3xl text-white shadow-lg group-hover:bg-blue-600 transition-colors duration-500">
                                                <Package size={24} />
                                            </div>
                                            <span className="bg-zinc-100 text-zinc-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                {cat.count} Items
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-black uppercase tracking-tight mb-2 group-hover:text-blue-600 transition-colors">
                                            {cat.name}
                                        </h3>
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest line-clamp-1 mb-6">
                                            {cat.items[0]?.part_name || 'No Description'}
                                        </p>

                                        <div className="flex items-center justify-between pt-6 border-t border-zinc-50">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">View Details</span>
                                            <ChevronRight className={`text-zinc-300 transition-transform duration-500 ${selectedCategory === cat.name ? 'rotate-90 text-blue-500' : 'group-hover:translate-x-1 group-hover:text-zinc-600'}`} size={20} />
                                        </div>
                                    </div>

                                    {/* Accordion Content */}
                                    <div className={`overflow-hidden transition-all duration-700 ease-in-out ${selectedCategory === cat.name ? 'max-h-[500px] mt-8 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="space-y-4 pr-2 max-h-[400px] overflow-y-auto no-scrollbar pt-2">
                                            {cat.items.map((item, idx) => (
                                                <div key={idx} className="bg-zinc-50 rounded-2xl p-4 border border-transparent hover:border-blue-200 transition-all hover:bg-white group/item">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Hash size={14} className="text-blue-500" />
                                                        <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">{item.part_number}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-zinc-800 uppercase leading-tight group-hover/item:text-blue-600 transition-colors">
                                                        {item.part_name}
                                                    </p>
                                                    <div className="mt-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Tag size={12} className="text-emerald-500" />
                                                            <span className="text-[10px] font-bold text-emerald-600">{formatIDR(item.sales_guide_price || 0)}</span>
                                                        </div>
                                                        <Info size={12} className="text-zinc-300 hover:text-blue-500 cursor-pointer" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center">
                                <Package className="mx-auto text-zinc-200 mb-4" size={64} />
                                <h3 className="text-xl font-black uppercase tracking-tight text-zinc-400">Tidak ada hasil</h3>
                                <p className="text-sm font-bold text-zinc-300 uppercase tracking-widest mt-2">Coba kata kunci lain</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default SparepartGrouping;
