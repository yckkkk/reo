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
- 当前 main process 拥有 workspace 目录选择、初始化、打开、关闭、记忆空间标题更新、Memory 容器创建、Memory/Segment/SegmentSupplement 标题更新、recording draft 写入和 audio chunk 读取、note draft、finalized note body 写入、finalized note 图片附件写入与 `reo-attachment://` 预览协议、语音设置、流式语音识别 session 和 finalized audio 文件转录队列能力。
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

记忆空间 root 使用 `AGENTS.md` 作为 agent 协作入口。Reo metadata 位于 `.reo/workspace.json`，可重建 index 位于 `.reo/index.json`，对象技术完整性 manifest 位于 `.reo/objects/<kind>/<id>.json`，single-writer lock 位于 `.reo/workspace.lock*`。用户语义内容使用普通 Markdown 文件保存：Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`；audio 对象额外保存 `audio.webm`，note 正文和 audio transcript 都可使用同节点 `content.tiptap.json` 富结构载体，note 对象还可使用同节点 `attachments/`。Audio sidecar 只映射 `## Transcript` 正文，不映射音频元数据或整个 Markdown 文件。Draft 位于 `.reo/drafts/*`，trash 位于 `.reo/trash/*`。目录 basename 是用户可见名称真源；Segment 和 SegmentSupplement 的 Markdown frontmatter `id` 是身份载体，`.reo/objects/*/*.json` manifest 镜像身份、归属和技术完整性字段。合法外部编辑通过 index cache、active snapshot refresh 和 focused detail read 重新投影 UI；合法外部跨父级移动必须移动整个 Segment 或 SegmentSupplement 目录，由读模型修复 manifest parent mirror。普通 `.json`、`.html` 或未被对象合同识别的文件不自动成为 Reo 对象。字段级文件合同见 `data.md` 和 `flow.md`。

当前没有 DB-backed persistence layer。

## 能力变更规则

能力变更必须先核对对应 `docs/current/*`。只有当改动改变架构模型、process boundary、文件模型、能力边界、跨任务不变量或当前能力索引时，才更新 current；任务级实现步骤、测试枚举和验证证据留在 spec 或 archive。当前已存在的能力边界以本文档、`electron.md`、`data.md`、`flow.md`、`frontend.md` 和 `quality.md` 为准；未实现的 auth、database、packaging、updater、remote telemetry、renderer/preload logging bridge 和 crash reporting 不作为当前 runtime surface。
