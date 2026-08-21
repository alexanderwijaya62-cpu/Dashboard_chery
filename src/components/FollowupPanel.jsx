import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LayoutDashboard, Clock, CheckCircle, Calendar, LineChart, Upload, Download, Search, X, ChevronRight, ChevronLeft, Image as ImageIcon, Send, Menu, Filter, MoreVertical, ExternalLink, Phone, RefreshCw, Car, MessageCircle } from 'lucide-react';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabaseClient';
import { db } from '../utils/dbClient';
import { fetchBookingConfig, generateSlots } from '../utils/bookingConfig';
import { fetchHolidays, isHolidayOrSunday } from '../utils/holidayHelpers';
import { CSI_WA_TEMPLATE, CHERY_DMS_URL } from '../utils/config';
import CroBookingPanel from './CroBookingPanel';
import HolidaySettings from './HolidaySettings';

const CHERY_CORPORATE_NAME = 'PT. CHERY SALES INDONESIA';

let ifsGlobalCache = null;
let ifsGlobalCacheTime = 0;

const DEALER_OPTIONS = [
  { id: 'optef3IAAh', name: 'ORIENTAL SM RAJA AMPLAS' },
  { id: 'optGxr0Wc6', name: 'ARTA PLUIT' },
  { id: 'optNvUSS4D', name: 'BINTANG MITRA JOGLO' },
  { id: 'optWLhT4Os', name: 'AEM YASMIN BOGOR' },
  { id: 'opt1hiRpmb', name: 'AEM BANJARMASIN' },
  { id: 'optcV2MXSJ', name: 'ARTA KELAPA GADING' },
  { id: 'optAurtzzR', name: 'MANANG PRAPEN' },
  { id: 'optCWHEIjB', name: 'TRIMEGAH BSD' },
  { id: 'optflTIPSo', name: 'MOBIL CERIA ARJUNO' },
  { id: 'opta7mQheY', name: 'INERTA PAMULANG' },
  { id: 'optPXmyxrS', name: 'CAM CINERE' },
  { id: 'optw2xovPr', name: 'ARTA KARAWANG' },
  { id: 'opt5vPcgGk', name: 'CHERINDO CIBUBUR' },
  { id: 'optnVB8SO6', name: 'ARTA SERPONG' },
  { id: 'optZ7McgtL', name: 'AEM KENDARI' },
  { id: 'optZu6TzL5', name: 'PUSAKA BEKASI TIMUR' },
  { id: 'optKPQjp3g', name: 'DUNIA KARAWACI' },
  { id: 'opt4QtomFg', name: 'AMBARA ARJUNA' },
  { id: 'optKPoBqYL', name: 'GEDONG JEMBAR CIREBON' },
  { id: 'optyWJ6JBj', name: 'BSP SUNTER' },
  { id: 'optQsUh3bx', name: 'CHERINDO VETERAN' },
  { id: 'optoRB1Dxt', name: 'MAJESTY BATAM CENTER' },
  { id: 'optoZ3yzHw', name: 'DWIPA DENPASAR' },
  { id: 'optmVyPKuP', name: 'SUMBER BARU YOGYAKARTA' },
  { id: 'optW0Suygg', name: 'ARTA BEKASI' },
  { id: 'opt0waFQk9', name: 'MAN KALIMALANG' },
  { id: 'optNlAGD3G', name: 'INOVASI SOEKARNO HATTA' },
  { id: 'optS1cylra', name: 'MBI CIKUPA' },
  { id: 'optQPCNCDS', name: 'INTI MOBIL SETIABUDI' },
  { id: 'optpbGRx4B', name: 'TRIMEGAH SILIWANGI' },
  { id: 'optzQ5Jhbm', name: 'ARTA PIK 2' },
  { id: 'opteAPlh10', name: 'AEM BSD CITY' },
  { id: 'optzoSHOq8', name: 'MENTARI CAKRA SURABAYA' },
  { id: 'optadO5zQR', name: 'MAN FATMAWATI' },
  { id: 'optLtJZguH', name: 'INTI MOBIL SOLO' },
  { id: 'optne19ZVJ', name: 'TRIDAYA TELLO' },
  { id: 'optjxzR1Mv', name: 'BINTANG MITRA PONDOK GEDE' },
  { id: 'opts9o154A', name: 'ANTAPURA MT HARYONO' },
  { id: 'optsgEFpIo', name: 'MANANG MAYJEN SUNGKONO' },
  { id: 'optofkfj3k', name: 'ADS BINTARO' },
  { id: 'optoFkvmit', name: 'BINTANG MITRA PURWOKERTO' },
  { id: 'opt7iQEhuv', name: 'OAP PALU' },
  { id: 'optQODkpY2', name: 'DUNIA PALMERAH' },
  { id: 'optTaPmQpC', name: 'HAYYU SAMARINDA' },
  { id: 'optibAiIcm', name: 'CENTRAL SEMARANG' },
  { id: 'optny9eVtf', name: 'WILTOP JAMBI' },
  { id: 'optmuRcR9E', name: 'SMS MARGONDA' },
  { id: 'opt1rLPrju', name: 'INTI MOBIL CEMPAKA PUTIH' },
  { id: 'opt4qEBM4e', name: 'ALTO PURI' },
  { id: 'opt7ReoGyA', name: 'ORIENTAL PEKANBARU' },
  { id: 'optinhYC9C', name: 'BINTANG MITRA MALANG' },
  { id: 'optAgTWeJ8', name: 'MAHKOTA KUPANG' },
  { id: 'optlkiDiXR', name: 'ANEKA PONTIANAK' },
  { id: 'optmiMRniw', name: 'PRADIPTA SOLO BARU' },
  { id: 'optb2yfx81', name: 'CENTRAL KUDUS' },
  { id: 'optjqbtqvz', name: 'SMS GRAHA RAYA' },
  { id: 'opt61sYia9', name: 'INTI MOBIL SEMARANG' },
  { id: 'opt53MaOv4', name: 'CAM PALEMBANG' },
  { id: 'optp8xYGIP', name: 'SMS BALIKPAPAN' },
  { id: 'optdnpiIAb', name: 'MAHKOTA PDK. INDAH' },
  { id: 'optCc4rJme', name: 'ANTAPURA LAMPUNG' },
  { id: 'optn04kcmK', name: 'BINTANG MITRA CIKARANG' },
  { id: 'opt7vm5wyI', name: 'STA PADANG' },
  { id: 'optcQK8Sv4', name: 'OAP MANADO' },
  { id: 'optbLoy0Ge', name: 'AEM KUTA' },
  { id: 'optXFJjjwj', name: 'BINTANG MITRA JEMBER' },
  { id: 'opteyRUbFM', name: 'ORIENTAL ACEH' },
  { id: 'optOm2FZBA', name: 'GALLERIE CIBINONG' },
  { id: 'opt3X576RP', name: 'PERSADA LAMPUNG' },
  { id: 'optCQ1QBdm', name: 'WONDER PAJAJARAN' },
  { id: 'optR7CbNPK', name: 'INTI MOBIL TASIKMALAYA' },
  { id: 'optRefX1G8', name: 'AVANTE MAGELANG' },
  { id: 'optaswoVX3', name: 'AVANTE TEGAL' },
  { id: 'optQgODT01', name: 'ALTO PASTEUR' },
  { id: 'optldt2fta', name: 'Wonder Palembang' },
];

const toLocalIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parseLocalIso = (iso) => {
    if (!iso) return new Date();
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
};

const formatDisplayDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
};

