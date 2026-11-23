import { popOverlay, pushOverlay, switchOverlay } from './router.js';
import { $, grp, pname, pq, saveCart, showToast, state } from './state.js';
import { esc, FL, money, numAr, pk } from './utils.js';

const ordersState = {
  orders: [],
  loading: false,
  loaded: false,
  error: '',
  lastPostKey: '',
  lastPostAt: 0,
  armedDeleteId: '',
  armedClearAll: false,
  busy: false,
};
let armSingleTimer = null;
let armClearTimer = null;

function formatDateTimeAr(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(iso);
  }
}

function orderStatusMeta(status) {
  if (status === 'confirmed') {
    return { label: '✅ تم تأكيد الطلب', cls: 'st-confirmed' };
  }
  if (status === 'completed') {
    return { label: '📦 تم التوصيل', cls: 'st-completed' };
  }
  if (status === 'cancelled') {
    return { label: '❌ ملغي', cls: 'st-cancelled' };
  }
  return { label: '📲 أُرسل عبر واتساب', cls: 'st-sent' };
}

function buildOrderItemsFromCart() {
  return grp().map((g) => {
    const p = state.P[g.i];
    const fl = FL(p);
    const n = pq(g.i);
    const baseName = String(p?.[0] || '').trim();
    const variant = String(p?.[10] || '').trim();
    const flavors = fl.length
      ? g.ks
          .map((k) => {
            const fIdx = pk(k).f;
            const fObj = fl[fIdx];
            const q = Number(state.cart[k] || 0);
            if (!fObj || q <= 0) return null;
            return {
              flavorIndex: fIdx,
              name: String(fObj[0] || ''),
              qty: q,
            };
          })
          .filter(Boolean)
      : [];
    return {
      productIndex: g.i,
      productName: baseName || pname(g.i),
      variant,
      qty: n,
      flavors,
    };
  });
}

function updateOrdersHeaderBadge() {
  const badge = $('hdrOrdersCount');
  const btn = $('hdrOrdersBtn');
  const clearBtn = $('ordersClearBtn');
  const count = ordersState.orders.length;
  if (clearBtn) {
    clearBtn.hidden = count === 0;
    clearBtn.disabled = ordersState.busy;
    clearBtn.textContent = ordersState.armedClearAll ? 'تأكيد مسح السجل؟' : 'مسح السجل';
  }
  if (!badge) return;
  if (count > 0) {
    badge.textContent = numAr(count);
    badge.hidden = false;
    if (btn) btn.classList.add('has-orders');
  } else {
    badge.hidden = true;
    if (btn) btn.classList.remove('has-orders');
  }
}

