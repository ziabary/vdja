exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  const noAction = dialect === 'mssql' ? 'NO ACTION' : 'CASCADE';

  await knex.schema.createTable('tblCRMCustomers', (table) => {
    table.bigIncrements('crcID').primary();
    table.string('crcKey', 32).notNullable().unique('uq_crc_key');
    table.bigInteger('crcWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('crcOwner_usrID').unsigned().nullable();
    table.string('crcName', 180).notNullable();
    table.string('crcShort', 16).nullable();
    table.string('crcIndustry', 120).nullable();
    table.string('crcCity', 80).nullable();
    table.string('crcTier', 40).nullable();
    table.integer('crcHealth').unsigned().notNullable().defaultTo(75);
    table.decimal('crcLifetimeValue', 20, 0).notNullable().defaultTo(0);
    table.decimal('crcAnnualRevenue', 20, 0).notNullable().defaultTo(0);
    table.timestamp('crcLastInteraction', { useTz: false }).nullable();
    table.text('crcNextAction').nullable();
    table.timestamp('crcNextActionDue', { useTz: false }).nullable();
    table.timestamp('crcRenewalDate', { useTz: false }).nullable();
    table.json('crcTags').nullable();
    table.text('crcAISummary').nullable();
    table.string('crcStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('crcCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('crcUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['crcWorkspace_crwID', 'crcStatus'], 'idx_crc_workspace_status');
    table.index(['crcOwner_usrID', 'crcStatus'], 'idx_crc_owner_status');
    table.index('crcName', 'idx_crc_name');
  });
  await knex.schema.alterTable('tblCRMCustomers', (table) => {
    table.foreign('crcWorkspace_crwID', 'fk_crc_workspace').references('crwID').inTable('tblCRMWorkspaces').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('crcOwner_usrID', 'fk_crc_owner').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
  });

  await knex.schema.createTable('tblCRMContacts', (table) => {
    table.bigIncrements('ccoID').primary();
    table.string('ccoKey', 32).notNullable().unique('uq_cco_key');
    table.bigInteger('ccoCustomer_crcID').unsigned().notNullable();
    table.string('ccoName', 150).notNullable();
    table.string('ccoTitle', 120).nullable();
    table.string('ccoPhone', 40).nullable();
    table.string('ccoEmail', 180).nullable();
    table.string('ccoDecisionRole', 80).nullable();
    table.boolean('ccoIsPrimary').notNullable().defaultTo(false);
    table.string('ccoStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('ccoCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('ccoUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ccoCustomer_crcID', 'ccoStatus'], 'idx_cco_customer_status');
  });
  await knex.schema.alterTable('tblCRMContacts', (table) => {
    table.foreign('ccoCustomer_crcID', 'fk_cco_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
  });

  await knex.schema.createTable('tblCRMAssets', (table) => {
    table.bigIncrements('casID').primary();
    table.string('casKey', 32).notNullable().unique('uq_cas_key');
    table.bigInteger('casCustomer_crcID').unsigned().notNullable();
    table.bigInteger('casProduct_crpID').unsigned().nullable();
    table.string('casName', 180).nullable();
    table.decimal('casQuantity', 18, 2).notNullable().defaultTo(1);
    table.string('casStatus', 40).nullable();
    table.string('casContract', 180).nullable();
    table.timestamp('casExpiresAt', { useTz: false }).nullable();
    table.json('casMeta').nullable();
    table.timestamp('casCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('casUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index('casCustomer_crcID', 'idx_cas_customer');
    table.index('casProduct_crpID', 'idx_cas_product');
  });
  await knex.schema.alterTable('tblCRMAssets', (table) => {
    table.foreign('casCustomer_crcID', 'fk_cas_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('casProduct_crpID', 'fk_cas_product').references('crpID').inTable('tblCRMProducts').onUpdate('CASCADE').onDelete('SET NULL');
  });

  await knex.schema.createTable('tblCRMTickets', (table) => {
    table.bigIncrements('ctkID').primary();
    table.string('ctkKey', 32).notNullable().unique('uq_ctk_key');
    table.bigInteger('ctkCustomer_crcID').unsigned().notNullable();
    table.string('ctkTitle', 220).notNullable();
    table.string('ctkStatus', 40).notNullable().defaultTo('باز');
    table.string('ctkPriority', 24).notNullable().defaultTo('متوسط');
    table.string('ctkExternalRef', 100).nullable();
    table.text('ctkDescription').nullable();
    table.timestamp('ctkCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('ctkUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ctkCustomer_crcID', 'ctkStatus'], 'idx_ctk_customer_status');
  });
  await knex.schema.alterTable('tblCRMTickets', (table) => {
    table.foreign('ctkCustomer_crcID', 'fk_ctk_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tblCRMTickets');
  await knex.schema.dropTableIfExists('tblCRMAssets');
  await knex.schema.dropTableIfExists('tblCRMContacts');
  await knex.schema.dropTableIfExists('tblCRMCustomers');
};
