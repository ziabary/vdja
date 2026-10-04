import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfAdmissionPolicy } from '../../configuration/src/index.js';
import type { intfReservation } from './index.js';
export interface intfQueryAdmissionPort {
  reserve(context:intfExecutionContext,policy:intfAdmissionPolicy,inputChars:number,tokenReservation:number,outputTokens:number,operationKey?:string):Promise<intfReservation>;
  finish(transaction:intfTransactionHandle,context:intfExecutionContext,reservationId:string,succeeded:boolean,operationKey?:string):Promise<void>;
}
