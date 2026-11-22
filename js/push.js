import { $, showToast, state } from './state.js';
import { esc, numAr } from './utils.js';

const DISMISS_KEY = 'abu_push_dismiss';
const MUTED_KEY = 'abu_push_muted';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const pushState = {
  supported: false,
  configured: false,
  publicKey: '',
  permission: 'default',
  browserSub: null,
  serverEndpoints: [],
  deviceCount: 0,
  busy: false,
  initialized: false,
};

function urlBase64ToUint8Array(base64String) {
  const s = String(base64String || '').trim();
  const padding = '='.repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isMutedByUser() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function setMutedByUser(val) {
  try {
    if (val) localStorage.setItem(MUTED_KEY, '1');
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    // ignore storage errors
  }
}

function isBannerDismissed() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function dismissOptinBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  const bar = $('pushOptinBar');
  if (bar) bar.hidden = true;
}

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(reg), 2500)),
  ]);
  return ready || reg;
}

function hasActiveSubscriptionOnThisDevice() {
  if (!pushState.browserSub) return false;
  if (pushState.permission !== 'granted') return false;
  const ep = pushState.browserSub.endpoint;
  return pushState.serverEndpoints.includes(ep);
}

function renderHeaderIndicator() {
  const btn = $('hdrPushBtn');
  const dot = $('hdrPushDot');
  if (!btn || !dot) return;

  const active = hasActiveSubscriptionOnThisDevice();
  btn.classList.toggle('is-active', active);

  if (active) {
    dot.hidden = false;
    dot.className = 'hdr-push-dot on';
    btn.title = 'إشعارات الحساب مفعّلة';
  } else if (pushState.permission === 'denied') {
    dot.hidden = false;
    dot.className = 'hdr-push-dot off';
    btn.title = 'الإشعارات محظورة من المتصفح';
  } else {
    dot.hidden = true;
    dot.className = 'hdr-push-dot';
    btn.title = 'إعدادات الحساب والإشعارات';
  }
}

function renderOptinBanner() {
  const bar = $('pushOptinBar');
  if (!bar) return;

  const shouldShow =
    pushState.supported &&
    pushState.configured &&
    !hasActiveSubscriptionOnThisDevice() &&
    pushState.permission === 'default' &&
    !isBannerDismissed();

  bar.hidden = !shouldShow;
}

function renderAccountModalContent() {
  const body = $('accBody');
  if (!body) return;

  const u = state.user;
  const active = hasActiveSubscriptionOnThisDevice();

  let statusClass = 'off';
  let statusText = 'غير مفعّلة على هذا الجهاز';
  if (!pushState.supported) {
    statusClass = 'warn';
    statusText = 'المتصفح الحالي لا يدعم إشعارات الويب';
  } else if (!pushState.configured) {
    statusClass = 'warn';
    statusText = 'خدمة الإشعارات قيد التجهيز من الإدارة';
  } else if (pushState.permission === 'denied') {
    statusClass = 'denied';
    statusText = 'محظورة من إعدادات المتصفح';
  } else if (active) {
    statusClass = 'on';
    statusText = 'مفعّلة لهذا الجهاز ✅';
  }

  let controlsHtml = '';
  if (pushState.supported && pushState.configured) {
    if (pushState.permission === 'denied') {
      controlsHtml = `
        <div class="acc-help-box">
          <strong>تم حظر إذن الإشعارات في هذا المتصفح</strong>
          <p>لتفعيلها مجدداً في Chrome أو Edge: اضغط على أيقونة الإعدادات 🔒 بجانب رابط الموقع بالأعلى، اختر <b>الإشعارات (Notifications)</b> ثم بدّلها إلى <b>السماح (Allow)</b> وأعد تحميل الصفحة.</p>
        </div>`;
    } else if (active) {
      controlsHtml = `
        <button id="accPushDisable" class="acc-toggle-btn off" type="button" ${pushState.busy ? 'disabled' : ''}>
          ${pushState.busy ? 'جاري الإيقاف...' : '🔕 إيقاف الإشعارات على هذا الجهاز'}
        </button>`;
    } else {
      controlsHtml = `
        <button id="accPushEnable" class="acc-toggle-btn on" type="button" ${pushState.busy ? 'disabled' : ''}>
          ${pushState.busy ? 'جاري التفعيل...' : '🔔 تفعيل الإشعارات الفورية'}
        </button>`;
    }
  } else if (!pushState.supported) {
    controlsHtml = `
      <div class="acc-help-box">
        <strong>متصفح غير داعم</strong>
        <p>يُفضّل فتح المتجر عبر متصفح Chrome أو Edge أو تثبيت التطبيق على جهاز Android للحصول على الإشعارات الفورية.</p>
      </div>`;
  }

  const userDetailsHtml = u
    ? `
      <div class="acc-card">
        <div class="acc-card-head">
          <div>
            <strong class="acc-name">${esc(u.fullName || 'عميل أبو سعيد')}</strong>
            <span class="acc-phone" dir="ltr">${esc(u.phone || '')}</span>
          </div>
          <span class="acc-status-chip">حساب جملة مُعتمد</span>
        </div>
        ${
          u.shopName || u.address
            ? `<div class="acc-meta">
                ${u.shopName ? `<span>🏪 ${esc(u.shopName)}</span>` : ''}
                ${u.address ? `<span>📍 ${esc(u.address)}</span>` : ''}
              </div>`
            : ''
        }
      </div>`
    : `<div class="acc-card"><p style="margin:0;color:var(--muted)">جاري تحميل بيانات الحساب...</p></div>`;

  body.innerHTML = `
    ${userDetailsHtml}
    <div class="acc-card">
      <div class="push-toggle-head">
        <div>
          <strong>🔔 الإشعارات الفورية</strong>
          <small>عروض الجملة، توفر الأصناف، وتنبيهات الأسعار</small>
        </div>
        <span class="push-state-badge ${statusClass}">${esc(statusText)}</span>
      </div>
      ${
        pushState.deviceCount > 0
          ? `<p class="acc-devices-note">الأجهزة المفعّلة على حسابك حالياً: <b>${numAr(pushState.deviceCount)}</b></p>`
          : ''
      }
      <div class="push-toggle-actions">
        ${controlsHtml}
      </div>
    </div>
  `;
}

