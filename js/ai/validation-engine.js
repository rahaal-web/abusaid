// Validation Engine Module: Strict Customer vs Admin isolation, authoritative price & stock checks,
// hollow-reply rejection, ambiguous target resolution, and Admin catalog op verification.

import {
  buildStoreKB,
  checkProductDuplicates,
  extractHints,
  getProductDisplayName,
  getProductFlavors,
  getProductStableKey,
  isProductOutOfStock,
  matchProductFlavors,
  matchProductsInCatalog,
  ntk,
  parseQuantityAndRest,
  rn,
  rnd,
  RSTOP_SET,
  segmentOrderText,
  tokSim,
} from './product-intelligence.js';
import { processCustomerTurn } from './customer-agent.js';

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
  const hasSpecific = new Set(out.filter((x) => x.f >= 0).map((x) => x.i));
  return out.filter((x) => !(x.f < 0 && hasSpecific.has(x.i)));
}

const HOLLOW_REPLY_RE =
  /^(?:تمام|حاضر|ماشي|اوكي|اوك|ok|yes|نعم|ايوه|طيب|حسنا|تحت امرك|حالا|علي راسي|اهلا|مرحبا)(?:\s+(?:يا\s+)?(?:فندم|باشا|استاذ|ريس|كبير))?$/i;

const FALSE_CART_CLAIM_RE =
  /(?:اضفت|ضفت(?:لك)?|اتضاف(?:وا)?|تمت?\s+الاضاف[هة]|موجود(?:ه|ين)?)\s+(?:لك\s+)?(?:في\s+|لـ?\s*|الى\s+)?(?:ال)?سله/;

const CUSTOMER_ADMIN_MUTATION_RE =
  /^(?:غير|عدل|اضف|ضيف|احذف|امسح|شيل|اخفي|اظهر|انقل)\s+(?:سعر|وصف|بيانات|قسم|صنف|منتج)\s+.+(?:في\s+(?:المتجر|الكتالوج|السيستم|الموقع)|من\s+(?:المتجر|الكتالوج|الموقع)|(?:لـ|الي|الى|بـ)\s*\d+\s*(?:جنيه|ج))/;

export function hasFalseCartClaim(text) {
  return FALSE_CART_CLAIM_RE.test(rn(text));
}

