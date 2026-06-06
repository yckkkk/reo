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

## Responsive text

Right rail widgets are narrow. Put `min-width: 0` on flex/grid text columns and any parent that should shrink. Single-line titles, memory names, counters and menu labels should use `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. Long ids, URLs or user text that may not contain spaces should use `overflow-wrap: anywhere` instead of forcing horizontal scroll.
