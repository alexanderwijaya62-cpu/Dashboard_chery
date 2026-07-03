const getLongestCommonSubstrLen = (a, b) => {
  if (!a || !b) return 0;
  let maxLen = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > maxLen) maxLen = k;
    }
  }
  return maxLen;
};

const extractKmFromText = (text) => {
  if (!text) return null;
  const upper = text.toUpperCase();
  const kmMatch = upper.match(/([\d.]+)\s*KM/);
  if (kmMatch) return parseInt(kmMatch[1].replace(/\./g, ''), 10);
  const allNums = [...upper.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)/g)].map(m => parseInt(m[1].replace(/\./g, ''), 10));
  const mileageNums = allNums.filter(n => n >= 1000 && n <= 999999);
  return mileageNums.length > 0 ? mileageNums.sort((a, b) => a - b)[Math.floor(mileageNums.length / 2)] : null;
};

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

export const findBestMatchingWO = (wos, itemCode, vin, itemMileage, isFree, dmsDescription) => {
  if (!wos || !Array.isArray(wos) || wos.length === 0) return null;

  const cleanItemCode = (itemCode || '').trim().toLowerCase();
  const targetKategori = isFree ? 'IFS' : 'IKC';
  const dmsKm = dmsDescription ? extractKmFromText(dmsDescription) : null;

  let scored = wos.map(w => {
    let score = 0;
    const woDms = (w.no_wo_dms || '').trim().toLowerCase();
    const kategori = (w.kategori || '').trim().toUpperCase();
    const standKm = Number(w.stand_km || 0);
    const perintah = (w.perintah || '').toUpperCase();

    // 1. Exact match on WO DMS code (highest priority)
    if (woDms && cleanItemCode && woDms === cleanItemCode) {
      score += 10000;
    } else if (woDms && cleanItemCode) {
      if (woDms.includes(cleanItemCode) || cleanItemCode.includes(woDms)) {
        score += 5000;
      } else {
        // Partial: bonus for long common substring (e.g. shared vehicle/chassis ref)
        const commonLen = getLongestCommonSubstrLen(woDms, cleanItemCode);
        if (commonLen >= 10) score += Math.min(commonLen * 200, 3000);
      }
    }

    // 2. Kategori match (prefer same kategori but don't require)
    if (kategori === targetKategori) score += 2000;

    // 3. Mileage matching (no hard tolerance, closer = better)
    if (itemMileage != null && itemMileage !== '') {
      const targetKm = Number(itemMileage);
      if (!isNaN(targetKm) && standKm > 0) {
        if (standKm === targetKm) {
          score += 3000;
        } else {
          const diff = Math.abs(standKm - targetKm);
          score += Math.max(0, 1000 - diff);
        }
      }
    }

    // 4. Parse KM from perintah field (e.g. "SERVICE 20.000KM" -> 20000)
    if (itemMileage != null && itemMileage !== '') {
      const targetKm = Number(itemMileage);
      if (!isNaN(targetKm)) {
        const numMatch = perintah.match(/([\d.]+)\s*KM/);
        if (numMatch) {
          const parsedKm = parseInt(numMatch[1].replace(/\./g, ''), 10);
          if (!isNaN(parsedKm)) {
            if (parsedKm === targetKm) {
              score += 2500;
            } else {
              const diff = Math.abs(parsedKm - targetKm);
              score += Math.max(0, 800 - diff);
            }
          }
        }
      }
    }

    // 5. Match perintah text with dmsDescription (highest priority when available)
    if (dmsDescription && perintah) {
      const perintahKm = extractKmFromText(perintah);
      if (dmsKm != null && perintahKm != null && dmsKm === perintahKm) {
        score += 8000;
      } else {
        const dmsNorm = normalizeText(dmsDescription);
        const perintahNorm = normalizeText(perintah);
        if (dmsNorm && perintahNorm) {
          if (dmsNorm === perintahNorm || dmsNorm.includes(perintahNorm) || perintahNorm.includes(dmsNorm)) {
            score += 5000;
          }
        }
      }
    }

    // 6. Bonus: perintah contains expected keywords (SERVICE / CLAIM / perbaikan)
    if (perintah) {
      if (targetKategori === 'IFS' && /\bSERVICE\b/i.test(perintah)) score += 500;
      if (targetKategori === 'IKC' && /\b(CLAIM|PERBAIKAN|GANTI|BONGKAR|PASANG)\b/i.test(perintah)) score += 500;
    }

    return { wo: w, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.wo || null;
};
