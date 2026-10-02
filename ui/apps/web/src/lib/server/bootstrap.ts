import {parsePublicBrand} from '@targoman/branding';
import type {intfUiBootstrapView,typUiLocale,typThemePreference} from '@targoman/contracts';
/** Anonymous foundation projection until Identity publishes its SSR bootstrap contract. */
export function anonymousBootstrap(locale:typUiLocale,theme:typThemePreference):intfUiBootstrapView {
  return {brand:parsePublicBrand({version:'foundation-1',displayName:'Workspace',shortName:'Workspace',primaryColor:'#285d84'}),session:{state:'anonymous',switchableTenants:[],capabilityKeys:[]},locale,direction:locale==='fa'?'rtl':'ltr',theme,enabledModules:[]};
}
