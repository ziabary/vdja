exports.up = async function (knex) {
  const dialect = String(knex.client.config.client || knex.client.dialect || '').toLowerCase();
  // SQLite does not enforce VARCHAR lengths; rebuilding the table adds risk with no benefit.
  if (dialect.includes('sqlite')) return;

  await knex.schema.alterTable('tblUser', (table) => {
    table.string('usrEmail', 254).nullable().alter();
    // Canonical Iranian mobile values are stored as 989xxxxxxxxx (12 characters).
    // A little extra room preserves older +98-prefixed rows during migration.
    table.string('usrMobile', 16).nullable().alter();
  });
};

exports.down = async function (knex) {
  const dialect = String(knex.client.config.client || knex.client.dialect || '').toLowerCase();
  if (dialect.includes('sqlite')) return;

  await knex.schema.alterTable('tblUser', (table) => {
    table.string('usrEmail', 50).nullable().alter();
    table.string('usrMobile', 10).nullable().alter();
  });
};