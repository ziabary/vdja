import {createUiApiClient,exUiApiError} from './client.js';
import {browserFetcher,createFetchTransport,postPublicTool,publicToolFetcher} from './transport.js';
import type {intfAuthClient} from '../auth/client.svelte.js';
import {consumeSseFrames,exStreamProtocol,type intfSseFrame} from '../streaming/parser.js';
import {openLegacyEventStream} from '../streaming/transport.js';

export interface intfDictionaryResult {readonly phrase:string;readonly translations:readonly string[];readonly pronunciations?:Readonly<Record<string,string>>;readonly synonyms?:unknown;readonly antonyms?:unknown;readonly relWords?:unknown;readonly relExp?:unknown}
export interface intfFaqItem {readonly question:string;readonly answer:string;readonly section?:string}
export interface intfFaqMeta {readonly fileName:string;readonly pageCount:number;readonly sourceChars:number}
export interface intfFaqOptions {readonly file:File;readonly count:number;readonly answerWords:number;readonly tone:'formal'|'conversational';readonly language:'source'|'fa'|'en';readonly scope:'all'|'range'|'focus';readonly from:number;readonly to:number;readonly focus:string;readonly priorQuestions:readonly string[]}
export interface intfTextRequest {readonly text:string;readonly requestId:string}
export interface intfTranslateRequest extends intfTextRequest {readonly sourceLang:string;readonly targetLang:string}
export interface intfSummarizeRequest extends intfTextRequest {readonly maxWords:number;readonly forcePersian:boolean}
export type typStreamOutcome='SUCCEEDED'|'CANCELLED';

function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function stringArray(value:unknown):readonly string[]{return Array.isArray(value)?value.filter((part):part is string=>typeof part==='string'):[];}
function dictionary(value:unknown):intfDictionaryResult{
  if(!record(value)||typeof value.phrase!=='string'||!Array.isArray(value.translations))throw new Error('INVALID_DICTIONARY');
  const pronunciations=record(value.pronunciations)?Object.fromEntries(Object.entries(value.pronunciations).filter((pair):pair is [string,string]=>typeof pair[1]==='string')):undefined;
  return {phrase:value.phrase,translations:stringArray(value.translations),pronunciations,synonyms:value.synonyms,antonyms:value.antonyms,relWords:value.relWords,relExp:value.relExp};
}
function faqItem(value:unknown):intfFaqItem{
  if(!record(value)||typeof value.question!=='string'||typeof value.answer!=='string')throw new exStreamProtocol('INVALID_FAQ_ITEM');
  return {question:value.question,answer:value.answer,section:typeof value.section==='string'?value.section:undefined};
}
function parseFaqMeta(value:unknown):intfFaqMeta{
  if(!record(value)||typeof value.fileName!=='string'||typeof value.pageCount!=='number'||typeof value.sourceChars!=='number')throw new Error('INVALID_FAQ_META');
  return {fileName:value.fileName,pageCount:value.pageCount,sourceChars:value.sourceChars};
}
function formForFaq(options:intfFaqOptions):FormData{
  const form=new FormData();form.append('file',options.file);form.append('count',String(options.count));form.append('answer_words',String(options.answerWords));form.append('tone',options.tone);form.append('language',options.language);form.append('scope',options.scope);form.append('from',String(options.from));form.append('to',String(options.to));form.append('focus',options.focus);form.append('prior_questions',JSON.stringify(options.priorQuestions));return form;
}
export function newPublicRequestId():string{return crypto.randomUUID().replaceAll('-','');}

