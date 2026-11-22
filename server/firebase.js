import { getKv, setKv, updateSessionFirebaseTokens } from './db.js';

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyB4r_lzcpX_F9L0WayaqyGNG01qgFG8jr0';
const FIREBASE_RTDB_HOST =
  process.env.FIREBASE_RTDB_HOST || 'abu-saied-a6b74-default-rtdb.firebaseio.com';

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

let catalogCache = null;
let catalogCacheAt = 0;
const imgCache = new Map();

export async function verifyFirebasePassword(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    return { ok: false, error: data?.error?.message || 'INVALID_CREDENTIALS' };
  }
  return {
    ok: true,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
    email: data.email || email,
  };
}

export async function refreshFirebaseToken(refreshToken) {
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const data = await res.json();
  if (!res.ok || !data.id_token) {
    throw new Error(data?.error?.message || `REFRESH_FAILED_${res.status}`);
  }
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
}

export async function getRawCatalog(force = false) {
  const now = Date.now();
  if (!force && catalogCache && now - catalogCacheAt < 15000) {
    return catalogCache;
  }

  const saved = getKv('catalog_snapshot');

  try {
    const res = await fetch(`https://${FIREBASE_RTDB_HOST}/chips/data.json`);
    if (res.ok) {
      const payload = await res.json();
      if (payload && payload.json) {
        const remoteTs = Number(payload.ts || 0);
        if (saved && saved.data && Number(saved.ts || 0) > remoteTs) {
          catalogCache = saved;
          catalogCacheAt = now;
          return saved;
        }
        const parsed = JSON.parse(payload.json);
        const result = { ts: remoteTs || now, data: parsed };
        catalogCache = result;
        catalogCacheAt = now;
        setKv('catalog_snapshot', result);
        return result;
      }
    }
  } catch {
    // fallback to kv_store or DEFAULT_DATA
  }

  if (catalogCache) return catalogCache;
  if (saved && saved.data) {
    catalogCache = saved;
    catalogCacheAt = now;
    return saved;
  }

  return { ts: 0, data: JSON.parse(JSON.stringify(DEFAULT_DATA)) };
}

export function stripSecretsForCustomer(rawData) {
  const clone = JSON.parse(JSON.stringify(rawData || DEFAULT_DATA));
  const cfg = clone.cfg || {};
  const hasServerGemini = Boolean((cfg.gk && String(cfg.gk).trim()) || process.env.GEMINI_API_KEY);
  if ('gk' in cfg) {
    delete cfg.gk;
  }
  cfg.hasGk = hasServerGemini;
  clone.cfg = cfg;
  return clone;
}

export async function fetchAssetById(id) {
  const safeId = String(id || '').trim();
  if (!safeId || !/^[a-zA-Z0-9_-]{1,64}$/.test(safeId)) return null;
  if (imgCache.has(safeId)) return imgCache.get(safeId);

  const localVal = getKv('img_' + safeId);
  if (localVal) {
    imgCache.set(safeId, localVal);
    return localVal;
  }

  try {
    const res = await fetch(`https://${FIREBASE_RTDB_HOST}/chips/img/${encodeURIComponent(safeId)}.json`);
    if (res.ok) {
      const val = await res.json();
      if (val) {
        imgCache.set(safeId, val);
        setKv('img_' + safeId, val);
        return val;
      }
    }
  } catch {
    // ignore fetch error
  }
  return null;
}

export async function fetchAdminAssets(catalogData) {
  const keys = new Set();
  (catalogData.p || []).forEach((p) => {
    if (p && p[8]) keys.add(p[8]);
  });
  (catalogData.offers || []).forEach((o) => {
    if (o && o.i) keys.add(o.i);
  });
  if (catalogData.cfg) {
    if (catalogData.cfg.logo) keys.add(catalogData.cfg.logo);
    if (catalogData.cfg.fontBodyId) keys.add(catalogData.cfg.fontBodyId);
    if (catalogData.cfg.fontHeadId) keys.add(catalogData.cfg.fontHeadId);
  }

  const imgs = {};
  await Promise.all(
    Array.from(keys).map(async (k) => {
      const v = await fetchAssetById(k);
      if (v) imgs[k] = v;
    })
  );
  return imgs;
}

