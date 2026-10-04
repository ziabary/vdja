import type {intfJobPort} from '../../jobs/src/index.js';
import {enuAuthorityDecision} from '../../authority/src/index.js';
import {randomUUID} from 'node:crypto';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfTransactionHandle,intfTransactionPort} from '../../contracts/src/transaction.js';
import type {intfExecutionSubjectPort} from '../../contracts/src/execution-subject.js';
import type {clsAuthorityService} from '../../authority/src/service.js';
export enum enuRetentionJob {Purge='governance.document.purge.v1'}
export enum enuRetentionState {Retired='RETIRED',Eligible='RETENTION_ELIGIBLE',Held='LEGAL_HOLD',Requested='PURGE_REQUESTED',Purging='PURGING',Purged='PURGED'}
export interface intfRetentionRecord {readonly resourceId:string;readonly requestId:string;readonly state:enuRetentionState;readonly policyVersion:string;readonly eligibleAfter:string;readonly backupObligation:string;readonly leaseToken:string|null;readonly leaseUntil:string|null}
export interface intfRetentionRepository {
 register(tx:intfTransactionHandle,ctx:intfExecutionContext,value:intfRetentionRecord):Promise<void>;
 lock(tx:intfTransactionHandle,ctx:intfExecutionContext,resourceId:string):Promise<intfRetentionRecord|null>;
 save(tx:intfTransactionHandle,ctx:intfExecutionContext,value:intfRetentionRecord):Promise<void>;
}
export interface intfPurgeFacts {readonly retired:boolean;readonly classification:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';readonly retainedReferences:boolean;readonly activeMaterializations:boolean}
export interface intfPurgePermit {readonly permitId:string}
const PURGE_PERMITS=new WeakMap<intfPurgePermit,Readonly<{context:intfExecutionContext;record:intfRetentionRecord}>>();
export function resolvePurgePermit(permit:intfPurgePermit,context:intfExecutionContext):intfRetentionRecord{
 const approved=PURGE_PERMITS.get(permit),until=Date.parse(approved?.record.leaseUntil??'');if(!approved||!Number.isFinite(until)||approved.context.deploymentId!==context.deploymentId||approved.context.tenantId!==context.tenantId||approved.context.actorId!==context.actorId||until<=Date.now())throw new exRetention('RETENTION_DENIED');return approved.record;
}
export interface intfRetentionPorts {
 readonly jobs:intfJobPort;readonly transactions:intfTransactionPort;readonly repository:intfRetentionRepository;readonly subject:intfExecutionSubjectPort;readonly authority:clsAuthorityService;
 readonly facts:(tx:intfTransactionHandle,context:intfExecutionContext,id:string)=>Promise<intfPurgeFacts>;
 /** Owners implement idempotent deletion; incomplete/unknown coverage must reject, never mark PURGED. */
 readonly purge:(context:intfExecutionContext,record:intfRetentionRecord,permit:intfPurgePermit)=>Promise<void>;
 readonly audit:(tx:intfTransactionHandle,context:intfExecutionContext,record:intfRetentionRecord)=>Promise<void>;
 readonly now:()=>Date;readonly leaseMs:number;
}
export class exRetention extends Error {constructor(readonly code:'RETENTION_DENIED'|'RETENTION_NOT_ELIGIBLE'|'LEGAL_HOLD'|'PURGE_IN_PROGRESS'|'PURGE_LEASE_LOST'){super(code);}}
/** Governance owns eligibility/hold/lifecycle. Authority owns permission; owners remove their own data. */
export class clsRetentionService {
 constructor(private readonly ports:intfRetentionPorts){if(!Number.isSafeInteger(ports.leaseMs)||ports.leaseMs<1000||ports.leaseMs>300000)throw new exRetention('RETENTION_DENIED');}
 private async authorize(tx:intfTransactionHandle,ctx:intfExecutionContext,id:string,operation:'manage'|'hold'|'purge'):Promise<intfPurgeFacts>{
  await this.ports.authority.lockSnapshot(tx,ctx);await this.ports.subject.assertActive(ctx);const facts=await this.ports.facts(tx,ctx,id);
  const result=await this.ports.authority.authorize({context:{...ctx,moduleId:'data-governance'},path:'Governance.Documents.'+operation,resource:{type:'document',id,tenantId:ctx.tenantId,classification:facts.classification}});
  if(result.decision!==enuAuthorityDecision.Permit)throw new exRetention('RETENTION_DENIED');return facts;
 }
 async register(ctx:intfExecutionContext,value:intfRetentionRecord):Promise<void>{
  if(value.state!==enuRetentionState.Retired||value.leaseToken||value.leaseUntil||!value.policyVersion||!value.backupObligation||!Number.isFinite(Date.parse(value.eligibleAfter)))throw new exRetention('RETENTION_DENIED');
  await this.ports.transactions.run(ctx,async tx=>{const facts=await this.authorize(tx,ctx,value.resourceId,'manage');if(!facts.retired)throw new exRetention('RETENTION_NOT_ELIGIBLE');await this.ports.repository.register(tx,ctx,value);await this.ports.audit(tx,ctx,value);});
 }
 async hold(ctx:intfExecutionContext,id:string,enabled:boolean):Promise<void>{
  await this.ports.transactions.run(ctx,async tx=>{await this.authorize(tx,ctx,id,'hold');const value=await this.ports.repository.lock(tx,ctx,id);if(!value)throw new exRetention('RETENTION_DENIED');
   // Hold approval linearizes before PURGING. A late hold never claims erased data is held.
   if(value.state===enuRetentionState.Purging||value.state===enuRetentionState.Purged)throw new exRetention('PURGE_IN_PROGRESS');
   const next={...value,requestId:enabled?value.requestId:randomUUID(),state:enabled?enuRetentionState.Held:enuRetentionState.Retired};await this.ports.repository.save(tx,ctx,next);await this.ports.audit(tx,ctx,next);
  });
 }
 async request(ctx:intfExecutionContext,id:string):Promise<void>{
  await this.ports.transactions.run(ctx,async tx=>{const facts=await this.authorize(tx,ctx,id,'purge'),value=await this.ports.repository.lock(tx,ctx,id);
   if(value?.state===enuRetentionState.Held)throw new exRetention('LEGAL_HOLD');
   if(!value||!facts.retired||facts.retainedReferences||facts.activeMaterializations||Date.parse(value.eligibleAfter)>this.ports.now().getTime())throw new exRetention('RETENTION_NOT_ELIGIBLE');
   if(value.state===enuRetentionState.Purged||value.state===enuRetentionState.Requested)return;if(value.state===enuRetentionState.Purging)throw new exRetention('PURGE_IN_PROGRESS');
   const eligible={...value,state:enuRetentionState.Eligible};await this.ports.repository.save(tx,ctx,eligible);await this.ports.audit(tx,ctx,eligible);
   const next={...value,state:enuRetentionState.Requested};await this.ports.repository.save(tx,ctx,next);await this.ports.audit(tx,ctx,next);
   await this.ports.jobs.schedule(tx,{id:randomUUID(),kind:enuRetentionJob.Purge,idempotencyKey:`${next.requestId}:${next.resourceId}:${next.policyVersion}`,payloadVersion:1,payload:{resourceId:id,requestId:next.requestId},subject:ctx,maxAttempts:3});
  });
 }
 async execute(ctx:intfExecutionContext,id:string,leaseToken:string,fence?:(tx:intfTransactionHandle)=>Promise<void>,expectedRequestId?:string):Promise<void>{
  const claimed=await this.ports.transactions.run(ctx,async tx=>{await fence?.(tx);const facts=await this.authorize(tx,ctx,id,'purge'),value=await this.ports.repository.lock(tx,ctx,id);
   if(value?.state===enuRetentionState.Held)throw new exRetention('LEGAL_HOLD');
   if(!value||!facts.retired||facts.retainedReferences||facts.activeMaterializations)throw new exRetention('RETENTION_NOT_ELIGIBLE');if(expectedRequestId&&expectedRequestId!==value.requestId)throw new exRetention('RETENTION_DENIED');if(value.state===enuRetentionState.Purged)return null;
   if(value.state!==enuRetentionState.Requested&&(value.state!==enuRetentionState.Purging||Date.parse(value.leaseUntil??'')>this.ports.now().getTime()))throw new exRetention('PURGE_IN_PROGRESS');
   const next={...value,state:enuRetentionState.Purging,leaseToken,leaseUntil:new Date(this.ports.now().getTime()+this.ports.leaseMs).toISOString()};await this.ports.repository.save(tx,ctx,next);await this.ports.audit(tx,ctx,next);return next;
  });if(!claimed)return;
  const permit=Object.freeze({permitId:randomUUID()});PURGE_PERMITS.set(permit,{context:ctx,record:claimed});
  try{await this.ports.purge(ctx,claimed,permit);}finally{PURGE_PERMITS.delete(permit);}
  await this.ports.transactions.run(ctx,async tx=>{await fence?.(tx);const value=await this.ports.repository.lock(tx,ctx,id);if(value?.leaseToken!==leaseToken||value.state!==enuRetentionState.Purging||Date.parse(value.leaseUntil??'')<=this.ports.now().getTime())throw new exRetention('PURGE_LEASE_LOST');const next={...value,state:enuRetentionState.Purged,leaseToken:null,leaseUntil:null};await this.ports.repository.save(tx,ctx,next);await this.ports.audit(tx,ctx,next);});
 }
}
