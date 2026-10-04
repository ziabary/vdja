import { resolveSecretRef, type typFileStorageConfiguration } from '../../configuration/src/index.js';
import { enuStorageKind, type intfStoragePort } from './index.js';
import { clsLocalStorageAdapter } from './adapters/local.js';
import { clsS3StorageAdapter } from './adapters/s3.js';

export async function createStorageAdapter(configuration: typFileStorageConfiguration, secretRoot?: string): Promise<intfStoragePort> {
  switch (configuration.kind) {
    case enuStorageKind.Local: return new clsLocalStorageAdapter(configuration.root);
    case enuStorageKind.S3: {
      const [accessKeyId, secretAccessKey] = await Promise.all([
        resolveSecretRef(configuration.accessKeyRef, secretRoot), resolveSecretRef(configuration.secretKeyRef, secretRoot)
      ]);
      return new clsS3StorageAdapter({ ...configuration, credentials: { accessKeyId, secretAccessKey } });
    }
  }
}
