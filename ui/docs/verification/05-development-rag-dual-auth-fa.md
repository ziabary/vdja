# راه‌اندازی توسعه T5-R2: ورود دوگانه و محیط دانش

## وضعیت فعلی

در ۴ اکتبر ۲۰۲۶، مسیر محلی ورود با کلید و صفحهٔ `/knowledge` با مرورگر واقعی آزموده شد. PostgreSQL، API، Worker، فضای ذخیره‌سازی خصوصی و Qdrant آماده‌اند. این راه‌اندازی هنوز **PARTIAL** است: هیچ پیکربندی واقعی برای چهار وظیفهٔ مدل RAG و هیچ پیکربندی IdP سازمانی در این محیط موجود نیست. `/ready` با کد 503 و شناسهٔ `DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED` همین وضعیت را اعلام می‌کند. موفقیت بارگذاری، نمایه‌سازی، پرسش، پاسخ و ارجاع با مدل واقعی ادعا نمی‌شود.

## شروع و ورود

از ریشهٔ `ui` اجرا کنید:

```sh
npm run dev:rag
```

فرمان، پایگاه اختصاصی `targoman_platform_rag` را بدون بازنشانی مخرب آماده و مهاجرت می‌کند، هویت انسانی و ماشین، عضویت، مجوزهای صریح دانش، کلید توسعه و TLS محلی را به‌صورت تکرارپذیر ایجاد می‌کند و API، Worker، Web و Qdrant را بالا می‌آورد. در پایانهٔ دوم، مرورگر را با گواهی محلی و نگاشت نام‌های `.localhost` باز کنید:

```sh
npm run dev:rag:browser
```

آدرس Web برابر `https://app.localhost:5173`، ورود `https://app.localhost:5173/login`، دانش `https://app.localhost:5173/knowledge` و مبدأ Auth برابر `https://auth.localhost:5174` است. در حالت توسعه از دکمهٔ «تولید کلید جدید» استفاده کنید و کلید تازه را نزد خود در جای امن نگه دارید؛ سامانه آن را ذخیره یا بازیابی نمی‌کند. قابلیت خودایجاد با `--no-legacy-self-provision` خاموش می‌شود. مرورگر کلید خام را فقط برای احراز هویت روی HTTPS به Auth می‌فرستد؛ برای کلیدهای تازه فقط SHA-256 آن در پایگاه داده ثبت می‌شود. MD5 فقط برای تطبیق کلیدهای واردشده از سامانهٔ قدیمی استفاده می‌شود و پس از ورود موفق به SHA-256 تبدیل می‌گردد. ورود موفق، Identity، عضویت و Session مشترک هدف را می‌سازد و به دانش می‌رود. ورود با گذرواژهٔ توسعه به طور پیش‌فرض غیرفعال است؛ در صورت نیاز فایل راز را با `npm run dev:rag -- --password-file <private-path>` ارائه کنید.

در این پایگاه توسعه، کلید پیش‌فرض همان کلید تولیدشده در فایل فوق است. کلید شخصی قدیمی فقط پس از مهاجرت یا نگاشت تأییدشدهٔ آن کار می‌کند. اگر ورود 401 داد، از همین فایل استفاده کنید و کلید را بدون فاصلهٔ اضافی وارد کنید.

در زمان شروع، ابزار توسعه فهرست مدل‌های واقعی endpoint عمومی AI را از `/v1/models` می‌خواند و در صورت وجود تنها یک مدل، شناسهٔ همان مدل را به Translator/Summarizer/FAQ متصل می‌کند. اگر endpoint چند مدل داشته باشد، `npm run dev:rag -- --public-model-id <served-model-id>` را اجرا کنید. پس از تغییر این تنظیمات، فرایند `dev:rag` جاری را متوقف و دوباره اجرا کنید. آماده بودن ترجمه مستقل از چهار وظیفهٔ محافظت‌شدهٔ RAG است؛ کد 503 در `/ready` تا زمان تنظیم مدل‌های RAG باقی می‌ماند.

## ورود سازمانی

قابلیت OIDC با Authorization Code، PKCE S256، state، nonce، اعتبارسنجی issuer/client و جریان یک‌بارمصرف پیاده شده است. در این محیط گزینهٔ سازمانی پنهان و وضعیت `ORGANIZATIONAL_OIDC_CONFIG_REQUIRED` است. پس از دریافت تنظیمات واقعی IdP، یک فایل خصوصی JSON برای `--oidc-config` فراهم کنید: `enabled`, `issuer`, `clientId`, `scopes` شامل `openid`, `callbackUri` دقیقاً `https://auth.localhost:5174/api/auth/oidc/callback`, `provisioning: "DISABLED"` و در صورت نیاز `clientSecretRef` به راز خارجی. نگاشت تأییدشدهٔ شخص موجود را در فایل خصوصی JSON با `issuer` و `subject` قرار دهید و اجرا کنید:

```sh
npm run dev:rag -- --oidc-config <private-oidc-config.json> --oidc-map-file <private-issuer-subject-map.json>
```

نگاشت با ایمیل حدس زده نمی‌شود و claimهای IdP مجوز Authority ایجاد نمی‌کنند. ورود واقعی IdP تا فراهم شدن پیکربندی و اجرای تعاملی **NOT_VERIFIED** است.

## مدل‌ها و آزمون دستی RAG

برای فعال شدن RAG، تنظیمات واقعی مدل و سیاست خروج داده را در فایل خصوصی JSON با کلیدهای `protected` و `dataGovernance` مطابق قرارداد `packages/configuration/src/index.ts` و `packages/contracts/src/protected-ai.ts` فراهم کنید. `protected` باید endpointهای واقعی و bindingهای `knowledge.document.embed`، `knowledge.query.embed`، `knowledge.rerank` و `knowledge.answer` را داشته باشد. راز endpoint فقط با `credentialRef` ارجاع داده شود. سپس اجرا کنید:

```sh
npm run dev:rag -- --models-config <private-models-config.json>
```

آمادگی هر چهار وظیفه و `/ready` را بررسی کنید. پس از ورود، در `/knowledge` یک Space بسازید، متن آزمایشی غیرمحرمانه بارگذاری کنید، وضعیت پردازش و نمایه را ببینید، سؤال بپرسید و پاسخ و ارجاع مجاز را باز کنید. تا زمان اتصال مدل واقعی، بخش Space/پرسش در API غیرفعال و پیام پیکربندی مدل در UI نمایش داده می‌شود. دادهٔ مشتری را برای آزمون اولیه به کار نبرید.

## شواهد و محدودیت

`npm run test:dev:rag:auth` سه آزمون اتصال هویت/Session، OIDC ایزوله و خودایجاد محدود توسعه را پاس کرد. `npm run test:dev:rag:browser` با Chrome واقعی، کلید خام روی HTTPS، نشست و نمایش صفحهٔ دانش را پاس کرد. آزمون‌های متمرکز TypeScript، Web، Authority، جداسازی مستأجر، Worker، File Management، Knowledge و معماری نیز پاس شدند؛ آزمون‌های مدل در این مجموعه از fixture مصنوعی استفاده می‌کنند و جای آزمون endpoint واقعی را نمی‌گیرند. این سند به معنی عبور از گیت ASVS Level 3 مشتری یا آماده بودن انتشار نیست.
