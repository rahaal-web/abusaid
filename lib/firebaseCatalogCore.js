import {
  getServiceAccountAccessToken,
  parseServiceAccountInput,
} from './cryptoWeb.js';
import { DEFAULT_DATA } from './defaultData.js';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB4r_lzcpX_F9L0WayaqyGNG01qgFG8jr0',
  authDomain: 'abu-saied-a6b74.firebaseapp.com',
  databaseURL: 'https://abu-saied-a6b74-default-rtdb.firebaseio.com',
  projectId: 'abu-saied-a6b74',
  storageBucket: 'abu-saied-a6b74.firebasestorage.app',
  messagingSenderId: '300635263769',
  appId: '1:300635263769:web:3190483c3ee276fa0cab88',
  measurementId: 'G-CWD4LZGQE7',
};

export function getServiceAccountFromEnv(env = {}) {
  return env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
}

export function normalizeDbHost(rawHost, fallbackProjectId = '') {
  let s = String(rawHost || '').trim();
  if (s) {
    s = s.replace(/^https?:\/\//i, '').split('/')[0].trim();
    if (s && !s.includes('.')) {
      s = `${s}-default-rtdb.firebaseio.com`;
    }
    if (s) return s;
  }
  const pid = String(fallbackProjectId || '').trim();
  if (pid && pid !== DEFAULT_FIREBASE_CONFIG.projectId) {
    return `${pid}-default-rtdb.firebaseio.com`;
  }
  return DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
}

export function resolveFirebaseWebConfig(env = {}) {
  const sa = parseServiceAccountInput(getServiceAccountFromEnv(env));
  const projectId =
    String(env.FIREBASE_PROJECT_ID || '').trim() ||
    (sa && sa.project_id ? String(sa.project_id).trim() : '') ||
    DEFAULT_FIREBASE_CONFIG.projectId;
  const dbHost = normalizeDbHost(env.FIREBASE_DB_HOST, projectId);
  return {
    apiKey: String(env.FIREBASE_API_KEY || '').trim() || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain:
      String(env.FIREBASE_AUTH_DOMAIN || '').trim() ||
      `${projectId}.firebaseapp.com`,
    databaseURL: `https://${dbHost}`,
    projectId,
    storageBucket:
      String(env.FIREBASE_STORAGE_BUCKET || '').trim() ||
      DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      String(env.FIREBASE_MESSAGING_SENDER_ID || '').trim() ||
      DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: String(env.FIREBASE_APP_ID || '').trim() || DEFAULT_FIREBASE_CONFIG.appId,
    measurementId:
      String(env.FIREBASE_MEASUREMENT_ID || '').trim() ||
      DEFAULT_FIREBASE_CONFIG.measurementId,
  };
}

export async function lookupFirebaseIdToken({ apiKey, idToken }) {
  const key = String(apiKey || '').trim() || DEFAULT_FIREBASE_CONFIG.apiKey;
  const tok = String(idToken || '').trim();
  if (!tok) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        key
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: tok }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const u = Array.isArray(data?.users) ? data.users[0] : null;
    if (!u || !u.localId || u.disabled) return null;
    return {
      uid: u.localId,
      email: u.email || '',
      emailVerified: Boolean(u.emailVerified),
    };
  } catch {
    return null;
  }
}

let catalogCache = null;
let catalogCacheAt = 0;
const CATALOG_TTL_MS = 30 * 1000;

const imageCache = new Map();
const MAX_IMG_CACHE = 300;

async function buildOptionalRtdbAuthQuery({ dbSecret, serviceAccountJson } = {}) {
  if (serviceAccountJson) {
    try {
      const tok = await getServiceAccountAccessToken(serviceAccountJson);
      return `?access_token=${encodeURIComponent(tok)}`;
    } catch {
      // fall through to dbSecret
    }
  }
  const secret = String(dbSecret || '').trim();
  if (secret) {
    return `?auth=${encodeURIComponent(secret)}`;
  }
  return '';
}