export default function FollowupPanel({ user, handleLogout, isNavbarVisible, initialTab = 'belum', setCurrentPage, breakSettings, setBreakSettings }) {
    const [currentTab, setCurrentTab] = useState(initialTab);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Sync currentTab with initialTab prop
    useEffect(() => {
      if (initialTab && initialTab !== currentTab) {
        setCurrentTab(initialTab);
      }
    }, [initialTab]);
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [cloudStatus, setCloudStatus] = useState(false);
    const [isImagesEnabled, setIsImagesEnabled] = useState(true);

    // Filter states
    const [filters, setFilters] = useState({ nama: '', tanggal: '', plat: '', tipe: '', keluhan: '', vin: '', respon: '' });
    const [fsFilters, setFsFilters] = useState({ nama: '', plat: '', tipe: '' });
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [activeTablePage, setActiveTablePage] = useState(1);

    const [fsPeriodMonths, setFsPeriodMonths] = useState(3);
    const fileInputRef = useRef(null);
    const fileAttachmentRef = useRef(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedRecordIds, setSelectedRecordIds] = useState([]);
    const [isFsModalOpen, setIsFsModalOpen] = useState(false);
    const [fsSelectedId, setFsSelectedId] = useState(null);

    const [jenisTemplate, setJenisTemplate] = useState('reguler');
    const [templateText, setTemplateText] = useState('');
    const [fsTemplateText, setFsTemplateText] = useState('');
    const [responCustomer, setResponCustomer] = useState('');
    const [currentAttachedImages, setCurrentAttachedImages] = useState([]); // Array untuk menampung banyak gambar
    const [isDragging, setIsDragging] = useState(false);
    const [isViewingResponse, setIsViewingResponse] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);

    // CSI Monthly Report states
    const [csiMonthlyData, setCsiMonthlyData] = useState([]);
    const [csiLoading, setCsiLoading] = useState(false);
    const [csiMonth, setCsiMonth] = useState(String(new Date().getMonth() + 1));
    const [csiYear, setCsiYear] = useState(String(new Date().getFullYear()));
    const [csiDealer, setCsiDealer] = useState('optef3IAAh');
    const [csiFollowupMap, setCsiFollowupMap] = useState({});
    const [csiSearchInput, setCsiSearchInput] = useState('');
    
    // Modal states for customer feedback comment
    const [isCsiModalOpen, setIsCsiModalOpen] = useState(false);
    const [csiModalItem, setCsiModalItem] = useState(null);
    const [csiCommentInput, setCsiCommentInput] = useState('');

    // Free Service (IFS) states
    const [ifsData, setIfsData] = useState([]);
    const [ifsLoading, setIfsLoading] = useState(false);
    const [ifsSearchInput, setIfsSearchInput] = useState('');
    const [ifsOnlyPriority, setIfsOnlyPriority] = useState(false);
    const [ifsMilestoneFilter, setIfsMilestoneFilter] = useState('Semua');
    const [ifsLastEntryFilter, setIfsLastEntryFilter] = useState('Semua');
    const [ifsLastEntryStart, setIfsLastEntryStart] = useState('');
    const [ifsLastEntryEnd, setIfsLastEntryEnd] = useState('');
    const [ifsTypeFilter, setIfsTypeFilter] = useState('first_service');
    const [ifsRowsPerPage, setIfsRowsPerPage] = useState(20);
    const [ifsActivePage, setIfsActivePage] = useState(1);
    const [ifsFollowupMap, setIfsFollowupMap] = useState({});
    
    // Modal states for IFS Free Service follow-up
    const [isIfsModalOpen, setIsIfsModalOpen] = useState(false);
    const [ifsModalItem, setIfsModalItem] = useState(null);
    const [ifsCommentInput, setIfsCommentInput] = useState('');
    const [ifsBookingDateInput, setIfsBookingDateInput] = useState('');
    const [ifsStatusInput, setIfsStatusInput] = useState('Belum Follow Up');
    const [ifsBookingTimeInput, setIfsBookingTimeInput] = useState('09:00');

    // Redesigned Unified Service Followup states
    const [lwoFollowups, setLwoFollowups] = useState([]);
    const [lwoLoading, setLwoLoading] = useState(false);
    const [serviceFollowupMap, setServiceFollowupMap] = useState({});
    const [serviceSearchInput, setServiceSearchInput] = useState('');
    const [serviceStatusFilter, setServiceStatusFilter] = useState('Semua');
    const [serviceStartDate, setServiceStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return toLocalIso(d);
    });
    const [serviceEndDate, setServiceEndDate] = useState(() => toLocalIso(new Date()));
    const [serviceSortOrder, setServiceSortOrder] = useState('asc');
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [selectedLwoItem, setSelectedLwoItem] = useState(null);
    const [serviceStatusInput, setServiceStatusInput] = useState('Belum Follow Up');
    const [serviceCommentInput, setServiceCommentInput] = useState('');
    const [isBookingChecked, setIsBookingChecked] = useState(false);
    const [serviceBookingDateInput, setServiceBookingDateInput] = useState('');
    const [serviceBookingTimeInput, setServiceBookingTimeInput] = useState('09:00');

    const parseIndonesianDate = useCallback((dateStr) => {
        if (!dateStr || dateStr === '-') return new Date(0);
        
        const cleanStr = String(dateStr).trim();
        
        // 1. Check DD-MM-YYYY or DD/MM/YYYY
        const dmyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2})[:.](\d{1,2}))?/;
        const matchDmy = cleanStr.match(dmyPattern);
        if (matchDmy) {
            const day = parseInt(matchDmy[1]);
            const month = parseInt(matchDmy[2]) - 1;
            const year = parseInt(matchDmy[3]);
            const hours = matchDmy[4] ? parseInt(matchDmy[4]) : 0;
            const minutes = matchDmy[5] ? parseInt(matchDmy[5]) : 0;
            return new Date(year, month, day, hours, minutes);
        }

        // 2. Check YYYY-MM-DD
        const ymdPattern = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})[:.](\d{1,2}))?/;
        const matchYmd = cleanStr.match(ymdPattern);
        if (matchYmd) {
            const year = parseInt(matchYmd[1]);
            const month = parseInt(matchYmd[2]) - 1;
            const day = parseInt(matchYmd[3]);
            const hours = matchYmd[4] ? parseInt(matchYmd[4]) : 0;
            const minutes = matchYmd[5] ? parseInt(matchYmd[5]) : 0;
            return new Date(year, month, day, hours, minutes);
        }

        // 3. Indonesian verbal date format
        const months = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'jun': 5,
            'jul': 6, 'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
        };
        try {
            const lowerStr = cleanStr.toLowerCase().replace(',', '');
            const parts = lowerStr.split(/\s+/);
            if (parts.length >= 3) {
                const day = parseInt(parts[0]);
                const monthStr = parts[1].slice(0, 3);
                const month = months[monthStr] !== undefined ? months[monthStr] : 0;
                const year = parseInt(parts[2]);
                let hours = 0;
                let minutes = 0;
                if (parts[3]) {
                    const timeParts = parts[3].split('.');
                    hours = parseInt(timeParts[0]) || 0;
                    minutes = parseInt(timeParts[1]) || 0;
                }
                return new Date(year, month, day, hours, minutes);
            }
        } catch (e) {
            console.error('Indonesian parsing failed for', dateStr, e);
        }

        // 4. Excel/Google Sheets serial date (mis. 45871.375) & epoch timestamp
        const cleanNum = cleanStr.replace(/,/g, '.');
        if (/^-?\d+(?:\.\d+)?$/.test(cleanNum)) {
            const num = parseFloat(cleanNum);
            if (num > 0) {
                if (num > 1000000000000) return new Date(num);        // epoch milidetik (13 digit)
                if (num > 1000000000) return new Date(num * 1000);    // epoch detik (10 digit)
                if (num < 1000000) return new Date(Date.UTC(1899, 11, 30) + num * 86400000); // serial Excel/GAS
            }
        }

        // 5. Native JS date fallback
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    }, []);

    const getPriorityMilestone = useCallback((latestIfsDate) => {
        if (!latestIfsDate || latestIfsDate.getTime() === 0) return null;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const milestones = [
            { label: '6 Bulan', monthsToAdd: 6 },
            { label: '1 Tahun', monthsToAdd: 12 },
            { label: '2 Tahun', monthsToAdd: 24 },
            { label: '3 Tahun', monthsToAdd: 36 }
        ];
        
        for (const m of milestones) {
            const mDate = new Date(latestIfsDate);
            mDate.setMonth(mDate.getMonth() + m.monthsToAdd);
            if (mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear) {
                return m.label;
            }
        }
        return null;
    }, []);

    const fetchIfsReport = useCallback(async (forceRefresh = false) => {
        setIfsLoading(true);
        try {
            // 1. Fetch settings keys starting with ifs_fo_
            const { data: settingsData } = await db.select('settings', {
                like: { key: 'ifs_fo_%' }
            });
            const followupMap = {};
            if (settingsData) {
                settingsData.forEach(item => {
                    const vinKey = item.key.replace('ifs_fo_', '');
                    try {
                        followupMap[vinKey] = JSON.parse(item.value);
                    } catch (e) {
                        followupMap[vinKey] = { status: item.value, comment: '', bookingDate: '' };
                    }
                });
            }
            setIfsFollowupMap(followupMap);

            // 1b. Check cache
            if (!forceRefresh && ifsGlobalCache && (Date.now() - ifsGlobalCacheTime < 600000)) {
                setIfsData(ifsGlobalCache);
                setIfsLoading(false);
                return;
            }

            // 2. Fetch reminder data from DMS (reminder-do) — CRO scope, from 01-01-2023 to today
            const todayStr = toLocalIso(new Date());
            const reminderRes = await fetch(`${CHERY_DMS_URL}?endpoint=reminder-do&do_from=2023-01-01&do_to=${todayStr}`);
            const reminderJson = await reminderRes.json().catch(() => ({ data: [] }));
            const reminderRows = Array.isArray(reminderJson.data) ? reminderJson.data : [];

            if (!reminderRows.length) {
                setIfsData([]);
                return;
            }

            // 3. Fallback phone / keluhan enrichment from cro, history
            const { data: croData } = await db.select('cro').catch(() => ({ data: [] }));
            const { data: historyData } = await db.select('history').catch(() => ({ data: [] }));

            // Last WO = the one finished most recently (matches service_terakhir)
            const findLastWo = (row) => {
                if (!Array.isArray(row.wo) || !row.wo.length) return null;
                const parsed = row.wo.map(wo => ({
                    wo,
                    selesai: parseIndonesianDate(wo.waktu_selesai),
                    masuk: parseIndonesianDate(wo.waktu_masuk)
                }));
                parsed.sort((a, b) => {
                    const d = b.selesai.getTime() - a.selesai.getTime();
                    return d !== 0 ? d : b.masuk.getTime() - a.masuk.getTime();
                });
                return parsed[0].wo;
            };

            // Group by VIN and keep the row with the latest maxDate
            const vinGroups = {};
            reminderRows.forEach(row => {
                const vin = String(row.no_rangka || '').trim().toUpperCase();
                if (!vin || vin === '-') return;

                const lastWo = findLastWo(row);
                const baseDateWO = lastWo ? parseIndonesianDate(lastWo.waktu_masuk) : parseIndonesianDate(row.service_terakhir);
                const baseDateDO = parseIndonesianDate(row.tgl_do);
                
                // Compare and group by latest entry date
                const maxDate = baseDateWO > baseDateDO ? baseDateWO : baseDateDO;

                if (!vinGroups[vin] || maxDate > vinGroups[vin].maxDate) {
                    vinGroups[vin] = {
                        maxDate,
                        baseDateWO,
                        baseDateDO,
                        woNo: lastWo ? String(lastWo.no_wo || '-') : '-',
                        plat: row.no_polisi || '-',
                        wktMasuk: lastWo ? String(lastWo.waktu_masuk || '-') : '-',
                        nama: row.nama || '-',
                        kendaraan: row.tipe || '-',
                        keluhan: lastWo ? String(lastWo.perintah || '') : '',
                        phone: row.no_hp || '',
                        noDo: row.no_do || '-',
                        tglDo: row.tgl_do || '-',
                        expectedService: row.expected_service || '-'
                    };
                }
            });

            // Map each grouped VIN
            const mapped = Object.keys(vinGroups).map(vin => {
                const item = vinGroups[vin];
                
                // Fallback phone lookup
                const cleanVin = vin.toUpperCase();
                const matchedCro = croData?.find(c => c.vin?.trim().toUpperCase() === cleanVin);
                const matchedHistory = historyData?.find(h => h.vin?.trim().toUpperCase() === cleanVin);
                
                let phone = item.phone || matchedCro?.telepon || matchedHistory?.noTelp || '';
                if (phone) {
                    phone = String(phone).trim();
                }

                // Calculate milestones dynamically
                const formatMilestone = (base, months) => {
                    if (!base || base.getTime() === 0) return '-';
                    const mDate = new Date(base);
                    mDate.setMonth(mDate.getMonth() + months);
                    const day = String(mDate.getDate()).padStart(2, '0');
                    const monthsIndo = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
                    return `${day} ${monthsIndo[mDate.getMonth()]} ${mDate.getFullYear()}`;
                };

                const milestone1m = formatMilestone(item.baseDateDO, 1);
                const milestone3m = formatMilestone(item.baseDateDO, 3);
                const milestone6m_DO = formatMilestone(item.baseDateDO, 6);

                const milestone1y = formatMilestone(item.baseDateWO, 12);
                const milestone2y = formatMilestone(item.baseDateWO, 24);
                const milestone3y = formatMilestone(item.baseDateWO, 36);

                // Priority check helper
                const checkPriority = (base, monthsList) => {
                    if (!base || base.getTime() === 0) return { label: null, date: null };
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();
                    for (const m of monthsList) {
                        const mDate = new Date(base);
                        mDate.setMonth(mDate.getMonth() + m.months);
                        if (mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear) {
                            return { label: m.label, date: mDate };
                        }
                    }
                    return { label: null, date: null };
                };

                const prioDO = checkPriority(item.baseDateDO, [
                    { label: '1 Bulan', months: 1 },
                    { label: '3 Bulan', months: 3 },
                    { label: '6 Bulan', months: 6 }
                ]);

                const prioWO = checkPriority(item.baseDateWO, [
                    { label: '1 Tahun', months: 12 },
                    { label: '2 Tahun', months: 24 },
                    { label: '3 Tahun', months: 36 }
                ]);

                const priorityDO = prioDO.label;
                const priorityTargetDateDO = prioDO.date;
                const priorityWO = prioWO.label;
                const priorityTargetDateWO = prioWO.date;

                const keluhan = item.keluhan || matchedHistory?.keluhan || matchedCro?.deskripsi || '-';

                return {
                    vin,
                    woNo: item.woNo,
                    plat: item.plat,
                    nama: item.nama,
                    kendaraan: item.kendaraan,
                    wktMasuk: item.wktMasuk,
                    noDo: item.noDo,
                    tglDo: item.tglDo,
                    expectedService: item.expectedService,
                    milestone1m,
                    milestone3m,
                    milestone6m_DO,
                    milestone1y,
                    milestone2y,
                    milestone3y,
                    priorityDO,
                    priorityWO,
                    priorityTargetDateDO,
                    priorityTargetDateWO,
                    keluhan,
                    phone,
                    baseDateDO: item.baseDateDO,
                    baseDateWO: item.baseDateWO
                };
            });

            ifsGlobalCache = mapped;
            ifsGlobalCacheTime = Date.now();
            setIfsData(mapped);
        } catch (e) {
            console.error(e);
            Toastify({ text: `⚠️ Gagal memuat data Free Service: ${e.message}`, background: 'red' }).showToast();
        } finally {
            setIfsLoading(false);
        }
    }, [parseIndonesianDate, getPriorityMilestone]);


    const filteredIfsData = useMemo(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        let result = ifsData.filter(item => {
            const baseDate = ifsTypeFilter === 'first_service' ? item.baseDateDO : item.baseDateWO;
            const priorityMilestone = ifsTypeFilter === 'first_service' ? item.priorityDO : item.priorityWO;

            // Last entry date filter (tanggal terakhir masuk / DO)
            if (ifsLastEntryFilter !== 'Semua') {
                if (baseDate instanceof Date && !isNaN(baseDate.getTime())) {
                    const itemTime = baseDate.getTime();
                    
                    if (ifsLastEntryFilter === '1_3_months') {
                        const threeMonthsAgo = new Date();
                        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                        threeMonthsAgo.setHours(0, 0, 0, 0);
                        
                        const oneMonthAgo = new Date();
                        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                        oneMonthAgo.setHours(23, 59, 59, 999);
                        
                        if (itemTime < threeMonthsAgo.getTime() || itemTime > oneMonthAgo.getTime()) {
                            return false;
                        }
                    } else if (ifsLastEntryFilter === 'custom') {
                        if (ifsLastEntryStart) {
                            const startDate = new Date(ifsLastEntryStart);
                            startDate.setHours(0, 0, 0, 0);
                            if (itemTime < startDate.getTime()) {
                                return false;
                            }
                        }
                        if (ifsLastEntryEnd) {
                            const endDate = new Date(ifsLastEntryEnd);
                            endDate.setHours(23, 59, 59, 999);
                            if (itemTime > endDate.getTime()) {
                                return false;
                            }
                        }
                    }
                } else {
                    return false;
                }
            }

            // Milestone period filter
            if (ifsMilestoneFilter !== 'Semua') {
                if (priorityMilestone !== ifsMilestoneFilter) {
                    return false;
                }
            }

            // Search filter
            if (ifsSearchInput) {
                const q = ifsSearchInput.toLowerCase();
                return (
                    item.vin.toLowerCase().includes(q) ||
                    item.nama.toLowerCase().includes(q) ||
                    item.plat.toLowerCase().includes(q)
                );
            }

            // Priority check
            if (ifsOnlyPriority) {
                return priorityMilestone !== null;
            }
            return true;
        });

        // Sorting: sorting from early milestone date to late milestone date
        if (ifsOnlyPriority) {
            result.sort((a, b) => {
                const dateA = ifsTypeFilter === 'first_service' ? a.priorityTargetDateDO : a.priorityTargetDateWO;
                const dateB = ifsTypeFilter === 'first_service' ? b.priorityTargetDateDO : b.priorityTargetDateWO;
                const timeA = dateA ? new Date(dateA).getTime() : 0;
                const timeB = dateB ? new Date(dateB).getTime() : 0;
                return timeA - timeB;
            });
        }

        return result;
    }, [ifsData, ifsSearchInput, ifsOnlyPriority, ifsMilestoneFilter, ifsLastEntryFilter, ifsLastEntryStart, ifsLastEntryEnd, ifsTypeFilter]);

    const paginatedIfsData = useMemo(() => {
        const totalPages = Math.ceil(filteredIfsData.length / ifsRowsPerPage) || 1;
        let cPage = ifsActivePage;
        if (cPage > totalPages) cPage = totalPages;
        const start = (cPage - 1) * ifsRowsPerPage;
        return filteredIfsData.slice(start, start + ifsRowsPerPage);
    }, [filteredIfsData, ifsActivePage, ifsRowsPerPage]);

    const handleIfsFollowupClick = (item) => {
        const state = ifsFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '', bookingDate: '' };
        setIfsModalItem(item);
        setIfsStatusInput(state.status || 'Belum Follow Up');
        setIfsCommentInput(state.comment || '');
        setIfsBookingDateInput(state.bookingDate || '');
        setIsIfsModalOpen(true);
    };

    const handleSaveIfsFollowup = async () => {
        if (ifsStatusInput === 'Sudah Follow Up' && !ifsCommentInput.trim()) {
            Toastify({ text: "⚠️ Komentar / masukan wajib diisi jika Sudah Follow Up!", background: "orange" }).showToast();
            return;
        }

        try {
            showLoading("Menyimpan status follow up Free Service...");
            const key = `ifs_fo_${ifsModalItem.vin}`;
            const valObj = {
                status: ifsStatusInput,
                comment: ifsCommentInput.trim(),
                bookingDate: ifsBookingDateInput,
                bookingTime: ifsBookingTimeInput || '09:00',
                updatedAt: new Date().toISOString()
            };

            const { error } = await db.upsert('settings', {
                key: key,
                value: JSON.stringify(valObj)
            }, { onConflict: 'key' });

            if (error) throw error;

            // Automatically insert into booking table if bookingDate is provided
            if (ifsBookingDateInput) {
                const bookingId = Date.now() + Math.floor(Math.random() * 10000);
                const { error: bkErr } = await db.insert('booking', {
                    id: bookingId,
                    noUrut: 0,
                    tanggal: ifsBookingDateInput,
                    jam: ifsBookingTimeInput || '09:00',
                    noPlat: ifsModalItem.plat || '-',
                    namaCustomer: ifsModalItem.nama || '-',
                    tipeMobil: ifsModalItem.kendaraan || '-',
                    noTelp: ifsModalItem.phone || '-',
                    keperluanService: 'Free Service (IFS Followup)',
                    status: 'accepted',
                    bookingVia: 'CRO Internal (IFS)',
                });
                if (bkErr) console.warn("Failed to register IFS booking:", bkErr);
            }

            Toastify({ text: "Berhasil memperbarui status follow up Free Service ✅", background: "green" }).showToast();
            setIsIfsModalOpen(false);
            fetchIfsReport();
        } catch (error) {
            console.error(error);
            Toastify({ text: "Gagal menyimpan data. Periksa koneksi.", background: "red" }).showToast();
        } finally {
            hideLoading();
        }
    };

    // Redesigned Unified Service Followup (7 Days entries from laporanworkorder)
    const fetchServiceFollowupData = useCallback(async () => {
        setLwoLoading(true);
        try {
            // 1. Fetch settings keys starting with service_fo_
            const { data: settingsData, error: settingsError } = await db.select('settings', {
                like: { key: 'service_fo_%' }
            });
            const followupMap = {};
            if (settingsData) {
                settingsData.forEach(item => {
                    const vinKey = item.key.replace('service_fo_', '');
                    try {
                        followupMap[vinKey] = JSON.parse(item.value);
                    } catch (e) {
                        followupMap[vinKey] = { status: 'Belum Follow Up', comment: '', bookingDate: '', bookingTime: '' };
                    }
                });
            }
            if (settingsError) {
                console.error('Gagal membaca settings follow up service:', settingsError);
            } else {
                setServiceFollowupMap(followupMap);
            }

            // 2. Fetch work orders untuk rentang tanggal terpilih (default 7 hari terakhir)
            const now = new Date();
            now.setHours(23, 59, 59, 999);
            const sevenDaysAgo = new Date();
            if (serviceStartDate && serviceEndDate) {
                const start = parseLocalIso(serviceStartDate);
                const end = parseLocalIso(serviceEndDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    sevenDaysAgo.setTime(start.getTime());
                    sevenDaysAgo.setHours(0, 0, 0, 0);
                    now.setTime(end.getTime());
                    now.setHours(23, 59, 59, 999);
                } else {
                    sevenDaysAgo.setDate(now.getDate() - 7);
                    sevenDaysAgo.setHours(0, 0, 0, 0);
                }
            } else {
                sevenDaysAgo.setDate(now.getDate() - 7);
                sevenDaysAgo.setHours(0, 0, 0, 0);
            }

            const fmtDmy = (d) => {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                return `${dd}-${mm}-${d.getFullYear()}`;
            };

            let dmsRows = [];
            try {
                const dmsRes = await fetch(`${CHERY_DMS_URL}?endpoint=warranty-wo&draw=1&start=0&length=500&fetchAll=true&from=${fmtDmy(sevenDaysAgo)}&to=${fmtDmy(now)}`);
                const dmsJson = await dmsRes.json().catch(() => ({ data: [] }));
                dmsRows = Array.isArray(dmsJson.data) ? dmsJson.data : [];
            } catch (e) {
                console.error('Gagal memuat WO dari DMS:', e);
            }

            let mapped = [];
            if (dmsRows.length > 0) {
                // DMS tersedia — pakai data real-time work order 7 hari terakhir
                mapped = dmsRows
                .map(r => {
                    const vin = String(r.no_chassis || '').trim().toUpperCase();
                    if (!vin || vin === '-') return null;

                    const masukDate = parseIndonesianDate(r.waktu_masuk);
                    if (!masukDate || masukDate < sevenDaysAgo || masukDate > now) return null;

                    // Nama pelanggan korporat → pakai nama pembawa (nama_pembawa)
                    const rawNama = r.nama_pelanggan_invoice || r.nama_pelanggan || '-';
                    const nama = rawNama.trim().toUpperCase() === CHERY_CORPORATE_NAME && r.nama_pembawa
                        ? String(r.nama_pembawa).trim()
                        : rawNama;

                    return {
                        vin,
                        woNo: r.no_wo || r.no_wo_dms || '-',
                        plat: r.no_polisi || '-',
                        nama,
                        kendaraan: r.nama_kendaraan || '-',
                        wktMasuk: r.waktu_masuk || '-',
                        sa: r.id_karyawan || r.nama_karyawan || '-',
                        keluhan: r.keluhan || '-',
                        phone: String(r.no_telp_pelanggan || r.no_telp_pelanggan_invoice || '').trim()
                    };
                })
                    .filter(Boolean);

                // Group by VIN to keep the latest work order
                const vinGroups = {};
                mapped.forEach(item => {
                    const rowDate = parseIndonesianDate(item.wktMasuk);
                    if (!vinGroups[item.vin] || rowDate > vinGroups[item.vin].latestDate) {
                        vinGroups[item.vin] = { latestDate: rowDate, item };
                    }
                });
                mapped = Object.keys(vinGroups).map(vin => vinGroups[vin].item);
            }

            if (mapped.length === 0) {
                // Fallback: tabel laporanwo lokal bila DMS tidak merespons / kosong
                let { data: lwoRows, error: lwoError } = await db.select('laporanwo');
                if (lwoError) {
                    console.error('Gagal memuat laporanwo:', lwoError);
                    setLwoFollowups([]);
                    return;
                }

                if (!lwoRows || !lwoRows.length) {
                    setLwoFollowups([]);
                    return;
                }

                // Sort in memory to avoid dot column parsing error in database
                lwoRows = [...lwoRows].sort((a, b) => {
                    const dateA = parseIndonesianDate(a['Wkt.Masuk']);
                    const dateB = parseIndonesianDate(b['Wkt.Masuk']);
                    return dateB - dateA;
                });

                // Fetch backups for phone & complaints matching
                const { data: croRows } = await db.select('cro').catch(() => ({ data: [] }));
                const { data: historyRows } = await db.select('history').catch(() => ({ data: [] }));
                const { data: bookingRows } = await db.select('booking').catch(() => ({ data: [] }));

                // Parse and filter rows in laporanwo (7 hari terakhir)
                const filteredRows = lwoRows.filter(row => {
                    const masukDate = parseIndonesianDate(row['Wkt.Masuk']);
                    return masukDate && masukDate >= sevenDaysAgo && masukDate <= now;
                });

                // Group by VIN (No. Rangka) to keep the latest work order
                const vinGroups = {};
                filteredRows.forEach(row => {
                    let vin = String(row['No. Rangka'] || '').trim().toUpperCase();
                    if (!vin || vin === '-') {
                        // Fallback: grup per No. WO bila VIN kosong
                        vin = String(row['No. WO'] || row['No. WO DMS'] || '').trim().toUpperCase();
                    }
                    if (!vin || vin === '-') return;

                    const rowDate = parseIndonesianDate(row['Wkt.Masuk']);
                    if (!vinGroups[vin] || rowDate > vinGroups[vin].latestDate) {
                        vinGroups[vin] = {
                            latestDate: rowDate,
                            row
                        };
                    }
                });

                // Map grouped records
                mapped = Object.keys(vinGroups).map(vin => {
                    const grp = vinGroups[vin];
                    const r = grp.row;
                    const cleanVin = vin;
                    const cleanPlat = String(r['No. Pol'] || '').trim().toUpperCase();

                    // Lookups for phone number
                    const matchedCro = croRows?.find(c => c.vin?.trim().toUpperCase() === cleanVin || c.plat?.trim().toUpperCase() === cleanPlat);
                    const matchedHistory = historyRows?.find(h => h.noPlat?.trim().toUpperCase() === cleanPlat);
                    const matchedBooking = bookingRows?.find(b => b.noPlat?.trim().toUpperCase() === cleanPlat);

                    let phone = r.nohp || matchedCro?.telepon || matchedHistory?.noTelp || matchedBooking?.noTelp || '';
                    if (phone) {
                        phone = String(phone).trim();
                    }

                    // Lookups for complaints
                    const keluhan = r.keluhan || matchedCro?.deskripsi || matchedHistory?.keluhanDetail || matchedBooking?.keluhanDetail || '-';

                    return {
                        vin,
                        woNo: r['No. WO'] || r['No. WO DMS'] || '-',
                        plat: r['No. Pol'] || '-',
                        nama: r['Nama Invoice'] || '-',
                        kendaraan: r['Kendaraan'] || '-',
                        wktMasuk: r['Wkt.Masuk'] || '-',
                        sa: r['SA'] || '-',
                        keluhan,
                        phone
                    };
                });
            }

            setLwoFollowups(mapped);
        } catch (e) {
            console.error("Gagal memuat data follow up service:", e);
            Toastify({ text: `Gagal memuat data follow up service: ${e.message}`, background: 'red' }).showToast();
        } finally {
            setLwoLoading(false);
        }
    }, [parseIndonesianDate, serviceStartDate, serviceEndDate]);

    const handleOpenServiceFollowupModal = (item) => {
        const state = serviceFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '', bookingDate: '', bookingTime: '09:00' };
        setSelectedLwoItem(item);
        setServiceStatusInput(state.status || 'Belum Follow Up');
        setServiceCommentInput(state.comment || '');
        setIsBookingChecked(!!state.bookingDate);
        setServiceBookingDateInput(state.bookingDate || '');
        setServiceBookingTimeInput(state.bookingTime || '09:00');
        setIsServiceModalOpen(true);
    };

    const handleSaveServiceFollowup = async () => {
        if (serviceStatusInput === 'Sudah Follow Up' && !serviceCommentInput.trim()) {
            Toastify({ text: "⚠️ Komentar / masukan wajib diisi jika Sudah Follow Up!", background: "orange" }).showToast();
            return;
        }

        const prevState = serviceFollowupMap[selectedLwoItem.vin] || null;

        try {
            const key = `service_fo_${selectedLwoItem.vin}`;
            const valObj = {
                status: serviceStatusInput,
                comment: serviceCommentInput.trim(),
                bookingDate: isBookingChecked ? serviceBookingDateInput : '',
                bookingTime: isBookingChecked ? serviceBookingTimeInput : '',
                updatedAt: new Date().toISOString()
            };

            // Optimistic update: tampilkan status & kesimpulan langsung di tabel tanpa reload
            setServiceFollowupMap(prev => ({
                ...prev,
                [selectedLwoItem.vin]: valObj
            }));

            const { error } = await db.upsert('settings', {
                key: key,
                value: JSON.stringify(valObj)
            }, { onConflict: 'key' });

            if (error) throw error;

            // Automatically register booking into the booking table if rescheduling is checked
            if (isBookingChecked && serviceBookingDateInput) {
                const bookingId = Date.now() + Math.floor(Math.random() * 10000);
                const { error: bkErr } = await db.insert('booking', {
                    id: bookingId,
                    noUrut: 0,
                    tanggal: serviceBookingDateInput,
                    jam: serviceBookingTimeInput || '09:00',
                    noPlat: selectedLwoItem.plat || '-',
                    namaCustomer: selectedLwoItem.nama || '-',
                    tipeMobil: selectedLwoItem.kendaraan || '-',
                    noTelp: selectedLwoItem.phone || '-',
                    keperluanService: 'Rescheduled Service (Followup)',
                    status: 'accepted',
                    bookingVia: 'CRO Internal (Reschedule)',
                });
                if (bkErr) console.warn("Failed to auto-insert rescheduled booking:", bkErr);
            }

            Toastify({ text: "Berhasil memperbarui status follow up Service ✅", background: "green" }).showToast();
            setIsServiceModalOpen(false);
        } catch (error) {
            console.error(error);
            // Revert optimistic update bila penyimpanan gagal
            setServiceFollowupMap(prev => {
                const next = { ...prev };
                if (prevState) {
                    next[selectedLwoItem.vin] = prevState;
                } else {
                    delete next[selectedLwoItem.vin];
                }
                return next;
            });
            Toastify({ text: "Gagal menyimpan data. Periksa koneksi.", background: "red" }).showToast();
        }
    };

    const fetchCsiMonthlyReport = useCallback(async () => {
        setCsiLoading(true);
        try {
            // 1. Fetch csi followups from settings table
            const { data: settingsData } = await db.select('settings', {
                like: { key: 'csi_fo_%' }
            });
            const followupMap = {};
            if (settingsData) {
                settingsData.forEach(item => {
                    const vinKey = item.key.replace('csi_fo_', '');
                    try {
                        followupMap[vinKey] = JSON.parse(item.value);
                    } catch (e) {
                        followupMap[vinKey] = { status: item.value, comment: '' };
                    }
                });
            }
            setCsiFollowupMap(followupMap);

            // 2. Fetch cro data for backup match
            const { data: croData } = await db.select('cro');
            // 3. Fetch history for backup match
            const { data: historyData } = await db.select('history');
            // 4. Fetch lwo data for backup match
            const { data: lwoData } = await db.select('laporanwo');

            // 5. Fetch CSI results from Feishu via csi-proxy
            const filterConditions = [
                {
                    fieldId: 'fldA9Oa6IA', // Dealer
                    fieldType: 19,
                    operator: 'contains',
                    value: [csiDealer],
                    conditionId: 'con2GlKFnL',
                },
                {
                    fieldId: 'fldc3urooF', // Month
                    fieldType: 20,
                    operator: 'contains',
                    value: [String(csiMonth)],
                    conditionId: 'conhboX683',
                },
                {
                    fieldId: 'fldHYwLI9Z', // Template ID
                    fieldType: 20,
                    operator: 'contains',
                    value: ['csi-7901-16'],
                    conditionId: 'conQiBWHmX',
                }
            ];

            const res = await fetch('/api/csi-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    view: 'results',
                    filter: JSON.stringify({
                        conditions: filterConditions,
                        conjunction: 'and',
                    }),
                }),
            });
            
            const json = await res.json();
            if (json.code !== 0) throw new Error(json.msg || 'Gagal mengambil data Feishu');
            
            const recordMap = json.data?.recordMap || {};
            const recordIds = json.data?.recordIDs || [];

            // Map and query DMS API in parallel by VIN search query
            const mapped = await Promise.all(recordIds.map(async id => {
                const r = recordMap[id];
                if (!r) return null;

                const vin = r.fldBbJb9CA?.value?.val?.[0]?.text || r.fldBbJb9CA?.value?.[0]?.text || '';
                const cleanVin = vin.trim().toUpperCase();
                if (!cleanVin) return null;

                // Match local db fallbacks
                const matchedCro = croData?.find(c => c.vin?.trim().toUpperCase() === cleanVin);
                const matchedHistory = historyData?.find(h => h.vin?.trim().toUpperCase() === cleanVin);

                let dmsWos = [];
                try {
                    const dmsRes = await fetch(`/api/chery_dms?endpoint=warranty-wo&draw=1&start=0&length=1000&fetchAll=true&search=${cleanVin}`);
                    const dmsJson = await dmsRes.json();
                    dmsWos = dmsJson?.data || [];
                } catch (e) {
                    console.error('Error fetching DMS WO for VIN', cleanVin, e);
                }

                // Filter and sort work orders
                const matchedWos = dmsWos
                    .filter(w => {
                        const wVin = (w.no_chassis || w['No. Rangka'] || '').trim().toUpperCase();
                        return wVin === cleanVin;
                    })
                    .sort((a, b) => new Date(b.waktu_masuk || b['Wkt.Masuk']) - new Date(a.waktu_masuk || a['Wkt.Masuk']))
                    .slice(0, 3);

                // Fallback to local db if no dynamic WOs returned
                if (matchedWos.length === 0) {
                    const dbWo = lwoData?.find(w => w['No. Rangka']?.trim().toUpperCase() === cleanVin);
                    if (dbWo) {
                        matchedWos.push({
                            no_wo: dbWo['No. WO'] || dbWo['No. WO DMS'] || '-',
                            waktu_masuk: dbWo['Wkt.Masuk'] || '-',
                            keluhan: matchedHistory?.keluhan || matchedCro?.deskripsi || '-'
                        });
                    } else if (matchedCro) {
                        matchedWos.push({
                            no_wo: matchedCro.workOrderNo || '-',
                            waktu_masuk: matchedCro.tanggalDatang || '-',
                            keluhan: matchedCro.deskripsi || '-'
                        });
                    }
                }

                // Find phone number
                let phone = '';
                for (const w of matchedWos) {
                    phone = w.no_telp_pelanggan || w.no_telp || w.no_hp || w.telepon || w.no_telp_booking || w.phone || '';
                    if (phone) break;
                }
                if (!phone && matchedCro) {
                    phone = matchedCro.telepon || '';
                }
                if (!phone && matchedHistory) {
                    phone = matchedHistory.noTelp || '';
                }
                if (phone) {
                    phone = String(phone).trim();
                }

                const commentQ7 = r.fldIfJu5jY?.value?.map(c => c.text).join('\n') || r.fldIfJu5jY?.value || '';
                const commentQ8 = r.fld4gEPGVF?.value?.map(c => c.text).join('\n') || r.fld4gEPGVF?.value || '';
                const overallScore = r.fldKw5T576?.value?.val || r.fldKw5T576?.value || 0;
                const recommendScore = r.fldYktqdva?.value || 0;

                return {
                    id,
                    vin: cleanVin,
                    nama: r.fldLOfP6ht?.value?.[0]?.text || '-',
                    overallScore,
                    recommendScore,
                    commentQ7,
                    commentQ8,
                    wos: matchedWos,
                    phone
                };
            }));

            setCsiMonthlyData(mapped.filter(Boolean));
        } catch (err) {
            console.error(err);
            Toastify({ text: `⚠️ Gagal memuat data laporan: ${err.message}`, background: 'red' }).showToast();
        } finally {
            setCsiLoading(false);
        }
    }, [csiMonth, csiYear, csiDealer]);

    useEffect(() => {
        if (currentTab === 'laporan') {
            fetchCsiMonthlyReport();
        } else if (currentTab === 'free_service') {
            fetchIfsReport();
        } else if (currentTab === 'belum' || currentTab === 'sudah') {
            fetchServiceFollowupData();
        }
    }, [currentTab, fetchCsiMonthlyReport, fetchIfsReport, fetchServiceFollowupData]);

    const filteredCsiData = useMemo(() => {
        return csiMonthlyData.filter(item => {
            if (csiSearchInput) {
                const q = csiSearchInput.toLowerCase();
                return (
                    item.vin.toLowerCase().includes(q) ||
                    item.nama.toLowerCase().includes(q) ||
                    item.woNo.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [csiMonthlyData, csiSearchInput]);

    const handleCsiFollowupClick = (item) => {
        const currentFollowup = csiFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '' };
        setCsiModalItem(item);
        setCsiCommentInput(currentFollowup.comment || '');
        setIsCsiModalOpen(true);
    };

    const handleSaveCsiFollowup = async () => {
        if (!csiCommentInput.trim()) {
            Toastify({ text: "⚠️ Komentar / masukan dari customer wajib diisi!", background: "orange" }).showToast();
            return;
        }

        try {
            showLoading("Menyimpan status follow up...");
            const key = `csi_fo_${csiModalItem.vin}`;
            const valObj = {
                status: 'Sudah Follow Up',
                comment: csiCommentInput.trim(),
                updatedAt: new Date().toISOString()
            };

            const { error } = await db.upsert('settings', {
                key: key,
                value: JSON.stringify(valObj)
            }, { onConflict: 'key' });

            if (error) throw error;

            Toastify({ text: "Berhasil memperbarui status follow up CSI ✅", background: "green" }).showToast();
            setIsCsiModalOpen(false);
            fetchCsiMonthlyReport();
        } catch (error) {
            console.error(error);
            Toastify({ text: "Gagal menyimpan data. Periksa koneksi.", background: "red" }).showToast();
        } finally {
            hideLoading();
        }
    };

    const showLoading = (text) => {
        setLoadingText(text);
        setIsLoading(true);
    };

    const hideLoading = () => {
        setIsLoading(false);
    };

    const loadFromLocal = () => {
        try {
            const localData = localStorage.getItem('bengkelData');
            if (localData) {
                setData(JSON.parse(localData));
            }
        } catch (e) {
            console.error("Local storage error:", e);
        }
    };

    const saveToLocal = (newData) => {
        try {
            localStorage.setItem('bengkelData', JSON.stringify(newData));
        } catch (e) {
            console.warn("Memori browser penuh", e);
        }
    };

    const fetchFromGoogleSheets = React.useCallback(async (isBackground = false) => {
        if (!isBackground) loadFromLocal();

        try {
            // Cek pengaturan bandwidth: Apakah gambar harus dimuat?
            const { data: settingsData } = await db.select('settings', { eq: { key: 'cro_images_enabled' }, maybeSingle: true });
            const showImages = settingsData ? settingsData.value === 'true' : true;
            setIsImagesEnabled(showImages);

            // Optimasi Egress: Jika showImages false, JANGAN ambil kolom 'lampiran'
            const selectCols = showImages 
                ? '*' 
                : 'id, workOrderNo, nama, telepon, vin, plat, serviceAdvisor, kilometer, tipeMobil, deskripsi, tanggalDatang, tahunBeli, partLama, partBaru, status, respon, tanggalFollowUp';

            const { data: supaData, error } = await db.select('cro', { select: selectCols, order: { column: 'id', ascending: false }, limit: 2000 });

            if (error) throw error;

            const mapped = (supaData || []).map(r => ({
                id: r.id,
                workOrderNo: r.workOrderNo,
                nama: r.nama,
                telepon: String(r.telepon || ''),
                vin: r.vin,
                plat: r.plat,
                serviceAdvisor: r.serviceAdvisor,
                kilometer: String(r.kilometer || ''),
                tipeMobil: r.tipeMobil,
                deskripsi: r.deskripsi,
                tanggalDatang: r.tanggalDatang,
                tahunBeli: r.tahunBeli,
                partLama: r.partLama,
                partBaru: r.partBaru,
                status: r.status,
                respon: r.respon,
                tanggalFollowUp: r.tanggalFollowUp,
                lampiran: r.lampiran || ""
            }));
            setData(mapped);
            saveToLocal(mapped);
            setCloudStatus(true);
        } catch (error) {
            console.error("Gagal Supabase:", error);
            if (!isBackground) Toastify({ text: "Koneksi ke Server Terputus", background: "red" }).showToast();
        } finally {
            if (!isBackground) hideLoading();
        }
    }, []);

    const syncToGoogleSheets = async (latestData) => {
        // Tidak diperlukan lagi, Supabase Realtime menangani sinkronisasi
        console.log("sync legacy: skipped — using Supabase");
    };

    useEffect(() => {
        fetchFromGoogleSheets();
    }, [fetchFromGoogleSheets]);

    // Realtime subscription for CRO data
    useEffect(() => {
        const channel = supabase
            .channel('cro-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cro' }, () => {
                fetchFromGoogleSheets(true);
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [fetchFromGoogleSheets]);

    const parseLampiran = (val) => {
        if (!val || val === '-') return [];
        let arr = [];
        if (Array.isArray(val)) {
            arr = val;
        } else {
            try {
                const parsed = JSON.parse(val);
                arr = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                arr = [val];
            }
        }
        // Pastikan hanya return array yang memiliki value image base64, buang string kosong
        return arr.filter(img => img && typeof img === 'string' && img.length > 5);
    };

    const formatTanggal = (value) => {
        if (!value || value === '-') return "-";
        const strValue = String(value).trim().toLowerCase();
        if (strValue.includes("drive in") || strValue === "null" || strValue === "undefined") return "-";

        let dateObj = null;
        if (value instanceof Date) {
            dateObj = value;
        } else if (typeof value === 'number') {
            dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
        } else if (typeof value === 'string') {
            // Hilangkan nama hari jika ada (misal "Senin, 16-03-2026")
            const cleanStr = value.includes(',') ? value.split(',')[1].trim() : value;
            const parts = cleanStr.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                else dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                dateObj = new Date(value);
            }
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
            const d = String(dateObj.getDate()).padStart(2, '0');
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const y = dateObj.getFullYear();
            return `${d}-${m}-${y}`;
        }
        return String(value);
    };

    const calculateNextService = (dateStr, addMonths) => {
        if (!dateStr || dateStr === "-") return "-";
        // Ambil bagian tanggal saja jika ada nama hari
        const cleanStr = dateStr.includes(',') ? dateStr.split(',')[1].trim() : dateStr;
        let parts = cleanStr.split('-');
        if (parts.length !== 3) return "-";

        let date = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
        if (isNaN(date.getTime())) return "-";
        date.setMonth(date.getMonth() + addMonths);

        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const getDueStatus = (dateStr) => {
        if (!dateStr || dateStr === "-") return { isDue: false, text: "", color: "" };
        let parts = dateStr.split('-');
        if (parts.length !== 3) return { isDue: false, text: "", color: "" };

        let jadwalDate = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
        let today = new Date();

        today.setHours(0, 0, 0, 0);
        jadwalDate.setHours(0, 0, 0, 0);

        let diffTime = jadwalDate.getTime() - today.getTime();
        let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { isDue: true, overdue: true, priority: 1, text: `Terlewat ${Math.abs(diffDays)} Hari`, color: "bg-red-100 text-red-800 border-red-300" };
        } else if (diffDays === 0) {
            return { isDue: true, overdue: false, priority: 2, text: "Jadwal Hari Ini", color: "bg-red-100 text-red-800 border-red-300" };
        } else if (diffDays <= 14) {
            return { isDue: true, overdue: false, priority: 3, text: `H-${diffDays}`, color: "bg-orange-100 text-orange-800 border-orange-300" };
        }

        return { isDue: false, overdue: false, priority: 99, text: "Aman", color: "text-zinc-600" };
    };

    const fsBadgeCount = useMemo(() => {
        let countDue = 0;
        data.forEach(item => {
            if (item.status === 'sudah' && item.tanggalDatang !== '-') {
                let desc = (item.deskripsi || "").toLowerCase();
                if (desc.includes('service')) {
                    let jadwalServis = calculateNextService(item.tanggalDatang, 3);
                    let statusJadwal = getDueStatus(jadwalServis);
                    if (statusJadwal.isDue) countDue++;
                }
            }
        });
        return countDue;
    }, [data]);

    // Derived states
    const filteredMainData = useMemo(() => {
        let filteredData = data.filter(item => {
            const statusRaw = (item.status || item.Status || '').toLowerCase();
            if (currentTab === 'belum') {
                return statusRaw === '' || statusRaw === 'belum';
            }
            return statusRaw === currentTab;
        });
        filteredData = filteredData.filter(item => {
            const matchNama = (item.nama || '').toLowerCase().includes(filters.nama || '');
            const matchTanggal = (item.tanggalDatang || '').toLowerCase().includes(filters.tanggal || '');
            const matchPlat = (item.plat || '').toLowerCase().includes(filters.plat || '');
            const matchTipe = (item.tipeMobil || '').toLowerCase().includes(filters.tipe || '');
            const matchKeluhan = (item.deskripsi || '').toLowerCase().includes(filters.keluhan || '');
            const matchVin = (item.vin || '').toLowerCase().includes(filters.vin || '');
            const matchRespon = (item.respon || '').toLowerCase().includes(filters.respon || '');
            return matchNama && matchTanggal && matchPlat && matchTipe && matchKeluhan && matchVin && matchRespon;
        });
        return filteredData;
    }, [data, currentTab, filters]);

    const groupedFilteredData = useMemo(() => {
        const groups = {};
        filteredMainData.forEach(item => {
            const key = (item.vin && item.vin !== '-') ? item.vin : (item.id + item.nama);
            if (!groups[key]) {
                groups[key] = {
                    ...item,
                    recordIds: [item.id],
                    descriptions: [item.deskripsi],
                    dates: [item.tanggalDatang]
                };
            } else {
                groups[key].recordIds.push(item.id);
                if (item.deskripsi && !groups[key].descriptions.includes(item.deskripsi)) {
                    groups[key].descriptions.push(item.deskripsi);
                }
                if (item.tanggalDatang && !groups[key].dates.includes(item.tanggalDatang)) {
                    groups[key].dates.push(item.tanggalDatang);
                }
            }
        });
        return Object.values(groups);
    }, [filteredMainData]);

    const paginatedMainData = useMemo(() => {
        const totalPages = Math.ceil(groupedFilteredData.length / rowsPerPage) || 1;
        let cPage = activeTablePage;
        if (cPage > totalPages) cPage = totalPages;
        const start = (cPage - 1) * rowsPerPage;
        return groupedFilteredData.slice(start, start + rowsPerPage);
    }, [groupedFilteredData, activeTablePage, rowsPerPage]);

    const fsDataList = useMemo(() => {
        let fsData = data.filter(item => {
            if (item.status !== 'sudah' || item.tanggalDatang === '-') return false;
            let desc = (item.deskripsi || "").toLowerCase();
            return desc.includes('service');
        });

        fsData = fsData.map(item => {
            let jadwalServis = calculateNextService(item.tanggalDatang, fsPeriodMonths);
            let statusJadwal = getDueStatus(jadwalServis);
            return { ...item, jadwalServis, statusJadwal };
        });

        fsData = fsData.filter(item => {
            const matchNama = (item.nama || '').toLowerCase().includes(fsFilters?.nama || '');
            const matchPlat = (item.plat || '').toLowerCase().includes(fsFilters?.plat || '');
            const matchTipe = (item.tipeMobil || '').toLowerCase().includes(fsFilters?.tipe || '');
            return matchNama && matchPlat && matchTipe;
        });

        fsData.sort((a, b) => {
            if (a.statusJadwal.priority !== b.statusJadwal.priority) {
                return a.statusJadwal.priority - b.statusJadwal.priority;
            }
            let getMs = (dateStr) => {
                if (!dateStr || dateStr === '-') return Infinity;
                let parts = dateStr.split('-');
                return new Date(parts[2], parseInt(parts[1]) - 1, parts[0]).getTime();
            };
            return getMs(a.jadwalServis) - getMs(b.jadwalServis);
        });

        return fsData;
        // eslint-disable-next-line
    }, [data, fsPeriodMonths, fsFilters]);


    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value.toLowerCase() }));
        setActiveTablePage(1);
    };

    const updateFsFilter = (key, value) => {
        setFsFilters(prev => ({ ...prev, [key]: value.toLowerCase() }));
    };

    const handleUploadExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                showLoading("Membaca dan mengimpor data Excel...");
                const arr = new Uint8Array(event.target.result);
                const workbook = XLSX.read(arr, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                // Helper untuk membersihkan angka besar/scientific agar masuk ke BigInt Supabase
                const cleanBigInt = (val) => {
                    if (!val || val === "-") return "0";
                    let s = String(val).trim();
                    if (s.toLowerCase().includes('e')) {
                        try {
                            // Paksa konversi dari scientific ke string angka utuh
                            s = Number(val).toLocaleString('fullwide', { useGrouping: false }).split('.')[0];
                        } catch (e) {
                            s = s.replace(/\D/g, '');
                        }
                    } else {
                        s = s.replace(/\D/g, '');
                    }
                    // Batasi ke 18 digit agar aman di range BigInt (max 19 digit)
                    return s.substring(0, 18) || "0";
                };

                const { data: existingRecords } = await db.select('cro', { select: 'workOrderNo' });
                const existingSet = new Set((existingRecords || []).map(r => String(r.workOrderNo || '').trim()));

                const toInsert = [];
                let skipCount = 0;
                let errorCount = 0;

                jsonData.forEach((row, i) => {
                    try {
                        let vinStr = String(row["VIN"] || "-").trim();
                        let namaStr = String(row["customer's name"] || "-").trim();
                        let woNo = row["Work Order No."] || row["work order no."] || row["Work Order No"];
                        
                        // Bersihkan Work Order No jika berupa scientific notation
                        let woStr = woNo ? cleanBigInt(woNo) : "-";

                        // Skip if duplicate WO
                        if (woStr !== "-" && woStr !== "0" && existingSet.has(woStr)) {
                            skipCount++;
                            return;
                        }

                        if (woStr !== "-" || vinStr !== "-" || namaStr !== "-") {
                            let deliveryTimeValue = row["Delivery time"] || row["delivery time"] || row["Delivery Time"] || row["Tanggal Masuk"] || "-";
                            let formattedTanggal = formatTanggal(deliveryTimeValue);
                            let saleDateValue = row["sale date"] || "-";

                            let partLama = (row["old part number"] ? row["old part number"] + " - " : "") + (row["old part name"] || "");
                            let partBaru = (row["new part number"] ? row["new part number"] + " - " : "") + (row["new item name"] || "");
                            let keluhan = row["Client Description"] || "-";

                            partLama = partLama.trim() === "-" || partLama.trim() === "" ? "" : partLama.trim();
                            partBaru = partBaru.trim() === "-" || partBaru.trim() === "" ? "" : partBaru.trim();

                            let phoneStr = cleanBigInt(row["mobile phone"] || row["Mobile Phone"]);
                            let kmStr = cleanBigInt(row["driven distance"] || row["Driven Distance"]);

                            toInsert.push({
                                id: Date.now() + i, // Pastikan ID unik untuk setiap baris
                                workOrderNo: woStr,

                                nama: namaStr,
                                telepon: phoneStr,
                                vin: vinStr,
                                plat: row["number plate"] || "-",
                                serviceAdvisor: row["Service Advisor"] || "-",
                                kilometer: kmStr,
                                tipeMobil: row["car series"] || "-",
                                deskripsi: keluhan !== "-" ? `• ${keluhan}` : "-",
                                tanggalDatang: formattedTanggal,
                                tahunBeli: formatTanggal(saleDateValue),
                                partLama: partLama ? `• ${partLama}` : "-",
                                partBaru: partBaru ? `• ${partBaru}` : "-",
                                status: "Belum",
                                respon: "",
                                lampiran: ""
                            });
                        }
                    } catch (e) {
                        console.error("Row error:", e);
                        errorCount++;
                    }
                });

                if (fileInputRef.current) fileInputRef.current.value = "";

                if (toInsert.length > 0) {
                    const { error } = await db.insert('cro', toInsert);

                    if (error) throw error;

                    // SYNC: Future cro entries → booking table (block slots)
                    try {
                        const _holidays = await fetchHolidays();
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const config = await fetchBookingConfig();
                        const slots = generateSlots(config.slotCount, config.gapMinutes, config.startHour, config.startMinute);
                        let syncCount = 0;
                        for (let i = 0; i < toInsert.length; i++) {
                            const item = toInsert[i];
                            if (item.tanggalDatang && item.tanggalDatang !== '-' && item.plat && item.plat !== '-') {
                                const parts = item.tanggalDatang.split('-');
                                if (parts.length === 3) {
                                    const dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                    const d = new Date(dateStr + 'T00:00:00');
                                    if (d >= today && !isHolidayOrSunday(dateStr, _holidays)) {
                                        const jam = slots[i % slots.length];
                                        const bookingId = Date.now() + i + Math.floor(Math.random() * 10000);
                                        await db.insert('booking', {
                                            id: bookingId,
                                            noUrut: 0,
                                            tanggal: dateStr,
                                            jam,
                                            noPlat: item.plat,
                                            namaCustomer: item.nama || '-',
                                            tipeMobil: item.tipeMobil || '-',
                                            noTelp: item.telepon || '-',
                                            keperluanService: item.deskripsi || '-',
                                            status: 'accepted',
                                            bookingVia: 'CRO Internal (Sync)',
                                        }).then(({ error: bkErr }) => {
                                            if (!bkErr) syncCount++;
                                        }).catch(() => {});
                                    }
                                }
                            }
                        }
                        if (syncCount > 0) {
                            console.log(`✅ Synced ${syncCount} CRO entries to booking`);
                        }
                    } catch (syncErr) {
                        console.warn('Cro→booking sync skipped:', syncErr);
                    }

                    setCurrentTab('belum');
                    Toastify({
                        text: `✅ Import Selesai! Berhasil: ${toInsert.length}, Lewati: ${skipCount} Duplikat, ${errorCount} Error.`,
                        background: 'green',
                        duration: 6000
                    }).showToast();
                    fetchFromGoogleSheets(true);
                } else {
                    const msg = skipCount > 0
                        ? `ℹ️ Tidak ada data baru (Dilewati ${skipCount} Duplikat, ${errorCount} Error).`
                        : "Tidak ditemukan data valid di file Excel.";
                    Toastify({ text: msg, background: "#3b82f6", duration: 5000 }).showToast();
                }

            } catch (error) {
                console.error("Gagal memproses file Excel", error);
                Toastify({ text: "Terjadi kesalahan saat membaca file Excel.", background: 'red' }).showToast();
            } finally {
                hideLoading();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportExcel = () => {
        const exportData = data.filter(item => item.status === 'sudah').map(item => {
            return {
                "Work Order No.": item.workOrderNo,
                "Nama Customer": item.nama,
                "No Telepon": item.telepon,
                "Plat Mobil": item.plat,
                "Tipe Mobil": item.tipeMobil,
                "VIN": item.vin,
                "Service Advisor": item.serviceAdvisor,
                "Kilometer": item.kilometer,
                "Tahun Pembelian": item.tahunBeli,
                "Deskripsi Service": item.deskripsi,
                "Part Lama": item.partLama,
                "Part Baru": item.partBaru,
                "Hasil Respon Customer": item.respon,
                "Tanggal Difollow-Up": item.tanggalFollowUp || "-",
                "Ada Lampiran Gambar": item.lampiran ? "Ya" : "Tidak"
            };
        });

        if (exportData.length === 0) {
            Toastify({ text: "Tidak ada data 'Sudah Follow Up' untuk di-export.", background: "red" }).showToast();
            return;
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wscols = [
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
            { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 50 }, { wch: 20 }, { wch: 20 }
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hasil Follow Up");

        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `Export_Sudah_Follow_Up_${dateStr}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

    const processImageFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            Toastify({ text: "Hanya file gambar yang diperbolehkan", background: 'red' }).showToast();
            return;
        }
        if (file.size > 20 * 1024 * 1024) { // Increase to 20MB for HD
            Toastify({ text: 'Ukuran file maks 20MB', background: 'red' }).showToast();
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;

                // HD Quality: Increase to 2500px for better readability of screenshots
                const MAX_DIMENSION = 2500; 
                if (width > height && width > MAX_DIMENSION) {
                    height *= MAX_DIMENSION / width;
                    width = MAX_DIMENSION;
                } else if (height > MAX_DIMENSION) {
                    width *= MAX_DIMENSION / height;
                    height = MAX_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const now = new Date();
                const tsStr = `Bukti Follow Up: ${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

                // Watermark yang lebih subtle dan profesional (tanpa box hitam pekat)
                ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                const fontSize = Math.max(14, Math.floor(width / 40));
                ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                const textWidth = ctx.measureText(tsStr).width;
                
                // Shadow text for better readability on any background
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillText(tsStr, width - textWidth - 19, height - 19);
                ctx.fillStyle = "white";
                ctx.fillText(tsStr, width - textWidth - 20, height - 20);

                // High Quality encoding (0.85 - 0.9 is sweet spot for HD)
                const base64Str = canvas.toDataURL('image/jpeg', 0.85); 
                
                setCurrentAttachedImages(prev => {
                    if (prev.length >= 10) { // Increase max images if needed
                        Toastify({ text: "Maksimal 10 foto HD", background: "orange" }).showToast();
                        return prev;
                    }
                    return [...prev, base64Str];
                });
                Toastify({ text: "Gambar HD berhasil dimuat!", background: "green" }).showToast();
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        processImageFile(file);
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                processImageFile(file);
                break;
            }
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        processImageFile(file);
    };

    const openModal = (item) => {
        setSelectedId(item.id);
        const records = item.recordIds || [item.id];
        setSelectedRecordIds(records);
        setJenisTemplate('reguler');
        setTemplateText('');

        const status = String(item.status || item.Status || 'belum').toLowerCase();
        if (status === 'belum') {
            setIsViewingResponse(false);
            setResponCustomer('');
            setCurrentAttachedImages([]);
        } else {
            setIsViewingResponse(true);
            setResponCustomer(item.respon || '');
            setCurrentAttachedImages(parseLampiran(item.lampiran));
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const generateTemplate = (waktu) => {
        const selData = data.find(x => x.id === selectedId);
        if (!selData) return;

        const records = data.filter(r => selectedRecordIds.includes(r.id));
        const allDescs = Array.from(new Set(records.map(r => r.deskripsi).filter(Boolean))).join(", ");
        const allDates = Array.from(new Set(records.map(r => r.tanggalDatang).filter(d => d && d !== '-'))).join(", ");

        const tglDatangText = allDates || "(tanggal)";
        let text = "";
        if (jenisTemplate === "reguler") {
            text = `Selamat ${waktu} Bapak/Ibu ${selData.nama},
            
Semoga kabarnya selalu baik. Kami dari bengkel ingin melakukan follow up terkait kendaraan Bapak/Ibu dengan Plat ${selData.plat}.

Berdasarkan catatan kami, kendaraan Bapak/Ibu sebelumnya datang pada ${tglDatangText} dengan keluhan/pekerjaan:
"${allDescs}".

Apakah saat ini keluhan tersebut sudah teratasi dengan baik, atau ada hal lain yang perlu kami bantu kembali?

Apabila Bapak/Ibu memiliki masukan atau saran terkait pelayanan kami, mohon berkenan untuk menyampaikannya agar kami dapat terus meningkatkan kualitas layanan bengkel kami ke depannya.

Terima kasih atas kepercayaannya. Ditunggu konfirmasinya ya Bapak/Ibu.`;
        } else {
            text = `Selamat ${waktu} Bapak/Ibu ${selData.nama},
            
Semoga kabarnya selalu baik. Kami dari bengkel Chery ingin mengucapkan terima kasih atas kunjungan servis Bapak/Ibu pada ${tglDatangText} untuk kendaraan dengan Plat ${selData.plat}.

Sebagai upaya peningkatan layanan, Bapak/Ibu mungkin akan menerima pesan berisi tautan/link survei kepuasan pelanggan (CSI) dari pihak Chery pusat. Kami sangat memohon kesediaan waktu Bapak/Ibu untuk berpartisipasi mengisi survei tersebut.

Jika pelayanan kami telah memenuhi harapan, kami akan sangat berterima kasih apabila Bapak/Ibu berkenan memberikan penilaian maksimal. Namun, apabila masih ada hal yang kurang berkenan atau memiliki saran perbaikan, mohon agar dapat diinformasikan langsung kepada kami terlebih dahulu, agar dapat segera kami berikan solusi terbaik untuk kendaraan Anda.

Terima kasih banyak atas dukungan dan kepercayaannya Bapak/Ibu. Sehat selalu!`;
        }
        setTemplateText(text);
    };

    const sendWhatsApp = (text, phoneTo) => {
        if (!text) { Toastify({ text: "Buat text dulu", background: 'orange' }).showToast(); return; }
        let phone = String(phoneTo || "").replace(/\\D/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
        else if (phone.startsWith('8')) phone = '62' + phone;

        if (phone.length < 9) { Toastify({ text: "Nomor telepon tidak valid", background: 'red' }).showToast(); return; }
        const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    const submitFollowUp = async () => {
        if (!responCustomer.trim()) {
            Toastify({ text: "Isi respon customer", background: 'red' }).showToast();
            return;
        }

        try {
            showLoading("Menyimpan data...");
            const idsToUpdate = selectedRecordIds.length > 0 ? selectedRecordIds : [selectedId];
            const now = new Date();
            const followupDate = formatTanggal(now);

            for (const id of idsToUpdate) {
                const { error } = await db.update('cro', {
                    status: 'Sudah',
                    respon: responCustomer,
                    tanggalFollowUp: followupDate,
                    lampiran: JSON.stringify(currentAttachedImages)
                }, { eq: { id: id } });
                if (error) throw error;
            }

            setCurrentAttachedImages([]);
            closeModal();
            Toastify({ text: "Data berhasil diperbarui ✅", background: "green" }).showToast();
        } catch (error) {
            console.error("Error submit:", error);
            Toastify({ text: "Gagal menyimpan data. Periksa koneksi.", background: "red" }).showToast();
        } finally {
            hideLoading();
        }
    };


    const openFsModal = (id) => {
        setFsSelectedId(id);
        const target = data.find(x => x.id === id);
        if (!target) return;
        setFsTemplateText('');
        setIsFsModalOpen(true);
    };

    const generateFsTemplate = (waktu) => {
        const target = data.find(x => x.id === fsSelectedId);
        if (!target) return;
        const jadwal = calculateNextService(target.tanggalDatang, fsPeriodMonths);
        const tipeBulan = fsPeriodMonths === 12 ? "1 Tahun" : fsPeriodMonths + " Bulan";

        const text = `Selamat ${waktu} Bapak/Ibu ${target.nama},
            
Semoga kabarnya selalu baik. Kami dari bengkel ingin mengingatkan bahwa kendaraan Bapak/Ibu dengan Plat ${target.plat} telah memasuki jadwal Servis Berkala ${tipeBulan}.

Berdasarkan data kami, kunjungan terakhir Bapak/Ibu pada ${target.tanggalDatang}, sehingga estimasi jadwal servis selanjutnya jatuh pada sekitar tanggal ${jadwal}.

Untuk menghindari antrean dan memastikan kendaraan Bapak/Ibu tetap dalam kondisi prima, silakan balas pesan ini untuk melakukan penjadwalan servis (Booking). 

Kami tunggu kedatangannya. Terima kasih atas kepercayaannya!`;

        setFsTemplateText(text);
    };


    const renderReport = () => {
        const rekapBulanan = {};
        const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        data.forEach(item => {
            if (item.status === 'sudah' && item.tanggalFollowUp) {
                const parts = item.tanggalFollowUp.split('-');
                if (parts.length === 3) {
                    const bulanIndex = parseInt(parts[1]) - 1;
                    const tahun = parts[2];
                    const namaBulan = `${bulanIndo[bulanIndex]} ${tahun}`;
                    const sortKey = `${tahun}-${parts[1]}`;
                    if (!rekapBulanan[sortKey]) rekapBulanan[sortKey] = { label: namaBulan, count: 0 };
                    rekapBulanan[sortKey].count += 1;
                }
            }
        });

        const sortedKeys = Object.keys(rekapBulanan).sort().reverse();
        if (sortedKeys.length === 0) {
            return (
                <div className="py-24 text-center text-zinc-400">
                    <p className="text-xl font-medium">Belum ada data follow up yang diselesaikan.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedKeys.map(key => (
                    <div key={key} className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-black transform origin-left transition-transform group-hover:scale-y-150"></div>
                        <h3 className="text-zinc-500 font-bold mb-2 text-sm uppercase tracking-widest">{rekapBulanan[key].label}</h3>
                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-6xl font-black text-zinc-900">{rekapBulanan[key].count}</span>
                            <span className="text-sm text-zinc-500 font-medium">Customer</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const filteredServiceData = useMemo(() => {
        return lwoFollowups
            .filter(item => {
                const state = serviceFollowupMap[item.vin] || { status: 'Belum Follow Up' };
                if (serviceStatusFilter !== 'Semua') {
                    if (state.status !== serviceStatusFilter) return false;
                }
                if (serviceSearchInput) {
                    const q = serviceSearchInput.toLowerCase();
                    return (
                        item.nama.toLowerCase().includes(q) ||
                        item.plat.toLowerCase().includes(q) ||
                        item.vin.toLowerCase().includes(q) ||
                        item.keluhan.toLowerCase().includes(q)
                    );
                }
                return true;
            })
            .sort((a, b) => {
                const diff = parseIndonesianDate(a.wktMasuk) - parseIndonesianDate(b.wktMasuk);
                return serviceSortOrder === 'desc' ? -diff : diff;
            });
    }, [lwoFollowups, serviceFollowupMap, serviceStatusFilter, serviceSearchInput, serviceSortOrder, parseIndonesianDate]);

    const serviceStats = useMemo(() => {
        let belum = 0;
        let sudah = 0;
        lwoFollowups.forEach(item => {
            const state = serviceFollowupMap[item.vin] || { status: 'Belum Follow Up' };
            if (state.status === 'Sudah Follow Up') sudah++;
            else belum++;
        });
        return { total: lwoFollowups.length, belum, sudah };
    }, [lwoFollowups, serviceFollowupMap]);

    const serviceRangeLabel = serviceStartDate && serviceEndDate
        ? `${formatDisplayDate(serviceStartDate)} s/d ${formatDisplayDate(serviceEndDate)}`
        : '';

    return (
        <div className="flex flex-col w-full h-full flex-1 bg-white relative overflow-hidden">
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex flex-col justify-center items-center">
                    <p className="text-white font-medium text-lg">{loadingText}</p>
                </div>
            )}

            {lightboxImage && (
                <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col justify-center items-center p-4" onClick={() => setLightboxImage(null)}>
                    <div className="absolute top-6 right-8 flex gap-4">
                        <a 
                            href={lightboxImage} 
                            download={`Bukti_FollowUp_${Date.now()}.jpg`}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xl"
                        >
                            <Download size={16} /> Download Original
                        </a>
                        <button onClick={() => setLightboxImage(null)} className="p-3 bg-white/10 hover:bg-zinc-700 text-white rounded-xl transition-all">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="w-full h-full flex items-center justify-center overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                         <img 
                            src={lightboxImage} 
                            alt="Full Resolution Proof" 
                            className="max-w-none md:max-w-full cursor-zoom-in rounded-lg shadow-2xl transition-transform hover:scale-105 active:scale-100" 
                            style={{ maxHeight: 'none', display: 'block' }}
                        />
                    </div>
                    
                    <p className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[10px] uppercase font-black tracking-widest bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                        Klik Diluar untuk Menutup • Gunakan scroll untuk melihat detail HD
                    </p>
                </div>
            )}

            {/* Main Content - no internal sidebar */}
            <div className={`min-h-0 flex-1 flex flex-col ${currentTab === 'booking' ? 'p-0' : 'px-4 sm:px-8 pb-4'}`}>
                {currentTab !== 'booking' && (
                    <div className="flex flex-row justify-between items-center mb-6 shrink-0 gap-4 w-full pt-4">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-900 leading-tight">
                            {(currentTab === 'belum' || currentTab === 'sudah') && <>📋 Follow Up Kunjungan Customer {serviceRangeLabel ? `(${serviceRangeLabel})` : '(7 Hari Terakhir)'}</>}
                            {currentTab === 'free_service' && "📅 Pengingat Free Service"}
                            {currentTab === 'laporan' && "📊 Laporan Feedback Bulanan"}
                            {currentTab === 'holidays' && "🔧 Libur Dealer"}
                        </h1>
                    </div>
                )}

                <div className={`flex-1 bg-white overflow-hidden flex flex-col min-h-0 ${currentTab !== 'booking' ? 'border border-zinc-200 shadow-sm rounded-3xl' : ''}`}>
                    {currentTab === 'booking' ? (
                        <CroBookingPanel user={user} setCurrentPage={setCurrentPage} />
                    ) : currentTab === 'holidays' ? (
                        <div className="h-full overflow-hidden">
                            <div className="h-full">
                                <HolidaySettings user={user} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
                            </div>
                        </div>
                    ) : (currentTab === 'belum' || currentTab === 'sudah') ? (
                        <>
                            {/* Summary Metrics at the top */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-zinc-50 border-b border-zinc-200 shrink-0">
                                <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Car size={20} /></div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Kunjungan {serviceRangeLabel}</span>
                                        <span className="text-xl font-black text-zinc-955">{serviceStats.total} Kendaraan</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock size={20} /></div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Belum Follow Up</span>
                                        <span className="text-xl font-black text-zinc-955">{serviceStats.belum} Customer</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle size={20} /></div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sudah Follow Up</span>
                                        <span className="text-xl font-black text-zinc-955">{serviceStats.sudah} Customer</span>
                                    </div>
                                </div>
                            </div>

                            {/* Filter Bar */}
                            <div className="bg-white p-4 border-b border-zinc-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Cari nama, plat nomor, VIN, keluhan..." 
                                            value={serviceSearchInput} 
                                            onChange={e => setServiceSearchInput(e.target.value)} 
                                            className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-xl text-xs focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none" 
                                        />
                                    </div>
                                    <select 
                                        value={serviceStatusFilter} 
                                        onChange={e => setServiceStatusFilter(e.target.value)} 
                                        className="p-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none"
                                    >
                                        <option value="Semua">Semua Status</option>
                                        <option value="Belum Follow Up">�?3 Belum Follow Up</option>
                                        <option value="Sudah Follow Up">�o. Sudah Follow Up</option>
                                    </select>
                                    <select 
                                        value={serviceSortOrder} 
                                        onChange={e => setServiceSortOrder(e.target.value)} 
                                        className="p-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none"
                                        title="Urutkan berdasarkan tanggal masuk"
                                    >
                                        <option value="asc">Urut: Tanggal Terlama</option>
                                        <option value="desc">Urut: Tanggal Terbaru</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} className="text-zinc-400" />
                                        <input
                                            type="date"
                                            value={serviceStartDate}
                                            onChange={e => setServiceStartDate(e.target.value)}
                                            className="border border-zinc-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950"
                                        />
                                    </div>
                                    <span className="text-zinc-400 font-bold text-xs">s/d</span>
                                    <input
                                        type="date"
                                        value={serviceEndDate}
                                        onChange={e => setServiceEndDate(e.target.value)}
                                        className="border border-zinc-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950"
                                    />
                                </div>
                                <button 
                                    onClick={fetchServiceFollowupData}
                                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <RefreshCw size={14} className={lwoLoading ? "animate-spin" : ""} /> Refresh Data
                                </button>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto bg-white">
                                {lwoLoading ? (
                                    <div className="py-20 text-center text-zinc-500 font-medium">
                                        <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
                                        Memuat data kunjungan ({serviceRangeLabel}) dari work order...
                                    </div>
                                ) : filteredServiceData.length === 0 ? (
                                    <div className="py-20 text-center text-zinc-400 font-medium">
                                        Tidak ada data kunjungan customer untuk ditampilkan.
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-650 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4 text-center w-12">No</th>
                                                <th className="py-3 px-4">Nama Customer</th>
                                                <th className="py-3 px-4">Plat & Kendaraan</th>
                                                <th className="py-3 px-4">Tgl Masuk & SA</th>
                                                <th className="py-3 px-4">Keluhan Sebelumnya</th>
                                                <th className="py-3 px-4">Status Follow Up</th>
                                                <th className="py-3 px-4">Kesimpulan / Komentar</th>
                                                <th className="py-3 px-4 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {filteredServiceData.map((item, idx) => {
                                                const state = serviceFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '', bookingDate: '', bookingTime: '' };
                                                const isSudah = state.status === 'Sudah Follow Up';
                                                
                                                return (
                                                    <tr key={item.vin} className="hover:bg-zinc-50 transition-colors">
                                                        <td className="py-4 px-4 text-center font-semibold text-zinc-400">{idx + 1}</td>
                                                        <td className="py-4 px-4">
                                                            <div className="font-bold text-zinc-900">{item.nama}</div>
                                                            <div className="text-[10px] text-zinc-500 font-mono select-all">{item.vin}</div>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <div className="font-black text-zinc-800">{item.plat}</div>
                                                            <div className="text-[10px] text-zinc-500">{item.kendaraan}</div>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <div className="font-medium text-zinc-900">{item.wktMasuk}</div>
                                                            <div className="text-[10px] text-zinc-500">SA: {item.sa}</div>
                                                        </td>
                                                        <td className="py-4 px-4 max-w-xs">
                                                            <p className="text-xs text-zinc-650 line-clamp-2 italic">"{item.keluhan || '-'}"</p>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            {isSudah ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    Sudah Follow Up
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                                                    Belum Follow Up
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 max-w-xs">
                                                            {isSudah ? (
                                                                <div className="space-y-1">
                                                                    <p className="text-xs text-zinc-700 font-medium line-clamp-2">"{state.comment}"</p>
                                                                    {state.bookingDate && (
                                                                        <span className="inline-block text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-150">
                                                                            Booking: {state.bookingDate} @ {state.bookingTime}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-zinc-400 italic">Belum ada respon</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center justify-center">
                                                                <button 
                                                                    onClick={() => handleOpenServiceFollowupModal(item)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                                                >
                                                                    <MessageCircle size={13} />
                                                                    {isSudah ? 'Lihat/Edit' : 'Follow Up'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : currentTab === 'free_service' ? (
                        <>
                            {/* Filter Bar */}
                            <div className="bg-zinc-55 p-4 border-b border-zinc-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-zinc-700">
                                        <input
                                            type="checkbox"
                                            checked={ifsOnlyPriority}
                                            onChange={(e) => setIfsOnlyPriority(e.target.checked)}
                                            className="rounded border-zinc-300 text-black focus:ring-black"
                                        />
                                        Prioritas Harus Datang Bulan Ini
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Kategori:</span>
                                        <select
                                            value={ifsTypeFilter}
                                            onChange={(e) => { setIfsTypeFilter(e.target.value); setIfsMilestoneFilter('Semua'); setIfsActivePage(1); }}
                                            className="p-1 border border-zinc-300 rounded text-xs bg-white font-bold focus:outline-none"
                                        >
                                            <option value="first_service">Free Service Pertama (DO)</option>
                                            <option value="regular_service">Service Berkala</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Filter Timeline:</span>
                                        <select
                                            value={ifsMilestoneFilter}
                                            onChange={(e) => { setIfsMilestoneFilter(e.target.value); setIfsActivePage(1); }}
                                            className="p-1 border border-zinc-300 rounded text-xs bg-white font-bold focus:outline-none"
                                        >
                                            <option value="Semua">Semua Milestone</option>
                                            {ifsTypeFilter === 'first_service' ? (
                                                <>
                                                    <option value="1 Bulan">1 Bulan</option>
                                                    <option value="3 Bulan">3 Bulan</option>
                                                    <option value="6 Bulan">6 Bulan</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="6 Bulan">6 Bulan</option>
                                                    <option value="1 Tahun">1 Tahun</option>
                                                    <option value="2 Tahun">2 Tahun</option>
                                                    <option value="3 Tahun">3 Tahun</option>
                                                    <option value="4 Tahun">4 Tahun</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Terakhir Masuk:</span>
                                        <select
                                            value={ifsLastEntryFilter}
                                            onChange={(e) => { setIfsLastEntryFilter(e.target.value); setIfsActivePage(1); }}
                                            className="p-1 border border-zinc-300 rounded text-xs bg-white font-bold focus:outline-none"
                                        >
                                            <option value="Semua">Semua Tanggal</option>
                                            <option value="1_3_months">1 - 3 Bulan Lalu</option>
                                            <option value="custom">Custom Tanggal</option>
                                        </select>
                                    </div>
                                    {ifsLastEntryFilter === 'custom' && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={ifsLastEntryStart}
                                                onChange={(e) => { setIfsLastEntryStart(e.target.value); setIfsActivePage(1); }}
                                                className="p-1 border border-zinc-300 rounded text-xs bg-white text-zinc-900 font-bold focus:outline-none"
                                            />
                                            <span className="text-zinc-400 text-xs font-bold">-</span>
                                            <input
                                                type="date"
                                                value={ifsLastEntryEnd}
                                                onChange={(e) => { setIfsLastEntryEnd(e.target.value); setIfsActivePage(1); }}
                                                className="p-1 border border-zinc-300 rounded text-xs bg-white text-zinc-900 font-bold focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:flex-initial">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari VIN, Nama, Plat..."
                                            value={ifsSearchInput}
                                            onChange={(e) => { setIfsSearchInput(e.target.value); setIfsActivePage(1); }}
                                            className="pl-9 pr-3 py-2 text-xs border border-zinc-300 rounded-xl bg-white focus:outline-none focus:border-zinc-900 w-full md:w-48 text-zinc-900 font-bold"
                                        />
                                    </div>
                                    <button
                                        onClick={() => fetchIfsReport(true)}
                                        disabled={ifsLoading}
                                        className="p-2 border border-zinc-300 bg-white rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
                                        title="Muat ulang data"
                                    >
                                        <RefreshCw size={14} className={ifsLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Table area */}
                            <div className="flex-1 overflow-auto bg-white">
                                {ifsLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs text-zinc-400 font-bold">Mengolah histori WO & menghitung milestones...</p>
                                    </div>
                                ) : filteredIfsData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-2">
                                        <Search size={32} className="text-zinc-300" />
                                        <p className="text-xs font-bold text-zinc-400">Tidak ada data Free Service untuk filter ini</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse text-xs table-fixed">
                                        <thead className="sticky top-0 bg-zinc-100 shadow-sm z-10 border-b border-zinc-200 text-zinc-650 font-bold uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="py-3 px-3 w-10 text-center">No</th>
                                                <th className="py-3 px-3 w-[20%]">Customer & Unit</th>
                                                <th className="py-3 px-3 w-[26%]">Histori Terakhir (WO & DO)</th>
                                                <th className="py-3 px-3 w-[31%]">{ifsTypeFilter === 'first_service' ? 'Milestones (1m, 3m, 6m)' : 'Milestones (1y, 2y, 3y)'}</th>
                                                <th className="py-3 px-3 w-[10%] text-center">Prioritas & WA</th>
                                                <th className="py-3 px-3 w-[13%] text-center">Status Follow Up</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {paginatedIfsData.map((item, idx) => {
                                                const foState = ifsFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '', bookingDate: '' };
                                                const globalIdx = (ifsActivePage - 1) * ifsRowsPerPage + idx + 1;
                                                const priorityMilestone = ifsTypeFilter === 'first_service' ? item.priorityDO : item.priorityWO;

                                                const isAlreadyServicedThisMonth = (() => {
                                                    if (!item.wktMasuk || item.wktMasuk === '-') return false;
                                                    const lastWoDate = parseIndonesianDate(item.wktMasuk);
                                                    if (!lastWoDate || isNaN(lastWoDate.getTime())) return false;
                                                    const now = new Date();
                                                    return lastWoDate.getMonth() === now.getMonth() && lastWoDate.getFullYear() === now.getFullYear();
                                                })();

                                                const currentStatus = (foState.status === 'Belum Follow Up' && isAlreadyServicedThisMonth) ? 'Sudah Datang' : foState.status;

                                                // Helper to check if a milestone date falls in the current running month/year
                                                const isCurrentMonth = (base, months) => {
                                                    if (!base || base.getTime() === 0) return false;
                                                    const mDate = new Date(base);
                                                    mDate.setMonth(mDate.getMonth() + months);
                                                    const now = new Date();
                                                    return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
                                                };

                                                const is1mCurrent = isCurrentMonth(item.baseDateDO, 1);
                                                const is3mCurrent = isCurrentMonth(item.baseDateDO, 3);
                                                const is6mCurrent = isCurrentMonth(item.baseDateDO, 6);

                                                const is1yCurrent = isCurrentMonth(item.baseDateWO, 12);
                                                const is2yCurrent = isCurrentMonth(item.baseDateWO, 24);
                                                const is3yCurrent = isCurrentMonth(item.baseDateWO, 36);
                                                
                                                return (
                                                    <tr key={item.vin} className={`hover:bg-zinc-50/50 transition-colors align-top ${priorityMilestone ? 'bg-amber-50/20' : ''}`}>
                                                        <td className="py-4 px-3 text-center font-bold text-zinc-400">{globalIdx}</td>
                                                        <td className="py-4 px-3">
                                                            <div className="font-black text-zinc-900 text-sm leading-tight mb-1">{item.nama}</div>
                                                            <div className="text-[11px] font-bold text-zinc-600 mb-0.5">{item.kendaraan} ({item.plat})</div>
                                                            <div className="text-[10px] text-zinc-400 font-mono font-bold tracking-tight">VIN: {item.vin}</div>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <div className="font-black text-zinc-800 text-[11px] mb-1">{item.woNo}</div>
                                                            <div className="text-[10px] font-bold text-zinc-500 mb-0.5">Terakhir Service: {item.wktMasuk}</div>
                                                            <div className="text-[10px] font-bold text-zinc-500 mb-0.5">No DO: <span className="text-zinc-700 font-mono">{item.noDo}</span></div>
                                                            <div className="text-[10px] font-bold text-zinc-500 mb-0.5">Tgl DO: {item.tglDo}</div>
                                                            <div className="text-[10px] font-bold text-emerald-700 mb-1">Expected: {item.expectedService}</div>
                                                            {item.keluhan && (
                                                                <div className="text-[10px] text-zinc-500 italic line-clamp-2" title={item.keluhan}>
                                                                    "{item.keluhan}"
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                {ifsTypeFilter === 'first_service' ? (
                                                                    <>
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '1 Bulan') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is1mCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '1 Bulan' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">1 Bulan</span>
                                                                                {item.milestone1m}
                                                                            </div>
                                                                        )}
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '3 Bulan') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is3mCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '3 Bulan' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">3 Bulan</span>
                                                                                {item.milestone3m}
                                                                            </div>
                                                                        )}
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '6 Bulan') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is6mCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '6 Bulan' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">6 Bulan</span>
                                                                                {item.milestone6m_DO}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '1 Tahun') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is1yCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '1 Tahun' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">1 Tahun</span>
                                                                                {item.milestone1y}
                                                                            </div>
                                                                        )}
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '2 Tahun') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is2yCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '2 Tahun' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">2 Tahun</span>
                                                                                {item.milestone2y}
                                                                            </div>
                                                                        )}
                                                                        {(ifsMilestoneFilter === 'Semua' || ifsMilestoneFilter === '3 Tahun') && (
                                                                            <div className={`p-1.5 rounded-lg border ${
                                                                                is3yCurrent 
                                                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black' 
                                                                                    : priorityMilestone === '3 Tahun' 
                                                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' 
                                                                                        : 'bg-zinc-50 border-zinc-150 text-zinc-600 font-medium'
                                                                            }`}>
                                                                                <span className="block text-[8px] uppercase text-zinc-400 font-bold mb-0.5">3 Tahun</span>
                                                                                {item.milestone3y}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                {priorityMilestone ? (
                                                                    <span className="px-2 py-0.5 bg-red-100 border border-red-200 text-red-750 font-black text-[9px] uppercase tracking-wider rounded-lg">
                                                                        Harus Datang
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-zinc-400 font-medium">-</span>
                                                                )}
                                                                {item.phone ? (
                                                                    <a
                                                                        href={`https://api.whatsapp.com/send?phone=${item.phone.replace(/[^\d]/g, '').replace(/^0/, '62')}&text=${encodeURIComponent(`Halo Bapak/Ibu ${item.nama}, menginfokan jadwal Free Service (IFS) berkala untuk kendaraan Anda dengan Plat ${item.plat}. Silakan hubungi kami untuk menjadwalkan booking.`)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-all duration-150 text-[11px]"
                                                                    >
                                                                        <Phone size={10} /> WA
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-zinc-400 italic text-[10px]">No Telp (-)</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => handleIfsFollowupClick(item)}
                                                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] ${
                                                                        currentStatus === 'Sudah Datang'
                                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200' 
                                                                            : currentStatus === 'Sudah Follow Up'
                                                                                ? 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200' 
                                                                                : 'bg-black text-white hover:bg-zinc-800'
                                                                    }`}
                                                                >
                                                                    {currentStatus}
                                                                </button>
                                                                {foState.comment && (
                                                                    <span className="text-[10px] text-zinc-450 italic max-w-[120px] font-bold truncate block" title={foState.comment}>
                                                                        "{foState.comment}"
                                                                    </span>
                                                                )}
                                                                {foState.bookingDate && (
                                                                    <span className="text-[9px] text-emerald-650 font-black block mt-0.5">
                                                                        Booking: {foState.bookingDate}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            
                            {/* Pagination Controls */}
                            {filteredIfsData.length > 0 && (
                                <div className="bg-zinc-50 p-3 border-t border-zinc-200 shrink-0 flex justify-between items-center text-xs font-medium text-zinc-600">
                                    <div>
                                        <select
                                            value={ifsRowsPerPage}
                                            onChange={e => { setIfsRowsPerPage(Number(e.target.value)); setIfsActivePage(1); }}
                                            className="p-1 border rounded mr-2 bg-white"
                                        >
                                            <option value={20}>20 baris</option>
                                            <option value={40}>40 baris</option>
                                            <option value={100}>100 baris</option>
                                        </select>
                                        Menampilkan {(ifsActivePage - 1) * ifsRowsPerPage + 1} - {Math.min(ifsActivePage * ifsRowsPerPage, filteredIfsData.length)} dari {filteredIfsData.length}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIfsActivePage(p => Math.max(1, p - 1))}
                                            disabled={ifsActivePage === 1}
                                            className="px-3 py-1 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <span className="py-1 px-2 border">{ifsActivePage}</span>
                                        <button
                                            onClick={() => setIfsActivePage(p => p + 1)}
                                            disabled={ifsActivePage >= Math.ceil(filteredIfsData.length / ifsRowsPerPage)}
                                            className="px-3 py-1 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Filter Bar */}
                            <div className="bg-zinc-55 p-4 border-b border-zinc-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 uppercase">Bulan:</span>
                                        <select
                                            value={csiMonth}
                                            onChange={(e) => setCsiMonth(e.target.value)}
                                            className="p-2 text-xs border border-zinc-300 rounded-xl bg-white font-semibold focus:outline-none focus:border-zinc-900"
                                        >
                                            {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, idx) => (
                                                <option key={idx} value={String(idx + 1)}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 uppercase">Cabang:</span>
                                        <select
                                            value={csiDealer}
                                            onChange={(e) => setCsiDealer(e.target.value)}
                                            className="p-2 text-xs border border-zinc-300 rounded-xl bg-white font-semibold focus:outline-none focus:border-zinc-900 max-w-[200px]"
                                        >
                                            {DEALER_OPTIONS.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 uppercase">Tahun:</span>
                                        <select
                                            value={csiYear}
                                            onChange={(e) => setCsiYear(e.target.value)}
                                            className="p-2 text-xs border border-zinc-300 rounded-xl bg-white font-semibold focus:outline-none focus:border-zinc-900"
                                        >
                                            <option value="2026">2026</option>
                                            <option value="2025">2025</option>
                                            <option value="2024">2024</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:flex-initial">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari VIN, Nama..."
                                            value={csiSearchInput}
                                            onChange={(e) => setCsiSearchInput(e.target.value)}
                                            className="pl-9 pr-3 py-2 text-xs border border-zinc-300 rounded-xl bg-white focus:outline-none focus:border-zinc-900 w-full md:w-48 text-zinc-900 font-bold"
                                        />
                                    </div>
                                    <button
                                        onClick={fetchCsiMonthlyReport}
                                        disabled={csiLoading}
                                        className="p-2 border border-zinc-300 bg-white rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
                                        title="Muat ulang data"
                                    >
                                        <RefreshCw size={14} className={csiLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Table area */}
                            <div className="flex-1 overflow-auto bg-white">
                                {csiLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs text-zinc-400 font-bold">Menyelaraskan data Feishu & Work Order...</p>
                                    </div>
                                ) : filteredCsiData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-2">
                                        <Search size={32} className="text-zinc-350" />
                                        <p className="text-xs font-bold text-zinc-400">Tidak ada data review CSI untuk filter ini</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse text-xs table-fixed">
                                        <thead className="sticky top-0 bg-zinc-100 shadow-sm z-10 border-b border-zinc-200 text-zinc-650 font-bold uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="py-3 px-3 w-10 text-center">No</th>
                                                <th className="py-3 px-3 w-[22%]">Customer & Unit</th>
                                                <th className="py-3 px-3 w-[33%]">Work Orders (1-3)</th>
                                                <th className="py-3 px-3 w-[25%]">Feishu CSI Review</th>
                                                <th className="py-3 px-3 w-[8%] text-center">WhatsApp</th>
                                                <th className="py-3 px-3 w-[12%] text-center">Status Follow Up</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {filteredCsiData.map((item, idx) => {
                                                const foState = csiFollowupMap[item.vin] || { status: 'Belum Follow Up', comment: '' };
                                                const isFollowedUp = foState.status === 'Sudah Follow Up';
                                                
                                                return (
                                                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors align-top">
                                                        <td className="py-4 px-3 text-center font-bold text-zinc-450">{idx + 1}</td>
                                                        <td className="py-4 px-3">
                                                            <div className="font-black text-zinc-900 text-sm leading-tight mb-1">{item.nama}</div>
                                                            {item.wos?.[0]?.nama_kendaraan && (
                                                                <div className="text-[11px] font-bold text-zinc-600 mb-0.5">{item.wos[0].nama_kendaraan}</div>
                                                            )}
                                                            <div className="text-[10px] text-zinc-400 font-mono font-bold tracking-tight">VIN: {item.vin}</div>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            {item.wos && item.wos.length > 0 ? (
                                                                <div className="space-y-3">
                                                                    {item.wos.map((w, wIdx) => (
                                                                        <div key={wIdx} className="bg-zinc-50 p-2 rounded-xl border border-zinc-150 relative">
                                                                            <div className="flex justify-between items-center mb-1">
                                                                                <span className="font-black text-zinc-800 text-[11px]">{w.no_wo || w['No. WO'] || w.no_wo_dms}</span>
                                                                                <span className="text-[9px] text-zinc-500 font-bold bg-white px-2 py-0.5 rounded-full border border-zinc-200">
                                                                                    {w.waktu_masuk || w['Wkt.Masuk']}
                                                                                </span>
                                                                            </div>
                                                                            <div 
                                                                                className="text-[11px] text-zinc-650 italic leading-snug line-clamp-2" 
                                                                                title={w.keluhan || w.perintah || '-'}
                                                                            >
                                                                                <strong className="not-italic text-zinc-500 font-bold">Keluhan:</strong> {w.keluhan || w.perintah || '-'}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-400 italic text-[11px]">Tidak ada data work order</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <div className="flex gap-2 mb-2">
                                                                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-[11px] text-emerald-800">
                                                                    Overall: {item.overallScore}/10
                                                                </span>
                                                                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-zinc-100 border border-zinc-250 rounded-lg font-black text-[11px] text-zinc-700">
                                                                    Rec: {item.recommendScore}/10
                                                                </span>
                                                            </div>
                                                            {item.commentQ7 && (
                                                                <div className="mb-1.5" title={item.commentQ7}>
                                                                    <span className="block text-[9px] uppercase font-black text-zinc-400 tracking-wider">Q7 Ragu Rekomendasi</span>
                                                                    <p className="text-[11px] text-zinc-700 font-medium italic line-clamp-2">"{item.commentQ7}"</p>
                                                                </div>
                                                            )}
                                                            {item.commentQ8 && (
                                                                <div title={item.commentQ8}>
                                                                    <span className="block text-[9px] uppercase font-black text-zinc-400 tracking-wider">Q8 Komentar Akhir</span>
                                                                    <p className="text-[11px] text-zinc-600 font-medium italic line-clamp-2">"{item.commentQ8}"</p>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            {item.phone ? (
                                                                <a
                                                                    href={`https://api.whatsapp.com/send?phone=${item.phone.replace(/[^\d]/g, '').replace(/^0/, '62')}&text=${encodeURIComponent(CSI_WA_TEMPLATE)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all duration-150"
                                                                >
                                                                    <Phone size={12} /> WA
                                                                </a>
                                                            ) : (
                                                                <span className="text-zinc-450 italic text-[11px] font-bold">No Telp (-)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleCsiFollowupClick(item)}
                                                                    className={`px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] ${
                                                                        isFollowedUp 
                                                                            ? 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200' 
                                                                            : 'bg-black text-white hover:bg-zinc-800'
                                                                    }`}
                                                                >
                                                                    {isFollowedUp ? 'Sudah Follow Up' : 'Belum Follow Up'}
                                                                </button>
                                                                {isFollowedUp && foState.comment && (
                                                                    <span className="text-[10px] text-zinc-450 italic max-w-[120px] font-bold truncate block" title={foState.comment}>
                                                                        "{foState.comment}"
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Modal Reguler */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                        <div className="flex justify-between items-center p-5 border-b border-zinc-200 bg-zinc-50 shrink-0">
                            <h2 className="text-xl font-bold text-zinc-900">Detail Kendaraan & Form Follow Up</h2>
                            <button onClick={closeModal} className="text-zinc-400 hover:text-black p-1"><X /></button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col lg:flex-row gap-6 sm:gap-8">
                            {/* Kiri */}
                            <div className="w-full lg:flex-1 space-y-4">
                                <h3 className="font-black text-zinc-700 border-b border-zinc-200 pb-2 text-sm uppercase tracking-wider">Info Servis</h3>
                                {(() => {
                                    const d = data.find(x => x.id === selectedId);
                                    if (!d) return null;
                                    const records = data.filter(r => selectedRecordIds.includes(r.id));
                                    return (
                                        <div className="space-y-6 text-sm">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div><span className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Nama Customer</span><span className="font-bold text-base sm:text-lg text-zinc-900">{d.nama}</span></div>
                                                <div><span className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Telepon</span><span className="font-bold text-base sm:text-lg text-zinc-900">{d.telepon}</span></div>
                                                <div><span className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">No. Plat Mobil</span><span className="font-bold text-base sm:text-lg text-zinc-900">{d.plat}</span></div>
                                                <div><span className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Tipe Mobil</span><span className="font-bold text-base sm:text-lg text-zinc-900">{d.tipeMobil}</span></div>
                                                <div className="sm:col-span-2"><span className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">No. Rangka / VIN</span><span className="font-mono text-sm sm:text-base text-zinc-700 bg-zinc-50 px-2 py-1 rounded inline-block">{d.vin}</span></div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] uppercase font-black text-zinc-400 border-b border-zinc-100 pb-1">Riwayat Kedatangan (Grup VIN)</h4>
                                                <div className="space-y-3">
                                                    {records.map((r, idx) => (
                                                        <div key={r.id} className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 bg-zinc-100 px-3 py-1 rounded-bl-xl text-[10px] font-bold text-zinc-500">#{idx + 1}</div>
                                                            <div className="flex gap-4 mb-3">
                                                                <div>
                                                                    <span className="block text-[9px] uppercase font-bold text-zinc-400">Tgl Masuk</span>
                                                                    <span className="font-bold text-zinc-700">{r.tanggalDatang}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[9px] uppercase font-bold text-zinc-400">SA</span>
                                                                    <span className="font-bold text-zinc-700">{r.serviceAdvisor}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[9px] uppercase font-bold text-zinc-400">Kilometer</span>
                                                                    <span className="font-bold text-zinc-700">{r.kilometer !== '-' ? r.kilometer + ' KM' : '-'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="mb-3">
                                                                <span className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">Keluhan / Pekerjaan</span>
                                                                <div className="text-zinc-900 bg-zinc-50/50 p-2 rounded-lg border border-zinc-100 whitespace-pre-line leading-relaxed italic">
                                                                    {r.deskripsi}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-zinc-50">
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-1">Part Lama</span>
                                                                    <div className="text-[10px] text-zinc-600 whitespace-pre-line leading-tight">{r.partLama || '-'}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-1">Part Baru</span>
                                                                    <div className="text-[10px] text-zinc-600 whitespace-pre-line leading-tight">{r.partBaru || '-'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                            {/* Kanan */}
                            <div className="w-full lg:flex-[1.2] flex flex-col">
                                {!isViewingResponse ? (
                                    <>
                                        <h3 className="font-bold text-zinc-700 border-b border-zinc-200 pb-2 mb-4">Aksi WhatsApp</h3>
                                        <select value={jenisTemplate} onChange={e => { setJenisTemplate(e.target.value); setTemplateText(''); }} className="w-full p-2 border border-zinc-300 rounded-lg text-sm mb-4 bg-zinc-50">
                                            <option value="reguler">Follow Up Service Reguler</option>
                                            <option value="csi">Permohonan Survei CSI</option>
                                        </select>
                                        <div className="flex gap-2 mb-4">
                                            {['Pagi', 'Siang', 'Sore/Malam'].map(t => (
                                                <button key={t} onClick={() => generateTemplate(t)} className="flex-1 py-1.5 border border-zinc-300 rounded text-xs hover:bg-zinc-900 hover:text-white transition-colors">{t}</button>
                                            ))}
                                        </div>
                                        <textarea rows={5} value={templateText} onChange={e => setTemplateText(e.target.value)} placeholder="Template terisi otomatis..." className="w-full text-sm p-3 border border-zinc-300 rounded-lg mb-2 focus:outline-none focus:border-zinc-500" />
                                        <button onClick={() => sendWhatsApp(templateText, data.find(x => x.id === selectedId)?.telepon)} className="bg-black text-white w-max px-4 py-2 rounded-lg text-xs font-bold font-medium mb-6 hover:bg-zinc-800 transition-colors duration-150">Buka Chat WA</button>

                                        <h3 className="font-bold text-zinc-700 border-b border-zinc-200 pb-2 mb-4">Catatan Respon</h3>
                                        <textarea
                                            rows={3}
                                            value={responCustomer}
                                            onChange={e => setResponCustomer(e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder="Ketik respon (Bisa paste gambar di sini)..."
                                            className="w-full text-sm p-3 border border-zinc-300 rounded-lg mb-4 focus:outline-none focus:border-zinc-500"
                                        />

                                        <div className="mb-6">
                                            <input type="file" accept="image/*" multiple className="hidden" ref={fileAttachmentRef} onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                files.forEach(f => processImageFile(f));
                                            }} />
                                            <div
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    const files = Array.from(e.dataTransfer.files);
                                                    files.forEach(f => processImageFile(f));
                                                }}
                                                className={`relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[100px]
                                                    ${isDragging ? 'border-zinc-900 bg-zinc-50 scale-[1.02]' : 'border-zinc-200 hover:border-zinc-400'}
                                                    ${currentAttachedImages.length > 0 ? 'bg-zinc-50/50' : 'bg-white'}`}
                                                onClick={() => fileAttachmentRef.current.click()}
                                            >
                                                {currentAttachedImages.length > 0 ? (
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full">
                                                        {currentAttachedImages.map((img, idx) => (
                                                            <div key={idx} className="relative group aspect-square">
                                                                <img src={img} className="w-full h-full object-cover rounded-lg shadow-sm border border-white" alt={`attachment-${idx}`} />
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setCurrentAttachedImages(prev => prev.filter((_, i) => i !== idx)); }}
                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <div className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-400 hover:border-zinc-400 transition-all">
                                                            <ImageIcon size={20} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                            <ImageIcon size={20} />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-bold text-zinc-700">Klik, Drag, atau Paste Banyak Gambar</p>
                                                            <p className="text-[9px] text-zinc-400 mt-0.5">Maks 10MB per file (Format: JPG, PNG)</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={submitFollowUp} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors duration-150">Simpan & Selesai</button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-4">
                                            <h3 className="font-bold text-zinc-700">Hasil Respon</h3>
                                            <button
                                                onClick={() => setIsViewingResponse(false)}
                                                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                            >
                                                <Upload size={14} /> Edit Respon / Re-upload Gambar
                                            </button>
                                        </div>
                                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 mb-6 group relative">
                                            <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Catatan Respon:</p>
                                            <p className="text-sm text-zinc-800 whitespace-pre-line italic">"{responCustomer || '-'}"</p>
                                        </div>

                                        {currentAttachedImages.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-zinc-700 mb-3 flex items-center gap-2">
                                                    <ImageIcon size={14} /> Lampiran Gambar ({currentAttachedImages.length}):
                                                </p>
                                                {!isImagesEnabled ? (
                                                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center gap-3">
                                                        <AlertTriangle size={18} className="text-orange-500" strokeWidth={3} />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-black text-orange-800 uppercase tracking-tight">Gamabar Sedang Dinonaktifkan</p>
                                                            <p className="text-[10px] text-orange-700">Aktifkan "Load Images" di Owner Panel untuk dapat melihat atau mengunduh lampiran.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-3">
                                                        {currentAttachedImages.map((img, idx) => (
                                                            <div key={idx} className="relative group w-32 h-32">
                                                                <img
                                                                    src={img}
                                                                    className="w-full h-full object-cover rounded-xl cursor-pointer shadow-md border-2 border-white ring-1 ring-zinc-200 transition-transform hover:scale-[1.05]"
                                                                    onClick={() => setLightboxImage(img)}
                                                                    alt={`Lampiran-${idx}`}
                                                                />
                                                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                                                    <Search className="text-white" size={20} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal FS */}
            {isFsModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Pengingat Berkala</h2>
                            <button onClick={() => setIsFsModalOpen(false)}><X className="text-zinc-400" /></button>
                        </div>
                        <div className="bg-zinc-50 text-black p-4 rounded-xl text-sm mb-4 border border-zinc-200">
                            Kirim pengingat untuk <strong>{data.find(x => x.id === fsSelectedId)?.nama}</strong> berserta plat <strong>{data.find(x => x.id === fsSelectedId)?.plat}</strong>
                        </div>
                        <div className="flex gap-2 mb-4">
                            {['Pagi', 'Siang', 'Sore/Malam'].map(t => (
                                <button key={t} onClick={() => generateFsTemplate(t)} className="flex-1 py-1.5 border border-black rounded text-xs hover:bg-black hover:text-white transition-colors duration-150">{t}</button>
                            ))}
                        </div>
                        <textarea rows={6} value={fsTemplateText} onChange={e => setFsTemplateText(e.target.value)} className="w-full text-sm p-3 border border-zinc-300 rounded-lg mb-4 focus:outline-none" />
                        <button onClick={() => sendWhatsApp(fsTemplateText, data.find(x => x.id === fsSelectedId)?.telepon)} className="bg-black text-white w-full py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-zinc-800 transition-colors duration-150">
                            <Send size={16} /> Buka WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* Modal CSI Follow Up Comment */}
            {isCsiModalOpen && csiModalItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-150">
                            <h2 className="text-lg font-black text-zinc-900">Umpan Balik / Komentar Customer</h2>
                            <button onClick={() => setIsCsiModalOpen(false)} className="text-zinc-400 hover:text-zinc-900"><X /></button>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl text-xs space-y-2 mb-4 border border-zinc-250 text-zinc-700 leading-relaxed">
                            <div><strong className="text-zinc-900">Nama Customer:</strong> {csiModalItem.nama}</div>
                            <div><strong className="text-zinc-900">VIN:</strong> {csiModalItem.vin}</div>
                            <div><strong className="text-zinc-900">Nomor WO:</strong> {csiModalItem.woNo}</div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Komentar / Masukan dari Customer <span className="text-red-500">*</span></label>
                            <textarea
                                rows={4}
                                value={csiCommentInput}
                                onChange={e => setCsiCommentInput(e.target.value)}
                                placeholder="Masukkan komentar atau umpan balik customer di sini..."
                                className="w-full text-sm p-3 border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900 font-medium"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsCsiModalOpen(false)} className="flex-1 py-2.5 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-650 hover:bg-zinc-50 transition-colors">Batal</button>
                            <button onClick={handleSaveCsiFollowup} className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors">Simpan & Selesaikan</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal IFS Free Service Follow Up */}
            {isIfsModalOpen && ifsModalItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-150">
                            <h2 className="text-lg font-black text-zinc-900">Follow Up Free Service (IFS)</h2>
                            <button onClick={() => setIsIfsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900"><X /></button>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl text-xs space-y-2 mb-4 border border-zinc-250 text-zinc-700 leading-relaxed">
                            <div><strong className="text-zinc-900">Nama Customer:</strong> {ifsModalItem.nama}</div>
                            <div><strong className="text-zinc-900">VIN:</strong> {ifsModalItem.vin}</div>
                            <div><strong className="text-zinc-900">Terakhir Servis:</strong> {ifsModalItem.wktMasuk} ({ifsModalItem.woNo})</div>
                            <div><strong className="text-zinc-900">No DO:</strong> {ifsModalItem.noDo}</div>
                            <div><strong className="text-zinc-900">Tgl DO:</strong> {ifsModalItem.tglDo} · <strong className="text-zinc-900">Expected:</strong> {ifsModalItem.expectedService}</div>
                        </div>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Status Follow Up</label>
                                <select
                                    value={ifsStatusInput}
                                    onChange={e => setIfsStatusInput(e.target.value)}
                                    className="w-full text-sm p-3 border border-zinc-300 rounded-xl bg-white font-medium focus:outline-none"
                                >
                                    <option value="Belum Follow Up">Belum Follow Up</option>
                                    <option value="Sudah Follow Up">Sudah Follow Up</option>
                                    <option value="Unreachable">Unreachable (Tidak Bisa Dihubungi)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Jadwal Booking (Jika Ada)</label>
                                    <input
                                        type="date"
                                        value={ifsBookingDateInput}
                                        onChange={e => setIfsBookingDateInput(e.target.value)}
                                        className="w-full text-sm p-3 border border-zinc-300 rounded-xl bg-white font-medium focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Jam Booking</label>
                                    <select
                                        value={ifsBookingTimeInput}
                                        onChange={e => setIfsBookingTimeInput(e.target.value)}
                                        className="w-full text-sm p-3 border border-zinc-300 rounded-xl bg-white font-medium focus:outline-none"
                                    >
                                        {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Komentar / Masukan Customer <span className="text-zinc-400">(Wajib jika Sudah Follow Up)</span></label>
                                <textarea
                                    rows={3}
                                    value={ifsCommentInput}
                                    onChange={e => setIfsCommentInput(e.target.value)}
                                    placeholder="Masukkan umpan balik customer di sini..."
                                    className="w-full text-sm p-3 border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900 font-medium"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsIfsModalOpen(false)} className="flex-1 py-2.5 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-650 hover:bg-zinc-50 transition-colors">Batal</button>
                            <button onClick={handleSaveIfsFollowup} className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors">Simpan & Selesaikan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Service Follow Up (Redesigned Unified) */}
            {isServiceModalOpen && selectedLwoItem && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col p-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-150">
                            <h2 className="text-lg font-black text-zinc-900">Follow Up Kunjungan Customer</h2>
                            <button onClick={() => setIsServiceModalOpen(false)} className="text-zinc-400 hover:text-zinc-900"><X /></button>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-xl text-xs space-y-2 mb-4 border border-zinc-250 text-zinc-700 leading-relaxed">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <div><strong className="text-zinc-900">Nama Customer:</strong> {selectedLwoItem.nama}</div>
                                <div><strong className="text-zinc-900">No. Polisi / Plat:</strong> {selectedLwoItem.plat}</div>
                                <div><strong className="text-zinc-900">VIN / No. Rangka:</strong> {selectedLwoItem.vin}</div>
                                <div><strong className="text-zinc-900">Tipe Mobil:</strong> {selectedLwoItem.kendaraan}</div>
                                <div><strong className="text-zinc-900">Terakhir Servis:</strong> {selectedLwoItem.wktMasuk}</div>
                                <div><strong className="text-zinc-900">Service Advisor:</strong> {selectedLwoItem.sa}</div>
                                <div><strong className="text-zinc-900">No. WO:</strong> {selectedLwoItem.woNo}</div>
                                <div><strong className="text-zinc-900">No. Telepon:</strong> {selectedLwoItem.phone || '-'}</div>
                            </div>
                            <div className="border-t border-zinc-200 pt-2 mt-2">
                                <strong className="text-zinc-900 block mb-1">Keluhan / Perintah Kerja Sebelumnya:</strong>
                                <p className="italic text-zinc-650 bg-white p-2 rounded border border-zinc-200 font-medium">{selectedLwoItem.keluhan}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">WhatsApp Template Preview</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const hour = new Date().getHours();
                                            const waktu = hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
                                            const text = `Selamat ${waktu} Bapak/Ibu ${selectedLwoItem.nama},

Terima kasih atas kunjungannya ke bengkel kami untuk merawat kendaraan kesayangan Bapak/Ibu.
Saya ingin memastikan kembali, apakah seluruh pengerjaan mobil kemarin sudah sesuai harapan atau masih ada kendala/keluhan yang dirasakan? Kepuasan dan kenyamanan Bapak/Ibu adalah prioritas utama saya.

Bpk/Ibu ${selectedLwoItem.nama}, secara pribadi saya ingin memohon bantuan kecil yang sangat berarti untuk saya. Dalam waktu dekat, akan ada pesan survey kepuasan pelanggan (CSI) yang masuk ke HP Bapak/Ibu.
Jujur, hasil penilaian tersebut menjadi tolok ukur utama performa kerja saya. Saya sangat berharap Bapak/Ibu berkenan meluangkan waktu 1 menit untuk mengisi survey dan memberikan nilai tertinggi (Sangat Puas / Angka 10).

Bantuan dan nilai sempurna dari Bapak/Ibu adalah hadiah luar biasa bagi pengerjaan dan dedikasi saya selama ini. Jika ada kekurangan dari saya, mohon dimaafkan ya, Pak/Bu.

Terima kasih banyak atas kebaikan hati Bpk/Ibu ${selectedLwoItem.nama}. Semoga sukses dan sehat selalu! 🙏 😊`;
                                            sendWhatsApp(text, selectedLwoItem.phone);
                                        }}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <MessageCircle size={16} /> Hubungi & Kirim WhatsApp CSI
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Status Follow Up</label>
                                <select
                                    value={serviceStatusInput}
                                    onChange={e => setServiceStatusInput(e.target.value)}
                                    className="w-full text-sm p-3 border border-zinc-300 rounded-xl bg-white font-medium focus:outline-none"
                                >
                                    <option value="Belum Follow Up">⏳ Belum Follow Up</option>
                                    <option value="Sudah Follow Up">✅ Sudah Follow Up</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Komentar / Masukan Customer <span className="text-zinc-400">(Wajib jika Sudah Follow Up)</span></label>
                                <textarea
                                    rows={3}
                                    value={serviceCommentInput}
                                    onChange={e => setServiceCommentInput(e.target.value)}
                                    placeholder="Masukkan tanggapan atau masukan dari customer..."
                                    className="w-full text-sm p-3 border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900 font-medium"
                                />
                            </div>

                            <div className="border-t border-zinc-200 pt-3">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-zinc-700 select-none mb-3">
                                    <input 
                                        type="checkbox" 
                                        checked={isBookingChecked} 
                                        onChange={e => setIsBookingChecked(e.target.checked)} 
                                        className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-950" 
                                    />
                                    <span>Jadwalkan Service Ulang (Booking Langsung)</span>
                                </label>

                                {isBookingChecked && (
                                    <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200 animate-in">
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Tanggal Booking</label>
                                            <input 
                                                type="date" 
                                                value={serviceBookingDateInput} 
                                                onChange={e => setServiceBookingDateInput(e.target.value)} 
                                                className="w-full text-xs p-2 border border-zinc-300 rounded focus:outline-none bg-white font-medium" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Jam Booking</label>
                                            <select 
                                                value={serviceBookingTimeInput} 
                                                onChange={e => setServiceBookingTimeInput(e.target.value)} 
                                                className="w-full text-xs p-2 border border-zinc-300 rounded focus:outline-none bg-white font-medium"
                                            >
                                                {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsServiceModalOpen(false)} className="flex-1 py-2.5 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-650 hover:bg-zinc-50 transition-colors">Batal</button>
                            <button onClick={handleSaveServiceFollowup} className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors">Simpan & Selesaikan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

