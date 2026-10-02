<script lang="ts">
  import type { intfGregorianDate,typTimeZoneId } from '@targoman/calendar-core';
  import DateInput from './DateInput.svelte';
  import {useLocale} from '@targoman/ui-core';
  const i18n=useLocale();
  interface intfProps {id:string;label:string;date:string;time:string;timeZone:typTimeZoneId;today:intfGregorianDate;onChange:(value:{date:string;time:string;timeZone:typTimeZoneId})=>void;error?:string;disabled?:boolean;dir?:'rtl'|'ltr'}
  let {id,label,date,time,timeZone,today,onChange,error,disabled=false,dir}:intfProps=$props();
</script>
<fieldset {disabled}><legend class="fs-6">{label}</legend><DateInput id={`${id}-date`} label={i18n.t('date')} value={date} {today} {dir} onChange={next=>onChange({date:next,time,timeZone})} {error} /><label for={`${id}-time`} class="form-label">{i18n.t('time')}</label><input id={`${id}-time`} class="form-control" class:fa-num={i18n.locale==='fa'} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {dir} type="time" value={time} onchange={event=>onChange({date,time:event.currentTarget.value,timeZone})} /><small class="ltr">{timeZone}</small></fieldset>
