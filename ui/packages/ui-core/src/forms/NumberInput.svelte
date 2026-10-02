<script lang="ts">
  import { normalizeNumericDigits,parseDecimalInput,replaceDigitsPreservingSelection } from './numeric.js';
  interface intfProps { id:string;label:string;value:string;onChange:(value:string)=>void;mode:'integer'|'decimal';scale?:number;signed?:boolean;error?:string;disabled?:boolean;required?:boolean;dir?:'rtl'|'ltr';faNum?:boolean }
  let {id,label,value,onChange,mode,scale=0,signed=false,error,disabled=false,required=false,dir,faNum=false}:intfProps=$props();
  let composing=false;
  function change(event:Event){
    const input=event.currentTarget as HTMLInputElement;
    if(composing){onChange(input.value);return;}
    const next=replaceDigitsPreservingSelection(input.value,input.selectionStart??0,input.selectionEnd??0);
    input.value=next.value;input.setSelectionRange(next.start,next.end);onChange(next.value);
  }
  export function canonical():string|null {return parseDecimalInput(normalizeNumericDigits(value),mode==='integer'?0:scale,signed);}
</script>
<div class="mb-3">
  <label class="form-label" for={id}>{label}</label>
  <input {id} name={id} type="text" inputmode={mode==='integer'?'numeric':'decimal'} class="form-control" class:fa-num={faNum} class:is-invalid={!!error} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} {value} {disabled} {required} {dir} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} oncompositionstart={()=>composing=true} oncompositionend={event=>{composing=false;change(event);}} oninput={change} />
  {#if error}<div id={`${id}-error`} class="invalid-feedback d-block">{error}</div>{/if}
</div>
