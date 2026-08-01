import { db } from './dbClient';

export const normalizeDateStr = (d) => {
  if (!d) return '';
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const str = String(d).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let dd, mm, yyyy;
      if (parts[0].length === 4) {
        yyyy = parts[0];
        mm = parts[1];
        dd = parts[2];
      } else {
        dd = parts[0];
        mm = parts[1];
        yyyy = parts[2];
      }
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  return str.split(/[T ]/)[0];
};

export const fetchHolidays = async () => {
  try {
    const { data, error } = await db.select('libur');
    if (error) {
      console.error('fetchHolidays error:', error);
      return [];
    }
    return Array.isArray(data) ? data.map(h => ({ ...h, date: normalizeDateStr(h.date) })) : [];
  } catch (e) {
    console.error('fetchHolidays exception:', e);
    return [];
  }
};

export const isHolidayOrSunday = (dateStr, holidays) => {
  if (!dateStr) return false;
  const normalized = normalizeDateStr(dateStr);
  const d = new Date(`${normalized}T00:00:00`);
  if (!isNaN(d.getTime()) && d.getDay() === 0) return true;
  return (holidays || []).some(h => normalizeDateStr(h.date) === normalized);
};
