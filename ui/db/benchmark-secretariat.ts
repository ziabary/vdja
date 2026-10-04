/** Frozen retrieval labels: no QA, no tuning labels after seeing scores. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import configManager from '../src/utils/configManager';
import { getDB } from '../src/db/index';
import { retrieveSecretariatFiles } from '../src/services/secretariatRetrieval';

configManager.init('.config.json');
const fixture = JSON.parse(await readFile('tests/fixtures/secretariat-retrieval.json', 'utf8'));
const db = await getDB();
try {
  const files = await db('tblSecretariatFiles').join('tblSecretariatLetters', 'ltrID', 'sflLetter_ltrID')
    .where('ltrStatus', 'ready').whereIn('sflName', fixture.documents).whereNot('sflKind', 'body').select('sflKey', 'sflName');
  if (new Set(files.map(file => file.sflName)).size !== fixture.documents.length)
    throw new Error('Benchmark requires all 20 fixture documents to be indexed');
  const names = new Map(files.map(file => [file.sflKey, file.sflName]));
  const rows = [];
  for (const item of fixture.queries) {
    const hits = await retrieveSecretariatFiles(item.query, 0, { must: [{ key: 'file_id', match: { any: [...names.keys()] } }] });
    const ranked = hits.map(hit => ({ file: names.get(hit.file_id), score: hit.semanticScore }));
    const rank = item.expected ? ranked.findIndex(hit => hit.file === item.expected) + 1 : null;
    const expectedScore = item.expected ? ranked.find(hit => hit.file === item.expected)?.score ?? null : null;
    rows.push({ ...item, rank, expectedScore, topScore: ranked[0]?.score ?? null, hits: ranked });
    console.log(JSON.stringify({ query: item.query, expected: item.expected, rank, expectedScore, topScore: ranked[0]?.score }));
  }
  const positives = rows.filter(row => row.expected), negatives = rows.filter(row => !row.expected);
  const distribution = (scores: number[]) => {
    scores.sort((a, b) => a - b);
    return { min: scores[0], p10: scores[Math.floor(scores.length * .1)], median: scores[Math.floor(scores.length / 2)],
      p90: scores[Math.floor(scores.length * .9)], max: scores.at(-1) };
  };
  const thresholds = Array.from({ length: 61 }, (_, i) => (i + 30) / 100).map(threshold => {
    const hit = (k: number) => positives.filter(row => row.rank && row.rank <= k && row.expectedScore >= threshold).length / positives.length;
    const negativeRejection = negatives.filter(row => row.topScore < threshold).length / negatives.length;
    return { threshold, hit1: hit(1), hit3: hit(3), hit5: hit(5), negativeRejection,
      balancedHit3: (hit(3) + negativeRejection) / 2 };
  });
  const recommendation = [...thresholds].sort((a, b) => b.balancedHit3 - a.balancedHit3 || b.hit3 - a.hit3 || b.threshold - a.threshold)[0];
  const report = { createdAt: new Date().toISOString(), model: configManager.active().embedding.server.model,
    collection: 'SECRETARIAT_LETTERS', documentCount: names.size, positives: positives.length, negatives: negatives.length,
    positiveExpectedScores: distribution(positives.map(row => row.expectedScore)),
    negativeTopScores: distribution(negatives.map(row => row.topScore)), recommendation, thresholds, rows };
  await mkdir('reports', { recursive: true });
  await writeFile('reports/secretariat-retrieval.json', JSON.stringify(report, null, 2));
  await writeFile('reports/secretariat-retrieval.md', `# ارزیابی بازیابی معنایی دبیرخانه\n\n` +
    `۲۰ سند، ۳۰ عبارت مثبت و ۳۰ عبارت منفی خارج از دامنه؛ برچسب‌ها پیش از اجرا ثبت شده‌اند. بازیابی فقط برداری و گروه‌بندی بر اساس فایل است.\n\n` +
    `مدل: ${report.model}\n\n` +
    `| آستانه | Hit@1 | Hit@3 | Hit@5 | رد عبارت منفی |\n|---|---|---|---|---|\n` +
    thresholds.filter(row => [0.6, 0.65, 0.88, recommendation.threshold].includes(row.threshold))
      .map(row => `| ${row.threshold} | ${(row.hit1 * 100).toFixed(1)}٪ | ${(row.hit3 * 100).toFixed(1)}٪ | ${(row.hit5 * 100).toFixed(1)}٪ | ${(row.negativeRejection * 100).toFixed(1)}٪ |`).join('\n') +
    `\n\nتوزیع امتیاز سند مورد انتظار: ${JSON.stringify(report.positiveExpectedScores)}\n\nتوزیع بیشترین امتیاز عبارات منفی: ${JSON.stringify(report.negativeTopScores)}\n\n` +
    `آستانه پیشنهادی روی همین مجموعه: ${recommendation.threshold}؛ معیار انتخاب میانگین Hit@3 و نرخ رد منفی است. این مجموعه کوچک، آموزشی و فاقد مجموعه آزمون مستقل است؛ پیشنهاد، کالیبراسیون اولیه است. پیش‌فرض پس از این ارزیابی به ۰٫۸۶ تغییر کرده است.\n\n` +
    `## موارد خارج از سه نتیجهٔ اول\n\n` +
    positives.filter(row => !row.rank || row.rank > 3).map(row => `- ${row.query} → ${row.expected}؛ رتبهٔ ${row.rank}؛ امتیاز ${row.expectedScore}`).join('\n') +
    `\n\nفایل JSON شامل تمام امتیازهای خام، رتبه‌ها و پیمایش آستانه‌های ۰٫۳۰ تا ۰٫۹۰ است. اجرای مجدد: npm run benchmark:secretariat\n`);
  console.log(JSON.stringify({ recommendation, positiveExpectedScores: report.positiveExpectedScores, negativeTopScores: report.negativeTopScores }));
} finally { await db.destroy(); }
