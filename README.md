# 🔔 زنگ تخفیف شکن | Discount Bell Breaker

> **فا:** یک افزونهٔ کروم که برای شکست دادن بازی «زنگ تخفیف» دیجی‌کالا، کلیک‌هایش را از خودِ کروم قرض می‌گیرد و شروعِ شمارش را با تماشای پیکسل‌های تایمر تشخیص می‌دهد.
> **EN:** A Chrome extension that borrows its clicks from Chrome itself — and knows when the countdown *truly* starts by watching the timer's own pixels.

🇮🇷 [فارسی](#-فارسی) | 🇬🇧 [English](#-english)

📌 **نسخهٔ فعلی: `3.2.1`** — موتور Burst + پنل جمع‌وجور

<!-- 
Screenshot
-->

---

## 🇮🇷 فارسی

### بازی چی بود؟

اگر سوپراپ دیجی‌کالا را باز کنید، یک بازی کوچک به اسم «زنگ تخفیف» (Five Second Rush) دارد. قانونش ساده است: یک تایمر که صدم‌ثانیه می‌شمارد، و شما باید **دقیقاً لحظه‌ای که به `05:00` رسید** دکمهٔ توقف را بزنید. برنده شوید، کد تخفیف می‌گیرید. روزانه هم ۱۰ شانس دارید.

ساده به نظر می‌رسد؟ پنجرهٔ برد اگر خوش‌بین باشیم **۱۰ میلی‌ثانیه** است، در حالی که واکنش معمول یک آدم حدود ۲۰۰ میلی‌ثانیه طول می‌کشد. یعنی شما عملاً دارید بخت‌آزمایی می‌کنید، نه بازی. بعد از چند روز که همهٔ شانس‌هایم را در دورریز گذاشتم، به‌جای تسلیم، تصمیم گرفتم مهندسی را با مهندسی جواب بدهم. این مخزن، گزارشِ همان زورآزمایی است — و ابزارش.

### بازی چطور ساخته شده بود؟

رفتم زیر کاپوت و چیزی که پیدا کردم جدی بود:

* **معماری:** `Next.js`/`React` برای صفحه + کامپوننت‌های **Lit** با **Shadow DOM** برای بخش‌های محصورشده. DOM صفحه مثل پیاز است.
* **کلاس‌های هش‌شده:** `styles-module-scss-module__fWtvNG__button` — اسم کلاس‌ها با هر بیلد عوض می‌شوند؛ نوشتن سلکتور ثابت عملاً بی‌فایده است.
* **فیلتر رویدادهای جعلی:** رویدادهای `dispatchEvent`-شده (با `isTrusted=false`) توسط هندلرهای بازی نادیده گرفته می‌شوند. اسکریپت Tampermonkey من روی هر چیزی در صفحه کلیک می‌کرد — هر چیزی جز خودِ دکمهٔ شروع.
* **تایمرِ Canvas:** شمارندهٔ بازی اصلاً متن DOM نیست؛ یک `<canvas class="…__digits" width="424" height="83">` است که ارقام روی آن *نقاشی* می‌شوند. نه متنی برای خواندن دارد، نه رویدادی برای شنیدن.
* **منطق ناهم‌متقارن کلیک:** شمارش با **رهاکردنِ** دکمهٔ شروع راه می‌افتد (بعد از انیمیشن زنگ) ولی توقف با **فشردن** ثبت می‌شود. یعنی «کِی کلیک می‌کنی» به‌اندازهٔ «چقدر نگهش می‌داری» مهم است.
* **مکث شروعِ تصادفی:** شمارندهٔ بازی واقعاً حدود ۹۰ تا ۲۵۰ میلی‌ثانیه بعد از کلیکِ شروع روشن می‌شود — و این عدد بین اجراها ثابت نمی‌ماند.
* **تلهٔ اسکرول:** درست بعد از شروع، صفحه خودش کمی بالا می‌اسکرول می‌شود و دکمه جابه‌جا می‌شود. هر ابزاری که با مختصات ثابت کلیک کند، به جای خالی شلیک می‌کند و می‌بازد.
* **محدودیت سمت سرور:** ۱۰ تلاش در روز که سمت سرور اعتبارسنجی می‌شود. حلقهٔ بی‌نهایتِ brute-force بی‌معناست.

جالب‌ترین لحظهٔ کاوش؟ اولش مطمئن بودم دکمه داخل Shadow DOM است و برای نفوذ به `shadowRoot` کد نوشتم. بعد یک dump از DOM گرفتم و دیدم دکمه یک `<button>` سادهٔ React در DOM معمولی است. درِ بسته‌ای که کلیدش جای دیگری بود: **اصالت رویداد**.

### چرا Tampermonkey جواب نداد

مسیر کاملش را رفتم:

1. شبیه‌سازی توالی کامل رویدادها (از `pointerdown` تا `click`) — بازی بی‌اعتنا بود.
2. جعل `isTrusted` روی خودِ رویداد با `Object.defineProperty` — کار می‌کند، ولی هیچ تضمینی نیست کدام چکِ native پشت صحنه منتظرت باشد.
3. صدا زدن مستقیم هندلرهای React از `__reactProps$` — هک قشنگی است، ولی حس‌وحال باخت داد.

**نتیجه:** در دنیای userscript هیچ راهی وجود ندارد که رویدادی «واقعاً» از موس یا کیبورد سیستم متولد شود. باید یک لایه بالاتر می‌رفتم.

### ایدهٔ اول: کلیک از سمتِ خودِ کروم

افزونه با دسترسی `chrome.debugger` به تب وصل می‌شود و از طریق پروتکل CDP دستور `Input.dispatchMouseEvent` می‌فرستد. این رویدادها از **پایپ‌لاین ورودی خودِ کروم** تزریق می‌شوند: هیت‌تست را خود مرورگر انجام می‌دهد، Shadow DOM و iframe را خودش حل می‌کند، و `isTrusted === true` است — واقعاً، نه جعلی. از دید بازی، این همان کلیک دستِ توست.

### 🕵️ ماجرای دوم: شمارش دقیقاً کِی شروع می‌شود؟

کلیک‌ها حل شده بودند، اما یک دشمن نرم‌تر مانده بود: **مکث تصادفی شروع**. هر «تأخیر» ثابتی که تنظیم می‌کردی دیر یا زود می‌شکست؛ چون در حالتِ باز (open-loop) داری یک متغیر تصادفی را با یک عدد ثابت شکار می‌کنی.

**تلاش اول — تماشای صفحه (Screen Capture):** تصویر زندهٔ خودِ تب را می‌گرفتیم و ناحیهٔ تایمر را مقایسهٔ پیکسلی می‌کردیم. کار می‌کرد، اما دو دام داشت: نگاشتِ مختصات ویدیو↔صفحه در زوم/DPRهای مختلف خطا می‌داد، و چون «کل صفحه» دیده می‌شد، حتی چراغ کوچکِ وضعیتِ پنلِ خودِ افزونه هم می‌توانست شمارش را «شروع‌شده» جا بزند! نتیجه: تریگرهای کاذب روی صفحهٔ خالی.

**تلاش دوم — کشف بزرگ:** چون content script با صفحه هم‌مبدأ است، می‌تواند bitmap خودِ آن canvas تایمر را **مستقیم** بخواند (`drawImage` → `getImageData`). یعنی: بدون دیالوگ Share، بدون نگاشت مختصات، و کاملاً مصون از اسکرول، پنل و هر اتفاقِ اطراف. فقط پیکسل‌های خودِ تایمر را می‌بینیم.

**تلاش سوم — دامِ انیمیشن:** تایمر حتی وقتی روی `00:00` ثابت است، مدام دوباره رندر می‌شود (پالس/درخشش ظریف تم تخته‌سیاهی). مقایسهٔ فریم‌ها با یک «پایهٔ ثابت» به‌مرور از آستانه رد می‌شد و تریگر کاذب می‌زد — حتی وقتی بازی اصلاً شروع نشده بود.

**راه‌حل نهایی — موتور Burst:** دو تغییر در منطق:

1. مقایسهٔ **فریم‌به‌فریم** (نه با پایهٔ ثابت): شمارش واقعی یعنی هر فریم با فریمِ قبلش متفاوت است؛ درخششِ آرامِ حالت سکون تقریباً هیچ فریم‌به‌فریمی ندارد.
2. **الگوی نرخ:** شمارش فقط وقتی پذیرفته می‌شود که حداقل **۵ تغییرِ پیاپی در پنجرهٔ ۴۵۰ms** ببینیم — امضای تیکِ صدم‌ثانیه‌ها. یک چشمک یا درخشش نمی‌تواند این الگو را جعل کند.

ضمناً فقط **۳۸٪ آخر canvas** (رقم صدم‌ثانیه — سریع‌ترین بخش در شمارش) تحت نظر است؛ چشمکِ دونقطه بیرونِ ناحیه است.

**نتیجه:** تریگر دقیقاً روی اولین تکانِ واقعی تایمر می‌نشیند، مکث تصادفی شروع از معادله حذف می‌شود، و اگر تشخیص شکست بخورد، اجرا **بدون هیچ کلیک نهایی** لغو می‌شود — یعنی هیچ شانسی برای شلیک کور هدر نمی‌رود.

### معماری
```text
    zang-takhfif-shekan/
    ├── manifest.json    ← MV3؛ فقط یک مجوز: debugger
    ├── background.js    ← موتور کلیک CDP + زمان‌بند میلی‌ثانیه‌ای
    └── content.js       ← پنل، موتور Burst (خواندن canvas)، ردیابی دکمه، کالیبراسیون
```
### ⚙️ جریان کار

* موس را روی دکمهٔ «شروع زنگ» می‌گذارید و کلید `K` را می‌زنید.
* `content script` سلامت canvas تایمر را بررسی و مختصات و تنظیمات را به `service worker` می‌فرستد.
* `worker` دیباگر را متصل کرده، رویداد `press` شروع را همان‌جا و رویداد `release` را پس از «فاصلهٔ انسانی» تزریق می‌کند.
* هم‌زمان موتور Burst شروع به تماشای bitmap تایمر می‌کند: مقایسهٔ فریم‌به‌فریمِ ناحیهٔ رقم صدم‌ثانیه.
* مکث تصادفی بازی تمام می‌شود، ارقام شروع به تکان می‌کنند و با ۵ تغییر پیاپی در ۴۵۰ms، تریگر تأیید می‌شود — دقیقاً روی اولین حرکت واقعی.
* `تریگر + زمان توقف − جبران − پیش‌ارسال` به worker ارسال و با زمان‌بند میلی‌ثانیه‌ای (setTimeout + busy-wait) کلیک توقف زمان‌بندی می‌شود.
* دکمهٔ توقف حین اجرا **به‌صورت زنده ردیابی می‌شود** (هر ۲۵۰ms + دو بار دقیقاً قبل از توقف) تا اسکرول خودکار بازی جبران شود — مثل دستی که دکمه را دنبال می‌کند.
* در لحظهٔ هدف، `press` و `release` توقف تزریق می‌شود و لاگ‌ها زمان‌بندی داخلی را گزارش می‌کنند.

### ✨ امکانات

* 🔐 **کلیک‌های ۱۰۰٪ Trusted:** تزریق واقعی رویداد از سطح پایپ‌لاین CDP مرورگر.
* ⚡ **موتور Burst:** تشخیص شروعِ واقعیِ شمارش با تماشای bitmap تایمر (فریم‌به‌فریم + الگوی نرخ) — مصون از انیمیشن idle، پنل، اسکرول و چراغ‌های وضعیت.
* 👁 **خواندن مستقیم Canvas:** بدون Share، بدون OCR، بدون وابستگی خارجی.
* 🧪 **تست تماشا:** تست کامل موتور تشخیص **بدون هیچ کلیکی** — حتی یک شانس هم مصرف نمی‌شود.
* 📊 **نمایشگر Δ زنده:** اختلاف پیکسلی فریم‌به‌فریم را با چشم ببینید و آستانه را دقیق تیون کنید.
* 🩺 **نشانگر سلامت:** تأیید یافتنِ canvas تایمر قبل از اجرا.
* 🎯 **ردیابی پویای دکمه:** جبران خودکار تلهٔ اسکرول بازی.
* 🧯 **شکست = لغو، نه شلیک کور:** اگر الگوی شمارش دیده نشود، هیچ کلیک توقفی زده نمی‌شود.
* 🎚 **پنل جمع‌وجور:** نمایشگر تایمر و دکمهٔ ریست همیشه ثابت؛ تنظیمات با اسکرول در دسترس. ذخیرهٔ خودکار تنظیمات در `localStorage`.
* ⌨️ **کنترل سریع با کیبورد:** کلید `K` اجرا، کلید `T` کلیک تستی.
* 🔀 **سه روش همگام‌سازی:** canvas مستقیم (پیشنهادی) / پیکسل + اشتراک صفحه (پشتیبان) / خاموش (تأخیر ثابت).

### 🎚 جدول کامل تنظیمات
*(بر اساس کنترل‌های موجود در پنل افزونه)*

| کنترل در پنل | پیش‌فرض | عملکرد | مثال / توصیه |
| :--- | :---: | :--- | :--- |
| **روش همگام‌سازی شروع** | `canvas` | نحوهٔ تشخیص شروع شمارش: خواندن مستقیم bitmap تایمر / پیکسل + اشتراک صفحه / خاموش (تأخیر ثابت). | `canvas` |
| **آستانهٔ Δ تشخیص حرکت** | `8` | حداقل اختلاف پیکسلیِ فریم‌به‌فریم برای ثبت «تغییر». | تریگر کاذب؟ بالاتر (`10`–`15`). تریگر نمی‌دهد؟ پایین‌تر (`4`–`6`). |
| **جبران تأخیر تریگر** (ms) | `20` | جبران تأخیرِ «دیدنِ» اولین تغییرات — پیچ دوم کالیبراسیون. | هر `0.01s` خطای ثابت ⇐ `+10ms` |
| **تأخیر بعد از کلیک شروع** (ms) | `80` | فقط در حالت «خاموش» فعال است (در حالت همگام بی‌اثر). | — |
| **زمان توقف / آفست** (ثانیه) | `5.00` | فاصلهٔ تریگر تا کلیک توقف — **پیچ اصلی کالیبراسیون**. | طبق جدول کالیبراسیون زیر. |
| **فاصلهٔ انسانی press→release** (ms) | `90` | هر کلیک چند میلی‌ثانیه نگه‌داشته شود تا شبیه رفتار انسان باشد. | بین `50` تا `90` |
| **توقف ثبت شود روی** | `فشردن` | مبنای زمانی کلیک توقف: فشردن (`pointerdown`) یا رهاکردن (`click`). | `فشردن` |
| **پیش‌ارسال CDP** (ms) | `0` | ارسالِ زودترِ دستورات برای خنثی‌کردن تأخیر تزریق پروتکل. | عددی که لاگِ «رسیدن press» نشان می‌دهد. |
| ☑️ **آماده‌سازی خودکار** | `خاموش` | پس از پایان اجرا، بدون ریست دستی مجدداً منتظر کلید می‌ماند. | برای زدنِ پشت‌سرهمِ شانس‌های روزانه. |

#### 🕹 کنترل‌های اجرا

| کلید / دکمه | عملکرد |
| :--- | :--- |
| **کلید `K`** | اجرای کامل: **کلیک شروع ⬅️ تماشای تایمر ⬅️ تریگر ⬅️ کلیک توقف** |
| **کلید `T`** | یک کلیک تستیِ Trusted در محل فعلیِ موس (سلامت موتور کلیک). |
| **دکمهٔ 🧪 «تست تماشا»** | ۱۲ ثانیه تماشای بدون کلیک: بازی را دستی شروع کنید و سلامت موتور تشخیص را ببینید — بدون مصرف شانس. |
| **دکمهٔ 🎥 دیده‌بان** | فقط روش «پیکسل»: فعال/غیرفعال‌سازی اشتراک صفحه + کالیبراسیون خودکار با مارکر. |
| **دکمهٔ «⟳ ریست»** | لغو توالی در حال اجرا و آماده‌سازی مجدد (همیشه در پایینِ ثابت پنل). |
| **دکمهٔ `–` / درگ هدر** | جمع‌کردن بدنهٔ پنل (نمایشگر بالای پنل سر جایش می‌ماند) یا جابه‌جایی پنل. |

> 💡 **مدل ذهنی زمان:**
> عددی که بازی در لحظهٔ توقف نشان می‌دهد ≈ `زمان توقف − جبران تریگر + λ`
> که λ همان تأخیرِ کوانتیزه‌شدهٔ «دیدن» است (چند ده میلی‌ثانیه، وابسته به فریم رندر). عملاً: هر `0.01` ثانیه خطا ⇐ `10ms` تنظیم در «زمان توقف» یا «جبران تریگر».

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
| **`05:00` (همراه با برد)** | 🎉 موفقیت‌آمیز! کد تخفیف را دریافت کنید. |
| **`05:00` (بدون برد)** | «زمان توقف» را دقیقاً در مرکز پنجرهٔ شانس قرار دهید (مثلاً `4.995`). |
| **`04:99`** | «زمان توقف» را `+0.01` افزایش دهید (یا «جبران تریگر» را `+10ms`). |
| **`05:01`** | «زمان توقف» را `-0.01` کاهش دهید (یا «جبران تریگر» را `-10ms`). |
| **نوسان بین دو عدد** | اثر کوانتیزاسیون فریم رندر است؛ هدف را وسط پنجره بگذارید (اعشار سه‌رقمی مجاز است). |

#### 📌 نکات کلیدی کالیبراسیون

* **اول تست، بعد شانس:** قبل از اولین اجرای واقعی، دکمهٔ **🧪 «تست تماشا»** را بزنید، بازی را دستی شروع کنید و ببینید موتور تریگر می‌زند — این تست هیچ کلیکی نمی‌زند و هیچ شانسی مصرف نمی‌کند.
* **تفاوت زمان پنل با بازی:** عدد پنل، ساعتِ داخلی افزونه است و ملاک نیست؛ همیشه فقط عدد بازی را ببینید.
* **عدم رفرش در حین کالیبراسیون:** بین تلاش‌های متوالی صفحه را Refresh نکنید؛ تنظیمات در `localStorage` حفظ می‌شوند ولی شرایط رندر بازی عوض می‌شود.

---

### 📝 یادداشت‌های میدانی (تجربیات فنی)

* 🛑 **نوار دیباگ کروم:** پیام بالای مرورگر مبنی بر `"Extension started debugging this browser"` طبیعی است. آن را Cancel نکنید؛ پس از اتمام عملیات خودکار بسته می‌شود.
* 🛑 **تداخل DevTools:** ابزار DevTools (Inspect) نباید روی همان تب باز باشد؛ پروتکل CDP اجازهٔ اتصال هم‌زمان دو دیباگر به یک تب را نمی‌دهد.
* 🛑 **تنظیمات نمایش:** میزان Zoom پیج روی `100%` باشد. در حین اجرا اسکرول نکنید. زبان کیبورد روی انگلیسی باشد!
* 🛑 **تداخل اسکریپت‌ها:** در صورت فعال بودن اسکریپت‌های مشابه در Tampermonkey، آن‌ها را غیرفعال کنید تا از اجرای هم‌زمان روی کلید `K` جلوگیری شود.
* 🩺 **اگر تریگر نشد:** اگر لاگ گفت «الگوی شمارش دیده نشد»، یعنی بازی شروع نشده یا آستانه نامناسب است — با 🧪 عیب‌یابی کنید و «آستانهٔ Δ» را تنظیم کنید. اجرا خودکار بدون کلیک لغو شده است.

---

### ⚖️ محدودیت‌ها و سلب مسئولیت

* این افزونه تعداد شانس‌های روزانه را افزایش نداده و منطق سمت سرور را تغییر نمی‌دهد؛ بلکه تنها پنجرهٔ زمانی ۱۰ میلی‌ثانیه‌ای را از خطای انسانی خارج کرده و به دقت اتوماسیون می‌سپارد.
* موتور Burst مکث تصادفی شروع را حذف می‌کند، اما **کوانتیزاسیون فریم رندر** (~۱۷ms) و نوسان تأخیر دیدن باقی می‌ماند؛ به همین دلیل عدد بازی ممکن است گاهی بین دو مقدار مجاور بپرد — راه‌حل، هدف‌گیری وسط پنجره است.
* **Disclaimer:** این پروژه صرفاً یک نمونهٔ پژوهشی در زمینهٔ مهندسی معکوس و اتوماسیون مرورگر (Browser Automation) بوده و جهت اهداف آموزشی منتشر شده است. مسئولیت رعایت قوانین پلتفرم هدف بر عهدهٔ استفاده‌کننده است.

---

<a id="english"></a>

## 🇬🇧 English

## 🕹️ The Game: "Discount Bell"

Digikala (Iran's largest e-commerce platform) runs a mini-game in their superapp called **"Discount Bell"** (Five Second Rush). The rules are deceptively simple: a timer counts in hundredths of a second, and you must hit stop **exactly when it reads `05:00`**. Win, and you get a discount coupon. You are granted 10 attempts per day.

Sounds easy? Your winning window is roughly **10 milliseconds**, whereas average human reaction time is around 200ms. You aren't playing — you're gambling. After burning my daily attempts for a week, I stopped surrendering and started engineering. This repository documents that reverse-engineering journey — and the automation tool born from it.

---

## 🔍 Engineering Breakdown: How the Opponent Was Built

* **Architecture:** A `Next.js`/`React` single-page application integrating **Lit** web components with **Shadow DOM** encapsulation.
* **Hashed Class Names:** SCSS modules generate dynamic classes (e.g., `styles-module-scss-module__fWtvNG__button`) that rotate with builds, rendering static selectors useless.
* **Synthetic Event Filtering:** Scripted events (`isTrusted = false`) are intercepted and ignored by internal React synthetic event listeners. Standard userscripts happily click elements, but fail to trigger actual game logic.
* **Canvas Timer:** The game's countdown is *not* DOM text at all — it's a `<canvas class="…__digits" width="424" height="83">` where the digits are **painted**. There is no text to read and no event to listen to.
* **Asymmetric Click Semantics:** The timer starts on button **release** (after the bell animation) but registers the stop on **press** (`pointerdown`). *When* you click matters as much as *how long* you hold it.
* **Random Startup Pause:** The counter actually initiates ~90–250ms *after* the start click — a value that drifts between executions.
* **The Scroll Trap:** Immediately after initiation, the page auto-scrolls, physically moving the button element. Fixed-coordinate automation shoots into empty space.
* **Server-Side Validation:** Attempt limits (10/day) are enforced server-side, making naive brute-force loops completely ineffective.

> 💡 **Key Insight:** Initial inspection hinted that the button resided deep within a Shadow DOM tree. DOM dumps revealed a standard React `<button>` in the light DOM. The actual protection layer wasn't encapsulation — it was **Event Authenticity**.

---

## 🛑 Why Userscripts (Tampermonkey) Failed

1. **Full Synthetic Event Dispatching:** Sequence chains (`pointerdown` → `mousedown` → `mouseup` → `click`) were ignored by internal React handlers.
2. **Property Spoofing:** Redefining `isTrusted` via `Object.defineProperty` bypasses superficial checks, but fails against browser-native validation deeper in the pipeline.
3. **React Fiber Hooking:** Calling internal handlers directly via `__reactProps$` worked, but bypassed the native interaction lifecycle entirely.

**Conclusion:** Userscripts operating strictly within the DOM cannot generate genuine hardware-level events. The game required moving one abstraction layer up: **The Browser Debugging Protocol.**

---

## ⚡ Solution #1: Chrome DevTools Protocol (CDP)

The extension leverages the `chrome.debugger` API to attach to the target tab and dispatch low-level input commands via **CDP**:

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

## 🕵️ The Second Mystery: When Does Counting *Actually* Begin?

With clicks solved, a subtler enemy remained: the **random startup pause**. Any fixed "delay" eventually broke — in open-loop mode you're hunting a random variable with a constant.

* **Attempt 1 — Screen Capture:** Live tab capture + pixel-diff of the timer region. It worked, but video↔page coordinate mapping drifted with zoom/DPR, and since the *entire page* was visible, even the extension panel's tiny status lamp could falsely "start" the countdown.
* **Attempt 2 — The Big Discovery:** Being same-origin, a content script can read the timer canvas's bitmap **directly** (`drawImage` → `getImageData`). No Share dialog, no coordinate mapping, immune to scrolling and everything happening around it. Only the timer's own pixels are watched.
* **Attempt 3 — The Animation Trap:** The timer repaints constantly even while frozen at `00:00` (a subtle blackboard-theme pulse). Diffing against a static baseline eventually crossed the threshold and fired false triggers.
* **Final Solution — The Burst Engine:** Two logical changes: **(1) frame-to-frame comparison** (real counting means every frame differs from the previous one; idle shimmer barely changes frame-to-frame), and **(2) a rate pattern**: counting is only confirmed after **5 consecutive changes within a 450ms window** — the signature of hundredth-ticks. A blink cannot fake that. Only the **last 38% of the canvas** (the hundredths digit — the fastest-changing zone) is watched; the blinking colon is outside the region.

**Result:** the trigger lands precisely on the timer's first real tick, the random startup pause is eliminated from the equation, and if detection ever fails, the run is **cancelled without any stop click** — no attempt wasted on a blind shot.

---

## 🏗 Architecture

```text
    zang-takhfif-shekan/
    ├── manifest.json    ← Manifest V3 (requires single permission: "debugger")
    ├── background.js    ← CDP click engine + millisecond scheduler
    └── content.js       ← Control panel, Burst engine (canvas reading), button tracking, calibration
```

### 🔄 Execution Flow

1. **Targeting:** Hover over the "Start" button and press `K`.
2. **Handoff:** The content script verifies timer-canvas health, then forwards coordinates and parameters to the background Service Worker.
3. **Initiation:** The worker attaches the debugger (persistent connection) and dispatches the start `mousePressed` immediately, followed by `mouseReleased` after the configured "Human Gap".
4. **Surveillance:** The Burst engine watches the timer canvas bitmap: frame-to-frame diffing of the hundredths-digit zone.
5. **Trigger:** The game's random pause ends, digits start ticking, and 5 consecutive changes within 450ms confirm the trigger — right on the first real movement.
6. **Precision Scheduling:** `trigger + stop time − compensation − CDP lead` is sent to the worker, which arms the stop click with a millisecond scheduler (`setTimeout` + busy-wait).
7. **Dynamic Tracking:** The stop button is tracked live (every 250ms plus twice right before the stop) to compensate the game's auto-scroll.
8. **Stop & Telemetry:** At the target millisecond, the stop press/release is injected; logs report internal timing for your next calibration.

---

## ✨ Features

* 🔐 **100% Trusted Clicks:** Input injection via CDP at the browser pipeline layer (`isTrusted === true`).
* ⚡ **Burst Engine:** Detects the *actual* start of counting by watching the timer canvas bitmap (frame-to-frame + rate pattern) — immune to idle animations, the panel, scrolling, and status lamps.
* 👁 **Direct Canvas Reading:** No screen share, no OCR, no external dependencies.
* 🧪 **Watch Test:** Full detection-engine test **without a single click** — burns zero attempts.
* 📊 **Live Δ Meter:** See the frame-to-frame pixel difference in real time and tune the threshold precisely.
* 🩺 **Health Indicator:** Confirms the timer canvas is found before you run.
* 🎯 **Dynamic Button Tracking:** Auto-compensates the game's scroll trap.
* 🧯 **Fail-Safe:** Detection failure = clean cancellation, never a blind stop click.
* 🎚 **Compact Panel:** Timer display and Reset button always pinned; settings scroll inside. Settings persist via `localStorage`.
* ⌨️ **Hotkeys:** `K` for a full run, `T` for a trusted test click.
* 🔀 **Three Sync Methods:** direct canvas (recommended) / pixel + screen share (fallback) / off (fixed delay).

---

## ⚙️ Settings & Configuration

| Panel Control | Default | Function | Recommended Usage |
| :--- | :---: | :--- | :--- |
| **Sync Method** | `canvas` | How the counting start is detected: direct timer bitmap / pixel + screen share / off (fixed delay). | `canvas` |
| **Δ Threshold** | `8` | Minimum frame-to-frame pixel difference to count as a "change". | False triggers? Raise (`10`–`15`). No trigger? Lower (`4`–`6`). |
| **Trigger Compensation** (ms) | `20` | Absorbs the "seeing" latency of the first changes — the secondary calibration knob. | Every `0.01s` of constant error ⇐ `+10ms` |
| **Start Delay** (ms) | `80` | Only active in "off" mode (ignored in sync modes). | — |
| **Stop Time / Offset** (s) | `5.00` | Time from trigger to the stop click — **Primary Calibration Control**. | Follow the calibration table. |
| **Human Gap** (ms) | `90` | Press-to-release holding duration to simulate a physical click. | `50`–`90` ms |
| **Stop Registers On** | `Press` | Timing anchor for the stop click: `Press` or `Release`. | `Press` |
| **CDP Lead** (ms) | `0` | Sends events early to cancel CDP transport latency. | Match the "press arrival" log value. |
| ☑️ **Auto-Rearm** | `Off` | Automatically re-arms after each run without manual reset. | Enable for consecutive daily attempts. |

### Runtime Controls

| Action | Execution |
| :--- | :--- |
| **Hotkey `K`** | Full run: **Start Click ➔ Timer Surveillance ➔ Trigger ➔ Stop Click** |
| **Hotkey `T`** | Isolated trusted CDP test click under the cursor. |
| **🧪 Watch Test button** | 12 seconds of click-free watching: start the game manually and verify the detection engine — burns zero attempts. |
| **🎥 Watcher button** | Pixel mode only: toggles screen share + automatic marker calibration. |
| **`⟳ Reset` button** | Cancels the active sequence and re-arms (always pinned at the panel's bottom). |
| **Header / `–` button** | Collapses the panel body (the top display stays visible) or drags the panel. |

> 💡 **Mental Timing Model:**
> `Game Reading ≈ Stop Time − Trigger Compensation + λ`, where λ is the quantized "seeing" latency (a few tens of ms, render-phase dependent). Practically: every `0.01s` of error ⇐ `10ms` of adjustment in **Stop Time** or **Trigger Compensation**.

---

## 🚀 Installation & Setup

1. Clone or download this repository:

```bash
    git clone https://github.com/HyperNima/zang-takhfif-shekan.git
```

2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** via the toggle in the top-right corner.
4. Click **Load unpacked** and select the `zang-takhfif-shekan` directory.
5. Launch the game page. The **"⏱ 5-Second Assistant"** panel overlays on the screen automatically.

---

## 🎯 Usage & Calibration Protocol

> ⚠️ **Golden Rule:** Calibration decisions must be based **exclusively on the timing value displayed by the game UI itself** — ignore panel estimates or perceived timing.

| Game Display | Action Required |
| :--- | :--- |
| **`05:00` (Win)** | 🎉 Calibration complete! Claim coupon. |
| **`05:00` (No Win)** | Target the center of the millisecond window (e.g., `4.995`). |
| **`04:99`** | Increment Stop Time by `+0.01`s (or Trigger Compensation `+10ms`). |
| **`05:01`** | Decrement Stop Time by `-0.01`s (or Trigger Compensation `-10ms`). |
| **Bouncing Values** | Render-frame quantization at work; aim for the middle of the window. |

### Operational Nuances

* **Test First, Spend Later:** Before your first real run, press **🧪 Watch Test**, start the game manually and confirm the engine triggers — this test performs no clicks and burns no attempts.
* **Panel vs. Game:** The panel's number is the extension's internal clock, not a reference. Only the game's number matters.
* **Persistence:** Don't refresh between calibration attempts; settings persist in `localStorage`, but the game's rendering conditions change on reload.

---

## ⚠️ Field Notes & Edge Cases

* 🛑 **Chrome Debugger Banner:** The infobar stating `"Extension started debugging this browser"` is expected. Do not click *Cancel*; it detaches automatically upon completion.
* 🛑 **DevTools Conflict:** Do not open DevTools on the active game tab — Chrome allows one debugger per tab.
* 🛑 **Viewport Scale:** Browser zoom strictly `100%`. No manual scrolling during a run. Keyboard layout in English!
* 🛑 **Extension Conflicts:** Disable userscripts targeting the same hotkeys (`K`).
* 🩺 **No Trigger?** If the log reports "no counting pattern seen", the game never started or the threshold is off — debug with 🧪 and adjust the Δ threshold. The run was already cancelled cleanly with no stop click fired.

---

## ⚖️ Limitations & Disclaimer

* **Fair Play:** This tool **does not** grant additional attempts, bypass server-side validation, or manipulate remote game state. It replaces human reaction latency with millisecond-accurate automation.
* **Residual Jitter:** The Burst engine removes the random startup pause, but render-frame quantization (~17ms) and seeing-latency variance remain — readings may occasionally bounce between adjacent values; aim mid-window.
* **Educational Disclaimer:** This project is a research proof-of-concept in reverse engineering and browser automation, published for learning purposes. Use may violate the target platform's Terms of Service. Use responsibly and at your own risk.

---

*built with `performance.now()`, one busy-wait loop, a 64×14 canvas viewport, and an unreasonable amount of stubbornness.* :))
