import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { requireJson } from "./support/architectureHarness.ts";

describe("module manifest conformance", () => {
    const moduleRootNames = [
        "crm",
        "followup",
        "letter-assistant",
        "secretariat",
        "widget",
    ];

    for (const moduleName of moduleRootNames) {
        test(`${moduleName} exposes a valid module manifest`, () => {
            const manifest = requireJson(`modules/${moduleName}/module.json`, `${moduleName} module manifest`);

            assert.strictEqual(manifest.kind, "module", `${moduleName} manifest must declare kind = \"module\".`);
            assert.strictEqual(typeof manifest.name, "string", `${moduleName} manifest must declare a stable name.`);
            assert.ok(Array.isArray(manifest.capabilities), `${moduleName} manifest must declare capabilities.`);
            assert.ok(Array.isArray(manifest.contracts), `${moduleName} manifest must declare contracts.`);
        });
    }
});