export function sanitizeCartClaimText(text) {
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

export function isCustomerAdminMutationAttempt(text = '', geminiJson = null) {
  if (geminiJson && typeof geminiJson === 'object') {
    if (Array.isArray(geminiJson.ops) && geminiJson.ops.length) return true;
    if (Array.isArray(geminiJson.products) && geminiJson.products.length && !Array.isArray(geminiJson.items)) {
      return true;
    }
    const gIntent = String(geminiJson.intent || '').toLowerCase();
    if (['add_product', 'edit_product', 'delete_product', 'category_op', 'offer_op', 'admin'].includes(gIntent)) {
      return true;
    }
  }
  const n = rn(text);
  if (CUSTOMER_ADMIN_MUTATION_RE.test(n)) return true;
  if (/^(?:غير|عدل)\s+سعر\s+/.test(n) || /^(?:ضيف|اضف|احذف|اخفي|اظهر)\s+(?:منتج|صنف|قسم)\s+/.test(n)) {
    return true;
  }
  return false;
}

export function fmtMoneyAr(n) {
  return `${Math.round(Number(n || 0) * 100) / 100} جنيه`;
}

export function formatOrderSummaryReply(prefix, draft, kb) {
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

export function validateCartCommitReady(draft = [], products = []) {
  const normalized = dedupeAndNormalizeDraft(draft, products);
  if (!normalized.length) {
    return { valid: false, draft: normalized, error: 'مسودة الطلب فاضية، اختار الأصناف المطلوبة الأول' };
  }
  if (normalized.some((l) => l.amb)) {
    return { valid: false, draft: normalized, error: 'اتأكد من اختيار نوع أو حجم الصنف المطلوب الأول' };
  }
  if (normalized.some((l) => getProductFlavors(products[l.i]).some((f) => !f[1]) && l.f < 0)) {
    return { valid: false, draft: normalized, error: 'اختار النكهة في الأصناف اللي لسه ما اتحددتش' };
  }
  return { valid: true, draft: normalized, error: '' };
}

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

  // Strictly block any admin operation / mutation injected through customer channel
  if (isCustomerAdminMutationAttempt(userMessage, parsed)) {
    const cleanDraft = dedupeAndNormalizeDraft(currentDraft, products);
    return {
      draft: cleanDraft,
      unknown: [],
      reply:
        'أنا مساعد طلبات العملاء فقط — تغيير الأسعار أو تعديل وإدارة المنتجات متاح للمدير من لوحة الإدارة فقط. قولي تحب تطلب إيه من الأصناف المتاحة؟',
      action: 'none',
      quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
      cards: [],
      disambiguations: [],
      missingFlavors: [],
      missingQty: [],
      rejectedReasons: ['غير مسموح بإجراء تعديلات إدارية من حساب العميل'],
      nextState: {
        pendingClarification: stateCtx?.pendingClarification || null,
        lastReferencedProductIdx: Number.isInteger(stateCtx?.lastReferencedProductIdx)
          ? stateCtx.lastReferencedProductIdx
          : -1,
        lastReferencedFlavorIdx: Number.isInteger(stateCtx?.lastReferencedFlavorIdx)
          ? stateCtx.lastReferencedFlavorIdx
          : -1,
      },
    };
  }

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

    // Never trust client/Gemini-supplied price fields; q bounded 1..99
    const q = Math.max(1, Math.min(99, Math.round(Number(x.q) || 1)));
    if (availFl.length > 0 && f < 0) {
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
  let cards = [];

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
    cards = cands.slice(0, 6);
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
    cards = [pIdx];
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
        if (Array.isArray(localTurn.cards) && localTurn.cards.length) cards = localTurn.cards;
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
    cards,
    disambiguations,
    missingFlavors: missingFlavors.map((m) => m.i),
    missingQty: missingQty.map((m) => m.i),
    rejectedReasons,
    nextState,
  };
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
    } else if (
      where.all === true ||
      where.category ||
      where.flavor ||
      where.variant ||
      where.pack ||
      where.hidden !== undefined ||
      where.minPrice != null ||
      where.maxPrice != null
    ) {
      matched.push(idx);
    }
  });

  if (namesList.length === 1 && !where.all && matched.length > 1) {
    if (exactNameIndices.length === 1 && !varNorm) {
      return {
        indices: exactNameIndices,
        ambiguous: false,
        partialIgnored: matched.filter((i) => i !== exactNameIndices[0]),
      };
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
      const pinnedOp = { ...op, resolvedIndices: indicesToApply };
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
        if (d.setPieces != null && Number(d.setPieces) > 0) {
          changes.push(`عدد القطع: ${Number(d.setPieces)} قطعة`);
        }
        if (d.setSaleUnit && String(d.setSaleUnit).trim()) {
          changes.push(`وحدة البيع: «${String(d.setSaleUnit).trim()}»`);
        }
        if (d.setDesc != null && String(d.setDesc).trim() !== String(p[13] || '')) {
          changes.push(`الوصف: «${String(d.setDesc).trim()}»`);
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

export function validateStagedProductDraft(staged, catalogData = {}) {
  const products = Array.isArray(catalogData.p) ? catalogData.p : [];
  if (!staged || typeof staged !== 'object' || !String(staged.n || '').trim()) {
    return { valid: false, missing: ['اسم المنتج'], duplicates: null };
  }
  const missing = [];
  if (!(Number(staged.p) > 0)) missing.push('السعر');
  const dup = checkProductDuplicates(staged, products);
  return {
    valid: missing.length === 0,
    missing,
    duplicates: dup,
  };
}