async function ensureValidSessionToken(sessionRow) {
  let idToken = sessionRow.fb_id_token;
  let refreshToken = sessionRow.fb_refresh_token;
  let expiresAt = Number(sessionRow.fb_expires_at || 0);

  if (idToken && Date.now() < expiresAt - 120000) {
    return idToken;
  }
  if (!refreshToken) {
    throw new Error('SESSION_REAUTH_REQUIRED');
  }
  const refreshed = await refreshFirebaseToken(refreshToken);
  updateSessionFirebaseTokens(sessionRow.token_hash, {
    fbIdToken: refreshed.idToken,
    fbRefreshToken: refreshed.refreshToken,
    fbExpiresAt: refreshed.expiresAt,
  });
  return refreshed.idToken;
}

export async function publishCatalog({ sessionRow, catalog, pendingImgs = {} }) {
  const ts = Date.now();
  const base = `https://${FIREBASE_RTDB_HOST}/chips/`;

  const used = new Set();
  (catalog.p || []).forEach((p) => {
    if (p && p[8]) used.add(p[8]);
  });
  (catalog.offers || []).forEach((o) => {
    if (o && o.i) used.add(o.i);
  });
  if (catalog.cfg) {
    if (catalog.cfg.logo) used.add(catalog.cfg.logo);
    if (catalog.cfg.fontBodyId) used.add(catalog.cfg.fontBodyId);
    if (catalog.cfg.fontHeadId) used.add(catalog.cfg.fontHeadId);
  }

  // If admin session is backed by Firebase Auth, sync to Firebase RTDB;
  // otherwise store locally in kv_store if local env admin was used.
  if (sessionRow.fb_refresh_token || sessionRow.fb_id_token) {
    const token = await ensureValidSessionToken(sessionRow);

    for (const [k, val] of Object.entries(pendingImgs || {})) {
      if (!used.has(k) || !val) continue;
      const r = await fetch(`${base}img/${encodeURIComponent(k)}.json?auth=${encodeURIComponent(token)}`, {
        method: 'PUT',
        body: JSON.stringify(val),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`RTDB_IMG_${r.status}: ${txt.slice(0, 120)}`);
      }
      imgCache.set(k, val);
      setKv('img_' + k, val);
    }

    const rData = await fetch(`${base}data.json?auth=${encodeURIComponent(token)}`, {
      method: 'PUT',
      body: JSON.stringify({ ts, json: JSON.stringify(catalog) }),
    });
    if (!rData.ok) {
      const txt = await rData.text().catch(() => '');
      throw new Error(`RTDB_DATA_${rData.status}: ${txt.slice(0, 120)}`);
    }

    // Best-effort cleanup of unused images
    try {
      const shallowRes = await fetch(`${base}img.json?shallow=true&auth=${encodeURIComponent(token)}`);
      if (shallowRes.ok) {
        const existing = await shallowRes.json();
        if (existing && typeof existing === 'object') {
          for (const id of Object.keys(existing)) {
            if (!used.has(id)) {
              fetch(`${base}img/${encodeURIComponent(id)}.json?auth=${encodeURIComponent(token)}`, {
                method: 'DELETE',
              }).catch(() => {});
              imgCache.delete(id);
            }
          }
        }
      }
    } catch {
      // ignore cleanup failures
    }
  } else {
    for (const [k, val] of Object.entries(pendingImgs || {})) {
      if (used.has(k) && val) {
        imgCache.set(k, val);
        setKv('img_' + k, val);
      }
    }
  }

  const snapshot = { ts, data: catalog };
  catalogCache = snapshot;
  catalogCacheAt = Date.now();
  setKv('catalog_snapshot', snapshot);
  return snapshot;
}
