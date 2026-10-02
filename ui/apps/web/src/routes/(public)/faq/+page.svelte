<script lang="ts">
  import {onMount} from 'svelte';
  import {Select,NumberInput,TextInput,FileDropInput,transitionAiOperation,normalizeNumericDigits,useLocale,type typAiOperationState} from '@targoman/ui-core';
  import {createPublicToolsClient,type intfFaqItem,type intfFaqMeta} from '#lib/api/publicTools.js';
  import {publicToolText,type typPublicToolMessage} from '#lib/public-tools/messages.js';
  const locale=useLocale();const t=(key:typPublicToolMessage)=>publicToolText(locale.locale,key);
  let client:ReturnType<typeof createPublicToolsClient>|null=null,controller:AbortController|null=null,selection=0;
  let file=$state<File|null>(null),meta=$state<intfFaqMeta|null>(null),items=$state<intfFaqItem[]>([]),expanded=$state<number[]>([]);
  let inspectState=$state<'IDLE'|'READING'|'FAILED'>('IDLE'),operation=$state<typAiOperationState>('IDLE');
  let answerWords=$state('100'),language=$state('source'),tone=$state('formal'),scope=$state('all'),from=$state('1'),to=$state('1'),focus=$state('');
  let error=$state(''),notice=$state(''),produced=$state(0),total=$state(10),copied=$state(false);
  const active=$derived(operation==='SUBMITTING'||operation==='STREAMING'||operation==='COMPLETING');
  onMount(()=>{client=createPublicToolsClient();return()=>{selection++;controller?.abort();};});
  function parseNumber(value:string):number{return Number(normalizeNumericDigits(value));}
  async function selectFile(next:File|undefined){if(!next||!client||active)return;const current=++selection;
    if(!/\.(?:pdf|doc|docx|odt|txt|md)$/i.test(next.name)){error=t('invalidFile');return;}
    file=next;meta=null;items=[];expanded=[];error='';notice='';inspectState='READING';
    try{const inspected=await client.inspectFaq(next);if(current!==selection)return;meta=inspected;from='1';to=String(inspected.pageCount);inspectState='IDLE';}
    catch{if(current!==selection)return;inspectState='FAILED';file=null;error=t('fileReadFailed');}
  }
  function faqMarkdown():string{return items.map((item,index)=>`## ${index+1}. ${item.question}\n\n${item.answer}${item.section?`\n\n*${t('section')}: ${item.section}*`:''}`).join('\n\n');}
  async function copy(){try{await navigator.clipboard.writeText(faqMarkdown());copied=true;setTimeout(()=>copied=false,1500);}catch{error=t('failed');}}
  function download(format:'md'|'json'){const data=format==='md'?faqMarkdown():JSON.stringify(items,null,2);const blob=new Blob([data],{type:format==='md'?'text/markdown;charset=utf-8':'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`faq.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function toggle(index:number){expanded=expanded.includes(index)?expanded.filter(value=>value!==index):[...expanded,index];}
  function errorMessage(cause:unknown):string{if(cause instanceof Error&&(cause.message==='INTERRUPTED'||cause.message==='IDLE_OR_TOTAL_TIMEOUT'))return t('interrupted');return t('failed');}
  async function generate(append:boolean){if(active||!client||!file||!meta||inspectState!=='IDLE')return;
    const count=Math.min(10,100-(append?items.length:0));if(count<1)return;
    const answer=parseNumber(answerWords),start=parseNumber(from),end=parseNumber(to);
    if(![50,100,180,250].includes(answer)){error=t('answerLength');return;}
    if(scope==='range'&&(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>meta.pageCount)){error=t('rangeInvalid');return;}
    if(operation!=='IDLE')operation=transitionAiOperation(operation,'RESET');operation=transitionAiOperation(operation,'SUBMIT');
    if(!append){items=[];expanded=[];}error='';notice='';produced=0;total=count;controller=new AbortController();
    try{operation=transitionAiOperation(operation,'STREAM_START');await client.generateFaq({file,count,answerWords:answer,tone:tone as 'formal'|'conversational',language:language as 'source'|'fa'|'en',scope:scope as 'all'|'range'|'focus',from:start,to:end,focus,priorQuestions:append?items.map(item=>item.question):[]},
      metaEvent=>{total=metaEvent.count;},(batch,batchProduced)=>{items=[...items,...batch];produced=batchProduced;},controller.signal);
      if(!items.length)throw new Error('NO_FAQ');operation=transitionAiOperation(operation,'TERMINAL_SUCCESS');operation=transitionAiOperation(operation,'CONFIRM_RESULT');notice=t('success');
    }catch(cause){operation=transitionAiOperation(operation,cause instanceof Error&&cause.message==='INTERRUPTED'?'INTERRUPT':'FAIL');error=errorMessage(cause);}
    finally{controller=null;}
  }
</script>

<svelte:head><title>{t('faq')}</title></svelte:head>
<section class="faq-page">
  <div class="faq-grid"><form class="faq-card" aria-busy={active||inspectState==='READING'} onsubmit={event=>{event.preventDefault();void generate(false);}}>
    <h3>{t('faqFileTitle')}</h3><FileDropInput id="faq-file" accept=".pdf,.doc,.docx,.odt,.txt,.md" chooseLabel={t('chooseFile')} prompt={t('dropFile')} hint="PDF · DOC · DOCX · ODT · TXT · MD" fileName={file?.name} disabled={active||inspectState==='READING'} onFile={next=>{void selectFile(next);}}/>
    {#if inspectState==='READING'}<p role="status">{t('inspecting')}</p>{/if}{#if meta}<p class="text-body-secondary" class:fa-num={locale.locale==='fa'} role="status">{meta.pageCount} · {meta.sourceChars} {t('chars')}</p>{/if}
    <div class="faq-fields"><Select id="answer-words" label={t('answerLength')} value={answerWords} options={[{value:'50',label:t('short')},{value:'100',label:t('medium')},{value:'180',label:t('long')},{value:'250',label:t('maximum')}]} onChange={value=>answerWords=value} disabled={active}/><Select id="faq-language" label={t('language')} value={language} options={[{value:'source',label:t('sourceLanguage')},{value:'fa',label:t('persian')},{value:'en',label:t('english')}]} onChange={value=>language=value} disabled={active}/><Select id="faq-tone" label={t('tone')} value={tone} options={[{value:'formal',label:t('formal')},{value:'conversational',label:t('conversational')}]} onChange={value=>tone=value} disabled={active}/><Select id="faq-scope" label={t('scope')} value={scope} options={[{value:'all',label:t('all')},{value:'range',label:t('range')},{value:'focus',label:t('focused')}]} onChange={value=>scope=value} disabled={active}/></div>
    {#if scope==='range'}<div class="faq-fields"><NumberInput id="faq-from" label={t('rangeFrom')} value={from} onChange={value=>from=value} mode="integer" faNum={locale.locale==='fa'} disabled={active}/><NumberInput id="faq-to" label={t('rangeTo')} value={to} onChange={value=>to=value} mode="integer" faNum={locale.locale==='fa'} disabled={active}/></div>{:else if scope==='focus'}<TextInput id="faq-focus" label={t('focus')} value={focus} onChange={value=>focus=value.slice(0,500)} disabled={active}/>{/if}
    {#if notice}<p role="status" class="faq-notice">{notice}</p>{/if}{#if error}<p role="alert" class="alert alert-danger">{error}</p>{/if}
    {#if active}<div role="status" class="faq-progress"><span>{t('streaming')}</span><progress value={produced} max={total}></progress><span class:fa-num={locale.locale==='fa'}>{produced} / {total}</span></div>{/if}
    <button class="btn btn-primary faq-generate" type="submit" disabled={!meta||active||inspectState==='READING'}><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> {t('generate')}</button>
  </form>
  <section class="faq-card" aria-busy={active}><header class="faq-result-heading"><h3>{t('faqPreview')}</h3>{#if items.length}<div class="faq-result-actions"><button class="btn btn-sm btn-outline-secondary" type="button" onclick={()=>{void copy();}}>{copied?t('copied'):t('copy')}</button><button class="btn btn-sm btn-outline-secondary" type="button" onclick={()=>download('md')}>{t('downloadMarkdown')}</button><button class="btn btn-sm btn-outline-secondary" type="button" onclick={()=>download('json')}>{t('downloadJson')}</button></div>{/if}</header>
    {#if items.length}<div class="faq-items">{#each items as item,index}<article class="faq-item"><button class="faq-question" type="button" aria-expanded={expanded.includes(index)} onclick={()=>toggle(index)}><span><span class:fa-num={locale.locale==='fa'}>{index+1}.</span> {item.question}</span><i class={expanded.includes(index)?'fa-solid fa-chevron-up':'fa-solid fa-chevron-down'} aria-hidden="true"></i></button>{#if expanded.includes(index)}<div class="faq-answer">{item.answer}{#if item.section}<p class="faq-section"><i class="fa-regular fa-bookmark" aria-hidden="true"></i> {t('section')}: {item.section}</p>{/if}</div>{/if}</article>{/each}</div>
      <div class="faq-footer"><span class:fa-num={locale.locale==='fa'}>{items.length} {t('itemsMade')}</span><button class="btn btn-outline-primary" type="button" disabled={active||items.length>=100} onclick={()=>{void generate(true);}}>{t('generateMore')}</button></div>
    {:else}<div class="faq-empty"><i class="fa-regular fa-circle-question" aria-hidden="true"></i><p>{t('faqEmpty')}</p></div>{/if}
    {#if operation==='FAILED'||operation==='INTERRUPTED'}<button class="btn btn-outline-primary" type="button" onclick={()=>{void generate(items.length>0);}}>{t('retry')}</button>{/if}
  </section></div>
  <aside class="faq-info" aria-label={t('faq')}><p><i class="fa-solid fa-circle-info" aria-hidden="true"></i> {t('faqInfo1')}</p><p><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {t('faqInfo2')}</p></aside>
</section>
<style>
  .faq-page{max-width:1300px;margin-inline:auto}.faq-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:1.25rem}.faq-card{min-width:0;padding:1.5rem;border:1px solid var(--bs-border-color);border-radius:.4rem;background:var(--bs-body-bg);box-shadow:0 .35rem 1rem rgba(0,0,0,.1)}.faq-card h3{font-size:1.1rem}.faq-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:1rem}.faq-generate{width:100%;margin-top:1rem}.faq-progress{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}.faq-progress progress{flex:1;min-width:7rem}.faq-notice{color:var(--bs-success-text-emphasis)}.faq-result-heading,.faq-result-actions,.faq-footer{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap}.faq-result-heading{border-bottom:1px solid var(--bs-border-color);padding-bottom:.75rem;margin-bottom:1rem}.faq-result-heading h3{margin:0}.faq-items{max-height:65vh;overflow:auto}.faq-item{border:1px solid var(--bs-border-color);border-radius:.4rem;overflow:hidden;margin-bottom:.75rem}.faq-question{width:100%;padding:1rem;display:flex;justify-content:space-between;gap:1rem;text-align:start;border:0;background:var(--bs-tertiary-bg);color:var(--bs-body-color);font-weight:700}.faq-answer{padding:1rem;white-space:pre-wrap;line-height:1.8}.faq-section{font-size:.8rem;color:var(--bs-secondary-color);margin-top:.75rem}.faq-footer{margin-top:1rem}.faq-empty{min-height:20rem;display:grid;place-content:center;text-align:center;color:var(--bs-secondary-color)}.faq-empty i{font-size:3rem;margin-bottom:1rem}.faq-info{margin-top:1.5rem;padding:1rem 1.25rem;border:1px solid var(--bs-info-border-subtle);border-radius:.35rem;background:var(--bs-info-bg-subtle);color:var(--bs-info-text-emphasis);font-family:var(--bs-body-font-family);font-size:1rem;line-height:1.8}.faq-info p{margin:0 0 .7rem}.faq-info p:last-child{margin:0}.faq-info i{margin-inline-end:.4rem}@media(max-width:850px){.faq-grid{grid-template-columns:1fr}.faq-card{padding:1rem}}@media(max-width:500px){.faq-fields{grid-template-columns:1fr}}
</style>
