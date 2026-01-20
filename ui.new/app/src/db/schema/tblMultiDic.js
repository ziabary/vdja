exports.up = function (knex) {
  return knex.schema.createTable('tblMultiDic', (table) => {
    // Define columns
    table
      .unsignedBigInteger('dicID') 
      .notNullable()
      .increments(); 

    table
      .string('dicSource', 10) 
      .nullable();

    table
      .char('dicLang', 2) 
      .notNullable();

    table
      .string('dicWord', 100) 
      .notNullable();

    table
      .json('dicTranslation') 
      .nullable();

    table
      .json('dicSynonyms') 
      .nullable();

    table
      .json('dicAntonyms') 
      .nullable();

    table
      .json('dicRelExp') 
      .nullable();

    table
      .json('dicRelWord') 
      .nullable();

    table
      .json('dicPronunciation') 
      .nullable();

    table
      .json('dicExamples') 
      .nullable();

    table
      .json('dicExtra') 
      .nullable();

    // Define primary key
    table.primary('dicID');

    // Define unique and index keys
    table.unique('dicWord');
    table.index('dicLang');
    table.index('dicSource');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tblMultiDic');
};