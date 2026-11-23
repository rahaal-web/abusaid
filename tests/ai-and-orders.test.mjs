import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyValidatedAdminOps,
  buildOneShotCustomerDraft,
  buildStoreKB,
  checkProductDuplicates,
  computeDraftTotals,
  dedupeAndNormalizeDraft,
  getProductFlavors,
  isHollowAiReply,
  parseAdminLocalTurn,
  previewAndValidateAdminOps,
  processCustomerTurn,
  validateCustomerGeminiResponse,
} from '../js/ai-engine.js';
import { DEFAULT_DATA } from '../lib/defaultData.js';
import { generateGeminiServer } from '../lib/geminiServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function makeTestCatalog() {
  // [0 name, 1 cat, 2 pack, 3 price, 4 bg1, 5 bg2, 6 emoji, 7 hidden, 8 img, 9 flavors, 10 variant, 11 oldPrice]
  return {
    cats: ['شيبسي', 'سناكس', 'حلويات', 'مشروبات'],
    p: [
      ['شيبسي', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [['ملح وخل', 0], ['جبنة متبلة', 0]], 'صغير', 0],
      ['شيبسي', 'شيبسي', 'كرتونة 12 كيس', 185, '#1', '#2', '🥔', 0, '', [['ملح وخل', 0], ['طماطم', 0]], 'عائلي', 0],
      ['دوريتوس', 'سناكس', 'كرتونة 20 كيس', 120, '#1', '#2', '🔺', 0, '', [['جبنة', 0], ['فلفل حلو', 0]], '', 0],
      ['جاجوار', 'سناكس', 'كرتونة 24 كيس', 130, '#1', '#2', '🐆', 0, '', [['جبنة', 0], ['شطة', 0], ['باربكيو', 1]], '', 0],
      ['فريسكا', 'حلويات', 'علبة 24 قطعة', 90, '#1', '#2', '🍫', 0, '', [], '', 0],
      ['مولتو', 'حلويات', 'كرتونة 12 باكو', 150, '#1', '#2', '🥐', 0, '', [['شوكولاتة', 0], ['جبنة', 0]], '', 0],
      ['عصير بيتي', 'مشروبات', 'كرتونة 27 علبة', 160, '#1', '#2', '🧃', 0, '', [['مانجو', 0], ['تفاح', 0]], '200 مل', 0],
      ['صنف مخفي', 'سناكس', 'كرتونة', 99, '#1', '#2', '🚫', 1, '', [], '', 0],
    ],
    offers: [
      { t: 'عرض الافتتاح الساري', d: 'خصم على جاجوار', pr: '115 ج', g: 'ساري', startDate: '2020-01-01', endDate: '2099-12-31', x: 0 },
      { t: 'عرض منتهي الصلاحية', d: 'خصم قديم', pr: '80 ج', g: 'منتهي', startDate: '2020-01-01', endDate: '2021-01-01', x: 0 },
      { t: 'عرض معطل', d: 'معطل', pr: '70 ج', g: 'موقوف', startDate: '2020-01-01', endDate: '2099-12-31', x: 1 },
    ],
  };
}

const results = [];
async function runCase(group, name, fn) {
  try {
    await fn();
    results.push({ group, name, ok: true });
    console.log(`PASS [${group}] ${name}`);
  } catch (err) {
    results.push({ group, name, ok: false, error: err?.message || String(err) });
    console.error(`FAIL [${group}] ${name}:`, err);
    throw err;
  }
}

