import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const ACCOUNT_STATUSES = ['Pending', 'Approved', 'Rejected', 'Suspended'];

const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'abusaid.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    business_name TEXT NOT NULL DEFAULT '',
    city_address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Suspended')),
    rejection_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    last_login_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('customer', 'admin')),
    fb_id_token TEXT,
    fb_refresh_token TEXT,
    fb_expires_at INTEGER DEFAULT 0,
    revoked_status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    action TEXT NOT NULL,
    target_user_id INTEGER,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv_store (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE sessions ADD COLUMN revoked_status TEXT NOT NULL DEFAULT ''");
} catch {
  // column already exists
}

export function toAsciiDigits(val) {
  return String(val == null ? '' : val)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function normalizePhone(raw) {
  let digits = toAsciiDigits(raw).replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('0020') && digits.length >= 14) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('20') && digits.length === 12 && digits[2] === '1') {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits;
  }
  return digits;
}

export function isValidPhone(digits) {
  return /^\d{10,15}$/.test(digits);
}

export function normalizeEmail(raw) {
  const s = toAsciiDigits(raw).trim().toLowerCase();
  return s || null;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$16384$8$1$${salt}$${derived.toString('hex')}`);
    });
  });
}

export function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || typeof storedHash !== 'string') return resolve(false);
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const hashHex = parts[5];
    if (!N || !r || !p || !salt || !hashHex) return resolve(false);
    crypto.scrypt(String(password), salt, 64, { N, r, p }, (err, derived) => {
      if (err) return resolve(false);
      try {
        const expected = Buffer.from(hashHex, 'hex');
        if (expected.length !== derived.length) return resolve(false);
        resolve(crypto.timingSafeEqual(expected, derived));
      } catch {
        resolve(false);
      }
    });
  });
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email || null,
    businessName: row.business_name || '',
    cityAddress: row.city_address || '',
    notes: row.notes || '',
    role: row.role,
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at || null,
    lastLoginAt: row.last_login_at || null,
  };
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) || null;
}

export function getUserByPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(norm) || null;
}

export function getUserByEmail(email) {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(norm) || null;
}

export function findUserByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    return getUserByEmail(raw);
  }
  const byPhone = getUserByPhone(raw);
  if (byPhone) return byPhone;
  return getUserByEmail(raw);
}

export async function createCustomerUser({
  fullName,
  phone,
  email = null,
  businessName = '',
  cityAddress = '',
  notes = '',
  password,
}) {
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);

  const stmt = db.prepare(`
    INSERT INTO users (
      full_name, phone, email, business_name, city_address, notes,
      password_hash, role, status, rejection_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', 'Pending', '', ?, ?)
  `);
  const info = stmt.run(
    fullName.trim(),
    normPhone,
    normEmail,
    String(businessName || '').trim(),
    String(cityAddress || '').trim(),
    String(notes || '').trim(),
    passwordHash,
    now,
    now
  );
  return getUserById(info.lastInsertRowid);
}

export async function upsertAdminUser({ email, fullName = 'إدارة المتجر', password = '' }) {
  const normEmail = normalizeEmail(email);
  if (!normEmail) throw new Error('Admin email required');
  const existing = getUserByEmail(normEmail);
  const now = new Date().toISOString();
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('ACCOUNT_IS_CUSTOMER');
    }
    if (password) {
      const hash = await hashPassword(password);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ?, last_login_at = ?, status = ? WHERE id = ?')
        .run(hash, now, now, 'Approved', existing.id);
    } else {
      db.prepare('UPDATE users SET updated_at = ?, last_login_at = ?, status = ? WHERE id = ?')
        .run(now, now, 'Approved', existing.id);
    }
    return getUserById(existing.id);
  }

  const hash = await hashPassword(password || crypto.randomBytes(24).toString('hex'));
  const pseudoPhone = 'admin_' + crypto.createHash('sha1').update(normEmail).digest('hex').slice(0, 12);
  const info = db.prepare(`
    INSERT INTO users (
      full_name, phone, email, business_name, city_address, notes,
      password_hash, role, status, rejection_reason, created_at, updated_at, approved_at, last_login_at
    ) VALUES (?, ?, ?, 'الإدارة', '', '', ?, 'admin', 'Approved', '', ?, ?, ?, ?)
  `).run(fullName, pseudoPhone, normEmail, hash, now, now, now, now);
  return getUserById(info.lastInsertRowid);
}

export function createSession({
  userId,
  role,
  fbIdToken = null,
  fbRefreshToken = null,
  fbExpiresAt = 0,
  ttlMs = 7 * 24 * 60 * 60 * 1000,
}) {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  db.prepare(`
    INSERT INTO sessions (
      token_hash, user_id, role, fb_id_token, fb_refresh_token, fb_expires_at, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tokenHash,
    userId,
    role,
    fbIdToken,
    fbRefreshToken,
    fbExpiresAt || 0,
    now.toISOString(),
    expiresAt.toISOString()
  );

  return { rawToken, tokenHash, expiresAt };
}

export function getSessionWithUser(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashToken(rawToken);
  const row = db.prepare(`
    SELECT
      s.token_hash, s.user_id, s.role AS session_role,
      s.fb_id_token, s.fb_refresh_token, s.fb_expires_at,
      s.revoked_status,
      s.created_at AS session_created_at, s.expires_at,
      u.id, u.full_name, u.phone, u.email, u.business_name, u.city_address, u.notes,
      u.role, u.status, u.rejection_reason, u.created_at, u.updated_at, u.approved_at, u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash);

  if (!row) return null;
  return row;
}

export function updateSessionFirebaseTokens(tokenHash, { fbIdToken, fbRefreshToken, fbExpiresAt }) {
  db.prepare(`
    UPDATE sessions
    SET fb_id_token = ?, fb_refresh_token = ?, fb_expires_at = ?
    WHERE token_hash = ?
  `).run(fbIdToken, fbRefreshToken, fbExpiresAt, tokenHash);
}

export function deleteSession(rawToken) {
  if (!rawToken) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

export function deleteSessionByHash(tokenHash) {
  if (!tokenHash) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(userId));
}

export function revokeUserSessions(userId, statusReason) {
  db.prepare('UPDATE sessions SET revoked_status = ? WHERE user_id = ?').run(
    String(statusReason || 'Suspended'),
    Number(userId)
  );
}

export function pruneExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

export function touchUserLastLogin(userId) {
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, Number(userId));
}

export function listCustomerUsers({ status = '', q = '' } = {}) {
  const rows = db.prepare(`
    SELECT * FROM users
    WHERE role = 'customer'
    ORDER BY
      CASE status WHEN 'Pending' THEN 0 WHEN 'Suspended' THEN 1 WHEN 'Approved' THEN 2 ELSE 3 END,
      created_at DESC,
      id DESC
  `).all();

  const counts = { all: rows.length, Pending: 0, Approved: 0, Rejected: 0, Suspended: 0 };
  for (const r of rows) {
    if (counts[r.status] != null) counts[r.status]++;
  }

  const qNorm = toAsciiDigits(q).trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (status && status !== 'all' && r.status !== status) return false;
    if (!qNorm) return true;
    const hay = [
      r.full_name,
      r.phone,
      r.email || '',
      r.business_name || '',
      r.city_address || '',
    ].join(' ').toLowerCase();
    return hay.includes(qNorm);
  });

  return {
    counts,
    users: filtered.map(sanitizeUser),
  };
}

export function updateCustomerStatus(userId, newStatus, reason = '', actorId = null) {
  if (!ACCOUNT_STATUSES.includes(newStatus)) {
    throw new Error('INVALID_STATUS');
  }
  const user = getUserById(userId);
  if (!user || user.role !== 'customer') return null;

  const now = new Date().toISOString();
  const approvedAt = newStatus === 'Approved' ? now : user.approved_at;
  const rejectionReason =
    newStatus === 'Approved' ? '' : String(reason || '').trim();

  db.prepare(`
    UPDATE users
    SET status = ?, rejection_reason = ?, approved_at = ?, updated_at = ?
    WHERE id = ? AND role = 'customer'
  `).run(newStatus, rejectionReason, approvedAt, now, Number(userId));

  if (newStatus === 'Rejected' || newStatus === 'Suspended' || newStatus === 'Pending') {
    revokeUserSessions(userId, newStatus);
  }

  logAudit(actorId, `USER_STATUS_${newStatus.toUpperCase()}`, userId, rejectionReason || `Status changed to ${newStatus}`);
  return getUserById(userId);
}

export function deleteCustomerUser(userId, actorId = null) {
  const user = getUserById(userId);
  if (!user || user.role !== 'customer') return false;
  deleteUserSessions(userId);
  const res = db.prepare("DELETE FROM users WHERE id = ? AND role = 'customer'").run(Number(userId));
  if (res.changes > 0) {
    logAudit(actorId, 'USER_DELETED', userId, `${user.full_name} (${user.phone})`);
    return true;
  }
  return false;
}

export function logAudit(actorId, action, targetUserId = null, details = '') {
  db.prepare(`
    INSERT INTO audit_logs (actor_id, action, target_user_id, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(actorId, action, targetUserId, String(details || ''), new Date().toISOString());
}

export function getKv(key) {
  const row = db.prepare('SELECT v FROM kv_store WHERE k = ?').get(String(key));
  if (!row) return null;
  try {
    return JSON.parse(row.v);
  } catch {
    return null;
  }
}

export function setKv(key, value) {
  db.prepare(`
    INSERT INTO kv_store (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at
  `).run(String(key), JSON.stringify(value), new Date().toISOString());
}

export async function ensureEnvAdminSeed() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && password.length >= 6) {
    try {
      await upsertAdminUser({ email, fullName: 'إدارة المتجر', password });
    } catch {
      // ignore if conflict with existing customer email
    }
  }
}

export default db;
