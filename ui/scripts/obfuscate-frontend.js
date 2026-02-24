// scripts/obfuscate-frontend.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const JavaScriptObfuscator = require('javascript-obfuscator');

const config = require('../obfuscator-frontend.config.json');
const inputDir = 'public';
const outputDir = 'public-dist';

// Ensure output dir exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

glob(`${inputDir}/**/*.js`, (err, files) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  files.forEach((file) => {
    const code = fs.readFileSync(file, 'utf8');

    try {
      const result = JavaScriptObfuscator.obfuscate(code, config);
      const obfuscated = result.getObfuscatedCode();

      // Preserve relative path
      const relative = path.relative(inputDir, file);
      const outFile = path.join(outputDir, relative);

      // Create subdirs if needed
      fs.mkdirSync(path.dirname(outFile), { recursive: true });

      fs.writeFileSync(outFile, obfuscated, 'utf8');
      console.log(`Obfuscated: ${relative} → ${outFile}`);
    } catch (e) {
      console.error(`Failed to obfuscate ${file}:`, e.message);
    }
  });

  console.log('Frontend JS obfuscation done.');
});