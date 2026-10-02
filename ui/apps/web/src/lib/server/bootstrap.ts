import type { intfBrandProjection, intfUiBootstrapView, typUiLocale, typThemePreference } from '@targoman/contracts';
/** Anonymous foundation projection until Identity publishes its SSR bootstrap contract. */
export function anonymousBootstrap(locale: typUiLocale, theme: typThemePreference, brand: intfBrandProjection, enabledModules: intfUiBootstrapView['enabledModules'] = []): intfUiBootstrapView {
  return { brand, session: { state: 'anonymous', switchableTenants: [], capabilityKeys: [] }, locale, direction: locale === 'fa' ? 'rtl' : 'ltr', theme, enabledModules };
}
