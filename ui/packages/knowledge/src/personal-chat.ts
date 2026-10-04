import {randomUUID} from 'node:crypto';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfTransactionPort} from '../../contracts/src/transaction.js';
import type {intfExecutionSubjectPort} from '../../contracts/src/execution-subject.js';
import {clsKnowledgeService,type intfKnowledgeAnswer} from './service.js';
import type {intfPersonalChatRepository} from './personal-chat-contracts.js';

function identifier(value:string):void{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))throw new Error('INVALID_CHAT');}
export class clsPersonalChatService {
  constructor(private readonly ports:Readonly<{transactions:intfTransactionPort;subject:intfExecutionSubjectPort;knowledge:clsKnowledgeService;repository:intfPersonalChatRepository}>){ }
  private async space(context:intfExecutionContext):Promise<string>{await this.ports.subject.assertActive(context);return this.ports.knowledge.personalSpace(context);}
  async list(context:intfExecutionContext){const spaceId=await this.space(context);return this.ports.transactions.run(context,tx=>this.ports.repository.list(tx,context,spaceId));}
  async create(context:intfExecutionContext){const spaceId=await this.space(context),id=randomUUID();
    await this.ports.transactions.run(context,tx=>this.ports.repository.create(tx,context,id,spaceId));return{id};}
  async messages(context:intfExecutionContext,id:string){identifier(id);const spaceId=await this.space(context);
    return this.ports.transactions.run(context,async tx=>{if(!await this.ports.repository.active(tx,context,id,spaceId))throw new Error('CHAT_NOT_FOUND');
      return this.ports.repository.messages(tx,context,id);});}
  async retire(context:intfExecutionContext,id:string|null){if(id)identifier(id);const spaceId=await this.space(context);
    await this.ports.transactions.run(context,tx=>this.ports.repository.retire(tx,context,spaceId,id));}
  async ask(context:intfExecutionContext,id:string,question:string,signal?:AbortSignal):Promise<intfKnowledgeAnswer>{
    identifier(id);if(!question.trim()||question.length>65536)throw new Error('INVALID_CHAT');
    const spaceId=await this.space(context);
    const previous=await this.ports.transactions.run(context,async tx=>{
      if(!await this.ports.repository.active(tx,context,id,spaceId))throw new Error('CHAT_NOT_FOUND');
      return this.ports.repository.messages(tx,context,id);
    });
    const history=previous.slice(-4).map(item=>({role:item.role,content:item.text.slice(0,300)}));
    const answer=await this.ports.knowledge.ask(context,spaceId,question,signal,history);
    await this.ports.subject.assertActive(context);
    await this.ports.transactions.run(context,tx=>this.ports.repository.append(tx,context,id,question,answer.answer,answer.citations));
    return answer;
  }
}
