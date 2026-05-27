# Needs-review recovery toast

Timezone: America/Los_Angeles

## 状态机

本轮先只定义入口和状态，不做自动修复。

```text
Clean
  snapshot.review 不存在，或 needsReviewCount === 0
  UI 不显示 needs-review toast；若上一状态有 toast，关闭同一个 toast。

Unresolved
  snapshot.review.needsReviewCount > 0
  UI 通过 Reo toast 显示 count 和复制提示词入口；同一 workspace session 只保留一个 review toast。

Prompt copied
  用户点击「复制」
  Renderer 请求窄 IPC，由 main 生成安全提示词并写入剪贴板；同一 toast action 临时显示「已复制」和 Check icon；review truth 不改变，仍等待下一次 snapshot 收敛。

Clean after refresh
  文件真源收敛后，下一次 snapshot.review 变为 clean
  UI 关闭 review toast，回到 Clean。
```

## 不可变约束

- Renderer 只能消费 Workspace snapshot 的 `review` aggregate counts；不得接收 `.reo/review/needs-review.json` entries、workspace-relative paths 或 raw paths。
- UI 不暴露 raw path，不把 report entries 放进 DOM、Query cache、component state、日志或 toast payload。
- 本轮不新增 raw path IPC，也不新增 generic file/open/report IPC。复制提示词只通过闭合的 `workspace:copyNeedsReviewAgentPrompt` IPC；renderer 只传 `workspaceHandle`、`workspaceId` 和 count，main 生成提示词并写剪贴板。若后续需要打开本地 report，必须由 main process 内部解析固定 report 文件并返回 `{ ok: true }`，不得把路径传给 renderer。
- 本轮第一阶段的安全入口是「复制给 Agent 的提示词」：提示词只包含 count、`reo-doctor` 指令、workspace-relative report 文件名和行为边界，不包含具体 report entry。
- `needsReviewCount` 是 UI 状态入口，不是恢复逻辑入口。Reo 不在 renderer 推断冲突类别、不做自动合并、不打开 in-app 修复编辑器。
- needs-review toast 是非阻断状态 surface：不遮挡 Memory Studio 编辑流，不抢占选择，不替代 `reo-doctor` 的本地诊断输出。
- `.reo/review` 仍由 main process 和 doctor 脚本拥有；watcher 不需要监听 report 文件本身。UI 只随下一次 Workspace snapshot refresh 收敛。
- Undo toast 的 action 顺序也按 Figma Toast component set 收敛：文字在左，图标在右；所有 toast close button 统一右上角，close icon 和 action icon 都使用 16px。

## 意图对齐

- 已用 `request_user_input` 确认：先归档已完成的 `2026-05-27-0604-toast-unified-api`，再新建本轮 spec，保持 `docs/specs` 只包含当前任务。
- Figma source：`Toast` component set `70:10`，新增 `type=reo-doctor` 变体；本轮按用户反馈修正该变体：标题只显示 `1个文件需要检查`，副文本为 `复制提示词给您的Agent`，action 为「复制」+ 右侧 16px copy icon，右上角 close icon 为 16px 且不显示填充底色。
- 当前产品截图中的 top-center needs-review 弹层不是目标形态；本轮应复用 Reo root toast host，而不是继续维护 bespoke overlay。

## 方案选择

推荐方案：持久的 `reo-doctor` toast + 复制安全提示词。

- 它复用现有 Sonner/Reo toast 基础，不引入新的 recovery panel、路径列表或 raw path 边界。
- 它让普通 agent / 人类仍按文件真源工作：Reo 能静默收敛时不打扰；不能静默收敛时给出明确、可复制的 agent 提示。
- 它与现有 needs-review 合同一致：Workspace snapshot 暴露 count；`reo-doctor` 和本地 report 承担具体诊断。

暂不采用：

- 直接在 renderer 展示 report 列表：会破坏 aggregate-only 边界。
- in-app 自动修复或猜测合并：会把不可确定的文件冲突转成产品内隐式决策。
- 立即做完整 recovery center：需要额外安全设计，本轮只做入口和状态。

## Agent 提示词合同

复制内容应是短提示，面向正在记忆空间内工作的 agent。内容可以包含：

```text
Reo 检测到这个记忆空间有 N 个文件需要检查。
请先阅读 AGENTS.md；如果需要诊断，运行：
node skills/reo-doctor/scripts/reo-doctor.mjs

只按 reo-doctor 和 .reo/review/needs-review.md 的 workspace-relative 信息处理。
不要猜测合并，不要删除用户内容，不要把 .reo 当作语义真源。
修复后让 Reo 重新刷新 Workspace snapshot，确认 needs-review 消失。
```

提示词不得包含 root path、absolute path、report entry 列表、正文、frontmatter 原文、hash、workspace handle 或 selection token。

## 设计边界

- Toast visual 以 Figma component set 为准：`bg-popover`、`text-popover-foreground`、`shadow-float`、`rounded-xl`、宽度 360px 上限、description 使用 muted text。
- `reo-doctor` toast 显示右上角 close button，标题只显示需要检查的文件数量，action 是「复制」文字 + 右侧 16px copy icon；复制成功后同一 action 临时切换为「已复制」文字 + 右侧 16px Check icon。
- Undo toast action 同步改为「恢复」文字 + 右侧 16px Undo icon，并使用同一右上角 close button。所有 close button 默认、hover、active 和 focus-visible 都不显示填充底色。
- 本轮不改变 normal success/error/warning/info toast 的语义、duration 或状态图标策略。
- 如果 copy 失败，只显示普通 error toast；不得尝试展示路径或 report 内容作为 fallback。

## 数据与 IPC 边界

- Workspace snapshot schema 保持 `review?: { needsReviewCount, markdownCandidateCount, tiptapSidecarCount }` aggregate 形态。
- 不新增 Query key；review toast 从现有 workspace session / snapshot query 投影派生。
- 如果实现需要持有 toast id，id 只存在于 renderer component state/ref，不写入 Query 或 durable files。
- `workspace:copyNeedsReviewAgentPrompt` 是唯一复制入口：request 只接受当前 workspace handle、workspace id 和 `needsReviewCount`；schema 拒绝 renderer-provided prompt、report path、report entries 或 raw path。Main process 生成提示词并调用 Electron `clipboard.writeText`，response 只返回 `{ ok: true }` 或 typed error。

## 验证重点

- report 存在且 snapshot `needsReviewCount > 0` 时，UI 只出现一个 needs-review toast。
- report 清空并完成 snapshot refresh 后，toast 消失或回到 clean 状态。
- renderer/preload/IPC 仍只拿 aggregate counts。
- 复制 action 的文本不包含 root path、absolute path、report entries 或 hashes。
- `reo-doctor` 本地输出继续使用 workspace-relative paths。
- Undo toast action 顺序与 Figma 一致，且不破坏恢复回归。

## 非目标

- 不实现自动修复、自动合并、report 列表、in-app conflict editor、raw path reveal 或 raw path IPC。
- 不把 Tiptap 官方能力补齐纳入本轮；它排在后续任务。
- 不把 agent 的复杂思考变成产品方案；产品只给普通文件编辑者一个清晰恢复入口。
