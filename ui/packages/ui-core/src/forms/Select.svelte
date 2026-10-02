<script lang="ts">
  interface intfOption {readonly value:string;readonly label:string}
  interface intfProps {id:string;label:string;value:string;options:readonly intfOption[];onChange:(value:string)=>void;emptyLabel?:string;error?:string;disabled?:boolean;required?:boolean;dir?:'rtl'|'ltr'}
  let {id,label,value,options,onChange,emptyLabel,error,disabled=false,required=false,dir}:intfProps=$props();
</script>
<div class="mb-3"><label class="form-label" for={id}>{label}</label><select {id} name={id} class="form-select" class:is-invalid={!!error} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {value} {disabled} {required} {dir} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onchange={event=>onChange(event.currentTarget.value)}>{#if emptyLabel}<option value="">{emptyLabel}</option>{/if}{#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}</select>{#if error}<div id={`${id}-error`} class="invalid-feedback d-block">{error}</div>{/if}</div>
