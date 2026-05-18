# Reo 商业化与求职差异化叙事

本文档只承担商业化基础设施 initiative 的差异化叙事职责。Reo 的产品本质判断（agent-native 个人记忆 studio、三件套差异化、widget / HTML Segment / Gallery / prompt-bridge）见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`。

本文档不再决定产品本质；任何产品本质讨论以 ADR 0006 为准。

## 求职叙事主线

Reo 在求职作品集中的定位句：

> Reo 是给 prosumer 用户的 agent-native 个人记忆 studio：本地文件真源 + Codex-class agent 协作能力 + 极致交互气质三件套同时约束。它让普通有思考深度的用户把访谈、会议、研究和生活记录沉淀成 agent 可使用的记忆空间，并通过受控的 Codex-class agent 工作流生成可追溯的产品洞察、PRD、增长实验、设计系统约束的 HTML artifact 和自定义 widget。

## 差异化在求职作品集中的呈现

| 差异化判断（源自 ADR 0006） | 放入哪个主交付物 |
| --- | --- |
| Agent-native 个人记忆 studio 定位 | Product case study 主叙事 |
| 本地文件真源 + AGENTS.md / skills | Product case study appendix、Beta field loop pack |
| Widget runtime（日历 / 时间线等可定制 widget） | Demo video |
| HTML Segment / SegmentSupplement（设计系统约束的 agent 产物） | Demo video 的未来扩展示例或 appendix |
| Gallery 走马灯（极致交互气质承担页） | Demo video、Product case study |
| Prompt-bridge 入口 + Day 1 skills（引导 / 回顾 / 整理 / widget 生成） | Product case study、Beta field loop pack |
| Craft 不变量（录音场景感、Gallery 走马灯、视觉听觉节奏） | Demo video |
| Record-to-create loop（记录 → 整理 → 创作 → 回到记忆空间） | Product case study 主叙事 |

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
