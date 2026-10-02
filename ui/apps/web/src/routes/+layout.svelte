<script lang="ts">
  import {onMount,type Snippet} from 'svelte';
  import {asset,resolve} from '$app/paths';
  import type {LayoutData} from './$types';
  import {clsLayoutChrome,provideLayoutChrome} from '#lib/layout/chrome.svelte.js';
  import {DropdownMenu,provideLocale} from '@targoman/ui-core';
  import {publicToolText} from '#lib/public-tools/messages.js';
  import '#lib/styles/main.scss';
  import bootstrapLtr from 'bootstrap/dist/css/bootstrap.min.css?url';
  import bootstrapRtl from 'bootstrap/dist/css/bootstrap.rtl.min.css?url';
  let {data,children}:{data:LayoutData;children:Snippet}=$props();
  const i18n=provideLocale(()=>data.bootstrap.locale);
  const chrome=new clsLayoutChrome();provideLayoutChrome(chrome);
  let descriptor=$derived(data.chromeDescriptor);
  $effect(()=>{chrome.descriptor=descriptor;});
  let themeOverride=$state<'light'|'dark'|'system'|null>(null);
  let theme=$derived(themeOverride??data.bootstrap.theme);
  let resolved=$state<'light'|'dark'>('light');
  let logo=$derived((theme==='dark'||(theme==='system'&&resolved==='dark'))?data.bootstrap.brand.logoDark??data.bootstrap.brand.logoLight:data.bootstrap.brand.logoLight);
  onMount(()=>{
    const media=matchMedia('(prefers-color-scheme: dark)');
    const update=()=>{resolved=theme==='system'?(media.matches?'dark':'light'):theme;document.documentElement.setAttribute('data-bs-theme',resolved);document.documentElement.dataset.themePreference=theme;};
    update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);
  });
  function changeTheme(value:'light'|'dark'|'system'){
    themeOverride=value;resolved=value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value;
    document.documentElement.setAttribute('data-bs-theme',resolved);document.documentElement.dataset.themePreference=value;
    document.cookie=`ui-theme=${value}; Path=/; SameSite=Lax`;
  }
  function toggleTheme(){changeTheme(resolved==='dark'?'light':'dark');}
  function changeLocale(value:'fa'|'en') {document.cookie=`ui-locale=${value}; Path=/; SameSite=Lax`;location.reload();}
</script>
<svelte:head><title>{descriptor.title} · {data.bootstrap.brand.displayName}</title><link id="bootstrap-css" rel="stylesheet" href={data.bootstrap.direction==='rtl'?bootstrapRtl:bootstrapLtr} /><link rel="stylesheet" href={asset('fonts/iransansx/fontiran.css')} /><link rel="stylesheet" href={asset('fonts/fontawesome/v6.2.0/all.css')} />{#if data.bootstrap.brand.favicon}<link rel="icon" href={data.bootstrap.brand.favicon} />{/if}</svelte:head>
<a class="skip-link btn btn-primary" href="#main">{i18n.t('skip')}</a>
<div class="shell" style:--brand-primary={data.bootstrap.brand.primaryColor}>
  <header class="shell-header">
    <div class="shell-brand">{#if logo}<img src={logo.path} alt={logo.alt} height="42" />{:else}<strong>{data.bootstrap.brand.displayName}</strong>{/if}</div>
    <nav class="shell-title" aria-label={i18n.t('globalNav')}><a href={resolve('/(public)')}>{descriptor.title}</a></nav>
    <div class="shell-tools">
      {#if data.publicSurface}
        <button class="theme-toggle" type="button" aria-label={resolved==='dark'?i18n.t('light'):i18n.t('dark')} aria-pressed={resolved==='dark'} title={resolved==='dark'?i18n.t('light'):i18n.t('dark')} onclick={toggleTheme}><i class="fa-solid fa-gear" aria-hidden="true"></i></button>
        <DropdownMenu>
          {#snippet trigger()}<i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i> {publicToolText(i18n.locale,'otherServices')}{/snippet}
          <a href={resolve('/(public)')}>{i18n.t('home')}</a>
          {#if data.publicModules.includes('translator')}<a href={resolve('/(public)/translate')}>{publicToolText(i18n.locale,'translator')}</a>{/if}
          {#if data.publicModules.includes('summarizer')}<a href={resolve('/(public)/summarize')}>{publicToolText(i18n.locale,'summarizer')}</a>{/if}
          {#if data.publicModules.includes('faq')}<a href={resolve('/(public)/faq')}>{publicToolText(i18n.locale,'faq')}</a>{/if}
          <label for="locale-choice">زبان / Language</label>
          <select id="locale-choice" class="form-select form-select-sm" value={i18n.locale} onchange={event=>changeLocale(event.currentTarget.value as 'fa'|'en')}><option value="fa">فارسی</option><option value="en">English</option></select>
        </DropdownMenu>
        {#if data.loginUrl}<a class="btn btn-primary btn-sm login-link" href={data.loginUrl}><i class="fa-solid fa-user" aria-hidden="true"></i> {publicToolText(i18n.locale,'login')}</a>{/if}
      {:else}
        <span>{data.bootstrap.session.tenant?.label??i18n.t('guest')}</span>
        <label class="visually-hidden" for="locale-choice">زبان / Language</label><select id="locale-choice" class="form-select form-select-sm w-auto" value={i18n.locale} onchange={event=>changeLocale(event.currentTarget.value as 'fa'|'en')}><option value="fa">فارسی</option><option value="en">English</option></select>
        <label class="visually-hidden" for="theme-choice">{i18n.t('theme')}</label><select id="theme-choice" class="form-select form-select-sm w-auto" value={theme} onchange={event=>changeTheme(event.currentTarget.value as 'light'|'dark'|'system')}><option value="light">{i18n.t('light')}</option><option value="dark">{i18n.t('dark')}</option><option value="system">{i18n.t('system')}</option></select>
      {/if}
    </div>
  </header>
  <main id="main" class="shell-main"><h1 class="visually-hidden">{descriptor.title}</h1>{@render children()}</main>
  <footer class="shell-footer"><small>{data.publicSurface&&i18n.locale==='fa'?`کلیه حقوق برای ${data.bootstrap.brand.shortName} محفوظ است`:`© ${data.bootstrap.brand.shortName}`}</small>{#if data.bootstrap.brand.supportUrl}<a href={data.bootstrap.brand.supportUrl}>{i18n.t('support')}</a>{/if}{#if data.bootstrap.brand.legalUrl}<a href={data.bootstrap.brand.legalUrl}>{i18n.t('legal')}</a>{/if}</footer>
</div>
