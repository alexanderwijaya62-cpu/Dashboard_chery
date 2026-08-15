const GATE = import.meta.env.VITE_GATE;
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

// Template resmi pengiriman WA follow-up survei kepuasan CSI
export const CSI_WA_TEMPLATE = `Halo Customer Setia Chery 👋

Kami dari CRO Chery mengucapkan terima kasih sudah melakukan Service di dealer kami, Semoga Chery Bapak/Ibu tetap dalam kondisi Prima dan selalu Terawat ⚙️🚗

Kami pengen banget dengar cerita pengalaman Bapak/Ibu☺️ 
Chery Indonesia akan Mengirimkan LINK Survey Kepuasan Pelanggan melalui What's App Resmi 0811-1797-965 yang terpercaya dan sudah Centang Biru ✅
Mohon luangkan waktu sebentar untuk berikan penilaian dan share pengalaman nya, jangan lupa ya kasih penilaian Terbaik 10 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

Terima kasih atas kepercayaan dan waktunya Bapak/Ibu, yuk bantu kami jadi lebih baik lagi 🙏✨`;

// Template WA follow-up CSI berdasarkan waktu kirim (Pagi / Siang / Malam).
// Placeholder yang otomatis diisi: {nama} = nama customer, {plat} = plat/BK kendaraan.
// Teksnya bisa diedit CRO sebelum dikirim lewat form floating di halaman CSI Follow-up.
export const CSI_WA_TEMPLATES = {
  pagi: {
    label: 'Pagi',
    time: '08.00 - 11.00',
    text: `Halo {nama}, Selamat Pagi ☀️

Kami dari CRO Chery mengucapkan terima kasih sudah melakukan Service kendaraan {plat} di dealer kami. Semoga Chery Bapak/Ibu tetap dalam kondisi Prima dan selalu Terawat ⚙️🚗

Kami pengen banget dengar cerita pengalaman Bapak/Ibu☺️
Chery Indonesia akan Mengirimkan LINK Survey Kepuasan Pelanggan melalui What's App Resmi 0811-1797-965 yang terpercaya dan sudah Centang Biru ✅
Mohon luangkan waktu sebentar untuk berikan penilaian dan share pengalaman nya, jangan lupa ya kasih penilaian Terbaik 10 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

Terima kasih atas kepercayaan dan waktunya Bapak/Ibu, yuk bantu kami jadi lebih baik lagi 🙏✨`,
  },
  siang: {
    label: 'Siang',
    time: '11.00 - 15.00',
    text: `Halo {nama}, Selamat Siang 🌤️

Kami dari CRO Chery mengucapkan terima kasih sudah melakukan Service kendaraan {plat} di dealer kami. Semoga Chery Bapak/Ibu tetap dalam kondisi Prima dan selalu Terawat ⚙️🚗

Kami pengen banget dengar cerita pengalaman Bapak/Ibu☺️
Chery Indonesia akan Mengirimkan LINK Survey Kepuasan Pelanggan melalui What's App Resmi 0811-1797-965 yang terpercaya dan sudah Centang Biru ✅
Mohon luangkan waktu sebentar untuk berikan penilaian dan share pengalaman nya, jangan lupa ya kasih penilaian Terbaik 10 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

Terima kasih atas kepercayaan dan waktunya Bapak/Ibu, yuk bantu kami jadi lebih baik lagi 🙏✨`,
  },
  malam: {
    label: 'Malam',
    time: 'Setelah 18.00',
    text: `Halo {nama}, Selamat Malam 🌙

Kami dari CRO Chery mengucapkan terima kasih sudah melakukan Service kendaraan {plat} di dealer kami. Semoga Chery Bapak/Ibu tetap dalam kondisi Prima dan selalu Terawat ⚙️🚗

Kami pengen banget dengar cerita pengalaman Bapak/Ibu☺️
Chery Indonesia akan Mengirimkan LINK Survey Kepuasan Pelanggan melalui What's App Resmi 0811-1797-965 yang terpercaya dan sudah Centang Biru ✅
Mohon luangkan waktu sebentar untuk berikan penilaian dan share pengalaman nya, jangan lupa ya kasih penilaian Terbaik 10 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

Terima kasih atas kepercayaan dan waktunya Bapak/Ibu, yuk bantu kami jadi lebih baik lagi 🙏✨`,
  },
};

// SET TRUE UNTUK NON-AKTIFKAN PROYEK (TAMPILAN 404)
// SET FALSE UNTUK MENGAKTIFKAN KEMBALI
export const IS_MAINTENANCE = false;
