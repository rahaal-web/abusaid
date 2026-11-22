// Pure isomorphic AI catalog, matching, quantity, flavor, draft, and validation engine.
// Zero DOM / Node dependencies: runs identically in server.js, worker.js, storefront, admin, and tests.

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
  ميه: 'مياه',
  مايه: 'مياه',
  مياة: 'مياه',
  ببسي: 'بيبسي',
  كولا: 'كوكاكولا',
  مولتوا: 'مولتو',
  كرانش: 'كرانشي',
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
  نصف: 0.5,
  نص: 0.5,
  ربع: 0.25,
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

const DOZEN_WORDS = new Set(['دسته', 'دستتين']);
const CARTON_WORDS = new Set(['كرتونه', 'كارتونه', 'كراتين', 'كرتون', 'كرتونتين', 'كارتونتين']);
const PIECE_UNITS = ['قطعه', 'حبه', 'كيس', 'علبه', 'باكو', 'وحده', 'عبوه', 'زجاجه', 'برطمان'];

const RSTOP_SET = new Set(
  (
    'عايز عاوز عايزه عاوزه اريد ابغي محتاج محتاجه هات هاتلي ضيف ضيفلي اضف اضافه طلب اطلب ابعت بعت ممكن لو سمحت من فضلك يا باشا معلم استاذ ريس ' +
    'كرتونه كراتين كرتون كارتونه كرتونتين علبه علب علبتين دسته دستتين شوال عدد حبه قطعه وحده وحدات في من علي الي على عن لي ده دي مع معاهم ورقم ' +
    'نصف نص ربع ونصف ونص وربع نفس ' +
    'صنف نوع طعم نكهه نكهات اطعمه طعوم بطعم بنكهة بتاع بتاعه متوفر موجود بكام سعر كام جنيه جني ج ابو ام فئه خليهم يبقي تاني تانيه كمان بس المنتج منتج'
  )
    .split(' ')
    .map(normTok)
    .filter(Boolean)
);

const FLAVOR_MODIFIER_WORDS = new Set(
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

export function getProductStableKey(p, idx = -1) {
  if (!p) return `idx_${idx}`;
  if (p[13] && String(p[13]).trim()) return String(p[13]).trim();
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
      price,
      oldPrice: oldP,
      discPct,
      variant: String(p[10] || '').trim(),
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
      const lenRatio = Math.min(qTok.length, t.length) / Math.max(qTok.length, t.length);
      if ((t.startsWith(qTok) || qTok.startsWith(t)) && lenRatio >= 0.6) {
        best = Math.max(best, 0.85);
        continue;
      }
      const dist = lev(qTok, t);
      const maxL = Math.max(qTok.length, t.length);
      const firstCharMismatch = qTok[0] !== t[0];
      if (!firstCharMismatch && (dist <= 1 || (maxL >= 8 && qTok[1] === t[1] && dist <= 2))) {
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
  } else if (/(?:من\s+كل\s+(?:نوع|صنف|حجم)|كل\s+الانواع)/.test(rn(cleanText))) {
    distributive = 'types';
  }

  // Handle compound numbers e.g., "خمسة وعشرين" or "واحد وعشرين"
  const processedToks = [];
  for (let i = 0; i < toks.length; i++) {
    const t = normTok(toks[i]);
    if (
      i + 1 < toks.length &&
      RNUM_WORDS[t] &&
      RNUM_WORDS[t] >= 1 &&
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

    // Fractional suffix right after an integer/singular unit: e.g. "كرتونة ونص", "2 ونصف"
    if (nt.startsWith('و') && (bare === 'نصف' || bare === 'نص' || bare === 'ربع')) {
      const frac = bare === 'ربع' ? 0.25 : 0.5;
      if (explicitQty && qty >= 1) {
        qty = Math.round((qty + frac) * 100) / 100;
        continue;
      }
      if (!explicitQty && hasSingularUnit) {
        qty = Math.round((1 + frac) * 100) / 100;
        explicitQty = true;
        continue;
      }
    }

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
    if (/^\d+(?:\.\d+)?$/.test(rawT)) {
      v = Number(rawT);
    } else if (RNUM_WORDS[nt] != null) {
      v = RNUM_WORDS[nt];
    } else if (rawT.startsWith('و') && RNUM_WORDS[normTok(rawT.slice(1))] != null) {
      v = RNUM_WORDS[normTok(rawT.slice(1))];
    }

    if (v != null && Number.isFinite(v) && v > 0 && v < 1000 && !explicitQty) {
      qty = Math.round(v * 100) / 100;
      explicitQty = true;
      continue;
    }

    // Remove distributive boilerplate tokens from search terms
    if (nt === 'كل' && i > 0 && normTok(processedToks[i - 1]) === 'من') continue;
    if (distributive && ['كل', 'نوع', 'صنف', 'حجم', 'نكهه', 'طعم', 'انواع', 'نكهات', 'اطعمه'].includes(nt)) {
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
  '\\n|[,،؛;+]|\\.(?!\\d)|(?:\\s+و\\s+|\\s+و)(?=(?:\\d|' +
    Object.keys(RNUM_WORDS)
      .concat(['دسته', 'دستتين', 'كرتونه', 'كراتين', 'علبه', 'علب', 'باكو', 'شوال'])
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/ه/g, '[هة]').replace(/ا/g, '[اأإآ]'))
      .join('|') +
    '|نفس\\s+(?:ال)?(?:حجم|نوع|سعر|صنف)|عايز|هات|ضيف|شيل|احذف|زود|نقص|قلل|من)(?:\\s|$))|\\s+و(?=\\d)|\\s+ومعاهم\\s+|\\s+وكمان\\s+|\\s+كمان\\s+|\\s+ثم\\s+|\\s+وبعدين\\s+'
);

export function segmentOrderText(text, products = []) {
  const normalized = rnd(text).replace(/\r/g, '');
  const protectedPhrases = [
    'ملح وخل',
    'خل وملح',
    'لب وسوداني',
    'جبنة وبصل',
    'بصل وجبنة',
    'ليمون ونعناع',
    'نعناع وليمون',
    'فراولة وموز',
    'شوكولاتة وبندق',
    'عسل وليمون',
  ];
  const dynamicWawWords = new Set();
  const catalogBaseProdTokens = new Set();
  const catalogLiteralWords = new Set();
  const catalogFlavorTokens = new Set();
  const flavorTokensByProdIdx = new Map();

  (Array.isArray(products) ? products : []).forEach((p, idx) => {
    if (!p || !p[0]) return;
    const base = String(p[0] || '');
    const vari = String(p[10] || '');
    if (/\s+و\s*/.test(base)) protectedPhrases.push(rnd(base).trim());
    if (/\s+و\s*/.test(vari)) protectedPhrases.push(rnd(vari).trim());
    ntk(base).forEach((t) => {
      if (t && !RSTOP_SET.has(t)) {
        catalogBaseProdTokens.add(t);
        catalogLiteralWords.add(t);
        if (t.startsWith('و')) dynamicWawWords.add(t);
      }
    });
    ntk(vari).forEach((t) => {
      if (t) catalogLiteralWords.add(t);
    });
    const flSet = new Set();
    getProductFlavors(p).forEach((f) => {
      if (/\s+و\s*/.test(f[0])) protectedPhrases.push(rnd(f[0]).trim());
      ntk(f[0]).forEach((ft) => {
        if (ft && !RSTOP_SET.has(ft)) {
          catalogLiteralWords.add(ft);
          catalogFlavorTokens.add(ft);
          flSet.add(ft);
        }
      });
    });
    flavorTokensByProdIdx.set(idx, flSet);
  });

  // Also include ALIAS_MAP keys whose normalized value hits a catalog product
  Object.keys(ALIAS_MAP).forEach((k) => {
    if (catalogBaseProdTokens.has(ALIAS_MAP[k])) {
      catalogBaseProdTokens.add(k);
    }
  });

  let protectedText = normalized;
  const placeholders = [];

  // Protect compound fractions (e.g., "كرتونة ونص", "2 ونصف", "واحدة وربع") so SEG_SPLIT_RE does not split the fraction away from its base unit/number
  const qtyPrefixWords = Object.keys(RNUM_WORDS)
    .filter((k) => k !== 'نصف' && k !== 'نص' && k !== 'ربع')
    .concat(['كرتونه', 'كارتونه', 'كراتين', 'علبه', 'علب', 'كيس', 'دسته', 'باكو', 'شوال', 'عبوه', 'زجاجه', 'برطمان'])
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const compoundFracRe = new RegExp(
    `(^|\\s)((?:\\d+(?:\\.\\d+)?|${qtyPrefixWords.join('|')})\\s+و\\s*(?:نصف|نص|ربع))(?=(?:\\s+(?!(?:كرتونه|كارتونه|كراتين|علبه|علب|كيس|دسته|باكو|شوال|عبوه)(?:\\s|$))|\\s*$))`,
    'gi'
  );
  protectedText = protectedText.replace(compoundFracRe, (_, lead, phrase) => {
    const cleanPhrase = phrase.replace(/\s+و\s+(نصف|نص|ربع)$/i, ' و$1');
    const tag = `__QTYPH${placeholders.length}__`;
    placeholders.push([tag, cleanPhrase]);
    return `${lead}${tag}`;
  });

  Array.from(new Set(protectedPhrases))
    .filter((ph) => ph.length >= 4)
    .sort((a, b) => b.length - a.length)
    .forEach((ph) => {
      const escPh = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const re = new RegExp(escPh, 'gi');
      if (re.test(protectedText)) {
        const tag = `__PH${placeholders.length}__`;
        placeholders.push([tag, ph]);
        protectedText = protectedText.replace(re, tag);
      }
    });

  const restore = (s) => {
    let out = s;
    for (let k = placeholders.length - 1; k >= 0; k--) {
      out = out.split(placeholders[k][0]).join(placeholders[k][1]);
    }
    return out.trim();
  };

  const initialChunks = protectedText
    .split(SEG_SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean);

  // Second pass: split attached conjunctions "و<اسم منتج>" inside a chunk when preceding tokens already named an item
  const UNCERTAINTY_WORDS = new Set(['تقريبا', 'حاجه', 'حاجة', 'شبيهه', 'شبيهة', 'شبيه', 'او', 'أو', 'كده', 'مثلا', 'مش', 'فاكر', 'عارف', 'متاكد', 'الاحجام', 'الأحجام', 'الحجم', 'بالظبط', 'بالضبط', 'نفس']);
  const finalSegs = [];

  for (const chunk of initialChunks) {
    const words = chunk.split(/\s+/).filter(Boolean);
    let buf = [];
    let hasItemTokenInBuf = false;
    let matchedFlavorsInBuf = new Set();

    const updateBufState = (tok) => {
      const nt = normTok(tok);
      if (!nt || /^__QTYPH\d+__$/i.test(tok) || /^qtyph\d+$/i.test(nt)) {
        return;
      }
      if (/^__PH\d+__$/i.test(tok) || /^ph\d+$/i.test(nt)) {
        hasItemTokenInBuf = true;
        return;
      }
      if (/^\d+(?:\.\d+)?$/.test(tok) || RNUM_WORDS[nt] != null || RSTOP_SET.has(nt) || UNCERTAINTY_WORDS.has(nt)) {
        return;
      }
      hasItemTokenInBuf = true;
      // Record any product flavors if nt matches a catalog product
      (Array.isArray(products) ? products : []).forEach((p, idx) => {
        const pToks = ntk(p?.[0] || '');
        if (pToks.includes(nt) || catalogBaseProdTokens.has(nt)) {
          if (pToks.includes(nt)) {
            const flSet = flavorTokensByProdIdx.get(idx);
            if (flSet) flSet.forEach((ft) => matchedFlavorsInBuf.add(ft));
          }
        }
      });
    };

    for (let idx = 0; idx < words.length; idx++) {
      const w = words[idx];
      const nt = normTok(w);
      const rawStripped = w.length >= 3 && (w.startsWith('و') || nt.startsWith('و')) ? w.slice(1) : '';
      const strippedNt = rawStripped ? normTok(rawStripped) : '';

      const canSplitAttachedWaw =
        idx > 0 &&
        hasItemTokenInBuf &&
        rawStripped &&
        strippedNt.length >= 2 &&
        !dynamicWawWords.has(nt) &&
        !catalogLiteralWords.has(nt) &&
        !RSTOP_SET.has(nt) &&
        !UNCERTAINTY_WORDS.has(strippedNt) &&
        !FLAVOR_MODIFIER_WORDS.has(strippedNt) &&
        !RSTOP_SET.has(strippedNt) &&
        !matchedFlavorsInBuf.has(strippedNt) &&
        !(catalogFlavorTokens.has(strippedNt) && !catalogBaseProdTokens.has(strippedNt)) &&
        !['كبير', 'صغير', 'وسط', 'عائلي', 'جامبو', 'ساده'].includes(strippedNt);

      if (canSplitAttachedWaw) {
        finalSegs.push(restore(buf.join(' ')));
        buf = [rawStripped];
        hasItemTokenInBuf = false;
        matchedFlavorsInBuf = new Set();
        updateBufState(rawStripped);
      } else {
        buf.push(w);
        updateBufState(w);
      }
    }

    if (buf.length) {
      finalSegs.push(restore(buf.join(' ')));
    }
  }

  return finalSegs.filter(Boolean);
}

export function matchProductFlavors(product, queryTokens, rawCleanText = '') {
  const fl = getProductFlavors(product);
  const avail = [];
  const soldOut = [];
  const matchedIndices = new Set();
  const normRaw = rn(rawCleanText);

  const expandedToks = [];
  (queryTokens || []).forEach((t) => {
    const nt = normTok(t);
    if (!nt) return;
    expandedToks.push(nt);
    if (nt.length > 2 && nt.startsWith('و')) {
      const sub = normTok(nt.slice(1));
      if (sub && !RSTOP_SET.has(sub)) expandedToks.push(sub);
    }
  });

  fl.forEach((f, j) => {
    const fNorm = rn(f[0]);
    const fToks = ntk(f[0]).filter((t) => !RSTOP_SET.has(t));
    if (!fToks.length) return;

    // Direct full phrase match
    if (fNorm.length >= 2 && normRaw && (normRaw.includes(fNorm) || normRaw.includes(fToks.join(' ')))) {
      matchedIndices.add(j);
      const entry = { j, name: f[0], score: 10 + fToks.length * 0.5, fToks };
      if (f[1]) soldOut.push(entry);
      else avail.push(entry);
      return;
    }

    let score = 0;
    let exactHits = 0;
    expandedToks.forEach((qt) => {
      const s = tokSim(qt, fToks);
      if (s > 0) {
        score += s;
        if (s === 1) exactHits++;
      }
    });
    if (exactHits >= fToks.length || (score >= 0.85 && fToks.length === 1) || score >= fToks.length * 0.8) {
      matchedIndices.add(j);
      const entry = { j, name: f[0], score, fToks };
      if (f[1]) soldOut.push(entry);
      else avail.push(entry);
    }
  });

  // Dedupe sub-flavors wholly subsumed by a matched multi-word flavor (e.g., "ملح وخل" covers "ملح" / "خل")
  const dedupeSubsumed = (list) => {
    const multiPhraseToks = new Set();
    list.forEach((item) => {
      if (item.score >= 10 && item.fToks && item.fToks.length > 1) {
        item.fToks.forEach((ft) => multiPhraseToks.add(ft));
      }
    });
    if (!multiPhraseToks.size) return list.map(({ j, name, score }) => ({ j, name, score }));
    return list
      .filter((item) => {
        if (item.score >= 10 && item.fToks && item.fToks.length > 1) return true;
        return !item.fToks || !item.fToks.every((ft) => multiPhraseToks.has(ft));
      })
      .map(({ j, name, score }) => ({ j, name, score }));
  };

  avail.sort((a, b) => b.score - a.score);
  soldOut.sort((a, b) => b.score - a.score);
  return { avail: dedupeSubsumed(avail), soldOut: dedupeSubsumed(soldOut), matchedIndices };
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
    const fl = getProductFlavors(p);
    const flAllToks = new Set();
    fl.forEach((f) => ntk(f[0]).forEach((ft) => flAllToks.add(ft)));

    let baseExactHits = 0;
    let baseFuzzyScore = 0;
    let varExactHits = 0;
    let catScore = 0;
    let unmatchedNonFlavorTokens = [];

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
        if (cSim > 0) {
          catScore += cSim * 0.35;
        } else if (!flAllToks.has(qt)) {
          // Check if qt is close to a flavor
          let flSim = 0;
          flAllToks.forEach((ft) => {
            flSim = Math.max(flSim, tokSim(qt, [ft]));
          });
          if (flSim < 0.85) unmatchedNonFlavorTokens.push(qt);
        }
      }
    });

    // Flavor score
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

// Detect unknown flavor tokens explicitly requested when a known product matched
function detectUnmatchedFlavorTokens(product, queryTokens, matchedFlavorsResult) {
  const fl = getProductFlavors(product);
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
    // Also check prefix/fuzzy against product name so minor typo doesn't look like flavor
    if (tokSim(qt, Array.from(nameAndVar)) >= 0.8) return;
    extra.push(qt);
  });
  return extra;
}

export function computeDraftTotals(RL, products) {
  let totalQty = 0;
  let totalPrice = 0;
  const lines = [];
  for (const l of RL || []) {
    const p = products[l.i];
    if (!p) continue;
    const fl = getProductFlavors(p);
    const fName = l.f >= 0 && fl[l.f] ? fl[l.f][0] : '';
    const unitPrice = Number(p[3] || 0);
    const sub = l.q * unitPrice;
    totalQty += l.q;
    totalPrice += sub;
    lines.push({
      i: l.i,
      pid: l.pid || getProductStableKey(p, l.i),
      name: getProductDisplayName(p),
      f: l.f,
      flavorName: fName,
      q: l.q,
      unitPrice,
      subtotal: sub,
      amb: Boolean(l.amb),
    });
  }
  return { totalQty, totalPrice, lines };
}

export function normalizeQtyValue(rawQ, fallback = 1) {
  const num = Number(rawQ);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(0.25, Math.min(99, Math.round(num * 100) / 100));
}

export function dedupeAndNormalizeDraft(RL, products) {
  const out = [];
  const map = new Map();
  for (const raw of RL || []) {
    const idx = Number(raw?.i);
    const p = products[idx];
    if (!p || isProductOutOfStock(p)) continue;
    const fl = getProductFlavors(p);
    let f = raw.f == null ? -1 : Number(raw.f);
    if (fl.length) {
      if (!(Number.isInteger(f) && f >= 0 && fl[f] && !fl[f][1])) f = -1;
    } else {
      f = -1;
    }
    const q = normalizeQtyValue(raw?.q, 1);
    const pid = getProductStableKey(p, idx);
    const key = `${idx}:${f}:${raw?.amb ? '1' : '0'}`;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.q = Math.min(99, Math.round((existing.q + q) * 100) / 100);
      if (Array.isArray(raw?.c)) {
        raw.c.forEach((cid) => {
          if (products[cid] && !isProductOutOfStock(products[cid]) && !existing.c.includes(cid)) {
            existing.c.push(cid);
          }
        });
      }
      if (raw?.needsQtyConfirm) existing.needsQtyConfirm = true;
    } else {
      const item = {
        i: idx,
        pid,
        f,
        q,
        c: Array.isArray(raw.c) && raw.c.length ? raw.c.filter((x) => products[x] && !isProductOutOfStock(products[x])) : [idx],
        amb: Boolean(raw.amb),
      };
      if (raw?.needsQtyConfirm) item.needsQtyConfirm = true;
      map.set(key, item);
      out.push(item);
    }
  }
  // Remove f === -1 placeholder if a specific flavor for the same non-ambiguous product already exists
  const hasSpecific = new Set(out.filter((x) => x.f >= 0 && !x.amb).map((x) => x.i));
  return out.filter((x) => !(x.f < 0 && !x.amb && hasSpecific.has(x.i)));
}

const HOLLOW_REPLY_RE =
  /^(?:تمام|حاضر|ماشي|اوكي|اوك|ok|yes|نعم|ايوه|طيب|حسنا|تحت امرك|حالا|علي راسي|اهلا|مرحبا)(?:\s+(?:يا\s+)?(?:فندم|باشا|استاذ|ريس|كبير))?$/i;

const FALSE_CART_CLAIM_RE =
  /(?:اضفت|ضفت(?:لك)?|اتضاف(?:وا)?|تمت?\s+الاضاف[هة]|موجود(?:ه|ين)?)\s+(?:لك\s+)?(?:في\s+|لـ?\s*|الى\s+)?(?:ال)?سله/;

export function hasFalseCartClaim(text) {
  return FALSE_CART_CLAIM_RE.test(rn(text));
}

function sanitizeCartClaimText(text) {
  return String(text || '')
    .replace(/(?:في\s+|لـ?\s*|إلى\s+)?السلة(?:\s+الفعلية)?/g, 'في مسودة الطلب')
    .replace(/للسله|في السله/g, 'في مسودة الطلب');
}

export function isHollowAiReply(text) {
  const cleaned = rn(text)
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return true;
  return HOLLOW_REPLY_RE.test(cleaned);
}

function fmtMoneyAr(n) {
  return `${Math.round(Number(n || 0) * 100) / 100} جنيه`;
}

function formatOrderSummaryReply(prefix, draft, kb) {
  const products = kb.products || [];
  const unit = kb.cfg?.unit || 'كرتونة';
  const minVal = Number(kb.cfg?.min || 0);
  const calc = computeDraftTotals(draft, products);
  const linesTxt = calc.lines.map(
    (l) =>
      `• ${l.q} ${unit} ${l.name}${l.flavorName ? ' · ' + l.flavorName : ''} — ${fmtMoneyAr(l.subtotal)}`
  );
  const parts = [];
  if (prefix) parts.push(prefix);
  if (calc.lines.length) {
    let sumTxt = `📝 ملخص الطلب الحالي (${calc.totalQty} ${unit}):\n${linesTxt.join('\n')}\n💰 الإجمالي: ${fmtMoneyAr(calc.totalPrice)}`;
    if (minVal > 0 && calc.totalPrice < minVal) {
      sumTxt += `\n⚠️ ملحوظة: الحد الأدنى للطلب ${fmtMoneyAr(minVal)} (باقي ${fmtMoneyAr(minVal - calc.totalPrice)})`;
    }
    parts.push(sumTxt);
    parts.push('تحب تعدّل الكمية أو تضيف صنف تاني، ولا نراجع ونضيف للسلة؟');
  }
  return parts.join('\n\n');
}

