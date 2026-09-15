# 🔔 زنگ تخفیف شکن | Discount Bell Breaker

> **فا:** یک افزونهٔ کروم که برای شکست دادن بازی «زنگ تخفیف» دیجی‌کالا، کلیک‌هایش را از خودِ کروم قرض می‌گیرد.  
> **EN:** A Chrome extension that borrows its clicks from Chrome itself — because the game refuses to believe anything else.

🇮🇷 [فارسی](#-فارسی) | 🇬🇧 [English](#-english)

<!-- 
Screenshot
-->

---

## 🇮🇷 فارسی

### بازی چی بود؟

اگر سوپراپ دیجی‌کالا را باز کنید، یک بازی کوچک به اسم «زنگ تخفیف» (Five Second Rush) دارد. قانونش ساده است: یک تایمر که صدم‌ثانیه می‌شمارد، و شما باید **دقیقاً لحظه‌ای که به `05:00` رسید** دکمهٔ توقف را بزنید. برنده شوید، کد تخفیف می‌گیرید. روزانه هم ۱۰ شانس دارید.

ساده به نظر می‌رسد؟ پنجرهٔ برد اگر خوش‌بین باشیم **۱۰ میلی‌ثانیه** است، در حالی که واکنش معمول یک آدم حدود ۲۰۰ میلی‌ثانیه طول می‌کشد. یعنی شما عملاً دارید بخت‌آزمایی می‌کنید، نه بازی. بعد از چند روز که همهٔ شانس‌هایم را در دورریز گذاشتم، به‌جای تسلیم، تصمیم گرفتم مهندسی را با مهندسی جواب بدهم. این مخزن، گزارشِ همان زورآزمایی است — و ابزارش.

### گیم چطور ساخته شده بود؟

رفتم زیر کاپوت و چیزی که پیدا کردم جدی بود:

* **معماری:** `Next.js`/`React` برای صفحه + کامپوننت‌های **Lit** با **Shadow DOM** برای بخش‌های محصورشده. DOM صفحه مثل پیاز است.
* **کلاس‌های هش‌شده:** `styles-module-scss-module__fWtvNG__button` — اسم کلاس‌ها با هر بیلد عوض می‌شوند؛ نوشتن سلکتور ثابت عملاً بی‌فایده است.
* **فیلتر رویدادهای جعلی:** رویدادهای `dispatchEvent`-شده (با `isTrusted=false`) توسط هندلرهای بازی نادیده گرفته می‌شوند. اسکریپت Tampermonkey من روی هر چیزی در صفحه کلیک می‌کرد — هر چیزی جز خودِ دکمهٔ شروع.
* **منطق ناهم‌متقارن کلیک:** شمارش با **رهاکردنِ** دکمهٔ شروع راه می‌افتد (بعد از انیمیشن زنگ) ولی توقف با **فشردن** ثبت می‌شود. یعنی «کِی کلیک می‌کنی» به‌اندازهٔ «چقدر نگهش می‌داری» مهم است.
* **تأخیر شروع متغیر:** شمارندهٔ بازی واقعاً حدود ۹۰ تا ۲۵۰ میلی‌ثانیه بعد از کلیکِ شروع روشن می‌شود — و این عدد بین اجراها ثابت نمی‌ماند.
* **تلهٔ اسکرول:** درست بعد از شروع، صفحه خودش کمی بالا می‌اسکرول می‌شود و دکمه جابه‌جا می‌شود. هر ابزاری که با مختصات ثابت کلیک کند، به جای خالی شلیک می‌کند و می‌بازد.
* **محدودیت سمت سرور:** ۱۰ تلاش در روز که سمت سرور اعتبارسنجی می‌شود. حلقهٔ بی‌نهایتِ brute-force بی‌معناست.

جالب‌ترین لحظهٔ کاوش؟ اولش مطمئن بودم دکمه داخل Shadow DOM است و برای نفوذ به `shadowRoot` کد نوشتم. بعد یک dump از DOM گرفتم و دیدم دکمه یک `<button>` سادهٔ React در DOM معمولی است. درِ بسته‌ای که کلیدش جای دیگری بود: **اصالت رویداد**.

### چرا Tampermonkey جواب نداد

مسیر کاملش را رفتم:

1. شبیه‌سازی توالی کامل رویدادها (از `pointerdown` تا `click`) — بازی بی‌اعتنا بود.
2. جعل `isTrusted` روی خودِ رویداد با `Object.defineProperty` — کار می‌کند، ولی هیچ تضمینی نیست کدام چکِ native پشت صحنه منتظرت باشد.
3. صدا زدن مستقیم هندلرهای React از `$__reactProps` — هک قشنگی است، ولی حس‌وحال باخت داد.

**نتیجه:** در دنیای userscript هیچ راهی وجود ندارد که رویدادی «واقعاً» از موس یا کیبورد سیستم متولد شود. باید یک لایه بالاتر می‌رفتم.

### ایدهٔ نهایی: کلیک از سمتِ خودِ کروم

افزونه با دسترسی `chrome.debugger` به تب وصل می‌شود و از طریق پروتکل CDP دستور `Input.dispatchMouseEvent` می‌فرستد. این رویدادها از **پایپ‌لاین ورودی خودِ کروم** تزریق می‌شوند: هیت‌تست را خود مرورگر انجام می‌دهد، Shadow DOM و iframe را خودش حل می‌کند، و `isTrusted === true` است — واقعاً، نه جعلی. از دید بازی، این همان کلیک دستِ توست.

### معماری

```text
zang-takhfif-shekan/
├── manifest.json    ← MV3؛ فقط یک مجوز: debugger
├── background.js    ← موتور کلیک CDP + زمان‌بند میلی‌ثانیه‌ای
└── content.js       ← پنل، میان‌برها، ردیابی دکمه، کالیبراسیون
```
### ⚙️ جریان کار به این شکل است

* موس را روی دکمهٔ «شروع زنگ» می‌گذارید و کلید `K` را می‌زنید.
* اسکریپت `content` مختصات و تنظیمات را به `service worker` ارسال می‌کند.
* در پس‌زمینه، `worker` دیباگر را متصل کرده، رویداد `press` شروع را همان‌جا و رویداد `release` را پس از گذشت «فاصلهٔ انسانی» تزریق می‌کند.
* هم‌زمان `content script` دکمه را **به‌صورت زنده ردیابی می‌کند** (هر ۲۵۰ میلی‌ثانیه + دو بار دقیقاً قبل از توقف). اگر صفحه اسکرول خورده باشد، مختصات تازه ارسال می‌شود؛ دقیقاً مثل دستِ انسانی که دکمه را دنبال می‌کند.
* در لحظهٔ هدف، `worker` با دقت میلی‌ثانیه‌ای رویدادهای `press` و `release` توقف را روی مختصات نهایی تزریق می‌کند.
* در پایان اجرا، لاگ‌ها به شما نشان می‌دهند که بازی چه عددی را ثبت کرده است و برای دفعات بعد، «زمان توقف» را باید روی چه عددی تنظیم کنید.

### ✨ امکانات

* 🔐 **کلیک‌های ۱۰۰٪ Trusted:** تزریق واقعی رویداد از سطح پایپ‌لاین CDP مرورگر (نه صرفاً شبیه‌سازی جاوااسکریپتی).
* ⌨️ **کنترل سریع با کیبورد:** کلید `K` برای اجرای کامل توالی خودکار و کلید `T` برای تست کلیک.
* 🎚 **پنل تنظیمات شناور:** دارای قابلیت ذخیرهٔ خودکار مقادیر تنظیم‌شده.
* 🎯 **ردیابی پویای دکمه:** پیدا کردن و کلیک روی دکمه حتی زمانی که صفحه بازی اسکرول بخورد.
* 📊 **مانیتورینگ زنده:** خواندن لحظه‌ای شمارندهٔ بازی (با پشتیبانی کامل از کاراکترهای فارسی مثل «۰۵:۰۰»).
* 🧪 **کالیبراسیون هوشمند:** اندازه‌گیری لحظهٔ «رسیدن واقعی» رویداد به صفحه و پیشنهاد خودکار مقدار بعدی برای کاهش خطا.
* ✅ **تاییدیه توقف:** بررسی هوشمند اینکه آیا بازی واقعاً متوقف شد یا کلیکِ تزریق‌شده به هدف نخورده است.

### 🎚 جدول کامل تنظیمات
*(بر اساس کنترل‌های موجود در پنل افزونه)*

| کنترل در پنل | پیش‌فرض | عملکرد | مثال / توصیه |
| :--- | :---: | :--- | :--- |
| **کلید میان‌بر** | `K` | کلید اجرای کل توالی (شروع، شمارش، توقف). با کلیک روی کادر و فشردن کلید جدید، تغییر می‌کند. | `K` |
| **تأخیر بعد از کلیک شروع** (ms) | `80` | فاصلهٔ زمانی کلیک «شروع» تا شروع شمارش داخلی ربات (جبرانِ تأخیرِ خودِ بازی). | **برابر «فاصلهٔ انسانی» بگذارید** (مثلاً `90`) |
| **زمان توقف / آفست** (ثانیه) | `5.00` | مدت شمارش داخلی تا لحظهٔ شلیک کلیکِ توقف — **پیچ اصلی کالیبراسیون**. | از `5.01` شروع کنید و بعد، مقدار پیشنهادی لاگ را جایگزین کنید. |
| **فاصلهٔ انسانی press→release** (ms)| `90` | هر کلیک چند میلی‌ثانیه نگه‌داشته شود تا شبیه رفتار انسان باشد. | بین `50` تا `90` |
| **توقف ثبت شود روی** | `فشردن` | مبنای ثبت توقف در بازی: لحظهٔ فشردن (`pointerdown`) یا رهاکردن (`click`). | اگر خطای ثابتی هم‌اندازهٔ «فاصلهٔ انسانی» دیدید، این گزینه را تغییر دهید. |
| **پیش‌ارسال CDP** (ms) | `0` | ارسالِ زودترِ دستورات برای خنثی‌کردن تأخیرِ تزریقِ خود پروتکل CDP. | عددی که در لاگِ اجرا نمایش داده می‌شود (مثلاً `3`). |
| ☑️ **آماده‌سازی خودکار** | `خاموش`| پس از پایان اجرا، بدون نیاز به ریست دستی مجدداً منتظر کلید می‌ماند. | برای زدنِ سریعِ شانس‌های روزانه روشن کنید. |

#### 🕹 کنترل‌های اجرا

| کلید / دکمه | عملکرد |
| :--- | :--- |
| **کلید `K`** | اجرای کامل: **کلیک شروع ⬅️ تأخیر ⬅️ شمارش معکوس ⬅️ کلیک توقف** |
| **کلید `T`** | یک کلیک تستیِ Trusted در محل فعلیِ موس (جهت اطمینان از سلامت موتور کلیک). |
| **دکمهٔ «⟳ ریست»** | لغو توالیِ در حال اجرا و آماده‌سازی ربات برای اجرای بعدی. |
| **دکمهٔ `–` / درگ هدر** | جابه‌جایی پنل در صفحه یا جمع‌کردن (مینی‌مایز) آن. |

> 💡 **فرمول ذهنی محاسبه زمان:**  
> عددی که بازی در لحظهٔ توقف نشان می‌دهد ≈ `(تأخیر − فاصلهٔ انسانی) + زمان‌توقف × ۱۰۰۰ − پیش‌ارسال + جیترِ خودِ بازی`

### 🚀 نصب

۱. این مخزن را Clone یا دانلود کنید:

```bash
git clone https://github.com/HyperNima/zang-takhfif-shekan.git
```
۲. مرورگر را باز کرده، به آدرس `chrome://extensions` بروید و از گوشهٔ بالا سمت راست، **Developer mode** را فعال کنید.  
۳. روی دکمهٔ **Load unpacked** کلیک کرده و پوشهٔ `zang-takhfif-shekan` را انتخاب کنید.  
۴. صفحهٔ بازی را باز کنید؛ پنل شناور **«⏱ دستیار ۵ ثانیه»** در کنار صفحه ظاهر می‌شود.

---

### 🎯 راهنمای استفاده و کالیبراسیون (قانون طلایی)

> ⚠️ **اصل اساسی:** ملاک کالیبراسیون، **تنها عددی است که خودِ بازی ثبت می‌کند** (نه زمان روی پنل و نه حدس ذهنی).

| عدد ثبت‌شده در بازی | اقدام اصلاحی |
| :--- | :--- |
| **`05:00` (همراه با برد)** | 🎉 موفقیت‌آمیز! تنظیمات دقیق است؛ کد تخفیف را دریافت کنید. |
| **`05:00` (بدون برد)** | «زمان توقف» را دقیقاً در مرکز پنجرهٔ شانس قرار دهید (مثلاً `5.005`). |
| **`04:99`** | مقدار «زمان توقف» را به میزان `+0.01` ثانیه افزایش دهید. |
| **`05:01`** | مقدار «زمان توقف» را به میزان `-0.01` ثانیه کاهش دهید. |
| **نوسان بین دو عدد** | از مقادیر اعشاری سه‌رقمی استفاده کنید (مانند `5.005`). |

> 💡 **نکته:** پس از هر اجرا، بخش لاگ افزونه عدد پیشنهادی برای دور بعدی را به‌صورت خودکار محاسبه می‌کند؛ کافی است همان را کپی و اعمال کنید.

#### 📌 نکات کلیدی کالیبراسیون
* **تفاوت زمان پنل با بازی:** در صورت تنظیم گزینهٔ «توقف ثبت شود روی = رهاکردن»، زمان نمایش داده‌شده روی پنل همواره برابر با `زمان توقف − فاصلهٔ انسانی` خواهد بود. این تفاوت رفتار طبیعی سیستم است و مبنا سنجش بازی خواهد بود.
* **هم‌ترازی زمان‌بندی:** از آنجا که شمارش بازی با *رهاسازی* دکمه آغاز می‌شود، پارامتر «تأخیر» را دقیقاً برابر با «فاصلهٔ انسانی» قرار دهید تا تایمر داخلی افزونه با بازی هم‌گام شود.
* **عدم رفرش در حین کالیبراسیون:** بین تلاش‌های متوالی جهت کالیبره‌سازی، صفحه را Refresh نکنید؛ زیرا نقطهٔ شروع شمارش بازی (Jitter) تغییر می‌کند.

---

### 📝 یادداشت‌های میدانی (تجربیات فنی)

* 🛑 **نوار دیباگ کروم:** پیام بالای مرورگر مبنی بر `"Extension started debugging this browser"` طبیعی است. آن را Cancel نکنید؛ پس از اتمام عملیات خودکار بسته می‌شود.
* 🛑 **تداخل DevTools:** ابزار DevTools (Inspect) نباید روی همان تب باز باشد؛ پروتکل CDP اجازهٔ اتصال هم‌زمان دو دیباگر به یک تب را نمی‌دهد.
* 🛑 **تنظیمات نمایش:** میزان Zoom پیج روی `100%` باشد. در حین اجرا از اسکرول نکنید. زبان کیبرد روی انگلیسی باشد!!
* 🛑 **تداخل اسکریپت‌ها:** در صورت فعال بودن اسکریپت‌های مشابه در Tampermonkey، آن‌ها را غیرفعال کنید تا از اجرای هم‌زمان روی کلید `K` جلوگیری شود.

---

### ⚖️ محدودیت‌ها و سلب مسئولیت

* این افزونه تعداد شانس‌های روزانه را افزایش نداده و منطق سمت سرور را تغییر نمی‌دهد؛ بلکه تنها پنجرهٔ زمانی ۱۰ میلی‌ثانیه‌ای را از خطای انسانی خارج کرده و به دقت اتوماسیون می‌سپارد.
* به دلیل وجود نوسان تصادفی (Jitter) در زمان شروع شمارش بازی، ممکن است پس از هر بار بارگذاری مجدد صفحه، نیاز به ۱ یا ۲ بار کالیبراسیون مجدد باشد.
* **Disclaimer:** این پروژه صرفاً یک نمونهٔ پژوهشی در زمینهٔ مهندسی معکوس و اتوماسیون مرورگر (Browser Automation) بوده و جهت اهداف آموزشی منتشر شده است. مسئولیت رعایت قوانین پلتفرم هدف بر عهدهٔ استفاده‌کننده است.

---

<a id="english"></a>

## 🇬🇧 English

## 🕹️ The Game: "Discount Bell"

Digikala (Iran's largest e-commerce platform) runs a mini-game in their superapp called **"Discount Bell"** (Five Second Rush). The rules are deceptively simple: a timer counts in hundredths of a second, and you must hit stop **exactly when it reads `05:00`**. Win, and you get a discount coupon. You are granted 10 attempts per day.

Sounds easy? Your winning window is roughly **10 milliseconds**, whereas average human reaction time is around 200ms. You aren't playing — you're gambling. After burning my daily attempts for a week, I stopped surrendering and started engineering. This repository documents that reverse-engineering journey — and the automation tool born from it.

---

## 🔍 Engineering Breakdown: How the Opponent Was Built

Inspecting the underlying implementation revealed several non-trivial frontend safeguards:

* **Architecture:** A `Next.js`/`React` single-page application integrating **Lit** web components with **Shadow DOM** encapsulation.
* **Hashed Class Names:** SCSS modules generate dynamic classes (e.g., `styles-module-scss-module__fWtvNG__button`) that rotate with builds, rendering static selectors useless.
* **Synthetic Event Filtering:** Scripted events (`isTrusted = false`) are intercepted and ignored by internal React synthetic event listeners. Standard userscripts happily click elements, but fail to trigger actual game logic.
* **Asymmetric Click Semantics:** The game timer starts on button **release** (`pointerup`/`mouseup` after the bell animation) but registers the stop on **press** (`pointerdown`). *When* you click matters as much as *how long* you hold it.
* **Variable Startup Lag:** The counter actually initiates ~90–250ms *after* the start click — a value that dynamically drifts between executions.
* **The Scroll Trap:** Immediately after initiation, the page auto-scrolls, physically moving the button element. Fixed-coordinate automation shoots into empty space.
* **Server-Side Validation:** Attempt limits (10/day) are enforced server-side, making naive brute-force loops completely ineffective.

> 💡 **Key Insight:** Initial inspection hinted that the button resided deep within a Shadow DOM tree. However, DOM dumps revealed a standard React `<button>` in the light DOM. The actual protection layer wasn't encapsulation — it was **Event Authenticity**.

---

## 🛑 Why Userscripts (Tampermonkey) Failed

Evaluating DOM-level workarounds:

1. **Full Synthetic Event Dispatching:** Dispatching sequence chains (`pointerdown` → `mousedown` → `mouseup` → `click`) were ignored by internal React event handlers.
2. **Property Spoofing:** Redefining `isTrusted` via `Object.defineProperty` bypasses superficial checks, but fails against browser-native event validation deeper in the pipeline.
3. **React Fiber Hooking:** Accessing internal handlers directly via `__reactProps$` properties worked, but bypassed the native browser interaction lifecycle entirely.

**Conclusion:** Userscripts operating strictly within the DOM context cannot generate genuine hardware-level events. Interacting with the game required moving one abstraction layer up: **The Browser Debugging Protocol.**

---

## ⚡ The Solution: Chrome DevTools Protocol (CDP)

The extension leverages the `chrome.debugger` API to attach directly to the target tab and dispatch low-level input commands via the **Chrome DevTools Protocol (CDP)** using `Input.dispatchMouseEvent`:

```javascript
chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
  type: 'mousePressed',
  x,
  y,
  button: 'left',
  buttons: 1,
  clickCount: 1,
});
```
These events are injected through **Chrome's own input pipeline**: the browser does the hit-testing, resolves Shadow DOM and iframes natively, and generates events where `isTrusted === true` — making them indistinguishable from hardware input.

---

## 🏗 Architecture

```text
zang-takhfif-shekan/
├── manifest.json    ← Manifest V3 (requires single permission: "debugger")
├── background.js    ← CDP click execution engine + millisecond scheduler
└── content.js       ← Control panel, hotkeys, button tracking, calibration
```
### 🔄 Execution Flow

1. **Targeting:** Hover over the "Start" button and press `K`.
2. **Handoff:** The content script captures cursor coordinates and parameters, forwarding them to the background Service Worker.
3. **Initiation:** The Service Worker attaches the debugger, immediately dispatching a native `mousePressed` event followed by `mouseReleased` after the configured "Human Gap".
4. **Dynamic Tracking:** The content script tracks the button in real time (every 250ms plus twice right before the stop) and ships fresh coordinates if the page scrolls.
5. **Precision Stop:** At the target millisecond, the worker dispatches the stop `mousePressed` and `mouseReleased` sequence with millisecond precision.
6. **Telemetry:** Execution logs display precise timing deltas and suggest calibration values for subsequent runs.

---

## ✨ Features

* 🔐 **100% Trusted Clicks:** Input injection via CDP operating at the browser pipeline layer (`isTrusted === true`).
* ⌨️ **Keyboard Hotkeys:** Press `K` for full sequence execution; press `T` for an isolated test click.
* 🎚 **Persistent Control Panel:** Floating UI panel with automatic state persistence (`chrome.storage`).
* 🎯 **Dynamic Layout Tracking:** Real-time element position tracking mitigates UI shifts and page scrolling.
* 📊 **Live Telemetry:** Parses the game's native timer DOM in real time (supports localized Persian digits: `۰۵:۰۰`).
* 🧪 **Precision Calibration:** Measures event arrival latency and automatically calculates offset suggestions.
* ✅ **State Verification:** Verifies whether the game timer successfully halted post-execution.

---

## ⚙️ Settings & Configuration

| Panel Control | Default | Function | Recommended Usage |
| :--- | :---: | :--- | :--- |
| **Hotkey** | `K` | Triggers the complete sequence (Start → Delay → Countdown → Stop). Click box to rebind. | `K` |
| **Start Delay** (ms) | `80` | Delay between start click and internal countdown (compensates for game startup lag). | **Set equal to "Human Gap"** (e.g., `90`), since the game starts counting on release. |
| **Stop Time / Offset** (s) | `5.00` | Target countdown length before dispatching stop click — **Primary Calibration Control**. | Start at `5.01`, then copy the value suggested in execution logs (`5.005` also valid). |
| **Human Gap** (ms) | `90` | Press-to-release holding duration (`pointerdown` → `pointerup`) to simulate physical key press. | `50`–`90` ms |
| **Stop Registers On** | `Press` | Timing anchor for stop click: `Press` (`pointerdown`) or `Release` (`click`). | Default to `Press`; switch if encountering a constant offset error matching this duration. |
| **CDP Lead** (ms) | `0` | Sends events early to cancel CDP protocol transport latency. | Match the value reported in execution logs (e.g., `3`). |
| ☑️ **Auto-Rearm** | `Off` | Automatically resets state after execution without manual intervention. | Enable when running consecutive daily attempts. |

### Runtime Controls

| Action | Execution |
| :--- | :--- |
| **Hotkey `K`** | Launches sequence: **Start Click ➔ Delay ➔ Countdown ➔ Stop Click** |
| **Hotkey `T`** | Dispatches an isolated CDP test click under cursor position (engine health check). |
| **Button `⟳ Reset`** | Cancels active execution sequences and re-arms listeners. |
| **Header / `–` Button** | Drags or minimizes the floating interface. |

> 💡 **Timing Formula:**  
> `Game Reading at Stop ≈ (Start Delay − Human Gap) + (Stop Time × 1000) − CDP Lead + Game Engine Jitter`

---

## 🚀 Installation & Setup

1. Clone or download this repository:

```bash
git clone https://github.com/HyperNima/zang-takhfif-shekan.git
```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `zang-takhfif-shekan` directory.
5. Launch the game page. The **"⏱ 5-Second Assistant"** panel will overlay on the screen automatically.

---

## 🎯 Usage & Calibration Protocol

> ⚠️ **Golden Rule:** Calibration decisions must be based **exclusively on the timing value displayed by the game UI itself** — ignore panel estimates or perceived timing.

| Game Display | Action Required |
| :--- | :--- |
| **`05:00` (Win)** | 🎉 Calibration complete! Claim coupon. |
| **`05:00` (No Win)** | Target the center of the millisecond window (adjust offset to `5.005`). |
| **`04:99`** | Increment Stop Time by `+0.01`s. |
| **`05:01`** | Decrement Stop Time by `-0.01`s. |
| **Bouncing Values** | Increase precision using 3 decimal places (e.g., `5.005`). |

> 📌 **Pro Tip:** Execution logs automatically calculate and display suggested values for subsequent runs. Copy the suggested value directly into the panel.

### Operational Nuances
* **Panel vs. Game Display:** When configuring "Stop Registers On = Release", the UI display on the panel naturally reflects `Stop Time − Human Gap`. Always calibrate against the game's timer display.
* **Clock Synchronization:** Because the game counter begins on button *release*, setting **Start Delay = Human Gap** aligns internal extension scheduling with game state logic.
* **Persistence:** Avoid refreshing the page between calibration attempts; page reloads reset the game engine's initialization jitter baseline.

---

## ⚠️ Field Notes & Edge Cases

* 🛑 **Chrome Debugger Banner:** The native Chrome infobar stating `"Extension started debugging this browser"` is expected behavior. Do not click *Cancel*; it detaches automatically upon completion.
* 🛑 **DevTools Conflict:** Do not open native Chrome DevTools (`Inspect`) on the active game tab. Chrome allows only one active debugger connection per tab at a time.
* 🛑 **Viewport Scale:** Ensure browser Zoom is set strictly to `100%`. Avoid manually scrolling during active sequence execution.
* 🛑 **Extension Conflicts:** Disable existing userscripts or Tampermonkey bots targeting the same hotkeys (`K`) to prevent duplicate execution triggers.

---

## ⚖️ Limitations & Disclaimer

* **Fair Play:** This tool **does not** grant additional game attempts, bypass server-side validation, or manipulate remote game state. It simply replaces human reaction latency with millisecond-accurate automation.
* **Engine Jitter:** Due to variable client-side rendering lag and game engine startup jitter, minor re-calibration may be required following page reloads.
* **Educational Disclaimer:** This project was developed strictly as an educational proof-of-concept exploring browser automation and reverse engineering techniques. Use of automation tools may violate the target platform's Terms of Service. Use responsibly and at your own risk.

---

*built with `performance.now()`, one busy-wait loop, and an unreasonable amount of stubbornness.* :))
