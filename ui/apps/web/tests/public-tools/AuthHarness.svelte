<script lang="ts">
  import TextTool from '../../src/lib/public-tools/TextTool.svelte';
  import FaqPage from '../../src/routes/(public)/faq/+page.svelte';
  import {provideAuthClient} from '../../src/lib/auth/client.svelte.js';

  let {kind}:{kind?:'translate'|'summarize'}=$props();
  provideAuthClient();
</script>

{#if kind}<TextTool {kind}/>{:else}<FaqPage/>{/if}
