import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileText, RefreshCw, AlertCircle, Search, Filter, X,
  Calendar, DollarSign, CheckCircle2, XCircle, Loader2,
  ArrowLeft, ChevronRight, ShieldCheck, Wrench, Clock, Car
} from 'lucide-react';
import { findBestMatchingWO } from '../utils/dmsMatcher';

// ─── Constants ────────────────────────────────────────────────
const STATUS_MAP = {
  1: { label: 'Draft', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' },
  2: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  3: { label: 'Under Review', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  4: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  5: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  6: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  7: { label: 'Cancelled', bg: 'bg-zinc-100', text: 'text-zinc-500', border: 'border-zinc-200' },
  8: { label: 'Pending', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  9: { label: 'Settled', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

const FREE_SERVICE_KEYWORDS = [
  'free service', '5000', '10000', '15000', '30000', '45000', '60000',
  'first maintenance', 'service pertama', 'service kedua', 'service ketiga', 'free 1000',
];

// ─── Helpers ──────────────────────────────────────────────────
const formatRupiah = val => {
  if (val == null || val === '') return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : 'Rp ' + n.toLocaleString('id-ID');
};

const formatDate = val => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    return isNaN(d) ? val : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return val; }
};

const getKategori = code => {
  if (!code) return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
  if (code.startsWith('BY')) return { label: 'Free Service', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  if (code.startsWith('BX')) return { label: 'Warranty', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  return { label: 'Lainnya', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
};

const getStatus = s => STATUS_MAP[s] || { label: String(s || '-'), bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };

const isFreeService = p => p && FREE_SERVICE_KEYWORDS.some(kw => p.toLowerCase().includes(kw));

const extractKm = (text) => {
  if (!text) return null;
  const upper = text.toUpperCase();
  // 1. Cari pola "angka + KM" (contoh: 20.000KM, 20000 KM, 5.000km)
  const kmMatch = upper.match(/([\d.]+)\s*KM/);
  if (kmMatch) return parseInt(kmMatch[1].replace(/\./g, ''), 10);
  // 2. Cari semua angka dalam teks, ambil yang masuk range mileage (1000-999999)
  const allNums = [...upper.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)/g)].map(m => parseInt(m[1].replace(/\./g, ''), 10));
  const mileageNums = allNums.filter(n => n >= 1000 && n <= 999999);
  if (mileageNums.length > 0) {
    // Ambil angka yang paling umum (median) atau yang pertama
    return mileageNums.sort((a, b) => a - b)[Math.floor(mileageNums.length / 2)];
  }
  return null;
};

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

const isPekerjaanMatched = (dmsDescription, internalPerintah) => {
  if (!dmsDescription || !internalPerintah) return null;
  const dmsKm = extractKm(dmsDescription);
  const intKm = extractKm(internalPerintah);
  if (dmsKm != null && intKm != null) {
    return dmsKm === intKm;
  }
  const dmsNorm = normalizeText(dmsDescription);
  const intNorm = normalizeText(internalPerintah);
  if (!dmsNorm || !intNorm) return null;
  return dmsNorm === intNorm || dmsNorm.includes(intNorm) || intNorm.includes(dmsNorm);
};

const getDefaultRange = () => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

// ─── API ──────────────────────────────────────────────────────
const apiFetch = async (params) => {
  const res = await fetch(`/api/chery_dms?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
};

// Global Memory Cache for Proforma Invoices
const GLOBAL_PROFORMA_CACHE = {
  list: null,      // Format: { [cacheKey]: { rows, total } }
  details: {},     // Format: { [settlementId]: array_items }
  vinCrossRef: {}, // Format: { [vin]: { wos: [], loading: false } }
  parts: {}        // Format: { [idWo]: { loading: boolean, error: null, data: [] } }
};

const buildAttachmentPreviewUrl = (attachments) => {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return '';
  const parts = [];
  attachments.forEach((att, idx) => {
    const fileId = att.fileId || att.id || '';
    const fileName = att.fileName || att.name || '';
    if (fileId && fileName) {
      parts.push(`i[${idx}]=${encodeURIComponent(fileId)}:${encodeURIComponent(fileName)}`);
    }
  });
  return `https://dms.chery.co.id/imagePreview/?${parts.join('&')}`;
};

const buildSingleContainerUrl = (clickedAtt, allAttachments) => {
  if (!clickedAtt) return '';
  const fileId = clickedAtt.fileId || clickedAtt.id || '';
  const fileName = clickedAtt.fileName || clickedAtt.name || '';
  if (!fileId) return '';

  const parts = [`i[0]=${encodeURIComponent(fileId)}:${encodeURIComponent(fileName)}`];
  let idx = 1;
  allAttachments.forEach(att => {
    const fId = att.fileId || att.id || '';
    const fName = att.fileName || att.name || '';
    if (fId && fId !== fileId) {
      parts.push(`i[${idx}]=${encodeURIComponent(fId)}:${encodeURIComponent(fName)}`);
      idx++;
    }
  });
  return `https://dms.chery.co.id/imagePreview/?${parts.join('&')}`;
};

// ─── Detail Page ────────────────────────────────────────────────
function DetailPage({ settlement, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vinData, setVinData] = useState({});
  const [itemPage, setItemPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | maintain | warranty | adjustment

  const [zoomedImage, setZoomedImage] = useState(null);
  const [contractDetails, setContractDetails] = useState({});
  const [repairContracts, setRepairContracts] = useState({});
  const [loadedImages, setLoadedImages] = useState({});
  const [loadingItems, setLoadingItems] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [partsCache, setPartsCache] = useState(() => GLOBAL_PROFORMA_CACHE.parts || {});

  // Date range: full year of settlementMonth to ensure all WOs are found
  const dateRange = useMemo(() => {
    if (!settlement.settlementMonth) return { from: '', to: '' };
    try {
      const d = new Date(settlement.settlementMonth);
      if (isNaN(d)) return { from: '', to: '' };
      const y = d.getFullYear();
      return {
        from: `${y}-01-01`,
        to: `${y}-12-31`
      };
    } catch {
      return { from: '', to: '' };
    }
  }, [settlement.settlementMonth]);

  const handleLoadParts = useCallback(async (idWo) => {
    if (!idWo) return;

    console.log('[DEBUG] handleLoadParts called for idWo:', idWo);
    if (GLOBAL_PROFORMA_CACHE.parts[idWo]) {
      console.log('[DEBUG] handleLoadParts returned early (already in cache):', idWo, GLOBAL_PROFORMA_CACHE.parts[idWo]);
      return;
    }

    console.log('[DEBUG] handleLoadParts executing fetch for idWo:', idWo);
    GLOBAL_PROFORMA_CACHE.parts[idWo] = { loading: true, error: null, data: [], pekerjaan: [], totalPekerjaan: 0, totalFeeInternal: 0, perintah: '' };
    setPartsCache(prev => ({
      ...prev,
      [idWo]: { loading: true, error: null, data: [], pekerjaan: [], totalPekerjaan: 0, totalFeeInternal: 0, perintah: '' }
    }));

    try {
      const json = await apiFetch({ endpoint: 'warranty-estimasi-detail', id: idWo });
      const partsData = json.parts || [];
      const pekerjaan = json.pekerjaan || [];
      const totalPekerjaan = json.totalPekerjaan || 0;
      const perintahEstimasi = json.perintah || '';
      const totalFeeInternal = totalPekerjaan * 1.11;
      console.log('[DEBUG] handleLoadParts fetch success for idWo:', idWo, 'parts count:', partsData.length, 'totalPekerjaan:', totalPekerjaan, 'perintah:', perintahEstimasi);
      GLOBAL_PROFORMA_CACHE.parts[idWo] = { loading: false, error: null, data: partsData, pekerjaan, totalPekerjaan, totalFeeInternal, perintah: perintahEstimasi };
      setPartsCache(prev => ({
        ...prev,
        [idWo]: { loading: false, error: null, data: partsData, pekerjaan, totalPekerjaan, totalFeeInternal, perintah: perintahEstimasi }
      }));
    } catch (err) {
      console.error('[DEBUG] handleLoadParts fetch error for idWo:', idWo, err.message);
      GLOBAL_PROFORMA_CACHE.parts[idWo] = { loading: false, error: err.message, data: [], pekerjaan: [], totalPekerjaan: 0, totalFeeInternal: 0, perintah: '' };
      setPartsCache(prev => ({
        ...prev,
        [idWo]: { loading: false, error: err.message, data: [], pekerjaan: [], totalPekerjaan: 0, totalFeeInternal: 0, perintah: '' }
      }));
    }
  }, []);

  const loaded = useRef(false);

  const handleExportExcel = async () => {
    if (exporting || items.length === 0) return;
    setExporting(true);
    setExportProgress(0);

    try {
      // 1. Fetch any missing VINs directly
      const uniqueVins = [...new Set(items.map(it => it.vin || it.vinCode || it.chassisNo).filter(Boolean))];
      const vinsToFetch = uniqueVins.filter(vin => !GLOBAL_PROFORMA_CACHE.vinCrossRef[vin]);
      const totalVins = vinsToFetch.length;

      if (totalVins > 0) {
        setExportProgress(2);
        vinsToFetch.forEach(vin => {
          GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: [], loading: true };
        });

        let vinFetched = 0;
        await Promise.all(
          vinsToFetch.map(async (vin) => {
            try {
              const r = await apiFetch({ endpoint: 'warranty-search-vin', vin, length: 100, from: dateRange.from, to: dateRange.to });
              GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: r.data || [], loading: false };
            } catch (e) {
              GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: [], loading: false };
            }
            vinFetched++;
            setExportProgress(Math.round((vinFetched / totalVins) * 8) + 2);
          })
        );

        setVinData(prev => {
          const next = { ...prev };
          uniqueVins.forEach(vin => {
            if (GLOBAL_PROFORMA_CACHE.vinCrossRef[vin]) {
              next[vin] = GLOBAL_PROFORMA_CACHE.vinCrossRef[vin];
            }
          });
          return next;
        });
      }

      setExportProgress(10);

      // 2. Fetch missing parts data for all matched work orders
      const woIdsToFetch = new Set();
      items.forEach((item) => {
        if (item._type === 'adjustment') return;
        const v = item.vin || item.vinCode || item.chassisNo || '';
        const vd = GLOBAL_PROFORMA_CACHE.vinCrossRef[v] || vinData[v] || { wos: [] };
        const ic = item.code || item.claimCode || '';
        const dmsDesc = item.description || '';
        const m = findBestMatchingWO(vd.wos, ic, v, item.mileage, ic.startsWith('BY'), dmsDesc);
        if (m?.id_wo && !GLOBAL_PROFORMA_CACHE.parts[m.id_wo]?.data) {
          woIdsToFetch.add(m.id_wo);
        }
      });
      const woArray = [...woIdsToFetch];
      let woFetched = 0;
      const CONCURRENCY = 5;
      const totalWo = woArray.length;
      for (let i = 0; i < woArray.length; i += CONCURRENCY) {
        const batch = woArray.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (id) => {
          const ac = new AbortController();
          const timeoutId = setTimeout(() => ac.abort(), 30000);
          try {
            const res = await fetch(`/api/chery_dms?${new URLSearchParams({ endpoint: 'warranty-estimasi-detail', id })}`, { signal: ac.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const pData = json.parts || [];
            const pTotal = json.totalPekerjaan || 0;
            const pPerintah = json.perintah || '';
            GLOBAL_PROFORMA_CACHE.parts[id] = { loading: false, error: null, data: pData, pekerjaan: json.pekerjaan || [], totalPekerjaan: pTotal, totalFeeInternal: pTotal * 1.11, perintah: pPerintah };
          } catch (e) {
            clearTimeout(timeoutId);
            console.error("Export: failed to fetch parts for WO", id, e);
            GLOBAL_PROFORMA_CACHE.parts[id] = { loading: false, error: e.message, data: [], pekerjaan: [], totalPekerjaan: 0, totalFeeInternal: 0, perintah: '' };
          }
          woFetched++;
          setExportProgress(Math.round((woFetched / totalWo) * 80) + 10);
        }));
      }
      if (woArray.length > 0) {
        setPartsCache(prev => ({ ...prev, ...Object.fromEntries(woArray.map(w => [w, GLOBAL_PROFORMA_CACHE.parts[w]])) }));
      }

      console.log("[EXPORT DEBUG] items count:", items.length, "vinCrossRef keys:", Object.keys(GLOBAL_PROFORMA_CACHE.vinCrossRef).length, "vinData keys:", Object.keys(vinData).length);

      const freeServiceRows = [];
      const warrantyRows = [];

      const VALID_STATUSES = ['Disetujui', 'Dipenuhi', 'VALIDATED'];

      items.forEach((item) => {
        if (item._type === 'adjustment') return;

        const itemCode = item.code || item.claimCode || '-';
        const vin = item.vin || item.vinCode || item.chassisNo || '';
        const vd = GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] || vinData[vin] || { wos: [] };
        const detail = contractDetails[item.id || item.claimId] || {};
        const contractOrId = detail.repairContractId || item.repairContractId;
        const contract = repairContracts[contractOrId] || {};
        const dmsDescription = contract.description || detail.faultDescription || detail.checkMeasureResult || detail.description || item.description || '';

        let matchWO = findBestMatchingWO(vd.wos, itemCode, vin, item.mileage, itemCode.startsWith('BY'), dmsDescription);
        console.log("[EXPORT DEBUG] item:", itemCode, "vin:", vin, "wos:", vd.wos?.length, "matchWO:", matchWO?.no_wo || null, "matchWO-id:", matchWO?.id_wo || null);

        let validationStatus = 'Belum Estimasi';
        const woId = matchWO?.id_wo;
        if (woId) {
          const partsInfo = GLOBAL_PROFORMA_CACHE.parts[woId];
          if (partsInfo?.data?.length > 0) {
            const total = partsInfo.data.length;
            const validated = partsInfo.data.filter(p =>
              VALID_STATUSES.includes(p.status_permintaan) || VALID_STATUSES.includes(p.status)
            ).length;
            validationStatus = validated === total
              ? `${validated}/${total} Sudah Validasi`
              : validated === 0
                ? `${validated}/${total} Belum di Validasi`
                : `${validated}/${total} Belum Validasi Semua`;
          }
        }

        const isFree = itemCode.startsWith('BY');

        const totalFeeDMS = item.totalFee ?? 0;
        const totalFeeInternal = (matchWO && GLOBAL_PROFORMA_CACHE.parts[matchWO.id_wo])
          ? (GLOBAL_PROFORMA_CACHE.parts[matchWO.id_wo].totalFeeInternal || 0)
          : 0;

        const perintahExport = matchWO && GLOBAL_PROFORMA_CACHE.parts[matchWO.id_wo]
          ? (GLOBAL_PROFORMA_CACHE.parts[matchWO.id_wo].perintah || matchWO.perintah || '')
          : (matchWO ? matchWO.perintah : '');

        const rowData = {
          'Nomor Proforma Invoice': itemCode,
          'No WO Internal': matchWO ? matchWO.no_wo : '',
          'Nama': detail.customerName || item.customerName || '',
          'VIN': vin,
          'Pekerjaan DMS': dmsDescription,
          'Pekerjaan Internal': perintahExport,
          'Status Validasi': validationStatus,
          'Tipe Mobil': detail.productCategoryCode || item.productCategoryCode || '',
          'Nomor Mesin': detail.engineCode || item.engineCode || '',
          'Total Fee DMS': totalFeeDMS,
          'Total Fee Internal': totalFeeInternal
        };

        if (isFree) {
          freeServiceRows.push(rowData);
        } else {
          warrantyRows.push(rowData);
        }
      });

      const wb = XLSX.utils.book_new();

      const wsFree = XLSX.utils.json_to_sheet(freeServiceRows);
      XLSX.utils.book_append_sheet(wb, wsFree, "Free Service");

      const wsWarranty = XLSX.utils.json_to_sheet(warrantyRows);
      XLSX.utils.book_append_sheet(wb, wsWarranty, "Warranty");

      const fileName = `Export_Proforma_${settlement.code || 'Invoice'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      setExportProgress(100);
      XLSX.writeFile(wb, fileName);

    } catch (e) {
      console.error("Export Excel failed:", e);
      alert("Gagal mengekspor ke Excel: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    delete GLOBAL_PROFORMA_CACHE.details[settlement.id];
    items.forEach(it => {
      const vin = it.vin || it.vinCode || it.chassisNo;
      if (vin) {
        delete GLOBAL_PROFORMA_CACHE.vinCrossRef[vin];
      }
    });
    GLOBAL_PROFORMA_CACHE.parts = {};
    setPartsCache({});
    setVinData({});
    loaded.current = false;
    load();
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let list = [];
      if (GLOBAL_PROFORMA_CACHE.details[settlement.id]) {
        list = GLOBAL_PROFORMA_CACHE.details[settlement.id];
        setItems(list);
      } else {
        const json = await apiFetch({ endpoint: 'proforma-detail', id: settlement.id });
        const payload = json.payload || json;
        const maintainOrders = payload.maintainOrders || [];
        const warrantyOrders = payload.warrantyOrders || [];
        const adjustmentOrders = payload.expenseAdjustmentOrders || [];
        list = [
          ...maintainOrders.map(o => ({ ...o, _type: 'maintain' })),
          ...warrantyOrders.map(o => ({ ...o, _type: 'warranty' })),
          ...adjustmentOrders.map(o => ({ ...o, _type: 'adjustment' })),
        ];
        GLOBAL_PROFORMA_CACHE.details[settlement.id] = list;
        setItems(list);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settlement.id]);

  useEffect(() => { if (!loaded.current) { loaded.current = true; load(); } }, [load]);


  const toggleAttachments = useCallback(async (item) => {
    const itemId = item.id || item.claimId;
    if (!itemId) return;

    const listKey = `list_${itemId}`;

    // If it's already shown, just toggle visibility
    if (loadedImages[listKey]) {
      setLoadedImages(prev => ({ ...prev, [listKey]: false }));
      return;
    }

    // If detail is already fetched, just show it
    if (contractDetails[itemId]) {
      setLoadedImages(prev => ({ ...prev, [listKey]: true }));
      return;
    }

    // Otherwise, fetch it on-demand
    setLoadingItems(prev => ({ ...prev, [itemId]: true }));
    try {
      const claimRes = await apiFetch({ endpoint: 'claim_detail', claimId: itemId });
      const claimPayload = claimRes.payload || claimRes;
      if (claimPayload) {
        setContractDetails(prev => ({ ...prev, [itemId]: claimPayload }));

        const rcId = claimPayload.repairContractId;
        if (rcId) {
          try {
            const rcRes = await apiFetch({ endpoint: 'repair-contract-detail', id: rcId });
            const rcPayload = rcRes.payload || rcRes;
            if (rcPayload) {
              setRepairContracts(prev => ({ ...prev, [rcId]: rcPayload }));
            }
          } catch (rcErr) {
            console.error("Failed to fetch repair contract detail:", rcId, rcErr);
          }
        }
      }
      setLoadedImages(prev => ({ ...prev, [listKey]: true }));
    } catch (err) {
      console.error("Failed to fetch claim detail:", itemId, err);
      alert("Gagal memuat detail klaim dari DMS. Pastikan server DMS dapat diakses dan Anda sudah login.");
    } finally {
      setLoadingItems(prev => ({ ...prev, [itemId]: false }));
    }
  }, [loadedImages, contractDetails]);

  // Memoized VIN Lookup Map for O(1) cross-reference matching
  const vinLookupMap = useMemo(() => {
    const map = new Map();
    Object.entries(vinData).forEach(([vin, data]) => {
      map.set(vin.toLowerCase(), data);
    });
    return map;
  }, [vinData]);

  // Filter + search (includes perintah from cross-ref optimized with O(1) Map)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (item._type === 'adjustment') return true;

      const itemCode = item.code || item.claimCode || '';

      // Category segregation logic (DMS code prefix + internal kategori IFS/IKC)
      let matchesType = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'maintain') {
          if (itemCode.startsWith('BY')) {
            matchesType = true;
          } else if (itemCode.startsWith('BX')) {
            matchesType = false;
          } else {
            const _v = (item.vin || item.vinCode || item.chassisNo || '').toLowerCase();
            const _vd = vinLookupMap.get(_v);
            if (_vd && _vd.wos) {
              const matched = _vd.wos.find(w => (w.no_wo_dms || '').toLowerCase() === itemCode.toLowerCase()) ||
                _vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IFS');
              matchesType = matched && (matched.kategori || '').toUpperCase() === 'IFS';
            } else {
              matchesType = (item._type === 'maintain');
            }
          }
        } else if (typeFilter === 'warranty') {
          if (itemCode.startsWith('BX')) {
            matchesType = true;
          } else if (itemCode.startsWith('BY')) {
            matchesType = false;
          } else {
            const _v = (item.vin || item.vinCode || item.chassisNo || '').toLowerCase();
            const _vd = vinLookupMap.get(_v);
            if (_vd && _vd.wos) {
              const matched = _vd.wos.find(w => (w.no_wo_dms || '').toLowerCase() === itemCode.toLowerCase()) ||
                _vd.wos.find(w => (w.kategori || '').toUpperCase() === 'IKC');
              matchesType = matched && (matched.kategori || '').toUpperCase() === 'IKC';
            } else {
              matchesType = (item._type === 'warranty');
            }
          }
        } else if (typeFilter === 'adjustment') {
          matchesType = (item._type === 'adjustment');
        }
      }
      if (!matchesType) return false;

      const vin = (item.vin || item.vinCode || item.chassisNo || '').toLowerCase();

      if (search) {
        const q = search.toLowerCase();
        const vd2 = vinLookupMap.get(vin) || { wos: [] };
        let matchWO = findBestMatchingWO(vd2.wos, itemCode, vin, item.mileage, itemCode.startsWith('BY'));
        const perintah = matchWO?.perintah || '';
        const hay = [itemCode, vin, item.customerName || '', item.productCategoryCode || '', perintah].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, search, vinLookupMap]);

  const totalItemPages = Math.ceil(filteredItems.length / itemsPerPage);
  const pagedItems = useMemo(() => {
    return filteredItems.slice(itemPage * itemsPerPage, (itemPage + 1) * itemsPerPage);
  }, [filteredItems, itemPage, itemsPerPage]);

  // ─── Refs for VIN loading queue ────────────────────────────────
  const vinQueue = useRef([]);
  const vinRunning = useRef(0);
  const VIN_BATCH_SIZE = 3;

  const processVinQueue = useCallback(() => {
    while (vinRunning.current < VIN_BATCH_SIZE && vinQueue.current.length > 0) {
      const { vin } = vinQueue.current.shift();
      vinRunning.current++;
      (async () => {
        try {
          const r = await apiFetch({ endpoint: 'warranty-search-vin', vin, length: 100, from: dateRange.from, to: dateRange.to });
          GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: r.data || [], loading: false };
        } catch {
          GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: [], loading: false };
        }
        setVinData(prev => ({
          ...prev,
          [vin]: GLOBAL_PROFORMA_CACHE.vinCrossRef[vin],
        }));
        vinRunning.current--;
        processVinQueue();
      })();
    }
  }, [dateRange.from, dateRange.to]);

  // ─── Effect 0: Invalidate VIN cache when dateRange changes ────
  useEffect(() => {
    Object.keys(GLOBAL_PROFORMA_CACHE.vinCrossRef).forEach(vin => {
      const entry = GLOBAL_PROFORMA_CACHE.vinCrossRef[vin];
      if (entry && !entry.loading) {
        delete GLOBAL_PROFORMA_CACHE.vinCrossRef[vin];
      }
    });
    setVinData({});
  }, [dateRange.from, dateRange.to]);

  // ─── Effect 1: Load VINs from DMS (cross-reference) ────────────
  useEffect(() => {
    if (pagedItems.length === 0) return;

    let queueChanged = false;
    pagedItems.forEach(it => {
      const vin = it.vin || it.vinCode || it.chassisNo;
      if (!vin) return;

      if (!GLOBAL_PROFORMA_CACHE.vinCrossRef[vin]) {
        GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] = { wos: [], loading: true };
        setVinData(prev => ({ ...prev, [vin]: { wos: [], loading: true } }));
        vinQueue.current.push({ vin });
        queueChanged = true;
      } else {
        // Sync cache to component state if needed
        setVinData(prev => {
          if (prev[vin]) return prev;
          return { ...prev, [vin]: GLOBAL_PROFORMA_CACHE.vinCrossRef[vin] };
        });
      }
    });

    if (queueChanged) {
      processVinQueue();
    }
  }, [pagedItems, processVinQueue]);

  // ─── Effect 2: Auto-load spare parts for matched WOs ───────────
  useEffect(() => {
    pagedItems.forEach(item => {
      const itemCode = item.code || item.claimCode || '';
      const vin = item.vin || item.vinCode || item.chassisNo || '';
      const vd = vinData[vin];
      if (vd && vd.wos) {
        const dmsDescEffect = item.description || item.dmsDescription || '';
        const matchWO = findBestMatchingWO(vd.wos, itemCode, vin, item.mileage, itemCode.startsWith('BY'), dmsDescEffect);
        if (matchWO && matchWO.id_wo) {
          handleLoadParts(matchWO.id_wo);
        }
      }
    });
  }, [pagedItems, vinData, handleLoadParts]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setItemPage(0); };
  const clearSearch = () => { setSearch(''); setSearchInput(''); setItemPage(0); };

  const code = settlement.code || '-';
  const st = getStatus(settlement.status);
  const totalFee = settlement.totalFee ?? 0;
  const laborFee = settlement.laborFee ?? 0;
  const matFee = settlement.materialFee ?? 0;
  const mgmtFee = settlement.mgmtFee ?? 0;
  const adjFee = settlement.adjustmentFee ?? 0;
  const refFee = settlement.totalRefusePayFee ?? 0;

  // Aggregate Total Fee Internal dari semua item yang sudah matched
  const totalFeeInternalSum = useMemo(() => {
    let sum = 0;
    items.forEach(item => {
      const itemCode = item.code || item.claimCode || '';
      const vin = item.vin || item.vinCode || item.chassisNo || '';
      const vd = vinData[vin] || { wos: [] };
      const dmsDesc = item.description || item.dmsDescription || '';
      const matchWO = findBestMatchingWO(vd.wos, itemCode, vin, item.mileage, itemCode.startsWith('BY'), dmsDesc);
      if (matchWO && partsCache[matchWO.id_wo] && partsCache[matchWO.id_wo].totalFeeInternal) {
        sum += partsCache[matchWO.id_wo].totalFeeInternal;
      }
    });
    return sum;
  }, [items, vinData, partsCache]);

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-5 py-4 flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors text-sm font-semibold">
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-zinc-900 leading-tight">{code}</h1>
            <p className="text-[10px] text-zinc-400">{settlement.dealerName || ''} · {formatDate(settlement.settlementMonth)}</p>
          </div>
        </div>
        <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh Detail
        </button>

        <button
          onClick={handleExportExcel}
          disabled={exporting || items.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-xs font-bold transition-colors disabled:cursor-not-allowed shadow-sm shrink-0"
        >
          {exporting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Mengekspor... {exportProgress}%
            </>
          ) : (
            <>
              <FileText size={14} />
              Ekspor Excel
            </>
          )}
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        {[
          { label: 'Total Fee DMS', value: formatRupiah(totalFee), color: 'bg-zinc-900' },
          { label: 'Total Fee Internal', value: formatRupiah(totalFeeInternalSum), color: totalFeeInternalSum === totalFee && totalFee > 0 ? 'bg-emerald-700' : 'bg-zinc-900' },
          { label: 'Labor Fee', value: formatRupiah(laborFee), color: 'bg-blue-600' },
          { label: 'Material Fee', value: formatRupiah(matFee), color: 'bg-indigo-600' },
          { label: 'Mgmt Fee', value: formatRupiah(mgmtFee), color: 'bg-violet-600' },
          { label: 'Adjustment', value: formatRupiah(adjFee), color: 'bg-amber-600' },
          { label: 'Refused Fee', value: formatRupiah(refFee), color: 'bg-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.color} rounded-2xl p-3.5 shadow-sm`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p>
            <p className="text-sm font-black mt-1 text-white leading-tight">{c.value}</p>
            {c.label === 'Total Fee Internal' && totalFeeInternalSum > 0 && totalFeeInternalSum === totalFee && (
              <p className="text-[9px] font-bold text-white/80 mt-0.5">(Sama dengan DMS)</p>
            )}
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Memuat item claim...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={load} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada item claim</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Filter & Search toolbar */}
            <div className="flex flex-wrap items-center gap-2 py-2">
              <form onSubmit={handleSearch} className="flex items-center gap-1.5">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder="Cari kode, VIN, nama..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 w-48 text-zinc-900" />
                </div>
                <button type="submit" className="px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors">Cari</button>
                {search && <button type="button" onClick={clearSearch} className="p-1.5 text-zinc-400 hover:text-zinc-700"><X size={14} /></button>}
              </form>

              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setItemPage(0); }}
                className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium">
                <option value="all">Semua Tipe</option>
                <option value="maintain">Free Service (BY / IFS)</option>
                <option value="warranty">Warranty (BX / IKC)</option>
                <option value="adjustment">Adjustment</option>
              </select>

              
              <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setItemPage(0); }}
                className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900 font-medium">
                <option value={10}>10 item / hal</option>
                <option value={20}>20 item / hal</option>
                <option value={30}>30 item / hal</option>
                <option value={50}>50 item / hal</option>
                <option value={100}>100 item / hal</option>
              </select>

              <div className="flex items-center gap-3 ml-auto text-xs text-zinc-400 font-bold uppercase tracking-wider">
                <span>{items.filter(i => i._type === 'maintain' || (i.code || i.claimCode || '').startsWith('BY')).length} BY/IFS</span>
                <span>{items.filter(i => i._type === 'warranty' || (i.code || i.claimCode || '').startsWith('BX')).length} BX/IKC</span>
                {items.filter(i => i._type === 'adjustment').length > 0 && <>
                  <span>{items.filter(i => i._type === 'adjustment').length} Adj</span>
                </>}
                {(search || typeFilter !== 'all') && (
                  <span className="text-zinc-600">→ {filteredItems.length} hasil</span>
                )}
              </div>
            </div>

            {/* Pagination top */}
            {totalItemPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{itemPage * itemsPerPage + 1}{Math.min((itemPage + 1) * itemsPerPage, filteredItems.length)} dari {filteredItems.length}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setItemPage(p => Math.max(0, p - 1))} disabled={itemPage === 0}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
                  <span className="text-xs text-zinc-500 font-medium">{itemPage + 1} / {totalItemPages}</span>
                  <button onClick={() => setItemPage(p => Math.min(totalItemPages - 1, p + 1))} disabled={itemPage >= totalItemPages - 1}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
                </div>
              </div>
            )}

            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <Search size={28} className="text-zinc-300" />
                <p className="text-sm font-bold text-zinc-400">Tidak ada hasil</p>
              </div>
            )}

            {pagedItems.map((item, idx) => {
              const itemCode = item.code || item.claimCode || '-';
              const kat = getKategori(itemCode);

              // Adjustment orders have different structure
              if (item._type === 'adjustment') {
                return (
                  <div key={idx} className="bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3 flex flex-wrap items-center gap-3">
                    <span className="font-bold text-zinc-700 text-xs">{itemCode}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">Adjustment</span>
                    <span className={`text-xs font-bold ml-auto ${Number(item.totalFee) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRupiah(item.totalFee)}</span>
                  </div>
                );
              }

              const vin = item.vin || item.vinCode || item.chassisNo || '';
              const vd = vinData[vin] || { wos: [], loading: false };
              const claimId = item.id || item.claimId;
              const detail = contractDetails[claimId] || {};
              const contractId = detail.repairContractId || item.repairContractId;
              const contract = repairContracts[contractId] || {};
              const dmsDescription = contract.description || detail.faultDescription || detail.checkMeasureResult || detail.description || item.description || '';
              const dmsAttachments = detail.attachments || contract.attachments || item.attachments || [];

              // Match WO specifically for this item using itemCode / claimCode + dmsDescription
              let matchWO = findBestMatchingWO(vd.wos, itemCode, vin, item.mileage, itemCode.startsWith('BY'), dmsDescription);

              const perintahEstimasi = (matchWO && partsCache[matchWO.id_wo] && partsCache[matchWO.id_wo].perintah) || '';
              const perintah = matchWO?.perintah || perintahEstimasi || '';
              const isFree = matchWO ? (matchWO.kategori || '').toUpperCase() === 'IFS' : isFreeService(perintah);
              const ifsWO = matchWO && (matchWO.kategori || '').toUpperCase() === 'IFS' ? matchWO : null;
              const ikcWO = matchWO && (matchWO.kategori || '').toUpperCase() === 'IKC' ? matchWO : null;

              return (
                <div key={idx} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                  {/* Item header */}
                  <div className="px-5 py-4 border-b border-zinc-100 flex flex-wrap items-center gap-2">
                    <span className="font-black text-zinc-900 text-sm">{itemCode}</span>
                    {/* DMS category badge (BY/BX) */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${kat.bg} ${kat.text} ${kat.border}`}>{kat.label}</span>
                    {vin && <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-lg">{vin}</span>}
                    {item.isRefusePay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        <XCircle size={10} /> Refused
                      </span>
                    )}
                    {/* After Sales cross-ref badges */}
                    {vd.loading ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 ml-auto">
                        <Loader2 size={10} className="animate-spin" /> cross-ref...
                      </span>
                    ) : perintah ? (
                      <div className="ml-auto flex items-center gap-2">
                        {/* Auto-loading Sparepart Status Badge */}
                        {matchWO && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-zinc-200 bg-zinc-50 text-zinc-700">
                            {partsCache[matchWO.id_wo] ? (
                              partsCache[matchWO.id_wo].loading ? (
                                <>
                                  <Loader2 size={10} className="animate-spin" /> Memuat...
                                </>
                              ) : partsCache[matchWO.id_wo].error ? (
                                'Gagal'
                              ) : (
                                `Part: ${partsCache[matchWO.id_wo].data.filter(p => ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(p.status_permintaan) || ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(p.status)).length} Dipenuhi / ${partsCache[matchWO.id_wo].data.length} Total`
                              )
                            ) : (
                              <>
                                <Loader2 size={10} className="animate-spin" /> Mengantre...
                              </>
                            )}
                          </span>
                        )}
                        {/* Perintah category from After Sales */}
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${isFree ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {isFree ? 'Free Service' : 'Warranty'}
                        </span>
                        {/* IFS/IKC WO type badges */}
                        {ifsWO && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">IFS</span>}
                        {ikcWO && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">IKC</span>}
                      </div>
                    ) : null}
                  </div>

                  {/* Item body */}
                  <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Pelanggan</p>
                      <p className="text-sm font-semibold text-zinc-800">{item.customerName || '-'}</p>
                      {item.customerCellPhoneNumber && <p className="text-xs text-zinc-500 mt-0.5">{item.customerCellPhoneNumber}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Waktu Perbaikan</p>
                      <p className="text-sm font-semibold text-zinc-800">{formatDate(item.repairTime)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Mileage</p>
                      <p className="text-sm font-semibold text-zinc-800">{item.mileage != null ? Number(item.mileage).toLocaleString('id-ID') + ' km' : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Total Fee DMS</p>
                      <p className="text-sm font-black text-zinc-900">{formatRupiah(item.totalFee)}</p>
                      {matchWO && partsCache[matchWO.id_wo] && partsCache[matchWO.id_wo].loading && (
                        <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Memuat fee internal...</p>
                      )}
                      {matchWO && partsCache[matchWO.id_wo] && !partsCache[matchWO.id_wo].loading && !partsCache[matchWO.id_wo].error && (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 mt-2">Total Fee Internal</p>
                          <p className="text-sm font-black text-zinc-900">
                            {partsCache[matchWO.id_wo].totalFeeInternal > 0
                              ? formatRupiah(partsCache[matchWO.id_wo].totalFeeInternal)
                              : <span className="text-zinc-400">Tidak ada data</span>
                            }
                            {partsCache[matchWO.id_wo].totalFeeInternal > 0 && partsCache[matchWO.id_wo].totalFeeInternal === Number(item.totalFee) && <span className="text-[10px] text-emerald-600 ml-1 font-bold">(Sama)</span>}
                          </p>
                        </>
                      )}
                      {item.totalRefusePayFee > 0 && <p className="text-xs text-red-500 mt-0.5">Refused: {formatRupiah(item.totalRefusePayFee)}</p>}
                    </div>
                  </div>

                  {/* Perintah & WO cross-ref & DMS Description */}
                  {(dmsDescription || perintah || ifsWO || ikcWO) && (
                    <div className="px-5 pb-4 space-y-2">
                      {dmsDescription && (
                        <div className="bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1"><FileText size={10} /> Deskripsi Pekerjaan DMS</p>
                          <p className="text-xs font-semibold text-zinc-800 whitespace-pre-line">{dmsDescription}</p>
                        </div>
                      )}
                      {perintah && (
                        <div className="bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1"><Wrench size={10} /> Perintah Pengerjaan</p>
                          <p className="text-xs text-zinc-700 whitespace-pre-line">{perintah}</p>
                        </div>
                      )}

                      {/* Match Status */}
                      {dmsDescription && perintah && (() => {
                        const matched = isPekerjaanMatched(dmsDescription, perintah);
                        if (matched === null) return null;
                        return (
                          <div className={`rounded-xl px-4 py-2 border flex items-center gap-2 ${matched ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            {matched ? (
                              <CheckCircle2 size={14} className="text-emerald-600" />
                            ) : (
                              <XCircle size={14} className="text-red-500" />
                            )}
                            <span className={`text-[11px] font-bold ${matched ? 'text-emerald-700' : 'text-red-700'}`}>
                              Pekerjaan {matched ? 'MATCHED' : 'TIDAK MATCH'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Spare Parts Detail */}
                      {matchWO && partsCache[matchWO.id_wo] && partsCache[matchWO.id_wo].data && partsCache[matchWO.id_wo].data.length > 0 && (
                        <div className="bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1"><Wrench size={10} /> Detail Sparepart</p>
                          <div className="space-y-1 mt-1.5 text-[11px]">
                            {partsCache[matchWO.id_wo].data.map((part, pIdx) => {
                              const isValidated = ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(part.status_permintaan) || ['Disetujui', 'Dipenuhi', 'VALIDATED'].includes(part.status);
                              const displayStatus = part.status_permintaan || part.status || '-';
                              return (
                                <div key={pIdx} className="flex justify-between items-center py-1 border-b border-zinc-100 last:border-0">
                                  <span className="text-zinc-700 font-mono">{part.kode_part} - <span className="font-sans font-medium">{part.nama_part}</span> (x{part.jumlah})</span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${isValidated
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                                    }`}>
                                    {displayStatus}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(ifsWO || ikcWO) && (
                        <div className="flex flex-wrap gap-2">
                          {ifsWO && (
                            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                              <span className="font-mono text-xs font-bold text-sky-800">{ifsWO.no_wo}</span>
                              <span className="text-[10px] text-sky-500">{ifsWO.nama_kendaraan || ''}</span>
                            </div>
                          )}
                          {ikcWO && (
                            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                              <span className="font-mono text-xs font-bold text-violet-800">{ikcWO.no_wo}</span>
                              <span className="text-[10px] text-violet-500">{ikcWO.nama_kendaraan || ''}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attachments Section */}
                  {item._type !== 'adjustment' && (
                    <div className="px-5 pb-4">
                      <button
                        onClick={() => toggleAttachments(item)}
                        disabled={loadingItems[claimId]}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {loadingItems[claimId] ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Memuat Lampiran...
                          </>
                        ) : (
                          <>
                            <FileText size={14} />
                            {loadedImages[`list_${claimId}`] ? 'Sembunyikan Lampiran DMS' : 'Tampilkan Lampiran DMS'}
                            {dmsAttachments && dmsAttachments.length > 0 && ` (${dmsAttachments.length})`}
                          </>
                        )}
                      </button>

                      {/* Attachment List (Expanded on Demand) */}
                      {loadedImages[`list_${claimId}`] && dmsAttachments && dmsAttachments.length > 0 && (() => {
                        const images = dmsAttachments.filter(att => /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName || att.name || ''));
                        const nonImages = dmsAttachments.filter(att => !/\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName || att.name || ''));

                        return (
                          <div className="mt-4 border-t border-zinc-100 pt-4 space-y-4">
                            {/* Images Grid */}
                            {images.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-black text-zinc-700 flex items-center gap-1.5">
                                    <ShieldCheck size={13} className="text-blue-500" /> Lampiran Gambar ({images.length})
                                  </h4>
                                  <a
                                    href={buildAttachmentPreviewUrl(images)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                                  >
                                    Buka Semua di DMS
                                  </a>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {images.map((att, aIdx) => {
                                    const fileId = att.fileId || att.id || '';
                                    const fileName = att.fileName || att.name || '';
                                    const downloadUrl = `/api/chery_dms?endpoint=download_file&id=${fileId}`;

                                    return (
                                      <div key={aIdx} className="relative group aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 shadow-sm flex flex-col justify-between">
                                        {/* Image */}
                                        <div
                                          className="relative flex-1 overflow-hidden cursor-zoom-in"
                                          onClick={() => setZoomedImage({ url: downloadUrl, name: fileName })}
                                        >
                                          <img
                                            src={downloadUrl}
                                            alt={fileName}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              const parent = e.target.parentElement;
                                              if (parent) {
                                                parent.innerHTML = `
                                                  <div class="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-red-50 text-red-500">
                                                    <span class="text-[10px] font-bold">Gagal memuat gambar</span>
                                                  </div>
                                                `;
                                              }
                                            }}
                                          />
                                          {/* Hover overlay for zoom */}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-black uppercase tracking-wider">
                                            Perbesar
                                          </div>
                                        </div>

                                        {/* Filename banner at bottom */}
                                        <div className="bg-black/75 px-2 py-1 text-[10px] text-white text-center font-bold truncate z-10" title={fileName}>
                                          {fileName}
                                        </div>

                                        {/* Link DMS button absolute on top right */}
                                        <a
                                          href={buildSingleContainerUrl(att, images)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-black/60 hover:bg-black/80 text-white rounded text-[8px] font-black uppercase z-20 transition-colors"
                                        >
                                          Link DMS
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Non-images list */}
                            {nonImages.length > 0 && (
                              <div>
                                <h4 className="text-xs font-black text-zinc-700 mb-2 flex items-center gap-1.5">
                                  <FileText size={13} className="text-zinc-500" /> Lampiran Dokumen ({nonImages.length})
                                </h4>
                                <div className="space-y-1.5">
                                  {nonImages.map((att, aIdx) => {
                                    const fileId = att.fileId || att.id || '';
                                    const fileName = att.fileName || att.name || '';
                                    const downloadUrl = `/api/chery_dms?endpoint=download_file&id=${fileId}`;

                                    return (
                                      <div key={aIdx} className="flex items-center justify-between border border-zinc-200 rounded-xl bg-white p-2.5 shadow-sm text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText size={14} className="text-zinc-400 shrink-0" />
                                          <span className="font-semibold text-zinc-700 truncate" title={fileName}>{fileName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <a
                                            href={downloadUrl}
                                            download={fileName}
                                            className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold transition-colors"
                                          >
                                            Unduh
                                          </a>
                                          <a
                                            href={buildSingleContainerUrl(att, dmsAttachments)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition-colors"
                                          >
                                            Link DMS
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Bottom pagination */}
            {totalItemPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={() => { setItemPage(p => Math.max(0, p - 1)); }} disabled={itemPage === 0}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
                <span className="text-sm text-zinc-500">Halaman {itemPage + 1} dari {totalItemPages} · {filteredItems.length} total item</span>
                <button onClick={() => { setItemPage(p => Math.min(totalItemPages - 1, p + 1)); }} disabled={itemPage >= totalItemPages - 1}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoomedImage(null)}>
          <div className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden p-3 flex flex-col shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-700 truncate">{zoomedImage.name}</span>
              <button onClick={() => setZoomedImage(null)} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-zinc-950 rounded-xl mt-2 flex items-center justify-center relative min-h-[500px] p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List Page ────────────────────────────────────────────────
export default function ProformaInvoice() {
  const def = getDefaultRange();
  const [fromDate, setFromDate] = useState(def.from);
  const [toDate, setToDate] = useState(def.to);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('all');
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState(null); // selected settlement for detail view

  const fetchData = useCallback(async (force = false) => {
    setIsLoading(true); setError(null);
    try {
      const beginISO = fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : '';
      const endISO = toDate ? new Date(toDate + 'T23:59:59').toISOString() : '';

      const cacheKey = `${page}_${pageSize}_${beginISO}_${endISO}`;
      if (!force && GLOBAL_PROFORMA_CACHE.list && GLOBAL_PROFORMA_CACHE.list[cacheKey]) {
        const cached = GLOBAL_PROFORMA_CACHE.list[cacheKey];
        setData(cached.rows);
        setTotalRecords(cached.total);
        setIsLoading(false);
        return;
      }

      const json = await apiFetch({ endpoint: 'proforma-list', pageIndex: page, pageSize, beginCreateTime: beginISO, endCreateTime: endISO });
      const payload = json.payload || json;
      const rows = payload.content || payload.data || payload.items || [];

      if (!GLOBAL_PROFORMA_CACHE.list) {
        GLOBAL_PROFORMA_CACHE.list = {};
      }
      GLOBAL_PROFORMA_CACHE.list[cacheKey] = {
        rows,
        total: payload.totalElements || payload.total || rows.length
      };

      setData(rows);
      setTotalRecords(payload.totalElements || payload.total || rows.length);
    } catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  }, [fromDate, toDate, page, pageSize]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  // If a settlement is selected, show detail page
  if (selected) {
    return <DetailPage settlement={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = data.filter(row => {
    const code = row.code || '';
    if (kategoriFilter === 'free-service' && !code.startsWith('BY')) return false;
    if (kategoriFilter === 'warranty' && !code.startsWith('BX')) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![code, row.vin || '', row.customerName || '', row.dealerName || ''].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(totalRecords / pageSize);
  const hasFilters = search || kategoriFilter !== 'all';
  const totalFeeSum = filtered.reduce((s, r) => s + Number(r.totalFee || 0), 0);
  const refusedFeeSum = filtered.reduce((s, r) => s + Number(r.totalRefusePayFee || 0), 0);

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-5 py-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-zinc-900 leading-tight">Proforma Invoice</h1>
              <p className="text-[10px] text-zinc-400">Claim Settlement DMS</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-zinc-400 shrink-0" />
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900" />
            <span className="text-zinc-400 text-xs">–</span>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}
              className="px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900" />
          </div>

          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(0); }} className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Code, VIN, nama..."
                className="pl-7 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 w-44 text-zinc-900" />
            </div>
            <button type="submit" className="px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors">Cari</button>
          </form>

          <button onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showFilter || hasFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}>
            <Filter size={12} /> Filter {hasFilters && <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />}
          </button>

          <button onClick={() => fetchData(true)} disabled={isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors ml-auto">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs text-zinc-400">{isLoading ? 'Memuat...' : `${totalRecords} settlement`}</span>
        </div>

        {showFilter && (
          <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-zinc-100">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kategori</label>
              <select value={kategoriFilter} onChange={e => { setKategoriFilter(e.target.value); setPage(0); }}
                className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-900">
                <option value="all">Semua</option>
                <option value="free-service">Free Service (BY / IFS)</option>
                <option value="warranty">Warranty (BX / IKC)</option>
              </select>
            </div>
            {hasFilters && (
              <button onClick={() => { setSearch(''); setSearchInput(''); setKategoriFilter('all'); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                <X size={12} /> Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Settlement', value: filtered.length, color: 'bg-zinc-900', icon: FileText },
          { label: 'Total Fee', value: formatRupiah(totalFeeSum), color: 'bg-blue-600', icon: DollarSign },
          { label: 'Refused Fee', value: formatRupiah(refusedFeeSum), color: 'bg-red-600', icon: XCircle },
          { label: 'Settled', value: filtered.filter(r => r.status === 9).length, color: 'bg-green-600', icon: CheckCircle2 },
        ].map(c => {
          const Icon = c.icon; return (
            <div key={c.label} className={`${c.color} rounded-2xl p-3.5 flex items-center justify-between shadow-sm`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white opacity-70">{c.label}</p>
                <p className="text-lg font-black mt-0.5 text-white leading-tight">{c.value}</p>
              </div>
              <Icon size={24} className="text-white opacity-25" />
            </div>
          );
        })}
      </div>

      {/* Category breakdown */}
      <div className="px-5 py-2 flex items-center gap-3 text-xs text-zinc-400 font-bold uppercase tracking-wider shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-green-50 text-green-700 border-green-200">
          {filtered.filter(r => (r.code || '').startsWith('BY')).length} BY / IFS
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
          {filtered.filter(r => (r.code || '').startsWith('BX')).length} BX / IKC
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-zinc-100 text-zinc-600 border-zinc-200">
          {filtered.filter(r => !(r.code || '').startsWith('BY') && !(r.code || '').startsWith('BX')).length} Lainnya
        </span>
      </div>

      {error && (
        <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shrink-0">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => fetchData(true)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Coba Lagi</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        {isLoading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Memuat data...</p>
          </div>
        ) : filtered.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText size={36} className="text-zinc-300" />
            <p className="text-sm font-bold text-zinc-400">Tidak ada data proforma</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {['Code', 'Kategori', 'Settlement Month', 'Status', 'Labor Fee', 'Material Fee', 'Total Fee', 'Refused Fee', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((row, i) => {
                    const code = row.code || '-';
                    const st = getStatus(row.status);
                    const month = row.settlementMonth || row.createTime || '';
                    return (
                      <tr key={i}
                        className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                        onClick={() => setSelected(row)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-black text-zinc-900 text-sm group-hover:text-zinc-700">{code}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {code.startsWith('BY') ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-green-50 text-green-700 border-green-200">
                              BY / IFS
                            </span>
                          ) : code.startsWith('BX') ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                              BX / IKC
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border bg-zinc-100 text-zinc-600 border-zinc-200">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">{formatDate(month)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(row.laborFee)}</td>
                        <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-xs text-right">{formatRupiah(row.materialFee)}</td>
                        <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap text-xs text-right">{formatRupiah(row.totalFee)}</td>
                        <td className="px-4 py-3 text-red-600 whitespace-nowrap text-xs text-right">{row.totalRefusePayFee ? formatRupiah(row.totalRefusePayFee) : '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-zinc-400 group-hover:text-zinc-700 transition-colors">
                            <span className="text-xs font-semibold">Lihat Detail</span>
                            <ChevronRight size={14} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-zinc-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Tampilkan:</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white text-zinc-700 font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            {[10, 20, 30, 50].map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">
            {totalRecords > 0 ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalRecords)} dari ${totalRecords}` : '0 data'}
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
            <span className="text-xs font-semibold text-zinc-700 px-2">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}