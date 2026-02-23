import os from "os"
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { cwd } from "node:process";
import logger from "./logger";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  if (!source) return target;

  for (const key in source) {
    const sourceValue = source[key] as any;
    const targetValue = target[key] as any;

    if (sourceValue instanceof Object && key in target) {
      Object.assign(
        sourceValue,
        deepMerge(targetValue, sourceValue)
      );
    }
  }

  return Object.assign(target, source);
}

export const stripText = (text: string, maxLen = 50): string =>
  text.substring(0, maxLen).replace(/\n/g, '\\n') +
  (text.length > maxLen ? '...' : '');

export const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export function safeJsonParse(val: string | undefined | null) {
  try {
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function createTempDir(prefix: string) {
  const tmpBase = os.tmpdir();
  const folderName = `${prefix}${randomUUID()}`;
  const folderPath = path.join(tmpBase, folderName);
  return fs.mkdir(folderPath, { recursive: true }).then(() => folderPath);
}

export async function removeTempDir(folderPath: string) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
  } catch (err) {
    logger.error(`Failed to remove temp folder ${folderPath}`, err);
  }
}

export function relativeToRun(filePath:string): string {
  return path.join(cwd(), filePath);
}

export const toKiloByte = (byte: number): number => byte / 1024;
export const toMegaByte = (byte: number): number => byte / 1024 / 1024;
export const toGigaByte = (byte: number): number => byte / 1024 / 1024 / 1024;
