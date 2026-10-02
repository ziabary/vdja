import type {LayoutServerLoad} from './$types';
import {anonymousBootstrap} from '#lib/server/bootstrap.js';
import {createLocale} from '@targoman/ui-core';
export const load:LayoutServerLoad=({cookies,route})=>{
  const locale=cookies.get('ui-locale')==='en'?'en':'fa';
  const themeCookie=cookies.get('ui-theme');
  const theme=themeCookie==='light'||themeCookie==='dark'?themeCookie:'system';
  const bootstrap=anonymousBootstrap(locale,theme);
  const i18n=createLocale(locale);
  const title=route.id?.includes('admin')?i18n.t('adminTitle'):route.id?.includes('dashboard')?i18n.t('userTitle'):i18n.t('publicTitle');
  return {bootstrap,chromeDescriptor:{title,breadcrumbs:[],actions:[]}};
};
