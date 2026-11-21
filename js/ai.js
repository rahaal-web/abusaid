import {
  lines,
  openCartSheet,
  openAIReviewFlavor,
  updCartSummary,
} from './cart.js';
import { lyClose, lyPush, ovf } from './store.js';
import { $, AN, pname, saveCart, state } from './state.js';
import { esc, FL, isOut, money, numAr, rnd, rn, rtk } from './utils.js';

let RL = [];
let RU = [];
let RT = '';
let RMODE = 'chat';
const CH = { msgs: [], busy: 0, nf: 0 };

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let VR = null;
let VON = false;
let VERR = 0;
let VWL = null;
let VGP = false;
let VPOL = false;
let VENG = '';
let VST = null;
let VSID = 0;
let VSL = [];
let VPEND = 0;
let VBASE = '';
let VAIERR = 0;

const RNUM = {};
[
  ['واحد', 1],
  ['واحده', 1],
  ['اتنين', 2],
  ['اثنين', 2],
  ['اتنتين', 2],
  ['تنين', 2],
  ['كرتونتين', 2],
  ['تلاته', 3],
  ['ثلاثه', 3],
  ['تلات', 3],
  ['ثلاث', 3],
  ['اربعه', 4],
  ['اربع', 4],
  ['خمسه', 5],
  ['خمس', 5],
  ['سته', 6],
  ['ست', 6],
  ['سبعه', 7],
  ['سبع', 7],
  ['تمانيه', 8],
  ['ثمانيه', 8],
  ['تمن', 8],
  ['ثمان', 8],
  ['تسعه', 9],
  ['تسع', 9],
  ['عشره', 10],
  ['عشر', 10],
  ['احداشر', 11],
  ['اتناشر', 12],
  ['تلتاشر', 13],
  ['اربعتاشر', 14],
  ['خمستاشر', 15],
  ['عشرين', 20],
  ['تلاتين', 30],
  ['ثلاثين', 30],
  ['اربعين', 40],
  ['خمسين', 50],
  ['ميه', 100],
].forEach((a) => {
  RNUM[a[0]] = a[1];
});

const RSTOP = {};
'عايز عاوز عايزه عاوزه اريد ابغي محتاج محتاجه هات هاتلي ضيف ضيفلي كمان طلب اطلب ابعت بعت ممكن لو سمحت من فضلك يا باشا معلم استاذ كرتونه كراتين كرتون كارتونه كرتونتين علبه علب دسته شوال عدد حبه قطعه وحده وحدات في عندي انا لي ده دي مع معاهم ورقم صنف نوع طعم نكهه نكهات بتاع بتاعه'
  .split(' ')
  .forEach((w) => {
    RSTOP[rn(w)] = 1;
  });

const RSP = new RegExp(
  '\\n|[,،؛;+.]|\\s+و\\s+|\\s+و(?=\\d)|\\s+و(?=(?:' +
    Object.keys(RNUM)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/ه/g, '[هة]').replace(/ا/g, '[اأإآ]'))
      .join('|') +
    ')(?:\\s|$))|\\s+ومعاهم\\s+|\\s+وكمان\\s+|\\s+كمان\\s+|\\s+ثم\\s+'
);

function rseg(t) {
  return rnd(t)
    .replace(/\r/g, '')
    .split(RSP)
    .map((x) => x.trim())
    .filter(Boolean);
}

function rq(toks) {
  let q = 0;
  const rest = [];
  toks.forEach((t) => {
    let v = null;
    if (/^\d+$/.test(t)) v = +t;
    else if (RNUM[t] != null) v = RNUM[t];
    else if (t[0] === 'و' && RNUM[t.slice(1)] != null) v = RNUM[t.slice(1)];
    if (v != null && !q && v > 0 && v < 1000) q = v;
    else rest.push(t);
  });
  return [q || 1, rest];
}

function rmatch(rest) {
  const S = {};
  rest.forEach((t) => {
    if (RSTOP[t]) return;
    S[t] = 1;
    if (t.length > 3 && t[0] === 'و') S[t.slice(1)] = 1;
  });
  if (!Object.keys(S).length) return null;
  const cs = [];
  state.P.forEach((p, i) => {
    if (p[7] || isOut(p)) return;
    const N = rtk(p[0] + ' ' + (p[10] || '')).filter((t) => !RSTOP[t]);
    let m = 0;
    N.forEach((t) => {
      if (S[t]) m++;
    });
    let fm = 0;
    FL(p).forEach((f) => {
      if (f[1]) return;
      let c = 0;
      rtk(f[0]).forEach((t) => {
        if (S[t]) c++;
      });
      if (c > fm) fm = c;
    });
    if (m || fm) cs.push({ i, s: m * 10 + (N.length ? (m / N.length) * 5 : 0) + fm * 3 });
  });
  cs.sort((a, b) => b.s - a.s);
  return cs.length ? { cs, S } : null;
}

function rlocal(text) {
  const items = [];
  const unk = [];
  rseg(text).forEach((sg) => {
    const r = rq(rtk(sg));
    const m = rmatch(r[1]);
    if (!m) {
      unk.push(sg);
      return;
    }
    const top = m.cs[0];
    const p = state.P[top.i];
    const fl = FL(p);
    const fs = [];
    if (fl.length) {
      let best = 0;
      const sc = [];
      fl.forEach((f, j) => {
        let c = 0;
        if (!f[1]) {
          rtk(f[0]).forEach((t) => {
            if (m.S[t]) c++;
          });
        }
        sc[j] = c;
        if (c > best) best = c;
      });
      if (best > 0) {
        sc.forEach((c, j) => {
          if (c === best) fs.push(j);
        });
      }
    }
    const cands = m.cs.slice(0, 5).map((c) => c.i);
    const amb = m.cs.length > 1 && m.cs[1].s >= top.s * 0.95;
    if (fs.length) {
      fs.forEach((j) => items.push({ i: top.i, f: j, q: r[0], c: cands, amb }));
    } else {
      items.push({ i: top.i, f: -1, q: r[0], c: cands, amb });
    }
  });
  return { items, unk };
}

