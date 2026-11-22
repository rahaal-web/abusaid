export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function rnd(s) {
  return String(s || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

export function rn(s) {
  return rnd(s)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و');
}

export function rtk(s) {
  const o = [];
  rn(s)
    .split(/[^\u0621-\u064Aa-z0-9]+/)
    .forEach((t) => {
      if (!t) return;
      if (t.length > 3 && t.indexOf('ال') === 0) t = t.slice(2);
      o.push(t);
    });
  return o;
}

export function money(n) {
  return Number(n || 0).toLocaleString('ar-EG') + ' جنيه';
}

export function numAr(n) {
  return Number(n || 0).toLocaleString('ar-EG');
}

export function lum(h) {
  const hex = String(h || '#ffd23f').replace('#', '');
  if (hex.length < 6) return 180;
  return (
    (parseInt(hex.substr(0, 2), 16) * 299 +
      parseInt(hex.substr(2, 2), 16) * 587 +
      parseInt(hex.substr(4, 2), 16) * 114) /
    1000
  );
}

export function bag(c1, c2, em) {
  const safeC1 = esc(c1 || '#ffd23f');
  const safeC2 = esc(c2 || '#e8a400');
  const safeEm = esc(em || '🥔');
  return (
    '<svg viewBox="0 0 120 150" aria-hidden="true">' +
    '<path d="M14 10h92l-6 8 6 8-6 8 6 8-6 8 6 8-6 8-6 0v54H20V92l-6 0 6-8-6-8 6-8-6-8 6-8-6-8z" fill="' +
    safeC1 +
    '" stroke="#1b1b1b" stroke-width="4" stroke-linejoin="round"/>' +
    '<rect x="20" y="10" width="80" height="16" fill="' +
    safeC2 +
    '" opacity=".55"/>' +
    '<circle cx="60" cy="72" r="30" fill="#fff" stroke="#1b1b1b" stroke-width="4"/>' +
    '<text x="60" y="84" font-size="34" text-anchor="middle">' +
    safeEm +
    '</text>' +
    '<path d="M20 118h80" stroke="' +
    safeC2 +
    '" stroke-width="10"/>' +
    '</svg>'
  );
}

export function FL(p) {
  return (p && p[9]) || [];
}

export function nk(n) {
  return n === 1 ? 'نكهة واحدة' : n === 2 ? 'نكهتين' : n.toLocaleString('ar-EG') + ' نكهات';
}

export function pk(k) {
  const a = String(k).split(':');
  return { i: +a[0], f: a.length > 1 ? +a[1] : -1 };
}

export function isOut(p) {
  const fl = FL(p);
  return !!(p[7] || (fl.length && fl.every((f) => f[1])));
}

export function gk(p) {
  return p[1] + '|' + p[0];
}

export function getCatMeta(cat) {
  const n = rn(cat);
  if (n.indexOf('شيبس') > -1) {
    return { icon: '🥔', bg: 'linear-gradient(135deg, #fff1b8, #ffd23f)', accent: '#e8a400' };
  }
  if (n.indexOf('سناكس') > -1 || n.indexOf('مقرمش') > -1) {
    return { icon: '🍿', bg: 'linear-gradient(135deg, #ffe2c2, #ff9f1c)', accent: '#c26a00' };
  }
  if (n.indexOf('حلوي') > -1 || n.indexOf('بسكويت') > -1 || n.indexOf('شوكول') > -1) {
    return { icon: '🍫', bg: 'linear-gradient(135deg, #f7dfcf, #d89b6a)', accent: '#6b3e26' };
  }
  if (n.indexOf('مشروب') > -1 || n.indexOf('عصير') > -1) {
    return { icon: '🥤', bg: 'linear-gradient(135deg, #d7e8ff, #6aa3ff)', accent: '#1d55db' };
  }
  if (cat === 'الكل') {
    return { icon: '🏪', bg: 'linear-gradient(135deg, #fff5cc, #ffd93d)', accent: '#18160d' };
  }
  return { icon: '📦', bg: 'linear-gradient(135deg, #e8f5ee, #7ed8ab)', accent: '#0f8a50' };
}