export function invalidateCatalogCache() {
  catalogCache = null;
  catalogCacheAt = 0;
}

export function setCatalogCache(ts, dataObj) {
  catalogCache = {
    ts: Number(ts) || Date.now(),
    data: dataObj,
  };
  catalogCacheAt = Date.now();
}

export async function fetchRawCatalog({
  dbHost,
  force = false,
  dbSecret = '',
  serviceAccountJson = '',
} = {}) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  if (!force && catalogCache && Date.now() - catalogCacheAt < CATALOG_TTL_MS) {
    return catalogCache;
  }

  try {
    const authQ = await buildOptionalRtdbAuthQuery({ dbSecret, serviceAccountJson });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://${host}/chips/data.json${authQ}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload && payload.json) {
          const parsed = JSON.parse(payload.json);
          catalogCache = {
            ts: Number(payload.ts) || Date.now(),
            data: parsed,
          };
          catalogCacheAt = Date.now();
          return catalogCache;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // fallback below
  }

  if (catalogCache) return catalogCache;

  return {
    ts: 1,
    data: JSON.parse(JSON.stringify(DEFAULT_DATA)),
  };
}

export function sanitizeCatalogForCustomer(rawCatalog, envGeminiKey = '') {
  const clone = JSON.parse(JSON.stringify(rawCatalog.data || DEFAULT_DATA));
  if (clone.cfg && typeof clone.cfg === 'object') {
    const hasKey = Boolean(
      (clone.cfg.gk && String(clone.cfg.gk).trim()) || envGeminiKey
    );
    delete clone.cfg.gk;
    clone.cfg.hasAiKey = hasKey;
  }
  return {
    ts: rawCatalog.ts,
    json: JSON.stringify(clone),
  };
}

export async function getStoreGeminiKey({
  dbHost,
  envGeminiKey = '',
  dbSecret = '',
  serviceAccountJson = '',
} = {}) {
  const raw = await fetchRawCatalog({
    dbHost,
    force: false,
    dbSecret,
    serviceAccountJson,
  });
  const cfgKey = raw?.data?.cfg?.gk ? String(raw.data.cfg.gk).trim() : '';
  return cfgKey || envGeminiKey || '';
}

