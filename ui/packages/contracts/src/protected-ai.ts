import type { intfExecutionContext } from './index.js';
export enum enuProtectedAiTask { DocumentEmbed='knowledge.document.embed', QueryEmbed='knowledge.query.embed',
  Rerank='knowledge.rerank', Answer='knowledge.answer' }
export enum enuAiExecutionKind { Embedding='EMBEDDING', Rerank='RERANK', Generation='GENERATION' }
export interface intfProtectedAiSource { readonly classification: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' }
export interface intfProtectedAiRequest {
  readonly context: intfExecutionContext; readonly task: enuProtectedAiTask;
  readonly sources: readonly intfProtectedAiSource[];
  /** Semantic owner refreshes authorization immediately before each provider dispatch. */
  readonly securityFence?:()=>Promise<void>;
  readonly texts?: readonly string[]; readonly query?: string;
  readonly messages?: readonly Readonly<{role:'system'|'user';content:string}>[];
  readonly maxOutputTokens?: number; readonly signal?: AbortSignal;
}
export interface intfEmbeddingProfile { readonly id:string;readonly dimensions:number;readonly modelId:string;readonly artifactRevision:string;readonly maxInputBytes:number }
export interface intfProtectedAiResult {
  readonly runId:string;readonly profile:intfEmbeddingProfile;
  readonly vectors?:readonly (readonly number[])[];readonly scores?:readonly number[];readonly text?:string;
  readonly inputTokens:number;readonly outputTokens:number;readonly endpointId:string;readonly attempts:number;
}
export interface intfProtectedAiPort {
  embeddingProfile():intfEmbeddingProfile;
  execute(request:intfProtectedAiRequest):Promise<intfProtectedAiResult>;
}
export interface intfProtectedAiModel {
  readonly id:string;readonly modelId:string;readonly artifactRevision:string;
  readonly kind:enuAiExecutionKind;readonly dimensions:number;readonly maxInputBytes:number;readonly maxOutputTokens:number;
  readonly contextTokens:number;
}
export interface intfProtectedAiEndpoint {
  readonly id:string;readonly modelProfileId:string;readonly enabled:boolean;readonly baseUrl:string;
  readonly capabilities:readonly enuProtectedAiTask[];readonly credentialRef?:`file:/run/secrets/${string}`;
  readonly maxConcurrent:number;readonly timeoutMs:number;
}
export interface intfProtectedAiPolicy {
  readonly modelProfileId:string;readonly preferredEndpoints:readonly string[];readonly maxAttempts:number;
  readonly maxInputBytes:number;readonly maxResponseBytes:number;
}
export interface intfProtectedAiConfiguration {
  readonly models:readonly intfProtectedAiModel[];readonly endpoints:readonly intfProtectedAiEndpoint[];
  readonly tasks:Readonly<Record<enuProtectedAiTask,intfProtectedAiPolicy>>;
}
