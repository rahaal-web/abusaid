import {
  encodeEmailKey,
  getServiceAccountAccessToken,
  hashPasswordPBKDF2,
  hmacSha256Hex,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  parseServiceAccountInput,
  randomHex,
  sha256Hex,
  verifyPasswordPBKDF2,
} from './cryptoWeb.js';
import {
  getServiceAccountFromEnv,
  normalizeDbHost,
} from './firebaseCatalogCore.js';

export const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Suspended'];

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: String(u.id),
    fullName: u.fullName || '',
    phone: u.phone || '',
    email: u.email || '',
    shopName: u.shopName || '',
    address: u.address || '',
    notes: u.notes || '',
    status: VALID_STATUSES.includes(u.status) ? u.status : 'Pending',
    rejectionReason: u.rejectionReason || '',
    reviewedAt: u.reviewedAt || '',
    reviewedBy: u.reviewedBy || '',
    createdAt: u.createdAt || '',
    updatedAt: u.updatedAt || '',
  };
}

export function createRtdbAuthStore(env = {}) {
  const serviceAccountRaw = getServiceAccountFromEnv(env);
  const parsedSa = parseServiceAccountInput(serviceAccountRaw);
  const projectId =
    String(env.FIREBASE_PROJECT_ID || '').trim() ||
    (parsedSa && parsedSa.project_id ? String(parsedSa.project_id).trim() : '');
  const dbHost = normalizeDbHost(env.FIREBASE_DB_HOST, projectId);
  const dbSecret = String(env.FIREBASE_DB_SECRET || '').trim();
  const explicitSessionSecret = String(env.SESSION_SECRET || '').trim();

  function hasServerDbCredentials() {
    return Boolean(parsedSa || dbSecret);
  }

  async function getTokenHashSecret(fallbackSeed = '') {
    if (explicitSessionSecret.length >= 16) return explicitSessionSecret;
    if (parsedSa && parsedSa.private_key) {
      return await sha256Hex(
        `abu_sa_sec:${parsedSa.client_email}:${parsedSa.private_key.slice(0, 256)}`
      );
    }
    if (dbSecret) return await sha256Hex(`abu_rtdb_sec:${dbSecret}`);
    if (fallbackSeed) return await sha256Hex(`abu_fb_seed:${fallbackSeed}`);
    const err = new Error('RTDB_NOT_CONFIGURED');
    err.code = 'RTDB_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  async function buildAuthCandidates(overrideIdToken = '') {
    const list = [];
    if (parsedSa) {
      list.push({
        type: 'sa',
        getQuery: async () => {
          const accessToken = await getServiceAccountAccessToken(parsedSa);
          return `access_token=${encodeURIComponent(accessToken)}`;
        },
      });
    }
    if (dbSecret) {
      list.push({
        type: 'secret',
        getQuery: async () => `auth=${encodeURIComponent(dbSecret)}`,
      });
    }
    if (overrideIdToken) {
      list.push({
        type: 'idToken',
        getQuery: async () => `auth=${encodeURIComponent(overrideIdToken)}`,
      });
    }
    return list;
  }

  async function rtdbRequest(
    rtdbPath,
    { method = 'GET', body, query = '', overrideIdToken = '' } = {}
  ) {
    const candidates = await buildAuthCandidates(overrideIdToken);
    if (!candidates.length) {
      const err = new Error('RTDB_NOT_CONFIGURED');
      err.code = 'RTDB_NOT_CONFIGURED';
      err.status = 503;
      throw err;
    }

    const [rawPath, inlineQuery] = String(rtdbPath || '').split('?');
    const cleanPath = rawPath.replace(/^\/+/, '');
    const extraQuery = [inlineQuery, query].filter(Boolean).join('&');
    let lastErr = null;

    for (const cand of candidates) {
      let authQ = '';
      try {
        authQ = await cand.getQuery();
      } catch (authErr) {
        lastErr = authErr;
        continue;
      }

      const url = `https://${dbHost}/abu_auth/${cleanPath}.json?${authQ}${extraQuery ? `&${extraQuery}` : ''}`;
      const opts = { method };
      if (body !== undefined) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }

      let res;
      try {
        res = await fetch(url, opts);
      } catch (netErr) {
        const err = new Error(`RTDB_UNREACHABLE: ${netErr?.message || 'network error'}`);
        err.code = 'RTDB_UNREACHABLE';
        err.status = 503;
        lastErr = err;
        continue;
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const txt = await res.text().catch(() => '');
        const err = new Error(`RTDB_PERMISSION_DENIED (${res.status}): ${txt.slice(0, 120)}`);
        err.code = 'RTDB_PERMISSION_DENIED';
        err.status = 503;
        lastErr = err;
        continue;
      }
      if (res.status === 404) {
        const err = new Error(`RTDB_HOST_NOT_FOUND (${dbHost})`);
        err.code = 'RTDB_HOST_NOT_FOUND';
        err.status = 503;
        throw err;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const err = new Error(`RTDB error (${res.status}): ${txt.slice(0, 120)}`);
        err.status = 502;
        throw err;
      }
      if (method === 'DELETE') return null;
      return res.json();
    }

    if (lastErr) {
      if (!lastErr.code) {
        lastErr.code = 'RTDB_PERMISSION_DENIED';
        lastErr.status = 503;
      }
      throw lastErr;
    }
    const err = new Error('RTDB_NOT_CONFIGURED');
    err.code = 'RTDB_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  async function hashToken(rawToken, fallbackSeed = '') {
    const secret = await getTokenHashSecret(fallbackSeed);
    return hmacSha256Hex(secret, String(rawToken || ''));
  }

  async function findUserById(id, opts = {}) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return null;
    return rtdbRequest(`users/${safeId}`, { overrideIdToken: opts.adminIdToken });
  }

  async function findUserByPhone(phone, opts = {}) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    const uid = await rtdbRequest(`phoneIndex/${norm}`, {
      overrideIdToken: opts.adminIdToken,
    });
    if (!uid) return null;
    return findUserById(uid, opts);
  }

  async function findUserByEmail(email, opts = {}) {
    const emailKey = encodeEmailKey(email);
    if (!emailKey) return null;
    const uid = await rtdbRequest(`emailIndex/${emailKey}`, {
      overrideIdToken: opts.adminIdToken,
    });
    if (!uid) return null;
    return findUserById(uid, opts);
  }

  async function findUserByIdentifier(identifier, opts = {}) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) {
      return findUserByEmail(raw, opts);
    }
    return findUserByPhone(raw, opts);
  }

  async function createUser({
    fullName,
    phone,
    email,
    shopName,
    address,
    notes,
    password,
  }) {
    const normPhone = normalizePhone(phone);
    const normEmail = normalizeEmail(email);

    const existingPhone = await rtdbRequest(`phoneIndex/${normPhone}`);
    if (existingPhone) {
      const err = new Error('DUPLICATE_PHONE');
      err.code = 'DUPLICATE_PHONE';
      err.status = 409;
      throw err;
    }

    const emailKey = normEmail ? encodeEmailKey(normEmail) : '';
    if (emailKey) {
      const existingEmail = await rtdbRequest(`emailIndex/${emailKey}`);
      if (existingEmail) {
        const err = new Error('DUPLICATE_EMAIL');
        err.code = 'DUPLICATE_EMAIL';
        err.status = 409;
        throw err;
      }
    }

    const now = new Date().toISOString();
    const id = `u_${Date.now().toString(36)}_${randomHex(5)}`;
    const passwordHash = await hashPasswordPBKDF2(password);

    const userRecord = {
      id,
      fullName: String(fullName || '').trim(),
      phone: normPhone,
      email: normEmail || '',
      shopName: shopName ? String(shopName).trim() : '',
      address: address ? String(address).trim() : '',
      notes: notes ? String(notes).trim() : '',
      passwordHash,
      status: 'Pending',
      rejectionReason: '',
      reviewedAt: '',
      reviewedBy: '',
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    await rtdbRequest(`users/${id}`, { method: 'PUT', body: userRecord });
    await rtdbRequest(`phoneIndex/${normPhone}`, { method: 'PUT', body: id });
    if (emailKey) {
      await rtdbRequest(`emailIndex/${emailKey}`, { method: 'PUT', body: id });
    }

    return userRecord;
  }

  async function listUsers(opts = {}) {
    const raw = await rtdbRequest('users', { overrideIdToken: opts.adminIdToken });
    const rows = raw && typeof raw === 'object' ? Object.values(raw) : [];
    const rank = { Pending: 0, Approved: 1, Suspended: 2, Rejected: 3 };
    rows.sort((a, b) => {
      const ra = rank[a?.status] ?? 4;
      const rb = rank[b?.status] ?? 4;
      if (ra !== rb) return ra - rb;
      return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''));
    });
    return rows.map(sanitizeUser);
  }

  async function updateUserStatus(
    id,
    status,
    { rejectionReason = null, reviewedBy = 'admin' } = {},
    opts = {}
  ) {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error('Invalid status');
    }
    const existing = await findUserById(id, opts);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextVersion =
      (Number(existing.tokenVersion) || 1) + (status !== 'Approved' ? 1 : 0);

    const patch = {
      status,
      rejectionReason:
        status === 'Rejected' && rejectionReason ? String(rejectionReason).trim() : '',
      reviewedAt: now,
      reviewedBy: String(reviewedBy || 'admin'),
      tokenVersion: nextVersion,
      updatedAt: now,
    };

    await rtdbRequest(`users/${existing.id}`, {
      method: 'PATCH',
      body: patch,
      overrideIdToken: opts.adminIdToken,
    });

    if (status !== 'Approved') {
      cleanupUserSessionsInBackground(existing.id, 'auth', opts).catch(() => {});
    }

    return { ...existing, ...patch };
  }

  async function cleanupUserSessionsInBackground(userId, onlyPurpose = null, opts = {}) {
    const allSess = await rtdbRequest('sessions', {
      overrideIdToken: opts.adminIdToken,
    });
    if (!allSess || typeof allSess !== 'object') return;
    const nowMs = Date.now();
    const tasks = [];
    for (const [tokenHash, s] of Object.entries(allSess)) {
      if (!s) continue;
      const expired = Number(s.expiresAt || 0) <= nowMs;
      const matchesUser = String(s.userId) === String(userId);
      const matchesPurpose = !onlyPurpose || s.purpose === onlyPurpose;
      if (expired || (matchesUser && matchesPurpose)) {
        tasks.push(
          rtdbRequest(`sessions/${tokenHash}`, {
            method: 'DELETE',
            overrideIdToken: opts.adminIdToken,
          }).catch(() => {})
        );
      }
    }
    await Promise.all(tasks);
  }

  async function deleteUserById(id, opts = {}) {
    const existing = await findUserById(id, opts);
    if (!existing) return false;

    if (existing.phone) {
      await rtdbRequest(`phoneIndex/${existing.phone}`, {
        method: 'DELETE',
        overrideIdToken: opts.adminIdToken,
      }).catch(() => {});
    }
    if (existing.email) {
      const ek = encodeEmailKey(existing.email);
      if (ek) {
        await rtdbRequest(`emailIndex/${ek}`, {
          method: 'DELETE',
          overrideIdToken: opts.adminIdToken,
        }).catch(() => {});
      }
    }
    await rtdbRequest(`users/${existing.id}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    cleanupUserSessionsInBackground(existing.id, null, opts).catch(() => {});
    removeAllUserPushSubscriptions(existing.id, opts).catch(() => {});
    return true;
  }

  async function createUserSession(
    userId,
    purpose = 'auth',
    ttlMs = 7 * 24 * 60 * 60 * 1000,
    userTokenVersion = 1
  ) {
    const rawToken = randomHex(32);
    const tokenHash = await hashToken(rawToken);
    const now = new Date().toISOString();
    const expiresAt = Date.now() + ttlMs;
    const rememberMe = ttlMs > 2 * 24 * 60 * 60 * 1000;

    await rtdbRequest(`sessions/${tokenHash}`, {
      method: 'PUT',
      body: {
        userId: String(userId),
        purpose,
        tokenVersion: Number(userTokenVersion) || 1,
        rememberMe,
        createdAt: now,
        expiresAt,
      },
    });

    return { rawToken, expiresAt };
  }

  async function extendUserSession(rawToken, ttlMs = 90 * 24 * 60 * 60 * 1000) {
    if (!rawToken || !hasServerDbCredentials()) return;
    const tokenHash = await hashToken(rawToken);
    await rtdbRequest(`sessions/${tokenHash}`, {
      method: 'PATCH',
      body: { expiresAt: Date.now() + ttlMs },
    }).catch(() => {});
  }

  async function getSessionWithUser(rawToken, expectedPurpose = 'auth') {
    if (!rawToken) return null;
    if (!hasServerDbCredentials()) return null;

    const tokenHash = await hashToken(rawToken);
    const sess = await rtdbRequest(`sessions/${tokenHash}`);
    if (!sess || !sess.userId) return null;

    const nowMs = Date.now();
    if (Number(sess.expiresAt || 0) <= nowMs) {
      rtdbRequest(`sessions/${tokenHash}`, { method: 'DELETE' }).catch(() => {});
      return null;
    }
    if (expectedPurpose && sess.purpose !== expectedPurpose) {
      return null;
    }

    const user = await findUserById(sess.userId);
    if (!user) {
      rtdbRequest(`sessions/${tokenHash}`, { method: 'DELETE' }).catch(() => {});
      return null;
    }

    if (
      expectedPurpose === 'auth' &&
      Number(sess.tokenVersion || 1) !== Number(user.tokenVersion || 1)
    ) {
      rtdbRequest(`sessions/${tokenHash}`, { method: 'DELETE' }).catch(() => {});
      return null;
    }

    return {
      tokenHash,
      purpose: sess.purpose,
      expiresAt: sess.expiresAt,
      rememberMe: Boolean(sess.rememberMe),
      user: sanitizeUser(user),
    };
  }

  async function revokeSessionToken(rawToken) {
    if (!rawToken || !hasServerDbCredentials()) return;
    const tokenHash = await hashToken(rawToken);
    await rtdbRequest(`sessions/${tokenHash}`, { method: 'DELETE' }).catch(() => {});
  }

  async function verifyPassword(password, storedHash) {
    return verifyPasswordPBKDF2(password, storedHash);
  }

  // ==================== PUSH SUBSCRIPTIONS & LOGS ====================
  async function computePushSubId(endpoint) {
    const digest = await sha256Hex(String(endpoint || '').trim());
    return `ps_${digest.slice(0, 32)}`;
  }

  async function upsertPushSubscription({
    userId,
    phone = '',
    fullName = '',
    shopName = '',
    address = '',
    subscription,
    userAgent = '',
    deviceLabel = '',
  }) {
    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const auth = String(subscription?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      throw new Error('INVALID_PUSH_SUBSCRIPTION');
    }

    const id = await computePushSubId(endpoint);
    const existing = await rtdbRequest(`pushSubs/${id}`).catch(() => null);
    if (existing && existing.userId && String(existing.userId) !== String(userId)) {
      await rtdbRequest(`userPushIdx/${existing.userId}/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
    }

    const now = new Date().toISOString();
    const record = {
      id,
      userId: String(userId),
      phone: String(phone || ''),
      fullName: String(fullName || ''),
      shopName: String(shopName || ''),
      address: String(address || ''),
      endpoint,
      keys: { p256dh, auth },
      userAgent: String(userAgent || '').slice(0, 220),
      deviceLabel: String(deviceLabel || '').slice(0, 80),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await rtdbRequest(`pushSubs/${id}`, { method: 'PUT', body: record });
    await rtdbRequest(`userPushIdx/${String(userId)}/${id}`, {
      method: 'PUT',
      body: true,
    });

    return {
      id: record.id,
      endpoint: record.endpoint,
      deviceLabel: record.deviceLabel,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async function removePushSubscription({ userId, endpoint }) {
    const cleanEndpoint = String(endpoint || '').trim();
    if (!cleanEndpoint) return false;
    const id = await computePushSubId(cleanEndpoint);
    const existing = await rtdbRequest(`pushSubs/${id}`).catch(() => null);
    if (!existing) {
      await rtdbRequest(`userPushIdx/${String(userId)}/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
      return false;
    }
    if (String(existing.userId) !== String(userId)) {
      return false;
    }
    await rtdbRequest(`pushSubs/${id}`, { method: 'DELETE' });
    await rtdbRequest(`userPushIdx/${String(userId)}/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
    return true;
  }

  async function removeAllUserPushSubscriptions(userId, opts = {}) {
    const idx = await rtdbRequest(`userPushIdx/${String(userId)}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (idx && typeof idx === 'object') {
      await Promise.all(
        Object.keys(idx).map((id) =>
          rtdbRequest(`pushSubs/${id}`, {
            method: 'DELETE',
            overrideIdToken: opts.adminIdToken,
          }).catch(() => {})
        )
      );
    }
    await rtdbRequest(`userPushIdx/${String(userId)}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    }).catch(() => {});
  }

  async function listUserPushSubscriptions(userId) {
    const idx = await rtdbRequest(`userPushIdx/${String(userId)}`).catch(() => null);
    if (!idx || typeof idx !== 'object') return [];
    const ids = Object.keys(idx);
    const items = await Promise.all(
      ids.map((id) => rtdbRequest(`pushSubs/${id}`).catch(() => null))
    );
    return items
      .filter((it) => it && String(it.userId) === String(userId))
      .map((it) => ({
        id: it.id,
        endpoint: it.endpoint,
        deviceLabel: it.deviceLabel || '',
        createdAt: it.createdAt || '',
        updatedAt: it.updatedAt || '',
      }));
  }

  async function listAllPushSubscriptions(opts = {}) {
    const raw = await rtdbRequest('pushSubs', { overrideIdToken: opts.adminIdToken });
    if (!raw || typeof raw !== 'object') return [];
    return Object.values(raw).filter(
      (it) => it && it.id && it.endpoint && it.keys?.p256dh && it.keys?.auth
    );
  }

  async function deletePushSubscriptionsByIds(ids = [], opts = {}) {
    if (!Array.isArray(ids) || !ids.length) return;
    await Promise.all(
      ids.map(async (id) => {
        const sub = await rtdbRequest(`pushSubs/${id}`, {
          overrideIdToken: opts.adminIdToken,
        }).catch(() => null);
        await rtdbRequest(`pushSubs/${id}`, {
          method: 'DELETE',
          overrideIdToken: opts.adminIdToken,
        }).catch(() => {});
        if (sub && sub.userId) {
          await rtdbRequest(`userPushIdx/${String(sub.userId)}/${id}`, {
            method: 'DELETE',
            overrideIdToken: opts.adminIdToken,
          }).catch(() => {});
        }
      })
    );
  }

  async function deletePushSubscriptionById(id, opts = {}) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return false;
    const sub = await rtdbRequest(`pushSubs/${safeId}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (!sub) return false;
    await rtdbRequest(`pushSubs/${safeId}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    if (sub.userId) {
      await rtdbRequest(`userPushIdx/${String(sub.userId)}/${safeId}`, {
        method: 'DELETE',
        overrideIdToken: opts.adminIdToken,
      }).catch(() => {});
    }
    return true;
  }

  async function savePushLog(logObj, opts = {}) {
    const id = logObj?.id || `pl_${Date.now().toString(36)}_${randomHex(4)}`;
    const failureReasons = Array.isArray(logObj?.failureReasons)
      ? logObj.failureReasons.slice(0, 8).map((x) => String(x || '').slice(0, 180))
      : [];
    const record = {
      id,
      title: String(logObj?.title || ''),
      body: String(logObj?.body || ''),
      url: String(logObj?.url || '/'),
      imageUrl: String(logObj?.imageUrl || ''),
      targetType: String(logObj?.targetType || 'all'),
      targetUserId: String(logObj?.targetUserId || ''),
      targetSegment: String(logObj?.targetSegment || ''),
      targetLabel: String(logObj?.targetLabel || ''),
      sentBy: String(logObj?.sentBy || 'admin'),
      totalTargets: Number(logObj?.totalTargets || 0),
      sentCount: Number(logObj?.sentCount || 0),
      failedCount: Number(logObj?.failedCount || 0),
      removedCount: Number(logObj?.removedCount || 0),
      failureReasons,
      status: String(logObj?.status || 'sent'),
      createdAt: logObj?.createdAt || new Date().toISOString(),
    };
    await rtdbRequest(`pushLogs/${id}`, {
      method: 'PUT',
      body: record,
      overrideIdToken: opts.adminIdToken,
    });
    return record;
  }

  async function listPushLogs(limit = 40, opts = {}) {
    const raw = await rtdbRequest('pushLogs', { overrideIdToken: opts.adminIdToken });
    if (!raw || typeof raw !== 'object') return [];
    const list = Object.values(raw).filter(Boolean).map((it) => ({
      ...it,
      failureReasons: Array.isArray(it.failureReasons) ? it.failureReasons : [],
    }));
    list.sort((a, b) =>
      String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
    );
    return list.slice(0, Math.max(1, Number(limit) || 40));
  }

  async function deletePushLogById(id, opts = {}) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return false;
    const existing = await rtdbRequest(`pushLogs/${safeId}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (!existing) return false;
    await rtdbRequest(`pushLogs/${safeId}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    return true;
  }

  async function clearPushLogs(opts = {}) {
    await rtdbRequest('pushLogs', {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    return true;
  }

  async function savePushImage({ mime, base64 }, opts = {}) {
    const id = `pi_${Date.now().toString(36)}_${randomHex(4)}`;
    await rtdbRequest(`pushImgs/${id}`, {
      method: 'PUT',
      body: {
        id,
        mime: String(mime || 'image/jpeg'),
        base64: String(base64 || ''),
        createdAt: new Date().toISOString(),
      },
      overrideIdToken: opts.adminIdToken,
    });
    return id;
  }

  async function getPushImage(id) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return null;
    return rtdbRequest(`pushImgs/${safeId}`).catch(() => null);
  }

  // ==================== ORDERS HISTORY ====================
  const VALID_ORDER_STATUSES = [
    'sent_whatsapp',
    'confirmed',
    'completed',
    'cancelled',
  ];

  function sanitizeOrder(o) {
    if (!o || !o.id) return null;
    return {
      id: String(o.id),
      userId: String(o.userId || ''),
      userName: String(o.userName || ''),
      userPhone: String(o.userPhone || ''),
      shopName: String(o.shopName || ''),
      address: String(o.address || ''),
      orderType: o.orderType === 'offer' ? 'offer' : 'cart',
      items: Array.isArray(o.items) ? o.items : [],
      totalQty: Number(o.totalQty || 0),
      totalPrice: Number(o.totalPrice || 0),
      unit: String(o.unit || 'كرتونة'),
      offerPriceLabel: String(o.offerPriceLabel || ''),
      whatsappPhone: String(o.whatsappPhone || ''),
      whatsappMessage: String(o.whatsappMessage || ''),
      status: VALID_ORDER_STATUSES.includes(o.status) ? o.status : 'sent_whatsapp',
      createdAt: String(o.createdAt || ''),
      updatedAt: String(o.updatedAt || ''),
    };
  }

  async function fetchRawUserOrders(userId, limit = 60) {
    const uid = String(userId || '').trim();
    if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) return [];
    const idx = await rtdbRequest(`userOrdersIdx/${uid}`).catch(() => null);
    if (!idx || typeof idx !== 'object') return [];
    const ids = Object.keys(idx);
    const items = await Promise.all(
      ids.map((id) => rtdbRequest(`orders/${id}`).catch(() => null))
    );
    return items
      .filter((it) => it && String(it.userId) === uid)
      .sort((a, b) =>
        String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
      )
      .slice(0, Math.max(1, Math.min(200, Number(limit) || 60)));
  }

  async function createOrder(orderData) {
    const uid = String(orderData?.userId || '').trim();
    if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) {
      throw new Error('INVALID_ORDER_USER');
    }
    const fingerprint = String(orderData?.fingerprint || '');
    if (fingerprint) {
      const existingList = await fetchRawUserOrders(uid, 5).catch(() => []);
      const dup = existingList.find((o) => {
        if (!o || o._fingerprint !== fingerprint) return false;
        const ageMs = Date.now() - new Date(o.createdAt).getTime();
        return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 4000;
      });
      if (dup) {
        return { order: sanitizeOrder(dup), deduplicated: true };
      }
    }

    const now = orderData?.createdAt || new Date().toISOString();
    const id = String(orderData?.id || `ord_${Date.now().toString(36)}_${randomHex(4)}`);
    const record = {
      id,
      userId: uid,
      userName: String(orderData?.userName || ''),
      userPhone: String(orderData?.userPhone || ''),
      shopName: String(orderData?.shopName || ''),
      address: String(orderData?.address || ''),
      orderType: orderData?.orderType === 'offer' ? 'offer' : 'cart',
      items: Array.isArray(orderData?.items) ? orderData.items : [],
      totalQty: Number(orderData?.totalQty || 0),
      totalPrice: Number(orderData?.totalPrice || 0),
      unit: String(orderData?.unit || 'كرتونة'),
      offerPriceLabel: String(orderData?.offerPriceLabel || ''),
      whatsappPhone: String(orderData?.whatsappPhone || ''),
      whatsappMessage: String(orderData?.whatsappMessage || ''),
      status: VALID_ORDER_STATUSES.includes(orderData?.status)
        ? orderData.status
        : 'sent_whatsapp',
      _fingerprint: fingerprint,
      createdAt: now,
      updatedAt: orderData?.updatedAt || now,
    };

    await rtdbRequest(`orders/${id}`, { method: 'PUT', body: record });
    await rtdbRequest(`userOrdersIdx/${uid}/${id}`, { method: 'PUT', body: true });
    return { order: sanitizeOrder(record), deduplicated: false };
  }

  async function listUserOrders(userId, limit = 60) {
    const list = await fetchRawUserOrders(userId, limit);
    return list.map((it) => sanitizeOrder(it)).filter(Boolean);
  }

  async function listAllOrders(limit = 150, opts = {}) {
    const raw = await rtdbRequest('orders', { overrideIdToken: opts.adminIdToken });
    if (!raw || typeof raw !== 'object') return [];
    const list = Object.values(raw).filter((it) => it && it.id);
    list.sort((a, b) =>
      String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
    );
    return list
      .slice(0, Math.max(1, Math.min(300, Number(limit) || 150)))
      .map((it) => sanitizeOrder(it))
      .filter(Boolean);
  }

  async function updateOrderStatus(orderId, status, opts = {}) {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      throw new Error('INVALID_ORDER_STATUS');
    }
    const safeId = String(orderId || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return null;
    const existing = await rtdbRequest(`orders/${safeId}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (!existing) return null;
    const patch = {
      status,
      updatedAt: new Date().toISOString(),
    };
    await rtdbRequest(`orders/${safeId}`, {
      method: 'PATCH',
      body: patch,
      overrideIdToken: opts.adminIdToken,
    });
    return sanitizeOrder({ ...existing, ...patch });
  }

  async function deleteUserOrder(userId, orderId) {
    const uid = String(userId || '').trim();
    const safeId = String(orderId || '').trim();
    if (
      !uid ||
      !/^[a-zA-Z0-9_-]+$/.test(uid) ||
      !safeId ||
      !/^[a-zA-Z0-9_-]+$/.test(safeId)
    ) {
      return false;
    }
    const existing = await rtdbRequest(`orders/${safeId}`).catch(() => null);
    if (!existing || String(existing.userId || '') !== uid) return false;
    await rtdbRequest(`orders/${safeId}`, { method: 'DELETE' });
    await rtdbRequest(`userOrdersIdx/${uid}/${safeId}`, { method: 'DELETE' }).catch(() => {});
    return true;
  }

  async function clearUserOrders(userId) {
    const uid = String(userId || '').trim();
    if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) return 0;
    const idx = await rtdbRequest(`userOrdersIdx/${uid}`).catch(() => null);
    if (!idx || typeof idx !== 'object') return 0;
    const ids = Object.keys(idx).filter((id) => /^[a-zA-Z0-9_-]+$/.test(id));
    let deleted = 0;
    await Promise.all(
      ids.map(async (id) => {
        const existing = await rtdbRequest(`orders/${id}`).catch(() => null);
        if (existing && String(existing.userId || '') === uid) {
          await rtdbRequest(`orders/${id}`, { method: 'DELETE' }).catch(() => {});
          deleted += 1;
        }
      })
    );
    await rtdbRequest(`userOrdersIdx/${uid}`, { method: 'DELETE' }).catch(() => {});
    return deleted;
  }

  async function deleteOrderById(orderId, opts = {}) {
    const safeId = String(orderId || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return false;
    const existing = await rtdbRequest(`orders/${safeId}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (!existing) return false;
    await rtdbRequest(`orders/${safeId}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    if (existing.userId) {
      await rtdbRequest(`userOrdersIdx/${String(existing.userId)}/${safeId}`, {
        method: 'DELETE',
        overrideIdToken: opts.adminIdToken,
      }).catch(() => {});
    }
    return true;
  }

  async function clearAllOrders(opts = {}) {
    const shallow = await rtdbRequest('orders', {
      query: 'shallow=true',
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    const count = shallow && typeof shallow === 'object' ? Object.keys(shallow).length : 0;
    await rtdbRequest('orders', {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    await rtdbRequest('userOrdersIdx', {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    }).catch(() => {});
    return count;
  }

  // ==================== AUDIT LOGS & CATALOG BACKUPS ====================
  async function addAuditLog(entry = {}, opts = {}) {
    const id = `aud_${Date.now().toString(36)}_${randomHex(4)}`;
    const record = {
      id,
      action: String(entry.action || 'event').slice(0, 64),
      actorEmail: String(entry.actorEmail || 'admin').slice(0, 120),
      entityType: String(entry.entityType || 'system').slice(0, 48),
      entityId: String(entry.entityId || '').slice(0, 120),
      entityLabel: String(entry.entityLabel || '').slice(0, 180),
      details: String(entry.details || '').slice(0, 600),
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    await rtdbRequest(`auditLogs/${id}`, {
      method: 'PUT',
      body: record,
      overrideIdToken: opts.adminIdToken,
    });
    return record;
  }

  async function listAuditLogs({ limit = 150, entityType = '', entityId = '' } = {}, opts = {}) {
    const raw = await rtdbRequest('auditLogs', { overrideIdToken: opts.adminIdToken });
    if (!raw || typeof raw !== 'object') return [];
    let list = Object.values(raw).filter(Boolean);
    if (entityType) list = list.filter((it) => it.entityType === entityType);
    if (entityId) list = list.filter((it) => String(it.entityId) === String(entityId));
    list.sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
    return list.slice(0, Math.max(1, Math.min(400, Number(limit) || 150)));
  }

  async function createBackup(
    { label, actorEmail = 'admin', triggerType = 'manual', stats = {}, payload = {} },
    opts = {}
  ) {
    const id = `bak_${Date.now().toString(36)}_${randomHex(3)}`;
    const createdAt = new Date().toISOString();
    const safeStats = {
      products: Number(stats.products || 0),
      categories: Number(stats.categories || 0),
      offers: Number(stats.offers || 0),
      images: Number(stats.images || 0),
    };
    const record = {
      id,
      label: String(label || 'نسخة احتياطية').slice(0, 140),
      actorEmail: String(actorEmail || 'admin').slice(0, 120),
      triggerType: String(triggerType || 'manual').slice(0, 32),
      stats: safeStats,
      payload: payload || {},
      createdAt,
    };
    await rtdbRequest(`backups/${id}`, {
      method: 'PUT',
      body: record,
      overrideIdToken: opts.adminIdToken,
    });
    return {
      id: record.id,
      label: record.label,
      actorEmail: record.actorEmail,
      triggerType: record.triggerType,
      stats: record.stats,
      createdAt: record.createdAt,
    };
  }

  async function listBackups(limit = 40, opts = {}) {
    const raw = await rtdbRequest('backups', { overrideIdToken: opts.adminIdToken });
    if (!raw || typeof raw !== 'object') return [];
    const list = Object.values(raw)
      .filter((it) => it && it.id)
      .map((it) => ({
        id: it.id,
        label: it.label || 'نسخة احتياطية',
        actorEmail: it.actorEmail || 'admin',
        triggerType: it.triggerType || 'manual',
        stats: it.stats || { products: 0, categories: 0, offers: 0, images: 0 },
        createdAt: it.createdAt || '',
      }));
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return list.slice(0, Math.max(1, Math.min(100, Number(limit) || 40)));
  }

  async function getBackupById(id, opts = {}) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return null;
    const it = await rtdbRequest(`backups/${safeId}`, {
      overrideIdToken: opts.adminIdToken,
    }).catch(() => null);
    if (!it || !it.id) return null;
    return {
      id: it.id,
      label: it.label || 'نسخة احتياطية',
      actorEmail: it.actorEmail || 'admin',
      triggerType: it.triggerType || 'manual',
      stats: it.stats || {},
      payload: it.payload || {},
      createdAt: it.createdAt || '',
    };
  }

  async function deleteBackupById(id, opts = {}) {
    const safeId = String(id || '').trim();
    if (!safeId || !/^[a-zA-Z0-9_-]+$/.test(safeId)) return false;
    await rtdbRequest(`backups/${safeId}`, {
      method: 'DELETE',
      overrideIdToken: opts.adminIdToken,
    });
    return true;
  }

  async function pingRtdb(opts = {}) {
    const started = Date.now();
    await rtdbRequest('users', { query: 'shallow=true', overrideIdToken: opts.adminIdToken });
    return { ok: true, latencyMs: Date.now() - started };
  }

  return {
    mode: 'rtdb',
    hasServerDbCredentials,
    toAsciiDigits: (v) => String(v || ''),
    normalizePhone,
    isValidPhone,
    normalizeEmail,
    isValidEmail,
    sanitizeUser,
    verifyPassword,
    findUserByPhone,
    findUserByEmail,
    findUserByIdentifier,
    findUserById,
    createUser,
    listUsers,
    updateUserStatus,
    deleteUserById,
    createUserSession,
    extendUserSession,
    getSessionWithUser,
    revokeSessionToken,
    upsertPushSubscription,
    removePushSubscription,
    listUserPushSubscriptions,
    listAllPushSubscriptions,
    deletePushSubscriptionsByIds,
    deletePushSubscriptionById,
    savePushLog,
    listPushLogs,
    deletePushLogById,
    clearPushLogs,
    savePushImage,
    getPushImage,
    createOrder,
    listUserOrders,
    listAllOrders,
    updateOrderStatus,
    deleteUserOrder,
    clearUserOrders,
    deleteOrderById,
    clearAllOrders,
    addAuditLog,
    listAuditLogs,
    createBackup,
    listBackups,
    getBackupById,
    deleteBackupById,
    pingRtdb,
  };
}
