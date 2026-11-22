import {
  base64UrlDecode,
  normalizeVapidSubject,
  sendWebPushNotification,
  validateVapidConfig,
} from './webPush.js';

const recentBroadcasts = new Map();

export function resolveVapidEnv(env = {}) {
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim();
  const subject = normalizeVapidSubject(env.VAPID_SUBJECT || '');

  const missingVars = [];
  if (!publicKey) missingVars.push('VAPID_PUBLIC_KEY');
  if (!privateKey) missingVars.push('VAPID_PRIVATE_KEY');

  const check = validateVapidConfig({ publicKey, privateKey, subject });
  return {
    configured: check.valid,
    reason: check.reason || '',
    missingVars,
    publicKey: check.valid ? check.publicKey : publicKey,
    privateKey: check.valid ? check.privateKey : '',
    subject: check.valid ? check.subject : subject,
  };
}

export function detectDeviceLabel(userAgent = '') {
  const ua = String(userAgent || '');
  let os = 'جهاز';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'Mac';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'متصفح';
  if (/edg\//i.test(ua) || /edgios/i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return `${os} · ${browser}`;
}

export function validatePushSubscriptionInput(rawSub) {
  const sub = rawSub && typeof rawSub === 'object' ? rawSub : null;
  const endpoint = String(sub?.endpoint || '').trim();
  const p256dh = String(sub?.keys?.p256dh || '').trim();
  const auth = String(sub?.keys?.auth || '').trim();

  if (!endpoint || endpoint.length > 2048) {
    return { valid: false, error: 'رابط اشتراك الإشعارات غير صالح.' };
  }

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { valid: false, error: 'رابط اشتراك الإشعارات غير صالح.' };
  }

  const isLocal =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !isLocal) {
    return { valid: false, error: 'يجب أن يكون رابط الاشتراك عبر HTTPS.' };
  }

  try {
    const pubBytes = base64UrlDecode(p256dh);
    const authBytes = base64UrlDecode(auth);
    if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
      return { valid: false, error: 'مفتاح التشفير p256dh غير صالح.' };
    }
    if (authBytes.length !== 16) {
      return { valid: false, error: 'مفتاح المصادقة auth غير صالح.' };
    }
  } catch {
    return { valid: false, error: 'بيانات مفاتيح الاشتراك غير صالحة.' };
  }

  return {
    valid: true,
    subscription: {
      endpoint,
      keys: { p256dh, auth },
    },
  };
}

export function normalizeTargetUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '/';
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 300);
  if (s.startsWith('#')) return '/' + s.slice(0, 299);
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      return u.toString().slice(0, 400);
    }
  } catch {
    // ignore
  }
  return '/';
}

function buildSegmentsFromUsers(approvedUsers, subCountByUserId) {
  let withShopSubs = 0;
  let withoutShopSubs = 0;
  let totalApprovedSubs = 0;
  const areaMap = new Map();

  for (const u of approvedUsers) {
    const uid = String(u.id);
    const subs = subCountByUserId.get(uid) || 0;
    if (subs <= 0) continue;
    totalApprovedSubs += 1;
    if (String(u.shopName || '').trim()) withShopSubs += 1;
    else withoutShopSubs += 1;

    const area = String(u.address || '').trim();
    if (area.length >= 2) {
      const key = area.toLowerCase();
      const prev = areaMap.get(key) || { label: area, count: 0 };
      prev.count += 1;
      areaMap.set(key, prev);
    }
  }

  const segments = [
    { id: 'withShop', label: 'أصحاب المحلات المسجلين', count: withShopSubs },
    { id: 'withoutShop', label: 'التجار (بدون اسم محل)', count: withoutShopSubs },
  ];

  const sortedAreas = [...areaMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12);
  for (const [areaKey, info] of sortedAreas) {
    segments.push({
      id: `area:${areaKey}`,
      label: `منطقة: ${info.label}`,
      count: info.count,
    });
  }

  return { segments, totalSubscribedUsers: totalApprovedSubs };
}

