# Reo works workflows

Use this reference after `SKILL.md` when the user copied a Reo prompt or asks for a concrete work.

## Create from Reo prompt

1. Read the prompt target: workspace-relative Memory path, Segment path, or Supplement path.
2. Read only the relevant local data first: `memory.md`, nearby `segment.md`, `supplement.md`, transcripts, note bodies and any data file the user named.
3. Decide the product form before writing: diagram, dashboard, interactive explainer, chart, mockup, comparison, data record or creative expression.
4. Read `skills/reo-generative-runtime/SKILL.md`; optionally scaffold the bundle before replacing scaffold content.
5. If the user did not specify a style, default to `reo-works-design` visual variables and modules; for visual or interaction complexity, read the specific design reference.
6. Create the Markdown contract and runtime bundle in one object directory.
7. Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.

## Short user prompt

When the user only says something like "做一个复习进度作品", "做个图表", or "生成一个看板", do not offer choices. Pick a sensible default and write files:

- If there is one Memory, create a new standalone work Segment under that Memory.
- If several Memories exist, choose the Memory whose title, body or nearby Segment text best matches the prompt.
- If the user says "补充", "supplement", or names a concrete Segment, create a work Supplement under that Segment.
- If no Memory target can be inferred, ask one concise question about the target Memory.
- Write the Markdown contract, runtime bundle and `state.json`, then run `validate-runtime.mjs` and `inspect-runtime.mjs`.
- Stop as soon as validation passes. Do not run browser screenshots, headless Chrome, broad repo searches or extra polish loops unless the user explicitly asked for that inside this memory-space task.

## Update an existing work

1. Read target `segment.md` or `supplement.md`; confirm `kind: artifact` and `format: html`.
2. Read the current `entry.html`, `runtime.json` and `state.json`.
3. Read the user-named sources and the nearby Memory/Segment context.
4. Update data, labels and interaction states while preserving the useful visual structure.
5. Add a visible freshness signal only when useful, such as updated date, source count or data range.
6. Verify that stale copied numbers, labels and unused assets are removed.

## Choosing scope

- One work should have one main job. If it needs a second job, create a work supplement.
- Use a work Segment for a standalone expression of a Memory.
- Use a work Supplement for a lens, alternate view, exercise, chart or prototype attached to an existing Segment.
- Ask at most 2-4 questions only when target, audience, data source or desired form is genuinely ambiguous.
- If the user already provided a direction, execute instead of offering options.

## Useful work forms

- Spaced review table that can be regenerated from note dates or transcript topics.
- Learning map that turns scattered segments into a sequence.
- Risk board or decision matrix from notes and supplements.
- Interactive explainer with sliders or filters for a concept in the Memory.
- Lightweight dashboard with metric cards, chart and short action list.
- UI mockup or prototype derived from product notes.
- Visual poem, diagrammatic illustration or creative collage grounded in the Memory content.
