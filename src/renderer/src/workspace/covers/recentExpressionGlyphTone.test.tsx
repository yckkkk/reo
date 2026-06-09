import { describe, expect, it } from 'vitest';
import {
  deriveRecentExpressionGlyphToneFromSampledBackgroundForTest,
  recentExpressionGlyphToneStyle,
  resolveRecentExpressionGlyphToneForImageSource,
} from './recentExpressionGlyphTone';

describe('recent expression glyph tone', () => {
  it('derives the type glyph color from the small icon viewport background', () => {
    const tone = deriveRecentExpressionGlyphToneFromSampledBackgroundForTest([236, 242, 246]);

    expect(tone.text[0]).toBeLessThan(90);
    expect(tone.text[1]).toBeLessThan(100);
    expect(tone.text[2]).toBeLessThan(110);
    expect(tone.protect).toEqual([255, 255, 255]);
  });

  it('serializes scoped variables for Home recent expression icons', () => {
    const style = recentExpressionGlyphToneStyle({
      text: [42, 54, 66],
      protect: [255, 255, 255],
    });

    expect(style['--recent-expression-glyph-r']).toBe('42');
    expect(style['--recent-expression-glyph-g']).toBe('54');
    expect(style['--recent-expression-glyph-b']).toBe('66');
    expect(style).not.toHaveProperty('--cover-bottom-r');
  });

  it('samples default gradient assets instead of reusing card cover tone defaults', async () => {
    const createdImages: HTMLImageElement[] = [];
    const OriginalImage = globalThis.Image;
    class TestImage {
      crossOrigin: string | null = null;
      decoding: 'async' | 'auto' | 'sync' = 'auto';
      naturalHeight = 0;
      naturalWidth = 0;
      src = '';

      constructor() {
        createdImages.push(this as unknown as HTMLImageElement);
      }

      decode(): Promise<void> {
        return Promise.resolve();
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    try {
      await resolveRecentExpressionGlyphToneForImageSource('/assets/cover-05.png');
    } finally {
      globalThis.Image = OriginalImage;
    }

    expect(createdImages).toHaveLength(1);
    expect(createdImages[0]?.crossOrigin).toBe('anonymous');
  });
});
