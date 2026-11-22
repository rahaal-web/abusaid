import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'abusaid.db');
const SECRET_PATH = path.join(DATA_DIR, '.session_secret');

function loadSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_PATH)) {
      const saved = fs.readFileSync(SECRET_PATH, 'utf8').trim();
      if (saved.length >= 32) return saved;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_PATH, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(48).toString('hex');
  }
}

export const SESSION_SECRET = loadSessionSecret();

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    shop_name TEXT,
    address TEXT,
    notes TEXT,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Suspended')),
    rejection_reason TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'auth' CHECK(purpose IN ('auth', 'status')),
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    uid TEXT,
    fb_id_token TEXT NOT NULL,
    fb_refresh_token TEXT NOT NULL,
    fb_expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
`);

export const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Suspended'];

export function toAsciiDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function normalizePhone(raw) {
  let digits = toAsciiDigits(raw).replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = '0' + digits.slice(2);
  return digits;
}

export function isValidPhone(phone) {
  return /^\d{10,15}$/.test(phone);
}

export function normalizeEmail(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s || null;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!Number.isFinite(iterations) || iterations < 10000 || !saltHex || !hashHex) {
      return false;
    }
    try {
      const salt = Buffer.from(saltHex, 'hex');
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.pbkdf2Sync(String(password), salt, iterations, expected.length, 'sha256');
      if (expected.length !== actual.length) return false;
      return crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
  if (!storedHash.includes(':')) return false;
  const [salt, hexHash] = storedHash.split(':');
  if (!salt || !hexHash) return false;
  try {
    const expected = Buffer.from(hexHash, 'hex');
    const actual = crypto.scryptSync(String(password), salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(String(rawToken || ''))
    .digest('hex');
}

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email || '',
    shopName: row.shop_name || '',
    address: row.address || '',
    notes: row.notes || '',
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    reviewedAt: row.reviewed_at || '',
    reviewedBy: row.reviewed_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findUserByPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(norm) || null;
}

export function findUserByEmail(email) {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  return db.prepare('SELECT * FROM users WHERE email = ?').get(norm) || null;
}

export function findUserByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    return findUserByEmail(raw);
  }
  return findUserByPhone(raw);
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) || null;
}

export function createUser({ fullName, phone, email, shopName, address, notes, password }) {
  const now = new Date().toISOString();
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);
  const passwordHash = hashPassword(password);

  const stmt = db.prepare(`
    INSERT INTO users (
      full_name, phone, email, shop_name, address, notes,
      password_hash, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
  `);

  const info = stmt.run(
    fullName.trim(),
    normPhone,
    normEmail,
    shopName ? shopName.trim() : null,
    address ? address.trim() : null,
    notes ? notes.trim() : null,
    passwordHash,
    now,
    now
  );

  return findUserById(info.lastInsertRowid);
}

export function listUsers() {
  return db
    .prepare(`
      SELECT * FROM users
      ORDER BY
        CASE status
          WHEN 'Pending' THEN 0
          WHEN 'Approved' THEN 1
          WHEN 'Suspended' THEN 2
          WHEN 'Rejected' THEN 3
          ELSE 4
        END ASC,
        datetime(created_at) DESC,
        id DESC
    `)
    .all()
    .map(sanitizeUser);
}

export function updateUserStatus(id, status, { rejectionReason = null, reviewedBy = 'admin' } = {}) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }
  const now = new Date().toISOString();
  const existing = findUserById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE users
    SET status = ?,
        rejection_reason = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    status === 'Rejected' ? (rejectionReason ? String(rejectionReason).trim() : null) : null,
    now,
    reviewedBy,
    now,
    Number(id)
  );

  if (status !== 'Approved') {
    revokeUserAuthSessions(id);
  }

  return findUserById(id);
}

export function deleteUserById(id) {
  const existing = findUserById(id);
  if (!existing) return false;
  revokeAllUserSessions(id);
  const res = db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return res.changes > 0;
}

export function createUserSession(userId, purpose = 'auth', ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + ttlMs;

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, purpose, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, Number(userId), purpose, now, expiresAt);

  return { rawToken, expiresAt };
}

export function getSessionWithUser(rawToken, expectedPurpose = 'auth') {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const nowMs = Date.now();

  const row = db
    .prepare(`
      SELECT
        s.token_hash,
        s.purpose,
        s.expires_at,
        u.id AS u_id,
        u.full_name,
        u.phone,
        u.email,
        u.shop_name,
        u.address,
        u.notes,
        u.status,
        u.rejection_reason,
        u.reviewed_at,
        u.reviewed_by,
        u.created_at,
        u.updated_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(tokenHash);

  if (!row) return null;

  if (row.expires_at <= nowMs || (expectedPurpose && row.purpose !== expectedPurpose)) {
    if (row.expires_at <= nowMs) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    return null;
  }

  return {
    tokenHash: row.token_hash,
    purpose: row.purpose,
    expiresAt: row.expires_at,
    user: sanitizeUser({
      id: row.u_id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      shop_name: row.shop_name,
      address: row.address,
      notes: row.notes,
      status: row.status,
      rejection_reason: row.rejection_reason,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
  };
}

export function revokeSessionToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function revokeUserAuthSessions(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND purpose = 'auth'").run(Number(userId));
}

export function revokeAllUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(userId));
}

export function createAdminSession({ email, uid, fbIdToken, fbRefreshToken, fbExpiresInSec }) {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const fbExpiresAt = Date.now() + (Number(fbExpiresInSec) || 3600) * 1000;

  db.prepare(`
    INSERT INTO admin_sessions (
      token_hash, email, uid, fb_id_token, fb_refresh_token, fb_expires_at, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tokenHash, email, uid || '', fbIdToken, fbRefreshToken, fbExpiresAt, now, expiresAt);

  return { rawToken, expiresAt };
}

export function getAdminSession(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare('SELECT * FROM admin_sessions WHERE token_hash = ?')
    .get(tokenHash);

  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return row;
}

export function updateAdminFirebaseTokens(tokenHash, fbIdToken, fbRefreshToken, fbExpiresInSec) {
  const fbExpiresAt = Date.now() + (Number(fbExpiresInSec) || 3600) * 1000;
  db.prepare(`
    UPDATE admin_sessions
    SET fb_id_token = ?, fb_refresh_token = ?, fb_expires_at = ?
    WHERE token_hash = ?
  `).run(fbIdToken, fbRefreshToken, fbExpiresAt, tokenHash);
}

export function revokeAdminSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
}

export function cleanupExpiredSessions() {
  const nowMs = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowMs);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(nowMs);
}