async function rGem(key, prompt) {
  const B = 'https://generativelanguage.googleapis.com/v1beta/';
  const H = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  const tried = {};

  async function one(m) {
    tried[m] = 1;
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch(B + 'models/' + m + ':generateContent', {
        method: 'POST',
        headers: H,
        signal: ac.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.candidates && d.candidates[0];
        const t =
          c && c.content && c.content.parts
            ? c.content.parts.map((p) => p.text || '').join('')
            : '';
        if (t) {
          try {
            localStorage.setItem('rai_m', m);
          } catch (z) {}
          return t;
        }
        return null;
      }
      if (r.status === 429 || r.status === 403) throw new Error('STOP');
      let b = '';
      try {
        b = await r.text();
      } catch (z) {}
      if (/API key|API_KEY/i.test(b)) throw new Error('STOP');
      return null;
    } finally {
      clearTimeout(tm);
    }
  }

  const first = [];
  try {
    const sv = localStorage.getItem('rai_m');
    if (sv) first.push(sv);
  } catch (z) {}
  first.push('gemini-flash-lite-latest', 'gemini-flash-latest');

  for (let i = 0; i < first.length; i++) {
    if (tried[first[i]]) continue;
    const t = await one(first[i]);
    if (t) return t;
  }

  const lr = await fetch(B + 'models?pageSize=200', { headers: H });
  if (lr.ok) {
    const ld = await lr.json();
    const ns = (ld.models || [])
      .filter(
        (m) =>
          (m.supportedGenerationMethods || []).indexOf('generateContent') > -1 &&
          /flash/i.test(m.name) &&
          !/image|tts|live|audio|embed|exp|robotics|computer/i.test(m.name)
      )
      .map((m) => m.name.replace('models/', ''))
      .sort((a, b) => (/lite/.test(b) ? 1 : 0) - (/lite/.test(a) ? 1 : 0));

    for (let i = 0; i < ns.length && i < 4; i++) {
      if (tried[ns[i]]) continue;
      const t = await one(ns[i]);
      if (t) return t;
    }
  }
  throw new Error('NOMODEL');
}

function rCat() {
  const ls = [];
  state.P.forEach((p, i) => {
    if (p[7] || isOut(p)) return;
    ls.push(
      i +
        '|' +
        p[0] +
        '|' +
        (p[10] || '-') +
        '|' +
        (p[2] || '-') +
        '|' +
        p[3] +
        '|' +
        (FL(p)
          .map((f, j) => (f[1] ? '' : j + '=' + f[0]))
          .filter(Boolean)
          .join(';') || '-')
    );
  });
  return ls.join('\n');
}

function rNorm(j) {
  const items = [];
  const seen = {};
  (Array.isArray(j.items) ? j.items : []).forEach((x) => {
    const i = +x.i;
    let f = x.f == null ? -1 : +x.f;
    let q = Math.round(+x.q) || 1;
    const p = state.P[i];
    if (!p || p[7] || isOut(p)) return;
    const fl = FL(p);
    if (fl.length) {
      if (!(f >= 0 && fl[f] && !fl[f][1])) f = -1;
    } else {
      f = -1;
    }
    q = Math.max(1, Math.min(q, 99));
    const k = i + ':' + f;
    if (seen[k]) {
      seen[k].q = Math.min(seen[k].q + q, 99);
      return;
    }
    const c = [i];
    (Array.isArray(x.alt) ? x.alt : []).forEach((a) => {
      a = +a;
      if (state.P[a] && !state.P[a][7] && !isOut(state.P[a]) && c.indexOf(a) < 0) c.push(a);
    });
    const it = { i, f, q, c, amb: x.a === true && c.length > 1 };
    seen[k] = it;
    items.push(it);
  });
  return chFix(items);
}

function chFix(L) {
  const has = {};
  L.forEach((o) => {
    if (o.f >= 0) has[o.i] = 1;
  });
  return L.filter((o) => !(o.f < 0 && has[o.i]));
}

async function rAI(key, text) {
  const pr =
    'أنت مساعد دقيق لاستلام طلبات متجر جملة. العميل كتب أو قال طلبه بالعامية المصرية (ممكن يكون فيه أخطاء إملائية أو أخطاء من التعرف على الصوت). طابق كل صنف في كلامه مع الكتالوج بدقة واستخرج الكمية.\n' +
    'الكتالوج (رقم الصنف|الاسم|الحجم أو النوع|العبوة|السعر|النكهات بصيغة رقم=اسم):\n' +
    rCat() +
    '\nأرجع JSON فقط بالشكل: {"items":[{"i":0,"f":-1,"q":1,"a":false,"alt":[]}],"unknown":[""]}\nالقواعد:\n' +
    '- i هو رقم الصنف من الكتالوج بالظبط، و f رقم النكهة أو -1 لو الصنف مالوش نكهات أو العميل ماحددش نكهة، و q الكمية.\n' +
    '- لو الكتالوج فيه أكتر من صنف بنفس الاسم (أحجام أو أسعار مختلفة) اختار بالحجم أو السعر أو العبوة اللي ذكرها العميل (زي 5 جنيه أو 10 جنيه أو كبير أو صغير). لو ماذكرش حاجة تفرّق، اعتبر الصنف غير مؤكد.\n' +
    '- a تكون true لو مش متأكد من الصنف أو في أكتر من صنف ممكن يكون المقصود، وحط في alt أرقام الأصناف البديلة المحتملة (لحد 4). لو متأكد خلي a=false و alt=[].\n' +
    '- لو ذكر العميل أكتر من نكهة لنفس الصنف اعمل عنصر لكل نكهة بكميتها. لو ذكر نكهة بدون كمية خلي كميتها 1.\n' +
    '- لو ذكر كمية واحدة لأكتر من نكهة (مثال: «٣ شيبسي ملح وشطة») وزّعها بعدل أو خليها لكل نكهة حسب المعنى الأقرب، وماتحسبهاش مرتين.\n' +
    '- الكمية بالأرقام الإنجليزية. فهم الأرقام المكتوبة بالكلام (اتنين، تلاتة، دستة=12...) والكميات زي «كرتونتين» = 2.\n' +
    '- ماتخلطش بين نكهة وصنف: كلمة بعد اسم الصنف غالبًا نكهته لو موجودة في نكهات الصنف.\n' +
    '- ماتخترعش أصناف أو نكهات مش في الكتالوج، وحط أي كلام مش لاقي له صنف في unknown بنصه.\nطلب العميل:\n' +
    text;
  const raw = await rGem(key, pr);
  const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
  const items = rNorm(j);
  return { items, unk: (j.unknown || []).map(String) };
}

function rErr(m) {
  const e = $('rerr');
  if (e) {
    e.textContent = m;
    e.style.display = m ? 'block' : 'none';
  }
}

