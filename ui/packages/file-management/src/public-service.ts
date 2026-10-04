import {randomUUID} from 'node:crypto';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type {intfAdmissionPolicy,intfSiemConfiguration} from '../../configuration/src/index.js';
import {executePublicOperation,type intfPublicOperationPersistence} from '../../platform/src/publicOperation.js';
import {extractTemporaryFile,type intfUploadedFile,type intfFileLimits} from './temporary.js';
export async function extractPublicText(storage:intfPublicOperationPersistence,context:intfExecutionContext,policy:intfAdmissionPolicy,
  siem:intfSiemConfiguration,file:intfUploadedFile,limits:intfFileLimits,maxChars:number){
  return executePublicOperation(storage,{context,policy,siem,
    action:{requested:'public.file.extract.requested',completed:'public.file.extract.completed',failed:'public.file.extract.failed',cancelled:'public.file.extract.cancelled'},
    inputChars:0,uploadedBytes:file.size,tokenReservation:0,execute:async reservation=>{
      const extracted=await extractTemporaryFile(file,limits,maxChars);
      await storage.recordExtractedInput(context,reservation.id,policy,extracted.text.length);
      return{value:extracted,usage:[{runId:randomUUID(),inputChars:extracted.text.length,uploadedBytes:file.size,inputTokens:0,outputTokens:0,providerMs:0}]};
    }});
}
