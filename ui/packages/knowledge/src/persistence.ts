import type { intfExecutionContext } from '../../contracts/src/index.js';
import { resolveTargetTransaction } from '../../persistence/src/target-transaction.js';
import { exKnowledge, enuKnowledgeState, enuIndexState, enuMembershipMode, type intfKnowledgeSpace,
  type intfKnowledgeRepository, type intfIndexGeneration, type intfKnowledgeChunk } from './index.js';
import type { typClassificationLevel } from '../../authority/src/index.js';
interface intfSpaceRow { ksp_id: string; ksp_tenant_id: string; ksp_title: string; ksp_owner_id: string;
  ksp_classification: typClassificationLevel; ksp_lifecycle: enuKnowledgeState; ksp_security_version: string; ksp_generation_id: string | null;
  ksp_pending_generation_id:string|null;ksp_index_state:enuIndexState }
interface intfGenerationRow { kgn_id: string; kgn_profile_id: string; kgn_embedding_profile_id: string; kgn_dimensions: number;
  kgn_chunking_profile: string; kgn_chunk_chars: number; kgn_overlap_chars: number; kgn_collection: string; kgn_state: enuIndexState }
interface intfChunkRow { kch_id: string; kch_generation__kgn_id: string; kch_space__ksp_id: string; kch_document_id: string;
  kch_version_id: string; kch_ordinal: number; kch_start: number; kch_end: number; kch_sha256: string;
  kch_document_security_version: string; kch_membership_security_version: string }
const SPACE_COLUMNS = 'ksp_id,ksp_tenant_id,ksp_title,ksp_owner_id,ksp_classification,ksp_lifecycle,ksp_security_version,ksp_generation_id,ksp_pending_generation_id,ksp_index_state';
const GENERATION_COLUMNS = 'kgn_id,kgn_profile_id,kgn_embedding_profile_id,kgn_dimensions,kgn_chunking_profile,kgn_chunk_chars,kgn_overlap_chars,kgn_collection,kgn_state';
const CHUNK_COLUMNS = 'kch_id,kch_generation__kgn_id,kch_space__ksp_id,kch_document_id,kch_version_id,kch_ordinal,kch_start,kch_end,kch_sha256,kch_document_security_version,kch_membership_security_version';
function scope(context: intfExecutionContext): readonly [string,string] {
  if (!context.deploymentId || !context.tenantId) throw new exKnowledge('INVALID_KNOWLEDGE');
  return [context.deploymentId,context.tenantId];
}
function space(row: intfSpaceRow): intfKnowledgeSpace { return {
 type: 'knowledge_space', id: row.ksp_id, tenantId: row.ksp_tenant_id,
  ownerId: row.ksp_owner_id, classification: row.ksp_classification, title: row.ksp_title, lifecycle: row.ksp_lifecycle,
  securityVersion: Number(row.ksp_security_version), generationId: row.ksp_generation_id, projectionSecurityVersion: null,
  pendingGenerationId:row.ksp_pending_generation_id,requestedIndexState:row.ksp_index_state }; }
function generation(row: intfGenerationRow): intfIndexGeneration { return { generationId: row.kgn_id, id: row.kgn_profile_id,
  embeddingProfileId: row.kgn_embedding_profile_id, dimensions: row.kgn_dimensions, chunkingProfile: row.kgn_chunking_profile,
  chunkChars: row.kgn_chunk_chars, overlapChars: row.kgn_overlap_chars, collection: row.kgn_collection, state: row.kgn_state }; }
function chunk(row: intfChunkRow): intfKnowledgeChunk { return { id: row.kch_id,generationId: row.kch_generation__kgn_id,
  spaceId: row.kch_space__ksp_id, documentId: row.kch_document_id,versionId: row.kch_version_id,ordinal: row.kch_ordinal,
  start: row.kch_start,end: row.kch_end,sha256: row.kch_sha256,documentSecurityVersion: Number(row.kch_document_security_version),
  membershipSecurityVersion: Number(row.kch_membership_security_version) }; }
