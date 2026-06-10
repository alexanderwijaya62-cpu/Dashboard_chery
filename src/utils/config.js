const API_KEY = import.meta.env.VITE_API_KEY;
if (!API_KEY) {
  throw new Error("VITE_API_KEY must be set in environment variables");
}
export { API_KEY };
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

// SET TRUE UNTUK NON-AKTIFKAN PROYEK (TAMPILAN 404)
// SET FALSE UNTUK MENGAKTIFKAN KEMBALI
export const IS_MAINTENANCE = false;
