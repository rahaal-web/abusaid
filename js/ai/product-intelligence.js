// Product Intelligence Module: normalization, Egyptian dialect aliases, catalog indexing,
// multi-criteria search, flavor/variant/pack/piece/description metadata, and duplicate detection.

export function rnd(s) {
  return String(s == null ? '' : s)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

export function rn(s) {
  return rnd(s)
    .replace(/[^\u0621-\u064Aa-zA-Z0-9.+/-]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/(?:^|\s)[.+/-]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function rtk(s) {
  const clean = rn(s);
  return clean ? clean.split(' ').filter(Boolean) : [];
}

export const ALIAS_MAP = {
  شبسي: 'شيبسي',
  شيبس: 'شيبسي',
  تشيبس: 'شيبسي',
  تشيبسي: 'شيبسي',
  شبس: 'شيبسي',
  دريتوس: 'دوريتوس',
  دوريتس: 'دوريتوس',
  دريتس: 'دوريتوس',
  فرسكا: 'فريسكا',
  فرسكه: 'فريسكا',
  فريسكه: 'فريسكا',
  بسكوت: 'بسكويت',
  بسكوته: 'بسكويت',
  بسكويته: 'بسكويت',
  شيكولاته: 'شوكولاته',
  شكولاته: 'شوكولاته',
  شوكولات: 'شوكولاته',
  شيكولات: 'شوكولاته',
  شوكلاته: 'شوكولاته',
  شوكليت: 'شوكولاته',
  فانيلا: 'فانيليا',
  فنليا: 'فانيليا',
  ستريبس: 'ستربس',
  ستربز: 'ستربس',
  كارتيه: 'كراتيه',
  لمون: 'ليمون',
  شطا: 'شطه',
  شتة: 'شطه',
  شط: 'شطه',
  مشاطه: 'شطه',
  مشطه: 'شطه',
  كتشب: 'كاتشب',
  كاتشاب: 'كاتشب',
  طماط: 'طماطم',
  قوطه: 'طماطم',
  جبن: 'جبنه',
  شدر: 'شيدر',
  مقرمشات: 'سناكس',
  سناك: 'سناكس',
  عصاير: 'عصير',
  حلويات: 'حلوي',
  عايلي: 'عائلي',
  كبيره: 'كبير',
  صغيره: 'صغير',
  وسطاني: 'وسط',
  بربكيو: 'باربكيو',
  باربيكيو: 'باربكيو',
  بابريكا: 'بابريكا',
  دجاج: 'فراخ',
  توم: 'ثوم',
};

export function normTok(t) {
  let x = rn(t);
  if (x.length > 3 && x.startsWith('ال')) x = x.slice(2);
  return ALIAS_MAP[x] || x;
}

export function ntk(s) {
  return rtk(s).map((t) => normTok(t));
}

export const RNUM_WORDS = Object.freeze({
  واحد: 1,
  واحده: 1,
  اتنين: 2,
  اثنين: 2,
  اتنتين: 2,
  تنين: 2,
  كرتونتين: 2,
  كارتونتين: 2,
  علبتين: 2,
  كيسين: 2,
  تلاته: 3,
  ثلاثه: 3,
  تلات: 3,
  ثلاث: 3,
  اربعه: 4,
  اربع: 4,
  خمسه: 5,
  خمس: 5,
  سته: 6,
  ست: 6,
  سبعه: 7,
  سبع: 7,
  تمانيه: 8,
  ثمانيه: 8,
  تمن: 8,
  ثمان: 8,
  تسعه: 9,
  تسع: 9,
  عشره: 10,
  عشر: 10,
  احداشر: 11,
  احدعشر: 11,
  اتناشر: 12,
  اثناعشر: 12,
  تلتاشر: 13,
  ثلاثتعشر: 13,
  اربعتاشر: 14,
  خمستاشر: 15,
  ستاشر: 16,
  سبعتاشر: 17,
  تمنتاشر: 18,
  تسعتاشر: 19,
  عشرين: 20,
  تلاتين: 30,
  ثلاثين: 30,
  اربعين: 40,
  خمسين: 50,
  ستين: 60,
  سبعين: 70,
  تمانين: 80,
  تسعين: 90,
  ميه: 100,
  مائه: 100,
});

export const DOZEN_WORDS = new Set(['دسته', 'دستتين']);
export const CARTON_WORDS = new Set(['كرتونه', 'كارتونه', 'كراتين', 'كرتون', 'كرتونتين', 'كارتونتين']);
export const PIECE_UNITS = ['قطعه', 'حبه', 'كيس', 'علبه', 'باكو', 'وحده', 'عبوه', 'زجاجه', 'برطمان'];

export const RSTOP_SET = new Set(
  (
    'عايز عاوز عايزه عاوزه اريد ابغي محتاج محتاجه هات هاتلي ضيف ضيفلي اضف اضافه طلب اطلب ابعت بعت ممكن لو سمحت من فضلك يا باشا معلم استاذ ريس ' +
    'كرتونه كراتين كرتون كارتونه كرتونتين علبه علب علبتين دسته دستتين شوال عدد حبه قطعه وحده وحدات في من علي الي على عن لي ده دي مع معاهم ورقم ' +
    'صنف نوع طعم نكهه نكهات اطعمه طعوم بطعم بنكهة بتاع بتاعه متوفر موجود بكام سعر كام جنيه جني ج ابو ام فئه خليهم يبقي تاني تانيه كمان بس المنتج منتج'
  )
    .split(' ')
    .map(normTok)
    .filter(Boolean)
);

export const FLAVOR_MODIFIER_WORDS = new Set(
  'نكهه طعم بطعم بنكهة نكهات اطعمه طعوم'.split(' ').map(normTok)
);

export function getProductFlavors(p) {
  if (!Array.isArray(p) || !Array.isArray(p[9])) return [];
  return p[9]
    .map((f) => {
      if (Array.isArray(f)) return [String(f[0] || '').trim(), f[1] ? 1 : 0];
      const s = String(f || '').trim();
      return s ? [s, 0] : null;
    })
    .filter((f) => f && f[0]);
}

export function isProductOutOfStock(p) {
  if (!p) return true;
  if (p[7]) return true;
  const fl = getProductFlavors(p);
  return fl.length > 0 && fl.every((f) => f[1]);
}

export function getProductDisplayName(p) {
  if (!p) return '';
  const name = String(p[0] || '').trim();
  const variant = String(p[10] || '').trim();
  return variant ? `${name} · ${variant}` : name;
}

export function getProductDescription(p) {
  if (!Array.isArray(p)) return '';
  return String(p[13] || '').trim();
}

export function getProductSaleUnit(p, cfg = {}) {
  if (Array.isArray(p) && p[14] && String(p[14]).trim()) {
    return String(p[14]).trim();
  }
  return String(cfg?.unit || 'كرتونة').trim() || 'كرتونة';
}

export function getProductPieceCount(p) {
  const pack = String(p?.[2] || '').trim();
  const m = rnd(pack).match(/(\d+)/);
  return m ? Number(m[1]) || 0 : 0;
}

export function getProductStableKey(p, idx = -1) {
  if (!p) return `idx_${idx}`;
  if (p[15] && String(p[15]).trim()) return String(p[15]).trim();
  return [rn(p[0]), rn(p[10] || ''), rn(p[2] || ''), rn(p[1] || '')].join('|');
}

export function isOfferActiveNow(o, nowDate = new Date()) {
  if (!o || o.x || !o.t) return false;
  const d = nowDate instanceof Date ? nowDate : new Date(nowDate || Date.now());
  const todayStr =
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  if (o.startDate && String(o.startDate).trim() > todayStr) return false;
  if (o.endDate && String(o.endDate).trim() < todayStr) return false;
  return true;
}

export function buildStoreKB(catalogData = {}, nowDate = new Date()) {
  const products = Array.isArray(catalogData.p) ? catalogData.p : [];
  const cfg = catalogData.cfg && typeof catalogData.cfg === 'object' ? catalogData.cfg : {};
  const avail = [];
  const soldOut = [];
  const discounts = [];
  const cats = {};
  const flavorIndex = {};

  products.forEach((p, idx) => {
    if (!p || !p[0]) return;
    const fl = getProductFlavors(p);
    const availFlavors = [];
    const outFlavors = [];
    fl.forEach((f, j) => {
      if (f[1]) outFlavors.push({ j, name: f[0] });
      else availFlavors.push({ j, name: f[0] });
    });
    const out = isProductOutOfStock(p);
    const price = Number(p[3] || 0);
    const oldP = Number(p[11] || 0) > price ? Number(p[11]) : 0;
    const discPct = oldP ? Math.round(((oldP - price) / oldP) * 100) : 0;
    const rec = {
      idx,
      pid: getProductStableKey(p, idx),
      p,
      name: getProductDisplayName(p),
      baseName: String(p[0] || '').trim(),
      cat: String(p[1] || '').trim(),
      pack: String(p[2] || '').trim(),
      desc: getProductDescription(p),
      saleUnit: getProductSaleUnit(p, cfg),
      pieces: getProductPieceCount(p),
      price,
      oldPrice: oldP,
      discPct,
      variant: String(p[10] || '').trim(),
      imageId: String(p[8] || '').trim(),
      emoji: String(p[6] || '🥔').trim() || '🥔',
      bg1: String(p[4] || '#ffd93d').trim(),
      bg2: String(p[5] || '#f59e0b').trim(),
      availFlavors,
      outFlavors,
      out,
    };
    if (out) {
      soldOut.push(rec);
    } else {
      avail.push(rec);
      const catKey = rec.cat || 'عام';
      if (!cats[catKey]) cats[catKey] = [];
      cats[catKey].push(rec);
      if (discPct > 0) discounts.push(rec);
      availFlavors.forEach((af) => {
        const fk = normTok(af.name);
        if (!flavorIndex[fk]) flavorIndex[fk] = [];
        flavorIndex[fk].push({ rec, flavorIdx: af.j, flavorName: af.name });
      });
    }
  });

  discounts.sort((a, b) => b.discPct - a.discPct);
  const offers = (Array.isArray(catalogData.offers) ? catalogData.offers : []).filter((o) =>
    isOfferActiveNow(o, nowDate)
  );
  return { avail, soldOut, discounts, cats, offers, flavorIndex, cfg, products };
}

export function buildProductCardDescriptor(p, idx, cfg = {}, options = {}) {
  if (!p) return null;
  const fl = getProductFlavors(p);
  const availFlavors = fl
    .map((f, j) => (f[1] ? null : { j, name: f[0] }))
    .filter(Boolean);
  const price = Number(p[3] || 0);
  const oldPrice = Number(p[11] || 0) > price ? Number(p[11]) : 0;
  const displayName = getProductDisplayName(p);
  return {
    i: idx,
    name: displayName,
    baseName: String(p[0] || '').trim(),
    variant: String(p[10] || '').trim(),
    category: String(p[1] || '').trim(),
    pack: String(p[2] || '').trim(),
    desc: getProductDescription(p),
    saleUnit: getProductSaleUnit(p, cfg),
    price,
    oldPrice,
    discPct: oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0,
    imageId: String(p[8] || '').trim(),
    emoji: String(p[6] || '🥔').trim() || '🥔',
    bg1: String(p[4] || '#ffd93d').trim(),
    bg2: String(p[5] || '#f59e0b').trim(),
    out: isProductOutOfStock(p),
    availFlavors,
    selectVal: options.selectVal || displayName,
    qtyHint: options.qtyHint || null,
  };
}

export function lev(a, b) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  if (Math.abs(la - lb) > 2) return 9;
  const d = [];
  for (let i = 0; i <= la; i++) d[i] = [i];
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[la][lb];
}

export function tokSim(qTok, targetToks) {
  if (!qTok || !targetToks.length) return 0;
  if (targetToks.includes(qTok)) return 1;
  let best = 0;
  for (let i = 0; i < targetToks.length; i++) {
    const t = targetToks[i];
    if (qTok.length >= 3 && t.length >= 3) {
      if (t.startsWith(qTok) || qTok.startsWith(t)) {
        best = Math.max(best, 0.85);
        continue;
      }
      const dist = lev(qTok, t);
      const maxL = Math.max(qTok.length, t.length);
      const firstCharMismatchShort = maxL <= 5 && qTok[0] !== t[0];
      if (!firstCharMismatchShort && (dist <= 1 || (maxL >= 6 && dist <= 2))) {
        best = Math.max(best, 1 - dist / maxL);
      }
    }
  }
  return best >= 0.7 ? best : 0;
}

export function extractHints(sg) {
  const hints = [];
  let clean = rnd(sg);
  clean = clean.replace(
    /(?:^|\s)(?:بـ?|ابو|ام|فئه|فئة|سعر)\s*(\d+)(?:\s*(?:جنيه|جني|ج))?(?=\s|$)/g,
    (_, num) => {
      hints.push(+num);
      return ' ';
    }
  );
  clean = clean.replace(/(\d+)\s*(?:جنيه|جني|ج)(?=\s|$)/g, (_, num) => {
    hints.push(+num);
    return ' ';
  });
  return { clean: clean.trim(), hints };
}

export function getUnitPolicy(unit = 'كرتونة') {
  const uNorm = normTok(unit || 'كرتونة');
  const isDozenUnit = uNorm.includes('دست');
  const isPieceUnit = PIECE_UNITS.some((pu) => uNorm.includes(pu));
  const isCartonUnit = uNorm.includes('كرتون') || uNorm.includes('شوال') || (!isDozenUnit && !isPieceUnit);
  return {
    unit: String(unit || 'كرتونة').trim() || 'كرتونة',
    isDozenUnit,
    isPieceUnit,
    isCartonUnit,
    dozenMeansTwelve: isPieceUnit,
  };
}

const SINGULAR_UNIT_WORDS = new Set([
  'كرتونه',
  'كارتونه',
  'علبه',
  'كيس',
  'باكو',
  'شوال',
  'عبوه',
  'زجاجه',
  'برطمان',
]);

export function parseQuantityAndRest(rawText, storeUnit = 'كرتونة') {
  const policy = getUnitPolicy(storeUnit);
  const cleanText = rnd(rawText).trim();
  const toks = rtk(cleanText);
  let qty = 0;
  let explicitQty = false;
  let hasSingularUnit = false;
  let unitMismatch = null;
  let distributive = null; // 'flavors' | 'types' | null
  const rest = [];

  if (/(?:من\s+كل\s+(?:نكهه|نكهة|طعم)|كل\s+النكهات|كل\s+الاطعمه)/.test(rn(cleanText))) {
    distributive = 'flavors';
  } else if (
    /(?:من\s+كل\s+(?:نوع|صنف|حجم)|كل\s+الانواع|(?:من\s+)?الانواع\s+دي\s+كلها)/.test(rn(cleanText))
  ) {
    distributive = 'types';
  }

  const processedToks = [];
  for (let i = 0; i < toks.length; i++) {
    const t = normTok(toks[i]);
    if (
      i + 1 < toks.length &&
      RNUM_WORDS[t] &&
      RNUM_WORDS[t] < 10 &&
      toks[i + 1].startsWith('و')
    ) {
      const second = normTok(toks[i + 1].slice(1));
      if (RNUM_WORDS[second] >= 20 && RNUM_WORDS[second] < 100) {
        processedToks.push(String(RNUM_WORDS[t] + RNUM_WORDS[second]));
        i += 1;
        continue;
      }
    }
    processedToks.push(toks[i]);
  }

  for (let i = 0; i < processedToks.length; i++) {
    const rawT = processedToks[i];
    const nt = normTok(rawT);
    const bare = nt.startsWith('و') && nt.length > 2 ? normTok(nt.slice(1)) : nt;

    if (SINGULAR_UNIT_WORDS.has(bare)) {
      hasSingularUnit = true;
    }

    if (DOZEN_WORDS.has(bare)) {
      if (policy.isDozenUnit) {
        const val = bare === 'دستتين' ? 2 : 1;
        if (!explicitQty) {
          qty = val;
          explicitQty = true;
        }
        continue;
      }
      if (policy.dozenMeansTwelve) {
        const val = bare === 'دستتين' ? 24 : 12;
        if (!explicitQty) {
          qty = val;
          explicitQty = true;
        }
        continue;
      }
      unitMismatch = {
        requestedUnit: bare === 'دستتين' ? 'دستتين' : 'دستة',
        storeUnit: policy.unit,
      };
      continue;
    }

    if (CARTON_WORDS.has(bare) && policy.isDozenUnit) {
      unitMismatch = {
        requestedUnit: bare,
        storeUnit: policy.unit,
      };
      continue;
    }

    let v = null;
    if (/^\d+$/.test(rawT)) {
      v = +rawT;
    } else if (RNUM_WORDS[nt] != null) {
      v = RNUM_WORDS[nt];
    } else if (rawT.startsWith('و') && RNUM_WORDS[normTok(rawT.slice(1))] != null) {
      v = RNUM_WORDS[normTok(rawT.slice(1))];
    }

    if (v != null && v > 0 && v < 1000 && !explicitQty) {
      qty = v;
      explicitQty = true;
      continue;
    }

    if (nt === 'كل' && i > 0 && normTok(processedToks[i - 1]) === 'من') continue;
    if (distributive && ['كل', 'كلها', 'نوع', 'صنف', 'حجم', 'نكهه', 'طعم', 'انواع', 'نكهات', 'اطعمه'].includes(nt)) {
      continue;
    }

    rest.push(nt);
  }

  return {
    qty: explicitQty ? qty : 1,
    explicitQty,
    hasSingularUnit,
    unitMismatch,
    distributive,
    rest,
  };
}

const SEG_SPLIT_RE = new RegExp(
  '\\n|[,،؛;+.]|(?:\\s+و\\s+|\\s+و)(?=(?:\\d|' +
    Object.keys(RNUM_WORDS)
      .concat(['دسته', 'دستتين', 'كرتونه', 'كراتين', 'علبه', 'علب', 'باكو', 'شوال'])
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/ه/g, '[هة]').replace(/ا/g, '[اأإآ]'))
      .join('|') +
    '|عايز|هات|ضيف|شيل|احذف|زود|نقص|قلل|من)(?:\\s|$))|\\s+و(?=\\d)|\\s+ومعاهم\\s+|\\s+وكمان\\s+|\\s+كمان\\s+|\\s+ثم\\s+'
);

