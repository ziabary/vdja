import { randomUUID,createHash } from 'node:crypto';
import { resolveSecretRef } from '../../configuration/src/index.js';
import type { intfExecutionSubjectPort } from '../../contracts/src/execution-subject.js';
import { enuProtectedAiTask, type intfProtectedAiConfiguration, type intfProtectedAiPort,
  type intfProtectedAiRequest,type intfProtectedAiResult,type intfProtectedAiModel,type intfProtectedAiEndpoint,type intfEmbeddingProfile } from '../../contracts/src/protected-ai.js';
import type { intfAiEgressPort } from '../../data-governance/src/index.js';
import { exAiRouter,type intfAiRunStore,type typAiRunRequest,type intfAttemptRecord } from './index.js';
import type { intfUsageRecorder } from '../../usage/src/index.js';
import {logOperational} from '../../observability/src/index.js';
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new exAiRouter('PROVIDER_FAILURE',false,'INVALID_STRUCTURED_OUTPUT');return value as Record<string,unknown>;}
function failure(reason:string):never{throw new exAiRouter('PROVIDER_FAILURE',false,reason);}
function tokens(value:unknown):Readonly<{inputTokens:number;outputTokens:number}>{const usage=object(value);
  const input=usage.prompt_tokens??usage.input_tokens,output=usage.completion_tokens??usage.output_tokens??0;
  if(!Number.isSafeInteger(input)||Number(input)<0||!Number.isSafeInteger(output)||Number(output)<0)failure('INVALID_PROVIDER_USAGE');
  return{inputTokens:Number(input),outputTokens:Number(output)};}
function profile(model:intfProtectedAiModel,maxInputBytes:number):intfEmbeddingProfile{return{
  id:createHash('sha256').update(JSON.stringify([model.id,model.modelId,model.artifactRevision,model.dimensions])).digest('hex'),
  dimensions:model.dimensions,modelId:model.modelId,artifactRevision:model.artifactRevision,maxInputBytes};}
