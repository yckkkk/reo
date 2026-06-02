import type { CSSProperties } from 'react';

type RgbTuple = readonly [number, number, number];
type HslTuple = readonly [number, number, number];

export type CoverToneRegion = {
  readonly text: RgbTuple;
  readonly protect: RgbTuple;
  readonly scrimStart?: number;
  readonly scrimMid?: number;
};

export type CoverTone = {
  readonly title: CoverToneRegion;
  readonly bottom: CoverToneRegion;
};

type CoverToneStyle = CSSProperties & Record<`--${string}`, string>;

const DEFAULT_COVER_TONE: CoverTone = {
  title: { text: [250, 250, 250], protect: [0, 0, 0], scrimStart: 0.18, scrimMid: 0.1 },
  bottom: { text: [250, 250, 250], protect: [0, 0, 0], scrimStart: 0.2, scrimMid: 0.1 },
};

const FALLBACK_TONES: Record<string, CoverTone> = {
  'cover-01.png': {
    title: { text: [248, 245, 242], protect: [0, 0, 0] },
    bottom: { text: [224, 200, 203], protect: [0, 0, 0] },
  },
  'cover-02.png': {
    title: { text: [248, 245, 242], protect: [0, 0, 0] },
    bottom: { text: [248, 245, 242], protect: [0, 0, 0] },
  },
  'cover-03.png': {
    title: { text: [88, 54, 50], protect: [255, 255, 255] },
    bottom: { text: [248, 244, 242], protect: [0, 0, 0] },
  },
  'cover-04.png': {
    title: { text: [60, 52, 76], protect: [255, 255, 255] },
    bottom: { text: [243, 246, 247], protect: [0, 0, 0] },
  },
  'cover-05.png': {
    title: { text: [50, 79, 88], protect: [255, 255, 255] },
    bottom: { text: [59, 67, 78], protect: [255, 255, 255] },
  },
  'cover-06.png': {
    title: { text: [38, 61, 67], protect: [255, 255, 255] },
    bottom: { text: [50, 85, 88], protect: [255, 255, 255] },
  },
  'cover-07.png': {
    title: { text: [73, 50, 88], protect: [255, 255, 255] },
    bottom: { text: [50, 61, 88], protect: [255, 255, 255] },
  },
  'cover-08.png': {
    title: { text: [242, 245, 248], protect: [0, 0, 0] },
    bottom: { text: [242, 245, 248], protect: [0, 0, 0] },
  },
  'cover-09.png': {
    title: { text: [196, 222, 217], protect: [0, 0, 0] },
    bottom: { text: [238, 243, 239], protect: [0, 0, 0] },
  },
  'cover-10.png': {
    title: { text: [67, 86, 52], protect: [255, 255, 255] },
    bottom: { text: [38, 66, 49], protect: [255, 255, 255] },
  },
  'cover-11.png': {
    title: { text: [246, 243, 245], protect: [0, 0, 0] },
    bottom: { text: [247, 242, 243], protect: [0, 0, 0] },
  },
  'cover-12.png': {
    title: { text: [50, 72, 88], protect: [255, 255, 255] },
    bottom: { text: [242, 246, 248], protect: [0, 0, 0] },
  },
  'cover-13.png': {
    title: { text: [78, 60, 78], protect: [255, 255, 255] },
    bottom: { text: [88, 60, 50], protect: [255, 255, 255] },
  },
};

