import { db } from './dbClient';

const CONFIG_KEYS = {
  slotCount: 'booking_slot_count',
  gapMinutes: 'booking_gap_minutes',
  startHour: 'booking_start_hour',
  startMinute: 'booking_start_minute',
  slotCapacity: 'booking_slot_capacity',
  saturdayEnabled: 'booking_saturday_enabled',
  satSlotCount: 'booking_sat_slot_count',
  satGapMinutes: 'booking_sat_gap_minutes',
  satStartHour: 'booking_sat_start_hour',
  satStartMinute: 'booking_sat_start_minute',
  satSlotCapacity: 'booking_sat_slot_capacity',
};

const DEFAULTS = {
  slotCount: 4,
  gapMinutes: 30,
  startHour: 8,
  startMinute: 30,
  slotCapacity: 1,
  saturdayEnabled: true,
  satSlotCount: 4,
  satGapMinutes: 30,
  satStartHour: 8,
  satStartMinute: 0,
  satSlotCapacity: 1,
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
      saturdayEnabled: (map[CONFIG_KEYS.saturdayEnabled] ?? String(DEFAULTS.saturdayEnabled)) !== 'false',
      satSlotCount: parseInt(map[CONFIG_KEYS.satSlotCount]) || DEFAULTS.satSlotCount,
      satGapMinutes: parseInt(map[CONFIG_KEYS.satGapMinutes]) || DEFAULTS.satGapMinutes,
      satStartHour: parseInt(map[CONFIG_KEYS.satStartHour]) || DEFAULTS.satStartHour,
      satStartMinute: parseInt(map[CONFIG_KEYS.satStartMinute]) || DEFAULTS.satStartMinute,
      satSlotCapacity: parseInt(map[CONFIG_KEYS.satSlotCapacity]) || DEFAULTS.satSlotCapacity,
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
    { key: CONFIG_KEYS.saturdayEnabled, value: String(config.saturdayEnabled) },
    { key: CONFIG_KEYS.satSlotCount, value: String(config.satSlotCount) },
    { key: CONFIG_KEYS.satGapMinutes, value: String(config.satGapMinutes) },
    { key: CONFIG_KEYS.satStartHour, value: String(config.satStartHour) },
    { key: CONFIG_KEYS.satStartMinute, value: String(config.satStartMinute) },
    { key: CONFIG_KEYS.satSlotCapacity, value: String(config.satSlotCapacity) },
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

export function isSaturday(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).getDay() === 6;
}

function num(val, fallback) {
  if (fallback === undefined) fallback = 1;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function resolveConfig(c) {
  return {
    slotCount: num(c.slotCount) || num(c.count) || 4,
    gapMinutes: num(c.gapMinutes) || num(c.gap) || 30,
    startHour: num(c.startHour) || num(c.startH) || 8,
    startMinute: Number.isFinite(Number(c.startMinute)) ? Number(c.startMinute) : Number.isFinite(Number(c.startM)) ? Number(c.startM) : 0,
    slotCapacity: num(c.slotCapacity) || num(c.capacity) || 1,
    saturdayEnabled: c.saturdayEnabled ?? true,
    satSlotCount: num(c.satSlotCount) || num(c.count) || 4,
    satGapMinutes: num(c.satGapMinutes) || num(c.satGap) || 30,
    satStartHour: num(c.satStartHour) || num(c.satStartH) || 8,
    satStartMinute: Number.isFinite(Number(c.satStartMinute)) ? Number(c.satStartMinute) : Number.isFinite(Number(c.satStartM)) ? Number(c.satStartM) : 0,
    satSlotCapacity: num(c.satSlotCapacity) || num(c.satCapacity) || 1,
  };
}

export function getSlotsForDate(dateStr, config) {
  const c = resolveConfig(config);
  if (isSaturday(dateStr) && c.saturdayEnabled) {
    return generateSlots(c.satSlotCount, c.satGapMinutes, c.satStartHour, c.satStartMinute);
  }
  return generateSlots(c.slotCount, c.gapMinutes, c.startHour, c.startMinute);
}

export function getCapacityForDate(dateStr, config) {
  const c = resolveConfig(config);
  if (isSaturday(dateStr) && c.saturdayEnabled) {
    return c.satSlotCapacity;
  }
  return c.slotCapacity;
}
