/* content.js — نسخهٔ ۳.۰
   ⚡ حالت B (پیکسلی): تصویر زندهٔ همین تب → crop چسبیده به canvas تایمر (…__digits 424×83)
      → اولین تغییر پیکسل = شمارش بازی شروع شده → شمارش داخلی از همین لحظه.
   🔗 اتصال پایدار دیباگر + بنر CDP فقط یک‌بار (هنگام فعال‌سازی دیده‌بان).
   🎯 مختصات دکمهٔ توقف زنده ردیابی می‌شود (مصون از اسکرول).
   + حالت DOM (اگر روزی متن شمارنده وجود داشت) و حالت باز (تأخیر ثابت) به‌عنوان پشتیبان.
*/

(() => {
  'use strict';
  if (window.self !== window.top) return;

  const LS_KEY  = 'dk_5sr_cdp_settings_v2';
  const ROOT_ID = 'dk5sr-root';
  const GAME_RE = /five-second-rush/i;

  const QUIET_MS  = 2000;   /* بعد از تزریق کلیک شروع، این‌قدر صبر کن (ریست 00:00 و اسکرول آرام بگیرد) */
  const PX_THRESH = 80.0;  /* آستانهٔ میانگین اختلاف پیکسل (0-255) برای «حرکت» */
  const EST_PAUSE = 160;  /* حدسِ مکث تصادفی بازی برای توقف اضطراری */
  const PX_W = 64, PX_H = 12; /* ابعاد crop کوچک‌شده برای مقایسه */

  const S = {
    active: false, bootstrapped: false,
    phase: 'armed',                 /* armed | running | done */
    hotkey: 'KeyK',
    syncMethod: 'pixel',            /* pixel | dom | off */
    syncComp: 20,                   /* جبران تأخیر تریگر (ms) */
    delayMs: 80, stopSec: 5.00, gapMs: 90,
    anchor: 'press', leadMs: 0, autoRearm: false,
    mouseX: null, mouseY: null,
    origX: 0, origY: 0, runX: 0, runY: 0,
    runDelayMs: 80, runStopSec: 5.00, syncRunning: false,
    btnEl: null, lastCoordsPush: 0, coordLogged: false,
    timing: null, arrivedStart: false, arrivedStop: false,
    stopArrivalEpoch: null, stopArrivalDate: null,
    gameStartEpoch: null, stopAtEpoch: null, domWatch: null,
    counterEl: null, lastScan: 0, lastPageTxt: null,
    rafId: 0,
    ui: {},
  };
  let counterSnap = new Map();

  /* ================= دیده‌بان پیکسلی (Mode B) ================= */
  const PX = {
    stream: null, video: null, canvas: null, ctx: null, el: null,
    base: null, phase: 'idle', loop: false, tInject: 0,
    onMotion: null, onFail: null, guard: 0,
  };

  function pxActive() { return !!(PX.stream && PX.stream.active && PX.video); }

  /* canvas تایمر بازی: کلاس __digits یا ابعاد 424×83 */
  function findDigitsCanvas() {
    let best = null;
    try {
      const list = document.querySelectorAll('canvas');
      for (const el of list) {
        if (!el.getClientRects().length) continue;
        if (el.closest && el.closest('#' + ROOT_ID)) continue;
        const cls = typeof el.className === 'string' ? el.className : '';
        const r = el.getBoundingClientRect();
        let score = 0;
        if (cls.indexOf('__digits') !== -1) score += 100;
        if (+el.getAttribute('width') === 424 && +el.getAttribute('height') === 83) score += 50;
        score += Math.min(20, r.width / 24);
        if (!best || score > best.score) best = { el, score };
      }
    } catch (e) {}
    return best && best.score >= 50 ? best.el : null;
  }

  async function ensureStream() {
    if (pxActive()) return true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: { ideal: 60, max: 60 } },
        audio: false,
        preferCurrentTab: true,      /* همین تب از قبل انتخاب شده است */
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'exclude',
        systemAudio: 'exclude',
      });
      PX.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (track) track.addEventListener('ended', () => {
        PX.stream = null; PX.video = null; PX.canvas = null; PX.ctx = null; PX.base = null;
        updateWatcherUI();
        pushLog('⚠ اشتراک صفحه قطع شد — دیده‌بان غیرفعال. (دکمهٔ 🎥 یا K بعدی)');
      });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;';
      (document.body || document.documentElement).appendChild(video);
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* پخش زنده معمولاً بدون ژست مجاز است */ }
      PX.video = video;
      PX.canvas = document.createElement('canvas');
      PX.canvas.width = PX_W; PX.canvas.height = PX_H;
      PX.ctx = PX.canvas.getContext('2d', { willReadFrequently: true });
      updateWatcherUI();
      return true;
    } catch (e) {
      pushLog('⚠ گرفتن تصویر صفحه ناموفق: ' + (e && e.message ? e.message : e));
      return false;
    }
  }

  /* crop چسبیده به عنصر — در هر فریم rect تازه خوانده می‌شود (مصون از اسکرول) */
  function grabCrop() {
    let el = PX.el;
    if (!el || !el.isConnected) { el = findDigitsCanvas(); PX.el = el; }
    if (!el || !PX.video || !PX.video.videoWidth) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return null;
    const sx = PX.video.videoWidth / innerWidth;
    const sy = PX.video.videoHeight / innerHeight;
    const x = Math.max(0, Math.floor(r.left * sx));
    const y = Math.max(0, Math.floor(r.top * sy));
    const w = Math.min(PX.video.videoWidth - x, Math.ceil(r.width * sx));
    const h = Math.min(PX.video.videoHeight - y, Math.ceil(r.height * sy));
    if (w < 4 || h < 4) return null;
    PX.ctx.drawImage(PX.video, x, y, w, h, 0, 0, PX_W, PX_H);
    return PX.ctx.getImageData(0, 0, PX_W, PX_H).data;
  }

  function diffMean(a, b) {
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      n += 3;
    }
    return sum / n;
  }

  function pxTick() {
    if (!PX.loop) return;
    const now = Date.now();
    const crop = grabCrop();
    if (crop) {
      if (PX.phase === 'quiet') {
        if (now >= PX.tInject + QUIET_MS) { PX.base = crop; PX.phase = 'watch'; }
      } else if (PX.phase === 'watch' && PX.base) {
        if (diffMean(crop, PX.base) > PX_THRESH) {
          PX.phase = 'triggered';
          stopPxLoop();
          const cb = PX.onMotion; PX.onMotion = null; PX.onFail = null;
          if (cb) cb(now);
          return;
        }
      }
    }
    const v = PX.video;
    if (v && v.requestVideoFrameCallback) v.requestVideoFrameCallback(pxTick);
    else requestAnimationFrame(pxTick);
  }

  function startPxLoop(tInject, onMotion, onFail) {
    if (!pxActive()) { onFail('دیده‌بان پیکسلی فعال نیست'); return; }
    PX.tInject = tInject; PX.phase = 'quiet'; PX.base = null; PX.el = null;
    PX.onMotion = onMotion; PX.onFail = onFail;
    PX.loop = true;
    pxTick();
    clearTimeout(PX.guard);
    PX.guard = setTimeout(() => {
      if (PX.phase === 'quiet' || PX.phase === 'watch') {
        const cb = PX.onFail; PX.onFail = null; PX.onMotion = null;
        stopPxLoop();
        if (cb) cb('تا ۴ ثانیه حرکتی در تایمر دیده نشد');
      }
    }, 4000);
  }

  function stopPxLoop() {
    PX.loop = false; PX.phase = 'idle';
    clearTimeout(PX.guard);
  }

  function warnPanelOverlap() {
    const c = findDigitsCanvas(), p = S.ui.root;
    if (!c || !p) return;
    const a = c.getBoundingClientRect(), b = p.getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    if (ix > 4 && iy > 4) pushLog('⚠ پنل روی ناحیهٔ تایمر افتاده — آن را جابه‌جا کن وگرنه تشخیص پیکسلی کار نمی‌کند!');
  }

  async function toggleWatcher() {
    if (S.phase === 'running') { pushLog('⏳ حین اجرا نمی‌شود — اول ریست.'); return; }
    if (pxActive()) {
      try { PX.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      if (PX.video) { try { PX.video.remove(); } catch (e) {} }
      PX.stream = null; PX.video = null; PX.canvas = null; PX.ctx = null; PX.base = null;
      updateWatcherUI();
      pushLog('🎥 دیده‌بان خاموش شد.');
      return;
    }
    if (S.ui.watchbtn) S.ui.watchbtn.disabled = true;
    const ok = await ensureStream();
    if (S.ui.watchbtn) S.ui.watchbtn.disabled = false;
    if (ok) {
      send({ type: 'dk5sr-attach' }); /* بنر همین حالا بیاید، نه وسط اجرا */
      pushLog('🎥 دیده‌بان فعال ✔ — اشتراک صفحه برقرار و دیباگر وصل شد (بنر زرد فقط همین یک‌بار می‌آید).');
    }
    updateWatcherUI();
  }

  function updateWatcherUI() {
    if (!S.ui.watchstat) return;
    const on = pxActive();
    if (S.ui.watchbtn) S.ui.watchbtn.textContent = on ? '⏹ خاموش‌کردن دیده‌بان' : '🎥 فعال‌سازی دیده‌بان صفحه';
    S.ui.watchstat.textContent = on
      ? (S.syncMethod !== 'off' ? 'فعال ✔ (اشتراک صفحه جریان دارد)' : 'فعال — ولی روش همگام‌سازی خاموش است')
      : (S.syncMethod === 'pixel' ? 'غیرفعال — با اولین K هم فعال می‌شود (یک‌بار Share بزن)' : 'غیرفعال');
  }

  /* ---------- تنظیمات ذخیره‌شده ---------- */
  function loadSettings() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {};
      if (c.hotkey) S.hotkey = String(c.hotkey);
      if (c.delayMs != null && Number.isFinite(+c.delayMs)) S.delayMs = Math.min(2000, Math.max(0, Math.round(+c.delayMs)));
      if (c.stopSec != null && Number.isFinite(+c.stopSec)) S.stopSec = Math.min(10, Math.max(0.1, +c.stopSec));
      if (c.gapMs   != null && Number.isFinite(+c.gapMs))   S.gapMs   = Math.min(500, Math.max(0, Math.round(+c.gapMs)));
      if (c.leadMs  != null && Number.isFinite(+c.leadMs))  S.leadMs  = Math.min(500, Math.max(-200, Math.round(+c.leadMs)));
      if (c.syncComp != null && Number.isFinite(+c.syncComp)) S.syncComp = Math.min(300, Math.max(0, Math.round(+c.syncComp)));
      if (['pixel', 'dom', 'off'].includes(c.syncMethod)) S.syncMethod = c.syncMethod;
      if (c.anchor === 'release' || c.anchor === 'press') S.anchor = c.anchor;
      if (typeof c.autoRearm === 'boolean') S.autoRearm = c.autoRearm;
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        hotkey: S.hotkey, delayMs: S.delayMs, stopSec: S.stopSec, gapMs: S.gapMs,
        anchor: S.anchor, leadMs: S.leadMs, syncMethod: S.syncMethod, syncComp: S.syncComp,
        autoRearm: S.autoRearm,
      }));
    } catch (e) {}
  }
  loadSettings();

  /* ---------- ابزارها ---------- */
  function normNum(s) {
    s = String(s == null ? '' : s).trim();
    const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
    return s
      .replace(/[۰-۹]/g, (d) => fa.indexOf(d))
      .replace(/[٠-٩]/g, (d) => ar.indexOf(d))
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
        background:#141822;border:1px solid #2b3344;border-radius:12px;width:250px;
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
      #dk5sr-watch{margin:7px 0}
      #dk5sr-watchbtn{display:block;width:100%;padding:7px;background:#1f2740;border:1px solid #33406b;color:#bcd0ff;border-radius:9px;cursor:pointer;font-size:11.5px;font-weight:700}
      #dk5sr-watchbtn:hover{background:#26304f}
      #dk5sr-watchbtn:disabled{opacity:.5;cursor:wait}
      #dk5sr-watchstat{font-size:10px;color:#7d8798;margin-top:4px;text-align:center;min-height:13px}
      #dk5sr-root .dk5sr-row{display:flex;align-items:center;gap:6px;margin:6px 0}
      #dk5sr-root .dk5sr-row label{flex:1;font-size:11px;color:#c3cad8}
      #dk5sr-root .dk5sr-row input,#dk5sr-root .dk5sr-row select{width:82px;flex:none;background:#0d1017;color:#e8eaf0;border:1px solid #2b3344;border-radius:7px;padding:4px 4px;font-size:12px;text-align:center;direction:ltr}
      #dk5sr-root .dk5sr-row input:focus,#dk5sr-root .dk5sr-row select:focus{outline:none;border-color:#4c8bf5}
      #dk5sr-root .dk5sr-row input:disabled{opacity:.4}
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
      <span id="dk5sr-title">⏱ دستیار ۵ ثانیه (CDP v3)</span>
      <button id="dk5sr-min" title="جمع‌کردن پنل">–</button>
    </div>
    <div id="dk5sr-body">
      <div id="dk5sr-status"></div>
      <div id="dk5sr-readout"><div id="dk5sr-big">—</div><div id="dk5sr-sub"></div></div>
      <div id="dk5sr-pagecounter">شمارندهٔ صفحه: —</div>
      <div id="dk5sr-watch">
        <button id="dk5sr-watchbtn">🎥 فعال‌سازی دیده‌بان صفحه</button>
        <div id="dk5sr-watchstat">غیرفعال</div>
      </div>
      <div class="dk5sr-row"><label>کلید میان‌بر (تایپ کن)</label><input id="dk5sr-key" readonly></div>
      <div class="dk5sr-row"><label>روش همگام‌سازی شروع</label>
        <select id="dk5sr-method">
          <option value="pixel">پیکسل (پیشنهادی)</option>
          <option value="dom">DOM (در صورت وجود متن)</option>
          <option value="off">خاموش (تأخیر ثابت)</option>
        </select>
      </div>
      <div class="dk5sr-row"><label>جبران تأخیر تریگر (ms)</label><input id="dk5sr-comp" type="number" step="1" min="0" max="300"></div>
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
      <div id="dk5sr-help">روش «پیکسل» با دیدن اولین حرکتِ canvas تایمر بازی، شمارش را شروع می‌کند —
        مکث تصادفی شروعِ بازی دیگر اهمیتی ندارد. اول یک‌بار دیده‌بان را با 🎥 (یا اولین K)
        فعال کن و در کادر Share همین تب را تأیید کن. پنل را روی تایمر نگذار.</div>
    </div>`;
    (document.body || document.documentElement).appendChild(root);

    const q = (sel) => root.querySelector(sel);
    S.ui = {
      root,
      head: q('#dk5sr-head'), dot: q('#dk5sr-dot'), min: q('#dk5sr-min'),
      body: q('#dk5sr-body'), status: q('#dk5sr-status'),
      big: q('#dk5sr-big'), sub: q('#dk5sr-sub'), page: q('#dk5sr-pagecounter'),
      watchbtn: q('#dk5sr-watchbtn'), watchstat: q('#dk5sr-watchstat'),
      key: q('#dk5sr-key'), method: q('#dk5sr-method'), comp: q('#dk5sr-comp'),
      delay: q('#dk5sr-delay'), stop: q('#dk5sr-stop'),
      gap: q('#dk5sr-gap'), anchor: q('#dk5sr-anchor'), lead: q('#dk5sr-lead'),
      auto: q('#dk5sr-auto'), total: q('#dk5sr-total'), reset: q('#dk5sr-reset'), log: q('#dk5sr-log'),
    };

    S.ui.key.value = keyLabel();
    S.ui.method.value = S.syncMethod;
    S.ui.comp.value = String(S.syncComp);
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

    S.ui.method.addEventListener('change', () => { S.syncMethod = S.ui.method.value; saveSettings(); syncDependentUI(); });
    S.ui.comp.addEventListener('input', () => {
      const v = parseInt(S.ui.comp.value, 10);
      if (Number.isFinite(v)) { S.syncComp = Math.min(300, Math.max(0, v)); saveSettings(); updateTotal(); }
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
    S.ui.watchbtn.addEventListener('click', toggleWatcher);
    S.ui.reset.addEventListener('click', resetRun);

    [S.ui.comp, S.ui.delay, S.ui.stop, S.ui.gap, S.ui.lead].forEach((inp) => {
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

    syncDependentUI();
    updateWatcherUI();
  }

  function syncDependentUI() {
    if (!S.ui.delay) return;
    const sync = S.syncMethod !== 'off';
    S.ui.delay.disabled = sync;   /* در حالت همگام، تأخیر بی‌معناست */
    S.ui.comp.disabled = !sync;
    updateTotal();
  }

  /* ---------- وضعیت / لاگ ---------- */
  function refreshStatus() {
    if (!S.ui.status) return;
    if (S.phase === 'armed') {
      S.ui.dot.className = 'on';
      S.ui.status.textContent = 'آماده ✔ موس روی دکمهٔ «شروع» + کلید «' + keyLabel() + '»';
    } else if (S.phase === 'running') {
      S.ui.dot.className = 'run';
      S.ui.status.textContent = 'در حال اجرا…';
    } else {
      S.ui.dot.className = '';
      S.ui.status.textContent = 'انجام شد — برای تلاش بعدی «ریست» را بزن';
    }
  }
  function updateTotal() {
    if (!S.ui.total) return;
    if (S.syncMethod !== 'off') {
      S.ui.total.textContent = 'اولین حرکت تایمر ← ' + S.stopSec.toFixed(2) + 's − جبران ' + S.syncComp + 'ms ← press توقف';
    } else {
      const eff = S.delayMs + S.stopSec * 1000 - (S.anchor === 'release' ? S.gapMs : 0) - S.leadMs;
      S.ui.total.textContent = 'از press شروع تا press توقف: ~' + Math.round(eff) + 'ms';
    }
  }
  function pushLog(text) {
    if (!S.ui.log) return;
    const div = document.createElement('div');
    div.textContent = text;
    S.ui.log.prepend(div);
    while (S.ui.log.children.length > 14) S.ui.log.lastChild.remove();
  }

  /* ---------- خواندن شمارندهٔ متنی (برای حالت DOM و نمایش) ---------- */
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
  function findTimerEl() {
    const cands = findCounterCandidates();
    if (!cands.length) return null;
    return cands.find((el) => el._dk5sr_v === '00.00')
        || cands.find((el) => /^0\d\./.test(el._dk5sr_v))
        || cands[0];
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

  /* ---------- ردیابی دکمهٔ بازی در برابر اسکرول ---------- */
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
    if (S.btnEl && S.btnEl.isConnected && S.btnEl.getClientRects().length) return S.btnEl;
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
      pushLog('⚠ دکمهٔ توقف از محدودهٔ دید خارج شده است!');
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

  /* ---------- حالت DOM: تماشای متن شمارنده (پشتیبان) ---------- */
  function armDomTrigger(tInject, onStart, onFail) {
    let el = findTimerEl();
    if (!el) { onFail('عنصر متنی شمارنده پیدا نشد'); return null; }
    const getVal = (node) => {
      const m = normNum((node && node.textContent) || '').trim().match(/^(\d{1,2})\.(\d{1,2})$/);
      return m ? m[1] + '.' + (m[2] + '0').slice(0, 2) : null;
    };
    let baseVal = getVal(el);
    if (baseVal == null) { onFail('متن شمارنده خوانا نیست'); return null; }
    let done = false, mo = null, raf = 0, guard = 0;
    const quietUntil = tInject + QUIET_MS;
    const cleanup = () => { if (mo) mo.disconnect(); cancelAnimationFrame(raf); clearTimeout(guard); };
    const check = () => {
      if (done) return;
      if (!el.isConnected) {
        const nel = findTimerEl();
        if (!nel) return;
        el = nel;
        if (mo) { mo.disconnect(); mo = null; }
      }
      if (!mo) { mo = new MutationObserver(check); mo.observe(el, { characterData: true, childList: true, subtree: true }); }
      const now = Date.now();
      const v = getVal(el);
      if (v == null) return;
      if (now < quietUntil) { baseVal = v; return; } /* ریستِ 00:00 را نادیده بگیر */
      if (v !== baseVal) { done = true; cleanup(); onStart(now); return; }
      baseVal = v;
    };
    mo = new MutationObserver(check);
    mo.observe(el, { characterData: true, childList: true, subtree: true });
    const loop = () => { if (!done) { check(); raf = requestAnimationFrame(loop); } };
    raf = requestAnimationFrame(loop);
    guard = setTimeout(() => { if (!done) { done = true; cleanup(); onFail('تا ۴ ثانیه تغییری در متن شمارنده ندیدم'); } }, 4000);
    pushLog('👁 لنگر DOM: «' + baseVal + '»');
    return { abort() { done = true; cleanup(); } };
  }

  /* ---------- تریگر مشترک: اولین حرکت دیدم ---------- */
  function onTrigger(triggerEpoch) {
    if (S.phase !== 'running') return;
    S.gameStartEpoch = triggerEpoch;
    let stopAt = triggerEpoch + S.runStopSec * 1000 - S.syncComp - S.leadMs;
    if (S.anchor === 'release') stopAt -= S.gapMs;
    S.stopAtEpoch = stopAt;
    if (S.timing) S.timing.tTargetDate = stopAt + (S.anchor === 'release' ? S.gapMs : 0);
    pushLog('⚡ تریگر! اولین حرکت تایمر ثبت شد — press توقف ' + Math.max(0, stopAt - Date.now()) + 'ms دیگر');
    send({ type: 'dk5sr-arm-stop', stopAtEpoch: stopAt });
    [180, 60].forEach((before) => setTimeout(pushCoords, Math.max(0, stopAt - before - Date.now())));
  }

  /* شکست همگام‌سازی: توقف اضطراری با حدسِ مکث (بهتر از دورریزِ شانس) */
  function onSyncFail(reason) {
    if (S.phase !== 'running') return;
    if (S.timing) {
      const estStop = S.timing.t0Date + EST_PAUSE + S.runStopSec * 1000 - S.syncComp - S.leadMs
                    - (S.anchor === 'release' ? S.gapMs : 0);
      pushLog('⚠ همگام‌سازی ناموفق (' + reason + ') — توقف اضطراری با حدسِ ' + EST_PAUSE + 'ms مکث!');
      send({ type: 'dk5sr-arm-stop', stopAtEpoch: estStop });
      [180, 60].forEach((b) => setTimeout(pushCoords, Math.max(0, estStop - b - Date.now())));
    } else {
      pushLog('⚠ همگام‌سازی ناموفق (' + reason + ') — اجرا لغو شد.');
      send({ type: 'dk5sr-cancel' });
      S.phase = 'armed'; refreshStatus();
      S.ui.big.textContent = '—'; S.ui.sub.textContent = '';
    }
  }

  /* ---------- اجرا ---------- */
  async function startRun() {
    loadSettings();
    S.runDelayMs = S.delayMs;
    S.runStopSec = S.stopSec;
    S.phase = 'running';
    refreshStatus();
    S.timing = null; S.arrivedStart = false; S.arrivedStop = false;
    S.stopArrivalEpoch = null; S.stopArrivalDate = null;
    S.counterEl = null; S.lastPageTxt = null; S.lastScan = 0;
    counterSnap = new Map();
    S.origX = S.mouseX; S.origY = S.mouseY;
    S.runX = S.mouseX;  S.runY = S.mouseY;
    S.btnEl = deepAt(S.mouseX, S.mouseY);
    S.lastCoordsPush = 0; S.coordLogged = false;
    S.gameStartEpoch = null; S.stopAtEpoch = null;

    /* تعیین روش همگام‌سازی + fallback ها */
    let method = S.syncMethod;
    if (method === 'dom' && !findTimerEl()) {
      pushLog('ℹ عنصر متنی شمارنده پیدا نشد (تایمر canvas است) — روش پیکسل امتحان می‌شود.');
      method = 'pixel';
    }
    if (method === 'pixel') {
      if (!pxActive()) {
        S.ui.big.textContent = '…';
        S.ui.sub.textContent = 'در انتظار تأیید اشتراک صفحه (Share)…';
        pushLog('🎥 درخواست تصویر صفحه… در کادر بازشده، همین تب (از قبل انتخاب شده) را Share کن.');
        const ok = await ensureStream();
        if (!ok) {
          if (findTimerEl()) { method = 'dom'; pushLog('↩ Share لغو شد — روش DOM امتحان می‌شود.'); }
          else { method = 'off'; pushLog('↩ Share لغو شد — حالت باز (تأخیر ثابت) اجرا می‌شود.'); }
        }
      }
      if (method === 'pixel') {
        if (!findDigitsCanvas()) {
          pushLog('⚠ canvas تایمر (…__digits 424×83) پیدا نشد — حالت باز اجرا می‌شود.');
          method = 'off';
        } else {
          warnPanelOverlap();
        }
      }
    }
    S.syncRunning = (method !== 'off');

    /* مختصات press شروع: مرکز زندهٔ دکمه (مقاوم به شیفت بنر/اسکرول) */
    let sx = S.mouseX, sy = S.mouseY;
    const btn = findStopButton();
    if (btn) {
      const r = btn.getBoundingClientRect();
      if (r.width > 5 && r.height > 5) { sx = r.left + r.width / 2; sy = r.top + r.height / 2; }
      S.btnEl = btn;
    }
    S.origX = sx; S.origY = sy;
    S.runX = sx;  S.runY = sy;

    const tSend = Date.now();
    pushLog(method === 'off'
      ? '▶ حالت باز: press شروع از CDP…'
      : '▶ حالت همگام (' + (method === 'pixel' ? 'پیکسل' : 'DOM') + '): press شروع از CDP…');

    send({
      type: 'dk5sr-run',
      sync: method !== 'off',
      x: sx, y: sy,
      delayMs: method === 'off' ? S.delayMs : 0,
      stopMs: Math.round(S.stopSec * 1000),
      gapMs: S.gapMs,
      anchor: S.anchor,
      leadMs: S.leadMs,
    });

    if (method === 'pixel') {
      startPxLoop(tSend, onTrigger, onSyncFail);
    } else if (method === 'dom') {
      S.domWatch = armDomTrigger(tSend, onTrigger, onSyncFail);
    }

    cancelAnimationFrame(S.rafId);
    const loop = () => {
      if (S.phase !== 'running') return;
      renderReadout();
      S.rafId = requestAnimationFrame(loop);
    };
    S.rafId = requestAnimationFrame(loop);
  }

  function renderReadout() {
    if (S.arrivedStop) return;

    const tNow = performance.now();
    if (tNow - S.lastCoordsPush > 250) { S.lastCoordsPush = tNow; pushCoords(); }

    if (S.gameStartEpoch != null) {
      /* ⚡ حالت همگام: شمارش از اولین حرکتِ تایمر */
      const est  = (Date.now() - S.gameStartEpoch - S.syncComp) / 1000;
      const left = (S.stopAtEpoch - Date.now()) / 1000;
      S.ui.big.textContent = Math.max(0, est).toFixed(2);
      S.ui.sub.textContent = left > 0 ? 'press توقف تا ' + Math.max(0, left).toFixed(2) + ' ثانیه دیگر' : 'توقف…';
    } else if (S.syncRunning) {
      S.ui.big.textContent = '…';
      S.ui.sub.textContent = 'در انتظار اولین حرکت تایمر بازی…';
    } else if (!S.timing) {
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
    S.ui.page.textContent = 'شمارندهٔ صفحه: ' + (S.lastPageTxt != null ? S.lastPageTxt : '— (canvas)');
  }

  function finishRun() {
    cancelAnimationFrame(S.rafId);
    stopPxLoop();
    S.phase = 'done';
    refreshStatus();
    S.ui.big.classList.remove('run');
    S.ui.sub.textContent = 'پایان';

    const estAtStop = (S.syncRunning && S.gameStartEpoch != null && S.stopArrivalDate != null)
      ? (S.stopArrivalDate - S.gameStartEpoch - S.syncComp) / 1000
      : (S.arrivedStop && S.stopArrivalEpoch && S.timing)
        ? (S.stopArrivalEpoch - S.timing.t0Date - S.runDelayMs) / 1000
        : null;
    if (estAtStop != null) S.ui.big.textContent = estAtStop.toFixed(2);

    const gameTxt = readCounterTextFrom(S.counterEl) || S.lastPageTxt;
    let line = '■ پایان | داخلی در لحظهٔ توقف: ' + (estAtStop != null ? estAtStop.toFixed(2) + 's' : '—');
    if (gameTxt != null) {
      line += ' | بازی: ' + gameTxt;
      const g = parseFloat(gameTxt);
      if (Number.isFinite(g)) {
        const err = 5.00 - g;
        const sug = String(parseFloat((S.runStopSec + err).toFixed(3)));
        line += ' | خطا: ' + (err >= 0 ? '+' : '') + err.toFixed(2) + 's → «زمان توقف» را ' + sug + ' بگذار';
      }
    } else {
      line += ' | عدد بازی را خودت ببین: 05:00=برد؛ 04:99 → زمان توقف +0.01؛ 05:01 → −0.01';
    }
    pushLog(line);

    /* آیا بازی واقعاً متوقف شد؟ */
    const c1 = readCounterTextFrom(S.counterEl);
    setTimeout(() => {
      if (S.phase === 'running') return;
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
    stopPxLoop();
    if (S.domWatch) { S.domWatch.abort(); S.domWatch = null; }
    send({ type: 'dk5sr-cancel' });
    S.phase = 'armed';
    S.timing = null; S.arrivedStart = false; S.arrivedStop = false;
    S.stopArrivalEpoch = null; S.stopArrivalDate = null;
    S.gameStartEpoch = null; S.stopAtEpoch = null; S.syncRunning = false;
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
      if (!msg.sync) {
        const pressDate = msg.tTargetDate - (msg.anchor === 'release' ? msg.gapMs : 0);
        [180, 60].forEach((before) => {
          const wait = pressDate - before - epochNow();
          setTimeout(pushCoords, Math.max(0, wait));
        });
      }
      return;
    }
    if (msg.type === 'dk5sr-done')   { if (S.phase === 'running') finishRun(); return; }
    if (msg.type === 'dk5sr-cancelled') {
      S.phase = 'armed'; refreshStatus();
      S.ui.big.textContent = '—'; S.ui.sub.textContent = '';
      return;
    }
  });

  /* اندازه‌گیری «واقعیِ» رسیدن رویدادها + فریز در لحظهٔ توقف */
  window.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || S.phase !== 'running' || !S.timing) return;
    const arrival = epochNow();
    const mid = S.timing.t0Date + (S.timing.tTargetDate - S.timing.t0Date) / 2;
    if (arrival < mid) {
      if (Math.abs(e.clientX - S.origX) > 3 || Math.abs(e.clientY - S.origY) > 3) return;
      if (!S.arrivedStart) {
        S.arrivedStart = true;
        pushLog('↳ press شروع، ' + (arrival - S.timing.t0Date).toFixed(1) + 'ms بعد از dispatch به صفحه رسید');
      }
    } else {
      if (Math.abs(e.clientX - S.runX) > 3 || Math.abs(e.clientY - S.runY) > 3) return;
      if (!S.arrivedStop) {
        S.arrivedStop = true;
        S.stopArrivalEpoch = arrival;
        S.stopArrivalDate = Date.now();
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
      pushLog('نسخهٔ ۳.۰ فعال شد ✔ (همگام‌سازی پیکسلی + اتصال پایدار). اول یک‌بار 🎥 یا K → Share همین تب.');
    }
  }
  tick();
  setInterval(tick, 700);
})();