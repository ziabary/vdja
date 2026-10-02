import {randomUUID} from 'node:crypto';

const origin=new URL(process.env.PUBLIC_TOOLS_BASE_URL??'http://127.0.0.1:3000');
if(origin.protocol!=='http:'||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.pathname!=='/'||origin.search){
  throw new Error('PUBLIC_TOOLS_BASE_URL must be a loopback HTTP origin');
}
const requestId=randomUUID().replaceAll('-','');
const text='A public library lends books to local residents. Members may borrow two books for fourteen days. It opens at nine each morning and closes at five in the afternoon. The library also holds free reading events every Saturday. '.repeat(7);

async function main(){
  const response=await fetch(new URL('/api/summarize',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,max_words:200,force_persian:true,request_id:requestId}),signal:AbortSignal.timeout(90000)});
  if(response.status!==200||!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new Error(`CANCEL_LIVE_FAILED: generation returned HTTP ${response.status}`);
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',deltas=0,stopRequest;
  const terminals=[];
  for(;;){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});let position;
    while((position=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,position).trim();buffer=buffer.slice(position+1);
      if(!line.startsWith('data:'))continue;
      const data=line.slice(5).trim();
      if(data.startsWith('{"delta"')){
        deltas++;
        if(!stopRequest)stopRequest=fetch(new URL(`/api/summarize/${requestId}/stop`,origin),{method:'POST',signal:AbortSignal.timeout(10000)}).then(async result=>({http:result.status,status:(await result.json()).status}));
      }else if(data.startsWith('[CANCELLED:'))terminals.push('CANCELLED');
      else if(data.startsWith('[DONE:'))terminals.push('DONE');
      else if(data.startsWith('[ERROR]:'))terminals.push('ERROR');
    }
  }
  const stop=stopRequest?await stopRequest:null;
  if(deltas<1||stop?.http!==200||stop.status!=='OK'||terminals.join(',')!=='CANCELLED,DONE'){
    throw new Error(`CANCEL_LIVE_FAILED: deltas=${deltas}, stop=${stop?.status??'MISSING'}, terminal=${terminals.join(',')}`);
  }
  process.stdout.write('CANCEL_LIVE_PASS: active stop OK; SSE CANCELLED then DONE\n');
}

main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'CANCEL_LIVE_FAILED'}\n`);process.exitCode=1;});