const DISCLAIMER_STOP_WORDS = new Set(
  'بس مش فاكر عارف متاكد ناسي نسيت اسم المنتج الصنف بالظبط بالضبط الاحجام الحجم النوع الانواع تقريبا او حاجه حاجة شبيهه شبيهة شبيه زي كده مثلا علي ما اتذكر لو سمحت'
    .split(' ')
    .map(normTok)
    .filter(Boolean)
);

function classifySegmentUncertainty(rawSg) {
  const n = rn(rawSg);
  const toks = ntk(rawSg).filter((t) => !RSTOP_SET.has(t));
  const leftover = toks.filter((t) => !DISCLAIMER_STOP_WORDS.has(t));
  const isSizeDisclaimer =
    !leftover.length && /(?:احجام|حجم|مقاس|نوع|انواع)/.test(n);
  const isNameDisclaimer =
    !leftover.length && /(?:مش\s*(?:فاكر|عارف|متاكد)|ناسي|نسيت)/.test(n);
  const hasInlineUncertainty =
    /(?:تقريبا|او\s*حاج[هة]|شبيه[هة]?|مش\s*(?:متاكد|عارف|فاكر)|احتمال|يمكن)/.test(n);
  return { isSizeDisclaimer, isNameDisclaimer, hasInlineUncertainty };
}

function buildClarificationPromptAndQuick(pc, products, unit = 'كرتونة') {
  if (!pc) return { reply: '', quick: [] };
  const qNote = pc.explicitQty ? ` (لـ ${pc.explicitQty} ${unit})` : '';
  if (pc.type === 'confirm_suggestion') {
    const cands = (pc.candidates || []).filter((idx) => products[idx]);
    return {
      reply:
        `مش متأكد من الاسم بالظبط${pc.query ? ` («${pc.query}»)` : ''}، هل تقصد حاجة من دول${qNote}؟\n` +
        cands.map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`).join('\n'),
      quick: cands.slice(0, 6).map((idx) => ({
        label: getProductDisplayName(products[idx]),
        val: getProductDisplayName(products[idx]),
      })),
    };
  }
  if (pc.type === 'disambiguate_product') {
    const cands = (pc.candidates || []).filter((idx) => products[idx]);
    return {
      reply:
        `لقيت أكتر من نوع مطابق${pc.query ? ` لـ «${pc.query}»` : ''}${qNote}، قصدك أنهي واحد؟\n` +
        cands.map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`).join('\n'),
      quick: cands.slice(0, 6).map((idx) => ({
        label: getProductDisplayName(products[idx]),
        val: getProductDisplayName(products[idx]),
      })),
    };
  }
  if (pc.type === 'flavor') {
    const p = products[pc.prodIdx];
    if (!p) return { reply: '', quick: [] };
    const avFl = getProductFlavors(p).filter((f) => !f[1]);
    return {
      reply: `تحب أنهي نكهة في ${getProductDisplayName(p)}${qNote}؟\nالنكهات المتاحة: ${avFl.map((f) => f[0]).join('، ')}`,
      quick: avFl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
    };
  }
  if (pc.type === 'qty') {
    const p = products[pc.prodIdx];
    if (!p) return { reply: '', quick: [] };
    const fl = getProductFlavors(p);
    const fLabels = Array.isArray(pc.flavorIndices) && pc.flavorIndices.length
      ? pc.flavorIndices.map((idx) => fl[idx]?.[0]).filter(Boolean).join(' و')
      : pc.flavorIdx >= 0 && fl[pc.flavorIdx]
      ? fl[pc.flavorIdx][0]
      : '';
    return {
      reply: `تمام (${getProductDisplayName(p)}${fLabels ? ' · ' + fLabels : ''}) 👍 عايز كام ${unit}؟`,
      quick: [
        { label: `١ ${unit}`, val: '1' },
        { label: `٢ ${unit}`, val: '2' },
        { label: `٥ ${unit}`, val: '5' },
      ],
    };
  }
  return { reply: '', quick: [] };
}

function advancePendingQueueOrSummary(headerMsg, nextDraft, nextState, kb, products, unit) {
  const queue = Array.isArray(nextState.pendingQueue) ? nextState.pendingQueue : [];
  while (queue.length > 0) {
    let nextTask = queue.shift();
    if (
      nextTask &&
      nextTask.variantRef &&
      nextState.lastResolvedVariant &&
      Array.isArray(nextTask.candidates)
    ) {
      const varNorm = rn(nextState.lastResolvedVariant);
      const narrowed = nextTask.candidates.filter((idx) =>
        rn(products[idx]?.[10] || '').includes(varNorm) || varNorm.includes(rn(products[idx]?.[10] || ''))
      );
      if (narrowed.length === 1) {
        const chosenIdx = narrowed[0];
        const p = products[chosenIdx];
        const fl = getProductFlavors(p).filter((f) => !f[1]);
        if (fl.length) {
          nextTask = { type: 'flavor', prodIdx: chosenIdx, explicitQty: nextTask.explicitQty || null };
        } else if (!nextTask.explicitQty) {
          nextTask = { type: 'qty', prodIdx: chosenIdx, flavorIdx: -1 };
        }
      } else if (narrowed.length > 1) {
        nextTask = { ...nextTask, candidates: narrowed };
      }
    }
    if (nextTask) {
      nextState.pendingClarification = nextTask;
      nextState.pendingQueue = queue;
      const ask = buildClarificationPromptAndQuick(nextTask, products, unit);
      return {
        reply: `${headerMsg}\n\n${ask.reply}`,
        draft: nextDraft,
        nextState,
        go: false,
        quick: ask.quick,
      };
    }
  }
  nextState.pendingClarification = null;
  nextState.pendingQueue = [];
  return {
    reply: formatOrderSummaryReply(headerMsg, nextDraft, kb),
    draft: nextDraft,
    nextState,
    go: false,
    quick: [
      { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
      { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
    ],
  };
}

export function analyzeOrderSegments(text, catalogData = {}, options = {}) {
  const kb = buildStoreKB(catalogData);
  const products = kb.products;
  const unit = options.unit || kb.cfg.unit || 'كرتونة';
  const segs = segmentOrderText(text, products);

  const resolvedItems = [];
  const resolvedMsgs = [];
  const pendingTasks = [];
  const unknownItems = [];
  const warnings = [];
  let prevProdIdx = Number.isInteger(options.prevProdIdx) ? options.prevProdIdx : -1;
  let lastRefFlavorIdx = -1;
  const carriedQty = options.carriedQty || null;
  let hasSizeUncertainty = false;

  const pushOrMergeTask = (task) => {
    const candKey = (task.candidates || []).slice().sort((a, b) => a - b).join(',');
    const existing = pendingTasks.find((t) => {
      if (t.type !== task.type) return false;
      if (t.type === 'disambiguate_product') {
        return (t.candidates || []).slice().sort((a, b) => a - b).join(',') === candKey &&
          Boolean(t.variantRef) === Boolean(task.variantRef);
      }
      if (t.type === 'flavor') return t.prodIdx === task.prodIdx;
      return false;
    });
    if (existing && task.explicitQty && existing.explicitQty) {
      existing.explicitQty = Math.min(99, Math.round((existing.explicitQty + task.explicitQty) * 100) / 100);
      return;
    }
    if (existing && task.explicitQty && !existing.explicitQty) {
      existing.explicitQty = task.explicitQty;
      return;
    }
    pendingTasks.push(task);
  };

  for (const rawSg of segs) {
    const disc = classifySegmentUncertainty(rawSg);
    if (disc.isSizeDisclaimer || disc.isNameDisclaimer) {
      if (disc.isSizeDisclaimer) hasSizeUncertainty = true;
      continue;
    }

    const variantRef = /(?:نفس\s+(?:ال)?(?:حجم|نوع|السعر|الشكل|المقاس))/.test(rn(rawSg));
    const cleanedRef = variantRef
      ? rawSg.replace(/نفس\s+(?:ال)?(?:حجم|نوع|السعر|الشكل|المقاس)/g, ' ').trim()
      : rawSg;

    const { clean, hints } = extractHints(cleanedRef);
    const qp = parseQuantityAndRest(clean || cleanedRef, unit);

    if (qp.unitMismatch) {
      warnings.push(
        `وحدة البيع في المتجر هي «${qp.unitMismatch.storeUnit}» مش ${qp.unitMismatch.requestedUnit}. تحب تطلب كام ${qp.unitMismatch.storeUnit}؟`
      );
      continue;
    }

    const nonStopTokens = qp.rest.filter((t) => !RSTOP_SET.has(t) && !DISCLAIMER_STOP_WORDS.has(t));
    if (!nonStopTokens.length && (qp.explicitQty || qp.hasSingularUnit) && prevProdIdx >= 0 && products[prevProdIdx]) {
      const targetQ = qp.explicitQty ? qp.qty : 1;
      resolvedItems.push({ i: prevProdIdx, f: lastRefFlavorIdx, q: targetQ, qtyOnlyRef: true });
      continue;
    }
    if (!nonStopTokens.length && !qp.distributive) {
      continue;
    }

    const searchTokens = disc.hasInlineUncertainty
      ? qp.rest.filter((t) => !DISCLAIMER_STOP_WORDS.has(t))
      : qp.rest;
    const searchCleanText = disc.hasInlineUncertainty
      ? searchTokens.join(' ')
      : clean || cleanedRef;

    const m = matchProductsInCatalog(searchTokens, products, {
      priceHints: hints,
      includeSoldOut: false,
      rawCleanText: searchCleanText,
    });

    // Check if segment has NO distinct product name of its own, only flavor(s) of previous segment's product
    if (!variantRef && !disc.hasInlineUncertainty && prevProdIdx >= 0 && products[prevProdIdx] && !isProductOutOfStock(products[prevProdIdx])) {
      const prevP = products[prevProdIdx];
      const fmPrev = matchProductFlavors(prevP, qp.rest, clean || cleanedRef);
      const unmatchedPrev = detectUnmatchedFlavorTokens(prevP, qp.rest, fmPrev);
      const prevMatchedToks = new Set();
      [...fmPrev.avail, ...fmPrev.soldOut].forEach((x) => ntk(x.name).forEach((t) => prevMatchedToks.add(t)));
      const nonPrevFlavToks = nonStopTokens.filter(
        (t) => !FLAVOR_MODIFIER_WORDS.has(t) && !prevMatchedToks.has(t) && tokSim(t, Array.from(prevMatchedToks)) < 0.85
      );
      const topOther = m && m.cs[0];
      const topIsOtherExactName = Boolean(topOther && topOther.i !== prevProdIdx && (topOther.exactBase || topOther.exactFull));
      const purePrevFlavorSegment =
        (fmPrev.avail.length > 0 || fmPrev.soldOut.length > 0) &&
        !unmatchedPrev.length &&
        nonPrevFlavToks.length === 0 &&
        !topIsOtherExactName;

      if (!m || m.cs[0].flavorOnlyMatch || purePrevFlavorSegment) {
        if (fmPrev.avail.length) {
          if (!qp.explicitQty && !qp.hasSingularUnit) {
            pushOrMergeTask({
              type: 'qty',
              prodIdx: prevProdIdx,
              flavorIdx: fmPrev.avail[0].j,
              flavorIndices: fmPrev.avail.length > 1 ? fmPrev.avail.map((f) => f.j) : undefined,
              query: rawSg,
            });
          } else {
            const useQ = qp.explicitQty ? qp.qty : 1;
            fmPrev.avail.forEach((af) => {
              resolvedItems.push({ i: prevProdIdx, pid: getProductStableKey(prevP, prevProdIdx), f: af.j, q: useQ, c: [prevProdIdx], amb: false });
              resolvedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(prevP)} · ${af.name}`);
            });
            lastRefFlavorIdx = fmPrev.avail[fmPrev.avail.length - 1].j;
          }
          continue;
        }
        if (fmPrev.soldOut.length) {
          warnings.push(`نكهة «${fmPrev.soldOut[0].name}» خلصانة في ${getProductDisplayName(prevP)}.`);
          continue;
        }
      }
    }

    const matchedCatName = Object.keys(kb.cats).find((c) => {
      const cToks = ntk(c).filter((t) => !RSTOP_SET.has(t));
      return (
        cToks.length > 0 &&
        nonStopTokens.length === cToks.length &&
        cToks.every((ct, idx) => ct === nonStopTokens[idx])
      );
    });

    if (!m) {
      if (matchedCatName && kb.cats[matchedCatName].length) {
        const catItems = kb.cats[matchedCatName];
        if (catItems.length === 1) {
          const rec = catItems[0];
          const fl = getProductFlavors(rec.p).filter((f) => !f[1]);
          prevProdIdx = rec.idx;
          lastRefFlavorIdx = -1;
          const effQ = qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null;
          if (fl.length) {
            pushOrMergeTask({
              type: 'flavor',
              prodIdx: rec.idx,
              explicitQty: effQ,
              query: rawSg,
              variantRef,
            });
            continue;
          }
          if (!effQ) {
            pushOrMergeTask({ type: 'qty', prodIdx: rec.idx, flavorIdx: -1, query: rawSg, variantRef });
            continue;
          }
          resolvedItems.push({ i: rec.idx, pid: rec.pid, f: -1, q: effQ, c: [rec.idx], amb: false });
          resolvedMsgs.push(`${effQ} ${unit} ${rec.name}`);
          continue;
        } else {
          const candIds = catItems.slice(0, 6).map((x) => x.idx);
          pushOrMergeTask({
            type: 'disambiguate_product',
            candidates: candIds,
            explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
            query: rawSg,
            variantRef,
          });
          continue;
        }
      }

      const mOut = matchProductsInCatalog(qp.rest, products, {
        priceHints: hints,
        includeSoldOut: true,
        rawCleanText: clean || cleanedRef,
      });
      if (mOut && mOut.cs[0] && mOut.cs[0].out && !mOut.cs[0].isFuzzyOnly) {
        warnings.push(`«${getProductDisplayName(products[mOut.cs[0].i])}» غير متوفر حالياً (خلصان).`);
      } else if (qp.distributive === 'types') {
        const catName = Object.keys(kb.cats).find((c) => rn(clean || cleanedRef).includes(rn(c)));
        if (catName && kb.cats[catName].length) {
          const useQ = qp.explicitQty ? qp.qty : 1;
          kb.cats[catName].forEach((rec) => {
            const hasFl = getProductFlavors(rec.p).some((f) => !f[1]);
            if (!hasFl) {
              resolvedItems.push({ i: rec.idx, pid: rec.pid, f: -1, q: useQ, c: [rec.idx], amb: false });
              resolvedMsgs.push(`${useQ} ${unit} ${rec.name}`);
            }
          });
        } else {
          unknownItems.push({ rawSg, query: nonStopTokens.join(' ') || rawSg, qty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null });
          warnings.push(`ما قدرتش أحدد نوع أو قسم معين لـ «${rawSg}».`);
        }
      } else {
        const cleanedQuery = nonStopTokens.join(' ') || rawSg;
        unknownItems.push({ rawSg, query: cleanedQuery, qty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null });
        warnings.push(`لم أجد صنفاً مطابقاً لـ «${cleanedQuery}» في الكتالوج.`);
      }
      continue;
    }

    const top = m.cs[0];

    // CRITICAL: NEVER silently auto-select a fuzzy-only match or an explicitly uncertain query!
    if (top.isFuzzyOnly || disc.hasInlineUncertainty) {
      const sugList = m.cs.slice(0, 3).map((c) => c.i);
      const searchNonStop = searchTokens.filter((t) => !RSTOP_SET.has(t));
      const cleanedQuery = searchNonStop.join(' ') || nonStopTokens.join(' ') || rawSg;
      unknownItems.push({
        rawSg,
        query: cleanedQuery,
        qty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
        suggestions: sugList,
        uncertain: true,
      });
      pushOrMergeTask({
        type: 'confirm_suggestion',
        candidates: sugList,
        explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
        query: cleanedQuery,
      });
      continue;
    }

    const strongComp = m.cs.filter((c) => !c.isFuzzyOnly && !c.flavorOnlyMatch);
    const exactBaseName = rn(products[top.i][0]);
    const sameBaseAlts = strongComp.filter((c) => rn(products[c.i][0]) === exactBaseName);

    if (qp.distributive === 'types') {
      const family = sameBaseAlts.length > 1 ? sameBaseAlts : strongComp.filter((c) => c.s >= top.s * 0.75);
      const useQ = qp.explicitQty ? qp.qty : 1;
      family.forEach((c) => {
        resolvedItems.push({ i: c.i, pid: getProductStableKey(products[c.i], c.i), f: -1, q: useQ, c: [c.i], amb: false });
        resolvedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(products[c.i])}`);
      });
      prevProdIdx = top.i;
      lastRefFlavorIdx = -1;
      continue;
    }

    const multiNameMatches = strongComp.filter((c) => c.baseExactHits > 0);
    const isAmbiguous =
      !hints.length &&
      ((strongComp.length > 1 &&
        !top.exactFull &&
        (strongComp[1].s >= top.s * 0.92 ||
          (sameBaseAlts.length > 1 && sameBaseAlts[1].s >= top.s * 0.88))) ||
        (nonStopTokens.length === 1 &&
          (multiNameMatches.length > 1 || (matchedCatName && kb.cats[matchedCatName].length > 1))));

    if (isAmbiguous) {
      const catExtra =
        matchedCatName && kb.cats[matchedCatName]
          ? kb.cats[matchedCatName].map((x) => x.idx)
          : [];
      const candIds = Array.from(
        new Set([...strongComp.map((c) => c.i), ...catExtra])
      ).slice(0, 6);
      pushOrMergeTask({
        type: 'disambiguate_product',
        candidates: candIds,
        explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
        query: nonStopTokens.join(' ') || rawSg,
        variantRef,
      });
      continue;
    }

    const p = products[top.i];
    const fl = getProductFlavors(p);
    const avFl = fl.filter((f) => !f[1]);
    prevProdIdx = top.i;
    lastRefFlavorIdx = -1;
    const effQty = qp.explicitQty
      ? qp.qty
      : qp.hasSingularUnit
      ? 1
      : segs.length === 1 && carriedQty
      ? carriedQty
      : null;

    if (qp.distributive === 'flavors') {
      const useQ = effQty || 1;
      if (!avFl.length) {
        resolvedItems.push({ i: top.i, pid: getProductStableKey(p, top.i), f: -1, q: useQ, c: [top.i], amb: false });
        resolvedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)}`);
      } else {
        avFl.forEach((f) => {
          const fIdx = fl.indexOf(f);
          resolvedItems.push({ i: top.i, pid: getProductStableKey(p, top.i), f: fIdx, q: useQ, c: [top.i], amb: false });
          resolvedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)} · ${f[0]}`);
        });
      }
      continue;
    }

    if (fl.length) {
      if (/(?:اي\s+نكهه|اي\s+طعم|مش\s+فارق|مش\s+فارقه|مش\s+هتفرق)/.test(rn(rawSg))) {
        pushOrMergeTask({
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
          query: getProductDisplayName(p),
          variantRef,
        });
        continue;
      }

      const fm = matchProductFlavors(p, qp.rest, clean || cleanedRef);
      const extraUnknownFlavorToks = detectUnmatchedFlavorTokens(p, qp.rest, fm);

      if (!fm.avail.length && fm.soldOut.length) {
        warnings.push(
          `نكهة «${fm.soldOut[0].name}» خلصانة حالياً في ${getProductDisplayName(p)}. النكهات المتاحة: ${avFl.map((f) => f[0]).join('، ')}`
        );
        pushOrMergeTask({
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
          query: getProductDisplayName(p),
          variantRef,
        });
        continue;
      }

      if (extraUnknownFlavorToks.length && !fm.avail.length) {
        warnings.push(
          `نكهة «${extraUnknownFlavorToks.join(' ')}» غير متاحة في ${getProductDisplayName(p)}. النكهات المتاحة هي: ${avFl.map((f) => f[0]).join('، ')}`
        );
        pushOrMergeTask({
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
          query: getProductDisplayName(p),
          variantRef,
        });
        continue;
      }

      if (!fm.avail.length) {
        pushOrMergeTask({
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
          query: getProductDisplayName(p),
          variantRef,
        });
        continue;
      }

      const bestF = fm.avail[0];
      if (!effQty) {
        pushOrMergeTask({
          type: 'qty',
          prodIdx: top.i,
          flavorIdx: bestF.j,
          flavorIndices: fm.avail.length > 1 ? fm.avail.map((f) => f.j) : undefined,
          query: getProductDisplayName(p),
          variantRef,
        });
        lastRefFlavorIdx = bestF.j;
        continue;
      }

      fm.avail.forEach((af) => {
        resolvedItems.push({ i: top.i, pid: getProductStableKey(p, top.i), f: af.j, q: effQty, c: [top.i], amb: false });
        resolvedMsgs.push(`${effQty} ${unit} ${getProductDisplayName(p)} · ${af.name}`);
      });
      lastRefFlavorIdx = fm.avail[fm.avail.length - 1].j;
    } else {
      if (!effQty) {
        pushOrMergeTask({
          type: 'qty',
          prodIdx: top.i,
          flavorIdx: -1,
          query: getProductDisplayName(p),
          variantRef,
        });
        continue;
      }
      resolvedItems.push({ i: top.i, pid: getProductStableKey(p, top.i), f: -1, q: effQty, c: [top.i], amb: false });
      resolvedMsgs.push(`${effQty} ${unit} ${getProductDisplayName(p)}`);
    }
  }

  return {
    segs,
    resolvedItems,
    resolvedMsgs,
    pendingTasks,
    unknownItems,
    warnings,
    hasSizeUncertainty,
    prevProdIdx,
    lastRefFlavorIdx,
  };
}

