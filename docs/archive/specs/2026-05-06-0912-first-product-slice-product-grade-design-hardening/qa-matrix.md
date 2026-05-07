# QA Matrix

## Required TDD slices after this gate

| Slice                  | RED examples                                                    | GREEN target                                                                                    | Refactor guard                     |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| App shell/sidebar      | layered panel absent, resize clamp missing, icon labels missing | 240-520px bottom sidebar + 8px/12px floating panel + Home/New memory/Search and no future films | no generic shell                   |
| Create/open workspace  | submit validation/folder cancel/conflict/open errors            | full first-run flow                                                                             | RHF schema and focus helpers       |
| Home memories          | no section/card/search states                                   | sectioned recording cards and empty state                                                       | derived filter helper              |
| Memory detail          | detail route/page missing                                       | title/date/action strip/current sections                                                        | component split                    |
| Memory file truth      | recording finalizes without durable memory metadata             | memory.json + nested recording files + rebuildable index                                        | transaction helper                 |
| Drawer primitive       | current Dialog shape fails reference/focus                      | shadcn Drawer/Vaul retokenized                                                                  | shared drawer shell                |
| Recording waveform     | current mock transcript appears as STT; hand bars fail          | ElevenLabs waveform + no mock transcript delivery UI                                            | adapter isolation                  |
| Recording lifecycle    | stale chunks/duplicate stop/finalize failure                    | all states and retention                                                                        | reducer table                      |
| Mic permission intent  | trusted renderer can request mic without intent                 | short-lived one-shot intent gates audio permission                                              | permission store                   |
| Playback/editor        | audio read/save failures                                        | player + transcript/reflections autosave                                                        | source-owned editor components     |
| Forbidden capabilities | future photo/film buttons present                               | not rendered in current build                                                                   | capability registry only if needed |
| DB/index gate          | schema ambiguous                                                | Drizzle activation or explicit no-migration decision                                            | rebuildable index tests            |

## Visual/reference verification

For each of the 6 primary reference images, implementation verification must record:

- Structural match: shell/sidebar/drawer/sections/action strip.
- State match: idle/recording/editing/empty/populated.
- Reo token differences: accepted color/type/radius replacements.
- Forbidden capabilities: not visible in current build.
- Screenshots: desktop and narrow viewport.

For `/private/tmp/reo-reference-frames/`, implementation verification must record:

- All 41 auxiliary frame filenames were considered.
- Which frame groups map to current high-fidelity states.
- Which frame groups remain wireframe-only because they show entity/contact/future abilities.
- Any deliberate Reo design-system substitutions.

## Runtime verification

Must use Computer Use when implementation resumes:

- OS folder dialog select/cancel.
- Create workspace in temp directory.
- Open existing workspace.
- Existing `AGENTS.md` conflict.
- Mic permission allowed/denied.
- Record, pause, resume, stop.
- Playback.
- Save transcript/reflections.
- Simulated write failure.
- Restart/reopen recovery.

## Static verification

Required before claiming complete:

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

## Review gates

- Independent adversarial review must look for BLOCKER/MAJOR, not endorsement.
- Any unresolved BLOCKER/MAJOR blocks writing-plans and implementation.
- Review must explicitly inspect open-source reuse decisions, reference mapping, DB schema, Electron security and QA plan.
