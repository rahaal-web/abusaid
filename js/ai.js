import {
  lines,
  openCartSheet,
  openAIReviewFlavor,
  updCartSummary,
} from './cart.js';
import { lyClose, lyPush, ovf } from './store.js';
import { $, AN, pname, saveCart, state, totals } from './state.js';
import { esc, FL, isOut, money, numAr, rnd, rn, rtk } from './utils.js';

let RL = [];
let RU = [];
let RT = '';
let RMODE = 'chat';
const CH = {
  msgs: [],
  busy: 0,
  nf: 0,
  quick: [],
  pendingFlavorIdx: -1,
  pendingAltCands: null,
};

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
  ['كارتونتين', 2],
  ['علبتين', 2],
  ['دستتين', 24],
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
  ['دسته', 12],
  ['دستة', 12],
  ['تلتاشر', 13],
  ['اربعتاشر', 14],
  ['خمستاشر', 15],
  ['ستاشر', 16],
  ['سبعتاشر', 17],
  ['تمنتاشر', 18],
  ['تسعتاشر', 19],
  ['عشرين', 20],
  ['تلاتين', 30],
  ['ثلاثين', 30],
  ['اربعين', 40],
  ['خمسين', 50],
  ['ميه', 100],
].forEach((a) => {
  RNUM[rn(a[0])] = a[1];
});

const ALIAS_MAP = {
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
};

function normTok(t) {
  let x = rn(t);
  if (x.length > 3 && x.indexOf('ال') === 0) x = x.slice(2);
  return ALIAS_MAP[x] || x;
}

function ntk(s) {
  return rtk(s).map((t) => ALIAS_MAP[t] || t);
}

const RSTOP = {};
'عايز عاوز عايزه عاوزه اريد ابغي محتاج محتاجه هات هاتلي ضيف ضيفلي كمان طلب اطلب ابعت بعت ممكن لو سمحت من فضلك يا باشا معلم استاذ ريس كرتونه كراتين كرتون كارتونه كرتونتين علبه علب دسته دستتين شوال عدد حبه قطعه وحده وحدات في عندي انا لي ده دي مع معاهم ورقم صنف نوع طعم نكهه نكهات بطعم بنكهة بتاع بتاعه متوفر موجود بكام سعر كام جنيه جني ج ابو ام فئه خليهم يبقي'
  .split(' ')
  .forEach((w) => {
    RSTOP[normTok(w)] = 1;
  });

const RSP = new RegExp(
  '\\n|[,،؛;+.]|\\s+و\\s+|\\s+و(?=\\d)|\\s+و(?=(?:' +
    Object.keys(RNUM)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/ه/g, '[هة]').replace(/ا/g, '[اأإآ]'))
      .join('|') +
    ')(?:\\s|$))|\\s+ومعاهم\\s+|\\s+وكمان\\s+|\\s+كمان\\s+|\\s+ثم\\s+'
);

