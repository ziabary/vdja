<script lang="ts">
  interface intfProps { id:string; label:string; value:string; onChange:(value:string)=>void; help?:string; error?:string; required?:boolean; disabled?:boolean; readOnly?:boolean; autocomplete?:'on'|'off'|'email'|'name'; dir?:'rtl'|'ltr' }
  let {id,label,value,onChange,help,error,required=false,disabled=false,readOnly=false,autocomplete,dir='ltr'}:intfProps=$props();
</script>
<div class="mb-3">
  <label class="form-label" for={id}>{label}</label>
  <input {id} name={id} type="email" class="form-control" class:is-invalid={!!error} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {value} {required} {disabled} readonly={readOnly} {autocomplete} {dir} aria-invalid={!!error} aria-describedby={help||error?`${id}-description`:undefined} oninput={event=>onChange(event.currentTarget.value)} />
  {#if help||error}<div id={`${id}-description`} class={error?'invalid-feedback d-block':'form-text'}>{error??help}</div>{/if}
</div>
