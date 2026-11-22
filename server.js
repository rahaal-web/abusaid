import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO_FALLBACK } from './js/logo-data.js';
import {
  createCustomerUser,
  createSession,
  deleteCustomerUser,
  deleteSession,
  deleteSessionByHash,
  ensureEnvAdminSeed,
  findUserByIdentifier,
  getSessionWithUser,
  getUserByEmail,
  getUserByPhone,
  isValidEmail,
  isValidPhone,
  listCustomerUsers,
  logAudit,
  normalizeEmail,
  normalizePhone,
  pruneExpiredSessions,
  sanitizeUser,
  touchUserLastLogin,
  updateCustomerStatus,
  upsertAdminUser,
  verifyPassword,
} from './server/db.js';
import {
  fetchAdminAssets,
  fetchAssetById,
  getRawCatalog,
  publishCatalog,
  stripSecretsForCustomer,
  verifyFirebasePassword,
} from './server/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const SESSION_COOKIE = 'abu_sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));

// Basic security headers for all responses
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Simple sliding-window rate limiter for auth endpoints
const rateBuckets = new Map();
function createRateLimiter(maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const list = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (list.length >= maxRequests) {
      return res.status(429).json({
        ok: false,
        message: 'عدد محاولات كبير، يرجى الانتظار قليلاً والمحاولة مرة أخرى.',
      });
    }
    list.push(now);
    rateBuckets.set(key, list);
    next();
  };
}

const authLimiter = createRateLimiter(40, 5 * 60 * 1000);

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function isHttpsRequest(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (proto.split(',')[0].trim() === 'https') return true;
  const cfVisitor = String(req.headers['cf-visitor'] || '').toLowerCase();
  return cfVisitor.includes('"https"');
}

function setSessionCookie(req, res, rawToken, maxAgeMs = SESSION_TTL_MS) {
  const https = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req, res) {
  const https = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

// Attach and validate session + current DB account status on every request
function attachSession(req, res, next) {
  req.auth = null;
  req.revokedStatus = null;

  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE];
  if (!rawToken) return next();

  const row = getSessionWithUser(rawToken);
  if (!row) {
    clearSessionCookie(req, res);
    return next();
  }

  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const revokedReason = row.revoked_status || (row.status !== 'Approved' ? row.status : '');
  if (expired || revokedReason) {
    deleteSessionByHash(row.token_hash);
    clearSessionCookie(req, res);
    req.revokedStatus = expired ? 'expired' : revokedReason;
    return next();
  }

  req.auth = {
    rawToken,
    session: row,
    user: row,
  };
  next();
}

app.use(attachSession);

function statusMessage(status) {
  if (status === 'Pending') {
    return 'تم إرسال طلبك وهو الآن قيد مراجعة الإدارة.';
  }
  if (status === 'Rejected') {
    return 'نأسف، لم تتم الموافقة على طلب تسجيل حسابك من قِبل الإدارة.';
  }
  if (status === 'Suspended') {
    return 'تم إيقاف حسابك من قِبل الإدارة، يرجى التواصل مع الإدارة.';
  }
  if (status === 'expired') {
    return 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.';
  }
  return 'يجب تسجيل الدخول أولاً للوصول إلى هذا المحتوى.';
}

function requireApprovedPage(req, res, next) {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return next();
  }
  const reason = req.revokedStatus ? `?reason=${encodeURIComponent(req.revokedStatus)}` : '';
  return res.redirect(302, `/login${reason}`);
}

function requireApprovedApi(req, res, next) {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return next();
  }
  const status = req.revokedStatus || 'UNAUTHENTICATED';
  const code = status === 'Pending' || status === 'Rejected' || status === 'Suspended' ? 403 : 401;
  return res.status(code).json({
    ok: false,
    authenticated: false,
    status,
    message: statusMessage(status),
  });
}

function requireAdminPage(req, res, next) {
  noStore(res);
  if (!req.auth) {
    const reason = req.revokedStatus ? `?reason=${encodeURIComponent(req.revokedStatus)}` : '';
    return res.redirect(302, `/admin/login${reason}`);
  }
  if (req.auth.user.role !== 'admin') {
    return res.status(403).sendFile(path.join(__dirname, 'auth', 'forbidden.html'));
  }
  return next();
}

