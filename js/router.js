import { $, getSelectedVariantIndex, state } from './state.js';
import { FL, gk, rn } from './utils.js';

const SCROLL_STORAGE_KEY = 'abu_store_scroll_v1';
const SEQ_STORAGE_KEY = 'abu_store_nav_seq_v1';
const VALID_LAYERS = ['cart', 'flavor', 'search', 'ai', 'orders', 'account'];
const VALID_SORTS = ['default', 'price-asc', 'price-desc', 'discount'];
const VALID_SECS = ['categoriesSec', 'offers', 'favoritesSec', 'catalog'];
const VALID_AI_STEPS = ['chat', 'old', 'review'];

let routerInitialized = false;
let currentNavIdx = 0;
let baseNavIdx = 0;
let currentSnapshot = createDefaultSnapshot();
let pendingSyncReconcile = false;
let scrollMap = loadScrollMap();
let searchDebounceTimer = null;

function createDefaultSnapshot() {
  return {
    cat: 'الكل',
    sort: 'default',
    inStockOnly: false,
    searchQuery: '',
    sec: '',
    spot: -1,
    layers: [],
    searchModalQuery: '',
    aiStep: '',
    flavorProdIdx: -1,
    flavorAiMode: false,
  };
}

function loadScrollMap() {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveScrollMap() {
  try {
    const keys = Object.keys(scrollMap)
      .map(Number)
      .filter((k) => Number.isFinite(k))
      .sort((a, b) => a - b);
    if (keys.length > 80) {
      keys.slice(0, keys.length - 80).forEach((k) => {
        delete scrollMap[k];
      });
    }
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(scrollMap));
  } catch {
    // ignore storage errors
  }
}

function nextSeqIdx() {
  try {
    const cur = Number(sessionStorage.getItem(SEQ_STORAGE_KEY) || '0') || 0;
    const next = cur + 1;
    sessionStorage.setItem(SEQ_STORAGE_KEY, String(next));
    return next;
  } catch {
    return Date.now();
  }
}

function saveScrollForNavIdx(idx) {
  if (!Number.isFinite(idx)) return;
  const isModalLocked =
    document.body.classList.contains('modal-open') ||
    Boolean($('spage')?.classList.contains('on'));
  if (isModalLocked) return;
  scrollMap[idx] = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
  saveScrollMap();
}

function restoreScrollImmediate(y) {
  const targetY = Math.max(0, Number(y) || 0);
  const run = () => {
    try {
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, targetY);
    }
  };
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
}

export function normalizeSnapshot(raw) {
  const base = createDefaultSnapshot();
  if (!raw || typeof raw !== 'object') return base;

  const catStr = typeof raw.cat === 'string' && raw.cat.trim() ? raw.cat.trim() : 'الكل';
  const sortStr = VALID_SORTS.includes(raw.sort) ? raw.sort : 'default';
  const inStockOnly = Boolean(raw.inStockOnly);
  const searchQuery = typeof raw.searchQuery === 'string' ? raw.searchQuery : '';
  const secStr = VALID_SECS.includes(raw.sec) ? raw.sec : '';
  const spotNum = Number.isInteger(Number(raw.spot)) && Number(raw.spot) >= 0 ? Number(raw.spot) : -1;

  const layers = [];
  if (Array.isArray(raw.layers)) {
    raw.layers.forEach((l) => {
      const s = String(l || '').trim();
      if (VALID_LAYERS.includes(s) && !layers.includes(s)) {
        layers.push(s);
      }
    });
  }

  const hasSearch = layers.includes('search');
  const hasAi = layers.includes('ai');
  const hasFlavor = layers.includes('flavor');

  const searchModalQuery = hasSearch && typeof raw.searchModalQuery === 'string' ? raw.searchModalQuery : '';
  const getDefaultAiStep = () =>
    state.CFG && (state.CFG.aiUi === 'old' || state.CFG.aiUi === 'old_only') ? 'old' : 'chat';
  const aiStep = hasAi
    ? VALID_AI_STEPS.includes(raw.aiStep)
      ? raw.aiStep
      : getDefaultAiStep()
    : '';
  const flavorProdIdx =
    hasFlavor && Number.isInteger(Number(raw.flavorProdIdx)) && Number(raw.flavorProdIdx) >= 0
      ? Number(raw.flavorProdIdx)
      : -1;
  const flavorAiMode = Boolean(hasFlavor && hasAi && raw.flavorAiMode);

  // Drop dangling flavor layer with invalid index
  const cleanLayers =
    hasFlavor && flavorProdIdx < 0 ? layers.filter((l) => l !== 'flavor') : layers;

  return {
    cat: catStr,
    sort: sortStr,
    inStockOnly,
    searchQuery,
    sec: secStr,
    spot: spotNum,
    layers: cleanLayers,
    searchModalQuery,
    aiStep: cleanLayers.includes('ai') ? aiStep : '',
    flavorProdIdx: cleanLayers.includes('flavor') ? flavorProdIdx : -1,
    flavorAiMode: cleanLayers.includes('flavor') && cleanLayers.includes('ai') ? flavorAiMode : false,
  };
}

function snapshotsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.cat === b.cat &&
    a.sort === b.sort &&
    Boolean(a.inStockOnly) === Boolean(b.inStockOnly) &&
    String(a.searchQuery || '') === String(b.searchQuery || '') &&
    a.sec === b.sec &&
    a.spot === b.spot &&
    a.layers.join('.') === b.layers.join('.') &&
    String(a.searchModalQuery || '') === String(b.searchModalQuery || '') &&
    String(a.aiStep || '') === String(b.aiStep || '') &&
    Number(a.flavorProdIdx) === Number(b.flavorProdIdx) &&
    Boolean(a.flavorAiMode) === Boolean(b.flavorAiMode)
  );
}

export function isHomeSnapshot(snap = currentSnapshot) {
  return (
    snap.cat === 'الكل' &&
    snap.sort === 'default' &&
    !snap.inStockOnly &&
    !snap.searchQuery.trim() &&
    !snap.sec &&
    snap.spot < 0 &&
    snap.layers.length === 0
  );
}

export function hasInternalFilterOrSection(snap = currentSnapshot) {
  return (
    snap.cat !== 'الكل' ||
    snap.sort !== 'default' ||
    snap.inStockOnly ||
    Boolean(snap.searchQuery.trim()) ||
    Boolean(snap.sec) ||
    snap.spot >= 0
  );
}

export function parseSnapshotFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const hash = String(window.location.hash || '').replace(/^#/, '');

  const layers = [];
  const rawView = String(params.get('view') || '').trim();
  if (rawView) {
    rawView.split('.').forEach((part) => {
      if (VALID_LAYERS.includes(part) && !layers.includes(part)) {
        layers.push(part);
      }
    });
  } else if (hash === 's') {
    layers.push('search');
  } else if (hash === 'ai') {
    layers.push('ai');
  }

  let sec = String(params.get('sec') || '').trim();
  if (!sec && VALID_SECS.includes(hash)) {
    sec = hash;
  }

  const prodParam = params.get('prod');
  const flavorProdIdx =
    prodParam !== null && prodParam !== '' && Number.isInteger(Number(prodParam))
      ? Number(prodParam)
      : -1;

  const spotParam = params.get('spot');
  const spot =
    spotParam !== null && spotParam !== '' && Number.isInteger(Number(spotParam))
      ? Number(spotParam)
      : -1;

  const aiStepParam = String(params.get('ai') || '').trim();
  const defaultAiStep =
    state.CFG && (state.CFG.aiUi === 'old' || state.CFG.aiUi === 'old_only') ? 'old' : 'chat';
  const aiStep = layers.includes('ai')
    ? VALID_AI_STEPS.includes(aiStepParam)
      ? aiStepParam
      : defaultAiStep
    : '';

  return normalizeSnapshot({
    cat: params.get('cat') || 'الكل',
    sort: params.get('sort') || 'default',
    inStockOnly: params.get('stock') === '1',
    searchQuery: params.get('q') || '',
    sec,
    spot,
    layers,
    searchModalQuery: params.get('sq') || '',
    aiStep,
    flavorProdIdx,
    flavorAiMode: layers.includes('ai') && layers.includes('flavor'),
  });
}

