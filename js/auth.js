import { LOGO_FALLBACK } from '/js/logo-data.js';

function $(id) {
  return document.getElementById(id);
}

function initTheme() {
  const apply = (theme) => {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const btn = $('themeToggle');
    if (btn) {
      const isDark =
        theme === 'dark' ||
        (!theme &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.textContent = isDark ? '☀️' : '🌙';
    }
  };

  let saved = '';
  try {
    saved = localStorage.getItem('abu_theme') || '';
  } catch {}
  apply(saved);

  const btn = $('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isCurrentlyDark = current === 'dark' || (!current && prefersDark);
      const next = isCurrentlyDark ? 'light' : 'dark';
      try {
        localStorage.setItem('abu_theme', next);
      } catch {}
      apply(next);
    });
  }
}

function initLogo() {
  const img = $('brandLogo');
  if (img) img.src = LOGO_FALLBACK;
}

function initPasswordToggles() {
  document.querySelectorAll('[data-eye]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.eye);
      if (!target) return;
      const show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
    });
  });
}

function showMsg(id, msg, type = 'err') {
  const el = $(id);
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.className = 'alert alert-' + type;
  el.textContent = msg;
  el.hidden = false;
}

function clearLocalStoreCache() {
  try {
    localStorage.removeItem('abu_catalog_cache_v1');
  } catch {}
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload || {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

const SAVED_ACCOUNTS_KEY = 'abu_saved_accounts_v1';

function loadSavedAccounts() {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((a) => a && typeof a.identifier === 'string' && a.identifier.trim())
      : [];
  } catch {
    return [];
  }
}

function saveAccountProfile(profile) {
  const id = String(profile?.identifier || '').trim();
  if (!id) return;
  const list = loadSavedAccounts().filter((a) => a.identifier !== id);
  list.unshift({
    identifier: id,
    fullName: String(profile?.fullName || '').trim(),
    shopName: String(profile?.shopName || '').trim(),
    lastUsedAt: Date.now(),
  });
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {}
}

function removeSavedAccount(identifier) {
  const id = String(identifier || '').trim();
  const list = loadSavedAccounts().filter((a) => a.identifier !== id);
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {}
}

async function storeBrowserCredential({ identifier, password, fullName }) {
  try {
    if (
      window.PasswordCredential &&
      navigator.credentials &&
      typeof navigator.credentials.store === 'function'
    ) {
      const cred = new window.PasswordCredential({
        id: String(identifier || '').trim(),
        password: String(password || ''),
        name: String(fullName || identifier || '').trim(),
      });
      await navigator.credentials.store(cred);
    }
  } catch {
    // ignore unsupported browsers/contexts
  }
}

function renderSavedAccountsUI(identifierInput, passwordInput) {
  const box = $('savedAccountsBox');
  const listEl = $('savedAccountsList');
  if (!box || !listEl || !identifierInput) return;

  const render = () => {
    const accounts = loadSavedAccounts();
    listEl.innerHTML = '';
    if (!accounts.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const currentVal = identifierInput.value.trim();

    accounts.forEach((acc) => {
      const chip = document.createElement('div');
      chip.className = 'saved-chip' + (currentVal === acc.identifier ? ' active' : '');

      const pickBtn = document.createElement('button');
      pickBtn.type = 'button';
      pickBtn.className = 'saved-chip-pick';
      const titleEl = document.createElement('strong');
      titleEl.textContent = acc.fullName || acc.shopName || 'حساب محفوظ';
      const subEl = document.createElement('small');
      subEl.textContent = acc.shopName && acc.fullName
        ? `${acc.identifier} · ${acc.shopName}`
        : acc.identifier;
      pickBtn.appendChild(titleEl);
      pickBtn.appendChild(subEl);
      pickBtn.addEventListener('click', () => {
        identifierInput.value = acc.identifier;
        render();
        if (passwordInput) passwordInput.focus();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'saved-chip-del';
      delBtn.setAttribute('aria-label', 'حذف الحساب المحفوظ');
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSavedAccount(acc.identifier);
        if (identifierInput.value.trim() === acc.identifier) {
          const next = loadSavedAccounts();
          identifierInput.value = next[0]?.identifier || '';
        }
        render();
      });

      chip.appendChild(pickBtn);
      chip.appendChild(delBtn);
      listEl.appendChild(chip);
    });
  };

  const accounts = loadSavedAccounts();
  if (!identifierInput.value.trim() && accounts.length) {
    identifierInput.value = accounts[0].identifier;
  }
  identifierInput.addEventListener('input', render);
  render();
}

function initLoginPage() {
  const form = $('loginForm');
  if (!form) return;

  clearLocalStoreCache();

  const identifierInput = $('identifier');
  const passwordInput = $('password');
  const rememberCheck = $('rememberMe');
  renderSavedAccountsUI(identifierInput, passwordInput);

  const params = new URLSearchParams(location.search);
  const reason = params.get('reason');
  if (reason === 'suspended') {
    showMsg('loginAlert', '⛔ تم تعليق حسابك من قِبل الإدارة وتم تسجيل خروجك تلقائياً.', 'warn');
  } else if (reason === 'rejected') {
    showMsg('loginAlert', '❌ لم تتم الموافقة على حسابك من قِبل الإدارة.', 'err');
  } else if (reason === 'expired' || reason === 'deleted') {
    showMsg('loginAlert', 'انتهت جلستك أو لم يعد الحساب متاحاً، يرجى تسجيل الدخول مرة أخرى.', 'warn');
  } else if (params.get('loggedOut') === '1') {
    showMsg('loginAlert', 'تم تسجيل الخروج بنجاح.', 'ok');
  } else if (params.get('approved') === '1') {
    showMsg('loginAlert', '✅ تمت الموافقة على حسابك! يمكنك تسجيل الدخول الآن.', 'ok');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('loginAlert', '');
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberCheck ? Boolean(rememberCheck.checked) : true;

    if (!identifier || !password) {
      showMsg('loginAlert', 'يرجى إدخال رقم الهاتف وكلمة المرور.');
      return;
    }

    const btn = $('loginBtn');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'جاري التحقق...';

    try {
      const { ok, data } = await postJson('/api/auth/login', {
        identifier,
        password,
        rememberMe,
      });
      if (!ok) {
        showMsg('loginAlert', data.error || 'تعذر تسجيل الدخول، تأكد من البيانات.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }

      if (rememberMe) {
        saveAccountProfile({
          identifier: data.user?.phone || identifier,
          fullName: data.user?.fullName || '',
          shopName: data.user?.shopName || '',
        });
        await storeBrowserCredential({
          identifier: data.user?.phone || identifier,
          password,
          fullName: data.user?.fullName || '',
        });
      } else {
        removeSavedAccount(identifier);
        if (data.user?.phone) removeSavedAccount(data.user.phone);
      }

      if (data.status === 'Approved') {
        window.location.replace('/');
        return;
      }

      window.location.replace('/account-status');
    } catch {
      showMsg('loginAlert', 'حدث خطأ في الاتصال بالخادم، حاول مرة أخرى.');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

function initRegisterPage() {
  const form = $('registerForm');
  if (!form) return;

  clearLocalStoreCache();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('regAlert', '');

    const fullName = $('fullName').value.trim();
    const phone = $('phone').value.trim();
    const password = $('password').value;
    const confirmPassword = $('confirmPassword').value;
    const shopName = $('shopName').value.trim();
    const address = $('address').value.trim();
    const email = $('email').value.trim();

    if (fullName.length < 3) {
      showMsg('regAlert', 'يرجى كتابة الاسم بالكامل (٣ أحرف على الأقل).');
      return;
    }
    if (!phone) {
      showMsg('regAlert', 'يرجى إدخال رقم الهاتف.');
      return;
    }
    if (password.length < 6) {
      showMsg('regAlert', 'كلمة المرور يجب أن تكون ٦ أحرف أو أرقام على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      showMsg('regAlert', 'كلمتا المرور غير متطابقتين.');
      return;
    }

    const btn = $('regBtn');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'جاري إرسال الطلب...';

    try {
      const { ok, data } = await postJson('/api/auth/register', {
        fullName,
        phone,
        password,
        confirmPassword,
        shopName,
        address,
        email,
      });

      if (!ok) {
        showMsg('regAlert', data.error || 'تعذر إنشاء الحساب، راجع البيانات.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }

      saveAccountProfile({
        identifier: data.user?.phone || phone,
        fullName: data.user?.fullName || fullName,
        shopName: data.user?.shopName || shopName,
      });
      await storeBrowserCredential({
        identifier: data.user?.phone || phone,
        password,
        fullName: data.user?.fullName || fullName,
      });

      window.location.replace('/account-status?justRegistered=1');
    } catch {
      showMsg('regAlert', 'حدث خطأ في الاتصال بالخادم، حاول مرة أخرى.');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

function initStatusPage() {
  const box = $('statusBox');
  if (!box) return;

  clearLocalStoreCache();
  const params = new URLSearchParams(location.search);
  const justRegistered = params.get('justRegistered') === '1';

  let pollTimer = null;

  async function refreshStatus() {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
      if (!res.ok) {
        window.location.replace('/login');
        return;
      }
      const data = await res.json();
      if (!data.user) {
        window.location.replace('/login');
        return;
      }

      const u = data.user;
      $('stName').textContent = u.fullName || '—';
      $('stPhone').textContent = u.phone || '—';
      if (u.shopName) {
        $('stShopRow').hidden = false;
        $('stShop').textContent = u.shopName;
      } else {
        $('stShopRow').hidden = true;
      }
      $('statusMeta').hidden = false;

      const ico = $('statusIco');
      const pill = $('statusPill');
      const title = $('statusTitle');
      const desc = $('statusDesc');
      const reasonBox = $('rejectionBox');
      const enterBtn = $('enterStoreBtn');
      const refreshBtn = $('refreshStatusBtn');

      reasonBox.hidden = true;

      if (u.status === 'Approved') {
        clearInterval(pollTimer);
        ico.className = 'status-ico approved';
        ico.textContent = '✅';
        pill.className = 'status-pill approved';
        pill.textContent = 'Approved · تمت الموافقة';
        title.textContent = 'تمت الموافقة على حسابك!';
        desc.textContent = 'حسابك مفعّل الآن ويمكنك الدخول وتصفح أسعار الجملة وتقديم طلباتك.';
        refreshBtn.hidden = true;
        enterBtn.hidden = false;
        enterBtn.href = data.canEnterStore ? '/' : '/login?approved=1';
        enterBtn.textContent = data.canEnterStore ? 'دخول إلى المتجر الآن 🛒' : 'تسجيل الدخول للمتجر 🔐';
        return;
      }

      enterBtn.hidden = true;

      if (u.status === 'Pending') {
        ico.className = 'status-ico pending';
        ico.textContent = '⏳';
        pill.className = 'status-pill pending';
        pill.textContent = 'Pending · في انتظار موافقة الإدارة';
        title.textContent = justRegistered
          ? 'تم إرسال طلبك بنجاح!'
          : 'حسابك قيد المراجعة';
        desc.textContent =
          'تم إرسال طلب إنشاء حسابك بنجاح، وهو الآن قيد مراجعة الإدارة. لن تتمكن من تصفح الأصناف أو الأسعار حتى تتم الموافقة على حسابك.';
        refreshBtn.hidden = false;
      } else if (u.status === 'Rejected') {
        clearInterval(pollTimer);
        ico.className = 'status-ico rejected';
        ico.textContent = '❌';
        pill.className = 'status-pill rejected';
        pill.textContent = 'Rejected · مرفوض';
        title.textContent = 'لم تتم الموافقة على طلبك';
        desc.textContent =
          'نأسف، تم رفض طلب إنشاء هذا الحساب من قِبل إدارة المتجر ولا يمكن الدخول به.';
        if (u.rejectionReason) {
          reasonBox.textContent = 'سبب الرفض: ' + u.rejectionReason;
          reasonBox.hidden = false;
        }
        refreshBtn.hidden = true;
      } else if (u.status === 'Suspended') {
        clearInterval(pollTimer);
        ico.className = 'status-ico suspended';
        ico.textContent = '⛔';
        pill.className = 'status-pill suspended';
        pill.textContent = 'Suspended · موقوف من الإدارة';
        title.textContent = 'تم تعليق حسابك من الإدارة';
        desc.textContent =
          'تم إيقاف صلاحية دخول هذا الحساب مؤقتاً من قِبل الإدارة. يرجى التواصل مع إدارة المتجر لإعادة التفعيل.';
        refreshBtn.hidden = true;
      }
    } catch {
      // keep existing UI if offline transiently
    }
  }

  $('refreshStatusBtn')?.addEventListener('click', refreshStatus);
  $('switchAccountBtn')?.addEventListener('click', async () => {
    await postJson('/api/auth/logout', {});
    window.location.replace('/login');
  });

  refreshStatus();
  pollTimer = setInterval(refreshStatus, 8000);
}

initTheme();
initLogo();
initPasswordToggles();
initLoginPage();
initRegisterPage();
initStatusPage();
