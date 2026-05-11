import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const surfaceColorContract = {
  light: {
    eggshell: '#fffffc',
    linen: '#fcf9f6',
    powder: '#f1f1f0',
    chalk: '#dedee1',
  },
  dark: {
    eggshell: '#0d0d0d',
    linen: '#161616',
    powder: '#1b1b1c',
    chalk: '#262628',
  },
} as const;

const semanticSurfaceReferences = {
  'page-ground': 'var(--color-eggshell)',
  'sidebar-ground': 'var(--color-linen)',
  'powder-surface': 'var(--color-powder)',
} as const;

const radiusContract = {
  full: '9999px',
  tags: '12px',
  badges: '12px',
  inputs: '12px',
  buttons: '12px',
  panels: '24px',
  cards: '32px',
  modals: '32px',
} as const;

type DesignTokens = {
  color: Record<string, { $value: string }>;
  radius: Record<string, { $value: string }>;
  theme: {
    dark: {
      color: Record<string, { $value: string }>;
      surface: Record<string, { $value: string }>;
    };
  };
  surface: Record<string, { $value: string }>;
};

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function readDesignTokens(): DesignTokens {
  return JSON.parse(readProjectFile('docs/current/design-system/tokens.json')) as DesignTokens;
}

function cssTokenValue(
  css: string,
  tokenPrefix: 'color' | 'radius' | 'surface',
  tokenName: string,
  scope: 'light' | 'dark'
): string {
  const darkMatch = css.match(/\[data-theme='dark'\]\s*{(?<body>[\s\S]*?)\n}/);
  const source = scope === 'dark' ? (darkMatch?.groups?.['body'] ?? '') : css;
  const escapedName = tokenName.replaceAll('-', '\\-');
  const match = source.match(new RegExp(`--${tokenPrefix}-${escapedName}:\\s*([^;]+);`));

  assert.ok(match, `Missing ${scope} token --${tokenPrefix}-${tokenName}`);
  const value = match[1];
  assert.ok(value, `Missing ${scope} token value --${tokenPrefix}-${tokenName}`);
  return value.trim();
}

function parseHexColor(value: string): readonly [number, number, number] {
  const normalized = value.replace('#', '');
  assert.equal(normalized.length, 6, `Expected six-digit hex color, received ${value}`);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function maxChannelDelta(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number {
  return Math.max(
    Math.abs(left[0] - right[0]),
    Math.abs(left[1] - right[1]),
    Math.abs(left[2] - right[2])
  );
}

test('design token source defines the page sidebar and card surface colors', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(surfaceColorContract.light)) {
    assert.equal(tokens.color[name]?.$value, expectedValue, `light ${name}`);
  }

  for (const [name, expectedValue] of Object.entries(surfaceColorContract.dark)) {
    assert.equal(tokens.theme.dark.color[name]?.$value, expectedValue, `dark ${name}`);
  }
});

test('runtime and current design-system CSS project the same surface tokens', () => {
  const tokens = readDesignTokens();
  const cssFiles = [
    'src/renderer/src/theme.css',
    'docs/current/design-system/theme.css',
    'docs/current/design-system/variables.css',
  ] as const;

  for (const path of cssFiles) {
    const css = readProjectFile(path);

    for (const name of Object.keys(surfaceColorContract.light)) {
      assert.equal(cssTokenValue(css, 'color', name, 'light'), tokens.color[name]?.$value, path);
      assert.equal(
        cssTokenValue(css, 'color', name, 'dark'),
        tokens.theme.dark.color[name]?.$value,
        path
      );
    }

    for (const [name, expectedReference] of Object.entries(semanticSurfaceReferences)) {
      assert.equal(cssTokenValue(css, 'surface', name, 'light'), expectedReference, path);
      assert.equal(cssTokenValue(css, 'surface', name, 'dark'), expectedReference, path);
    }
  }
});

test('page and sidebar surfaces remain separate in light and dark themes', () => {
  for (const [scope, colors] of Object.entries(surfaceColorContract)) {
    const pageGround = parseHexColor(colors.eggshell);
    const sidebarGround = parseHexColor(colors.linen);

    assert.ok(
      maxChannelDelta(pageGround, sidebarGround) >= 6,
      `${scope} Page Ground and Sidebar Ground must stay visually distinct`
    );
  }
});

test('ordinary controls use square-rounded radius tokens instead of pill rounding', () => {
  const tokens = readDesignTokens();
  const cssFiles = [
    'src/renderer/src/theme.css',
    'docs/current/design-system/theme.css',
    'docs/current/design-system/variables.css',
  ] as const;

  for (const [name, expectedValue] of Object.entries(radiusContract)) {
    assert.equal(tokens.radius[name]?.$value, expectedValue, `radius ${name}`);
  }

  for (const path of cssFiles) {
    const css = readProjectFile(path);

    for (const [name, expectedValue] of Object.entries(radiusContract)) {
      assert.equal(cssTokenValue(css, 'radius', name, 'light'), expectedValue, path);
    }
  }
});
