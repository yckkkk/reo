# 记忆空间 Markdown 文件合同长期任务

## 状态

- 状态：active
- 类型：产品或代码开发 initiative
- 当前阶段：基础文件范式重构

## 目标

将 Reo 记忆空间收敛为普通文件优先、agent 可编辑、Git 可审查的文件合同：

- 用户与 agent 可编辑的语义层使用 Markdown 正文和 YAML frontmatter。
- Reo 技术完整性、事务、锁、草稿、恢复、资源 fingerprint 和内部状态放入 `.reo`。
- `.reo/index.*` 只作为可重建缓存。
- 普通文件允许存在于记忆空间内；未被 Reo 对象引用或识别的文件不自动成为 Memory、Segment 或 Supplement。
- HTML 与其他可执行或可嵌入内容默认是 untrusted resource，未进入隔离预览能力前不由 Reo renderer 执行或渲染。

## 当前边界

- 当前产品只落地 audio Memory / Segment / supplement 基础闭环。
- `note`、`photo`、`video`、`imported_file` 和 HTML 作为文件合同预留类型；没有 current spec 前不实现完整 UI 或运行时。
- 不创建通用 ContentNode、Block runtime、插件 runtime、HTML preview runtime 或任意文件 registry。
- Supplement 只能作为 Segment 的一层补充内容；不支持 supplement 下再创建 supplement。

## 完成条件

- `memory.md`、`segment.md`、`supplement.md` 成为用户语义真源。
- 用户对象目录只用 `memory.md`、`segment.md` 和 `supplement.md` 承载语义真源。
- `.reo` 持有技术完整性；index/cache 删除后可以从 Markdown 对象和资源文件重建。
- AGENTS / CLAUDE 入口清楚声明 agent 可编辑边界、禁止编辑边界、任意文件规则和 HTML untrusted 规则。
- Main / IPC / preload / renderer / tests / docs 不保留并行文件模型分支。
- `docs/current/*` 和 `docs/decisions/*` 写入当前稳定事实。
- 对应 spec 完成 TDD、官方资料依据、subagent 审查和 `npm run verify:quick`。

## 读取入口

- `plan.md`
- `tasks.md`
