# 目标

## D 的产品 objective

让 Reo 用户在 Memory Studio 中通过 Segment card 与 SegmentSupplement tab 的实体 More 菜单显式触发当前 segment 或 supplement 的转录生成或重新生成：

- 当 transcript 不存在时（`transcript.exists=false`），菜单项 label 为「生成转录」，点击后无二次确认，直接入队 manual `fill-missing` 任务；
- 当 transcript 已存在时（`transcript.exists=true`），菜单项 label 为「重新生成转录」，点击后弹出 `WorkspaceDangerConfirmDialog` 二次确认；确认后入队 manual `regenerate` 任务，引擎结果覆盖现有 transcript。

## D 的工程 objective

- 把 `mode: 'fill-missing' | 'regenerate'` 作为 `workspace:requestSegmentTranscriptionBackfill` 与 `workspace:requestSegmentSupplementTranscriptionBackfill` 的当前 request 合同字段。两个 channel 都必须显式接收 mode；不接受省略。Reo 未发布，不保留旧 missing-only request shape 的兼容垫片。
- `fill-missing` 在 main 端继续走 C 当前 `requireTranscriptMissing: true` 路径，保留 missing-only 语义。
- `regenerate` 在 main 端：
  1. 任务出队进入 in-flight 时捕获当前 transcript snapshot（基于读取到的 `transcript.text` 文本生成 digest）；
  2. Turbo recognize 完成后，写入前重新读取 transcript，比对 digest；
  3. digest 一致：使用新的 main-only 保存路径覆盖 transcript（不传 `requireTranscriptMissing`），并把 manifest `lastTranscriptionAttempt` 写为 `'success'`；
  4. digest 不一致：返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`，不改写当前 transcript 与 manifest。
- Renderer 不直接调用 `workspace:saveTranscript` 或 `workspace:saveSegmentSupplementTranscript` 来伪造 ASR 结果。Renderer 不接触 raw path、audio bytes、base64、ffmpeg path 或 X-Api-Key。
- 复用 C 已有 BackfillQueue、Turbo client、ffmpeg remux、scanner、诊断和安全边界。不新增第二条队列、第二套 Turbo client、第二套音频转换或 main-to-renderer event channel。
- 不新增 TanStack Query key、Zustand store、durable manifest schema 字段或 IPC 通道。
- 自动 scanner 与 automatic batch 永远只入队 missing-only 目标，等价于内部使用 `fill-missing` mode；自动路径不接受 `regenerate`。

## D 的体验 objective

- 菜单项 label 与 `transcript.exists` 实时一致。
- AlertDialog 仅在 overwrite 路径触发；fill-missing 不打断用户。
- voice settings 未启用、未配置 X-Api-Key 或 `lastValidationCode='auth'` 时菜单项 disabled，并有 tooltip 引导用户去 Settings；`lastValidationCode='network'` 时菜单项可点击，让用户决定是否再次尝试。
- 录音 overlay open 时菜单项 disabled 并 tooltip 提示先完成或关闭录音；与 RecordingOverlay 现有阻止其它跨流程跳转的策略一致。
- `running` 文案在 fill-missing 与 regenerate 两条路径上一致复用 B 的 `SegmentTranscriptView` running outcome；regenerate 路径 running 期间保留并显示当前 transcript 文本，失败时回到原 transcript，不渲染空白。
- 成功后 Memory detail cache 中的 transcript 文本与 `lastTranscriptionAttempt='success'` 由现有 transcript save response merge 路径协调；不增加额外 invalidation。
- 失败时只显示 root toast（包括 `ERR_BACKFILL_ALREADY_RUNNING`、`ERR_BACKFILL_TRANSCRIPT_CHANGED`、`ERR_BACKFILL_TARGET_NOT_ELIGIBLE` 及 C 已有的错误码），不进入弹层、不破坏既有 transcript。

## D 的非目标

下列项不属于本 spec，本 session 也不在 plan/tasks 中展开方案：

- transcript 文本用户编辑能力（无 inline editor、无 markdown editor）
- 选段重转（无时间区间选择 UI）
- 撤销重转（无 undo / version history）
- transcript 历史版本（无 diff、无回滚）
- 任务可取消按钮（沿用 C：workspace 切换/lock lost/app quit cancelAll；无 per-task cancel UI）
- 任务进度条（沿用 C：只显示 running/success/failed outcome）
- main-to-renderer backfill event channel
- 新 TanStack Query key、Zustand store、manifest schema 字段或 durable file 字段
- 标准版 2.0 `audio.url`、TOS、对象存储、AK/SK、公网隧道、本地公开 HTTP 服务
- 把 `regenerate` 暴露给自动 scanner 或 automatic batch
- 把 mode 字段隐式默认（合同必须显式带 mode）

## 本 session 的产物 objective

- 创建 D active spec 的 5 个文件（README/goal/plan/tasks/verification）
- 更新 initiative 4 个文档，指向新 D active spec 并保持 current-truth-only 描述
- 不写 D 代码
- 不修改 `docs/current/*`，除非发现已与 C 已交付事实不一致；如果修改，必须运行 `npm run verify:quick`
- 不在本 session 同步 D 实施完成后的 current docs；那些同步留给下一 session 完成实施时同批执行
- 完成后运行 `prettier --check` 与 `git diff --check` 以保证 markdown 与空白格式合规
- 给出"创建/修改了哪些文档、D 的最终执行模型、剩余风险、下一 session 入口、是否建议提交 docs-prep commit"作为最终汇报
