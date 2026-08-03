exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  const noAction = dialect === 'mssql' ? 'NO ACTION' : 'CASCADE';

  await knex.schema.createTable('tblCRMOpportunities', (table) => {
    table.bigIncrements('copID').primary();
    table.string('copKey', 32).notNullable().unique('uq_cop_key');
    table.bigInteger('copWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('copCustomer_crcID').unsigned().notNullable();
    table.bigInteger('copProduct_crpID').unsigned().nullable();
    table.bigInteger('copOwner_usrID').unsigned().nullable();
    table.string('copTitle', 220).notNullable();
    table.decimal('copQuantity', 18, 2).notNullable().defaultTo(1);
    table.decimal('copValue', 20, 0).notNullable().defaultTo(0);
    table.string('copStage', 24).notNullable().defaultTo('lead');
    table.integer('copProbability').unsigned().notNullable().defaultTo(25);
    table.timestamp('copExpectedClose', { useTz: false }).nullable();
    table.timestamp('copLastActivity', { useTz: false }).nullable();
    table.string('copSource', 100).nullable();
    table.text('copRisk').nullable();
    table.text('copNextAction').nullable();
    table.string('copStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('copCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('copUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['copWorkspace_crwID', 'copStage', 'copStatus'], 'idx_cop_workspace_stage');
    table.index(['copCustomer_crcID', 'copStatus'], 'idx_cop_customer_status');
  });
  await knex.schema.alterTable('tblCRMOpportunities', (table) => {
    table.foreign('copWorkspace_crwID', 'fk_cop_workspace').references('crwID').inTable('tblCRMWorkspaces').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('copCustomer_crcID', 'fk_cop_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('copProduct_crpID', 'fk_cop_product').references('crpID').inTable('tblCRMProducts').onUpdate('CASCADE').onDelete('SET NULL');
    table.foreign('copOwner_usrID', 'fk_cop_owner').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
  });

  await knex.schema.createTable('tblCRMTasks', (table) => {
    table.bigIncrements('ctaID').primary();
    table.string('ctaKey', 32).notNullable().unique('uq_cta_key');
    table.bigInteger('ctaWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('ctaCustomer_crcID').unsigned().nullable();
    table.bigInteger('ctaOpportunity_copID').unsigned().nullable();
    table.bigInteger('ctaAssigned_usrID').unsigned().nullable();
    table.bigInteger('ctaCreatedBy_usrID').unsigned().notNullable();
    table.string('ctaTitle', 220).notNullable();
    table.timestamp('ctaDueAt', { useTz: false }).nullable();
    table.string('ctaPriority', 20).notNullable().defaultTo('medium');
    table.timestamp('ctaDoneAt', { useTz: false }).nullable();
    table.string('ctaStatus', 16).notNullable().defaultTo('Active');
    table.timestamp('ctaCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('ctaUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ctaWorkspace_crwID', 'ctaStatus', 'ctaDueAt'], 'idx_cta_workspace_due');
    table.index(['ctaAssigned_usrID', 'ctaDoneAt'], 'idx_cta_assigned_done');
  });
  await knex.schema.alterTable('tblCRMTasks', (table) => {
    table.foreign('ctaWorkspace_crwID', 'fk_cta_workspace').references('crwID').inTable('tblCRMWorkspaces').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('ctaCustomer_crcID', 'fk_cta_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('SET NULL');
    table.foreign('ctaOpportunity_copID', 'fk_cta_opportunity').references('copID').inTable('tblCRMOpportunities').onUpdate('CASCADE').onDelete('SET NULL');
    table.foreign('ctaAssigned_usrID', 'fk_cta_assigned').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
    table.foreign('ctaCreatedBy_usrID', 'fk_cta_creator').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('NO ACTION');
  });

  await knex.schema.createTable('tblCRMConversations', (table) => {
    table.bigIncrements('ccvID').primary();
    table.string('ccvKey', 32).notNullable().unique('uq_ccv_key');
    table.bigInteger('ccvWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('ccvCustomer_crcID').unsigned().notNullable();
    table.bigInteger('ccvContact_ccoID').unsigned().nullable();
    table.bigInteger('ccvAssigned_usrID').unsigned().nullable();
    table.string('ccvChannel', 24).notNullable().defaultTo('email');
    table.string('ccvSubject', 240).notNullable();
    table.text('ccvBody').notNullable();
    table.string('ccvPreview', 500).nullable();
    table.json('ccvAI').nullable();
    table.string('ccvStatus', 20).notNullable().defaultTo('Open');
    table.timestamp('ccvCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('ccvUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ccvWorkspace_crwID', 'ccvStatus', 'ccvUpdatedAt'], 'idx_ccv_workspace_status');
    table.index(['ccvCustomer_crcID', 'ccvUpdatedAt'], 'idx_ccv_customer_updated');
  });
  await knex.schema.alterTable('tblCRMConversations', (table) => {
    table.foreign('ccvWorkspace_crwID', 'fk_ccv_workspace').references('crwID').inTable('tblCRMWorkspaces').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('ccvCustomer_crcID', 'fk_ccv_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('ccvContact_ccoID', 'fk_ccv_contact').references('ccoID').inTable('tblCRMContacts').onUpdate('CASCADE').onDelete('SET NULL');
    table.foreign('ccvAssigned_usrID', 'fk_ccv_assigned').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
  });

  await knex.schema.createTable('tblCRMConversationMessages', (table) => {
    table.bigIncrements('ccmID').primary();
    table.string('ccmKey', 32).notNullable().unique('uq_ccm_key');
    table.bigInteger('ccmConversation_ccvID').unsigned().notNullable();
    table.bigInteger('ccmSender_usrID').unsigned().nullable();
    table.string('ccmDirection', 20).notNullable().defaultTo('Incoming');
    table.text('ccmBody').notNullable();
    table.timestamp('ccmCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ccmConversation_ccvID', 'ccmCreatedAt'], 'idx_ccm_conversation_time');
  });
  await knex.schema.alterTable('tblCRMConversationMessages', (table) => {
    table.foreign('ccmConversation_ccvID', 'fk_ccm_conversation').references('ccvID').inTable('tblCRMConversations').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('ccmSender_usrID', 'fk_ccm_sender').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
  });

  await knex.schema.createTable('tblCRMConversationReads', (table) => {
    table.bigIncrements('ccrID').primary();
    table.bigInteger('ccrConversation_ccvID').unsigned().notNullable();
    table.bigInteger('ccrUser_usrID').unsigned().notNullable();
    table.timestamp('ccrReadAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.unique(['ccrConversation_ccvID', 'ccrUser_usrID'], 'uq_ccr_conversation_user');
    table.index(['ccrUser_usrID', 'ccrReadAt'], 'idx_ccr_user_read');
  });
  await knex.schema.alterTable('tblCRMConversationReads', (table) => {
    table.foreign('ccrConversation_ccvID', 'fk_ccr_conversation').references('ccvID').inTable('tblCRMConversations').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('ccrUser_usrID', 'fk_ccr_user').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('CASCADE');
  });

  await knex.schema.createTable('tblCRMActivities', (table) => {
    table.bigIncrements('cacID').primary();
    table.string('cacKey', 32).notNullable().unique('uq_cac_key');
    table.bigInteger('cacWorkspace_crwID').unsigned().notNullable();
    table.bigInteger('cacCustomer_crcID').unsigned().notNullable();
    table.bigInteger('cacCreatedBy_usrID').unsigned().nullable();
    table.string('cacType', 32).notNullable().defaultTo('note');
    table.string('cacTitle', 220).notNullable();
    table.text('cacDetail').nullable();
    table.string('cacRelatedType', 32).nullable();
    table.string('cacRelatedKey', 32).nullable();
    table.timestamp('cacCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['cacCustomer_crcID', 'cacCreatedAt'], 'idx_cac_customer_time');
    table.index(['cacWorkspace_crwID', 'cacCreatedAt'], 'idx_cac_workspace_time');
  });
  await knex.schema.alterTable('tblCRMActivities', (table) => {
    table.foreign('cacWorkspace_crwID', 'fk_cac_workspace').references('crwID').inTable('tblCRMWorkspaces').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('cacCustomer_crcID', 'fk_cac_customer').references('crcID').inTable('tblCRMCustomers').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('cacCreatedBy_usrID', 'fk_cac_creator').references('usrID').inTable('tblUser').onUpdate('CASCADE').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tblCRMActivities');
  await knex.schema.dropTableIfExists('tblCRMConversationReads');
  await knex.schema.dropTableIfExists('tblCRMConversationMessages');
  await knex.schema.dropTableIfExists('tblCRMConversations');
  await knex.schema.dropTableIfExists('tblCRMTasks');
  await knex.schema.dropTableIfExists('tblCRMOpportunities');
};
