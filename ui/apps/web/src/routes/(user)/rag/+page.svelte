<script lang="ts">
  import {onMount} from 'svelte';
  import {goto} from '$app/navigation';
  import {resolve} from '$app/paths';
  import {MarkdownView} from '@targoman/ui-core';
  import type {intfKnowledgeCitationView,intfKnowledgeDocumentView} from '@targoman/contracts/knowledge';
  import {useAuthClient} from '#lib/auth/client.svelte.js';
  import {createKnowledgeClient} from '#lib/knowledge/client.js';
  import type {PageData} from './$types';
  let {data}:{data:PageData}=$props();
  type Chat=Readonly<{id:string;title:string;updatedAt:string}>;
  type Message=Readonly<{id:string;role:'USER'|'ASSISTANT';text:string;citations:readonly intfKnowledgeCitationView[]}>;
  type DocumentRow=Readonly<{id:string;title:string;state:string;currentVersionId:string|null}>;
  const auth=useAuthClient(),client=createKnowledgeClient(auth);
  let chats=$state<readonly Chat[]>([]),selectedChat=$state<string|null>(null),messages=$state<readonly Message[]>([]);
  let documents=$state<readonly DocumentRow[]>([]),question=$state(''),busy=$state(false),uploading=$state(false),progress=$state(0);
  let error=$state(''),notice=$state(''),source=$state(''),sidebarOpen=$state(false),ready=$state(false);
  let uploadInput:HTMLInputElement,composer:HTMLTextAreaElement,transcript:HTMLElement;
  let controller:AbortController|null=null;
  function friendly(cause:unknown):string{
    const code=cause instanceof Error?cause.message:'';
    if(code==='FILE_TOO_LARGE')return 'حجم فایل بیش از حد مجاز است.';
    if(code==='INDEX_NOT_READY')return 'سند هنوز در حال پردازش است.';
    if(code==='ABORTED'||code==='CANCELLED')return 'درخواست متوقف شد.';
    if(!data.modelConfigured)return 'مدل موردنیاز برای پرسش از اسناد هنوز تنظیم نشده است.';
    return 'سرویس موقتاً در دسترس نیست. دوباره تلاش کنید.';
  }
  async function refreshDocuments(signal?:AbortSignal){
    const personal=await client.personal(signal),ids=new Set(personal.memberships);
    const found:intfKnowledgeDocumentView[]=[];let cursor:string|null=null;
    for(let page=0;page<40;page+=1){const result=await client.documents(cursor,signal);found.push(...result.items.filter(item=>ids.has(item.id)));
      if(!result.hasMore||!result.nextCursor)break;cursor=result.nextCursor;}
    documents=await Promise.all(found.map(async item=>{
      const versions=await client.versions(item.id,signal);const current=versions.find(value=>value.id===item.currentVersionId);
      return{id:item.id,title:item.title,currentVersionId:item.currentVersionId,state:current?.processingState??'PENDING'};
    }));
  }
  async function load(){if(!auth.state.token||!data.modelConfigured)return;
    try{const [list]=await Promise.all([client.chats(),refreshDocuments()]);chats=list;ready=true;error='';}
    catch(cause){error=friendly(cause);}
  }
  $effect(()=>{if(auth.state.restoring)return;if(!auth.state.token){void goto(`${resolve('/(public)/login')}?back=rag`);return;}
    void load();});
  onMount(()=>{const timer=setInterval(()=>{if(auth.state.token&&data.modelConfigured&&!busy&&!uploading)void refreshDocuments().catch(()=>{});},5000);
    return()=>{clearInterval(timer);controller?.abort();};});
  async function openChat(id:string){if(busy)return;selectedChat=id;sidebarOpen=false;error='';
    try{messages=await client.messages(id);requestAnimationFrame(()=>transcript?.scrollTo({top:transcript.scrollHeight}));}
    catch(cause){error=friendly(cause);}
  }
  async function newChat(){if(busy)return;error='';
    try{const id=await client.createChat();chats=await client.chats();selectedChat=id;messages=[];sidebarOpen=false;composer?.focus();}
    catch(cause){error=friendly(cause);}
  }
  async function removeChat(id:string){if(!confirm('این گفتگو حذف شود؟'))return;
    try{await client.retireChat(id);chats=await client.chats();if(selectedChat===id){selectedChat=null;messages=[];}}
    catch(cause){error=friendly(cause);}
  }
  async function removeAllChats(){if(!chats.length||!confirm('همه گفتگوها حذف شوند؟'))return;
    try{await client.retireAllChats();chats=[];selectedChat=null;messages=[];}
    catch(cause){error=friendly(cause);}
  }
  async function removeDocument(id:string){if(!confirm('این سند حذف شود؟'))return;
    try{await client.removePersonalDocument(id);await refreshDocuments();}
    catch(cause){error=friendly(cause);}
  }
  async function removeAllDocuments(){if(!documents.length||!confirm('همه اسناد حذف شوند؟'))return;
    for(const item of documents){try{await client.removePersonalDocument(item.id);}catch(cause){error=friendly(cause);break;}}
    await refreshDocuments().catch(()=>{});
  }
  async function upload(files:FileList|null){if(!files?.length||uploading||!data.modelConfigured)return;
    uploading=true;error='';notice='در حال بارگذاری';progress=0;
    try{for(const file of Array.from(files)){
      const created=await client.createDocument(file.name,'LOW');
      const transfer=await client.upload(created.id,file,data.maxUploadBytes,null,value=>{progress=value;});
      if(!transfer.versionId)throw new Error('UPLOAD_INCOMPLETE');
      await client.attachPersonal(created.id);
      notice='در حال پردازش';await refreshDocuments();
    }notice='در حال آماده‌سازی';}
    catch(cause){error=friendly(cause);notice='خطا';}
    finally{uploading=false;if(uploadInput)uploadInput.value='';}
  }
  async function send(){const value=question.trim();if(!value||busy||!data.modelConfigured)return;
    busy=true;error='';question='';const active=new AbortController();controller=active;
    try{let id=selectedChat;if(!id){id=await client.createChat(active.signal);selectedChat=id;chats=await client.chats(active.signal);}
      const user:Message={id:crypto.randomUUID(),role:'USER',text:value,citations:[]};
      const assistant:Message={id:crypto.randomUUID(),role:'ASSISTANT',text:'',citations:[]};
      messages=[...messages,user,assistant];requestAnimationFrame(()=>transcript?.scrollTo({top:transcript.scrollHeight}));
      const result=await client.askChat(id,value,active.signal,text=>{messages=messages.map(item=>item.id===assistant.id?{...item,text}:item);});
      messages=messages.map(item=>item.id===assistant.id?{...item,text:result.answer,citations:result.citations}:item);
      chats=await client.chats(active.signal);
    }catch(cause){messages=messages.filter(item=>item.text!=='');error=friendly(cause);}
    finally{busy=false;controller=null;composer?.focus();}
  }
  async function readCitation(citation:intfKnowledgeCitationView){if(!citation.mayRead)return;
    try{source=await client.read(citation.documentId,citation.versionId);}catch(cause){error=friendly(cause);}
  }
  const suggestions=['این سند راجع به چی بود؟','این فایل رو برام خلاصه می‌کنی؟'];
