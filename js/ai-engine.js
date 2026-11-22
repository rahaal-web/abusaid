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

const DOZEN_WORDS = new Set(['دسته', 'دستتين']);
const CARTON_WORDS = new Set(['كرتونه', 'كارتونه', 'كراتين', 'كرتون', 'كرتونتين', 'كارتونتين']);
const PIECE_UNITS = ['قطعه', 'حبه', 'كيس', 'علبه', 'باكو', 'وحده', 'عبوه', 'زجاجه', 'برطمان'];

const RSTOP_SET = new Set(
  (
    'عايز عاوز عايزه عاوزه اريد ابغي محتاج محتاجه هات هاتلي ضيف ضيفلي اضف اضافه طلب اطلب ابعت بعت ممكن لو سمحت من فضلك يا باشا معلم استاذ ريس ' +
    'كرتونه كراتين كرتون كارتونه كرتونتين علبه علب علبتين دسته دستتين شوال عدد حبه قطعه وحده وحدات في من علي الي على عن لي ده دي مع معاهم ورقم ' +
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
  // Protect multi-word flavors like "ملح وخل" / "خل وملح" / "جبنة متبلة" before splitting
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

    // Direct full phrase match
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
    const q = Math.max(1, Math.min(99, Math.round(Number(raw.q) || 1)));
    const pid = getProductStableKey(p, idx);
    const key = `${idx}:${f}`;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.q = Math.min(99, existing.q + q);
    } else {
      const item = {
        i: idx,
        pid,
        f,
        q,
        c: Array.isArray(raw.c) && raw.c.length ? raw.c.filter((x) => products[x] && !isProductOutOfStock(products[x])) : [idx],
        amb: Boolean(raw.amb),
      };
      map.set(key, item);
      out.push(item);
    }
  }
  // Remove f === -1 placeholder if a specific flavor for the same product already exists
  const hasSpecific = new Set(out.filter((x) => x.f >= 0).map((x) => x.i));
  return out.filter((x) => !(x.f < 0 && hasSpecific.has(x.i)));
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
    const amb = Boolean(x.a === true && alt.length > 1);
    if (amb) {
      // Never add ambiguous product to draft before customer confirms
      disambiguations.push({ i: idx, alt: [idx, ...alt.filter((a) => a !== idx)].slice(0, 5) });
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

    const q = Math.max(1, Math.min(99, Math.round(Number(x.q) || 1)));
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
  const msgSegs = msgStr ? segmentOrderText(msgStr) : [];
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

  let nextDraft = currentDraft.slice();
  const clearAsked = parsed.clear === true || intent === 'clear';
  if (clearAsked) {
    nextDraft = [];
  } else if (verifiedItems.length) {
    const isInquiry = intent === 'inquiry' || intent === 'greeting' || intent === 'clarify';
    if (isInquiry) {
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
  } else if (rejectedReasons.length || (parsed.unknown && parsed.unknown.length)) {
    nextDraft = currentDraft.slice();
  }

  let nextState = {
    pendingClarification: stateCtx?.pendingClarification
      ? JSON.parse(JSON.stringify(stateCtx.pendingClarification))
      : null,
    lastReferencedProductIdx: Number.isInteger(stateCtx?.lastReferencedProductIdx)
      ? stateCtx.lastReferencedProductIdx
      : -1,
    lastReferencedFlavorIdx: Number.isInteger(stateCtx?.lastReferencedFlavorIdx)
      ? stateCtx.lastReferencedFlavorIdx
      : -1,
  };

  if (clearAsked) {
    nextState = { pendingClarification: null, lastReferencedProductIdx: -1, lastReferencedFlavorIdx: -1 };
  } else if (disambiguations.length) {
    const reqQty = msgQp && msgQp.explicitQty ? msgQp.qty : msgQp && msgQp.hasSingularUnit ? 1 : null;
    nextState.pendingClarification = {
      type: 'disambiguate_product',
      candidates: disambiguations[0].alt,
      explicitQty: reqQty,
    };
  } else if (missingFlavors.length) {
    const keepQty =
      msgQp && msgQp.explicitQty
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
    nextState.lastReferencedProductIdx = missingFlavors[0].i;
    nextState.lastReferencedFlavorIdx = -1;
  } else if (missingQty.length) {
    nextState.pendingClarification = {
      type: 'qty',
      prodIdx: missingQty[0].i,
      flavorIdx: missingQty[0].f,
    };
    nextState.lastReferencedProductIdx = missingQty[0].i;
    nextState.lastReferencedFlavorIdx = missingQty[0].f;
  } else if (verifiedItems.length && !clearAsked) {
    nextState.pendingClarification = null;
    nextState.lastReferencedProductIdx = verifiedItems[verifiedItems.length - 1].i;
    nextState.lastReferencedFlavorIdx = verifiedItems[verifiedItems.length - 1].f;
  }

  let reply = String(parsed.reply || '').trim();
  const unknown = Array.isArray(parsed.unknown) ? parsed.unknown.map(String).filter(Boolean) : [];
  let quick = Array.isArray(parsed.quick)
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
    !missingQty.length
      ? 'review'
      : 'none';

  const draftChanged = JSON.stringify(nextDraft) !== JSON.stringify(currentDraft);
  const hollow = isHollowAiReply(reply);
  const falseCartClaim = hasFalseCartClaim(reply);
  if (falseCartClaim && draftChanged) {
    reply = sanitizeCartClaimText(reply);
  }

  if (disambiguations.length) {
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
    lastReferencedProductIdx:
      Number.isInteger(convState.lastReferencedProductIdx) ? convState.lastReferencedProductIdx : -1,
    lastReferencedFlavorIdx:
      Number.isInteger(convState.lastReferencedFlavorIdx) ? convState.lastReferencedFlavorIdx : -1,
  };

  const n = rn(text)
    .replace(/[؟?!.،,;:«»"']+/g, ' ')
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

  // 1) Resolve pending clarification (disambiguation, flavor slot, quantity slot, missing flavor+qty)
  if (nextState.pendingClarification) {
    const pc = nextState.pendingClarification;

    // 1a) Disambiguating product candidates
    if (pc.type === 'disambiguate_product' && Array.isArray(pc.candidates) && pc.candidates.length) {
      const { clean, hints } = extractHints(text);
      const qParsed = parseQuantityAndRest(clean || text, unit);
      let chosenIdx = -1;

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
      if (chosenIdx < 0 && /^(?:الاول|الاولاني|1)$/.test(n)) chosenIdx = pc.candidates[0];
      if (chosenIdx < 0 && /^(?:التاني|الثاني|2)$/.test(n) && pc.candidates[1] != null) chosenIdx = pc.candidates[1];
      if (chosenIdx < 0 && /^(?:التالت|الثالث|3)$/.test(n) && pc.candidates[2] != null) chosenIdx = pc.candidates[2];

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
        return {
          reply: formatOrderSummaryReply(
            `ضفتلك في مسودة الطلب ✅: ${useQty} ${unit} من ${getProductDisplayName(p)}${chosenFlavorIdx >= 0 ? ' · ' + getProductFlavors(p)[chosenFlavorIdx][0] : ''} (${fmtMoneyAr(p[3] * useQty)})`,
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

      // Check if user switched to a totally different product or an explicit command
      const directOther = matchProductsInCatalog(qParsed.rest, products, {
        priceHints: hints,
        includeSoldOut: false,
        rawCleanText: clean || text,
      });
      const isNewCommand =
        /^(?:امسح|فضي|شيل|احذف|الغي|زود|نقص|قلل|خلي|عدل|غير|بدل|اعرض|عرض|احسب|راجع|عندكم|عندكو|بكام|بكم|سعر|اسعار|عروض|عرض|اهلا|السلام)/.test(
          n
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

      if (/^(?:اي نكهه|اي طعم|مش فارق|مش فارقه|عادي|اي حاجه)(?:\s|$)/.test(n)) {
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

      const segs = segmentOrderText(text);
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
          picked.push({
            j: fm.avail[0].j,
            q: qp.explicitQty ? qp.qty : pc.explicitQty,
            name: fm.avail[0].name,
            hadExplicitQty: qp.explicitQty || Boolean(pc.explicitQty),
          });
        } else if (fm.soldOut.length) {
          rejectedFlavor = `نكهة «${fm.soldOut[0].name}» خلصانة حالياً في ${getProductDisplayName(p)}. المتاح: ${availFl.map((f) => f[0]).join('، ')}`;
        } else {
          const otherM = matchProductsInCatalog(qp.rest, products, { includeSoldOut: true, rawCleanText: sg });
          if (
            (otherM && otherM.cs[0].i !== pc.prodIdx && !otherM.cs[0].isFuzzyOnly) ||
            /^(?:امسح|شيل|احذف|اعرض|احسب|راجع|عندكم|بكام|سعر|زود|نقص|قلل|خلي|غير|بدل)/.test(n)
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
        return {
          reply: formatOrderSummaryReply(`ضفتلك في مسودة الطلب ✅:\n${addedLines.join('\n')}`, workingDraft, kb),
          draft: workingDraft,
          nextState,
          go: false,
          quick: [
            { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
            { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
          ],
        };
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
        const fIdx = pc.flavorIdx >= 0 && fl[pc.flavorIdx] && !fl[pc.flavorIdx][1] ? pc.flavorIdx : -1;
        const nextDraft = dedupeAndNormalizeDraft(
          [...draft, { i: pc.prodIdx, f: fIdx, q: resolvedQty, c: [pc.prodIdx], amb: false }],
          products
        );
        nextState.pendingClarification = null;
        nextState.lastReferencedProductIdx = pc.prodIdx;
        nextState.lastReferencedFlavorIdx = fIdx;
        return {
          reply: formatOrderSummaryReply(
            `ضفتلك في مسودة الطلب ✅: ${resolvedQty} ${unit} من ${getProductDisplayName(p)}${fIdx >= 0 ? ' · ' + fl[fIdx][0] : ''} (${fmtMoneyAr(p[3] * resolvedQty)})`,
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
      line.q = Math.min(99, line.q + delta);
    } else if (isDec) {
      if (line.q - delta <= 0) {
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
      line.q = Math.max(1, line.q - delta);
    } else if (adjParsed.explicitQty || adjParsed.hasSingularUnit) {
      line.q = Math.min(99, Math.max(1, delta));
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

  // 15) Order item extraction across segments (supports multi-item, same-message flavor inheritance, distributives, disambiguation, missing slots, rejected flavors)
  const segs = segmentOrderText(text);
  const addedMsgs = [];
  const warnings = [];
  const suggestions = [];
  let prevProdIdx = nextState.lastReferencedProductIdx;

  for (const rawSg of segs) {
    const { clean, hints } = extractHints(rawSg);
    const qp = parseQuantityAndRest(clean || rawSg, unit);

    if (qp.unitMismatch) {
      warnings.push(
        `وحدة البيع في المتجر هي «${qp.unitMismatch.storeUnit}» مش ${qp.unitMismatch.requestedUnit}. تحب تطلب كام ${qp.unitMismatch.storeUnit}؟`
      );
      continue;
    }

    const nonStopTokens = qp.rest.filter((t) => !RSTOP_SET.has(t));

    // Handle quantity-only message when user refers to the last discussed/added product (e.g. "عايز كرتونتين")
    if (!nonStopTokens.length && (qp.explicitQty || qp.hasSingularUnit) && prevProdIdx >= 0 && products[prevProdIdx]) {
      const targetQ = qp.explicitQty ? qp.qty : 1;
      const existingLine =
        (nextState.lastReferencedFlavorIdx >= 0
          ? draft.find((l) => l.i === prevProdIdx && l.f === nextState.lastReferencedFlavorIdx)
          : null) || draft.find((l) => l.i === prevProdIdx);
      if (existingLine) {
        existingLine.q = Math.min(99, Math.max(1, targetQ));
        const nextDraft = dedupeAndNormalizeDraft(draft, products);
        return {
          reply: formatOrderSummaryReply(
            `عدّلت الكمية لـ ${getProductDisplayName(products[prevProdIdx])} في مسودة الطلب بقت ${existingLine.q} ${unit} ✅`,
            nextDraft,
            kb
          ),
          draft: nextDraft,
          nextState,
          go: false,
          quick: [{ label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' }],
        };
      }
      const p = products[prevProdIdx];
      const fl = getProductFlavors(p).filter((f) => !f[1]);
      if (fl.length) {
        nextState.pendingClarification = {
          type: 'flavor',
          prodIdx: prevProdIdx,
          explicitQty: targetQ,
        };
        return {
          reply: `تمام (${targetQ} ${unit} من ${getProductDisplayName(p)}) 👍 تحب أنهي نكهة؟ المتاح: ${fl.map((f) => f[0]).join('، ')}`,
          draft: dedupeAndNormalizeDraft(draft, products),
          nextState,
          go: false,
          quick: fl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
        };
      }
    }

    const m = matchProductsInCatalog(qp.rest, products, {
      priceHints: hints,
      includeSoldOut: false,
      rawCleanText: clean || rawSg,
    });

    // Check if segment has NO product name of its own, only a flavor of the previous segment's product
    if ((!m || m.cs[0].flavorOnlyMatch) && prevProdIdx >= 0 && products[prevProdIdx] && !isProductOutOfStock(products[prevProdIdx])) {
      const prevP = products[prevProdIdx];
      const fmPrev = matchProductFlavors(prevP, qp.rest, clean || rawSg);
      if (fmPrev.avail.length) {
        if (!qp.explicitQty && !qp.hasSingularUnit) {
          nextState.pendingClarification = {
            type: 'qty',
            prodIdx: prevProdIdx,
            flavorIdx: fmPrev.avail[0].j,
          };
          return {
            reply: `تمام (${getProductDisplayName(prevP)} · ${fmPrev.avail[0].name}) 👍 عايز كام ${unit}؟`,
            draft: dedupeAndNormalizeDraft(draft, products),
            nextState,
            go: false,
            quick: [
              { label: `١ ${unit}`, val: '1' },
              { label: `٢ ${unit}`, val: '2' },
              { label: `٥ ${unit}`, val: '5' },
            ],
          };
        }
        const useQ = qp.explicitQty ? qp.qty : 1;
        draft.push({ i: prevProdIdx, f: fmPrev.avail[0].j, q: useQ, c: [prevProdIdx], amb: false });
        addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(prevP)} · ${fmPrev.avail[0].name}`);
        nextState.lastReferencedProductIdx = prevProdIdx;
        nextState.lastReferencedFlavorIdx = fmPrev.avail[0].j;
        continue;
      }
      if (fmPrev.soldOut.length) {
        warnings.push(`نكهة «${fmPrev.soldOut[0].name}» خلصانة في ${getProductDisplayName(prevP)}.`);
        continue;
      }
    }

    // Check if segment is asking for a category (e.g. "عايز كرتونة شيبسي" when "شيبسي" is a category or matches multiple products)
    const matchedCatName = Object.keys(kb.cats).find((c) => {
      const cToks = ntk(c).filter((t) => !RSTOP_SET.has(t));
      return nonStopTokens.length === 1 && cToks.length === 1 && cToks[0] === nonStopTokens[0];
    });

    if (!m) {
      if (matchedCatName && kb.cats[matchedCatName].length) {
        const catItems = kb.cats[matchedCatName];
        if (catItems.length === 1) {
          // Proceed as single product
          const rec = catItems[0];
          const fl = getProductFlavors(rec.p).filter((f) => !f[1]);
          nextState.lastReferencedProductIdx = rec.idx;
          nextState.lastReferencedFlavorIdx = -1;
          if (fl.length) {
            nextState.pendingClarification = {
              type: 'flavor',
              prodIdx: rec.idx,
              explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
            };
            return {
              reply: `المتوفر في قسم ${matchedCatName} هو ${rec.name}. تحب أنهي نكهة؟ المتاح: ${fl.map((f) => f[0]).join('، ')}`,
              draft: dedupeAndNormalizeDraft(draft, products),
              nextState,
              go: false,
              quick: fl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
            };
          }
        } else {
          const candIds = catItems.slice(0, 6).map((x) => x.idx);
          nextState.pendingClarification = {
            type: 'disambiguate_product',
            candidates: candIds,
            explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
          };
          return {
            reply:
              `عندنا أكتر من نوع في قسم ${matchedCatName}، تحب أنهي نوع؟\n` +
              candIds.map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`).join('\n'),
            draft: dedupeAndNormalizeDraft(draft, products),
            nextState,
            go: false,
            quick: candIds.slice(0, 6).map((idx) => ({
              label: getProductDisplayName(products[idx]),
              val: getProductDisplayName(products[idx]),
            })),
          };
        }
      }

      // Check sold out
      const mOut = matchProductsInCatalog(qp.rest, products, {
        priceHints: hints,
        includeSoldOut: true,
        rawCleanText: clean || rawSg,
      });
      if (mOut && mOut.cs[0] && mOut.cs[0].out && !mOut.cs[0].isFuzzyOnly) {
        warnings.push(`«${getProductDisplayName(products[mOut.cs[0].i])}» غير متوفر حالياً (خلصان).`);
      } else if (qp.distributive === 'types') {
        const catName = Object.keys(kb.cats).find((c) => rn(clean || rawSg).includes(rn(c)));
        if (catName && kb.cats[catName].length) {
          const useQ = qp.explicitQty ? qp.qty : 1;
          kb.cats[catName].forEach((rec) => {
            const hasFl = getProductFlavors(rec.p).some((f) => !f[1]);
            if (!hasFl) {
              draft.push({ i: rec.idx, f: -1, q: useQ, c: [rec.idx], amb: false });
              addedMsgs.push(`${useQ} ${unit} ${rec.name}`);
            }
          });
        } else {
          warnings.push(`ما قدرتش أحدد نوع أو قسم معين لـ «${rawSg}».`);
        }
      } else {
        warnings.push(`لم أجد صنفاً مطابقاً لـ «${rawSg}» في الكتالوج.`);
      }
      continue;
    }

    const top = m.cs[0];

    // CRITICAL: NEVER silently auto-select a fuzzy-only match! Ask customer if they meant it.
    if (top.isFuzzyOnly) {
      const sugList = m.cs.slice(0, 3).map((c) => c.i);
      suggestions.push({ query: rawSg, candidates: sugList });
      nextState.pendingClarification = {
        type: 'disambiguate_product',
        candidates: sugList,
        explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
      };
      continue;
    }

    // Check if multiple variants / similarly named products tie or compete without disambiguating hint
    const strongComp = m.cs.filter((c) => !c.isFuzzyOnly && !c.flavorOnlyMatch);
    const exactBaseName = rn(products[top.i][0]);
    const sameBaseAlts = strongComp.filter((c) => rn(products[c.i][0]) === exactBaseName);

    // Handle "من كل نوع" for a matched product family
    if (qp.distributive === 'types') {
      const family = sameBaseAlts.length > 1 ? sameBaseAlts : strongComp.filter((c) => c.s >= top.s * 0.75);
      const useQ = qp.explicitQty ? qp.qty : 1;
      family.forEach((c) => {
        draft.push({ i: c.i, f: -1, q: useQ, c: [c.i], amb: false });
        addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(products[c.i])}`);
      });
      prevProdIdx = top.i;
      nextState.lastReferencedProductIdx = top.i;
      nextState.lastReferencedFlavorIdx = -1;
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
      nextState.pendingClarification = {
        type: 'disambiguate_product',
        candidates: candIds,
        explicitQty: qp.explicitQty ? qp.qty : qp.hasSingularUnit ? 1 : null,
      };
      return {
        reply:
          `لقيت أكتر من صنف مطابق لـ «${rawSg}»، قصدك أنهي واحد؟\n` +
          candIds.map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`).join('\n'),
        draft: dedupeAndNormalizeDraft(draft, products),
        nextState,
        go: false,
        quick: candIds.slice(0, 6).map((idx) => ({
          label: getProductDisplayName(products[idx]),
          val: getProductDisplayName(products[idx]),
        })),
      };
    }

    // Single unambiguous product matched!
    const p = products[top.i];
    const fl = getProductFlavors(p);
    const avFl = fl.filter((f) => !f[1]);
    prevProdIdx = top.i;
    nextState.lastReferencedProductIdx = top.i;
    nextState.lastReferencedFlavorIdx = -1;
    const effQty = qp.explicitQty
      ? qp.qty
      : qp.hasSingularUnit
      ? 1
      : segs.length === 1 && carriedDisambigQty
      ? carriedDisambigQty
      : null;

    // Handle "من كل نكهة" for this product
    if (qp.distributive === 'flavors') {
      if (!avFl.length) {
        const useQ = effQty || 1;
        draft.push({ i: top.i, f: -1, q: useQ, c: [top.i], amb: false });
        addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)}`);
      } else {
        const useQ = effQty || 1;
        avFl.forEach((f) => {
          const fIdx = fl.indexOf(f);
          draft.push({ i: top.i, f: fIdx, q: useQ, c: [top.i], amb: false });
          addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)} · ${f[0]}`);
        });
      }
      continue;
    }

    // Check flavors in segment
    if (fl.length) {
      if (/(?:اي\s+نكهه|اي\s+طعم|مش\s+فارق|مش\s+فارقه|مش\s+هتفرق)/.test(rn(rawSg))) {
        nextState.pendingClarification = {
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
        };
        return {
          reply:
            (addedMsgs.length ? `ضفتلك في مسودة الطلب ✅:\n${addedMsgs.join('\n')}\n\n` : '') +
            `لازم تختار نكهة محددة لـ ${getProductDisplayName(p)} قبل الإضافة لمسودة الطلب.\nالنكهات المتاحة: ${avFl.map((f) => f[0]).join('، ')}`,
          draft: dedupeAndNormalizeDraft(draft, products),
          nextState,
          go: false,
          quick: avFl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
        };
      }

      const fm = matchProductFlavors(p, qp.rest, clean || rawSg);
      const extraUnknownFlavorToks = detectUnmatchedFlavorTokens(p, qp.rest, fm);

      if (!fm.avail.length && fm.soldOut.length) {
        warnings.push(
          `نكهة «${fm.soldOut[0].name}» خلصانة حالياً في ${getProductDisplayName(p)}. النكهات المتاحة: ${avFl.map((f) => f[0]).join('، ')}`
        );
        nextState.pendingClarification = {
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
        };
        continue;
      }

      if (extraUnknownFlavorToks.length && !fm.avail.length) {
        warnings.push(
          `نكهة «${extraUnknownFlavorToks.join(' ')}» غير متاحة في ${getProductDisplayName(p)}. النكهات المتاحة هي: ${avFl.map((f) => f[0]).join('، ')}`
        );
        nextState.pendingClarification = {
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
        };
        continue;
      }

      if (!fm.avail.length) {
        nextState.pendingClarification = {
          type: 'flavor',
          prodIdx: top.i,
          explicitQty: effQty,
        };
        const askFlavor = `تحب أنهي نكهة في ${getProductDisplayName(p)}؟\nالنكهات المتاحة: ${avFl.map((f) => f[0]).join('، ')}`;
        const normalizedSoFar = dedupeAndNormalizeDraft(draft, products);
        return {
          reply: (addedMsgs.length ? `ضفتلك في مسودة الطلب ✅:\n${addedMsgs.join('\n')}\n\n` : '') + askFlavor,
          draft: normalizedSoFar,
          nextState,
          go: false,
          quick: avFl.slice(0, 6).map((f) => ({ label: f[0], val: f[0] })),
        };
      }

      const bestF = fm.avail[0];
      if (!effQty) {
        nextState.pendingClarification = {
          type: 'qty',
          prodIdx: top.i,
          flavorIdx: bestF.j,
        };
        nextState.lastReferencedFlavorIdx = bestF.j;
        const normalizedSoFar = dedupeAndNormalizeDraft(draft, products);
        return {
          reply:
            (addedMsgs.length ? `ضفتلك في مسودة الطلب ✅:\n${addedMsgs.join('\n')}\n\n` : '') +
            `تمام (${getProductDisplayName(p)} · ${bestF.name}) 👍 عايز كام ${unit}؟`,
          draft: normalizedSoFar,
          nextState,
          go: false,
          quick: [
            { label: `١ ${unit}`, val: '1' },
            { label: `٢ ${unit}`, val: '2' },
            { label: `٥ ${unit}`, val: '5' },
          ],
        };
      }

      const useQ = effQty;
      draft.push({ i: top.i, f: bestF.j, q: useQ, c: [top.i], amb: false });
      addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)} · ${bestF.name}`);
      nextState.lastReferencedFlavorIdx = bestF.j;
    } else {
      if (!effQty) {
        nextState.pendingClarification = { type: 'qty', prodIdx: top.i, flavorIdx: -1 };
        const normalizedSoFar = dedupeAndNormalizeDraft(draft, products);
        return {
          reply:
            (addedMsgs.length ? `ضفتلك في مسودة الطلب ✅:\n${addedMsgs.join('\n')}\n\n` : '') +
            `عايز كام ${unit} من ${getProductDisplayName(p)} (${fmtMoneyAr(p[3])})؟`,
          draft: normalizedSoFar,
          nextState,
          go: false,
          quick: [
            { label: `١ ${unit}`, val: '1' },
            { label: `٢ ${unit}`, val: '2' },
            { label: `٥ ${unit}`, val: '5' },
          ],
        };
      }
      const useQ = effQty;
      draft.push({ i: top.i, f: -1, q: useQ, c: [top.i], amb: false });
      addedMsgs.push(`${useQ} ${unit} ${getProductDisplayName(p)}`);
    }
  }

  const finalDraft = dedupeAndNormalizeDraft(draft, products);
  const parts = [];
  let quick = [];

  if (addedMsgs.length) {
    parts.push(formatOrderSummaryReply(`ضفتلك في مسودة الطلب ✅:\n${addedMsgs.join('\n')}`, finalDraft, kb));
    quick = [
      { label: '✅ راجع وضيف للسلة', val: 'راجع الطلب' },
      { label: '➕ إضافة صنف تاني', val: 'عندكم أصناف إيه؟' },
    ];
  }
  if (warnings.length) {
    parts.push(warnings.join('\n'));
    if (!addedMsgs.length && !suggestions.length && !nextState.pendingClarification) {
      parts.push('تحب تشوف الأقسام المتاحة أو تكتب اسم الصنف المطلوب؟');
      quick = Object.keys(kb.cats)
        .slice(0, 6)
        .map((c) => ({ label: `قسم ${c}`, val: `عندكم إيه في ${c}` }));
    }
  }
  if (suggestions.length) {
    const sugCands = suggestions[0].candidates;
    parts.push(
      `ممكن يكون قصدك حاجة من دول؟\n` +
        sugCands.map((idx, k) => `${k + 1}) ${getProductDisplayName(products[idx])} — ${fmtMoneyAr(products[idx][3])}`).join('\n')
    );
    quick = sugCands.map((idx) => ({
      label: getProductDisplayName(products[idx]),
      val: getProductDisplayName(products[idx]),
    }));
  }

  return {
    reply:
      parts.join('\n\n') ||
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

  // 6) Add product ("ضيف منتج بسكويت لوكس بسعر 180 قسم الحلويات نكهات فانيليا وشوكولاتة")
  if (/^(?:ضيف|أضف|اضف|اضافة|إضافة)\s+(?:منتج|صنف)?\s*/.test(n)) {
    let s = String(text || '')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/^(?:انا |أنا )?(?:ضيف|أضف|اضف|اضافة|إضافة)\s+(?:منتج|صنف)?\s*/i, '')
      .trim();
    let price = 0;
    const pm = s.match(/(?:بسعر|السعر|سعره|سعر|بـ)\s*:?\s*(\d+(?:\.\d+)?)/);
    if (pm) {
      price = Number(pm[1]);
      s = s.replace(pm[0], ' ');
    }
    let flavors = [];
    const fm = s.match(/(?:النكهات|نكهات|الطعوم|طعوم|طعم|نكهة|نكهه)\s*:?\s*(.+?)(?=\s+(?:القسم|قسم|عبوة|العبوة|الحجم|$)|$)/);
    if (fm) {
      flavors = fm[1]
        .split(/[,،؛;\/|\n]+|\s+و(?:\s+|(?=[\u0621-\u064A]{3,}))/)
        .map((x) => x.trim())
        .filter(Boolean);
      s = s.replace(fm[0], ' ');
    }
    let cat = '';
    const cm = s.match(/(?:في\s+)?(?:القسم|قسم)\s*:?\s*(.+?)(?=\s+(?:النكهات|نكهات|العبوة|عبوة|الحجم|$)|$)/);
    if (cm) {
      const rawC = cm[1].trim();
      cat = cats.find((c) => rn(c) === rn(rawC) || rn(c).includes(rn(rawC)) || rn(rawC).includes(rn(c))) || rawC;
      s = s.replace(cm[0], ' ');
    }
    const name = s.replace(/\s*(?:جنيه|جني|ج)\s*$/g, '').replace(/\s+/g, ' ').trim();
    if (!name) {
      return {
        reply: 'اكتب اسم الصنف المطلوب إضافته.',
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: null,
        action: 'none',
      };
    }

    const item = { n: name, c: cat || '', d: '', p: price, o: 0, v: '', e: '', f: flavors, on: 1, w: [] };
    const dup = checkProductDuplicates(item, products);
    if (dup.exactMatches.length || dup.similarMatches.length) {
      item.w.push(
        '⚠️ صنف مشابه/مكرر موجود بالفعل: ' +
          [...dup.exactMatches, ...dup.similarMatches].map((x) => `${x.label} (${x.price} ج)`).join('، ')
      );
    }

    nextDraft.push(item);
    const draftIdx = nextDraft.length - 1;

    if (!(price > 0)) {
      item.w.push('السعر مطلوب ولم يتم تحديده');
      return {
        reply:
          `جهّزت مسودة «${name}»${item.w.length ? '\n' + item.w.join('\n') : ''}\n` +
          `⚠️ كم سعر «${name}»؟ (لم أفترض سعراً تلقائياً)`,
        draft: nextDraft,
        pendingOps: null,
        pendingClarification: { type: 'missing_price', draftIdx },
        action: 'none',
      };
    }

    return {
      reply:
        `تمت إضافة «${name}» للمسودة (${price} ج${cat ? ' · قسم ' + cat : ''}${flavors.length ? ' · نكهات: ' + flavors.join('، ') : ''}).` +
        (item.w.length ? '\n' + item.w.join('\n') : '\nاضغط «مراجعة وإضافة» لاعتمادها.'),
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
