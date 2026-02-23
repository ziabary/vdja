import type { IntfPageStripOptions } from "./interfaces";

export const DEFAULT_STRIP_OPTIONS: IntfPageStripOptions = {
  headerRatio: 0.10,
  footerRatio: 0.08,
  autoDetectRepeating: true,
  minRepeatPages: 3,
  largeGapRatio: 0.115,
  shortBlockMaxWords: 5,
  shortBlockMaxChars: 80,
  tinyAreaRatio: 0.0012,
  enableLogging: false,           
  safeBodyTopRatio: 0.13,
  safeBodyBottomRatio: 0.12,
  narrowWidthThreshold: 0.38,
};

export const TITLE_FONT_SIZE_FACTOR = 1.5;

export const SIGNAL_THRESHOLDS = {
  HAS_TEXT_GLYPHS: 10,

  TEXT_DOMINANT_DENSITY: 0.25,
  VISUAL_DOMINANT_DENSITY: 0.05,

  MANY_BLOCKS_COUNT: 8,
  SMALL_BLOCK_AREA_RATIO: 0.05, // relative to region

  SINGLE_LARGE_BLOCK_RATIO: 0.6,

  HIGH_FONT_VARIANCE: 2.5,
  MULTI_FONT_FAMILIES: 2,
}
