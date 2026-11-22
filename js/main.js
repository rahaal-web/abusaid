import { aiHide, bindAIEvents, closeAI, openAI, vStop } from './ai.js';
import {
  bindCartEvents,
  closeCartSheet,
  fClose,
  lines,
  openFlavorModal,
  updCartSummary,
} from './cart.js';
import { clearCachedData, LOGO_FALLBACK, saveCachedData } from './data.js';
import { initFirebaseAnalytics } from './firebase-client.js';
import { bindOfferEvents, renderOffers } from './offers.js';
import {
  $,
  AN,
  cleanCart,
  initCartFromStorage,
  saveCart,
  state,
} from './state.js';
import {
  bindStoreEvents,
  observeReveals,
  renderCategoriesShowcase,
  renderGrid,
  renderHeroSpotlight,
  renderTabs,
  sClose,
  sHide,
} from './store.js';
import { numAr } from './utils.js';

function applyTheme(theme) {
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
    btn.title = isDark ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي';
  }
}

function getSavedTheme() {
  try {
    return localStorage.getItem('abu_theme') || '';
  } catch (e) {
    return '';
  }
}

function initTheme() {
  applyTheme(getSavedTheme());

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
      } catch (e) {}
      applyTheme(next);
    });
  }
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyCustomFonts() {
  const r = document.documentElement.style;
  const C = state.CFG || {};
  const preset = C.fontPreset && String(C.fontPreset).trim();

  let linkEl = document.getElementById('customGoogleFont');
  if (preset) {
    const href =
      'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(preset).replace(/%20/g, '+') +
      ':wght@400;600;700;800&display=swap';
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = 'customGoogleFont';
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }
    if (linkEl.href !== href) linkEl.href = href;
  } else if (linkEl) {
    linkEl.remove();
  }

  const bodyData = C.fontBodyId && state.IMGS[C.fontBodyId];
  const headData = C.fontHeadId && state.IMGS[C.fontHeadId];
  let css = '';
  if (bodyData) {
    css +=
      '@font-face{font-family:"AbuCustomBody";src:url("' +
      bodyData +
      '");font-display:swap;font-weight:100 900;}';
  }
  if (headData) {
    css +=
      '@font-face{font-family:"AbuCustomHead";src:url("' +
      headData +
      '");font-display:swap;font-weight:100 900;}';
  }

  const presetFamily = preset ? '"' + preset.replace(/"/g, '') + '", ' : '';
  const bodyStack = bodyData
    ? '"AbuCustomBody", ' + presetFamily + "'Cairo', Tahoma, Arial, sans-serif"
    : preset
    ? presetFamily + "'Cairo', Tahoma, Arial, sans-serif"
    : "'Cairo', Tahoma, Arial, sans-serif";

  const headStack = headData
    ? '"AbuCustomHead", ' + bodyStack
    : C.fontUnified
    ? bodyStack
    : "'Lalezar', 'Cairo', sans-serif";

  if (headData || C.fontUnified) {
    css +=
      '.brand-txt strong,.hero-title,.sec-title,.otl,.st h3,.pn-head h2,.rhead h2{font-weight:800;}';
  }

  let styleEl = document.getElementById('customFontsStyle');
  if (css) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'customFontsStyle';
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== css) styleEl.textContent = css;
  } else if (styleEl) {
    styleEl.remove();
  }

  r.setProperty('--font-body', bodyStack);
  r.setProperty('--font-head', headStack);
}

function applyCustomColors() {
  const C = state.CFG || {};
  const isHex = (v) => /^#[0-9a-f]{3,8}$/i.test(String(v || '').trim());
  const rules = [];
  const lightRules = [];

  if (isHex(C.cBg) && C.cBg.toLowerCase() !== '#ffd93d') {
    lightRules.push(
      '--bg:' +
        C.cBg +
        ';--bg-soft:color-mix(in srgb,' +
        C.cBg +
        ' 75%,#ffffff);'
    );
  }
  if (isHex(C.cRed) && C.cRed.toLowerCase() !== '#ff4b3e') {
    rules.push(
      '--red:' +
        C.cRed +
        ';--red-dark:color-mix(in srgb,' +
        C.cRed +
        ' 82%,#000);'
    );
  }
  if (isHex(C.cBlue) && C.cBlue.toLowerCase() !== '#2b6cff') {
    rules.push(
      '--blue:' +
        C.cBlue +
        ';--blue-dark:color-mix(in srgb,' +
        C.cBlue +
        ' 82%,#000);'
    );
  }
  if (isHex(C.cGreen) && C.cGreen.toLowerCase() !== '#17b26a') {
    rules.push(
      '--green:' +
        C.cGreen +
        ';--green-dark:color-mix(in srgb,' +
        C.cGreen +
        ' 82%,#000);'
    );
  }

  let css = '';
  if (rules.length) css += ':root{' + rules.join('') + '}';
  if (lightRules.length) {
    css +=
      ':root[data-theme="light"]{' +
      lightRules.join('') +
      '}@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){' +
      lightRules.join('') +
      '}}';
  }

  let styleEl = document.getElementById('customColorsStyle');
  if (css) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'customColorsStyle';
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== css) styleEl.textContent = css;
  } else if (styleEl) {
    styleEl.remove();
  }
}

