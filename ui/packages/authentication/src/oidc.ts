import * as oidc from 'openid-client';
import { resolveSecretRef, type intfOidcConfiguration } from '../../configuration/src/index.js';

export interface intfOidcFlow { readonly state:string;readonly verifier:string;readonly nonce:string;readonly returnPath:string }
export function safeOidcReturnPath(value:unknown):string {
  return typeof value==='string' && /^\/[a-z0-9/_-]*$/iu.test(value) && !value.startsWith('//') && !value.includes('..')
    ? value : '/knowledge';
}
export class clsOrganizationalOidc {
  private configuration:oidc.Configuration|undefined;
  constructor(private readonly policy:intfOidcConfiguration,private readonly secretRoot:string){}
  private async client():Promise<oidc.Configuration>{
    if(!this.policy.enabled||!this.policy.issuer||!this.policy.clientId)throw new Error('OIDC_DISABLED');
    if(!this.configuration){
      const secret=this.policy.clientSecretRef?await resolveSecretRef(this.policy.clientSecretRef,this.secretRoot):undefined;
      const client=await oidc.discovery(new URL(this.policy.issuer),this.policy.clientId,undefined,
        secret?oidc.ClientSecretPost(secret):oidc.None());
      if(client.serverMetadata().issuer!==this.policy.issuer)throw new Error('OIDC_ISSUER_MISMATCH');
      this.configuration=client;
    }
    return this.configuration;
  }
  async begin(returnPath:string):Promise<{url:string;flow:intfOidcFlow}>{
    const client=await this.client();
    const verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();
    const challenge=await oidc.calculatePKCECodeChallenge(verifier);
    const url=oidc.buildAuthorizationUrl(client,{client_id:this.policy.clientId!,redirect_uri:this.policy.callbackUri!,
      response_type:'code',scope:this.policy.scopes!.join(' '),state,nonce,code_challenge:challenge,code_challenge_method:'S256'});
    return{url:url.toString(),flow:{state,verifier,nonce,returnPath:safeOidcReturnPath(returnPath)}};
  }
  async complete(query:string,flow:intfOidcFlow):Promise<{issuer:string;subject:string}>{
    const client=await this.client();
    const callback=new URL(this.policy.callbackUri!);callback.search=query;
    const tokens=await oidc.authorizationCodeGrant(client,callback,{pkceCodeVerifier:flow.verifier,
      expectedState:flow.state,expectedNonce:flow.nonce,idTokenExpected:true});
    const claims=tokens.claims();
    if(!claims?.sub||claims.iss!==this.policy.issuer)throw new Error('OIDC_ID_TOKEN_INVALID');
    return{issuer:claims.iss,subject:claims.sub};
  }
}
