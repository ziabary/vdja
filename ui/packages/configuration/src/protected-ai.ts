import { enuProtectedAiTask,enuAiExecutionKind,type intfProtectedAiConfiguration,type intfProtectedAiModel,type intfProtectedAiEndpoint,type intfProtectedAiPolicy } from '../../contracts/src/protected-ai.js';
import { enuEgressBoundary,type intfGovernanceConfiguration } from '../../data-governance/src/index.js';
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_PROTECTED_AI_CONFIGURATION');
  const result=value as Record<string,unknown>;
  if(Object.keys(result).some(key=>!keys.includes(key)))throw new Error('UNKNOWN_PROTECTED_AI_CONFIGURATION_FIELD');return result;
}
function string(value:unknown):string{if(typeof value!=='string'||!value||value.length>512)throw new Error('INVALID_PROTECTED_AI_CONFIGURATION');return value;}
function id(value:unknown):string{const result=string(value);if(!/^[a-z][a-z0-9._-]{0,127}$/u.test(result))throw new Error('INVALID_PROTECTED_AI_IDENTIFIER');return result;}
function integer(value:unknown,min:number,max:number):number{if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new Error('INVALID_PROTECTED_AI_LIMIT');return Number(value);}
function list(value:unknown):readonly unknown[]{if(!Array.isArray(value)||value.length>1000)throw new Error('INVALID_PROTECTED_AI_CONFIGURATION');return value;}
function unique(ids:readonly string[]):void{if(new Set(ids).size!==ids.length)throw new Error('DUPLICATE_PROTECTED_AI_CONFIGURATION');}
function endpointOrigin(value:unknown,deploymentId:string):string{
  const raw=string(value),url=new URL(raw);
  const local=deploymentId==='development'||deploymentId.startsWith('test-');
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(!['https:'].includes(url.protocol)&&!(local&&url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))
    throw new Error('PROTECTED_AI_ENDPOINT_REQUIRES_APPROVED_TLS_OR_TEST_LOOPBACK');return url.origin;
}
export function validateProtectedAi(value:unknown,deploymentId:string):intfProtectedAiConfiguration{
  const root=object(value,['models','endpoints','tasks']);
  const models=list(root.models).map(value=>{const x=object(value,['id','modelId','artifactRevision','kind','dimensions','maxInputBytes','maxOutputTokens','contextTokens']);
    if(!Object.values(enuAiExecutionKind).includes(x.kind as enuAiExecutionKind))throw new Error('INVALID_PROTECTED_AI_KIND');
    return {id:id(x.id),modelId:string(x.modelId),artifactRevision:id(x.artifactRevision),kind:x.kind as enuAiExecutionKind,
      dimensions:integer(x.dimensions,0,65536),maxInputBytes:integer(x.maxInputBytes,1024,2000000),maxOutputTokens:integer(x.maxOutputTokens,0,100000),contextTokens:integer(x.contextTokens,2048,4000000)} satisfies intfProtectedAiModel;
  });unique(models.map(value=>value.id));
  for(const model of models)if((model.kind===enuAiExecutionKind.Embedding)!==(model.dimensions>0)||(model.kind===enuAiExecutionKind.Generation)!==(model.maxOutputTokens>0))throw new Error('INVALID_PROTECTED_MODEL_CONTRACT');
  const endpoints=list(root.endpoints).map(value=>{const x=object(value,['id','modelProfileId','enabled','baseUrl','capabilities','credentialRef','maxConcurrent','timeoutMs']);
    if(typeof x.enabled!=='boolean')throw new Error('INVALID_PROTECTED_AI_CONFIGURATION');
    const capabilities=list(x.capabilities).map(task=>{if(!Object.values(enuProtectedAiTask).includes(task as enuProtectedAiTask))throw new Error('INVALID_PROTECTED_AI_TASK');return task as enuProtectedAiTask;});unique(capabilities);
    const credentialRef=x.credentialRef===undefined?undefined:string(x.credentialRef);
    if(credentialRef&&!/^file:\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(credentialRef))throw new Error('PROTECTED_AI_SECRET_REF_REQUIRED');
    return {id:id(x.id),modelProfileId:id(x.modelProfileId),enabled:x.enabled,baseUrl:endpointOrigin(x.baseUrl,deploymentId),capabilities,
      ...(credentialRef?{credentialRef:credentialRef as `file:/run/secrets/${string}`} : {}),maxConcurrent:integer(x.maxConcurrent,1,1000),timeoutMs:integer(x.timeoutMs,100,300000)} satisfies intfProtectedAiEndpoint;
  });unique(endpoints.map(value=>value.id));
  for(const endpoint of endpoints)if(!models.some(model=>model.id===endpoint.modelProfileId))throw new Error('UNKNOWN_PROTECTED_AI_MODEL');
  const raw=object(root.tasks,Object.values(enuProtectedAiTask)),tasks={} as Record<enuProtectedAiTask,intfProtectedAiPolicy>;
  for(const task of Object.values(enuProtectedAiTask)){
    const x=object(raw[task],['modelProfileId','preferredEndpoints','maxAttempts','maxInputBytes','maxResponseBytes']);
    const modelProfileId=id(x.modelProfileId),model=models.find(value=>value.id===modelProfileId);
    const kind=task===enuProtectedAiTask.Answer?enuAiExecutionKind.Generation:task===enuProtectedAiTask.Rerank?enuAiExecutionKind.Rerank:enuAiExecutionKind.Embedding;
    if(!model||model.kind!==kind)throw new Error('PROTECTED_TASK_MODEL_MISMATCH');
    const preferredEndpoints=list(x.preferredEndpoints).map(id);unique(preferredEndpoints);
    if(!preferredEndpoints.length||preferredEndpoints.some(ref=>!endpoints.some(endpoint=>endpoint.id===ref&&endpoint.enabled&&endpoint.modelProfileId===modelProfileId&&endpoint.capabilities.includes(task))))throw new Error('NO_ELIGIBLE_PROTECTED_AI_ENDPOINT');
    tasks[task]={modelProfileId,preferredEndpoints,maxAttempts:integer(x.maxAttempts,1,5),maxInputBytes:integer(x.maxInputBytes,1024,model.maxInputBytes),maxResponseBytes:integer(x.maxResponseBytes,1024,16777216)};
  }
  if(tasks[enuProtectedAiTask.DocumentEmbed].modelProfileId!==tasks[enuProtectedAiTask.QueryEmbed].modelProfileId)throw new Error('QUERY_DOCUMENT_EMBEDDING_PROFILE_MISMATCH');
  return {models,endpoints,tasks};
}
export function validateAiGovernance(value:unknown,deploymentId:string,ai:intfProtectedAiConfiguration):intfGovernanceConfiguration{
  const root=object(value,['policyVersion','destinations']);
  const destinations=list(root.destinations).map(value=>{const x=object(value,['endpointId','origin','boundary','region','permittedTasks','permittedClassifications','retention','training']);
    if(!Object.values(enuEgressBoundary).includes(x.boundary as enuEgressBoundary)||x.retention!=='NO_RETENTION'||x.training!=='PROHIBITED')throw new Error('INVALID_AI_EGRESS_POLICY');
    const endpointId=id(x.endpointId),origin=endpointOrigin(x.origin,deploymentId);
    if(!ai.endpoints.some(endpoint=>endpoint.id===endpointId&&endpoint.baseUrl===origin))throw new Error('EGRESS_DESTINATION_ENDPOINT_MISMATCH');
    const permittedTasks=list(x.permittedTasks).map(task=>{if(!Object.values(enuProtectedAiTask).includes(task as enuProtectedAiTask))throw new Error('INVALID_AI_EGRESS_POLICY');return task as enuProtectedAiTask;});unique(permittedTasks);
    const permittedClassifications=list(x.permittedClassifications).map(level=>{if(!['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(level)))throw new Error('INVALID_AI_EGRESS_POLICY');return level as 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';});unique(permittedClassifications);
    return {endpointId,origin,boundary:x.boundary as enuEgressBoundary,region:id(x.region),permittedTasks,permittedClassifications,retention:'NO_RETENTION' as const,training:'PROHIBITED' as const};
  });unique(destinations.map(value=>value.endpointId));return {policyVersion:id(root.policyVersion),destinations};
}
