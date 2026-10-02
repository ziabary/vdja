<script lang="ts">
  import { renderMarkdownTrusted } from '@targoman/ui-core/markdown-render';
  let {source}:{source:string}=$props();
  let markup=$derived(renderMarkdownTrusted(source));
</script>
<div class="markdown-view" dir="auto">{@html markup}</div>
<style>.markdown-view :global(pre),.markdown-view :global(code){direction:ltr;unicode-bidi:isolate}.markdown-view :global(pre){overflow-x:auto}.markdown-view :global(table){display:block;max-width:100%;overflow-x:auto}</style>
