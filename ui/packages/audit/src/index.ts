export type typPublicAuditAction =
  | 'public.translate.requested' | 'public.translate.completed' | 'public.translate.failed' | 'public.translate.cancelled'
  | 'public.summarize.requested' | 'public.summarize.completed' | 'public.summarize.failed' | 'public.summarize.cancelled'
  | 'public.file.extract.requested' | 'public.file.extract.completed' | 'public.file.extract.failed' | 'public.file.extract.cancelled'
  | 'public.faq.inspect' | 'public.faq.generate.requested' | 'public.faq.generate.completed' | 'public.faq.failed' | 'public.faq.cancelled';
export type typSecurityAuditAction = 'authentication.success' | 'authentication.failed' | 'authentication.rate_limited'
  | 'session.created' | 'session.refreshed' | 'session.refresh_replay_detected' | 'session.logout'
  | 'session.revoked' | 'tenant.switched' | 'tenant.mismatch' | 'authority.denied'
  | 'credential.changed' | 'identity.suspended' | 'membership.suspended';
export type typAuditResult = 'REQUESTED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'DENIED';