function requireAdminApi(req, res, next) {
  noStore(res);
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      authenticated: false,
      message: 'يجب تسجيل الدخول بحساب الإدارة أولاً.',
    });
  }
  if (req.auth.user.role !== 'admin') {
    return res.status(403).json({
      ok: false,
      authenticated: true,
      message: 'غير مصرح لك بالوصول إلى وظائف الإدارة.',
    });
  }
  return next();
}

// ==================== PUBLIC AUTH ASSETS & PAGES ====================

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/api/health', (_req, res) => {
  noStore(res);
  res.json({ ok: true, service: 'abusaid' });
});

app.get('/styles/auth.css', (_req, res) => {
  res.sendFile(path.join(__dirname, 'styles', 'auth.css'));
});

app.get('/api/brand', async (_req, res) => {
  let brandName = 'أبو سعيد';
  let brandSub = 'جملة الشيبسي والسناكس';
  try {
    const { data } = await getRawCatalog();
    if (data && data.cfg) {
      if (data.cfg.brandName) brandName = String(data.cfg.brandName).trim() || brandName;
      if (data.cfg.brandSub) brandSub = String(data.cfg.brandSub).trim() || brandSub;
    }
  } catch {
    // use defaults
  }
  res.json({
    brandName,
    brandSub,
    logoData: LOGO_FALLBACK,
  });
});

app.get(['/login', '/login.html'], (req, res) => {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return res.redirect(302, '/');
  }
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get(['/register', '/register.html'], (req, res) => {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return res.redirect(302, '/');
  }
  res.sendFile(path.join(__dirname, 'auth', 'register.html'));
});

app.get(['/pending', '/pending.html'], (req, res) => {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return res.redirect(302, '/');
  }
  res.sendFile(path.join(__dirname, 'auth', 'pending.html'));
});

app.get('/admin/login', (req, res) => {
  noStore(res);
  if (req.auth) {
    if (req.auth.user.role === 'admin') {
      return res.redirect(302, '/admin');
    }
    return res.status(403).sendFile(path.join(__dirname, 'auth', 'forbidden.html'));
  }
  res.sendFile(path.join(__dirname, 'auth', 'admin-login.html'));
});

// ==================== CUSTOMER AUTH API ====================

