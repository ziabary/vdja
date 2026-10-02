<script lang="ts">import type {Snippet} from 'svelte';import {useLocale} from '@targoman/ui-core';import {publicToolText} from '#lib/public-tools/messages.js';let {children}:{children:Snippet}=$props();const locale=useLocale();</script>
<section class="public-shell" aria-label={publicToolText(locale.locale,'tools')}>{@render children()}</section>
