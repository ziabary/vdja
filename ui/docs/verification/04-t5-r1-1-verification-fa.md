# راستی‌آزمایی T5-R1.1

منبع ماشینی: `reports/security/t5-r1-1-verification.json`. زمان: 2026-10-04T12:52:34.641Z.

- وضعیت خود وظیفه: COMPLETE
- هش قرارداد راستی‌آزمایی: `17f13383778b2511b16aa6e88d1aea5909a499bf9891e0a7a2f539c84e834b80`
- معیارها: PASS 74، FAIL 3، NOT_VERIFIED 23، N/A 0
- PASS ناشی از feature flag کلی: 0
- خانواده‌های Authority با شاهد کامل ALLOW و DENY و Audit و SIEM: 0/15؛ وضعیت کل: NOT_VERIFIED
- تصویرهای پذیرش پوشش‌داده‌شده: 9/9؛ گروه‌های scan: 7؛ بدون پوشش: 0
- یافته‌های HIGH/CRITICAL یکتای runtime: 97؛ دارای اصلاح موجود: 0
- T5: PARTIAL؛ GenAI/RAG: FAIL؛ مجوز انتشار ASVS L3: NO

این نتیجهٔ محلی رفتار مدل واقعی، گواهی/هویت سرویس مشتری یا انتشار را تأیید نمی‌کند. شاخه‌های اثبات‌نشدهٔ Authority، وضعیت توان پلتفرم و وضعیت استقرار برای هر مرز در artifactهای جداگانه ثبت شده‌اند.

| شرط T5-R1.1 | نتیجه |
| --- | --- |
| currentExecution | PASS |
| criterionMap | PASS |
| noBroadFeaturePass | PASS |
| metaFromCanonicalGates | PASS |
| contractBound | PASS |
| staleEvidenceSelfTests | PASS |
| authorityInventory | PASS |
| imageCoverage | PASS |
| serviceBoundarySplit | PASS |
| currentAsvs | PASS |
| protectedSources | PASS |
| finalT5Gate | PASS |
