/** The release Web process owns headers for adapter-served static assets. */
export function installWebSecurityHeaders(server) {
  const listeners = server.listeners('request');
  if (listeners.length !== 1) throw new Error('WEB_REQUEST_HANDLER_UNEXPECTED');
  server.removeAllListeners('request');
  server.on('request', (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; report-uri /api/security/csp-report");
    listeners[0](request, response);
  });
}
