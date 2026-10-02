import {describe,it,expect} from 'vitest';
import {createUiApiClient,exUiApiError,type intfUiTransport} from '../src/lib/api/client.js';
function client(status:number,body:unknown):ReturnType<typeof createUiApiClient>{const transport:intfUiTransport={send:async()=>({status,body,correlationId:'req-1'})};return createUiApiClient(transport);}
const request={method:'GET' as const,path:'/example'};
describe('typed API boundary',()=>{
  it('validates unknown success payloads',async()=>{
    const api=client(200,{value:'yes'});
    await expect(api.request(request,value=>{if(typeof value==='object'&&value!==null&&'value' in value&&value.value==='yes')return value.value;throw new Error('invalid');})).resolves.toBe('yes');
    await expect(api.request(request,()=>{throw new Error('invalid');})).rejects.toMatchObject({envelope:{code:'INVALID_RESPONSE'}});
  });
  it.each([[401,'AUTHENTICATION_REQUIRED'],[403,'ACCESS_DENIED'],[404,'NOT_FOUND'],[409,'CONFLICT'],[422,'VALIDATION_FAILED'],[429,'RATE_LIMITED'],[503,'SERVER_FAILURE']])('classifies %i without inventing success',async(status,code)=>{
    await expect(client(status,{}).request(request,value=>value)).rejects.toMatchObject({status,envelope:{code,correlationId:'req-1'}});
  });
  it('preserves bounded 422 field paths and rejects unsafe response text',async()=>{
    await expect(client(422,{error:{code:'INVALID',message:'raw backend secret',fields:{name:'Required'}}}).request(request,value=>value)).rejects.toMatchObject({envelope:{message:'Request could not be completed',fields:{name:'Required'}}});
  });
  it('distinguishes timeout, abort and network failure',async()=>{
    const timeout=createUiApiClient({send:async()=>{throw new DOMException('timeout','TimeoutError');}});
    await expect(timeout.request(request,value=>value)).rejects.toMatchObject({envelope:{code:'TIMEOUT'}});
    const aborted=new AbortController();aborted.abort();
    const offline=createUiApiClient({send:async()=>{throw new Error('down');}});
    await expect(offline.request({...request,signal:aborted.signal},value=>value)).rejects.toMatchObject({envelope:{code:'ABORTED'}});
    await expect(offline.request(request,value=>value)).rejects.toMatchObject({envelope:{code:'NETWORK_FAILURE'}});
  });
});
