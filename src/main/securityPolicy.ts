const PROD_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: reo-attachment:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'none'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const DEV_AGENTATION_MCP_ENDPOINT = 'http://localhost:4747';

export function createContentSecurityPolicy({
  devConnectSources = [],
  usesDevServer,
}: {
  readonly devConnectSources?: readonly string[];
  readonly usesDevServer: boolean;
}) {
  if (!usesDevServer) {
    return PROD_CSP_DIRECTIVES.join('; ');
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: reo-attachment:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'none'",
    `connect-src 'self' ${[...devConnectSources, DEV_AGENTATION_MCP_ENDPOINT].join(' ')}`.trim(),
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
