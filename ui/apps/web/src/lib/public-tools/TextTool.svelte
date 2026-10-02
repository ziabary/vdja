<script lang="ts">
  import {onMount} from 'svelte';
  import {Textarea,Select,NumberInput,Checkbox,FileDropInput,MarkdownView,transitionAiOperation,useLocale,normalizeNumericDigits,type typAiOperationState} from '@targoman/ui-core';
  import {createPublicToolsClient,newPublicRequestId,type intfDictionaryResult} from '#lib/api/publicTools.js';
  import {LANGUAGE_CODES,publicToolText,type typPublicToolMessage} from './messages.js';

  let {kind}:{kind:'translate'|'summarize'}=$props();
  const locale=useLocale();const t=(key:typPublicToolMessage)=>publicToolText(locale.locale,key);
  const title=$derived(t(kind==='translate'?'translator':'summarizer'));
  let text=$state(''),result=$state(''),dictionary=$state<intfDictionaryResult|null>(null),error=$state(''),notice=$state('');
  let source=$state('auto'),target=$state('fa'),maxWords=$state('200'),forcePersian=$state(true);
  let operation=$state<typAiOperationState>('IDLE'),fileState=$state<'IDLE'|'READING'|'FAILED'>('IDLE'),cancelRequested=$state(false),copied=$state(false);
  let controller:AbortController|null=null,activeRequestId:string|null=null,autoTimer:ReturnType<typeof setTimeout>|null=null,autoPaused=false,client:ReturnType<typeof createPublicToolsClient>|null=null;
  let outputElement:HTMLElement;
  const active=$derived(operation==='SUBMITTING'||operation==='STREAMING'||operation==='COMPLETING');
  const languages=$derived(LANGUAGE_CODES.map(code=>({value:code,label:t(code)})));
  const direction=$derived(/[\u0590-\u08ff]/.test(text)?'rtl':'ltr');
  const outputDirection=$derived(/[\u0590-\u08ff]/.test(dictionary?.translations.join(' ')??result)?'rtl':'ltr');

  onMount(()=>{
    client=createPublicToolsClient();
    if(kind==='translate'){const query=new URLSearchParams(location.search).get('q');if(query){text=query;history.replaceState(null,'',location.pathname);void submit('AUTO');}}
    return()=>{if(autoTimer)clearTimeout(autoTimer);controller?.abort();};
  });
  function clearAuto(){if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}}
  function setText(value:string){text=value;clearAuto();if(kind==='translate'&&value.trim()&&!active&&!autoPaused){autoTimer=setTimeout(()=>{autoTimer=null;void submit('AUTO');},2000);}}
  function sourceChanged(value:string){source=value;if(source===target&&source!=='auto')target='fa';}
  function targetChanged(value:string){target=value;if(source===target&&source!=='auto')source='en';}
  function reset(){if(active)return;clearAuto();autoPaused=false;text='';result='';dictionary=null;error='';notice='';operation='IDLE';source='auto';target='fa';maxWords='200';forcePersian=true;if(kind==='translate')history.replaceState(null,'',location.pathname);}
  async function chooseFile(file:File|undefined){if(!file||!client||active)return;clearAuto();error='';notice='';
    if(!/\.(?:md|txt|odt|doc|docx|pdf)$/i.test(file.name)){error=t('invalidFile');return;}
    fileState='READING';try{text=await client.extractText(file,kind==='translate'?2000:3000);if(text.length>=(kind==='translate'?2000:3000))notice=t('tooLong');}catch{fileState='FAILED';error=t('fileReadFailed');return;}finally{if(fileState==='READING')fileState='IDLE';}
  }
  function messageFor(cause:unknown):string{if(cause instanceof TypeError)return t('network');if(cause instanceof Error){if(cause.message==='INTERRUPTED'||cause.message==='IDLE_OR_TOTAL_TIMEOUT')return t('interrupted');if(cause.message==='NETWORK_FAILURE')return t('network');if(cause.message==='INVALID_RESPONSE'||cause.message.startsWith('INVALID_'))return t('invalidResponse');}return t('failed');}
  async function submit(trigger:'AUTO'|'MANUAL'='MANUAL'){
    if(!client||active||fileState==='READING'||(trigger==='AUTO'&&autoPaused))return;
    clearAuto();error='';notice='';
    let value=text.trim();if(!value){error=t('emptyText');return;}
    if(kind==='translate'){
      if(source==='auto'&&/[\u0590-\u08ff]/.test(value)){source='fa';target='en';}
      if(source===target){error=t('sameLanguage');return;}
      if(target!=='fa'&&source==='auto'){error=t('sourceRequired');return;}
    }
    const limit=kind==='translate'?2000:3000;if(value.length>limit){value=value.slice(0,limit);notice=t('tooLong');}
    const words=Number(normalizeNumericDigits(maxWords));if(kind==='summarize'&&(!Number.isInteger(words)||words<50||words>1000)){error=t('maxWords');return;}
    if(operation!=='IDLE')operation=transitionAiOperation(operation,'RESET');
    operation=transitionAiOperation(operation,'SUBMIT');cancelRequested=false;result='';dictionary=null;
    controller=new AbortController();const requestId=newPublicRequestId();activeRequestId=requestId;
    try{
      operation=transitionAiOperation(operation,'STREAM_START');
      if(kind==='translate'){
        const response=await client.translate({text:value,sourceLang:source,targetLang:target,requestId},delta=>{result+=delta;},controller.signal);
        dictionary=response.dictionary??null;if(response.outcome==='CANCELLED'){error='';operation=transitionAiOperation(operation,'CANCEL_ACK');notice=t('cancelled');return;}
      }else{
        const response=await client.summarize({text:value,maxWords:words,forcePersian,requestId},delta=>{result+=delta;},controller.signal);
        if(response.outcome==='CANCELLED'){error='';operation=transitionAiOperation(operation,'CANCEL_ACK');notice=t('cancelled');return;}
      }
      error='';autoPaused=false;operation=transitionAiOperation(operation,'TERMINAL_SUCCESS');operation=transitionAiOperation(operation,'CONFIRM_RESULT');notice=t('success');
      if(kind==='translate')history.replaceState(null,'',location.pathname);
      requestAnimationFrame(()=>outputElement?.focus());
    }catch(cause){autoPaused=true;if(controller.signal.aborted){operation=transitionAiOperation(operation,'INTERRUPT');}else if(cause instanceof Error&&cause.message==='INTERRUPTED'){operation=transitionAiOperation(operation,'INTERRUPT');}else operation=transitionAiOperation(operation,'FAIL');error=messageFor(cause);}
    finally{controller=null;activeRequestId=null;cancelRequested=false;}
  }
  async function stop(){if(!active||!activeRequestId||!client||cancelRequested)return;const requestId=activeRequestId;cancelRequested=true;notice=t('cancelRequested');
    try{const acknowledged=await client.stop(kind,requestId);if(!acknowledged&&active&&activeRequestId===requestId){error=t('failed');}}
    catch{if(active&&activeRequestId===requestId)error=t('failed');}
  }
  async function copy(plain:boolean){const value=plain?outputElement?.textContent??'':dictionary?dictionary.translations.join('، '):result;
    try{await navigator.clipboard.writeText(value);copied=true;setTimeout(()=>copied=false,1500);}catch{error=t('failed');}
  }
  interface intfDictionaryEntry {readonly label:string;readonly words:readonly string[];readonly linked:boolean}
  function dictionaryEntries(value:unknown):intfDictionaryEntry[]{
    if(!value||typeof value!=='object'||Array.isArray(value))return [];
    const entries:intfDictionaryEntry[]=[];
    for(const [key,part] of Object.entries(value)){
      if(Array.isArray(part)){entries.push({label:key,words:part.filter((word):word is string=>typeof word==='string'),linked:false});continue;}
      if(part&&typeof part==='object')for(const [qualifier,words] of Object.entries(part))if(Array.isArray(words))entries.push({label:`${key} (${qualifier})`,words:words.filter((word):word is string=>typeof word==='string'),linked:true});
    }
    return entries;
  }
