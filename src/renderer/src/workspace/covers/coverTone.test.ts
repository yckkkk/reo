import { describe, expect, it } from 'vitest';
import {
  coverToneStyle,
  deriveCoverToneFromSampledRegionsForTest,
  fallbackCoverToneForSource,
  resolveCoverToneForImageSource,
} from './coverTone';

describe('cover tone', () => {
  it('derives title and bottom foreground independently from sampled cover regions', () => {
    const tone = deriveCoverToneFromSampledRegionsForTest({
      title: [242, 247, 248],
      bottom: [28, 48, 58],
    });

    expect(tone.title.text[0]).toBeLessThan(90);
    expect(tone.bottom.text[0]).toBeGreaterThan(220);
    expect(tone.title.protect).toEqual([255, 255, 255]);
    expect(tone.bottom.protect).toEqual([0, 0, 0]);
  });

  it('serializes text and protection colors into card scoped CSS variables', () => {
    const style = coverToneStyle({
      title: {
        text: [38, 61, 67],
        protect: [255, 255, 255],
        scrimMid: 0.12,
        scrimStart: 0.24,
      },
      bottom: {
        text: [242, 246, 248],
        protect: [0, 0, 0],
        scrimMid: 0.1,
        scrimStart: 0.22,
      },
    });

    expect(style['--cover-title-r']).toBe('38');
    expect(style['--cover-bottom-b']).toBe('248');
    expect(style['--cover-title-protect-r']).toBe('255');
    expect(style['--cover-bottom-protect-r']).toBe('0');
    expect(style['--top-scrim-start']).toBe('0.24');
  });

  it('keeps the approved fallback tones for default gradient assets', () => {
    expect(fallbackCoverToneForSource('/assets/cover-05.png').title.text).toEqual([50, 79, 88]);
    expect(fallbackCoverToneForSource('/assets/cover-05-B9xY_q2.png').title.text).toEqual([
      50, 79, 88,
    ]);
    expect(fallbackCoverToneForSource('/assets/cover-12.png').bottom.text).toEqual([242, 246, 248]);
  });

  it('does not decode or canvas-sample default gradient assets', async () => {
    const createdImages: HTMLImageElement[] = [];
    const OriginalImage = globalThis.Image;
    class TestImage {
      constructor() {
        createdImages.push(this as unknown as HTMLImageElement);
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    try {
      const tone = await resolveCoverToneForImageSource('/assets/cover-05-B9xY_q2.png');
      expect(tone.title.text).toEqual([50, 79, 88]);
    } finally {
      globalThis.Image = OriginalImage;
    }

    expect(createdImages).toHaveLength(0);
  });

  it('loads custom protocol covers with anonymous CORS so canvas sampling can read pixels', async () => {
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
      await resolveCoverToneForImageSource('reo-attachment://ws_1/segments/seg_1/cover/a.png?v=1');
    } finally {
      globalThis.Image = OriginalImage;
    }

    expect(createdImages[0]?.crossOrigin).toBe('anonymous');
  });

  it('bounds custom cover tone cache so old versioned sources can be released', async () => {
    const createdSources: string[] = [];
    const OriginalImage = globalThis.Image;
    class TestImage {
      crossOrigin: string | null = null;
      decoding: 'async' | 'auto' | 'sync' = 'auto';
      naturalHeight = 0;
      naturalWidth = 0;
      private source = '';

      set src(value: string) {
        this.source = value;
        createdSources.push(value);
      }

      get src(): string {
        return this.source;
      }

      decode(): Promise<void> {
        return Promise.resolve();
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    try {
      for (let index = 0; index < 70; index += 1) {
        await resolveCoverToneForImageSource(
          `reo-attachment://ws_1/segments/seg_${index}/cover/a.png?v=${index}`
        );
      }
      await resolveCoverToneForImageSource('reo-attachment://ws_1/segments/seg_0/cover/a.png?v=0');
    } finally {
      globalThis.Image = OriginalImage;
    }

    expect(
      createdSources.filter(
        (source) => source === 'reo-attachment://ws_1/segments/seg_0/cover/a.png?v=0'
      )
    ).toHaveLength(2);
  });
});
