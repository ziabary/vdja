// migrations/YYYYMMDDHHMMSS_create_tbl_user.js

exports.up = async function (knex) {
  const dialect = knex.client.dialect();

  await knex.schema.createTable('tblUser', (table) => {
    // Primary key
    table.bigIncrements('usrID').primary();
    // MySQL   → BIGINT UNSIGNED AUTO_INCREMENT
    // PG      → bigserial
    // MSSQL   → bigint IDENTITY(1,1)

    table.string('usrName', 50).nullable();
    table.char('usrKey', 32).nullable();

    table.string('usrEmail', 50).nullable();
    table.string('usrMobile', 10).nullable();
    table.string('usrOpenID', 255).nullable();

    // Foreign key to tblGroup
    table
      .bigInteger('usrAssigned_grpID')
      .unsigned()                    // MySQL only
      .notNullable();

    table
      .json('usrSpecialPrivs')
      .nullable()
      .defaultTo(null);

    table
      .text('usrRefreshHash')
      .nullable();

    table
      .timestamp('usrLasLogin', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('usrLastLogout', { useTz: false })
      .nullable();

    table
      .timestamp('usrCreatedAt', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now());

    // Status – native ENUM where supported
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('usrStatus', ['Active', 'Removed', 'Banned'], {
          useNative: true,
          enumName: 'enum_tbluser_usrstatus'
        })
        .notNullable()
        .defaultTo('Active');
    } else {
      table
        .string('usrStatus', 20)
        .notNullable()
        .defaultTo('Active');
    }

    // ───────────────────────────────────────────────
    // Unique indexes (as in original)
    // ───────────────────────────────────────────────
    table.unique('usrKey', 'usrKeyHash');
    table.unique('usrEmail', 'usrEmail_unique');
    table.unique('usrMobile', 'usrMobile_unique');
    table.unique('usrOpenID', 'usrOpenID_unique');

    // Regular indexes
    table.index('usrLasLogin');
    table.index('usrCreatedAt');
    table.index('usrName');
    table.index('usrLastLogout');
    table.index('usrStatus');

    // Foreign key index (named as in original)
    table.index('usrAssigned_grpID', 'FK_tblUser_tblGroup');
  });

  // ───────────────────────────────────────────────
  // Foreign Key
  // ───────────────────────────────────────────────
  await knex.schema.table('tblUser', (table) => {
    table
      .foreign('usrAssigned_grpID', 'FK_tblUser_tblGroup')
      .references('grpID')
      .inTable('tblGroup')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');           // ← matches your RESTRICT (not CASCADE)
  });

  // Optional CHECK constraint for status (PG, MSSQL, MySQL 8+)
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE "tblUser"
      ADD CONSTRAINT "chk_tblUser_usrStatus"
      CHECK ("usrStatus" IN ('Active', 'Removed', 'Banned'))
    `);
  }

  // ───────────────────────────────────────────────
  // Insert the initial "unknown" user with explicit ID = 1
  // ───────────────────────────────────────────────
  await knex('tblUser').insert({
    usrID: 1,
    usrName: 'unknown',
    usrKey: null,
    usrEmail: null,
    usrMobile: null,
    usrOpenID: null,
    usrAssigned_grpID: 1,
    usrSpecialPrivs: null,
    usrRefreshHash: null,
    usrLasLogin: '2026-01-29 20:33:35',
    usrLastLogout: null,
    usrCreatedAt: '2026-01-29 20:33:35',
    usrStatus: 'Active'
  });

  // PostgreSQL: advance sequence after explicit insert
  if (dialect === 'postgresql') {
    await knex.raw(`
      SELECT setval(
        pg_get_serial_sequence('tblUser', 'usrID'),
        (SELECT MAX("usrID") FROM "tblUser")
      )
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.dialect;

  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`ALTER TABLE "tblUser" DROP CONSTRAINT IF EXISTS "chk_tblUser_usrStatus"`);
  }

  return knex.schema.dropTable('tblUser');
};