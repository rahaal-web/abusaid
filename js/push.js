import { $, showToast, state } from './state.js';
import { esc, numAr } from './utils.js';

const MUTED_KEY = 'abu_push_muted';

const pushState = {
  supported: false,
  configured: false,
  publicKey: '',
  permission: 'default',
  browserSub: null,
  serverEndpoints: [],
  deviceCount: 0,
  busy: false,
  configLoaded: false,
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

function clearMutedFlag() {
  try {
    localStorage.removeItem(MUTED_KEY);
  } catch {
    // ignore storage errors
  }
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

export function hasActiveSubscriptionOnThisDevice() {
  if (!pushState.browserSub) return false;
  if (pushState.permission !== 'granted') return false;
  const ep = pushState.browserSub.endpoint;
  return pushState.serverEndpoints.includes(ep);
}

function isInsideIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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

function syncBodyModalLock() {
  const anyOpen = Boolean(
    $('pushMandatoryModal')?.classList.contains('on') ||
      $('sheet')?.classList.contains('on') ||
      $('fsheet')?.classList.contains('on') ||
      $('rsheet')?.classList.contains('on') ||
      $('ordersSheet')?.classList.contains('on') ||
      $('accountSheet')?.classList.contains('on')
  );
  document.body.classList.toggle('modal-open', anyOpen);
}

function renderMandatoryModalContent() {
  const panel = $('pushMandatoryPanel');
  if (!panel) return;

  const userName = state.user?.fullName ? `أهلاً بك يا ${state.user.fullName}` : 'أهلاً بك في متجر أبو سعيد';
  const perm = pushState.permission;
  const inFrame = isInsideIframe();

  let actionBlock = '';
  if (!pushState.supported) {
    actionBlock = `
      <div class="pm-warn-box">
        <strong>المتصفح الحالي لا يدعم إشعارات الويب الفورية</strong>
        <p>لمتابعة كل جديد والعروض والاشتراك الإجباري، افتح المتجر عبر متصفح Chrome أو Edge أو ثبّت التطبيق على الشاشة الرئيسية.</p>
      </div>
      <button id="pushMandRetryBtn" class="pm-cta-btn secondary" type="button" ${pushState.busy ? 'disabled' : ''}>
        🔄 إعادة الفحص والتحقق
      </button>`;
  } else if (!pushState.configured) {
    actionBlock = `
      <div class="pm-warn-box">
        <strong>خدمة الإشعارات قيد التجهيز على الخادم</strong>
        <p>اضغط على زر إعادة المحاولة خلال لحظات لإتمام التفعيل.</p>
      </div>
      <button id="pushMandRetryBtn" class="pm-cta-btn" type="button" ${pushState.busy ? 'disabled' : ''}>
        🔄 إعادة المحاولة الآن
      </button>`;
  } else if (perm === 'denied') {
    actionBlock = `
      <div class="pm-warn-box">
        <strong>⚠️ تم حظر إذن الإشعارات في المتصفح</strong>
        <p>الاشتراك في الإشعارات إجباري للدخول ومتابعة العروض. اضغط على أيقونة الإعدادات 🔒 بجانب رابط الموقع بالأعلى، ثم اختر <b>الإشعارات (Notifications)</b> وبدّلها إلى <b>السماح (Allow)</b> وبعدها اضغط الزر بالأسفل.</p>
      </div>
      <button id="pushMandRetryBtn" class="pm-cta-btn" type="button" ${pushState.busy ? 'disabled' : ''}>
        ${pushState.busy ? '⏳ جاري التحقق...' : '🔄 تم السماح — تحقق واشترك الآن'}
      </button>
      ${
        inFrame
          ? `<a class="pm-ext-link" href="${esc(window.location.href)}" target="_blank" rel="noopener noreferrer">↗ فتح المتجر في نافذة مستقلة لتفعيل الإشعارات</a>`
          : ''
      }`;
  } else {
    actionBlock = `
      <button id="pushMandAllowBtn" class="pm-cta-btn" type="button" ${pushState.busy ? 'disabled' : ''}>
        ${pushState.busy ? '⏳ جاري تفعيل الإشعارات...' : '🔔 اشترك في الإشعارات الآن'}
      </button>`;
  }

  panel.innerHTML = `
    <div class="pm-hero-icon" aria-hidden="true">🔔</div>
    <span class="pm-greeting">${esc(userName)}</span>
    <h2 id="pushMandatoryTitle" class="pm-title">اشترك في الإشعارات لمتابعة كل جديد والعروض</h2>
    <p class="pm-desc">
      فعّل الإشعارات الآن لتصلك عروض الجملة الحصرية، الأصناف الجديدة، وتحديثات الأسعار أولاً بأول فور نزولها. الاشتراك إلزامي للمتابعة.
    </p>
    <div class="pm-perks">
      <span>🔥 عروض وتخفيضات اليوم فور نزولها</span>
      <span>📦 إشعار فوري عند توفر أصناف جديدة</span>
      <span>⚡ يعمل على الموبايل والكمبيوتر حتى عند إغلاق الموقع</span>
    </div>
    <div class="pm-actions">
      ${actionBlock}
    </div>
  `;
}

function updateMandatoryPushModal() {
  const modal = $('pushMandatoryModal');
  if (!modal) return;

  if (!pushState.configLoaded) return;

  const active = hasActiveSubscriptionOnThisDevice();
  if (active) {
    modal.classList.remove('on');
    syncBodyModalLock();
    return;
  }

  renderMandatoryModalContent();
  modal.classList.add('on');
  syncBodyModalLock();
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
    statusText = 'خدمة الإشعارات قيد التجهيز';
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
          <p>لتفعيلها مجدداً: اضغط على أيقونة 🔒 بجانب رابط الموقع، اختر <b>الإشعارات</b> ثم بدّلها إلى <b>السماح</b> وأعد المحاولة.</p>
        </div>`;
    } else if (active) {
      controlsHtml = `
        <div class="acc-help-box">
          <strong>اشتراك الإشعارات الفوري نشط ومفعل ✅</strong>
          <p>الاشتراك في الإشعارات إلزامي لمتابعة أحدث العروض والأصناف وتحديثات الأسعار أولاً بأول.</p>
        </div>`;
    } else {
      controlsHtml = `
        <button id="accPushEnable" class="acc-toggle-btn on" type="button" ${pushState.busy ? 'disabled' : ''}>
          ${pushState.busy ? 'جاري التفعيل...' : '🔔 اشترك في الإشعارات الآن'}
        </button>`;
    }
  } else if (!pushState.supported) {
    controlsHtml = `
      <div class="acc-help-box">
        <strong>متصفح غير داعم</strong>
        <p>يُفضّل فتح المتجر عبر Chrome أو Edge أو تثبيت التطبيق للحصول على الإشعارات الفورية.</p>
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
    <button id="accOpenOrdersBtn" class="acc-orders-shortcut" type="button">📦 عرض سجل طلباتي عبر واتساب</button>
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
  clearMutedFlag();
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
      pushState.configLoaded = true;
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
        pushState.configured
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
          pushState.deviceCount = Math.max(
            pushState.deviceCount,
            pushState.serverEndpoints.length
          );
        }
      }
    } catch {
      // ignore SW error during background refresh
    }
  }

  renderHeaderIndicator();
  updateMandatoryPushModal();
  if ($('accountSheet')?.classList.contains('on')) {
    renderAccountModalContent();
  }
}

