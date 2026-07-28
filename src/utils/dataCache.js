/**
 * Shared data cache with stale-while-revalidate pattern.
 * Dual-layer: in-memory Map + localStorage for cross-render persistence.
 *
 * Usage:
 *   import { fetchWithCache } from '../utils/dataCache';
 *
 *   const data = await fetchWithCache('my_key', () => fetch('/api/...'), {
 *     ttl: 300000,        // 5 min (default)
 *     forceFresh: false,  // skip cache
 *     onCacheHit: () => {}, // called when stale data returned instantly
 *     onFreshData: () => {}, // called when background refresh completes
 *   });
 */

const memoryCache = new Map();

const DEFAULT_TTL = 300000; // 5 minutes

/**
 * Get cached data if available and not expired.
 * Returns { data, timestamp } or null.
 */
export function getCache(cacheKey) {
  try {
    // 1. Check in-memory (fastest)
    if (memoryCache.has(cacheKey)) {
      const entry = memoryCache.get(cacheKey);
      return entry;
    }
    // 2. Check localStorage (survives re-renders, lost on tab close)
    const raw = localStorage.getItem(`datacache_${cacheKey}`);
    if (raw) {
      const entry = JSON.parse(raw);
      // Hydrate memory cache
      memoryCache.set(cacheKey, entry);
      return entry;
    }
  } catch (e) {}
  return null;
}

/**
 * Write data to both in-memory and localStorage.
 */
export function setCache(cacheKey, data) {
  const entry = { data, timestamp: Date.now() };
  try {
    memoryCache.set(cacheKey, entry);
    localStorage.setItem(`datacache_${cacheKey}`, JSON.stringify(entry));
  } catch (e) {
    // localStorage full or blocked — memory cache still works
    memoryCache.set(cacheKey, entry);
  }
}

/**
 * Check if a cache entry is still fresh (within TTL).
 */
export function isCacheFresh(cacheKey, ttl = DEFAULT_TTL) {
  const entry = getCache(cacheKey);
  if (!entry || !entry.data) return false;
  return Date.now() - entry.timestamp < ttl;
}

/**
 * Delete a specific cache entry.
 */
export function deleteCache(cacheKey) {
  try {
    memoryCache.delete(cacheKey);
    localStorage.removeItem(`datacache_${cacheKey}`);
  } catch (e) {}
}

/**
 * fetchWithCache — the main stale-while-revalidate function.
 *
 * Behavior:
 * 1. If cache exists and is fresh (< TTL): return data immediately, no fetch.
 * 2. If cache exists but is stale (> TTL):
 *    - Return stale data immediately (sets loading to false)
 *    - Fetch fresh data in background
 *    - When fresh data arrives, call onFreshData(newData)
 * 3. If no cache: fetch and return data (sets loading to true).
 *
 * Returns: data (may be stale or fresh)
 */
export async function fetchWithCache(cacheKey, fetchFn, opts = {}) {
  const {
    ttl = DEFAULT_TTL,
    forceFresh = false,
    onLoading = () => {},     // (isLoading: boolean) => void
    onFreshData = () => {},   // (data: any) => void — called when background fetch completes
    onError = () => {},       // (error: Error) => void
  } = opts;

  const entry = getCache(cacheKey);
  const hasCache = entry && entry.data && (
    Array.isArray(entry.data) ? entry.data.length > 0 : true
  );

  // Case 1: Fresh cache, no force refresh → instant return
  if (!forceFresh && hasCache && Date.now() - entry.timestamp < ttl) {
    onLoading(false);
    return entry.data;
  }

  // Case 2: Stale cache → return stale data, revalidate in background
  if (!forceFresh && hasCache) {
    // Return stale data instantly
    onLoading(false);

    // Background refresh (non-blocking)
    (async () => {
      try {
        const freshData = await fetchFn();
        if (freshData != null) {
          setCache(cacheKey, freshData);
          onFreshData(freshData);
        }
      } catch (e) {
        // Background refresh failed — stale data is still shown, no error to user
      }
    })();

    return entry.data;
  }

  // Case 3: No cache → blocking fetch
  onLoading(true);
  try {
    const data = await fetchFn();
    if (data != null) {
      setCache(cacheKey, data);
    }
    onLoading(false);
    return data;
  } catch (e) {
    onLoading(false);
    onError(e);
    return null;
  }
}
