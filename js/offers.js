import { $, pname, pq, showToast, state } from './state.js';
import { bag, esc, FL, isOut, lum, money, numAr } from './utils.js';
import { chg } from './cart.js';
import { recordWhatsAppOrder } from './orders.js';

let selectedDailyFlavor = { prodIdx: -1, flavorIdx: -1 };
let currentDailyProdIdx = -1;

export function oset(i) {
  state.OI = i;
  const dots = $('dots');
  if (!dots) return;
  Array.prototype.forEach.call(dots.children, (d, j) => {
    d.classList.toggle('on', j === i);
  });
}

export function ogo(i, behavior) {
  const tr = $('otrack');
  if (!tr) return;
  const sl = tr.children[i];
  if (!sl) return;
  const a = sl.getBoundingClientRect();
  const r = tr.getBoundingClientRect();
  tr.scrollBy({
    left: a.left + a.width / 2 - (r.left + r.width / 2),
    behavior: behavior || 'smooth',
  });
}

function isOfferActiveNow(o) {
  if (!o || o.x || !o.t) return false;
  const now = new Date();
  const todayStr =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0');
  if (o.startDate && String(o.startDate).trim() > todayStr) return false;
  if (o.endDate && String(o.endDate).trim() < todayStr) return false;
  return true;
}

function isProductAvailableForOffer(p) {
  if (!p || isOut(p)) return false;
  const catMeta = (state.D && state.D.catMeta) || {};
  if (catMeta[p[1]] && catMeta[p[1]].disabled) return false;
  return true;
}

function getFirstAvailableFlavorIndex(p) {
  const fl = FL(p);
  if (!fl.length) return -1;
  for (let i = 0; i < fl.length; i++) {
    if (!fl[i][1]) return i;
  }
  return -1;
}

function resolveLinkedProductIndex(o) {
  if (!o || !Array.isArray(state.P)) return -1;
  if (o.productIndex !== '' && o.productIndex != null) {
    const idx = Number(o.productIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < state.P.length) {
      if (isProductAvailableForOffer(state.P[idx])) return idx;
    }
  }
  if (o.productName) {
    const targetName = String(o.productName).trim();
    const byName = state.P.findIndex(
      (p) => p && String(p[0]).trim() === targetName && isProductAvailableForOffer(p)
    );
    if (byName >= 0) return byName;
  }
  return -1;
}

function resolveDailyDeal(activeOffers) {
  if (state.CFG && state.CFG.hideDailyDeal) return null;
  if (!Array.isArray(state.P) || !state.P.length) return null;

  if (state.CFG && state.CFG.dailyDealIdx !== '' && state.CFG.dailyDealIdx != null) {
    const cfgIdx = Number(state.CFG.dailyDealIdx);
    if (Number.isInteger(cfgIdx) && isProductAvailableForOffer(state.P[cfgIdx])) {
      const matchedOffer = activeOffers.find((x) => resolveLinkedProductIndex(x.o) === cfgIdx);
      return {
        prodIdx: cfgIdx,
        offer: matchedOffer ? matchedOffer.o : null,
        source: 'config',
      };
    }
  }

  for (let i = 0; i < activeOffers.length; i++) {
    const prodIdx = resolveLinkedProductIndex(activeOffers[i].o);
    if (prodIdx >= 0) {
      return {
        prodIdx,
        offer: activeOffers[i].o,
        source: 'offer',
      };
    }
  }

  const avail = [];
  for (let i = 0; i < state.P.length; i++) {
    if (isProductAvailableForOffer(state.P[i])) avail.push(i);
  }
  if (!avail.length) return null;

  const discounted = avail.filter((i) => +state.P[i][11] > state.P[i][3]);
  const pool = discounted.length ? discounted : avail;
  const now = new Date();
  const dayNum = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const pickedPos = ((dayNum * 2654435761) >>> 0) % pool.length;
  return {
    prodIdx: pool[pickedPos],
    offer: null,
    source: 'daily',
  };
}

function resolveSelectedFlavorForDeal(prodIdx, p) {
  const fl = FL(p);
  if (!fl.length) return -1;
  if (
    selectedDailyFlavor.prodIdx === prodIdx &&
    selectedDailyFlavor.flavorIdx >= 0 &&
    fl[selectedDailyFlavor.flavorIdx] &&
    !fl[selectedDailyFlavor.flavorIdx][1]
  ) {
    return selectedDailyFlavor.flavorIdx;
  }
  const first = getFirstAvailableFlavorIndex(p);
  selectedDailyFlavor = { prodIdx, flavorIdx: first };
  return first;
}

