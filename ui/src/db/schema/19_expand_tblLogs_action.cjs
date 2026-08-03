exports.up = async function (knex) {
  const dialect = String(knex.client.config.client || knex.client.dialect || '').toLowerCase();
  // SQLite does not enforce VARCHAR lengths and Knex rebuilds tables for ALTER COLUMN.
  if (dialect.includes('sqlite')) return;

  await knex.schema.alterTable('tblLogs', (table) => {
    table.string('logAction', 64).notNullable().alter();
  });
};

exports.down = async function (knex) {
  const dialect = String(knex.client.config.client || knex.client.dialect || '').toLowerCase();
  if (dialect.includes('sqlite')) return;

  await knex.schema.alterTable('tblLogs', (table) => {
    table.string('logAction', 6).notNullable().alter();
  });
};
