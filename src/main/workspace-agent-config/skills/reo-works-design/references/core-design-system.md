# Reo works core design system

Use this reference for every visual Reo work, workspace rail widget and home component.

## Philosophy

- Seamless frame, expressive content: the outer frame, controls, cards, tabs, lists and standard UI chrome use the same semantic tokens as Reo app `theme.css`. The inner creative canvas can use its own palette when that serves the work.
- Layered, not flat-by-stripping: clean comes from typography, spacing and hierarchy. Keep restrained elevation with `var(--shadow-float)` and Reo surface tokens. Avoid glow, noise, neon and heavy blur.
- Compact: show the essential visual object inline; do not build a marketing page.
- Inline-first: show the useful summary, primary controls and core result before a long scroll. Use sections, compact internal panels, deliberate internal scroll areas, fullscreen affordances or supplements when the work needs depth. Workspace rail widgets must remain usable from 240px to 520px wide. Long metadata strings in rail widgets must wrap or ellipsize; never let memory names, topic lists or notes clip off the right edge.
- Content first: labels, controls and visuals should serve the Memory data or user intent.
- Defaults, not ceilings: these rules are a starting point. Go beyond them when it serves the user and the result stays cohesive with Reo, runnable, and grounded in the Memory.

## HTML structure

- Reo requires complete HTML documents, not fragments.
- Put CSS before content and scripts last so static content is useful immediately.
- Keep CSS short and explicit; use inline style only when it improves first-paint stability.
- Avoid comments, dead template blocks, hidden tab panels, empty carousel slides and unused CSS.

## Typography

- Font stack: `var(--font-sans)` for UI and compact works; `var(--font-memory-serif)` for reading-heavy or editorial works.
- Body: `var(--text-body)` with `var(--leading-body)`; reading-heavy works may use `var(--text-body-lg)`.
- h1: `var(--text-heading-sm)`, h2: `var(--text-subheading)`, h3: 16px, weight 500.
- Weights 300-600 (regular 400, emphasis 500/600); use the heavier and lighter stops sparingly.
- UI labels use `var(--text-ui-sm)` or `var(--text-ui-md)`; avoid body text below 11px.
- Use sentence case; avoid all caps and title-case labels.

## Required token block

Start each work with this exact Reo semantic variable block for its frame and standard components. Do not rename it, abbreviate it, hand-copy only selected variables, or replace it with older private background, text or radius aliases. Creative content inside a chart, illustration, game scene, map, artwork or data visualization may define its own scoped palette after this block.

