#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const defaultCrop = 'x140+0+0';
const defaultMaxDelta = 1;
const defaultTitleGap = 16;
const defaultMaxTitleGapDelta = 2;
const defaultMaxTitleCenterDelta = 1;
const defaultMaxRightIconCenterDelta = 1;

function printHelp() {
  console.log(`Usage:
  npm run verify:titlebar -- --image /tmp/reo-window.png
  npm run verify:titlebar -- --capture -1339,1211,1200,800 --output /tmp/reo-window.png
  npm run verify:titlebar:self-test

Options:
  --image <path>        Screenshot to measure.
  --capture <rect>      macOS screencapture rect: x,y,width,height.
  --output <path>       Screenshot output path when using --capture.
  --crop <geometry>     ImageMagick crop geometry. Default: ${defaultCrop}
  --max-delta <px>      Allowed vertical delta in physical pixels. Default: ${defaultMaxDelta}
  --title-gap <px>      Expected CSS px between sidebar toggle icon and workspace title. Default: ${defaultTitleGap}
  --max-title-gap-delta <px>
                       Allowed title gap delta in CSS px. Default: ${defaultMaxTitleGapDelta}
  --max-title-center-delta <px>
                       Allowed title center vertical delta against sidebar toggle icon in CSS px.
                       Default: ${defaultMaxTitleCenterDelta}
  --max-right-icon-center-delta <px>
                       Allowed right MemoryRail toggle icon center delta against sidebar toggle icon in CSS px.
                       Default: ${defaultMaxRightIconCenterDelta}
  --json                Print machine-readable JSON.
  --self-test           Generate and measure a synthetic fixture.
`);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runBuffer(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `${command} failed:\n${result.stderr?.toString('utf8') || result.stdout?.toString('utf8')}`
    );
  }
  return result.stdout;
}

function parseArgs(argv) {
  const options = {
    crop: defaultCrop,
    maxDelta: defaultMaxDelta,
    titleGap: defaultTitleGap,
    maxTitleGapDelta: defaultMaxTitleGapDelta,
    maxTitleCenterDelta: defaultMaxTitleCenterDelta,
    maxRightIconCenterDelta: defaultMaxRightIconCenterDelta,
    json: false,
    selfTest: false,
  };

  const readValue = (index, option) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`${option} requires a value.`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--image':
        options.image = readValue(index, arg);
        index += 1;
        break;
      case '--capture':
        options.capture = readValue(index, arg);
        index += 1;
        break;
      case '--output':
        options.output = readValue(index, arg);
        index += 1;
        break;
      case '--crop':
        options.crop = readValue(index, arg);
        index += 1;
        break;
      case '--max-delta':
        options.maxDelta = Number(readValue(index, arg));
        index += 1;
        break;
      case '--title-gap':
        options.titleGap = Number(readValue(index, arg));
        index += 1;
        break;
      case '--max-title-gap-delta':
        options.maxTitleGapDelta = Number(readValue(index, arg));
        index += 1;
        break;
      case '--max-title-center-delta':
        options.maxTitleCenterDelta = Number(readValue(index, arg));
        index += 1;
        break;
      case '--max-right-icon-center-delta':
        options.maxRightIconCenterDelta = Number(readValue(index, arg));
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      default:
        fail(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.maxDelta) || options.maxDelta < 0) {
    fail('--max-delta must be a non-negative number.');
  }
  if (!Number.isFinite(options.titleGap) || options.titleGap < 0) {
    fail('--title-gap must be a non-negative number.');
  }
  if (!Number.isFinite(options.maxTitleGapDelta) || options.maxTitleGapDelta < 0) {
    fail('--max-title-gap-delta must be a non-negative number.');
  }
  if (!Number.isFinite(options.maxTitleCenterDelta) || options.maxTitleCenterDelta < 0) {
    fail('--max-title-center-delta must be a non-negative number.');
  }
  if (!Number.isFinite(options.maxRightIconCenterDelta) || options.maxRightIconCenterDelta < 0) {
    fail('--max-right-icon-center-delta must be a non-negative number.');
  }

  return options;
}

function readPixels(image, crop) {
  const sizeText = run('magick', [image, '-crop', crop, '-format', '%w %h', 'info:']).trim();
  const sizeMatch = sizeText.match(/^(\d+) (\d+)$/);
  if (!sizeMatch) {
    fail(`Could not read cropped image size: ${sizeText}`);
  }
  const width = Number(sizeMatch[1]);
  const height = Number(sizeMatch[2]);
  const raw = runBuffer('magick', [image, '-crop', crop, '-depth', '8', 'rgba:-']);
  const expectedBytes = width * height * 4;
  if (raw.byteLength !== expectedBytes) {
    fail(
      `Unexpected raw pixel byte length: expected ${expectedBytes}, received ${raw.byteLength}.`
    );
  }

  const pixels = [];
  for (let offset = 0; offset < raw.byteLength; offset += 4) {
    const pixelIndex = offset / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const r = raw[offset] ?? 0;
    const g = raw[offset + 1] ?? 0;
    const b = raw[offset + 2] ?? 0;
    const a = raw[offset + 3] ?? 255;
    pixels.push({ x, y, r, g, b, a });
  }

  if (pixels.length === 0) {
    fail('No pixels were parsed from ImageMagick output.');
  }

  return { pixels, width, height };
}

