# Task 11：App flow 与能力边界

创建时间：2026-05-07 15:56 America/Los_Angeles

## 目标

把 first product slice 的 runtime flow 收口到一个明确的 App route/recording target 模型：workspace entry 进入 Home，Home 打开 memory detail，Home 录音创建新 memory，memory detail 录音追加到当前 memory。当前 slice 不引入 router dependency、全局 route registry、Zustand store、DB query owner 或未实现能力入口。

## 当前事实

- App 已有 starter Home、workspace entry dialog、loaded Home、memory detail 和 recording drawer。
- Home 与 detail 都可以打开 recording drawer，但 `RecordingOverlay` 当前只知道 workspace session，不知道本次录音是 new memory 还是 existing memory。
- Main/preload finalize contract 已允许可选 `memoryId`：不传时创建新 memory，传入时追加到已有 memory。
- Query key 已使用 `workspaceId`，`workspaceHandle` 只作为 preload/main capability。
- Memory detail query 使用 `staleTime: Infinity`，recording finalize 后必须显式 invalidate 受影响的 active detail query。

## 范围

- 为 App/RecordingOverlay 建立 feature-local `RecordingTarget`，区分 `new-memory` 与 `existing-memory`。
- Home 的 `Record memory` 和 app shell `New memory` 传 `new-memory` target。
- Memory detail 的 `Record memory` 传当前 `memoryId`，finalize request 必须包含该 `memoryId`。
- Finalize 后 seed workspace snapshot cache，并 invalidate 当前 memory detail query，避免 detail 页面继续显示旧 recordings projection。
- 保持 in-memory route state，不新增 router package。
- 扩展 forbidden capability audit：photo/video/file/film/AI/auth/global search 不进入 runtime text、button 或 link。
- 更新 `docs/current/frontend.md`、`docs/current/data.md`、`docs/current/flow.md` 与 `docs/current/quality.md`。

## 非范围

- 不改变 main/preload contract。
- 不实现 recording append 后自动跳转、toast、global player、search index、auth、sync、share、photo、video、file、film 或 AI。
- 不把 route state 放入 URL、DB、workspace files、TanStack Query key 或 Zustand。
- 不为当前单一 route flow 创建 generic route service。

## TDD 行为

1. RED：App 从 workspace entry 进入 Home，再打开 memory detail，再从 detail 打开 recording drawer；当前 drawer 必须携带 existing memory target。
2. GREEN：App 记录 recording target，并传给 `RecordingOverlay`。
3. RED：Home 或 app shell 的录音入口打开 new memory target drawer。
4. GREEN：Home/app shell 使用 new memory target。
5. RED：`RecordingOverlay` 对 existing memory finalize request 必须传入 `memoryId`，new memory 不传 `memoryId`。
6. GREEN：finalize payload 按 target 分支。
7. RED：forbidden capability audit 覆盖 text、button、link。
8. GREEN：删除或保持无 future capability 泄漏。

## 成功标准

- Detail 录音追加到当前 memory 的 intent 通过 renderer request payload 体现。
- Detail 录音完成后 active memory detail query 被刷新。
- Home/new memory 录音仍创建新 memory。
- `workspaceHandle` 不进入 query key、DOM、URL 或持久化 state。
- Runtime 不显示 photo/video/file/film/AI/auth/global search。
- `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md` 和 `find docs/specs -mindepth 1 -maxdepth 1 -print` 在归档前记录证据。
