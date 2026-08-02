[] huge file summarization
[] odt/docx sections 
[] use ktex instead of mathjax



۲. آیا ویجت آماده نصب روی سایت دیگر است؟
از نظر عملکردی: بله

مسیرهای لازم برای نصب و اجرای ویجت وجود دارند:

GET  /api/widget/public/:widgetKey/config
POST /api/widget/public/:widgetKey/sessions
POST /api/widget/public/:widgetKey/sessions/:sessionKey/messages
GET  /api/widget/public/:widgetKey/sessions/:sessionKey/messages
PUT  /api/widget/public/:widgetKey/sessions/:sessionKey/contact

نشست عمومی به یک Chat در RAG و کاربر Runtime اختصاصی ویجت متصل می‌شود و شناسه داخلی کاربر یا Chat به مرورگر داده نمی‌شود.

در کد فعلی این کنترل‌ها وجود دارند:

فقط Widget منتشرشده قابل استفاده است.
Origin درخواست باید دقیقاً با دامنه منتشرشده برابر باشد.
CORS فقط برای همان Origin صادر می‌شود.
Widget Key و Session Key تصادفی و ۳۲ کاراکتری‌اند.
نشست Preview از نشست Public جداست.
طول سؤال محدود است.
Rate limiter عمومی Express روی درخواست‌ها اعمال می‌شود.
توکن و کلید Runtime user هیچ‌گاه به مرورگر داده نمی‌شود.
از نظر امنیت در برابر سوءاستفاده: هنوز کافی نیست

Origin و CORS اثبات نمی‌کنند که درخواست واقعاً از همان سایت آمده است.

CORS فقط یک سیاست مرورگر است. یک برنامه Server-side، اسکریپت، Bot یا ابزار HTTP می‌تواند Header زیر را خودش ارسال کند:

Origin: https://customer-site.example

API فعلی این درخواست را مشابه درخواست سایت واقعی می‌بیند.

خود مستندات بسته نیز این محدودیت را تصریح کرده‌اند: CORS مجوز رمزنگاری‌شده برای کلاینت‌های غیرمرورگری نیست.

بنابراین پاسخ دقیق سؤال شما این است:

در معماری کاملاً Front-end، هیچ روش قطعی برای اثبات اینکه درخواست واقعاً از صفحه سایت مقصد آمده وجود ندارد؛ چون هر چیزی که در JavaScript مرورگر باشد برای مهاجم نیز قابل مشاهده و بازتولید است.

Widget Key هم Secret نیست؛ زیرا داخل کد نصب سایت دیده می‌شود.

وضعیت فعلی چه چیزهایی را متوقف می‌کند؟

کنترل Origin فعلی جلوی این موارد را می‌گیرد:

نصب ساده Widget روی یک سایت دیگر؛
فراخوانی API از JavaScript مرورگر یک دامنه غیرمجاز؛
استفاده تصادفی یا غیرعمدی از Widget Key در سایت دیگر.

اما جلوی این موارد را نمی‌گیرد:

Bot Server-side با Origin جعلی؛
حمله توزیع‌شده از چند IP؛
ایجاد تعداد زیاد Session؛
مصرف Token و GPU از طریق درخواست‌های خودکار؛
سوءاستفاده از Session Key سرقت‌شده؛
مصرف بودجه یک Widget توسط کاربر مخرب.
حداقل امنیت لازم پیش از انتشار عمومی
۱. Rate limit اختصاصی Widget

Rate limiter عمومی برنامه کافی نیست. باید محدودیت‌های مستقل اضافه شود:

بر اساس Widget
بر اساس IP
بر اساس Session
بر اساس IP + Widget

مثلاً:

ایجاد Session: حداکثر ۵ بار در ۱۰ دقیقه برای هر IP
ارسال پیام: حداکثر ۲۰ پیام در ساعت برای هر Session
ارسال پیام: حداکثر ۶۰ پیام در ساعت برای هر IP و Widget
تعداد پیام هر Session: حداکثر ۵۰

همچنین باید سقف روزانه برای هر Widget وجود داشته باشد:

حداکثر تعداد Session روزانه
حداکثر تعداد پیام روزانه
حداکثر Token مصرفی
حداکثر هزینه یا زمان GPU
حداکثر درخواست هم‌زمان
۲. Bootstrap Token امضاشده

به‌جای اینکه فقط sessionKey در URL استفاده شود، باید Endpoint جدیدی وجود داشته باشد:

POST /api/widget/public/:widgetKey/bootstrap

این Endpoint پس از کنترل Origin و Anti-bot، یک JWT کوتاه‌عمر برگرداند:

{
  "sub": "widget-session",
  "widget": "wdg_xxx",
  "session": "session_xxx",
  "origin": "https://customer.example",
  "exp": 1785700000,
  "jti": "random-nonce"
}

سپس همه درخواست‌ها باید این Token را ارسال کنند:

Authorization: Bearer <short-lived-widget-token>

این Token جلوی استفاده آزاد از یک Session Key حدس‌زده یا کپی‌شده را می‌گیرد، هرچند به‌تنهایی مشکل Origin جعلی را کاملاً حل نمی‌کند.

۳. Turnstile یا CAPTCHA

هنگام ساخت Session یا بعد از رفتار مشکوک باید Challenge ضدربات اعمال شود. بهتر است Challenge در شروع هر گفت‌وگو نمایش داده نشود و فقط بر اساس Risk فعال شود:

درخواست‌های سریع؛
تعداد Session زیاد؛
IP ناشناس یا دیتاسنتری؛
الگوی پیام تکراری؛
مصرف بیش از حد.
۴. تأیید مالکیت دامنه

هنگام Publish باید مالکیت دامنه کنترل شود، مثلاً با یکی از این دو روش:

DNS TXT

یا:

https://target-domain/.well-known/fapco-widget-verification.txt

این کار ثابت می‌کند کسی که Widget را می‌سازد، واقعاً دامنه را در اختیار دارد. البته مالکیت دامنه، تک‌تک درخواست‌های بعدی را احراز نمی‌کند.

۵. روش قوی‌تر برای سایت‌های دارای Backend

اگر سایت مقصد Backend دارد، بهترین روش این است:

برای Widget یک Secret Server-side ایجاد شود.
Secret فقط در Backend سایت مقصد نگهداری شود.
مرورگر از Backend همان سایت یک Token کوتاه‌عمر بگیرد.
Backend سایت مقصد با Secret از API فاپا درخواست Bootstrap کند.
API فاپا Token امضاشده و محدود به همان Widget صادر کند.

در این معماری Secret هرگز وارد JavaScript عمومی نمی‌شود.

این روش بسیار قوی‌تر از CORS است، چون مهاجم باید به Secret Backend سایت مقصد دسترسی داشته باشد.

نتیجه عملی

در وضعیت فعلی:

برای Staging، Demo و نصب محدود آزمایشی مناسب است.
برای انتشار عمومی با هزینه واقعی LLM/GPU هنوز آماده نیست.
قبل از Production حداقل باید Bootstrap Token، Rate limit اختصاصی، Quota و Anti-bot اضافه شود.

همچنین فایل‌های دانش در حال حاضر Snapshot انتشار ندارند؛ یعنی حذف یا اضافه‌کردن فایل بلافاصله روی Widget منتشرشده اثر می‌گذارد. این موضوع نیز در مستندات به‌عنوان محدودیت فعلی ذکر شده است.
