<script lang="ts">
  import {onMount,tick,type Snippet} from 'svelte';
  import {useLocale} from '../i18n/index.js';
  import {lockDocumentScroll} from './scrollLock.js';
  interface intfProps {id:string;title:string;open:boolean;onClose:()=>void;children:Snippet;description?:string;variant?:'dialog'|'drawer'}
  const i18n=useLocale();
  let {id,title,open,onClose,children,description,variant='dialog'}:intfProps=$props();
  let element:HTMLDialogElement,opener:HTMLElement|null=null,unlock:(()=>void)|null=null;
  onMount(()=>()=>{unlock?.();unlock=null;if(element?.open)element.close();});
  $effect(()=>{
    if(!element)return;
    if(open&&!element.open){
      opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
      unlock=lockDocumentScroll(document);element.showModal();
      tick().then(()=>element?.querySelector<HTMLElement>('[autofocus],button,input,select,textarea')?.focus());
    }else if(!open&&element.open)element.close();
  });
  function closed(){unlock?.();unlock=null;if(opener?.isConnected)opener.focus();opener=null;onClose();}
</script>
<dialog bind:this={element} class="overlay-surface" class:drawer={variant==='drawer'} aria-labelledby={`${id}-title`} aria-describedby={description?`${id}-description`:undefined} onclose={closed} oncancel={event=>{event.preventDefault();onClose();}}>
  <div class="overlay-frame"><header class="overlay-header"><div><h2 id={`${id}-title`} class="h5 mb-1">{title}</h2>{#if description}<p id={`${id}-description`} class="text-secondary small mb-0">{description}</p>{/if}</div><button type="button" class="btn btn-outline-secondary overlay-close" aria-label={i18n.t('close')} onclick={onClose}><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header><div class="overlay-body">{@render children()}</div></div>
</dialog>
<style>
  dialog.overlay-surface{position:fixed;inset:0;margin:auto;width:min(36rem,calc(100vw - 2rem));max-width:none;max-height:calc(100dvh - 2rem);padding:0;overflow:hidden;border:1px solid var(--bs-border-color);border-radius:1rem;background:var(--bs-body-bg);color:var(--bs-body-color);box-shadow:0 24px 70px rgba(0,0,0,.32);}
  dialog.overlay-surface[open]{display:block;}
  dialog.overlay-surface::backdrop{background:rgba(2,12,20,.66);}
  .overlay-frame{display:flex;flex-direction:column;max-height:calc(100dvh - 2rem);min-height:0;}
  .overlay-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex:none;padding:1.1rem 1.25rem;border-block-end:1px solid var(--bs-border-color);}
  .overlay-close{flex:none;}
  .overlay-body{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1.25rem;}
  dialog.drawer{inset-block:0;inset-inline-start:auto;inset-inline-end:0;margin-block:0;margin-inline:0;width:min(26rem,100vw);max-height:100dvh;height:100dvh;border-radius:1rem 0 0 1rem;}
  dialog.drawer .overlay-frame{max-height:100dvh;height:100%;}
  @media(max-width:575px){dialog.overlay-surface:not(.drawer){width:calc(100vw - 1rem);max-height:calc(100dvh - 1rem)}dialog.overlay-surface:not(.drawer) .overlay-frame{max-height:calc(100dvh - 1rem)}dialog.drawer{width:min(100vw,26rem)}}
</style>
