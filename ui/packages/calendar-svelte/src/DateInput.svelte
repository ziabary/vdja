<script lang="ts">
  import {tick} from 'svelte';
  import {formatGregorianDate,jalaliMonthGrid,parseGregorianDate,shiftJalaliMonth,toJalali,toPersianDigits,JALALI_MONTH_NAMES,type intfGregorianDate} from '@targoman/calendar-core';
  import {englishJalaliMonth,useLocale} from '@targoman/ui-core';
  import CalendarMonth from './CalendarMonth.svelte';
  import {isOutsideCalendarClick} from './dismiss.js';
  import {rowBoundary} from './keyboard.js';
  import {canShiftPickerMonth} from './picker.js';
  import {placeCalendar} from './position.js';
  import './picker.css';

  interface intfProps {id:string;label:string;value:string;today:intfGregorianDate;onChange:(value:string)=>void;error?:string;disabled?:boolean;min?:string;max?:string;dir?:'rtl'|'ltr'}
  const i18n=useLocale();
  let {id,label,value,today,onChange,error,disabled=false,min,max,dir=i18n.dir}:intfProps=$props();
  let opened=$state(false),visible=$state({year:1400,month:1,day:1}),left=$state(8),top=$state(8);
  let trigger:HTMLButtonElement,popup=$state<HTMLDivElement>();
  let grid=$derived(jalaliMonthGrid(visible.year,visible.month));
  let selected=$derived(value?toJalali(parseGregorianDate(value)):null);
  let todayDate=$derived(formatGregorianDate(today));
  let todayAllowed=$derived((!min||todayDate>=min)&&(!max||todayDate<=max));
  const number=(value:number)=>i18n.locale==='fa'?toPersianDigits(value):String(value);
  const monthName=(month:number)=>i18n.locale==='fa'?JALALI_MONTH_NAMES[month-1]:englishJalaliMonth(month);
  function position(){if(!opened||!popup||!trigger)return;const next=placeCalendar(trigger.getBoundingClientRect(),popup.offsetWidth||316,popup.offsetHeight||360,window.innerWidth,window.innerHeight,dir);left=next.left;top=next.top;}
  async function open(){if(opened){close();return;}const initial=value?toJalali(parseGregorianDate(value)):toJalali(today);visible={year:initial.year,month:initial.month,day:initial.day};opened=true;await tick();position();focusDay(initial.day);}
  async function close(restore=true){opened=false;await tick();if(restore)trigger?.focus();}
  function outside(event:MouseEvent){if(opened&&isOutsideCalendarClick(event,popup,trigger))close(false);}
  function focusDay(day:number){popup?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus({preventScroll:true});}
  function choose(date:string){onChange(date);close();}
  async function shift(delta:number,target?:number){if(!canShiftPickerMonth(visible.year,visible.month,delta,min,max))return;const next=shiftJalaliMonth(visible.year,visible.month,delta);visible={year:next.year,month:next.month,day:1};await tick();position();focusDay(Math.max(1,Math.min(jalaliMonthGrid(next.year,next.month).days.length,target??1)));}
  async function jump(year:number,month:number){visible={year,month,day:1};await tick();position();}
  async function keyboard(event:KeyboardEvent){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    const day=Number((event.target as HTMLElement).dataset.day);if(!day)return;
    if(event.key==='Home'||event.key==='End'){event.preventDefault();focusDay(rowBoundary(day,grid.offset,grid.days.length,event.key));return;}
    if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();await shift(event.key==='PageUp'?-1:1,day);return;}
    const delta:Record<string,number>={ArrowLeft:dir==='rtl'?1:-1,ArrowRight:dir==='rtl'?-1:1,ArrowDown:7,ArrowUp:-7};
    if(!(event.key in delta))return;event.preventDefault();const next=day+delta[event.key];
    if(next<1){const previous=shiftJalaliMonth(visible.year,visible.month,-1);await shift(-1,jalaliMonthGrid(previous.year,previous.month).days.length+next);return;}
    if(next>grid.days.length){await shift(1,next-grid.days.length);return;}
    focusDay(next);
  }
</script>
<svelte:window onclick={outside} onresize={position} onscroll={position} />
<div class="mb-3"><label class="form-label" for={id}>{label}</label><div class="calendar-input-shell"><button bind:this={trigger} {id} type="button" class="form-control calendar-trigger" class:fa-num={i18n.locale==='fa'} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} aria-label={value?undefined:i18n.t('chooseDate')} aria-haspopup="dialog" aria-expanded={opened} aria-describedby={error?`${id}-error`:undefined} {disabled} onclick={open}><span>{value?`${number(selected!.day)} ${monthName(selected!.month)} ${number(selected!.year)}`:''}</span><i class="fa-regular fa-calendar-days calendar-trigger-icon" aria-hidden="true"></i></button>{#if !value}<button type="button" class="btn btn-link btn-sm calendar-empty-today" data-action="empty-select-today" disabled={disabled||!todayAllowed} onclick={()=>choose(todayDate)}>{i18n.t('today')}</button>{/if}</div>{#if error}<div id={`${id}-error`} class="invalid-feedback d-block" role="alert">{error}</div>{/if}</div>
{#if opened}<div bind:this={popup} class="calendar-popover" class:fa-num={i18n.locale==='fa'} {dir} role="dialog" aria-label={label} tabindex="-1" style:left={`${left}px`} style:top={`${top}px`} onkeydown={keyboard}><CalendarMonth year={visible.year} month={visible.month} today={todayDate} {dir} selected={value} {min} {max} canPrevious={canShiftPickerMonth(visible.year,visible.month,-1,min,max)} canNext={canShiftPickerMonth(visible.year,visible.month,1,min,max)} onChoose={choose} onMove={delta=>shift(delta)} onNavigate={jump} onViewChange={position} /><div class="calendar-footer"><button type="button" class="btn btn-link btn-sm" data-action="select-today" disabled={!todayAllowed} onclick={()=>choose(todayDate)}>{i18n.t('today')}</button><button type="button" class="btn btn-link btn-sm" onclick={()=>close()}>{i18n.t('close')}</button></div></div>{/if}
