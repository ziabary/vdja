import {readFile,writeFile} from 'node:fs/promises';
const assessment=JSON.parse(await readFile('reports/security/asvs-5.0-l3.json','utf8'));
const classification=JSON.parse(await readFile('reports/security/rag-asvs-classification.json','utf8'));
// Explicit, control-by-control reviews. These are judgments, not status inference from test names.
const reviews={
'V1.1.1':['PASS','JSON و UTF-8 یک‌بار خوانده می‌شوند؛ سؤال و متن chunk دوباره URL/HTML decode نمی‌شوند.'],
'V1.1.2':['PASS','پاسخ و citation با JSON serialization و interpolation متنی Svelte در مقصد escape می‌شوند.'],
'V1.2.1':['PASS','سرآیند filename با RFC 5987 و متن HTML با Svelte escape می‌شود؛ نمایش HTML فعال وجود ندارد.'],
'V1.2.2':['PASS','شناسهٔ UUID در مسیر کنترل و encode می‌شود؛ مقصدها از CJSON با پروتکل محدود هستند.'],
'V1.2.3':['PASS','هیچ تولید JavaScript از پاسخ مدل انجام نمی‌شود؛ JSON.stringify در API و SIEM استفاده می‌شود.'],
'V1.2.9':['NOT_APPLICABLE','در سطح T5 هیچ regex از رشتهٔ کاربر ساخته نمی‌شود؛ الگوها ثابت‌اند.'],
'V1.3.2':['PASS','کد هدف eval یا اجرای expression مدل ندارد؛ خروجی مدل فقط دادهٔ schema-validated است.'],
'V1.3.3':['NOT_VERIFIED','نام و آرگومان تبدیل ثابت و bounded است؛ ایمنی تمامی ورودی‌های PDF/DOC در parser native اثبات نشده است.'],
'V1.3.5':['PASS','Markdown/HTML پاسخ یا فایل به‌عنوان زبان اجرایی render نمی‌شود؛ متن escaped نمایش داده می‌شود.'],
'V1.3.7':['PASS','trusted prompt ثابت است؛ متن retrieved در دادهٔ user قرار می‌گیرد و template اجرایی تولید نمی‌کند.'],
'V1.3.10':['NOT_APPLICABLE','format string اجرایی یا printf با template کاربر در سطح T5 وجود ندارد.'],
'V1.3.12':['NOT_VERIFIED','الگوها ثابت و ورودی‌ها bounded هستند؛ ارزیابی worst-case همهٔ regexها و کتابخانه‌ها ثبت نشده است.'],
'V1.4.1':['NOT_VERIFIED','بخش TS managed است؛ native parser/LibreOffice و وابستگی‌ها به بررسی memory safety و آسیب‌پذیری نیاز دارند.'],
'V1.4.2':['PASS','اندازه، صفحه، range، multipart و جمع ظرفیت با safe integer و bounds کنترل می‌شوند.'],
'V1.4.3':['PASS','staging/profile/file handle در finally آزاد می‌شوند؛ stream حتی پیش از مصرف روی destroy ظرفیت و منبع را آزاد می‌کند.'],
'V1.5.1':['NOT_VERIFIED','OOXML/ODT دارای DTD/entity و external relationship رد می‌شود؛ تنظیم XXE تمامی مسیرهای LibreOffice/DOC اثبات نشده است.'],
'V1.5.2':['PASS','JSON پویا unknown است و با allowlist کلید/type/range محدود می‌شود؛ deserialization کلاس اجرایی وجود ندارد.'],
'V1.5.3':['NOT_VERIFIED','JSON و UTF-8 strict مشترک‌اند؛ differential parsing فایل باینری و مفسر Office کاملاً آزموده نشده است.'],
'V2.1.1':['PASS','قالب UUID، SHA-256، MIME، mode، محدودیت اندازه و manifest در مستندات قرارداد ثبت شده‌اند.'],
'V2.1.2':['PASS','رابطهٔ Document/Version/Asset، hash/length، pinned/current و model dimension مستند است.'],
'V2.1.3':['PASS','سقف hard tenant و دو tier actor، concurrency/pending/storage/assets در قرارداد File Management مستند هستند.'],
'V2.2.1':['PASS','HTTP/config/manifest/provider input با allowlist نوع، الگو و bounds اعتبارسنجی می‌شود.'],
'V2.2.3':['PASS','hash واقعی با descriptor، media/extension/signature و embedding profile با dimensions تطبیق داده می‌شود.'],
'V2.3.1':['PASS','lease و state machine اجازهٔ commit پیش از upload/verification یا تغییر descriptor در retry نمی‌دهد.'],
'V2.3.2':['PASS','Admission در PostgreSQL سقف actor و hard tenant را حتی با مجوز elevated اعمال می‌کند.'],
'V2.3.3':['PASS','Asset/Version/Job/Usage/Audit در یک transaction commit یا rollback می‌شوند؛ remote intent پیش از side effect پایدار است.'],
'V2.3.4':['PASS','advisory locks، SKIP LOCKED، lease fence و snapshot locks رقابت رزرو و انتشار را کنترل می‌کنند.'],
'V3.2.1':['PASS','دانلود attachment/nosniff است؛ محتوا JSON یا متن است و خودکار HTML اجرا نمی‌شود.'],
'V3.2.2':['PASS','متن فایل و مدل با interpolation امن نمایش داده می‌شود؛ browser injection fixture اجرا شده است.'],
'V3.2.3':['PASS','کامپوننت‌ها scoped و strict هستند؛ DOM globals برای authority یا state استفاده نمی‌شود.'],
'V3.4.3':['NOT_VERIFIED','CSP کد و آزمون پایه موجود است؛ CSP L3 همهٔ پاسخ‌ها از زنجیرهٔ edge مشتری هنوز تأیید نشده است.'],
'V3.4.5':['PASS','no-referrer در Web و سرآیندهای deployment تعریف و در regression بررسی شده است.'],
'V3.4.6':['PASS','frame-ancestors در Web/adapter و policy استقرار تعریف شده؛ embed RAG مجاز نشده است.'],
'V3.4.7':['NOT_VERIFIED','مسیر CSP reporting وجود دارد؛ فعال‌سازی و دریافت report در deployment مشتری اثبات نشده است.'],
'V3.4.8':['PASS','COOP same-origin در Web و static response policy اعمال می‌شود.'],
'V3.5.1':['PASS','mutation محافظت‌شده Bearer غیرساده لازم دارد؛ refresh/logout origin و CSRF policy مستقل دارند.'],
'V3.5.2':['PASS','JSON/raw multipart و Authorization غیرساده‌اند؛ origin allowlist و browser regression فعلی بررسی شد.'],
'V3.5.7':['PASS','asset JS عمومی state کاربر را حمل نمی‌کند؛ دادهٔ protected فقط در پاسخ authenticated API است.'],
'V3.5.8':['PASS','Bearer باید صریح ارسال شود؛ download دارای CORP same-origin و no-store است.'],
'V4.1.1':['PASS','JSON/stream/file Content-Type مشخص است؛ دانلود text دارای charset=utf-8 است.'],
'V4.1.4':['PASS','router فقط methodهای تعریف‌شده را ثبت می‌کند و method پشتیبانی‌نشده mutation ایجاد نمی‌کند.'],
'V4.2.5':['PASS','شناسه‌ها، نام فایل، مقصد و secret ref bounded هستند؛ payload خام در URI یا header ارسال نمی‌شود.'],
'V5.1.1':['PASS','types/ext/MIME/bytes/archive bounds و quarantine behavior در File Management مستند شده است.'],
'V5.2.2':['NOT_VERIFIED','UTF-8 کامل و ساختار archive کنترل می‌شوند؛ magic PDF/OLE اثبات تخصصی تمام محتوای PDF/DOC نیست.'],
'V5.2.4':['PASS','رزرو distributed با actor ID اندازه، تعداد، pending و retained bytes را محدود می‌کند؛ elevation hard cap را دور نمی‌زند.'],
'V5.4.1':['PASS','نام display از مسیر جداست؛ traversal/controls/bidi حذف یا رد و Content-Disposition مشخص است.'],
'V8.1.3':['PASS','tenant/deployment/actor/session/authVersion/ACL/classification/time/grant schedule در flow و Authority مستند است.'],
'V8.1.4':['PASS','عملیات مستقل و fail-closed tenant/classification/deny و fresh subject در checkpointها مستند شده‌اند.'],
'V8.4.2':['NOT_APPLICABLE','مسیرهای این task CRUD منابع کاربر هستند؛ interface مدیریت platform/device posture در scope اجراشده وجود ندارد. افزودن چنین interface نیازمند delta جدید است.'],
'V10.1.1':['NOT_VERIFIED','refresh cookie محدود به Auth و access token در حافظه است؛ الگوی BFF با token فقط backend و مرور همهٔ consumerها هنوز تأیید نشده است.'],
'V11.2.5':['PASS','JWT/signature نامعتبر fail closed است؛ خطاهای crypto و secret به کاربر یا log منتقل نمی‌شوند.'],
'V11.5.1':['NOT_VERIFIED','refresh secret و کلید آزمون CSPRNG هستند؛ بازبینی exhaustive purpose/entropy شناسه‌ها و credentialهای واقعی باقی است.'],
'V11.5.2':['NOT_VERIFIED','از crypto استاندارد استفاده می‌شود؛ رفتار زیر بار سنگین RNG و entropy زیرساخت واقعی آزمایش نشده است.'],
'V11.7.2':['NOT_VERIFIED','Qdrant payload opaque و provider content حداقلی است؛ encryption-at-rest و پس از مصرف در volumes واقعی اثبات نشده است.'],
'V12.3.1':['NOT_VERIFIED','S3/provider/SIEM production TLS validation دارند؛ PostgreSQL، gateway، monitoring و همهٔ اتصال‌های deployment مشتری اثبات نشده‌اند.'],
'V12.3.2':['PASS','TLS verification خاموش رد می‌شود؛ SIEM با CA مشخص آزموده شده و fetch/SDK validation پیش‌فرض حفظ شده است.'],
'V12.3.3':['NOT_VERIFIED','محیط آزمون loopback HTTP دارد؛ TLS همهٔ اتصال‌های داخلی استقرار مشتری نیازمند evidence است.'],
'V12.3.4':['NOT_VERIFIED','CA اختصاصی SIEM در آزمون معتبر بود؛ trust stores و certificate تمام سرویس‌های واقعی ارائه نشده‌اند.'],
'V12.3.5':['FAIL','ثبت Worker machine جای mTLS/replay-resistant authentication همهٔ transportهای داخلی نیست؛ mesh/certificate implementation فعلی وجود ندارد.'],
'V13.1.1':['PASS','اتصال PG/Storage/Qdrant/Router/SIEM و عدم پشتیبانی از URL دلخواه کاربر مستند است.'],
'V13.1.2':['NOT_VERIFIED','pool/Admission/config concurrency محدودند؛ saturation تمام client connection poolها و محیط مشتری اثبات نشده است.'],
'V13.1.3':['PASS','timeout، cleanup، lease، retry bounded و UNKNOWN/reconciliation برای dependencyها مستند است.'],
'V13.2.1':['FAIL','secretRef ثابت PG/Qdrant/S3 معیار credential کوتاه‌عمر و account اختصاصی همهٔ سرویس‌ها را اثبات یا پیاده‌سازی نمی‌کند.'],
'V13.2.2':['NOT_VERIFIED','API/Worker در PG least-privilege و RLS آزموده شدند؛ IAM واقعی bucket، Qdrant و secret volume هنوز تأیید نشده‌اند.'],
'V13.2.3':['NOT_VERIFIED','fixture credentials تصادفی هستند؛ non-default بودن credentialهای واقعی مشتری قابل نتیجه‌گیری نیست.'],
'V13.2.4':['PASS','protected egress با exact configured destination/task/classification و Data Governance محدود است؛ redirect ممنوع است.'],
'V13.2.5':['NOT_VERIFIED','allowlist برنامه وجود دارد؛ OS/network confinement native parser و gateway allowlist واقعی آزموده نشده است.'],
'V13.2.6':['NOT_VERIFIED','timeout/retry/Admission در focused tests اجرا شده‌اند؛ compliance connection maxima همهٔ transports زیر بار هنوز پوشش کامل ندارد.'],
'V13.3.2':['NOT_VERIFIED','secretRefs و role-specific PG secrets در OCI تعریف شده‌اند؛ mounted files/IAM/rotation واقعی least privilege نیازمند evidence است.'],
'V14.1.1':['NOT_VERIFIED','Document classification و payload categories مشخص‌اند؛ نگاشت کامل مقررات/privacy هر مشتری ارائه نشده است.'],
'V14.1.2':['NOT_VERIFIED','Audit/egress/cache/integrity boundaries مستند است؛ retention، legal hold، encryption و privacy policy کامل مشتری تصویب نشده است.'],
'V14.2.2':['NOT_VERIFIED','cache private و bounded/hash-verified است؛ secure purge و encryption backend/edge مشتری اثبات نشده است.'],
'V14.2.3':['PASS','مسیر RAG tracker خارجی ندارد؛ external model egress بدون exact Governance approval رد می‌شود.'],
'V14.2.4':['NOT_VERIFIED','Authority و integrity/redaction اجرا شده‌اند؛ تمام الزامات protection level در retention/encryption/privacy واقعی اثبات نشده‌اند.'],
'V14.2.5':['PASS','protected response no-store و cache identity به asset/version/hash وابسته است؛ missing route محتوای protected دیگری بازنمی‌گرداند.'],
'V14.2.6':['PASS','discover/read/quote مستقل‌اند؛ backend فقط citation مجاز را می‌سازد و hidden source names/count/content را حذف می‌کند.'],
'V14.2.7':['FAIL','خودکارسازی retention/purge/legal hold محتوای canonical و تمام backupها پیاده‌سازی نشده؛ soft delete به‌تنهایی کافی نیست.'],
'V14.3.1':['PASS','auth revision guard و logout protected state/DOM را پاک می‌کند؛ browser test نبود token/content در storage را بررسی می‌کند.'],
'V14.3.2':['PASS','پاسخ authenticated و فایل private no-store هستند؛ browser و runtime regression اجرا شده‌اند.'],
'V15.1.2':['NOT_VERIFIED','SBOM واقعی هر سه تصویر و اسکن محلی dependency/image موجود است؛ attestation منبع تمام وابستگی‌ها و provenance امضاشدهٔ production هنوز اثبات نشده است.'],
'V15.2.1':['FAIL','اسکن واقعی تصویر و lock وابستگی‌ها آسیب‌پذیری‌های باز دارد؛ Node/OS و upload dependencies اصلاح و toolchain غیرضروری حذف شدند ولی remediation تمام یافته‌ها و SLA مشتری بسته نیست.'],
'V15.1.3':['PASS','extract/index/RAG و هزینهٔ مدل با durable jobs، Admission، concurrency و context/token bounds مستند است.'],
'V15.1.4':['PASS','LibreOffice/pdfjs، archive و S3 SDK به‌عنوان اجزای پرریسک در inventory امنیتی ثبت شده‌اند.'],
'V15.1.5':['PASS','native parse، protected egress و multipart mutation/UNKNOWN به‌عنوان functionality حساس مستند است.'],
'V15.2.5':['FAIL','scratch خصوصی و timeout وجود دارد؛ sandbox parser بدون شبکه و با CPU/memory/file isolation مستقل پیاده‌سازی نشده است.'],
'V15.3.1':['PASS','DTOهای نسخه، status، citation و operational metadata allowlist دارند؛ locators و raw grants به UI بازنمی‌گردند.'],
'V15.3.2':['PASS','provider/Qdrant/SIEM fetch redirect:error دارند؛ SDK مقصد ثابت و redirect provider در تست رد می‌شود.'],
'V15.3.6':['PASS','ورودی‌ها exact-key validation و Map/Set دارند؛ privilege interpretation در Authority می‌ماند و dynamic merge ورودی در T5 وجود ندارد.'],
'V15.3.7':['NOT_VERIFIED','schema body و header مشخص هستند؛ تست exhaustive duplicate query/header/transport parser pollution هنوز ثبت نشده است.'],
'V15.4.2':['NOT_VERIFIED','job lease و Document snapshot publication fence آزموده شدند؛ atomicity دقیق grant revocation و materialization/provider dispatch در تمام interleavingها اثبات نشده است.'],
'V15.4.3':['PASS','locks در persistence/Storage owner و bounded transaction/lease هستند؛ retry و abandoned lease tests اجرا شده‌اند.'],
'V15.4.4':['NOT_VERIFIED','capacity bounded است؛ starvation/fairness بلندمدت با actorهای متعدد و حجم production آزموده نشده است.'],
'V16.1.1':['NOT_VERIFIED','inventory برنامه/DB/SIEM در گزارش فارسی آمده؛ destination، access و retention همهٔ لایه‌های مشتری مشخص نیست.'],
'V16.2.1':['PASS','metadata actor/session/initiator/request/correlation/tenant/task/run/time در Audit/Router/operational evidence ثبت می‌شود.'],
'V16.2.2':['NOT_VERIFIED','timestampها UTC هستند؛ هم‌زمانی NTP تمام hostها و dependencies مشتری اثبات نشده است.'],
'V16.2.3':['NOT_VERIFIED','برنامه stdout، canonical PG و selected SIEM دارد؛ agentهای log و retention destination واقعی هنوز بررسی نشده‌اند.'],
'V16.2.5':['PASS','Audit allowlist و SIEM envelope فقط metadata دارند؛ sentinel body/question/answer/locator/credential leakage scan موفق است.'],
'V16.3.3':['PASS','Authority denial، file failure/quarantine، output rejection و validation/Admission errors با safe codes ثبت می‌شوند.'],
'V16.3.4':['PASS','provider failures و safe API errors و Worker failures log می‌شوند؛ raw exception/content ثبت نمی‌شود.'],
'V16.4.1':['PASS','JSON.stringify در logging و strict enum/reference validation ساختار log را حفظ می‌کند.'],
'V16.4.2':['NOT_VERIFIED','DB audit immutability برای API/Worker موفق است؛ حفاظت stdout، host collector و destination مشتری آزموده نشده است.'],
'V16.4.3':['NOT_VERIFIED','receiver مستقل TLS در fixture موفق است؛ SOC واقعی، ACL/retention و جدایی کامل deployment تأیید نشده است.'],
'V16.5.3':['PASS','transaction rollback، malformed response، ambiguous outcome، dependency outage و denied publication fail closed آزموده شده‌اند.'],
'V16.5.4':['NOT_VERIFIED','last-resort handler payload را log نمی‌کند و با drain/exit fail-closed برای supervisor جایگزین می‌شود؛ availability و restart policy همهٔ entrypointها در deployment واقعی هنوز اثبات نشده است.'],
'V5.4.2':['PASS','با فعال‌شدن download کنترل از N/A به applicable تغییر کرد؛ filename*=UTF-8 percent encoding و attachment tested است.'],
'V5.4.3':['FAIL','با دانلود original Asset کنترل applicable است؛ scanner ضدبدافزار تمام فرمت‌ها و signature update/retry/quarantine provider هنوز وجود ندارد.']
};
const groups=[
 [/^V[12]\./,['packages/file-processing/src/index.ts','packages/file-processing/src/office-archive.ts','packages/configuration/src/index.ts','apps/api/src/knowledge.ts','tests/reports/t5-foundations.log','tests/reports/t5-integrations.log']],
 [/^V[34]\./,['apps/api/src/knowledge.ts','apps/web/src/lib/knowledge/Workspace.svelte','apps/web/src/hooks.server.ts','tests/reports/t5-browser.log','tests/reports/auth-http-regression.log','tests/target/t44-static-headers.integration.test.mjs']],
 [/^V5\./,['packages/file-management/src/service.ts','packages/admission-control/src/persistence/files.ts','tests/target/t5-file-limits.integration.test.ts','tests/target/t4-file-security.test.ts','tests/reports/t5-integrations.log']],
 [/^V(?:8|10)\./,['docs/backend/10-rag-authorization-flow.md','packages/authority/src/service.ts','packages/knowledge/src/service.ts','tests/reports/authority-conformance.log','tests/reports/authority-live.log','tests/reports/t5-integrations.log']],
 [/^V(?:11|12|13|14|15)\./,['docs/deployment/03-rag-customer-release.md','packages/ai-router/src/protected.ts','packages/knowledge/src/service.ts','packages/storage/src/adapters/s3.ts','tests/reports/t5-integrations.log','tests/reports/t5-browser.log']],
 [/^V16\./,['packages/observability/src/index.ts','packages/audit/src/persistence/semantic.ts','packages/security-telemetry/src/worker.ts','docs/verification/02-t5-audit-siem-verification-fa.md','tests/reports/t5-audit-siem.tap']]
];
const required=new Set(classification.controls.filter(c=>c.verifyDuringT5).map(c=>c.id));
for(const c of assessment.controls){
 const id=c.id.replace('v5.0.0-',''),review=reviews[id];
 if(required.has(c.id)&&!review)throw new Error(`MISSING_T5_REVIEW:${id}`);
 c.postT5=review?.[0]??c.postT4;
 c.t5Verification=review?{reviewedAt:new Date().toISOString(),scope:'CURRENT_TARGET_AND_REQUIRED_DEPLOYMENT',verifyDuringT5:required.has(c.id),additionalT5Scope:!required.has(c.id),
   observed:review[1],evidencePaths:[...(groups.find(([pattern])=>pattern.test(id))?.[1]??[]),...(['V15.1.2','V15.2.1'].includes(id)?['reports/security/t5-supply-chain.json','tests/reports/oci/acceptance.json','tests/reports/oci/customer-a-sbom.cdx.json','tests/reports/oci/runtime-vulnerabilities.json','tests/reports/oci/runtime-dependency-vulnerabilities.json']:[])],
   missingEvidence:['FAIL','NOT_VERIFIED'].includes(review[0])?review[1]:null,
   exception:null}:{scope:'UNCHANGED_T4_SCOPE',observed:'وضعیت T4 حفظ شده است؛ این کنترل توسط T5 بسته اعلام نشده است.',evidencePaths:c.sourceOrTestPaths??[],missingEvidence:c.missingEvidence??null};
}
const count=controls=>({total:controls.length,PASS:controls.filter(c=>c.postT5==='PASS').length,FAIL:controls.filter(c=>c.postT5==='FAIL').length,
 NOT_VERIFIED:controls.filter(c=>c.postT5==='NOT_VERIFIED').length,NOT_APPLICABLE:controls.filter(c=>c.postT5==='NOT_APPLICABLE').length});
