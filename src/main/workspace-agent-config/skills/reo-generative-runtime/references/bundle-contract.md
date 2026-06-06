# Reo runtime bundle contract

Use this reference for every Reo runtime object.

## Required files

A runtime bundle contains:

- `entry.html` as the only HTML entry Reo loads.
- `runtime.json` as description and launch metadata.
- `state.json` as visible agent-editable state.
- `assets/` for local resources.

## Markdown object contract

Works and workspace rail widgets use Markdown frontmatter to become Reo objects.

Work Segment:

```markdown
---
id: seg_20260604024800_a1b2c3d4
title: 间隔复习表
kind: artifact
format: html
---
# 间隔复习表

Agent-created runtime work. Entry: `entry.html`.
```

For new supplements, use the same artifact fields in `supplement.md` with a `sup_YYYYMMDDHHMMSS_8hex` id. Existing Reo objects may use older valid ids; when creating new objects, do not invent placeholder ids like `seg_agent_*` or `sup_agent_*`.

Workspace rail Widget:

```markdown
---
id: wdg_20260605075957_755b96e2
title: Workspace 总览
kind: widget
format: html
mount: workspace-rail
---
# Workspace 总览

Right rail widget. Entry: `entry.html`.
```

For new widgets, create `widgets/<wdg_YYYYMMDDHHMMSS_8hex--Readable-title>/widget.md` with the same `wdg_` id as the directory prefix. Keep `widget.md` frontmatter strict: do not add `workspaceId`, raw paths, state, cache, preview or `.reo` fields.

## runtime.json

Minimum shape:

```json
{
  "schemaVersion": 1,
  "title": "间隔复习表",
  "entry": "entry.html",
  "template": "spaced-review",
  "state": { "schemaVersion": 1, "stores": ["ui", "data", "progress", "draft"] },
  "bridge": { "needs": ["state"] }
}
```

`runtime.json` is not a permission approval file. It describes intent and helps future agents update the work.

If the work uses Reo runtime APIs, add the vendor bridge script before your own script:

```html
<script src="reo-render://vendor/reo-render/bridge.js"></script>
```

## Assets

- Put local resources under `assets/` and reference them with relative URLs such as `assets/chart-data.json`.
- Do not reference absolute paths, `file://`, symlinks, editor temp files or files outside the object directory.
- Keep direct assets ordinary files. Avoid very large base64 blobs in `entry.html`.
