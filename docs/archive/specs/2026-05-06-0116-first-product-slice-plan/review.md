# Review

状态：通过，已按审查修订

## 审查结论

当前 plan 可以作为后续 implementation 输入，但必须按 slice 顺序执行。不得把 slices 合并成一次大实现。

审查重点不是“功能能不能做出来”，而是是否在基础不稳时跳进功能。初版计划在这一点上失败，最终版已修正为 foundation-first 顺序。

## 独立 Subagent 审查

### Foundation / Ordering

初审：FAIL

发现：

- 依赖在真实 consumer 前集中安装。
- Preload 暴露方法早于 handler。
- `workspaceIpc.ts` 任务顺序有不可能依赖。
- Recording draft flow 缺少恢复、竞态和取消策略。

处理：

- 改为 7 个可收口 slices。
- 每个 slice 必须 RED/GREEN/REFACTOR、更新 `docs/current/*`、`verify:quick`、commit 后才能进入下一 slice。
- IPC channel 必须 contract + handler + preload + tests + docs 同 slice 落地。

### Simplicity / Dependencies

初审：FAIL

发现：

- Task 1 过早安装 Zod、TanStack Query、RHF、shadcn/ui、date-fns、lucide。
- Tooltip/lucide 没有明确 consumer。
- Vitest RED 证明不够真实。
- date-fns 对首版标题过重。

处理：

- Zod 随首个 IPC 激活。
- TanStack Query 随 renderer main-backed async data 激活。
- RHF 随 workspace creation form submit/error lifecycle 激活。
- shadcn/ui 随真实 Button/Label/Dialog/Textarea consumer 激活。
- lucide 只有 icon-only controls 时激活。
- date-fns defer，首版用 native local formatter。

### QA / TDD

初审：FAIL

发现：

- Renderer test foundation 缺少 setup file。
- Preload test 不能依赖 Node runner mock ESM `electron`。
- Electron media permission check/request shape 混淆。
- MediaRecorder tests 需要 fake browser APIs。
- 手动磁盘验证不 repeat-safe，save failure 没有诱发路径。
- Codex CLI 读文件验证缺少 before/after hash。

处理：

- 增加 `test/renderer/setup.ts` 和明确 Vitest config。
- Preload bridge 改为纯 `registerWorkspaceBridge({ contextBridge, ipcRenderer })` 可测函数。
- Permission tests 按 `mediaType` 和 `mediaTypes` 分开。
- MediaRecorder adapter 必须注入 `mediaDevices` 和 `MediaRecorder` fakes。
- Runtime 验证使用 `mktemp` workspace、`shasum`、`chmod -w` 诱发保存失败。
- Codex CLI 前后 hash 对比证明 read-only。

### Product Design / Frontend

初审：FAIL

发现：

- Workspace creation 首屏不足以保证产品级质量。
- shadcn retokenization 可能抹掉 visible keyboard focus。
- Responsive checks 不能拖到最终验证才做。

处理：

- Product UI Blueprint 增加 first-run workspace creation 结构和状态。
- shadcn retokenization 明确必须保留 Reo-token keyboard focus。
- Slice 4/5/6 各自提交前都必须完成 viewport/state evidence。

## Claude CLI Review

第一次 Claude CLI 审查：FAIL

主要发现：

- 一个 feature plan 中捆绑过多 foundation activation。
- shadcn/ui 和 TanStack Query 反转 accepted spec，应显式修订 plan rationale。
- `src/contracts/` 违反 Reo 浅目录边界。
- 缺少 `recording:readAudio`，Blob playback 无路径。
- 录音 id、`recording.json`、chunk failure recovery 不够明确。

处理：

- 删除 `src/contracts/`，改用 `src/main/workspaceContract.ts`。
- 增加 `recording:readAudio`。
- 明确 `crypto.randomUUID()`、collision check、`recording.json` schema、append failure、stale `.part` recovery。

最终 Claude CLI 审查：FAIL_WITH_ONE_BLOCKER

发现：

- Slice 6 使用 Blob URL 播放音频，但 CSP `media-src 'self' blob:` 没有在同一 slice 修改和测试。

处理：

- Slice 6 增加 `src/main/security.ts` 和 `test/main/csp.test.ts`。
- 在 Blob playback 落地前增加 RED CSP test。
- 同 slice 更新 `electron.md`。

## `$plan-eng-review`

结论：PASS_WITH_FIXES

工程判断：

- 当前计划没有跳过基础任务直接进入功能开发。
- 计划刻意把 first product slice 拆为 test foundation、trusted preload/IPC、workspace filesystem、renderer data/form、workspace UI、recording overlay、runtime validation。
- Drizzle/Auth/Zustand/Sentry/Forge/updater 不属于本功能证明出的当前 consumer，继续 defer 是正确的。
- 最大风险从“跳跃 foundation”降为“后续执行者必须严格不合并 slices”。

## 剩余执行风险

- 后续 implementation session 必须一次只执行一个 slice。
- 如果执行者合并 slices，当前 plan 的基础保护会失效。
- Runtime MediaRecorder 行为仍需真实 Electron 验证，不能只靠 jsdom tests。
