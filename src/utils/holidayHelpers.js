import { db } from './dbClient';

export const fetchHolidays = async () => {
  try {
    const { data, error } = await db.select('libur');
    if (error) {
      console.error('fetchHolidays error:', error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('fetchHolidays exception:', e);
    return [];
  }
};

export const isHolidayOrSunday = (dateStr, holidays) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (d.getDay() === 0) return true;
  const normalized = dateStr.split('T')[0];
  return (holidays || []).some(h => (h.date || '').split('T')[0] === normalized);
};