app.post('/api/auth/register', authLimiter, async (req, res) => {
  noStore(res);
  try {
    const body = req.body || {};
    const fullName = String(body.fullName || '').trim();
    const rawPhone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const businessName = String(body.businessName || '').trim();
    const cityAddress = String(body.cityAddress || '').trim();
    const notes = String(body.notes || '').trim();
    const rawEmail = body.email != null ? String(body.email).trim() : '';

    if (fullName.length < 3 || fullName.length > 100) {
      return res.status(400).json({
        ok: false,
        message: 'يرجى إدخال الاسم بالكامل (من ٣ إلى ١٠٠ حرف).',
      });
    }

    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        ok: false,
        message: 'يرجى إدخال رقم هاتف صحيح (١٠ إلى ١٥ رقماً).',
      });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({
        ok: false,
        message: 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        message: 'كلمتا المرور غير متطابقتين.',
      });
    }

    let email = null;
    if (rawEmail) {
      email = normalizeEmail(rawEmail);
      if (!isValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          message: 'صيغة البريد الإلكتروني غير صحيحة.',
        });
      }
      if (getUserByEmail(email)) {
        return res.status(409).json({
          ok: false,
          message: 'هذا البريد الإلكتروني مستخدم بالفعل.',
        });
      }
    }

    if (getUserByPhone(phone)) {
      return res.status(409).json({
        ok: false,
        message: 'رقم الهاتف مسجل بالفعل.',
      });
    }

    const created = await createCustomerUser({
      fullName,
      phone,
      email,
      businessName,
      cityAddress,
      notes,
      password,
    });

    logAudit(created.id, 'USER_REGISTERED', created.id, `phone=${created.phone}`);

    return res.status(201).json({
      ok: true,
      status: 'Pending',
      message: 'تم إرسال طلب إنشاء حسابك بنجاح، وهو الآن قيد مراجعة الإدارة.',
      user: sanitizeUser(created),
    });
  } catch (err) {
    if (err && /UNIQUE/i.test(String(err.message))) {
      return res.status(409).json({
        ok: false,
        message: 'رقم الهاتف أو البريد الإلكتروني مستخدم بالفعل.',
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة لاحقاً.',
    });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  noStore(res);
  try {
    const body = req.body || {};
    const identifier = String(body.identifier || body.phone || body.email || '').trim();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({
        ok: false,
        message: 'يرجى إدخال رقم الهاتف وكلمة المرور.',
      });
    }

    const user = findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'بيانات الدخول غير صحيحة.',
      });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: 'بيانات الدخول غير صحيحة.',
      });
    }

    if (user.status === 'Pending') {
      return res.status(403).json({
        ok: false,
        status: 'Pending',
        message: 'حسابك ما زال قيد مراجعة الإدارة، لا يمكنك الدخول قبل الموافقة.',
      });
    }

    if (user.status === 'Rejected') {
      return res.status(403).json({
        ok: false,
        status: 'Rejected',
        reason: user.rejection_reason || '',
        message: 'نأسف، لم تتم الموافقة على طلب تسجيل حسابك من قِبل الإدارة.',
      });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({
        ok: false,
        status: 'Suspended',
        reason: user.rejection_reason || '',
        message: 'تم إيقاف حسابك مؤقتاً من قِبل الإدارة، يرجى التواصل مع الإدارة.',
      });
    }

    if (user.status !== 'Approved') {
      return res.status(403).json({
        ok: false,
        status: user.status,
        message: 'الحساب غير مفعل حالياً.',
      });
    }

    touchUserLastLogin(user.id);
    const sess = createSession({
      userId: user.id,
      role: user.role,
      ttlMs: SESSION_TTL_MS,
    });
    setSessionCookie(req, res, sess.rawToken, SESSION_TTL_MS);

    return res.json({
      ok: true,
      status: 'Approved',
      user: sanitizeUser(user),
      redirectTo: '/',
    });
  } catch {
    return res.status(500).json({
      ok: false,
      message: 'تعذر تسجيل الدخول حالياً، يرجى المحاولة مرة أخرى.',
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  noStore(res);
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE]) {
    deleteSession(cookies[SESSION_COOKIE]);
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  noStore(res);
  if (!req.auth) {
    const status = req.revokedStatus || 'UNAUTHENTICATED';
    return res.status(401).json({
      ok: false,
      authenticated: false,
      status,
      message: statusMessage(status),
    });
  }
  return res.json({
    ok: true,
    authenticated: true,
    user: sanitizeUser(req.auth.user),
  });
});

// ==================== ADMIN AUTH & API ====================

app.post('/api/admin/login', authLimiter, async (req, res) => {
  noStore(res);
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !isValidEmail(email) || !password) {
      return res.status(400).json({
        ok: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
      });
    }

    const existing = getUserByEmail(email);
    if (existing && existing.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'غير مصرح لحسابات العملاء بالدخول إلى لوحة الإدارة.',
      });
    }

    let fbTokens = null;
    let authedLocal = false;

    if (existing && existing.role === 'admin') {
      authedLocal = await verifyPassword(password, existing.password_hash);
    }

    // Verify with Firebase Auth (required when admin logs in with Firebase owner account,
    // and also refreshes Firebase RTDB write tokens if credentials match Firebase).
    try {
      const fb = await verifyFirebasePassword(email, password);
      if (fb.ok) {
        fbTokens = fb;
      }
    } catch {
      // network error fallback to local admin check if already authenticated locally
    }

    if (!fbTokens && !authedLocal) {
      return res.status(401).json({
        ok: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      });
    }

    const adminUser = await upsertAdminUser({
      email,
      fullName: (existing && existing.full_name) || 'إدارة المتجر',
      password: fbTokens ? password : '',
    });

    const sess = createSession({
      userId: adminUser.id,
      role: 'admin',
      fbIdToken: fbTokens ? fbTokens.idToken : null,
      fbRefreshToken: fbTokens ? fbTokens.refreshToken : null,
      fbExpiresAt: fbTokens ? fbTokens.expiresAt : 0,
      ttlMs: SESSION_TTL_MS,
    });

    setSessionCookie(req, res, sess.rawToken, SESSION_TTL_MS);
    logAudit(adminUser.id, 'ADMIN_LOGIN', adminUser.id, email);

    return res.json({
      ok: true,
      user: sanitizeUser(adminUser),
      redirectTo: '/admin',
    });
  } catch (err) {
    if (err && err.message === 'ACCOUNT_IS_CUSTOMER') {
      return res.status(403).json({
        ok: false,
        message: 'غير مصرح لحسابات العملاء بالدخول إلى لوحة الإدارة.',
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'تعذر إتمام تسجيل دخول الإدارة.',
    });
  }
});

