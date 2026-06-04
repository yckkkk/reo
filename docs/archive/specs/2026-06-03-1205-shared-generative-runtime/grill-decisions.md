# Grill Decisions

本文件记录本轮 `$grill-me` 已收敛的决策。

## Runtime 基线

- M2 是用户拥有的本地 Web Runtime。
- 默认能力是 Web + Reo 全开。
- Reo runtime 不做权限弹窗、风险审批或内容审查。
- Reo managed skills 只记录文件合同和 `window.reo` API 形状，不承担风险教育、审批或内容审核。
- Reo 只守宿主边界：不让用户 HTML 进入 Reo renderer，不暴露 Node/Electron/raw path，不绕过 Reo typed mutation。

## 作品与组件

- 作品和组件不按能力区分。
- 二者共用 runtime object / bundle / bridge / state / secret / template 合同。
- 区别是挂载位置和生命周期：作品在 Segment/Supplement，组件未来在 Home、Workspace side tab、Memory panel/tab 等挂载点。
- M2 首个 consumer 是作品；组件只做合同级预留。

## Bundle

- 最小合同是 `entry.html`、`runtime.json`、`state.json`、`assets/`。
- `runtime.json` 是描述 + 启动，不是权限审批。
- `state.json` 是长期状态真源，硬边界是 JSON object + version/baseline；命名 stores 是默认推荐组织方式。
- localStorage 和 IndexedDB 允许使用，但不是 agent 可依赖的长期真源。
- 本地资源必须进入 bundle。

## Web 能力

- 作品是完整 Web app，不是静态 HTML preview。
- 支持前端框架、CDN、普通网页网络和 Web-safe 资源。
- M2 不提供 Reo CORS proxy。
- Secret API 提供 object+slot 绑定值，runtime 可静默读取。

## Bridge

- HTML 显式引入 Reo vendor script，获得 `window.reo`。
- API 按使用场景分组：state、workspace、content、mutations、secrets、ui、agent。
- Reo prompt action 由 Reo 生成骨架，作品只请求 documented action；Reo 使用可信对象身份、相对路径、skill 入口和文件合同拼出 prompt。
- Product mutation 复用 Reo 现有事务、baseline、stale conflict 和恢复模型；M2 works 只开放当前作品标题这类当前对象 mutation，不通过 bridge 写任意 note 正文。

## Agent 创作

- Skill 使用宽模板矩阵，但不限制用户自由想法。
- 每个模板是可直接运行和改写的成品 bundle。
- 用户 agent 可以目标驱动地追问，不限制次数，但不能空转。
- Reo prompt 提供任务包；用户不复制 prompt 时，AGENTS.md + skill 仍能让 agent 快速开始。
- Scaffold 脚本生成合法骨架；validate 脚本只检查能跑，不审查内容质量。

## 外部修改

- 用户和 agent 可以直接修改或替换 runtime bundle。
- Reo fail-open，不自动覆盖用户文件。
- 损坏时显示轻量故障面，提供复制诊断和让 agent 修复的 prompt。

## 验收

- Agent 快速创作和 runtime 能力完整同等重要。
- 使用三类样例验收：todo/复习表、普通 Web 状态工具、Reo 内容工具。
