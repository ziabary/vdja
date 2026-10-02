<script lang="ts">
  interface intfProps {id:string;name:string;label:string;value:string;selected:string;onChange:(value:string)=>void;disabled?:boolean}
  let {id,name,label,value,selected,onChange,disabled=false}:intfProps=$props();
</script>
<div class="form-check"><input class="form-check-input" type="radio" {id} {name} {value} checked={value===selected} {disabled} onchange={()=>onChange(value)} /><label class="form-check-label" for={id}>{label}</label></div>
