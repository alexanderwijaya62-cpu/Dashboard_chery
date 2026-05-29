import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle2, FileText, Wrench, BarChart2 } from 'lucide-react';
import { getStatusStyle, STATUS_COLORS, formatDate, fetchWarrantyAPI } from '../utils/warrantyConfig';

export default function WarrantyDashboard({ onNavigate }) {
  const [allData, setAllData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        endpoint: 'work-order',
        draw: 1,
        start: 0,
        length: 500,
        search: '',
        status: '',
        from: '',
        to: '',
      });
      const json = await fetchWarrantyAPI(params);
      setAllData(json.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Compute stats
  const total = allData.length;
  const statusCounts = allData.reduce((acc, row) => {
    const key = (row.status || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const activeCount = (statusCounts['open'] || 0) + (statusCounts['ready'] || 0) +
    (statusCounts['in progress'] || 0) + (statusCounts['checker'] || 0);
  const selesaiCount = statusCounts['selesai'] || 0;
  const closedCount = statusCounts['closed'] || 0;

  // Top mechanics
  const mechanicCounts = allData.reduce((acc, row) => {
    const m = row.nama_mekanik1;
    if (m) acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  const topMechanics = Object.entries(mechanicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top vehicles
  const vehicleCounts = allData.reduce((acc, row) => {
    const v = row.nama_kendaraan;
    if (v) acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
  const topVehicles = Object.entries(vehicleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent 5 WOs
  const recentWOs = [...allData]
    .sort((a, b) => new Date(b.last_update || 0) - new Date(a.last_update || 0))
    .slice(0, 8);

  const statCards = [
    { label: 'Total WO', value: total, icon: FileText, color: 'bg-zinc-900', textColor: 'text-white' },
    { label: 'Aktif', value: activeCount, icon: Clock, color: 'bg-blue-600', textColor: 'text-white' },
    { label: 'Selesai', value: selesaiCount, icon: CheckCircle2, color: 'bg-green-600', textColor: 'text-white' },
    { label: 'Closed', value: closedCount, icon: ShieldCheck, color: 'bg-zinc-500', textColor: 'text-white' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-zinc-50 font-sans overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight">Warranty Dashboard</h1>
            <p className="text-xs text-zinc-400 font-medium">
              {lastUpdated ? `Update: ${lastUpdated.toLocaleTimeString('id-ID')}` : 'Memuat...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('warranty-wo')}
              className="px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Lihat Semua WO →
            </button>
          )}
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Gagal memuat data</p>
            <p className="text-xs text-red-500">{error}</p>
          </div>
          <button onClick={fetchAll} className="ml-auto px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
            Coba Lagi
          </button>
        </div>
      )}

      {isLoading && allData.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-zinc-400 font-medium">Memuat dashboard...</p>
        </div>
      ) : (
        <div className="p-6 space-y-6">

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`${card.color} rounded-2xl p-5 flex items-center justify-between shadow-sm`}>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${card.textColor} opacity-70`}>{card.label}</p>
                    <p className={`text-3xl font-black mt-1 ${card.textColor}`}>{card.value}</p>
                  </div>
                  <Icon size={32} className={`${card.textColor} opacity-30`} />
                </div>
              );
            })}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-4">Distribusi Status</h2>
            <div className="space-y-3">
              {Object.entries(STATUS_COLORS).map(([key, style]) => {
                const count = statusCounts[key] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`}></div>
                    <span className="text-sm text-zinc-700 font-medium w-28 shrink-0">{style.label}</span>
                    <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${style.dot}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 w-8 text-right">{count}</span>
                    <span className="text-xs text-zinc-400 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Mechanics */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Wrench size={16} className="text-zinc-500" />
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Top Mekanik</h2>
              </div>
              {topMechanics.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-6">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {topMechanics.map(([name, count], i) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs font-black text-zinc-400 w-4">{i + 1}</span>
                        <span className="text-sm text-zinc-700 font-medium flex-1 truncate">{name}</span>
                        <div className="w-24 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Vehicles */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-zinc-500" />
                <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Top Kendaraan</h2>
              </div>
              {topVehicles.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-6">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {topVehicles.map(([name, count], i) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs font-black text-zinc-400 w-4">{i + 1}</span>
                        <span className="text-sm text-zinc-700 font-medium flex-1 truncate">{name}</span>
                        <div className="w-24 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent WOs */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">WO Terbaru</h2>
              {onNavigate && (
                <button onClick={() => onNavigate('warranty-wo')} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
                  Lihat Semua →
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">No. WO</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Pelanggan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Kendaraan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">No. Polisi</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {recentWOs.map((row, i) => {
                    const s = getStatusStyle(row.status);
                    return (
                      <tr key={i} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">{row.no_wo || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">{row.nama_pelanggan || '-'}</td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{row.nama_kendaraan || '-'}</td>
                        <td className="px-4 py-3 font-mono text-zinc-600 whitespace-nowrap">{row.no_polisi || '-'}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(row.last_update)}</td>
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
  );
}
