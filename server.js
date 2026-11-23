import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sqliteStore from './lib/db.js';
import {
  callGemini,
  collectReferencedAssetIds,
  deleteImageAsset,
  fetchImageAsset,
  fetchRawCatalog,
  firebaseSignIn,
  getStoreGeminiKey,
  listImageKeys,
  pingCatalogRtdb,
  publishCatalogToFirebase,
  resolveFirebaseWebConfig,
  sanitizeCatalogForCustomer,
} from './lib/firebaseProxy.js';
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
import { generateGeminiServer } from './lib/geminiServer.js';
import {
  checkProductDuplicates,
  previewAndValidateAdminOps,
  validateCustomerGeminiResponse,
} from './js/ai-engine.js';

const adminExecutedOpIds = new Map();
function isOpExecuted(opId) {
  if (!opId) return false;
  const now = Date.now();
  for (const [k, ts] of adminExecutedOpIds.entries()) {
    if (now - ts > 15 * 60 * 1000) adminExecutedOpIds.delete(k);
  }
  return adminExecutedOpIds.has(opId);
}
function markOpExecuted(opId) {
  if (opId) adminExecutedOpIds.set(String(opId), Date.now());
}

const rtdbStore = createRtdbAuthStore(process.env);
const userStore = rtdbStore.hasServerDbCredentials() ? rtdbStore : sqliteStore;

const {
  cleanupExpiredSessions,
  createAdminSession,
  getAdminSession,
  isValidEmail,
  isValidPhone,
  loadOrGenerateVapidKeys,
  normalizeEmail,
  normalizePhone,
  revokeAdminSession,
} = sqliteStore;

const localVapidFallback = loadOrGenerateVapidKeys();
function getEffectivePushEnv() {
  return {
    ...process.env,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || localVapidFallback.publicKey,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || localVapidFallback.privateKey,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

const USER_COOKIE = 'abu_session';
const STATUS_COOKIE = 'abu_status_token';
const ADMIN_COOKIE = 'abu_admin_session';

const authRateBuckets = new Map();

function checkRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxHits = 60;

  let bucket = authRateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    authRateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxHits) {
    return res.status(429).json({
      error: 'محاولات كثيرة متتالية، يرجى الانتظار دقيقة والمحاولة مرة أخرى.',
    });
  }
  return next();
}

setInterval(() => {
  cleanupExpiredSessions();
  const cutoff = Date.now() - 120 * 1000;
  for (const [k, b] of authRateBuckets.entries()) {
    if (b.start < cutoff) authRateBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref();

function parseCookies(req) {
  const header = req.headers.cookie;
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

function isHttpsRequest(req) {
  if (req.secure) return true;
  const proto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'https';
}

function buildCookieString(req, name, value, maxAgeSec) {
  const secure = isHttpsRequest(req);
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

function appendSetCookie(res, cookieStr) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookieStr);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [prev, cookieStr]);
  }
}

function setSessionCookie(res, req, name, value, maxAgeSec) {
  appendSetCookie(res, buildCookieString(req, name, value, maxAgeSec));
}

function clearSessionCookie(res, req, name) {
  appendSetCookie(res, buildCookieString(req, name, '', 0));
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

function wantsHtml(req) {
  if (req.path.startsWith('/api/')) return false;
  if (/\.(js|css|json|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/i.test(req.path)) {
    return false;
  }
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html') || req.path === '/' || req.path === '/index.html';
}

async function requireApprovedUser(req, res, next) {
  setNoStore(res);
  try {
    const cookies = parseCookies(req);
    const token = cookies[USER_COOKIE];
    const session = await userStore.getSessionWithUser(token, 'auth');

    if (!session) {
      if (token) clearSessionCookie(res, req, USER_COOKIE);
      const statusToken = cookies[STATUS_COOKIE];
      const statusSess = statusToken
        ? await userStore.getSessionWithUser(statusToken, 'status')
        : null;
      if (wantsHtml(req)) {
        if (statusSess && statusSess.user && statusSess.user.status !== 'Approved') {
          return res.redirect('/account-status');
        }
        return res.redirect('/login');
      }
      return res.status(401).json({
        error: 'يجب تسجيل الدخول للوصول إلى هذا المحتوى.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (session.user.status !== 'Approved') {
      await userStore.revokeSessionToken(token);
      clearSessionCookie(res, req, USER_COOKIE);
      const st = await userStore.createUserSession(
        session.user.id,
        'status',
        24 * 60 * 60 * 1000
      );
      setSessionCookie(res, req, STATUS_COOKIE, st.rawToken, 24 * 60 * 60);

      if (wantsHtml(req)) {
        return res.redirect('/account-status');
      }
      return res.status(403).json({
        error:
          session.user.status === 'Suspended'
            ? 'تم تعليق حسابك من قِبل الإدارة.'
            : session.user.status === 'Rejected'
            ? 'لم تتم الموافقة على حسابك.'
            : 'حسابك في انتظار موافقة الإدارة.',
        code: `ACCOUNT_${session.user.status.toUpperCase()}`,
        status: session.user.status,
        rejectionReason: session.user.rejectionReason || '',
      });
    }

    req.user = session.user;
    req.userToken = token;
    req.userSession = session;
    return next();
  } catch (err) {
    return res.status(503).json({ error: 'تعذر التحقق من الجلسة حالياً.' });
  }
}

function handleRtdbConfigError(err, res) {
  const code = err?.code || '';
  if (
    code === 'RTDB_NOT_CONFIGURED' ||
    code === 'RTDB_PERMISSION_DENIED' ||
    code === 'RTDB_HOST_NOT_FOUND' ||
    code === 'RTDB_UNREACHABLE'
  ) {
    const error =
      code === 'RTDB_HOST_NOT_FOUND'
        ? 'رابط قاعدة بيانات Firebase غير موجود. راجع قيمة FIREBASE_DB_HOST.'
        : code === 'RTDB_UNREACHABLE'
        ? 'تعذر الاتصال بخادم Firebase Realtime Database، حاول مرة أخرى.'
        : code === 'RTDB_PERMISSION_DENIED'
        ? 'تعذر الوصول لمسار /abu_auth في Firebase Realtime Database. تأكد من صلاحية FIREBASE_SERVICE_ACCOUNT أو FIREBASE_DB_SECRET.'
        : 'يرجى التأكد من تفعيل FIREBASE_SERVICE_ACCOUNT أو FIREBASE_DB_SECRET لربط Firebase Realtime Database.';
    return res.status(503).json({ needsRtdbSetup: true, error });
  }
  return null;
}

function requireAdmin(req, res, next) {
  setNoStore(res);
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  const adminSess = getAdminSession(token);
  if (!adminSess) {
    if (token) clearSessionCookie(res, req, ADMIN_COOKIE);
    return res.status(401).json({
      error: 'يجب تسجيل الدخول كمسؤول لإتمام هذه العملية.',
      code: 'ADMIN_UNAUTHENTICATED',
    });
  }
  req.adminSession = adminSess;
  req.adminToken = token;
  return next();
}

function verifyAdminSameOrigin(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const reqHost = req.get('x-forwarded-host') || req.get('host') || '';
      if (reqHost && originHost !== reqHost) {
        return res.status(403).json({ error: 'طلب غير مصرح به من مصدر خارجي.' });
      }
    } catch {
      return res.status(403).json({ error: 'مصدر الطلب غير صالح.' });
    }
  }
  return next();
}

function sendProtectedFile(relPath) {
  return (_req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, relPath));
  };
}

function safeAuditLog(entry, adminSess = null) {
  try {
    const res = userStore.addAuditLog(entry, {
      adminIdToken: adminSess?.fb_id_token || '',
    });
    if (res && typeof res.catch === 'function') {
      res.catch(() => {});
    }
  } catch {
    // non-fatal audit logging
  }
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
  if (data.cfg?.dailyDealImgId) addRef(data.cfg.dailyDealImgId, { type: 'daily', label: 'صورة منتج اليوم' });
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

function maskCatalogCfgForAdmin(dataObj) {
  const clone = JSON.parse(JSON.stringify(dataObj || {}));
  clone.offers = Array.isArray(clone.offers) ? clone.offers : [];
  clone.cats = Array.isArray(clone.cats) ? clone.cats : [];
  clone.p = Array.isArray(clone.p) ? clone.p : [];
  if (!clone.cfg || typeof clone.cfg !== 'object') clone.cfg = {};
  const rawKey = clone.cfg.gk ? String(clone.cfg.gk).trim() : '';
  const envKey = String(process.env.GEMINI_API_KEY || '').trim();
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

// ==================== PUBLIC AUTH PAGES & SHARED AUTH ASSETS ====================
app.get('/styles/auth.css', (_req, res) => {
  res.sendFile(path.join(__dirname, 'styles', 'auth.css'));
});

app.get('/js/auth.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'js', 'auth.js'));
});

app.get('/js/logo-data.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'js', 'logo-data.js'));
});

app.get('/js/pwa.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'js', 'pwa.js'));
});

