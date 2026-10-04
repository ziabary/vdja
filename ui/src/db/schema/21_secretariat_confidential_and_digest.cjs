exports.up = async function (knex) {
  await knex.schema.alterTable('tblSecretariatLetters', table => {
    table.boolean('ltrConfidential').notNullable().defaultTo(false);
  });
  await knex.schema.alterTable('tblSecretariatFiles', table => {
    table.string('sflDigest', 64).nullable();
    table.unique('sflDigest', 'uq_secretariat_file_digest');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tblSecretariatFiles', table => {
    table.dropUnique('sflDigest', 'uq_secretariat_file_digest');
    table.dropColumn('sflDigest');
  });
  await knex.schema.alterTable('tblSecretariatLetters', table => {
    table.dropColumn('ltrConfidential');
  });
};
