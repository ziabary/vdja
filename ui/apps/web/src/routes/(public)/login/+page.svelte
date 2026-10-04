<script lang="ts">
  import {goto} from '$app/navigation';
  import {resolve} from '$app/paths';
  import {Select,TextInput,useLocale} from '@targoman/ui-core';
  import {useAuthClient,type typLoginOutcome} from '#lib/auth/client.svelte.js';
  import type {PageData} from './$types';
  let {data}:{data:PageData}=$props();
  const auth=useAuthClient(),locale=useLocale();
  let email=$state(''),password=$state(''),key=$state(''),showKey=$state(false),tenantId=$state('');
  let tenantOptions=$state<readonly string[]>([]),busy=$state(false),failed=$state(false),keyGenerated=$state(false);
  let pendingMethod=$state<'LEGACY_KEY'|'DEVELOPMENT_PASSWORD'>('LEGACY_KEY');
  const target=$derived(data.returnTo==='/rag'?resolve('/(user)/rag'):data.returnTo==='/knowledge'?resolve('/(user)/knowledge'):data.returnTo);
  function generateKey(){const bytes=crypto.getRandomValues(new Uint8Array(24));key=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');showKey=true;keyGenerated=true;failed=false;}
  async function submit(method:'LEGACY_KEY'|'DEVELOPMENT_PASSWORD'){
    if(busy)return;busy=true;failed=false;pendingMethod=method;
    try{
      const result:typLoginOutcome=method==='LEGACY_KEY'
        ?await auth.loginLegacyKey(key,tenantId||undefined):await auth.login(email,password,tenantId||undefined);
      if(result.kind==='TENANT_SELECTION_REQUIRED'){tenantOptions=result.tenants;tenantId=result.tenants[0]??'';}
      else if(result.kind==='INVALID')failed=true;
      else{key='';password='';tenantOptions=[];await goto(target);}
    }catch{failed=true;}finally{busy=false;}
  }
</script>

<svelte:head><title>{locale.locale==='fa'?'ورود':'Sign in'} · {data.brandName}</title></svelte:head>
<section class="login-page" aria-label={locale.locale==='fa'?'ورود به حساب':'Sign in'}>
<div class="login-card" dir="rtl">
  <div class="login-card-body">
  <div class="login-brand"><img class="login-logo" src={data.brandLogo} alt={data.brandName} /></div>
  <h2 class="login-title">{locale.locale==='fa'?'ورود به گفتگو':'Sign in'}</h2>
  {#if auth.state.tenantId}
    <p role="status">{locale.locale==='fa'?'نشست فعال برای مستأجر':'Active session for tenant'} <b>{auth.state.tenantId}</b></p>
    <a href={target} class="btn btn-primary">{locale.locale==='fa'?'ورود به گفتگو':'Open chat'}</a>
  {:else}
    {#if data.methods.legacyKey}
      <form onsubmit={event=>{event.preventDefault();void submit('LEGACY_KEY');}} aria-busy={busy}>
        <label class="form-label fw-bold" for="login-legacy-key">کلید اختصاصی (حداقل ۱۶ کاراکتر)</label>
        <div class="input-group"><input id="login-legacy-key" class="form-control form-control-lg" name="legacy-key" type={showKey?'text':'password'} bind:value={key} minlength="16" maxlength="256" autocomplete="off" placeholder="کلید را وارد یا تولید کنید ..." required disabled={busy} />
          <button class="btn btn-outline-secondary login-eye" type="button" aria-label={showKey?'پنهان کردن کلید':'نمایش کلید'} onclick={()=>showKey=!showKey}><i class={showKey?'fa-solid fa-eye-slash':'fa-solid fa-eye'} aria-hidden="true"></i></button></div>
        <p class="login-hint" role={keyGenerated?'status':undefined}>{keyGenerated?'کلید تازه را نزد خود نگه دارید؛ سامانه آن را ذخیره یا بازیابی نمی‌کند.':'کلید را ایمن نگه دارید، قابل بازیابی نیست'}</p>
        {#if tenantOptions.length>1&&pendingMethod==='LEGACY_KEY'}<Select id="login-key-tenant" label="مستأجر" value={tenantId} onChange={value=>tenantId=value} options={tenantOptions.map(value=>({value,label:value}))} required disabled={busy}/>{/if}
        <div class="login-actions">{#if data.methods.legacyKeySelfProvision}<button class="btn btn-outline-primary flex-fill" type="button" onclick={generateKey} disabled={busy}>تولید کلید جدید</button>{/if}<button class="btn btn-primary flex-fill" type="submit" disabled={busy||auth.state.restoring}>ورود به سامانه</button></div>
      </form>
    {/if}
    <div class="login-divider"><span>و یا</span></div>
    {#if data.methods.organizationalOidc}<a class="btn btn-light w-100 login-oidc" href={`${data.authOrigin}/api/auth/oidc/start?returnTo=${encodeURIComponent(data.returnTo)}`}>ورود با حساب سازمانی</a>
    {:else}<button class="btn btn-light w-100 login-oidc" type="button" disabled title="ورود سازمانی هنوز پیکربندی نشده است">ورود با حساب سازمانی</button>{/if}
    {#if data.methods.developmentPassword}
      <form class="mt-4 border-top pt-3" onsubmit={event=>{event.preventDefault();void submit('DEVELOPMENT_PASSWORD');}} aria-busy={busy}>
        <h3 class="h6">ورود توسعه</h3>
        <TextInput id="login-email" label="ایمیل" value={email} onChange={value=>email=value} autocomplete="email" dir="ltr" required disabled={busy}/>
        <div class="mb-3"><label class="form-label" for="login-password">گذرواژه</label><input id="login-password" name="password" type="password" class="form-control" bind:value={password} autocomplete="current-password" required disabled={busy}/></div>
        {#if tenantOptions.length>1&&pendingMethod==='DEVELOPMENT_PASSWORD'}<Select id="login-tenant" label="مستأجر" value={tenantId} onChange={value=>tenantId=value} options={tenantOptions.map(value=>({value,label:value}))} required disabled={busy}/>{/if}
        <button class="btn btn-outline-primary w-100" type="submit" disabled={busy||auth.state.restoring}>ورود توسعه</button>
      </form>
    {/if}
    {#if failed}<p role="alert" class="alert alert-danger mt-3">ورود انجام نشد. کلید و وضعیت ورود را بررسی کنید.</p>{/if}
  {/if}
  </div>
  <div class="login-guidelines" role="note"><p><i class="fa-solid fa-circle-info" aria-hidden="true"></i> کلید ورود جایگزین نام کاربری و گذرواژه است.</p><p><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> کلید خود را به خاطر بسپارید یا در جای امن ذخیره کنید؛ در صورت فراموشی قابل بازیابی نیست.</p></div>
</div>
<small class="login-copyright">کلیه حقوق برای {data.brandName} محفوظ است</small>
</section>
<style>
  .login-page{min-height:100dvh;background:linear-gradient(135deg,#3a6daa 0%,#2c3b88 100%);display:flex;flex-direction:column;align-items:center;padding:clamp(2rem,9vh,7rem) 1rem 2rem;color:#212529}
  .login-card{width:min(100%,540px);background:#fff;border:1px solid #d8dce3;border-radius:.35rem;box-shadow:0 10px 30px #0003;padding:1rem}
  .login-card-body{text-align:center;padding:.2rem 0 .5rem}
  .login-brand{min-height:112px;display:flex;justify-content:center;align-items:center}.login-logo{display:block;max-width:140px;max-height:110px;object-fit:contain}
  .login-title{font-size:1.5rem;margin:.2rem 0 1.4rem;font-weight:600}.login-card form{text-align:center}.login-card .form-label{display:block;margin-bottom:.5rem}
  .login-card .form-control{font-size:1rem}.login-eye{color:#8c97a6;border-color:#dee2e6}.login-hint{font-size:.8rem;color:#6c757d;margin:.35rem 0 1.3rem;min-height:1.4rem}
  .login-actions{display:flex;gap:.5rem;margin-bottom:.7rem}.login-actions .btn{min-width:0}.login-divider{display:flex;align-items:center;gap:.7rem;color:#69727b;font-size:.85rem;margin:.55rem auto .9rem;max-width:400px}.login-divider:before,.login-divider:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,#9aa1a8,transparent)}
  .login-oidc{background:#f5f6f7;border-color:#f5f6f7;color:#30343a}.login-oidc:disabled{opacity:.7;color:#495057}
  .login-guidelines{background:#fff2c8;color:#765510;border:1px solid #ffe69c;border-radius:.35rem;text-align:right;margin:.7rem .25rem .1rem;padding:.9rem 1rem;font-size:.88rem;line-height:1.8}.login-guidelines p{margin:0 0 .65rem}.login-guidelines p:last-child{margin:0}.login-guidelines i{margin-left:.35rem}
  .login-copyright{color:#e0e7f3;margin-top:clamp(2rem,8vh,6rem);text-align:center}
  @media(max-width:480px){.login-page{padding-top:1.5rem}.login-card{padding:.8rem}.login-brand{min-height:85px}.login-logo{max-height:80px}}
</style>
