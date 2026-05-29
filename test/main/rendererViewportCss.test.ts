import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const rendererIndexCss = readFileSync(join(process.cwd(), 'src/renderer/src/index.css'), 'utf8');

test('renderer root CSS gives the app shell a definite non-scrolling viewport box', () => {
  assert.match(rendererIndexCss, /html,\s*body,\s*#root\s*{[\s\S]*height:\s*100%;/);
  assert.match(rendererIndexCss, /html,\s*body,\s*#root\s*{[\s\S]*min-height:\s*100%;/);
  assert.match(rendererIndexCss, /html,\s*body,\s*#root\s*{[\s\S]*overflow:\s*hidden;/);
});

test('renderer root CSS defines reusable edge fade and hover scrollbar utilities', () => {
  assert.match(rendererIndexCss, /@utility\s+edge-fade-y\s*{/);
  assert.match(rendererIndexCss, /edge-fade-y[\s\S]*mask-image:\s*linear-gradient\(\s*to bottom,/);
  assert.match(rendererIndexCss, /@utility\s+edge-fade-x\s*{/);
  assert.match(rendererIndexCss, /edge-fade-x[\s\S]*mask-image:\s*linear-gradient\(\s*to right,/);
  assert.match(rendererIndexCss, /@utility\s+scrollbar-hover\s*{/);
  assert.match(rendererIndexCss, /scrollbar-hover[\s\S]*scrollbar-width:\s*none;/);
  assert.match(rendererIndexCss, /scrollbar-hover[\s\S]*&:hover[\s\S]*scrollbar-width:\s*thin;/);
});

test('renderer float-surface and tab motion are defined', () => {
  assert.match(rendererIndexCss, /@keyframes\s+reo-float-in\s*{/);
  assert.match(rendererIndexCss, /@keyframes\s+reo-float-out\s*{/);
  assert.match(rendererIndexCss, /@utility\s+reo-float-motion\s*{/);
  assert.match(rendererIndexCss, /reo-float-in\s+150ms\s+cubic-bezier/);
  assert.match(rendererIndexCss, /reo-content-tab-panel-motion[\s\S]*300ms\s+cubic-bezier/);
});
