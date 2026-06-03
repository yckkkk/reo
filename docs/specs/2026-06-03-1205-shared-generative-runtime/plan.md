# Plan

本 plan 只记录 M2 设计与后续实施切片，不是代码执行清单。

## Phase 0 - Initiative Reframe

- 更新 active initiative：M2 从 Widget Runtime 改为 Shared Generative Runtime。
- 保留作品作为首个 runtime consumer。
- 组件只做合同级预留。

## Phase 1 - Runtime Contract Design

- 定义 bundle 四件套：`entry.html`、`runtime.json`、`state.json`、`assets/`。
- 定义每对象 runtime URL / origin 模型。
- 定义外部编辑、fail-open 诊断和 M1 迁移策略。

## Phase 2 - Bridge Design

- 定义 `window.reo` vendor runtime。
- 定义 state、workspace、content、mutations、secrets、ui、agent 顶层 API。
- 定义 runtime session identity、message schema 和 stale/conflict 模型。
- 定义首批 high-frequency product mutations。

## Phase 3 - State And Secret Design

- 定义 `state.json` 命名 stores、schema version 和 baseline 写入。
- 定义 localStorage/IndexedDB 的兼容缓存地位。
- 定义 secret slots、object+slot 绑定、Reo 托管值和静默读取语义。

## Phase 4 - Skills And Templates

- 新增 shared generative runtime skill。
- 更新 works skill 复用 runtime skill。
- 设计宽模板矩阵，每个模板是可运行 bundle。
- 提供 scaffold / validate / inspect / migrate 脚本。
- Prompt 生成任务包，支持点击 Reo 入口和用户手动让 agent 在记忆空间内创建作品。

## Phase 5 - Validation Examples

- Todo / 复习表：验证状态持久化和 agent 可修改状态。
- 联网仪表盘：验证网络、CDN/framework 和 secret。
- Reo 内容工具：验证 bridge 读取内容与高频 mutation。

## Review Gates

- plan-eng-review：确认 URL/origin、bridge、state、secret、mutation 和 skill 边界。
- review：确认无 raw path、Node/Electron、generic filesystem bridge 或双真源问题。
- ycksimplify：确认没有把 runtime 抽象成过重平台，也没有重复造已有 IPC/transaction 轮子。
