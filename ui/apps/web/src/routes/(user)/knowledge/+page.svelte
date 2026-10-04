<script lang="ts">import type {PageData} from './$types';import Workspace from '#lib/knowledge/Workspace.svelte';let {data}:{data:PageData}=$props();</script>
{#if !data.modelConfigured}<div class="alert alert-warning" role="status">DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED: DOCUMENT_EMBED, QUERY_EMBED, RERANK, RAG_ANSWER</div>{/if}
<Workspace maxUploadBytes={data.managedUploadMaxBytes}/>
