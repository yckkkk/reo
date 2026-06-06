# Reo works charts

Use this reference for charts, dashboards and data visualization.

## Default approach

- Prefer native SVG, CSS bars, tables with fixed layout or small inline canvas code when that is enough.
- Remote chart libraries and CDN scripts are allowed when they materially reduce complexity.
- Keep small chart data embedded in the HTML or `state.json`; larger local data can live under `assets/`.

## Chart structure

- Put 2-4 metric cards above the chart when summary numbers matter.
- Use custom legends in HTML: small square, label and value/percentage.
- Use color to encode categories or status, not rainbow order.
- For categorical values, include the value in labels or legend.
- For time series, keep axis labels readable and avoid unnecessary grid decoration.

## Canvas rules

- Put canvas in a wrapper with explicit height and `position: relative`.
- Do not rely on canvas CSS height alone.
- Scale drawing by device pixel ratio.
- Avoid animation loops for static charts.

## Table and grid overflow

- Use `table-layout: fixed` or a controlled horizontal wrapper for many columns.
- Use `minmax(0, 1fr)` in grid columns when child content might overflow.
- Do not use nested scroll for normal cards or dashboards.

## Number formatting

- Format every displayed number.
- Use `Intl.NumberFormat` for counts and currency.
- Use `.toFixed(1)` or `.toFixed(2)` for controlled decimals.
- Never allow raw JS float artifacts in labels, tooltips or slider readouts.
