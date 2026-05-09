import { describe, expect, it } from 'vitest';
import { countLabel } from './memoryLabels';

describe('memoryLabels', () => {
  it('keeps missing counts out of visible memory metadata', () => {
    expect(countLabel(undefined, '个片段')).toBe('0 个片段');
    expect(countLabel(Number.NaN, '个片段')).toBe('0 个片段');
  });
});
