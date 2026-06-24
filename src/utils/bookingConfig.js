import { db } from './dbClient';

const CONFIG_KEYS = {
  slotCount: 'booking_slot_count',
  gapMinutes: 'booking_gap_minutes',
  startHour: 'booking_start_hour',
  startMinute: 'booking_start_minute',
  slotCapacity: 'booking_slot_capacity',
};

const DEFAULTS = {
  slotCount: 4,
  gapMinutes: 30,
  startHour: 8,
  startMinute: 30,
  slotCapacity: 1,
};

export async function fetchBookingConfig() {
  try {
    const keys = Object.values(CONFIG_KEYS);
    const { data, error } = await db.select('settings', {
      in: { key: keys }
    });
    if (error) throw error;
    if (!Array.isArray(data)) return { ...DEFAULTS };

    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });

    return {
      slotCount: parseInt(map[CONFIG_KEYS.slotCount]) || DEFAULTS.slotCount,
      gapMinutes: parseInt(map[CONFIG_KEYS.gapMinutes]) || DEFAULTS.gapMinutes,
      startHour: parseInt(map[CONFIG_KEYS.startHour]) || DEFAULTS.startHour,
      startMinute: parseInt(map[CONFIG_KEYS.startMinute]) || DEFAULTS.startMinute,
      slotCapacity: parseInt(map[CONFIG_KEYS.slotCapacity]) || DEFAULTS.slotCapacity,
    };
  } catch (e) {
    console.error('Gagal fetch booking config:', e);
    return { ...DEFAULTS };
  }
}

export async function saveBookingConfig(config) {
  const entries = [
    { key: CONFIG_KEYS.slotCount, value: String(config.slotCount) },
    { key: CONFIG_KEYS.gapMinutes, value: String(config.gapMinutes) },
    { key: CONFIG_KEYS.startHour, value: String(config.startHour) },
    { key: CONFIG_KEYS.startMinute, value: String(config.startMinute) },
    { key: CONFIG_KEYS.slotCapacity, value: String(config.slotCapacity) },
  ];

  for (const entry of entries) {
    const { error } = await db.upsert('settings', entry, { onConflict: 'key' });
    if (error) {
      console.error(`Gagal save config ${entry.key}:`, error);
      throw error;
    }
  }
}

export function generateSlots(count, gapMinutes = 30, startHour = 8, startMin = 30) {
  const slots = [];
  let currentHour = startHour;
  let currentMin = startMin;
  for (let i = 0; i < count; i++) {
    const h = String(currentHour).padStart(2, '0');
    const m = String(currentMin).padStart(2, '0');
    slots.push(`${h}.${m}`);
    currentMin += gapMinutes;
    while (currentMin >= 60) {
      currentHour += 1;
      currentMin -= 60;
    }
  }
  return slots;
}
