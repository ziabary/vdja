import type { IntfTextBlock } from "./interfaces";

export function getMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const s = [...numbers].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

export function isEndsSentence(b: IntfTextBlock) {
  return /[.]$/.test(b.text.trim());
}

export function determineBlocksDirection(blocks: IntfTextBlock[]): "rtl" | "ltr" {
  let rtl = 0, ltr = 0;
  for (const b of blocks) {
    if (/[\u0591-\u07FF]/.test(b.text)) rtl++;
    if (/[A-Za-z]/.test(b.text)) ltr++;
  }
  return rtl >= ltr ? "rtl" : "ltr";
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function mad(values: number[]): number {
  if (!values.length) return 0;
  const med = median(values);
  const deviations = values.map(v => Math.abs(v - med));
  return median(deviations);
}