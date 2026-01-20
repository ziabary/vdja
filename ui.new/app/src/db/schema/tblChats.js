exports.up = function (knex) {
  return knex.schema.createTable('tblChats', (table) => {
    // Define columns
     // Bigger auto-incrementing primary key
    table
      .bigIncrements('chtID')
      .unsigned()
      .notNullable();

    table
      .bigInteger('cht_usrID')
      .unsigned()
      .notNullable();
    table
      .string('chtTitle', 100)
      .nullable();
    table
      .bigInteger('chtLast_msgID')
      .unsigned()
      .nullable();
    table
      .timestamp('chtCreatedAt')
      .defaultTo(knex.fn.now())
      .notNullable();
    table
      .enu('chtStatus', ['Active', 'Removed'])
      .notNullable()
      .defaultTo('Active');

    // Define primary key
    table.primary('chtID');

    // Define indexes
    table.index('chtCreatedAt');
    table.index('chtStatus');
    table.index('chtLast_msgID');
    table.index('cht_usrID');

    // Define foreign key constraints
    table
      .foreign('cht_usrID')
      .references('usrID')
      .inTable('tblUser')
      .onDelete('cascade')
      .onUpdate('cascade');

    table
      .foreign('chtLast_msgID')
      .references('msgID')
      .inTable('tblMessages')
      .onDelete('set null')
      .onUpdate('cascade');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblChats');
};