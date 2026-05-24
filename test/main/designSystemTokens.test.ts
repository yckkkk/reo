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
  primary: '#18181b',
  'primary-foreground': '#ffffff',
  secondary: '#e5e7eb',
  'secondary-foreground': '#18181b',
  muted: '#f4f4f5',
  'muted-foreground': '#71717a',
  accent: '#e5e7eb',
  'accent-foreground': '#18181b',
  destructive: '#dc2626',
  'destructive-hover': 'color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(24 24 27 / 0.32)',
  border: 'transparent',
  input: '#f4f4f5',
  ring: '#18181b',
  'brand-ember': '#ff4704',
} as const;

const darkColorContract = {
  background: '#09090b',
  foreground: '#fafafa',
  card: '#18181b',
  'card-foreground': '#fafafa',
  popover: '#27272a',
  'popover-foreground': '#fafafa',
  primary: '#fafafa',
  'primary-foreground': '#09090b',
  secondary: '#27272a',
  'secondary-foreground': '#fafafa',
  muted: '#18181b',
  'muted-foreground': '#a1a1aa',
  accent: 'color-mix(in oklab, var(--foreground) 10%, var(--popover))',
  'accent-foreground': '#fafafa',
  destructive: '#ef4444',
  'destructive-hover': 'color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(0 0 0 / 0.62)',
  border: 'transparent',
  input: '#18181b',
  ring: '#fafafa',
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

function cssVariableMap(css: string, scope: 'light' | 'dark'): Map<string, string> {
  const lightMatch = css.match(/:root,\s*\n\[data-theme='light'\]\s*{(?<body>[\s\S]*?)\n}/);
  const darkMatch = css.match(/\[data-theme='dark'\]\s*{(?<body>[\s\S]*?)\n}/);
  const source =
    scope === 'dark' ? (darkMatch?.groups?.['body'] ?? '') : (lightMatch?.groups?.['body'] ?? '');
  const variables = new Map<string, string>();
  for (const match of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) {
      variables.set(name, value.trim());
    }
  }
  return variables;
}

function cssVariableValue(
  variables: ReadonlyMap<string, string>,
  tokenName: string,
  scope: 'light' | 'dark'
): string {
  const value = variables.get(tokenName);

  assert.ok(value, `Missing ${scope} token value --${tokenName}`);
  return value;
}

test('design token source defines compact Soft Flat semantic colors', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(lightColorContract)) {
    assert.equal(tokens.color[name]?.$value, expectedValue, `light ${name}`);
  }

  for (const [name, expectedValue] of Object.entries(darkColorContract)) {
    assert.equal(tokens.dark[name]?.$value, expectedValue, `dark ${name}`);
  }

  assert.equal(tokens.color['brand-blue'], undefined, 'light brand-blue removed');
  assert.equal(tokens.color['brand-spectrum'], undefined, 'light brand-spectrum removed');
  assert.equal(tokens.dark['brand-blue'], undefined, 'dark brand-blue removed');
  assert.equal(tokens.dark['brand-spectrum'], undefined, 'dark brand-spectrum removed');
});

test('runtime and design-system CSS project the same semantic tokens', () => {
  const cssFiles = [
    'src/renderer/src/theme.css',
    'docs/current/design-system/theme.css',
    'docs/current/design-system/variables.css',
  ] as const;

  for (const path of cssFiles) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    const darkVariables = cssVariableMap(css, 'dark');

    for (const [name, expectedValue] of Object.entries(lightColorContract)) {
      assert.equal(cssVariableValue(lightVariables, name, 'light'), expectedValue, path);
    }

    for (const [name, expectedValue] of Object.entries(darkColorContract)) {
      assert.equal(cssVariableValue(darkVariables, name, 'dark'), expectedValue, path);
    }

    assert.doesNotMatch(css, /--brand-blue|--brand-spectrum/, path);
  }
});

test('ordinary control radius stays square-rounded and full radius is reserved', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(radiusContract)) {
    assert.equal(tokens.radius[name]?.$value, expectedValue, `radius ${name}`);
  }

  for (const path of ['src/renderer/src/theme.css', 'docs/current/design-system/theme.css']) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    assert.equal(cssVariableValue(lightVariables, 'radius', 'light'), radiusContract.base, path);
    assert.equal(
      cssVariableValue(lightVariables, 'radius-full', 'light'),
      radiusContract.full,
      path
    );
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
    const lightVariables = cssVariableMap(css, 'light');
    const darkVariables = cssVariableMap(css, 'dark');
    assert.equal(
      cssVariableValue(lightVariables, 'shadow-float', 'light'),
      tokens.shadow['float']?.$value
    );
    assert.equal(
      cssVariableValue(lightVariables, 'shadow-modal', 'light'),
      tokens.shadow['modal']?.$value
    );
    assert.equal(
      cssVariableValue(darkVariables, 'shadow-float', 'dark'),
      tokens.darkShadow['float']?.$value
    );
    assert.equal(
      cssVariableValue(darkVariables, 'shadow-modal', 'dark'),
      tokens.darkShadow['modal']?.$value
    );
  }
});
