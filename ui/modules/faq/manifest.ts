import type { intfModuleManifest } from '../../packages/contracts/src/index.js';

export const MODULE_MANIFEST = {
  id: 'faq', version: '1.0.0',
  compatibility: { minPlatformVersion: '1.0.0', configSchemaVersion: 1 },
  instanceModel: 'DEPLOYMENT_SINGLETON',
  capabilities: { required: ['configuration', 'ai-router', 'admission-control', 'usage', 'audit', 'file-processing'] },
  backend: { routes: [
    { id: 'public.faq.inspect', method: 'POST', path: '/faq/inspect', surface: 'public' },
    { id: 'public.faq.generate', method: 'POST', path: '/faq', surface: 'public' }
  ] },
  ai: { tasks: [{ id: 'GENERATE_FAQ' }] },
  usage: { meters: [{ id: 'faq.public' }] },
  admission: { id: 'faq.anonymous' }
} satisfies intfModuleManifest;
