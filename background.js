/* background.js — نسخهٔ ۳.۱
   ✓ کلیک کاملاً trusted از CDP
   ✓ اتصال پایدار دیباگر (بنر فقط یک‌بار)
   ✓ حالت همگام: زمان توقف با پیام arm-stop از content می‌رسد */

const attached = new Set();
const runs = new Map();     // tabId -> { timers, stopX, stopY, gapMs, armed }
const LEAD = 8;

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender && sender.tab && sender.tab.id;
  if (tabId == null || !msg || !msg.type) return;
  if (msg.type === 'dk5sr-run')       doRun(tabId, msg);
  else if (msg.type === 'dk5sr-test')    doTest(tabId, msg);
  else if (msg.type === 'dk5sr-cancel')  cancelRun(tabId, true);
  else if (msg.type === 'dk5sr-attach')  doAttach(tabId);
  else if (msg.type === 'dk5sr-coords') {
    const st = runs.get(tabId);
    if (st && Number.isFinite(+msg.x) && Number.isFinite(+msg.y)) { st.stopX = +msg.x; st.stopY = +msg.y; }
  }
  else if (msg.type === 'dk5sr-arm-stop') armStop(tabId, msg);
});

chrome.debugger.onDetach.addListener((source) => {
  if (source && source.tabId != null) {
    attached.delete(source.tabId);
    logTo(source.tabId, '⚠ دیباگر جدا شد (Cancel بنر یا DevTools). دفعهٔ بعد دوباره وصل می‌شود.');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => { attached.delete(tabId); runs.delete(tabId); });

function logTo(tabId, text) {
  try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-log', text }).catch(() => {}); } catch (e) {}
}

async function attach(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/already attached/i.test(m)) throw e;
  }
  attached.add(tabId);
}

async function doAttach(tabId) {
  try {
    await attach(tabId);
    logTo(tabId, '🔗 دیباگر وصل شد و پایدار می‌ماند ✔');
  } catch (e) {
    logTo(tabId, '⚠ اتصال دیباگر ناموفق: ' + ((e && e.message) || e));
  }
}

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

function schedulePrecise(st, target, fn) {
  const wait = target - performance.now();
  const id = setTimeout(() => {
    while (performance.now() < target) { /* انتظار دقیق */ }
    fn();
  }, Math.max(0, wait - LEAD));
  st.timers.push(id);
}

function fmtMs(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + 'ms'; }

async function doRun(tabId, msg) {
  cancelRun(tabId, false);
  const gap = Math.max(0, +msg.gapMs || 0);
  const st = { timers: [], stopX: msg.x, stopY: msg.y, gapMs: gap, armed: false };
  runs.set(tabId, st);

  const { x, y } = msg;
  const delayMs = Math.max(0, +msg.delayMs || 0);
  const stopMs  = Math.max(100, +msg.stopMs || 5000);
  const lead    = (+msg.leadMs || 0);
  const anchor  = msg.anchor === 'release' ? 'release' : 'press';
  const sync    = !!msg.sync;

  try {
    await attach(tabId);
  } catch (e) {
    runs.delete(tabId);
    logTo(tabId, '⚠ اتصال دیباگر ناموفق: ' + ((e && e.message) || e));
    return;
  }

  const t0 = performance.now();
  const t0Date = Date.now();

  press(tabId, x, y).catch((e) => logTo(tabId, '⚠ خطای dispatch شروع: ' + ((e && e.message) || e)));
  schedulePrecise(st, t0 + gap, () => release(tabId, x, y).catch(() => {}));

  const tTarget = t0 + delayMs + stopMs;
  const tTargetDate = t0Date + (tTarget - t0);
  try {
    chrome.tabs.sendMessage(tabId, { type: 'dk5sr-timing', t0Date, tTargetDate, anchor, gapMs: gap, sync }).catch(() => {});
  } catch (e) {}

  if (sync) {
    /* ⚡ زمان توقف بعداً با arm-stop می‌رسد */
    const janitor = setTimeout(() => {
      if (runs.get(tabId) === st && !st.armed) {
        runs.delete(tabId);
        logTo(tabId, '⚠ arm-stop نرسید — اجرا پایان یافت.');
        try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-done' }).catch(() => {}); } catch (e) {}
      }
    }, 10000);
    st.timers.push(janitor);
    return;
  }

  /* حالت باز (تأخیر ثابت) */
  let tPress = (anchor === 'release') ? (tTarget - gap) : tTarget;
  tPress -= lead;
  schedulePrecise(st, tPress, () => {
    const dev = performance.now() - tPress;
    press(tabId, st.stopX, st.stopY).catch(() => {});
    logTo(tabId, '■ press توقف dispatch شد (انحراف زمان‌بندی: ' + fmtMs(dev) + ')');
  });
  schedulePrecise(st, tPress + gap, () => release(tabId, st.stopX, st.stopY).catch(() => {}));
  schedulePrecise(st, tPress + gap + 60, () => {
    runs.delete(tabId);
    try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-done' }).catch(() => {}); } catch (e) {}
  });
}

function armStop(tabId, msg) {
  const st = runs.get(tabId);
  if (!st) { logTo(tabId, '⚠ arm-stop رسید ولی اجرایی در جریان نیست.'); return; }
  st.armed = true;
  let waitMs = (+msg.stopAtEpoch || 0) - Date.now();
  if (waitMs < 5) {
    logTo(tabId, '⚠ arm-stop دیر رسید (' + fmtMs(waitMs) + ') — همین حالا dispatch می‌شود.');
    waitMs = 0;
  }
  const tPress = performance.now() + waitMs;
  schedulePrecise(st, tPress, () => {
    const dev = performance.now() - tPress;
    press(tabId, st.stopX, st.stopY).catch(() => {});
    logTo(tabId, '■ press توقف dispatch شد (انحراف زمان‌بندی: ' + fmtMs(dev) + ')');
  });
  schedulePrecise(st, tPress + st.gapMs, () => release(tabId, st.stopX, st.stopY).catch(() => {}));
  schedulePrecise(st, tPress + st.gapMs + 60, () => {
    runs.delete(tabId);
    try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-done' }).catch(() => {}); } catch (e) {}
  });
}

async function doTest(tabId, msg) {
  if (runs.has(tabId)) { logTo(tabId, '⏳ اجرا در جریان است؛ تست نادیده گرفته شد.'); return; }
  try { await attach(tabId); } catch (e) { logTo(tabId, '⚠ اتصال دیباگر ناموفق: ' + ((e && e.message) || e)); return; }
  const { x, y } = msg;
  const gap = Math.max(0, +msg.gapMs || 90);
  logTo(tabId, '🧪 کلیک تستی (کاملاً trusted) زده شد…');
  try {
    await press(tabId, x, y);
    setTimeout(() => release(tabId, x, y).catch(() => {}), gap);
  } catch (e) {
    logTo(tabId, '⚠ خطای dispatch: ' + ((e && e.message) || e));
  }
}

function cancelRun(tabId, notify) {
  const st = runs.get(tabId);
  if (st) {
    st.timers.forEach(clearTimeout);
    runs.delete(tabId);
    if (notify) { try { chrome.tabs.sendMessage(tabId, { type: 'dk5sr-cancelled' }).catch(() => {}); } catch (e) {} }
  }
}