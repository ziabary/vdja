import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import { resolveTargetTransaction } from '../../persistence/src/target-transaction.js';
import { enuDocumentState, enuVersionState, enuAssetState, exDocument, type intfDocumentRepository,
  type intfDocumentFacts, type intfDocumentVersion, type intfDocumentAsset } from './index.js';
import type { typClassificationLevel } from '../../authority/src/index.js';

interface intfDocumentRow {
  doc_id: string; doc_tenant_id: string; doc_title: string; doc_owner_id: string;
  doc_classification: typClassificationLevel; doc_current_version_id: string | null;
  doc_security_version: string; doc_lifecycle: enuDocumentState;
}
interface intfVersionRow {
  dvr_id: string; dvr_document__doc_id: string; dvr_sequence: number; dvr_processing_state: enuVersionState;
  dvr_processor: string | null; dvr_content_hash: string | null; dvr_created_at: Date;
}
interface intfAssetRow {
  ast_id: string; ast_document__doc_id: string; ast_version__dvr_id: string; ast_storage_key: string;
  ast_storage_profile: string; ast_sha256: string; ast_bytes: string; ast_media_type: string;
  ast_filename: string; ast_lifecycle: intfDocumentAsset['lifecycle'];
}
const DOCUMENT_COLUMNS = 'doc_id, doc_tenant_id, doc_title, doc_owner_id, doc_classification, doc_current_version_id, doc_security_version, doc_lifecycle';
const VERSION_COLUMNS = 'dvr_id, dvr_document__doc_id, dvr_sequence, dvr_processing_state, dvr_processor, dvr_content_hash, dvr_created_at';
const ASSET_COLUMNS = 'ast_id, ast_document__doc_id, ast_version__dvr_id, ast_storage_key, ast_storage_profile, ast_sha256, ast_bytes, ast_media_type, ast_filename, ast_lifecycle';
function scope(context: intfExecutionContext): readonly [string, string] {
  if (!context.deploymentId || !context.tenantId) throw new exDocument('INVALID_DOCUMENT');
  return [context.deploymentId, context.tenantId];
}
function facts(row: intfDocumentRow): intfDocumentFacts {
  return { type: 'document', id: row.doc_id, tenantId: row.doc_tenant_id, ownerId: row.doc_owner_id,
    classification: row.doc_classification, currentVersionId: row.doc_current_version_id,
    securityVersion: Number(row.doc_security_version), lifecycle: row.doc_lifecycle };
}
function version(row: intfVersionRow): intfDocumentVersion {
  return { id: row.dvr_id, documentId: row.dvr_document__doc_id, sequence: row.dvr_sequence,
    processingState: row.dvr_processing_state, processor: row.dvr_processor,
    contentHash: row.dvr_content_hash, createdAt: row.dvr_created_at.toISOString() };
}
function asset(row: intfAssetRow): intfDocumentAsset {
  return { id: row.ast_id, documentId: row.ast_document__doc_id, versionId: row.ast_version__dvr_id,
    storageKey: row.ast_storage_key, storageProfile: row.ast_storage_profile, sha256: row.ast_sha256,
    bytes: Number(row.ast_bytes), mediaType: row.ast_media_type, filename: row.ast_filename, lifecycle: row.ast_lifecycle };
}
export function createDocumentRepository(): intfDocumentRepository {
  const repository: intfDocumentRepository = {
    async assertSnapshot(tx,context,expected){
      if(expected.length>1000||new Set(expected.map(value=>value.id)).size!==expected.length)throw new exDocument('INVALID_DOCUMENT');
      const result=await resolveTargetTransaction(tx).query<intfDocumentRow>(`SELECT ${DOCUMENT_COLUMNS} FROM documents.tbl_doc_document
        WHERE doc_deployment_id=$1 AND doc_tenant_id=$2 AND doc_id=ANY($3::uuid[]) ORDER BY doc_id FOR SHARE`,[...scope(context),expected.map(value=>value.id)]);
      const byId=new Map(result.rows.map(row=>[row.doc_id,facts(row)]));
      if(expected.some(value=>{const current=byId.get(value.id);return !current||current.securityVersion!==value.securityVersion
        ||current.currentVersionId!==value.currentVersionId||current.lifecycle!==value.lifecycle;}))throw new exDocument('STALE_DOCUMENT');
    },
    async facts(tx, context, id) {
      const result = await resolveTargetTransaction(tx).query<intfDocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents.tbl_doc_document
         WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = $3`, [...scope(context), id]);
      return result.rows[0] ? facts(result.rows[0]) : null;
    },
    async factsBatch(tx, context, ids) {
      if (ids.length > 1000) throw new exDocument('INVALID_DOCUMENT');
      const result = await resolveTargetTransaction(tx).query<intfDocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents.tbl_doc_document
         WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = ANY($3::uuid[])`, [...scope(context), ids]);
      return result.rows.map(facts);
    },
    async list(tx, context, after, limit) {
      const result = await resolveTargetTransaction(tx).query<intfDocumentRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents.tbl_doc_document
         WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_lifecycle = $3
         AND ($4::uuid IS NULL OR doc_id > $4::uuid) ORDER BY doc_id LIMIT $5`,
        [...scope(context), enuDocumentState.Active, after, limit]);
      return result.rows.map(row => ({ id: row.doc_id, title: row.doc_title,
        currentVersionId: row.doc_current_version_id, lifecycle: row.doc_lifecycle }));
    },
    async create(tx, context, input) {
      const client = resolveTargetTransaction(tx);
      const inserted = await client.query(`INSERT INTO documents.tbl_doc_document
        (doc_id, doc_deployment_id, doc_tenant_id, doc_title, doc_owner_id, doc_classification,
         doc_business_type, doc_business_id, doc_source_identity)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (doc_deployment_id, doc_tenant_id, doc_id) DO NOTHING
        RETURNING doc_id`, [input.id, ...scope(context), input.title, context.actorId, input.classification,
        input.businessResource?.type ?? null, input.businessResource?.id ?? null, input.sourceIdentity ?? null]);
      if (!inserted.rowCount) {
        // Compare the entire creation payload for retry integrity. Authority
        // has already decided manage; this check never grants resource access.
        const known = await client.query<{ matches: boolean }>(
          `SELECT ROW(doc_title, doc_owner_id, doc_classification, doc_business_type, doc_business_id,
             doc_source_identity, doc_lifecycle) IS NOT DISTINCT FROM ROW($4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::text) AS matches
           FROM documents.tbl_doc_document WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = $3`,
          [...scope(context), input.id, input.title, context.actorId, input.classification,
            input.businessResource?.type ?? null, input.businessResource?.id ?? null, input.sourceIdentity ?? null, enuDocumentState.Active]);
        if (!known.rows[0]?.matches) throw new exDocument('DOCUMENT_CONFLICT');
      }
    },
    async commitVersion(tx, context, input) {
      const client = resolveTargetTransaction(tx);
      const locked = await client.query(`SELECT doc_id FROM documents.tbl_doc_document
        WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = $3 AND doc_lifecycle = $4 FOR UPDATE`,
        [...scope(context), input.documentId, enuDocumentState.Active]);
      if (!locked.rowCount) throw new exDocument('DOCUMENT_NOT_AVAILABLE');
      const known = await client.query<intfVersionRow>(`SELECT ${VERSION_COLUMNS} FROM documents.tbl_doc_version
        WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_document__doc_id = $3 AND dvr_source_identity = $4`,
        [...scope(context), input.documentId, input.sourceIdentity]);
      if (known.rows[0]) {
        const original = await repository.asset(tx, context, input.documentId, known.rows[0].dvr_id);
        if (!original || original.sha256 !== input.asset.sha256 || original.bytes !== input.asset.bytes
          || original.mediaType !== input.asset.mediaType || original.filename !== input.asset.filename)
          throw new exDocument('DOCUMENT_CONFLICT');
        return version(known.rows[0]);
      }
      const inserted = await client.query<intfVersionRow>(`INSERT INTO documents.tbl_doc_version
        (dvr_id, dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_sequence, dvr_source_identity)
        SELECT $1,$2,$3,$4,COALESCE(MAX(dvr_sequence),0)+1,$5 FROM documents.tbl_doc_version
        WHERE dvr_deployment_id = $2 AND dvr_tenant_id = $3 AND dvr_document__doc_id = $4
        RETURNING ${VERSION_COLUMNS}`, [input.versionId, ...scope(context), input.documentId, input.sourceIdentity]);
      const value = input.asset;
      await client.query(`INSERT INTO documents.tbl_doc_asset
        (ast_id, ast_deployment_id, ast_tenant_id, ast_document__doc_id, ast_version__dvr_id,
         ast_storage_key, ast_storage_profile, ast_sha256, ast_bytes, ast_media_type, ast_filename, ast_lifecycle)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [value.id, ...scope(context), input.documentId,
        input.versionId, value.storageKey, value.storageProfile, value.sha256, value.bytes,
        value.mediaType, value.filename, value.lifecycle]);
      return version(inserted.rows[0]!);
    },
    async versions(tx, context, id) {
      const result = await resolveTargetTransaction(tx).query<intfVersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM documents.tbl_doc_version WHERE dvr_deployment_id = $1
         AND dvr_tenant_id = $2 AND dvr_document__doc_id = $3 ORDER BY dvr_sequence DESC`, [...scope(context), id]);
      return result.rows.map(version);
    },
    async asset(tx, context, documentId, versionId) {
      const result = await resolveTargetTransaction(tx).query<intfAssetRow>(
        `SELECT ${ASSET_COLUMNS} FROM documents.tbl_doc_asset WHERE ast_deployment_id = $1
         AND ast_tenant_id = $2 AND ast_document__doc_id = $3 AND ast_version__dvr_id = $4`,
        [...scope(context), documentId, versionId]);
      return result.rows[0] ? asset(result.rows[0]) : null;
    },
    async normalized(tx, context, versionId) {
      const result = await resolveTargetTransaction(tx).query<{ dvr_normalized_text: string | null }>(
        `SELECT dvr_normalized_text FROM documents.tbl_doc_version
         WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_id = $3`, [...scope(context), versionId]);
      return result.rows[0]?.dvr_normalized_text ?? null;
    },
    async normalizedBatch(tx, context, ids) {
      if (ids.length > 1000) throw new exDocument('INVALID_DOCUMENT');
      const result = await resolveTargetTransaction(tx).query<{ dvr_id: string; dvr_document__doc_id: string;
        dvr_normalized_text: string; dvr_content_hash: string; dvr_processor: string; dvr_processing_state: enuVersionState }>(
        `SELECT dvr_id,dvr_document__doc_id,dvr_normalized_text,dvr_content_hash,dvr_processor,dvr_processing_state
         FROM documents.tbl_doc_version JOIN documents.tbl_doc_asset
           ON ast_deployment_id=dvr_deployment_id AND ast_tenant_id=dvr_tenant_id
           AND ast_document__doc_id=dvr_document__doc_id AND ast_version__dvr_id=dvr_id
         WHERE dvr_deployment_id=$1 AND dvr_tenant_id=$2 AND dvr_id=ANY($3::uuid[])
         AND ast_lifecycle=$4 AND dvr_normalized_text IS NOT NULL AND dvr_content_hash IS NOT NULL`,
        [...scope(context), ids, enuAssetState.Approved]);
      return result.rows.map(row => ({ versionId: row.dvr_id, documentId: row.dvr_document__doc_id,
        text: row.dvr_normalized_text, sha256: row.dvr_content_hash, processor: row.dvr_processor, state: row.dvr_processing_state }));
    },
    async recordProcessed(tx, context, versionId, text, processor, hash) {
      const result = await resolveTargetTransaction(tx).query(`UPDATE documents.tbl_doc_version
        SET dvr_normalized_text = $4, dvr_processor = $5, dvr_content_hash = $6,
          dvr_processing_state = CASE WHEN dvr_processing_state = $7 THEN $7 ELSE $8 END
        WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_id = $3
          AND (dvr_content_hash IS NULL OR (dvr_content_hash = $6 AND dvr_processor = $5 AND dvr_normalized_text = $4))
        RETURNING dvr_id`, [...scope(context), versionId, text, processor, hash, enuVersionState.Ready, enuVersionState.Processing]);
      if (!result.rowCount) throw new exDocument('DOCUMENT_CONFLICT');
    },
    async markProcessing(tx, context, versionId, state) {
      const result = await resolveTargetTransaction(tx).query(`UPDATE documents.tbl_doc_version SET dvr_processing_state = $4
        WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_id = $3
          AND ($4 <> $5 OR dvr_content_hash IS NOT NULL) RETURNING dvr_id`,
        [...scope(context), versionId, state, enuVersionState.Ready]);
      if (!result.rowCount) throw new exDocument('VERSION_NOT_READY');
    },
    async activate(tx, context, versionId) {
      const client = resolveTargetTransaction(tx);
      const requested = await client.query<{ dvr_document__doc_id: string }>(
        `SELECT dvr_document__doc_id FROM documents.tbl_doc_version
         WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_id = $3 AND dvr_processing_state = $4`,
        [...scope(context), versionId, enuVersionState.Ready]);
      if (!requested.rows[0]) throw new exDocument('VERSION_NOT_READY');
      const result = await client.query(`UPDATE documents.tbl_doc_document AS document
        SET doc_current_version_id = $3, doc_security_version = CASE WHEN doc_current_version_id IS DISTINCT FROM $3
          THEN doc_security_version + 1 ELSE doc_security_version END
        WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = $4 AND doc_lifecycle = $5
          AND (doc_current_version_id IS NULL OR
            (SELECT dvr_sequence FROM documents.tbl_doc_version WHERE dvr_deployment_id = $1
              AND dvr_tenant_id = $2 AND dvr_id = document.doc_current_version_id) <=
            (SELECT dvr_sequence FROM documents.tbl_doc_version WHERE dvr_deployment_id = $1 AND dvr_tenant_id = $2 AND dvr_id = $3))
        RETURNING doc_id`, [...scope(context), versionId, requested.rows[0].dvr_document__doc_id, enuDocumentState.Active]);
      if (!result.rowCount) throw new exDocument('STALE_DOCUMENT');
    },
    async retire(tx, context, id) {
      const result = await resolveTargetTransaction(tx).query(`UPDATE documents.tbl_doc_document
        SET doc_lifecycle = $4, doc_security_version = doc_security_version + 1
        WHERE doc_deployment_id = $1 AND doc_tenant_id = $2 AND doc_id = $3 RETURNING doc_id`,
        [...scope(context), id, enuDocumentState.Retired]);
      if (!result.rowCount) throw new exDocument('DOCUMENT_NOT_AVAILABLE');
    }
  };
  return repository;
}
