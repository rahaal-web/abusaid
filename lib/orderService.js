import { randomHex, sha256Hex } from './cryptoWeb.js';

export const VALID_ORDER_STATUSES = [
  'sent_whatsapp',
  'confirmed',
  'completed',
  'cancelled',
];

function toAsciiDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴٥٦٧٨٩'.indexOf(d)));
}

function parseOfferNumericPrice(label) {
  const clean = toAsciiDigits(label).replace(/,/g, '');
  const m = clean.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) || 0 : 0;
}

function resolveProductEntry(products, rawIndex, rawName) {
  const idxNum = Number(rawIndex);
  const nameTrim = String(rawName || '').trim();
  if (Number.isInteger(idxNum) && idxNum >= 0 && idxNum < products.length) {
    const candidate = products[idxNum];
    if (candidate && (!nameTrim || String(candidate[0] || '').trim() === nameTrim)) {
      return { index: idxNum, product: candidate };
    }
  }
  if (nameTrim) {
    const foundIdx = products.findIndex(
      (p) => p && String(p[0] || '').trim() === nameTrim
    );
    if (foundIdx >= 0) {
      return { index: foundIdx, product: products[foundIdx] };
    }
  }
  return null;
}

function expandLegacyCartMap(cartObj) {
  const grouped = new Map();
  if (!cartObj || typeof cartObj !== 'object' || Array.isArray(cartObj)) {
    return [];
  }
  for (const [k, rawQty] of Object.entries(cartObj)) {
    const qty = Math.round(Number(rawQty));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const parts = String(k).split(':');
    const pIdx = Number(parts[0]);
    if (!Number.isInteger(pIdx) || pIdx < 0) continue;
    if (!grouped.has(pIdx)) {
      grouped.set(pIdx, { productIndex: pIdx, qty: 0, flavors: [] });
    }
    const entry = grouped.get(pIdx);
    if (parts.length > 1 && parts[1] !== '') {
      const fIdx = Number(parts[1]);
      if (Number.isInteger(fIdx) && fIdx >= 0) {
        entry.flavors.push({ flavorIndex: fIdx, qty });
        entry.qty += qty;
      }
    } else {
      entry.qty += qty;
    }
  }
  return Array.from(grouped.values());
}

