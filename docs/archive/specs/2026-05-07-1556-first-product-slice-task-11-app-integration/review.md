# 审查记录

## 计划内审查

- Codex 自审：实现后检查 route state、recording target、query key/capability 边界、future capability audit 和 docs/current 更新。
- ycksimplify：实现后检查是否引入 generic route/service、冗余状态、过度 props、重复测试 helper 或热路径额外工作。
- Claude CLI 前端/UI 复审：实现后用 `claude --model claude-opus-4-7 --effort max` 做只读复审；重点检查 App flow、drawer target 文案、设计系统和简化规则。

## 当前结论

- Claude CLI 只读复审：PASS，无 BLOCKER/MAJOR。MINOR：
  - Forbidden capability audit 对 AI/auth/file 的关键词过窄。
  - `docs/current/quality.md` 把 Home/detail 打开 drawer 的测试归属写成 AppShell tests，实际在 App flow tests。
  - App 关闭 drawer 时条件卸载 `RecordingOverlay` 可能截断 Vaul close transition；资源清理无泄漏，当前保留为后续 runtime QA 观察点。
  - App 级 detail finalize payload 未做端到端断言；当前由 `RecordingOverlay.test.tsx` 覆盖 payload，`App.tsx` 字面传值负责集成。
- ycksimplify 复用审查：PASS，无 BLOCKER/MAJOR。MINOR：App test workspace setup 有重复，Task 11 不引入共享 test harness，当前保留为文件内显式 setup。
- ycksimplify 质量审查：FAIL，MAJOR：App 级 detail `Record memory` 没有端到端断言 `finalizeRecordingDraft.memoryId`；MINOR：App 同时维护 `recordingOpen` 与 `recordingTarget`，forbidden capability regex 的 bare `auth` 可能误伤。
- ycksimplify 效率审查：FAIL，BLOCKER：existing-memory finalize 后只 seed workspace snapshot，memory detail query `staleTime: Infinity` 会让 detail 页面继续读旧 cache。
- Claude CLI 修复后复审：FAIL，唯一 BLOCKER 是 `src/renderer/src/App.tsx` Prettier 格式失败；无 MAJOR。随后执行 `npx prettier --write src/renderer/src/App.tsx` 并用 `prettier --check` 验证通过。第二次 Claude CLI 短复核超过 10 分钟无输出，已终止进程；不作为新的审查结论。
- MINOR 处理：
  - Forbidden audit 改为覆盖 `photo/video/film/file/files/file upload/AI/AI generation/auth/authentication/sign in/sign up/global search`，并把 `auth` 改为词边界匹配。
  - `docs/current/quality.md` 改为 App shell 与 App flow UI 测试归属。
- MAJOR/BLOCKER 处理：
  - App test 追加真实 detail 录音 start/stop flow，断言 finalize payload 包含当前 `memoryId`。
  - App finalize 后 seed workspace snapshot，并按 `workspaceId + memoryId` invalidate active memory detail query。
  - App 移除冗余 `recordingOpen` state，drawer open 由 `recordingTarget` 派生。
  - 修复 Claude CLI 指出的 `App.tsx` 格式问题。