function handleAuthResponse(res) {
  if (res.status === 401) {
    clearCachedData();
    window.location.replace('/login?reason=expired');
    return false;
  }
  if (res.status === 403) {
    clearCachedData();
    window.location.replace('/account-status');
    return false;
  }
  return true;
}

function loadFontAssets() {
  const C = state.CFG || {};
  [C.fontBodyId, C.fontHeadId].filter(Boolean).forEach((k) => {
    if (state.IMGS[k] || state.IMGQ[k]) return;
    state.IMGQ[k] = 1;
    fetch('/api/img/' + encodeURIComponent(k), { credentials: 'same-origin' })
      .then((r) => {
        if (!handleAuthResponse(r)) return null;
        return r.json();
      })
      .then((v) => {
        delete state.IMGQ[k];
        if (v) {
          state.IMGS[k] = v;
          applyCustomFonts();
        }
      })
      .catch(() => {
        delete state.IMGQ[k];
      });
  });
}

export function applyCfg() {
  const r = document.documentElement.style;
  const C = state.CFG || {};

  if (C.cols && +C.cols > 0) {
    r.setProperty('--cols', String(C.cols));
  } else {
    r.removeProperty('--cols');
  }

  r.setProperty('--k', C.k != null ? C.k + '%' : '64%');

  const bhVal = Math.max(100, Math.min(320, +C.bh || 160));
  r.setProperty('--bh', bhVal + 'px');

  const lsScale = Math.max(0.4, Math.min(1.2, (+C.ls || 100) / 100));
  r.setProperty('--ls', String(lsScale));

  const csScale = Math.max(0.8, Math.min(1.3, (+C.cs || 100) / 100));
  r.setProperty('--cs', String(csScale));

  const clampPx = (v, min, max, def) =>
    Math.max(min, Math.min(max, +v || def)) + 'px';
  r.setProperty('--fs-base', clampPx(C.fsBase, 12, 20, 15));
  r.setProperty('--fs-title', clampPx(C.fsTitle, 13, 22, 16));
  r.setProperty('--fs-price', clampPx(C.fsPrice, 18, 32, 22));
  r.setProperty('--fs-hero', clampPx(C.fsHero, 24, 54, 38));

  applyCustomFonts();
  applyCustomColors();

  const savedTheme = getSavedTheme();
  if (C.hideThemeBtn || !savedTheme) {
    const mode = C.themeMode;
    applyTheme(mode === 'light' || mode === 'dark' ? mode : '');
  }
  const themeBtn = $('themeToggle');
  if (themeBtn) themeBtn.hidden = !!C.hideThemeBtn;

  const brandName =
    C.brandName != null && String(C.brandName).trim()
      ? String(C.brandName).trim()
      : 'أبو سعيد';
  const brandSub =
    C.brandSub != null && String(C.brandSub).trim()
      ? String(C.brandSub).trim()
      : 'جملة الشيبسي والسناكس';

  const brandNameEl = $('brandNameHdr');
  if (brandNameEl) brandNameEl.textContent = brandName;
  const brandSubEl = $('brandSubHdr');
  if (brandSubEl) brandSubEl.textContent = brandSub;
  document.title = brandName + ' – اطلب بضاعتك';

  const b1 = $('heroBadge1');
  if (b1) {
    const t = C.heroBadge != null ? String(C.heroBadge).trim() : '🔥 جملة الجملة';
    b1.textContent = t;
    b1.hidden = !t;
  }
  const b2 = $('heroBadge2');
  if (b2) {
    const t =
      C.heroBadge2 != null ? String(C.heroBadge2).trim() : 'توصيل سريع للمحلات';
    b2.textContent = t;
    b2.hidden = !t;
  }

  const hTitle = $('heroTitleTxt');
  if (hTitle) {
    const rawTitle =
      C.heroTitle != null && String(C.heroTitle).trim()
        ? String(C.heroTitle).trim()
        : 'اطلب بضاعتك من ' + brandName + ' في دقايق';
    const escBrand = escHtml(brandName);
    const escFull = escHtml(rawTitle);
    hTitle.innerHTML =
      brandName && escFull.indexOf(escBrand) > -1
        ? escFull.replace(escBrand, '<span>' + escBrand + '</span>')
        : escFull;
  }

  const hDesc = $('heroDescTxt');
  if (hDesc) {
    hDesc.textContent =
      C.heroDesc != null && String(C.heroDesc).trim()
        ? String(C.heroDesc).trim()
        : 'شيبسي، سناكس، حلويات ومشروبات بأسعار الجملة الحقيقية. اختار الكراتين والنكهات اللي تناسب محلك وابعت طلبك مباشرة على واتساب.';
  }

  const bannerSec = $('topBannerSec');
  if (bannerSec) bannerSec.hidden = !!C.hideBanner;

  const heroVis = $('heroVisualBox');
  const heroCard = $('heroCard');
  if (heroVis) heroVis.hidden = !!C.hideSpotlight;
  if (heroCard) heroCard.classList.toggle('no-visual', !!C.hideSpotlight);

  const catsSec = $('categoriesSec');
  if (catsSec) catsSec.hidden = !!C.hideCatsBox;

  const otl = $('otl');
  if (otl) {
    otl.hidden = !!C.oh;
    otl.textContent = C.ot || 'عروض اليوم';
    const osScale = Math.max(0.6, Math.min(2, (+C.os || 100) / 100));
    otl.style.fontSize = Math.round(24 * osScale) + 'px';
  }

  const lgSrc = (C.logo && state.IMGS[C.logo]) || LOGO_FALLBACK;
  const bimg = $('bimg');
  if (bimg && bimg.src !== lgSrc) bimg.src = lgSrc;

  const hdrLogo = $('hdrLogo');
  if (hdrLogo && hdrLogo.src !== lgSrc) hdrLogo.src = lgSrc;

  const minNote = $('heroMinNote');
  if (minNote) {
    const m = +C.min || 0;
    minNote.textContent =
      m > 0
        ? 'أقل طلب ' + numAr(m) + ' جنيه'
        : 'مفيش حد أدنى للطلب';
  }

  const unitNote = $('heroUnitNote');
  if (unitNote) {
    unitNote.textContent = 'الطلب بالـ ' + (C.unit || 'كرتونة');
  }
}

