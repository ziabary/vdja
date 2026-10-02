import type {intfSessionBootstrapView,intfTenantView} from '@targoman/contracts';
export type typSessionUxState='ANONYMOUS'|'AUTHENTICATING'|'AUTHENTICATED'|'REFRESHING'|'EXPIRED'|'LOGGED_OUT';
export interface intfIdentityBootstrapPort {bootstrap(signal?:AbortSignal):Promise<intfSessionBootstrapView>}
export interface intfTenantSwitchPort {switchTenant(target:intfTenantView,contextVersion:string,signal?:AbortSignal):Promise<intfSessionBootstrapView>}
export interface intfSessionPresentation {readonly state:typSessionUxState;readonly view:intfSessionBootstrapView|null;readonly tenantEpoch:number}
export function applyBootstrap(current:intfSessionPresentation,view:intfSessionBootstrapView):intfSessionPresentation {
  return {state:view.state==='authenticated'?'AUTHENTICATED':'ANONYMOUS',view,tenantEpoch:current.tenantEpoch};
}
export function applyAuthorizedTenantSwitch(current:intfSessionPresentation,view:intfSessionBootstrapView):intfSessionPresentation {
  if(view.state!=='authenticated'||!view.tenant)throw new Error('New authorized tenant context required');
  return {state:'AUTHENTICATED',view,tenantEpoch:current.tenantEpoch+1};
}
