import type {LayoutServerLoad} from './$types';
import {anonymousBootstrap,TARGOMAN_PUBLIC_BRAND} from '#lib/server/bootstrap.js';
import {createLocale} from '@targoman/ui-core';
import {publicToolText} from '#lib/public-tools/messages.js';
export const load:LayoutServerLoad=({cookies,route,url})=>{
  const locale=cookies.get('ui-locale')==='en'?'en':'fa';
  const themeCookie=cookies.get('ui-theme');
  const theme=themeCookie==='light'||themeCookie==='dark'?themeCookie:'system';
  const i18n=createLocale(locale);
  const publicSurface=route.id?.includes('(public)')??false;
  const bootstrap=anonymousBootstrap(locale,theme,publicSurface?TARGOMAN_PUBLIC_BRAND:undefined);
  const title=route.id?.includes('/translate')?publicToolText(locale,'translatorTitle')
    :route.id?.includes('/summarize')?publicToolText(locale,'summarizer')
    :route.id?.includes('/faq')?publicToolText(locale,'faq')
    :route.id?.includes('admin')?i18n.t('adminTitle')
    :route.id?.includes('dashboard')?i18n.t('userTitle')
    :publicToolText(locale,'tools');
  const service=route.id?.includes('/translate')?'translate':route.id?.includes('/summarize')?'summarize':route.id?.includes('/faq')?'faq':'/';
  const loginParams=new URLSearchParams({back:url.pathname.replace(/^\//,'')+url.search});
  if(service!=='/')loginParams.set('service',service);
  return {bootstrap,publicSurface,loginUrl:`/login?${loginParams.toString()}`,chromeDescriptor:{title,breadcrumbs:[],actions:[]}};
};