export function createKnowledgeRepository(): intfKnowledgeRepository {
  const repository: intfKnowledgeRepository = {
 async retentionReferences(tx,ctx,id){const result=await resolveTargetTransaction(tx).query(`SELECT kmb_document_id FROM knowledge.tbl_knw_membership JOIN knowledge.tbl_knw_space ON kmb_deployment_id=ksp_deployment_id AND kmb_tenant_id=ksp_tenant_id AND kmb_space__ksp_id=ksp_id WHERE kmb_deployment_id=$1 AND kmb_tenant_id=$2 AND kmb_document_id=$3 AND ksp_lifecycle='ACTIVE' AND kmb_lifecycle='ACTIVE' LIMIT 1`,[ctx.deploymentId,ctx.tenantId,id]);return !!result.rowCount;},
 async purgeProjections(tx,ctx,id){const result=await resolveTargetTransaction(tx).query<{collection:string;generationId:string;spaceId:string}>(`SELECT DISTINCT kgn_collection AS collection,kch_generation__kgn_id AS "generationId",kch_space__ksp_id AS "spaceId" FROM knowledge.tbl_knw_chunk JOIN knowledge.tbl_knw_generation ON kgn_deployment_id=kch_deployment_id AND kgn_tenant_id=kch_tenant_id AND kgn_id=kch_generation__kgn_id WHERE kch_deployment_id=$1 AND kch_tenant_id=$2 AND kch_document_id=$3`,[ctx.deploymentId,ctx.tenantId,id]);return result.rows;},
 async purgeMetadata(tx,ctx,id,leaseToken){await resolveTargetTransaction(tx).query('SELECT knowledge.fn_knw_purge_document($1,$2,$3,$4)',[ctx.deploymentId,ctx.tenantId,id,leaseToken]);},
    async requestIndex(tx,context,spaceId,generationId){
      await resolveTargetTransaction(tx).query(`UPDATE knowledge.tbl_knw_space SET ksp_pending_generation_id=$4,ksp_index_state=$5
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3 AND ksp_lifecycle=$6`,
        [...scope(context),spaceId,generationId,enuIndexState.Building,enuKnowledgeState.Active]);
    },
    async createSpace(tx,context,input) {
      const result = await resolveTargetTransaction(tx).query(`INSERT INTO knowledge.tbl_knw_space
        (ksp_id,ksp_deployment_id,ksp_tenant_id,ksp_title,ksp_owner_id,ksp_classification) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (ksp_deployment_id,ksp_tenant_id,ksp_id) DO NOTHING RETURNING ksp_id`,
        [input.id,...scope(context),input.title,context.actorId,input.classification]);
      if (!result.rowCount) {
        const known = await resolveTargetTransaction(tx).query<{ same: boolean }>(`SELECT
          ROW(ksp_title,ksp_owner_id,ksp_classification)=ROW($4::text,$5::text,$6::text) AS same FROM knowledge.tbl_knw_space
          WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,
          [...scope(context),input.id,input.title,context.actorId,input.classification]);
        if (!known.rows[0]?.same) throw new exKnowledge('INDEX_CONFLICT');
      }
    },
    async spaces(tx,context,after,limit) {
      if (!Number.isInteger(limit) || limit<1 || limit>100) throw new exKnowledge('INVALID_KNOWLEDGE');
      const result = await resolveTargetTransaction(tx).query<intfSpaceRow>(`SELECT ${SPACE_COLUMNS} FROM knowledge.tbl_knw_space
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_lifecycle=$3 AND ($4::uuid IS NULL OR ksp_id>$4)
        ORDER BY ksp_id LIMIT $5`,[...scope(context),enuKnowledgeState.Active,after,limit]);
      return result.rows.map(space);
    },
    async space(tx,context,id) {
      const client = resolveTargetTransaction(tx);
      const result = await client.query<intfSpaceRow>(`SELECT ${SPACE_COLUMNS} FROM knowledge.tbl_knw_space
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,[...scope(context),id]);
      const row = result.rows[0]; if (!row) return null;
      const value = space(row); if (!value.generationId) return value;
      const projection = await client.query<{ kpr_space_security_version: string }>(`SELECT kpr_space_security_version FROM knowledge.tbl_knw_projection
        WHERE kpr_deployment_id=$1 AND kpr_tenant_id=$2 AND kpr_generation__kgn_id=$3 AND kpr_space__ksp_id=$4`,
        [...scope(context),value.generationId,id]);
      return { ...value, projectionSecurityVersion: projection.rows[0] ? Number(projection.rows[0].kpr_space_security_version) : null };
    },
    async membership(tx,context,input) {
      const client = resolveTargetTransaction(tx);
      const locked = await client.query(`SELECT ksp_id FROM knowledge.tbl_knw_space
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3 AND ksp_lifecycle=$4 FOR UPDATE`,
        [...scope(context),input.spaceId,enuKnowledgeState.Active]);
      if (!locked.rowCount) throw new exKnowledge('KNOWLEDGE_DENIED');
      const result = await client.query(`INSERT INTO knowledge.tbl_knw_membership
        (kmb_deployment_id,kmb_tenant_id,kmb_space__ksp_id,kmb_document_id,kmb_mode,kmb_pinned_version_id)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (kmb_deployment_id,kmb_tenant_id,kmb_space__ksp_id,kmb_document_id)
        DO UPDATE SET kmb_mode=EXCLUDED.kmb_mode,kmb_pinned_version_id=EXCLUDED.kmb_pinned_version_id,kmb_lifecycle='ACTIVE',
          kmb_security_version=knowledge.tbl_knw_membership.kmb_security_version+1
        WHERE ROW(knowledge.tbl_knw_membership.kmb_mode,knowledge.tbl_knw_membership.kmb_pinned_version_id,knowledge.tbl_knw_membership.kmb_lifecycle)
          IS DISTINCT FROM ROW(EXCLUDED.kmb_mode,EXCLUDED.kmb_pinned_version_id,'ACTIVE') RETURNING kmb_document_id`,
        [...scope(context),input.spaceId,input.documentId,input.mode,input.pinnedVersionId]);
      if (result.rowCount) await client.query(`UPDATE knowledge.tbl_knw_space SET ksp_security_version=ksp_security_version+1
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,[...scope(context),input.spaceId]);
    },
    async removeMembership(tx,context,spaceId,documentId){const client=resolveTargetTransaction(tx);
      const removed=await client.query(`UPDATE knowledge.tbl_knw_membership SET kmb_lifecycle='RETIRED',kmb_security_version=kmb_security_version+1
        WHERE kmb_deployment_id=$1 AND kmb_tenant_id=$2 AND kmb_space__ksp_id=$3 AND kmb_document_id=$4 AND kmb_lifecycle='ACTIVE'`,
        [...scope(context),spaceId,documentId]);
      if(removed.rowCount)await client.query(`UPDATE knowledge.tbl_knw_space SET ksp_security_version=ksp_security_version+1
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,[...scope(context),spaceId]);
    },
    async memberships(tx,context,id) {
      const result = await resolveTargetTransaction(tx).query<{ kmb_space__ksp_id:string;kmb_document_id:string;kmb_mode:enuMembershipMode;kmb_pinned_version_id:string|null;kmb_security_version:string }>(
        `SELECT kmb_space__ksp_id,kmb_document_id,kmb_mode,kmb_pinned_version_id,kmb_security_version FROM knowledge.tbl_knw_membership
         WHERE kmb_deployment_id=$1 AND kmb_tenant_id=$2 AND kmb_space__ksp_id=$3 AND kmb_lifecycle='ACTIVE' ORDER BY kmb_document_id LIMIT 1001`,[...scope(context),id]);
      if (result.rows.length>1000) throw new exKnowledge('INVALID_KNOWLEDGE');
      return result.rows.map(row=>({spaceId:row.kmb_space__ksp_id,documentId:row.kmb_document_id,mode:row.kmb_mode,
        pinnedVersionId:row.kmb_pinned_version_id,securityVersion:Number(row.kmb_security_version)}));
    },
    async spacesForDocument(tx,context,id) {
      const result = await resolveTargetTransaction(tx).query<{ kmb_space__ksp_id: string }>(
        `SELECT kmb_space__ksp_id FROM knowledge.tbl_knw_membership JOIN knowledge.tbl_knw_space
           ON ksp_deployment_id=kmb_deployment_id AND ksp_tenant_id=kmb_tenant_id AND ksp_id=kmb_space__ksp_id
         WHERE kmb_deployment_id=$1 AND kmb_tenant_id=$2 AND kmb_document_id=$3 AND ksp_lifecycle=$4 AND kmb_lifecycle='ACTIVE'
         ORDER BY kmb_space__ksp_id LIMIT 1001`, [...scope(context),id,enuKnowledgeState.Active]);
      if(result.rows.length>1000)throw new exKnowledge('INVALID_KNOWLEDGE');
      return result.rows.map(row=>row.kmb_space__ksp_id);
    },
    async failGeneration(tx,context,id){
      await resolveTargetTransaction(tx).query(`UPDATE knowledge.tbl_knw_generation SET kgn_state=$4
        WHERE kgn_deployment_id=$1 AND kgn_tenant_id=$2 AND kgn_id=$3 AND kgn_state=$5`,[...scope(context),id,enuIndexState.Failed,enuIndexState.Building]);
      await resolveTargetTransaction(tx).query(`UPDATE knowledge.tbl_knw_space SET ksp_index_state=$4
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_pending_generation_id=$3`,[...scope(context),id,enuIndexState.Failed]);
    },
    async generation(tx,context,id) {
      const result = await resolveTargetTransaction(tx).query<intfGenerationRow>(`SELECT ${GENERATION_COLUMNS} FROM knowledge.tbl_knw_generation
        WHERE kgn_deployment_id=$1 AND kgn_tenant_id=$2 AND kgn_id=$3`,[...scope(context),id]);
      return result.rows[0] ? generation(result.rows[0]) : null;
    },
    async beginGeneration(tx,context,input) {
      if (input.state!==enuIndexState.Building) throw new exKnowledge('INVALID_KNOWLEDGE');
      await resolveTargetTransaction(tx).query(`INSERT INTO knowledge.tbl_knw_generation
        (kgn_id,kgn_deployment_id,kgn_tenant_id,kgn_profile_id,kgn_embedding_profile_id,kgn_dimensions,kgn_chunking_profile,kgn_chunk_chars,kgn_overlap_chars,kgn_collection)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (kgn_deployment_id,kgn_tenant_id,kgn_id) DO NOTHING`,
        [input.generationId,...scope(context),input.id,input.embeddingProfileId,input.dimensions,input.chunkingProfile,input.chunkChars,input.overlapChars,input.collection]);
      const known=await repository.generation(tx,context,input.generationId);
      if (!known || known.id!==input.id || known.embeddingProfileId!==input.embeddingProfileId || known.dimensions!==input.dimensions
        || known.chunkingProfile!==input.chunkingProfile || known.chunkChars!==input.chunkChars || known.overlapChars!==input.overlapChars || known.collection!==input.collection)
        throw new exKnowledge('INDEX_CONFLICT');
    },
    async chunks(tx,context,ids,generationId,spaceId) {
      if (ids.length>1000) throw new exKnowledge('INVALID_KNOWLEDGE');
      const result = await resolveTargetTransaction(tx).query<intfChunkRow>(`SELECT ${CHUNK_COLUMNS} FROM knowledge.tbl_knw_chunk
        WHERE kch_deployment_id=$1 AND kch_tenant_id=$2 AND kch_generation__kgn_id=$3 AND kch_space__ksp_id=$4 AND kch_id=ANY($5::uuid[])`,
        [...scope(context),generationId,spaceId,ids]); return result.rows.map(chunk);
    },
    async saveChunks(tx,context,values) {
      if (!values.length || values.length>256) throw new exKnowledge('INVALID_KNOWLEDGE');
      const client=resolveTargetTransaction(tx);
      const inserted = await client.query<{ kch_id:string }>(`INSERT INTO knowledge.tbl_knw_chunk
        (kch_id,kch_deployment_id,kch_tenant_id,kch_generation__kgn_id,kch_space__ksp_id,kch_document_id,kch_version_id,
         kch_ordinal,kch_start,kch_end,kch_sha256,kch_document_security_version,kch_membership_security_version)
        SELECT batch.id,$1,$2,batch.generation,batch.space,batch.document,batch.version,batch.ordinal,batch.start,batch.end,batch.hash,batch.doc_security,batch.membership_security
        FROM pg_catalog.jsonb_to_recordset($3::jsonb) AS batch(id uuid,generation uuid,space uuid,document uuid,version uuid,ordinal integer,start integer,"end" integer,hash text,doc_security bigint,membership_security bigint)
        ON CONFLICT (kch_deployment_id,kch_tenant_id,kch_generation__kgn_id,kch_space__ksp_id,kch_id) DO NOTHING RETURNING kch_id`,
        [...scope(context),JSON.stringify(values.map(value=>({id:value.id,generation:value.generationId,space:value.spaceId,document:value.documentId,
          version:value.versionId,ordinal:value.ordinal,start:value.start,end:value.end,hash:value.sha256,doc_security:value.documentSecurityVersion,membership_security:value.membershipSecurityVersion})))]);
      if (inserted.rowCount!==values.length) {
        const groups=new Map<string,intfKnowledgeChunk[]>(); for (const value of values) {
          const key=`${value.generationId}:${value.spaceId}`; groups.set(key,[...(groups.get(key)??[]),value]); }
        for (const group of groups.values()) {
          const rows=await repository.chunks(tx,context,group.map(value=>value.id),group[0]!.generationId,group[0]!.spaceId);
          const known=new Map(rows.map(row=>[row.id,row]));
          for (const value of group) {
            const row=known.get(value.id);
            if (!row || row.documentId!==value.documentId || row.versionId!==value.versionId || row.ordinal!==value.ordinal
              || row.start!==value.start || row.end!==value.end || row.sha256!==value.sha256 || row.documentSecurityVersion!==value.documentSecurityVersion
              || row.membershipSecurityVersion!==value.membershipSecurityVersion) throw new exKnowledge('INDEX_CONFLICT');
          }
        }
      }
    },
    async activate(tx,context,generationId,spaceId,securityVersion,expectedChunks,previousGenerationId) {
      const client=resolveTargetTransaction(tx);
      const locked=await client.query<{ksp_security_version:string;ksp_generation_id:string|null}>(`SELECT ksp_security_version,ksp_generation_id FROM knowledge.tbl_knw_space
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3 AND ksp_lifecycle=$4 FOR UPDATE`,[...scope(context),spaceId,enuKnowledgeState.Active]);
      const space=locked.rows[0];
      if (!space || Number(space.ksp_security_version)!==securityVersion ||
        (space.ksp_generation_id!==previousGenerationId && space.ksp_generation_id!==generationId)) throw new exKnowledge('STALE_PROJECTION');
      const count=await client.query<{chunks:string}>(`SELECT COUNT(kch_id) AS chunks FROM knowledge.tbl_knw_chunk
        WHERE kch_deployment_id=$1 AND kch_tenant_id=$2 AND kch_generation__kgn_id=$3 AND kch_space__ksp_id=$4`,[...scope(context),generationId,spaceId]);
      if (expectedChunks<1 || Number(count.rows[0]?.chunks)!==expectedChunks) throw new exKnowledge('INDEX_CONFLICT');
      await client.query(`INSERT INTO knowledge.tbl_knw_projection
        (kpr_deployment_id,kpr_tenant_id,kpr_generation__kgn_id,kpr_space__ksp_id,kpr_space_security_version,kpr_chunks,kpr_state)
        VALUES ($1,$2,$3,$4,$5,$6,'READY') ON CONFLICT (kpr_deployment_id,kpr_tenant_id,kpr_generation__kgn_id,kpr_space__ksp_id) DO NOTHING`,
        [...scope(context),generationId,spaceId,securityVersion,expectedChunks]);
      const projection=await client.query<{same:boolean}>(`SELECT (kpr_space_security_version=$5 AND kpr_chunks=$6) AS same FROM knowledge.tbl_knw_projection
        WHERE kpr_deployment_id=$1 AND kpr_tenant_id=$2 AND kpr_generation__kgn_id=$3 AND kpr_space__ksp_id=$4`,[...scope(context),generationId,spaceId,securityVersion,expectedChunks]);
      if (!projection.rows[0]?.same) throw new exKnowledge('INDEX_CONFLICT');
      await client.query(`UPDATE knowledge.tbl_knw_generation SET kgn_state=$4 WHERE kgn_deployment_id=$1 AND kgn_tenant_id=$2 AND kgn_id=$3`,[...scope(context),generationId,enuIndexState.Ready]);
      await client.query(`UPDATE knowledge.tbl_knw_space SET ksp_generation_id=$4 WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,[...scope(context),spaceId,generationId]);
      await client.query(`UPDATE knowledge.tbl_knw_space SET ksp_index_state=$5
        WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3 AND ksp_pending_generation_id=$4`,
        [...scope(context),spaceId,generationId,enuIndexState.Ready]);
    }
  }; return repository;
}
