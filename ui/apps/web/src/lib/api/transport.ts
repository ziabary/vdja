import type {intfTransportRequest,intfTransportResponse,intfUiTransport} from './client.js';
/** Only Web API transport performs network requests. Instantiate with request-local fetch. */
export function createFetchTransport(fetcher:typeof fetch,base='/api'):intfUiTransport {return {async send(request:intfTransportRequest):Promise<intfTransportResponse>{
  if(!request.path.startsWith('/')||request.path.startsWith('//'))throw new Error('Invalid API path');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),request.deadlineMs??30000);
  const abort=()=>controller.abort();request.signal?.addEventListener('abort',abort,{once:true});
  try{const multipart=request.contentType==='multipart',binary=request.contentType==='binary';if(multipart&&!(request.body instanceof FormData))throw new Error('Multipart body must be FormData');
    if(binary&&!(request.body instanceof Blob)&&!(request.body instanceof ArrayBuffer)&&!ArrayBuffer.isView(request.body))throw new Error('Binary body required');
    const response=await fetcher(`${base}${request.path}`,{method:request.method,headers:{accept:'application/json',...(request.body===undefined||multipart?{}:{'content-type':binary?'application/octet-stream':'application/json'}),...request.headers},body:request.body===undefined?undefined:multipart||binary?request.body as BodyInit:JSON.stringify(request.body),signal:controller.signal,credentials:'same-origin'});
    const body:unknown=await response.json().catch(()=>null);
    return {status:response.status,body,correlationId:response.headers.get('x-correlation-id')??undefined};
  }catch(cause){if(controller.signal.reason instanceof Error&&controller.signal.reason.name==='TimeoutError')throw controller.signal.reason;throw cause;
  }finally{clearTimeout(timeout);request.signal?.removeEventListener('abort',abort);}
}};}
export function browserFetcher():typeof fetch{return globalThis.fetch.bind(globalThis);}
export function postKnowledgeQuestion(fetcher:typeof fetch,spaceId:string,question:string,signal?:AbortSignal):Promise<Response>{
  if(!/^[a-f0-9-]{36}$/u.test(spaceId))throw new Error('INVALID_KNOWLEDGE_PATH');
  return fetcher(`/api/knowledge/spaces/${spaceId}/query`,{method:'POST',credentials:'same-origin',redirect:'error',
    headers:{accept:'text/event-stream','content-type':'application/json'},body:JSON.stringify({question}),
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(300000)]):AbortSignal.timeout(300000)});
}
export async function downloadProtectedFile(fetcher:typeof fetch,path:string,maximumBytes:number,signal?:AbortSignal):Promise<Blob>{
  if(!/^\/api\/knowledge\/documents\/[a-f0-9-]{36}\/versions\/[a-f0-9-]{36}\/download$/u.test(path))throw new Error('Invalid download path');
  const response=await fetcher(path,{method:'GET',credentials:'same-origin',redirect:'error',signal});
  if(!response.ok||!response.body)throw new Error('DOWNLOAD_DENIED');
  const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>maximumBytes)throw new Error('DOWNLOAD_LIMIT_EXCEEDED');chunks.push(new Uint8Array(next.value));}}
  finally{await reader.cancel();reader.releaseLock();}
  return new Blob(chunks,{type:response.headers.get('content-type')??'application/octet-stream'});
}
export function publicToolFetcher(fetcher:typeof fetch,credentials:()=>Readonly<{token:string|null;tenantId:string|null}>):typeof fetch{
  return ((input:RequestInfo|URL,init?:RequestInit)=>{
    const state=credentials();
    if(!state.token)return fetcher(input,init);
    const headers=new Headers(init?.headers);
    headers.set('authorization',`Bearer ${state.token}`);
    if(state.tenantId)headers.set('x-tenant-id',state.tenantId);
    return fetcher(input,{...init,headers});
  }) as typeof fetch;
}
export function postAuthRequest(authOrigin:string,path:'login'|'refresh'|'logout',body?:unknown):Promise<Response>{
  if(new URL(authOrigin).origin!==authOrigin||!authOrigin.startsWith('https://'))throw new Error('Invalid Auth origin');
  return browserFetcher()(`${authOrigin}/api/auth/${path}`,{method:'POST',credentials:'include',
    headers:{accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body)});
}
export async function postPublicTool(fetcher:typeof fetch,path:'/translate'|'/summarize'|'/faq',body:unknown,signal?:AbortSignal):Promise<Response>{
  const multipart=body instanceof FormData;
  return fetcher(`/api${path}`,{method:'POST',credentials:'same-origin',headers:{accept:'text/event-stream, application/json',...(multipart?{}:{'content-type':'application/json'})},body:multipart?body:JSON.stringify(body),signal});
}

/** Server-side gateway transport keeps upstream networking in the transport owner. */
export async function forwardPublicApiRequest(url:URL,request:Request,host?:string):Promise<Response>{
  const headers=new Headers();
  for(const name of ['accept','content-type','x-correlation-id','x-request-id','x-content-sha256','range','if-range','if-none-match']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  for(const name of ['authorization','x-tenant-id']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  if(host)headers.set('host',host);
  const upstream=await globalThis.fetch(url,{method:request.method,redirect:'error',headers,body:request.method==='GET'||request.method==='HEAD'?undefined:request.body,signal:request.signal,duplex:'half'} as RequestInit);
  const responseHeaders=new Headers();
  for(const name of ['content-type','cache-control','x-correlation-id','x-request-id','etag','content-range','accept-ranges','content-length','content-disposition','x-content-type-options','vary']){const value=upstream.headers.get(name);if(value)responseHeaders.set(name,value);}
  return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
}