function vCat() {
  const nm = [];
  const fl = {};
  const ff = [];
  state.P.forEach((p, i) => {
    if (p[7] || isOut(p)) return;
    nm.push(pname(i));
    FL(p).forEach((f) => {
      if (!f[1] && !fl[f[0]]) {
        fl[f[0]] = 1;
        ff.push(f[0]);
      }
    });
  });
  return { n: nm.slice(0, 150), f: ff.slice(0, 200) };
}

function vfix(s) {
  return rnd(s)
    .replace(/\s*(?:سطر جديد|سطر تاني|سطر تانيه|السطر الجديد|صنف جديد|صنف تاني|صنف تانيه)\s*/g, '\n')
    .replace(/\s*(?:فاصلة|فاصله)\s*/g, '، ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n');
}

function vUI(on) {
  const b = $('rmic');
  const l = $('rmvl');
  if (b) b.classList.toggle('rec', on);
  if (l) l.textContent = on ? 'جاري الاستماع... دوس للإيقاف' : 'اطلب بالصوت';
  try {
    if (on) {
      if (navigator.wakeLock && !VWL) {
        navigator.wakeLock
          .request('screen')
          .then((x) => {
            VWL = x;
            x.addEventListener('release', () => {
              VWL = null;
            });
          })
          .catch(() => {});
      }
    } else if (VWL) {
      VWL.release();
      VWL = null;
    }
  } catch (z) {}
}

function vBeep(ac) {
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.14);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.16);
  } catch (z) {}
}

function vWav(f, sr) {
  const ra = sr / 16000;
  const n = Math.floor(f.length / ra);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  function ws(o, t) {
    for (let q = 0; q < t.length; q++) v.setUint8(o + q, t.charCodeAt(q));
  }
  ws(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ws(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    let a = 0;
    let c = 0;
    const st = Math.floor(i * ra);
    const en = Math.min(f.length, Math.floor((i + 1) * ra));
    for (let j = st; j < en; j++) {
      a += f[j];
      c++;
    }
    let x = c ? a / c : 0;
    x = Math.max(-1, Math.min(1, x));
    v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
  }
  const u = new Uint8Array(buf);
  let b = '';
  for (let k = 0; k < u.length; k += 8192) {
    b += String.fromCharCode.apply(null, u.subarray(k, k + 8192));
  }
  return btoa(b);
}

async function gAud(key, b64) {
  const B = 'https://generativelanguage.googleapis.com/v1beta/';
  const H = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  const ms = [];
  let sv = '';
  try {
    sv = localStorage.getItem('rai_m') || '';
  } catch (z) {}
  if (sv) ms.push(sv);
  ms.push('gemini-flash-lite-latest', 'gemini-flash-latest');
  const vc = vCat();
  const pr =
    'اكتب بالظبط الكلام المنطوق في المقطع الصوتي ده (بالعامية المصرية، وموضوعه طلب أصناف وكميات من متجر جملة) بإملاء صحيح. الأرقام بالإنجليزية. ماتضيفش أي شرح أو علامات اقتباس ولا تترجم. لو مفيش كلام مفهوم ارجع نص فاضي. العميل بيقول مثلاً: «عايز كرتونة شيبسي وكرتونة دوريتوس بطعم الشطة»، وكلمة «طعم» أو «بطعم» بتيجي قبل النكهة. لو سمعت كلمة قريبة في النطق من اسم صنف أو نكهة من القوايم دي اكتبها بالاسم الصح. أسماء الأصناف: ' +
    JSON.stringify(vc.n) +
    ' والنكهات: ' +
    JSON.stringify(vc.f);

  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 25000);
    try {
      const r = await fetch(B + 'models/' + m + ':generateContent', {
        method: 'POST',
        headers: H,
        signal: ac.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: pr }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }],
          generationConfig: { temperature: 0 },
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.candidates && d.candidates[0];
        const t =
          c && c.content && c.content.parts
            ? c.content.parts.map((p) => p.text || '').join('')
            : '';
        try {
          localStorage.setItem('rai_m', m);
        } catch (z) {}
        return t.trim().replace(/^["«»“”]+|["«»“”]+$/g, '').trim();
      }
      if (r.status === 429) throw new Error('LIMIT');
      let bt = '';
      try {
        bt = await r.text();
      } catch (z) {}
      if (r.status === 403 || /API key|API_KEY/i.test(bt)) throw new Error('KEY');
    } finally {
      clearTimeout(tm);
    }
  }
  throw new Error('NOMODEL');
}

function vAIrender() {
  const t = $('rt');
  if (!t) return;
  t.value =
    VBASE +
    vfix(
      VSL.map((x) => (x == null ? '…' : x))
        .filter((x) => x !== '')
        .join(' ')
    );
  t.scrollTop = t.scrollHeight;
  RT = t.value;
}

function vAIfail(err) {
  const m = err && err.message;
  VAIERR++;
  if (m === 'KEY' || m === 'LIMIT' || m === 'NOMODEL' || VAIERR >= 3) {
    if (VST && !VST.stopping) {
      const was = VON;
      vRelease();
      VENG = 'sr';
      rErr(
        m === 'LIMIT'
          ? 'حصة الذكاء الاصطناعي خلصت، هكمل بتعرف المتصفح'
          : m === 'KEY'
          ? 'الـ API مش مظبوط، هكمل بتعرف المتصفح'
          : 'الذكاء الاصطناعي مش متاح دلوقتي، هكمل بتعرف المتصفح'
      );
      if (was && SR) {
        VON = true;
        vRun();
      } else {
        VON = false;
        vUI(false);
      }
    }
  }
}

function vRelease() {
  const s = VST;
  VST = null;
  if (!s) return;
  try {
    s.pr.onaudioprocess = null;
    s.pr.disconnect();
  } catch (z) {}
  try {
    s.src.disconnect();
  } catch (z) {}
  try {
    s.stream.getTracks().forEach((t) => t.stop());
  } catch (z) {}
  try {
    s.ac.close();
  } catch (z) {}
}

function vSend(f, sr, key, sid) {
  const idx = VSL.length;
  VSL.push(null);
  VPEND++;
  vAIrender();
  let b64;
  try {
    b64 = vWav(f, sr);
  } catch (z) {
    VSL[idx] = '';
    VPEND--;
    return;
  }
  gAud(key, b64)
    .then((t) => {
      if (sid !== VSID) return;
      VSL[idx] = t;
      VAIERR = 0;
    })
    .catch((e) => {
      if (sid !== VSID) return;
      VSL[idx] = '';
      vAIfail(e);
    })
    .then(() => {
      VPEND--;
      if (sid === VSID) vAIrender();
    });
}

