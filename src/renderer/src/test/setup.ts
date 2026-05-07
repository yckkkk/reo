import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

Element.prototype.setPointerCapture ??= () => undefined;
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: (contextType: string) =>
    contextType === '2d'
      ? {
          beginPath: () => undefined,
          clearRect: () => undefined,
          fill: () => undefined,
          roundRect: () => undefined,
          scale: () => undefined,
        }
      : null,
});
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
};

afterEach(() => {
  cleanup();
});
