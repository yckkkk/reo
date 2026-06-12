import type { CSSProperties } from 'react';
import {
  deriveCoverToneRegionFromBackground,
  type CoverToneRegion,
  type RgbTuple,
} from './coverTone';

export type RecentExpressionGlyphTone = Pick<CoverToneRegion, 'protect' | 'text'>;

type RecentExpressionGlyphToneStyle = CSSProperties & Record<`--${string}`, string>;

const DEFAULT_RECENT_EXPRESSION_GLYPH_TONE: RecentExpressionGlyphTone = {
  text: [250, 250, 250],
  protect: [0, 0, 0],
};
const RECENT_EXPRESSION_ICON_TONE_SAMPLE_SIZE = 48;
const MAX_RECENT_EXPRESSION_GLYPH_TONE_CACHE_ENTRIES = 64;
const recentExpressionGlyphToneCache = new Map<string, Promise<RecentExpressionGlyphTone>>();

function sampleRegion(
  context: CanvasRenderingContext2D,
  size: number,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): RgbTuple {
  const data = context.getImageData(
    Math.round(rect.x * size),
    Math.round(rect.y * size),
    Math.round(rect.width * size),
    Math.round(rect.height * size)
  ).data;
  const pixels: RgbTuple[] = [];
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 16) {
      continue;
    }
    pixels.push([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0]);
  }
  pixels.sort((left, right) => {
    const leftTotal = left[0] + left[1] + left[2];
    const rightTotal = right[0] + right[1] + right[2];
    return leftTotal - rightTotal;
  });
  const trimmed = pixels.slice(Math.floor(pixels.length * 0.1), Math.ceil(pixels.length * 0.9));
  const total = trimmed.reduce<RgbTuple>(
    (sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]],
    [0, 0, 0]
  );
  const length = Math.max(1, trimmed.length);
  return [
    Math.round(total[0] / length),
    Math.round(total[1] / length),
    Math.round(total[2] / length),
  ];
}

function cropImageToSquare(image: HTMLImageElement) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (imageRatio > 1) {
    sw = image.naturalHeight;
    sx = (image.naturalWidth - sw) / 2;
  } else if (imageRatio < 1) {
    sh = image.naturalWidth;
    sy = (image.naturalHeight - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

function glyphToneFromBackground(background: RgbTuple): RecentExpressionGlyphTone {
  const tone = deriveCoverToneRegionFromBackground(background);
  return {
    text: tone.text,
    protect: tone.protect,
  };
}

export function deriveRecentExpressionGlyphToneFromSampledBackgroundForTest(
  background: RgbTuple
): RecentExpressionGlyphTone {
  return glyphToneFromBackground(background);
}

export function fallbackRecentExpressionGlyphToneForSource(
  _source: string
): RecentExpressionGlyphTone {
  return DEFAULT_RECENT_EXPRESSION_GLYPH_TONE;
}

export function recentExpressionGlyphToneStyle(
  tone: RecentExpressionGlyphTone
): RecentExpressionGlyphToneStyle {
  return {
    '--recent-expression-glyph-r': String(tone.text[0]),
    '--recent-expression-glyph-g': String(tone.text[1]),
    '--recent-expression-glyph-b': String(tone.text[2]),
    '--recent-expression-glyph-protect-r': String(tone.protect[0]),
    '--recent-expression-glyph-protect-g': String(tone.protect[1]),
    '--recent-expression-glyph-protect-b': String(tone.protect[2]),
  };
}

async function deriveRecentExpressionGlyphToneFromImage(
  source: string
): Promise<RecentExpressionGlyphTone> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return fallbackRecentExpressionGlyphToneForSource(source);
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = source;
  await image.decode();

  const size = RECENT_EXPRESSION_ICON_TONE_SAMPLE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return fallbackRecentExpressionGlyphToneForSource(source);
  }

  const { sx, sy, sw, sh } = cropImageToSquare(image);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
  const background = sampleRegion(context, size, { x: 0.14, y: 0.14, width: 0.72, height: 0.72 });
  return glyphToneFromBackground(background);
}

export function resolveRecentExpressionGlyphToneForImageSource(
  source: string
): Promise<RecentExpressionGlyphTone> {
  const cached = recentExpressionGlyphToneCache.get(source);
  if (cached) {
    recentExpressionGlyphToneCache.delete(source);
    recentExpressionGlyphToneCache.set(source, cached);
    return cached;
  }

  const pending = deriveRecentExpressionGlyphToneFromImage(source).catch(() =>
    fallbackRecentExpressionGlyphToneForSource(source)
  );
  recentExpressionGlyphToneCache.set(source, pending);
  while (recentExpressionGlyphToneCache.size > MAX_RECENT_EXPRESSION_GLYPH_TONE_CACHE_ENTRIES) {
    const oldest = recentExpressionGlyphToneCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    recentExpressionGlyphToneCache.delete(oldest);
  }
  return pending;
}