export function buildOneShotCustomerDraft({ text, catalogData = {} }) {
  const kb = buildStoreKB(catalogData);
  const products = kb.products;
  const analysis = analyzeOrderSegments(text, catalogData, { unit: kb.cfg.unit || 'كرتونة' });
  const rawItems = [];

  analysis.resolvedItems.forEach((it) => {
    if (!it.qtyOnlyRef) rawItems.push({ i: it.i, f: it.f, q: it.q, c: it.c || [it.i], amb: false });
  });

  analysis.pendingTasks.forEach((task) => {
    if (task.type === 'disambiguate_product' && Array.isArray(task.candidates) && task.candidates.length) {
      rawItems.push({
        i: task.candidates[0],
        f: -1,
        q: task.explicitQty || 1,
        c: task.candidates.slice(0, 6),
        amb: task.candidates.length > 1,
      });
    } else if (task.type === 'flavor') {
      rawItems.push({
        i: task.prodIdx,
        f: -1,
        q: task.explicitQty || 1,
        c: [task.prodIdx],
        amb: false,
      });
    } else if (task.type === 'qty') {
      const fIds = Array.isArray(task.flavorIndices) && task.flavorIndices.length
        ? task.flavorIndices
        : [task.flavorIdx >= 0 ? task.flavorIdx : -1];
      fIds.forEach((fIdx) => {
        rawItems.push({
          i: task.prodIdx,
          f: fIdx,
          q: 1,
          c: [task.prodIdx],
          amb: false,
          needsQtyConfirm: true,
        });
      });
    }
  });

  const unk = analysis.unknownItems.map((u) => {
    if (u.suggestions && u.suggestions.length) {
      const sugNames = u.suggestions.map((idx) => getProductDisplayName(products[idx])).join(' / ');
      return `${u.query} (هل تقصد: ${sugNames}؟)`;
    }
    return u.query || u.rawSg;
  });

  return {
    items: dedupeAndNormalizeDraft(rawItems, products),
    unk,
    soldOutHits: analysis.warnings.filter((w) => /خلصان/.test(w)),
    warnings: analysis.warnings,
    analysis,
  };
}

