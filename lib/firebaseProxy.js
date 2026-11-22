import { updateAdminFirebaseTokens } from './db.js';
import {
  callGemini,
  DEFAULT_FIREBASE_CONFIG,
  fetchImageAsset as coreFetchImageAsset,
  fetchRawCatalog as coreFetchRawCatalog,
  firebaseSignIn as coreFirebaseSignIn,
  getStoreGeminiKey as coreGetStoreGeminiKey,
  invalidateCatalogCache,
  publishCatalogToFirebase as corePublishCatalogToFirebase,
  refreshFirebaseToken,
  resolveFirebaseWebConfig,
  sanitizeCatalogForCustomer as coreSanitizeCatalogForCustomer,
  setCatalogCache,
} from './firebaseCatalogCore.js';

const FIREBASE_DB_HOST =
  process.env.FIREBASE_DB_HOST ||
  DEFAULT_FIREBASE_CONFIG.databaseURL.replace(/^https?:\/\//, '');
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey;
const RTDB_CREDS = {
  dbSecret: process.env.FIREBASE_DB_SECRET || '',
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
};

export {
  callGemini,
  invalidateCatalogCache,
  resolveFirebaseWebConfig,
  setCatalogCache,
};

export async function fetchRawCatalog(force = false) {
  return coreFetchRawCatalog({
    dbHost: FIREBASE_DB_HOST,
    force,
    ...RTDB_CREDS,
  });
}

export function sanitizeCatalogForCustomer(rawCatalog) {
  return coreSanitizeCatalogForCustomer(
    rawCatalog,
    process.env.GEMINI_API_KEY || ''
  );
}

export async function getStoreGeminiKey() {
  return coreGetStoreGeminiKey({
    dbHost: FIREBASE_DB_HOST,
    envGeminiKey: process.env.GEMINI_API_KEY || '',
    ...RTDB_CREDS,
  });
}

export async function fetchImageAsset(id) {
  return coreFetchImageAsset({
    dbHost: FIREBASE_DB_HOST,
    id,
    ...RTDB_CREDS,
  });
}

export async function firebaseSignIn(email, password) {
  return coreFirebaseSignIn({ apiKey: FIREBASE_API_KEY, email, password });
}

export async function ensureFreshAdminFirebaseToken(adminSession) {
  if (
    adminSession.fb_id_token &&
    Date.now() < Number(adminSession.fb_expires_at) - 120000
  ) {
    return adminSession.fb_id_token;
  }

  const refreshed = await refreshFirebaseToken({
    apiKey: FIREBASE_API_KEY,
    refreshToken: adminSession.fb_refresh_token,
  });

  updateAdminFirebaseTokens(
    adminSession.token_hash,
    refreshed.idToken,
    refreshed.refreshToken,
    refreshed.expiresIn
  );

  return refreshed.idToken;
}

export async function publishCatalogToFirebase(
  adminSession,
  dataObj,
  pendingImages = {}
) {
  const idToken = await ensureFreshAdminFirebaseToken(adminSession);
  return corePublishCatalogToFirebase({
    dbHost: FIREBASE_DB_HOST,
    idToken,
    dataObj,
    pendingImages,
  });
}
