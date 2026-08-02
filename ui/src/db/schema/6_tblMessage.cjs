// migration file example: 20260216_create_tbl_messages.js

exports.up = async function (knex) {
  const dialect = knex.client.config.client;  // 'mysql', 'postgresql', 'mssql'

  await knex.schema.createTable('tblMessages', (table) => {
    // ───────────────────────────────────────────────
    // Columns
    // ───────────────────────────────────────────────

    table.bigIncrements('msgID').primary();  // MySQL: BIGINT UNSIGNED AUTO_INCREMENT
                                             // PG: bigserial
                                             // MSSQL: bigint IDENTITY(1,1)

    table
      .string('msgKey', 32)
      .notNullable();

    // ───────────────────────────────────────────────
    // msgRole – native ENUM where possible
    // ───────────────────────────────────────────────
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('msgRole', ['user', 'assistant'], {
          useNative: true,
          enumName: 'enum_tblmessages_msgrole'
        })
        .notNullable();
    } else {
      table
        .string('msgRole', 20)
        .notNullable();
    }

    table
      .bigInteger('msgRelated_chtID')
      .unsigned()                    // MySQL → UNSIGNED; ignored on PG/MSSQL
      .notNullable();

    table
      .text('msgContent')
      .notNullable();

    table
      .string('msgOpinion', 1)
      .nullable()
      .defaultTo(null);

    table
      .timestamp('msgCreatedAt', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now());

    // ───────────────────────────────────────────────
    // msgStatus – native ENUM where possible
    // ───────────────────────────────────────────────
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('msgStatus', ['Finished', 'Stopped'], {
          useNative: true,
          enumName: 'enum_tblmessages_msgstatus'
        })
        .notNullable();
    } else {
      table
        .string('msgStatus', 20)
        .notNullable();
    }

    // ───────────────────────────────────────────────
    // Indexes & Constraints
    // ───────────────────────────────────────────────

    // UNIQUE INDEX on (msgKey, msgRole)
    table.unique(['msgKey', 'msgRole'], 'msgKey');

    // Regular indexes
    table.index('msgRole');
    table.index('msgCreatedAt');
    table.index('msgOpinion');
    table.index('msgStatus');

    // Foreign key index (named as in original)
    table.index('msgRelated_chtID', 'FK_tblMessage_tblChats');
  });

  // ───────────────────────────────────────────────
  // Foreign Key (added in separate step – safer)
  // ───────────────────────────────────────────────
  await knex.schema.table('tblMessages', (table) => {
    table
      .foreign('msgRelated_chtID', 'FK_tblMessage_tblChats')
      .references('chtID')
      .inTable('tblChats')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  // ───────────────────────────────────────────────
  // CHECK constraints for ENUM-like behavior on non-native dialects
  // (PG & MSSQL always, MySQL 8.0.16+ as bonus)
  // ───────────────────────────────────────────────
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE tblMessages
      ADD CONSTRAINT chk_tblMessages_msgRole
      CHECK (msgRole IN ('user', 'assistant'))
    `);

    await knex.raw(`
      ALTER TABLE tblMessages
      ADD CONSTRAINT chk_tblMessages_msgStatus
      CHECK (msgStatus IN ('Finished', 'Stopped'))
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.config.client;

  // Drop CHECK constraints if they exist
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`ALTER TABLE tblMessages DROP CONSTRAINT IF EXISTS "chk_tblMessages_msgRole"`);
    await knex.raw(`ALTER TABLE tblMessages DROP CONSTRAINT IF EXISTS "chk_tblMessages_msgStatus"`);
  }

  return knex.schema.dropTable('tblMessages');
};