// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {mount,unmount,tick} from 'svelte';
import TextTool from '../../src/lib/public-tools/TextTool.svelte';
import FaqPage from '../../src/routes/(public)/faq/+page.svelte';
import axe from 'axe-core';

const mounted:ReturnType<typeof mount>[]=[];
function host(){const element=document.createElement('div');document.body.append(element);return element;}
async function settle(){await tick();await new Promise(resolve=>setTimeout(resolve,0));await tick();}
function dropFile(target:Element,file:File){
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{files:[file],types:['Files']}});
  target.dispatchEvent(event);
}
afterEach(async()=>{vi.useRealTimers();for(const app of mounted.splice(0))await unmount(app);document.body.innerHTML='';vi.unstubAllGlobals();});
describe('rendered public tools',()=>{
  it('opens file choice from the central card and leaves a clear text field on focus',async()=>{
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'translate'}}));await settle();
    const chooser=target.querySelector<HTMLInputElement>('input[type=file]')!;
    const open=vi.spyOn(chooser,'click').mockImplementation(()=>undefined);
    const central=target.querySelector<HTMLButtonElement>('.center-picker')!;
    expect(central).not.toBeNull();central.click();expect(open).toHaveBeenCalledTimes(1);
    target.querySelector<HTMLTextAreaElement>('textarea')!.focus();await settle();
    expect(target.querySelector('.center-picker')).toBeNull();
    expect(target.querySelector('.compact-picker')).toBeNull();
    expect(target.querySelector('.file-drop-input button')).toBeNull();
  });
  it('pauses automatic translation after an API failure until an explicit retry succeeds',async()=>{
    let calls=0;
    const fetcher=vi.fn(async()=>{calls++;if(calls===1)throw new TypeError('Failed to fetch');return Response.json({phrase:'book',translations:['کتاب']});});
    vi.stubGlobal('fetch',fetcher);vi.stubGlobal('crypto',{randomUUID:()=> '01234567-89ab-cdef-0123-456789abcdef'});
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'translate'}}));await settle();
    vi.useFakeTimers();
    const input=target.querySelector<HTMLTextAreaElement>('textarea')!;
    input.value='book';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    await vi.advanceTimersByTimeAsync(2000);await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[role=alert]')?.textContent).toContain('اتصال');
    input.value='books';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    await vi.advanceTimersByTimeAsync(2500);await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    target.querySelector<HTMLButtonElement>('.tool-result-actions .btn-outline-primary')!.click();
    await vi.advanceTimersByTimeAsync(0);await tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(target.querySelector('.tool-output')?.textContent).toContain('کتاب');
    input.value='bookcase';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    await vi.advanceTimersByTimeAsync(2000);await tick();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each(['translate','summarize'] as const)('accepts a file dropped on the %s text field',async kind=>{
    const target=host();mounted.push(mount(TextTool,{target,props:{kind}}));await settle();
    const file=new File(['A dropped note.'],'note.txt',{type:'text/plain'});
    Object.defineProperty(file,'text',{value:async()=> 'A dropped note.'});
    dropFile(target.querySelector('textarea')!,file);await settle();
    expect(target.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('A dropped note.');
    expect(target.querySelector('[role=alert]')).toBeNull();
    expect(target.querySelector<HTMLInputElement>('input[type=file]')?.disabled).toBe(false);
  });
  it('rejects unsupported files dropped on the text field',async()=>{
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'translate'}}));await settle();
    dropFile(target.querySelector('textarea')!,new File(['x'],'picture.png',{type:'image/png'}));await settle();
    expect(target.querySelector('[role=alert]')?.textContent).toContain('پشتیبانی');
    expect(target.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('');
  });
  it('sends a dropped document through the existing summarizer extraction endpoint',async()=>{
    const fetcher=vi.fn(async (_url:string)=>Response.json({text:'Extracted document'}));vi.stubGlobal('fetch',fetcher);
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'summarize'}}));await settle();
    dropFile(target.querySelector('textarea')!,new File(['document'],'note.pdf',{type:'application/pdf'}));await settle();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/file2Text?maxChars=3000');
    expect(target.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Extracted document');
  });
  it('locks duplicate translator submissions and renders a safe dictionary response',async()=>{
    let release:(value:Response)=>void=()=>undefined;const pending=new Promise<Response>(resolve=>release=resolve);
    const fetcher=vi.fn(()=>pending);vi.stubGlobal('fetch',fetcher);vi.stubGlobal('crypto',{randomUUID:()=> 'request-1'});
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'translate'}}));await settle();
    const input=target.querySelector<HTMLTextAreaElement>('textarea')!;input.value='book';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
    const submit=target.querySelector<HTMLButtonElement>('button[type=submit]')!;submit.click();submit.click();await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);expect(submit.disabled).toBe(true);
    release(Response.json({phrase:'book',translations:['کتاب']}));await settle();
    expect(target.querySelector('.tool-output')?.textContent).toContain('کتاب');expect(target.querySelector('[role=status]')?.textContent).toContain('آماده');
    const scan=await axe.run(target,{runOnly:{type:'rule',values:['label','aria-valid-attr','aria-valid-attr-value']}});expect(scan.violations).toEqual([]);
  });
  it('does not show a stale stop error when generation succeeds around a stop reply',async()=>{
    let streamController:ReadableStreamDefaultController<Uint8Array>|undefined;
    let releaseStop:(value:Response)=>void=()=>undefined;
    const stopReply=new Promise<Response>(resolve=>releaseStop=resolve);
    const stream=new ReadableStream<Uint8Array>({start(controller){streamController=controller;}});
    vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/stop')?stopReply:Promise.resolve(new Response(stream,{headers:{'content-type':'text/event-stream'}}))));
    vi.stubGlobal('crypto',{randomUUID:()=> '01234567-89ab-cdef-0123-456789abcdef'});
    const target=host();mounted.push(mount(TextTool,{target,props:{kind:'summarize'}}));await settle();
    const input=target.querySelector<HTMLTextAreaElement>('textarea')!;input.value='A public library lends books to residents.';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
    target.querySelector<HTMLButtonElement>('button[type=submit]')!.click();await settle();
    target.querySelector<HTMLButtonElement>('.btn-outline-warning')!.click();await settle();
    releaseStop(Response.json({status:'NOT_RUNNING'}));await settle();
    streamController!.enqueue(new TextEncoder().encode('data: {"delta":"Summary"}\n\ndata: [DONE:id]\n\n'));streamController!.close();await settle();
    expect(target.querySelector('.tool-output')?.textContent).toContain('Summary');
    expect(target.querySelector('[role=alert]')).toBeNull();
    expect(target.querySelector('[role=status]')?.textContent).toContain('آماده');
  });
  it('keeps FAQ generation disabled until inspect returns page metadata',async()=>{
    const fetcher=vi.fn(async()=>Response.json({fileName:'note.txt',pageCount:2,sourceChars:11}));vi.stubGlobal('fetch',fetcher);
    const target=host();mounted.push(mount(FaqPage,{target}));await settle();
    const submit=target.querySelector<HTMLButtonElement>('button[type=submit]')!;expect(submit.disabled).toBe(true);
    const fileInput=target.querySelector<HTMLInputElement>('input[type=file]')!;const file=new File(['hello world'],'note.txt',{type:'text/plain'});Object.defineProperty(fileInput,'files',{configurable:true,value:[file]});fileInput.dispatchEvent(new Event('change',{bubbles:true}));await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);expect(submit.disabled).toBe(false);expect(target.textContent).toContain('11');
  });
  it('accepts a file dropped on the FAQ picker through the same inspect flow',async()=>{
    const fetcher=vi.fn(async()=>Response.json({fileName:'note.txt',pageCount:2,sourceChars:11}));vi.stubGlobal('fetch',fetcher);
    const target=host();mounted.push(mount(FaqPage,{target}));await settle();
    dropFile(target.querySelector('.file-drop-input')!,new File(['hello world'],'note.txt',{type:'text/plain'}));await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(target.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
  });
});
