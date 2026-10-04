import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import express, { type Express, type Request, type Response } from 'express';
import type { intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import type { typClassificationLevel } from '../../../packages/authority/src/index.js';
import { enuMembershipMode, exKnowledge } from '../../../packages/knowledge/src/index.js';
import { exDocument } from '../../../packages/documents/src/index.js';
import { exFileManagement } from '../../../packages/file-management/src/index.js';
import { exFileProcessing } from '../../../packages/file-processing/src/index.js';
import { exAiRouter } from '../../../packages/ai-router/src/index.js';
import { exAdmission } from '../../../packages/admission-control/src/index.js';
import type { createPublicApiRuntime } from './composition.js';
import {logOperational} from '../../../packages/observability/src/index.js';
import {enuKnowledgeStreamEvent,enuKnowledgeStreamState} from '../../../packages/contracts/src/knowledge.js';

function text(value: unknown, maximum = 256): string {
  if (typeof value !== 'string' || !value || value.length > maximum) throw new Error('INVALID_KNOWLEDGE_INPUT');
  return value;
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_KNOWLEDGE_INPUT');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) throw new Error('INVALID_KNOWLEDGE_INPUT');
  return result;
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('INVALID_KNOWLEDGE_INPUT'); return Number(value);
}
function classification(value: unknown): typClassificationLevel {
  if (value !== 'LOW' && value !== 'MEDIUM' && value !== 'HIGH' && value !== 'CRITICAL') throw new Error('INVALID_KNOWLEDGE_INPUT');
  return value;
}
function errorResponse(error: unknown): Readonly<{ status: number; code: string }> {
  if (error instanceof exKnowledge || error instanceof exDocument || error instanceof exFileManagement) {
    const unavailable = ['INDEX_NOT_READY','INDEX_UNAVAILABLE','FILE_STORAGE_UNAVAILABLE','FILE_CACHE_UNAVAILABLE'].includes(error.code);
    const invalid = ['INVALID_KNOWLEDGE','INVALID_DOCUMENT','INVALID_TRANSFER','INVALID_RANGE'].includes(error.code);
    return { status: unavailable ? 503 : invalid ? 400 : error.code.endsWith('DENIED') ? 403 : 409, code: error.code };
  }
  if (error instanceof exAdmission) return { status: 429, code: error.code };
  if (error instanceof exAiRouter) return { status: 503, code: error.code };
  if (error instanceof exFileProcessing) return { status: error.code==='FILE_TOO_LARGE'?413:400, code: error.code };
  const code = error instanceof Error ? error.message : '';
  if (['INVALID_ACCESS_TOKEN','INVALID_EXECUTION_SUBJECT','EXECUTION_SUBJECT_INACTIVE'].includes(code)) return { status:401,code:'INVALID_SESSION' };
  if (code === 'PROTECTED_EGRESS_DENIED') return {status:403,code:'PROTECTED_EGRESS_DENIED'};
  if (code === 'CHAT_NOT_FOUND') return {status:404,code};
  if (code === 'CHAT_LIMIT') return {status:409,code};
  if (code.startsWith('INVALID_')) return {status:400,code:'INVALID_KNOWLEDGE_INPUT'};
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') return {status:413,code:'INPUT_LIMIT_EXCEEDED'};
  return {status:500,code:'INTERNAL_ERROR'};
}

/** Transport performs schema/session validation; application services own every operation. */
export function registerKnowledgeApi(app: Express, snapshot: intfConfigurationSnapshot, runtime: Awaited<ReturnType<typeof createPublicApiRuntime>>): void {
  const managed = runtime.managed, authentication = runtime.authentication;
  const router = express.Router();
  const logFailure=(req:Request,res:Response,safe:Readonly<{status:number;code:string}>)=>logOperational({
    severity:safe.status>=500?'ERROR':'WARN',component:'knowledge-api',event:'request_failed',
    ...(res.locals.publicContext?{context:res.locals.publicContext as intfExecutionContext}:{}),method:req.method,route:req.route?.path??'UNMATCHED',
    status:String(safe.status),errorClass:safe.code});
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('Vary','Origin, Authorization');
    if (!managed || !authentication) {res.status(404).json({error:'CAPABILITY_DISABLED'});return;}
    try {
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.exec(req.header('authorization') ?? '');
      if (!match) throw new Error('INVALID_ACCESS_TOKEN');
      const claims = await authentication.authenticateBearer(match[1]!, req.header('x-tenant-id'));
      const id = req.header('x-request-id') ?? randomUUID().replaceAll('-','');
      if (!/^[a-f0-9]{32}$/u.test(id)) throw new Error('INVALID_REQUEST_ID');
      const header = req.header('x-correlation-id');
      const correlationId = header && /^[A-Za-z0-9-]{8,64}$/u.test(header) ? header : randomUUID();
      const context: intfExecutionContext = {deploymentId:snapshot.value.deployment.id,tenantId:claims.tenantId,moduleId:'knowledge',
        actorKind:'HUMAN',actorId:claims.identityId,sessionId:claims.sessionId,authorizationVersion:claims.authorizationVersion,
        requestId:id,correlationId,source:'KNOWLEDGE_API',configFingerprint:snapshot.fingerprint};
      res.locals.publicContext=context; res.setHeader('X-Request-ID',id); res.setHeader('X-Correlation-ID',correlationId);next();
    } catch(error) {const safe=errorResponse(error);logFailure(req,res,safe);res.status(safe.status).json({error:safe.code});}
  });
  if (!managed) {app.use('/api/knowledge',router);return;}
  const context = (res:Response): intfExecutionContext => res.locals.publicContext as intfExecutionContext;
  const route = (work:(req:Request,res:Response)=>Promise<unknown>) => async(req:Request,res:Response) => {
    try {await work(req,res);} catch(error) {const safe=errorResponse(error);logFailure(req,res,safe);if(res.headersSent){res.destroy();return;}res.status(safe.status).json({error:safe.code});}
  };
  router.get('/documents',route(async(req,res)=>res.json(await managed.documents.list(context(res),req.query.cursor===undefined?null:text(req.query.cursor),req.query.limit===undefined?25:integer(Number(req.query.limit))))));
  router.post('/documents',route(async(req,res)=>{const body=object(req.body,['id','title','classification']);res.status(201).json(await managed.documents.create(context(res),{id:text(body.id),title:text(body.title),classification:classification(body.classification)}));}));
  router.get('/documents/:id/versions',route(async(req,res)=>res.json({items:await managed.documents.versions(context(res),text(req.params.id))})));
  router.get('/documents/:id/operations',route(async(req,res)=>res.json(await managed.documents.operations(context(res),text(req.params.id)))));
  router.get('/documents/:id/versions/:versionId/content',route(async(req,res)=>res.json({text:await managed.files.read(context(res),text(req.params.id),text(req.params.versionId))})));
  router.get('/documents/:id/versions/:versionId/download',route(async(req,res)=>{
    const range=req.header('range'),ifNoneMatch=req.header('if-none-match'),ifRange=req.header('if-range');
    const result=await managed.files.download(context(res),{documentId:text(req.params.id),versionId:text(req.params.versionId),
      ...(range?{range}:{}),...(ifNoneMatch?{ifNoneMatch}:{}),...(ifRange?{ifRange}: {})});
    res.status(result.status);for(const[key,value]of Object.entries(result.headers))res.setHeader(key,value);
    if(result.body)await pipeline(result.body,res);else res.end();
  }));
  router.post('/documents/:id/retire',route(async(req,res)=>{await managed.documents.retire(context(res),text(req.params.id));res.status(204).end();}));
  router.post('/transfers',route(async(req,res)=>{const body=object(req.body,['documentId','idempotencyKey','filename','mediaType','bytes','sha256']);res.status(201).json(await managed.files.initiate(context(res),{documentId:text(body.documentId),idempotencyKey:text(body.idempotencyKey,128),filename:text(body.filename),mediaType:text(body.mediaType,128),bytes:integer(body.bytes),sha256:text(body.sha256,64)}));}));
  router.get('/transfers/:id',route(async(req,res)=>res.json(await managed.files.status(context(res),text(req.params.id)))));
  router.put('/transfers/:id/parts/:number',express.raw({type:'application/octet-stream',limit:snapshot.value.fileManagement?.enabled?snapshot.value.fileManagement.uploads.partBytes:0}),route(async(req,res)=>{
    if(!Buffer.isBuffer(req.body))throw new Error('INVALID_KNOWLEDGE_INPUT');
    const controller=new AbortController();req.once('aborted',()=>controller.abort());
    res.json(await managed.files.uploadPart(context(res),text(req.params.id),integer(Number(req.params.number)),text(req.header('x-content-sha256'),64),req.body,controller.signal));
  }));
  router.post('/transfers/:id/complete',route(async(req,res)=>res.json(await managed.files.complete(context(res),text(req.params.id)))));
  router.post('/transfers/:id/reconcile',route(async(req,res)=>res.json(await managed.files.reconcile(context(res),text(req.params.id)))));
  const knowledge=managed.knowledge;
  if(knowledge){
    router.get('/personal',route(async(_req,res)=>{const id=await knowledge.personalSpace(context(res));res.json(await knowledge.status(context(res),id));}));
    router.put('/personal/documents/:documentId',route(async(req,res)=>{
      const id=await knowledge.personalSpace(context(res));
      await knowledge.addMembership(context(res),{spaceId:id,documentId:text(req.params.documentId),mode:enuMembershipMode.Current,pinnedVersionId:null});
      res.status(204).end();
    }));
    router.delete('/personal/documents/:documentId',route(async(req,res)=>{
      const id=await knowledge.personalSpace(context(res)),documentId=text(req.params.documentId);
      const status=await knowledge.status(context(res),id);
      if(!status.memberships.some(member=>member.documentId===documentId)){res.status(404).json({error:'DOCUMENT_NOT_FOUND'});return;}
      await knowledge.removeMembership(context(res),id,documentId);
      await managed.documents.retire(context(res),documentId);
      res.status(204).end();
    }));
    if(managed.personalChats){
      const chats=managed.personalChats;
      router.get('/personal/chats',route(async(_req,res)=>res.json({items:await chats.list(context(res))})));
      router.post('/personal/chats',route(async(_req,res)=>res.status(201).json(await chats.create(context(res)))));
      router.get('/personal/chats/:id/messages',route(async(req,res)=>res.json({items:await chats.messages(context(res),text(req.params.id))})));
      router.delete('/personal/chats/:id',route(async(req,res)=>{await chats.retire(context(res),text(req.params.id));res.status(204).end();}));
      router.delete('/personal/chats',route(async(_req,res)=>{await chats.retire(context(res),null);res.status(204).end();}));
      router.post('/personal/chats/:id/ask',route(async(req,res)=>{
        const body=object(req.body,['question']),controller=new AbortController();req.once('aborted',()=>controller.abort());
        res.once('close',()=>{if(!res.writableEnded)controller.abort();});
        const answer=await chats.ask(context(res),text(req.params.id),text(body.question,65536),controller.signal);
        if(!req.header('accept')?.includes('text/event-stream')){res.json(answer);return;}
        await managed.subject.assertActive(context(res));
        res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');
        const send=async(event:enuKnowledgeStreamEvent,data:unknown)=>{if(controller.signal.aborted)throw new Error('CANCELLED');
          if(!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))await new Promise<void>((resolve,reject)=>{
            const cleanup=()=>{res.off('drain',drain);res.off('close',close);};
            const drain=()=>{cleanup();resolve();},close=()=>{cleanup();reject(new Error('CANCELLED'));};
            res.once('drain',drain);res.once('close',close);
          });};
        const characters=Array.from(answer.answer);
        for(let offset=0;offset<characters.length;offset+=256)await send(enuKnowledgeStreamEvent.Delta,{text:characters.slice(offset,offset+256).join('')});
        await send(enuKnowledgeStreamEvent.Citations,{citations:answer.citations});
        await send(enuKnowledgeStreamEvent.Done,{status:enuKnowledgeStreamState.Succeeded});res.end();
      }));
    }
    router.get('/spaces',route(async(req,res)=>res.json(await knowledge.list(context(res),req.query.cursor===undefined?null:text(req.query.cursor),req.query.limit===undefined?25:integer(Number(req.query.limit))))));
    router.post('/spaces',route(async(req,res)=>{const body=object(req.body,['id','title','classification']);await knowledge.createSpace(context(res),{id:text(body.id),title:text(body.title),classification:classification(body.classification)});res.status(201).json({id:body.id});}));
    router.get('/spaces/:id',route(async(req,res)=>res.json(await knowledge.status(context(res),text(req.params.id)))));
    router.put('/spaces/:id/memberships/:documentId',route(async(req,res)=>{const body=object(req.body,['mode','pinnedVersionId']);if(body.mode!==enuMembershipMode.Current&&body.mode!==enuMembershipMode.Pinned)throw new Error('INVALID_KNOWLEDGE_INPUT');await knowledge.addMembership(context(res),{spaceId:text(req.params.id),documentId:text(req.params.documentId),mode:body.mode,pinnedVersionId:body.pinnedVersionId===null?null:text(body.pinnedVersionId)});res.status(204).end();}));
    router.post('/spaces/:id/rebuild',route(async(req,res)=>{await knowledge.requestRebuild(context(res),text(req.params.id));res.status(202).json({status:'SCHEDULED'});}));
    router.post('/spaces/:id/query',route(async(req,res)=>{
      const body=object(req.body,['question']),controller=new AbortController();
      req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort();});
      const answer=await knowledge.ask(context(res),text(req.params.id),text(body.question,65536),controller.signal);
      if(!req.accepts('text/event-stream')||!req.header('accept')?.includes('text/event-stream')){res.json(answer);return;}
      // No unvalidated provider fragment is published: structured output, quote and final Authority checks complete first.
      await managed.subject.assertActive(context(res));
      res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');
      const send=async(event:enuKnowledgeStreamEvent,data:unknown)=>{
        if(controller.signal.aborted)throw new Error('CANCELLED');
        if(!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))await new Promise<void>((resolve,reject)=>{
          const cleanup=()=>{res.off('drain',drain);res.off('close',close);};
          const drain=()=>{cleanup();resolve();},close=()=>{cleanup();reject(new Error('CANCELLED'));};
          res.once('drain',drain);res.once('close',close);
        });
      };
      const characters=Array.from(answer.answer);
      for(let offset=0;offset<characters.length;offset+=256)await send(enuKnowledgeStreamEvent.Delta,{text:characters.slice(offset,offset+256).join('')});
      await send(enuKnowledgeStreamEvent.Citations,{citations:answer.citations});await send(enuKnowledgeStreamEvent.Done,{status:enuKnowledgeStreamState.Succeeded});res.end();
    }));
  }
  router.use((error:unknown,req:Request,res:Response,_next:express.NextFunction)=>{const safe=errorResponse(error);logFailure(req,res,safe);res.status(safe.status).json({error:safe.code});});
  app.use('/api/knowledge',router);
}