export function createPublicToolsClient(auth?:intfAuthClient){
  const fetcher=publicToolFetcher(browserFetcher(),()=>auth?.state??{token:null,tenantId:null});const api=createUiApiClient(createFetchTransport(fetcher));
  return {
    async extractText(file:File,maxChars:2000|3000,signal?:AbortSignal):Promise<string>{
      if(/\.(txt|md)$/i.test(file.name)){const content=await file.text();return content.length>maxChars?content.substring(0,maxChars-7)+' [...]':content;}
      const form=new FormData();form.append('file',file);
      const value=await api.request({method:'POST',path:`/file2Text?maxChars=${maxChars}`,body:form,contentType:'multipart',signal},body=>{
        if(!record(body)||typeof body.text!=='string')throw new Error('INVALID_EXTRACT');return body.text;
      });return value.slice(0,maxChars);
    },
    async inspectFaq(file:File,signal?:AbortSignal):Promise<intfFaqMeta>{const form=new FormData();form.append('file',file);return api.request({method:'POST',path:'/faq/inspect',body:form,contentType:'multipart',signal},parseFaqMeta);},
    async stop(tool:'translate'|'summarize',requestId:string):Promise<boolean>{
      const result=await api.request({method:'POST',path:`/${tool}/${encodeURIComponent(requestId)}/stop`},body=>body);
      return record(result)&&(result.status==='OK'||result.status==='PENDING');
    },
    async translate(request:intfTranslateRequest,onDelta:(text:string)=>void,signal?:AbortSignal):Promise<{readonly outcome:typStreamOutcome;readonly markdown?:string;readonly dictionary?:intfDictionaryResult}>{
      const response=await postPublicTool(fetcher,'/translate',{text:request.text,source_lang:request.sourceLang,target_lang:request.targetLang,request_id:request.requestId},signal);
      if(!response.ok)throw new exUiApiError(response.status,{code:response.status>=500?'SERVER_FAILURE':'REQUEST_FAILED',message:'Request could not be completed'});
      if(response.headers.get('content-type')?.includes('application/json'))return {outcome:'SUCCEEDED',dictionary:dictionary(await response.json() as unknown)};
      if(!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new exStreamProtocol('INVALID_STREAM_RESPONSE');
      return consumeLegacyText(response.body,onDelta,signal);
    },
    async summarize(request:intfSummarizeRequest,onDelta:(text:string)=>void,signal?:AbortSignal):Promise<{readonly outcome:typStreamOutcome;readonly markdown:string}>{
      const response=await postPublicTool(fetcher,'/summarize',{text:request.text,max_words:request.maxWords,force_persian:request.forcePersian,request_id:request.requestId},signal);
      if(!response.ok)throw new exUiApiError(response.status,{code:response.status>=500?'SERVER_FAILURE':'REQUEST_FAILED',message:'Request could not be completed'});
      if(!response.body||!response.headers.get('content-type')?.startsWith('text/event-stream'))throw new exStreamProtocol('INVALID_STREAM_RESPONSE');
      return consumeLegacyText(response.body,onDelta,signal);
    },
    async generateFaq(options:intfFaqOptions,onMeta:(meta:{readonly count:number;readonly batches:number})=>void,onBatch:(items:readonly intfFaqItem[],produced:number)=>void,signal?:AbortSignal):Promise<void>{
      let terminal=false,outputBytes=0;
      await openLegacyEventStream(fetcher,'/faq',formForFaq(options),(frame:intfSseFrame)=>{
        if(terminal)throw new exStreamProtocol('DATA_AFTER_TERMINAL');
        let parsed:unknown;try{parsed=JSON.parse(frame.data);}catch{throw new exStreamProtocol('INVALID_JSON');}
        if(!record(parsed))throw new exStreamProtocol('INVALID_EVENT');
        if(frame.event==='meta'){if(typeof parsed.count!=='number'||typeof parsed.batches!=='number')throw new exStreamProtocol('INVALID_META');onMeta({count:parsed.count,batches:parsed.batches});}
        else if(frame.event==='batch'){if(!Array.isArray(parsed.items)||typeof parsed.produced!=='number')throw new exStreamProtocol('INVALID_BATCH');const items=parsed.items.map(faqItem);outputBytes+=new TextEncoder().encode(JSON.stringify(items)).length;if(outputBytes>2_000_000)throw new exStreamProtocol('OUTPUT_LIMIT');onBatch(items,parsed.produced);}
        else if(frame.event==='done'){if(typeof parsed.produced!=='number')throw new exStreamProtocol('INVALID_DONE');terminal=true;}
        else if(frame.event==='error'){terminal=true;throw new exStreamProtocol('REMOTE_ERROR');}
      },signal);
      if(!terminal)throw new exStreamProtocol('INTERRUPTED');
    }
  };
}

export async function consumeLegacyText(stream:ReadableStream<Uint8Array>,onDelta:(text:string)=>void,signal?:AbortSignal):Promise<{readonly outcome:typStreamOutcome;readonly markdown:string}>{
  let markdown='',terminal=false,cancelled=false,outputBytes=0;
  await consumeSseFrames(stream,frame=>{
    // The frozen Express stream sometimes emits consecutive data lines without blank frame separators.
    for(const payload of frame.data.split('\n')){
      if(terminal)throw new exStreamProtocol('DATA_AFTER_TERMINAL');
      if(payload.startsWith('[DONE:')){terminal=true;continue;}
      if(payload.startsWith('[CANCELLED:')){cancelled=true;continue;}
      if(payload.startsWith('[ERROR]:')){terminal=true;throw new exStreamProtocol('REMOTE_ERROR');}
      if(payload.startsWith('[REF]:'))continue;
      let parsed:unknown;try{parsed=JSON.parse(payload);}catch{throw new exStreamProtocol('INVALID_JSON');}
      if(!record(parsed)||typeof parsed.delta!=='string')throw new exStreamProtocol('INVALID_DELTA');
      outputBytes+=new TextEncoder().encode(parsed.delta).length;if(outputBytes>2_000_000)throw new exStreamProtocol('OUTPUT_LIMIT');markdown+=parsed.delta;onDelta(parsed.delta);
    }
  },undefined,signal,true);
  if(!terminal)throw new exStreamProtocol('INTERRUPTED');
  return {outcome:cancelled?'CANCELLED':'SUCCEEDED',markdown};
}
