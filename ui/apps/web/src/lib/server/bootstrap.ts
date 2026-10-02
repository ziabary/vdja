import { parsePublicBrand } from '@targoman/branding';
import type { intfBrandProjection, intfUiBootstrapView, typUiLocale, typThemePreference } from '@targoman/contracts';
const NEUTRAL_BRAND = parsePublicBrand({ version: 'foundation-1', displayName: 'Workspace', shortName: 'Workspace', primaryColor: '#285d84' });
/** Deployment profile for the Targoman-hosted anonymous public tools. */
export const TARGOMAN_PUBLIC_BRAND = parsePublicBrand(
  {
    version: 'public-tools-1', displayName: 'ترگمان', shortName: 'شرکت پردازش هوشمند ترگمان', primaryColor: '#0d6efd',
    logoLight: { path: '/brand/targoman-logo-light.png', alt: 'ترگمان' },
    logoDark: { path: '/brand/targoman-logo-dark.png', alt: 'ترگمان' }
  });
/** Anonymous foundation projection until Identity publishes its SSR bootstrap contract. */
export function anonymousBootstrap(locale: typUiLocale, theme: typThemePreference, brand: intfBrandProjection = NEUTRAL_BRAND): intfUiBootstrapView {
  return { brand, session: { state: 'anonymous', switchableTenants: [], capabilityKeys: [] }, locale, direction: locale === 'fa' ? 'rtl' : 'ltr', theme, enabledModules: [] };
}
