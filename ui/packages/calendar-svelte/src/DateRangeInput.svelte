<script lang="ts">
  import {tick} from 'svelte';
  import {addGregorianDays,daysInJalaliMonth,formatGregorianDate,jalaliMonthGrid,parseGregorianDate,shiftJalaliMonth,toGregorian,toJalali,toPersianDigits,JALALI_MONTH_NAMES,type intfGregorianDate} from '@targoman/calendar-core';
  import {englishJalaliMonth,useLocale} from '@targoman/ui-core';
  import CalendarMonth from './CalendarMonth.svelte';
  import {isOutsideCalendarClick} from './dismiss.js';
  import {rowBoundary} from './keyboard.js';
  import {canShiftPickerMonth,pickerDays} from './picker.js';
  import {placeCalendar} from './position.js';
  import './picker.css';

  interface intfProps {id:string;label:string;start:string;end:string;today:intfGregorianDate;onChange:(value:{start:string;end:string})=>void;error?:string;disabled?:boolean;min?:string;max?:string;dir?:'rtl'|'ltr'}
  const i18n=useLocale();
  let {id,label,start,end,today,onChange,error,disabled=false,min,max,dir=i18n.dir}:intfProps=$props();
  let opened=$state(false),visible=$state({year:1400,month:1}),left=$state(8),top=$state(8);
  let draftStart=$state(''),draftEnd=$state(''),preview=$state(''),pickingEnd=$state(false);
  let trigger:HTMLButtonElement,popup=$state<HTMLDivElement>();
  let second=$derived.by(()=>{try{return shiftJalaliMonth(visible.year,visible.month,1);}catch{return null;}});
  const number=(value:number)=>i18n.locale==='fa'?toPersianDigits(value):String(value);
  const monthName=(month:number)=>i18n.locale==='fa'?JALALI_MONTH_NAMES[month-1]:englishJalaliMonth(month);
  function display(date:string){if(!date)return '';const jalali=toJalali(parseGregorianDate(date));return `${number(jalali.day)} ${monthName(jalali.month)} ${number(jalali.year)}`;}
  function position(){if(!opened||!popup||!trigger)return;const next=placeCalendar(trigger.getBoundingClientRect(),popup.offsetWidth||640,popup.offsetHeight||390,window.innerWidth,window.innerHeight,dir);left=next.left;top=next.top;}
  async function open(){if(opened){close();return;}const initial=toJalali(start?parseGregorianDate(start):today);visible={year:initial.year,month:initial.month};draftStart=start;draftEnd=end;preview='';pickingEnd=false;opened=true;await tick();position();focusDate(start||formatGregorianDate(today));}
  async function close(restore=true){opened=false;preview='';await tick();if(restore)trigger?.focus();}
  function outside(event:MouseEvent){if(opened&&isOutsideCalendarClick(event,popup,trigger))close(false);}
  function focusDate(date:string){popup?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus({preventScroll:true});}
  function choose(date:string){
    if(!pickingEnd){draftStart=date;draftEnd='';preview=date;pickingEnd=true;onChange({start:date,end:''});return;}
    const nextStart=date<draftStart?date:draftStart,nextEnd=date<draftStart?draftStart:date;
    draftStart=nextStart;draftEnd=nextEnd;pickingEnd=false;onChange({start:nextStart,end:nextEnd});close();
  }
  async function shift(delta:number,focus?:string){if(!canShiftPickerMonth(visible.year,visible.month,delta,min,max))return;visible=shiftJalaliMonth(visible.year,visible.month,delta);await tick();position();if(focus)focusDate(focus);}
  async function jump(year:number,month:number,secondMonth=false){
    let target={year,month};
    if(secondMonth){try{target=shiftJalaliMonth(year,month,-1);}catch{target={year,month};}}
    visible=target;await tick();position();
  }
  function hover(date:string){if(pickingEnd)preview=date;}
  async function keyboard(event:KeyboardEvent){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    const raw=(event.target as HTMLElement).dataset.date;if(!raw)return;
    const current=toJalali(parseGregorianDate(raw));const grid=jalaliMonthGrid(current.year,current.month);
    if(event.key==='Home'||event.key==='End'){
      event.preventDefault();const day=rowBoundary(current.day,grid.offset,grid.days.length,event.key);focusDate(pickerDays(current.year,current.month).days[day-1]!.date);return;
    }
    if(event.key==='PageUp'||event.key==='PageDown'){
      event.preventDefault();const next=shiftJalaliMonth(current.year,current.month,event.key==='PageUp'?-1:1);const day=Math.min(current.day,daysInJalaliMonth(next.year,next.month));const date=formatGregorianDate(toGregorian({calendar:'jalali',year:next.year,month:next.month,day}));await shift(event.key==='PageUp'?-1:1,date);return;
    }
    const delta:Record<string,number>={ArrowLeft:dir==='rtl'?1:-1,ArrowRight:dir==='rtl'?-1:1,ArrowDown:7,ArrowUp:-7};if(!(event.key in delta))return;
    event.preventDefault();const date=formatGregorianDate(addGregorianDays(parseGregorianDate(raw),delta[event.key]));
    if(min&&date<min||max&&date>max)return;
    const target=toJalali(parseGregorianDate(date));
    if(target.year!==current.year||target.month!==current.month){
      const step=date<raw?-1:1;if(target.year!==visible.year||target.month!==visible.month)await shift(step,date);else focusDate(date);
    }else focusDate(date);
  }
  function clear(){draftStart='';draftEnd='';preview='';pickingEnd=false;onChange({start:'',end:''});close();}
