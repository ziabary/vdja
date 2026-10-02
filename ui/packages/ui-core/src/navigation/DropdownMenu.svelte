<script lang="ts">
  import type {Snippet} from 'svelte';

  interface intfProps {
    trigger:Snippet;
    children:Snippet;
    triggerClass?:string;
  }
  let {trigger,children,triggerClass='btn btn-outline-secondary btn-sm'}:intfProps=$props();
  let menu=$state<HTMLDetailsElement>();

  function close(restoreFocus=false){
    if(!menu?.open)return;
    menu.open=false;
    if(restoreFocus)menu.querySelector('summary')?.focus();
  }
  function handleClick(event:MouseEvent){
    if(!menu?.open)return;
    const path=event.composedPath();
    if(!path.includes(menu)){close();return;}
    if(path.some(node=>node instanceof Element&&node.matches('a[href], [data-menu-close]')&&menu?.contains(node)))close();
  }
  function handleChange(event:Event){
    if(event.target instanceof HTMLSelectElement&&menu?.contains(event.target))close();
  }
  function handleKeydown(event:KeyboardEvent){
    if(event.key!=='Escape'||!menu?.open)return;
    event.preventDefault();event.stopPropagation();close(true);
  }
</script>

<svelte:window onclick={handleClick} onchange={handleChange} onkeydown={handleKeydown}/>
<details class="menu" bind:this={menu}>
  <summary class={triggerClass}>{@render trigger()}</summary>
  <div class="panel">{@render children()}</div>
</details>

<style>
  .menu{position:relative}
  .menu summary{display:inline-flex;align-items:center;gap:.3rem;min-height:2rem;list-style:none;white-space:nowrap}
  .menu summary::-webkit-details-marker{display:none}
  .panel{position:absolute;inset-block-start:calc(100% + .4rem);inset-inline-end:0;z-index:var(--bs-dropdown-zindex,1000);min-width:13rem;padding:.35rem;border:1px solid var(--bs-border-color);border-radius:.6rem;background:var(--bs-body-bg);box-shadow:0 .5rem 1.5rem rgba(0,0,0,.12);display:grid}
  .panel :global(a){padding:.45rem .6rem;border-radius:.35rem;color:var(--bs-body-color);text-decoration:none}
  .panel :global(a:hover),.panel :global(a:focus-visible){background:var(--bs-tertiary-bg)}
  .panel :global(label){padding:.45rem .6rem .1rem;font-size:.75rem;color:var(--bs-secondary-color)}
  .panel :global(select){width:calc(100% - .7rem);margin:.2rem .35rem .35rem}
</style>
