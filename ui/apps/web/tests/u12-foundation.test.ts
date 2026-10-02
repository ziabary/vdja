// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createLocale,transitionAiOperation} from '@targoman/ui-core';
import OverlayFixture from './OverlayFixture.svelte';
import DateInput from '../../../packages/calendar-svelte/src/DateInput.svelte';
import {monthArrow,rowBoundary} from '../../../packages/calendar-svelte/src/keyboard.js';
import {jalaliMonthGrid,toGregorian,formatGregorianDate} from '@targoman/calendar-core';
import {requireDevelopmentShowcase} from '../src/lib/server/showcase.js';

const mounted:ReturnType<typeof mount>[]=[];
function host(){const target=document.createElement('div');document.body.append(target);return target;}
afterEach(async()=>{for(const component of mounted.splice(0))await unmount(component);document.body.innerHTML='';});

describe('U1.2 locale and development boundaries',()=>{
  it('defaults to Persian, with complete typed English shell and shared messages',()=>{
    const fa=createLocale('fa'),en=createLocale('en');
    expect(fa.dir).toBe('rtl');expect(en.dir).toBe('ltr');
    expect(fa.t('home')).toBe('خانه');expect(en.t('home')).toBe('Home');
    expect(fa.t('chooseDate')).toBe('انتخاب تاریخ');expect(en.t('chooseDate')).toBe('Choose date');
  });
  it('protects the showcase on the server and keeps its production load guarded',()=>{
    expect(()=>requireDevelopmentShowcase(true)).not.toThrow();
    expect(()=>requireDevelopmentShowcase(false)).toThrow();
    const source=readFileSync(join(process.cwd(),'src/routes/(public)/foundation/+page.server.ts'),'utf8');
    expect(source).toContain('requireDevelopmentShowcase(import.meta.env.DEV)');
  });
  it('declares one root Web command and preserves optional API and legacy commands',()=>{
    const root=JSON.parse(readFileSync(join(process.cwd(),'../../package.json'),'utf8')) as {scripts:Record<string,string>};
    expect(root.scripts.dev).toContain('dev:web');expect(root.scripts['dev:api']).toContain('sdev');
    expect(root.scripts.sdev).toBeTruthy();expect(root.scripts['lint:watch']).toBeTruthy();
  });
});

describe('calendar row navigation and direction',()=>{
  it('mirrors semantic month arrows in RTL and LTR',()=>{
    expect(monthArrow('rtl','previous')).toBe('fa-arrow-right');expect(monthArrow('rtl','next')).toBe('fa-arrow-left');
    expect(monthArrow('ltr','previous')).toBe('fa-arrow-left');expect(monthArrow('ltr','next')).toBe('fa-arrow-right');
  });
  it('accounts for different real first weekday offsets at both row boundaries',()=>{
    const samples:ReturnType<typeof jalaliMonthGrid>[]=[];
    for(let month=1;month<=12;month++){const grid=jalaliMonthGrid(1405,month);if(!samples.some(sample=>sample.offset===grid.offset))samples.push(grid);if(samples.length===3)break;}
    expect(samples.length).toBe(3);
    for(const grid of samples)for(const day of [1,3,9,grid.days.length]){
      const column=(grid.offset+day-1)%7;
      expect(rowBoundary(day,grid.offset,grid.days.length,'Home')).toBe(Math.max(1,day-column));
      expect(rowBoundary(day,grid.offset,grid.days.length,'End')).toBe(Math.min(grid.days.length,day+6-column));
    }
  });
  it.each(['rtl','ltr'] as const)('renders %s arrows, accessible labels, and Home/End focus',async dir=>{
    const target=host();const date=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:9}));
    mounted.push(mount(DateInput,{target,props:{id:'calendar',label:'تقویم',value:date,today:{calendar:'gregorian',year:2026,month:10,day:2},dir,onChange:()=>undefined}}));await tick();
    target.querySelector<HTMLButtonElement>('#calendar')?.click();await tick();await new Promise(resolve=>setTimeout(resolve,0));
    const previous=target.querySelector<HTMLButtonElement>('[aria-label="ماه پیش"]'),next=target.querySelector<HTMLButtonElement>('[aria-label="ماه بعد"]');
    expect(previous?.querySelector('i')?.classList.contains(monthArrow(dir,'previous'))).toBe(true);
    expect(next?.querySelector('i')?.classList.contains(monthArrow(dir,'next'))).toBe(true);
    const grid=jalaliMonthGrid(1405,2),day=target.querySelector<HTMLButtonElement>('[data-day="9"]');
    day?.focus();day?.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));await tick();
    expect(document.activeElement?.getAttribute('data-day')).toBe(String(rowBoundary(9,grid.offset,grid.days.length,'Home')));
    day?.focus();day?.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await tick();
    expect(document.activeElement?.getAttribute('data-day')).toBe(String(rowBoundary(9,grid.offset,grid.days.length,'End')));
    const dialog=target.querySelector<HTMLElement>('[role="dialog"]');dialog?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();await new Promise(resolve=>setTimeout(resolve,0));
    expect(target.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(target.querySelector('#calendar'));
  });
});

it('uses legal AI state transitions for each visual terminal branch',()=>{
  for(const terminal of ['FAILED','CANCELLED','INTERRUPTED','UNRESOLVED'] as const){
    const event={FAILED:'FAIL',CANCELLED:'CANCEL_ACK',INTERRUPTED:'INTERRUPT',UNRESOLVED:'OUTCOME_UNKNOWN'}[terminal] as 'FAIL'|'CANCEL_ACK'|'INTERRUPT'|'OUTCOME_UNKNOWN';
    expect(transitionAiOperation(transitionAiOperation('IDLE','SUBMIT'),event)).toBe(terminal);
  }
  expect(transitionAiOperation(transitionAiOperation(transitionAiOperation(transitionAiOperation('IDLE','SUBMIT'),'STREAM_START'),'TERMINAL_SUCCESS'),'CONFIRM_RESULT')).toBe('SUCCEEDED');
});
it('enters and restores focus for Dialog and Drawer on close and Escape',async()=>{
  const prototype=HTMLDialogElement.prototype;
  const show=prototype.showModal,close=prototype.close;
  prototype.showModal=function(){this.setAttribute('open','');};
  prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
  try{
    const target=host();mounted.push(mount(OverlayFixture,{target}));await tick();
    for(const [openerId,dialogId] of [['open-dialog','test-dialog'],['open-drawer','test-drawer']] as const){
      const opener=target.querySelector<HTMLButtonElement>(`#${openerId}`)!;opener.focus();opener.click();await tick();await new Promise(resolve=>setTimeout(resolve,0));
      const dialog=target.querySelector<HTMLDialogElement>(`[aria-labelledby="${dialogId}-title"]`)!;expect(dialog.open).toBe(true);
      expect(dialog.contains(document.activeElement)).toBe(true);
      dialog.dispatchEvent(new Event('cancel',{bubbles:true,cancelable:true}));await tick();await new Promise(resolve=>setTimeout(resolve,0));
      expect(dialog.open).toBe(false);expect(document.activeElement).toBe(opener);
    }
  }finally{prototype.showModal=show;prototype.close=close;}
});
