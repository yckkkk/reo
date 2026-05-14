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

test('toast action hover keeps the soft flat surface without an inset border', () => {
  const baseRule = cssRuleBody('.reo-toast-action');
  const hoverRule = cssRuleBody('.reo-toast-action:hover');

  assert.match(baseRule, /background-color:\s*transparent/);
  assert.match(baseRule, /box-shadow:\s*none/);
  assert.doesNotMatch(baseRule, /color-mix/);
  assert.match(hoverRule, /background-color:\s*color-mix/);
  assert.doesNotMatch(hoverRule, /box-shadow/);
});
