# 豆包语音手动重新生成转录（D）

- 时间：2026-05-17 09:50 America/Los_Angeles
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 上游归档 spec：`docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/`
- 上游 ADR：`docs/decisions/0005-doubao-voice-file-asr-baseline.md`
- 上游 brief：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`

## 本 spec 的性质

本 spec 是 D 的执行与收口证据。Spec 准备 session 产出：

- `goal.md`：D 的产品与工程目标，以及不在范围内的项
- `plan.md`：D 的完整 PRD + 工程实现说明，按状态、组件、状态机、数据、权限、接口、异常、验收顺序展开
- `tasks.md`：下一 session 直接消费的执行清单（含 TDD RED/GREEN/REFACTOR、subagent 拆分、review/ycksimplify 阶段、E2E/QA、敏感信息检查、current docs 同步与 100% confidence loop 条件）
- `verification.md`：D 落地后的验收依据（测试命令、真实 Electron runtime QA、敏感信息扫描、文档同步检查）

实施 session 已完成 D 代码、测试、review、ycksimplify、真实 Electron runtime QA、敏感信息扫描和 current docs 同步；最终证据写入 `tasks.md` 与 `verification.md`。实施 session 已成功创建 `/goal`，`goal.md` 保留 D 产品与工程目标。

## 目录

```text
docs/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/
  README.md         本文件
  goal.md           D 的 objective 与非目标
  plan.md           D 的 PRD + 工程实现说明
  tasks.md          D 的执行清单
  verification.md   D 的验收依据
```

## 阅读顺序

1. `../../initiatives/2026-05-16-doubao-voice-followups/d-brief.md`（D 的产品意图原文）
2. `goal.md`
3. `plan.md`
4. `tasks.md`
5. `verification.md`

## 当前认知摘要（不替代 plan.md）

- C 已交付：Turbo `audio.data` 引擎、ffmpeg WebM/Opus → OGG/Opus remux、BackfillQueue、scanner、runtime、诊断与安全边界、手动 IPC 与 renderer running UI。归档在上游 spec。
- C 当前手动 backfill 是 missing-only 合同：target 必须 `lastTranscriptionAttempt='failed'` 且 transcript 为空；runtime 调用 `saveSegmentTranscript / saveSegmentSupplementTranscript` 时传 `requireTranscriptMissing: true`，保存前 transcript 已存在则返回 `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`。
- 自动补转录永远 missing-only，不得覆盖已有 transcript。
- D 要求新增显式覆盖式 manual regeneration 合同；不能直接复用 C 当前 missing-only 路径来承载覆盖式重新生成。
- D 在 main 侧必须捕获 transcript snapshot，并在 save 前确认 transcript 在请求期间未被外部改动；若变化，返回 typed error 并保留当前 transcript。
- Renderer 不得直接调用 `workspace:saveTranscript` 或 `workspace:saveSegmentSupplementTranscript` 来伪造 ASR 输出。
- Reo 未发布，可以直接定义当前正确合同；不保留旧 missing-only request shape 的兼容垫片。
- 不新增 main-to-renderer event channel、新 Query key 或新 Zustand store。
- 不放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission、navigation 边界；renderer 不接触 Node/Electron API、raw path、audio bytes、X-Api-Key。

## 与上游约束的关系

| 上游                                                    | 在 D 中的约束                                                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/current/electron.md`                              | D 扩展 `workspace:requestSegment(Supplement)TranscriptionBackfill` request schema，加入 `mode` 字段；新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 错误码；不增加新 channel |
| `docs/current/data.md`                                  | manual backfill running state 仍由 App feature-local Set 持有；不新增 Query key、Zustand store 或 manifest schema                                                    |
| `docs/current/flow.md`                                  | D 在 backfill 任务执行段加入 transcript snapshot 捕获与 save-time guard；自动 scanner 路径不变                                                                       |
| `docs/current/frontend.md`                              | `SegmentActionsMenu` 与 `SegmentSupplementActionsMenu` 加入「生成转录 / 重新生成转录」菜单项；overwrite 路径使用 `WorkspaceDangerConfirmDialog` 二次确认             |
| `docs/current/quality.md`                               | 扩展 main 与 renderer 的测试覆盖到 mode 字段、snapshot guard、菜单项动态 label、AlertDialog 确认路径、ALREADY_RUNNING 与 TRANSCRIPT_CHANGED 错误映射                 |
| `docs/decisions/0005-doubao-voice-file-asr-baseline.md` | D 不改变引擎、音频格式、错误策略；只在 manual backfill 合同侧增加显式覆盖意图                                                                                        |

## D 实施前置（已满足）

- B 已归档：`docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
- C 已归档：`docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/`
- B→C readiness gate 已执行；C→D readiness gate 已执行（见 initiative plan.md）

## 实施收口

- 实施完成：2026-05-17 America/Los_Angeles
- 代码提交：`e87f8ce9 feat(voice): wire manual regenerate backfill mode`、`54db4529 feat(voice): add manual regenerate transcript UI`
- 收口状态：`verification.md` §6.1 已满足 100% confidence loop；本 spec 可移入 `docs/archive/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/`。

## 时间戳

- 本 spec 版本：2026-05-17 09:50 America/Los_Angeles
- 实施收口：2026-05-17 America/Los_Angeles
