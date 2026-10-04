/** Remove only generated wizard body embeddings. Database texts and files remain intact. */
import configManager from '../src/utils/configManager';
import { getDB } from '../src/db/index';
import vectorDB from '../src/services/vectorDB';

configManager.init('.config.json');
const db = await getDB();
try {
  const files = await db('tblSecretariatFiles').join('tblSecretariatLetters', 'ltrID', 'sflLetter_ltrID')
    .where('sflKind', 'body').where('ltrExternalID', 'like', 'secretariat-wizard-%').select('sflKey');
  for (const file of files) {
    await vectorDB().deleteFileChunks('SECRETARIAT_LETTERS', file.sflKey);
    await db('tblSecretariatFiles').where('sflKey', file.sflKey).update({ sflChunks: 0 });
  }
  console.log(`Removed wizard body embeddings for ${files.length} files; retained letters and attachments.`);
} finally { await db.destroy(); }
