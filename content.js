/* content.js — نسخهٔ ۲.۰ (کامل)
   ✓ پنل + کلید K (اجرای کامل) و T (کلیک تستی)
   ✓ ردیابی زندهٔ دکمه و جبران اسکرول خودکار بازی (به‌روزرسانی مختصات توقف)
   ✓ فریز عدد پنل در لحظهٔ «واقعیِ» رسیدن press توقف
   ✓ کالیبراسیون: لاگ مقایسهٔ داخلی/بازی + پیشنهاد «زمان توقف»
   ✓ بررسی اینکه بازی واقعاً متوقف شده یا نه
*/

(() => {
  'use strict';
  if (window.self !== window.top) return;

  const LS_KEY  = 'dk_5sr_cdp_settings_v1';
  const ROOT_ID = 'dk5sr-root';
  const GAME_RE = /five-second-rush/i;

  const S = {
    active: false, bootstrapped: false,
    phase: 'armed',            /* armed | running | done */
    hotkey: 'KeyK',
    delayMs: 80,               /* تأخیر بین کلیک شروع و شروع شمارش — توصیه: برابر gap (مثلاً 90) */
    stopSec: 5.00,             /* مدت شمارش — آفست مثل 4.96 یا 5.01 */
    gapMs: 90,                 /* فاصلهٔ انسانیِ فشردن تا رهاکردن */
    anchor: 'press',           /* توقف روی press ثبت شود یا release */
    leadMs: 0,                 /* پیش‌ارسال CDP برای جبران تأخیر تزریق */
    autoRearm: false,
    mouseX: null, mouseY: null,
    origX: 0, origY: 0,        /* مختصات dispatch شروع */
    runX: 0, runY: 0,          /* مختصات dispatch توقف (به‌روز می‌شود) */
    runDelayMs: 80, runStopSec: 5.00, /* مقدارهای لحظهٔ شروع (برای نمایش/گزارش دقیق) */
    btnEl: null, lastCoordsPush: 0, coordLogged: false,
    timing: null, arrivedStart: false, arrivedStop: false, stopArrivalEpoch: null,
    counterEl: null, lastScan: 0, lastPageTxt: null,
    rafId: 0,
    ui: {},
  };
  let counterSnap = new Map();

  /* ---------- تنظیمات ذخیره‌شده ---------- */
  function loadSettings() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {};
      if (c.hotkey) S.hotkey = String(c.hotkey);
      if (c.delayMs != null && Number.isFinite(+c.delayMs)) S.delayMs = Math.min(2000, Math.max(0, Math.round(+c.delayMs)));
      if (c.stopSec != null && Number.isFinite(+c.stopSec)) S.stopSec = Math.min(10, Math.max(0.1, +c.stopSec));
      if (c.gapMs   != null && Number.isFinite(+c.gapMs))   S.gapMs   = Math.min(500, Math.max(0, Math.round(+c.gapMs)));
      if (c.leadMs  != null && Number.isFinite(+c.leadMs))  S.leadMs  = Math.min(500, Math.max(-200, Math.round(+c.leadMs)));
      if (c.anchor === 'release' || c.anchor === 'press') S.anchor = c.anchor;
      if (typeof c.autoRearm === 'boolean') S.autoRearm = c.autoRearm;
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        hotkey: S.hotkey, delayMs: S.delayMs, stopSec: S.stopSec, gapMs: S.gapMs,
        anchor: S.anchor, leadMs: S.leadMs, autoRearm: S.autoRearm,
      }));
    } catch (e) {}
  }
  loadSettings();

  /* ---------- ابزارها ---------- */
  function normNum(s) {
    s = String(s == null ? '' : s).trim();
    const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
    return s
      .replace(/[۰-۹]/g, d => fa.indexOf(d))
      .replace(/[٠-٩]/g, d => ar.indexOf(d))
      .replace(/[٫،؛:,\/]/g, '.');
  }
  function keyLabel() {
    if (!S.hotkey) return '—';
    if (/^Key./.test(S.hotkey))   return S.hotkey.slice(3);
    if (/^Digit./.test(S.hotkey)) return S.hotkey.slice(5);
    return S.hotkey;
  }
  function epochNow() { return performance.timeOrigin + performance.now(); }
  function send(msg) {
    try { chrome.runtime.sendMessage(msg).catch(() => {}); }
    catch (e) { pushLog('⚠ ارتباط با افزونه قطع است — از chrome://extensions آن را Reload کن.'); }
  }

  /* ---------- پنل ---------- */
  function buildPanel() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
    <style>
      #dk5sr-root{position:fixed;top:120px;right:16px;z-index:2147483646;direction:rtl;
        font-family:Vazirmatn,'Segoe UI',Tahoma,sans-serif;font-size:12px;color:#e8eaf0;
        background:#141822;border:1px solid #2b3344;border-radius:12px;width:246px;
        box-shadow:0 10px 34px rgba(0,0,0,.4);user-select:none;line-height:1.7}
      #dk5sr-root *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}
      #dk5sr-root input{user-select:text}
      #dk5sr-root input[type=checkbox]{accent-color:#4c8bf5;width:13px;height:13px;flex:none}
      #dk5sr-head{display:flex;align-items:center;gap:7px;padding:8px 11px;cursor:move;
        background:#1b2130;border-radius:11px 11px 0 0;border-bottom:1px solid #2b3344}
      #dk5sr-title{font-weight:700;font-size:12.5px;flex:1;color:#fff}
      #dk5sr-dot{width:10px;height:10px;border-radius:50%;background:#5b6373;flex:none;transition:.25s}
      #dk5sr-dot.on{background:#2ecc71;box-shadow:0 0 9px rgba(46,204,113,.7)}
      #dk5sr-dot.run{background:#f1c40f;box-shadow:0 0 9px rgba(241,196,15,.7)}
      #dk5sr-min{background:none;border:0;color:#9aa3b5;cursor:pointer;font-size:15px;padding:2px 7px;border-radius:6px}
      #dk5sr-min:hover{background:#262d3d;color:#fff}
      #dk5sr-body{padding:10px 11px}
      #dk5sr-status{font-size:11px;color:#9aa3b5;min-height:16px;margin-bottom:7px}
      #dk5sr-readout{background:#0d1017;border:1px solid #262d3b;border-radius:9px;padding:7px 8px 5px;text-align:center;margin-bottom:5px}
      #dk5sr-big{font-size:27px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px;direction:ltr}
      #dk5sr-big.run{color:#f1c40f}
      #dk5sr-sub{font-size:10px;color:#7d8798;min-height:13px}
      #dk5sr-pagecounter{font-size:10.5px;color:#7d8798;text-align:center;margin:5px 0;min-height:14px}
      #dk5sr-root .dk5sr-row{display:flex;align-items:center;gap:6px;margin:6px 0}
      #dk5sr-root .dk5sr-row label{flex:1;font-size:11px;color:#c3cad8}
      #dk5sr-root .dk5sr-row input,#dk5sr-root .dk5sr-row select{width:82px;flex:none;background:#0d1017;color:#e8eaf0;border:1px solid #2b3344;border-radius:7px;padding:4px 4px;font-size:12px;text-align:center;direction:ltr}
      #dk5sr-root .dk5sr-row input:focus,#dk5sr-root .dk5sr-row select:focus{outline:none;border-color:#4c8bf5}
      #dk5sr-key{cursor:pointer}
      #dk5sr-root .dk5sr-check{display:flex;align-items:center;gap:6px;font-size:11px;color:#c3cad8;margin:6px 0;cursor:pointer}
      #dk5sr-total{font-size:10px;color:#68718a;text-align:center;margin:3px 0 7px}
      #dk5sr-testhint{font-size:10px;color:#7d8798;text-align:center;margin:2px 0 7px}
      #dk5sr-testhint b{color:#a9b6cf}
      #dk5sr-reset{display:block;width:100%;padding:8px;background:#24361f;border:1px solid #3a5c2e;color:#a4e793;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:700}
      #dk5sr-reset:hover{background:#2c4526}
      #dk5sr-log{margin-top:9px;background:#0d1017;border:1px solid #262d3b;border-radius:8px;padding:5px 8px;font-size:10px;color:#8f99ab;max-height:128px;overflow-y:auto}
      #dk5sr-log div{border-bottom:1px dashed #232a38;padding:3px 0;word-break:break-word}
      #dk5sr-help{margin-top:8px;font-size:10px;color:#5f6880;line-height:1.8;border-top:1px dashed #262d3b;padding-top:7px}
    </style>
    <div id="dk5sr-head">
      <span id="dk5sr-dot"></span>
      <span id="dk5sr-title">⏱ دستیار ۵ ثانیه (CDP v2)</span>
      <button id="dk5sr-min" title="جمع‌کردن پنل">–</button>
    </div>
    <div id="dk5sr-body">
      <div id="dk5sr-status"></div>
      <div id="dk5sr-readout"><div id="dk5sr-big">—</div><div id="dk5sr-sub"></div></div>
      <div id="dk5sr-pagecounter">شمارندهٔ صفحه: —</div>
      <div class="dk5sr-row"><label>کلید میان‌بر (تایپ کن)</label><input id="dk5sr-key" readonly></div>
      <div class="dk5sr-row"><label>تأخیر بعد از کلیک شروع (ms)</label><input id="dk5sr-delay" type="number" step="10" min="0" max="2000"></div>
      <div class="dk5sr-row"><label>زمان توقف / آفست (ثانیه)</label><input id="dk5sr-stop" type="text" inputmode="decimal" placeholder="5.00"></div>
      <div class="dk5sr-row"><label>فاصلهٔ انسانی press→release (ms)</label><input id="dk5sr-gap" type="number" step="10" min="0" max="500"></div>
      <div class="dk5sr-row"><label>توقف ثبت شود روی</label>
        <select id="dk5sr-anchor">
          <option value="press">فشردن (pointerdown)</option>
          <option value="release">رهاکردن (click)</option>
        </select>
      </div>
      <div class="dk5sr-row"><label>پیش‌ارسال CDP (ms)</label><input id="dk5sr-lead" type="number" step="1" min="-200" max="500"></div>
      <label class="dk5sr-check"><input type="checkbox" id="dk5sr-auto"> آماده‌سازی خودکار برای تلاش بعدی</label>
      <div id="dk5sr-total"></div>
      <div id="dk5sr-testhint">کلید <b>T</b> = کلیک تستیِ trusted در محل موس</div>
      <button id="dk5sr-reset">⟳ ریست — آمادهٔ کلید میان‌بر</button>
      <div id="dk5sr-log"></div>
      <div id="dk5sr-help">موس را روی دکمهٔ «شروع» بگذار و کلید میان‌بر را بزن. کلیک‌ها از سطح CDP
        کروم تزریق می‌شوند (کاملاً واقعی/trusted) و اگر صفحه اسکرول بخورد، دکمه به‌طور خودکار
        دنبال می‌شود. با T موتور را تست کن و با لاگِ پایانی، «زمان توقف» را کالیبره کن.</div>
    </div>`;
    (document.body || document.documentElement).appendChild(root);

    const q = (sel) => root.querySelector(sel);
    S.ui = {
      root,
      head: q('#dk5sr-head'), dot: q('#dk5sr-dot'), min: q('#dk5sr-min'),
      body: q('#dk5sr-body'), status: q('#dk5sr-status'),
      big: q('#dk5sr-big'), sub: q('#dk5sr-sub'), page: q('#dk5sr-pagecounter'),
      key: q('#dk5sr-key'), delay: q('#dk5sr-delay'), stop: q('#dk5sr-stop'),
      gap: q('#dk5sr-gap'), anchor: q('#dk5sr-anchor'), lead: q('#dk5sr-lead'),
      auto: q('#dk5sr-auto'), total: q('#dk5sr-total'), reset: q('#dk5sr-reset'), log: q('#dk5sr-log'),
    };

    S.ui.key.value = keyLabel();
    S.ui.delay.value = String(S.delayMs);
    S.ui.stop.value = S.stopSec.toFixed(2);
    S.ui.gap.value = String(S.gapMs);
    S.ui.anchor.value = S.anchor;
    S.ui.lead.value = String(S.leadMs);
    S.ui.auto.checked = S.autoRearm;

    S.ui.key.addEventListener('keydown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['Shift','Control','Alt','Meta','CapsLock','Tab','Escape'].includes(e.key)) return;
      S.hotkey = e.code || ('Key' + String(e.key).toUpperCase());
      S.ui.key.value = keyLabel();
      saveSettings(); refreshStatus();
      pushLog('کلید میان‌بر: «' + keyLabel() + '»');
    });

    S.ui.delay.addEventListener('input', () => {
      const v = parseInt(S.ui.delay.value, 10);
      if (Number.isFinite(v)) { S.delayMs = Math.min(2000, Math.max(0, v)); saveSettings(); updateTotal(); }
    });
    S.ui.stop.addEventListener('input', () => {
      const v = parseFloat(normNum(S.ui.stop.value));
      if (Number.isFinite(v) && v > 0) { S.stopSec = Math.min(10, Math.max(0.1, v)); saveSettings(); updateTotal(); }
    });
    S.ui.stop.addEventListener('blur', () => { S.ui.stop.value = S.stopSec.toFixed(2); });
    S.ui.gap.addEventListener('input', () => {
      const v = parseInt(S.ui.gap.value, 10);
      if (Number.isFinite(v)) { S.gapMs = Math.min(500, Math.max(0, v)); saveSettings(); updateTotal(); }
    });
    S.ui.lead.addEventListener('input', () => {
      const v = parseInt(S.ui.lead.value, 10);
      if (Number.isFinite(v)) { S.leadMs = Math.min(500, Math.max(-200, v)); saveSettings(); updateTotal(); }
    });
    S.ui.anchor.addEventListener('change', () => { S.anchor = S.ui.anchor.value; saveSettings(); updateTotal(); });
    S.ui.auto.addEventListener('change', () => { S.autoRearm = S.ui.auto.checked; saveSettings(); });

    S.ui.reset.addEventListener('click', resetRun);

    [S.ui.delay, S.ui.stop, S.ui.gap, S.ui.lead].forEach((inp) => {
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
      inp.addEventListener('change', () => inp.blur());
    });

    S.ui.min.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = S.ui.body.style.display === 'none';
      S.ui.body.style.display = hidden ? '' : 'none';
      S.ui.min.textContent = hidden ? '–' : '+';
    });

    let drag = null;
    S.ui.head.addEventListener('mousedown', (e) => {
      if (e.target === S.ui.min) return;
      const r = root.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const r = root.getBoundingClientRect();
      root.style.left  = Math.min(Math.max(e.clientX - drag.dx, 0), Math.max(0, innerWidth  - r.width)) + 'px';
      root.style.top   = Math.min(Math.max(e.clientY - drag.dy, 0), innerHeight - 30) + 'px';
      root.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { drag = null; });
  }

  /* ---------- وضعیت / لاگ ---------- */
  function refreshStatus() {
    if (!S.ui.status) return;
    if (S.phase === 'armed') {
      S.ui.dot.className = 'on';
      S.ui.status.textContent = 'آماده ✔ موس روی دکمهٔ «شروع» + کلید «' + keyLabel() + '»';
    } else if (S.phase === 'running') {
      S.ui.dot.className = 'run';
      S.ui.status.textContent = 'در حال اجرا… (دیباگر وصل است)';
    } else {
      S.ui.dot.className = '';
      S.ui.status.textContent = 'انجام شد — برای تلاش بعدی «ریست» را بزن';
    }
  }
  function updateTotal() {
    if (!S.ui.total) return;
    const eff = S.delayMs + S.stopSec * 1000
      - (S.anchor === 'release' ? S.gapMs : 0) - S.leadMs;
    S.ui.total.textContent = 'از press شروع تا press توقف: ~' + Math.round(eff) + 'ms';
  }
  function pushLog(text) {
    if (!S.ui.log) return;
    const div = document.createElement('div');
    div.textContent = text;
    S.ui.log.prepend(div);
    while (S.ui.log.children.length > 14) S.ui.log.lastChild.remove();
  }

  /* ---------- خواندن شمارندهٔ صفحه (قالب ۰۵:۰۰ — ارقام فارسی) ---------- */
  function findCounterCandidates() {
    const out = [];
    if (!document.body) return out;
    const seen = new Set();
    const visit = (rootNode, depth) => {
      if (!rootNode || depth > 6 || seen.has(rootNode)) return;
      seen.add(rootNode);
      try {
        const all = rootNode.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (depth === 0 && el.closest && el.closest('#' + ROOT_ID)) continue;
          const raw = (el.textContent || '').trim();
          if (raw.length < 3 || raw.length > 6) continue;
          const n = normNum(raw);
          if (!/^\d{1,2}\.\d{1,2}$/.test(n)) continue;
          if (!el.getClientRects().length) continue;
          el._dk5sr_v = n;
          out.push(el);
        }
        for (let i = 0; i < all.length; i++) {
          if (all[i].shadowRoot) visit(all[i].shadowRoot, depth + 1);
        }
      } catch (e) {}
    };
    visit(document.body, 0);
    return out;
  }
  function updateCounterEl() {
    const t = performance.now();
    if (t - S.lastScan < 350) return;
    S.lastScan = t;
    if (S.counterEl && !S.counterEl.isConnected) S.counterEl = null;
    const cands = findCounterCandidates();
    for (const el of cands) {
      const prev = counterSnap.get(el);
      if (prev !== undefined && prev !== el._dk5sr_v) { S.counterEl = el; break; }
    }
    for (const el of cands) counterSnap.set(el, el._dk5sr_v);
    if (!S.counterEl && cands.length && S.timing && (epochNow() - S.timing.t0Date) > 1200) S.counterEl = cands[0];
  }
  function readCounterTextFrom(el) {
    if (!el || !el.isConnected) return null;
    const m = normNum(el.textContent).match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!m) return null;
    return m[1] + '.' + (m[2] + '0').slice(0, 2);
  }

  /* ---------- ★ ردیابی دکمهٔ بازی در برابر اسکرول ---------- */
  function deepAt(x, y) {
    let el = document.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 20) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  function findStopButton() {
    /* ۱) همان عنصری که لحظهٔ K زیر موس بود */
    if (S.btnEl && S.btnEl.isConnected && S.btnEl.getClientRects().length) return S.btnEl;
    /* ۲) دکمهٔ بازی: کلاس پایدار __button + حالت __running یا متن «توقف» */
    let best = null, any = null;
    try {
      document.querySelectorAll('[class*="__button"]').forEach((el) => {
        if (!el.getClientRects().length) return;
        if (el.closest && el.closest('#' + ROOT_ID)) return;
        if (!any) any = el;
        const cls = typeof el.className === 'string' ? el.className : '';
        const txt = (el.textContent || '').trim();
        if (!best && (cls.indexOf('__running') !== -1 || txt.indexOf('توقف') !== -1)) best = el;
      });
    } catch (e) {}
    if (best) { S.btnEl = best; return best; }
    if (any)  { S.btnEl = any;  return any; }
    /* ۳) هر دکمهٔ مرئی با متن «توقف» */
    try {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        if (!el.getClientRects().length) continue;
        if ((el.textContent || '').indexOf('توقف') !== -1) { S.btnEl = el; return el; }
      }
    } catch (e) {}
    return null;
  }

  function pushCoords() {
    if (S.phase !== 'running' || !S.timing) return;
    const btn = findStopButton();
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    if (!r || r.width < 5 || r.height < 5) return;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      pushLog('⚠ دکمهٔ توقف از محدودهٔ دید خارج شده است — کلیک توقف ممکن است خطا بخورد!');
      return;
    }
    const x = Math.min(Math.max(r.left + r.width / 2, 2), innerWidth - 3);
    const y = Math.min(Math.max(r.top + r.height / 2, 2), innerHeight - 3);
    if (!S.coordLogged && (Math.abs(x - S.origX) > 5 || Math.abs(y - S.origY) > 5)) {
      pushLog('↳ دکمه جابه‌جا شد (' + (x - S.origX).toFixed(0) + '،' + (y - S.origY).toFixed(0) +
              'px) — مختصات کلیک توقف به‌روز شد ✔');
      S.coordLogged = true;
    }
    S.runX = x; S.runY = y;
    send({ type: 'dk5sr-coords', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }

  /* ---------- اجرا ---------- */
  function startRun() {
    loadSettings();
    S.runDelayMs = S.delayMs;   /* مقادیر لحظهٔ شروع */
    S.runStopSec = S.stopSec;
    S.phase = 'running';
    refreshStatus();
    S.timing = null; S.arrivedStart = false; S.arrivedStop = false; S.stopArrivalEpoch = null;
    S.counterEl = null; S.lastPageTxt = null; S.lastScan = 0;
    counterSnap = new Map();
    S.origX = S.mouseX; S.origY = S.mouseY;   /* مختصات dispatch شروع */
    S.runX = S.mouseX;  S.runY = S.mouseY;    /* مختصات dispatch توقف (به‌روز می‌شود) */
    S.btnEl = deepAt(S.mouseX, S.mouseY);     /* ★ عنصر دکمه برای ردیابی اسکرول */
    S.lastCoordsPush = 0; S.coordLogged = false;
    pushLog('▶ دستور اجرا ارسال شد — press شروع از CDP…');
    send({
      type: 'dk5sr-run',
      x: S.runX, y: S.runY,
      delayMs: S.delayMs,
      stopMs: Math.round(S.stopSec * 1000),
      gapMs: S.gapMs,
      anchor: S.anchor,
      leadMs: S.leadMs,
    });
    cancelAnimationFrame(S.rafId);
    const loop = () => {
      if (S.phase !== 'running') return;
      renderReadout();
      S.rafId = requestAnimationFrame(loop);
    };
    S.rafId = requestAnimationFrame(loop);
  }

  function renderReadout() {
    if (S.arrivedStop) return;   /* ★ فریز: بعد از رسیدن press توقف، دیگر شمرده نشود */

    /* ★ ردیابی زندهٔ دکمه در برابر اسکرول — هر ۲۵۰ms */
    const tNow = performance.now();
    if (tNow - S.lastCoordsPush > 250) {
      S.lastCoordsPush = tNow;
      pushCoords();
    }

    if (!S.timing) {
      S.ui.big.textContent = '…';
      S.ui.sub.textContent = 'در حال اتصال دیباگر و dispatch شروع…';
    } else {
      const pressDate = S.timing.tTargetDate - (S.timing.anchor === 'release' ? S.timing.gapMs : 0);
      const est  = (Date.now() - S.timing.t0Date - S.runDelayMs) / 1000;
      const left = (pressDate - Date.now()) / 1000;
      if (est < 0) {
        S.ui.big.textContent = '0.00';
        S.ui.sub.textContent = 'در انتظار پایانِ تأخیر ' + S.runDelayMs + 'ms…';
      } else {
        S.ui.big.textContent = Math.max(0, est).toFixed(2);
        S.ui.sub.textContent = 'press توقف تا ' + Math.max(0, left).toFixed(2) + ' ثانیه دیگر';
      }
    }
    S.ui.big.classList.add('run');
    updateCounterEl();
    const txt = readCounterTextFrom(S.counterEl);
    if (txt != null) S.lastPageTxt = txt;
    S.ui.page.textContent = 'شمارندهٔ صفحه: ' + (S.lastPageTxt != null ? S.lastPageTxt : '—');
  }

  function finishRun() {
    cancelAnimationFrame(S.rafId);
    S.phase = 'done';
    refreshStatus();
    S.ui.big.classList.remove('run');
    S.ui.sub.textContent = 'پایان';

    /* عدد داخلی در «لحظهٔ واقعیِ» رسیدن press توقف (نه ۱۵۰ms بعدش) */
    const estAtStop = (S.arrivedStop && S.stopArrivalEpoch && S.timing)
      ? (S.stopArrivalEpoch - S.timing.t0Date - S.runDelayMs) / 1000
      : null;
    if (estAtStop != null) S.ui.big.textContent = estAtStop.toFixed(2);

    /* عدد نهایی بازی (فریزشده) */
    const gameTxt = readCounterTextFrom(S.counterEl) || S.lastPageTxt;

    let line = '■ پایان | داخلی در لحظهٔ توقف: ' + (estAtStop != null ? estAtStop.toFixed(2) + 's' : '—');
    if (gameTxt != null) {
      line += ' | بازی: ' + gameTxt;
      const g = parseFloat(gameTxt);
      if (Number.isFinite(g)) {
        const err = 5.00 - g;   /* مثبت = زودتر از ۵ ثانیه ایستادیم */
        const sug = String(parseFloat((S.runStopSec + err).toFixed(3)));
        line += ' | خطا: ' + (err >= 0 ? '+' : '') + err.toFixed(2) +
                's → «زمان توقف» را ' + sug + ' بگذار';
      }
    }
    pushLog(line);

    /* ★ آیا بازی واقعاً متوقف شد؟ (اگر کلیک توقف نخورده باشد، شمارنده هنوز می‌شمارد) */
    const c1 = readCounterTextFrom(S.counterEl);
    setTimeout(() => {
      if (S.phase === 'running') return;   /* اجرای جدیدی شروع شده */
      const c2 = readCounterTextFrom(S.counterEl);
      if (c1 != null && c2 != null && c1 !== c2) {
        pushLog('⚠ شمارندهٔ بازی هنوز حرکت می‌کند — کلیک توقف به دکمه نخورده!');
      }
    }, 450);

    if (S.autoRearm) {
      S.phase = 'armed';
      refreshStatus();
      S.ui.big.textContent = '—';
      S.ui.sub.textContent = '';
      pushLog('✔ آمادهٔ تلاش بعدی');
    }
  }

  function resetRun() {
    const wasRunning = (S.phase === 'running');
    cancelAnimationFrame(S.rafId);
    send({ type: 'dk5sr-cancel' });
    S.phase = 'armed';
    S.timing = null; S.arrivedStart = false; S.arrivedStop = false; S.stopArrivalEpoch = null;
    S.counterEl = null; S.lastPageTxt = null;
    S.btnEl = null; S.lastCoordsPush = 0; S.coordLogged = false;
    counterSnap = new Map();
    S.ui.big.textContent = '—';
    S.ui.big.classList.remove('run');
    S.ui.sub.textContent = '';
    S.ui.page.textContent = 'شمارندهٔ صفحه: —';
    refreshStatus();
    if (S.ui.reset) S.ui.reset.blur();
    pushLog(wasRunning ? '⟳ اجرا لغو و ریست شد' : '⟳ ریست شد — آمادهٔ کلید «' + keyLabel() + '»');
  }

  /* ---------- پیام‌های background ---------- */
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'dk5sr-log')    { pushLog(msg.text); return; }
    if (msg.type === 'dk5sr-timing') {
      S.timing = msg;
      /* ★ دو به‌روزرسانی نهایی مختصات، درست قبل از لحظهٔ توقف */
      const pressDate = msg.tTargetDate - (msg.anchor === 'release' ? msg.gapMs : 0);
      [180, 60].forEach((before) => {
        const wait = pressDate - before - epochNow();
        setTimeout(pushCoords, Math.max(0, wait));
      });
      return;
    }
    if (msg.type === 'dk5sr-done')   { if (S.phase === 'running') finishRun(); return; }
    if (msg.type === 'dk5sr-cancelled') {
      S.phase = 'armed'; refreshStatus();
      S.ui.big.textContent = '—'; S.ui.sub.textContent = '';
      return;
    }
  });

  /* ---------- اندازه‌گیری «واقعیِ» رسیدن رویدادها + فریز در لحظهٔ توقف ---------- */
  window.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || S.phase !== 'running' || !S.timing) return;
    const arrival = epochNow();
    const mid = S.timing.t0Date + (S.timing.tTargetDate - S.timing.t0Date) / 2;
    if (arrival < mid) {
      /* press شروع — با مختصات اولیه dispatch شده */
      if (Math.abs(e.clientX - S.origX) > 3 || Math.abs(e.clientY - S.origY) > 3) return;
      if (!S.arrivedStart) {
        S.arrivedStart = true;
        pushLog('↳ press شروع، ' + (arrival - S.timing.t0Date).toFixed(1) + 'ms بعد از dispatch به صفحه رسید');
      }
    } else {
      /* press توقف — با آخرین مختصات به‌روز dispatch شده */
      if (Math.abs(e.clientX - S.runX) > 3 || Math.abs(e.clientY - S.runY) > 3) return;
      if (!S.arrivedStop) {
        S.arrivedStop = true;
        S.stopArrivalEpoch = arrival;
        const pressDate = S.timing.tTargetDate - (S.timing.anchor === 'release' ? S.timing.gapMs : 0);
        const off = arrival - pressDate;
        let tip = ' ✔';
        if (off > 1.5)       tip = ' — «پیش‌ارسال CDP» را +' + Math.round(off) + ' کن';
        else if (off < -1.5) tip = ' — «پیش‌ارسال CDP» را ' + Math.round(off) + ' کن';
        pushLog('↳ press توقف ' + (off >= 0 ? '+' : '') + off.toFixed(1) + 'ms نسبت به هدف رسید' + tip);
      }
    }
  }, true);

  /* ---------- شنوندگان سراسری ---------- */
  window.addEventListener('mousemove', (e) => {
    S.mouseX = e.clientX; S.mouseY = e.clientY;
  }, { capture: true, passive: true });

  window.addEventListener('keydown', (e) => {
    if (!S.active || !S.bootstrapped) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.repeat) return;

    /* T = کلیک تستی */
    if (e.code === 'KeyT' && S.hotkey !== 'KeyT') {
      e.preventDefault();
      if (S.phase === 'running') { pushLog('⏳ اجرا در جریان است.'); return; }
      if (S.mouseX == null) { pushLog('⚠ موس را حرکت بده.'); return; }
      pushLog('🧪 ارسال کلیک تستی (trusted)…');
      send({ type: 'dk5sr-test', x: S.mouseX, y: S.mouseY, gapMs: S.gapMs });
      return;
    }

    if (e.code !== S.hotkey) return;
    if (S.phase === 'running') { pushLog('⏳ اجرا در جریان است (لغو: «ریست»).'); return; }
    if (S.phase === 'done')   { pushLog('اول «ریست» را بزن.'); return; }
    if (S.mouseX == null) { pushLog('⚠ موس را حرکت بده.'); return; }
    const over = document.elementFromPoint(S.mouseX, S.mouseY);
    if (!over || (over.closest && over.closest('#' + ROOT_ID))) {
      pushLog('⚠ موس روی دکمهٔ بازی نیست (روی پنل؟).');
      return;
    }
    e.preventDefault();
    startRun();
  }, true);

  /* ---------- فعال/غیرفعال روی صفحهٔ بازی ---------- */
  function tick() {
    S.active = GAME_RE.test(location.href);
    if (S.ui.root) S.ui.root.style.display = S.active ? '' : 'none';
    if (S.active && !S.bootstrapped) {
      S.bootstrapped = true;
      buildPanel();
      refreshStatus();
      updateTotal();
      pushLog('نسخهٔ ۲.۰ فعال شد ✔ (کلیک trusted + ردیابی اسکرول). با T تست کن.');
    }
  }
  tick();
  setInterval(tick, 700);
})();