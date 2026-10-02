<script lang="ts">
  import type { Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  interface intfProps {id:string;title:string;open:boolean;onClose:()=>void;children:Snippet}
  let {id,title,open,onClose,children}:intfProps=$props();
</script>
<Dialog {id} {title} {open} {onClose} variant="drawer">{@render children()}</Dialog>
