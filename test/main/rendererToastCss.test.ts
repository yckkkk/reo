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

test('renderer statically imports Sonner layout CSS for production CSP', () => {
  assert.match(rendererCss, /@import\s+['"]sonner\/dist\/styles\.css['"];/);
});

test('renderer statically defines SpeedDial mechanics CSS for production CSP', () => {
  const rootRule = cssRuleBody("[data-slot='floating-action-button-speed-dial-root']");
  const listRule = cssRuleBody(
    "[data-slot='floating-action-button-speed-dial-root'] .p-speeddial-list"
  );
  const itemRule = cssRuleBody(
    "[data-slot='floating-action-button-speed-dial-root'] .p-speeddial-item"
  );
  const openedItemRule = cssRuleBody(
    "[data-slot='floating-action-button-speed-dial-root'].p-speeddial-opened .p-speeddial-item"
  );

  assert.match(rootRule, /position:\s*absolute/);
  assert.match(rootRule, /display:\s*flex/);
  assert.match(listRule, /display:\s*flex/);
  assert.match(listRule, /pointer-events:\s*none/);
  assert.match(itemRule, /position:\s*absolute/);
  assert.match(itemRule, /transform:\s*scale\(0\)/);
  assert.match(openedItemRule, /transform:\s*scale\(1\)/);
});

test('renderer statically defines Vaul drawer mechanics CSS for production CSP', () => {
  const drawerRule = cssRuleBody('[data-vaul-drawer]');
  const bottomOpenRule = cssRuleBody(
    "[data-vaul-drawer][data-vaul-snap-points='false'][data-vaul-drawer-direction='bottom'][data-state='open']"
  );
  const overlayRule = cssRuleBody("[data-vaul-overlay][data-vaul-snap-points='false']");

  assert.match(drawerRule, /touch-action:\s*none/);
  assert.match(drawerRule, /will-change:\s*transform/);
  assert.match(bottomOpenRule, /animation-name:\s*vaul-slide-from-bottom/);
  assert.match(overlayRule, /animation-duration:\s*0\.5s/);
  assert.match(rendererCss, /@keyframes\s+vaul-slide-from-bottom/);
});

test('renderer statically defines ProseMirror core CSS for production CSP', () => {
  const proseMirrorRule = cssRuleBody('.ProseMirror');
  const gapCursorRule = cssRuleBody('.ProseMirror-gapcursor');

  assert.match(proseMirrorRule, /position:\s*relative/);
  assert.match(proseMirrorRule, /white-space:\s*break-spaces/);
  assert.match(gapCursorRule, /pointer-events:\s*none/);
  assert.match(rendererCss, /@keyframes\s+ProseMirror-cursor-blink/);
});

test('LightweightMarkdownEditorSurface disables Tiptap runtime CSS injection', () => {
  const source = readFileSync(
    'src/renderer/src/workspace/LightweightMarkdownEditorSurface.tsx',
    'utf8'
  );

  assert.match(source, /injectCSS:\s*false/);
});

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
