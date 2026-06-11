# Reo runtime templates

Pick one dominant template family. Do not combine everything into one work.

- report: structured narrative with sections, evidence and short conclusions.
- explainer / explorable: a concept walkthrough, or a source->derive->render reactive model where 1-2 source variables drive a live chart (slider/stepper/drag/zoom/toggle). For these, read skills/reo-works-design/references/explorables.md and the runnable skills/reo-works-design/examples/.
- dashboard: metric cards, chart/table and action list.
- editor: focused text, checklist, rubric or planning surface.
- spaced review: schedule table, due states, review controls and progress store.
- todo: task list with `state.json` persistence and visible progress.
- game: small local learning or reflection game with bounded state.
- gallery: image/media grid or timeline using copied local assets.
- map: conceptual, geographic or relationship map.
- prototype: product UI mockup or clickable flow.
- data tool: filter, sort, calculator or converter grounded in Memory data.

Start with the closest family, ship a runnable bundle, then add only the interactions the user asked for.

## Theme contract

Every scaffolded work, workspace rail widget and home component should declare the template theme in `runtime.json`:

```json
"theme": { "tokens": "reo-semantic-v1", "modes": ["light", "dark"], "default": "system" }
```

Use the full token block from `skills/reo-works-design/references/core-design-system.md` for the standard UI frame: page surface, cards, buttons, inputs, tabs, lists, popovers, focus rings, spacing, radius and shadows. Do not hand-write an abbreviated copy of that block. Creative content inside the frame can be expressive: illustrations, charts, game scenes, maps, covers and artwork may use bespoke colors, gradients, textures, photos or generated assets. Keep that palette scoped to the content layer and make sure it remains readable in light and dark mode.

## Responsive text

Right rail widgets are narrow. Put `min-width: 0` on flex/grid text columns and any parent that should shrink. Single-line titles, memory names, counters and menu labels should use `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. Long ids, URLs or user text that may not contain spaces should use `overflow-wrap: anywhere` instead of forcing horizontal scroll.

## Inline preview size

Works should make their useful summary, primary controls and core result visible early in the inline preview so the user does not need a long scroll just to understand the object. This is a soft target, not a fixed height rule: use sections, compact internal panels, deliberate internal scroll areas, fullscreen affordances or supplements when the work genuinely needs more space. Workspace rail widgets must remain usable from 240px to 520px wide.