export function buildUrlFromSnapshot(snap) {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  ['cat', 'sort', 'stock', 'q', 'sec', 'spot', 'view', 'sq', 'ai', 'prod'].forEach((k) => {
    params.delete(k);
  });

  if (snap.cat && snap.cat !== 'الكل') params.set('cat', snap.cat);
  if (snap.sort && snap.sort !== 'default') params.set('sort', snap.sort);
  if (snap.inStockOnly) params.set('stock', '1');
  if (snap.searchQuery && snap.searchQuery.trim()) params.set('q', snap.searchQuery);
  if (snap.sec) params.set('sec', snap.sec);
  if (snap.spot >= 0) params.set('spot', String(snap.spot));

  if (snap.layers.length) {
    params.set('view', snap.layers.join('.'));
    if (snap.layers.includes('search') && snap.searchModalQuery) {
      params.set('sq', snap.searchModalQuery);
    }
    if (snap.layers.includes('ai') && snap.aiStep && snap.aiStep !== 'chat') {
      params.set('ai', snap.aiStep);
    }
    if (snap.layers.includes('flavor') && snap.flavorProdIdx >= 0) {
      params.set('prod', String(snap.flavorProdIdx));
    }
  }

  // Strip managed/section hashes so URL stays canonical query-based
  const h = String(url.hash || '').replace(/^#/, '');
  if (!h || ['top', 's', 'ai', ...VALID_SECS].includes(h)) {
    url.hash = '';
  }

  const qs = params.toString();
  return url.pathname + (qs ? '?' + qs : '') + url.hash;
}

function scrollToTargetSectionOrCard(snap) {
  if (snap.spot >= 0) {
    const card = $('prod-' + snap.spot);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('spotlight-flash');
      setTimeout(() => card.classList.remove('spotlight-flash'), 1200);
      return;
    }
  }
  if (snap.sec) {
    const secEl = $(snap.sec);
    if (secEl) {
      secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  if (isHomeSnapshot(snap)) {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }
}

function applySnapshotToUI(snap, options = {}) {
  const { fromPopstate = false, isInitialLoad = false, targetScrollY = null, scrollTarget = 'auto' } = options;

  // Validate category if catalog already loaded (or wait for sync if syncing)
  const validCat = state.CATS.includes(snap.cat) ? snap.cat : state.syncing ? snap.cat : 'الكل';
  state.cat = validCat;
  state.sort = snap.sort;
  state.inStockOnly = snap.inStockOnly;
  state.searchQuery = snap.searchQuery;
  state.searchModalQuery = snap.searchModalQuery;

  // Keep spotlight variant selection synced
  if (snap.spot >= 0 && state.P[snap.spot]) {
    state.SEL[gk(state.P[snap.spot])] = snap.spot;
  }

  // Sync catalog inputs & grids
  state.hooks.syncFilterInputs?.();
  state.hooks.renderCategories?.();
  state.hooks.renderCatalog?.();

  // Sync overlays cleanly in bottom-to-top layering order
  const layers = snap.layers;
  const wantSearch = layers.includes('search');
  const wantCart = layers.includes('cart');
  const wantOrders = layers.includes('orders');
  const wantAccount = layers.includes('account');
  const wantAi = layers.includes('ai');
  const wantFlavor = layers.includes('flavor');

  // If closing modals on popstate / state switch, close inactive ones first
  if (!wantFlavor) state.hooks.syncFlavorOverlay?.(false, -1, false);
  if (!wantAccount) state.hooks.syncAccountOverlay?.(false);
  if (!wantOrders) state.hooks.syncOrdersOverlay?.(false);
  if (!wantCart) state.hooks.syncCartOverlay?.(false);
  if (!wantAi) state.hooks.syncAiOverlay?.(false, '');
  if (!wantSearch) state.hooks.syncSearchOverlay?.(false, '');

  // Open active overlays
  if (wantSearch) state.hooks.syncSearchOverlay?.(true, snap.searchModalQuery);
  if (wantCart) state.hooks.syncCartOverlay?.(true);
  if (wantOrders) state.hooks.syncOrdersOverlay?.(true);
  if (wantAccount) state.hooks.syncAccountOverlay?.(true);
  if (wantAi) {
    const defStep =
      state.CFG && (state.CFG.aiUi === 'old' || state.CFG.aiUi === 'old_only') ? 'old' : 'chat';
    state.hooks.syncAiOverlay?.(true, snap.aiStep || defStep, { fromPopstate, isInitialLoad });
  }
  if (wantFlavor) {
    const p = state.P[snap.flavorProdIdx];
    const validFlavorProd = p && FL(p).length > 0;
    if (validFlavorProd || state.syncing) {
      state.hooks.syncFlavorOverlay?.(true, snap.flavorProdIdx, snap.flavorAiMode, {
        fromPopstate,
        isInitialLoad,
      });
    }
  }

  // Scroll handling
  const hasBlockingFullscreen = wantSearch || wantCart || wantOrders || wantAccount || wantAi || wantFlavor;
  if (fromPopstate || isInitialLoad) {
    if (targetScrollY != null && Number.isFinite(Number(targetScrollY)) && !hasBlockingFullscreen) {
      restoreScrollImmediate(targetScrollY);
    } else if (isInitialLoad && !hasBlockingFullscreen && (snap.spot >= 0 || snap.sec)) {
      requestAnimationFrame(() => scrollToTargetSectionOrCard(snap));
    }
  } else if (scrollTarget === 'section' && !hasBlockingFullscreen) {
    scrollToTargetSectionOrCard(snap);
  }
}

export function commitRoute(partialOrUpdater, options = {}) {
  clearTimeout(searchDebounceTimer);

  const prevSnap = currentSnapshot;
  const rawNext =
    typeof partialOrUpdater === 'function'
      ? partialOrUpdater({ ...prevSnap, layers: [...prevSnap.layers] })
      : { ...prevSnap, ...partialOrUpdater };
  const nextSnap = normalizeSnapshot(rawNext);
  const mode = options.mode === 'replace' ? 'replace' : 'push';

  if (mode === 'push' && snapshotsEqual(prevSnap, nextSnap)) {
    if (options.scrollTarget === 'section') {
      scrollToTargetSectionOrCard(nextSnap);
    }
    return currentSnapshot;
  }

  if (mode === 'push') {
    saveScrollForNavIdx(currentNavIdx);
    currentNavIdx = nextSeqIdx();
  }

  currentSnapshot = nextSnap;
  const nextUrl = buildUrlFromSnapshot(nextSnap);
  const histState = {
    __abuNav: 1,
    navIdx: currentNavIdx,
    baseIdx: baseNavIdx,
    snapshot: nextSnap,
  };

  try {
    if (mode === 'replace') {
      history.replaceState(histState, '', nextUrl);
    } else {
      history.pushState(histState, '', nextUrl);
    }
  } catch {
    // fallback silently if history throttled
  }

  applySnapshotToUI(nextSnap, {
    scrollTarget: options.scrollTarget || 'none',
  });

  if (mode === 'push' && options.resetScrollTop) {
    restoreScrollImmediate(0);
  }

  return currentSnapshot;
}

export function scheduleSearchRoute(val, isModal = false) {
  const str = String(val || '');
  const trimmed = isModal ? rn(str.trim()) : str.trim();

  if (isModal) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      commitRoute(
        (s) => ({
          ...s,
          searchModalQuery: trimmed,
        }),
        { mode: 'replace' }
      );
    }, 220);
    return;
  }

  const wasEmpty = !String(currentSnapshot.searchQuery || '').trim();
  const isNowEmpty = !trimmed;

  // Immediate UI sync via caller; history updates smartly:
  // push once when entering search from non-search, otherwise replaceState to avoid keystroke flooding
  clearTimeout(searchDebounceTimer);
  const commitMode = wasEmpty && !isNowEmpty ? 'push' : 'replace';
  searchDebounceTimer = setTimeout(
    () => {
      commitRoute(
        (s) => ({
          ...s,
          searchQuery: str,
          spot: -1,
        }),
        { mode: commitMode }
      );
    },
    commitMode === 'push' ? 120 : 260
  );
}