function renderOrdersBody() {
  const body = $('ordersBody');
  updateOrdersHeaderBadge();
  if (!body) return;

  if (ordersState.loading && !ordersState.orders.length) {
    body.innerHTML =
      '<div class="ord-empty"><span>⏳</span><b>جاري تحميل سجل طلباتك...</b></div>';
    return;
  }

  if (ordersState.error && !ordersState.orders.length) {
    body.innerHTML = `
      <div class="ord-empty">
        <span>⚠️</span>
        <b>${esc(ordersState.error)}</b>
        <button type="button" class="ord-retry-btn" id="ordRetryBtn">🔄 إعادة المحاولة</button>
      </div>`;
    return;
  }

  if (!ordersState.orders.length) {
    body.innerHTML = `
      <div class="ord-empty">
        <span>📦</span>
        <b>لا توجد طلبات مسجلة حتى الآن</b>
        <p>أي طلب ترسله عبر واتساب سيُحفظ هنا تلقائياً بالتاريخ والوقت والتفاصيل الكاملة للرجوع إليه في أي وقت.</p>
      </div>`;
    return;
  }

  const cardsHtml = ordersState.orders
    .map((ord) => {
      const meta = orderStatusMeta(ord.status);
      const shortId = String(ord.id || '').replace(/^ord_/, '#').slice(0, 12);
      const isOffer = ord.orderType === 'offer';
      const itemsHtml = (Array.isArray(ord.items) ? ord.items : [])
        .map((it) => {
          const fls = Array.isArray(it.flavors) ? it.flavors : [];
          const flavorsHtml = fls.length
            ? `<div class="ord-flavors">${fls
                .map(
                  (f) =>
                    `<span class="ord-fl-chip">${esc(f.name)}: <b>${numAr(
                      f.qty
                    )}</b></span>`
                )
                .join('')}</div>`
            : '';
          const displayName = it.variant
            ? `${it.name} · ${it.variant}`
            : it.name;

          return `
            <div class="ord-item">
              <div class="ord-item-row">
                <span class="ord-item-name">${esc(displayName)}</span>
                <span class="ord-item-qty">× ${numAr(it.qty)} ${esc(
            isOffer ? '' : ord.unit || 'كرتونة'
          )}</span>
                <b class="ord-item-sub">${
                  isOffer && ord.offerPriceLabel
                    ? esc(ord.offerPriceLabel)
                    : money(it.subtotal || 0)
                }</b>
              </div>
              ${flavorsHtml}
            </div>`;
        })
        .join('');

      const cleanPhone = String(
        ord.whatsappPhone || state.CFG?.phone || ''
      ).replace(/\D/g, '');
      const waHref =
        cleanPhone && ord.whatsappMessage
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              ord.whatsappMessage
            )}`
          : '';

      return `
        <article class="ord-card" data-ord-id="${esc(ord.id)}">
          <div class="ord-card-head">
            <div class="ord-id-wrap">
              <strong class="ord-id">${esc(shortId)}</strong>
              <span class="ord-date">🕒 ${esc(
                formatDateTimeAr(ord.createdAt)
              )}</span>
            </div>
            <span class="ord-pill ${meta.cls}">${meta.label}</span>
          </div>

          <div class="ord-items">${itemsHtml}</div>

          <div class="ord-card-foot">
            <div class="ord-tot">
              <span>${
                isOffer
                  ? 'طلب عرض خاص'
                  : `الإجمالي (${numAr(ord.totalQty)} ${esc(
                      ord.unit || 'كرتونة'
                    )})`
              }</span>
              <b>${
                isOffer && ord.offerPriceLabel && !ord.totalPrice
                  ? esc(ord.offerPriceLabel)
                  : money(ord.totalPrice || 0)
              }</b>
            </div>
            <div class="ord-actions">
              ${
                !isOffer
                  ? `<button type="button" class="ord-btn reorder" data-ord-reorder="${esc(
                      ord.id
                    )}">🔄 إعادة للسلة</button>`
                  : ''
              }
              ${
                waHref
                  ? `<a class="ord-btn wa" target="_blank" rel="noopener noreferrer" href="${waHref}">📲 إرسال واتساب</a>`
                  : ''
              }
              <button type="button" class="ord-btn del${
                ordersState.armedDeleteId === String(ord.id) ? ' armed' : ''
              }" data-ord-del="${esc(ord.id)}"${ordersState.busy ? ' disabled' : ''}>${
                ordersState.armedDeleteId === String(ord.id) ? '⚠️ تأكيد الحذف؟' : '🗑 حذف'
              }</button>
            </div>
          </div>
        </article>`;
    })
    .join('');

  body.innerHTML = `<div class="ord-list">${cardsHtml}</div>`;
}

export async function loadUserOrders(force = false) {
  if (ordersState.loading) return ordersState.orders;
  if (ordersState.loaded && !force) return ordersState.orders;

  ordersState.loading = true;
  ordersState.error = '';
  if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();

  try {
    const res = await fetch('/api/orders', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.replace('/login?reason=expired');
      return [];
    }
    if (res.status === 403) {
      window.location.replace('/account-status');
      return [];
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'تعذر تحميل سجل الطلبات.');
    }
    ordersState.orders = Array.isArray(data.orders) ? data.orders : [];
    ordersState.loaded = true;
    updateOrdersHeaderBadge();
    return ordersState.orders;
  } catch (err) {
    ordersState.error = err?.message || 'تعذر تحميل سجل الطلبات.';
    return ordersState.orders;
  } finally {
    ordersState.loading = false;
    if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();
  }
}

export async function recordWhatsAppOrder(options = {}) {
  const orderType = options.orderType === 'offer' ? 'offer' : 'cart';
  const payload =
    orderType === 'offer'
      ? {
          orderType: 'offer',
          offerIndex: Number(options.offerIndex),
          offerTitle: String(options.offerTitle || ''),
        }
      : {
          orderType: 'cart',
          items: Array.isArray(options.items)
            ? options.items
            : buildOrderItemsFromCart(),
        };

  if (orderType === 'cart' && (!payload.items || !payload.items.length)) {
    return null;
  }

  const dedupKey = JSON.stringify(payload);
  const now = Date.now();
  if (
    ordersState.lastPostKey === dedupKey &&
    now - ordersState.lastPostAt < 3500
  ) {
    return null;
  }
  ordersState.lastPostKey = dedupKey;
  ordersState.lastPostAt = now;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      window.location.replace('/login?reason=expired');
      return null;
    }
    if (res.status === 403) {
      window.location.replace('/account-status');
      return null;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.order) {
      ordersState.lastPostKey = '';
      showToast(data.error || 'تعذر حفظ الطلب في سجل طلباتك', 'warn');
      return null;
    }

    const exists = ordersState.orders.some((o) => o.id === data.order.id);
    if (!exists) {
      ordersState.orders = [data.order, ...ordersState.orders];
      ordersState.loaded = true;
      updateOrdersHeaderBadge();
      if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();
    }
    if (!data.deduplicated) {
      showToast('تم حفظ الطلب في سجل طلباتك ✅');
    }
    return data.order;
  } catch {
    ordersState.lastPostKey = '';
    showToast('تعذر الاتصال بالخادم لتسجيل الطلب', 'warn');
    return null;
  }
}

function findProductForReorder(it) {
  const wantedName = String(it?.name || '').trim();
  const wantedVar = String(it?.variant || '').trim();
  const idxNum = Number(it?.productIndex);
  const cand = Number.isInteger(idxNum) ? state.P[idxNum] : null;
  if (cand && String(cand[0] || '').trim() === wantedName) {
    if (!wantedVar || String(cand[10] || '').trim() === wantedVar) {
      return { pIdx: idxNum, prod: cand };
    }
  }
  if (wantedVar) {
    const vIdx = state.P.findIndex(
      (p) =>
        p &&
        String(p[0] || '').trim() === wantedName &&
        String(p[10] || '').trim() === wantedVar
    );
    if (vIdx >= 0) return { pIdx: vIdx, prod: state.P[vIdx] };
  }
  const fIdx = state.P.findIndex(
    (p) => p && String(p[0] || '').trim() === wantedName
  );
  if (fIdx >= 0) return { pIdx: fIdx, prod: state.P[fIdx] };
  return { pIdx: -1, prod: null };
}

function reorderIntoCart(orderId) {
  const ord = ordersState.orders.find((o) => String(o.id) === String(orderId));
  if (!ord || !Array.isArray(ord.items)) return;

  let addedCount = 0;
  let skippedCount = 0;

  ord.items.forEach((it) => {
    const { pIdx, prod } = findProductForReorder(it);
    if (!prod || prod[7]) {
      skippedCount += 1;
      return;
    }

    const catFlavors = FL(prod);
    const ordFlavors = Array.isArray(it.flavors) ? it.flavors : [];
    if (catFlavors.length && ordFlavors.length) {
      ordFlavors.forEach((of) => {
        let fIdx = Number(of.flavorIndex);
        let cf = catFlavors[fIdx];
        if (!cf || String(cf[0] || '').trim() !== String(of.name || '').trim()) {
          fIdx = catFlavors.findIndex(
            (x) => x && String(x[0] || '').trim() === String(of.name || '').trim()
          );
          cf = fIdx >= 0 ? catFlavors[fIdx] : null;
        }
        if (cf && !cf[1] && Number(of.qty) > 0) {
          const key = `${pIdx}:${fIdx}`;
          state.cart[key] = Math.min(99, (state.cart[key] || 0) + Number(of.qty));
          addedCount += 1;
        } else {
          skippedCount += 1;
        }
      });
    } else if (!catFlavors.length && Number(it.qty) > 0) {
      const key = String(pIdx);
      state.cart[key] = Math.min(99, (state.cart[key] || 0) + Number(it.qty));
      addedCount += 1;
    } else {
      skippedCount += 1;
    }
  });

  if (addedCount > 0) {
    saveCart();
    state.hooks.renderCatalog?.();
    state.hooks.renderCartUI?.();
    switchOverlay('cart');
    showToast(
      skippedCount > 0
        ? 'تمت إضافة الأصناف المتوفرة للسلة ✅'
        : 'تمت إعادة إضافة الطلب إلى السلة 🛒'
    );
  } else {
    showToast('الأصناف في هذا الطلب غير متوفرة حالياً', 'warn');
  }
}

export function syncOrdersOverlay(isOpen) {
  const sheet = $('ordersSheet');
  if (!sheet) return;
  if (isOpen) {
    sheet.classList.add('on');
    document.body.classList.add('modal-open');
    renderOrdersBody();
    loadUserOrders(!ordersState.loaded);
    return;
  }
  sheet.classList.remove('on');
  if (
    !$('sheet')?.classList.contains('on') &&
    !$('fsheet')?.classList.contains('on') &&
    !$('rsheet')?.classList.contains('on') &&
    !$('accountSheet')?.classList.contains('on') &&
    !$('favoritesSheet')?.classList.contains('on') &&
    !$('pushMandatoryModal')?.classList.contains('on')
  ) {
    document.body.classList.remove('modal-open');
  }
}

export function openOrdersModal() {
  pushOverlay('orders');
}

export function closeOrdersModal() {
  popOverlay('orders');
}

async function handleDeleteSingleOrder(orderId) {
  const idStr = String(orderId || '').trim();
  if (!idStr || ordersState.busy) return;
  if (ordersState.armedDeleteId !== idStr) {
    ordersState.armedDeleteId = idStr;
    clearTimeout(armSingleTimer);
    armSingleTimer = setTimeout(() => {
      ordersState.armedDeleteId = '';
      if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();
    }, 3200);
    renderOrdersBody();
    return;
  }
  clearTimeout(armSingleTimer);
  ordersState.armedDeleteId = '';
  ordersState.busy = true;
  renderOrdersBody();
  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(idStr), {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      window.location.replace('/login?reason=expired');
      return;
    }
    if (res.status === 403) {
      window.location.replace('/account-status');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'تعذر حذف الطلب.');
    ordersState.orders = ordersState.orders.filter((o) => String(o.id) !== idStr);
    showToast('تم حذف الطلب من السجل 🗑');
  } catch (err) {
    showToast(err?.message || 'تعذر حذف الطلب', 'warn');
  } finally {
    ordersState.busy = false;
    updateOrdersHeaderBadge();
    if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();
  }
}

async function handleClearAllOrders() {
  if (!ordersState.orders.length || ordersState.busy) return;
  if (!ordersState.armedClearAll) {
    ordersState.armedClearAll = true;
    clearTimeout(armClearTimer);
    armClearTimer = setTimeout(() => {
      ordersState.armedClearAll = false;
      updateOrdersHeaderBadge();
    }, 3200);
    updateOrdersHeaderBadge();
    return;
  }
  clearTimeout(armClearTimer);
  ordersState.armedClearAll = false;
  ordersState.busy = true;
  renderOrdersBody();
  try {
    const res = await fetch('/api/orders', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      window.location.replace('/login?reason=expired');
      return;
    }
    if (res.status === 403) {
      window.location.replace('/account-status');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'تعذر مسح سجل الطلبات.');
    ordersState.orders = [];
    showToast('تم مسح سجل طلباتك بالكامل 🗑');
  } catch (err) {
    showToast(err?.message || 'تعذر مسح سجل الطلبات', 'warn');
  } finally {
    ordersState.busy = false;
    updateOrdersHeaderBadge();
    if ($('ordersSheet')?.classList.contains('on')) renderOrdersBody();
  }
}

export function initOrdersUI() {
  const hdrBtn = $('hdrOrdersBtn');
  const closeBtn = $('ordersClose');
  const refreshBtn = $('ordersRefreshBtn');
  const clearBtn = $('ordersClearBtn');
  const sheet = $('ordersSheet');
  const body = $('ordersBody');

  if (hdrBtn) hdrBtn.addEventListener('click', openOrdersModal);
  if (closeBtn) closeBtn.addEventListener('click', closeOrdersModal);
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadUserOrders(true));
  if (clearBtn) clearBtn.addEventListener('click', handleClearAllOrders);
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) closeOrdersModal();
    });
  }
  if (body) {
    body.addEventListener('click', (e) => {
      const retry = e.target.closest('#ordRetryBtn');
      if (retry) {
        loadUserOrders(true);
        return;
      }
      const delBtn = e.target.closest('[data-ord-del]');
      if (delBtn) {
        handleDeleteSingleOrder(delBtn.dataset.ordDel);
        return;
      }
      const reorderBtn = e.target.closest('[data-ord-reorder]');
      if (reorderBtn) {
        reorderIntoCart(reorderBtn.dataset.ordReorder);
      }
    });
  }

  state.hooks.openOrdersModal = openOrdersModal;
  loadUserOrders(true);
}
