import {
  $,
  cleanCart,
  grp,
  pname,
  pq,
  saveCart,
  showToast,
  state,
  totals,
} from './state.js';
import { bag, esc, FL, money, numAr, pk, rn } from './utils.js';

let fi = -1;
let FM = false;
let FD = {};
let aiApplyCallback = null;
let flavorFilter = '';
let clearConfirmTimer = null;
let clearConfirmArmed = false;

export function stp(k, q, w, z) {
  return (
    '<span class="step' +
    (z && !q ? ' z' : '') +
    '"' +
    (w ? ' style="width:' + w + 'px"' : '') +
    '>' +
    '<button type="button" data-k="' +
    esc(k) +
    '" data-d="1" aria-label="زيادة الكمية">+</button>' +
    '<span>' +
    numAr(q) +
    '</span>' +
    '<button type="button" data-k="' +
    esc(k) +
    '" data-d="-1" aria-label="تقليل الكمية">−</button>' +
    '</span>'
  );
}

export function chg(k, d) {
  const prev = state.cart[k] || 0;
  const q = prev + d;
  if (q <= 0) delete state.cart[k];
  else state.cart[k] = Math.min(q, 99);

  saveCart();
  state.hooks.renderCatalog();
  updCartSummary();

  if (d > 0 && prev === 0) {
    pulseCartIndicators();
  }
  if ($('sheet') && $('sheet').classList.contains('on')) lines();
  if ($('fsheet') && $('fsheet').classList.contains('on')) flav();
}

function pulseCartIndicators() {
  ['hdrCart', 'open'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  });
}

export function updCartSummary() {
  const t = totals();
  const cnt = $('cnt');
  const sum = $('sum');
  const bar = $('bar');
  const hdrCount = $('hdrCartCount');
  const hdrSum = $('hdrCartSum');
  const hdrCart = $('hdrCart');

  if (cnt) cnt.textContent = numAr(t.n);
  if (sum) sum.textContent = money(t.s);
  if (bar) bar.classList.toggle('on', t.n > 0);
  if (hdrCount) hdrCount.textContent = numAr(t.n);
  if (hdrSum) hdrSum.textContent = t.n > 0 ? money(t.s) : 'السلة';
  if (hdrCart) hdrCart.classList.toggle('has-items', t.n > 0);
}

export function wa() {
  const t = totals();
  let m = 'طلب جديد من الموقع 📦\n\n';
  grp().forEach((g) => {
    const p = state.P[g.i];
    const fl = FL(p);
    const n = pq(g.i);
    m += '• ' + pname(g.i) + ' × ' + n + ' ' + state.CFG.unit + ' = ' + n * p[3] + ' جنيه\n';
    if (fl.length) {
      g.ks.forEach((k) => {
        m += '   ◦ ' + fl[pk(k).f][0] + ': ' + state.cart[k] + '\n';
      });
    }
  });
  m += '\nالإجمالي: ' + t.s + ' جنيه';
  const send = $('send');
  if (send) {
    send.href = 'https://wa.me/' + state.CFG.phone + '?text=' + encodeURIComponent(m);
  }
}

