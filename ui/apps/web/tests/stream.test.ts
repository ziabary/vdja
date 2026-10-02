import {describe,it,expect} from 'vitest';
import {consumeSse,exStreamProtocol} from '../src/lib/streaming/parser.js';
const encoder=new TextEncoder();
function stream(chunks:readonly string[]):ReadableStream<Uint8Array>{return new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(encoder.encode(chunk));controller.close();}});}
describe('SSE protocol',()=>{
  it('joins fragmented UTF-8, CRLF and multiline data with one terminal',async()=>{
    const text='سلام';const frame=`: beat\r\ndata: {"type":"DELTA","operationId":"op","text":"${text}"}\r\n\r\ndata: {"type":"DONE","operationId":"op"}\n\n`;
    const bytes=encoder.encode(frame);const pieces=Array.from(bytes,byte=>new Uint8Array([byte]));
    const input=new ReadableStream<Uint8Array>({start(controller){for(const piece of pieces)controller.enqueue(piece);controller.close();}});
    const events:string[]=[];const result=await consumeSse(input,event=>events.push(event.type));
    expect(events).toEqual(['DELTA','DONE']);expect(result.type).toBe('DONE');
  });
  it('treats EOF without terminal as interruption',async()=>{await expect(consumeSse(stream(['data: {"type":"DELTA","operationId":"op","text":"x"}\n\n']),()=>undefined)).rejects.toMatchObject({code:'INTERRUPTED'});});
  it('rejects data after terminal and oversized frames',async()=>{
    await expect(consumeSse(stream(['data: {"type":"DONE","operationId":"op"}\n\ndata: {"type":"DONE","operationId":"op"}\n\n']),()=>undefined)).rejects.toMatchObject({code:'DATA_AFTER_TERMINAL'});
    await expect(consumeSse(stream(['data: xxxxxxxxxxxxxx\n\n']),()=>undefined,{maxFrameBytes:8,maxBufferBytes:100,maxOutputBytes:100,idleMs:1000,totalMs:1000})).rejects.toMatchObject({code:'FRAME_LIMIT'});
  });
  it('aborts a stalled stream and releases its reader',async()=>{
    const controller=new AbortController();let cancelled=false;
    const input=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
    const pending=consumeSse(input,()=>undefined,undefined,controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({code:'ABORTED'});
    expect(cancelled).toBe(true);
  });
  it('ends a stalled stream at its idle deadline',async()=>{
    const input=new ReadableStream<Uint8Array>();
    await expect(consumeSse(input,()=>undefined,{maxFrameBytes:100,maxBufferBytes:100,maxOutputBytes:100,idleMs:5,totalMs:100})).rejects.toMatchObject({code:'IDLE_OR_TOTAL_TIMEOUT'});
  });
});