export async function fetchImageAsset({
  dbHost,
  id,
  dbSecret = '',
  serviceAccountJson = '',
}) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  const safeId = String(id || '').trim();
  if (!safeId || safeId.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(safeId)) {
    return null;
  }
  if (imageCache.has(safeId)) {
    return imageCache.get(safeId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const authQ = await buildOptionalRtdbAuthQuery({ dbSecret, serviceAccountJson });
    const res = await fetch(
      `https://${host}/chips/img/${encodeURIComponent(safeId)}.json${authQ}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const val = await res.json();
    if (val) {
      if (imageCache.size >= MAX_IMG_CACHE) {
        const firstKey = imageCache.keys().next().value;
        imageCache.delete(firstKey);
      }
      imageCache.set(safeId, val);
    }
    return val || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function collectReferencedAssetIds(dataObj = {}) {
  const used = new Set();
  (dataObj.p || []).forEach((p) => {
    if (p && p[8]) used.add(p[8]);
  });
  (dataObj.offers || []).forEach((o) => {
    if (o && o.i) used.add(o.i);
  });
  if (dataObj.catMeta && typeof dataObj.catMeta === 'object') {
    Object.values(dataObj.catMeta).forEach((m) => {
      if (m && m.imageId) used.add(m.imageId);
    });
  }
  if (dataObj.cfg?.logo) used.add(dataObj.cfg.logo);
  if (dataObj.cfg?.fontBodyId) used.add(dataObj.cfg.fontBodyId);
  if (dataObj.cfg?.fontHeadId) used.add(dataObj.cfg.fontHeadId);
  if (dataObj.cfg?.dailyDealImgId) used.add(dataObj.cfg.dailyDealImgId);
  return used;
}

export async function listImageKeys({
  dbHost,
  dbSecret = '',
  serviceAccountJson = '',
  idToken = '',
} = {}) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  let authQ = await buildOptionalRtdbAuthQuery({ dbSecret, serviceAccountJson });
  if (!authQ && idToken) authQ = `?auth=${encodeURIComponent(idToken)}`;
  const sep = authQ ? '&' : '?';
  const res = await fetch(`https://${host}/chips/img.json${authQ}${sep}shallow=true`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data);
}

export async function deleteImageAsset({ dbHost, idToken, id }) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  const safeId = String(id || '').trim();
  if (!safeId || safeId.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(safeId)) {
    throw new Error('INVALID_ASSET_ID');
  }
  const res = await fetch(
    `https://${host}/chips/img/${encodeURIComponent(safeId)}.json?auth=${encodeURIComponent(idToken)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = new Error(`Firebase DELETE failed (${res.status})`);
    if (res.status === 401 || res.status === 403) err.status = 401;
    throw err;
  }
  imageCache.delete(safeId);
  return true;
}

export async function pingCatalogRtdb({
  dbHost,
  dbSecret = '',
  serviceAccountJson = '',
} = {}) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const authQ = await buildOptionalRtdbAuthQuery({ dbSecret, serviceAccountJson });
    const res = await fetch(`https://${host}/chips/data/ts.json${authQ}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs: Date.now() - started };
    }
    const ts = await res.json().catch(() => null);
    return {
      ok: true,
      latencyMs: Date.now() - started,
      ts: Number(ts) || null,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.message || 'network_error',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function firebaseSignIn({ apiKey, email, password }) {
  const key = apiKey || DEFAULT_FIREBASE_CONFIG.apiKey;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      key
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(email || '').trim(),
        password: String(password || ''),
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    const msg = data?.error?.message || 'INVALID_CREDENTIALS';
    const err = new Error(msg);
    err.status = 401;
    throw err;
  }
  return {
    email: data.email || String(email).trim(),
    uid: data.localId || '',
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: Number(data.expiresIn) || 3600,
  };
}

export async function refreshFirebaseToken({ apiKey, refreshToken }) {
  const key = apiKey || DEFAULT_FIREBASE_CONFIG.apiKey;
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
        String(refreshToken || '')
      )}`,
    }
  );
  const data = await res.json();
  if (!res.ok || !data.id_token) {
    const err = new Error('ADMIN_FB_REFRESH_FAILED');
    err.status = 401;
    throw err;
  }
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: Number(data.expires_in) || 3600,
  };
}

async function firebasePut(dbHost, urlPath, idToken, bodyStr) {
  const res = await fetch(
    `https://${dbHost}/chips/${urlPath}?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`Firebase PUT failed (${res.status}): ${txt.slice(0, 120)}`);
    if (res.status === 401 || res.status === 403) err.status = 401;
    throw err;
  }
  return res;
}

export async function publishCatalogToFirebase({
  dbHost,
  idToken,
  dataObj,
  pendingImages = {},
}) {
  const host =
    dbHost || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');

  const used = collectReferencedAssetIds(dataObj);

  for (const [imgId, imgData] of Object.entries(pendingImages || {})) {
    if (used.has(imgId) && imgData) {
      await firebasePut(
        host,
        `img/${encodeURIComponent(imgId)}.json`,
        idToken,
        JSON.stringify(imgData)
      );
      imageCache.set(imgId, imgData);
    }
  }

  const ts = Date.now();
  await firebasePut(
    host,
    'data.json',
    idToken,
    JSON.stringify({ ts, json: JSON.stringify(dataObj) })
  );

  setCatalogCache(ts, dataObj);

  try {
    const shallowRes = await fetch(
      `https://${host}/chips/img.json?shallow=true&auth=${encodeURIComponent(idToken)}`
    );
    if (shallowRes.ok) {
      const existing = await shallowRes.json();
      for (const id of Object.keys(existing || {})) {
        if (!used.has(id)) {
          fetch(
            `https://${host}/chips/img/${encodeURIComponent(
              id
            )}.json?auth=${encodeURIComponent(idToken)}`,
            { method: 'DELETE' }
          ).catch(() => {});
          imageCache.delete(id);
        }
      }
    }
  } catch {
    // non-fatal cleanup
  }

  return ts;
}

