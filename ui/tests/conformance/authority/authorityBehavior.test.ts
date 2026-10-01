import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type typDecision = 'ALLOW'|'DENY';
export type typClassificationLevel = 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
export interface intfAuthorityFacts { readonly actorId:string; readonly tenantId:string; readonly deploymentId:string; readonly state:'ACTIVE'|'SUSPENDED'|'TERMINATED'; readonly clearance?:typClassificationLevel; readonly resource?:Readonly<{ownerId?:string;tenantId?:string;classification?:typClassificationLevel;acl?:Readonly<{denyActors?:readonly string[];grantActors?:readonly string[]}>}>; readonly organization?:Readonly<{requested:string;parentByChild:Readonly<Record<string,string>>}> }
export interface intfAuthorityGrant { readonly privileges:Readonly<Record<string,unknown>>; readonly scope?:string; readonly source?:'ROLE'|'IDENTITY'; readonly validFrom?:string; readonly validUntil?:string; readonly recurring?:Readonly<{timezone:string;weekdays:readonly number[];start:string;end:string;calendar?:'GREGORIAN'|'JALALI';oddEvenDay?:'ODD'|'EVEN'}>; readonly explicit?:boolean }
export interface intfAuthorityRequest { readonly facts:intfAuthorityFacts; readonly path:string; readonly now:string; readonly grants:readonly intfAuthorityGrant[]; readonly denies?:readonly string[]; readonly crud?:Readonly<{value:unknown;operation:'CREATE'|'READ'|'UPDATE'|'DELETE'}>; readonly requireClassification?:boolean }
export interface intfAuthorityConformanceAdapter { evaluate(input:Readonly<intfAuthorityRequest>):typDecision|Readonly<{decision:typDecision}>; getPrivValue(privileges:Readonly<Record<string,unknown>>,path:string,allDefault?:unknown):unknown; readonly invalidationContract?:Readonly<{authorizationVersion:boolean;sessions:boolean;refreshFamilies:boolean;delegation:boolean;breakGlass:boolean}> }

const FACTS:intfAuthorityFacts={actorId:'actor-1',tenantId:'tenant-a',deploymentId:'deployment-a',state:'ACTIVE'};
const NOW='2026-10-05T09:00:00.000Z';
const grant=(privileges:Readonly<Record<string,unknown>>,rest:Partial<intfAuthorityGrant>={}):intfAuthorityGrant=>({privileges,...rest});
const req=(path:string,grants:readonly intfAuthorityGrant[],rest:Partial<intfAuthorityRequest>={}):intfAuthorityRequest=>({facts:FACTS,path,now:NOW,grants,...rest});
let binding:Promise<intfAuthorityConformanceAdapter>|undefined;
async function adapter():Promise<intfAuthorityConformanceAdapter>{
 binding??=(async()=>{
  const target=process.env.AUTHORITY_CONFORMANCE_ADAPTER;
  if(!target)throw new Error('TARGET_AUTHORITY_ADAPTER_NOT_AVAILABLE: set AUTHORITY_CONFORMANCE_ADAPTER to a test-side binding');
  const module:unknown=await import(pathToFileURL(resolve(target)).href);
  if(!module||typeof module!=='object'||!('authorityConformanceAdapter' in module))throw new Error('TEST_INFRA_FAILURE: binding must export authorityConformanceAdapter');
  const value=(module as {authorityConformanceAdapter:unknown}).authorityConformanceAdapter;
  if(!value||typeof value!=='object'||!('evaluate' in value)||!('getPrivValue' in value)||typeof value.evaluate!=='function'||typeof value.getPrivValue!=='function')throw new Error('TEST_INFRA_FAILURE: binding lacks evaluate/getPrivValue');
  return value as intfAuthorityConformanceAdapter;
 })();
 return binding;
}
async function expect(input:intfAuthorityRequest,decision:typDecision):Promise<void>{const actual=(await adapter()).evaluate(input);assert.equal(typeof actual==='string'?actual:actual.decision,decision);}
const PRIV={secretariat:{letter:{read:true,crud:'0w10'},connector:{manage:true}}};
const READ='secretariat.letter.read';

