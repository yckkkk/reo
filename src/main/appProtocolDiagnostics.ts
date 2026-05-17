import { diagnosticErrorName } from './diagnostics.js';

export type AppProtocolWarn = (message: string, details: { readonly errorName: string }) => void;

export function appProtocolResolveFailureDetails({ error }: { readonly error: unknown }) {
  return {
    errorName: diagnosticErrorName(error),
  };
}

export function warnAppProtocolResolveFailure({
  error,
  warn = console.warn,
}: {
  readonly error: unknown;
  readonly warn?: AppProtocolWarn;
}) {
  warn(
    '[AppProtocol] Failed to resolve renderer asset',
    appProtocolResolveFailureDetails({ error })
  );
}
