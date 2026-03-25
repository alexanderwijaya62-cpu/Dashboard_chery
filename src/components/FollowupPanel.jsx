import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, CheckCircle, Calendar, LineChart, Upload, Download, Search, X, ChevronRight, ChevronLeft, Image as ImageIcon, Send, Menu, Filter, MoreVertical } from 'lucide-react';
import Toastify from 'toastify-js';
import * as XLSX from 'xlsx';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwf0QGS_vN7QKVX8b5R-VIQuGRRhKRnLoMGDIu-h-TJJkXfQFdsfmYA9nyDYJRgdfMvBQ/exec";

export default function FollowupPanel({ user, handleLogout, isNavbarVisible }) {
    const [currentTab, setCurrentTab] = useState('belum');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [cloudStatus, setCloudStatus] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({ nama: '', tanggal: '', plat: '', tipe: '', keluhan: '', vin: '', respon: '' });
    const [fsFilters, setFsFilters] = useState({ nama: '', plat: '', tipe: '' });
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

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
    const [currentAttachedImage, setCurrentAttachedImage] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isViewingResponse, setIsViewingResponse] = useState(false); // New state to track view mode
    const [lightboxImage, setLightboxImage] = useState(null);

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
        if (!GOOGLE_SCRIPT_URL) return;

        try {
            if (!isBackground) showLoading("Mengambil data dari Google Sheets...");
            const response = await fetch(GOOGLE_SCRIPT_URL);
            const responseData = await response.json();

            if (responseData && Array.isArray(responseData)) {
                setData(responseData);
                saveToLocal(responseData);
                setCloudStatus(true);
            } else {
                console.error("Data bukan array:", responseData);
                if (!isBackground) Toastify({ text: "Gagal memproses data dari Server", background: "orange" }).showToast();
            }
        } catch (error) {
            console.error("Gagal Google Sheets:", error);
            if (!isBackground) Toastify({ text: "Koneksi ke Server Terputus", background: "red" }).showToast();
        } finally {
            if (!isBackground) hideLoading();
        }
    }, [GOOGLE_SCRIPT_URL]);

    const syncToGoogleSheets = async (latestData) => {
        if (!GOOGLE_SCRIPT_URL) return;
        try {
            showLoading("Menyimpan ke Google Sheets...");
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'sync', data: latestData })
            });
        } catch (error) {
            alert("Gagal menyimpan ke Google Sheets! Periksa internet Anda.");
        } finally {
            hideLoading();
        }
    };

    useEffect(() => {
        fetchFromGoogleSheets();
    }, [fetchFromGoogleSheets]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Gunakan state terbaru via refs atau closure
            // Dalam hal ini, isModalOpen dkk adalah dependencies, jadi interval akan di-reset saat mereka berubah
            if (document.visibilityState === 'visible' && !isModalOpen && !isFsModalOpen && !isLoading) {
                fetchFromGoogleSheets(true);
            }
        }, 15000); // Poll setiap 15 detik

        return () => clearInterval(interval);
        // eslint-disable-next-line
    }, [isModalOpen, isFsModalOpen, isLoading, fetchFromGoogleSheets]);

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

        return { isDue: false, overdue: false, priority: 99, text: "Aman", color: "text-blue-700" };
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
        let cPage = currentPage;
        if (cPage > totalPages) cPage = totalPages;
        const start = (cPage - 1) * rowsPerPage;
        return groupedFilteredData.slice(start, start + rowsPerPage);
    }, [groupedFilteredData, currentPage, rowsPerPage]);

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
        setCurrentPage(1);
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
                const arr = new Uint8Array(event.target.result);
                const workbook = XLSX.read(arr, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                let addedCount = 0;
                let updatedCount = 0;
                let newData = [...data];

                jsonData.forEach(row => {
                    let vinStr = String(row["VIN"] || "-").trim();
                    let namaStr = String(row["customer's name"] || "-").trim();
                    let woNo = row["Work Order No."] || row["work order no."] || row["Work Order No"];

                    if (woNo || vinStr !== "-" || namaStr !== "-") {
                        let deliveryTimeValue = row["Delivery time"] || row["delivery time"] || row["Delivery Time"] || row["Tanggal Masuk"] || "-";
                        let formattedTanggal = formatTanggal(deliveryTimeValue);
                        let saleDateValue = row["sale date"] || "-";

                        let existsIndex = newData.findIndex(x =>
                            x.tanggalDatang === formattedTanggal &&
                            ((vinStr !== "-" && x.vin === vinStr) || (namaStr !== "-" && x.nama === namaStr))
                        );

                        let currentPartLama = (row["old part number"] ? row["old part number"] + " - " : "") + (row["old part name"] || "");
                        let currentPartBaru = (row["new part number"] ? row["new part number"] + " - " : "") + (row["new item name"] || "");
                        let currentKeluhan = row["Client Description"] || "-";

                        currentPartLama = currentPartLama.trim() === "-" || currentPartLama.trim() === "" ? "" : currentPartLama.trim();
                        currentPartBaru = currentPartBaru.trim() === "-" || currentPartBaru.trim() === "" ? "" : currentPartBaru.trim();

                        if (existsIndex === -1) {
                            const newId = newData.length > 0 ? Math.max(...newData.map(m => m.id)) + 1 : 1;
                            newData.push({
                                id: newId,
                                workOrderNo: woNo ? String(woNo).trim() : "-",
                                nama: namaStr,
                                telepon: row["mobile phone"] || "-",
                                vin: vinStr,
                                plat: row["number plate"] || "-",
                                serviceAdvisor: row["Service Advisor"] || "-",
                                kilometer: row["driven distance"] || "-",
                                tipeMobil: row["car series"] || "-",
                                deskripsi: currentKeluhan !== "-" ? `• ${currentKeluhan}` : "-",
                                tanggalDatang: formattedTanggal,
                                tahunBeli: formatTanggal(saleDateValue),
                                partLama: currentPartLama ? `• ${currentPartLama}` : "-",
                                partBaru: currentPartBaru ? `• ${currentPartBaru}` : "-",
                                status: "belum",
                                respon: "",
                                tanggalFollowUp: null,
                                lampiran: ""
                            });
                            addedCount++;
                        } else {
                            let exists = newData[existsIndex];
                            if (woNo && !exists.workOrderNo.includes(String(woNo).trim())) exists.workOrderNo += `, ${String(woNo).trim()}`;
                            if (currentKeluhan !== "-" && !exists.deskripsi.includes(currentKeluhan)) {
                                if (exists.deskripsi === "-") exists.deskripsi = `• ${currentKeluhan}`;
                                else exists.deskripsi += `\n• ${currentKeluhan}`;
                            }
                            if (currentPartLama) {
                                if (exists.partLama === "-") exists.partLama = `• ${currentPartLama}`;
                                else if (!exists.partLama.includes(currentPartLama)) exists.partLama += `\n• ${currentPartLama}`;
                            }
                            if (currentPartBaru) {
                                if (exists.partBaru === "-") exists.partBaru = `• ${currentPartBaru}`;
                                else if (!exists.partBaru.includes(currentPartBaru)) exists.partBaru += `\n• ${currentPartBaru}`;
                            }
                            newData[existsIndex] = exists;
                            updatedCount++;
                        }
                    }
                });

                if (fileInputRef.current) fileInputRef.current.value = "";

                if (addedCount > 0 || updatedCount > 0) {
                    setData(newData);
                    saveToLocal(newData);
                    setCurrentTab('belum');
                    await syncToGoogleSheets(newData);
                }

                Toastify({ text: `Upload Berhasil! ${addedCount} baru, ${updatedCount} diupdate`, background: 'green' }).showToast();

            } catch (error) {
                console.error("Gagal memproses file Excel", error);
                Toastify({ text: "Terjadi kesalahan saat membaca file Excel.", background: 'red' }).showToast();
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
        if (file.size > 10 * 1024 * 1024) {
            Toastify({ text: 'Ukuran file maks 10MB', background: 'red' }).showToast();
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

                const MAX_DIMENSION = 1000;
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
                const base64Str = canvas.toDataURL('image/jpeg', 0.8);
                setCurrentAttachedImage(base64Str);
                Toastify({ text: "Gambar berhasil dimuat!", background: "green" }).showToast();
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
            setCurrentAttachedImage(null);
        } else {
            setIsViewingResponse(true);
            setResponCustomer(item.respon || '');
            setCurrentAttachedImage(item.lampiran || null);
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
            const newData = [...data];
            const idsToUpdate = selectedRecordIds.length > 0 ? selectedRecordIds : [selectedId];
            const now = new Date();
            const followupDate = formatTanggal(now);

            idsToUpdate.forEach(id => {
                const idx = newData.findIndex(x => x.id === id);
                if (idx > -1) {
                    newData[idx].status = 'sudah';
                    newData[idx].respon = responCustomer;
                    newData[idx].tanggalFollowUp = followupDate;
                    newData[idx].lampiran = currentAttachedImage || "";
                }
            });

            setData(newData);
            saveToLocal(newData);
            setCurrentAttachedImage(null);
            closeModal();

            await syncToGoogleSheets(newData);
            Toastify({ text: "Data berhasil diperbarui", background: "green" }).showToast();
        } catch (error) {
            console.error("Error submit:", error);
            Toastify({ text: "Gagal menyimpan data", background: "red" }).showToast();
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

    return (
        <div className="flex h-screen bg-[#F2F2F7] relative">
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex flex-col justify-center items-center">
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                    <p className="text-white font-medium text-lg">{loadingText}</p>
                </div>
            )}

            {lightboxImage && (
                <div className="fixed inset-0 bg-black/90 z-[9999] flex justify-center items-center" onClick={() => setLightboxImage(null)}>
                    <img src={lightboxImage} alt="Preview" className="max-w-[90%] max-h-[90%] object-contain" />
                </div>
            )}

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && window.innerWidth <= 1024 && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed left-0 top-0 h-full bg-white border-r border-zinc-200 shadow-2xl transition-all duration-300 z-[60] flex flex-col ${isNavbarVisible ? 'pt-[4.5rem]' : 'pt-4'} 
                ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-4 lg:translate-x-0 lg:hover:w-64'}`}
                onMouseEnter={() => {
                    if (window.innerWidth > 1024) setIsSidebarOpen(true);
                }}
                onMouseLeave={() => {
                    if (window.innerWidth > 1024) setIsSidebarOpen(false);
                }}
            >
                <div className={`flex flex-col h-full ${!isSidebarOpen && 'opacity-0 overflow-hidden'}`}>
                    <div className="px-6 py-4 flex flex-col border-b border-zinc-100">
                        <h2 className="font-black text-zinc-900 uppercase tracking-widest text-sm mb-1">CRO Follow Up</h2>
                        {cloudStatus && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded w-max border border-green-200">☁️ Cloud Tersambung</span>}
                    </div>
                    <div className="flex-1 py-4 flex flex-col gap-2 px-4 overflow-y-auto">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 px-2">Menu Utama</p>
                        <button
                            onClick={() => setCurrentTab('belum')}
                            className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all ${currentTab === 'belum' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}
                        >
                            <span>⏳ Belum Follow Up</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${currentTab === 'belum' ? 'bg-white/20' : 'bg-zinc-100 text-zinc-400'}`}>
                                {data.filter(x => {
                                    const s = (x.status || x.Status || '').toLowerCase();
                                    return s === '' || s === 'belum';
                                }).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('sudah')}
                            className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all ${currentTab === 'sudah' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}
                        >
                            <span>✅ Sudah Follow Up</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${currentTab === 'sudah' ? 'bg-white/20' : 'bg-zinc-100 text-zinc-400'}`}>
                                {data.filter(x => (x.status || x.Status || '').toLowerCase() === 'sudah').length}
                            </span>
                        </button>

                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 mt-4 border-t border-zinc-100 pt-4 px-2">Laporan</p>
                        <button
                            onClick={() => setCurrentTab('free_service')}
                            className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all ${currentTab === 'free_service' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}
                        >
                            📅 Free Service
                            {fsBadgeCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{fsBadgeCount}</span>}
                        </button>
                        <button
                            onClick={() => setCurrentTab('laporan')}
                            className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${currentTab === 'laporan' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100'}`}
                        >
                            📊 Laporan Bulanan
                        </button>
                    </div>
                    <div className="p-4 mt-auto border-t border-zinc-100">
                        <button onClick={handleLogout} className="w-full text-center px-4 py-3 rounded-xl font-bold text-[13px] text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all">
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 h-screen flex flex-col transition-all duration-300 ${isNavbarVisible ? 'pt-20' : 'pt-8'} px-4 sm:px-8 pb-12 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0 lg:ml-4'}`}>
                <div className="flex flex-row justify-between items-center mb-6 shrink-0 gap-4 w-full">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-900 leading-tight">
                        {currentTab === 'belum' && "⏳ Belum Follow Up"}
                        {currentTab === 'sudah' && "✅ Sudah Follow Up"}
                        {currentTab === 'free_service' && "📅 Pengingat Free Service"}
                        {currentTab === 'laporan' && "📊 Laporan Feedback Bulanan"}
                    </h1>

                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:hidden p-2.5 bg-zinc-900 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <div className="flex-1 bg-white border border-zinc-200 shadow-sm rounded-3xl overflow-hidden flex flex-col min-h-0">
                    {(currentTab === 'belum' || currentTab === 'sudah') && (
                        <>
                            <div className="bg-zinc-50 p-4 border-b border-zinc-200 shrink-0 flex flex-col md:flex-row md:items-center gap-4">
                                <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 flex-1">
                                    <input type="text" placeholder="Nama..." value={filters.nama} onChange={e => updateFilter('nama', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    <input type="text" placeholder="DD-MM-YYYY" value={filters.tanggal} onChange={e => updateFilter('tanggal', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    <input type="text" placeholder="Plat..." value={filters.plat} onChange={e => updateFilter('plat', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    <input type="text" placeholder="VIN..." value={filters.vin} onChange={e => updateFilter('vin', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    <input type="text" placeholder="Tipe..." value={filters.tipe} onChange={e => updateFilter('tipe', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    <input type="text" placeholder="Keluhan..." value={filters.keluhan} onChange={e => updateFilter('keluhan', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none" />
                                    {currentTab === 'sudah' && (
                                        <input type="text" placeholder="Cari Respon..." value={filters.respon} onChange={e => updateFilter('respon', e.target.value)} className="p-2 text-xs border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 outline-none ring-1 ring-blue-100" />
                                    )}
                                </div>

                                <div className="flex gap-2 shrink-0 self-end md:self-auto">
                                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" className="hidden" onChange={handleUploadExcel} />
                                    <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-zinc-300 text-zinc-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-100 transition-all flex-1 md:flex-none justify-center">
                                        <Upload size={14} /> <span className="hidden sm:inline">Import</span>
                                    </button>
                                    <button onClick={handleExportExcel} className="bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-black shadow-sm transition-all flex-1 md:flex-none justify-center">
                                        <Download size={14} /> <span className="hidden sm:inline">Export</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-white">
                                <div className="block md:hidden">
                                    <div className="divide-y divide-zinc-100">
                                        {paginatedMainData.length > 0 ? (
                                            paginatedMainData.map(item => (
                                                <div key={item.id} className="p-4 bg-white space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-black text-zinc-900">{item.nama}</h4>
                                                            <p className="text-[10px] text-zinc-500">{item.kilometer === '-' ? '-' : item.kilometer + ' KM'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-zinc-900 text-xs">{item.plat}</div>
                                                            <div className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded ml-auto w-max mt-0.5">{item.tipeMobil}</div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="bg-zinc-50 p-2 rounded-lg">
                                                            <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-0.5">Tgl Masuk</span>
                                                            <div className="flex flex-col">
                                                                {item.dates.map((d, i) => <span key={i} className="font-medium">{d}</span>)}
                                                            </div>
                                                        </div>
                                                        <div className="bg-zinc-50 p-2 rounded-lg">
                                                            <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-0.5">No. Rangka / VIN</span>
                                                            <span className="font-mono">{item.vin}</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-zinc-50 p-2 rounded-lg">
                                                        <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-1">Daftar Keluhan</span>
                                                        <div className="space-y-1.5">
                                                            {item.descriptions.map((desc, i) => (
                                                                <div key={i} className="text-[11px] leading-relaxed italic text-zinc-600 border-l-2 border-zinc-200 pl-2">
                                                                    {desc}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {currentTab === 'sudah' && (
                                                        <div className="space-y-2 pt-2 border-t border-zinc-50">
                                                            {item.lampiran && (
                                                                <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-inner border border-zinc-100" onClick={() => setLightboxImage(item.lampiran)}>
                                                                    <img src={item.lampiran} className="w-full h-full object-cover" alt="attachment" />
                                                                    <div className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white">
                                                                        <Search size={14} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                                                                <span className="block text-[8px] uppercase font-bold text-zinc-400 mb-1">Hasil Respon</span>
                                                                <p className="text-xs text-zinc-700 italic">"{item.respon || "-"}"</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => openModal(item)}
                                                        className={`w-full py-3 text-xs font-black rounded-xl shadow-sm transition-all active:scale-[0.98] ${currentTab === 'belum' ? 'bg-zinc-900 text-white active:bg-black' : 'bg-zinc-200 text-zinc-800'}`}
                                                    >
                                                        {currentTab === 'belum' ? 'MULAI FOLLOW UP' : 'LIHAT RESPONT'}
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center text-zinc-400">Data Tidak Ditemukan</div>
                                        )}
                                    </div>
                                </div>

                                <table className="hidden md:table w-full text-left border-collapse text-sm">
                                    <thead className="sticky top-0 bg-zinc-100 shadow-sm z-10 border-b border-zinc-200 text-zinc-600">
                                        <tr>
                                            <th className="py-3 px-4 font-bold">Nama Customer</th>
                                            <th className="py-3 px-4 font-bold">Tgl Masuk</th>
                                            <th className="py-3 px-4 font-bold">Plat & Tipe</th>
                                            <th className="py-3 px-4 font-bold">No. Rangka / VIN</th>
                                            <th className="py-3 px-4 font-bold">Keluhan</th>
                                            {currentTab === 'sudah' && (
                                                <>
                                                    <th className="py-3 px-4 font-bold">Hasil Respon</th>
                                                    <th className="py-3 px-4 font-bold">Lampiran</th>
                                                </>
                                            )}
                                            <th className="py-3 px-4 font-bold text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {paginatedMainData.length > 0 ? (
                                            paginatedMainData.map(item => (
                                                <tr key={item.id} className="hover:bg-blue-50">
                                                    <td className="py-3 px-4 align-top">
                                                        <div className="font-bold text-zinc-900">{item.nama}</div>
                                                        <div className="text-xs text-zinc-500">{item.kilometer === '-' ? '-' : item.kilometer + ' KM'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 align-top font-medium text-zinc-600">
                                                        <div className="flex flex-col gap-1">
                                                            {item.dates.map((d, i) => (
                                                                <span key={i} className="whitespace-nowrap">{d}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 align-top">
                                                        <div className="font-bold text-zinc-900">{item.plat}</div>
                                                        <div className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded w-max mt-1">{item.tipeMobil}</div>
                                                    </td>
                                                    <td className="py-3 px-4 align-top text-zinc-500 font-mono text-xs">{item.vin}</td>
                                                    <td className="py-3 px-4 align-top text-zinc-600 max-w-xs">
                                                        <div className="flex flex-col gap-2">
                                                            {item.descriptions.map((desc, i) => (
                                                                <div key={i} className="bg-zinc-50 p-2 rounded border border-zinc-100 whitespace-pre-line text-xs italic">
                                                                    • {desc}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    {currentTab === 'sudah' && (
                                                        <>
                                                            <td className="py-3 px-4 align-top text-zinc-700">
                                                                <div className="text-xs bg-zinc-50 p-2 rounded border border-zinc-100 min-w-[150px] max-h-24 overflow-y-auto">
                                                                    {item.respon || "-"}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4 align-top">
                                                                {item.lampiran ? (
                                                                    <div className="relative group w-16 h-16 cursor-pointer" onClick={() => setLightboxImage(item.lampiran)}>
                                                                        <img src={item.lampiran} className="w-full h-full object-cover rounded-lg border shadow-sm transition-transform group-hover:scale-105" alt="thumb" />
                                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                                            <Search size={14} className="text-white" />
                                                                        </div>
                                                                    </div>
                                                                ) : "-"}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="py-3 px-4 align-top text-center">
                                                        <button onClick={() => openModal(item)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${currentTab === 'belum' ? 'bg-zinc-900 text-white hover:bg-black' : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'}`}>
                                                            {currentTab === 'belum' ? 'Follow Up' : 'Lihat Respon'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={currentTab === 'sudah' ? 8 : 6} className="py-20 text-center text-zinc-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Search size={40} className="text-zinc-200" />
                                                        <p className="font-bold text-sm">Data Tidak Ditemukan</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-zinc-50 p-3 border-t border-zinc-200 shrink-0 flex justify-between items-center text-xs font-medium text-zinc-600">
                                <div>
                                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="p-1 border rounded mr-2 bg-white">
                                        <option value={20}>20 baris</option>
                                        <option value={40}>40 baris</option>
                                    </select>
                                    Menampilkan {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, groupedFilteredData.length)} dari {groupedFilteredData.length}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50">Prev</button>
                                    <span className="py-1 px-2 border">{currentPage}</span>
                                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(groupedFilteredData.length / rowsPerPage)} className="px-3 py-1 bg-white border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50">Next</button>
                                </div>
                            </div>
                        </>
                    )}

                    {currentTab === 'free_service' && (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="p-4 border-b border-zinc-200 bg-zinc-50 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <h3 className="font-bold text-zinc-900">Pengingat Berkala</h3>
                                <div className="bg-zinc-200 p-1 rounded-lg flex gap-1 w-full sm:w-auto">
                                    {[3, 6, 12].map(m => (
                                        <button key={m} onClick={() => setFsPeriodMonths(m)} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded ${fsPeriodMonths === m ? 'bg-white text-zinc-900 shadow' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            {m === 12 ? '1 Thn' : `${m} Bln`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-zinc-50 p-4 border-b border-zinc-200 shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-4 overflow-x-auto">
                                <input type="text" placeholder="Nama..." value={fsFilters.nama} onChange={e => updateFsFilter('nama', e.target.value)} className="w-full sm:min-w-[150px] p-2 text-xs border border-zinc-300 rounded" />
                                <input type="text" placeholder="Plat..." value={fsFilters.plat} onChange={e => updateFsFilter('plat', e.target.value)} className="w-full sm:min-w-[120px] p-2 text-xs border border-zinc-300 rounded" />
                                <input type="text" placeholder="Tipe..." value={fsFilters.tipe} onChange={e => updateFsFilter('tipe', e.target.value)} className="w-full sm:min-w-[120px] p-2 text-xs border border-zinc-300 rounded" />
                            </div>
                            <div className="flex-1 overflow-auto bg-white">
                                {/* Mobile view FS */}
                                <div className="md:hidden divide-y divide-zinc-100">
                                    {fsDataList.map(item => (
                                        <div key={item.id} className={`p-4 ${item.statusJadwal.isDue ? 'bg-red-50' : 'bg-white'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-zinc-900">{item.nama}</h4>
                                                    <p className="text-[10px] text-zinc-500">{item.plat} • {item.tipeMobil}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black text-blue-700">{item.jadwalServis}</div>
                                                    {item.statusJadwal.isDue && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block mt-1 ${item.statusJadwal.color}`}>{item.statusJadwal.text}</span>}
                                                </div>
                                            </div>
                                            <button onClick={() => openFsModal(item.id)} className="w-full mt-2 py-2.5 bg-green-500 text-white text-[11px] font-bold rounded-xl shadow-sm">
                                                REMINDER WA
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <table className="hidden md:table w-full text-left border-collapse text-sm">
                                    <thead className="sticky top-0 bg-zinc-100 shadow-sm z-10 border-b border-zinc-200 text-zinc-600">
                                        <tr>
                                            <th className="py-3 px-4 font-bold">Nama Customer</th>
                                            <th className="py-3 px-4 font-bold">Tgl Masuk (Ref)</th>
                                            <th className="py-3 px-4 font-bold text-blue-700">Jadwal Servis</th>
                                            <th className="py-3 px-4 font-bold">Plat</th>
                                            <th className="py-3 px-4 font-bold">Tipe Mobil</th>
                                            <th className="py-3 px-4 font-bold text-center">Pengingat WA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {fsDataList.map(item => (
                                            <tr key={item.id} className={`${item.statusJadwal.isDue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50'}`}>
                                                <td className="py-3 px-4 align-top font-bold text-zinc-900">{item.nama}</td>
                                                <td className="py-3 px-4 align-top text-zinc-600">{item.tanggalDatang}</td>
                                                <td className="py-3 px-4 align-top">
                                                    <div className="font-bold">{item.jadwalServis}</div>
                                                    {item.statusJadwal.isDue && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.statusJadwal.color}`}>{item.statusJadwal.text}</span>}
                                                </td>
                                                <td className="py-3 px-4 align-top font-bold text-zinc-800">{item.plat}</td>
                                                <td className="py-3 px-4 align-top text-zinc-600">{item.tipeMobil}</td>
                                                <td className="py-3 px-4 align-top text-center">
                                                    <button onClick={() => openFsModal(item.id)} className="border border-green-500 text-green-600 bg-white px-3 py-1 text-xs font-bold rounded-lg hover:bg-green-500 hover:text-white transition-colors">
                                                        Reminder WA
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {currentTab === 'laporan' && (
                        <div className="p-8 h-full overflow-y-auto">
                            {renderReport()}
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
                            <button onClick={closeModal} className="text-zinc-400 hover:text-red-500 p-1"><X /></button>
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
                                        <button onClick={() => sendWhatsApp(templateText, data.find(x => x.id === selectedId)?.telepon)} className="bg-green-500 text-white w-max px-4 py-2 rounded-lg text-xs font-bold font-medium mb-6 hover:bg-green-600 transition-colors">Buka Chat WA</button>

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
                                            <input type="file" accept="image/*" className="hidden" ref={fileAttachmentRef} onChange={handleImageUpload} />
                                            <div
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={handleDrop}
                                                className={`relative border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer
                                                    ${isDragging ? 'border-zinc-900 bg-zinc-50 scale-[1.02]' : 'border-zinc-200 hover:border-zinc-400'}
                                                    ${currentAttachedImage ? 'bg-zinc-50/50' : 'bg-white'}`}
                                                onClick={() => fileAttachmentRef.current.click()}
                                            >
                                                {currentAttachedImage ? (
                                                    <div className="relative group">
                                                        <img src={currentAttachedImage} className="h-32 rounded-lg shadow-md border border-white" alt="attachment" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                            <p className="text-white text-[10px] font-bold">Ganti Gambar</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setCurrentAttachedImage(null); }}
                                                            className="absolute -top-3 -right-3 bg-red-500 text-white w-6 h-6 rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                            <ImageIcon size={24} />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm font-bold text-zinc-700">Klik, Drag, atau Paste Gambar</p>
                                                            <p className="text-[10px] text-zinc-400 mt-1">Maksimal 10MB (Format: JPG, PNG)</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={submitFollowUp} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors">Simpan & Selesai</button>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="font-bold text-zinc-700 border-b border-zinc-200 pb-2 mb-4">Hasil Respon</h3>
                                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 mb-6">
                                            <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Catatan Respon:</p>
                                            <p className="text-sm text-zinc-800 whitespace-pre-line italic">"{responCustomer || '-'}"</p>
                                        </div>

                                        {currentAttachedImage && (
                                            <div>
                                                <p className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                                                    <ImageIcon size={16} /> Lampiran Gambar:
                                                </p>
                                                <div className="relative group w-max">
                                                    <img
                                                        src={currentAttachedImage}
                                                        className="h-48 rounded-xl object-contain cursor-pointer shadow-lg border-2 border-white ring-1 ring-zinc-200 transition-transform hover:scale-[1.02]"
                                                        onClick={() => setLightboxImage(currentAttachedImage)}
                                                        alt="Lampiran"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                                        <Search className="text-white" size={24} />
                                                    </div>
                                                </div>
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
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
                            Kirim pengingat untuk <strong>{data.find(x => x.id === fsSelectedId)?.nama}</strong> berserta plat <strong>{data.find(x => x.id === fsSelectedId)?.plat}</strong>
                        </div>
                        <div className="flex gap-2 mb-4">
                            {['Pagi', 'Siang', 'Sore/Malam'].map(t => (
                                <button key={t} onClick={() => generateFsTemplate(t)} className="flex-1 py-1.5 border border-zinc-300 rounded text-xs hover:bg-zinc-900 hover:text-white transition-colors">{t}</button>
                            ))}
                        </div>
                        <textarea rows={6} value={fsTemplateText} onChange={e => setFsTemplateText(e.target.value)} className="w-full text-sm p-3 border border-zinc-300 rounded-lg mb-4 focus:outline-none" />
                        <button onClick={() => sendWhatsApp(fsTemplateText, data.find(x => x.id === fsSelectedId)?.telepon)} className="bg-green-500 text-white w-full py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-green-600 transition-colors">
                            <Send size={16} /> Buka WhatsApp
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

