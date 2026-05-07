import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

Element.prototype.setPointerCapture ??= () => undefined;

afterEach(() => {
  cleanup();
});
