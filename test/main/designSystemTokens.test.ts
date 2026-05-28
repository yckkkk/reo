import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const lightColorContract = {
  // Layer 1 · raw brand assets
  'brand-red': '#dc2626',
  'brand-magenta': '#d946ef',
  'brand-ember': '#ff4704',

  // Layer 1 · raw surface elevation
  'surface-1': '#ffffff',
  'surface-2': '#f4f4f5',
  'surface-3': '#ebebed',
  'surface-4': '#ffffff',

  // Layer 2 · semantic shadcn roles
  background: 'var(--surface-1)',
  foreground: '#18181b',
  card: 'var(--surface-2)',
  'card-foreground': '#18181b',
  popover: 'var(--surface-4)',
  'popover-foreground': '#18181b',
  primary: '#18181b',
  'primary-foreground': 'var(--background)',
  'primary-hover': 'color-mix(in oklab, var(--primary) 86%, var(--background))',
  secondary: '#e5e7eb',
  'secondary-foreground': '#18181b',
  muted: 'var(--surface-2)',
  'muted-foreground': '#71717a',
  accent: '#e5e7eb',
  'accent-foreground': '#18181b',
  destructive: '#b91c1c',
  'destructive-hover': 'color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(24 24 27 / 0.32)',
  border: 'transparent',
  input: 'var(--surface-3)',
  ring: 'var(--primary)',
} as const;

const darkColorContract = {
  // Layer 1 · raw brand assets (identical across modes)
  'brand-red': '#dc2626',
  'brand-magenta': '#d946ef',
  'brand-ember': '#ff4704',

  // Layer 1 · raw surface elevation (dark values)
  'surface-1': '#09090b',
  'surface-2': '#18181b',
  'surface-3': '#1f1f23',
  'surface-4': '#27272a',

  // Layer 2 · semantic shadcn roles
  background: 'var(--surface-1)',
  foreground: '#fafafa',
  card: 'var(--surface-2)',
  'card-foreground': '#fafafa',
  popover: 'var(--surface-4)',
  'popover-foreground': '#fafafa',
  primary: '#fafafa',
  'primary-foreground': 'var(--background)',
  'primary-hover': 'color-mix(in oklab, var(--primary) 86%, var(--background))',
  secondary: '#27272a',
  'secondary-foreground': '#fafafa',
  muted: 'var(--surface-2)',
  'muted-foreground': '#a1a1aa',
  accent: 'color-mix(in oklab, var(--foreground) 10%, var(--popover))',
  'accent-foreground': '#fafafa',
  destructive: '#b91c1c',
  'destructive-hover': 'color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))',
  'destructive-foreground': '#ffffff',
  scrim: 'rgb(0 0 0 / 0.62)',
  border: 'transparent',
  input: 'var(--surface-3)',
  ring: 'var(--primary)',
} as const;

const radiusContract = {
  base: '16px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '32px',
  full: '9999px',
} as const;

const shadowContract = {
  float: '0 12px 32px rgb(0 0 0 / 0.08)',
  modal: '0 24px 64px rgb(0 0 0 / 0.12)',
  'hero-lift': '0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6)',
  'hero-fill': '0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14)',
  'hero-inset': 'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12)',
  'hero-edge': 'inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4)',
  'surface-inset': 'inset 0 1px 0 rgb(0 0 0 / 0.02)',
} as const;

const darkShadowContract = {
  float: '0 12px 32px rgb(0 0 0 / 0.4)',
  modal: '0 24px 64px rgb(0 0 0 / 0.6)',
  'hero-lift': '0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06)',
  'hero-fill': '0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14)',
  'hero-inset': 'inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18)',
  'hero-edge': 'inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2)',
  'surface-inset': 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
} as const;

const gradientContract = {
  'brand-gradient-light':
    'linear-gradient(135deg, var(--brand-ember) 0%, var(--brand-red) 50%, var(--brand-magenta) 100%)',
  'brand-gradient-dark':
    'linear-gradient(135deg, color-mix(in oklab, var(--brand-ember) 92%, #09090b) 0%, color-mix(in oklab, var(--brand-red) 92%, #09090b) 50%, color-mix(in oklab, var(--brand-magenta) 92%, #09090b) 100%)',
} as const;

const semanticColorRoles = new Set([
  'accent',
  'accent-foreground',
  'background',
  'border',
  'card',
  'card-foreground',
  'destructive',
  'destructive-foreground',
  'destructive-hover',
  'foreground',
  'input',
  'muted',
  'muted-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'primary-hover',
  'ring',
  'scrim',
  'secondary',
  'secondary-foreground',
]);

const cssTokenFiles = [
  'src/renderer/src/theme.css',
  'docs/current/design-system/theme.css',
  'docs/current/design-system/variables.css',
] as const;

const rendererGlobalCssEntry = 'src/renderer/src/index.css';

