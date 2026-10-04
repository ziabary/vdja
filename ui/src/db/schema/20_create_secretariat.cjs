exports.up = async function (knex) {
  await knex.schema.createTable('tblSecretariatSources', table => {
    table.bigIncrements('srcID').primary();
    table.string('srcKey', 36).notNullable().unique();
    table.string('srcName', 160).notNullable();
    table.string('srcKind', 20).notNullable().defaultTo('rest');
    table.string('srcUrl', 1000).nullable();
    table.string('srcTokenEnv', 120).nullable();
    table.text('srcConfig').nullable();
    table.boolean('srcEnabled').notNullable().defaultTo(false);
    table.string('srcCursor', 255).nullable();
    table.timestamp('srcLastSyncAt', { useTz: false }).nullable();
    table.timestamp('srcCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tblSecretariatLetters', table => {
    table.bigIncrements('ltrID').primary();
    table.string('ltrKey', 36).notNullable().unique();
    table.bigInteger('ltrSource_srcID').unsigned().nullable();
    table.string('ltrExternalID', 255).nullable();
    table.string('ltrNumber', 120).nullable();
    table.string('ltrSubject', 500).notNullable();
    table.string('ltrSender', 255).nullable();
    table.string('ltrRecipient', 255).nullable();
    table.string('ltrLetterDate', 40).nullable();
    table.text('ltrBody', 'longtext').nullable();
    table.string('ltrStatus', 20).notNullable().defaultTo('ready');
    table.bigInteger('ltrCreatedBy_usrID').unsigned().nullable();
    table.timestamp('ltrCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['ltrSource_srcID', 'ltrExternalID'], 'idx_secretariat_external');
    table.index(['ltrNumber'], 'idx_secretariat_number');
    table.index(['ltrCreatedAt'], 'idx_secretariat_created');
    table.foreign('ltrSource_srcID').references('srcID').inTable('tblSecretariatSources');
  });

  await knex.schema.createTable('tblSecretariatFiles', table => {
    table.bigIncrements('sflID').primary();
    table.bigInteger('sflLetter_ltrID').unsigned().notNullable();
    table.string('sflKey', 64).notNullable().unique();
    table.string('sflName', 255).notNullable();
    table.string('sflKind', 20).notNullable();
    table.string('sflPath', 1000).notNullable();
    table.bigInteger('sflSize').notNullable();
    table.integer('sflChunks').notNullable().defaultTo(0);
    table.timestamp('sflCreatedAt', { useTz: false }).notNullable().defaultTo(knex.fn.now());
    table.index(['sflLetter_ltrID'], 'idx_secretariat_file_letter');
    table.foreign('sflLetter_ltrID').references('ltrID').inTable('tblSecretariatLetters').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tblSecretariatFiles');
  await knex.schema.dropTableIfExists('tblSecretariatLetters');
  await knex.schema.dropTableIfExists('tblSecretariatSources');
};
