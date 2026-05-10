import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;

const dispatchEvent = window.EventTarget.prototype.dispatchEvent;
window.EventTarget.prototype.dispatchEvent = function dispatchWindowEvent(event: Event): boolean {
  const eventLike = event as unknown as {
    readonly bubbles?: boolean;
    readonly cancelable?: boolean;
    readonly composed?: boolean;
    readonly type?: string;
  };

  if (!(event instanceof window.Event) && typeof eventLike.type === 'string') {
    return dispatchEvent.call(
      this,
      new window.CustomEvent(eventLike.type, {
        bubbles: eventLike.bubbles ?? false,
        cancelable: eventLike.cancelable ?? false,
        composed: eventLike.composed ?? false,
      })
    );
  }

  return dispatchEvent.call(this, event);
};

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
