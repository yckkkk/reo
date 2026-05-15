# 架构

Reo 当前是 Electron + React + TypeScript + Vite 本地优先产品基础。

```text
src/
  main/       Electron main process
  preload/    Electron preload bridge
  renderer/   React renderer
  workspace-contract/ Workspace IPC schemas, channel names, bridge contract types, and schema-free value helpers
docs/
  archive/    已收口任务记录
  current/    当前真源
  decisions/  长期 ADR
  initiatives/ 长期任务
  specs/      当前任务工作区
```

## 当前事实

- Electron main process 位于 `src/main`。
- Preload bridge 位于 `src/preload`。
- React renderer 位于 `src/renderer`。
- Vite 集成由 `electron-vite` 管理。
- 当前 preload API 是 `window.reoWorkspace`。
- 当前 IPC surface 是显式 workspace channels。
- 当前 workspace IPC channel names、request/response Zod schemas、bridge contract types 和 schema-free value helpers 位于 `src/workspace-contract`；renderer/preload 只消费类型、窄 bridge 或 schema-free helpers，main process 拥有 schema 校验。
- 当前 main process 拥有 workspace 目录选择、初始化、打开、关闭、记忆空间标题更新、Memory 容器创建、Memory 标题更新、recording draft 写入和 audio chunk 读取能力。
- 当前 main process 拥有本地诊断日志能力，用于 app lifecycle 和 workspace IPC request completion 的结构化诊断；该能力不暴露 renderer/preload logging bridge、诊断 IPC 或远程 telemetry。
- 当前没有 database layer。
- 当前没有 auth layer。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。

## 边界规则

- 先用第一性原理定义正确模型，再落文件、模块和分支；不得在错误模型上叠加兼容、兜底或状态管理。
- 保持目录浅，只有真实压力出现时才增加结构。
- 不得无明确边界创建 `services/`、`lib/`、`shared/`、`core/` 等桶。
- 文件夹和文件名必须表达产品实体、能力边界或真实复用层级；Workspace、Memory、Segment 等核心实体不得被错误层级名称承载。
- Feature-local components 留在业务目录内；只有跨 feature 复用和稳定不变量成立时，才提升到共享 UI 或共享 runtime 模块。
- 优先采用包和框架的目录约定，不自创架构。
- 新 capability 先评估官方方案和成熟开源包；复用、适配、fork 或自研的判断必须记录 current feature 的 consumer、约束、风险和测试路径。
- 新可复用模块需要至少两个真实消费者，或明确的平台边界。
- 新抽象必须消除有意义的重复，或强制真实不变量。
- 不保留占位目录。

## 设计纪律

- 前端、preload、IPC、main process、数据和状态设计必须先定义责任、边界、输入输出、错误和验证方式，再决定文件结构。
- 设计不能从“自己实现一个简版”开始；必须先完成 official/open-source reuse evaluation。
- 不得为了实现界面效果临时拼接模块、状态或 IPC channel。
- 不得用分层命名制造空抽象；目录和模块必须来自真实 capability、process boundary、data owner、component invariant 或测试边界。
- 代码设计必须同时检查精简性：减少不必要的复杂性和嵌套，消除冗余代码和过度抽象，自动应用项目代码规范。
- 精简不等于省略设计，也不等于删功能；必须先把实体、关系、协议、状态和组件边界想清楚，再选择更少的代码路径。

## 记忆空间文件模型

Reo 的记忆空间是用户选择的本地文件夹。记忆空间 folder 是用户记忆内容的 durable artifact source；DB 只能作为索引、关系、查询和处理状态层。

记忆空间 root 使用 `AGENTS.md` 作为 Codex CLI 和未来 Reo 内置 AI 的协作入口。Reo metadata 位于 `.reo/workspace.json`，可重建 index 位于 `.reo/index.json`，对象技术完整性 manifest 位于 `.reo/objects/<kind>/<id>.json`，single-writer lock 使用 `.reo/workspace.lock` 与同目录 `.reo/workspace.lock.lock`，并绑定当前记忆空间 root 和 `.reo` directory identity；lock directory owner 写入当前 main process pid 和进程启动指纹，owner 进程已退出或启动指纹不匹配的 stale lock 只允许在重新获取 lock 时被替换。用户内容使用普通文件保存：Memory 语义层位于 `memories/<memoryDirectory>/memory.md`，finalized audio Segment 语义层位于 `memories/<memoryDirectory>/segments/<segmentDirectory>/segment.md`，finalized audio SegmentSupplement 语义层位于 `memories/<memoryDirectory>/segments/<segmentDirectory>/supplements/<supplementDirectory>/supplement.md`，draft audio Segment 位于 `.reo/drafts/segments/<segmentId>/`，draft audio SegmentSupplement 位于 `.reo/drafts/supplements/<supplementId>/`。记忆空间 root folder basename 是记忆空间 title 的用户可见文件真源；`.reo/workspace.json.title` 是同一事实的 metadata mirror，registry 是 main-owned 列表投影。Memory、Segment 和 SegmentSupplement 的稳定 id、归属、时长、音频字节数和事务字段写在 `.reo/objects/*` manifest 中；目录 basename 是用户可见名称真源，Reo 写入时使用 `<id>--<title>`，读取时用 manifest id 建立身份和归属。Reo 发起的记忆空间重命名必须在 single-writer lock 下同步移动 root folder、写回 `.reo/workspace.json.title` 并更新 registry projection；Finder 直接改名则在后续 open 获取 lock 且确认 workspaceId 匹配后，把 folder basename 写回 metadata mirror 和 registry projection。合法 Markdown/frontmatter、合法 `.reo/objects/*` manifest 和合法节点目录外部编辑属于当前文件真源模型；普通 `.json`、`.html` 或未被对象合同识别的文件不自动成为 Reo 对象。Reo 通过打开时的合法 index cache、active snapshot refresh 和 focused detail read 从文件重新投影 UI。

当前没有 DB-backed persistence layer。

## 能力变更规则

每个能力变更必须在代码变更前或同批更新对应 `docs/current/*`。当前已存在的能力边界以本文档、`electron.md`、`data.md`、`flow.md`、`frontend.md` 和 `quality.md` 为准；未实现的 auth、database、packaging、updater、remote telemetry、renderer/preload logging bridge 和 crash reporting 不作为当前 runtime surface。
