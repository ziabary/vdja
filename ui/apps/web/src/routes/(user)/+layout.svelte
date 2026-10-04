<script lang="ts">
  import {resolve} from '$app/paths';
  import type {Snippet} from 'svelte';
  import type {LayoutData} from './$types';
  import {useLocale} from '@targoman/ui-core';
  import {knowledgeText} from '#lib/knowledge/messages.js';
  const i18n=useLocale();
  let {data,children}:{data:LayoutData;children:Snippet}=$props();
</script>
<div class="row g-3"><nav class="col-md-3" aria-label={i18n.t('userArea')}><ul class="list-unstyled"><li><a href={resolve('/(user)/dashboard')}>{i18n.t('dashboard')}</a></li>
  {#if data.knowledgeEnabled}<li><a href={resolve('/(user)/knowledge')}>{knowledgeText(i18n.locale,'title')}</a></li>{/if}
</ul></nav><section class="col-md-9" aria-label={i18n.t('userWorkspace')}>{@render children()}</section></div>
