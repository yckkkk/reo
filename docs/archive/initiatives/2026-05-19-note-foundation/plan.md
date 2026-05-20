# Note Foundation 实施计划

## 设计阶段（已归档）

设计 spec：`docs/archive/specs/2026-05-19-0111-note-foundation-design/`，包含两份关键文档：

`README.md`（决策记录与跨节关联）：

- 概念模型、文件合同、frontmatter / manifest 归属、multi-kind projection
- 录音基础设施 → note 复用映射
- Content read/save IPC、note draft IPC、attachments 合同 + `reo-attachment://` protocol
- `NoteEditorOverlay`、`MarkdownContentSurface`、Memory Studio per-kind dispatch
- editor subset、round-trip gate、fallback decision 硬条件
- External edit conflict（visibility refresh + `baselineContentHash`）
- `docs/current/*` 更新清单、TDD checklist
- Spike #1-#6 清单与产出
- Blockers / risks
- 下一 session prompt

`engineering-handoff.md`（工程师 day-1 入手文档）：

- 功能识别（15 维度）+ 输入信息优先级处理
- 功能拆解（功能类型 + 16 维度）+ 用户角色与场景
- 页面状态表（13 行）+ 组件与元素表（14 行）
- 产品功能说明 + 工程实现说明 + 第三方能力接入边界
- 状态机表（23 行）+ 数据规则表 + 权限规则表
- 边界情况补齐表（36 行）+ 验收标准表（33 条 AC）
- 最终交付目标总结（单段连续可复制，放研发任务顶部）
- 自检复核 12 项

## 阶段 1：Spike 集合（implementation 代码改动前）

| #   | Spike                                                                                                                                     | 产出                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | BlockNote current package 在隔离 sandbox 项目 mount + Tailwind v4 + Radix Portal 冲突解决方案                                             | adapter 选型证据 + bundle size + Reo design system 视觉一致性截图 |
| 2   | Markdown round-trip fixture suite（≥ 20 fixtures）                                                                                        | subset / raw 分类清单 JSON + pass/fail 报告                       |
| 3   | `reo-attachment://` protocol POC：dev runtime 注册时序、CSP、navigation deny、workspaceId host 校验、path containment、symlink 拒         | runtime 证据（截图 + 日志）+ CSP header dump                      |
| 4   | Note draft transaction：复用 `.reo/drafts/segments/` + `workspaceDirectoryTransactions`，验证空 audio.webm 不破坏现有 unsafe-payload 校验 | main test 报告                                                    |
| 5   | `baselineContentHash` staleness flow：sha256 性能（典型 5 KB markdown）、lock 内 read-compare-write、`ERR_SEGMENT_CONTENT_STALE` 信封字段 | timings + happy/conflict 双路径证据                               |
| 6   | External edit visibility refresh + dirty body 隔离                                                                                        | renderer test 报告                                                |

所有 spike 不进入主仓：独立目录 / 临时分支 / sandbox 项目；证据归档在 `docs/archive/specs/2026-05-19-0111-note-foundation-design/evidence/`。

## 阶段 2：Implementation sub-specs

每个 sub-spec 独立 spec 目录、独立 plan、独立 phase gate、独立 `implementation-notes.md`、独立 `verify:quick` 证据、独立归档。

### (a) Multi-kind contract

- `workspaceMarkdownObjectKindSchema` 扩展为 `z.enum(['audio','note'])`
- segment / supplement manifest schema 扩展 `kind` + `bodyByteLength`
- `workspaceSegmentProjectionSchema` / `workspaceSegmentSupplementProjectionSchema` 改为 discriminated union by `type`
- `workspaceMemorySummarySchema` 字段重命名 + 新增：`durationMs → audioDurationMs`、`hasTranscript → hasAudioTranscript`，新增 `audioSegmentCount` / `noteSegmentCount` / `hasAnyNote`
- `segmentDeleteProjection` 与 helper 扩展
- query helper（`finalizedAudioContentQueryBelongsToWorkspace`）重命名为中性
- 更新 `docs/current/data.md`
- 不引入任何 note runtime；audio 路径 100% backward-compatible

### (b) Note Segment / Supplement create + edit

- FAB note action 启用（`ExpressionDock.tsx` `disabled` → `onSelect`）
- Note draft IPC：create / writeBody / finalize，segment + supplement 各一组；draft 在保存时才创建
- Generic `readSegmentContent` / `writeSegmentContent` + supplement 同构；audio transcript save 继续使用 transcript-specific channel
- `NoteEditorOverlay` component：markdown-first textarea、dirty close confirm、pending lock 和 finalize retry
- `MarkdownContentSurface` primitive（audio outcome + note outcome 共用）
- Memory Studio per-kind dispatch：复用原播放区位置、card preview、tab icon、正文/转录 primary tab 与 supplement tab rail
- 实体 More 菜单复用：primary `正文` / `转录` tab 使用同一 full entity menu，audio tab 保留转录生成/重新生成
- 更新 `docs/current/electron.md`、`frontend.md`、`flow.md`、`product.md`、`roadmap.md`

### (c) Attachments + `reo-attachment://` protocol

- `saveSegmentAttachment` / `listSegmentAttachments` IPC
- `reo-attachment://` scheme privileged 注册 + handler
- 生产 CSP `img-src` 更新
- Markdown-first attachment insertion：textarea 当前光标插入 Markdown image / link 引用
- read-only / edit preview 引用映射（`attachments/...` → `reo-attachment://...`）
- Rich editor adapter 的 paste / image block 行为只在后续 editor adapter spec 重新通过 round-trip gate 后进入实现范围
- 更新 `docs/current/electron.md`、`data.md`、`flow.md`、`quality.md`

### (d) External edit conflict

- `baselineContentHash` 写入 / 比对路径
- `ERR_SEGMENT_CONTENT_STALE` 错误信封 + 冲突 AlertDialog
- visibility refresh 跳过 dirty body 字段
- External edit dirty banner
- 更新 `docs/current/data.md`、`flow.md`、`frontend.md`、`quality.md`

## 阶段 3：收口

- 每个 sub-spec 归档前确认 phase gate + `implementation-notes.md` 完整
- 已完成设计 spec 留在 `docs/archive/specs/2026-05-19-0111-note-foundation-design/`；active `docs/specs/*` 只保留当前 sub-spec
- 长期稳定事实压缩回 `docs/current/*`
- Rich editor adapter 选型与 `reo-attachment://` 安全合同写入对应 `docs/decisions/` ADR（若达到长期决策门槛）
- initiative 完成条件全部达成后归档到 `docs/archive/initiatives/2026-05-19-note-foundation/`

## 暂停 / 取消条件

- Rich editor adapter round-trip gate 失败且无可行 fallback → 暂停对应 editor adapter spec
- `reo-attachment://` protocol 在 dev runtime 出现无法解决的安全或性能问题 → 暂停 (c) 并评估替代方案（如 base64 内联 vs main process IPC stream proxy）
- audio 主链复杂度回归（`segmentDeleteProjection` 扩展破坏现有 audio 测试） → 暂停 (a)，先修复 audio 现行测试

## 风险监测

- 每个 sub-spec 进入前复核 ADR 0006 影响
- 每个 sub-spec 结束后复核 `docs/current/*` 是否单一真源
- `implementation-notes.md` 累积的 ad-hoc 决策超过 spec 设计 30% → 触发 spec 重写而非继续累积
