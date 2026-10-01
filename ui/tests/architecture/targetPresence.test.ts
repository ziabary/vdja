import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { listMissingPaths } from "./support/architectureHarness.ts";
import { targetArchitectureScope } from "./config/targetScope.ts";

describe("target architecture presence", () => {
    test("required target roots exist", () => {
        const missing = listMissingPaths(targetArchitectureScope.requiredRootDirectories);

        assert.deepEqual(
            missing,
            [],
            `Expected the target architecture roots to exist. Missing: ${missing.join(", ")}`,
        );
    });

    test("required package manifests are exposed", () => {
        const missing = listMissingPaths(targetArchitectureScope.requiredPackageManifestFiles);

        assert.deepEqual(
            missing,
            [],
            `The target package architecture is not yet manifest-backed. Missing: ${missing.join(", ")}`,
        );
    });

    test("required module manifests are exposed", () => {
        const missing = listMissingPaths(targetArchitectureScope.requiredModuleManifestFiles);

        assert.deepEqual(
            missing,
            [],
            `Target module definitions are missing expected manifest declarations. Missing: ${missing.join(", ")}`,
        );
    });
});
