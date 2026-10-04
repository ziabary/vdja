<script lang="ts">
  import {onMount,untrack} from 'svelte';
  import {resolve} from '$app/paths';
  import {TextInput,Select,Textarea,FileDropInput,BusySurface,ErrorState,EmptyState,useLocale} from '@targoman/ui-core';
  import type {intfKnowledgeDocumentView,intfKnowledgeVersionView,intfKnowledgeSpaceView,intfKnowledgeSpaceStatus,intfManagedTransferView,intfKnowledgeAnswerView} from '@targoman/contracts/knowledge';
  import {useAuthClient} from '#lib/auth/client.svelte.js';
  import {createKnowledgeClient} from './client.js';
  import {knowledgeText,type typKnowledgeMessage} from './messages.js';
  let {maxUploadBytes}:{maxUploadBytes:number}=$props();
  const auth=useAuthClient(),locale=useLocale(),t=(key:typKnowledgeMessage)=>knowledgeText(locale.locale,key);
  const client=createKnowledgeClient(auth);
  let documents=$state<readonly intfKnowledgeDocumentView[]>([]),spaces=$state<readonly intfKnowledgeSpaceView[]>([]);
  let documentCursor=$state<string|null>(null),spaceCursor=$state<string|null>(null),documentId=$state(''),spaceId=$state('');
  let title=$state(''),spaceTitle=$state(''),classification=$state('LOW'),file=$state<File|null>(null),resumeId=$state(''),pin=$state(''),question=$state('');
  let versions=$state<readonly intfKnowledgeVersionView[]>([]),spaceStatus=$state<intfKnowledgeSpaceStatus|null>(null),transfer=$state<intfManagedTransferView|null>(null);
  let answer=$state<intfKnowledgeAnswerView|null>(null),sourceText=$state(''),error=$state(''),busy=$state(false),progress=$state(0);
  let operations=$state({discover:false,read:false,download:false,use:false,quote:false,manage:false});
  let controller:AbortController|null=null;
  let resultElement=$state<HTMLElement>();
  const classes=$derived([{value:'LOW',label:t('low')},{value:'MEDIUM',label:t('medium')},{value:'HIGH',label:t('high')},{value:'CRITICAL',label:t('critical')}]);
  const documentOptions=$derived(documents.map(item=>({value:item.id,label:item.title})));
  const spaceOptions=$derived(spaces.map(item=>({value:item.id,label:item.title})));
  function stateLabel(value:string):string{return t(value==='READY'?'ready':value==='FAILED'?'failed':value==='PENDING'?'pending':value==='COMMITTED'?'committed':'processing');}
  async function run(work:(signal:AbortSignal)=>Promise<void>){
    if(busy||!auth.state.token)return;
    const active=new AbortController();controller=active;busy=true;error='';
    try{await work(active.signal);}catch(cause){if(!active.signal.aborted)error=cause instanceof Error&&cause.message==='FILE_TOO_LARGE'?t('tooLarge'):t('error');}
    finally{if(controller===active){controller=null;busy=false;}}
  }
  async function load(signal:AbortSignal){const[docs,knowledge]=await Promise.all([client.documents(null,signal),client.spaces(null,signal)]);documents=docs.items;documentCursor=docs.nextCursor;spaces=knowledge.items;spaceCursor=knowledge.nextCursor;}
  async function selected(signal:AbortSignal){
    if(documentId){const[list,permissions]=await Promise.all([client.versions(documentId,signal),client.operations(documentId,signal)]);versions=list;operations=permissions;}
    if(spaceId)spaceStatus=await client.spaceStatus(spaceId,signal);
    if(transfer)transfer=await client.transferStatus(transfer.id,signal);
  }
  $effect(()=>{
    const token=auth.state.token;controller?.abort();controller=null;busy=false;
    documents=[];spaces=[];documentId='';spaceId='';versions=[];spaceStatus=null;transfer=null;answer=null;sourceText='';question='';file=null;resumeId='';error='';
    if(token)untrack(()=>{void run(load);});
  });
  onMount(()=>{const timer=setInterval(()=>{if(!busy&&auth.state.token&&(versions.some(value=>['PENDING','PROCESSING'].includes(value.processingState))||spaceStatus?.state==='BUILDING'))void run(selected);},5000);
    return()=>{clearInterval(timer);controller?.abort();};});
  function selectDocument(value:string){documentId=value;versions=[];sourceText='';transfer=null;resumeId='';pin='';void run(selected);}
  function selectSpace(value:string){spaceId=value;spaceStatus=null;answer=null;void run(selected);}
  async function upload(){if(!file||!documentId)return;const chosen=file;await run(async signal=>{progress=0;
    transfer=await client.upload(documentId,chosen,maxUploadBytes,resumeId||null,(percent,value)=>{progress=percent;transfer=value;resumeId=value.id;},signal);resumeId=transfer.id;await selected(signal);});}
  async function download(versionId:string){await run(async signal=>{const blob=await client.download(documentId,versionId,maxUploadBytes,signal);const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='document';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
</script>

<section aria-labelledby="knowledge-title">
  <h2 id="knowledge-title">{t('title')}</h2>
  {#if !auth.state.token}
    <p>{t('login')}</p><a class="btn btn-primary" href={resolve('/(public)/login')}>{t('signIn')}</a>
  {:else}
    {#if error}<ErrorState title={error}/>{/if}
    <div class="d-flex gap-2 mb-3"><button type="button" class="btn btn-outline-secondary" disabled={busy} onclick={()=>run(async signal=>{await load(signal);await selected(signal);})}><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> {t('refresh')}</button>
      {#if busy}<button type="button" class="btn btn-outline-danger" onclick={()=>controller?.abort()}>{t('cancel')}</button>{/if}</div>
    <BusySurface scope="panel" {busy} status={t('processing')} blocking={false}>
      <div class="row g-4">
        <section class="col-lg-6" aria-labelledby="documents-title">
          <h3 id="documents-title">{t('documents')}</h3>
          <form onsubmit={event=>{event.preventDefault();void run(async signal=>{const created=await client.createDocument(title,classification,signal);await load(signal);documentId=created.id;title='';await selected(signal);});}}>
            <TextInput id="document-title" label={t('titleLabel')} value={title} onChange={value=>title=value} required disabled={busy}/>
            <Select id="document-classification" label={t('classification')} value={classification} options={classes} onChange={value=>classification=value} disabled={busy}/>
            <button class="btn btn-primary mb-3" disabled={busy||!title.trim()}>{t('create')}</button>
          </form>
          <Select id="knowledge-document" label={t('selectDocument')} value={documentId} options={documentOptions} emptyLabel={t('none')} onChange={selectDocument} disabled={busy}/>
          {#if documentCursor}<button type="button" class="btn btn-link" disabled={busy} onclick={()=>run(async signal=>{const page=await client.documents(documentCursor,signal);documents=[...documents,...page.items];documentCursor=page.nextCursor;})}>{t('next')}</button>{/if}
          {#if documentId}
            {#if operations.manage}
              <FileDropInput id="knowledge-file" accept=".txt,.md,.pdf,.doc,.docx,.odt" chooseLabel={t('file')} prompt={t('file')} fileName={file?.name} disabled={busy} onFile={value=>{file=value;progress=0;}}/>
              <TextInput id="resume-transfer" label={t('resume')} value={resumeId} onChange={value=>resumeId=value} dir="ltr" disabled={busy}/>
              <button type="button" class="btn btn-primary" disabled={busy||!file} onclick={upload}>{t('upload')}</button>
            {/if}
            {#if transfer}<p role="status" class="mt-2">{t('status')}: {stateLabel(transfer.state)} <span class="fa-num">{progress}%</span></p><progress value={progress} max="100" aria-label={t('upload')}></progress>{/if}
            <h4 class="h5 mt-4">{t('versions')}</h4>
            {#if !versions.length}<EmptyState title={t('empty')}/>{/if}
            <ul class="list-group">{#each versions as version (version.id)}<li class="list-group-item d-flex align-items-center gap-2 flex-wrap"><span class="fa-num">{version.sequence}</span><span>{stateLabel(version.processingState)}</span>
              {#if operations.read&&version.processingState==='READY'}<button type="button" class="btn btn-outline-secondary btn-sm" disabled={busy} onclick={()=>run(async signal=>{sourceText=await client.read(documentId,version.id,signal);})}>{t('read')}</button>{/if}
              {#if operations.download}<button type="button" class="btn btn-outline-secondary btn-sm" disabled={busy} onclick={()=>download(version.id)}>{t('download')}</button>{/if}
            </li>{/each}</ul>
          {/if}
        </section>
        <section class="col-lg-6" aria-labelledby="spaces-title">
          <h3 id="spaces-title">{t('spaces')}</h3>
          <form onsubmit={event=>{event.preventDefault();void run(async signal=>{const id=await client.createSpace(spaceTitle,classification,signal);await load(signal);spaceId=id;spaceTitle='';await selected(signal);});}}>
            <TextInput id="space-title" label={t('titleLabel')} value={spaceTitle} onChange={value=>spaceTitle=value} required disabled={busy}/>
            <button class="btn btn-primary mb-3" disabled={busy||!spaceTitle.trim()}>{t('create')}</button>
          </form>
          <Select id="knowledge-space" label={t('selectSpace')} value={spaceId} options={spaceOptions} emptyLabel={t('none')} onChange={selectSpace} disabled={busy}/>
          {#if spaceCursor}<button type="button" class="btn btn-link" disabled={busy} onclick={()=>run(async signal=>{const page=await client.spaces(spaceCursor,signal);spaces=[...spaces,...page.items];spaceCursor=page.nextCursor;})}>{t('next')}</button>{/if}
          {#if spaceId}
            {#if spaceStatus}<p role="status">{t('status')}: {stateLabel(spaceStatus.state)}</p>{/if}
            <Select id="pinned-version" label={t('pin')} value={pin} options={versions.filter(value=>value.processingState==='READY').map(value=>({value:value.id,label:String(value.sequence)}))} emptyLabel={t('none')} onChange={value=>pin=value} disabled={busy}/>
            <button type="button" class="btn btn-outline-primary mb-3" disabled={busy||!documentId||!operations.manage} onclick={()=>run(async signal=>{await client.addDocument(spaceId,documentId,pin||null,signal);await selected(signal);})}>{t('add')}</button>
            <button type="button" class="btn btn-outline-secondary mb-3" disabled={busy} onclick={()=>run(async signal=>{await client.rebuild(spaceId,signal);await selected(signal);})}>{t('rebuild')}</button>
            <form onsubmit={event=>{event.preventDefault();void run(async signal=>{answer=null;try{const result=await client.ask(spaceId,question,signal,text=>{if(!signal.aborted)answer={answer:text,citations:[]};});if(!signal.aborted)answer=result;requestAnimationFrame(()=>resultElement?.focus());}catch(cause){if(!signal.aborted)answer=null;throw cause;}});}}>
              <Textarea id="knowledge-question" label={t('question')} value={question} onChange={value=>question=value} required disabled={busy}/>
              <button class="btn btn-primary" disabled={busy||!question.trim()||spaceStatus?.state!=='READY'}>{t('ask')}</button>
            </form>
          {/if}
        </section>
      </div>
    </BusySurface>
    {#if answer}<section class="card card-body mt-4" aria-labelledby="answer-title" tabindex="-1" bind:this={resultElement}><h3 id="answer-title">{t('answer')}</h3><p class="answer-text" dir="auto">{answer.answer}</p>
      {#if answer.citations.length}<h4 class="h5">{t('sources')}</h4><ul>{#each answer.citations as citation (citation.label)}<li><span class="ltr">{citation.label}</span>
        {#if citation.mayRead}<button type="button" class="btn btn-link" disabled={busy} onclick={()=>run(async signal=>{sourceText=await client.read(citation.documentId,citation.versionId,signal);})}>{t('read')}</button>{/if}</li>{/each}</ul>{/if}
    </section>{/if}
    {#if sourceText}<section class="card card-body mt-3" aria-label={t('read')}><pre dir="auto" class="source-text">{sourceText}</pre></section>{/if}
  {/if}
</section>
<style>.answer-text,.source-text{white-space:pre-wrap;overflow-wrap:anywhere}.source-text{font:inherit;max-height:32rem;overflow:auto}</style>
