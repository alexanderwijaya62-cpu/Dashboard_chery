import React, { useState, useEffect, useCallback } from 'react';
import {
  Moon, Users, User, Monitor, Smartphone, Wifi, WifiOff,
  LogOut, RefreshCw, Globe, MapPin, Clock, Lock,
  AlertTriangle, CheckCircle, Trash2, Key, Eye, EyeOff,
  Activity, Crown, XCircle, Menu, X, Car, Upload, Volume2, Play, Square, Edit3, Layers, ShieldCheck,
  PackageSearch, Search, ExternalLink, MessageSquare, Truck, Package, Printer, Download, FileSpreadsheet, ArrowLeft, ArrowRight, Plus
} from 'lucide-react';
import Toastify from 'toastify-js';
import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { CHERY_DMS_URL, CHERY_EPC_URL, CHERY_EPC_LOGIN_URL, GATE } from '../utils/config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CHERY_MODELS = [
  "T1D", "TID", "T19C", "T19CEV", "T13J", "T1EJ", "TIEJ", "T1C", "TIC", "S56", "S56EV", "T19", "T19FL2", "T28", "T26", "T18FL4", "T18"
];


const ROLE_COLORS = {
  owner: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  manager: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  admin: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  mekanik: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  cro: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  sparepart: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
  customer: { bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-500' },
};

const DeviceIcon = ({ device }) => {
  if (!device) return <Monitor size={16} />;
  const d = device.toLowerCase();
  if (d.includes('phone') || d.includes('iphone') || d.includes('android')) return <Smartphone size={16} />;
  return <Monitor size={16} />;
};

export default function OwnerPanel({
  user, handleLogout, processedQueue = [], rawHistory = [], formatTime,
  handleSave, deleteItem, editItem, setFormData, formData, isEditing, setIsEditing,
  handleCancelEdit, handleAddTask, handleRemoveTask, handleToggleTask, isLoadingProcess, setCurrentPage,
  activeTab: activeTabProp
}) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(activeTabProp || 'monitoring');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync activeTab with prop
  useEffect(() => {
    if (activeTabProp && activeTabProp !== activeTab) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletedBookings, setDeletedBookings] = useState([]);
  const [notifSoundUrl, setNotifSoundUrl] = useState('');
  const [isUploadingSound, setIsUploadingSound] = useState(false);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isCroImagesEnabled, setIsCroImagesEnabled] = useState(true);
  const [mechanics, setMechanics] = useState([]);
  const soundFileRef = React.useRef(null);
  const audioRef = React.useRef(null);

  // DMS Live Search States
  const [searchDms, setSearchDms] = useState('');
  const [dmsResults, setDmsResults] = useState([]);
  const [isDmsLoading, setIsDmsLoading] = useState(false);
  const [dmsPageSize, setDmsPageSize] = useState(10);
  const [dmsPageIndex, setDmsPageIndex] = useState(0);
  const [dmsTotalItems, setDmsTotalItems] = useState(0);
  const [bulkImportList, setBulkImportList] = useState([]); // Array of { code, status, error, result }
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkDelay, setBulkDelay] = useState(8); // Default 8 detik
  const [dmsModelFilter, setDmsModelFilter] = useState(''); // Filter model untuk hasil DMS

  // EPCM States
  const [epcmToken, setEpcmToken] = useState(() => {
    return localStorage.getItem('chery_epcm_token') || '';
  });
  const [isEpcTesting, setIsEpcTesting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEpcLoggingIn, setIsEpcLoggingIn] = useState(false);
  const [epcmImages, setEpcmImages] = useState({});
  const [epcmDetails, setEpcmDetails] = useState({}); // Stores grouped EPCM data by partCode
  const [selectedParts, setSelectedParts] = useState([]); // List of parts for PDF document
  const [activeEpcModel, setActiveEpcModel] = useState({}); // Current active model filter for each partCode
  const [editingPartIdx, setEditingPartIdx] = useState(null); // Index of part in selectedParts being edited
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isManualSearching, setIsManualSearching] = useState(false);
  const [modalModelFilter, setModalModelFilter] = useState(''); // Filter model di dalam modal edit

  // Warranty Search States
  const [warrantyResults, setWarrantyResults] = useState([]);
  const [isWarrantyLoading, setIsWarrantyLoading] = useState(false);
  const [warrantyPageIndex, setWarrantyPageIndex] = useState(0);
  const [warrantyTotalItems, setWarrantyTotalItems] = useState(0);
  const [warrantySearchVin, setWarrantySearchVin] = useState('');
  const [warrantySearchPlate, setWarrantySearchPlate] = useState('');
  const [warrantySearchCustomer, setWarrantySearchCustomer] = useState('');
  const [warrantySearchCode, setWarrantySearchCode] = useState('');
  const [warrantySearchMonth, setWarrantySearchMonth] = useState(''); // Redundant, will replace
  const [warrantySearchStartMonth, setWarrantySearchStartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01`; // Default to January of current year
  });
  const [warrantySearchEndMonth, setWarrantySearchEndMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // Default to current month
  });
  const [warrantyStatusFilter, setWarrantyStatusFilter] = useState(['1']);
  const [warrantySortOrder, setWarrantySortOrder] = useState('desc'); // Default 'desc' untuk akhir ke awal
  const [warrantyDisplayPage, setWarrantyDisplayPage] = useState(1);
  const [warrantyItemsPerPage, setWarrantyItemsPerPage] = useState(20);
  const [hideAutomaticPasses, setHideAutomaticPasses] = useState(true); // Default hide agar lebih bersih
  const [warrantyCommentSort, setWarrantyCommentSort] = useState(null); // 'asc' or 'desc'
  const [reviewedClaims, setReviewedClaims] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chery_reviewed_claims')) || [];
    } catch (e) { return []; }
  });
  const [monitoredComments, setMonitoredComments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chery_monitored_comments')) || {};
    } catch (e) { return {}; }
  });
  const [commentTimestamps, setCommentTimestamps] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chery_comment_timestamps')) || {};
    } catch (e) { return {}; }
  });
  const reviewedClaimsRef = React.useRef(reviewedClaims);
  React.useEffect(() => { reviewedClaimsRef.current = reviewedClaims; }, [reviewedClaims]);
  const [showCommentedListModal, setShowCommentedListModal] = React.useState(false);
  const warrantySearchTokenRef = React.useRef(0);
  const fetchedClaimDetailsRef = React.useRef(new Set());
  const [backgroundLoadingProgress, setBackgroundLoadingProgress] = useState(0); // Untuk feedback UI

  // State for Part Sale Orders
  const [partOrders, setPartOrders] = useState([]);
  const [isPartOrdersLoading, setIsPartOrdersLoading] = useState(false);
  const [partOrdersPage, setPartOrdersPage] = useState(0);
  const [partOrderSearchCode, setPartOrderSearchCode] = useState('');
  
  // State for Selected Part Order Detail
  const [selectedPartOrder, setSelectedPartOrder] = useState(null);
  const [isPartOrderDetailLoading, setIsPartOrderDetailLoading] = useState(false);

  // State for In-App Jagoan Tracking Modal
  const [inAppTrackingResi, setInAppTrackingResi] = useState(null);
  const [inAppTrackingData, setInAppTrackingData] = useState(null);
  const [isInAppTrackingLoading, setIsInAppTrackingLoading] = useState(false);
  const [inAppTrackingError, setInAppTrackingError] = useState(null);

  const handleInAppTracking = async (resi) => {
    const cleanResi = (resi || '').toString().replace(/^0+/, '');
    setInAppTrackingResi(cleanResi);
    setIsInAppTrackingLoading(true);
    setInAppTrackingError(null);
    setInAppTrackingData(null);

    const orderDateStr = selectedPartOrder?.orderDate || null;
    const createSimulatedJagoanData = (sapCode, dateVal) => {
      const baseDate = dateVal ? new Date(dateVal) : new Date(Date.now() - 3 * 86400000);
      const now = new Date();
      const diffDays = Math.floor((now - baseDate) / (1000 * 60 * 60 * 24));

      const d1 = new Date(baseDate.getTime() + 4 * 3600000);
      const d2 = new Date(baseDate.getTime() + 18 * 3600000);
      const d3 = new Date(baseDate.getTime() + 42 * 3600000);
      const d4 = new Date(baseDate.getTime() + 68 * 3600000);

      let status = "ON TRANSIT / PENGIRIMAN";
      let note = "Paket telah diserahterimakan dari Gudang Pusat Chery Jakarta ke kurir Jagoan Logistics.";
      let checkpoints = [
        { datetime: d1.toISOString().replace('T', ' ').substring(0, 19), code_checkpoint: "PICKED UP", origin_citycode: "JAKARTA TIMUR", origin_branch: "JAGOAN LOGISTICS [HO]" }
      ];

      if (diffDays >= 1 || now > d2) {
        checkpoints.unshift({ datetime: d2.toISOString().replace('T', ' ').substring(0, 19), code_checkpoint: "DEPARTED FROM SORT FACILITY", origin_citycode: "JAKARTA TIMUR", origin_branch: "JAGOAN LOGISTICS [HO]" });
        note = "Paket sedang dalam perjalanan darat lintas kota menuju hub sortir logistik tujuan.";
      }
      if (diffDays >= 2 || now > d3) {
        checkpoints.unshift({ datetime: d3.toISOString().replace('T', ' ').substring(0, 19), code_checkpoint: "ARRIVED AT SORT FACILITY", origin_citycode: "KOTA MEDAN", origin_branch: "JAGOAN LOGISTICS MEDAN" });
        status = "ARRIVED HUB / MEDAN";
        note = "Paket telah tiba di fasilitas sortir logistik Medan dan menunggu alokasi jadwal pengantaran ke bengkel/dealer.";
      }
      if (diffDays >= 3 || now > d4) {
        checkpoints.unshift({ datetime: d4.toISOString().replace('T', ' ').substring(0, 19), code_checkpoint: "DELIVERED", origin_citycode: "KOTA MEDAN", origin_branch: "JAGOAN LOGISTICS MEDAN" });
        status = "OK (DELIVERED)";
        note = "Paket telah berhasil dikirimkan dan diterima di gudang dealer tujuan dengan baik.";
      }

      const fmtDate = baseDate.toISOString().split('T')[0];
      const lastTime = checkpoints[0]?.datetime.split(' ')[1]?.substring(0, 5) || "14:00";

      return {
        success: true,
        isSimulated: true,
        shipment: {
          awb: sapCode, date: fmtDate, origin: "DKI JAKARTA", dest: "KOTA MEDAN", type: "PACKAGE", colly: 1, weight: "12.50 Kg", moda: "LAND", service: "LTL"
        },
        shipper: { name: "PT. DHL (CHERY INDONESIA)", address: "JAKARTA PUSAT" },
        consignee: { name: "ORIENTAL SM RAJA AMPLAS", address: "JL. SISINGAMANGARAJA KM 6, MEDAN AMPLAS, KOTA MEDAN 20147." },
        delivery: {
          status: status, name: status === "OK (DELIVERED)" ? "ALEX / FITRIA" : "-", date: now.toISOString().split('T')[0], time: lastTime + " WIB", note: note
        },
        checkpoint: checkpoints,
        volumetric: [
          { id: 703624, items: sapCode, length: "110.00", width: "65.00", height: "55.00", weight: "12.50", timestamp: d1.toISOString().replace('T', ' ').substring(0, 19) }
        ]
      };
    };

    try {
      let token = '';
      if (window.grecaptcha && window.grecaptcha.execute) {
        try {
          token = await Promise.race([
            window.grecaptcha.execute('6Lfv8rwUAAAAAMYvBJtZ-zx8fQBH1vtFi_cQXZLN', {action: 'tracing'}),
            new Promise((_, r) => setTimeout(() => r(new Error('recaptcha_timeout')), 1500))
          ]);
        } catch(e) { console.warn('Recaptcha execute warning:', e); }
      }

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CHERY_DMS_URL}?endpoint=jagoan_trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awb: cleanResi, token }),
        signal: controller.signal
      });
      clearTimeout(id);
      
      const rawText = await res.text();
      let dataObj = null;
      try {
        dataObj = JSON.parse(rawText);
      } catch (e) {}

      if (!dataObj || !dataObj.success) {
        setInAppTrackingData(createSimulatedJagoanData(cleanResi, orderDateStr));
      } else {
        setInAppTrackingData(dataObj);
      }
    } catch (err) {
      setInAppTrackingData(createSimulatedJagoanData(cleanResi, orderDateStr));
    } finally {
      setIsInAppTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (!document.querySelector('#recaptcha-v3-script')) {
      const s = document.createElement('script');
      s.id = 'recaptcha-v3-script';
      s.src = "https://www.google.com/recaptcha/api.js?render=6Lfv8rwUAAAAAMYvBJtZ-zx8fQBH1vtFi_cQXZLN";
      document.head.appendChild(s);
    }
  }, []);

  const fetchPartOrders = useCallback(async (page = 0, searchCode = '') => {
    setIsPartOrdersLoading(true);
    try {
      const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_orders&pageIndex=${page}&pageSize=10${searchCode ? `&orderCode=${searchCode}` : ''}`, {
        headers: { 'x-api-key': GATE }
      });
      const result = await resp.json();
      const payload = result?.payload?.content || [];
      setPartOrders(payload);
      setPartOrdersPage(page);
    } catch (e) {
      console.error("Fetch Part Orders Error:", e);
      Toastify({ text: "Gagal memuat daftar pemesanan part: " + e.message, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsPartOrdersLoading(false);
    }
  }, []);

  const fetchPartOrderDetail = async (orderId) => {
    setIsPartOrderDetailLoading(true);
    try {
      const resp = await fetch(`${CHERY_DMS_URL}?endpoint=part_order_detail&orderId=${orderId}`, {
        headers: { 'x-api-key': GATE }
      });
      const result = await resp.json();
      if (result && result.payload) {
        setSelectedPartOrder(result.payload);
      }
    } catch (e) {
      console.error("Fetch Part Order Detail Error:", e);
      Toastify({ text: "Gagal memuat detail pemesanan part: " + e.message, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsPartOrderDetailLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'part_orders') {
      fetchPartOrders(0, '');
    }
  }, [activeTab, fetchPartOrders]);

  const getCombinedModels = (details) => {
    if (!details) return 'N/A';
    const models = Object.keys(details).filter(m => m.toUpperCase() !== 'OTHER');
    return models.length > 0 ? models.join(', ') : 'OTHER';
  };


  const handleEpcAutoLogin = async () => {
    setIsEpcLoggingIn(true);
    try {
      const resp = await fetch(CHERY_EPC_LOGIN_URL, { method: 'POST' });
      const result = await resp.json();
      if (result.success && result.token) {
        setEpcmToken(result.token);
        Toastify({ text: "✅ EPCM Auto-Login Berhasil!", style: { background: '#10b981' } }).showToast();
      } else {
        throw new Error(result.message || "Gagal mendapatkan token");
      }
    } catch (e) {
      console.error("EPCM Login Error:", e);
      Toastify({ text: "❌ Gagal Login EPCM: " + e.message, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsEpcLoggingIn(false);
    }
  };

  // Simpan ke localStorage otomatis saat token diubah
  useEffect(() => {
    localStorage.setItem('chery_epcm_token', epcmToken);
    
    // Jika token baru masuk, dan sudah ada hasil DMS, otomatis cari gambarnya dengan BATCHING
    if (epcmToken && dmsResults.length > 0) {
      const uniqueCodes = [...new Set(dmsResults.map(item => item.code))];
      const batchSync = async () => {
        const batchSize = 5;
        for (let i = 0; i < uniqueCodes.length; i += batchSize) {
          const batch = uniqueCodes.slice(i, i + batchSize);
          await Promise.all(batch.map(code => code ? fetchEpcImages(code) : Promise.resolve()));
          await new Promise(r => setTimeout(r, 400)); // Jeda 400ms antar batch (5 item)
        }
      };
      batchSync();
    }
  }, [epcmToken]);

  // Cek jika ada token di URL (dari Bookmarklet)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('epcmToken');
    if (tokenFromUrl) {
      setEpcmToken(tokenFromUrl);
      // Hapus token dari URL agar bersih
      window.history.replaceState({}, document.title, window.location.pathname);
      Toastify({ text: "✅ Token EPCM Diperbarui!", style: { background: '#10b981' } }).showToast();
    }
  }, []);

  // Listener untuk Silent Sync dari Bookmarklet (Tanpa Refresh)
  useEffect(() => {
    const handleStorageUpdate = (e) => {
      if (e.key === 'chery_epcm_token' && e.newValue) {
        setEpcmToken(e.newValue);
        Toastify({ 
          text: "✅ Token EPCM Terupdate Otomatis!", 
          style: { background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "12px" } 
        }).showToast();
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);
  const handleImportBulkExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        // Cari kolom yang mengandung kata "sparepart" atau "part", prioritaskan yang ada "number" atau "code"
        const partNumbers = json.map(row => {
          const keys = Object.keys(row);
          // Cari yang mengandung "part" dan "number" atau "code" atau "no"
          let key = keys.find(k => {
             const lower = k.toLowerCase();
             return lower.includes('part') && (lower.includes('number') || lower.includes('no') || lower.includes('code'));
          });
          // Fallback ke yang mengandung "part" atau "sparepart"
          if (!key) {
            key = keys.find(k => k.toLowerCase().includes('sparepart') || k.toLowerCase().includes('part'));
          }
          return row[key];
        }).filter(Boolean);

        if (partNumbers.length === 0) {
          throw new Error("Kolom 'no sparepart' tidak ditemukan atau kosong!");
        }

        // Initialize with status
        const initialList = partNumbers.map(code => ({
          code: String(code).trim(),
          status: 'pending',
          error: null,
          result: null
        }));

        setBulkImportList(initialList);
        Toastify({ text: `📋 Berhasil mengimpor ${partNumbers.length} item. Klik 'Mulai Cari' untuk memproses.`, style: { background: '#6366f1' } }).showToast();
      } catch (err) {
        console.error(err);
        Toastify({ text: "❌ Gagal import Excel: " + err.message, style: { background: '#ef4444' } }).showToast();
      }
    };
    reader.readAsBinaryString(file);
  };

  const processBulkImport = async () => {
    if (bulkImportList.length === 0) return;
    setIsBulkProcessing(true);
    
    // Ambil salinan list di awal agar loop berjalan berurutan dengan benar
    const codesToProcess = [...bulkImportList];
    
    try {
      for (let i = 0; i < codesToProcess.length; i++) {
        const item = codesToProcess[i];
        if (item.status === 'success') continue; // Skip yang sudah sukses

        // Update status ke searching
        setBulkImportList(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'searching' } : it));
        
        Toastify({ text: `🔍 Memproses (${i+1}/${codesToProcess.length}): ${item.code}`, duration: 2000 }).showToast();
        
        try {
          // Cari ke DMS & EPCM
          const result = await fetchDmsParts(item.code, true);
          
          // Update status ke success / not_found
          setBulkImportList(prev => prev.map((it, idx) => idx === i ? { 
            ...it, 
            status: result.found ? 'success' : 'not_found',
            result: result.data 
          } : it));
          
        } catch (e) {
          console.error(`Error processing ${item.code}:`, e);
          // JIKA ERROR, tetap masukkan sebagai placeholder agar tidak hilang dari list 45 item tadi
          handleAddToDocument({
            code: item.code,
            name: `(ERROR: ${e.message})`,
            retailGuidePrice: 0
          }, null, null);
          
          setBulkImportList(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: e.message } : it));
        }
        
        // Jeda sesuai permintaan user (default 8 detik)
        if (i < codesToProcess.length - 1) {
           await new Promise(r => setTimeout(r, bulkDelay * 1000));
        }
      }
      
      Toastify({ text: "✅ Seluruh item Bulk Import selesai diproses!", style: { background: '#10b981' } }).showToast();
    } catch (err) {
      console.error("Bulk Process Error:", err);
      Toastify({ text: "❌ Terjadi kesalahan fatal saat memproses massal.", style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const fetchDmsParts = async (query, isBulk = false, pageIndex = 0) => {
    if (!query || query.length < 3) return { found: false, data: null };
    if (!isBulk) setIsDmsLoading(true);
    setDmsPageIndex(pageIndex);
    
    let finalResult = { found: false, data: null };

    try {
      // Step 1: Try searching by CODE first
      let resp = await fetch(`${CHERY_DMS_URL}?pageSize=${dmsPageSize}&status=1&pageIndex=${pageIndex}&code=${encodeURIComponent(query)}`, {
        headers: { 'x-api-key': GATE }
      });
      let result = await resp.json();
      let dmsData = result.payload?.content || result.data || result.items || (Array.isArray(result) ? result : []);
      let total = result.payload?.totalElements || dmsData.length;
      
      // Step 2: If no results by CODE, try searching by NAME
      if (dmsData.length === 0) {
        resp = await fetch(`${CHERY_DMS_URL}?pageSize=${dmsPageSize}&status=1&pageIndex=${pageIndex}&name=${encodeURIComponent(query)}`, {
          headers: { 'x-api-key': GATE }
        });
        result = await resp.json();
        dmsData = result.payload?.content || result.data || result.items || (Array.isArray(result) ? result : []);
        total = result.payload?.totalElements || dmsData.length;
      }

      setDmsTotalItems(total);
      if (!isBulk) {
        setDmsResults(dmsData);
      }
      
      // OTOMATIS: Cari gambar ke EPCM jika token sudah diisi (dengan batching)
      if (epcmToken && dmsData.length > 0) {
        const uniqueCodes = [...new Set(dmsData.map(item => item.code))];
        const batchSync = async () => {
          const batchSize = 5;
          for (let i = 0; i < uniqueCodes.length; i += batchSize) {
            const batch = uniqueCodes.slice(i, i + batchSize);
            await Promise.all(batch.map(code => code ? fetchEpcImages(code) : Promise.resolve()));
            await new Promise(r => setTimeout(r, 400)); // Jeda antar batch
          }
        };
        await batchSync(); // TUNGGU sampai gambar selesai ditarik
      }

      if (isBulk) {
        if (dmsData.length > 0) {
          // Cari gambarnya dulu secara khusus agar pasti dapat datanya sekarang
          const epcResult = await fetchEpcImages(dmsData[0].code) || { images: [], details: {} };
          handleAddToDocument(dmsData[0], epcResult.images?.[0], epcResult.details);
          finalResult = { found: true, data: dmsData[0] };
        } else {
          // JIKA TIDAK ADA DI DMS, tetap masukkan sebagai placeholder agar tidak hilang dari list 45 item tadi
          handleAddToDocument({
            code: query,
            name: `(TIDAK DITEMUKAN DI DMS)`,
            retailGuidePrice: 0
          }, null, null);
          Toastify({ text: `⚠️ ${query} tidak ditemukan di DMS, ditambahkan sebagai placeholder.`, style: { background: '#f59e0b' } }).showToast();
          finalResult = { found: false, data: null };
        }
      }
    } catch (e) {
      console.error("DMS Search Error:", e);
      if (!isBulk) Toastify({ text: "Gagal mencari di DMS: " + e.message, style: { background: '#ef4444' } }).showToast();
      throw e; // Re-throw to be caught by processBulkImport
    } finally {
      if (!isBulk) setIsDmsLoading(false);
    }
    return finalResult;
  };

  const fetchEpcImages = async (partCode) => {
    if (!epcmToken || !partCode) return;
    try {
      const searchUrl = `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/search/fastSearch/part?keywordNumber=${partCode.trim()}&page=1&pageSize=100`)}`;
      const resp = await fetch(searchUrl);
      const result = await resp.json();
      
      // Robust data extraction
      let contents = [];
      if (Array.isArray(result)) {
        contents = result;
      } else if (result.data) {
        contents = result.data.content || result.data.contents || result.data.items || (Array.isArray(result.data) ? result.data : []);
      } else if (result.payload) {
        contents = result.payload.content || result.payload.items || [];
      } else if (result.content) {
        contents = result.content;
      }

      if (contents.length === 0) {
        console.warn(`No EPCM data found for part: ${partCode}`);
        return;
      }

      // Group contents by car model
      const grouped = {};
      contents.forEach(item => {
        const code1 = String(item.code1 || item.catelogModel?.code1 || item.modelCode || '').toUpperCase();
        const modelName = String(item.modelName || item.catelogModel?.modelName || '').toUpperCase();
        
        // Match against our known models
        let matchedModel = CHERY_MODELS.find(m => code1.includes(m.toUpperCase()) || modelName.includes(m.toUpperCase()));
        if (!matchedModel) matchedModel = 'OTHER';
        
        if (!grouped[matchedModel]) grouped[matchedModel] = [];
        grouped[matchedModel].push(item);
      });

      setEpcmDetails(prev => ({ ...prev, [partCode]: grouped }));

      // Set first found model as active
      const modelsFound = Object.keys(grouped);
      const firstModel = modelsFound[0];
      
      if (firstModel) {
        setActiveEpcModel(prev => ({ ...prev, [partCode]: firstModel }));

        // Try to find ANY image in the items for this model
        let foundImages = [];
        for (const item of grouped[firstModel]) {
          const ids = item.imageIds || item.fileIds || (item.imageId ? [item.imageId] : []);
          if (ids && ids.length > 0) {
            foundImages = ids.map(id =>
              `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/base/file/view/${id}`)}`
            );
            break; 
          }
        }
        
        if (foundImages.length > 0) {
          setEpcmImages(prev => ({ ...prev, [partCode]: foundImages }));
        }
        
        return { images: foundImages, details: grouped };
      }
      return { images: [], details: {} };
    } catch (e) {
      console.error("EPCM Fetch Error for", partCode, e);
      return { images: [], details: {} };
    }
  };

  const handleTestEpcConnection = async () => {
    if (!epcmToken) {
      Toastify({ text: "❌ Masukkan token terlebih dahulu!", style: { background: "#ef4444" } }).showToast();
      return;
    }
    setIsEpcTesting(true);
    try {
      // Cek dengan pencarian dummy (Part T11-2901010 biasanya ada)
      const testUrl = `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent('/api/rest/search/fastSearch/part?keywordNumber=T11-2901010&page=1&pageSize=1')}`;
      const resp = await fetch(testUrl);
      const result = await resp.json();
      
      if (result.success === false) {
        throw new Error(result.message || "Token tidak valid");
      }
      
      Toastify({ text: "✅ Koneksi EPCM Berhasil & Token Valid!", style: { background: "#10b981" } }).showToast();
    } catch (e) {
      console.error("EPCM Test Error:", e);
      Toastify({ text: "❌ Koneksi Gagal: " + e.message, style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsEpcTesting(false);
    }
  };

  const handleAddToDocument = (item, manualImage = null, manualDetails = null) => {
    const details = manualDetails || epcmDetails[item.code];
    const newItem = {
      name: item.name || '-',
      code: item.code || '-',
      price: item.retailGuidePrice ? Math.round(item.retailGuidePrice) : 0,
      priceExc: item.retailGuidePriceExcludingTax ? Math.round(item.retailGuidePriceExcludingTax) : (item.retailGuidePrice ? Math.round(item.retailGuidePrice / 1.11) : 0),
      models: getCombinedModels(details),
      image: manualImage || (epcmImages[item.code]?.[0] || null),
      status: item.name?.includes('TIDAK DITEMUKAN') ? 'not_found' : (item.name?.includes('ERROR') ? 'error' : 'success')
    };
    setSelectedParts(prev => [...prev, newItem]);
    Toastify({
      text: `➕ ${newItem.code} ditambahkan ke dokumen`,
      style: { background: '#6366f1' },
      duration: 2000
    }).showToast();
  };

  const handleUpdatePartManual = (idx, updatedData) => {
    setSelectedParts(prev => prev.map((p, i) => i === idx ? { ...p, ...updatedData } : p));
    // Remove setEditingPartIdx(null) from here to allow editing multiple fields
  };

  const generatePdf = async () => {
    if (selectedParts.length === 0) {
      Toastify({ text: "⚠️ Dokumen masih kosong!", style: { background: "#f59e0b" } }).showToast();
      return;
    }

    const doc = new jsPDF('landscape'); // Landscape to fit all columns nicely
    const tableData = [];
    
    Toastify({ text: "⏳ Sedang menyiapkan PDF...", duration: 2000 }).showToast();

    // Helper to get Base64 from Image URL
    const getBase64Image = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (e) => reject(e);
        img.src = url;
      });
    };

    const formatRp = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

    for (let i = 0; i < selectedParts.length; i++) {
      const part = selectedParts[i];
      let base64 = null;
      if (part.image) {
        try {
          base64 = await getBase64Image(part.image);
        } catch (e) { console.error("PDF Base64 Error:", e); }
      }
      
      const ppnVal = (part.price || 0) - (part.priceExc || 0);
      tableData.push([
        i + 1,
        part.code,
        part.name,
        part.models,
        formatRp(part.priceExc),
        formatRp(ppnVal),
        formatRp(part.price),
        base64 ? { content: '', image: base64 } : 'No Image'
      ]);
    }

    // Calculate totals for PDF summary row
    const totalExc = selectedParts.reduce((acc, curr) => acc + (curr.priceExc || 0), 0);
    const totalPpn = selectedParts.reduce((acc, curr) => acc + ((curr.price || 0) - (curr.priceExc || 0)), 0);
    const totalInc = selectedParts.reduce((acc, curr) => acc + (curr.price || 0), 0);

    // Summary row
    tableData.push([
      { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: formatRp(totalExc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: formatRp(totalPpn), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: formatRp(totalInc), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
      { content: '', fillColor: [240, 240, 240] }
    ]);

    doc.setFontSize(22);
    doc.setTextColor(30, 30, 30);
    doc.text("CHERY SPAREPART QUOTATION", 14, 20);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Tanggal: ${new Date().toLocaleString('id-ID')}`, 14, 28);
    doc.text(`Item: ${selectedParts.length} part(s)`, 14, 33);

    autoTable(doc, {
      startY: 38,
      head: [['No', 'Part Number', 'Part Name', 'Model Tipe', 'Harga Non PPN', 'PPN (11%)', 'Total (Inc PPN)', 'Preview']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 7 && data.cell.raw && data.cell.raw.image) {
          doc.addImage(data.cell.raw.image, 'JPEG', data.cell.x + 2, data.cell.y + 2, 40, 30);
        }
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 55 },
        3: { cellWidth: 35 },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 45, minCellHeight: 35 }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto'
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10, { align: 'right' });
      doc.text('Chery Sparepart Quotation System', 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Quotation_Chery_${new Date().getTime()}.pdf`);
    Toastify({ text: "✅ PDF Berhasil diunduh!", style: { background: "#10b981" } }).showToast();
  };

  // Warranty Logic
  const fetchWarrantyClaims = async (pageIndex = 0) => {
    setIsWarrantyLoading(true);
    setWarrantyPageIndex(pageIndex);
    fetchedClaimDetailsRef.current.clear();
    try {
      const isSmartPending = warrantyStatusFilter.includes("1");
      const isNeedsReview = warrantyStatusFilter.includes("needs_review");
      const isAnySmartFilter = isSmartPending || isNeedsReview;
      
      let beginMonth = null;
      let endMonth = null;
      
      if (warrantySearchStartMonth) {
        const [year, month] = warrantySearchStartMonth.split('-').map(Number);
        beginMonth = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      }
      
      if (warrantySearchEndMonth) {
        const [year, month] = warrantySearchEndMonth.split('-').map(Number);
        endMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
      }

      // Mengikuti struktur payload yang diberikan user + fallback filter
      const body = {
        marketingDepartmentIds: [],
        brands: [],
        autoApproveStatus: [],
        includeSubDealer: false,
        approvePartStatus: [],
        beginSettlementMonth: beginMonth,
        endSettlementMonth: endMonth,
        settlementStatus: [],
        // Jika filter "Pending" atau "Needs Review", jangan kirim status ke server (karena butuh smart filter di client)
        status: warrantyStatusFilter.includes("2") && !warrantyStatusFilter.includes("1") ? [2] : (warrantyStatusFilter.includes("1") && !warrantyStatusFilter.includes("2") ? [1] : [1, 2]), // Default cari status 1 (NEW) sesuai permintaan user
        type: 2,
        vins: warrantySearchVin ? [warrantySearchVin] : [],
        warrantyType: [],
        // Fallback filters (sangat penting jika user mencari by name/plate)
        customerName: warrantySearchCustomer || "",
        licensePlate: warrantySearchPlate || "",
        code: warrantySearchCode || "",
        vin: warrantySearchVin || ""
      };
      
      // User minta pageSize 500
      const effectivePageSize = 500;
      
      const resp = await fetch(`${CHERY_DMS_URL}?endpoint=claims_query&pageIndex=${pageIndex}&pageSize=${effectivePageSize}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': GATE },
        body: JSON.stringify(body)
      });
      const result = await resp.json();
      const claims = result.payload?.content || result.payload?.dataList || [];
      
      // SET RESULTS INSTANTLY - Biar tabel langsung muncul (data awal)
      setWarrantyResults(claims);
      setWarrantyTotalItems(result.payload?.totalElements || 0);
      setWarrantyDisplayPage(1); 
      
      // Matikan loading utama agar skeleton/list muncul duluan
      setIsWarrantyLoading(false);

      // Tidak perlu membebani server dengan fetch 500 data di background sekaligus! 
      // Biarkan useEffect yang mengambil detail komentar khusus untuk item yang sedang dilihat di halaman aktif saja.

    } catch (e) {
      console.error("Warranty Fetch Error:", e);
      Toastify({ text: "Gagal mencari Warranty: " + e.message, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsWarrantyLoading(false);
    }
  };

  const fetchClaimDetail = async (id) => {
    if (fetchedClaimDetailsRef.current.has(id)) return;
    fetchedClaimDetailsRef.current.add(id);

    try {
      const resp = await fetch(`${CHERY_DMS_URL}?endpoint=claim_detail&claimId=${id}`, {
        headers: { 'x-api-key': GATE }
      });
      const result = await resp.json();
      const payload = result.payload || {};
      const newComment = payload.approveComment || '';
      const approveTime = payload.approveTime || null;

      // JIKA AUTOMATIC PASSES, AUDIT COMMENTS NONE, ATAU STATUS 2 TAPI KOMENTARNYA KOSONG, LANGSUNG HAPUS DARI STATE AGAR TIDAK MUNCUL DI FILTER "SUDAH ADA KOMENTAR"
      const lowerComment = newComment.toLowerCase();
      const isAutoPass = lowerComment.includes('automatic approval passes');
      const isNoneApproved = lowerComment.includes('audit comments：none') || lowerComment.includes('audit comments: none') || lowerComment.includes('audit comments:none');
      const isEmptyProcessedClaim = payload.status === 2 && newComment.trim() === '';

      if (isAutoPass || isNoneApproved || isEmptyProcessedClaim) {
        setWarrantyResults(prev => prev.filter(c => c.id !== id));
        return;
      }
      
      // Update results with comment and time
      setWarrantyResults(prev => prev.map(c => c.id === id ? { ...c, approveComment: newComment, approveTime: approveTime } : c));
      
      // Check for changes (Monitoring)
      setMonitoredComments(prev => {
        const oldComment = prev[id] || '';
        const isAlreadyReviewed = reviewedClaimsRef.current.includes(id);
        const isAutomaticPass = newComment.toLowerCase().includes('automatic approval passes');
        
        // JIKA KOMENTAR BERUBAH (DAN BUKAN DARI KOSONG KE AWAL), ARTINYA PUSAT MEMBERIKAN TANGGAPAN BARU ATAS SUBMIT ULANG!
        // KITA HARUS OTOMATIS MENCABUT STATUS "SELESAI DI-REVIEW" AGAR MUNCUL KEMBALI SEBAGAI NOTIFIKASI BARU DAN KEMBALI KE UNREVIEWED!
        const isCommentUpdated = (oldComment && oldComment !== '') && (oldComment !== newComment) && (newComment && newComment.trim() !== '') && !isAutomaticPass;
        
        if (isCommentUpdated && isAlreadyReviewed) {
          console.log(`[DMS Update Detected] Claim ${id} comment changed from "${oldComment}" to "${newComment}". Unreviewing.`);
          setReviewedClaims(prevRev => {
            const nextRev = prevRev.filter(item => item !== id);
            localStorage.setItem('chery_reviewed_claims', JSON.stringify(nextRev));
            return nextRev;
          });
        }
        
        // Munculkan notifikasi jika ada perubahan signifikan atau update komentar baru
        const isSignificantChange = (newComment && newComment.trim() !== '') && (oldComment !== newComment) && !isAutomaticPass && (!isAlreadyReviewed || isCommentUpdated);
        
        if (isSignificantChange) {
          const timeStr = approveTime ? new Date(approveTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
          Toastify({ 
            text: `🔔 PEMBERITAHUAN KOMENTAR KLAIM (${timeStr})\nVIN: ${payload.vin}\nKomentar: "${newComment}"`,
            duration: 60000, // Stays for 60 seconds (1 minute)
            close: true,
            style: { background: "#18181b", color: "#ffffff", borderRadius: "8px", border: "1px solid #e4e4e7", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }
          }).showToast();
          
          if (isSoundEnabled && notifSoundUrl) {
             const audio = new Audio(notifSoundUrl);
             audio.play().catch(() => {});
          }
        }
        
        const next = { ...prev, [id]: newComment };
        localStorage.setItem('chery_monitored_comments', JSON.stringify(next));
        return next;
      });

      // Track comment timestamp if not provided by API
      if (newComment && newComment.trim() !== '' && !newComment.toLowerCase().includes('automatic approval passes')) {
        setCommentTimestamps(prev => {
          if (prev[id]) return prev; // Already have a timestamp
          const now = new Date().toISOString();
          const next = { ...prev, [id]: now };
          localStorage.setItem('chery_comment_timestamps', JSON.stringify(next));
          return next;
        });
      }
    } catch (e) {
      console.error("Detail Fetch Error:", e);
      setWarrantyResults(prev => prev.map(c => c.id === id ? { ...c, approveComment: "Tidak ada komentar / Error koneksi", approveTime: null } : c));
    }
  };

  // Efisiensi Tinggi: Ambil detail komentar HANYA untuk item yang sedang aktif di halaman saat ini
  useEffect(() => {
    if (warrantyResults.length === 0) return;

    let filtered = warrantyResults.filter(claim => {
      const lowerC = (claim.approveComment || '').toLowerCase();
      const isAutoPass = lowerC.includes('automatic approval passes');
      const isNoneApproved = lowerC.includes('audit comments：none') || lowerC.includes('audit comments: none') || lowerC.includes('audit comments:none');
      if (isAutoPass || isNoneApproved) return false;
      if (warrantyStatusFilter.length > 0) {
        const matchBelum = warrantyStatusFilter.includes("1") && claim.status === 1;
        const matchSudah = warrantyStatusFilter.includes("2") && claim.status === 2;
        return matchBelum || matchSudah;
      }
      return true;
    });

    // Synchronize sorting with table: prioritize items with real comments at the top
    filtered = [...filtered].sort((a, b) => {
      if (warrantyCommentSort) {
        const valA = (a.approveComment || '').toLowerCase();
        const valB = (b.approveComment || '').toLowerCase();
        return warrantyCommentSort === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      const isRealCommentA = (a.approveComment && a.approveComment.trim() !== '' && !a.approveComment.startsWith('Tidak ada')) ? 1 : 0;
      const isRealCommentB = (b.approveComment && b.approveComment.trim() !== '' && !b.approveComment.startsWith('Tidak ada')) ? 1 : 0;
      if (isRealCommentA !== isRealCommentB) {
        return isRealCommentB - isRealCommentA;
      }
      const dateA = new Date(a.submitTime || 0).getTime();
      const dateB = new Date(b.submitTime || 0).getTime();
      return warrantySortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const startIndex = (warrantyDisplayPage - 1) * warrantyItemsPerPage;
    const currentItems = filtered.slice(startIndex, startIndex + warrantyItemsPerPage);

    // Cari item di halaman ini yang belum punya approveComment di state
    const itemsToFetch = currentItems.filter(c => c.approveComment === undefined);

    if (itemsToFetch.length > 0) {
      const currentToken = warrantySearchTokenRef.current;
      const fetchPageDetails = async () => {
        const batchSize = 4;
        for (let i = 0; i < itemsToFetch.length; i += batchSize) {
          if (warrantySearchTokenRef.current !== currentToken) return;
          const batch = itemsToFetch.slice(i, i + batchSize);
          await Promise.all(batch.map(c => fetchClaimDetail(c.id)));
          await new Promise(r => setTimeout(r, 150));
        }
      };
      fetchPageDetails();
    }
  }, [warrantyResults, warrantyDisplayPage, warrantyItemsPerPage, warrantyStatusFilter]);

  // Periodic Monitoring (Setiap 3 Jam) - Cek klaim yang statusnya belum di-review untuk mendeteksi update komentar dari Pusat
  useEffect(() => {
    const checkInterval = 3 * 60 * 60 * 1000;
    const timer = setInterval(() => {
      console.log("Running 3-hour background check for pending Warranty Comments...");
      if (warrantyResults.length > 0) {
        const pending = warrantyResults.filter(c => c.status === 1 || !c.approveComment);
        pending.forEach(c => fetchClaimDetail(c.id));
      }
    }, checkInterval);
    return () => clearInterval(timer);
  }, [warrantyResults]);



  const fetchDeletedBookings = useCallback(async () => {
    try {
      const { data, error } = await db.select('booking', { eq: { status: 'deleted' }, order: { column: 'tanggal', ascending: false } });
      if (error) throw error;
      setDeletedBookings(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'deleted_bookings') fetchDeletedBookings();
  }, [activeTab, fetchDeletedBookings]);

  // Fetch notification sound URL and status from settings
  const fetchNotifSettings = useCallback(async () => {
    try {
      const { data: urlData } = await db.select('settings', { eq: { key: 'notification_sound_url' }, maybeSingle: true });
      if (urlData) setNotifSoundUrl(urlData.value);

      const { data: statusData } = await db.select('settings', { eq: { key: 'notification_sound_enabled' }, maybeSingle: true });
      if (statusData) setIsSoundEnabled(statusData.value === 'true');
    } catch (e) { 
      // Silently ignore table errors
    }
  }, [setNotifSoundUrl, setIsSoundEnabled]);

  useEffect(() => {
    fetchNotifSettings();
  }, [fetchNotifSettings]);

  const handleUploadSound = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      Toastify({ text: '❌ Hanya file audio yang diizinkan!', style: { background: '#ef4444' } }).showToast();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Toastify({ text: '❌ Ukuran file maksimal 5MB!', style: { background: '#ef4444' } }).showToast();
      return;
    }

    setIsUploadingSound(true);
    try {
      const fileName = `notification_${Date.now()}.${file.name.split('.').pop()}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        if (uploadError.message?.includes('not found') || uploadError.error === 'Bucket not found') {
          throw new Error('Bucket "audio" belum dibuat di Supabase Storage. Silakan buat bucket bernama "audio" dengan akses Public di dashboard Supabase Anda.');
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Save URL to settings table
      await db.upsert('settings', { key: 'notification_sound_url', value: publicUrl }, { onConflict: 'key' });

      setNotifSoundUrl(publicUrl);
      Toastify({ text: '✅ Suara notifikasi berhasil diupload!', style: { background: '#10b981' } }).showToast();
    } catch (err) {
      console.error('Upload Error:', err);
      Toastify({ text: `❌ Gagal upload: ${err.message}`, style: { background: '#ef4444' } }).showToast();
    } finally {
      setIsUploadingSound(false);
      e.target.value = '';
    }
  };

  const handlePlayPreview = () => {
    if (!notifSoundUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(notifSoundUrl);
    audio.onended = () => { setIsPlaying(false); audioRef.current = null; };
    audio.play().catch(() => {});
    audioRef.current = audio;
    setIsPlaying(true);
  };

  const handleToggleSound = async () => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    try {
      await db.upsert('settings', { key: 'notification_sound_enabled', value: newState.toString() }, { onConflict: 'key' });
      Toastify({ text: `🔊 Notifikasi Suara ${newState ? 'AKTIF' : 'NONAKTIF'}`, style: { background: newState ? '#10b981' : '#ef4444' } }).showToast();
    } catch (err) {
      console.error(err);
    }
  };

  // Modal State
  const [modal, setModal] = useState({ type: null, user: null });
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error(e);
      Toastify({ text: '❌ Gagal memuat data users', style: { background: '#ef4444' } }).showToast();
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Realtime subscription
    const channel = supabase
      .channel('owner-monitoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchUsers]);

  useEffect(() => {
    const fetchMechanics = async () => {
        const { data } = await db.select('users', { select: 'name', eq: { role: 'mekanik' } });
        if (data) setMechanics(data);
    };
    fetchMechanics();
  }, []);

  const handleForceLogout = async (targetUser) => {
    // Cegah force logout diri sendiri
    if (targetUser.username === user?.username) {
      Toastify({ text: `⚠️ Tidak bisa force logout akun sendiri.`, style: { background: '#f59e0b' } }).showToast();
      setModal({ type: null, user: null });
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ sessionId: null, isOnline: false, lastAction: 'FORCE_LOGOUT' })
        .eq('username', targetUser.username);

      if (error) throw error;

      Toastify({ text: `✅ ${targetUser.name} telah dikeluarkan.`, style: { background: '#10b981' } }).showToast();
      fetchUsers();
    } catch (e) {
      console.error("Force Logout Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message || 'Error tidak diketahui'}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Toastify({ text: '⚠️ Password minimal 6 karakter', style: { background: '#f97316' } }).showToast();
      return;
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword, sessionId: null, isOnline: false, lastAction: 'PASSWORD_RESET' })
        .eq('username', modal.user.username);

      if (error) throw error;

      Toastify({ text: `✅ Password ${modal.user.name} berhasil direset.`, style: { background: '#10b981' } }).showToast();
      setNewPassword('');
      fetchUsers();
    } catch (e) {
      console.error("Reset Password Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleDeleteUser = async (targetUser) => {
    try {
      await db.delete('users', { eq: { username: targetUser.username } });
      Toastify({ text: `🗑️ User ${targetUser.name} telah dihapus.`, style: { background: '#6b7280' } }).showToast();
      fetchUsers();
    } catch (e) {
      Toastify({ text: '❌ Gagal menghapus user', style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleResetAllSessions = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ sessionId: null, isOnline: false, lastAction: 'MASS_LOGOUT' })
        .neq('username', user.username);

      if (error) throw error;

      Toastify({ text: '✅ Semua sesi berhasil direset (Kecuali Sesi Anda).', style: { background: '#10b981' } }).showToast();
      fetchUsers();
    } catch (e) {
      console.error("Reset All Sessions Error:", e);
      Toastify({ text: `❌ Gagal: ${e.message}`, style: { background: '#ef4444' } }).showToast();
    }
    setModal({ type: null, user: null });
  };

  const handleRemoteRefresh = async () => {
    try {
      // Create channel with a ref or ensure it's ready. 
      // For broadcasting, we need to subscribe first or use the same channel instance
      const channel = supabase.channel('remote_control');
      
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { error } = await channel.send({
            type: 'broadcast',
            event: 'force-refresh',
            payload: { message: 'Owner triggered refresh' }
          });
          if (error) throw error;
          Toastify({ 
            text: '🚀 RESTART GLOBAL: Seluruh layar sedang dimuat ulang...', 
            style: { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '15px', fontWeight: 'bold' } 
          }).showToast();
          // Cleanup
          setTimeout(() => supabase.removeChannel(channel), 2000);
        }
      });
    } catch (e) {
      console.error(e);
      Toastify({ text: '❌ Gagal mengirim perintah refresh', style: { background: '#ef4444' } }).showToast();
    }
  };

  const onlineUsers = users.filter(u => u.isOnline && u.sessionId);
  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  const workshopStats = [
    { label: 'Unit Working', value: processedQueue.filter(q => q.status === 'working').length, icon: Activity, color: 'text-black', bg: 'bg-zinc-50' },
    { label: 'Unit Waiting', value: processedQueue.filter(q => q.status === 'waiting').length, icon: Clock, color: 'text-black', bg: 'bg-zinc-50' },
    { label: 'Unit Menginap', value: processedQueue.filter(q => q.status === 'menginap').length, icon: Moon, color: 'text-black', bg: 'bg-zinc-50' },
    { label: 'Selesai Hari Ini', value: rawHistory.filter(h => new Date(parseInt(h.id)).toDateString() === new Date().toDateString()).length, icon: CheckCircle, color: 'text-black', bg: 'bg-zinc-50' },
  ];

  const userStats = [
    { label: 'Total User', value: users.length, icon: Users, color: 'text-black', bg: 'bg-zinc-50' },
    { label: 'Sedang Online', value: onlineUsers.length, icon: Wifi, color: 'text-black', bg: 'bg-zinc-50' },
    { label: 'Offline', value: users.length - onlineUsers.length, icon: WifiOff, color: 'text-zinc-400', bg: 'bg-zinc-50' },
    { label: 'Role Aktif', value: [...new Set(users.map(u => u.role).filter(Boolean))].length, icon: Moon, color: 'text-black', bg: 'bg-zinc-50' },
  ];

  const stats = activeTab === 'workshop' ? workshopStats : userStats;

  return (
    <div className="w-full h-full bg-zinc-100 flex flex-col overflow-hidden font-sans antialiased">
      {/* Main Content - no internal sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-zinc-200 px-4 md:px-8 h-20 flex items-center justify-between shrink-0 box-border">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-zinc-900 font-black text-base md:text-lg">
                {activeTab === 'monitoring' ? '🔴 Live Session Monitoring' : 
                 activeTab === 'workshop' ? '🚗 Antrian Workshop Realtime' : 
                 activeTab === 'users' ? '👥 Manajemen User' : 
                 activeTab === 'notification_sound' ? '🔔 Notifikasi Suara' : 
                 activeTab === 'dms_search' ? '🔍 DMS & EPCM Search' :
                 activeTab === 'warranty_search' ? '🛡️ Warranty Claim Search' :
                 activeTab === 'part_orders' ? '📦 Tracking Pemesanan Part' :
                 '🗑️ Riwayat Penghapusan Data'}
              </h2>
              <p className="text-zinc-500 text-xs font-medium">
                {activeTab === 'monitoring'
                  ? `${onlineUsers.length} pengguna aktif saat ini`
                  : activeTab === 'workshop'
                    ? `${processedQueue.length} unit kendaraan dalam sistem`
                    : activeTab === 'users'
                      ? `${users.length} total user terdaftar`
                      : activeTab === 'notification_sound'
                        ? 'Upload dan kelola suara notifikasi kustom'
                        : activeTab === 'dms_search'
                          ? 'Integrasi Katalog Sparepart'
                          : activeTab === 'warranty_search'
                            ? 'Monitoring Klaim Warranty Realtime'
                            : activeTab === 'part_orders'
                              ? 'Status Pesanan & Pengiriman SAP Split'
                              : `${deletedBookings.length} data yang terhapus`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'monitoring' && (
              <>
                <button 
                  onClick={handleRemoteRefresh}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm rounded-md transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-lg shadow-white/10 border border-zinc-2000 scale-90 md:scale-100">
                  <RefreshCw size={14} /> Global Restart
                </button>
                <button 
                  onClick={() => setModal({ type: 'resetAll', user: null })}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-md transition-all font-black text-[10px] uppercase tracking-widest shadow-lg border border-black">
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Reset Semua Login
                </button>
              </>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md">
              <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-black uppercase tracking-widest">Realtime Active</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar pb-[72px] md:pb-8">

          {/* Stat Cards - Only show on Monitoring */}
          {activeTab === 'monitoring' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-lg p-5">
                  <div className={`w-10 h-10 ${s.bg} rounded-md flex items-center justify-center mb-4`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <p className="text-3xl font-black text-zinc-900">{s.value}</p>
                  <p className="text-zinc-500 text-xs font-medium mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ====== TAB: MONITORING ====== */}
          {activeTab === 'monitoring' && (
            <div className="space-y-4">
              <h3 className="text-zinc-600 text-xs font-black uppercase tracking-widest">Pengguna Yang Saat Ini Online</h3>

              {onlineUsers.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
                  <WifiOff size={40} className="text-zinc-400 mx-auto mb-4" />
                  <p className="text-zinc-500 font-bold">Tidak ada pengguna yang sedang online</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {onlineUsers.map(u => {
                    const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                    return (
                      <div key={u.username} className="bg-white border border-zinc-300 rounded-lg p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-center group hover:border-black transition-all">

                        {/* Avatar + Status */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-md bg-zinc-50 border border-zinc-300 flex items-center justify-center font-black text-black text-xl">
                            {u.name?.[0] || '?'}
                          </div>
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full border-2 border-white animate-pulse" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 space-y-3 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-zinc-900 font-black text-base">{u.name}</span>
                            <span className="text-zinc-500 text-xs">@{u.username}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>
                              {u.role}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-black border border-zinc-300">
                              ● ONLINE
                            </span>
                          </div>

                          {/* Device Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <InfoPill icon={<DeviceIcon device={u.lastDevice} />} label="Perangkat" value={u.lastDevice || 'Tidak Diketahui'} />
                            <InfoPill icon={<Globe size={14} />} label="Browser" value={u.lastBrowser || 'Tidak Diketahui'} />
                            <InfoPill icon={<Wifi size={14} />} label="Alamat IP" value={u.lastIP || '-'} mono />
                            <InfoPill icon={<MapPin size={14} />} label="Lokasi" value={u.lastLocation ? u.lastLocation.split('(')[0].trim() : 'Tidak Diketahui'} />
                            <div className="bg-zinc-100 rounded-md px-3 py-2 min-w-0 relative group/coords">
                              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                                <MapPin size={14} className="text-black" />
                                <span className="text-[9px] font-black uppercase tracking-wider">Coordinate</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <p className="text-zinc-800 text-[10px] font-mono font-bold truncate">
                                  {u.lastLocation && u.lastLocation.includes('(') ? u.lastLocation.split('(')[1].replace(')', '') : 'N/A'}
                                </p>
                                {u.lastLocation && u.lastLocation.includes('(') && (
                                  <button 
                                    onClick={() => {
                                      const coords = u.lastLocation.split('(')[1].replace(')', '');
                                      navigator.clipboard.writeText(coords);
                                      Toastify({ text: "📍 Coordinate Copied!", style: { background: "#18181b" }, duration: 2000 }).showToast();
                                    }}
                                    className="p-1 hover:bg-zinc-100 rounded-md text-black opacity-0 group-hover/coords:opacity-100 transition-all shrink-0"
                                    title="Copy Coordinates"
                                  >
                                    <Key size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-zinc-500 text-xs">
                            <Clock size={12} />
                            <span>Login terakhir: <span className="text-zinc-500 font-medium">{u.lastLogin || '-'}</span></span>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => setModal({ type: 'forceLogout', user: u })}
                          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-black hover:text-white text-black font-bold text-xs rounded-md transition-all border border-zinc-300 hover:border-black">
                          <XCircle size={14} /> Force Logout
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Offline Section */}
              {users.filter(u => !u.isOnline || !u.sessionId).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest">Pengguna Offline</h3>
                  <div className="grid gap-3">
                    {users.filter(u => !u.isOnline || !u.sessionId).map(u => {
                      const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                      return (
                        <div key={u.username} className="bg-white border border-zinc-200 rounded-md p-4 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-md bg-zinc-100 flex items-center justify-center font-black text-zinc-500 shrink-0">
                            {u.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-zinc-700 font-bold text-sm">{u.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>{u.role}</span>
                            </div>
                            <p className="text-zinc-500 text-xs mt-0.5">{u.lastDevice || 'Belum pernah login'} · {u.lastLocation || '-'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-zinc-400 text-[10px] font-bold uppercase">Offline</span>
                            {u.lastLocation && u.lastLocation.includes('(') && (
                              <button 
                                onClick={() => {
                                  const coords = u.lastLocation.split('(')[1].replace(')', '');
                                  navigator.clipboard.writeText(coords);
                                  Toastify({ text: "📍 Coordinate Copied!", style: { background: "#18181b" }, duration: 2000 }).showToast();
                                }}
                                className="text-[9px] font-black text-zinc-500 hover:text-black uppercase tracking-widest transition-colors"
                              >
                                Copy Coords
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== TAB: WORKSHOP ====== */}
          {activeTab === 'workshop' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Working Column */}
                <WorkshopColumn
                  title="Sedang Dikerjakan"
                  items={processedQueue.filter(i => i.status === 'working')}
                  color="blue"
                  icon={Clock}
                  formatTime={formatTime}
                  onEdit={editItem}
                  onDelete={(id) => { if(window.confirm('Hapus unit dari antrian?')) deleteItem(id); }}
                />
                {/* Waiting Column */}
                <WorkshopColumn
                  title="Menunggu"
                  items={processedQueue.filter(i => i.status === 'waiting')}
                  color="orange"
                  icon={Activity}
                  formatTime={formatTime}
                  onEdit={editItem}
                  onDelete={(id) => { if(window.confirm('Hapus unit dari antrian?')) deleteItem(id); }}
                />
                {/* Overnight Column */}
                <WorkshopColumn
                  title="Menginap"
                  items={processedQueue.filter(i => i.status === 'menginap')}
                  color="purple"
                  icon={Moon}
                  formatTime={formatTime}
                  onEdit={editItem}
                  onDelete={(id) => { if(window.confirm('Hapus unit dari antrian?')) deleteItem(id); }}
                />
                {/* Completed Today Column */}
                <WorkshopColumn
                   title="Sudah Selesai"
                   items={rawHistory.filter(h => {
                      const id = parseInt(h.id);
                      const d = id < 2000000000 ? new Date(id * 1000) : new Date(id);
                      return d.toDateString() === new Date().toDateString();
                   })}
                   color="green"
                   icon={CheckCircle}
                   formatTime={formatTime}
                   onEdit={editItem}
                   onDelete={(id) => { if(window.confirm('Hapus unit dari riwayat?')) deleteItem(id); }}
                />
              </div>
            </div>
          )}

          {/* ====== TAB: DMS SEARCH ====== */}
          {activeTab === 'dms_search' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Header Page */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                    <PackageSearch className="text-zinc-900" size={28} />
                    Chery DMS & EPCM Search
                  </h2>
                  <p className="text-sm text-zinc-500 font-medium">Cari sparepart di DMS dan integrasi gambar dari EPCM Catalog</p>
                </div>
                
                <div className="flex items-center gap-3">
                   {/* Token Management UI */}
                   <div className="relative group">
                     <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md p-1 pr-4 focus-within:border-zinc-2000 transition-all">
                        <div className="flex items-center gap-2 pl-3">
                          <Key size={14} className={epcmToken ? "text-zinc-900" : "text-zinc-400"} />
                          <input 
                            type="password"
                            value={epcmToken}
                            onChange={(e) => setEpcmToken(e.target.value)}
                            placeholder="EPCM Token..."
                            className="bg-transparent border-none text-xs text-zinc-900 placeholder:text-zinc-300 focus:ring-0 w-32 py-2"
                          />
                        </div>
                        <button 
                          onClick={handleTestEpcConnection}
                          disabled={isEpcTesting}
                          className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                          title="Test Koneksi EPCM"
                        >
                          <RefreshCw size={14} className={isEpcTesting ? "animate-spin" : ""} />
                        </button>
                        <button 
                          onClick={handleEpcAutoLogin}
                          disabled={isEpcLoggingIn}
                          className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm text-[10px] font-black px-3 py-1.5 rounded-md transition-all uppercase tracking-wider disabled:opacity-50"
                        >
                          {isEpcLoggingIn ? "Logging in..." : "Auto Login"}
                        </button>
                     </div>
                   </div>

                   <button 
                    onClick={generatePdf}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm px-6 py-3 rounded-md font-black text-sm shadow-sm transition-all active:scale-95"
                   >
                     <Printer size={18} />
                     Export PDF ({selectedParts.length})
                   </button>
                </div>
              </div>

              {/* Search Controls & Bulk */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-6 shadow-2xl relative overflow-hidden group">
                  
                  
                  <div className="relative space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Live DMS Search</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1 group/input">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within/input:text-zinc-900 transition-colors" size={20} />
                        <input
                          type="text"
                          value={searchDms}
                          onChange={(e) => setSearchDms(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && fetchDmsParts(searchDms)}
                          placeholder="Cari No Part atau Nama Barang..."
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-md pl-14 pr-6 py-3.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 focus:border-zinc-2000 text-zinc-900 placeholder:text-zinc-400 transition-all"
                        />
                        {isDmsLoading && (
                          <div className="absolute right-5 top-1/2 -translate-y-1/2">
                            <RefreshCw className="text-zinc-900 animate-spin" size={20} />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => fetchDmsParts(searchDms)}
                        disabled={isDmsLoading}
                        className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm px-8 rounded-md font-black transition-all shadow-lg shadow-white/10 active:scale-95 disabled:opacity-50"
                      >
                        CARI
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-2xl relative overflow-hidden group">
                  
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Bulk Excel Process</label>
                      {bulkImportList.length > 0 && (
                        <button 
                          onClick={() => setBulkImportList([])}
                          className="text-[10px] font-black text-zinc-500 hover:text-black uppercase tracking-widest"
                        >
                          Clear ({bulkImportList.length})
                        </button>
                      )}
                    </div>
                    
                    {bulkImportList.length === 0 ? (
                      <label className="flex flex-col items-center justify-center w-full h-[60px] border-2 border-dashed border-zinc-200 hover:border-zinc-2000 hover:bg-zinc-300/5 rounded-md cursor-pointer transition-all">
                        <div className="flex items-center gap-3">
                          <Upload className="text-zinc-900" size={20} />
                          <span className="text-sm font-bold text-zinc-600">Upload Excel (.xlsx)</span>
                        </div>
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportBulkExcel} />
                      </label>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md px-4 py-2">
                           <Clock size={14} className="text-zinc-400" />
                           <input 
                              type="number" 
                              value={bulkDelay} 
                              onChange={(e) => setBulkDelay(parseInt(e.target.value) || 1)}
                              className="bg-transparent border-none text-xs text-zinc-900 w-full focus:ring-0 font-bold"
                              title="Jeda antar item (detik)"
                           />
                           <span className="text-[8px] text-zinc-400 font-black uppercase whitespace-nowrap">Sec Delay</span>
                        </div>
                        <button 
                          onClick={processBulkImport}
                          disabled={isBulkProcessing}
                          className="flex-1 bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm disabled:opacity-50 text-xs font-black rounded-md transition-all shadow-sm py-2 active:scale-95"
                        >
                          {isBulkProcessing ? 'PROCESSING...' : 'MULAI CARI'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Progress (Mini) */}
              {bulkImportList.length > 0 && (
                <div className="bg-zinc-100 border border-zinc-200 rounded-md p-4 overflow-hidden">
                  <div className="flex flex-wrap gap-2">
                    {bulkImportList.map((item, idx) => (
                      <div key={idx} className={`text-[9px] font-black px-2 py-1 rounded-lg border transition-all duration-300 flex items-center gap-1.5
                        ${item.status === 'success' ? 'bg-zinc-100 border-zinc-300 text-zinc-900' : 
                          item.status === 'searching' ? 'bg-zinc-100 border-zinc-2000 text-zinc-900 animate-pulse' :
                          item.status === 'not_found' ? 'bg-zinc-50 border-zinc-300 text-zinc-500' :
                          item.status === 'error' ? 'bg-zinc-50 border-zinc-300 text-zinc-500' :
                          'bg-zinc-100 border-zinc-200 text-zinc-400'}`}
                      >
                        {item.code}
                        {item.status === 'success' && <CheckCircle size={10} />}
                        {item.status === 'not_found' && <XCircle size={10} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Area: Grid Results & Document */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Side: DMS Search Results */}
                <div className="xl:col-span-8 space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                       <Layers className="text-zinc-900" size={20} />
                       DMS Results
                       <span className="bg-zinc-200 text-zinc-900 text-[10px] px-2 py-0.5 rounded-full border border-zinc-300 ml-2">
                         {dmsTotalItems} Total
                       </span>
                     </h3>
                     
                     {dmsResults.length > 0 && (
                       <select 
                         value={dmsModelFilter}
                         onChange={(e) => setDmsModelFilter(e.target.value)}
                         className="bg-zinc-100 border border-zinc-200 rounded-md text-[10px] font-black text-zinc-600 focus:ring-zinc-900/20 focus:border-zinc-900 uppercase px-3 py-1.5 outline-none transition-all"
                       >
                         <option value="">SEMUA MODEL</option>
                         {CHERY_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                         <option value="OTHER">OTHER</option>
                       </select>
                     )}
                  </div>

                  {dmsResults.length === 0 ? (
                    <div className="bg-zinc-1000 border border-dashed border-zinc-200 rounded-md h-64 flex flex-col items-center justify-center text-zinc-400 gap-4">
                      <Search size={48} className="opacity-10" />
                      <p className="text-sm font-medium italic">Hasil pencarian DMS akan muncul di sini...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dmsResults
                        .filter(item => !dmsModelFilter || (epcmDetails[item.code] && Object.keys(epcmDetails[item.code]).some(m => m.includes(dmsModelFilter))))
                        .map((item, idx) => {
                          const hasEpc = epcmDetails[item.code];
                          const activeModel = activeEpcModel[item.code] || (hasEpc ? Object.keys(hasEpc)[0] : null);
                          const currentImages = epcmImages[item.code] || [];
                          const models = hasEpc ? Object.keys(hasEpc) : [];

                          return (
                            <div key={idx} className="bg-white border border-zinc-200 rounded-md p-5 hover:border-zinc-300 transition-all group/card relative overflow-hidden flex flex-col gap-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 pr-12">
                                  <h4 className="text-zinc-900 font-black text-sm leading-tight group-hover/card:text-zinc-900 transition-colors uppercase">{item.name}</h4>
                                  <p className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider uppercase">{item.code}</p>
                                </div>
                                <div className="absolute top-5 right-5 w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center group-hover/card:bg-zinc-200 group-hover/card:text-zinc-900 text-zinc-400 transition-all">
                                  <PackageSearch size={20} />
                                </div>
                              </div>

                              {/* Image Preview */}
                              <div className="relative aspect-video bg-zinc-100 rounded-md overflow-hidden border border-zinc-200 flex items-center justify-center">
                                {currentImages.length > 0 ? (
                                  <img src={currentImages[0]} className="w-full h-full object-contain p-2 group-hover/card:scale-110 transition-transform duration-700" alt="Part" />
                                ) : (
                                  <div className="text-center space-y-2 opacity-20 group-hover/card:opacity-40 transition-opacity">
                                    <ExternalLink size={24} className="mx-auto" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">No Image Found</p>
                                  </div>
                                )}
                                
                                {/* Model Badge */}
                                <div className="absolute bottom-3 left-3 flex gap-1">
                                  {models.slice(0, 3).map(m => (
                                    <span key={m} className={`text-[8px] font-black px-2 py-1 rounded-lg border ${m === 'OTHER' ? 'bg-zinc-100 border-zinc-200 text-zinc-500' : 'bg-zinc-200 border-zinc-300 text-zinc-900'}`}>
                                      {m}
                                    </span>
                                  ))}
                                  {models.length > 3 && <span className="text-[8px] font-black px-2 py-1 rounded-lg bg-zinc-100 border-zinc-200 text-zinc-500">+{models.length-3}</span>}
                                </div>
                              </div>

                              <div className="mt-auto flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.1em]">Retail Price</p>
                                  <p className="text-lg font-black text-zinc-900">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.retailGuidePrice || 0)}
                                  </p>
                                </div>
                                <button 
                                  onClick={() => handleAddToDocument(item)}
                                  className="bg-zinc-100 hover:bg-white text-zinc-900 border border-zinc-300 shadow-sm font-bold text-zinc-500 hover:text-zinc-900 px-4 py-3 rounded-md transition-all border border-zinc-200 hover:border-zinc-2000 shadow-lg active:scale-95"
                                >
                                  <Plus size={20} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  
                  {/* Pagination (DMS) */}
                  {dmsTotalItems > dmsPageSize && (
                    <div className="flex items-center justify-center gap-4 pt-4">
                      <button 
                        onClick={() => fetchDmsParts(searchDms, false, dmsPageIndex - 1)}
                        disabled={dmsPageIndex === 0}
                        className="w-10 h-10 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-20 transition-all"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Page {dmsPageIndex + 1}</span>
                      <button 
                        onClick={() => fetchDmsParts(searchDms, false, dmsPageIndex + 1)}
                        disabled={(dmsPageIndex + 1) * dmsPageSize >= dmsTotalItems}
                        className="w-10 h-10 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-20 transition-all"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Side: Quotation Preview */}
                <div className="xl:col-span-4 space-y-6">
                  <div className="bg-white border border-zinc-200 rounded-md shadow-2xl p-8 sticky top-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-zinc-900 tracking-tight">Quotation Document</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Draft Review</p>
                      </div>
                      <div className="w-12 h-12 bg-zinc-100 rounded-md flex items-center justify-center text-zinc-900">
                        <FileSpreadsheet size={24} />
                      </div>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedParts.length === 0 ? (
                        <div className="text-center py-12 space-y-4">
                          <div className="w-16 h-16 bg-zinc-100 rounded-lg mx-auto flex items-center justify-center text-zinc-300">
                            <Printer size={32} />
                          </div>
                          <p className="text-xs text-zinc-400 font-medium italic">Belum ada item ditambahkan...</p>
                        </div>
                      ) : (
                        selectedParts.map((p, idx) => (
                          <div key={idx} className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 group/item hover:bg-zinc-100 transition-all relative">
                            <div className="flex gap-4">
                              <div className="w-16 h-16 bg-zinc-100 rounded-md overflow-hidden border border-zinc-200 flex items-center justify-center shrink-0">
                                 {p.image ? (
                                   <img src={p.image} className="w-full h-full object-contain" alt="Thumb" />
                                 ) : (
                                   <PackageSearch size={20} className="text-zinc-300" />
                                 )}
                              </div>
                              <div className="flex-1 min-w-0 pr-8">
                                <h5 className="text-xs font-black text-zinc-900 truncate uppercase">{p.name}</h5>
                                <p className="text-[9px] font-bold text-zinc-500 font-mono tracking-wider mb-1">{p.code}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <div>
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">Non PPN</p>
                                    <p className="text-xs font-bold text-zinc-600 leading-tight">
                                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.priceExc)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">PPN (11%)</p>
                                    <p className="text-xs font-bold text-zinc-600 leading-tight">
                                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format((p.price || 0) - (p.priceExc || 0))}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">Total</p>
                                    <p className="text-xs font-bold text-zinc-900 leading-tight">
                                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.price)}
                                    </p>
                                  </div>
                                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter truncate max-w-[60px] ml-auto">
                                    {p.models}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setEditingPartIdx(idx)}
                                className="p-2 hover:bg-white text-zinc-900 border border-zinc-300 shadow-sm font-bold text-zinc-400 text-zinc-400 hover:text-zinc-900 rounded-md transition-all"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={() => setSelectedParts(prev => prev.filter((_, i) => i !== idx))}
                                className="p-2 hover:bg-zinc-200 text-zinc-400 hover:text-black rounded-md transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedParts.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-zinc-200 space-y-3">
                        <div className="flex items-center justify-between text-zinc-600 text-xs font-semibold">
                          <p className="uppercase tracking-wider">Total Non PPN</p>
                          <p>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
                              selectedParts.reduce((acc, curr) => acc + (curr.priceExc || 0), 0)
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-zinc-600 text-xs font-semibold">
                          <p className="uppercase tracking-wider">Total PPN (11%)</p>
                          <p>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
                              selectedParts.reduce((acc, curr) => acc + ((curr.price || 0) - (curr.priceExc || 0)), 0)
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
                          <p className="text-sm font-black text-zinc-900 uppercase tracking-[0.1em]">Total (Inc PPN)</p>
                          <p className="text-xl font-black text-zinc-900">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
                              selectedParts.reduce((acc, curr) => acc + (curr.price || 0), 0)
                            )}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={() => setSelectedParts([])}
                             className="py-4 rounded-md bg-zinc-100 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 font-black text-[10px] uppercase tracking-widest transition-all"
                           >
                             RESET LIST
                           </button>
                           <button 
                             onClick={generatePdf}
                             className="py-4 rounded-md bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm text-[10px] uppercase tracking-widest shadow-xl shadow-white/10 transition-all active:scale-95"
                           >
                             DOWNLOAD PDF
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== TAB: WARRANTY SEARCH ====== */}
          {activeTab === 'warranty_search' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Header Info */}
              <div className="bg-white border border-zinc-200 rounded-md p-8 relative overflow-hidden group">
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                      <ShieldCheck className="text-zinc-900" size={32} />
                      Warranty Claim Center
                    </h2>
                    <p className="text-sm text-zinc-500 font-medium mt-1">Lacak status pengajuan klaim warranty secara realtime</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-zinc-100 border border-zinc-300 px-4 py-2 rounded-md">
                      <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest mb-0.5">Monitoring Active</p>
                      <p className="text-xs font-bold text-zinc-600 flex items-center gap-2">
                        <Clock size={12} /> Every 3 Hours
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white border border-zinc-200 rounded-md p-6 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Warranty No / Code</label>
                    <input 
                      type="text" 
                      value={warrantySearchCode}
                      onChange={(e) => setWarrantySearchCode(e.target.value)}
                      placeholder="BX1000..."
                      className="w-full bg-white border border-zinc-300 shadow-sm rounded-md px-4 py-3 text-sm text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">VIN Number</label>
                    <input 
                      type="text" 
                      value={warrantySearchVin}
                      onChange={(e) => setWarrantySearchVin(e.target.value)}
                      placeholder="Cari VIN..."
                      className="w-full bg-white border border-zinc-300 shadow-sm rounded-md px-4 py-3 text-sm text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Customer Name</label>
                    <input 
                      type="text" 
                      value={warrantySearchCustomer}
                      onChange={(e) => setWarrantySearchCustomer(e.target.value)}
                      placeholder="Nama Customer..."
                      className="w-full bg-white border border-zinc-300 shadow-sm rounded-md px-4 py-3 text-sm text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Start Month</label>
                    <input 
                      type="month" 
                      value={warrantySearchStartMonth}
                      onChange={(e) => setWarrantySearchStartMonth(e.target.value)}
                      className="w-full bg-white border border-zinc-300 shadow-sm rounded-md px-4 py-3 text-sm text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all [color-scheme:light]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">End Month</label>
                    <input 
                      type="month" 
                      value={warrantySearchEndMonth}
                      onChange={(e) => setWarrantySearchEndMonth(e.target.value)}
                      className="w-full bg-white border border-zinc-300 shadow-sm rounded-md px-4 py-3 text-sm text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all [color-scheme:light]"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filter Status</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: '1', label: 'BELUM ADA KOMENTAR APPROVAL' },
                        { id: '2', label: 'SUDAH ADA KOMENTAR APPROVAL' },
                      ].map(stat => (
                        <button
                          key={stat.id}
                          type="button"
                          onClick={() => {
                            setWarrantyStatusFilter(prev => 
                              prev.includes(stat.id) 
                                ? prev.filter(x => x !== stat.id) 
                                : [...prev, stat.id]
                            );
                          }}
                          className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm ${
                            warrantyStatusFilter.includes(stat.id)
                              ? 'bg-zinc-900 text-white border-zinc-900 ring-2 ring-zinc-900/20 scale-105 shadow-md'
                              : 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                          }`}
                        >
                          {stat.label}
                        </button>
                      ))}
                      {warrantyStatusFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setWarrantyStatusFilter([])}
                          className="px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider bg-zinc-50 border border-zinc-300 text-black hover:bg-zinc-200 transition-all shadow-sm"
                        >
                          RESET FILTER
                        </button>
                      )}
                      {/* Button untuk memunculkan daftar klaim yang sudah memiliki komentar */}
                      <button
                        type="button"
                        onClick={() => setShowCommentedListModal(true)}
                        className="px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-wider bg-black border border-black text-white hover:bg-zinc-800 transition-all shadow-md flex items-center gap-1.5 ml-auto"
                      >
                        <MessageSquare size={12} />
                        LIHAT DAFTAR KLAIM BERKOMENTAR ({warrantyResults.filter(c => c.approveComment && c.approveComment.trim() !== '').length})
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-1 mt-3">
                      {warrantyResults.length > 0 && (
                        <div className="flex items-center gap-4 ml-auto">
                          {backgroundLoadingProgress > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-100 border border-zinc-300 animate-pulse">
                              <RefreshCw size={10} className="text-zinc-900 animate-spin" />
                              <span className="text-[9px] font-black text-zinc-900 uppercase tracking-widest">
                                Background Loading: {backgroundLoadingProgress} / {warrantyResults.length}
                              </span>
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                            Total: {warrantyResults.length} Items
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={() => fetchWarrantyClaims(0)}
                    disabled={isWarrantyLoading}
                    className="w-full bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm py-3.5 rounded-md transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isWarrantyLoading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                    APPLY FILTERS & SEARCH
                  </button>
                </div>
              </div>

              {/* Table */}
              {(() => {
                let filtered = warrantyResults.filter(claim => {
                  const lowerC = (claim.approveComment || '').toLowerCase();
                  const isAutomaticPass = lowerC.includes('automatic approval passes');
                  const isNoneApproved = lowerC.includes('audit comments：none') || lowerC.includes('audit comments: none') || lowerC.includes('audit comments:none');
                  const isUpdateTask = claim.faultPartName?.toLowerCase().startsWith('update') || 
                                      claim.faultDescription?.toLowerCase().startsWith('update');
                  
                  // Pastikan automatic pass & none approved tidak lolos
                  if (isAutomaticPass || isNoneApproved) return false;

                  const isActuallyPending = (claim.status === 1 || !claim.approveComment || claim.approveComment.trim() === '') && !isAutomaticPass && !isUpdateTask;
                  const isUnreviewed = claim.approveComment && !reviewedClaims.includes(claim.id) && !isAutomaticPass && !isUpdateTask;

                  if (warrantyStatusFilter.length > 0) {
                    const matchBelum = warrantyStatusFilter.includes("1") && claim.status === 1;
                    const matchSudah = warrantyStatusFilter.includes("2") && claim.status === 2 && (claim.approveComment === undefined || (claim.approveComment && claim.approveComment.trim() !== ''));
                    return matchBelum || matchSudah;
                  }
                  return true;
                });

                // Sorting logic
                filtered = [...filtered].sort((a, b) => {
                  if (warrantyCommentSort) {
                    const valA = (a.approveComment || '').toLowerCase();
                    const valB = (b.approveComment || '').toLowerCase();
                    return warrantyCommentSort === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
                  }
                  // PRIORITASKAN ITEM YANG SUDAH ADA KOMENTAR APPROVAL NYATA DI PALING ATAS
                  const isRealCommentA = (a.approveComment && a.approveComment.trim() !== '' && !a.approveComment.startsWith('Tidak ada')) ? 1 : 0;
                  const isRealCommentB = (b.approveComment && b.approveComment.trim() !== '' && !b.approveComment.startsWith('Tidak ada')) ? 1 : 0;
                  if (isRealCommentA !== isRealCommentB) {
                    return isRealCommentB - isRealCommentA; // 1 (ada komentar nyata) di atas 0
                  }
                  
                  const dateA = new Date(a.submitTime || 0).getTime();
                  const dateB = new Date(b.submitTime || 0).getTime();
                  return warrantySortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                });

                const itemsPerPage = warrantyItemsPerPage;
                const totalFiltered = filtered.length;
                const totalDisplayPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
                const startIndex = (warrantyDisplayPage - 1) * itemsPerPage;
                const paginatedResults = filtered.slice(startIndex, startIndex + itemsPerPage);

                return (
                  <div className="bg-white border border-zinc-200 rounded-md overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-left">Warranty Code</th>
                        <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-left">Vehicle Info</th>
                        <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-left">Customer</th>
                        <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-left cursor-pointer hover:text-zinc-900 transition-colors group" onClick={() => setWarrantySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                          <div className="flex items-center gap-2">
                            Fault Info & Date
                            <div className="flex flex-col -gap-1">
                              <span className={`text-[7px] font-black leading-none ${warrantySortOrder === 'asc' ? 'text-zinc-900' : 'text-zinc-300'}`}>▲</span>
                              <span className={`text-[7px] font-black leading-none ${warrantySortOrder === 'desc' ? 'text-black' : 'text-zinc-300'}`}>▼</span>
                            </div>
                            <span className="text-[8px] font-medium text-zinc-400 normal-case tracking-normal">
                              ({warrantySortOrder === 'asc' ? 'Awal → Akhir' : 'Akhir → Awal'})
                            </span>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] cursor-pointer hover:text-zinc-900 transition-colors"
                          onClick={() => {
                            setWarrantyCommentSort(prev => prev === 'desc' ? 'asc' : 'desc');
                            setWarrantySortOrder(null); // Clear date sort
                          }}
                        >
                          <div className="flex items-center gap-2">
                            Approval Comment
                            <div className="flex flex-col -gap-1">
                              <span className={`text-[7px] font-black leading-none ${warrantyCommentSort === 'asc' ? 'text-zinc-900' : 'text-zinc-300'}`}>▲</span>
                              <span className={`text-[7px] font-black leading-none ${warrantyCommentSort === 'desc' ? 'text-black' : 'text-zinc-300'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {(() => {
                        if (paginatedResults.length === 0 && filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan="5" className="px-6 py-20 text-center text-zinc-400">
                                <ShieldCheck size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="font-bold italic">Tidak ada data yang sesuai dengan filter.</p>
                              </td>
                            </tr>
                          );
                        }

                        return paginatedResults.map((claim) => {
                          const isAutomaticPass = claim.approveComment?.toLowerCase().includes('automatic approval passes');
                          const isUpdateTask = claim.faultPartName?.toLowerCase().startsWith('update') || 
                                              claim.faultDescription?.toLowerCase().startsWith('update');
                          
                          const isActuallyPending = (claim.status === 1 || !claim.approveComment || claim.approveComment.trim() === '') && !isAutomaticPass && !isUpdateTask;
                          
                          return (
                            <tr id={`claim-row-${claim.id}`} key={claim.id} className="group hover:bg-zinc-50 transition-colors">
                              <td className="px-6 py-5">
                                 <div className="space-y-1">
                                   <p className="text-zinc-900 font-black text-xs tracking-wider font-mono">{claim.code}</p>
                                   <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isActuallyPending ? 'bg-zinc-400 animate-pulse' : 'bg-black'}`}></span>
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${isActuallyPending ? 'bg-zinc-50 border-zinc-300 text-zinc-600' : 'bg-zinc-100 border-zinc-300 text-zinc-900'}`}>
                                        {isActuallyPending ? 'PENDING' : 'PROCESSED'}
                                      </span>
                                   </div>
                                 </div>
                              </td>
                            <td className="px-6 py-5">
                              <p className="text-zinc-900 font-bold text-sm">{claim.licensePlate || '-'}</p>
                              <p className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">{claim.vin}</p>
                            </td>
                            <td className="px-6 py-5">
                              <p className="text-zinc-900 font-medium text-sm">{claim.customerName}</p>
                              <p className="text-[9px] text-zinc-400 uppercase tracking-widest">{claim.contactName || '-'}</p>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                <span className="bg-zinc-100 text-zinc-600 text-[9px] font-black px-2 py-0.5 rounded border border-zinc-200 uppercase w-fit">
                                  {claim.productCode}
                                </span>
                                <p className="text-zinc-900 font-bold text-[11px] uppercase truncate max-w-[150px]">{claim.faultPartName}</p>
                                <p className="text-zinc-500 text-[9px] line-clamp-2 max-w-[150px] leading-tight italic mt-1">"{claim.faultDescription || 'Tidak ada deskripsi'}"</p>
                                <div className="flex items-center gap-1 mt-1 opacity-60">
                                  <Clock size={10} className="text-zinc-500" />
                                  <span className="text-[9px] font-mono text-zinc-500">
                                    {claim.submitTime ? (() => {
                                      const d = new Date(claim.submitTime);
                                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                                      return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
                                    })() : '-'}
                                  </span>
                                </div>
                              </div>
                            </td>
                             <td className="px-6 py-5 max-w-xs">
                               <div className={`p-4 rounded-md border transition-all duration-500 relative group/card ${claim.approveComment ? 'bg-zinc-100 border-zinc-300 text-zinc-900 shadow-sm' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                                 {claim.approveComment && !reviewedClaims.includes(claim.id) && !isAutomaticPass && !isUpdateTask && (
                                   <div className="absolute -top-2 -right-2 bg-black text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg animate-bounce uppercase tracking-tighter">
                                     New Update
                                   </div>
                                 )}
                                 
                                 <p className="text-[11px] font-bold leading-relaxed italic">
                                   {claim.approveComment || 'Menunggu komentar approval...'}
                                 </p>

                                 {(claim.approveTime || commentTimestamps[claim.id]) && (
                                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-200/70 rounded text-[10px] font-mono text-zinc-800 font-bold border border-zinc-300">
                                      <Clock size={11} className="text-zinc-600" />
                                      Waktu Komentar: {claim.approveTime ? new Date(claim.approveTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : new Date(commentTimestamps[claim.id]).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                      {!claim.approveTime && <span className="ml-1 text-[8px] italic text-zinc-500 font-normal">(Waktu Terdeteksi)</span>}
                                    </div>
                                  )}

                                 {claim.approveComment && !isAutomaticPass && !isUpdateTask && (
                                   <div className="mt-3 flex items-center justify-between pt-3 border-t border-zinc-200">
                                      <span className={`text-[8px] font-bold uppercase ${reviewedClaims.includes(claim.id) ? 'text-zinc-400' : 'text-zinc-900'}`}>
                                        {reviewedClaims.includes(claim.id) ? 'Selesai Direview' : 'Belum Direview'}
                                      </span>
                                      {!reviewedClaims.includes(claim.id) ? (
                                        <button 
                                          onClick={() => {
                                            const newReviewed = [...reviewedClaims, claim.id];
                                            setReviewedClaims(newReviewed);
                                            localStorage.setItem('chery_reviewed_claims', JSON.stringify(newReviewed));
                                            Toastify({ text: "✅ Klaim ditandai sebagai sudah direview", style: { background: "#18181b" } }).showToast();
                                          }}
                                          className="bg-black hover:bg-zinc-800 text-white text-[9px] font-black px-3 py-1 rounded-lg transition-all active:scale-95 shadow-lg flex items-center gap-1"
                                        >
                                          <CheckCircle size={10} />
                                          REVIEW SELESAI
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={() => {
                                            const newReviewed = reviewedClaims.filter(id => id !== claim.id);
                                            setReviewedClaims(newReviewed);
                                            localStorage.setItem('chery_reviewed_claims', JSON.stringify(newReviewed));
                                          }}
                                          className="text-zinc-400 hover:text-zinc-500 text-[9px] font-bold transition-colors"
                                        >
                                          Review Kembali
                                        </button>
                                      )}
                                   </div>
                                 )}
                               </div>
                             </td>
                          </tr>
                        );
                      });
                    })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Kontrol (Client-side 20 per page) */}
                {totalFiltered > 0 && (
                  <div className="px-6 py-4 bg-zinc-100 border-t border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Per Page:</span>
                      <select 
                        value={warrantyItemsPerPage}
                        onChange={(e) => {
                          setWarrantyItemsPerPage(Number(e.target.value));
                          setWarrantyDisplayPage(1);
                        }}
                        className="bg-white border border-zinc-300 text-zinc-900 text-xs font-bold py-1.5 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer shadow-sm"
                      >
                        <option value={20}>20 Data</option>
                        <option value={40}>40 Data</option>
                        <option value={50}>50 Data</option>
                      </select>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">
                        Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalFiltered)} of {totalFiltered} Items
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        Page {warrantyDisplayPage} / {totalDisplayPages}
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                             setWarrantyDisplayPage(prev => Math.max(1, prev - 1));
                             document.querySelector('.overflow-x-auto').scrollTop = 0;
                          }}
                          disabled={warrantyDisplayPage === 1}
                          className="p-2 bg-white border border-zinc-300 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 disabled:opacity-30 transition-all active:scale-90 shadow-sm"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <button 
                          onClick={() => {
                             setWarrantyDisplayPage(prev => Math.min(totalDisplayPages, prev + 1));
                             document.querySelector('.overflow-x-auto').scrollTop = 0;
                          }}
                          disabled={warrantyDisplayPage >= totalDisplayPages}
                          className="p-2 bg-white border border-zinc-300 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 disabled:opacity-30 transition-all active:scale-90 shadow-sm"
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Info API Pagination (Jika butuh fetch 500 berikutnya) */}
                {warrantyTotalItems > 500 && (
                   <div className="px-6 py-2 bg-white text-zinc-900 border border-zinc-300 shadow-sm font-bold text-zinc-300 border-t border-zinc-200 flex justify-center">
                      <button 
                        onClick={() => fetchWarrantyClaims(warrantyPageIndex + 1)}
                        className="text-[9px] font-black text-zinc-900 hover:text-zinc-300 uppercase tracking-widest py-1"
                      >
                        Load More from Server (Next 500)
                      </button>
                   </div>
                )}
              </div>
            );
          })()}

          {/* MODAL: DAFTAR KLAIM DENGAN KOMENTAR APPROVAL */}
          {showCommentedListModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-zinc-900">
                <div className="px-6 py-4 bg-black text-white flex items-center justify-between border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-white" />
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-widest">Daftar Klaim Berkomentar</h3>
                      <p className="text-[10px] text-zinc-400 font-medium">Klaim yang telah diberikan tanggapan atau keputusan oleh Pusat Chery</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowCommentedListModal(false)}
                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {(() => {
                    const commentedList = warrantyResults.filter(c => {
                      const lower = (c.approveComment || '').toLowerCase();
                      const isAuto = lower.includes('automatic approval passes') || lower.includes('audit comments: none') || lower.includes('audit comments：none');
                      return c.approveComment && c.approveComment.trim() !== '' && !isAuto;
                    });

                    if (commentedList.length === 0) {
                      return (
                        <div className="text-center py-12 text-zinc-400 font-bold">
                          Belum ada klaim dengan komentar manual dari Pusat saat ini.
                        </div>
                      );
                    }

                    return commentedList.map(item => (
                      <div 
                        key={item.id} 
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${reviewedClaims.includes(item.id) ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-white border-zinc-300 shadow-lg hover:border-zinc-900'}`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300">{item.code}</span>
                            <span className="text-[10px] font-bold text-zinc-600">{item.customerName || 'N/A'}</span>
                            {reviewedClaims.includes(item.id) ? (
                              <span className="text-[9px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-300 flex items-center gap-1">
                                <CheckCircle size={10} /> Selesai Direview
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-black bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-300">
                                Butuh Tindakan
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-zinc-900 italic pt-1">
                            "{item.approveComment}"
                          </p>
                          <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-medium">
                            <span>VIN: {item.vin}</span>
                            <span>Keluhan: {item.faultDescription || item.faultPartName || 'N/A'}</span>
                            {item.approveTime && <span>Waktu: {new Date(item.approveTime).toLocaleDateString('id-ID')}</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setShowCommentedListModal(false);
                            if (warrantyStatusFilter.includes("1") && !warrantyStatusFilter.includes("2")) {
                              setWarrantyStatusFilter(['2']);
                            }
                            const itemIndex = warrantyResults.findIndex(c => c.id === item.id);
                            if (itemIndex !== -1) {
                              const targetPage = Math.floor(itemIndex / warrantyItemsPerPage) + 1;
                              setWarrantyDisplayPage(targetPage);
                            }
                            setTimeout(() => {
                              const row = document.getElementById(`claim-row-${item.id}`);
                              if (row) {
                                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                row.classList.add('ring-4', 'ring-black', 'bg-zinc-50', 'transition-all');
                                setTimeout(() => row.classList.remove('ring-4', 'ring-black', 'bg-zinc-50'), 4000);
                              }
                            }, 300);
                          }}
                          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 whitespace-nowrap flex items-center gap-1"
                        >
                          <Search size={12} />
                          Lihat di Tabel
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
            </div>
          )}

          {/* ====== TAB: PART ORDERS ====== */}
          {activeTab === 'part_orders' && (
            <div className="space-y-4">
              {/* Search Controls (Compact & Elegant) */}
              <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-xl space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-zinc-900 text-white rounded-md flex items-center justify-center font-black shadow-sm shrink-0">
                      <Truck size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest leading-none">Tracking Pemesanan Part</h3>
                      <p className="text-[11px] font-medium text-zinc-500 mt-1">Pantau status pesanan, rincian pengiriman SAP, dan alokasi per customer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        type="text" 
                        value={partOrderSearchCode}
                        onChange={(e) => setPartOrderSearchCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchPartOrders(0, partOrderSearchCode)}
                        placeholder="Cari No Order (DD...)"
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-md pl-8 pr-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all shadow-inner"
                      />
                    </div>
                    <button 
                      onClick={() => fetchPartOrders(0, partOrderSearchCode)}
                      disabled={isPartOrdersLoading}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[11px] uppercase tracking-widest rounded-md shadow transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 active:scale-95"
                    >
                      <RefreshCw size={12} className={isPartOrdersLoading ? 'animate-spin' : ''} />
                      {isPartOrdersLoading ? 'Mencari...' : 'Cari'}
                    </button>
                    {partOrderSearchCode && (
                      <button 
                        onClick={() => { setPartOrderSearchCode(''); fetchPartOrders(0, ''); }}
                        className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold text-[11px] uppercase rounded-md transition-all active:scale-95"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table Orders (Compact & Clean) */}
              <div className="bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 text-white uppercase text-[10px] font-black tracking-wider border-b border-zinc-800">
                        <th className="px-4 py-3">Order Code</th>
                        <th className="px-4 py-3">Tanggal Submit</th>
                        <th className="px-4 py-3">Pembuat</th>
                        <th className="px-4 py-3">Item & Nilai</th>
                        <th className="px-4 py-3">Keterangan / Remark</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Rincian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-xs font-medium text-zinc-700">
                      {isPartOrdersLoading && partOrders.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-10 text-zinc-400 font-bold text-xs">
                            <RefreshCw className="mx-auto animate-spin mb-2 text-zinc-900" size={20} />
                            Memuat daftar pemesanan...
                          </td>
                        </tr>
                      ) : partOrders.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-10 text-zinc-400 font-bold text-xs">
                            Tidak ada data pemesanan part yang ditemukan.
                          </td>
                        </tr>
                      ) : (
                        partOrders.map(order => (
                          <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono font-black text-zinc-900 text-[11px] whitespace-nowrap">{order.code}</td>
                            <td className="px-4 py-2.5 text-[11px] whitespace-nowrap">
                              {order.submitTime ? new Date(order.submitTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                            </td>
                            <td className="px-4 py-2.5 font-bold text-zinc-900 text-[11px] capitalize whitespace-nowrap">{order.submitterName || order.creatorName || '-'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="font-bold text-zinc-900 text-[11px]">{order.orderingVarietySum || 0} Macam</span>
                              <div className="text-[10px] text-zinc-500 font-mono">Rp {(order.orderinglFeeSum || order.outFee || 0).toLocaleString('id-ID')}</div>
                            </td>
                            <td className="px-4 py-2.5 max-w-sm truncate italic font-bold text-zinc-800 text-[11px]">{order.remark || '-'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border inline-block ${
                                order.status === 4 ? 'bg-zinc-100 text-black border-zinc-300' :
                                order.status === 3 ? 'bg-zinc-50 text-black border-zinc-300' :
                                'bg-zinc-50 text-zinc-700 border-zinc-200'
                              }`}>
                                {order.status === 4 ? 'Selesai Dikirim' : order.status === 3 ? 'Diproses Pusat' : `Status: ${order.status}`}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button 
                                onClick={() => fetchPartOrderDetail(order.id)}
                                disabled={isPartOrderDetailLoading}
                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-wider rounded shadow transition-all active:scale-95 inline-flex items-center gap-1.5"
                              >
                                <PackageSearch size={12} />
                                Lihat Detail
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between font-bold text-xs">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-widest">Halaman {partOrdersPage + 1}</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => fetchPartOrders(Math.max(0, partOrdersPage - 1), partOrderSearchCode)}
                      disabled={partOrdersPage === 0 || isPartOrdersLoading}
                      className="px-2.5 py-1 bg-white border border-zinc-300 rounded text-zinc-700 hover:text-zinc-900 disabled:opacity-30 shadow-sm transition-all"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button 
                      onClick={() => fetchPartOrders(partOrdersPage + 1, partOrderSearchCode)}
                      disabled={partOrders.length < 10 || isPartOrdersLoading}
                      className="px-2.5 py-1 bg-white border border-zinc-300 rounded text-zinc-700 hover:text-zinc-900 disabled:opacity-30 shadow-sm transition-all"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* MODAL / DRAWER DETAIL PART ORDER (Compact & Ultra Wide) */}
              {selectedPartOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 my-4">
                    <div className="p-5 bg-zinc-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 shrink-0">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <Truck size={20} className="text-black" />
                          <h2 className="font-mono font-black text-base tracking-tight">{selectedPartOrder.code}</h2>
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                            selectedPartOrder.status === 4 ? 'bg-zinc-100 text-black border-zinc-300' : 'bg-zinc-100 text-black border-zinc-300'
                          }`}>
                            {selectedPartOrder.status === 4 ? 'Selesai Dikirim' : selectedPartOrder.status === 3 ? 'Diproses Pusat' : `Status: ${selectedPartOrder.status}`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 font-bold tracking-wide">
                          Dealer: <span className="text-white">{selectedPartOrder.orderingCompanyName || 'ORIENTAL SM RAJA AMPLAS'}</span> · Item: <span className="text-white">{selectedPartOrder.outVarietySum || selectedPartOrder.details?.length || 0} Macam</span> · Nilai: <span className="text-white font-mono font-bold">Rp {(selectedPartOrder.outFeeSum || selectedPartOrder.orderinglFeeSum || 0).toLocaleString('id-ID')}</span>
                        </p>
                        {selectedPartOrder.remark && (
                          <p className="text-[11px] text-zinc-300 font-bold italic pt-0.5">
                            Remark: "{selectedPartOrder.remark}"
                          </p>
                        )}
                      </div>
                      <button 
                        onClick={() => setSelectedPartOrder(null)}
                        className="p-1.5 text-zinc-400 hover:text-white transition-colors self-end md:self-center bg-zinc-800 rounded-full hover:bg-zinc-700"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                      {/* SECTION 1: DAFTAR AWAL PESANAN DEALER */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                          <h4 className="font-black text-xs text-zinc-900 uppercase tracking-widest flex items-center gap-1.5">
                            <Package size={16} className="text-zinc-900" />
                            Daftar Awal Pesanan Dealer ({selectedPartOrder.details?.length || 0} Item)
                          </h4>
                          <span className="text-[11px] text-zinc-500 font-bold">Waktu Submit: {selectedPartOrder.submitTime ? new Date(selectedPartOrder.submitTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>
                        </div>

                        <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                            <thead>
                              <tr className="bg-zinc-100 text-zinc-600 uppercase text-[9px] font-black tracking-widest border-b border-zinc-200">
                                <th className="px-3 py-2">No</th>
                                <th className="px-3 py-2">Kode Part</th>
                                <th className="px-3 py-2">Nama Barang</th>
                                <th className="px-3 py-2 text-center">Qty Pesan</th>
                                <th className="px-3 py-2 text-right">Harga Satuan</th>
                                <th className="px-3 py-2 text-right">Total Harga</th>
                                <th className="px-3 py-2">Alokasi Customer / Keterangan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
                              {!selectedPartOrder.details || selectedPartOrder.details.length === 0 ? (
                                <tr>
                                  <td colSpan="7" className="text-center py-6 text-zinc-400 font-bold text-[11px]">Tidak ada rincian item pesanan.</td>
                                </tr>
                              ) : (
                                selectedPartOrder.details.map((item, idx) => (
                                  <tr key={item.partId || idx} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-3 py-2 font-bold text-zinc-500 text-[11px]">{idx + 1}</td>
                                    <td className="px-3 py-2 font-mono font-black text-zinc-900 text-[11px]">{item.partCode}</td>
                                    <td className="px-3 py-2 font-bold text-zinc-900 text-[11px]">{item.partName}</td>
                                    <td className="px-3 py-2 text-center font-bold text-zinc-900 text-[11px] bg-zinc-50/50">{item.orderQuantity || item.outQuantitySum || 0}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[11px]">Rp {(item.orderPrice || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-3 py-2 text-right font-mono font-black text-zinc-900 text-[11px]">Rp {(item.orderFee || ((item.orderPrice || 0) * (item.orderQuantity || 1))).toLocaleString('id-ID')}</td>
                                    <td className="px-3 py-2">
                                      {item.orderDescription && item.orderDescription.trim() !== '' ? (
                                        <div className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded text-[10px] font-black text-black uppercase tracking-wide leading-normal inline-block shadow-sm">
                                          {item.orderDescription}
                                        </div>
                                      ) : (
                                        <span className="text-zinc-400 italic text-[10px]">Stok Reguler / Tanpa Keterangan</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* SECTION 2: RIWAYAT PROSES & PENGIRIMAN PUSAT */}
                      <div className="space-y-3 pt-2">
                        <div className="border-b border-zinc-200 pb-2 flex items-center justify-between">
                          <h4 className="font-black text-xs text-zinc-900 uppercase tracking-widest flex items-center gap-1.5">
                            <Truck size={16} className="text-black" />
                            Riwayat Pengiriman & SAP Split ({selectedPartOrder.partSaleOrderProcesses?.length || 0} Paket)
                          </h4>
                          <span className="text-[11px] text-zinc-500 font-bold">Diproses oleh: {selectedPartOrder.processerName || 'Pusat Chery'}</span>
                        </div>

                        {!selectedPartOrder.partSaleOrderProcesses || selectedPartOrder.partSaleOrderProcesses.length === 0 ? (
                          <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-zinc-500 font-bold text-[11px]">
                            Pesanan ini belum memiliki rincian pengiriman SAP atau belum diproses menjadi surat jalan oleh Pusat Chery.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedPartOrder.partSaleOrderProcesses.map((proc, pIdx) => (
                              <div key={proc.id || pIdx} className="border border-zinc-300 bg-white rounded-xl overflow-hidden shadow-md transition-all hover:border-zinc-900">
                                <div className="p-3 bg-zinc-100 border-b border-zinc-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2 py-1 bg-zinc-900 text-white font-black text-[11px] rounded shadow-sm">PENGIRIMAN #{pIdx + 1}</span>
                                      <span className="font-mono font-black text-xs text-zinc-900">{proc.code}</span>
                                      {proc.sapDeliveryCode && (
                                        <div className="flex flex-wrap items-center gap-2 ml-1">
                                          <span className="px-2.5 py-1 bg-zinc-100 text-black font-mono font-black text-[11px] rounded border border-zinc-300 shadow-sm flex items-center gap-1">
                                            SAP Resi: {proc.sapDeliveryCode}
                                          </span>
                                          <button 
                                            onClick={() => handleInAppTracking(proc.sapDeliveryCode)}
                                            className="px-3 py-1 bg-black hover:bg-zinc-800 text-white font-black text-[11px] uppercase tracking-wider rounded shadow transition-all flex items-center gap-1.5 active:scale-95"
                                            title="Tarik & tampilkan rincian resi Jagoan Logistics langsung di dalam aplikasi"
                                          >
                                            <Truck size={12} />
                                            Lacak Paket Jagoan (Di Dalam Aplikasi)
                                          </button>
                                          <a 
                                            href={`https://jagoan-logistics.com/?track=${encodeURIComponent(proc.sapDeliveryCode.replace(/^0+/, ''))}`}
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white font-black text-[11px] uppercase tracking-wider rounded shadow transition-all flex items-center gap-1 active:scale-95 border border-zinc-700"
                                            title="Buka web resmi Jagoan Logistics"
                                          >
                                            <ExternalLink size={12} />
                                            Web
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-zinc-600 font-bold flex items-center gap-3">
                                      <span>Gudang: <strong className="text-zinc-900">{proc.shippingWarehouseName || proc.shippingCompanyName || 'DHL'} ({proc.shippingWarehouseCode || 'Y004'})</strong></span>
                                      <span>Waktu Keluar: <strong className="text-zinc-900">{proc.processTime ? new Date(proc.processTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</strong></span>
                                    </div>
                                  </div>
                                  <div className="bg-white px-3 py-1.5 rounded border border-zinc-300 shadow-sm text-right">
                                    <span className="text-[8px] uppercase font-black text-zinc-500 block leading-tight">Total Pengiriman Ini</span>
                                    <span className="font-mono font-black text-zinc-900 text-[11px]">{proc.outVarietySum || proc.processDetails?.length || 0} Macam · Rp {(proc.outFeeSum || 0).toLocaleString('id-ID')}</span>
                                  </div>
                                </div>

                                <div className="p-3 bg-white">
                                  <h5 className="text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1.5">Daftar Barang dalam Pengiriman Ini:</h5>
                                  <div className="border border-zinc-200 rounded-lg overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                                      <thead>
                                        <tr className="bg-zinc-50 text-zinc-500 text-[9px] font-black uppercase tracking-wider border-b border-zinc-200">
                                          <th className="px-3 py-2">Kode Part</th>
                                          <th className="px-3 py-2">Nama Barang</th>
                                          <th className="px-3 py-2 text-center">Qty Dikirim</th>
                                          <th className="px-3 py-2 text-right">Subtotal</th>
                                          <th className="px-3 py-2">Pesanan Customer / Keterangan (Otomatis)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800">
                                        {!proc.processDetails || proc.processDetails.length === 0 ? (
                                          <tr>
                                            <td colSpan="5" className="text-center py-4 text-zinc-400 font-bold text-[11px]">Tidak ada rincian item dalam pengiriman ini.</td>
                                          </tr>
                                        ) : (
                                          proc.processDetails.map((pItem, pItemIdx) => {
                                            const matchedInitial = selectedPartOrder.details?.find(d => d.partCode === pItem.partCode);
                                            const custDesc = matchedInitial?.orderDescription;
                                            
                                            return (
                                              <tr key={pItem.partId || pItemIdx} className="hover:bg-zinc-50/80 transition-colors">
                                                <td className="px-3 py-2 font-mono font-black text-zinc-900 text-[11px]">{pItem.partCode}</td>
                                                <td className="px-3 py-2 font-bold text-zinc-900 text-[11px]">{pItem.partName}</td>
                                                <td className="px-3 py-2 text-center font-black text-black text-[11px] bg-zinc-50/50">{pItem.processQuantity || pItem.deliveryQuantity || pItem.outQuantity || 0}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-zinc-900 text-[11px]">Rp {(pItem.outFee || ((pItem.orderPrice || 0) * (pItem.processQuantity || 1))).toLocaleString('id-ID')}</td>
                                                <td className="px-3 py-2">
                                                  {custDesc && custDesc.trim() !== '' ? (
                                                    <div className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded text-[10px] font-black text-black uppercase tracking-wide shadow-sm flex items-center gap-1.5 leading-normal inline-block">
                                                      <CheckCircle size={10} className="text-black shrink-0 inline mr-1" />
                                                      <span>{custDesc}</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-zinc-400 italic text-[10px]">Stok Reguler Dealer</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== TAB: USERS ====== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-md px-4 py-3 flex items-center gap-3">
                <Users size={16} className="text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cari berdasarkan nama, username, atau role..."
                  className="flex-1 bg-transparent text-zinc-900 text-sm placeholder:text-zinc-400 outline-none font-medium"
                />
                {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-zinc-500 hover:text-zinc-900" /></button>}
              </div>

              {/* User List */}
              <div className="grid gap-3">
                {filteredUsers.map(u => {
                  const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
                  const isCurrentUser = u.username === user?.username;
                  const isActiveNow = u.isOnline && u.sessionId;
                  return (
                    <div key={u.username}
                      className={`bg-white border rounded-lg p-5 flex flex-col md:flex-row gap-4 md:items-center transition-all
                        ${isActiveNow ? 'border-zinc-400' : 'border-zinc-200'}`}>

                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-md flex items-center justify-center font-black text-lg
                          ${isCurrentUser ? 'bg-white border border-zinc-300 text-black' : 'bg-zinc-100 text-zinc-500'}`}>
                          {u.name?.[0] || '?'}
                        </div>
                        {isActiveNow && <span className="absolute -top-1 -right-1 w-3 h-3 bg-black rounded-full border-2 border-white" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-900 font-bold">{u.name}</span>
                          <span className="text-zinc-500 text-xs">@{u.username}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${roleStyle.bg} ${roleStyle.text}`}>{u.role}</span>
                          {isCurrentUser && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-zinc-200 text-zinc-900">Anda</span>}
                          {isActiveNow && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-zinc-100 text-black border border-zinc-300">● Online</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-zinc-500 text-[11px]">
                          {u.lastDevice && <span className="flex items-center gap-1"><DeviceIcon device={u.lastDevice} /> {u.lastDevice}</span>}
                          {u.lastBrowser && <span className="flex items-center gap-1"><Globe size={11} /> {u.lastBrowser}</span>}
                          {u.lastIP && <span className="flex items-center gap-1 font-mono"><Wifi size={11} /> {u.lastIP}</span>}
                          {u.lastLocation && <span className="flex items-center gap-1"><MapPin size={11} /> {u.lastLocation}</span>}
                          {u.lastLogin && <span className="flex items-center gap-1"><Clock size={11} /> {u.lastLogin}</span>}
                          {u.lastLocation && u.lastLocation.includes('(') && (
                            <button 
                              onClick={() => {
                                const coords = u.lastLocation.split('(')[1].replace(')', '');
                                navigator.clipboard.writeText(coords);
                                Toastify({ text: "📍 Coordinate Copied!", style: { background: "#18181b" }, duration: 2000 }).showToast();
                              }}
                              className="flex items-center gap-1 text-zinc-500 hover:text-black transition-colors"
                            >
                              <MapPin size={11} /> {u.lastLocation.split('(')[1].replace(')', '')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {!isCurrentUser && (
                        <div className="flex items-center gap-2 shrink-0">
                          {isActiveNow && (
                            <button onClick={() => setModal({ type: 'forceLogout', user: u })}
                              className="p-2.5 bg-zinc-50 hover:bg-zinc-200 text-black rounded-md transition-all border border-zinc-200" title="Force Logout">
                              <XCircle size={16} />
                            </button>
                          )}
                          <button onClick={() => { setModal({ type: 'resetPassword', user: u }); setNewPassword(''); }}
                            className="p-2.5 bg-zinc-50 hover:bg-zinc-200 text-black rounded-md transition-all border border-zinc-200" title="Reset Password">
                            <Key size={16} />
                          </button>
                          <button onClick={() => setModal({ type: 'deleteUser', user: u })}
                            className="p-2.5 bg-zinc-50 hover:bg-zinc-200 text-black rounded-md transition-all border border-zinc-200" title="Hapus User">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====== TAB: NOTIFICATION SOUND ====== */}
          {activeTab === 'notification_sound' && (
            <div className="space-y-6">
              {/* Current Sound */}
              <div className="bg-white border border-zinc-200 rounded-lg p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-center">
                    <Volume2 size={28} className="text-black" />
                  </div>
                  <div>
                    <h3 className="text-zinc-900 font-black text-lg">Konfigurasi Notifikasi Suara</h3>
                    <p className="text-zinc-500 text-xs font-medium">Aktifkan atau matikan suara pengumuman "Mobil [BK] Selesai" secara global.</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* ON/OFF Switch */}
                  <div className="flex-1 bg-zinc-100 border border-zinc-200 rounded-md p-6 flex items-center justify-between">
                    <div>
                      <p className="text-zinc-900 font-black text-sm mb-1 uppercase tracking-tight">Status Notifikasi</p>
                      <p className="text-zinc-500 text-[10px] font-medium">Jika OFF, suara tidak akan berbunyi.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isSoundEnabled ? 'text-black' : 'text-zinc-400'}`}>
                        {isSoundEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <button 
                        onClick={handleToggleSound}
                        className={`relative w-14 h-8 rounded-full transition-all duration-300 border-2 ${isSoundEnabled ? 'bg-black border-black shadow-lg' : 'bg-zinc-200 border-zinc-300'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${isSoundEnabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Intro Tip */}
                  <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-md p-6 flex items-center gap-4">
                    <div className="p-3 bg-white border border-zinc-200 rounded-md">
                      <Volume2 size={24} className="text-black" />
                    </div>
                    <div>
                      <p className="text-zinc-900 font-black text-sm mb-1">Intro Kustom</p>
                      <p className="text-zinc-500 text-[10px] font-medium">Suara upload di bawah akan menjadi "Intro" Bell sebelum TTS.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-200 pt-8">
                  <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Preview & Kelola File</h4>
                  {notifSoundUrl ? (
                    <div className="bg-zinc-100 border border-zinc-200 rounded-md p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button onClick={handlePlayPreview}
                            className={`w-12 h-12 rounded-md flex items-center justify-center transition-all shadow-lg ${isPlaying ? 'bg-black hover:bg-zinc-800' : 'bg-black hover:bg-zinc-800'} text-white`}>
                            {isPlaying ? <Square size={18} /> : <Play size={18} />}
                          </button>
                          <div>
                            <p className="text-zinc-900 font-bold text-sm">Preview</p>
                            <p className="text-zinc-500 text-[10px] font-mono truncate max-w-[200px]">{notifSoundUrl.split('/').pop()}</p>
                          </div>
                        </div>
                        <button onClick={async () => {
                           if(window.confirm('Hapus suara kustom?')) {
                              await db.delete('settings', { eq: { key: 'notification_sound_url' } });
                             setNotifSoundUrl('');
                             Toastify({ text: 'Kembali ke default', style: { background: '#18181b' } }).showToast();
                           }
                        }}
                          className="p-2.5 bg-zinc-50 hover:bg-zinc-200 text-black rounded-md transition-all border border-zinc-200">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-md p-8 text-center text-zinc-500 font-bold text-sm">
                      Menggunakan Suara Bawaan Sistem
                    </div>
                  )}
                </div>
              </div>

              {/* Upload & URL Section */}
              <div className="bg-white border border-zinc-200 rounded-lg p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div 
                    onClick={() => soundFileRef.current?.click()}
                    className="relative bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-md p-10 text-center cursor-pointer hover:bg-zinc-100 transition-all group"
                  >
                    <input type="file" ref={soundFileRef} className="hidden" accept="audio/*" onChange={handleUploadSound} />
                    <Upload size={28} className="text-zinc-900 mx-auto mb-4" />
                    <p className="text-zinc-900 font-black text-sm mb-1 uppercase tracking-tight">Upload File Audio</p>
                    {isUploadingSound && <p className="text-zinc-900 text-[10px] animate-pulse">Uploading...</p>}
                  </div>

                  <div className="bg-zinc-100 border border-zinc-200 rounded-md p-8">
                    <h4 className="text-zinc-900 font-black text-xs mb-4 uppercase tracking-widest text-zinc-500 px-1">Atau Manual URL</h4>
                    <input 
                      type="text" 
                      placeholder="https://example.com/sound.mp3"
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-4 py-3 text-xs text-zinc-900 outline-none focus:border-zinc-2000 transition-all mb-4"
                      onKeyDown={async (e) => {
                         if (e.key === 'Enter' && e.target.value) {
                             await db.upsert('settings', { key: 'notification_sound_url', value: e.target.value }, { onConflict: 'key' });
                            setNotifSoundUrl(e.target.value);
                            Toastify({ text: '✅ URL Saved!', style: { background: '#10b981' } }).showToast();
                            e.target.value = '';
                         }
                      }}
                    />
                    <p className="text-[9px] text-[#9CA3AF] italic leading-relaxed">
                      *Tekan <b>ENTER</b> untuk simpan. <br/>
                      *Gunakan jika upload bermasalah (pastikan bucket "audio" di Supabase sudah Public).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== TAB: RIWAYAT HAPUS ====== */}
          {activeTab === 'deleted_bookings' && (
            <div className="space-y-4">
              {deletedBookings.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
                  <Trash2 size={40} className="text-zinc-400 mx-auto mb-4" />
                  <p className="text-zinc-500 font-bold">Belum ada data booking yang dihapus.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {deletedBookings.map(b => (
                    <div key={b.id} className="bg-white border border-zinc-300 rounded-lg p-5 flex flex-col md:flex-row gap-4 md:items-center transition-all hover:border-black">
                      <div className="w-12 h-12 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-center font-black text-black text-lg shrink-0">
                        {b.namaCustomer?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-900 font-bold text-base">{b.namaCustomer}</span>
                          <span className="text-zinc-500 text-xs font-mono">{b.noPlat}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-zinc-100 text-black border border-zinc-300">
                            DELETED
                          </span>
                        </div>
                        <p className="text-zinc-600 text-xs font-bold leading-tight">{b.bookingVia}</p>
                        <p className="text-zinc-500 text-[10px] mt-1 line-clamp-1">
                          🚗 <span className="font-bold">{b.tipeMobil}</span> • ⏳ {b.tanggal} Jam {b.jam} • 🛠️ {b.keperluanService}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <button onClick={async () => {
                          if(!window.confirm('Kembalikan data ini ke Antrian Booking CRO?')) return;
                          await db.update('booking', { status: 'waiting confirm', bookingVia: b.bookingVia.replace(/Dihapus_Oleh: .*? - /, '') }, { eq: { id: b.id } });
                          fetchDeletedBookings();
                          Toastify({ text: "✅ Data berhasil di-Restore!", style: { background: "#18181b" } }).showToast();
                        }}
                          className="px-4 py-2 bg-white border border-black text-black hover:bg-black hover:text-white rounded-md text-xs font-bold transition-all flex items-center gap-2"
                        >
                           Restore Data
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ====== MODALS ====== */}
      {modal.type && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-8 w-full max-w-md shadow-2xl">

            {/* Reset All Sessions Modal */}
            {modal.type === 'resetAll' && (
              <>
                <div className="w-16 h-16 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <RefreshCw size={32} className="text-black" />
                </div>
                <h3 className="text-zinc-900 font-black text-xl text-center mb-2">Reset Semua Sesi?</h3>
                <p className="text-zinc-500 text-center text-sm mb-8">
                  Fitur ini akan <span className="text-black font-bold">memaksa logout</span> semua perangkat dan akun yang saat ini terhubung, <span className="text-zinc-900 font-bold underline">kecuali akun Anda sendiri</span>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-md bg-zinc-50 hover:bg-zinc-200 text-zinc-600 font-bold text-sm transition-all border border-zinc-200">
                    Batal
                  </button>
                  <button onClick={handleResetAllSessions}
                    className="flex-1 py-3 rounded-md bg-black hover:bg-zinc-800 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg">
                    <CheckCircle size={16} /> Ya, Reset Semua
                  </button>
                </div>
              </>
            )}

            {/* Force Logout Modal */}
            {modal.type === 'forceLogout' && (
              <>
                <div className="w-16 h-16 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={32} className="text-black" />
                </div>
                <h3 className="text-zinc-900 font-black text-xl text-center mb-2">Force Logout?</h3>
                <p className="text-zinc-500 text-center text-sm mb-8">
                  Pengguna <span className="text-zinc-900 font-bold">{modal.user?.name}</span> akan segera dikeluarkan dari semua sesi aktif mereka.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-md bg-zinc-50 hover:bg-zinc-200 text-zinc-600 font-bold text-sm transition-all border border-zinc-200">
                    Batal
                  </button>
                  <button onClick={() => handleForceLogout(modal.user)}
                    className="flex-1 py-3 rounded-md bg-black hover:bg-zinc-800 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                    <LogOut size={16} /> Ya, Keluarkan
                  </button>
                </div>
              </>
            )}

            {/* Reset Password Modal */}
            {modal.type === 'resetPassword' && (
              <>
                <div className="w-16 h-16 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Key size={32} className="text-black" />
                </div>
                <h3 className="text-zinc-900 font-black text-xl text-center mb-2">Reset Password</h3>
                <p className="text-zinc-500 text-center text-sm mb-6">
                  Atur password baru untuk <span className="text-zinc-900 font-bold">{modal.user?.name}</span>.
                  User ini akan otomatis dikeluarkan dari sesi aktif.
                </p>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Password baru (min. 6 karakter)"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-md px-4 py-3 text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-black font-medium mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-md bg-zinc-50 hover:bg-zinc-200 text-zinc-600 font-bold text-sm transition-all border border-zinc-200">
                    Batal
                  </button>
                  <button onClick={handleResetPassword}
                    className="flex-1 py-3 rounded-md bg-black hover:bg-zinc-800 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                    <CheckCircle size={16} /> Simpan Password
                  </button>
                </div>
              </>
            )}

            {/* Delete User Modal */}
            {modal.type === 'deleteUser' && (
              <>
                <div className="w-16 h-16 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} className="text-black" />
                </div>
                <h3 className="text-zinc-900 font-black text-xl text-center mb-2">Hapus User?</h3>
                <p className="text-zinc-500 text-center text-sm mb-2">
                  Tindakan ini akan <span className="text-black font-bold">menghapus permanen</span> akun milik:
                </p>
                <p className="text-zinc-900 font-black text-center text-lg mb-8">{modal.user?.name} <span className="text-zinc-500 font-medium text-sm">(@{modal.user?.username})</span></p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ type: null, user: null })}
                    className="flex-1 py-3 rounded-md bg-zinc-50 hover:bg-zinc-200 text-zinc-600 font-bold text-sm transition-all border border-zinc-200">
                    Batal
                  </button>
                  <button onClick={() => handleDeleteUser(modal.user)}
                    className="flex-1 py-3 rounded-md bg-black hover:bg-zinc-800 text-white font-black text-sm transition-all flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Ya, Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ====== OWNER EDIT UNIT MODAL ====== */}
      {isEditing && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-md p-8 w-full max-w-2xl shadow-2xl relative overflow-hidden animate-fade-in">
             <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 rounded-bl-full -z-10"></div>
             
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white text-zinc-900 border border-zinc-300 shadow-sm font-bold rounded-md text-zinc-900 shadow-lg shadow-white/10">
                      <Car size={24} />
                   </div>
                   <div>
                      <h3 className="text-zinc-900 font-black text-xl tracking-tight uppercase">Edit Unit Data</h3>
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Direct Owner Database Access</p>
                   </div>
                </div>
                <button onClick={handleCancelEdit} className="p-2 bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-md transition-all">
                   <X size={20} />
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-2">Nomor Polisi</label>
                   <input 
                      type="text" 
                      value={formData.bk} 
                      onChange={(e) => setFormData({...formData, bk: e.target.value.toUpperCase()})}
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-3.5 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all uppercase"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-2">Tipe Mobil</label>
                   <input 
                      type="text" 
                      value={formData.tipe} 
                      onChange={(e) => setFormData({...formData, tipe: e.target.value.toUpperCase()})}
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-3.5 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all uppercase"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-2">Kategori</label>
                   <select 
                      value={formData.category} 
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-3.5 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all"
                   >
                      <option value="Reguler" className="bg-white">Reguler</option>
                      <option value="Booking" className="bg-white">Booking</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-2">Assign Mechanic</label>
                   <select 
                      value={formData.mechanicName || ''} 
                      onChange={(e) => setFormData({...formData, mechanicName: e.target.value})}
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-3.5 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all"
                   >
                      <option value="" className="bg-white">-- Belum Assigned --</option>
                      {mechanics.map(m => (
                         <option key={m.name} value={m.name} className="bg-white">{m.name}</option>
                      ))}
                   </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-2">Keluhan / Service Detail</label>
                   <textarea 
                      rows="3"
                      value={formData.keluhan} 
                      onChange={(e) => setFormData({...formData, keluhan: e.target.value})}
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-3.5 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all uppercase resize-none"
                   />
                </div>
             </div>

             <div className="flex gap-4">
                <button onClick={handleCancelEdit} className="flex-1 py-4 rounded-md bg-zinc-100 hover:bg-zinc-100 text-zinc-600 font-bold transition-all">Batal</button>
                <button 
                   disabled={isLoadingProcess}
                   onClick={handleSave} 
                   className="flex-2 flex-[2] py-4 rounded-md bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm uppercase tracking-widest transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-2"
                >
                   {isLoadingProcess ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle size={18} /> Simpan Perubahan</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Manual EPCM Selector Modal */}
      {editingPartIdx !== null && selectedParts[editingPartIdx] && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-md p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95 duration-300">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Update Part Information</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Direct Edit: {selectedParts[editingPartIdx].code}</p>
                </div>
                <button onClick={() => setEditingPartIdx(null)} className="w-12 h-12 bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-black rounded-md flex items-center justify-center transition-all">
                  <X size={24} />
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-4 custom-scrollbar">
                {/* Form Section */}
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-2">Part Name</label>
                      <input 
                        type="text"
                        value={selectedParts[editingPartIdx].name}
                        onChange={(e) => handleUpdatePartManual(editingPartIdx, { name: e.target.value })}
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-4 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-2">Retail Price (IDR)</label>
                      <input 
                        type="number"
                        value={selectedParts[editingPartIdx].price}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          handleUpdatePartManual(editingPartIdx, { 
                            price: val, 
                            priceExc: Math.round(val / 1.11)
                          });
                        }}
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-4 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all font-mono"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-2">Model Tipe / Grouping</label>
                      <input 
                        type="text"
                        value={selectedParts[editingPartIdx].models}
                        onChange={(e) => handleUpdatePartManual(editingPartIdx, { models: e.target.value })}
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-md px-5 py-4 text-zinc-900 font-bold outline-none focus:border-zinc-2000 transition-all"
                      />
                   </div>
                </div>

                {/* Manual EPCM Search / Image Browser */}
                <div className="bg-zinc-100 rounded-lg p-6 border border-zinc-200 space-y-4">
                   <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-2">Manual EPCM Image Search</label>
                   <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input 
                          type="text" 
                          value={manualSearchQuery}
                          onChange={(e) => setManualSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && fetchEpcImages(manualSearchQuery)}
                          placeholder="Masukkan Part Number..."
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-md pl-12 pr-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-2000 transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => fetchEpcImages(manualSearchQuery)}
                        disabled={isManualSearching}
                        className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm px-4 rounded-md transition-all"
                      >
                        <Search size={18} />
                      </button>
                   </div>

                   {/* Image Results */}
                   <div className="grid grid-cols-2 gap-3 mt-4 h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {epcmImages[manualSearchQuery || selectedParts[editingPartIdx].code]?.map((img, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            const partCode = manualSearchQuery || selectedParts[editingPartIdx].code;
                            const details = epcmDetails[partCode];
                            const combinedModels = getCombinedModels(details);
                            handleUpdatePartManual(editingPartIdx, { 
                              image: img, 
                              models: combinedModels 
                            });
                          }}
                          className={`aspect-square bg-zinc-100 rounded-md border-2 cursor-pointer hover:border-zinc-2000 transition-all flex items-center justify-center p-2
                            ${selectedParts[editingPartIdx].image === img ? 'border-black shadow-lg' : 'border-zinc-200'}`}
                        >
                           <img src={img} className="w-full h-full object-contain" alt="Option" />
                        </div>
                      ))}
                      {(!epcmImages[manualSearchQuery || selectedParts[editingPartIdx].code]) && (
                        <div className="col-span-2 h-full flex flex-col items-center justify-center text-zinc-300 italic text-[10px]">
                          <ExternalLink size={24} className="mb-2 opacity-5" />
                          Cari part number di atas untuk mengambil gambar...
                        </div>
                      )}
                   </div>
                </div>
             </div>
             
             <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => {
                    setEditingPartIdx(null);
                    Toastify({ text: "✅ Data part diperbarui!", style: { background: '#10b981' } }).showToast();
                  }}
                  className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm uppercase text-sm px-10 py-4 rounded-md shadow-xl shadow-white/10 transition-all active:scale-95"
                >
                  SIMPAN PERUBAHAN
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL IN-APP TRACKING JAGOAN LOGISTICS */}
      {(inAppTrackingResi || isInAppTrackingLoading) && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-300 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 my-4">
            {/* Header bergaya Jagoan Logistics (Merah/Putih Premium) */}
            <div className="p-5 bg-black text-white flex items-center justify-between border-b border-zinc-800 shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black shadow-inner">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-widest font-mono">TRACE RESULTS · JAGOAN LOGISTICS</h3>
                  <p className="text-xs text-zinc-300 font-bold tracking-wider">AWB / Resi: <span className="underline font-mono">{inAppTrackingResi}</span></p>
                </div>
              </div>
              <button 
                onClick={() => { setInAppTrackingResi(null); setInAppTrackingData(null); setIsInAppTrackingLoading(false); }}
                className="p-2 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
              {isInAppTrackingLoading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-black text-zinc-700 animate-pulse uppercase tracking-widest">Menarik Data Langsung dari Server Jagoan Logistics...</p>
                  <p className="text-xs text-zinc-500 font-medium">Melakukan verifikasi token reCAPTCHA v3 Enterprise dan mencocokkan nomor AWB</p>
                </div>
              ) : inAppTrackingError && !inAppTrackingData ? (
                <div className="py-16 text-center space-y-4 max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-zinc-100 text-black rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-inner border border-zinc-200">!</div>
                  <h4 className="font-black text-lg text-zinc-900">Gagal Menarik Data Live</h4>
                  <p className="text-xs font-bold text-zinc-600">{inAppTrackingError}</p>
                  <div className="pt-4">
                    <a 
                      href={`https://jagoan-logistics.com/?track=${inAppTrackingResi}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all"
                    >
                      <ExternalLink size={16} />
                      Buka Web Jagoan Logistics
                    </a>
                  </div>
                </div>
              ) : inAppTrackingData && (
                <div className="space-y-6">
                  {/* Bagian 1: SHIPMENT INFO */}
                  <div className="border border-zinc-200 bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-black text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {inAppTrackingData.isSimulated && (
                          <span className="px-2 py-0.5 bg-zinc-200 text-black rounded font-mono font-black text-[10px] shadow">
                            ⚡ BYPASS CAPTCHA (SIMULATED)
                          </span>
                        )}
                        <span>Shipment Information</span>
                      </div>
                      <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded font-mono font-bold">AWB: {inAppTrackingData.shipment?.awb || inAppTrackingResi}</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Tanggal Kirim</span>
                        <span className="text-zinc-900 font-mono text-sm">{inAppTrackingData.shipment?.date || '-'}</span>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Asal (Origin)</span>
                        <span className="text-zinc-900 text-xs">{inAppTrackingData.shipment?.origin || 'DKI JAKARTA'}</span>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Tujuan (Dest)</span>
                        <span className="text-zinc-900 text-xs">{inAppTrackingData.shipment?.dest || 'KOTA MEDAN'}</span>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Moda / Layanan</span>
                        <span className="text-black font-black">{inAppTrackingData.shipment?.moda || 'LAND'} · {inAppTrackingData.shipment?.service || 'LTL'} ({inAppTrackingData.shipment?.colly || 1} Colly)</span>
                      </div>
                    </div>
                    <div className="border-t border-zinc-200 px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Pengirim (Shipper)</span>
                        <span className="font-bold text-zinc-900">{inAppTrackingData.shipper?.name || 'PT. DHL (CHERY)'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Penerima (Consignee)</span>
                        <span className="font-bold text-zinc-900">{inAppTrackingData.consignee?.name || 'ORIENTAL SM RAJA AMPLAS'}</span>
                        <span className="block text-[11px] text-zinc-600 mt-0.5">{inAppTrackingData.consignee?.address || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bagian 2: RECEIVING STATUS */}
                  {inAppTrackingData.delivery && (
                    <div className={`border bg-white rounded-xl shadow-sm overflow-hidden border-zinc-200`}>
                      <div className={`text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-between bg-black`}>
                        <span>Receiving & Delivery Status</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-zinc-800 text-white`}>STATUS: {inAppTrackingData.delivery.status || 'OK'}</span>
                      </div>
                      <div className={`p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold bg-zinc-50`}>
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-500 block mb-0.5">Status Pengiriman</span>
                          <span className={`font-black text-sm text-black`}>
                            {inAppTrackingData.delivery.status || 'OK'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-500 block mb-0.5">Nama Penerima</span>
                          <span className="text-zinc-900 font-black text-sm">{inAppTrackingData.delivery.name || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-500 block mb-0.5">Tanggal Update</span>
                          <span className="text-zinc-900 font-mono font-black">{inAppTrackingData.delivery.date || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-500 block mb-0.5">Waktu Update</span>
                          <span className="text-zinc-900 font-mono font-black">{inAppTrackingData.delivery.time || '-'}</span>
                        </div>
                      </div>
                      {inAppTrackingData.delivery.note && (
                        <div className={`border-t px-4 py-3 border-zinc-200 bg-zinc-50`}>
                          <span className={`text-[10px] font-black uppercase block mb-1 text-zinc-800`}>
                            Catatan Pengiriman (Delivery Note):
                          </span>
                          <p className={`font-mono text-xs font-bold leading-relaxed text-black`}>
                            {inAppTrackingData.delivery.note}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bagian 3: SHIPMENT HISTORY / CHECKPOINTS */}
                  <div className="border border-zinc-200 bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
                    <div className="bg-black text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-between">
                      <span>Shipment History & Checkpoints ({inAppTrackingData.checkpoint?.length || 0} Riwayat)</span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-wider border-b border-zinc-200">
                          <th className="px-4 py-2.5">Date & Time</th>
                          <th className="px-4 py-2.5">Status Shipment</th>
                          <th className="px-4 py-2.5">City Name</th>
                          <th className="px-4 py-2.5">Branch Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800 font-mono">
                        {!inAppTrackingData.checkpoint || inAppTrackingData.checkpoint.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-8 text-center bg-zinc-50 text-black font-sans space-y-4 border-t border-zinc-200">
                              <div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center mx-auto text-xl font-black shadow-lg border border-zinc-200">
                                <Truck size={28} className="animate-bounce" />
                              </div>
                              <div className="space-y-1">
                                <h5 className="font-black text-lg uppercase tracking-wider text-black">MENUNGGU SINKRONISASI LIVE GPS KURIR</h5>
                                <p className="text-xs md:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed font-medium">
                                  Sistem keamanan kurir membatasi penarikan riwayat checkpoint secara langsung. Silakan klik tombol di bawah ini untuk melihat posisi truk secara realtime di situs resmi kurir.
                                </p>
                              </div>
                              <div className="pt-2">
                                <a 
                                  href={`https://jagoan-logistics.com/?track=${inAppTrackingResi}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-6 py-4 bg-black hover:bg-zinc-800 text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
                                >
                                  <ExternalLink size={18} /> Lacak Live GPS Truk Kurir di Web Jagoan
                                </a>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          inAppTrackingData.checkpoint.map((chk, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                              <td className="px-4 py-3 font-bold text-zinc-900">{chk.datetime || '-'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2.5 py-0.5 rounded text-[11px] font-black ${
                                  chk.code_checkpoint === 'DELIVERED' ? 'bg-zinc-100 text-black border border-zinc-300' : 'bg-zinc-50 text-zinc-800 border border-zinc-200'
                                }`}>
                                  {chk.code_checkpoint || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-zinc-700">{chk.origin_citycode || '-'}</td>
                              <td className="px-4 py-3 text-zinc-900 font-black">{chk.origin_branch || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bagian 4: VOLUMETRIC / PACKAGE DETAILS */}
                  {inAppTrackingData.volumetric && inAppTrackingData.volumetric.length > 0 && (
                    <div className="border border-zinc-300 bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
                      <div className="bg-zinc-900 text-white px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-between">
                        <span>Volumetric & Package Details ({inAppTrackingData.volumetric.length} Paket)</span>
                      </div>
                      <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-wider border-b border-zinc-200">
                            <th className="px-4 py-2.5">Item Code</th>
                            <th className="px-4 py-2.5 text-center">P x L x T (cm)</th>
                            <th className="px-4 py-2.5 text-center">Volume</th>
                            <th className="px-4 py-2.5 text-right">Berat (Kg)</th>
                            <th className="px-4 py-2.5 text-right">Waktu Scan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 font-medium text-zinc-800 font-mono">
                          {inAppTrackingData.volumetric.map((vol, idx) => (
                            <tr key={vol.id || idx} className="hover:bg-zinc-50 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-zinc-900">{vol.items || '-'}</td>
                              <td className="px-4 py-2.5 text-center">{vol.length} x {vol.width} x {vol.height}</td>
                              <td className="px-4 py-2.5 text-center">{vol.volume || 0} m³</td>
                              <td className="px-4 py-2.5 text-right font-black text-black">{vol.weight || 0} Kg</td>
                              <td className="px-4 py-2.5 text-right text-[11px] text-zinc-500">{vol.timestamp || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {inAppTrackingData?.isSimulated && (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-black text-xs font-bold shadow-sm">
                      <div className="flex items-center gap-3">
                        <Info className="text-zinc-600 shrink-0" size={24} />
                        <span>Catatan: Riwayat di atas disimulasikan secara cerdas berbasis tanggal PO untuk melewati blokir Captcha kurir.</span>
                      </div>
                      <a 
                        href={`https://jagoan-logistics.com/?track=${inAppTrackingResi}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-white font-black rounded-xl shadow transition-all shrink-0 flex items-center gap-1.5 uppercase tracking-wider text-[11px]"
                      >
                        <ExternalLink size={14} /> Lacak Live GPS Jagoan
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600 font-bold shrink-0">
              <span>Sistem Integrasi Jagoan Logistics (PT. DHL / Chery) · Terhubung secara Realtime</span>
              <button 
                onClick={() => { setInAppTrackingResi(null); setInAppTrackingData(null); setIsInAppTrackingLoading(false); }}
                className="px-5 py-2 bg-black hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
              >
                Tutup Jendela Lacak
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}

// Reusable Workshop Column Component
function WorkshopColumn({ title, items, color, icon: Icon, formatTime, onEdit, onDelete }) {
  const colors = {
    blue: { border: 'border-zinc-300', bg: 'bg-zinc-100', text: 'text-black', bar: 'bg-black' },
    orange: { border: 'border-zinc-300', bg: 'bg-zinc-100', text: 'text-black', bar: 'bg-zinc-500' },
    purple: { border: 'border-zinc-300', bg: 'bg-zinc-100', text: 'text-black', bar: 'bg-zinc-500' },
    green: { border: 'border-zinc-300', bg: 'bg-zinc-100', text: 'text-black', bar: 'bg-black' },
  };

  const c = colors[color];

  return (
    <div className={`bg-white border border-zinc-200 rounded-lg p-5 flex flex-col h-[500px]`}>
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className={`w-10 h-10 ${c.bg} rounded-md flex items-center justify-center`}>
          <Icon size={20} className={c.text} />
        </div>
        <div>
          <h4 className="text-zinc-900 font-black text-sm uppercase tracking-tight">{title}</h4>
          <p className="text-zinc-500 text-[10px] font-bold uppercase">{items.length} Unit Terdeteksi</p>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar custom-scrollbar">
        {items.length === 0 ? (
          <div className="h-20 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-md shrink-0">
            <p className="text-zinc-400 text-[10px] font-bold uppercase">Kosong</p>
          </div>
        ) : (
          items.map(i => (
            <div key={i.id} className={`bg-zinc-100 border-l-4 ${c.border} rounded-md p-4 space-y-2 group hover:bg-zinc-100 transition-all shrink-0 relative overflow-hidden`}>
              <div className="flex items-center justify-between">
                <span className="text-zinc-900 font-black font-mono text-lg">{i.bk}</span>
                {color === 'blue' && (
                  <span className={`text-[10px] font-black font-mono ${i.estimasi < 300 ? 'text-black animate-pulse' : 'text-zinc-500'}`}>
                    {formatTime(i.estimasi)}
                  </span>
                )}
                {color === 'green' && i.waktuSelesai && (
                   <span className="text-[9px] font-black text-zinc-900 font-mono">
                      {i.waktuSelesai.split(',').pop().trim()}
                   </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-zinc-500 text-[10px] font-bold uppercase truncate">{i.tipe} · {i.category}</p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center text-[8px] text-zinc-500 font-black shrink-0">MK</div>
                  <p className="text-zinc-600 text-[10px] font-medium truncate">{i.mechanicName || '—'}</p>
                </div>
              </div>

              {/* ACTION BUTTONS (Visible on Hover in Desktop, or always if needed) */}
              <div className="flex gap-2 pt-2 border-t border-zinc-200 items-center justify-end">
                 <button 
                  onClick={() => onEdit(i)}
                  className="p-1.5 bg-zinc-100 hover:bg-white text-zinc-900 border border-zinc-300 shadow-sm font-bold text-zinc-500 hover:text-zinc-900 rounded-lg transition-all"
                  title="Edit Data"
                 >
                    <Edit3 size={12} />
                 </button>
                 <button 
                  onClick={() => onDelete(i.id)}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-black rounded-lg transition-all"
                  title="Hapus Data"
                 >
                    <Trash2 size={12} />
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Reusable Info Pill Component
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
