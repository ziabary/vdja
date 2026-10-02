export type typAiOperationState='IDLE'|'SUBMITTING'|'STREAMING'|'COMPLETING'|'SUCCEEDED'|'FAILED'|'CANCELLED'|'INTERRUPTED'|'UNRESOLVED';
export type typAiOperationEvent='SUBMIT'|'STREAM_START'|'TERMINAL_SUCCESS'|'CONFIRM_RESULT'|'FAIL'|'CANCEL_ACK'|'INTERRUPT'|'OUTCOME_UNKNOWN'|'RESET';
const transitions:Readonly<Record<typAiOperationState,Readonly<Partial<Record<typAiOperationEvent,typAiOperationState>>>>>={
  IDLE:{SUBMIT:'SUBMITTING'}, SUBMITTING:{STREAM_START:'STREAMING',TERMINAL_SUCCESS:'COMPLETING',FAIL:'FAILED',CANCEL_ACK:'CANCELLED',INTERRUPT:'INTERRUPTED',OUTCOME_UNKNOWN:'UNRESOLVED'},
  STREAMING:{TERMINAL_SUCCESS:'COMPLETING',FAIL:'FAILED',CANCEL_ACK:'CANCELLED',INTERRUPT:'INTERRUPTED',OUTCOME_UNKNOWN:'UNRESOLVED'},
  COMPLETING:{CONFIRM_RESULT:'SUCCEEDED',FAIL:'FAILED',OUTCOME_UNKNOWN:'UNRESOLVED'},
  SUCCEEDED:{RESET:'IDLE'},FAILED:{RESET:'IDLE'},CANCELLED:{RESET:'IDLE'},INTERRUPTED:{RESET:'IDLE'},UNRESOLVED:{RESET:'IDLE'}
};
export function transitionAiOperation(state:typAiOperationState,event:typAiOperationEvent):typAiOperationState {
  const next=transitions[state][event];if(!next)throw new Error(`Illegal AI operation transition ${state}/${event}`);return next;
}
export interface intfAiOperationView { readonly state:typAiOperationState;readonly cancelRequested:boolean;readonly operationId:string|null;readonly tenantEpoch:number }
export function requestCancellation(view:intfAiOperationView):intfAiOperationView {
  if(!['SUBMITTING','STREAMING'].includes(view.state))throw new Error('Cannot request cancellation in this state');
  return {...view,cancelRequested:true};
}