export async function computePushOverview({ store, vapid, adminIdToken = '' }) {
  const [users, allSubs, logs] = await Promise.all([
    store.listUsers({ adminIdToken }),
    store.listAllPushSubscriptions({ adminIdToken }),
    store.listPushLogs(40, { adminIdToken }),
  ]);

  const userMap = new Map();
  const approvedUsers = [];
  for (const u of users) {
    userMap.set(String(u.id), u);
    if (u.status === 'Approved') approvedUsers.push(u);
  }

  const subCountByUserId = new Map();
  let activeDeviceCount = 0;

  for (const sub of allSubs) {
    const u = userMap.get(String(sub.userId));
    if (!u || u.status !== 'Approved') continue;
    activeDeviceCount += 1;
    const uid = String(u.id);
    subCountByUserId.set(uid, (subCountByUserId.get(uid) || 0) + 1);
  }

  const { segments, totalSubscribedUsers } = buildSegmentsFromUsers(
    approvedUsers,
    subCountByUserId
  );

  const subscribedUsers = approvedUsers
    .filter((u) => (subCountByUserId.get(String(u.id)) || 0) > 0)
    .map((u) => ({
      id: String(u.id),
      fullName: u.fullName || '',
      phone: u.phone || '',
      shopName: u.shopName || '',
      address: u.address || '',
      deviceCount: subCountByUserId.get(String(u.id)) || 0,
    }));

  return {
    configured: Boolean(vapid.configured),
    missingVars: vapid.missingVars || [],
    subscriberCount: totalSubscribedUsers,
    deviceCount: activeDeviceCount,
    segments,
    subscribedUsers,
    logs,
  };
}

function parseImageDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim();
  if (!raw) return null;
  if (/^https:\/\//i.test(raw)) {
    return { externalUrl: raw.slice(0, 500) };
  }
  const m = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) {
    throw new Error('صيغة الصورة غير مدعومة. استخدم PNG أو JPEG أو WebP.');
  }
  const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
  const base64 = m[2];
  if (base64.length > 480000) {
    throw new Error('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر.');
  }
  return { mime, base64 };
}