app.get('/sw.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.webmanifest', (_req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname, 'manifest.webmanifest'));
});

app.use('/icons', express.static(path.join(__dirname, 'icons'), { maxAge: '7d' }));

app.get('/push-img/:id', async (req, res) => {
  try {
    const img = await userStore.getPushImage(req.params.id);
    if (!img || !img.base64 || !/^image\/(png|jpeg|webp|gif)$/i.test(img.mime || '')) {
      return res.status(404).send('Not found');
    }
    const buf = Buffer.from(img.base64, 'base64');
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.send(buf);
  } catch {
    return res.status(404).send('Not found');
  }
});

app.get(['/login', '/login.html'], async (req, res) => {
  setNoStore(res);
  try {
    const cookies = parseCookies(req);
    const sess = await userStore.getSessionWithUser(cookies[USER_COOKIE], 'auth');
    if (sess && sess.user.status === 'Approved') {
      return res.redirect('/');
    }
  } catch {
    // show login page
  }
  return res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get(['/register', '/register.html'], async (req, res) => {
  setNoStore(res);
  try {
    const cookies = parseCookies(req);
    const sess = await userStore.getSessionWithUser(cookies[USER_COOKIE], 'auth');
    if (sess && sess.user.status === 'Approved') {
      return res.redirect('/');
    }
  } catch {
    // show register page
  }
  return res.sendFile(path.join(__dirname, 'public', 'auth', 'register.html'));
});

app.get(['/account-status', '/status'], async (req, res) => {
  setNoStore(res);
  try {
    const cookies = parseCookies(req);
    const authSess = await userStore.getSessionWithUser(cookies[USER_COOKIE], 'auth');
    if (authSess && authSess.user.status === 'Approved') {
      return res.redirect('/');
    }
    const statusSess = await userStore.getSessionWithUser(cookies[STATUS_COOKIE], 'status');
    if (!statusSess && !authSess) {
      return res.redirect('/login');
    }
  } catch {
    return res.redirect('/login');
  }
  return res.sendFile(path.join(__dirname, 'public', 'auth', 'status.html'));
});

// ==================== CUSTOMER AUTH APIs ====================
app.post('/api/auth/register', checkRateLimit, async (req, res) => {
  setNoStore(res);
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const phone = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');
  const shopName = String(body.shopName || '').trim();
  const address = String(body.address || '').trim();

  if (fullName.length < 3 || fullName.length > 100) {
    return res.status(400).json({ error: 'يرجى إدخال الاسم بالكامل (من ٣ إلى ١٠٠ حرف).' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح (من ١٠ إلى ١٥ رقم).' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة.' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون ٦ أحرف أو أرقام على الأقل.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين.' });
  }

  try {
    if (await userStore.findUserByPhone(phone)) {
      return res.status(409).json({ error: 'رقم الهاتف مسجل بالفعل في النظام.' });
    }
    if (email && (await userStore.findUserByEmail(email))) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل.' });
    }

    const created = await userStore.createUser({
      fullName,
      phone,
      email,
      shopName,
      address,
      password,
    });

    const statusSess = await userStore.createUserSession(
      created.id,
      'status',
      24 * 60 * 60 * 1000
    );
    clearSessionCookie(res, req, USER_COOKIE);
    setSessionCookie(res, req, STATUS_COOKIE, statusSess.rawToken, 24 * 60 * 60);

    return res.status(201).json({
      ok: true,
      message: 'تم إرسال طلب إنشاء حسابك بنجاح، وهو الآن قيد مراجعة الإدارة.',
      user: userStore.sanitizeUser(created),
    });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    if (
      String(err?.message || '').includes('UNIQUE') ||
      err?.code === 'DUPLICATE_PHONE' ||
      err?.code === 'DUPLICATE_EMAIL'
    ) {
      return res.status(409).json({ error: 'رقم الهاتف أو البريد الإلكتروني مسجل بالفعل.' });
    }
    return res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى.' });
  }
});

app.post('/api/auth/login', checkRateLimit, async (req, res) => {
  setNoStore(res);
  const body = req.body || {};
  const identifier = String(body.identifier || body.phone || body.email || '').trim();
  const password = String(body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'يرجى إدخال رقم الهاتف وكلمة المرور.' });
  }

  try {
    const user = await userStore.findUserByIdentifier(identifier);
    const storedHash = user ? user.password_hash ?? user.passwordHash : '';
    if (!user || !(await userStore.verifyPassword(password, storedHash))) {
      return res
        .status(401)
        .json({ error: 'بيانات الدخول غير صحيحة، تأكد من رقم الهاتف وكلمة المرور.' });
    }

    if (user.status === 'Approved') {
      const rememberMe = body.rememberMe !== false;
      const ttlSec = 90 * 24 * 60 * 60;
      const ttlMs = rememberMe ? ttlSec * 1000 : 24 * 60 * 60 * 1000;
      const sess = await userStore.createUserSession(
        user.id,
        'auth',
        ttlMs,
        user.tokenVersion || 1
      );
      clearSessionCookie(res, req, STATUS_COOKIE);
      setSessionCookie(
        res,
        req,
        USER_COOKIE,
        sess.rawToken,
        rememberMe ? ttlSec : null
      );
      return res.json({
        ok: true,
        status: 'Approved',
        rememberMe,
        user: userStore.sanitizeUser(user),
      });
    }

    const statusSess = await userStore.createUserSession(
      user.id,
      'status',
      24 * 60 * 60 * 1000
    );
    clearSessionCookie(res, req, USER_COOKIE);
    setSessionCookie(res, req, STATUS_COOKIE, statusSess.rawToken, 24 * 60 * 60);

    return res.json({
      ok: true,
      status: user.status,
      message:
        user.status === 'Pending'
          ? 'طلب إنشاء حسابك لا يزال قيد مراجعة الإدارة.'
          : user.status === 'Rejected'
          ? 'لم تتم الموافقة على طلب حسابك من قِبل الإدارة.'
          : 'تم تعليق حسابك من قِبل الإدارة.',
      user: userStore.sanitizeUser(user),
    });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  setNoStore(res);
  const cookies = parseCookies(req);
  if (cookies[USER_COOKIE]) await userStore.revokeSessionToken(cookies[USER_COOKIE]);
  if (cookies[STATUS_COOKIE]) await userStore.revokeSessionToken(cookies[STATUS_COOKIE]);
  clearSessionCookie(res, req, USER_COOKIE);
  clearSessionCookie(res, req, STATUS_COOKIE);
  return res.json({ ok: true });
});

app.get('/api/auth/status', async (req, res) => {
  setNoStore(res);
  try {
    const cookies = parseCookies(req);
    const authToken = cookies[USER_COOKIE];
    if (authToken) {
      const authSess = await userStore.getSessionWithUser(authToken, 'auth');
      if (authSess) {
        if (authSess.user.status === 'Approved') {
          return res.json({
            authenticated: true,
            canEnterStore: true,
            user: authSess.user,
          });
        }
        await userStore.revokeSessionToken(authToken);
        clearSessionCookie(res, req, USER_COOKIE);
        const st = await userStore.createUserSession(
          authSess.user.id,
          'status',
          24 * 60 * 60 * 1000
        );
        setSessionCookie(res, req, STATUS_COOKIE, st.rawToken, 24 * 60 * 60);
        return res.json({
          authenticated: false,
          canEnterStore: false,
          user: authSess.user,
        });
      }
      clearSessionCookie(res, req, USER_COOKIE);
    }

    const statusToken = cookies[STATUS_COOKIE];
    if (statusToken) {
      const statusSess = await userStore.getSessionWithUser(statusToken, 'status');
      if (statusSess) {
        return res.json({
          authenticated: false,
          canEnterStore: false,
          user: statusSess.user,
        });
      }
      clearSessionCookie(res, req, STATUS_COOKIE);
    }
  } catch {
    // ignore and return 401
  }

  return res.status(401).json({ error: 'لا توجد جلسة نشطة.' });
});

app.get('/api/auth/me', requireApprovedUser, async (req, res) => {
  const sess = req.userSession;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const remaining = Number(sess?.expiresAt || 0) - Date.now();
  if (
    sess &&
    remaining > 2 * 24 * 60 * 60 * 1000 &&
    remaining < 45 * 24 * 60 * 60 * 1000 &&
    typeof userStore.extendUserSession === 'function'
  ) {
    await userStore.extendUserSession(req.userToken, ninetyDaysMs);
    setSessionCookie(res, req, USER_COOKIE, req.userToken, 90 * 24 * 60 * 60);
  }
  return res.json({
    authenticated: true,
    user: req.user,
  });
});

// ==================== PROTECTED STOREFRONT ASSETS & APIs ====================
app.get(['/', '/index.html'], requireApprovedUser, sendProtectedFile('index.html'));
app.get('/styles/store.css', requireApprovedUser, sendProtectedFile('styles/store.css'));
app.get('/js/main.js', requireApprovedUser, sendProtectedFile('js/main.js'));
app.get('/js/store.js', requireApprovedUser, sendProtectedFile('js/store.js'));
app.get('/js/cart.js', requireApprovedUser, sendProtectedFile('js/cart.js'));
app.get('/js/offers.js', requireApprovedUser, sendProtectedFile('js/offers.js'));
app.get('/js/ai.js', requireApprovedUser, sendProtectedFile('js/ai.js'));
app.get('/js/data.js', requireApprovedUser, sendProtectedFile('js/data.js'));
app.get('/js/router.js', requireApprovedUser, sendProtectedFile('js/router.js'));
app.get('/js/state.js', requireApprovedUser, sendProtectedFile('js/state.js'));
app.get('/js/utils.js', requireApprovedUser, sendProtectedFile('js/utils.js'));
app.get('/js/firebase-client.js', requireApprovedUser, sendProtectedFile('js/firebase-client.js'));
app.get('/js/push.js', requireApprovedUser, sendProtectedFile('js/push.js'));
app.get('/js/orders.js', requireApprovedUser, sendProtectedFile('js/orders.js'));
app.get('/js/ai-engine.js', requireApprovedUser, sendProtectedFile('js/ai-engine.js'));

app.get('/api/firebase-config', requireApprovedUser, (_req, res) => {
  return res.json({ config: resolveFirebaseWebConfig(process.env) });
});

app.get('/api/catalog', requireApprovedUser, async (_req, res) => {
  try {
    const raw = await fetchRawCatalog(false);
    return res.json(sanitizeCatalogForCustomer(raw));
  } catch {
    return res.status(502).json({ error: 'تعذر تحميل بيانات الكتالوج حالياً.' });
  }
});

app.get('/api/img/:id', requireApprovedUser, async (req, res) => {
  const val = await fetchImageAsset(req.params.id);
  return res.json(val);
});

app.post('/api/ai/generate', requireApprovedUser, checkRateLimit, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const audioBase64 = req.body?.audioBase64 ? String(req.body.audioBase64) : null;
  const preferredModel = req.body?.preferredModel ? String(req.body.preferredModel) : '';
  const schemaType = req.body?.schemaType ? String(req.body.schemaType) : '';
  const systemInstruction = req.body?.systemInstruction ? String(req.body.systemInstruction) : '';
  const taskType = req.body?.taskType ? String(req.body.taskType) : 'customer_chat';
  const temperature = req.body?.temperature != null ? Number(req.body.temperature) : null;

  if (!prompt || prompt.length > 80000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }
  if (audioBase64 && audioBase64.length > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Audio payload too large' });
  }

  try {
    const apiKey = await getStoreGeminiKey();
    if (!apiKey) {
      return res.status(503).json({ error: 'KEY' });
    }
    const result = await generateGeminiServer({
      apiKey,
      prompt,
      systemInstruction,
      audioBase64,
      preferredModel,
      schemaType,
      temperature,
      taskType,
    });
    return res.json(result);
  } catch (err) {
    const code = err?.message || 'AI_ERROR';
    const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
    return res.status(status).json({ error: code });
  }
});

app.post('/api/ai/validate', requireApprovedUser, checkRateLimit, async (req, res) => {
  try {
    const rawCatalog = await fetchRawCatalog(false);
    const catalogData = rawCatalog?.data || {};
    const geminiJson = req.body?.geminiResult ?? req.body?.geminiJson ?? {};
    const userMessage = String(req.body?.message || '');
    const currentDraft = Array.isArray(req.body?.currentDraft) ? req.body.currentDraft : [];
    const stateCtx =
      req.body?.stateCtx && typeof req.body.stateCtx === 'object' ? req.body.stateCtx : {};
    const validated = validateCustomerGeminiResponse({
      geminiJson,
      userMessage,
      currentDraft,
      catalogData,
      stateCtx,
    });
    return res.json({ ok: true, ...validated });
  } catch (err) {
    return res.status(400).json({ error: 'بيانات المساعد غير صالحة للمراجعة.' });
  }
});

// ==================== CUSTOMER ORDERS APIs ====================
app.get('/api/orders', requireApprovedUser, async (req, res) => {
  try {
    const orders = await userStore.listUserOrders(req.user.id, 80);
    return res.json({ orders });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل سجل الطلبات حالياً.' });
  }
});

app.post('/api/orders', requireApprovedUser, checkRateLimit, async (req, res) => {
  try {
    let rawCatalog = await fetchRawCatalog(false);
    let built = await buildAuthoritativeOrder({
      body: req.body || {},
      user: req.user,
      catalogData: rawCatalog?.data,
    });
    if (built.error) {
      rawCatalog = await fetchRawCatalog(true);
      built = await buildAuthoritativeOrder({
        body: req.body || {},
        user: req.user,
        catalogData: rawCatalog?.data,
      });
    }
    if (built.error) {
      return res.status(built.status || 400).json({ error: built.error });
    }
    const saved = await userStore.createOrder(built.order);
    return res.status(saved.deduplicated ? 200 : 201).json({
      ok: true,
      order: saved.order,
      deduplicated: Boolean(saved.deduplicated),
    });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حفظ الطلب في قاعدة البيانات.' });
  }
});

app.delete('/api/orders/:id', requireApprovedUser, checkRateLimit, async (req, res) => {
  try {
    const deleted = await userStore.deleteUserOrder(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'الطلب غير موجود أو لا يخص هذا الحساب.' });
    }
    return res.json({ ok: true, id: String(req.params.id) });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حذف الطلب من السجل.' });
  }
});

