// migrations/xxxxxxxxxxxxxx_create_tbl_sample_questions.js

exports.up = async function (knex) {
  const dialect = knex.client.config.client;

  await knex.schema.createTable('tblSampleQuestions', (table) => {
    // Primary key – auto-increment
    table.bigIncrements('smqID').primary();
    // MySQL:   BIGINT UNSIGNED AUTO_INCREMENT
    // PG:      bigserial
    // MSSQL:   bigint IDENTITY(1,1)

    // Foreign key to tblFiles
    table
      .bigInteger('smqAssigned_filID')
      .unsigned()                    // only meaningful in MySQL
      .notNullable();

    // The actual sample question text
    table
      .string('smqQuestion', 100)
      .notNullable();

    // ───────────────────────────────────────────────
    // Indexes
    // ───────────────────────────────────────────────

    // Index on foreign key column (helps JOINs & lookups)
    table.index('smqAssigned_filID', 'FK_tblSampleQuestions_tblFiles');
  });

  // ───────────────────────────────────────────────
  // Foreign Key – added in a separate step (safer & more portable)
  // ───────────────────────────────────────────────
  await knex.schema.table('tblSampleQuestions', (table) => {
    table
      .foreign('smqAssigned_filID', 'FK_tblSampleQuestions_tblFiles')
      .references('filID')
      .inTable('tblFiles')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  // Optional: Add a CHECK constraint if you want to enforce non-empty questions
  // (useful in PostgreSQL & SQL Server; MySQL 8.0.16+ supports it)
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE tblSampleQuestions
      ADD CONSTRAINT chk_tblSampleQuestions_question_not_empty
      CHECK (TRIM("smqQuestion") <> '')
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.dialect;

  // Drop CHECK constraint if it exists (mainly for PG & MSSQL)
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`
      ALTER TABLE tblSampleQuestions
      DROP CONSTRAINT IF EXISTS chk_tblSampleQuestions_question_not_empty
    `);
  }

  return knex.schema.dropTable('tblSampleQuestions');
};