export async function executeAdminPushBroadcast({
  store,
  vapid,
  origin,
  adminEmail = 'admin',
  adminIdToken = '',
  body = {},
}) {
  if (!vapid.configured) {
    const err = new Error(
      'مفاتيح VAPID غير مهيأة على الخادم. يرجى إضافة VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY.'
    );
    err.status = 503;
    err.needsVapidSetup = true;
    throw err;
  }

  const title = String(body.title || '').trim().slice(0, 120);
  const msgBody = String(body.body || '').trim().slice(0, 400);
  const url = normalizeTargetUrl(body.url);
  const targetType = ['all', 'user', 'segment'].includes(body.targetType)
    ? body.targetType
    : 'all';
  const targetUserId = String(body.targetUserId || '').trim();
  const targetSegment = String(body.targetSegment || '').trim();

  if (title.length < 2) {
    const err = new Error('يرجى كتابة عنوان الإشعار (حرفين على الأقل).');
    err.status = 400;
    throw err;
  }
  if (msgBody.length < 2) {
    const err = new Error('يرجى كتابة نص الإشعار.');
    err.status = 400;
    throw err;
  }

  const dupKey = `${adminEmail}:${targetType}:${targetUserId}:${targetSegment}:${title}:${msgBody}`;
  const lastAt = recentBroadcasts.get(dupKey) || 0;
  if (Date.now() - lastAt < 3500) {
    const err = new Error('تم إرسال نفس الإشعار للتو، يرجى الانتظار بضع ثوانٍ.');
    err.status = 429;
    throw err;
  }
  recentBroadcasts.set(dupKey, Date.now());
  if (recentBroadcasts.size > 100) {
    const firstKey = recentBroadcasts.keys().next().value;
    recentBroadcasts.delete(firstKey);
  }

  let imageUrl = '';
  if (body.imageDataUrl) {
    let parsedImg;
    try {
      parsedImg = parseImageDataUrl(body.imageDataUrl);
    } catch (e) {
      e.status = 400;
      throw e;
    }
    if (parsedImg?.externalUrl) {
      imageUrl = parsedImg.externalUrl;
    } else if (parsedImg?.base64) {
      const imgId = await store.savePushImage(
        { mime: parsedImg.mime, base64: parsedImg.base64 },
        { adminIdToken }
      );
      imageUrl = `${origin.replace(/\/+$/, '')}/push-img/${encodeURIComponent(imgId)}`;
    }
  }

  const [users, allSubs] = await Promise.all([
    store.listUsers({ adminIdToken }),
    store.listAllPushSubscriptions({ adminIdToken }),
  ]);

  const userMap = new Map();
  for (const u of users) userMap.set(String(u.id), u);

  let targetLabel = 'جميع المشتركين';
  if (targetType === 'user') {
    const tu = userMap.get(targetUserId);
    if (!tu || tu.status !== 'Approved') {
      const err = new Error('المستخدم المحدد غير موجود أو حسابه غير مفعّل.');
      err.status = 400;
      throw err;
    }
    targetLabel = `مستخدم: ${tu.fullName || tu.phone}`;
  } else if (targetType === 'segment') {
    if (targetSegment === 'withShop') targetLabel = 'فئة: أصحاب المحلات المسجلين';
    else if (targetSegment === 'withoutShop') targetLabel = 'فئة: التجار بدون اسم محل';
    else if (targetSegment.startsWith('area:')) {
      targetLabel = `فئة: منطقة ${targetSegment.slice(5)}`;
    } else {
      targetLabel = 'جميع المشتركين';
    }
  }

  const seenEndpoints = new Set();
  const targetSubs = [];

  for (const sub of allSubs) {
    const u = userMap.get(String(sub.userId));
    if (!u || u.status !== 'Approved') continue;

    if (targetType === 'user' && String(u.id) !== targetUserId) continue;
    if (targetType === 'segment') {
      if (targetSegment === 'withShop' && !String(u.shopName || '').trim()) continue;
      if (targetSegment === 'withoutShop' && String(u.shopName || '').trim()) continue;
      if (targetSegment.startsWith('area:')) {
        const areaNeedle = targetSegment.slice(5).toLowerCase();
        if (!String(u.address || '').toLowerCase().includes(areaNeedle)) continue;
      }
    }

    if (seenEndpoints.has(sub.endpoint)) continue;
    seenEndpoints.add(sub.endpoint);
    targetSubs.push(sub);
  }

  const payload = {
    title,
    body: msgBody,
    url,
    image: imageUrl || undefined,
    tag: `abusaid-${Date.now()}`,
    ts: Date.now(),
  };

  let sentCount = 0;
  let failedCount = 0;
  const expiredIds = [];

  const BATCH_SIZE = 15;
  for (let i = 0; i < targetSubs.length; i += BATCH_SIZE) {
    const chunk = targetSubs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async (sub) => {
        const res = await sendWebPushNotification({
          subscription: sub,
          payload,
          vapidPublicKey: vapid.publicKey,
          vapidPrivateKey: vapid.privateKey,
          vapidSubject: vapid.subject,
        });
        return { sub, res };
      })
    );

    for (const { sub, res } of results) {
      if (res.ok) {
        sentCount += 1;
      } else {
        failedCount += 1;
        if (res.expired && sub.id) {
          expiredIds.push(sub.id);
        }
      }
    }
  }

  if (expiredIds.length) {
    try {
      await store.deletePushSubscriptionsByIds(expiredIds, { adminIdToken });
    } catch {
      // ignore cleanup error
    }
  }

  const status =
    targetSubs.length === 0
      ? 'no_subscribers'
      : sentCount > 0 && failedCount === 0
      ? 'sent'
      : sentCount > 0
      ? 'partial'
      : 'failed';

  const log = await store.savePushLog(
    {
      title,
      body: msgBody,
      url,
      imageUrl,
      targetType,
      targetUserId: targetType === 'user' ? targetUserId : '',
      targetSegment: targetType === 'segment' ? targetSegment : '',
      targetLabel,
      sentBy: adminEmail,
      totalTargets: targetSubs.length,
      sentCount,
      failedCount,
      removedCount: expiredIds.length,
      status,
    },
    { adminIdToken }
  );

  return {
    ok: true,
    log,
    totalTargets: targetSubs.length,
    sentCount,
    failedCount,
    removedCount: expiredIds.length,
    status,
  };
}
