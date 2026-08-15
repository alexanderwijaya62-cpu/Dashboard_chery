// Utility & Supabase DB Integration for Free Maintenance
import { db } from './dbClient';

const STORAGE_KEY = 'chery_free_maintenance_vehicles_v1';
const SETTINGS_KEY = 'free_maintenance_vehicles';

export const INITIAL_VEHICLES_DATA = [];

// Read from Supabase DB, with fallback to settings table or localStorage
export async function getFreeMaintenanceDataFromDB() {
  // 1. Try free_maintenance table first
  try {
    const { data, error } = await db.select('free_maintenance');
    if (!error && Array.isArray(data) && data.length > 0) {
      const vehicles = data.map(row => ({
        id: row.id,
        kode_tipe: row.kode_tipe,
        nama_mobil: row.nama_mobil,
        drivetrain: row.drivetrain || '4x2',
        drive_layout: row.drive_layout || 'FWD',
        intervals: typeof row.intervals === 'string' ? JSON.parse(row.intervals) : (row.intervals || [])
      }));
      saveStoredFreeMaintenanceData(vehicles);
      return vehicles;
    }
  } catch (e) {
    console.warn('free_maintenance table fetch error:', e);
  }

  // 2. Fallback to settings table (key: free_maintenance_vehicles)
  try {
    const { data: setRes, error: setErr } = await db.select('settings', { eq: { key: SETTINGS_KEY }, maybeSingle: true });
    if (!setErr && setRes?.value) {
      const parsed = typeof setRes.value === 'string' ? JSON.parse(setRes.value) : setRes.value;
      if (Array.isArray(parsed)) {
        saveStoredFreeMaintenanceData(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn('settings table fetch error:', e);
  }

  return getStoredFreeMaintenanceData();
}

// Save complete dataset to Supabase DB (both settings table + free_maintenance table)
export async function saveFreeMaintenanceDataToDB(vehiclesData) {
  saveStoredFreeMaintenanceData(vehiclesData);

  // 1. Save to settings table (works on all backend versions without 403)
  try {
    await db.upsert('settings', {
      key: SETTINGS_KEY,
      value: JSON.stringify(vehiclesData)
    });
  } catch (e) {
    console.warn('Saving to settings table error:', e);
  }

  // 2. Also try saving directly to free_maintenance table
  try {
    for (const v of vehiclesData) {
      await db.upsert('free_maintenance', {
        id: v.id,
        kode_tipe: v.kode_tipe,
        nama_mobil: v.nama_mobil,
        drivetrain: v.drivetrain,
        drive_layout: v.drive_layout,
        intervals: v.intervals,
        updated_at: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Saving to free_maintenance table error:', e);
  }
}

// Delete vehicle row from Supabase DB & localStorage
export async function deleteFreeMaintenanceVehicleFromDB(vehicleId, currentVehicles) {
  const updated = currentVehicles.filter(v => v.id !== vehicleId);
  saveStoredFreeMaintenanceData(updated);

  try {
    await db.upsert('settings', {
      key: SETTINGS_KEY,
      value: JSON.stringify(updated)
    });
  } catch (e) {}

  try {
    await db.delete('free_maintenance', { eq: { id: vehicleId } });
  } catch (e) {}
  return updated;
}

export function getStoredFreeMaintenanceData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading free maintenance data:', e);
  }
  return [];
}

export function saveStoredFreeMaintenanceData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving free maintenance data:', e);
  }
}
