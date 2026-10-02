import type { intfBrandProjection, intfPublicAssetRef } from '@targoman/contracts';

const COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_PUBLIC_PATH = /^\/(?!\/)(?:[a-zA-Z0-9._~!$&'()+,;=:@%-]+\/)*[a-zA-Z0-9._~!$&'()+,;=:@%-]+$/;
const SAFE_HTTPS = /^https:\/\/[a-zA-Z0-9.-]+(?::443)?(?:\/[a-zA-Z0-9._~!$&'()+,;=:@%/?-]*)?$/;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function safeText(value: unknown, max = 120): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[<>\u0000-\u001f]/u.test(value)) throw new Error('Invalid public brand text');
  return value;
}
function safeUrl(value: unknown): string {
  if (typeof value !== 'string' || !(SAFE_PUBLIC_PATH.test(value) || SAFE_HTTPS.test(value)) || value.includes('..') || /%(?:2e|2f|5c)/i.test(value)) throw new Error('Invalid public brand URL');
  return value;
}
function asset(value: unknown): intfPublicAssetRef | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('Invalid public asset');
  const path=safeUrl(value.path);
  if(!SAFE_PUBLIC_PATH.test(path))throw new Error('Brand assets must use approved same-origin paths');
  return { path, alt: safeText(value.alt) };
}
export function parsePublicBrand(value: unknown): intfBrandProjection {
  if (!isRecord(value)) throw new Error('Invalid brand projection');
  const primaryColor = value.primaryColor;
  if (typeof primaryColor !== 'string' || !COLOR.test(primaryColor)) throw new Error('Invalid brand color');
  return {
    version: safeText(value.version, 60), displayName: safeText(value.displayName), shortName: safeText(value.shortName),
    primaryColor, logoLight: asset(value.logoLight), logoDark: asset(value.logoDark),
    favicon: value.favicon === undefined ? undefined : asset({path:value.favicon,alt:'Favicon'})?.path,
    supportUrl: value.supportUrl === undefined ? undefined : safeUrl(value.supportUrl),
    legalUrl: value.legalUrl === undefined ? undefined : safeUrl(value.legalUrl)
  };
}
export function brandTokens(brand: intfBrandProjection): Readonly<Record<string, string>> {
  return { '--brand-primary': brand.primaryColor };
}
