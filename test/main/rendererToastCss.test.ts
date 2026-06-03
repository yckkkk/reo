import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rendererCss = readFileSync('src/renderer/src/index.css', 'utf8');

function cssRuleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rendererCss.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`));

  assert.ok(match?.groups?.['body'], `Missing CSS rule for ${selector}`);
  return match.groups['body'];
}

function cssRuleBodyContaining(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rendererCss.match(new RegExp(`[^{}]*${escapedSelector}[^{}]*\\{(?<body>[^}]*)\\}`));

  assert.ok(match?.groups?.['body'], `Missing CSS rule containing ${selector}`);
  return match.groups['body'];
}

function cssRuleBodiesContaining(selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Array.from(
    rendererCss.matchAll(new RegExp(`[^{}]*${escapedSelector}[^{}]*\\{(?<body>[^}]*)\\}`, 'g'))
  ).map((match) => match.groups?.['body'] ?? '');
}

test('toast interactive controls keep Reo colour transitions instead of Sonner opacity', () => {
  const controlsRule = cssRuleBodyContaining('[data-sonner-toast] [data-button]');

  assert.match(controlsRule, /transition:/);
  assert.match(controlsRule, /color 150ms ease-out/);
  assert.match(controlsRule, /background-color 150ms ease-out/);
  assert.doesNotMatch(controlsRule, /opacity 400ms/);
});

test('undo toast progress uses semantic tokens instead of raw colour mixes', () => {
  const trackRule = cssRuleBody('.reo-undo-toast::before');
  const fillRule = cssRuleBodiesContaining('.reo-undo-toast::after').find((body) =>
    /background:\s*var\(--primary\)/.test(body)
  );

  assert.match(trackRule, /background:\s*var\(--accent\)/);
  assert.ok(fillRule, 'Missing semantic primary fill rule for undo toast progress');
  assert.match(fillRule, /animation:\s*reo-toast-progress var\(--reo-toast-duration, 5000ms\)/);
  assert.doesNotMatch(trackRule, /color-mix/);
  assert.doesNotMatch(fillRule, /color-mix/);
});