async function vAI(key) {
  const sid = ++VSID;
  const ta = $('rt');
  if (!ta) return;
  VBASE = ta.value;
  if (VBASE && !/\s$/.test(VBASE)) VBASE += ' ';
  VSL = [];
  VPEND = 0;
  VAIERR = 0;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const ac = new AC();
    if (ac.state === 'suspended') await ac.resume();
    if (sid !== VSID || !VON) {
      stream.getTracks().forEach((t) => t.stop());
      try {
        ac.close();
      } catch (z) {}
      return;
    }
    vBeep(ac);
    const src = ac.createMediaStreamSource(stream);
    const pr = ac.createScriptProcessor(4096, 1, 1);
    const sr = ac.sampleRate;
    const S = {
      ac,
      src,
      pr,
      stream,
      seg: [],
      pre: [],
      len: 0,
      speaking: false,
      silent: 0,
      noise: 0.004,
      t0: ac.currentTime + 0.3,
      stopping: false,
      key,
      sid,
      sr,
    };
    VST = S;
    S.flush = () => {
      const tot = S.len;
      const sp = S.speaking;
      const arr = S.seg;
      S.seg = [];
      S.len = 0;
      S.speaking = false;
      S.silent = 0;
      if (!sp || tot < sr * 0.4) return;
      const f = new Float32Array(tot);
      let o = 0;
      arr.forEach((c) => {
        f.set(c, o);
        o += c.length;
      });
      vSend(f, sr, key, sid);
    };
    pr.onaudioprocess = (e) => {
      if (!VST || VST !== S || S.stopping) return;
      if (ac.currentTime < S.t0) return;
      const d = e.inputBuffer.getChannelData(0);
      const c = new Float32Array(d.length);
      c.set(d);
      let sum = 0;
      for (let i = 0; i < c.length; i++) sum += c[i] * c[i];
      const rms = Math.sqrt(sum / c.length);
      const thr = Math.max(0.012, S.noise * 3);
      if (rms > thr) {
        if (!S.speaking) {
          S.speaking = true;
          S.seg = S.pre.slice();
          S.len = 0;
          S.seg.forEach((x) => {
            S.len += x.length;
          });
        }
        S.silent = 0;
        S.seg.push(c);
        S.len += c.length;
      } else {
        S.noise = S.noise * 0.95 + rms * 0.05;
        if (S.speaking) {
          S.seg.push(c);
          S.len += c.length;
          S.silent += c.length;
          if (S.silent > sr * 0.8) S.flush();
        } else {
          S.pre.push(c);
          if (S.pre.length > 3) S.pre.shift();
        }
      }
      if (S.speaking && S.len > sr * 12) S.flush();
    };
    src.connect(pr);
    pr.connect(ac.destination);
  } catch (x) {
    VON = false;
    vUI(false);
    rErr(
      x && (x.name === 'NotAllowedError' || x.name === 'SecurityError')
        ? 'اسمح للمايك من إعدادات المتصفح'
        : 'مقدرتش أشغّل المايك'
    );
  }
}

function vStopAI(graceful) {
  const S = VST;
  if (!graceful) {
    VSID++;
    VON = false;
    vRelease();
    vUI(false);
    return;
  }
  if (!S) {
    VON = false;
    vUI(false);
    return;
  }
  S.stopping = true;
  S.flush();
  VON = false;
  vRelease();
  const sid = S.sid;
  let n = 0;
  const iv = setInterval(() => {
    n++;
    if (VPEND <= 0 || n > 200 || sid !== VSID) {
      clearInterval(iv);
      if (sid === VSID) {
        vAIrender();
        vUI(false);
        vPolish();
      } else {
        vUI(false);
      }
    }
  }, 100);
}

async function vPolish() {
  const ta = $('rt');
  if (!ta || !state.CFG || !state.CFG.gk) return;
  const tx = ta.value.trim();
  if (!tx) return;
  VPOL = true;
  const l = $('rmvl');
  if (l) l.textContent = '✨ بظبط الكلام...';
  try {
    const vc = vCat();
    const pr =
      'ده طلب اتكتب بالإملاء الصوتي (بالعامية المصرية) لمتجر جملة، وممكن فيه كلمات اتسمعت غلط. صحّح الكلمات اللي اتسمعت غلط وخليها اسم الصنف أو النكهة الصح من القوايم، من غير ما تغيّر المعنى أو الأرقام أو الكميات. مثال: «بتاع مشاطة» تبقى «بطعم الشطة». ماتضيفش ولا تحذف أصناف أو كميات، وماتزودش عدد الأسطر. اكتب الأرقام بالإنجليزية.\nأسماء الأصناف: ' +
      JSON.stringify(vc.n) +
      '\nالنكهات: ' +
      JSON.stringify(vc.f) +
      '\nأرجع JSON فقط بالشكل {"text":""}\nالنص:\n' +
      tx;
    const raw = await rGem(state.CFG.gk, pr);
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const out = String(j.text || '').trim();
    const nl = (x) => x.split(/\n+/).filter((q) => q.trim()).length;
    const t2 = $('rt');
    if (
      t2 &&
      out &&
      out.length > tx.length * 0.5 &&
      out.length < tx.length * 2 &&
      nl(out) <= nl(tx) &&
      t2.value.trim() === tx
    ) {
      t2.value = out;
      RT = out;
    }
  } catch (x) {}
  VPOL = false;
  const l2 = $('rmvl');
  if (l2 && !VON && !VST && !VR) l2.textContent = 'اطلب بالصوت';
}

