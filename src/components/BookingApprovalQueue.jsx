import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, Calendar, Check, CheckCircle, ClipboardList, Clock, FileText, HelpCircle, MapPin, Phone, RefreshCw, Search, ShieldCheck, Truck, User, XCircle } from 'lucide-react';
import { db } from '../utils/dbClient';
import { supabase } from '../utils/supabaseClient';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';

export default function BookingApprovalQueue({ user, setCurrentPage }) {
  const [holidays, setHolidays] = useState([]);

  useEffect(() => { fetchHolidays().then(setHolidays); }, []);

  const [pendingBookings, setPendingBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingDmsMap, setCheckingDmsMap] = useState({});
  const [dmsDataMap, setDmsDataMap] = useState({});
  
  // Modal states
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Fetch pending bookings from Supabase
  const fetchPendingBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db.select('booking', {
        select: 'id, tanggal, jam, noPlat, namaCustomer, tipeMobil, keperluanService, noTelp, bookingVia, status, vin, noUrut, keluhanDetail',
        eq: { status: 'waiting_approval' },
        order: { column: 'tanggal', ascending: true }
      });

      if (error) throw error;
      setPendingBookings(data || []);
      
      // Auto-check each booking against Chery DMS in background
      if (data && data.length > 0) {
        data.forEach(booking => {
          checkDmsStatus(booking.noPlat);
        });
      }
    } catch (e) {
      console.error("Fetch Pending Bookings Error:", e);
      Toastify({ text: `Gagal memuat booking: ${e.message}`, background: "#ef4444" }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  // Check plate number against external Chery DMS
  const checkDmsStatus = async (noPlat) => {
    if (!noPlat) return;
    const cleanPlat = noPlat.toUpperCase().replace(/\s+/g, '');
    
    // Skip if already checking or checked
    if (checkingDmsMap[cleanPlat] || dmsDataMap[cleanPlat]) return;

    setCheckingDmsMap(prev => ({ ...prev, [cleanPlat]: true }));
    try {
      const res = await fetch(`/api/chery_dms?endpoint=vehicle-select&term=${cleanPlat}&q=${cleanPlat}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      
      // Look for an exact plate match in DMS results
      const matched = Array.isArray(json) && json.find(v => 
        (v.no_polisi || '').toUpperCase().replace(/\s+/g, '') === cleanPlat
      );

      setDmsDataMap(prev => ({ 
        ...prev, 
        [cleanPlat]: {
          checked: true,
          found: !!matched,
          vehicleData: matched || null
        }
      }));
    } catch (e) {
      console.error(`DMS Check Error for ${cleanPlat}:`, e);
      setDmsDataMap(prev => ({ 
        ...prev, 
        [cleanPlat]: {
          checked: true,
          found: false,
          error: true,
          vehicleData: null
        }
      }));
    } finally {
      setCheckingDmsMap(prev => ({ ...prev, [cleanPlat]: false }));
    }
  };

  useEffect(() => {
    fetchPendingBookings();

    // Subscribe to realtime booking table changes
    const bookingSub = supabase
      .channel('approval-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking' },
        () => {
          fetchPendingBookings();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'booking', filter: 'status=eq.waiting_approval' },
        () => {
          fetchPendingBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingSub);
    };
  }, []);

  // Accept Booking Action
  const handleAcceptBooking = async (booking, bypassWarning = false) => {
    if (isHolidayOrSunday(booking.tanggal, holidays)) {
      Toastify({ text: `Tidak bisa menyetujui: ${booking.tanggal} adalah hari libur atau Minggu!`, background: "red" }).showToast();
      return;
    }
    const cleanPlat = booking.noPlat.toUpperCase().replace(/\s+/g, '');
    const dmsInfo = dmsDataMap[cleanPlat];

    // Check if vehicle check is done
    if (!dmsInfo || !dmsInfo.checked) {
      Toastify({ text: "Sedang mengecek database DMS. Harap tunggu...", background: "#f59e0b" }).showToast();
      return;
    }

    // If vehicle is NOT found in DMS and we haven't bypassed the warning yet, show warning modal
    if (!dmsInfo.found && !bypassWarning) {
      setSelectedBooking(booking);
      setShowWarningModal(true);
      return;
    }

    setIsProcessingApproval(true);
    try {
      // 1. If found in DMS, try to submit booking request to external Chery DMS
      let externalSuccess = false;
      if (dmsInfo.found && dmsInfo.vehicleData) {
        const v = dmsInfo.vehicleData;
        const dmsBookingPayload = {
          uniqid: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          id_kendaraan: v.id_kendaraan,
          no_polisi: v.no_polisi,
          model_kendaraan: v.model_kendaraan || v.nama_kendaraan || booking.tipeMobil,
          nama_kendaraan: v.nama_kendaraan || booking.tipeMobil,
          tipe_kendaraan: v.tipe_kendaraan || '',
          no_chassis: v.no_chassis,
          group_kendaraan: v.group_kendaraan || 'PC',
          no_pelanggan: v.no_pelanggan,
          id_pelanggan: v.id_pelanggan,
          tipe_pelanggan: v.tipe_pelanggan || 'PRIBADI',
          nama_pelanggan: v.nama_pelanggan,
          no_telp_pelanggan: v.no_telp || booking.noTelp,
          alamat_pelanggan: v.alamat || '-',
          atas_nama_booking: booking.namaCustomer,
          no_telp_booking: booking.noTelp,
          janji_datang: `${booking.tanggal}T${(booking.jam || '08.30').replace('.', ':')}`,
          keluhan: booking.keperluanService || '-',
          booking_via: 'WA CS Service',
          booking_via_personal: 'km',
          km: 0
        };

        const dmsRes = await fetch('/api/chery_dms?endpoint=booking-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dmsBookingPayload)
        });

        if (dmsRes.ok) {
          externalSuccess = true;
          console.log("Successfully posted booking to external Chery DMS");
        } else {
          console.warn("Failed to post booking to external DMS, proceeding with local approval");
        }
      }

      // 2. Update status to 'accepted' in Supabase local database
      const { error } = await db.update('booking', { 
        status: 'accepted',
        bookingVia: externalSuccess ? 'Web-Public (Synced DMS)' : 'Web-Public (Local Approved)'
      }, { eq: { id: booking.id } });

      if (error) throw error;

      Toastify({ 
        text: externalSuccess 
          ? `✅ Booking ${booking.noPlat} berhasil disetujui & disinkronkan ke DMS!`
          : `⚠️ Booking ${booking.noPlat} disetujui secara lokal (DMS tidak terupdate).`, 
        background: externalSuccess ? "#10b981" : "#f59e0b",
        duration: 5000
      }).showToast();

      setShowWarningModal(false);
      setSelectedBooking(null);
      fetchPendingBookings();
    } catch (e) {
      console.error("Approval Execution Error:", e);
      Toastify({ text: `Gagal memproses persetujuan: ${e.message}`, background: "#ef4444" }).showToast();
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Decline Booking Action with reason
  const handleDeclineBooking = async (booking) => {
    const reason = window.prompt(`Alasan menolak booking ${booking.noPlat} (kosongkan jika tanpa alasan):`, '');
    if (reason === null) return;
    
    try {
      const { error } = await db.update('booking', {
        status: 'declined',
        cancellation_reason: reason || 'Ditolak admin'
      }, { eq: { id: booking.id } });

      if (error) throw error;
      Toastify({ text: `Booking ${booking.noPlat} berhasil ditolak!`, background: "#3f3f46" }).showToast();
      fetchPendingBookings();
    } catch (e) {
      console.error("Decline Error:", e);
      Toastify({ text: `Gagal menolak booking: ${e.message}`, background: "#ef4444" }).showToast();
    }
  };

  // Open WhatsApp chat helper
  const handleOpenWhatsApp = (booking) => {
    const phone = booking.noTelp.startsWith('0') 
      ? '62' + booking.noTelp.slice(1) 
      : booking.noTelp.startsWith('+') 
        ? booking.noTelp.slice(1) 
        : booking.noTelp;
    
    const textWA = `Halo ${booking.namaCustomer}, terkait permohonan booking service Anda pada tanggal ${booking.tanggal} jam ${booking.jam} WIB untuk kendaraan ${booking.tipeMobil} (${booking.noPlat}). Mohon menunggu konfirmasi kami selanjutnya. Terima kasih.`;
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(textWA)}`, '_blank');
  };

  // Filtering
  const filteredBookings = pendingBookings.filter(b => {
    const query = searchQuery.toLowerCase();
    return (
      (b.namaCustomer || '').toLowerCase().includes(query) ||
      (b.noPlat || '').toLowerCase().includes(query) ||
      (b.tipeMobil || '').toLowerCase().includes(query) ||
      String(b.noUrut || b.id || '').toLowerCase().includes(query)
    );
  });

  const getDmsBadge = (noPlat) => {
    const cleanPlat = noPlat.toUpperCase().replace(/\s+/g, '');
    const dmsInfo = dmsDataMap[cleanPlat];
    const isChecking = checkingDmsMap[cleanPlat];

    if (isChecking) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 animate-pulse">
          <RefreshCw size={10} className="animate-spin text-zinc-500" />
          Checking DMS...
        </span>
      );
    }

    if (dmsInfo && dmsInfo.checked) {
      if (dmsInfo.found) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck size={11} className="text-emerald-500" />
            Ditemukan di DMS
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={11} className="text-amber-500" />
            Tidak Ada di DMS
          </span>
        );
      }
    }

    return (
      <button 
        onClick={() => checkDmsStatus(noPlat)} 
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-800 border border-zinc-200 hover:bg-zinc-900 hover:text-white transition-all"
      >
        <RefreshCw size={10} /> Check DMS
      </button>
    );
  };

  return (
    <div className="flex-1 w-full max-w-[100vw] bg-[#F8FAFC] relative overflow-hidden flex flex-col h-full p-4 md:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-zinc-200 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2.5 rounded-2xl text-white shadow-md">
            <ClipboardList size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight italic">Persetujuan Booking Public</h2>
            <p className="text-[10px] font-black uppercase text-zinc-400 mt-1 tracking-widest">Antrean Verifikasi Booking Customer</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Cari No. Booking, Plat, Nama..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black w-full md:w-56 text-zinc-900 shadow-sm"
            />
          </div>
          <button 
            onClick={fetchPendingBookings} 
            disabled={isLoading}
            className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Booking List Container */}
      <div className="flex-1 overflow-y-auto mt-6">
        {isLoading && pendingBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={36} className="animate-spin text-zinc-400" />
            <p className="text-sm font-bold text-zinc-400">Memuat data booking...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-zinc-200 border-dashed text-center p-6 shadow-sm">
            <ClipboardList size={48} className="text-zinc-300 mb-3" />
            <h3 className="font-black text-zinc-900 uppercase text-sm tracking-wide">Antrean Kosong</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">Saat ini tidak ada permohonan booking baru dari website public yang menunggu persetujuan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredBookings.map((booking) => {
              const cleanPlat = booking.noPlat.toUpperCase().replace(/\s+/g, '');
              const dmsInfo = dmsDataMap[cleanPlat];

              return (
                <div 
                  key={booking.id} 
                  className="bg-white rounded-3xl border border-zinc-200 p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Booking Header info */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Public Request ID: {booking.noUrut || booking.id}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <h4 className="font-mono text-base font-black text-zinc-900">{booking.noPlat}</h4>
                          <span className="text-xs font-bold text-zinc-500">• {booking.tipeMobil}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getDmsBadge(booking.noPlat)}
                      </div>
                    </div>

                    {/* Booking Detail Table grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100 mb-5 text-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <User size={13} className="text-zinc-400" />
                          <span className="font-bold text-zinc-800">{booking.namaCustomer}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Phone size={13} className="text-zinc-400" />
                          <span className="font-bold text-zinc-600">{booking.noTelp}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Calendar size={13} className="text-zinc-400" />
                          <span className="font-bold text-zinc-700">{booking.tanggal}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Clock size={13} className="text-zinc-400" />
                          <span className="font-bold text-zinc-700">{booking.jam} WIB</span>
                        </div>
                      </div>
                      
                      <div className="col-span-1 md:col-span-2 pt-2 border-t border-zinc-200/50 flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Keperluan Service:</span>
                        <div className="flex items-start gap-1 bg-white p-2.5 rounded-xl border border-zinc-150 text-zinc-700 font-medium leading-relaxed">
                          {booking.keperluanService || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Detailed DMS record lookup preview */}
                    {dmsInfo?.found && dmsInfo.vehicleData && (
                      <div className="mb-5 bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl text-xs space-y-2">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-black uppercase text-[9px] tracking-wider mb-2">
                          <ShieldCheck size={12} className="text-emerald-600" /> Data Kendaraan di DMS
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
                          <div><span className="text-zinc-400">Owner STNK:</span> <strong className="text-zinc-800 font-bold block">{dmsInfo.vehicleData.nama_pelanggan}</strong></div>
                          <div><span className="text-zinc-400">No Rangka:</span> <strong className="text-zinc-800 font-mono block">{dmsInfo.vehicleData.no_chassis}</strong></div>
                          <div><span className="text-zinc-400">No Mesin:</span> <strong className="text-zinc-800 font-mono block">{dmsInfo.vehicleData.no_engine}</strong></div>
                          <div><span className="text-zinc-400">Tipe DMS:</span> <strong className="text-zinc-800 font-bold block">{dmsInfo.vehicleData.tipe_kendaraan}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions area */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100">
                    <button 
                      onClick={() => handleOpenWhatsApp(booking)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-700 shadow-sm transition-all"
                    >
                      <Phone size={13} className="text-emerald-500" /> WhatsApp
                    </button>
                    <button 
                      onClick={() => handleDeclineBooking(booking)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-xl text-xs font-bold text-rose-700 transition-all ml-auto"
                    >
                      <XCircle size={13} /> Tolak Request
                    </button>
                    <button 
                      onClick={() => handleAcceptBooking(booking)}
                      disabled={checkingDmsMap[cleanPlat]}
                      className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                    >
                      <Check size={13} /> Setujui Booking (ACC)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WARNING POP-UP MODAL (WHEN VEHICLE IS NOT FOUND IN DMS) */}
      {showWarningModal && selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 overflow-hidden animate-modal-in">
            {/* Modal Warning Header */}
            <div className="bg-amber-500 text-white p-6 text-center">
              <AlertTriangle size={36} className="mx-auto mb-2 text-white" />
              <h3 className="font-black text-lg uppercase tracking-wide">Peringatan: Unit Belum Terdaftar</h3>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 text-center space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                <p className="text-amber-800 font-bold text-xs">⚠️ DETAIL KENDARAAN TIDAK DITEMUKAN DI DMS</p>
                <div className="mt-2 text-xs text-zinc-600 space-y-1">
                  <div><strong>Pelat BK:</strong> {selectedBooking.noPlat}</div>
                  <div><strong>Model Unit:</strong> {selectedBooking.tipeMobil}</div>
                  <div><strong>Customer:</strong> {selectedBooking.namaCustomer}</div>
                </div>
              </div>
              <p className="text-zinc-500 text-xs font-medium leading-relaxed">
                Kendaraan ini tidak ditemukan dalam database internal Chery DMS kita. Anda tetap dapat menyetujui booking ini ke dalam manajemen booking, tetapi mohon segera masukkan data kendaraan ini secara manual ke Chery DMS agar tidak terjadi error di kemudian hari.
              </p>
            </div>
            
            {/* Modal Actions */}
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3">
              <button 
                onClick={() => { setShowWarningModal(false); setSelectedBooking(null); }}
                className="flex-1 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider hover:bg-zinc-100 transition-all active:scale-95"
              >
                Batal
              </button>
              <button 
                onClick={() => handleAcceptBooking(selectedBooking, true)}
                disabled={isProcessingApproval}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:bg-zinc-400"
              >
                {isProcessingApproval ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Tetap Setujui (ACC)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