export async function buildAuthoritativeOrder({ body, user, catalogData }) {
  if (!user || user.id == null) {
    return { error: 'يجب تسجيل الدخول أولاً.', status: 401 };
  }

  const data = catalogData && typeof catalogData === 'object' ? catalogData : {};
  const cfg = data.cfg && typeof data.cfg === 'object' ? data.cfg : {};
  const products = Array.isArray(data.p) ? data.p : [];
  const offers = Array.isArray(data.offers) ? data.offers : [];

  const orderType = body?.orderType === 'offer' ? 'offer' : 'cart';
  const unit = String(cfg.unit || 'كرتونة').trim() || 'كرتونة';
  const waPhone = String(cfg.phone || '').replace(/\D/g, '');
  const now = new Date().toISOString();
  const id = `ord_${Date.now().toString(36)}_${randomHex(4)}`;

  if (orderType === 'offer') {
    const offerIndex = Number(body?.offerIndex);
    const offerTitle = String(body?.offerTitle || '').trim();
    let offer = null;
    let resolvedOfferIndex = -1;

    if (Number.isInteger(offerIndex) && offerIndex >= 0 && offerIndex < offers.length) {
      const cand = offers[offerIndex];
      if (cand && !cand.x && (!offerTitle || String(cand.t || '').trim() === offerTitle)) {
        offer = cand;
        resolvedOfferIndex = offerIndex;
      }
    }
    if (!offer && offerTitle) {
      resolvedOfferIndex = offers.findIndex(
        (o) => o && !o.x && String(o.t || '').trim() === offerTitle
      );
      if (resolvedOfferIndex >= 0) offer = offers[resolvedOfferIndex];
    }

    if (!offer || !offer.t) {
      return { error: 'العرض غير متاح حالياً.', status: 400 };
    }

    const offerName = String(offer.t).trim().slice(0, 140);
    const offerPriceLabel = String(offer.pr || '').trim().slice(0, 80);
    const numericPrice = parseOfferNumericPrice(offerPriceLabel);
    const waMessage = `السلام عليكم، عايز أطلب عرض: ${offerName}`;

    const items = [
      {
        productIndex: resolvedOfferIndex,
        name: `عرض: ${offerName}`,
        category: 'العروض',
        unitPrice: numericPrice,
        qty: 1,
        subtotal: numericPrice,
        flavors: [],
      },
    ];

    const fingerprint = await sha256Hex(
      `${user.id}|offer|${resolvedOfferIndex}|${offerName}`
    );

    return {
      order: {
        id,
        userId: String(user.id),
        userName: String(user.fullName || '').slice(0, 120),
        userPhone: String(user.phone || '').slice(0, 32),
        shopName: String(user.shopName || '').slice(0, 120),
        address: String(user.address || '').slice(0, 200),
        orderType: 'offer',
        items,
        totalQty: 1,
        totalPrice: numericPrice,
        unit: 'عرض',
        offerPriceLabel,
        whatsappPhone: waPhone,
        whatsappMessage: waMessage,
        status: 'sent_whatsapp',
        fingerprint,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  // Cart order
  const rawItems = Array.isArray(body?.items)
    ? body.items
    : expandLegacyCartMap(body?.cart);

  if (!rawItems.length || rawItems.length > 200) {
    return { error: 'السلة فارغة أو تحتوي على عدد أصناف غير صالح.', status: 400 };
  }

  const normalizedItems = [];
  let totalQty = 0;
  let totalPrice = 0;

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const resolved = resolveProductEntry(
      products,
      rawItem.productIndex,
      rawItem.productName || rawItem.name
    );
    if (!resolved) {
      return {
        error: 'يوجد صنف في السلة لم يعد متاحاً بالكتالوج، حدّث الصفحة وحاول مرة أخرى.',
        status: 400,
      };
    }

    const { index: pIdx, product: p } = resolved;
    const productName = String(p[0] || '').trim().slice(0, 140);
    const category = String(p[1] || '').trim().slice(0, 80);
    const unitPrice = Number(p[3]) || 0;
    const isSoldOut = Boolean(p[7]);
    const catalogFlavors = Array.isArray(p[9]) ? p[9] : [];

    if (isSoldOut) {
      return {
        error: `الصنف "${productName}" غير متوفر حالياً.`,
        status: 400,
      };
    }

    const rawFlavors = Array.isArray(rawItem.flavors) ? rawItem.flavors : [];
    const normalizedFlavors = [];

    if (catalogFlavors.length > 0 && rawFlavors.length > 0) {
      for (const rf of rawFlavors) {
        const fq = Math.round(Number(rf?.qty));
        if (!Number.isFinite(fq) || fq <= 0 || fq > 999) continue;

        let fIdx = Number(rf?.flavorIndex);
        let fObj =
          Number.isInteger(fIdx) && fIdx >= 0 && fIdx < catalogFlavors.length
            ? catalogFlavors[fIdx]
            : null;
        const rfName = String(rf?.name || '').trim();
        if (
          (!fObj || (rfName && String(fObj[0] || '').trim() !== rfName)) &&
          rfName
        ) {
          const foundF = catalogFlavors.findIndex(
            (cf) => cf && String(cf[0] || '').trim() === rfName
          );
          if (foundF >= 0) {
            fIdx = foundF;
            fObj = catalogFlavors[foundF];
          }
        }
        if (!fObj || fObj[1]) continue;

        normalizedFlavors.push({
          flavorIndex: fIdx,
          name: String(fObj[0] || '').trim().slice(0, 100),
          qty: fq,
        });
      }
    }

    const qty = normalizedFlavors.length
      ? normalizedFlavors.reduce((sum, f) => sum + f.qty, 0)
      : Math.round(Number(rawItem.qty));

    if (!Number.isFinite(qty) || qty <= 0 || qty > 999) {
      continue;
    }

    const subtotal = Math.round(qty * unitPrice * 100) / 100;
    normalizedItems.push({
      productIndex: pIdx,
      name: productName,
      category,
      unitPrice,
      qty,
      subtotal,
      flavors: normalizedFlavors,
    });
    totalQty += qty;
    totalPrice += subtotal;
  }

  if (!normalizedItems.length || totalQty <= 0) {
    return { error: 'يرجى إضافة أصناف متوفرة إلى السلة أولاً.', status: 400 };
  }

  totalPrice = Math.round(totalPrice * 100) / 100;
  const minVal = Number(cfg.min) || 0;
  if (minVal > 0 && totalPrice < minVal) {
    return {
      error: `أقل قيمة للطلب ${minVal} جنيه.`,
      status: 400,
    };
  }

  const hdr =
    cfg.waHeader && String(cfg.waHeader).trim()
      ? String(cfg.waHeader).trim()
      : 'طلب جديد من الموقع 📦';
  let waMessage = `${hdr}\n\n`;
  for (const item of normalizedItems) {
    waMessage += `• ${item.name} × ${item.qty} ${unit} = ${item.subtotal} جنيه\n`;
    if (item.flavors.length) {
      for (const fl of item.flavors) {
        waMessage += `   ◦ ${fl.name}: ${fl.qty}\n`;
      }
    }
  }
  waMessage += `\nالإجمالي: ${totalPrice} جنيه`;

  const fingerprint = await sha256Hex(
    `${user.id}|cart|${JSON.stringify(
      normalizedItems.map((it) => [it.name, it.qty, it.flavors.map((f) => [f.name, f.qty])])
    )}`
  );

  return {
    order: {
      id,
      userId: String(user.id),
      userName: String(user.fullName || '').slice(0, 120),
      userPhone: String(user.phone || '').slice(0, 32),
      shopName: String(user.shopName || '').slice(0, 120),
      address: String(user.address || '').slice(0, 200),
      orderType: 'cart',
      items: normalizedItems,
      totalQty,
      totalPrice,
      unit,
      offerPriceLabel: '',
      whatsappPhone: waPhone,
      whatsappMessage: waMessage,
      status: 'sent_whatsapp',
      fingerprint,
      createdAt: now,
      updatedAt: now,
    },
  };
}