export function rapply() {
  const C = state.CFG || {};
  const b = $('raiH');
  const hdrAi = $('hdrAi');
  const t = $('raiT');

  if (b) b.hidden = !!C.ro;
  if (hdrAi) hdrAi.hidden = !!C.ro;
  if (t) {
    t.textContent = (C.rt && String(C.rt).trim()) || '✨ اطلب بمساعدة ' + AN();
  }
}

function logoLoad() {
  const k = state.CFG && state.CFG.logo;
  if (!k || state.IMGS[k] || state.IMGQ[k]) return;
  state.IMGQ[k] = 1;
  fetch('/api/img/' + encodeURIComponent(k), { credentials: 'same-origin' })
    .then((r) => {
      if (!handleAuthResponse(r)) return null;
      return r.json();
    })
    .then((v) => {
      delete state.IMGQ[k];
      if (v) {
        state.IMGS[k] = v;
        applyCfg();
      }
    })
    .catch(() => {
      delete state.IMGQ[k];
    });
}

function loadImgs() {
  const need = [];
  const seen = {};

  state.P.forEach((p) => {
    const k = p[8];
    if (k && !state.IMGS[k] && !state.IMGQ[k] && !seen[k]) {
      seen[k] = 1;
      need.push(k);
    }
  });

  (state.D.offers || []).forEach((o) => {
    const k = o.i;
    if (k && !state.IMGS[k] && !state.IMGQ[k] && !seen[k]) {
      seen[k] = 1;
      need.push(k);
    }
  });

  if (!need.length) return;
  let n = 0;
  let tm;

  need.forEach((k) => {
    state.IMGQ[k] = 1;
    fetch('/api/img/' + encodeURIComponent(k), { credentials: 'same-origin' })
      .then((r) => {
        if (!handleAuthResponse(r)) return null;
        return r.json();
      })
      .then((v) => {
        if (v) state.IMGS[k] = v;
      })
      .catch(() => {})
      .then(() => {
        delete state.IMGQ[k];
        n++;
        clearTimeout(tm);
        tm = setTimeout(() => {
          renderGrid();
          renderHeroSpotlight();
          renderOffers();
        }, n >= need.length ? 0 : 70);
      });
  });
}

