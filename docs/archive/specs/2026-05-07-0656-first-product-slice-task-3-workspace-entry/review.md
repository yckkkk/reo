# 审查

## 当前结论

Task 3 刚开始执行。当前无已知 BLOCKER/MAJOR；进入实现前需要先完成 RED 测试并验证失败原因正确。

## 简化检查清单

- 复用现有 `window.reoWorkspace` explicit preload methods、`workspaceApi.ts` wrapper、TanStack Query seed helper 和 shadcn primitives。
- 不创建 generic entry controller、generic form factory、generic error mapper 或 service layer。
- 不添加未要求的 defensive fallback、legacy compatibility、额外日志、全局 ErrorBoundary、Suspense 或 loading skeleton。
- RHF 只保留 create/open entry 必需字段、错误和 submit lifecycle；不把同一事实同时放到 component state 与 form state。
- `Input` source 直接裸用，业务组件只保留必要布局。

## 对抗审查

- `$ycksimplify` 复用审查，2026-05-07：
  - BLOCKER：无。
  - MAJOR：`FolderPickerField` 与 `OpenWorkspaceAction` 重复 folder picker 安全流程。已修复：新增 feature-local `chooseSafeWorkspaceFolder()`，两条分支复用同一个 safe selection boundary。
  - MINOR：Zod schema 未复用 displayPath safety invariant。已修复：`displayPath` schema 复用 `isSafeWorkspaceDisplayPath`。
  - MINOR：renderer bridge mock 重复。当前保留为非阻断；本 task 不扩大到测试 helper 抽象。
- `$ycksimplify` 效率审查，2026-05-07：
  - BLOCKER：无。
  - MAJOR：open/create folder picker 缺 pending guard，可能并发 OS picker 和 stale selection。已修复：create picker 和 open action 都在 choose/open pending 期间 early return，并禁用当前按钮。
  - MAJOR：initialize error 后复用已消费 token。已修复：initialize failure 清除 `selectionToken/displayPath`，再次 submit 只触发 folder validation，不重复调用 IPC。
  - MINOR：两次 `setValue(...shouldValidate)`。当前保留，因 RHF 需要分别写入 token 与 display 字段，且不是热路径。
- `$ycksimplify` 质量审查，2026-05-07：
  - BLOCKER：无。
  - MAJOR：open pending guard，同上已修复。
  - MINOR：entry tests 放在 `CreateWorkspaceForm.test.tsx`。当前保留为非阻断；后续 entry 测试增长时再拆独立文件。
- Claude CLI `/simplify` 只读审查，2026-05-07：
  - 命令：`claude --model claude-opus-4-7 --effort max "<prompt>"`。
  - 结果：工具 5 分钟无输出，已终止，未产出可用审查结论；本 task 不以该无输出结果作为 PASS 证据。