app.post('/api/admin/logout', (req, res) => {
  noStore(res);
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE]) {
    deleteSession(cookies[SESSION_COOKIE]);
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/admin/bootstrap', requireAdminApi, async (req, res) => {
  try {
    const { ts, data } = await getRawCatalog(true);
    const imgs = await fetchAdminAssets(data);
    const { counts } = listCustomerUsers();
    res.json({
      ok: true,
      ts,
      catalog: data,
      imgs,
      admin: sanitizeUser(req.auth.user),
      pendingCount: counts.Pending,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: 'تعذر تحميل بيانات المتجر.',
    });
  }
});

app.post('/api/admin/publish', requireAdminApi, async (req, res) => {
  try {
    const body = req.body || {};
    const catalog = body.catalog;
    const pendingImgs = body.pendingImgs || {};

    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.p) || !Array.isArray(catalog.cats)) {
      return res.status(400).json({
        ok: false,
        message: 'بيانات النشر غير صالحة.',
      });
    }

    const result = await publishCatalog({
      sessionRow: req.auth.session,
      catalog,
      pendingImgs,
    });

    logAudit(req.auth.user.id, 'CATALOG_PUBLISHED', null, `v=${catalog.v || 0}`);
    res.json({ ok: true, ts: result.ts });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg === 'SESSION_REAUTH_REQUIRED') {
      return res.status(401).json({
        ok: false,
        message: 'انتهت جلسة النشر في Firebase، يرجى تسجيل الخروج وإعادة الدخول.',
      });
    }
    res.status(500).json({
      ok: false,
      message: 'تعذر النشر: ' + msg,
    });
  }
});

app.get('/api/admin/users', requireAdminApi, (req, res) => {
  const status = String(req.query.status || 'all').trim();
  const q = String(req.query.q || '').trim();
  const data = listCustomerUsers({ status, q });
  res.json({ ok: true, ...data });
});

app.post('/api/admin/users/:id/approve', requireAdminApi, (req, res) => {
  const userId = Number(req.params.id);
  const updated = updateCustomerStatus(userId, 'Approved', '', req.auth.user.id);
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
  }
  res.json({ ok: true, user: sanitizeUser(updated), message: 'تمت الموافقة على الحساب وتفعيله.' });
});

app.post('/api/admin/users/:id/reactivate', requireAdminApi, (req, res) => {
  const userId = Number(req.params.id);
  const updated = updateCustomerStatus(userId, 'Approved', '', req.auth.user.id);
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
  }
  res.json({ ok: true, user: sanitizeUser(updated), message: 'تمت إعادة تفعيل الحساب بنجاح.' });
});

app.post('/api/admin/users/:id/reject', requireAdminApi, (req, res) => {
  const userId = Number(req.params.id);
  const reason = String((req.body && req.body.reason) || '').trim();
  const updated = updateCustomerStatus(userId, 'Rejected', reason, req.auth.user.id);
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
  }
  res.json({ ok: true, user: sanitizeUser(updated), message: 'تم رفض الحساب وإنهاء أي جلسات نشطة له.' });
});

app.post('/api/admin/users/:id/suspend', requireAdminApi, (req, res) => {
  const userId = Number(req.params.id);
  const reason = String((req.body && req.body.reason) || '').trim();
  const updated = updateCustomerStatus(userId, 'Suspended', reason, req.auth.user.id);
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
  }
  res.json({ ok: true, user: sanitizeUser(updated), message: 'تم تعليق الحساب وتسجيل خروجه فوراً.' });
});

