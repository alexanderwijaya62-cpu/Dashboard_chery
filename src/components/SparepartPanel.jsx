import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Search, Package, Truck, ChevronRight, Layers, ArrowLeft, ArrowRight, RefreshCw, Clock, DollarSign, User, Hash, Calendar, Key, Loader } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import SparepartPredictor from './SparepartPredictor';
import Toastify from 'toastify-js';
import { CHERY_DMS_URL } from '../utils/config';

const SHIPMENT_STATUS_MAP = {
    0: { label: 'Void', color: 'bg-zinc-200 text-zinc-500' },
    1: { label: 'Awaiting Confirmation', color: 'bg-amber-100 text-amber-700' },
    2: { label: 'Received Confirmation', color: 'bg-emerald-100 text-emerald-700' },
    3: { label: 'Freeze', color: 'bg-red-100 text-red-700' },
};

const STATUS_MAP = {
    0: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
    1: { label: 'Draft', color: 'bg-zinc-100 text-zinc-500' },
    2: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
    3: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
    4: { label: 'Processing', color: 'bg-amber-100 text-amber-700' },
    5: { label: 'Completed', color: 'bg-green-100 text-green-700' },
};

function InfoPill({ icon, label, value, mono }) {
    return (
        <div className="bg-zinc-100 rounded-md px-3 py-2 min-w-0">
            <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                {icon}
                <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-zinc-800 text-xs font-bold truncate ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
        </div>
    );
}