function vRun() {
  const ta = $('rt');
  if (!VON || !ta) return;
  const base = ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value || '';
  const r = new SR();
  VR = r;
  r.lang = 'ar-EG';
  r.interimResults = true;
  r.continuous = true;
  r.onresult = (e) => {
    VERR = 0;
    const t2 = $('rt');
    if (!t2) return;
    const fin = [];
    let im = '';
    for (let i = 0; i < e.results.length; i++) {
      const rr = e.results[i];
      const t = rr[0].transcript.trim();
      if (!t) continue;
      if (rr.isFinal) {
        const lf = fin.length ? fin[fin.length - 1] : '';
        if (lf && t.indexOf(lf) > -1) fin[fin.length - 1] = t;
        else if (lf && lf.indexOf(t) > -1) {
        } else fin.push(t);
      } else {
        im = t;
      }
    }
    const lf2 = fin.length ? fin[fin.length - 1] : '';
    if (lf2 && im.indexOf(lf2) === 0) im = im.slice(lf2.length).trim();
    else if (lf2 && im.length > 3 && lf2.indexOf(im) > -1) im = '';
    t2.value = base + vfix(fin.join(' ') + (im ? ' ' + im : ''));
    t2.scrollTop = t2.scrollHeight;
    RT = t2.value;
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      VON = false;
      rErr('اسمح للمايك من إعدادات المتصفح');
    } else if (e.error === 'network' || e.error === 'audio-capture') {
      VERR++;
    }
  };
  r.onend = () => {
    if (VR === r) VR = null;
    if (VON) {
      if (VERR > 20) {
        VON = false;
        vUI(false);
        rErr('فيه مشكلة في الاتصال أو المايك، التسجيل وقف');
        return;
      }
      setTimeout(vRun, VERR ? 600 : 120);
      return;
    }
    vUI(false);
    if (VGP) {
      VGP = false;
      vPolish();
    }
  };
  try {
    r.start();
  } catch (x) {
    VR = null;
    if (VON) {
      VERR++;
      if (VERR > 20) {
        VON = false;
        vUI(false);
      } else {
        setTimeout(vRun, 400);
      }
    }
  }
}

function vCanAI() {
  const AC = window.AudioContext || window.webkitAudioContext;
  return !!(
    state.CFG &&
    state.CFG.gk &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    AC &&
    window.btoa
  );
}

function vStart() {
  if (VON || VR || VST) return;
  const canAI = vCanAI();
  if (!canAI && !SR) {
    rErr('المتصفح ده مش بيدعم الكتابة بالصوت');
    return;
  }
  rErr('');
  VON = true;
  VERR = 0;
  vUI(true);
  if (canAI) {
    VENG = 'ai';
    vAI(state.CFG.gk);
  } else {
    VENG = 'sr';
    vRun();
  }
}

export function vStop(graceful) {
  if (VENG === 'ai' && (VST || VON)) {
    vStopAI(!!graceful);
    return;
  }
  if (!graceful) VSID++;
  VGP = !!graceful;
  VON = false;
  if (VR) {
    try {
      VR.stop();
    } catch (x) {
      VR = null;
      vUI(false);
      if (VGP) {
        VGP = false;
        vPolish();
      }
    }
  } else {
    vUI(false);
  }
}

function rMic() {
  const b = $('rmic');
  if (VPOL) return;
  if (VON || VR || VST) vStop(true);
  else if (!(VENG === 'ai' && b && b.classList.contains('rec'))) vStart();
}

function chReset() {
  CH.msgs = [];
  CH.busy = 0;
  CH.nf = 0;
  RL = [];
  RU = [];
  RT = '';
}

function rIn() {
  vStop(false);
  RMODE = 'old';
  const pn = $('rpn');
  if (!pn) return;
  pn.className = 'pn';
  pn.innerHTML =
    '<div class="rhead"><h2>' +
    esc(AN()) +
    '</h2><div class="rhead-act"><button type="button" class="mode-sw" id="chback">💬 المحادثة التفاعلية</button><button class="x" id="rx" type="button" aria-label="رجوع">✕</button></div></div>' +
    '<p class="fsub">اكتب طلبك زي ما بتتكلم وأنا هرتّبه لك، وبعدها تزوّد أو تنقّص زي ما تحب. مثال: ٥ كراتين شيبسي ملح و٣ طماطم و٢ ذرة</p>' +
    '<textarea id="rt" rows="5" placeholder="اكتب طلبك هنا...">' +
    esc(RT) +
    '</textarea>' +
    ((SR || vCanAI()) && !(state.CFG && state.CFG.rm)
      ? '<button class="vmic" id="rmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="rmvl">اطلب بالصوت</span></button>'
      : '') +
    '<div class="min" id="rerr"></div>' +
    '<button class="send rgold" id="rgo" type="button">حلّل طلبي 🤖</button>';
}

function chOpen() {
  vStop(false);
  RMODE = 'chat';
  const p = $('rpn');
  if (!p) return;
  p.className = 'pn rchat';
  p.innerHTML =
    '<div class="rhead"><h2>💬 ' +
    esc(AN()) +
    '</h2><div class="rhead-act"><button type="button" class="mode-sw" id="chold">✍️ كتابة مرة واحدة</button><button class="x" id="rx" type="button" aria-label="رجوع">✕</button></div></div>' +
    '<div id="chm" class="rcm"></div>' +
    '<div id="chd"></div>' +
    '<div class="rc-dock">' +
    ((SR || vCanAI()) && !(state.CFG && state.CFG.rm)
      ? '<button class="vmic sm" id="rmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="rmvl">اطلب بالصوت</span></button>'
      : '') +
    '<div class="rcin"><textarea id="rt" rows="2" placeholder="اكتب طلبك هنا... مثال: ٥ كراتين شيبسي ملح">' +
    esc(RT) +
    '</textarea><button class="send rgold" id="chsend" type="button">إرسال</button></div>' +
    '<div class="min" id="rerr"></div>' +
    '</div>';
  chRender();
}

