import { chg, openFlavorModal } from './cart.js';
import {
  commitRoute,
  getCurrentSnapshot,
  goBackOrHome,
  hasInternalFilterOrSection,
  popOverlay,
  pushOverlay,
  scheduleSearchRoute,
} from './router.js';
import {
  $,
  clearFavorites,
  getSelectedVariantIndex,
  gidx,
  isFavorite,
  pname,
  pq,
  showToast,
  state,
  toggleFavoriteByIndex,
  vlab,
} from './state.js';
import {
  bag,
  esc,
  FL,
  getCatMeta,
  gk,
  isOut,
  money,
  nk,
  numAr,
  rn,
} from './utils.js';

let revealObserver = null;

function initRevealObserver() {
  if (typeof IntersectionObserver === 'undefined') return;
  if (revealObserver) return;
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.06, rootMargin: '0px 0px -24px 0px' }
  );
}

export function observeReveals() {
  initRevealObserver();
  const els = document.querySelectorAll('.rv:not(.in)');
  if (!revealObserver) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  els.forEach((el) => revealObserver.observe(el));
}

export function pills(gi, sel) {
  if (gi.length < 2) return '';
  return (
    '<div class="vars" role="group" aria-label="الأحجام المتاحة">' +
    gi
      .map((j) => {
        const q = pq(j);
        return (
          '<button type="button" class="vp' +
          (j === sel ? ' on' : '') +
          (isOut(state.P[j]) ? ' x' : '') +
          '" data-v="' +
          j +
          '">' +
          '<span>' +
          esc(vlab(j)) +
          '</span>' +
          (q ? '<b>' + numAr(q) + '</b>' : '') +
          '</button>'
        );
      })
      .join('') +
    '</div>'
  );
}

function buildGroupedItems(qq, applyCatAndFilter) {
  const seen = {};
  const list = [];

  const catMeta = (state.D && state.D.catMeta) || {};
  state.P.forEach((p0) => {
    if (catMeta[p0[1]] && catMeta[p0[1]].disabled) return;
    if (qq) {
      const hay = rn(
        p0[0] +
          ' ' +
          p0[1] +
          ' ' +
          (p0[2] || '') +
          ' ' +
          (p0[10] || '') +
          ' ' +
          FL(p0)
            .map((f) => f[0])
            .join(' ')
      );
      if (hay.indexOf(qq) < 0) return;
    } else if (applyCatAndFilter && state.cat !== 'الكل' && p0[1] !== state.cat) {
      return;
    }

    const key = gk(p0);
    if (seen[key]) return;
    seen[key] = 1;

    const { gi, i } = getSelectedVariantIndex(p0);
    const p = state.P[i];
    const out = isOut(p);
    if (applyCatAndFilter && state.inStockOnly && out) return;

    const ol = +p[11] > p[3] ? +p[11] : 0;
    const ds = ol ? Math.round(((ol - p[3]) / ol) * 100) : 0;

    list.push({ p, i, gi, out, ol, ds });
  });

  if (applyCatAndFilter && state.sort !== 'default') {
    if (state.sort === 'price-asc') {
      list.sort((a, b) => a.p[3] - b.p[3]);
    } else if (state.sort === 'price-desc') {
      list.sort((a, b) => b.p[3] - a.p[3]);
    } else if (state.sort === 'discount') {
      list.sort((a, b) => b.ds - a.ds || a.p[3] - b.p[3]);
    }
  }

  return list;
}

