import { clsConfigurationStore, type intfAdmissionPolicy, type intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import { createTargetDatabaseAdapter, createTargetReadinessPersistence } from '../../../packages/persistence/src/target.js';
import { clsAiRouter, callOpenAiCompatible } from '../../../packages/ai-router/src/index.js';
import { createAiRunPersistence } from '../../../packages/ai-router/src/persistence.js';
import { createPublicOperationPersistence } from '../../../packages/platform/src/persistence.js';
import { createUsagePersistence } from '../../../packages/usage/src/persistence.js';
import { createTranslatorDictionaryPersistence } from '../../../modules/translator/src/persistence.js';
import { translate } from '../../../modules/translator/src/service.js';
import { summarize } from '../../../modules/summarizer/src/service.js';
import { inspectFaq, generateFaq } from '../../../modules/faq/src/service.js';
import { extractPublicText } from '../../../packages/file-processing/src/service.js';
import { clsAuthenticationService } from '../../../packages/authentication/src/service.js';
import { createAuthenticationPersistence } from '../../../packages/authentication/src/persistence.js';
import { loadAccessTokenKeys } from '../../../packages/session/src/access-token.js';
import { createSessionPersistence } from '../../../packages/session/src/persistence.js';
import { createAuthorityPersistence } from '../../../packages/authority/src/persistence.js';
import { createSecurityAuditPersistence } from '../../../packages/audit/src/persistence/security.js';

export async function createPublicApiRuntime(snapshot: intfConfigurationSnapshot, secretRoot: string) {
  const pool = await createTargetDatabaseAdapter(snapshot, 'api', secretRoot);
  const store = new clsConfigurationStore(snapshot);
  const router = new clsAiRouter(store, createAiRunPersistence(pool),
    (endpoint, request, providerRequestId, onDelta) => callOpenAiCompatible(endpoint, request, providerRequestId, onDelta, secretRoot));
  const operation = createPublicOperationPersistence(pool);
  const usage = createUsagePersistence(pool);
  const dictionary = createTranslatorDictionaryPersistence(pool);
  const { siem, fileProcessing } = snapshot.value;
  const authConfig = snapshot.value.auth;
  const authentication = authConfig?.enabled ? new clsAuthenticationService({
    ...createAuthenticationPersistence(pool), ...createSessionPersistence(pool, authConfig.session)
  },
    await loadAccessTokenKeys(authConfig, secretRoot),
    { issuer: authConfig.issuer, audience: authConfig.audience, lifetimeSeconds: authConfig.accessTokenSeconds }) : null;
  const authority = createAuthorityPersistence(pool, snapshot.value.deployment.id);
  const securityAudit = createSecurityAuditPersistence(pool, siem);
  return {
    router, store, authentication, authority, securityAudit, databaseReady: createTargetReadinessPersistence(pool), close: () => pool.end(),
    translate: (context: Parameters<typeof translate>[3], input: Parameters<typeof translate>[6], onDelta: Parameters<typeof translate>[7], policy: intfAdmissionPolicy) =>
      translate(operation, dictionary, router, context, policy, siem, input, onDelta),
    summarize: (context: Parameters<typeof summarize>[2], input: Parameters<typeof summarize>[5], onDelta: Parameters<typeof summarize>[6], policy: intfAdmissionPolicy) =>
      summarize(operation, router, context, policy, siem, input, onDelta),
    extractText: (context: Parameters<typeof extractPublicText>[1], module: 'translator' | 'summarizer', file: Parameters<typeof extractPublicText>[4], maxChars: number, policy: intfAdmissionPolicy) =>
      extractPublicText(operation, context, policy, siem, file, fileProcessing, maxChars),
    inspectFaq: (context: Parameters<typeof inspectFaq>[1], file: Parameters<typeof inspectFaq>[4], policy: intfAdmissionPolicy) =>
      inspectFaq(operation, context, policy, siem, file, fileProcessing),
    generateFaq: (context: Parameters<typeof generateFaq>[3], file: Parameters<typeof generateFaq>[6], options: Parameters<typeof generateFaq>[8], onMeta: Parameters<typeof generateFaq>[9], onBatch: Parameters<typeof generateFaq>[10], policy: intfAdmissionPolicy) =>
      generateFaq(operation, usage, router, context, policy, siem, file, fileProcessing, options, onMeta, onBatch)
  };
}