function chRender() {
  const m = $('chm');
  if (!m) return;
  let h = '';
  if (!CH.msgs.length) {
    h =
      '<div class="rcb a">أهلًا 👋 أنا <b>' +
      esc(AN()) +
      '</b>. قولّي عايز تطلب إيه وكام ' +
      esc(state.CFG.unit || 'كرتونة') +
      '، وأنا هرتّب لك الطلب وأسألك عن الناقص (النكهة أو الحجم).' +
      '<div class="rc-samples">' +
      '<button type="button" class="rc-sample" data-sample="٥ كراتين شيبسي ملح و٣ ذرة مقرمشة">«٥ كراتين شيبسي ملح و٣ ذرة»</button>' +
      '<button type="button" class="rc-sample" data-sample="٢ كرتونة بسكويت شوكولاتة و٢ عصير مانجو">«٢ بسكويت شوكولاتة و٢ عصير مانجو»</button>' +
      '</div></div>';
  }
  CH.msgs.forEach((x) => {
    h += '<div class="rcb ' + x.r + '">' + esc(x.t) + '</div>';
  });
  if (CH.busy) h += '<div class="rcb a thinking">⏳ بفكّر وبحلل طلبك...</div>';
  m.innerHTML = h;
  m.scrollTop = m.scrollHeight;

  const d = $('chd');
  if (!d) return;
  if (!RL.length) {
    d.innerHTML = '';
    return;
  }
  let tot = 0;
  let rows = '';
  RL.forEach((l) => {
    const p = state.P[l.i];
    if (!p) return;
    const fl = FL(p);
    const fn = l.f >= 0 && fl[l.f] ? fl[l.f][0] : '';
    tot += l.q * p[3];
    rows +=
      '<div class="rcr"><span>' +
      esc(pname(l.i)) +
      (fn ? ' · ' + esc(fn) : fl.length ? ' · <b class="rw">النكهة؟</b>' : '') +
      (l.amb ? ' <b class="rw">⚠️</b>' : '') +
      '</span><span>' +
      numAr(l.q) +
      ' ×</span></div>';
  });

  d.innerHTML =
    '<div class="rcd">' +
    '<div class="rcd-head"><b>📝 طلبك لحد دلوقتي</b><span>' +
    money(tot) +
    '</span></div>' +
    '<div class="rcl">' +
    rows +
    '</div>' +
    '<div class="rca"><button class="send" id="chrv" type="button">✅ راجع وضيف للسلة</button><button class="rdel" id="chnw" type="button" aria-label="مسح">🗑</button></div>' +
    '</div>';
}

function chPrompt() {
  const dr = RL.map((l) => ({ i: l.i, f: l.f, q: l.q }));
  const tr = CH.msgs
    .slice(-14)
    .map((x) => (x.r === 'u' ? 'العميل: ' : 'المساعد: ') + x.t)
    .join('\n');
  return (
    'أنت «' +
    AN() +
    '» مساعد متجر جملة اسمه «أبو سعيد». بتكلم العميل بالعامية المصرية بشكل ودود ومختصر (سطرين بالكتير)، ومهمتك تاخد طلبه بالمحادثة وترتبه من كتالوج المتجر. العميل ممكن يكتب بأخطاء إملائية أو أخطاء من التعرف على الصوت، فطابق بدقة.\n' +
    'الكتالوج (رقم الصنف|الاسم|الحجم أو النوع|العبوة|السعر|النكهات بصيغة رقم=اسم):\n' +
    rCat() +
    '\nارجع JSON فقط (من غير أي كلام برّاه) بالشكل: {"reply":"","items":[{"i":0,"f":-1,"q":1,"a":false,"alt":[]}],"unknown":[""],"clear":false,"action":"none"}\n' +
    'القواعد:\n' +
    '- items هي الطلب الكامل الحالي في كل رد: ابدأ من «الطلب الحالي»، طبّق عليها آخر كلام العميل (إضافة أو تعديل كمية أو حذف)، وارجعه كله. ماتشيلش صنف غير لو العميل طلب ده صراحة، ولو شال كل الأصناف خلّي clear=true.\n' +
    '- i هو رقم الصنف من الكتالوج بالظبط، و f رقم النكهة أو -1 لو الصنف مالوش نكهات أو العميل ماحددش، و q الكمية بالأرقام الإنجليزية (فهم الأرقام بالكلام: اتنين، تلاتة، دستة=12، كرتونتين=2).\n' +
    '- لو الكتالوج فيه أكتر من صنف بنفس الاسم (أحجام أو أسعار مختلفة) اختار بالحجم أو السعر اللي ذكره العميل (زي 5 جنيه أو 10 جنيه أو كبير أو صغير). لو ماذكرش حاجة تفرّق اعتبره غير مؤكد: a=true وحط في alt الأصناف البديلة (لحد 4) واسأله هو قصده أنهي واحد.\n' +
    '- لو الصنف ليه نكهات والعميل ماحددش نكهة اسأله عن النكهة (اذكر له كام نكهة منها بالكتير). لو قال أي نكهة أو مش فارق سيب f=-1 وقوله هيختارها وهو بيراجع الطلب. لو ذكر أكتر من نكهة لنفس الصنف اعمل عنصر لكل نكهة بكميتها، ولو ذكر نكهة بدون كمية خلّي كميتها 1.\n' +
    '- اسأل سؤال واحد بس في المرة، وماتسألش عن حاجة العميل قالها.\n' +
    '- ماتخترعش أصناف ولا نكهات ولا أسعار مش في الكتالوج. أي كلام مش لاقي له صنف حطه في unknown بنصه وقوله في reply إنه مش موجود. ماتذكرش أسعار في reply لأن التطبيق بيعرضها.\n' +
    '- لما الطلب كله يبقى واضح (كل صنف له نكهته لو له نكهات) لخّصه في reply في جملة واسأله «أراجع الطلب ونضيفه؟».\n' +
    '- action تبقى "review" بس لو العميل وافق صراحة (قال أيوه أو تمام أو خلاص أو كده بس أو راجع أو يلا) والمسودة مش فاضية، غير كده تبقى "none".\n' +
    '- لو العميل سأل في حاجة بعيدة عن الطلب رد بجملة قصيرة وارجّعه للموضوع، وارجع الطلب الحالي زي ما هو.\n' +
    'الطلب الحالي: ' +
    JSON.stringify(dr) +
    '\nالمحادثة:\n' +
    tr
  );
}

function chLocal(t) {
  const r = rlocal(t);
  const names = [];
  let go = false;
  r.items.forEach((x) => {
    let e = null;
    RL.forEach((o) => {
      if (o.i === x.i && o.f === x.f) e = o;
    });
    if (e) e.q = Math.min(e.q + x.q, 99);
    else RL.push({ i: x.i, f: x.f, q: x.q, c: x.c, amb: x.amb });
    const p = state.P[x.i];
    const fl = FL(p);
    names.push(
      numAr(x.q) + ' × ' + pname(x.i) + (x.f >= 0 && fl[x.f] ? ' · ' + fl[x.f][0] : '')
    );
  });
  RL = chFix(RL);
  RU = r.unk;
  if (
    !r.items.length &&
    RL.length &&
    /^(?:ايوه|تمام|خلاص|يلا|كده|راجع|ضيف|اضف|ماشي|اه)(?:\s|$)/.test(rn(t))
  ) {
    go = true;
  }
  let m = '';
  if (names.length) m = 'ضفتلك:\n' + names.join('\n');
  if (r.unk.length) m += (m ? '\n' : '') + 'ما لقيتش في الأصناف: «' + r.unk.join('»، «') + '»';
  if (go) m = 'تمام، هراجع معاك الطلب 👌';
  else if (!names.length && !r.unk.length) m = 'ما فهمتش طلبك، جرّب تكتب اسم الصنف والكمية.';
  else if (names.length) m += '\nتزوّد حاجة؟ ولو خلصت دوس «راجع وضيف للسلة».';
  return { m, go };
}

