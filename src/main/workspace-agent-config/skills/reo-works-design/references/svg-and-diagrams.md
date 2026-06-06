# Reo works SVG and diagrams

Use this reference for SVG diagrams and inline SVG inside interactive HTML.

## SVG setup

- Use `width="100%"` and `viewBox="0 0 680 H"` for diagram SVG.
- Keep x coordinates between 0 and 680; safe content area is roughly x=40..640.
- Compute H from the bottom-most shape/text plus 20-40px buffer.
- Never use negative x or y.
- Do not shrink the viewBox width to fit narrow content; center narrow content in the 680 coordinate system.
- One diagram object should have one complete SVG, not multiple partial SVGs.

## Text rules

- SVG text never wraps automatically. Use explicit `tspan` or shorten the label.
- Use 14px for node labels and 12px for subtitles/arrow labels.
- Every text element needs a class or explicit fill. Never rely on inherited black.
- Put text inside boxes or legends; floating labels usually collide.
- Check width from longest label before drawing the box: title chars times about 8px, subtitle chars times about 7px, plus padding.

## Flowcharts

- Prefer one direction: top-down or left-right.
- Keep to 4-5 nodes per diagram.
- Arrows must not cross unrelated boxes or labels; use L-shaped paths when direct lines collide.
- Connector paths must include `fill="none"`.
- Keep same-content nodes the same height.
- Cycles should usually be steppers or a short return marker, not crowded rings.

## Structural diagrams

- Use large rounded rects as containers and smaller rects as regions.
- Keep 20px padding inside containers and 16px gap between inner regions.
- Max 2-3 nesting levels.
- Use distinct but meaningful ramps for nested regions; same ramp on parent and child flattens hierarchy.

## Illustrative diagrams

- Use an illustrative diagram when the user needs intuition, not a reference map.
- Draw the mechanism, not decorative icons about the mechanism.
- Prefer simple shapes and recognizable silhouettes.
- If the real system has a control, consider an interactive HTML version with inline SVG.
- Avoid arbitrary metaphors that do not teach the mechanism.
