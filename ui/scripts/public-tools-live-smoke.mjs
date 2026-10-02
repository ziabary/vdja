import {createPublicToolsClient,newPublicRequestId} from '../apps/web/src/lib/api/publicTools.ts';

const base=process.env.PUBLIC_TOOLS_BASE_URL??'http://127.0.0.1:3000';
const origin=new URL(base);
if(origin.protocol!=='http:'||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.pathname!=='/'||origin.search){
  throw new Error('PUBLIC_TOOLS_BASE_URL must be a loopback HTTP origin');
}
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init)=>nativeFetch(new URL(String(input),origin),init);

function syntheticPdf(){
  const content='BT /F1 18 Tf 72 720 Td (Hello public tools) Tj ET';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[0];
  for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const start=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new File([pdf],'public-tools-sample.pdf',{type:'application/pdf'});
}
async function timed(action,seconds=90){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),seconds*1000);
  try{return await action(controller.signal);}finally{clearTimeout(timer);}
}
function status(error){return error&&typeof error==='object'&&'status'in error?error.status:'NETWORK_OR_PROTOCOL';}
async function expectedError(label,action){
  try{await action();throw new Error(`${label}: unexpected success`);}catch(error){
    if(error instanceof Error&&error.message===`${label}: unexpected success`)throw error;
    if(status(error)!==400)throw new Error(`${label}: expected HTTP 400, received ${status(error)}`);
    process.stdout.write(`${label}: HTTP 400, safe client error\n`);
  }
}
async function checkApi(){
  try{const response=await nativeFetch(new URL('/',origin),{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);}
  catch{throw new Error('ENVIRONMENT_NOT_READY: existing Express API is not reachable');}
  process.stdout.write('API_REACHABLE: Express is listening; request dependencies checked below\n');
}
async function checkModel(){
  const fs=await import('node:fs');
  const config=JSON.parse(fs.readFileSync(new URL('../.config.json',import.meta.url),'utf8'));
  const targets=[config.llmServers?.translate,config.llmServers?.summarize,config.llmServers?.faq??config.llmServers?.summarize];
  for(const target of targets){
    if(!target?.url||!target?.model)throw new Error('ENVIRONMENT_NOT_READY: configured generation dependency is incomplete');
    try{
      const response=await nativeFetch(new URL('/v1/models',target.url),{signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const models=await response.json();
      if(!Array.isArray(models?.data)||!models.data.some(model=>model?.id===target.model)){
        throw new Error('configured model is not served');
      }
    }catch{throw new Error('ENVIRONMENT_NOT_READY: configured generation dependency is unreachable or unhealthy');}
  }
  process.stdout.write('MODEL_HEALTH: configured generation endpoints responded\n');
}
async function main(){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('ENVIRONMENT_NOT_READY: Node 22 is required for this live smoke');
  await checkApi();
  const client=createPublicToolsClient();
  await expectedError('TRANSLATOR_INVALID',()=>client.translate({text:'hello',sourceLang:'en',targetLang:'en',requestId:newPublicRequestId()},()=>{}));
  await expectedError('SUMMARIZER_INVALID',()=>client.summarize({text:'',maxWords:80,forcePersian:true,requestId:newPublicRequestId()},()=>{}));
  const document=new File(['A public library lends books to visitors. It is open six days each week. Members may borrow two books for fourteen days.'],'public-tools-note.txt',{type:'text/plain'});
  const meta=await timed(signal=>client.inspectFaq(document,signal),15);
  if(meta.pageCount<1||meta.sourceChars<20)throw new Error('FAQ_INSPECT: invalid metadata');
  process.stdout.write('FAQ_INSPECT: multipart accepted and metadata valid\n');
  await expectedError('FAQ_INVALID_FILE',()=>client.inspectFaq(new File(['test'],'bad.exe',{type:'application/octet-stream'})));
  const pdf=syntheticPdf();
  const issues=[];
  for(const maxChars of [2000,3000]){
    let text;
    try{text=await timed(signal=>client.extractText(pdf,maxChars,signal),30);}
    catch(error){issues.push(`FILE_EXTRACT_${maxChars}: HTTP ${status(error)}`);continue;}
    if(!text.includes('Hello public tools'))throw new Error(`FILE_EXTRACT_${maxChars}: expected synthetic PDF text missing`);
    process.stdout.write(`FILE_EXTRACT_${maxChars}: multipart PDF extraction succeeded\n`);
  }
  try{await checkModel();}catch(error){issues.push(error instanceof Error?error.message:'ENVIRONMENT_NOT_READY: model check failed');}
  if(issues.length)throw new Error(issues.join('\n'));
  const translation=await timed(signal=>client.translate({text:'The public library opens at nine each morning and closes at five in the afternoon.',sourceLang:'en',targetLang:'fa',requestId:newPublicRequestId()},()=>{},signal));
  if(!translation.dictionary?.translations.length&&!translation.markdown?.trim())throw new Error('TRANSLATOR: empty result');
  process.stdout.write(`TRANSLATOR: ${translation.dictionary?'dictionary JSON':'stream terminal'} and nonempty result\n`);
  const summary=await timed(signal=>client.summarize({text:'A public library lends books to local residents. Members can borrow two books at a time for fourteen days. The library opens at nine each morning and closes at five in the afternoon. It also holds a reading event on the first Saturday of each month. The event is free and open to visitors.',maxWords:80,forcePersian:true,requestId:newPublicRequestId()},()=>{},signal));
  if(summary.outcome!=='SUCCEEDED'||!summary.markdown.trim())throw new Error('SUMMARIZER: empty or incomplete stream');
  process.stdout.write('SUMMARIZER: stream terminal and nonempty result\n');
  let batches=0,items=0;
  await timed(signal=>client.generateFaq({file:document,count:2,answerWords:50,tone:'formal',language:'source',scope:'all',from:1,to:1,focus:'',priorQuestions:[]},()=>{},batch=>{batches++;items+=batch.length;},signal),120);
  if(batches<1||items<1)throw new Error('FAQ: no valid batch');
  process.stdout.write('FAQ: named batch and done terminal with valid items\nLIVE_PUBLIC_TOOLS_PASS\n');
}

main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'LIVE_PUBLIC_TOOLS_FAILED'}\n`);process.exitCode=1;});
