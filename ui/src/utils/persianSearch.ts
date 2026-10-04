const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeSearchText(value: unknown) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\u200c\u200d]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function searchTokens(value: unknown) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) || [];
}

export function compactSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/\s/g, '');
}

export function containsSearchTokens(value: unknown, tokens: string[]) {
  const words = searchTokens(value);
  const joinedWords = new Set(words);
  const persian = /^[\u0600-\u06ff]+$/;
  for (let start = 0; start < words.length; start++) {
    if (!persian.test(words[start]!)) continue;
    let joined = words[start]!;
    for (let end = start + 1; end < Math.min(words.length, start + 4); end++) {
      if (!persian.test(words[end]!)) break;
      joined += words[end];
      joinedWords.add(joined);
    }
  }
  const covered = tokens.map(() => false);
  for (let start = 0; start < tokens.length; start++) {
    let joined = '';
    for (let end = start; end < Math.min(tokens.length, start + 4); end++) {
      if (end > start && (!persian.test(tokens[start]!) || !persian.test(tokens[end]!))) break;
      joined += tokens[end];
      if (joinedWords.has(joined))
        for (let index = start; index <= end; index++) covered[index] = true;
    }
  }
  return covered.length > 0 && covered.every(Boolean);
}
