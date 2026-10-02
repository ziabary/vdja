import type {LayoutServerLoad} from './$types';
import {anonymousBootstrap} from '#lib/server/bootstrap.js';
import {deploymentSnapshot,enabledPublicModules,enabledUiModules,publicBrand} from '#lib/server/deployment.js';
import {createLocale} from '@targoman/ui-core';
import {publicToolText} from '#lib/public-tools/messages.js';
export const load:LayoutServerLoad=async ({cookies,route})=>{
  const snapshot=await deploymentSnapshot();
  const locale=cookies.get('ui-locale')==='en'?'en':'fa';
  const themeCookie=cookies.get('ui-theme');
  const theme=themeCookie==='light'||themeCookie==='dark'?themeCookie:'system';
  const i18n=createLocale(locale);
  const publicSurface=route.id?.includes('(public)')??false;
  const bootstrap=anonymousBootstrap(locale,theme,publicBrand(snapshot),enabledUiModules(snapshot));
  const title=route.id?.includes('/translate')?publicToolText(locale,'translatorTitle')
    :route.id?.includes('/summarize')?publicToolText(locale,'summarizer')
    :route.id?.includes('/faq')?publicToolText(locale,'faq')
    :route.id?.includes('admin')?i18n.t('adminTitle')
    :route.id?.includes('dashboard')?i18n.t('userTitle')
    :publicToolText(locale,'tools');
  return {bootstrap,publicSurface,publicModules:enabledPublicModules(snapshot),loginUrl:null,chromeDescriptor:{title,breadcrumbs:[],actions:[]}};
};
