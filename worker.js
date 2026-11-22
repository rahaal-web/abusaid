import {
  base64UrlToBytes,
  bytesToBase64Url,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  verifyFirebaseIdToken,
} from './lib/cryptoWeb.js';
import {
  callGemini,
  collectReferencedAssetIds,
  deleteImageAsset as coreDeleteImageAsset,
  fetchImageAsset,
  fetchRawCatalog,
  firebaseSignIn,
  getServiceAccountFromEnv,
  getStoreGeminiKey,
  listImageKeys as coreListImageKeys,
  lookupFirebaseIdToken,
  pingCatalogRtdb as corePingCatalogRtdb,
  publishCatalogToFirebase,
  refreshFirebaseToken,
  resolveFirebaseWebConfig,
  sanitizeCatalogForCustomer,
} from './lib/firebaseCatalogCore.js';
import { createRtdbAuthStore } from './lib/rtdbAuthStore.js';
import {
  computePushOverview,
  detectDeviceLabel,
  executeAdminPushBroadcast,
  listPushDevices,
  resolveVapidEnv,
  validatePushSubscriptionInput,
} from './lib/pushService.js';
import {
  buildAuthoritativeOrder,
  VALID_ORDER_STATUSES,
} from './lib/orderService.js';

const USER_COOKIE = 'abu_session';
const STATUS_COOKIE = 'abu_status_token';
const ADMIN_COOKIE = 'abu_admin_session';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PROTECTED_STORE_PATHS = new Set([
  '/',
  '/index.html',
  '/styles/store.css',
  '/js/main.js',
  '/js/store.js',
  '/js/cart.js',
  '/js/offers.js',
  '/js/ai.js',
  '/js/data.js',
  '/js/router.js',
  '/js/state.js',
  '/js/utils.js',
  '/js/firebase-client.js',
  '/js/push.js',
  '/js/orders.js',
]);

const PUBLIC_ASSET_PATHS = new Set([
  '/styles/auth.css',
  '/js/auth.js',
  '/js/logo-data.js',
  '/js/pwa.js',
  '/sw.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]);

const BLOCKED_PREFIXES = ['/lib/', '/data/', '/protected/', '/public/', '/.'];
const BLOCKED_EXACT = new Set([
  '/server.js',
  '/worker.js',
  '/wrangler.jsonc',
  '/wrangler.toml',
  '/package.json',
  '/package-lock.json',
  '/bun.lock',
  '/database.rules.json',
  '/README.md',
]);

function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    try {
      cookies[k] = decodeURIComponent(v);
    } catch {
      cookies[k] = v;
    }
  });
  return cookies;
}

function isHttpsRequest(req, url) {
  if (url.protocol === 'https:') return true;
  const proto = String(req.headers.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'https';
}

function buildCookieString(req, url, name, value, maxAgeSec) {
  const secure = isHttpsRequest(req, url);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
  ];
  if (maxAgeSec !== null && maxAgeSec !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
  }
  parts.push(secure ? 'SameSite=None' : 'SameSite=Lax');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function noStoreHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    ...extra,
  };
}

function jsonResponse(data, status = 200, setCookies = []) {
  const headers = new Headers(
    noStoreHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
  );
  setCookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(JSON.stringify(data), { status, headers });
}

function redirectResponse(location, setCookies = []) {
  const headers = new Headers(noStoreHeaders({ Location: location }));
  setCookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers });
}

function wantsHtml(req, pathname) {
  if (pathname.startsWith('/api/')) return false;
  if (/\.(js|css|json|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/i.test(pathname)) {
    return false;
  }
  const accept = String(req.headers.get('accept') || '');
  return accept.includes('text/html') || pathname === '/' || pathname === '/index.html';
}

async function readJsonBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function serveAsset(env, req, assetPath, { noStore = false, setCookies = [] } = {}) {
  const assetUrl = new URL(assetPath, req.url);
  const assetRes = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
  if (!assetRes || assetRes.status === 404) {
    return new Response('Not found', { status: 404 });
  }
  const headers = new Headers(assetRes.headers);
  if (noStore) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    headers.set('Pragma', 'no-cache');
  }
  setCookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(assetRes.body, {
    status: assetRes.status,
    headers,
  });
}

function encodeAdminCookieToken(idToken, refreshToken) {
  return bytesToBase64Url(
    encoder.encode(JSON.stringify({ idToken, refreshToken }))
  );
}