function findComponentsFromActive(active, width) {
  const visited = new Set();
  const components = [];
  const neighbors = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  for (const [startKey, startPixel] of active) {
    if (visited.has(startKey)) {
      continue;
    }

    const queue = [startPixel];
    visited.add(startKey);

    let count = 0;
    let minX = startPixel.x;
    let maxX = startPixel.x;
    let minY = startPixel.y;
    let maxY = startPixel.y;
    let sumX = 0;
    let sumY = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const pixel = queue[index];
      count += 1;
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
      sumX += pixel.x;
      sumY += pixel.y;

      for (const [dx, dy] of neighbors) {
        const key = (pixel.y + dy) * width + pixel.x + dx;
        const nextPixel = active.get(key);
        if (nextPixel && !visited.has(key)) {
          visited.add(key);
          queue.push(nextPixel);
        }
      }
    }

    components.push({
      count,
      minX,
      maxX,
      minY,
      maxY,
      centerX: sumX / count,
      centerY: sumY / count,
    });
  }

  return components.sort((a, b) => b.count - a.count);
}

function findComponents(pixels, width, predicate) {
  const active = new Map();
  for (const pixel of pixels) {
    if (predicate(pixel)) {
      active.set(pixel.y * width + pixel.x, pixel);
    }
  }

  return findComponentsFromActive(active, width);
}

function largestComponent(components, label) {
  const component = components[0];
  if (!component || component.count < 20) {
    fail(`Could not find ${label} traffic-light pixels.`);
  }
  return component;
}

