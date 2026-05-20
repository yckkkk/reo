# Note Foundation 长期任务

## 状态

- 状态：completed
- 类型：产品本质长期轨道
- 当前阶段：已归档

## 并行规则

本 initiative 完成前作为唯一的产品 / 代码 active initiative，与 `2026-05-14-commercial-infrastructure-foundation` 横切长期轨道并行。

每个 session 仍然只推进一个可验证 spec 工作单元。

## 目标

把 Reo 的 Segment / SegmentSupplement 合同扩展为 multi-kind 对象合同，并在 `kind: note` 上交付 Markdown-first create/edit 基础。

录音功能提供对象结构、补充关系、删除恢复、Query identity、More 菜单、沉浸式创建流程和 Memory Studio 模板；笔记只在 note payload 与 content surface 上分叉。

本 initiative 启动 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md` 中"多模态 Segment / SegmentSupplement 类型"长期轨道，先以 note 为首条多模态条目落地。

## 当前约束

- Reo 当前 Segment / SegmentSupplement 文件合同、manifest、projection 和 read model 已支持
  `kind: audio | note`；Note Segment / SegmentSupplement create/edit runtime、Memory Studio note
  渲染、通用 Markdown content surface 和 primary tab More 复用已进入 sub-spec (b)。
- Note editor 当前采用 markdown-first textarea、save-time lazy draft、dirty close confirm 和
  finalize retry；不显示 editor mode badge，不展示未实现 toolbar，不把 editor JSON 作为语义真源。
- Rich editor adapter 必须先通过 Markdown round-trip gate、Reo design system 与 Radix Portal
  集成评估后才能进入 runtime；当前 initiative 不引入 `@blocknote/shadcn`。
- 引入 `reo-attachment://` 自定义 protocol 是 Reo 第二个自定义 protocol，是 Electron 安全面扩展，必须同 session 注册、CSP 更新、navigation deny、permission 不放开。
- 不引入 file watcher；external edit 通过 visibility refresh + `baselineContentHash` + dirty banner 处理。
- 本 initiative 不引入新的 generic runtime、speculative abstraction 或 plugin runtime。

## 范围

1. Multi-kind contract（schema + manifest + projection + Memory summary 字段重命名）
2. Note Segment / Supplement create / edit + `NoteEditorOverlay` + `MarkdownContentSurface`
3. Attachments 合同 + `reo-attachment://` protocol + CSP 更新
4. External edit conflict（`baselineContentHash` + `ERR_SEGMENT_CONTENT_STALE` + 冲突 AlertDialog）

不在本 initiative 范围（按需启动独立 initiative）：

- 自动 GC orphan attachments
- file watcher
- note kind 的 ASR / TTS / agent prompt 自动生成
- video / photo / imported_file / html kind
- widget runtime / Gallery / Prompt-bridge UI / AGENTS.md / users.md 模板

## 实施流程合同

1. 每个 sub-spec 必须按 phase 切分。Phase 完成定义 = `npm run verify:quick` green + `/review` pass（无未解 BLOCKER/MAJOR）+ `$ycksimplify` pass。任一 gate 未通过都不进入下一 phase；用户明确豁免才能跳过，豁免写进 implementation-notes。
2. 每个 sub-spec 在 `docs/specs/<slug>/implementation-notes.md` 持续记录规范中未提及的决策、必须做出的更改、权衡取舍、用户需要了解的事项；spec 归档时随 spec 一起进入 archive。
3. 每个 sub-spec 独立 spec 目录、独立 plan、独立 verify 证据、独立归档。
4. Sub-spec 顺序：(a) multi-kind contract → (b) note create/edit → (c) attachments → (d) external edit conflict。前置 sub-spec 未通过 phase gate 前不进入下一个。
5. Spike #1-#6（见已归档设计 spec §20）必须在 sub-spec (a) 代码改动前完成；spike 不进入主仓，证据保留在已归档设计 spec evidence 目录。

## 完成条件

- 6 个 spike 全部完成并输出证据
- 4 个 implementation sub-spec 全部通过 phase gate 并归档
- audio Segment 下 note Supplement / note Segment 下 audio Supplement 子图运行时验证
- Markdown round-trip fixture evidence 已归档；当前 runtime 保持 markdown-first textarea，rich editor
  adapter 不作为本 initiative 完成前提
- `reo-attachment://` protocol 在 dev runtime 经 CSP / navigation / path containment 验证
- `docs/current/*` 的 10 项更新清单全部落地
- 长期稳定结论压缩回 `docs/current/*` 或 `docs/decisions/*`；任务证据留在 specs / archive

## 读取入口

- `docs/archive/specs/2026-05-19-0111-note-foundation-design/README.md`：完整设计 spec、复用映射、12 项设计要点、spike 清单、TDD checklist、下一 session prompt
- `docs/archive/specs/2026-05-19-0111-note-foundation-design/engineering-handoff.md`：工程师 day-1 入手文档；产品功能说明 / 工程实现说明 / 状态机 / 数据规则 / 权限规则 / 边界情况 / 验收标准 / 最终交付目标总结
- `docs/archive/specs/2026-05-19-0255-note-multikind-contract/`：已完成 sub-spec (a) multi-kind contract 证据
- `docs/archive/specs/2026-05-19-0540-note-create-edit/`：已完成 sub-spec (b) note create / edit 证据
- `docs/archive/specs/2026-05-19-1305-note-attachments-protocol/`：已完成 sub-spec (c) attachments + protocol 证据
- `docs/archive/specs/2026-05-19-1538-note-external-edit-conflict/`：已完成 sub-spec (d) external edit conflict 证据
- `docs/archive/specs/2026-05-19-1809-tab-rail-more-menu/`：已完成 tab rail More 菜单收口修复证据
- `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`：产品本质长期决策、多模态轨道边界
- `docs/current/roadmap.md`：产品本质长期轨道范围
- `docs/current/data.md`、`electron.md`、`frontend.md`、`flow.md`、`quality.md`、`product.md`：当前真源，sub-spec 按改动范围更新
- `plan.md`：阶段拆分与 sub-spec 边界
- `tasks.md`：跨 session 里程碑

## 非目标

- 不在本 initiative 中实现 widget runtime、Gallery 走马灯、Prompt-bridge UI、AGENTS.md / users.md 模板；这些属于产品本质长期轨道其他条目，需独立 initiative。
- 不一次性安装多余依赖；rich editor adapter 未通过 gate 前不进入 runtime。
- 不在 implementation 中跳过 phase gate 或 implementation-notes 维护。
- 不以"先做能用版本"作为绕过 craft 不变量的理由。
