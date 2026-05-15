import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('renderer root CSS gives the app shell a definite non-scrolling viewport box', () => {
  const css = readFileSync(join(process.cwd(), 'src/renderer/src/index.css'), 'utf8');

  assert.match(css, /html,\s*body,\s*#root\s*{[\s\S]*height:\s*100%;/);
  assert.match(css, /html,\s*body,\s*#root\s*{[\s\S]*min-height:\s*100%;/);
  assert.match(css, /html,\s*body,\s*#root\s*{[\s\S]*overflow:\s*hidden;/);
});

test('renderer root CSS defines reusable edge fade and hover scrollbar utilities', () => {
  const css = readFileSync(join(process.cwd(), 'src/renderer/src/index.css'), 'utf8');

  assert.match(css, /@utility\s+edge-fade-y\s*{/);
  assert.match(css, /edge-fade-y[\s\S]*mask-image:\s*linear-gradient\(\s*to bottom,/);
  assert.match(css, /@utility\s+edge-fade-x\s*{/);
  assert.match(css, /edge-fade-x[\s\S]*mask-image:\s*linear-gradient\(\s*to right,/);
  assert.match(css, /@utility\s+scrollbar-hover\s*{/);
  assert.match(css, /scrollbar-hover[\s\S]*scrollbar-width:\s*none;/);
  assert.match(css, /scrollbar-hover[\s\S]*&:hover[\s\S]*scrollbar-width:\s*thin;/);
});

test('renderer tab and menu motion stays aligned with the tab demo', () => {
  const css = readFileSync(join(process.cwd(), 'src/renderer/src/index.css'), 'utf8');

  assert.match(css, /@keyframes\s+reo-dropdown-menu-enter\s*{/);
  assert.match(css, /@utility\s+reo-dropdown-menu-enter\s*{/);
  assert.match(css, /reo-dropdown-menu-enter[\s\S]*150ms\s+ease-out/);
  assert.match(css, /reo-content-tab-panel-motion[\s\S]*300ms\s+cubic-bezier/);
});