export function segmentOrderText(text) {
  const normalized = rnd(text).replace(/\r/g, '');
  const protectedText = normalized
    .replace(/ملح\s+و\s*خل/g, 'ملح_وخل')
    .replace(/خل\s+و\s*ملح/g, 'خل_وملح');
  return protectedText
    .split(SEG_SPLIT_RE)
    .map((s) => s.replace(/ملح_وخل/g, 'ملح وخل').replace(/خل_وملح/g, 'خل وملح').trim())
    .filter(Boolean);
}

export function matchProductFlavors(product, queryTokens, rawCleanText = '') {
  const fl = getProductFlavors(product);
  const avail = [];
  const soldOut = [];
  const matchedIndices = new Set();
  const normRaw = rn(rawCleanText);

  fl.forEach((f, j) => {
    const fNorm = rn(f[0]);
    const fToks = ntk(f[0]).filter((t) => !RSTOP_SET.has(t));
    if (!fToks.length) return;

    if (fNorm.length >= 2 && normRaw && (normRaw.includes(fNorm) || normRaw.includes(fToks.join(' ')))) {
      matchedIndices.add(j);
      if (f[1]) soldOut.push({ j, name: f[0], score: 10 });
      else avail.push({ j, name: f[0], score: 10 });
      return;
    }

    let score = 0;
    let exactHits = 0;
    queryTokens.forEach((qt) => {
      const s = tokSim(qt, fToks);
      if (s > 0) {
        score += s;
        if (s === 1) exactHits++;
      }
    });
    if (exactHits >= fToks.length || (score >= 0.85 && fToks.length === 1) || score >= fToks.length * 0.8) {
      matchedIndices.add(j);
      if (f[1]) soldOut.push({ j, name: f[0], score });
      else avail.push({ j, name: f[0], score });
    }
  });

  avail.sort((a, b) => b.score - a.score);
  soldOut.sort((a, b) => b.score - a.score);
  return { avail, soldOut, matchedIndices };
}

