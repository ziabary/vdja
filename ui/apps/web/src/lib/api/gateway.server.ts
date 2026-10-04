import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import type {ReadableStream as typNodeReadableStream} from 'node:stream/web';

const REQUEST_HEADERS=['accept','content-type','x-correlation-id','x-request-id','x-content-sha256','range','if-range','if-none-match','authorization','x-tenant-id'] as const;
const RESPONSE_HEADERS=['content-type','cache-control','x-correlation-id','x-request-id','etag','content-range','accept-ranges','content-length','content-disposition','x-content-type-options','vary'] as const;
/** Server-only streaming transport. Host comes exclusively from validated deployment configuration. */
export async function forwardTargetApiRequest(url:URL,incoming:Request,applicationHost:string):Promise<Response>{
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!applicationHost||/[\r\n]/u.test(applicationHost))throw new Error('INVALID_API_GATEWAY_DESTINATION');
  const headers:Record<string,string>={host:applicationHost};
  for(const name of REQUEST_HEADERS){const value=incoming.headers.get(name);if(value)headers[name]=value;}
  return new Promise<Response>((resolve,reject)=>{
    const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:incoming.method,headers,signal:incoming.signal,
      ...(url.protocol==='https:'?{rejectUnauthorized:true}:{})},response=>{
      const status=response.statusCode??502;
      if(status>=300&&status<400&&status!==304){response.destroy();resolve(new Response(null,{status:502,headers:{'cache-control':'no-store'}}));return;}
      const result=new Headers();
      for(const name of RESPONSE_HEADERS){const value=response.headers[name];if(typeof value==='string')result.set(name,value);}
      result.set('cache-control',result.get('cache-control')??'no-store');
      if([204,304].includes(status)){response.resume();resolve(new Response(null,{status,headers:result}));}
      else resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>,{status,headers:result}));
    });
    request.setTimeout(300000,()=>request.destroy(new Error('API_GATEWAY_TIMEOUT')));
    request.once('error',reject);
    if(incoming.body&&incoming.method!=='GET'&&incoming.method!=='HEAD'){
      const body=Readable.fromWeb(incoming.body as unknown as typNodeReadableStream<Uint8Array>);body.once('error',error=>request.destroy(error));request.once('close',()=>body.destroy());body.pipe(request);
    }else request.end();
  });
}
