exports.up = function (knex) {
  return knex.schema.createTable('tblSampleQuestions', (table) => {
    // Define columns
    table
      .bigIncrements('smqID') // Auto-incrementing BIGINT
      .notNullable();

    table
      .bigInteger('smq_filID')
      .unsigned()
      .notNullable();

    table
      .string('smqQuestion', 100)
      .notNullable()
      .defaultTo('0');

    // Define primary key
    table.primary('smqID');

    // Define index
    table.index('smq_filID', 'FK_tblSampleQuestions_tblFiles');

    // Define foreign key constraint
    table
      .foreign('smq_filID')
      .references('filID')
      .inTable('tblFiles')
      .onDelete('cascade')
      .onUpdate('cascade');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblSampleQuestions');
};