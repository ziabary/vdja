<script lang="ts">
  interface intfProps {id:string;label:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean;error?:string}
  let {id,label,checked,onChange,disabled=false,error}:intfProps=$props();
</script>
<div class="form-check mb-3"><input class="form-check-input" type="checkbox" {id} name={id} {checked} {disabled} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onchange={event=>onChange(event.currentTarget.checked)} /><label class="form-check-label" for={id}>{label}</label>{#if error}<div id={`${id}-error`} class="text-danger">{error}</div>{/if}</div>
