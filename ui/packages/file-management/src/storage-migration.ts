import {createHash} from 'node:crypto';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfTransactionHandle,intfTransactionPort} from '../../contracts/src/transaction.js';
import type {clsDocumentService} from '../../documents/src/service.js';
import {enuDocumentOperation} from '../../documents/src/index.js';
import type {intfSemanticAuditPort} from '../../audit/src/semantic.js';
import {enuStorageOutcome,type intfStoragePort,type intfStorageDescriptor,type intfStoragePart} from '../../storage/src/index.js';

export interface intfStorageMigrationIntent {readonly id:string;readonly documentId:string;readonly versionId:string;
  readonly assetId:string;readonly destinationBinding:string;readonly descriptor:intfStorageDescriptor}
export enum enuStorageMigrationState {New='NEW',Copying='COPYING',Completing='COMPLETING',Unknown='UNKNOWN',Verified='VERIFIED'}
export type typStorageMigrationState=enuStorageMigrationState;
export interface intfStorageMigrationClaim {readonly lease:string;readonly remoteUploadId:string|null;readonly state:typStorageMigrationState}
export interface intfStorageMigrationJournal {
  claim(tx:intfTransactionHandle,context:intfExecutionContext,intent:intfStorageMigrationIntent):Promise<intfStorageMigrationClaim>;
  save(tx:intfTransactionHandle,context:intfExecutionContext,id:string,lease:string,remoteUploadId:string|null,
    state:typStorageMigrationState,release:boolean):Promise<void>;
}
export interface intfStorageMigrationPorts {
  readonly transactions:intfTransactionPort;readonly documents:clsDocumentService;readonly audit:intfSemanticAuditPort;
  readonly journal:intfStorageMigrationJournal;readonly source:intfStoragePort;readonly destination:intfStoragePort;
  readonly sourceProfileId:string;readonly destinationBinding:string;
  /** Canonical Authority and Data Governance approval for the exact destination and Asset facts. */
  approve(context:intfExecutionContext,intent:intfStorageMigrationIntent):Promise<boolean>;
}
export class exStorageMigration extends Error {constructor(readonly code:'STORAGE_MIGRATION_DENIED'|'STORAGE_MIGRATION_BUSY'
  |'STORAGE_MIGRATION_CONFLICT'|'STORAGE_MIGRATION_INTEGRITY'|'STORAGE_MIGRATION_LEASE_LOST'){super(code);}}
