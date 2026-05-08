#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const defaultCrop = '420x120+0+0';
const defaultMaxDelta = 1;

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

function parseArgs(argv) {
  const options = {
    crop: defaultCrop,
    maxDelta: defaultMaxDelta,
    json: false,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--image':
        options.image = next;
        index += 1;
        break;
      case '--capture':
        options.capture = next;
        index += 1;
        break;
      case '--output':
        options.output = next;
        index += 1;
        break;
      case '--crop':
        options.crop = next;
        index += 1;
        break;
      case '--max-delta':
        options.maxDelta = Number(next);
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

  return options;
}

function parsePixels(text) {
  const pixels = [];
  let width = 0;
  let height = 0;

  for (const line of text.split('\n')) {
    const match = line.match(/^(\d+),(\d+): \(([^)]+)\)/);
    if (!match) {
      continue;
    }

    const x = Number(match[1]);
    const y = Number(match[2]);
    const channels = match[3].split(',').map((value) => Number.parseFloat(value.trim()));
    const [r = 0, g = 0, b = 0, a = 255] = channels.map((value) =>
      value > 255 ? value / 257 : value
    );

    width = Math.max(width, x + 1);
    height = Math.max(height, y + 1);
    pixels.push({ x, y, r, g, b, a });
  }

  if (pixels.length === 0) {
    fail('No pixels were parsed from ImageMagick output.');
  }

  return { pixels, width, height };
}

function findComponents(pixels, width, predicate) {
  const active = new Map();
  for (const pixel of pixels) {
    if (predicate(pixel)) {
      active.set(pixel.y * width + pixel.x, pixel);
    }
  }

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

function measure(image, crop, maxDelta) {
  const text = run('magick', [image, '-crop', crop, 'txt:-']);
  const { pixels, width } = parsePixels(text);

  const red = largestComponent(
    findComponents(
      pixels,
      width,
      (pixel) =>
        pixel.a > 0 && pixel.r > 180 && pixel.g < 150 && pixel.b < 150 && pixel.r - pixel.g > 40
    ),
    'red'
  );
  const yellow = largestComponent(
    findComponents(
      pixels,
      width,
      (pixel) =>
        pixel.a > 0 && pixel.r > 180 && pixel.g > 120 && pixel.b < 120 && pixel.r - pixel.b > 80
    ),
    'yellow'
  );
  const green = largestComponent(
    findComponents(
      pixels,
      width,
      (pixel) =>
        pixel.a > 0 && pixel.g > 130 && pixel.r < 140 && pixel.b < 160 && pixel.g - pixel.r > 35
    ),
    'green'
  );

  const traffic = [red, yellow, green];
  const trafficCenterY =
    traffic.reduce((sum, component) => sum + component.centerY, 0) / traffic.length;
  const trafficRight = Math.max(...traffic.map((component) => component.maxX));

  const darkComponents = findComponents(
    pixels,
    width,
    (pixel) => pixel.a > 0 && pixel.r < 125 && pixel.g < 125 && pixel.b < 125
  ).filter(
    (component) =>
      component.count >= 8 &&
      component.minX > trafficRight + 20 &&
      Math.abs(component.centerY - trafficCenterY) <= 32
  );

  if (darkComponents.length === 0) {
    fail('Could not find a dark titlebar icon component to the right of the traffic lights.');
  }

  const iconLeft = Math.min(...darkComponents.map((component) => component.minX));
  const icon = unionComponents(
    darkComponents.filter((component) => component.minX <= iconLeft + 72)
  );
  const deltaY = icon.centerY - trafficCenterY;
  const passed = Math.abs(deltaY) <= maxDelta;

  return {
    image,
    crop,
    maxDelta,
    passed,
    deltaY,
    traffic: {
      centerY: trafficCenterY,
      right: trafficRight,
      components: { red, yellow, green },
    },
    icon,
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
  console.log(result.passed ? 'PASS titlebar alignment' : 'FAIL titlebar alignment');
}

function runSelfTest(maxDelta) {
  const dir = mkdtempSync(join(tmpdir(), 'reo-titlebar-alignment-'));
  const image = join(dir, 'synthetic.png');

  try {
    run('magick', [
      '-size',
      '260x96',
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
      image,
    ]);

    return measure(image, '260x96+0+0', maxDelta);
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
  : measure(image, options.crop, options.maxDelta);

printResult(result, options.json);

if (!result.passed) {
  process.exit(1);
}