app.delete('/api/orders', requireApprovedUser, checkRateLimit, async (req, res) => {
  try {
    const result = await userStore.clearUserOrders(req.user.id);
    const deletedCount = typeof result === 'number' ? result : Number(result?.deletedCount || 0);
    return res.json({ ok: true, deletedCount });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر مسح سجل الطلبات.' });
  }
});

// ==================== CUSTOMER WEB PUSH APIs ====================
app.get('/api/push/config', requireApprovedUser, async (req, res) => {
  const vapid = resolveVapidEnv(getEffectivePushEnv());
  try {
    const userSubs = await userStore.listUserPushSubscriptions(req.user.id);
    return res.json({
      configured: vapid.configured,
      publicKey: vapid.configured ? vapid.publicKey : '',
      subscribedEndpoints: userSubs.map((s) => s.endpoint),
      deviceCount: userSubs.length,
    });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر جلب إعدادات الإشعارات.' });
  }
});

app.post('/api/push/subscribe', requireApprovedUser, checkRateLimit, async (req, res) => {
  const parsed = validatePushSubscriptionInput(req.body?.subscription || req.body);
  if (!parsed.valid) {
    return res.status(400).json({ error: parsed.error });
  }
  const userAgent = req.get('user-agent') || '';
  const deviceLabel = detectDeviceLabel(userAgent);
  try {
    const saved = await userStore.upsertPushSubscription({
      userId: req.user.id,
      phone: req.user.phone,
      fullName: req.user.fullName,
      shopName: req.user.shopName,
      address: req.user.address,
      subscription: parsed.subscription,
      userAgent,
      deviceLabel,
    });
    return res.json({ ok: true, subscription: saved });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حفظ اشتراك الإشعارات.' });
  }
});

