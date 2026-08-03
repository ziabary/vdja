exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  const restrict = dialect === 'mssql' ? 'NO ACTION' : 'RESTRICT';

  await knex.schema.createTable('tblCRMWorkspaces', (table) => {
    table.bigIncrements('crwID').primary();
    table.string('crwKey', 32).notNullable().unique('uq_crw_key');
    table.string('crwName', 120).notNullable();
    table.bigInteger('crwOwner_usrID').unsigned().notNullable();
    table.string('crwCurrency', 16).notNullable().defaultTo('تومان');
    table.json('crwSettings').nullable();
    table.string('crwStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('crwCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('crwUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['crwOwner_usrID', 'crwStatus'], 'idx_crw_owner_status');
  });

  await knex.schema.alterTable('tblCRMWorkspaces', (table) => {
    table.foreign('crwOwner_usrID', 'fk_crw_owner')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete(restrict);
  });

  await knex.schema.createTable('tblCRMMembers', (table) => {
    table.bigIncrements('crmID').primary();
    table.bigInteger('crmWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('crmUser_usrID').unsigned().notNullable();
    table.string('crmRole', 20).notNullable().defaultTo('Sales');
    table.string('crmStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('crmCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('crmUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.unique(['crmWorkspace_crwID', 'crmUser_usrID'], 'uq_crm_workspace_user');
    table.index(['crmUser_usrID', 'crmStatus'], 'idx_crm_user_status');
  });

  await knex.schema.alterTable('tblCRMMembers', (table) => {
    table.foreign('crmWorkspace_crwID', 'fk_crm_workspace')
      .references('crwID').inTable('tblCRMWorkspaces')
      .onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('crmUser_usrID', 'fk_crm_user')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete(restrict);
  });

  await knex.schema.createTable('tblCRMProducts', (table) => {
    table.bigIncrements('crpID').primary();
    table.string('crpKey', 32).notNullable().unique('uq_crp_key');
    table.bigInteger('crpWorkspace_crwID').unsigned().notNullable();
    table.string('crpCode', 64).notNullable();
    table.string('crpName', 180).notNullable();
    table.string('crpShortName', 100).notNullable();
    table.string('crpType', 20).notNullable().defaultTo('Software');
    table.string('crpCategory', 150).nullable();
    table.string('crpIcon', 64).nullable();
    table.decimal('crpPrice', 20, 0).notNullable().defaultTo(0);
    table.text('crpDescription').nullable();
    table.string('crpStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('crpCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('crpUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.unique(['crpWorkspace_crwID', 'crpCode'], 'uq_crp_workspace_code');
    table.index(['crpWorkspace_crwID', 'crpStatus', 'crpType'], 'idx_crp_workspace_status_type');
  });

  await knex.schema.alterTable('tblCRMProducts', (table) => {
    table.foreign('crpWorkspace_crwID', 'fk_crp_workspace')
      .references('crwID').inTable('tblCRMWorkspaces')
      .onUpdate('CASCADE').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tblCRMProducts');
  await knex.schema.dropTableIfExists('tblCRMMembers');
  await knex.schema.dropTableIfExists('tblCRMWorkspaces');
};
