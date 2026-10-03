import type {RequestHandler} from './$types';
import {deploymentSnapshot} from '#lib/server/deployment.js';
import {forwardPublicApiRequest} from '#lib/api/transport.js';

const forward:RequestHandler=async ({params,request})=>{
  const path=params.path;
  if(!path||!/^[-a-zA-Z0-9_/.]+$/.test(path)||path.includes('..')||path.includes('//'))return new Response(null,{status:404});
  const snapshot=await deploymentSnapshot();
  if(path.startsWith('auth/')&&!snapshot.value.auth?.enabled)return new Response(null,{status:404});
  const url=new URL(`/api/${path}`,snapshot.value.http.apiInternalUrl);
  return forwardPublicApiRequest(url,request);
};
export const GET=forward;
export const POST=forward;
