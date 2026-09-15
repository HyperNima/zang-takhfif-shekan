/* content.js — نسخهٔ ۳.۲.۱
   منطق = همان ۳.۲ موفق (بدون هیچ تغییری):
     ⚡ موتور burst: مقایسهٔ فریم‌به‌فریم + ۵ تغییر پیاپی در ۴۵۰ms
     👁 ناحیهٔ ۳۸٪ آخر canvas (رقم صدم‌ثانیه)
     🧪 تست تماشا بدون کلیک + نمایشگر Δ
   تغییرات این نسخه فقط UI:
     • پنل نصف شد — نمایشگر و ریست ثابت، تنظیمات با اسکرول
     • گزینهٔ «کلیک اضطراری» حذف شد (شکست همگام‌سازی = لغو بدون کلیک) */

(() => {
  'use strict';
  if (window.self !== window.top) return;

  const LS_KEY  = 'dk_5sr_cdp_settings_v4';   /* همان کلید ۳.۲ — کالیبراسیون حفظ می‌شود */
  const ROOT_ID = 'dk5sr-root';
  const GAME_RE = /five-second-rush/i;

  const BURST_MIN = 5;     /* حداقل تعداد تغییر فریم‌به‌فریم برای تأیید شمارش */
  const BURST_WIN = 450;   /* پنجرهٔ زمانی تأیید (ms) */
  const BURST_GAP = 500;   /* بیشینهٔ فاصلهٔ مجاز بین دو تغییر متوالی (ms) */
  const PX_W = 64, PX_H = 14;
  const ZONE_X = 0.62;     /* ناحیهٔ تحت نظر: از ۶۲٪ عرض canvas تا آخر */
  const PANEL_MAXH = 520;  /* حداکثر ارتفاع پنل (px) — قابل تغییر */

  const S = {
    active: false, bootstrapped: false,
    phase: 'armed',
    hotkey: 'KeyK',
    method: 'canvas',            /* canvas | pixel | off */
    thresh: 8,                   /* آستانهٔ Δ فریم‌به‌فریم */
    syncComp: 40,
    delayMs: 80, stopSec: 5.04, gapMs: 50,
    anchor: 'press', leadMs: 40, autoRearm: false,
    mouseX: null, mouseY: null,
    origX: 0, origY: 0, runX: 0, runY: 0,
    runDelayMs: 80, runStopSec: 5.00, syncRunning: false, testing: false,
    btnEl: null, lastCoordsPush: 0, coordLogged: false,
    timing: null, arrivedStart: false, arrivedStop: false,
    stopArrivalEpoch: null, stopArrivalDate: null,
    gameStartEpoch: null, stopAtEpoch: null,
    rafId: 0, lastHealth: 0,
    ui: {},
  };

  /* ================= یافتن canvas تایمر ================= */
  function deepCanvases(root, depth, out) {
    if (!root || depth > 8) return out;
    try {
      const cs = root.querySelectorAll('canvas');
      for (let i = 0; i < cs.length; i++) out.push(cs[i]);
      const all = root.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) deepCanvases(all[i].shadowRoot, depth + 1, out);
      }
    } catch (e) {}
    return out;
  }

  function findTimerCanvas() {
    let best = null;
    const list = deepCanvases(document, 0, []);
    for (const el of list) {
      if (!el.isConnected) continue;
      if (el.closest && el.closest('#' + ROOT_ID)) continue;
      const cls = typeof el.className === 'string' ? el.className : '';
      const w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0;
      let score = 0;
      if (cls.indexOf('__digits') !== -1) score += 100;
      if (w === 424 && h === 83) score += 60;
      if (cls.indexOf('digits') !== -1) score += 20;
      const r = el.getBoundingClientRect();
      if (r.width > 30 && r.height > 10) score += 10;
      if (!best || score > best.score) best = { el, score };
    }
    return best && best.score >= 60 ? best.el : null;
  }

  function canvasDesc(el) {
    if (!el) return '—';
    const cls = String(el.className || '');
    const m = cls.match(/__[A-Za-z0-9_-]*__digits/);
    return (m ? '…' + m[0] : (cls.slice(-28) || '(بدون کلاس)')) +
      ' (' + (el.getAttribute('width') || '?') + '×' + (el.getAttribute('height') || '?') + ')';
  }

  /* ================= خواندن مستقیم bitmap (روش canvas) ================= */
  const CV = { el: null, scratch: null, sctx: null, tainted: false, lastFind: 0 };

  function cvGrab() {
    if (CV.tainted) return null;
    if (!CV.el || !CV.el.isConnected) {
      if (Date.now() - CV.lastFind < 60) return null;
      CV.lastFind = Date.now();
      CV.el = findTimerCanvas();
      if (!CV.el) return null;
    }
    try {
      if (!CV.sctx) {
        CV.scratch = document.createElement('canvas');
        CV.scratch.width = PX_W; CV.scratch.height = PX_H;
        CV.sctx = CV.scratch.getContext('2d', { willReadFrequently: true });
      }
      const w = CV.el.width || 424, h = CV.el.height || 83;
      const sx = Math.floor(w * ZONE_X), sw = Math.max(4, Math.ceil(w * (1 - ZONE_X)));
      CV.sctx.clearRect(0, 0, PX_W, PX_H);
      CV.sctx.drawImage(CV.el, sx, 0, sw, h, 0, 0, PX_W, PX_H);
      return CV.sctx.getImageData(0, 0, PX_W, PX_H).data;
    } catch (e) { CV.tainted = true; return null; }
  }

  function cvProbe() {
    if (CV.tainted) return false;
    if (!findTimerCanvas()) return false;
    return !CV.tainted && !!cvGrab();
  }

  /* ================= موتور تماشا «burst» ================= */
  const WATCH = {
    active: false, grab: null, lastFrame: null, quietUntil: 0,
    events: [], burstStart: 0,
    dLast: 0, dPeak: 0, evtTotal: 0,
    onMotion: null, onFail: null,
    iv: 0, raf: 0, guard: 0, uiT: 0,
  };

  function diffMean(a, b) {
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      n += 3;
    }
    return sum / n;
  }

  function watchStart(grab, onMotion, onFail, timeoutMs) {
    watchStop();
    WATCH.active = true; WATCH.grab = grab;
    WATCH.onMotion = onMotion; WATCH.onFail = onFail;
    WATCH.lastFrame = null; WATCH.events = []; WATCH.burstStart = 0;
    WATCH.dLast = 0; WATCH.dPeak = 0; WATCH.evtTotal = 0;
    WATCH.quietUntil = Date.now() + 150;
    WATCH.iv = setInterval(watchTick, 5);
    const loop = () => { if (!WATCH.active) return; watchTick(); WATCH.raf = requestAnimationFrame(loop); };
    WATCH.raf = requestAnimationFrame(loop);
    WATCH.guard = setTimeout(() => {
      if (!WATCH.active) return;
      const f = WATCH.onFail;
      watchStop();
      if (f) f('تا ' + Math.round((timeoutMs || 4200) / 1000) + ' ثانیه الگوی شمارش (تغییرات پیاپی) دیده نشد');
    }, timeoutMs || 4200);
  }

  function watchTick() {
    if (!WATCH.active) return;
    const now = Date.now();
    let f = null;
    try { f = WATCH.grab(); } catch (e) { f = null; }
    if (!f) { WATCH.lastFrame = null; return; }

    if (WATCH.lastFrame && WATCH.lastFrame.length === f.length) {
      const d = diffMean(f, WATCH.lastFrame);
      WATCH.dLast = d;
      if (d > WATCH.dPeak) WATCH.dPeak = d;

      if (now >= WATCH.quietUntil) {
        if (d > S.thresh) {
          const lastT = WATCH.events.length ? WATCH.events[WATCH.events.length - 1] : 0;
          if (!WATCH.burstStart || now - lastT > BURST_GAP) WATCH.burstStart = now;
          WATCH.events.push(now);
          WATCH.evtTotal++;
        }
        while (WATCH.events.length && now - WATCH.events[0] > BURST_WIN) WATCH.events.shift();

        if (WATCH.events.length >= BURST_MIN) {
          const t = WATCH.burstStart;
          const st = { peak: WATCH.dPeak, total: WATCH.evtTotal };
          const cb = WATCH.onMotion;
          WATCH.onMotion = null; WATCH.onFail = null;
          watchStop();
          if (cb) cb(t, st);
          return;
        }
      }
    }
    WATCH.lastFrame = f;
    if (now - WATCH.uiT > 200) { WATCH.uiT = now; updateDeltaUI(); }
  }

  function watchStop() {
    WATCH.active = false;
    clearInterval(WATCH.iv); cancelAnimationFrame(WATCH.raf); clearTimeout(WATCH.guard);
    hideOutline();
    updateDeltaUI();
  }

  function updateDeltaUI() {
    if (!S.ui.delta) return;
    if (WATCH.active) {
      S.ui.delta.textContent = 'Δ=' + WATCH.dLast.toFixed(1) + ' (آستانه ' + S.thresh + ') ⚡' + WATCH.evtTotal;
      S.ui.delta.style.color = WATCH.events.length ? '#f1c40f' : '#7d8798';
    } else if (WATCH.evtTotal > 0) {
      S.ui.delta.textContent = 'Δ آخرین: ' + WATCH.dLast.toFixed(1) + ' | اوج: ' +
        WATCH.dPeak.toFixed(1) + ' | ⚡' + WATCH.evtTotal;
      S.ui.delta.style.color = '#7d8798';
    } else {
      S.ui.delta.textContent = 'Δ: —';
    }
  }

  /* ================= روش pixel (پشتیبان) ================= */
  const PX = { stream: null, video: null, canvas: null, ctx: null, el: null, lastFind: 0 };
  const MAP = { ok: false, sx: 1, sy: 1, dx: 0, dy: 0 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pxActive() { return !!(PX.stream && PX.stream.active && PX.video); }

  async function ensureStream() {
    if (pxActive()) return true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: { ideal: 60, max: 60 } },
        audio: false,
        preferCurrentTab: true, selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude', systemAudio: 'exclude',
      });
      PX.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (track) track.addEventListener('ended', () => {
        PX.stream = null; PX.video = null; PX.canvas = null; PX.ctx = null; MAP.ok = false;
        updateWatcherUI();
        pushLog('⚠ اشتراک صفحه قطع شد.');
      });
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true;
      video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;';
      (document.body || document.documentElement).appendChild(video);
      video.srcObject = stream;
      try { await video.play(); } catch (e) {}
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

  async function calibrateMapping() {
    if (MAP.ok || !pxActive()) return MAP.ok;
    try {
      const w = PX.video.videoWidth, h = PX.video.videoHeight;
      if (!w || !h) return false;
      const t = document.createElement('canvas');
      t.width = w; t.height = h;
      const tc = t.getContext('2d', { willReadFrequently: true });

      const find = async (x, y) => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:24px;height:24px;' +
          'background:#ff00ff;z-index:2147483647;pointer-events:none;';
        document.body.appendChild(d);
        await sleep(240);
        tc.drawImage(PX.video, 0, 0);
        const img = tc.getImageData(0, 0, w, h).data;
        d.remove();
        let sx = 0, sy = 0, n = 0;
        for (let py = 0; py < h; py += 2) {
          for (let px = 0; px < w; px += 2) {
            const i = (py * w + px) * 4;
            if (img[i] > 200 && img[i + 1] < 70 && img[i + 2] > 200) { sx += px; sy += py; n++; }
          }
        }
        return n ? [sx / n, sy / n] : null;
      };

      const x1 = 80, y1 = 80;
      const x2 = Math.max(200, innerWidth - 104), y2 = Math.max(200, innerHeight - 104);
      const p1 = await find(x1, y1);
      const p2 = await find(x2, y2);
      if (!p1 || !p2) { pushLog('⚠ کالیبراسیون نگاشت ناموفق — نگاشت ساده استفاده می‌شود.'); return false; }
      MAP.sx = (p2[0] - p1[0]) / (x2 - x1);
      MAP.sy = (p2[1] - p1[1]) / (y2 - y1);
      MAP.dx = p1[0] - (x1 + 12) * MAP.sx;
      MAP.dy = p1[1] - (y1 + 12) * MAP.sy;
      MAP.ok = true;
      pushLog('📐 کالیبراسیون: scale=' + MAP.sx.toFixed(3) + '×' + MAP.sy.toFixed(3) +
              ' offset=' + Math.round(MAP.dx) + ',' + Math.round(MAP.dy));
      return true;
    } catch (e) { return false; }
  }

  function pxGrab() {
    if (!pxActive()) return null;
    if (!PX.el || !PX.el.isConnected) {
      if (Date.now() - PX.lastFind < 60) return null;
      PX.lastFind = Date.now();
      PX.el = findTimerCanvas();
      if (!PX.el) return null;
    }
    const r = PX.el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return null;
    const zx = r.left + r.width * ZONE_X, zw = r.width * (1 - ZONE_X);
    const x = Math.floor(zx * MAP.sx + MAP.dx);
    const y = Math.floor(r.top * MAP.sy + MAP.dy);
    const w = Math.min(PX.video.videoWidth - x, Math.ceil(zw * MAP.sx));
    const h = Math.min(PX.video.videoHeight - y, Math.ceil(r.height * MAP.sy));
    if (w < 4 || h < 4 || x < 0 || y < 0) return null;
    PX.ctx.drawImage(PX.video, x, y, w, h, 0, 0, PX_W, PX_H);
    return PX.ctx.getImageData(0, 0, PX_W, PX_H).data;
  }

  let outlineEl = null;
  function showOutline(el) {
    hideOutline();
    if (!el) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;border:2px dashed #f1c40f;border-radius:4px;';
    document.body.appendChild(d);
    outlineEl = d;
    const pos = () => {
      if (!outlineEl || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      outlineEl.style.left = (r.left - 5) + 'px';
      outlineEl.style.top = (r.top - 5) + 'px';
      outlineEl.style.width = (r.width + 10) + 'px';
      outlineEl.style.height = (r.height + 10) + 'px';
    };
    pos();
    outlineEl._iv = setInterval(pos, 100);
  }
  function hideOutline() {
    if (outlineEl) { clearInterval(outlineEl._iv); outlineEl.remove(); outlineEl = null; }
  }

  async function toggleWatcher() {
    if (S.phase === 'running' || S.testing) { pushLog('⏳ حین اجرا/تست نمی‌شود — اول ریست.'); return; }
    if (pxActive()) {
      try { PX.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      if (PX.video) { try { PX.video.remove(); } catch (e) {} }
      PX.stream = null; PX.video = null; PX.canvas = null; PX.ctx = null; MAP.ok = false;
      updateWatcherUI();
      pushLog('🎥 دیده‌بان پیکسلی خاموش شد.');
      return;
    }
    if (S.ui.watchbtn) S.ui.watchbtn.disabled = true;
    const ok = await ensureStream();
    if (ok) {
      send({ type: 'dk5sr-attach' });
      await calibrateMapping();
      pushLog('🎥 دیده‌بان پیکسلی فعال ✔');
    }
    if (S.ui.watchbtn) S.ui.watchbtn.disabled = false;
    updateWatcherUI();
  }

  function updateWatcherUI() {
    if (!S.ui.watchstat) return;
    S.ui.watchbtn.textContent = pxActive() ? '⏹ خاموش‌کردن دیده‌بان' : '🎥 فعال‌سازی دیده‌بان صفحه';
    S.ui.watchstat.textContent = pxActive()
      ? (MAP.ok ? 'فعال ✔ + کالیبره' : 'فعال (بدون کالیبراسیون)')
      : 'غیرفعال';
  }

  /* ---------- تنظیمات ---------- */
  function loadSettings() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null') || {};
      if (c.hotkey) S.hotkey = String(c.hotkey);
      if (c.delayMs != null && Number.isFinite(+c.delayMs)) S.delayMs = Math.min(2000, Math.max(0, Math.round(+c.delayMs)));
      if (c.stopSec != null && Number.isFinite(+c.stopSec)) S.stopSec = Math.min(10, Math.max(0.1, +c.stopSec));
      if (c.gapMs   != null && Number.isFinite(+c.gapMs))   S.gapMs   = Math.min(500, Math.max(0, Math.round(+c.gapMs)));
      if (c.leadMs  != null && Number.isFinite(+c.leadMs))  S.leadMs  = Math.min(500, Math.max(-200, Math.round(+c.leadMs)));
      if (c.thresh  != null && Number.isFinite(+c.thresh))  S.thresh  = Math.min(100, Math.max(1, Math.round(+c.thresh)));
      if (c.syncComp != null && Number.isFinite(+c.syncComp)) S.syncComp = Math.min(300, Math.max(0, Math.round(+c.syncComp)));
      if (['canvas', 'pixel', 'off'].includes(c.method)) S.method = c.method;
      if (c.anchor === 'release' || c.anchor === 'press') S.anchor = c.anchor;
      if (typeof c.autoRearm === 'boolean') S.autoRearm = c.autoRearm;
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        hotkey: S.hotkey, delayMs: S.delayMs, stopSec: S.stopSec, gapMs: S.gapMs,
        anchor: S.anchor, leadMs: S.leadMs, method: S.method, thresh: S.thresh,
        syncComp: S.syncComp, autoRearm: S.autoRearm,
      }));
    } catch (e) {}
  }
  loadSettings();

  /* ---------- ابزارها ---------- */
  function normNum(s) {
    s = String(s == null ? '' : s).trim();
    const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
    return s.replace(/[۰-۹]/g, (d) => fa.indexOf(d)).replace(/[٠-٩]/g, (d) => ar.indexOf(d))
            .replace(/[٫،؛:,\/]/g, '.');
  }
  function keyLabel() {
    if (!S.hotkey) return '—';
    if (/^Key./.test(S.hotkey)) return S.hotkey.slice(3);
    if (/^Digit./.test(S.hotkey)) return S.hotkey.slice(5);
    return S.hotkey;
  }
  function methodName(m) {
    return m === 'canvas' ? 'canvas مستقیم' : m === 'pixel' ? 'پیکسل (اشتراک صفحه)' : 'باز (تأخیر ثابت)';
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
        background:#141822;border:1px solid #2b3344;border-radius:12px;width:252px;
        box-shadow:0 10px 34px rgba(0,0,0,.4);user-select:none;line-height:1.7;
        display:flex;flex-direction:column;max-height:${PANEL_MAXH}px}
      #dk5sr-root *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}
      #dk5sr-root input{user-select:text}
      #dk5sr-root input[type=checkbox]{accent-color:#4c8bf5;width:13px;height:13px;flex:none}
      #dk5sr-head{display:flex;align-items:center;gap:7px;padding:8px 11px;cursor:move;flex:none;
        background:#1b2130;border-radius:11px 11px 0 0;border-bottom:1px solid #2b3344}
      #dk5sr-title{font-weight:700;font-size:12.5px;flex:1;color:#fff}
      #dk5sr-dot{width:10px;height:10px;border-radius:50%;background:#5b6373;flex:none;transition:.25s}
      #dk5sr-dot.on{background:#2ecc71;box-shadow:0 0 9px rgba(46,204,113,.7)}
      #dk5sr-dot.run{background:#f1c40f;box-shadow:0 0 9px rgba(241,196,15,.7)}
      #dk5sr-min{background:none;border:0;color:#9aa3b5;cursor:pointer;font-size:15px;padding:2px 7px;border-radius:6px}
      #dk5sr-min:hover{background:#262d3d;color:#fff}
      #dk5sr-top{flex:none;padding:9px 11px 6px;border-bottom:1px dashed #232a38}
      #dk5sr-status{font-size:11px;color:#9aa3b5;min-height:16px;margin-bottom:6px}
      #dk5sr-readout{background:#0d1017;border:1px solid #262d3b;border-radius:9px;padding:7px 8px 5px;text-align:center;margin-bottom:5px}
      #dk5sr-big{font-size:27px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px;direction:ltr}
      #dk5sr-big.run{color:#f1c40f}
      #dk5sr-sub{font-size:10px;color:#7d8798;min-height:13px}
      #dk5sr-health{font-size:10.5px;text-align:center;margin:4px 0 2px;min-height:14px;color:#7d8798}
      #dk5sr-delta{font-size:10.5px;text-align:center;color:#7d8798;min-height:14px;direction:ltr;
        font-variant-numeric:tabular-nums}
      #dk5sr-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:6px 11px;
        scrollbar-width:thin;scrollbar-color:#2b3344 transparent}
      #dk5sr-body::-webkit-scrollbar{width:6px}
      #dk5sr-body::-webkit-scrollbar-thumb{background:#2b3344;border-radius:3px}
      #dk5sr-body::-webkit-scrollbar-track{background:transparent}
      #dk5sr-watch{margin:7px 0}
      #dk5sr-watchbtn{display:block;width:100%;padding:7px;background:#1f2740;border:1px solid #33406b;color:#bcd0ff;border-radius:9px;cursor:pointer;font-size:11.5px;font-weight:700}
      #dk5sr-watchbtn:hover{background:#26304f}
      #dk5sr-watchbtn:disabled{opacity:.5;cursor:wait}
      #dk5sr-watchstat{font-size:10px;color:#7d8798;margin-top:4px;text-align:center;min-height:13px}
      #dk5sr-watchtest{display:block;width:100%;margin:6px 0;padding:7px;background:#33261f;border:1px solid #6b4a33;
        color:#ffcdb0;border-radius:9px;cursor:pointer;font-size:11.5px;font-weight:700}
      #dk5sr-watchtest:hover{background:#402e24}
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
      #dk5sr-log{margin-top:6px;background:#0d1017;border:1px solid #262d3b;border-radius:8px;padding:5px 8px;font-size:10px;color:#8f99ab;max-height:110px;overflow-y:auto;scrollbar-width:thin}
      #dk5sr-log div{border-bottom:1px dashed #232a38;padding:3px 0;word-break:break-word}
      #dk5sr-help{margin-top:7px;font-size:10px;color:#5f6880;line-height:1.8;border-top:1px dashed #262d3b;padding-top:7px}
      #dk5sr-foot{flex:none;padding:7px 11px 9px;border-top:1px dashed #232a38}
      #dk5sr-reset{display:block;width:100%;padding:8px;background:#24361f;border:1px solid #3a5c2e;color:#a4e793;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:700}
      #dk5sr-reset:hover{background:#2c4526}
    </style>
    <div id="dk5sr-head">
      <span id="dk5sr-dot"></span>
      <span id="dk5sr-title">⏱ دستیار ۵ ثانیه (v3.2)</span>
      <button id="dk5sr-min" title="جمع‌کردن پنل">–</button>
    </div>
    <div id="dk5sr-top">
      <div id="dk5sr-status"></div>
      <div id="dk5sr-readout"><div id="dk5sr-big">—</div><div id="dk5sr-sub"></div></div>
      <div id="dk5sr-health">⏱ تایمر: …</div>
      <div id="dk5sr-delta">Δ: —</div>
    </div>
    <div id="dk5sr-body">
      <div id="dk5sr-watch">
        <button id="dk5sr-watchbtn">🎥 فعال‌سازی دیده‌بان صفحه</button>
        <div id="dk5sr-watchstat">غیرفعال</div>
      </div>
      <button id="dk5sr-watchtest">🧪 تست تماشا (بدون کلیک)</button>
      <div class="dk5sr-row"><label>کلید میان‌بر (تایپ کن)</label><input id="dk5sr-key" readonly></div>
      <div class="dk5sr-row"><label>روش همگام‌سازی شروع</label>
        <select id="dk5sr-method">
          <option value="canvas">canvas مستقیم (پیشنهادی)</option>
          <option value="pixel">پیکسل + اشتراک صفحه</option>
          <option value="off">خاموش (تأخیر ثابت)</option>
        </select>
      </div>
      <div class="dk5sr-row"><label>آستانهٔ Δ تشخیص حرکت</label><input id="dk5sr-thresh" type="number" step="1" min="1" max="100"></div>
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
      <div id="dk5sr-log"></div>
      <div id="dk5sr-help">موتور فقط «تغییرات پیاپی» را شمارش می‌داند (۵ تغییر در ۴۵۰ms) —
        انیمیشن idle تریگر نمی‌زند. بقیهٔ تنظیمات با اسکرول همین بخش در دسترس‌اند.
        شکست همگام‌سازی = لغو بدون هیچ کلیکی (بدون اتلاف شانس).</div>
    </div>
    <div id="dk5sr-foot">
      <button id="dk5sr-reset">⟳ ریست — آمادهٔ کلید میان‌بر</button>
    </div>`;
    (document.body || document.documentElement).appendChild(root);

    const q = (sel) => root.querySelector(sel);
    S.ui = {
      root,
      head: q('#dk5sr-head'), dot: q('#dk5sr-dot'), min: q('#dk5sr-min'),
      body: q('#dk5sr-body'), status: q('#dk5sr-status'),
      big: q('#dk5sr-big'), sub: q('#dk5sr-sub'), health: q('#dk5sr-health'), delta: q('#dk5sr-delta'),
      watch: q('#dk5sr-watch'), watchbtn: q('#dk5sr-watchbtn'), watchstat: q('#dk5sr-watchstat'),
      watchtest: q('#dk5sr-watchtest'),
      key: q('#dk5sr-key'), method: q('#dk5sr-method'), thresh: q('#dk5sr-thresh'), comp: q('#dk5sr-comp'),
      delay: q('#dk5sr-delay'), stop: q('#dk5sr-stop'),
      gap: q('#dk5sr-gap'), anchor: q('#dk5sr-anchor'), lead: q('#dk5sr-lead'),
      auto: q('#dk5sr-auto'),
      total: q('#dk5sr-total'), reset: q('#dk5sr-reset'), log: q('#dk5sr-log'),
    };

    S.ui.key.value = keyLabel();
    S.ui.method.value = S.method;
    S.ui.thresh.value = String(S.thresh);
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

    S.ui.method.addEventListener('change', () => { S.method = S.ui.method.value; saveSettings(); syncDependentUI(); });
    S.ui.thresh.addEventListener('input', () => {
      const v = parseInt(S.ui.thresh.value, 10);
      if (Number.isFinite(v)) { S.thresh = Math.min(100, Math.max(1, v)); saveSettings(); updateDeltaUI(); }
    });
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
    S.ui.watchtest.addEventListener('click', startWatchTest);
    S.ui.reset.addEventListener('click', resetRun);

    [S.ui.thresh, S.ui.comp, S.ui.delay, S.ui.stop, S.ui.gap, S.ui.lead].forEach((inp) => {
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
      inp.addEventListener('change', () => inp.blur());
    });

    S.ui.min.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = S.ui.body.style.display === 'none' && S.ui.root.querySelector('#dk5sr-foot').style.display === 'none';
      if (hidden) {
        S.ui.body.style.display = '';
        S.ui.root.querySelector('#dk5sr-foot').style.display = '';
        S.ui.min.textContent = '–';
      } else {
        S.ui.body.style.display = 'none';
        S.ui.root.querySelector('#dk5sr-foot').style.display = 'none';
        S.ui.min.textContent = '+';
      }
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
    updateDeltaUI();
  }

  function syncDependentUI() {
    if (!S.ui.delay) return;
    const sync = S.method !== 'off';
    S.ui.delay.disabled = sync;
    S.ui.thresh.disabled = !sync;
    S.ui.comp.disabled = !sync;
    S.ui.watch.style.display = S.method === 'pixel' ? '' : 'none';
    S.ui.watchtest.style.display = sync ? '' : 'none';
    updateTotal();
  }

  /* ---------- وضعیت / لاگ / سلامت ---------- */
  function refreshStatus() {
    if (!S.ui.status) return;
    if (S.phase === 'armed') {
      S.ui.dot.className = 'on';
      S.ui.status.textContent = S.testing ? '🧪 تست تماشا در جریان…' :
        'آماده ✔ موس روی دکمهٔ «شروع» + کلید «' + keyLabel() + '»';
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
    if (S.method !== 'off') {
      S.ui.total.textContent = 'اولین تغییرِ پیاپی تایمر ← ' + S.stopSec.toFixed(2) + 's − جبران ' + S.syncComp + 'ms ← press توقف';
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
  function updateHealth() {
    if (!S.ui.health) return;
    const c = findTimerCanvas();
    S.ui.health.textContent = c
      ? '⏱ تایمر: ✔ ' + canvasDesc(c)
      : '⏱ تایمر: ✖ canvas پیدا نشد';
    S.ui.health.style.color = c ? '#7ec97e' : '#e07b7b';
  }

  /* ---------- ردیابی دکمه (مصون از اسکرول) ---------- */
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

  /* ---------- تریگر / شکست ---------- */
  function onTrigger(triggerEpoch, st) {
    if (S.testing) {
      S.testing = false; refreshStatus();
      pushLog('⚡ تریگر در حالت تست! (Δاوج=' + (st ? st.peak.toFixed(1) : '?') +
              ', ' + (st ? st.total : '?') + ' تغییر) — موتور تشخیص سالم است ✔');
      return;
    }
    if (S.phase !== 'running') return;
    S.gameStartEpoch = triggerEpoch;
    let stopAt = triggerEpoch + S.runStopSec * 1000 - S.syncComp - S.leadMs;
    if (S.anchor === 'release') stopAt -= S.gapMs;
    S.stopAtEpoch = stopAt;
    if (S.timing) S.timing.tTargetDate = stopAt + (S.anchor === 'release' ? S.gapMs : 0);
    pushLog('⚡ تریگر! ' + (st ? st.total : '?') + ' تغییر پیاپی، Δاوج ' +
            (st ? st.peak.toFixed(1) : '?') + ' — press توقف ' + Math.max(0, stopAt - Date.now()) + 'ms دیگر');
    send({ type: 'dk5sr-arm-stop', stopAtEpoch: stopAt });
    [180, 60].forEach((before) => setTimeout(pushCoords, Math.max(0, stopAt - before - Date.now())));
  }

  function onSyncFail(reason) {
    if (S.testing) { S.testing = false; refreshStatus(); pushLog('🧪 تست: ' + reason); return; }
    if (S.phase !== 'running') return;
    pushLog('⚠ همگام‌سازی ناموفق (' + reason + ') — اجرا لغو شد؛ هیچ کلیکی زده نشد (بدون اتلاف شانس).');
    send({ type: 'dk5sr-cancel' });
    S.phase = 'armed'; S.syncRunning = false; refreshStatus();
    S.ui.big.textContent = '—'; S.ui.sub.textContent = '';
  }

  /* ---------- 🧪 تست تماشا (بدون کلیک) ---------- */
  function startWatchTest() {
    if (S.phase === 'running') { pushLog('⏳ حین اجرا نمی‌شود.'); return; }
    if (S.testing) { watchStop(); S.testing = false; refreshStatus(); pushLog('🧪 تست لغو شد.'); return; }
    loadSettings();
    let grab = null;
    if (S.method === 'canvas') {
      if (!cvProbe()) { pushLog('⚠ canvas قابل خواندن نیست — تست انجام نشد.'); return; }
      grab = cvGrab;
    } else if (S.method === 'pixel') {
      if (!pxActive()) { pushLog('⚠ برای تست روش پیکسل، اول دیده‌بان (🎥) را فعال کن.'); return; }
      grab = pxGrab;
    } else {
      pushLog('⚠ روش همگام‌سازی خاموش است — تست معنا ندارد.');
      return;
    }
    S.testing = true; refreshStatus();
    pushLog('🧪 تست تماشا فعال (۱۲ ثانیه، بدون کلیک): حالا بازی را دستی شروع کن…');
    watchStart(grab, onTrigger, onSyncFail, 12000);
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
    S.gameStartEpoch = null; S.stopAtEpoch = null;
    S.origX = S.mouseX; S.origY = S.mouseY;
    S.runX = S.mouseX;  S.runY = S.mouseY;
    S.btnEl = deepAt(S.mouseX, S.mouseY);
    S.lastCoordsPush = 0; S.coordLogged = false;

    let method = S.method;

    if (method === 'canvas') {
      if (!cvProbe()) {
        if (CV.tainted) { pushLog('⚠ خواندن bitmap تایمر ممکن نیست — روش پیکسل امتحان می‌شود.'); method = 'pixel'; }
        else { pushLog('⚠ canvas تایمر پیدا نشد — حالت باز (تأخیر ثابت) اجرا می‌شود!'); method = 'off'; }
      }
    }

    if (method === 'pixel') {
      if (!pxActive()) {
        S.ui.big.textContent = '…';
        S.ui.sub.textContent = 'در انتظار تأیید Share…';
        pushLog('🎥 درخواست تصویر صفحه… همین تب را Share کن.');
        const ok = await ensureStream();
        if (!ok) { pushLog('↩ Share لغو شد — حالت باز اجرا می‌شود!'); method = 'off'; }
      }
      if (method === 'pixel') {
        if (!findTimerCanvas()) { pushLog('⚠ canvas تایمر پیدا نشد — حالت باز!'); method = 'off'; }
        else if (!MAP.ok) await calibrateMapping();
      }
    }

    S.syncRunning = (method !== 'off');

    /* مختصات press شروع: مرکز زندهٔ دکمه */
    let sx = S.mouseX, sy = S.mouseY;
    const btn = findStopButton();
    if (btn) {
      const r = btn.getBoundingClientRect();
      if (r.width > 5 && r.height > 5) { sx = r.left + r.width / 2; sy = r.top + r.height / 2; }
      S.btnEl = btn;
    }
    S.origX = sx; S.origY = sy;
    S.runX = sx;  S.runY = sy;

    pushLog('▶ اجرا (' + methodName(method) + ') — press شروع از CDP…');
    if (method !== 'off') {
      pushLog('👁 زیر نظر: ' + canvasDesc(findTimerCanvas()) + ' | ناحیه: ۳۸٪ آخر | Δآستانه ' + S.thresh);
    }

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

    if (method === 'canvas') {
      watchStart(cvGrab, onTrigger, onSyncFail, 4200);
    } else if (method === 'pixel') {
      showOutline(findTimerCanvas());
      watchStart(pxGrab, onTrigger, onSyncFail, 4200);
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
      const est  = (Date.now() - S.gameStartEpoch - S.syncComp) / 1000;
      const left = (S.stopAtEpoch - Date.now()) / 1000;
      S.ui.big.textContent = Math.max(0, est).toFixed(2);
      S.ui.sub.textContent = left > 0 ? 'press توقف تا ' + Math.max(0, left).toFixed(2) + ' ثانیه دیگر' : 'توقف…';
    } else if (S.syncRunning) {
      S.ui.big.textContent = '…';
      S.ui.sub.textContent = 'در انتظار الگوی شمارش تایمر بازی…';
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
  }

  function finishRun() {
    cancelAnimationFrame(S.rafId);
    watchStop();
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

    pushLog('■ پایان | داخلی در لحظهٔ توقف: ' + (estAtStop != null ? estAtStop.toFixed(2) + 's' : '—') +
            ' | عدد بازی را خودت ببین: 05:00=برد • 04:99 → زمان توقف +0.01 • 05:01 → −0.01');

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
    watchStop();
    S.testing = false;
    send({ type: 'dk5sr-cancel' });
    S.phase = 'armed';
    S.timing = null; S.arrivedStart = false; S.arrivedStop = false;
    S.stopArrivalEpoch = null; S.stopArrivalDate = null;
    S.gameStartEpoch = null; S.stopAtEpoch = null; S.syncRunning = false;
    S.btnEl = null; S.lastCoordsPush = 0; S.coordLogged = false;
    S.ui.big.textContent = '—';
    S.ui.big.classList.remove('run');
    S.ui.sub.textContent = '';
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
    if (msg.type === 'dk5sr-done') { if (S.phase === 'running') finishRun(); return; }
    if (msg.type === 'dk5sr-cancelled') {
      S.phase = 'armed'; refreshStatus();
      S.ui.big.textContent = '—'; S.ui.sub.textContent = '';
      return;
    }
  });

  /* اندازه‌گیری رسیدن واقعی رویدادها + فریز لحظهٔ توقف */
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
    if (S.testing) { pushLog('🧪 تست تماشا در جریان است — با «ریست» یا پایان تست.'); return; }

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
      pushLog('نسخهٔ ۳.۲.۱ فعال شد ✔ (منطق ۳.۲ + پنل جمع‌وجور). تنظیمات قبلی‌ات حفظ شده است.');
    }
    if (S.active && S.bootstrapped && !WATCH.active && Date.now() - S.lastHealth > 3000) {
      S.lastHealth = Date.now();
      updateHealth();
    }
  }
  tick();
  setInterval(tick, 700);
})();