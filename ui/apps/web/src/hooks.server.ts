import type {Handle} from '@sveltejs/kit/hooks';
export const handle:Handle=async({event,resolve})=>{
  const locale=event.cookies.get('ui-locale')==='en'?'en':'fa';
  const themeCookie=event.cookies.get('ui-theme');
  const theme=themeCookie==='dark'||themeCookie==='light'?themeCookie:'system';
  const dir=locale==='fa'?'rtl':'ltr';
  return resolve(event,{transformPageChunk:({html})=>html.replaceAll('__LANG__',locale).replaceAll('__DIR__',dir).replaceAll('__THEME__',theme==='dark'?'dark':'light').replaceAll('__THEME_PREFERENCE__',theme)});
};
