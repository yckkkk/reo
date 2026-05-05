const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface ResolveDevServerUrlOptions {
  readonly rawUrl: string | undefined;
  readonly isPackaged: boolean;
  readonly warn?: (message: string) => void;
}

function isLoopbackHttpUrl(url: URL): boolean {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTNAMES.has(url.hostname)
  );
}

export function resolveDevServerUrl({
  rawUrl,
  isPackaged,
  warn = console.warn,
}: ResolveDevServerUrlOptions): string | null {
  if (isPackaged || !rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (isLoopbackHttpUrl(parsed)) {
      return parsed.origin;
    }
  } catch {
    warn('[Security] Ignoring invalid ELECTRON_RENDERER_URL');
    return null;
  }

  warn('[Security] Ignoring non-loopback ELECTRON_RENDERER_URL');
  return null;
}

export function getDevServerConnectSources(devServerOrigins: Iterable<string>): string[] {
  return Array.from(devServerOrigins, (origin) => {
    const parsed = new URL(origin);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return parsed.origin;
  });
}
