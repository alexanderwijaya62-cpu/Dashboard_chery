export function normalizePlate(str) {
    return String(str || '').toUpperCase().replace(/\s+/g, '');
}

export function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

export function getMinBookingDateStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}