export function pushOverlay(layer, extra = {}) {
  if (state.hooks.isMandatoryPushOpen?.()) return;
  commitRoute(
    (s) => {
      const nextLayers = s.layers.filter((l) => l !== layer);
      nextLayers.push(layer);
      return {
        ...s,
        ...extra,
        layers: nextLayers,
      };
    },
    { mode: 'push' }
  );
}

export function switchOverlay(layer, extra = {}) {
  if (state.hooks.isMandatoryPushOpen?.()) return;
  const defStep =
    state.CFG && (state.CFG.aiUi === 'old' || state.CFG.aiUi === 'old_only') ? 'old' : 'chat';
  commitRoute(
    (s) => ({
      ...s,
      ...extra,
      layers: layer ? [layer] : [],
      aiStep: layer === 'ai' ? extra.aiStep || defStep : '',
      flavorProdIdx: layer === 'flavor' ? (extra.flavorProdIdx ?? -1) : -1,
      flavorAiMode: false,
    }),
    { mode: 'replace' }
  );
}

export function popOverlay(layerName) {
  if (state.hooks.isMandatoryPushOpen?.()) return;
  const idx = currentSnapshot.layers.indexOf(layerName);
  if (idx < 0) return;

  if (currentNavIdx > baseNavIdx) {
    history.back();
    return;
  }

  // Direct link / landed on modal at base entry: strip layer via replaceState so user never exits site
  const nextLayers = currentSnapshot.layers.slice(0, idx);
  commitRoute(
    (s) => ({
      ...s,
      layers: nextLayers,
      aiStep: nextLayers.includes('ai') ? s.aiStep : '',
      searchModalQuery: nextLayers.includes('search') ? s.searchModalQuery : '',
      flavorProdIdx: nextLayers.includes('flavor') ? s.flavorProdIdx : -1,
      flavorAiMode: nextLayers.includes('flavor') && nextLayers.includes('ai') ? s.flavorAiMode : false,
    }),
    { mode: 'replace' }
  );
}

