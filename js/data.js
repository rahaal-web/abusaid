import { LOGO_FALLBACK } from './logo-data.js';

export { LOGO_FALLBACK };

export const EMPTY_DATA = {
  v: 1,
  cfg: { phone: '', min: 500, unit: 'كرتونة' },
  cats: [],
  p: [],
};

const CACHE_KEY = 'abu_catalog_cache_v1';

export function loadCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && Array.isArray(parsed.data.p)) {
      return parsed;
    }
  } catch (e) {
    // ignore storage errors
  }
  return null;
}

export function saveCachedData(data, ts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts }));
  } catch (e) {
    // ignore storage errors
  }
}

export function clearCachedData() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // ignore storage errors
  }
}