function buildCartKey(prodIdx, flavorIdx) {
  return flavorIdx >= 0 ? prodIdx + ':' + flavorIdx : String(prodIdx);
}

function renderDailyDealCard(dailyDeal) {
  const wrap = $('dailyDealWrap');
  if (!wrap) return;
  if (!dailyDeal) {
    currentDailyProdIdx = -1;
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  const { prodIdx, offer } = dailyDeal;
  const p = state.P[prodIdx];
  if (!p) {
    currentDailyProdIdx = -1;
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  currentDailyProdIdx = prodIdx;
  const fl = FL(p);
  const flavorIdx = resolveSelectedFlavorForDeal(prodIdx, p);
  const cartKey = buildCartKey(prodIdx, flavorIdx);
  const activeFlavors = fl
    .map((f, idx) => ({ name: f[0], disabled: !!f[1], idx }))
    .filter((f) => !f.disabled);

  const im = (p[8] && state.IMGS[p[8]]) || (offer && offer.i && state.IMGS[offer.i]);
  const mediaHtml = im
    ? '<img src="' +
      im +
      '" alt="' +
      esc(p[0]) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
    : bag(p[4], p[5], p[6]);

  const hasDiscount = +p[11] > p[3];
  const discPct = hasDiscount ? Math.round((1 - p[3] / +p[11]) * 100) : 0;
  const unitLabel = (state.CFG && state.CFG.unit) || 'كرتونة';
  const inCartQty = pq(prodIdx);

  let flavorsHtml = '';
  if (activeFlavors.length > 1) {
    flavorsHtml =
      '<div class="dd-flavors" role="group" aria-label="اختر النكهة لمنتج اليوم">' +
      activeFlavors
        .map(
          (f) =>
            '<button type="button" class="dd-flv' +
            (f.idx === flavorIdx ? ' on' : '') +
            '" data-dd-prod="' +
            prodIdx +
            '" data-dd-flavor="' +
            f.idx +
            '" aria-pressed="' +
            (f.idx === flavorIdx ? 'true' : 'false') +
            '">' +
            esc(f.name) +
            '</button>'
        )
        .join('') +
      '</div>';
  } else if (activeFlavors.length === 1) {
    flavorsHtml =
      '<div class="dd-single-flv">النكهة المتوفرة: <b>' +
      esc(activeFlavors[0].name) +
      '</b></div>';
  }

  wrap.hidden = false;
  wrap.innerHTML =
    '<article class="daily-deal-card" data-dd-card="' +
    prodIdx +
    '">' +
    '<div class="daily-deal-media' +
    (im ? '' : ' is-svg') +
    '">' +
    mediaHtml +
    '</div>' +
    '<div class="daily-deal-body">' +
    '<div class="dd-top">' +
    '<span class="dd-badge">⭐ منتج اليوم</span>' +
    (discPct > 0 ? '<span class="dd-disc">وفر ' + numAr(discPct) + '٪</span>' : '') +
    (offer && offer.g ? '<span class="dd-offer-tag">' + esc(offer.g) + '</span>' : '') +
    '</div>' +
    '<div class="dd-meta">' +
    esc(p[1]) +
    (p[2] ? ' · ' + esc(p[2]) : '') +
    '</div>' +
    '<h3 class="dd-title">' +
    esc(pname(prodIdx)) +
    '</h3>' +
    flavorsHtml +
    '<div class="dd-foot">' +
    '<div class="dd-price-row">' +
    '<strong class="dd-price">' +
    money(p[3]) +
    '</strong>' +
    (hasDiscount ? '<s class="dd-old">' + money(+p[11]) + '</s>' : '') +
    '<small class="dd-unit">/ ' +
    esc(unitLabel) +
    '</small>' +
    '</div>' +
    '<div class="dd-actions">' +
    '<button type="button" class="dd-add-btn" id="dailyDealAddBtn" data-dd-add="' +
    prodIdx +
    '" data-dd-key="' +
    esc(cartKey) +
    '" data-dd-flv="' +
    flavorIdx +
    '">' +
    '<span aria-hidden="true">🛒</span>' +
    '<span>أضف للسلة بضغطة واحدة</span>' +
    '</button>' +
    '<span class="dd-in-cart" id="dailyDealInCart"' +
    (inCartQty > 0 ? '' : ' hidden') +
    '>في السلة: ' +
    numAr(inCartQty) +
    '</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</article>';
}

export function syncDailyDealBadge() {
  const badge = $('dailyDealInCart');
  if (!badge || currentDailyProdIdx < 0) return;
  const qty = pq(currentDailyProdIdx);
  if (qty > 0) {
    badge.textContent = 'في السلة: ' + numAr(qty);
    badge.hidden = false;
  } else {
    badge.textContent = '';
    badge.hidden = true;
  }
}

function quickAddProductToCart(prodIdx, flavorIdx) {
  const p = state.P[prodIdx];
  if (!isProductAvailableForOffer(p)) {
    showToast('هذا الصنف غير متوفر حالياً', 'warn');
    return false;
  }

  const fl = FL(p);
  let resolvedFlavor = -1;
  if (fl.length) {
    if (flavorIdx >= 0 && fl[flavorIdx] && !fl[flavorIdx][1]) {
      resolvedFlavor = flavorIdx;
    } else {
      resolvedFlavor = getFirstAvailableFlavorIndex(p);
    }
    if (resolvedFlavor < 0) {
      showToast('لا توجد نكهات متوفرة لهذا الصنف حالياً', 'warn');
      return false;
    }
  }

  const cartKey = buildCartKey(prodIdx, resolvedFlavor);
  const currentQty = state.cart[cartKey] || 0;
  if (currentQty >= 99) {
    showToast('وصلت للحد الأقصى لهذه الكمية في السلة (٩٩)', 'warn');
    return false;
  }

  chg(cartKey, 1);
  syncDailyDealBadge();

  const flavorSuffix = resolvedFlavor >= 0 ? ' (' + fl[resolvedFlavor][0] + ')' : '';
  showToast('تمت إضافة «' + pname(prodIdx) + flavorSuffix + '» إلى السلة ✅', 'ok');
  return true;
}

export function renderOffers() {
  const L = (state.D.offers || [])
    .map((o, idx) => ({ o, idx }))
    .filter(({ o }) => isOfferActiveNow(o));
  const dailyDeal = resolveDailyDeal(L);
  const s = $('offers');
  const navOffer = $('navOffers');
  clearInterval(state.OT);

  if (!L.length && !dailyDeal) {
    if (s) s.hidden = true;
    if (navOffer) navOffer.hidden = true;
    renderDailyDealCard(null);
    return;
  }

  if (s) s.hidden = false;
  if (navOffer) navOffer.hidden = false;

  renderDailyDealCard(dailyDeal);

  const track = $('otrack');
  const dots = $('dots');
  const prevBtn = $('oPrev');
  const nextBtn = $('oNext');

  if (prevBtn) prevBtn.hidden = L.length <= 1;
  if (nextBtn) nextBtn.hidden = L.length <= 1;

  if (!L.length) {
    if (track) {
      track.hidden = true;
      track.innerHTML = '';
    }
    if (dots) {
      dots.hidden = true;
      dots.innerHTML = '';
    }
    return;
  }

  if (track) {
    track.hidden = false;
    track.innerHTML = L.map(({ o, idx }) => {
      const c = o.c || '#ffd23f';
      const fg = lum(c) > 150 ? '#18160d' : '#ffffff';
      const linkedIdx = resolveLinkedProductIndex(o);
      const linkedProd = linkedIdx >= 0 ? state.P[linkedIdx] : null;
      const linkedFlv = linkedProd ? getFirstAvailableFlavorIndex(linkedProd) : -1;
      const im = (o.i && state.IMGS[o.i]) || (linkedProd && linkedProd[8] && state.IMGS[linkedProd[8]]);
      const msg = 'السلام عليكم، عايز أطلب عرض: ' + o.t;
      const waHref =
        'https://wa.me/' + state.CFG.phone + '?text=' + encodeURIComponent(msg);

      return (
        '<article class="slide' +
        (L.length === 1 ? ' one' : '') +
        '" style="--slide-bg:' +
        esc(c) +
        ';--slide-fg:' +
        fg +
        '">' +
        '<div class="st">' +
        (o.g ? '<span class="stag">' + esc(o.g) + '</span>' : '') +
        '<h3>' +
        esc(o.t) +
        '</h3>' +
        (o.d ? '<p>' + esc(o.d) + '</p>' : '') +
        '<div class="sfoot">' +
        (o.pr ? '<span class="spr">' + esc(o.pr) + '</span>' : '') +
        (linkedIdx >= 0
          ? '<button type="button" class="sbtn-cart" data-offer-add="' +
            linkedIdx +
            '" data-offer-flv="' +
            linkedFlv +
            '">🛒 أضف للسلة</button>'
          : '') +
        '<a class="sbtn" target="_blank" rel="noopener noreferrer" data-offer-idx="' +
        idx +
        '" data-offer-title="' +
        esc(o.t) +
        '" href="' +
        waHref +
        '">اطلب العرض 📲</a>' +
        '</div>' +
        '</div>' +
        '<div class="simg' +
        (im ? '' : ' noimg') +
        '">' +
        (im
          ? '<img src="' +
            im +
            '" alt="' +
            esc(o.t) +
            '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
          : '<span class="simg-fallback" aria-hidden="true">🎁</span>') +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  if (dots) {
    dots.hidden = L.length <= 1;
    dots.innerHTML =
      L.length > 1
        ? L.map(
            (_, idx) =>
              '<button type="button" class="dot" data-oi="' +
              idx +
              '" aria-label="عرض ' +
              (idx + 1) +
              '"></button>'
          ).join('')
        : '';
  }

  if (state.OI >= L.length) state.OI = 0;
  oset(state.OI);
  if (state.OI > 0) ogo(state.OI, 'auto');

  if (L.length > 1) {
    state.OT = setInterval(() => {
      if (document.hidden || Date.now() < state.OP || (s && s.hidden)) return;
      ogo((state.OI + 1) % L.length);
    }, 4500);
  }
}

export function bindOfferEvents() {
  const tr = $('otrack');
  const dailyWrap = $('dailyDealWrap');
  const dots = $('dots');
  const prevBtn = $('oPrev');
  const nextBtn = $('oNext');

  if (dailyWrap) {
    dailyWrap.addEventListener('click', (e) => {
      const flvBtn = e.target.closest('[data-dd-flavor]');
      if (flvBtn) {
        const prodIdx = Number(flvBtn.dataset.ddProd);
        const flavorIdx = Number(flvBtn.dataset.ddFlavor);
        selectedDailyFlavor = { prodIdx, flavorIdx };
        Array.prototype.forEach.call(dailyWrap.querySelectorAll('[data-dd-flavor]'), (b) => {
          const isOn = b === flvBtn;
          b.classList.toggle('on', isOn);
          if (typeof b.setAttribute === 'function') {
            b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
          } else if (b.attributes) {
            b.attributes['aria-pressed'] = isOn ? 'true' : 'false';
          }
        });
        const addBtn = dailyWrap.querySelector('[data-dd-add]');
        if (addBtn) {
          addBtn.dataset.ddFlv = String(flavorIdx);
          addBtn.dataset.ddKey = buildCartKey(prodIdx, flavorIdx);
        }
        return;
      }

      const addBtn = e.target.closest('[data-dd-add]');
      if (addBtn) {
        const prodIdx = Number(addBtn.dataset.ddAdd);
        const flvRaw = addBtn.dataset.ddFlv;
        const flavorIdx = flvRaw != null && flvRaw !== '' ? Number(flvRaw) : -1;
        quickAddProductToCart(prodIdx, flavorIdx);
      }
    });
  }

  if (tr) {
    let tm;
    tr.addEventListener('scroll', () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const r = tr.getBoundingClientRect();
        const c = r.left + r.width / 2;
        let best = 0;
        let bd = 1e9;
        Array.prototype.forEach.call(tr.children, (sl, j) => {
          const a = sl.getBoundingClientRect();
          const d = Math.abs(a.left + a.width / 2 - c);
          if (d < bd) {
            bd = d;
            best = j;
          }
        });
        oset(best);
      }, 60);
    });

    ['touchstart', 'pointerdown', 'wheel', 'mouseenter'].forEach((ev) => {
      tr.addEventListener(
        ev,
        () => {
          state.OP = Date.now() + 8000;
        },
        { passive: true }
      );
    });

    tr.addEventListener('click', (e) => {
      const addOfferBtn = e.target.closest('[data-offer-add]');
      if (addOfferBtn) {
        const prodIdx = Number(addOfferBtn.dataset.offerAdd);
        const flvRaw = addOfferBtn.dataset.offerFlv;
        const flavorIdx = flvRaw != null && flvRaw !== '' ? Number(flvRaw) : -1;
        quickAddProductToCart(prodIdx, flavorIdx);
        return;
      }

      const sbtn = e.target.closest('.sbtn');
      if (!sbtn) return;
      recordWhatsAppOrder({
        orderType: 'offer',
        offerIndex: Number(sbtn.dataset.offerIdx),
        offerTitle: sbtn.dataset.offerTitle || '',
      });
    });
  }

  if (dots) {
    dots.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-oi]');
      if (!btn) return;
      state.OP = Date.now() + 8000;
      ogo(+btn.dataset.oi);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const len = $('otrack') ? $('otrack').children.length : 0;
      if (!len) return;
      state.OP = Date.now() + 8000;
      ogo((state.OI - 1 + len) % len);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const len = $('otrack') ? $('otrack').children.length : 0;
      if (!len) return;
      state.OP = Date.now() + 8000;
      ogo((state.OI + 1) % len);
    });
  }
}
