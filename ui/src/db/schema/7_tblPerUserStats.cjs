// migrations/xxxxxxxxxxxxxx_create_tbl_per_user_stats.js

exports.up = async function (knex) {
  const dialect = knex.client.config.client;

  await knex.schema.createTable('tblPerUserStats', (table) => {
    // Primary key – auto-increment
    table.bigIncrements('pusID').primary();  
    // MySQL:   BIGINT UNSIGNED AUTO_INCREMENT
    // PG:      bigserial
    // MSSQL:   bigint IDENTITY(1,1)

    // Foreign key to user
    table
      .bigInteger('pusAssigned_usrID')
      .unsigned()                    // meaningful in MySQL only
      .notNullable();

    // Service identifier
    table
      .string('pusService', 4)
      .notNullable();

    // Counters – unsigned where possible
    table
      .integer('pusTotalFiles')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .integer('pusActiveFiles')
      .unsigned()
      .notNullable()
      .defaultTo(0);                 // MEDIUMINT → integer is safe (max ~16M)

    table
      .bigInteger('pusTotalSize')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .bigInteger('pusActiveSize')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .bigInteger('pusTotalChats')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .bigInteger('pusUsedTokens')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    // ───────────────────────────────────────────────
    // Indexes
    // ───────────────────────────────────────────────

    // Unique constraint on (user + service)
    table.unique(
      ['pusAssigned_usrID', 'pusService'],
      'pusAssigned_usrID_pusService'
    );

    // Index on service (useful when querying per service stats)
    table.index('pusService');
  });

  // ───────────────────────────────────────────────
  // Foreign Key – added separately (safer in some dialects)
  // ───────────────────────────────────────────────
  await knex.schema.table('tblPerUserStats', (table) => {
    table
      .foreign('pusAssigned_usrID', 'FK_tblPerUserStats_tblUser')
      .references('usrID')
      .inTable('tblUser')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  // Optional: Add CHECK constraints if you want to enforce non-negative values
  // (mostly useful in PostgreSQL and SQL Server; MySQL ≥8.0.16 supports CHECK)
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE tblPerUserStats
      ADD CONSTRAINT chk_tblPerUserStats_non_negative
      CHECK (
        "pusTotalFiles" >= 0 AND
        "pusActiveFiles" >= 0 AND
        "pusTotalSize" >= 0 AND
        "pusActiveSize" >= 0 AND
        "pusTotalChats" >= 0 AND
        "pusUsedTokens" >= 0
      )
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.dialect;

  // Optional: drop CHECK constraint first (PG & MSSQL)
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`
      ALTER TABLE tblPerUserStats
      DROP CONSTRAINT IF EXISTS chk_tblPerUserStats_non_negative
    `);
  }

  return knex.schema.dropTable('tblPerUserStats');
};