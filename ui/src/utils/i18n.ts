import {PersianShaper} from "arabic-persian-reshaper";

/**
 * Convert Persian digits (۰۱۲۳۴۵۶۷۸۹) to English digits (0123456789)
 */
export function persianDigit2English(text: string): string {
  const map = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const repl = ['0','1','2','3','4','5','6','7','8','9'];
  let result = text;
  map.forEach((d, i) => {
    result = result.replace(new RegExp(d, 'g'), repl[i]!);
  });
  return result;
}


function normalizeCharacters(text: string): string {
    let t = text;

  // ────────────────────────────────────────────────
  // 1. Early cleanup — dangerous controls, but KEEP \n
  // ────────────────────────────────────────────────
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' '); 
  t = t.replace(/\r\n?/g, '\n'); // normalize line endings

  // ────────────────────────────────────────────────
  // 2. Remove direction overrides & unwanted zero-width
  // ────────────────────────────────────────────────
  t = t.replace(/\0/g, '');                           // null bytes
  t = t.replace(/[\u200B\u200D\uFEFF]/g, '');         // zero-width junk
  t = t.replace(/[\u202A\u202B\u202C\u202D\u202E]/g, ''); // bidi controls
  t = t.replace(/[\u2066-\u2069]/g, '');              // isolate controls

  // ────────────────────────────────────────────────
  // 3. NFKC — decompose presentation forms & compatibility chars
  // ────────────────────────────────────────────────
  t = t.normalize('NFKC');

  // ────────────────────────────────────────────────
  // 4. Targoman-style Arabic → Persian & cleanup
  //     (most important mappings from Normalization.conf)
  // ────────────────────────────────────────────────
  t = t
    // Arabic → Persian preferred forms
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ی')
    .replace(/ؤ/g, 'و')
    //.replace(/إ/g, 'ا')
    //.replace(/أ/g, 'ا')
    //.replace(/آ/g, 'ا')
    // Common presentation → base (frequent in PDFs)
    //.replace(/[ﺁﺃﺅﺇﺈﺉﺊﺋﺌﺍﺎ]/g, 'ا')
    .replace(/[ﺊﺋﺌ]/g, 'ئ')
    .replace(/[ﺈﺎ]/g, 'ا')
    .replace(/[ﺏﺐﺑﺒ]/g, 'ب')
    .replace(/[ﺕﺖﺗﺘ]/g, 'ت')
    .replace(/[ﺙﺚﺛﺜ]/g, 'ث')
    .replace(/[ﺝﺞﺟﺠ]/g, 'ج')
    .replace(/[ﺡﺢﺣﺤ]/g, 'ح')
    .replace(/[ﺥﺦﺧﺨ]/g, 'خ')
    .replace(/[ﺩﺪ]/g, 'د')
    .replace(/[ﺫﺬ]/g, 'ذ')
    .replace(/[ﺭﺮ]/g, 'ر')
    .replace(/[ﺯﺰ]/g, 'ز')
    .replace(/[ﺱﺲﺳﺴ]/g, 'س')
    .replace(/[ﺵﺶﺷﺸ]/g, 'ش')
    .replace(/[ﺹﺺﺻﺼ]/g, 'ص')
    .replace(/[ﺽﺾﺿﻀ]/g, 'ض')
    .replace(/[ﻁﻂﻃﻄ]/g, 'ط')
    .replace(/[ﻅﻆﻇﻈ]/g, 'ظ')
    .replace(/[ﻉﻊﻋﻌ]/g, 'ع')
    .replace(/[ﻍﻎﻏﻐ]/g, 'غ')
    .replace(/[ﻑﻒﻓﻔ]/g, 'ف')
    .replace(/[ﻕﻖﻗﻘ]/g, 'ق')
    .replace(/[ﻝﻞﻟﻠ]/g, 'ل')
    .replace(/[ﻡﻢﻣﻤ]/g, 'م')
    .replace(/[ﻥﻦﻧﻨ]/g, 'ن')
    .replace(/[ﻩﻪﻫﻬ]/g, 'ه')
    .replace(/[ﻭﻮ]/g, 'و')
    // Persian-specific letters — protect them
    .replace(/[پچژگ]/g, c => c); // already correct — just ensure they survive

  // Remove tatweel / kashida runs (Targoman rule)
  //t = t.replace(/[ـٰٓۤۥۦۧۨ۩۪ۭ۫۬ۮۯ]{1,}/g, '');

  // Limit repeated characters (Targoman style — max ~3–4 repeats)
  return t.replace(/(.)\1{4,}/g, '$1$1$1');
}
/**
 * Full recommended normalization for Persian/Arabic text extracted from PDF
 */
export function normalizePersianText(text: string): string {
  if (!text?.trim()) return '';

  let t = normalizeCharacters(text);
  // ────────────────────────────────────────────────
  // 5. Persian-aware shaping
  // ────────────────────────────────────────────────
  try {
    t = PersianShaper.convertArabic(t);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('PersianShaper failed:', err);
    // fallback — at least keep what we have
  }

  // ────────────────────────────────────────────────
  // 6. Spacing & punctuation fixes (your existing helper + extras)
  // ────────────────────────────────────────────────
  t = recoverPersianSpaces(t);

  t = normalizeCharacters(t)
    // Remove ALL remaining presentation forms (fallback)
  t = t.replace(/[\uFE70-\uFEFF]/g, c => {
    // Try to map to base letter via decomposition
    const decomposed = c.normalize("NFKD");
    return decomposed[0] || " ";
  });
  // Extra common PDF spacing cleanup
  t = t.replace(/ +([،؛:.!?؟»])/g, '$1');     // no space before punctuation
  t = t.replace(/([«])( +)/g, '$1 ');         // space after opening quote

  // ────────────────────────────────────────────────
  // 7. Final whitespace — preserve paragraph breaks
  // ────────────────────────────────────────────────
  t = t
    .replace(/[\t ]+/g, ' ')           // horizontal whitespace → single space
    .replace(/ +\n/g, '\n')            // remove trailing spaces before newline
    .replace(/\n{3,}/g, '\n\n')        // collapse many blank lines
    .trim();

  return t;
}

function recoverPersianSpaces(text: string): string {
  return text
    // digit ↔ letter boundaries
    .replace(/([0-9۰-۹])([^\s0-9۰-۹])/g, "$1 $2")
    .replace(/([^\s0-9۰-۹])([0-9۰-۹])/g, "$1 $2")

    // punctuation spacing
    .replace(/([،؛:.!?»])([^\s])/g, "$1 $2")
    .replace(/([^\s])([«])/g, "$1 $2")

    // Latin runs (MVP, GPU, etc.)
    .replace(/([آ-ی])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([آ-ی])/g, "$1 $2")

    .trim();
}

const MONTH_NAMES_FA: string[] = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند'
];

/**
 * Convert a Date to Jalali (Persian) date string
 */
export function date2Jalali(date?: Date | string): string {
  const gregorian = date ? new Date(date) : new Date();
  const jalali = gregorian.toLocaleDateString("fa-IR").split("/");

  const monthIndex = parseInt(persianDigit2English(jalali[1]!), 10) - 1;
  const jDate = `${jalali[0]} ${MONTH_NAMES_FA[monthIndex]} ${jalali[2]}`;
  return jDate;
}

/**
 * Check if text contains Right-to-Left characters
 */
export function isRTL(text: string): boolean {
  return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
}

/**
 * Heuristic to check if text is probably in visual order (not logical)
 */
export function isProbablyVisualOrder(text: string): boolean {
  return /[\u0591-\u07FF].*\d/.test(text);
}