app.delete('/api/admin/users/:id', requireAdminApi, (req, res) => {
  const userId = Number(req.params.id);
  const deleted = deleteCustomerUser(userId, req.auth.user.id);
  if (!deleted) {
    return res.status(404).json({ ok: false, message: 'الحساب غير موجود أو لا يمكن حذفه.' });
  }
  res.json({ ok: true, message: 'تم حذف الحساب نهائياً.' });
});

// ==================== PROTECTED STOREFRONT APIs ====================

app.get('/api/catalog', requireApprovedApi, async (_req, res) => {
  try {
    const { ts, data } = await getRawCatalog(false);
    res.json({
      ok: true,
      ts,
      data: stripSecretsForCustomer(data),
    });
  } catch {
    res.status(500).json({ ok: false, message: 'تعذر تحميل الكتالوج.' });
  }
});

app.get('/api/img/:id', requireApprovedApi, async (req, res) => {
  const val = await fetchAssetById(req.params.id);
  if (!val) return res.status(404).json(null);
  return res.json(val);
});

app.post('/api/ai/gemini', requireApprovedApi, async (req, res) => {
  try {
    const { data } = await getRawCatalog(false);
    const key =
      (data && data.cfg && data.cfg.gk && String(data.cfg.gk).trim()) ||
      process.env.GEMINI_API_KEY ||
      '';
    if (!key) {
      return res.status(503).json({ ok: false, code: 'NO_KEY', message: 'خدمة Gemini غير مفعلة.' });
    }

    const body = req.body || {};
    const prompt = String(body.prompt || '');
    const audioBase64 = body.audioBase64 ? String(body.audioBase64) : '';
    const model = String(body.model || 'gemini-2.5-flash').replace(/[^a-zA-Z0-9._-]/g, '');
    const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.15;
    const responseMimeType = body.responseMimeType ? String(body.responseMimeType) : '';

    if (!prompt && !audioBase64) {
      return res.status(400).json({ ok: false, message: 'الطلب فارغ.' });
    }

    const parts = [];
    if (prompt) parts.push({ text: prompt });
    if (audioBase64) parts.push({ inline_data: { mime_type: 'audio/wav', data: audioBase64 } });

    const generationConfig = { temperature };
    if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 22000);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal: ac.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig,
          }),
        }
      );

      const text = await r.text();
      if (!r.ok) {
        return res.status(r.status).json({
          ok: false,
          code: r.status === 429 ? 'LIMIT' : r.status === 403 ? 'KEY' : 'UPSTREAM',
          detail: text.slice(0, 200),
        });
      }
      const parsed = JSON.parse(text);
      const cand = parsed.candidates && parsed.candidates[0];
      const out =
        cand && cand.content && cand.content.parts
          ? cand.content.parts.map((p) => p.text || '').join('')
          : '';
      return res.json({ ok: true, text: out });
    } finally {
      clearTimeout(tm);
    }
  } catch {
    return res.status(502).json({ ok: false, code: 'ERROR', message: 'تعذر الاتصال بخدمة الذكاء.' });
  }
});

// ==================== PROTECTED STOREFRONT & ADMIN PAGES/ASSETS ====================

app.get(['/', '/index.html'], requireApprovedPage, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(['/admin', '/admin.html'], requireAdminPage, (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/styles/store.css', requireApprovedApi, (_req, res) => {
  res.sendFile(path.join(__dirname, 'styles', 'store.css'));
});

app.use('/js', requireApprovedApi, express.static(path.join(__dirname, 'js'), { index: false }));
app.use('/public', requireApprovedApi, express.static(path.join(__dirname, 'public'), { index: false }));

// API 404 handler
app.use('/api', (_req, res) => {
  noStore(res);
  res.status(404).json({ ok: false, message: 'نقطة النهاية غير موجودة.' });
});

// All other routes: never expose internal files or storefront without auth
app.use((req, res) => {
  noStore(res);
  if (req.auth && req.auth.user.status === 'Approved') {
    return res.redirect(302, '/');
  }
  const reason = req.revokedStatus ? `?reason=${encodeURIComponent(req.revokedStatus)}` : '';
  return res.redirect(302, `/login${reason}`);
});

await ensureEnvAdminSeed();
pruneExpiredSessions();
setInterval(pruneExpiredSessions, 60 * 60 * 1000).unref();

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
