<script lang="ts">
  import {tick} from 'svelte';
  import {JALALI_MAX_YEAR,JALALI_MIN_YEAR,JALALI_MONTH_NAMES,normalizeDateDigits,toPersianDigits} from '@targoman/calendar-core';
  import {englishJalaliMonth,useLocale} from '@targoman/ui-core';
  import {monthArrow} from './keyboard.js';
  import {canShowPickerMonth,canShowPickerYear,pickerDays} from './picker.js';

  interface intfProps {
    year:number;month:number;today:string;dir:'rtl'|'ltr';
    selected?:string;start?:string;end?:string;preview?:string;min?:string;max?:string;
    canPrevious?:boolean;canNext?:boolean;
    onChoose:(date:string)=>void;onMove:(delta:number)=>void;
    onNavigate:(year:number,month:number)=>void|Promise<void>;
    onViewChange?:()=>void;onHover?:(date:string)=>void;
  }
  let {year,month,today,dir,selected,start,end,preview,min,max,canPrevious=true,canNext=true,onChoose,onMove,onNavigate,onViewChange,onHover}:intfProps=$props();
  const i18n=useLocale();
  const YEAR_PAGE_SIZE=12;
  const FIRST_YEAR_PAGE=Math.floor(JALALI_MIN_YEAR/YEAR_PAGE_SIZE)*YEAR_PAGE_SIZE;
  const LAST_YEAR_PAGE=Math.floor(JALALI_MAX_YEAR/YEAR_PAGE_SIZE)*YEAR_PAGE_SIZE;
  let panel=$state<'days'|'months'|'years'>('days');
  let yearPage=$state(0);
  let yearInput=$state('');
  let yearError=$state(false);
  let container:HTMLDivElement;
  let view=$derived(pickerDays(year,month));
  let years=$derived(Array.from({length:YEAR_PAGE_SIZE},(_,index)=>yearPage+index));
  let rangeStart=$derived(start&&(!end&&preview&&preview<start?preview:start));
  let rangeEnd=$derived(end||(!end&&preview&&start?(preview>start?preview:start):undefined));
  const number=(value:number)=>i18n.locale==='fa'?toPersianDigits(value):String(value);
  const monthName=(value:number)=>i18n.locale==='fa'?JALALI_MONTH_NAMES[value-1]:englishJalaliMonth(value);
  const weekdays=['saturday','sunday','monday','tuesday','wednesday','thursday','friday'] as const;

  async function showPanel(next:'days'|'months'|'years'){
    panel=next;yearError=false;
    if(next==='years'){yearPage=Math.floor(year/YEAR_PAGE_SIZE)*YEAR_PAGE_SIZE;yearInput='';}
    await tick();onViewChange?.();
    const selector=next==='months'?'.month-option[aria-pressed="true"]':next==='years'?'.year-option[aria-pressed="true"]':'.day:not(:disabled)';
    container.querySelector<HTMLButtonElement>(selector)?.focus({preventScroll:true});
  }
  async function changeYearPage(delta:number){
    const next=yearPage+delta*YEAR_PAGE_SIZE;
    if(next<FIRST_YEAR_PAGE||next>LAST_YEAR_PAGE)return;
    yearPage=next;await tick();onViewChange?.();
    container.querySelector<HTMLButtonElement>('.year-option:not(:disabled)')?.focus({preventScroll:true});
  }
  async function jump(nextYear:number,nextMonth:number){
    if(!canShowPickerMonth(nextYear,nextMonth,min,max))return;
    panel='days';yearError=false;
    await onNavigate(nextYear,nextMonth);
    await tick();onViewChange?.();
    container.querySelector<HTMLButtonElement>('.day:not(:disabled)')?.focus({preventScroll:true});
  }
  async function chooseYear(nextYear:number){
    if(!canShowPickerYear(nextYear,min,max))return;
    const available=Array.from({length:12},(_,index)=>index+1).filter(candidate=>canShowPickerMonth(nextYear,candidate,min,max));
    if(available.length===0){yearError=true;return;}
    const nextMonth=available.reduce((best,candidate)=>Math.abs(candidate-month)<Math.abs(best-month)?candidate:best,available[0]!);
    await jump(nextYear,nextMonth);
  }
  function submitYear(){
    const normalized=normalizeDateDigits(yearInput.trim());
    const value=Number(normalized);
    if(!/^\d{4}$/.test(normalized)||!canShowPickerYear(value,min,max)){yearError=true;void tick().then(()=>onViewChange?.());return;}
    void chooseYear(value);
  }
