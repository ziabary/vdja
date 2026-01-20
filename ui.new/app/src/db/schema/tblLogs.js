exports.up = function (knex) {
  return knex.schema.createTable('tblLogs', (table) => {
    // Define columns
    table
      .bigIncrements('logID') // Auto-incrementing BIGINT
      .notNullable();

    table
      .string('logAction', 3) // char(3) in SQL
      .notNullable()
      .defaultTo('0');

    table
      .json('logMsg') // JSON type
      .notNullable();

    table
      .timestamp('logCreatedAt')
      .defaultTo(knex.fn.now())
      .notNullable();

    // Define primary key
    table.primary('logID');

    // Define index
    table.index('logCreatedAt');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblLogs');
};