async function rGo() {
  if (VON || VR || VST || VPEND > 0 || VPOL) {
    rErr('وقّف التسجيل واستنى لحد ما الكلام يتكتب، وبعدين دوس حلّل');
    return;
  }
  const ta = $('rt');
  const t = ta ? ta.value.trim() : '';
  RT = t;
  if (!t) {
    rErr('اكتب طلبك الأول');
    return;
  }
  rErr('');
  const b = $('rgo');
  if (b) {
    b.disabled = true;
    b.textContent = '⏳ بحلل طلبك...';
  }
  let res = null;
  if (state.CFG && state.CFG.gk) {
    try {
      res = await rAI(state.CFG.gk, t);
    } catch (e) {
      res = null;
    }
  }
  if (!res || !res.items.length) res = rlocal(t);
  const b2 = $('rgo');
  if (b2) {
    b2.disabled = false;
    b2.textContent = 'حلّل طلبي 🤖';
  }
  if (!res.items.length) {
    rErr('ما فهمتش طلبك، جرّب تكتب اسم الصنف والكمية');
    return;
  }
  RL = res.items;
  RU = res.unk;
  rRv();
}

async function chSend() {
  if (CH.busy) return;
  if (VON || VR || VST || VPEND > 0 || VPOL) {
    rErr('وقّف التسجيل واستنى لحد ما الكلام يتكتب، وبعدين دوس إرسال');
    return;
  }
  const ta = $('rt');
  const t = ta ? ta.value.trim() : '';
  if (!t) return;
  rErr('');
  CH.msgs.push({ r: 'u', t });
  ta.value = '';
  RT = '';
  CH.busy = 1;
  chRender();

  let ok = false;
  if (state.CFG && state.CFG.gk) {
    try {
      const raw = await rGem(state.CFG.gk, chPrompt());
      let j = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(j)) j = { items: j };
      const L = rNorm(j);
      if (L.length || j.clear === true || !RL.length) RL = L;
      RU = (Array.isArray(j.unknown) ? j.unknown : []).map(String);
      CH.msgs.push({ r: 'a', t: String(j.reply || 'تمام') });
      CH.busy = 0;
      ok = true;
      chRender();
      if (j.action === 'review' && RL.length) chReview();
    } catch (x) {
      ok = false;
    }
  }

  if (!ok) {
    const lr = chLocal(t);
    let pre = '';
    if (state.CFG && state.CFG.gk && !CH.nf) {
      CH.nf = 1;
      pre = 'الذكاء الاصطناعي مش متاح دلوقتي فرتّبت طلبك بالطريقة العادية.\n';
    }
    CH.msgs.push({ r: 'a', t: pre + lr.m });
    CH.busy = 0;
    chRender();
    if (lr.go) chReview();
  }
}

function chReview() {
  vStop(false);
  if (!RL.length) {
    rErr('الطلب فاضي، اكتب اللي عايزه الأول');
    return;
  }
  rRv();
}

function ropts(l) {
  const seen = {};
  let h = '<optgroup label="الأقرب">';
  (l.c && l.c.length ? l.c : [l.i]).forEach((i) => {
    if (!state.P[i] || seen[i]) return;
    seen[i] = 1;
    h +=
      '<option value="' +
      i +
      '"' +
      (i === l.i ? ' selected' : '') +
      '>' +
      esc(pname(i)) +
      '</option>';
  });
  h += '</optgroup><optgroup label="كل الأصناف">';
  state.P.forEach((p, i) => {
    if (seen[i] || p[7] || isOut(p)) return;
    h += '<option value="' + i + '">' + esc(pname(i)) + '</option>';
  });
  return h + '</optgroup>';
}

function rRv() {
  const pn = $('rpn');
  if (!pn) return;
  pn.className = 'pn';
  RL = RL.filter((l) => state.P[l.i]);
  if (!RL.length) {
    if (RMODE === 'old') rIn();
    else chOpen();
    return;
  }
  const ord = [];
  const gm = {};
  RL.forEach((l) => {
    const p = state.P[l.i];
    if (!gm[l.i]) {
      gm[l.i] = [l];
      ord.push(l.i);
    } else if (!FL(p).length) {
      gm[l.i][0].q = Math.min(gm[l.i][0].q + l.q, 99);
    } else {
      gm[l.i].push(l);
    }
  });
  RL = [];
  ord.forEach((i) => {
    gm[i].forEach((l) => RL.push(l));
  });

  let h =
    '<div class="rhead"><h2>' +
    esc(AN()) +
    '</h2><button class="x" id="rx" type="button" aria-label="رجوع">✕</button></div>' +
    '<p class="fsub">دي طلباتك زي ما فهمتها. زوّد أو نقّص أو غيّر أي صنف، ولو عايز أكتر من نكهة دوس «+ نكهة تانية».</p>';
  let tot = 0;
  const seen = {};

  RL.forEach((l, n) => {
    const p = state.P[l.i];
    const fl = FL(p);
    const a = ' data-rn="' + n + '"';
    const first = !seen[l.i];
    seen[l.i] = 1;
    tot += l.q * p[3];

    const fs = fl.length
      ? '<button type="button" class="fpick"' +
        a +
        ' data-rk="more"><span>' +
        (l.f < 0 ? '— اختار النكهة —' : esc(fl[l.f][0])) +
        '</span><i>▾</i></button>'
      : '';
    const del =
      '<button class="rdel" type="button"' + a + ' data-rk="del" aria-label="حذف">🗑</button>';

    if (first) {
      h +=
        '<div class="rrow"><div class="rh"><select' +
        a +
        ' data-rk="i">' +
        ropts(l) +
        '</select>' +
        del +
        '</div>' +
        fs;
    } else {
      h += '<div class="rsub-wrap"><div class="rh">' + fs + del + '</div>';
    }

    h +=
      '<div class="rf">' +
      (l.amb
        ? '<small>⚠️ اتأكد من الصنف</small>'
        : '<small>' + numAr(l.q) + ' × ' + numAr(p[3]) + ' جنيه</small>') +
      '<b>' +
      money(l.q * p[3]) +
      '</b>' +
      '<span class="step" style="margin:0;width:108px"><button type="button"' +
      a +
      ' data-rd="1" aria-label="زيادة">+</button><span>' +
      numAr(l.q) +
      '</span><button type="button"' +
      a +
      ' data-rd="-1" aria-label="نقص">−</button></span>' +
      '</div>';

    const last = !RL[n + 1] || RL[n + 1].i !== l.i;
    if (!first) h += '</div>';
    if (last) {
      if (fl.length) {
        h +=
          '<button class="addmore" type="button"' +
          a +
          ' data-rk="more">+ نكهة تانية</button>';
      }
      h += '</div>';
    }
  });

  if (RU.length) {
    h +=
      '<p class="fsub" style="margin-top:8px">ما لقيتش في الأصناف: «' +
      RU.map(esc).join('»، «') +
      '»</p>';
  }

  pn.innerHTML =
    h +
    '<div class="tot"><span>الإجمالي</span><span>' +
    money(tot) +
    '</span></div>' +
    '<div class="min" id="rerr"></div>' +
    '<button class="send" id="rok" type="button">✅ ضيف للسلة</button>' +
    '<button class="addmore" id="rbk" type="button" style="margin-top:10px">' +
    (RMODE === 'old' ? '← رجوع وعدّل كلامك' : '← رجوع للمحادثة') +
    '</button>';
}

