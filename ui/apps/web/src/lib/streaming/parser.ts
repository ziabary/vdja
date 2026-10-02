import type {typStreamEvent} from '@targoman/contracts';
export class exStreamProtocol extends Error {constructor(readonly code:string){super(code);}}
export interface intfStreamLimits {readonly maxFrameBytes:number;readonly maxBufferBytes:number;readonly maxOutputBytes:number;readonly idleMs:number;readonly totalMs:number}
export const DEFAULT_STREAM_LIMITS:intfStreamLimits={maxFrameBytes:65536,maxBufferBytes:131072,maxOutputBytes:2_000_000,idleMs:30000,totalMs:300000};
export interface intfSseFrame {readonly event:string;readonly data:string}
/** Shared UTF-8/SSE framing and lifecycle for canonical and frozen legacy streams. */
export async function consumeSseFrames(stream:ReadableStream<Uint8Array>,onFrame:(frame:intfSseFrame)=>void,limits:intfStreamLimits=DEFAULT_STREAM_LIMITS,signal?:AbortSignal,flushDataLines=false):Promise<void>{
  const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let buffer='',lines:string[]=[],frameBytes=0;
  const start=Date.now();let onAbort:(()=>void)|undefined;
  const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new exStreamProtocol('ABORTED'));signal?.addEventListener('abort',onAbort,{once:true});});
  function frame(){if(!lines.length)return;const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim()||'message';const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');lines=[];frameBytes=0;if(data)onFrame({event,data});}
  function chunkText(text:string){buffer+=text;if(new TextEncoder().encode(buffer).length>limits.maxBufferBytes)throw new exStreamProtocol('BUFFER_LIMIT');
    for(;;){const newline=buffer.indexOf('\n');if(newline<0)break;let line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(line.endsWith('\r'))line=line.slice(0,-1);frameBytes+=new TextEncoder().encode(line).length+1;if(frameBytes>limits.maxFrameBytes)throw new exStreamProtocol('FRAME_LIMIT');if(line===''){frame();continue;}if(!line.startsWith(':'))lines.push(line);if(flushDataLines&&line.startsWith('data:'))frame();}
  }
  try{for(;;){if(signal?.aborted)throw new exStreamProtocol('ABORTED');const remaining=limits.totalMs-(Date.now()-start);if(remaining<=0)throw new exStreamProtocol('TOTAL_TIMEOUT');let timer:ReturnType<typeof setTimeout>|undefined;let next:ReadableStreamReadResult<Uint8Array>;
      try{next=await Promise.race([reader.read(),aborted,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new exStreamProtocol('IDLE_OR_TOTAL_TIMEOUT')),Math.min(limits.idleMs,remaining));})]);}finally{if(timer)clearTimeout(timer);}if(next.done)break;chunkText(decoder.decode(next.value,{stream:true}));}
    chunkText(decoder.decode());if(buffer)chunkText('\n');if(lines.length)frame();
  }finally{if(onAbort)signal?.removeEventListener('abort',onAbort);await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function parseStreamEvent(value:unknown):typStreamEvent {
  if(!record(value)||typeof value.type!=='string'||typeof value.operationId!=='string'||!value.operationId)throw new exStreamProtocol('INVALID_EVENT');
  const base={operationId:value.operationId,sequence:typeof value.sequence==='number'?value.sequence:undefined};
  switch(value.type){
    case 'STATUS':if(typeof value.message==='string')return {...base,type:'STATUS',message:value.message};break;
    case 'DELTA':if(typeof value.text==='string')return {...base,type:'DELTA',text:value.text};break;
    case 'REFERENCES':if(Array.isArray(value.refs)&&value.refs.every(item=>typeof item==='string'))return {...base,type:'REFERENCES',refs:value.refs as string[]};break;
    case 'DONE':return {...base,type:'DONE'};
    case 'ERROR':if(typeof value.code==='string')return {...base,type:'ERROR',code:value.code};break;
    case 'CANCELLED':return {...base,type:'CANCELLED'};
  }
  throw new exStreamProtocol('INVALID_EVENT');
}
export async function consumeSse(stream:ReadableStream<Uint8Array>,onEvent:(event:typStreamEvent)=>void,limits:intfStreamLimits=DEFAULT_STREAM_LIMITS,signal?:AbortSignal):Promise<typStreamEvent> {
  let terminal:typStreamEvent|null=null,outputBytes=0;
  await consumeSseFrames(stream,frame=>{
    if(terminal)throw new exStreamProtocol('DATA_AFTER_TERMINAL');
    let parsed:unknown;try{parsed=JSON.parse(frame.data);}catch{throw new exStreamProtocol('INVALID_JSON');}
    const event=parseStreamEvent(parsed);
    if(event.type==='DELTA'){outputBytes+=new TextEncoder().encode(event.text).length;if(outputBytes>limits.maxOutputBytes)throw new exStreamProtocol('OUTPUT_LIMIT');}
    if(event.type==='DONE'||event.type==='ERROR'||event.type==='CANCELLED')terminal=event;
    onEvent(event);
  },limits,signal);
  if(!terminal)throw new exStreamProtocol('INTERRUPTED');
  return terminal;
}
