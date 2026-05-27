# Scenario A Summary

## Invocation

Initial command used `codex exec --ask-for-approval never` and failed because current Codex CLI does not accept that flag.

Successful rerun used:

```bash
codex exec --skip-git-repo-check -C "/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试" --sandbox workspace-write -c 'approval_policy="never"' --json -o "docs/specs/2026-05-26-2251-external-agent-edit-dogfood-e2e/evidence/scenario-a/final.md" "$PROMPT"
```

## Observable Agent Behavior

- Read local `skills/reo-edit/SKILL.md`.
- Listed target Segment directory.
- Also searched and opened `/Users/yck/.codex/memories/MEMORY.md`, even though local Reo files were enough for the task.
- Read target `segment.md` and an existing `supplement.md`.
- Renamed the Segment directory, updated `segment.md`, created a new Supplement directory and `supplement.md`.
- Ran a direct file existence check.
- Did not edit `.reo`, hash fields, manifests or sidecar files.

Codex reported `147619` input tokens, with `122112` cached input tokens and `4434` output tokens.

## File Effects

- Old Segment directory no longer exists.
- New Segment directory exists:
  `seg_codex_e2e_1779782693--Codex Dogfood Segment 1779861247`.
- `segment.md` keeps stable id `seg_codex_e2e_1779782693` and updates the title/H1.
- New note Supplement exists:
  `sup_codex_dogfood_1779861247--Codex Dogfood Supplement 1779861247/supplement.md`.
- New Supplement Markdown includes H2, task list and blue highlight HTML.

## Reo Projection

Before opening/selecting the memory space in the UI, `.reo/objects/supplements/sup_codex_dogfood_1779861247.json` was absent.

After selecting the `测试` memory space in the running Reo UI:

- Horizontal Segment flow showed `Codex Dogfood Segment 1779861247`.
- Content tabs included `Codex Dogfood Supplement 1779861247`.
- Editor content showed the renamed Segment body and existing rich marks.
- `.reo/objects/supplements/sup_codex_dogfood_1779861247.json` was created with the correct parent `segmentId`.

This verifies convergence through workspace open/selection. It does not by itself prove passive watcher convergence while the same workspace is already selected.

## Friction Classification

| Observation                                                                         | Owner                                                 | Decision                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CLI failed on `--ask-for-approval never`                                            | test/dev tooling                                      | Dogfood harness must use `-c 'approval_policy="never"'`; do not document `-p` as prompt.                                                   |
| Agent searched global Codex memory despite local instructions being enough          | `AGENTS.md` / `skills/reo-edit`                       | Add a normal-task stop condition: local Reo files are enough; do not leave the memory space for ordinary edits.                            |
| Agent correctly avoided `.reo` and did ordinary file edits                          | no fix                                                | Current default model is directionally correct.                                                                                            |
| Reo converged after workspace selection                                             | Reo system currently passes this sub-scenario         | Need a separate active-workspace watcher scenario before claiming passive live sync.                                                       |
| Existing running app had an older generated `reo-edit` than current source template | dev/runtime freshness unless reproduced after restart | Restarted/current app should rewrite managed skills on workspace open; only treat as Reo system bug if reproduced on current main process. |
