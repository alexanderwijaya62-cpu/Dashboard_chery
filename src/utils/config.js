const GATE = import.meta.env.VITE_GATE || 'chery-gate-2024';
export { GATE };
export const GAS_URL = "/api/gas";
export const GAS_USERS_URL = "/api/gas_users";
export const GAS_SPAREPART_URL = "/api/gas_sparepart";
export const GAS_REVENUE_URL = "/api/gas_revenue";
export const GAS_WO_TRACKING_URL = "/api/gas_laporanwo";
export const GAS_CRO_URL = "/api/gas_cro";
export const GAS_BOOKING_URL = "/api/gas_booking";
export const CHERY_DMS_URL = "/api/chery_dms";
export const CHERY_EPC_URL = "/api/chery_epc";
export const CHERY_EPC_LOGIN_URL = "/api/chery_epc?action=login";
export const CSI_PROXY_URL = "/api/csi-proxy";

// SET TRUE UNTUK NON-AKTIFKAN PROYEK (TAMPILAN 404)
// SET FALSE UNTUK MENGAKTIFKAN KEMBALI
export const IS_MAINTENANCE = false;
