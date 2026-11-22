import { getServiceAccountAccessToken } from './cryptoWeb.js';
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

export function resolveFirebaseWebConfig(env = {}) {
  const dbHost =
    env.FIREBASE_DB_HOST || DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
  return {
    apiKey: env.FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: env.FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    databaseURL: `https://${dbHost}`,
    projectId: env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: env.FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      env.FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: env.FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    measurementId: env.FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId,
  };
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
      return '';
    }
  }
  if (dbSecret) {
    return `?auth=${encodeURIComponent(dbSecret)}`;
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

  const used = new Set();
  (dataObj.p || []).forEach((p) => {
    if (p[8]) used.add(p[8]);
  });
  (dataObj.offers || []).forEach((o) => {
    if (o.i) used.add(o.i);
  });
  if (dataObj.cfg?.logo) used.add(dataObj.cfg.logo);
  if (dataObj.cfg?.fontBodyId) used.add(dataObj.cfg.fontBodyId);
  if (dataObj.cfg?.fontHeadId) used.add(dataObj.cfg.fontHeadId);

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

export async function callGemini({
  apiKey,
  prompt,
  audioBase64 = null,
  preferredModel = '',
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('KEY');
    err.status = 400;
    throw err;
  }

  const base = 'https://generativelanguage.googleapis.com/v1beta/';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  const tried = new Set();

  async function tryModel(modelName, isAudio) {
    if (!modelName || tried.has(modelName)) return null;
    tried.add(modelName);

    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), isAudio ? 25000 : 18000);
    try {
      const parts = isAudio
        ? [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: audioBase64 } }]
        : [{ text: prompt }];
      const generationConfig = isAudio
        ? { temperature: 0 }
        : { temperature: 0.15, responseMimeType: 'application/json' };

      const res = await fetch(
        `${base}models/${encodeURIComponent(modelName)}:generateContent`,
        {
          method: 'POST',
          headers,
          signal: ac.signal,
          body: JSON.stringify({ contents: [{ parts }], generationConfig }),
        }
      );

      if (res.ok) {
        const d = await res.json();
        const c = d.candidates && d.candidates[0];
        const t = c?.content?.parts
          ? c.content.parts.map((p) => p.text || '').join('')
          : '';
        if (t || isAudio) return { text: t, model: modelName };
        return null;
      }

      if (res.status === 429) throw new Error('LIMIT');
      const bodyText = await res.text().catch(() => '');
      if (res.status === 403 || /API key|API_KEY/i.test(bodyText)) {
        throw new Error('KEY');
      }
      return null;
    } finally {
      clearTimeout(tm);
    }
  }

  const candidates = [];
  if (preferredModel) candidates.push(preferredModel);
  candidates.push(
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  );

  const isAudio = Boolean(audioBase64);
  for (const m of candidates) {
    const out = await tryModel(m, isAudio);
    if (out !== null) return out;
  }

  const listRes = await fetch(`${base}models?pageSize=200`, { headers });
  if (listRes.ok) {
    const ld = await listRes.json();
    const ns = (ld.models || [])
      .filter(
        (m) =>
          (m.supportedGenerationMethods || []).includes('generateContent') &&
          /flash/i.test(m.name) &&
          !/image|tts|live|audio|embed|exp|robotics|computer/i.test(m.name)
      )
      .map((m) => m.name.replace('models/', ''))
      .sort((a, b) => (/2\.5/.test(b) ? 1 : 0) - (/2\.5/.test(a) ? 1 : 0));

    for (let i = 0; i < ns.length && i < 4; i++) {
      const out = await tryModel(ns[i], isAudio);
      if (out !== null) return out;
    }
  }

  throw new Error('NOMODEL');
}
