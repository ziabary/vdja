import { createServer } from 'node:http';
import { validateProtectedAi,validateAiGovernance } from '../../../packages/configuration/src/protected-ai.js';
import { enuProtectedAiTask } from '../../../packages/contracts/src/protected-ai.js';
export async function startProviderFixture(){
  const calls:Readonly<{path:string;body:Record<string,unknown>}>[]=[];
  const state:{answer:unknown;models?:readonly string[];failPath?:string;beforeResponse?:(path:string)=>Promise<void>}={answer:{answer:'تحلیل کلی داده‌ها.',citations:[]}};
  const server=createServer(async(request,response)=>{
    try{
      if(request.method==='GET'&&request.url==='/v1/models'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({data:(state.models??configuration.models.map(model=>model.modelId)).map(id=>({id}))}));return;}
      const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString()) as Record<string,unknown>;
      const path=request.url!;calls.push({path,body});await state.beforeResponse?.(path);response.setHeader('Content-Type','application/json');
      if(state.failPath===path){response.writeHead(503).end();return;}
      if(path==='/v1/embeddings')response.end(JSON.stringify({model:body.model,usage:{prompt_tokens:3,total_tokens:3},data:(body.input as string[]).map((_,index)=>({index,embedding:[1,0.1,0.2]}))}));
      else if(path==='/score')response.end(JSON.stringify({model:body.model,usage:{prompt_tokens:4,total_tokens:4},data:(body.text_2 as string[]).map((_,index)=>({index,score:1-index/10}))}));
      else response.end(JSON.stringify({model:body.model,usage:{prompt_tokens:10,completion_tokens:6},choices:[{finish_reason:'stop',message:{content:JSON.stringify(state.answer)}}]}));
    }catch{response.writeHead(500).end();}
  });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('INVALID_PROVIDER_FIXTURE');
  const baseUrl=`http://127.0.0.1:${address.port}`;
  const configuration=validateProtectedAi({models:[
    {id:'embedding-v1',modelId:'fixture-embedding',artifactRevision:'revision-v1',kind:'EMBEDDING',dimensions:3,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:0},
    {id:'rerank-v1',modelId:'fixture-rerank',artifactRevision:'revision-v1',kind:'RERANK',dimensions:0,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:0},
    {id:'answer-v1',modelId:'fixture-answer',artifactRevision:'revision-v1',kind:'GENERATION',dimensions:0,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:1024}
  ],endpoints:[
    {id:'fixture-embed',modelProfileId:'embedding-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.DocumentEmbed,enuProtectedAiTask.QueryEmbed],maxConcurrent:3,timeoutMs:5000},
    {id:'fixture-rerank',modelProfileId:'rerank-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.Rerank],maxConcurrent:3,timeoutMs:5000},
    {id:'fixture-answer',modelProfileId:'answer-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.Answer],maxConcurrent:3,timeoutMs:5000}
  ],tasks:Object.fromEntries(Object.values(enuProtectedAiTask).map(task=>[task,{modelProfileId:task===enuProtectedAiTask.Answer?'answer-v1':task===enuProtectedAiTask.Rerank?'rerank-v1':'embedding-v1',
    preferredEndpoints:[task===enuProtectedAiTask.Answer?'fixture-answer':task===enuProtectedAiTask.Rerank?'fixture-rerank':'fixture-embed'],maxAttempts:1,maxInputBytes:100000,maxResponseBytes:65536}]))},'test-rag');
  const governance=validateAiGovernance({policyVersion:'fixture-policy-v1',destinations:configuration.endpoints.map(endpoint=>({endpointId:endpoint.id,origin:baseUrl,boundary:'PRIVATE_INTERNAL',region:'test-private',permittedTasks:Object.values(enuProtectedAiTask),permittedClassifications:['LOW','MEDIUM','HIGH','CRITICAL'],retention:'NO_RETENTION',training:'PROHIBITED'}))},'test-rag',configuration);
  return{configuration,governance,state,calls,async close(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