export function closeTopOverlay() {
  if (state.hooks.isMandatoryPushOpen?.()) return false;
  if (!currentSnapshot.layers.length) return false;
  const top = currentSnapshot.layers[currentSnapshot.layers.length - 1];
  popOverlay(top);
  return true;
}

export function canGoBack() {
  return currentNavIdx > baseNavIdx;
}

export function goBackOrHome() {
  if (state.hooks.isMandatoryPushOpen?.()) return;
  if (currentNavIdx > baseNavIdx) {
    history.back();
    return;
  }
  if (!isHomeSnapshot(currentSnapshot)) {
    commitRoute(createDefaultSnapshot(), { mode: 'push', resetScrollTop: true });
    return;
  }
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  } catch {
    window.scrollTo(0, 0);
  }
}

export function getCurrentSnapshot() {
  return currentSnapshot;
}

export function reconcilePendingRouteAfterSync() {
  if (!pendingSyncReconcile) return;
  pendingSyncReconcile = false;

  const snap = currentSnapshot;
  let changed = false;
  let nextCat = snap.cat;

  if (nextCat !== 'الكل' && !state.CATS.includes(nextCat)) {
    nextCat = 'الكل';
    changed = true;
  }

  let nextSpot = snap.spot;
  if (nextSpot >= 0 && !state.P[nextSpot]) {
    nextSpot = -1;
    changed = true;
  } else if (nextSpot >= 0 && state.P[nextSpot]) {
    const p = state.P[nextSpot];
    state.SEL[gk(p)] = nextSpot;
    if (nextCat === 'الكل') {
      nextCat = p[1];
      changed = true;
    }
  }

  let nextLayers = [...snap.layers];
  let nextFlavorIdx = snap.flavorProdIdx;
  if (nextLayers.includes('flavor')) {
    const prod = state.P[nextFlavorIdx];
    if (!prod || !FL(prod).length) {
      nextLayers = nextLayers.filter((l) => l !== 'flavor');
      nextFlavorIdx = -1;
      changed = true;
    }
  }

  const nextSnap = changed
    ? normalizeSnapshot({
        ...snap,
        cat: nextCat,
        spot: nextSpot,
        layers: nextLayers,
        flavorProdIdx: nextFlavorIdx,
      })
    : snap;

  if (changed) {
    currentSnapshot = nextSnap;
    try {
      history.replaceState(
        {
          __abuNav: 1,
          navIdx: currentNavIdx,
          baseIdx: baseNavIdx,
          snapshot: nextSnap,
        },
        '',
        buildUrlFromSnapshot(nextSnap)
      );
    } catch {
      // ignore
    }
  }

  const savedScrollY = scrollMap[currentNavIdx];
  applySnapshotToUI(nextSnap, {
    isInitialLoad: true,
    targetScrollY: savedScrollY != null ? savedScrollY : null,
  });
}

