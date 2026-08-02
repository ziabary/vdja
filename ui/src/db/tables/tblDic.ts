import { getDB } from '../index';

/* =======================
   Columns & Table
======================= */
export const tblName = 'tblMultiDic';

export const cols = {
  id: 'dicID',
  source: 'dicSource',
  lang: 'dicLang',
  word: 'dicWord',
  translation: 'dicTranslation',
  synonyms: 'dicSynonyms',
  antonyms: 'dicAntonyms',
  relExp: 'dicRelExp',
  relWord: 'dicRelWord',
  pronunciation: 'dicPronunciation',
  examples: 'dicExamples',
  extra: 'dicExtra',
} as const;

/* =======================
   Types
======================= */

export type IntfDictionary = {
  [K in keyof typeof cols as typeof cols[K]]: 
    K extends 'id' ? number
    : K extends 'source' | 'lang' | 'word' ? string
    : string | null;
};

/* =======================
   Actions
======================= */
export default {
  cols,
  tblName,

  /** Lookup a single word */
  lookup: async (phrase: string): Promise<IntfDictionary | undefined> => {
    const db = await getDB();
    return db<IntfDictionary>(tblName).select('*').where(cols.word, phrase).first();
  },

  /** Count total dictionary entries */
  count: async (): Promise<number> => {
    const db = await getDB();
    const res = await db(tblName).count('* as count').first<{ count: number }>();
    return res?.count ?? 0;
  },
};