export function matchProductsInCatalog(restTokens, products, options = {}) {
  const {
    priceHints = [],
    includeSoldOut = false,
    rawCleanText = '',
  } = options;

  const S = [];
  restTokens.forEach((t) => {
    const nt = normTok(t);
    if (!nt || RSTOP_SET.has(nt)) return;
    if (!S.includes(nt)) S.push(nt);
    if (nt.length > 3 && nt.startsWith('و')) {
      const sub = normTok(nt.slice(1));
      if (sub && !RSTOP_SET.has(sub) && !S.includes(sub)) S.push(sub);
    }
  });

  if (!S.length) return null;

  const cs = [];
  const cleanPhrase = ntk(rawCleanText).filter((t) => !RSTOP_SET.has(t)).join(' ');

  products.forEach((p, i) => {
    if (!p || !p[0]) return;
    const out = isProductOutOfStock(p);
    if (out && !includeSoldOut) return;

    const baseToks = ntk(p[0]).filter((t) => !RSTOP_SET.has(t));
    const varToks = ntk((p[10] || '') + ' ' + (p[2] || '')).filter((t) => !RSTOP_SET.has(t));
    const nameToks = [...baseToks, ...varToks];
    const catToks = ntk(p[1] || '').filter((t) => !RSTOP_SET.has(t));
    const descToks = ntk(p[13] || '').filter((t) => !RSTOP_SET.has(t));
    const fl = getProductFlavors(p);
    const flAllToks = new Set();
    fl.forEach((f) => ntk(f[0]).forEach((ft) => flAllToks.add(ft)));

    let baseExactHits = 0;
    let baseFuzzyScore = 0;
    let varExactHits = 0;
    let catScore = 0;
    let descScore = 0;
    const unmatchedNonFlavorTokens = [];

    S.forEach((qt) => {
      const bSim = tokSim(qt, baseToks);
      const vSim = tokSim(qt, varToks);
      if (bSim === 1) {
        baseExactHits++;
        baseFuzzyScore += 1;
      } else if (vSim === 1) {
        varExactHits++;
      } else if (bSim > 0) {
        baseFuzzyScore += bSim;
      } else if (vSim > 0) {
        baseFuzzyScore += vSim * 0.7;
      } else {
        const cSim = tokSim(qt, catToks);
        const dSim = descToks.length ? tokSim(qt, descToks) : 0;
        if (cSim > 0) {
          catScore += cSim * 0.35;
        } else if (dSim > 0) {
          descScore += dSim * 0.3;
        } else if (!flAllToks.has(qt)) {
          let flSim = 0;
          flAllToks.forEach((ft) => {
            flSim = Math.max(flSim, tokSim(qt, [ft]));
          });
          if (flSim < 0.85) unmatchedNonFlavorTokens.push(qt);
        }
      }
    });

    let fm = 0;
    fl.forEach((f) => {
      if (f[1] && !includeSoldOut) return;
      const ft = ntk(f[0]);
      let c = 0;
      S.forEach((qt) => {
        c += tokSim(qt, ft);
      });
      if (c > fm) fm = c;
    });

    let hintBoost = 0;
    let hintMismatch = false;
    if (priceHints.length) {
      const vStr = rnd(String(p[10] || '') + ' ' + String(p[2] || ''));
      const matchedAnyHint = priceHints.some((h) => {
        if (Number(p[3]) === h) {
          hintBoost += 16;
          return true;
        }
        if (new RegExp('(?:^|\\D)' + h + '(?:\\D|$)').test(vStr)) {
          hintBoost += 12;
          return true;
        }
        return false;
      });
      if (!matchedAnyHint) hintMismatch = true;
    }

    const basePhrase = baseToks.join(' ');
    const fullPhrase = nameToks.join(' ');
    const exactBase = Boolean(basePhrase && (cleanPhrase === basePhrase || S.join(' ') === basePhrase));
    const exactFull = Boolean(fullPhrase && cleanPhrase === fullPhrase);

    const isStrongNameMatch = baseExactHits > 0;
    const isFuzzyOnly = !isStrongNameMatch && baseFuzzyScore >= 0.7;

    const coverage = baseToks.length ? (baseExactHits + varExactHits) / Math.max(1, baseToks.length) : 0;
    const totalScore =
      (exactFull ? 25 : exactBase ? 18 : 0) +
      baseExactHits * 14 +
      varExactHits * 11 +
      baseFuzzyScore * 7 +
      coverage * 6 +
      catScore +
      descScore +
      fm * 3.5 +
      hintBoost -
      unmatchedNonFlavorTokens.length * 4 -
      (hintMismatch ? 12 : 0) -
      (out ? 3 : 0);

    const tooManyUnmatched = isFuzzyOnly && unmatchedNonFlavorTokens.length > Math.max(1, baseToks.length);
    if (!tooManyUnmatched && (baseExactHits > 0 || baseFuzzyScore >= 0.7 || (fm >= 0.9 && !unmatchedNonFlavorTokens.length))) {
      cs.push({
        i,
        s: totalScore,
        out,
        exactBase,
        exactFull,
        baseExactHits,
        varExactHits,
        isFuzzyOnly,
        flavorOnlyMatch: baseExactHits === 0 && baseFuzzyScore < 0.7 && fm >= 0.9,
        unmatchedTokens: unmatchedNonFlavorTokens,
        hintMismatch,
      });
    }
  });

  cs.sort((a, b) => b.s - a.s);
  return cs.length ? { cs, S } : null;
}

