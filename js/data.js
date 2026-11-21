import { LOGO_FALLBACK } from './logo-data.js';

export const DBU = 'abu-saied-a6b74-default-rtdb.firebaseio.com';
export { LOGO_FALLBACK };

export const DEFAULT_DATA = {
  v: 1,
  cfg: { phone: '201006898024', min: 500, unit: 'كرتونة' },
  cats: ['شيبسي', 'سناكس', 'حلويات', 'مشروبات'],
  p: [
    ['شيبسي ملح', 'شيبسي', 'كرتونة ٤٨ كيس', 190, '#ffd23f', '#e8a400', '🥔', 0],
    ['شيبسي طماطم', 'شيبسي', 'كرتونة ٤٨ كيس', 190, '#ff4b3e', '#b3201a', '🍅', 0],
    ['شيبسي شطة', 'شيبسي', 'كرتونة ٤٨ كيس', 190, '#e6322b', '#7d0f0a', '🌶️', 0],
    ['شيبسي جبنة', 'شيبسي', 'كرتونة ٤٨ كيس', 190, '#ff9f1c', '#c26a00', '🧀', 0],
    ['شيبسي خل وملح', 'شيبسي', 'كرتونة ٤٨ كيس', 190, '#3fa7ff', '#1b6dbb', '🧂', 0],
    ['شيبسي كبير عائلي', 'شيبسي', 'كرتونة ٢٤ كيس', 260, '#17b26a', '#0b7a46', '🥔', 0],
    ['ذرة مقرمشة', 'سناكس', 'كرتونة ٤٨ كيس', 170, '#ffb703', '#c98400', '🌽', 0],
    ['فشار بالكراميل', 'سناكس', 'كرتونة ٣٦ كيس', 150, '#f4a261', '#b5651d', '🍿', 0],
    ['بف جبنة', 'سناكس', 'كرتونة ٤٨ كيس', 165, '#ffc233', '#d18b00', '🧀', 0],
    ['لب وسوداني', 'سناكس', 'كرتونة ٢٤ كيس', 210, '#c68642', '#7a4a1c', '🥜', 0],
    ['بسكويت شوكولاتة', 'حلويات', 'كرتونة ٣٦ علبة', 240, '#6b3e26', '#3a1f10', '🍫', 0],
    ['ويفر كريمة', 'حلويات', 'كرتونة ٤٨ قطعة', 200, '#e9b872', '#a8742f', '🍪', 0],
    ['حلاوة طحينية', 'حلويات', 'كرتونة ٢٤ علبة', 280, '#f1d58a', '#b58a22', '🍯', 0],
    ['عصير مانجو', 'مشروبات', 'كرتونة ٢٤ علبة', 220, '#ffa62b', '#c26a00', '🥭', 0],
    ['عصير فراولة', 'مشروبات', 'كرتونة ٢٤ علبة', 220, '#ff5c8a', '#b3234f', '🍓', 0],
    ['مياه غازية', 'مشروبات', 'كرتونة ٢٤ زجاجة', 300, '#2b6cff', '#0f3fa8', '🥤', 0],
  ],
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
