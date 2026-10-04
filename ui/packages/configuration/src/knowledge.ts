export type typKnowledgeConfiguration=Readonly<{enabled:false}>|Readonly<{
  enabled:true;indexProfileId:string;chunkingProfile:'utf16-window-v1';chunkChars:number;overlapChars:number;
  qdrant:Readonly<{endpoint:string;apiKeyRef:`file:/run/secrets/${string}`;timeoutMs:number;maxResponseBytes:number}>;
  query:Readonly<{maxQuestionBytes:number;candidateLimit:number;contextBytes:number;maxOutputTokens:number}>;
  admission:Readonly<{requestsPerMinute:number;concurrent:number;dailyRequests:number;dailyInputChars:number;inputChars:number;uploadBytes:number;outputTokens:number;tokenBudget:number}>;
}>;
function fail():never{throw new Error('INVALID_KNOWLEDGE_CONFIGURATION');}
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail();const result=value as Record<string,unknown>;if(Object.keys(result).some(key=>!keys.includes(key)))fail();return result;}
function integer(value:unknown,min:number,max:number):number{if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)fail();return Number(value);}
export function validateKnowledge(value:unknown,deploymentId:string):typKnowledgeConfiguration{
  const root=object(value,['enabled','indexProfileId','chunkingProfile','chunkChars','overlapChars','qdrant','query','admission']);
  if(root.enabled===false){if(Object.keys(root).length!==1)fail();return{enabled:false};}if(root.enabled!==true)fail();
  if(typeof root.indexProfileId!=='string'||!/^[a-z][a-z0-9._-]{0,127}$/u.test(root.indexProfileId)||root.chunkingProfile!=='utf16-window-v1')fail();
  const chunkChars=integer(root.chunkChars,32,8000),overlapChars=integer(root.overlapChars,0,chunkChars-1);
  const raw=object(root.qdrant,['endpoint','apiKeyRef','timeoutMs','maxResponseBytes']);if(typeof raw.endpoint!=='string')fail();
  const endpoint=new URL(raw.endpoint),local=deploymentId==='development'||deploymentId.startsWith('test-');
  if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||
    (endpoint.protocol!=='https:'&&!(local&&endpoint.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))))fail();
  if(typeof raw.apiKeyRef!=='string'||!/^file:\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(raw.apiKeyRef))fail();
  const query=object(root.query,['maxQuestionBytes','candidateLimit','contextBytes','maxOutputTokens']);
  const admission=object(root.admission,['requestsPerMinute','concurrent','dailyRequests','dailyInputChars','inputChars','uploadBytes','outputTokens','tokenBudget']);
  return{enabled:true,indexProfileId:root.indexProfileId,chunkingProfile:'utf16-window-v1',chunkChars,overlapChars,
    qdrant:{endpoint:endpoint.origin,apiKeyRef:raw.apiKeyRef as `file:/run/secrets/${string}`,timeoutMs:integer(raw.timeoutMs,100,60000),maxResponseBytes:integer(raw.maxResponseBytes,1024,10485760)},
    query:{maxQuestionBytes:integer(query.maxQuestionBytes,1,65536),candidateLimit:integer(query.candidateLimit,1,100),contextBytes:integer(query.contextBytes,1024,500000),maxOutputTokens:integer(query.maxOutputTokens,1,100000)},
    admission:{requestsPerMinute:integer(admission.requestsPerMinute,1,100000),concurrent:integer(admission.concurrent,1,1000),dailyRequests:integer(admission.dailyRequests,1,1000000),dailyInputChars:integer(admission.dailyInputChars,1,1000000000),inputChars:integer(admission.inputChars,1,2000000),uploadBytes:0,outputTokens:integer(admission.outputTokens,1,100000),tokenBudget:integer(admission.tokenBudget,1,1000000000)}};
}
