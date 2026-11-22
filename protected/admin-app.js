(function () {
  var D = { v: 1, cfg: { phone: '', min: 0, unit: 'كرتونة' }, cats: [], catMeta: {}, p: [], offers: [] };
  var tab = 'dashboard';
  var q = '';
  var dirty = false;
  var ei = -1;
  var oei = -1;
  var pal = 0;
  var IMG = {};
  var PEND = {};
  var eimg = '';
  var enew = '';
  var fls = [];
  var dupFrom = -1;

  var PAL = [
    ['أصفر', '#ffd23f', '#e8a400'],
    ['أحمر', '#ff4b3e', '#b3201a'],
    ['برتقالي', '#ff9f1c', '#c26a00'],
    ['أزرق', '#2b6cff', '#0f3fa8'],
    ['أخضر', '#17b26a', '#0b7a46'],
    ['بني', '#6b3e26', '#3a1f10'],
    ['وردي', '#ff5c8a', '#b3234f'],
    ['بيج', '#f1d58a', '#b58a22'],
  ];

  var PAGE_META = {
    dashboard: ['لوحة المعلومات', 'ملخص مباشر لحالة المتجر والطلبات والحسابات'],
    p: ['الأصناف والأسعار', 'إدارة الأصناف والأسعار والنكهات والترتيب والتعديل الجماعي'],
    c: ['إدارة الأقسام', 'ترتيب الأقسام بالسحب والإفلات، التفعيل، والصور المصغرة'],
    o: ['العروض الخاصة', 'العروض المجدولة والخصومات ومعاينة العرض المباشرة'],
    content: ['محتوى الواجهة', 'تحرير نصوص الهيرو والبانر ورسائل واتساب مع معاينة حية'],
    media: ['الصور والملفات', 'إدارة الأصول والصور والخطوط ومراقبة الملفات غير المستخدمة'],
    orders: ['إدارة الطلبات', 'متابعة طلبات العملاء عبر واتساب وحالات التنفيذ'],
    u: ['المستخدمون والحسابات', 'اعتماد الحسابات الجديدة وإدارة حالات التجار'],
    n: ['مركز الإشعارات', 'بث الإشعارات الفورية وإدارة الأجهزة المسجلة وسجلات الإرسال'],
    ai: ['مساعد Rahal Ai', 'مساحة العمل الذكية لإضافة الأصناف والتعديلات الجماعية'],
    analytics: ['التقارير والإحصائيات', 'تحليلات الأسعار والطلبات والتصدير بصيغ CSV وJSON'],
    audit: ['سجل النشاطات', 'تتبع كافة عمليات الإدارة والتعديلات الحقيقية'],
    backups: ['النسخ الاحتياطي', 'حفظ واستعادة وتصدير واستيراد نسخ المتجر الكاملة'],
    s: ['إعدادات النظام', 'الإعدادات العامة والمظهر والأمان وفحص صحة النظام'],
  };

  // Product view state
  var prodView = 'table'; // 'table' | 'grid'
  var prodCatFilter = 'all';
  var prodStatusFilter = 'all'; // 'all' | 'active' | 'hidden' | 'discount' | 'noimg'
  var prodSort = 'order'; // 'order' | 'price_asc' | 'price_desc' | 'name'
  var prodSelected = {};

  // Offer view state
  var offerSubTab = 'all'; // 'all' | 'active' | 'scheduled' | 'expired' | 'hidden'

  // Users / Orders / Push / Media / Audit / Backups / Health / Settings state
  var adminMe = { email: '', uid: '', sessionCreatedAt: '', sessionExpiresAt: '' };
  var usersData = [];
  var userCounts = { all: 0, Pending: 0, Approved: 0, Rejected: 0, Suspended: 0 };
  var userFilter = 'all';
  var userQuery = '';
  var usersLoading = false;
  var usersBusyId = '';
  var usersSetupNotice = '';

  var ordersData = [];
  var orderCounts = { all: 0, sent_whatsapp: 0, confirmed: 0, completed: 0, cancelled: 0 };
  var orderFilter = 'all';
  var orderQuery = '';
  var ordersLoading = false;
  var ordersBusyId = '';
  var ordersSetupNotice = '';

  var pushOverview = {
    configured: false,
    missingVars: [],
    subscriberCount: 0,
    deviceCount: 0,
    segments: [],
    subscribedUsers: [],
    logs: [],
  };
  var pushDevices = [];
  var pushDevicesLoading = false;
  var pushSubTab = 'compose'; // 'compose' | 'devices' | 'logs'
  var pushLogQuery = '';
  var pushLogFilter = 'all';
  var pushLoading = false;
  var pushSending = false;
  var pushSetupNotice = '';
  var pushForm = {
    targetType: 'all',
    targetUserId: '',
    targetSegment: 'withShop',
    title: '',
    body: '',
    urlPreset: '/',
    urlCustom: '',
    imageDataUrl: '',
  };

  var mediaItems = [];
  var mediaLoading = false;
  var mediaLoaded = false;
  var mediaFilter = 'all'; // 'all' | 'used' | 'unused' | 'fonts'
  var mediaQuery = '';

  var auditLogs = [];
  var auditLoading = false;
  var auditLoaded = false;
  var auditTypeFilter = 'all';
  var auditQuery = '';

  var backupsList = [];
  var backupsLoading = false;
  var backupsLoaded = false;

  var healthData = null;
  var healthLoading = false;

  var settingsSubTab = 'general'; // 'general' | 'appearance' | 'security' | 'health'

  var $ = function (i) {
    return document.getElementById(i);
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function AN() {
    var n = D && D.cfg && D.cfg.rn != null ? String(D.cfg.rn).trim() : '';
    return n || 'Rahal Ai';
  }

  function toast(m) {
    var t = $('ts');
    if (!t) return;
    t.textContent = m;
    t.className = 'toast on';
    clearTimeout(toast.t);
    toast.t = setTimeout(function () {
      t.className = 'toast';
    }, 3000);
  }

  function ensureCatMeta() {
    if (!D.catMeta || typeof D.catMeta !== 'object') D.catMeta = {};
    return D.catMeta;
  }

  function updatePublishStatusUI() {
    var st = $('st');
    var pb = $('pub');
    if (st) {
      if (dirty) {
        st.textContent = '• توجد تعديلات غير منشورة';
        st.classList.add('dirty');
      } else {
        st.classList.remove('dirty');
        st.textContent =
          D.cfg && D.cfg.lastPublishedAt
            ? 'آخر نشر: ' + formatDateAr(D.cfg.lastPublishedAt)
            : 'متزامن مع المتجر';
      }
    }
    if (pb) pb.classList.toggle('hot', dirty);
  }

  function mark() {
    dirty = true;
    updatePublishStatusUI();
  }

  window.onbeforeunload = function () {
    if (dirty) return 'x';
  };

  function cnt(c) {
    return D.p.filter(function (p) {
      return p[1] == c;
    }).length;
  }

  function np(v) {
    v = String(v || '')
      .replace(/[٠-٩]/g, function (d) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
      })
      .replace(/\D/g, '');
    if (v.indexOf('00') == 0) v = v.slice(2);
    if (v[0] == '0') v = '20' + v.slice(1);
    return v;
  }

  function formatDateAr(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch (e) {
      return String(iso);
    }
  }

  function formatBytes(bytes) {
    var n = Number(bytes || 0);
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function handleAdminUnauthorized() {
    dirty = false;
    toast('انتهت جلسة الإدارة، يرجى تسجيل الدخول مجدداً');
    setTimeout(function () {
      location.reload();
    }, 800);
  }

  // ===== Theme & Sidebar State =====
  function syncThemeUI() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var btn = $('admThemeBtn');
    if (btn) {
      btn.textContent = cur === 'dark' ? '☀️' : '🌙';
      btn.title = cur === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن';
    }
  }

  function toggleAdminTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('abu_admin_theme', next);
    } catch (e) {}
    syncThemeUI();
  }

  function applySavedSidebarState() {
    var shell = $('app');
    if (!shell) return;
    try {
      if (localStorage.getItem('abu_sb_collapsed') === '1') {
        shell.classList.add('sb-collapsed');
      }
    } catch (e) {}
  }

  function closeMobileDrawerDom() {
    var shell = $('app');
    var bd = $('sbBackdrop');
    if (shell) shell.classList.remove('sb-mobile-open');
    if (bd) bd.classList.remove('on');
  }

  function openMobileDrawerDom() {
    var shell = $('app');
    var bd = $('sbBackdrop');
    if (shell) shell.classList.add('sb-mobile-open');
    if (bd) bd.classList.add('on');
  }

  // ===== History API Navigation & Scroll Restoration Router =====
  var ADM_SCROLL_KEY = 'abu_admin_scroll_v1';
  var VALID_TABS = {};
  Object.keys(PAGE_META).forEach(function (k) {
    VALID_TABS[k] = 1;
  });
  var VALID_SUBS = {
    s: ['general', 'appearance', 'security', 'health'],
    n: ['compose', 'devices', 'logs'],
    o: ['all', 'active', 'scheduled', 'expired', 'hidden'],
  };
  var DEFAULT_SUBS = { s: 'general', n: 'compose', o: 'all' };

  var admNavIdx = 0;
  var admBaseIdx = 0;
  var admOvSteps = 0;
  var admCurrentSnap = null;
  var admRestoringPop = false;
  var admBootstrapDone = false;
  var admPendingDeepOv = null;
  var admScrollMap = {};
  var activeCovCancel = null;
  var activeCovCommit = null;

  try {
    var rawAdmScroll = sessionStorage.getItem(ADM_SCROLL_KEY);
    if (rawAdmScroll) admScrollMap = JSON.parse(rawAdmScroll) || {};
  } catch (e) {}

  function persistAdmScrollMap() {
    try {
      var keys = Object.keys(admScrollMap);
      if (keys.length > 60) {
        keys.slice(0, keys.length - 60).forEach(function (k) {
          delete admScrollMap[k];
        });
      }
      sessionStorage.setItem(ADM_SCROLL_KEY, JSON.stringify(admScrollMap));
    } catch (e) {}
  }

  function getAdmPageKey(snap) {
    var s = snap || admCurrentSnap || {};
    return String(s.tab || 'dashboard') + ':' + String(s.sub || '');
  }

  function saveAdmScroll(idx, snap) {
    var y = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
    var targetIdx = typeof idx === 'number' ? idx : admNavIdx;
    admScrollMap['idx_' + targetIdx] = y;
    admScrollMap['page_' + getAdmPageKey(snap)] = y;
    persistAdmScrollMap();
  }

  function readAdmScroll(idx, snap) {
    var kIdx = 'idx_' + idx;
    if (typeof admScrollMap[kIdx] === 'number') return admScrollMap[kIdx];
    var kPage = 'page_' + getAdmPageKey(snap);
    if (typeof admScrollMap[kPage] === 'number') return admScrollMap[kPage];
    return 0;
  }

  function restoreAdmScroll(y) {
    var target = Math.max(0, Number(y) || 0);
    requestAnimationFrame(function () {
      window.scrollTo({ top: target, behavior: 'auto' });
      setTimeout(function () {
        window.scrollTo({ top: target, behavior: 'auto' });
      }, 40);
    });
  }

  function normalizeAdminSnap(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var nextTab = VALID_TABS[r.tab] ? String(r.tab) : 'dashboard';
    var subList = VALID_SUBS[nextTab];
    var nextSub = '';
    if (subList) {
      nextSub = subList.indexOf(r.sub) > -1 ? String(r.sub) : DEFAULT_SUBS[nextTab];
    }
    var validOv = ['prod', 'offer', 'user', 'ai-chat', 'ai-batch', 'ai-review'];
    var nextOv = validOv.indexOf(r.ov) > -1 ? String(r.ov) : '';
    var nextOvIdx = Number.isFinite(Number(r.ovIdx)) ? Math.trunc(Number(r.ovIdx)) : -1;
    var nextOvDupFrom = Number.isFinite(Number(r.ovDupFrom)) ? Math.trunc(Number(r.ovDupFrom)) : -1;
    var nextOvCat = nextOv === 'prod' && r.ovCat ? String(r.ovCat) : '';
    var nextOvUid = nextOv === 'user' && r.ovUid ? String(r.ovUid) : '';
    return {
      tab: nextTab,
      sub: nextSub,
      drawer: Boolean(r.drawer) && !nextOv,
      ov: nextOv,
      ovIdx: nextOv === 'prod' || nextOv === 'offer' ? nextOvIdx : -1,
      ovCat: nextOvCat,
      ovDupFrom: nextOv === 'prod' ? nextOvDupFrom : -1,
      ovUid: nextOvUid,
      cov: Boolean(r.cov),
    };
  }

  function sameAdminSnap(a, b) {
    if (!a || !b) return false;
    return (
      a.tab === b.tab &&
      a.sub === b.sub &&
      Boolean(a.drawer) === Boolean(b.drawer) &&
      a.ov === b.ov &&
      a.ovIdx === b.ovIdx &&
      a.ovCat === b.ovCat &&
      a.ovDupFrom === b.ovDupFrom &&
      a.ovUid === b.ovUid &&
      Boolean(a.cov) === Boolean(b.cov)
    );
  }

  function parseAdminSnapFromLocation() {
    var params = new URLSearchParams(location.search || '');
    var raw = {
      tab: params.get('tab') || 'dashboard',
      sub: params.get('sub') || '',
      ov: params.get('modal') || '',
      ovIdx: params.has('id') ? params.get('id') : -1,
      ovCat: params.get('cat') || '',
      ovDupFrom: params.has('dup') ? params.get('dup') : -1,
      ovUid: params.get('uid') || '',
      drawer: false,
      cov: false,
    };
    return normalizeAdminSnap(raw);
  }

  function buildAdminUrl(snap) {
    var s = normalizeAdminSnap(snap);
    var url = new URL(location.href);
    var params = new URLSearchParams();
    if (s.tab && s.tab !== 'dashboard') params.set('tab', s.tab);
    if (s.sub && VALID_SUBS[s.tab] && s.sub !== DEFAULT_SUBS[s.tab]) params.set('sub', s.sub);
    if (s.ov) {
      params.set('modal', s.ov);
      if (s.ov === 'prod' || s.ov === 'offer') params.set('id', String(s.ovIdx));
      if (s.ov === 'prod' && s.ovCat) params.set('cat', s.ovCat);
      if (s.ov === 'prod' && s.ovDupFrom >= 0) params.set('dup', String(s.ovDupFrom));
      if (s.ov === 'user' && s.ovUid) params.set('uid', s.ovUid);
    }
    var qs = params.toString();
    url.search = qs ? '?' + qs : '';
    return url.pathname + url.search + (url.hash || '');
  }

  function admCanGoBack() {
    return admNavIdx > admBaseIdx;
  }

  function syncAdmBackButton() {
    var btn = $('admBackBtn');
    if (!btn) return;
    var s = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    var show = admCanGoBack() || s.tab !== 'dashboard' || Boolean(s.ov) || Boolean(s.drawer) || Boolean(s.cov);
    btn.hidden = !show;
    if (s.cov || s.ov || s.drawer) btn.title = 'إغلاق والرجوع';
    else if (admCanGoBack()) btn.title = 'الرجوع للخطوة السابقة';
    else btn.title = 'العودة للوحة المعلومات';
  }

  function ensureTabSubSynced(snap) {
    tab = snap.tab;
    if (snap.tab === 's' && snap.sub) settingsSubTab = snap.sub;
    else if (snap.tab === 'n' && snap.sub) pushSubTab = snap.sub;
    else if (snap.tab === 'o' && snap.sub) offerSubTab = snap.sub;
  }

  function triggerTabDataLoads(targetTab) {
    if (targetTab === 'orders') loadOrders(true);
    if (targetTab === 'u') loadUsers(true);
    if (targetTab === 'n') {
      loadPushOverview(true);
      loadPushDevices(true);
    }
    if (targetTab === 'media' && !mediaLoaded) loadMedia(false);
    if (targetTab === 'audit') loadAuditLogs(true);
    if (targetTab === 'backups') loadBackups(true);
    if (targetTab === 's' && settingsSubTab === 'health' && !healthData) loadHealth(true);
    if (targetTab === 'dashboard') {
      loadAuditLogs(true);
      if (!healthData) loadHealth(true);
    }
  }

  function applyAdminSnapToUI(nextSnap, opts) {
    var prev = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    var o = opts || {};
    var tabOrSubChanged = prev.tab !== nextSnap.tab || prev.sub !== nextSnap.sub;

    // 1. Handle #cov transient confirm/reject dialog
    if (prev.cov && !nextSnap.cov) {
      if (activeCovCommit) {
        var commitCb = activeCovCommit;
        activeCovCommit = null;
        activeCovCancel = null;
        commitCb();
      } else if (activeCovCancel) {
        var cancelCb = activeCovCancel;
        activeCovCancel = null;
        cancelCb();
      } else {
        var covEl = $('cov');
        if (covEl) {
          covEl.classList.remove('on');
          covEl.innerHTML = '';
        }
      }
    } else if (nextSnap.cov && !activeCovCancel) {
      // Browser Forward into an already completed/dismissed confirm dialog — do not resurrect
      nextSnap.cov = false;
      var covEl2 = $('cov');
      if (covEl2) {
        covEl2.classList.remove('on');
        covEl2.innerHTML = '';
      }
    }

    // 2. Sync mobile drawer
    if (nextSnap.drawer) openMobileDrawerDom();
    else closeMobileDrawerDom();

    // 3. Sync tab & subtab + lazy loads + render
    ensureTabSubSynced(nextSnap);
    admCurrentSnap = nextSnap;
    if (tabOrSubChanged || !o.skipTabRender) {
      render();
      if (tabOrSubChanged) triggerTabDataLoads(nextSnap.tab);
    }

    // 4. Sync #ov modal
    var ovSame =
      prev.ov === nextSnap.ov &&
      prev.ovIdx === nextSnap.ovIdx &&
      prev.ovCat === nextSnap.ovCat &&
      prev.ovDupFrom === nextSnap.ovDupFrom &&
      prev.ovUid === nextSnap.ovUid;

    if (!nextSnap.ov) {
      if (prev.ov || $('ov').classList.contains('on')) {
        vStop();
        $('ov').classList.remove('on');
      }
      admOvSteps = 0;
    } else if (!ovSame || o.forceOverlay) {
      if (!admBootstrapDone && (nextSnap.ov === 'prod' || nextSnap.ov === 'offer' || nextSnap.ov === 'user')) {
        admPendingDeepOv = nextSnap;
      } else {
        openOverlayFromSnap(nextSnap);
      }
    }

    // 5. Scroll position handling
    if (o.isPop) {
      if (!nextSnap.ov && !nextSnap.cov) {
        if (prev.ov && !tabOrSubChanged) {
          restoreAdmScroll(readAdmScroll(admNavIdx, nextSnap));
        } else if (tabOrSubChanged) {
          restoreAdmScroll(readAdmScroll(admNavIdx, nextSnap));
        }
      }
    } else if (tabOrSubChanged && !o.preserveScroll) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    syncAdmBackButton();
  }

  function commitAdminRoute(patch, opts) {
    if (admRestoringPop) return admCurrentSnap;
    var o = opts || {};
    var prev = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    var next = normalizeAdminSnap(Object.assign({}, prev, patch || {}));
    var mode = o.mode === 'replace' ? 'replace' : 'push';

    if (sameAdminSnap(prev, next) && !o.forceOverlay) {
      syncAdmBackButton();
      return prev;
    }

    saveAdmScroll(admNavIdx, prev);

    if (mode === 'push') {
      admNavIdx += 1;
      if (next.ov && !next.cov) {
        admOvSteps = prev.ov ? admOvSteps + 1 : 1;
      } else if (!next.ov && !next.cov) {
        admOvSteps = 0;
      }
    } else {
      if (!next.ov && !next.cov) admOvSteps = 0;
    }

    var stateObj = {
      __abuAdmNav: 1,
      idx: admNavIdx,
      baseIdx: admBaseIdx,
      ovSteps: admOvSteps,
      snap: next,
    };
    var url = buildAdminUrl(next);
    try {
      if (mode === 'replace') history.replaceState(stateObj, '', url);
      else history.pushState(stateObj, '', url);
    } catch (e) {}

    applyAdminSnapToUI(next, Object.assign({}, o, { isPop: false }));
    return next;
  }

  function popAdminOverlay(preferTarget) {
    var cur = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    if (cur.cov || activeCovCancel || ($('cov') && $('cov').classList.contains('on'))) {
      if (cur.cov && admCanGoBack()) {
        history.back();
      } else if (activeCovCancel) {
        var cancelCb = activeCovCancel;
        activeCovCancel = null;
        activeCovCommit = null;
        cancelCb();
        commitAdminRoute({ cov: false }, { mode: 'replace' });
      }
      return true;
    }
    if (cur.ov || $('ov').classList.contains('on')) {
      if (preferTarget === 'base') {
        if (admOvSteps > 0 && admNavIdx - admOvSteps >= admBaseIdx) {
          history.go(-admOvSteps);
        } else {
          commitAdminRoute({ ov: '', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '' }, { mode: 'replace' });
        }
      } else if (admCanGoBack()) {
        history.back();
      } else {
        commitAdminRoute({ ov: '', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '' }, { mode: 'replace' });
      }
      return true;
    }
    if (cur.drawer || ($('app') && $('app').classList.contains('sb-mobile-open'))) {
      if (cur.drawer && admCanGoBack()) history.back();
      else commitAdminRoute({ drawer: false }, { mode: 'replace' });
      return true;
    }
    return false;
  }

  function admGoBackOrHome() {
    if (admCanGoBack()) {
      history.back();
      return;
    }
    if (popAdminOverlay('base')) return;
    if (tab !== 'dashboard') {
      switchTab('dashboard', { mode: 'replace' });
    }
  }

  function closeMobileDrawer() {
    var cur = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    if (cur.drawer) {
      if (admCanGoBack()) history.back();
      else commitAdminRoute({ drawer: false }, { mode: 'replace' });
    } else {
      closeMobileDrawerDom();
    }
  }

  function renderSkeletonCards(count) {
    var n = count || 3;
    var h = '<div class="cards-grid">';
    for (var i = 0; i < n; i++) {
      h += '<div class="card"><div class="skeleton" style="height:20px;width:55%;margin-bottom:10px"></div><div class="skeleton" style="height:14px;width:85%;margin-bottom:8px"></div><div class="skeleton" style="height:36px;width:100%"></div></div>';
    }
    return h + '</div>';
  }

  // ===== Custom Confirm, Reject & Safe Modals =====
  function askConfirm(message, okLabel, okTone) {
    return new Promise(function (resolve) {
      var cov = $('cov');
      if (!cov) {
        resolve(false);
        return;
      }
      var settled = false;
      var cls = okTone === 'primary' ? 'btn btn-primary btn-lg' : 'btn btn-danger-solid btn-lg';
      cov.innerHTML =
        '<div class="pn" style="max-width:440px">' +
        '<h2>تأكيد العملية<button class="x" type="button" id="covNo">✕</button></h2>' +
        '<p style="margin:10px 0 18px;font-size:14.5px;line-height:1.7;color:var(--ink-2)">' +
        esc(message) +
        '</p>' +
        '<div class="r2">' +
        '<button class="' +
        cls +
        '" type="button" id="covYes">' +
        esc(okLabel || 'تأكيد') +
        '</button>' +
        '<button class="btn btn-lg" type="button" id="covCancel">إلغاء</button>' +
        '</div></div>';
      cov.classList.add('on');
      function cleanup() {
        cov.classList.remove('on');
        cov.innerHTML = '';
        cov.removeEventListener('click', onClick);
        if (activeCovCancel === cancelFromHistory) activeCovCancel = null;
        if (activeCovCommit === commitCallback) activeCovCommit = null;
      }
      function cancelFromHistory() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      }
      var commitCallback = null;
      function finishYes() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      }
      function onClick(e) {
        var t = e.target;
        if (t === cov || t.id === 'covNo' || t.id === 'covCancel') {
          if (admCurrentSnap && admCurrentSnap.cov && admCanGoBack()) history.back();
          else cancelFromHistory();
        } else if (t.id === 'covYes') {
          if (admCurrentSnap && admCurrentSnap.cov && admCanGoBack()) {
            commitCallback = finishYes;
            activeCovCommit = finishYes;
            history.back();
            setTimeout(finishYes, 150);
          } else {
            finishYes();
          }
        }
      }
      activeCovCancel = cancelFromHistory;
      cov.addEventListener('click', onClick);
      commitAdminRoute({ cov: true }, { mode: 'push', skipTabRender: true });
    });
  }

  function askRejectReason(userName) {
    return new Promise(function (resolve) {
      var cov = $('cov');
      if (!cov) {
        resolve(null);
        return;
      }
      var settled = false;
      cov.innerHTML =
        '<div class="pn" style="max-width:460px">' +
        '<h2>رفض طلب الحساب<button class="x" type="button" id="rejNo">✕</button></h2>' +
        '<p class="hint">المستخدم: <b>' +
        esc(userName) +
        '</b></p>' +
        '<label class="field-lbl">سبب الرفض (اختياري — يظهر للمستخدم)</label>' +
        '<textarea id="rejReason" rows="3" placeholder="مثال: بيانات النشاط التجاري غير مكتملة"></textarea>' +
        '<div class="r2" style="margin-top:14px">' +
        '<button class="btn btn-danger-solid btn-lg" type="button" id="rejYes">تأكيد الرفض</button>' +
        '<button class="btn btn-lg" type="button" id="rejCancel">إلغاء</button>' +
        '</div></div>';
      cov.classList.add('on');
      setTimeout(function () {
        var ta = $('rejReason');
        if (ta) ta.focus();
      }, 40);
      function cleanup() {
        cov.classList.remove('on');
        cov.innerHTML = '';
        cov.removeEventListener('click', onClick);
        if (activeCovCancel === cancelFromHistory) activeCovCancel = null;
        if (activeCovCommit === commitCallback) activeCovCommit = null;
      }
      function cancelFromHistory() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      }
      var pendingReason = '';
      var commitCallback = null;
      function finishYes() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(pendingReason);
      }
      function onClick(e) {
        var t = e.target;
        if (t === cov || t.id === 'rejNo' || t.id === 'rejCancel') {
          if (admCurrentSnap && admCurrentSnap.cov && admCanGoBack()) history.back();
          else cancelFromHistory();
        } else if (t.id === 'rejYes') {
          var ta = $('rejReason');
          pendingReason = ta ? ta.value.trim() : '';
          if (admCurrentSnap && admCurrentSnap.cov && admCanGoBack()) {
            commitCallback = finishYes;
            activeCovCommit = finishYes;
            history.back();
            setTimeout(finishYes, 150);
          } else {
            finishYes();
          }
        }
      }
      activeCovCancel = cancelFromHistory;
      cov.addEventListener('click', onClick);
      commitAdminRoute({ cov: true }, { mode: 'push', skipTabRender: true });
    });
  }

  // ===== Real-Data SVG Charts =====
  function svgBarChart(items, color) {
    if (!items || !items.length) {
      return '<div class="emp" style="padding:20px">لا توجد بيانات كافية لعرض الرسم البياني</div>';
    }
    var W = 520;
    var H = 200;
    var padL = 24;
    var padR = 16;
    var padT = 18;
    var padB = 42;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var maxVal = Math.max.apply(
      null,
      items.map(function (x) {
        return Number(x.value || 0);
      })
    );
    if (maxVal <= 0) maxVal = 1;
    var barSlot = plotW / items.length;
    var barW = Math.min(38, Math.max(12, barSlot * 0.58));
    var bars = '';
    var grid = '';
    for (var g = 0; g <= 3; g++) {
      var gy = padT + (plotH * g) / 3;
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--border)" stroke-dasharray="3 3" />';
    }
    items.forEach(function (it, idx) {
      var val = Number(it.value || 0);
      var bh = Math.max(val > 0 ? 4 : 0, (val / maxVal) * plotH);
      var cx = padL + barSlot * idx + barSlot / 2;
      var x = cx - barW / 2;
      var y = padT + plotH - bh;
      var tip = esc(it.label + ': ' + val + (it.suffix || ''));
      var shortLbl = String(it.label || '').slice(0, 9);
      bars +=
        '<g class="chart-hit" data-tip="' +
        tip +
        '" data-tx="' +
        cx +
        '" data-ty="' +
        y +
        '">' +
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        barW +
        '" height="' +
        bh +
        '" rx="6" fill="' +
        (it.color || color || 'var(--blue)') +
        '"></rect>' +
        '<text x="' +
        cx +
        '" y="' +
        (H - 14) +
        '" text-anchor="middle" font-size="10.5" fill="var(--mu)">' +
        esc(shortLbl) +
        '</text>' +
        '</g>';
    });
    return (
      '<div class="chart-wrap">' +
      '<div class="chart-tooltip"></div>' +
      '<svg class="chart-svg" viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '">' +
      grid +
      bars +
      '</svg></div>'
    );
  }

  function svgLineChart(seriesList, labels) {
    if (!labels || !labels.length) {
      return '<div class="emp" style="padding:20px">لا توجد بيانات تاريخية كافية حتى الآن</div>';
    }
    var W = 520;
    var H = 200;
    var padL = 24;
    var padR = 16;
    var padT = 18;
    var padB = 38;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var maxVal = 1;
    seriesList.forEach(function (sr) {
      (sr.values || []).forEach(function (v) {
        if (Number(v) > maxVal) maxVal = Number(v);
      });
    });
    var grid = '';
    for (var g = 0; g <= 3; g++) {
      var gy = padT + (plotH * g) / 3;
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--border)" stroke-dasharray="3 3" />';
    }
    var paths = '';
    var dots = '';
    var xLbls = '';
    var stepX = labels.length > 1 ? plotW / (labels.length - 1) : 0;
    labels.forEach(function (lb, idx) {
      var cx = labels.length > 1 ? padL + idx * stepX : padL + plotW / 2;
      if (labels.length <= 10 || idx % Math.ceil(labels.length / 7) === 0 || idx === labels.length - 1) {
        xLbls +=
          '<text x="' +
          cx +
          '" y="' +
          (H - 12) +
          '" text-anchor="middle" font-size="10.5" fill="var(--mu)">' +
          esc(lb) +
          '</text>';
      }
    });
    seriesList.forEach(function (sr) {
      var pts = [];
      (sr.values || []).forEach(function (v, idx) {
        var val = Number(v || 0);
        var cx = labels.length > 1 ? padL + idx * stepX : padL + plotW / 2;
        var cy = padT + plotH - (val / maxVal) * plotH;
        pts.push(cx.toFixed(1) + ',' + cy.toFixed(1));
        dots +=
          '<circle class="chart-hit" cx="' +
          cx +
          '" cy="' +
          cy +
          '" r="4.5" fill="' +
          sr.color +
          '" stroke="var(--surface)" stroke-width="2" data-tip="' +
          esc((sr.name ? sr.name + ' · ' : '') + labels[idx] + ': ' + val) +
          '" data-tx="' +
          cx +
          '" data-ty="' +
          cy +
          '"></circle>';
      });
      if (pts.length > 1) {
        paths +=
          '<polyline fill="none" stroke="' +
          sr.color +
          '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="' +
          pts.join(' ') +
          '"></polyline>';
      }
    });
    var legend =
      '<div class="chart-legend">' +
      seriesList
        .map(function (sr) {
          return '<span><i style="background:' + sr.color + '"></i>' + esc(sr.name) + '</span>';
        })
        .join('') +
      '</div>';
    return (
      '<div class="chart-wrap">' +
      '<div class="chart-tooltip"></div>' +
      '<svg class="chart-svg" viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '">' +
      grid +
      paths +
      xLbls +
      dots +
      '</svg>' +
      legend +
      '</div>'
    );
  }

  function bindChartTooltips(root) {
    if (!root) return;
    [].forEach.call(root.querySelectorAll('.chart-wrap'), function (wrap) {
      var tipEl = wrap.querySelector('.chart-tooltip');
      var svgEl = wrap.querySelector('.chart-svg');
      if (!tipEl || !svgEl) return;
      wrap.addEventListener('mousemove', function (e) {
        var hit = e.target.closest && e.target.closest('.chart-hit');
        if (!hit) {
          tipEl.classList.remove('on');
          return;
        }
        var txt = hit.getAttribute('data-tip') || '';
        if (!txt) return;
        var rect = svgEl.getBoundingClientRect();
        var tx = Number(hit.getAttribute('data-tx') || 0);
        var ty = Number(hit.getAttribute('data-ty') || 0);
        var px = (tx / 520) * rect.width;
        var py = (ty / 200) * rect.height;
        tipEl.textContent = txt;
        tipEl.style.left = px + 'px';
        tipEl.style.top = py + 'px';
        tipEl.classList.add('on');
      });
      wrap.addEventListener('mouseleave', function () {
        tipEl.classList.remove('on');
      });
    });
  }

  // ===== Offers Schedule Helper =====
  function getOfferStatus(o) {
    if (o.x) return 'hidden';
    var today = new Date().toISOString().slice(0, 10);
    if (o.startDate && String(o.startDate) > today) return 'scheduled';
    if (o.endDate && String(o.endDate) < today) return 'expired';
    return 'active';
  }

  function OFS() {
    return D.offers || (D.offers = []);
  }

  // ===== 1. DASHBOARD VIEW =====
  function vDashboard() {
    var totalProd = D.p.length;
    var hiddenProd = D.p.filter(function (p) {
      return !!p[7];
    }).length;
    var activeProd = totalProd - hiddenProd;
    var totalCats = D.cats.length;
    var activeOffers = OFS().filter(function (o) {
      return getOfferStatus(o) === 'active';
    }).length;
    var totalUsers = Number(userCounts.all || usersData.length || 0);
    var pendingUsers = Number(userCounts.Pending || 0);
    var pushSubs = Number(pushOverview.subscriberCount || 0);
    var pushDevicesCnt = Number(pushOverview.deviceCount || 0);
    var newOrdersCnt = Number(orderCounts.sent_whatsapp || 0);

    var kpis = [
      { lbl: 'إجمالي الأصناف', val: totalProd, sub: 'في ' + totalCats + ' قسم', ico: '📦', bg: 'var(--blue-soft)', fg: 'var(--blue)', go: 'p' },
      { lbl: 'الأصناف النشطة', val: activeProd, sub: 'ظاهرة حالياً بالمتجر', ico: '✅', bg: 'var(--green-soft)', fg: 'var(--green)', go: 'p' },
      { lbl: 'الأصناف المخفية', val: hiddenProd, sub: 'غير معروضة للعملاء', ico: '🙈', bg: 'var(--surface-3)', fg: 'var(--mu)', go: 'p' },
      { lbl: 'الأقسام', val: totalCats, sub: 'تصنيفات المتجر', ico: '🗂', bg: 'var(--brand-soft)', fg: 'var(--brand)', go: 'c' },
      { lbl: 'العروض النشطة', val: activeOffers, sub: 'من أصل ' + OFS().length + ' عرض', ico: '🎁', bg: 'var(--purple-soft)', fg: 'var(--purple)', go: 'o' },
      { lbl: 'إجمالي المستخدمين', val: totalUsers, sub: Number(userCounts.Approved || 0) + ' حساب مفعّل', ico: '👥', bg: 'var(--blue-soft)', fg: 'var(--blue)', go: 'u' },
      { lbl: 'تنتظر الموافقة', val: pendingUsers, sub: pendingUsers > 0 ? 'تحتاج مراجعة الإدارة' : 'لا توجد طلبات معلقة', ico: '⏳', bg: pendingUsers > 0 ? 'var(--amber-soft)' : 'var(--surface-3)', fg: pendingUsers > 0 ? 'var(--amber)' : 'var(--mu)', go: 'u' },
      { lbl: 'المشتركون بالإشعارات', val: pushSubs, sub: 'مستخدم مشترك', ico: '🔔', bg: 'var(--green-soft)', fg: 'var(--green)', go: 'n' },
      { lbl: 'الأجهزة النشطة للإشعارات', val: pushDevicesCnt, sub: (pushOverview.logs || []).length + ' عملية إرسال', ico: '📱', bg: 'var(--purple-soft)', fg: 'var(--purple)', go: 'n' },
      { lbl: 'طلبات واتساب الجديدة', val: newOrdersCnt, sub: 'من أصل ' + Number(orderCounts.all || ordersData.length) + ' طلب', ico: '🧾', bg: newOrdersCnt > 0 ? 'var(--red-soft)' : 'var(--surface-3)', fg: newOrdersCnt > 0 ? 'var(--red)' : 'var(--mu)', go: 'orders' },
    ];

    // Real Data Charts
    // Chart 1: User growth by day (last 10 active dates or days)
    var userDayMap = {};
    usersData.forEach(function (u) {
      if (!u.createdAt) return;
      var day = String(u.createdAt).slice(0, 10);
      userDayMap[day] = (userDayMap[day] || 0) + 1;
    });
    var userDays = Object.keys(userDayMap).sort().slice(-10);
    var userCum = [];
    var running = 0;
    Object.keys(userDayMap)
      .sort()
      .forEach(function (d) {
        running += userDayMap[d];
        if (userDays.indexOf(d) > -1) userCum.push(running);
      });
    var userLabelsShort = userDays.map(function (d) {
      return d.slice(5);
    });

    // Chart 2: Top categories by product count
    var catBars = D.cats
      .map(function (c) {
        return { label: c, value: cnt(c), suffix: ' صنف', color: 'var(--brand)' };
      })
      .sort(function (a, b) {
        return b.value - a.value;
      })
      .slice(0, 8);

    // Chart 3: Orders & Push timeline by day
    var actDaysMap = {};
    ordersData.forEach(function (o) {
      if (!o.createdAt) return;
      var d = String(o.createdAt).slice(0, 10);
      if (!actDaysMap[d]) actDaysMap[d] = { orders: 0, push: 0 };
      actDaysMap[d].orders += 1;
    });
    (pushOverview.logs || []).forEach(function (l) {
      if (!l.createdAt) return;
      var d = String(l.createdAt).slice(0, 10);
      if (!actDaysMap[d]) actDaysMap[d] = { orders: 0, push: 0 };
      actDaysMap[d].push += 1;
    });
    var actDays = Object.keys(actDaysMap).sort().slice(-10);
    var actOrdersVals = actDays.map(function (d) {
      return actDaysMap[d].orders;
    });
    var actPushVals = actDays.map(function (d) {
      return actDaysMap[d].push;
    });

    // Real Admin Alerts
    var alerts = [];
    if (pendingUsers > 0) {
      alerts.push({
        cls: 'alert-warn',
        msg: '⏳ يوجد ' + pendingUsers + ' حساب تاجر جديد بانتظار موافقة الإدارة.',
        actTab: 'u',
        actLbl: 'مراجعة الحسابات',
      });
    }
    if (dirty) {
      alerts.push({
        cls: 'alert-warn',
        msg: '🚀 لديك تعديلات محلية في المتجر لم يتم نشرها للعملاء بعد.',
        actId: 'dashPubBtn',
        actLbl: 'نشر الآن',
      });
    }
    var lastFailedPush = (pushOverview.logs || []).find(function (l) {
      return l.status === 'failed' || l.status === 'partial';
    });
    if (lastFailedPush) {
      alerts.push({
        cls: 'alert-danger',
        msg: '⚠️ تنبيه إشعارات: آخر إرسال ("' + esc(lastFailedPush.title) + '") سجّل ' + Number(lastFailedPush.failedCount || 0) + ' فشل.',
        actTab: 'n',
        actLbl: 'فحص الإشعارات',
      });
    }
    if (healthData && !healthData.ok) {
      alerts.push({
        cls: 'alert-danger',
        msg: '🔌 يوجد مشكلة في اتصال قاعدة البيانات — راجع فحص النظام فوراً.',
        actTab: 's',
        actLbl: 'فحص النظام',
      });
    }
    if (!pushOverview.configured) {
      alerts.push({
        cls: 'alert-info',
        msg: '🔔 مفاتيح VAPID غير مضبوطة على الخادم، لن يتمكن الإرسال الفوري من العمل.',
        actTab: 'n',
        actLbl: 'مركز الإشعارات',
      });
    }
    var noImgCount = D.p.filter(function (p) {
      return !p[8];
    }).length;
    if (noImgCount > 0) {
      alerts.push({
        cls: 'alert-info',
        msg: '🖼 يوجد ' + noImgCount + ' صنف بدون صورة مرفوعة (يظهر بالإيموجي واللون).',
        actTab: 'p',
        actLbl: 'عرض الأصناف',
      });
    }

    var recentAudits = auditLogs.slice(0, 7);

    return (
      '<div class="kpi-grid">' +
      kpis
        .map(function (k) {
          return (
            '<div class="kpi-card" data-go="' +
            k.go +
            '">' +
            '<div class="kpi-top"><span class="kpi-lbl">' +
            k.lbl +
            '</span><span class="kpi-ico" style="background:' +
            k.bg +
            ';color:' +
            k.fg +
            '">' +
            k.ico +
            '</span></div>' +
            '<div class="kpi-val">' +
            Number(k.val || 0).toLocaleString('en-US') +
            '</div>' +
            '<div class="kpi-sub">' +
            esc(k.sub) +
            '</div></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="charts-grid">' +
      '<section class="card"><div class="card-head"><h3 class="card-title">📈 نمو عدد المستخدمين</h3><span class="count-pill">' +
      totalUsers +
      ' مسجل</span></div>' +
      svgLineChart([{ name: 'إجمالي المستخدمين التراكمي', color: 'var(--blue)', values: userCum }], userLabelsShort) +
      '</section>' +
      '<section class="card"><div class="card-head"><h3 class="card-title">🗂 توزيع الأصناف على الأقسام</h3><span class="count-pill">' +
      totalCats +
      ' قسم</span></div>' +
      svgBarChart(catBars, 'var(--brand)') +
      '</section>' +
      '</div>' +
      '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h3 class="card-title">🧾 نشاط الطلبات والإشعارات</h3><span class="count-pill">آخر الأيام النشطة</span></div>' +
      svgLineChart(
        [
          { name: 'طلبات واتساب', color: 'var(--green)', values: actOrdersVals },
          { name: 'إشعارات مرسلة', color: 'var(--purple)', values: actPushVals },
        ],
        actDays.map(function (d) {
          return d.slice(5);
        })
      ) +
      '</section>' +
      '<section class="card"><div class="card-head"><h3 class="card-title">🚨 تنبيهات الإدارة</h3><button class="btn btn-sm" type="button" id="dashHealthRefresh">فحص الاتصال</button></div>' +
      (alerts.length
        ? alerts
            .map(function (al) {
              return (
                '<div class="alert ' +
                al.cls +
                '"><span>' +
                al.msg +
                '</span>' +
                (al.actTab
                  ? '<button class="btn btn-sm" type="button" data-go="' + al.actTab + '">' + al.actLbl + '</button>'
                  : '<button class="btn btn-primary btn-sm" type="button" id="' + al.actId + '">' + al.actLbl + '</button>') +
                '</div>'
              );
            })
            .join('')
        : '<div class="alert alert-ok"><span>✅ جميع أنظمة المتجر وقواعد البيانات تعمل بصورة سليمة ولا توجد تنبيهات عاجلة.</span></div>') +
      '</section>' +
      '</div>' +
      '<section class="card"><div class="card-head"><h3 class="card-title">📜 آخر النشاطات في لوحة التحكم</h3><button class="btn btn-sm" type="button" data-go="audit">عرض السجل الكامل</button></div>' +
      (auditLoading && !recentAudits.length
        ? renderSkeletonCards(3)
        : !recentAudits.length
        ? '<p class="emp">لا توجد نشاطات مسجلة بعد.</p>'
        : '<div class="table-wrap"><table class="adm-table"><thead><tr><th>العملية</th><th>العنصر</th><th>التفاصيل</th><th>المدير</th><th>الوقت</th></tr></thead><tbody>' +
          recentAudits
            .map(function (lg) {
              return (
                '<tr><td><span class="stpill st-info">' +
                esc(lg.action) +
                '</span></td><td><b>' +
                esc(lg.entityLabel || lg.entityId || '—') +
                '</b></td><td>' +
                esc(lg.details || '—') +
                '</td><td dir="ltr">' +
                esc(lg.actorEmail || '—') +
                '</td><td class="num">' +
                esc(formatDateAr(lg.createdAt)) +
                '</td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>') +
      '</section>'
    );
  }

  // ===== 2. PRODUCTS VIEW (Table + Grid + Bulk + Filters + Sort) =====
  function getFilteredProductIndices() {
    var sq = q.toLowerCase();
    var list = [];
    D.p.forEach(function (p, i) {
      if (prodCatFilter !== 'all' && p[1] !== prodCatFilter) return;
      if (prodStatusFilter === 'active' && p[7]) return;
      if (prodStatusFilter === 'hidden' && !p[7]) return;
      if (prodStatusFilter === 'discount' && !(+p[11] > +p[3])) return;
      if (prodStatusFilter === 'noimg' && p[8]) return;
      if (sq) {
        var flText = (p[9] || [])
          .map(function (f) {
            return f[0] || '';
          })
          .join(' ');
        var hay = [p[0], p[1], p[2], p[10], flText].filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(sq) < 0) return;
      }
      list.push(i);
    });
    if (prodSort === 'price_asc') {
      list.sort(function (a, b) {
        return Number(D.p[a][3] || 0) - Number(D.p[b][3] || 0);
      });
    } else if (prodSort === 'price_desc') {
      list.sort(function (a, b) {
        return Number(D.p[b][3] || 0) - Number(D.p[a][3] || 0);
      });
    } else if (prodSort === 'name') {
      list.sort(function (a, b) {
        return String(D.p[a][0] || '').localeCompare(String(D.p[b][0] || ''), 'ar');
      });
    }
    return list;
  }

  function vp() {
    var indices = getFilteredProductIndices();
    var selectedIndices = Object.keys(prodSelected)
      .filter(function (k) {
        return prodSelected[k] && D.p[+k];
      })
      .map(Number);

    var toolbar =
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>📦 الأصناف</h2><span class="count-pill">' +
      indices.length +
      ' / ' +
      D.p.length +
      ' صنف</span></div>' +
      '<div class="sec-hdr-r">' +
      '<button class="btn' +
      (prodView === 'table' ? ' btn-primary' : '') +
      '" type="button" data-pview="table">📋 جدول</button>' +
      '<button class="btn' +
      (prodView === 'grid' ? ' btn-primary' : '') +
      '" type="button" data-pview="grid">🟦 شبكة</button>' +
      '<button class="btn btn-success" type="button" data-add="' +
      esc(prodCatFilter !== 'all' ? prodCatFilter : D.cats[0] || '') +
      '">+ صنف جديد</button>' +
      '</div></div>' +
      '<div class="toolbar">' +
      '<div class="toolbar-search"><input id="prodSearch" type="search" placeholder="ابحث باسم الصنف، العبوة، الحجم أو النكهة..." value="' +
      esc(q) +
      '"></div>' +
      '<div class="toolbar-ctrl"><select id="prodCatSel"><option value="all">كل الأقسام (' +
      D.cats.length +
      ')</option>' +
      D.cats
        .map(function (c) {
          return '<option value="' + esc(c) + '"' + (prodCatFilter === c ? ' selected' : '') + '>' + esc(c) + ' (' + cnt(c) + ')</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="toolbar-ctrl"><select id="prodStatusSel">' +
      '<option value="all"' + (prodStatusFilter === 'all' ? ' selected' : '') + '>كل الحالات</option>' +
      '<option value="active"' + (prodStatusFilter === 'active' ? ' selected' : '') + '>المتوفرة فقط</option>' +
      '<option value="hidden"' + (prodStatusFilter === 'hidden' ? ' selected' : '') + '>المخفية فقط</option>' +
      '<option value="discount"' + (prodStatusFilter === 'discount' ? ' selected' : '') + '>بها خصم</option>' +
      '<option value="noimg"' + (prodStatusFilter === 'noimg' ? ' selected' : '') + '>بدون صورة</option>' +
      '</select></div>' +
      '<div class="toolbar-ctrl"><select id="prodSortSel">' +
      '<option value="order"' + (prodSort === 'order' ? ' selected' : '') + '>الترتيب الافتراضي</option>' +
      '<option value="price_asc"' + (prodSort === 'price_asc' ? ' selected' : '') + '>السعر: الأقل للأعلى</option>' +
      '<option value="price_desc"' + (prodSort === 'price_desc' ? ' selected' : '') + '>السعر: الأعلى للأقل</option>' +
      '<option value="name"' + (prodSort === 'name' ? ' selected' : '') + '>الاسم (أ - ي)</option>' +
      '</select></div>' +
      '</div>';

    if (!D.cats.length) {
      return toolbar + '<div class="emp">أضف قسماً أولاً من صفحة الأقسام لبدء إضافة الأصناف.</div>';
    }
    if (!indices.length) {
      return toolbar + '<div class="emp">لا توجد أصناف مطابقة للبحث أو الفلتر الحالي.</div>';
    }

    var canReorder = !q && prodStatusFilter === 'all' && prodSort === 'order';
    var body = '';
    if (prodView === 'table') {
      var allChecked =
        indices.length > 0 &&
        indices.every(function (idx) {
          return !!prodSelected[idx];
        });
      body =
        '<div class="table-wrap"><table class="adm-table"><thead><tr>' +
        '<th style="width:38px"><input type="checkbox" id="prodSelAll"' +
        (allChecked ? ' checked' : '') +
        '></th>' +
        (canReorder ? '<th style="width:52px">ترتيب</th>' : '') +
        '<th>الصنف</th><th>القسم</th><th>السعر</th><th>النكهات</th><th>الحالة</th><th>إجراءات</th>' +
        '</tr></thead><tbody>' +
        indices
          .map(function (i) {
            var p = D.p[i];
            var isSel = !!prodSelected[i];
            var flCnt = (p[9] || []).length;
            var hasDisc = +p[11] > +p[3];
            return (
              '<tr class="' +
              (p[7] ? 'is-off ' : '') +
              (isSel ? 'is-selected' : '') +
              '">' +
              '<td><input type="checkbox" data-psel="' +
              i +
              '"' +
              (isSel ? ' checked' : '') +
              '></td>' +
              (canReorder
                ? '<td><div class="ar"><button type="button" data-pu="' +
                  i +
                  '" title="أعلى">▲</button><button type="button" data-pd="' +
                  i +
                  '" title="أسفل">▼</button></div></td>'
                : '') +
              '<td><div class="prod-cell" data-e="' +
              i +
              '" style="cursor:pointer"><div class="row-thumb" style="background:' +
              esc(p[4] || '#ffd23f') +
              '">' +
              (p[8] && IMG[p[8]] ? '<img src="' + IMG[p[8]] + '" alt="">' : esc(p[6] || '📦')) +
              '</div><div class="prod-cell-txt"><b>' +
              esc(p[0]) +
              (p[10] ? ' · <span style="color:var(--blue)">' + esc(p[10]) + '</span>' : '') +
              '</b><small>' +
              esc(p[2] || '—') +
              '</small></div></div></td>' +
              '<td><span class="stpill st-muted">' +
              esc(p[1]) +
              '</span></td>' +
              '<td class="num"><b>' +
              Number(p[3] || 0) +
              ' ج</b>' +
              (hasDisc ? ' <small style="text-decoration:line-through;color:var(--mu)">' + p[11] + '</small>' : '') +
              '</td>' +
              '<td>' +
              (flCnt ? '<span class="stpill st-info">' + flCnt + ' نكهة</span>' : '<span style="color:var(--mu);font-size:12px">بدون</span>') +
              '</td>' +
              '<td><label class="sw"><input type="checkbox" data-av="' +
              i +
              '"' +
              (p[7] ? '' : ' checked') +
              '><i></i></label></td>' +
              '<td><div class="row-actions">' +
              '<button class="btn btn-sm" type="button" data-e="' +
              i +
              '">تعديل</button>' +
              '<button class="btn btn-sm" type="button" data-dup="' +
              i +
              '" title="تكرار">📋</button>' +
              '</div></td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>';
    } else {
      body =
        '<div class="prod-grid">' +
        indices
          .map(function (i) {
            var p = D.p[i];
            var isSel = !!prodSelected[i];
            var hasDisc = +p[11] > +p[3];
            return (
              '<article class="pgrid-card' +
              (p[7] ? ' is-off' : '') +
              (isSel ? ' is-selected' : '') +
              '">' +
              '<div class="pgrid-top">' +
              '<div style="display:flex;gap:10px;align-items:center;min-width:0;cursor:pointer" data-e="' +
              i +
              '">' +
              '<div class="pgrid-img" style="background:' +
              esc(p[4] || '#ffd23f') +
              '">' +
              (p[8] && IMG[p[8]] ? '<img src="' + IMG[p[8]] + '" alt="">' : esc(p[6] || '📦')) +
              '</div>' +
              '<div style="min-width:0"><b style="display:block;font-size:14px">' +
              esc(p[0]) +
              (p[10] ? ' · ' + esc(p[10]) : '') +
              '</b><small style="color:var(--mu);font-size:12px">' +
              esc(p[1]) +
              (p[2] ? ' · ' + esc(p[2]) : '') +
              '</small></div></div>' +
              '<input type="checkbox" data-psel="' +
              i +
              '"' +
              (isSel ? ' checked' : '') +
              '></div>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid var(--border)">' +
              '<div class="num"><b style="font-size:17px;color:var(--red)">' +
              Number(p[3] || 0) +
              ' ج</b>' +
              (hasDisc ? ' <small style="text-decoration:line-through;color:var(--mu)">' + p[11] + '</small>' : '') +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:6px">' +
              '<button class="btn btn-sm" type="button" data-e="' +
              i +
              '">تعديل</button>' +
              '<button class="btn btn-sm" type="button" data-dup="' +
              i +
              '">📋</button>' +
              '<label class="sw"><input type="checkbox" data-av="' +
              i +
              '"' +
              (p[7] ? '' : ' checked') +
              '><i></i></label></div></div></article>'
            );
          })
          .join('') +
        '</div>';
    }

    var bulkHtml = '';
    if (selectedIndices.length > 0) {
      bulkHtml =
        '<div class="bulk-bar">' +
        '<b>تم تحديد ' +
        selectedIndices.length +
        ' صنف</b>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn btn-sm" type="button" data-bulk="show">✅ إظهار المحدد</button>' +
        '<button class="btn btn-sm" type="button" data-bulk="hide">🙈 إخفاء المحدد</button>' +
        '<select id="bulkMoveCat" style="width:auto;min-height:32px;padding:3px 10px;background:var(--surface);color:var(--ink)"><option value="">نقل لقسم...</option>' +
        D.cats
          .map(function (c) {
            return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
          })
          .join('') +
        '</select>' +
        '<button class="btn btn-danger-solid btn-sm" type="button" data-bulk="delete">🗑 حذف المحدد</button>' +
        '<button class="btn btn-sm" type="button" data-bulk="clear">إلغاء التحديد</button>' +
        '</div></div>';
    }

    return toolbar + body + bulkHtml;
  }

  // ===== 3. CATEGORIES VIEW (Drag & Drop + Meta + Thumbnail + Safe Delete) =====
  function vc() {
    var meta = ensureCatMeta();
    var h =
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>🗂 إدارة الأقسام</h2><span class="count-pill">' +
      D.cats.length +
      ' قسم</span></div>' +
      '</div>' +
      '<p class="hint" style="margin-bottom:14px">اسحب الأقسام لتغيير ترتيبها أو استخدم الأسهم، ويمكنك إضافة صورة مصغرة للقسم أو إيقافه مؤقتاً دون حذفه.</p>';

    if (!D.cats.length) {
      h += '<div class="emp">لا توجد أقسام بعد، أضف أول قسم بالأسفل.</div>';
    } else {
      h += '<div id="catsList">';
      D.cats.forEach(function (c, i) {
        var cm = meta[c] || {};
        var isOff = !!cm.disabled;
        var imgUrl = cm.imageId && IMG[cm.imageId] ? IMG[cm.imageId] : '';
        h +=
          '<div class="cat-row" draggable="true" data-cat-idx="' +
          i +
          '">' +
          '<span class="drag-handle" title="اسحب للترتيب">⠿</span>' +
          '<div class="ar"><button type="button" data-up="' +
          i +
          '">▲</button><button type="button" data-dn="' +
          i +
          '">▼</button></div>' +
          '<div class="row-thumb">' +
          (imgUrl ? '<img src="' + imgUrl + '" alt="">' : '🗂') +
          '</div>' +
          '<div class="cat-name-wrap"><input data-rn="' +
          i +
          '" value="' +
          esc(c) +
          '"></div>' +
          '<span class="count-pill">' +
          cnt(c) +
          ' صنف</span>' +
          '<label class="btn btn-sm" style="margin:0;cursor:pointer">📷 صورة<input type="file" accept="image/*" hidden data-cat-img="' +
          i +
          '"></label>' +
          (cm.imageId
            ? '<button class="btn btn-sm" type="button" data-cat-img-rm="' + i + '" title="إزالة صورة القسم">✕ صورة</button>'
            : '') +
          '<label class="sw" title="تفعيل أو تعطيل القسم بالمتجر"><input type="checkbox" data-cat-en="' +
          i +
          '"' +
          (isOff ? '' : ' checked') +
          '><i></i></label>' +
          '<button class="btn btn-danger btn-sm" type="button" data-dc="' +
          i +
          '">🗑 حذف</button>' +
          '</div>';
      });
      h += '</div>';
    }

    h +=
      '<div class="card" style="margin-top:14px">' +
      '<h3 class="card-title" style="margin-bottom:10px">➕ إضافة قسم جديد</h3>' +
      '<div class="r2"><div style="flex:3"><input id="nc" placeholder="اكتب اسم القسم الجديد (مثال: عصائر ومشروبات)"></div>' +
      '<button class="btn btn-success" id="addc" type="button">+ إضافة القسم</button></div></div>';
    return h;
  }

  // ===== 4. OFFERS VIEW (Sub-tabs + Schedule + Linked Product + Live Preview) =====
  function vo() {
    var L = OFS();
    var counts = { all: L.length, active: 0, scheduled: 0, expired: 0, hidden: 0 };
    L.forEach(function (o) {
      counts[getOfferStatus(o)] += 1;
    });
    var filtered = [];
    L.forEach(function (o, i) {
      var st = getOfferStatus(o);
      if (offerSubTab === 'all' || offerSubTab === st) filtered.push({ o: o, i: i, st: st });
    });

    var tabs = [
      ['all', 'الكل', counts.all],
      ['active', 'نشط الآن', counts.active],
      ['scheduled', 'مجدول', counts.scheduled],
      ['expired', 'منتهي', counts.expired],
      ['hidden', 'مخفي', counts.hidden],
    ];

    var stBadgeMap = {
      active: ['نشط الآن', 'st-ok'],
      scheduled: ['مجدول', 'st-info'],
      expired: ['منتهي الصلاحية', 'st-warn'],
      hidden: ['مخفي', 'st-muted'],
    };

    var h =
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>🎁 العروض الخاصة</h2><span class="count-pill">' +
      L.length +
      ' عرض</span></div>' +
      '<div class="sec-hdr-r"><button class="btn btn-success" type="button" data-oadd="1">+ عرض جديد</button></div>' +
      '</div>' +
      '<div class="tabs-row">' +
      tabs
        .map(function (t) {
          return (
            '<button type="button" class="tab-pill' +
            (offerSubTab === t[0] ? ' on' : '') +
            '" data-off-tab="' +
            t[0] +
            '">' +
            t[1] +
            ' (' +
            t[2] +
            ')</button>'
          );
        })
        .join('') +
      '</div>';

    if (!filtered.length) {
      return h + '<div class="emp">لا توجد عروض في هذا التصنيف حالياً.</div>';
    }

    h +=
      '<div class="table-wrap"><table class="adm-table"><thead><tr>' +
      '<th style="width:52px">ترتيب</th><th>العرض</th><th>السعر والخصم</th><th>الفترة</th><th>الحالة</th><th>إظهار</th><th>إجراءات</th>' +
      '</tr></thead><tbody>';

    filtered.forEach(function (entry) {
      var o = entry.o;
      var i = entry.i;
      var bm = stBadgeMap[entry.st];
      var sched =
        o.startDate || o.endDate
          ? (o.startDate || '…') + ' → ' + (o.endDate || '…')
          : 'مفتوح بدون تاريخ انتهاء';
      h +=
        '<tr class="' +
        (o.x ? 'is-off' : '') +
        '">' +
        '<td><div class="ar"><button type="button" data-oup="' +
        i +
        '">▲</button><button type="button" data-odn="' +
        i +
        '">▼</button></div></td>' +
        '<td><div class="prod-cell" data-o="' +
        i +
        '" style="cursor:pointer"><div class="row-thumb" style="background:' +
        esc(o.c || '#ffd23f') +
        '">' +
        (o.i && IMG[o.i] ? '<img src="' + IMG[o.i] + '" alt="">' : '🎁') +
        '</div><div class="prod-cell-txt"><b>' +
        esc(o.t) +
        (o.g ? ' <span class="stpill st-info">' + esc(o.g) + '</span>' : '') +
        '</b><small>' +
        esc(o.d || o.productName || '—') +
        '</small></div></div></td>' +
        '<td class="num"><b>' +
        esc(o.pr || (o.priceAfter ? o.priceAfter + ' ج' : '—')) +
        '</b>' +
        (o.discountPct ? ' <span class="stpill st-ok">-' + o.discountPct + '%</span>' : '') +
        '</td>' +
        '<td class="num" style="font-size:12px;color:var(--mu)">' +
        esc(sched) +
        '</td>' +
        '<td><span class="stpill ' +
        bm[1] +
        '">' +
        bm[0] +
        '</span></td>' +
        '<td><label class="sw"><input type="checkbox" data-ov="' +
        i +
        '"' +
        (o.x ? '' : ' checked') +
        '><i></i></label></td>' +
        '<td><button class="btn btn-sm" type="button" data-o="' +
        i +
        '">تعديل</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  // ===== 5. STOREFRONT CONTENT VIEW + LIVE HERO PREVIEW =====
  function vContent() {
    var c = D.cfg;
    var brandName = c.brandName == null ? 'أبو سعيد' : c.brandName;
    var brandSub = c.brandSub == null ? 'جملة الشيبسي والسناكس' : c.brandSub;
    var b1 = c.heroBadge == null ? '🔥 جملة الجملة' : c.heroBadge;
    var b2 = c.heroBadge2 == null ? 'توصيل سريع للمحلات' : c.heroBadge2;
    var hTitle = c.heroTitle == null ? 'اطلب بضاعتك من أبو سعيد في دقايق' : c.heroTitle;
    var hDesc =
      c.heroDesc == null
        ? 'شيبسي، سناكس، حلويات ومشروبات بأسعار الجملة الحقيقية. اختار الكراتين والنكهات اللي تناسب محلك وابعت طلبك مباشرة على واتساب.'
        : c.heroDesc;

    return (
      '<div class="sec-hdr"><div class="sec-hdr-l"><h2>📝 محتوى الواجهة والهوية</h2></div></div>' +
      '<div class="grid-2">' +
      '<div class="card">' +
      '<h3 class="card-title">🏠 نصوص الواجهة الرئيسية والهيدر</h3>' +
      '<label>اسم المتجر في الهيدر</label><input data-s="brandName" value="' +
      esc(brandName) +
      '">' +
      '<label>الوصف أسفل الاسم</label><input data-s="brandSub" value="' +
      esc(brandSub) +
      '">' +
      '<div class="r2"><div><label>الشارة الأولى</label><input data-s="heroBadge" value="' +
      esc(b1) +
      '"></div><div><label>الشارة الثانية</label><input data-s="heroBadge2" value="' +
      esc(b2) +
      '"></div></div>' +
      '<label>العنوان الترحيبي الرئيسي</label><input data-s="heroTitle" value="' +
      esc(hTitle) +
      '">' +
      '<label>الوصف التسويقي للمتجر</label><textarea rows="3" data-s="heroDesc">' +
      esc(hDesc) +
      '</textarea>' +
      '<label>بداية رسالة الطلب على واتساب</label><input data-s="waHeader" value="' +
      esc(c.waHeader == null ? 'طلب جديد من الموقع 📦' : c.waHeader) +
      '">' +
      '</div>' +
      '<div>' +
      '<div class="card"><h3 class="card-title">👁 معاينة حية لبطاقة الهيرو</h3>' +
      '<div class="hero-prev" style="margin-top:10px">' +
      '<div class="hero-prev-badges">' +
      (b1 ? '<span>' + esc(b1) + '</span>' : '') +
      (b2 ? '<span>' + esc(b2) + '</span>' : '') +
      '</div>' +
      '<h3 style="margin:4px 0 6px;font-size:20px;font-weight:800">' +
      esc(hTitle) +
      '</h3>' +
      '<p style="margin:0;font-size:13px;color:var(--ink-2)">' +
      esc(hDesc) +
      '</p></div></div>' +
      '<div class="card"><h3 class="card-title">🎁 قسم العروض وإظهار البلوكات</h3>' +
      '<div class="cr" style="margin-top:10px"><b style="flex:1">إظهار عنوان العروض للعملاء</b><label class="sw"><input type="checkbox" data-s="oh"' +
      (c.oh ? '' : ' checked') +
      '><i></i></label></div>' +
      '<label>نص عنوان قسم العروض</label><input data-s="ot" value="' +
      esc(c.ot == null ? '🎁 العروض' : c.ot) +
      '">' +
      rg('os', 'حجم عنوان العروض', 60, 200, 5, 100, '%') +
      '<div class="cr" style="margin-top:10px"><b style="flex:1">إظهار بانر وشعار الموقع فوق</b><label class="sw"><input type="checkbox" data-s="hideBanner"' +
      (c.hideBanner ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="cr"><b style="flex:1">إظهار بطاقة أصناف سريعة الطلب</b><label class="sw"><input type="checkbox" data-s="hideSpotlight"' +
      (c.hideSpotlight ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="cr" style="margin-bottom:0"><b style="flex:1">إظهار شبكة الأقسام الرئيسية</b><label class="sw"><input type="checkbox" data-s="hideCatsBox"' +
      (c.hideCatsBox ? '' : ' checked') +
      '><i></i></label></div>' +
      '</div></div></div>'
    );
  }

  // ===== 6. SETTINGS, APPEARANCE, SECURITY & HEALTH =====
  function rg(k, l, min, max, st, def, u) {
    var v = D.cfg[k] != null && D.cfg[k] !== '' ? +D.cfg[k] : def;
    return (
      '<label>' +
      l +
      ': <b id="nv_' +
      k +
      '">' +
      v +
      u +
      '</b></label><input type="range" data-n="' +
      k +
      '" data-u="' +
      u +
      '" min="' +
      min +
      '" max="' +
      max +
      '" step="' +
      st +
      '" value="' +
      v +
      '">'
    );
  }

  function fontPreviewStyle(id) {
    var im = id && IMG[id];
    if (!im) return '';
    return (
      '<style>@font-face{font-family:"prev_' +
      esc(id) +
      '";src:url("' +
      im +
      '");font-display:swap}</style><div style="font-family:\'prev_' +
      esc(id) +
      '\',Cairo,sans-serif;font-size:15px;padding:10px 12px;background:var(--surface-2);color:var(--ink);border:1px solid var(--border);border-radius:10px;margin-top:8px">معاينة الفونت: <b>أبو سعيد – اطلب بضاعتك ١٩٠ جنيه</b></div>'
    );
  }

  function designCard() {
    var c = D.cfg;
    var im = c.logo && IMG[c.logo];
    var fonts = [
      '',
      'Tajawal',
      'Almarai',
      'Alexandria',
      'Readex Pro',
      'Changa',
      'Rubik',
      'IBM Plex Sans Arabic',
      'Noto Kufi Arabic',
    ];
    return (
      '<div class="grid-2">' +
      '<div class="card"><h3 class="card-title">🔤 الخطوط وأحجام النصوص</h3>' +
      '<label>اختيار خط عربي جاهز للمتجر</label><select data-s="fontPreset">' +
      fonts
        .map(function (f) {
          return (
            '<option value="' +
            esc(f) +
            '"' +
            ((c.fontPreset || '') == f ? ' selected' : '') +
            '>' +
            (f ? esc(f) : 'الافتراضي (Cairo + Lalezar)') +
            '</option>'
          );
        })
        .join('') +
      '</select>' +
      '<div class="cr" style="margin-top:10px"><b style="flex:1">تطبيق الخط الأساسي على كل الموقع</b><label class="sw"><input type="checkbox" data-s="fontUnified"' +
      (c.fontUnified ? ' checked' : '') +
      '><i></i></label></div>' +
      '<label>رفع خط مخصص للنصوص (TTF / OTF / WOFF / WOFF2)</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer">📁 ارفع ملف خط<input type="file" id="fntBody" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label>' +
      (c.fontBodyId
        ? '<span style="font-size:12px;font-weight:700">' +
          esc(c.fontBodyName || 'خط مخصص') +
          '</span><button class="btn btn-danger btn-sm" type="button" id="fntBodyRm">حذف الخط</button>'
        : '<span class="hint" style="margin:0">لا يوجد ملف خط مرفوع</span>') +
      '</div>' +
      (c.fontBodyId ? fontPreviewStyle(c.fontBodyId) : '') +
      '<label>رفع خط مخصص للعناوين والأسعار (اختياري)</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="btn btn-sm" style="margin:0;cursor:pointer">📁 ارفع خط عناوين<input type="file" id="fntHead" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label>' +
      (c.fontHeadId
        ? '<span style="font-size:12px;font-weight:700">' +
          esc(c.fontHeadName || 'خط عناوين') +
          '</span><button class="btn btn-danger btn-sm" type="button" id="fntHeadRm">حذف</button>'
        : '<span class="hint" style="margin:0">يستخدم الخط الأساسي</span>') +
      '</div>' +
      (c.fontHeadId ? fontPreviewStyle(c.fontHeadId) : '') +
      rg('fsBase', 'حجم الخط العام', 12, 20, 1, 15, ' px') +
      rg('fsTitle', 'حجم اسم الصنف', 13, 22, 1, 16, ' px') +
      rg('fsPrice', 'حجم سعر الصنف', 18, 32, 1, 22, ' px') +
      rg('fsHero', 'حجم العنوان الرئيسي (الهيرو)', 24, 54, 1, 38, ' px') +
      '</div>' +
      '<div class="card"><h3 class="card-title">🎨 مظهر المتجر واللوحة</h3>' +
      '<label>مظهر لوحة الإدارة الحالي</label>' +
      '<div style="display:flex;gap:8px;margin-top:4px">' +
      '<button type="button" class="btn" id="admSetLight">☀️ وضع فاتح</button>' +
      '<button type="button" class="btn" id="admSetDark">🌙 وضع داكن</button>' +
      '</div>' +
      '<label>مظهر المتجر الافتراضي للعملاء</label><select data-s="themeMode"><option value="auto"' +
      ((c.themeMode || 'auto') == 'auto' ? ' selected' : '') +
      '>تلقائي حسب جهاز العميل</option><option value="light"' +
      (c.themeMode == 'light' ? ' selected' : '') +
      '>نهاري (أصفر أبو سعيد)</option><option value="dark"' +
      (c.themeMode == 'dark' ? ' selected' : '') +
      '>ليلي داكن</option></select>' +
      '<div class="cr" style="margin-top:10px"><b style="flex:1">إظهار زر تبديل الوضع للعميل</b><label class="sw"><input type="checkbox" data-s="hideThemeBtn"' +
      (c.hideThemeBtn ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="r2" style="margin-top:8px"><div><label>لون الخلفية الأساسي</label><input type="color" data-s="cBg" value="' +
      esc(c.cBg || '#ffd93d') +
      '"></div><div><label>لون العناوين والخصم</label><input type="color" data-s="cRed" value="' +
      esc(c.cRed || '#ff4b3e') +
      '"></div></div>' +
      '<div class="r2"><div><label>لون أزرار الإضافة</label><input type="color" data-s="cBlue" value="' +
      esc(c.cBlue || '#2b6cff') +
      '"></div><div><label>لون السلة وواتساب</label><input type="color" data-s="cGreen" value="' +
      esc(c.cGreen || '#17b26a') +
      '"></div></div>' +
      '<button class="btn btn-sm" type="button" id="resetColors" style="margin-top:10px">↩️ استعادة الألوان الأصلية</button>' +
      rg('cols', 'عدد الأصناف في الصف (كمبيوتر)', 2, 5, 1, 4, '') +
      '<label>لوجو وبانر الصفحة</label><div class="ip"><div class="ipv" style="width:96px;background:#19160f">' +
      (im ? '<img src="' + im + '" alt="">' : '<span style="font-size:12px;color:#fff3cf">الأصلي</span>') +
      '</div><div class="btns"><label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer">📷 اختيار صورة<input type="file" id="lgf" accept="image/*" hidden></label>' +
      (c.logo ? '<button class="btn btn-danger btn-sm" type="button" id="lgrm">رجوع للأصلي</button>' : '') +
      '</div></div>' +
      rg('bh', 'ارتفاع البانر', 100, 320, 10, 160, ' px') +
      rg('ls', 'حجم اللوجو جوه البانر', 40, 120, 5, 100, '%') +
      rg('cs', 'حجم أزرار الأقسام', 80, 130, 5, 100, '%') +
      '</div></div>'
    );
  }

  function vs() {
    var c = D.cfg;
    var subTabs = [
      ['general', '⚙️ الإعدادات العامة'],
      ['appearance', '🎨 المظهر والخطوط'],
      ['security', '🛡 الأمان والجلسة'],
      ['health', '🩺 حالة النظام'],
    ];

    var hdr =
      '<div class="sec-hdr"><div class="sec-hdr-l"><h2>⚙️ إعدادات النظام</h2></div></div>' +
      '<div class="tabs-row">' +
      subTabs
        .map(function (st) {
          return (
            '<button type="button" class="tab-pill' +
            (settingsSubTab === st[0] ? ' on' : '') +
            '" data-stab="' +
            st[0] +
            '">' +
            st[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>';

    if (settingsSubTab === 'appearance') {
      return hdr + designCard();
    }

    if (settingsSubTab === 'security') {
      return (
        hdr +
        '<div class="grid-2">' +
        '<div class="card">' +
        '<h3 class="card-title">👤 جلسة المدير الحالية</h3>' +
        '<div class="umeta" style="margin-top:10px;gap:8px">' +
        '<span>البريد الإلكتروني: <b dir="ltr" style="color:var(--ink)">' +
        esc(adminMe.email || '—') +
        '</b></span>' +
        '<span>معرف الحساب (UID): <b class="mono" style="color:var(--ink)">' +
        esc(adminMe.uid || '—') +
        '</b></span>' +
        '<span>تاريخ بدء الجلسة: <b class="num" style="color:var(--ink)">' +
        esc(formatDateAr(adminMe.sessionCreatedAt)) +
        '</b></span>' +
        '<span>صلاحية الجلسة حتى: <b class="num" style="color:var(--ink)">' +
        esc(formatDateAr(adminMe.sessionExpiresAt)) +
        '</b></span>' +
        '</div>' +
        '<div style="margin-top:16px"><button class="btn btn-danger" type="button" id="secLogoutBtn">🚪 تسجيل الخروج من الجلسة</button></div>' +
        '</div>' +
        '<div class="card">' +
        '<h3 class="card-title">🔐 سياسة الأمان والأسرار</h3>' +
        '<div class="alert alert-ok" style="margin-top:10px"><span>✅ جميع مفاتيح Firebase وVAPID وGemini محمية بالكامل على الخادم ولا يتم إرسالها أبداً إلى واجهة المتصفح.</span></div>' +
        '<ul style="margin:10px 0 0;padding-inline-start:20px;font-size:13px;color:var(--ink-2);line-height:1.8">' +
        '<li>ملفات لوحة الإدارة محمية بجلسة HttpOnly + SameSite.</li>' +
        '<li>طلبات التعديل محمية بفحص Same-Origin ضد هجمات CSRF.</li>' +
        '<li>كل عملية إدارية حساسة يتم تسجيلها تلقائياً في سجل النشاطات.</li>' +
        '</ul></div></div>'
      );
    }

    if (settingsSubTab === 'health') {
      var hd = healthData;
      return (
        hdr +
        '<div class="card">' +
        '<div class="card-head"><h3 class="card-title">🩺 فحص صحة الاتصالات والخدمات</h3>' +
        '<button class="btn btn-primary btn-sm" type="button" id="healthRefreshBtn">' +
        (healthLoading ? '⏳ جاري الفحص...' : '🔄 إعادة الفحص الآن') +
        '</button></div>' +
        (healthLoading && !hd
          ? renderSkeletonCards(3)
          : !hd
          ? '<p class="emp">اضغط «إعادة الفحص الآن» لجلب حالة النظام المباشرة.</p>'
          : '<div class="kpi-grid">' +
            '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">قاعدة الكتالوج (RTDB)</span><span class="stpill ' +
            (hd.catalogRtdb && hd.catalogRtdb.ok ? 'st-ok' : 'st-bad') +
            '">' +
            (hd.catalogRtdb && hd.catalogRtdb.ok ? 'متصل' : 'خطأ') +
            '</span></div><div class="kpi-val">' +
            (hd.catalogRtdb && hd.catalogRtdb.latencyMs != null ? hd.catalogRtdb.latencyMs + ' ms' : '—') +
            '</div><div class="kpi-sub">' +
            esc((hd.catalogRtdb && hd.catalogRtdb.error) || 'استجابة قراءة Firebase Catalog') +
            '</div></div>' +
            '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">قاعدة المستخدمين والطلبات</span><span class="stpill ' +
            (hd.authDatabase && hd.authDatabase.ok ? 'st-ok' : 'st-bad') +
            '">' +
            (hd.authDatabase && hd.authDatabase.ok ? 'متصل' : 'خطأ') +
            '</span></div><div class="kpi-val">' +
            (hd.authDatabase && hd.authDatabase.latencyMs != null ? hd.authDatabase.latencyMs + ' ms' : '—') +
            '</div><div class="kpi-sub">الوضع: ' +
            esc((hd.authDatabase && hd.authDatabase.mode) || '—') +
            '</div></div>' +
            '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">خدمة الإشعارات (VAPID)</span><span class="stpill ' +
            (hd.vapid && hd.vapid.configured ? 'st-ok' : 'st-warn') +
            '">' +
            (hd.vapid && hd.vapid.configured ? 'جاهزة' : 'غير مكتملة') +
            '</span></div><div class="kpi-val">' +
            (hd.vapid && hd.vapid.configured ? 'Active' : 'Missing') +
            '</div><div class="kpi-sub">' +
            esc((hd.vapid && hd.vapid.reason) || 'مفاتيح التوقيع متوفرة على الخادم') +
            '</div></div>' +
            '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">محرك الذكاء الاصطناعي</span><span class="stpill ' +
            (hd.ai && hd.ai.configured ? 'st-ok' : 'st-warn') +
            '">' +
            (hd.ai && hd.ai.configured ? 'جاهز' : 'غير مضبوط') +
            '</span></div><div class="kpi-val">' +
            esc((hd.ai && hd.ai.source) || '—') +
            '</div><div class="kpi-sub">آخر فحص: ' +
            esc(formatDateAr(hd.checkedAt)) +
            '</div></div></div>') +
        '</div>'
      );
    }

    // General Tab
    var keyStateText = c.gkFromEnv
      ? 'مفعّل من متغيرات البيئة على الخادم (GEMINI_API_KEY)'
      : c.hasGk
      ? 'محفوظ بأمان على الخادم (ينتهي بـ ****' + esc(c.gkLast4 || '') + ')'
      : 'غير مضاف بعد';

    return (
      hdr +
      '<div class="grid-2">' +
      '<div class="card">' +
      '<h3 class="card-title">📱 إعدادات الطلبات والواتساب</h3>' +
      '<label>رقم واتساب الطلبات</label><input dir="ltr" inputmode="tel" data-s="phone" value="' +
      esc(c.phone) +
      '" placeholder="مثال: 01012345678">' +
      '<p class="hint">يُضبط تلقائياً للصيغة الدولية. <a href="https://wa.me/' +
      esc(c.phone) +
      '" target="_blank" rel="noopener">اختبار الرقم 📲</a></p>' +
      '<label>أقل قيمة للطلب (جنيه)</label><input type="number" inputmode="numeric" data-s="min" value="' +
      Number(c.min || 0) +
      '">' +
      '<p class="hint">اكتب 0 لإلغاء الحد الأدنى للطلب.</p>' +
      '<label>اسم وحدة البيع الافتراضية</label><input data-s="unit" value="' +
      esc(c.unit) +
      '" placeholder="كرتونة / دستة / شوال">' +
      '</div>' +
      '<div class="card">' +
      '<h3 class="card-title">🤖 إعدادات ' +
      esc(AN()) +
      ' ومفتاح Gemini</h3>' +
      '<label>نظام تشغيل المساعد الذكي للعملاء</label><select data-s="aiMode"><option value="auto"' +
      ((c.aiMode || 'auto') == 'auto' ? ' selected' : '') +
      '>تلقائي (Gemini القوي + الموديل المحلي الذكي)</option><option value="local"' +
      (c.aiMode == 'local' ? ' selected' : '') +
      '>الموديل المحلي الذكي فقط (بدون API)</option></select>' +
      '<label>نوع واجهة المساعد الذكي للعملاء</label><select data-s="aiUi"><option value="chat"' +
      ((c.aiUi || 'chat') == 'chat' ? ' selected' : '') +
      '>💬 المحادثة التفاعلية (مع زر للتبديل لكتابة مرة واحدة)</option><option value="old"' +
      (c.aiUi == 'old' ? ' selected' : '') +
      '>✍️ الكتابة مرة واحدة (مع زر للتبديل للمحادثة التفاعلية)</option><option value="chat_only"' +
      (c.aiUi == 'chat_only' ? ' selected' : '') +
      '>💬 المحادثة التفاعلية فقط (بدون تبديل)</option><option value="old_only"' +
      (c.aiUi == 'old_only' ? ' selected' : '') +
      '>✍️ الكتابة مرة واحدة فقط (بدون تبديل)</option></select>' +
      '<label>نوع واجهة المساعد الذكي للإدارة</label><select data-s="adminAiUi"><option value="chat"' +
      ((c.adminAiUi || 'chat') == 'chat' ? ' selected' : '') +
      '>💬 المحادثة التفاعلية (مع زر للتبديل لكتابة مرة واحدة)</option><option value="batch"' +
      (c.adminAiUi == 'batch' ? ' selected' : '') +
      '>✍️ الكتابة مرة واحدة (إضافة من نص/صوت دفعة واحدة)</option><option value="chat_only"' +
      (c.adminAiUi == 'chat_only' ? ' selected' : '') +
      '>💬 المحادثة التفاعلية فقط (بدون تبديل)</option><option value="batch_only"' +
      (c.adminAiUi == 'batch_only' ? ' selected' : '') +
      '>✍️ الكتابة مرة واحدة فقط (بدون تبديل)</option></select>' +
      '<label>اسم زر المساعد الذكي</label><input data-s="rn" value="' +
      esc(c.rn == null ? 'Rahal Ai' : c.rn) +
      '">' +
      '<label>الجملة التوجيهية بجانب ' +
      esc(AN()) +
      '</label><input data-s="rt" value="' +
      esc(c.rt == null ? 'اطلب بالكتابة أو الصوت' : c.rt) +
      '">' +
      '<div class="cr" style="margin-top:10px"><b style="flex:1">إظهار ' +
      esc(AN()) +
      ' للعملاء</b><label class="sw"><input type="checkbox" data-s="ro"' +
      (c.ro ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="cr"><b style="flex:1">تفعيل الإملاء الصوتي 🎤</b><label class="sw"><input type="checkbox" data-s="rm"' +
      (c.rm ? '' : ' checked') +
      '><i></i></label></div>' +
      '<label>حالة مفتاح Gemini API على الخادم</label>' +
      '<div class="alert alert-info" style="margin-top:6px"><span>🔑 ' +
      keyStateText +
      (c.clearGk ? ' · <b>سيتم المسح عند النشر</b>' : c.newGk ? ' · <b>تم إدخال مفتاح جديد بانتظار النشر</b>' : '') +
      '</span></div>' +
      '<label>تحديث / إدخال مفتاح Gemini جديد (اختياري)</label>' +
      '<input type="password" id="cfgNewGk" autocomplete="off" dir="ltr" placeholder="AIzaSy... اتركه فارغاً للإبقاء على المفتاح الحالي">' +
      (c.hasGk && !c.gkFromEnv
        ? '<button class="btn btn-danger btn-sm" type="button" id="cfgClearGkBtn" style="margin-top:8px">🗑 إزالة المفتاح المحفوظ</button>'
        : '') +
      '</div></div>'
    );
  }

  // ===== 7. USERS MANAGEMENT + USER DETAIL MODAL =====
  function statusMeta(st) {
    if (st === 'Approved') return { label: 'مفعّل ومعتمد', cls: 'st-Approved' };
    if (st === 'Rejected') return { label: 'مرفوض', cls: 'st-Rejected' };
    if (st === 'Suspended') return { label: 'موقوف', cls: 'st-Suspended' };
    return { label: 'في انتظار الموافقة', cls: 'st-Pending' };
  }

  function updateUsersBadge() {
    var b = $('uBadge');
    if (!b) return;
    var pCount = Number(userCounts.Pending || 0);
    b.textContent = String(pCount);
    b.hidden = !(pCount > 0);
  }

  function renderUserCardsHtml() {
    var sq = userQuery.toLowerCase();
    var list = usersData.filter(function (u) {
      if (userFilter !== 'all' && u.status !== userFilter) return false;
      if (!sq) return true;
      var hay = [u.fullName, u.phone, u.email, u.shopName, u.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.indexOf(sq) > -1;
    });

    if (usersLoading && !usersData.length) return renderSkeletonCards(3);
    if (!list.length) {
      return (
        '<div class="emp">' +
        (userQuery || userFilter !== 'all'
          ? 'لا توجد حسابات مطابقة للبحث أو الفلتر المحدد.'
          : 'لا توجد طلبات تسجيل حسابات حتى الآن.') +
        '</div>'
      );
    }

    return (
      '<div class="cards-grid">' +
      list
        .map(function (u) {
          var meta = statusMeta(u.status);
          var busy = usersBusyId === String(u.id);
          var dis = busy ? ' disabled' : '';
          var acts = '<button class="btn btn-sm" type="button" data-udet="' + esc(u.id) + '">👁 التفاصيل</button>';
          if (u.status === 'Pending') {
            acts +=
              '<button class="btn btn-success btn-sm" type="button" data-ua="approve" data-uid="' + esc(u.id) + '"' + dis + '>✅ موافقة</button>' +
              '<button class="btn btn-warn btn-sm" type="button" data-ua="reject" data-uid="' + esc(u.id) + '"' + dis + '>❌ رفض</button>' +
              '<button class="btn btn-danger btn-sm" type="button" data-ua="delete" data-uid="' + esc(u.id) + '"' + dis + '>🗑 حذف</button>';
          } else if (u.status === 'Approved') {
            acts +=
              '<button class="btn btn-warn btn-sm" type="button" data-ua="suspend" data-uid="' + esc(u.id) + '"' + dis + '>⛔ تعليق</button>' +
              '<button class="btn btn-danger btn-sm" type="button" data-ua="delete" data-uid="' + esc(u.id) + '"' + dis + '>🗑 حذف</button>';
          } else if (u.status === 'Suspended') {
            acts +=
              '<button class="btn btn-success btn-sm" type="button" data-ua="activate" data-uid="' + esc(u.id) + '"' + dis + '>🔄 إعادة تفعيل</button>' +
              '<button class="btn btn-danger btn-sm" type="button" data-ua="delete" data-uid="' + esc(u.id) + '"' + dis + '>🗑 حذف</button>';
          } else {
            acts +=
              '<button class="btn btn-success btn-sm" type="button" data-ua="approve" data-uid="' + esc(u.id) + '"' + dis + '>✅ تفعيل</button>' +
              '<button class="btn btn-danger btn-sm" type="button" data-ua="delete" data-uid="' + esc(u.id) + '"' + dis + '>🗑 حذف</button>';
          }

          return (
            '<article class="ucard">' +
            '<div class="uhead"><div><b class="uname">' +
            esc(u.fullName) +
            '</b><div class="umeta">' +
            '<span dir="ltr">📞 ' +
            esc(u.phone) +
            '</span>' +
            '<span>✉️ ' +
            esc(u.email || 'بدون بريد إلكتروني') +
            '</span>' +
            (u.shopName ? '<span>🏪 ' + esc(u.shopName) + '</span>' : '') +
            (u.address ? '<span>📍 ' + esc(u.address) + '</span>' : '') +
            '<span>🕒 التسجيل: ' +
            esc(formatDateAr(u.createdAt)) +
            '</span>' +
            (u.status === 'Rejected' && u.rejectionReason
              ? '<span style="color:var(--red);font-weight:700">📝 سبب الرفض: ' + esc(u.rejectionReason) + '</span>'
              : '') +
            '</div></div><span class="stpill ' +
            meta.cls +
            '">' +
            meta.label +
            '</span></div>' +
            '<div class="uacts">' +
            acts +
            '</div></article>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function vu() {
    var filters = [
      ['all', 'الكل', userCounts.all || usersData.length],
      ['Pending', 'قيد المراجعة', userCounts.Pending || 0],
      ['Approved', 'مقبول', userCounts.Approved || 0],
      ['Suspended', 'موقوف', userCounts.Suspended || 0],
      ['Rejected', 'مرفوض', userCounts.Rejected || 0],
    ];
    return (
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>👥 المستخدمون والحسابات</h2><span class="count-pill">' +
      (userCounts.all || usersData.length) +
      ' حساب</span></div>' +
      '<div class="sec-hdr-r">' +
      '<button class="btn btn-sm" type="button" id="uExportCsv">⬇ تصدير CSV</button>' +
      '<button class="btn btn-sm" type="button" id="uRefresh">🔄 تحديث</button>' +
      '</div></div>' +
      (usersSetupNotice ? '<div class="alert alert-warn"><span>⚠️ ' + esc(usersSetupNotice) + '</span></div>' : '') +
      '<div class="ufil">' +
      filters
        .map(function (f) {
          return (
            '<button type="button" class="fbtn' +
            (userFilter === f[0] ? ' on' : '') +
            '" data-uf="' +
            f[0] +
            '">' +
            f[1] +
            ' (' +
            f[2] +
            ')</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="toolbar"><div class="toolbar-search"><input id="uq" type="search" placeholder="ابحث بالاسم أو الهاتف أو البريد أو اسم المحل..." value="' +
      esc(userQuery) +
      '"></div></div>' +
      '<div id="uList">' +
      renderUserCardsHtml() +
      '</div>'
    );
  }

  async function renderUserDetailModalDom(uid) {
    var u = usersData.find(function (x) {
      return String(x.id) === String(uid);
    });
    if (!u) return false;
    var uOrders = ordersData.filter(function (o) {
      return String(o.userId) === String(uid) || (u.phone && o.userPhone === u.phone);
    });
    var meta = statusMeta(u.status);
    $('ov').innerHTML =
      '<div class="pn">' +
      '<h2>تفاصيل التاجر: ' +
      esc(u.fullName) +
      '<button class="x" type="button" id="edx">✕</button></h2>' +
      '<div class="card2" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>البيانات الأساسية</b><span class="stpill ' +
      meta.cls +
      '">' +
      meta.label +
      '</span></div>' +
      '<div class="umeta">' +
      '<span dir="ltr">📞 ' + esc(u.phone) + '</span>' +
      '<span>✉️ ' + esc(u.email || '—') + '</span>' +
      '<span>🏪 المحل: ' + esc(u.shopName || '—') + '</span>' +
      '<span>📍 العنوان: ' + esc(u.address || '—') + '</span>' +
      '<span>🕒 تاريخ التسجيل: ' + esc(formatDateAr(u.createdAt)) + '</span>' +
      (u.reviewedBy ? '<span>👤 آخر مراجعة بواسطة: ' + esc(u.reviewedBy) + '</span>' : '') +
      '</div></div>' +
      '<div class="card2" style="margin-bottom:12px"><b>🧾 سجل الطلبات (' +
      uOrders.length +
      ')</b>' +
      (uOrders.length
        ? '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">' +
          uOrders
            .slice(0, 15)
            .map(function (o) {
              return (
                '<div class="cr" style="justify-content:space-between;margin:0"><span><b>' +
                esc(String(o.id || '').slice(0, 14)) +
                '</b> · ' +
                esc(formatDateAr(o.createdAt)) +
                '</span><span class="num"><b>' +
                Number(o.totalPrice || 0) +
                ' ج</b></span></div>'
              );
            })
            .join('') +
          '</div>'
        : '<p class="hint">لا توجد طلبات مسجلة لهذا الحساب بعد.</p>') +
      '</div>' +
      '<div class="card2" style="margin-bottom:0"><b>📜 سجل الإجراءات الإدارية للحساب</b><div id="userAuditSlot" style="margin-top:8px"><div class="skeleton" style="height:40px"></div></div></div>' +
      '</div>';
    $('ov').classList.add('on');
    try {
      var res = await fetch('/api/admin/audit-logs?entityId=' + encodeURIComponent(uid) + '&limit=20', {
        credentials: 'same-origin',
      });
      var data = await res.json().catch(function () {
        return {};
      });
      var slot = $('userAuditSlot');
      if (!slot) return true;
      var logs = Array.isArray(data.logs) ? data.logs : [];
      slot.innerHTML = logs.length
        ? logs
            .map(function (lg) {
              return (
                '<div class="cr" style="justify-content:space-between;margin-bottom:6px"><span><b>' +
                esc(lg.action) +
                '</b> — ' +
                esc(lg.details || '') +
                '</span><small class="num">' +
                esc(formatDateAr(lg.createdAt)) +
                '</small></div>'
              );
            })
            .join('')
        : '<p class="hint">لا توجد أحداث إدارية مسجلة لهذا المستخدم حتى الآن.</p>';
    } catch (e) {
      var slot2 = $('userAuditSlot');
      if (slot2) slot2.innerHTML = '<p class="hint">تعذر جلب السجل.</p>';
    }
    return true;
  }

  function openUserDetailModal(uid) {
    var u = usersData.find(function (x) {
      return String(x.id) === String(uid);
    });
    if (!u) return;
    commitAdminRoute({ ov: 'user', ovUid: String(uid), drawer: false }, { mode: 'push' });
  }

  async function loadUsers(silent) {
    usersLoading = true;
    try {
      var res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (data && data.needsRtdbSetup) {
          usersSetupNotice = data.error || '';
          if (tab === 'u') render();
          return;
        }
        throw new Error(data.error || 'تعذر تحميل الحسابات');
      }
      usersSetupNotice = '';
      usersData = Array.isArray(data.users) ? data.users : [];
      userCounts = data.counts || { all: usersData.length, Pending: 0, Approved: 0, Rejected: 0, Suspended: 0 };
      updateUsersBadge();
      if (tab === 'u' || tab === 'dashboard') render();
    } catch (e) {
      if (!silent) toast(e && e.message ? e.message : 'تعذر تحميل الحسابات');
    } finally {
      usersLoading = false;
    }
  }

  async function runUserAction(action, uid) {
    var user = usersData.find(function (u) {
      return String(u.id) === String(uid);
    });
    if (!user) return;
    var method = 'POST';
    var url = '/api/admin/users/' + encodeURIComponent(uid) + '/' + action;
    var body = null;

    if (action === 'reject') {
      var reason = await askRejectReason(user.fullName);
      if (reason === null) return;
      body = JSON.stringify({ reason: reason });
    } else if (action === 'suspend') {
      var okSusp = await askConfirm(
        'هل أنت متأكد من تعليق حساب "' + user.fullName + '"؟ سيتم إخراجه من المتجر فوراً.',
        '⛔ تعليق الحساب'
      );
      if (!okSusp) return;
    } else if (action === 'delete') {
      var okDel = await askConfirm(
        'هل أنت متأكد من حذف حساب "' + user.fullName + '" نهائياً؟ لا يمكن التراجع.',
        '🗑 حذف نهائي'
      );
      if (!okDel) return;
      method = 'DELETE';
      url = '/api/admin/users/' + encodeURIComponent(uid);
    }

    usersBusyId = String(uid);
    if (tab === 'u' && $('uList')) $('uList').innerHTML = renderUserCardsHtml();

    try {
      var opts = { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = body;
      var res = await fetch(url, opts);
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تنفيذ العملية');
      await loadUsers(true);
      loadAuditLogs(true);
      toast(
        action === 'approve'
          ? 'تمت الموافقة على الحساب وتفعيله ✅'
          : action === 'activate'
          ? 'تمت إعادة تفعيل الحساب ✅'
          : action === 'reject'
          ? 'تم رفض الطلب'
          : action === 'suspend'
          ? 'تم تعليق الحساب'
          : 'تم حذف الحساب نهائياً'
      );
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر تنفيذ العملية');
    } finally {
      usersBusyId = '';
      if (tab === 'u') render();
    }
  }

  // ===== 8. ORDERS MANAGEMENT + CSV EXPORT =====
  function updateOrdersBadge() {
    var b = $('ordBadge');
    if (!b) return;
    var count = Number(orderCounts.sent_whatsapp || 0);
    b.textContent = String(count);
    b.hidden = !(count > 0);
  }

  function orderStatusMeta(st) {
    if (st === 'confirmed') return { label: '✅ مؤكد', cls: 'st-confirmed' };
    if (st === 'completed') return { label: '📦 تم التوصيل', cls: 'st-completed' };
    if (st === 'cancelled') return { label: '❌ ملغي', cls: 'st-cancelled' };
    return { label: '📲 عبر واتساب', cls: 'st-sent_whatsapp' };
  }

  function renderOrderCardsHtml() {
    var sq = orderQuery.toLowerCase();
    var list = ordersData.filter(function (ord) {
      if (orderFilter !== 'all' && ord.status !== orderFilter) return false;
      if (!sq) return true;
      var itemNames = Array.isArray(ord.items)
        ? ord.items
            .map(function (it) {
              var flTxt = Array.isArray(it.flavors)
                ? it.flavors.map(function (f) { return f.name; }).join(' ')
                : '';
              return (it.name || '') + ' ' + (it.variant || '') + ' ' + flTxt;
            })
            .join(' ')
        : '';
      var hay = [ord.id, ord.userName, ord.userPhone, ord.shopName, ord.address, itemNames]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.indexOf(sq) > -1;
    });

    if (ordersLoading && !ordersData.length) return renderSkeletonCards(3);
    if (!list.length) {
      return (
        '<div class="emp">' +
        (orderQuery || orderFilter !== 'all'
          ? 'لا توجد طلبات مطابقة للبحث أو الفلتر المحدد.'
          : 'لا توجد طلبات مسجلة من العملاء حتى الآن.') +
        '</div>'
      );
    }

    return (
      '<div class="cards-grid">' +
      list
        .map(function (ord) {
          var meta = orderStatusMeta(ord.status);
          var busy = ordersBusyId === String(ord.id);
          var dis = busy ? ' disabled' : '';
          var shortId = String(ord.id || '').replace(/^ord_/, '#').slice(0, 14);
          var isOffer = ord.orderType === 'offer';
          var itemsHtml = (Array.isArray(ord.items) ? ord.items : [])
            .map(function (it) {
              var flList = Array.isArray(it.flavors) ? it.flavors : [];
              var flHtml = flList.length
                ? '<div class="ord-fl">' +
                  flList
                    .map(function (f) {
                      return '<span>' + esc(f.name) + ': ' + Number(f.qty || 0) + '</span>';
                    })
                    .join('') +
                  '</div>'
                : '';
              return (
                '<div class="ord-line">' +
                '<div class="ord-line-top"><b>' +
                esc(it.name + (it.variant ? ' · ' + it.variant : '')) +
                '</b><span class="num">× ' +
                Number(it.qty || 0) +
                (isOffer ? '' : ' ' + esc(ord.unit || 'كرتونة')) +
                ' — <b>' +
                (isOffer && ord.offerPriceLabel && !Number(it.subtotal)
                  ? esc(ord.offerPriceLabel)
                  : Number(it.subtotal || 0) + ' ج') +
                '</b></span></div>' +
                flHtml +
                '</div>'
              );
            })
            .join('');

          var acts = '';
          if (ord.status !== 'confirmed') {
            acts +=
              '<button class="btn btn-success btn-sm" type="button" data-os="confirmed" data-oid="' + esc(ord.id) + '"' + dis + '>✅ تأكيد</button>';
          }
          if (ord.status !== 'completed') {
            acts +=
              '<button class="btn btn-primary btn-sm" type="button" data-os="completed" data-oid="' + esc(ord.id) + '"' + dis + '>📦 تم التوصيل</button>';
          }
          if (ord.status !== 'cancelled') {
            acts +=
              '<button class="btn btn-danger btn-sm" type="button" data-os="cancelled" data-oid="' + esc(ord.id) + '"' + dis + '>❌ إلغاء</button>';
          }
          acts +=
            '<button class="btn btn-danger btn-sm" type="button" data-odel="' + esc(ord.id) + '"' + dis + '>🗑 حذف</button>';

          return (
            '<article class="ucard">' +
            '<div class="uhead"><div><b class="uname">' +
            esc(shortId) +
            ' — ' +
            esc(ord.userName || 'تاجر') +
            '</b><div class="umeta">' +
            '<span dir="ltr">📞 ' + esc(ord.userPhone || '—') + '</span>' +
            (ord.shopName ? '<span>🏪 ' + esc(ord.shopName) + '</span>' : '') +
            (ord.address ? '<span>📍 ' + esc(ord.address) + '</span>' : '') +
            '<span>🕒 ' + esc(formatDateAr(ord.createdAt)) + '</span>' +
            '</div></div><span class="stpill ' +
            meta.cls +
            '">' +
            meta.label +
            '</span></div>' +
            '<div class="ord-items-box">' +
            itemsHtml +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;font-weight:800;font-size:13.5px">' +
            '<span>' +
            (isOffer ? 'طلب عرض خاص' : 'الإجمالي (' + Number(ord.totalQty || 0) + ' ' + esc(ord.unit || 'كرتونة') + ')') +
            '</span><span class="num" style="color:var(--red);font-size:15.5px">' +
            (isOffer && ord.offerPriceLabel && !Number(ord.totalPrice)
              ? esc(ord.offerPriceLabel)
              : Number(ord.totalPrice || 0) + ' جنيه') +
            '</span></div></div>' +
            '<div class="uacts">' +
            acts +
            '</div></article>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function voOrders() {
    var filters = [
      ['all', 'الكل', orderCounts.all || ordersData.length],
      ['sent_whatsapp', 'جديد (واتساب)', orderCounts.sent_whatsapp || 0],
      ['confirmed', 'مؤكد', orderCounts.confirmed || 0],
      ['completed', 'مُوصّل', orderCounts.completed || 0],
      ['cancelled', 'ملغي', orderCounts.cancelled || 0],
    ];
    return (
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>🧾 طلبات العملاء عبر واتساب</h2><span class="count-pill">' +
      (orderCounts.all || ordersData.length) +
      ' طلب</span></div>' +
      '<div class="sec-hdr-r">' +
      '<button class="btn btn-sm" type="button" id="oExportCsv">⬇ تصدير CSV</button>' +
      '<button class="btn btn-sm" type="button" id="oRefresh">🔄 تحديث</button>' +
      '<button class="btn btn-danger btn-sm" type="button" id="oClearAll"' +
      (!ordersData.length || ordersBusyId === '__all__' ? ' disabled' : '') +
      '>🗑 مسح السجل</button>' +
      '</div></div>' +
      (ordersSetupNotice ? '<div class="alert alert-warn"><span>⚠️ ' + esc(ordersSetupNotice) + '</span></div>' : '') +
      '<div class="ufil">' +
      filters
        .map(function (f) {
          return (
            '<button type="button" class="fbtn' +
            (orderFilter === f[0] ? ' on' : '') +
            '" data-of="' +
            f[0] +
            '">' +
            f[1] +
            ' (' +
            f[2] +
            ')</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="toolbar"><div class="toolbar-search"><input id="oq" type="search" placeholder="ابحث برقم الطلب أو اسم التاجر أو الصنف..." value="' +
      esc(orderQuery) +
      '"></div></div>' +
      '<div id="oList">' +
      renderOrderCardsHtml() +
      '</div>'
    );
  }

  async function loadOrders(silent) {
    ordersLoading = true;
    try {
      var res = await fetch('/api/admin/orders', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (data && data.needsRtdbSetup) {
          ordersSetupNotice = data.error || '';
          if (tab === 'orders') render();
          return;
        }
        throw new Error(data.error || 'تعذر تحميل الطلبات');
      }
      ordersSetupNotice = '';
      ordersData = Array.isArray(data.orders) ? data.orders : [];
      orderCounts = data.counts || { all: ordersData.length, sent_whatsapp: 0, confirmed: 0, completed: 0, cancelled: 0 };
      updateOrdersBadge();
      if (tab === 'orders' || tab === 'dashboard') render();
    } catch (e) {
      if (!silent) toast(e && e.message ? e.message : 'تعذر تحميل الطلبات');
    } finally {
      ordersLoading = false;
    }
  }

  async function updateOrderStatusAdmin(ordId, nextStatus) {
    ordersBusyId = String(ordId);
    if (tab === 'orders' && $('oList')) $('oList').innerHTML = renderOrderCardsHtml();
    try {
      var res = await fetch('/api/admin/orders/' + encodeURIComponent(ordId) + '/status', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر تحديث حالة الطلب');
      await loadOrders(true);
      loadAuditLogs(true);
      toast('تم تحديث حالة الطلب ✅');
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر تحديث حالة الطلب');
    } finally {
      ordersBusyId = '';
      if (tab === 'orders') render();
    }
  }

  async function deleteOrderAdmin(ordId) {
    var ok = await askConfirm('هل تريد حذف هذا الطلب من سجل الطلبات؟', 'حذف الطلب');
    if (!ok) return;
    ordersBusyId = String(ordId);
    if (tab === 'orders' && $('oList')) $('oList').innerHTML = renderOrderCardsHtml();
    try {
      var res = await fetch('/api/admin/orders/' + encodeURIComponent(ordId), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر حذف الطلب');
      await loadOrders(true);
      loadAuditLogs(true);
      toast('تم حذف الطلب 🗑');
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر حذف الطلب');
    } finally {
      ordersBusyId = '';
      if (tab === 'orders') render();
    }
  }

  async function clearAllOrdersAdmin() {
    var countAll = orderCounts.all || ordersData.length;
    if (!countAll) return;
    var ok = await askConfirm(
      'سيتم حذف جميع الطلبات المسجلة (' + countAll + ' طلب) نهائياً. هل أنت متأكد؟',
      'مسح سجل الطلبات'
    );
    if (!ok) return;
    ordersBusyId = '__all__';
    if (tab === 'orders') render();
    try {
      var res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر مسح سجل الطلبات');
      await loadOrders(true);
      loadAuditLogs(true);
      toast('تم مسح سجل الطلبات (' + Number(data.removed || 0) + ') 🗑');
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر مسح سجل الطلبات');
    } finally {
      ordersBusyId = '';
      if (tab === 'orders') render();
    }
  }

  // ===== 9. NOTIFICATIONS CENTER + LIVE MOCKUP + DEVICES =====
  function pushStatusBadge(st) {
    if (st === 'sent') return { cls: 'st-sent', label: 'تم الإرسال ✅' };
    if (st === 'partial') return { cls: 'st-partial', label: 'إرسال جزئي ⚠️' };
    if (st === 'no_subscribers') return { cls: 'st-no_subscribers', label: 'لا يوجد مشتركون' };
    return { cls: 'st-failed', label: 'تعذر الإرسال ❌' };
  }

  function vn() {
    var usersList = Array.isArray(pushOverview.subscribedUsers) ? pushOverview.subscribedUsers : [];
    var segmentsList = Array.isArray(pushOverview.segments) ? pushOverview.segments : [];
    var logsList = Array.isArray(pushOverview.logs) ? pushOverview.logs : [];

    var subTabs = [
      ['compose', '✉️ إرسال إشعار ومعاينة'],
      ['devices', '📱 الأجهزة المسجلة (' + (pushDevices.length || Number(pushOverview.deviceCount || 0)) + ')'],
      ['logs', '📜 سجل الإرسال (' + logsList.length + ')'],
    ];

    var hdr =
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>🔔 مركز الإشعارات الفورية</h2><span class="count-pill">' +
      Number(pushOverview.subscriberCount || 0) +
      ' مشترك · ' +
      Number(pushOverview.deviceCount || 0) +
      ' جهاز</span></div>' +
      '<div class="sec-hdr-r"><button class="btn btn-sm" type="button" id="pushRefresh">' +
      (pushLoading ? '⏳ جاري...' : '🔄 تحديث') +
      '</button></div></div>' +
      (!pushOverview.configured
        ? '<div class="alert alert-warn"><span>⚠️ مفاتيح VAPID غير مضبوطة على الخادم (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).</span></div>'
        : '') +
      (pushSetupNotice ? '<div class="alert alert-danger"><span>⚠️ ' + esc(pushSetupNotice) + '</span></div>' : '') +
      '<div class="tabs-row">' +
      subTabs
        .map(function (st) {
          return (
            '<button type="button" class="tab-pill' +
            (pushSubTab === st[0] ? ' on' : '') +
            '" data-ptab="' +
            st[0] +
            '">' +
            st[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>';

    if (pushSubTab === 'devices') {
      if (pushDevicesLoading && !pushDevices.length) return hdr + renderSkeletonCards(3);
      if (!pushDevices.length) return hdr + '<div class="emp">لا توجد أجهزة مشتركة في الإشعارات حالياً.</div>';
      return (
        hdr +
        '<div class="table-wrap"><table class="adm-table"><thead><tr><th>المستخدم</th><th>الهاتف</th><th>المحل</th><th>الجهاز</th><th>تاريخ الاشتراك</th><th>إجراء</th></tr></thead><tbody>' +
        pushDevices
          .map(function (dv) {
            return (
              '<tr><td><b>' +
              esc(dv.fullName || 'مستخدم') +
              '</b></td><td dir="ltr" class="num">' +
              esc(dv.phone || '—') +
              '</td><td>' +
              esc(dv.shopName || '—') +
              '</td><td><span class="stpill st-info">' +
              esc(dv.deviceLabel || 'متصفح ويب') +
              '</span></td><td class="num">' +
              esc(formatDateAr(dv.updatedAt || dv.createdAt)) +
              '</td><td><button class="btn btn-danger btn-sm" type="button" data-rm-dev="' +
              esc(dv.id) +
              '">🗑 إزالة</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>'
      );
    }

    if (pushSubTab === 'logs') {
      var lsq = pushLogQuery.toLowerCase();
      var fLogs = logsList.filter(function (lg) {
        if (pushLogFilter !== 'all' && lg.status !== pushLogFilter) return false;
        if (!lsq) return true;
        return ([lg.title, lg.body, lg.targetLabel, lg.url].filter(Boolean).join(' ').toLowerCase()).indexOf(lsq) > -1;
      });
      return (
        hdr +
        '<div class="toolbar"><div class="toolbar-search"><input id="pushLogQ" type="search" placeholder="ابحث في سجل الإشعارات..." value="' +
        esc(pushLogQuery) +
        '"></div><div class="toolbar-ctrl"><select id="pushLogSt">' +
        '<option value="all"' + (pushLogFilter === 'all' ? ' selected' : '') + '>كل الحالات</option>' +
        '<option value="sent"' + (pushLogFilter === 'sent' ? ' selected' : '') + '>تم الإرسال</option>' +
        '<option value="partial"' + (pushLogFilter === 'partial' ? ' selected' : '') + '>إرسال جزئي</option>' +
        '<option value="failed"' + (pushLogFilter === 'failed' ? ' selected' : '') + '>فشل</option>' +
        '</select></div>' +
        (logsList.length
          ? '<button class="btn btn-danger btn-sm" type="button" id="pushClearLogs">🗑 مسح كل السجل</button>'
          : '') +
        '</div>' +
        (!fLogs.length
          ? '<div class="emp">لا توجد إشعارات مطابقة في السجل.</div>'
          : '<div class="cards-grid">' +
            fLogs
              .map(function (lg) {
                var badge = pushStatusBadge(lg.status);
                var reasons = Array.isArray(lg.failureReasons) ? lg.failureReasons : [];
                return (
                  '<article class="ucard"><div class="uhead"><div><b class="uname">' +
                  esc(lg.title) +
                  '</b><div class="umeta"><span>🎯 ' +
                  esc(lg.targetLabel || 'جميع المشتركين') +
                  '</span><span>🕒 ' +
                  esc(formatDateAr(lg.createdAt)) +
                  '</span><span dir="ltr">🔗 ' +
                  esc(lg.url || '/') +
                  '</span><span class="num">📊 سُلم: <b>' +
                  Number(lg.sentCount || 0) +
                  '</b> · فشل: ' +
                  Number(lg.failedCount || 0) +
                  (lg.removedCount ? ' · أُزيلت: ' + Number(lg.removedCount) : '') +
                  '</span></div></div><span class="stpill ' +
                  badge.cls +
                  '">' +
                  badge.label +
                  '</span></div><p style="margin:6px 0 0;font-size:13px">' +
                  esc(lg.body) +
                  '</p>' +
                  (lg.imageUrl ? '<img class="phone-notif-img" src="' + esc(lg.imageUrl) + '" alt="" loading="lazy">' : '') +
                  (reasons.length
                    ? '<div class="alert alert-danger" style="margin:6px 0 0"><span>أسباب الفشل: ' + esc(reasons.join(' | ')) + '</span></div>'
                    : '') +
                  '<div class="uacts">' +
                  '<button class="btn btn-danger btn-sm" type="button" data-del-plog="' +
                  esc(lg.id) +
                  '" data-plog-title="' +
                  esc(lg.title || '') +
                  '">🗑 حذف الإشعار</button>' +
                  '</div></article>'
                );
              })
              .join('') +
            '</div>')
      );
    }

    // Compose + Live Mockup Tab
    var targetControls = '';
    if (pushForm.targetType === 'user') {
      targetControls = !usersList.length
        ? '<p class="hint" style="color:var(--red)">لا يوجد مستخدمون مشتركون حالياً.</p>'
        : '<label>اختر المستخدم المشترك</label><select id="pushTargetUser">' +
          usersList
            .map(function (u) {
              return (
                '<option value="' + esc(u.id) + '"' + (String(u.id) === String(pushForm.targetUserId) ? ' selected' : '') + '>' +
                esc(u.fullName || 'بدون اسم') + ' — ' + esc(u.phone || '') + ' (' + (u.deviceCount || 1) + ' جهاز)</option>'
              );
            })
            .join('') +
          '</select>';
    } else if (pushForm.targetType === 'segment') {
      targetControls =
        '<label>اختر الفئة المستهدفة</label><select id="pushTargetSeg">' +
        segmentsList
          .map(function (sg) {
            return (
              '<option value="' + esc(sg.id) + '"' + (String(sg.id) === String(pushForm.targetSegment) ? ' selected' : '') + '>' +
              esc(sg.label) + ' (' + Number(sg.count || 0) + ' مشترك)</option>'
            );
          })
          .join('') +
        '</select>';
    }

    var urlOptions = [
      ['/', 'الصفحة الرئيسية للمتجر (/)'],
      ['/#offers', 'قسم العروض (/#offers)'],
      ['/#catalog', 'كل الأصناف (/#catalog)'],
      ['custom', 'رابط أو صفحة مخصصة'],
    ];
    var sendDisabled = pushSending || !pushOverview.configured ? ' disabled' : '';

    return (
      hdr +
      '<div class="push-layout">' +
      '<div class="card">' +
      '<h3 class="card-title">✉️ تجهيز الإشعار</h3>' +
      '<label>الجمهور المستهدف</label><div class="ufil">' +
      [
        ['all', '📢 جميع المشتركين'],
        ['user', '👤 مستخدم محدد'],
        ['segment', '🏷 فئة محددة'],
      ]
        .map(function (m) {
          return (
            '<button type="button" class="fbtn' +
            (pushForm.targetType === m[0] ? ' on' : '') +
            '" data-ptarget="' +
            m[0] +
            '">' +
            m[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      targetControls +
      '<label>عنوان الإشعار</label><input id="pushTitle" type="text" maxlength="120" placeholder="مثال: عروض جملة جديدة اليوم 🔥" value="' +
      esc(pushForm.title) +
      '">' +
      '<label>نص الإشعار</label><textarea id="pushBody" rows="3" maxlength="400" placeholder="اكتب تفاصيل العرض أو التنبيه للعملاء...">' +
      esc(pushForm.body) +
      '</textarea>' +
      '<label>صورة اختيارية للإشعار</label><div class="npv"><div class="npv-box">' +
      (pushForm.imageDataUrl ? '<img src="' + esc(pushForm.imageDataUrl) + '" alt="">' : '🖼') +
      '</div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer">📷 اختيار صورة<input id="pushImgFile" type="file" accept="image/*" hidden></label>' +
      (pushForm.imageDataUrl ? '<button type="button" class="btn btn-danger btn-sm" id="pushImgRm">حذف الصورة</button>' : '<small class="hint" style="margin:0">تُضغط تلقائياً لتعمل بسلاسة على الجوال</small>') +
      '</div></div>' +
      '<label>الرابط عند الضغط على الإشعار</label><select id="pushUrlPreset">' +
      urlOptions
        .map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (pushForm.urlPreset === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        })
        .join('') +
      '</select>' +
      (pushForm.urlPreset === 'custom'
        ? '<label>الرابط المخصص</label><input id="pushUrlCustom" dir="ltr" type="text" placeholder="/#offers أو https://..." value="' + esc(pushForm.urlCustom) + '">'
        : '') +
      '<button id="pushSendBtn" class="btn btn-success btn-lg" style="width:100%;margin-top:16px" type="button"' +
      sendDisabled +
      '>' +
      (pushSending ? '⏳ جاري الإرسال...' : '🚀 إرسال الإشعار الآن') +
      '</button>' +
      '</div>' +
      '<div class="card"><h3 class="card-title">📱 معاينة الإشعار على الهاتف</h3><p class="hint" style="margin-bottom:14px">شكل تقريبي لوصول الإشعار على Android / Chrome</p>' +
      '<div class="phone-mock"><div class="phone-notch"></div><div class="phone-notif">' +
      '<div class="phone-notif-hdr"><span>🔔 ' + esc((D.cfg && D.cfg.brandName) || 'أبو سعيد') + '</span><span>الآن</span></div>' +
      '<b id="mockPushTitle" style="display:block;font-size:14px;margin-bottom:4px">' + esc(pushForm.title || 'عنوان الإشعار يظهر هنا') + '</b>' +
      '<p id="mockPushBody" style="margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.5">' + esc(pushForm.body || 'نص الإشعار وتفاصيل العرض ستظهر للعملاء بهذا الشكل.') + '</p>' +
      (pushForm.imageDataUrl ? '<img class="phone-notif-img" src="' + esc(pushForm.imageDataUrl) + '" alt="">' : '') +
      '</div></div></div></div>'
    );
  }

  async function loadPushDevices(silent) {
    pushDevicesLoading = true;
    try {
      var res = await fetch('/api/admin/push/devices', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok) pushDevices = Array.isArray(data.devices) ? data.devices : [];
    } catch (e) {
      if (!silent) toast('تعذر تحميل الأجهزة');
    } finally {
      pushDevicesLoading = false;
      if (tab === 'n' && pushSubTab === 'devices') render();
    }
  }

  async function removePushDevice(id) {
    var ok = await askConfirm('هل تريد إزالة هذا الجهاز من قائمة مستقبلي الإشعارات؟', 'إزالة الجهاز');
    if (!ok) return;
    try {
      var res = await fetch('/api/admin/push/devices/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر إزالة الجهاز');
      toast('تمت إزالة الجهاز ✅');
      await Promise.all([loadPushDevices(true), loadPushOverview(true)]);
      render();
    } catch (e) {
      toast((e && e.message) || 'تعذر إزالة الجهاز');
    }
  }

  async function deletePushLog(id, title) {
    if (!id) return;
    var ok = await askConfirm(
      'هل تريد حذف هذا السجل من سجل الإشعارات' + (title ? ' («' + title + '»)' : '') + '؟',
      '🗑 حذف السجل'
    );
    if (!ok) return;
    try {
      var res = await fetch('/api/admin/push/logs/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر حذف سجل الإشعار');
      pushOverview.logs = (pushOverview.logs || []).filter(function (lg) {
        return String(lg.id) !== String(id);
      });
      toast('تم حذف الإشعار من السجل ✅');
      render();
      loadPushOverview(true);
      loadAuditLogs(true);
    } catch (e) {
      toast((e && e.message) || 'تعذر حذف سجل الإشعار');
    }
  }

  async function clearAllPushLogs() {
    var total = Array.isArray(pushOverview.logs) ? pushOverview.logs.length : 0;
    if (!total) return;
    var ok = await askConfirm(
      'هل أنت متأكد من مسح جميع سجلات الإشعارات (' + total + ' سجل) نهائياً؟',
      '🗑 مسح كل السجل'
    );
    if (!ok) return;
    try {
      var res = await fetch('/api/admin/push/logs', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'تعذر مسح سجل الإشعارات');
      pushOverview.logs = [];
      toast('تم مسح سجل الإشعارات بالكامل ✅');
      render();
      loadPushOverview(true);
      loadAuditLogs(true);
    } catch (e) {
      toast((e && e.message) || 'تعذر مسح سجل الإشعارات');
    }
  }

  async function loadPushOverview(silent) {
    pushLoading = true;
    try {
      var res = await fetch('/api/admin/push/overview', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (data && data.needsRtdbSetup) {
          pushSetupNotice = data.error || '';
          if (tab === 'n') render();
          return;
        }
        throw new Error(data.error || 'تعذر تحميل بيانات الإشعارات');
      }
      pushSetupNotice = '';
      pushOverview = {
        configured: Boolean(data.configured),
        missingVars: Array.isArray(data.missingVars) ? data.missingVars : [],
        subscriberCount: Number(data.subscriberCount || 0),
        deviceCount: Number(data.deviceCount || 0),
        segments: Array.isArray(data.segments) ? data.segments : [],
        subscribedUsers: Array.isArray(data.subscribedUsers) ? data.subscribedUsers : [],
        logs: Array.isArray(data.logs) ? data.logs : [],
      };
      if (pushOverview.subscribedUsers.length && !pushOverview.subscribedUsers.some(function (u) { return String(u.id) === String(pushForm.targetUserId); })) {
        pushForm.targetUserId = String(pushOverview.subscribedUsers[0].id);
      }
      if (pushOverview.segments.length && !pushOverview.segments.some(function (sg) { return String(sg.id) === String(pushForm.targetSegment); })) {
        pushForm.targetSegment = String(pushOverview.segments[0].id);
      }
    } catch (err) {
      if (!silent) toast(err && err.message ? err.message : 'تعذر تحميل بيانات الإشعارات');
    } finally {
      pushLoading = false;
      if (tab === 'n' || tab === 'dashboard') {
        var activeEl = document.activeElement;
        var typing = activeEl && (activeEl.id === 'pushTitle' || activeEl.id === 'pushBody' || activeEl.id === 'pushUrlCustom' || activeEl.id === 'pushLogQ');
        if (!typing) render();
      }
    }
  }

  async function sendAdminPushNotification() {
    if (pushSending) return;
    var title = String(pushForm.title || '').trim();
    var body = String(pushForm.body || '').trim();
    if (title.length < 2) return toast('اكتب عنوان الإشعار (حرفين على الأقل)');
    if (body.length < 2) return toast('اكتب نص الإشعار');
    if (pushForm.targetType === 'user' && !pushForm.targetUserId) return toast('اختر المستخدم المشترك أولاً');
    var targetUrl = pushForm.urlPreset === 'custom' ? String(pushForm.urlCustom || '').trim() || '/' : pushForm.urlPreset;

    pushSending = true;
    var btn = $('pushSendBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ جاري الإرسال...';
    }
    try {
      var res = await fetch('/api/admin/push/send', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: pushForm.targetType,
          targetUserId: pushForm.targetType === 'user' ? pushForm.targetUserId : '',
          targetSegment: pushForm.targetType === 'segment' ? pushForm.targetSegment : '',
          title: title,
          body: body,
          url: targetUrl,
          imageDataUrl: pushForm.imageDataUrl || '',
        }),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'تعذر إرسال الإشعار');

      if (data.status === 'no_subscribers') {
        toast('لا يوجد مشتركون مطابقون لهذا الاختيار حالياً');
      } else if (Number(data.sentCount || 0) > 0) {
        toast('تم إرسال الإشعار إلى ' + data.sentCount + ' جهاز بنجاح ✅');
        pushForm.title = '';
        pushForm.body = '';
        pushForm.imageDataUrl = '';
        pushForm.urlCustom = '';
      } else {
        toast('تعذر تسليم الإشعار للمشتركين (' + Number(data.failedCount || 0) + ' فشل)');
      }
      await loadPushOverview(true);
      loadAuditLogs(true);
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر إرسال الإشعار');
    } finally {
      pushSending = false;
      if (tab === 'n') render();
    }
  }

  // ===== 10. MEDIA & FILES HUB =====
  async function loadMedia(silent) {
    mediaLoading = true;
    if (tab === 'media' && !mediaLoaded) render();
    try {
      var res = await fetch('/api/admin/media', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'تعذر جلب مركز الملفات');
      mediaItems = Array.isArray(data.items) ? data.items : [];
      mediaLoaded = true;
    } catch (e) {
      if (!silent) toast((e && e.message) || 'تعذر جلب مركز الملفات');
    } finally {
      mediaLoading = false;
      if (tab === 'media') render();
    }
  }

  async function deleteMediaAsset(id) {
    var ok = await askConfirm('هل أنت متأكد من حذف هذا الملف غير المستخدم نهائياً من قاعدة البيانات؟', '🗑 حذف الملف');
    if (!ok) return;
    try {
      var res = await fetch('/api/admin/media/' + encodeURIComponent(id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'تعذر حذف الملف');
      delete IMG[id];
      toast('تم حذف الملف نهائياً ✅');
      await loadMedia(true);
      loadAuditLogs(true);
    } catch (e) {
      toast((e && e.message) || 'تعذر حذف الملف');
    }
  }

  function vMedia() {
    var combined = mediaItems.slice();
    Object.keys(PEND).forEach(function (k) {
      if (!IMG[k] || combined.some(function (x) { return x.id === k; })) return;
      combined.unshift({
        id: k,
        dataUrl: IMG[k],
        mime: String(IMG[k]).split(';')[0].replace('data:', '') || 'image/jpeg',
        sizeBytes: Math.round((String(IMG[k]).length * 3) / 4),
        isFont: String(k).indexOf('f') === 0,
        usedBy: ['قيد النشر محلياً'],
        unused: false,
        pending: true,
      });
    });

    var msq = mediaQuery.toLowerCase();
    var list = combined.filter(function (it) {
      if (mediaFilter === 'used' && it.unused) return false;
      if (mediaFilter === 'unused' && !it.unused) return false;
      if (mediaFilter === 'fonts' && !it.isFont) return false;
      if (msq) {
        var hay = [it.id, it.mime].concat(it.usedBy || []).join(' ').toLowerCase();
        if (hay.indexOf(msq) < 0) return false;
      }
      return true;
    });

    return (
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>🖼 مركز الصور والملفات</h2><span class="count-pill">' +
      combined.length +
      ' ملف</span></div>' +
      '<div class="sec-hdr-r">' +
      '<label class="btn btn-success btn-sm" style="margin:0;cursor:pointer">+ رفع صورة<input type="file" id="mediaUploadNew" accept="image/*" hidden></label>' +
      '<button class="btn btn-sm" type="button" id="mediaRefresh">🔄 تحديث</button>' +
      '</div></div>' +
      '<div class="tabs-row">' +
      [
        ['all', 'الكل (' + combined.length + ')'],
        ['used', 'مستخدمة (' + combined.filter(function (x) { return !x.unused; }).length + ')'],
        ['unused', 'غير مستخدمة (' + combined.filter(function (x) { return x.unused; }).length + ')'],
        ['fonts', 'ملفات الخطوط (' + combined.filter(function (x) { return x.isFont; }).length + ')'],
      ]
        .map(function (f) {
          return '<button type="button" class="tab-pill' + (mediaFilter === f[0] ? ' on' : '') + '" data-mfil="' + f[0] + '">' + f[1] + '</button>';
        })
        .join('') +
      '</div>' +
      '<div class="toolbar"><div class="toolbar-search"><input id="mediaQ" type="search" placeholder="ابحث بمعرف الملف أو اسم الصنف المرتبط..." value="' +
      esc(mediaQuery) +
      '"></div></div>' +
      (mediaLoading && !mediaLoaded
        ? renderSkeletonCards(6)
        : !list.length
        ? '<div class="emp">لا توجد ملفات مطابقة.</div>'
        : '<div class="media-grid">' +
          list
            .map(function (it) {
              return (
                '<article class="media-card">' +
                '<div class="media-prev">' +
                (it.isFont
                  ? '<span style="font-size:28px">🔤<small style="display:block;font-size:11px;color:var(--mu)">ملف خط</small></span>'
                  : '<img src="' + esc(it.dataUrl) + '" alt="" loading="lazy">') +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b class="mono" style="font-size:11.5px">' +
                esc(it.id) +
                '</b><span class="stpill ' +
                (it.unused ? 'st-warn' : 'st-ok') +
                '">' +
                (it.unused ? 'غير مستخدم' : 'مرتبط') +
                '</span></div>' +
                '<div class="umeta"><span>الحجم: <b class="num">' +
                formatBytes(it.sizeBytes) +
                '</b></span><span>الاستخدام: ' +
                esc((it.usedBy && it.usedBy.length ? it.usedBy.join('، ') : 'غير مرتبط بأي عنصر')) +
                '</span></div>' +
                (it.unused && !it.pending
                  ? '<button class="btn btn-danger btn-sm" type="button" data-mdel="' + esc(it.id) + '">🗑 حذف بأمان</button>'
                  : '') +
                '</article>'
              );
            })
            .join('') +
          '</div>')
    );
  }

  // ===== 11. AUDIT LOGS VIEW =====
  async function loadAuditLogs(silent) {
    auditLoading = true;
    try {
      var res = await fetch('/api/admin/audit-logs?limit=150', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (res.ok) {
        auditLogs = Array.isArray(data.logs) ? data.logs : [];
        auditLoaded = true;
      }
    } catch (e) {
      if (!silent) toast('تعذر تحميل سجل النشاطات');
    } finally {
      auditLoading = false;
      if (tab === 'audit' || tab === 'dashboard') render();
    }
  }

  function vAudit() {
    var asq = auditQuery.toLowerCase();
    var list = auditLogs.filter(function (lg) {
      if (auditTypeFilter !== 'all' && lg.entityType !== auditTypeFilter) return false;
      if (!asq) return true;
      return ([lg.action, lg.actorEmail, lg.entityLabel, lg.details].filter(Boolean).join(' ').toLowerCase()).indexOf(asq) > -1;
    });
    var types = [
      ['all', 'الكل'],
      ['catalog', 'الكتالوج'],
      ['user', 'الحسابات'],
      ['order', 'الطلبات'],
      ['push', 'الإشعارات'],
      ['media', 'الملفات'],
      ['backup', 'النسخ الاحتياطي'],
      ['system', 'النظام'],
    ];
    return (
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>📜 سجل النشاطات</h2><span class="count-pill">' +
      list.length +
      ' حدث</span></div>' +
      '<div class="sec-hdr-r"><button class="btn btn-sm" type="button" id="auditRefresh">🔄 تحديث</button></div></div>' +
      '<div class="tabs-row">' +
      types
        .map(function (t) {
          return '<button type="button" class="tab-pill' + (auditTypeFilter === t[0] ? ' on' : '') + '" data-autype="' + t[0] + '">' + t[1] + '</button>';
        })
        .join('') +
      '</div>' +
      '<div class="toolbar"><div class="toolbar-search"><input id="auditQ" type="search" placeholder="ابحث بالمدير، نوع العملية، أو التفاصيل..." value="' +
      esc(auditQuery) +
      '"></div></div>' +
      (auditLoading && !auditLoaded
        ? renderSkeletonCards(3)
        : !list.length
        ? '<div class="emp">لا توجد سجلات نشاط مطابقة.</div>'
        : '<div class="table-wrap"><table class="adm-table"><thead><tr><th>النوع</th><th>العملية</th><th>العنصر</th><th>التفاصيل</th><th>بواسطة</th><th>التوقيت</th></tr></thead><tbody>' +
          list
            .map(function (lg) {
              return (
                '<tr><td><span class="stpill st-muted">' +
                esc(lg.entityType || 'system') +
                '</span></td><td><span class="stpill st-info">' +
                esc(lg.action) +
                '</span></td><td><b>' +
                esc(lg.entityLabel || lg.entityId || '—') +
                '</b></td><td>' +
                esc(lg.details || '—') +
                '</td><td dir="ltr">' +
                esc(lg.actorEmail || '—') +
                '</td><td class="num">' +
                esc(formatDateAr(lg.createdAt)) +
                '</td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>')
    );
  }

  // ===== 12. ANALYTICS & REPORTS + EXPORTS =====
  function downloadBlob(filename, mime, content) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 100);
  }

  function exportCsvRows(filename, headers, rows) {
    var escCsv = function (v) {
      var s = String(v == null ? '' : v).replace(/"/g, '""');
      return '"' + s + '"';
    };
    var lines = [headers.map(escCsv).join(',')].concat(
      rows.map(function (r) {
        return r.map(escCsv).join(',');
      })
    );
    downloadBlob(filename, 'text/csv;charset=utf-8', '\uFEFF' + lines.join('\n'));
  }

  function vAnalytics() {
    var withImgs = D.p.filter(function (p) { return !!p[8]; }).length;
    var withFlavors = D.p.filter(function (p) { return p[9] && p[9].length; }).length;
    var withDiscounts = D.p.filter(function (p) { return +p[11] > +p[3]; }).length;
    var totalOrderValue = ordersData.reduce(function (s, o) {
      return o.status !== 'cancelled' ? s + Number(o.totalPrice || 0) : s;
    }, 0);
    var sentPushSum = (pushOverview.logs || []).reduce(function (s, l) { return s + Number(l.sentCount || 0); }, 0);
    var failPushSum = (pushOverview.logs || []).reduce(function (s, l) { return s + Number(l.failedCount || 0); }, 0);

    var catStats = D.cats.map(function (c) {
      var ps = D.p.filter(function (p) { return p[1] === c; });
      var active = ps.filter(function (p) { return !p[7]; }).length;
      var avg = ps.length ? Math.round(ps.reduce(function (s, p) { return s + Number(p[3] || 0); }, 0) / ps.length) : 0;
      return { name: c, total: ps.length, active: active, hidden: ps.length - active, avgPrice: avg };
    });

    return (
      '<div class="sec-hdr">' +
      '<div class="sec-hdr-l"><h2>📈 التقارير والإحصائيات</h2></div>' +
      '<div class="sec-hdr-r">' +
      '<button class="btn btn-sm" type="button" id="repExportProductsCsv">⬇ تصدير الأصناف CSV</button>' +
      '<button class="btn btn-sm" type="button" id="repExportOrdersCsv">⬇ تصدير الطلبات CSV</button>' +
      '<button class="btn btn-primary btn-sm" type="button" id="repExportJson">⬇ تصدير الكتالوج JSON</button>' +
      '</div></div>' +
      '<div class="kpi-grid">' +
      '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">قيمة الطلبات غير الملغاة</span><span>💰</span></div><div class="kpi-val">' +
      totalOrderValue.toLocaleString('en-US') + ' ج</div><div class="kpi-sub">من ' + ordersData.length + ' طلب</div></div>' +
      '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">أصناف بصور مرفوعة</span><span>🖼</span></div><div class="kpi-val">' +
      withImgs + ' / ' + D.p.length + '</div><div class="kpi-sub">تغطية الصور</div></div>' +
      '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">أصناف متعددة النكهات</span><span>🍓</span></div><div class="kpi-val">' +
      withFlavors + '</div><div class="kpi-sub">' + withDiscounts + ' صنف بخصم</div></div>' +
      '<div class="kpi-card"><div class="kpi-top"><span class="kpi-lbl">كفاءة تسليم الإشعارات</span><span>🔔</span></div><div class="kpi-val">' +
      (sentPushSum + failPushSum > 0 ? Math.round((sentPushSum / (sentPushSum + failPushSum)) * 100) + '%' : '—') +
      '</div><div class="kpi-sub">' + sentPushSum + ' ناجح · ' + failPushSum + ' فشل</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title">📊 تحليل الأقسام ومتوسط الأسعار</h3></div>' +
      '<div class="table-wrap"><table class="adm-table"><thead><tr><th>القسم</th><th>إجمالي الأصناف</th><th>النشط</th><th>المخفي</th><th>متوسط السعر</th></tr></thead><tbody>' +
      catStats
        .map(function (cs) {
          return (
            '<tr><td><b>' + esc(cs.name) + '</b></td><td class="num">' + cs.total + '</td><td class="num">' + cs.active +
            '</td><td class="num">' + cs.hidden + '</td><td class="num"><b>' + cs.avgPrice + ' ج</b></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div></div>'
    );
  }

  // ===== 13. BACKUPS & RESTORE =====
  async function loadBackups(silent) {
    backupsLoading = true;
    if (tab === 'backups' && !backupsLoaded) render();
    try {
      var res = await fetch('/api/admin/backups', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (res.ok) {
        backupsList = Array.isArray(data.backups) ? data.backups : [];
        backupsLoaded = true;
      }
    } catch (e) {
      if (!silent) toast('تعذر تحميل النسخ الاحتياطية');
    } finally {
      backupsLoading = false;
      if (tab === 'backups') render();
    }
  }

  async function createManualBackup() {
    var lblInput = $('bkLabelInput');
    var label = lblInput ? lblInput.value.trim() : '';
    try {
      var res = await fetch('/api/admin/backups', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label }),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'تعذر إنشاء النسخة');
      if (lblInput) lblInput.value = '';
      toast('تم إنشاء النسخة الاحتياطية بنجاح ✅');
      await loadBackups(true);
      loadAuditLogs(true);
    } catch (e) {
      toast((e && e.message) || 'تعذر إنشاء النسخة الاحتياطية');
    }
  }

  async function downloadBackupJson(id) {
    try {
      var res = await fetch('/api/admin/backups/' + encodeURIComponent(id), { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.backup) throw new Error(data.error || 'تعذر تنزيل النسخة');
      downloadBlob('abusaid-backup-' + id + '.json', 'application/json;charset=utf-8', JSON.stringify(data.backup, null, 2));
    } catch (e) {
      toast((e && e.message) || 'تعذر تنزيل النسخة');
    }
  }

  async function restoreBackup(id, label) {
    var ok = await askConfirm(
      'هل أنت متأكد من استرجاع النسخة الاحتياطية "' + label + '"؟ سيتم إنشاء نسخة حماية تلقائية من الوضع الحالي قبل الاستبدال.',
      '♻️ استعادة النسخة الآن'
    );
    if (!ok) return;
    try {
      var res = await fetch('/api/admin/backups/' + encodeURIComponent(id) + '/restore', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'تعذر استرجاع النسخة');
      await loadAll();
      dirty = false;
      updatePublishStatusUI();
      await loadBackups(true);
      loadAuditLogs(true);
      render();
      toast('تمت استعادة النسخة الاحتياطية بنجاح ✅');
    } catch (e) {
      toast((e && e.message) || 'تعذر استرجاع النسخة');
    }
  }

  async function importBackupFile(file) {
    try {
      var text = await file.text();
      var parsed = JSON.parse(text);
      var ok = await askConfirm(
        'سيتم التحقق من ملف النسخة الاحتياطية واستعادته (مع أخذ نسخة حماية تلقائية للوضع الحالي قبل الاستيراد). هل تود المتابعة؟',
        '📥 استيراد واسترجاع'
      );
      if (!ok) return;
      var res = await fetch('/api/admin/backups/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'ملف النسخة غير صالح');
      await loadAll();
      dirty = false;
      updatePublishStatusUI();
      await loadBackups(true);
      render();
      toast('تم استيراد النسخة الاحتياطية واسترجاعها ✅');
    } catch (e) {
      toast((e && e.message) || 'تعذر قراءة أو استيراد الملف');
    }
  }

  function vBackups() {
    return (
      '<div class="sec-hdr"><div class="sec-hdr-l"><h2>💾 النسخ الاحتياطي والاسترجاع</h2><span class="count-pill">' +
      backupsList.length +
      ' نسخة</span></div><div class="sec-hdr-r"><button class="btn btn-sm" type="button" id="bkRefresh">🔄 تحديث</button></div></div>' +
      '<div class="grid-2">' +
      '<div class="card"><h3 class="card-title">📸 إنشاء نقطة حفظ جديدة</h3><p class="hint">تحفظ نسخة كاملة من الأصناف والأقسام والعروض والإعدادات الحالية على الخادم.</p>' +
      '<label>اسم النسخة (اختياري)</label><input id="bkLabelInput" placeholder="مثال: قبل تعديل أسعار رمضان">' +
      '<button class="btn btn-success" id="bkCreateBtn" type="button" style="margin-top:12px">💾 إنشاء نسخة احتياطية الآن</button></div>' +
      '<div class="card"><h3 class="card-title">📥 استيراد من ملف JSON</h3><p class="hint">ارفع ملف نسخة احتياطية محفوظة مسبقاً على جهازك للاسترجاع الآمن (يتم حفظ نسخة حماية تلقائياً قبل التنفيذ).</p>' +
      '<label class="btn btn-primary" style="margin-top:16px;cursor:pointer">📂 اختيار ملف نسخة (.json)<input type="file" id="bkImportFile" accept=".json,application/json" hidden></label>' +
      '</div></div>' +
      '<div class="card"><h3 class="card-title" style="margin-bottom:12px">🗂 النسخ المحفوظة على الخادم</h3>' +
      (backupsLoading && !backupsLoaded
        ? renderSkeletonCards(3)
        : !backupsList.length
        ? '<div class="emp">لا توجد نسخ احتياطية محفوظة بعد. أنشئ أول نسخة الآن.</div>'
        : '<div class="table-wrap"><table class="adm-table"><thead><tr><th>الوصف</th><th>النوع</th><th>المحتوى</th><th>بواسطة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>' +
          backupsList
            .map(function (bk) {
              var st = bk.stats || {};
              return (
                '<tr><td><b>' +
                esc(bk.label) +
                '</b></td><td><span class="stpill ' +
                (bk.triggerType === 'pre_restore' ? 'st-warn' : 'st-info') +
                '">' +
                (bk.triggerType === 'pre_restore' ? 'حماية تلقائية' : 'يدوية') +
                '</span></td><td class="num">' +
                Number(st.products || 0) + ' صنف · ' + Number(st.cats || 0) + ' قسم · ' + Number(st.offers || 0) + ' عرض' +
                '</td><td dir="ltr">' +
                esc(bk.actorEmail || '—') +
                '</td><td class="num">' +
                esc(formatDateAr(bk.createdAt)) +
                '</td><td><div class="row-actions">' +
                '<button class="btn btn-sm" type="button" data-bk-dl="' + esc(bk.id) + '">⬇ تنزيل JSON</button>' +
                '<button class="btn btn-warn btn-sm" type="button" data-bk-res="' + esc(bk.id) + '" data-bk-lbl="' + esc(bk.label) + '">♻️ استعادة</button>' +
                '</div></td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>') +
      '</div>'
    );
  }

  // ===== 14. RAHAL AI WORKSPACE VIEW =====
  function vAiWorkspace() {
    var c = D.cfg || {};
    var admUi = getAdminAiUiMode();
    var custUi = String(c.aiUi || 'chat');
    var isBatchDefault = admUi === 'batch' || admUi === 'batch_only';
    return (
      '<div class="sec-hdr"><div class="sec-hdr-l"><h2>✨ مساحة عمل ' + esc(AN()) + '</h2></div></div>' +
      '<div class="grid-2">' +
      '<div class="card"><h3 class="card-title">💬 المساعد التفاعلي والكتابة مرة واحدة</h3><p class="hint">تحدث مع المساعد بالكتابة أو الصوت لإضافة أصناف جديدة أو تعديل أسعار وعروض المتجر دفعة واحدة مع مراجعة قبل الحفظ.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">' +
      (admUi !== 'batch_only'
        ? '<button class="btn ' + (!isBatchDefault ? 'btn-brand ' : '') + 'btn-lg" type="button" id="aiLaunchChat">💬 المحادثة التفاعلية' + (!isBatchDefault ? ' (الافتراضي)' : '') + '</button>'
        : '') +
      (admUi !== 'chat_only'
        ? '<button class="btn ' + (isBatchDefault ? 'btn-brand ' : '') + 'btn-lg" type="button" id="aiLaunchBatch">✍️ الكتابة مرة واحدة' + (isBatchDefault ? ' (الافتراضي)' : '') + '</button>'
        : '') +
      '</div></div>' +
      '<div class="card"><h3 class="card-title">🎛️ تحديد نوع الذكاء الاصطناعي المستخدم</h3><p class="hint">اختر الوضع الذي تفضله في لوحة الإدارة ولعملاء المتجر (اضغط نشر لحفظ التغيير للعملاء).</p>' +
      '<label>نوع المساعد للإدارة (عند الضغط على زر ' + esc(AN()) + ')</label>' +
      '<select data-s="adminAiUi">' +
      '<option value="chat"' + (admUi === 'chat' ? ' selected' : '') + '>💬 المحادثة التفاعلية (مع زر للتبديل لكتابة مرة واحدة)</option>' +
      '<option value="batch"' + (admUi === 'batch' ? ' selected' : '') + '>✍️ الكتابة مرة واحدة (مع زر للتبديل للمحادثة)</option>' +
      '<option value="chat_only"' + (admUi === 'chat_only' ? ' selected' : '') + '>💬 المحادثة التفاعلية فقط</option>' +
      '<option value="batch_only"' + (admUi === 'batch_only' ? ' selected' : '') + '>✍️ الكتابة مرة واحدة فقط</option>' +
      '</select>' +
      '<label style="margin-top:10px">نوع المساعد لعملاء المتجر</label>' +
      '<select data-s="aiUi">' +
      '<option value="chat"' + (custUi === 'chat' ? ' selected' : '') + '>💬 المحادثة التفاعلية (مع زر للتبديل لكتابة مرة واحدة)</option>' +
      '<option value="old"' + (custUi === 'old' ? ' selected' : '') + '>✍️ الكتابة مرة واحدة (مع زر للتبديل للمحادثة)</option>' +
      '<option value="chat_only"' + (custUi === 'chat_only' ? ' selected' : '') + '>💬 المحادثة التفاعلية فقط (بدون تبديل)</option>' +
      '<option value="old_only"' + (custUi === 'old_only' ? ' selected' : '') + '>✍️ الكتابة مرة واحدة فقط (بدون تبديل)</option>' +
      '</select></div></div>' +
      '<div class="card" style="margin-top:14px"><h3 class="card-title">⚡ اختصارات ذكية جاهزة</h3><p class="hint">اضغط على أي مهمة لفتح المساعد وتجهيزها مباشرة (تحتاج موافقتك قبل تطبيق أي تعديل):</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
      '<button class="btn" type="button" data-ai-preset="اقترح تحسينات على الأصناف اللي ناقصها صور أو نكهات أو أوصاف في المتجر">🔍 فحص جودة الكتالوج واقتراحات التحسين</button>' +
      '<button class="btn" type="button" data-ai-preset="اقترح نص إشعار قصير وجذاب للعملاء عن العروض المتوفرة حالياً">🔔 صياغة نص إشعار ترويجي للعملاء</button>' +
      '<button class="btn" type="button" data-ai-preset="ضيف عرض جديد مناسب لأشهر قسم في المتجر">🎁 اقتراح عرض ترويجي جديد</button>' +
      '</div></div>'
    );
  }

  // ===== RENDER ROUTER & SHELL SYNC =====
  function render() {
    var meta = PAGE_META[tab] || ['لوحة الإدارة', ''];
    var pt = $('pageTitle');
    if (pt) pt.textContent = meta[0];
    if (!dirty && $('st')) updatePublishStatusUI();

    var aiLbl = AN();
    if ($('smbTxt')) $('smbTxt').textContent = aiLbl;
    if ($('sbAiLbl')) $('sbAiLbl').textContent = aiLbl;
    var rawBrand = D.cfg && D.cfg.brandName != null ? String(D.cfg.brandName).trim() : '';
    var displayBrand = !rawBrand || /^[\s._\-]+$/.test(rawBrand) ? 'أبو سعيد' : rawBrand;
    if ($('sbStoreName')) $('sbStoreName').textContent = displayBrand;
    var sbl = $('sbLogo');
    if (sbl) {
      if (D.cfg && D.cfg.logo && IMG[D.cfg.logo]) {
        sbl.innerHTML = '<img src="' + esc(IMG[D.cfg.logo]) + '" alt="">';
      } else {
        sbl.textContent = displayBrand.charAt(0) || 'أ';
      }
    }

    [].forEach.call(document.querySelectorAll('[data-t]'), function (b) {
      b.classList.toggle('on', b.dataset.t === tab);
    });

    updateUsersBadge();
    updateOrdersBadge();

    var v = $('v');
    if (!v) return;
    v.innerHTML =
      tab === 'dashboard'
        ? vDashboard()
        : tab === 'p'
        ? vp()
        : tab === 'c'
        ? vc()
        : tab === 'o'
        ? vo()
        : tab === 'content'
        ? vContent()
        : tab === 'media'
        ? vMedia()
        : tab === 'orders'
        ? voOrders()
        : tab === 'u'
        ? vu()
        : tab === 'n'
        ? vn()
        : tab === 'ai'
        ? vAiWorkspace()
        : tab === 'analytics'
        ? vAnalytics()
        : tab === 'audit'
        ? vAudit()
        : tab === 'backups'
        ? vBackups()
        : vs();

    bindChartTooltips(v);
    syncAdmBackButton();
  }

  function switchTab(nextTab, opts) {
    var target = VALID_TABS[nextTab] ? nextTab : 'dashboard';
    var o = opts || {};
    var cur = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    var mode = o.mode || (cur.drawer ? 'replace' : cur.tab === target && !cur.ov ? 'replace' : 'push');
    var nextSub = VALID_SUBS[target] ? (o.sub || (target === 's' ? settingsSubTab : target === 'n' ? pushSubTab : offerSubTab)) : '';
    commitAdminRoute(
      {
        tab: target,
        sub: nextSub,
        drawer: false,
        ov: '',
        ovIdx: -1,
        ovCat: '',
        ovDupFrom: -1,
        ovUid: '',
        cov: false,
      },
      { mode: mode, preserveScroll: Boolean(o.preserveScroll) }
    );
  }

  // ===== IMAGE & FONT VALIDATED HELPERS =====
  function shrink(f) {
    return new Promise(function (ok, no) {
      if (!f || !String(f.type || '').match(/^image\//i)) {
        no(new Error('MIME'));
        return;
      }
      if (f.size > 15 * 1024 * 1024) {
        no(new Error('SIZE'));
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 520 / Math.max(im.width, im.height));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * k));
          c.height = Math.max(1, Math.round(im.height * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.8));
        };
        im.onerror = no;
        im.src = r.result;
      };
      r.onerror = no;
      r.readAsDataURL(f);
    });
  }

  function readFontFile(f) {
    return new Promise(function (ok, no) {
      if (!/\.(ttf|otf|woff2?)$/i.test(f.name) && !String(f.type || '').match(/font/i)) {
        no(new Error('TYPE'));
        return;
      }
      if (f.size > 2600000) {
        no(new Error('SIZE'));
        return;
      }
      var r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = no;
      r.readAsDataURL(f);
    });
  }

  // ===== SAFE CATEGORY DELETE DIALOG =====
  function askCategoryDeleteDialog(catIndex) {
    var catName = D.cats[catIndex];
    var count = cnt(catName);
    var others = D.cats.filter(function (c) { return c !== catName; });
    if (!count) {
      return askConfirm('هل تريد حذف القسم الفارغ «' + catName + '»؟', 'حذف القسم').then(function (ok) {
        if (!ok) return;
        D.cats.splice(catIndex, 1);
        if (D.catMeta) delete D.catMeta[catName];
        mark();
        render();
      });
    }

    var cov = $('cov');
    if (!cov) return;
    var settled = false;
    cov.innerHTML =
      '<div class="pn" style="max-width:480px">' +
      '<h2>حذف قسم «' + esc(catName) + '»<button class="x" type="button" id="cdNo">✕</button></h2>' +
      '<div class="alert alert-warn"><span>⚠️ يحتوي هذا القسم على <b>' + count + '</b> صنف. اختر كيفية التعامل معهم:</span></div>' +
      (others.length
        ? '<label class="field-lbl">نقل الأصناف إلى قسم آخر قبل الحذف</label><select id="cdTarget">' +
          others.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
          '</select><button class="btn btn-primary btn-lg" type="button" id="cdMoveBtn" style="width:100%;margin-top:10px">📦 نقل ' + count + ' صنف وحذف القسم</button>'
        : '') +
      '<button class="btn btn-danger-solid btn-lg" type="button" id="cdAllBtn" style="width:100%;margin-top:10px">🗑 حذف القسم مع جميع أصنافه (' + count + ')</button>' +
      '<button class="btn btn-lg" type="button" id="cdCancelBtn" style="width:100%;margin-top:8px">إلغاء</button>' +
      '</div>';
    cov.classList.add('on');
    function cleanup() {
      cov.classList.remove('on');
      cov.innerHTML = '';
      cov.removeEventListener('click', onClick);
      if (activeCovCancel === cancelFromHistory) activeCovCancel = null;
    }
    function cancelFromHistory() {
      if (settled) return;
      settled = true;
      cleanup();
    }
    function closeAfterAction() {
      if (admCurrentSnap && admCurrentSnap.cov && admCanGoBack()) history.back();
      else cancelFromHistory();
    }
    function onClick(e) {
      var t = e.target;
      if (t === cov || t.id === 'cdNo' || t.id === 'cdCancelBtn') {
        closeAfterAction();
      } else if (t.id === 'cdMoveBtn') {
        var target = $('cdTarget') ? $('cdTarget').value : '';
        if (!target) return;
        D.p.forEach(function (p) { if (p[1] === catName) p[1] = target; });
        D.cats.splice(catIndex, 1);
        if (D.catMeta) delete D.catMeta[catName];
        mark();
        render();
        closeAfterAction();
        toast('تم نقل الأصناف إلى «' + target + '» وحذف القسم ✅');
      } else if (t.id === 'cdAllBtn') {
        D.p = D.p.filter(function (p) { return p[1] !== catName; });
        D.cats.splice(catIndex, 1);
        if (D.catMeta) delete D.catMeta[catName];
        mark();
        render();
        closeAfterAction();
        toast('تم حذف القسم وأصنافه');
      }
    }
    activeCovCancel = cancelFromHistory;
    cov.addEventListener('click', onClick);
    commitAdminRoute({ cov: true }, { mode: 'push', skipTabRender: true });
  }

  // ===== PRODUCT EDITOR MODAL =====
  function closeEd(toBase) {
    vStop();
    popAdminOverlay(toBase ? 'base' : undefined);
  }

  function renderFl() {
    var e = $('fl');
    if (!e) return;
    e.innerHTML = fls.length
      ? fls
          .map(function (f, j) {
            return (
              '<div class="cr"><input data-fn="' +
              j +
              '" value="' +
              esc(f[0]) +
              '" placeholder="اسم النكهة"><label class="sw" title="متوفر"><input type="checkbox" data-fa="' +
              j +
              '"' +
              (f[1] ? '' : ' checked') +
              '><i></i></label><button class="btn btn-danger btn-sm" data-fd="' +
              j +
              '" type="button" aria-label="حذف">🗑</button></div>'
            );
          })
          .join('')
      : '<p class="emp" style="padding:12px">لا توجد نكهات — الصنف يظهر للعميل بزر إضافة مباشر.</p>';
  }

  function addFl() {
    var el = $('fnew');
    if (!el) return;
    el.value.split(/[,،\n]+/).forEach(function (x) {
      x = x.trim();
      if (x && !fls.some(function (f) { return f[0] == x; })) fls.push([x, 0]);
    });
    el.value = '';
    renderFl();
    el.focus();
  }

  function renderEdModalDom(i, c, dup) {
    var sp = null;
    if (dup && D.p[i]) {
      sp = D.p[i];
      dupFrom = i;
      i = -1;
    } else dupFrom = -1;
    if (i >= 0 && !D.p[i]) return false;
    ei = i;
    var p = sp
      ? JSON.parse(JSON.stringify(sp))
      : i >= 0
      ? D.p[i]
      : ['', c || D.cats[0] || '', '', 0, PAL[0][1], PAL[0][2], '🥔', 0, ''];
    fls = (p[9] || []).map(function (f) { return [f[0], f[1] ? 1 : 0]; });
    pal = 0;
    eimg = p[8] || '';
    enew = '';
    PAL.forEach(function (x, j) { if (x[1] == p[4]) pal = j; });

    $('ov').innerHTML =
      '<div class="pn"><h2>' +
      (i >= 0 ? 'تعديل صنف' : sp ? 'نسخة جديدة من صنف' : 'إضافة صنف جديد') +
      '<button class="x" type="button" id="edx">✕</button></h2>' +
      (sp ? '<div class="alert alert-info"><span>📋 نسخة من «' + esc(sp[0]) + '» — عدّل السعر أو الحجم ثم اضغط حفظ.</span></div>' : '') +
      '<label>صورة الصنف</label><div class="ip"><div class="ipv" id="ipv">' +
      (eimg && IMG[eimg] ? '<img src="' + IMG[eimg] + '" alt="">' : esc(p[6] || '🥔')) +
      '</div><div class="btns"><label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer">📷 اختيار صورة<input type="file" id="ff" accept="image/*" hidden></label><button class="btn btn-danger btn-sm" id="irm" type="button">إزالة الصورة</button></div></div>' +
      '<label>اسم الصنف</label><input id="fn" value="' + esc(p[0]) + '" placeholder="مثال: شيبسي عائلي">' +
      '<div class="r2"><div><label>السعر (جنيه)</label><input id="fp" type="number" inputmode="numeric" value="' + (p[3] || '') + '"></div><div><label>السعر قبل الخصم (اختياري)</label><input id="fo" type="number" inputmode="numeric" value="' + (+p[11] > 0 ? p[11] : '') + '" placeholder="مثال: 220"></div><div style="max-width:95px"><label>إيموجي</label><input id="fe" value="' + esc(p[6] || '🥔') + '" style="text-align:center"></div></div>' +
      '<div class="r2"><div><label>اسم الحجم / النوع (اختياري)</label><input id="fv" value="' + esc(p[10] || '') + '" placeholder="مثال: ١٠ جنيه"></div><div><label>العبوة / الوصف</label><input id="fd" value="' + esc(p[2]) + '" placeholder="مثال: كرتونة ٤٨ كيس"></div></div>' +
      '<label>القسم</label><select id="fc">' +
      D.cats.map(function (x) { return '<option' + (x == p[1] ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
      '</select>' +
      '<label>النكهات / الأطعمة (اختياري)</label><div id="fl"></div>' +
      '<div class="r2"><div><input id="fnew" placeholder="اكتب نكهة، أو عدة نكهات بفاصلة (،)"></div><button class="btn btn-primary" id="fadd" type="button" style="flex:none">+ إضافة</button></div>' +
      '<label>لون خلفية البطاقة</label><div class="sws">' +
      PAL.map(function (x, j) { return '<span class="swc' + (j == pal ? ' on' : '') + '" data-pal="' + j + '" style="background:' + x[1] + '"></span>'; }).join('') +
      '</div>' +
      '<label class="ck"><input type="checkbox" id="fa"' + (p[7] ? '' : ' checked') + '> متوفر وظاهر للعملاء</label>' +
      '<div class="r2" style="margin-top:16px"><button class="btn btn-success btn-lg" id="eok" type="button">💾 حفظ الصنف</button>' +
      (i >= 0 ? '<button class="btn btn-danger btn-lg" id="edl" type="button">🗑 حذف</button>' : '') +
      '</div>' +
      (i >= 0 ? '<button class="btn" id="edup" type="button" style="width:100%;margin-top:8px">📋 تكرار الصنف كنسخة جديدة</button>' : '') +
      '</div>';
    $('ov').classList.add('on');
    renderFl();
    if (i < 0) {
      setTimeout(function () {
        var f = $(sp ? 'fp' : 'fn');
        if (f) { f.focus(); if (sp) f.select(); }
      }, 50);
    }
    return true;
  }

  function openEd(i, c, dup) {
    var cur = admCurrentSnap || normalizeAdminSnap({ tab: tab });
    var mode = cur.ov ? 'replace' : 'push';
    commitAdminRoute(
      {
        ov: 'prod',
        ovIdx: dup ? -1 : i,
        ovCat: c || '',
        ovDupFrom: dup ? i : -1,
        ovUid: '',
        drawer: false,
      },
      { mode: mode, forceOverlay: true }
    );
  }

  // ===== OFFER EDITOR MODAL (Schedule + Auto Discount + Linked Product + Live Preview) =====
  function updateOfferLivePreview() {
    var box = $('ofPreviewCard');
    if (!box) return;
    var t = $('ot') ? $('ot').value.trim() : '';
    var d = $('od') ? $('od').value.trim() : '';
    var pr = $('op') ? $('op').value.trim() : '';
    var g = $('og') ? $('og').value.trim() : '';
    var pb = +($('ofPb') ? $('ofPb').value : 0) || 0;
    var pa = +($('ofPa') ? $('ofPa').value : 0) || 0;
    var pct = pb > pa && pa > 0 ? Math.round(((pb - pa) / pb) * 100) : 0;
    if ($('ofDiscLbl')) $('ofDiscLbl').textContent = pct ? 'نسبة الخصم المحسوبة: ' + pct + '%' : 'أدخل السعر قبل وبعد لحساب نسبة الخصم تلقائياً';
    box.style.background = PAL[pal][1];
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<b style="font-size:16px;color:#111">' + esc(t || 'عنوان العرض') + '</b>' +
      (g || pct ? '<span style="background:#111;color:#fff;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700">' + esc(g || ('خصم ' + pct + '%')) + '</span>' : '') +
      '</div>' +
      '<p style="margin:4px 0 6px;font-size:12.5px;color:#222">' + esc(d || 'وصف العرض سيظهر للعميل هنا') + '</p>' +
      '<b style="font-size:15px;color:#b3201a">' + esc(pr || (pa ? pa + ' جنيه' : 'السعر / الميزة')) + '</b>';
  }

  function renderOfModalDom(i) {
    if (i >= 0 && !OFS()[i]) return false;
    oei = i;
    var o = i >= 0 ? OFS()[i] : { t: '', d: '', pr: '', g: '', c: PAL[0][1], i: '', x: 0, startDate: '', endDate: '', priceBefore: '', priceAfter: '', productIndex: '' };
    pal = 0;
    PAL.forEach(function (x, j) { if (x[1] == o.c) pal = j; });
    eimg = o.i || '';
    enew = '';
    $('ov').innerHTML =
      '<div class="pn"><h2>' +
      (i >= 0 ? 'تعديل العرض' : 'إضافة عرض جديد') +
      '<button class="x" type="button" id="ofx">✕</button></h2>' +
      '<div id="ofPreviewCard" style="border-radius:14px;padding:12px 14px;margin-bottom:12px;border:1px solid rgba(0,0,0,.1)"></div>' +
      '<label>صورة العرض (اختياري)</label><div class="ip"><div class="ipv" id="ipv">' +
      (eimg && IMG[eimg] ? '<img src="' + IMG[eimg] + '" alt="">' : '🎁') +
      '</div><div class="btns"><label class="btn btn-primary btn-sm" style="margin:0;cursor:pointer">📷 اختيار صورة<input type="file" id="of" accept="image/*" hidden></label><button class="btn btn-danger btn-sm" id="ofirm" type="button">إزالة الصورة</button></div></div>' +
      '<label>عنوان العرض</label><input id="ot" value="' + esc(o.t) + '" placeholder="مثال: عرض الشيبسي العائلي">' +
      '<label>الوصف</label><input id="od" value="' + esc(o.d) + '" placeholder="مثال: اشتري ١٠ كراتين وخد كرتونة هدية">' +
      '<div class="r2"><div><label>نص السعر أو الميزة</label><input id="op" value="' + esc(o.pr) + '" placeholder="مثال: ١٨٠ جنيه"></div><div><label>شارة العرض</label><input id="og" value="' + esc(o.g) + '" placeholder="مثال: عرض محدود"></div></div>' +
      '<div class="r2"><div><label>السعر قبل الخصم (اختياري)</label><input id="ofPb" type="number" inputmode="numeric" value="' + esc(o.priceBefore || '') + '"></div><div><label>السعر بعد الخصم (اختياري)</label><input id="ofPa" type="number" inputmode="numeric" value="' + esc(o.priceAfter || '') + '"></div></div>' +
      '<p class="hint" id="ofDiscLbl"></p>' +
      '<div class="r2"><div><label>تاريخ البداية (اختياري)</label><input id="ofStart" type="date" value="' + esc(o.startDate || '') + '"></div><div><label>تاريخ الانتهاء (اختياري)</label><input id="ofEnd" type="date" value="' + esc(o.endDate || '') + '"></div></div>' +
      '<label>ربط بصنف معين (اختياري)</label><select id="ofProd"><option value="">— بدون ربط بصنف محدد —</option>' +
      D.p.map(function (p, idx) {
        return '<option value="' + idx + '"' + (String(o.productIndex) === String(idx) ? ' selected' : '') + '>' + esc(p[0] + (p[10] ? ' · ' + p[10] : '') + ' (' + p[1] + ')') + '</option>';
      }).join('') +
      '</select>' +
      '<label>لون بطاقة العرض</label><div class="sws">' +
      PAL.map(function (x, j) { return '<span class="swc' + (j == pal ? ' on' : '') + '" data-pal="' + j + '" style="background:' + x[1] + '"></span>'; }).join('') +
      '</div>' +
      '<label class="ck"><input type="checkbox" id="oa"' + (o.x ? '' : ' checked') + '> العرض ظاهر للعملاء</label>' +
      '<div class="r2" style="margin-top:16px"><button class="btn btn-success btn-lg" id="ofok" type="button">💾 حفظ العرض</button>' +
      (i >= 0 ? '<button class="btn btn-danger btn-lg" id="ofdl" type="button">🗑 حذف العرض</button>' : '') +
      '</div></div>';
    $('ov').classList.add('on');
    updateOfferLivePreview();
    return true;
  }

  function openOf(i) {
    commitAdminRoute(
      {
        ov: 'offer',
        ovIdx: i,
        ovCat: '',
        ovDupFrom: -1,
        ovUid: '',
        drawer: false,
      },
      { mode: admCurrentSnap && admCurrentSnap.ov ? 'replace' : 'push', forceOverlay: true }
    );
  }

  // ===== RAHAL AI & VOICE COPILOT (Preserved Core + Safe Server Key) =====
  var SM = [];
  var SMT = '';
  function nd(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  }
  var KW = '(?:في|فيه|وفيه|عنده|بسعر|سعره|سعرها|سعر|النكهات|نكهات|الطعوم|طعوم|الطعم|طعم|نكهة|عبوة|العبوة|الحجم|قسم|القسم|بدل|قبل)';
  function sfl(v) {
    var rawStr = String(v || '');
    var hasPunct = /[,،؛;\n\/|]/.test(rawStr);
    var isOnlyCompound = /^\s*(?:ملح\s+و\s*خل|خل\s+و\s*ملح)\s*$/i.test(rawStr);
    var src = (hasPunct || isOnlyCompound)
      ? rawStr.replace(/ملح\s+و\s*خل/g, 'ملح_وخل').replace(/خل\s+و\s*ملح/g, 'خل_وملح')
      : rawStr;
    var r = [], seen = {};
    src.split(/[,،؛;\n\/|]+|\s+و(?=\S)/).forEach(function (x) {
      var y = x
        .replace(/ملح_وخل/g, 'ملح وخل')
        .replace(/خل_وملح/g, 'خل وملح')
        .replace(/^(?:وطعم|طعم|نكهة|نكهه)\s+/, '')
        .trim()
        .replace(/[.\u061B]+$/, '');
      if (y && !seen[y]) { seen[y] = 1; r.push(y); }
    });
    return r;
  }
  function mc(cn) {
    if (D.cats.indexOf(cn) > -1) return cn;
    var f = D.cats.filter(function (c) { return c.indexOf(cn) > -1 || cn.indexOf(c) > -1; });
    return f.length ? f[0] : snap(cn, D.cats);
  }
  function inferProdEmoji(nStr, cStr) {
    var ref = an(String(nStr || '') + ' ' + String(cStr || ''));
    if (ref.indexOf('دوريتوس') > -1) return '🔺';
    if (ref.indexOf('شيبسي') > -1 || ref.indexOf('بطاطس') > -1) return '🥔';
    if (ref.indexOf('فشار') > -1 || ref.indexOf('ذره') > -1) return '🍿';
    if (ref.indexOf('عصير') > -1 || ref.indexOf('مشروب') > -1 || ref.indexOf('بيبسي') > -1 || ref.indexOf('كولا') > -1) return '🧃';
    if (ref.indexOf('شوكولات') > -1 || ref.indexOf('فريسكا') > -1) return '🍫';
    if (ref.indexOf('مولتو') > -1 || ref.indexOf('كرواسون') > -1) return '🥐';
    if (ref.indexOf('بسكويت') > -1 || ref.indexOf('ويفر') > -1) return '🍪';
    if (ref.indexOf('لب') > -1 || ref.indexOf('سوداني') > -1) return '🥜';
    return '🥔';
  }
  function lpb(s) {
    var o = { n: '', c: '', d: '', p: 0, o: 0, v: '', e: '', f: [], on: 1 }, m;
    s = s.replace(/^(?:انا |أنا )?(?:عندي|ضيفلي|ضيف|أضف|اضف|اضافة|إضافة)\s+(?:منتج\s+|صنف\s+)?/, '');
    if ((m = s.match(/(?:بدل(?:\s+من)?|قبل الخصم|السعر القديم|كان بـ?)\s*:?\s*(\d+(?:\.\d+)?)(?:\s*(?:جنيه|جنية|ج))?/))) { o.o = +m[1]; s = s.replace(m[0], ' '); }
    if ((m = s.match(/(?:النكهات|نكهات|الطعوم|طعوم|الأطعمة|الاطعمة|الطعم|طعم|نكهة|نكهه)\s*(?:هي|هم|كالتالي)?\s*:?\s*(.+?)(?=[\s,،]*(?:(?:في\s+)?(?:القسم|قسم)|العبوة|عبوة|الحجم|النوع|بسعر|سعره|سعرها|سعر|الكرتونة|كرتونة|الكرتونه|كرتونه|دستة|شوال)(?:[\s:،,]|$)|$)/))) {
      o.f = sfl(/[,،؛;\/|\n]/.test(m[1]) ? m[1] : m[1].replace(/\s+و(?=\S)/g, '،'));
      s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/(?:في\s+)?(?:القسم|قسم)\s*:?\s*([^,،\n]+?)(?=\s+(?:العبوة|عبوة|الحجم|النوع|النكهات|نكهات|بسعر|سعر|الكرتونة|كرتونة|دستة|شوال)(?:[\s:،,]|$)|[,،\n]|$)/))) {
      o.c = mc(m[1].replace(/\s*(?:جنيه|جنية|ج)\s*$/g, '').trim());
      s = s.replace(m[0], ' ');
    } else {
      var cf = D.cats.filter(function (c) { return s.indexOf(c) > -1; });
      if (cf.length == 1) o.c = cf[0];
    }
    if ((m = s.match(/(?:العبوة|عبوة|الوصف)\s*:?\s*([^,،\n]+?)(?=\s+(?:قسم|القسم|الطعم|طعم|نكهات|النكهات|الحجم|بسعر|سعر)(?:[\s:،,]|$)|[,،\n]|$)/))) {
      o.d = m[1].trim(); s = s.replace(m[0], ' ');
    } else if ((m = s.match(/(?:ال)?(?:كرتونة|كرتونه|دستة|شوال|علبة|باكو)\s*\d+\s*(?:كيس|علبة|قطعة|حبة|باكو|زجاجة|عبوة)?/))) {
      o.d = m[0].trim(); s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/(?:^|[\s,،])(?:بسعر|السعر|سعره|سعرها|سعر|بـ|ب)\s*:?\s*(\d+(?:\.\d+)?)(?:\s*(?:جنيه|جنية|ج|egp))?(?=[\s,،.]|$)/i))) {
      o.p = +m[1]; s = s.replace(m[0], ' ');
    } else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|جنية|ج|egp)(?=[\s,،.]|$)/i))) {
      o.p = +m[1]; s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/(?:الحجم|النوع|حجم|نوع)\s*:?\s*([^,،\n]+?)(?=\s+(?:القسم|قسم|العبوة|عبوة|النكهات|نكهات|بسعر|سعر)(?:[\s:،,]|$)|[,،\n]|$)/))) {
      o.v = m[1].trim(); s = s.replace(m[0], ' ');
    }
    s = s.replace(/[,،:؛;]+/g, ' ').replace(/\s(?:جنيه|جنية|ج|وعنده|وفيه|عنده|فيه)(?=\s|$)/g, ' ').replace(/\d+\s*(?:طعم|نكهة|نكهات|اطعمة|أطعمة|طعوم)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < 2; i++) s = s.replace(/^(?:الصنف|صنف|اسم الصنف|اسمه|اسمها|اسم)\s*(?:هو|هي)?\s*:?\s*/, '');
    var cut = s.search(new RegExp('\\s+' + KW + '(?:\\s|:|$)|[,،:\\n]'));
    o.n = (cut > 0 ? s.slice(0, cut) : s).trim();
    o.e = inferProdEmoji(o.n, o.c);
    return o.n ? o : null;
  }
  function lp(text) {
    var E = eng();
    if (E && typeof E.parseAdminLocalTurn === 'function') {
      var res = E.parseAdminLocalTurn({ text: text, catalogData: D, currentDraft: [] });
      if (res && Array.isArray(res.draft) && res.draft.length) return res.draft;
    }
    var t = nd(text).replace(/\r/g, ''), bl = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n'), out = [];
    bl.forEach(function (b) { b = b.replace(/\s+/g, ' ').trim(); if (b.length >= 2) { var r = lpb(b); if (r) out.push(r); } });
    return out;
  }
  function nz(x) {
    var n = String(x.name || '').trim(), c = String(x.category || '').trim();
    return { n: n, c: c, d: String(x.pack || '').trim(), p: +x.price || 0, o: +x.oldPrice || 0, v: String(x.variant || '').trim(), e: String(x.emoji || '').trim() || inferProdEmoji(n, c), f: sfl((x.flavors || []).map(function (f) { return String(f).trim(); }).join('،')), on: 1, im: '' };
  }
  function an(s) {
    return nd(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\u0621-\u064Aa-zA-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function lev(a, b) {
    if (a == b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    var p = [], q2, i, j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { q2 = [i]; for (j = 1; j <= b.length; j++) q2[j] = Math.min(p[j] + 1, q2[j - 1] + 1, p[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)); p = q2; }
    return p[b.length];
  }
  function snap(v, pool) {
    var a = an(v); if (!a) return v;
    var best = null, bd = 9, i, b, d;
    for (i = 0; i < pool.length; i++) { b = an(pool[i]); if (b == a) return pool[i]; if (a.length >= 5 && b.length >= 5) { d = lev(a, b); if (d < bd) { bd = d; best = pool[i]; } } }
    return bd <= 1 ? best : v;
  }
  function nums(s) { return (nd(s).match(/\d+(?:\.\d+)?/g) || []).map(Number).sort(function (a, b) { return a - b; }); }
  function nsame(a, b) { var x = nums(a), y = nums(b); return x.length == y.length && x.every(function (v, i) { return v == y[i]; }); }
  function fixList(list, tx) {
    var T = an(tx), N = nums(tx), names = [], fl = [], m = {}, out = [];
    D.p.forEach(function (p) { if (p[0] && names.indexOf(p[0]) < 0) names.push(p[0]); (p[9] || []).forEach(function (f) { var n = Array.isArray(f) ? f[0] : f; if (n && fl.indexOf(n) < 0) fl.push(n); }); });
    list.forEach(function (o) {
      o.w = [];
      var n0 = o.n.trim(); o.n = snap(n0, names);
      if (o.n != n0) o.w.push('✏️ الاسم اتظبط: ' + n0 + ' ← ' + o.n);
      var seen = {}, fs = [];
      o.f.forEach(function (f) { var g = snap(String(f).replace(/^(?:طعم|نكهة|نكهه)\s+/, '').trim(), fl), k = an(g); if (!k || seen[k]) return; seen[k] = 1; fs.push(g); });
      o.f = fs;
      var k2 = an(o.n) + '|' + an(o.v), g2 = m[k2];
      if (g2 && (!o.p || !g2.p || o.p == g2.p)) {
        var sn = {}; g2.f.forEach(function (f) { sn[an(f)] = 1; });
        o.f.forEach(function (f) { if (!sn[an(f)]) g2.f.push(f); });
        g2.p = g2.p || o.p; g2.o = g2.o || o.o; g2.d = g2.d || o.d; g2.e = g2.e || o.e;
        g2.w.push('اتدمج أكتر من سطر لنفس الصنف');
        return;
      }
      m[k2] = o; out.push(o);
    });
    out.forEach(function (o) {
      var miss = o.f.filter(function (f) { var k = an(f); return T.indexOf(k) < 0 && !k.split(' ').some(function (w) { return w.length > 2 && T.indexOf(w) > -1; }); });
      if (miss.length) o.w.push('نكهات مش واضحة في الكلام: ' + miss.join('، '));
      if (!(o.p > 0)) o.w.push('مفيش سعر، اكتبه');
      else if (N.indexOf(o.p) < 0) o.w.push('السعر ' + o.p + ' مش مكتوب بالأرقام في الكلام، تأكد منه');
      if (o.o && o.p && o.o <= o.p) o.w.push('السعر القديم مش أكبر من الجديد، هيتتجاهل');
      if (o.n && T.indexOf(an(o.n)) < 0 && !an(o.n).split(' ').some(function (w) { return w.length > 2 && T.indexOf(w) > -1; })) o.w.push('اسم الصنف مش مكتوب كده في الكلام، راجعه');
    });
    return out;
  }
  function eng() {
    return window.__ABU_AI_ENGINE__ || null;
  }

  var ADMIN_CHAT_SYS = [
    'أنت مساعد ذكي لتاجر جملة مصري يتحدث بالعامية المصرية ويدير كتالوج متجر أبو سعيد. ردودك قصيرة وودودة (سطرين بالكتير) وتسأل سؤالاً واحداً فقط في المرة.',
    'القاعدة الذهبية: لا تغيّر أو تحذف أو تعدّل أي صنف غير موجود في الكتالوج، ولا تخترع أسعاراً أو نكهات أو عبوات.',
    'مهم جداً: إذا ذكر التاجر صنفاً واحداً وله أكثر من نكهة مفصولة بـ «و» أو فاصلة (مثل «دوريتوس عنده نكهات ملح وخل وشطة»)، فهذا صنف واحد فقط تُجمع كل نكهاته داخل flavors، ولا تنشئ صنفاً منفصلاً لكل نكهة.',
    'إذا ذُكر للصنف أكثر من حجم أو نوع بأسعار مختلفة، أنشئ عنصراً منفصلاً لكل حجم بنفس name وضع الحجم أو النوع في variant.',
    'اسأل عن الناقص بالترتيب: السعر أولاً (اجعل price: 0 ولا تخترع سعراً)، ثم القسم، ثم العبوة والنكهات مرة واحدة فقط.',
    'إذا تشابه الصنف الجديد مع صنف موجود في الكتالوج نبّه التاجر في reply، وإذا تشابه أكثر من صنف عند التعديل أو الحذف اترك ops فارغة واسأله أيهم يقصد.',
    'أعد الرد JSON فقط وفق المخطط المحدد.',
  ].join('\n');

  var ADMIN_BATCH_SYS = [
    'أنت مساعد لإدخال بيانات أصناف متجر جملة مصري. حوّل النص التالي إلى JSON فقط (من غير أي كلام إضافي) بالشكل: {"products":[{"name":"","category":"","pack":"","price":0,"oldPrice":0,"variant":"","emoji":"","flavors":[""]}]}.',
    'القواعد:',
    '- name هو اسم الصنف فقط (مثل دوريتوس، شيبسي، مولتو).',
    '- category يجب أن يطابق أحد الأقسام الحالية بالضبط إن ناسب، وإلا اقترح اسم قسم قصير.',
    '- pack العبوة أو الوصف (مثل الكرتونة 24 كيس) واتركه فارغاً لو لم يُذكر. oldPrice السعر قبل الخصم أو 0.',
    '- مهم جداً: إذا كان الكلام عن صنف واحد وبعده عدة نكهات مفصولة بـ «و» أو فاصلة (مثل «ضيف دوريتوس عنده نكهات ملح وخل وشطة»)، فهذا صنف واحد فقط؛ ضع كل النكهات في flavors ولا تنشئ عنصراً لكل نكهة.',
    '- إذا كان للصنف أحجام أو أنواع متعددة بأسعار مختلفة أنشئ عنصراً منفصلاً لكل حجم بنفس name مع وضع الحجم في variant.',
    '- انسخ الأسعار والأرقام كما وردت تماماً دون تقريب أو حساب، وإذا لم يُذكر السعر اجعل price: 0.',
    '- emoji إيموجي واحد مناسب للصنف. صحح الإملاء البسيط في الاسم والنكهات دون تبديل الكلمات.',
    'مثال: «ضيف دوريتوس في قسم الشيبسي، الكرتونة 24 كيس، سعرها 260 جنيه، وعنده نكهات ملح وخل وشطة» -> {"products":[{"name":"دوريتوس","category":"شيبسي","pack":"الكرتونة 24 كيس","price":260,"oldPrice":0,"variant":"","emoji":"🔺","flavors":["ملح","خل","شطة"]}]}.',
  ].join('\n');

  function aiPrompt(text) {
    return (
      'حوّل النص التالي إلى JSON فقط:\n' +
      'الأقسام الحالية: ' + JSON.stringify(D.cats) + '\n' +
      'الأصناف الحالية (للرجوع إلى الأسماء الدقيقة فقط): ' +
      JSON.stringify(D.p.map(function (p) { return p[0] + (p[10] ? ' · ' + p[10] : ''); })) +
      '\nالنص:\n' + text
    );
  }

  async function askGemini(key, prompt, opts) {
    opts = opts || {};
    var pref = '';
    try { pref = localStorage.getItem('abu_gm') || ''; } catch (e) {}
    var res = await fetch('/api/admin/ai/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        apiKey: key || undefined,
        audioBase64: opts.audioBase64 || undefined,
        preferredModel: pref,
        schemaType: opts.schemaType || undefined,
        systemInstruction: opts.systemInstruction || undefined,
        taskType: opts.taskType || 'admin_chat',
        temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2,
      }),
    });
    if (res.status === 401) { handleAdminUnauthorized(); throw new Error('UNAUTH'); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'NOMODEL');
    if (data.model) { try { localStorage.setItem('abu_gm', data.model); } catch (e) {} }
    if (opts.returnObject) {
      return { text: data.text || '', structured: data.structured || null, model: data.model || '' };
    }
    return data.text || '';
  }

  var VSR = window.SpeechRecognition || window.webkitSpeechRecognition, VR = null, VON = false, VPOL = false, VERR = 0, VWL = null;
  var VENG = '', VST = null, VSID = 0, VSL = [], VPEND = 0, VBASE = '', VAIERR = 0, VGP = false;
  function vfix(s) {
    return nd(s)
      .replace(/\s*(?:سطر جديد|سطر تاني|سطر تانيه|السطر الجديد|صنف جديد|صنف تاني|صنف تانيه)\s*/g, '\n')
      .replace(/\s*(?:فاصلة|فاصله)\s*/g, '، ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ *\n */g, '\n');
  }
  function vUI(on) {
    var b = $('smmic'), l = $('smvl');
    if (b) b.classList.toggle('rec', on);
    if (l) l.textContent = on ? 'بسمعك... اضغط للإيقاف' : 'اكتب بالصوت';
    try {
      if (on && navigator.wakeLock && !VWL) {
        navigator.wakeLock.request('screen').then(function (x) { VWL = x; x.addEventListener('release', function () { VWL = null; }); }).catch(function () {});
      } else if (!on && VWL) { VWL.release(); VWL = null; }
    } catch (e) {}
  }
  function vBeep(ac) {
    try {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.14);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.16);
    } catch (z) {}
  }
  function vWav(f, sr) {
    var ra = sr / 16000, n = Math.floor(f.length / ra), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i, j;
    function ws(o, t) { for (var q = 0; q < t.length; q++) v.setUint8(o + q, t.charCodeAt(q)); }
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) {
      var a = 0, c = 0, st = Math.floor(i * ra), en = Math.min(f.length, Math.floor((i + 1) * ra));
      for (j = st; j < en; j++) { a += f[j]; c++; }
      var x = c ? a / c : 0; x = Math.max(-1, Math.min(1, x));
      v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
    }
    var u = new Uint8Array(buf), b = '', k;
    for (k = 0; k < u.length; k += 8192) b += String.fromCharCode.apply(null, u.subarray(k, k + 8192));
    return btoa(b);
  }
  async function gAud(key, b64) {
    var nm = D.p.slice(0, 100).map(function (p) { return p[0]; }).filter(Boolean);
    var pr = 'اكتب بالظبط الكلام المنطوق في المقطع الصوتي ده (بالعامية المصرية، وموضوعه أصناف ونكهات وأسعار متجر جملة) بإملاء صحيح. الأرقام بالإنجليزية. ماتضيفش أي شرح أو علامات اقتباس ولا تترجم. لو مفيش كلام مفهوم ارجع نص فاضي. أسماء أصناف موجودة للاسترشاد في الإملاء: ' + JSON.stringify(nm) + ' والأقسام: ' + JSON.stringify(D.cats);
    var txt = await askGemini(key, pr, { audioBase64: b64, taskType: 'voice_raw', temperature: 0 });
    return String(txt || '').trim().replace(/^["«»“”]+|["«»“”]+$/g, '').trim();
  }
  function vAIrender() {
    var t = $('smt'); if (!t) return;
    t.value = VBASE + vfix(VSL.map(function (x) { return x == null ? '…' : x; }).filter(function (x) { return x !== ''; }).join(' '));
    t.scrollTop = t.scrollHeight; SMT = t.value;
  }
  function vRelease() {
    var s = VST; VST = null; if (!s) return;
    try { s.pr.onaudioprocess = null; s.pr.disconnect(); } catch (z) {}
    try { s.src.disconnect(); } catch (z) {}
    try { s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (z) {}
    try { s.ac.close(); } catch (z) {}
  }
  function vAIfail(err) {
    var m = err && err.message; VAIERR++;
    if (m === 'KEY' || m === 'LIMIT' || m === 'NOMODEL' || VAIERR >= 3) {
      if (VST && !VST.stopping) {
        var was = VON; vRelease(); VENG = 'sr';
        toast(m === 'LIMIT' ? 'حصة الذكاء الاصطناعي خلصت، هكمل بتعرف المتصفح' : m === 'KEY' ? 'مفتاح الـ API غير مضبوط، هكمل بتعرف المتصفح' : 'الذكاء الاصطناعي مش متاح دلوقتي، هكمل بتعرف المتصفح');
        if (was && VSR) { VON = true; vRun(); } else { VON = false; vUI(false); }
      }
    }
  }
  function vSend(f, sr, key, sid) {
    var idx = VSL.length; VSL.push(null); VPEND++; vAIrender();
    var b64;
    try { b64 = vWav(f, sr); } catch (z) { VSL[idx] = ''; VPEND--; return; }
    gAud(key, b64)
      .then(function (t) { if (sid !== VSID) return; VSL[idx] = t; VAIERR = 0; })
      .catch(function (e) { if (sid !== VSID) return; VSL[idx] = ''; vAIfail(e); })
      .then(function () { VPEND--; if (sid === VSID) vAIrender(); });
  }
  async function vAI(key) {
    var sid = ++VSID, ta = $('smt'); if (!ta) return;
    VBASE = ta.value; if (VBASE && !/\s$/.test(VBASE)) VBASE += ' ';
    VSL = []; VPEND = 0; VAIERR = 0;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      var stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      var ac = new AC();
      if (ac.state === 'suspended') await ac.resume();
      if (sid !== VSID || !VON) { stream.getTracks().forEach(function (t) { t.stop(); }); try { ac.close(); } catch (z) {} return; }
      vBeep(ac);
      var src = ac.createMediaStreamSource(stream), pr = ac.createScriptProcessor(4096, 1, 1), sr = ac.sampleRate;
      var S = { ac: ac, src: src, pr: pr, stream: stream, seg: [], pre: [], len: 0, speaking: false, silent: 0, noise: 0.004, t0: ac.currentTime + 0.3, stopping: false, key: key, sid: sid, sr: sr };
      VST = S;
      S.flush = function () {
        var tot = S.len, sp = S.speaking, arr = S.seg;
        S.seg = []; S.len = 0; S.speaking = false; S.silent = 0;
        if (!sp || tot < sr * 0.4) return;
        var f = new Float32Array(tot), o = 0;
        arr.forEach(function (c) { f.set(c, o); o += c.length; });
        vSend(f, sr, key, sid);
      };
      pr.onaudioprocess = function (e) {
        if (!VST || VST !== S || S.stopping) return;
        if (ac.currentTime < S.t0) return;
        var d = e.inputBuffer.getChannelData(0), c = new Float32Array(d.length); c.set(d);
        var sum = 0, i; for (i = 0; i < c.length; i++) sum += c[i] * c[i];
        var rms = Math.sqrt(sum / c.length), thr = Math.max(0.012, S.noise * 3);
        if (rms > thr) {
          if (!S.speaking) { S.speaking = true; S.seg = S.pre.slice(); S.len = 0; S.seg.forEach(function (x) { S.len += x.length; }); }
          S.silent = 0; S.seg.push(c); S.len += c.length;
        } else {
          S.noise = S.noise * 0.95 + rms * 0.05;
          if (S.speaking) { S.seg.push(c); S.len += c.length; S.silent += c.length; if (S.silent > sr * 0.8) S.flush(); }
          else { S.pre.push(c); if (S.pre.length > 3) S.pre.shift(); }
        }
        if (S.speaking && S.len > sr * 12) S.flush();
      };
      src.connect(pr); pr.connect(ac.destination);
    } catch (x) {
      VON = false; vUI(false);
      toast(x && (x.name === 'NotAllowedError' || x.name === 'SecurityError') ? 'اسمح للمايك من إعدادات المتصفح' : 'تعذر تشغيل الميكروفون');
    }
  }
  function vStopAI(graceful) {
    var S = VST;
    if (!graceful) { VSID++; VON = false; vRelease(); vUI(false); return; }
    if (!S) { VON = false; vUI(false); return; }
    S.stopping = true; S.flush(); VON = false; vRelease();
    var sid = S.sid, n = 0;
    var iv = setInterval(function () {
      n++;
      if (VPEND <= 0 || n > 200 || sid !== VSID) {
        clearInterval(iv);
        if (sid === VSID) { vAIrender(); vUI(false); vPolish(); }
        else vUI(false);
      }
    }, 100);
  }
  async function vPolish() {
    var ta = $('smt'), ke = $('smk'), er = $('sme');
    if (!ta) return;
    var key = (ke && ke.value.trim()) || '';
    var hasKey = Boolean(key || (D.cfg && (D.cfg.hasGk || D.cfg.gkFromEnv)));
    if (!hasKey || (D.cfg && D.cfg.aiMode === 'local')) return;
    var tx = ta.value.trim(); if (!tx) return;
    SMT = ta.value;
    VPOL = true;
    var l = $('smvl'); if (l) l.textContent = '✨ بظبط الكتابة...';
    if (er) { er.style.color = 'var(--mu)'; er.textContent = '✨ بظبط الكتابة...'; }
    try {
      var names = D.p.slice(0, 150).map(function (p) { return p[0]; }).filter(Boolean);
      var pr = 'ده نص اتكتب بالإملاء الصوتي (بالعامية المصرية) لوصف أصناف متجر جملة. صحّح الأخطاء الإملائية وأخطاء التعرف على الصوت وحط علامات الترقيم الصح، من غير ما تغيّر المعنى. القواعد:\n- ماتغيّرش أي رقم أو سعر أو كمية، وحوّل الأرقام العربية لأرقام إنجليزية.\n- ماتضيفش ولا تحذف أصناف أو نكهات أو معلومات.\n- ماتقسمش الصنف الواحد: لو ذكر صنف واحد وله أكتر من طعم أو نكهة (زي «دوريتوس عنده طعم جبنة وكباب وملح وشطة») سيبه في سطر واحد وماتكررش اسم الصنف مع كل طعم. السطر الجديد بس لصنف تاني مختلف.\n- ماتزودش عدد الأسطر عن اللي في النص الأصلي.\n- اكتب أسماء الأصناف والنكهات بشكلها الصح، وده أسماء أصناف موجودة عندنا للاسترشاد: ' + JSON.stringify(names) + '\n- الأقسام الموجودة: ' + JSON.stringify(D.cats) + '\nأرجع JSON فقط بالشكل {"text":""}\nالنص:\n' + tx;
      var resObj = await askGemini(key, pr, { schemaType: 'voice_polish', taskType: 'voice_polish', temperature: 0, returnObject: true });
      var j = resObj.structured || JSON.parse(String(resObj.text || '{}').replace(/```json|```/g, '').trim());
      var out = String(j.text || '').trim();
      var ta2 = $('smt');
      var nl = function (x) { return x.split(/\n+/).filter(function (q) { return q.trim(); }).length; };
      if (ta2 && out && out.length > tx.length * 0.5 && out.length < tx.length * 2 && nl(out) <= nl(tx) && ta2.value.trim() === tx && nsame(out, tx)) {
        ta2.value = out; SMT = out;
      }
      if ($('sme')) { $('sme').style.color = 'var(--mu)'; $('sme').textContent = '✅ الكتابة اتظبطت'; }
    } catch (x) {
      if ($('sme')) { $('sme').style.color = ''; $('sme').textContent = ''; }
    }
    VPOL = false;
    var l2 = $('smvl'); if (l2 && !VON && !VST && !VR) l2.textContent = 'اكتب بالصوت';
  }
  function vRun() {
    var ta = $('smt'); if (!VON || !ta) return;
    var base = ta.value; if (base && !/\s$/.test(base)) base += ' ';
    var r = new VSR(); VR = r; r.lang = 'ar-EG'; r.interimResults = true; r.continuous = true;
    r.onresult = function (e) {
      VERR = 0; var t2 = $('smt'); if (!t2) return;
      var fin = [], im = '';
      for (var i = 0; i < e.results.length; i++) {
        var rr = e.results[i], t = rr[0].transcript.trim(); if (!t) continue;
        if (rr.isFinal) {
          var lf = fin.length ? fin[fin.length - 1] : '';
          if (lf && t.indexOf(lf) > -1) fin[fin.length - 1] = t;
          else if (!(lf && lf.indexOf(t) > -1)) fin.push(t);
        } else im = t;
      }
      var lf2 = fin.length ? fin[fin.length - 1] : '';
      if (lf2 && im.indexOf(lf2) === 0) im = im.slice(lf2.length).trim();
      else if (lf2 && im.length > 3 && lf2.indexOf(im) > -1) im = '';
      t2.value = base + vfix(fin.join(' ') + (im ? ' ' + im : ''));
      t2.scrollTop = t2.scrollHeight; SMT = t2.value;
    };
    r.onerror = function (e) { if (e.error == 'not-allowed' || e.error == 'service-not-allowed') { VON = false; toast('اسمح للمايك من المتصفح'); } else if (e.error == 'network' || e.error == 'audio-capture') VERR++; };
    r.onend = function () {
      if (VR === r) VR = null;
      if (VON) { if (VERR > 20) { VON = false; vUI(false); return; } setTimeout(vRun, VERR ? 600 : 120); return; }
      vUI(false);
      if (VGP) { VGP = false; vPolish(); }
    };
    try { r.start(); } catch (e) {
      VR = null;
      if (VON) {
        VERR++;
        if (VERR > 20) { VON = false; vUI(false); }
        else setTimeout(vRun, 400);
      }
    }
  }
  function vCanAI() {
    var key = $('smk') ? $('smk').value.trim() : '';
    var hasKey = Boolean(key || (D.cfg && (D.cfg.hasGk || D.cfg.gkFromEnv)));
    var AC = window.AudioContext || window.webkitAudioContext;
    return Boolean(hasKey && !(D.cfg && D.cfg.aiMode === 'local') && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AC && window.btoa);
  }
  function vStart() {
    if (VON || VR || VST || VPOL) return;
    var canAI = vCanAI();
    if (!canAI && !VSR) return toast('المتصفح لا يدعم الإملاء الصوتي، جرّب Chrome');
    VON = true; VGP = false; VERR = 0; vUI(true);
    if (canAI) { VENG = 'ai'; vAI($('smk') ? $('smk').value.trim() : ''); }
    else { VENG = 'sr'; vRun(); }
  }
  function vStop(polish) {
    if (VENG === 'ai' && (VST || VON)) { vStopAI(!!polish); return; }
    if (!polish) VSID++;
    var was = VON || !!VR; VGP = !!polish && was; VON = false;
    if (VR) { try { VR.stop(); } catch (e) { VR = null; vUI(false); if (VGP) { VGP = false; vPolish(); } } }
    else { vUI(false); if (VGP) { VGP = false; vPolish(); } }
  }

  function getAdminAiUiMode() {
    var raw = String((D && D.cfg && D.cfg.adminAiUi) || 'chat').trim();
    return ['chat', 'batch', 'chat_only', 'batch_only'].indexOf(raw) > -1 ? raw : 'chat';
  }
  function isAdminAiSwitchAllowed() {
    var ui = getAdminAiUiMode();
    return ui !== 'chat_only' && ui !== 'batch_only';
  }
  function openAdminAiByPreference(initialPrompt) {
    var ui = getAdminAiUiMode();
    if (ui === 'batch' || ui === 'batch_only') {
      if (initialPrompt) SMT = initialPrompt;
      smOpen();
    } else {
      chOpen(initialPrompt);
    }
  }

  function renderSmInModalDom(t) {
    vStop(); CHF = false;
    var swHtml = isAdminAiSwitchAllowed()
      ? '<button class="btn btn-sm" id="smtochat" type="button" style="margin-top:8px">💬 التبديل للمحادثة التفاعلية</button>'
      : '';
    $('ov').innerHTML =
      '<div class="pn"><h2>✍️ ' + esc(AN()) + ' — كتابة مرة واحدة<button class="x" type="button" id="smx">✕</button></h2>' +
      '<p class="hint">اكتب أو الصق وصف الأصناف كما تتحدث، وستراجع النتيجة قبل الإضافة.</p>' +
      '<label>وصف الأصناف</label><textarea id="smt" rows="5" placeholder="مثال: شيبسي عائلي كرتونة 24 كيس بسعر 260 جنيه في قسم شيبسي عنده طعم ملح وخل">' + esc(t || '') + '</textarea>' +
      '<button class="vmic" id="smmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="smvl">اكتب بالصوت</span></button>' +
      '<label>مفتاح Gemini بديل (اختياري — يستخدم مفتاح الخادم تلقائياً)</label><input id="smk" type="password" autocomplete="off" dir="ltr">' +
      '<div class="r2" style="margin-top:12px"><button class="btn btn-brand btn-lg" id="smai" type="button">🤖 تحليل بالذكاء الاصطناعي</button><button class="btn btn-lg" id="smlp" type="button">⚡ تحليل محلي سريع</button></div>' +
      '<div class="err" id="sme"></div>' + swHtml + '</div>';
    $('ov').classList.add('on');
  }
  function smIn(t) {
    commitAdminRoute(
      { ov: 'ai-batch', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '', drawer: false },
      { mode: admCurrentSnap && admCurrentSnap.ov ? 'push' : 'push', forceOverlay: true }
    );
    if (t != null && $('smt')) $('smt').value = t;
  }
  function smOpen() { SM = []; smIn(SMT); }

  var CH = { msgs: [], draft: [], busy: 0, pend: null, undo: null, pendingClarification: null, executedOpIds: {} }, CHF = false, chPendingPrompt = '';
  function chReset() {
    CH.msgs = [];
    CH.draft = [];
    CH.busy = 0;
    CH.pend = null;
    CH.undo = null;
    CH.pendingClarification = null;
    CH.executedOpIds = {};
  }

  function renderChOpenDom(initialPrompt) {
    vStop(); CHF = true;
    var swHtml = isAdminAiSwitchAllowed()
      ? '<button class="btn btn-sm" id="chold" type="button" style="align-self:flex-start;margin-top:6px">✍️ الإضافة من نص مرة واحدة</button>'
      : '';
    $('ov').innerHTML =
      '<div class="pn" id="chp" style="display:flex;flex-direction:column;height:88vh;max-height:88vh;overflow:hidden">' +
      '<h2>💬 ' + esc(AN()) + '<button class="x" type="button" id="smx">✕</button></h2>' +
      '<div id="chm" class="chm"></div><div id="chd"></div>' +
      '<input id="smk" type="hidden" value="">' +
      '<button class="vmic sm" id="smmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="smvl">اكتب بالصوت</span></button>' +
      '<div class="r2" style="align-items:stretch"><div><textarea id="smt" rows="2" style="resize:none" placeholder="اكتب طلبك للمساعد..."></textarea></div><button class="btn btn-primary" id="chsend" type="button" style="flex:none;padding:0 18px">إرسال</button></div>' +
      '<div class="err" id="sme" style="min-height:0"></div>' +
      swHtml + '</div>';
    $('ov').classList.add('on');
    var promptToFill = initialPrompt || chPendingPrompt;
    chPendingPrompt = '';
    if (promptToFill && $('smt')) $('smt').value = promptToFill;
    chRender();
  }
  function chOpen(initialPrompt) {
    chPendingPrompt = initialPrompt || '';
    commitAdminRoute(
      { ov: 'ai-chat', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '', drawer: false },
      { mode: 'push', forceOverlay: true }
    );
  }

  function chRender() {
    var m = $('chm'); if (!m) return;
    var h = !CH.msgs.length
      ? '<div class="cm a">أهلاً 👋 أخبرني ما تريد إضافته أو تعديله في الكتالوج، ولن يتم تنفيذ أي تعديل أو حذف إلا بعد مراجعتك وموافقتك.<br><small>مثال: «ضيف دوريتوس بـ 10 جنيه» أو «زوّد كل الشيبسي 5 جنيه»</small></div>'
      : '';
    CH.msgs.forEach(function (x) { h += '<div class="cm ' + x.r + '">' + esc(x.t) + '</div>'; });
    if (CH.busy) h += '<div class="cm a">⏳ جاري التفكير...</div>';
    m.innerHTML = h; m.scrollTop = m.scrollHeight;
    var d = $('chd'); if (!d) return;
    var L = CH.draft;
    d.innerHTML =
      (L.length
        ? '<div class="card2" style="margin:6px 0;padding:10px"><b>📝 المسودة (' + L.length + ')</b><div class="hint">' +
          L.map(function (o) {
            var line = esc(o.n + (o.v ? ' · ' + o.v : '')) + ' — ' + (o.p > 0 ? o.p + ' ج' : 'بدون سعر');
            if (o.w && o.w.length) line += ' <span style="color:#d97706">(' + esc(o.w[0]) + ')</span>';
            return line;
          }).join('<br>') +
          '</div><div class="r2" style="margin-top:8px"><button class="btn btn-success btn-sm" id="chrv" type="button">✅ مراجعة وإضافة</button><button class="btn btn-danger btn-sm" id="chnw" type="button" style="flex:none">مسح</button></div></div>'
        : '') + chEdCard();
  }

  function nr(s) { return String(s == null ? '' : s).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).toLowerCase().trim(); }
  function nn(v) { if (v == null || v === '') return null; v = parseFloat(nr(v)); return isFinite(v) ? v : null; }
  function ar(v) { return v == null ? [] : [].concat(v); }
  function sv(b, i, v) { if (v || b.length > i) b[i] = v; }
  function pl(p) { return p[0] + (p[10] ? ' · ' + p[10] : ''); }
  function catEx(X, n) { var k = nr(n); if (!k) return null; for (var i = 0; i < X.cats.length; i++) if (nr(X.cats[i]) == k) return X.cats[i]; return null; }
  function catOf(X, n) { var c = catEx(X, n); if (c) return c; var k = nr(n); if (!k) return null; for (var i = 0; i < X.cats.length; i++) { var x = nr(X.cats[i]); if (x.indexOf(k) > -1 || k.indexOf(x) > -1) return X.cats[i]; } return null; }
  function edMatch(X, p, w) {
    if (!w || typeof w != 'object') return false;
    var any = 0, ok = 1, t;
    var nm = ar(w.name).map(nr).filter(Boolean);
    if (nm.length) { any = 1; var n = nr(p[0]); if (!nm.some(function (x) { return n.indexOf(x) > -1; })) ok = 0; }
    if (w.category) { any = 1; var c = catOf(X, w.category); if (!c || p[1] != c) ok = 0; }
    if (w.flavor) { any = 1; var f = nr(w.flavor); if (!(p[9] || []).some(function (x) { return nr(x[0]).indexOf(f) > -1; })) ok = 0; }
    if (w.variant) { any = 1; if (nr(p[10] || '').indexOf(nr(w.variant)) < 0) ok = 0; }
    if (w.pack) { any = 1; if (nr(p[2] || '').indexOf(nr(w.pack)) < 0) ok = 0; }
    if ((t = nn(w.minPrice)) != null) { any = 1; if (!(p[3] >= t)) ok = 0; }
    if ((t = nn(w.maxPrice)) != null) { any = 1; if (!(p[3] <= t)) ok = 0; }
    if (w.hidden === true || w.hidden === false) { any = 1; if (!!p[7] != w.hidden) ok = 0; }
    if (w.all === true) any = 1;
    return !!(any && ok);
  }
  function edProd(X, o, R) {
    var d = o['do'] || {}, w = o.where || {}, keep = [];
    var idxSet = Array.isArray(o.resolvedIndices) && o.resolvedIndices.length ? o.resolvedIndices : null;
    X.p.forEach(function (p, idx) {
      var hit = idxSet ? idxSet.indexOf(idx) > -1 : edMatch(X, p, w);
      if (!hit) { keep.push(p); return; }
      if (d['delete'] === true) { R.lines.push('🗑 حذف: ' + pl(p)); R.del++; R.n++; return; }
      var a = JSON.parse(JSON.stringify(p)), b = p, pr = +b[3], bo = +b[11] || 0, t;
      if ((t = nn(d.setPrice)) != null) pr = t;
      if ((t = nn(d.addPrice)) != null) pr += t;
      if ((t = nn(d.pctPrice)) != null) pr *= 1 + t / 100;
      if ((t = nn(d.discountPct)) != null) { var bs = bo > pr ? bo : pr; bo = bs; pr = bs * (1 - t / 100); }
      if ((t = nn(d.setOldPrice)) != null) bo = t;
      if (d.clearOldPrice === true) bo = 0;
      pr = Math.round(pr * 100) / 100;
      if (!(pr > 0)) { keep.push(p); return; }
      b[3] = pr; sv(b, 11, bo > pr ? bo : 0);
      if (d.setName && String(d.setName).trim()) b[0] = String(d.setName).trim();
      if (d.setCategory) { var cc = catOf(X, d.setCategory) || String(d.setCategory).trim(); if (cc && X.cats.indexOf(cc) < 0) X.cats.push(cc); if (cc) b[1] = cc; }
      if (d.setPack != null) b[2] = String(d.setPack).trim();
      if (d.setVariant != null) sv(b, 10, String(d.setVariant).trim());
      if (d.hide === true) b[7] = 1; else if (d.hide === false) b[7] = 0;
      var fl = Array.isArray(b[9]) ? b[9] : [];
      if (Array.isArray(d.addFlavors) && d.addFlavors.length) {
        d.addFlavors.forEach(function (rf) {
          var cf = String(rf || '').trim();
          if (cf && !fl.some(function (f) { return nr(f[0]) === nr(cf); })) fl.push([cf, 0]);
        });
        b[9] = fl;
      }
      if (Array.isArray(d.removeFlavors) && d.removeFlavors.length) {
        var rms = d.removeFlavors.map(nr).filter(Boolean);
        fl = fl.filter(function (f) { return !rms.some(function (r) { return nr(f[0]) === r || nr(f[0]).indexOf(r) > -1; }); });
        b[9] = fl;
      }
      if (Array.isArray(d.hideFlavors) && d.hideFlavors.length) {
        var hds = d.hideFlavors.map(nr).filter(Boolean);
        fl.forEach(function (f) { if (hds.some(function (r) { return nr(f[0]) === r || nr(f[0]).indexOf(r) > -1; })) f[1] = 1; });
        b[9] = fl;
      }
      if (Array.isArray(d.showFlavors) && d.showFlavors.length) {
        var shs = d.showFlavors.map(nr).filter(Boolean);
        fl.forEach(function (f) { if (shs.some(function (r) { return nr(f[0]) === r || nr(f[0]).indexOf(r) > -1; })) f[1] = 0; });
        b[9] = fl;
      }
      b[12] = new Date().toISOString();
      if (JSON.stringify(a) !== JSON.stringify(b)) { R.lines.push(pl(a) + ' ← ' + b[3] + ' ج'); R.n++; }
      keep.push(b);
    });
    X.p = keep;
  }
  function edCat(X, o, R) {
    var a = o['do'] || o.action, f = o.from || o.name, t = String(o.to == null ? '' : o.to).trim(), c;
    if (a == 'add') { var n = String(o.name || o.to || '').trim(); if (n && !catEx(X, n)) { X.cats.push(n); R.lines.push('➕ قسم جديد: ' + n); R.n++; } }
    else if (a == 'rename') { c = catOf(X, f); if (!c || !t || t == c) return; X.p.forEach(function (p) { if (p[1] == c) p[1] = t; }); X.cats[X.cats.indexOf(c)] = t; R.lines.push('🗂 تعديل قسم «' + c + '» ← «' + t + '»'); R.n++; }
    else if (a == 'delete') { c = catEx(X, f); if (!c) return; var k2 = X.p.filter(function (p) { return p[1] == c; }).length; X.p = X.p.filter(function (p) { return p[1] != c; }); X.cats.splice(X.cats.indexOf(c), 1); R.lines.push('🗑 حذف قسم «' + c + '»'); R.del += k2 || 1; R.n++; }
  }
  function edOff(X, o, R) {
    var L = X.offers || (X.offers = []), a = o['do'] || o.action;
    if (a == 'add') { var t = String(o.title || '').trim(); if (!t) return; L.push({ t: t, d: String(o.desc || ''), pr: String(o.price || ''), g: String(o.badge || ''), c: PAL[0][1], i: '', x: 0 }); R.lines.push('🎁 عرض جديد: ' + t); R.n++; }
  }
  function edApply(X, ops) {
    var E = eng();
    if (E && typeof E.applyValidatedAdminOps === 'function') {
      return E.applyValidatedAdminOps(X, ops);
    }
    var R = { lines: [], n: 0, del: 0 };
    (ops || []).forEach(function (o) {
      if (!o || typeof o != 'object') return;
      if (o.type == 'product') edProd(X, o, R);
      else if (o.type == 'category') edCat(X, o, R);
      else if (o.type == 'offer') edOff(X, o, R);
    });
    return R;
  }
  function chPrompt() {
    // Pass the ENTIRE catalog (never truncate with slice(0, 200))
    var cat = D.p.map(function (p, idx) {
      var fl = Array.isArray(p[9])
        ? p[9].map(function (f) { return f[0] + (f[1] ? '(مخفي)' : ''); }).join('،')
        : '';
      return (
        idx + '|' + p[0] +
        (p[10] ? ' [' + p[10] + ']' : '') +
        (p[2] ? ' (' + p[2] + ')' : '') +
        ' | ' + p[1] +
        ' | ' + p[3] + 'ج' +
        (p[7] ? ' | مخفي' : '') +
        (fl ? ' | نكهات: ' + fl : '')
      );
    }).join('\n');
    var draftTxt = CH.draft.length
      ? '\nالمسودة الحالية:\n' + CH.draft.map(function (o) {
          return '- ' + o.n + (o.v ? ' · ' + o.v : '') + ' | سعر: ' + (o.p > 0 ? o.p : 'ناقص') + ' | قسم: ' + (o.c || 'غير محدد');
        }).join('\n')
      : '';
    var clarTxt = CH.pendingClarification
      ? '\nسؤال توضيحي مفتوح بانتظار التاجر:\n' + JSON.stringify(CH.pendingClarification)
      : '';
    var tr = CH.msgs.slice(-12).map(function (x) { return (x.r == 'u' ? 'التاجر: ' : 'المساعد: ') + x.t; }).join('\n');
    return (
      'الأقسام (' + D.cats.length + '): ' + JSON.stringify(D.cats) +
      '\nإجمالي الأصناف (' + D.p.length + '):\n' + cat +
      draftTxt +
      clarTxt +
      '\nالمحادثة:\n' + tr
    );
  }
  function annotateDraftDuplicates(items) {
    var E = eng();
    return (items || []).map(function (o) {
      o.w = Array.isArray(o.w) ? o.w : [];
      if (!(o.p > 0) && o.w.indexOf('مفيش سعر، اكتبه') < 0 && o.w.indexOf('السعر مطلوب ولم يتم تحديده') < 0) {
        o.w.push('السعر مطلوب ولم يتم تحديده');
      }
      if (E && typeof E.checkProductDuplicates === 'function') {
        var dup = E.checkProductDuplicates(o, D.p);
        var matches = (dup.exactMatches || []).concat(dup.similarMatches || []);
        if (matches.length) {
          var dupWarn = '⚠️ صنف مشابه/مكرر موجود بالفعل: ' + matches.slice(0, 3).map(function (x) {
            return x.label + ' (' + x.price + ' ج)';
          }).join('، ');
          if (o.w.indexOf(dupWarn) < 0) o.w.push(dupWarn);
        }
      }
      return o;
    });
  }
  async function validateAdminWithServer(payload) {
    try {
      var res = await fetch('/api/admin/ai/validate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return null;
      }
      var data = await res.json().catch(function () { return null; });
      return { status: res.status, ok: res.ok, data: data };
    } catch (e) {
      return null;
    }
  }
  function chEdCard() {
    var P = CH.pend, h = '';
    if (P) {
      h += '<div class="card2" style="margin:6px 0;padding:10px"><b>✏️ التعديلات المقترحة (' + P.n + ')</b><div class="hint" style="max-height:18vh;overflow:auto">' +
        P.lines.slice(0, 50).map(esc).join('<br>') +
        '</div><div class="r2" style="margin-top:8px"><button class="btn btn-success btn-sm" id="chex" type="button">✅ تنفيذ</button><button class="btn btn-danger btn-sm" id="chcx" type="button" style="flex:none">إلغاء</button></div></div>';
    }
    if (CH.undo) h += '<button class="btn btn-sm" id="chun" type="button" style="margin-top:6px">↩️ تراجع عن آخر تعديل</button>';
    return h;
  }
  function chExec() {
    var P = CH.pend;
    if (!P || CH.busy) return;
    if (P.opId && CH.executedOpIds[P.opId]) {
      toast('تم تنفيذ هذه العملية بالفعل.');
      CH.pend = null;
      chRender();
      return;
    }
    var proceed = async function () {
      var btn = $('chex');
      if (btn) btn.disabled = true;
      CH.busy = 1;
      try {
        if (P.opId) {
          var srv = await validateAdminWithServer({
            ops: P.ops || [],
            catalogData: D,
            opId: P.opId,
            markExecuted: true,
          });
          if (srv && srv.data && srv.data.duplicateOp) {
            CH.pend = null;
            CH.msgs.push({ r: 'a', t: 'هذه العملية نُفذت مسبقاً (تم منع التكرار).' });
            chRender();
            return;
          }
          if (srv && !srv.ok && srv.data && srv.data.error) {
            toast(srv.data.error);
            chRender();
            return;
          }
          CH.executedOpIds[P.opId] = true;
        }
        CH.undo = JSON.stringify(D);
        var R = edApply(D, P.ops);
        D.offers = D.offers || [];
        CH.pend = null;
        CH.pendingClarification = null;
        mark();
        CH.msgs.push({ r: 'a', t: 'تم التنفيذ ✅ (' + R.n + ' تعديل). لا تنسَ الضغط على «نشر التعديلات».' });
      } finally {
        CH.busy = 0;
        if (btn) btn.disabled = false;
        chRender();
        render();
      }
    };
    if (P.del) askConfirm('العملية ستحذف ' + P.del + ' عنصر. هل أنت متأكد؟', 'تنفيذ الحذف').then(function (ok) { if (ok) proceed(); });
    else proceed();
  }
  function chUndo() {
    if (!CH.undo) return;
    D = JSON.parse(CH.undo);
    CH.undo = null; CH.pend = null; CH.pendingClarification = null; mark();
    CH.msgs.push({ r: 'a', t: 'تم التراجع عن آخر تعديل ↩️' });
    chRender(); render();
  }
  function applyAdminLocalTurnResult(resObj) {
    if (Array.isArray(resObj.draft)) {
      CH.draft = annotateDraftDuplicates(resObj.draft);
    }
    CH.pendingClarification = resObj.pendingClarification || null;
    CH.pend = resObj.pendingOps && resObj.pendingOps.valid ? resObj.pendingOps : null;
    CH.msgs.push({ r: 'a', t: String(resObj.reply || 'تمام') });
  }
  async function chSend() {
    if (CH.busy) return;
    var ta = $('smt'), er = $('sme'), t = ta ? ta.value.trim() : '';
    if (!t) return;
    var k = $('smk') ? $('smk').value.trim() : '';
    er.textContent = '';
    CH.msgs.push({ r: 'u', t: t }); ta.value = ''; SMT = ''; CH.busy = 1; chRender();
    var E = eng();
    try {
      // If an explicit numeric/text disambiguation choice was pending, try local resolution immediately too
      if (CH.pendingClarification && E && typeof E.parseAdminLocalTurn === 'function') {
        var clarRes = E.parseAdminLocalTurn({
          text: t,
          catalogData: D,
          currentDraft: CH.draft,
          pendingClarification: CH.pendingClarification,
        });
        if (clarRes && (clarRes.pendingOps || clarRes.pendingClarification === null && clarRes.draft.length !== CH.draft.length)) {
          applyAdminLocalTurnResult(clarRes);
          CH.busy = 0; chRender();
          return;
        }
      }

      var aiRes = await askGemini(k, chPrompt(), {
        schemaType: 'admin_chat',
        systemInstruction: ADMIN_CHAT_SYS,
        taskType: 'admin_chat',
        temperature: 0.2,
        returnObject: true,
      });
      var j = aiRes.structured;
      if (!j || typeof j !== 'object') {
        j = JSON.parse(String(aiRes.text || '').replace(/```json|```/g, '').trim());
      }
      if (Array.isArray(j)) j = { products: j };
      var tx = CH.msgs.filter(function (x) { return x.r === 'u'; }).map(function (x) { return x.t; }).join('\n');
      var L = (Array.isArray(j.products) ? j.products : []).map(nz).filter(function (o) { return o.n; });
      if (L.length) CH.draft = annotateDraftDuplicates(fixList(L, tx || t));

      var ops = Array.isArray(j.ops) ? j.ops : [];
      CH.pend = null;
      if (ops.length) {
        var preview = E && typeof E.previewAndValidateAdminOps === 'function'
          ? E.previewAndValidateAdminOps({ ops: ops, catalogData: D })
          : null;
        var srvPreview = await validateAdminWithServer({ ops: ops, catalogData: D });
        if (srvPreview && srvPreview.ok && srvPreview.data && srvPreview.data.preview) {
          preview = srvPreview.data.preview;
        }
        if (preview) {
          if (preview.needsClarification && preview.needsClarification.length) {
            var nc = preview.needsClarification[0];
            CH.pendingClarification = { type: 'disambiguate_op', op: nc.op, candidates: nc.candidates };
            CH.msgs.push({
              r: 'a',
              t: 'يوجد أكثر من صنف مطابق، حدد المقصود بالرقم أو الاسم:\n' +
                nc.candidates.map(function (c, idx2) { return (idx2 + 1) + ') ' + c.label + ' (' + c.category + ') — ' + c.price + ' ج'; }).join('\n'),
            });
          } else if (preview.valid) {
            CH.pend = preview;
            CH.pendingClarification = null;
            CH.msgs.push({ r: 'a', t: String(j.reply || 'راجِع التعديلات المقترحة ثم اضغط «تنفيذ».') });
          } else {
            var errMsg = (preview.errors && preview.errors.length) ? preview.errors.join('\n') : 'لم أجد أصنافاً مطابقة للتعديل المطلوب.';
            CH.msgs.push({ r: 'a', t: errMsg });
          }
        } else {
          var R1 = edApply(JSON.parse(JSON.stringify(D)), ops);
          if (R1.n) {
            R1.ops = ops;
            R1.opId = 'op_' + Date.now().toString(36);
            CH.pend = R1;
          }
          CH.msgs.push({ r: 'a', t: String(j.reply || 'تمام') });
        }
      } else {
        CH.msgs.push({ r: 'a', t: String(j.reply || 'تمام') });
      }
      CH.busy = 0; chRender();
      if (j.action == 'review' && CH.draft.length) chReview();
    } catch (x) {
      if (E && typeof E.parseAdminLocalTurn === 'function') {
        var localRes = E.parseAdminLocalTurn({
          text: t,
          catalogData: D,
          currentDraft: CH.draft,
          pendingClarification: CH.pendingClarification,
        });
        applyAdminLocalTurnResult(localRes);
        CH.busy = 0;
        chRender();
        return;
      }
      CH.msgs.pop(); CH.busy = 0;
      if ($('smt')) $('smt').value = t;
      if ($('sme')) $('sme').textContent = x && x.message == 'KEY' ? 'مفتاح Gemini غير مضبوط في الإعدادات' : 'تعذر الاتصال بالمساعد، حاول مرة أخرى';
      chRender();
    }
  }
  function pk(o) {
    var n = String(o.n || ''), mp = [['طماطم', 1], ['شطة', 1], ['حار', 1], ['جبن', 2], ['برتقال', 2], ['خل', 3], ['ملح', 0], ['شوكولات', 5], ['كاكاو', 5], ['فراولة', 6], ['ذرة', 7], ['فشار', 7]];
    for (var i = 0; i < mp.length; i++) if (n.indexOf(mp[i][0]) > -1) return mp[i][1];
    var h = 0; for (i = 0; i < n.length; i++) h += n.charCodeAt(i);
    return h % PAL.length;
  }
  function renderSmRvModalDom(keep) {
    vStop(false);
    var op = document.querySelector('#ov .pn'), st = keep && op ? op.scrollTop : 0;
    var h = '<div class="pn"><h2>مراجعة الأصناف (' + SM.length + ')<button class="x" type="button" id="smx">✕</button></h2>' +
      '<p class="hint">راجع وعدّل أي بيانات، وشيل العلامة من الصنف اللي مش عايز تضيفه.</p>';
    SM.forEach(function (o, i) {
      var cs = D.cats.slice(); if (o.c && cs.indexOf(o.c) < 0) cs.push(o.c);
      var a = ' data-si="' + i + '" data-sk=';
      var warns = (o.w && o.w.length) ? '<div class="hint" style="color:#d97706;margin-bottom:6px">' + o.w.map(esc).join('<br>') + '</div>' : '';
      h += '<div class="card2"><label class="ck" style="margin:0"><input type="checkbox"' + a + '"on"' + (o.on ? ' checked' : '') + '> إضافة الصنف' +
        (o.dup ? ' <span style="color:#d97706;font-weight:700">⚠️ مشابه موجود</span>' : '') + '</label>' +
        warns +
        '<label>صورة المنتج (اختياري)</label><div class="ip"><div class="ipv" style="width:68px;height:68px">' +
        (o.im ? '<img src="' + esc(o.im) + '" alt="">' : esc(o.e || '🥔')) +
        '</div><div class="btns"><label class="btn btn-primary btn-sm" style="display:inline-block;cursor:pointer;margin:0">📷 اختيار صورة<input type="file" accept="image/*" hidden data-si="' + i + '" data-sk="img"></label>' +
        (o.im ? '<button class="btn btn-danger btn-sm" type="button" data-si="' + i + '" data-sk="rmim">إزالة الصورة</button>' : '') +
        '</div></div>' +
        '<label>الاسم</label><input' + a + '"n" value="' + esc(o.n) + '">' +
        '<div class="r2"><div><label>السعر (جنيه)</label><input type="number" inputmode="numeric"' + a + '"p" value="' + (o.p || '') + '"></div>' +
        '<div><label>السعر قبل الخصم</label><input type="number" inputmode="numeric"' + a + '"o" value="' + (o.o || '') + '" placeholder="اختياري"></div></div>' +
        '<div class="r2"><div><label>الحجم / النوع</label><input' + a + '"v" value="' + esc(o.v || '') + '" placeholder="مثال: كبير / صغير"></div>' +
        '<div style="max-width:86px"><label>إيموجي</label><input' + a + '"e" value="' + esc(o.e || '🥔') + '" style="text-align:center"></div></div>' +
        '<label>العبوة / الوصف</label><input' + a + '"d" value="' + esc(o.d || '') + '" placeholder="مثال: الكرتونة 24 كيس">' +
        '<label>القسم</label><select' + a + '"c">' +
        cs.map(function (c) { return '<option' + (c == o.c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
        '</select>' +
        '<label>النكهات (' + o.f.length + ') — افصل بفاصلة</label><input' + a + '"f" value="' + esc(o.f.join('، ')) + '"></div>';
    });
    $('ov').innerHTML = h + '<div class="r2" style="margin-top:14px"><button class="btn btn-success btn-lg" id="smok" type="button">➕ إضافة المحدد</button><button class="btn btn-lg" id="smbk" type="button">رجوع</button></div></div>';
    $('ov').classList.add('on');
    var np2 = document.querySelector('#ov .pn'); if (np2) np2.scrollTop = st;
  }
  function smRv() {
    commitAdminRoute(
      { ov: 'ai-review', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '', drawer: false },
      { mode: 'push', forceOverlay: true }
    );
  }
  function openOverlayFromSnap(snap) {
    if (!snap || !snap.ov) return false;
    var ok = false;
    if (snap.ov === 'prod') ok = renderEdModalDom(snap.ovIdx, snap.ovCat, snap.ovDupFrom >= 0 ? true : false);
    else if (snap.ov === 'offer') ok = renderOfModalDom(snap.ovIdx);
    else if (snap.ov === 'user') {
      ok = Boolean(usersData.find(function (x) { return String(x.id) === String(snap.ovUid); }));
      if (ok) renderUserDetailModalDom(snap.ovUid);
    } else if (snap.ov === 'ai-chat') {
      if (getAdminAiUiMode() === 'batch_only') {
        renderSmInModalDom(SMT);
        commitAdminRoute({ ov: 'ai-batch' }, { mode: 'replace', skipTabRender: true });
      } else {
        renderChOpenDom();
      }
      ok = true;
    } else if (snap.ov === 'ai-batch') {
      if (getAdminAiUiMode() === 'chat_only') {
        renderChOpenDom();
        commitAdminRoute({ ov: 'ai-chat' }, { mode: 'replace', skipTabRender: true });
      } else {
        renderSmInModalDom(SMT);
      }
      ok = true;
    } else if (snap.ov === 'ai-review') {
      if (SM.length) {
        renderSmRvModalDom();
        ok = true;
      } else {
        // Reloaded on ai-review when volatile SM draft no longer exists: gracefully degrade
        renderChOpenDom();
        commitAdminRoute({ ov: 'ai-chat' }, { mode: 'replace', skipTabRender: true });
        return true;
      }
    }
    if (!ok) {
      $('ov').classList.remove('on');
      commitAdminRoute({ ov: '', ovIdx: -1, ovCat: '', ovDupFrom: -1, ovUid: '' }, { mode: 'replace', skipTabRender: true });
    }
    return ok;
  }
  function chReview() {
    vStop(false);
    var list = annotateDraftDuplicates(JSON.parse(JSON.stringify(CH.draft)));
    list.forEach(function (o) {
      o.on = 1;
      o.im = o.im || '';
      o.c = o.c ? mc(o.c) : D.cats[0] || 'عام';
      o.e = o.e || inferProdEmoji(o.n, o.c);
      o.dup = D.p.some(function (p) { return nr(p[0]) === nr(o.n) && nr(p[10] || '') === nr(o.v) && nr(p[1]) === nr(o.c); });
      if (o.dup) o.on = 0;
    });
    SM = list; smRv();
  }
  async function smGo(ai) {
    vStop(false);
    var tx = $('smt').value.trim(), er = $('sme');
    SMT = tx; er.textContent = ''; er.style.color = '';
    if (!tx) { er.textContent = 'اكتب وصف الأصناف أولاً'; return; }
    try {
      var list;
      if (ai) {
        var k = $('smk') ? $('smk').value.trim() : '';
        er.style.color = 'var(--mu)'; er.textContent = '⏳ جاري التحليل...';
        try {
          var aiRes = await askGemini(k, aiPrompt(tx), {
            schemaType: 'admin_batch',
            systemInstruction: ADMIN_BATCH_SYS,
            taskType: 'admin_batch',
            temperature: 0.1,
            returnObject: true,
          });
          var j = aiRes.structured || JSON.parse(String(aiRes.text || '').replace(/```json|```/g, '').trim());
          list = (Array.isArray(j) ? j : j.products || []).map(nz);
        } catch (aiErr) {
          list = lp(tx);
        }
      } else list = lp(tx);
      list = annotateDraftDuplicates(fixList(list.filter(function (o) { return o.n; }), tx));
      if (!list.length) { er.style.color = ''; er.textContent = 'لم أستطع استخراج أصناف من النص'; return; }
      list.forEach(function (o) {
        o.im = o.im || '';
        o.c = o.c ? mc(o.c) : D.cats[0] || 'عام';
        o.e = o.e || inferProdEmoji(o.n, o.c);
        o.dup = D.p.some(function (p) { return nr(p[0]) === nr(o.n) && nr(p[10] || '') === nr(o.v) && nr(p[1]) === nr(o.c); });
        if (o.dup) o.on = 0;
      });
      SM = list; smRv();
    } catch (e) { er.style.color = ''; er.textContent = 'تعذر التحليل، جرّب التحليل المحلي السريع'; }
  }

  // ===== MODAL DELEGATED EVENTS (#ov) =====
  $('ov').addEventListener('click', function (e) {
    var t = e.target;
    var b = t.closest && t.closest('button');
    if (t === $('ov') || t.id === 'edx' || t.id === 'ofx' || t.id === 'smx') {
      closeEd(t.id === 'smx' || (t === $('ov') && String((admCurrentSnap && admCurrentSnap.ov) || '').indexOf('ai-') === 0));
      return;
    }
    if (t.dataset.pal != null) {
      pal = +t.dataset.pal;
      [].forEach.call(document.querySelectorAll('.swc'), function (s, j) { s.classList.toggle('on', j == pal); });
      updateOfferLivePreview();
      return;
    }
    if (t.id === 'fadd') { addFl(); return; }
    if (t.dataset.fd != null) { fls.splice(+t.dataset.fd, 1); renderFl(); return; }
    if (t.id === 'irm') { eimg = ''; enew = ''; if ($('ipv')) $('ipv').textContent = ($('fe') && $('fe').value.trim()) || '🥔'; return; }
    if (t.id === 'ofirm') { eimg = ''; enew = ''; if ($('ipv')) $('ipv').textContent = '🎁'; return; }
    if (t.id === 'edup' && ei >= 0) { openEd(ei, null, true); return; }
    if (t.id === 'eok') {
      [].forEach.call(document.querySelectorAll('[data-fn]'), function (el) { if (fls[+el.dataset.fn]) fls[+el.dataset.fn][0] = el.value.trim(); });
      if ($('fnew') && $('fnew').value.trim()) addFl();
      var p = [$('fn').value.trim(), $('fc').value, $('fd').value.trim(), +$('fp').value || 0, PAL[pal][1], PAL[pal][2], $('fe').value.trim() || '🥔', $('fa').checked ? 0 : 1, eimg];
      var fl2 = fls.filter(function (f) { return f[0]; });
      if (fl2.length) p[9] = fl2;
      var vl = $('fv').value.trim(), ol = +$('fo').value || 0;
      if (ol && ol <= p[3]) return toast('السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي');
      if (vl) p[10] = vl;
      if (ol) p[11] = ol;
      p[12] = new Date().toISOString();
      if (enew) { var nid = 'i' + Date.now().toString(36); IMG[nid] = enew; PEND[nid] = 1; p[8] = nid; }
      if (!p[0]) return toast('اكتب اسم الصنف');
      if (ei >= 0) D.p[ei] = p;
      else if (dupFrom >= 0 && D.p[dupFrom] && D.p[dupFrom][1] == p[1]) D.p.splice(dupFrom + 1, 0, p);
      else D.p.push(p);
      dupFrom = -1; mark(); closeEd(true); render();
      return;
    }
    if (t.id === 'edl' && ei >= 0) {
      askConfirm('هل أنت متأكد من حذف هذا الصنف؟', 'حذف الصنف').then(function (ok) {
        if (!ok) return;
        D.p.splice(ei, 1); mark(); closeEd(true); render();
      });
      return;
    }
    if (t.id === 'ofok') {
      var pb = +($('ofPb') ? $('ofPb').value : 0) || 0;
      var pa = +($('ofPa') ? $('ofPa').value : 0) || 0;
      var pIdxVal = $('ofProd') ? $('ofProd').value : '';
      var linkedProd = pIdxVal !== '' && D.p[+pIdxVal] ? D.p[+pIdxVal] : null;
      var o = {
        t: $('ot').value.trim(),
        d: $('od').value.trim(),
        pr: $('op').value.trim(),
        g: $('og').value.trim(),
        c: PAL[pal][1],
        i: eimg,
        x: $('oa').checked ? 0 : 1,
        startDate: $('ofStart') ? $('ofStart').value : '',
        endDate: $('ofEnd') ? $('ofEnd').value : '',
        priceBefore: pb || '',
        priceAfter: pa || '',
        discountPct: pb > pa && pa > 0 ? Math.round(((pb - pa) / pb) * 100) : 0,
        productIndex: pIdxVal !== '' ? +pIdxVal : '',
        productName: linkedProd ? linkedProd[0] : '',
      };
      if (!o.t) return toast('اكتب عنوان العرض');
      if (o.startDate && o.endDate && o.endDate < o.startDate) return toast('تاريخ النهاية يجب أن يكون بعد البداية');
      if (enew) { var nid2 = 'i' + Date.now().toString(36); IMG[nid2] = enew; PEND[nid2] = 1; o.i = nid2; }
      if (oei >= 0) OFS()[oei] = o; else OFS().push(o);
      mark(); closeEd(true); render();
      return;
    }
    if (t.id === 'ofdl' && oei >= 0) {
      askConfirm('هل أنت متأكد من حذف هذا العرض؟', 'حذف العرض').then(function (ok) {
        if (!ok) return;
        OFS().splice(oei, 1); mark(); closeEd(true); render();
      });
      return;
    }
    if (b && b.id === 'smmic') {
      if (VPOL) return;
      if (VON || VR || VST) vStop(true);
      else if (!(VENG === 'ai' && b.classList.contains('rec'))) vStart();
      return;
    }
    if (b && b.id === 'chsend') { chSend(); return; }
    if (b && b.id === 'chex') { chExec(); return; }
    if (b && b.id === 'chcx') { CH.pend = null; chRender(); return; }
    if (b && b.id === 'chun') { chUndo(); return; }
    if (b && b.id === 'chrv') { chReview(); return; }
    if (b && b.id === 'chnw') { chReset(); chRender(); return; }
    if (b && b.id === 'chold') { if (!isAdminAiSwitchAllowed()) return; if ($('smt') && $('smt').value.trim()) SMT = $('smt').value.trim(); smOpen(); return; }
    if (b && b.id === 'smtochat') { if (!isAdminAiSwitchAllowed()) return; chOpen($('smt') ? $('smt').value.trim() : SMT); return; }
    if (t.dataset && t.dataset.sk === 'rmim' && SM[+t.dataset.si]) {
      SM[+t.dataset.si].im = ''; renderSmRvModalDom(1); return;
    }
    if (t.id === 'smbk') {
      if (admCanGoBack()) history.back();
      else commitAdminRoute({ ov: CHF ? 'ai-chat' : 'ai-batch' }, { mode: 'replace', forceOverlay: true });
      return;
    }
    if (t.id === 'smai') { smGo(true); return; }
    if (t.id === 'smlp') { smGo(false); return; }
    if (t.id === 'smok') {
      var sel = SM.filter(function (o) { return o.on && o.n; });
      if (!sel.length) return toast('اختر صنفاً واحداً على الأقل');
      if (sel.some(function (o) { return !(o.p > 0); })) return toast('أكمل السعر لكل الأصناف المحددة');
      var E = eng();
      var hasExactDup = E && typeof E.checkProductDuplicates === 'function'
        ? sel.some(function (o) { return (E.checkProductDuplicates(o, D.p).exactMatches || []).length > 0; })
        : false;
      var commitAdd = function () {
        var imap = {};
        sel.forEach(function (o) {
          var k = pk(o), a = [o.n, o.c, o.d || '', o.p, PAL[k][1], PAL[k][2], o.e || inferProdEmoji(o.n, o.c), 0, ''];
          if (o.f.length) a[9] = o.f.map(function (f) { return [f, 0]; });
          if (o.v) a[10] = o.v;
          if (o.o > o.p) a[11] = o.o;
          a[12] = new Date().toISOString();
          if (o.im) {
            if (!imap[o.im]) {
              var nid = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
              IMG[nid] = o.im; PEND[nid] = 1; imap[o.im] = nid;
            }
            a[8] = imap[o.im];
          }
          if (D.cats.indexOf(o.c) < 0) D.cats.push(o.c);
          D.p.push(a);
        });
        chReset(); SM = []; SMT = ''; mark(); closeEd(true); render();
        toast('تمت إضافة ' + sel.length + ' صنف ✅ لا تنسَ النشر');
      };
      if (hasExactDup) {
        askConfirm('يوجد صنف مطابق بالفعل في الكتالوج لبعض الاختيارات المحددة. هل تريد إضافته على أي حال؟', 'تأكيد إضافة مكرر').then(function (ok) {
          if (ok) commitAdd();
        });
      } else {
        commitAdd();
      }
    }
  });

  $('ov').addEventListener('input', function (e) {
    if (['ot', 'od', 'op', 'og', 'ofPb', 'ofPa'].indexOf(e.target.id) > -1) updateOfferLivePreview();
  });

  $('ov').addEventListener('change', function (e) {
    var t = e.target;
    if ((t.id === 'ff' || t.id === 'of') && t.files && t.files[0]) {
      shrink(t.files[0]).then(function (u) {
        enew = u; eimg = ''; if ($('ipv')) $('ipv').innerHTML = '<img src="' + u + '" alt="">';
      }).catch(function () { toast('ملف الصورة غير صالح أو حجمه كبير'); });
      return;
    }
    if (t.dataset.fn != null && fls[+t.dataset.fn]) fls[+t.dataset.fn][0] = t.value.trim();
    else if (t.dataset.fa != null && fls[+t.dataset.fa]) fls[+t.dataset.fa][1] = t.checked ? 0 : 1;
    else if (t.dataset.sk != null && SM[+t.dataset.si]) {
      var o = SM[+t.dataset.si], k = t.dataset.sk;
      if (k === 'img') {
        var fl = t.files && t.files[0];
        if (fl) shrink(fl).then(function (u) { o.im = u; renderSmRvModalDom(1); }).catch(function () { toast('الصورة دي مش شغالة، جرّب غيرها'); });
        return;
      }
      if (k === 'on') o.on = t.checked ? 1 : 0;
      else if (k === 'p' || k === 'o') o[k] = +t.value || 0;
      else if (k === 'f') o.f = sfl(t.value);
      else o[k] = t.value.trim();
    }
  });

  $('ov').addEventListener('keydown', function (e) {
    if (e.key == 'Enter' && e.target.id == 'fnew') { e.preventDefault(); addFl(); }
  });

  // ===== APP DELEGATED EVENTS (#app) =====
  var dragCatIdx = -1;
  $('app').addEventListener('dragstart', function (e) {
    var row = e.target.closest && e.target.closest('.cat-row');
    if (!row) return;
    dragCatIdx = +row.dataset.catIdx;
    row.classList.add('dragging');
  });
  $('app').addEventListener('dragend', function (e) {
    var row = e.target.closest && e.target.closest('.cat-row');
    if (row) row.classList.remove('dragging');
    [].forEach.call(document.querySelectorAll('.cat-row.drag-over'), function (el) { el.classList.remove('drag-over'); });
    dragCatIdx = -1;
  });
  $('app').addEventListener('dragover', function (e) {
    var row = e.target.closest && e.target.closest('.cat-row');
    if (!row || dragCatIdx < 0) return;
    e.preventDefault();
    row.classList.add('drag-over');
  });
  $('app').addEventListener('dragleave', function (e) {
    var row = e.target.closest && e.target.closest('.cat-row');
    if (row) row.classList.remove('drag-over');
  });
  $('app').addEventListener('drop', function (e) {
    var row = e.target.closest && e.target.closest('.cat-row');
    if (!row || dragCatIdx < 0) return;
    e.preventDefault();
    var targetIdx = +row.dataset.catIdx;
    if (targetIdx !== dragCatIdx && D.cats[dragCatIdx] != null) {
      var moved = D.cats.splice(dragCatIdx, 1)[0];
      D.cats.splice(targetIdx, 0, moved);
      mark();
      render();
    }
    dragCatIdx = -1;
  });

  $('app').addEventListener('click', function (e) {
    var t = e.target;
    var b;
    if (t.id === 'mobMenuBtn' || t.closest('#mobMenuBtn')) {
      commitAdminRoute({ drawer: true }, { mode: 'push', skipTabRender: true });
      return;
    }
    if (t.id === 'sbBackdrop' || t.id === 'sbMobileClose' || t.closest('#sbMobileClose')) { closeMobileDrawer(); return; }
    if (t.id === 'admBackBtn' || t.closest('#admBackBtn')) { admGoBackOrHome(); return; }
    if (t.id === 'sbCollapseBtn') {
      $('app').classList.toggle('sb-collapsed');
      try { localStorage.setItem('abu_sb_collapsed', $('app').classList.contains('sb-collapsed') ? '1' : '0'); } catch (z) {}
      return;
    }
    if (t.id === 'admThemeBtn') { toggleAdminTheme(); return; }
    if (t.id === 'admSetLight') { document.documentElement.setAttribute('data-theme', 'light'); try { localStorage.setItem('abu_admin_theme', 'light'); } catch (z) {} syncThemeUI(); return; }
    if (t.id === 'admSetDark') { document.documentElement.setAttribute('data-theme', 'dark'); try { localStorage.setItem('abu_admin_theme', 'dark'); } catch (z) {} syncThemeUI(); return; }
    if (t.id === 'pub' || t.id === 'dashPubBtn') { pub(); return; }
    if (t.id === 'smb' || t.closest('#smb')) { openAdminAiByPreference(); return; }
    if (t.id === 'admRefreshBtn') {
      Promise.all([loadUsers(true), loadOrders(true), loadPushOverview(true), loadAuditLogs(true), loadHealth(true)]).then(function () {
        render(); toast('تم تحديث البيانات ✅');
      });
      return;
    }
    if (t.id === 'lo' || t.id === 'secLogoutBtn') {
      fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () {}).finally(function () {
        dirty = false; location.reload();
      });
      return;
    }
    if ((b = t.closest('[data-t]'))) { switchTab(b.dataset.t); return; }
    if ((b = t.closest('[data-go]'))) { switchTab(b.dataset.go); return; }

    // Products view controls
    if ((b = t.closest('[data-pview]'))) { prodView = b.dataset.pview; render(); return; }
    if ((b = t.closest('[data-bulk]'))) {
      var act = b.dataset.bulk;
      var selKeys = Object.keys(prodSelected).filter(function (k) { return prodSelected[k] && D.p[+k]; }).map(Number);
      if (act === 'clear') { prodSelected = {}; render(); return; }
      if (!selKeys.length) return;
      if (act === 'show' || act === 'hide') {
        selKeys.forEach(function (idx) { D.p[idx][7] = act === 'hide' ? 1 : 0; });
        mark(); render();
        toast(act === 'hide' ? 'تم إخفاء الأصناف المحددة' : 'تم إظهار الأصناف المحددة ✅');
      } else if (act === 'delete') {
        askConfirm('هل أنت متأكد من حذف ' + selKeys.length + ' صنف محدد؟', 'حذف المحدد').then(function (ok) {
          if (!ok) return;
          var rmSet = {};
          selKeys.forEach(function (idx) { rmSet[idx] = 1; });
          D.p = D.p.filter(function (_p, idx) { return !rmSet[idx]; });
          prodSelected = {};
          mark(); render();
        });
      }
      return;
    }
    if (t.dataset.pu != null || t.dataset.pd != null) {
      var up = t.dataset.pu != null, i0 = +(up ? t.dataset.pu : t.dataset.pd), c0 = D.p[i0][1], j0 = i0;
      do { j0 += up ? -1 : 1; } while (j0 >= 0 && j0 < D.p.length && D.p[j0][1] != c0);
      if (j0 >= 0 && j0 < D.p.length) { var x0 = D.p[i0]; D.p[i0] = D.p[j0]; D.p[j0] = x0; mark(); render(); }
      return;
    }
    if (t.dataset.dup != null) { openEd(+t.dataset.dup, null, true); return; }
    if (t.dataset.add != null) { openEd(-1, t.dataset.add); return; }

    // Categories
    if (t.dataset.up != null || t.dataset.dn != null) {
      var ci = +(t.dataset.up != null ? t.dataset.up : t.dataset.dn), cj = t.dataset.up != null ? ci - 1 : ci + 1;
      if (cj >= 0 && cj < D.cats.length) { var cx = D.cats[ci]; D.cats[ci] = D.cats[cj]; D.cats[cj] = cx; mark(); render(); }
      return;
    }
    if (t.dataset.dc != null) { askCategoryDeleteDialog(+t.dataset.dc); return; }
    if (t.dataset.catImgRm != null) {
      var cname = D.cats[+t.dataset.catImgRm];
      if (cname && D.catMeta && D.catMeta[cname]) { delete D.catMeta[cname].imageId; mark(); render(); }
      return;
    }
    if (t.id === 'addc') {
      var v = $('nc') ? $('nc').value.trim() : '';
      if (!v) return;
      if (D.cats.indexOf(v) > -1) return toast('هذا القسم موجود بالفعل');
      D.cats.push(v); mark(); render(); return;
    }

    // Offers
    if ((b = t.closest('[data-off-tab]'))) {
      if (offerSubTab !== b.dataset.offTab) {
        commitAdminRoute({ tab: 'o', sub: b.dataset.offTab }, { mode: 'push' });
      }
      return;
    }
    if (t.dataset.oadd != null) { openOf(-1); return; }
    if (t.dataset.oup != null || t.dataset.odn != null) {
      var L = OFS(), oi = +(t.dataset.oup != null ? t.dataset.oup : t.dataset.odn), oj = t.dataset.oup != null ? oi - 1 : oi + 1;
      if (oj >= 0 && oj < L.length) { var ox = L[oi]; L[oi] = L[oj]; L[oj] = ox; mark(); render(); }
      return;
    }

    // Orders & Users
    if (t.id === 'oRefresh') { loadOrders(false); return; }
    if (t.id === 'oClearAll' || t.closest('#oClearAll')) { clearAllOrdersAdmin(); return; }
    if ((b = t.closest('[data-of]'))) { orderFilter = b.dataset.of; render(); return; }
    if ((b = t.closest('[data-os]'))) { updateOrderStatusAdmin(b.dataset.oid, b.dataset.os); return; }
    if ((b = t.closest('[data-odel]'))) { deleteOrderAdmin(b.dataset.odel); return; }
    if (t.id === 'oExportCsv' || t.id === 'repExportOrdersCsv') {
      exportCsvRows('abusaid-orders.csv', ['رقم الطلب', 'العميل', 'الهاتف', 'المحل', 'الحالة', 'الكمية', 'الإجمالي', 'التاريخ'], ordersData.map(function (o) {
        return [o.id, o.userName, o.userPhone, o.shopName, o.status, o.totalQty, o.totalPrice, o.createdAt];
      }));
      return;
    }
    if (t.id === 'uRefresh') { loadUsers(false); return; }
    if (t.id === 'uExportCsv') {
      exportCsvRows('abusaid-users.csv', ['الاسم', 'الهاتف', 'البريد', 'المحل', 'العنوان', 'الحالة', 'تاريخ التسجيل'], usersData.map(function (u) {
        return [u.fullName, u.phone, u.email, u.shopName, u.address, u.status, u.createdAt];
      }));
      return;
    }
    if ((b = t.closest('[data-uf]'))) { userFilter = b.dataset.uf; render(); return; }
    if ((b = t.closest('[data-udet]'))) { openUserDetailModal(b.dataset.udet); return; }
    if ((b = t.closest('[data-ua]'))) { runUserAction(b.dataset.ua, b.dataset.uid); return; }

    // Push
    if ((b = t.closest('[data-ptab]'))) {
      var nextPTab = b.dataset.ptab;
      if (nextPTab === 'devices') loadPushDevices(true);
      if (pushSubTab !== nextPTab) {
        commitAdminRoute({ tab: 'n', sub: nextPTab }, { mode: 'push' });
      }
      return;
    }
    if (t.id === 'pushRefresh') { loadPushOverview(false); if (pushSubTab === 'devices') loadPushDevices(true); return; }
    if ((b = t.closest('[data-ptarget]'))) { pushForm.targetType = b.dataset.ptarget; render(); return; }
    if (t.id === 'pushImgRm') { pushForm.imageDataUrl = ''; render(); return; }
    if (t.id === 'pushSendBtn') { sendAdminPushNotification(); return; }
    if (t.id === 'pushClearLogs') { clearAllPushLogs(); return; }
    if ((b = t.closest('[data-del-plog]'))) { deletePushLog(b.dataset.delPlog, b.dataset.plogTitle); return; }
    if ((b = t.closest('[data-rm-dev]'))) { removePushDevice(b.dataset.rmDev); return; }

    // Media, Audit, Backups, Analytics, Settings, AI
    if ((b = t.closest('[data-mfil]'))) { mediaFilter = b.dataset.mfil; render(); return; }
    if (t.id === 'mediaRefresh') { loadMedia(false); return; }
    if ((b = t.closest('[data-mdel]'))) { deleteMediaAsset(b.dataset.mdel); return; }
    if ((b = t.closest('[data-autype]'))) { auditTypeFilter = b.dataset.autype; render(); return; }
    if (t.id === 'auditRefresh') { loadAuditLogs(false); return; }
    if (t.id === 'bkRefresh') { loadBackups(false); return; }
    if (t.id === 'bkCreateBtn') { createManualBackup(); return; }
    if ((b = t.closest('[data-bk-dl]'))) { downloadBackupJson(b.dataset.bkDl); return; }
    if ((b = t.closest('[data-bk-res]'))) { restoreBackup(b.dataset.bkRes, b.dataset.bkLbl || b.dataset.bkRes); return; }
    if (t.id === 'repExportProductsCsv') {
      exportCsvRows('abusaid-products.csv', ['الاسم', 'القسم', 'العبوة', 'الحجم', 'السعر', 'قبل الخصم', 'متاح'], D.p.map(function (p) {
        return [p[0], p[1], p[2], p[10] || '', p[3], p[11] || '', p[7] ? 'مخفي' : 'نعم'];
      }));
      return;
    }
    if (t.id === 'repExportJson') {
      downloadBlob('abusaid-catalog.json', 'application/json;charset=utf-8', JSON.stringify(D, null, 2));
      return;
    }
    if ((b = t.closest('[data-stab]'))) {
      var nextSTab = b.dataset.stab;
      if (settingsSubTab !== nextSTab) {
        commitAdminRoute({ tab: 's', sub: nextSTab }, { mode: 'push' });
      }
      if (nextSTab === 'health') loadHealth(false);
      return;
    }
    if (t.id === 'healthRefreshBtn' || t.id === 'dashHealthRefresh') { loadHealth(false); return; }
    if (t.id === 'cfgClearGkBtn') {
      D.cfg.clearGk = true;
      delete D.cfg.newGk;
      mark(); render();
      toast('سيتم إزالة مفتاح Gemini عند الضغط على نشر');
      return;
    }
    if (t.id === 'lgrm') { delete D.cfg.logo; mark(); render(); return; }
    if (t.id === 'fntBodyRm') { delete D.cfg.fontBodyId; delete D.cfg.fontBodyName; mark(); render(); return; }
    if (t.id === 'fntHeadRm') { delete D.cfg.fontHeadId; delete D.cfg.fontHeadName; mark(); render(); return; }
    if (t.id === 'resetColors') { delete D.cfg.cBg; delete D.cfg.cRed; delete D.cfg.cBlue; delete D.cfg.cGreen; mark(); render(); toast('تمت استعادة الألوان الأصلية'); return; }
    if (t.id === 'aiLaunchChat') { chOpen(); return; }
    if (t.id === 'aiLaunchBatch') { smOpen(); return; }
    if ((b = t.closest('[data-ai-preset]'))) { openAdminAiByPreference(b.dataset.aiPreset); return; }

    if (t.closest('.sw') || t.type === 'checkbox') return;
    if ((b = t.closest('[data-e]'))) { openEd(+b.dataset.e); return; }
    if ((b = t.closest('[data-o]'))) { openOf(+b.dataset.o); return; }
  });

  $('app').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'prodCatSel') { prodCatFilter = t.value; render(); return; }
    if (t.id === 'prodStatusSel') { prodStatusFilter = t.value; render(); return; }
    if (t.id === 'prodSortSel') { prodSort = t.value; render(); return; }
    if (t.id === 'prodSelAll') {
      var vis = getFilteredProductIndices();
      vis.forEach(function (idx) { if (t.checked) prodSelected[idx] = 1; else delete prodSelected[idx]; });
      render(); return;
    }
    if (t.dataset.psel != null) {
      if (t.checked) prodSelected[+t.dataset.psel] = 1; else delete prodSelected[+t.dataset.psel];
      render(); return;
    }
    if (t.id === 'bulkMoveCat' && t.value) {
      var targetCat = t.value;
      Object.keys(prodSelected).forEach(function (k) { if (prodSelected[k] && D.p[+k]) D.p[+k][1] = targetCat; });
      prodSelected = {}; mark(); render();
      toast('تم نقل الأصناف المحددة إلى «' + targetCat + '» ✅');
      return;
    }
    if (t.dataset.av != null) { D.p[+t.dataset.av][7] = t.checked ? 0 : 1; mark(); render(); return; }
    if (t.dataset.ov != null) { OFS()[+t.dataset.ov].x = t.checked ? 0 : 1; mark(); render(); return; }
    if (t.dataset.catEn != null) {
      var cname = D.cats[+t.dataset.catEn];
      if (cname) {
        ensureCatMeta();
        D.catMeta[cname] = D.catMeta[cname] || {};
        D.catMeta[cname].disabled = t.checked ? 0 : 1;
        mark();
      }
      return;
    }
    if (t.dataset.catImg != null && t.files && t.files[0]) {
      var cIdx = +t.dataset.catImg, cname2 = D.cats[cIdx];
      if (!cname2) return;
      shrink(t.files[0]).then(function (u) {
        var nid = 'i' + Date.now().toString(36);
        IMG[nid] = u; PEND[nid] = 1;
        ensureCatMeta();
        D.catMeta[cname2] = D.catMeta[cname2] || {};
        D.catMeta[cname2].imageId = nid;
        mark(); render();
      }).catch(function () { toast('ملف الصورة غير صالح'); });
      return;
    }
    if (t.dataset.rn != null) {
      var i = +t.dataset.rn, o = D.cats[i], v = t.value.trim();
      if (!v || (v != o && D.cats.indexOf(v) > -1)) { toast('الاسم فارغ أو مكرر'); render(); return; }
      D.p.forEach(function (p) { if (p[1] == o) p[1] = v; });
      if (D.catMeta && D.catMeta[o]) { D.catMeta[v] = D.catMeta[o]; delete D.catMeta[o]; }
      D.cats[i] = v; mark(); return;
    }
    if (t.id === 'cfgNewGk') {
      var nk = t.value.trim();
      if (nk) { D.cfg.newGk = nk; delete D.cfg.clearGk; }
      else delete D.cfg.newGk;
      mark(); return;
    }
    if (t.dataset.s) {
      var k = t.dataset.s;
      if (k == 'phone') { D.cfg.phone = np(t.value); render(); }
      else if (k == 'min') D.cfg.min = +t.value || 0;
      else if (k == 'ro' || k == 'rm' || k == 'oh' || k == 'hideThemeBtn' || k == 'hideBanner' || k == 'hideSpotlight' || k == 'hideCatsBox') {
        D.cfg[k] = t.checked ? 0 : 1;
      }
      else if (k == 'fontUnified') D.cfg.fontUnified = t.checked ? 1 : 0;
      else if (k == 'rn') { D.cfg.rn = t.value.trim(); render(); }
      else if (k == 'unit') D.cfg.unit = t.value.trim() || 'كرتونة';
      else if (k == 'aiUi' || k == 'adminAiUi') { D.cfg[k] = t.value.trim(); mark(); render(); return; }
      else D.cfg[k] = t.value.trim();
      mark();
      return;
    }
    if (t.id === 'pushTargetUser') { pushForm.targetUserId = t.value; return; }
    if (t.id === 'pushTargetSeg') { pushForm.targetSegment = t.value; return; }
    if (t.id === 'pushUrlPreset') { pushForm.urlPreset = t.value; render(); return; }
    if (t.id === 'pushLogSt') { pushLogFilter = t.value; render(); return; }
    if (t.id === 'pushImgFile' && t.files && t.files[0]) {
      shrink(t.files[0]).then(function (u) { pushForm.imageDataUrl = u; if (tab === 'n') render(); }).catch(function () { toast('ملف الصورة غير صالح'); });
      return;
    }
    if (t.id === 'mediaUploadNew' && t.files && t.files[0]) {
      shrink(t.files[0]).then(function (u) {
        var nid = 'i' + Date.now().toString(36); IMG[nid] = u; PEND[nid] = 1; mark(); render();
        toast('تم تجهيز الصورة محلياً ✅ اضغط نشر التعديلات لحفظها نهائياً');
      }).catch(function () { toast('ملف الصورة غير صالح'); });
      return;
    }
    if (t.id === 'bkImportFile' && t.files && t.files[0]) { importBackupFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'lgf' && t.files && t.files[0]) {
      shrink(t.files[0]).then(function (u) {
        var nid = 'i' + Date.now().toString(36); IMG[nid] = u; PEND[nid] = 1; D.cfg.logo = nid; mark(); render();
      }).catch(function () { toast('ملف الصورة غير صالح'); });
      return;
    }
    if ((t.id === 'fntBody' || t.id === 'fntHead') && t.files && t.files[0]) {
      var file = t.files[0], isBody = t.id === 'fntBody';
      readFontFile(file).then(function (u) {
        var nid = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
        IMG[nid] = u; PEND[nid] = 1;
        if (isBody) { D.cfg.fontBodyId = nid; D.cfg.fontBodyName = file.name; }
        else { D.cfg.fontHeadId = nid; D.cfg.fontHeadName = file.name; }
        mark(); render(); toast('تم رفع الخط ✅ اضغط نشر لتفعيله بالمتجر');
      }).catch(function (err) {
        toast(err && err.message == 'SIZE' ? 'الحد الأقصى لحجم الخط ٢.٥ ميجا' : 'اختر ملف خط TTF / OTF / WOFF / WOFF2');
      });
    }
  });

  $('app').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'prodSearch') { q = t.value.trim(); render(); var ps = $('prodSearch'); if (ps) { ps.focus(); ps.setSelectionRange(ps.value.length, ps.value.length); } return; }
    if (t.id === 'uq') { userQuery = t.value.trim(); if ($('uList')) $('uList').innerHTML = renderUserCardsHtml(); return; }
    if (t.id === 'oq') { orderQuery = t.value.trim(); if ($('oList')) $('oList').innerHTML = renderOrderCardsHtml(); return; }
    if (t.id === 'mediaQ') { mediaQuery = t.value.trim(); render(); var mq = $('mediaQ'); if (mq) { mq.focus(); mq.setSelectionRange(mq.value.length, mq.value.length); } return; }
    if (t.id === 'auditQ') { auditQuery = t.value.trim(); render(); var aq = $('auditQ'); if (aq) { aq.focus(); aq.setSelectionRange(aq.value.length, aq.value.length); } return; }
    if (t.id === 'pushLogQ') { pushLogQuery = t.value.trim(); render(); var plq = $('pushLogQ'); if (plq) { plq.focus(); plq.setSelectionRange(plq.value.length, plq.value.length); } return; }
    if (t.id === 'pushTitle') { pushForm.title = t.value; if ($('mockPushTitle')) $('mockPushTitle').textContent = t.value || 'عنوان الإشعار يظهر هنا'; return; }
    if (t.id === 'pushBody') { pushForm.body = t.value; if ($('mockPushBody')) $('mockPushBody').textContent = t.value || 'نص الإشعار وتفاصيل العرض ستظهر للعملاء بهذا الشكل.'; return; }
    if (t.id === 'pushUrlCustom') { pushForm.urlCustom = t.value; return; }
    if (t.dataset && t.dataset.n) {
      var v = +t.value; D.cfg[t.dataset.n] = v;
      var l = $('nv_' + t.dataset.n); if (l) l.textContent = v + (t.dataset.u || '');
      mark();
    }
  });

  // ===== PUBLISH & BOOTSTRAP =====
  async function pub() {
    if (!D.cfg.phone || D.cfg.phone.length < 11) {
      toast('رقم الواتساب ناقص، راجعه من الإعدادات');
      settingsSubTab = 'general'; switchTab('s');
      return;
    }
    var b = $('pub');
    if (b) b.disabled = true;
    D.v = (D.v || 0) + 1;
    var used = {};
    D.p.forEach(function (p) { if (p[8]) used[p[8]] = 1; });
    OFS().forEach(function (o) { if (o.i) used[o.i] = 1; });
    if (D.catMeta) Object.keys(D.catMeta).forEach(function (c) { if (D.catMeta[c] && D.catMeta[c].imageId) used[D.catMeta[c].imageId] = 1; });
    if (D.cfg.logo) used[D.cfg.logo] = 1;
    if (D.cfg.fontBodyId) used[D.cfg.fontBodyId] = 1;
    if (D.cfg.fontHeadId) used[D.cfg.fontHeadId] = 1;

    var pendingImages = {};
    for (var k in PEND) {
      if (used[k] && IMG[k]) pendingImages[k] = IMG[k];
    }

    try {
      var res = await fetch('/api/admin/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: D, pendingImages: pendingImages }),
      });
      if (res.status === 401) { handleAdminUnauthorized(); return; }
      var out = await res.json();
      if (!res.ok) throw new Error(out.error || 'تعذر النشر');
      if (out.data) {
        D = out.data;
        ensureCatMeta();
      }
      PEND = {};
      dirty = false;
      updatePublishStatusUI();
      loadAuditLogs(true);
      toast('تم نشر التعديلات بنجاح ✅');
      render();
    } catch (e) {
      D.v--;
      toast('تعذر النشر: ' + (e && e.message ? e.message : e));
    } finally {
      if (b) b.disabled = false;
    }
  }

  async function loadAll() {
    var res = await fetch('/api/admin/bootstrap', { credentials: 'same-origin' });
    if (res.status === 401) { handleAdminUnauthorized(); return; }
    var out = await res.json();
    if (!res.ok) throw new Error(out.error || 'تعذر تحميل البيانات');
    if (out.data) {
      D = out.data;
      D.cfg = D.cfg || { phone: '', min: 0, unit: 'كرتونة' };
      D.cats = Array.isArray(D.cats) ? D.cats : [];
      D.catMeta = (D.catMeta && typeof D.catMeta === 'object') ? D.catMeta : {};
      D.p = Array.isArray(D.p) ? D.p : [];
      D.offers = Array.isArray(D.offers) ? D.offers : [];
    }
    IMG = out.images || {};
  }

  async function loadAdminMe() {
    try {
      var res = await fetch('/api/admin/me', { credentials: 'same-origin' });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok && data && data.authenticated) {
        adminMe = data;
        if ($('sbAdminEmail')) $('sbAdminEmail').textContent = data.email || 'المدير';
        if ($('admEmailText')) $('admEmailText').textContent = data.email || '';
        if ($('admEmailPill')) $('admEmailPill').hidden = false;
      }
    } catch (e) {}
  }

  async function loadHealth(silent) {
    healthLoading = true;
    if (tab === 's' && settingsSubTab === 'health') render();
    try {
      var res = await fetch('/api/admin/health', { credentials: 'same-origin' });
      if (res.status === 401) { handleAdminUnauthorized(); return; }
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data) healthData = data;
    } catch (e) {
      if (!silent) toast('تعذر فحص حالة النظام');
    } finally {
      healthLoading = false;
      if (tab === 'dashboard' || (tab === 's' && settingsSubTab === 'health')) render();
    }
  }

  function initAdminRouter() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    var existing = history.state;
    var initSnap = parseAdminSnapFromLocation();
    if (existing && existing.__abuAdmNav && typeof existing.idx === 'number') {
      admNavIdx = existing.idx;
      admBaseIdx = typeof existing.baseIdx === 'number' ? existing.baseIdx : existing.idx;
      admOvSteps = typeof existing.ovSteps === 'number' ? existing.ovSteps : 0;
      initSnap = normalizeAdminSnap(existing.snap || initSnap);
      if (initSnap.cov) initSnap.cov = false;
    } else {
      admNavIdx = 0;
      admBaseIdx = 0;
      admOvSteps = 0;
    }

    ensureTabSubSynced(initSnap);
    admCurrentSnap = initSnap;
    try {
      history.replaceState(
        { __abuAdmNav: 1, idx: admNavIdx, baseIdx: admBaseIdx, ovSteps: admOvSteps, snap: initSnap },
        '',
        buildAdminUrl(initSnap)
      );
    } catch (e) {}

    window.addEventListener('popstate', function (e) {
      var st = e.state;
      var targetSnap;
      var nextIdx;
      var nextOvSteps = 0;
      saveAdmScroll(admNavIdx, admCurrentSnap);

      if (st && st.__abuAdmNav && st.snap) {
        targetSnap = normalizeAdminSnap(st.snap);
        nextIdx = typeof st.idx === 'number' ? st.idx : admNavIdx;
        if (typeof st.baseIdx === 'number' && st.baseIdx < admBaseIdx) admBaseIdx = st.baseIdx;
        nextOvSteps = typeof st.ovSteps === 'number' ? st.ovSteps : 0;
      } else {
        targetSnap = parseAdminSnapFromLocation();
        nextIdx = admNavIdx;
      }

      admNavIdx = nextIdx;
      admOvSteps = nextOvSteps;
      admRestoringPop = true;
      try {
        applyAdminSnapToUI(targetSnap, { isPop: true });
      } finally {
        admRestoringPop = false;
      }
    });

    var scrollTick = null;
    window.addEventListener(
      'scroll',
      function () {
        clearTimeout(scrollTick);
        scrollTick = setTimeout(function () {
          if (admCurrentSnap && !admCurrentSnap.ov && !admCurrentSnap.cov) {
            saveAdmScroll(admNavIdx, admCurrentSnap);
          }
        }, 120);
      },
      { passive: true }
    );

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (popAdminOverlay('base')) e.preventDefault();
      }
    });

    if (initSnap.ov === 'ai-chat' || initSnap.ov === 'ai-batch') {
      openOverlayFromSnap(initSnap);
    } else if (initSnap.ov) {
      admPendingDeepOv = initSnap;
    }
    syncAdmBackButton();
  }

  async function init() {
    var lfWrap = $('lfWrap');
    if (lfWrap) lfWrap.hidden = true;
    if ($('lf')) $('lf').hidden = true;
    $('app').hidden = false;
    applySavedSidebarState();
    syncThemeUI();
    initAdminRouter();
    render();
    triggerTabDataLoads(tab);
    try {
      await Promise.all([
        loadAdminMe(),
        loadAll(),
        loadUsers(true),
        loadOrders(true),
        loadPushOverview(true),
        loadAuditLogs(true),
        loadHealth(true),
      ]);
      admBootstrapDone = true;
      updatePublishStatusUI();
      render();
      if (admPendingDeepOv) {
        var deep = admPendingDeepOv;
        admPendingDeepOv = null;
        if (sameAdminSnap(admCurrentSnap, deep)) openOverlayFromSnap(deep);
      }
      var savedY = readAdmScroll(admNavIdx, admCurrentSnap);
      if (savedY > 0 && admCurrentSnap && !admCurrentSnap.ov) restoreAdmScroll(savedY);
    } catch (e) {
      admBootstrapDone = true;
      toast((e && e.message) || 'تعذر تحميل لوحة التحكم');
      render();
    }
  }

  init();
})();