async function syncServerSubscription(sub) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'تعذر حفظ اشتراك الإشعارات');
  }
}

export async function refreshPushState({ silentSync = true } = {}) {
  pushState.supported = isPushSupported();
  pushState.permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  try {
    const res = await fetch('/api/push/config', { credentials: 'same-origin' });
    if (res.ok) {
      const cfg = await res.json();
      pushState.configured = Boolean(cfg.configured && cfg.publicKey);
      pushState.publicKey = String(cfg.publicKey || '');
      pushState.serverEndpoints = Array.isArray(cfg.subscribedEndpoints)
        ? cfg.subscribedEndpoints
        : [];
      pushState.deviceCount = Number(cfg.deviceCount || 0);
    }
  } catch {
    // ignore transient network errors
  }

  if (pushState.supported) {
    try {
      const reg = await getSwRegistration();
      pushState.browserSub = reg ? await reg.pushManager.getSubscription() : null;

      if (
        silentSync &&
        pushState.browserSub &&
        pushState.permission === 'granted' &&
        pushState.configured &&
        !isMutedByUser()
      ) {
        const subAppKey = pushState.browserSub.options?.applicationServerKey;
        let sameKey = true;
        if (subAppKey) {
          const currentB64 = uint8ToBase64Url(new Uint8Array(subAppKey));
          if (currentB64 !== pushState.publicKey) sameKey = false;
        }
        if (!sameKey && reg) {
          await pushState.browserSub.unsubscribe().catch(() => {});
          pushState.browserSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(pushState.publicKey),
          });
        }
        if (
          pushState.browserSub &&
          !pushState.serverEndpoints.includes(pushState.browserSub.endpoint)
        ) {
          await syncServerSubscription(pushState.browserSub);
          pushState.serverEndpoints = Array.from(
            new Set([...pushState.serverEndpoints, pushState.browserSub.endpoint])
          );
          pushState.deviceCount = Math.max(pushState.deviceCount, pushState.serverEndpoints.length);
        }
      }
    } catch {
      // ignore SW error during background refresh
    }
  }

  renderHeaderIndicator();
  renderOptinBanner();
  if ($('accountSheet')?.classList.contains('on')) {
    renderAccountModalContent();
  }
}

