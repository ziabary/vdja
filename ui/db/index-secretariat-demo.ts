import configManager from '../src/utils/configManager';
import { indexDemoLetters } from '../src/services/secretariatService';

configManager.init('.config.json');
indexDemoLetters()
  .then(result => { console.log(`نمایه‌سازی نامه‌های نمونه: ${result.indexed} از ${result.total}`); process.exit(0); })
  .catch(error => { console.error(error.message); process.exit(1); });
