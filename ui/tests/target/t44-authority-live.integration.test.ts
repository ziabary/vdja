import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { createSecurityAuditPersistence } from '../../packages/audit/src/persistence/security.js';
import { createAuthorityPersistence } from '../../packages/authority/src/persistence.js';
import { clsAuthorityService } from '../../packages/authority/src/service.js';
import type { intfProtectedResourceFacts } from '../../packages/authority/src/contracts.js';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../packages/contracts/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createSiemExportPersistence } from '../../packages/security-telemetry/src/persistence.js';
import { clsHttpsJsonSiemAdapter, deliverNext, type intfExportEnvelope } from '../../packages/security-telemetry/src/worker.js';

const configPath = process.env.T4_PG_CONFIG;
const secretRoot = process.env.T4_SECRETS_DIR;
if (process.env.T4_REQUIRE_LIVE === '1' && (!configPath || !secretRoot)) throw new Error('T44_LIVE_CONFIG_REQUIRED');

test('real persisted Authority resolves object, field, ACL, classification, scope, schedule, version and audited SIEM decisions',
  { skip: !configPath || !secretRoot }, async t => {
    const snapshot = await loadConfiguration(configPath!);
    const migration = await createTargetPool(snapshot, 'migration', secretRoot);
    const api = await createTargetPool(snapshot, 'api', secretRoot);
    const worker = await createTargetPool(snapshot, 'worker', secretRoot);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
    const schema = `t44_${suffix}`;
    const root = `Fixture_${suffix}`;
    const tenantA = `t44-a-${suffix}`, tenantB = `t44-b-${suffix}`;
    const ids = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID() };
    const membership = Object.fromEntries(Object.entries(ids).map(([name]) => [name, randomUUID()])) as Record<keyof typeof ids, string>;
    const resources = { a: randomUUID(), b: randomUUID(), high: randomUUID(), other: randomUUID() };
    const permissions = {
      read: `${root}.Resource.read`, edit: `${root}.Resource.edit`,
      public: `${root}.Field.public_summary.read`, internal: `${root}.Field.internal_note.read`,
      restricted: `${root}.Field.restricted_field.read`
    };
    const received: intfExportEnvelope[] = [];
    let receiver: Server | undefined;
    let deliveryCount = 0;
    try {
      receiver = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        received.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as intfExportEnvelope);
        deliveryCount += 1;
        response.statusCode = deliveryCount === 1 ? 503 : 200;
        response.end();
      });
      await new Promise<void>(resolve => receiver!.listen(0, '127.0.0.1', resolve));
      const address = receiver.address(); assert.ok(address && typeof address !== 'string');
      const siem = { ...snapshot.value.siem, enabled: true, destinationId: `authority-${suffix}`,
        url: `http://127.0.0.1:${address.port}/events`, events: ['authority.decision'],
        deliveryGuarantee: 'IDEMPOTENT' as const, maxAttempts: 3 };
      const securityAudit = createSecurityAuditPersistence(api, siem);
      const persistence = createAuthorityPersistence(api, snapshot.value.deployment.id);
      const authority = new clsAuthorityService({ ...persistence,
        recordDecision: (context, evidence) => securityAudit.recordAuthorityDecision(context, evidence) });
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
        correlationId: randomUUID(), source: 't44-fixture' }, async tx => {
        await tx.query(`CREATE SCHEMA ${schema}`);
        await tx.query(`CREATE TABLE ${schema}.tbl_fixture_resource (id uuid PRIMARY KEY, tenant text NOT NULL,
          owner_id uuid, classification text, organization_id text, public_summary text,
          internal_note text, restricted_field text)`);
        for (const [key, id] of Object.entries(ids)) {
          await tx.query(`INSERT INTO identity.tbl_idn_identity
            (idn_id,idn_kind,idn_display_name,idn_email_normalized) VALUES ($1,'HUMAN',$2,$3)`,
          [id, `T44 ${key}`, `${id}@example.invalid`]);
          await tx.query(`INSERT INTO identity.tbl_idn_membership
            (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)`, [membership[key]!, id, tenantA]);
          await tx.query(`INSERT INTO authority.tbl_aut_clearance
            (auc_identity__idn_id,auc_tenant_id,auc_level) VALUES ($1,$2,$3)`,
          [id, tenantA, key === 'a' ? 'HIGH' : 'LOW']);
        }
        await tx.query(`INSERT INTO authority.tbl_aut_org_edge
          (aoe_tenant_id,aoe_child_id,aoe_parent_id) VALUES ($1,'org-child','org-parent')`, [tenantA]);
        for (const [key, path] of Object.entries(permissions)) {
          await tx.query(`INSERT INTO authority.tbl_aut_permission
            (aup_path,aup_module_id,aup_value_kind,aup_all_default) VALUES ($1,$2,$3,$4::jsonb)`,
          [path, `fixture-${suffix}`, key === 'edit' ? 'CRUD' : 'BOOLEAN', JSON.stringify(key === 'edit' ? '1111' : true)]);
        }
        const roleA = randomUUID(), roleB = randomUUID();
        await tx.query(`INSERT INTO authority.tbl_aut_role
          (aur_id,aur_tenant_id,aur_name,aur_privileges) VALUES ($1,$2,$3,$4::jsonb)`,
        [roleA, tenantA, `owner-${suffix}`, JSON.stringify({ [root]: { ALL: true,
          Resource: { edit: '00w0' } } })]);
        await tx.query(`INSERT INTO authority.tbl_aut_role
          (aur_id,aur_tenant_id,aur_name,aur_privileges) VALUES ($1,$2,$3,$4::jsonb)`,
        [roleB, tenantA, `reader-${suffix}`, JSON.stringify({ [root]: { Resource: { ALL: true },
          Field: { public_summary: { read: true } } } })]);
        for (const [id, role, scope] of [[ids.a, roleA, 'org-parent'], [ids.b, roleB, null]] as const)
          await tx.query(`INSERT INTO authority.tbl_aut_grant
            (aug_id,aug_tenant_id,aug_identity__idn_id,aug_role__aur_id,aug_scope) VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), tenantA, id, role, scope]);
        await tx.query(`INSERT INTO authority.tbl_aut_grant
          (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges,aug_is_deny)
          VALUES ($1,$2,$3,$4::jsonb,true)`, [randomUUID(), tenantA, ids.a,
          JSON.stringify({ [root]: { Field: { restricted_field: { read: true } } } })]);
        await tx.query(`INSERT INTO authority.tbl_aut_grant
          (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges)
          VALUES ($1,$2,$3,$4::jsonb)`, [randomUUID(), tenantA, ids.d,
          JSON.stringify({ PublicTools: { faq: { use: true, limitTier: 'AUTHENTICATED' } } })]);
        await tx.query(`INSERT INTO authority.tbl_aut_resource_acl
          (ara_id,ara_tenant_id,ara_resource_type,ara_resource_id,ara_identity__idn_id,ara_effect,ara_permission)
          VALUES ($1,$2,'fixture',$3,$4,'DENY',$5),($6,$2,'fixture',$7,$8,'ALLOW',$5)`,
        [randomUUID(), tenantA, resources.b, ids.a, permissions.read,
          randomUUID(), resources.a, ids.d]);
        for (const [id, tenant, owner, classification, organization] of [
          [resources.a, tenantA, ids.a, 'LOW', 'org-child'],
          [resources.b, tenantA, ids.b, 'LOW', 'org-child'],
          [resources.high, tenantA, ids.a, 'HIGH', 'org-child'],
          [resources.other, tenantB, ids.a, 'LOW', 'org-child']
        ]) await tx.query(`INSERT INTO ${schema}.tbl_fixture_resource
          (id,tenant,owner_id,classification,organization_id,public_summary,internal_note,restricted_field)
          VALUES ($1,$2,$3,$4,$5,'public payload','internal payload','restricted payload')`,
        [id, tenant, owner, classification, organization]);
      });
      const context = (actor: keyof typeof ids, overrides: Partial<intfExecutionContext> = {}): intfExecutionContext => ({
        deploymentId: snapshot.value.deployment.id, tenantId: tenantA, moduleId: `fixture-${suffix}`,
        requestId: randomUUID().replaceAll('-', ''), correlationId: randomUUID(), actorKind: 'HUMAN',
        actorId: ids[actor], sessionId: null, authorizationVersion: 1, source: 'T44_TEST',
        configFingerprint: snapshot.fingerprint, ...overrides
      });
      const resource = async (id: string): Promise<intfProtectedResourceFacts> => {
        const found = await migration.query<{ id: string; tenant: string; owner_id: string | null;
          classification: 'LOW' | 'HIGH' | null; organization_id: string | null }>(
          `SELECT id,tenant,owner_id,classification,organization_id FROM ${schema}.tbl_fixture_resource WHERE id = $1`, [id]);
        const row = found.rows[0]; assert.ok(row);
        return { type: 'fixture', id: row.id, tenantId: row.tenant,
          ...(row.owner_id ? { ownerId: row.owner_id } : {}),
          ...(row.classification ? { classification: row.classification } : {}),
          ...(row.organization_id ? { organizationId: row.organization_id } : {}) };
      };
      const resourceA = await resource(resources.a), resourceB = await resource(resources.b);
      const resourceHigh = await resource(resources.high), resourceOther = await resource(resources.other);
      const authorize = (actor: keyof typeof ids, path: string, facts: intfProtectedResourceFacts,
        overrides: Partial<intfExecutionContext> = {}, crudOperation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE') =>
        authority.authorize({ context: context(actor, overrides), path, resource: facts,
          ...(crudOperation ? { crudOperation } : {}) });

      await t.test('object and ACL authorization precede payload materialization', async () => {
        let reads = 0;
        const load = async () => { reads += 1; return (await migration.query<{ public_summary: string }>(
          `SELECT public_summary FROM ${schema}.tbl_fixture_resource WHERE id = $1`, [resources.a])).rows[0]!.public_summary; };
        const allowed = await authority.materializeAuthorized({ context: context('a'), path: permissions.read, resource: resourceA }, load);
        assert.equal(allowed.decision.decision, 'ALLOW'); assert.equal(allowed.value, 'public payload');
        const denied = await authority.materializeAuthorized({ context: context('a'), path: permissions.read, resource: resourceB }, load);
        assert.equal(denied.decision.reason, 'EXPLICIT_DENY'); assert.equal(denied.value, undefined);
        assert.equal(reads, 1);
        assert.equal((await authorize('a', permissions.read, resourceOther)).reason, 'TENANT_MISMATCH');
        assert.equal((await authorize('d', permissions.read, resourceA)).reason, 'ACL_GRANT');
        assert.equal((await authorize('a', permissions.read, resourceB)).reason, 'EXPLICIT_DENY');
      });

      await t.test('field decisions return distinct allowed sets', async () => {
        const fields = [{ name: 'public_summary', permissionPath: permissions.public },
          { name: 'internal_note', permissionPath: permissions.internal },
          { name: 'restricted_field', permissionPath: permissions.restricted }];
        assert.deepEqual(await authority.authorizeFields(context('a'), resourceA, fields), ['public_summary', 'internal_note']);
        assert.deepEqual(await authority.authorizeFields(context('b'), resourceA, fields), ['public_summary']);
        let loaded: readonly string[] = [];
        const projection = await authority.materializeFields(context('b'), resourceA, fields, async names => {
          loaded = names;
          return Object.fromEntries(names.map(name => [name, 'loaded']));
        });
        assert.deepEqual(loaded, ['public_summary']);
        assert.deepEqual(Object.keys(projection.value ?? {}), ['public_summary']);
      });

      await t.test('classification, ownership, scope, and missing facts fail closed', async () => {
        assert.equal((await authorize('a', permissions.read, resourceHigh)).decision, 'ALLOW');
        assert.equal((await authorize('b', permissions.read, resourceHigh)).reason, 'CLASSIFICATION_BOUNDARY');
        assert.equal((await authorize('a', permissions.read, { ...resourceA, classification: 'CRITICAL' })).reason, 'CLASSIFICATION_BOUNDARY');
        assert.equal((await authorize('a', permissions.read, { ...resourceA, classification: undefined })).reason, 'CLASSIFICATION_BOUNDARY');
        assert.equal((await authorize('a', permissions.edit, resourceA, {}, 'READ')).decision, 'DENY');
        assert.equal((await authorize('a', permissions.edit, resourceA, {}, 'UPDATE')).decision, 'ALLOW');
        assert.equal((await authorize('a', permissions.edit, { ...resourceA, ownerId: undefined }, {}, 'UPDATE')).decision, 'DENY');
        assert.equal((await authorize('a', permissions.read, { ...resourceA, organizationId: undefined })).decision, 'DENY');
        assert.equal((await authorize('a', permissions.read, { ...resourceA, organizationId: 'unrelated' })).decision, 'DENY');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-clearance' }, tx => tx.query(`DELETE FROM authority.tbl_aut_clearance
          WHERE auc_identity__idn_id = $1 AND auc_tenant_id = $2`, [ids.d, tenantA]));
        assert.equal((await authorize('d', permissions.read, resourceA)).reason, 'CLASSIFICATION_BOUNDARY');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-clearance' }, tx => tx.query(`INSERT INTO authority.tbl_aut_clearance
          (auc_identity__idn_id,auc_tenant_id,auc_level) VALUES ($1,$2,'LOW')`, [ids.d, tenantA]));
      });

      await t.test('mandatory decision evidence failure blocks every current Authority path', async () => {
        const publicContext = context('d', { moduleId: 'faq' });
        assert.equal((await authority.authorizePublicTool(publicContext, 'faq')).decision, 'ALLOW');
        const unavailable = new clsAuthorityService({ ...persistence,
          recordDecision: async () => { throw new Error('AUDIT_UNAVAILABLE'); } });
        let materialized = false;
        const load = async () => { materialized = true; return 'protected'; };
        await assert.rejects(unavailable.authorizePublicTool(publicContext, 'faq'), /AUDIT_UNAVAILABLE/);
        for (const [actor, facts] of [['d', resourceA], ['a', resourceB], ['b', resourceHigh]] as const) {
          await assert.rejects(unavailable.materializeAuthorized({ context: context(actor),
            path: permissions.read, resource: facts }, load), /AUDIT_UNAVAILABLE/);
        }
        const fields = [{ name: 'public_summary', permissionPath: permissions.public }];
        await assert.rejects(unavailable.materializeFields(context('d'), resourceA, fields,
          async () => { materialized = true; return { public_summary: 'protected' }; }), /AUDIT_UNAVAILABLE/);
        assert.equal(materialized, false);
      });

      await t.test('persisted UTC and Jalali schedules, suspension, and version invalidation', async () => {
        const weekday = new Date().getUTCDay() || 7;
        const utcRule = { timezone: 'UTC', weekdays: [weekday], start: '00:00', end: '23:59' };
        const jalaliDay = Number(new Intl.DateTimeFormat('en-US-u-nu-latn',
          { timeZone: 'UTC', calendar: 'persian', day: 'numeric' }).format(new Date()));
        const grantId = randomUUID();
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-schedule' }, tx => tx.query(`INSERT INTO authority.tbl_aut_grant
          (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges,aug_valid_from,aug_valid_until,aug_recurring)
          VALUES ($1,$2,$3,$4::jsonb,CURRENT_TIMESTAMP-INTERVAL '1 day',CURRENT_TIMESTAMP+INTERVAL '1 day',$5::jsonb)`,
        [grantId, tenantA, ids.c, JSON.stringify({ [root]: { Resource: { read: true } } }), JSON.stringify(utcRule)]));
        assert.equal((await authorize('c', permissions.read, resourceA)).decision, 'ALLOW');
        const tehranWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', weekday: 'short' }).format(new Date());
        const weekdayNumber = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[tehranWeekday];
        assert.ok(weekdayNumber);
        const tehranRule = { ...utcRule, timezone: 'Asia/Tehran', weekdays: [weekdayNumber] };
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-schedule' }, tx => tx.query(`UPDATE authority.tbl_aut_grant
          SET aug_recurring = $2::jsonb WHERE aug_id = $1`, [grantId, JSON.stringify(tehranRule)]));
        assert.equal((await authorize('c', permissions.read, resourceA)).decision, 'ALLOW');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-schedule' }, tx => tx.query(`UPDATE authority.tbl_aut_grant
          SET aug_recurring = $2::jsonb WHERE aug_id = $1`, [grantId, JSON.stringify({ ...utcRule,
          calendar: 'JALALI', oddEvenDay: jalaliDay % 2 ? 'ODD' : 'EVEN' })]));
        assert.equal((await authorize('c', permissions.read, resourceA)).decision, 'ALLOW');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-schedule' }, tx => tx.query(`UPDATE authority.tbl_aut_grant
          SET aug_valid_until = CURRENT_TIMESTAMP-INTERVAL '1 second',
          aug_valid_from = CURRENT_TIMESTAMP-INTERVAL '2 days' WHERE aug_id = $1`, [grantId]));
        assert.equal((await authorize('c', permissions.read, resourceA)).decision, 'DENY');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-version' }, tx => tx.query(`UPDATE identity.tbl_idn_membership
          SET idm_authorization_version = 2 WHERE idm_id = $1`, [membership.a]));
        assert.equal((await authorize('a', permissions.read, resourceA)).reason, 'AUTHORIZATION_VERSION_MISMATCH');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-suspension' }, tx => tx.query(`UPDATE identity.tbl_idn_identity
          SET idn_state = 'SUSPENDED' WHERE idn_id = $1`, [ids.b]));
        assert.equal((await authorize('b', permissions.read, resourceA)).reason, 'INVALID_OR_INACTIVE_ACTOR');
        await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
          correlationId: randomUUID(), source: 't44-termination' }, tx => tx.query(`UPDATE identity.tbl_idn_identity
          SET idn_state = 'TERMINATED' WHERE idn_id = $1`, [ids.c]));
        assert.equal((await authorize('c', permissions.read, resourceA)).reason, 'INVALID_OR_INACTIVE_ACTOR');
      });

      await t.test('HUMAN origin, mandatory Audit, SIEM retry, redaction and audit immutability', async () => {
        const workerContext = context('d', { source: 'WORKER_ON_BEHALF', sessionId: randomUUID(),
          requestId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', correlationId: randomUUID() });
        assert.equal((await authority.authorize({ context: workerContext, path: permissions.read, resource: resourceA })).decision, 'ALLOW');
        const invalidService = new clsAuthorityService({ ...persistence,
          recordDecision: async () => { throw new Error('AUDIT_UNAVAILABLE'); } });
        let loaded = false;
        await assert.rejects(invalidService.materializeAuthorized({ context: context('d'),
          path: permissions.read, resource: resourceA }, async () => { loaded = true; return 'secret'; }), /AUDIT_UNAVAILABLE/);
        assert.equal(loaded, false);
        const events = await api.query<{ ase_id: string; ase_actor_kind: string; ase_actor_id: string;
          ase_session_id: string; ase_request_id: string; ase_correlation_id: string;
          ase_authority_context: Record<string, unknown> }>(`SELECT ase_id,ase_actor_kind,ase_actor_id,ase_session_id,
          ase_request_id,ase_correlation_id,ase_authority_context FROM audit.tbl_aud_semantic_event
          WHERE ase_action = 'authority.decision' AND ase_correlation_id = $1`, [workerContext.correlationId]);
        assert.equal(events.rowCount, 1);
        const event = events.rows[0]!;
        assert.equal(event.ase_actor_kind, 'HUMAN'); assert.equal(event.ase_actor_id, ids.d);
        assert.equal(event.ase_session_id, workerContext.sessionId);
        assert.equal(event.ase_request_id, workerContext.requestId);
        assert.equal(event.ase_authority_context.decision, 'ALLOW');
        assert.equal(event.ase_authority_context.resourceId, resources.a);
        assert.ok(!JSON.stringify(event).includes('payload'));
        assert.doesNotMatch(JSON.stringify(event), /password|refreshToken|accessToken|cookie/i);
        await assert.rejects(api.query(`UPDATE audit.tbl_aud_semantic_event SET ase_reason = 'rewritten' WHERE ase_id = $1`, [event.ase_id]), /permission denied/);
        await assert.rejects(worker.query(`DELETE FROM audit.tbl_aud_semantic_event WHERE ase_id = $1`, [event.ase_id]), /permission denied/);
        const exportStore = createSiemExportPersistence(worker);
        assert.equal(await deliverNext(exportStore, siem, new clsHttpsJsonSiemAdapter()), 'RETRY');
        await withTargetTransaction(worker, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-worker',
          correlationId: randomUUID(), source: 't44-retry' }, tx => tx.query(`UPDATE telemetry.tbl_tel_export
          SET tex_next_attempt_at = CURRENT_TIMESTAMP WHERE tex_destination_id = $1 AND tex_status = 'RETRY'`, [siem.destinationId]));
        assert.equal(await deliverNext(exportStore, siem, new clsHttpsJsonSiemAdapter()), 'DELIVERED');
        assert.equal(received.length, 2);
        assert.equal(received[0]?.action, 'authority.decision');
        assert.equal(received[0]?.authorityContext?.decision, 'ALLOW');
        for (let index = 0; index < 100; index += 1) {
          if (await deliverNext(exportStore, siem, new clsHttpsJsonSiemAdapter()) === 'EMPTY') break;
        }
        const exportedReasons = new Set(received.map(event => event.authorityContext?.reason));
        for (const reason of ['ACL_GRANT', 'EXPLICIT_DENY', 'TENANT_MISMATCH', 'CLASSIFICATION_BOUNDARY'])
          assert.ok(exportedReasons.has(reason), `SIEM missing ${reason}`);
        assert.ok(!JSON.stringify(received).includes('payload'));
        assert.doesNotMatch(JSON.stringify(received), /password|refreshToken|accessToken|cookie/i);
        const stillThere = await api.query('SELECT ase_id FROM audit.tbl_aud_semantic_event WHERE ase_id = $1', [event.ase_id]);
        assert.equal(stillThere.rowCount, 1);
      });
    } finally {
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't44-fixture',
        correlationId: randomUUID(), source: 't44-cleanup' }, async tx => {
        await tx.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await tx.query('DELETE FROM authority.tbl_aut_resource_acl WHERE ara_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM authority.tbl_aut_role WHERE aur_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM authority.tbl_aut_org_edge WHERE aoe_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM authority.tbl_aut_clearance WHERE auc_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_tenant_id = $1', [tenantA]);
        await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id = ANY($1::uuid[])', [Object.values(ids)]);
        await tx.query('DELETE FROM authority.tbl_aut_permission WHERE aup_module_id = $1', [`fixture-${suffix}`]);
      });
      await migration.end(); await api.end(); await worker.end();
      if (receiver) await new Promise<void>((resolve, reject) => receiver!.close(error => error ? reject(error) : resolve()));
    }
  });
