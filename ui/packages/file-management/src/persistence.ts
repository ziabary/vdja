import { randomUUID } from 'node:crypto';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import { resolveTargetTransaction } from '../../persistence/src/target-transaction.js';
import { enuTransferState, exFileManagement } from './index.js';
import { enuTransferOperation, type intfTransferRepository, type intfFileTransfer } from './transfers.js';

interface intfTransferRow {
  ftr_id: string; ftr_document__doc_id: string; ftr_idempotency_key: string; ftr_asset_id: string;
  ftr_proposed_version_id: string; ftr_version_id: string | null; ftr_storage_key: string;
  ftr_storage_profile: string; ftr_remote_upload_id: string | null; ftr_filename: string;
  ftr_media_type: string; ftr_bytes: string; ftr_sha256: string; ftr_part_bytes: number;
  ftr_state: enuTransferState; ftr_operation: enuTransferOperation | null; ftr_lease_token: string | null;
  ftr_lease_expires_at: Date | null; ftr_expires_at: Date; ftr_error_class: string | null;
}
const TRANSFER_COLUMNS = 'ftr_id,ftr_document__doc_id,ftr_idempotency_key,ftr_asset_id,ftr_proposed_version_id,ftr_version_id,ftr_storage_key,ftr_storage_profile,ftr_remote_upload_id,ftr_filename,ftr_media_type,ftr_bytes,ftr_sha256,ftr_part_bytes,ftr_state,ftr_operation,ftr_lease_token,ftr_lease_expires_at,ftr_expires_at,ftr_error_class';
function scope(context: intfExecutionContext): readonly [string, string] {
  if (!context.tenantId || !context.deploymentId) throw new exFileManagement('INVALID_TRANSFER');
  return [context.deploymentId, context.tenantId];
}
async function transfer(transaction: intfTransactionHandle, context: intfExecutionContext, row: intfTransferRow): Promise<intfFileTransfer> {
  const parts = await resolveTargetTransaction(transaction).query<{ fpt_number: number; fpt_bytes: number; fpt_sha256: string; fpt_etag: string }>(
    `SELECT fpt_number,fpt_bytes,fpt_sha256,fpt_etag FROM file_management.tbl_fil_part
     WHERE fpt_deployment_id=$1 AND fpt_tenant_id=$2 AND fpt_transfer__ftr_id=$3 AND fpt_etag IS NOT NULL ORDER BY fpt_number`, [...scope(context), row.ftr_id]);
  return { id: row.ftr_id, documentId: row.ftr_document__doc_id, idempotencyKey: row.ftr_idempotency_key,
    assetId: row.ftr_asset_id, proposedVersionId: row.ftr_proposed_version_id, versionId: row.ftr_version_id,
    storageKey: row.ftr_storage_key, storageProfile: row.ftr_storage_profile, remoteUploadId: row.ftr_remote_upload_id,
    filename: row.ftr_filename, mediaType: row.ftr_media_type, bytes: Number(row.ftr_bytes), sha256: row.ftr_sha256,
    partBytes: row.ftr_part_bytes, state: row.ftr_state, operation: row.ftr_operation, leaseToken: row.ftr_lease_token,
    leaseExpiresAt: row.ftr_lease_expires_at?.toISOString() ?? null, expiresAt: row.ftr_expires_at.toISOString(),
    errorClass: row.ftr_error_class, parts: parts.rows.map(part => ({ number: part.fpt_number, bytes: part.fpt_bytes,
      sha256: part.fpt_sha256, etag: part.fpt_etag })) };
}
async function ownedLease(transaction: intfTransactionHandle, context: intfExecutionContext,
  id: string, token: string): Promise<intfTransferRow> {
  const result = await resolveTargetTransaction(transaction).query<intfTransferRow>(
    `SELECT ${TRANSFER_COLUMNS} FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2
     AND ftr_id=$3 AND ftr_lease_token=$4 AND ftr_lease_expires_at>clock_timestamp() FOR UPDATE`, [...scope(context), id, token]);
  if (!result.rows[0]) throw new exFileManagement('TRANSFER_CONFLICT');
  return result.rows[0];
}
export function createTransferRepository(): intfTransferRepository {
  const repository: intfTransferRepository = {
 async purgePlan(tx,ctx,id){const result=await resolveTargetTransaction(tx).query<{id:string;storageKey:string;remoteUploadId:string|null}>(`SELECT ftr_id AS id,ftr_storage_key AS "storageKey",ftr_remote_upload_id AS "remoteUploadId" FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2 AND ftr_document__doc_id=$3`,[ctx.deploymentId,ctx.tenantId,id]);return result.rows;},
 async purgeMetadata(tx,ctx,id,leaseToken){await resolveTargetTransaction(tx).query('SELECT file_management.fn_fil_purge_metadata($1,$2,$3,$4)',[ctx.deploymentId,ctx.tenantId,id,leaseToken]);},
    async find(tx, context, id) {
      const result = await resolveTargetTransaction(tx).query<intfTransferRow>(`SELECT ${TRANSFER_COLUMNS}
        FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2 AND ftr_id=$3`, [...scope(context), id]);
      return result.rows[0] ? transfer(tx, context, result.rows[0]) : null;
    },
    async byIdempotency(tx, context, documentId, key) {
      const result = await resolveTargetTransaction(tx).query<intfTransferRow>(`SELECT ${TRANSFER_COLUMNS}
        FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2
        AND ftr_document__doc_id=$3 AND ftr_idempotency_key=$4`, [...scope(context), documentId, key]);
      return result.rows[0] ? transfer(tx, context, result.rows[0]) : null;
    },
    async create(tx, context, input) {
      const client = resolveTargetTransaction(tx);
      const result = await client.query<intfTransferRow>(`INSERT INTO file_management.tbl_fil_transfer
        (ftr_id,ftr_deployment_id,ftr_tenant_id,ftr_document__doc_id,ftr_idempotency_key,ftr_asset_id,
         ftr_proposed_version_id,ftr_storage_key,ftr_storage_profile,ftr_filename,ftr_media_type,ftr_bytes,
         ftr_sha256,ftr_part_bytes,ftr_expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (ftr_deployment_id,ftr_tenant_id,ftr_document__doc_id,ftr_idempotency_key) DO NOTHING
        RETURNING ${TRANSFER_COLUMNS}`, [input.id, ...scope(context), input.documentId, input.idempotencyKey,
        input.assetId, input.proposedVersionId, input.storageKey, input.storageProfile, input.filename,
        input.mediaType, input.bytes, input.sha256, input.partBytes, input.expiresAt]);
      if (result.rows[0]) return transfer(tx, context, result.rows[0]);
      const known = await repository.byIdempotency(tx, context, input.documentId, input.idempotencyKey);
      if (!known || known.filename !== input.filename || known.mediaType !== input.mediaType || known.bytes !== input.bytes
        || known.sha256 !== input.sha256 || known.partBytes !== input.partBytes || known.storageProfile !== input.storageProfile)
        throw new exFileManagement('TRANSFER_CONFLICT');
      return known;
    },
    async lease(tx, context, id, states, operation, leaseMs) {
      if (!Number.isInteger(leaseMs) || leaseMs < 50 || leaseMs > 900000 || states.length < 1)
        throw new exFileManagement('INVALID_TRANSFER');
      const result = await resolveTargetTransaction(tx).query<intfTransferRow>(`UPDATE file_management.tbl_fil_transfer
        SET ftr_lease_token=$4, ftr_lease_expires_at=clock_timestamp()+$5*interval '1 millisecond',
          ftr_operation=$6, ftr_updated_at=clock_timestamp()
        WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2 AND ftr_id=$3 AND ftr_state=ANY($7::text[])
          AND (ftr_lease_token IS NULL OR ftr_lease_expires_at<=clock_timestamp())
          AND (ftr_expires_at>clock_timestamp() OR $6 IN ($8,$9)) RETURNING ${TRANSFER_COLUMNS}`,
        [...scope(context), id, randomUUID(), leaseMs, operation, states, enuTransferOperation.Reconcile, enuTransferOperation.Expire]);
      return result.rows[0] ? transfer(tx, context, result.rows[0]) : null;
    },
    async update(tx, context, id, token, input) {
      if (input.errorClass && !/^[A-Z0-9_]{1,64}$/u.test(input.errorClass)) throw new exFileManagement('INVALID_TRANSFER');
      const result = await resolveTargetTransaction(tx).query(`UPDATE file_management.tbl_fil_transfer
        SET ftr_state=$5, ftr_remote_upload_id=COALESCE($6,ftr_remote_upload_id),
          ftr_version_id=COALESCE($7,ftr_version_id), ftr_error_class=$8,
          ftr_lease_token=CASE WHEN $9 THEN NULL ELSE ftr_lease_token END,
          ftr_lease_expires_at=CASE WHEN $9 THEN NULL ELSE ftr_lease_expires_at END, ftr_updated_at=clock_timestamp()
        WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2 AND ftr_id=$3 AND ftr_lease_token=$4
          AND ftr_lease_expires_at>clock_timestamp()
          AND ($6::text IS NULL OR ftr_remote_upload_id IS NULL OR ftr_remote_upload_id=$6)
          AND ($7::uuid IS NULL OR ftr_version_id IS NULL OR ftr_version_id=$7) RETURNING ftr_id`,
        [...scope(context), id, token, input.state, input.remoteUploadId ?? null, input.versionId ?? null,
          input.errorClass ?? null, input.releaseLease ?? true]);
      if (!result.rowCount) throw new exFileManagement('TRANSFER_CONFLICT');
    },
    async reservePart(tx, context, id, token, part) {
      const row = await ownedLease(tx, context, id, token);
      const size = Number(row.ftr_bytes), count = Math.ceil(size / row.ftr_part_bytes);
      const expectedBytes = part.number < count ? row.ftr_part_bytes : size - (count - 1) * row.ftr_part_bytes;
      if (row.ftr_state !== enuTransferState.Uploading || part.number < 1 || part.number > count
        || part.bytes !== expectedBytes) throw new exFileManagement('INVALID_TRANSFER');
      const client = resolveTargetTransaction(tx);
      const inserted = await client.query(`INSERT INTO file_management.tbl_fil_part
        (fpt_deployment_id,fpt_tenant_id,fpt_transfer__ftr_id,fpt_number,fpt_bytes,fpt_sha256)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (fpt_deployment_id,fpt_tenant_id,fpt_transfer__ftr_id,fpt_number)
        DO NOTHING RETURNING fpt_number`, [...scope(context), id, part.number, part.bytes, part.sha256]);
      if (!inserted.rowCount) {
        const known = await client.query<{ same: boolean }>(`SELECT (fpt_bytes=$5 AND fpt_sha256=$6) AS same
          FROM file_management.tbl_fil_part WHERE fpt_deployment_id=$1 AND fpt_tenant_id=$2
          AND fpt_transfer__ftr_id=$3 AND fpt_number=$4`, [...scope(context), id, part.number, part.bytes, part.sha256]);
        if (!known.rows[0]?.same) throw new exFileManagement('TRANSFER_CONFLICT');
      }
    },
    async acceptPart(tx, context, id, token, part) {
      await ownedLease(tx, context, id, token);
      if (!part.etag || part.etag.length > 256) throw new exFileManagement('INVALID_TRANSFER');
      const result = await resolveTargetTransaction(tx).query(`UPDATE file_management.tbl_fil_part SET fpt_etag=$7
        WHERE fpt_deployment_id=$1 AND fpt_tenant_id=$2 AND fpt_transfer__ftr_id=$3 AND fpt_number=$4
          AND fpt_bytes=$5 AND fpt_sha256=$6 RETURNING fpt_number`, [...scope(context), id, part.number, part.bytes, part.sha256, part.etag]);
      if (!result.rowCount) throw new exFileManagement('TRANSFER_CONFLICT');
    },
    async expired(tx, context, limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new exFileManagement('INVALID_TRANSFER');
      const result = await resolveTargetTransaction(tx).query<{ ftr_id: string }>(`SELECT ftr_id FROM file_management.tbl_fil_transfer
        WHERE ftr_deployment_id=$1 AND ftr_tenant_id=$2 AND ftr_expires_at<clock_timestamp()
          AND ftr_state<>ALL($3::text[]) ORDER BY ftr_expires_at LIMIT $4`,
        [...scope(context), [enuTransferState.Committed, enuTransferState.Expired], limit]);
      return result.rows.map(row => row.ftr_id);
    }
  };
  return repository;
}