export function detectUnmatchedFlavorTokens(product, queryTokens, matchedFlavorsResult) {
  const nameAndVar = new Set(
    ntk(product[0] + ' ' + (product[10] || '') + ' ' + (product[2] || '') + ' ' + (product[1] || ''))
  );
  const matchedFlToks = new Set();
  [...(matchedFlavorsResult.avail || []), ...(matchedFlavorsResult.soldOut || [])].forEach((m) => {
    ntk(m.name).forEach((t) => matchedFlToks.add(t));
  });

  const extra = [];
  queryTokens.forEach((qt) => {
    if (RSTOP_SET.has(qt) || FLAVOR_MODIFIER_WORDS.has(qt)) return;
    if (nameAndVar.has(qt) || matchedFlToks.has(qt)) return;
    if (tokSim(qt, Array.from(nameAndVar)) >= 0.8) return;
    extra.push(qt);
  });
  return extra;
}

export function searchCatalogProducts(filter = {}, catalogData = {}) {
  const products = Array.isArray(catalogData.p) ? catalogData.p : [];
  const cats = Array.isArray(catalogData.cats) ? catalogData.cats : [];
  const includeHidden = Boolean(filter.includeHidden);
  const minPrice = filter.minPrice != null && isFinite(Number(filter.minPrice)) ? Number(filter.minPrice) : null;
  const maxPrice = filter.maxPrice != null && isFinite(Number(filter.maxPrice)) ? Number(filter.maxPrice) : null;
  const category = filter.category
    ? cats.find((c) => rn(c) === rn(filter.category) || rn(c).includes(rn(filter.category)) || rn(filter.category).includes(rn(c))) || filter.category
    : '';
  const qNorm = filter.query ? rn(filter.query) : '';
  const startsWith = Boolean(filter.startsWith);

  const hits = [];
  products.forEach((p, idx) => {
    if (!p || !p[0]) return;
    if (!includeHidden && isProductOutOfStock(p)) return;
    if (category && rn(p[1]) !== rn(category)) return;
    const price = Number(p[3] || 0);
    if (minPrice != null && price < minPrice) return;
    if (maxPrice != null && price > maxPrice) return;
    if (qNorm) {
      const pn = rn(p[0]);
      const pFull = rn(getProductDisplayName(p));
      const pDesc = rn(getProductDescription(p));
      const flStr = getProductFlavors(p).map((f) => rn(f[0])).join(' ');
      if (startsWith) {
        if (!pn.startsWith(qNorm)) return;
      } else if (!pn.includes(qNorm) && !pFull.includes(qNorm) && !flStr.includes(qNorm) && !pDesc.includes(qNorm)) {
        return;
      }
    }
    hits.push({ idx, p });
  });
  return hits;
}

