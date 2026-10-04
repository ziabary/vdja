<script lang="ts">import type {PageData} from './$types';import Workspace from '#lib/knowledge/Workspace.svelte';let {data}:{data:PageData}=$props();</script>
<Workspace maxUploadBytes={data.managedUploadMaxBytes}/>
