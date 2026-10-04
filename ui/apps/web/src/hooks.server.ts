import type {Handle} from '@sveltejs/kit/hooks';
import {deploymentSnapshot} from '#lib/server/deployment.js';
export const handle:Handle=async({event,resolve})=>{
  const locale=event.cookies.get('__Host-ui-locale')==='en'?'en':'fa';
  const themeCookie=event.cookies.get('__Host-ui-theme');
  const theme=themeCookie==='dark'||themeCookie==='light'?themeCookie:'system';
  const dir=locale==='fa'?'rtl':'ltr';
  const response=await resolve(event,{transformPageChunk:({html})=>html.replaceAll('__LANG__',locale).replaceAll('__DIR__',dir).replaceAll('__THEME__',theme==='dark'?'dark':'light').replaceAll('__THEME_PREFERENCE__',theme)});
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('Cross-Origin-Opener-Policy','same-origin');
  response.headers.set('Cross-Origin-Resource-Policy','same-origin');
  if(event.url.pathname.startsWith('/api/')||event.url.pathname==='/login'||event.url.pathname.startsWith('/dashboard')||event.url.pathname.startsWith('/knowledge')||event.url.pathname.startsWith('/admin'))
    response.headers.set('Cache-Control','no-store');
  const csp=response.headers.get('content-security-policy');
  const snapshot=await deploymentSnapshot();
  if(csp&&snapshot.value.auth?.enabled){
    const marker="connect-src 'self'";
    if(!csp.includes(marker))throw new Error('CSP_CONNECT_SOURCE_MISSING');
    response.headers.set('Content-Security-Policy',csp.replace(marker,`${marker} ${snapshot.value.auth.publicOrigin}`));
  }
  return response;
};
