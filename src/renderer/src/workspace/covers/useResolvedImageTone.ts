import { useEffect, useState } from 'react';

type WindowWithIdleCallback = Window & {
  readonly requestIdleCallback?: (
    callback: () => void,
    options?: { readonly timeout: number }
  ) => number;
  readonly cancelIdleCallback?: (handle: number) => void;
};

function alwaysResolveImageTone() {
  return true;
}

export function useResolvedImageTone<T>(
  source: string,
  fallbackForSource: (source: string) => T,
  resolveForSource: (source: string) => Promise<T>,
  shouldResolveForSource: (source: string) => boolean = alwaysResolveImageTone
): T {
  const [tone, setTone] = useState(() => fallbackForSource(source));

  useEffect(() => {
    let cancelled = false;
    setTone(fallbackForSource(source));
    if (!shouldResolveForSource(source)) {
      return undefined;
    }

    let idleCallbackHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const loadTone = () => {
      void resolveForSource(source).then((nextTone) => {
        if (!cancelled) {
          setTone(nextTone);
        }
      });
    };
    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleCallbackHandle = idleWindow.requestIdleCallback(loadTone, { timeout: 600 });
    } else {
      timeoutHandle = window.setTimeout(loadTone, 0);
    }

    return () => {
      cancelled = true;
      if (idleCallbackHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleCallbackHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [fallbackForSource, resolveForSource, shouldResolveForSource, source]);

  return tone;
}
