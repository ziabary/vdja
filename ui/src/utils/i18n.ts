import unorm from "unorm";
//import { Bidi, BidiLevel } from "@unicode/bidi";
import {PersianShaper} from "arabic-persian-reshaper";

/**
 * Convert Persian digits (۰۱۲۳۴۵۶۷۸۹) to English digits (0123456789)
 */
export function persianDigit2English(number: string): string {
  const find = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const replacement = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  find.forEach((persianDigit, index) => {
    const regex = new RegExp(persianDigit, 'g');
    number = number.replace(regex, replacement[index]);
  });

  return number;
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

  const monthIndex = parseInt(persianDigit2English(jalali[1]), 10) - 1;
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

function cleanString(text: string): string {
  return text
    .replace(/\0/g, "")          // remove null chars
    .replace(/[\u200E\u200F]/g, "") // remove LRM/RLM
    .replace(/\u202B/g, "")      // remove RLE etc.
    .replace(/\u202A/g, "")
    .replace(/\u202C/g, "")
    .replace(/\u200B/g, "");     // remove zero-width space
}

/**
 * Normalize RTL text:
 * - NFC normalization
 * - Reshape Arabic/Persian characters if needed
 * - Apply BiDi ordering
 */
export function normalizeRTL(input: unknown): string {
  if (!input) return "";
  let text = String(input);
  if (!text?.trim()) return "";

  text = cleanString(text);
  text = unorm.nfc(text);
  if (isProbablyVisualOrder(text)) {
    try {
      text = PersianShaper.convertArabic(text);

      // Create BiDi object
      //const bidi = new Bidi(text, BidiLevel.LTR);
      //return bidi.reorderVisually();
    } catch {}
  }
  return text;
}

