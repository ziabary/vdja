import type {intfApiErrorEnvelope} from '@targoman/contracts';
export interface intfTransportRequest {readonly method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';readonly path:string;readonly body?:unknown;readonly signal?:AbortSignal;readonly headers?:Readonly<Record<string,string>>;readonly deadlineMs?:number}
export interface intfTransportResponse {readonly status:number;readonly body:unknown;readonly correlationId?:string}
export interface intfUiTransport {send(request:intfTransportRequest):Promise<intfTransportResponse>}
export class exUiApiError extends Error {constructor(readonly status:number,readonly envelope:intfApiErrorEnvelope){super(envelope.message);}}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function safeEnvelope(body:unknown,correlationId?:string):intfApiErrorEnvelope {
  const candidate=isRecord(body)&&isRecord(body.error)?body.error:null;
  const fields:Record<string,string>={};
  if(candidate&&isRecord(candidate.fields))for(const [key,value] of Object.entries(candidate.fields))if(key.length<=100&&typeof value==='string'&&value.length<=500)fields[key]=value;
  return {code:typeof candidate?.code==='string'&&candidate.code.length<=100?candidate.code:'REQUEST_FAILED',message:'Request could not be completed',correlationId,fields:Object.keys(fields).length?fields:undefined};
}
function statusCode(status:number):string {switch(status){case 401:return 'AUTHENTICATION_REQUIRED';case 403:return 'ACCESS_DENIED';case 404:return 'NOT_FOUND';case 409:return 'CONFLICT';case 422:return 'VALIDATION_FAILED';case 429:return 'RATE_LIMITED';default:return status>=500?'SERVER_FAILURE':'REQUEST_FAILED';}}
export function createUiApiClient(transport:intfUiTransport){return {async request<T>(request:intfTransportRequest,parse:(value:unknown)=>T):Promise<T>{
  let response:intfTransportResponse;
  try{response=await transport.send(request);}catch(cause){if(request.signal?.aborted)throw new exUiApiError(0,{code:'ABORTED',message:'Request cancelled'});if(cause instanceof Error&&cause.name==='TimeoutError')throw new exUiApiError(0,{code:'TIMEOUT',message:'Request timed out'});throw new exUiApiError(0,{code:'NETWORK_FAILURE',message:'Connection unavailable'});}
  if(response.status<200||response.status>=300){const envelope=safeEnvelope(response.body,response.correlationId);throw new exUiApiError(response.status,{...envelope,code:envelope.code==='REQUEST_FAILED'?statusCode(response.status):envelope.code});}
  try{return parse(response.body);}catch{throw new exUiApiError(response.status,{code:'INVALID_RESPONSE',message:'Invalid server response',correlationId:response.correlationId});}
}};}
