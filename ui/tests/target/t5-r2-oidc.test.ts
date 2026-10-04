import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as oidc from 'openid-client';
import {clsOrganizationalOidc,safeOidcReturnPath} from '../../packages/authentication/src/oidc.js';

test('OIDC start binds exact client, redirect, PKCE S256, state and nonce',async()=>{
  const issuer='https://idp.example.invalid';
  const policy={enabled:true,issuer,clientId:'development-client',scopes:['openid','profile'],
    callbackUri:'https://auth.example.invalid/api/auth/oidc/callback',provisioning:'DISABLED' as const};
  const target=new clsOrganizationalOidc(policy,'/run/secrets');
  const configuration=new oidc.Configuration({issuer,authorization_endpoint:`${issuer}/authorize`,token_endpoint:`${issuer}/token`,
    jwks_uri:`${issuer}/jwks`},policy.clientId);
  (target as unknown as {configuration:oidc.Configuration}).configuration=configuration;
  const {url,flow}=await target.begin('/knowledge');
  const parsed=new URL(url);
  assert.equal(parsed.origin,issuer);
  assert.equal(parsed.searchParams.get('client_id'),policy.clientId);
  assert.equal(parsed.searchParams.get('redirect_uri'),policy.callbackUri);
  assert.equal(parsed.searchParams.get('code_challenge_method'),'S256');
  assert.equal(parsed.searchParams.get('state'),flow.state);
  assert.equal(parsed.searchParams.get('nonce'),flow.nonce);
  assert.equal(parsed.searchParams.get('code_challenge'),await oidc.calculatePKCECodeChallenge(flow.verifier));
  assert.equal(safeOidcReturnPath('//attacker.invalid'),'/knowledge');
  assert.equal(safeOidcReturnPath('/../admin'),'/knowledge');
  await assert.rejects(target.complete('?code=synthetic&state=wrong',flow));
});
