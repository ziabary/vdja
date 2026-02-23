// Example migration file: 20260216_create_tbl_chats.js

exports.up = async function (knex) {
  const dialect = knex.client.dialect();  // 'mysql', 'postgresql', 'mssql'

  await knex.schema.createTable('tblChats', (table) => {
    // ───────────────────────────────────────────────
    // Columns
    // ───────────────────────────────────────────────

    table.bigIncrements('chtID').primary();  // AUTO_INCREMENT / bigserial / IDENTITY

    table
      .char('chtKey', 32)
      .notNullable()
      .defaultTo('');

    table
      .bigInteger('chtOwner_usrID')
      .unsigned()                    // MySQL → UNSIGNED; ignored on PG/MSSQL
      .notNullable();

    table
      .char('chtService', 4)
      .notNullable();

    table
      .string('chtTitle', 100)
      .nullable();                   // DEFAULT NULL implicit

    table
      .bigInteger('chtLast_msgID')
      .unsigned()                    // MySQL only
      .nullable();

    table
      .timestamp('chtCreatedAt', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now());

    // ───────────────────────────────────────────────
    // chtStatus – native ENUM where possible
    // ───────────────────────────────────────────────
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('chtStatus', ['Active', 'Removed'], {
          useNative: true,                    // ← native ENUM in MySQL & PostgreSQL
          enumName: 'enum_tblchats_chtstatus' // optional: cleaner PG type name
        })
        .notNullable()
        .defaultTo('Active');
    } else {
      // MSSQL fallback
      table
        .string('chtStatus', 20)
        .notNullable()
        .defaultTo('Active');
    }

    // ───────────────────────────────────────────────
    // Indexes
    // ───────────────────────────────────────────────

    table.unique(['chtKey', 'chtOwner_usrID', 'chtService'], 'chtHash');

    table.index('chtCreatedAt');
    table.index('chtStatus');          // ← very important for filter performance
    table.index('chtService');
    table.index('chtLast_msgID');
    table.index('chtOwner_usrID');
  });

  // ───────────────────────────────────────────────
  // Foreign Keys (after table creation – safer)
  // ───────────────────────────────────────────────

  await knex.schema.table('tblChats', (table) => {
    table
      .foreign('chtLast_msgID', 'FK_tblChats_tblMessages')
      .references('msgID')
      .inTable('tblMessages')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table
      .foreign('chtOwner_usrID', 'FK_tblChats_tblUser')
      .references('usrID')
      .inTable('tblUser')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  // ───────────────────────────────────────────────
  // CHECK constraint for status (best effort)
  // Enforced on PG & MSSQL; MySQL ≥8.0.16 enforces, older ignores
  // ───────────────────────────────────────────────
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE "tblChats"
      ADD CONSTRAINT "chk_tblChats_chtStatus"
      CHECK ("chtStatus" IN ('Active', 'Removed'))
    `);
  }
};

exports.down = async function (knex) {
  // Optional: drop CHECK first if needed (PG/MSSQL)
  const dialect = knex.client.dialect();
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`ALTER TABLE "tblChats" DROP CONSTRAINT "chk_tblChats_chtStatus"`);
  }

  return knex.schema.dropTable('tblChats');
};