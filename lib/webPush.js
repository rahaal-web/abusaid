const encoder = new TextEncoder();

export function base64UrlEncode(input) {
  const bytes =
    input instanceof Uint8Array
      ? input
      : ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : encoder.encode(String(input || ''));

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(str) {
  const clean = String(str || '').trim().replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  const std = clean.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (std.length % 4)) % 4;
  const binary = atob(std + '='.repeat(pad));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function concatBytes(...arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hmacSha256(keyBytes, dataBytes) {
  const safeKey = keyBytes && keyBytes.length ? keyBytes : new Uint8Array(32);
  const key = await crypto.subtle.importKey(
    'raw',
    safeKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

async function hkdfExtract(salt, ikm) {
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk, info, length) {
  const input = concatBytes(info, Uint8Array.of(0x01));
  const okm = await hmacSha256(prk, input);
  return okm.slice(0, length);
}

function decodePemPrivateKey(pem) {
  const clean = String(pem || '')
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function normalizeVapidSubject(subject) {
  const s = String(subject || '').trim();
  if (!s) return 'mailto:admin@abusaid.local';
  if (/^(mailto:|https:\/\/)/i.test(s)) return s;
  if (s.includes('@')) return `mailto:${s}`;
  return 'mailto:admin@abusaid.local';
}

export function validateVapidConfig({ publicKey, privateKey, subject }) {
  const pub = String(publicKey || '').trim();
  const priv = String(privateKey || '').trim();
  if (!pub || !priv) {
    return { valid: false, reason: 'MISSING_KEYS' };
  }
  try {
    const pubBytes = base64UrlDecode(pub);
    if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
      return { valid: false, reason: 'INVALID_PUBLIC_KEY' };
    }
    if (!priv.includes('BEGIN PRIVATE KEY')) {
      const privBytes = base64UrlDecode(priv);
      if (privBytes.length !== 32) {
        return { valid: false, reason: 'INVALID_PRIVATE_KEY' };
      }
    }
  } catch {
    return { valid: false, reason: 'MALFORMED_KEYS' };
  }
  return {
    valid: true,
    publicKey: pub,
    privateKey: priv,
    subject: normalizeVapidSubject(subject),
  };
}

async function importVapidSigningKey(publicKeyB64u, privateKeyInput) {
  const pubBytes = base64UrlDecode(publicKeyB64u);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('INVALID_VAPID_PUBLIC_KEY');
  }
  const privTrimmed = String(privateKeyInput || '').trim();
  if (privTrimmed.includes('BEGIN PRIVATE KEY')) {
    return crypto.subtle.importKey(
      'pkcs8',
      decodePemPrivateKey(privTrimmed),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
  const privBytes = base64UrlDecode(privTrimmed);
  if (privBytes.length !== 32) {
    throw new Error('INVALID_VAPID_PRIVATE_KEY');
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(pubBytes.slice(1, 33)),
    y: base64UrlEncode(pubBytes.slice(33, 65)),
    d: base64UrlEncode(privBytes),
    ext: true,
  };
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

export async function createVapidAuthHeader({
  endpoint,
  publicKey,
  privateKey,
  subject,
  ttlSeconds = 12 * 3600,
}) {
  const parsedUrl = new URL(endpoint);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
    throw new Error('INVALID_ENDPOINT_PROTOCOL');
  }
  const aud = parsedUrl.origin;
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + Math.min(24 * 3600, Math.max(60, Number(ttlSeconds) || 12 * 3600));

  const headerB64 = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claimsB64 = base64UrlEncode(
    JSON.stringify({
      aud,
      exp,
      sub: normalizeVapidSubject(subject),
    })
  );
  const unsigned = `${headerB64}.${claimsB64}`;
  const signingKey = await importVapidSigningKey(publicKey, privateKey);
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sigBuf))}`;
  const cleanPub = base64UrlEncode(base64UrlDecode(publicKey));
  return `vapid t=${jwt}, k=${cleanPub}`;
}

export async function encryptWebPushPayload({ subscription, payload }) {
  const p256dhRaw = subscription?.keys?.p256dh || '';
  const authRaw = subscription?.keys?.auth || '';
  const uaPublicBytes = base64UrlDecode(p256dhRaw);
  const authBytes = base64UrlDecode(authRaw);

  if (uaPublicBytes.length !== 65 || uaPublicBytes[0] !== 0x04) {
    throw new Error('INVALID_SUBSCRIPTION_P256DH');
  }
  if (authBytes.length !== 16) {
    throw new Error('INVALID_SUBSCRIPTION_AUTH');
  }

  const rawPayload =
    typeof payload === 'string'
      ? encoder.encode(payload)
      : payload instanceof Uint8Array
      ? payload
      : encoder.encode(JSON.stringify(payload || {}));

  // RFC 8291 max record size is 4096 bytes; 86-byte header + 1-byte delimiter + 16-byte tag = 103 bytes overhead
  if (rawPayload.length > 3990) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }

  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const asPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  );
  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey },
    ephemeral.privateKey,
    256
  );
  const ecdhSecret = new Uint8Array(sharedBits);

  const prkKey = await hkdfExtract(authBytes, ecdhSecret);
  const keyInfo = concatBytes(
    encoder.encode('WebPush: info\0'),
    uaPublicBytes,
    asPublicBytes
  );
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(
    prk,
    encoder.encode('Content-Encoding: aes128gcm\0'),
    16
  );
  const nonce = await hkdfExpand(
    prk,
    encoder.encode('Content-Encoding: nonce\0'),
    12
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  const plaintext = concatBytes(rawPayload, Uint8Array.of(0x02));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      plaintext
    )
  );

  const rsBytes = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096
  const idlenByte = new Uint8Array([asPublicBytes.length]); // 65

  return concatBytes(salt, rsBytes, idlenByte, asPublicBytes, ciphertext);
}

export async function sendWebPushNotification({
  subscription,
  payload,
  vapidPublicKey,
  vapidPrivateKey,
  vapidSubject,
  ttl = 86400,
  urgency = 'high',
}) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint) {
    return { ok: false, status: 400, expired: true, error: 'Missing endpoint' };
  }

  const [authHeader, encryptedBody] = await Promise.all([
    createVapidAuthHeader({
      endpoint,
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
      subject: vapidSubject,
    }),
    encryptWebPushPayload({ subscription, payload }),
  ]);

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(Math.max(60, Math.min(2419200, Number(ttl) || 86400))),
        Urgency: urgency,
      },
      body: encryptedBody,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err?.message || 'Push network error',
    };
  }

  const ok = res.status >= 200 && res.status < 300;
  const expired = res.status === 404 || res.status === 410;
  let respText = '';
  if (!ok) {
    respText = await res.text().catch(() => '');
  }
  return {
    ok,
    status: res.status,
    expired,
    error: ok ? '' : respText.slice(0, 180) || `Push status ${res.status}`,
  };
}

export async function generateVapidKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pad32 = (b) => {
    if (b.length === 32) return b;
    const out = new Uint8Array(32);
    out.set(b, Math.max(0, 32 - b.length));
    return out;
  };
  const xBytes = pad32(base64UrlDecode(jwk.x));
  const yBytes = pad32(base64UrlDecode(jwk.y));
  const uncompressed = concatBytes(Uint8Array.of(0x04), xBytes, yBytes);
  return {
    publicKey: base64UrlEncode(uncompressed),
    privateKey: jwk.d,
  };
}
