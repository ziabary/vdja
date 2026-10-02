<script lang="ts">
  interface intfProps {id:string;label:string;value:string;onChange:(value:string)=>void;error?:string;rows?:number;disabled?:boolean;required?:boolean;dir?:'rtl'|'ltr'}
  let {id,label,value,onChange,error,rows=4,disabled=false,required=false,dir}:intfProps=$props();
</script>
<div class="mb-3"><label class="form-label" for={id}>{label}</label><textarea {id} name={id} class="form-control" class:is-invalid={!!error} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {rows} {disabled} {required} {dir} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} oninput={event=>onChange(event.currentTarget.value)}>{value}</textarea>{#if error}<div id={`${id}-error`} class="invalid-feedback d-block">{error}</div>{/if}</div>
