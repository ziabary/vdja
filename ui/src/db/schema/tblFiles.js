// migration file example: 20260216_create_tbl_files.js

exports.up = async function (knex) {
  const dialect = knex.client.dialect();  // 'mysql', 'postgresql', 'mssql'

  await knex.schema.createTable('tblFiles', (table) => {
    // ───────────────────────────────────────────────
    // Columns
    // ───────────────────────────────────────────────

    table.bigIncrements('filID').primary();  // MySQL: BIGINT UNSIGNED AUTO_INCREMENT
                                             // PG: bigserial
                                             // MSSQL: bigint IDENTITY(1,1)

    table
      .bigInteger('filOwner_usrID')
      .unsigned()                    // MySQL → UNSIGNED; ignored on PG/MSSQL
      .notNullable();

    table
      .char('filKey', 32)
      .notNullable()
      .defaultTo('')
      .comment('UUID');              // comment is supported in MySQL & PostgreSQL

    table
      .char('filService', 4)
      .notNullable();

    table
      .string('filName', 100)
      .notNullable();

    table
      .bigInteger('filSize')
      .unsigned()                    // MySQL → UNSIGNED; ignored elsewhere
      .notNullable()
      // .zerofill()                 // NOT supported by Knex → MySQL-only display feature
      // → if critical, use raw SQL below for MySQL

    table
      .integer('filChunkCount')
      .unsigned()
      .notNullable();

    table
      .timestamp('filUploadedAt', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now());

    // ───────────────────────────────────────────────
    // filStatus – native ENUM where possible (performance + compactness)
    // ───────────────────────────────────────────────
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('filStatus', ['Active', 'Removed', 'Processing'], {
          useNative: true,                       // native ENUM in MySQL & PostgreSQL
          enumName: 'enum_tblfiles_filstatus'    // optional – nicer PG type name
        })
        .notNullable()
        .defaultTo('Processing');
    } else {
      // MSSQL fallback
      table
        .string('filStatus', 20)
        .notNullable()
        .defaultTo('Processing');
    }

    // ───────────────────────────────────────────────
    // Indexes
    // ───────────────────────────────────────────────

    table.unique(['filOwner_usrID', 'filKey', 'filService'], 'filOwner_usrID_filKey');

    table.index('filKey');
    table.index('filUploadedAt');
    table.index('filStatus');          // crucial for filtering on status
    table.index('filService');
  });

  // ───────────────────────────────────────────────
  // Foreign Key (added separately – safer in some dialects)
  // ───────────────────────────────────────────────

  await knex.schema.table('tblFiles', (table) => {
    table
      .foreign('filOwner_usrID', 'FK_tblFile_tblUser')
      .references('usrID')
      .inTable('tblUser')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  // ───────────────────────────────────────────────
  // CHECK constraint for filStatus (enforced on PG & MSSQL; MySQL 8+ bonus)
  // ───────────────────────────────────────────────
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE "tblFiles"
      ADD CONSTRAINT "chk_tblFiles_filStatus"
      CHECK ("filStatus" IN ('Active', 'Removed', 'Processing'))
    `);
  }

  // Optional: MySQL-only ZEROFILL on filSize (display padding, not storage)
  // Run only if dialect is mysql and you really need the display behavior
  if (dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE tblFiles
      MODIFY COLUMN filSize BIGINT(20) UNSIGNED ZEROFILL NOT NULL
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.dialect();

  // Drop CHECK if exists (PG & MSSQL mostly need it)
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`ALTER TABLE "tblFiles" DROP CONSTRAINT IF EXISTS "chk_tblFiles_filStatus"`);
  }

  return knex.schema.dropTable('tblFiles');
};