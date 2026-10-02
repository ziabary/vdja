import { clsConfigurationStore, type intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
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

export async function createPublicApiRuntime(snapshot: intfConfigurationSnapshot, secretRoot: string) {
  const pool = await createTargetDatabaseAdapter(snapshot, 'api', secretRoot);
  const store = new clsConfigurationStore(snapshot);
  const router = new clsAiRouter(store, createAiRunPersistence(pool),
    (endpoint, request, providerRequestId, onDelta) => callOpenAiCompatible(endpoint, request, providerRequestId, onDelta, secretRoot));
  const operation = createPublicOperationPersistence(pool);
  const usage = createUsagePersistence(pool);
  const dictionary = createTranslatorDictionaryPersistence(pool);
  const { admission, siem, fileProcessing } = snapshot.value;
  return {
    router, store, databaseReady: createTargetReadinessPersistence(pool), close: () => pool.end(),
    translate: (context: Parameters<typeof translate>[3], input: Parameters<typeof translate>[6], onDelta: Parameters<typeof translate>[7]) =>
      translate(operation, dictionary, router, context, admission.translator, siem, input, onDelta),
    summarize: (context: Parameters<typeof summarize>[2], input: Parameters<typeof summarize>[5], onDelta: Parameters<typeof summarize>[6]) =>
      summarize(operation, router, context, admission.summarizer, siem, input, onDelta),
    extractText: (context: Parameters<typeof extractPublicText>[1], module: 'translator' | 'summarizer', file: Parameters<typeof extractPublicText>[4], maxChars: number) =>
      extractPublicText(operation, context, admission[module], siem, file, fileProcessing, maxChars),
    inspectFaq: (context: Parameters<typeof inspectFaq>[1], file: Parameters<typeof inspectFaq>[4]) =>
      inspectFaq(operation, context, admission.faq, siem, file, fileProcessing),
    generateFaq: (context: Parameters<typeof generateFaq>[3], file: Parameters<typeof generateFaq>[6], options: Parameters<typeof generateFaq>[8], onMeta: Parameters<typeof generateFaq>[9], onBatch: Parameters<typeof generateFaq>[10]) =>
      generateFaq(operation, usage, router, context, admission.faq, siem, file, fileProcessing, options, onMeta, onBatch)
  };
}