```css
:root,
[data-theme='light'] {
  color-scheme: light;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient-from: #ff6a33;
  --brand-gradient-via: #ef4444;
  --brand-gradient-to: #e879f9;
  --brand-gradient: linear-gradient(
    135deg,
    var(--brand-gradient-from) 0%,
    var(--brand-gradient-via) 50%,
    var(--brand-gradient-to) 100%
  );

  --surface-1: #ffffff;
  --surface-2: #f4f4f5;
  --surface-3: #ebebed;
  --surface-4: #ffffff;

  --background: var(--surface-1);
  --foreground: #18181b;
  --card: var(--surface-2);
  --card-foreground: #18181b;
  --popover: var(--surface-4);
  --popover-foreground: #18181b;
  --primary: #18181b;
  --primary-foreground: var(--background);
  --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
  --secondary: #dfe3e8;
  --secondary-foreground: #18181b;
  --muted: var(--surface-2);
  --muted-foreground: #71717a;
  --accent: #d4d9e0;
  --accent-foreground: #18181b;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(24 24 27 / 0.32);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--primary);

  --font-sans: 'Waldenburg', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-memory-serif: 'Songti SC', STSong, 'Noto Serif CJK SC', serif;

  --tracking-heading: 0;
  --tracking-heading-lg: 0;
  --tracking-display: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;

  --text-caption: 10px;
  --leading-caption: 1.4;
  --text-ui-xs: 11px;
  --leading-ui-xs: 1.5;
  --text-ui-sm: 12px;
  --leading-ui-sm: 1.6;
  --text-ui-md: 13px;
  --leading-ui-md: 1.6;
  --text-body: 14px;
  --leading-body: 1.6;
  --text-body-lg: 16px;
  --leading-body-lg: 1.6;
  --text-subheading: 18px;
  --leading-subheading: 1.5;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 32px;
  --leading-heading: 1.2;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.2;
  --text-display: 48px;
  --leading-display: 1.1;

  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-96: 96px;
  --spacing-160: 160px;

  --container-form: 720px;

  --radius: 16px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;
  --radius-full: 9999px;

  --shadow-float:
    0 16px 48px rgb(17 24 39 / 0.04), 0 12px 24px rgb(17 24 39 / 0.04),
    0 6px 8px rgb(17 24 39 / 0.02), 0 2px 3px rgb(17 24 39 / 0.02);
  --shadow-modal:
    0 32px 64px rgb(17 24 39 / 0.08), 0 16px 32px rgb(17 24 39 / 0.06),
    0 8px 16px rgb(17 24 39 / 0.04), 0 2px 4px rgb(17 24 39 / 0.03);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4);
  --shadow-surface-inset: inset 0 1px 0 rgb(0 0 0 / 0.02);
}

[data-theme='dark'] {
  color-scheme: dark;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient-from: color-mix(in oklab, var(--brand-ember) 92%, var(--surface-1));
  --brand-gradient-via: color-mix(in oklab, var(--brand-red) 92%, var(--surface-1));
  --brand-gradient-to: color-mix(in oklab, var(--brand-magenta) 92%, var(--surface-1));

  --surface-1: #09090b;
  --surface-2: #18181b;
  --surface-3: #1f1f23;
  --surface-4: #27272a;

  --background: var(--surface-1);
  --foreground: #fafafa;
  --card: var(--surface-2);
  --card-foreground: #fafafa;
  --popover: var(--surface-4);
  --popover-foreground: #fafafa;
  --primary: #fafafa;
  --primary-foreground: var(--background);
  --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: var(--surface-2);
  --muted-foreground: #a1a1aa;
  --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
  --accent-foreground: #fafafa;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(0 0 0 / 0.62);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--primary);

  --shadow-float:
    0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22),
    0 2px 3px rgb(0 0 0 / 0.12);
  --shadow-modal:
    0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28),
    0 2px 4px rgb(0 0 0 / 0.16);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
  --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;

    --brand-gradient-from: color-mix(in oklab, var(--brand-ember) 92%, var(--surface-1));
    --brand-gradient-via: color-mix(in oklab, var(--brand-red) 92%, var(--surface-1));
    --brand-gradient-to: color-mix(in oklab, var(--brand-magenta) 92%, var(--surface-1));

    --surface-1: #09090b;
    --surface-2: #18181b;
    --surface-3: #1f1f23;
    --surface-4: #27272a;

    --background: var(--surface-1);
    --foreground: #fafafa;
    --card: var(--surface-2);
    --card-foreground: #fafafa;
    --popover: var(--surface-4);
    --popover-foreground: #fafafa;
    --primary: #fafafa;
    --primary-foreground: var(--background);
    --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
    --secondary: #27272a;
    --secondary-foreground: #fafafa;
    --muted: var(--surface-2);
    --muted-foreground: #a1a1aa;
    --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
    --accent-foreground: #fafafa;
    --destructive: #b91c1c;
    --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
    --destructive-foreground: #ffffff;
    --scrim: rgb(0 0 0 / 0.62);
    --border: transparent;
    --input: var(--surface-3);
    --ring: var(--primary);

    --shadow-float:
      0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22),
      0 2px 3px rgb(0 0 0 / 0.12);
    --shadow-modal:
      0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28),
      0 2px 4px rgb(0 0 0 / 0.16);
    --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
    --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
    --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
    --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
    --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
  }
}
```

Common component rules:

- Page/background: `background: var(--background); color: var(--foreground);`.
- Border: prefer subtle separation with `box-shadow: var(--shadow-surface-inset)` or `outline: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent)`.
- Card: `background: var(--card); color: var(--card-foreground); border-radius: var(--radius-lg); box-shadow: var(--shadow-float); padding: var(--spacing-16);`.
- Control surface: `background: var(--input); color: var(--foreground); border-radius: var(--radius-md);`.
- Focus ring: `outline: 2px solid var(--ring); outline-offset: 2px;`.

## Frame And Content Color

Use Reo semantic tokens for the frame:

- Primary action or selected state: `var(--primary)` with `var(--primary-foreground)`.
- Quiet selected state: `color-mix(in oklab, var(--primary) 12%, var(--background))`.
- Positive/progress signal: `color-mix(in oklab, var(--primary) 70%, var(--background))`.
- Warning/negative signal: `var(--destructive)` or `color-mix(in oklab, var(--destructive) 16%, var(--background))`.
- Disabled or secondary signal: `var(--muted-foreground)`.

Creative content is different. A painting, cover-like artwork, game canvas, chart series, map layer or illustrative diagram may use bespoke colors, gradients, textures, photos or generated assets. Keep those choices scoped to the content layer, preserve readable text contrast, and provide either mode-specific values or an intentional same-in-both-modes treatment. Do not let creative palettes replace the frame tokens for buttons, inputs, tabs, cards or page surfaces.

## Sandbox boundaries

- 普通 Web 网络、CDN libraries、remote fonts/images、`fetch`, XHR and module imports are allowed when useful.
- Use documented `window.reo` bridge calls when the work needs Reo state, content, UI, mutations or agent prompt actions.
- Browser storage is allowed per runtime object origin. Keep agent-readable state in `state.json` when future updates need it.
- Never depend on Node, Electron, raw filesystem paths, `file://`, symlinks or `.reo/` internals.
