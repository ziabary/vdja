import { getContext,setContext } from 'svelte';
export interface intfChromePropsMap {title:{readonly text:string};toolbar:{readonly label:string;readonly commandId:string}}
export type typChromeContribution={ [K in keyof intfChromePropsMap]:{readonly key:K;readonly props:intfChromePropsMap[K]} }[keyof intfChromePropsMap];
export interface intfChromeDescriptor {readonly title:string;readonly breadcrumbs:readonly {label:string;routeId:string}[];readonly actions:readonly {label:string;commandId:string}[]}
export interface intfChromeLease {readonly ownerId:string;readonly routeInstance:string;readonly navigationGeneration:number;readonly tenantEpoch:number;readonly nonce:number}
const CHROME_CONTEXT=Symbol('layoutChrome');
export class clsLayoutChrome {
  current=$state<typChromeContribution|null>(null);
  descriptor=$state<intfChromeDescriptor>({title:'',breadcrumbs:[],actions:[]});
  #active:intfChromeLease|null=null;
  #nonce=0;
  acquire(input:Omit<intfChromeLease,'nonce'>,contribution:typChromeContribution):intfChromeLease {
    if(this.#active&&(input.tenantEpoch<this.#active.tenantEpoch||input.tenantEpoch===this.#active.tenantEpoch&&input.navigationGeneration<this.#active.navigationGeneration))throw new Error('Stale chrome generation');
    const lease={...input,nonce:++this.#nonce};this.#active=lease;this.current=contribution;return lease;
  }
  update(lease:intfChromeLease,contribution:typChromeContribution):boolean {if(!this.matches(lease))return false;this.current=contribution;return true;}
  release(lease:intfChromeLease):boolean {if(!this.matches(lease))return false;this.#active=null;this.current=null;return true;}
  commitNavigation(generation:number,tenantEpoch:number,descriptor:intfChromeDescriptor):void {
    if(this.#active&&(generation<this.#active.navigationGeneration||tenantEpoch<this.#active.tenantEpoch))return;
    this.#active=null;this.current=null;this.descriptor=descriptor;
  }
  private matches(lease:intfChromeLease):boolean {return this.#active?.nonce===lease.nonce&&this.#active.ownerId===lease.ownerId&&this.#active.tenantEpoch===lease.tenantEpoch&&this.#active.navigationGeneration===lease.navigationGeneration;}
}
export function provideLayoutChrome(chrome:clsLayoutChrome):void {setContext(CHROME_CONTEXT,chrome);}
export function useLayoutChrome():clsLayoutChrome {const chrome=getContext<clsLayoutChrome>(CHROME_CONTEXT);if(!chrome)throw new Error('Layout chrome unavailable');return chrome;}