// =========================================================================
// PART 1: CUSTOMER AI — CORE SCENARIOS + MULTI-TURN CONVERSATIONS
// =========================================================================
async function runCustomerSuite() {
  const catData = makeTestCatalog();
  const catPackData = { ...makeTestCatalog(), cfg: { unit: 'علبة', brandName: 'أبو سعيد' } };
  const catCartonData = { ...makeTestCatalog(), cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' } };
  const kbCarton = buildStoreKB(catCartonData, '2026-06-15');

  // C1: Natural Egyptian multi-item + typos ("عايز 2 شبسي صغير جبنة متبلة واتنين دريتوس بالجبنة")
  await runCase('Customer AI', 'C1: Natural Egyptian order with typos & exact flavor', () => {
    const res = processCustomerTurn({
      text: 'عايز 2 شبسي صغير جبنة متبلة واتنين دريتوس بالجبنة',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft[0].i, 0);
    assert.equal(res.draft[0].f, 1);
    assert.equal(res.draft[0].q, 2);
    assert.equal(res.draft[1].i, 2);
    assert.equal(res.draft[1].f, 0);
    assert.equal(res.draft[1].q, 2);
  });

  // C2: Arabic numerals & word forms ("٣ كراتين فريسكا وتلاتة مولتو شوكولاتة")
  await runCase('Customer AI', 'C2: Arabic numerals & word forms', () => {
    const res = processCustomerTurn({
      text: '٣ كراتين فريسكا وتلاتة مولتو شوكولاتة',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft[0].i, 4);
    assert.equal(res.draft[0].f, -1);
    assert.equal(res.draft[0].q, 3);
    assert.equal(res.draft[1].i, 5);
    assert.equal(res.draft[1].f, 0);
    assert.equal(res.draft[1].q, 3);
  });

  // C3: Unit policy ("دستة" allowed in علبة = 12, rejected/warned in كرتونة; "كرتونتين" = 2)
  await runCase('Customer AI', 'C3: Store unit policy for دستة vs كرتونتين', () => {
    const resPack = processCustomerTurn({
      text: 'عايز دستة فريسكا',
      catalogData: catPackData,
      currentDraft: [],
    });
    assert.equal(resPack.draft.length, 1);
    assert.equal(resPack.draft[0].i, 4);
    assert.equal(resPack.draft[0].q, 12);

    const resCarton = processCustomerTurn({
      text: 'عايز دستة فريسكا',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(resCarton.draft.length, 0);
    assert.match(resCarton.reply, /كرتونة|وحدة البيع/);

    const resDual = processCustomerTurn({
      text: 'عايز كرتونتين فريسكا',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(resDual.draft.length, 1);
    assert.equal(resDual.draft[0].i, 4);
    assert.equal(resDual.draft[0].q, 2);
  });

  // C4: Multiple flavors from same product ("عايز كرتونتين جاجوار جبنة وكرتونة شطة")
  await runCase('Customer AI', 'C4: Multiple flavors on same product preserve quantities', () => {
    const res = processCustomerTurn({
      text: 'عايز كرتونتين جاجوار جبنة وكرتونة شطة',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft[0].i, 3);
    assert.equal(res.draft[0].f, 0);
    assert.equal(res.draft[0].q, 2);
    assert.equal(res.draft[1].i, 3);
    assert.equal(res.draft[1].f, 1);
    assert.equal(res.draft[1].q, 1);
  });

  // C5: "أي نكهة" / "مش فارقة" refuses premature addition and prompts real flavors
  await runCase('Customer AI', 'C5: أي نكهة / مش فارقة requires picking a real flavor first', () => {
    const t1 = processCustomerTurn({
      text: 'عايز كرتونتين جاجوار أي نكهة',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 0);
    assert.equal(t1.nextState.pendingClarification?.type, 'flavor');
    assert.match(t1.reply, /جبنة.*شطة|شطة.*جبنة/);

    const t2 = processCustomerTurn({
      text: 'شطة',
      catalogData: catCartonData,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(t2.draft.length, 1);
    assert.equal(t2.draft[0].i, 3);
    assert.equal(t2.draft[0].f, 1);
    assert.equal(t2.draft[0].q, 2);
  });

  // C6: Unavailable & hidden/sold-out flavors rejected with available options listed
  await runCase('Customer AI', 'C6: Unavailable/hidden flavor rejected and lists real flavors', () => {
    const resHidden = processCustomerTurn({
      text: 'عايز كرتونة جاجوار باربكيو',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(resHidden.draft.length, 0);
    assert.match(resHidden.reply, /خلصانة|غير متاحة/);
    assert.match(resHidden.reply, /جبنة/);
    assert.match(resHidden.reply, /شطة/);

    const resMissing = processCustomerTurn({
      text: 'عايز كرتونة جاجوار كاتشب',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(resMissing.draft.length, 0);
    assert.match(resMissing.reply, /غير متاحة/);
  });

  // C7: "عايز كرتونة من كل نكهة في جاجوار" expands active non-hidden flavors only
  await runCase('Customer AI', 'C7: من كل نكهة expands only available active flavors', () => {
    const res = processCustomerTurn({
      text: 'عايز كرتونة من كل نكهة في جاجوار',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft[0].i, 3);
    assert.equal(res.draft[0].f, 0);
    assert.equal(res.draft[1].i, 3);
    assert.equal(res.draft[1].f, 1);
  });

  // C8: "عايز كرتونتين من كل نوع" in category ("في قسم الحلويات")
  await runCase('Customer AI', 'C8: من كل نوع in category or family works cleanly', () => {
    const res = processCustomerTurn({
      text: 'عايز كرتونتين من كل نوع في شيبسي',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft[0].i, 0);
    assert.equal(res.draft[0].q, 2);
    assert.equal(res.draft[1].i, 1);
    assert.equal(res.draft[1].q, 2);
  });

  // C9: Ambiguous similar product names ("شيبسي صغير" vs "شيبسي عائلي") -> disambiguate then flavor then qty
  await runCase('Customer AI', 'C9: Ambiguous product triggers clarification & resolves next turn', () => {
    const turn1 = processCustomerTurn({
      text: 'عايز كرتونتين شيبسي',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(turn1.draft.length, 0);
    assert.equal(turn1.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.equal(turn1.nextState.pendingClarification.candidates.length, 2);
    assert.equal(isHollowAiReply(turn1.reply), false);

    const turn2 = processCustomerTurn({
      text: '2',
      catalogData: catCartonData,
      currentDraft: turn1.draft,
      convState: turn1.nextState,
    });
    assert.equal(turn2.nextState.pendingClarification?.type, 'flavor');
    assert.equal(turn2.nextState.pendingClarification?.prodIdx, 1);

    const turn3 = processCustomerTurn({
      text: 'طماطم',
      catalogData: catCartonData,
      currentDraft: turn2.draft,
      convState: turn2.nextState,
    });
    assert.equal(turn3.nextState.pendingClarification, null);
    assert.equal(turn3.draft.length, 1);
    assert.equal(turn3.draft[0].i, 1);
    assert.equal(turn3.draft[0].f, 1);
    assert.equal(turn3.draft[0].q, 2);
  });

  // C10: Nonexistent product never invents or picks wrong close item
  await runCase('Customer AI', 'C10: Nonexistent product refuses hallucination & keeps draft clean', () => {
    const res = processCustomerTurn({
      text: 'عايز 3 كراتين بيبسي دايت تلاتين لتر',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 0);
    assert.match(res.reply, /لم أجد/);
    assert.equal(isHollowAiReply(res.reply), false);

    const res2 = processCustomerTurn({
      text: 'عايز كرتونتين اندومي بالخضار',
      catalogData: DEFAULT_DATA,
      currentDraft: [],
    });
    assert.equal(res2.draft.length, 0);
    assert.match(res2.reply, /لم أجد/);
    assert.ok(res2.quick.length > 0);
  });

  // C11: Multi-turn slot filling (product -> flavor -> quantity)
  await runCase('Customer AI', 'C11: Multi-turn slot filling preserves context cleanly', () => {
    const t1 = processCustomerTurn({
      text: 'عايز جاجوار',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 0);
    assert.equal(t1.nextState.pendingClarification?.type, 'flavor');
    assert.equal(t1.nextState.pendingClarification?.prodIdx, 3);

    const t2 = processCustomerTurn({
      text: 'شطة',
      catalogData: catCartonData,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(t2.draft.length, 0);
    assert.equal(t2.nextState.pendingClarification?.type, 'qty');

    const t3 = processCustomerTurn({
      text: 'كرتونة',
      catalogData: catCartonData,
      currentDraft: t2.draft,
      convState: t2.nextState,
    });
    assert.equal(t3.nextState.pendingClarification, null);
    assert.equal(t3.draft.length, 1);
    assert.equal(t3.draft[0].i, 3);
    assert.equal(t3.draft[0].f, 1);
    assert.equal(t3.draft[0].q, 1);
  });

  // C12: Stateful draft mutations (add, increase, decrease, change flavor, remove item, clear all)
  await runCase('Customer AI', 'C12: Draft mutations (add, inc, dec, change flavor, delete item, clear)', () => {
    const t1 = processCustomerTurn({
      text: 'عايز كرتونتين فريسكا وكرتونة جاجوار جبنة',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 2);

    const tInc = processCustomerTurn({
      text: 'زود فريسكا 3 كراتين',
      catalogData: catCartonData,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(tInc.draft.find((x) => x.i === 4).q, 5);

    const tDec = processCustomerTurn({
      text: 'نقص فريسكا كرتونة',
      catalogData: catCartonData,
      currentDraft: tInc.draft,
      convState: tInc.nextState,
    });
    assert.equal(tDec.draft.find((x) => x.i === 4).q, 4);
    assert.equal(tDec.draft.find((x) => x.i === 3).q, 1);

    const tFlav = processCustomerTurn({
      text: 'غير نكهة جاجوار لـ شطة',
      catalogData: catCartonData,
      currentDraft: tDec.draft,
      convState: tDec.nextState,
    });
    assert.equal(tFlav.draft.find((x) => x.i === 3).f, 1);
    assert.match(tFlav.reply, /شطة/);

    const tDel = processCustomerTurn({
      text: 'امسح جاجوار',
      catalogData: catCartonData,
      currentDraft: tFlav.draft,
      convState: tFlav.nextState,
    });
    assert.equal(tDel.draft.length, 1);
    assert.equal(tDel.draft[0].i, 4);
    assert.equal(tDel.draft[0].q, 4);

    const tClr = processCustomerTurn({
      text: 'امسح الطلب كله',
      catalogData: catCartonData,
      currentDraft: tDel.draft,
      convState: tDel.nextState,
    });
    assert.equal(tClr.draft.length, 0);
  });

  // C13: Offers filtering (only active non-expired offers appear in KB & replies)
  await runCase('Customer AI', 'C13: Offers respect active status and date range', () => {
    assert.equal(kbCarton.offers.length, 1);
    assert.equal(kbCarton.offers[0].t, 'عرض الافتتاح الساري');

    const res = processCustomerTurn({
      text: 'ايه العروض المتاحة؟',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.match(res.reply, /عرض الافتتاح الساري/);
    assert.doesNotMatch(res.reply, /منتهي الصلاحية/);
    assert.doesNotMatch(res.reply, /عرض معطل/);
  });

  // C14: Server/Gemini hallucination filter (`validateCustomerGeminiResponse`)
  await runCase('Customer AI', 'C14: Validation strips invented/hidden products & incomplete items', () => {
    const validated = validateCustomerGeminiResponse({
      geminiJson: {
        reply: 'تمت إضافة الأصناف',
        intent: 'order',
        items: [
          { i: 3, f: 2, q: 2, a: false },    // f=2 is hidden باربكيو -> rejected with reason
          { i: 7, f: -1, q: 5, a: false },   // i=7 is hidden صنف مخفي -> rejected completely
          { i: 999, f: -1, q: 1, a: false }, // i=999 nonexistent -> rejected completely
          { i: 4, f: -1, q: 3, a: false },   // i=4 فريسكا valid -> kept
        ],
        unknown: [],
        clear: false,
        action: 'none',
      },
      userMessage: 'عايز ٣ فريسكا',
      currentDraft: [{ i: 0, f: 0, q: 1, c: [0], amb: false }],
      catalogData: catCartonData,
    });
    assert.equal(validated.draft.length, 2);
    assert.equal(validated.draft.find((x) => x.i === 4)?.q, 3);
    assert.equal(validated.draft.find((x) => x.i === 3), undefined);
    assert.ok(validated.rejectedReasons.length >= 2);
  });

  // C15: Exact catalog totals & deduplication (`computeDraftTotals`, `dedupeAndNormalizeDraft`)
  await runCase('Customer AI', 'C15: Authoritative catalog totals & item deduplication', () => {
    const merged = dedupeAndNormalizeDraft(
      [
        { i: 4, f: -1, q: 2 },
        { i: 4, f: -1, q: 3 },
        { i: 3, f: 0, q: 1 },
      ],
      catData.p
    );
    assert.equal(merged.length, 2);
    const tot = computeDraftTotals(merged, catData.p);
    // 5 * 90 + 1 * 130 = 580
    assert.equal(tot.totalQty, 6);
    assert.equal(tot.totalPrice, 580);
  });

  // C16 (MANDATORY MULTI-STEP TEST - Deterministic Engine):
  // "عايز كرتونة شيبسي." -> "جاجوار." -> "جبنة." -> "عايز كرتونتين."
  await runCase('Customer AI', 'C16: Mandatory 4-turn sales flow (شيبسي -> جاجوار -> جبنة -> كرتونتين)', () => {
    // Also test with a catalog where جاجوار is inside the شيبسي category AND with makeTestCatalog()
    const chipsWithJaguarCat = makeTestCatalog();
    chipsWithJaguarCat.p[3][1] = 'شيبسي';

    for (const activeCat of [catCartonData, chipsWithJaguarCat]) {
      // Turn 1: "عايز كرتونة شيبسي."
      const t1 = processCustomerTurn({
        text: 'عايز كرتونة شيبسي.',
        catalogData: activeCat,
        currentDraft: [],
      });
      assert.equal(t1.draft.length, 0, 'Must NOT add incomplete item on Turn 1');
      assert.equal(isHollowAiReply(t1.reply), false, 'Reply must never be hollow تمام');
      assert.equal(t1.nextState.pendingClarification?.type, 'disambiguate_product');
      assert.ok(t1.quick.length >= 2, 'Must present available types cleanly');
      assert.match(t1.reply, /شيبسي/);

      // Turn 2: "جاجوار."
      const t2 = processCustomerTurn({
        text: 'جاجوار.',
        catalogData: activeCat,
        currentDraft: t1.draft,
        convState: t1.nextState,
      });
      assert.equal(t2.draft.length, 0, 'Must NOT add جاجوار before flavor & qty are chosen');
      assert.equal(isHollowAiReply(t2.reply), false);
      assert.equal(t2.nextState.pendingClarification?.type, 'flavor');
      assert.equal(t2.nextState.pendingClarification?.prodIdx, 3);
      assert.match(t2.reply, /نكهة|جبنة|شطة/);
      assert.ok(t2.quick.some((q) => q.val.includes('جبنة')));

      // Turn 3: "جبنة." -> "كرتونة" (1) from Turn 1 now completes product + flavor + qty=1 directly into draft card!
      const t3 = processCustomerTurn({
        text: 'جبنة.',
        catalogData: activeCat,
        currentDraft: t2.draft,
        convState: t2.nextState,
      });
      assert.equal(t3.draft.length, 1, 'Must immediately place جاجوار · جبنة (q=1 from كرتونة) into order draft');
      assert.deepEqual(
        { i: t3.draft[0].i, f: t3.draft[0].f, q: t3.draft[0].q },
        { i: 3, f: 0, q: 1 }
      );
      assert.equal(isHollowAiReply(t3.reply), false);
      assert.equal(t3.nextState.pendingClarification, null);
      assert.equal(t3.nextState.lastReferencedProductIdx, 3);
      assert.equal(t3.nextState.lastReferencedFlavorIdx, 0);
      assert.match(t3.reply, /ملخص الطلب/);
      assert.match(t3.reply, /130 جنيه/);

      // Turn 4: "عايز كرتونتين." -> updates quantity of جاجوار · جبنة to 2
      const t4 = processCustomerTurn({
        text: 'عايز كرتونتين.',
        catalogData: activeCat,
        currentDraft: t3.draft,
        convState: t3.nextState,
      });
      assert.equal(t4.nextState.pendingClarification, null);
      assert.equal(t4.draft.length, 1);
      assert.deepEqual(
        { i: t4.draft[0].i, f: t4.draft[0].f, q: t4.draft[0].q },
        { i: 3, f: 0, q: 2 }
      );
      assert.match(t4.reply, /ملخص الطلب/);
      assert.match(t4.reply, /جاجوار/);
      assert.match(t4.reply, /جبنة/);
      assert.match(t4.reply, /260 جنيه/);
      assert.match(t4.reply, /نراجع|للسلة/);
      assert.equal(t4.go, false);

      // Turn 5: "تمام" now legitimately confirms & triggers review
      const t5 = processCustomerTurn({
        text: 'تمام',
        catalogData: activeCat,
        currentDraft: t4.draft,
        convState: t4.nextState,
      });
      assert.equal(t5.go, true);
    }
  });

  // C17: DEFAULT_DATA "عايز كرتونة شيبسي" & Gemini hollow-reply / bad-guess defense (end-to-end chSend pipeline simulation)
  await runCase('Customer AI', 'C17: Hollow Gemini reply ("تمام") & premature guess are blocked across multi-turn Gemini pipeline', async () => {
    // Part A: DEFAULT_DATA with "عايز كرتونة شيبسي" when Gemini returns ONLY {"reply":"تمام","items":[]}
    const defTurn = validateCustomerGeminiResponse({
      geminiJson: { reply: 'تمام', intent: 'order', items: [], unknown: [], clear: false, action: 'none' },
      userMessage: 'عايز كرتونة شيبسي',
      currentDraft: [],
      catalogData: DEFAULT_DATA,
      stateCtx: {},
    });
    assert.equal(defTurn.draft.length, 0);
    assert.equal(isHollowAiReply(defTurn.reply), false);
    assert.equal(defTurn.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.ok(defTurn.quick.length >= 2);

    // Part B: DEFAULT_DATA when Gemini wrongly guesses item 0 (شيبسي ملح) for "عايز كرتونة شيبسي"
    const defWrongGuess = validateCustomerGeminiResponse({
      geminiJson: {
        reply: 'تمام',
        intent: 'order',
        items: [{ i: 0, f: -1, q: 1, a: false }],
        unknown: [],
        clear: false,
        action: 'none',
      },
      userMessage: 'عايز كرتونة شيبسي',
      currentDraft: [],
      catalogData: DEFAULT_DATA,
      stateCtx: {},
    });
    assert.equal(defWrongGuess.draft.length, 0, 'Must never silently add شيبسي ملح when user only wrote شيبسي');
    assert.equal(defWrongGuess.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.equal(isHollowAiReply(defWrongGuess.reply), false);

    // Part C: Full 4-turn Gemini pipeline simulation where Gemini returns hollow "تمام" at every turn!
    let draft = [];
    let stateCtx = {};
    const step1 = validateCustomerGeminiResponse({
      geminiJson: { reply: 'تمام', intent: 'order', items: [], unknown: [], clear: false, action: 'none' },
      userMessage: 'عايز كرتونة شيبسي.',
      currentDraft: draft,
      catalogData: catCartonData,
      stateCtx,
    });
    assert.equal(step1.draft.length, 0);
    assert.equal(isHollowAiReply(step1.reply), false);
    assert.equal(step1.nextState.pendingClarification?.type, 'disambiguate_product');
    draft = step1.draft;
    stateCtx = step1.nextState;

    const step2 = validateCustomerGeminiResponse({
      geminiJson: { reply: 'تمام', intent: 'order', items: [{ i: 3, f: -1, q: 1, a: false }], unknown: [], clear: false, action: 'none' },
      userMessage: 'جاجوار.',
      currentDraft: draft,
      catalogData: catCartonData,
      stateCtx,
    });
    assert.equal(step2.draft.length, 0);
    assert.equal(isHollowAiReply(step2.reply), false);
    assert.equal(step2.nextState.pendingClarification?.type, 'flavor');
    draft = step2.draft;
    stateCtx = step2.nextState;

    const step3 = validateCustomerGeminiResponse({
      geminiJson: { reply: 'حاضر', intent: 'order', items: [{ i: 3, f: 0, q: 1, a: false }], unknown: [], clear: false, action: 'none' },
      userMessage: 'جبنة.',
      currentDraft: draft,
      catalogData: catCartonData,
      stateCtx,
    });
    assert.equal(step3.draft.length, 1, 'With كرتونة preserved from step 1, choosing flavor adds q=1 to draft card');
    assert.deepEqual(
      { i: step3.draft[0].i, f: step3.draft[0].f, q: step3.draft[0].q },
      { i: 3, f: 0, q: 1 }
    );
    assert.equal(isHollowAiReply(step3.reply), false);
    assert.equal(step3.nextState.pendingClarification, null);
    draft = step3.draft;
    stateCtx = step3.nextState;

    const step4 = validateCustomerGeminiResponse({
      geminiJson: { reply: 'تمام', intent: 'order', items: [], unknown: [], clear: false, action: 'none' },
      userMessage: 'عايز كرتونتين.',
      currentDraft: draft,
      catalogData: catCartonData,
      stateCtx,
    });
    assert.equal(step4.draft.length, 1);
    assert.equal(step4.draft[0].i, 3);
    assert.equal(step4.draft[0].f, 0);
    assert.equal(step4.draft[0].q, 2);
    assert.match(step4.reply, /ملخص الطلب/);
    assert.match(step4.reply, /260 جنيه/);
  });

  // C18: Cross-segment flavor inheritance stays on previous product even if another catalog item has "ملح"
  await runCase('Customer AI', 'C18: "عايز 3 كراتين دوريتوس شطة و2 ملح" inherits دوريتوس instead of jumping to شيبسي ملح', () => {
    const saltCat = {
      cats: ['شيبسي', 'سناكس'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي ملح', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [], '', 0],
        ['دوريتوس', 'شيبسي', 'كرتونة 24 كيس', 260, '#1', '#2', '🔺', 0, '', [['ملح', 0], ['خل', 0], ['شطة', 0]], '', 0],
      ],
      offers: [],
    };
    const res = processCustomerTurn({
      text: 'عايز 3 كراتين دوريتوس شطة و2 ملح',
      catalogData: saltCat,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.deepEqual(
      res.draft.map((x) => ({ i: x.i, f: x.f, q: x.q })),
      [
        { i: 1, f: 2, q: 3 },
        { i: 1, f: 0, q: 2 },
      ]
    );
  });

  // C19: Single-segment multi-flavor ("عايز كرتونتين دوريتوس جبنة وفلفل حلو" + missing-qty slot fill)
  await runCase('Customer AI', 'C19: Single-segment multi-flavor preserves all matched flavors with and without quantity', () => {
    const resWithQty = processCustomerTurn({
      text: 'عايز كرتونتين دوريتوس جبنة وفلفل حلو',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(resWithQty.draft.length, 2);
    assert.deepEqual(
      resWithQty.draft.map((x) => ({ i: x.i, f: x.f, q: x.q })).sort((a, b) => a.f - b.f),
      [
        { i: 2, f: 0, q: 2 },
        { i: 2, f: 1, q: 2 },
      ]
    );

    const t1 = processCustomerTurn({
      text: 'عايز دوريتوس جبنة وفلفل حلو',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 0);
    assert.equal(t1.nextState.pendingClarification?.type, 'qty');
    assert.deepEqual([...(t1.nextState.pendingClarification?.flavorIndices || [])].sort((a, b) => a - b), [0, 1]);

    const t2 = processCustomerTurn({
      text: '3',
      catalogData: catCartonData,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(t2.draft.length, 2);
    assert.deepEqual(
      t2.draft.map((x) => ({ i: x.i, f: x.f, q: x.q })).sort((a, b) => a.f - b.f),
      [
        { i: 2, f: 0, q: 3 },
        { i: 2, f: 1, q: 3 },
      ]
    );
  });

  // C20: Mandatory Case 1 + 5-item repeated order: never merges distinct items, never drops items, never guesses جاكودار->جاجوار, accumulates شيبسي=2
  await runCase('Customer AI', 'C20: Independent extraction, repetition accumulation, unknown reporting & multi-turn queue (5-item order)', () => {
    const richCat = {
      cats: ['شيبسي', 'سناكس', 'حلويات', 'مشروبات'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [['ملح وخل', 0], ['جبنة متبلة', 0]], 'صغير', 0],
        ['شيبسي', 'شيبسي', 'كرتونة 12 كيس', 185, '#1', '#2', '🥔', 0, '', [['ملح وخل', 0], ['طماطم', 0]], 'عائلي', 0],
        ['دوريتوس', 'سناكس', 'كرتونة 20 كيس', 120, '#1', '#2', '🔺', 0, '', [['جبنة', 0], ['فلفل حلو', 0]], '', 0],
        ['جاجوار', 'سناكس', 'كرتونة 24 كيس', 130, '#1', '#2', '🐆', 0, '', [['جبنة', 0], ['شطة', 0]], '', 0],
        ['مياه غازية', 'مشروبات', 'كرتونة 24 كانز', 145, '#1', '#2', '🥤', 0, '', [], '', 0],
      ],
      offers: [],
    };

    // Part A: Exact 3-item prompt from requirements
    const oneShotA = buildOneShotCustomerDraft({
      text: 'عايز كرتونة شيبسي وكرتونة جاكودار و3 كراتين دوريتوس',
      catalogData: richCat,
    });
    assert.ok(oneShotA.unk.some((u) => /جاكودار/.test(u)), 'جاكودار must appear in unk, never guessed as جاجوار');
    assert.equal(oneShotA.items.some((x) => x.i === 3), false, 'Must NEVER pick جاجوار for جاكودار');
    assert.equal(oneShotA.items.find((x) => x.i === 0)?.q, 1);
    assert.equal(oneShotA.items.find((x) => x.i === 0)?.amb, true);
    assert.equal(oneShotA.items.find((x) => x.i === 2)?.q, 3);

    // Part B: 5-item prompt with repeated شيبسي
    const msg5 = 'عايز كرتونة شيبسي وكرتونة شيبسي وكرتونة جاكودار وكرتونة مياه غازية و3 كراتين دوريتوس';
    const oneShotB = buildOneShotCustomerDraft({ text: msg5, catalogData: richCat });
    assert.ok(oneShotB.unk.some((u) => /جاكودار/.test(u)));
    assert.equal(oneShotB.items.some((x) => x.i === 3), false, 'جاجوار must never be guessed for جاكودار');
    assert.equal(oneShotB.items.find((x) => x.i === 0)?.q, 2, 'Repeated شيبسي accumulates to 2');
    assert.equal(oneShotB.items.find((x) => x.i === 4)?.q, 1, 'مياه غازية must have q=1');
    assert.equal(oneShotB.items.find((x) => x.i === 2)?.q, 3, 'دوريتوس must keep q=3');

    // Chat multi-turn queue flow on msg5
    const t1 = processCustomerTurn({ text: msg5, catalogData: richCat, currentDraft: [] });
    assert.equal(t1.draft.length, 1);
    assert.equal(t1.draft[0].i, 4);
    assert.equal(t1.draft[0].q, 1);
    assert.match(t1.reply, /جاكودار/, 'Reply must explicitly report unrecognized جاكودار');
    assert.equal(t1.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.equal(t1.nextState.pendingClarification?.explicitQty, 2, 'Repeated شيبسي accumulates qty=2');
    assert.equal(t1.nextState.pendingQueue.length, 1);
    assert.equal(t1.nextState.pendingQueue[0].prodIdx, 2);
    assert.equal(t1.nextState.pendingQueue[0].explicitQty, 3);

    const t2 = processCustomerTurn({ text: 'صغير', catalogData: richCat, currentDraft: t1.draft, convState: t1.nextState });
    assert.equal(t2.nextState.pendingClarification?.type, 'flavor');
    assert.equal(t2.nextState.pendingClarification?.prodIdx, 0);
    assert.equal(t2.nextState.pendingClarification?.explicitQty, 2);

    const t3 = processCustomerTurn({ text: 'ملح وخل', catalogData: richCat, currentDraft: t2.draft, convState: t2.nextState });
    assert.equal(t3.draft.find((x) => x.i === 0 && x.f === 0)?.q, 2);
    assert.equal(t3.nextState.pendingClarification?.type, 'flavor', 'Queue must advance to دوريتوس flavor');
    assert.equal(t3.nextState.pendingClarification?.prodIdx, 2);
    assert.equal(t3.nextState.pendingClarification?.explicitQty, 3);

    const t4 = processCustomerTurn({ text: 'جبنة', catalogData: richCat, currentDraft: t3.draft, convState: t3.nextState });
    assert.equal(t4.nextState.pendingClarification, null);
    assert.equal(t4.draft.length, 3);
    assert.equal(t4.draft.find((x) => x.i === 4)?.q, 1);
    assert.equal(t4.draft.find((x) => x.i === 0 && x.f === 0)?.q, 2);
    assert.equal(t4.draft.find((x) => x.i === 2 && x.f === 0)?.q, 3);
  });

  // C21: Mandatory Case 2: Attached conjunctions ("ودوريتوس وجاكودار") + disclaimer ("بس مش فاكر الأحجام")
  await runCase('Customer AI', 'C21: Attached conjunctions & size disclaimer extract all 3 items without dropping or guessing', () => {
    const text = 'عايز شيبسي ودوريتوس وجاكودار، بس مش فاكر الأحجام';
    const oneShot = buildOneShotCustomerDraft({ text, catalogData: catCartonData });
    assert.equal(oneShot.items.some((x) => x.i === 0 && x.amb), true, 'شيبسي extracted as ambiguous');
    assert.equal(oneShot.items.some((x) => x.i === 2), true, 'دوريتوس extracted independently');
    assert.equal(oneShot.items.some((x) => x.i === 3), false, 'جاجوار must NOT be guessed for جاكودار');
    assert.ok(oneShot.unk.some((u) => /جاكودار/.test(u)), 'جاكودار reported as unknown');
    assert.equal(oneShot.unk.some((u) => /الاحجام|مش فاكر/.test(u)), false, 'Size disclaimer must not be mislabeled as unknown product');

    const chat = processCustomerTurn({ text, catalogData: catCartonData, currentDraft: [] });
    assert.match(chat.reply, /جاكودار/);
    assert.equal(chat.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.ok(chat.nextState.pendingQueue.some((t) => t.prodIdx === 2), 'دوريتوس stays queued');
  });

  // C22: Mandatory Case 3: "هاتلي 2 دوريتوس وواحد مياه غازية"
  await runCase('Customer AI', 'C22: "هاتلي 2 دوريتوس وواحد مياه غازية" binds exact independent quantities 2 & 1', () => {
    const richCat = {
      cats: ['سناكس', 'مشروبات'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['دوريتوس', 'سناكس', 'كرتونة 20 كيس', 120, '#1', '#2', '🔺', 0, '', [], '', 0],
        ['مياه غازية', 'مشروبات', 'كرتونة 24 كانز', 145, '#1', '#2', '🥤', 0, '', [], '', 0],
      ],
      offers: [],
    };
    const res = processCustomerTurn({
      text: 'هاتلي 2 دوريتوس وواحد مياه غازية',
      catalogData: richCat,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft.find((x) => x.i === 0)?.q, 2);
    assert.equal(res.draft.find((x) => x.i === 1)?.q, 1);
  });

  // C23: Mandatory Case 4: Fractional quantities ("عايز نصف كرتونة شيبسي و2 دوريتوس", "كرتونة ونص", "ربع")
  await runCase('Customer AI', 'C23: Fractional quantities (نصف كرتونة / 0.5 / ربع / كرتونة ونص) preserved in draft, queue & totals', () => {
    const singleCat = {
      cats: ['شيبسي', 'سناكس'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي عائلي', 'شيبسي', 'كرتونة 12 كيس', 200, '#1', '#2', '🥔', 0, '', [], '', 0],
        ['دوريتوس', 'سناكس', 'كرتونة 20 كيس', 120, '#1', '#2', '🔺', 0, '', [], '', 0],
      ],
      offers: [],
    };
    const res = processCustomerTurn({
      text: 'عايز نصف كرتونة شيبسي عائلي و2 دوريتوس',
      catalogData: singleCat,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 2);
    assert.equal(res.draft.find((x) => x.i === 0)?.q, 0.5);
    assert.equal(res.draft.find((x) => x.i === 1)?.q, 2);
    const tot = computeDraftTotals(res.draft, singleCat.p);
    assert.equal(tot.totalQty, 2.5);
    assert.equal(tot.totalPrice, 0.5 * 200 + 2 * 120);

    // Multi-variant ambiguous شيبسي preserves explicitQty = 0.5 in pendingClarification & one-shot!
    const ambHalf = processCustomerTurn({
      text: 'عايز نصف كرتونة شيبسي و2 دوريتوس',
      catalogData: catCartonData,
      currentDraft: [],
    });
    assert.equal(ambHalf.nextState.pendingClarification?.explicitQty, 0.5);
    assert.equal(ambHalf.nextState.pendingQueue[0]?.explicitQty, 2);

    const oneHalf = buildOneShotCustomerDraft({
      text: 'عايز نصف كرتونة شيبسي و2 دوريتوس',
      catalogData: catCartonData,
    });
    assert.equal(oneHalf.items.find((x) => x.i === 0)?.q, 0.5);
    assert.equal(oneHalf.items.find((x) => x.i === 2)?.q, 2);

    // Compound fraction "كرتونة ونص"
    const compound = processCustomerTurn({
      text: 'عايز كرتونة ونص دوريتوس وربع شيبسي عائلي',
      catalogData: singleCat,
      currentDraft: [],
    });
    assert.equal(compound.draft.find((x) => x.i === 1)?.q, 1.5);
    assert.equal(compound.draft.find((x) => x.i === 0)?.q, 0.25);
  });

  // C24: Mandatory Case 5: Uncertain product name ("مش عارف اسم المنتج بالظبط، تقريبا جاجور أو حاجه شبيهه")
  await runCase('Customer AI', 'C24: Uncertain query NEVER auto-adds product and asks confirmation first', () => {
    const text = 'مش عارف اسم المنتج بالظبط، تقريبا جاجور أو حاجه شبيهه';
    const t1 = processCustomerTurn({ text, catalogData: catCartonData, currentDraft: [] });
    assert.equal(t1.draft.length, 0, 'Must NEVER silently add جاجوار when user is unsure');
    assert.equal(t1.nextState.pendingClarification?.type, 'confirm_suggestion');
    assert.ok(t1.nextState.pendingClarification.candidates.includes(3));
    assert.match(t1.reply, /جاجوار/);
    assert.ok(t1.quick.some((q) => q.val.includes('جاجوار')));

    // Confirm -> moves to flavor, STILL doesn't blind-add without flavor + qty
    const t2 = processCustomerTurn({
      text: 'أيوه جاجوار',
      catalogData: catCartonData,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(t2.draft.length, 0);
    assert.equal(t2.nextState.pendingClarification?.type, 'flavor');
    assert.equal(t2.nextState.pendingClarification?.prodIdx, 3);

    // One-shot mode also never puts unconfirmed جاجوار into confirmed items
    const oneShot = buildOneShotCustomerDraft({ text, catalogData: catCartonData });
    assert.equal(oneShot.items.length, 0);
    assert.ok(oneShot.unk.some((u) => /جاجور.*جاجوار/.test(u)));
  });

  // C25: Mandatory Case 6: Cross-item variant reference ("عايز كرتونتين شيبسي ونفس الحجم دوريتوس")
  await runCase('Customer AI', 'C25: "عايز كرتونتين شيبسي ونفس الحجم دوريتوس" carries chosen size across queue without guessing qty', () => {
    const varCat = {
      cats: ['شيبسي', 'سناكس'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [], 'صغير', 0],
        ['شيبسي', 'شيبسي', 'كرتونة 12 كيس', 185, '#1', '#2', '🥔', 0, '', [], 'عائلي', 0],
        ['دوريتوس', 'سناكس', 'كرتونة 24 كيس', 125, '#1', '#2', '🔺', 0, '', [], 'صغير', 0],
        ['دوريتوس', 'سناكس', 'كرتونة 12 كيس', 200, '#1', '#2', '🔺', 0, '', [], 'عائلي', 0],
      ],
      offers: [],
    };
    const t1 = processCustomerTurn({
      text: 'عايز كرتونتين شيبسي ونفس الحجم دوريتوس',
      catalogData: varCat,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 0);
    assert.equal(t1.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.equal(t1.nextState.pendingClarification?.explicitQty, 2);
    assert.equal(t1.nextState.pendingQueue.length, 1);
    assert.equal(t1.nextState.pendingQueue[0].variantRef, true);

    const t2 = processCustomerTurn({
      text: 'عائلي',
      catalogData: varCat,
      currentDraft: t1.draft,
      convState: t1.nextState,
    });
    assert.equal(t2.draft.find((x) => x.i === 1)?.q, 2, 'شيبسي عائلي added with qty=2');
    assert.equal(t2.nextState.lastResolvedVariant, 'عائلي');
    assert.equal(t2.nextState.pendingClarification?.type, 'qty', 'دوريتوس عائلي auto-narrowed by same variant and asks qty');
    assert.equal(t2.nextState.pendingClarification?.prodIdx, 3);

    const t3 = processCustomerTurn({
      text: '3',
      catalogData: varCat,
      currentDraft: t2.draft,
      convState: t2.nextState,
    });
    assert.equal(t3.draft.length, 2);
    assert.equal(t3.draft.find((x) => x.i === 1)?.q, 2);
    assert.equal(t3.draft.find((x) => x.i === 3)?.q, 3);
  });

  // C26: Adversarial Gemini audit (`validateCustomerGeminiResponse` catches dropped items, swapped qty, lookalike guess, rounded 0.5)
  await runCase('Customer AI', 'C26: Programmatic Guard 3 catches dropped items, swapped qtys, lookalike guesses, and rounded 0.5 in Gemini output', () => {
    const richCat = {
      cats: ['شيبسي', 'سناكس', 'مشروبات'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [['ملح وخل', 0]], 'صغير', 0],
        ['شيبسي', 'شيبسي', 'كرتونة 12 كيس', 185, '#1', '#2', '🥔', 0, '', [['طماطم', 0]], 'عائلي', 0],
        ['دوريتوس', 'سناكس', 'كرتونة 20 كيس', 120, '#1', '#2', '🔺', 0, '', [], '', 0],
        ['جاجوار', 'سناكس', 'كرتونة 24 كيس', 130, '#1', '#2', '🐆', 0, '', [], '', 0],
        ['مياه غازية', 'مشروبات', 'كرتونة 24 كانز', 145, '#1', '#2', '🥤', 0, '', [], '', 0],
      ],
      offers: [],
    };

    // Gemini drops مياه غازية, guesses شيبسي صغير q=1, guesses جاجوار for جاكودار, swaps دوريتوس qty to 1 instead of 3, and sets action=review!
    const badGem = validateCustomerGeminiResponse({
      geminiJson: {
        reply: 'تمام ضفتلك الطلب',
        intent: 'order',
        items: [
          { i: 0, f: 0, q: 1, a: false },
          { i: 3, f: -1, q: 1, a: false },
          { i: 2, f: -1, q: 1, a: false },
        ],
        unknown: [],
        clear: false,
        action: 'review',
      },
      userMessage: 'عايز كرتونة شيبسي وكرتونة شيبسي وكرتونة جاكودار وكرتونة مياه غازية و3 كراتين دوريتوس',
      currentDraft: [],
      catalogData: richCat,
      stateCtx: {},
    });

    assert.equal(badGem.action, 'none', 'Must block action=review when unknowns or disambiguations exist');
    assert.equal(badGem.draft.some((x) => x.i === 3), false, 'Must strip hallucinated جاجوار guess');
    assert.equal(badGem.draft.some((x) => x.i === 0), false, 'Must strip guessed شيبسي صغير');
    assert.equal(badGem.draft.find((x) => x.i === 4)?.q, 1, 'Must recover dropped مياه غازية with q=1');
    assert.equal(badGem.draft.find((x) => x.i === 2)?.q, 3, 'Must restore swapped دوريتوس qty to 3');
    assert.ok(badGem.unknown.some((u) => /جاكودار/.test(u)), 'Must report جاكودار in unknown');
    assert.equal(badGem.nextState.pendingClarification?.type, 'disambiguate_product');
    assert.equal(badGem.nextState.pendingClarification?.explicitQty, 2, 'Must preserve accumulated qty=2 for repeated شيبسي');

    // Gemini rounds 0.5 up to 1 & guesses جاجوار on uncertain prompt -> corrected programmatically
    const halfGem = validateCustomerGeminiResponse({
      geminiJson: {
        reply: 'تمام',
        intent: 'order',
        items: [
          { i: 4, f: -1, q: 1, a: false },
          { i: 2, f: -1, q: 2, a: false },
        ],
        unknown: [],
        action: 'review',
      },
      userMessage: 'عايز نصف كرتونة مياه غازية و2 دوريتوس',
      currentDraft: [],
      catalogData: richCat,
      stateCtx: {},
    });
    assert.equal(halfGem.draft.find((x) => x.i === 4)?.q, 0.5);
    assert.equal(halfGem.draft.find((x) => x.i === 2)?.q, 2);

    const unsureGem = validateCustomerGeminiResponse({
      geminiJson: {
        reply: 'ضفتلك جاجوار',
        intent: 'order',
        items: [{ i: 3, f: -1, q: 1, a: false }],
        unknown: [],
        action: 'review',
      },
      userMessage: 'مش عارف اسم المنتج بالظبط، تقريبا جاجور أو حاجه شبيهه',
      currentDraft: [],
      catalogData: richCat,
      stateCtx: {},
    });
    assert.equal(unsureGem.draft.length, 0);
    assert.equal(unsureGem.action, 'none');
    assert.equal(unsureGem.nextState.pendingClarification?.type, 'confirm_suggestion');
  });

  // C27: Typos match genuine targets ("شبسي", "دريتوس", "مية غازية") while non-existent lookalike ("جاكودار") never matches "جاجوار"
  await runCase('Customer AI', 'C27: Real typos match while unknown lookalike جاكودار is rejected safely', () => {
    const cat = {
      cats: ['شيبسي', 'سناكس', 'مشروبات'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي عائلي', 'شيبسي', 'كرتونة', 180, '#1', '#2', '🥔', 0, '', [], '', 0],
        ['دوريتوس', 'سناكس', 'كرتونة', 120, '#1', '#2', '🔺', 0, '', [], '', 0],
        ['جاجوار', 'سناكس', 'كرتونة', 130, '#1', '#2', '🐆', 0, '', [], '', 0],
        ['مياه غازية', 'مشروبات', 'كرتونة', 145, '#1', '#2', '🥤', 0, '', [], '', 0],
      ],
      offers: [],
    };
    const typos = processCustomerTurn({
      text: 'عايز 2 شبسي عائلي وكرتونة دريتوس ومية غازية وكرتونة جاكودار',
      catalogData: cat,
      currentDraft: [],
    });
    assert.equal(typos.draft.find((x) => x.i === 0)?.q, 2);
    assert.equal(typos.draft.find((x) => x.i === 1)?.q, 1);
    assert.equal(typos.nextState.pendingClarification?.type, 'qty', 'Unquantified مية غازية asks qty instead of guessing 1');
    assert.equal(typos.nextState.pendingClarification?.prodIdx, 3);
    assert.equal(typos.draft.some((x) => x.i === 2), false, 'جاكودار must NEVER match جاجوار');
    assert.match(typos.reply, /جاكودار/);

    const typos2 = processCustomerTurn({
      text: '1',
      catalogData: cat,
      currentDraft: typos.draft,
      convState: typos.nextState,
    });
    assert.equal(typos2.draft.find((x) => x.i === 3)?.q, 1);

    const typosDirect = processCustomerTurn({
      text: 'عايز 2 شبسي عائلي وكرتونة دريتوس وكرتونة مية غازية وكرتونة جاكودار',
      catalogData: cat,
      currentDraft: [],
    });
    assert.equal(typosDirect.draft.find((x) => x.i === 0)?.q, 2);
    assert.equal(typosDirect.draft.find((x) => x.i === 1)?.q, 1);
    assert.equal(typosDirect.draft.find((x) => x.i === 3)?.q, 1);
    assert.equal(typosDirect.draft.some((x) => x.i === 2), false, 'جاكودار must NEVER match جاجوار');
  });
}

// =========================================================================
// PART 2: ADMIN AI — 15 SCENARIOS
// =========================================================================
async function runAdminSuite() {
  // A1: Complete add product command
  await runCase('Admin AI', 'A1: Add product with price, category & flavors', () => {
    const catData = makeTestCatalog();
    const res = parseAdminLocalTurn({
      text: 'ضيف منتج بسكويت لوكس بسعر 180 قسم الحلويات نكهات فانيليا وشوكولاتة',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 1);
    assert.equal(res.draft[0].n, 'بسكويت لوكس');
    assert.equal(res.draft[0].p, 180);
    assert.equal(res.draft[0].c, 'حلويات');
    assert.deepEqual(res.draft[0].f, ['فانيليا', 'شوكولاتة']);
  });

  // A2: Missing price never invented & follow-up completes draft
  await runCase('Admin AI', 'A2: Missing price asks clarification instead of inventing price', () => {
    const catData = makeTestCatalog();
    const t1 = parseAdminLocalTurn({
      text: 'ضيف منتج كاراتيه جديد قسم السناكس',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(t1.draft.length, 1);
    assert.equal(t1.draft[0].p, 0);
    assert.equal(t1.pendingClarification?.type, 'missing_price');

    const t2 = parseAdminLocalTurn({
      text: 'بسعر 95',
      catalogData: catData,
      currentDraft: t1.draft,
      pendingClarification: t1.pendingClarification,
    });
    assert.equal(t2.pendingClarification, null);
    assert.equal(t2.draft[0].p, 95);
  });

  // A3: Duplicate & similar product detection
  await runCase('Admin AI', 'A3: Duplicate & similar product detection warns clearly', () => {
    const catData = makeTestCatalog();
    const dup = checkProductDuplicates({ n: 'دوريتوس', v: '' }, catData.p);
    assert.ok(dup.exactMatches.length >= 1);

    const t1 = parseAdminLocalTurn({
      text: 'ضيف منتج دوريتوس بسعر 125 قسم سناكس',
      catalogData: catData,
      currentDraft: [],
    });
    assert.match(t1.reply, /مشابه|مكرر/);
    assert.ok(t1.draft[0].w.length >= 1);
  });

  // A4: Edit exact product price with preview + apply
  await runCase('Admin AI', 'A4: Edit exact product price shows preview and updates catalog', () => {
    const catData = makeTestCatalog();
    const res = parseAdminLocalTurn({
      text: 'عدل سعر دوريتوس لـ 145',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(res.pendingOps?.valid);
    assert.match(res.pendingOps.lines[0], /120.*145/);
    const applied = applyValidatedAdminOps(catData, res.pendingOps.ops);
    assert.equal(applied.n, 1);
    assert.equal(catData.p[2][3], 145);
  });

  // A5: Bulk edit across >220 products (verifies NO slice(0, 200) truncation!)
  await runCase('Admin AI', 'A5: Bulk category update across 250+ products (no 200-item limit)', () => {
    const bigCat = makeTestCatalog();
    for (let i = 0; i < 245; i++) {
      bigCat.p.push([`عصير إضافي ${i}`, 'مشروبات', 'كرتونة', 100, '#1', '#2', '🧃', 0, '', [], '', 0]);
    }
    assert.ok(bigCat.p.length > 250);
    const res = parseAdminLocalTurn({
      text: 'زود كل منتجات قسم المشروبات 10 جنيه',
      catalogData: bigCat,
      currentDraft: [],
    });
    assert.ok(res.pendingOps?.valid);
    // 1 initial مشروبات item + 245 added = 246 items!
    assert.equal(res.pendingOps.n, 246);
    applyValidatedAdminOps(bigCat, res.pendingOps.ops);
    // Verify last item (index > 240) was updated too
    assert.equal(bigCat.p[bigCat.p.length - 1][3], 110);
  });

  // A6: Add, remove & hide flavor on existing product
  await runCase('Admin AI', 'A6: Add, remove, and hide flavors via Admin AI', () => {
    const catData = makeTestCatalog();
    const addRes = parseAdminLocalTurn({
      text: 'ضيف نكهة تكساس لمنتج جاجوار',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(addRes.pendingOps?.valid);
    applyValidatedAdminOps(catData, addRes.pendingOps.ops);
    assert.ok(getProductFlavors(catData.p[3]).some((f) => f[0] === 'تكساس'));

    const rmRes = parseAdminLocalTurn({
      text: 'شيل نكهة شطة من جاجوار',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(rmRes.pendingOps?.valid);
    applyValidatedAdminOps(catData, rmRes.pendingOps.ops);
    assert.ok(!getProductFlavors(catData.p[3]).some((f) => f[0] === 'شطة'));

    const hideFlRes = parseAdminLocalTurn({
      text: 'اخفي نكهة جبنة من جاجوار',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(hideFlRes.pendingOps?.valid);
    applyValidatedAdminOps(catData, hideFlRes.pendingOps.ops);
    const cheeseFl = getProductFlavors(catData.p[3]).find((f) => f[0] === 'جبنة');
    assert.equal(cheeseFl[1], 1);
  });

  // A7: Hide & Show product
  await runCase('Admin AI', 'A7: Hide and show product via Admin AI', () => {
    const catData = makeTestCatalog();
    const hRes = parseAdminLocalTurn({ text: 'اخفي منتج دوريتوس', catalogData: catData, currentDraft: [] });
    assert.ok(hRes.pendingOps?.valid);
    applyValidatedAdminOps(catData, hRes.pendingOps.ops);
    assert.equal(catData.p[2][7], 1);

    const sRes = parseAdminLocalTurn({ text: 'اظهر منتج دوريتوس', catalogData: catData, currentDraft: [] });
    assert.ok(sRes.pendingOps?.valid);
    applyValidatedAdminOps(catData, sRes.pendingOps.ops);
    assert.equal(catData.p[2][7], 0);
  });

  // A8: Disambiguation when multiple variants share base name
  await runCase('Admin AI', 'A8: Multi-variant disambiguation before price change', () => {
    const catData = makeTestCatalog();
    const t1 = parseAdminLocalTurn({
      text: 'خلي سعر شيبسي بـ 120',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(t1.pendingOps, null);
    assert.equal(t1.pendingClarification?.type, 'disambiguate_op');
    assert.equal(t1.pendingClarification.candidates.length, 2);

    const t2 = parseAdminLocalTurn({
      text: '2',
      catalogData: catData,
      currentDraft: [],
      pendingClarification: t1.pendingClarification,
    });
    assert.ok(t2.pendingOps?.valid);
    applyValidatedAdminOps(catData, t2.pendingOps.ops);
    assert.equal(catData.p[0][3], 110); // صغير untouched
    assert.equal(catData.p[1][3], 120); // عائلي updated
  });

  // A9: Delete product with similar sibling (exact vs substring safety)
  await runCase('Admin AI', 'A9: Deleting "شيبسي" does NOT accidentally delete "شيبسي عائلي"', () => {
    const catData = {
      cats: ['شيبسي'],
      p: [
        ['شيبسي', 'شيبسي', 'كرتونة', 100, '#1', '#2', '🥔', 0, '', [], '', 0],
        ['شيبسي عائلي', 'شيبسي', 'كرتونة', 200, '#1', '#2', '🥔', 0, '', [], '', 0],
      ],
      offers: [],
    };
    const res = parseAdminLocalTurn({
      text: 'احذف منتج شيبسي',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(res.pendingOps?.valid);
    assert.equal(res.pendingOps.del, 1);
    applyValidatedAdminOps(catData, res.pendingOps.ops);
    assert.equal(catData.p.length, 1);
    assert.equal(catData.p[0][0], 'شيبسي عائلي');
  });

  // A10: List category products
  await runCase('Admin AI', 'A10: List products by category', () => {
    const catData = makeTestCatalog();
    const res = parseAdminLocalTurn({
      text: 'اعرض منتجات قسم الحلويات',
      catalogData: catData,
      currentDraft: [],
    });
    assert.match(res.reply, /فريسكا/);
    assert.match(res.reply, /مولتو/);
    assert.equal(res.pendingOps, null);
  });

  // A11: Search partial / prefix product names
  await runCase('Admin AI', 'A11: Prefix & partial search', () => {
    const catData = makeTestCatalog();
    const res = parseAdminLocalTurn({
      text: 'ابحث عن منتجات تبدأ بـ جاج',
      catalogData: catData,
      currentDraft: [],
    });
    assert.match(res.reply, /جاجوار/);
    assert.doesNotMatch(res.reply, /فريسكا/);
  });

  // A12: Vague delete command ("احذف المنتج الكبير") refuses auto-delete
  await runCase('Admin AI', 'A12: Vague delete "احذف المنتج الكبير" refuses blind deletion', () => {
    const catData = {
      cats: ['شيبسي'],
      p: [
        ['شيبسي', 'شيبسي', 'كرتونة', 110, '#1', '#2', '🥔', 0, '', [], 'كبير', 0],
      ],
      offers: [],
    };
    const res = parseAdminLocalTurn({
      text: 'احذف المنتج الكبير',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(res.pendingOps, null);
    assert.match(res.reply, /غير محدد/);
  });

  // A13: Nonexistent product refuses action cleanly
  await runCase('Admin AI', 'A13: Nonexistent product leaves catalog untouched', () => {
    const catData = makeTestCatalog();
    const before = JSON.stringify(catData.p);
    const res = parseAdminLocalTurn({
      text: 'احذف التشيكن',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(res.pendingOps, null);
    assert.match(res.reply, /لم يتم العثور/);
    assert.equal(JSON.stringify(catData.p), before);
  });

  // A14: Undo snapshot round-trip + preview opId generation
  await runCase('Admin AI', 'A14: opId generation and full undo snapshot round-trip', () => {
    const catData = makeTestCatalog();
    const undoSnap = JSON.stringify(catData);
    const preview = previewAndValidateAdminOps({
      ops: [{ type: 'product', where: { name: 'فريسكا' }, do: { delete: true } }],
      catalogData: catData,
      opId: 'op_test_undo_1',
    });
    assert.equal(preview.opId, 'op_test_undo_1');
    assert.equal(preview.del, 1);
    applyValidatedAdminOps(catData, preview.ops);
    assert.equal(catData.p.some((p) => p[0] === 'فريسكا'), false);
    const restored = JSON.parse(undoSnap);
    assert.equal(restored.p.some((p) => p[0] === 'فريسكا'), true);
  });

  // A15: Gemini Server Wrapper (@google/genai SDK contract, User-Agent, active model, retry, redaction)
  await runCase('Admin AI', 'A15: lib/geminiServer uses @google/genai, User-Agent, active model, retry & key redaction', async () => {
    const fakeSecret = 'TEST_SECRET_KEY_SHOULD_NEVER_APPEAR_IN_LOGS';
    let calls = 0;
    const seenModels = [];
    const seenConfigs = [];
    const origWarn = console.warn;
    const origInfo = console.info;
    const logs = [];
    console.warn = (...args) => logs.push(args.join(' '));
    console.info = (...args) => logs.push(args.join(' '));
    try {
      const result = await generateGeminiServer({
        apiKey: fakeSecret,
        prompt: 'مرحبا',
        systemInstruction: 'تاجر جملة',
        schemaType: 'admin_chat',
        preferredModel: 'gemini-1.5-flash', // Deprecated -> must be filtered out!
        taskType: 'test_retry',
        clientFactory: () => ({
          models: {
            async generateContent(req) {
              calls += 1;
              seenModels.push(req.model);
              seenConfigs.push(req.config);
              if (calls === 1) {
                const err = new Error('transient backend 503');
                err.status = 503;
                throw err;
              }
              return {
                text: JSON.stringify({ reply: 'تم', products: [], ops: [], action: 'none' }),
              };
            },
          },
        }),
      });
      assert.equal(calls, 2);
      assert.ok(!seenModels.includes('gemini-1.5-flash'), 'Deprecated model must never be called');
      assert.equal(seenModels[0], 'gemini-4-hydrogen');
      assert.equal(seenConfigs[0].responseMimeType, 'application/json');
      assert.ok(seenConfigs[0].responseSchema);
      assert.equal(seenConfigs[0].systemInstruction, 'تاجر جملة');
      assert.equal(result.structured.reply, 'تم');
      assert.ok(!logs.join('\n').includes(fakeSecret), 'API key leaked into logs!');
    } finally {
      console.warn = origWarn;
      console.info = origInfo;
    }

    // Verify User-Agent header exists directly in geminiServer.js source
    const gsSrc = fs.readFileSync(path.join(ROOT_DIR, 'lib', 'geminiServer.js'), 'utf8');
    assert.match(gsSrc, /'User-Agent':\s*'aistudio-build'/);
  });

  // A16: Exact user prompt grouped into single product with all 3 flavors, pack, price, category, emoji & duplicate alert
  await runCase('Admin AI', 'A16: Exact multi-flavor single-product command parses all fields without splitting flavors', () => {
    const catData = makeTestCatalog();
    const res = parseAdminLocalTurn({
      text: 'ضيف دوريتوس في قسم الشيبسي، الكرتونة 24 كيس، سعرها 260 جنيه، وعنده نكهات ملح وخل وشطة',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(res.draft.length, 1, 'Multi-flavor product must remain ONE product');
    assert.equal(res.draft[0].n, 'دوريتوس');
    assert.equal(res.draft[0].c, 'شيبسي');
    assert.equal(res.draft[0].d, 'الكرتونة 24 كيس');
    assert.equal(res.draft[0].p, 260);
    assert.deepEqual(res.draft[0].f, ['ملح', 'خل', 'شطة']);
    assert.ok(res.draft[0].e, 'Must assign a suitable emoji');
    assert.ok(res.draft[0].w.some((w) => /مشابه|مكرر/.test(w)), 'Must flag existing دوريتوس similarity');
  });

  // A17: Multi-product batch, multi-variant distinct prices & field edits (pack, oldPrice)
  await runCase('Admin AI', 'A17: Multi-product batch, multi-variant price split & pack/oldPrice edits', () => {
    const catData = makeTestCatalog();

    // Multi-product batch
    const batchRes = parseAdminLocalTurn({
      text: 'ضيف كرانشي بسعر 140 قسم سناكس\nضيف تويست بسعر 95 قسم الحلويات نكهات برتقال وتفاح',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(batchRes.draft.length, 2);
    assert.equal(batchRes.draft[0].n, 'كرانشي');
    assert.equal(batchRes.draft[0].p, 140);
    assert.equal(batchRes.draft[1].n, 'تويست');
    assert.equal(batchRes.draft[1].c, 'حلويات');
    assert.deepEqual(batchRes.draft[1].f, ['برتقال', 'تفاح']);

    // Multi-variant with distinct prices -> separate entries sharing name
    const varRes = parseAdminLocalTurn({
      text: 'ضيف مولتو جديد صغير بـ 100 ووسط بـ 150 قسم الحلويات',
      catalogData: catData,
      currentDraft: [],
    });
    assert.equal(varRes.draft.length, 2);
    assert.deepEqual(
      varRes.draft.map((x) => ({ n: x.n, v: x.v, p: x.p, c: x.c })),
      [
        { n: 'مولتو جديد', v: 'صغير', p: 100, c: 'حلويات' },
        { n: 'مولتو جديد', v: 'وسط', p: 150, c: 'حلويات' },
      ]
    );

    // Pack and oldPrice edits via parseAdminLocalTurn + applyValidatedAdminOps
    const packEdit = parseAdminLocalTurn({
      text: 'عدل العبوة لـ دوريتوس لـ كرتونة 30 كيس',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(packEdit.pendingOps?.valid);
    applyValidatedAdminOps(catData, packEdit.pendingOps.ops);
    assert.equal(catData.p[2][2], 'كرتونة 30 كيس');

    const oldPriceEdit = parseAdminLocalTurn({
      text: 'عدل السعر القديم لـ دوريتوس لـ 150',
      catalogData: catData,
      currentDraft: [],
    });
    assert.ok(oldPriceEdit.pendingOps?.valid);
    applyValidatedAdminOps(catData, oldPriceEdit.pendingOps.ops);
    assert.equal(catData.p[2][11], 150);
  });

  // A18: Verify protected/admin-app.js includes Rahal AI voice, review modal & multi-flavor rules
  await runCase('Admin AI', 'A18: protected/admin-app.js preserves Rahal AI voice, polish & review modal hooks', () => {
    const adminJsSrc = fs.readFileSync(path.join(ROOT_DIR, 'protected', 'admin-app.js'), 'utf8');
    for (const marker of [
      'function vWav(',
      'function vAI(',
      'function vPolish(',
      'function nsame(',
      'function fixList(',
      'function renderSmRvModalDom(',
      'ADMIN_CHAT_SYS',
      'ADMIN_BATCH_SYS',
      'parseAdminLocalTurn',
    ]) {
      assert.ok(adminJsSrc.includes(marker), `admin-app.js missing expected Rahal AI marker: ${marker}`);
    }
  });

  // A19: Admin settings & AI workspace expose aiUi and adminAiUi mode selectors + lock/switch hooks
  await runCase('Admin AI', 'A19: Admin settings & AI workspace control interactive chat vs one-shot mode for Admin & Customer AI', async () => {
    const adminJsSrc = fs.readFileSync(path.join(ROOT_DIR, 'protected', 'admin-app.js'), 'utf8');
    for (const marker of [
      'data-s="aiUi"',
      'data-s="adminAiUi"',
      'function getAdminAiUiMode(',
      'function isAdminAiSwitchAllowed(',
      'function openAdminAiByPreference(',
      'id="smtochat"',
    ]) {
      assert.ok(adminJsSrc.includes(marker), `admin-app.js missing mode selection hook: ${marker}`);
    }

    const { sanitizeCatalogForCustomer } = await import('../lib/firebaseCatalogCore.js');
    const sanitized = sanitizeCatalogForCustomer({
      ts: 123,
      data: {
        cfg: { phone: '201000000000', gk: 'SECRET_KEY', aiUi: 'old_only', adminAiUi: 'batch' },
        cats: [],
        p: [],
        offers: [],
      },
    });
    const parsed = JSON.parse(sanitized.json);
    assert.equal(parsed.cfg.gk, undefined);
    assert.equal(parsed.cfg.aiUi, 'old_only');
  });
}

// =========================================================================
// PART 3: EXPRESS HTTP + SQLITE INTEGRATION (WHATSAPP ORDER DELETION & VALIDATION)
// =========================================================================
function requestJson(server, method, urlPath, { cookie = '', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body != null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: urlPath,
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runHttpAndOrdersIntegrationSuite() {
  const tmpDbPath = path.join(__dirname, `.tmp-test-${Date.now()}.db`);
  process.env.DB_PATH = tmpDbPath;
  process.env.NO_LISTEN = '1';

  const dbMod = await import('../lib/db.js');
  const srvMod = await import('../server.js');
  const server = srvMod.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    // Seed two approved users + sessions + 3 orders + 1 admin session
    const u1 = dbMod.createUser({
      fullName: 'تاجر أول',
      phone: '01011112222',
      shopName: 'ماركت النور',
      password: 'Password123!',
    });
    dbMod.updateUserStatus(u1.id, 'Approved', { reviewedBy: 'test' });
    const s1 = dbMod.createUserSession(u1.id, 'auth');
    const cookieU1 = `abu_session=${encodeURIComponent(s1.rawToken)}`;

    const u2 = dbMod.createUser({
      fullName: 'تاجر ثاني',
      phone: '01033334444',
      shopName: 'ماركت الفجر',
      password: 'Password123!',
    });
    dbMod.updateUserStatus(u2.id, 'Approved', { reviewedBy: 'test' });

    const admSess = dbMod.createAdminSession({
      email: 'admin@abusaid.test',
      uid: 'adm_1',
      fbIdToken: 'fake_fb_token',
      fbRefreshToken: 'fake_fb_refresh',
      fbExpiresInSec: 3600,
    });
    const cookieAdm = `abu_admin_session=${encodeURIComponent(admSess.rawToken)}`;

    dbMod.createOrder({
      id: 'ord_u1_a',
      userId: u1.id,
      userName: u1.full_name,
      userPhone: u1.phone,
      items: [{ name: 'شيبسي', qty: 2, unitPrice: 110, subtotal: 220, flavors: [] }],
      totalQty: 2,
      totalPrice: 220,
      unit: 'كرتونة',
    });
    dbMod.createOrder({
      id: 'ord_u1_b',
      userId: u1.id,
      userName: u1.full_name,
      userPhone: u1.phone,
      items: [{ name: 'فريسكا', qty: 1, unitPrice: 90, subtotal: 90, flavors: [] }],
      totalQty: 1,
      totalPrice: 90,
      unit: 'كرتونة',
    });
    dbMod.createOrder({
      id: 'ord_u2_c',
      userId: u2.id,
      userName: u2.full_name,
      userPhone: u2.phone,
      items: [{ name: 'مولتو', qty: 3, unitPrice: 150, subtotal: 450, flavors: [] }],
      totalQty: 3,
      totalPrice: 450,
      unit: 'كرتونة',
    });

    await runCase('HTTP & Orders', 'H1: Customer deletes single WhatsApp order & blocked from other users order', async () => {
      // Cross-user delete must fail with 404
      const cross = await requestJson(server, 'DELETE', '/api/orders/ord_u2_c', { cookie: cookieU1 });
      assert.equal(cross.status, 404);
      assert.equal(dbMod.listUserOrders(u2.id).length, 1);

      // Delete own order succeeds
      const delOwn = await requestJson(server, 'DELETE', '/api/orders/ord_u1_a', { cookie: cookieU1 });
      assert.equal(delOwn.status, 200);
      assert.equal(delOwn.json.ok, true);
      const u1Orders = dbMod.listUserOrders(u1.id);
      assert.equal(u1Orders.length, 1);
      assert.equal(u1Orders[0].id, 'ord_u1_b');
    });

    await runCase('HTTP & Orders', 'H2: Customer clears own WhatsApp order history without touching u2', async () => {
      const clr = await requestJson(server, 'DELETE', '/api/orders', { cookie: cookieU1 });
      assert.equal(clr.status, 200);
      assert.equal(clr.json.deletedCount, 1);
      assert.equal(dbMod.listUserOrders(u1.id).length, 0);
      assert.equal(dbMod.listUserOrders(u2.id).length, 1);
    });

    await runCase('HTTP & Orders', 'H3: Admin deletes single order & clears all orders', async () => {
      dbMod.createOrder({
        id: 'ord_u1_d',
        userId: u1.id,
        userName: u1.full_name,
        userPhone: u1.phone,
        items: [{ name: 'دوريتوس', qty: 1, unitPrice: 120, subtotal: 120, flavors: [] }],
        totalQty: 1,
        totalPrice: 120,
      });

      const delOne = await requestJson(server, 'DELETE', '/api/admin/orders/ord_u1_d', { cookie: cookieAdm });
      assert.equal(delOne.status, 200);
      assert.equal(dbMod.listAllOrders().length, 1);

      const clrAll = await requestJson(server, 'DELETE', '/api/admin/orders', { cookie: cookieAdm });
      assert.equal(clrAll.status, 200);
      assert.equal(clrAll.json.deletedCount, 1);
      assert.equal(dbMod.listAllOrders().length, 0);
    });

    await runCase('HTTP & Orders', 'H4: POST /api/ai/validate & /api/admin/ai/validate (+ opId 409 idempotency)', async () => {
      const catRes = await requestJson(server, 'GET', '/api/catalog', { cookie: cookieU1 });
      assert.equal(catRes.status, 200);
      const liveCat = catRes.json?.json
        ? JSON.parse(catRes.json.json)
        : catRes.json?.data || catRes.json || {};
      const liveProds = Array.isArray(liveCat.p) ? liveCat.p : [];
      const firstAvailIdx = liveProds.findIndex((p) => p && !p[7]);
      assert.ok(firstAvailIdx >= 0, 'Live default catalog must contain at least one available product');

      const custVal = await requestJson(server, 'POST', '/api/ai/validate', {
        cookie: cookieU1,
        body: {
          message: 'عايز كرتونتين',
          currentDraft: [],
          geminiJson: {
            reply: 'تمام',
            items: [
              { i: firstAvailIdx, f: -1, q: 2 },
              { i: 999999, f: -1, q: 1, name: 'صنف وهمي' },
            ],
            action: 'none',
          },
        },
      });
      assert.equal(custVal.status, 200);
      assert.equal(custVal.json.ok, true);
      assert.equal(custVal.json.draft.length, 1);
      assert.equal(custVal.json.draft[0].i, firstAvailIdx);
      assert.equal(isHollowAiReply(custVal.json.reply), false);
      assert.ok(custVal.json.rejectedReasons.length >= 1);

      // Verify /api/ai/validate over HTTP also blocks hollow "تمام" on "عايز كرتونة شيبسي"
      const chipsHollow = await requestJson(server, 'POST', '/api/ai/validate', {
        cookie: cookieU1,
        body: {
          message: 'عايز كرتونة شيبسي',
          currentDraft: [],
          geminiJson: {
            reply: 'تمام',
            intent: 'order',
            items: [],
            unknown: [],
            clear: false,
            action: 'none',
          },
        },
      });
      assert.equal(chipsHollow.status, 200);
      assert.equal(chipsHollow.json.ok, true);
      assert.equal(chipsHollow.json.draft.length, 0);
      assert.equal(isHollowAiReply(chipsHollow.json.reply), false);
      assert.equal(chipsHollow.json.nextState?.pendingClarification?.type, 'disambiguate_product');
      assert.ok(Array.isArray(chipsHollow.json.quick) && chipsHollow.json.quick.length >= 2);

      // Verify /api/ai/validate catches dropped items, fractional 0.5 rounding, lookalikes, and ambiguity against live default catalog
      const multiAudit = await requestJson(server, 'POST', '/api/ai/validate', {
        cookie: cookieU1,
        body: {
          message: 'عايز نصف كرتونة مياه غازية وكرتونة جاكودار و3 كراتين فشار بالكراميل و2 شيبسي',
          currentDraft: [],
          geminiJson: {
            reply: 'تم',
            intent: 'order',
            items: [{ i: firstAvailIdx, f: -1, q: 1, a: false }],
            unknown: [],
            action: 'review',
          },
        },
      });
      assert.equal(multiAudit.status, 200);
      assert.equal(multiAudit.json.ok, true);
      assert.equal(multiAudit.json.action, 'none');
      assert.ok(multiAudit.json.unknown.some((u) => /جاكودار/.test(u)));
      assert.equal(multiAudit.json.draft.find((d) => d.i === 15)?.q, 0.5);
      assert.equal(multiAudit.json.draft.find((d) => d.i === 7)?.q, 3);
      assert.equal(multiAudit.json.nextState?.pendingClarification?.type, 'disambiguate_product');
      assert.equal(multiAudit.json.nextState?.pendingClarification?.explicitQty, 2);

      const testCat = makeTestCatalog();
      const opId = 'op_http_idem_123';
      const admPreview = await requestJson(server, 'POST', '/api/admin/ai/validate', {
        cookie: cookieAdm,
        body: {
          catalogData: testCat,
          ops: [{ type: 'product', where: { name: 'دوريتوس' }, do: { setPrice: 140 } }],
          opId,
        },
      });
      assert.equal(admPreview.status, 200);
      assert.equal(admPreview.json.preview.valid, true);

      const admMark = await requestJson(server, 'POST', '/api/admin/ai/validate', {
        cookie: cookieAdm,
        body: { opId, markExecuted: true },
      });
      assert.equal(admMark.status, 200);
      assert.equal(admMark.json.marked, true);

      // Re-submitting same opId must be blocked with 409 duplicateOp
      const admDup = await requestJson(server, 'POST', '/api/admin/ai/validate', {
        cookie: cookieAdm,
        body: { opId, markExecuted: true },
      });
      assert.equal(admDup.status, 409);
      assert.equal(admDup.json.duplicateOp, true);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(tmpDbPath + suffix)) fs.unlinkSync(tmpDbPath + suffix);
      } catch {
        // ignore
      }
    }
  }
}

// =========================================================================
// PART 4: INTERACTIVE CUSTOMER AI UI + DRAFT CARD + REAL CART INTEGRATION
// =========================================================================
function createMockBrowserEnv() {
  const mkStorage = () => {
    const store = new Map();
    return {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => {
        store.set(String(k), String(v));
      },
      removeItem: (k) => {
        store.delete(String(k));
      },
      clear: () => {
        store.clear();
      },
    };
  };

  function decodeHtml(s) {
    return String(s || '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function toCamel(k) {
    return k.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  }

  class MockClassList {
    constructor(el) {
      this.el = el;
    }
    _set() {
      return new Set(String(this.el._className || '').split(/\s+/).filter(Boolean));
    }
    _save(s) {
      this.el._className = Array.from(s).join(' ');
    }
    add(...cls) {
      const s = this._set();
      cls.forEach((c) => s.add(c));
      this._save(s);
    }
    remove(...cls) {
      const s = this._set();
      cls.forEach((c) => s.delete(c));
      this._save(s);
    }
    toggle(c, force) {
      const s = this._set();
      const next = force !== undefined ? Boolean(force) : !s.has(c);
      if (next) s.add(c);
      else s.delete(c);
      this._save(s);
      return next;
    }
    contains(c) {
      return this._set().has(c);
    }
  }

  const byId = new Map();

  class MockElement {
    constructor(tagName = 'div', id = '') {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.id = id || '';
      this._className = '';
      this.classList = new MockClassList(this);
      this.dataset = {};
      this.attributes = {};
      this.style = {};
      this.children = [];
      this.parentElement = null;
      this._innerHTML = '';
      this._textContent = '';
      this._value = '';
      this.selected = false;
      this.disabled = false;
      this.offsetWidth = 100;
      this.scrollTop = 0;
      this.scrollHeight = 100;
      this.listeners = new Map();
      if (this.id) byId.set(this.id, this);
    }
    get className() {
      return this._className;
    }
    set className(v) {
      this._className = String(v || '');
    }
    get value() {
      if (this.tagName === 'SELECT') {
        const opts = this.querySelectorAll('option');
        const sel = opts.find((o) => o.selected) || opts[0];
        return sel ? sel.value : this._value;
      }
      return this._value;
    }
    set value(v) {
      this._value = String(v == null ? '' : v);
      if (this.tagName === 'SELECT') {
        const opts = this.querySelectorAll('option');
        opts.forEach((o) => {
          o.selected = o.value === this._value;
        });
      }
    }
    get textContent() {
      if (this.children.length) {
        return this.children.map((c) => c.textContent).join('');
      }
      return this._textContent;
    }
    set textContent(v) {
      this.children = [];
      this._textContent = String(v == null ? '' : v);
      this._innerHTML = this._textContent;
    }
    get innerHTML() {
      return this._innerHTML;
    }
    set innerHTML(html) {
      this._unregisterSubtree();
      this.children = [];
      this._textContent = '';
      this._innerHTML = String(html == null ? '' : html);
      parseInto(this, this._innerHTML);
      if (this.id) byId.set(this.id, this);
    }
    _unregisterSubtree() {
      this.children.forEach((ch) => {
        if (ch.id && byId.get(ch.id) === ch) byId.delete(ch.id);
        if (typeof ch._unregisterSubtree === 'function') ch._unregisterSubtree();
      });
    }
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) byId.set(child.id, child);
      }
      return child;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener(type, fn) {
      if (!this.listeners.has(type)) return;
      this.listeners.set(
        type,
        this.listeners.get(type).filter((x) => x !== fn)
      );
    }
    dispatchEvent(evt) {
      if (!evt.target) evt.target = this;
      evt.preventDefault = evt.preventDefault || (() => {});
      let cur = this;
      while (cur) {
        const fns = cur.listeners.get(evt.type) || [];
        fns.forEach((fn) => fn.call(cur, evt));
        cur = cur.parentElement;
      }
    }
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
    setAttribute(k, v) {
      const val = String(v == null ? '' : v);
      this.attributes[k] = val;
      if (k === 'id') {
        this.id = val;
        byId.set(val, this);
      } else if (k === 'class') {
        this._className = val;
      } else if (k.startsWith('data-')) {
        this.dataset[toCamel(k.slice(5))] = val;
      }
    }
    getAttribute(k) {
      if (k === 'id') return this.id;
      if (k === 'class') return this._className;
      return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
    }
    _matches(sel) {
      return sel.split(',').some((part) => {
        const s = part.trim();
        if (!s) return false;
        let rem = s;
        if (/^[a-zA-Z0-9]+/.test(rem)) {
          const tagM = rem.match(/^([a-zA-Z0-9]+)/);
          if (tagM[1].toUpperCase() !== this.tagName) return false;
          rem = rem.slice(tagM[1].length);
        }
        const idM = rem.match(/#([a-zA-Z0-9_-]+)/);
        if (idM) {
          if (this.id !== idM[1]) return false;
          rem = rem.replace(idM[0], '');
        }
        const clsRe = /\.([a-zA-Z0-9_-]+)/g;
        let cm;
        while ((cm = clsRe.exec(rem))) {
          if (!this.classList.contains(cm[1])) return false;
        }
        const attrRe = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
        let am;
        while ((am = attrRe.exec(rem))) {
          const attrName = am[1].trim();
          const expected = am[2];
          let actual = this.attributes[attrName];
          if (actual === undefined && attrName.startsWith('data-')) {
            actual = this.dataset[toCamel(attrName.slice(5))];
          }
          if (actual === undefined) return false;
          if (expected !== undefined && String(actual) !== expected) return false;
        }
        return true;
      });
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur._matches(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (node) => {
        for (const ch of node.children) {
          if (ch instanceof MockElement) {
            if (ch._matches(sel)) out.push(ch);
            walk(ch);
          }
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
  }

  class MockTextNode {
    constructor(txt, parent) {
      this._textContent = txt;
      this.parentElement = parent;
      this.children = [];
    }
    get textContent() {
      return this._textContent;
    }
  }

  function parseAttrs(el, attrStr) {
    const re = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
    let m;
    while ((m = re.exec(attrStr))) {
      const k = m[1];
      const v = m[2] != null ? decodeHtml(m[2]) : '';
      el.attributes[k] = v;
      if (k === 'id') {
        el.id = v;
        byId.set(v, el);
      } else if (k === 'class') {
        el._className = v;
      } else if (k === 'value') {
        el._value = v;
      } else if (k === 'selected') {
        el.selected = true;
      } else if (k.startsWith('data-')) {
        el.dataset[toCamel(k.slice(5))] = v;
      }
    }
  }

  function parseInto(root, html) {
    const stack = [root];
    const tokenRe = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
    const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
    let m;
    while ((m = tokenRe.exec(html))) {
      if (m[4]) {
        const parent = stack[stack.length - 1];
        parent.children.push(new MockTextNode(decodeHtml(m[4]), parent));
        continue;
      }
      const isClose = m[1] === '/';
      const tag = m[2].toLowerCase();
      const attrStr = m[3] || '';
      if (isClose) {
        for (let i = stack.length - 1; i >= 1; i--) {
          if (stack[i].tagName === tag.toUpperCase()) {
            stack.length = i;
            break;
          }
        }
      } else {
        const el = new MockElement(tag);
        parseAttrs(el, attrStr);
        const parent = stack[stack.length - 1];
        el.parentElement = parent;
        parent.children.push(el);
        if (!voidTags.has(tag) && !attrStr.trim().endsWith('/')) {
          stack.push(el);
        }
      }
    }
  }

  const localStorage = mkStorage();
  const sessionStorage = mkStorage();
  const body = new MockElement('body', 'docBody');
  const createMount = (id, tag = 'div') => {
    const el = new MockElement(tag, id);
    body.appendChild(el);
    return el;
  };
  const rsheet = createMount('rsheet');
  rsheet.appendChild(new MockElement('div', 'rpn'));
  const sheet = createMount('sheet');
  ['lines', 'tot', 'sbtn', 'wa', 'minw', 'clearCart'].forEach((id) =>
    sheet.appendChild(new MockElement('div', id))
  );
  [
    'cnt',
    'sum',
    'bar',
    'hdrCartCount',
    'hdrCart',
    'hdrFavBtn',
    'hdrFavCount',
    'open',
    'fsheet',
    'ordersSheet',
    'accountSheet',
    'pushMandatoryModal',
    'toast',
    'navOffers',
    'offers',
    'dailyDealWrap',
    'otrack',
    'dots',
    'oPrev',
    'oNext',
    'favoritesSheet',
    'favClose',
    'favBrowseBtn',
    'favCount',
    'favClearBtn',
    'favEmpty',
    'favGrid',
    'catalogStatus',
    'grid',
    'sgrid',
  ].forEach((id) => createMount(id));

  const document = {
    body,
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => new MockElement(tag),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    querySelector: (sel) => body.querySelector(sel),
  };

  const winListeners = new Map();
  const histStack = [{ state: null, url: 'http://localhost:3000/' }];
  let histPos = 0;

  const historyObj = {
    get state() {
      return histStack[histPos]?.state ?? null;
    },
    set state(s) {
      if (histStack[histPos]) histStack[histPos].state = s;
    },
    get length() {
      return histStack.length;
    },
    pushState(s, _t, url) {
      histStack.splice(histPos + 1);
      histStack.push({ state: s, url: url || 'http://localhost:3000/' });
      histPos = histStack.length - 1;
    },
    replaceState(s, _t, url) {
      histStack[histPos] = {
        state: s,
        url: url || histStack[histPos]?.url || 'http://localhost:3000/',
      };
    },
    back() {
      if (histPos > 0) {
        histPos -= 1;
        const st = histStack[histPos].state;
        const fns = winListeners.get('popstate') || [];
        fns.forEach((fn) => fn({ type: 'popstate', state: st }));
      }
    },
  };

  const win = {
    location: { href: 'http://localhost:3000/', origin: 'http://localhost:3000', pathname: '/', search: '', hash: '' },
    matchMedia: () => ({ matches: true }),
    innerWidth: 1024,
    scrollY: 0,
    scrollTo() {},
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!winListeners.has(type)) return;
      winListeners.set(
        type,
        winListeners.get(type).filter((f) => f !== fn)
      );
    },
    history: historyObj,
    document,
  };

  globalThis.window = win;
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.history = historyObj;
  globalThis.matchMedia = win.matchMedia;
  globalThis.Element = MockElement;
  globalThis.requestAnimationFrame = (fn) => fn();

  return { document, byId, localStorage };
}

async function runCustomerUiAndCartSuite() {
  const { document, localStorage } = createMockBrowserEnv();
  const stateMod = await import('../js/state.js');
  const cartMod = await import('../js/cart.js');
  const routerMod = await import('../js/router.js');
  const aiMod = await import('../js/ai.js');
  const offersMod = await import('../js/offers.js');
  const storeMod = await import('../js/store.js');

  const { state } = stateMod;
  let catalogRenderCount = 0;

  function resetEnv(catOverride = null) {
    localStorage.clear();
    const cat = catOverride || makeTestCatalog();
    state.D = cat;
    state.CFG = { ...(cat.cfg || {}), unit: 'كرتونة', brandName: 'أبو سعيد', hasAiKey: false, aiMode: 'local' };
    state.P = cat.p;
    state.CATS = ['الكل'].concat(cat.cats || []);
    state.cart = {};
    state.favorites = [];
    state.syncing = false;
    catalogRenderCount = 0;
    state.hooks.renderCatalog = () => {
      catalogRenderCount += 1;
    };
    state.hooks.renderCategories = () => {};
    state.hooks.renderOffers = () => {};
    state.hooks.renderSpotlight = () => {};
    state.hooks.syncFilterInputs = () => {};
    state.hooks.syncSearchOverlay = () => {};
    state.hooks.syncFavoritesOverlay = storeMod.syncFavoritesOverlay;
    state.hooks.syncOrdersOverlay = () => {};
    state.hooks.syncAccountOverlay = () => {};
    state.hooks.syncAiOverlay = aiMod.syncAiOverlay;
    state.hooks.syncCartOverlay = cartMod.syncCartOverlay;
    state.hooks.syncFlavorOverlay = () => {};
    aiMod.chReset();
    routerMod.switchOverlay(null);
    aiMod.openAI();
  }

  routerMod.initRouter();
  aiMod.bindAIEvents();
  offersMod.bindOfferEvents();
  storeMod.bindStoreEvents();

  // U1: Mandatory 10-step UI interactive flow + real cart addition + persistence
  await runCase('UI & Cart', 'U1: Mandatory 10-step interactive selection, chat card edit, review & rAdd() to state.cart', async () => {
    resetEnv();
    const rs = document.getElementById('rsheet');

    // Step 1-2: "عايز كرتونة شيبسي." -> shows interactive product options (.rc-qbtn) in chat
    await aiMod.chSend('عايز كرتونة شيبسي.');
    let qBtns = document.getElementById('chm').querySelectorAll('.rc-qbtn');
    assert.ok(qBtns.length >= 2, 'Chat must render clickable product buttons for شيبسي');
    assert.equal(Object.keys(state.cart).length, 0, 'state.cart must stay empty while chatting');
    assert.equal(aiMod.__getAiStateForTest().RL.length, 0);

    // Step 3-4: Customer selects "جاجوار" -> shows available flavors (جبنة، شطة)
    await aiMod.chSend('جاجوار.');
    qBtns = document.getElementById('chm').querySelectorAll('.rc-qbtn');
    assert.ok(qBtns.some((b) => b.dataset.quick === 'جبنة'), 'Chat must render جبنة quick button');
    assert.ok(qBtns.some((b) => b.dataset.quick === 'شطة'), 'Chat must render شطة quick button');
    assert.equal(aiMod.__getAiStateForTest().RL.length, 0);
    assert.equal(Object.keys(state.cart).length, 0);

    // Step 5-6: Click quick flavor button "جبنة" -> chat card (.rcr-card) appears immediately with qty=1, flavor=جبنة, price=130
    const cheeseBtn = qBtns.find((b) => b.dataset.quick === 'جبنة');
    await aiMod.chSend(cheeseBtn.dataset.quick);

    const cards1 = document.getElementById('chd').querySelectorAll('.rcr-card');
    assert.equal(cards1.length, 1, 'In-chat draft card must appear immediately inside #chd');
    assert.match(cards1[0].textContent, /١٣٠ جنيه/);
    assert.equal(cards1[0].querySelector('.rcd-sel').value, '3');
    assert.equal(cards1[0].querySelector('.rcd-flv').value, '0');
    assert.match(document.getElementById('chd').querySelector('.rcd-head').textContent, /١٣٠ جنيه/);
    assert.equal(Object.keys(state.cart).length, 0, 'Draft card must NOT mutate state.cart yet');

    // Step 7-8: Customer clicks "+" inside the in-chat card to change quantity to 2 cartons
    const plusBtn = document.getElementById('chd').querySelector('[data-cd-rn="0"][data-cd-rd="1"]');
    assert.ok(plusBtn, 'In-chat card must have + stepper button');
    plusBtn.click();

    const cards2 = document.getElementById('chd').querySelectorAll('.rcr-card');
    assert.equal(cards2.length, 1);
    assert.equal(aiMod.__getAiStateForTest().RL[0].q, 2);
    assert.match(cards2[0].textContent, /٢٦٠ جنيه/);
    assert.match(document.getElementById('chd').querySelector('.rcd-head').textContent, /٢٦٠ جنيه/);
    assert.equal(Object.keys(state.cart).length, 0, 'Quantity edit in chat draft must NOT touch state.cart');

    // Step 9: Customer clicks "راجع وضيف للسلة" (#chrv) -> review screen opens; state.cart still empty until #rok
    const chrv = document.getElementById('chrv');
    assert.ok(chrv);
    chrv.click();
    assert.ok(document.getElementById('rok'), 'Review screen must display #rok confirm button');
    assert.equal(Object.keys(state.cart).length, 0);

    // Step 10: Customer clicks "#rok" (rAdd) -> real state.cart updated, saved via saveCart(), UI synced, chat draft cleared
    document.getElementById('rok').click();
    assert.deepEqual(state.cart, { '3:0': 2 }, 'state.cart must hold exact product:flavor and quantity');
    const saved = JSON.parse(localStorage.getItem('cart') || '{}');
    assert.deepEqual(saved.c, { '3:0': 2 }, 'saveCart() must persist cart to localStorage');
    assert.ok(catalogRenderCount >= 1, 'renderCatalog hook must run after rAdd()');
    assert.equal(document.getElementById('hdrCartCount').textContent, '٢');
    assert.equal(document.getElementById('hdrCartCount').hidden, false);
    assert.equal(document.getElementById('hdrCartSum'), null);
    assert.doesNotMatch(document.getElementById('hdrCart').textContent, /السلة/);
    assert.equal(document.getElementById('cnt').textContent, '٢');
    assert.equal(aiMod.__getAiStateForTest().RL.length, 0, 'Draft must reset only after successful rAdd()');
    assert.ok(document.getElementById('sheet').classList.contains('on'), 'Cart drawer opens after adding');
    assert.ok(rs);
  });

  // U2: Multi-product card support, in-card flavor change, delete button & live total
  await runCase('UI & Cart', 'U2: Multiple items in chat card, flavor switch, and item deletion update total live', async () => {
    resetEnv();
    await aiMod.chSend('عايز ٢ فريسكا وكرتونة جاجوار شطة');

    const cards = document.getElementById('chd').querySelectorAll('.rcr-card');
    assert.equal(cards.length, 2, 'Two interactive product cards must render in #chd');
    // فريسكا 2*90=180 + جاجوار 1*130=130 -> ٣١٠ جنيه
    assert.match(document.getElementById('chd').querySelector('.rcd-head').textContent, /٣١٠ جنيه/);

    // Switch جاجوار flavor via <select data-cd-rn="1" data-cd-rk="f"> from شطة (1) to جبنة (0)
    const flSel = document.getElementById('chd').querySelector('select[data-cd-rn="1"][data-cd-rk="f"]');
    assert.ok(flSel);
    flSel.value = '0';
    flSel.dispatchEvent({ type: 'change', target: flSel });
    assert.equal(aiMod.__getAiStateForTest().RL[1].f, 0);

    // Delete فريسكا via inline delete button [data-cd-rn="0"][data-cd-rk="del"]
    const delBtn = document.getElementById('chd').querySelector('[data-cd-rn="0"][data-cd-rk="del"]');
    delBtn.click();
    assert.equal(aiMod.__getAiStateForTest().RL.length, 1);
    assert.equal(aiMod.__getAiStateForTest().RL[0].i, 3);
    assert.equal(aiMod.__getAiStateForTest().RL[0].f, 0);
    assert.match(document.getElementById('chd').querySelector('.rcd-head').textContent, /١٣٠ جنيه/);

    // Commit remaining item to cart
    assert.equal(aiMod.rAdd(), true);
    assert.deepEqual(state.cart, { '3:0': 1 });
  });

  // U3: Strict cart separation & rAdd() / chReview() error handling
  await runCase('UI & Cart', 'U3: rAdd() & chReview() block empty/incomplete/sold-out drafts with clear errors', () => {
    resetEnv();

    // Empty draft
    assert.equal(aiMod.rAdd(), false);
    assert.match(document.getElementById('rerr').textContent, /فاضية/);
    assert.deepEqual(state.cart, {});

    // Unflavored item in draft
    aiMod.__setDraftForTest([{ i: 3, f: -1, q: 2, c: [3], amb: false }]);
    assert.equal(aiMod.chReview(), false);
    assert.match(document.getElementById('rerr').textContent, /النكهة/);
    assert.equal(aiMod.rAdd(), false);
    assert.deepEqual(state.cart, {});
    assert.equal(aiMod.__getAiStateForTest().RL.length, 1, 'Failed rAdd must NOT wipe draft');

    // Out-of-stock item in draft (index 7 = صنف مخفي with p[7]=1)
    aiMod.__setDraftForTest([{ i: 7, f: -1, q: 1, c: [7], amb: false }]);
    assert.equal(aiMod.rAdd(), false);
    assert.match(document.getElementById('rerr').textContent, /فاضية|غير متوفر/);
    assert.deepEqual(state.cart, {});
  });

  // U4: Gemini false "ضفتلك في السلة" reply blocked & Gemini network outage falls back to interactive chLocal
  await runCase('UI & Cart', 'U4: Gemini false cart claim blocked & network error falls back cleanly to chLocal', async () => {
    resetEnv();
    state.CFG.hasAiKey = true;
    state.CFG.aiMode = 'gemini';

    const origFetch = globalThis.fetch;
    try {
      // Scenario A: Gemini lies "تمام، ضفتلك في السلة" with empty items on "عايز كرتونة شيبسي"
      globalThis.fetch = async (url) => {
        if (String(url).includes('/api/ai/generate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              structured: {
                reply: 'تمام، ضفتلك في السلة',
                intent: 'order',
                items: [],
                unknown: [],
                clear: false,
                action: 'none',
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false }),
        };
      };

      await aiMod.chSend('عايز كرتونة شيبسي');
      const stA = aiMod.__getAiStateForTest();
      assert.equal(stA.RL.length, 0);
      assert.deepEqual(state.cart, {}, 'False cart claim must NEVER update state.cart');
      const lastReply = stA.CH.msgs[stA.CH.msgs.length - 1].t;
      assert.doesNotMatch(lastReply, /ضفتلك في السلة/);
      assert.ok(document.getElementById('chm').querySelectorAll('.rc-qbtn').length >= 2);

      // Scenario B: Gemini returns HTTP 502 error -> seamless chLocal fallback keeps full interactive UX
      globalThis.fetch = async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Gemini unavailable' }),
      });

      await aiMod.chSend('جاجوار');
      let qBtns = document.getElementById('chm').querySelectorAll('.rc-qbtn');
      assert.ok(qBtns.some((b) => b.dataset.quick === 'جبنة'), 'chLocal fallback must render flavor options');

      await aiMod.chSend('جبنة');
      assert.equal(aiMod.__getAiStateForTest().RL.length, 1);
      assert.equal(document.getElementById('chd').querySelectorAll('.rcr-card').length, 1);

      await aiMod.chSend('عايز كرتونتين');
      assert.equal(aiMod.__getAiStateForTest().RL[0].q, 2);
      assert.match(document.getElementById('chd').querySelector('.rcd-head').textContent, /٢٦٠ جنيه/);
      assert.deepEqual(state.cart, {});
    } finally {
      globalThis.fetch = origFetch;
      routerMod.switchOverlay(null);
    }
  });

  // U5: One-shot rlocal() mode handles cross-segment flavor inheritance, multi-flavor single-segment, & ambiguity
  await runCase('UI & Cart', 'U5: One-shot rlocal() handles flavor inheritance, multi-flavor & ambiguity without mutating cart', () => {
    const saltCat = {
      cats: ['شيبسي', 'سناكس'],
      cfg: { unit: 'كرتونة', brandName: 'أبو سعيد' },
      p: [
        ['شيبسي ملح', 'شيبسي', 'كرتونة 24 كيس', 110, '#1', '#2', '🥔', 0, '', [], '', 0],
        ['دوريتوس', 'شيبسي', 'كرتونة 24 كيس', 260, '#1', '#2', '🔺', 0, '', [['ملح', 0], ['خل', 0], ['شطة', 0]], '', 0],
      ],
      offers: [],
    };
    resetEnv(saltCat);

    const inherited = aiMod.rlocal('عايز 3 كراتين دوريتوس شطة و2 ملح');
    assert.equal(inherited.unk.length, 0);
    assert.deepEqual(
      inherited.items.map((x) => ({ i: x.i, f: x.f, q: x.q })),
      [
        { i: 1, f: 2, q: 3 },
        { i: 1, f: 0, q: 2 },
      ]
    );

    resetEnv();
    const ambRes = aiMod.rlocal('عايز كرتونة شيبسي');
    assert.equal(ambRes.items.length, 1);
    assert.equal(ambRes.items[0].amb, true, 'rlocal must mark ambiguous شيبسي variants');
    assert.ok(ambRes.items[0].c.length >= 2);

    const multiFl = aiMod.rlocal('عايز كرتونتين دوريتوس جبنة وفلفل حلو');
    assert.deepEqual(
      multiFl.items.map((x) => ({ i: x.i, f: x.f, q: x.q })).sort((a, b) => a.f - b.f),
      [
        { i: 2, f: 0, q: 2 },
        { i: 2, f: 1, q: 2 },
      ]
    );
    assert.deepEqual(state.cart, {}, 'rlocal must never mutate state.cart');
  });

  // U6: Customer AI obeys admin-configured aiUi mode (chat, old, chat_only, old_only)
  await runCase('UI & Cart', 'U6: Customer AI obeys admin-configured aiUi (chat, old, chat_only, old_only)', () => {
    resetEnv();
    state.CFG.aiUi = 'old';
    routerMod.switchOverlay(null);
    aiMod.openAI();
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'old', 'aiUi=old must open one-shot writing mode directly');
    assert.ok(document.getElementById('chback'), 'aiUi=old must allow switching back to interactive chat');
    document.getElementById('chback').click();
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'chat', 'Clicking #chback must switch to interactive chat');

    // Locked one-shot only
    resetEnv();
    state.CFG.aiUi = 'old_only';
    routerMod.switchOverlay(null);
    aiMod.openAI();
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'old');
    assert.equal(document.getElementById('chback'), null, 'old_only must hide interactive chat switch button');
    routerMod.commitRoute({ layers: ['ai'], aiStep: 'chat' }, { mode: 'replace' });
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'old', 'old_only must force one-shot even if route asks for chat');

    // Locked interactive chat only
    resetEnv();
    state.CFG.aiUi = 'chat_only';
    routerMod.switchOverlay(null);
    aiMod.openAI();
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'chat');
    assert.equal(document.getElementById('chold'), null, 'chat_only must hide one-shot switch button');
    routerMod.commitRoute({ layers: ['ai'], aiStep: 'old' }, { mode: 'replace' });
    assert.equal(aiMod.__getAiStateForTest().RMODE, 'chat', 'chat_only must force interactive chat even if route asks for old');
  });

  // U7: One-shot rlocal fractional + unknown reporting + 0.5 stepper behavior in DOM without premature deletion
  await runCase('UI & Cart', 'U7: One-shot fractional qty (نصف كرتونة), multi-item unk preservation, and 1.5 - 1 -> 0.5 stepper in DOM', async () => {
    resetEnv();
    await aiMod.chSend('عايز كرتونة ونص فريسكا');
    assert.equal(aiMod.__getAiStateForTest().RL[0].q, 1.5);
    const minusBtn = document.getElementById('chd').querySelector('[data-cd-rn="0"][data-cd-rd="-1"]');
    assert.ok(minusBtn);
    minusBtn.click();
    assert.equal(aiMod.__getAiStateForTest().RL.length, 1, 'Decrementing 1.5 by 1 must keep line at 0.5');
    assert.equal(aiMod.__getAiStateForTest().RL[0].q, 0.5);
    minusBtn.click();
    assert.equal(aiMod.__getAiStateForTest().RL.length, 0, 'Decrementing 0.5 by 1 removes the line cleanly');

    const one = aiMod.rlocal('عايز نصف كرتونة فريسكا وكرتونة جاكودار و3 كراتين دوريتوس');
    assert.equal(one.items.find((x) => x.i === 4)?.q, 0.5);
    assert.equal(one.items.find((x) => x.i === 2)?.q, 3);
    assert.ok(one.unk.some((u) => /جاكودار/.test(u)));
    assert.equal(one.items.some((x) => x.i === 3), false);
    assert.deepEqual(state.cart, {});
  });

  // U8: Product of the Day ("منتج اليوم") & product-linked offers add to cart in 1 click with Toast confirmation
  await runCase('UI & Cart', 'U8: Product of the Day renders in #offers even when offers=[] and adds 1 item to cart with Toast confirmation', () => {
    resetEnv();
    routerMod.switchOverlay(null);
    state.hooks.syncDailyDeal = offersMod.syncDailyDealBadge;

    // 1. Catalog has no carousel offers, yet #offers shows "منتج اليوم"
    state.D.offers = [];
    state.CFG.dailyDealIdx = 3; // جاجوار (has flavors: جبنة [0], شطة [1])
    offersMod.renderOffers();

    const offersSec = document.getElementById('offers');
    const dailyWrap = document.getElementById('dailyDealWrap');
    assert.equal(offersSec.hidden, false, '#offers section must be visible for منتج اليوم');
    assert.equal(dailyWrap.hidden, false, '#dailyDealWrap must be visible');
    assert.match(dailyWrap.textContent, /منتج اليوم/);

    // Pick second flavor (شطة = 1) and click the one-click add button
    const spiceBtn = dailyWrap.querySelector('[data-dd-flavor="1"]');
    assert.ok(spiceBtn, 'Daily deal flavor button for شطة must exist');
    spiceBtn.click();

    const addBtn = document.getElementById('dailyDealAddBtn');
    assert.ok(addBtn, 'Daily deal one-click add button must exist');
    addBtn.click();

    assert.deepEqual(state.cart, { '3:1': 1 }, 'One-click add must add valid prodIdx:flavorIdx to state.cart');
    const saved = JSON.parse(localStorage.getItem('cart') || '{}');
    assert.deepEqual(saved.c, { '3:1': 1 }, 'One-click add must persist cart to localStorage');
    assert.equal(document.getElementById('hdrCartCount').textContent, '١');
    assert.equal(document.getElementById('dailyDealInCart').hidden, false);
    assert.match(document.getElementById('dailyDealInCart').textContent, /١/);

    const toastEl = document.getElementById('toast');
    assert.ok(toastEl.classList.contains('on'), 'Toast must become visible');
    assert.equal(toastEl.dataset.type, 'ok');
    assert.match(toastEl.textContent, /تمت إضافة/);
    assert.match(toastEl.textContent, /جاجوار/);

    // 2. Also verify unflavored linked offer slide supports one-click add + Toast
    state.cart = {};
    state.CFG.dailyDealIdx = '';
    state.D.offers = [
      {
        t: 'عرض فريسكا الخاص',
        d: 'سعر مميز اليوم',
        g: 'عرض خاص',
        pr: '٩٠ جنيه',
        c: '#ffd23f',
        productIndex: 4, // فريسكا (unflavored)
      },
    ];
    offersMod.renderOffers();
    const offerAddBtn = document.getElementById('otrack').querySelector('[data-offer-add="4"]');
    assert.ok(offerAddBtn, 'Linked offer slide must render one-click add button');
    offerAddBtn.click();
    assert.deepEqual(state.cart, { '4': 1 });
    assert.match(toastEl.textContent, /تمت إضافة.*فريسكا/);
  });

  // U9: Favorites List ("قائمة المفضلة") dedicated page via header heart icon + icon-only Cart button
  await runCase('UI & Cart', 'U9: Header heart icon opens dedicated Favorites page (hidden from homepage), persists across reloads & icon-only cart hides السلة text', () => {
    resetEnv();
    routerMod.switchOverlay(null);
    state.hooks.renderCatalog = storeMod.renderGrid;
    storeMod.renderGrid();
    cartMod.updCartSummary();

    assert.equal(document.getElementById('favoritesSec'), null, 'Favorites section must not appear on homepage');
    assert.equal(document.getElementById('navFavorites'), null, 'Favorites nav link must be removed from .hdr-nav');
    assert.equal(document.getElementById('hdrCartSum'), null, 'Header cart button must not contain #hdrCartSum word');
    assert.doesNotMatch(document.getElementById('hdrCart').textContent, /السلة/);

    const favSheet = document.getElementById('favoritesSheet');
    const hdrFavBtn = document.getElementById('hdrFavBtn');
    const hdrFavCount = document.getElementById('hdrFavCount');
    const favClose = document.getElementById('favClose');
    const favGrid = document.getElementById('favGrid');
    const favEmpty = document.getElementById('favEmpty');
    const favCount = document.getElementById('favCount');
    const favClearBtn = document.getElementById('favClearBtn');
    const grid = document.getElementById('grid');

    assert.equal(favSheet.classList.contains('on'), false, 'Favorites page stays closed initially');
    assert.equal(hdrFavCount.hidden, true);
    assert.equal(hdrFavBtn.classList.contains('has-favs'), false);
    assert.equal(favGrid.hidden, true);
    assert.equal(favEmpty.hidden, false);
    assert.equal(favCount.textContent, '٠');

    // Click heart button on flavored product 3 (جاجوار) in catalog grid
    const heartInCatalog = grid.querySelector('[data-fav="3"]');
    assert.ok(heartInCatalog, 'Catalog product card must render a heart favorite button');
    heartInCatalog.click();

    // Must NOT open flavor modal even though card has data-o="3"
    assert.equal(document.getElementById('fsheet').classList.contains('on'), false, 'Clicking heart must NOT open flavor modal');
    assert.equal(state.favorites.length, 1);
    assert.equal(hdrFavCount.hidden, false);
    assert.equal(hdrFavCount.textContent, '١');
    assert.equal(hdrFavBtn.classList.contains('has-favs'), true);
    assert.ok(grid.querySelector('[data-fav="3"]').classList.contains('on'), 'Heart button must have active .on state');
    assert.match(document.getElementById('toast').textContent, /المفضلة/);

    // Clicking top header heart icon opens the dedicated Favorites page
    hdrFavBtn.click();
    assert.equal(favSheet.classList.contains('on'), true, 'Clicking header heart icon must open #favoritesSheet page');
    assert.ok(routerMod.getCurrentSnapshot().layers.includes('favorites'));
    assert.equal(favGrid.hidden, false, '#favGrid must become visible once a favorite is added');
    assert.equal(favEmpty.hidden, true);
    assert.equal(favCount.textContent, '١');
    assert.equal(favClearBtn.hidden, false);
    assert.ok(favGrid.querySelector('#fav-prod-3'), 'Saved product must appear inside Favorites page #favGrid');

    // Also add unflavored product 4 (فريسكا) and quick-add it directly from #favGrid!
    grid.querySelector('[data-fav="4"]').click();
    assert.equal(favCount.textContent, '٢');
    assert.equal(hdrFavCount.textContent, '٢');
    const favCard4 = favGrid.querySelector('#fav-prod-4');
    assert.ok(favCard4, 'Product 4 card must appear inside #favGrid');
    const favAddBtn = favCard4.querySelector('[data-k="4"][data-d="1"]');
    assert.ok(favAddBtn, 'Favorite card in #favGrid must support direct quick add to cart');
    favAddBtn.click();
    assert.deepEqual(state.cart, { '4': 1 });

    // Simulate reload: clear memory and restore from localStorage
    state.favorites = [];
    stateMod.initFavoritesFromStorage();
    storeMod.renderGrid();
    assert.equal(state.favorites.length, 2, 'Favorites must persist and restore from localStorage');
    assert.ok(favGrid.querySelector('#fav-prod-3'));
    assert.ok(favGrid.querySelector('#fav-prod-4'));

    // Toggle off from inside #favGrid removes from favorites and updates catalog card & badge
    favGrid.querySelector('[data-fav="3"]').click();
    assert.equal(state.favorites.length, 1);
    assert.equal(favGrid.querySelector('#fav-prod-3'), null);
    assert.equal(grid.querySelector('[data-fav="3"]').classList.contains('on'), false);
    assert.equal(hdrFavCount.textContent, '١');

    // Clear all favorites
    favClearBtn.click();
    assert.equal(state.favorites.length, 0);
    assert.equal(favGrid.hidden, true);
    assert.equal(favEmpty.hidden, false);
    assert.equal(favCount.textContent, '٠');
    assert.equal(hdrFavCount.hidden, true);
    assert.equal(hdrFavBtn.classList.contains('has-favs'), false);

    // Close Favorites page cleanly
    favClose.click();
    assert.equal(favSheet.classList.contains('on'), false);
  });

  // U10: Full Admin control over Product of the Day (mode, name-shift resilience, flavor lock, stepQty, texts, color, image, schedule, fallback, hide, asset GC & admin hooks)
  await runCase('UI & Cart', 'U10: Storefront & asset GC honor full Product of the Day admin controls and admin dashboard exposes manager hooks', async () => {
    resetEnv();
    routerMod.switchOverlay(null);
    state.D.offers = [];
    state.IMGS.custom_dd_img = 'data:image/png;base64,AAA';

    // 1. Custom manual config with shifted index recovered by dailyDealName, default flavor 1, locked flavor chips, stepQty 3, texts, color, custom image
    state.CFG.dailyDealMode = 'manual';
    state.CFG.dailyDealIdx = 99; // Simulated shifted/stale index
    state.CFG.dailyDealName = 'جاجوار'; // Product 3 in test catalog
    state.CFG.dailyDealCat = 'سناكس';
    state.CFG.dailyDealFlavorIdx = 1; // شطة
    state.CFG.dailyDealHideFlavors = 1;
    state.CFG.dailyDealStepQty = 3;
    state.CFG.dailyDealBadge = '🔥 عرض اليوم الحصري';
    state.CFG.dailyDealNote = 'كمية محدودة بسعر الجملة';
    state.CFG.dailyDealBtnText = 'اطلب ٣ كراتين فوراً';
    state.CFG.dailyDealBg = '#2b6cff';
    state.CFG.dailyDealImgId = 'custom_dd_img';

    offersMod.renderOffers();
    const dailyWrap = document.getElementById('dailyDealWrap');
    assert.equal(dailyWrap.hidden, false);
    assert.match(dailyWrap.textContent, /جاجوار/);
    assert.match(dailyWrap.textContent, /🔥 عرض اليوم الحصري/);
    assert.match(dailyWrap.textContent, /كمية محدودة بسعر الجملة/);
    assert.match(dailyWrap.textContent, /اطلب ٣ كراتين فوراً/);
    assert.equal(dailyWrap.querySelectorAll('[data-dd-flavor]').length, 0, 'Flavor selector pills must hide when dailyDealHideFlavors=1');
    assert.ok(dailyWrap.innerHTML.includes('custom_dd_img') || dailyWrap.innerHTML.includes('data:image/png;base64,AAA'));

    const card = dailyWrap.querySelector('[data-dd-card]');
    assert.ok(card.classList.contains('has-bg'));
    assert.match(String(card.attributes.style || ''), /--dd-bg:#2b6cff/);

    document.getElementById('dailyDealAddBtn').click();
    assert.deepEqual(state.cart, { '3:1': 3 }, 'One-click add must add dailyDealStepQty=3 with dailyDealFlavorIdx=1 (شطة)');

    // 2. Schedule expiration with dailyDealFallbackAuto=0 hides card completely
    state.CFG.dailyDealEnd = '2020-01-01';
    state.CFG.dailyDealFallbackAuto = 0;
    offersMod.renderOffers();
    assert.equal(dailyWrap.hidden, true, 'Expired schedule with dailyDealFallbackAuto=0 must hide card');

    // 3. Re-enabling fallback auto switches to another available product cleanly
    state.CFG.dailyDealFallbackAuto = 1;
    offersMod.renderOffers();
    assert.equal(dailyWrap.hidden, false, 'Expired schedule with dailyDealFallbackAuto=1 falls back to another deal');

    // 4. Explicit dailyDealMode='auto' ignores stale dailyDealName/Idx and hideDailyDeal=1 hides completely
    state.CFG.dailyDealMode = 'auto';
    state.CFG.hideDailyDeal = 1;
    offersMod.renderOffers();
    assert.equal(dailyWrap.hidden, true, 'hideDailyDeal=1 must hide Product of the Day');

    // 5. Asset GC keeps custom dailyDealImgId & admin-app.js exposes full controls
    const { collectReferencedAssetIds } = await import('../lib/firebaseCatalogCore.js');
    const refs = collectReferencedAssetIds({
      cfg: { dailyDealImgId: 'custom_dd_img' },
      p: [],
      offers: [],
      catMeta: {},
    });
    assert.equal(refs.has('custom_dd_img'), true, 'collectReferencedAssetIds must retain dailyDealImgId');

    const adminJsSrc = fs.readFileSync(path.join(ROOT_DIR, 'protected', 'admin-app.js'), 'utf8');
    for (const marker of [
      'function renderDailyDealManager(',
      'data-set-daily',
      'ddApplyPriceBtn',
      'dailyDealStepQty',
      'dailyDealImgId',
      'dailyDealBg',
      'dailyDealFallbackAuto',
    ]) {
      assert.ok(adminJsSrc.includes(marker), `admin-app.js missing daily deal admin control marker: ${marker}`);
    }
  });
}

async function main() {
  await runCustomerSuite();
  await runAdminSuite();
  await runHttpAndOrdersIntegrationSuite();
  await runCustomerUiAndCartSuite();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nALL TESTS PASSED: ${passed}/${results.length}`);
  console.log('Note: GEMINI_API_KEY and Firebase RTDB server credentials are not configured in .env; live external Gemini HTTP & RTDB calls were not executed (Gemini client contract & retries verified via mock clientFactory; HTTP+SQLite verified live; Customer AI UI+Cart verified via DOM integration suite).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
