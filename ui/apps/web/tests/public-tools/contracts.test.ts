import {afterEach,describe,expect,it,vi} from 'vitest';
import {createPublicToolsClient,consumeLegacyText,newPublicRequestId} from '../../src/lib/api/publicTools.js';

const encoder=new TextEncoder();
function sse(frames:string[]):Response{return new Response(new ReadableStream<Uint8Array>({start(controller){for(const frame of frames)controller.enqueue(encoder.encode(frame));controller.close();}}),{status:200,headers:{'content-type':'text/event-stream; charset=utf-8'}});}
function mockFetch(reply:(url:string,init:RequestInit)=>Response|Promise<Response>){const calls:{url:string;init:RequestInit}[]=[];const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const call={url:String(input),init:init??{}};calls.push(call);return reply(call.url,call.init);});vi.stubGlobal('fetch',fetcher);return calls;}
afterEach(()=>vi.unstubAllGlobals());

describe('frozen public tool contracts',()=>{
  it('uses the 32-character request ID required by the existing generation and stop handlers',()=>{
    expect(newPublicRequestId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newPublicRequestId()).not.toBe(newPublicRequestId());
  });
  it('sends translator field names and accepts dictionary JSON without a stream',async()=>{
    const calls=mockFetch(()=>Response.json({phrase:'book',translations:['کتاب'],pronunciations:{us:'bʊk'}}));
    const result=await createPublicToolsClient().translate({text:'book',sourceLang:'en',targetLang:'fa',requestId:'r-1'},()=>undefined);
    expect(calls[0]?.url).toBe('/api/translate');expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({text:'book',source_lang:'en',target_lang:'fa',request_id:'r-1'});
    expect(result.dictionary?.translations).toEqual(['کتاب']);
  });
  it('sends summarizer options and handles split legacy frames and terminal cancellation',async()=>{
    const calls=mockFetch(()=>sse(['data: {"delta":"س','لام"}\n\ndata: [CANCELLED:r-2]\n\ndata: [DONE:r-2]\n\n']));const deltas:string[]=[];
    const result=await createPublicToolsClient().summarize({text:'text',maxWords:200,forcePersian:true,requestId:'r-2'},value=>deltas.push(value));
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({text:'text',max_words:200,force_persian:true,request_id:'r-2'});
    expect(deltas).toEqual(['سلام']);expect(result).toEqual({outcome:'CANCELLED',markdown:'سلام'});
  });
  it('consumes consecutive legacy data lines within one SSE frame',async()=>{
    const deltas:string[]=[];
    const stream=sse(['data: {"delta":"first"}\ndata: {"delta":" second"}\ndata: [REF]:[]\ndata: [DONE:translate-id]\n\n']);
    const result=await consumeLegacyText(stream.body!,value=>deltas.push(value));
    expect(deltas).toEqual(['first',' second']);
    expect(result).toEqual({outcome:'SUCCEEDED',markdown:'first second'});
  });
  it('shows legacy translation deltas before the terminal blank line arrives',async()=>{
    let write!:ReadableStreamDefaultController<Uint8Array>;
    const stream=new ReadableStream<Uint8Array>({start(controller){write=controller;}});
    const deltas:string[]=[];
    const completion=consumeLegacyText(stream,value=>deltas.push(value));
    write.enqueue(encoder.encode('data: {"delta":"early"}\n'));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(deltas).toEqual(['early']);
    write.enqueue(encoder.encode('data: {"delta":" later"}\ndata: [DONE:request]\n\n'));
    write.close();
    await expect(completion).resolves.toEqual({outcome:'SUCCEEDED',markdown:'early later'});
  });
  it('requires terminal frames and rejects data after terminal',async()=>{
    await expect(consumeLegacyText(sse(['data: {"delta":"partial"}\n\n']).body!,()=>undefined)).rejects.toMatchObject({code:'INTERRUPTED'});
    await expect(consumeLegacyText(sse(['data: [DONE:x]\n\ndata: {"delta":"late"}\n\n']).body!,()=>undefined)).rejects.toMatchObject({code:'DATA_AFTER_TERMINAL'});
  });
  it('uses the frozen stop endpoint and treats backend rejection as a safe error',async()=>{
    const calls=mockFetch(url=>url.endsWith('/stop')?Response.json({status:'OK'}):Response.json({error:{message:'private server detail'}},{status:400}));
    const client=createPublicToolsClient();expect(await client.stop('translate','request 1')).toBe(true);
    expect(calls[0]?.url).toBe('/api/translate/request%201/stop');expect(calls[0]?.init.method).toBe('POST');
    await expect(client.translate({text:'x',sourceLang:'en',targetLang:'fa',requestId:'r'},()=>undefined)).rejects.toMatchObject({status:400,envelope:{message:'Request could not be completed'}});
  });
  it('does not acknowledge a stop after the legacy request has finished',async()=>{
    mockFetch(()=>Response.json({status:'NOT_RUNNING'}));
    expect(await createPublicToolsClient().stop('summarize','request')).toBe(false);
  });
  it('preserves local text extraction and multipart binary extraction shape',async()=>{
    const calls=mockFetch(()=>Response.json({text:'Extracted',stripped:false}));const client=createPublicToolsClient();
    const textFile=new File(['Hello'],'note.txt',{type:'text/plain'});expect(await client.extractText(textFile,2000)).toBe('Hello');expect(calls).toHaveLength(0);
    const pdf=new File(['%PDF'],'note.pdf',{type:'application/pdf'});expect(await client.extractText(pdf,3000)).toBe('Extracted');
    expect(calls[0]?.url).toBe('/api/file2Text?maxChars=3000');expect(calls[0]?.init.body).toBeInstanceOf(FormData);expect((calls[0]?.init.body as FormData).get('file')).toBe(pdf);expect((calls[0]?.init.headers as Record<string,string>)['content-type']).toBeUndefined();
  });
  it('sends FAQ inspect and generation multipart fields, batch content and done terminal',async()=>{
    const calls=mockFetch(url=>url.endsWith('/inspect')?Response.json({fileName:'note.txt',pageCount:2,sourceChars:40}):sse(['event: meta\ndata: {"count":10,"batches":1}\n\n','event: batch\ndata: {"index":1,"total":1,"produced":1,"items":[{"question":"Q?","answer":"A","section":"S"}]}\n\n','event: done\ndata: {"produced":1}\n\n']));
    const file=new File(['Hello'],'note.txt',{type:'text/plain'});const client=createPublicToolsClient();expect(await client.inspectFaq(file)).toEqual({fileName:'note.txt',pageCount:2,sourceChars:40});
    const batches:string[]=[];await client.generateFaq({file,count:10,answerWords:100,tone:'formal',language:'source',scope:'range',from:1,to:2,focus:'',priorQuestions:['old']},()=>undefined,items=>batches.push(items[0]!.question));
    expect(calls[1]?.url).toBe('/api/faq');const body=calls[1]?.init.body as FormData;expect(body.get('file')).toBe(file);expect(body.get('answer_words')).toBe('100');expect(body.get('scope')).toBe('range');expect(body.get('prior_questions')).toBe('["old"]');expect(batches).toEqual(['Q?']);
  });
  it('does not report incomplete FAQ EOF as success',async()=>{
    mockFetch(()=>sse(['event: batch\ndata: {"produced":1,"items":[{"question":"Q","answer":"A"}]}\n\n']));
    const file=new File(['Hello'],'note.txt');await expect(createPublicToolsClient().generateFaq({file,count:10,answerWords:100,tone:'formal',language:'source',scope:'all',from:1,to:1,focus:'',priorQuestions:[]},()=>undefined,()=>undefined)).rejects.toMatchObject({code:'INTERRUPTED'});
  });
});
