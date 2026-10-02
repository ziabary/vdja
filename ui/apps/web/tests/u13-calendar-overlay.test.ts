// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import {formatGregorianDate,toGregorian} from '@targoman/calendar-core';
import DateInput from '../../../packages/calendar-svelte/src/DateInput.svelte';
import {isOutsideCalendarClick} from '../../../packages/calendar-svelte/src/dismiss.js';
import DateRangeInput from '../../../packages/calendar-svelte/src/DateRangeInput.svelte';
import {placeCalendar} from '../../../packages/calendar-svelte/src/position.js';
import OverlayFixture from './OverlayFixture.svelte';

const mounted:ReturnType<typeof mount>[]=[];
const today=toGregorian({calendar:'jalali',year:1405,month:2,day:9});
function host(){const target=document.createElement('div');document.body.append(target);return target;}
async function settle(){await tick();await new Promise(resolve=>setTimeout(resolve,0));}
afterEach(async()=>{for(const component of mounted.splice(0))await unmount(component);document.body.innerHTML='';});

it('keeps a selector open when its clicked button is replaced before the window click handler',()=>{
  const popup=document.createElement('div'),button=document.createElement('button'),trigger=document.createElement('button');
  popup.append(button);document.body.append(popup,trigger);
  let result=true;
  button.addEventListener('click',()=>button.remove());
  window.addEventListener('click',event=>{
    expect(popup.contains(event.target as Node)).toBe(false);
    result=isOutsideCalendarClick(event,popup,trigger);
  },{once:true});
  button.click();
  expect(result).toBe(false);
  window.addEventListener('click',event=>{result=isOutsideCalendarClick(event,popup,trigger);},{once:true});
  document.body.click();
  expect(result).toBe(true);
});

it('clamps a calendar within a short viewport even when its trigger is below the fold',()=>{
  const placed=placeCalendar({left:28,right:347,top:777,bottom:819},374,362,390,680,'rtl');
  expect(placed).toEqual({left:8,top:310});
});

describe('single-panel Jalali range selection',()=>{
  it('chooses a range across adjacent months and highlights the interval',async()=>{
    const changes:{start:string;end:string}[]=[];const target=host();
    mounted.push(mount(DateRangeInput,{target,props:{id:'range',label:'بازه',start:'',end:'',today,onChange:value=>changes.push(value)}}));await settle();
    expect(target.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(1);
    target.querySelector<HTMLButtonElement>('#range')?.click();await settle();
    expect(target.querySelectorAll('.calendar-month')).toHaveLength(2);
    const start=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:28}));
    const end=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:3,day:3}));
    target.querySelector<HTMLButtonElement>(`[data-date="${start}"]`)?.click();await settle();
    expect(changes.at(-1)).toEqual({start,end:''});
    expect(target.querySelector('[role="dialog"]')).not.toBeNull();
    target.querySelector<HTMLButtonElement>(`[data-date="${end}"]`)?.dispatchEvent(new Event('pointerenter'));
    await settle();
    const middle=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:3,day:1}));
    expect(target.querySelector(`[data-date="${middle}"]`)?.classList.contains('in-range')).toBe(true);
    target.querySelector<HTMLButtonElement>(`[data-date="${end}"]`)?.click();await settle();
    expect(changes.at(-1)).toEqual({start,end});
    expect(target.querySelector('[role="dialog"]')).toBeNull();
  });
  it('sorts a reverse second click into canonical start/end values',async()=>{
    const changes:{start:string;end:string}[]=[];const target=host();
    mounted.push(mount(DateRangeInput,{target,props:{id:'range-reverse',label:'بازه',start:'',end:'',today,onChange:value=>changes.push(value)}}));await settle();
    target.querySelector<HTMLButtonElement>('#range-reverse')?.click();await settle();
    const earlier=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:8}));
    const later=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:21}));
    target.querySelector<HTMLButtonElement>(`[data-date="${later}"]`)?.click();await settle();
    target.querySelector<HTMLButtonElement>(`[data-date="${earlier}"]`)?.click();await settle();
    expect(changes.at(-1)).toEqual({start:earlier,end:later});
  });
});

