import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, Database } from 'lucide-react';
import { db } from '../utils/dbClient';

function normalizeJam(j) {
    if (!j) return '';
    const sj = String(j).replace(':', '.');
    const parts = sj.split('.');
    const h = String(parts[0]).padStart(2, '0');
    const m = String(parts[1] || '00').padEnd(2, '0');
    return `${h}.${m}`;
}

export default function AdminBookingPanel() {
    const [bookings, setBookings] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const filters = {
                    select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, keluhanDetail',
                    order: { column: 'id', ascending: false },
                    limit: 500,
                };
                if (startDate) filters.gte = { tanggal: startDate };
                if (endDate) filters.lte = { tanggal: endDate };
                const { data } = await db.select('booking', filters);
                setBookings(data || []);
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        })();
    }, [startDate, endDate]);

    const filtered = useMemo(() => {
        let list = bookings;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(b =>
                (b.noPlat || '').toLowerCase().includes(q) ||
                (b.namaCustomer || '').toLowerCase().includes(q) ||
                (b.noTelp || '').includes(q)
            );
        }
        return list;
    }, [bookings, search]);

    return (
        <div className="flex-1 w-full max-w-[100vw] bg-white relative overflow-hidden flex flex-col h-full animate-fade-in transition-colors duration-500 p-0">
            {/* Header */}
            <div className="flex justify-between items-center px-4 md:px-6 py-3 shrink-0 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                    <div className="bg-black p-2 rounded-lg text-white">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-zinc-900 leading-none">Booking Management</h2>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Admin View Only</p>
                    </div>
                </div>
            </div>

            {/* Content - Supabase only */}
            <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-6">
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cari plat/nama/telp..."
                            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400">Dari:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400">Sampai:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold focus:border-black focus:bg-white outline-none transition-all" />
                    </div>
                    <span className="text-[9px] font-bold text-zinc-400">{filtered.length} booking</span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-100 sticky top-0">
                            <tr className="text-zinc-500 font-black uppercase tracking-wider text-xs border-b border-zinc-200">
                                <th className="px-4 py-3 text-left">Tanggal</th>
                                <th className="px-4 py-3 text-left">Jam</th>
                                <th className="px-4 py-3 text-left">No Plat</th>
                                <th className="px-4 py-3 text-left">Nama</th>
                                <th className="px-4 py-3 text-left">Tipe</th>
                                <th className="px-4 py-3 text-left max-w-[200px]">Keluhan</th>
                                <th className="px-4 py-3 text-left">Via</th>
                                <th className="px-4 py-3 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="p-8 text-center text-zinc-400 font-bold">Memuat...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="8" className="p-8 text-center text-zinc-400 font-bold">Tidak ada booking</td></tr>
                            ) : filtered.map(b => (
                                <tr key={b.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-all">
                                    <td className="px-4 py-3 font-bold text-zinc-700">{b.tanggal || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-zinc-700">{(b.jam || '').replace('.', ':')}</td>
                                    <td className="px-4 py-3 font-black text-zinc-900 uppercase">{b.noPlat || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-zinc-700">{b.namaCustomer || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500">{b.tipeMobil || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate" title={b.keperluanService}>{b.keperluanService || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded ${(b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {(b.bookingVia || 'Supabase').length > 20 ? (b.bookingVia || '').slice(0, 18) + '...' : (b.bookingVia || 'Supabase')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded ${b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'bg-blue-50 text-blue-700' : b.status === 'accepted' ? 'bg-green-50 text-green-700' : b.status === 'declined' ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-500'}`}>
                                            {b.status === 'synced' || (b.bookingVia || '').includes('DMS') ? 'Synced (DMS)' : b.status || '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
