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
    { method = 'GET', body, overrideIdToken = '' } = {}
  ) {
    const candidates = await buildAuthCandidates(overrideIdToken);
    if (!candidates.length) {
      const err = new Error('RTDB_NOT_CONFIGURED');
      err.code = 'RTDB_NOT_CONFIGURED';
      err.status = 503;
      throw err;
    }

    const cleanPath = String(rtdbPath || '').replace(/^\/+/, '');
    let lastErr = null;

    for (const cand of candidates) {
      let authQ = '';
      try {
        authQ = await cand.getQuery();
      } catch (authErr) {
        lastErr = authErr;
        continue;
      }

      const url = `https://${dbHost}/abu_auth/${cleanPath}.json?${authQ}`;
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

  async function savePushLog(logObj, opts = {}) {
    const id = logObj?.id || `pl_${Date.now().toString(36)}_${randomHex(4)}`;
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
    const list = Object.values(raw).filter(Boolean);
    list.sort((a, b) =>
      String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
    );
    return list.slice(0, Math.max(1, Number(limit) || 40));
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
    savePushLog,
    listPushLogs,
    savePushImage,
    getPushImage,
  };
}
