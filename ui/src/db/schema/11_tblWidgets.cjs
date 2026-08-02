exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  await knex.schema.createTable('tblWidgets', (table) => {
    table.bigIncrements('wgtID').primary();
    table.string('wgtKey', 32).notNullable().unique('wgtKey_unique');
    table.bigInteger('wgtOwner_usrID').unsigned().notNullable();
    table.bigInteger('wgtRuntime_usrID').unsigned().notNullable().unique('wgtRuntime_usrID_unique');
    table.string('wgtInternalName', 100).notNullable();
    table.string('wgtTargetOrigin', 255).notNullable().defaultTo('');
    table.string('wgtPublishedOrigin', 255).nullable();
    table.json('wgtDraftConfig').notNullable();
    table.json('wgtPublishedConfig').nullable();
    table.integer('wgtDraftVersion').unsigned().notNullable().defaultTo(1);
    table.integer('wgtPublishedVersion').unsigned().notNullable().defaultTo(0);
    table.string('wgtStatus', 20).notNullable().defaultTo('Draft');
    table.timestamp('wgtCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('wgtUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('wgtPublishedAt', { useTz: false }).nullable();
    table.timestamp('wgtLastTestAt', { useTz: false }).nullable();

    table.index(['wgtOwner_usrID', 'wgtStatus'], 'idx_tblWidgets_owner_status');
    table.index('wgtTargetOrigin', 'idx_tblWidgets_origin');
    table.index('wgtPublishedOrigin', 'idx_tblWidgets_published_origin');
    table.index('wgtUpdatedAt', 'idx_tblWidgets_updated');
  });

  await knex.schema.alterTable('tblWidgets', (table) => {
    table.foreign('wgtOwner_usrID', 'FK_tblWidgets_owner')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete(dialect === 'mssql' ? 'NO ACTION' : 'RESTRICT');
    table.foreign('wgtRuntime_usrID', 'FK_tblWidgets_runtime')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete(dialect === 'mssql' ? 'NO ACTION' : 'RESTRICT');
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTable('tblWidgets');
};
