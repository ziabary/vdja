exports.up = async function (knex) {
  await knex.schema.createTable('tblWidgetOperators', (table) => {
    table.bigIncrements('wopID').primary();
    table.bigInteger('wopWidget_wgtID').unsigned().notNullable();
    table.bigInteger('wopOperator_usrID').unsigned().notNullable();
    table.string('wopRole', 20).notNullable().defaultTo('Operator');
    table.string('wopStatus', 20).notNullable().defaultTo('Active');
    table.timestamp('wopCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('wopUpdatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());

    table.unique(['wopWidget_wgtID', 'wopOperator_usrID'], 'uq_widget_operator');
    table.index(['wopOperator_usrID', 'wopStatus'], 'idx_widget_operator_user');
  });

  await knex.schema.alterTable('tblWidgetOperators', (table) => {
    table.foreign('wopWidget_wgtID', 'FK_tblWidgetOperators_widget')
      .references('wgtID').inTable('tblWidgets')
      .onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('wopOperator_usrID', 'FK_tblWidgetOperators_user')
      .references('usrID').inTable('tblUser')
      .onUpdate('CASCADE').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTable('tblWidgetOperators');
};
