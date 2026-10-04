import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeManifestSource, analyzeSql, analyzeTypeScript, classifyExecutionBoundary, RULES, sortViolations, type intfArchitectureViolation } from './support/staticAnalysis.ts';

function tsRules(file:string,code:string):Set<string>{const out:intfArchitectureViolation[]=[];analyzeTypeScript(file,out,code);return new Set(out.map(v=>v.ruleId));}
function sqlRules(code:string):Set<string>{const out:intfArchitectureViolation[]=[];analyzeSql('db/fixture.sql',code,out);return new Set(out.map(v=>v.ruleId));}
test('catalog IDs are unique and have a detection mechanism',()=>{assert.equal(new Set(RULES.map(r=>r.id)).size,RULES.length);assert.ok(RULES.every(r=>r.mechanism.length>0));});
test('dependency and persistence boundaries use imports and calls',()=>{
 assert.ok(tsRules('packages/platform/src/service.ts',"import x from '../../../modules/crm/src/private';").has('ARCH-DEP-001'));
 assert.ok(tsRules('modules/crm/src/service.ts',"import x from '../../secretariat/src/private';").has('ARCH-DEP-002'));
 assert.ok(tsRules('modules/crm/src/service.ts',"import x from '../../secretariat/persistence/repository';").has('ARCH-DEP-003'));
 const route=tsRules('apps/api/src/routes/letters.ts',"import { Pool } from 'pg'; db.query('SELECT x');");
 assert.ok(route.has('ARCH-DB-001'));assert.ok(route.has('ARCH-DB-003'));
 assert.ok(tsRules('apps/worker/src/handler.ts',"import { Pool } from 'pg'; db.query('SELECT x');").has('ARCH-DB-004'));
});
test('TypeScript naming and safety checks inspect AST nodes',()=>{
 const rules=tsRules('modules/crm/src/domain/model.ts',"class Service {} class Failure extends Error {} interface Ticket {} enum State {Open} type Result = any; export * from './other'; if (status === 'open') {}");
 for(const id of ['ARCH-TS-NAME-001','ARCH-TS-NAME-002','ARCH-TS-NAME-003','ARCH-TS-NAME-004','ARCH-TS-NAME-005','ARCH-TS-001','ARCH-TS-002','ARCH-TS-003'])assert.ok(rules.has(id),id);
 assert.ok(tsRules('modules/crm/src/domain/contracts.ts','export type typTicketResult = Record<string, unknown>;').has('ARCH-TS-004'));
});
test('Authority and provider boundaries inspect executable code',()=>{
 const rules=tsRules('modules/crm/src/application/task.ts',"import OpenAI from 'openai'; import { QdrantClient } from '@qdrant/js-client-rest'; import twilio from 'twilio'; import Stripe from 'stripe'; function hasPriv() {} if (user.role === 'admin') return 'ALLOW'; const model = {model:'gpt-4'};");
 for(const id of ['ARCH-AI-001','ARCH-AI-002','ARCH-AUTH-001','ARCH-AUTH-002','ARCH-DOC-002','ARCH-PROVIDER-001','ARCH-PROVIDER-002'])assert.ok(rules.has(id),id);
});
test('pure Authority evaluator is restricted to Authority internals and tests',()=>{
 const imported="import { evaluateAuthority as decide } from '../../packages/authority/src/index.js'; const result=decide(input);";
 assert.ok(tsRules('modules/crm/src/service.ts',imported).has('ARCH-AUTH-004'));
 assert.ok(tsRules('apps/api/src/index.ts','const decision=evaluateAuthority(input);').has('ARCH-AUTH-004'));
 assert.ok(tsRules('apps/worker/src/index.ts','const decision=authority.evaluateAuthority(input);').has('ARCH-AUTH-004'));
 assert.ok(!tsRules('packages/authority/src/service.ts',imported).has('ARCH-AUTH-004'));
 assert.ok(!tsRules('tests/conformance/authority/case.ts',imported).has('ARCH-AUTH-004'));
 assert.ok(!tsRules('modules/crm/src/service.ts','const result=authorityService.authorize(input);').has('ARCH-AUTH-004'));
});
test('SQL rules distinguish SELECT star from COUNT star',()=>{
 assert.ok(sqlRules('SELECT * FROM crm.tbl_crm_customer;').has('ARCH-DB-005'));
 assert.ok(!sqlRules('SELECT COUNT(*) FROM crm.tbl_crm_customer;').has('ARCH-DB-005'));
 assert.ok(sqlRules('SELECT usr_id FROM tbl_aaa_user;').has('ARCH-DB-006'));
});
test('SQL qualification recognizes declared CTEs and row constructors without hiding unqualified base tables', () => {
 assert.ok(!sqlRules('WITH exhausted AS (SELECT job_id FROM jobs.tbl_job_work) SELECT job_id FROM exhausted;').has('ARCH-DB-006'));
 assert.ok(!sqlRules('SELECT ROW(1,2) IS DISTINCT FROM ROW(3,4);').has('ARCH-DB-006'));
 assert.ok(sqlRules('WITH exhausted AS (SELECT job_id FROM tbl_job_work) SELECT job_id FROM exhausted;').has('ARCH-DB-006'));
 assert.ok(sqlRules('SELECT job_id FROM exhausted;').has('ARCH-DB-006'));
 assert.ok(sqlRules('WITH exhausted AS (SELECT job_id FROM jobs.tbl_job_work) SELECT job_id FROM exhausted; SELECT job_id FROM exhausted;').has('ARCH-DB-006'));
});
test('SQL naming checks cover tables, columns, FKs, objects, parameters, locals',()=>{
 const rules=sqlRules("CREATE TABLE authority.bad_table (id bigint, owner_id bigint REFERENCES authority.tbl_aaa_user(usr_id)); CREATE FUNCTION authority.bad_fn(bad_arg integer) RETURNS integer AS $$ DECLARE wrong integer; BEGIN RETURN wrong; END $$ LANGUAGE plpgsql; CREATE INDEX bad_idx ON authority.bad_table(id);");
 for(const id of ['ARCH-DB-NAME-001','ARCH-DB-NAME-002','ARCH-DB-NAME-003','ARCH-DB-NAME-004','ARCH-DB-NAME-005','ARCH-DB-NAME-006'])assert.ok(rules.has(id),id);
});
test('violations sort deterministically',()=>{const values:intfArchitectureViolation[]=[{ruleId:'ARCH-TS-001',classification:'ARCHITECTURE_VIOLATION',file:'b',line:2,message:'z'},{ruleId:'ARCH-DB-001',classification:'ARCHITECTURE_VIOLATION',file:'a',line:1,message:'a'}];assert.equal(sortViolations(values)[0]?.ruleId,'ARCH-DB-001');});
test('typed manifest AST checks all canonical global IDs and route collisions',()=>{
 const out:intfArchitectureViolation[]=[],seen=new Map<string,string>();
 const body=(id:string)=>`export const manifest = {id:'${id}',version:'1.0.0',compatibility:{min:'1'},instanceModel:'single',capabilities:{required:[],optional:[]},authorization:{resourceTypes:[{id:'resource.x'}],privileges:[{id:'priv.x'}]},backend:{routes:[{id:'route.x',method:'GET',path:'/x'}]},ai:{tasks:[{id:'task.x'}]},notifications:{notificationTypes:[{id:'notification.x'}]},usage:{meters:[{id:'meter.x'}]}} satisfies intfModuleManifest;`;
 analyzeManifestSource('modules/one/manifest.ts',body('one'),out,seen);
 analyzeManifestSource('modules/two/manifest.ts',body('one'),out,seen);
 const duplicates=out.filter(v=>v.ruleId==='ARCH-MOD-002').map(v=>v.message);
 for(const kind of ['module','resourceType','privilege','routeContribution','aiTask','notificationType','usageMeter'])assert.ok(duplicates.some(v=>v.includes(kind+':')),kind);
});
test('persistence boundary distinguishes composition wiring and external source adapters',()=>{
 assert.equal(classifyExecutionBoundary('packages/integrations/src/adapters/mssql/reader.ts'),'ExternalDatabaseAdapter');
 assert.equal(classifyExecutionBoundary('apps/api/src/composition.ts'),'CompositionRoot');
 assert.ok(tsRules('apps/api/src/routes/handler.ts',"import { db } from '../persistence/db';").has('ARCH-DB-003'));
 assert.ok(tsRules('modules/crm/src/application/service.ts',"db.query('SELECT id FROM app.tbl_crm_user');").has('ARCH-DB-001'));
 assert.ok(!tsRules('modules/crm/src/persistence/repository.ts',"db.query('SELECT usr_id FROM crm.tbl_crm_user');").has('ARCH-DB-001'));
 assert.ok(!tsRules('apps/api/src/composition.ts',"import { createXRepository } from './persistence'; const repository=createXRepository(); new clsApplicationService(repository);").has('ARCH-DB-001'));
 assert.ok(tsRules('apps/api/src/composition.ts',"db.select('users');").has('ARCH-DB-001'));
 assert.ok(tsRules('apps/api/src/composition.ts',"repository.findById('x');").has('ARCH-DB-001'));
 assert.ok(!tsRules('packages/integrations/src/adapters/mssql/reader.ts',"import mssql from 'mssql'; sourceClient.query('SELECT id FROM users');").has('ARCH-DB-001'));
 assert.ok(tsRules('packages/integrations/src/adapters/mssql/reader.ts',"import { tblUser } from '../../../../platform/persistence/tables';").has('ARCH-DB-001'));
 assert.ok(tsRules('packages/integrations/src/adapters/mssql/reader.ts',"sourceClient.query('SELECT usr_id FROM authority.tbl_aaa_user');").has('ARCH-DB-001'));
 assert.ok(tsRules('modules/secretariat/src/adapters/mssql/reader.ts',"sourceClient.query('UPDATE source_letters SET title=1');").has('ARCH-DB-001'));
 assert.ok(!tsRules('packages/integrations/src/adapters/mssql/outbound/writer.ts',"import type { intfExternalDatabaseOutboundPort } from '../../contracts/outbound'; sourceClient.query('UPDATE source_letters SET title=1');").has('ARCH-DB-001'));
 assert.ok(tsRules('packages/integrations/src/application/reader.ts',"import mssql from 'mssql';").has('ARCH-DB-001'));
});
test('SQL qualification inspects SQL contexts and ignores keywords, prose, and referential actions',()=>{
 assert.ok(!sqlRules('SELECT usr_id FROM authority.tbl_aaa_user;').has('ARCH-DB-006'));
 assert.ok(sqlRules('SELECT id FROM tbl_user;').has('ARCH-DB-006'));
 const ddl=sqlRules('CREATE TABLE IF NOT EXISTS app.tbl_mod_entity (id integer); ALTER TABLE app.tbl_child ADD CONSTRAINT fk_child_parent FOREIGN KEY (child_parent__par_id) REFERENCES app.tbl_parent (par_id) ON DELETE CASCADE ON UPDATE CASCADE; DROP TABLE IF EXISTS app.tbl_old;');
 assert.ok(!ddl.has('ARCH-DB-006'));
 assert.ok(!sqlRules('SELECT EXISTS(SELECT 1 FROM app.tbl_user); SELECT COUNT(*) FROM app.tbl_user;').has('ARCH-DB-005'));
 assert.ok(!tsRules('src/services/prose.ts',`const prose="SELECT id FROM Logs"; db.raw('select 1');`).has('ARCH-DB-006'));
 assert.ok(tsRules('src/services/query.ts',"db.raw('SELECT id FROM tbl_user');").has('ARCH-DB-006'));
 assert.ok(!sqlRules('REVOKE ALL ON FUNCTION audit.fn_aud_capture_safe() FROM PUBLIC;').has('ARCH-DB-006'));
 assert.ok(!sqlRules('CREATE FUNCTION audit.fn_x() RETURNS trigger AS $$ DECLARE v_record_id text; BEGIN RETURN NULL; END $$ LANGUAGE plpgsql;').has('ARCH-DB-NAME-006'));
 assert.ok(sqlRules('CREATE FUNCTION audit.fn_x() RETURNS trigger AS $$ DECLARE v_row RECORD; BEGIN RETURN NULL; END $$ LANGUAGE plpgsql;').has('ARCH-DB-NAME-006'));
});
test('AI output guard ignores run metadata but catches direct model text writes',()=>{
 assert.ok(!tsRules('packages/ai-router/src/persistence.ts',"tx.query('UPDATE ai_router.tbl_air_run SET air_output_tokens=$1', [value.outputTokens, value.modelId]);").has('ARCH-AI-004'));
 assert.ok(tsRules('packages/ai-router/src/application/service.ts',"repository.save({ body: model.output });").has('ARCH-AI-004'));
});
test('naming accepts exact prefixes and recognizes transitive exceptions',()=>{
 const valid=tsRules('modules/crm/src/domain/classes.ts','class exBase extends Error {} class exHttpUnauthorized extends exBase {} class clsUserService {} interface intfFoo {} type typFoo = string; enum enuState {ACTIVE}');
 for(const id of ['ARCH-TS-NAME-001','ARCH-TS-NAME-002','ARCH-TS-NAME-003','ARCH-TS-NAME-004','ARCH-TS-NAME-005'])assert.ok(!valid.has(id),id);
 const invalid=tsRules('modules/crm/src/domain/classes.ts','class UnauthorizedException extends Error {} class UserService {} interface IntfFoo {} type TypFoo = string; enum EnuState {ACTIVE}');
 for(const id of ['ARCH-TS-NAME-001','ARCH-TS-NAME-002','ARCH-TS-NAME-003','ARCH-TS-NAME-004','ARCH-TS-NAME-005'])assert.ok(invalid.has(id),id);
});
test('Authority and AI checks distinguish facts and owner boundaries',()=>{
 assert.ok(!tsRules('modules/crm/src/application/facts.ts','const id = resource.ownerId; const label = user.role === "owner" ? "Owner" : "Other";').has('ARCH-AUTH-001'));
 assert.ok(tsRules('modules/crm/src/application/access.ts',"if (ownerId === actorId) return 'ALLOW';").has('ARCH-AUTH-001'));
 assert.ok(tsRules('modules/crm/src/application/access.ts',"if (privs.ALL === true) return 'ALLOW';").has('ARCH-AUTH-001'));
 assert.ok(tsRules('modules/crm/src/application/ai.ts',"const choice={model:'gpt-4'};").has('ARCH-AI-002'));
 assert.ok(!tsRules('packages/ai-router/src/config.ts',"const choice={model:'gpt-4'};").has('ARCH-AI-002'));
 assert.ok(tsRules('modules/crm/src/application/ai.ts',"import { QdrantClient } from '@qdrant/js-client-rest';").has('ARCH-DOC-002'));
 assert.ok(!tsRules('packages/knowledge/src/adapters/qdrant.ts',"import { QdrantClient } from '@qdrant/js-client-rest';").has('ARCH-AI-003'));
});
test('magic decisions and constants target stable declarations',()=>{
 assert.ok(tsRules('modules/crm/src/application/service.ts',"if (status === 'approved') return;").has('ARCH-TS-002'));
 assert.ok(!tsRules('src/utils/fileProcessors/pdf-simple.ts',"if (b.type === 'title') return;").has('ARCH-TS-002'));
 assert.ok(!tsRules('modules/crm/src/application/service.ts','const localValue = 3; export const MAX_RETRY_COUNT = 3;').has('ARCH-TS-NAME-007'));
 assert.ok(tsRules('modules/crm/src/application/service.ts','export const maxRetryCount = 3;').has('ARCH-TS-NAME-007'));
 assert.ok(!tsRules('modules/crm/src/application/service.ts','const { external_field } = record; const row = {"db_column": 1};').has('ARCH-TS-NAME-006'));
});
test('canonical typed manifest alone supplies contribution IDs and routes have module scope',()=>{
 const out:intfArchitectureViolation[]=[],seen=new Map<string,string>();
 const body=(id:string,routeId?:string)=>`import type { intfModuleManifest } from './contract'; const unrelated={id:'noise'}; export const MODULE_MANIFEST: intfModuleManifest = {id:'${id}',version:'1',compatibility:{min:'1'},instanceModel:'single',capabilities:{required:[]},authorization:{privileges:[{id:'${id}.read'}]},backend:{routes:[{${routeId?`id:'${routeId}',`:''}method:'GET',path:'/settings'}]}};`;
 analyzeManifestSource('modules/secretariat/manifest.ts',body('secretariat'),out,seen);
 analyzeManifestSource('modules/widget/manifest.ts',body('widget'),out,seen);
 assert.ok(!out.some(v=>v.ruleId==='ARCH-MOD-002'),JSON.stringify(out));
 analyzeManifestSource('modules/secretariat/duplicate.ts',body('secretariat'),out,seen);
 assert.ok(out.some(v=>v.ruleId==='ARCH-MOD-002'&&v.message.includes('routeEffective')));
 const fake:intfArchitectureViolation[]=[];
 analyzeManifestSource('modules/fake/manifest.ts',"import type { intfModuleManifest } from './contract'; // intfModuleManifest\nexport const anything={};",fake,new Map());
 assert.ok(fake.some(v=>v.ruleId==='ARCH-MOD-001'));
 const route:intfArchitectureViolation[]=[],routeSeen=new Map<string,string>();
 analyzeManifestSource('modules/a/manifest.ts',body('a','canonical.route'),route,routeSeen);
 analyzeManifestSource('modules/b/manifest.ts',body('b','canonical.route'),route,routeSeen);
 assert.ok(route.some(v=>v.ruleId==='ARCH-MOD-002'&&v.message.includes('routeContribution')));
});

test('SQL qualification distinguishes DISTINCT FROM expressions and still rejects unqualified relations',()=>{assert.ok(!sqlRules('IF i_tenant IS DISTINCT FROM v_tenant THEN RETURN NULL; END IF;').has('ARCH-DB-006'));assert.ok(!sqlRules('SELECT doc_id FROM documents.tbl_doc_document WHERE doc_id IS NOT DISTINCT FROM i_id;').has('ARCH-DB-006'));assert.ok(sqlRules('SELECT doc_id FROM tbl_doc_document WHERE doc_id IS DISTINCT FROM i_id;').has('ARCH-DB-006'));});
