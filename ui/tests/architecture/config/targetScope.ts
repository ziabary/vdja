export type RuleDescriptor = {
    id: string;
    title: string;
    category: "dependency" | "persistence" | "authorization" | "ai" | "documents" | "module" | "typescript";
    summary: string;
};

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
        "modules/crm/module.json",
        "modules/followup/module.json",
        "modules/letter-assistant/module.json",
        "modules/secretariat/module.json",
        "modules/widget/module.json",
    ],
    requiredAuthorityContractFiles: [
        "packages/authority/src/index.ts",
        "packages/authority/src/authority.ts",
        "packages/authority/index.ts",
    ],
} as const;

export const ruleCatalog: readonly RuleDescriptor[] = [
    {
        id: "ARCH-DEP-001",
        title: "Platform packages must not import business modules.",
        category: "dependency",
        summary: "Platform capability packages must depend on canonical contracts rather than module implementations.",
    },
    {
        id: "ARCH-DEP-002",
        title: "Business modules may not directly import sibling modules without explicit contracts.",
        category: "dependency",
        summary: "Cross-module logic must route through explicit published contracts and optional integration boundaries.",
    },
    {
        id: "ARCH-PERSIST-001",
        title: "Authoritative persistence is owned by persistence implementations.",
        category: "persistence",
        summary: "PostgreSQL access and SQL must remain inside persistence-owned code, not application routes or modules.",
    },
    {
        id: "ARCH-AUTH-001",
        title: "Authority remains the sole authorization decision engine.",
        category: "authorization",
        summary: "Authorization rules and decision precedence are owned by the authority service and not re-implemented in business code.",
    },
    {
        id: "ARCH-AI-001",
        title: "Business modules request semantic AI tasks through AI Router.",
        category: "ai",
        summary: "AI execution routing and provider selection are not business-layer responsibilities.",
    },
    {
        id: "ARCH-DOC-001",
        title: "Document and RAG storage ownership is separated from business modules.",
        category: "documents",
        summary: "Document, knowledge, and retrieval work remains inside document and knowledge capabilities, not ad hoc module code.",
    },
    {
        id: "ARCH-MOD-001",
        title: "Each module declares a module manifest.",
        category: "module",
        summary: "Every module must expose a machine-readable declaration for name, capabilities, and contracts.",
    },
    {
        id: "ARCH-TS-001",
        title: "Target TypeScript code avoids implicit any.",
        category: "typescript",
        summary: "Target domain contracts must remain explicit and typed; any is only allowed in explicitly isolated compatibility boundaries.",
    },
    {
        id: "ARCH-TS-002",
        title: "TypeScript uses explicit, stable contracts instead of ad hoc magic strings.",
        category: "typescript",
        summary: "Business decisions require named types, enums, and discriminated unions rather than raw string/number literals.",
    },
];