export default function SparepartPanel({ activeTab: activeTabProp, handleChangePassword }) {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [activeTab, setActiveTab] = useState(activeTabProp || 'dms_order');

    useEffect(() => {
        if (activeTabProp && activeTabProp !== activeTab) {
            setActiveTab(activeTabProp);
        }
    }, [activeTabProp, activeTab]);

    const [dmsOrders, setDmsOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dmsPage, setDmsPage] = useState(0);
    const [dmsTotalPages, setDmsTotalPages] = useState(1);
    const [dmsTotalElements, setDmsTotalElements] = useState(0);
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderDetail, setOrderDetail] = useState(null);
    const [detailCache, setDetailCache] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [isDeepSearching, setIsDeepSearching] = useState(false);
    const shipmentCacheRef = useRef({});
    const [shipmentVersion, setShipmentVersion] = useState(0);

    const updateShipmentCache = (obj) => {
        if (!obj || Object.keys(obj).length === 0) return;
        shipmentCacheRef.current = { ...shipmentCacheRef.current, ...obj };
        setShipmentVersion(v => v + 1);
    };

    const fetchDmsOrders = async (page = 0, code = '') => {
        setIsLoading(true);
        try {
            let url = `${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=${page}&pageSize=10&isBuyer=true`;
            if (code) url += `&orderCode=${encodeURIComponent(code)}`;
            const resp = await fetch(url);
            const result = await resp.json();
            const payload = result?.payload || result;
            const content = payload?.content || [];
            const total = payload?.totalPages || 1;
            const totalElements = payload?.totalElements || content.length;
            setDmsOrders(content);
            setDmsTotalPages(total);
            setDmsTotalElements(totalElements);
            setDmsPage(page);
        } catch (e) {
            console.error('Failed to fetch DMS orders:', e);
            Toastify({ text: 'Gagal mengambil data DMS Order', background: 'red' }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    // Status shipment di detail order (partSaleOrders/{id}) sering tidak sinkron dengan data
    // aktual di DMS (masih status 1 padahal sudah diterima). Status asli diambil dari endpoint
    // partShipments/forCurrentUser dengan filter partSaleOrderProcessCode (prefix = kode order).
    // Agar hemat request: 1x fetch daftar shipment terbaru (pageSize=100) untuk seluruh halaman,
    // lalu fallback fetch per order hanya untuk order yang tidak tercakup.
    const ensureShipments = async (orders) => {
        if (!Array.isArray(orders) || orders.length === 0) return;
        const missing = orders.filter(o => o?.code && !shipmentCacheRef.current[o.code]);
        if (missing.length === 0) return;

        try {
            const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_shipments&pageIndex=0&pageSize=100`);
            const result = await resp.json();
            const payload = result?.payload || result;
            const content = Array.isArray(payload?.content) ? payload.content : [];
            const byOrder = {};
            content.forEach(s => {
                const oc = s?.partSaleOrderCode;
                if (!oc) return;
                if (!byOrder[oc]) byOrder[oc] = [];
                byOrder[oc].push({ code: s.partSaleOrderProcessCode, status: s.status, receivingTime: s.receivingTime, receiverName: s.receiverName, isSatisfied: s.isSatisfied, options: s.options });
            });
            updateShipmentCache(byOrder);
        } catch { /* fallthrough ke per-order */ }

        const stillMissing = missing.filter(o => !shipmentCacheRef.current[o.code]);
        if (stillMissing.length === 0) return;

        const results = await Promise.allSettled(
            stillMissing.map(o =>
                fetch(`${CHERY_DMS_URL}?endpoint=part_shipments&processCode=${encodeURIComponent(o.code)}&pageIndex=0&pageSize=10`)
                    .then(r => r.json())
                    .then(r => ({ code: o.code, payload: r?.payload || r }))
            )
        );
        const byOrder2 = {};
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                const content = Array.isArray(r.value.payload?.content)
                    ? r.value.payload.content
                    : (Array.isArray(r.value.payload) ? r.value.payload : []);
                byOrder2[r.value.code] = content.map(s => ({ code: s.partSaleOrderProcessCode, status: s.status, receivingTime: s.receivingTime, receiverName: s.receiverName, isSatisfied: s.isSatisfied, options: s.options }));
            }
        });
        updateShipmentCache(byOrder2);
    };

    const enrichOrderDetail = async (detail) => {
        if (!detail || !Array.isArray(detail.partSaleOrderProcesses) || detail.partSaleOrderProcesses.length === 0) {
            return detail;
        }
        const orderCode = detail.partSaleOrderCode || (detail.partSaleOrderProcesses[0].code || '').replace(/_\d+$/, '');
        if (!orderCode) return detail;
        if (!shipmentCacheRef.current[orderCode]) {
            await ensureShipments([{ code: orderCode }]);
        }
        const rows = shipmentCacheRef.current[orderCode];
        if (!rows || rows.length === 0) return detail;
        const rowByCode = {};
        rows.forEach(r => { rowByCode[r.code] = r; });
        return {
            ...detail,
            partSaleOrderProcesses: detail.partSaleOrderProcesses.map(p => {
                const ship = rowByCode[p.code];
                if (!ship) return p;
                return {
                    ...p,
                    status: ship.status,
                    receivingTime: ship.receivingTime,
                    receiverName: ship.receiverName,
                    isSatisfied: ship.isSatisfied,
                    options: ship.options,
                };
            })
        };
    };

    const fetchOrderDetail = async (orderId) => {
        if (detailCache[orderId]) {
            setOrderDetail(await enrichOrderDetail(detailCache[orderId]));
            return;
        }
        setDetailLoading(true);
        try {
            const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_order_detail&orderId=${orderId}`);
            const result = await resp.json();
            const detail = await enrichOrderDetail(result?.payload || result);
            setDetailCache(prev => ({ ...prev, [orderId]: detail }));
            setOrderDetail(detail);
        } catch (e) {
            console.error('Failed to fetch order detail:', e);
            Toastify({ text: 'Gagal mengambil detail order', background: 'red' }).showToast();
        } finally {
            setDetailLoading(false);
        }
    };

    const toggleExpand = (orderId) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            setOrderDetail(null);
        } else {
            setExpandedOrderId(orderId);
            setOrderDetail(null);
            fetchOrderDetail(orderId);
        }
    };

    const deepSearchOrders = async (term) => {
        setIsDeepSearching(true);
        try {
            const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_orders_search&q=${encodeURIComponent(term)}`);
            const result = await resp.json();
            if (result?.error) {
                Toastify({ text: 'Server error: ' + result.error, background: 'red', duration: 3000 }).showToast();
                setIsDeepSearching(false);
                return;
            }
            const rawOrders = result?.payload?.content || [];
            const detailEntries = {};
            const orders = rawOrders.map(({ _detail, ...o }) => {
                if (_detail) detailEntries[o.id] = _detail;
                return o;
            });
            if (Object.keys(detailEntries).length > 0) {
                setDetailCache(prev => ({ ...prev, ...detailEntries }));
            }

            if (orders.length > 0) {
                setDmsOrders(orders);
                setDmsPage(0);
                setDmsTotalPages(1);
                setDmsTotalElements(orders.length);
                Toastify({ text: `Ditemukan ${orders.length} order`, background: '#18181b', duration: 3000 }).showToast();
            } else {
                Toastify({ text: 'Tidak ditemukan order yang cocok', background: '#71717a', duration: 3000 }).showToast();
            }
        } catch (e) {
            console.error('Deep search failed:', e);
            Toastify({ text: 'Gagal menghubungi server', background: 'red', duration: 3000 }).showToast();
        } finally {
            setIsDeepSearching(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dms_order') {
            fetchDmsOrders(0);
        }
    }, [activeTab]);

    const handleSearch = async () => {
        const q = searchCode.trim();
        if (!q) { fetchDmsOrders(0); return; }
        try {
            let url = `${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=0&pageSize=10&isBuyer=true`;
            url += `&orderCode=${encodeURIComponent(q)}`;
            const resp = await fetch(url);
            const result = await resp.json();
            const payload = result?.payload || result;
            const content = payload?.content || [];
            if (content.length > 0) {
                setDmsOrders(content);
                setDmsTotalPages(payload?.totalPages || 1);
                setDmsTotalElements(payload?.totalElements || content.length);
                setDmsPage(0);
            } else if (q.length >= 3) {
                deepSearchOrders(q);
            } else {
                Toastify({ text: 'Tidak ditemukan', background: '#71717a', duration: 2000 }).showToast();
            }
        } catch (e) { console.warn('Search fetch failed:', e); }
    };

    // Muat status shipment untuk order yang tampil di halaman (hemat request:
    // 1x daftar shipment + fallback per order, tanpa fetch detail semua order).
    useEffect(() => {
        if (activeTab === 'dms_order' && dmsOrders.length > 0) {
            ensureShipments(dmsOrders);
        }
    }, [dmsOrders, activeTab, shipmentVersion]); // eslint-disable-line

    const filteredOrders = useMemo(() => {
        const q = (searchCode || '').toLowerCase().trim();
        let result = dmsOrders;

        if (q) {
            result = result.filter(order => {
                if ((order.code || '').toLowerCase().includes(q)) return true;
                if ((order.remark || '').toLowerCase().includes(q)) return true;
                if ((order.submitterName || '').toLowerCase().includes(q)) return true;
                if ((order.creatorName || '').toLowerCase().includes(q)) return true;
                const cached = detailCache[order.id];
                if (cached) {
                    if ((cached.remark || '').toLowerCase().includes(q)) return true;
                    const details = cached.details || [];
                    if (details.some(d =>
                        (d.partCode || '').toLowerCase().includes(q) ||
                        (d.partName || '').toLowerCase().includes(q) ||
                        (d.orderDescription || '').toLowerCase().includes(q)
                    )) return true;
                }
                return false;
            });
        }

        if (filterDateStart || filterDateEnd) {
            result = result.filter(order => {
                const t = order.createTime || order.submitTime || '';
                if (!t) return false;
                if (filterDateStart && t < filterDateStart) return false;
                if (filterDateEnd) {
                    const end = filterDateEnd + 'T23:59:59';
                    if (t > end) return false;
                }
                return true;
            });
        }

        return result;
    }, [dmsOrders, searchCode, detailCache, filterDateStart, filterDateEnd]);

    const getShipmentStatusInfo = (status) => SHIPMENT_STATUS_MAP[status] || { label: 'Unknown', color: 'bg-zinc-100 text-zinc-500' };

    const getItemDeliveryStatus = (itemPartCode) => {
        if (!orderDetail?.partSaleOrderProcesses) return null;
        for (const proc of orderDetail.partSaleOrderProcesses) {
            const pd = (proc.processDetails || []).find(d => d.partCode === itemPartCode);
            if (pd) return { ...pd, processStatus: proc.status };
        }
        return null;
    };

    // Order status diturunkan dari status konfirmasi pengiriman (partShipments),
    // bukan status order DMS ("Approved" ≠ sudah sampai). Order baru dianggap SELESAI
    // ketika SEMUA shipment sudah di-confirm (status 2 = Sudah Diterima).
    // Kalau masih ada shipment status 1 (Awaiting Confirmation) berarti belum sampai.
    const getOrderStatusInfo = (order) => {
        const shipments = shipmentCacheRef.current[order.code];
        if (Array.isArray(shipments) && shipments.length > 0) {
            const statuses = shipments.map(s => s.status);
            if (statuses.every(s => s === 2)) {
                return { label: 'Sudah Diterima', color: 'bg-emerald-100 text-emerald-700' };
            }
            if (statuses.some(s => s === 3)) {
                return { label: 'Freeze', color: 'bg-red-100 text-red-700' };
            }
            if (statuses.some(s => s === 0)) {
                return { label: 'Void', color: 'bg-zinc-200 text-zinc-500' };
            }
            return { label: 'Belum Sampai', color: 'bg-amber-100 text-amber-700' };
        }
        const detail = detailCache[order.id];
        const processes = detail?.partSaleOrderProcesses;
        if (Array.isArray(processes) && processes.length > 0) {
            const statuses = processes.map(p => p.status);
            if (statuses.every(s => s === 2)) {
                return { label: 'Sudah Diterima', color: 'bg-emerald-100 text-emerald-700' };
            }
            if (statuses.some(s => s === 3)) {
                return { label: 'Freeze', color: 'bg-red-100 text-red-700' };
            }
            if (statuses.some(s => s === 0)) {
                return { label: 'Void', color: 'bg-zinc-200 text-zinc-500' };
            }
            return { label: 'Belum Sampai', color: 'bg-amber-100 text-amber-700' };
        }
        const fallback = STATUS_MAP[order.status];
        if (!fallback) return { label: 'Unknown', color: 'bg-zinc-100 text-zinc-500' };
        if (order.status === 3 || order.status === 4 || order.status === 2) {
            return { label: 'Belum Sampai', color: 'bg-amber-100 text-amber-700' };
        }
        if (order.status === 5) {
            return { label: 'Sudah Diterima', color: 'bg-emerald-100 text-emerald-700' };
        }
        return fallback;
    };

    const formatCurrency = (val) => {
        if (!val && val !== 0) return 'Rp 0';
        return 'Rp ' + Number(val).toLocaleString('id-ID');
    };

    const formatDate = (str) => {
        if (!str) return '-';
        try {
            const d = new Date(str);
            return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return str; }
    };

    return (
        <div className="w-full h-full bg-zinc-100 flex flex-col overflow-hidden font-sans antialiased">
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-zinc-200 px-4 md:px-8 h-20 flex items-center justify-between shrink-0 box-border">
                    <div>
                        <h1 className="text-zinc-900 font-black text-base md:text-lg">
                            {activeTab === 'dms_order' ? 'DMS Order' : 'Stock Predictor'}
                        </h1>
                        <p className="text-zinc-500 text-xs font-medium mt-0.5">
                            {activeTab === 'dms_order'
                                ? `${dmsTotalElements} total part sale orders`
                                : 'Sparepart stock prediction'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeTab === 'dms_order' && (
                            <>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari PO, part no, remark..."
                                        value={searchCode}
                                        onChange={(e) => setSearchCode(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSearch();
                                            if (e.key === 'Escape') { setSearchCode(''); setFilterDateStart(''); setFilterDateEnd(''); fetchDmsOrders(0); }
                                        }}
                                        className="w-40 md:w-52 bg-zinc-50 border border-zinc-300 rounded-l-md pl-9 pr-2 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-all placeholder:text-zinc-400"
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isDeepSearching || isLoading}
                                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-400 text-white text-xs font-black uppercase tracking-wider rounded-r-md transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    {isDeepSearching ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
                                    Cari
                                </button>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="date"
                                            value={filterDateStart}
                                            onChange={(e) => setFilterDateStart(e.target.value)}
                                            className="w-36 bg-zinc-50 border border-zinc-300 rounded-md pl-9 pr-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-all"
                                        />
                                    </div>
                                    <span className="text-zinc-400 text-xs font-bold">-</span>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="date"
                                            value={filterDateEnd}
                                            onChange={(e) => setFilterDateEnd(e.target.value)}
                                            className="w-36 bg-zinc-50 border border-zinc-300 rounded-md pl-9 pr-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-all"
                                        />
                                    </div>
                                </div>
                                {(searchCode || filterDateStart || filterDateEnd) && (
                                    <button
                                        onClick={() => { setSearchCode(''); setFilterDateStart(''); setFilterDateEnd(''); fetchDmsOrders(0); }}
                                        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-300 shadow-sm rounded-md transition-all font-black text-[10px] uppercase tracking-widest"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => fetchDmsOrders(dmsPage)}
                                    className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm rounded-md transition-all font-black text-[10px] uppercase tracking-widest"
                                >
                                    <RefreshCw size={14} /> Refresh
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {(isLoading || isDeepSearching) && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-zinc-900 text-white px-5 py-3 rounded-lg flex items-center gap-3 font-bold shadow-lg">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                            {isDeepSearching ? 'Mencari...' : 'Memuat...'}
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-[72px] md:pb-8">
                    {activeTab === 'dms_order' && (
                        <>
                            {/* Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-zinc-200 rounded-lg p-5">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center mb-4">
                                        <FileText size={20} className="text-black" />
                                    </div>
                                    <p className="text-3xl font-black text-zinc-900">{dmsTotalElements}</p>
                                    <p className="text-zinc-500 text-xs font-medium mt-1">Total Orders</p>
                                </div>
                                <div className="bg-white border border-zinc-200 rounded-lg p-5">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center mb-4">
                                        <Package size={20} className="text-black" />
                                    </div>
                                    <p className="text-3xl font-black text-zinc-900">{dmsOrders.reduce((s, o) => s + (o.orderingVarietySum || 0), 0)}</p>
                                    <p className="text-zinc-500 text-xs font-medium mt-1">Total Items</p>
                                </div>
                                <div className="bg-white border border-zinc-200 rounded-lg p-5">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center mb-4">
                                        <DollarSign size={20} className="text-black" />
                                    </div>
                                    <p className="text-3xl font-black text-zinc-900">{formatCurrency(dmsOrders.reduce((s, o) => s + (o.orderinglFeeSum || 0), 0))}</p>
                                    <p className="text-zinc-500 text-xs font-medium mt-1">Total Value</p>
                                </div>
                                <div className="bg-white border border-zinc-200 rounded-lg p-5">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center mb-4">
                                        <Clock size={20} className="text-black" />
                                    </div>
                                    <p className="text-3xl font-black text-zinc-900">{filteredOrders.length}</p>
                                    <p className="text-zinc-500 text-xs font-medium mt-1">{searchCode || filterDateStart || filterDateEnd ? 'Filtered' : 'On This Page'}</p>
                                </div>
                            </div>

                            {/* Order List */}
                            <div className="space-y-3">
                                <h3 className="text-zinc-600 text-xs font-black uppercase tracking-widest px-1">
                                    Part Sale Orders
                                </h3>

                                {filteredOrders.length === 0 && !isLoading && !isDeepSearching && (
                                    <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
                                        <FileText size={40} className="text-zinc-400 mx-auto mb-4" />
                                        <p className="text-zinc-500 font-bold">No Orders Found</p>
                                        <p className="text-zinc-400 text-xs mt-1">{searchCode ? 'No orders match your search criteria across all pages' : 'No purchase orders available from DMS'}</p>
                                    </div>
                                )}

                                {filteredOrders.map((order) => {
                                    const statusInfo = getOrderStatusInfo(order);
                                    const isExpanded = expandedOrderId === order.id;

                                    return (
                                        <div key={order.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden transition-all duration-200">
                                            <button
                                                onClick={() => toggleExpand(order.id)}
                                                className="w-full text-left p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 hover:bg-zinc-50/50 transition-all"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                                        <ChevronRight size={18} className="text-zinc-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-zinc-900 font-black font-mono text-sm truncate">{order.code}</p>
                                                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">{order.submitterName || order.creatorName}</p>
                                                        {order.remark && (
                                                            <p className="text-zinc-400 text-[9px] font-medium truncate max-w-md mt-0.5">{order.remark}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                                                    <div className="text-right">
                                                        <p className="text-zinc-900 font-black text-xs">{order.orderingVarietySum || 0} items</p>
                                                        <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">{order.typeName || 'Order'}</p>
                                                    </div>
                                                    <div className="text-right min-w-[100px]">
                                                        <p className="text-zinc-900 font-black text-xs">{formatCurrency(order.orderinglFeeSum)}</p>
                                                        <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Total</p>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${statusInfo.color}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                    <p className="text-zinc-400 text-[9px] font-bold min-w-[120px] text-right">{formatDate(order.createTime)}</p>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="border-t border-zinc-100">
                                                    {detailLoading ? (
                                                        <div className="p-10 flex justify-center">
                                                            <div className="w-5 h-5 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin"></div>
                                                        </div>
                                                    ) : orderDetail && orderDetail.id === order.id ? (
                                                        <div className="p-5 space-y-6">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                                <InfoPill icon={<Hash size={12} />} label="PO Code" value={orderDetail.code} mono />
                                                                <InfoPill icon={<User size={12} />} label="Submitter" value={orderDetail.submitterName} />
                                                                <InfoPill icon={<Clock size={12} />} label="Submit Time" value={formatDate(orderDetail.submitTime)} />
                                                                <InfoPill icon={<Clock size={12} />} label="Process Time" value={formatDate(orderDetail.processTime)} />
                                                                <InfoPill icon={<User size={12} />} label="Creator" value={orderDetail.creatorName} />
                                                                <InfoPill icon={<User size={12} />} label="Modifier" value={orderDetail.modifierName} />
                                                                <InfoPill icon={<Package size={12} />} label="Variety" value={`${orderDetail.outVarietySum || orderDetail.orderingVarietySum || 0} items`} />
                                                                <InfoPill icon={<DollarSign size={12} />} label="Total Fee" value={formatCurrency(orderDetail.outFeeSum || orderDetail.orderinglFeeSum)} />
                                                                {orderDetail.remark && (
                                                                    <div className="col-span-2 md:col-span-4">
                                                                        <InfoPill icon={<FileText size={12} />} label="Remark" value={orderDetail.remark} />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div>
                                                                 <div className="flex items-center gap-2 mb-4">
                                                                     <Package size={16} className="text-zinc-500" />
                                                                     <h4 className="text-zinc-700 text-xs font-black uppercase tracking-widest">Sparepart Items</h4>
                                                                 </div>
                                                                 <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                                                                     <table className="w-full text-left">
                                                                         <thead>
                                                                             <tr className="bg-zinc-50 border-b border-zinc-200">
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider">Part Code</th>
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider">Part Name</th>
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Qty</th>
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-right">Price</th>
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-right">Total</th>
                                                                                 <th className="p-3 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Status</th>
                                                                             </tr>
                                                                         </thead>
                                                                         <tbody>
                                                                              {(orderDetail.details || []).map((item, idx) => {
                                                                                  const ds = getItemDeliveryStatus(item.partCode);
                                                                                  let statusBadge = null;
                                                                                  if (ds) {
                                                                                      const ps = ds.processStatus;
                                                                                      if (ps === 0) {
                                                                                          statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Void</span>;
                                                                                      } else if (ps === 3) {
                                                                                          statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Freeze</span>;
                                                                                      } else if (ps === 1) {
                                                                                          statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Dalam Perjalanan {ds.outQuantity}/{ds.orderQuantity}</span>;
                                                                                      } else if (ps === 2) {
                                                                                          if (ds.outQuantity >= ds.orderQuantity) {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Sudah Sampai</span>;
                                                                                          } else if (ds.deliveryQuantity > 0) {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{'In Transit'} {ds.outQuantity}/{ds.orderQuantity}</span>;
                                                                                          } else {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Sudah Sampai</span>;
                                                                                          }
                                                                                      } else {
                                                                                          if (ds.outQuantity >= ds.orderQuantity) {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Sudah Sampai</span>;
                                                                                          } else if (ds.deliveryQuantity > 0) {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{'In Transit'} {ds.outQuantity}/{ds.orderQuantity}</span>;
                                                                                          } else if (ds.processQuantity > 0) {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Diproses {ds.processQuantity}/{ds.orderQuantity}</span>;
                                                                                          } else {
                                                                                              statusBadge = <span className="text-[8px] font-black uppercase tracking-widest bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Pending</span>;
                                                                                          }
                                                                                      }
                                                                                  }
                                                                                 return (
                                                                                 <tr key={idx} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-all">
                                                                                     <td className="p-3">
                                                                                         <span className="font-mono text-xs font-bold text-zinc-900">{item.partCode}</span>
                                                                                     </td>
                                                                                     <td className="p-3">
                                                                                         <p className="text-xs font-bold text-zinc-900">{item.partName}</p>
                                                                                         {item.orderDescription && (
                                                                                             <p className="text-[10px] text-zinc-500 mt-0.5">{item.orderDescription}</p>
                                                                                         )}
                                                                                     </td>
                                                                                     <td className="p-3 text-center">
                                                                                         <span className="font-black text-sm text-zinc-900">{item.orderQuantity}</span>
                                                                                     </td>
                                                                                     <td className="p-3 text-right">
                                                                                         <span className="text-xs font-bold text-zinc-700">{formatCurrency(item.orderPrice)}</span>
                                                                                     </td>
                                                                                     <td className="p-3 text-right">
                                                                                         <span className="font-black text-sm text-zinc-900">{formatCurrency(item.orderFee)}</span>
                                                                                     </td>
                                                                                     <td className="p-3 text-center">
                                                                                         {statusBadge || <span className="text-[8px] font-black uppercase tracking-widest bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">-</span>}
                                                                                     </td>
                                                                                 </tr>
                                                                                 );
                                                                             })}
                                                                             {(orderDetail.details || []).length === 0 && (
                                                                                 <tr>
                                                                                     <td colSpan={6} className="p-8 text-center text-zinc-400 font-bold text-xs">No items</td>
                                                                                 </tr>
                                                                             )}
                                                                         </tbody>
                                                                     </table>
                                                                 </div>
                                                             </div>

                                                            {orderDetail.partSaleOrderProcesses?.length > 0 && (
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <Truck size={16} className="text-zinc-500" />
                                                                        <h4 className="text-zinc-700 text-xs font-black uppercase tracking-widest">Shipment Tracking</h4>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {orderDetail.partSaleOrderProcesses.map((process, pIdx) => (
                                                                            <div key={process.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                                                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="w-7 h-7 bg-zinc-900 text-white rounded-md flex items-center justify-center font-black text-[10px]">
                                                                                            {pIdx + 1}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-zinc-900 font-black font-mono text-xs">{process.code}</p>
                                                                                            <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">{process.shippingWarehouseName || process.shippingCompanyName}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                     <div className="flex items-center gap-4">
                                                                                         {process.sapDeliveryCode && (
                                                                                             <div className="text-right">
                                                                                                 <p className="text-zinc-900 font-black text-[10px]">SAP: {process.sapDeliveryCode}</p>
                                                                                                 <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-wider">Delivery Code</p>
                                                                                             </div>
                                                                                         )}
                                                                                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${getShipmentStatusInfo(process.status).color}`}>
                                                                                              {getShipmentStatusInfo(process.status).label}
                                                                                          </span>
                                                                                         {process.receivingTime && (
                                                                                             <div className="text-right">
                                                                                                 <p className="text-zinc-900 font-black text-[10px]">{formatDate(process.receivingTime)}</p>
                                                                                                 <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-wider">
                                                                                                     Diterima {process.receiverName ? `oleh ${process.receiverName}` : ''}
                                                                                                 </p>
                                                                                             </div>
                                                                                         )}
                                                                                         {process.processTime && (
                                                                                             <p className="text-zinc-400 text-[9px] font-bold">{formatDate(process.processTime)}</p>
                                                                                         )}
                                                                                     </div>
                                                                                </div>

                                                                                <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                                                                                    <table className="w-full text-left">
                                                                                        <thead>
                                                                                            <tr className="bg-white border-b border-zinc-200">
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider">Part Code</th>
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider">Part Name</th>
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Order</th>
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Process</th>
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Delivery</th>
                                                                                                <th className="p-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider text-center">Out</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {(process.processDetails || []).map((pd, pdIdx) => (
                                                                                                <tr key={pdIdx} className="border-b border-zinc-100 last:border-0 bg-white hover:bg-zinc-50/50 transition-all">
                                                                                                    <td className="p-2.5">
                                                                                                        <span className="font-mono text-[10px] font-bold text-zinc-900">{pd.partCode}</span>
                                                                                                    </td>
                                                                                                    <td className="p-2.5">
                                                                                                        <p className="text-xs font-bold text-zinc-900">{pd.partName}</p>
                                                                                                    </td>
                                                                                                    <td className={`p-2.5 text-center font-black text-xs ${pd.orderQuantity > 0 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                                                                                                        {pd.orderQuantity || 0}
                                                                                                    </td>
                                                                                                    <td className={`p-2.5 text-center font-black text-xs ${pd.processQuantity > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                                                                                                        {pd.processQuantity || 0}
                                                                                                    </td>
                                                                                                    <td className={`p-2.5 text-center font-black text-xs ${pd.deliveryQuantity > 0 ? 'text-blue-600' : 'text-zinc-300'}`}>
                                                                                                        {pd.deliveryQuantity || 0}
                                                                                                    </td>
                                                                                                    <td className={`p-2.5 text-center font-black text-xs ${pd.outQuantity > 0 ? 'text-green-600' : 'text-zinc-300'}`}>
                                                                                                        {pd.outQuantity || 0}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination — only show when not in deep search results mode */}
                            {!searchCode && dmsTotalPages > 1 && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-[10px] font-medium text-zinc-500">
                                        Page {dmsPage + 1} of {dmsTotalPages} &middot; {dmsTotalElements} total orders
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { const p = Math.max(0, dmsPage - 1); fetchDmsOrders(p); }}
                                            disabled={dmsPage === 0}
                                            className="w-9 h-9 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">
                                            {dmsPage + 1}
                                        </span>
                                        <button
                                            onClick={() => { const p = Math.min(dmsTotalPages - 1, dmsPage + 1); fetchDmsOrders(p); }}
                                            disabled={dmsPage >= dmsTotalPages - 1}
                                            className="w-9 h-9 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'profit' && (
                        <div className="flex-1 overflow-hidden">
                            <SparepartPredictor />
                        </div>
                    )}
                </main>
            </div>
            <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onChangePassword={handleChangePassword} />
        </div>
    );
}