app.post('/api/push/unsubscribe', requireApprovedUser, checkRateLimit, async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) {
    return res.status(400).json({ error: 'يرجى تحديد رابط الاشتراك.' });
  }
  try {
    const removed = await userStore.removePushSubscription({
      userId: req.user.id,
      endpoint,
    });
    return res.json({ ok: true, removed });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر إلغاء اشتراك الإشعارات.' });
  }
});

// ==================== ADMIN AUTH, ASSETS & MANAGEMENT APIs ====================
app.get(['/admin', '/admin.html'], (_req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-app.js', requireAdmin, sendProtectedFile('protected/admin-app.js'));
app.get('/admin-ai-engine.js', requireAdmin, sendProtectedFile('js/ai-engine.js'));
app.get('/admin.css', requireAdmin, sendProtectedFile('protected/admin.css'));

app.use('/api/admin', verifyAdminSameOrigin);

app.post('/api/admin/login', checkRateLimit, async (req, res) => {
  setNoStore(res);
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال الإيميل وكلمة السر.' });
  }

  try {
    const fb = await firebaseSignIn(email, password);
    const rememberMe = req.body?.rememberMe !== false;
    const ttlSec = 30 * 24 * 60 * 60;
    const sess = createAdminSession({
      email: fb.email,
      uid: fb.uid,
      fbIdToken: fb.idToken,
      fbRefreshToken: fb.refreshToken,
      fbExpiresInSec: fb.expiresIn,
      ttlMs: rememberMe ? ttlSec * 1000 : 24 * 60 * 60 * 1000,
    });
    setSessionCookie(res, req, ADMIN_COOKIE, sess.rawToken, rememberMe ? ttlSec : null);
    safeAuditLog(
      {
        action: 'admin_login',
        actorEmail: fb.email,
        entityType: 'system',
        entityId: fb.uid || fb.email,
        entityLabel: fb.email,
        details: 'تسجيل دخول ناجح إلى لوحة التحكم',
      },
      { fb_id_token: fb.idToken }
    );
    return res.json({ ok: true, email: fb.email });
  } catch {
    return res.status(401).json({ error: 'الإيميل أو كلمة السر غلط' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  setNoStore(res);
  const cookies = parseCookies(req);
  if (cookies[ADMIN_COOKIE]) {
    revokeAdminSession(cookies[ADMIN_COOKIE]);
  }
  clearSessionCookie(res, req, ADMIN_COOKIE);
  return res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  setNoStore(res);
  const cookies = parseCookies(req);
  const sess = getAdminSession(cookies[ADMIN_COOKIE]);
  if (!sess) {
    if (cookies[ADMIN_COOKIE]) clearSessionCookie(res, req, ADMIN_COOKIE);
    return res.json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    email: sess.email,
    uid: sess.uid || '',
    sessionCreatedAt: sess.created_at || '',
    sessionExpiresAt: sess.expires_at ? new Date(Number(sess.expires_at)).toISOString() : '',
  });
});

app.get('/api/admin/bootstrap', requireAdmin, async (_req, res) => {
  try {
    const raw = await fetchRawCatalog(true);
    const data = maskCatalogCfgForAdmin(raw.data || {});
    const keys = collectReferencedAssetIds(data);

    const images = {};
    await Promise.all(
      [...keys].map(async (k) => {
        const v = await fetchImageAsset(k);
        if (v) images[k] = v;
      })
    );

    return res.json({ ts: raw.ts, data, images });
  } catch {
    return res.status(502).json({ error: 'تعذر جلب بيانات المتجر من الخادم.' });
  }
});

app.post('/api/admin/publish', requireAdmin, async (req, res) => {
  const incomingData = req.body?.data;
  const pendingImages = req.body?.pendingImages || {};
  const auditSummary = String(req.body?.auditSummary || '').trim().slice(0, 400);
  if (!incomingData || typeof incomingData !== 'object' || !Array.isArray(incomingData.p)) {
    return res.status(400).json({ error: 'بيانات المتجر غير صالحة.' });
  }
  try {
    const data = JSON.parse(JSON.stringify(incomingData));
    if (!data.cfg || typeof data.cfg !== 'object') data.cfg = {};

    const existingRaw = await fetchRawCatalog(true).catch(() => null);
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
    data.cfg.lastPublishedBy = req.adminSession.email;

    const ts = await publishCatalogToFirebase(req.adminSession, data, pendingImages);
    safeAuditLog(
      {
        action: 'catalog_publish',
        actorEmail: req.adminSession.email,
        entityType: 'catalog',
        entityId: String(ts),
        entityLabel: `نشر الكتالوج (${data.p.length} صنف / ${(data.offers || []).length} عرض)`,
        details: auditSummary || `نشر تعديلات المتجر والأقسام والعروض`,
      },
      req.adminSession
    );
    return res.json({ ok: true, ts, data: maskCatalogCfgForAdmin(data) });
  } catch (err) {
    if (err?.status === 401) {
      revokeAdminSession(req.adminToken);
      clearSessionCookie(res, req, ADMIN_COOKIE);
      return res.status(401).json({ error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' });
    }
    return res.status(502).json({ error: err?.message || 'تعذر النشر' });
  }
});

app.post('/api/admin/ai/generate', requireAdmin, checkRateLimit, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const audioBase64 = req.body?.audioBase64 ? String(req.body.audioBase64) : null;
  const preferredModel = req.body?.preferredModel ? String(req.body.preferredModel) : '';
  const overrideKey = req.body?.apiKey ? String(req.body.apiKey).trim() : '';
  const schemaType = req.body?.schemaType ? String(req.body.schemaType) : '';
  const systemInstruction = req.body?.systemInstruction ? String(req.body.systemInstruction) : '';
  const taskType = req.body?.taskType ? String(req.body.taskType) : 'admin_chat';
  const temperature = req.body?.temperature != null ? Number(req.body.temperature) : null;

  if (!prompt || prompt.length > 250000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    const apiKey = overrideKey || (await getStoreGeminiKey());
    if (!apiKey) {
      return res.status(400).json({ error: 'KEY' });
    }
    const result = await generateGeminiServer({
      apiKey,
      prompt,
      systemInstruction,
      audioBase64,
      preferredModel,
      schemaType,
      temperature,
      taskType,
    });
    return res.json(result);
  } catch (err) {
    const code = err?.message || 'AI_ERROR';
    const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
    return res.status(status).json({ error: code });
  }
});

app.post('/api/admin/ai/validate', requireAdmin, checkRateLimit, async (req, res) => {
  try {
    const opId = String(req.body?.opId || '').trim();
    if (req.body?.markExecuted === true) {
      if (opId && isOpExecuted(opId)) {
        return res.status(409).json({ error: 'تم تنفيذ هذه العملية بالفعل (منع التكرار).', duplicateOp: true });
      }
      if (opId) markOpExecuted(opId);
      return res.json({ ok: true, opId, marked: true });
    }
    if (opId && isOpExecuted(opId)) {
      return res.status(409).json({ error: 'تم تنفيذ هذه العملية بالفعل.', duplicateOp: true });
    }

    let catalogData = req.body?.catalogData;
    if (!catalogData || !Array.isArray(catalogData.p)) {
      const raw = await fetchRawCatalog(false);
      catalogData = raw?.data || { p: [], cats: [], offers: [] };
    }

    const incomingProducts = Array.isArray(req.body?.products) ? req.body.products : [];
    const incomingOps = Array.isArray(req.body?.ops) ? req.body.ops : [];

    const productChecks = incomingProducts.map((item) => {
      const dup = checkProductDuplicates(item, catalogData.p || []);
      const priceVal = Number(item?.p != null ? item.p : item?.price || 0);
      return {
        name: String(item?.n || item?.name || '').trim(),
        missingPrice: !(priceVal > 0),
        exactDuplicates: dup.exactMatches.map((x) => ({ idx: x.idx, label: x.label, price: x.price, category: x.category })),
        similarDuplicates: dup.similarMatches.map((x) => ({ idx: x.idx, label: x.label, price: x.price, category: x.category, reason: x.reason })),
      };
    });

    const preview = incomingOps.length
      ? previewAndValidateAdminOps({ ops: incomingOps, catalogData, opId })
      : { opId: opId || '', valid: true, n: 0, del: 0, lines: [], ops: [], needsClarification: [], errors: [] };

    return res.json({
      ok: true,
      opId: preview.opId || opId,
      productChecks,
      preview,
    });
  } catch (err) {
    return res.status(400).json({ error: 'تعذر التحقق من صحة العملية المقترحة.' });
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const users = await userStore.listUsers();
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
    return res.json({ users, counts });
  } catch {
    return res.status(502).json({ error: 'تعذر تحميل الحسابات' });
  }
});

app.post('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  try {
    const updated = await userStore.updateUserStatus(req.params.id, 'Approved', {
      reviewedBy: req.adminSession.email,
    });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    safeAuditLog(
      {
        action: 'user_approve',
        actorEmail: req.adminSession.email,
        entityType: 'user',
        entityId: String(updated.id),
        entityLabel: updated.fullName || updated.phone,
        details: 'اعتماد حساب عميل',
      },
      req.adminSession
    );
    return res.json({ ok: true, user: userStore.sanitizeUser(updated) });
  } catch {
    return res.status(502).json({ error: 'تعذر تنفيذ العملية' });
  }
});

app.post('/api/admin/users/:id/activate', requireAdmin, async (req, res) => {
  try {
    const updated = await userStore.updateUserStatus(req.params.id, 'Approved', {
      reviewedBy: req.adminSession.email,
    });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    safeAuditLog(
      {
        action: 'user_activate',
        actorEmail: req.adminSession.email,
        entityType: 'user',
        entityId: String(updated.id),
        entityLabel: updated.fullName || updated.phone,
        details: 'إعادة تفعيل حساب عميل',
      },
      req.adminSession
    );
    return res.json({ ok: true, user: userStore.sanitizeUser(updated) });
  } catch {
    return res.status(502).json({ error: 'تعذر تنفيذ العملية' });
  }
});

app.post('/api/admin/users/:id/reject', requireAdmin, async (req, res) => {
  const reason = String(req.body?.reason || '').trim().slice(0, 300);
  try {
    const updated = await userStore.updateUserStatus(req.params.id, 'Rejected', {
      rejectionReason: reason || null,
      reviewedBy: req.adminSession.email,
    });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    safeAuditLog(
      {
        action: 'user_reject',
        actorEmail: req.adminSession.email,
        entityType: 'user',
        entityId: String(updated.id),
        entityLabel: updated.fullName || updated.phone,
        details: reason ? `رفض الحساب: ${reason}` : 'رفض طلب إنشاء الحساب',
      },
      req.adminSession
    );
    return res.json({ ok: true, user: userStore.sanitizeUser(updated) });
  } catch {
    return res.status(502).json({ error: 'تعذر تنفيذ العملية' });
  }
});

app.post('/api/admin/users/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const updated = await userStore.updateUserStatus(req.params.id, 'Suspended', {
      reviewedBy: req.adminSession.email,
    });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    safeAuditLog(
      {
        action: 'user_suspend',
        actorEmail: req.adminSession.email,
        entityType: 'user',
        entityId: String(updated.id),
        entityLabel: updated.fullName || updated.phone,
        details: 'تعليق حساب العميل',
      },
      req.adminSession
    );
    return res.json({ ok: true, user: userStore.sanitizeUser(updated) });
  } catch {
    return res.status(502).json({ error: 'تعذر تنفيذ العملية' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await userStore.deleteUserById(req.params.id);
    if (!ok) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    safeAuditLog(
      {
        action: 'user_delete',
        actorEmail: req.adminSession.email,
        entityType: 'user',
        entityId: String(req.params.id),
        entityLabel: `مستخدم #${req.params.id}`,
        details: 'حذف حساب عميل من النظام',
      },
      req.adminSession
    );
    return res.json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'تعذر حذف المستخدم' });
  }
});

