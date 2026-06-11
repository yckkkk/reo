#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const REO_SEMANTIC_THEME = Object.freeze({
  tokens: "reo-semantic-v1",
  modes: Object.freeze(["light", "dark"]),
  default: "system",
});

export const REO_SEMANTIC_TOKEN_CHECKS = Object.freeze([
  [/:root,\s*\[data-theme=['"]light['"]\]\s*\{/i, ":root + light theme selector"],
  [/\[data-theme=['"]dark['"]\]\s*\{/i, "dark theme selector"],
  [/:root:not\(\[data-theme\]\)/i, "system dark fallback selector"],
  [/--background:\s*var\(--surface-1\)/, "--background"],
  [/--foreground:\s*#18181b/, "--foreground"],
  [/--card:\s*var\(--surface-2\)/, "--card"],
  [/--popover:\s*var\(--surface-4\)/, "--popover"],
  [/--primary-hover:/, "--primary-hover"],
  [/--secondary:/, "--secondary"],
  [/--muted-foreground:/, "--muted-foreground"],
  [/--accent-foreground:/, "--accent-foreground"],
  [/--destructive-hover:/, "--destructive-hover"],
  [/--scrim:/, "--scrim"],
  [/--border:/, "--border"],
  [/--input:\s*var\(--surface-3\)/, "--input"],
  [/--font-memory-serif:/, "--font-memory-serif"],
  [/--tracking-heading:\s*0/, "--tracking-heading"],
  [/--font-weight-medium:\s*500/, "--font-weight-medium"],
  [/--spacing-160:\s*160px/, "--spacing-160"],
  [/--container-form:\s*720px/, "--container-form"],
  [/--radius-4xl:\s*32px/, "--radius-4xl"],
  [/--shadow-modal:/, "--shadow-modal"],
  [/--shadow-hero-fill:/, "--shadow-hero-fill"],
  [/--shadow-surface-inset:/, "--shadow-surface-inset"],
]);

export async function readReoSemanticTokenCss(scriptDirectory) {
  const referencePath = path.resolve(
    scriptDirectory,
    "../../reo-works-design/references/core-design-system.md"
  );
  const reference = await readFile(referencePath, "utf8");
  const match = /```css\n([\s\S]*?)\n```/.exec(reference);
  if (!match?.[1]) throw new Error("Reo works design token CSS is missing.");
  return `${match[1]}\n`;
}

export function missingReoSemanticTokenLabels(html) {
  return REO_SEMANTIC_TOKEN_CHECKS.filter(([pattern]) => !pattern.test(html)).map(
    ([, label]) => label
  );
}
