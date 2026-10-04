import {parsePublicBrand} from '@targoman/branding';
import {loadConfiguration,type intfConfigurationSnapshot,type typModuleId} from '@targoman/configuration';
import type {intfBrandProjection,typModuleId as typUiModuleId} from '@targoman/contracts';

let pending:Promise<intfConfigurationSnapshot>|undefined;
function configPath():string{
  if(process.env.TARGOMAN_CONFIG_PATH)return process.env.TARGOMAN_CONFIG_PATH;
  if(import.meta.env.DEV)return new URL('../../../../../deploy/examples/development/platform.cjson',import.meta.url).pathname;
  return '/etc/targoman/platform.cjson';
}
export function deploymentSnapshot():Promise<intfConfigurationSnapshot>{return pending??=loadConfiguration(configPath());}
export function enabledPublicModules(snapshot:intfConfigurationSnapshot):readonly typModuleId[]{return (['translator','summarizer','faq'] as const).filter(id=>snapshot.value.modules[id].enabled);}
export function publicBrand(snapshot:intfConfigurationSnapshot):intfBrandProjection{
  const {brand}=snapshot.value;
  return parsePublicBrand({version:snapshot.fingerprint.slice(0,12),displayName:brand.displayName,shortName:brand.shortName,
    primaryColor:brand.primaryColor,logoLight:{path:brand.logoLight??brand.logo,alt:brand.displayName},logoDark:{path:brand.logo,alt:brand.displayName},
    favicon:brand.favicon,supportUrl:brand.supportUrl,legalUrl:brand.legalUrl});
}
export function enabledUiModules(snapshot:intfConfigurationSnapshot):readonly typUiModuleId[]{return enabledPublicModules(snapshot) as readonly typUiModuleId[];}
