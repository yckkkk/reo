# Reo works interaction patterns

Use this reference for lightweight app behavior inside a Reo work.

## Allowed local interactions

- Buttons that toggle local views or advance a stepper.
- Sliders and number inputs with formatted live results.
- Selects, checkboxes and segmented controls for filters or modes.
- Sort and filter controls over data already embedded in the HTML.
- Inline calculations, small simulations, scorecards and review schedules.
- SVG element hover/click when it only changes local state.

## Disallowed interactions

- No invented chat bridge, prompt sending API or host mutation API outside documented `window.reo`.
- No Node/Electron access, raw filesystem paths, `file://`, symlink dependency or `.reo/` internals.
- No unbounded background polling or animation loops.

## Interaction structure

- Static content must still make sense before JS runs.
- Keep controls above the visualization they affect.
- Show current values next to sliders and format them.
- Keep event listeners attached only to actual controls.
- Avoid animation loops. If a transition helps, use CSS transitions under 200ms.
- Never hide most of the content in tabs. If there are many modes, use a stepper or stacked sections.

## Numeric output

- Counts: integer with `Intl.NumberFormat`.
- Percentages: one decimal at most unless precision matters.
- Money: sign before currency for negative values, e.g. `-$5M`.
- Slider values: set `step` so the browser emits sensible values.
- Every computed number that reaches the screen must pass through a formatter.

## Data update model

Works can read the whole workspace summary through `window.reo.workspace.read().workspace.memories`, then call `window.reo.content.readMemoryDetail({ memoryId })` for the Memory details they need. This keeps dashboards and data tools live without exposing raw paths, `.reo/` internals or a generic filesystem bridge.
