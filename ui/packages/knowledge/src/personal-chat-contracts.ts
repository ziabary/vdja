import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfTransactionHandle} from '../../contracts/src/transaction.js';
import type {intfKnowledgeCitation} from './service.js';

export interface intfPersonalChat {readonly id:string;readonly title:string;readonly updatedAt:string}
export interface intfPersonalMessage {readonly id:string;readonly role:'USER'|'ASSISTANT';readonly text:string;readonly citations:readonly intfKnowledgeCitation[]}
export interface intfPersonalChatRepository {
  create(tx:intfTransactionHandle,context:intfExecutionContext,id:string,spaceId:string):Promise<void>;
  list(tx:intfTransactionHandle,context:intfExecutionContext,spaceId:string):Promise<readonly intfPersonalChat[]>;
  active(tx:intfTransactionHandle,context:intfExecutionContext,id:string,spaceId:string):Promise<boolean>;
  messages(tx:intfTransactionHandle,context:intfExecutionContext,id:string):Promise<readonly intfPersonalMessage[]>;
  append(tx:intfTransactionHandle,context:intfExecutionContext,id:string,question:string,answer:string,citations:readonly intfKnowledgeCitation[]):Promise<void>;
  retire(tx:intfTransactionHandle,context:intfExecutionContext,spaceId:string,id:string|null):Promise<void>;
}
