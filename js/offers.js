import { $, state } from './state.js';
import { esc, lum } from './utils.js';

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

export function renderOffers() {
  const L = (state.D.offers || []).filter((o) => !o.x && o.t);
  const s = $('offers');
  const navOffer = $('navOffers');
  clearInterval(state.OT);

  if (!L.length) {
    if (s) s.hidden = true;
    if (navOffer) navOffer.hidden = true;
    return;
  }

  if (s) s.hidden = false;
  if (navOffer) navOffer.hidden = false;

  const track = $('otrack');
  const dots = $('dots');
  const prevBtn = $('oPrev');
  const nextBtn = $('oNext');

  if (prevBtn) prevBtn.hidden = L.length <= 1;
  if (nextBtn) nextBtn.hidden = L.length <= 1;

  if (track) {
    track.innerHTML = L.map((o) => {
      const c = o.c || '#ffd23f';
      const fg = lum(c) > 150 ? '#18160d' : '#ffffff';
      const im = o.i && state.IMGS[o.i];
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
        '<a class="sbtn" target="_blank" rel="noopener noreferrer" href="' +
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
  const dots = $('dots');
  const prevBtn = $('oPrev');
  const nextBtn = $('oNext');

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
