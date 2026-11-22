import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyValidatedAdminOps,
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

      // Turn 3: "جبنة."
      const t3 = processCustomerTurn({
        text: 'جبنة.',
        catalogData: activeCat,
        currentDraft: t2.draft,
        convState: t2.nextState,
      });
      assert.equal(t3.draft.length, 0, 'Must NOT add جاجوار جبنة before quantity is chosen');
      assert.equal(isHollowAiReply(t3.reply), false);
      assert.equal(t3.nextState.pendingClarification?.type, 'qty');
      assert.equal(t3.nextState.pendingClarification?.prodIdx, 3);
      assert.equal(t3.nextState.pendingClarification?.flavorIdx, 0);
      assert.match(t3.reply, /كام كرتونة/);

      // Turn 4: "عايز كرتونتين."
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
      assert.match(t4.reply, /تأكد|نأكد/);
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
    assert.equal(step3.draft.length, 0, 'Must wait for quantity before adding');
    assert.equal(isHollowAiReply(step3.reply), false);
    assert.equal(step3.nextState.pendingClarification?.type, 'qty');
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

async function main() {
  await runCustomerSuite();
  await runAdminSuite();
  await runHttpAndOrdersIntegrationSuite();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nALL TESTS PASSED: ${passed}/${results.length}`);
  console.log('Note: GEMINI_API_KEY and Firebase RTDB server credentials are not configured in .env; live external Gemini HTTP & RTDB calls were not executed (Gemini client contract & retries verified via mock clientFactory; HTTP+SQLite verified live).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
