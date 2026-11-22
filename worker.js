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
  fetchImageAsset,
  fetchRawCatalog,
  firebaseSignIn,
  getServiceAccountFromEnv,
  getStoreGeminiKey,
  lookupFirebaseIdToken,
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
  resolveVapidEnv,
  validatePushSubscriptionInput,
} from './lib/pushService.js';

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
  '/js/state.js',
  '/js/utils.js',
  '/js/firebase-client.js',
  '/js/push.js',
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
      return jsonResponse({ authenticated: true, email: admin.email }, 200, setCookies);
    }

    if (
      pathname === '/admin-app.js' ||
      pathname.startsWith('/api/admin/')
    ) {
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

      if (method === 'GET' && pathname === '/api/admin/bootstrap') {
        try {
          const raw = await fetchRawCatalog({
            dbHost,
            force: true,
            dbSecret: String(env.FIREBASE_DB_SECRET || '').trim(),
            serviceAccountJson: getServiceAccountFromEnv(env),
          });
          const data = JSON.parse(JSON.stringify(raw.data || {}));
          data.offers = data.offers || [];
          const keys = new Set();
          (data.p || []).forEach((p) => {
            if (p[8]) keys.add(p[8]);
          });
          (data.offers || []).forEach((o) => {
            if (o.i) keys.add(o.i);
          });
          if (data.cfg?.logo) keys.add(data.cfg.logo);
          if (data.cfg?.fontBodyId) keys.add(data.cfg.fontBodyId);
          if (data.cfg?.fontHeadId) keys.add(data.cfg.fontHeadId);

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
        const data = body.data;
        const pendingImages = body.pendingImages || {};
        if (!data || typeof data !== 'object' || !Array.isArray(data.p)) {
          return jsonResponse({ error: 'بيانات المتجر غير صالحة.' }, 400, setCookies);
        }
        try {
          const ts = await publishCatalogToFirebase({
            dbHost,
            idToken: admin.idToken,
            dataObj: data,
            pendingImages,
          });
          return jsonResponse({ ok: true, ts }, 200, setCookies);
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
          return jsonResponse({ ok: true }, 200, setCookies);
        } catch (err) {
          const cfgErr = handleRtdbConfigError(err);
          if (cfgErr) return cfgErr;
          return jsonResponse({ error: 'تعذر حذف المستخدم' }, 502, setCookies);
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
