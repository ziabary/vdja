import type {RequestHandler} from './$types';
import {deploymentSnapshot} from '#lib/server/deployment.js';
import {forwardTargetApiRequest} from '#lib/api/gateway.server.js';

const forward:RequestHandler=async ({params,request})=>{
  const path=params.path;
  if(!path||!/^[-a-zA-Z0-9_/.]+$/.test(path)||path.includes('..')||path.includes('//'))return new Response(null,{status:404});
  const snapshot=await deploymentSnapshot();
  if(path.startsWith('auth/'))return new Response(null,{status:404});
  const url=new URL(`/api/${path}`,snapshot.value.http.apiInternalUrl);
  url.search=new URL(request.url).search;
  return forwardTargetApiRequest(url,request,snapshot.value.web?new URL(snapshot.value.web.publicOrigin).host:url.host);
};
export const GET=forward;
export const POST=forward;
export const PUT=forward;
