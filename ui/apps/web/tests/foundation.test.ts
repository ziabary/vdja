import {describe,it,expect} from 'vitest';
import {parsePublicBrand} from '@targoman/branding';
import {transitionAiOperation,requestCancellation,createCursorTable} from '@targoman/ui-core';
import {clsLayoutChrome} from '../src/lib/layout/chrome.svelte.js';
import {resolveUiRoute} from '../src/lib/routing/resolve.js';
import {composeContributions} from '../src/lib/layout/contributions.js';
import {applyAuthorizedTenantSwitch} from '../src/lib/auth/session.js';
import type {intfRouteBinding,typModuleId,typRouteId,typTenantId,typContextVersion} from '@targoman/contracts';
describe('foundation contracts',()=>{
  it('validates public brand projection and rejects unsafe config',()=>{
    expect(parsePublicBrand({version:'1',displayName:'Workspace',shortName:'Work',primaryColor:'#285d84'}).displayName).toBe('Workspace');
    expect(()=>parsePublicBrand({version:'1',displayName:'<script>',shortName:'Work',primaryColor:'#285d84'})).toThrow();
    expect(()=>parsePublicBrand({version:'1',displayName:'Work',shortName:'Work',primaryColor:'red',logoLight:{path:'javascript:alert(1)',alt:'X'}})).toThrow();
  });
  it('does not let an older chrome lease clear a newer owner',()=>{
    const chrome=new clsLayoutChrome();
    const old=chrome.acquire({ownerId:'A',routeInstance:'A',navigationGeneration:1,tenantEpoch:0},{key:'title',props:{text:'A'}});
    const current=chrome.acquire({ownerId:'B',routeInstance:'B',navigationGeneration:2,tenantEpoch:0},{key:'title',props:{text:'B'}});
    expect(chrome.release(old)).toBe(false);expect(chrome.current).toEqual({key:'title',props:{text:'B'}});
    expect(chrome.release(current)).toBe(true);expect(chrome.release(current)).toBe(false);
  });
  it('resolves configured root, prefix, module and tenant bindings',()=>{
    const routeId='dashboard' as typRouteId,moduleId='sample' as typModuleId,tenantId='tenant-a' as typTenantId;
    const base:intfRouteBinding={routeId,host:'example.test',basePath:'/',moduleId,tenantId,surface:'user',entryMode:'module',path:'/dashboard'};
    const request={routeId,host:'example.test',tenantId,surface:'user' as const,enabledModules:[moduleId]};
    expect(resolveUiRoute([base],request)).toEqual({kind:'found',path:'/dashboard'});
    expect(resolveUiRoute([{...base,basePath:'/preview'}],request)).toEqual({kind:'found',path:'/preview/dashboard'});
    expect(resolveUiRoute([base],{...request,enabledModules:[]})).toEqual({kind:'disabled'});
    expect(resolveUiRoute([base],{...request,host:'other.test'})).toEqual({kind:'binding-mismatch'});
    expect(resolveUiRoute([base],{...request,tenantId:'tenant-b' as typTenantId})).toEqual({kind:'binding-mismatch'});
  });
  it('composes only backend-projected contribution IDs without local role logic',()=>{
    const moduleId='sample' as typModuleId,routeId='sample-route' as typRouteId;
    const item={id:'nav-1',moduleId,routeId,contractVersion:1,labelKey:'sample.nav',order:1,kind:'navigation' as const,surface:'admin' as const};
    expect(composeContributions([item],'admin',{enabledModules:[moduleId],visibleContributionIds:['nav-1']})).toEqual([item]);
    expect(composeContributions([item],'admin',{enabledModules:[],visibleContributionIds:['nav-1']})).toEqual([]);
    expect(()=>composeContributions([item,item],'admin',{enabledModules:[moduleId],visibleContributionIds:['nav-1']})).toThrow();
  });
  it('requires a newly authorized context for tenant switch',()=>{
    const current={state:'AUTHENTICATED' as const,view:null,tenantEpoch:2};
    const tenant={id:'t' as typTenantId,label:'Tenant',contextVersion:'v2' as typContextVersion};
    expect(applyAuthorizedTenantSwitch(current,{state:'authenticated',tenant,switchableTenants:[tenant],capabilityKeys:[]}).tenantEpoch).toBe(3);
    expect(()=>applyAuthorizedTenantSwitch(current,{state:'anonymous',switchableTenants:[],capabilityKeys:[]})).toThrow();
  });
  it('uses cursor pagination without a required total and enforces AI transitions',()=>{
    const page={items:[{name:'one'}],nextCursor:null,hasMore:false};
    expect(createCursorTable(page,[{id:'name',header:'Name',value:row=>row.name}]).rows).toEqual(page.items);
    expect(transitionAiOperation('IDLE','SUBMIT')).toBe('SUBMITTING');
    expect(()=>transitionAiOperation('IDLE','CONFIRM_RESULT')).toThrow();
    expect(requestCancellation({state:'STREAMING',cancelRequested:false,operationId:'op',tenantEpoch:0}).state).toBe('STREAMING');
  });
});