function ref() {
  applyCfg();
  rapply();
  renderTabs();
  renderCategoriesShowcase();
  renderOffers();
  renderHeroSpotlight();
  renderGrid();
  updCartSummary();
  if ($('sheet') && $('sheet').classList.contains('on')) lines();
  loadImgs();
  logoLoad();
  loadFontAssets();
  observeReveals();
}

function checkSession() {
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => {
      if (!handleAuthResponse(r)) return null;
      return r.json();
    })
    .then((d) => {
      if (!d || !d.user) return;
      state.user = d.user;
      const badge = $('userNameBadge');
      const wrap = $('userBadgeWrap');
      if (badge && wrap) {
        badge.textContent = d.user.fullName || d.user.phone || '';
        wrap.hidden = false;
      }
    })
    .catch(() => {});
}

function sync() {
  fetch('/api/catalog', { credentials: 'same-origin' })
    .then((r) => {
      if (!handleAuthResponse(r)) return null;
      return r.json();
    })
    .then((v) => {
      if (!v) return;
      state.syncing = false;
      if (!v.json || v.ts === state.ct) {
        renderGrid();
        return;
      }
      state.ct = v.ts;
      const o = JSON.parse(v.json);
      if (o.v !== state.D.v) {
        state.cart = {};
        saveCart();
      }
      state.D = o;
      state.CFG = o.cfg || state.CFG;
      state.P = o.p || state.P;
      state.CATS = ['الكل'].concat(o.cats || []);
      if (state.CATS.indexOf(state.cat) < 0) state.cat = 'الكل';
      cleanCart();
      saveCart();
      saveCachedData(o, v.ts);
      ref();
    })
    .catch(() => {
      if (state.syncing) {
        state.syncing = false;
        renderGrid();
      }
    });
}

function registerHooks() {
  state.hooks.renderCatalog = renderGrid;
  state.hooks.renderCategories = () => {
    renderTabs();
    renderCategoriesShowcase();
  };
  state.hooks.renderCartUI = () => {
    updCartSummary();
    if ($('sheet')?.classList.contains('on')) lines();
  };
  state.hooks.renderOffers = renderOffers;
  state.hooks.renderSpotlight = renderHeroSpotlight;
  state.hooks.applyCfg = applyCfg;
  state.hooks.rapply = rapply;
  state.hooks.openFlavorModal = openFlavorModal;
  state.hooks.openAI = openAI;
  state.hooks.closeAI = closeAI;
  state.hooks.closeSearch = sClose;
}

function bindGlobalEvents() {
  const raiH = $('raiH');
  const hdrAi = $('hdrAi');
  if (raiH) raiH.addEventListener('click', openAI);
  if (hdrAi) hdrAi.addEventListener('click', openAI);

  window.addEventListener('popstate', () => {
    if (state.IGN) {
      state.IGN--;
      return;
    }
    const fOn = $('fsheet')?.classList.contains('on');
    const cOn = $('sheet')?.classList.contains('on');
    if (fOn || cOn) {
      if (fOn) fClose();
      if (cOn) closeCartSheet();
      const t = state.LY[state.LY.length - 1];
      if (t) {
        try {
          history.pushState({ ly: 1 }, '');
        } catch (e) {}
      }
      return;
    }
    const x = state.LY.pop();
    if (x) x.f();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('fsheet')?.classList.contains('on')) {
        fClose();
      } else if ($('sheet')?.classList.contains('on')) {
        closeCartSheet();
      } else if ($('rsheet')?.classList.contains('on')) {
        closeAI();
      } else if ($('spage')?.classList.contains('on')) {
        sClose();
      }
      return;
    }

    if (
      e.key === '/' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
    ) {
      const q = $('qHeader') || $('q');
      if (q) {
        e.preventDefault();
        q.focus();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) vStop(false);
    else {
      checkSession();
      sync();
    }
  });

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {}
      clearCachedData();
      window.location.replace('/login?loggedOut=1');
    });
  }
}

function bootstrap() {
  registerHooks();
  initTheme();
  initCartFromStorage();
  cleanCart();

  bindStoreEvents();
  bindCartEvents();
  bindOfferEvents();
  bindAIEvents();
  bindGlobalEvents();

  ref();
  checkSession();
  sync();
  initFirebaseAnalytics();

  setTimeout(() => {
    if (state.syncing) {
      state.syncing = false;
      renderGrid();
    }
  }, 1500);

  setInterval(checkSession, 15000);
  setInterval(sync, 45000);
}

bootstrap();