function lev(a, b) {
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

function tokSim(qTok, targetToks) {
  if (!qTok || !targetToks.length) return 0;
  if (targetToks.indexOf(qTok) > -1) return 1;
  let best = 0;
  for (let i = 0; i < targetToks.length; i++) {
    const t = targetToks[i];
    if (qTok.length >= 3 && t.length >= 3) {
      if (t.indexOf(qTok) === 0 || qTok.indexOf(t) === 0) {
        best = Math.max(best, 0.85);
        continue;
      }
      const dist = lev(qTok, t);
      const maxL = Math.max(qTok.length, t.length);
      if (dist <= 1 || (maxL >= 5 && dist <= 2)) {
        best = Math.max(best, 1 - dist / maxL);
      }
    }
  }
  return best >= 0.7 ? best : 0;
}

function rseg(t) {
  return rnd(t)
    .replace(/\r/g, '')
    .split(RSP)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractHints(sg) {
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

function rq(toks) {
  let q = 0;
  const rest = [];
  toks.forEach((t) => {
    const nt = normTok(t);
    let v = null;
    if (/^\d+$/.test(t)) v = +t;
    else if (RNUM[nt] != null) v = RNUM[nt];
    else if (t[0] === 'و' && RNUM[normTok(t.slice(1))] != null) {
      v = RNUM[normTok(t.slice(1))];
    }
    if (v != null && !q && v > 0 && v < 1000) q = v;
    else rest.push(nt);
  });
  return [q || 1, rest];
}

function rmatch(rest, priceHints = [], includeSoldOut = false) {
  const S = [];
  rest.forEach((t) => {
    const nt = normTok(t);
    if (!nt || RSTOP[nt]) return;
    if (S.indexOf(nt) < 0) S.push(nt);
    if (nt.length > 3 && nt[0] === 'و') {
      const sub = normTok(nt.slice(1));
      if (sub && !RSTOP[sub] && S.indexOf(sub) < 0) S.push(sub);
    }
  });
  if (!S.length) return null;

  const cs = [];
  state.P.forEach((p, i) => {
    const out = p[7] || isOut(p);
    if (out && !includeSoldOut) return;
    const nameToks = ntk(p[0] + ' ' + (p[10] || '') + ' ' + (p[2] || '')).filter(
      (t) => !RSTOP[t]
    );
    const catToks = ntk(p[1] || '').filter((t) => !RSTOP[t]);

    let m = 0;
    let exactHits = 0;
    S.forEach((qt) => {
      const sim = tokSim(qt, nameToks);
      if (sim > 0) {
        m += sim;
        if (sim === 1) exactHits++;
      } else {
        const cSim = tokSim(qt, catToks);
        if (cSim > 0) m += cSim * 0.35;
      }
    });

    let fm = 0;
    FL(p).forEach((f) => {
      if (f[1] && !includeSoldOut) return;
      const ft = ntk(f[0]);
      let c = 0;
      S.forEach((qt) => {
        c += tokSim(qt, ft);
      });
      if (c > fm) fm = c;
    });

    let hintBoost = 0;
    if (priceHints.length) {
      const vStr = rnd(String(p[10] || '') + ' ' + String(p[2] || ''));
      priceHints.forEach((h) => {
        if (+p[3] === h) hintBoost += 14;
        else if (new RegExp('(?:^|\\D)' + h + '(?:\\D|$)').test(vStr)) hintBoost += 10;
      });
    }

    const totalScore =
      m * 11 +
      exactHits * 3 +
      (nameToks.length ? (m / nameToks.length) * 6 : 0) +
      fm * 4 +
      hintBoost -
      (out ? 2 : 0);

    if (m >= 0.7 || fm >= 0.8) {
      cs.push({ i, s: totalScore, out: !!out });
    }
  });

  cs.sort((a, b) => b.s - a.s);
  return cs.length ? { cs, S } : null;
}

function splitMultiFlavors(fl, queryToks) {
  const matches = [];
  fl.forEach((f, j) => {
    const fToks = ntk(f[0]).filter((t) => !RSTOP[t]);
    if (!fToks.length) return;
    let score = 0;
    queryToks.forEach((qt) => {
      score += tokSim(qt, fToks);
    });
    if (score >= 0.8) {
      matches.push({ j, score, out: !!f[1], name: f[0] });
    }
  });
  return matches.sort((a, b) => b.score - a.score);
}

function rlocal(text) {
  const items = [];
  const unk = [];
  const soldOutHits = [];

  rseg(text).forEach((rawSg) => {
    const { clean, hints } = extractHints(rawSg);
    const r = rq(ntk(clean || rawSg));
    const m = rmatch(r[1], hints, false);

    if (!m) {
      const mOut = rmatch(r[1], hints, true);
      if (mOut && mOut.cs[0] && mOut.cs[0].out) {
        soldOutHits.push(pname(mOut.cs[0].i));
      } else {
        unk.push(rawSg);
      }
      return;
    }

    const top = m.cs[0];
    const p = state.P[top.i];
    const fl = FL(p);
    const fs = [];
    const outFlavors = [];

    if (fl.length) {
      const fMatches = splitMultiFlavors(fl, m.S);
      if (fMatches.length) {
        const bestScore = fMatches[0].score;
        fMatches.forEach((fm) => {
          if (fm.score >= bestScore * 0.65) {
            if (fm.out) outFlavors.push(fm.name);
            else fs.push(fm.j);
          }
        });
      }
    }

    if (!fs.length && outFlavors.length) {
      soldOutHits.push(pname(top.i) + ' (' + outFlavors[0] + ')');
      return;
    }

    const cands = m.cs.slice(0, 5).map((c) => c.i);
    const sameNameAlts = m.cs.filter(
      (c) => c.i !== top.i && rn(state.P[c.i][0]) === rn(p[0])
    );
    const amb =
      !hints.length &&
      ((m.cs.length > 1 && m.cs[1].s >= top.s * 0.94) ||
        (sameNameAlts.length > 0 && sameNameAlts[0].s >= top.s * 0.88));

    if (fs.length) {
      fs.forEach((j) => items.push({ i: top.i, f: j, q: r[0], c: cands, amb }));
    } else {
      items.push({ i: top.i, f: -1, q: r[0], c: cands, amb });
    }
  });

  return { items, unk, soldOutHits };
}

async function rGem(_key, prompt) {
  const tried = {};

  async function one(m) {
    tried[m] = 1;
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: ac.signal,
        body: JSON.stringify({
          model: m,
          prompt,
          temperature: 0.15,
          responseMimeType: 'application/json',
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const t = d && d.text ? String(d.text) : '';
        if (t) {
          try {
            localStorage.setItem('rai_m', m);
          } catch (z) {}
          return t;
        }
        return null;
      }
      if (r.status === 401) {
        location.replace('/login');
        throw new Error('STOP');
      }
      if (r.status === 429 || r.status === 403 || r.status === 503) {
        throw new Error('STOP');
      }
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
  first.push(
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  );

  for (let i = 0; i < first.length; i++) {
    if (tried[first[i]]) continue;
    const t = await one(first[i]);
    if (t) return t;
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
        (+p[11] > p[3] ? '(قبل:' + p[11] + ')' : '') +
        '|' +
        p[1] +
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
    'الكتالوج (رقم الصنف|الاسم|الحجم أو النوع|العبوة|السعر|القسم|النكهات بصيغة رقم=اسم):\n' +
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

async function gAud(_key, b64) {
  const ms = [];
  let sv = '';
  try {
    sv = localStorage.getItem('rai_m') || '';
  } catch (z) {}
  if (sv) ms.push(sv);
  ms.push('gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest');
  const vc = vCat();
  const pr =
    'اكتب بالظبط الكلام المنطوق في المقطع الصوتي ده (بالعامية المصرية، وموضوعه طلب أصناف وكميات من متجر جملة) بإملاء صحيح. الأرقام بالإنجليزية. ماتضيفش أي شرح أو علامات اقتباس ولا تترجم. لو مفيش كلام مفهوم ارجع نص فاضي. العميل بيقول مثلاً: «عايز كرتونة شيبسي وكرتونة دوريتوس بطعم الشطة»، وكلمة «طعم» أو «بطعم» بتيجي قبل النكهة. لو سمعت كلمة قريبة في النطق من اسم صنف أو نكهة من القوايم دي اكتبها بالاسم الصح. أسماء الأصناف: ' +
    JSON.stringify(vc.n) +
    ' والنكهات: ' +
    JSON.stringify(vc.f);

  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const r = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        model: m,
        prompt: pr,
        audioBase64: b64,
        temperature: 0,
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const t = (d && d.text) || '';
      try {
        localStorage.setItem('rai_m', m);
      } catch (z) {}
      return t.trim().replace(/^["«»“”]+|["«»“”]+$/g, '').trim();
    }
    if (r.status === 429) throw new Error('LIMIT');
    if (r.status === 403 || r.status === 503) throw new Error('KEY');
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
  if (!ta || !state.CFG || !state.CFG.hasGk || state.CFG.aiMode === 'local') return;
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
    const raw = await rGem(null, pr);
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
    state.CFG.hasGk &&
    state.CFG.aiMode !== 'local' &&
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
    vAI('proxy');
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
  CH.quick = [];
  CH.pendingFlavorIdx = -1;
  CH.pendingAltCands = null;
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
    '<div class="rcin"><textarea id="rt" rows="2" placeholder="اسأل عن الأسعار، العروض، أو اطلب مباشرة...">' +
    esc(RT) +
    '</textarea><button class="send rgold" id="chsend" type="button">إرسال</button></div>' +
    '<div class="min" id="rerr"></div>' +
    '</div>';
  chRender();
}

function getDynamicSamples() {
  const kb = buildStoreKB();
  const s = [];
  if (kb.avail.length >= 2) {
    const p1 = kb.avail[0];
    const p2 = kb.avail[1];
    const fl1 = p1.availFlavors.length ? ' ' + p1.availFlavors[0].name : '';
    s.push({
      label: '«٢ ' + p1.name + fl1 + ' و١ ' + p2.name + '»',
      val: '٢ ' + p1.name + fl1 + ' و١ ' + p2.name,
    });
  } else {
    s.push({ label: '«٥ كراتين شيبسي ملح و٣ ذرة»', val: '٥ كراتين شيبسي ملح و٣ ذرة' });
  }
  if (kb.offers.length || kb.discounts.length) {
    s.push({ label: '🎁 إيه العروض والخصومات؟', val: 'إيه العروض والخصومات المتاحة؟' });
  }
  s.push({ label: '📋 إيه الأصناف المتوفرة؟', val: 'عندكم أصناف إيه؟' });
  return s;
}

function chRender() {
  const m = $('chm');
  if (!m) return;
  let h = '';
  if (!CH.msgs.length) {
    const samples = getDynamicSamples();
    h =
      '<div class="rcb a">أهلًا بيك 👋 أنا <b>' +
      esc(AN()) +
      '</b> مساعد متجر ' +
      esc((state.CFG && state.CFG.brandName) || 'أبو سعيد') +
      '. قولّي عايز تطلب إيه وكام ' +
      esc(state.CFG.unit || 'كرتونة') +
      '، أو اسألني عن الأسعار والعروض والنكهات المتوفرة.' +
      '<div class="rc-samples">' +
      samples
        .map(
          (x) =>
            '<button type="button" class="rc-sample" data-sample="' +
            esc(x.val) +
            '">' +
            esc(x.label) +
            '</button>'
        )
        .join('') +
      '</div></div>';
  }
  CH.msgs.forEach((x, idx) => {
    const isLastAssistant =
      idx === CH.msgs.length - 1 && x.r === 'a' && !CH.busy && CH.quick && CH.quick.length;
    h +=
      '<div class="rcb ' +
      x.r +
      '">' +
      esc(x.t) +
      (isLastAssistant
        ? '<div class="rc-quick">' +
          CH.quick
            .slice(0, 6)
            .map(
              (q) =>
                '<button type="button" class="rc-qbtn" data-quick="' +
                esc(q.val) +
                '">' +
                esc(q.label) +
                '</button>'
            )
            .join('') +
          '</div>'
        : '') +
      '</div>';
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

function buildStoreKB() {
  const avail = [];
  const soldOut = [];
  const discounts = [];
  const cats = {};

  state.P.forEach((p, idx) => {
    const fl = FL(p);
    const availFlavors = [];
    const outFlavors = [];
    fl.forEach((f, j) => {
      if (f[1]) outFlavors.push({ j, name: f[0] });
      else availFlavors.push({ j, name: f[0] });
    });
    const out = !!(p[7] || (fl.length && !availFlavors.length));
    const oldP = +p[11] > p[3] ? +p[11] : 0;
    const discPct = oldP ? Math.round(((oldP - p[3]) / oldP) * 100) : 0;
    const rec = {
      idx,
      p,
      name: pname(idx),
      baseName: p[0],
      cat: p[1],
      pack: p[2] || '',
      price: +p[3] || 0,
      oldPrice: oldP,
      discPct,
      variant: p[10] || '',
      availFlavors,
      outFlavors,
      out,
    };
    if (out) soldOut.push(rec);
    else {
      avail.push(rec);
      if (!cats[p[1]]) cats[p[1]] = [];
      cats[p[1]].push(rec);
      if (discPct > 0) discounts.push(rec);
    }
  });

  discounts.sort((a, b) => b.discPct - a.discPct);
  const offers = (state.D.offers || []).filter((o) => !o.x);
  return { avail, soldOut, discounts, cats, offers };
}

function chPrompt() {
  const kb = buildStoreKB();
  const dr = RL.map((l) => ({ i: l.i, f: l.f, q: l.q }));
  const tr = CH.msgs
    .slice(-14)
    .map((x) => (x.r === 'u' ? 'العميل: ' : 'المساعد: ') + x.t)
    .join('\n');
  const offTxt = kb.offers.length
    ? kb.offers.map((o) => o.t + (o.pr ? ' (' + o.pr + ')' : '') + (o.d ? ' - ' + o.d : '')).join(' | ')
    : 'مفيش عروض سلايدر حالياً';
  const outTxt = kb.soldOut.slice(0, 20).map((x) => x.name).join('، ') || 'مفيش';
  const cartTot = totals();

  return (
    'أنت «' +
    AN() +
    '» مساعد ذكي لمتجر جملة اسمه «' +
    ((state.CFG && state.CFG.brandName) || 'أبو سعيد') +
    '». بتكلم العميل بالعامية المصرية بشكل ودود ومختصر (سطرين أو ٣ بالكتير)، ومهمتك تستقبل طلبه، تجاوب على أسئلته عن الأسعار والعروض والأصناف والنكهات والحد الأدنى للطلب، وترتب طلبه بدقة.\n' +
    'معلومات المتجر:\n' +
    '- الوحدة: ' +
    ((state.CFG && state.CFG.unit) || 'كرتونة') +
    ' | أقل طلب: ' +
    ((+state.CFG?.min || 0) > 0 ? state.CFG.min + ' جنيه' : 'بدون حد أدنى') +
    ' | الموجود في السلة حالياً: ' +
    cartTot.n +
    ' وحدة بإجمالي ' +
    cartTot.s +
    ' جنيه.\n' +
    '- العروض الحالية: ' +
    offTxt +
    '\n- أصناف خلصانة حالياً (غير متاحة للطلب): ' +
    outTxt +
    '\nالكتالوج المتاح (رقم الصنف|الاسم|الحجم أو النوع|العبوة|السعر|القسم|النكهات بصيغة رقم=اسم):\n' +
    rCat() +
    '\nارجع JSON فقط (من غير أي كلام برّاه) بالشكل: {"reply":"","items":[{"i":0,"f":-1,"q":1,"a":false,"alt":[]}],"unknown":[""],"clear":false,"action":"none","quick":[{"label":"","val":""}]}\n' +
    'القواعد:\n' +
    '- items هي الطلب الكامل الحالي في كل رد: ابدأ من «الطلب الحالي»، طبّق عليها آخر كلام العميل (إضافة أو تعديل كمية أو حذف)، وارجعه كله. ماتشيلش صنف غير لو العميل طلب ده صراحة، ولو شال كل الأصناف خلّي clear=true.\n' +
    '- i هو رقم الصنف من الكتالوج بالظبط، و f رقم النكهة أو -1 لو الصنف مالوش نكهات أو العميل ماحددش، و q الكمية بالأرقام الإنجليزية (فهم الأرقام بالكلام: اتنين، تلاتة، دستة=12، كرتونتين=2).\n' +
    '- لو العميل سأل عن سعر صنف أو نكهاته أو العروض أو أقل طلب: جاوب بدقة من البيانات فوق، وارجع الطلب الحالي زي ما هو.\n' +
    '- لو الكتالوج فيه أكتر من صنف بنفس الاسم (أحجام أو أسعار مختلفة) اختار بالحجم أو السعر اللي ذكره العميل (زي 5 جنيه أو 10 جنيه أو كبير أو صغير). لو ماذكرش حاجة تفرّق اعتبره غير مؤكد: a=true وحط في alt الأصناف البديلة (لحد 4) واسأله هو قصده أنهي واحد.\n' +
    '- لو الصنف ليه نكهات والعميل ماحددش نكهة اسأله عن النكهة (واذكر كام نكهة في reply وحطهم في quick كأزرار سريعة لو حابب). لو قال أي نكهة أو مش فارق سيب f=-1 وقوله هيختارها وهو بيراجع الطلب.\n' +
    '- اسأل سؤال واحد بس في المرة، وماتخترعش أصناف أو نكهات أو أسعار مش في الكتالوج.\n' +
    '- action تبقى "review" بس لو العميل وافق صراحة (قال أيوه أو تمام أو خلاص أو كده بس أو راجع أو يلا) والمسودة مش فاضية، غير كده تبقى "none".\n' +
    '- quick (اختياري، بحد أقصى ٤ أزرار قصيرة) لاقتراح خطوة تالية مفيدة للعميل.\n' +
    'الطلب الحالي: ' +
    JSON.stringify(dr) +
    '\nالمحادثة:\n' +
    tr
  );
}

function fmtUnit(q) {
  return numAr(q) + ' ' + ((state.CFG && state.CFG.unit) || 'كرتونة');
}

function handlePendingFollowup(t, kb) {
  const n = rn(t);
  const toks = ntk(t).filter((x) => !RSTOP[x]);

  // 1) Resolving ambiguous candidate selection (e.g. "ابو 10" / "الاول" / "التاني")
  if (CH.pendingAltCands && CH.pendingAltCands.length) {
    const cands = CH.pendingAltCands;
    const { hints } = extractHints(t);
    let chosenIdx = -1;

    if (hints.length) {
      chosenIdx = cands.find((idx) => +state.P[idx]?.[3] === hints[0]) ?? -1;
      if (chosenIdx < 0) {
        chosenIdx =
          cands.find((idx) =>
            new RegExp('(?:^|\\D)' + hints[0] + '(?:\\D|$)').test(
              rnd(String(state.P[idx]?.[10] || '') + ' ' + String(state.P[idx]?.[2] || ''))
            )
          ) ?? -1;
      }
    }
    if (chosenIdx < 0 && /^(?:الاول|الاولاني|١|1)$/.test(n)) chosenIdx = cands[0];
    if (chosenIdx < 0 && /^(?:التاني|الثاني|٢|2)$/.test(n) && cands[1] != null) chosenIdx = cands[1];
    if (chosenIdx < 0 && /^(?:التالت|الثالث|٣|3)$/.test(n) && cands[2] != null) chosenIdx = cands[2];

    if (chosenIdx < 0 && toks.length) {
      let bestScore = 0;
      cands.forEach((idx) => {
        const p = state.P[idx];
        if (!p) return;
        const vt = ntk((p[10] || '') + ' ' + (p[2] || ''));
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

    if (chosenIdx >= 0) {
      const oldIdx = cands[0];
      RL.forEach((l) => {
        if (l.i === oldIdx && l.amb) {
          l.i = chosenIdx;
          l.f = -1;
          l.amb = false;
        }
      });
      CH.pendingAltCands = null;
      const p = state.P[chosenIdx];
      const fl = FL(p).filter((f) => !f[1]);
      if (fl.length) {
        CH.pendingFlavorIdx = chosenIdx;
        return {
          m:
            'تمام اخترتلك ' +
            pname(chosenIdx) +
            ' (' +
            money(p[3]) +
            ') 👍\nتحب أنهي نكهة؟ (أو اكتب أي نكهة من الموجودين)',
          go: false,
          quick: fl.slice(0, 4).map((f) => ({ label: f[0], val: f[0] })),
        };
      }
      return {
        m: 'تمام ظبّطتلك ' + pname(chosenIdx) + ' (' + money(p[3]) + ') 👌\nتحب تزوّد حاجة تانية؟',
        go: false,
        quick: [
          { label: '✅ راجع وضيف للسلة', val: 'راجع' },
          { label: '🎁 العروض', val: 'إيه العروض؟' },
        ],
      };
    }
  }

  // 2) Resolving pending flavor on a product previously added with f === -1
  if (CH.pendingFlavorIdx >= 0) {
    const targetIdx = CH.pendingFlavorIdx;
    const line = RL.find((l) => l.i === targetIdx && l.f < 0);
    const p = state.P[targetIdx];
    if (line && p) {
      if (/^(?:اي نكهه|اي طعم|مش فارق|عادي|كلهم|مشكل)/.test(n)) {
        CH.pendingFlavorIdx = -1;
        return {
          m: 'تمام 👍 سيبتلك ' + pname(targetIdx) + ' تختار نكهاته براحتك عند المراجعة. تحب تزوّد حاجة تانية؟',
          go: false,
          quick: [
            { label: '✅ راجع وضيف للسلة', val: 'راجع' },
            { label: '📋 باقي الأصناف', val: 'عندكم أصناف إيه؟' },
          ],
        };
      }

      // Check if user only typed flavor(s) without another product name
      const segs = rseg(t);
      const picked = [];
      const fl = FL(p);
      let looksLikeFlavorOnly = true;

      segs.forEach((sg) => {
        const sgRes = rq(ntk(sg));
        const fMatches = splitMultiFlavors(fl, sgRes[1]);
        if (fMatches.length && !fMatches[0].out) {
          picked.push({ j: fMatches[0].j, q: sgRes[0], name: fMatches[0].name });
        } else {
          // If this segment matches a totally different product, cancel flavor-only intercept
          const otherM = rmatch(sgRes[1], [], false);
          if (otherM && otherM.cs[0].i !== targetIdx && otherM.cs[0].s >= 11) {
            looksLikeFlavorOnly = false;
          }
        }
      });

      if (looksLikeFlavorOnly && picked.length) {
        const origQ = line.q;
        RL = RL.filter((l) => !(l.i === targetIdx && l.f < 0));
        const addedNames = [];
        picked.forEach((pkItem, kIdx) => {
          const useQ = picked.length === 1 && pkItem.q === 1 ? origQ : pkItem.q;
          const ex = RL.find((o) => o.i === targetIdx && o.f === pkItem.j);
          if (ex) ex.q = Math.min(ex.q + useQ, 99);
          else RL.push({ i: targetIdx, f: pkItem.j, q: useQ, c: [targetIdx], amb: false });
          addedNames.push(numAr(useQ) + ' × ' + pname(targetIdx) + ' · ' + pkItem.name);
        });
        CH.pendingFlavorIdx = -1;
        return {
          m: 'اتظبطت النكهة ✅:\n' + addedNames.join('\n') + '\nتحب تضيف صنف تاني ولا نراجع الطلب؟',
          go: false,
          quick: [
            { label: '✅ راجع وضيف للسلة', val: 'راجع' },
            { label: '🎁 شوف العروض', val: 'إيه العروض؟' },
          ],
        };
      }
    }
    CH.pendingFlavorIdx = -1;
  }

  return null;
}

function chLocal(t) {
  const n = rn(t)
    .replace(/[؟?!.،,;:«»"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const kb = buildStoreKB();

  // Check pending conversational follow-up (flavor / variant disambiguation)
  const follow = handlePendingFollowup(t, kb);
  if (follow) return follow;

  // 1) Confirm / Review intent
  if (
    RL.length &&
    /^(?:ايوه|تمام|خلاص|يلا|كده بس|كده|راجع|ضيف|اضف|ماشي|اه|موافق|اكد|ابعت|انقل للسله)(?:\s|$)/.test(n)
  ) {
    return { m: 'تمام، هراجع معاك الطلب ونضيفه للسلة 👌', go: true, quick: [] };
  }

  // 2) Clear entire draft
  if (/(?:امسح|فضي|الغي|شيل)\s*(?:كله|الكل|الطلب|المسوده|كل حاجه)|ابدا من جديد/.test(n)) {
    RL = [];
    RU = [];
    CH.pendingFlavorIdx = -1;
    CH.pendingAltCands = null;
    return {
      m: 'مسحت المسودة كلها 🗑 قولي تحب تبدأ بطلب إيه؟',
      go: false,
      quick: [
        { label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' },
        { label: '🎁 العروض', val: 'إيه العروض؟' },
      ],
    };
  }

  // 3) Remove specific product from draft ("شيل الشيبسي" / "احذف الدوريتوس" / "مش عايز بسكويت")
  if (/^(?:شيل|احذف|الغي|امسح|مش عايز|بلاش)\s+/.test(n)) {
    if (!RL.length) {
      return {
        m: 'المسودة فاضية أصلاً 😊 ابعتلي الأصناف اللي تحب تطلبها.',
        go: false,
        quick: [{ label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' }],
      };
    }
    const restText = t.replace(/^(?:شيل|احذف|الغي|امسح|مش عايز|بلاش)\s+/i, '');
    const m = rmatch(ntk(restText), [], true);
    if (m) {
      const targetIdx = m.cs[0].i;
      const before = RL.length;
      RL = RL.filter((l) => l.i !== targetIdx);
      if (RL.length < before) {
        return {
          m: 'شيلت ' + pname(targetIdx) + ' من الطلب ✅',
          go: false,
          quick: RL.length
            ? [{ label: '✅ راجع الطلب', val: 'راجع' }]
            : [{ label: '📋 الأصناف', val: 'عندكم إيه؟' }],
        };
      }
    }
    return {
      m: 'الصنف ده مش موجود في مسودة الطلب دلوقتي.',
      go: false,
      quick: [{ label: '✅ راجع الطلب الحالي', val: 'راجع' }],
    };
  }

  // 4) Adjust quantity on existing draft item ("زود" / "قلل" / "خليهم 5")
  if (RL.length && /^(?:زود|زودلي|نقص|قلل|خليهم|خلي|عدل)(?:\s|$)/.test(n)) {
    const nums = n.match(/\d+/);
    let qty = nums ? +nums[0] : 0;
    if (!qty) {
      for (const k in RNUM) {
        if (n.indexOf(k) > -1) {
          qty = RNUM[k];
          break;
        }
      }
    }
    const adjClean = n.replace(/^(?:زود|زودلي|نقص|قلل|خليهم|خلي|عدل)\s*/, '');
    const adjParsed = rq(ntk(adjClean));
    const m = rmatch(adjParsed[1], [], false);
    const line =
      (m &&
        m.cs
          .map((c) => RL.find((l) => l.i === c.i))
          .find(Boolean)) ||
      RL[RL.length - 1];
    if (line) {
      if (/^(?:زود|زودلي)/.test(n)) {
        line.q = Math.min(99, line.q + (qty || 1));
      } else if (/^(?:نقص|قلل)/.test(n)) {
        line.q = Math.max(1, line.q - (qty || 1));
      } else if (qty > 0) {
        line.q = Math.min(99, qty);
      }
      return {
        m:
          'عدّلت الكمية لـ ' +
          pname(line.i) +
          ' بقت ' +
          fmtUnit(line.q) +
          ' ✅',
        go: false,
        quick: [
          { label: '✅ راجع وضيف للسلة', val: 'راجع' },
          { label: '➕ أضيف صنف تاني', val: 'عندكم أصناف إيه؟' },
        ],
      };
    }
  }

  // 5) Offers & Discounts Q&A
  if (/(?:^|\s)(?:ال)?(?:عروض|عرض|خصم|خصومات|تخفيض|تخفيضات|اوفرز)(?:\s|$)/.test(n)) {
    const parts = [];
    if (kb.offers.length) {
      parts.push(
        '🎁 عروض اليوم:\n' +
          kb.offers
            .slice(0, 5)
            .map((o) => '• ' + o.t + (o.pr ? ' — ' + o.pr : '') + (o.d ? ' (' + o.d + ')' : ''))
            .join('\n')
      );
    }
    if (kb.discounts.length) {
      parts.push(
        '🔥 أصناف عليها خصم مباشر:\n' +
          kb.discounts
            .slice(0, 5)
            .map(
              (d) =>
                '• ' +
                d.name +
                ': ' +
                money(d.price) +
                ' بدل ' +
                money(d.oldPrice) +
                ' (خصم ' +
                numAr(d.discPct) +
                '%)'
            )
            .join('\n')
      );
    }
    if (!parts.length) {
      parts.push('كل الأصناف عندنا بأسعار الجملة المباشرة! تقدر تسأل عن أي صنف وهقولك سعره فوراً.');
    }
    const quick = kb.discounts.slice(0, 2).map((d) => ({
      label: 'اطلب ٢ ' + d.baseName,
      val: '٢ ' + d.name,
    }));
    quick.push({ label: '📋 كل الأقسام', val: 'عندكم أصناف إيه؟' });
    return { m: parts.join('\n\n'), go: false, quick };
  }

  // 6) Min order / Cart total / Store info Q&A
  if (/(?:اقل طلب|الحد الادني|حد ادني|حسابي|سله|سلة|توصيل|واتساب|رقم|شحن|وحدة|وحده)/.test(n)) {
    const minVal = +state.CFG?.min || 0;
    const cartTot = totals();
    const draftTot = RL.reduce((s, l) => s + l.q * (state.P[l.i]?.[3] || 0), 0);
    let m =
      '📦 نظام الطلب في ' +
      ((state.CFG && state.CFG.brandName) || 'أبو سعيد') +
      ':\n• الطلب بالـ ' +
      ((state.CFG && state.CFG.unit) || 'كرتونة') +
      '\n• ' +
      (minVal > 0 ? 'أقل قيمة للطلب: ' + money(minVal) : 'مفيش حد أدنى للطلب') +
      '\n• الإرسال فوري عبر واتساب مباشرة.';
    if (cartTot.n > 0) {
      m += '\n🛒 في سلتك دلوقتي: ' + fmtUnit(cartTot.n) + ' بإجمالي ' + money(cartTot.s);
    }
    if (draftTot > 0) {
      m += '\n📝 في المسودة: بإجمالي ' + money(draftTot);
    }
    return {
      m,
      go: false,
      quick: [
        { label: '🎁 العروض الحالية', val: 'إيه العروض؟' },
        { label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' },
      ],
    };
  }

  // 7) Price / Flavors / Stock question ("بكام الشيبسي" / "نكهات الدوريتوس" / "متوفر بيج شيبس؟")
  if (/(?:^|\s)(?:بكام|بكأم|سعر|اسعار|نكهات|اطعمه|طعوم|متوفر|في من|عندكم من|تفاصيل|خلصان)(?:\s|$)/.test(n) && !/عندكم\s+(?:ايه|اصناف)/.test(n)) {
    const queryClean = n.replace(
      /(?:^|\s)(?:بكام|بكأم|سعر|اسعار|نكهات|اطعمه|طعوم|متوفر|في من|عندكم من|تفاصيل|خلصان|هو|هي|ايه|اللي|في)(?=\s|$)/g,
      ' '
    );
    const { hints } = extractHints(queryClean);
    const m = rmatch(ntk(queryClean), hints, true);
    if (m) {
      const topRecs = m.cs.slice(0, 3).map((c) => {
        const p = state.P[c.i];
        return { i: c.i, p, out: c.out };
      });
      const linesTxt = topRecs.map(({ i, p, out }) => {
        const fl = FL(p);
        const avFl = fl.filter((f) => !f[1]).map((f) => f[0]);
        let s =
          '• ' +
          pname(i) +
          (p[2] ? ' (' + p[2] + ')' : '') +
          ' — ' +
          (out ? '❌ خلصان حالياً' : money(p[3]) + (+p[11] > p[3] ? ' (بدل ' + money(p[11]) + ')' : ''));
        if (!out && avFl.length) {
          s += '\n  النكهات: ' + avFl.slice(0, 7).join('، ') + (avFl.length > 7 ? ' و' + numAr(avFl.length - 7) + ' تانيين' : '');
        }
        return s;
      });
      const firstAvail = topRecs.find((x) => !x.out);
      const quick = firstAvail
        ? [
            {
              label: '➕ اطلب ٢ ' + pname(firstAvail.i),
              val:
                '٢ ' +
                pname(firstAvail.i) +
                (FL(firstAvail.p).find((f) => !f[1]) ? ' ' + FL(firstAvail.p).find((f) => !f[1])[0] : ''),
            },
            { label: '🎁 العروض', val: 'إيه العروض؟' },
          ]
        : [{ label: '📋 أصناف متوفرة تانية', val: 'عندكم أصناف إيه؟' }];
      return { m: linesTxt.join('\n'), go: false, quick };
    }
  }

  // 8) General catalog / category browsing ("عندكم إيه؟" / "اقسام إيه؟" / "أصناف الشيبسي")
  if (/(?:عندكم\s+ايه|عندكو\s+ايه|عندكم\s+اصناف|ايه\s+(?:اللي\s+)?متوفر|ايه\s+(?:اللي\s+)?موجود|(?:^|\s)(?:ال)?(?:اصناف|اقسام|منتجات|بضاعه|منيو|قوايم|كتالوج)(?:\s|$)|تبيعوا\s+ايه|متوفر\s+ايه)/.test(n)) {
    const catNames = Object.keys(kb.cats);
    const matchedCat = catNames.find((c) => n.indexOf(rn(c)) > -1);
    if (matchedCat) {
      const list = kb.cats[matchedCat];
      const msg =
        '📦 قسم ' +
        matchedCat +
        ' (' +
        numAr(list.length) +
        ' صنف متاح):\n' +
        list
          .slice(0, 8)
          .map((x) => '• ' + x.name + ' — ' + money(x.price))
          .join('\n') +
        (list.length > 8 ? '\n... و' + numAr(list.length - 8) + ' صنف تاني في الكتالوج' : '');
      return {
        m: msg,
        go: false,
        quick: list.slice(0, 3).map((x) => ({
          label: 'اطلب ٢ ' + x.baseName,
          val: '٢ ' + x.name,
        })),
      };
    }
    const msg =
      '🏪 متوفر عندنا ' +
      numAr(kb.avail.length) +
      ' صنف متوزعين على:\n' +
      catNames
        .map((c) => '• ' + c + ' (' + numAr(kb.cats[c].length) + ' صنف)')
        .join('\n') +
      '\nقولّي حابب تشوف قسم إيه أو اكتبلي طلبك على طول!';
    return {
      m: msg,
      go: false,
      quick: catNames.slice(0, 4).map((c) => ({ label: 'قسم ' + c, val: 'عندكم إيه في ' + c })),
    };
  }

  // Also check if user typed ONLY a category name like "شيبسي" or "مشروبات" with no quantity
  const pureCat = Object.keys(kb.cats).find((c) => rn(c) === n || n === 'قسم ' + rn(c));
  if (pureCat) {
    const list = kb.cats[pureCat];
    return {
      m:
        '📦 أشهر أصناف ' +
        pureCat +
        ':\n' +
        list
          .slice(0, 7)
          .map((x) => '• ' + x.name + ' — ' + money(x.price))
          .join('\n'),
      go: false,
      quick: list.slice(0, 3).map((x) => ({ label: 'اطلب ٢ ' + x.baseName, val: '٢ ' + x.name })),
    };
  }

  // 9) Greeting / Capabilities help
  if (/^(?:اهلا|أهلا|السلام عليكم|وعليكم|مرحبا|هاي|ازيك|صباح|مساء|مساعده|مساعدة|بتعمل ايه|انت مين)(?:\s|$)/.test(n)) {
    return {
      m:
        'أهلاً بيك في ' +
        ((state.CFG && state.CFG.brandName) || 'أبو سعيد') +
        ' 👋\nأنا مساعدك الذكي للطلبات! تقدر تكتبلي طلبك بالعامية (زي: «٣ شيبسي ملح و٢ دوريتوس»)، أو تسألني عن أي سعر أو عرض أو نكهة.',
      go: false,
      quick: [
        { label: '🎁 إيه العروض؟', val: 'إيه العروض والخصومات؟' },
        { label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' },
        { label: '💰 أقل طلب كام؟', val: 'أقل طلب كام؟' },
      ],
    };
  }

  // 10) Default: Full multi-item order extraction
  const r = rlocal(t);
  const names = [];
  let missingFlavorItem = null;
  let ambItem = null;

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
      fmtUnit(x.q) + ' ' + pname(x.i) + (x.f >= 0 && fl[x.f] ? ' · ' + fl[x.f][0] : '')
    );
    if (x.amb && !ambItem) ambItem = x;
    else if (x.f < 0 && fl.some((f) => !f[1]) && !missingFlavorItem) missingFlavorItem = x;
  });

  RL = chFix(RL);
  RU = r.unk;

  let m = '';
  let quick = [];

  if (names.length) m = 'ضفتلك للطلب ✅:\n' + names.join('\n');
  if (r.soldOutHits.length) {
    m += (m ? '\n\n' : '') + '⚠️ غير متوفر حالياً (خلصان): ' + r.soldOutHits.join('، ');
  }
  if (r.unk.length) {
    m += (m ? '\n' : '') + 'ما لقيتش في الأصناف: «' + r.unk.join('»، «') + '»';
  }

  if (ambItem && ambItem.c && ambItem.c.length > 1) {
    CH.pendingAltCands = ambItem.c.slice(0, 4);
    m += '\n\n🤔 قصدك أنهي حجم أو نوع من ' + state.P[ambItem.i][0] + '؟';
    quick = CH.pendingAltCands.map((idx) => ({
      label: pname(idx) + ' · ' + money(state.P[idx][3]),
      val: pname(idx) + ' ب ' + state.P[idx][3] + ' جنيه',
    }));
  } else if (missingFlavorItem) {
    const flAvail = FL(state.P[missingFlavorItem.i]).filter((f) => !f[1]);
    CH.pendingFlavorIdx = missingFlavorItem.i;
    m += '\n\n🌶 تحب أنهي نكهة في ' + pname(missingFlavorItem.i) + '؟';
    quick = flAvail.slice(0, 4).map((f) => ({ label: f[0], val: f[0] }));
    quick.push({ label: 'أي نكهة (اختار بعدين)', val: 'أي نكهة' });
  } else if (names.length) {
    m += '\nتحب تزوّد حاجة؟ ولو خلصت دوس «راجع وضيف للسلة».';
    quick = [
      { label: '✅ راجع وضيف للسلة', val: 'راجع' },
      { label: '🎁 شوف العروض', val: 'إيه العروض؟' },
    ];
  } else if (!r.soldOutHits.length && !r.unk.length) {
    m = 'ما قدرتش أحدد صنف من رسالتك 😊 جرّب تكتب اسم الصنف والكمية، أو اسألني «عندكم أصناف إيه؟».';
    quick = [
      { label: '📋 الأصناف المتوفرة', val: 'عندكم أصناف إيه؟' },
      { label: '🎁 العروض الحالية', val: 'إيه العروض؟' },
    ];
  }

  return { m, go: false, quick };
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
  if (state.CFG && state.CFG.hasGk && state.CFG.aiMode !== 'local') {
    try {
      res = await rAI(null, t);
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
    rErr(
      res.soldOutHits && res.soldOutHits.length
        ? 'الأصناف دي خلصانة حالياً: ' + res.soldOutHits.join('، ')
        : 'ما فهمتش طلبك، جرّب تكتب اسم الصنف والكمية'
    );
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
  CH.quick = [];
  ta.value = '';
  RT = '';
  CH.busy = 1;
  chRender();

  const useGemini = !!(state.CFG && state.CFG.hasGk && state.CFG.aiMode !== 'local');
  let ok = false;
  if (useGemini) {
    try {
      const raw = await rGem(null, chPrompt());
      let j = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(j)) j = { items: j };
      const L = rNorm(j);
      if (L.length || j.clear === true || !RL.length) RL = L;
      RU = (Array.isArray(j.unknown) ? j.unknown : []).map(String);
      CH.quick = Array.isArray(j.quick)
        ? j.quick
            .filter((q) => q && q.label && q.val)
            .slice(0, 4)
            .map((q) => ({ label: String(q.label), val: String(q.val) }))
        : [];
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
    CH.quick = Array.isArray(lr.quick) ? lr.quick : [];
    CH.msgs.push({ r: 'a', t: lr.m });
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
    if (t.dataset && (t.dataset.sample || t.dataset.quick)) {
      const txt = t.dataset.sample || t.dataset.quick;
      const ta = $('rt');
      if (ta) {
        ta.value = txt;
        RT = txt;
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