</script>

<svelte:head><title>{title}</title></svelte:head>
<section class="tool-page" class:summary={kind==='summarize'}>
  <div class="tool-grid">
    {#if kind==='translate'}<div class="language-row"><Select id="source-language" label={t('source')} value={source} options={[{value:'auto',label:t('auto')},...languages]} onChange={sourceChanged} disabled={active}/><Select id="target-language" label={t('target')} value={target} options={languages} onChange={targetChanged} disabled={active}/></div>{/if}
    <form id="public-text-tool-form" class="tool-input" onsubmit={event=>{event.preventDefault();void submit();}} aria-busy={active||fileState==='READING'}>
      <FileDropInput id={`${kind}-file`} accept=".md,.txt,.odt,.doc,.docx,.pdf" chooseLabel={t('chooseFile')} prompt={t('dropIntoText')} hint="PDF · DOC · DOCX · ODT · TXT · MD" hasValue={!!text.trim()} variant="field" disabled={active||fileState==='READING'} onFile={file=>{void chooseFile(file);}}>
        <div class="tool-input-wrap"><Textarea id={`${kind}-text`} label={t('text')} placeholder={t(kind==='translate'?'translatorPlaceholder':'summarizerPlaceholder')} value={text} onChange={setText} rows={8} dir={direction} disabled={active||fileState==='READING'} error={error===t('emptyText')?error:undefined}/><span class="char-count" class:fa-num={locale.locale==='fa'}>{text.length} {t('chars')}</span></div>
      </FileDropInput>
      {#if kind==='summarize'}<div class="tool-two"><NumberInput id="max-words" label={t('maxWords')} value={maxWords} onChange={value=>maxWords=value} mode="integer" dir="ltr" faNum={locale.locale==='fa'} disabled={active}/><Checkbox id="force-persian" label={t('forcePersian')} checked={forcePersian} onChange={value=>forcePersian=value} disabled={active}/></div>{/if}
      {#if fileState==='READING'}<p role="status">{t('inspecting')}</p>{/if}{#if notice}<p class="tool-notice" class:tool-success={operation==='SUCCEEDED'} role="status">{notice}</p>{/if}{#if error&&error!==t('emptyText')}<p class="alert alert-danger" role="alert">{error}</p>{/if}
    </form>
    <section class="tool-result" aria-busy={active} aria-live="polite"><h3 class="visually-hidden">{t('result')}</h3>
      <div class="tool-output" dir={outputDirection} tabindex="-1" bind:this={outputElement}>
        {#if dictionary}<article><h4 class="ltr">{dictionary.phrase}{#if dictionary.pronunciations?.us} <small>{dictionary.pronunciations.us}</small>{/if}</h4><p>{dictionary.translations.join('، ')}</p>{#each [['synonyms',dictionary.synonyms],['antonyms',dictionary.antonyms],['relatedWords',dictionary.relWords],['relatedExamples',dictionary.relExp]] as [label,value]}{#if dictionaryEntries(value).length}<h5>{t(label as typPublicToolMessage)}</h5><ul>{#each dictionaryEntries(value) as entry}<li><strong>{entry.label}:</strong> {#each entry.words as word,index}{#if index>0}، {/if}{#if entry.linked}<a href={`?q=${encodeURIComponent(word)}`} data-sveltekit-reload>{word}</a>{:else}{word}{/if}{/each}</li>{/each}</ul>{/if}{/each}</article>
        {:else if result}<MarkdownView source={result}/>{:else if active}<p>{t('streaming')}</p>{/if}
      </div>
      <div class="tool-result-actions"><button class="btn btn-primary" type="submit" form="public-text-tool-form" disabled={active||fileState==='READING'||!text.length}><i class={kind==='translate'?'fa-solid fa-language':'fa-solid fa-wand-magic-sparkles'} aria-hidden="true"></i> {t(kind==='translate'?'translate':'summarize')}</button>{#if active}<button class="btn btn-outline-warning" type="button" disabled={cancelRequested} onclick={()=>{void stop();}}>{t('stop')}</button>{/if}{#if (result||dictionary)&&!active}<button class="btn btn-outline-secondary" type="button" onclick={()=>{void copy(false);}}>{copied?t('copied'):kind==='summarize'?t('copyMarkdown'):t('copy')}</button>{#if kind==='summarize'}<button class="btn btn-outline-secondary" type="button" onclick={()=>{void copy(true);}}>{t('copyPlain')}</button>{/if}{/if}<button class="btn btn-outline-secondary" type="button" disabled={active} onclick={reset}>{t('clear')}</button>{#if operation==='FAILED'||operation==='INTERRUPTED'}<button class="btn btn-outline-primary" type="button" onclick={()=>{void submit();}}>{t('retry')}</button>{/if}</div>
    </section>
  </div>
  <aside class="tool-info" aria-label={t('tools')}><p><i class="fa-solid fa-circle-info" aria-hidden="true"></i> {t(kind==='translate'?'translatorInfo1':'summarizerInfo1')}</p><p><i class="fa-solid fa-file-lines" aria-hidden="true"></i> {t(kind==='translate'?'translatorInfo2':'summarizerInfo2')}</p><p><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {t(kind==='translate'?'translatorInfo3':'summarizerInfo3')}</p></aside>
</section>

<style>
  .tool-page{max-width:1300px;margin-inline:auto}.tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem;padding:1.5rem;border:1px solid var(--bs-border-color);border-radius:.4rem;background:var(--bs-body-bg);box-shadow:0 .35rem 1rem rgba(0,0,0,.1)}.language-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem}.language-row :global(> div){max-width:180px}.language-row :global(label),.tool-input-wrap :global(label){position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.language-row :global(.mb-3){margin-bottom:0!important}.tool-input,.tool-result{min-width:0;display:flex;flex-direction:column}.tool-input-wrap{position:relative}.tool-input-wrap :global(.mb-3){margin-bottom:.75rem!important}.tool-input-wrap :global(textarea){min-height:210px;resize:vertical;font-size:1.1rem}.summary .tool-input-wrap :global(textarea){min-height:190px;height:190px}.char-count{position:absolute;inset-block-start:-.55rem;inset-inline-end:.55rem;padding:0 .3rem;background:var(--bs-body-bg);color:var(--bs-secondary-color);font-size:.875rem}.tool-output{flex:1;min-height:210px;padding:1rem;border:1px solid var(--bs-border-color);border-radius:.35rem;overflow-wrap:anywhere;outline:none}.summary .tool-output{min-height:320px}.tool-output:focus-visible{outline:3px solid var(--focus-ring)}.tool-output h4 small{margin-inline-start:.5rem}.tool-result-actions{display:flex;align-items:center;gap:.75rem;min-height:2.5rem}.tool-result-actions{justify-content:flex-end;flex-wrap:wrap;margin-top:.75rem}.tool-result-actions .btn-primary{min-width:8rem}.tool-two{display:grid;grid-template-columns:1fr;gap:.55rem;margin-top:.9rem}.tool-two :global(.mb-3){margin-bottom:0!important}.tool-notice{margin-top:.7rem;color:var(--bs-warning-text-emphasis)}.tool-notice.tool-success{color:var(--bs-success-text-emphasis)}.tool-info{margin-top:1.5rem;padding:1rem 1.25rem;border:1px solid var(--bs-info-border-subtle);border-radius:.35rem;background:var(--bs-info-bg-subtle);color:var(--bs-info-text-emphasis);font-family:var(--bs-body-font-family);font-size:1rem;line-height:1.8}.tool-info p{margin:0 0 .7rem}.tool-info p:last-child{margin-bottom:0}.tool-info i{margin-inline-end:.4rem}@media(max-width:800px){.tool-grid{grid-template-columns:1fr;padding:1rem}.language-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}.tool-output{min-height:220px}.summary .tool-output{min-height:240px}}
</style>
