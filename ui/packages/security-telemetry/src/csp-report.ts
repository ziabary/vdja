export interface intfSafeCspReport { readonly directive: string; readonly blockedKind: 'INLINE' | 'EVAL' | 'DATA' | 'REMOTE' | 'UNKNOWN' }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_CSP_REPORT');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length > 24 || Object.values(data).some(item => item !== null && typeof item === 'object'))
    throw new Error('INVALID_CSP_REPORT');
  return data;
}

/** Accepts only bounded browser report envelopes and discards raw URLs, samples and credentials. */
export function parseCspReport(bytes: Buffer, contentType: string | undefined, maxBodyBytes: number): intfSafeCspReport {
  if (!['application/csp-report', 'application/reports+json'].includes(contentType ?? '')
    || bytes.length === 0 || bytes.length > maxBodyBytes) throw new Error('INVALID_CSP_REPORT');
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new Error('INVALID_CSP_REPORT'); }
  let body: Record<string, unknown>;
  if (contentType === 'application/csp-report') {
    const envelope = parsed as Record<string, unknown>;
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || Object.keys(envelope).length !== 1)
      throw new Error('INVALID_CSP_REPORT');
    body = object(envelope['csp-report']);
  } else {
    if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error('INVALID_CSP_REPORT');
    const report = parsed[0] as Record<string, unknown>;
    if (!report || typeof report !== 'object' || Array.isArray(report) || report.type !== 'csp-violation'
      || Object.keys(report).length > 8) throw new Error('INVALID_CSP_REPORT');
    body = object(report.body);
  }
  const directive = body['effective-directive'] ?? body.effectiveDirective ?? body['violated-directive'];
  if (typeof directive !== 'string' || !/^[a-z-]{1,40}$/u.test(directive)) throw new Error('INVALID_CSP_REPORT');
  const blocked = body['blocked-uri'] ?? body.blockedURL;
  const blockedKind = blocked === 'inline' ? 'INLINE' : blocked === 'eval' ? 'EVAL' : blocked === 'data' ? 'DATA'
    : typeof blocked === 'string' && blocked.length <= 2048 ? 'REMOTE' : 'UNKNOWN';
  return { directive, blockedKind };
}
