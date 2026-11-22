import { GoogleGenAI, Type } from '@google/genai';

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);

const DEFAULT_TEXT_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

const DEFAULT_AUDIO_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

export const SCHEMAS = {
  customer_chat: {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: 'Short friendly Egyptian Arabic response to the customer.' },
      intent: {
        type: Type.STRING,
        description: 'One of: order, edit, remove, clear, inquiry, confirm, clarify, greeting, unknown.',
      },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            i: { type: Type.INTEGER, description: 'Exact catalog product index or -1 if unknown.' },
            name: { type: Type.STRING, description: 'Exact product name from catalog if matched.' },
            variant: { type: Type.STRING, description: 'Requested size or variant if specified.' },
            f: { type: Type.INTEGER, description: 'Flavor index from catalog or -1.' },
            flavorName: { type: Type.STRING, description: 'Requested flavor name.' },
            q: { type: Type.INTEGER, description: 'Quantity in store units.' },
            a: { type: Type.BOOLEAN, description: 'True if ambiguous and needs customer disambiguation.' },
            alt: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ['i', 'f', 'q', 'a'],
        },
      },
      unknown: { type: Type.ARRAY, items: { type: Type.STRING } },
      clear: { type: Type.BOOLEAN },
      action: { type: Type.STRING, description: 'review or none' },
      quick: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            val: { type: Type.STRING },
          },
          required: ['label', 'val'],
        },
      },
    },
    required: ['reply', 'items', 'unknown', 'clear', 'action'],
  },

  customer_extract: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            i: { type: Type.INTEGER },
            name: { type: Type.STRING },
            variant: { type: Type.STRING },
            f: { type: Type.INTEGER },
            flavorName: { type: Type.STRING },
            q: { type: Type.INTEGER },
            a: { type: Type.BOOLEAN },
            alt: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ['i', 'f', 'q', 'a'],
        },
      },
      unknown: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['items', 'unknown'],
  },

  voice_polish: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Corrected Arabic voice transcript.' },
    },
    required: ['text'],
  },

  admin_chat: {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: 'Concise Arabic summary for the admin.' },
      intent: {
        type: Type.STRING,
        description: 'One of: add_product, edit_product, delete_product, query, category_op, offer_op, clarify, none.',
      },
      products: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            pack: { type: Type.STRING },
            price: { type: Type.NUMBER },
            oldPrice: { type: Type.NUMBER },
            variant: { type: Type.STRING },
            emoji: { type: Type.STRING },
            flavors: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['name'],
        },
      },
      ops: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: 'product, category, or offer' },
            where: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                variant: { type: Type.STRING },
                pack: { type: Type.STRING },
                flavor: { type: Type.STRING },
                minPrice: { type: Type.NUMBER },
                maxPrice: { type: Type.NUMBER },
                hidden: { type: Type.BOOLEAN },
                all: { type: Type.BOOLEAN },
              },
            },
            do: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                delete: { type: Type.BOOLEAN },
                hide: { type: Type.BOOLEAN },
                setPrice: { type: Type.NUMBER },
                addPrice: { type: Type.NUMBER },
                pctPrice: { type: Type.NUMBER },
                discountPct: { type: Type.NUMBER },
                setOldPrice: { type: Type.NUMBER },
                clearOldPrice: { type: Type.BOOLEAN },
                setName: { type: Type.STRING },
                setCategory: { type: Type.STRING },
                setPack: { type: Type.STRING },
                setVariant: { type: Type.STRING },
                addFlavors: { type: Type.ARRAY, items: { type: Type.STRING } },
                removeFlavors: { type: Type.ARRAY, items: { type: Type.STRING } },
                hideFlavors: { type: Type.ARRAY, items: { type: Type.STRING } },
                showFlavors: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            action: { type: Type.STRING },
            name: { type: Type.STRING },
            from: { type: Type.STRING },
            to: { type: Type.STRING },
            title: { type: Type.STRING },
            desc: { type: Type.STRING },
            price: { type: Type.STRING },
            badge: { type: Type.STRING },
          },
          required: ['type'],
        },
      },
      action: { type: Type.STRING, description: 'none or review' },
    },
    required: ['reply', 'products', 'ops', 'action'],
  },

  admin_batch: {
    type: Type.OBJECT,
    properties: {
      products: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            pack: { type: Type.STRING },
            price: { type: Type.NUMBER },
            oldPrice: { type: Type.NUMBER },
            variant: { type: Type.STRING },
            emoji: { type: Type.STRING },
            flavors: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['name'],
        },
      },
    },
    required: ['products'],
  },
};

