// migrations/YYYYMMDDHHMMSS_create_tblMultiDic_and_load_data.js

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../data/multi-dic.csv'); // ← adjust this path!
// Make sure the CSV exists and matches columns (without dicID):
// dicSource,dicLang,dicWord,dicTranslation,dicSynonyms,dicAntonyms,dicRelExp,dicRelWord,dicPronunciation,dicExamples,dicExtra

exports.up = async function (knex) {
  const dialect = knex.client.dialect();

  // ───────────────────────────────────────────────
  // 1. Create the table (portable)
  // ───────────────────────────────────────────────
  await knex.schema.createTable('tblMultiDic', (table) => {
    table.increments('dicID').unsigned().primary(); // INT UNSIGNED AUTO_INCREMENT / serial / IDENTITY

    table.string('dicSource', 10).nullable();
    table.char('dicLang', 2).notNullable();
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

  console.log(`Table tblMultiDic created. Starting bulk data load for ~18M rows (${dialect})...`);

  // ───────────────────────────────────────────────
  // 2. Bulk load – dialect-specific fast path
  // ───────────────────────────────────────────────
  if (dialect === 'mysql' || dialect === 'mariadb') {
    // Fastest option for MySQL/MariaDB
    // Requirements: local_infile enabled (my.cnf + client flag)
    // Run with: knex --client mysql --connection ... migrate:latest
    await knex.raw(`
      LOAD DATA LOCAL INFILE ?
      INTO TABLE tblMultiDic
      CHARACTER SET utf8mb3
      FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
      LINES TERMINATED BY '\\n'
      IGNORE 1 LINES
      (@dicSource, @dicLang, @dicWord, @dicTranslation, @dicSynonyms, @dicAntonyms, @dicRelExp, @dicRelWord, @dicPronunciation, @dicExamples, @dicExtra)
      SET
        dicSource        = NULLIF(TRIM(@dicSource), ''),
        dicLang          = @dicLang,
        dicWord          = @dicWord,
        dicTranslation   = NULLIF(@dicTranslation, ''),
        dicSynonyms      = NULLIF(@dicSynonyms, ''),
        dicAntonyms      = NULLIF(@dicAntonyms, ''),
        dicRelExp        = NULLIF(@dicRelExp, ''),
        dicRelWord       = NULLIF(@dicRelWord, ''),
        dicPronunciation = NULLIF(@dicPronunciation, ''),
        dicExamples      = NULLIF(@dicExamples, ''),
        dicExtra         = NULLIF(@dicExtra, '')
    `, [CSV_PATH]);

    console.log('MySQL bulk load completed');
  } else if (dialect === 'postgresql') {
    // PostgreSQL COPY – very fast, but file must be readable by the server process
    // Alternative: use pg module + COPY FROM STDIN if path is client-side
    await knex.raw(`
      COPY "tblMultiDic" ("dicSource", "dicLang", "dicWord", "dicTranslation", "dicSynonyms", "dicAntonyms", "dicRelExp", "dicRelWord", "dicPronunciation", "dicExamples", "dicExtra")
      FROM ?
      DELIMITER ',' CSV HEADER NULL '' ENCODING 'UTF8'
    `, [CSV_PATH]); // Note: may need absolute path or COPY FROM PROGRAM if client-side

    console.log('PostgreSQL COPY completed');
  } else if (dialect === 'mssql') {
    // SQL Server BULK INSERT – file must be accessible to the SQL Server instance
    await knex.raw(`
      BULK INSERT tblMultiDic
      FROM ?
      WITH (
        FIELDTERMINATOR = ',',
        ROWTERMINATOR = '\\n',
        FIRSTROW = 2,
        CODEPAGE = '65001',     -- UTF-8
        TABLOCK,
        ERRORFILE = 'bulk_errors.log'
      )
    `, [CSV_PATH]);

    console.log('MSSQL BULK INSERT completed');
  } else {
    // Fallback: batched insert (VERY SLOW for 18M rows – use only for dev/small subsets)
    console.warn(`No fast bulk method for ${dialect}. Falling back to batched insert (this will take hours!)`);
    const batchSize = 2000;
    const stream = fs.createReadStream(CSV_PATH, { encoding: 'utf8' });
    // ... implement streaming parser (e.g. csv-parser) + knex.batchInsert in chunks ...
    // (code omitted for brevity – see libraries like csv-parser + knex batchInsert)
    throw new Error('Bulk fallback not implemented here – use LOAD DATA / COPY / BULK INSERT instead');
  }

  console.log('Migration completed: tblMultiDic created and populated.');
};

exports.down = async function (knex) {
  // Caution: drops 18M rows – be careful in production!
  return knex.schema.dropTable('tblMultiDic');
};