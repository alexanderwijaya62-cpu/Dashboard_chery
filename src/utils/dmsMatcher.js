/**
 * Finds the best matching work order (WO) from the Aftersales database for a given claim item.
 * 
 * @param {Array} wos - Array of work orders fetched from Aftersales
 * @param {string} itemCode - The claim or proforma invoice code (e.g., BY..., BX...)
 * @param {string} vin - The vehicle's VIN code
 * @param {number|string} itemMileage - The mileage of the claim item
 * @param {boolean} isFree - Whether the claim is Free Service
 * @returns {Object|null} The best matching work order, or null if not found
 */
export const findBestMatchingWO = (wos, itemCode, vin, itemMileage, isFree) => {
  if (!wos || !Array.isArray(wos) || wos.length === 0) return null;

  // Clean strings for safe comparison
  const cleanItemCode = (itemCode || '').trim().toLowerCase();
  const cleanVin = (vin || '').trim().toLowerCase();
  const targetKategori = isFree ? 'IFS' : 'IKC';

  // Filter by kategori first
  let catWos = wos.filter(w => (w.kategori || '').trim().toUpperCase() === targetKategori);
  if (catWos.length === 0) {
    // Fallback: use all WOs if kategori filter yields nothing
    catWos = wos;
  }

  // 1. Try exact match on WO DMS code
  let match = catWos.find(w => (w.no_wo_dms || '').trim().toLowerCase() === cleanItemCode);
  if (match) return match;

  // 2. Try partial match on WO DMS code
  match = catWos.find(w => {
    const woDms = (w.no_wo_dms || '').trim().toLowerCase();
    return woDms && (woDms.includes(cleanItemCode) || cleanItemCode.includes(woDms));
  });
  if (match) return match;

  // 3. Try exact match on mileage / KM
  if (itemMileage != null && itemMileage !== '') {
    const targetKm = Number(itemMileage);
    match = catWos.find(w => Number(w.stand_km || 0) === targetKm);
    if (match) return match;
  }

  // 4. Try closest mileage / KM within 2000 km difference
  if (itemMileage != null && itemMileage !== '') {
    const targetKm = Number(itemMileage);
    let closest = null;
    let minDiff = Infinity;
    catWos.forEach(w => {
      const diff = Math.abs(Number(w.stand_km || 0) - targetKm);
      if (diff < minDiff && diff <= 2000) {
        minDiff = diff;
        closest = w;
      }
    });
    if (closest) return closest;
  }

  // 5. Try matching mileage against KM value extracted from perintah field
  //    (e.g. "SERVICE 20.000KM" -> 20000, "10000KM" -> 10000)
  if (itemMileage != null && itemMileage !== '') {
    const targetKm = Number(itemMileage);
    let closest = null;
    let minDiff = Infinity;
    catWos.forEach(w => {
      const perintah = (w.perintah || '').toUpperCase();
      const numMatch = perintah.match(/([\d.]+)\s*KM/);
      if (numMatch) {
        const parsedKm = parseInt(numMatch[1].replace(/\./g, ''), 10);
        if (!isNaN(parsedKm)) {
          const diff = Math.abs(parsedKm - targetKm);
          if (diff < minDiff && diff <= 2000) {
            minDiff = diff;
            closest = w;
          }
        }
      }
    });
    if (closest) return closest;
  }

  // 6. If kategori filter excluded some WOs, retry mileage matching across ALL WOs.
  //    This handles cases where the correct WO has a different kategori
  //    (e.g. SERVICE 20.000KM is IKC while the BY item expects IFS).
  const kategoriActive = catWos.length > 0 && catWos.length < wos.length;
  if (kategoriActive && itemMileage != null && itemMileage !== '') {
    const targetKm = Number(itemMileage);

    let closest = null;
    let minDiff = Infinity;
    wos.forEach(w => {
      const diff = Math.abs(Number(w.stand_km || 0) - targetKm);
      if (diff < minDiff && diff <= 2000) {
        minDiff = diff;
        closest = w;
      }
    });
    if (closest) return closest;

    closest = null;
    minDiff = Infinity;
    wos.forEach(w => {
      const perintah = (w.perintah || '').toUpperCase();
      const numMatch = perintah.match(/([\d.]+)\s*KM/);
      if (numMatch) {
        const parsedKm = parseInt(numMatch[1].replace(/\./g, ''), 10);
        if (!isNaN(parsedKm)) {
          const diff = Math.abs(parsedKm - targetKm);
          if (diff < minDiff && diff <= 2000) {
            minDiff = diff;
            closest = w;
          }
        }
      }
    });
    if (closest) return closest;
  }

  // 7. Fallback: return the first available work order in the filtered list
  return catWos[0];
};