export function checkProductDuplicates(candidate, existingProducts = []) {
  const nameNorm = rn(candidate?.n || candidate?.name || '');
  const varNorm = rn(candidate?.v || candidate?.variant || '');
  const candToks = ntk(candidate?.n || candidate?.name || '').filter((t) => !RSTOP_SET.has(t));
  const exactMatches = [];
  const similarMatches = [];

  if (!nameNorm) return { exactMatches, similarMatches };

  existingProducts.forEach((p, idx) => {
    if (!p || !p[0]) return;
    const pNameNorm = rn(p[0]);
    const pVarNorm = rn(p[10] || '');
    if (pNameNorm === nameNorm && pVarNorm === varNorm) {
      exactMatches.push({ idx, p, label: getProductDisplayName(p), price: Number(p[3] || 0), category: p[1] });
      return;
    }
    if (pNameNorm === nameNorm) {
      similarMatches.push({ idx, p, label: getProductDisplayName(p), price: Number(p[3] || 0), category: p[1], reason: 'نفس الاسم بحجم مختلف' });
      return;
    }
    const pToks = ntk(p[0]).filter((t) => !RSTOP_SET.has(t));
    if (candToks.length && pToks.length) {
      let hits = 0;
      candToks.forEach((qt) => {
        if (tokSim(qt, pToks) >= 0.85) hits += 1;
      });
      const ratio = hits / Math.max(candToks.length, pToks.length);
      if (ratio >= 0.8) {
        similarMatches.push({ idx, p, label: getProductDisplayName(p), price: Number(p[3] || 0), category: p[1], reason: 'اسم مشابه جداً' });
      }
    }
  });

  return { exactMatches, similarMatches };
}
