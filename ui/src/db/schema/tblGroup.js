// migration file example: 20260216_create_tbl_group.js

exports.up = async function (knex) {
  const dialect = knex.client.dialect();  // 'mysql', 'postgresql', 'mssql'

  await knex.schema.createTable('tblGroup', (table) => {
    // ───────────────────────────────────────────────
    // Columns
    // ───────────────────────────────────────────────

    table.bigIncrements('grpID').primary();  // MySQL: BIGINT UNSIGNED AUTO_INCREMENT
                                             // PG:     bigserial
                                             // MSSQL:  bigint IDENTITY(1,1)

    table
      .string('grpName', 50)
      .notNullable();

    table
      .json('grpPrivs')                      // MySQL: JSON, PG: jsonb, MSSQL: nvarchar(MAX)
      .nullable()
      .defaultTo(null);

    // ───────────────────────────────────────────────
    // grpStatus – native ENUM where possible (fast & compact)
    // ───────────────────────────────────────────────
    if (dialect === 'mysql' || dialect === 'postgresql') {
      table
        .enu('grpStatus', ['Active', 'Removed', 'Banned'], {
          useNative: true,                        // native ENUM in MySQL & PostgreSQL
          enumName: 'enum_tblgroup_grpstatus'     // optional – cleaner in PG
        })
        .notNullable()
        .defaultTo('Active');
    } else {
      // MSSQL fallback
      table
        .string('grpStatus', 20)
        .notNullable()
        .defaultTo('Active');
    }

    // ───────────────────────────────────────────────
    // Indexes
    // ───────────────────────────────────────────────
    table.index('grpStatus');  // for filtering on status
  });

  // ───────────────────────────────────────────────
  // Insert initial system groups with explicit IDs
  // ───────────────────────────────────────────────
  await knex('tblGroup').insert([
    {
      grpID: 1,
      grpName: 'anonymus',
      grpPrivs: '{}',
      grpStatus: 'Active'
    },
    {
      grpID: 2,
      grpName: 'public',
      grpPrivs: JSON.stringify({
        services: {
          rag: {
            files: {
              maxSize: 10,
              maxCount: 10,
              maxTotalSize: 200
            },
            messages: {
              maxChars: 2000
            }
          },
          think: {
            forbidden: true   // note: probably typo → "forbidden"?
          }
        }
      }),
      grpStatus: 'Active'
    }
  ]);

  // PostgreSQL-specific: advance the sequence to the highest inserted ID
  // Prevents duplicate key violation on future auto-increment inserts
  if (dialect === 'postgresql') {
    await knex.raw(`
      SELECT setval(
        pg_get_serial_sequence('tblGroup', 'grpID'),
        (SELECT MAX("grpID") FROM "tblGroup")
      )
    `);
  }

  // Optional: CHECK constraint for status (enforced on PG & MSSQL; MySQL ≥8.0.16 enforces)
  if (dialect === 'postgresql' || dialect === 'mssql' || dialect === 'mysql') {
    await knex.raw(`
      ALTER TABLE "tblGroup"
      ADD CONSTRAINT "chk_tblGroup_grpStatus"
      CHECK ("grpStatus" IN ('Active', 'Removed', 'Banned'))
    `);
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.dialect();

  // Drop CHECK constraint if exists
  if (dialect === 'postgresql' || dialect === 'mssql') {
    await knex.raw(`ALTER TABLE "tblGroup" DROP CONSTRAINT IF EXISTS "chk_tblGroup_grpStatus"`);
  }

  // Optional: remove seed data on rollback
  // await knex('tblGroup').whereIn('grpID', [1, 2]).del();

  return knex.schema.dropTable('tblGroup');
};