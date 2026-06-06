# Reo works core design system

Use this reference for every visual Reo work.

## Philosophy

- Seamless: the work should feel like a natural part of Reo content, not an embedded website. Its structural tokens mirror Reo app theme.css (surfaces, zinc text, radius, fonts).
- Layered, not flat-by-stripping: clean comes from typography and hierarchy. Keep restrained elevation (`var(--shadow-card)`) and scale effects down to Reo intensity instead of removing them. Avoid glow, noise, neon and heavy blur; use gradient only as a very faint intentional brand accent.
- Compact: show the essential visual object inline; do not build a marketing page.
- Inline-first: show the useful summary, primary controls and core result before a long scroll. Use sections, compact internal panels, deliberate internal scroll areas, fullscreen affordances or supplements when the work needs depth; do not force every work into one fixed height. Workspace rail widgets must remain usable from 240px to 520px wide.
- Content first: labels, controls and visuals should serve the Memory data or user intent.
- Defaults, not ceilings: these rules are a starting point. Go beyond them when it serves the user and the result stays cohesive with Reo, runnable, and grounded in the Memory.

## HTML structure

- Reo requires complete HTML documents, not fragments.
- Put CSS before content and scripts last so static content is useful immediately.
- Keep CSS short and explicit; use inline style only when it improves first-paint stability.
- Avoid comments, dead template blocks, hidden tab panels, empty carousel slides and unused CSS.

## Typography

- Font stack: `var(--font-sans)` (Waldenburg/Inter brand fonts with system fallbacks); `var(--font-serif)` for reading-heavy or editorial works.
- Body: 14px (reading-heavy works may use 16px), weight 400, line-height 1.6.
- h1: 20px, h2: 18px, h3: 16px, weight 500.
- Weights 300–600 (regular 400, emphasis 500/600); use the heavier and lighter stops sparingly.
- UI labels 12–13px; avoid body text below 11px.
- Use sentence case; avoid all caps and title-case labels.

## Required token block

Start each work with these variables and crop unused selectors only after the design is stable.

```css
:root {
  --color-background-primary: #ffffff;
  --color-background-secondary: #f4f4f5;
  --color-background-tertiary: #ebebed;
  --color-background-info: #e6f1fb;
  --color-background-danger: #fcebeb;
  --color-background-success: #eaf3de;
  --color-background-warning: #faeeda;
  --color-text-primary: #18181b;
  --color-text-secondary: #3f3f46;
  --color-text-tertiary: #71717a;
  --color-text-info: #0c447c;
  --color-text-danger: #791f1f;
  --color-text-success: #27500a;
  --color-text-warning: #633806;
  --color-border-tertiary: rgba(24, 24, 27, 0.08);
  --color-border-secondary: rgba(24, 24, 27, 0.14);
  --color-border-primary: rgba(24, 24, 27, 0.22);
  --font-sans: "Waldenburg", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Songti SC", "Noto Serif CJK SC", ui-serif, Georgia, Cambria, "Times New Roman", serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --border-radius-xl: 20px;
  --shadow-card: 0 1px 2px rgba(17, 24, 39, 0.04), 0 2px 8px rgba(17, 24, 39, 0.05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #09090b;
    --color-background-secondary: #18181b;
    --color-background-tertiary: #1f1f23;
    --color-background-info: #0c447c;
    --color-background-danger: #791f1f;
    --color-background-success: #27500a;
    --color-background-warning: #633806;
    --color-text-primary: #fafafa;
    --color-text-secondary: #d4d4d8;
    --color-text-tertiary: #a1a1aa;
    --color-text-info: #b5d4f4;
    --color-text-danger: #f7c1c1;
    --color-text-success: #c0dd97;
    --color-text-warning: #fac775;
    --color-border-tertiary: rgba(255, 255, 255, 0.10);
    --color-border-secondary: rgba(255, 255, 255, 0.16);
    --color-border-primary: rgba(255, 255, 255, 0.24);
    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 10px rgba(0, 0, 0, 0.34);
  }
}
```

## Color ramps

Use color to encode meaning, not sequence. Prefer purple, teal, coral and pink for categories; reserve blue, green, amber and red for info, success, warning and danger semantics. `c-gray` is the Reo zinc neutral and matches the structural tokens. These are the works palette and are separate from Reo brand colors (red/magenta/ember), which stay reserved for host branding and are not used as work accents. The ramp is a default — derive new stops within a hue when a design needs them.

| Class | 50 | 100 | 200 | 400 | 600 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c-purple` | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |
| `c-teal` | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |
| `c-coral` | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |
| `c-pink` | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |
| `c-gray` | #F4F4F5 | #E4E4E7 | #D4D4D8 | #A1A1AA | #71717A | #3F3F46 | #18181B |
| `c-blue` | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |
| `c-green` | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |
| `c-amber` | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |
| `c-red` | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |

Text on colored fills must use the dark stop from the same ramp, not black or generic gray. If a colored box has title and subtitle, use different stops so hierarchy is visible.

## Sandbox boundaries

- 普通 Web 网络、CDN libraries、remote fonts/images、`fetch`、XHR and module imports are allowed when useful.
- Use documented `window.reo` bridge calls when the work needs Reo state, content, UI, mutations or agent prompt actions.
- Browser storage is allowed per runtime object origin. Keep agent-readable state in `state.json` when future updates need it.
- Never depend on Node, Electron, raw filesystem paths, `file://`, symlinks or `.reo/` internals.
