exports.up = function (knex) {
  return knex.schema.createTable('tblFiles', (table) => {
    // Define columns
    table
      .bigIncrements('filID') // Auto-incrementing BIGINT
      .notNullable();

    table
      .bigInteger('filOwner_usrID')
      .unsigned()
      .notNullable();

    table
      .string('filKey', 50)
      .notNullable()
      .defaultTo('')
      .comment('UUID');

    table
      .string('fillName', 100)
      .notNullable();

    table
      .integer('filSize')
      .unsigned()
      .notNullable()
      .defaultTo(0)
      .comment('3-digit unsigned int, zero-filled');

    table
      .integer('filChunkCount')
      .unsigned()
      .notNullable();

    table
      .timestamp('filUploadedAt')
      .defaultTo(knex.fn.now())
      .notNullable();

    table
      .enu('filStatus', ['Active', 'Removed'])
      .notNullable()
      .defaultTo('Active');

    // Define primary key
    table.primary('filID');

    // Define unique index
    table
      .unique(['filOwner_usrID', 'filKey'], 'filOwner_usrID_filKey');

    // Define additional indexes
    table.index('filKey');
    table.index('filUploadedAt');
    table.index('filStatus');

    // Define foreign key constraint
    table
      .foreign('filOwner_usrID')
      .references('usrID')
      .inTable('tblUser')
      .onDelete('cascade')
      .onUpdate('cascade');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblFiles');
};