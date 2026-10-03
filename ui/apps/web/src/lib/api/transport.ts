import type {intfTransportRequest,intfTransportResponse,intfUiTransport} from './client.js';
/** Only Web API transport performs network requests. Instantiate with request-local fetch. */
export function createFetchTransport(fetcher:typeof fetch,base='/api'):intfUiTransport {return {async send(request:intfTransportRequest):Promise<intfTransportResponse>{
  if(!request.path.startsWith('/')||request.path.startsWith('//'))throw new Error('Invalid API path');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),request.deadlineMs??30000);
  const abort=()=>controller.abort();request.signal?.addEventListener('abort',abort,{once:true});
  try{const multipart=request.contentType==='multipart';if(multipart&&!(request.body instanceof FormData))throw new Error('Multipart body must be FormData');
    const response=await fetcher(`${base}${request.path}`,{method:request.method,headers:{accept:'application/json',...(request.body===undefined||multipart?{}:{'content-type':'application/json'}),...request.headers},body:request.body===undefined?undefined:multipart?request.body as FormData:JSON.stringify(request.body),signal:controller.signal,credentials:'same-origin'});
    const body:unknown=await response.json().catch(()=>null);
    return {status:response.status,body,correlationId:response.headers.get('x-correlation-id')??undefined};
  }catch(cause){if(controller.signal.reason instanceof Error&&controller.signal.reason.name==='TimeoutError')throw controller.signal.reason;throw cause;
  }finally{clearTimeout(timeout);request.signal?.removeEventListener('abort',abort);}
}};}
export function browserFetcher():typeof fetch{return globalThis.fetch.bind(globalThis);}
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
export function postAuthRequest(path:'login'|'refresh'|'logout',body?:unknown):Promise<Response>{
  return browserFetcher()(`/api/auth/${path}`,{method:'POST',credentials:'same-origin',
    headers:{accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body)});
}
export async function postPublicTool(fetcher:typeof fetch,path:'/translate'|'/summarize'|'/faq',body:unknown,signal?:AbortSignal):Promise<Response>{
  const multipart=body instanceof FormData;
  return fetcher(`/api${path}`,{method:'POST',credentials:'same-origin',headers:{accept:'text/event-stream, application/json',...(multipart?{}:{'content-type':'application/json'})},body:multipart?body:JSON.stringify(body),signal});
}

/** Server-side gateway transport keeps upstream networking in the transport owner. */
export async function forwardPublicApiRequest(url:URL,request:Request):Promise<Response>{
  const headers=new Headers();
  for(const name of ['accept','content-type','x-correlation-id']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  const authPath=/^\/api\/auth\/(?:login|refresh|logout)$/.test(url.pathname);
  if(authPath)for(const name of ['origin','cookie']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  if(!authPath)for(const name of ['authorization','x-tenant-id']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  const upstream=await globalThis.fetch(url,{method:request.method,headers,body:request.method==='GET'||request.method==='HEAD'?undefined:request.body,signal:request.signal,duplex:'half'} as RequestInit);
  const responseHeaders=new Headers();
  for(const name of ['content-type','cache-control','x-correlation-id','x-request-id']){const value=upstream.headers.get(name);if(value)responseHeaders.set(name,value);}
  if(authPath){const cookie=upstream.headers.get('set-cookie');if(cookie)responseHeaders.set('set-cookie',cookie);}
  return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
}
