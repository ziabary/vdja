import type {typStreamEvent} from '@targoman/contracts';
import {consumeSse,type intfStreamLimits,DEFAULT_STREAM_LIMITS} from './parser.js';
import {consumeSseFrames,type intfSseFrame} from './parser.js';
/** Authenticated fetch-style stream boundary. No EventSource URL credentials or automatic reconnect. */
export async function openEventStream(fetcher:typeof fetch,path:string,body:unknown,onEvent:(event:typStreamEvent)=>void,signal?:AbortSignal,limits:intfStreamLimits=DEFAULT_STREAM_LIMITS):Promise<typStreamEvent>{
  if(!path.startsWith('/')||path.startsWith('//'))throw new Error('Invalid stream path');
  const response=await fetcher(`/api${path}`,{method:'POST',credentials:'same-origin',headers:{accept:'text/event-stream','content-type':'application/json'},body:JSON.stringify(body),signal});
  if(!response.ok||!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new Error('Stream unavailable');
  return consumeSse(response.body,onEvent,limits,signal);
}
/** Frozen public-tool endpoint adapter: POST JSON or multipart over the logical /api origin. */
export async function openLegacyEventStream(fetcher:typeof fetch,path:string,body:unknown,onFrame:(frame:intfSseFrame)=>void,signal?:AbortSignal):Promise<void>{
  if(!/^\/(?:translate|summarize|faq)$/.test(path))throw new Error('Invalid public stream path');
  const multipart=body instanceof FormData;
  const response=await fetcher(`/api${path}`,{method:'POST',credentials:'same-origin',headers:{accept:'text/event-stream',...(multipart?{}:{'content-type':'application/json'})},body:multipart?body:JSON.stringify(body),signal});
  if(!response.ok)throw new Error(response.status>=500?'SERVER_FAILURE':`HTTP_${response.status}`);
  if(!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new Error('INVALID_STREAM_RESPONSE');
  await consumeSseFrames(response.body,onFrame,DEFAULT_STREAM_LIMITS,signal);
}
