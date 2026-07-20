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
      startHour: safeNum(map[CONFIG_KEYS.startHour], null, DEFAULTS.startHour),
      startMinute: safeNum(map[CONFIG_KEYS.startMinute], null, DEFAULTS.startMinute),
      slotCapacity: parseInt(map[CONFIG_KEYS.slotCapacity]) || DEFAULTS.slotCapacity,
      saturdayEnabled: (map[CONFIG_KEYS.saturdayEnabled] ?? String(DEFAULTS.saturdayEnabled)) !== 'false',
      satSlotCount: parseInt(map[CONFIG_KEYS.satSlotCount]) || DEFAULTS.satSlotCount,
      satGapMinutes: parseInt(map[CONFIG_KEYS.satGapMinutes]) || DEFAULTS.satGapMinutes,
      satStartHour: safeNum(map[CONFIG_KEYS.satStartHour], null, DEFAULTS.satStartHour),
      satStartMinute: safeNum(map[CONFIG_KEYS.satStartMinute], null, DEFAULTS.satStartMinute),
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

  const results = await Promise.all(
    entries.map(entry => db.upsert('settings', entry, { onConflict: 'key' }))
  );
  const failed = results.find(r => r.error);
  if (failed) {
    console.error('Gagal save booking config:', failed.error);
    throw failed.error;
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

function safeNum(primary, fallback, def) {
  const v = Number(primary ?? fallback);
  return Number.isFinite(v) ? v : def;
}

function resolveConfig(c) {
  return {
    slotCount: safeNum(c.slotCount, c.count, 4),
    gapMinutes: safeNum(c.gapMinutes, c.gap, 30),
    startHour: safeNum(c.startHour, c.startH, 8),
    startMinute: safeNum(c.startMinute, c.startM, 0),
    slotCapacity: safeNum(c.slotCapacity, c.capacity, 1),
    saturdayEnabled: c.saturdayEnabled ?? true,
    satSlotCount: safeNum(c.satSlotCount, c.count, 4),
    satGapMinutes: safeNum(c.satGapMinutes, c.satGap, 30),
    satStartHour: safeNum(c.satStartHour, c.satStartH, 8),
    satStartMinute: safeNum(c.satStartMinute, c.satStartM, 0),
    satSlotCapacity: safeNum(c.satSlotCapacity, c.satCapacity, 1),
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
