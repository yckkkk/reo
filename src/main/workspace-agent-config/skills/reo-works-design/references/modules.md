# Reo works design modules

Pick the closest module. A work can combine modules, but one module should own the main structure.

## Module chooser

- `diagram`: flowcharts, structure maps, causal maps, mental models and explanatory SVG.
- `mockup`: product UI, forms, settings, dashboards, cards, mobile screens and faux dialogs.
- `interactive / explorable`: sliders, steppers, drag, zoom, filters, sort, live calculations and small local apps; when the interaction explains causality or what-if, use the source->derive->render model and read `explorables.md` plus `examples/`.
- `chart`: trends, distributions, comparisons, progress, timelines and metric dashboards.
- `art`: creative expression, illustration, generative pattern, visual poem or mood grounded in the Memory.
- `comparison`: option cards, tradeoff boards, decision matrices and recommendation panels.
- `data record`: a single bounded object such as receipt, profile, summary sheet or case file.

## Complexity budget

- One work has one main goal. Split extra goals into work supplements.
- Explorables: budget by independent source variables, target 1-2; one source can drive multiple synchronized controls, readings and charts.
- Diagram box subtitles: at most 5 words.
- Diagram colors: at most 2 primary ramps plus gray; if colors encode meaning, add a one-line legend.
- Horizontal diagram tier: at most 4 boxes at full width. Five or more boxes should wrap, shrink or become multiple diagrams.
- Dashboard metrics: 2-4 metric cards before chart/list content.

## Layout defaults

- Editorial explanation: no card wrapper; let content flow naturally.
- Bounded object: one raised card wraps the object.
- Dashboard: metric cards first, chart/list below, no full-page outer card.
- Comparison: responsive card grid using `repeat(auto-fit, minmax(160px, 1fr))`.
- Stepper: one visible panel, position dots or compact pills, next/previous buttons in normal flow.
- Mock dialog: normal-flow faux viewport, never `position: fixed`.

## When nothing fits

- If it explains a concept, default to an interactive explainer or diagram.
- If it summarizes evidence, default to dashboard, comparison or data record.
- If it expresses a mood or creative synthesis, default to art, but keep it grounded in Memory content.
