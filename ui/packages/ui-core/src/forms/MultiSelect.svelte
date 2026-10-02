<script lang="ts">
  import {useLocale} from '../i18n/index.js';
  const i18n=useLocale();
  interface intfOption {readonly value:string;readonly label:string}
  interface intfProps {id:string;label:string;values:readonly string[];options:readonly intfOption[];onChange:(values:readonly string[])=>void;disabled?:boolean;error?:string;dir?:'rtl'|'ltr'}
  let {id,label,values,options,onChange,disabled=false,error,dir}:intfProps=$props();
  function change(event:Event){const select=event.currentTarget as HTMLSelectElement;onChange([...select.selectedOptions].map(option=>option.value));}
</script>
<div class="mb-3"><label class="form-label" for={id}>{label}</label><select {id} name={id} multiple size={Math.min(6,Math.max(2,options.length))} class="form-select" class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {disabled} {dir} aria-describedby={`${id}-hint`} aria-invalid={!!error} onchange={change}>{#each options as option (option.value)}<option value={option.value} selected={values.includes(option.value)}>{option.label}</option>{/each}</select><div id={`${id}-hint`} class="form-text" aria-live="polite">{error??`${values.length} ${i18n.t('selected')}`}</div></div>
