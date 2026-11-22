// Conversation Manager: Isolated per-session memory, short-term slot/context tracking,
// duplicate-message protection, and localStorage persistence across reloads.

import { dedupeAndNormalizeDraft } from './validation-engine.js';

export const DEFAULT_CUSTOMER_STORAGE_KEY = 'abu_customer_ai_session_v1';
export const DEFAULT_ADMIN_STORAGE_KEY = 'abu_admin_ai_session_v1';

export function createConversationState(role = 'customer', convId = '') {
  const id =
    String(convId || '').trim() ||
    `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  if (role === 'admin') {
    return {
      role: 'admin',
      convId: id,
      msgs: [],
      draft: [],
      stagedProduct: null,
      busy: 0,
      pend: null,
      undo: null,
      pendingClarification: null,
      lastReferencedProductIdx: -1,
      executedOpIds: {},
      lastUserText: '',
      lastUserTs: 0,
    };
  }
  return {
    role: 'customer',
    convId: id,
    msgs: [],
    draft: [],
    unknown: [],
    quick: [],
    busy: 0,
    pendingFlavorIdx: -1,
    pendingAltCands: null,
    pendingClarification: null,
    lastReferencedProductIdx: -1,
    lastReferencedFlavorIdx: -1,
    lastUserText: '',
    lastUserTs: 0,
  };
}

export function isDuplicateRecentMessage(stateObj, text, windowMs = 900) {
  if (!stateObj || !text) return false;
  const norm = String(text).trim();
  if (!norm) return false;
  const now = Date.now();
  return stateObj.lastUserText === norm && now - (stateObj.lastUserTs || 0) < windowMs;
}

export function markUserMessageSent(stateObj, text) {
  if (!stateObj) return;
  stateObj.lastUserText = String(text || '').trim();
  stateObj.lastUserTs = Date.now();
}

export function appendMessageToHistory(stateObj, msg, maxMsgs = 60) {
  if (!stateObj || !Array.isArray(stateObj.msgs)) return;
  const clean = {
    r: msg.r === 'u' ? 'u' : 'a',
    t: String(msg.t || ''),
  };
  if (Array.isArray(msg.cards) && msg.cards.length) {
    clean.cards = msg.cards.slice(0, 8);
  }
  stateObj.msgs.push(clean);
  if (stateObj.msgs.length > maxMsgs) {
    stateObj.msgs = stateObj.msgs.slice(-maxMsgs);
  }
}

export function serializeCustomerSession({
  msgs = [],
  draft = [],
  unknown = [],
  quick = [],
  pendingClarification = null,
  lastReferencedProductIdx = -1,
  lastReferencedFlavorIdx = -1,
  mode = 'chat',
}) {
  return JSON.stringify({
    v: 1,
    savedAt: Date.now(),
    mode: mode === 'old' ? 'old' : 'chat',
    msgs: (Array.isArray(msgs) ? msgs : []).slice(-40).map((m) => ({
      r: m.r === 'u' ? 'u' : 'a',
      t: String(m.t || ''),
      ...(Array.isArray(m.cards) && m.cards.length ? { cards: m.cards.slice(0, 8) } : {}),
    })),
    draft: Array.isArray(draft) ? draft : [],
    unknown: Array.isArray(unknown) ? unknown.map(String) : [],
    quick: Array.isArray(quick) ? quick.slice(0, 6) : [],
    pendingClarification: pendingClarification || null,
    lastReferencedProductIdx: Number.isInteger(lastReferencedProductIdx) ? lastReferencedProductIdx : -1,
    lastReferencedFlavorIdx: Number.isInteger(lastReferencedFlavorIdx) ? lastReferencedFlavorIdx : -1,
  });
}

export function saveCustomerSessionToStorage(storage, snapshot, key = DEFAULT_CUSTOMER_STORAGE_KEY) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, serializeCustomerSession(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadCustomerSessionFromStorage(
  storage,
  catalogData = {},
  key = DEFAULT_CUSTOMER_STORAGE_KEY
) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const products = Array.isArray(catalogData?.p) ? catalogData.p : [];
    const safeDraft = products.length
      ? dedupeAndNormalizeDraft(parsed.draft || [], products)
      : Array.isArray(parsed.draft)
      ? parsed.draft
      : [];

    let lastProdIdx = Number.isInteger(parsed.lastReferencedProductIdx)
      ? parsed.lastReferencedProductIdx
      : -1;
    if (products.length && !products[lastProdIdx]) lastProdIdx = -1;

    return {
      mode: parsed.mode === 'old' ? 'old' : 'chat',
      msgs: Array.isArray(parsed.msgs) ? parsed.msgs.filter((m) => m && m.t) : [],
      draft: safeDraft,
      unknown: Array.isArray(parsed.unknown) ? parsed.unknown.map(String) : [],
      quick: Array.isArray(parsed.quick) ? parsed.quick : [],
      pendingClarification: parsed.pendingClarification || null,
      lastReferencedProductIdx: lastProdIdx,
      lastReferencedFlavorIdx: Number.isInteger(parsed.lastReferencedFlavorIdx)
        ? parsed.lastReferencedFlavorIdx
        : -1,
    };
  } catch {
    return null;
  }
}

export function clearCustomerSessionStorage(storage, key = DEFAULT_CUSTOMER_STORAGE_KEY) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}
