import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import knex from 'knex';

const demoLetters = [
  {
    externalId: 'secretariat-demo-001',
    number: 'نمونه-۱۴۰۵-۰۰۱',
    subject: '[نمونه] درخواست تمدید قرارداد پشتیبانی',
    sender: 'اداره فناوری اطلاعات',
    recipient: 'مدیریت امور قراردادها',
    date: '۱۴۰۵/۰۷/۱۰',
    body: 'با سلام، با توجه به پایان دوره پشتیبانی سامانه در پایان مهرماه، خواهشمند است بررسی و اقدام لازم برای تمدید قرارداد پشتیبانی تا پایان سال انجام شود. نتیجه بررسی و زمان‌بندی پیشنهادی تا پانزدهم مهرماه به این اداره اعلام گردد.',
  },
  {
    externalId: 'secretariat-demo-002',
    number: 'نمونه-۱۴۰۵-۰۰۲',
    subject: '[نمونه] ارسال گزارش پیشرفت پروژه',
    sender: 'دفتر مدیریت پروژه',
    recipient: 'معاونت برنامه‌ریزی',
    date: '۱۴۰۵/۰۷/۱۱',
    body: 'با احترام، گزارش پیشرفت پروژه توسعه خدمات الکترونیکی برای دوره شش‌ماهه نخست سال ارسال می‌شود. طبق برنامه، تکمیل فاز آزمایشی تا پایان آبان‌ماه پیش‌بینی شده است. خواهشمند است دیدگاه‌های آن معاونت درباره موارد مطرح‌شده در گزارش اعلام شود.',
  },
  {
    externalId: 'secretariat-demo-003',
    number: 'نمونه-۱۴۰۵-۰۰۳',
    subject: '[نمونه] پیگیری پاسخ استعلام تجهیزات',
    sender: 'واحد تدارکات',
    recipient: 'اداره فناوری اطلاعات',
    date: '۱۴۰۵/۰۷/۱۲',
    body: 'پیرو نامه پیشین درباره استعلام تجهیزات شبکه، خواهشمند است مشخصات فنی نهایی و تعداد اقلام موردنیاز را اعلام فرمایید تا فرایند خرید انجام شود. پاسخ این نامه برای ادامه فرایند تأمین ضروری است.',
  },
];

async function main() {
  const config = JSON.parse(await readFile(path.resolve('.config.json'), 'utf8'));
  const type = config.db.activeType;
  const client = { mysql: 'mysql2', pgsql: 'pg', mssql: 'mssql' }[type as 'mysql' | 'pgsql' | 'mssql'];
  if (!client) throw new Error(`Unsupported database type: ${type}`);
  const db = knex({ client, connection: config.db[type] });
  try {
    if (!await db.schema.hasTable('tblSecretariatLetters'))
      throw new Error('ابتدا مایگریشن دبیرخانه را اجرا کنید');
    let inserted = 0;
    for (const item of demoLetters) {
      const exists = await db('tblSecretariatLetters')
        .where({ ltrSource_srcID: null, ltrExternalID: item.externalId }).first('ltrID');
      if (exists) continue;
      await db('tblSecretariatLetters').insert({
        ltrKey: randomUUID(), ltrSource_srcID: null, ltrExternalID: item.externalId,
        ltrNumber: item.number, ltrSubject: item.subject, ltrSender: item.sender,
        ltrRecipient: item.recipient, ltrLetterDate: item.date, ltrBody: item.body,
        ltrStatus: 'ready', ltrCreatedBy_usrID: null,
      });
      inserted++;
    }
    console.log(`نامه‌های نمونهٔ افزوده‌شده: ${inserted} از ${demoLetters.length}`);
  } finally {
    await db.destroy();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