</script>
<div bind:this={container} class="calendar-month" {dir}>
  {#if panel==='days'}
    <header class="month-heading">
      <button type="button" class="month-nav" aria-label={i18n.t('previousMonth')} disabled={!canPrevious} onclick={()=>onMove(-1)}><i class={`fa-solid ${monthArrow(dir,'previous')}`} aria-hidden="true"></i></button>
      <div class="heading-pickers"><button type="button" class="heading-picker" aria-label={i18n.t('selectMonth')} onclick={()=>showPanel('months')}>{monthName(month)}</button><button type="button" class="heading-picker" aria-label={i18n.t('selectYear')} onclick={()=>showPanel('years')}>{number(year)}</button></div>
      <button type="button" class="month-nav" aria-label={i18n.t('nextMonth')} disabled={!canNext} onclick={()=>onMove(1)}><i class={`fa-solid ${monthArrow(dir,'next')}`} aria-hidden="true"></i></button>
    </header>
    <div class="month-grid">{#each weekdays as weekday}<span class="weekday" aria-hidden="true">{i18n.t(weekday)}</span>{/each}{#each Array(view.offset) as _}<span aria-hidden="true"></span>{/each}{#each view.days as item (item.date)}<button type="button" class="day" data-day={item.day} data-date={item.date} disabled={!!min&&item.date<min||!!max&&item.date>max} class:today={item.date===today} class:selected={item.date===selected||item.date===start||item.date===end} class:in-range={!!rangeStart&&!!rangeEnd&&item.date>=rangeStart&&item.date<=rangeEnd} class:range-edge={item.date===rangeStart||item.date===rangeEnd} aria-label={`${number(item.day)} ${monthName(month)} ${number(year)}`} aria-pressed={item.date===selected||item.date===start||item.date===end} tabindex={item.date===selected||item.date===start?0:-1} onfocus={()=>onHover?.(item.date)} onpointerenter={()=>onHover?.(item.date)} onclick={()=>onChoose(item.date)}>{number(item.day)}</button>{/each}</div>
  {:else if panel==='months'}
    <header class="month-heading"><button type="button" class="month-nav" aria-label={i18n.t('backToCalendar')} onclick={()=>showPanel('days')}><i class={`fa-solid ${monthArrow(dir,'previous')}`} aria-hidden="true"></i></button><strong>{i18n.t('selectMonth')} · {number(year)}</strong><span class="nav-spacer" aria-hidden="true"></span></header>
    <div class="choice-grid month-choice-grid">{#each JALALI_MONTH_NAMES as _,index}<button type="button" class="choice month-option" data-month={index+1} aria-pressed={index+1===month} disabled={!canShowPickerMonth(year,index+1,min,max)} onclick={()=>jump(year,index+1)}>{monthName(index+1)}</button>{/each}</div>
  {:else}
    <header class="month-heading year-heading"><button type="button" class="month-nav" aria-label={i18n.t('previousYears')} disabled={yearPage<=FIRST_YEAR_PAGE} onclick={()=>changeYearPage(-1)}><i class={`fa-solid ${monthArrow(dir,'previous')}`} aria-hidden="true"></i></button><div class="year-heading-copy"><span>{i18n.t('selectYear')}</span><strong>{number(yearPage)}–{number(Math.min(yearPage+YEAR_PAGE_SIZE-1,JALALI_MAX_YEAR))}</strong></div><button type="button" class="month-nav" aria-label={i18n.t('nextYears')} disabled={yearPage>=LAST_YEAR_PAGE} onclick={()=>changeYearPage(1)}><i class={`fa-solid ${monthArrow(dir,'next')}`} aria-hidden="true"></i></button></header>
    <div class="choice-grid year-choice-grid">{#each years as option}<button type="button" class="choice year-option" data-year={option} aria-pressed={option===year} disabled={!canShowPickerYear(option,min,max)} onclick={()=>chooseYear(option)}>{number(option)}</button>{/each}</div>
    <div class="year-entry"><label>{i18n.t('jalaliYear')}<input type="text" inputmode="numeric" autocomplete="off" maxlength="4" placeholder={number(year)} aria-label={i18n.t('jalaliYear')} aria-invalid={yearError} bind:value={yearInput} oninput={()=>yearError=false} onkeydown={event=>{if(event.key==='Enter'){event.preventDefault();submitYear();}}} /></label><button type="button" class="year-submit" aria-label={i18n.t('goToYear')} onclick={submitYear}>{i18n.t('go')}</button>{#if yearError}<span class="year-error" role="alert">{i18n.t('invalidYear')}</span>{/if}</div>
    <button type="button" class="year-back" onclick={()=>showPanel('days')}><i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>{i18n.t('backToCalendar')}</button>
  {/if}
</div>
<style>
  .calendar-month{min-width:0;width:100%;color:var(--bs-body-color);}
  .month-heading{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-block-end:.7rem;min-height:2.35rem;color:var(--bs-body-color);}
  .month-heading strong{font-size:.9rem;font-weight:700;white-space:nowrap;}
  .heading-pickers{display:flex;align-items:center;justify-content:center;gap:.15rem;min-width:0;}
  .heading-picker{padding:.25rem .4rem;border:0;border-radius:.4rem;background:transparent;color:var(--brand-primary,var(--bs-primary));font:inherit;font-size:.9rem;font-weight:700;white-space:nowrap;cursor:pointer;}
  .heading-picker:hover{background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 14%,var(--bs-body-bg));}
  .month-nav,.nav-spacer{display:grid;place-items:center;flex:none;width:2.2rem;height:2.2rem;border:0;border-radius:.55rem;}
  .month-nav{background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 13%,var(--bs-body-bg));color:var(--bs-body-color);cursor:pointer;}
  .month-nav:hover:not(:disabled){background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 22%,var(--bs-body-bg));}
  .month-nav:disabled{opacity:.35;cursor:not-allowed;}
  .month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.2rem;text-align:center;}
  .weekday{min-height:1.75rem;display:grid;place-items:center;font-size:.72rem;color:var(--bs-secondary-color);}
  .day{display:grid;place-items:center;min-width:0;min-height:2.25rem;padding:0;border:1px solid transparent;border-radius:.5rem;background:transparent;color:inherit;font:inherit;font-size:.83rem;cursor:pointer;}
  .day:hover:not(:disabled){background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 14%,var(--bs-body-bg));}
  .day.in-range{background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 18%,var(--bs-body-bg));border-radius:.25rem;}
  .day.today:not(.selected){border-color:var(--brand-primary,var(--bs-primary));}
  .day.selected,.day.range-edge{background:var(--brand-primary,var(--bs-primary));color:#fff;border-radius:.5rem;font-weight:700;}
  .day:disabled,.choice:disabled{opacity:.3;cursor:not-allowed;}
  .choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.45rem;}
  .year-choice-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:.4rem;}
  .choice{min-height:2.35rem;padding:.3rem .4rem;border:1px solid var(--bs-border-color);border-radius:.55rem;background:color-mix(in srgb,var(--bs-body-color) 3%,var(--bs-body-bg));color:var(--bs-body-color);font:inherit;font-size:.78rem;cursor:pointer;}
  .year-option{min-height:2.4rem;font-size:.84rem;}
  .choice:hover:not(:disabled){background:color-mix(in srgb,var(--brand-primary,var(--bs-primary)) 14%,var(--bs-body-bg));}
  .choice[aria-pressed="true"]{border-color:var(--brand-primary,var(--bs-primary));background:var(--brand-primary,var(--bs-primary));color:#fff;font-weight:700;}
  .year-heading{margin-block-end:.65rem;}
  .year-heading-copy{display:grid;gap:.05rem;text-align:center;line-height:1.35;}
  .year-heading-copy span{font-size:.7rem;color:var(--bs-secondary-color);}
  .year-heading-copy strong{font-size:.9rem;color:var(--bs-body-color);}
  .year-entry{display:flex;align-items:end;gap:.5rem;flex-wrap:wrap;margin-block-start:.7rem;padding-block-start:.6rem;border-block-start:1px solid var(--bs-border-color);font-size:.78rem;}
  .year-entry label{display:grid;gap:.4rem;flex:1;min-width:6rem;color:var(--bs-body-color);font-weight:600;}
  .year-entry input{min-width:0;width:100%;min-height:2.5rem;padding:.35rem .65rem;border:1px solid var(--bs-border-color);border-radius:.55rem;background:var(--bs-body-bg);color:var(--bs-body-color);font:inherit;font-size:.9rem;font-weight:400;direction:ltr;text-align:center;}
  .year-entry input::placeholder{color:var(--bs-secondary-color);opacity:1;}
  .year-entry input[aria-invalid="true"]{border-color:var(--bs-danger);}
  .year-submit{min-width:3.2rem;min-height:2.5rem;padding:.35rem .65rem;border:0;border-radius:.55rem;background:var(--brand-primary,var(--bs-primary));color:#fff;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;}
  .year-submit:hover{filter:brightness(1.12);}
  .year-error{display:block;width:100%;color:var(--bs-danger);}
  .year-back{display:flex;align-items:center;gap:.4rem;margin-block-start:.45rem;padding:.25rem 0;border:0;background:none;color:var(--bs-body-color);font:inherit;font-size:.78rem;cursor:pointer;}
  .year-back:hover{text-decoration:underline;}
</style>