// ==================== ADMIN ORDERS APIs ====================
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await userStore.listAllOrders(150, {
      adminIdToken: req.adminSession.fb_id_token || '',
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
    return res.json({ orders, counts });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل الطلبات.' });
  }
});

app.post('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة الطلب غير صالحة.' });
  }
  try {
    const updated = await userStore.updateOrderStatus(req.params.id, status, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!updated) {
      return res.status(404).json({ error: 'الطلب غير موجود.' });
    }
    safeAuditLog(
      {
        action: 'order_status_change',
        actorEmail: req.adminSession.email,
        entityType: 'order',
        entityId: String(updated.id),
        entityLabel: updated.userName || updated.shopName || updated.id,
        details: `تغيير حالة الطلب إلى ${status}`,
      },
      req.adminSession
    );
    return res.json({ ok: true, order: updated });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحديث حالة الطلب.' });
  }
});

app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await userStore.deleteOrderById(req.params.id, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!deleted) {
      return res.status(404).json({ error: 'الطلب غير موجود.' });
    }
    safeAuditLog(
      {
        action: 'order_delete',
        actorEmail: req.adminSession.email,
        entityType: 'order',
        entityId: String(req.params.id),
        entityLabel: `طلب #${req.params.id}`,
        details: 'حذف سجل طلب واتساب من لوحة الإدارة',
      },
      req.adminSession
    );
    return res.json({ ok: true, id: String(req.params.id) });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حذف الطلب.' });
  }
});