type DesignTokens = {
  color: Record<string, { $value: string }>;
  dark: Record<string, { $value: string }>;
  gradient: Record<string, { $value: string }>;
  radius: Record<string, { $value: string }>;
  shadow: Record<string, { $value: string }>;
  darkShadow: Record<string, { $value: string }>;
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
      // Collapse whitespace so multi-line shadow values compare against
      // single-line contract strings.
      variables.set(
        name,
        value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
      );
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

function assertColorTokenNameAllowed(name: string): void {
  if (name.startsWith('brand-')) {
    assert.doesNotMatch(
      name,
      /-(hover|active|disabled)$/,
      `raw brand token cannot carry state: ${name}`
    );
    return;
  }

  if (name.startsWith('surface-')) {
    assert.match(name, /^surface-[1-4]$/, `surface token must use surface-1..4: ${name}`);
    return;
  }

  assert.ok(semanticColorRoles.has(name), `unexpected semantic color token: ${name}`);
}

test('design token source defines red fluid raw layer and neutral semantic controls', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(lightColorContract)) {
    assert.equal(tokens.color[name]?.$value, expectedValue, `light ${name}`);
  }

  for (const [name, expectedValue] of Object.entries(darkColorContract)) {
    assert.equal(tokens.dark[name]?.$value, expectedValue, `dark ${name}`);
  }

  for (const tokenName of [...Object.keys(tokens.color), ...Object.keys(tokens.dark)]) {
    assertColorTokenNameAllowed(tokenName);
    assert.doesNotMatch(
      tokenName,
      /\bgrad\b/,
      `gradient token names use the full word: ${tokenName}`
    );
  }
});

test('renderer Tailwind entry does not source-scan docs or expose ownerless gradient utilities', () => {
  const css = readProjectFile(rendererGlobalCssEntry);

  assert.match(css, /@source\s+not\s+['"]\.\.\/\.\.\/\.\.\/docs['"];/);
  assert.doesNotMatch(css, /@utility\s+bg-brand-gradient\b/);
});

test('runtime and design-system CSS project the same semantic tokens', () => {
  for (const path of cssTokenFiles) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    const darkVariables = cssVariableMap(css, 'dark');

    for (const [name, expectedValue] of Object.entries(lightColorContract)) {
      assert.equal(cssVariableValue(lightVariables, name, 'light'), expectedValue, path);
    }

    for (const [name, expectedValue] of Object.entries(darkColorContract)) {
      assert.equal(cssVariableValue(darkVariables, name, 'dark'), expectedValue, path);
    }

    for (const tokenName of [...lightVariables.keys(), ...darkVariables.keys()]) {
      if (tokenName.startsWith('color-') || tokenName.startsWith('font-')) {
        continue;
      }

      assert.doesNotMatch(tokenName, /^brand-.+-(hover|active|disabled)$/, path);
      assert.doesNotMatch(tokenName, /\bgrad\b/, path);
    }
  }
});

test('radius scale includes squircle Hero sizes and full radius is reserved', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(radiusContract)) {
    assert.equal(tokens.radius[name]?.$value, expectedValue, `radius ${name}`);
  }

  for (const path of cssTokenFiles) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    assert.equal(cssVariableValue(lightVariables, 'radius', 'light'), radiusContract.base, path);
    assert.equal(
      cssVariableValue(lightVariables, 'radius-3xl', 'light'),
      radiusContract['3xl'],
      path
    );
    assert.equal(
      cssVariableValue(lightVariables, 'radius-4xl', 'light'),
      radiusContract['4xl'],
      path
    );
    assert.equal(
      cssVariableValue(lightVariables, 'radius-full', 'light'),
      radiusContract.full,
      path
    );
  }
});

test('floating and hero shadows are defined with light and dark variants', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(shadowContract)) {
    assert.equal(tokens.shadow[name]?.$value, expectedValue, `light shadow ${name}`);
  }

  for (const [name, expectedValue] of Object.entries(darkShadowContract)) {
    assert.equal(tokens.darkShadow[name]?.$value, expectedValue, `dark shadow ${name}`);
  }

  for (const path of cssTokenFiles) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    const darkVariables = cssVariableMap(css, 'dark');

    for (const [name, expectedValue] of Object.entries(shadowContract)) {
      assert.equal(
        cssVariableValue(lightVariables, `shadow-${name}`, 'light'),
        expectedValue,
        `${path} light shadow ${name}`
      );
    }

    for (const [name, expectedValue] of Object.entries(darkShadowContract)) {
      assert.equal(
        cssVariableValue(darkVariables, `shadow-${name}`, 'dark'),
        expectedValue,
        `${path} dark shadow ${name}`
      );
    }
  }
});

test('brand gradient is exposed as a CSS variable, not as a raw color', () => {
  const tokens = readDesignTokens();

  for (const [name, expectedValue] of Object.entries(gradientContract)) {
    assert.equal(tokens.gradient[name]?.$value, expectedValue, `gradient ${name}`);
  }

  for (const path of cssTokenFiles) {
    const css = readProjectFile(path);
    const lightVariables = cssVariableMap(css, 'light');
    const darkVariables = cssVariableMap(css, 'dark');

    const lightGradient = cssVariableValue(lightVariables, 'brand-gradient', 'light');
    const darkGradient = cssVariableValue(darkVariables, 'brand-gradient', 'dark');

    assert.match(
      lightGradient,
      /^linear-gradient\(/,
      `${path} light --brand-gradient must be a linear-gradient`
    );
    assert.match(
      darkGradient,
      /^linear-gradient\(/,
      `${path} dark --brand-gradient must be a linear-gradient`
    );
    assert.notEqual(
      lightGradient,
      darkGradient,
      `${path} dark gradient must reduce saturation vs light`
    );
    assert.equal(lightGradient, tokens.gradient['brand-gradient-light']?.$value, path);
    assert.equal(darkGradient, tokens.gradient['brand-gradient-dark']?.$value, path);
  }
});
