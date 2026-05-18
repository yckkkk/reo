# Reo 商业化与求职差异化叙事

本文档承担商业化基础设施 initiative 的差异化叙事职责。Reo 的产品本质判断见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`，外向定位叙事与电梯演讲见 `positioning.md`，竞品分析见 `competitive-analysis.md`。

本文档不决定产品本质；任何产品本质讨论以 ADR 0006 为准。

## 求职叙事主线

Reo 在求职作品集中的定位句：

> Reo 是让用户围绕一件事产生的所有材料——录音、视频、照片、笔记、上传文件——被 Codex-class agent 转化成只属于用户的作品（widget / HTML / 走马灯）的私人空间。差异化由四件套同时约束：主题容器 Memory、多模态平等、agent 转化、唯一作品。三件套（本地文件真源 + agent-native 协作 + 极致交互气质）作为支撑结构。目标用户是 Obsidian 类 prosumer 创作者与思考者：写作者、研究者、podcasters、深度学习者、parent journalers 等。

## 差异化在求职作品集中的呈现

| 差异化判断（源自 ADR 0006 + positioning.md） | 放入哪个主交付物 |
| --- | --- |
| 多模态主题容器（Memory）作为组织轴 | Product case study 主叙事 |
| Agent 在用户完整 Memory 上转化成作品 | Product case study 主叙事、Demo video |
| 唯一作品 moat（材料是你的 + agent 替你做）| Product case study、Pitch deck |
| 本地文件真源 + AGENTS.md / skills | Product case study appendix、Beta field loop pack |
| 跨模态 Widget runtime（成长册 / 关系曲线 / 概念时间线等）| Demo video |
| HTML Segment / SegmentSupplement（agent 生成的作品落到文件合同）| Demo video 的未来扩展示例或 appendix |
| Gallery 走马灯（跨模态视觉听觉沉浸回顾）| Demo video、Product case study |
| Prompt-bridge 入口 + Day 1 skills（引导 / 回顾 / 整理 / widget 生成 / 思考视角）| Product case study、Beta field loop pack |
| Craft 不变量（各模态捕获 / 回放场景感、Gallery 节奏）| Demo video |
| Record-to-create loop（积累 → agent 转化 → 作品 → 回到 Memory）| Product case study 主叙事 |

## 与 5 个主交付物的关系

本 initiative 的求职差异化叙事必须服务现有 5 个主交付物，不新增第 6 个主交付物。具体交付物清单与节奏由 `plan.md` 与 `tasks.md` 维护。

## 商业化取舍

Reo 第一阶段不追求完整 agent 平台。当前阶段优先证明：

- 记录内容能否稳定进入 agent workflow
- Agent 输出是否能追溯证据
- Prosumer 用户能否理解 Entity More 菜单的 `agent 操作` 入口
- 用户是否信任生成结果
- 生成 artifact 是否真的减少创作成本

后置内容：

- 完整插件市场
- 完整 skills 管理后台
- 多 agent 协作
- 复杂权限系统
- 完整云端同步
- 对外开放 agent SDK
- Reo runtime 内嵌 AI agent（当前阶段使用外部 Codex-class agent + prompt-bridge）

## 功能更新纪律

Reo 任何会影响求职叙事、商业化边界、agent 能力、记录工作流、generative UI、内测验证或 public release gate 的功能变更，都必须同步检查本 initiative。

检查顺序：

1. 是否改变 5 个主交付物之一
2. 是否改变 Reo 的商业化差异化叙事
3. 是否改变 demo、eval、内测包或 case study
4. 是否改变商业化基础设施边界
5. 是否应该只进入 appendix，而不是主线
6. 是否触发 ADR 0006 / 0003 / 0002 / 0001 中的长期决策（如果是，先在 ADR 层确认）

如果功能更新只属于当前产品事实，必须按 `docs/current/*` 门禁更新当前真源。本 initiative 只承担商业化、求职、增长和外部叙事相关判断，不重复 ADR 0006 的产品本质判断。
