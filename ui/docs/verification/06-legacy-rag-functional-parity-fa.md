# T5-R3 — وضعیت برابری عملکردی RAG قدیمی

## نتیجه

وضعیت این مرحله **PARTIAL** است. مسیر `/rag`، بازگشت از ورود با کلید، ظاهر گفتگو محور، ذخیره‌سازی گفتگو در PostgreSQL و اتصال رابط به API هدف پیاده‌سازی و بررسی شده‌اند. جریان واقعی «آپلود، نمایه‌سازی، پرسش، پاسخ و استناد» هنوز در محیط توسعه قابل اجرا نیست: سرویس embedding قدیمی در `127.0.0.1:8002` پاسخ نمی‌دهد و مدل `targoman` در `127.0.0.1:8001` طبق پاسخ خود سرویس از APIهای Embeddings و Rerank پشتیبانی نمی‌کند. هیچ reranker دیگری در سرویس‌های در دسترس شناسایی نشد. تنظیمات AI Router برای چهار کار محافظت‌شده عمداً با نشانی یا مدل ساختگی پر نشده‌اند.

## منابع قدیمی بررسی‌شده

`public/rag.html`، `public/js/rag.js`، `public/js/llm.js`، `public/css/rag-common.css`، `public/css/style.css`، `public/css/app-nav.css`، فونت IranSansX، `public/img/logo-light.png`، `public/login.html` و سرویس‌های `ragService.ts`، `ragChatService.ts`، `ragResourceService.ts`، `file2TxtService.ts`، `embedService.ts` و `vectorDB.ts` بررسی شدند. در نسخه قدیمی فهرست گفتگو، عنوان گفتگو، حذف تکی/همه، فهرست و حذف نرم اسناد، آپلود از نوار کناری یا کنار کادر پرسش، پیشنهادهای وابسته به سند، Markdown و توقف تولید وجود داشت.

## نگاشت رفتار

| رفتار قابل مشاهده | پیاده‌سازی هدف |
| --- | --- |
| `/login?back=rag` و بازگشت پس از ورود | Session و Legacy Key/OIDC موجود؛ مقصد `/rag` |
| زمینه اسناد شخصی | شناسه پایدار `PERSONAL_RAG` برای deployment، tenant و actor؛ ایجاد از `clsKnowledgeService` با Authority |
| افزودن سند | Document Core → File Management transfer/commit → عضویت خودکار در Space شخصی → Job نمایه‌سازی |
| حذف سند | عضویت شخصی به `RETIRED` و خود Document به‌صورت نرم بازنشسته می‌شود؛ نگهداری و legal hold در مسیر موجود باقی می‌ماند |
| پرسش و استناد | Knowledge.ask با کنترل‌های Authority، File Management، Qdrant مشتق و AI Router؛ پاسخ تأییدشده و استناد مجاز از SSE |
| گفتگوها | دو جدول متعلق به Knowledge در PostgreSQL، محدود به deployment/tenant/actor با RLS، حذف نرم و عنوان کوتاه از اولین پرسش |
| نمایش پاسخ | `MarkdownView` امن موجود؛ منبع قابل خواندن از مسیر مجاز Document/File Management |

رابط اصلی دیگر فرم‌های مدیریت Knowledge Space را نشان نمی‌دهد. `/knowledge` برای بررسی مهندسی باقی مانده است. پیشنهادهای ایستای مربوط به سند از متن قدیمی گرفته شده‌اند؛ تولید خودکار پیشنهادهای اختصاصی هر فایل، حالت گفتگوی عمومی بدون سند و تولید عنوان با مدل هنوز منتقل نشده‌اند. گفتگوهای پیشین در همان chat ذخیره می‌شوند و چهار پیام اخیر به‌صورت محدود به پاسخ بعدی داده می‌شوند.

## مدل‌ها و آمادگی فعلی

| کار | وضعیت واقعی |
| --- | --- |
| `DOCUMENT_EMBED` و `QUERY_EMBED` | `CONFIG_REQUIRED`؛ endpoint قدیمی `127.0.0.1:8002` در دسترس نیست |
| `RERANK` | `CONFIG_REQUIRED`؛ مدل `targoman` در `8001` پاسخ «The model does not support Rerank (Score) API» می‌دهد |
| `RAG_ANSWER` | `CONFIG_REQUIRED`؛ مدل تولید `targoman` در `8001` حاضر است، اما binding محافظت‌شده و سیاست Data Governance بدون پیکربندی کامل RAG ثبت نشده‌اند |
| Organizational OIDC | `ORGANIZATIONAL_OIDC_CONFIG_REQUIRED` در محیط فعلی |

`/ready` همچنان `DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED` برمی‌گرداند. ابزارهای عمومی ترجمه/سؤالات متداول/خلاصه‌سازی مستقل از این کمبود هستند. آزمون RAG با provider fixture برای کنترل‌های Knowledge/Authority موفق است، اما **جایگزین آزمون مرورگری با مدل واقعی نیست**.

## اجرا و آزمون دستی

پس از فراهم شدن embedding و reranker واقعی، فایل خصوصی JSON شامل `protected` و `dataGovernance` را مطابق قراردادهای `packages/configuration/src/index.ts` و `packages/contracts/src/protected-ai.ts` بسازید. مقصدها و مدل‌های واقعی را در آن ثبت کنید؛ هیچ کلیدی را در مخزن ننویسید. سپس:

```bash
npm run dev:rag -- --public-model-id targoman --models-config /absolute/path/to/rag-models.json
npm run dev:rag:browser
```

نشانی: `https://app.localhost:5173/rag`. صفحهٔ ورود توسعه دکمهٔ «تولید کلید جدید» دارد؛ کلید تولیدشده را همان لحظه نزد خود در جای امن نگه دارید، زیرا قابل بازیابی نیست. سامانه مقدار خام را در پایگاه داده یا فایل توسعه ثبت نمی‌کند؛ فقط SHA-256 آن برای احراز هویت ثبت می‌شود. خودایجاد کلید تنها در پیکربندی توسعه فعال است و با `--no-legacy-self-provision` می‌توان آن را غیرفعال کرد. پس از ورود، یک فایل TXT یا PDF غیرمحرمانه را بارگذاری کنید، تا «آماده» شدن صبر کنید، سپس پرسش بنویسید و پاسخ/استناد را ببینید. در گفت‌وگوی خالی کادر پرسش نزدیک مرکز صفحه قرار می‌گیرد و پس از نخستین پرسش به پایین صفحه منتقل می‌شود. آزمون کامل مرورگر با مدل واقعی:

```bash
T5_R3_REQUIRE_MODEL=1 npm run test:t5:r3:browser
```

برای بررسی فعلی مسیر و ورود، بدون ادعای صحت مدل: `npm run test:t5:r3:browser`.

## شواهد و محدودیت

`check:web`، `check:target`، `build:web`، گاردریل معماری هدف و UI، آزمون مرورگری ورود/چیدمان و آزمون زنده PostgreSQL برای گفتگو/عضویت موفق شدند. آزمون‌های یکپارچه File Management، Worker و مجموعه امنیت RAG با provider fixture نیز موفق شدند. جریان واقعی مدل، نمایه‌سازی و استناد مرورگری تا زمان آماده‌سازی endpointهای embedding و rerank **FAIL / NOT VERIFIED** است. تغییرات SQL فقط در persistence مالک Knowledge هستند؛ هیچ دسترسی مستقیم UI به MySQL، Qdrant یا مدل اضافه نشده است.