function decodeAdminCookieToken(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decoder.decode(base64UrlToBytes(raw)));
    if (!obj || typeof obj.idToken !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

async function verifyAdminIdTokenAny(idToken, fbCfg) {
  try {
    const verified = await verifyFirebaseIdToken(idToken, fbCfg.projectId);
    if (verified && !verified.expired) {
      return { valid: true, email: verified.email, uid: verified.uid };
    }
    if (verified && verified.expired) {
      return { valid: false, expired: true };
    }
  } catch {
    // fall through to Firebase Auth lookup fallback
  }

  const lookedUp = await lookupFirebaseIdToken({
    apiKey: fbCfg.apiKey,
    idToken,
  });
  if (lookedUp && lookedUp.uid) {
    return { valid: true, email: lookedUp.email, uid: lookedUp.uid };
  }
  return { valid: false, expired: false };
}

async function resolveAdminSession(req, url, env, fbCfg) {
  const cookies = parseCookies(req);
  const raw = cookies[ADMIN_COOKIE];
  if (!raw) return { admin: null, setCookies: [] };

  const parsed = decodeAdminCookieToken(raw);
  if (!parsed) {
    return {
      admin: null,
      setCookies: [buildCookieString(req, url, ADMIN_COOKIE, '', 0)],
    };
  }

  const check = await verifyAdminIdTokenAny(parsed.idToken, fbCfg);
  if (check.valid) {
    return {
      admin: {
        email: check.email,
        uid: check.uid,
        idToken: parsed.idToken,
        refreshToken: parsed.refreshToken || '',
      },
      setCookies: [],
    };
  }

  if (parsed.refreshToken) {
    try {
      const refreshed = await refreshFirebaseToken({
        apiKey: fbCfg.apiKey,
        refreshToken: parsed.refreshToken,
      });
      const reCheck = await verifyAdminIdTokenAny(refreshed.idToken, fbCfg);
      if (reCheck.valid) {
        const nextCookie = buildCookieString(
          req,
          url,
          ADMIN_COOKIE,
          encodeAdminCookieToken(refreshed.idToken, refreshed.refreshToken),
          30 * 24 * 60 * 60
        );
        return {
          admin: {
            email: reCheck.email,
            uid: reCheck.uid,
            idToken: refreshed.idToken,
            refreshToken: refreshed.refreshToken,
          },
          setCookies: [nextCookie],
        };
      }
    } catch {
      // fall through to clear cookie
    }
  }

  return {
    admin: null,
    setCookies: [buildCookieString(req, url, ADMIN_COOKIE, '', 0)],
  };
}

async function requireApprovedUser(req, url, store) {
  const cookies = parseCookies(req);
  const token = cookies[USER_COOKIE];
  const session = token ? await store.getSessionWithUser(token, 'auth') : null;

  if (!session) {
    const clearAuth = token ? [buildCookieString(req, url, USER_COOKIE, '', 0)] : [];
    const statusToken = cookies[STATUS_COOKIE];
    const statusSess = statusToken
      ? await store.getSessionWithUser(statusToken, 'status')
      : null;

    if (wantsHtml(req, url.pathname)) {
      if (statusSess && statusSess.user && statusSess.user.status !== 'Approved') {
        return { ok: false, response: redirectResponse('/account-status', clearAuth) };
      }
      return { ok: false, response: redirectResponse('/login', clearAuth) };
    }
    return {
      ok: false,
      response: jsonResponse(
        {
          error: 'يجب تسجيل الدخول للوصول إلى هذا المحتوى.',
          code: 'UNAUTHENTICATED',
        },
        401,
        clearAuth
      ),
    };
  }

  if (session.user.status !== 'Approved') {
    await store.revokeSessionToken(token);
    const st = await store.createUserSession(
      session.user.id,
      'status',
      24 * 60 * 60 * 1000,
      1
    );
    const cookiesOut = [
      buildCookieString(req, url, USER_COOKIE, '', 0),
      buildCookieString(req, url, STATUS_COOKIE, st.rawToken, 24 * 60 * 60),
    ];

    if (wantsHtml(req, url.pathname)) {
      return { ok: false, response: redirectResponse('/account-status', cookiesOut) };
    }
    return {
      ok: false,
      response: jsonResponse(
        {
          error:
            session.user.status === 'Suspended'
              ? 'تم تعليق حسابك من قِبل الإدارة.'
              : session.user.status === 'Rejected'
              ? 'لم تتم الموافقة على حسابك.'
              : 'حسابك في انتظار موافقة الإدارة.',
          code: `ACCOUNT_${session.user.status.toUpperCase()}`,
          status: session.user.status,
          rejectionReason: session.user.rejectionReason || '',
        },
        403,
        cookiesOut
      ),
    };
  }

  return { ok: true, user: session.user, token, session };
}

function handleRtdbConfigError(err) {
  const code = err?.code || '';
  if (
    code === 'RTDB_NOT_CONFIGURED' ||
    code === 'RTDB_PERMISSION_DENIED' ||
    code === 'RTDB_HOST_NOT_FOUND' ||
    code === 'RTDB_UNREACHABLE'
  ) {
    const error =
      code === 'RTDB_HOST_NOT_FOUND'
        ? 'رابط قاعدة بيانات Firebase غير موجود. راجع قيمة FIREBASE_DB_HOST في Cloudflare Workers (مثل abu-saied-a6b74-default-rtdb.firebaseio.com).'
        : code === 'RTDB_UNREACHABLE'
        ? 'تعذر الاتصال بخادم Firebase Realtime Database، حاول مرة أخرى.'
        : code === 'RTDB_PERMISSION_DENIED'
        ? 'تعذر الوصول لمسار /abu_auth في Firebase Realtime Database باستخدام بيانات الاعتماد الحالية. تأكد من صلاحية FIREBASE_SERVICE_ACCOUNT أو FIREBASE_DB_SECRET في Cloudflare Workers.'
        : 'يرجى التأكد من تفعيل FIREBASE_SERVICE_ACCOUNT أو FIREBASE_DB_SECRET في إعدادات Cloudflare Workers لربط Firebase Realtime Database.';
    return jsonResponse(
      {
        needsRtdbSetup: true,
        error,
      },
      503
    );
  }
  return null;
}

function maskCatalogCfgForAdmin(dataObj, env = {}) {
  const clone = JSON.parse(JSON.stringify(dataObj || {}));
  clone.offers = Array.isArray(clone.offers) ? clone.offers : [];
  clone.cats = Array.isArray(clone.cats) ? clone.cats : [];
  clone.p = Array.isArray(clone.p) ? clone.p : [];
  if (!clone.cfg || typeof clone.cfg !== 'object') clone.cfg = {};
  const rawKey = clone.cfg.gk ? String(clone.cfg.gk).trim() : '';
  const envKey = String(env.GEMINI_API_KEY || '').trim();
  delete clone.cfg.gk;
  clone.cfg.hasGk = Boolean(rawKey || envKey);
  clone.cfg.gkFromEnv = Boolean(!rawKey && envKey);
  clone.cfg.gkLast4 = rawKey ? rawKey.slice(-4) : '';
  return clone;
}

function sanitizeBackupStats(dataObj = {}) {
  const used = collectReferencedAssetIds(dataObj);
  return {
    products: Array.isArray(dataObj.p) ? dataObj.p.length : 0,
    categories: Array.isArray(dataObj.cats) ? dataObj.cats.length : 0,
    offers: Array.isArray(dataObj.offers) ? dataObj.offers.length : 0,
    images: used.size,
  };
}

function buildAssetUsageMap(data = {}) {
  const usage = {};
  const addRef = (id, ref) => {
    if (!id) return;
    if (!usage[id]) usage[id] = [];
    usage[id].push(ref);
  };
  (data.p || []).forEach((p, idx) => {
    if (p && p[8]) addRef(p[8], { type: 'product', label: p[0] || `صنف #${idx + 1}`, index: idx });
  });
  (data.offers || []).forEach((o, idx) => {
    if (o && o.i) addRef(o.i, { type: 'offer', label: o.t || `عرض #${idx + 1}`, index: idx });
  });
  if (data.catMeta && typeof data.catMeta === 'object') {
    Object.entries(data.catMeta).forEach(([catName, meta]) => {
      if (meta && meta.imageId) addRef(meta.imageId, { type: 'category', label: catName });
    });
  }
  if (data.cfg?.logo) addRef(data.cfg.logo, { type: 'logo', label: 'شعار المتجر' });
  if (data.cfg?.fontBodyId) addRef(data.cfg.fontBodyId, { type: 'font', label: 'خط المتجر الأساسي' });
  if (data.cfg?.fontHeadId) addRef(data.cfg.fontHeadId, { type: 'font', label: 'خط العناوين' });
  return usage;
}

function inspectAssetPayload(id, dataUrl) {
  const raw = String(dataUrl || '');
  const mimeMatch = raw.match(/^data:([^;,]+)[;,]/i);
  const mime = mimeMatch
    ? mimeMatch[1].toLowerCase()
    : raw.startsWith('http')
    ? 'external/url'
    : 'application/octet-stream';
  const commaIdx = raw.indexOf(',');
  const b64Len = commaIdx >= 0 ? raw.length - commaIdx - 1 : raw.length;
  const sizeBytes =
    commaIdx >= 0 && raw.slice(0, commaIdx).includes('base64')
      ? Math.floor((b64Len * 3) / 4)
      : raw.length;
  const isFont = mime.includes('font') || String(id).startsWith('fnt_');
  return { mime, sizeBytes, isFont };
}

function safeAuditLog(store, entry, idToken = '') {
  try {
    const p = store.addAuditLog(entry, { adminIdToken: idToken || '' });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // non-fatal audit log
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    if (
      BLOCKED_EXACT.has(pathname) ||
      BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return new Response('Not found', { status: 404 });
    }

    const fbCfg = resolveFirebaseWebConfig(env);
    const dbHost = fbCfg.databaseURL.replace(/^https?:\/\//, '');
    const store = createRtdbAuthStore({
      ...env,
      FIREBASE_DB_HOST: dbHost,
    });

    // ==================== PUBLIC AUTH, PWA & PUSH IMAGE ASSETS ====================
    if (method === 'GET' && PUBLIC_ASSET_PATHS.has(pathname)) {
      const res = await serveAsset(env, req, pathname, {
        noStore: pathname === '/sw.js',
      });
      if (pathname === '/sw.js' && res.status === 200) {
        const headers = new Headers(res.headers);
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        headers.set('Service-Worker-Allowed', '/');
        headers.set('Cache-Control', 'no-cache');
        return new Response(res.body, { status: 200, headers });
      }
      if (pathname === '/manifest.webmanifest' && res.status === 200) {
        const headers = new Headers(res.headers);
        headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
        return new Response(res.body, { status: 200, headers });
      }
      return res;
    }

    if (method === 'GET' && pathname.startsWith('/push-img/')) {
      const imgId = decodeURIComponent(pathname.slice('/push-img/'.length));
      const img = await store.getPushImage(imgId);
      if (!img || !img.base64 || !/^image\/(png|jpeg|webp|gif)$/i.test(img.mime || '')) {
        return new Response('Not found', { status: 404 });
      }
      try {
        const bin = atob(img.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': img.mime,
            'Cache-Control': 'public, max-age=604800',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    if (method === 'GET' && (pathname === '/login' || pathname === '/login.html')) {
      try {
        const cookies = parseCookies(req);
        const sess = cookies[USER_COOKIE]
          ? await store.getSessionWithUser(cookies[USER_COOKIE], 'auth')
          : null;
        if (sess && sess.user.status === 'Approved') {
          return redirectResponse('/');
        }
      } catch {
        // show login page if store isn't configured yet
      }
      return serveAsset(env, req, '/public/auth/login.html', { noStore: true });
    }

    if (method === 'GET' && (pathname === '/register' || pathname === '/register.html')) {
      try {
        const cookies = parseCookies(req);
        const sess = cookies[USER_COOKIE]
          ? await store.getSessionWithUser(cookies[USER_COOKIE], 'auth')
          : null;
        if (sess && sess.user.status === 'Approved') {
          return redirectResponse('/');
        }
      } catch {
        // show register page
      }
      return serveAsset(env, req, '/public/auth/register.html', { noStore: true });
    }

    if (method === 'GET' && (pathname === '/account-status' || pathname === '/status')) {
      const cookies = parseCookies(req);
      let authSess = null;
      let statusSess = null;
      try {
        if (cookies[USER_COOKIE]) {
          authSess = await store.getSessionWithUser(cookies[USER_COOKIE], 'auth');
        }
        if (authSess && authSess.user.status === 'Approved') {
          return redirectResponse('/');
        }
        if (cookies[STATUS_COOKIE]) {
          statusSess = await store.getSessionWithUser(cookies[STATUS_COOKIE], 'status');
        }
      } catch {
        return redirectResponse('/login');
      }
      if (!statusSess && !authSess) {
        return redirectResponse('/login');
      }
      return serveAsset(env, req, '/public/auth/status.html', { noStore: true });
    }

    // ==================== CUSTOMER AUTH APIs ====================
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = (await readJsonBody(req)) || {};
      const fullName = String(body.fullName || '').trim();
      const phone = normalizePhone(body.phone);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');
      const shopName = String(body.shopName || '').trim();
      const address = String(body.address || '').trim();

      if (fullName.length < 3 || fullName.length > 100) {
        return jsonResponse({ error: 'يرجى إدخال الاسم بالكامل (من ٣ إلى ١٠٠ حرف).' }, 400);
      }
      if (!isValidPhone(phone)) {
        return jsonResponse({ error: 'يرجى إدخال رقم هاتف صحيح (من ١٠ إلى ١٥ رقم).' }, 400);
      }
      if (email && !isValidEmail(email)) {
        return jsonResponse({ error: 'صيغة البريد الإلكتروني غير صحيحة.' }, 400);
      }
      if (password.length < 6 || password.length > 128) {
        return jsonResponse(
          { error: 'كلمة المرور يجب أن تكون ٦ أحرف أو أرقام على الأقل.' },
          400
        );
      }
      if (password !== confirmPassword) {
        return jsonResponse({ error: 'كلمتا المرور غير متطابقتين.' }, 400);
      }

      try {
        if (await store.findUserByPhone(phone)) {
          return jsonResponse({ error: 'رقم الهاتف مسجل بالفعل في النظام.' }, 409);
        }
        if (email && (await store.findUserByEmail(email))) {
          return jsonResponse({ error: 'البريد الإلكتروني مستخدم بالفعل.' }, 409);
        }

        const created = await store.createUser({
          fullName,
          phone,
          email,
          shopName,
          address,
          password,
        });
        const statusSess = await store.createUserSession(
          created.id,
          'status',
          24 * 60 * 60 * 1000,
          1
        );

        return jsonResponse(
          {
            ok: true,
            message: 'تم إرسال طلب إنشاء حسابك بنجاح، وهو الآن قيد مراجعة الإدارة.',
            user: store.sanitizeUser(created),
          },
          201,
          [
            buildCookieString(req, url, USER_COOKIE, '', 0),
            buildCookieString(
              req,
              url,
              STATUS_COOKIE,
              statusSess.rawToken,
              24 * 60 * 60
            ),
          ]
        );
      } catch (err) {
        console.error('Register error:', err?.code || err?.message || err);
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        if (err?.code === 'DUPLICATE_PHONE') {
          return jsonResponse({ error: 'رقم الهاتف مسجل بالفعل في النظام.' }, 409);
        }
        if (err?.code === 'DUPLICATE_EMAIL') {
          return jsonResponse({ error: 'البريد الإلكتروني مستخدم بالفعل.' }, 409);
        }
        return jsonResponse(
          { error: 'حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى.' },
          500
        );
      }
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = (await readJsonBody(req)) || {};
      const identifier = String(
        body.identifier || body.phone || body.email || ''
      ).trim();
      const password = String(body.password || '');

      if (!identifier || !password) {
        return jsonResponse({ error: 'يرجى إدخال رقم الهاتف وكلمة المرور.' }, 400);
      }

      try {
        const user = await store.findUserByIdentifier(identifier);
        if (!user || !(await store.verifyPassword(password, user.passwordHash))) {
          return jsonResponse(
            {
              error: 'بيانات الدخول غير صحيحة، تأكد من رقم الهاتف وكلمة المرور.',
            },
            401
          );
        }

        if (user.status === 'Approved') {
          const rememberMe = body.rememberMe !== false;
          const ttlSec = 90 * 24 * 60 * 60;
          const ttlMs = rememberMe ? ttlSec * 1000 : 24 * 60 * 60 * 1000;
          const sess = await store.createUserSession(
            user.id,
            'auth',
            ttlMs,
            user.tokenVersion || 1
          );
          return jsonResponse(
            {
              ok: true,
              status: 'Approved',
              rememberMe,
              user: store.sanitizeUser(user),
            },
            200,
            [
              buildCookieString(req, url, STATUS_COOKIE, '', 0),
              buildCookieString(
                req,
                url,
                USER_COOKIE,
                sess.rawToken,
                rememberMe ? ttlSec : null
              ),
            ]
          );
        }

        const statusSess = await store.createUserSession(
          user.id,
          'status',
          24 * 60 * 60 * 1000,
          1
        );
        return jsonResponse(
          {
            ok: true,
            status: user.status,
            message:
              user.status === 'Pending'
                ? 'طلب إنشاء حسابك لا يزال قيد مراجعة الإدارة.'
                : user.status === 'Rejected'
                ? 'لم تتم الموافقة على طلب حسابك من قِبل الإدارة.'
                : 'تم تعليق حسابك من قِبل الإدارة.',
            user: store.sanitizeUser(user),
          },
          200,
          [
            buildCookieString(req, url, USER_COOKIE, '', 0),
            buildCookieString(
              req,
              url,
              STATUS_COOKIE,
              statusSess.rawToken,
              24 * 60 * 60
            ),
          ]
        );
      } catch (err) {
        console.error('Login error:', err?.code || err?.message || err);
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'حدث خطأ أثناء تسجيل الدخول.' }, 500);
      }
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const cookies = parseCookies(req);
      if (cookies[USER_COOKIE]) await store.revokeSessionToken(cookies[USER_COOKIE]);
      if (cookies[STATUS_COOKIE]) await store.revokeSessionToken(cookies[STATUS_COOKIE]);
      return jsonResponse({ ok: true }, 200, [
        buildCookieString(req, url, USER_COOKIE, '', 0),
        buildCookieString(req, url, STATUS_COOKIE, '', 0),
      ]);
    }

    if (method === 'GET' && pathname === '/api/auth/status') {
      try {
        const cookies = parseCookies(req);
        const authToken = cookies[USER_COOKIE];
        if (authToken) {
          const authSess = await store.getSessionWithUser(authToken, 'auth');
          if (authSess) {
            if (authSess.user.status === 'Approved') {
              return jsonResponse({
                authenticated: true,
                canEnterStore: true,
                user: authSess.user,
              });
            }
            await store.revokeSessionToken(authToken);
            const st = await store.createUserSession(
              authSess.user.id,
              'status',
              24 * 60 * 60 * 1000,
              1
            );
            return jsonResponse(
              {
                authenticated: false,
                canEnterStore: false,
                user: authSess.user,
              },
              200,
              [
                buildCookieString(req, url, USER_COOKIE, '', 0),
                buildCookieString(
                  req,
                  url,
                  STATUS_COOKIE,
                  st.rawToken,
                  24 * 60 * 60
                ),
              ]
            );
          }
        }

        const statusToken = cookies[STATUS_COOKIE];
        if (statusToken) {
          const statusSess = await store.getSessionWithUser(statusToken, 'status');
          if (statusSess) {
            return jsonResponse({
              authenticated: false,
              canEnterStore: false,
              user: statusSess.user,
            });
          }
        }
        return jsonResponse({ error: 'لا توجد جلسة نشطة.' }, 401);
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'لا توجد جلسة نشطة.' }, 401);
      }
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const sess = check.session;
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const remaining = Number(sess?.expiresAt || 0) - Date.now();
      const extraCookies = [];
      if (
        sess &&
        remaining > 2 * 24 * 60 * 60 * 1000 &&
        remaining < 45 * 24 * 60 * 60 * 1000 &&
        typeof store.extendUserSession === 'function'
      ) {
        await store.extendUserSession(check.token, ninetyDaysMs);
        extraCookies.push(
          buildCookieString(req, url, USER_COOKIE, check.token, 90 * 24 * 60 * 60)
        );
      }
      return jsonResponse({ authenticated: true, user: check.user }, 200, extraCookies);
    }

    // ==================== PROTECTED STOREFRONT ASSETS & APIs ====================
    if (method === 'GET' && PROTECTED_STORE_PATHS.has(pathname)) {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const target = pathname === '/' ? '/index.html' : pathname;
      return serveAsset(env, req, target, { noStore: true });
    }

    if (method === 'GET' && pathname === '/api/firebase-config') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      return jsonResponse({ config: fbCfg });
    }

    if (method === 'GET' && pathname === '/api/catalog') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      try {
        const raw = await fetchRawCatalog({
          dbHost,
          force: false,
          dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
          serviceAccountJson: getServiceAccountFromEnv(env),
        });
        return jsonResponse(
          sanitizeCatalogForCustomer(raw, env.GEMINI_API_KEY || '')
        );
      } catch {
        return jsonResponse({ error: 'تعذر تحميل بيانات الكتالوج حالياً.' }, 502);
      }
    }

    if (method === 'GET' && pathname.startsWith('/api/img/')) {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const id = decodeURIComponent(pathname.slice('/api/img/'.length));
      const val = await fetchImageAsset({
        dbHost,
        id,
        dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
        serviceAccountJson: getServiceAccountFromEnv(env),
      });
      return jsonResponse(val);
    }

    if (method === 'POST' && pathname === '/api/ai/generate') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;

      const body = (await readJsonBody(req)) || {};
      const prompt = String(body.prompt || '').trim();
      const audioBase64 = body.audioBase64 ? String(body.audioBase64) : null;
      const preferredModel = body.preferredModel ? String(body.preferredModel) : '';

      if (!prompt || prompt.length > 80000) {
        return jsonResponse({ error: 'Invalid prompt' }, 400);
      }
      if (audioBase64 && audioBase64.length > 10 * 1024 * 1024) {
        return jsonResponse({ error: 'Audio payload too large' }, 400);
      }

      try {
        const apiKey = await getStoreGeminiKey({
          dbHost,
          envGeminiKey: env.GEMINI_API_KEY || '',
          dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
          serviceAccountJson: getServiceAccountFromEnv(env),
        });
        if (!apiKey) return jsonResponse({ error: 'KEY' }, 503);
        const result = await callGemini({
          apiKey,
          prompt,
          audioBase64,
          preferredModel,
        });
        return jsonResponse(result);
      } catch (err) {
        const code = err?.message || 'AI_ERROR';
        const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
        return jsonResponse({ error: code }, status);
      }
    }

    // ==================== CUSTOMER ORDERS APIs ====================
    if (method === 'GET' && pathname === '/api/orders') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      try {
        const orders = await store.listUserOrders(check.user.id, 80);
        return jsonResponse({ orders });
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'تعذر تحميل سجل الطلبات حالياً.' }, 502);
      }
    }

    if (method === 'POST' && pathname === '/api/orders') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const body = (await readJsonBody(req)) || {};
      try {
        let rawCatalog = await fetchRawCatalog({
          dbHost,
          force: false,
          dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
          serviceAccountJson: getServiceAccountFromEnv(env),
        });
        let built = await buildAuthoritativeOrder({
          body,
          user: check.user,
          catalogData: rawCatalog?.data,
        });
        if (built.error) {
          rawCatalog = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          built = await buildAuthoritativeOrder({
            body,
            user: check.user,
            catalogData: rawCatalog?.data,
          });
        }
        if (built.error) {
          return jsonResponse({ error: built.error }, built.status || 400);
        }
        const saved = await store.createOrder(built.order);
        return jsonResponse(
          {
            ok: true,
            order: saved.order,
            deduplicated: Boolean(saved.deduplicated),
          },
          saved.deduplicated ? 200 : 201
        );
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'تعذر حفظ الطلب في قاعدة البيانات.' }, 502);
      }
    }

    // ==================== CUSTOMER WEB PUSH APIs ====================
    if (method === 'GET' && pathname === '/api/push/config') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const vapid = resolveVapidEnv(env);
      try {
        const userSubs = await store.listUserPushSubscriptions(check.user.id);
        return jsonResponse({
          configured: vapid.configured,
          publicKey: vapid.configured ? vapid.publicKey : '',
          subscribedEndpoints: userSubs.map((s) => s.endpoint),
          deviceCount: userSubs.length,
        });
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'تعذر جلب إعدادات الإشعارات.' }, 502);
      }
    }

    if (method === 'POST' && pathname === '/api/push/subscribe') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const body = (await readJsonBody(req)) || {};
      const parsed = validatePushSubscriptionInput(body.subscription || body);
      if (!parsed.valid) {
        return jsonResponse({ error: parsed.error }, 400);
      }
      const userAgent = req.headers.get('user-agent') || '';
      const deviceLabel = detectDeviceLabel(userAgent);
      try {
        const saved = await store.upsertPushSubscription({
          userId: check.user.id,
          phone: check.user.phone,
          fullName: check.user.fullName,
          shopName: check.user.shopName,
          address: check.user.address,
          subscription: parsed.subscription,
          userAgent,
          deviceLabel,
        });
        return jsonResponse({ ok: true, subscription: saved });
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'تعذر حفظ اشتراك الإشعارات.' }, 502);
      }
    }

    if (method === 'POST' && pathname === '/api/push/unsubscribe') {
      const check = await requireApprovedUser(req, url, store);
      if (!check.ok) return check.response;
      const body = (await readJsonBody(req)) || {};
      const endpoint = String(body.endpoint || '').trim();
      if (!endpoint) {
        return jsonResponse({ error: 'يرجى تحديد رابط الاشتراك.' }, 400);
      }
      try {
        const removed = await store.removePushSubscription({
          userId: check.user.id,
          endpoint,
        });
        return jsonResponse({ ok: true, removed });
      } catch (err) {
        const cfgErr = handleRtdbConfigError(err);
        if (cfgErr) return cfgErr;
        return jsonResponse({ error: 'تعذر إلغاء اشتراك الإشعارات.' }, 502);
      }
    }

    // ==================== ADMIN AUTH, ASSETS & MANAGEMENT APIs ====================
    if (method === 'GET' && (pathname === '/admin' || pathname === '/admin.html')) {
      return serveAsset(env, req, '/admin.html', { noStore: true });
    }

    if (method === 'POST' && pathname === '/api/admin/login') {
      const body = (await readJsonBody(req)) || {};
      const email = String(body.email || '').trim();
      const password = String(body.password || '');

      if (!email || !password) {
        return jsonResponse({ error: 'يرجى إدخال الإيميل وكلمة السر.' }, 400);
      }

      try {
        const fb = await firebaseSignIn({
          apiKey: fbCfg.apiKey,
          email,
          password,
        });
        const rememberMe = body.rememberMe !== false;
        const cookieVal = encodeAdminCookieToken(fb.idToken, fb.refreshToken);
        safeAuditLog(
          store,
          {
            action: 'admin_login',
            actorEmail: fb.email,
            entityType: 'system',
            entityId: fb.uid || fb.email,
            entityLabel: fb.email,
            details: 'تسجيل دخول ناجح إلى لوحة التحكم',
          },
          fb.idToken
        );
        return jsonResponse(
          { ok: true, email: fb.email },
          200,
          [
            buildCookieString(
              req,
              url,
              ADMIN_COOKIE,
              cookieVal,
              rememberMe ? 30 * 24 * 60 * 60 : null
            ),
          ]
        );
      } catch {
        return jsonResponse({ error: 'الإيميل أو كلمة السر غلط' }, 401);
      }
    }

    if (method === 'POST' && pathname === '/api/admin/logout') {
      return jsonResponse({ ok: true }, 200, [
        buildCookieString(req, url, ADMIN_COOKIE, '', 0),
      ]);
    }

    if (method === 'GET' && pathname === '/api/admin/me') {
      const { admin, setCookies } = await resolveAdminSession(req, url, env, fbCfg);
      if (!admin) {
        return jsonResponse({ authenticated: false }, 200, setCookies);
      }
      return jsonResponse({ authenticated: true, email: admin.email, uid: admin.uid || '' }, 200, setCookies);
    }

    if (
      pathname === '/admin-app.js' ||
      pathname === '/admin.css' ||
      pathname.startsWith('/api/admin/')
    ) {
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const originHdr = req.headers.get('origin');
        if (originHdr) {
          try {
            if (new URL(originHdr).host !== url.host) {
              return jsonResponse({ error: 'طلب غير مصرح به من مصدر خارجي.' }, 403);
            }
          } catch {
            return jsonResponse({ error: 'مصدر الطلب غير صالح.' }, 403);
          }
        }
      }

      const { admin, setCookies } = await resolveAdminSession(req, url, env, fbCfg);
      if (!admin) {
        return jsonResponse(
          {
            error: 'يجب تسجيل الدخول كمسؤول لإتمام هذه العملية.',
            code: 'ADMIN_UNAUTHENTICATED',
          },
          401,
          setCookies
        );
      }

      if (method === 'GET' && pathname === '/admin-app.js') {
        return serveAsset(env, req, '/protected/admin-app.js', {
          noStore: true,
          setCookies,
        });
      }

      if (method === 'GET' && pathname === '/admin.css') {
        return serveAsset(env, req, '/protected/admin.css', {
          noStore: true,
          setCookies,
        });
      }

      if (method === 'GET' && pathname === '/api/admin/bootstrap') {
        try {
          const raw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          const data = maskCatalogCfgForAdmin(raw.data || {}, env);
          const keys = collectReferencedAssetIds(data);

          const images = {};
          await Promise.all(
            [...keys].map(async (k) => {
              const v = await fetchImageAsset({
                dbHost,
                id: k,
                dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
                serviceAccountJson: getServiceAccountFromEnv(env),
              });
              if (v) images[k] = v;
            })
          );

          return jsonResponse({ ts: raw.ts, data, images }, 200, setCookies);
        } catch {
          return jsonResponse(
            { error: 'تعذر جلب بيانات المتجر من الخادم.' },
            502,
            setCookies
          );
        }
      }

      if (method === 'POST' && pathname === '/api/admin/publish') {
        const body = (await readJsonBody(req)) || {};
        const incomingData = body.data;
        const pendingImages = body.pendingImages || {};
        const auditSummary = String(body.auditSummary || '').trim().slice(0, 400);
        if (!incomingData || typeof incomingData !== 'object' || !Array.isArray(incomingData.p)) {
          return jsonResponse({ error: 'بيانات المتجر غير صالحة.' }, 400, setCookies);
        }
        try {
          const data = JSON.parse(JSON.stringify(incomingData));
          if (!data.cfg || typeof data.cfg !== 'object') data.cfg = {};

          const existingRaw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          }).catch(() => null);
          const existingGk = existingRaw?.data?.cfg?.gk ? String(existingRaw.data.cfg.gk).trim() : '';

          if (data.cfg.clearGk === true) {
            delete data.cfg.gk;
          } else if (typeof data.cfg.newGk === 'string' && data.cfg.newGk.trim()) {
            data.cfg.gk = data.cfg.newGk.trim();
          } else if (!data.cfg.gk && existingGk) {
            data.cfg.gk = existingGk;
          }

          delete data.cfg.hasGk;
          delete data.cfg.gkFromEnv;
          delete data.cfg.gkLast4;
          delete data.cfg.newGk;
          delete data.cfg.clearGk;

          data.cfg.lastPublishedAt = new Date().toISOString();
          data.cfg.lastPublishedBy = admin.email;

          const ts = await publishCatalogToFirebase({
            dbHost,
            idToken: admin.idToken,
            dataObj: data,
            pendingImages,
          });
          safeAuditLog(
            store,
            {
              action: 'catalog_publish',
              actorEmail: admin.email,
              entityType: 'catalog',
              entityId: String(ts),
              entityLabel: `نشر الكتالوج (${data.p.length} صنف / ${(data.offers || []).length} عرض)`,
              details: auditSummary || 'نشر تعديلات المتجر والأقسام والعروض',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true, ts, data: maskCatalogCfgForAdmin(data, env) }, 200, setCookies);
        } catch (err) {
          if (err?.status === 401) {
            return jsonResponse(
              { error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' },
              401,
              [buildCookieString(req, url, ADMIN_COOKIE, '', 0)]
            );
          }
          return jsonResponse(
            { error: err?.message || 'تعذر النشر' },
            502,
            setCookies
          );
        }
      }

      if (method === 'POST' && pathname === '/api/admin/ai/generate') {
        const body = (await readJsonBody(req)) || {};
        const prompt = String(body.prompt || '').trim();
        const audioBase64 = body.audioBase64 ? String(body.audioBase64) : null;
        const preferredModel = body.preferredModel ? String(body.preferredModel) : '';
        const overrideKey = body.apiKey ? String(body.apiKey).trim() : '';

        if (!prompt || prompt.length > 160000) {
          return jsonResponse({ error: 'Invalid prompt' }, 400, setCookies);
        }

        try {
          const apiKey =
            overrideKey ||
            (await getStoreGeminiKey({
              dbHost,
              envGeminiKey: env.GEMINI_API_KEY || '',
              dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
              serviceAccountJson: getServiceAccountFromEnv(env),
            }));
          if (!apiKey) return jsonResponse({ error: 'KEY' }, 400, setCookies);
          const result = await callGemini({
            apiKey,
            prompt,
            audioBase64,
            preferredModel,
          });
          return jsonResponse(result, 200, setCookies);
        } catch (err) {
          const code = err?.message || 'AI_ERROR';
          const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
          return jsonResponse({ error: code }, status, setCookies);
        }
      }

      if (method === 'GET' && pathname === '/api/admin/users') {
        try {
          const users = await store.listUsers({ adminIdToken: admin.idToken });
          const counts = {
            all: users.length,
            Pending: 0,
            Approved: 0,
            Rejected: 0,
            Suspended: 0,
          };
          users.forEach((u) => {
            if (counts[u.status] != null) counts[u.status] += 1;
          });
          return jsonResponse({ users, counts }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل الحسابات' }, 502, setCookies);
        }
      }

      const userActionMatch = pathname.match(
        /^\/api\/admin\/users\/([^/]+)\/(approve|activate|reject|suspend)$/
      );
      if (method === 'POST' && userActionMatch) {
        const uid = decodeURIComponent(userActionMatch[1]);
        const action = userActionMatch[2];
        const statusMap = {
          approve: 'Approved',
          activate: 'Approved',
          reject: 'Rejected',
          suspend: 'Suspended',
        };
        const body = action === 'reject' ? (await readJsonBody(req)) || {} : {};
        const reason = String(body.reason || '').trim().slice(0, 300);

        try {
          const updated = await store.updateUserStatus(
            uid,
            statusMap[action],
            {
              rejectionReason: reason || null,
              reviewedBy: admin.email,
            },
            { adminIdToken: admin.idToken }
          );
          if (!updated) {
            return jsonResponse({ error: 'المستخدم غير موجود.' }, 404, setCookies);
          }
          safeAuditLog(
            store,
            {
              action: `user_${action}`,
              actorEmail: admin.email,
              entityType: 'user',
              entityId: String(updated.id),
              entityLabel: updated.fullName || updated.phone,
              details: reason ? `${action}: ${reason}` : `تحديث حالة المستخدم (${action})`,
            },
            admin.idToken
          );
          return jsonResponse(
            { ok: true, user: store.sanitizeUser(updated) },
            200,
            setCookies
          );
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تنفيذ العملية' }, 502, setCookies);
        }
      }

      const userDeleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (method === 'DELETE' && userDeleteMatch) {
        const uid = decodeURIComponent(userDeleteMatch[1]);
        try {
          const ok = await store.deleteUserById(uid, {
            adminIdToken: admin.idToken,
          });
          if (!ok) {
            return jsonResponse({ error: 'المستخدم غير موجود.' }, 404, setCookies);
          }
          safeAuditLog(
            store,
            {
              action: 'user_delete',
              actorEmail: admin.email,
              entityType: 'user',
              entityId: uid,
              entityLabel: `مستخدم #${uid}`,
              details: 'حذف حساب عميل من النظام',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر حذف المستخدم' }, 502, setCookies);
        }
      }

      if (method === 'GET' && pathname === '/api/admin/orders') {
        try {
          const orders = await store.listAllOrders(150, {
            adminIdToken: admin.idToken,
          });
          const counts = {
            all: orders.length,
            sent_whatsapp: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
          };
          orders.forEach((o) => {
            if (counts[o.status] != null) counts[o.status] += 1;
          });
          return jsonResponse({ orders, counts }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل الطلبات.' }, 502, setCookies);
        }
      }

      const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
      if (method === 'POST' && orderStatusMatch) {
        const ordId = decodeURIComponent(orderStatusMatch[1]);
        const body = (await readJsonBody(req)) || {};
        const status = String(body.status || '').trim();
        if (!VALID_ORDER_STATUSES.includes(status)) {
          return jsonResponse({ error: 'حالة الطلب غير صالحة.' }, 400, setCookies);
        }
        try {
          const updated = await store.updateOrderStatus(ordId, status, {
            adminIdToken: admin.idToken,
          });
          if (!updated) {
            return jsonResponse({ error: 'الطلب غير موجود.' }, 404, setCookies);
          }
          safeAuditLog(
            store,
            {
              action: 'order_status_change',
              actorEmail: admin.email,
              entityType: 'order',
              entityId: String(updated.id),
              entityLabel: updated.userName || updated.shopName || updated.id,
              details: `تغيير حالة الطلب إلى ${status}`,
            },
            admin.idToken
          );
          return jsonResponse({ ok: true, order: updated }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحديث حالة الطلب.' }, 502, setCookies);
        }
      }

      if (method === 'GET' && pathname === '/api/admin/push/overview') {
        try {
          const vapid = resolveVapidEnv(env);
          const overview = await computePushOverview({
            store,
            vapid,
            adminIdToken: admin.idToken,
          });
          return jsonResponse(overview, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل بيانات الإشعارات.' }, 502, setCookies);
        }
      }

      if (method === 'GET' && pathname === '/api/admin/push/devices') {
        try {
          const devices = await listPushDevices({
            store,
            adminIdToken: admin.idToken,
          });
          return jsonResponse({ devices }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل قائمة الأجهزة المشتركة.' }, 502, setCookies);
        }
      }

      const pushDeviceDelMatch = pathname.match(/^\/api\/admin\/push\/devices\/([^/]+)$/);
      if (method === 'DELETE' && pushDeviceDelMatch) {
        const devId = decodeURIComponent(pushDeviceDelMatch[1]);
        try {
          const ok = await store.deletePushSubscriptionById(devId, {
            adminIdToken: admin.idToken,
          });
          if (!ok) {
            return jsonResponse({ error: 'الجهاز غير موجود.' }, 404, setCookies);
          }
          safeAuditLog(
            store,
            {
              action: 'push_device_remove',
              actorEmail: admin.email,
              entityType: 'push',
              entityId: devId,
              entityLabel: `جهاز #${devId}`,
              details: 'إزالة اشتراك جهاز من مركز الإشعارات',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر إزالة الجهاز.' }, 502, setCookies);
        }
      }

      if (method === 'DELETE' && pathname === '/api/admin/push/logs') {
        try {
          await store.clearPushLogs({
            adminIdToken: admin.idToken,
          });
          safeAuditLog(
            store,
            {
              action: 'push_logs_clear',
              actorEmail: admin.email,
              entityType: 'push',
              entityId: 'all',
              entityLabel: 'سجل الإشعارات',
              details: 'مسح جميع سجلات الإشعارات من مركز الإشعارات',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر مسح سجل الإشعارات.' }, 502, setCookies);
        }
      }

      const pushLogDelMatch = pathname.match(/^\/api\/admin\/push\/logs\/([^/]+)$/);
      if (method === 'DELETE' && pushLogDelMatch) {
        const logId = decodeURIComponent(pushLogDelMatch[1]);
        try {
          const ok = await store.deletePushLogById(logId, {
            adminIdToken: admin.idToken,
          });
          if (!ok) {
            return jsonResponse({ error: 'سجل الإشعار غير موجود.' }, 404, setCookies);
          }
          safeAuditLog(
            store,
            {
              action: 'push_log_delete',
              actorEmail: admin.email,
              entityType: 'push',
              entityId: logId,
              entityLabel: `سجل #${logId}`,
              details: 'حذف سجل إشعار من مركز الإشعارات',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر حذف سجل الإشعار.' }, 502, setCookies);
        }
      }

      if (method === 'POST' && pathname === '/api/admin/push/send') {
        const body = (await readJsonBody(req)) || {};
        const vapid = resolveVapidEnv(env);
        try {
          const result = await executeAdminPushBroadcast({
            store,
            vapid,
            origin: url.origin,
            adminEmail: admin.email,
            adminIdToken: admin.idToken,
            body,
          });
          safeAuditLog(
            store,
            {
              action: 'push_broadcast',
              actorEmail: admin.email,
              entityType: 'push',
              entityId: String(result?.log?.id || ''),
              entityLabel: String(body?.title || '').slice(0, 80),
              details: `إرسال إشعار (${result.sentCount} نجح / ${result.failedCount} فشل / ${result.removedCount} أزيل)`,
            },
            admin.idToken
          );
          return jsonResponse(result, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse(
            {
              error: err?.message || 'تعذر إرسال الإشعار.',
              needsVapidSetup: Boolean(err?.needsVapidSetup),
            },
            err?.status || 502,
            setCookies
          );
        }
      }

      if (method === 'GET' && pathname === '/api/admin/health') {
        const vapid = resolveVapidEnv(env);
        const catalogCheck = await corePingCatalogRtdb({
          dbHost,
          dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
          serviceAccountJson: getServiceAccountFromEnv(env),
        }).catch((e) => ({ ok: false, error: e?.message || 'error' }));
        let authDbCheck = { ok: false, mode: 'rtdb' };
        try {
          const r = await store.pingRtdb({ adminIdToken: admin.idToken });
          authDbCheck = { ok: Boolean(r?.ok), mode: 'rtdb', latencyMs: r?.latencyMs || 0 };
        } catch (e) {
          authDbCheck = { ok: false, mode: 'rtdb', error: e?.code || e?.message || 'error' };
        }
        const aiKey = await getStoreGeminiKey({
          dbHost,
          envGeminiKey: env.GEMINI_API_KEY || '',
          dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
          serviceAccountJson: getServiceAccountFromEnv(env),
        }).catch(() => '');
        return jsonResponse(
          {
            ok: Boolean(catalogCheck?.ok && authDbCheck?.ok),
            checkedAt: new Date().toISOString(),
            catalogRtdb: catalogCheck,
            authDatabase: authDbCheck,
            vapid: { configured: Boolean(vapid.configured), reason: vapid.reason || '' },
            ai: { configured: Boolean(aiKey), source: aiKey ? 'ready' : 'missing' },
          },
          200,
          setCookies
        );
      }

      if (method === 'GET' && pathname === '/api/admin/audit-logs') {
        const limit = Number(url.searchParams.get('limit')) || 150;
        const entityType = String(url.searchParams.get('entityType') || '').trim();
        const entityId = String(url.searchParams.get('entityId') || '').trim();
        try {
          const logs = await store.listAuditLogs(
            { limit, entityType, entityId },
            { adminIdToken: admin.idToken }
          );
          return jsonResponse({ logs }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل سجل النشاطات.' }, 502, setCookies);
        }
      }

      if (method === 'POST' && pathname === '/api/admin/audit-logs') {
        const body = (await readJsonBody(req)) || {};
        const action = String(body.action || '').trim();
        if (!action) return jsonResponse({ error: 'نوع الحدث مطلوب.' }, 400, setCookies);
        try {
          const log = await store.addAuditLog(
            {
              action,
              actorEmail: admin.email,
              entityType: String(body.entityType || 'system'),
              entityId: String(body.entityId || ''),
              entityLabel: String(body.entityLabel || ''),
              details: String(body.details || ''),
            },
            { adminIdToken: admin.idToken }
          );
          return jsonResponse({ ok: true, log }, 201, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر حفظ سجل النشاط.' }, 502, setCookies);
        }
      }

      if (method === 'GET' && pathname === '/api/admin/media') {
        try {
          const raw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          const data = raw.data || {};
          const usageMap = buildAssetUsageMap(data);
          const rtdbKeys = await coreListImageKeys({
            dbHost,
            idToken: admin.idToken,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          }).catch(() => []);
          const allKeys = [...new Set([...Object.keys(usageMap), ...rtdbKeys])];
          const items = [];
          const BATCH = 12;
          for (let i = 0; i < allKeys.length; i += BATCH) {
            const chunk = allKeys.slice(i, i + BATCH);
            const loaded = await Promise.all(
              chunk.map(async (id) => {
                const dataUrl = await fetchImageAsset({
                  dbHost,
                  id,
                  dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
                  serviceAccountJson: getServiceAccountFromEnv(env),
                }).catch(() => null);
                if (!dataUrl) return null;
                const info = inspectAssetPayload(id, dataUrl);
                const usedBy = usageMap[id] || [];
                return {
                  id,
                  dataUrl,
                  mime: info.mime,
                  sizeBytes: info.sizeBytes,
                  isFont: info.isFont,
                  usedBy,
                  unused: usedBy.length === 0,
                };
              })
            );
            loaded.forEach((x) => {
              if (x) items.push(x);
            });
          }
          return jsonResponse({ items, total: items.length }, 200, setCookies);
        } catch {
          return jsonResponse({ error: 'تعذر جلب مركز الملفات والصور.' }, 502, setCookies);
        }
      }

      const mediaDelMatch = pathname.match(/^\/api\/admin\/media\/([^/]+)$/);
      if (method === 'DELETE' && mediaDelMatch) {
        const assetId = decodeURIComponent(mediaDelMatch[1]);
        if (!assetId || !/^[a-zA-Z0-9_-]+$/.test(assetId)) {
          return jsonResponse({ error: 'معرف الملف غير صالح.' }, 400, setCookies);
        }
        try {
          const raw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          const used = collectReferencedAssetIds(raw?.data || {});
          if (used.has(assetId)) {
            return jsonResponse(
              { error: 'لا يمكن حذف هذا الملف لأنه مرتبط حالياً بصنف أو قسم أو عرض أو شعار.' },
              409,
              setCookies
            );
          }
          await coreDeleteImageAsset({ dbHost, idToken: admin.idToken, id: assetId });
          safeAuditLog(
            store,
            {
              action: 'media_delete',
              actorEmail: admin.email,
              entityType: 'media',
              entityId: assetId,
              entityLabel: assetId,
              details: 'حذف ملف غير مستخدم من مركز الصور والملفات',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          return jsonResponse(
            { error: err?.message || 'تعذر حذف الملف.' },
            err?.status || 502,
            setCookies
          );
        }
      }

      if (method === 'GET' && pathname === '/api/admin/backups') {
        try {
          const backups = await store.listBackups(40, { adminIdToken: admin.idToken });
          return jsonResponse({ backups }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر تحميل النسخ الاحتياطية.' }, 502, setCookies);
        }
      }

      if (method === 'POST' && pathname === '/api/admin/backups') {
        const body = (await readJsonBody(req)) || {};
        const label = String(body.label || '').trim() || `نسخة يدوية ${new Date().toLocaleDateString('ar-EG')}`;
        try {
          const raw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          const cleanData = maskCatalogCfgForAdmin(raw?.data || {}, env);
          const stats = sanitizeBackupStats(cleanData);
          const backup = await store.createBackup(
            {
              label,
              actorEmail: admin.email,
              triggerType: 'manual',
              stats,
              payload: { ts: raw?.ts || Date.now(), data: cleanData },
            },
            { adminIdToken: admin.idToken }
          );
          safeAuditLog(
            store,
            {
              action: 'backup_create',
              actorEmail: admin.email,
              entityType: 'backup',
              entityId: backup.id,
              entityLabel: backup.label,
              details: `إنشاء نسخة احتياطية (${stats.products} صنف / ${stats.offers} عرض)`,
            },
            admin.idToken
          );
          return jsonResponse({ ok: true, backup }, 201, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر إنشاء النسخة الاحتياطية.' }, 502, setCookies);
        }
      }

      if (method === 'POST' && pathname === '/api/admin/backups/import') {
        const body = (await readJsonBody(req)) || {};
        const incoming = body?.payload?.data || body?.data;
        const label = String(body?.label || 'استيراد ملف نسخة احتياطية').trim().slice(0, 140);
        if (
          !incoming ||
          typeof incoming !== 'object' ||
          !Array.isArray(incoming.p) ||
          !Array.isArray(incoming.cats) ||
          typeof incoming.cfg !== 'object'
        ) {
          return jsonResponse(
            { error: 'ملف النسخة الاحتياطية غير صالح أو ينقصه البيانات الأساسية.' },
            400,
            setCookies
          );
        }
        try {
          const currentRaw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          }).catch(() => null);
          if (currentRaw?.data && Array.isArray(currentRaw.data.p)) {
            const safeCurrent = maskCatalogCfgForAdmin(currentRaw.data, env);
            await store
              .createBackup(
                {
                  label: 'حماية تلقائية قبل استيراد ملف خارجي',
                  actorEmail: admin.email,
                  triggerType: 'pre_restore',
                  stats: sanitizeBackupStats(safeCurrent),
                  payload: { ts: currentRaw.ts || Date.now(), data: safeCurrent },
                },
                { adminIdToken: admin.idToken }
              )
              .catch(() => {});
          }
          const restoredData = JSON.parse(JSON.stringify(incoming));
          const existingGk = currentRaw?.data?.cfg?.gk ? String(currentRaw.data.cfg.gk).trim() : '';
          if (!restoredData.cfg.gk && existingGk) restoredData.cfg.gk = existingGk;
          delete restoredData.cfg.hasGk;
          delete restoredData.cfg.gkFromEnv;
          delete restoredData.cfg.gkLast4;
          delete restoredData.cfg.newGk;
          delete restoredData.cfg.clearGk;
          restoredData.cfg.lastPublishedAt = new Date().toISOString();
          restoredData.cfg.lastPublishedBy = admin.email;
          const ts = await publishCatalogToFirebase({
            dbHost,
            idToken: admin.idToken,
            dataObj: restoredData,
            pendingImages: {},
          });
          safeAuditLog(
            store,
            {
              action: 'backup_import_restore',
              actorEmail: admin.email,
              entityType: 'backup',
              entityId: String(ts),
              entityLabel: label,
              details: 'استيراد واسترجاع نسخة احتياطية من ملف JSON',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true, ts, data: maskCatalogCfgForAdmin(restoredData, env) }, 200, setCookies);
        } catch (err) {
          return jsonResponse({ error: err?.message || 'تعذر استيراد النسخة الاحتياطية.' }, 502, setCookies);
        }
      }

      const backupRestoreMatch = pathname.match(/^\/api\/admin\/backups\/([^/]+)\/restore$/);
      if (method === 'POST' && backupRestoreMatch) {
        const bakId = decodeURIComponent(backupRestoreMatch[1]);
        try {
          const backup = await store.getBackupById(bakId, { adminIdToken: admin.idToken });
          if (!backup || !backup.payload?.data || !Array.isArray(backup.payload.data.p)) {
            return jsonResponse({ error: 'النسخة الاحتياطية غير صالحة أو غير موجودة.' }, 404, setCookies);
          }
          const currentRaw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          }).catch(() => null);
          if (currentRaw?.data && Array.isArray(currentRaw.data.p)) {
            const safeCurrent = maskCatalogCfgForAdmin(currentRaw.data, env);
            await store
              .createBackup(
                {
                  label: `حماية تلقائية قبل استرجاع (${backup.label})`,
                  actorEmail: admin.email,
                  triggerType: 'pre_restore',
                  stats: sanitizeBackupStats(safeCurrent),
                  payload: { ts: currentRaw.ts || Date.now(), data: safeCurrent },
                },
                { adminIdToken: admin.idToken }
              )
              .catch(() => {});
          }
          const restoredData = JSON.parse(JSON.stringify(backup.payload.data));
          if (!restoredData.cfg || typeof restoredData.cfg !== 'object') restoredData.cfg = {};
          const existingGk = currentRaw?.data?.cfg?.gk ? String(currentRaw.data.cfg.gk).trim() : '';
          if (!restoredData.cfg.gk && existingGk) restoredData.cfg.gk = existingGk;
          delete restoredData.cfg.hasGk;
          delete restoredData.cfg.gkFromEnv;
          delete restoredData.cfg.gkLast4;
          delete restoredData.cfg.newGk;
          delete restoredData.cfg.clearGk;
          restoredData.cfg.lastPublishedAt = new Date().toISOString();
          restoredData.cfg.lastPublishedBy = admin.email;
          const ts = await publishCatalogToFirebase({
            dbHost,
            idToken: admin.idToken,
            dataObj: restoredData,
            pendingImages: {},
          });
          safeAuditLog(
            store,
            {
              action: 'backup_restore',
              actorEmail: admin.email,
              entityType: 'backup',
              entityId: backup.id,
              entityLabel: backup.label,
              details: 'استعادة الكتالوج من نسخة احتياطية محفوظة',
            },
            admin.idToken
          );
          return jsonResponse({ ok: true, ts, data: maskCatalogCfgForAdmin(restoredData, env) }, 200, setCookies);
        } catch (err) {
          return jsonResponse({ error: err?.message || 'تعذر استرجاع النسخة الاحتياطية.' }, 502, setCookies);
        }
      }

      const backupGetMatch = pathname.match(/^\/api\/admin\/backups\/([^/]+)$/);
      if (method === 'GET' && backupGetMatch) {
        const bakId = decodeURIComponent(backupGetMatch[1]);
        try {
          const backup = await store.getBackupById(bakId, { adminIdToken: admin.idToken });
          if (!backup) return jsonResponse({ error: 'النسخة الاحتياطية غير موجودة.' }, 404, setCookies);
          return jsonResponse({ backup }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر جلب النسخة الاحتياطية.' }, 502, setCookies);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404, setCookies);
    }

    // ==================== FALLBACK / CATCH-ALL PROTECTION ====================
    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    const check = await requireApprovedUser(req, url, store);
    if (!check.ok) return check.response;
    return serveAsset(env, req, '/index.html', { noStore: true });
  },
};