</script>
<svelte:window onclick={outside} onresize={position} onscroll={position} />
<div class="mb-3"><label class="form-label" for={id}>{label}</label><button bind:this={trigger} {id} type="button" class="form-control calendar-trigger" class:fa-num={i18n.locale==='fa'} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} aria-haspopup="dialog" aria-expanded={opened} aria-describedby={error?`${id}-error`:undefined} {disabled} onclick={open}><span>{start?`${display(start)}${end?` — ${display(end)}`:' …'}`:i18n.t('chooseRange')}</span><i class="fa-regular fa-calendar-days calendar-trigger-icon" aria-hidden="true"></i></button>{#if error}<div id={`${id}-error`} class="invalid-feedback d-block" role="alert">{error}</div>{/if}</div>
{#if opened}<div bind:this={popup} class="calendar-popover range-popover" class:fa-num={i18n.locale==='fa'} {dir} role="dialog" aria-label={label} tabindex="-1" style:left={`${left}px`} style:top={`${top}px`} onkeydown={keyboard}><div class="calendar-months"><CalendarMonth year={visible.year} month={visible.month} today={formatGregorianDate(today)} {dir} start={draftStart} end={draftEnd} preview={pickingEnd?preview:undefined} {min} {max} canPrevious={canShiftPickerMonth(visible.year,visible.month,-1,min,max)} canNext={canShiftPickerMonth(visible.year,visible.month,1,min,max)} onChoose={choose} onMove={delta=>shift(delta)} onNavigate={(year,month)=>jump(year,month)} onViewChange={position} onHover={hover} />{#if second}<div class="range-month-secondary"><CalendarMonth year={second.year} month={second.month} today={formatGregorianDate(today)} {dir} start={draftStart} end={draftEnd} preview={pickingEnd?preview:undefined} {min} {max} canPrevious={canShiftPickerMonth(visible.year,visible.month,-1,min,max)} canNext={canShiftPickerMonth(visible.year,visible.month,1,min,max)} onChoose={choose} onMove={delta=>shift(delta)} onNavigate={(year,month)=>jump(year,month,true)} onViewChange={position} onHover={hover} /></div>{/if}</div><div class="calendar-footer"><span>{pickingEnd?i18n.t('selectEnd'):i18n.t('chooseRange')}</span><div><button type="button" class="btn btn-link btn-sm" onclick={clear}>{i18n.t('clearRange')}</button><button type="button" class="btn btn-link btn-sm" onclick={()=>close()}>{i18n.t('close')}</button></div></div></div>{/if}
