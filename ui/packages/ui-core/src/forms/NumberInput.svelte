<script lang="ts">
  import { normalizeNumericDraft,parseDecimalInput,replaceDigitsPreservingSelection } from './numeric.js';
  interface intfProps { id:string;label:string;value:string;onChange:(value:string)=>void;mode:'integer'|'decimal';scale?:number;signed?:boolean;error?:string;disabled?:boolean;required?:boolean;dir?:'rtl'|'ltr';faNum?:boolean }
  let {id,label,value,onChange,mode,scale=0,signed=false,error,disabled=false,required=false,dir,faNum=false}:intfProps=$props();
  let composing=false;
  let acceptedValue='',acceptedStart=0,acceptedEnd=0;
  let displayValue=$derived(normalizeNumericDraft(value,mode,scale,signed)??'');
  $effect(()=>{const next=displayValue;if(next!==acceptedValue){acceptedValue=next;acceptedStart=Math.min(acceptedStart,next.length);acceptedEnd=Math.min(acceptedEnd,next.length);}});
  function change(event:Event){
    const input=event.currentTarget as HTMLInputElement;
    if(composing)return;
    const next=replaceDigitsPreservingSelection(input.value,input.selectionStart??0,input.selectionEnd??0);
    if(normalizeNumericDraft(next.value,mode,scale,signed)===null){input.value=acceptedValue;input.setSelectionRange(acceptedStart,acceptedEnd);return;}
    input.value=next.value;acceptedStart=next.start;acceptedEnd=next.end;input.setSelectionRange(next.start,next.end);
    if(next.value!==acceptedValue){acceptedValue=next.value;onChange(next.value);}
  }
  export function canonical():string|null {return parseDecimalInput(value,mode==='integer'?0:scale,signed);}
</script>
<div class="mb-3">
  <label class="form-label" for={id}>{label}</label>
  <input {id} name={id} type="text" inputmode={mode==='integer'?'numeric':'decimal'} class="form-control" class:fa-num={faNum} class:is-invalid={!!error} class:ltr={dir==='ltr'} class:rtl={dir==='rtl'} value={displayValue} {disabled} {required} {dir} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} oncompositionstart={()=>composing=true} oncompositionend={event=>{composing=false;change(event);}} oninput={change} onselect={event=>{const input=event.currentTarget;if(input.value===acceptedValue){acceptedStart=input.selectionStart??acceptedStart;acceptedEnd=input.selectionEnd??acceptedEnd;}}} />
  {#if error}<div id={`${id}-error`} class="invalid-feedback d-block">{error}</div>{/if}
</div>
