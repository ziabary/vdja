import type {intfTransportRequest,intfTransportResponse,intfUiTransport} from './client.js';
/** Only Web API transport performs network requests. Instantiate with request-local fetch. */
export function createFetchTransport(fetcher:typeof fetch,base='/api'):intfUiTransport {return {async send(request:intfTransportRequest):Promise<intfTransportResponse>{
  if(!request.path.startsWith('/')||request.path.startsWith('//'))throw new Error('Invalid API path');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),request.deadlineMs??30000);
  const abort=()=>controller.abort();request.signal?.addEventListener('abort',abort,{once:true});
  try{const response=await fetcher(`${base}${request.path}`,{method:request.method,headers:{accept:'application/json',...(request.body===undefined?{}:{'content-type':'application/json'}),...request.headers},body:request.body===undefined?undefined:JSON.stringify(request.body),signal:controller.signal,credentials:'same-origin'});
    const body:unknown=await response.json().catch(()=>null);
    return {status:response.status,body,correlationId:response.headers.get('x-correlation-id')??undefined};
  }catch(cause){if(controller.signal.reason instanceof Error&&controller.signal.reason.name==='TimeoutError')throw controller.signal.reason;throw cause;
  }finally{clearTimeout(timeout);request.signal?.removeEventListener('abort',abort);}
}};}
