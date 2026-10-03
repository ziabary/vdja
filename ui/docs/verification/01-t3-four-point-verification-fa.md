# راستی‌آزمایی چهار مورد باز T3

تاریخ: ۱۴۰۵/۰۷/۱۰. این سند نتیجهٔ آزمون‌های کد و PostgreSQL محلی را ثبت می‌کند؛ آزمون کامل سرویس‌ها با تصویر تازه و گیرندهٔ واقعی SIEM هنوز لازم است.

## ۱. آمادگی AI Router

- مسئله: قطع همهٔ endpointها به‌اشتباه `DEGRADED` گزارش می‌شد و ظرفیت/مدار در ارزیابی لحاظ نمی‌شد.
- رفتار مورد انتظار: وجود مسیر جایگزین سالم `DEGRADED`، نبود مسیر واجد شرایط برای وظیفهٔ ماژول فعال `NOT_READY`، بازگشت endpoint سالم `READY`.
- محل پیاده‌سازی: `packages/ai-router/src/index.ts` و `apps/api/src/index.ts`.
- روش دقیق: پاسخ `/health` یکی از دو endpoint را ۵۰۳ و دیگری را ۲۰۰ کنید؛ سپس هر دو را ۵۰۳ و در پایان هر دو را ۲۰۰ کنید. نتیجهٔ `/ready` باید به‌ترتیب ۲۰۰/DEGRADED، ۵۰۳/NOT_READY، ۲۰۰/READY باشد. موارد mismatch، مدار باز و ظرفیت باید با `reasons()` حذف شوند.
- فرمان خودکار: `node --import tsx --test tests/target/t4-four-point.test.ts` و `npm run test:ai-router`.
- نتیجه: مسیر جایگزین، قطع کامل، mismatch پیکربندی، مدار باز، اتمام ظرفیت، بازیابی و افت SIEM در آزمون‌های متمرکز PASS. آزمون زندهٔ `/ready` با گیرندهٔ مشتری باز است.
- شاهد: `tests/target/t4-four-point.test.ts`؛ `tests/ai-router/router.test.ts`.
- ریسک باقیمانده: پروب `HEAD` گیرنده‌ای که فقط `POST` می‌پذیرد ممکن است DEGRADED کاذب بدهد؛ قرارداد health اختصاصی گیرنده هنوز تعریف نشده است.

## ۲. وابستگی MySQL در تصویر عادی

- مسئله: `mysql2` در قفل وابستگی تصویر API/Worker/Web وجود داشت.
- رفتار مورد انتظار: تصویر عادی بدون `mysql`، `mysql2`، `knex` و راه‌اندازی مشتری MySQL اجرا شود؛ ابزار مهاجرت فقط CLI جداگانه باشد.
- محل پیاده‌سازی: `deploy/runtime/package.json`، قفل آن و `deploy/customer.Dockerfile`؛ CLI موجود `migrate:public-tools:mysql-to-pg` در بستهٔ توسعه.
- روش دقیق: کلیدهای `packages` در قفل runtime و SBOM ساخته‌شده را برای نام این سه بسته بررسی کنید، سپس API/Worker/Web را بدون MySQL اجرا کنید.
- فرمان خودکار: `node --import tsx --test tests/target/t4-four-point.test.ts`؛ `npm run release:customers -- --dry-run`.
- نتیجه: قفل runtime، Dockerfile، SBOM و سه تصویر customer-c نسخهٔ `1.0.1` PASS؛ آزمون زندهٔ هر سه سرویس با MySQL خاموش و ساخت مجدد سایر مشتریان باز است.
- شاهد: `deploy/releases/1.0.1/dependencies.cdx.json` هیچ‌یک از سه بسته را ندارد؛ در تصویر API نیز هر سه `ABSENT` بودند.
- ریسک باقیمانده: تصویرهای T3 قبلی هنوز `mysql2` دارند؛ باید با نسخهٔ جدید جایگزین شوند. تصویر `1.0.1` قبل از آخرین اصلاح readiness ساخته شد و محصول قابل انتشار T4 نیست.

## ۳. وضعیت نامعلوم SIEM

