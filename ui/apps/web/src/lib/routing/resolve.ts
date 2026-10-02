import type { intfRouteBinding,typModuleId,typRouteId,typTenantId,typUiSurface } from '@targoman/contracts';
export interface intfResolveRequest {readonly routeId:typRouteId;readonly host:string;readonly tenantId?:typTenantId;readonly enabledModules:readonly typModuleId[];readonly surface:typUiSurface}
export type typRouteResolution={readonly kind:'found';readonly path:string}|{readonly kind:'not-found'|'disabled'|'binding-mismatch'};
function normalizeBase(value:string):string {if(!value.startsWith('/')||value.includes('..')||value.includes('?')||value.includes('#')||value.includes('//'))throw new Error('Invalid base path');return value==='/'?'':value.replace(/\/$/,'');}
export function resolveUiRoute(bindings:readonly intfRouteBinding[],request:intfResolveRequest):typRouteResolution {
  const candidate=bindings.find(binding=>binding.routeId===request.routeId&&binding.surface===request.surface);
  if(!candidate)return {kind:'not-found'};
  if(candidate.moduleId&&!request.enabledModules.includes(candidate.moduleId))return {kind:'disabled'};
  if(candidate.host!==request.host||candidate.tenantId!==request.tenantId)return {kind:'binding-mismatch'};
  if(!candidate.path.startsWith('/')||candidate.path.includes('..')||candidate.path.startsWith('//'))throw new Error('Invalid logical path');
  return {kind:'found',path:`${normalizeBase(candidate.basePath)}${candidate.path}`};
}
