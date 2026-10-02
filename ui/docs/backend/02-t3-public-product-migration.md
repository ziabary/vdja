# T3 anonymous public product migration plan

Status: implemented for the local T3 target database; customer cutover remains subject to a release build, security scan, and deployment acceptance.

## Source inventory and ownership

The active legacy MySQL source was inspected on 2026-10-02. `tblMultiDic` contained 0 rows, 0 distinct `dicID` values and 0 distinct `dicWord` values. The user also identified `src/db/data/multi-dic.json` as the dictionary source. It contains **72,907 entries**, of which **one has an empty phrase key and is not lookuppable**, leaving **72,906 importable entries**. The file has no lowercase-key collisions, and its SHA-256 is `2265e763c52d568aa120028b4d4bf6f0765d6fd8033595e3ed30b090c00b59d5`. Each entry has `translations`, `synonyms`, `antonyms`, `related words`, and `pronunciations`. This file is required reference data even though the active MySQL table is empty. A separate historical SQL dump in the parent workspace contains dictionary inserts; it is not the active MySQL database and is not silently treated as the migration source. Recheck all sources immediately before customer cutover.

| Service | Legacy access and transitive dependency | Classification | Target owner/action |
| --- | --- | --- | --- |
| Translator | `src/db/data/multi-dic.json` reference file; legacy `tblMultiDic` through `atDB.dic.lookup(dicWord)` is empty locally | REQUIRED_REFERENCE_DATA | Translator PostgreSQL persistence; import all validated JSON entries and any active MySQL rows under distinct source identities. |
| Translator | `tblLogs` through `atDB.log.add/updateResult` | REQUIRED_OPERATIONAL_STATE (new requests only); old rows are LEGACY_HISTORY_ONLY | Semantic Audit/Observability in PostgreSQL; no raw request/answer copy. |
| Translator | `tblPerUserStats` through `addChatTokens`, joined to `tblUser`/`tblGroup` for other legacy reads | LEGACY_FAKE_IDENTITY for anonymous traffic; old statistics are LEGACY_HISTORY_ONLY | Usage Accounting keyed by anonymous actor/deployment/tenant/run. Do not copy fake user 1. |
| Summarizer | `tblLogs`, `tblPerUserStats`, `tblUser`/`tblGroup` as above | REQUIRED_OPERATIONAL_STATE / LEGACY_FAKE_IDENTITY | Audit, Usage and explicit anonymous context; no historic copy. |
| FAQ | `getAuthInfo(req,false)` may read legacy identity/session state; no direct module table write; `generate` calls `chatService` | LEGACY_FAKE_IDENTITY | Explicit anonymous context. No identity migration. |
| Shared file path | `file2Text` uses `getAuthInfo` privilege-derived file limit, temporary files, PDF/DOC processors | LEGACY_FAKE_IDENTITY plus REQUIRED_OPERATIONAL_STATE | Configuration/Admission own limits; File Processing owns parser and cleanup. |
| All three | `configManager` `.config.json`, `chatService` model URL/model/retry/cancel state | REQUIRED_OPERATIONAL_STATE | Typed CJSON Configuration and AI Router; no MySQL data copy. |

No evidence shows Translator/Summarizer/FAQ need old chats, messages, user accounts, CRM or unrelated module data. They remain `LEGACY_HISTORY_ONLY` or `UNUSED_BY_TARGET` and are excluded.

## Required reference row mapping

| Source | Target | Mapping |
| --- | --- | --- |
| `tblMultiDic.dicID` | `translator.tbl_trn_dictionary.trd_source_id` | Preserve unsigned integer source identity as a unique bigint. |
| `dicSource`, `dicLang`, `dicWord` | `trd_source`, `trd_lang`, `trd_word` | Preserve text exactly; no case folding during import. Lookup applies the legacy lowercased input. |
| `dicTranslation`, `dicSynonyms`, `dicAntonyms`, `dicRelExp`, `dicRelWord`, `dicPronunciation`, `dicExamples`, `dicExtra` | correspondingly named `trd_*` text columns | Preserve bytes after UTF-8 decode and SQL NULL as NULL. Do not invent empty arrays/defaults. Legacy JSON text is parsed only at the response boundary, matching current behavior. |

The JSON dictionary maps its object key to the target phrase/source key and its five payload fields to JSONB. An import fingerprint is computed from the complete source file. JSON import is idempotent by a stable `JSON_FILE` source key; MySQL rows, if any, use a stable `MYSQL` + `dicID` source key. A documented lookup preference resolves overlap without dropping source evidence. The source file has no `dicID`, language code, or extra field; those must remain absent rather than fabricated. The JSON payload cannot be mapped field for field into the MySQL row shape without a semantic adapter.

The legacy lookup has no uniqueness guarantee on `dicWord` and uses `.first()` without `ORDER BY`; duplicate-word behavior requires explicit review. The target may use source ID order for deterministic selection, and cutover validation must compare representative duplicate words before enabling it. The existing Translator maps `examples` from `dicPronunciation`, despite `dicExamples` existing; preserve this public response behavior until separately approved.

## Migration command and verification contract

`migrate:public-tools:mysql-to-pg` must accept `--dry-run`, connect to MySQL with a read-only user/transaction, and write only PostgreSQL on apply. It must UPSERT by `trd_source_id`, be resumable, never dual-write, and avoid secrets or row text in logs. It records source/target counts, missing/extra source keys, duplicate IDs/words and a deterministic SHA-256 fingerprint of ordered canonical row content. A sample of source IDs must compare all mapped fields semantically. Retry after partial failure must converge to the same fingerprint. Unexpected target-only rows or mismatched source content close the cutover gate.

For a new customer with no legacy MySQL, `--json-only` imports the bundled
dictionary file and skips all MySQL configuration and connections. This is the
fresh deployment path; the default mode remains the legacy source comparison.

At implementation time the active MySQL source had 0 rows and the JSON source had 72,907 entries, including one unusable empty key. The migration command imported 72,906 JSON entries into the target PostgreSQL database. Validation reported source=target=72,906 with 0 missing, extra, mismatched or duplicate keys. The historical dump remains excluded pending an explicit data-source decision. Re-run the dry run and exact comparison before customer cutover; the count is a local observation, not a claim about another customer's MySQL source.

## Cutover and rollback

Apply fresh-deployment PostgreSQL migrations with a dedicated migration role. Run the migration command and verify source/target row identity and fingerprint. Start the target API/Worker with validated CJSON, then test Translator dictionary and AI paths, Summarizer, FAQ, file extraction, streaming/cancel, Usage, Audit, Admission and SIEM. Stop MySQL without deleting its volume and repeat all three live requests through the Web/API/AI Router path. Only then switch ingress. Keep legacy routes and source data available for rollback until the cutover report is accepted. A rollback restores ingress and the prior image set; it does not reverse committed audit/usage evidence or assume PostgreSQL schema rollback is safe.
