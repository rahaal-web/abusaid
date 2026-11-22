import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sqliteStore from './lib/db.js';
import {
  callGemini,
  fetchImageAsset,
  fetchRawCatalog,
  firebaseSignIn,
  getStoreGeminiKey,
  publishCatalogToFirebase,
  resolveFirebaseWebConfig,
  sanitizeCatalogForCustomer,
} from './lib/firebaseProxy.js';
import { createRtdbAuthStore } from './lib/rtdbAuthStore.js';

const rtdbStore = createRtdbAuthStore(process.env);
const userStore = rtdbStore.hasServerDbCredentials() ? rtdbStore : sqliteStore;

const {
  cleanupExpiredSessions,
  createAdminSession,
  getAdminSession,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  revokeAdminSession,
} = sqliteStore;

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
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
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
    return next();
  } catch {
    return res.status(503).json({ error: 'تعذر التحقق من الجلسة حالياً.' });
  }
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

function sendProtectedFile(relPath) {
  return (_req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, relPath));
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
      const sess = await userStore.createUserSession(
        user.id,
        'auth',
        7 * 24 * 60 * 60 * 1000,
        user.tokenVersion || 1
      );
      clearSessionCookie(res, req, STATUS_COOKIE);
      setSessionCookie(res, req, USER_COOKIE, sess.rawToken, 7 * 24 * 60 * 60);
      return res.json({
        ok: true,
        status: 'Approved',
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
  } catch {
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

app.get('/api/auth/me', requireApprovedUser, (req, res) => {
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
app.get('/js/state.js', requireApprovedUser, sendProtectedFile('js/state.js'));
app.get('/js/utils.js', requireApprovedUser, sendProtectedFile('js/utils.js'));
app.get('/js/firebase-client.js', requireApprovedUser, sendProtectedFile('js/firebase-client.js'));

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

app.post('/api/ai/generate', requireApprovedUser, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const audioBase64 = req.body?.audioBase64 ? String(req.body.audioBase64) : null;
  const preferredModel = req.body?.preferredModel ? String(req.body.preferredModel) : '';

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
    const result = await callGemini({ apiKey, prompt, audioBase64, preferredModel });
    return res.json(result);
  } catch (err) {
    const code = err?.message || 'AI_ERROR';
    const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
    return res.status(status).json({ error: code });
  }
});

// ==================== ADMIN AUTH, ASSETS & MANAGEMENT APIs ====================
app.get(['/admin', '/admin.html'], (_req, res) => {
  setNoStore(res);
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-app.js', requireAdmin, sendProtectedFile('protected/admin-app.js'));

app.post('/api/admin/login', checkRateLimit, async (req, res) => {
  setNoStore(res);
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال الإيميل وكلمة السر.' });
  }

  try {
    const fb = await firebaseSignIn(email, password);
    const sess = createAdminSession({
      email: fb.email,
      uid: fb.uid,
      fbIdToken: fb.idToken,
      fbRefreshToken: fb.refreshToken,
      fbExpiresInSec: fb.expiresIn,
    });
    setSessionCookie(res, req, ADMIN_COOKIE, sess.rawToken, 7 * 24 * 60 * 60);
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
  return res.json({ authenticated: true, email: sess.email });
});

app.get('/api/admin/bootstrap', requireAdmin, async (_req, res) => {
  try {
    const raw = await fetchRawCatalog(true);
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
  const data = req.body?.data;
  const pendingImages = req.body?.pendingImages || {};
  if (!data || typeof data !== 'object' || !Array.isArray(data.p)) {
    return res.status(400).json({ error: 'بيانات المتجر غير صالحة.' });
  }
  try {
    const ts = await publishCatalogToFirebase(req.adminSession, data, pendingImages);
    return res.json({ ok: true, ts });
  } catch (err) {
    if (err?.status === 401) {
      revokeAdminSession(req.adminToken);
      clearSessionCookie(res, req, ADMIN_COOKIE);
      return res.status(401).json({ error: 'انتهت صلاحية جلسة الإدارة، سجل دخول مرة أخرى.' });
    }
    return res.status(502).json({ error: err?.message || 'تعذر النشر' });
  }
});

app.post('/api/admin/ai/generate', requireAdmin, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const audioBase64 = req.body?.audioBase64 ? String(req.body.audioBase64) : null;
  const preferredModel = req.body?.preferredModel ? String(req.body.preferredModel) : '';
  const overrideKey = req.body?.apiKey ? String(req.body.apiKey).trim() : '';

  if (!prompt || prompt.length > 160000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    const apiKey = overrideKey || (await getStoreGeminiKey());
    if (!apiKey) {
      return res.status(400).json({ error: 'KEY' });
    }
    const result = await callGemini({ apiKey, prompt, audioBase64, preferredModel });
    return res.json(result);
  } catch (err) {
    const code = err?.message || 'AI_ERROR';
    const status = code === 'LIMIT' ? 429 : code === 'KEY' ? 403 : 502;
    return res.status(status).json({ error: code });
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
    return res.json({ ok: true, user: userStore.sanitizeUser(updated) });
  } catch {
    return res.status(502).json({ error: 'تعذر تنفيذ العملية' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await userStore.deleteUserById(req.params.id);
    if (!ok) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    return res.json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'تعذر حذف المستخدم' });
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

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