// Validate a Gemini JSON customer response against authoritative catalog & draft!
export function validateCustomerGeminiResponse({
  geminiJson,
  userMessage,
  currentDraft = [],
  catalogData = {},
  stateCtx = {},
}) {
  const kb = buildStoreKB(catalogData);
  const products = kb.products;
  const unit = kb.cfg.unit || 'كرتونة';
  const parsed = typeof geminiJson === 'string' ? JSON.parse(geminiJson) : geminiJson || {};
  const intent = String(parsed.intent || '').trim().toLowerCase();

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const verifiedItems = [];
  const rejectedReasons = [];
  const disambiguations = [];
  const missingFlavors = [];

  for (const x of rawItems) {
    let idx = Number(x?.i);
    if ((!Number.isInteger(idx) || !products[idx]) && x?.name) {
      const m = matchProductsInCatalog(ntk(x.name + ' ' + (x.variant || '')), products, {
        includeSoldOut: true,
        rawCleanText: x.name + ' ' + (x.variant || ''),
      });
      if (m && m.cs[0] && !m.cs[0].isFuzzyOnly) {
        idx = m.cs[0].i;
      }
    }
    const p = products[idx];
    if (!p) {
      rejectedReasons.push(
        x?.name ? `«${x.name}» غير موجود في الكتالوج` : `الصنف رقم ${idx} غير موجود في الكتالوج`
      );
      continue;
    }
    if (isProductOutOfStock(p)) {
      rejectedReasons.push(`«${getProductDisplayName(p)}» غير متوفر حالياً`);
      continue;
    }

    const alt = Array.isArray(x.alt)
      ? x.alt.map(Number).filter((a) => products[a] && !isProductOutOfStock(products[a]))
      : [];
    const uniqueAlt = Array.from(new Set([idx, ...alt])).slice(0, 6);
    const amb = Boolean(x.a === true && uniqueAlt.length > 1);
    if (amb) {
      // Never add ambiguous product to draft before customer confirms
      disambiguations.push({ i: idx, alt: uniqueAlt });
      continue;
    }

    const fl = getProductFlavors(p);
    const availFl = fl.filter((ff) => !ff[1]);
    let f = x.f == null ? -1 : Number(x.f);
    if (fl.length) {
      if (!(Number.isInteger(f) && f >= 0 && fl[f] && !fl[f][1])) {
        if (Number.isInteger(f) && f >= 0 && fl[f] && fl[f][1]) {
          rejectedReasons.push(`نكهة «${fl[f][0]}» خلصانة في ${getProductDisplayName(p)}`);
          continue;
        }
        if (x.flavorName) {
          const fm = matchProductFlavors(p, ntk(x.flavorName), x.flavorName);
          if (fm.avail.length) {
            f = fm.avail[0].j;
          } else if (fm.soldOut.length) {
            rejectedReasons.push(`نكهة «${x.flavorName}» خلصانة في ${getProductDisplayName(p)}`);
            continue;
          } else {
            rejectedReasons.push(
              `نكهة «${x.flavorName}» غير متاحة في ${getProductDisplayName(p)}. المتاح: ${availFl
                .map((ff) => ff[0])
                .join('، ')}`
            );
            continue;
          }
        } else {
          f = -1;
        }
      }
    } else {
      f = -1;
    }

    const q = normalizeQtyValue(x?.q, 1);
    if (availFl.length > 0 && f < 0) {
      // Never add flavored product without a selected flavor
      missingFlavors.push({ i: idx, q });
      continue;
    }

    verifiedItems.push({
      i: idx,
      pid: getProductStableKey(p, idx),
      f,
      q,
      c: [idx, ...alt.filter((a) => a !== idx)].slice(0, 5),
      amb: false,
    });
  }

  const missingQty = [];
  const msgStr = String(userMessage || '').trim();
  const clearAsked = parsed.clear === true || intent === 'clear';
  const msgSegs = msgStr ? segmentOrderText(msgStr, products) : [];
  const msgQp = msgStr ? parseQuantityAndRest(msgStr, unit) : null;
  const msgHasQtyOrUnit = Boolean(
    msgQp && (msgQp.explicitQty || msgQp.hasSingularUnit || msgQp.distributive)
  );
  const prevPcQty =
    stateCtx?.pendingClarification?.explicitQty && Number(stateCtx.pendingClarification.explicitQty) > 0
      ? Number(stateCtx.pendingClarification.explicitQty)
      : null;

  // Guard 1: If userMessage is a single-segment ambiguous/category request (e.g. "عايز كرتونة شيبسي")
  // without pending disambiguation, never let Gemini silently guess one variant with a:false
  if (
    msgStr &&
    msgSegs.length === 1 &&
    verifiedItems.length === 1 &&
    !disambiguations.length &&
    !stateCtx?.pendingClarification &&
    !currentDraft.some((d) => d.i === verifiedItems[0].i)
  ) {
    const { clean, hints } = extractHints(msgStr);
    const qpCheck = parseQuantityAndRest(clean || msgStr, unit);
    const nonStopCheck = qpCheck.rest.filter((t) => !RSTOP_SET.has(t));
    if (!hints.length && nonStopCheck.length) {
      const mCheck = matchProductsInCatalog(qpCheck.rest, products, {
        priceHints: hints,
        includeSoldOut: false,
        rawCleanText: clean || msgStr,
      });
      const matchedCatName = Object.keys(kb.cats).find((c) => {
        const cToks = ntk(c).filter((t) => !RSTOP_SET.has(t));
        return nonStopCheck.length === 1 && cToks.length === 1 && cToks[0] === nonStopCheck[0];
      });
      const strongComp = mCheck ? mCheck.cs.filter((c) => !c.isFuzzyOnly && !c.flavorOnlyMatch) : [];
      const pickedIdx = verifiedItems[0].i;
      const top = strongComp[0];
      const multiNameMatches = strongComp.filter((c) => c.baseExactHits > 0);
      const exactBaseName = top ? rn(products[top.i][0]) : '';
      const sameBaseAlts = strongComp.filter((c) => rn(products[c.i][0]) === exactBaseName);
      const isAmbig =
        (strongComp.length > 1 &&
          top &&
          !top.exactFull &&
          (strongComp[1].s >= top.s * 0.92 ||
            (sameBaseAlts.length > 1 && sameBaseAlts[1].s >= top.s * 0.88))) ||
        (nonStopCheck.length === 1 &&
          (multiNameMatches.length > 1 || (matchedCatName && kb.cats[matchedCatName].length > 1)));

      if (isAmbig) {
        const catExtra =
          matchedCatName && kb.cats[matchedCatName]
            ? kb.cats[matchedCatName].map((x) => x.idx)
            : [];
        const candIds = Array.from(
          new Set([pickedIdx, ...strongComp.map((c) => c.i), ...catExtra])
        ).slice(0, 6);
        if (candIds.length > 1) {
          verifiedItems.shift();
          disambiguations.push({ i: pickedIdx, alt: candIds });
        }
      }
    }
  }

  // Preserve explicitQty / fractional qty during follow-up clarification turns
  if (stateCtx?.pendingClarification) {
    const pc = stateCtx.pendingClarification;
    if (pc.type === 'qty' && msgQp && (msgQp.explicitQty || msgQp.hasSingularUnit) && verifiedItems.length === 1) {
      verifiedItems[0].q = msgQp.explicitQty ? msgQp.qty : 1;
    } else if (
      prevPcQty &&
      !msgHasQtyOrUnit &&
      verifiedItems.length === 1 &&
      (verifiedItems[0].i === pc.prodIdx || (Array.isArray(pc.candidates) && pc.candidates.includes(verifiedItems[0].i)))
    ) {
      verifiedItems[0].q = prevPcQty;
    }
    if (prevPcQty && !msgHasQtyOrUnit && missingFlavors.length === 1) {
      missingFlavors[0].q = prevPcQty;
      missingFlavors[0].explicitQty = prevPcQty;
    }
  }

  // Guard 2: Never prematurely add a brand-new item with default q=1 if user never stated a quantity/unit
  if (
    msgStr &&
    msgSegs.length <= 1 &&
    verifiedItems.length === 1 &&
    !disambiguations.length &&
    !missingFlavors.length &&
    !msgHasQtyOrUnit &&
    !prevPcQty &&
    intent !== 'remove' &&
    intent !== 'edit' &&
    intent !== 'clear' &&
    !currentDraft.some((d) => d.i === verifiedItems[0].i)
  ) {
    const item = verifiedItems.shift();
    missingQty.push(item);
  }

  // Guard 3: Programmatic multi-item & completeness/quantity/no-guess audit for order turns!
  let auditForcedReply = '';
  let auditForcedQuick = [];
  let auditQueuedTasks = [];
  const unknown = Array.isArray(parsed.unknown) ? parsed.unknown.map(String).filter(Boolean) : [];
  const nonOrderIntents = new Set(['inquiry', 'greeting', 'remove', 'edit', 'clear', 'confirm']);
  const looksLikeOrderMsg =
    Boolean(msgStr) &&
    !clearAsked &&
    !nonOrderIntents.has(intent) &&
    !stateCtx?.pendingClarification;

  if (looksLikeOrderMsg) {
    const det = analyzeOrderSegments(msgStr, catalogData, { unit });
    const detActionableCount =
      det.resolvedItems.length + det.pendingTasks.length + det.unknownItems.length;

    if (detActionableCount > 0 || det.warnings.length > 0) {
      let auditModified = false;

      // a) Remove any Gemini guess for an ambiguous deterministic segment
      const ambTasks = det.pendingTasks.filter((t) => t.type === 'disambiguate_product');
      for (const ambT of ambTasks) {
        const candSet = new Set(ambT.candidates || []);
        for (let k = verifiedItems.length - 1; k >= 0; k--) {
          if (candSet.has(verifiedItems[k].i)) {
            verifiedItems.splice(k, 1);
            auditModified = true;
          }
        }
        for (let k = missingFlavors.length - 1; k >= 0; k--) {
          if (candSet.has(missingFlavors[k].i)) {
            missingFlavors.splice(k, 1);
            auditModified = true;
          }
        }
        const alreadyDisambig = disambiguations.some((d) =>
          (d.alt || []).some((id) => candSet.has(id))
        );
        if (!alreadyDisambig) {
          disambiguations.push({
            i: ambT.candidates[0],
            alt: ambT.candidates,
            explicitQty: ambT.explicitQty || null,
            query: ambT.query || '',
            variantRef: Boolean(ambT.variantRef),
          });
          auditModified = true;
        }
      }

      // b) Reject Gemini lookalike/invented guesses on unknown or uncertain segments (Rule #3: no guessing!)
      const legitimateDetProductIds = new Set([
        ...det.resolvedItems.map((x) => x.i),
        ...det.pendingTasks
          .filter((t) => t.type !== 'confirm_suggestion' && t.prodIdx != null)
          .map((t) => t.prodIdx),
        ...det.pendingTasks
          .filter((t) => t.type !== 'confirm_suggestion' && Array.isArray(t.candidates))
          .flatMap((t) => t.candidates),
      ]);
      const prevDraftIds = new Set(currentDraft.map((d) => d.i));
      for (let k = verifiedItems.length - 1; k >= 0; k--) {
        const vi = verifiedItems[k];
        if (!legitimateDetProductIds.has(vi.i) && !prevDraftIds.has(vi.i)) {
          verifiedItems.splice(k, 1);
          auditModified = true;
        }
      }
      for (const unk of det.unknownItems) {
        const unkLabel = unk.query || unk.rawSg;
        if (unkLabel && !unknown.some((u) => rn(u).includes(rn(unkLabel)) || rn(unkLabel).includes(rn(u)))) {
          unknown.push(unkLabel);
          auditModified = true;
        }
      }

      // c) Reconcile exact quantities and recover any dropped resolved items
      const detMergedResolved = dedupeAndNormalizeDraft(
        det.resolvedItems.filter((x) => !x.qtyOnlyRef),
        products
      );
      for (const dr of detMergedResolved) {
        const existingMatches = verifiedItems.filter((v) => v.i === dr.i && (v.f === dr.f || dr.f < 0));
        if (!existingMatches.length) {
          verifiedItems.push(dr);
          auditModified = true;
        } else {
          // Ensure summed qty across matching verified entries equals authoritative deterministic qty
          const totalGemQ = existingMatches.reduce((acc, v) => acc + v.q, 0);
          if (Math.abs(totalGemQ - dr.q) > 0.01) {
            existingMatches[0].q = dr.q;
            for (let k = 1; k < existingMatches.length; k++) existingMatches[k].q = 0;
            auditModified = true;
          }
        }
      }
      // Drop any zeroed duplicate entries
      for (let k = verifiedItems.length - 1; k >= 0; k--) {
        if (verifiedItems[k].q <= 0) verifiedItems.splice(k, 1);
      }

      // d) Enforce missing-flavor & missing-qty tasks with exact quantities (strip guessed flavors when none specified)
      for (const task of det.pendingTasks) {
        if (task.type === 'flavor') {
          for (let k = verifiedItems.length - 1; k >= 0; k--) {
            if (verifiedItems[k].i === task.prodIdx && !currentDraft.some((d) => d.i === task.prodIdx && d.f >= 0)) {
              verifiedItems.splice(k, 1);
              auditModified = true;
            }
          }
          const existsMF = missingFlavors.find((m) => m.i === task.prodIdx);
          if (existsMF) {
            if (task.explicitQty && Math.abs((existsMF.q || 1) - task.explicitQty) > 0.01) {
              existsMF.q = task.explicitQty;
              existsMF.explicitQty = task.explicitQty;
              auditModified = true;
            }
          } else if (!verifiedItems.some((v) => v.i === task.prodIdx && v.f >= 0)) {
            missingFlavors.push({ i: task.prodIdx, q: task.explicitQty || 1, explicitQty: task.explicitQty || null });
            auditModified = true;
          }
        } else if (task.type === 'qty') {
          const existsMQ = missingQty.find((m) => m.i === task.prodIdx);
          if (!existsMQ) {
            for (let k = verifiedItems.length - 1; k >= 0; k--) {
              if (verifiedItems[k].i === task.prodIdx && !prevDraftIds.has(verifiedItems[k].i)) {
                verifiedItems.splice(k, 1);
              }
            }
            missingQty.push({
              i: task.prodIdx,
              f: task.flavorIdx >= 0 ? task.flavorIdx : -1,
              flavorIndices: task.flavorIndices,
            });
            auditModified = true;
          }
        } else if (task.type === 'confirm_suggestion') {
          auditQueuedTasks.push(task);
          auditModified = true;
        }
      }

      // e) Preserve deterministic warnings (e.g. sold out or unit mismatch)
      det.warnings.forEach((w) => {
        if (!rejectedReasons.includes(w) && !/لم أجد صنفاً/.test(w)) {
          rejectedReasons.push(w);
        }
      });

      // f) Collect full ordered queue from disambiguations + missingFlavors + missingQty + confirm_suggestion
      const assembledQueue = [];
      disambiguations.forEach((d) => {
        assembledQueue.push({
          type: 'disambiguate_product',
          candidates: d.alt,
          explicitQty: d.explicitQty || (msgSegs.length === 1 && msgHasQtyOrUnit ? msgQp.qty : null),
          query: d.query || '',
          variantRef: Boolean(d.variantRef),
        });
      });
      missingFlavors.forEach((mf) => {
        assembledQueue.push({
          type: 'flavor',
          prodIdx: mf.i,
          explicitQty: mf.explicitQty !== undefined ? mf.explicitQty : mf.q || null,
        });
      });
      missingQty.forEach((mq) => {
        assembledQueue.push({
          type: 'qty',
          prodIdx: mq.i,
          flavorIdx: mq.f >= 0 ? mq.f : -1,
          flavorIndices: mq.flavorIndices,
        });
      });
      auditQueuedTasks.forEach((t) => assembledQueue.push(t));

      if (auditModified || unknown.length > 0 || assembledQueue.length > 1) {
        auditQueuedTasks = assembledQueue;
        const confirmedPreviewDraft = verifiedItems.length
          ? dedupeAndNormalizeDraft([...currentDraft, ...verifiedItems], products)
          : currentDraft;
        const parts = [];
        if (verifiedItems.length) {
          const addedLines = dedupeAndNormalizeDraft(verifiedItems, products).map((it) => {
            const p = products[it.i];
            const fl = getProductFlavors(p);
            const fn = it.f >= 0 && fl[it.f] ? ` · ${fl[it.f][0]}` : '';
            return `${it.q} ${unit} ${getProductDisplayName(p)}${fn}`;
          });
          parts.push(`ضفتلك في مسودة الطلب ✅:\n${addedLines.join('\n')}`);
        }
        const suggestQueries = new Set(
          assembledQueue
            .filter((qt) => qt.type === 'confirm_suggestion' && qt.query)
            .map((qt) => rn(qt.query))
        );
        const displayUnknowns = unknown.filter((u) => !suggestQueries.has(rn(u)));
        if (displayUnknowns.length) {
          parts.push(`لم أجد في الكتالوج: «${displayUnknowns.join('»، «')}» — ممكن توضّح اسم الصنف المطلوب؟`);
        }
        if (rejectedReasons.length) {
          parts.push(rejectedReasons.join('\n'));
        }
        if (assembledQueue.length) {
          const askFirst = buildClarificationPromptAndQuick(assembledQueue[0], products, unit);
          parts.push(askFirst.reply);
          if (assembledQueue.length > 1) {
            const remLabels = assembledQueue
              .slice(1)
              .map((qt) => qt.query || (qt.prodIdx != null && products[qt.prodIdx] ? getProductDisplayName(products[qt.prodIdx]) : 'صنف آخر'));
            parts.push(`(وبعدها هنكمّل تحديد: ${remLabels.join('، ')})`);
          }
          auditForcedQuick = askFirst.quick;
        } else if (verifiedItems.length) {
          parts.push(formatOrderSummaryReply('', confirmedPreviewDraft, kb));
          auditForcedQuick = [
            { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
            { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
          ];
        }
        auditForcedReply = parts.filter(Boolean).join('\n\n');
      }
    }
  }

  let nextDraft = currentDraft.slice();
  if (clearAsked) {
    nextDraft = [];
  } else if (verifiedItems.length) {
    const isInquiry = intent === 'inquiry' || intent === 'greeting' || intent === 'clarify';
    if (isInquiry && !auditForcedReply) {
      nextDraft = currentDraft.slice();
    } else if (intent === 'remove') {
      nextDraft = dedupeAndNormalizeDraft(verifiedItems, products);
    } else if (intent === 'edit') {
      const editMap = new Map();
      verifiedItems.forEach((v) => {
        editMap.set(`${v.i}:${v.f}`, v);
      });
      const editedIds = new Set(verifiedItems.map((d) => d.i));
      const preserved = currentDraft.filter((d) => !editedIds.has(d.i));
      nextDraft = dedupeAndNormalizeDraft([...preserved, ...verifiedItems], products);
    } else {
      const newIds = new Set(verifiedItems.map((d) => d.i));
      const omitted = currentDraft.filter((d) => !newIds.has(d.i));
      if (omitted.length && !/(?:شيل|احذف|الغي|امسح|بدل|غير)/.test(rn(userMessage))) {
        nextDraft = dedupeAndNormalizeDraft([...currentDraft, ...verifiedItems], products);
      } else {
        nextDraft = dedupeAndNormalizeDraft(verifiedItems, products);
      }
    }
  } else if (rejectedReasons.length || unknown.length) {
    nextDraft = currentDraft.slice();
  }

  let nextState = {
    pendingClarification: stateCtx?.pendingClarification
      ? JSON.parse(JSON.stringify(stateCtx.pendingClarification))
      : null,
    pendingQueue: Array.isArray(stateCtx?.pendingQueue)
      ? JSON.parse(JSON.stringify(stateCtx.pendingQueue))
      : [],
    lastResolvedVariant: stateCtx?.lastResolvedVariant || '',
    lastReferencedProductIdx: Number.isInteger(stateCtx?.lastReferencedProductIdx)
      ? stateCtx.lastReferencedProductIdx
      : -1,
    lastReferencedFlavorIdx: Number.isInteger(stateCtx?.lastReferencedFlavorIdx)
      ? stateCtx.lastReferencedFlavorIdx
      : -1,
  };

  let queueAdvReply = '';
  let queueAdvQuick = [];
  if (clearAsked) {
    nextState = { pendingClarification: null, pendingQueue: [], lastResolvedVariant: '', lastReferencedProductIdx: -1, lastReferencedFlavorIdx: -1 };
  } else if (auditQueuedTasks.length) {
    nextState.pendingClarification = auditQueuedTasks[0];
    nextState.pendingQueue = auditQueuedTasks.slice(1);
  } else if (disambiguations.length) {
    const reqQty = disambiguations[0].explicitQty || (msgQp && msgQp.explicitQty ? msgQp.qty : msgQp && msgQp.hasSingularUnit ? 1 : null);
    nextState.pendingClarification = {
      type: 'disambiguate_product',
      candidates: disambiguations[0].alt,
      explicitQty: reqQty,
    };
  } else if (missingFlavors.length) {
    const keepQty =
      missingFlavors[0].explicitQty != null
        ? missingFlavors[0].explicitQty
        : msgQp && msgQp.explicitQty
        ? msgQp.qty
        : msgQp && msgQp.hasSingularUnit
        ? 1
        : stateCtx?.pendingClarification?.type === 'disambiguate_product' && prevPcQty
        ? prevPcQty
        : null;
    nextState.pendingClarification = {
      type: 'flavor',
      prodIdx: missingFlavors[0].i,
      explicitQty: keepQty,
    };
    const resolvedVar = String(products[missingFlavors[0].i]?.[10] || '').trim();
    if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
    nextState.lastReferencedProductIdx = missingFlavors[0].i;
    nextState.lastReferencedFlavorIdx = -1;
  } else if (missingQty.length) {
    nextState.pendingClarification = {
      type: 'qty',
      prodIdx: missingQty[0].i,
      flavorIdx: missingQty[0].f,
      flavorIndices: missingQty[0].flavorIndices,
    };
    const resolvedVar = String(products[missingQty[0].i]?.[10] || '').trim();
    if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
    nextState.lastReferencedProductIdx = missingQty[0].i;
    nextState.lastReferencedFlavorIdx = missingQty[0].f;
  } else if (verifiedItems.length && !clearAsked) {
    const lastV = verifiedItems[verifiedItems.length - 1];
    const resolvedVar = String(products[lastV.i]?.[10] || '').trim();
    if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
    nextState.lastReferencedProductIdx = lastV.i;
    nextState.lastReferencedFlavorIdx = lastV.f;
    if (nextState.pendingQueue.length > 0) {
      const addedHeader = verifiedItems
        .map((it) => {
          const p = products[it.i];
          const fl = getProductFlavors(p);
          const fn = it.f >= 0 && fl[it.f] ? ` · ${fl[it.f][0]}` : '';
          return `${it.q} ${unit} ${getProductDisplayName(p)}${fn}`;
        })
        .join('\n');
      const adv = advancePendingQueueOrSummary(`ضفتلك في مسودة الطلب ✅:\n${addedHeader}`, nextDraft, nextState, kb, products, unit);
      nextState = adv.nextState;
      queueAdvReply = adv.reply;
      queueAdvQuick = adv.quick;
    } else {
      nextState.pendingClarification = null;
    }
  }

  let reply = auditForcedReply || queueAdvReply || String(parsed.reply || '').trim();
  let quick = auditForcedQuick.length
    ? auditForcedQuick
    : queueAdvQuick.length
    ? queueAdvQuick
    : Array.isArray(parsed.quick)
    ? parsed.quick
        .filter((q) => q && q.label && q.val)
        .slice(0, 6)
        .map((q) => ({ label: String(q.label), val: String(q.val) }))
    : [];

  let action =
    parsed.action === 'review' &&
    nextDraft.length &&
    !disambiguations.length &&
    !missingFlavors.length &&
    !missingQty.length &&
    !auditQueuedTasks.length &&
    !nextState.pendingClarification &&
    !nextState.pendingQueue.length &&
    !unknown.length
      ? 'review'
      : 'none';

  const draftChanged = JSON.stringify(nextDraft) !== JSON.stringify(currentDraft);
  const hollow = isHollowAiReply(reply);
  const falseCartClaim = hasFalseCartClaim(reply);
  if (falseCartClaim && draftChanged) {
    reply = sanitizeCartClaimText(reply);
  }

  if (auditForcedReply) {
    // Keep auditForcedReply as authoritative complete message
  } else if (disambiguations.length) {
    const cands = disambiguations[0].alt;
    if (hollow || falseCartClaim || !/[؟?]/.test(reply)) {
      reply =
        `لقيت أكتر من نوع مطابق، تقصد أنهي واحد؟\n` +
        cands
          .map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`)
          .join('\n');
    }
    if (!quick.length) {
      quick = cands.slice(0, 6).map((idx) => ({
        label: getProductDisplayName(products[idx]),
        val: getProductDisplayName(products[idx]),
      }));
    }
  } else if (missingFlavors.length) {
    const pIdx = missingFlavors[0].i;
    const p = products[pIdx];
    const availFl = getProductFlavors(p).filter((ff) => !ff[1]);
    if (hollow || falseCartClaim || !/[؟?]/.test(reply)) {
      reply = `تحب أنهي نكهة في ${getProductDisplayName(p)}؟\nالنكهات المتاحة: ${availFl.map((ff) => ff[0]).join('، ')}`;
    }
    if (!quick.length) {
      quick = availFl.slice(0, 6).map((ff) => ({ label: ff[0], val: ff[0] }));
    }
  } else if (missingQty.length) {
    const mq = missingQty[0];
    const p = products[mq.i];
    const fl = getProductFlavors(p);
    const fLabel = mq.f >= 0 && fl[mq.f] ? ` · ${fl[mq.f][0]}` : '';
    if (hollow || falseCartClaim || !/[؟?]/.test(reply)) {
      reply = `تمام (${getProductDisplayName(p)}${fLabel}) 👍 عايز كام ${unit}؟`;
    }
    if (!quick.length) {
      quick = [
        { label: `١ ${unit}`, val: '1' },
        { label: `٢ ${unit}`, val: '2' },
        { label: `٥ ${unit}`, val: '5' },
      ];
    }
  } else if (rejectedReasons.length) {
    if (hollow || falseCartClaim) {
      reply = `${rejectedReasons.join('\n')}\nتحب تطلب إيه من الأصناف المتاحة؟`;
    } else {
      reply = `${reply}\n${rejectedReasons.join('\n')}`;
    }
  } else if (
    !draftChanged &&
    !clearAsked &&
    (hollow ||
      falseCartClaim ||
      unknown.length ||
      (!verifiedItems.length && intent !== 'inquiry' && intent !== 'greeting'))
  ) {
    // Gemini returned a hollow confirmation / false cart-add claim / failed to produce actionable items/clarification: consult deterministic engine
    const localTurn = processCustomerTurn({
      text: userMessage,
      catalogData,
      currentDraft,
      convState: stateCtx,
    });
    if (localTurn && localTurn.reply) {
      const localDraftChanged =
        JSON.stringify(localTurn.draft) !== JSON.stringify(currentDraft);
      const localHasClarify = Boolean(localTurn.nextState?.pendingClarification);
      if (hollow || falseCartClaim || localDraftChanged || localHasClarify || localTurn.go) {
        nextDraft = localTurn.draft;
        nextState = localTurn.nextState;
        if (hollow || falseCartClaim || !quick.length || localDraftChanged || localHasClarify) {
          reply = localTurn.reply;
        }
        if (localTurn.quick && localTurn.quick.length) quick = localTurn.quick;
        if (localTurn.go && nextDraft.length) action = 'review';
      } else if (unknown.length && (!reply || hollow || falseCartClaim)) {
        reply = `ما لقيتش «${unknown.join('، ')}» في الكتالوج. تحب تشوف الأقسام المتاحة ولا تقصد صنف تاني؟`;
        if (!quick.length) {
          quick = Object.keys(kb.cats)
            .slice(0, 6)
            .map((c) => ({ label: `قسم ${c}`, val: `عندكم إيه في ${c}` }));
        }
      } else if (hollow || falseCartClaim) {
        reply = 'معلش ما فهمتش طلبك بالكامل 😊 قولي اسم الصنف والكمية اللي عايزها أو اسألني «عندكم أصناف إيه؟».';
      }
    }
  } else if (draftChanged && (hollow || hasFalseCartClaim(reply))) {
    reply = formatOrderSummaryReply('تم تحديث مسودة الطلب ✅', nextDraft, kb);
    if (!quick.length) {
      quick = [
        { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
        { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
      ];
    }
  }

  if (hasFalseCartClaim(reply)) {
    reply = sanitizeCartClaimText(reply);
  }

  if (isHollowAiReply(reply)) {
    if (
      intent === 'confirm' &&
      nextDraft.length &&
      !disambiguations.length &&
      !missingFlavors.length &&
      !missingQty.length
    ) {
      reply = 'تمام، هفتحلك مراجعة مسودة الطلب عشان تضيفه للسلة 👌';
      action = 'review';
    } else {
      reply =
        'معلش ممكن توضح طلبك أكتر؟ قولّي اسم الصنف والكمية اللي محتاجها أو اختار من الأقسام المتاحة.';
      if (!quick.length) {
        quick = Object.keys(kb.cats)
          .slice(0, 6)
          .map((c) => ({ label: `قسم ${c}`, val: `عندكم إيه في ${c}` }));
      }
    }
  }

  return {
    draft: nextDraft,
    unknown,
    reply,
    action,
    quick: quick.slice(0, 6),
    disambiguations,
    missingFlavors: missingFlavors.map((m) => m.i),
    missingQty: missingQty.map((m) => m.i),
    rejectedReasons,
    nextState,
  };
}

// Deterministic Customer AI Engine (handles all 15 scenarios cleanly without external LLM)
export function processCustomerTurn({
  text,
  catalogData = {},
  currentDraft = [],
  convState = {},
}) {
  const kb = buildStoreKB(catalogData);
  const products = kb.products;
  const unit = kb.cfg.unit || 'كرتونة';
  const draft = JSON.parse(JSON.stringify(currentDraft || []));
  const nextState = {
    pendingClarification: convState.pendingClarification
      ? JSON.parse(JSON.stringify(convState.pendingClarification))
      : null,
    pendingQueue: Array.isArray(convState.pendingQueue)
      ? JSON.parse(JSON.stringify(convState.pendingQueue))
      : [],
    lastResolvedVariant: convState.lastResolvedVariant || '',
    lastReferencedProductIdx:
      Number.isInteger(convState.lastReferencedProductIdx) ? convState.lastReferencedProductIdx : -1,
    lastReferencedFlavorIdx:
      Number.isInteger(convState.lastReferencedFlavorIdx) ? convState.lastReferencedFlavorIdx : -1,
  };

  const n = rn(text)
    .replace(/[؟?!،,;:«»"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!n) {
    return {
      reply: 'اكتب طلبك أو سؤالك وهساعدك فوراً 😊',
      draft,
      nextState,
      go: false,
      quick: [],
    };
  }

  let carriedDisambigQty = null;

  // 1) Resolve pending clarification (confirm_suggestion, disambiguation, flavor slot, quantity slot)
  if (nextState.pendingClarification) {
    const pc = nextState.pendingClarification;

    // 1.0) Confirming uncertain/fuzzy suggestion ("تقريبا جاجور أو حاجه شبيهه")
    if (pc.type === 'confirm_suggestion' && Array.isArray(pc.candidates) && pc.candidates.length) {
      const nClean = n.replace(/\.+$/g, '').trim();
      if (/^(?:لا|مش ده|مش دي|غيره|تاني|حاج[هة] تاني[هة]?)(?:\s|$)/.test(nClean)) {
        nextState.pendingClarification = null;
        if (nextState.pendingQueue.length) {
          return advancePendingQueueOrSummary('تمام، استبعدت الاقتراح ده 👍 تحب تطلب صنف تاني غيره؟', draft, nextState, kb, products, unit);
        }
        return {
          reply: 'تمام 👍 اكتبلي اسم الصنف الصح اللي عايزه وهطلّعهولك فوراً.',
          draft,
          nextState,
          go: false,
          quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
        };
      }

      const { clean, hints } = extractHints(text);
      const qParsed = parseQuantityAndRest(clean || text, unit);
      let chosenIdx = -1;

      if (/^(?:الاول|الاولاني|1)$/.test(nClean)) chosenIdx = pc.candidates[0];
      else if (/^(?:التاني|الثاني|2)$/.test(nClean) && pc.candidates[1] != null) chosenIdx = pc.candidates[1];
      else if (/^(?:التالت|الثالث|3)$/.test(nClean) && pc.candidates[2] != null) chosenIdx = pc.candidates[2];
      else if (/^(?:ايوه|اه|نعم|تمام|هو ده|مظبوط)(?:\s|$)/.test(nClean) && pc.candidates.length === 1) {
        chosenIdx = pc.candidates[0];
      }

      if (chosenIdx < 0) {
        const toks = qParsed.rest.filter((t) => !RSTOP_SET.has(t));
        if (toks.length) {
          let bestScore = 0;
          pc.candidates.forEach((idx) => {
            const p = products[idx];
            if (!p) return;
            const vt = ntk((p[0] || '') + ' ' + (p[10] || '') + ' ' + (p[2] || ''));
            let sc = 0;
            toks.forEach((qt) => {
              sc += tokSim(qt, vt);
            });
            if (sc > bestScore) {
              bestScore = sc;
              chosenIdx = idx;
            }
          });
        }
      }

      if (chosenIdx >= 0 && products[chosenIdx] && !isProductOutOfStock(products[chosenIdx])) {
        const p = products[chosenIdx];
        const resolvedVar = String(p[10] || '').trim();
        if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
        nextState.lastReferencedProductIdx = chosenIdx;
        nextState.lastReferencedFlavorIdx = -1;
        const useQty = qParsed.explicitQty ? qParsed.qty : qParsed.hasSingularUnit ? 1 : pc.explicitQty;
        const fl = getProductFlavors(p).filter((f) => !f[1]);
        const fm = fl.length ? matchProductFlavors(p, qParsed.rest, clean || text) : { avail: [], soldOut: [] };
        if (fl.length && !fm.avail.length) {
          nextState.pendingClarification = { type: 'flavor', prodIdx: chosenIdx, explicitQty: useQty };
          return {
            reply: `تمام، تقصد ${getProductDisplayName(p)} (${fmtMoneyAr(p[3])}) 👍\nتحب أنهي نكهة؟ المتاح: ${fl.map((f) => f[0]).join('، ')}`,
            draft,
            nextState,
            go: false,
            quick: fl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
          };
        }
        const chosenFlIdx = fm.avail.length ? fm.avail[0].j : -1;
        if (!useQty) {
          nextState.pendingClarification = { type: 'qty', prodIdx: chosenIdx, flavorIdx: chosenFlIdx };
          return {
            reply: `تمام 👍 عايز كام ${unit} من ${getProductDisplayName(p)}${chosenFlIdx >= 0 ? ' · ' + getProductFlavors(p)[chosenFlIdx][0] : ''}؟`,
            draft,
            nextState,
            go: false,
            quick: [
              { label: `١ ${unit}`, val: '1' },
              { label: `٢ ${unit}`, val: '2' },
              { label: `٥ ${unit}`, val: '5' },
            ],
          };
        }
        const nextDraft = dedupeAndNormalizeDraft(
          [...draft, { i: chosenIdx, f: chosenFlIdx, q: useQty, c: [chosenIdx], amb: false }],
          products
        );
        nextState.pendingClarification = null;
        nextState.lastReferencedFlavorIdx = chosenFlIdx;
        return advancePendingQueueOrSummary(
          `ضفتلك في مسودة الطلب ✅: ${useQty} ${unit} من ${getProductDisplayName(p)}${chosenFlIdx >= 0 ? ' · ' + getProductFlavors(p)[chosenFlIdx][0] : ''} (${fmtMoneyAr(p[3] * useQty)})`,
          nextDraft,
          nextState,
          kb,
          products,
          unit
        );
      }

      const directOther = matchProductsInCatalog(qParsed.rest, products, {
        priceHints: hints,
        includeSoldOut: false,
        rawCleanText: clean || text,
      });
      const isNewCommand =
        /^(?:امسح|فضي|شيل|احذف|الغي|زود|نقص|قلل|خلي|عدل|غير|بدل|اعرض|عرض|احسب|راجع|عندكم|عندكو|بكام|بكم|سعر|اسعار|عروض|اهلا|السلام)/.test(nClean) ||
        (directOther && directOther.cs[0] && !directOther.cs[0].isFuzzyOnly && !pc.candidates.includes(directOther.cs[0].i));
      if (isNewCommand) {
        nextState.pendingClarification = null;
      } else {
        const ask = buildClarificationPromptAndQuick(pc, products, unit);
        return { reply: ask.reply, draft, nextState, go: false, quick: ask.quick };
      }
    }

    // 1a) Disambiguating product candidates
    if (pc.type === 'disambiguate_product' && Array.isArray(pc.candidates) && pc.candidates.length) {
      const { clean, hints } = extractHints(text);
      const qParsed = parseQuantityAndRest(clean || text, unit);
      let chosenIdx = -1;
      const nClean = n.replace(/\.+$/g, '').trim();

      if (hints.length) {
        chosenIdx = pc.candidates.find((idx) => Number(products[idx]?.[3]) === hints[0]) ?? -1;
        if (chosenIdx < 0) {
          chosenIdx =
            pc.candidates.find((idx) =>
              new RegExp('(?:^|\\D)' + hints[0] + '(?:\\D|$)').test(
                rnd(String(products[idx]?.[10] || '') + ' ' + String(products[idx]?.[2] || ''))
              )
            ) ?? -1;
        }
      }
      if (chosenIdx < 0 && /^(?:الاول|الاولاني|1)$/.test(nClean)) chosenIdx = pc.candidates[0];
      if (chosenIdx < 0 && /^(?:التاني|الثاني|2)$/.test(nClean) && pc.candidates[1] != null) chosenIdx = pc.candidates[1];
      if (chosenIdx < 0 && /^(?:التالت|الثالث|3)$/.test(nClean) && pc.candidates[2] != null) chosenIdx = pc.candidates[2];

      if (chosenIdx < 0) {
        const toks = qParsed.rest.filter((t) => !RSTOP_SET.has(t));
        if (toks.length) {
          let bestScore = 0;
          let ties = 0;
          pc.candidates.forEach((idx) => {
            const p = products[idx];
            if (!p) return;
            const vt = ntk((p[0] || '') + ' ' + (p[10] || '') + ' ' + (p[2] || ''));
            let sc = 0;
            toks.forEach((qt) => {
              sc += tokSim(qt, vt);
            });
            if (sc > bestScore) {
              bestScore = sc;
              chosenIdx = idx;
              ties = 1;
            } else if (sc === bestScore && sc > 0) {
              ties += 1;
            }
          });
          if (ties > 1) chosenIdx = -1;
        }
      }

      if (chosenIdx >= 0 && products[chosenIdx] && !isProductOutOfStock(products[chosenIdx])) {
        const useQty = qParsed.explicitQty
          ? qParsed.qty
          : qParsed.hasSingularUnit
          ? 1
          : pc.explicitQty;
        const p = products[chosenIdx];
        const fl = getProductFlavors(p).filter((f) => !f[1]);
        const resolvedVar = String(p[10] || '').trim();
        if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
        nextState.lastReferencedProductIdx = chosenIdx;
        nextState.lastReferencedFlavorIdx = -1;

        // Check if flavor was also provided or needed
        const fm = fl.length ? matchProductFlavors(p, qParsed.rest, clean || text) : { avail: [], soldOut: [] };
        if (fl.length && !fm.avail.length) {
          nextState.pendingClarification = {
            type: 'flavor',
            prodIdx: chosenIdx,
            explicitQty: useQty,
          };
          return {
            reply:
              `تمام اخترتلك ${getProductDisplayName(p)} (${fmtMoneyAr(p[3])}) 👍\n` +
              `تحب أنهي نكهة؟ المتاح: ${fl.map((f) => f[0]).join('، ')}`,
            draft,
            nextState,
            go: false,
            quick: fl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
          };
        }

        const chosenFlavorIdx = fm.avail.length ? fm.avail[0].j : -1;
        if (!useQty) {
          nextState.pendingClarification = {
            type: 'qty',
            prodIdx: chosenIdx,
            flavorIdx: chosenFlavorIdx,
          };
          return {
            reply: `تمام 👍 عايز كام ${unit} من ${getProductDisplayName(p)}${chosenFlavorIdx >= 0 ? ' · ' + getProductFlavors(p)[chosenFlavorIdx][0] : ''}؟`,
            draft,
            nextState,
            go: false,
            quick: [
              { label: `١ ${unit}`, val: '1' },
              { label: `٢ ${unit}`, val: '2' },
              { label: `٥ ${unit}`, val: '5' },
            ],
          };
        }

        const nextDraft = dedupeAndNormalizeDraft(
          [...draft, { i: chosenIdx, f: chosenFlavorIdx, q: useQty, c: [chosenIdx], amb: false }],
          products
        );
        nextState.pendingClarification = null;
        nextState.lastReferencedFlavorIdx = chosenFlavorIdx;
        return advancePendingQueueOrSummary(
          `ضفتلك في مسودة الطلب ✅: ${useQty} ${unit} من ${getProductDisplayName(p)}${chosenFlavorIdx >= 0 ? ' · ' + getProductFlavors(p)[chosenFlavorIdx][0] : ''} (${fmtMoneyAr(p[3] * useQty)})`,
          nextDraft,
          nextState,
          kb,
          products,
          unit
        );
      }

      // Check if user switched to a totally different product or an explicit command
      const directOther = matchProductsInCatalog(qParsed.rest, products, {
        priceHints: hints,
        includeSoldOut: false,
        rawCleanText: clean || text,
      });
      const isNewCommand =
        /^(?:امسح|فضي|شيل|احذف|الغي|زود|نقص|قلل|خلي|عدل|غير|بدل|اعرض|عرض|احسب|راجع|عندكم|عندكو|بكام|بكم|سعر|اسعار|عروض|عرض|اهلا|السلام)/.test(
          nClean
        ) ||
        (directOther &&
          directOther.cs[0] &&
          !directOther.cs[0].isFuzzyOnly &&
          !pc.candidates.includes(directOther.cs[0].i));

      if (isNewCommand) {
        if (
          pc.explicitQty &&
          !qParsed.explicitQty &&
          !qParsed.hasSingularUnit &&
          directOther &&
          directOther.cs[0] &&
          !directOther.cs[0].isFuzzyOnly
        ) {
          carriedDisambigQty = pc.explicitQty;
        }
        nextState.pendingClarification = null;
      } else {
        return {
          reply:
            `معلش ما حددتش تقصد أنهي نوع من الاختيارات دي:\n` +
            pc.candidates
              .map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`)
              .join('\n'),
          draft,
          nextState,
          go: false,
          quick: pc.candidates.slice(0, 6).map((idx) => ({
            label: getProductDisplayName(products[idx]),
            val: getProductDisplayName(products[idx]),
          })),
        };
      }
    }

    // 1b) Resolving pending flavor for a specific product
    if (pc.type === 'flavor' && products[pc.prodIdx]) {
      const p = products[pc.prodIdx];
      const fl = getProductFlavors(p);
      const availFl = fl.filter((f) => !f[1]);
      const nClean = n.replace(/\.+$/g, '').trim();

      if (/^(?:اي نكهه|اي طعم|مش فارق|مش فارقه|عادي|اي حاجه)(?:\s|$)/.test(nClean)) {
        // Require choosing an available flavor before finalizing into order draft
        return {
          reply:
            `لازم تختار نكهة محددة لـ ${getProductDisplayName(p)} قبل إضافته للطلب.\n` +
            `النكهات المتاحة: ${availFl.map((f) => f[0]).join('، ')}`,
          draft,
          nextState,
          go: false,
          quick: availFl.slice(0, 4).map((f) => ({ label: f[0], val: f[0] })),
        };
      }

      const segs = segmentOrderText(text, products);
      const picked = [];
      let rejectedFlavor = '';
      let looksLikeDifferentIntent = false;

      for (const sg of segs) {
        const qp = parseQuantityAndRest(sg, unit);
        if (qp.distributive === 'flavors') {
          availFl.forEach((f) => {
            const realIdx = fl.indexOf(f);
            picked.push({
              j: realIdx,
              q: qp.explicitQty ? qp.qty : pc.explicitQty || 1,
              name: f[0],
              hadExplicitQty: true,
            });
          });
          continue;
        }
        const fm = matchProductFlavors(p, qp.rest, sg);
        if (fm.avail.length) {
          fm.avail.forEach((af) => {
            picked.push({
              j: af.j,
              q: qp.explicitQty ? qp.qty : pc.explicitQty,
              name: af.name,
              hadExplicitQty: qp.explicitQty || Boolean(pc.explicitQty),
            });
          });
        } else if (fm.soldOut.length) {
          rejectedFlavor = `نكهة «${fm.soldOut[0].name}» خلصانة حالياً في ${getProductDisplayName(p)}. المتاح: ${availFl.map((f) => f[0]).join('، ')}`;
        } else {
          const otherM = matchProductsInCatalog(qp.rest, products, { includeSoldOut: true, rawCleanText: sg });
          if (
            (otherM && otherM.cs[0].i !== pc.prodIdx && !otherM.cs[0].isFuzzyOnly) ||
            /^(?:امسح|شيل|احذف|اعرض|احسب|راجع|عندكم|بكام|سعر|زود|نقص|قلل|خلي|غير|بدل)/.test(nClean)
          ) {
            looksLikeDifferentIntent = true;
            break;
          }
          const unknownFlavorTokens = qp.rest.filter((t) => !RSTOP_SET.has(t) && !FLAVOR_MODIFIER_WORDS.has(t));
          if (unknownFlavorTokens.length) {
            rejectedFlavor = `نكهة «${unknownFlavorTokens.join(' ')}» غير متاحة في ${getProductDisplayName(p)}. النكهات المتاحة هي: ${availFl.map((f) => f[0]).join('، ')}`;
          }
        }
      }

      if (rejectedFlavor && !looksLikeDifferentIntent && !picked.length) {
        return {
          reply: rejectedFlavor,
          draft,
          nextState,
          go: false,
          quick: availFl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
        };
      }

      if (!looksLikeDifferentIntent && picked.length) {
        if (picked.length === 1 && !picked[0].hadExplicitQty) {
          nextState.pendingClarification = {
            type: 'qty',
            prodIdx: pc.prodIdx,
            flavorIdx: picked[0].j,
          };
          nextState.lastReferencedProductIdx = pc.prodIdx;
          nextState.lastReferencedFlavorIdx = picked[0].j;
          return {
            reply: `تمام (${getProductDisplayName(p)} · ${picked[0].name}) 👍 عايز كام ${unit}؟`,
            draft,
            nextState,
            go: false,
            quick: [
              { label: `١ ${unit}`, val: '1' },
              { label: `٢ ${unit}`, val: '2' },
              { label: `٥ ${unit}`, val: '5' },
            ],
          };
        }

        const existingPlaceholder = draft.find((l) => l.i === pc.prodIdx && l.f < 0);
        let workingDraft = draft.filter((l) => !(l.i === pc.prodIdx && l.f < 0));
        const addedLines = [];
        picked.forEach((pkItem) => {
          const useQ = pkItem.q || (existingPlaceholder ? existingPlaceholder.q : 1);
          workingDraft.push({ i: pc.prodIdx, f: pkItem.j, q: useQ, c: [pc.prodIdx], amb: false });
          addedLines.push(`${useQ} ${unit} ${getProductDisplayName(p)} · ${pkItem.name}`);
        });
        workingDraft = dedupeAndNormalizeDraft(workingDraft, products);
        nextState.pendingClarification = null;
        nextState.lastReferencedProductIdx = pc.prodIdx;
        nextState.lastReferencedFlavorIdx = picked[picked.length - 1].j;
        return advancePendingQueueOrSummary(
          `ضفتلك في مسودة الطلب ✅:\n${addedLines.join('\n')}`,
          workingDraft,
          nextState,
          kb,
          products,
          unit
        );
      }
      nextState.pendingClarification = null;
    }

    // 1c) Resolving pending quantity for a chosen (product, flavor)
    if (pc.type === 'qty' && products[pc.prodIdx]) {
      const p = products[pc.prodIdx];
      const qp = parseQuantityAndRest(text, unit);
      if (qp.unitMismatch) {
        return {
          reply: `وحدة البيع في المتجر هي «${qp.unitMismatch.storeUnit}» مش ${qp.unitMismatch.requestedUnit}. تحب تطلب كام ${qp.unitMismatch.storeUnit}؟`,
          draft,
          nextState,
          go: false,
          quick: [],
        };
      }
      const nonStopRest = qp.rest.filter((t) => !RSTOP_SET.has(t));
      const resolvedQty =
        qp.explicitQty
          ? qp.qty
          : qp.hasSingularUnit && !nonStopRest.length
          ? 1
          : 0;

      const switchedProduct = nonStopRest.length
        ? matchProductsInCatalog(nonStopRest, products, { includeSoldOut: false, rawCleanText: text })
        : null;
      const isSwitched =
        (switchedProduct && switchedProduct.cs[0] && switchedProduct.cs[0].i !== pc.prodIdx && !switchedProduct.cs[0].isFuzzyOnly) ||
        /^(?:امسح|فضي|شيل|احذف|الغي|اعرض|عرض|احسب|راجع|عندكم|عندكو|بكام|بكم|سعر|عروض)/.test(n);

      if (resolvedQty > 0 && !isSwitched) {
        const fl = getProductFlavors(p);
        const fIndices = Array.isArray(pc.flavorIndices) && pc.flavorIndices.length
          ? pc.flavorIndices.filter((idx) => idx >= 0 && fl[idx] && !fl[idx][1])
          : [pc.flavorIdx >= 0 && fl[pc.flavorIdx] && !fl[pc.flavorIdx][1] ? pc.flavorIdx : -1];
        const newLines = fIndices.map((fIdx) => ({
          i: pc.prodIdx,
          f: fIdx,
          q: resolvedQty,
          c: [pc.prodIdx],
          amb: false,
        }));
        const nextDraft = dedupeAndNormalizeDraft([...draft, ...newLines], products);
        nextState.pendingClarification = null;
        nextState.lastReferencedProductIdx = pc.prodIdx;
        nextState.lastReferencedFlavorIdx = fIndices[fIndices.length - 1];
        const resolvedVar = String(p[10] || '').trim();
        if (resolvedVar) nextState.lastResolvedVariant = resolvedVar;
        const summaryHeader = fIndices.length > 1
          ? `ضفتلك في مسودة الطلب ✅:\n` +
            fIndices.map((fIdx) => `${resolvedQty} ${unit} ${getProductDisplayName(p)} · ${fl[fIdx][0]}`).join('\n')
          : `ضفتلك في مسودة الطلب ✅: ${resolvedQty} ${unit} من ${getProductDisplayName(p)}${fIndices[0] >= 0 ? ' · ' + fl[fIndices[0]][0] : ''} (${fmtMoneyAr(p[3] * resolvedQty)})`;
        return advancePendingQueueOrSummary(summaryHeader, nextDraft, nextState, kb, products, unit);
      }

      if (!isSwitched && !nonStopRest.length) {
        return {
          reply: `محتاج أعرف الكمية المطلوبة من ${getProductDisplayName(p)} بالـ ${unit} (مثلاً: ١ أو ٢ أو ٥).`,
          draft,
          nextState,
          go: false,
          quick: [
            { label: `١ ${unit}`, val: '1' },
            { label: `٢ ${unit}`, val: '2' },
            { label: `٥ ${unit}`, val: '5' },
          ],
        };
      }
      nextState.pendingClarification = null;
    }
  }

  // 2) Clear entire draft
  if (/(?:امسح|فضي|الغي|شيل)\s*(?:كله|الكل|الطلب(?:\s+كله)?|المسوده|كل حاجه)|ابدا من جديد/.test(n)) {
    nextState.pendingClarification = null;
    nextState.pendingQueue = [];
    nextState.lastResolvedVariant = '';
    return {
      reply: 'مسحت الطلب الحالي كله 🗑 قولي تحب تبدأ بطلب إيه؟',
      draft: [],
      nextState,
      go: false,
      quick: [
        { label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' },
        { label: '🎁 العروض', val: 'إيه العروض؟' },
      ],
    };
  }

  // 3) Show current draft / Calculate total explicitly
  if (
    /(?:اعرض|عرض|وريني|شوف|مراجعه|ملخص)\s*(?:الطلب|المسوده|طلبي)|(?:احسب|احسبلي|قولي)\s*(?:ال)?(?:اجمالي|حساب|المبلغ|السعر)|(?:ال)?طلب\s*(?:الحالي|بتاعي)\s*(?:ايه|كام)/.test(
      n
    )
  ) {
    if (!draft.length) {
      return {
        reply: 'مسودة الطلب فاضية دلوقتي 😊 ابعتلي الأصناف والكميات اللي عايزها.',
        draft,
        nextState,
        go: false,
        quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
      };
    }
    const calc = computeDraftTotals(draft, products);
    const minVal = Number(kb.cfg.min || 0);
    const linesTxt = calc.lines.map(
      (l) =>
        `• ${l.q} ${unit} ${l.name}${l.flavorName ? ' · ' + l.flavorName : ''} — ${fmtMoneyAr(l.subtotal)}`
    );
    let msg = `📝 الطلب الحالي (${calc.totalQty} ${unit}):\n${linesTxt.join('\n')}\n\n💰 الإجمالي: ${fmtMoneyAr(calc.totalPrice)}`;
    if (minVal > 0 && calc.totalPrice < minVal) {
      msg += `\n⚠️ ملحوظة: الحد الأدنى للطلب ${fmtMoneyAr(minVal)} (باقي ${fmtMoneyAr(minVal - calc.totalPrice)})`;
    }
    return {
      reply: msg,
      draft,
      nextState,
      go: false,
      quick: [
        { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
        { label: '🗑 مسح الطلب', val: 'امسح الطلب كله' },
      ],
    };
  }

  // 4) Explicit Review / Add to cart command
  if (
    draft.length &&
    /^(?:ايوه|تمام|خلاص|يلا|كده بس|كده|راجع(?:\s+الطلب)?|اضف(?:\s+الطلب)?(?:\s+للسله)?|ضيف(?:\s+الطلب)?(?:\s+للسله)?|ماشي|اه|موافق|اكد|انقل للسله)(?:\s|$)/.test(
      n
    )
  ) {
    const missing = draft.filter((l) => getProductFlavors(products[l.i]).some((f) => !f[1]) && l.f < 0);
    if (missing.length) {
      const mLine = missing[0];
      const avFl = getProductFlavors(products[mLine.i]).filter((f) => !f[1]);
      nextState.pendingClarification = { type: 'flavor', prodIdx: mLine.i, explicitQty: mLine.q };
      return {
        reply: `قبل الإضافة للسلة، لسه ما اخترناش نكهة لـ ${getProductDisplayName(products[mLine.i])}. تحب أنهي نكهة؟ (${avFl.map((f) => f[0]).join('، ')})`,
        draft,
        nextState,
        go: false,
        quick: avFl.slice(0, 4).map((f) => ({ label: f[0], val: f[0] })),
      };
    }
    return {
      reply: 'تمام، هفتحلك مراجعة الطلب لإضافته للسلة 👌',
      draft,
      nextState,
      go: true,
      quick: [],
    };
  }

  // 5) "نفس المنتج بس نكهة تانية" / Same product another flavor
  if (/(?:نفس\s+(?:المنتج|الصنف)|نكهة?\s+تاني[هة]?|طعم\s+تاني)/.test(n) && nextState.lastReferencedProductIdx >= 0) {
    const pIdx = nextState.lastReferencedProductIdx;
    const p = products[pIdx];
    if (p && !isProductOutOfStock(p)) {
      const avFl = getProductFlavors(p).filter((f) => !f[1]);
      if (!avFl.length) {
        return {
          reply: `${getProductDisplayName(p)} مالوش نكهات مختلفة.`,
          draft,
          nextState,
          go: false,
          quick: [],
        };
      }
      const qp = parseQuantityAndRest(text, unit);
      // Check if user specified the new flavor right away
      const fm = matchProductFlavors(p, qp.rest, text);
      if (fm.avail.length) {
        const useQ = qp.explicitQty ? qp.qty : 1;
        const nextDraft = dedupeAndNormalizeDraft(
          [...draft, { i: pIdx, f: fm.avail[0].j, q: useQ, c: [pIdx], amb: false }],
          products
        );
        nextState.lastReferencedFlavorIdx = fm.avail[0].j;
        return {
          reply: formatOrderSummaryReply(
            `ضفتلك في مسودة الطلب ${useQ} ${unit} من ${getProductDisplayName(p)} · ${fm.avail[0].name} ✅`,
            nextDraft,
            kb
          ),
          draft: nextDraft,
          nextState,
          go: false,
          quick: [
            { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
            { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
          ],
        };
      }
      const usedFlavors = new Set(draft.filter((l) => l.i === pIdx && l.f >= 0).map((l) => l.f));
      const flList = getProductFlavors(p);
      const unused = avFl.filter((f) => !usedFlavors.has(flList.indexOf(f)));
      const suggest = unused.length ? unused : avFl;
      nextState.pendingClarification = {
        type: 'flavor',
        prodIdx: pIdx,
        explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
      };
      return {
        reply: `أكيد 👍 النكهات المتاحة في ${getProductDisplayName(p)} هي: ${suggest.map((f) => f[0]).join('، ')}. تحب أنهي نكهة؟`,
        draft,
        nextState,
        go: false,
        quick: suggest.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
      };
    }
  }

  // 6) Remove specific product/flavor from draft ("شيل الجاجوار" / "احذف الدوريتوس")
  if (/^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:شيل|احذف|الغي|امسح|مش عايز|بلاش)\s+/.test(n)) {
    if (!draft.length) {
      return {
        reply: 'الطلب الحالي فاضي أصلاً 😊 اكتبلي الأصناف اللي عايز تطلبها.',
        draft,
        nextState,
        go: false,
        quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
      };
    }
    const restText = text
      .replace(/^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:شيل|احذف|الغي|امسح|مش عايز|بلاش)\s+/i, '')
      .trim();
    const { clean, hints } = extractHints(restText);
    const qp = parseQuantityAndRest(clean || restText, unit);
    const m = matchProductsInCatalog(qp.rest, products, {
      priceHints: hints,
      includeSoldOut: true,
      rawCleanText: clean || restText,
    });
    if (m) {
      const matchedInDraft = m.cs.filter((c) => draft.some((l) => l.i === c.i));
      if (matchedInDraft.length) {
        const targetIdx = matchedInDraft[0].i;
        const p = products[targetIdx];
        const fm = matchProductFlavors(p, qp.rest, clean || restText);
        let nextDraft;
        if (fm.avail.length) {
          const flIds = new Set(fm.avail.map((x) => x.j));
          nextDraft = draft.filter((l) => !(l.i === targetIdx && flIds.has(l.f)));
        } else {
          nextDraft = draft.filter((l) => l.i !== targetIdx);
        }
        if (nextDraft.length < draft.length) {
          return {
            reply: nextDraft.length
              ? formatOrderSummaryReply(`شيلت ${getProductDisplayName(p)} من الطلب ✅`, nextDraft, kb)
              : `شيلت ${getProductDisplayName(p)} من الطلب ✅ وبقى الطلب فاضي دلوقتي. تحب تضيف صنف تاني؟`,
            draft: nextDraft,
            nextState,
            go: false,
            quick: nextDraft.length
              ? [{ label: '✅ راجع الطلب', val: 'راجع الطلب' }]
              : [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
          };
        }
      }
    }
    return {
      reply: 'الصنف ده مش موجود في الطلب الحالي.',
      draft,
      nextState,
      go: false,
      quick: [{ label: '📝 اعرض الطلب الحالي', val: 'اعرض الطلب الحالي' }],
    };
  }

  // 7) Change flavor or adjust quantity on existing draft item
  if (
    draft.length &&
    /^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:زود|زودلي|نقص|قلل|خليهم|خلي|عدل|غير|بدل|اغير|تعديل|تغيير)(?:\s|$)/.test(
      n
    )
  ) {
    const { clean, hints } = extractHints(text);
    const adjClean = n.replace(
      /^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:زود|زودلي|نقص|قلل|خليهم|خلي|عدل|غير|بدل|اغير|تعديل|تغيير)\s*/,
      ''
    );
    const adjParsed = parseQuantityAndRest(adjClean, unit);

    // Handle flavor change ("غير النكهة لـ شطة" / "غير النكهة لشطة" / "خلي الجبنة شطة")
    if (/(?:غير|بدل|خلي|اغير|تغيير|عدل)/.test(n) && !adjParsed.explicitQty) {
      const m = matchProductsInCatalog(adjParsed.rest, products, {
        priceHints: hints,
        includeSoldOut: false,
        rawCleanText: clean || adjClean,
      });
      let targetLine =
        (m && m.cs.map((c) => draft.find((l) => l.i === c.i)).find(Boolean)) ||
        (nextState.lastReferencedProductIdx >= 0
          ? draft.find((l) => l.i === nextState.lastReferencedProductIdx)
          : null) ||
        (draft.length === 1 ? draft[0] : null);

      if (targetLine) {
        const p = products[targetLine.i];
        const fl = getProductFlavors(p);
        const availFl = fl.filter((f) => !f[1]);
        let targetFlavorTxt = adjClean;
        const prepMatch = adjClean.match(/(?:لـ|لي|الي|إلى|بـ)\s*(.+)$/);
        if (prepMatch) {
          targetFlavorTxt = prepMatch[1];
        } else {
          const attachedL = adjClean.match(/(?:^|\s)ل([^\s]{2,})$/);
          if (attachedL) targetFlavorTxt = attachedL[1];
        }
        const fm = matchProductFlavors(p, ntk(targetFlavorTxt), targetFlavorTxt);
        if (fm.avail.length) {
          const pickedF =
            fm.avail.find((f) => f.j !== targetLine.f) || fm.avail[0];
          targetLine.f = pickedF.j;
          const nextDraft = dedupeAndNormalizeDraft(draft, products);
          nextState.lastReferencedProductIdx = targetLine.i;
          nextState.lastReferencedFlavorIdx = pickedF.j;
          return {
            reply: formatOrderSummaryReply(
              `غيّرت النكهة لـ ${getProductDisplayName(p)} · ${pickedF.name} ✅`,
              nextDraft,
              kb
            ),
            draft: nextDraft,
            nextState,
            go: false,
            quick: [{ label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' }],
          };
        }
        if (fm.soldOut.length) {
          return {
            reply: `نكهة «${fm.soldOut[0].name}» خلصانة في ${getProductDisplayName(p)}. المتاح: ${availFl.map((f) => f[0]).join('، ')}`,
            draft,
            nextState,
            go: false,
            quick: availFl.slice(0, 6).map((f) => ({ label: f[0], val: `غير النكهة لـ ${f[0]}` })),
          };
        }
        if (availFl.length && /(?:نكهه|نكهة|طعم|غير|بدل)/.test(n)) {
          return {
            reply: `النكهات المتاحة في ${getProductDisplayName(p)} هي: ${availFl.map((f) => f[0]).join('، ')}. تحب تغيّرها لأي نكهة؟`,
            draft,
            nextState,
            go: false,
            quick: availFl.slice(0, 6).map((f) => ({ label: f[0], val: `غير النكهة لـ ${f[0]}` })),
          };
        }
      }
    }

    // Quantity adjustment
    const isInc = /^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:زود|زودلي)/.test(n);
    const isDec = /^(?:عايز\s+|ممكن\s+|لو سمحت\s+)?(?:نقص|قلل)/.test(n);
    const m = matchProductsInCatalog(adjParsed.rest, products, {
      priceHints: hints,
      includeSoldOut: false,
      rawCleanText: clean || adjClean,
    });

    let line = null;
    if (m) {
      for (const c of m.cs) {
        const found = draft.find((l) => l.i === c.i);
        if (found) {
          line = found;
          break;
        }
      }
    }
    if (!line && nextState.lastReferencedProductIdx >= 0) {
      line = draft.find((l) => l.i === nextState.lastReferencedProductIdx) || null;
    }
    if (!line && draft.length === 1) {
      line = draft[0];
    }

    if (!line) {
      return {
        reply:
          'تحب تعدّل كمية أنهي صنف في الطلب؟\n' +
          draft.map((l, idx) => `${idx + 1}) ${getProductDisplayName(products[l.i])} (${l.q} ${unit})`).join('\n'),
        draft,
        nextState,
        go: false,
        quick: [],
      };
    }

    const delta = adjParsed.explicitQty ? adjParsed.qty : 1;
    if (isInc) {
      line.q = Math.min(99, Math.round((line.q + delta) * 100) / 100);
    } else if (isDec) {
      const decreased = Math.round((line.q - delta) * 100) / 100;
      if (decreased <= 0) {
        const nextDraft = draft.filter((l) => l !== line);
        return {
          reply: nextDraft.length
            ? formatOrderSummaryReply(`شيلت ${getProductDisplayName(products[line.i])} لأن الكمية وصلت لصفر ✅`, nextDraft, kb)
            : `شيلت ${getProductDisplayName(products[line.i])} لأن الكمية وصلت لصفر ✅`,
          draft: nextDraft,
          nextState,
          go: false,
          quick: [],
        };
      }
      line.q = normalizeQtyValue(decreased, 1);
    } else if (adjParsed.explicitQty || adjParsed.hasSingularUnit) {
      line.q = normalizeQtyValue(delta, 1);
    }
    nextState.lastReferencedProductIdx = line.i;
    nextState.lastReferencedFlavorIdx = line.f;
    const nextDraft = dedupeAndNormalizeDraft(draft, products);
    return {
      reply: formatOrderSummaryReply(
        `عدّلت الكمية لـ ${getProductDisplayName(products[line.i])} بقت ${line.q} ${unit} ✅`,
        nextDraft,
        kb
      ),
      draft: nextDraft,
      nextState,
      go: false,
      quick: [{ label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' }],
    };
  }

  // 8) Flavor availability inquiry across entire catalog ("عندكم نكهة باربكيو؟" / "في طعم كاتشب؟")
  const flavorAskMatch = n.match(/^(?:عندكم|عندكو|متوفر|في|موجود)\s+(?:نكهه|نكهة|طعم)\s+(.+)$/);
  if (flavorAskMatch) {
    const fQuery = flavorAskMatch[1].trim();
    const qToks = ntk(fQuery).filter((t) => !RSTOP_SET.has(t));
    const matches = [];
    kb.avail.forEach((rec) => {
      const fm = matchProductFlavors(rec.p, qToks, fQuery);
      if (fm.avail.length) {
        matches.push({ rec, flavorName: fm.avail[0].name });
      }
    });
    if (matches.length) {
      return {
        reply:
          `أيوه، نكهة «${fQuery}» متاحة في:\n` +
          matches.slice(0, 6).map((m) => `• ${m.rec.name} — ${fmtMoneyAr(m.rec.price)}`).join('\n'),
        draft,
        nextState,
        go: false,
        quick: matches.slice(0, 3).map((m) => ({
          label: `اطلب ١ ${m.rec.baseName}`,
          val: `١ ${m.rec.name} ${m.flavorName}`,
        })),
      };
    }
    // Check if sold out anywhere
    const soldMatches = [];
    products.forEach((p, idx) => {
      const fm = matchProductFlavors(p, qToks, fQuery);
      if (fm.soldOut.length || (fm.avail.length && isProductOutOfStock(p))) {
        soldMatches.push(getProductDisplayName(p));
      }
    });
    if (soldMatches.length) {
      return {
        reply: `نكهة «${fQuery}» غير متوفرة حالياً (خلصانة في ${soldMatches.join('، ')}).`,
        draft,
        nextState,
        go: false,
        quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
      };
    }
    return {
      reply: `للاسف نكهة «${fQuery}» غير متاحة حالياً في أصناف المتجر.`,
      draft,
      nextState,
      go: false,
      quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
    };
  }

  // 9) Vague / unreferenced demonstrative ("عايز المنتج ده" / "هاتلي ده")
  if (/^(?:عايز|هات|هاتلي|ضيف|اطلب)\s+(?:المنتج\s+)?(?:ده|دي|دا)(?:\s|$)/.test(n)) {
    return {
      reply: 'معلش مش واضح أنهي منتج تقصده 😊 قولّي اسم المنتج اللي عايزه أو اسألني «عندكم أصناف إيه؟».',
      draft,
      nextState,
      go: false,
      quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
    };
  }

  // 10) Offers & Discounts Q&A (active offers only — never expired!)
  if (/(?:^|\s)(?:ال)?(?:عروض|عرض|خصم|خصومات|تخفيض|تخفيضات|اوفرز)(?:\s|$)/.test(n)) {
    const parts = [];
    if (kb.offers.length) {
      parts.push(
        '🎁 العروض السارية حالياً:\n' +
          kb.offers
            .slice(0, 6)
            .map((o) => `• ${o.t}${o.pr ? ' — ' + o.pr : ''}${o.d ? ' (' + o.d + ')' : ''}`)
            .join('\n')
      );
    }
    if (kb.discounts.length) {
      parts.push(
        '🔥 أصناف عليها خصم مباشر:\n' +
          kb.discounts
            .slice(0, 6)
            .map((d) => `• ${d.name}: ${fmtMoneyAr(d.price)} بدل ${fmtMoneyAr(d.oldPrice)} (خصم ${d.discPct}%)`)
            .join('\n')
      );
    }
    if (!parts.length) {
      parts.push('لا توجد عروض ترويجية خاصة نشطة حالياً، وكل الأصناف متاحة بأسعار الجملة المباشرة.');
    }
    return {
      reply: parts.join('\n\n'),
      draft,
      nextState,
      go: false,
      quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
    };
  }

  // 11) Store rules / Min order / Cart summary Q&A
  if (/(?:اقل طلب|الحد الادني|حد ادني|حسابي|سله|سلة|توصيل|واتساب|شحن|وحده|وحدة\s+البيع)/.test(n) && !/(?:امسح|شيل|راجع)/.test(n)) {
    const minVal = Number(kb.cfg.min || 0);
    const calc = computeDraftTotals(draft, products);
    let m =
      `📦 نظام الطلب:\n• وحدة الطلب: ${unit}\n• ` +
      (minVal > 0 ? `أقل قيمة للطلب: ${fmtMoneyAr(minVal)}` : 'بدون حد أدنى للطلب') +
      `\n• الإرسال مباشر عبر واتساب.`;
    if (calc.totalQty > 0) {
      m += `\n📝 في طلبك الحالي: ${calc.totalQty} ${unit} بإجمالي ${fmtMoneyAr(calc.totalPrice)}`;
    }
    return {
      reply: m,
      draft,
      nextState,
      go: false,
      quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
    };
  }

  // 12) Price / Flavors / Stock Q&A
  if (
    /(?:^|\s)(?:بكام|بكم|سعر|اسعار|نكهات|اطعمه|طعوم|متوفر|عندكم من|تفاصيل|خلصان)(?:\s|$)/.test(n) &&
    !/عندكم\s+(?:ايه|اصناف)/.test(n)
  ) {
    const queryClean = n.replace(
      /(?:^|\s)(?:بكام|بكم|سعر|اسعار|نكهات|اطعمه|طعوم|متوفر|عندكم من|تفاصيل|خلصان|هو|هي|ايه|اللي|في)(?=\s|$)/g,
      ' '
    );
    const { clean, hints } = extractHints(queryClean);
    const m = matchProductsInCatalog(ntk(clean || queryClean), products, {
      priceHints: hints,
      includeSoldOut: true,
      rawCleanText: clean || queryClean,
    });
    if (m && m.cs.length) {
      const topRecs = m.cs.slice(0, 4).map((c) => ({ i: c.i, p: products[c.i], out: c.out }));
      const linesTxt = topRecs.map(({ i, p, out }) => {
        const avFl = getProductFlavors(p).filter((f) => !f[1]).map((f) => f[0]);
        let s =
          `• ${getProductDisplayName(p)}${p[2] ? ' (' + p[2] + ')' : ''} — ` +
          (out ? '❌ خلصان حالياً' : fmtMoneyAr(p[3]) + (Number(p[11]) > p[3] ? ` (بدل ${fmtMoneyAr(p[11])})` : ''));
        if (!out && avFl.length) s += `\n  النكهات: ${avFl.join('، ')}`;
        return s;
      });
      nextState.lastReferencedProductIdx = topRecs[0].i;
      return {
        reply: linesTxt.join('\n'),
        draft,
        nextState,
        go: false,
        quick: [],
      };
    }
  }

  // 13) Catalog / category browsing
  if (
    /(?:عندكم\s+ايه|عندكو\s+ايه|عندكم\s+اصناف|ايه\s+(?:اللي\s+)?متوفر|ايه\s+(?:اللي\s+)?موجود|(?:^|\s)(?:ال)?(?:اصناف|اقسام|منتجات|بضاعه|منيو|كتالوج)(?:\s|$)|تبيعوا\s+ايه)/.test(
      n
    )
  ) {
    const catNames = Object.keys(kb.cats);
    const matchedCat = catNames.find((c) => n.includes(rn(c)));
    if (matchedCat) {
      const list = kb.cats[matchedCat];
      return {
        reply:
          `📦 قسم ${matchedCat} (${list.length} صنف متاح):\n` +
          list.slice(0, 10).map((x) => `• ${x.name} — ${fmtMoneyAr(x.price)}`).join('\n'),
        draft,
        nextState,
        go: false,
        quick: list.slice(0, 3).map((x) => ({ label: `اطلب ١ ${x.baseName}`, val: `١ ${x.name}` })),
      };
    }
    return {
      reply:
        `🏪 متوفر عندنا ${kb.avail.length} صنف في الأقسام:\n` +
        catNames.map((c) => `• ${c} (${kb.cats[c].length} صنف)`).join('\n'),
      draft,
      nextState,
      go: false,
      quick: catNames.slice(0, 4).map((c) => ({ label: `قسم ${c}`, val: `عندكم إيه في ${c}` })),
    };
  }

  // 14) Greeting
  if (/^(?:اهلا|السلام عليكم|وعليكم|مرحبا|هاي|ازيك|صباح|مساء)(?:\s|$)/.test(n)) {
    return {
      reply: `أهلاً بيك 👋 قولي عايز تطلب إيه من ${kb.cfg.brandName || 'المتجر'} وهرتبلك الطلب فوراً!`,
      draft,
      nextState,
      go: false,
      quick: [
        { label: '🎁 العروض', val: 'إيه العروض؟' },
        { label: '📋 الأصناف', val: 'عندكم أصناف إيه؟' },
      ],
    };
  }

  // 15) Order item extraction across ALL segments without dropping any item, merging only identical confirmed items
  const analysis = analyzeOrderSegments(text, catalogData, {
    unit,
    prevProdIdx: nextState.lastReferencedProductIdx,
    carriedQty: carriedDisambigQty,
  });

  if (analysis.prevProdIdx >= 0) nextState.lastReferencedProductIdx = analysis.prevProdIdx;
  if (analysis.lastRefFlavorIdx >= 0) nextState.lastReferencedFlavorIdx = analysis.lastRefFlavorIdx;

  // Handle pure quantity update referencing an existing draft item (e.g. "عايز كرتونتين")
  const qtyRefs = analysis.resolvedItems.filter((x) => x.qtyOnlyRef);
  const directAdds = analysis.resolvedItems.filter((x) => !x.qtyOnlyRef);
  const addedMsgs = [...analysis.resolvedMsgs];

  if (
    qtyRefs.length &&
    !directAdds.length &&
    !analysis.pendingTasks.length &&
    !analysis.unknownItems.length
  ) {
    const qr = qtyRefs[0];
    const existingLine =
      (nextState.lastReferencedFlavorIdx >= 0
        ? draft.find((l) => l.i === qr.i && l.f === nextState.lastReferencedFlavorIdx)
        : null) || draft.find((l) => l.i === qr.i);
    if (existingLine) {
      existingLine.q = normalizeQtyValue(qr.q, 1);
      const nextDraft = dedupeAndNormalizeDraft(draft, products);
      return {
        reply: formatOrderSummaryReply(
          `عدّلت الكمية لـ ${getProductDisplayName(products[qr.i])} في مسودة الطلب بقت ${existingLine.q} ${unit} ✅`,
          nextDraft,
          kb
        ),
        draft: nextDraft,
        nextState,
        go: false,
        quick: [{ label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' }],
      };
    }
    const pRef = products[qr.i];
    const flRef = pRef ? getProductFlavors(pRef).filter((f) => !f[1]) : [];
    if (pRef && flRef.length) {
      nextState.pendingClarification = { type: 'flavor', prodIdx: qr.i, explicitQty: qr.q };
      return {
        reply: `تمام (${qr.q} ${unit} من ${getProductDisplayName(pRef)}) 👍 تحب أنهي نكهة؟ المتاح: ${flRef.map((f) => f[0]).join('، ')}`,
        draft: dedupeAndNormalizeDraft(draft, products),
        nextState,
        go: false,
        quick: flRef.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
      };
    }
  }

  directAdds.forEach((it) => {
    draft.push({ i: it.i, pid: it.pid, f: it.f, q: it.q, c: it.c || [it.i], amb: false });
  });
  const finalDraft = dedupeAndNormalizeDraft(draft, products);

  const parts = [];
  let quick = [];

  if (addedMsgs.length) {
    const mergedAddsTxt = dedupeAndNormalizeDraft(directAdds, products).map((it) => {
      const p = products[it.i];
      const fl = getProductFlavors(p);
      const fn = it.f >= 0 && fl[it.f] ? ` · ${fl[it.f][0]}` : '';
      return `${it.q} ${unit} ${getProductDisplayName(p)}${fn}`;
    });
    if (!analysis.pendingTasks.length && !analysis.unknownItems.length && !analysis.warnings.length) {
      parts.push(
        formatOrderSummaryReply(
          `ضفتلك في مسودة الطلب ✅:\n${mergedAddsTxt.join('\n')}`,
          finalDraft,
          kb
        )
      );
      quick = [
        { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
        { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
      ];
    } else {
      parts.push(`ضفتلك في مسودة الطلب ✅:\n${mergedAddsTxt.join('\n')}`);
    }
  }

  const pureUnknowns = analysis.unknownItems.filter((u) => !u.uncertain && !(u.suggestions && u.suggestions.length));
  if (pureUnknowns.length) {
    const unkLabels = pureUnknowns.map((u) => u.query || u.rawSg);
    parts.push(`لم أجد في الكتالوج: «${unkLabels.join('»، «')}» — ممكن توضّح اسم الصنف المطلوب؟`);
  }

  const extraWarnings = analysis.warnings.filter((w) => !/لم أجد صنفاً/.test(w));
  if (extraWarnings.length) {
    parts.push(extraWarnings.join('\n'));
  }

  if (analysis.pendingTasks.length) {
    const firstTask = analysis.pendingTasks[0];
    nextState.pendingClarification = firstTask;
    nextState.pendingQueue = analysis.pendingTasks.slice(1);
    const ask = buildClarificationPromptAndQuick(firstTask, products, unit);
    if (ask.reply) parts.push(ask.reply);
    if (analysis.pendingTasks.length > 1) {
      const remLabels = analysis.pendingTasks
        .slice(1)
        .map((qt) => qt.query || (qt.prodIdx != null && products[qt.prodIdx] ? getProductDisplayName(products[qt.prodIdx]) : 'صنف آخر'));
      parts.push(`(وبعدها هنكمّل تحديد: ${remLabels.join('، ')})`);
    }
    if (ask.quick && ask.quick.length) quick = ask.quick;
  } else {
    nextState.pendingClarification = null;
    nextState.pendingQueue = [];
    if (addedMsgs.length && (analysis.unknownItems.length || analysis.warnings.length)) {
      parts.push(formatOrderSummaryReply('', finalDraft, kb));
      quick = [
        { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
        { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
      ];
    } else if (!addedMsgs.length && !quick.length) {
      if (analysis.hasSizeUncertainty) {
        parts.push('مفيش مشكلة لو مش فاكر الأحجام، قولي اسم الصنف اللي تحب نبدأ بيه أو اختار من الأصناف المتاحة.');
      }
      quick = Object.keys(kb.cats)
        .slice(0, 6)
        .map((c) => ({ label: `قسم ${c}`, val: `عندكم إيه في ${c}` }));
    }
  }

  return {
    reply:
      parts.filter(Boolean).join('\n\n') ||
      'ما قدرتش أحدد صنف واضح من رسالتك 😊 اكتب اسم الصنف والكمية أو اسأل «عندكم أصناف إيه؟».',
    draft: finalDraft,
    nextState,
    go: false,
    quick,
  };
}

// ==================== ADMIN CATALOG ENGINE ====================

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

export function resolveAdminTargets(where, catalogData = {}) {
  const products = Array.isArray(catalogData.p) ? catalogData.p : [];
  const cats = Array.isArray(catalogData.cats) ? catalogData.cats : [];
  if (!where || typeof where !== 'object') return { indices: [], ambiguous: false };

  const catMatch = (rawCat) => {
    const k = rn(rawCat);
    if (!k) return null;
    const ex = cats.find((c) => rn(c) === k);
    if (ex) return ex;
    return cats.find((c) => rn(c).includes(k) || k.includes(rn(c))) || null;
  };

  // Direct verified index
  if (Number.isInteger(where.index) && products[where.index]) {
    const candidate = products[where.index];
    if (!where.name || rn(candidate[0]).includes(rn(where.name)) || rn(where.name).includes(rn(candidate[0]))) {
      return { indices: [where.index], ambiguous: false };
    }
  }

  const resolvedCat = where.category ? catMatch(where.category) : null;
  const namesList = Array.isArray(where.name)
    ? where.name.map(String).filter(Boolean)
    : where.name
    ? [String(where.name)]
    : [];
  const varNorm = where.variant ? rn(where.variant) : '';
  const packNorm = where.pack ? rn(where.pack) : '';
  const flNorm = where.flavor ? rn(where.flavor) : '';

  const matched = [];
  const exactNameIndices = [];

  products.forEach((p, idx) => {
    if (!p || !p[0]) return;
    if (where.category) {
      if (!resolvedCat || rn(p[1]) !== rn(resolvedCat)) return;
    }
    if (where.flavor) {
      const fl = getProductFlavors(p);
      if (!fl.some((f) => rn(f[0]).includes(flNorm) || flNorm.includes(rn(f[0])))) return;
    }
    if (where.variant) {
      if (!rn(p[10] || '').includes(varNorm)) return;
    }
    if (where.pack) {
      if (!rn(p[2] || '').includes(packNorm)) return;
    }
    if (where.minPrice != null && isFinite(Number(where.minPrice))) {
      if (!(Number(p[3]) >= Number(where.minPrice))) return;
    }
    if (where.maxPrice != null && isFinite(Number(where.maxPrice))) {
      if (!(Number(p[3]) <= Number(where.maxPrice))) return;
    }
    if (where.hidden === true || where.hidden === false) {
      if (Boolean(p[7]) !== where.hidden) return;
    }

    if (namesList.length) {
      const pName = rn(p[0]);
      const pFull = rn(getProductDisplayName(p));
      let hitExact = false;
      let hitPartial = false;

      for (const rawN of namesList) {
        const qN = rn(rawN);
        const qToks = ntk(rawN).filter((t) => !RSTOP_SET.has(t));
        const pToks = ntk(p[0] + ' ' + (p[10] || ''));
        if (pName === qN || pFull === qN) {
          hitExact = true;
        } else if (qToks.length && qToks.every((qt) => tokSim(qt, pToks) >= 0.88)) {
          hitPartial = true;
        } else if (pName.includes(qN)) {
          hitPartial = true;
        }
      }
      if (!hitExact && !hitPartial) return;
      if (hitExact) exactNameIndices.push(idx);
      matched.push(idx);
    } else if (where.all === true || where.category || where.flavor || where.variant || where.pack || where.hidden !== undefined || where.minPrice != null || where.maxPrice != null) {
      matched.push(idx);
    }
  });

  // If user named a single specific product (not explicit all/bulk) and multiple products match:
  // e.g., "شيبسي" matches both "شيبسي صغير" and "شيبسي عائلي", OR exact "شيبسي" + partial "شيبسي عائلي"
  if (namesList.length && !where.all && matched.length > 1) {
    // If exactly 1 product has exact base name AND user didn't leave out variant? Wait:
    // If catalog has "شيبسي" (exact) AND "شيبسي عائلي" (partial), check if there's only 1 exact match vs multiple!
    // Wait: prompt test 9 specifically tests: "حذف منتج له اسم مشابه لمنتج آخر (مثل شيبسي و شيبسي عائلي)" ->
    // if admin says "احذف منتج شيبسي", exact match is "شيبسي", NOT "شيبسي عائلي"!
    if (exactNameIndices.length === 1 && !varNorm) {
      return { indices: exactNameIndices, ambiguous: false, partialIgnored: matched.filter((i) => i !== exactNameIndices[0]) };
    }
    return { indices: matched, ambiguous: true };
  }

  return { indices: matched, ambiguous: false };
}

export function previewAndValidateAdminOps({
  ops = [],
  catalogData = {},
  opId = '',
}) {
  const clone = JSON.parse(JSON.stringify(catalogData || {}));
  clone.p = Array.isArray(clone.p) ? clone.p : [];
  clone.cats = Array.isArray(clone.cats) ? clone.cats : [];
  clone.offers = Array.isArray(clone.offers) ? clone.offers : [];

  const lines = [];
  const needsClarification = [];
  const errors = [];
  let changedCount = 0;
  let deleteCount = 0;
  const resolvedOps = [];

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.type === 'product') {
      const targetRes =
        Array.isArray(op.resolvedIndices) && op.resolvedIndices.length
          ? { indices: op.resolvedIndices.filter((idx) => Boolean(clone.p[idx])), ambiguous: false }
          : resolveAdminTargets(op.where, clone);
      if (!targetRes.indices.length) {
        errors.push(`لم يتم العثور على أصناف مطابقة للشرط.`);
        continue;
      }
      if (targetRes.ambiguous) {
        needsClarification.push({
          op,
          candidates: targetRes.indices.map((idx) => ({
            idx,
            label: getProductDisplayName(clone.p[idx]),
            category: clone.p[idx][1],
            price: Number(clone.p[idx][3] || 0),
            pack: clone.p[idx][2] || '',
          })),
        });
        continue;
      }

      const d = op.do || {};
      const indicesToApply = targetRes.indices;
      // Pin resolved indices so execution affects exact verified products
      const pinnedOp = {
        ...op,
        resolvedIndices: indicesToApply,
      };
      resolvedOps.push(pinnedOp);

      for (const idx of indicesToApply) {
        const p = clone.p[idx];
        if (!p) continue;
        const label = getProductDisplayName(p);
        if (d.delete === true) {
          const flTxt = getProductFlavors(p).map((f) => f[0]).join('، ');
          lines.push(
            `🗑 حذف: ${label} | القسم: ${p[1] || '—'} | السعر: ${p[3]} ج` +
              (p[2] ? ` | العبوة: ${p[2]}` : '') +
              (flTxt ? ` | النكهات: ${flTxt}` : '')
          );
          deleteCount += 1;
          changedCount += 1;
          continue;
        }

        const oldPrice = Number(p[3] || 0);
        let newPrice = oldPrice;
        if (d.setPrice != null && isFinite(Number(d.setPrice))) newPrice = Number(d.setPrice);
        if (d.addPrice != null && isFinite(Number(d.addPrice))) newPrice += Number(d.addPrice);
        if (d.pctPrice != null && isFinite(Number(d.pctPrice))) newPrice *= 1 + Number(d.pctPrice) / 100;
        if (d.discountPct != null && isFinite(Number(d.discountPct))) {
          const base = Number(p[11] || 0) > oldPrice ? Number(p[11]) : oldPrice;
          newPrice = base * (1 - Number(d.discountPct) / 100);
        }
        newPrice = Math.round(newPrice * 100) / 100;

        if (!(newPrice > 0)) {
          errors.push(`السعر الناتج للصنف «${label}» غير صالح (${newPrice}).`);
          continue;
        }

        const changes = [];
        if (newPrice !== oldPrice) changes.push(`السعر: ${oldPrice} ج ← ${newPrice} ج`);
        if (d.setOldPrice != null && isFinite(Number(d.setOldPrice)) && Number(d.setOldPrice) !== Number(p[11] || 0)) {
          changes.push(`السعر القديم: ${Number(p[11] || 0)} ج ← ${Number(d.setOldPrice)} ج`);
        }
        if (d.setName && String(d.setName).trim() && String(d.setName).trim() !== p[0]) {
          changes.push(`الاسم: «${p[0]}» ← «${String(d.setName).trim()}»`);
        }
        if (d.setVariant != null && String(d.setVariant).trim() !== (p[10] || '')) {
          changes.push(`الحجم: «${p[10] || '—'}» ← «${String(d.setVariant).trim()}»`);
        }
        if (d.setPack != null && String(d.setPack).trim() !== (p[2] || '')) {
          changes.push(`العبوة: «${p[2] || '—'}» ← «${String(d.setPack).trim()}»`);
        }
        if (d.setCategory && String(d.setCategory).trim() !== p[1]) {
          changes.push(`القسم: «${p[1]}» ← «${String(d.setCategory).trim()}»`);
        }
        if (d.hide === true && !p[7]) changes.push('الحالة: ظاهر ← مخفي');
        if (d.hide === false && p[7]) changes.push('الحالة: مخفي ← ظاهر');
        if (Array.isArray(d.addFlavors) && d.addFlavors.length) {
          changes.push(`إضافة نكهات: ${d.addFlavors.join('، ')}`);
        }
        if (Array.isArray(d.removeFlavors) && d.removeFlavors.length) {
          changes.push(`حذف نكهات: ${d.removeFlavors.join('، ')}`);
        }
        if (Array.isArray(d.hideFlavors) && d.hideFlavors.length) {
          changes.push(`إخفاء نكهات: ${d.hideFlavors.join('، ')}`);
        }
        if (Array.isArray(d.showFlavors) && d.showFlavors.length) {
          changes.push(`إظهار نكهات: ${d.showFlavors.join('، ')}`);
        }

        if (changes.length) {
          lines.push(`✏️ ${label}: ${changes.join(' | ')}`);
          changedCount += 1;
        }
      }
    } else if (op.type === 'category') {
      resolvedOps.push(op);
      const act = op.do || op.action;
      if (act === 'add') {
        const n = String(op.name || op.to || '').trim();
        if (n && !clone.cats.some((c) => rn(c) === rn(n))) {
          lines.push(`➕ إضافة قسم: «${n}»`);
          changedCount += 1;
        }
      } else if (act === 'rename') {
        lines.push(`🗂 تعديل اسم قسم «${op.from || op.name}» ← «${op.to}»`);
        changedCount += 1;
      } else if (act === 'delete') {
        const cName = clone.cats.find((c) => rn(c) === rn(op.from || op.name));
        if (cName) {
          const cnt = clone.p.filter((p) => p[1] === cName).length;
          lines.push(`🗑 حذف قسم «${cName}»` + (cnt ? ` (مع ${cnt} صنف)` : ''));
          deleteCount += Math.max(1, cnt);
          changedCount += 1;
        }
      }
    } else if (op.type === 'offer') {
      resolvedOps.push(op);
      const act = op.do || op.action;
      if (act === 'add' && op.title) {
        lines.push(`🎁 إضافة عرض: «${op.title}»`);
        changedCount += 1;
      }
    }
  }

  return {
    opId: opId || `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    valid: errors.length === 0 && needsClarification.length === 0 && changedCount > 0,
    n: changedCount,
    del: deleteCount,
    lines,
    ops: resolvedOps,
    needsClarification,
    errors,
  };
}

export function applyValidatedAdminOps(catalogData, ops = []) {
  const X = catalogData;
  X.p = Array.isArray(X.p) ? X.p : [];
  X.cats = Array.isArray(X.cats) ? X.cats : [];
  X.offers = Array.isArray(X.offers) ? X.offers : [];

  const R = { lines: [], n: 0, del: 0 };

  for (const op of ops || []) {
    if (!op || typeof op !== 'object') continue;
    if (op.type === 'product') {
      const d = op.do || {};
      let targetSet;
      if (Array.isArray(op.resolvedIndices) && op.resolvedIndices.length) {
        targetSet = new Set(op.resolvedIndices.filter((i) => Number.isInteger(i) && X.p[i]));
      } else {
        const res = resolveAdminTargets(op.where, X);
        if (res.ambiguous || !res.indices.length) continue;
        targetSet = new Set(res.indices);
      }

      const keep = [];
      X.p.forEach((p, idx) => {
        if (!targetSet.has(idx)) {
          keep.push(p);
          return;
        }
        if (d.delete === true) {
          R.lines.push(`🗑 حذف: ${getProductDisplayName(p)}`);
          R.del += 1;
          R.n += 1;
          return;
        }

        const beforeSnap = JSON.stringify(p);
        let pr = Number(p[3] || 0);
        let bo = Number(p[11] || 0);
        if (d.setPrice != null && isFinite(Number(d.setPrice))) pr = Number(d.setPrice);
        if (d.addPrice != null && isFinite(Number(d.addPrice))) pr += Number(d.addPrice);
        if (d.pctPrice != null && isFinite(Number(d.pctPrice))) pr *= 1 + Number(d.pctPrice) / 100;
        if (d.discountPct != null && isFinite(Number(d.discountPct))) {
          const bs = bo > pr ? bo : pr;
          bo = bs;
          pr = bs * (1 - Number(d.discountPct) / 100);
        }
        if (d.setOldPrice != null && isFinite(Number(d.setOldPrice))) bo = Number(d.setOldPrice);
        if (d.clearOldPrice === true) bo = 0;
        pr = Math.round(pr * 100) / 100;
        if (!(pr > 0)) {
          keep.push(p);
          return;
        }
        p[3] = pr;
        if (bo > pr || p.length > 11) p[11] = bo > pr ? bo : 0;
        if (d.setName && String(d.setName).trim()) p[0] = String(d.setName).trim();
        if (d.setCategory && String(d.setCategory).trim()) {
          const catN = String(d.setCategory).trim();
          const matchedC = X.cats.find((c) => rn(c) === rn(catN)) || catN;
          if (!X.cats.includes(matchedC)) X.cats.push(matchedC);
          p[1] = matchedC;
        }
        if (d.setPack != null) p[2] = String(d.setPack).trim();
        if (d.setVariant != null) p[10] = String(d.setVariant).trim();
        if (d.hide === true) p[7] = 1;
        else if (d.hide === false) p[7] = 0;

        // Flavor mutations
        let fl = getProductFlavors(p);
        if (Array.isArray(d.addFlavors) && d.addFlavors.length) {
          d.addFlavors.forEach((rawF) => {
            const cleanF = String(rawF || '').trim();
            if (cleanF && !fl.some((f) => rn(f[0]) === rn(cleanF))) {
              fl.push([cleanF, 0]);
            }
          });
          p[9] = fl;
        }
        if (Array.isArray(d.removeFlavors) && d.removeFlavors.length) {
          const rmSet = d.removeFlavors.map((x) => rn(x)).filter(Boolean);
          fl = fl.filter((f) => !rmSet.some((r) => rn(f[0]) === r || rn(f[0]).includes(r)));
          p[9] = fl;
        }
        if (Array.isArray(d.hideFlavors) && d.hideFlavors.length) {
          const hdSet = d.hideFlavors.map((x) => rn(x)).filter(Boolean);
          fl.forEach((f) => {
            if (hdSet.some((r) => rn(f[0]) === r || rn(f[0]).includes(r))) f[1] = 1;
          });
          p[9] = fl;
        }
        if (Array.isArray(d.showFlavors) && d.showFlavors.length) {
          const shSet = d.showFlavors.map((x) => rn(x)).filter(Boolean);
          fl.forEach((f) => {
            if (shSet.some((r) => rn(f[0]) === r || rn(f[0]).includes(r))) f[1] = 0;
          });
          p[9] = fl;
        }

        p[12] = new Date().toISOString();
        if (JSON.stringify(p) !== beforeSnap) {
          R.lines.push(`${getProductDisplayName(p)} ← ${p[3]} ج`);
          R.n += 1;
        }
        keep.push(p);
      });
      X.p = keep;
    } else if (op.type === 'category') {
      const act = op.do || op.action;
      if (act === 'add') {
        const n = String(op.name || op.to || '').trim();
        if (n && !X.cats.some((c) => rn(c) === rn(n))) {
          X.cats.push(n);
          R.lines.push(`➕ قسم جديد: ${n}`);
          R.n += 1;
        }
      } else if (act === 'rename') {
        const oldC = X.cats.find((c) => rn(c) === rn(op.from || op.name));
        const newC = String(op.to || '').trim();
        if (oldC && newC && oldC !== newC) {
          X.p.forEach((p) => {
            if (p[1] === oldC) p[1] = newC;
          });
          X.cats[X.cats.indexOf(oldC)] = newC;
          R.lines.push(`🗂 تعديل قسم «${oldC}» ← «${newC}»`);
          R.n += 1;
        }
      } else if (act === 'delete') {
        const c = X.cats.find((x) => rn(x) === rn(op.from || op.name));
        if (c) {
          const rmCount = X.p.filter((p) => p[1] === c).length;
          X.p = X.p.filter((p) => p[1] !== c);
          X.cats.splice(X.cats.indexOf(c), 1);
          R.lines.push(`🗑 حذف قسم «${c}»`);
          R.del += rmCount || 1;
          R.n += 1;
        }
      }
    } else if (op.type === 'offer') {
      const act = op.do || op.action;
      if (act === 'add' && String(op.title || '').trim()) {
        X.offers.push({
          t: String(op.title).trim(),
          d: String(op.desc || ''),
          pr: String(op.price || ''),
          g: String(op.badge || ''),
          c: '#ffd23f',
          i: '',
          x: 0,
        });
        R.lines.push(`🎁 عرض جديد: ${op.title}`);
        R.n += 1;
      }
    }
  }
  return R;
}

// Local deterministic parser for Admin AI commands (works without Gemini!)
export function parseAdminLocalTurn({
  text,
  catalogData = {},
  currentDraft = [],
  pendingClarification = null,
}) {
  const products = Array.isArray(catalogData.p) ? catalogData.p : [];
  const cats = Array.isArray(catalogData.cats) ? catalogData.cats : [];
  const n = rn(text).replace(/[؟?!.،,;:"'«»]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nextDraft = JSON.parse(JSON.stringify(currentDraft || []));

  // 0) Handle pending clarification in admin chat
  if (pendingClarification) {
    if (pendingClarification.type === 'disambiguate_op' && Array.isArray(pendingClarification.candidates)) {
      const cands = pendingClarification.candidates;
      let chosenIndices = [];
      if (/^(?:كلهم|الكل|جميعهم)$/.test(n)) {
        chosenIndices = cands.map((c) => c.idx);
      } else if (/^(?:الاول|1)$/.test(n) && cands[0]) {
        chosenIndices = [cands[0].idx];
      } else if (/^(?:التاني|الثاني|2)$/.test(n) && cands[1]) {
        chosenIndices = [cands[1].idx];
      } else if (/^(?:التالت|الثالث|3)$/.test(n) && cands[2]) {
        chosenIndices = [cands[2].idx];
      } else {
        const toks = ntk(text).filter((t) => !RSTOP_SET.has(t));
        const matchedC = cands.filter((c) => {
          const ct = ntk(c.label + ' ' + c.category + ' ' + c.price);
          return toks.length && toks.every((qt) => tokSim(qt, ct) >= 0.85);
        });
        if (matchedC.length) chosenIndices = matchedC.map((c) => c.idx);
      }

      if (chosenIndices.length) {
        const pinnedOp = {
          ...pendingClarification.op,
          resolvedIndices: chosenIndices,
        };
        const preview = previewAndValidateAdminOps({ ops: [pinnedOp], catalogData });
        return {
          reply: `تم تحديد (${chosenIndices.length}) صنف:\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للمتابعة.`,
          draft: nextDraft,
          pendingOps: preview,
          pendingClarification: null,
          action: 'none',
        };
      }
    }

    if (pendingClarification.type === 'missing_price' && nextDraft[pendingClarification.draftIdx]) {
      const priceM = rnd(text).match(/(?:بسعر|سعر|بـ?)?\s*(\d+(?:\.\d+)?)/);
      if (priceM) {
        const item = nextDraft[pendingClarification.draftIdx];
        item.p = Number(priceM[1]);
        const catM = cats.find((c) => n.includes(rn(c)));
        if (catM) item.c = catM;
        const dup = checkProductDuplicates(item, products);
        let msg = `تم استكمال سعر «${item.n}» إلى ${item.p} ج ✅`;
        if (dup.exactMatches.length || dup.similarMatches.length) {
          msg += `\n⚠️ تنبيه تكرار: يوجد صنف مطابق/مشابه (${[...dup.exactMatches, ...dup.similarMatches].map((x) => x.label).join('، ')})`;
        }
        return {
          reply: msg,
          draft: nextDraft,
          pendingOps: null,
          pendingClarification: null,
          action: 'none',
        };
      }
    }
  }

  // 1) Query / List category / Search products ("اعرض منتجات قسم ..." / "ابحث عن منتجات تبدأ بـ ...")
  const listCatMatch = n.match(/(?:اعرض|عرض|وريني|شوف|هات)\s+(?:كل\s+)?(?:منتجات|اصناف)\s+(?:قسم\s+)?(.+)$/);
  if (listCatMatch) {
    const rawCat = listCatMatch[1].trim();
    const matchedCat = cats.find((c) => rn(c) === rn(rawCat) || rn(c).includes(rn(rawCat)) || rn(rawCat).includes(rn(c)));
    if (matchedCat) {
      const items = products
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p && rn(p[1]) === rn(matchedCat));
      return {
        reply: items.length
          ? `📦 أصناف قسم «${matchedCat}» (${items.length}):\n` +
            items.slice(0, 30).map(({ p }) => `• ${getProductDisplayName(p)} — ${p[3]} ج${p[7] ? ' (مخفي)' : ''}`).join('\n') +
            (items.length > 30 ? `\n... و${items.length - 30} صنف إضافي` : '')
          : `لا توجد أصناف في قسم «${matchedCat}» حالياً.`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: null,
        action: 'none',
      };
    }
  }

  const searchMatch = n.match(/(?:ابحث|دور|بحث)\s+(?:عن\s+)?(?:منتجات|اصناف)?\s*(?:تبدا\s+ب|باسم|عن)?\s*(.+)$/);
  if (searchMatch) {
    const qStr = rn(searchMatch[1]);
    const startsWithMode = /(?:تبدا\s+ب|تبدأ\s+ب)/.test(n);
    const hits = products
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        if (!p || !p[0]) return false;
        const pn = rn(p[0]);
        return startsWithMode ? pn.startsWith(qStr) : pn.includes(qStr) || rn(getProductDisplayName(p)).includes(qStr);
      });
    return {
      reply: hits.length
        ? `🔍 نتائج البحث عن «${qStr}» (${hits.length}):\n` +
          hits.slice(0, 25).map(({ p }) => `• ${getProductDisplayName(p)} (${p[1]}) — ${p[3]} ج`).join('\n')
        : `لم أجد أصنافاً مطابقة لـ «${qStr}».`,
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  // 2) Add / Remove flavors ("ضيف نكهة باربكيو لمنتج جاجوار" / "شيل نكهة شطة من جاجوار")
  const addFlavorM = n.match(/^(?:ضيف|اضف|زود)\s+(?:نكهه|نكهات|طعم)\s+(.+?)\s+(?:لـ?منتج|لـ?صنف|ل|علي|على|في)\s+(.+)$/);
  if (addFlavorM) {
    const newFlavors = addFlavorM[1].split(/[,،]+|\s+و\s+/).map((s) => s.trim()).filter(Boolean);
    const prodName = addFlavorM[2].trim();
    const op = { type: 'product', where: { name: prodName }, do: { addFlavors: newFlavors } };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `لقيت أكتر من منتج مطابق لـ «${prodName}»، تقصد أنهي واحد؟\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} (${c.category}) — ${c.price} ج`).join('\n'),
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `مقترح تعديل النكهات (${preview.n}):\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
    return {
      reply: preview.errors.join('\n') || `لم أجد صنفاً باسم «${prodName}».`,
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  const rmFlavorM = n.match(/^(?:شيل|احذف|امسح|الغي)\s+(?:نكهه|نكهة|طعم)\s+(.+?)\s+(?:من\s+(?:منتج|صنف)?|من)\s+(.+)$/);
  if (rmFlavorM) {
    const rmFlavors = rmFlavorM[1].split(/[,،]+|\s+و\s+/).map((s) => s.trim()).filter(Boolean);
    const prodName = rmFlavorM[2].trim();
    const op = { type: 'product', where: { name: prodName }, do: { removeFlavors: rmFlavors } };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `لقيت أكتر من منتج مطابق لـ «${prodName}»، تقصد أنهي واحد؟\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} (${c.category}) — ${c.price} ج`).join('\n'),
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `مقترح حذف النكهة (${preview.n}):\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
    return {
      reply: preview.errors.join('\n') || `لم أجد الصنف أو النكهة المطلوبة.`,
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  const visFlavorM = n.match(/^(اخفي|اخفاء|اظهر|اظهار)\s+(?:نكهه|نكهة|طعم)\s+(.+?)\s+(?:في|من|لـ?منتج|لـ?صنف|ل)\s+(.+)$/);
  if (visFlavorM) {
    const hideF = visFlavorM[1].startsWith('اخف');
    const flList = visFlavorM[2].split(/[,،]+|\s+و\s+/).map((s) => s.trim()).filter(Boolean);
    const prodName = visFlavorM[3].trim();
    const op = {
      type: 'product',
      where: { name: prodName },
      do: hideF ? { hideFlavors: flList } : { showFlavors: flList },
    };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `لقيت أكتر من منتج مطابق لـ «${prodName}»، تقصد أنهي واحد؟\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} (${c.category}) — ${c.price} ج`).join('\n'),
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `مقترح ${hideF ? 'إخفاء' : 'إظهار'} النكهة (${preview.n}):\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
    return {
      reply: preview.errors.join('\n') || `لم أجد الصنف أو النكهة المطلوبة.`,
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  // 3) Hide / Show product ("اخفي منتج دوريتوس" / "اظهر منتج دوريتوس")
  const visM = n.match(/^(اخفي|اخفاء|اظهر|اظهار)\s+(?:منتج|صنف)?\s*(.+)$/);
  if (visM) {
    const hide = visM[1].startsWith('اخف');
    const targetName = visM[2].trim();
    const op = { type: 'product', where: { name: targetName }, do: { hide } };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `لقيت أكتر من منتج مطابق لـ «${targetName}»:\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} — ${c.price} ج`).join('\n'),
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
  }

  // 4) Delete product ("احذف منتج شيبسي" / "احذف المنتج الكبير")
  const delM = n.match(/^(?:احذف|شيل|امسح)\s+(?:المنتج|منتج|صنف|الصنف)?\s*(.+)$/);
  if (delM) {
    const rawTarget = delM[1].trim();
    const targetName = rawTarget.replace(/^ال/, '').trim() || rawTarget;
    const VAGUE_DEL_WORDS = new Set([
      'كبير',
      'صغير',
      'وسط',
      'عائلي',
      'جامبو',
      'جديد',
      'قديم',
      'غالي',
      'رخيص',
      'اول',
      'اخير',
      'تاني',
      'ثاني',
      'ده',
      'دي',
      'دا',
      'منتج',
      'صنف',
      'حاجه',
    ]);
    const hasExactBaseName = products.some((p) => p && rn(p[0]) === rn(targetName));
    if (VAGUE_DEL_WORDS.has(rn(targetName)) && !hasExactBaseName) {
      const candRes = resolveAdminTargets({ name: targetName }, catalogData);
      const cands = candRes.indices.map((idx) => ({
        idx,
        label: getProductDisplayName(products[idx]),
        category: products[idx][1],
        price: Number(products[idx][3] || 0),
        pack: products[idx][2] || '',
      }));
      if (cands.length) {
        return {
          reply:
            `الطلب «${rawTarget}» غير محدد. اكتب اسم الصنف بالكامل أو اختر رقم الصنف المقصود للحذف:\n` +
            cands.map((c, k) => `${k + 1}) ${c.label} (${c.category}) — ${c.price} ج`).join('\n'),
          draft: nextDraft,
          pendingOps: null,
          pendingClarification: {
            type: 'disambiguate_op',
            op: { type: 'product', where: { name: targetName }, do: { delete: true } },
            candidates: cands,
          },
          action: 'none',
        };
      }
      return {
        reply: `الطلب «${rawTarget}» غير محدد. من فضلك اكتب اسم المنتج المطلوب حذفه بالكامل.`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: null,
        action: 'none',
      };
    }

    const where = { name: rawTarget };
    let preview = previewAndValidateAdminOps({ ops: [{ type: 'product', where, do: { delete: true } }], catalogData });
    if (!preview.valid && !preview.needsClarification.length && targetName !== rawTarget) {
      preview = previewAndValidateAdminOps({ ops: [{ type: 'product', where: { name: targetName }, do: { delete: true } }], catalogData });
    }
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `يوجد أكثر من صنف مطابق، حدد أي صنف تريد حذفه:\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} (${c.category}) — ${c.price} ج`).join('\n'),
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op: nc.op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `⚠️ تأكيد الحذف المطلوب:\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للمتابعة.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
    return {
      reply: `لم يتم العثور على صنف واضح باسم «${delM[1].trim()}» للحذف.`,
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  // 5) Bulk / Single price edit ("زود كل منتجات قسم المشروبات 10 جنيه" / "عدل سعر شيبسي لـ 150")
  const bulkPriceM = n.match(
    /^(?:زود|زودلي|نقص|قلل)\s+(?:كل\s+)?(?:منتجات|اصناف)\s+(?:قسم\s+)?(.+?)\s+(?:بـ?\s*)?(\d+(?:\.\d+)?)\s*(?:جنيه|ج|%)?$/
  );
  if (bulkPriceM) {
    const catQ = bulkPriceM[1].trim();
    const amt = Number(bulkPriceM[2]);
    const isDec = /^(?:نقص|قلل)/.test(n);
    const isPct = text.includes('%') || text.includes('٪');
    const matchedCat = cats.find((c) => rn(c) === rn(catQ) || rn(c).includes(rn(catQ)) || rn(catQ).includes(rn(c)));
    if (!matchedCat) {
      return {
        reply: `لم أجد قسماً باسم «${catQ}». الأقسام الموجودة: ${cats.join('، ')}`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: null,
        action: 'none',
      };
    }
    const doObj = isPct
      ? { pctPrice: isDec ? -amt : amt }
      : { addPrice: isDec ? -amt : amt };
    const op = { type: 'product', where: { category: matchedCat, all: true }, do: doObj };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.valid) {
      return {
        reply: `سيتم تعديل (${preview.n}) صنف في قسم «${matchedCat}»:\n${preview.lines.slice(0, 15).join('\n')}${preview.lines.length > 15 ? `\n... و${preview.lines.length - 15} صنف آخر` : ''}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
  }

  const singlePriceM = n.match(/^(?:عدل|غير|خلي|اضبط)\s+سعر\s+(.+?)\s+(?:لـ|ل|لي|الي|إلى|بـ|ب)?\s*(\d+(?:\.\d+)?)\s*(?:جنيه|ج)?$/);
  if (singlePriceM) {
    const prodQ = singlePriceM[1].trim();
    const newPr = Number(singlePriceM[2]);
    const op = { type: 'product', where: { name: prodQ }, do: { setPrice: newPr } };
    const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
    if (preview.needsClarification.length) {
      const nc = preview.needsClarification[0];
      return {
        reply:
          `يوجد أكثر من صنف مطابق لـ «${prodQ}»:\n` +
          nc.candidates.map((c, k) => `${k + 1}) ${c.label} — السعر الحالي ${c.price} ج`).join('\n') +
          `\nاختر الرقم أو الحجم المقصود (أو اكتب «كلهم»).`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
        action: 'none',
      };
    }
    if (preview.valid) {
      return {
        reply: `تعديل السعر المقترح:\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
        draft: nextDraft,
        pendingOps: preview,
        pendingClarification: null,
        action: 'none',
      };
    }
  }

  // 5b) Edit pack / variant / oldPrice / name for an existing product
  const rawDigitsText = String(text || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();
  const fieldEditM = rawDigitsText.match(
    /^(?:عدّل|عدل|غيّر|غير|خلّي|خلي|اضبط)\s+(العبوة|العبوه|عبوة|عبوه|الحجم|النوع|السعر القديم|الاسم|اسم(?:\s+منتج)?)\s+(?:لـ?|بتاع|متاع)?\s*(.+?)\s+(?:لـ|ل|لي|الي|إلى|بـ|ب)\s+(.+)$/
  );
  if (fieldEditM) {
    const fld = rn(fieldEditM[1]);
    const prodQ = fieldEditM[2].trim();
    const newVal = fieldEditM[3].trim();
    const doObj = {};
    if (/عبوه/.test(fld)) doObj.setPack = newVal;
    else if (/حجم|نوع/.test(fld)) doObj.setVariant = newVal;
    else if (/سعر.*قديم|قديم/.test(fld)) {
      const nVal = parseFloat(rnd(newVal));
      if (isFinite(nVal)) doObj.setOldPrice = nVal;
    } else if (/اسم/.test(fld)) doObj.setName = newVal;

    if (Object.keys(doObj).length) {
      const op = { type: 'product', where: { name: prodQ }, do: doObj };
      const preview = previewAndValidateAdminOps({ ops: [op], catalogData });
      if (preview.needsClarification.length) {
        const nc = preview.needsClarification[0];
        return {
          reply:
            `يوجد أكثر من صنف مطابق لـ «${prodQ}»:\n` +
            nc.candidates.map((c, k) => `${k + 1}) ${c.label} — ${c.price} ج`).join('\n'),
          draft: nextDraft,
          pendingOps: null,
          pendingClarification: { type: 'disambiguate_op', op, candidates: nc.candidates },
          action: 'none',
        };
      }
      if (preview.valid) {
        return {
          reply: `التعديل المقترح:\n${preview.lines.join('\n')}\nاضغط «تنفيذ» للتأكيد.`,
          draft: nextDraft,
          pendingOps: preview,
          pendingClarification: null,
          action: 'none',
        };
      }
    }
  }

  // 6) Add one or multiple products (supports full natural speech, pack, oldPrice, variant, multi-variant prices, emoji, and multi-flavor single-product grouping)
  const normalizeDigitsOnly = (str) =>
    String(str || '')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  const inferEmoji = (nameStr, catStr) => {
    const ref = rn(nameStr + ' ' + catStr);
    if (/دوريتوس/.test(ref)) return '🔺';
    if (/شيبسي|بطاطس/.test(ref)) return '🥔';
    if (/ذره|فشار/.test(ref)) return '🍿';
    if (/عصير|مشروب|بيبسي|كولا|صودا|مياه/.test(ref)) return '🧃';
    if (/شوكولات|شيكولات|كاكاو|فريسكا/.test(ref)) return '🍫';
    if (/مولتو|كرواسون/.test(ref)) return '🥐';
    if (/بسكويت|ويفر|كوكيز/.test(ref)) return '🍪';
    if (/لب|سوداني|مكسرات/.test(ref)) return '🥜';
    if (/حلويات|كاندي|مصاص|لبان/.test(ref)) return '🍬';
    if (/سناكس|كرانشي|كراتيه|جاجوار/.test(ref)) return '🥨';
    return '🥔';
  };

  const splitFlavorStrings = (raw) => {
    const outF = [];
    const seenF = new Set();
    const rawStr = String(raw || '');
    const hasPunctSep = /[,،؛;\/|\n]/.test(rawStr);
    const isOnlyCompound = /^\s*(?:ملح\s+و\s*خل|خل\s+و\s*ملح)\s*$/i.test(rawStr);
    const cleaned = (hasPunctSep || isOnlyCompound)
      ? rawStr.replace(/ملح\s+و\s*خل/g, 'ملح_وخل').replace(/خل\s+و\s*ملح/g, 'خل_وملح')
      : rawStr;
    cleaned.split(/[,،؛;\/|\n]+|\s+و(?=\S)/).forEach((tok) => {
      let y = tok
        .replace(/ملح_وخل/g, 'ملح وخل')
        .replace(/خل_وملح/g, 'خل وملح')
        .replace(/^(?:وطعم|طعم|نكهة|نكهه)\s+/, '')
        .replace(/[.\u061B،,]+$/g, '')
        .trim();
      const k = rn(y);
      if (y && k && !seenF.has(k)) {
        seenF.add(k);
        outF.push(y);
      }
    });
    return outF;
  };

  const parseAdminProductBlock = (rawBlock) => {
    let s = normalizeDigitsOnly(rawBlock)
      .replace(/^(?:انا |أنا )?(?:عندي|ضيفلي|ضيف|أضف|اضف|اضافة|إضافة)\s+(?:منتج\s+|صنف\s+)?/i, '')
      .trim();
    if (!s || s.length < 2) return [];

    let oldPrice = 0;
    const oldPm = s.match(/(?:بدل(?:\s+من)?|قبل الخصم|السعر القديم|كان بـ?)\s*:?\s*(\d+(?:\.\d+)?)(?:\s*(?:جنيه|جنية|ج))?/i);
    if (oldPm) {
      oldPrice = Number(oldPm[1]);
      s = s.replace(oldPm[0], ' ');
    }

    // Extract flavors
    let flavors = [];
    const flRe = /(?:و?\s*عنده\s+|و?\s*فيه\s+|بـ?\s*)?(?:النكهات|نكهات|الطعوم|طعوم|الأطعمة|الاطعمة|الطعم|طعم|نكهة|نكهه)\s*(?:هي|هم|كالتالي)?\s*:?\s*(.+?)(?=[\s,،]*(?:(?:في\s+)?(?:القسم|قسم)|العبوة|عبوة|الحجم|النوع|بسعر|سعره|سعرها|سعر|بدل|قبل الخصم|كرتونة|كرتونه|الكرتونة|الكرتونه|دستة|شوال)(?:[\s:،,]|$)|$)/;
    const fm = s.match(flRe);
    if (fm) {
      const flRaw = fm[1].trim();
      if (!/^(?:واحد|اتنين|\d+)\s*(?:طعم|نكهة)/.test(rn(flRaw))) {
        flavors = splitFlavorStrings(flRaw);
      }
      s = s.replace(fm[0], ' ');
    }

    // Extract category (stop cleanly at commas or other field keywords)
    let cat = '';
    const cm = s.match(/(?:في\s+)?(?:القسم|قسم)\s*:?\s*([^,،\n]+?)(?=\s+(?:العبوة|عبوة|الحجم|النوع|النكهات|نكهات|الطعوم|طعم|نكهة|بسعر|سعر|الكرتونة|كرتونة|الكرتونه|كرتونه|دستة|شوال)(?:[\s:،,]|$)|[,،\n]|$)/);
    if (cm) {
      const rawC = cm[1].replace(/\s*(?:جنيه|جنية|ج)\s*$/g, '').trim();
      cat = cats.find((c) => rn(c) === rn(rawC) || rn(c).includes(rn(rawC)) || rn(rawC).includes(rn(c))) || rawC;
      s = s.replace(cm[0], ' ');
    }

    // Extract pack
    let pack = '';
    const pkExplicit = s.match(/(?:العبوة|عبوة|الوصف)\s*:?\s*([^,،\n]+?)(?=\s+(?:القسم|قسم|النكهات|نكهات|الطعم|طعم|الحجم|النوع|بسعر|سعر)(?:[\s:،,]|$)|[,،\n]|$)/);
    if (pkExplicit) {
      pack = pkExplicit[1].trim();
      s = s.replace(pkExplicit[0], ' ');
    } else {
      const pkAuto = s.match(/(?:ال)?(?:كرتونة|كرتونه|دستة|شوال|علبة|باكو)\s*\d+\s*(?:كيس|علبة|قطعة|حبة|باكو|زجاجة|عبوة)?/);
      if (pkAuto) {
        pack = pkAuto[0].trim();
        s = s.replace(pkAuto[0], ' ');
      }
    }

    // Check for multi-variant price specs in the same block (e.g., "دوريتوس صغير بـ 100 ووسط بـ 150")
    const varPairs = [];
    const vpRe = /(?:الحجم\s+|النوع\s+|حجم\s+|نوع\s+)?(?:و\s*)?(?:ال)?(صغير|وسط|متوسط|كبير|عائلي|جامبو|ميني|اقتصادي|سوبر|عادي)\s*(?:بسعر|السعر|سعره|سعرها|سعر|بـ|ب)\s*:?\s*(\d+(?:\.\d+)?)(?:\s*(?:جنيه|جنية|ج|egp))?/gi;
    let vpMatch;
    while ((vpMatch = vpRe.exec(s)) !== null) {
      varPairs.push({ full: vpMatch[0], variant: vpMatch[1].trim(), price: Number(vpMatch[2]), idx: vpMatch.index });
    }
    if (varPairs.length >= 2) {
      let baseName = s;
      varPairs.forEach((vp) => {
        baseName = baseName.replace(vp.full, ' ');
      });
      baseName = baseName
        .replace(/[,،:؛;]+/g, ' ')
        .replace(/(?:^|\s)(?:و|جنيه|جنية|في|عنده|بسعر|سعره|سعرها)(?=\s|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (baseName) {
        if (!cat) {
          const cf = cats.filter((c) => rn(rawBlock).includes(rn(c)));
          if (cf.length === 1) cat = cf[0];
        }
        return varPairs.map((vp) => ({
          n: baseName,
          c: cat || '',
          d: pack,
          p: vp.price,
          o: oldPrice,
          v: vp.variant,
          e: inferEmoji(baseName, cat),
          f: flavors.slice(),
          on: 1,
          w: [],
        }));
      }
    }

    // Single price extraction
    let price = 0;
    const pm1 = s.match(/(?:^|[\s,،])(?:بسعر|السعر|سعره|سعرها|سعر|بـ)\s*:?\s*(\d+(?:\.\d+)?)(?:\s*(?:جنيه|جنية|ج|egp))?(?=[\s,،.]|$)/i);
    if (pm1) {
      price = Number(pm1[1]);
      s = s.replace(pm1[0], ' ');
    } else {
      const pm2 = s.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|جنية|egp)(?=[\s,،.]|$)/i);
      if (pm2) {
        price = Number(pm2[1]);
        s = s.replace(pm2[0], ' ');
      }
    }

    // Extract single variant if present
    let variant = '';
    const vm = s.match(/(?:الحجم|النوع|حجم|نوع)\s*:?\s*([^,،\n]+?)(?=\s+(?:القسم|قسم|العبوة|عبوة|النكهات|نكهات|بسعر|سعر)(?:[\s:،,]|$)|[,،\n]|$)/);
    if (vm) {
      variant = vm[1].trim();
      s = s.replace(vm[0], ' ');
    }

    const name = s
      .replace(/[,،:؛;]+/g, ' ')
      .replace(/(?:^|\s)(?:الصنف|صنف|اسم الصنف|اسمه|اسمها|اسم|جنيه|جنية|وعنده|وفيه|عنده|فيه)(?=\s|$)/g, ' ')
      .replace(/\s*(?:و|في)\s*$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return [];

    if (!cat) {
      const cf = cats.filter((c) => rn(rawBlock).includes(rn(c)));
      if (cf.length === 1) cat = cf[0];
    }

    return [
      {
        n: name,
        c: cat || '',
        d: pack,
        p: price,
        o: oldPrice > price ? oldPrice : 0,
        v: variant,
        e: inferEmoji(name, cat),
        f: flavors,
        on: 1,
        w: [],
      },
    ];
  };

  if (/^(?:انا\s+|أنا\s+)?(?:ضيفلي|ضيف|أضف|اضف|اضافة|إضافة|عندي)\s+/.test(n)) {
    const rawNormalized = normalizeDigitsOnly(text).replace(/\r/g, '');
    const blocks = rawNormalized
      .split(/\n+|[,،]?\s+(?=(?:وكمان\s+|كمان\s+)?(?:ضيفلي|ضيف|أضف|اضف)\s+)/)
      .map((b) => b.trim())
      .filter((b) => b.length >= 2);

    const parsedItems = [];
    blocks.forEach((b) => {
      parseAdminProductBlock(b).forEach((item) => parsedItems.push(item));
    });

    if (!parsedItems.length) {
      return {
        reply: 'اكتب اسم الصنف المطلوب إضافته.',
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: null,
        action: 'none',
      };
    }

    let firstMissingPriceIdx = -1;
    const summaryLines = [];
    const warnLines = [];

    parsedItems.forEach((item) => {
      const dup = checkProductDuplicates(item, products);
      if (dup.exactMatches.length || dup.similarMatches.length) {
        const wMsg =
          '⚠️ صنف مشابه/مكرر موجود بالفعل: ' +
          [...dup.exactMatches, ...dup.similarMatches].map((x) => `${x.label} (${x.price} ج)`).join('، ');
        item.w.push(wMsg);
        warnLines.push(wMsg);
      }

      // Check if an identical (name + variant) entry in parsedItems/nextDraft can be merged when prices match
      const existingDraftIdx = nextDraft.findIndex(
        (dItem) => rn(dItem.n) === rn(item.n) && rn(dItem.v) === rn(item.v) && (!dItem.p || !item.p || dItem.p === item.p)
      );
      let draftIdx;
      if (existingDraftIdx >= 0) {
        const tgt = nextDraft[existingDraftIdx];
        item.f.forEach((f) => {
          if (!tgt.f.some((ef) => rn(ef) === rn(f))) tgt.f.push(f);
        });
        tgt.p = tgt.p || item.p;
        tgt.o = tgt.o || item.o;
        tgt.d = tgt.d || item.d;
        tgt.c = tgt.c || item.c;
        tgt.e = tgt.e || item.e;
        item.w.forEach((w) => {
          if (!tgt.w.includes(w)) tgt.w.push(w);
        });
        draftIdx = existingDraftIdx;
      } else {
        nextDraft.push(item);
        draftIdx = nextDraft.length - 1;
      }

      if (!(item.p > 0) && firstMissingPriceIdx < 0) {
        item.w.push('السعر مطلوب ولم يتم تحديده');
        firstMissingPriceIdx = draftIdx;
      }
      summaryLines.push(
        `«${item.n}${item.v ? ' · ' + item.v : ''}»` +
          ` (${item.p > 0 ? item.p + ' ج' : 'بدون سعر'}` +
          `${item.c ? ' · قسم ' + item.c : ''}` +
          `${item.d ? ' · ' + item.d : ''}` +
          `${item.f.length ? ' · نكهات: ' + item.f.join('، ') : ''})`
      );
    });

    if (firstMissingPriceIdx >= 0) {
      const mItem = nextDraft[firstMissingPriceIdx];
      return {
        reply:
          `جهّزت مسودة ${summaryLines.join('، ')}` +
          (warnLines.length ? '\n' + warnLines.join('\n') : '') +
          `\n⚠️ كم سعر «${mItem.n}${mItem.v ? ' · ' + mItem.v : ''}»؟ (لم أفترض سعراً تلقائياً)`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'missing_price', draftIdx: firstMissingPriceIdx },
        action: 'none',
      };
    }

    return {
      reply:
        `تمت إضافة ${summaryLines.join(' و')} للمسودة.` +
        (warnLines.length ? '\n' + warnLines.join('\n') : '\nاضغط «مراجعة وإضافة» لاعتمادها.'),
      draft: nextDraft,
      pendingOps: null,
      pendingClarification: null,
      action: 'none',
    };
  }

  return {
    reply: 'لم أستطع فهم الأمر بدقة، ولم يتم تغيير أي بيانات. جرّب صياغة أوضح مثل «ضيف منتج ... بسعر ...» أو «عدّل سعر ... لـ ...».',
    draft: nextDraft,
    pendingOps: null,
    pendingClarification: null,
    action: 'none',
  };
}
