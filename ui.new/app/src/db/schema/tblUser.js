exports.up = function (knex) {
  return knex.schema.createTable('tblUser', (table) => {
    // Define columns
    table
      .bigIncrements('usrID') // Auto-incrementing BIGINT
      .notNullable();

    table
      .string('usrName', 50)
      .notNullable()
      .defaultTo('');

    table
      .string('usrKeyHash', 32)
      .nullable();

    table
      .string('usrKeyPrefix', 10)
      .nullable();

    table
      .json('usrPrivs')
      .nullable();

    table
      .timestamp('usrLasLogin')
      .nullable();

    table
      .integer('usrActiveFileCount')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .integer('usrTotalUploadedCount')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .integer('usrActiveTotalSize')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .integer('usrTotalChats')
      .unsigned()
      .notNullable()
      .defaultTo(0);

    table
      .timestamp('usrCreatedAt')
      .defaultTo(knex.fn.now())
      .notNullable();

    // Define primary key
    table.primary('usrID');

    // Define indexes
    table.index('usrKeyHash');
    table.index('usrLasLogin');
    table.index('usrCreatedAt');
    table.index('usrName');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblUser');
};