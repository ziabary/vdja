import {createHash} from 'node:crypto';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {typClassificationLevel} from '../../authority/src/index.js';
import type {clsDocumentService} from '../../documents/src/service.js';
import type {clsFileManagement} from '../../file-management/src/service.js';
import {enuTransferState} from '../../file-management/src/index.js';
import {enuMembershipMode} from './index.js';
import type {clsKnowledgeService} from './service.js';
import {deterministicIdentifier} from './chunking.js';

export enum enuLegacyMigrationError { Invalid='LEGACY_MIGRATION_INVALID', AmbiguousOwner='LEGACY_OWNER_AMBIGUOUS',
  MissingOwner='LEGACY_OWNER_MISSING', DerivedSource='LEGACY_DERIVED_SOURCE', Integrity='LEGACY_SOURCE_INTEGRITY',
  Context='LEGACY_MIGRATION_CONTEXT', Approval='LEGACY_MIGRATION_NOT_APPROVED', Unresolved='LEGACY_MIGRATION_UNRESOLVED' }
export enum enuLegacySourceKind {OriginalAsset='ORIGINAL_ASSET'}
export enum enuLegacyRecordState {Active='Active',Removed='Removed'}
export class exLegacyMigration extends Error {constructor(readonly code:enuLegacyMigrationError){super(code);}}
export interface intfLegacyOwnerMapping {readonly service:string;readonly legacyUserId:string;readonly deploymentId:string;
  readonly tenantId:string;readonly actorId:string;readonly spaceId:string;readonly spaceTitle:string;readonly classification:typClassificationLevel}
export interface intfLegacyDocumentRecord {readonly service:string;readonly fileId:string;readonly legacyUserId:string;
  readonly filename:string;readonly bytes:number;readonly sha256:string;readonly mediaType:string;
  readonly sourceKind:enuLegacySourceKind;readonly sourceRef:string;readonly state:enuLegacyRecordState}
export interface intfLegacyMigrationItem {readonly source:intfLegacyDocumentRecord;readonly owner:intfLegacyOwnerMapping;
  readonly documentId:string;readonly sourceIdentity:string;readonly transferIdentity:string}
export interface intfLegacyMigrationPlan {readonly sourceSystem:string;readonly digest:string;
  readonly records:readonly intfLegacyDocumentRecord[];readonly mappings:readonly intfLegacyOwnerMapping[];
  readonly items:readonly intfLegacyMigrationItem[];readonly excluded:readonly Readonly<{sourceIdentity:string;reason:'REMOVED'}>[]}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
