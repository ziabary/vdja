export interface intfSiemExportOutcome { readonly kind: 'DELIVERED' | 'RETRY' | 'FAILED' | 'UNKNOWN'; readonly errorClass?: string }
