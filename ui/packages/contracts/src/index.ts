/** Browser-safe U1 presentation contracts. No credential or business authority lives here. */
export type typTenantId = string & { readonly __brand: 'TenantId' };
export type typModuleId = string & { readonly __brand: 'ModuleId' };
export type typRouteId = string & { readonly __brand: 'RouteId' };
export type typContextVersion = string & { readonly __brand: 'ContextVersion' };

export type typActorKind = 'ANONYMOUS' | 'HUMAN' | 'SERVICE_ACCOUNT' | 'API_CLIENT' | 'PLATFORM_SERVICE';
export interface intfExecutionContext {
  readonly deploymentId: string;
  readonly tenantId: string;
  readonly moduleId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorKind: typActorKind;
  readonly actorId: string | null;
  readonly sessionId: string | null;
  readonly source: string;
  readonly configFingerprint: string;
}
export interface intfModuleManifest {
  readonly id: string;
  readonly version: string;
  readonly compatibility: { readonly minPlatformVersion: string; readonly configSchemaVersion: number };
  readonly instanceModel: 'DEPLOYMENT_SINGLETON';
  readonly capabilities: { readonly required: readonly string[] };
  readonly backend: { readonly routes: readonly { readonly id: string; readonly method: 'POST'; readonly path: string; readonly surface: 'public' }[] };
  readonly ai: { readonly tasks: readonly { readonly id: string }[] };
  readonly usage: { readonly meters: readonly { readonly id: string }[] };
  readonly admission: { readonly id: string };
}

export type typUiLocale = 'fa' | 'en';
export type typUiDirection = 'rtl' | 'ltr';
export type typThemePreference = 'light' | 'dark' | 'system';
export type typResolvedTheme = 'light' | 'dark';

export interface intfPublicAssetRef { readonly path: string; readonly alt: string }
export interface intfBrandProjection {
  readonly version: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly logoLight?: intfPublicAssetRef;
  readonly logoDark?: intfPublicAssetRef;
  readonly favicon?: string;
  readonly primaryColor: string;
  readonly supportUrl?: string;
  readonly legalUrl?: string;
}
export interface intfTenantView { readonly id: typTenantId; readonly label: string; readonly contextVersion: typContextVersion }
export interface intfSessionBootstrapView {
  readonly state: 'anonymous' | 'authenticated';
  readonly actorLabel?: string;
  readonly tenant?: intfTenantView;
  readonly switchableTenants: readonly intfTenantView[];
  readonly capabilityKeys: readonly string[];
}
export interface intfUiBootstrapView {
  readonly brand: intfBrandProjection;
  readonly session: intfSessionBootstrapView;
  readonly locale: typUiLocale;
  readonly direction: typUiDirection;
  readonly theme: typThemePreference;
  readonly enabledModules: readonly typModuleId[];
}

export type typUiSurface = 'public' | 'user' | 'admin';
export type typUiEntryMode = 'platform' | 'module' | 'login' | 'publicLanding';
export interface intfRouteBinding {
  readonly routeId: typRouteId;
  readonly host: string;
  readonly basePath: string;
  readonly moduleId?: typModuleId;
  readonly instanceId?: string;
  readonly tenantId?: typTenantId;
  readonly surface: typUiSurface;
  readonly entryMode: typUiEntryMode;
  readonly locale?: typUiLocale;
  readonly path: string;
}
export interface intfUiContributionBase {
  readonly id: string;
  readonly moduleId: typModuleId;
  readonly contractVersion: number;
  readonly routeId: typRouteId;
  readonly labelKey: string;
  readonly order: number;
  readonly capabilityKey?: string;
  readonly instanceId?: string;
}
export type typModuleUiContribution = intfUiContributionBase & (
  | { readonly kind: 'navigation'; readonly surface: typUiSurface; readonly iconKey?: string }
  | { readonly kind: 'route'; readonly surface: typUiSurface; readonly componentKey: string }
  | { readonly kind: 'admin'; readonly componentKey: string }
  | { readonly kind: 'dashboard-card'; readonly componentKey: string }
  | { readonly kind: 'settings-panel'; readonly componentKey: string }
  | { readonly kind: 'module-instance-panel'; readonly componentKey: string }
  | { readonly kind: 'badge'; readonly summaryKey: string }
  | { readonly kind: 'action'; readonly commandId: string }
);
export interface intfCursorPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
export interface intfCountResult { readonly count: number; readonly filterFingerprint: string }
export interface intfApiErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
  readonly fields?: Readonly<Record<string, string>>;
}
export type typStreamEvent =
  | { readonly type: 'STATUS'; readonly operationId: string; readonly message: string; readonly sequence?: number }
  | { readonly type: 'DELTA'; readonly operationId: string; readonly text: string; readonly sequence?: number }
  | { readonly type: 'REFERENCES'; readonly operationId: string; readonly refs: readonly string[]; readonly sequence?: number }
  | { readonly type: 'DONE'; readonly operationId: string; readonly sequence?: number }
  | { readonly type: 'ERROR'; readonly operationId: string; readonly code: string; readonly sequence?: number }
  | { readonly type: 'CANCELLED'; readonly operationId: string; readonly sequence?: number };
