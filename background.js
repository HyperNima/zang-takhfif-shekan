/* background.js — نسخهٔ ۲.۰
   ارسال کلیک واقعی (trusted) از طریق chrome.debugger / CDP
   + مختصات کلیک توقف در طول اجرا قابل به‌روزرسانی است (جبران اسکرول صفحه) */

const attached = new Set(); // تب‌هایی که دیباگر وصل است
const runs = new Map();     // tabId -> { timers, stopX, stopY }
const LEAD = 8;             // حداکثر busy-wait برای دقت میلی‌ثانیه‌ای

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender && sender.tab && sender.tab.id;
  if (tabId == null || !msg || !msg.type) return;
  if (msg.type === 'dk5sr-run')        doRun(tabId, msg);
  else if (msg.type === 'dk5sr-test')     doTest(tabId, msg);
  else if (msg.type === 'dk5sr-cancel')   cancelRun(tabId, true);
  else if (msg.type === 'dk5sr-coords') { /* ★ مختصات به‌روز توقف (ردیابی اسکرول) */
    const st = runs.get(tabId);
    if (st && Number.isFinite(+msg.x) && Number.isFinite(+msg.y)) {
      st.stopX = +msg.x;
      st.stopY = +msg.y;
    }
  }
});

/* اگر کاربر نوار «debugging» را ببندد یا DevTools تداخل کند */
chrome.debugger.onDetach.addListener((source) => {
  if (source && source.tabId != null) {
    attached.delete(source.tabId);
    logTo(source.tabId, '⚠ دیباگر جدا شد (نوار «debugging» بسته شده یا DevTools تداخل دارد).');
  }
});

function logTo(tabId, text) {
  try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-log', text }).catch(() => {}); } catch (e) {}
}

async function attach(tabId) {
  if (attached.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, '1.3');
  attached.add(tabId);
}

function detachSoon(tabId, ms) {
  setTimeout(() => {
    if (!runs.has(tabId)) {
      attached.delete(tabId);
      chrome.debugger.detach({ tabId }).catch(() => {});
    }
  }, ms);
}

/* ---------- رویدادهای موس واقعی ---------- */
function press(tabId, x, y) {
  return chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse',
  });
}
function release(tabId, x, y) {
  return chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse',
  });
}

/* زمان‌بندی دقیق: setTimeout + چند میلی‌ثانیه busy-wait */
function schedulePrecise(st, target, fn) {
  const wait = target - performance.now();
  const id = setTimeout(() => {
    while (performance.now() < target) { /* انتظار دقیق */ }
    fn();
  }, Math.max(0, wait - LEAD));
  st.timers.push(id);
}

function fmtMs(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + 'ms'; }

/* ---------- اجرای کامل: شروع → تأخیر → شمارش → توقف ---------- */
async function doRun(tabId, msg) {
  cancelRun(tabId, false);
  const st = { timers: [], stopX: msg.x, stopY: msg.y }; /* ★ مختصات توقف: قابل به‌روزرسانی */
  runs.set(tabId, st);

  const { x, y } = msg;
  const delayMs = Math.max(0, +msg.delayMs || 0);
  const stopMs  = Math.max(100, +msg.stopMs || 5000);
  const gap     = Math.max(0, +msg.gapMs || 0);
  const lead    = (+msg.leadMs || 0);
  const anchor  = msg.anchor === 'release' ? 'release' : 'press';

  try {
    await attach(tabId);
  } catch (e) {
    runs.delete(tabId);
    logTo(tabId, '⚠ اتصال دیباگر ناموفق: ' + (e && e.message ? e.message : e) +
      ' — DevToolsِ همین تب نباید باز باشد.');
    return;
  }

  const t0 = performance.now();
  const t0Date = Date.now();

  /* ۱) کلیک شروع روی مختصات اولیه (نقطهٔ موس) */
  press(tabId, x, y).catch((e) => logTo(tabId, '⚠ خطای dispatch شروع: ' + (e && e.message)));
  schedulePrecise(st, t0 + gap, () => release(tabId, x, y).catch(() => {}));

  /* ۲) هدف کاربر: t0 + delay + stop */
  const tTarget = t0 + delayMs + stopMs;
  const tTargetDate = t0Date + (tTarget - t0);

  /* ۳) زمان‌بندی کلیک توقف (با پیش‌ارسال CDP) */
  let tPress = (anchor === 'release') ? (tTarget - gap) : tTarget;
  tPress -= lead;

  /* اطلاع‌رسانی زمان‌بندی به پنل (نمایش + اندازه‌گیری رسیدن + ردیابی مختصات) */
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'dk5sr-timing', t0Date, tTargetDate, anchor, gapMs: gap,
    }).catch(() => {});
  } catch (e) {}

  /* ۴) press توقف — با مختصاتِ به‌روزِ لحظهٔ dispatch (st.stopX / st.stopY) */
  schedulePrecise(st, tPress, () => {
    const dev = performance.now() - tPress;
    press(tabId, st.stopX, st.stopY).catch(() => {});
    logTo(tabId, '■ press توقف dispatch شد (انحراف زمان‌بندی: ' + fmtMs(dev) + ')');
  });

  /* ۵) release توقف — همان مختصات به‌روز */
  schedulePrecise(st, tPress + gap, () => release(tabId, st.stopX, st.stopY).catch(() => {}));

  /* ۶) پایان + جمع‌کردن دیباگر */
  schedulePrecise(st, tPress + gap + 60, () => {
    runs.delete(tabId);
    try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-done' }).catch(() => {}); } catch (e) {}
    detachSoon(tabId, 1500);
  });
}

/* ---------- کلیک تستی ---------- */
async function doTest(tabId, msg) {
  if (runs.has(tabId)) { logTo(tabId, '⏳ اجرا در جریان است؛ تست نادیده گرفته شد.'); return; }
  try {
    await attach(tabId);
  } catch (e) {
    logTo(tabId, '⚠ اتصال دیباگر ناموفق: ' + (e && e.message ? e.message : e));
    return;
  }
  const { x, y } = msg;
  const gap = Math.max(0, +msg.gapMs || 90);
  logTo(tabId, '🧪 کلیک تستی (کاملاً trusted) زده شد…');
  try {
    await press(tabId, x, y);
    setTimeout(() => {
      release(tabId, x, y).catch(() => {});
      detachSoon(tabId, 900);
    }, gap);
  } catch (e) {
    logTo(tabId, '⚠ خطای dispatch: ' + (e && e.message ? e.message : e));
    detachSoon(tabId, 500);
  }
}

function cancelRun(tabId, notify) {
  const st = runs.get(tabId);
  if (st) {
    st.timers.forEach(clearTimeout);
    runs.delete(tabId);
    if (notify) {
      try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-cancelled' }).catch(() => {}); } catch (e) {}
    }
  }
  detachSoon(tabId, 400);
}