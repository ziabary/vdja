exports.up = async function (knex) {
  const dialect = knex.client.config.client;
  await knex.schema.createTable('tblWidgetHumanReplies', (table) => {
    table.bigIncrements('whrID').primary();
    table.bigInteger('whrSession_wssID').unsigned().notNullable();
    table.bigInteger('whrOperator_usrID').unsigned().notNullable();
    table.bigInteger('whrMessage_msgID').unsigned().notNullable().unique('whrMessage_msgID_unique');
    table.timestamp('whrCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());

    table.index(['whrOperator_usrID', 'whrCreatedAt'], 'idx_widget_human_operator');
    table.index(['whrSession_wssID', 'whrCreatedAt'], 'idx_widget_human_session');
  });

  await knex.schema.alterTable('tblWidgetHumanReplies', (table) => {
    table.foreign('whrSession_wssID', 'FK_tblWidgetHumanReplies_session')
      .references('wssID').inTable('tblWidgetSessions')
      .onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('whrOperator_usrID', 'FK_tblWidgetHumanReplies_operator')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('whrMessage_msgID', 'FK_tblWidgetHumanReplies_message')
      .references('msgID').inTable('tblMessages')
      .onUpdate('CASCADE').onDelete(dialect === 'mssql' ? 'NO ACTION' : 'CASCADE');
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTable('tblWidgetHumanReplies');
};
