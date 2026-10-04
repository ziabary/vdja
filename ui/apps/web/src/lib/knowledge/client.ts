import type {intfCursorPage} from '@targoman/contracts';
import type {intfKnowledgeDocumentView,intfKnowledgeVersionView,intfKnowledgeSpaceView,intfKnowledgeSpaceStatus,intfManagedTransferView,intfKnowledgeAnswerView,intfKnowledgeCitationView} from '@targoman/contracts/knowledge';
import {createUiApiClient,type intfTransportRequest} from '#lib/api/client.js';
import {createFetchTransport,publicToolFetcher,browserFetcher,downloadProtectedFile,postKnowledgeQuestion} from '#lib/api/transport.js';
import {consumeSseFrames,DEFAULT_STREAM_LIMITS,exStreamProtocol} from '#lib/streaming/parser.js';
import {enuKnowledgeStreamEvent,enuKnowledgeStreamState} from '@targoman/contracts/knowledge';
import type {intfAuthClient} from '#lib/auth/client.svelte.js';
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_RESPONSE');return value as Record<string,unknown>;}
function text(value:unknown,maximum=1000000):string{if(typeof value!=='string'||value.length>maximum)throw new Error('INVALID_RESPONSE');return value;}
function id(value:unknown):string{const result=text(value,36);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(result))throw new Error('INVALID_RESPONSE');return result;}
function nullable(value:unknown):string|null{return value===null?null:id(value);}
function number(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('INVALID_RESPONSE');return Number(value);}
function boolean(value:unknown):boolean{if(typeof value!=='boolean')throw new Error('INVALID_RESPONSE');return value;}
function items(value:unknown):readonly unknown[]{if(!Array.isArray(value)||value.length>1000)throw new Error('INVALID_RESPONSE');return value;}
function document(value:unknown):intfKnowledgeDocumentView{const row=object(value);return{id:id(row.id),title:text(row.title,256),currentVersionId:nullable(row.currentVersionId),lifecycle:text(row.lifecycle,32)};}
function version(value:unknown):intfKnowledgeVersionView{const row=object(value);return{id:id(row.id),sequence:number(row.sequence),processingState:text(row.processingState,32)};}
function transfer(value:unknown):intfManagedTransferView{const row=object(value);return{id:id(row.id),documentId:id(row.documentId),state:text(row.state,32),partBytes:number(row.partBytes),acceptedParts:items(row.acceptedParts).map(number),expiresAt:text(row.expiresAt,64),versionId:nullable(row.versionId),errorClass:row.errorClass===null?null:text(row.errorClass,64)};}
function space(value:unknown):intfKnowledgeSpaceView{const row=object(value);return{id:id(row.id),title:text(row.title,256),generationId:nullable(row.generationId)};}
function page<T>(value:unknown,parse:(value:unknown)=>T):intfCursorPage<T>{const row=object(value);return{items:items(row.items).map(parse),hasMore:boolean(row.hasMore),nextCursor:nullable(row.nextCursor)};}
function citation(value:unknown):intfKnowledgeCitationView{const row=object(value);return{label:text(row.label,32),documentId:id(row.documentId),versionId:id(row.versionId),chunkId:id(row.chunkId),start:number(row.start),end:number(row.end),mayRead:boolean(row.mayRead),mayQuote:boolean(row.mayQuote)};}
export async function fileDigest(bytes:ArrayBuffer):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');}
export function createKnowledgeClient(auth:intfAuthClient,fetcher:typeof fetch=browserFetcher()){
  const authenticated=publicToolFetcher(fetcher,()=>auth.state),api=createUiApiClient(createFetchTransport(authenticated));
  const request=<T>(input:Omit<intfTransportRequest,'path'> & {readonly path:string},parse:(value:unknown)=>T)=>api.request({...input,path:`/knowledge${input.path}`},parse);
  return{
    documents:(cursor:string|null,signal?:AbortSignal)=>request({method:'GET',path:`/documents${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`,signal},value=>page(value,document)),
    createDocument:(title:string,classification:string,signal?:AbortSignal)=>request({method:'POST',path:'/documents',body:{id:crypto.randomUUID(),title,classification},signal},document),
    versions:(documentId:string,signal?:AbortSignal)=>request({method:'GET',path:`/documents/${id(documentId)}/versions`,signal},value=>items(object(value).items).map(version)),
    operations:(documentId:string,signal?:AbortSignal)=>request({method:'GET',path:`/documents/${id(documentId)}/operations`,signal},value=>{const row=object(value);return{discover:boolean(row.discover),read:boolean(row.read),download:boolean(row.download),use:boolean(row.use),quote:boolean(row.quote),manage:boolean(row.manage)};}),
    spaces:(cursor:string|null,signal?:AbortSignal)=>request({method:'GET',path:`/spaces${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`,signal},value=>page(value,space)),
    createSpace:(title:string,classification:string,signal?:AbortSignal)=>request({method:'POST',path:'/spaces',body:{id:crypto.randomUUID(),title,classification},signal},value=>id(object(value).id)),
    spaceStatus:(spaceId:string,signal?:AbortSignal)=>request({method:'GET',path:`/spaces/${id(spaceId)}`,signal},value=>{const row=object(value);return{id:id(row.id),title:text(row.title,256),state:text(row.state,32),memberships:items(row.memberships).map(value=>{const member=object(value);return{documentId:id(member.documentId),mode:text(member.mode,32),pinnedVersionId:nullable(member.pinnedVersionId)};})} satisfies intfKnowledgeSpaceStatus;}),
    addDocument:(spaceId:string,documentId:string,pinnedVersionId:string|null,signal?:AbortSignal)=>request({method:'PUT',path:`/spaces/${id(spaceId)}/memberships/${id(documentId)}`,body:{mode:pinnedVersionId?'PINNED':'CURRENT',pinnedVersionId},signal},()=>undefined),
    rebuild:(spaceId:string,signal?:AbortSignal)=>request({method:'POST',path:`/spaces/${id(spaceId)}/rebuild`,signal},()=>undefined),
    transferStatus:(transferId:string,signal?:AbortSignal)=>request({method:'GET',path:`/transfers/${id(transferId)}`,signal},transfer),
    async upload(documentId:string,file:File,maximumBytes:number,resumeId:string|null,onProgress:(percent:number,value:intfManagedTransferView)=>void,signal?:AbortSignal){
      if(file.size<1||file.size>maximumBytes)throw new Error('FILE_TOO_LARGE');
      const digest=await fileDigest(await file.arrayBuffer());
      let state=resumeId?await this.transferStatus(resumeId,signal):await request({method:'POST',path:'/transfers',body:{documentId:id(documentId),filename:file.name,mediaType:file.type||'application/octet-stream',bytes:file.size,sha256:digest,idempotencyKey:crypto.randomUUID()},signal},transfer);
      if(state.documentId!==documentId||state.partBytes<1)throw new Error('INVALID_RESPONSE');
      for(let offset=0,part=1;offset<file.size;offset+=state.partBytes,part+=1){
        if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
        if(!state.acceptedParts.includes(part)){const bytes=await file.slice(offset,Math.min(file.size,offset+state.partBytes)).arrayBuffer();
          state=await request({method:'PUT',path:`/transfers/${state.id}/parts/${part}`,contentType:'binary',body:bytes,headers:{'x-content-sha256':await fileDigest(bytes)},signal,deadlineMs:120000},transfer);}
        onProgress(Math.min(100,Math.round((offset+state.partBytes)*100/file.size)),state);
      }
      await request({method:'POST',path:`/transfers/${state.id}/complete`,signal,deadlineMs:120000},()=>undefined);
      return this.transferStatus(state.id,signal);
    },
    async ask(spaceId:string,question:string,signal?:AbortSignal,onDelta?:(text:string)=>void):Promise<intfKnowledgeAnswerView>{
      const response=await postKnowledgeQuestion(authenticated,id(spaceId),question,signal);
      if(!response.ok||!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new exStreamProtocol('KNOWLEDGE_REQUEST_FAILED');
      let answer='',citations:readonly intfKnowledgeCitationView[]|null=null,done=false,bytes=0;
      await consumeSseFrames(response.body,frame=>{
        if(done)throw new exStreamProtocol('DATA_AFTER_TERMINAL');
        const row=object(JSON.parse(frame.data) as unknown);
        if(frame.event===enuKnowledgeStreamEvent.Delta){if(citations)throw new exStreamProtocol('INVALID_EVENT_ORDER');const delta=text(row.text,2048);bytes+=new TextEncoder().encode(delta).length;if(bytes>DEFAULT_STREAM_LIMITS.maxOutputBytes)throw new exStreamProtocol('OUTPUT_LIMIT');answer+=delta;onDelta?.(answer);}
        else if(frame.event===enuKnowledgeStreamEvent.Citations){if(citations)throw new exStreamProtocol('DUPLICATE_CITATIONS');citations=items(row.citations).map(citation);}
        else if(frame.event===enuKnowledgeStreamEvent.Done){if(!citations||row.status!==enuKnowledgeStreamState.Succeeded)throw new exStreamProtocol('INVALID_DONE');done=true;}
        else throw new exStreamProtocol('INVALID_EVENT');
      },DEFAULT_STREAM_LIMITS,signal);
      if(!done||!citations)throw new exStreamProtocol('INTERRUPTED');return{answer,citations};
    },
    read:(documentId:string,versionId:string,signal?:AbortSignal)=>request({method:'GET',path:`/documents/${id(documentId)}/versions/${id(versionId)}/content`,signal},value=>text(object(value).text)),
    download:(documentId:string,versionId:string,maximumBytes:number,signal?:AbortSignal)=>downloadProtectedFile(authenticated,`/api/knowledge/documents/${id(documentId)}/versions/${id(versionId)}/download`,maximumBytes,signal)
  };
}