const PART_BYTES=5*1024*1024;
/** Copies immutable bytes to the same opaque key; it never changes Document/Version/Asset identity or configuration. */
export class clsStorageMigration {
  constructor(private readonly ports:intfStorageMigrationPorts){}
  private async verify(storage:intfStoragePort,expected:intfStorageDescriptor):Promise<boolean>{
    const observed=await storage.inspect(expected.key);if(!observed)return false;
    if(observed.bytes!==expected.bytes||observed.sha256!==expected.sha256||observed.mediaType!==expected.mediaType)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');
    const hash=createHash('sha256');let bytes=0;const stream=await storage.open(expected.key);
    try{for await(const chunk of stream){bytes+=chunk.length;if(bytes>expected.bytes)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');hash.update(chunk);}}
    finally{stream.destroy();}
    if(bytes!==expected.bytes||hash.digest('hex')!==expected.sha256)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');return true;
  }
  async copy(context:intfExecutionContext,documentId:string,versionId:string):Promise<enuStorageMigrationState.Verified|enuStorageMigrationState.Unknown>{
    const asset=await this.ports.documents.asset(context,documentId,versionId,enuDocumentOperation.Manage);
    if(asset.storageProfile!==this.ports.sourceProfileId||!this.ports.destinationBinding||this.ports.destinationBinding.length>128)throw new exStorageMigration('STORAGE_MIGRATION_CONFLICT');
    const digest=createHash('sha256').update(JSON.stringify([context.deploymentId,context.tenantId,asset.id,this.ports.destinationBinding])).digest('hex');
    const id=`${digest.slice(0,8)}-${digest.slice(8,12)}-8${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
    const intent:intfStorageMigrationIntent={id,documentId,versionId,assetId:asset.id,destinationBinding:this.ports.destinationBinding,
      descriptor:{key:asset.storageKey,bytes:asset.bytes,sha256:asset.sha256,mediaType:asset.mediaType}};
    if(!await this.ports.approve(context,intent))throw new exStorageMigration('STORAGE_MIGRATION_DENIED');
    const claim=await this.ports.transactions.run(context,tx=>this.ports.journal.claim(tx,context,intent));
    let remote=claim.remoteUploadId;
    const save=async(state:typStorageMigrationState,release=false)=>this.ports.transactions.run(context,async tx=>{
      await this.ports.journal.save(tx,context,id,claim.lease,remote,state,release);
      if(release)await this.ports.audit.record(tx,context,{action:'file.storage.migration',result:state===enuStorageMigrationState.Verified?'SUCCEEDED':'FAILED',
        ...(state===enuStorageMigrationState.Verified?{}:{reason:'STORAGE_MIGRATION_UNKNOWN'}),resource:{type:'asset',id:asset.id}});
    });
    try{
      await this.ports.source.ready();await this.ports.destination.ready();
      if(await this.verify(this.ports.destination,intent.descriptor)){await save(enuStorageMigrationState.Verified,true);return enuStorageMigrationState.Verified;}
      if(claim.state===enuStorageMigrationState.Verified)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');
      if(claim.state===enuStorageMigrationState.Unknown||claim.state===enuStorageMigrationState.Completing){await save(enuStorageMigrationState.Unknown,true);return enuStorageMigrationState.Unknown;}
      // Discover an ambiguous initiation before considering any new remote mutation.
      if(!remote)remote=await this.ports.destination.reconcileBegin(asset.storageKey,id);
      if(!remote&&claim.state!=='NEW'){await save(enuStorageMigrationState.Unknown,true);return enuStorageMigrationState.Unknown;}
      if(!remote){await save(enuStorageMigrationState.Copying);const begun=await this.ports.destination.begin(intent.descriptor,id);
        if(begun.kind!==enuStorageOutcome.Success||!begun.uploadId){await save(enuStorageMigrationState.Unknown,true);return enuStorageMigrationState.Unknown;}remote=begun.uploadId;}
      await save(enuStorageMigrationState.Copying);const signal=AbortSignal.timeout(90000),parts:intfStoragePart[]=[],hash=createHash('sha256');let bytes=0,number=1,buffer=Buffer.alloc(0);
      const send=async(chunk:Buffer)=>{await save(enuStorageMigrationState.Copying);parts.push(await this.ports.destination.writePart(asset.storageKey,remote!,{
        number:number++,bytes:chunk.length,sha256:createHash('sha256').update(chunk).digest('hex'),etag:''},chunk,signal));};
      const stream=await this.ports.source.open(asset.storageKey,signal);
      try{for await(const chunk of stream){bytes+=chunk.length;if(bytes>asset.bytes||chunk.length>16*1024*1024)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');
        hash.update(chunk);buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=PART_BYTES){await send(buffer.subarray(0,PART_BYTES));buffer=buffer.subarray(PART_BYTES);}}}
      finally{stream.destroy();}
      if(bytes!==asset.bytes||hash.digest('hex')!==asset.sha256)throw new exStorageMigration('STORAGE_MIGRATION_INTEGRITY');
      if(buffer.length)await send(buffer);await save(enuStorageMigrationState.Completing);
      await this.ports.destination.complete(intent.descriptor,remote,parts);
      // Full destination-byte proof resolves a lost completion ACK without a second completion.
      if(!await this.verify(this.ports.destination,intent.descriptor)){await save(enuStorageMigrationState.Unknown,true);return enuStorageMigrationState.Unknown;}
      await this.ports.documents.asset(context,documentId,versionId,enuDocumentOperation.Manage);
      await save(enuStorageMigrationState.Verified,true);return enuStorageMigrationState.Verified;
    }catch(error){try{await save(enuStorageMigrationState.Unknown,true);}catch{/* an expired fence cannot publish */}throw error;}
  }
}
