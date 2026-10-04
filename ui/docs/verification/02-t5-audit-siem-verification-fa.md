# راستی‌آزمایی Audit و SIEM در T5

## دامنه و شاهد

workflow: `npm run test:t5:audit-siem`. نتیجهٔ اجرای مستقل: ۷ آزمون PASS، صفر FAIL و صفر skip؛ شاهد قابل اجرای مجدد `tests/target/t5-audit-siem.integration.test.ts` و خروجی `tests/reports/t5-audit-siem.tap`. آزمون، API واقعی، Worker، PostgreSQL، Storage محلی، Qdrant و receiver مستقل HTTPS با CA مورد اعتماد را اجرا می‌کند. endpointهای مدل fixture پروتکل‌اند؛ این گزارش رفتار vLLM واقعی یا SOC مشتری را تأیید نمی‌کند.

## موجودی لایه‌های ثبت رخداد

| لایه | رویداد / قالب | محل نگهداری و دسترسی | وضعیت نگهداری |
| --- | --- | --- | --- |
| API/Worker/Router | operational JSON، route pattern و safe error class، actor/session/request/correlation/run/task | stdout؛ collector و ACL واقعی مشتری مشخص نشده | policy زیرساخت باید اثبات شود |
| Database mutation | before/after allowlist با trigger؛ context اجرا و initiator جدا | `audit.tbl_aud_mutation`؛ نقش runtime مجاز به بازنویسی نیست | retention و legal hold واقعی هنوز تأیید نشده |
| Semantic Audit | upload/Asset/Version/processing/index/query/denial/Governance | `audit.tbl_aud_semantic_event`؛ transaction کسب‌وکار | retention operator procedure لازم است |
| Router Run/Attempt | task/model/endpoint/status/tokens/latency/error metadata | schema `ai_router`؛ بدون prompt/answer/vector | دادهٔ مصرف با دادهٔ مالی یکی نیست |
| SIEM outbox | فقط selected safe envelope، event ID پایدار و ACK/checkpoint | `telemetry.tbl_tel_export`، Worker و receiver مجزا | ACL/retention/SOC واقعی مشتری تأیید نشده |

UTC در timestamp کد/DB ثبت می‌شود؛ هم‌زمانی NTP همهٔ ماشین‌های مشتری از این fixture نتیجه‌گیری نمی‌شود. شناسهٔ session صرفاً ID ممیزی است و token یا credential نیست. actor اجراکننده و initiator اصلی در mutation و semantic evidence جدا هستند.

## نتایج اجرا

| بررسی | نتیجه | شاهد دقیق |
| --- | --- | --- |
| upload → processing → index → query → selected outbox → TLS receiver | PASS | رویدادهای واقعی `file.upload.completed`، `file.asset.committed`، `file.processing.completed`، `knowledge.index.ready` و `knowledge.query.completed` دریافت شدند |
| tenant/session/request/correlation/run | PASS | query و Authority و سه AI Run با همان context اصلی تطبیق داده شدند |
| immutability runtime | PASS | UPDATE/DELETE Audit و disable trigger برای هر دو نقش API و Worker رد شد |
| rollback | PASS | شکست transaction semantic event باقی نگذاشت؛ outbox در همان transaction وابسته است |
| lost ACK / retry | PASS | receiver idempotent همان event ID را دوباره دریافت کرد؛ side effect identity عوض نشد |
| 503 / bounded retry | PASS | تا maxAttempts=2 تلاش شد و سپس FAILED؛ retry نامحدود وجود ندارد |
| UNKNOWN / NONE | PASS | acceptance نامعلوم بدون guarantee تکرار کور نشد؛ تغییر صریح policy idempotent پیش‌شرط بازیابی بود |
| Worker restart / stale lease | PASS | claim منقضی توسط worker جایگزین گرفته شد؛ ACK worker قدیمی lease fence را رد کرد |
| SIEM optional outage | PASS | query و answer واقعی موفق ماند و export backlog پایدار شد |
| redaction | PASS | sentinel متن، سؤال، جواب، filename، locator و credential field در canonical/export evidence نبود |

receiver آزمون مستقل در همان محیط acceptance است. immutability در برابر نقش‌های runtime ثابت شد؛ superuser/host compromise یا حفاظت فایل‌های stdout/SOC اثبات نشده‌اند. تست permanent 4xx و timeout/ACK policy عمومی در regressionهای T4 نیز وجود دارد؛ اجرای این suite به‌تنهایی تمامی شبکه و restart process مشتری را تأیید نمی‌کند.

## دادهٔ ممنوع و کنترل انتقال

متن خام Document، chunk، prompt، answer، password، JWT، refresh token، S3 key، credential-bearing URL و DB secret نباید وارد Audit/SIEM عادی شوند. allowlist در trigger و serializer/envelope این محدودیت را اعمال می‌کند؛ صرف حذف نام فیلد در UI کافی نیست. secretRef فقط در owner انتقال resolve می‌شود. TLS verification روشن است؛ workflow CA آزمون را اضافه می‌کند و `NODE_TLS_REJECT_UNAUTHORIZED=0` را نمی‌پذیرد.

## محدودیت و اقدام بعدی

تأیید مقصد واقعی SIEM، دسترسی collector، retention/legal hold، ساعت‌ها، certificate rotation، شبکهٔ مستقل و policy حساسیت مشتری هنوز لازم است. این موارد در ارزیابی جاری V16 ثبت شده‌اند و PASS آزمون end-to-end آن‌ها را خودکار نمی‌بندد. استثنای تأییدشده‌ای وجود ندارد. داده‌های fixture در tenantهای اختصاصی‌اند؛ پاک‌سازی migration role زیر FORCE RLS ممکن است رکورد تست را نگه دارد. برای حذف آن‌ها RLS ضعیف نشده و purge عمومی اجرا نشده است.