async function readProviderJson(response:Response,maxBytes:number):Promise<Record<string,unknown>>{
  if(!response.body)failure('INVALID_STRUCTURED_OUTPUT');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>maxBytes)failure('PROVIDER_RESPONSE_LIMIT');parts.push(chunk.value);}}
  finally{await reader.cancel();reader.releaseLock();}
  let decoded:unknown;try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)))as unknown;}catch{failure('INVALID_STRUCTURED_OUTPUT');}
  return object(decoded);
}
export interface intfProtectedRouterPorts {
  readonly configuration:()=>Readonly<{value:intfProtectedAiConfiguration;fingerprint:string}>;
  readonly store:intfAiRunStore;readonly governance:intfAiEgressPort;readonly subject:intfExecutionSubjectPort;
  readonly usage:intfUsageRecorder;
  readonly secretRoot?:string;
}
/** Typed protected execution shares durable AI Run/Attempt/capacity infrastructure with public tasks. */
export class clsProtectedAiRouter implements intfProtectedAiPort {
  constructor(private readonly ports:intfProtectedRouterPorts){
    if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new Error('PROTECTED_AI_TLS_VERIFICATION_REQUIRED');
  }
  embeddingProfile():intfEmbeddingProfile{
    const config=this.ports.configuration().value,policy=config.tasks[enuProtectedAiTask.DocumentEmbed];
    const model=config.models.find(value=>value.id===policy.modelProfileId);if(!model)failure('UNKNOWN_MODEL_PROFILE');return profile(model,policy.maxInputBytes);
  }
  /** Metadata-only capability readiness. Model artifacts still require deployment provenance verification. */
  async probeReadiness():Promise<Readonly<{status:'READY'|'UNAVAILABLE';unavailableTasks:readonly enuProtectedAiTask[]}>>{
    const config=this.ports.configuration().value,healthy=new Set<string>();
    await Promise.all(config.endpoints.filter(endpoint=>endpoint.enabled).map(async endpoint=>{
      try{
        const credential=endpoint.credentialRef?await resolveSecretRef(endpoint.credentialRef,this.ports.secretRoot):null;
        const response=await fetch(new URL('/v1/models',endpoint.baseUrl),{redirect:'error',signal:AbortSignal.timeout(Math.min(endpoint.timeoutMs,3000)),
          headers:credential?{Authorization:`Bearer ${credential}`}:{}});
        if(!response.ok){await response.body?.cancel();return;}
        const data=await readProviderJson(response,65536),model=config.models.find(value=>value.id===endpoint.modelProfileId);
        if(model&&Array.isArray(data.data)&&data.data.length<=1000&&data.data.some(value=>object(value).id===model.modelId))healthy.add(endpoint.id);
      }catch{/* Optional protected capabilities degrade without emitting provider payloads. */}
    }));
    const unavailableTasks=Object.values(enuProtectedAiTask).filter(task=>!config.tasks[task].preferredEndpoints.some(id=>healthy.has(id)));
    return{status:unavailableTasks.length?'UNAVAILABLE':'READY',unavailableTasks};
  }
  async execute(request:intfProtectedAiRequest):Promise<intfProtectedAiResult>{
    await this.ports.subject.assertActive(request.context);
    const snapshot=this.ports.configuration(),policy=snapshot.value.tasks[request.task];
    const model=snapshot.value.models.find(value=>value.id===policy?.modelProfileId);
    if(!policy||!model||request.context.moduleId!=='knowledge'||!request.sources.length||request.sources.length>1000)failure('INVALID_PROTECTED_AI_REQUEST');
    const texts=request.texts??[],messages=request.messages??[];
    if(texts.length>256||texts.some(text=>!text.trim())||messages.length>20||messages.some(message=>!['system','user'].includes(message.role)))failure('INVALID_PROTECTED_AI_REQUEST');
    const bytes=texts.reduce((sum,text)=>sum+Buffer.byteLength(text),0)+messages.reduce((sum,message)=>sum+Buffer.byteLength(message.content)+64,0)+Buffer.byteLength(request.query??'');
    const maxOutputTokens=request.maxOutputTokens??model.maxOutputTokens;
    if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<0||maxOutputTokens>model.maxOutputTokens||bytes<1||bytes>policy.maxInputBytes||bytes+maxOutputTokens+512>model.contextTokens)
      failure('CONTEXT_BUDGET_EXCEEDED');
    if((request.task===enuProtectedAiTask.DocumentEmbed||request.task===enuProtectedAiTask.QueryEmbed)&&(!texts.length||messages.length||request.query))failure('INVALID_PROTECTED_AI_REQUEST');
    if(request.task===enuProtectedAiTask.QueryEmbed&&texts.length!==1)failure('INVALID_PROTECTED_AI_REQUEST');
    if(request.task===enuProtectedAiTask.Rerank&&(!texts.length||texts.length>100||!request.query?.trim()||messages.length))failure('INVALID_PROTECTED_AI_REQUEST');
    if(request.task===enuProtectedAiTask.Answer&&(!messages.length||texts.length||request.query||maxOutputTokens<1))failure('INVALID_PROTECTED_AI_REQUEST');
    const runId=randomUUID(),ctx=request.context,started=Date.now();
    const run:typAiRunRequest={task:request.task,moduleId:'knowledge',requestId:ctx.requestId,correlationId:ctx.correlationId,
      deploymentId:ctx.deploymentId,tenantId:ctx.tenantId,actorKind:ctx.actorKind,actorId:ctx.actorId,messages:[],maxOutputTokens,temperature:0};
    Object.assign(run,{sessionId:ctx.sessionId,authorizationVersion:ctx.authorizationVersion,source:ctx.source});
    await this.ports.store.beginRun({runId,request:run,configFingerprint:snapshot.fingerprint});
    let attempts=0,last:Error|undefined;
    for(const id of policy.preferredEndpoints){
      if(attempts>=policy.maxAttempts)break;
      const endpoint=snapshot.value.endpoints.find(value=>value.id===id&&value.enabled&&value.capabilities.includes(request.task)&&value.modelProfileId===model.id);
      if(!endpoint)continue;
      try{await this.ports.subject.assertActive(ctx);await this.ports.governance.assertAllowed(ctx,request.task,endpoint,request.sources);}
      catch(error){last??=error instanceof Error?error:new Error('PROTECTED_EGRESS_DENIED');continue;}
      if(!await this.ports.store.claimEndpointCapacity(runId,run,endpoint.id,endpoint.maxConcurrent,endpoint.timeoutMs+5000))continue;
      attempts+=1;
      const attempt:intfAttemptRecord={attemptId:randomUUID(),runId,sequence:attempts,endpointId:endpoint.id,modelId:model.modelId,status:'RUNNING'};
      let providerCompleted=false;
      try{
        await this.ports.store.beginAttempt(attempt);
        const result=await this.call(endpoint,model,request,maxOutputTokens,policy.maxResponseBytes);
        providerCompleted=true;
        await this.ports.usage.record(ctx,{runId,inputChars:texts.reduce((sum,text)=>sum+text.length,0)
          +messages.reduce((sum,message)=>sum+message.content.length,0)+(request.query?.length??0),uploadedBytes:0,
          inputTokens:result.inputTokens,outputTokens:result.outputTokens,providerMs:Math.max(0,Date.now()-started)});
        await this.ports.store.finishAttempt({...attempt,status:'SUCCEEDED'});
        await this.ports.store.finishRun({runId,status:'SUCCEEDED',endpointId:endpoint.id,modelId:model.modelId,inputTokens:result.inputTokens,outputTokens:result.outputTokens});
        logOperational({severity:'INFO',component:'ai-router',event:'protected_attempt_completed',context:ctx,status:'SUCCEEDED',runId,aiTask:request.task,
          endpointId:endpoint.id,modelId:model.modelId,attemptCount:attempts,inputTokens:result.inputTokens,outputTokens:result.outputTokens,durationMs:Date.now()-started});
        return{...result,profile:profile(model,policy.maxInputBytes),runId,endpointId:endpoint.id,attempts};
      }catch(error){last=request.signal?.aborted?new exAiRouter('CANCELLED',false,'CLIENT_CANCELLED'):
        error instanceof exAiRouter?error:new exAiRouter('PROVIDER_FAILURE',false,'NETWORK_OR_PROVIDER_FAILURE');
        await this.ports.store.finishAttempt({...attempt,status:request.signal?.aborted?'CANCELLED':'FAILED',errorClass:last instanceof exAiRouter?last.safeClass:'NETWORK_OR_PROVIDER_FAILURE'});
        logOperational({severity:'WARN',component:'ai-router',event:'protected_attempt_completed',context:ctx,status:request.signal?.aborted?'CANCELLED':'FAILED',runId,aiTask:request.task,
          endpointId:endpoint.id,modelId:model.modelId,attemptCount:attempts,errorClass:last instanceof exAiRouter?last.safeClass:'NETWORK_OR_PROVIDER_FAILURE',durationMs:Date.now()-started});
        if(request.signal?.aborted||providerCompleted)break;
      }finally{await this.ports.store.releaseEndpointCapacity(runId,run,endpoint.id);}
    }
    await this.ports.store.finishRun({runId,status:request.signal?.aborted?'CANCELLED':'FAILED',errorClass:last instanceof exAiRouter?last.safeClass:last?.message==='PROTECTED_EGRESS_DENIED'?'PROTECTED_EGRESS_DENIED':'NO_ELIGIBLE_ENDPOINT'});
    throw last??new exAiRouter('NO_ELIGIBLE_ENDPOINT',false,'NO_ELIGIBLE_ENDPOINT');
  }
  private async call(endpoint:intfProtectedAiEndpoint,model:intfProtectedAiModel,request:intfProtectedAiRequest,maxOutputTokens:number,maxResponseBytes:number):Promise<Omit<intfProtectedAiResult,'runId'|'profile'|'endpointId'|'attempts'>>{
    const path=request.task===enuProtectedAiTask.Answer?'/v1/chat/completions':request.task===enuProtectedAiTask.Rerank?'/score':'/v1/embeddings';
    const body=request.task===enuProtectedAiTask.Answer?{model:model.modelId,messages:request.messages,stream:false,store:false,max_tokens:maxOutputTokens,temperature:0}
      :request.task===enuProtectedAiTask.Rerank?{model:model.modelId,text_1:request.query,text_2:request.texts}
        :{model:model.modelId,input:request.texts,encoding_format:'float'};
    const credential=endpoint.credentialRef?await resolveSecretRef(endpoint.credentialRef,this.ports.secretRoot):null;
    const signal=request.signal?AbortSignal.any([request.signal,AbortSignal.timeout(endpoint.timeoutMs)]):AbortSignal.timeout(endpoint.timeoutMs);
    signal.throwIfAborted();await this.ports.subject.assertActive(request.context);signal.throwIfAborted();
    const response=await fetch(new URL(path,endpoint.baseUrl),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:JSON.stringify(body),signal});
    if(!response.ok){await response.body?.cancel();failure(response.status>=500?'PROVIDER_5XX':'PROVIDER_REJECTED');}
    const data=await readProviderJson(response,maxResponseBytes);
    if(data.model!==model.modelId)failure('PROVIDER_MODEL_MISMATCH');
    const usage=tokens(data.usage);
    if(request.task===enuProtectedAiTask.Answer){
      if(!Array.isArray(data.choices)||data.choices.length!==1)failure('INVALID_STRUCTURED_OUTPUT');
      const choice=object(data.choices[0]),message=object(choice.message);
      if(choice.finish_reason!=='stop'||typeof message.content!=='string'||!message.content.trim()||message.tool_calls!==undefined)failure('INVALID_STRUCTURED_OUTPUT');
      if(usage.outputTokens>maxOutputTokens||Buffer.byteLength(message.content)>maxOutputTokens*16+1024)failure('PROVIDER_RESPONSE_LIMIT');
      return{...usage,text:message.content};
    }
    if(!Array.isArray(data.data)||data.data.length!==request.texts!.length)failure('INVALID_STRUCTURED_OUTPUT');
    const entries=new Map<number,Record<string,unknown>>();
    for(const value of data.data){const entry=object(value);if(!Number.isInteger(entry.index)||Number(entry.index)<0||Number(entry.index)>=request.texts!.length||entries.has(Number(entry.index)))failure('INVALID_STRUCTURED_OUTPUT');entries.set(Number(entry.index),entry);}
    if(request.task===enuProtectedAiTask.Rerank){
      const scores=request.texts!.map((_,index)=>{const value=entries.get(index)?.score;if(!Number.isFinite(value))failure('INVALID_STRUCTURED_OUTPUT');return Number(value);});return{...usage,scores};
    }
    const vectors=request.texts!.map((_,index)=>{const vector=entries.get(index)?.embedding;
      if(!Array.isArray(vector)||vector.length!==model.dimensions||vector.some(value=>typeof value!=='number'||!Number.isFinite(value))||!vector.some(value=>value!==0))failure('INVALID_STRUCTURED_OUTPUT');return vector as number[];});
    return{...usage,vectors};
  }
}