function heartIconSvg(filled) {
  return (
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" ' +
    (filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.2"') +
    '/></svg>'
  );
}

function renderCardHtml({ p, i, gi, out, ol, ds }, idPrefix = 'prod-') {
  const fl = FL(p);
  const hf = fl.length > 0;
  const q = hf ? pq(i) : state.cart[i] || 0;
  const fav = isFavorite(p);
  const imgKey = p[8];
  const im = imgKey && state.IMGS[imgKey];
  const isFetchingImg = !!(imgKey && state.IMGQ[imgKey] && !im);

  const mediaHtml = im
    ? '<img src="' +
      im +
      '" alt="' +
      esc(p[0]) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
    : isFetchingImg
    ? '<div class="pic-skel" aria-hidden="true"></div>'
    : bag(p[4], p[5], p[6]);

  const actionHtml = out
    ? '<button type="button" class="add soldout" disabled>خلصان</button>'
    : hf
    ? q
      ? '<button type="button" class="add fl" data-o="' +
        i +
        '">النكهات<b class="fcount">' +
        numAr(q) +
        '</b></button>'
      : '<button type="button" class="add" data-o="' +
        i +
        '">+ النكهات</button>'
    : q
    ? '<div class="step">' +
      '<button type="button" data-k="' +
      i +
      '" data-d="1" aria-label="زيادة الكمية">+</button>' +
      '<span>' +
      numAr(q) +
      '</span>' +
      '<button type="button" data-k="' +
      i +
      '" data-d="-1" aria-label="تقليل الكمية">−</button>' +
      '</div>'
    : '<button type="button" class="add" data-k="' +
      i +
      '" data-d="1">+ ضيف للسلة</button>';

  return (
    '<article class="card' +
    (hf && !out ? ' hasfl' : '') +
    (out ? ' is-out' : '') +
    '"' +
    (hf && !out ? ' data-o="' + i + '"' : '') +
    ' id="' +
    idPrefix +
    i +
    '">' +
    '<div class="pic' +
    (im ? ' has' : '') +
    '">' +
    mediaHtml +
    (ds ? '<span class="dsc">خصم ' + numAr(ds) + '٪</span>' : '') +
    (out ? '<span class="out-tag">نفد المخزون</span>' : '') +
    '<button type="button" class="fav-btn' +
    (fav ? ' on' : '') +
    '" data-fav="' +
    i +
    '" aria-label="' +
    (fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة') +
    '" aria-pressed="' +
    (fav ? 'true' : 'false') +
    '" title="' +
    (fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة') +
    '">' +
    heartIconSvg(fav) +
    '</button>' +
    '</div>' +
    '<div class="info">' +
    '<div class="meta-line">' +
    '<span>' +
    esc(p[1]) +
    '</span>' +
    (hf ? '<span aria-hidden="true">·</span><span class="nfl-txt">' + nk(fl.length) + '</span>' : '') +
    '</div>' +
    '<h3 class="ptitle">' +
    esc(p[0]) +
    '</h3>' +
    '<small class="ppack">' +
    esc(p[2]) +
    '</small>' +
    pills(gi, i) +
    '<div class="price">' +
    (ol ? '<s>' + numAr(ol) + '</s>' : '') +
    '<span>' +
    numAr(p[3]) +
    '</span>' +
    '<i>جنيه / ' +
    esc(state.CFG.unit || 'كرتونة') +
    '</i>' +
    '</div>' +
    '</div>' +
    '<div class="card-act">' +
    actionHtml +
    '</div>' +
    '</article>'
  );
}

export function renderSkeletonGrid(count = 8) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html +=
      '<div class="card skel-card" aria-hidden="true">' +
      '<div class="skel-pic"></div>' +
      '<div class="skel-body">' +
      '<div class="skel-line w40"></div>' +
      '<div class="skel-line w80"></div>' +
      '<div class="skel-line w60"></div>' +
      '<div class="skel-btn"></div>' +
      '</div>' +
      '</div>';
  }
  return html;
}

export function renderTabs() {
  const catsEl = $('cats');
  if (!catsEl) return;
  catsEl.innerHTML = state.CATS.map(
    (c) =>
      '<button type="button" class="' +
      (c === state.cat ? 'on' : '') +
      '" data-c="' +
      esc(c) +
      '">' +
      esc(c) +
      '</button>'
  ).join('');
}

export function renderCategoriesShowcase() {
  const wrap = $('catShowcase');
  if (!wrap) return;

  const counts = {};
  const seen = {};
  state.P.forEach((p0) => {
    const key = gk(p0);
    if (seen[key]) return;
    seen[key] = 1;
    counts[p0[1]] = (counts[p0[1]] || 0) + 1;
  });
  const totalUnique = Object.keys(seen).length;

  wrap.innerHTML = state.CATS.map((c) => {
    const meta = getCatMeta(c);
    const customCatMeta = (state.D && state.D.catMeta && state.D.catMeta[c]) || null;
    const catImg = customCatMeta && customCatMeta.imageId && state.IMGS[customCatMeta.imageId];
    const count = c === 'الكل' ? totalUnique : counts[c] || 0;
    const isActive = c === state.cat && !state.searchQuery;
    return (
      '<button type="button" class="cat-card' +
      (isActive ? ' on' : '') +
      '" data-cat-pick="' +
      esc(c) +
      '">' +
      '<span class="cat-ico" style="background:' +
      meta.bg +
      '" aria-hidden="true">' +
      (catImg
        ? '<img src="' + catImg + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'
        : meta.icon) +
      '</span>' +
      '<span class="cat-txt">' +
      '<b>' +
      esc(c) +
      '</b>' +
      '<small>' +
      numAr(count) +
      ' صنف</small>' +
      '</span>' +
      '</button>'
    );
  }).join('');
}

export function renderHeroSpotlight() {
  const wrap = $('heroSpotlight');
  if (!wrap) return;

  const grouped = buildGroupedItems('', false).filter((x) => !x.out);
  const withImg = grouped.filter((x) => x.p[8] && state.IMGS[x.p[8]]);
  const withoutImg = grouped.filter((x) => !(x.p[8] && state.IMGS[x.p[8]]));
  const picks = withImg.concat(withoutImg).slice(0, 3);

  wrap.innerHTML = picks
    .map(({ p, i }) => {
      const im = p[8] && state.IMGS[p[8]];
      return (
        '<button type="button" class="spot-item" data-spot="' +
        i +
        '" data-spot-cat="' +
        esc(p[1]) +
        '">' +
        '<span class="spot-pic">' +
        (im
          ? '<img src="' +
            im +
            '" alt="' +
            esc(p[0]) +
            '" referrerpolicy="no-referrer">'
          : bag(p[4], p[5], p[6])) +
        '</span>' +
        '<span class="spot-info">' +
        '<b>' +
        esc(p[0]) +
        '</b>' +
        '<small>' +
        money(p[3]) +
        '</small>' +
        '</span>' +
        '</button>'
      );
    })
    .join('');
}

export function renderFavorites() {
  const favGrid = $('favGrid');
  const favEmpty = $('favEmpty');
  const favCount = $('favCount');
  const clearBtn = $('favClearBtn');
  const hdrFavBtn = $('hdrFavBtn');
  const hdrFavCount = $('hdrFavCount');

  const allItems = buildGroupedItems('', false);
  const byGroupKey = new Map();
  allItems.forEach((item) => {
    byGroupKey.set(gk(item.p), item);
  });

  const favItems = [];
  (state.favorites || []).forEach((key) => {
    const found = byGroupKey.get(key);
    if (found) favItems.push(found);
  });

  if (hdrFavCount) {
    hdrFavCount.textContent = numAr(favItems.length);
    hdrFavCount.hidden = favItems.length === 0;
  }
  if (hdrFavBtn) {
    hdrFavBtn.classList.toggle('has-favs', favItems.length > 0);
    const favLabel =
      favItems.length > 0
        ? 'قائمة المفضلة (' + numAr(favItems.length) + ')'
        : 'قائمة المفضلة';
    hdrFavBtn.setAttribute('aria-label', favLabel);
    hdrFavBtn.title = favLabel;
  }

  if (!favGrid && !favEmpty && !favCount) return;

  if (favCount) favCount.textContent = numAr(favItems.length);
  if (clearBtn) clearBtn.hidden = favItems.length === 0;

  if (!favItems.length) {
    if (favEmpty) favEmpty.hidden = false;
    if (favGrid) {
      favGrid.hidden = true;
      favGrid.innerHTML = '';
    }
    return;
  }

  if (favEmpty) favEmpty.hidden = true;
  if (favGrid) {
    favGrid.hidden = false;
    favGrid.innerHTML = favItems.map((item) => renderCardHtml(item, 'fav-prod-')).join('');
  }
}

export function renderGrid() {
  const gridEl = $('grid');
  const statusEl = $('catalogStatus');

  if (state.syncing && gridEl) {
    gridEl.innerHTML = renderSkeletonGrid(8);
    return;
  }

  const qNorm = rn(state.searchQuery.trim());
  const items = buildGroupedItems(qNorm, !qNorm);

  if (statusEl) {
    const snap = getCurrentSnapshot();
    const showBack = hasInternalFilterOrSection(snap) || Boolean(qNorm) || state.cat !== 'الكل' || state.inStockOnly || state.sort !== 'default';
    const backBtnHtml = showBack
      ? '<button type="button" class="nav-back-btn" id="catalogBackBtn">→ رجوع</button> '
      : '';
    if (qNorm) {
      statusEl.innerHTML =
        backBtnHtml +
        'نتائج البحث عن «<b>' +
        esc(state.searchQuery.trim()) +
        '</b>» · ' +
        numAr(items.length) +
        ' صنف <button type="button" class="link-reset" id="resetFilterBtn">عرض الكل</button>';
      statusEl.hidden = false;
    } else if (state.cat !== 'الكل' || state.inStockOnly || state.sort !== 'default') {
      statusEl.innerHTML =
        backBtnHtml +
        'عرض ' +
        numAr(items.length) +
        ' صنف' +
        (state.cat !== 'الكل' ? ' في قسم <b>' + esc(state.cat) + '</b>' : '') +
        ' <button type="button" class="link-reset" id="resetFilterBtn">إعادة ضبط</button>';
      statusEl.hidden = false;
    } else {
      statusEl.innerHTML =
        backBtnHtml +
        'كل الأصناف (' + numAr(items.length) + ' صنف)';
      statusEl.hidden = false;
    }
  }

  if (gridEl) {
    if (items.length) {
      gridEl.innerHTML = items.map((item) => renderCardHtml(item, 'prod-')).join('');
    } else {
      gridEl.innerHTML =
        '<div class="empty-box">' +
        '<span class="empty-ico" aria-hidden="true">🔍</span>' +
        '<b>ما لقيناش أصناف مطابقة</b>' +
        '<p>جرّب كلمة بحث تانية أو استعرض كل الأقسام.</p>' +
        '<button type="button" class="btn-primary" id="emptyResetBtn">عرض كل الأصناف</button>' +
        '</div>';
    }
  }

  renderFavorites();

  if (state.SOPEN && $('sgrid')) {
    if (!state.searchModalQuery) {
      $('sgrid').innerHTML =
        '<div class="empty-box"><p>اكتب اسم الصنف أو النكهة اللي بتدوّر عليها</p></div>';
    } else {
      const sItems = buildGroupedItems(state.searchModalQuery, false);
      $('sgrid').innerHTML = sItems.length
        ? sItems.map((item) => renderCardHtml(item, 's-prod-')).join('')
        : '<div class="empty-box"><span class="empty-ico" aria-hidden="true">🔍</span><b>ما لقيناش صنف بالاسم ده</b><p>جرّب تكتب اسم تاني</p></div>';
    }
  }
}

export function syncFilterInputs() {
  const sortEl = $('sortSelect');
  const stockEl = $('inStockToggle');
  const qEl = $('q');
  const qHdr = $('qHeader');
  const qClear = $('qClear');
  if (sortEl && sortEl.value !== state.sort) sortEl.value = state.sort;
  if (stockEl && stockEl.checked !== Boolean(state.inStockOnly)) {
    stockEl.checked = Boolean(state.inStockOnly);
  }
  if (qEl && qEl.value !== state.searchQuery) qEl.value = state.searchQuery;
  if (qHdr && qHdr.value !== state.searchQuery) qHdr.value = state.searchQuery;
  if (qClear) qClear.hidden = !String(state.searchQuery || '').trim();
}

export function setSearchQuery(val) {
  state.searchQuery = val;
  syncFilterInputs();
  renderCategoriesShowcase();
  renderGrid();
}

export function resetAllFilters() {
  commitRoute(
    {
      cat: 'الكل',
      sort: 'default',
      inStockOnly: false,
      searchQuery: '',
      sec: '',
      spot: -1,
    },
    { mode: 'push' }
  );
}

export function syncSearchOverlay(isOpen, modalQuery = '') {
  const spage = $('spage');
  const q2 = $('q2');
  if (isOpen) {
    state.searchModalQuery = rn(String(modalQuery || '').trim());
    if (q2 && document.activeElement !== q2) {
      q2.value = state.searchModalQuery || '';
    }
    if (spage && !spage.classList.contains('on')) {
      spage.classList.add('on');
      spage.scrollTop = 0;
    }
    state.SOPEN = 1;
  } else {
    if (spage && spage.classList.contains('on')) {
      spage.classList.remove('on');
    }
    state.SOPEN = 0;
  }
  ovf();
  renderGrid();
}

export function openSearchPage(v) {
  const t = rn(String(v || '').trim());
  if (!t) {
    const qEl = $('q');
    if (qEl) qEl.focus();
    return;
  }
  const spage = $('spage');
  const q2 = $('q2');
  if (q2) q2.value = String(v).trim();

  if (spage && spage.classList.contains('on')) {
    commitRoute({ searchModalQuery: t }, { mode: 'replace' });
  } else {
    pushOverlay('search', { searchModalQuery: t });
  }
  if (spage) spage.scrollTop = 0;
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
}

export function sHide() {
  syncSearchOverlay(false, '');
}

export function sClose() {
  popOverlay('search');
}

export function syncFavoritesOverlay(isOpen) {
  const favSheet = $('favoritesSheet');
  if (!favSheet) return;
  if (isOpen) {
    renderFavorites();
    if (!favSheet.classList.contains('on')) {
      favSheet.classList.add('on');
      favSheet.scrollTop = 0;
    }
  } else {
    favSheet.classList.remove('on');
  }
  ovf();
}

export function openFavoritesPage() {
  pushOverlay('favorites');
}

export function closeFavoritesPage() {
  popOverlay('favorites');
}

export function ovf() {
  const rOn = $('rsheet') && $('rsheet').classList.contains('on');
  const sOn = $('spage') && $('spage').classList.contains('on');
  const favOn = $('favoritesSheet') && $('favoritesSheet').classList.contains('on');
  const anyOverlayOpen = Boolean(
    rOn ||
      sOn ||
      favOn ||
      $('sheet')?.classList.contains('on') ||
      $('fsheet')?.classList.contains('on') ||
      $('ordersSheet')?.classList.contains('on') ||
      $('accountSheet')?.classList.contains('on') ||
      $('pushMandatoryModal')?.classList.contains('on')
  );
  document.body.style.overflow = rOn || sOn || favOn ? 'hidden' : '';
  document.body.classList.toggle('modal-open', anyOverlayOpen);
}

export function bindStoreEvents() {
  const handleGridClick = (e) => {
    if (e.target.id === 'emptyResetBtn' || e.target.id === 'resetFilterBtn') {
      resetAllFilters();
      return;
    }
    if (e.target.id === 'catalogBackBtn') {
      goBackOrHome();
      return;
    }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      const res = toggleFavoriteByIndex(+favBtn.dataset.fav);
      if (res) {
        renderGrid();
        showToast(
          res.added
            ? 'تمت إضافة «' + res.p[0] + '» إلى المفضلة ❤️'
            : 'تمت إزالة «' + res.p[0] + '» من المفضلة',
          res.added ? 'ok' : 'info'
        );
      }
      return;
    }
    const b = e.target.closest('[data-d]');
    if (b) {
      chg(b.dataset.k, +b.dataset.d);
      return;
    }
    const v = e.target.closest('[data-v]');
    if (v) {
      const vi = +v.dataset.v;
      state.SEL[gk(state.P[vi])] = vi;
      renderGrid();
      return;
    }
    const o = e.target.closest('[data-o]');
    if (o) {
      openFlavorModal(+o.dataset.o);
    }
  };

  const gridEl = $('grid');
  const sgridEl = $('sgrid');
  const favGridEl = $('favGrid');
  const favClearBtn = $('favClearBtn');
  const hdrFavBtn = $('hdrFavBtn');
  const favCloseBtn = $('favClose');
  const favBrowseBtn = $('favBrowseBtn');
  if (gridEl) gridEl.addEventListener('click', handleGridClick);
  if (sgridEl) sgridEl.addEventListener('click', handleGridClick);
  if (favGridEl) favGridEl.addEventListener('click', handleGridClick);
  if (hdrFavBtn) hdrFavBtn.addEventListener('click', openFavoritesPage);
  if (favCloseBtn) favCloseBtn.addEventListener('click', closeFavoritesPage);
  if (favBrowseBtn) {
    favBrowseBtn.addEventListener('click', () => {
      commitRoute(
        { sec: 'catalog', spot: -1, layers: [] },
        { mode: 'push', scrollTarget: 'section' }
      );
    });
  }
  if (favClearBtn) {
    favClearBtn.addEventListener('click', () => {
      if (!state.favorites || !state.favorites.length) return;
      clearFavorites();
      renderGrid();
      showToast('تم مسح قائمة المفضلة');
    });
  }

  const statusEl = $('catalogStatus');
  if (statusEl) {
    statusEl.addEventListener('click', (e) => {
      if (e.target.id === 'resetFilterBtn') {
        resetAllFilters();
      } else if (e.target.id === 'catalogBackBtn') {
        goBackOrHome();
      }
    });
  }

  // Intercept internal top/section links so every section navigation records proper History state
  document.querySelectorAll('.brand-link[href="#top"], .hdr-nav a[href^="#"], .hero-ctas a[href="#catalog"]').forEach((lnk) => {
    lnk.addEventListener('click', (e) => {
      const href = lnk.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      const targetId = href.slice(1);
      if (targetId === 'top') {
        commitRoute(
          {
            cat: 'الكل',
            sort: 'default',
            inStockOnly: false,
            searchQuery: '',
            sec: '',
            spot: -1,
            layers: [],
          },
          { mode: 'push', resetScrollTop: true }
        );
      } else {
        commitRoute(
          { sec: targetId, spot: -1, layers: [] },
          { mode: 'push', scrollTarget: 'section' }
        );
      }
    });
  });

  const catsEl = $('cats');
  if (catsEl) {
    catsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-c]');
      if (!btn) return;
      commitRoute(
        {
          cat: btn.dataset.c,
          searchQuery: '',
          sec: 'catalog',
          spot: -1,
        },
        { mode: 'push' }
      );
    });
  }

  const catShowcase = $('catShowcase');
  if (catShowcase) {
    catShowcase.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat-pick]');
      if (!btn) return;
      commitRoute(
        {
          cat: btn.dataset.catPick,
          searchQuery: '',
          sec: 'catalog',
          spot: -1,
        },
        { mode: 'push', scrollTarget: 'section' }
      );
    });
  }

  const spot = $('heroSpotlight');
  if (spot) {
    spot.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-spot]');
      if (!btn) return;
      const idx = +btn.dataset.spot;
      const p = state.P[idx];
      if (!p) return;
      state.SEL[gk(p)] = idx;
      commitRoute(
        {
          cat: p[1],
          searchQuery: '',
          sec: 'catalog',
          spot: idx,
        },
        { mode: 'push', scrollTarget: 'section' }
      );
    });
  }

  const sortSelect = $('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      commitRoute({ sort: sortSelect.value, spot: -1 }, { mode: 'push' });
    });
  }

  const inStockToggle = $('inStockToggle');
  if (inStockToggle) {
    inStockToggle.addEventListener('change', () => {
      commitRoute({ inStockOnly: inStockToggle.checked, spot: -1 }, { mode: 'push' });
    });
  }

  const qEl = $('q');
  const qHdr = $('qHeader');
  const qClear = $('qClear');
  const sgo = $('sgo');
  const q2 = $('q2');
  const sback = $('sback');

  if (qEl) {
    qEl.addEventListener('input', () => {
      setSearchQuery(qEl.value);
      scheduleSearchRoute(qEl.value, false);
    });
    qEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRoute(
          { searchQuery: qEl.value, sec: 'catalog', spot: -1 },
          { mode: qEl.value.trim() ? 'push' : 'replace', scrollTarget: 'section' }
        );
      }
    });
  }

  if (qHdr) {
    qHdr.addEventListener('input', () => {
      setSearchQuery(qHdr.value);
      scheduleSearchRoute(qHdr.value, false);
    });
    qHdr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRoute(
          { searchQuery: qHdr.value, sec: 'catalog', spot: -1 },
          { mode: qHdr.value.trim() ? 'push' : 'replace', scrollTarget: 'section' }
        );
      }
    });
  }

  if (qClear) {
    qClear.addEventListener('click', () => {
      commitRoute({ searchQuery: '', spot: -1 }, { mode: 'push' });
      if (qEl) qEl.focus();
    });
  }

  if (sgo) {
    sgo.addEventListener('click', () => {
      const val = qEl ? qEl.value : '';
      if (!val.trim()) {
        if (qEl) qEl.focus();
        return;
      }
      openSearchPage(val);
    });
  }

  if (q2) {
    q2.addEventListener('input', () => {
      state.searchModalQuery = rn(q2.value.trim());
      renderGrid();
      scheduleSearchRoute(q2.value, true);
    });
  }

  if (sback) sback.addEventListener('click', sClose);
}
