# Review 记录

## 自审重点

- 是否所有实现切片都有独立 spec、TDD/验证证据和 commit。
- Runtime workspace 是否产生预期稳定文件。
- Codex CLI 是否真正 read-only，hash 是否不变。
- Runtime validation 暴露的 recording metadata 竞态是否由自动测试覆盖。
- 是否仍有 unresolved BLOCKER/MAJOR。

## 自审结论

初始 runtime validation 发现 MAJOR：`recording.json`、`.reo/index.json` 和 `audio.webm` 字节数不一致，且 `recording.json` 仍为 draft。该问题已通过 RED -> GREEN 修复。

修复后自审结论：

- BLOCKER：无。
- MAJOR：无。当前 spec 和 initiative 在最终验证后按文档生命周期归档。
- MINOR：native macOS directory picker/Finder 会在测试 workspace 内生成 `.DS_Store`，该文件不属于 Reo stable data contract；Codex hash guard 包含并确认 read-only validation 没有改动它。

## 对抗审查

- Subagent review 第一轮：发现 BLOCKER，`MediaRecorder` final `dataavailable.arrayBuffer()` reject 时 adapter 只触发 `onError`，`stop()` 仍 resolve，overlay 仍可能 finalize；发现 MAJOR，initiative/spec 已声明完成但尚未归档。
- Codex CLI review 第一轮：同样发现 final chunk conversion failure BLOCKER 与 archive 状态 MAJOR。
- Claude CLI review 第一轮：未发现其他代码 BLOCKER；同样指出 final chunk conversion failure 风险，并建议补 rejected append 测试。
- 处理结果：新增 adapter RED 覆盖 final chunk conversion failure，`stop()` 现在 reject 并停止 tracks；新增 overlay RED 覆盖 append error envelope 和 rejected append 均不 finalize；新增 recording machine RED 覆盖 failed 后 retry。
- 修复后代码行为复审第一轮：Subagent 和 Claude CLI 发现 failed retry 没有清理旧 recorder、append failure 没有立即 failed、index update failure 可能留下 metadata finalized 但 index missing 的不一致。
- 处理结果：新增 overlay RED 覆盖 failed recorder cleanup 和 stale chunk ignore；append error envelope/reject 现在立即进入 failed 并停止 controller；新增 main RED 覆盖 index update failure，`finalizeRecordingDraft` 现在回滚 metadata 到 draft 并返回 `dataRetention: "draft-preserved"`。
- Codex CLI 代码行为复审发现 controller ready 前 UI 已进入 recording，Stop 会跳过 `controller.stop()` 后继续 finalize；并发现 failed retry 未清空旧 elapsed/mock transcript/reflections draft。
- 处理结果：新增 overlay RED 覆盖 controller ready 前不显示 Stop/不 finalize，新增 failed retry reset 断言；`RecordingOverlay` 现在只在 media controller ready 后进入 recording，retry 会清空旧 draft/timer state，finalize 成功后失效 session。
- Subagent 最终复审发现 finalized metadata 后 index 缺失的 crash/rebuild 窗口。处理结果：新增 workspaceFiles RED，`.reo/index.json` 损坏或丢失时从 finalized metadata 和 `audio.webm` 重建 summary。
- Codex CLI 最终复审发现 stale Stop 仍可能走旧 handler、media start failure 后 draft orphan。处理结果：新增 overlay RED，失败路径 discard 当前 draft，stale Stop 在 controller 缺失或失败标记存在时直接返回。
- Subagent 复审发现 valid-but-stale index 仍可能隐藏 finalized recording。处理结果：新增 workspaceFiles RED，合法但陈旧的 `.reo/index.json` 会从 finalized metadata/audio 协调并写回。
- Subagent 复审 residual risk：无 BLOCKER/MAJOR；指出 DOM detached stale Stop closure 理论 MINOR。处理结果：新增 DOM 级验证，retry 后触发旧 Stop 节点不 finalize、不停止新 controller。
- Codex CLI 只读复审 residual risk：无 BLOCKER/MAJOR；指出 recorder setup failure tracks 泄漏、`updateWorkspaceIndex` update 失败前预写协调结果两个 MINOR。处理结果：新增 adapter RED 和 workspaceFiles RED；recorder construction/start failure 会 stop tracks；`updateWorkspaceIndex` 在 update 成功前不持久化协调结果。
- Subagent 复审两个 MINOR 修复：无 BLOCKER/MAJOR；指出 recorder construction failure 测试覆盖 MINOR。处理结果：补充 construction failure 测试。
- Codex CLI 最终短复审：BLOCKER 无，MAJOR 无，MINOR 无。
- Claude CLI 最终短复审：两次返回 `API Error: 529 Overloaded`，记录为工具侧不可用；早前 Claude CLI 复审已参与发现 final chunk conversion failure 风险。
