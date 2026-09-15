# 🔔 زنگ تخفیف شکن | Discount Bell Breaker[cite: 1]

> **فا:** یک افزونهٔ کروم که برای شکست دادن بازی «زنگ تخفیف» دیجی‌کالا، کلیک‌هایش را از خودِ کروم قرض می‌گیرد و شروعِ شمارش را با تماشای پیکسل‌های تایمر تشخیص می‌دهد.[cite: 1]
> **EN:** A Chrome extension that borrows its clicks from Chrome itself — and knows when the countdown *truly* starts by watching the timer's own pixels.[cite: 1]

🇮🇷 [فارسی](#-فارسی) | 🇬🇧 [English](#-english)[cite: 1]

📌 **نسخهٔ فعلی: `3.2.1`** — موتور Burst + پنل جمع‌وجور[cite: 1]

<!-- 
Screenshot
-->[cite: 1]

---

## 🇮🇷 فارسی[cite: 1]

### بازی چی بود؟[cite: 1]

اگر سوپراپ دیجی‌کالا را باز کنید، یک بازی کوچک به اسم «زنگ تخفیف» (Five Second Rush) دارد.[cite: 1] قانونش ساده است: یک تایمر که صدم‌ثانیه می‌شمارد، و شما باید **دقیقاً لحظه‌ای که به `05:00` رسید** دکمهٔ توقف را بزنید.[cite: 1] برنده شوید، کد تخفیف می‌گیرید.[cite: 1] روزانه هم ۱۰ شانس دارید.[cite: 1]

ساده به نظر می‌رسد؟[cite: 1] پنجرهٔ برد اگر خوش‌بین باشیم **۱۰ میلی‌ثانیه** است، در حالی که واکنش معمول یک آدم حدود ۲۰۰ میلی‌ثانیه طول می‌کشد.[cite: 1] یعنی شما عملاً دارید بخت‌آزمایی می‌کنید، نه بازی.[cite: 1] بعد از چند روز که همهٔ شانس‌هایم را در دورریز گذاشتم، به‌جای تسلیم، تصمیم گرفتم مهندسی را با مهندسی جواب بدهم.[cite: 1] این مخزن، گزارشِ همان زورآزمایی است — و ابزارش.[cite: 1]

### بازی چطور ساخته شده بود؟[cite: 1]

رفتم زیر کاپوت و چیزی که پیدا کردم جدی بود:[cite: 1]

* **معماری:** `Next.js`/`React` برای صفحه + کامپوننت‌های **Lit** با **Shadow DOM** برای بخش‌های محصورشده.[cite: 1] DOM صفحه مثل پیاز است.[cite: 1]
* **کلاس‌های هش‌شده:** `styles-module-scss-module__fWtvNG__button` — اسم کلاس‌ها با هر بیلد عوض می‌شوند؛ نوشتن سلکتور ثابت عملاً بی‌فایده است.[cite: 1]
* **فیلتر رویدادهای جعلی:** رویدادهای `dispatchEvent`-شده (با `isTrusted=false`) توسط هندلرهای بازی نادیده گرفته می‌شوند.[cite: 1] اسکریپت Tampermonkey من روی هر چیزی در صفحه کلیک می‌کرد — هر چیزی جز خودِ دکمهٔ شروع.[cite: 1]
* **تایمرِ Canvas:** شمارندهٔ بازی اصلاً متن DOM نیست؛ یک `<canvas class="…__digits" width="424" height="83">` است که ارقام روی آن *نقاشی* می‌شوند.[cite: 1] نه متنی برای خواندن دارد، نه رویدادی برای شنیدن.[cite: 1]
* **منطق ناهم‌متقارن کلیک:** شمارش با **رهاکردنِ** دکمهٔ شروع راه می‌افتد (بعد از انیمیشن زنگ) ولی توقف با **فشردن** ثبت می‌شود.[cite: 1] یعنی «کِی کلیک می‌کنی» به‌اندازهٔ «چقدر نگهش می‌داری» مهم است.[cite: 1]
* **مکث شروعِ تصادفی:** شمارندهٔ بازی واقعاً حدود ۹۰ تا ۲۵۰ میلی‌ثانیه بعد از کلیکِ شروع روشن می‌شود — و این عدد بین اجراها ثابت نمی‌ماند.[cite: 1]
* **تلهٔ اسکرول:** درست بعد از شروع، صفحه خودش کمی بالا می‌اسکرول می‌شود و دکمه جابه‌جا می‌شود.[cite: 1] هر ابزاری که با مختصات ثابت کلیک کند، به جای خالی شلیک می‌کند و می‌بازد.[cite: 1]
* **محدودیت سمت سرور:** ۱۰ تلاش در روز که سمت سرور اعتبارسنجی می‌شود.[cite: 1] حلقهٔ بی‌نهایتِ brute-force بی‌معناست.[cite: 1]

جالب‌ترین لحظهٔ کاوش؟[cite: 1] اولش مطمئن بودم دکمه داخل Shadow DOM است و برای نفوذ به `shadowRoot` کد نوشتم.[cite: 1] بعد یک dump از DOM گرفتم و دیدم دکمه یک `<button>` سادهٔ React در DOM معمولی است.[cite: 1] درِ بسته‌ای که کلیدش جای دیگری بود: **اصالت رویداد**.[cite: 1]

### چرا Tampermonkey جواب نداد[cite: 1]

مسیر کاملش را رفتم:[cite: 1]

1. شبیه‌سازی توالی کامل رویدادها (از `pointerdown` تا `click`) — بازی بی‌اعتنا بود.[cite: 1]
2. جعل `isTrusted` روی خودِ رویداد با `Object.defineProperty` — کار می‌کند، ولی هیچ تضمینی نیست کدام چکِ native پشت صحنه منتظرت باشد.[cite: 1]
3. صدا زدن مستقیم هندلرهای React از `__reactProps$` — هک قشنگی است، ولی حس‌وحال باخت داد.[cite: 1]

**نتیجه:** در دنیای userscript هیچ راهی وجود ندارد که رویدادی «واقعاً» از موس یا کیبورد سیستم متولد شود.[cite: 1] باید یک لایه بالاتر می‌رفتم.[cite: 1]

### ایدهٔ اول: کلیک از سمتِ خودِ کروم[cite: 1]

افزونه با دسترسی `chrome.debugger` به تب وصل می‌شود و از طریق پروتکل CDP دستور `Input.dispatchMouseEvent` می‌فرستد.[cite: 1] این رویدادها از **پایپ‌لاین ورودی خودِ کروم** تزریق می‌شوند: هیت‌تست را خود مرورگر انجام می‌دهد، Shadow DOM و iframe را خودش حل می‌کند، و `isTrusted === true` است — واقعاً، نه جعلی.[cite: 1] از دید بازی، این همان کلیک دستِ توست.[cite: 1]

### 🕵️ ماجرای دوم: شمارش دقیقاً کِی شروع می‌شود؟[cite: 1]

کلیک‌ها حل شده بودند، اما یک دشمن نرم‌تر مانده بود: **مکث تصادفی شروع**.[cite: 1] هر «تأخیر» ثابتی که تنظیم می‌کردی دیر یا زود می‌شکست؛ چون در حالتِ باز (open-loop) داری یک متغیر تصادفی را با یک عدد ثابت شکار می‌کنی.[cite: 1]

**تلاش اول — تماشای صفحه (Screen Capture):** تصویر زندهٔ خودِ تب را می‌گرفتیم و ناحیهٔ تایمر را مقایسهٔ پیکسلی می‌کردیم.[cite: 1] کار می‌کرد، اما دو دام داشت: نگاشتِ مختصات ویدیو↔صفحه در زوم/DPRهای مختلف خطا می‌داد، و چون «کل صفحه» دیده می‌شد، حتی چراغ کوچکِ وضعیتِ پنلِ خودِ افزونه هم می‌توانست شمارش را «شروع‌شده» جا بزند![cite: 1] نتیجه: تریگرهای کاذب روی صفحهٔ خالی.[cite: 1]

**تلاش دوم — کشف بزرگ:** چون content script با صفحه هم‌مبدأ است، می‌تواند bitmap خودِ آن canvas تایمر را **مستقیم** بخواند (`drawImage` → `getImageData`).[cite: 1] یعنی: بدون دیالوگ Share، بدون نگاشت مختصات، و کاملاً مصون از اسکرول، پنل و هر اتفاقِ اطراف.[cite: 1] فقط پیکسل‌های خودِ تایمر را می‌بینیم.[cite: 1]

**تلاش سوم — دامِ انیمیشن:** تایمر حتی وقتی روی `00:00` ثابت است، مدام دوباره رندر می‌شود (پالس/درخشش ظریف تم تخته‌سیاهی).[cite: 1] مقایسهٔ فریم‌ها با یک «پایهٔ ثابت» به‌مرور از آستانه رد می‌شد و تریگر کاذب می‌زد — حتی وقتی بازی اصلاً شروع نشده بود.[cite: 1]

**راه‌حل نهایی — موتور Burst:** دو تغییر در منطق:[cite: 1]

1. مقایسهٔ **فریم‌به‌فریم** (نه با پایهٔ ثابت): شمارش واقعی یعنی هر فریم با فریمِ قبلش متفاوت است؛ درخششِ آرامِ حالت سکون تقریباً هیچ فریم‌به‌فریمی ندارد.[cite: 1]
2. **الگوی نرخ:** شمارش فقط وقتی پذیرفته می‌شود که حداقل **۵ تغییرِ پیاپی در پنجرهٔ ۴۵۰ms** ببینیم — امضای تیکِ صدم‌ثانیه‌ها.[cite: 1] یک چشمک یا درخشش نمی‌تواند این الگو را جعل کند.[cite: 1]

ضمناً فقط **۳۸٪ آخر canvas** (رقم صدم‌ثانیه — سریع‌ترین بخش در شمارش) تحت نظر است؛ چشمکِ دونقطه بیرونِ ناحیه است.[cite: 1]

**نتیجه:** تریگر دقیقاً روی اولین تکانِ واقعی تایمر می‌نشیند، مکث تصادفی شروع از معادله حذف می‌شود، و اگر تشخیص شکست بخورد، اجرا **بدون هیچ کلیک نهایی** لغو می‌شود — یعنی هیچ شانسی برای شلیک کور هدر نمی‌رود.[cite: 1]

### معماری[cite: 1]
```text
    zang-takhfif-shekan/
    ├── manifest.json    ← MV3؛ فقط یک مجوز: debugger
    ├── background.js    ← موتور کلیک CDP + زمان‌بند میلی‌ثانیه‌ای
    └── content.js       ← پنل، موتور Burst (خواندن canvas)، ردیابی دکمه، کالیبراسیون[cite: 1]
```
### ⚙️ جریان کار[cite: 1]

* موس را روی دکمهٔ «شروع زنگ» می‌گذارید و کلید `K` را می‌زنید.[cite: 1]
* `content script` سلامت canvas تایمر را بررسی و مختصات و تنظیمات را به `service worker` می‌فرستد.[cite: 1]
* `worker` دیباگر را متصل کرده، رویداد `press` شروع را همان‌جا و رویداد `release` را پس از «فاصلهٔ انسانی» تزریق می‌کند.[cite: 1]
* هم‌زمان موتور Burst شروع به تماشای bitmap تایمر می‌کند: مقایسهٔ فریم‌به‌فریمِ ناحیهٔ رقم صدم‌ثانیه.[cite: 1]
* مکث تصادفی بازی تمام می‌شود، ارقام شروع به تکان می‌کنند و با ۵ تغییر پیاپی در ۴۵۰ms، تریگر تأیید می‌شود — دقیقاً روی اولین حرکت واقعی.[cite: 1]
* `تریگر + زمان توقف − جبران − پیش‌ارسال` به worker ارسال و با زمان‌بند میلی‌ثانیه‌ای (setTimeout + busy-wait) کلیک توقف زمان‌بندی می‌شود.[cite: 1]
* دکمهٔ توقف حین اجرا **به‌صورت زنده ردیابی می‌شود** (هر ۲۵۰ms + دو بار دقیقاً قبل از توقف) تا اسکرول خودکار بازی جبران شود — مثل دستی که دکمه را دنبال می‌کند.[cite: 1]
* در لحظهٔ هدف، `press` و `release` توقف تزریق می‌شود و لاگ‌ها زمان‌بندی داخلی را گزارش می‌کنند.[cite: 1]

### ✨ امکانات[cite: 1]

* 🔐 **کلیک‌های ۱۰۰٪ Trusted:** تزریق واقعی رویداد از سطح پایپ‌لاین CDP مرورگر.[cite: 1]
* ⚡ **موتور Burst:** تشخیص شروعِ واقعیِ شمارش با تماشای bitmap تایمر (فریم‌به‌فریم + الگوی نرخ) — مصون از انیمیشن idle، پنل، اسکرول و چراغ‌های وضعیت.[cite: 1]
* 👁 **خواندن مستقیم Canvas:** بدون Share، بدون OCR، بدون وابستگی خارجی.[cite: 1]
* 🧪 **تست تماشا:** تست کامل موتور تشخیص **بدون هیچ کلیکی** — حتی یک شانس هم مصرف نمی‌شود.[cite: 1]
* 📊 **نمایشگر Δ زنده:** اختلاف پیکسلی فریم‌به‌فریم را با چشم ببینید و آستانه را دقیق تیون کنید.[cite: 1]
* 🩺 **نشانگر سلامت:** تأیید یافتنِ canvas تایمر قبل از اجرا.[cite: 1]
* 🎯 **ردیابی پویای دکمه:** جبران خودکار تلهٔ اسکرول بازی.[cite: 1]
* 🧯 **شکست = لغو، نه شلیک کور:** اگر الگوی شمارش دیده نشود، هیچ کلیک توقفی زده نمی‌شود.[cite: 1]
* 🎚 **پنل جمع‌وجور:** نمایشگر تایمر و دکمهٔ ریست همیشه ثابت؛ تنظیمات با اسکرول در دسترس.[cite: 1] ذخیرهٔ خودکار تنظیمات در `localStorage`.[cite: 1]
* ⌨️ **کنترل سریع با کیبورد:** کلید `K` اجرا، کلید `T` کلیک تستی.[cite: 1]
* 🔀 **سه روش همگام‌سازی:** canvas مستقیم (پیشنهادی) / پیکسل + اشتراک صفحه (پشتیبان) / خاموش (تأخیر ثابت).[cite: 1]

### 🎚 جدول کامل تنظیمات[cite: 1]
*(بر اساس کنترل‌های موجود در پنل افزونه)*[cite: 1]

| کنترل در پنل | پیش‌فرض | عملکرد | مثال / توصیه |
| :--- | :---: | :--- | :--- |
| **روش همگام‌سازی شروع** | `canvas` | نحوهٔ تشخیص شروع شمارش: خواندن مستقیم bitmap تایمر / پیکسل + اشتراک صفحه / خاموش (تأخیر ثابت). | `canvas` |[cite: 1]
| **آستانهٔ Δ تشخیص حرکت** | `8` | حداقل اختلاف پیکسلیِ فریم‌به‌فریم برای ثبت «تغییر». | تریگر کاذب؟ بالاتر (`10`–`15`). تریگر نمی‌دهد؟ پایین‌تر (`4`–`6`). |[cite: 1]
| **جبران تأخیر تریگر** (ms) | `20` | جبران تأخیرِ «دیدنِ» اولین تغییرات — پیچ دوم کالیبراسیون. | هر `0.01s` خطای ثابت ⇐ `+10ms` |[cite: 1]
| **تأخیر بعد از کلیک شروع** (ms) | `80` | فقط در حالت «خاموش» فعال است (در حالت همگام بی‌اثر). | — |[cite: 1]
| **زمان توقف / آفست** (ثانیه) | `5.00` | فاصلهٔ تریگر تا کلیک توقف — **پیچ اصلی کالیبراسیون**. | طبق جدول کالیبراسیون زیر. |[cite: 1]
| **فاصلهٔ انسانی press→release** (ms) | `90` | هر کلیک چند میلی‌ثانیه نگه‌داشته شود تا شبیه رفتار انسان باشد. | بین `50` تا `90` |[cite: 1]
| **توقف ثبت شود روی** | `فشردن` | مبنای زمانی کلیک توقف: فشردن (`pointerdown`) یا رهاکردن (`click`). | `فشردن` |[cite: 1]
| **پیش‌ارسال CDP** (ms) | `0` | ارسالِ زودترِ دستورات برای خنثی‌کردن تأخیر تزریق پروتکل. | عددی که لاگِ «رسیدن press» نشان می‌دهد. |[cite: 1]
| ☑️ **آماده‌سازی خودکار** | `خاموش` | پس از پایان اجرا، بدون ریست دستی مجدداً منتظر کلید می‌ماند. | برای زدنِ پشت‌سرهمِ شانس‌های روزانه. |[cite: 1]

#### 🕹 کنترل‌های اجرا[cite: 1]

| کلید / دکمه | عملکرد |
| :--- | :--- |
| **کلید `K`** | اجرای کامل: **کلیک شروع ⬅️ تماشای تایمر ⬅️ تریگر ⬅️ کلیک توقف** |[cite: 1]
| **کلید `T`** | یک کلیک تستیِ Trusted در محل فعلیِ موس (سلامت موتور کلیک). |[cite: 1]
| **دکمهٔ 🧪 «تست تماشا»** | ۱۲ ثانیه تماشای بدون کلیک: بازی را دستی شروع کنید و سلامت موتور تشخیص را ببینید — بدون مصرف شانس. |[cite: 1]
| **دکمهٔ 🎥 دیده‌بان** | فقط روش «پیکسل»: فعال/غیرفعال‌سازی اشتراک صفحه + کالیبراسیون خودکار با مارکر. |[cite: 1]
| **دکمهٔ «⟳ ریست»** | لغو توالی در حال اجرا و آماده‌سازی مجدد (همیشه در پایینِ ثابت پنل). |[cite: 1]
| **دکمهٔ `–` / درگ هدر** | جمع‌کردن بدنهٔ پنل (نمایشگر بالای پنل سر جایش می‌ماند) یا جابه‌جایی پنل. |[cite: 1]

> 💡 **مدل ذهنی زمان:**[cite: 1]
> عددی که بازی در لحظهٔ توقف نشان می‌دهد ≈ `زمان توقف − جبران تریگر + λ`[cite: 1]
> که λ همان تأخیرِ کوانتیزه‌شدهٔ «دیدن» است (چند ده میلی‌ثانیه، وابسته به فریم رندر).[cite: 1] عملاً: هر `0.01` ثانیه خطا ⇐ `10ms` تنظیم در «زمان توقف» یا «جبران تریگر».[cite: 1]

### 🚀 نصب[cite: 1]

۱. این مخزن را Clone یا دانلود کنید:[cite: 1]
```bash
    git clone https://github.com/HyperNima/zang-takhfif-shekan.git[cite: 1]
```

۲. مرورگر را باز کرده، به آدرس `chrome://extensions` بروید و از گوشهٔ بالا سمت راست، **Developer mode** را فعال کنید.[cite: 1]
۳. روی دکمهٔ **Load unpacked** کلیک کرده و پوشهٔ `zang-takhfif-shekan` را انتخاب کنید.[cite: 1]
۴. صفحهٔ بازی را باز کنید؛ پنل شناور **«⏱ دستیار ۵ ثانیه»** در کنار صفحه ظاهر می‌شود.[cite: 1]

---

### 🎯 راهنمای استفاده و کالیبراسیون (قانون طلایی)[cite: 1]

> ⚠️ **اصل اساسی:** ملاک کالیبراسیون، **تنها عددی است که خودِ بازی ثبت می‌کند** (نه زمان روی پنل و نه حدس ذهنی).[cite: 1]

| عدد ثبت‌شده در بازی | اقدام اصلاحی |
| :--- | :--- |
| **`05:00` (همراه با برد)** | 🎉 موفقیت‌آمیز! کد تخفیف را دریافت کنید. |[cite: 1]
| **`05:00` (بدون برد)** | «زمان توقف» را دقیقاً در مرکز پنجرهٔ شانس قرار دهید (مثلاً `4.995`). |[cite: 1]
| **`04:99`** | «زمان توقف» را `+0.01` افزایش دهید (یا «جبران تریگر» را `+10ms`). |[cite: 1]
| **`05:01`** | «زمان توقف» را `-0.01` کاهش دهید (یا «جبران تریگر» را `-10ms`). |[cite: 1]
| **نوسان بین دو عدد** | اثر کوانتیزاسیون فریم رندر است؛ هدف را وسط پنجره بگذارید (اعشار سه‌رقمی مجاز است). |[cite: 1]

#### 📌 نکات کلیدی کالیبراسیون[cite: 1]

* **اول تست، بعد شانس:** قبل از اولین اجرای واقعی، دکمهٔ **🧪 «تست تماشا»** را بزنید، بازی را دستی شروع کنید و ببینید موتور تریگر می‌زند — این تست هیچ کلیکی نمی‌زند و هیچ شانسی مصرف نمی‌کند.[cite: 1]
* **تفاوت زمان پنل با بازی:** عدد پنل، ساعتِ داخلی افزونه است و ملاک نیست؛ همیشه فقط عدد بازی را ببینید.[cite: 1]
* **عدم رفرش در حین کالیبراسیون:** بین تلاش‌های متوالی صفحه را Refresh نکنید؛ تنظیمات در `localStorage` حفظ می‌شوند ولی شرایط رندر بازی عوض می‌شود.[cite: 1]

---

### 📝 یادداشت‌های میدانی (تجربیات فنی)[cite: 1]

* 🛑 **نوار دیباگ کروم:** پیام بالای مرورگر مبنی بر `"Extension started debugging this browser"` طبیعی است.[cite: 1] آن را Cancel نکنید؛ پس از اتمام عملیات خودکار بسته می‌شود.[cite: 1]
* 🛑 **تداخل DevTools:** ابزار DevTools (Inspect) نباید روی همان تب باز باشد؛ پروتکل CDP اجازهٔ اتصال هم‌زمان دو دیباگر به یک تب را نمی‌دهد.[cite: 1]
* 🛑 **تنظیمات نمایش:** میزان Zoom پیج روی `100%` باشد.[cite: 1] در حین اجرا اسکرول نکنید.[cite: 1] زبان کیبورد روی انگلیسی باشد![cite: 1]
* 🛑 **تداخل اسکریپت‌ها:** در صورت فعال بودن اسکریپت‌های مشابه در Tampermonkey، آن‌ها را غیرفعال کنید تا از اجرای هم‌زمان روی کلید `K` جلوگیری شود.[cite: 1]
* 🩺 **اگر تریگر نشد:** اگر لاگ گفت «الگوی شمارش دیده نشد»، یعنی بازی شروع نشده یا آستانه نامناسب است — با 🧪 عیب‌یابی کنید و «آستانهٔ Δ» را تنظیم کنید.[cite: 1] اجرا خودکار بدون کلیک لغو شده است.[cite: 1]

---

### ⚖️ محدودیت‌ها و سلب مسئولیت[cite: 1]

* این افزونه تعداد شانس‌های روزانه را افزایش نداده و منطق سمت سرور را تغییر نمی‌دهد؛ بلکه تنها پنجرهٔ زمانی ۱۰ میلی‌ثانیه‌ای را از خطای انسانی خارج کرده و به دقت اتوماسیون می‌سپارد.[cite: 1]
* موتور Burst مکث تصادفی شروع را حذف می‌کند، اما **کوانتیزاسیون فریم رندر** (~۱۷ms) و نوسان تأخیر دیدن باقی می‌ماند؛ به همین دلیل عدد بازی ممکن است گاهی بین دو مقدار مجاور بپرد — راه‌حل، هدف‌گیری وسط پنجره است.[cite: 1]
* **Disclaimer:** این پروژه صرفاً یک نمونهٔ پژوهشی در زمینهٔ مهندسی معکوس و اتوماسیون مرورگر (Browser Automation) بوده و جهت اهداف آموزشی منتشر شده است.[cite: 1] مسئولیت رعایت قوانین پلتفرم هدف بر عهدهٔ استفاده‌کننده است.[cite: 1]

---

<a id="english"></a>[cite: 1]

## 🇬🇧 English[cite: 1]

## 🕹️ The Game: "Discount Bell"[cite: 1]

Digikala (Iran's largest e-commerce platform) runs a mini-game in their superapp called **"Discount Bell"** (Five Second Rush).[cite: 1] The rules are deceptively simple: a timer counts in hundredths of a second, and you must hit stop **exactly when it reads `05:00`**.[cite: 1] Win, and you get a discount coupon.[cite: 1] You are granted 10 attempts per day.[cite: 1]

Sounds easy?[cite: 1] Your winning window is roughly **10 milliseconds**, whereas average human reaction time is around 200ms.[cite: 1] You aren't playing — you're gambling.[cite: 1] After burning my daily attempts for a week, I stopped surrendering and started engineering.[cite: 1] This repository documents that reverse-engineering journey — and the automation tool born from it.[cite: 1]

---

## 🔍 Engineering Breakdown: How the Opponent Was Built[cite: 1]

* **Architecture:** A `Next.js`/`React` single-page application integrating **Lit** web components with **Shadow DOM** encapsulation.[cite: 1]
* **Hashed Class Names:** SCSS modules generate dynamic classes (e.g., `styles-module-scss-module__fWtvNG__button`) that rotate with builds, rendering static selectors useless.[cite: 1]
* **Synthetic Event Filtering:** Scripted events (`isTrusted = false`) are intercepted and ignored by internal React synthetic event listeners.[cite: 1] Standard userscripts happily click elements, but fail to trigger actual game logic.[cite: 1]
* **Canvas Timer:** The game's countdown is *not* DOM text at all — it's a `<canvas class="…__digits" width="424" height="83">` where the digits are **painted**.[cite: 1] There is no text to read and no event to listen to.[cite: 1]
* **Asymmetric Click Semantics:** The timer starts on button **release** (after the bell animation) but registers the stop on **press** (`pointerdown`).[cite: 1] *When* you click matters as much as *how long* you hold it.[cite: 1]
* **Random Startup Pause:** The counter actually initiates ~90–250ms *after* the start click — a value that drifts between executions.[cite: 1]
* **The Scroll Trap:** Immediately after initiation, the page auto-scrolls, physically moving the button element.[cite: 1] Fixed-coordinate automation shoots into empty space.[cite: 1]
* **Server-Side Validation:** Attempt limits (10/day) are enforced server-side, making naive brute-force loops completely ineffective.[cite: 1]

> 💡 **Key Insight:** Initial inspection hinted that the button resided deep within a Shadow DOM tree.[cite: 1] DOM dumps revealed a standard React `<button>` in the light DOM.[cite: 1] The actual protection layer wasn't encapsulation — it was **Event Authenticity**.[cite: 1]

---

## 🛑 Why Userscripts (Tampermonkey) Failed[cite: 1]

1. **Full Synthetic Event Dispatching:** Sequence chains (`pointerdown` → `mousedown` → `mouseup` → `click`) were ignored by internal React handlers.[cite: 1]
2. **Property Spoofing:** Redefining `isTrusted` via `Object.defineProperty` bypasses superficial checks, but fails against browser-native validation deeper in the pipeline.[cite: 1]
3. **React Fiber Hooking:** Calling internal handlers directly via `__reactProps$` worked, but bypassed the native interaction lifecycle entirely.[cite: 1]

**Conclusion:** Userscripts operating strictly within the DOM cannot generate genuine hardware-level events.[cite: 1] The game required moving one abstraction layer up: **The Browser Debugging Protocol.**[cite: 1]

---

## ⚡ Solution #1: Chrome DevTools Protocol (CDP)[cite: 1]

The extension leverages the `chrome.debugger` API to attach to the target tab and dispatch low-level input commands via **CDP**:[cite: 1]

```javascript
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });[cite: 1]
```

These events are injected through **Chrome's own input pipeline**: the browser does the hit-testing, resolves Shadow DOM and iframes natively, and generates events where `isTrusted === true` — making them indistinguishable from hardware input.[cite: 1]

---

## 🕵️ The Second Mystery: When Does Counting *Actually* Begin?[cite: 1]

With clicks solved, a subtler enemy remained: the **random startup pause**.[cite: 1] Any fixed "delay" eventually broke — in open-loop mode you're hunting a random variable with a constant.[cite: 1]

* **Attempt 1 — Screen Capture:** Live tab capture + pixel-diff of the timer region.[cite: 1] It worked, but video↔page coordinate mapping drifted with zoom/DPR, and since the *entire page* was visible, even the extension panel's tiny status lamp could falsely "start" the countdown.[cite: 1]
* **Attempt 2 — The Big Discovery:** Being same-origin, a content script can read the timer canvas's bitmap **directly** (`drawImage` → `getImageData`).[cite: 1] No Share dialog, no coordinate mapping, immune to scrolling and everything happening around it.[cite: 1] Only the timer's own pixels are watched.[cite: 1]
* **Attempt 3 — The Animation Trap:** The timer repaints constantly even while frozen at `00:00` (a subtle blackboard-theme pulse).[cite: 1] Diffing against a static baseline eventually crossed the threshold and fired false triggers.[cite: 1]
* **Final Solution — The Burst Engine:** Two logical changes: **(1) frame-to-frame comparison** (real counting means every frame differs from the previous one; idle shimmer barely changes frame-to-frame), and **(2) a rate pattern**: counting is only confirmed after **5 consecutive changes within a 450ms window** — the signature of hundredth-ticks.[cite: 1] A blink cannot fake that.[cite: 1] Only the **last 38% of the canvas** (the hundredths digit — the fastest-changing zone) is watched; the blinking colon is outside the region.[cite: 1]

**Result:** the trigger lands precisely on the timer's first real tick, the random startup pause is eliminated from the equation, and if detection ever fails, the run is **cancelled without any stop click** — no attempt wasted on a blind shot.[cite: 1]

---

## 🏗 Architecture[cite: 1]

```text
    zang-takhfif-shekan/
    ├── manifest.json    ← Manifest V3 (requires single permission: "debugger")
    ├── background.js    ← CDP click engine + millisecond scheduler
    └── content.js       ← Control panel, Burst engine (canvas reading), button tracking, calibration[cite: 1]
```

### 🔄 Execution Flow[cite: 1]

1. **Targeting:** Hover over the "Start" button and press `K`.[cite: 1]
2. **Handoff:** The content script verifies timer-canvas health, then forwards coordinates and parameters to the background Service Worker.[cite: 1]
3. **Initiation:** The worker attaches the debugger (persistent connection) and dispatches the start `mousePressed` immediately, followed by `mouseReleased` after the configured "Human Gap".[cite: 1]
4. **Surveillance:** The Burst engine watches the timer canvas bitmap: frame-to-frame diffing of the hundredths-digit zone.[cite: 1]
5. **Trigger:** The game's random pause ends, digits start ticking, and 5 consecutive changes within 450ms confirm the trigger — right on the first real movement.[cite: 1]
6. **Precision Scheduling:** `trigger + stop time − compensation − CDP lead` is sent to the worker, which arms the stop click with a millisecond scheduler (`setTimeout` + busy-wait).[cite: 1]
7. **Dynamic Tracking:** The stop button is tracked live (every 250ms plus twice right before the stop) to compensate the game's auto-scroll.[cite: 1]
8. **Stop & Telemetry:** At the target millisecond, the stop press/release is injected; logs report internal timing for your next calibration.[cite: 1]

---

## ✨ Features[cite: 1]

* 🔐 **100% Trusted Clicks:** Input injection via CDP at the browser pipeline layer (`isTrusted === true`).[cite: 1]
* ⚡ **Burst Engine:** Detects the *actual* start of counting by watching the timer canvas bitmap (frame-to-frame + rate pattern) — immune to idle animations, the panel, scrolling, and status lamps.[cite: 1]
* 👁 **Direct Canvas Reading:** No screen share, no OCR, no external dependencies.[cite: 1]
* 🧪 **Watch Test:** Full detection-engine test **without a single click** — burns zero attempts.[cite: 1]
* 📊 **Live Δ Meter:** See the frame-to-frame pixel difference in real time and tune the threshold precisely.[cite: 1]
* 🩺 **Health Indicator:** Confirms the timer canvas is found before you run.[cite: 1]
* 🎯 **Dynamic Button Tracking:** Auto-compensates the game's scroll trap.[cite: 1]
* 🧯 **Fail-Safe:** Detection failure = clean cancellation, never a blind stop click.[cite: 1]
* 🎚 **Compact Panel:** Timer display and Reset button always pinned; settings scroll inside.[cite: 1] Settings persist via `localStorage`.[cite: 1]
* ⌨️ **Hotkeys:** `K` for a full run, `T` for a trusted test click.[cite: 1]
* 🔀 **Three Sync Methods:** direct canvas (recommended) / pixel + screen share (fallback) / off (fixed delay).[cite: 1]

---

## ⚙️ Settings & Configuration[cite: 1]

| Panel Control | Default | Function | Recommended Usage |
| :--- | :---: | :--- | :--- |
| **Sync Method** | `canvas` | How the counting start is detected: direct timer bitmap / pixel + screen share / off (fixed delay). | `canvas` |[cite: 1]
| **Δ Threshold** | `8` | Minimum frame-to-frame pixel difference to count as a "change". | False triggers? Raise (`10`–`15`). No trigger? Lower (`4`–`6`). |[cite: 1]
| **Trigger Compensation** (ms) | `20` | Absorbs the "seeing" latency of the first changes — the secondary calibration knob. | Every `0.01s` of constant error ⇐ `+10ms` |[cite: 1]
| **Start Delay** (ms) | `80` | Only active in "off" mode (ignored in sync modes). | — |[cite: 1]
| **Stop Time / Offset** (s) | `5.00` | Time from trigger to the stop click — **Primary Calibration Control**. | Follow the calibration table. |[cite: 1]
| **Human Gap** (ms) | `90` | Press-to-release holding duration to simulate a physical click. | `50`–`90` ms |[cite: 1]
| **Stop Registers On** | `Press` | Timing anchor for the stop click: `Press` or `Release`. | `Press` |[cite: 1]
| **CDP Lead** (ms) | `0` | Sends events early to cancel CDP transport latency. | Match the "press arrival" log value. |[cite: 1]
| ☑️ **Auto-Rearm** | `Off` | Automatically re-arms after each run without manual reset. | Enable for consecutive daily attempts. |[cite: 1]

### Runtime Controls[cite: 1]

| Action | Execution |
| :--- | :--- |
| **Hotkey `K`** | Full run: **Start Click ➔ Timer Surveillance ➔ Trigger ➔ Stop Click** |[cite: 1]
| **Hotkey `T`** | Isolated trusted CDP test click under the cursor. |[cite: 1]
| **🧪 Watch Test button** | 12 seconds of click-free watching: start the game manually and verify the detection engine — burns zero attempts. |[cite: 1]
| **🎥 Watcher button** | Pixel mode only: toggles screen share + automatic marker calibration. |[cite: 1]
| **`⟳ Reset` button** | Cancels the active sequence and re-arms (always pinned at the panel's bottom). |[cite: 1]
| **Header / `–` button** | Collapses the panel body (the top display stays visible) or drags the panel. |[cite: 1]

> 💡 **Mental Timing Model:**[cite: 1]
> `Game Reading ≈ Stop Time − Trigger Compensation + λ`, where λ is the quantized "seeing" latency (a few tens of ms, render-phase dependent).[cite: 1] Practically: every `0.01s` of error ⇐ `10ms` of adjustment in **Stop Time** or **Trigger Compensation**.[cite: 1]

---

## 🚀 Installation & Setup[cite: 1]

1. Clone or download this repository:[cite: 1]

```bash
    git clone https://github.com/HyperNima/zang-takhfif-shekan.git[cite: 1]
```

2. Open Chrome and navigate to `chrome://extensions`.[cite: 1]
3. Enable **Developer mode** via the toggle in the top-right corner.[cite: 1]
4. Click **Load unpacked** and select the `zang-takhfif-shekan` directory.[cite: 1]
5. Launch the game page.[cite: 1] The **"⏱ 5-Second Assistant"** panel overlays on the screen automatically.[cite: 1]

---

## 🎯 Usage & Calibration Protocol[cite: 1]

> ⚠️ **Golden Rule:** Calibration decisions must be based **exclusively on the timing value displayed by the game UI itself** — ignore panel estimates or perceived timing.[cite: 1]

| Game Display | Action Required |
| :--- | :--- |
| **`05:00` (Win)** | 🎉 Calibration complete! Claim coupon. |[cite: 1]
| **`05:00` (No Win)** | Target the center of the millisecond window (e.g., `4.995`). |[cite: 1]
| **`04:99`** | Increment Stop Time by `+0.01`s (or Trigger Compensation `+10ms`). |[cite: 1]
| **`05:01`** | Decrement Stop Time by `-0.01`s (or Trigger Compensation `-10ms`). |[cite: 1]
| **Bouncing Values** | Render-frame quantization at work; aim for the middle of the window. |[cite: 1]

### Operational Nuances[cite: 1]

* **Test First, Spend Later:** Before your first real run, press **🧪 Watch Test**, start the game manually and confirm the engine triggers — this test performs no clicks and burns no attempts.[cite: 1]
* **Panel vs. Game:** The panel's number is the extension's internal clock, not a reference.[cite: 1] Only the game's number matters.[cite: 1]
* **Persistence:** Don't refresh between calibration attempts; settings persist in `localStorage`, but the game's rendering conditions change on reload.[cite: 1]

---

## ⚠️ Field Notes & Edge Cases[cite: 1]

* 🛑 **Chrome Debugger Banner:** The infobar stating `"Extension started debugging this browser"` is expected.[cite: 1] Do not click *Cancel*; it detaches automatically upon completion.[cite: 1]
* 🛑 **DevTools Conflict:** Do not open DevTools on the active game tab — Chrome allows one debugger per tab.[cite: 1]
* 🛑 **Viewport Scale:** Browser zoom strictly `100%`.[cite: 1] No manual scrolling during a run.[cite: 1] Keyboard layout in English![cite: 1]
* 🛑 **Extension Conflicts:** Disable userscripts targeting the same hotkeys (`K`).[cite: 1]
* 🩺 **No Trigger?** If the log reports "no counting pattern seen", the game never started or the threshold is off — debug with 🧪 and adjust the Δ threshold.[cite: 1] The run was already cancelled cleanly with no stop click fired.[cite: 1]

---

## ⚖️ Limitations & Disclaimer[cite: 1]

* **Fair Play:** This tool **does not** grant additional attempts, bypass server-side validation, or manipulate remote game state.[cite: 1] It replaces human reaction latency with millisecond-accurate automation.[cite: 1]
* **Residual Jitter:** The Burst engine removes the random startup pause, but render-frame quantization (~17ms) and seeing-latency variance remain — readings may occasionally bounce between adjacent values; aim mid-window.[cite: 1]
* **Educational Disclaimer:** This project is a research proof-of-concept in reverse engineering and browser automation, published for learning purposes.[cite: 1] Use may violate the target platform's Terms of Service.[cite: 1] Use responsibly and at your own risk.[cite: 1]

---

*built with `performance.now()`, one busy-wait loop, a 64×14 canvas viewport, and an unreasonable amount of stubbornness.* :))[cite: 1]
