exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  const hasUsername = await knex.schema.hasColumn('tblUser', 'usrUsername');
  const hasAvatar = await knex.schema.hasColumn('tblUser', 'usrAvatar');
  const hasOrganization = await knex.schema.hasColumn('tblUser', 'usrOrganization');
  const hasTitle = await knex.schema.hasColumn('tblUser', 'usrTitle');

  await knex.schema.alterTable('tblUser', (table) => {
    if (!hasUsername) table.string('usrUsername', 32).nullable();
    if (!hasAvatar) table.text('usrAvatar', 'longtext').nullable();
    if (!hasOrganization) table.string('usrOrganization', 100).nullable();
    if (!hasTitle) table.string('usrTitle', 100).nullable();
  });

  if (!hasUsername) {
    if (dialect === 'mssql') {
      // SQL Server permits only one NULL in an ordinary unique index. A
      // filtered index keeps this optional field nullable for all users.
      await knex.raw('CREATE UNIQUE INDEX usrUsername_unique ON tblUser (usrUsername) WHERE usrUsername IS NOT NULL');
    } else {
      await knex.schema.alterTable('tblUser', (table) => {
        table.unique('usrUsername', 'usrUsername_unique');
      });
    }
    await knex.schema.alterTable('tblUser', (table) => {
      table.index('usrUsername', 'idx_tblUser_usrUsername');
    });
  }
};

exports.down = async function (knex) {
  const dialect = knex.client.config.client;
  if (dialect === 'mssql') {
    await knex.raw("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'usrUsername_unique' AND object_id = OBJECT_ID('tblUser')) DROP INDEX usrUsername_unique ON tblUser");
  }
  await knex.schema.alterTable('tblUser', (table) => {
    if (dialect !== 'mssql') table.dropUnique('usrUsername', 'usrUsername_unique');
    table.dropIndex('usrUsername', 'idx_tblUser_usrUsername');
    table.dropColumn('usrUsername');
    table.dropColumn('usrAvatar');
    table.dropColumn('usrOrganization');
    table.dropColumn('usrTitle');
  });
};
