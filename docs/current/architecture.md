# 架构

Reo 当前是最小 Electron + React + TypeScript + Vite 项目。

```text
src/
  main/       Electron main process
  renderer/   React renderer
docs/
  archive/    已收口任务记录
  current/    当前真源
  decisions/  长期 ADR
  initiatives/ 长期任务
  specs/      当前任务工作区
```

## 当前事实

- Electron main process 位于 `src/main`。
- React renderer 位于 `src/renderer`。
- Vite 集成由 `electron-vite` 管理。
- 当前没有 preload API。
- 当前没有 IPC surface。
- 当前没有 database layer。
- 当前没有 auth layer。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。

## 边界规则

- 保持目录浅，只有真实压力出现时才增加结构。
- 不得无明确边界创建 `services/`、`lib/`、`shared/`、`core/` 等桶。
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
- 精简不等于省略设计；必须先把实体、关系、协议、状态和组件边界想清楚，再选择更少的代码路径。

## 记忆 workspace 方向

Reo 的 memory workspace 是用户选择的本地文件夹。Workspace folder 是用户记忆内容的 durable artifact source；DB 只能作为索引、关系、查询和处理状态层。

Workspace root 使用 `AGENTS.md` 作为 Codex CLI 和未来 Reo 内置 AI 的协作入口。Reo metadata 位于 `.reo/workspace.json`。用户内容使用普通文件保存，例如 recording 的 `audio.webm`、`transcript.md` 和 `reflections.md`。

该方向已接受，见 `docs/decisions/0003-local-memory-workspace.md`。当前代码尚未实现 workspace 初始化、preload/IPC 文件能力、recording 或 persistence/index layer。

## 基础切片

除非用户调整优先级，按以下顺序引入基础能力：

1. Electron 安全与进程模型
2. Styling 与组件基础
3. Type、test 与质量基础
4. Auth 与数据库基础
5. Data fetching 与状态归属
6. Packaging、updater、logging 与 crash reporting

每个 slice 必须在代码变更前或同批更新对应 `docs/current/*`。