const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);

export async function callGemini({
  apiKey,
  prompt,
  systemInstruction = '',
  audioBase64 = null,
  preferredModel = '',
  responseSchema = null,
  temperature = null,
  taskType = 'general',
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('KEY');
    err.status = 400;
    throw err;
  }

  const base = 'https://generativelanguage.googleapis.com/v1beta/';
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
    'User-Agent': 'aistudio-build',
  };
  const tried = new Set();

  async function tryModel(modelName, isAudio) {
    const cleanModel = String(modelName || '').trim().replace(/^models\//, '');
    if (!cleanModel || DEPRECATED_GEMINI_MODELS.has(cleanModel.toLowerCase()) || tried.has(cleanModel)) {
      return null;
    }
    tried.add(cleanModel);

    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      const ac = new AbortController();
      const tm = setTimeout(() => ac.abort(), isAudio ? 25000 : 18000);
      try {
        const parts = isAudio
          ? [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: audioBase64 } }]
          : [{ text: prompt }];
        const generationConfig = isAudio
          ? { temperature: 0 }
          : {
              temperature:
                temperature != null && Number.isFinite(Number(temperature))
                  ? Math.max(0, Math.min(1, Number(temperature)))
                  : 0.1,
              responseMimeType: 'application/json',
            };
        if (!isAudio && responseSchema && typeof responseSchema === 'object') {
          generationConfig.responseSchema = responseSchema;
        }

        const payload = { contents: [{ parts }], generationConfig };
        if (systemInstruction) {
          payload.systemInstruction = { parts: [{ text: String(systemInstruction) }] };
        }

        const res = await fetch(
          `${base}models/${encodeURIComponent(cleanModel)}:generateContent`,
          {
            method: 'POST',
            headers,
            signal: ac.signal,
            body: JSON.stringify(payload),
          }
        );

        const latencyMs = Date.now() - started;
        if (res.ok) {
          const d = await res.json();
          const c = d.candidates && d.candidates[0];
          const t = c?.content?.parts
            ? c.content.parts.map((p) => p.text || '').join('')
            : '';
          if (t || isAudio) {
            console.info('[ai-diag]', JSON.stringify({ event: 'ok', taskType, model: cleanModel, latencyMs }));
            return { text: t, model: cleanModel };
          }
          return null;
        }

        const bodyText = await res.text().catch(() => '');
        console.warn('[ai-diag]', JSON.stringify({ event: 'error', taskType, model: cleanModel, status: res.status, latencyMs }));

        if (res.status === 429) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }
          throw new Error('LIMIT');
        }
        if (res.status === 403 || res.status === 401 || /API key|API_KEY/i.test(bodyText)) {
          throw new Error('KEY');
        }
        if (res.status >= 500 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        return null;
      } catch (err) {
        if (err?.message === 'LIMIT' || err?.message === 'KEY') throw err;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        return null;
      } finally {
        clearTimeout(tm);
      }
    }
    return null;
  }

  const isAudio = Boolean(audioBase64);
  const candidates = [];
  if (preferredModel) candidates.push(preferredModel);
  if (isAudio) {
    candidates.push('gemini-3.5-transcribe', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite');
  } else {
    candidates.push('gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash');
  }

  for (const m of candidates) {
    const out = await tryModel(m, isAudio);
    if (out !== null) return out;
  }

  throw new Error('NOMODEL');
}
