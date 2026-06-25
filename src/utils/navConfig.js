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
  Truck,
  DollarSign,
  Activity,
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
} from 'lucide-react';

/**
 * Role-based navigation configuration.
 * Each role maps to sub-pages shown in the sidebar.
 */
export const NAV_CONFIG = {
  admin: [
    { id: 'admin-dashboard', icon: LayoutDashboard, label: 'Operations', page: 'admin', ariaLabel: 'Admin Operations' },
    { id: 'admin-wo', icon: ShieldCheck, label: 'Work Order', page: 'admin-wo', ariaLabel: 'Work Order' },
    { id: 'sa-booking', icon: Calendar, label: 'SA Booking', page: 'sa-booking', ariaLabel: 'SA Booking' },
  ],
  cro: [
    { id: 'cro-belum', icon: Clock, label: 'Belum Follow Up', page: 'cro', ariaLabel: 'Belum Follow Up' },
    { id: 'cro-sudah', icon: FileText, label: 'Sudah Follow Up', page: 'cro-sudah', ariaLabel: 'Sudah Follow Up' },
    { id: 'cro-freeservice', icon: Calendar, label: 'Free Service', page: 'cro-freeservice', ariaLabel: 'Free Service' },
    { id: 'cro-laporan', icon: BarChart, label: 'Laporan Bulanan', page: 'cro-laporan', ariaLabel: 'Laporan Bulanan' },
    { id: 'cro-holidays', icon: Settings, label: 'Libur Dealer', page: 'cro-holidays', ariaLabel: 'Libur Dealer' },
    { id: 'sa-booking', icon: Calendar, label: 'SA Booking', page: 'sa-booking', ariaLabel: 'SA Booking' },
    { id: 'booking-settings', icon: Settings, label: 'Booking Settings', page: 'booking-settings', ariaLabel: 'Booking Settings' },
  ],
  manager: [
    { id: 'manager-performance', icon: LayoutDashboard, label: 'Dashboard Utama', page: 'manager', ariaLabel: 'Dashboard Utama' },
    { id: 'manager-financial', icon: DollarSign, label: 'Laporan Revenue', page: 'manager-financial', ariaLabel: 'Laporan Revenue' },
    { id: 'manager-wo', icon: Activity, label: 'Tracking Pengerjaan', page: 'manager-wo', ariaLabel: 'Tracking Pengerjaan' },
    { id: 'manager-vehicles', icon: Database, label: 'Database Mobil', page: 'manager-vehicles', ariaLabel: 'Database Mobil' },
    { id: 'manager-cro', icon: History, label: 'Riwayat CRO', page: 'manager-cro', ariaLabel: 'Riwayat CRO' },
    { id: 'manager-holidays', icon: Settings, label: 'Libur Dealer', page: 'manager-holidays', ariaLabel: 'Libur Dealer' },
    { id: 'manager-staff', icon: Users, label: 'Manajemen Staff', page: 'manager-staff', ariaLabel: 'Manajemen Staff' },
  ],
  cro: [
    { id: 'cro-belum', icon: Clock, label: 'Belum Follow Up', page: 'cro', ariaLabel: 'Belum Follow Up' },
    { id: 'cro-sudah', icon: FileText, label: 'Sudah Follow Up', page: 'cro-sudah', ariaLabel: 'Sudah Follow Up' },
    { id: 'cro-freeservice', icon: Calendar, label: 'Free Service', page: 'cro-freeservice', ariaLabel: 'Free Service' },
    { id: 'cro-laporan', icon: BarChart, label: 'Laporan Bulanan', page: 'cro-laporan', ariaLabel: 'Laporan Bulanan' },
    { id: 'cro-booking', icon: Calendar, label: 'Booking Management', page: 'cro-booking', ariaLabel: 'Booking Management' },
    { id: 'cro-booking-approval', icon: ShieldCheck, label: 'Konfirmasi Booking', page: 'cro-booking-approval', ariaLabel: 'Konfirmasi Booking' },
    { id: 'cro-holidays', icon: Settings, label: 'Libur Dealer', page: 'cro-holidays', ariaLabel: 'Libur Dealer' },
    { id: 'cro-csi', icon: BarChart3, label: 'CSI Result', page: 'cro-csi', ariaLabel: 'CSI Result' },
    { id: 'cro-customers', icon: Users, label: 'CSI Customer Review', page: 'cro-customers', ariaLabel: 'CSI Customer Review' },
  ],
  sparepart: [
    { id: 'sparepart-input', icon: Plus, label: 'Input Order', page: 'sparepart', ariaLabel: 'Input Order' },
    { id: 'sparepart-view', icon: Search, label: 'Order List', page: 'sparepart-view', ariaLabel: 'Order List' },
    { id: 'sparepart-quotation', icon: FileText, label: 'Quotations', page: 'sparepart-quotation', ariaLabel: 'Quotations' },
    { id: 'sparepart-profit', icon: TrendingUp, label: 'Analysis', page: 'sparepart-profit', ariaLabel: 'Analysis' },
    // { id: 'sparepart-predict', icon: Layers, label: 'Stock Predictor', page: 'sparepart-predict', ariaLabel: 'Stock Predictor' },
  ],
  owner: [
    { id: 'owner-monitoring', icon: Activity, label: 'Live Monitoring', page: 'owner', ariaLabel: 'Live Monitoring' },
    { id: 'owner-workshop', icon: Car, label: 'Antrian Workshop', page: 'owner-workshop', ariaLabel: 'Antrian Workshop' },
    { id: 'owner-dms', icon: Search, label: 'DMS Search', page: 'owner-dms', ariaLabel: 'DMS Search' },
    { id: 'owner-sparepart-cost', icon: DollarSign, label: 'Sparepart Cost', page: 'owner-sparepart-cost', ariaLabel: 'Sparepart Cost' },
    { id: 'owner-warranty', icon: ShieldCheck, label: 'Warranty Search', page: 'owner-warranty', ariaLabel: 'Warranty Search' },
    { id: 'owner-parts', icon: Truck, label: 'Tracking Pemesanan Part', page: 'owner-parts', ariaLabel: 'Tracking Pemesanan Part' },
    { id: 'owner-users', icon: Users, label: 'Manajemen User', page: 'owner-users', ariaLabel: 'Manajemen User' },
    { id: 'owner-sound', icon: Settings, label: 'Settings', page: 'owner-sound', ariaLabel: 'Settings' },
    { id: 'owner-deleted', icon: Trash2, label: 'Riwayat Hapus Booking', page: 'owner-deleted', ariaLabel: 'Riwayat Hapus Booking' },
  ],
  mekanik: [
    { id: 'mechanic', icon: Wrench, label: 'Workshop', page: 'mechanic', ariaLabel: 'Mechanic Panel' },
  ],
  customer: [
    { id: 'customer-home', icon: Home, label: 'Dashboard', page: 'customer', ariaLabel: 'Dashboard Saya' },
    { id: 'customer-booking', icon: Calendar, label: 'Booking Service', page: 'booking-public', ariaLabel: 'Booking Service' },
  ],
  display: [],
  warranty: [
    { id: 'warranty-dashboard', icon: BarChart2,   label: 'Dashboard',        page: 'warranty',          ariaLabel: 'Warranty Dashboard' },
    { id: 'warranty-wo',        icon: ShieldCheck, label: 'Work Order',       page: 'warranty-wo',       ariaLabel: 'Warranty Work Order' },
    { id: 'warranty-search',    icon: Search,      label: 'Search',           page: 'warranty-search',   ariaLabel: 'Warranty Search' },
    { id: 'warranty-proforma',  icon: FileText,    label: 'Proforma Invoice', page: 'warranty-proforma', ariaLabel: 'Proforma Invoice' },
  ],
};

/**
 * Default landing page for each role.
 */
export const DEFAULT_PAGES = {
  admin: 'admin',
  manager: 'manager',
  cro: 'cro',
  sparepart: 'sparepart',
  owner: 'owner',
  mekanik: 'mechanic',
  customer: 'customer',
  display: 'display',
  warranty: 'warranty',
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
