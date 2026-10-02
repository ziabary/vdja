import type { intfModuleManifest } from '../../packages/contracts/src/index.js';

export const MODULE_MANIFEST = {
  id: 'summarizer', version: '1.0.0',
  compatibility: { minPlatformVersion: '1.0.0', configSchemaVersion: 1 },
  instanceModel: 'DEPLOYMENT_SINGLETON',
  capabilities: { required: ['configuration', 'ai-router', 'admission-control', 'usage', 'audit', 'file-processing'] },
  backend: { routes: [{ id: 'public.summarize', method: 'POST', path: '/summarize', surface: 'public' }] },
  ai: { tasks: [{ id: 'SUMMARIZE' }] },
  usage: { meters: [{ id: 'summarizer.public' }] },
  admission: { id: 'summarizer.anonymous' }
} satisfies intfModuleManifest;