function rOpenF(n) {
  const l = RL[n];
  if (!l) return;
  const fd = {};
  RL.forEach((o) => {
    if (o.i === l.i && o.f >= 0) fd[o.f] = (fd[o.f] || 0) + o.q;
  });
  openAIReviewFlavor(l.i, fd, (i, nextFD) => {
    const fs = Object.keys(nextFD)
      .map(Number)
      .sort((a, b) => a - b);
    let c = null;
    let pos = -1;
    RL.forEach((o, idx) => {
      if (o.i === i && pos < 0) {
        pos = idx;
        c = o.c;
      }
    });
    if (pos >= 0 && fs.length) {
      const nw = fs.map((j) => ({ i, f: j, q: nextFD[j], c, amb: false }));
      const out = [];
      RL.forEach((o, idx) => {
        if (idx === pos) nw.forEach((x) => out.push(x));
        if (o.i !== i) out.push(o);
      });
      RL = out;
    }
    rRv();
  });
}

function rAdd() {
  if (RL.some((l) => FL(state.P[l.i]).length && l.f < 0)) {
    rErr('اختار النكهة في الأصناف اللي لسه ما اتحددتش');
    return;
  }
  RL.forEach((l) => {
    const k = FL(state.P[l.i]).length ? l.i + ':' + l.f : String(l.i);
    state.cart[k] = Math.min((state.cart[k] || 0) + l.q, 99);
  });
  saveCart();
  state.hooks.renderCatalog();
  updCartSummary();
  chReset();
  closeAI();
  lines();
  openCartSheet();
}

export function aiHide() {
  const rs = $('rsheet');
  if (rs) rs.classList.remove('on');
  vStop(false);
  ovf();
  if (!$('sheet')?.classList.contains('on') && !$('fsheet')?.classList.contains('on')) {
    document.body.classList.remove('modal-open');
  }
}

export function openAI() {
  chOpen();
  const rs = $('rsheet');
  if (rs && !rs.classList.contains('on')) {
    rs.classList.add('on');
    document.body.classList.add('modal-open');
    lyPush(aiHide);
  }
  ovf();
}

export function closeAI() {
  lyClose(aiHide);
}

export function bindAIEvents() {
  const rs = $('rsheet');
  if (!rs) return;

  rs.addEventListener('keydown', (e) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.isComposing &&
      RMODE === 'chat' &&
      e.target &&
      e.target.id === 'rt' &&
      window.matchMedia &&
      matchMedia('(hover:hover) and (pointer:fine)').matches
    ) {
      e.preventDefault();
      chSend();
    }
  });

  let clearChatArmed = false;
  let clearChatTimer = null;

  rs.addEventListener('click', (e) => {
    let t = e.target;
    if (t !== rs) {
      const cb = t.closest('button');
      if (cb) t = cb;
    }
    if (t === rs || t.id === 'rx') {
      closeAI();
      return;
    }
    if (t.dataset && t.dataset.sample) {
      const ta = $('rt');
      if (ta) {
        ta.value = t.dataset.sample;
        RT = t.dataset.sample;
        chSend();
      }
      return;
    }
    if (t.id === 'rgo') {
      rGo();
      return;
    }
    if (t.id === 'chsend') {
      chSend();
      return;
    }
    if (t.id === 'chrv') {
      chReview();
      return;
    }
    if (t.id === 'chnw') {
      if (!clearChatArmed) {
        clearChatArmed = true;
        t.textContent = 'أكيد؟';
        clearChatTimer = setTimeout(() => {
          clearChatArmed = false;
          t.textContent = '🗑';
        }, 3000);
        return;
      }
      clearTimeout(clearChatTimer);
      clearChatArmed = false;
      chReset();
      chRender();
      return;
    }
    if (t.id === 'chold') {
      RL = [];
      RU = [];
      rIn();
      return;
    }
    if (t.id === 'chback') {
      chOpen();
      return;
    }
    if (t.id === 'rmic') {
      rMic();
      return;
    }
    if (t.id === 'rbk') {
      if (RMODE === 'old') rIn();
      else chOpen();
      return;
    }
    if (t.id === 'rok') {
      rAdd();
      return;
    }
    const n = t.dataset ? t.dataset.rn : null;
    if (n == null) return;
    const l = RL[+n];
    if (!l) return;
    if (t.dataset.rk === 'del') {
      RL.splice(+n, 1);
      rRv();
      return;
    }
    if (t.dataset.rk === 'more') {
      rOpenF(+n);
      return;
    }
    if (t.dataset.rd) {
      l.q += +t.dataset.rd;
      if (l.q < 1) RL.splice(+n, 1);
      else if (l.q > 99) l.q = 99;
      rRv();
    }
  });

  rs.addEventListener('change', (e) => {
    const t = e.target;
    const l = RL[+t.dataset.rn];
    if (!l) return;
    if (t.dataset.rk === 'i') {
      const oi = l.i;
      const ni = +t.value;
      RL.forEach((o) => {
        if (o.i === oi) {
          o.i = ni;
          o.f = -1;
          o.amb = false;
        }
      });
      rRv();
    } else if (t.dataset.rk === 'f') {
      l.f = +t.value;
      rRv();
    }
  });
}