test('root ALL',()=>expect(req(READ,[grant({ALL:true})]),'ALLOW'));
test('internal ALL',()=>expect(req('secretariat.connector.manage',[grant({secretariat:{ALL:true}})]),'ALLOW'));
test('sibling isolation',()=>expect(req('crm.customer.read',[grant({secretariat:{ALL:true}})]),'DENY'));
test('ALL plus explicit deny',()=>expect(req(READ,[grant({ALL:true})],{denies:[READ]}),'DENY'));
test('root ALL cannot cross tenant boundary',()=>expect(req(READ,[grant({ALL:true})],{facts:{...FACTS,resource:{tenantId:'tenant-b'}}}),'DENY'));
test('classification HIGH denies LOW clearance',()=>expect(req(READ,[grant(PRIV)],{facts:{...FACTS,clearance:'LOW',resource:{tenantId:'tenant-a',classification:'HIGH'}},requireClassification:true}),'DENY'));
test('classification LOW allows HIGH clearance with grant',()=>expect(req(READ,[grant(PRIV)],{facts:{...FACTS,clearance:'HIGH',resource:{tenantId:'tenant-a',classification:'LOW'}},requireClassification:true}),'ALLOW'));
test('resource ACL explicit deny wins over ordinary grant',()=>expect(req(READ,[grant(PRIV)],{facts:{...FACTS,resource:{tenantId:'tenant-a',acl:{denyActors:['actor-1']}}}}),'DENY'));
test('resource ACL grant allows absent ordinary grant',()=>expect(req(READ,[],{facts:{...FACTS,resource:{tenantId:'tenant-a',acl:{grantActors:['actor-1']}}}}),'ALLOW'));
test('typed value and missing value',async()=>{const a=await adapter();assert.equal(a.getPrivValue({session:{maxActive:5}},'session.maxActive'),5);assert.deepEqual(a.getPrivValue({review:{groups:['legal']}},'review.groups'),['legal']);assert.equal(a.getPrivValue({},'missing'),undefined);});
test('ALL default value',async()=>{const a=await adapter();assert.equal(a.getPrivValue({ALL:true},'session.maxActive',null),null);assert.equal(a.getPrivValue({ALL:true},'session.maxActive',1000000),1000000);assert.equal(a.getPrivValue({ALL:true},'session.maxActive'),undefined);});
for(const [value,operation,decision] of [['0000','READ','DENY'],['1111','DELETE','ALLOW'],['0w10','CREATE','DENY'],['0w10','UPDATE','ALLOW']] as const)test(`CRUD ${value} ${operation}`,()=>expect(req('secretariat.letter.crud',[grant({secretariat:{letter:{crud:value}}})],{crud:{value,operation}}),decision));
test('owner match w',()=>expect(req('secretariat.letter.crud',[grant(PRIV)],{facts:{...FACTS,resource:{ownerId:'actor-1'}},crud:{value:'0w10',operation:'READ'}}),'ALLOW'));
test('owner mismatch w',()=>expect(req('secretariat.letter.crud',[grant(PRIV)],{facts:{...FACTS,resource:{ownerId:'actor-2'}},crud:{value:'0w10',operation:'READ'}}),'DENY'));
test('missing owner w',()=>expect(req('secretariat.letter.crud',[grant(PRIV)],{crud:{value:'0w10',operation:'READ'}}),'DENY'));
const ORG={requested:'Treasury',parentByChild:{Treasury:'Finance',Finance:'Organization'}};
test('parent scope covers child',()=>expect(req(READ,[grant(PRIV,{scope:'Finance'})],{facts:{...FACTS,organization:ORG}}),'ALLOW'));
test('child scope does not expand upward',()=>expect(req(READ,[grant(PRIV,{scope:'Treasury'})],{facts:{...FACTS,organization:{...ORG,requested:'Finance'}}}),'DENY'));
test('explicit child role grant',()=>expect(req(READ,[grant(PRIV,{scope:'Treasury',source:'ROLE',explicit:true})],{facts:{...FACTS,organization:ORG}}),'ALLOW'));
test('explicit child identity grant',()=>expect(req(READ,[grant(PRIV,{scope:'Treasury',source:'IDENTITY',explicit:true})],{facts:{...FACTS,organization:ORG}}),'ALLOW'));
for(const [now,decision] of [['2026-10-01T07:59:59.999Z','DENY'],['2026-10-01T08:00:00.000Z','ALLOW'],['2026-10-01T09:00:00.000Z','ALLOW'],['2026-10-01T16:00:00.000Z','DENY'],['2026-10-01T16:00:00.001Z','DENY']] as const)test(`absolute [start,end) ${now}`,()=>expect(req(READ,[grant(PRIV,{validFrom:'2026-10-01T08:00:00.000Z',validUntil:'2026-10-01T16:00:00.000Z'})],{now}),decision));
const SCHEDULE={timezone:'Asia/Tehran',weekdays:[1,2,3,4,5],start:'08:00',end:'16:00'};
test('recurring timezone inside',()=>expect(req(READ,[grant(PRIV,{recurring:SCHEDULE})],{now:'2026-10-05T06:00:00.000Z'}),'ALLOW'));
test('recurring timezone end exclusive',()=>expect(req(READ,[grant(PRIV,{recurring:SCHEDULE})],{now:'2026-10-05T12:30:00.000Z'}),'DENY'));
test('Jalali odd day schedule',()=>expect(req(READ,[grant(PRIV,{recurring:{...SCHEDULE,calendar:'JALALI',oddEvenDay:'ODD'}})],{now:'2026-10-05T06:00:00.000Z'}),'ALLOW'));
test('suspension',()=>expect(req(READ,[grant({ALL:true})],{facts:{...FACTS,state:'SUSPENDED'}}),'DENY'));
test('termination',()=>expect(req(READ,[grant({ALL:true})],{facts:{...FACTS,state:'TERMINATED'}}),'DENY'));
test('missing classification fails closed',()=>expect(req(READ,[grant({ALL:true})],{requireClassification:true}),'DENY'));
test('malformed CRUD fails closed',()=>expect(req('secretariat.letter.crud',[grant({secretariat:{letter:{crud:15}}})],{crud:{value:15,operation:'READ'}}),'DENY'));
test('invalid temporal rule fails closed',()=>expect(req(READ,[grant({ALL:true},{validFrom:'invalid'})]),'DENY'));
test('invalid tenant scope fails closed',()=>expect(req(READ,[grant({ALL:true})],{facts:{...FACTS,tenantId:''}}),'DENY'));
test('determinism',async()=>{const a=await adapter(),input=req(READ,[grant({ALL:true})]);assert.deepEqual(a.evaluate(input),a.evaluate(input));});
test('input non-mutation',async()=>{const a=await adapter(),input=req(READ,[grant({ALL:true})]),before=structuredClone(input);a.evaluate(input);assert.deepEqual(input,before);});
test('invalidation contract',async()=>{const a=await adapter();assert.deepEqual(a.invalidationContract,{authorizationVersion:true,sessions:true,refreshFamilies:true,delegation:true,breakGlass:true});});