</script>

<svelte:head><title>چت با اسناد · {data.brandName}</title></svelte:head>
<div class="rag-workspace" dir="rtl">
  <button class="btn btn-outline-light rag-mobile-toggle" type="button" onclick={()=>sidebarOpen=!sidebarOpen} aria-label="نمایش فهرست"><i class="fa-solid fa-bars"></i></button>
  <aside class:open={sidebarOpen} class="rag-sidebar" aria-label="گفتگوها و اسناد">
    <div class="rag-brand"><img src={data.brandLogo} alt="" /><span>{data.brandName}</span><button class="btn btn-sm btn-outline-light rag-close" type="button" onclick={()=>sidebarOpen=false} aria-label="بستن">×</button></div>
    <section class="rag-side-section"><div class="rag-side-title"><h2>چت‌های شما</h2><button id="rag-new-chat" class="btn btn-outline-primary btn-sm" type="button" onclick={newChat} disabled={!ready}>＋ جدید</button><button class="btn btn-outline-danger btn-sm" type="button" onclick={removeAllChats} disabled={!chats.length}>حذف همه</button></div>
      <div class="rag-list">{#each chats as chat (chat.id)}<div class:active={selectedChat===chat.id} class="rag-row"><button class="rag-row-main" type="button" onclick={()=>openChat(chat.id)}>{chat.title}</button><button class="rag-remove" type="button" onclick={()=>removeChat(chat.id)} aria-label="حذف گفتگو">×</button></div>{:else}<p class="rag-muted">هنوز گفتگویی ندارید</p>{/each}</div>
    </section>
    <section class="rag-side-section"><div class="rag-side-title"><h2>اسناد شما</h2><button class="btn btn-outline-danger btn-sm" type="button" onclick={removeAllDocuments} disabled={!documents.length}>حذف همه</button></div>
      <div class="rag-list">{#each documents as document (document.id)}<div class="rag-row"><div class="rag-row-main"><span>{document.title}</span><small>{document.state==='READY'?'آماده':document.state==='FAILED'?'خطا':document.state==='PROCESSING'?'در حال پردازش':'در حال آماده‌سازی'}</small></div><button class="rag-remove" type="button" onclick={()=>removeDocument(document.id)} aria-label="حذف سند">×</button></div>{:else}<p class="rag-muted">هنوز هیچ سندی بارگذاری نکردید</p>{/each}</div>
      <button class="btn btn-outline-primary btn-sm" type="button" onclick={()=>uploadInput?.click()} disabled={uploading||!ready}><i class="fa-solid fa-paperclip"></i> آپلود سند جدید</button>
      {#if uploading||notice}<p class="rag-muted" role="status">{notice}{uploading?` ${progress}٪`:''}</p>{/if}
    </section>
    <div class="rag-side-footer"><a href={resolve('/(public)')}>سایر خدمات</a><button class="btn btn-link btn-sm" type="button" onclick={()=>{void auth.logout();}}>خروج</button></div>
  </aside>
  <main class:rag-start={!messages.length} class="rag-main"><header class="rag-chat-header"><h2>{selectedChat?chats.find(chat=>chat.id===selectedChat)?.title??'گفتگو':'چت با اسناد'}</h2></header>
    {#if !data.modelConfigured}<p class="rag-notice" role="status">مدل موردنیاز برای پرسش از اسناد هنوز تنظیم نشده است.</p>{/if}
    {#if error}<p class="alert alert-danger rag-error" role="alert">{error}</p>{/if}
    <div id="rag-transcript" class="rag-transcript" bind:this={transcript} aria-live="polite">
      {#if !messages.length}<div class="rag-empty"><p>با {data.brandName} می‌تونی از اسناد خودت سؤال بپرسی.</p><p>فایل‌هایت را آپلود کن و بعد سؤال خودت را بنویس.</p></div>{/if}
      {#each messages as message (message.id)}<article class:rag-user={message.role==='USER'} class:rag-assistant={message.role==='ASSISTANT'} class="rag-message">
        {#if message.text}<MarkdownView source={message.text}/>{:else}<span class="rag-thinking">در حال پاسخ‌گویی…</span>{/if}
        {#if message.citations.length}<div class="rag-citations">{#each message.citations as citation (citation.chunkId)}<button type="button" class="btn btn-link btn-sm" onclick={()=>readCitation(citation)} disabled={!citation.mayRead}>منبع: {documents.find(document=>document.id===citation.documentId)?.title??citation.label}</button>{/each}</div>{/if}
      </article>{/each}
    </div>
    <div class="rag-composer"><div class="rag-input"><textarea id="rag-question" bind:this={composer} bind:value={question} placeholder="هر چی می‌خوای بپرس…" aria-label="پرسش" onkeydown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send();}}}></textarea>
      <button type="button" class="btn btn-link" onclick={()=>uploadInput?.click()} aria-label="افزودن سند" disabled={uploading||!ready}><i class="fa-solid fa-paperclip"></i></button>
      {#if busy}<button type="button" class="btn btn-link" onclick={()=>controller?.abort()} aria-label="توقف"><i class="fa-solid fa-stop"></i></button>{:else}<button id="rag-send" type="button" class="btn btn-link" onclick={send} aria-label="ارسال" disabled={!question.trim()||!ready}><i class="fa-solid fa-paper-plane"></i></button>{/if}</div>
      {#if !messages.length}<div class="rag-suggestions">{#each suggestions as suggestion}<button type="button" class="btn btn-outline-secondary btn-sm" onclick={()=>{question=suggestion;composer?.focus();}}>{suggestion}</button>{/each}</div>{/if}
    </div>
  </main>
  <input id="rag-upload" bind:this={uploadInput} class="visually-hidden" type="file" accept=".txt,.md,.pdf,.doc,.docx,.odt" multiple onchange={event=>upload(event.currentTarget.files)} aria-label="انتخاب سند" />
  {#if source}<div class="rag-source-backdrop" role="presentation"><div class="rag-source card" role="dialog" aria-modal="true" aria-label="متن منبع"><button type="button" class="btn btn-outline-secondary btn-sm" onclick={()=>source=''}>بستن</button><pre>{source}</pre></div></div>{/if}
</div>
<style>
  .rag-workspace{display:flex;width:100%;min-width:0;min-height:100dvh;background:#202428;color:#f3f5f8;position:relative}
  .rag-sidebar{width:350px;flex:none;background:#15191d;border-left:1px solid #3b4249;padding:1.2rem;display:flex;flex-direction:column;gap:1.4rem;min-height:100%;}
  .rag-brand{display:flex;align-items:center;gap:.6rem;font-weight:700;min-height:2.8rem}.rag-brand img{max-width:7rem;max-height:2.8rem;object-fit:contain}.rag-brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rag-side-section{min-height:0}.rag-side-title{display:flex;align-items:center;gap:.35rem;margin-bottom:.5rem;flex-wrap:wrap}.rag-side-title h2{font-size:1rem;margin:0;flex:1;min-width:7rem}.rag-side-title .btn{font-size:.7rem}
  .rag-list{max-height:27vh;overflow:auto;margin-bottom:.8rem}.rag-row{display:flex;align-items:center;gap:.3rem;border-radius:.4rem;margin:.2rem 0;padding:.2rem;background:#222830}.rag-row.active{background:#264665}.rag-row-main{flex:1;min-width:0;background:none;border:0;color:inherit;text-align:right;padding:.45rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rag-row-main small{display:block;color:#9ca9b7}.rag-remove{border:0;background:none;color:#e99898;font-size:1.4rem}.rag-muted{color:#aab3bd;font-size:.85rem}.rag-side-footer{margin-top:auto;border-top:1px solid #39434d;padding-top:1rem}.rag-side-footer a{color:#b9d8ff}
  .rag-main{flex:1;min-width:0;display:flex;flex-direction:column;max-height:100dvh;padding:1.2rem clamp(1rem,3vw,3rem)}.rag-chat-header{border-bottom:1px solid #4b5158;padding-bottom:.7rem}.rag-chat-header h2{font-size:1.15rem;margin:0}.rag-transcript{flex:1;min-height:8rem;overflow:auto;padding:1rem .2rem}.rag-empty{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#d1d7de;font-size:1.15rem}.rag-empty p{margin:.2rem}.rag-message{max-width:82%;padding:.85rem 1rem;border-radius:.8rem;margin:.7rem 0;overflow-wrap:anywhere}.rag-user{background:#174b83;margin-left:auto}.rag-assistant{background:#313940;margin-right:auto}.rag-thinking{opacity:.75}.rag-citations{border-top:1px solid #66717d;margin-top:.5rem}.rag-citations .btn{color:#b7d8ff}.rag-composer{padding:.6rem 0}.rag-input{display:flex;align-items:flex-end;border:1px solid #67717c;border-radius:.6rem;background:#252b32}.rag-input textarea{flex:1;min-width:0;min-height:3rem;max-height:10rem;resize:vertical;background:transparent;border:0;color:white;padding:.8rem;outline:none}.rag-input .btn{color:#a5cbff}.rag-suggestions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem}.rag-suggestions .btn{font-size:.75rem}.rag-notice{margin:.6rem 0;padding:.45rem .7rem;background:#4a3d25;border-radius:.4rem;font-size:.85rem}.rag-error{margin:.6rem 0}.rag-mobile-toggle,.rag-close{display:none}.rag-source-backdrop{position:fixed;inset:0;background:#000a;z-index:1200;display:grid;place-items:center;padding:1rem}.rag-source{width:min(50rem,100%);max-height:80vh;padding:1rem}.rag-source pre{overflow:auto;white-space:pre-wrap;direction:auto}
  .rag-start .rag-transcript{flex:none;min-height:0;overflow:visible;margin-top:auto;padding-bottom:.5rem}.rag-start .rag-empty{height:auto}.rag-start .rag-composer{margin-bottom:auto;width:100%;padding-bottom:clamp(5rem,13vh,10rem)}
  @media(max-width:900px){.rag-sidebar{position:fixed;right:0;top:0;height:100dvh;z-index:1100;transform:translateX(101%);transition:transform .2s}.rag-sidebar.open{transform:none}.rag-mobile-toggle{display:block;position:absolute;top:.6rem;left:.6rem;z-index:2}.rag-close{display:block;margin-right:auto}.rag-main{padding-top:3.2rem}.rag-message{max-width:95%}}
</style>