- مسئله: `UNKNOWN` و lease منقضی‌شده بدون تضمین گیرنده دوباره ارسال می‌شدند.
- رفتار مورد انتظار: در تنظیم پیش‌فرض `NONE`، timeout یا از دست رفتن ACK به `UNKNOWN` پایدار برود؛ فقط تضمین صریح `IDEMPOTENT` یا `DUPLICATE_TOLERANT` بازفرستادن را مجاز کند.
- محل پیاده‌سازی: `packages/security-telemetry/src/{worker,persistence}.ts` و `packages/configuration/src/index.ts`.
- روش دقیق: گیرنده رویداد را دریافت کند ولی ACK را حذف کند؛ پس از اتمام lease و restart کارگر، در حالت NONE هیچ فراخوانی دوم نباشد. همین آزمایش را با تضمین صریح گیرنده تکرار کنید. ۵۰۳، ۴xx دائمی و ACK موفق را جداگانه بررسی کنید.
- فرمان خودکار: `node --import tsx --test tests/target/t4-four-point.test.ts`.
- نتیجه: منطق UNKNOWN، انتخاب سیاست، و سناریوی PostgreSQL با گیرنده‌ای که پس از دریافت بدنه ACK را قطع می‌کند PASS. فراخوانی بعدی Worker دوباره ارسال نکرد. گیرندهٔ واقعاً idempotent/duplicate-tolerant و restart فرایند مستقل هنوز NOT_VERIFIED.
- شاهد: `tests/target/t4-four-point.test.ts` و `tests/target/runtime.integration.test.ts`؛ یک تحویل و وضعیت `UNKNOWN` پایدار.
- ریسک باقیمانده: سازگاری واقعی گیرنده با idempotency باید در قرارداد اتصال تأیید شود؛ داشتن event ID به‌تنهایی کافی نیست.

## ۴. طرح‌وارهٔ دیکشنری مترجم

- مسئله: شکل ستون‌های MySQL، ورودی JSON و ذخیره‌سازی JSONB با هم خلط می‌شدند؛ `dicExamples` هم به‌اشتباه از تلفظ خوانده می‌شد.
- رفتار مورد انتظار: PostgreSQL مالک دادهٔ مرجع است؛ `JSON_FILE` و `MYSQL` دو هویت منبع مستقل دارند؛ کلید خالی رد و ترتیب برخورد قطعی است.
- محل پیاده‌سازی: `packages/persistence/src/target-migrations/001-public-runtime.sql` و `modules/translator/src/persistence{,/migrate}.ts`.
- روش دقیق: رکورد `خدا` را از فایل JSON وارد کنید، با فاصلهٔ کناری جست‌وجو کنید، ترجمهٔ `god` را ببینید، کلید خالی را رد کنید و برخورد منبع را با ترتیب `MYSQL` سپس `JSON_FILE` و `source_key` بررسی کنید.
- فرمان خودکار: `node --import tsx --test tests/target/t4-four-point.test.ts`؛ `npm run test:target:integration`.
- نتیجه: اعتبارسنجی و SQL رفتار PASS در آزمون واحد؛ جست‌وجوی زندهٔ PostgreSQL برای «خدا» از `JSON_FILE` و شامل `god` PASS. اجرای دوبارهٔ واردسازی MySQL پس از اصلاح `dicExamples` هنوز NOT_VERIFIED.
- شاهد: `tests/target/t4-four-point.test.ts` و `tests/target/t4-dictionary.integration.test.ts`؛ مشخصات ستون‌ها در بخش زیر.
- ریسک باقیمانده: ورودی‌های MySQL تاریخی با دادهٔ تهی/ناسازگار باید در مهاجرت زنده جداگانه وارسی شوند.

### قرارداد تولیدی دیکشنری

جدول `translator.tbl_trn_dictionary` ستون‌های `trd_id` (شناسهٔ bigint تولیدی)، `trd_source_kind` (`JSON_FILE` یا `MYSQL`)، `trd_source_key` (کلید اصلی فایل یا `dicID` به‌شکل متن)، `trd_lookup_key` (عبارت trim شده و lowercase)، `trd_phrase` (عبارت اصلی)، `trd_payload` (`jsonb`)، `trd_source_sha256`، `trd_created_at` و `trd_updated_at` دارد. کلید یکتای منبع `(trd_source_kind,trd_source_key)` است. زبان در منبع فایل وجود ندارد و ستون زبان ساخته نشده است؛ جهت fa↔en از پارامتر درخواست تعیین می‌شود. `translations` آرایهٔ رشته است. `synonyms`، `antonyms`، `relWords`، `relExp`، `pronunciations`، `examples` و `extra` در payload نگهداری می‌شوند و نبود مقدار به `null` تبدیل می‌شود؛ در JSON_FILE فقط فیلدهای موجود (`translations`، `synonyms`، `antonyms`، `related words`، `pronunciations`) نگاشت می‌شوند. منبع MYSQL ستون‌های متنی JSON را با parse جداگانه می‌خواند؛ متن نامعتبر به `null`، ترجمهٔ غیرآرایه به آرایهٔ تهی و `dicExamples` به `examples` می‌رود. کلید خالی قابل ورود/جست‌وجو نیست. برخورد منبع به ترتیب MYSQL و سپس JSON_FILE و در هر منبع با مرتب‌سازی باینری `trd_source_key` حل می‌شود. تکرار هویت منبع با upsert بر پایهٔ اثرانگشت به‌روزرسانی می‌شود؛ تکرار عبارت با هویت‌های متفاوت حذف نمی‌شود.
