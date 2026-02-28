// migration file example: 20260216_create_tbl_logs.js

exports.up = async function (knex) {
  const dialect = knex.client.config.client;  // 'mysql', 'postgresql', 'mssql'

  await knex.schema.createTable('tblLogs', (table) => {
    // ───────────────────────────────────────────────
    // Columns
    // ───────────────────────────────────────────────

    table.bigIncrements('logID').primary();  // MySQL: BIGINT UNSIGNED AUTO_INCREMENT
                                             // PG:     bigserial
                                             // MSSQL:  bigint IDENTITY(1,1)

    table
      .string('logBy_usrKey', 32)
      .nullable()
      .defaultTo(null)
      .comment('Intentionally no FK');       // comment supported in MySQL & PostgreSQL

    table
      .string('logAction', 6)
      .notNullable();

    table
      .json('logInfo')                       // MySQL: JSON, PG: jsonb, MSSQL: nvarchar(MAX)
      .notNullable();                        // no default → must be provided on insert

    table
      .integer('logMsgLen')
      .nullable()
      .defaultTo(0);

    table
      .smallint('logResultCode')
      .nullable()
      .defaultTo(null);

    table
      .json('logResult')                     // same as above: JSON / jsonb / nvarchar(MAX)
      .nullable()
      .defaultTo(null);

    table
      .timestamp('logCreatedAt', { useTz: false })  // consistent across dialects
      .notNullable()
      .defaultTo(knex.fn.now());                    // CURRENT_TIMESTAMP / now() / GETDATE()

    // ───────────────────────────────────────────────
    // Indexes (as in original SQL)
    // ───────────────────────────────────────────────

    table.index('logCreatedAt');
    table.index('logAction');
    table.index('logMsgLen');

    // Index on the non-FK reference column (performance for lookups)
    table.index('logBy_usrKey', 'FK_tblLogs_tblUser');  // named index matching original
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblLogs');
};