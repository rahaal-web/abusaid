(function () {
  var D = { v: 1, cfg: { phone: '', min: 0, unit: 'كرتونة' }, cats: [], p: [], offers: [] };
  var tab = 'p',
    q = '',
    dirty = false,
    ei = -1,
    pal = 0,
    IMG = {},
    PEND = {},
    eimg = '',
    enew = '';
  var PAL = [
    ['أصفر', '#ffd23f', '#e8a400'],
    ['أحمر', '#ff4b3e', '#b3201a'],
    ['برتقالي', '#ff9f1c', '#c26a00'],
    ['أزرق', '#2b6cff', '#0f3fa8'],
    ['أخضر', '#17b26a', '#0b7a46'],
    ['بني', '#6b3e26', '#3a1f10'],
    ['وردي', '#ff5c8a', '#b3234f'],
    ['بيج', '#f1d58a', '#b58a22'],
  ];
  var $ = function (i) {
    return document.getElementById(i);
  };
  var fls = [];

  var usersData = [];
  var userCounts = { all: 0, Pending: 0, Approved: 0, Rejected: 0, Suspended: 0 };
  var userFilter = 'all';
  var userQuery = '';
  var usersLoading = false;
  var usersBusyId = '';
  var usersSetupNotice = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function AN() {
    var n = D && D.cfg && D.cfg.rn != null ? String(D.cfg.rn).trim() : '';
    return n || 'Rahal Ai';
  }

  function toast(m) {
    var t = $('ts');
    if (!t) return;
    t.textContent = m;
    t.className = 'toast on';
    clearTimeout(toast.t);
    toast.t = setTimeout(function () {
      t.className = 'toast';
    }, 2800);
  }

  function mark() {
    dirty = true;
    $('st').textContent = '• فيه تعديلات لسه ما اتنشرتش';
    $('pub').classList.add('hot');
  }

  window.onbeforeunload = function () {
    if (dirty) return 'x';
  };

  function cnt(c) {
    return D.p.filter(function (p) {
      return p[1] == c;
    }).length;
  }

  function np(v) {
    v = v
      .replace(/[٠-٩]/g, function (d) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
      })
      .replace(/\D/g, '');
    if (v.indexOf('00') == 0) v = v.slice(2);
    if (v[0] == '0') v = '20' + v.slice(1);
    return v;
  }

  function handleAdminUnauthorized() {
    dirty = false;
    toast('انتهت جلسة الإدارة، يرجى تسجيل الدخول مجدداً');
    setTimeout(function () {
      location.reload();
    }, 800);
  }

  // ===== Custom Confirm & Reject Reason Modals (No window.confirm / window.prompt) =====
  function askConfirm(message, okLabel) {
    return new Promise(function (resolve) {
      var cov = $('cov');
      if (!cov) {
        resolve(false);
        return;
      }
      cov.innerHTML =
        '<div class="pn" style="max-width:440px;border-radius:20px;margin:auto;border:3px solid var(--ink)">' +
        '<h2>تأكيد العملية<button class="x" type="button" id="covNo">✕</button></h2>' +
        '<p style="margin:12px 0;font-size:15px;line-height:1.7">' +
        esc(message) +
        '</p>' +
        '<div class="r2">' +
        '<button class="del big" type="button" id="covYes">' +
        esc(okLabel || 'تأكيد') +
        '</button>' +
        '<button class="pubb big" type="button" id="covCancel" style="background:var(--blue)">إلغاء</button>' +
        '</div></div>';
      cov.classList.add('on');
      function done(val) {
        cov.classList.remove('on');
        cov.innerHTML = '';
        cov.removeEventListener('click', onClick);
        resolve(val);
      }
      function onClick(e) {
        var t = e.target;
        if (t === cov || t.id === 'covNo' || t.id === 'covCancel') done(false);
        else if (t.id === 'covYes') done(true);
      }
      cov.addEventListener('click', onClick);
    });
  }

  function askRejectReason(userName) {
    return new Promise(function (resolve) {
      var cov = $('cov');
      if (!cov) {
        resolve(null);
        return;
      }
      cov.innerHTML =
        '<div class="pn" style="max-width:440px;border-radius:20px;margin:auto;border:3px solid var(--ink)">' +
        '<h2>رفض طلب الحساب<button class="x" type="button" id="rejNo">✕</button></h2>' +
        '<p class="hint" style="margin-top:8px">المستخدم: <b>' +
        esc(userName) +
        '</b></p>' +
        '<label>سبب الرفض (اختياري — يظهر للمستخدم)</label>' +
        '<textarea id="rejReason" rows="3" placeholder="مثال: بيانات النشاط التجاري غير مكتملة"></textarea>' +
        '<div class="r2">' +
        '<button class="del big" type="button" id="rejYes">تأكيد الرفض</button>' +
        '<button class="pubb big" type="button" id="rejCancel" style="background:var(--blue)">إلغاء</button>' +
        '</div></div>';
      cov.classList.add('on');
      setTimeout(function () {
        var ta = $('rejReason');
        if (ta) ta.focus();
      }, 40);
      function done(val) {
        cov.classList.remove('on');
        cov.innerHTML = '';
        cov.removeEventListener('click', onClick);
        resolve(val);
      }
      function onClick(e) {
        var t = e.target;
        if (t === cov || t.id === 'rejNo' || t.id === 'rejCancel') done(null);
        else if (t.id === 'rejYes') {
          var ta = $('rejReason');
          done(ta ? ta.value.trim() : '');
        }
      }
      cov.addEventListener('click', onClick);
    });
  }

  function updateUsersBadge() {
    var b = $('uBadge');
    if (!b) return;
    var pCount = Number(userCounts.Pending || 0);
    if (pCount > 0) {
      b.textContent = String(pCount);
      b.hidden = false;
    } else {
      b.hidden = true;
    }
  }

  function render() {
    var sb = $('smb');
    if (sb) sb.textContent = AN();
    [].forEach.call(document.querySelectorAll('.tb button'), function (b) {
      b.classList.toggle('on', b.dataset.t == tab);
    });
    updateUsersBadge();
    $('qw').hidden = tab != 'p';
    $('v').innerHTML =
      tab == 'p' ? vp() : tab == 'c' ? vc() : tab == 'o' ? vo() : tab == 'u' ? vu() : vs();
  }

  function vp() {
    var h = '';
    D.cats.forEach(function (c) {
      var it = [];
      D.p.forEach(function (p, i) {
        if (
          p[1] == c &&
          (!q ||
            p[0].indexOf(q) > -1 ||
            (p[9] || []).some(function (f) {
              return f[0].indexOf(q) > -1;
            }))
        )
          it.push(i);
      });
      h +=
        '<div class="sec"><div class="sh"><b>' +
        esc(c) +
        '</b><small>' +
        cnt(c) +
        ' صنف</small><button class="mini" data-add="' +
        esc(c) +
        '">+ صنف</button></div>';
      it.forEach(function (i) {
        var p = D.p[i];
        h +=
          '<div class="it' +
          (p[7] ? ' off' : '') +
          '" data-e="' +
          i +
          '" style="gap:6px">' +
          (q
            ? ''
            : '<div class="ar"><button type="button" data-pu="' +
              i +
              '">▲</button><button type="button" data-pd="' +
              i +
              '">▼</button></div>') +
          '<div class="mb" style="background:' +
          p[4] +
          '">' +
          (IMG[p[8]] ? '<img src="' + IMG[p[8]] + '" alt="">' : esc(p[6])) +
          '</div><div class="tx"><b>' +
          esc(p[0]) +
          (p[10] ? ' · ' + esc(p[10]) : '') +
          '</b><small>' +
          esc(p[2]) +
          (p[9] && p[9].length ? ' · ' + p[9].length + ' نكهات' : '') +
          '</small></div><div class="pr">' +
          (+p[11] > p[3]
            ? '<small style="text-decoration:line-through">' + p[11] + '</small>'
            : '') +
          p[3] +
          '<small>جنيه</small></div><button class="mini" type="button" data-dup="' +
          i +
          '" aria-label="تكرار" style="padding:4px 8px">📋</button><label class="sw"><input type="checkbox" data-av="' +
          i +
          '"' +
          (p[7] ? '' : ' checked') +
          '><i></i></label></div>';
      });
      if (!it.length)
        h += '<p class="emp">' + (q ? 'مفيش نتيجة' : 'القسم فاضي، دوس + صنف') + '</p>';
      h += '</div>';
    });
    return D.cats.length ? h : '<p class="emp">ضيف قسم الأول من تبويب الأقسام</p>';
  }

  function vc() {
    var h =
      '<p class="hint">رتّب الأقسام بالأسهم، أو اضغط على الاسم عشان تعدله.</p><div style="margin-top:10px">';
    D.cats.forEach(function (c, i) {
      h +=
        '<div class="cr"><div class="ar"><button data-up="' +
        i +
        '">▲</button><button data-dn="' +
        i +
        '">▼</button></div><input data-rn="' +
        i +
        '" value="' +
        esc(c) +
        '"><small>' +
        cnt(c) +
        ' صنف</small><button class="del" data-dc="' +
        i +
        '">🗑</button></div>';
    });
    return (
      h +
      '</div><div class="cr"><input id="nc" placeholder="اسم قسم جديد"><button class="pubb" id="addc">+ إضافة</button></div>'
    );
  }

  function rg(k, l, min, max, st, def, u) {
    var v = D.cfg[k] != null && D.cfg[k] !== '' ? +D.cfg[k] : def;
    return (
      '<label>' +
      l +
      ': <b id="nv_' +
      k +
      '">' +
      v +
      u +
      '</b></label><input type="range" data-n="' +
      k +
      '" data-u="' +
      u +
      '" min="' +
      min +
      '" max="' +
      max +
      '" step="' +
      st +
      '" value="' +
      v +
      '">'
    );
  }

  function fontPreviewStyle(id) {
    var im = id && IMG[id];
    if (!im) return '';
    return (
      '<style>@font-face{font-family:"prev_' +
      esc(id) +
      '";src:url("' +
      im +
      '");font-display:swap}</style><div style="font-family:\'prev_' +
      esc(id) +
      '\',Cairo,sans-serif;font-size:16px;padding:8px 10px;background:#fff;color:#1b1b1b;border:2px solid var(--ink);border-radius:10px;margin-top:6px">معاينة الفونت: <b>أبو سعيد – اطلب بضاعتك ١٩٠ جنيه</b></div>'
    );
  }

  function designCard() {
    var c = D.cfg,
      im = c.logo && IMG[c.logo];
    var fonts = [
      '',
      'Tajawal',
      'Almarai',
      'Alexandria',
      'Readex Pro',
      'Changa',
      'Rubik',
      'IBM Plex Sans Arabic',
      'Noto Kufi Arabic',
    ];
    return (
      '<div class="card2"><b style="font-family:Lalezar,Cairo,sans-serif;font-weight:400;font-size:20px">🔤 الخطوط وأحجام النصوص</b>' +
      '<label>اختيار خط عربي جاهز (اختياري)</label><select data-s="fontPreset">' +
      fonts
        .map(function (f) {
          return (
            '<option value="' +
            esc(f) +
            '"' +
            ((c.fontPreset || '') == f ? ' selected' : '') +
            '>' +
            (f ? esc(f) : 'الافتراضي (Cairo + Lalezar)') +
            '</option>'
          );
        })
        .join('') +
      '</select>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:10px 0 4px"><b style="flex:1">تطبيق الخط الأساسي على كل الموقع (العناوين والنصوص)</b><label class="sw"><input type="checkbox" data-s="fontUnified"' +
      (c.fontUnified ? ' checked' : '') +
      '><i></i></label></div>' +
      '<label>رفع خط مخصص للنصوص (TTF / OTF / WOFF / WOFF2)</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="pubb" style="display:inline-block;cursor:pointer;margin:0">📁 ارفع ملف خط<input type="file" id="fntBody" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label>' +
      (c.fontBodyId
        ? '<span style="font-size:12px;font-weight:800">' +
          esc(c.fontBodyName || 'خط مخصص') +
          '</span><button class="del" type="button" id="fntBodyRm">حذف الخط</button>'
        : '<span class="hint" style="margin:0">مفيش ملف خط مرفوع</span>') +
      '</div>' +
      (c.fontBodyId ? fontPreviewStyle(c.fontBodyId) : '') +
      '<label>رفع خط مخصص للعناوين والأسعار (اختياري)</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="pubb" style="display:inline-block;cursor:pointer;margin:0;background:var(--blue)">📁 ارفع خط عناوين<input type="file" id="fntHead" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label>' +
      (c.fontHeadId
        ? '<span style="font-size:12px;font-weight:800">' +
          esc(c.fontHeadName || 'خط عناوين') +
          '</span><button class="del" type="button" id="fntHeadRm">حذف خط العناوين</button>'
        : '<span class="hint" style="margin:0">يستخدم خط العناوين الافتراضي أو الأساسي</span>') +
      '</div>' +
      (c.fontHeadId ? fontPreviewStyle(c.fontHeadId) : '') +
      rg('fsBase', 'حجم الخط العام', 12, 20, 1, 15, ' px') +
      rg('fsTitle', 'حجم اسم الصنف', 13, 22, 1, 16, ' px') +
      rg('fsPrice', 'حجم سعر الصنف', 18, 32, 1, 22, ' px') +
      rg('fsHero', 'حجم العنوان الرئيسي (الهيرو)', 24, 54, 1, 38, ' px') +
      '</div>' +
      '<div class="card2"><b style="font-family:Lalezar,Cairo,sans-serif;font-weight:400;font-size:20px">🎨 شكل الصفحة والألوان</b>' +
      '<label>مظهر الموقع الافتراضي</label><select data-s="themeMode"><option value="auto"' +
      ((c.themeMode || 'auto') == 'auto' ? ' selected' : '') +
      '>تلقائي حسب جهاز العميل</option><option value="light"' +
      (c.themeMode == 'light' ? ' selected' : '') +
      '>نهاري (أصفر أبو سعيد)</option><option value="dark"' +
      (c.themeMode == 'dark' ? ' selected' : '') +
      '>ليلي داكن</option></select>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:10px 0 4px"><b style="flex:1">إظهار زر تبديل الوضع للعميل</b><label class="sw"><input type="checkbox" data-s="hideThemeBtn"' +
      (c.hideThemeBtn ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="r2" style="margin-top:6px"><div><label>لون الخلفية الأساسي</label><input type="color" data-s="cBg" value="' +
      esc(c.cBg || '#ffd93d') +
      '" style="height:40px;padding:3px"></div><div><label>لون العناوين والخصم</label><input type="color" data-s="cRed" value="' +
      esc(c.cRed || '#ff4b3e') +
      '" style="height:40px;padding:3px"></div></div>' +
      '<div class="r2" style="margin-top:4px"><div><label>لون أزرار الإضافة</label><input type="color" data-s="cBlue" value="' +
      esc(c.cBlue || '#2b6cff') +
      '" style="height:40px;padding:3px"></div><div><label>لون السلة وواتساب</label><input type="color" data-s="cGreen" value="' +
      esc(c.cGreen || '#17b26a') +
      '" style="height:40px;padding:3px"></div></div>' +
      '<button class="mini" type="button" id="resetColors" style="margin-top:8px">↩️ رجوع للألوان الأصلية</button>' +
      rg('cols', 'عدد الأصناف في الصف (كمبيوتر)', 2, 5, 1, 4, '') +
      '<label>لوجو وبانر الصفحة</label><div class="ip"><div class="ipv" style="width:96px;background:#19160f">' +
      (im ? '<img src="' + im + '" alt="">' : '<span style="font-size:12px;color:#fff3cf">الأصلي</span>') +
      '</div><div class="btns"><label class="pubb" style="display:inline-block;cursor:pointer;margin:0">📷 اختار صورة<input type="file" id="lgf" accept="image/*" hidden></label>' +
      (c.logo ? '<button class="del" type="button" id="lgrm">رجوع للأصلي</button>' : '') +
      '</div></div>' +
      rg('bh', 'ارتفاع البانر', 100, 320, 10, 160, ' px') +
      rg('ls', 'حجم اللوجو جوه البانر', 40, 120, 5, 100, '%') +
      rg('cs', 'حجم أزرار الأقسام', 80, 130, 5, 100, '%') +
      '</div>' +
      '<div class="card2"><b style="font-family:Lalezar,Cairo,sans-serif;font-weight:400;font-size:20px">🏠 نصوص الواجهة والأقسام</b>' +
      '<label>اسم المتجر في الهيدر</label><input data-s="brandName" value="' +
      esc(c.brandName == null ? 'أبو سعيد' : c.brandName) +
      '" placeholder="أبو سعيد">' +
      '<label>الوصف تحت الاسم</label><input data-s="brandSub" value="' +
      esc(c.brandSub == null ? 'جملة الشيبسي والسناكس' : c.brandSub) +
      '" placeholder="جملة الشيبسي والسناكس">' +
      '<div class="r2"><div><label>الشارة الأولى</label><input data-s="heroBadge" value="' +
      esc(c.heroBadge == null ? '🔥 جملة الجملة' : c.heroBadge) +
      '"></div><div><label>الشارة الثانية</label><input data-s="heroBadge2" value="' +
      esc(c.heroBadge2 == null ? 'توصيل سريع للمحلات' : c.heroBadge2) +
      '"></div></div>' +
      '<label>العنوان الترحيبي الرئيسي</label><input data-s="heroTitle" value="' +
      esc(c.heroTitle == null ? 'اطلب بضاعتك من أبو سعيد في دقايق' : c.heroTitle) +
      '">' +
      '<label>الوصف التسويقي</label><textarea rows="2" data-s="heroDesc">' +
      esc(
        c.heroDesc == null
          ? 'شيبسي، سناكس، حلويات ومشروبات بأسعار الجملة الحقيقية. اختار الكراتين والنكهات اللي تناسب محلك وابعت طلبك مباشرة على واتساب.'
          : c.heroDesc
      ) +
      '</textarea>' +
      '<label>بداية رسالة الطلب على واتساب</label><input data-s="waHeader" value="' +
      esc(c.waHeader == null ? 'طلب جديد من الموقع 📦' : c.waHeader) +
      '">' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:10px 0 0"><b style="flex:1">إظهار بانر وشعار الموقع فوق</b><label class="sw"><input type="checkbox" data-s="hideBanner"' +
      (c.hideBanner ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:8px 0 0"><b style="flex:1">إظهار بطاقة أصناف سريعة الطلب</b><label class="sw"><input type="checkbox" data-s="hideSpotlight"' +
      (c.hideSpotlight ? '' : ' checked') +
      '><i></i></label></div>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:8px 0 0"><b style="flex:1">إظهار شبكة الأقسام الرئيسية</b><label class="sw"><input type="checkbox" data-s="hideCatsBox"' +
      (c.hideCatsBox ? '' : ' checked') +
      '><i></i></label></div>' +
      '</div>'
    );
  }

  function vs() {
    var c = D.cfg;
    return (
      '<div class="card2"><label>رقم واتساب الطلبات</label><input dir="ltr" inputmode="tel" data-s="phone" value="' +
      esc(c.phone) +
      '" placeholder="مثال: 01012345678"><p class="hint">اكتبه بأي شكل (01… أو 20…) وهيتظبط لوحده. <a href="https://wa.me/' +
      esc(c.phone) +
      '" target="_blank" rel="noopener">جرّب الرقم 📲</a></p>' +
      '<label>أقل قيمة للطلب (جنيه)</label><input type="number" inputmode="numeric" data-s="min" value="' +
      c.min +
      '"><p class="hint">اكتب 0 لو مفيش حد أدنى.</p>' +
      '<label>اسم الوحدة</label><input data-s="unit" value="' +
      esc(c.unit) +
      '"><p class="hint">زي: كرتونة، دستة، شوال.</p><label>API (' +
      esc(AN()) +
      ' للعملاء)</label><input type="password" autocomplete="off" dir="ltr" data-s="gk" value="' +
      esc(c.gk || '') +
      '"></div>' +
      designCard() +
      '<div class="card2"><b style="font-family:Lalezar,Cairo,sans-serif;font-weight:400;font-size:20px">🎁 عنوان العروض</b>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:8px 0 0"><b style="flex:1">إظهار العنوان للعملاء</b><label class="sw"><input type="checkbox" data-s="oh"' +
      (c.oh ? '' : ' checked') +
      '><i></i></label></div>' +
      '<label>نص العنوان</label><input data-s="ot" value="' +
      esc(c.ot == null ? '🎁 العروض' : c.ot) +
      '" placeholder="🎁 العروض">' +
      rg('os', 'حجم العنوان', 60, 200, 5, 100, '%') +
      '</div>' +
      '<div class="card2"><b style="font-family:Lalezar,Cairo,sans-serif;font-weight:400;font-size:20px">🤖 ' +
      esc(AN()) +
      '</b>' +
      '<label>نظام تشغيل المساعد الذكي</label><select data-s="aiMode"><option value="auto"' +
      ((c.aiMode || 'auto') == 'auto' ? ' selected' : '') +
      '>تلقائي (Gemini القوي + الموديل المحلي الذكي)</option><option value="local"' +
      (c.aiMode == 'local' ? ' selected' : '') +
      '>الموديل المحلي الذكي فقط (فوري وبدون API)</option></select>' +
      '<label>اسم الزر</label><input data-s="rn" value="' +
      esc(c.rn == null ? 'Rahal Ai' : c.rn) +
      '" placeholder="Rahal Ai"><p class="hint">الاسم ده بيظهر على الزر عند العميل وفي لوحة التحكم. بعد التغيير دوس نشر عشان يتغير عند العملاء.</p>' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:8px 0 0"><b style="flex:1">إظهار ' +
      esc(AN()) +
      ' للعملاء</b><label class="sw"><input type="checkbox" data-s="ro"' +
      (c.ro ? '' : ' checked') +
      '><i></i></label></div>' +
      '<label>الجملة اللي جنب ' +
      esc(AN()) +
      '</label><input data-s="rt" value="' +
      esc(c.rt == null ? 'اطلب بالكتابة أو الصوت' : c.rt) +
      '" placeholder="اطلب بالكتابة أو الصوت">' +
      '<div class="cr" style="border:0;background:transparent;padding:0;margin:12px 0 0"><b style="flex:1">الكتابة بالصوت 🎤</b><label class="sw"><input type="checkbox" data-s="rm"' +
      (c.rm ? '' : ' checked') +
      '><i></i></label></div></div>'
    );
  }

  // ===== إدارة طلبات تسجيل الحسابات =====
  function formatDateAr(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return String(iso);
    }
  }

  function statusMeta(st) {
    if (st === 'Approved') return { label: 'تمت الموافقة', cls: 'st-Approved' };
    if (st === 'Rejected') return { label: 'مرفوض', cls: 'st-Rejected' };
    if (st === 'Suspended') return { label: 'موقوف من الإدارة', cls: 'st-Suspended' };
    return { label: 'في انتظار الموافقة', cls: 'st-Pending' };
  }

  function renderUserCardsHtml() {
    var sq = userQuery.toLowerCase();
    var list = usersData.filter(function (u) {
      if (userFilter !== 'all' && u.status !== userFilter) return false;
      if (!sq) return true;
      var hay = [u.fullName, u.phone, u.email, u.shopName, u.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.indexOf(sq) > -1;
    });

    if (usersLoading && !usersData.length) {
      return '<p class="emp">⏳ جاري تحميل الحسابات...</p>';
    }
    if (!list.length) {
      return (
        '<p class="emp">' +
        (userQuery || userFilter !== 'all'
          ? 'لا توجد حسابات مطابقة للبحث أو الفلتر المحدد.'
          : 'لا توجد طلبات تسجيل حسابات حتى الآن.') +
        '</p>'
      );
    }

    return list
      .map(function (u) {
        var meta = statusMeta(u.status);
        var busy = usersBusyId === String(u.id);
        var dis = busy ? ' disabled' : '';
        var acts = '';
        if (u.status === 'Pending') {
          acts =
            '<button class="uact uact-ok" type="button" data-ua="approve" data-uid="' +
            u.id +
            '"' +
            dis +
            '>✅ موافقة</button>' +
            '<button class="uact uact-warn" type="button" data-ua="reject" data-uid="' +
            u.id +
            '"' +
            dis +
            '>❌ رفض</button>' +
            '<button class="uact uact-del" type="button" data-ua="delete" data-uid="' +
            u.id +
            '"' +
            dis +
            '>🗑 حذف</button>';
        } else if (u.status === 'Approved') {
          acts =
            '<button class="uact uact-warn" type="button" data-ua="suspend" data-uid="' +
            u.id +
            '"' +
            dis +
            '>⛔ تعليق الحساب</button>' +
            '<button class="uact uact-del" type="button" data-ua="delete" data-uid="' +
            u.id +
            '"' +
            dis +
            '>🗑 حذف</button>';
        } else if (u.status === 'Suspended') {
          acts =
            '<button class="uact uact-ok" type="button" data-ua="activate" data-uid="' +
            u.id +
            '"' +
            dis +
            '>🔄 إعادة تفعيل</button>' +
            '<button class="uact uact-del" type="button" data-ua="delete" data-uid="' +
            u.id +
            '"' +
            dis +
            '>🗑 حذف</button>';
        } else {
          acts =
            '<button class="uact uact-ok" type="button" data-ua="approve" data-uid="' +
            u.id +
            '"' +
            dis +
            '>✅ موافقة وتفعيل</button>' +
            '<button class="uact uact-del" type="button" data-ua="delete" data-uid="' +
            u.id +
            '"' +
            dis +
            '>🗑 حذف</button>';
        }

        return (
          '<article class="ucard">' +
          '<div class="uhead"><div><b class="uname">' +
          esc(u.fullName) +
          '</b><div class="umeta">' +
          '<span dir="ltr">📞 ' +
          esc(u.phone) +
          '</span>' +
          '<span>✉️ ' +
          esc(u.email || 'بدون بريد إلكتروني') +
          '</span>' +
          (u.shopName ? '<span>🏪 ' + esc(u.shopName) + '</span>' : '') +
          (u.address ? '<span>📍 ' + esc(u.address) + '</span>' : '') +
          '<span>🕒 تاريخ التسجيل: ' +
          esc(formatDateAr(u.createdAt)) +
          '</span>' +
          (u.status === 'Rejected' && u.rejectionReason
            ? '<span style="color:var(--red);font-weight:800">📝 سبب الرفض: ' +
              esc(u.rejectionReason) +
              '</span>'
            : '') +
          '</div></div><span class="stpill ' +
          meta.cls +
          '">' +
          meta.label +
          '</span></div>' +
          '<div class="uacts">' +
          acts +
          '</div></article>'
        );
      })
      .join('');
  }

  function vu() {
    var filters = [
      ['all', 'الكل', userCounts.all || usersData.length],
      ['Pending', 'قيد المراجعة', userCounts.Pending || 0],
      ['Approved', 'مقبول', userCounts.Approved || 0],
      ['Suspended', 'موقوف', userCounts.Suspended || 0],
      ['Rejected', 'مرفوض', userCounts.Rejected || 0],
    ];
    return (
      '<div class="sh" style="margin-top:14px"><b>👥 طلبات تسجيل الحسابات</b><small>' +
      (userCounts.all || usersData.length) +
      ' حساب</small><button class="mini" type="button" id="uRefresh">🔄 تحديث</button></div>' +
      '<p class="hint">راجع طلبات تسجيل التجار الجدد. لا يمكن لأي مستخدم دخول المتجر إلا بعد الموافقة على حسابه.</p>' +
      (usersSetupNotice
        ? '<div class="card2" style="border-color:var(--red);background:#fff3cd;color:#5c3d00"><b>⚠️ مطلوب استكمال ربط قاعدة بيانات الحسابات</b><p style="margin:6px 0 0;font-size:13px;line-height:1.7">' +
          esc(usersSetupNotice) +
          '</p></div>'
        : '') +
      '<div class="ufil">' +
      filters
        .map(function (f) {
          return (
            '<button type="button" class="fbtn' +
            (userFilter === f[0] ? ' on' : '') +
            '" data-uf="' +
            f[0] +
            '">' +
            f[1] +
            ' (' +
            f[2] +
            ')</button>'
          );
        })
        .join('') +
      '</div>' +
      '<input id="uq" type="search" placeholder="🔍 ابحث بالاسم أو رقم الهاتف أو البريد أو اسم المحل..." value="' +
      esc(userQuery) +
      '" style="margin:8px 0 12px">' +
      '<div id="uList">' +
      renderUserCardsHtml() +
      '</div>'
    );
  }

  async function loadUsers(silent) {
    usersLoading = true;
    try {
      var res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var raw = await res.text();
      var data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (z) {
        data = {};
      }
      if (!res.ok) {
        if (data && data.needsRtdbSetup) {
          usersSetupNotice = data.error || '';
          if (tab === 'u') render();
          return;
        }
        throw new Error(data.error || 'تعذر تحميل الحسابات');
      }
      usersSetupNotice = '';
      usersData = Array.isArray(data.users) ? data.users : [];
      userCounts = data.counts || { all: usersData.length, Pending: 0, Approved: 0, Rejected: 0, Suspended: 0 };
      updateUsersBadge();
      if (tab === 'u') render();
    } catch (e) {
      if (!silent) toast(e && e.message ? e.message : 'تعذر تحميل الحسابات');
    } finally {
      usersLoading = false;
    }
  }

  async function runUserAction(action, uid) {
    var user = usersData.find(function (u) {
      return String(u.id) === String(uid);
    });
    if (!user) return;

    var method = 'POST';
    var url = '/api/admin/users/' + encodeURIComponent(uid) + '/' + action;
    var body = null;

    if (action === 'reject') {
      var reason = await askRejectReason(user.fullName);
      if (reason === null) return;
      body = JSON.stringify({ reason: reason });
    } else if (action === 'suspend') {
      var okSusp = await askConfirm(
        'هل أنت متأكد من تعليق حساب "' + user.fullName + '"؟ سيتم إخراجه من الموقع فوراً ولن يتمكن من الدخول.',
        '⛔ تعليق الحساب'
      );
      if (!okSusp) return;
    } else if (action === 'delete') {
      var okDel = await askConfirm(
        'هل أنت متأكد من حذف حساب "' + user.fullName + '" نهائياً؟ لا يمكن التراجع عن هذه الخطوة.',
        '🗑 حذف نهائي'
      );
      if (!okDel) return;
      method = 'DELETE';
      url = '/api/admin/users/' + encodeURIComponent(uid);
    }

    usersBusyId = String(uid);
    if (tab === 'u') {
      var listEl = $('uList');
      if (listEl) listEl.innerHTML = renderUserCardsHtml();
    }

    try {
      var opts = {
        method: method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) opts.body = body;
      var res = await fetch(url, opts);
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تنفيذ العملية');

      await loadUsers(true);
      toast(
        action === 'approve'
          ? 'تمت الموافقة على الحساب وتفعيله ✅'
          : action === 'activate'
          ? 'تمت إعادة تفعيل الحساب ✅'
          : action === 'reject'
          ? 'تم رفض الطلب'
          : action === 'suspend'
          ? 'تم تعليق الحساب وإلغاء جلسته'
          : 'تم حذف الحساب نهائياً'
      );
    } catch (err) {
      toast(err && err.message ? err.message : 'تعذر تنفيذ العملية');
    } finally {
      usersBusyId = '';
      if (tab === 'u') render();
    }
  }

  // ===== تعديل / إضافة الأصناف والأقسام =====
  var dupFrom = -1;
  function openEd(i, c, dup) {
    var sp = null;
    if (dup && D.p[i]) {
      sp = D.p[i];
      dupFrom = i;
      i = -1;
    } else dupFrom = -1;
    ei = i;
    var p = sp
      ? JSON.parse(JSON.stringify(sp))
      : i >= 0
      ? D.p[i]
      : ['', c, '', 0, PAL[0][1], PAL[0][2], '🥔', 0, ''];
    fls = (p[9] || []).map(function (f) {
      return [f[0], f[1] ? 1 : 0];
    });
    pal = 0;
    eimg = p[8] || '';
    enew = '';
    PAL.forEach(function (x, j) {
      if (x[1] == p[4]) pal = j;
    });
    $('ov').innerHTML =
      '<div class="pn"><h2>' +
      (i >= 0 ? 'تعديل صنف' : sp ? 'نسخة جديدة من صنف' : 'صنف جديد') +
      '<button class="x" id="edx">✕</button></h2>' +
      (sp
        ? '<p class="hint" style="margin:6px 0 0">📋 ده صنف جديد منسوخ من «' +
          esc(sp[0]) +
          '». غيّر السعر أو العبوة أو القسم وبعدين دوس حفظ.</p>'
        : '') +
      '<label>صورة المنتج</label><div class="ip"><div class="ipv" id="ipv">' +
      (eimg && IMG[eimg] ? '<img src="' + IMG[eimg] + '" alt="">' : esc(p[6])) +
      '</div><div class="btns"><label class="pubb" style="display:inline-block;cursor:pointer">📷 اختر صورة<input type="file" id="ff" accept="image/*" hidden></label><button class="del" id="irm" type="button">إزالة الصورة</button></div></div><label>اسم الصنف</label><input id="fn" value="' +
      esc(p[0]) +
      '"><div class="r2"><div><label>السعر (جنيه)</label><input id="fp" type="number" inputmode="numeric" value="' +
      (p[3] || '') +
      '"></div><div style="max-width:92px"><label>إيموجي</label><input id="fe" value="' +
      esc(p[6]) +
      '" style="text-align:center"></div></div><div class="r2"><div><label>السعر قبل الخصم (اختياري)</label><input id="fo" type="number" inputmode="numeric" value="' +
      (+p[11] > 0 ? p[11] : '') +
      '" placeholder="مثال: 220"></div><div><label>اسم الحجم / النوع (اختياري)</label><input id="fv" value="' +
      esc(p[10] || '') +
      '" placeholder="مثال: ١٠ جنيه"></div></div><p class="hint">لو فيه أكتر من صنف بنفس الاسم في نفس القسم، العميل هيشوفهم في كارت واحد ويختار بين الأحجام.</p><label>العبوة / الوصف</label><input id="fd" value="' +
      esc(p[2]) +
      '" placeholder="مثال: كرتونة ٤٨ كيس"><label>القسم</label><select id="fc">' +
      D.cats
        .map(function (x) {
          return '<option' + (x == p[1] ? ' selected' : '') + '>' + esc(x) + '</option>';
        })
        .join('') +
      '</select><label>النكهات / الأطعمة (اختياري)</label><div id="fl"></div><div class="r2"><div><input id="fnew" placeholder="اكتب نكهة، أو كذا نكهة بفاصلة (،)"></div><button class="pubb" id="fadd" type="button" style="flex:none;margin-bottom:2px">+ إضافة</button></div><p class="hint">لو ضفت نكهات، العميل لما يدوس على الصنف بيختار الكمية من كل نكهة. السويتش جنب كل نكهة بيخليها متوفرة أو خلصانة. سيبها فاضية لو الصنف مالوش نكهات.</p><label>لون الكيس</label><div class="sws">' +
      PAL.map(function (x, j) {
        return (
          '<span class="swc' +
          (j == pal ? ' on' : '') +
          '" data-pal="' +
          j +
          '" style="background:' +
          x[1] +
          '"></span>'
        );
      }).join('') +
      '</div><label class="ck"><input type="checkbox" id="fa"' +
      (p[7] ? '' : ' checked') +
      '> متوفر</label><div class="r2"><button class="pubb big" id="eok">حفظ</button>' +
      (i >= 0 ? '<button class="del big" id="edl">حذف</button>' : '') +
      '</div>' +
      (i >= 0
        ? '<button class="pubb" id="edup" type="button" style="width:100%;margin-top:10px;background:var(--blue)">📋 تكرار الصنف (نسخة جديدة أعدّل عليها)</button>'
        : '') +
      '</div>';
    $('ov').classList.add('on');
    renderFl();
    if (i < 0)
      setTimeout(function () {
        var f = $(sp ? 'fp' : 'fn');
        if (f) {
          f.focus();
          if (sp) f.select();
        }
      }, 50);
  }

  function closeEd() {
    $('ov').classList.remove('on');
  }

  function renderFl() {
    var e = $('fl');
    if (!e) return;
    e.innerHTML = fls.length
      ? fls
          .map(function (f, j) {
            return (
              '<div class="cr"><input data-fn="' +
              j +
              '" value="' +
              esc(f[0]) +
              '" placeholder="اسم النكهة"><label class="sw" title="متوفر"><input type="checkbox" data-fa="' +
              j +
              '"' +
              (f[1] ? '' : ' checked') +
              '><i></i></label><button class="del" data-fd="' +
              j +
              '" type="button" aria-label="حذف">🗑</button></div>'
            );
          })
          .join('')
      : '<p class="emp">مفيش نكهات، الصنف هيظهر للعميل بزرار + عادي</p>';
  }

  function addFl() {
    var el = $('fnew');
    el.value.split(/[,،\n]+/).forEach(function (x) {
      x = x.trim();
      if (
        x &&
        !fls.some(function (f) {
          return f[0] == x;
        })
      )
        fls.push([x, 0]);
    });
    el.value = '';
    renderFl();
    el.focus();
  }

  $('ov').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.fn != null && fls[+t.dataset.fn]) fls[+t.dataset.fn][0] = t.value.trim();
    else if (t.dataset.fa != null && fls[+t.dataset.fa]) fls[+t.dataset.fa][1] = t.checked ? 0 : 1;
  });

  $('ov').addEventListener('keydown', function (e) {
    if (e.key == 'Enter' && e.target.id == 'fnew') {
      e.preventDefault();
      addFl();
    }
  });

  $('ov').addEventListener('click', function (e) {
    var t = e.target;
    if (t == this || t.id == 'edx') closeEd();
    else if (t.dataset.pal != null) {
      pal = +t.dataset.pal;
      [].forEach.call(document.querySelectorAll('.swc'), function (s, j) {
        s.classList.toggle('on', j == pal);
      });
    } else if (t.id == 'fadd') {
      addFl();
    } else if (t.dataset.fd != null) {
      fls.splice(+t.dataset.fd, 1);
      renderFl();
    } else if (t.id == 'eok') {
      [].forEach.call(document.querySelectorAll('[data-fn]'), function (el) {
        if (fls[+el.dataset.fn]) fls[+el.dataset.fn][0] = el.value.trim();
      });
      if ($('fnew').value.trim()) addFl();
      var p = [
        $('fn').value.trim(),
        $('fc').value,
        $('fd').value.trim(),
        +$('fp').value || 0,
        PAL[pal][1],
        PAL[pal][2],
        $('fe').value.trim() || '🥔',
        $('fa').checked ? 0 : 1,
        eimg,
      ];
      var fl2 = fls.filter(function (f) {
        return f[0];
      });
      if (fl2.length) p[9] = fl2;
      var vl = $('fv').value.trim(),
        ol = +$('fo').value || 0;
      if (ol && ol <= p[3]) {
        toast('السعر قبل الخصم لازم يكون أكبر من السعر');
        return;
      }
      if (vl) p[10] = vl;
      if (ol) p[11] = ol;
      if (enew) {
        var nid = 'i' + Date.now().toString(36);
        IMG[nid] = enew;
        PEND[nid] = 1;
        p[8] = nid;
      }
      if (!p[0]) {
        toast('اكتب اسم الصنف');
        return;
      }
      if (ei >= 0) D.p[ei] = p;
      else if (dupFrom >= 0 && D.p[dupFrom] && D.p[dupFrom][1] == p[1])
        D.p.splice(dupFrom + 1, 0, p);
      else D.p.push(p);
      dupFrom = -1;
      mark();
      closeEd();
      render();
    } else if (t.id == 'edup' && ei >= 0) {
      openEd(ei, null, true);
    } else if (t.id == 'irm') {
      eimg = '';
      enew = '';
      $('ipv').textContent = $('fe').value.trim() || '🥔';
    } else if (t.id == 'edl') {
      askConfirm('تحذف الصنف ده؟', 'حذف').then(function (ok) {
        if (!ok) return;
        D.p.splice(ei, 1);
        mark();
        closeEd();
        render();
      });
    }
  });

  function shrink(f) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 480 / Math.max(im.width, im.height)),
            c = document.createElement('canvas');
          c.width = Math.round(im.width * k);
          c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.78));
        };
        im.onerror = no;
        im.src = r.result;
      };
      r.onerror = no;
      r.readAsDataURL(f);
    });
  }

  $('ov').addEventListener('change', function (e) {
    if (e.target.id != 'ff' || !e.target.files[0]) return;
    shrink(e.target.files[0])
      .then(function (u) {
        enew = u;
        eimg = '';
        $('ipv').innerHTML = '<img src="' + u + '" alt="">';
      })
      .catch(function () {
        toast('الصورة دي مش شغالة، جرّب غيرها');
      });
  });

  $('app').addEventListener('click', function (e) {
    var t = e.target,
      b;
    if (t.id == 'pub') return pub();
    if (t.id == 'lo') {
      fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
        .catch(function () {})
        .finally(function () {
          dirty = false;
          location.reload();
        });
      return;
    }
    if ((b = t.closest('[data-t]'))) {
      tab = b.dataset.t;
      render();
      if (tab === 'u') loadUsers(true);
      return;
    }
    if (t.id === 'uRefresh') {
      loadUsers(false);
      return;
    }
    if ((b = t.closest('[data-uf]'))) {
      userFilter = b.dataset.uf;
      render();
      return;
    }
    if ((b = t.closest('[data-ua]'))) {
      runUserAction(b.dataset.ua, b.dataset.uid);
      return;
    }
    if (t.dataset.pu != null || t.dataset.pd != null) {
      var up = t.dataset.pu != null,
        i0 = +(up ? t.dataset.pu : t.dataset.pd),
        c0 = D.p[i0][1],
        j0 = i0;
      do {
        j0 += up ? -1 : 1;
      } while (j0 >= 0 && j0 < D.p.length && D.p[j0][1] != c0);
      if (j0 >= 0 && j0 < D.p.length) {
        var x0 = D.p[i0];
        D.p[i0] = D.p[j0];
        D.p[j0] = x0;
        mark();
        render();
      }
      return;
    }
    if (t.dataset.dup != null) {
      openEd(+t.dataset.dup, null, true);
      return;
    }
    if (t.dataset.add != null) {
      openEd(-1, t.dataset.add);
      return;
    }
    if (t.dataset.up != null || t.dataset.dn != null) {
      var i = +(t.dataset.up != null ? t.dataset.up : t.dataset.dn),
        j = t.dataset.up != null ? i - 1 : i + 1;
      if (j >= 0 && j < D.cats.length) {
        var x = D.cats[i];
        D.cats[i] = D.cats[j];
        D.cats[j] = x;
        mark();
        render();
      }
      return;
    }
    if (t.dataset.dc != null) {
      var dcIdx = +t.dataset.dc;
      var c = D.cats[dcIdx],
        n = cnt(c);
      askConfirm('تحذف قسم "' + c + '"' + (n ? ' ومعاه ' + n + ' صنف' : '') + '؟', 'حذف القسم').then(
        function (ok) {
          if (!ok) return;
          D.p = D.p.filter(function (p) {
            return p[1] != c;
          });
          D.cats.splice(dcIdx, 1);
          mark();
          render();
        }
      );
      return;
    }
    if (t.id == 'addc') {
      var v = $('nc').value.trim();
      if (!v) return;
      if (D.cats.indexOf(v) > -1) {
        toast('القسم ده موجود');
        return;
      }
      D.cats.push(v);
      mark();
      render();
      return;
    }
    if (t.closest('.sw')) return;
    if ((b = t.closest('[data-e]'))) openEd(+b.dataset.e);
  });

  $('app').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.av != null) {
      D.p[+t.dataset.av][7] = t.checked ? 0 : 1;
      mark();
      render();
    } else if (t.dataset.rn != null) {
      var i = +t.dataset.rn,
        o = D.cats[i],
        v = t.value.trim();
      if (!v || (v != o && D.cats.indexOf(v) > -1)) {
        toast('الاسم فاضي أو مكرر');
        render();
        return;
      }
      D.p.forEach(function (p) {
        if (p[1] == o) p[1] = v;
      });
      D.cats[i] = v;
      mark();
    } else if (t.dataset.s) {
      var k = t.dataset.s;
      if (k == 'phone') {
        D.cfg.phone = np(t.value);
        render();
      } else if (k == 'min') D.cfg.min = +t.value || 0;
      else if (k == 'gk') D.cfg.gk = t.value.trim();
      else if (
        k == 'ro' ||
        k == 'rm' ||
        k == 'oh' ||
        k == 'hideThemeBtn' ||
        k == 'hideBanner' ||
        k == 'hideSpotlight' ||
        k == 'hideCatsBox'
      )
        D.cfg[k] = t.checked ? 0 : 1;
      else if (k == 'fontUnified') D.cfg.fontUnified = t.checked ? 1 : 0;
      else if (k == 'rn') {
        D.cfg.rn = t.value.trim();
        render();
      } else if (k == 'unit') D.cfg.unit = t.value.trim() || 'كرتونة';
      else D.cfg[k] = t.value.trim();
      mark();
    }
  });

  $('app').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'uq') {
      userQuery = t.value.trim();
      var ul = $('uList');
      if (ul) ul.innerHTML = renderUserCardsHtml();
      return;
    }
    if (t.dataset && t.dataset.n) {
      var v = +t.value;
      D.cfg[t.dataset.n] = v;
      var l = $('nv_' + t.dataset.n);
      if (l) l.textContent = v + (t.dataset.u || '');
      mark();
    }
  });

  $('q').addEventListener('input', function () {
    q = this.value.trim();
    $('v').innerHTML = vp();
  });

  // ===== العروض =====
  var oei = -1;
  function OFS() {
    return D.offers || (D.offers = []);
  }
  function vo() {
    var L = OFS(),
      h =
        '<div class="sh" style="margin-top:14px"><b>🎁 العروض</b><small>' +
        L.length +
        ' عرض</small><button class="mini" data-oadd="1">+ عرض</button></div><p class="hint">العروض بتظهر للعملاء في سلايد فوق الأصناف. رتّبها بالأسهم، والزرار بيخفي العرض من غير ما يتحذف.</p><div style="margin-top:10px">';
    L.forEach(function (o, i) {
      h +=
        '<div class="it' +
        (o.x ? ' off' : '') +
        '" data-o="' +
        i +
        '"><div class="ar"><button data-oup="' +
        i +
        '">▲</button><button data-odn="' +
        i +
        '">▼</button></div><div class="mb" style="background:' +
        (o.c || '#ffd23f') +
        '">' +
        (o.i && IMG[o.i] ? '<img src="' + IMG[o.i] + '" alt="">' : '🎁') +
        '</div><div class="tx"><b>' +
        esc(o.t) +
        '</b><small>' +
        esc(o.d || o.pr || '') +
        '</small></div><label class="sw"><input type="checkbox" data-ov="' +
        i +
        '"' +
        (o.x ? '' : ' checked') +
        '><i></i></label></div>';
    });
    if (!L.length) h += '<p class="emp">مفيش عروض لسه، دوس + عرض</p>';
    return h + '</div>';
  }
  function openOf(i) {
    oei = i;
    var o = i >= 0 ? OFS()[i] : { t: '', d: '', pr: '', g: '', c: PAL[0][1], i: '', x: 0 };
    pal = 0;
    PAL.forEach(function (x, j) {
      if (x[1] == o.c) pal = j;
    });
    eimg = o.i || '';
    enew = '';
    $('ov').innerHTML =
      '<div class="pn"><h2>' +
      (i >= 0 ? 'تعديل عرض' : 'عرض جديد') +
      '<button class="x" id="ofx">✕</button></h2>' +
      '<label>صورة العرض (اختياري)</label><div class="ip"><div class="ipv" id="ipv">' +
      (eimg && IMG[eimg] ? '<img src="' + IMG[eimg] + '" alt="">' : '🎁') +
      '</div><div class="btns"><label class="pubb" style="display:inline-block;cursor:pointer">📷 اختر صورة<input type="file" id="of" accept="image/*" hidden></label><button class="del" id="ofirm" type="button">إزالة الصورة</button></div></div>' +
      '<label>عنوان العرض</label><input id="ot" value="' +
      esc(o.t) +
      '" placeholder="مثال: عرض الشيبسي">' +
      '<label>الوصف</label><input id="od" value="' +
      esc(o.d) +
      '" placeholder="مثال: اشتري ١٠ كراتين وخد كرتونة هدية">' +
      '<div class="r2"><div><label>السعر أو الخصم</label><input id="op" value="' +
      esc(o.pr) +
      '" placeholder="مثال: ١٨٠ جنيه"></div><div><label>شارة</label><input id="og" value="' +
      esc(o.g) +
      '" placeholder="مثال: جديد"></div></div>' +
      '<label>لون الكارت</label><div class="sws">' +
      PAL.map(function (x, j) {
        return (
          '<span class="swc' +
          (j == pal ? ' on' : '') +
          '" data-pal="' +
          j +
          '" style="background:' +
          x[1] +
          '"></span>'
        );
      }).join('') +
      '</div>' +
      '<label class="ck"><input type="checkbox" id="oa"' +
      (o.x ? '' : ' checked') +
      '> ظاهر للعملاء</label>' +
      '<div class="r2"><button class="pubb big" id="ofok">حفظ</button>' +
      (i >= 0 ? '<button class="del big" id="ofdl">حذف</button>' : '') +
      '</div></div>';
    $('ov').classList.add('on');
    if (i < 0)
      setTimeout(function () {
        var ot = $('ot');
        if (ot) ot.focus();
      }, 50);
  }
  $('ov').addEventListener('click', function (e) {
    var t = e.target;
    if (t.id == 'ofx') closeEd();
    else if (t.id == 'ofirm') {
      eimg = '';
      enew = '';
      $('ipv').textContent = '🎁';
    } else if (t.id == 'ofok') {
      var o = {
        t: $('ot').value.trim(),
        d: $('od').value.trim(),
        pr: $('op').value.trim(),
        g: $('og').value.trim(),
        c: PAL[pal][1],
        i: eimg,
        x: $('oa').checked ? 0 : 1,
      };
      if (!o.t) {
        toast('اكتب عنوان العرض');
        return;
      }
      if (enew) {
        var nid = 'i' + Date.now().toString(36);
        IMG[nid] = enew;
        PEND[nid] = 1;
        o.i = nid;
      }
      if (oei >= 0) OFS()[oei] = o;
      else OFS().push(o);
      mark();
      closeEd();
      render();
    } else if (t.id == 'ofdl') {
      askConfirm('تحذف العرض ده؟', 'حذف العرض').then(function (ok) {
        if (!ok) return;
        OFS().splice(oei, 1);
        mark();
        closeEd();
        render();
      });
    }
  });
  $('ov').addEventListener('change', function (e) {
    if (e.target.id != 'of' || !e.target.files[0]) return;
    shrink(e.target.files[0])
      .then(function (u) {
        enew = u;
        eimg = '';
        $('ipv').innerHTML = '<img src="' + u + '" alt="">';
      })
      .catch(function () {
        toast('الصورة دي مش شغالة، جرّب غيرها');
      });
  });
  $('app').addEventListener('click', function (e) {
    var t = e.target,
      b;
    if (t.dataset.oadd != null) {
      openOf(-1);
      return;
    }
    if (t.dataset.oup != null || t.dataset.odn != null) {
      var L = OFS(),
        i = +(t.dataset.oup != null ? t.dataset.oup : t.dataset.odn),
        j = t.dataset.oup != null ? i - 1 : i + 1;
      if (j >= 0 && j < L.length) {
        var x = L[i];
        L[i] = L[j];
        L[j] = x;
        mark();
        render();
      }
      return;
    }
    if (t.closest('.sw')) return;
    if ((b = t.closest('[data-o]'))) openOf(+b.dataset.o);
  });
  $('app').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.ov != null) {
      OFS()[+t.dataset.ov].x = t.checked ? 0 : 1;
      mark();
      render();
    }
  });

  // ===== إضافة ذكية عبر الـ Proxy الآمن أو بقواعد محلية =====
  var SM = [],
    SMT = '';
  function nd(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
      })
      .replace(/[۰-۹]/g, function (d) {
        return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);
      });
  }
  var KW =
    '(?:في|فيه|وفيه|عنده|بسعر|سعره|سعرها|سعر|النكهات|نكهات|الطعوم|طعوم|الطعم|طعم|نكهة|عبوة|العبوة|الحجم|قسم|القسم|بدل|قبل)';
  function sfl(v) {
    var r = [],
      seen = {};
    String(v || '')
      .split(/[,،؛;\n\/|]+/)
      .forEach(function (x) {
        x.split(/\s+و\s+/).forEach(function (y) {
          y = y.trim().replace(/[.\u061B]+$/, '');
          if (y && !seen[y]) {
            seen[y] = 1;
            r.push(y);
          }
        });
      });
    return r;
  }
  function mc(cn) {
    if (D.cats.indexOf(cn) > -1) return cn;
    var f = D.cats.filter(function (c) {
      return c.indexOf(cn) > -1 || cn.indexOf(c) > -1;
    });
    return f.length ? f[0] : snap(cn, D.cats);
  }
  function lpb(s) {
    var o = { n: '', c: '', d: '', p: 0, o: 0, v: '', e: '', f: [], on: 1 },
      m;
    s = s.replace(/^(?:انا |أنا )?(?:عندي|ضيف|أضف|اضف|اضافة|إضافة)\s+/, '');
    if ((m = s.match(/(?:بدل|قبل الخصم|السعر القديم|كان بـ?)\s*:?\s*(\d+(?:\.\d+)?)/))) {
      o.o = +m[1];
      s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/(?:^|\s)(?:بسعر|السعر|سعره|سعرها|سعر|بـ|ب)\s*:?\s*(\d+(?:\.\d+)?)/))) {
      o.p = +m[1];
      s = s.replace(m[0], ' ');
    } else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|جنية|ج|egp)(?=[\s,،]|$)/i))) {
      o.p = +m[1];
      s = s.replace(m[0], ' ');
    }
    s = s
      .replace(/\s(?:جنيه|جنية|ج)(?=[\s,،]|$)/g, ' ')
      .replace(/\d+\s*(?:طعم|نكهة|نكهات|اطعمة|أطعمة|طعوم)(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      (m = s.match(
        new RegExp(
          '(?:النكهات|نكهات|الطعوم|طعوم|الأطعمة|الاطعمة|الطعم|طعم|نكهة)\\s*(?:هي|هم|كالتالي)?\\s*:?\\s*(.+?)(?=\\s+(?:القسم|قسم|في قسم|عبوة|العبوة|الحجم|النوع|كرتونة|كرتونه|دستة|شوال|باكو)(?:\\s|:|$)|$)'
        )
      ))
    ) {
      o.f = sfl(/[,،؛;\/|\n]/.test(m[1]) ? m[1] : m[1].replace(/\s+و(?=\S)/g, '،'));
      s = s.replace(m[0], ' ');
    }
    if (
      (m = s.match(
        new RegExp(
          '(?:في\\s+)?(?:القسم|قسم)\\s*:?\\s*(.+?)(?=\\s+(?:عبوة|العبوة|الحجم|النوع)(?:\\s|:|$)|[,،]|$)'
        )
      ))
    ) {
      o.c = mc(m[1].trim());
      s = s.replace(m[0], ' ');
    } else {
      var cf = D.cats.filter(function (c) {
        return s.indexOf(c) > -1;
      });
      if (cf.length == 1) o.c = cf[0];
    }
    if (
      (m = s.match(
        /(?:العبوة|عبوة|الحجم|الوصف)\s*:?\s*(.+?)(?=\s+(?:قسم|القسم|الطعم|طعم|نكهات|النكهات)(?:\s|:|$)|[,،]|$)/
      ))
    ) {
      o.d = m[1].trim();
      s = s.replace(m[0], ' ');
    } else if (
      (m = s.match(/(?:كرتونة|كرتونه|دستة|شوال|علبة|باكو)\s*\d*\s*(?:كيس|علبة|قطعة|حبة|باكو|زجاجة)?/))
    ) {
      o.d = m[0].trim();
      s = s.replace(m[0], ' ');
    }
    s = s.replace(/\s+/g, ' ').trim();
    for (var i = 0; i < 2; i++)
      s = s.replace(/^(?:الصنف|صنف|اسم الصنف|اسمه|اسمها|اسم)\s*(?:هو|هي)?\s*:?\s*/, '');
    var cut = s.search(new RegExp('\\s+' + KW + '(?:\\s|:|$)|[,،:\\n]'));
    o.n = (cut > 0 ? s.slice(0, cut) : s).trim();
    return o.n ? o : null;
  }
  function lp(text) {
    var t = nd(text).replace(/\r/g, ''),
      bl = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n'),
      out = [];
    bl.forEach(function (b) {
      b = b.replace(/\s+/g, ' ').trim();
      if (b.length < 2) return;
      var r = lpb(b);
      if (r) out.push(r);
    });
    return out;
  }
  function nz(x) {
    return {
      n: String(x.name || '').trim(),
      c: String(x.category || '').trim(),
      d: String(x.pack || '').trim(),
      p: +x.price || 0,
      o: +x.oldPrice || 0,
      v: String(x.variant || '').trim(),
      e: String(x.emoji || '').trim(),
      f: sfl(
        (x.flavors || [])
          .map(function (f) {
            return String(f).trim();
          })
          .join('،')
      ),
      on: 1,
    };
  }
  function an(s) {
    return nd(s)
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\u0621-\u064Aa-zA-Z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function lev(a, b) {
    if (a == b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    var p = [],
      q,
      i,
      j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      q = [i];
      for (j = 1; j <= b.length; j++)
        q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
      p = q;
    }
    return p[b.length];
  }
  function snap(v, pool) {
    var a = an(v);
    if (!a) return v;
    var best = null,
      bd = 9,
      i,
      b,
      d;
    for (i = 0; i < pool.length; i++) {
      b = an(pool[i]);
      if (b == a) return pool[i];
      if (a.length >= 5 && b.length >= 5) {
        d = lev(a, b);
        if (d < bd) {
          bd = d;
          best = pool[i];
        }
      }
    }
    return bd <= 1 ? best : v;
  }
  function nums(s) {
    return (nd(s).match(/\d+(?:\.\d+)?/g) || []).map(Number).sort(function (a, b) {
      return a - b;
    });
  }
  function nsame(a, b) {
    var x = nums(a),
      y = nums(b);
    return (
      x.length == y.length &&
      x.every(function (v, i) {
        return v == y[i];
      })
    );
  }
  function fixList(list, tx) {
    var T = an(tx),
      N = nums(tx),
      names = [],
      fl = [],
      m = {},
      out = [];
    D.p.forEach(function (p) {
      if (p[0] && names.indexOf(p[0]) < 0) names.push(p[0]);
      (p[9] || []).forEach(function (f) {
        var n = Array.isArray(f) ? f[0] : f;
        if (n && fl.indexOf(n) < 0) fl.push(n);
      });
    });
    list.forEach(function (o) {
      o.w = [];
      var n0 = o.n.trim();
      o.n = snap(n0, names);
      if (o.n != n0) o.w.push('✏️ الاسم اتظبط: ' + n0 + ' ← ' + o.n);
      var seen = {},
        fs = [];
      o.f.forEach(function (f) {
        var g = snap(
            String(f)
              .replace(/^(?:طعم|نكهة|نكهه)\s+/, '')
              .trim(),
            fl
          ),
          k = an(g);
        if (!k || seen[k]) return;
        seen[k] = 1;
        fs.push(g);
      });
      o.f = fs;
      var k2 = an(o.n) + '|' + an(o.v),
        g2 = m[k2];
      if (g2 && (!o.p || !g2.p || o.p == g2.p)) {
        var sn = {};
        g2.f.forEach(function (f) {
          sn[an(f)] = 1;
        });
        o.f.forEach(function (f) {
          if (!sn[an(f)]) g2.f.push(f);
        });
        g2.p = g2.p || o.p;
        g2.o = g2.o || o.o;
        g2.d = g2.d || o.d;
        g2.e = g2.e || o.e;
        g2.w.push('اتدمج أكتر من سطر لنفس الصنف');
        return;
      }
      m[k2] = o;
      out.push(o);
    });
    out.forEach(function (o) {
      var miss = o.f.filter(function (f) {
        var k = an(f);
        return (
          T.indexOf(k) < 0 &&
          !k.split(' ').some(function (w) {
            return w.length > 2 && T.indexOf(w) > -1;
          })
        );
      });
      if (miss.length) o.w.push('نكهات مش واضحة في الكلام: ' + miss.join('، '));
      if (!(o.p > 0)) o.w.push('مفيش سعر، اكتبه');
      else if (N.indexOf(o.p) < 0)
        o.w.push('السعر ' + o.p + ' مش مكتوب بالأرقام في الكلام، تأكد منه');
      if (o.o && o.p && o.o <= o.p) o.w.push('السعر القديم مش أكبر من الجديد، هيتتجاهل');
      if (
        o.n &&
        T.indexOf(an(o.n)) < 0 &&
        !an(o.n)
          .split(' ')
          .some(function (w) {
            return w.length > 2 && T.indexOf(w) > -1;
          })
      )
        o.w.push('اسم الصنف مش مكتوب كده في الكلام، راجعه');
    });
    return out;
  }
  function aiPrompt(text) {
    return (
      'أنت مساعد لإدخال بيانات أصناف متجر جملة. حوّل النص التالي إلى JSON فقط (من غير أي كلام تاني) بالشكل: {"products":[{"name":"","category":"","pack":"","price":0,"oldPrice":0,"variant":"","emoji":"","flavors":[""]}]}\nالقواعد:\n- name هو اسم الصنف فقط.\n- category لازم يكون واحد من الأقسام الحالية بالظبط لو مناسب، وإلا اقترح اسم قسم قصير. الأقسام الحالية: ' +
      JSON.stringify(D.cats) +
      '\n- pack العبوة أو الوصف (مثال: كرتونة ٤٨ كيس) وسيبه فاضي لو مش مذكور.\n- price رقم بالجنيه بالأرقام الإنجليزية، و oldPrice السعر قبل الخصم أو 0.\n- لو الصنف له أكتر من حجم أو نوع بأسعار مختلفة اعمل عنصر منفصل لكل واحد بنفس الاسم وحط الحجم أو النوع في variant.\n- flavors كل النكهات المذكورة بأسمائها بالظبط، ماتخترعش نكهات مش مذكورة، وسيبها [] لو مفيش.\n- emoji إيموجي واحد مناسب للصنف.\n- مهم: لو الكلام عن صنف واحد وبعده أكتر من طعم أو نكهة مفصولين بـ «و» أو فاصلة (زي «دوريتوس عنده طعم جبنة وكباب وملح وشطة») فده صنف واحد بس، وحط كل الطعوم في flavors بتاعته، وماتعملش عنصر لكل طعم.\n- لو في أكتر من صنف في النص اعمل عنصر لكل صنف.\n- انسخ الأسعار والأرقام زي ما هي في النص بالظبط من غير حساب أو تقريب، ولو السعر مش واضح خلّي price 0.\n- صحّح الإملاء بس في اسم الصنف والنكهات (زي ه/ة وأ/ا) من غير ما تبدّل الكلمة بكلمة تانية أو تضيف حاجة.\nمثال: النص «شيبسي كرتونة ٢٤ كيس بسعر ٢٦٠ جنيه في قسم شيبسي عنده طعم ملح وخل وشطة» يرجع: {"products":[{"name":"شيبسي","category":"شيبسي","pack":"كرتونة 24 كيس","price":260,"oldPrice":0,"variant":"","emoji":"🥔","flavors":["ملح","خل","شطة"]}]}\nالنص:\n' +
      text
    );
  }

  async function askGemini(key, prompt) {
    var pref = '';
    try {
      pref = localStorage.getItem('abu_gm') || '';
    } catch {}
    var res = await fetch('/api/admin/ai/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        apiKey: key || undefined,
        preferredModel: pref,
      }),
    });
    if (res.status === 401) {
      handleAdminUnauthorized();
      throw new Error('UNAUTH');
    }
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'NOMODEL');
    if (data.model) {
      try {
        localStorage.setItem('abu_gm', data.model);
      } catch {}
    }
    return data.text || '';
  }

  var VSR = window.SpeechRecognition || window.webkitSpeechRecognition,
    VR = null,
    VON = false,
    VPOL = false,
    VERR = 0;
  function vfix(s) {
    return nd(s)
      .replace(/\s*(?:سطر جديد|سطر تاني|سطر تانيه|السطر الجديد|صنف جديد|صنف تاني|صنف تانيه)\s*/g, '\n')
      .replace(/\s*(?:فاصلة|فاصله)\s*/g, '، ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ *\n */g, '\n');
  }
  var VWL = null;
  function vUI(on) {
    var b = $('smmic'),
      l = $('smvl');
    if (b) b.classList.toggle('rec', on);
    if (l) l.textContent = on ? 'بسمعك... دوس للإيقاف' : 'اكتب بالصوت';
    try {
      if (on) {
        if (navigator.wakeLock && !VWL)
          navigator.wakeLock
            .request('screen')
            .then(function (x) {
              VWL = x;
              x.addEventListener('release', function () {
                VWL = null;
              });
            })
            .catch(function () {});
      } else if (VWL) {
        VWL.release();
        VWL = null;
      }
    } catch {}
  }
  function vRun() {
    var ta = $('smt');
    if (!VON || !ta) return;
    var base = ta.value;
    if (base && !/\s$/.test(base)) base += ' ';
    var r = new VSR();
    VR = r;
    r.lang = 'ar-EG';
    r.interimResults = true;
    r.continuous = true;
    r.onresult = function (e) {
      VERR = 0;
      var t2 = $('smt');
      if (!t2) return;
      var fin = [],
        im = '';
      for (var i = 0; i < e.results.length; i++) {
        var rr = e.results[i],
          t = rr[0].transcript.trim();
        if (!t) continue;
        if (rr.isFinal) {
          var lf = fin.length ? fin[fin.length - 1] : '';
          if (lf && t.indexOf(lf) > -1) fin[fin.length - 1] = t;
          else if (lf && lf.indexOf(t) > -1) {
          } else fin.push(t);
        } else im = t;
      }
      var lf2 = fin.length ? fin[fin.length - 1] : '';
      if (lf2 && im.indexOf(lf2) == 0) im = im.slice(lf2.length).trim();
      else if (lf2 && im.length > 3 && lf2.indexOf(im) > -1) im = '';
      t2.value = base + vfix(fin.join(' ') + (im ? ' ' + im : ''));
      t2.scrollTop = t2.scrollHeight;
      SMT = t2.value;
    };
    r.onerror = function (e) {
      if (e.error == 'not-allowed' || e.error == 'service-not-allowed') {
        VON = false;
        toast('اسمح للمايك من إعدادات المتصفح');
      } else if (e.error == 'network' || e.error == 'audio-capture') VERR++;
    };
    r.onend = function () {
      if (VR === r) VR = null;
      if (VON) {
        if (VERR > 20) {
          VON = false;
          vUI(false);
          toast('فيه مشكلة في الاتصال أو المايك، الكتابة بالصوت وقفت');
          return;
        }
        setTimeout(vRun, VERR ? 600 : 120);
        return;
      }
      vUI(false);
      if (VPOL) {
        VPOL = false;
        vPolish();
      }
    };
    try {
      r.start();
    } catch {
      VR = null;
      if (VON) {
        VERR++;
        if (VERR > 20) {
          VON = false;
          vUI(false);
        } else setTimeout(vRun, 400);
      }
    }
  }
  var VENG = '',
    VST = null,
    VSID = 0,
    VSL = [],
    VPEND = 0,
    VBASE = '',
    VAIERR = 0;
  function vBeep(ac) {
    try {
      var o = ac.createOscillator(),
        g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.14);
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.16);
    } catch {}
  }
  function vWav(f, sr) {
    var ra = sr / 16000,
      n = Math.floor(f.length / ra),
      buf = new ArrayBuffer(44 + n * 2),
      v = new DataView(buf),
      i,
      j;
    function ws(o, t) {
      for (var q = 0; q < t.length; q++) v.setUint8(o + q, t.charCodeAt(q));
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
    for (i = 0; i < n; i++) {
      var a = 0,
        c = 0,
        st = Math.floor(i * ra),
        en = Math.min(f.length, Math.floor((i + 1) * ra));
      for (j = st; j < en; j++) {
        a += f[j];
        c++;
      }
      var x = c ? a / c : 0;
      x = Math.max(-1, Math.min(1, x));
      v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
    }
    var u = new Uint8Array(buf),
      b = '',
      k;
    for (k = 0; k < u.length; k += 8192) b += String.fromCharCode.apply(null, u.subarray(k, k + 8192));
    return btoa(b);
  }
  async function gAud(key, b64) {
    var nm = D.p
        .slice(0, 100)
        .map(function (p) {
          return p[0];
        })
        .filter(Boolean),
      pr =
        'اكتب بالظبط الكلام المنطوق في المقطع الصوتي ده (بالعامية المصرية، وموضوعه أصناف ونكهات وأسعار متجر جملة) بإملاء صحيح. الأرقام بالإنجليزية. ماتضيفش أي شرح أو علامات اقتباس ولا تترجم. لو مفيش كلام مفهوم ارجع نص فاضي. أسماء أصناف موجودة للاسترشاد في الإملاء: ' +
        JSON.stringify(nm) +
        ' والأقسام: ' +
        JSON.stringify(D.cats);
    var pref = '';
    try {
      pref = localStorage.getItem('abu_gm') || '';
    } catch {}
    var res = await fetch('/api/admin/ai/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: pr,
        audioBase64: b64,
        apiKey: key || undefined,
        preferredModel: pref,
      }),
    });
    if (res.status === 401) {
      handleAdminUnauthorized();
      throw new Error('UNAUTH');
    }
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'NOMODEL');
    if (data.model) {
      try {
        localStorage.setItem('abu_gm', data.model);
      } catch {}
    }
    return String(data.text || '')
      .trim()
      .replace(/^["«»“”]+|["«»“”]+$/g, '')
      .trim();
  }
  function vAIrender() {
    var t = $('smt');
    if (!t) return;
    t.value =
      VBASE +
      vfix(
        VSL.map(function (x) {
          return x == null ? '…' : x;
        })
          .filter(function (x) {
            return x !== '';
          })
          .join(' ')
      );
    t.scrollTop = t.scrollHeight;
    SMT = t.value;
  }
  function vAIfail(err) {
    var m = err && err.message;
    VAIERR++;
    if (m == 'KEY' || m == 'LIMIT' || m == 'NOMODEL' || VAIERR >= 3) {
      if (VST && !VST.stopping) {
        var was = VON;
        vRelease();
        VENG = 'sr';
        toast(
          m == 'LIMIT'
            ? 'حصة الذكاء الاصطناعي خلصت، هكمل بتعرف المتصفح'
            : m == 'KEY'
            ? 'الـ API مش مظبوط، هكمل بتعرف المتصفح'
            : 'الذكاء الاصطناعي مش متاح دلوقتي، هكمل بتعرف المتصفح'
        );
        if (was && VSR) {
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
    var s = VST;
    VST = null;
    if (!s) return;
    try {
      s.pr.onaudioprocess = null;
      s.pr.disconnect();
    } catch {}
    try {
      s.src.disconnect();
    } catch {}
    try {
      s.stream.getTracks().forEach(function (t) {
        t.stop();
      });
    } catch {}
    try {
      s.ac.close();
    } catch {}
  }
  function vSend(f, sr, key, sid) {
    var idx = VSL.length;
    VSL.push(null);
    VPEND++;
    vAIrender();
    var b64;
    try {
      b64 = vWav(f, sr);
    } catch {
      VSL[idx] = '';
      VPEND--;
      return;
    }
    gAud(key, b64)
      .then(function (t) {
        if (sid != VSID) return;
        VSL[idx] = t;
        VAIERR = 0;
      })
      .catch(function (e) {
        if (sid != VSID) return;
        VSL[idx] = '';
        vAIfail(e);
      })
      .then(function () {
        VPEND--;
        if (sid == VSID) vAIrender();
      });
  }
  async function vAI(key) {
    var sid = ++VSID,
      ta = $('smt');
    if (!ta) return;
    VBASE = ta.value;
    if (VBASE && !/\s$/.test(VBASE)) VBASE += ' ';
    VSL = [];
    VPEND = 0;
    VAIERR = 0;
    try {
      var AC = window.AudioContext || window.webkitAudioContext,
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }),
        ac = new AC();
      if (ac.state == 'suspended') await ac.resume();
      if (sid != VSID || !VON) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        try {
          ac.close();
        } catch {}
        return;
      }
      vBeep(ac);
      var src = ac.createMediaStreamSource(stream),
        pr = ac.createScriptProcessor(4096, 1, 1),
        sr = ac.sampleRate,
        S = {
          ac: ac,
          src: src,
          pr: pr,
          stream: stream,
          seg: [],
          pre: [],
          len: 0,
          speaking: false,
          silent: 0,
          noise: 0.004,
          t0: ac.currentTime + 0.3,
          stopping: false,
          key: key,
          sid: sid,
          sr: sr,
        };
      VST = S;
      S.flush = function () {
        var tot = S.len,
          sp = S.speaking;
        var arr = S.seg;
        S.seg = [];
        S.len = 0;
        S.speaking = false;
        S.silent = 0;
        if (!sp || tot < sr * 0.4) return;
        var f = new Float32Array(tot),
          o = 0;
        arr.forEach(function (c) {
          f.set(c, o);
          o += c.length;
        });
        vSend(f, sr, key, sid);
      };
      pr.onaudioprocess = function (e) {
        if (!VST || VST !== S || S.stopping) return;
        if (ac.currentTime < S.t0) return;
        var d = e.inputBuffer.getChannelData(0),
          c = new Float32Array(d.length);
        c.set(d);
        var sum = 0,
          i;
        for (i = 0; i < c.length; i++) sum += c[i] * c[i];
        var rms = Math.sqrt(sum / c.length),
          thr = Math.max(0.012, S.noise * 3);
        if (rms > thr) {
          if (!S.speaking) {
            S.speaking = true;
            S.seg = S.pre.slice();
            S.len = 0;
            S.seg.forEach(function (x) {
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
      toast(
        x && (x.name == 'NotAllowedError' || x.name == 'SecurityError')
          ? 'اسمح للمايك من إعدادات المتصفح'
          : 'مقدرتش أشغّل المايك'
      );
    }
  }
  function vStopAI(graceful) {
    var S = VST;
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
    var sid = S.sid,
      n = 0,
      iv = setInterval(function () {
        n++;
        if (VPEND <= 0 || n > 200 || sid != VSID) {
          clearInterval(iv);
          if (sid == VSID) vAIrender();
          vUI(false);
        }
      }, 100);
  }
  function vStart() {
    if (VON || VR || VST) return;
    var ke = $('smk'),
      key = ke ? ke.value.trim() : '',
      AC = window.AudioContext || window.webkitAudioContext,
      canAI =
        (key || (D.cfg && D.cfg.gk)) &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        AC &&
        window.btoa;
    if (!canAI && !VSR) {
      toast('المتصفح ده مش بيدعم الكتابة بالصوت، جرّب Chrome');
      return;
    }
    VON = true;
    VPOL = false;
    VERR = 0;
    vUI(true);
    if (canAI) {
      VENG = 'ai';
      vAI(key);
    } else {
      VENG = 'sr';
      vRun();
    }
  }
  function vStop(polish) {
    if (VENG == 'ai' && (VST || VON)) {
      vStopAI(!!polish);
      return;
    }
    if (!polish) VSID++;
    var was = VON || !!VR;
    VON = false;
    if (VR) {
      VPOL = !!polish;
      try {
        VR.stop();
      } catch {
        VR = null;
        vUI(false);
        if (polish) vPolish();
      }
    } else {
      vUI(false);
      if (polish && was) vPolish();
    }
  }
  async function vPolish() {
    var ta = $('smt'),
      ke = $('smk'),
      er = $('sme');
    if (!ta) return;
    var tx = ta.value.trim();
    if (!tx) return;
    SMT = ta.value;
    var key = ke ? ke.value.trim() : '';
    if (!key && !(D.cfg && D.cfg.gk)) return;
    if (er) {
      er.style.color = 'var(--mu)';
      er.textContent = '✨ بظبط الكتابة...';
    }
    try {
      var names = D.p
          .slice(0, 150)
          .map(function (p) {
            return p[0];
          })
          .filter(Boolean),
        pr =
          'ده نص اتكتب بالإملاء الصوتي (بالعامية المصرية) لوصف أصناف متجر جملة. صحّح الأخطاء الإملائية وأخطاء التعرف على الصوت وحط علامات الترقيم الصح، من غير ما تغيّر المعنى. القواعد:\n- ماتغيّرش أي رقم أو سعر أو كمية، وحوّل الأرقام العربية لأرقام إنجليزية.\n- ماتضيفش ولا تحذف أصناف أو نكهات أو معلومات.\n- ماتقسمش الصنف الواحد: لو ذكر صنف واحد وله أكتر من طعم أو نكهة (زي «دوريتوس عنده طعم جبنة وكباب وملح وشطة») سيبه في سطر واحد وماتكررش اسم الصنف مع كل طعم. السطر الجديد بس لصنف تاني مختلف.\n- ماتزودش عدد الأسطر عن اللي في النص الأصلي.\n- اكتب أسماء الأصناف والنكهات بشكلها الصح، وده أسماء أصناف موجودة عندنا للاسترشاد: ' +
          JSON.stringify(names) +
          '\n- الأقسام الموجودة: ' +
          JSON.stringify(D.cats) +
          '\nأرجع JSON فقط بالشكل {"text":""}\nالنص:\n' +
          tx;
      var raw = await askGemini(key, pr),
        j = JSON.parse(raw.replace(/```json|```/g, '').trim()),
        out = String(j.text || '').trim();
      var ta2 = $('smt');
      var nl = function (x) {
        return x.split(/\n+/).filter(function (l) {
          return l.trim();
        }).length;
      };
      if (
        ta2 &&
        out &&
        out.length > tx.length * 0.5 &&
        out.length < tx.length * 2 &&
        nl(out) <= nl(tx) &&
        ta2.value.trim() == tx &&
        nsame(out, tx)
      ) {
        ta2.value = out;
        SMT = out;
      }
      var e2 = $('sme');
      if (e2) {
        e2.style.color = 'var(--mu)';
        e2.textContent = '✅ الكتابة اتظبطت';
      }
    } catch {
      var e3 = $('sme');
      if (e3) {
        e3.style.color = '';
        e3.textContent = '';
      }
    }
  }
  $('ov').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#smmic');
    if (b) {
      if (VON || VR || VST) vStop(true);
      else if (!(VENG == 'ai' && b.classList.contains('rec'))) vStart();
      return;
    }
    if (e.target.id == 'smx') vStop(false);
  });
  function smIn(t) {
    vStop(false);
    CHF = false;
    var k = (D.cfg && D.cfg.gk) || '';
    $('ov').innerHTML =
      '<div class="pn"><h2>' +
      esc(AN()) +
      '<button class="x" id="smx">✕</button></h2><p class="hint">اكتب أو الصق وصف الأصناف زي ما تتكلم، وتقدر تكتب أكتر من صنف. هتراجع النتيجة قبل ما تتضاف.</p><label>وصف الأصناف</label><textarea id="smt" rows="6" placeholder="مثال: شيبسي كبير عنده 15 طعم: ملح، طماطم، شطة، جبنة، خل... كرتونة 24 كيس بسعر 260 جنيه في قسم شيبسي">' +
      esc(t) +
      '</textarea><button class="vmic" id="smmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="smvl">اكتب بالصوت</span></button><p class="hint">تقدر تقول «سطر جديد» عشان تبدأ صنف تاني، و«فاصلة» لو عايز فاصلة.</p><label>API (اختياري — يستخدم مفتاح المتجر تلقائياً)</label><input id="smk" type="password" autocomplete="off" dir="ltr" value="' +
      esc(k) +
      '"><div class="r2"><button class="pubb big" id="smai">🤖 حلّل بالذكاء الاصطناعي</button></div><button class="mini" id="smlp" style="width:100%;margin-top:10px;padding:8px">⚡ حلّل بدون ذكاء اصطناعي (سطر لكل صنف)</button><div class="err" id="sme"></div></div>';
    $('ov').classList.add('on');
  }
  function smOpen() {
    SM = [];
    smIn(SMT);
  }

  var CH = { msgs: [], draft: [], busy: 0 },
    CHF = false;
  function chReset() {
    CH.msgs = [];
    CH.draft = [];
    CH.busy = 0;
    CH.pend = null;
    CH.undo = null;
  }
  function chKey() {
    return (D.cfg && D.cfg.gk) || '';
  }
  function chOpen() {
    vStop(false);
    CHF = true;
    var k = chKey();
    $('ov').innerHTML =
      '<div class="pn" id="chp" style="display:flex;flex-direction:column;height:92%;max-height:92%;overflow:hidden">' +
      '<h2>💬 ' +
      esc(AN()) +
      '<button class="x" id="smx">✕</button></h2>' +
      '<div id="chm" class="chm"></div><div id="chd"></div>' +
      '<input id="smk" type="' +
      (k ? 'hidden' : 'password') +
      '" autocomplete="off" dir="ltr" placeholder="مفتاح Gemini (اختياري إذا كان محفوظاً بالإعدادات)" value="' +
      esc(k) +
      '" style="margin-top:8px">' +
      '<button class="vmic sm" id="smmic" type="button"><span class="vb"><i></i><i></i><i></i><i></i><i></i></span><span id="smvl">اكتب بالصوت</span></button>' +
      '<div class="r2" style="align-items:stretch"><div><textarea id="smt" rows="2" style="resize:none" placeholder="اكتب هنا..."></textarea></div><button class="pubb" id="chsend" type="button" style="flex:none;padding:0 16px">إرسال</button></div>' +
      '<div class="err" id="sme" style="min-height:0"></div>' +
      '<button class="mini" id="chold" type="button" style="align-self:flex-start;margin-top:4px">✍️ الإضافة القديمة (وصف مرة واحدة)</button></div>';
    $('ov').classList.add('on');
    chRender();
  }
  function chRender() {
    var m = $('chm');
    if (!m) return;
    var h = '';
    if (!CH.msgs.length)
      h =
        '<div class="cm a">أهلًا 👋 قولّي عايز تضيف إيه، وأنا هسألك عن الناقص (السعر والأحجام والنكهات)، وبعدها تراجع وتضيف.<br><small>مثال: «ضيف دوريتوس صغير بـ ٥ جنيه ووسط بـ ١٠»</small><br><small>أو عدّل: «زوّد كل الشيبسي ٥ جنيه» · «اقفل أصناف دوريتوس» · «خصم ١٠٪ على المشروبات»</small></div>';
    CH.msgs.forEach(function (x) {
      h += '<div class="cm ' + x.r + '">' + esc(x.t) + '</div>';
    });
    if (CH.busy) h += '<div class="cm a">⏳ بفكّر...</div>';
    m.innerHTML = h;
    m.scrollTop = m.scrollHeight;
    var d = $('chd');
    if (!d) return;
    var L = CH.draft;
    d.innerHTML =
      (L.length
        ? '<div class="card2" style="margin:8px 0 0;padding:8px 10px"><b>📝 المسودة (' +
          L.length +
          ')</b><div class="hint">' +
          L.map(function (o) {
            return (
              esc(o.n + (o.v ? ' · ' + o.v : '')) +
              ' — ' +
              (o.p > 0 ? o.p + ' جنيه' : '⚠️ من غير سعر') +
              (o.f.length ? ' — ' + o.f.length + ' نكهة' : '')
            );
          }).join('<br>') +
          '</div><div class="r2"><button class="pubb big" id="chrv" type="button" style="margin-top:8px;padding:8px">✅ راجع وأضف</button><button class="del big" id="chnw" type="button" style="margin-top:8px;padding:8px;flex:none">مسح</button></div></div>'
        : '') + chEdCard();
  }
  function chPrompt() {
    var names = [];
    D.p.forEach(function (p) {
      if (p[0] && names.indexOf(p[0]) < 0) names.push(p[0]);
    });
    var dr = CH.draft.map(function (o) {
      return {
        name: o.n,
        category: o.c,
        pack: o.d,
        price: o.p,
        oldPrice: o.o,
        variant: o.v,
        emoji: o.e,
        flavors: o.f,
      };
    });
    var tr = CH.msgs
      .slice(-14)
      .map(function (x) {
        return (x.r == 'u' ? 'التاجر: ' : 'المساعد: ') + x.t;
      })
      .join('\n');
    return (
      'أنت مساعد بيتكلم مع تاجر جملة مصري بالعامية المصرية، ومهمتك تساعده يضيف أصناف جديدة لمتجره، أو يعدّل أي حاجة موجودة (أسعار، أصناف، أقسام، عروض، إعدادات) بالمحادثة. ردودك قصيرة وودودة (سطرين بالكتير) وبتسأل سؤال واحد بس في المرة.\n' +
      'ارجع JSON فقط (من غير أي كلام برّاه) بالشكل: {"reply":"","products":[{"name":"","category":"","pack":"","price":0,"oldPrice":0,"variant":"","emoji":"","flavors":[""]}],"ops":[],"action":"none"}\n' +
      'القواعد:\n' +
      '- products هي المسودة الكاملة الحالية في كل رد: ابدأ من المسودة الحالية، طبّق عليها آخر كلام التاجر (إضافة أو تعديل)، وارجعها كلها. ماتشيلش صنف غير لو التاجر طلب ده صراحة.\n' +
      '- ماتخترعش أسعار ولا نكهات ولا عبوات: اكتب بس اللي التاجر قاله بالظبط. السعر يفضل 0 لحد ما التاجر يقوله. انسخ الأرقام زي ما هي من غير حساب.\n' +
      '- لو الصنف له أكتر من حجم أو نوع بأسعار مختلفة اعمل عنصر منفصل لكل واحد بنفس الاسم وحط الحجم أو النوع في variant.\n' +
      '- لو صنف واحد له كذا نكهة (مفصولين بـ «و» أو فاصلة) فده صنف واحد وحط كل النكهات في flavors بتاعته.\n' +
      '- category لازم يكون واحد من الأقسام الحالية بالظبط لو مناسب، وإلا اقترح اسم قسم قصير. الأقسام الحالية: ' +
      JSON.stringify(D.cats) +
      '\n' +
      '- emoji إيموجي واحد مناسب للصنف. صحّح الإملاء بس في الاسم والنكهات من غير ما تبدّل الكلمة بكلمة تانية.\n' +
      '- اسأل عن الناقص بالترتيب: السعر الأول (لازم)، بعدين القسم لو مش واضح، وبعدين العبوة والنكهات مرة واحدة بس (مثلًا «فيه نكهات؟ والكرتونة كام كيس؟»). لو التاجر قال مفيش أو تجاهلهم سيبهم فاضيين وماتسألش عنهم تاني.\n' +
      '- لو الصنف شبه صنف موجود عند التاجر نبّهه في reply. الأصناف الموجودة عنده: ' +
      JSON.stringify(names.slice(0, 120)) +
      '\n' +
      '- لما كل صنف في المسودة يبقى له اسم وسعر وقسم، لخّصهم في reply في جملة واسأله «أضيفهم؟».\n' +
      '- action تبقى "review" بس لو التاجر وافق صراحة (قال أيوه أو ضيف أو تمام أو يلا) والمسودة كلها جاهزة، غير كده تبقى "none".\n' +
      '- لو التاجر سأل في حاجة بعيدة عن إضافة الأصناف رد بجملة قصيرة وارجّعه للموضوع، وارجع المسودة زي ما هي.\n' +
      edRules() +
      'المسودة الحالية: ' +
      JSON.stringify(dr) +
      '\nالمحادثة:\n' +
      tr
    );
  }

  // ===== تعديل شامل بالذكاء الاصطناعي =====
  function nr(s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, function (d) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
      })
      .toLowerCase()
      .trim();
  }
  function nn(v) {
    if (v == null || v === '') return null;
    v = parseFloat(nr(v));
    return isFinite(v) ? v : null;
  }
  function ar(v) {
    return v == null ? [] : [].concat(v);
  }
  function sv(b, i, v) {
    if (v || b.length > i) b[i] = v;
  }
  function pl(p) {
    return p[0] + (p[10] ? ' · ' + p[10] : '');
  }
  function catEx(X, n) {
    var k = nr(n);
    if (!k) return null;
    for (var i = 0; i < X.cats.length; i++) if (nr(X.cats[i]) == k) return X.cats[i];
    return null;
  }
  function catOf(X, n) {
    var c = catEx(X, n);
    if (c) return c;
    var k = nr(n);
    if (!k) return null;
    for (var i = 0; i < X.cats.length; i++) {
      var x = nr(X.cats[i]);
      if (x.indexOf(k) > -1 || k.indexOf(x) > -1) return X.cats[i];
    }
    return null;
  }
  function edMatch(X, p, w) {
    if (!w || typeof w != 'object') return false;
    var any = 0,
      ok = 1,
      t;
    var nm = ar(w.name).map(nr).filter(Boolean);
    if (nm.length) {
      any = 1;
      var n = nr(p[0]);
      if (
        !nm.some(function (x) {
          return n.indexOf(x) > -1;
        })
      )
        ok = 0;
    }
    if (w.category) {
      any = 1;
      var c = catOf(X, w.category);
      if (!c || p[1] != c) ok = 0;
    }
    if (w.flavor) {
      any = 1;
      var f = nr(w.flavor);
      if (
        !(p[9] || []).some(function (x) {
          return nr(x[0]).indexOf(f) > -1;
        })
      )
        ok = 0;
    }
    if (w.variant) {
      any = 1;
      if (nr(p[10] || '').indexOf(nr(w.variant)) < 0) ok = 0;
    }
    if (w.pack) {
      any = 1;
      if (nr(p[2] || '').indexOf(nr(w.pack)) < 0) ok = 0;
    }
    if ((t = nn(w.minPrice)) != null) {
      any = 1;
      if (!(p[3] >= t)) ok = 0;
    }
    if ((t = nn(w.maxPrice)) != null) {
      any = 1;
      if (!(p[3] <= t)) ok = 0;
    }
    if (w.hidden === true || w.hidden === false) {
      any = 1;
      if (!!p[7] != w.hidden) ok = 0;
    }
    if (w.all === true) any = 1;
    return !!(any && ok);
  }
  function dsc(a, b) {
    var r = [];
    if (a[3] != b[3]) r.push('السعر ' + a[3] + ' ← ' + b[3]);
    if ((+a[11] || 0) != (+b[11] || 0))
      r.push('قبل الخصم ' + (a[11] || '—') + ' ← ' + (b[11] || '—'));
    if (a[0] != b[0]) r.push('الاسم ← ' + b[0]);
    if (a[1] != b[1]) r.push('القسم ← ' + b[1]);
    if ((a[2] || '') != (b[2] || '')) r.push('العبوة ← ' + (b[2] || '—'));
    if ((a[10] || '') != (b[10] || '')) r.push('النوع ← ' + (b[10] || '—'));
    if (a[6] != b[6]) r.push('الإيموجي ← ' + b[6]);
    if (!!a[7] != !!b[7]) r.push(b[7] ? 'إخفاء' : 'إظهار');
    if (JSON.stringify(a[9] || []) != JSON.stringify(b[9] || [])) r.push('النكهات اتغيّرت');
    return r.join('، ');
  }
  function edProd(X, o, R) {
    var d = o['do'] || {},
      w = o.where || {},
      keep = [];
    X.p.forEach(function (p) {
      if (!edMatch(X, p, w)) {
        keep.push(p);
        return;
      }
      if (d['delete'] === true) {
        R.lines.push('🗑 حذف: ' + pl(p));
        R.del++;
        R.n++;
        return;
      }
      var a = JSON.parse(JSON.stringify(p)),
        b = p,
        pr = +b[3],
        bo = +b[11] || 0,
        t;
      if ((t = nn(d.setPrice)) != null) pr = t;
      if ((t = nn(d.addPrice)) != null) pr += t;
      if ((t = nn(d.pctPrice)) != null) pr *= 1 + t / 100;
      if ((t = nn(d.discountPct)) != null) {
        var bs = bo > pr ? bo : pr;
        bo = bs;
        pr = bs * (1 - t / 100);
      }
      if ((t = nn(d.setOldPrice)) != null) bo = t;
      if (d.clearOldPrice === true) bo = 0;
      pr = Math.round(pr * 100) / 100;
      if (!(pr > 0)) {
        R.lines.push('⚠️ اتخطّى ' + pl(p) + ' (السعر هيبقى صفر)');
        keep.push(p);
        return;
      }
      b[3] = pr;
      sv(b, 11, bo > pr ? bo : 0);
      if (d.rename && d.rename.find) {
        var fd = String(d.rename.find),
          rp = String(d.rename.replace == null ? '' : d.rename.replace);
        if (b[0].indexOf(fd) > -1)
          b[0] = b[0].split(fd).join(rp).replace(/\s+/g, ' ').trim() || b[0];
      }
      if (d.setName && String(d.setName).trim()) b[0] = String(d.setName).trim();
      if (d.setCategory) {
        var cc = catOf(X, d.setCategory);
        if (!cc) {
          cc = String(d.setCategory).trim();
          if (cc) X.cats.push(cc);
        }
        if (cc) b[1] = cc;
      }
      if (d.setPack != null) b[2] = String(d.setPack).trim();
      if (d.setVariant != null) sv(b, 10, String(d.setVariant).trim());
      if (d.setEmoji && String(d.setEmoji).trim()) b[6] = String(d.setEmoji).trim().slice(0, 8);
      if (d.hide === true) b[7] = 1;
      else if (d.hide === false) b[7] = 0;
      var fl = (b[9] || []).map(function (f) {
          return [f[0], f[1] ? 1 : 0];
        }),
        chg = 0;
      ar(d.addFlavors).forEach(function (x) {
        x = String(x).trim();
        if (
          x &&
          !fl.some(function (f) {
            return nr(f[0]) == nr(x);
          })
        ) {
          fl.push([x, 0]);
          chg = 1;
        }
      });
      ar(d.removeFlavors).forEach(function (x) {
        var k = nr(x);
        if (!k) return;
        var n0 = fl.length;
        fl = fl.filter(function (f) {
          return nr(f[0]) != k;
        });
        if (fl.length != n0) chg = 1;
      });
      ar(d.hideFlavors).forEach(function (x) {
        var k = nr(x);
        if (k)
          fl.forEach(function (f) {
            if (nr(f[0]).indexOf(k) > -1 && !f[1]) {
              f[1] = 1;
              chg = 1;
            }
          });
      });
      ar(d.showFlavors).forEach(function (x) {
        var k = nr(x);
        if (k)
          fl.forEach(function (f) {
            if (nr(f[0]).indexOf(k) > -1 && f[1]) {
              f[1] = 0;
              chg = 1;
            }
          });
      });
      if (chg) sv(b, 9, fl.length ? fl : 0);
      var ln = dsc(a, b);
      if (ln) {
        R.lines.push(pl(a) + ': ' + ln);
        R.n++;
      }
      keep.push(b);
    });
    X.p = keep;
  }
  function edCat(X, o, R) {
    var a = o['do'],
      f = o.from || o.name,
      t = String(o.to == null ? '' : o.to).trim(),
      c;
    if (a == 'add') {
      var n = String(o.name || o.to || '').trim();
      if (n && !catEx(X, n)) {
        X.cats.push(n);
        R.lines.push('➕ قسم جديد: ' + n);
        R.n++;
      }
    } else if (a == 'rename') {
      c = catOf(X, f);
      if (!c || !t || t == c) return;
      var ex = catEx(X, t),
        k = X.p.filter(function (p) {
          return p[1] == c;
        }).length;
      if (ex && ex != c) {
        X.p.forEach(function (p) {
          if (p[1] == c) p[1] = ex;
        });
        X.cats.splice(X.cats.indexOf(c), 1);
        R.lines.push('🗂 دمج قسم «' + c + '» في «' + ex + '» (' + k + ' صنف)');
      } else {
        X.p.forEach(function (p) {
          if (p[1] == c) p[1] = t;
        });
        X.cats[X.cats.indexOf(c)] = t;
        R.lines.push('🗂 تغيير اسم القسم «' + c + '» ← «' + t + '»');
      }
      R.n++;
    } else if (a == 'delete') {
      c = catEx(X, f);
      if (!c) return;
      var k2 = X.p.filter(function (p) {
        return p[1] == c;
      }).length;
      X.p = X.p.filter(function (p) {
        return p[1] != c;
      });
      X.cats.splice(X.cats.indexOf(c), 1);
      R.lines.push('🗑 حذف قسم «' + c + '»' + (k2 ? ' ومعاه ' + k2 + ' صنف' : ''));
      R.del += k2 || 1;
      R.n++;
    }
  }
  function edOff(X, o, R) {
    var L = X.offers || (X.offers = []),
      a = o['do'],
      s = o.set || {},
      w = o.where || {};
    if (a == 'add') {
      var t = String(o.title || '').trim();
      if (!t) return;
      L.push({
        t: t,
        d: String(o.desc || ''),
        pr: String(o.price == null ? '' : o.price),
        g: String(o.badge || ''),
        c: PAL[0][1],
        i: '',
        x: 0,
      });
      R.lines.push('🎁 عرض جديد: ' + t);
      R.n++;
      return;
    }
    var k = nr(w.title != null ? w.title : o.title || ''),
      all = w.all === true;
    if (!k && !all) return;
    var keep = [];
    L.forEach(function (x) {
      if (!(all || nr(x.t).indexOf(k) > -1)) {
        keep.push(x);
        return;
      }
      if (a == 'delete') {
        R.lines.push('🗑 حذف عرض: ' + x.t);
        R.del++;
        R.n++;
        return;
      }
      var b0 = JSON.stringify(x);
      if (a == 'hide') x.x = 1;
      else if (a == 'show') x.x = 0;
      if (s.title != null && String(s.title).trim()) x.t = String(s.title).trim();
      if (s.desc != null) x.d = String(s.desc);
      if (s.price != null) x.pr = String(s.price);
      if (s.badge != null) x.g = String(s.badge);
      if (JSON.stringify(x) != b0) {
        R.lines.push('🎁 ' + x.t + ': ' + (a == 'hide' ? 'إخفاء' : a == 'show' ? 'إظهار' : 'تعديل'));
        R.n++;
      }
      keep.push(x);
    });
    X.offers = keep;
  }
  function edSet(X, o, R) {
    var d = o['do'] || o.set || {},
      c = X.cfg,
      t;
    if ((t = nn(d.min)) != null && t >= 0 && t != c.min) {
      R.lines.push('⚙️ أقل قيمة للطلب: ' + c.min + ' ← ' + t);
      c.min = t;
      R.n++;
    }
    if (d.unit) {
      var u = String(d.unit).trim();
      if (u && u != c.unit) {
        R.lines.push('⚙️ اسم الوحدة: ' + c.unit + ' ← ' + u);
        c.unit = u;
        R.n++;
      }
    }
    if (d.phone) {
      var ph = np(String(d.phone));
      if (ph.length >= 11 && ph != c.phone) {
        R.lines.push('⚙️ رقم الواتساب: ' + c.phone + ' ← ' + ph);
        c.phone = ph;
        R.n++;
      }
    }
  }
  function edApply(X, ops) {
    var R = { lines: [], n: 0, del: 0 };
    (ops || []).forEach(function (o) {
      if (!o || typeof o != 'object') return;
      try {
        if (o.type == 'product') edProd(X, o, R);
        else if (o.type == 'category') edCat(X, o, R);
        else if (o.type == 'offer') edOff(X, o, R);
        else if (o.type == 'settings') edSet(X, o, R);
      } catch (z) {
        console.error(z);
      }
    });
    return R;
  }
  function edRules() {
    var cat = D.p
      .slice(0, 500)
      .map(function (p) {
        return (
          p[0] +
          (p[10] ? ' (' + p[10] + ')' : '') +
          ' | ' +
          p[1] +
          ' | ' +
          p[3] +
          (+p[11] > p[3] ? ' (قبل ' + p[11] + ')' : '') +
          (p[7] ? ' | مخفي' : '') +
          (p[9] && p[9].length
            ? ' | نكهات: ' +
              p[9]
                .slice(0, 12)
                .map(function (f) {
                  return f[0] + (f[1] ? '(خلص)' : '');
                })
                .join('،')
            : '')
        );
      })
      .join('\n');
    var of = (D.offers || [])
      .map(function (o) {
        return o.t + (o.x ? ' (مخفي)' : '');
      })
      .join(' / ');
    return (
      '- التعديل على الموجود: لو التاجر عايز يغيّر أو يحذف أو يخفي أو يزوّد أو ينقّص حاجة موجودة (أسعار، أصناف، أقسام، عروض، إعدادات) املا ops (مصفوفة عمليات) وسيب products زي المسودة الحالية. التطبيق هو اللي بيطبّق العمليات على كل الأصناف المطابقة ويعرضها للتاجر يراجعها وينفّذها، فماتحسبش أسعار بنفسك وماتسردش أصناف: اوصف الفلتر والتغيير بس، وماتخترعش أرقام التاجر ماقالهاش. reply تبقى جملة قصيرة تقول إنك جهّزت التعديلات تحت عشان يراجعها وينفّذها (ماتقولش إنها اتنفّذت).\n' +
      '- شكل عملية الأصناف: {"type":"product","where":{"name":["كلمة"],"category":"","flavor":"","variant":"","pack":"","minPrice":0,"maxPrice":0,"hidden":false,"all":false},"do":{}}. where لازم فيه شرط واحد على الأقل (ولو التاجر قال كل الأصناف حط all:true). name مصفوفة كلمات والصنف يطابق لو اسمه فيه أي كلمة منها. استعمل بس الحقول المطلوبة.\n' +
      '- do للأصناف (استعمل اللي محتاجه): setPrice سعر جديد ثابت | addPrice زيادة أو نقص بمبلغ (سالب للنقص) | pctPrice زيادة أو نقص بنسبة (سالب للنقص) | discountPct خصم بنسبة (والسعر القديم يتحفظ كسعر قبل الخصم) | setOldPrice | clearOldPrice:true | rename:{"find":"","replace":""} لاستبدال كلمة في الاسم | setName | setCategory | setPack للعبوة | setVariant | setEmoji | hide:true أو false للإخفاء والإظهار | delete:true | addFlavors:[] | removeFlavors:[] | hideFlavors:[] نكهة خلصت | showFlavors:[].\n' +
      '- الأقسام: {"type":"category","do":"add أو rename أو delete","name":"","from":"","to":""}. العروض: {"type":"offer","do":"add أو update أو hide أو show أو delete","title":"","desc":"","price":"","badge":"","where":{"title":"","all":false},"set":{"title":"","desc":"","price":"","badge":""}}. الإعدادات: {"type":"settings","do":{"min":0,"unit":"","phone":""}} (أقل طلب، اسم الوحدة، رقم الواتساب).\n' +
      '- ops بتخص رسالة التاجر الحالية بس، فماتكررش عمليات اتنفّذت قبل كده. لو الطلب مش واضح اسأل سؤال واحد وسيب ops فاضية. وماتحطش ops وإضافة أصناف جديدة في نفس الرد.\n' +
      'الأصناف الحالية بالتفصيل (الاسم | القسم | السعر):\n' +
      cat +
      '\nالعروض الحالية: ' +
      of +
      '\nالإعدادات الحالية: أقل طلب ' +
      D.cfg.min +
      '، الوحدة ' +
      D.cfg.unit +
      '، الواتساب ' +
      D.cfg.phone +
      '\n'
    );
  }
  function chEdCard() {
    var P = CH.pend,
      h = '';
    if (P) {
      h +=
        '<div class="card2" style="margin:8px 0 0;padding:8px 10px"><b>✏️ التعديلات المقترحة (' +
        P.n +
        ')</b><div class="hint" style="max-height:26vh;overflow:auto">' +
        P.lines.slice(0, 60).map(esc).join('<br>') +
        (P.lines.length > 60 ? '<br>... و' + (P.lines.length - 60) + ' كمان' : '') +
        '</div><div class="r2"><button class="pubb big" id="chex" type="button" style="margin-top:8px;padding:8px">✅ نفّذ</button><button class="del big" id="chcx" type="button" style="margin-top:8px;padding:8px;flex:none">إلغاء</button></div></div>';
    }
    if (CH.undo)
      h +=
        '<button class="mini" id="chun" type="button" style="margin-top:8px">↩️ تراجع عن آخر تعديل</button>';
    return h;
  }
  function chExec() {
    var P = CH.pend;
    if (!P) return;
    var proceed = function () {
      CH.undo = JSON.stringify(D);
      var R = edApply(D, P.ops);
      D.offers = D.offers || [];
      CH.pend = null;
      mark();
      CH.msgs.push({ r: 'a', t: 'اتنفّذ ✅ (' + R.n + ' تعديل). راجع الأصناف ولما تخلّص دوس 🚀 نشر.' });
      chRender();
      render();
    };
    if (P.del) {
      askConfirm('العملية دي هتحذف ' + P.del + ' عنصر. متأكد؟', 'تنفيذ الحذف').then(function (ok) {
        if (ok) proceed();
      });
    } else {
      proceed();
    }
  }
  function chUndo() {
    if (!CH.undo) return;
    D = JSON.parse(CH.undo);
    D.offers = D.offers || [];
    CH.undo = null;
    CH.pend = null;
    mark();
    CH.msgs.push({ r: 'a', t: 'رجّعت آخر تعديل ↩️' });
    chRender();
    render();
  }
  async function chSend() {
    if (CH.busy) return;
    if (VON || VR || VST || VPEND > 0) {
      toast('وقّف التسجيل واستنى لحد ما الكلام يتكتب');
      return;
    }
    var ta = $('smt'),
      er = $('sme'),
      t = ta ? ta.value.trim() : '';
    if (!t) return;
    var ke = $('smk'),
      k = ke ? ke.value.trim() : '';
    er.textContent = '';
    CH.msgs.push({ r: 'u', t: t });
    ta.value = '';
    SMT = '';
    CH.busy = 1;
    chRender();
    try {
      var raw = await askGemini(k, chPrompt()),
        j = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(j)) j = { products: j };
      var L = (Array.isArray(j.products) ? j.products : []).map(nz).filter(function (o) {
        return o.n;
      });
      if (L.length || !CH.draft.length) {
        var tx = CH.msgs
          .filter(function (x) {
            return x.r == 'u';
          })
          .map(function (x) {
            return x.t;
          })
          .join('\n');
        CH.draft = fixList(L, tx);
      }
      CH.msgs.push({ r: 'a', t: String(j.reply || 'تمام') });
      var ops = Array.isArray(j.ops) ? j.ops : [];
      CH.pend = null;
      if (ops.length) {
        var R1 = edApply(JSON.parse(JSON.stringify(D)), ops);
        if (R1.n) {
          R1.ops = ops;
          CH.pend = R1;
        } else
          CH.msgs.push({
            r: 'a',
            t: 'مالقيتش حاجة تتغيّر بالطلب ده، اكتب اسم الصنف أو القسم أوضح.',
          });
      }
      CH.busy = 0;
      chRender();
      if (j.action == 'review' && CH.draft.length) chReview();
    } catch (x) {
      var m = x && x.message;
      CH.msgs.pop();
      CH.busy = 0;
      var ta2 = $('smt');
      if (ta2) ta2.value = t;
      var e2 = $('sme');
      if (e2) {
        e2.style.color = '';
        e2.textContent =
          m == 'KEY'
            ? 'الـ API مش مظبوط أو مش متضاف، راجعه من الإعدادات'
            : m == 'LIMIT'
            ? 'الحصة المجانية خلصت دلوقتي، جرّب بعد شوية'
            : m == 'NOMODEL'
            ? 'مقدرتش أوصل لموديل مجاني، جرّب بعد شوية'
            : x instanceof SyntaxError
            ? 'الرد رجع مش مفهوم، ابعت تاني'
            : 'مفيش اتصال بالإنترنت أو فيه مشكلة، جرّب تاني';
      }
      chRender();
    }
  }
  function chReview() {
    vStop(false);
    var list = CH.draft.map(function (o) {
      return JSON.parse(JSON.stringify(o));
    });
    list.forEach(function (o) {
      o.on = 1;
      o.im = '';
      o.w = o.w || [];
      o.c = o.c ? mc(o.c) : D.cats[0] || 'عام';
      o.dup = D.p.some(function (p) {
        return p[0] == o.n && (p[10] || '') == o.v && p[1] == o.c;
      });
      if (o.dup) o.on = 0;
    });
    SM = list;
    smRv();
  }
  $('ov').addEventListener('click', function (e) {
    var t = e.target,
      b;
    if (!(b = t.closest && t.closest('button'))) return;
    if (b.id == 'chsend') chSend();
    else if (b.id == 'chex') chExec();
    else if (b.id == 'chcx') {
      CH.pend = null;
      chRender();
    } else if (b.id == 'chun') chUndo();
    else if (b.id == 'chrv') chReview();
    else if (b.id == 'chnw') {
      askConfirm('تمسح المحادثة والمسودة؟', 'مسح').then(function (ok) {
        if (!ok) return;
        chReset();
        chRender();
      });
    } else if (b.id == 'chold') {
      vStop(false);
      smOpen();
    }
  });

  function pk(o) {
    var n = o.n,
      mp = [
        ['طماطم', 1],
        ['شطة', 1],
        ['حار', 1],
        ['جبن', 2],
        ['برتقال', 2],
        ['خل', 3],
        ['ملح', 0],
        ['شوكولات', 5],
        ['كاكاو', 5],
        ['فراولة', 6],
        ['ذرة', 7],
        ['فشار', 7],
      ];
    for (var i = 0; i < mp.length; i++) if (n.indexOf(mp[i][0]) > -1) return mp[i][1];
    var h = 0;
    for (i = 0; i < n.length; i++) h += n.charCodeAt(i);
    return h % PAL.length;
  }
  function smRv(keep) {
    var op = document.querySelector('#ov .pn'),
      st = keep && op ? op.scrollTop : 0,
      h =
        '<div class="pn"><h2>راجع الأصناف (' +
        SM.length +
        ')<button class="x" id="smx">✕</button></h2><p class="hint">عدّل أي حاجة، وشيل العلامة من اللي مش عايزه.</p>';
    SM.forEach(function (o, i) {
      var cs = D.cats.slice();
      if (o.c && cs.indexOf(o.c) < 0) cs.push(o.c);
      var a = ' data-si="' + i + '" data-sk=';
      h +=
        '<div class="card2"><label class="ck" style="margin:0"><input type="checkbox"' +
        a +
        '"on"' +
        (o.on ? ' checked' : '') +
        '> إضافة' +
        (o.dup ? ' <span style="color:var(--red)">⚠️ شبهه موجود</span>' : '') +
        '</label>' +
        (o.w && o.w.length
          ? '<div class="hint" style="color:var(--red);margin:6px 0">' +
            o.w
              .map(function (x) {
                return esc(x);
              })
              .join('<br>') +
            '</div>'
          : '') +
        '<label>صورة المنتج (اختياري)</label><div class="ip"><div class="ipv" style="width:72px;height:72px">' +
        (o.im ? '<img src="' + o.im + '" alt="">' : esc(o.e || '🥔')) +
        '</div><div class="btns"><label class="pubb" style="display:inline-block;cursor:pointer;margin:0">📷 اختر صورة<input type="file" accept="image/*" hidden data-si="' +
        i +
        '" data-sk="img"></label>' +
        (o.im
          ? '<button class="del" type="button" data-si="' + i + '" data-sk="rmim">إزالة الصورة</button>'
          : '') +
        '</div></div><label>الاسم</label><input' +
        a +
        '"n" value="' +
        esc(o.n) +
        '">' +
        '<div class="r2"><div><label>السعر</label><input type="number" inputmode="numeric"' +
        a +
        '"p" value="' +
        (o.p || '') +
        '"></div><div><label>الحجم / النوع</label><input' +
        a +
        '"v" value="' +
        esc(o.v) +
        '"></div><div style="max-width:70px"><label>إيموجي</label><input' +
        a +
        '"e" value="' +
        esc(o.e) +
        '" style="text-align:center"></div></div>' +
        '<label>العبوة / الوصف</label><input' +
        a +
        '"d" value="' +
        esc(o.d) +
        '">' +
        '<label>القسم</label><select' +
        a +
        '"c">' +
        cs
          .map(function (c) {
            return '<option' + (c == o.c ? ' selected' : '') + '>' + esc(c) + '</option>';
          })
          .join('') +
        '</select>' +
        '<label>النكهات (' +
        o.f.length +
        ') — افصل بفاصلة</label><input' +
        a +
        '"f" value="' +
        esc(o.f.join('، ')) +
        '"></div>';
    });
    $('ov').innerHTML =
      h +
      '<div class="r2"><button class="pubb big" id="smok">➕ إضافة المحدد</button><button class="del big" id="smbk" style="background:var(--blue)">رجوع</button></div></div>';
    $('ov').classList.add('on');
    var np2 = document.querySelector('#ov .pn');
    if (np2) np2.scrollTop = st;
  }
  async function smGo(ai) {
    vStop(false);
    var tx = $('smt').value.trim(),
      er = $('sme'),
      bs = [$('smai'), $('smlp')];
    SMT = tx;
    er.textContent = '';
    er.style.color = '';
    if (!tx) {
      er.textContent = 'اكتب وصف الأصناف الأول';
      return;
    }
    try {
      var list;
      if (ai) {
        var k = $('smk').value.trim();
        bs.forEach(function (b) {
          b.disabled = true;
        });
        er.style.color = 'var(--mu)';
        er.textContent = '⏳ بحلل الأصناف...';
        var raw = await askGemini(k, aiPrompt(tx)),
          j = JSON.parse(raw.replace(/```json|```/g, '').trim());
        list = (Array.isArray(j) ? j : j.products || []).map(nz);
      } else list = lp(tx);
      list = list.filter(function (o) {
        return o.n;
      });
      list = fixList(list, tx);
      if (!list.length) {
        er.style.color = '';
        er.textContent = 'ما قدرتش أفهم أي صنف من النص، جرّب توضحه أكتر';
        bs.forEach(function (b) {
          if (b) b.disabled = false;
        });
        return;
      }
      list.forEach(function (o) {
        o.im = '';
        o.c = o.c ? mc(o.c) : D.cats[0] || 'عام';
        o.dup = D.p.some(function (p) {
          return p[0] == o.n && (p[10] || '') == o.v && p[1] == o.c;
        });
        if (o.dup) o.on = 0;
      });
      SM = list;
      smRv();
    } catch (x) {
      var m = x && x.message;
      er.style.color = '';
      er.textContent =
        m == 'KEY'
          ? 'الـ API مش مظبوط أو مش متضاف، راجعه من الإعدادات'
          : m == 'LIMIT'
          ? 'الحصة المجانية خلصت دلوقتي، جرّب بعد شوية أو استخدم التحليل بدون ذكاء اصطناعي'
          : m == 'NOMODEL'
          ? 'مقدرتش أوصل لموديل مجاني، جرّب بعد شوية'
          : x instanceof SyntaxError
          ? 'الرد رجع مش مفهوم، جرّب تاني'
          : x instanceof TypeError
          ? 'مفيش اتصال بالإنترنت'
          : 'حصلت مشكلة، جرّب تاني';
      bs.forEach(function (b) {
        if (b) b.disabled = false;
      });
    }
  }
  $('ov').addEventListener('click', function (e) {
    var t = e.target;
    if (t.id == 'smx') closeEd();
    else if (t.id == 'smbk') CHF ? chOpen() : smIn(SMT);
    else if (t.id == 'smai') smGo(true);
    else if (t.id == 'smlp') smGo(false);
    else if (t.dataset.sk == 'rmim' && SM[+t.dataset.si]) {
      SM[+t.dataset.si].im = '';
      smRv(1);
    } else if (t.id == 'smok') {
      var sel = SM.filter(function (o) {
        return o.on && o.n;
      });
      if (!sel.length) {
        toast('اختار صنف واحد على الأقل');
        return;
      }
      if (
        sel.some(function (o) {
          return !(o.p > 0);
        })
      ) {
        toast('فيه صنف من غير سعر، اكتبه');
        return;
      }
      var imap = {};
      sel.forEach(function (o) {
        var k = pk(o),
          a = [o.n, o.c, o.d, o.p, PAL[k][1], PAL[k][2], o.e || '🥔', 0, ''];
        if (o.f.length)
          a[9] = o.f.map(function (f) {
            return [f, 0];
          });
        if (o.v) a[10] = o.v;
        if (o.o > o.p) a[11] = o.o;
        if (o.im) {
          if (!imap[o.im]) {
            var nid = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            IMG[nid] = o.im;
            PEND[nid] = 1;
            imap[o.im] = nid;
          }
          a[8] = imap[o.im];
        }
        if (D.cats.indexOf(o.c) < 0) D.cats.push(o.c);
        D.p.push(a);
      });
      chReset();
      SM = [];
      SMT = '';
      mark();
      closeEd();
      render();
      toast('اتضاف ' + sel.length + ' صنف ✅ لا تنسى تدوس نشر');
    }
  });
  $('ov').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.sk == null) return;
    var o = SM[+t.dataset.si],
      k = t.dataset.sk;
    if (!o) return;
    if (k == 'img') {
      var fl = t.files && t.files[0];
      if (fl)
        shrink(fl)
          .then(function (u) {
            o.im = u;
            smRv(1);
          })
          .catch(function () {
            toast('الصورة دي مش شغالة، جرّب غيرها');
          });
      return;
    }
    if (k == 'on') o.on = t.checked ? 1 : 0;
    else if (k == 'p') o.p = +t.value || 0;
    else if (k == 'f') {
      o.f = sfl(t.value);
    } else o[k] = t.value.trim();
  });
  $('smb').onclick = chOpen;

  function readFontFile(f) {
    return new Promise(function (ok, no) {
      if (!/\.(ttf|otf|woff2?)$/i.test(f.name) && !String(f.type || '').match(/font/i)) {
        no(new Error('TYPE'));
        return;
      }
      if (f.size > 2600000) {
        no(new Error('SIZE'));
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        ok(r.result);
      };
      r.onerror = no;
      r.readAsDataURL(f);
    });
  }

  $('app').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id == 'lgf' && t.files && t.files[0]) {
      shrink(t.files[0])
        .then(function (u) {
          var nid = 'i' + Date.now().toString(36);
          IMG[nid] = u;
          PEND[nid] = 1;
          D.cfg.logo = nid;
          mark();
          render();
        })
        .catch(function () {
          toast('الصورة دي مش شغالة، جرّب غيرها');
        });
    } else if ((t.id == 'fntBody' || t.id == 'fntHead') && t.files && t.files[0]) {
      var file = t.files[0],
        isBody = t.id == 'fntBody';
      readFontFile(file)
        .then(function (u) {
          var nid = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
          IMG[nid] = u;
          PEND[nid] = 1;
          if (isBody) {
            D.cfg.fontBodyId = nid;
            D.cfg.fontBodyName = file.name;
          } else {
            D.cfg.fontHeadId = nid;
            D.cfg.fontHeadName = file.name;
          }
          mark();
          render();
          toast('تم رفع الخط ✅ دوس نشر لتفعيله عند العملاء');
        })
        .catch(function (err) {
          toast(
            err && err.message == 'SIZE'
              ? 'ملف الخط كبير أوي (الحد الأقصى ٢.٥ ميجا)'
              : 'اختار ملف خط بصيغة TTF أو OTF أو WOFF أو WOFF2'
          );
        });
    }
  });
  $('app').addEventListener('click', function (e) {
    var id = e.target.id;
    if (id == 'lgrm') {
      delete D.cfg.logo;
      mark();
      render();
    } else if (id == 'fntBodyRm') {
      delete D.cfg.fontBodyId;
      delete D.cfg.fontBodyName;
      mark();
      render();
    } else if (id == 'fntHeadRm') {
      delete D.cfg.fontHeadId;
      delete D.cfg.fontHeadName;
      mark();
      render();
    } else if (id == 'resetColors') {
      delete D.cfg.cBg;
      delete D.cfg.cRed;
      delete D.cfg.cBlue;
      delete D.cfg.cGreen;
      mark();
      render();
      toast('تم استرجاع الألوان الأصلية');
    }
  });

  // ===== النشر إلى الخادم الآمن =====
  async function pub() {
    if (!D.cfg.phone || D.cfg.phone.length < 11) {
      toast('رقم الواتساب ناقص، راجعه من الإعدادات');
      tab = 's';
      render();
      return;
    }
    var b = $('pub');
    b.disabled = true;
    D.v = (D.v || 0) + 1;
    var used = {};
    D.p.forEach(function (p) {
      if (p[8]) used[p[8]] = 1;
    });
    OFS().forEach(function (o) {
      if (o.i) used[o.i] = 1;
    });
    if (D.cfg.logo) used[D.cfg.logo] = 1;
    if (D.cfg.fontBodyId) used[D.cfg.fontBodyId] = 1;
    if (D.cfg.fontHeadId) used[D.cfg.fontHeadId] = 1;

    var pendingImages = {};
    for (var k in PEND) {
      if (used[k] && IMG[k]) pendingImages[k] = IMG[k];
    }

    try {
      var res = await fetch('/api/admin/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: D, pendingImages: pendingImages }),
      });
      if (res.status === 401) {
        handleAdminUnauthorized();
        return;
      }
      var out = await res.json();
      if (!res.ok) throw new Error(out.error || 'تعذر النشر');
      PEND = {};
      dirty = false;
      $('st').textContent = 'اتنشر ✅ العملاء هيشوفوه خلال ثواني';
      b.classList.remove('hot');
      toast('اتنشر ✅');
    } catch (e) {
      D.v--;
      console.error(e);
      toast('مقدرش ينشر: ' + (e && e.message ? e.message : e));
    } finally {
      b.disabled = false;
    }
  }

  async function loadAll() {
    var res = await fetch('/api/admin/bootstrap', { credentials: 'same-origin' });
    if (res.status === 401) {
      handleAdminUnauthorized();
      return;
    }
    var out = await res.json();
    if (!res.ok) throw new Error(out.error || 'تعذر تحميل البيانات');
    if (out.data) {
      D = out.data;
      D.cfg = D.cfg || { phone: '', min: 0, unit: 'كرتونة' };
      D.cats = Array.isArray(D.cats) ? D.cats : [];
      D.p = Array.isArray(D.p) ? D.p : [];
      D.offers = Array.isArray(D.offers) ? D.offers : [];
    }
    IMG = out.images || {};
  }

  async function init() {
    $('lf').hidden = true;
    $('app').hidden = false;
    try {
      await Promise.all([loadAll(), loadUsers(true)]);
      render();
    } catch (e) {
      toast((e && e.message) || 'تعذر تحميل لوحة التحكم');
      render();
    }
  }

  init();
})();
