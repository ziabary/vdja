import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function listMissingPaths(paths: readonly string[]): string[] {
    return paths.filter((relativePath) => !existsSync(join(repoRoot, relativePath)));
}

export function requireFile(relativePath: string, label: string): string {
    const fullPath = join(repoRoot, relativePath);
    assert.ok(existsSync(fullPath), `${label} is missing at ${relativePath}`);
    return fullPath;
}

export function requireJson(relativePath: string, label: string): Record<string, unknown> {
    const fullPath = requireFile(relativePath, label);
    const raw = readFileSync(fullPath, "utf8");

    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
        throw new Error(`${label} at ${relativePath} is not valid JSON: ${String(error)}`);
    }
}
