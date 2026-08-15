import {
  LayoutDashboard,
  Calendar,
  Monitor,
  Tag,
  FileText,
  Package,
  BarChart,
  Wrench,
  User,
  DollarSign,
  Layers,
  Database,
  History,
  Settings,
  Users,
  Plus,
  Search,
  TrendingUp,
  Clock,
  ShieldCheck,
  Volume2,
  Trash2,
  Car,
  BarChart2,
  BarChart3,
  MessageCircle,
  Home,
  RefreshCw,
  Receipt,
} from 'lucide-react';

/**
 * Role-based navigation configuration.
 * Each role maps to sub-pages shown in the sidebar.
 */
export const NAV_CONFIG = {
  admin: [
    { id: 'admin-dashboard', icon: LayoutDashboard, label: 'Operations', page: 'admin', ariaLabel: 'Admin Operations' },
    { id: 'admin-booking', icon: Calendar, label: 'Daftar Booking', page: 'admin-booking', ariaLabel: 'Daftar Booking' },
    { id: 'admin-wo', icon: ShieldCheck, label: 'Work Order', page: 'admin-wo', ariaLabel: 'Work Order' },
    { id: 'admin-dms-order', icon: FileText, label: 'DMS Order', page: 'sparepart-dms-order', ariaLabel: 'DMS Order' },
    { id: 'admin-jasa-pengerjaan', icon: Wrench, label: 'Jasa Pengerjaan', page: 'manager-jasa-pengerjaan', ariaLabel: 'Jasa Pengerjaan Mobil' },
    { id: 'admin-estimasi', icon: Receipt, label: 'Estimasi', page: 'admin-estimasi', ariaLabel: 'Estimasi Sparepart' },
    { id: 'sa-booking', icon: Calendar, label: 'SA Booking', page: 'sa-booking', ariaLabel: 'SA Booking' },
    { id: 'admin-bulletin', icon: FileText, label: 'Bulletin', page: 'admin-bulletin', ariaLabel: 'Bulletin' },
  ],
  cro: [
    { id: 'cro-belum', icon: Clock, label: 'Follow Up Service', page: 'cro', ariaLabel: 'Follow Up Service' },
    { id: 'cro-freeservice', icon: Calendar, label: 'Free Service', page: 'cro-freeservice', ariaLabel: 'Free Service' },
    { id: 'cro-laporan', icon: BarChart, label: 'Laporan Bulanan', page: 'cro-laporan', ariaLabel: 'Laporan Bulanan' },
    { id: 'cro-holidays', icon: Settings, label: 'Libur Dealer', page: 'cro-holidays', ariaLabel: 'Libur Dealer' },
    { id: 'sa-booking', icon: Calendar, label: 'SA Booking', page: 'sa-booking', ariaLabel: 'SA Booking' },
    { id: 'booking-settings', icon: Settings, label: 'Booking Settings', page: 'booking-settings', ariaLabel: 'Booking Settings' },
  ],
  manager: [
    { id: 'manager-performance', icon: LayoutDashboard, label: 'Dashboard Utama', page: 'manager', ariaLabel: 'Dashboard Utama' },
    { id: 'manager-laporan-invoice', icon: FileText, label: 'Laporan Invoice', page: 'manager-laporan-invoice', ariaLabel: 'Laporan Invoice' },
    { id: 'manager-laporan-wo', icon: FileText, label: 'Laporan Work Order', page: 'manager-laporan-wo', ariaLabel: 'Laporan Work Order' },
    { id: 'manager-keuntungan-sparepart', icon: DollarSign, label: 'Keuntungan Sparepart', page: 'manager-keuntungan-sparepart', ariaLabel: 'Keuntungan Sparepart' },
    { id: 'manager-jasa-pengerjaan', icon: Wrench, label: 'Jasa Pengerjaan', page: 'manager-jasa-pengerjaan', ariaLabel: 'Jasa Pengerjaan Mobil' },
    { id: 'manager-keuntungan-staff', icon: TrendingUp, label: 'Kinerja Staff', page: 'manager-keuntungan-staff', ariaLabel: 'Kinerja Staff' },
    { id: 'manager-staff', icon: Users, label: 'Manajemen Staff', page: 'manager-staff', ariaLabel: 'Manajemen Staff' },
    { id: 'cro-csi', icon: BarChart3, label: 'CSI Result', page: 'cro-csi', ariaLabel: 'CSI Result' },
    { id: 'cro-customers', icon: Users, label: 'CSI Customer Review', page: 'cro-customers', ariaLabel: 'CSI Customer Review' },
    { id: 'cro-csi-followup', icon: MessageCircle, label: 'CSI Followup', page: 'cro-csi-followup', ariaLabel: 'CSI Followup' },
  ],
  cro: [
    { id: 'cro-belum', icon: Clock, label: 'Follow Up Service', page: 'cro', ariaLabel: 'Follow Up Service' },
    { id: 'cro-freeservice', icon: Calendar, label: 'Free Service', page: 'cro-freeservice', ariaLabel: 'Free Service' },
    { id: 'cro-laporan', icon: BarChart, label: 'Laporan Bulanan', page: 'cro-laporan', ariaLabel: 'Laporan Bulanan' },
    { id: 'cro-booking', icon: Calendar, label: 'Booking Management', page: 'cro-booking', ariaLabel: 'Booking Management' },
    { id: 'cro-holidays', icon: Settings, label: 'Libur Dealer', page: 'cro-holidays', ariaLabel: 'Libur Dealer' },
    { id: 'cro-csi', icon: BarChart3, label: 'CSI Result', page: 'cro-csi', ariaLabel: 'CSI Result' },
    { id: 'cro-customers', icon: Users, label: 'CSI Customer Review', page: 'cro-customers', ariaLabel: 'CSI Customer Review' },
    { id: 'cro-csi-followup', icon: MessageCircle, label: 'CSI Followup', page: 'cro-csi-followup', ariaLabel: 'CSI Followup' },
  ],
  sparepart: [
    { id: 'sparepart-dms-order', icon: FileText, label: 'DMS Order', page: 'sparepart-dms-order', ariaLabel: 'DMS Order' },
    { id: 'sparepart-dms', icon: Search, label: 'DMS Search', page: 'sparepart-dms', ariaLabel: 'DMS Search' },
    { id: 'sparepart-epc', icon: Car, label: 'E-Katalog EPCM', page: 'sparepart-epc', ariaLabel: 'E-Katalog EPCM' },
    { id: 'sparepart-cost', icon: DollarSign, label: 'Sparepart Cost', page: 'sparepart-cost', ariaLabel: 'Sparepart Cost' },
    { id: 'sparepart-profit', icon: Layers, label: 'Predictor', page: 'sparepart-profit', ariaLabel: 'Stock Predictor' },
    { id: 'sparepart-stock-comparison', icon: RefreshCw, label: 'Stock Comparison', page: 'stock-comparison', ariaLabel: 'Stock Comparison' },
  ],
  owner: [
    { id: 'owner-laporan-wo', icon: FileText, label: 'Laporan Work Order', page: 'owner-laporan-wo', ariaLabel: 'Laporan Work Order' },
    { id: 'owner-dms', icon: Search, label: 'DMS Search', page: 'owner-dms', ariaLabel: 'DMS Search' },
    { id: 'owner-epc', icon: Car, label: 'E-Katalog EPCM', page: 'owner-epc', ariaLabel: 'E-Katalog EPCM' },
    { id: 'owner-sparepart-cost', icon: DollarSign, label: 'Sparepart Cost', page: 'owner-sparepart-cost', ariaLabel: 'Sparepart Cost' },
    { id: 'owner-warranty', icon: ShieldCheck, label: 'Warranty Search', page: 'owner-warranty', ariaLabel: 'Warranty Search' },
    { id: 'owner-users', icon: Users, label: 'Manajemen User', page: 'owner-users', ariaLabel: 'Manajemen User' },
    { id: 'owner-sound', icon: Settings, label: 'Settings', page: 'owner-sound', ariaLabel: 'Settings' },
    { id: 'owner-deleted', icon: Trash2, label: 'Riwayat Hapus Booking', page: 'owner-deleted', ariaLabel: 'Riwayat Hapus Booking' },
    { id: 'owner-bulletin', icon: FileText, label: 'Bulletin', page: 'owner-bulletin', ariaLabel: 'Bulletin' },
  ],
  mekanik: [
    { id: 'mechanic', icon: Wrench, label: 'Workshop', page: 'mechanic', ariaLabel: 'Mechanic Panel' },
    { id: 'mechanic-bulletin', icon: FileText, label: 'Bulletin', page: 'mechanic-bulletin', ariaLabel: 'Bulletin' },
    { id: 'mechanic-epc', icon: Car, label: 'E-Katalog EPCM', page: 'mechanic-epc', ariaLabel: 'E-Katalog EPCM' },
  ],
  customer: [
    { id: 'customer-home', icon: Home, label: 'Dashboard', page: 'customer', ariaLabel: 'Dashboard Saya' },
  ],
  display: [],
  foreman: [
    { id: 'foreman-monitor', icon: Wrench, label: 'Foreman', page: 'foreman', ariaLabel: 'Foreman Panel' },
  ],
  warranty: [
    { id: 'warranty-dashboard', icon: BarChart2,   label: 'Dashboard',        page: 'warranty',                  ariaLabel: 'Warranty Dashboard' },
    { id: 'warranty-wo',        icon: ShieldCheck, label: 'Work Order',       page: 'warranty-wo',               ariaLabel: 'Warranty Work Order' },
    { id: 'warranty-search',    icon: Search,      label: 'Search',           page: 'warranty-search',           ariaLabel: 'Warranty Search' },
    { id: 'warranty-free-maint',icon: Wrench,      label: 'Free Maintenance', page: 'warranty-free-maintenance', ariaLabel: 'Free Maintenance' },
    { id: 'warranty-proforma',  icon: FileText,    label: 'Proforma Invoice', page: 'warranty-proforma',         ariaLabel: 'Warranty Proforma Invoice' },
    { id: 'warranty-epc',       icon: Car,         label: 'E-Katalog EPCM',   page: 'warranty-epc',              ariaLabel: 'E-Katalog EPCM' },
  ],
  sales: [
    { id: 'sales-booking', icon: Calendar, label: 'Booking', page: 'sales-booking', ariaLabel: 'Sales Booking' },
  ],
  spv: [
    { id: 'spv-booking', icon: Calendar, label: 'Booking', page: 'spv-booking', ariaLabel: 'SPV Booking' },
  ],
};

/**
 * Default landing page for each role.
 */
export const DEFAULT_PAGES = {
  admin: 'admin',
  manager: 'manager',
  cro: 'cro',
  sparepart: 'sparepart-dms-order',
  owner: 'owner-dms',
  mekanik: 'mechanic',
  customer: 'customer',
  display: 'display',
  foreman: 'foreman',
  warranty: 'warranty',
  sales: 'sales-booking',
  spv: 'spv-booking',
};

/**
 * Returns the navigation items array for a given role.
 * @param {string} role
 */
export function getNavItems(role) {
  return NAV_CONFIG[role] || [];
}

/**
 * Returns the default page string for a given role.
 * @param {string} role
 */
export function getDefaultPage(role) {
  return DEFAULT_PAGES[role] || '';
}