export async function enablePushNotifications() {
  if (pushState.busy) return;
  clearMutedFlag();
  pushState.supported = isPushSupported();
  pushState.permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  if (!pushState.supported) {
    updateMandatoryPushModal();
    showToast('المتصفح الحالي لا يدعم إشعارات الويب', 'warn');
    return;
  }

  if (!pushState.configured || !pushState.publicKey) {
    await refreshPushState({ silentSync: false });
    if (!pushState.configured || !pushState.publicKey) {
      showToast('خدمة الإشعارات قيد التجهيز على الخادم', 'warn');
      return;
    }
  }

  if (Notification.permission === 'denied') {
    updateMandatoryPushModal();
    showToast('الإشعارات محظورة — اسمح بالإشعارات من إعدادات المتصفح أولاً', 'warn');
    return;
  }

  pushState.busy = true;
  updateMandatoryPushModal();
  if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();

  try {
    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    pushState.permission = perm;

    if (perm !== 'granted') {
      renderHeaderIndicator();
      updateMandatoryPushModal();
      if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
      showToast(
        perm === 'denied'
          ? 'تم رفض إذن الإشعارات — يرجى السماح بها من إعدادات المتصفح للمتابعة'
          : 'الاشتراك في الإشعارات مطلوب للدخول، اضغط السماح بالمتصفح',
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
    showToast('تم اشتراكك في الإشعارات بنجاح 🔔 أهلاً بك في أبو سعيد!');
  } catch (err) {
    showToast(err?.message || 'تعذر تفعيل الإشعارات، حاول مرة أخرى', 'warn');
  } finally {
    pushState.busy = false;
    renderHeaderIndicator();
    updateMandatoryPushModal();
    if ($('accountSheet')?.classList.contains('on')) renderAccountModalContent();
  }
}

export function openAccountModal() {
  const sheet = $('accountSheet');
  if (!sheet) return;
  renderAccountModalContent();
  sheet.classList.add('on');
  syncBodyModalLock();
  refreshPushState({ silentSync: false });
}

export function closeAccountModal() {
  const sheet = $('accountSheet');
  if (sheet) sheet.classList.remove('on');
  syncBodyModalLock();
}

export function refreshPushAccountInfo() {
  if ($('accountSheet')?.classList.contains('on')) {
    renderAccountModalContent();
  }
  if ($('pushMandatoryModal')?.classList.contains('on')) {
    renderMandatoryModalContent();
  }
}

export function initPushUI() {
  if (pushState.initialized) return;
  pushState.initialized = true;

  const badgeWrap = $('userBadgeWrap');
  const hdrPushBtn = $('hdrPushBtn');
  const accClose = $('accClose');
  const accountSheet = $('accountSheet');
  const accBody = $('accBody');
  const mandPanel = $('pushMandatoryPanel');

  if (badgeWrap) badgeWrap.addEventListener('click', openAccountModal);
  if (hdrPushBtn) hdrPushBtn.addEventListener('click', openAccountModal);
  if (accClose) accClose.addEventListener('click', closeAccountModal);
  if (accountSheet) {
    accountSheet.addEventListener('click', (e) => {
      if (e.target === accountSheet) closeAccountModal();
    });
  }

  if (accBody) {
    accBody.addEventListener('click', (e) => {
      if (e.target.closest('#accPushEnable')) enablePushNotifications();
      else if (e.target.closest('#accOpenOrdersBtn')) {
        closeAccountModal();
        state.hooks.openOrdersModal?.();
      }
    });
  }

  if (mandPanel) {
    mandPanel.addEventListener('click', (e) => {
      if (e.target.closest('#pushMandAllowBtn')) {
        enablePushNotifications();
      } else if (e.target.closest('#pushMandRetryBtn')) {
        enablePushNotifications();
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !hasActiveSubscriptionOnThisDevice()) {
      refreshPushState({ silentSync: true });
    }
  });

  // Immediately inspect push subscription right after login so mandatory modal appears centered
  refreshPushState({ silentSync: true });
}
