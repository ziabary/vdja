import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfTransactionHandle} from '../../contracts/src/transaction.js';

/** Version 1 counts actual admitted queries and completed work; tokens stay in AI Usage. */
export interface intfRagUsageFact {
  readonly operationId:string;readonly queries:number;readonly documentsProcessed:number;
  readonly embeddingItems:number;readonly retrievalCandidates:number;readonly authorizedChunks:number;
  readonly rerankItems:number;readonly generationCalls:number;readonly indexedChunks:number;
}
export interface intfRagUsagePort {record(tx:intfTransactionHandle,context:intfExecutionContext,fact:intfRagUsageFact):Promise<void>}