const coverToneCache = new Map<string, Promise<CoverTone>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl([red, green, blue]: RgbTuple): HslTuple {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return [0, 0, lightness];
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [Math.round(hue * 60 + (hue < 0 ? 360 : 0)), saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): RgbTuple {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness - chroma / 2;
  let rgb: [number, number, number];
  if (huePrime >= 0 && huePrime < 1) {
    rgb = [chroma, x, 0];
  } else if (huePrime < 2) {
    rgb = [x, chroma, 0];
  } else if (huePrime < 3) {
    rgb = [0, chroma, x];
  } else if (huePrime < 4) {
    rgb = [0, x, chroma];
  } else if (huePrime < 5) {
    rgb = [x, 0, chroma];
  } else {
    rgb = [chroma, 0, x];
  }
  const [red, green, blue] = rgb.map((channel) => Math.round((channel + match) * 255));
  return [red ?? 0, green ?? 0, blue ?? 0];
}

function relativeLuminance([red, green, blue]: RgbTuple): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(left: RgbTuple, right: RgbTuple): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function deriveForeground(background: RgbTuple): CoverToneRegion {
  const [hue, saturation] = rgbToHsl(background);
  const luminance = relativeLuminance(background);
  const lightText = hslToRgb(hue, clamp(saturation * 0.5, 0.06, 0.32), 0.94);
  const darkText = hslToRgb(hue, clamp(saturation * 0.55, 0.08, 0.34), 0.2);
  const lightContrast = contrastRatio(lightText, background);
  const darkContrast = contrastRatio(darkText, background);
  const useDarkText = luminance > 0.72 || (luminance > 0.58 && darkContrast > lightContrast + 1.4);
  let text = useDarkText ? darkText : lightText;

  if (contrastRatio(text, background) < 4.5) {
    text = useDarkText ? [24, 24, 27] : [250, 250, 250];
  }

  const contrast = contrastRatio(text, background);
  const scrimStart = clamp(0.12 + Math.max(0, 5.2 - contrast) * 0.055, 0.12, 0.34);
  return {
    text,
    protect: useDarkText ? [255, 255, 255] : [0, 0, 0],
    scrimStart,
    scrimMid: clamp(scrimStart * 0.55, 0.06, 0.2),
  };
}

export function deriveCoverToneFromSampledRegionsForTest({
  bottom,
  title,
}: {
  readonly bottom: RgbTuple;
  readonly title: RgbTuple;
}): CoverTone {
  return {
    title: deriveForeground(title),
    bottom: deriveForeground(bottom),
  };
}

function sourceFilename(source: string): string {
  const withoutQuery = source.split(/[?#]/)[0] ?? source;
  return withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
}

export function fallbackCoverToneForSource(source: string): CoverTone {
  return FALLBACK_TONES[sourceFilename(source)] ?? DEFAULT_COVER_TONE;
}

export function coverToneStyle(tone: CoverTone): CoverToneStyle {
  return {
    '--cover-title-r': String(tone.title.text[0]),
    '--cover-title-g': String(tone.title.text[1]),
    '--cover-title-b': String(tone.title.text[2]),
    '--cover-bottom-r': String(tone.bottom.text[0]),
    '--cover-bottom-g': String(tone.bottom.text[1]),
    '--cover-bottom-b': String(tone.bottom.text[2]),
    '--cover-title-protect-r': String(tone.title.protect[0]),
    '--cover-title-protect-g': String(tone.title.protect[1]),
    '--cover-title-protect-b': String(tone.title.protect[2]),
    '--cover-bottom-protect-r': String(tone.bottom.protect[0]),
    '--cover-bottom-protect-g': String(tone.bottom.protect[1]),
    '--cover-bottom-protect-b': String(tone.bottom.protect[2]),
    '--top-scrim-start': String(tone.title.scrimStart ?? 0.18),
    '--top-scrim-mid': String(tone.title.scrimMid ?? 0.1),
    '--bottom-scrim-start': String(tone.bottom.scrimStart ?? 0.2),
    '--bottom-scrim-mid': String(tone.bottom.scrimMid ?? 0.1),
  };
}

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
  pixels.sort((left, right) => relativeLuminance(left) - relativeLuminance(right));
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

async function deriveCoverToneFromImage(source: string): Promise<CoverTone> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return fallbackCoverToneForSource(source);
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = source;
  await image.decode();

  const size = 72;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return fallbackCoverToneForSource(source);
  }

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

  context.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
  return {
    title: deriveForeground(
      sampleRegion(context, size, { x: 0.08, y: 0.08, width: 0.76, height: 0.34 })
    ),
    bottom: deriveForeground(
      sampleRegion(context, size, { x: 0.08, y: 0.68, width: 0.84, height: 0.24 })
    ),
  };
}

export function resolveCoverToneForImageSource(source: string): Promise<CoverTone> {
  const cached = coverToneCache.get(source);
  if (cached) {
    return cached;
  }
  const pending = deriveCoverToneFromImage(source).catch(() => fallbackCoverToneForSource(source));
  coverToneCache.set(source, pending);
  return pending;
}
