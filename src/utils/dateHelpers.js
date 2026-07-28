/**
 * Parse DMS janji_datang string to YYYY-MM-DD format.
 * Handles: "DD/MM/YYYY HH:MM", "YYYY-MM-DD HH:MM:SS", "YYYY-MM-DD", etc.
 */
export function parseDmsDate(janjiDatang) {
    if (!janjiDatang) return '';
    const raw = janjiDatang.trim();
    const datePart = raw.split(' ')[0] || '';
    if (!datePart) return '';

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;

    // DD/MM/YYYY
    const dmy = datePart.split('/');
    if (dmy.length === 3) {
        const [d, m, y] = dmy;
        if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return datePart;
}

/**
 * Parse DMS janji_datang to time in HH.MM format.
 * Handles: "13/07/2026 09:15", "2026-07-13 09:15:00", etc.
 */
export function parseDmsTime(janjiDatang) {
    if (!janjiDatang) return '08.00';
    const raw = janjiDatang.trim();
    const timePart = raw.split(' ')[1] || '08:00';
    return timePart.slice(0, 5).replace(':', '.');
}

/**
 * Normalize a DMS booking into the standard internal booking format.
 * Fixes date from DD/MM/YYYY → YYYY-MM-DD and time from HH:MM → HH.MM
 */
export function normalizeDmsBooking(b) {
    const tanggal = parseDmsDate(b.janji_datang);
    const jam = parseDmsTime(b.janji_datang);
    const sBooking = (b.status_booking || '').toLowerCase();
    if (['batal', 'declined'].includes(sBooking)) return null;
    const status = sBooking === 'expired' ? 'expired' : 'accepted';
    return {
        id: `dms_${b.no_booking || b.id || Math.random()}`,
        tanggal,
        jam,
        status,
        noPlat: b.no_polisi || '',
        namaCustomer: b.nama_pelanggan || '',
        tipeMobil: b.nama_kendaraan || '',
        keperluanService: '',
        noTelp: b.no_telp_pelanggan || b.no_telp_booking || '',
        bookingVia: 'DMS Internal',
    };
}
