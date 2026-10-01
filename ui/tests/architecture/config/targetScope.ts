import { RULES } from '../support/staticAnalysis.ts';
export type RuleDescriptor = { id:string; title:string; category:string; mechanism:string };

export const targetArchitectureScope = {
    roots: ["apps", "packages", "modules"] as const,
    requiredRootDirectories: [
        "apps/api",
        "apps/web",
        "apps/worker",
        "packages/authority",
        "packages/ai-router",
        "packages/documents",
        "packages/knowledge",
        "packages/notifications",
        "packages/ticketing",
        "packages/commercial",
        "modules/crm",
        "modules/followup",
        "modules/letter-assistant",
        "modules/secretariat",
        "modules/widget",
    ],
    requiredPackageManifestFiles: [
        "packages/authority/package.json",
        "packages/ai-router/package.json",
        "packages/documents/package.json",
        "packages/knowledge/package.json",
        "packages/notifications/package.json",
        "packages/ticketing/package.json",
        "packages/commercial/package.json",
    ],
    requiredModuleManifestFiles: [
        "modules/crm/manifest.ts",
        "modules/followup/manifest.ts",
        "modules/letter-assistant/manifest.ts",
        "modules/secretariat/manifest.ts",
        "modules/widget/manifest.ts",
    ],
    requiredAuthorityContractFiles: [
        "packages/authority/src/index.ts",
        "packages/authority/src/authority.ts",
        "packages/authority/index.ts",
    ],
} as const;

export const ruleCatalog: readonly RuleDescriptor[] = RULES;
