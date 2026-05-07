# State Machines

## Workspace entry

```text
none
  -> choosing-folder
  -> folder-selected
  -> create-submitting
  -> open-submitting
  -> ready
  -> failed

choosing-folder
  -> canceled
  -> folder-selected
  -> failed

folder-selected
  -> create-submitting
  -> open-submitting

create-submitting
  -> ready
  -> conflict
  -> permission-denied
  -> failed

open-submitting
  -> ready
  -> missing
  -> locked
  -> corrupt
  -> unsupported
  -> failed

failed
  -> choosing-folder
  -> create-submitting
  -> open-submitting
```

Rules:

- Cancel does not clear form draft.
- Conflict does not clear form draft or selected folder.
- Submit validates title and folder; focus first error.
- Create uses `workspace:initialize` and handles conflict/permission errors.
- Open uses `workspace:open` and handles missing/locked/corrupt/unsupported errors.

## Sidebar

```text
covered <-> expanded
expanded -> resizing
resizing -> expanded
covered/expanded/resizing -> keyboard-focus
covered/expanded/resizing -> reduced-motion
```

规则：

- 展开/折叠状态不得改变 route。
- Covered 状态不是 72px rail；它是主内容悬浮面板覆盖 240-520px sidebar 底层。
- Sidebar resize 时宽度 clamp 到 240-520px。
- 展开/折叠动效作用于主内容悬浮面板的 transform，不使用布局推挤。
- Selected item 必须有不只依赖颜色的可见状态。

## Home

```text
loading -> empty
loading -> populated
loading -> failed
populated -> search-focused
populated -> filter-open
populated -> section-collapsed
failed -> retrying
```

Rules:

- Search/filter cannot render as usable if no query/filter implementation exists.
- Empty state has one primary action.

## Recording drawer

```text
idle
  -> acquiring
acquiring
  -> recording
  -> permission-denied
  -> failed
recording
  -> paused
  -> stopping
  -> failed
paused
  -> recording
  -> stopping
  -> failed
stopping
  -> editing
  -> finalize-failed
  -> failed
failed
  -> idle
finalize-failed
  -> stopping
  -> idle
editing
  -> playback-loading
  -> transcript-saving
  -> reflections-saving
playback-loading
  -> playback-playing
  -> playback-error
playback-playing
  -> playback-paused
```

Rules:

- Drawer cannot be dismissed by backdrop/escape while active recording can be corrupted.
- Duplicate stop is ignored.
- Stale chunks from previous recording session are ignored.
- Failed retry creates a new draft and resets elapsed/waveform/editor draft.
- No mock transcript appears as real STT.
- Entering `acquiring` creates one microphone intent; leaving `acquiring` without grant clears it.
- Permission grant consumes microphone intent before recording begins.
- Renderer must await `workspace:beginMicrophoneIntent` success before calling `navigator.mediaDevices.getUserMedia`.
- If `getUserMedia` starts before intent creation is acknowledged, Electron permission handler must deny and tests must catch the race.

## Transcript/reflections autosave

```text
clean -> dirty -> saving -> clean
dirty -> saving -> failed
failed -> dirty
```

Rules:

- Save failure preserves renderer draft and previous disk file.
- Latest draft wins; stale save response cannot overwrite.
- Autosave status is polite live region.

## Future entity suggestion

```text
hidden -> suggested -> skipped
suggested -> accepted
accepted -> entity-created
accepted -> failed
```

Current status：wireframe only. No implementation until entity schema and extraction owner exist.