export async function enablePushNotifications() {
  if (pushState.busy) return;
  if (!isPushSupported()) {
    showToast('المتصفح الحالي لا يدعم إشعارات الويب', 'warn');
    return;
  }
  if (!pushState.configured || !pushState.publicKey) {
    showToast('خدمة الإشعارات غير مهيأة بعد على الخادم', 'warn');
    return;
  }
  if (Notification.permission === 'denied') {
    openAccountModal();
    showToast('الإشعارات محظورة — افتح إعدادات المتصفح للسماح بها', 'warn');
    return;
  }

  pushState.busy = true;
  if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
  const allowBtn = $('pushOptinAllow');
  if (allowBtn) allowBtn.disabled = true;

  try {
    setMutedByUser(false);
    const perm = await Notification.requestPermission();
    pushState.permission = perm;

    if (perm !== 'granted') {
      renderHeaderIndicator();
      renderOptinBanner();
      if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
      showToast(
        perm === 'denied'
          ? 'تم رفض إذن الإشعارات، يمكنك السماح لاحقاً من إعدادات المتصفح'
          : 'لم يتم تفعيل الإشعارات بعد',
        'warn'
      );
      return;
    }

    const reg = await getSwRegistration();
    if (!reg || !reg.pushManager) {
      throw new Error('تعذر تشغيل Service Worker على هذا المتصفح');
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey) {
      const existingKey = uint8ToBase64Url(new Uint8Array(sub.options.applicationServerKey));
      if (existingKey !== pushState.publicKey) {
        await sub.unsubscribe().catch(() => {});
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushState.publicKey),
      });
    }

    await syncServerSubscription(sub);
    pushState.browserSub = sub;
    await refreshPushState({ silentSync: false });
    showToast('تم تفعيل الإشعارات الفورية بنجاح 🔔');
  } catch (err) {
    showToast(err?.message || 'تعذر تفعيل الإشعارات', 'warn');
  } finally {
    pushState.busy = false;
    if (allowBtn) allowBtn.disabled = false;
    renderHeaderIndicator();
    renderOptinBanner();
    if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
  }
}

export async function disablePushNotifications() {
  if (pushState.busy) return;
  pushState.busy = true;
  if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();

  try {
    setMutedByUser(true);
    const reg = await getSwRegistration().catch(() => null);
    const sub = pushState.browserSub || (reg ? await reg.pushManager.getSubscription() : null);

    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }

    pushState.browserSub = null;
    await refreshPushState({ silentSync: false });
    showToast('تم إيقاف الإشعارات على هذا الجهاز');
  } catch (err) {
    showToast(err?.message || 'تعذر إيقاف الإشعارات', 'warn');
  } finally {
    pushState.busy = false;
    renderHeaderIndicator();
    renderOptinBanner();
    if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
  }
}

export function openAccountModal() {
  const sheet = $('accountSheet');
  if (!sheet) return;
  renderAccountModalContent();
  sheet.classList.add('on');
  refreshPushState({ silentSync: false });
}

export function closeAccountModal() {
  const sheet = $('accountSheet');
  if (sheet) sheet.classList.remove('on');
}

export function refreshPushAccountInfo() {
  if ($('accountSheet')?.classList.contains('on')) {
    renderAccountModalContent();
  }
}

export function initPushUI() {
  if (pushState.initialized) return;
  pushState.initialized = true;

  const badgeWrap = $('userBadgeWrap');
  const hdrPushBtn = $('hdrPushBtn');
  const accClose = $('accClose');
  const accountSheet = $('accountSheet');
  const optAllow = $('pushOptinAllow');
  const optDismiss = $('pushOptinDismiss');
  const accBody = $('accBody');

  if (badgeWrap) badgeWrap.addEventListener('click', openAccountModal);
  if (hdrPushBtn) hdrPushBtn.addEventListener('click', openAccountModal);
  if (accClose) accClose.addEventListener('click', closeAccountModal);
  if (accountSheet) {
    accountSheet.addEventListener('click', (e) => {
      if (e.target === accountSheet) closeAccountModal();
    });
  }
  if (optAllow) optAllow.addEventListener('click', enablePushNotifications);
  if (optDismiss) optDismiss.addEventListener('click', dismissOptinBanner);

  if (accBody) {
    accBody.addEventListener('click', (e) => {
      if (e.target.closest('#accPushEnable')) enablePushNotifications();
      else if (e.target.closest('#accPushDisable')) disablePushNotifications();
    });
  }

  // Delay slightly so first-paint catalog rendering stays snappy
  setTimeout(() => {
    refreshPushState({ silentSync: true });
  }, 900);
}