describe('direct Jalali month and year navigation',()=>{
  it('jumps to a typed year and selected month before choosing a single date',async()=>{
    const changes:string[]=[];const target=host();
    mounted.push(mount(DateInput,{target,props:{id:'quick-date',label:'تاریخ',value:'',today,onChange:value=>changes.push(value)}}));await settle();
    target.querySelector<HTMLButtonElement>('#quick-date')?.click();await settle();
    target.querySelector<HTMLButtonElement>('[aria-label="انتخاب سال"]')?.click();await settle();
    const yearInput=target.querySelector<HTMLInputElement>('[aria-label="سال جلالی"]')!;
    yearInput.value='۱۳۸۵';yearInput.dispatchEvent(new Event('input',{bubbles:true}));
    target.querySelector<HTMLButtonElement>('[aria-label="رفتن به سال"]')?.click();await settle();
    expect(target.querySelector('.calendar-month')?.textContent).toContain('۱۳۸۵');
    target.querySelector<HTMLButtonElement>('[aria-label="انتخاب ماه"]')?.click();await settle();
    target.querySelector<HTMLButtonElement>('[data-month="9"]')?.click();await settle();
    expect(target.querySelector('.calendar-month')?.textContent).toContain('آذر');
    target.querySelector<HTMLButtonElement>('[data-day="12"]')?.click();await settle();
    expect(changes.at(-1)).toBe(formatGregorianDate(toGregorian({calendar:'jalali',year:1385,month:9,day:12})));
  });
  it('retains a draft range while navigating the second month to another year',async()=>{
    const changes:{start:string;end:string}[]=[];const target=host();
    mounted.push(mount(DateRangeInput,{target,props:{id:'quick-range',label:'بازه',start:'',end:'',today,onChange:value=>changes.push(value)}}));await settle();
    target.querySelector<HTMLButtonElement>('#quick-range')?.click();await settle();
    const start=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:9}));
    target.querySelector<HTMLButtonElement>(`[data-date="${start}"]`)?.click();await settle();
    const second=target.querySelectorAll('.calendar-month')[1]!;
    second.querySelector<HTMLButtonElement>('[aria-label="انتخاب سال"]')?.click();await settle();
    second.querySelector<HTMLButtonElement>('[data-year="1406"]')?.click();await settle();
    expect(target.querySelectorAll('.calendar-month')[1]?.textContent).toContain('۱۴۰۶');
    const end=formatGregorianDate(toGregorian({calendar:'jalali',year:1406,month:3,day:3}));
    target.querySelector<HTMLButtonElement>(`[data-date="${end}"]`)?.click();await settle();
    expect(changes.at(-1)).toEqual({start,end});
  });
  it('disables years and months outside date bounds and rejects an invalid year entry',async()=>{
    const target=host();
    const min=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:4,day:10}));
    const max=formatGregorianDate(toGregorian({calendar:'jalali',year:1406,month:2,day:5}));
    mounted.push(mount(DateInput,{target,props:{id:'bounded-date',label:'تاریخ',value:'',today,min,max,onChange:()=>undefined}}));await settle();
    target.querySelector<HTMLButtonElement>('#bounded-date')?.click();await settle();
    target.querySelector<HTMLButtonElement>('[aria-label="انتخاب ماه"]')?.click();await settle();
    expect(target.querySelector<HTMLButtonElement>('[data-month="3"]')?.disabled).toBe(true);
    expect(target.querySelector<HTMLButtonElement>('[data-month="4"]')?.disabled).toBe(false);
    target.querySelector<HTMLButtonElement>('[aria-label="بازگشت به تقویم"]')?.click();await settle();
    target.querySelector<HTMLButtonElement>('[aria-label="انتخاب سال"]')?.click();await settle();
    expect(target.querySelector<HTMLButtonElement>('[data-year="1404"]')?.disabled).toBe(true);
    const input=target.querySelector<HTMLInputElement>('[aria-label="سال جلالی"]')!;
    input.value='۱۷۰۰';input.dispatchEvent(new Event('input',{bubbles:true}));
    target.querySelector<HTMLButtonElement>('[aria-label="رفتن به سال"]')?.click();await settle();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('خارج از بازه');
    expect(target.querySelector('.year-choice-grid')).not.toBeNull();
  });
});

describe('single-date Today action',()=>{
  it('selects the supplied today value and closes the calendar',async()=>{
    const changes:string[]=[];const target=host();
    const previous=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:1,day:5}));
    mounted.push(mount(DateInput,{target,props:{id:'today-date',label:'تاریخ',value:previous,today,onChange:value=>changes.push(value)}}));await settle();
    const trigger=target.querySelector<HTMLButtonElement>('#today-date')!;
    trigger.click();await settle();
    const action=target.querySelector<HTMLButtonElement>('[data-action="select-today"]')!;
    expect(action.textContent).toBe('امروز');
    action.click();await settle();
    expect(changes).toEqual([formatGregorianDate(today)]);
    expect(target.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('disables Today when it is outside the allowed date range',async()=>{
    const changes:string[]=[];const target=host();
    const min=formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:2,day:10}));
    mounted.push(mount(DateInput,{target,props:{id:'today-bounded',label:'تاریخ',value:'',today,min,onChange:value=>changes.push(value)}}));await settle();
    target.querySelector<HTMLButtonElement>('#today-bounded')?.click();await settle();
    const action=target.querySelector<HTMLButtonElement>('[data-action="select-today"]')!;
    expect(action.disabled).toBe(true);
    action.click();await settle();
    expect(changes).toHaveLength(0);
    expect(target.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

it('keeps overlays fixed in the viewport and restores background scrolling',async()=>{
  const prototype=HTMLDialogElement.prototype;const show=prototype.showModal,close=prototype.close;
  prototype.showModal=function(){this.setAttribute('open','');};
  prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
  const originalOverflow=document.documentElement.style.overflow;
  try{
    const target=host();mounted.push(mount(OverlayFixture,{target}));await settle();
    target.querySelector<HTMLButtonElement>('#open-dialog')?.click();await settle();
    const dialog=target.querySelector<HTMLDialogElement>('[aria-labelledby="test-dialog-title"]')!;
    expect(dialog.open).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await settle();
    expect(dialog.open).toBe(false);expect(document.documentElement.style.overflow).toBe(originalOverflow);
    target.querySelector<HTMLButtonElement>('#open-drawer')?.click();await settle();
    const drawer=target.querySelector<HTMLDialogElement>('[aria-labelledby="test-drawer-title"]')!;
    expect(drawer.open).toBe(true);
  }finally{for(const component of mounted.splice(0))await unmount(component);prototype.showModal=show;prototype.close=close;document.documentElement.style.overflow=originalOverflow;}
});