function text(value:unknown,max=128):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);}
function dictionary(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);return value as Record<string,unknown>;}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):void{if(Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);}
function owner(value:unknown):intfLegacyOwnerMapping{
  const row=dictionary(value);exactKeys(row,['service','legacyUserId','deploymentId','tenantId','actorId','spaceId','spaceTitle','classification']);
  for(const field of ['service','legacyUserId','deploymentId','tenantId','actorId'] as const)if(!text(row[field]))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
  if(!text(row.spaceId)||!UUID.test(row.spaceId)||!text(row.spaceTitle,256)||!['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(row.classification)))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
  return{service:String(row.service),legacyUserId:String(row.legacyUserId),deploymentId:String(row.deploymentId),tenantId:String(row.tenantId),
    actorId:String(row.actorId),spaceId:row.spaceId,spaceTitle:row.spaceTitle,classification:row.classification as typClassificationLevel};
}
function record(value:unknown):intfLegacyDocumentRecord{
  const row=dictionary(value);if(row.sourceKind!==enuLegacySourceKind.OriginalAsset)throw new exLegacyMigration(enuLegacyMigrationError.DerivedSource);
  exactKeys(row,['service','fileId','legacyUserId','filename','bytes','sha256','mediaType','sourceKind','sourceRef','state']);
  for(const field of ['service','fileId','legacyUserId','sourceRef']as const)if(!text(row[field]))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
  if(!text(row.filename,256)||/[\\/]/u.test(row.filename)||!Number.isSafeInteger(row.bytes)||Number(row.bytes)<1
    ||!text(row.sha256)||!/^[a-f0-9]{64}$/u.test(row.sha256)||!text(row.mediaType)||!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(row.mediaType)
    ||!['Active','Removed'].includes(String(row.state)))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
  return{service:String(row.service),fileId:String(row.fileId),legacyUserId:String(row.legacyUserId),sourceRef:String(row.sourceRef),filename:row.filename,
    bytes:Number(row.bytes),sha256:row.sha256,mediaType:row.mediaType,sourceKind:enuLegacySourceKind.OriginalAsset,state:row.state as enuLegacyRecordState};
}
/** No legacy privileges, user collection names, Qdrant payloads or guessed tenants enter this plan. */
export function planLegacyRagMigration(sourceSystem:string,records:unknown,mappings:unknown):intfLegacyMigrationPlan{
  if(!/^[A-Za-z0-9._-]{1,64}$/u.test(sourceSystem)||!Array.isArray(records)||!Array.isArray(mappings)||records.length>10000||mappings.length>10000)throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
  const owners=new Map<string,intfLegacyOwnerMapping>(),spaces=new Map<string,string>();
  for(const value of mappings){const mapped=owner(value),key=JSON.stringify([mapped.service,mapped.legacyUserId]);
    if(owners.has(key))throw new exLegacyMigration(enuLegacyMigrationError.AmbiguousOwner);owners.set(key,mapped);
    const spaceKey=JSON.stringify([mapped.deploymentId,mapped.tenantId,mapped.spaceId]),identity=JSON.stringify([mapped.actorId,mapped.spaceTitle,mapped.classification]);
    if(spaces.has(spaceKey)&&spaces.get(spaceKey)!==identity)throw new exLegacyMigration(enuLegacyMigrationError.AmbiguousOwner);spaces.set(spaceKey,identity);
  }
  const items:intfLegacyMigrationItem[]=[],excluded:{sourceIdentity:string;reason:'REMOVED'}[]=[],seen=new Set<string>(),normalizedRecords:intfLegacyDocumentRecord[]=[];
  for(const value of records){const source=record(value),sourceIdentity=createHash('sha256').update(JSON.stringify([sourceSystem,source.service,source.fileId])).digest('hex');
    normalizedRecords.push(source);
    if(seen.has(sourceIdentity))throw new exLegacyMigration(enuLegacyMigrationError.Invalid);seen.add(sourceIdentity);
    const mapped=owners.get(JSON.stringify([source.service,source.legacyUserId]));if(!mapped)throw new exLegacyMigration(enuLegacyMigrationError.MissingOwner);
    if(source.state===enuLegacyRecordState.Removed){excluded.push({sourceIdentity,reason:'REMOVED'});continue;}
    items.push({source,owner:mapped,sourceIdentity,documentId:deterministicIdentifier([mapped.deploymentId,mapped.tenantId,sourceIdentity]),transferIdentity:`legacy:${sourceIdentity}`});
  }
  items.sort((a,b)=>a.sourceIdentity.localeCompare(b.sourceIdentity));excluded.sort((a,b)=>a.sourceIdentity.localeCompare(b.sourceIdentity));
  normalizedRecords.sort((a,b)=>JSON.stringify([a.service,a.fileId]).localeCompare(JSON.stringify([b.service,b.fileId])));
  const normalizedMappings=[...owners.values()].sort((a,b)=>JSON.stringify([a.service,a.legacyUserId]).localeCompare(JSON.stringify([b.service,b.legacyUserId])));
  const digest=createHash('sha256').update(JSON.stringify([sourceSystem,normalizedRecords,normalizedMappings])).digest('hex');
  return{sourceSystem,digest,records:normalizedRecords,mappings:normalizedMappings,items,excluded};
}
export interface intfLegacyMigrationPorts {
  readonly documents:clsDocumentService;readonly files:clsFileManagement;readonly knowledge:clsKnowledgeService;
  /** Approval binds the exact digest, source system, ownership and egress destination. */
  approve(plan:intfLegacyMigrationPlan):Promise<boolean>;
  /** Obtain a verified initiating session/service context; do not synthesize impersonation. */
  contextFor(owner:intfLegacyOwnerMapping):Promise<intfExecutionContext>;
  openOriginal(sourceRef:string):Promise<AsyncIterable<Uint8Array>>;
}
export interface intfLegacyMigrationResult {readonly sourceIdentity:string;readonly documentId:string;readonly versionId:string;readonly spaceId:string}
export class clsLegacyRagMigration {
  constructor(private readonly ports:intfLegacyMigrationPorts){}
  async execute(plan:intfLegacyMigrationPlan):Promise<readonly intfLegacyMigrationResult[]>{
    // Revalidate externally deserialized plans and bind the complete manifest, not a caller's digest string.
    const verified=planLegacyRagMigration(plan.sourceSystem,plan.records,plan.mappings);
    if(verified.digest!==plan.digest)throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
    if(!await this.ports.approve(verified))throw new exLegacyMigration(enuLegacyMigrationError.Approval);
    const output:intfLegacyMigrationResult[]=[];
    for(const item of verified.items){const context=await this.ports.contextFor(item.owner);
      if(context.actorId!==item.owner.actorId||context.tenantId!==item.owner.tenantId||context.deploymentId!==item.owner.deploymentId)throw new exLegacyMigration(enuLegacyMigrationError.Context);
      await this.ports.documents.create(context,{id:item.documentId,title:item.source.filename,classification:item.owner.classification,sourceIdentity:item.sourceIdentity});
      const transfer=await this.ports.files.initiate(context,{documentId:item.documentId,idempotencyKey:item.transferIdentity,
        filename:item.source.filename,bytes:item.source.bytes,sha256:item.source.sha256,mediaType:item.source.mediaType});
      let versionId=transfer.versionId;
      if(!Number.isSafeInteger(transfer.partBytes)||transfer.partBytes<1||transfer.partBytes>16*1024*1024)throw new exLegacyMigration(enuLegacyMigrationError.Invalid);
      if(transfer.state!==enuTransferState.Committed){
        if(![enuTransferState.Initiated,enuTransferState.Uploading,enuTransferState.Uploaded].includes(transfer.state))throw new exLegacyMigration(enuLegacyMigrationError.Unresolved);
        const source=await this.ports.openOriginal(item.source.sourceRef),hash=createHash('sha256');let bytes=0,number=1,buffer=Buffer.alloc(0);
        const send=async(part:Buffer)=>{if(!transfer.acceptedParts.includes(number))await this.ports.files.uploadPart(context,transfer.id,number,createHash('sha256').update(part).digest('hex'),part);number+=1;};
        for await(const chunk of source){bytes+=chunk.byteLength;if(bytes>item.source.bytes||chunk.byteLength>16*1024*1024)throw new exLegacyMigration(enuLegacyMigrationError.Integrity);
          hash.update(chunk);buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=transfer.partBytes){await send(buffer.subarray(0,transfer.partBytes));buffer=buffer.subarray(transfer.partBytes);}}
        if(bytes!==item.source.bytes||hash.digest('hex')!==item.source.sha256)throw new exLegacyMigration(enuLegacyMigrationError.Integrity);
        if(buffer.length)await send(buffer);
        const completed=await this.ports.files.complete(context,transfer.id);if(!('processingState'in completed))throw new exLegacyMigration(enuLegacyMigrationError.Unresolved);versionId=completed.id;
      }
      if(!versionId)throw new exLegacyMigration(enuLegacyMigrationError.Unresolved);
      await this.ports.knowledge.createSpace(context,{id:item.owner.spaceId,title:item.owner.spaceTitle,classification:item.owner.classification});
      await this.ports.knowledge.addMembership(context,{spaceId:item.owner.spaceId,documentId:item.documentId,mode:enuMembershipMode.Current,pinnedVersionId:null});
      output.push({sourceIdentity:item.sourceIdentity,documentId:item.documentId,versionId,spaceId:item.owner.spaceId});
    }return output;
  }
}
