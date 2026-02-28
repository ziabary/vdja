// migrations/YYYYMMDDHHMMSS_create_tblMultiDic_and_load_data.js

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../data/multi-dic.csv');
// Make sure the CSV exists and matches columns (without dicID):
// dicSource,dicLang,dicWord,dicTranslation,dicSynonyms,dicAntonyms,dicRelExp,dicRelWord,dicPronunciation,dicExamples,dicExtra

exports.up = async function (knex) {
  const dialect = knex.client.config.client;

  // ───────────────────────────────────────────────
  // 1. Create the table (portable)
  // ───────────────────────────────────────────────
  await knex.schema.createTable('tblMultiDic', (table) => {
    table.increments('dicID').unsigned().primary(); // INT UNSIGNED AUTO_INCREMENT / serial / IDENTITY

    table.string('dicSource', 10).nullable();
    table.string('dicLang', 2).notNullable();
    table.string('dicWord', 100).notNullable();

    table.text('dicTranslation').nullable();
    table.text('dicSynonyms').nullable();
    table.text('dicAntonyms').nullable();
    table.text('dicRelExp').nullable();
    table.text('dicRelWord').nullable();
    table.text('dicPronunciation').nullable();
    table.text('dicExamples').nullable();
    table.text('dicExtra').nullable();

    table.unique('dicWord', 'dicWord_unique');
    table.index('dicLang');
    table.index('dicSource');
  });

  console.log(`Table tblMultiDic created. Loading data from JSON...`);

  const jsonPath = path.join(__dirname, '../data/multi-dic.json'); // adjust path
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const records = [];

  for (const [word, entry] of Object.entries(rawData)) {
    const mainTrans = entry.translations?.[0] || null;
    const extraTrans = entry.translations?.slice(1).join('; ') || null;

    const synonymsStr = entry.synonyms ? JSON.stringify(entry.synonyms) : null;

    const antonymsStr = entry.antonyms ? JSON.stringify(entry.antonyms) : null;

    const relWordsStr = entry['related words'] ? JSON.stringify(entry['related words']) : null;

    const pronStr = entry.pronunciations ? JSON.stringify(entry.pronunciations) : null;

    records.push({
      dicSource: 'dic',
      dicLang: 'fa',
      dicWord: word,
      dicTranslation: mainTrans,
      dicSynonyms: synonymsStr,
      dicAntonyms: antonymsStr,
      dicRelExp: null, // map if you have
      dicRelWord: relWordsStr,
      dicPronunciation: pronStr,
      dicExamples: extraTrans,
      dicExtra: null, // or JSON.stringify(entry) to keep everything
    });
  }

  // Batch insert (safe for thousands of rows)
  const batchSize = 1;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try{
    await knex('tblMultiDic').insert(batch)
    }catch (e){
      console.log(`Duplicate entry ignored`, e.message)
    }
    console.log(`Inserted batch ${i / batchSize + 1} of ${Math.ceil(records.length / batchSize)}`);
  }

  console.log(`Loaded ${records.length} words from JSON.`);
};

exports.down = async function (knex) {
  // Caution: drops 18M rows – be careful in production!
  return knex.schema.dropTable('tblMultiDic');
};