app.delete('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const result = await userStore.clearAllOrders({
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    const deletedCount = typeof result === 'number' ? result : Number(result?.deletedCount || 0);
    safeAuditLog(
      {
        action: 'orders_clear',
        actorEmail: req.adminSession.email,
        entityType: 'order',
        entityId: 'all',
        entityLabel: 'سجل الطلبات',
        details: `مسح جميع طلبات الواتساب (${deletedCount} طلب)`,
      },
      req.adminSession
    );
    return res.json({ ok: true, deletedCount });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر مسح سجل الطلبات.' });
  }
});

app.get('/api/admin/push/overview', requireAdmin, async (req, res) => {
  const vapid = resolveVapidEnv(getEffectivePushEnv());
  try {
    const overview = await computePushOverview({
      store: userStore,
      vapid,
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    return res.json(overview);
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل بيانات الإشعارات.' });
  }
});

app.get('/api/admin/push/devices', requireAdmin, async (req, res) => {
  try {
    const devices = await listPushDevices({
      store: userStore,
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    return res.json({ devices });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل قائمة الأجهزة المشتركة.' });
  }
});

app.delete('/api/admin/push/devices/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await userStore.deletePushSubscriptionById(req.params.id, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!ok) {
      return res.status(404).json({ error: 'الجهاز غير موجود.' });
    }
    safeAuditLog(
      {
        action: 'push_device_remove',
        actorEmail: req.adminSession.email,
        entityType: 'push',
        entityId: String(req.params.id),
        entityLabel: `جهاز #${req.params.id}`,
        details: 'إزالة اشتراك جهاز من مركز الإشعارات',
      },
      req.adminSession
    );
    return res.json({ ok: true });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر إزالة الجهاز.' });
  }
});

app.delete('/api/admin/push/logs', requireAdmin, async (req, res) => {
  try {
    await userStore.clearPushLogs({
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    safeAuditLog(
      {
        action: 'push_logs_clear',
        actorEmail: req.adminSession.email,
        entityType: 'push',
        entityId: 'all',
        entityLabel: 'سجل الإشعارات',
        details: 'مسح جميع سجلات الإشعارات من مركز الإشعارات',
      },
      req.adminSession
    );
    return res.json({ ok: true });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر مسح سجل الإشعارات.' });
  }
});

app.delete('/api/admin/push/logs/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await userStore.deletePushLogById(req.params.id, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!ok) {
      return res.status(404).json({ error: 'سجل الإشعار غير موجود.' });
    }
    safeAuditLog(
      {
        action: 'push_log_delete',
        actorEmail: req.adminSession.email,
        entityType: 'push',
        entityId: String(req.params.id),
        entityLabel: `سجل #${req.params.id}`,
        details: 'حذف سجل إشعار من مركز الإشعارات',
      },
      req.adminSession
    );
    return res.json({ ok: true });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حذف سجل الإشعار.' });
  }
});