function unionComponents(components) {
  const count = components.reduce((total, component) => total + component.count, 0);
  const minX = Math.min(...components.map((component) => component.minX));
  const maxX = Math.max(...components.map((component) => component.maxX));
  const minY = Math.min(...components.map((component) => component.minY));
  const maxY = Math.max(...components.map((component) => component.maxY));

  return {
    count,
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function colorDistance(left, right) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function pixelAt(pixels, width, x, y) {
  return pixels[y * width + x];
}

function trafficLightComponents(pixels, width) {
  const red = new Map();
  const yellow = new Map();
  const green = new Map();

  for (const pixel of pixels) {
    if (pixel.a <= 0) {
      continue;
    }
    const key = pixel.y * width + pixel.x;
    if (pixel.r > 180 && pixel.g < 150 && pixel.b < 150 && pixel.r - pixel.g > 40) {
      red.set(key, pixel);
    }
    if (pixel.r > 180 && pixel.g > 120 && pixel.b < 120 && pixel.r - pixel.b > 80) {
      yellow.set(key, pixel);
    }
    if (pixel.g > 130 && pixel.r < 140 && pixel.b < 160 && pixel.g - pixel.r > 35) {
      green.set(key, pixel);
    }
  }

  return {
    green: findComponentsFromActive(green, width),
    red: findComponentsFromActive(red, width),
    yellow: findComponentsFromActive(yellow, width),
  };
}

function foregroundClusters({ pixels, width, trafficCenterY, trafficRight }) {
  const background =
    pixelAt(pixels, width, Math.max(0, width - 24), 10) ??
    pixelAt(pixels, width, Math.floor(width / 2), 10) ??
    pixels[0];
  const components = findComponents(
    pixels,
    width,
    (pixel) =>
      pixel.a > 0 &&
      pixel.x > trafficRight + 20 &&
      Math.abs(pixel.y - trafficCenterY) <= 40 &&
      colorDistance(pixel, background) > 80
  )
    .filter(
      (component) =>
        component.count >= 8 &&
        component.maxY >= 16 &&
        component.minY <= 72 &&
        component.maxX < width - 12
    )
    .sort((left, right) => left.minX - right.minX);

  const clusters = [];
  for (const component of components) {
    const previous = clusters.at(-1);
    if (previous && component.minX <= previous.maxX + 12) {
      clusters[clusters.length - 1] = unionComponents([previous, component]);
    } else {
      clusters.push(component);
    }
  }

  return { background, clusters };
}

function measure(
  image,
  crop,
  maxDelta,
  expectedTitleGap,
  maxTitleGapDelta,
  maxTitleCenterDelta,
  maxRightIconCenterDelta
) {
  const { pixels, width } = readPixels(image, crop);
  const trafficComponents = trafficLightComponents(pixels, width);

  const red = largestComponent(trafficComponents.red, 'red');
  const yellow = largestComponent(trafficComponents.yellow, 'yellow');
  const green = largestComponent(trafficComponents.green, 'green');

  const traffic = [red, yellow, green];
  const trafficCenterY =
    traffic.reduce((sum, component) => sum + component.centerY, 0) / traffic.length;
  const trafficRight = Math.max(...traffic.map((component) => component.maxX));
  const scale = Math.max(1, (red.maxX - red.minX + 1) / 14);

  const { background, clusters } = foregroundClusters({
    pixels,
    width,
    trafficCenterY,
    trafficRight,
  });
  const icon = clusters[0];
  const title = clusters.find(
    (cluster, index) => index > 0 && cluster.count >= 20 && cluster.maxX - cluster.minX >= 20
  );

  if (!icon) {
    fail('Could not find the sidebar toggle icon to the right of the traffic lights.');
  }
  if (!title) {
    fail('Could not find the workspace title to the right of the sidebar toggle icon.');
  }
  const rightIcon = clusters
    .slice()
    .reverse()
    .find((cluster) => cluster.minX > title.maxX + 40 && cluster.count >= 8);
  if (!rightIcon) {
    fail('Could not find the right MemoryRail toggle icon.');
  }

  const deltaY = icon.centerY - trafficCenterY;
  const titleGap = (title.minX - icon.maxX) / scale;
  const titleGapDelta = titleGap - expectedTitleGap;
  const iconVisualCenterY = (icon.minY + icon.maxY) / 2;
  const titleVisualCenterY = (title.minY + title.maxY) / 2;
  const rightIconVisualCenterY = (rightIcon.minY + rightIcon.maxY) / 2;
  const titleCenterDelta = (titleVisualCenterY - iconVisualCenterY) / scale;
  const rightIconCenterDelta = (rightIconVisualCenterY - iconVisualCenterY) / scale;
  const passed =
    Math.abs(deltaY) <= maxDelta &&
    Math.abs(titleGapDelta) <= maxTitleGapDelta &&
    Math.abs(titleCenterDelta) <= maxTitleCenterDelta &&
    Math.abs(rightIconCenterDelta) <= maxRightIconCenterDelta;

  return {
    image,
    crop,
    maxDelta,
    expectedTitleGap,
    maxTitleGapDelta,
    maxTitleCenterDelta,
    maxRightIconCenterDelta,
    passed,
    deltaY,
    titleGap,
    titleGapDelta,
    titleCenterDelta,
    rightIconCenterDelta,
    iconVisualCenterY,
    titleVisualCenterY,
    rightIconVisualCenterY,
    scale,
    background,
    traffic: {
      centerY: trafficCenterY,
      right: trafficRight,
      components: { red, yellow, green },
    },
    icon,
    title,
    rightIcon,
  };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`traffic center y: ${result.traffic.centerY.toFixed(2)}px`);
  console.log(`icon center y: ${result.icon.centerY.toFixed(2)}px`);
  console.log(`delta y: ${result.deltaY.toFixed(2)}px`);
  console.log(`title gap: ${result.titleGap.toFixed(2)}css px`);
  console.log(`title gap delta: ${result.titleGapDelta.toFixed(2)}css px`);
  console.log(`title center delta: ${result.titleCenterDelta.toFixed(2)}css px`);
  console.log(`right icon center delta: ${result.rightIconCenterDelta.toFixed(2)}css px`);
  console.log(result.passed ? 'PASS titlebar alignment' : 'FAIL titlebar alignment');
}

function runSelfTest(maxDelta) {
  const dir = mkdtempSync(join(tmpdir(), 'reo-titlebar-alignment-'));
  const image = join(dir, 'synthetic.png');

  try {
    run('magick', [
      '-size',
      '380x96',
      'xc:white',
      '-fill',
      'rgb(255,95,87)',
      '-draw',
      'circle 24,36 24,24',
      '-fill',
      'rgb(255,189,46)',
      '-draw',
      'circle 70,36 70,24',
      '-fill',
      'rgb(40,200,64)',
      '-draw',
      'circle 116,36 116,24',
      '-fill',
      'rgb(74,72,68)',
      '-draw',
      'rectangle 150,24 172,48',
      '-fill',
      'rgb(74,72,68)',
      '-draw',
      'rectangle 201,24 246,48',
      '-fill',
      'rgb(74,72,68)',
      '-draw',
      'rectangle 320,24 342,48',
      image,
    ]);

    return measure(
      image,
      '380x96+0+0',
      maxDelta,
      defaultTitleGap,
      defaultMaxTitleGapDelta,
      defaultMaxTitleCenterDelta,
      defaultMaxRightIconCenterDelta
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

let image = options.image;
if (options.capture) {
  image = options.output || join(tmpdir(), 'reo-titlebar-alignment.png');
  run('screencapture', ['-x', `-R${options.capture}`, image]);
}

if (!options.selfTest && !image) {
  fail('Provide --image <path>, --capture <rect>, or --self-test.');
}

const result = options.selfTest
  ? runSelfTest(options.maxDelta)
  : measure(
      image,
      options.crop,
      options.maxDelta,
      options.titleGap,
      options.maxTitleGapDelta,
      options.maxTitleCenterDelta,
      options.maxRightIconCenterDelta
    );

printResult(result, options.json);

if (!result.passed) {
  process.exit(1);
}
