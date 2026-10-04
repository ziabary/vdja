// Requirement-specific executed cases for T5-changed ASVS controls.
// An omitted control cannot acquire PASS merely from a passing feature suite.
export const DIRECT_CONTROL_CASES={
 'V1.1.2':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V1.2.1':'display filename preserves Persian basename and removes dangerous metadata',
 'V1.3.5':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V1.4.2':'Authority selects file tiers; Admission enforces distributed actor and hard limits after elevation and revocation',
 'V1.4.3':'noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content',
 'V2.1.3':'identity tiers cannot exceed hard platform limits or lower the privileged tier',
 'V2.2.1':'managed transfer configuration selects one adapter with external credentials and strict bounds',
 'V2.2.3':'invalid signature/hash never creates Asset, Version, or processing Job',
 'V2.3.1':'one live lease owns transfer mutation and checksum/size intent survives retry',
 'V2.3.2':'concurrent replicas cannot over-reserve storage and committed storage stays charged',
 'V2.3.3':'asset/version/job transaction rolls back at the crash boundary',
 'V2.3.4':'lease fencing prevents replaced Worker from settling durable work',
 'V3.2.1':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V3.2.2':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V3.5.1':'HTTP login, Origin, refresh replay, concurrent refresh, logout and disabled Auth',
 'V3.5.2':'HTTP login, Origin, refresh replay, concurrent refresh, logout and disabled Auth',
 'V3.5.7':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V3.5.8':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V4.1.1':'File Management enforces real Session/Authority before verified upload commit and cache/range downloads',
 'V4.1.4':'anonymous/mismatched tenant fail and all file operations run through the API File Management boundary',
 'V5.1.1':'upload media type, extension, signature, and temporary path agree',
 'V5.2.4':'Authority selects file tiers; Admission enforces distributed actor and hard limits after elevation and revocation',
 'V5.4.1':'display filename preserves Persian basename and removes dangerous metadata',
 'V5.4.2':'File Management enforces real Session/Authority before verified upload commit and cache/range downloads',
 'V8.1.3':'real persisted Authority resolves object, field, ACL, classification, scope, schedule, version and audited SIEM decisions',
 'V8.1.4':'Authority before retrieval limits the real vector query; revoked source bytes never reach reranker or LLM',
 'V11.2.5':'malformed vectors, index duplicates, wrong model, oversized responses and redirects fail before result publication',
 'V12.3.2':'actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request',
 'V13.1.3':'actual API/Worker/Storage/Qdrant pipeline fails closed on dependencies, admission, session, Authority and Governance',
 'V13.2.4':'Governance denial rejects generation before external content leaves its Router',
 'V14.2.3':'unapproved fallback receives zero bytes and approved provider failure does not grant egress',
 'V14.2.5':'warm/disposable cache, range and conditional requests cannot skip independent download authorization',
 'V14.2.6':'read is not use; use does not disclose/download; unknown citations and direct quotation fail closed',
 'V14.3.1':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V14.3.2':'built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations',
 'V15.1.3':'distributed query reservations reject additional API work before provider dispatch',
 'V15.3.2':'malformed vectors, index duplicates, wrong model, oversized responses and redirects fail before result publication',
 'V15.4.3':'heartbeat prevents a competing replica from replacing a live long-running claim',
 'V16.2.1':'actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request',
 'V16.2.5':'sensitive contents, prompts, answers and locators are absent from exported/canonical evidence',
 'V16.3.3':'mandatory decision evidence failure blocks every current Authority path',
 'V16.3.4':'last-resort handler redacts exception payload and drains before supervisor replacement',
 'V16.5.3':'actual API/Worker/Storage/Qdrant pipeline fails closed on dependencies, admission, session, Authority and Governance'
};

export function blockerClass(id){
 id=id.replace(/^v5\.0\.0-/,'');
 if(id==='V15.2.1')return 'SUPPLY_CHAIN_REQUIRED';
 if(id==='V5.4.3')return 'EXTERNAL_DEPENDENCY_REQUIRED';
 if(['V1.3.3','V1.4.1','V1.5.1','V1.5.3','V5.2.2'].includes(id))return 'EXTERNAL_DEPENDENCY_REQUIRED';
 if(['V12.3.5','V13.2.1'].includes(id))return 'CODE_FIX_REQUIRED';
 if(['V3.4.3','V3.4.7','V11.7.2','V12.3.1','V12.3.3','V12.3.4','V13.2.2','V13.2.3',
   'V13.3.2','V14.1.1','V14.1.2','V14.2.2','V14.2.4','V14.2.7','V15.2.5','V16.1.1',
   'V16.2.2','V16.2.3','V16.4.2','V16.4.3','V16.5.4'].includes(id))return 'DEPLOYMENT_EVIDENCE_REQUIRED';
 if(['V10.1.1','V11.5.1','V11.5.2','V13.2.5','V13.2.6'].includes(id))return 'TEST_EVIDENCE_REQUIRED';
 return 'TEST_EVIDENCE_REQUIRED';
}
