declare module 'arabic-persian-reshaper' {
  interface Shaper {
    /**
     * Reshapes Arabic/Persian text by replacing characters with their
     * appropriate positional (isolated, initial, medial, final) presentation forms.
     *
     * @param text - The input Arabic/Persian string
     * @returns The reshaped string
     */
    convertArabic(text: string): string;
  }

  export const PersianShaper: Shaper;
  export const ArabicShaper: Shaper;

  // For default import / require('…')
  const reshaper: {
    PersianShaper: Shaper;
    ArabicShaper: Shaper;
  };

  export = reshaper;
}