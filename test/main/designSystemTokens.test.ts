import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const lightColorContract = {
  background: '#ffffff',
  foreground: '#18181b',
  card: '#f4f4f5',
  'card-foreground': '#18181b',
  popover: '#ffffff',
  'popover-foreground': '#18181b',
  primary: '#0447ff',
  'primary-foreground': '#ffffff',
  secondary: '#e5e7eb',
  'secondary-foreground': '#18181b',
  muted: '#f4f4f5',
  'muted-foreground': '#71717a',
  accent: '#e5e7eb',
  'accent-foreground': '#18181b',
  destructive: '#ff4704',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(24 24 27 / 0.32)',
  border: 'transparent',
  input: '#f4f4f5',
  ring: '#0447ff',
  'brand-blue': '#0447ff',
  'brand-spectrum': '#3d75d8',
  'brand-ember': '#ff4704',
} as const;

const darkColorContract = {
  background: '#09090b',
  foreground: '#fafafa',
  card: '#18181b',
  'card-foreground': '#fafafa',
  popover: '#27272a',
  'popover-foreground': '#fafafa',
  primary: '#3d75d8',
  'primary-foreground': '#ffffff',
  secondary: '#27272a',
  'secondary-foreground': '#fafafa',
  muted: '#18181b',
  'muted-foreground': '#a1a1aa',
  accent: '#27272a',
  'accent-foreground': '#fafafa',
  destructive: '#ff4704',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(0 0 0 / 0.62)',
  border: 'transparent',
  input: '#18181b',
  ring: '#3d75d8',
  'brand-blue': '#0447ff',
  'brand-spectrum': '#3d75d8',
  'brand-ember': '#ff4704',
} as const;

const radiusContract = {
  base: '16px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const;

type DesignTokens = {
  color: Record<string, { $value: string }>;
  darkShadow: Record<string, { $value: string }>;
  dark: Record<string, { $value: string }>;
  radius: Record<string, { $value: string }>;
  shadow: Record<string, { $value: string }>;
};

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function readDesignTokens(): DesignTokens {
  return JSON.parse(readProjectFile('docs/current/design-system/tokens.json')) as DesignTokens;
}

function cssVariableValue(css: string, tokenName: string, scope: 'light' | 'dark'): string {
  const lightMatch = css.match(/:root,\s*\n\[data-theme='light'\]\s*{(?<body>[\s\S]*?)\n}/);
  const darkMatch = css.match(/\[data-theme='dark'\]\s*{(?<body>[\s\S]*?)\n}/);
  const source =
    scope === 'dark' ? (darkMatch?.groups?.['body'] ?? '') : (lightMatch?.groups?.['body'] ?? '');
  const escapedName = tokenName.replaceAll('-', '\\-');
  const match = source.match(new RegExp(`--${escapedName}:\\s*([^;]+);`));

  assert.ok(match, `Missing ${scope} token --${tokenName}`);
  const value = match[1];
  assert.ok(value, `Missing ${scope} token value --${tokenName}`);
  return value.trim();
}

test('design token source defines compact Soft Flat semantic colors', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(lightColorContract)) {
    assert.equal(tokens.color[name]?.$value, expectedValue, `light ${name}`);
  }

  for (const [name, expectedValue] of Object.entries(darkColorContract)) {
    assert.equal(tokens.dark[name]?.$value, expectedValue, `dark ${name}`);
  }
});

test('runtime and design-system CSS project the same semantic tokens', () => {
  const cssFiles = [
    'src/renderer/src/theme.css',
    'docs/current/design-system/theme.css',
    'docs/current/design-system/variables.css',
  ] as const;

  for (const path of cssFiles) {
    const css = readProjectFile(path);

    for (const [name, expectedValue] of Object.entries(lightColorContract)) {
      assert.equal(cssVariableValue(css, name, 'light'), expectedValue, path);
    }

    for (const [name, expectedValue] of Object.entries(darkColorContract)) {
      assert.equal(cssVariableValue(css, name, 'dark'), expectedValue, path);
    }
  }
});

test('ordinary control radius stays square-rounded and full radius is reserved', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(radiusContract)) {
    assert.equal(tokens.radius[name]?.$value, expectedValue, `radius ${name}`);
  }

  for (const path of ['src/renderer/src/theme.css', 'docs/current/design-system/theme.css']) {
    const css = readProjectFile(path);
    assert.equal(cssVariableValue(css, 'radius', 'light'), radiusContract.base, path);
    assert.equal(cssVariableValue(css, 'radius-full', 'light'), radiusContract.full, path);
  }
});

test('floating shadows are scoped and include dark elevation values', () => {
  const tokens = readDesignTokens();

  assert.equal(tokens.shadow['float']?.$value, '0 12px 32px rgb(0 0 0 / 0.08)');
  assert.equal(tokens.shadow['modal']?.$value, '0 24px 64px rgb(0 0 0 / 0.12)');
  assert.equal(tokens.darkShadow['float']?.$value, '0 12px 32px rgb(0 0 0 / 0.4)');
  assert.equal(tokens.darkShadow['modal']?.$value, '0 24px 64px rgb(0 0 0 / 0.6)');

  for (const path of ['src/renderer/src/theme.css', 'docs/current/design-system/theme.css']) {
    const css = readProjectFile(path);
    assert.equal(cssVariableValue(css, 'shadow-float', 'light'), tokens.shadow['float']?.$value);
    assert.equal(cssVariableValue(css, 'shadow-modal', 'light'), tokens.shadow['modal']?.$value);
    assert.equal(cssVariableValue(css, 'shadow-float', 'dark'), tokens.darkShadow['float']?.$value);
    assert.equal(cssVariableValue(css, 'shadow-modal', 'dark'), tokens.darkShadow['modal']?.$value);
  }
});