function handlePopState(event) {
  if (state.hooks.isMandatoryPushOpen?.()) {
    return;
  }

  clearTimeout(searchDebounceTimer);

  // Save current scroll only if not in modal? Wait: on popstate browser already changed state/scroll,
  // so just read target snapshot + target saved scroll cleanly WITHOUT ever calling pushState!
  const st = event && event.state && event.state.__abuNav === 1 ? event.state : null;
  const targetSnap = st ? normalizeSnapshot(st.snapshot) : parseSnapshotFromLocation();
  const targetNavIdx = st && Number.isFinite(st.navIdx) ? st.navIdx : baseNavIdx;

  if (st && Number.isFinite(st.baseIdx)) {
    baseNavIdx = Math.min(baseNavIdx, st.baseIdx);
  }
  currentNavIdx = targetNavIdx;
  currentSnapshot = targetSnap;

  const savedY = scrollMap[targetNavIdx];
  applySnapshotToUI(targetSnap, {
    fromPopstate: true,
    targetScrollY: savedY != null ? savedY : 0,
  });
}

export function initRouter() {
  if (routerInitialized) return;
  routerInitialized = true;

  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch {
    // ignore
  }

  const existing = history.state && history.state.__abuNav === 1 ? history.state : null;
  const initialSnap = existing
    ? normalizeSnapshot(existing.snapshot)
    : parseSnapshotFromLocation();

  if (existing && Number.isFinite(existing.navIdx)) {
    currentNavIdx = existing.navIdx;
    baseNavIdx = Number.isFinite(existing.baseIdx) ? existing.baseIdx : existing.navIdx;
    try {
      const seqNow = Number(sessionStorage.getItem(SEQ_STORAGE_KEY) || '0') || 0;
      if (currentNavIdx > seqNow) {
        sessionStorage.setItem(SEQ_STORAGE_KEY, String(currentNavIdx));
      }
    } catch {
      // ignore
    }
  } else {
    const seq = nextSeqIdx();
    currentNavIdx = seq;
    baseNavIdx = seq;
    try {
      history.replaceState(
        {
          __abuNav: 1,
          navIdx: currentNavIdx,
          baseIdx: baseNavIdx,
          snapshot: initialSnap,
        },
        '',
        buildUrlFromSnapshot(initialSnap)
      );
    } catch {
      // ignore
    }
  }

  currentSnapshot = initialSnap;
  pendingSyncReconcile = true;

  const savedScrollY = scrollMap[currentNavIdx];
  applySnapshotToUI(initialSnap, {
    isInitialLoad: true,
    targetScrollY: savedScrollY != null ? savedScrollY : null,
  });

  let scrollTrackTimer = null;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTrackTimer);
      scrollTrackTimer = setTimeout(() => saveScrollForNavIdx(currentNavIdx), 120);
    },
    { passive: true }
  );

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('pagehide', () => saveScrollForNavIdx(currentNavIdx));
}