export function lines() {
  const t = totals();
  const linesEl = $('lines');
  const totEl = $('tot');
  const minEl = $('min');
  const progWrap = $('minProgress');
  const progFill = $('minProgressFill');
  const progText = $('minProgressText');
  const emptyEl = $('cartEmpty');
  const footEl = $('cartFoot');
  const clearBtn = $('clearCart');

  if (!t.n) {
    if (linesEl) linesEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    if (footEl) footEl.hidden = true;
    if (clearBtn) clearBtn.hidden = true;
    if (totEl) totEl.textContent = money(0);
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (footEl) footEl.hidden = false;
  if (clearBtn) clearBtn.hidden = false;

  if (linesEl) {
    linesEl.innerHTML = grp()
      .map((g) => {
        const p = state.P[g.i];
        const fl = FL(p);
        const n = pq(g.i);
        const im = p[8] && state.IMGS[p[8]];
        const thumb =
          '<div class="crow-thumb">' +
          (im
            ? '<img src="' + im + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
            : bag(p[4], p[5], p[6])) +
          '</div>';

        if (!fl.length) {
          return (
            '<div class="row">' +
            '<div class="row-main">' +
            thumb +
            '<div class="row-txt"><b>' +
            esc(pname(g.i)) +
            '</b><small>' +
            numAr(n) +
            ' × ' +
            numAr(p[3]) +
            ' جنيه</small></div>' +
            '</div>' +
            '<div class="row-ctrl">' +
            '<b class="row-sub">' +
            money(n * p[3]) +
            '</b>' +
            stp(String(g.i), n, 108) +
            '<button type="button" class="row-del" data-del-prod="' +
            g.i +
            '" aria-label="حذف الصنف">🗑</button>' +
            '</div>' +
            '</div>'
          );
        }

        return (
          '<div class="row grp">' +
          '<div class="h">' +
          '<div class="row-main">' +
          thumb +
          '<div class="row-txt"><b>' +
          esc(pname(g.i)) +
          '</b><small>' +
          numAr(n) +
          ' × ' +
          numAr(p[3]) +
          ' جنيه</small></div>' +
          '</div>' +
          '<div class="row-ctrl">' +
          '<b class="row-sub">' +
          money(n * p[3]) +
          '</b>' +
          '<button type="button" class="row-del" data-del-prod="' +
          g.i +
          '" aria-label="حذف الصنف">🗑</button>' +
          '</div>' +
          '</div>' +
          g.ks
            .map(
              (k) =>
                '<div class="sub"><span>▫️ ' +
                esc(fl[pk(k).f][0]) +
                '</span>' +
                stp(k, state.cart[k], 108) +
                '</div>'
            )
            .join('') +
          '<button type="button" class="addmore" data-o="' +
          g.i +
          '">+ نكهة تانية</button>' +
          '</div>'
        );
      })
      .join('');
  }

  if (totEl) totEl.textContent = money(t.s);
  wa();

  const minVal = +state.CFG.min || 0;
  if (progWrap && progFill && progText) {
    if (minVal > 0) {
      progWrap.hidden = false;
      const pct = Math.min(100, Math.round((t.s / minVal) * 100));
      progFill.style.width = pct + '%';
      progFill.classList.toggle('done', t.s >= minVal);
      if (t.s >= minVal) {
        progText.textContent = 'تم الوصول للحد الأدنى — طلبك جاهز للإرسال ✅';
      } else {
        progText.textContent =
          'الحد الأدنى ' + money(minVal) + ' · متبقي ' + money(minVal - t.s);
      }
    } else {
      progWrap.hidden = true;
    }
  }

  if (minEl) {
    if (minVal > 0 && t.s < minVal) {
      minEl.style.display = 'block';
      minEl.textContent =
        'أقل قيمة للطلب ' + money(minVal) + '، ناقصك ' + money(minVal - t.s);
    } else {
      minEl.style.display = 'none';
    }
  }
}

export function openCartSheet() {
  lines();
  const sheet = $('sheet');
  if (sheet) {
    sheet.classList.add('on');
    document.body.classList.add('modal-open');
  }
}

export function closeCartSheet() {
  const sheet = $('sheet');
  if (sheet) {
    sheet.classList.remove('on');
    resetClearConfirm();
    if (!$('fsheet')?.classList.contains('on') && !$('rsheet')?.classList.contains('on')) {
      document.body.classList.remove('modal-open');
    }
  }
}

function resetClearConfirm() {
  clearConfirmArmed = false;
  clearTimeout(clearConfirmTimer);
  const btn = $('clearCart');
  if (btn) {
    btn.textContent = 'تفريغ السلة';
    btn.classList.remove('armed');
  }
}

export function openFlavorModal(i) {
  fi = i;
  FM = false;
  aiApplyCallback = null;
  flavorFilter = '';
  const fSearch = $('fsearch');
  if (fSearch) fSearch.value = '';
  flav();
  const fs = $('fsheet');
  if (fs) {
    fs.classList.add('on');
    document.body.classList.add('modal-open');
  }
}

export function openAIReviewFlavor(i, initialFD, onApply) {
  fi = i;
  FM = true;
  FD = Object.assign({}, initialFD);
  aiApplyCallback = onApply;
  flavorFilter = '';
  const fSearch = $('fsearch');
  if (fSearch) fSearch.value = '';
  flav();
  const fs = $('fsheet');
  if (fs) {
    fs.classList.add('on');
    document.body.classList.add('modal-open');
  }
}

export function flav() {
  const p = state.P[fi];
  if (!p) return;
  const fl = FL(p);
  const n = FM
    ? Object.keys(FD).reduce((a, j) => a + FD[j], 0)
    : pq(fi);

  const titleEl = $('ftitle');
  const subEl = $('fsub');
  const listEl = $('flist');
  const cntEl = $('fcnt');
  const sumEl = $('fsum');
  const searchWrap = $('fsearchWrap');
  const picEl = $('fpic');

  if (titleEl) titleEl.textContent = pname(fi);
  if (subEl) {
    subEl.textContent =
      'السعر ' +
      money(p[3]) +
      ' لكل ' +
      state.CFG.unit +
      ' · اختار الكمية من كل نكهة';
  }

  if (picEl) {
    const im = p[8] && state.IMGS[p[8]];
    picEl.innerHTML = im
      ? '<img src="' + im + '" alt="" referrerpolicy="no-referrer">'
      : bag(p[4], p[5], p[6]);
  }

  if (searchWrap) {
    searchWrap.hidden = fl.length < 6;
  }

  const qNorm = rn(flavorFilter.trim());
  const rowsHtml = fl
    .map((f, j) => ({ f, j }))
    .filter((item) => !qNorm || rn(item.f[0]).indexOf(qNorm) > -1)
    .map(({ f, j }) => {
      const k = fi + ':' + j;
      const q = FM ? FD[j] || 0 : state.cart[k] || 0;
      return (
        '<div class="frow' +
        (f[1] ? ' off' : '') +
        (q > 0 ? ' active' : '') +
        '">' +
        '<b>' +
        esc(f[0]) +
        '</b>' +
        (f[1]
          ? '<span class="sold">خلصان</span>'
          : stp(k, q, 114, 1)) +
        '</div>'
      );
    })
    .join('');

  if (listEl) {
    listEl.innerHTML =
      rowsHtml ||
      '<p class="empty-fl">مفيش نكهة بالاسم ده</p>';
  }

  if (cntEl) cntEl.textContent = 'الكمية: ' + numAr(n) + ' ' + state.CFG.unit;
  if (sumEl) sumEl.textContent = money(n * p[3]);
}

export function fClose() {
  const fs = $('fsheet');
  if (fs) fs.classList.remove('on');
  if (FM) {
    FM = false;
    const cb = aiApplyCallback;
    aiApplyCallback = null;
    if (cb) cb(fi, FD);
  }
  if (!$('sheet')?.classList.contains('on') && !$('rsheet')?.classList.contains('on')) {
    document.body.classList.remove('modal-open');
  }
}

export function bindCartEvents() {
  const linesEl = $('lines');
  const openBtn = $('open');
  const hdrCart = $('hdrCart');
  const closeBtn = $('close');
  const sheet = $('sheet');
  const sendBtn = $('send');
  const clearBtn = $('clearCart');
  const flist = $('flist');
  const fSearch = $('fsearch');
  const fclose = $('fclose');
  const fdone = $('fdone');
  const fsheet = $('fsheet');

  if (linesEl) {
    linesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (b) {
        chg(b.dataset.k, +b.dataset.d);
        return;
      }
      const o = e.target.closest('[data-o]');
      if (o) {
        openFlavorModal(+o.dataset.o);
        return;
      }
      const del = e.target.closest('[data-del-prod]');
      if (del) {
        const idx = +del.dataset.delProd;
        Object.keys(state.cart).forEach((k) => {
          if (pk(k).i === idx) delete state.cart[k];
        });
        saveCart();
        state.hooks.renderCatalog();
        updCartSummary();
        lines();
        showToast('تم حذف الصنف من السلة');
      }
    });
  }

  if (openBtn) openBtn.addEventListener('click', openCartSheet);
  if (hdrCart) hdrCart.addEventListener('click', openCartSheet);
  if (closeBtn) closeBtn.addEventListener('click', closeCartSheet);
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) closeCartSheet();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!clearConfirmArmed) {
        clearConfirmArmed = true;
        clearBtn.textContent = 'تأكيد التفريغ؟';
        clearBtn.classList.add('armed');
        clearConfirmTimer = setTimeout(resetClearConfirm, 3500);
        return;
      }
      state.cart = {};
      saveCart();
      cleanCart();
      resetClearConfirm();
      state.hooks.renderCatalog();
      updCartSummary();
      lines();
      showToast('تم تفريغ السلة');
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      if (totals().s < (+state.CFG.min || 0)) {
        e.preventDefault();
        const minEl = $('min');
        if (minEl) {
          minEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
          minEl.classList.remove('shake');
          void minEl.offsetWidth;
          minEl.classList.add('shake');
          showToast(minEl.textContent, 'warn');
        }
        return;
      }
      wa();
    });
  }

  if (flist) {
    flist.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      if (FM) {
        const j = pk(b.dataset.k).f;
        const q = (FD[j] || 0) + +b.dataset.d;
        if (q <= 0) delete FD[j];
        else FD[j] = Math.min(q, 99);
        flav();
        return;
      }
      chg(b.dataset.k, +b.dataset.d);
    });
  }

  if (fSearch) {
    fSearch.addEventListener('input', () => {
      flavorFilter = fSearch.value;
      flav();
    });
  }

  if (fclose) fclose.addEventListener('click', fClose);
  if (fdone) fdone.addEventListener('click', fClose);
  if (fsheet) {
    fsheet.addEventListener('click', (e) => {
      if (e.target === fsheet) fClose();
    });
  }
}
