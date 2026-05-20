# Spike #5: `baselineContentHash` Staleness Flow

## Scope

This spike used an isolated sandbox under:

```text
.tmp/note-foundation-spikes/spike-5-baseline-content-hash/
```

No production source, package manifests, `docs/current/*`, initiative docs, or unrelated files were edited.

## Recommendation

Use **full SHA-256 hex** for `baselineContentHash`.

- Algorithm: `sha256`
- Encoding input: exact UTF-8 Markdown text that Reo reads from `segment.md` or `supplement.md`
- Output shape: 64 lowercase hex characters
- Renderer request field: `baselineContentHash`
- Successful save response field: `contentHash`
- Conflict error payload fields:
  - `code: "ERR_SEGMENT_CONTENT_STALE"`
  - `dataRetention: "previous-file-preserved"`
  - `currentContentHash`: full SHA-256 hex of current disk Markdown
  - `expectedBaselineContentHash`: full SHA-256 hex sent by renderer
  - `hashAlgorithm: "sha256"`

Do not use a prefix for the concurrency token. A prefix is fine for attachment filenames or human-facing debug snippets, but the staleness guard is a correctness boundary and should avoid avoidable collision risk. Full SHA-256 is already cheap for this workload.

## Redaction

The full hash is allowed in the IPC response envelope because the renderer needs a deterministic token to decide whether the current local draft still matches disk state.

The full hash must not be written to diagnostics, toast text, DOM-visible conflict copy, or crash/error reports. Main diagnostics should keep the existing pattern: channel, status, duration, `errorCode`, `errorName`, and safe enum fields only. If a manual developer-only note needs to identify a run, use at most an 8- or 12-character prefix, never body text, paths, or full hashes.

## Performance

Measurements were taken with Node `node:crypto`:

```js
createHash('sha256').update(markdown, 'utf8').digest('hex');
```

Context7 official Node docs confirm `crypto.createHash("sha256")`, `hash.update(...)`, and `hash.digest("hex")` as the current API shape.

Raw results are in `timings.json`.

| Sample                 |  Bytes | Iterations |      Mean |       P95 |       P99 |       Max |
| ---------------------- | -----: | ---------: | --------: | --------: | --------: | --------: |
| typical 5 KB markdown  |   5120 |      10000 | 0.0035 ms | 0.0037 ms | 0.0075 ms | 0.6197 ms |
| larger 256 KB markdown | 262144 |       2000 | 0.1291 ms | 0.1662 ms | 0.2625 ms | 1.2597 ms |

Conclusion: hashing is not a reason to add a file watcher, debounce layer, cache, or custom digest implementation. Compute at read/open time for the baseline token and again inside the write lock before save.

## Lock-Internal Flow

Sub-spec (d) can implement the save guard without a file watcher:

```text
requireHandle(workspaceHandle, workspaceId)
assertWorkspaceUsable(handle)
withMemoryWriteLock(memoryId, async () => {
  locate segment.md by workspaceId + memoryId + segmentId manifest ownership
  bind segment directory identity and open segment.md no-follow
  currentMarkdown = read bounded segment.md
  currentHash = sha256Hex(currentMarkdown)
  if currentHash !== request.baselineContentHash:
    return ERR_SEGMENT_CONTENT_STALE with previous-file-preserved and hashes
  render next markdown from request body/frontmatter
  atomic replace segment.md in same directory, fsync file and parent
  refresh owning Memory index entry
  return new contentHash + refreshed projection
})
```

This matches the current Reo pattern for regenerate backfill: lock, re-read current disk truth, compare the caller snapshot token, then write only if still current.

## Harness Result

`staleness-flow.json` contains both paths:

- Happy path: baseline hash matched current disk Markdown; save returned `ok: true` with the new full `contentHash`.
- Conflict path: disk Markdown changed after renderer baseline capture; save returned `ERR_SEGMENT_CONTENT_STALE`, kept the previous disk file, and included both full hashes in the IPC error payload.

## Commands

```bash
cd /Users/yck/Downloads/PM/技术线/reo
node .tmp/note-foundation-spikes/spike-5-baseline-content-hash/baseline-content-hash-harness.mjs
```

## Files

- `timings.json`: raw hash measurements.
- `staleness-flow.json`: happy/conflict harness output and proposed payload shapes.
- `.tmp/note-foundation-spikes/spike-5-baseline-content-hash/baseline-content-hash-harness.mjs`: isolated harness script.

## Status

DONE