const current=count(assessment.controls),t5=assessment.controls.filter(c=>required.has(c.id)||c.t5Verification.additionalT5Scope),open=t5.filter(c=>['FAIL','NOT_VERIFIED'].includes(c.postT5));
const releaseOnly=assessment.controls.filter(c=>!t5.includes(c)&&['FAIL','NOT_VERIFIED'].includes(c.postT5));
assessment.postT5Counts=current;
assessment.t5Assessment={generatedAt:new Date().toISOString(),verificationScope:'LOCAL_REAL_INFRASTRUCTURE_AND_PROTOCOL_PROVIDER_FIXTURES',verifyDuringT5Reviewed:required.size,
 additionalT5Scope:t5.length-required.size,counts:count(t5),blockingFindings:open.length,approvedExceptions:0,releaseOnlyBlockingFindings:releaseOnly.length,
 ASVS_L3_RELEASE_GATE:current.FAIL+current.NOT_VERIFIED===0?'YES':'NO'};
await writeFile('reports/security/asvs-5.0-l3.json',JSON.stringify(assessment,null,2)+'\n');
const escape=x=>String(x??'—').replaceAll('|','\\|').replaceAll('\n',' ');
const rows=assessment.controls.map(c=>`| ${c.id} | ${c.level} | ${c.postT5} | ${escape(c.descriptionFa)} | ${escape(c.t5Verification.observed)} | ${c.t5Verification.evidencePaths.map(p=>'`'+p+'`').join('<br>')} |`);
await writeFile('docs/security/03-t5-asvs-5.0-level3-assessment-fa.md',`# ارزیابی کامل وضعیت جاری ASVS 5.0.0 سطح ۳ پس از T5\n\nمنبع canonical: \`reports/security/asvs-5.0-l3.json\`. این سند مشتق از دادهٔ canonical است؛ ویرایش آن باید از workflow ارزیابی انجام شود. تاریخ: ${assessment.t5Assessment.generatedAt}.\n\n## دامنه و معیار نتیجه\n\nتمام ${current.total} کنترل سطح‌های ۱ تا ۳ پوشش داده شده‌اند. ${required.size} تعهد verifyDuringT5 و ${t5.length-required.size} کنترل تازه applicable دوباره ارزیابی شدند. وضعیت تاریخی postT4 و شمارش baseline حذف نشده‌اند. برای کنترل‌های خارج از تغییر T5، evidence تاریخی حفظ شده و ادعای اجرای مجدد مستقل همهٔ آنها نشده است. PASS فقط همان دامنهٔ بیان‌شده را اثبات می‌کند؛ نبود شاهد برای کل الزام NOT_VERIFIED و نقص پیاده‌سازی شناخته‌شده FAIL است. N/A دلیل scope دارد و معادل PASS نیست. استثنای تصویب‌شده: صفر.\n\nآزمون‌ها از PostgreSQL، Qdrant، Local/S3-compatible و browser واقعی استفاده می‌کنند؛ embedding/reranker/generation fixture پروتکل هستند و vLLM واقعی نیستند. TLS SIEM با CA اختصاصی بررسی شد. policy واقعی مشتری، mapping کاربران legacy، artifact/tokenizer مدل، scanner، sandbox، نگهداری/purge و امنیت زیرساخت از fixture نتیجه‌گیری نمی‌شوند.\n\n## شمارش جاری\n\n- PASS: ${current.PASS}\n- FAIL: ${current.FAIL}\n- NOT_VERIFIED: ${current.NOT_VERIFIED}\n- N/A: ${current.NOT_APPLICABLE}\n- مانع T5: ${open.length}\n- مانع فقط release: ${releaseOnly.length}\n- ASVS_L3_RELEASE_GATE: ${assessment.t5Assessment.ASVS_L3_RELEASE_GATE}\n\n## اجزای حساس و پرریسک\n\nLibreOffice و pdfjs فایل نامطمئن را پردازش می‌کنند؛ precheck، scratch خصوصی و timeout جای sandbox یا antivirus را نمی‌گیرند. Archive inflation دارای سقف است و DTD/entity، external relationship، macro و embedding Office رد می‌شوند. Native S3 SDK عملیات multipart با outcome نامعلوم دارد؛ intent پایدار و inspect/hash از retry کور جلوگیری می‌کند. Qdrant و provider شبکه‌ای فقط با مقصد و دادهٔ مجاز از ownerهای مربوط استفاده می‌شوند. مشتری باید isolation بدون شبکه، memory/CPU/file limits، signature update و verification تمام فرمت‌ها را فراهم و اثبات کند. تغییر architecture برای سیاست جدید بدون مجوز همین task مجاز نیست.\n\n## ماتریس کامل\n\n| کنترل | سطح | وضعیت جاری | الزام | نتیجهٔ بازبینی / شکاف | کد و شاهد |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`);
await writeFile('reports/security/t5-asvs-review.json',JSON.stringify({source:'reports/security/asvs-5.0-l3.json',...assessment.t5Assessment,controls:t5.map(c=>({id:c.id,status:c.postT5,...c.t5Verification}))},null,2)+'\n');
console.log(JSON.stringify(assessment.t5Assessment));
