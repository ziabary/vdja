<script lang="ts">
  import type { Snippet } from 'svelte';
  export type typBusyScope='application'|'page'|'panel'|'form'|'action'|'background';
  interface intfProps {scope:typBusyScope;busy:boolean;status:string;children:Snippet;blocking?:boolean}
  let {scope,busy,status,children,blocking=true}:intfProps=$props();
</script>
<div class={`busy-scope busy-${scope}`} aria-busy={busy} inert={busy&&blocking&&scope!=='background'?true:undefined}>
  {@render children()}
</div>
{#if busy}<div class="visually-hidden" role="status" aria-live="polite">{status}</div>{/if}