app.post('/api/admin/push/send', requireAdmin, checkRateLimit, async (req, res) => {
  const vapid = resolveVapidEnv(getEffectivePushEnv());
  const origin = `${req.protocol}://${req.get('host')}`;
  try {
    const result = await executeAdminPushBroadcast({
      store: userStore,
      vapid,
      origin,
      adminEmail: req.adminSession.email,
      adminIdToken: req.adminSession.fb_id_token || '',
      body: req.body || {},
    });
    safeAuditLog(
      {
        action: 'push_broadcast',
        actorEmail: req.adminSession.email,
        entityType: 'push',
        entityId: String(result?.log?.id || ''),
        entityLabel: String(req.body?.title || '').slice(0, 80),
        details: `إرسال إشعار (${result.sentCount} نجح / ${result.failedCount} فشل / ${result.removedCount} أزيل)`,
      },
      req.adminSession
    );
    return res.json(result);
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(err?.status || 502).json({
      error: err?.message || 'تعذر إرسال الإشعار.',
      needsVapidSetup: Boolean(err?.needsVapidSetup),
    });
  }
});

// ==================== ADMIN HEALTH, AUDIT, MEDIA & BACKUPS ====================
app.get('/api/admin/health', requireAdmin, async (req, res) => {
  const vapid = resolveVapidEnv(getEffectivePushEnv());
  const catalogCheck = await pingCatalogRtdb().catch((e) => ({
    ok: false,
    error: e?.message || 'error',
  }));
  let authDbCheck = { ok: false, mode: rtdbStore.hasServerDbCredentials() ? 'rtdb' : 'sqlite' };
  const t0 = Date.now();
  try {
    if (rtdbStore.hasServerDbCredentials()) {
      const r = await rtdbStore.pingRtdb({ adminIdToken: req.adminSession.fb_id_token || '' });
      authDbCheck = { ok: Boolean(r?.ok), mode: 'rtdb', latencyMs: r?.latencyMs || (Date.now() - t0) };
    } else {
      const users = sqliteStore.listUsers();
      authDbCheck = { ok: Array.isArray(users), mode: 'sqlite', latencyMs: Date.now() - t0 };
    }
  } catch (e) {
    authDbCheck = {
      ok: false,
      mode: rtdbStore.hasServerDbCredentials() ? 'rtdb' : 'sqlite',
      latencyMs: Date.now() - t0,
      error: e?.code || e?.message || 'error',
    };
  }
  const aiKey = await getStoreGeminiKey().catch(() => '');
  return res.json({
    ok: Boolean(catalogCheck?.ok && authDbCheck?.ok),
    checkedAt: new Date().toISOString(),
    catalogRtdb: catalogCheck,
    authDatabase: authDbCheck,
    vapid: { configured: Boolean(vapid.configured), reason: vapid.reason || '' },
    ai: { configured: Boolean(aiKey), source: process.env.GEMINI_API_KEY && !aiKey ? 'env' : aiKey ? 'ready' : 'missing' },
  });
});

app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  const limit = Number(req.query.limit) || 150;
  const entityType = String(req.query.entityType || '').trim();
  const entityId = String(req.query.entityId || '').trim();
  try {
    const logs = await userStore.listAuditLogs(
      { limit, entityType, entityId },
      { adminIdToken: req.adminSession.fb_id_token || '' }
    );
    return res.json({ logs });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل سجل النشاطات.' });
  }
});

app.post('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  const action = String(req.body?.action || '').trim();
  const entityType = String(req.body?.entityType || 'system').trim();
  const entityId = String(req.body?.entityId || '').trim();
  const entityLabel = String(req.body?.entityLabel || '').trim();
  const details = String(req.body?.details || '').trim();
  if (!action) {
    return res.status(400).json({ error: 'نوع الحدث مطلوب.' });
  }
  try {
    const log = await userStore.addAuditLog(
      {
        action,
        actorEmail: req.adminSession.email,
        entityType,
        entityId,
        entityLabel,
        details,
      },
      { adminIdToken: req.adminSession.fb_id_token || '' }
    );
    return res.status(201).json({ ok: true, log });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر حفظ سجل النشاط.' });
  }
});

