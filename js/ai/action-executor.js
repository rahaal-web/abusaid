// Action Executor Module: Safe Customer Cart commits & Validated Admin Catalog mutations.

import {
  checkProductDuplicates,
  getProductDisplayName,
  getProductFlavors,
  isProductOutOfStock,
  rn,
} from './product-intelligence.js';
import { resolveAdminTargets, validateCartCommitReady, validateStagedProductDraft } from './validation-engine.js';

let cartCommitLock = false;

export function executeCustomerCartAddition({
  draft = [],
  stateCart = {},
  products = [],
  pname = (i) => getProductDisplayName(products[i]),
  saveCart = () => {},
  renderCatalog = () => {},
  updCartSummary = () => {},
}) {
  if (cartCommitLock) {
    return {
      ok: false,
      draft: draft || [],
      addedKeys: [],
      failedItems: [],
      error: 'جاري تنفيذ الإضافة للسلة بالفعل...',
    };
  }
  cartCommitLock = true;
  try {
    const check = validateCartCommitReady(draft, products);
    if (!check.valid) {
      return {
        ok: false,
        draft: check.draft,
        addedKeys: [],
        failedItems: [],
        error: check.error,
      };
    }

    const addedKeys = [];
    const failedItems = [];
    const workingCart = stateCart && typeof stateCart === 'object' ? stateCart : {};

    for (const l of check.draft) {
      const p = products[l.i];
      if (!p || isProductOutOfStock(p)) {
        if (p) failedItems.push(pname(l.i));
        continue;
      }
      const fl = getProductFlavors(p);
      if (fl.length && !(l.f >= 0 && fl[l.f] && !fl[l.f][1])) {
        failedItems.push(pname(l.i));
        continue;
      }
      const k = fl.length ? `${l.i}:${l.f}` : String(l.i);
      const nextQ = Math.min((workingCart[k] || 0) + l.q, 99);
      workingCart[k] = nextQ;
      if (workingCart[k] === nextQ && workingCart[k] > 0) {
        addedKeys.push(k);
      } else {
        failedItems.push(pname(l.i));
      }
    }

    if (!addedKeys.length) {
      return {
        ok: false,
        draft: check.draft,
        addedKeys: [],
        failedItems,
        error: failedItems.length
          ? 'تعذر الإضافة للسلة: ' + failedItems.join('، ') + ' غير متوفرة حالياً'
          : 'تعذر إضافة المنتجات للسلة، جرّب مراجعة الأصناف مرة تانية',
      };
    }

    saveCart();
    renderCatalog();
    updCartSummary();

    return {
      ok: true,
      draft: check.draft,
      addedKeys,
      failedItems,
      error: '',
    };
  } finally {
    cartCommitLock = false;
  }
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
        if (d.setPieces != null && Number(d.setPieces) > 0) {
          const unitLbl = String(d.setSaleUnit || X.cfg?.unit || 'كرتونة').trim();
          const pcs = Math.round(Number(d.setPieces));
          const curPack = String(p[2] || '').trim();
          if (/\d+/.test(curPack)) {
            p[2] = curPack.replace(/\d+/, String(pcs));
          } else {
            p[2] = `${unitLbl} ${pcs} قطعة`;
          }
        }
        if (d.setVariant != null) p[10] = String(d.setVariant).trim();
        if (d.hide === true) p[7] = 1;
        else if (d.hide === false) p[7] = 0;

        // Extended optional indices 13 (desc) & 14 (saleUnit) preserve indices 0..12 compatibility
        if (d.setDesc != null) {
          while (p.length < 13) p.push(p.length === 11 ? 0 : '');
          p[13] = String(d.setDesc).trim();
        }
        if (d.setSaleUnit != null) {
          while (p.length < 14) p.push(p.length === 11 ? 0 : '');
          p[14] = String(d.setSaleUnit).trim();
        }

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

export function buildCatalogProductTuple(stagedItem, palettePair = ['#FFD93D', '#F59E0B']) {
  const name = String(stagedItem?.n || stagedItem?.name || '').trim();
  const cat = String(stagedItem?.c || stagedItem?.category || 'عام').trim() || 'عام';
  const pack = String(stagedItem?.d || stagedItem?.pack || '').trim();
  const price = Math.round((Number(stagedItem?.p ?? stagedItem?.price) || 0) * 100) / 100;
  const oldPrice = Number(stagedItem?.o ?? stagedItem?.oldPrice) || 0;
  const variant = String(stagedItem?.v || stagedItem?.variant || '').trim();
  const emoji = String(stagedItem?.e || stagedItem?.emoji || '🥔').trim() || '🥔';
  const desc = String(stagedItem?.desc || '').trim();
  const saleUnit = String(stagedItem?.saleUnit || '').trim();
  const rawFlavors = Array.isArray(stagedItem?.f || stagedItem?.flavors)
    ? stagedItem.f || stagedItem.flavors
    : [];
  const flavors = rawFlavors
    .map((f) => {
      if (Array.isArray(f)) return [String(f[0] || '').trim(), f[1] ? 1 : 0];
      const s = String(f || '').trim();
      return s ? [s, 0] : null;
    })
    .filter((f) => f && f[0]);

  const tuple = [
    name,
    cat,
    pack,
    price,
    palettePair[0] || '#FFD93D',
    palettePair[1] || '#F59E0B',
    emoji,
    0,
    '',
  ];
  if (flavors.length) tuple[9] = flavors;
  if (variant) tuple[10] = variant;
  if (oldPrice > price) tuple[11] = oldPrice;
  tuple[12] = new Date().toISOString();
  if (desc) tuple[13] = desc;
  if (saleUnit) tuple[14] = saleUnit;
  return tuple;
}

export function commitAdminStagedProduct({
  catalogData,
  stagedItem,
  palettePair = ['#FFD93D', '#F59E0B'],
  allowDuplicate = false,
}) {
  const X = catalogData;
  X.p = Array.isArray(X.p) ? X.p : [];
  X.cats = Array.isArray(X.cats) ? X.cats : [];

  const check = validateStagedProductDraft(stagedItem, X);
  if (!check.valid) {
    return {
      ok: false,
      error: `بيانات الصنف غير مكتملة: ينقصه (${check.missing.join('، ')})`,
    };
  }
  if (!allowDuplicate && check.duplicates?.exactMatches?.length) {
    return {
      ok: false,
      duplicate: true,
      error: `الصنف «${stagedItem.n}» موجود بالفعل في الكتالوج (${check.duplicates.exactMatches[0].label}).`,
    };
  }

  const rawCat = String(stagedItem.c || '').trim();
  const matchedCat = X.cats.find((c) => rn(c) === rn(rawCat)) || rawCat || X.cats[0] || 'عام';
  if (matchedCat && !X.cats.includes(matchedCat)) X.cats.push(matchedCat);

  const normalizedItem = { ...stagedItem, c: matchedCat };
  const tuple = buildCatalogProductTuple(normalizedItem, palettePair);
  X.p.push(tuple);

  return {
    ok: true,
    product: tuple,
    index: X.p.length - 1,
    dupCheck: checkProductDuplicates(normalizedItem, X.p.slice(0, -1)),
  };
}
