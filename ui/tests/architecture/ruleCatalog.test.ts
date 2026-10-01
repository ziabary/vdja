import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ruleCatalog } from "./config/targetScope.ts";

describe("architecture rule catalog", () => {
    test("all rules have a stable identifier and metadata", () => {
        assert.ok(ruleCatalog.length >= 8, "The rule catalog should cover multiple architecture guardrails.");

        const ids = ruleCatalog.map((rule) => rule.id);
        const uniqueIds = new Set(ids);

        assert.strictEqual(ids.length, uniqueIds.size, "Rule IDs must be unique.");
        assert.ok(ids.every((id) => /^ARCH-[A-Z]+-\d{3}$/.test(id)), "Rule IDs must follow the ARCH-<DOMAIN>-NNN format.");
        assert.ok(ruleCatalog.every((rule) => rule.title.length > 0), "Every rule needs a human-readable description.");
    });
});
