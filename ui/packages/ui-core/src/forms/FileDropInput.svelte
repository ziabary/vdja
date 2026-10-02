<script lang="ts">
  import type {Snippet} from 'svelte';

  interface intfProps {
    id:string;
    accept:string;
    chooseLabel:string;
    prompt:string;
    onFile:(file:File)=>void;
    hint?:string;
    fileName?:string;
    hasValue?:boolean;
    disabled?:boolean;
    variant?:'panel'|'field';
    children?:Snippet;
  }

  let {id,accept,chooseLabel,prompt,onFile,hint,fileName,hasValue=false,disabled=false,variant='panel',children}:intfProps=$props();
  let input:HTMLInputElement;
  let dragging=$state(false);
  let editing=$state(false);
  let dragDepth=0;
  const showFieldPrompt=$derived(variant==='field'&&!editing&&!hasValue&&!dragging);

  function hasFiles(event:DragEvent):boolean{return event.dataTransfer?.types.includes('Files')??false;}
  function dragEnter(event:DragEvent){if(!hasFiles(event))return;event.preventDefault();dragDepth++;if(!disabled)dragging=true;}
  function dragOver(event:DragEvent){if(!hasFiles(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect=disabled?'none':'copy';}
  function dragLeave(){dragDepth=Math.max(0,dragDepth-1);if(dragDepth===0)dragging=false;}
  function drop(event:DragEvent){
    dragDepth=0;dragging=false;
    const file=event.dataTransfer?.files[0];
    if(!file)return;
    event.preventDefault();
    if(!disabled)onFile(file);
  }
  function picked(event:Event){
    const target=event.currentTarget as HTMLInputElement;
    const file=target.files?.[0];
    target.value='';
    if(file&&!disabled)onFile(file);
  }
  function focusIn(event:FocusEvent){if(event.target instanceof HTMLTextAreaElement)editing=true;}
  function focusOut(event:FocusEvent){if(event.target instanceof HTMLTextAreaElement)editing=false;}
</script>

<div class="file-drop-input" class:panel={variant==='panel'} class:field={variant==='field'} class:dragging class:disabled role="group" aria-label={prompt}
  ondragenter={dragEnter} ondragover={dragOver} ondragleave={dragLeave} ondrop={drop} onfocusin={focusIn} onfocusout={focusOut}>
  {#if variant==='field'}
    <div class="content" class:prompt-visible={showFieldPrompt}>
      {#if children}{@render children()}{/if}
      {#if showFieldPrompt}
        <button class="center-picker" type="button" {disabled} aria-label={chooseLabel} onclick={()=>input.click()}>
          <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          <span>{prompt}</span>
          {#if hint}<small>{hint}</small>{/if}
        </button>
      {/if}
      {#if dragging}<div class="drop-overlay" aria-hidden="true"><i class="fa-solid fa-cloud-arrow-up"></i><span>{prompt}</span></div>{/if}
    </div>
  {:else}
    <button class="panel-button" type="button" {disabled} aria-label={fileName?`${chooseLabel}: ${fileName}`:undefined} aria-describedby={hint?`${id}-hint`:undefined} onclick={()=>input.click()}>
      <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
      <span>{fileName??prompt}</span>
      {#if hint}<small id={`${id}-hint`}>{hint}</small>{/if}
    </button>
  {/if}
  <input bind:this={input} {id} type="file" {accept} {disabled} hidden tabindex="-1" onchange={picked}/>
</div>

<style>
  .file-drop-input{min-width:0;font:inherit}
  .content{position:relative}
  .prompt-visible :global(textarea){background:var(--bs-tertiary-bg)}
  .prompt-visible :global(textarea)::placeholder{color:transparent}
  .center-picker{position:absolute;inset-block-start:50%;left:50%;transform:translate(-50%,-50%);width:min(82%,20rem);min-height:8rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.35rem;padding:.75rem;border:2px dashed var(--bs-border-color);border-radius:.65rem;background:var(--bs-body-bg);color:var(--bs-body-color);font:inherit;cursor:pointer;text-align:center;box-shadow:0 .3rem 1rem rgba(0,0,0,.08)}
  .center-picker:hover:not(:disabled),.center-picker:focus-visible{border-color:var(--brand-primary);background:var(--bs-info-bg-subtle);box-shadow:0 .4rem 1.25rem rgba(0,0,0,.14)}
  .center-picker:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}
  .center-picker:disabled{cursor:not-allowed;opacity:.65}
  .center-picker i{font-size:1.75rem;color:var(--brand-primary)}
  .center-picker small{font-size:.75rem;color:var(--bs-secondary-color);line-height:1.5}
  .drop-overlay{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;border:2px dashed var(--brand-primary);border-radius:.4rem;background:var(--bs-tertiary-bg);color:var(--bs-body-color);font-weight:700;pointer-events:none;text-align:center;padding:1rem}
  .drop-overlay i{font-size:2rem;color:var(--brand-primary)}
  .panel-button small{font-size:.875rem;color:var(--bs-secondary-color)}
  .panel-button{font:inherit}
  .panel-button{width:100%;min-height:9rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;padding:1rem;border:2px dashed var(--bs-border-color);border-radius:.4rem;background:var(--bs-tertiary-bg);color:var(--bs-body-color);cursor:pointer;text-align:center;overflow-wrap:anywhere}
  .panel-button:hover:not(:disabled),.dragging .panel-button{border-color:var(--brand-primary)}
  .panel-button:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}
  .panel-button i{font-size:2rem;color:var(--brand-primary)}
  .panel-button:disabled{cursor:not-allowed;opacity:.65}
</style>
