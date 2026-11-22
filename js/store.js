import { chg, openFlavorModal } from './cart.js';
import {
  $,
  getSelectedVariantIndex,
  gidx,
  pname,
  pq,
  state,
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

function renderCardHtml({ p, i, gi, out, ol, ds }) {
  const fl = FL(p);
  const hf = fl.length > 0;
  const q = hf ? pq(i) : state.cart[i] || 0;
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
    ' id="prod-' +
    i +
    '">' +
    '<div class="pic' +
    (im ? ' has' : '') +
    '">' +
    mediaHtml +
    (ds ? '<span class="dsc">خصم ' + numAr(ds) + '٪</span>' : '') +
    (out ? '<span class="out-tag">نفد المخزون</span>' : '') +
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
    if (qNorm) {
      statusEl.innerHTML =
        'نتائج البحث عن «<b>' +
        esc(state.searchQuery.trim()) +
        '</b>» · ' +
        numAr(items.length) +
        ' صنف <button type="button" class="link-reset" id="resetFilterBtn">عرض الكل</button>';
      statusEl.hidden = false;
    } else if (state.cat !== 'الكل' || state.inStockOnly || state.sort !== 'default') {
      statusEl.innerHTML =
        'عرض ' +
        numAr(items.length) +
        ' صنف' +
        (state.cat !== 'الكل' ? ' في قسم <b>' + esc(state.cat) + '</b>' : '') +
        (state.cat !== 'الكل' || state.inStockOnly || state.sort !== 'default'
          ? ' <button type="button" class="link-reset" id="resetFilterBtn">إعادة ضبط</button>'
          : '');
      statusEl.hidden = false;
    } else {
      statusEl.innerHTML =
        'كل الأصناف (' + numAr(items.length) + ' صنف)';
      statusEl.hidden = false;
    }
  }

  if (gridEl) {
    if (items.length) {
      gridEl.innerHTML = items.map(renderCardHtml).join('');
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

  if (state.SOPEN && $('sgrid')) {
    if (!state.searchModalQuery) {
      $('sgrid').innerHTML =
        '<div class="empty-box"><p>اكتب اسم الصنف أو النكهة اللي بتدوّر عليها</p></div>';
    } else {
      const sItems = buildGroupedItems(state.searchModalQuery, false);
      $('sgrid').innerHTML = sItems.length
        ? sItems.map(renderCardHtml).join('')
        : '<div class="empty-box"><span class="empty-ico" aria-hidden="true">🔍</span><b>ما لقيناش صنف بالاسم ده</b><p>جرّب تكتب اسم تاني</p></div>';
    }
  }
}

export function setSearchQuery(val) {
  state.searchQuery = val;
  const qEl = $('q');
  const qHdr = $('qHeader');
  const qClear = $('qClear');
  if (qEl && qEl.value !== val) qEl.value = val;
  if (qHdr && qHdr.value !== val) qHdr.value = val;
  if (qClear) qClear.hidden = !val.trim();
  renderCategoriesShowcase();
  renderGrid();
}

export function resetAllFilters() {
  state.cat = 'الكل';
  state.sort = 'default';
  state.inStockOnly = false;
  const sortEl = $('sortSelect');
  const stockEl = $('inStockToggle');
  if (sortEl) sortEl.value = 'default';
  if (stockEl) stockEl.checked = false;
  setSearchQuery('');
  renderTabs();
  renderCategoriesShowcase();
  renderGrid();
}

export function openSearchPage(v) {
  const t = rn(String(v || '').trim());
  if (!t) {
    const qEl = $('q');
    if (qEl) qEl.focus();
    return;
  }
  state.searchModalQuery = t;
  const q2 = $('q2');
  if (q2) q2.value = String(v).trim();
  const spage = $('spage');
  if (spage && !spage.classList.contains('on')) {
    spage.classList.add('on');
    state.SOPEN = 1;
    lyPush(sHide);
  }
  ovf();
  renderGrid();
  if (spage) spage.scrollTop = 0;
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
}

export function sHide() {
  const spage = $('spage');
  if (spage) spage.classList.remove('on');
  state.SOPEN = 0;
  ovf();
}

export function sClose() {
  lyClose(sHide);
}

export function ovf() {
  const rOn = $('rsheet') && $('rsheet').classList.contains('on');
  const sOn = $('spage') && $('spage').classList.contains('on');
  document.body.style.overflow = rOn || sOn ? 'hidden' : '';
}

export function lyPush(f) {
  const h = f && f.name === 'aiHide' ? '#ai' : '#s';
  let p = 1;
  try {
    history.pushState({ ly: 1 }, '', h);
  } catch (e) {
    try {
      history.pushState({ ly: 1 }, '');
    } catch (e2) {
      try {
        location.hash = h;
      } catch (e3) {
        p = 0;
      }
    }
  }
  state.LY.push({ f, p });
}

export function lyClose(f) {
  const t = state.LY[state.LY.length - 1];
  if (t && t.f === f) {
    state.LY.pop();
    f();
    if (t.p) {
      state.IGN++;
      history.back();
    }
  } else {
    f();
  }
}

export function bindStoreEvents() {
  const handleGridClick = (e) => {
    if (e.target.id === 'emptyResetBtn' || e.target.id === 'resetFilterBtn') {
      resetAllFilters();
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
  if (gridEl) gridEl.addEventListener('click', handleGridClick);
  if (sgridEl) sgridEl.addEventListener('click', handleGridClick);

  const statusEl = $('catalogStatus');
  if (statusEl) {
    statusEl.addEventListener('click', (e) => {
      if (e.target.id === 'resetFilterBtn') {
        resetAllFilters();
      }
    });
  }

  const catsEl = $('cats');
  if (catsEl) {
    catsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-c]');
      if (!btn) return;
      state.cat = btn.dataset.c;
      if (state.searchQuery) setSearchQuery('');
      renderTabs();
      renderCategoriesShowcase();
      renderGrid();
    });
  }

  const catShowcase = $('catShowcase');
  if (catShowcase) {
    catShowcase.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat-pick]');
      if (!btn) return;
      state.cat = btn.dataset.catPick;
      if (state.searchQuery) setSearchQuery('');
      renderTabs();
      renderCategoriesShowcase();
      renderGrid();
      const catEl = $('catalog');
      if (catEl) catEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      state.cat = p[1];
      state.SEL[gk(p)] = idx;
      if (state.searchQuery) setSearchQuery('');
      renderTabs();
      renderCategoriesShowcase();
      renderGrid();
      const card = $('prod-' + idx);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('spotlight-flash');
        setTimeout(() => card.classList.remove('spotlight-flash'), 1200);
      }
    });
  }

  const sortSelect = $('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      renderGrid();
    });
  }

  const inStockToggle = $('inStockToggle');
  if (inStockToggle) {
    inStockToggle.addEventListener('change', () => {
      state.inStockOnly = inStockToggle.checked;
      renderGrid();
    });
  }

  const qEl = $('q');
  const qHdr = $('qHeader');
  const qClear = $('qClear');
  const sgo = $('sgo');
  const q2 = $('q2');
  const sback = $('sback');

  if (qEl) {
    qEl.addEventListener('input', () => setSearchQuery(qEl.value));
    qEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const catSec = $('catalog');
        if (catSec) catSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (qHdr) {
    qHdr.addEventListener('input', () => setSearchQuery(qHdr.value));
    qHdr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const catSec = $('catalog');
        if (catSec) catSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (qClear) {
    qClear.addEventListener('click', () => {
      setSearchQuery('');
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
    });
  }

  if (sback) sback.addEventListener('click', sClose);
}
