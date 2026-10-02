import type { intfModuleManifest } from '../../packages/contracts/src/index.js';

export const MODULE_MANIFEST = {
  id: 'translator', version: '1.0.0',
  compatibility: { minPlatformVersion: '1.0.0', configSchemaVersion: 1 },
  instanceModel: 'DEPLOYMENT_SINGLETON',
  capabilities: { required: ['configuration', 'ai-router', 'admission-control', 'usage', 'audit', 'file-processing'] },
  backend: { routes: [{ id: 'public.translate', method: 'POST', path: '/translate', surface: 'public' }] },
  ai: { tasks: [{ id: 'TRANSLATE' }] },
  usage: { meters: [{ id: 'translator.public' }] },
  admission: { id: 'translator.anonymous' }
} satisfies intfModuleManifest;
