/** Browser-safe projections. Operation permissions are UX hints, never authority. */
export interface intfKnowledgeDocumentView { readonly id:string;readonly title:string;readonly currentVersionId:string|null;readonly lifecycle:string }
export interface intfKnowledgeVersionView { readonly id:string;readonly sequence:number;readonly processingState:string }
export interface intfKnowledgeSpaceView { readonly id:string;readonly title:string;readonly generationId:string|null }
export interface intfKnowledgeSpaceStatus { readonly id:string;readonly title:string;readonly state:string;readonly memberships:readonly Readonly<{documentId:string;mode:string;pinnedVersionId:string|null}>[] }
export interface intfManagedTransferView { readonly id:string;readonly documentId:string;readonly state:string;readonly partBytes:number;readonly acceptedParts:readonly number[];readonly expiresAt:string;readonly versionId:string|null;readonly errorClass:string|null }
export interface intfKnowledgeCitationView { readonly label:string;readonly documentId:string;readonly versionId:string;readonly chunkId:string;readonly start:number;readonly end:number;readonly mayRead:boolean;readonly mayQuote:boolean }
export interface intfKnowledgeAnswerView { readonly answer:string;readonly citations:readonly intfKnowledgeCitationView[] }
export enum enuKnowledgeStreamEvent { Delta = 'answer.delta', Citations = 'answer.citations', Done = 'answer.done' }
export enum enuKnowledgeStreamState { Succeeded = 'SUCCEEDED' }
