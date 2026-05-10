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