function isValidCandidateModel(m) {
  const clean = String(m || '').trim().replace(/^models\//, '');
  if (!clean) return false;
  if (DEPRECATED_MODELS.has(clean.toLowerCase())) return false;
  if (/embed|imagen|veo|lyria|tts|live/i.test(clean)) return false;
  return true;
}

function classifyGeminiError(err) {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.code || 0);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate|LIMIT/i.test(msg)) {
    return { code: 'LIMIT', status: 429, retryable: true };
  }
  if (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|API key|PERMISSION_DENIED|\bKEY\b/i.test(msg)
  ) {
    return { code: 'KEY', status: 403, retryable: false };
  }
  if (status === 404 || /NOT_FOUND|not found|not supported/i.test(msg)) {
    return { code: 'NOT_FOUND', status: 404, retryable: false, tryNextModel: true };
  }
  if (err?.name === 'AbortError' || /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed/i.test(msg)) {
    return { code: 'TIMEOUT', status: 504, retryable: true };
  }
  if (status >= 500 || /INTERNAL|UNAVAILABLE/i.test(msg)) {
    return { code: 'UPSTREAM', status: 502, retryable: true };
  }
  return { code: 'AI_ERROR', status: 502, retryable: false };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('GEMINI_TIMEOUT');
      e.name = 'AbortError';
      reject(e);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function generateGeminiServer({
  apiKey,
  prompt,
  systemInstruction = '',
  audioBase64 = null,
  preferredModel = '',
  schemaType = '',
  temperature = null,
  taskType = 'general',
  timeoutMs = 20000,
  clientFactory = null,
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('KEY');
    err.status = 400;
    throw err;
  }

  const ai = clientFactory
    ? clientFactory(key)
    : new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

  const isAudio = Boolean(audioBase64);
  const baseList = isAudio ? DEFAULT_AUDIO_MODELS : DEFAULT_TEXT_MODELS;
  const candidates = [];
  if (isValidCandidateModel(preferredModel)) {
    candidates.push(String(preferredModel).trim().replace(/^models\//, ''));
  }
  for (const m of baseList) {
    if (!candidates.includes(m)) candidates.push(m);
  }

  const contents = isAudio
    ? [
        { text: String(prompt || '') },
        { inlineData: { mimeType: 'audio/wav', data: String(audioBase64) } },
      ]
    : String(prompt || '');

  const config = {
    temperature:
      temperature != null && Number.isFinite(Number(temperature))
        ? Math.max(0, Math.min(1, Number(temperature)))
        : isAudio
        ? 0
        : 0.1,
  };

  if (systemInstruction) {
    config.systemInstruction = String(systemInstruction);
  }

  const schema = schemaType && SCHEMAS[schemaType] ? SCHEMAS[schemaType] : null;
  if (!isAudio && schema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = schema;
  } else if (!isAudio && taskType !== 'voice_raw') {
    config.responseMimeType = 'application/json';
  }

  let lastCode = 'NOMODEL';

  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      try {
        const res = await withTimeout(
          ai.models.generateContent({
            model,
            contents,
            config,
          }),
          isAudio ? Math.max(25000, timeoutMs) : timeoutMs
        );
        const text = String(res?.text || '').trim();
        const latencyMs = Date.now() - started;

        if (!text && !isAudio) {
          console.warn('[ai-diag]', JSON.stringify({ event: 'empty_response', taskType, model, latencyMs }));
          break;
        }

        if (schema && text) {
          try {
            const parsed = JSON.parse(text);
            console.info('[ai-diag]', JSON.stringify({ event: 'ok', taskType, model, latencyMs, structured: true }));
            return { text, model, structured: parsed };
          } catch {
            console.warn('[ai-diag]', JSON.stringify({ event: 'invalid_json', taskType, model, latencyMs }));
            if (attempt === 0) {
              await sleep(250);
              continue;
            }
          }
        }

        console.info('[ai-diag]', JSON.stringify({ event: 'ok', taskType, model, latencyMs, structured: false }));
        return { text, model };
      } catch (err) {
        const latencyMs = Date.now() - started;
        const info = classifyGeminiError(err);
        lastCode = info.code;
        console.warn(
          '[ai-diag]',
          JSON.stringify({
            event: 'error',
            taskType,
            model,
            attempt,
            status: info.status,
            errorType: info.code,
            latencyMs,
          })
        );

        if (info.code === 'KEY') {
          const e = new Error('KEY');
          e.status = 403;
          throw e;
        }
        if (info.code === 'LIMIT' && attempt === 1) {
          const e = new Error('LIMIT');
          e.status = 429;
          throw e;
        }
        if (info.tryNextModel) {
          break;
        }
        if (info.retryable && attempt === 0) {
          await sleep(400 + Math.floor(Math.random() * 200));
          continue;
        }
        break;
      }
    }
  }

  const finalErr = new Error(lastCode === 'LIMIT' ? 'LIMIT' : 'NOMODEL');
  finalErr.status = lastCode === 'LIMIT' ? 429 : 502;
  throw finalErr;
}
