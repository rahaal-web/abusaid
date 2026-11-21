import { aiHide, bindAIEvents, closeAI, openAI, vStop } from './ai.js';
import {
  bindCartEvents,
  closeCartSheet,
  fClose,
  lines,
  openFlavorModal,
  updCartSummary,
} from './cart.js';
import { DBU, LOGO_FALLBACK, saveCachedData } from './data.js';
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

function initTheme() {
  let saved = '';
  try {
    saved = localStorage.getItem('abu_theme') || '';
  } catch (e) {}
  applyTheme(saved);

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
  fetch('https://' + DBU + '/chips/img/' + encodeURIComponent(k) + '.json')
    .then((r) => r.json())
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
    fetch('https://' + DBU + '/chips/img/' + encodeURIComponent(k) + '.json')
      .then((r) => r.json())
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
  observeReveals();
}

function sync() {
  fetch('https://' + DBU + '/chips/data.json')
    .then((r) => r.json())
    .then((v) => {
      state.syncing = false;
      if (!v || !v.json || v.ts === state.ct) {
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
    else sync();
  });
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
  sync();

  setTimeout(() => {
    if (state.syncing) {
      state.syncing = false;
      renderGrid();
    }
  }, 1100);

  setInterval(sync, 45000);
}

bootstrap();
