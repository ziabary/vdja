const { randomUUID } = require('node:crypto');

exports.up = async function (knex) {
  await knex.schema.createTable('tblLetterWriterSettings', table => {
    table.integer('id').primary();
    table.text('instructions').notNullable();
  });
  await knex.schema.createTable('tblLetterWriterStyles', table => {
    table.string('key', 36).primary();
    table.string('name', 160).notNullable();
    table.text('instructions').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
  });
  await knex.schema.createTable('tblLetterWriterTemplates', table => {
    table.string('key', 36).primary();
    table.string('name', 160).notNullable();
    table.string('description', 500).notNullable().defaultTo('');
    table.text('structure').notNullable();
    table.text('instructions').notNullable();
    table.string('styleKey', 36).nullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.foreign('styleKey').references('key').inTable('tblLetterWriterStyles').onDelete('RESTRICT');
  });
  await knex('tblLetterWriterSettings').insert({
    id: 1,
    instructions: 'نامه را به فارسی معیار، با لحن رسمی، محترمانه و روشن بنویس. از اغراق، تعارف طولانی و عبارت‌های مبهم پرهیز کن. مقدمه، شرح درخواست و پایان‌بندی مناسب داشته باش. اطلاعاتی مانند شماره، تاریخ، نام، مبلغ یا تعهدی که کاربر نداده است نساز.',
  });
  const official = randomUUID();
  const brief = randomUUID();
  await knex('tblLetterWriterStyles').insert([
    { key: official, name: 'رسمی اداری', instructions: 'با «با سلام و احترام» آغاز کن. شرح موضوع و درخواست را در بندهای منسجم بنویس و با «با احترام» پایان بده.', enabled: true },
    { key: brief, name: 'رسمی و کوتاه', instructions: 'نامه را کوتاه و مستقیم، در دو یا سه بند تنظیم کن. درخواست اصلی و اقدام مورد انتظار را صریح بیان کن.', enabled: true },
  ]);
  await knex('tblLetterWriterTemplates').insert([
    { key: randomUUID(), name: 'درخواست اداری', description: 'درخواست انجام کار، دریافت مجوز یا ارائه خدمات', styleKey: official, enabled: true,
      structure: 'موضوع: {{subject}}\n{{recipient}}\n{{recipientTitle}}\nبا سلام و احترام\n[مقدمه و علت درخواست]\n[شرح درخواست بر اساس توضیحات]\n[اقدام مورد انتظار]\nبا احترام\n{{sender}}', instructions: 'علت درخواست، درخواست مشخص و اقدام مورد انتظار را با تکیه بر اطلاعات کاربر بیان کن.' },
    { key: randomUUID(), name: 'پیگیری مکاتبه', description: 'پیگیری یک درخواست یا نامه پیشین', styleKey: brief, enabled: true,
      structure: 'موضوع: {{subject}}\n{{recipient}}\nبا سلام و احترام\n[اشاره به مکاتبه قبلی در صورت ارائه اطلاعات]\n[شرح موضوع و درخواست پیگیری]\nبا احترام\n{{sender}}', instructions: 'شماره و تاریخ مکاتبه قبلی را فقط در صورت ذکر کاربر بیاور. پیگیری محترمانه و اقدام بعدی روشن باشد.' },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tblLetterWriterTemplates');
  await knex.schema.dropTableIfExists('tblLetterWriterStyles');
  await knex.schema.dropTableIfExists('tblLetterWriterSettings');
};
