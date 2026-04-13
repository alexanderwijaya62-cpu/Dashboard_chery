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
  ArrowRight
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'builder', label: 'Quotation Builder', icon: Calculator },
    { id: 'invoice', label: 'Invoice Preview', icon: FileText },
    { id: 'analysis', label: 'Quotation Analysis', icon: BarChart3 },
    { id: 'inventory_analysis', label: 'Inventory Profit', icon: TrendingUp },
  ];

  return (
    <nav className="flex gap-2 bg-zinc-950 p-2 rounded-[2rem] border border-white/10 shadow-2xl mb-12 w-fit mx-auto sticky top-4 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] transition-all duration-500 font-black text-[10px] uppercase tracking-widest ${
              activeTab === tab.id 
              ? 'bg-white text-zinc-950 shadow-[0_10px_20px_rgba(255,255,255,0.1)]' 
              : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={14} strokeWidth={3} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};

export default function QuotationSPA() {
  const [activeTab, setActiveTab] = useState('builder');
  const [customerPreset, setCustomerPreset] = useState('RATU'); // RATU, GJ, CUSTOM
  const [customMarkup, setCustomMarkup] = useState(15);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [masterParts, setMasterParts] = useState([]);
  const [invoiceMetadata, setInvoiceMetadata] = useState({
    no: `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    customer: '',
    date: new Date().toLocaleDateString('id-ID'),
  });

  // --- Fetch Search Results (Server Side for 11,000+ items) ---
  useEffect(() => {
    const searchDatabase = async () => {
      if (searchTerm.length < 2) {
        // Option: keep the top 100 as default view
        const { data } = await supabase.from('sparepart_master').select('*').limit(100);
        if (data) setMasterParts(data);
        return;
      }

      const { data, error } = await supabase
        .from('sparepart_master')
        .select('*')
        .or(`part_name.ilike.%${searchTerm}%,part_number.ilike.%${searchTerm}%`)
        .limit(150);

      if (!error && data) {
        setMasterParts(data);
      }
    };

    const timeoutId = setTimeout(searchDatabase, 400); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // --- Logic ---
  
  const currentMarkup = useMemo(() => {
    if (customerPreset === 'RATU') return 12.5;
    if (customerPreset === 'GJ') return 10;
    return customMarkup;
  }, [customerPreset, customMarkup]);

  const handleAddItem = (part) => {
    const existing = items.find(i => i.part_number === part.part_number);
    if (existing) {
      setItems(items.map(i => i.part_number === part.part_number ? { ...i, qty: (i.qty || 1) + 1 } : i));
    } else {
      setItems([...items, { ...part, qty: 1, discount: 0 }]);
    }
    setSearchTerm('');
  };

  const removeItem = (part_number) => {
    setItems(items.filter(i => i.part_number !== part_number));
  };

  const updateItem = (part_number, field, value) => {
    setItems(items.map(i => i.part_number === part_number ? { ...i, [field]: value } : i));
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const sellingPrice = (item.wholesale_price_no_tax || 0) * (1 + currentMarkup / 100);
      const totalItem = (sellingPrice - (item.discount || 0)) * (item.qty || 1);
      return acc + totalItem;
    }, 0);
    const ppn = subtotal * 0.11;
    const grandTotal = subtotal + ppn;
    return { subtotal, ppn, grandTotal };
  }, [items, currentMarkup]);

  const filteredSearch = useMemo(() => {
    if (!searchTerm) return [];
    return masterParts.filter(p => 
      (p.part_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.part_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 8);
  }, [searchTerm, masterParts]);

  return (
    <div className="w-full h-full text-[#1a1a1a] font-sans antialiased selection:bg-zinc-200 p-10 overflow-y-auto no-scrollbar">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div className="space-y-4">
            <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none">QUOTATION<br/><span className="text-zinc-300">SYSTEM</span></h1>
            <div className="flex items-center gap-3">
               <div className="h-2 w-12 bg-blue-600 rounded-full"></div>
               <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px]">Premium Sales Interface</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Select Customer Tier</label>
            <div className="flex bg-white p-2 rounded-3xl border border-zinc-100 shadow-xl">
                {['RATU', 'GJ', 'CUSTOM'].map(p => (
                <button
                    key={p}
                    onClick={() => setCustomerPreset(p)}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all ${
                    customerPreset === p ? 'bg-zinc-950 text-white shadow-2xl' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'
                    }`}
                >
                    {p === 'GJ' ? 'GJ / PAM' : p}
                </button>
                ))}
            </div>
          </div>
        </div>

        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* PAGE 1: BUILDER */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in">
            <div className="lg:col-span-8 space-y-10">
              
              {/* Search Section */}
              <div className="space-y-4">
                 <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Search Master Database</label>
                 <div className="relative group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                    <Search size={24} className="text-zinc-950 transition-colors" />
                    </div>
                    <input
                    type="text"
                    placeholder="Type part name or number to add..."
                    className="w-full bg-white border-2 border-zinc-100 rounded-[2rem] py-6 pl-16 pr-8 text-lg font-bold focus:outline-none focus:ring-8 focus:ring-zinc-50 focus:border-zinc-950 transition-all shadow-xl placeholder:text-zinc-950/40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    
                    {searchTerm && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-white border border-zinc-100 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] z-[100] overflow-hidden divide-y divide-zinc-50 animate-in">
                        {filteredSearch.length === 0 ? (
                             <div className="p-10 text-center font-black text-zinc-300 uppercase tracking-widest text-xs italic">Part Not Found</div>
                        ) : filteredSearch.map(part => (
                        <button
                            key={part.part_number}
                            onClick={() => handleAddItem(part)}
                            className="w-full px-10 py-6 text-left hover:bg-zinc-50 flex items-center justify-between transition-colors group"
                        >
                            <div className="flex items-center gap-6">
                            <div className="bg-zinc-100 p-4 rounded-2xl group-hover:bg-zinc-200 transition-colors">
                                <Package size={24} className="text-zinc-600" />
                            </div>
                            <div>
                                <div className="font-black text-lg tracking-tight uppercase">{part.part_name}</div>
                                <div className="text-zinc-400 text-xs font-mono uppercase tracking-widest">{part.part_number}</div>
                            </div>
                            </div>
                            <div className="text-right">
                            <div className="text-sm font-black text-zinc-950">
                                Rp {(part.wholesale_price_no_tax || 0).toLocaleString()}
                            </div>
                            <div className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mt-1">Wholesale (Net)</div>
                            </div>
                        </button>
                        ))}
                    </div>
                    )}
                </div>
              </div>

              {/* Items List - Modern Cards Instead of Table */}
              <div className="space-y-6">
                  <div className="flex justify-between items-center px-2">
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400">Cart Items ({items.length})</h3>
                  </div>
                  
                  {items.length === 0 ? (
                      <div className="bg-zinc-50 border-2 border-dashed border-zinc-100 rounded-[3rem] py-32 flex flex-col items-center gap-6">
                          <div className="p-8 bg-white rounded-full shadow-inner">
                             <TrendingUp size={48} className="text-zinc-200" />
                          </div>
                          <p className="font-black text-zinc-300 uppercase tracking-widest text-xs">Awaiting Entry</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                        {items.map((item) => {
                            const sellingPrice = (item.wholesale_price_no_tax || 0) * (1 + currentMarkup / 100);
                            const totalItem = (sellingPrice - (item.discount || 0)) * (item.qty || 1);
                            return (
                                <div key={item.part_number} className="bg-white border border-zinc-100 rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl transition-all group flex flex-col md:flex-row items-center gap-8">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-xl tracking-tight leading-none mb-2 uppercase">{item.part_name}</div>
                                        <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.2em]">{item.part_number}</div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Base: Rp {item.wholesale_price_no_tax?.toLocaleString()}</span>
                                            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Price: Rp {sellingPrice.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-8 bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100">
                                        <div className="w-24 text-center">
                                            <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Quantity</label>
                                            <input 
                                                type="number" 
                                                value={item.qty}
                                                onChange={(e) => updateItem(item.part_number, 'qty', Math.max(1, parseInt(e.target.value) || 0))}
                                                className="w-full bg-transparent border-b-2 border-zinc-200 text-center font-black text-xl focus:border-zinc-950 transition-all outline-none"
                                            />
                                        </div>
                                        <div className="w-32 text-center border-l border-zinc-200 pl-8">
                                            <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Discount Unit</label>
                                            <input 
                                                type="number" 
                                                value={item.discount}
                                                onChange={(e) => updateItem(item.part_number, 'discount', Math.max(0, parseInt(e.target.value) || 0))}
                                                className="w-full bg-transparent border-b-2 border-zinc-200 text-right font-black text-lg focus:border-zinc-950 transition-all outline-none font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-right min-w-[150px]">
                                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Line Total</div>
                                        <div className="font-black text-2xl tracking-tighter">Rp {totalItem.toLocaleString()}</div>
                                        <button 
                                            onClick={() => removeItem(item.part_number)}
                                            className="mt-2 text-red-500 font-bold text-[10px] uppercase tracking-widest hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            Remove Item
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                      </div>
                  )}
              </div>
            </div>

            {/* Totalizer Section */}
            <div className="lg:col-span-4 space-y-8 sticky top-32 h-fit">
              <div className="bg-zinc-950 text-white p-12 rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.3)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-bl-full -z-0"></div>
                
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-12 flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> Checkpoint Summary
                </h3>

                <div className="space-y-10 relative z-10">
                  <div className="grid grid-cols-2 gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
                    <div>
                      <p className="text-[9px] uppercase font-black text-zinc-600 tracking-widest mb-2">Category</p>
                      <p className="font-black text-lg tracking-tight uppercase">{customerPreset === 'GJ' ? 'GJ / PAM' : customerPreset}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-black text-zinc-600 tracking-widest mb-2">Applied Markup</p>
                      <p className="font-black text-3xl tracking-tighter text-emerald-400">+{currentMarkup}%</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6">
                    <div className="flex justify-between items-center text-zinc-500">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Subtotal Net</p>
                      <p className="font-mono font-bold text-lg">Rp {totals.subtotal.toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">PPN 11% (Calculated)</p>
                      <p className="font-mono font-bold">Rp {totals.ppn.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-10 border-t border-white/10 mt-6">
                    <p className="text-blue-500 text-[11px] font-black uppercase tracking-[0.5em] mb-4">Total Amount Due</p>
                    <p className="text-5xl font-black tracking-tighter tabular-nums leading-none">
                      <span className="text-lg font-bold text-zinc-700 mr-2 tracking-tight">Rp</span>
                      {totals.grandTotal.toLocaleString()}
                    </p>
                  </div>

                  <div className="pt-12 space-y-4">
                    <button 
                      disabled={items.length === 0}
                      onClick={() => setActiveTab('invoice')}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-900 disabled:text-zinc-800 disabled:border-zinc-800 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                    >
                      <FileText size={18} strokeWidth={3} /> Preview Official Invoice
                    </button>
                    <button 
                      disabled={items.length === 0}
                      className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-3 border border-white/10"
                    >
                      <Download size={18} strokeWidth={3} /> Export Metadata
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-500/10 border-2 border-emerald-500/20 p-8 rounded-[2.5rem] flex items-start gap-6">
                <AlertCircle className="text-emerald-500 shrink-0" size={32} />
                <div>
                  <h4 className="font-black text-emerald-950 text-sm mb-2 uppercase tracking-widest">Tax System Notice</h4>
                  <p className="text-emerald-900/60 text-[11px] font-bold leading-relaxed uppercase tracking-tight">
                    PPN 11% is automatically added to the grand total in compliance with national trade regulations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 2: INVOICE */}
        {activeTab === 'invoice' && (
          <div className="animate-in pb-40">
            <div className="bg-white border-2 border-zinc-100 rounded-[3.5rem] shadow-2xl p-20 max-w-5xl mx-auto min-h-[1100px] flex flex-col relative overflow-hidden">
              {/* Branding Header */}
              <div className="flex justify-between items-start mb-24">
                <div className="space-y-6">
                    <div className="bg-zinc-950 text-white px-6 py-3 rounded-2xl w-fit font-black italic tracking-tighter text-2xl uppercase">CHERY ORIENTAL</div>
                    <div className="space-y-2 pl-1">
                        <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em]">Official Workshop Affiliate</p>
                        <p className="text-xs text-zinc-500 font-bold">Jl. Raya Surabaya-Malang No. 123, Surabaya</p>
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">+62 821-3322-1111 • chery-oriental.id</p>
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="text-7xl font-black text-zinc-900/5 tracking-tighter -mt-6 mb-4 select-none">OFFICIAL QUOTE</h3>
                    <div className="space-y-6 pt-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ref. Number</p>
                            <p className="text-xl font-black tracking-tighter uppercase">{invoiceMetadata.no}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date Issued</p>
                            <p className="text-sm font-black uppercase tracking-widest text-zinc-400">{invoiceMetadata.date}</p>
                        </div>
                    </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex justify-between gap-12 mb-20 border-y-2 border-zinc-950 py-16">
                <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">Billed To / Recipient</p>
                    <input 
                        className="text-3xl font-black tracking-tight uppercase leading-none mb-4 border-b-2 border-zinc-100 focus:border-zinc-950 transition-all outline-none w-full bg-transparent"
                        placeholder="ENTER RECIPIENT NAME..."
                        value={invoiceMetadata.customer}
                        onChange={(e) => setInvoiceMetadata({...invoiceMetadata, customer: e.target.value})}
                    />
                    <div className="flex items-center gap-4">
                        <span className="bg-zinc-100 px-4 py-1.5 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tier: {customerPreset}</span>
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Status: active</span>
                    </div>
                </div>
                <div className="text-right min-w-[200px]">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">Projected Validity</p>
                    <p className="text-2xl font-black tracking-tighter uppercase">14 CALENDAR DAYS</p>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 animate-pulse">Subject to stock availability</p>
                </div>
              </div>

              {/* Invoice Table */}
              <div className="flex-1 mb-24">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-4 border-zinc-900">
                            <th className="py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 pr-4">#</th>
                            <th className="py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900">Catalogue Part Identity</th>
                            <th className="py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 text-center w-24">Qty</th>
                            <th className="py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 text-right w-52">Unit Rate</th>
                            <th className="py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 text-right w-52">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {items.map((item, index) => {
                            const unitPrice = (item.wholesale_price_no_tax || 0) * (1 + currentMarkup / 100) - (item.discount || 0);
                            const total = unitPrice * item.qty;
                            return (
                                <tr key={item.part_number} className="group">
                                    <td className="py-8 text-sm font-black text-zinc-200 group-hover:text-zinc-400 transition-colors">{String(index + 1).padStart(2, '0')}</td>
                                    <td className="py-8">
                                        <div className="font-black text-lg tracking-tight leading-none mb-2 uppercase">{item.part_name}</div>
                                        <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">{item.part_number}</div>
                                    </td>
                                    <td className="py-8 text-center font-black text-base tracking-tight">{item.qty} <span className="text-[9px] text-zinc-400 ml-1">PCS</span></td>
                                    <td className="py-8 text-right font-black text-base tracking-tight">Rp {unitPrice.toLocaleString()}</td>
                                    <td className="py-8 text-right font-black text-xl tracking-tighter">Rp {total.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
              </div>

              {/* Footer Summary */}
              <div className="mt-auto pt-16 border-t-2 border-zinc-100 flex justify-between gap-24">
                <div className="flex-1 space-y-12">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">Terms & Conditions</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase leading-loose tracking-tight italic">
                            1. Prices are valid for 14 days from issued date.<br/>
                            2. 50% deposit required for special order parts.<br/>
                            3. Returns only accepted in original packaging within 3 days.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-10">
                         <div>
                            <p className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.5em] mb-12">Authorized By</p>
                            <div className="w-full h-px bg-zinc-950 mb-4"></div>
                            <p className="text-[10px] font-black text-zinc-950 uppercase tracking-widest text-center">Service Manager</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.5em] mb-12">Order Approval</p>
                            <div className="w-full h-px bg-zinc-950 mb-4"></div>
                            <p className="text-[10px] font-black text-zinc-950 uppercase tracking-widest text-center">Customer Sign</p>
                         </div>
                    </div>
                </div>
                <div className="w-2/5 space-y-6 bg-zinc-50 p-10 rounded-[3rem] border border-zinc-100">
                    <div className="flex justify-between items-center text-zinc-500">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Total Bruto (Excl. Tax)</p>
                        <p className="font-black text-base">Rp {totals.subtotal.toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Computed Tax (VAT 11%)</p>
                        <p className="font-bold text-base">Rp {totals.ppn.toLocaleString()}</p>
                    </div>
                    <div className="pt-8 border-t-4 border-zinc-950 mt-6">
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-blue-600 mb-4">Final Amount Payable</p>
                        <p className="text-5xl font-black tracking-tighter leading-none">
                            <span className="text-xl font-bold text-zinc-300 mr-2 tracking-tight">Rp</span>
                            {totals.grandTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-4 h-full bg-zinc-950"></div>
            </div>
            
            <div className="flex justify-center mt-12 gap-6 no-print">
                <button 
                  onClick={() => window.print()}
                  className="bg-zinc-950 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] flex items-center gap-3 shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all"
                >
                    <Printer size={20} strokeWidth={3} /> Print Official Copy
                </button>
                <button 
                  onClick={() => setActiveTab('builder')}
                  className="bg-white border-2 border-zinc-100 text-zinc-400 px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] flex items-center gap-3 hover:text-zinc-950 hover:border-zinc-950 transition-all hover:shadow-xl"
                >
                    Back to Design
                </button>
            </div>
          </div>
        )}

        {/* PAGE 3: ANALYSIS */}
        {activeTab === 'analysis' && (
          <div className="animate-in space-y-12 pb-40">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="bg-white border-2 border-zinc-100 p-12 rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                    <TrendingUp className="text-emerald-500 mb-8 group-hover:scale-125 transition-transform" size={40} strokeWidth={3} />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-2">Quoted Profit Margin</p>
                    <h4 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">
                        <span className="text-xl text-zinc-300 font-bold mr-2">Rp</span>
                        {items.reduce((acc, item) => acc + (item.wholesale_price_no_tax * (currentMarkup / 100)) * item.qty, 0).toLocaleString()}
                    </h4>
                    <div className="absolute bottom-0 right-0 p-4 opacity-5">
                       <BarChart3 size={100} strokeWidth={3} />
                    </div>
                </div>
                <div className="bg-white border-2 border-zinc-100 p-12 rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all group">
                    <Percent className="text-blue-500 mb-8 group-hover:scale-125 transition-transform" size={40} strokeWidth={3} />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-2">Effective Yield</p>
                    <h4 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">{currentMarkup.toFixed(1)}<span className="text-2xl text-zinc-300 ml-1">%</span></h4>
                </div>
                <div className="bg-zinc-950 text-white p-12 rounded-[3.5rem] shadow-2xl group">
                    <Package className="text-blue-500 mb-8 group-hover:scale-125 transition-transform" size={40} strokeWidth={3} />
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2">Catalogue Coverage</p>
                    <h4 className="text-5xl font-black tracking-tighter leading-none">{items.length}<span className="text-2xl text-zinc-600 ml-2">SKU</span></h4>
                </div>
            </div>

            {/* Analysis Table */}
            <div className="bg-white border-2 border-zinc-100 rounded-[3.5rem] shadow-2xl overflow-hidden">
                <div className="p-10 border-b-2 border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                    <h3 className="font-black italic tracking-tighter text-3xl uppercase leading-none">PROFIT<br/><span className="text-zinc-300">METRICS</span></h3>
                    <div className="bg-zinc-950 text-white px-8 py-4 rounded-[1.5rem] shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
                        <ArrowRight size={14} strokeWidth={3} /> Target: {customerPreset} Tier
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/50">
                                <th className="px-12 py-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Part Identification</th>
                                <th className="px-12 py-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 text-right">COGS (Base)</th>
                                <th className="px-12 py-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 text-right">Revenue (Unit)</th>
                                <th className="px-12 py-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 text-right">Yield/Unit</th>
                                <th className="px-12 py-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 text-right">Rating</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-12 py-40 text-center text-zinc-200 font-black uppercase tracking-[0.3em] italic">
                                        No Data To Analyze
                                    </td>
                                </tr>
                            ) : items.map((item) => {
                                const sellingPrice = (item.wholesale_price_no_tax || 0) * (1 + currentMarkup / 100);
                                const profitPerUnit = sellingPrice - (item.wholesale_price_no_tax || 0);
                                const marginPercent = (profitPerUnit / sellingPrice) * 100;
                                
                                return (
                                    <tr key={item.part_number} className="hover:bg-zinc-50 transition-colors group">
                                        <td className="px-12 py-10">
                                            <div className="font-black text-xl tracking-tight uppercase group-hover:text-blue-600 transition-colors leading-none mb-2">{item.part_name}</div>
                                            <div className="font-mono text-[10px] text-zinc-300 uppercase tracking-widest">{item.part_number}</div>
                                        </td>
                                        <td className="px-12 py-10 text-right font-black text-xs font-mono text-zinc-400">
                                            Rp {item.wholesale_price_no_tax?.toLocaleString()}
                                        </td>
                                        <td className="px-12 py-10 text-right font-black text-lg tracking-tight">
                                            Rp {sellingPrice.toLocaleString()}
                                        </td>
                                        <td className="px-12 py-10 text-right">
                                            <div className="font-black text-lg tracking-tighter text-zinc-950">
                                                +Rp {profitPerUnit.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-12 py-10 text-right">
                                            <div className="inline-flex items-center gap-3 bg-emerald-50 px-6 py-2 rounded-full text-emerald-700 text-[10px] font-black tracking-widest uppercase border border-emerald-100">
                                                {marginPercent.toFixed(1)}% Yield
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}

        {/* PAGE 4: INVENTORY PROFIT ANALYSIS (Dedicated Dashboard) */}
        {activeTab === 'inventory_analysis' && (
          <div className="animate-in space-y-12 pb-40">
            {/* Real-time Intel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-2 bg-white border-2 border-zinc-100 p-10 rounded-[3rem] shadow-xl">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1 mb-6 block">Target Margin Simulator</label>
                    <div className="flex items-center gap-10">
                        <div className="flex-1 bg-zinc-50 p-2 rounded-[2rem] border border-zinc-100 flex items-center">
                            <input 
                                type="range" 
                                min="-20" 
                                max="100" 
                                step="1"
                                value={customMarkup}
                                onChange={(e) => setCustomMarkup(parseFloat(e.target.value))}
                                className="flex-1 h-3 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-950 mx-6"
                            />
                        </div>
                        <div className={`px-10 py-5 rounded-[2rem] font-black text-4xl tracking-tighter shadow-2xl ${customMarkup < 0 ? 'bg-red-600 text-white' : 'bg-zinc-950 text-white'}`}>
                            {customMarkup}%
                        </div>
                    </div>
                    <p className="mt-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic">{customMarkup < 0 ? '⚠️ Warning: Selling Below COGS' : 'Simulating projected profit across active catalog'}</p>
                </div>

                <div className="bg-zinc-50 border-2 border-zinc-100 p-10 rounded-[3rem] flex flex-col justify-between">
                    <TrendingUp size={32} className="text-zinc-300" />
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Catalog Count</p>
                        <h4 className="text-4xl font-black tracking-tighter">{masterParts.length}</h4>
                    </div>
                </div>

                <div className={`p-10 rounded-[3rem] flex flex-col justify-between border-2 transition-all ${
                    masterParts.some(p => (p.wholesale_price_no_tax * (customMarkup/100)) < 0) 
                    ? 'bg-red-50 border-red-200 shadow-xl shadow-red-100' 
                    : 'bg-emerald-50 border-emerald-100'
                }`}>
                    <AlertCircle size={32} className={customMarkup < 0 ? 'text-red-500' : 'text-emerald-500'} />
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${customMarkup < 0 ? 'text-red-400' : 'text-emerald-400'}`}>Loss Items</p>
                        <h4 className={`text-4xl font-black tracking-tighter ${customMarkup < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {customMarkup < 0 ? masterParts.length : 0}
                        </h4>
                    </div>
                </div>
            </div>

            {/* Matrix Section */}
            <div className="bg-white border-2 border-zinc-100 rounded-[3.5rem] shadow-2xl overflow-hidden">
                <div className="p-12 border-b-2 border-zinc-100 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div>
                        <h3 className="font-black italic tracking-tighter text-4xl uppercase leading-none">PROFIT & LOSS<br/><span className="text-zinc-950/40">MASTER MATRIX</span></h3>
                    </div>
                    <div className="relative w-full lg:w-96">
                       <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-950" size={24} />
                       <input 
                          type="text" 
                          placeholder="Search identifier..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-[2rem] pl-16 pr-8 py-5 text-lg font-bold focus:outline-none focus:ring-8 focus:ring-zinc-50 focus:border-zinc-950 transition-all placeholder:text-zinc-950/40"
                       />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-950 text-white">
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em]">Part Identity</th>
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em] text-right">COGS (Net)</th>
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em] text-center bg-zinc-900 border-x border-white/5">Profit (No Disc)</th>
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em] text-center bg-zinc-800">Profit RATU</th>
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em] text-center bg-zinc-800">Profit GJ (10%)</th>
                                <th className="px-8 py-8 text-[9px] font-black uppercase tracking-[0.3em] text-center bg-blue-950">Max Disc (Target: 15%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {masterParts.filter(p => 
                                (p.part_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (p.part_number || '').toLowerCase().includes(searchTerm.toLowerCase())
                            ).slice(0, 100).map((part) => {
                                const base = part.wholesale_price_no_tax || 0;
                                const guide = part.sales_guide_price_no_tax || 0;
                                
                                const pNoDiscount = guide - base;
                                const mNoDiscount = base > 0 ? (pNoDiscount / base * 100).toFixed(1) : 0;

                                const discountedRatu = guide * 0.875;
                                const pRatu = Math.round(discountedRatu - base);
                                const mRatu = base > 0 ? (pRatu / base * 100).toFixed(1) : 0;

                                const discountedGj = guide * 0.90;
                                const pGj = Math.round(discountedGj - base);
                                const mGj = base > 0 ? (pGj / base * 100).toFixed(1) : 0;

                                // Recommened Max Discount Calculation
                                const minSellingPrice = base * 1.15; // 15% Fixed target for this view
                                const maxSafeDiscount = guide > 0 ? Math.max(0, ((guide - minSellingPrice) / guide) * 100).toFixed(1) : 0;

                                return (
                                    <tr key={part.id} className="hover:bg-zinc-50 transition-colors group text-[11px]">
                                        <td className="px-8 py-8">
                                            <div className="font-black text-lg tracking-tight uppercase group-hover:text-blue-600 transition-colors leading-none mb-2 text-zinc-950">{part.part_name}</div>
                                            <div className="font-mono text-xs text-zinc-950 font-bold uppercase tracking-widest bg-zinc-100 w-fit px-2 py-1 rounded">{part.part_number}</div>
                                        </td>
                                        <td className="px-8 py-8 text-right font-black text-zinc-950 bg-zinc-50/10">
                                            Rp {guide.toLocaleString()}
                                        </td>
                                        <td className="px-8 py-8 text-right font-black text-zinc-950 border-x border-zinc-100">
                                            Rp {base.toLocaleString()}
                                        </td>
                                        <td className="px-8 py-8 text-center bg-zinc-50/20 border-r border-zinc-100">
                                            <div className={`font-black ${pNoDiscount < 0 ? 'text-red-600' : 'text-zinc-950'}`}>Rp {pNoDiscount.toLocaleString()}</div>
                                            <div className={`text-[9px] font-bold ${pNoDiscount < 0 ? 'text-red-500' : 'text-zinc-950'}`}>{mNoDiscount}%</div>
                                        </td>
                                        <td className={`px-8 py-8 text-center font-black border-r border-zinc-100 ${pRatu < 0 ? 'bg-red-50 text-red-600' : 'bg-white text-zinc-950'}`}>
                                            <div className="text-[10px] text-zinc-950/60 mb-1">Selling: Rp {discountedRatu.toLocaleString()}</div>
                                            <div className="text-base">Rp {pRatu.toLocaleString()}</div>
                                            <div className={`text-[9px] font-bold ${pRatu < 0 ? 'text-red-400' : 'text-blue-500'}`}>Profit: {mRatu}%</div>
                                        </td>
                                        <td className={`px-8 py-8 text-center font-black ${pGj < 0 ? 'bg-red-50 text-red-600' : 'bg-zinc-50/40 text-zinc-950'}`}>
                                            <div className="text-[10px] text-zinc-950/60 mb-1">Selling: Rp {discountedGj.toLocaleString()}</div>
                                            <div className="text-base">Rp {pGj.toLocaleString()}</div>
                                            <div className={`text-[9px] font-bold ${pGj < 0 ? 'text-red-400' : 'text-indigo-500'}`}>Profit: {mGj}%</div>
                                        </td>
                                        <td className={`px-8 py-8 text-center font-black tracking-tighter ${maxSafeDiscount <= 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50/30 text-blue-600'}`}>
                                            <div className="flex items-center justify-center gap-2 text-xl">
                                                {maxSafeDiscount}%
                                            </div>
                                            <div className="text-[9px] uppercase font-bold opacity-60">Max Disc Info</div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .animate-in {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @media print {
            nav, .no-print, header, .no-scrollbar {
                display: none !important;
            }
            .max-w-7xl {
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .p-10, .p-20 {
                padding: 0 !important;
            }
            .shadow-2xl, .shadow-xl {
                box-shadow: none !important;
            }
            body {
                background: white;
            }
        }
      `}</style>
    </div>
  );
}
