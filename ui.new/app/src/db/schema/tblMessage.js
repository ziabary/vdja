exports.up = function (knex) {
  return knex.schema.createTable('tblMessages', (table) => {
    // Define columns
    table
      .bigIncrements('msgID') // Auto-incrementing BIGINT
      .notNullable();

    table
      .bigInteger('msg_chtID')
      .unsigned()
      .notNullable();

    table
      .enu('msgRole', ['user', 'assistant'])
      .notNullable();

    table
      .text('msgContent')
      .notNullable();

    table
      .timestamp('msgCreatedAt')
      .defaultTo(knex.fn.now())
      .notNullable();

    // Define primary key
    table.primary('msgID');

    // Define indexes
    table.index('msgRole');
    table.index('msgCreatedAt');
    table.index('msg_chtID', 'FK_tblMessage_tblChats');

    // Define foreign key constraint
    table
      .foreign('msg_chtID')
      .references('chtID')
      .inTable('tblChats')
      .onDelete('cascade')
      .onUpdate('cascade');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblMessages');
};