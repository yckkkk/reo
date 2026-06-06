# Reo works file contract

Use this reference when creating or updating Reo work segments and work supplements.

## Object names

- User-facing type name: 作品.
- File contract fields: `kind: artifact` and `format: html`.
- Segment and Supplement runtime entry file: `entry.html` in the same object directory as `segment.md` or `supplement.md`.
- Runtime metadata and state files: `runtime.json` and `state.json`.
- Local resources directory: `assets/`.
- Reo owns `.reo/objects`, `.reo/index.json`, lock files, hashes and preview versions. Agents do not write those files.

## New work Segment

Create one directory under `memories/<memory>/segments/`. Generate a Segment id with the Reo pattern `seg_YYYYMMDDHHMMSS_8hex`, then use the same id as the directory prefix and frontmatter id. Example: `seg_20260604024800_a1b2c3d4--复习地图`.

```markdown
---
id: seg_20260604024800_a1b2c3d4
title: 复习地图
kind: artifact
format: html
---
# 复习地图

Agent-created runtime work. Entry: `entry.html`.
```

## New work Supplement

Create one directory under `memories/<memory>/segments/<segment>/supplements/`. Generate a Supplement id with the Reo pattern `sup_YYYYMMDDHHMMSS_8hex`, then use the same id as the directory prefix and frontmatter id. Example: `sup_20260604024900_d4c3b2a1--风险面板`.

```markdown
---
id: sup_20260604024900_d4c3b2a1
title: 风险面板
kind: artifact
format: html
---
# 风险面板

Agent-created runtime work supplement. Entry: `entry.html`.
```

## HTML entry requirements

- Write a complete HTML document: `<!doctype html>`, `<html>`, `<head>`, `<meta charset="utf-8">`, viewport meta, `<style>`, content, optional `<script>` at the end.
- Do not create a blank placeholder. The first saved version must render useful visible content.
- Keep the entry under 1 MiB. Aim under 200 KiB for the first version.
- Prefer inline CSS and JS for small works. If local assets are needed, place ordinary files under `assets/`.
- Do not create symlinks, absolute paths, `file://`, local usernames, tokens or hidden dependency on editor temp files.

## Update requirements

- Preserve the existing stable id and object directory.
- New Segment ids should use `seg_YYYYMMDDHHMMSS_8hex`; new Supplement ids should use `sup_YYYYMMDDHHMMSS_8hex`; do not invent placeholder ids.
- Preserve title and basename unless the user asks to rename the work.
- Read current `entry.html`, `runtime.json` and `state.json` before editing so you keep useful interaction and remove stale data deliberately.
- Delete no-longer-used `assets/` files only when you can prove they belong to this work.
- Do not force refresh by editing `.reo/index.json` or manifests. Reo refreshes from file truth.
