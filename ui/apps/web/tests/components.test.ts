// @vitest-environment jsdom
import {afterEach,describe,it,expect} from 'vitest';
import {mount,unmount,tick} from 'svelte';
import TextInput from '../../../packages/ui-core/src/forms/TextInput.svelte';
import EmailInput from '../../../packages/ui-core/src/forms/EmailInput.svelte';
import NumberInput from '../../../packages/ui-core/src/forms/NumberInput.svelte';
import DateInput from '../../../packages/calendar-svelte/src/DateInput.svelte';
import MarkdownView from '../../../packages/ui-core/src/rich-content/MarkdownView.svelte';
import MenuFixture from './MenuFixture.svelte';
import axe from 'axe-core';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const mounted:ReturnType<typeof mount>[]=[];
function host(){const element=document.createElement('div');document.body.append(element);return element;}
afterEach(async()=>{for(const app of mounted.splice(0))await unmount(app);document.body.innerHTML='';});
describe('rendered foundation controls',()=>{
  it('associates a form label and server error with its input',async()=>{
    const target=host();mounted.push(mount(TextInput,{target,props:{id:'name',label:'Name',value:'',onChange:()=>undefined,error:'Required'}}));await tick();
    const input=target.querySelector<HTMLInputElement>('#name');
    expect(target.querySelector('label')?.htmlFor).toBe('name');expect(input?.getAttribute('aria-describedby')).toBe('name-description');expect(target.querySelector('#name-description')?.textContent).toBe('Required');
  });
  it('opens the Jalali grid and closes on Escape with focus restoration',async()=>{
    const target=host();mounted.push(mount(DateInput,{target,props:{id:'due',label:'Due',value:'',today:{calendar:'gregorian',year:2026,month:8,day:10},onChange:()=>undefined}}));await tick();
    const trigger=target.querySelector<HTMLButtonElement>('#due');expect(trigger).not.toBeNull();trigger?.click();await tick();
    const dialog=target.querySelector<HTMLElement>('[role="dialog"]');expect(dialog).not.toBeNull();
    dialog?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();await new Promise(resolve=>setTimeout(resolve,0));
    expect(target.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(trigger);
  });
  it('uses the reviewed Markdown boundary in a real Svelte component',async()=>{
    const target=host();mounted.push(mount(MarkdownView,{target,props:{source:'**safe** <script>alert(1)</script>'}}));await tick();
    expect(target.querySelector('strong')?.textContent).toBe('safe');expect(target.querySelector('script')).toBeNull();
  });
  it('passes basic automated label and ARIA checks for a rendered field',async()=>{
    const target=host();mounted.push(mount(TextInput,{target,props:{id:'accessible-name',label:'Name',value:'',onChange:()=>undefined,help:'Enter a name'}}));await tick();
    const result=await axe.run(target,{runOnly:{type:'rule',values:['label','aria-valid-attr','aria-valid-attr-value']}});
    expect(result.violations).toEqual([]);
  });
  it('applies local direction utilities and Persian numeric presentation without changing values',async()=>{
    const target=host();
    mounted.push(mount(TextInput,{target,props:{id:'rtl-local',label:'RTL',value:'abc',dir:'rtl',onChange:()=>undefined}}));
    mounted.push(mount(EmailInput,{target,props:{id:'email-local',label:'Email',value:'a@example.test',onChange:()=>undefined}}));
    mounted.push(mount(NumberInput,{target,props:{id:'number-local',label:'Count',value:'123',mode:'integer',faNum:true,onChange:()=>undefined}}));
    await tick();
    expect(target.querySelector('#rtl-local')?.classList.contains('rtl')).toBe(true);
    expect(target.querySelector('#email-local')?.classList.contains('ltr')).toBe(true);
    expect(target.querySelector('#email-local')?.getAttribute('dir')).toBe('ltr');
    expect(target.querySelector('#number-local')?.classList.contains('fa-num')).toBe(true);
    expect((target.querySelector('#number-local') as HTMLInputElement).value).toBe('123');
  });
  it('accepts Latin, Persian, and Arabic digits but rejects letters in integer fields',async()=>{
    const changes:string[]=[];const target=host();
    mounted.push(mount(NumberInput,{target,props:{id:'numeric',label:'Count',value:'200',mode:'integer',onChange:next=>changes.push(next)}}));await tick();
    const input=target.querySelector<HTMLInputElement>('#numeric')!;
    input.value='۲۰۵';input.setSelectionRange(2,2);input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('205');expect(input.selectionStart).toBe(2);expect(changes).toEqual(['205']);
    input.value='20a5';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('205');expect(changes).toEqual(['205']);
    input.value='٢٥٠';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('250');expect(changes).toEqual(['205','250']);
    input.value='123';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('123');expect(changes.at(-1)).toBe('123');
  });
  it('keeps decimal precision and IME input valid while normalizing only completed digits',async()=>{
    const changes:string[]=[];const target=host();
    mounted.push(mount(NumberInput,{target,props:{id:'decimal',label:'Amount',value:'',mode:'decimal',scale:2,signed:true,onChange:next=>changes.push(next)}}));await tick();
    const input=target.querySelector<HTMLInputElement>('#decimal')!;
    input.value='-۱۲.۵';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('-12.5');expect(changes).toEqual(['-12.5']);
    input.value='-۱۲.۵۶۷';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(input.value).toBe('-12.5');expect(changes).toEqual(['-12.5']);
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='-٢.٥';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    expect(changes).toEqual(['-12.5']);
    input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await tick();
    expect(input.value).toBe('-2.5');expect(changes).toEqual(['-12.5','-2.5']);
  });
  it('keeps the shared hidden utility a display suppression contract',()=>{
    const stylesheet=readFileSync(join(process.cwd(),'src/lib/styles/main.scss'),'utf8');
    const rule=stylesheet.match(/\.hidden\s*\{[^}]+\}/)?.[0];expect(rule).toContain('display: none !important');
    const style=document.createElement('style');style.textContent=rule!;document.head.append(style);
    try{const element=host();element.className='hidden';expect(getComputedStyle(element).display).toBe('none');}
    finally{style.remove();}
  });
  it('dismisses a reusable menu on outside click, Escape, and selection',async()=>{
    const target=host();mounted.push(mount(MenuFixture,{target}));await tick();
    const menu=target.querySelector<HTMLDetailsElement>('details')!,trigger=target.querySelector<HTMLElement>('summary')!;
    menu.open=true;document.body.click();expect(menu.open).toBe(false);
    menu.open=true;window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(menu.open).toBe(false);expect(document.activeElement).toBe(trigger);
    menu.open=true;target.querySelector<HTMLAnchorElement>('a')!.click();expect(menu.open).toBe(false);
    menu.open=true;target.querySelector<HTMLButtonElement>('[data-menu-close]')!.click();expect(menu.open).toBe(false);
    menu.open=true;target.querySelector<HTMLSelectElement>('select')!.dispatchEvent(new Event('change',{bubbles:true}));expect(menu.open).toBe(false);
  });
});
