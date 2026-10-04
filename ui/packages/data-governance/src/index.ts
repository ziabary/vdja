import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { enuProtectedAiTask,intfProtectedAiSource } from '../../contracts/src/protected-ai.js';
export enum enuEgressBoundary { Internal='PRIVATE_INTERNAL',External='EXTERNAL' }
export interface intfApprovedAiDestination {
  readonly endpointId:string;readonly origin:string;readonly boundary:enuEgressBoundary;readonly region:string;
  readonly permittedTasks:readonly enuProtectedAiTask[];
  readonly permittedClassifications:readonly intfProtectedAiSource['classification'][];
  readonly retention:'NO_RETENTION';readonly training:'PROHIBITED';
}
export interface intfGovernanceConfiguration { readonly policyVersion:string;readonly destinations:readonly intfApprovedAiDestination[] }
export interface intfGovernanceEvidence { readonly endpointId:string;readonly policyVersion:string;readonly task:enuProtectedAiTask;readonly allowed:boolean;readonly reason:'EGRESS_APPROVED'|'EGRESS_DENIED' }
export interface intfAiEgressPort {
  assertAllowed(context:intfExecutionContext,task:enuProtectedAiTask,endpoint:Readonly<{id:string;baseUrl:string}>,sources:readonly intfProtectedAiSource[]):Promise<void>;
}
export class exDataGovernance extends Error { constructor(){super('PROTECTED_EGRESS_DENIED');} }
/** Approval is explicit destination policy. Network locality and Authority do not supply egress permission. */
export class clsAiEgressGovernance implements intfAiEgressPort {
  constructor(private readonly configuration:intfGovernanceConfiguration,
    private readonly record:(context:intfExecutionContext,evidence:intfGovernanceEvidence)=>Promise<void>){}
  async assertAllowed(context:intfExecutionContext,task:enuProtectedAiTask,endpoint:Readonly<{id:string;baseUrl:string}>,sources:readonly intfProtectedAiSource[]):Promise<void>{
    const origin=new URL(endpoint.baseUrl).origin;
    const destination=this.configuration.destinations.find(value=>value.endpointId===endpoint.id&&value.origin===origin);
    const allowed=!!context.tenantId&&!!context.deploymentId&&sources.length>0&&!!destination
      &&destination.retention==='NO_RETENTION'&&destination.training==='PROHIBITED'
      &&destination.permittedTasks.includes(task)&&sources.every(source=>destination.permittedClassifications.includes(source.classification));
    await this.record(context,{endpointId:endpoint.id,policyVersion:this.configuration.policyVersion,task,allowed,reason:allowed?'EGRESS_APPROVED':'EGRESS_DENIED'});
    if(!allowed)throw new exDataGovernance();
  }
}