app.get('/api/admin/media', requireAdmin, async (req, res) => {
  try {
    const raw = await fetchRawCatalog(true);
    const data = raw.data || {};
    const usageMap = buildAssetUsageMap(data);
    const rtdbKeys = await listImageKeys(req.adminSession).catch(() => []);
    const allKeys = [...new Set([...Object.keys(usageMap), ...rtdbKeys])];

    const items = [];
    const BATCH = 12;
    for (let i = 0; i < allKeys.length; i += BATCH) {
      const chunk = allKeys.slice(i, i + BATCH);
      const loaded = await Promise.all(
        chunk.map(async (id) => {
          const dataUrl = await fetchImageAsset(id).catch(() => null);
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
    return res.json({ items, total: items.length });
  } catch {
    return res.status(502).json({ error: 'تعذر جلب مركز الملفات والصور.' });
  }
});

app.delete('/api/admin/media/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'معرف الملف غير صالح.' });
  }
  try {
    const raw = await fetchRawCatalog(true);
    const used = collectReferencedAssetIds(raw?.data || {});
    if (used.has(id)) {
      return res.status(409).json({
        error: 'لا يمكن حذف هذا الملف لأنه مرتبط حالياً بصنف أو قسم أو عرض أو شعار.',
      });
    }
    await deleteImageAsset(req.adminSession, id);
    safeAuditLog(
      {
        action: 'media_delete',
        actorEmail: req.adminSession.email,
        entityType: 'media',
        entityId: id,
        entityLabel: id,
        details: 'حذف ملف غير مستخدم من مركز الصور والملفات',
      },
      req.adminSession
    );
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status === 401) {
      return res.status(401).json({ error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' });
    }
    return res.status(502).json({ error: err?.message || 'تعذر حذف الملف.' });
  }
});

app.get('/api/admin/backups', requireAdmin, async (req, res) => {
  try {
    const backups = await userStore.listBackups(40, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    return res.json({ backups });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر تحميل النسخ الاحتياطية.' });
  }
});

app.post('/api/admin/backups', requireAdmin, async (req, res) => {
  const label = String(req.body?.label || '').trim() || `نسخة يدوية ${new Date().toLocaleDateString('ar-EG')}`;
  try {
    const raw = await fetchRawCatalog(true);
    const cleanData = maskCatalogCfgForAdmin(raw?.data || {});
    const stats = sanitizeBackupStats(cleanData);
    const backup = await userStore.createBackup(
      {
        label,
        actorEmail: req.adminSession.email,
        triggerType: 'manual',
        stats,
        payload: { ts: raw?.ts || Date.now(), data: cleanData },
      },
      { adminIdToken: req.adminSession.fb_id_token || '' }
    );
    safeAuditLog(
      {
        action: 'backup_create',
        actorEmail: req.adminSession.email,
        entityType: 'backup',
        entityId: backup.id,
        entityLabel: backup.label,
        details: `إنشاء نسخة احتياطية (${stats.products} صنف / ${stats.offers} عرض)`,
      },
      req.adminSession
    );
    return res.status(201).json({ ok: true, backup });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر إنشاء النسخة الاحتياطية.' });
  }
});

app.get('/api/admin/backups/:id', requireAdmin, async (req, res) => {
  try {
    const backup = await userStore.getBackupById(req.params.id, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!backup) return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة.' });
    return res.json({ backup });
  } catch (err) {
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: 'تعذر جلب النسخة الاحتياطية.' });
  }
});

app.post('/api/admin/backups/:id/restore', requireAdmin, async (req, res) => {
  try {
    const backup = await userStore.getBackupById(req.params.id, {
      adminIdToken: req.adminSession.fb_id_token || '',
    });
    if (!backup || !backup.payload?.data || !Array.isArray(backup.payload.data.p)) {
      return res.status(404).json({ error: 'النسخة الاحتياطية غير صالحة أو غير موجودة.' });
    }
    const currentRaw = await fetchRawCatalog(true).catch(() => null);
    if (currentRaw?.data && Array.isArray(currentRaw.data.p)) {
      const safeCurrent = maskCatalogCfgForAdmin(currentRaw.data);
      await userStore.createBackup(
        {
          label: `حماية تلقائية قبل استرجاع (${backup.label})`,
          actorEmail: req.adminSession.email,
          triggerType: 'pre_restore',
          stats: sanitizeBackupStats(safeCurrent),
          payload: { ts: currentRaw.ts || Date.now(), data: safeCurrent },
        },
        { adminIdToken: req.adminSession.fb_id_token || '' }
      ).catch(() => {});
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
    restoredData.cfg.lastPublishedBy = req.adminSession.email;

    const ts = await publishCatalogToFirebase(req.adminSession, restoredData, {});
    safeAuditLog(
      {
        action: 'backup_restore',
        actorEmail: req.adminSession.email,
        entityType: 'backup',
        entityId: backup.id,
        entityLabel: backup.label,
        details: 'استعادة الكتالوج من نسخة احتياطية محفوظة',
      },
      req.adminSession
    );
    return res.json({ ok: true, ts, data: maskCatalogCfgForAdmin(restoredData) });
  } catch (err) {
    if (err?.status === 401) {
      return res.status(401).json({ error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' });
    }
    const cfgErr = handleRtdbConfigError(err, res);
    if (cfgErr) return cfgErr;
    return res.status(502).json({ error: err?.message || 'تعذر استرجاع النسخة الاحتياطية.' });
  }
});

app.post('/api/admin/backups/import', requireAdmin, async (req, res) => {
  const incoming = req.body?.payload?.data || req.body?.data;
  const label = String(req.body?.label || 'استيراد ملف نسخة احتياطية').trim().slice(0, 140);
  if (
    !incoming ||
    typeof incoming !== 'object' ||
    !Array.isArray(incoming.p) ||
    !Array.isArray(incoming.cats) ||
    typeof incoming.cfg !== 'object'
  ) {
    return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح أو ينقصه البيانات الأساسية.' });
  }
  try {
    const currentRaw = await fetchRawCatalog(true).catch(() => null);
    if (currentRaw?.data && Array.isArray(currentRaw.data.p)) {
      const safeCurrent = maskCatalogCfgForAdmin(currentRaw.data);
      await userStore.createBackup(
        {
          label: 'حماية تلقائية قبل استيراد ملف خارجي',
          actorEmail: req.adminSession.email,
          triggerType: 'pre_restore',
          stats: sanitizeBackupStats(safeCurrent),
          payload: { ts: currentRaw.ts || Date.now(), data: safeCurrent },
        },
        { adminIdToken: req.adminSession.fb_id_token || '' }
      ).catch(() => {});
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
    restoredData.cfg.lastPublishedBy = req.adminSession.email;

    const ts = await publishCatalogToFirebase(req.adminSession, restoredData, {});
    safeAuditLog(
      {
        action: 'backup_import_restore',
        actorEmail: req.adminSession.email,
        entityType: 'backup',
        entityId: String(ts),
        entityLabel: label,
        details: 'استيراد واسترجاع نسخة احتياطية من ملف JSON',
      },
      req.adminSession
    );
    return res.json({ ok: true, ts, data: maskCatalogCfgForAdmin(restoredData) });
  } catch (err) {
    if (err?.status === 401) {
      return res.status(401).json({ error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' });
    }
    return res.status(502).json({ error: err?.message || 'تعذر استيراد النسخة الاحتياطية.' });
  }
});

// ==================== FALLBACK / CATCH-ALL PROTECTION ====================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return requireApprovedUser(req, res, () => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'index.html'));
  });
});

if (process.env.NO_LISTEN !== '1') {
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
}

export { app };
