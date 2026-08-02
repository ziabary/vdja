exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  await knex.schema.createTable('tblWidgetSessions', (table) => {
    table.bigIncrements('wssID').primary();
    table.string('wssKey', 32).notNullable().unique('wssKey_unique');
    table.bigInteger('wssWidget_wgtID').unsigned().notNullable();
    table.bigInteger('wssChat_chtID').unsigned().notNullable().unique('wssChat_chtID_unique');
    table.string('wssMode', 12).notNullable().defaultTo('Public');
    table.string('wssStatus', 20).notNullable().defaultTo('Bot');
    table.string('wssVisitorName', 100).nullable();
    table.string('wssVisitorContact', 150).nullable();
    table.string('wssCategory', 32).nullable();
    table.decimal('wssConfidence', 5, 2).nullable();
    table.text('wssHandoffReason').nullable();
    table.bigInteger('wssAssigned_usrID').unsigned().nullable();
    table.string('wssOrigin', 255).nullable();
    table.timestamp('wssCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('wssUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('wssHandoffAt', { useTz: false }).nullable();
    table.timestamp('wssAssignedAt', { useTz: false }).nullable();
    table.timestamp('wssFirstResponseAt', { useTz: false }).nullable();
    table.timestamp('wssResolvedAt', { useTz: false }).nullable();

    table.index(['wssWidget_wgtID', 'wssStatus', 'wssUpdatedAt'], 'idx_widget_sessions_queue');
    table.index(['wssAssigned_usrID', 'wssStatus'], 'idx_widget_sessions_assigned');
    table.index(['wssWidget_wgtID', 'wssMode', 'wssCreatedAt'], 'idx_widget_sessions_analytics');
  });

  await knex.schema.alterTable('tblWidgetSessions', (table) => {
    table.foreign('wssWidget_wgtID', 'FK_tblWidgetSessions_widget')
      .references('wgtID').inTable('tblWidgets')
      .onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('wssChat_chtID', 'FK_tblWidgetSessions_chat')
      .references('chtID').inTable('tblChats')
      // Avoid SQL Server's multiple-cascade-path restriction. Chats are
      // normally soft-deleted by the application in any case.
      .onUpdate('CASCADE').onDelete(dialect === 'mssql' ? 'NO ACTION' : 'CASCADE');
    table.foreign('wssAssigned_usrID', 'FK_tblWidgetSessions_assigned')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTable('tblWidgetSessions');
};
