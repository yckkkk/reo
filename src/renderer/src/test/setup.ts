import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

if (!window.localStorage) {
  Object.defineProperty(window, 'Storage', {
    configurable: true,
    value: MemoryStorage,
  });
  Object.defineProperty(globalThis, 'Storage', {
    configurable: true,
    value: MemoryStorage,
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
}

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

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

function createTestDomRect(): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

function createTestDomRectList(): DOMRectList {
  const rect = createTestDomRect();
  return {
    0: rect,
    length: 1,
    item: (index: number) => (index === 0 ? rect : null),
    *[Symbol.iterator]() {
      yield rect;
    },
  } as DOMRectList;
}

if (!document.elementFromPoint) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => document.body,
  });
}

Element.prototype.getBoundingClientRect ??= createTestDomRect;
Element.prototype.getClientRects ??= createTestDomRectList;

if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= createTestDomRect;
  Range.prototype.getClientRects ??= createTestDomRectList;
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: (contextType: string) =>
    contextType === '2d'
      ? {
          arc: () => undefined,
          beginPath: () => undefined,
          clip: () => undefined,
          clearRect: () => undefined,
          fill: () => undefined,
          rect: () => undefined,
          restore: () => undefined,
          roundRect: () => undefined,
          save: () => undefined,
          scale: () => undefined,
          setTransform: () => undefined,
        }
      : null,
  writable: true,
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
