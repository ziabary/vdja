import { evaluateAuthority, getPrivValue, invalidationContract } from '../../../packages/authority/src/index.js';

export const authorityConformanceAdapter = { evaluate: evaluateAuthority, getPrivValue, invalidationContract };
