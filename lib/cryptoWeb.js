const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  return /^\d{10,15}$/.test(String(phone || ''));
}

export function normalizeEmail(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s || null;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (!clean || clean.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(str) {
  const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function encodeEmailKey(email) {
  const norm = normalizeEmail(email);
  if (!norm) return '';
  return bytesToBase64Url(encoder.encode(norm));
}

export function randomHex(byteLen = 32) {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

export function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function timingSafeEqualStr(a, b) {
  const ba = encoder.encode(String(a || ''));
  const bb = encoder.encode(String(b || ''));
  return timingSafeEqualBytes(ba, bb);
}

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(input || '')));
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(message || '')));
  return bytesToHex(new Uint8Array(sig));
}

const PBKDF2_ITERATIONS = 100000;

export async function hashPasswordPBKDF2(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPasswordPBKDF2(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  if (!Number.isFinite(iterations) || iterations < 10000 || !salt.length || !expected.length) {
    return false;
  }
  try {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(password || '')),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      expected.length * 8
    );
    return timingSafeEqualBytes(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

// ===== Firebase ID Token (RS256) verification using Google's public JWKs =====
let jwkCache = { keys: null, expiresAt: 0 };

async function fetchFirebaseJwks(force = false) {
  if (!force && jwkCache.keys && Date.now() < jwkCache.expiresAt) {
    return jwkCache.keys;
  }
  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase public keys');
  }
  const cc = res.headers.get('cache-control') || '';
  const match = cc.match(/max-age=(\d+)/i);
  const maxAgeMs = match ? Number(match[1]) * 1000 : 3600 * 1000;
  const data = await res.json();
  jwkCache = {
    keys: Array.isArray(data.keys) ? data.keys : [],
    expiresAt: Date.now() + Math.max(60000, maxAgeMs),
  };
  return jwkCache.keys;
}

export async function verifyFirebaseIdToken(idToken, expectedProjectId) {
  const token = String(idToken || '').trim();
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(decoder.decode(base64UrlToBytes(segments[0])));
    payload = JSON.parse(decoder.decode(base64UrlToBytes(segments[1])));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { expired: true, payload };
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
  if (payload.aud !== expectedProjectId) return null;
  if (payload.iss !== `https://securetoken.googleapis.com/${expectedProjectId}`) return null;
  if (!payload.sub || typeof payload.sub !== 'string') return null;

  let keys = await fetchFirebaseJwks(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchFirebaseJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToBytes(segments[2]);
    const signedData = encoder.encode(`${segments[0]}.${segments[1]}`);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      sigBytes,
      signedData
    );
    if (!valid) return null;
    return {
      expired: false,
      uid: payload.sub,
      email: payload.email || '',
      emailVerified: Boolean(payload.email_verified),
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

// ===== Google Service Account OAuth2 Token (Web Crypto RS256, Worker + Node compatible) =====
let saTokenCache = { cacheKey: '', token: '', expiresAt: 0 };

function pemToArrayBuffer(pem) {
  const b64 = String(pem || '')
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getServiceAccountAccessToken(saJsonInput) {
  const sa =
    typeof saJsonInput === 'string' ? JSON.parse(saJsonInput) : saJsonInput;
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Invalid service account JSON');
  }

  const cacheKey = `${sa.client_email}:${sa.private_key_id || ''}`;
  if (
    saTokenCache.cacheKey === cacheKey &&
    saTokenCache.token &&
    Date.now() < saTokenCache.expiresAt - 120000
  ) {
    return saTokenCache.token;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const headerB64 = bytesToBase64Url(
    encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  );
  const claimB64 = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope:
          'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: 'https://oauth2.googleapis.com/token',
        iat: nowSec,
        exp: nowSec + 3600,
      })
    )
  );
  const unsigned = `${headerB64}.${claimB64}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsigned)
  );
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(sigBuf))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(
      assertion
    )}`,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'OAUTH_TOKEN_FAILED');
  }

  saTokenCache = {
    cacheKey,
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return saTokenCache.token;
}
