import { DEFAULT_DATA, loadCachedData } from './data.js';
import { FL, gk, pk } from './utils.js';

const cached = loadCachedData();
const initialData = cached ? cached.data : DEFAULT_DATA;

export const state = {
  D: initialData,
  CFG: initialData.cfg,
  P: initialData.p,
  CATS: ['الكل'].concat(initialData.cats || []),
  ct: cached ? cached.ts || 0 : 0,
  syncing: !cached || !(cached.data && Array.isArray(cached.data.p) && cached.data.p.length),
  user: null,
  IMGS: {},
  IMGQ: {},
  cart: {},
  cat: 'الكل',
  sort: 'default',
  inStockOnly: false,
  searchQuery: '',
  searchModalQuery: '',
  SOPEN: 0,
  IGN: 0,
  SEL: {},
  OI: 0,
  OT: null,
  OP: 0,
  LY: [],
  hooks: {
    renderCatalog: () => {},
    renderCategories: () => {},
    renderCartUI: () => {},
    renderOffers: () => {},
    renderSpotlight: () => {},
    applyCfg: () => {},
    rapply: () => {},
    openFlavorModal: () => {},
    openAI: () => {},
    closeAI: () => {},
    closeSearch: () => {},
  },
};

export function initCartFromStorage() {
  try {
    const sv = JSON.parse(localStorage.getItem('cart') || 'null');
    if (sv && sv.v === state.D.v && sv.c && typeof sv.c === 'object') {
      state.cart = sv.c;
    }
  } catch (e) {
    state.cart = {};
  }
}

export function saveCart() {
  try {
    localStorage.setItem('cart', JSON.stringify({ v: state.D.v, c: state.cart }));
  } catch (e) {
    // ignore storage errors
  }
}

export function cleanCart() {
  Object.keys(state.cart).forEach((k) => {
    const x = pk(k);
    const p = state.P[x.i];
    const fl = p ? FL(p) : [];
    if (!p || (x.f >= 0 ? !fl[x.f] : fl.length > 0)) {
      delete state.cart[k];
    }
  });
}

export function gidx(p) {
  const a = [];
  state.P.forEach((x, j) => {
    if (x[1] === p[1] && x[0] === p[0]) a.push(j);
  });
  return a;
}

export function vlab(i) {
  const p = state.P[i];
  const g = gidx(p);
  if (g.length < 2) return '';
  const l = p[10] || p[2] || '';
  const pr = p[3].toLocaleString('ar-EG') + ' جنيه';
  if (!l) return pr;
  const d = g.some((j) => j !== i && (state.P[j][10] || state.P[j][2] || '') === l);
  return d ? l + ' · ' + pr : l;
}

export function pname(i) {
  const l = vlab(i);
  return state.P[i][0] + (l ? ' · ' + l : '');
}

export function pq(i) {
  let n = 0;
  Object.keys(state.cart).forEach((k) => {
    if (pk(k).i === i) n += state.cart[k];
  });
  return n;
}

export function totals() {
  let n = 0;
  let s = 0;
  Object.keys(state.cart).forEach((k) => {
    const p = state.P[pk(k).i];
    if (!p) return;
    n += state.cart[k];
    s += state.cart[k] * p[3];
  });
  return { n, s };
}

export function grp() {
  const m = {};
  Object.keys(state.cart).forEach((k) => {
    const i = pk(k).i;
    if (!state.P[i]) return;
    (m[i] = m[i] || []).push(k);
  });
  return Object.keys(m)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => ({
      i,
      ks: m[i].sort((a, b) => pk(a).f - pk(b).f),
    }));
}

export function AN() {
  const n = state.CFG && state.CFG.rn != null ? String(state.CFG.rn).trim() : '';
  return n || 'Rahal Ai';
}

export function $(id) {
  return document.getElementById(id);
}

let toastTimer = null;
export function showToast(msg, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('on');
  }, 2800);
}

export function getSelectedVariantIndex(p0) {
  const key = gk(p0);
  const gi = gidx(p0);
  let i = state.SEL[key];
  if (gi.indexOf(i) < 0) {
    i = gi[0];
    for (let z = 0; z < gi.length; z++) {
      const candidate = state.P[gi[z]];
      const fl = FL(candidate);
      const out = !!(candidate[7] || (fl.length && fl.every((f) => f[1])));
      if (!out) {
        i = gi[z];
        break;
      }
    }
  }
  return { key, gi, i };
}
