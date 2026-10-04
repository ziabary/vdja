exports.up = async function (knex) {
  await knex.schema.alterTable('tblLetterWriterTemplates', table => {
    table.boolean('requiresFirstPerson').notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tblLetterWriterTemplates', table => {
    table.dropColumn('requiresFirstPerson');
  });
};
