# AI 角色演化与 Reo 能力映射

## 判断

AI 公司里的产品、工程、增长和客户部署边界正在变薄。Reo 的求职叙事不能只停留在传统 PM 的 PRD、竞品、路线图，也不能滑向纯工程项目。最适合的定位是：

```text
AI-native 产品经理主线
  + 增长验证副线
  + FDE 式客户现场与部署理解
```

FDE 不是当前主投岗位。FDE 要求更强工程年限、客户现场交付和生产系统部署经验。Reo 应该证明的是产品经理具备 FDE 式基础能力：能进入用户工作流、快速原型、定义 eval、推动内测、识别可复用模式、把现场反馈转成产品路线图。

## 外部信号

Anthropic 对 AI 产品管理的描述强调四个变化：

- 短周期实验替代长期确定性路线图。
- Demo 和 eval 比长文档更能推动判断。
- 每次模型能力提升都要重新审视旧功能。
- 简单实现优先，因为模型限制可能很快消失。

Anthropic 还强调 PM 的新职责是处理快速模型进步带来的不确定性，创造清晰目标，让团队更快 shipping，并同时追踪 AI 如何改变工作方式和产品可能性。

FDE 岗位信号更接近客户现场：

- 嵌入客户环境，理解真实工作流。
- 从原型到生产交付 AI 应用。
- 交付 MCP server、sub-agent、agent skill、集成脚本、playbook 等技术产物。
- 定义 eval loop，衡量模型和系统质量。
- 把 field signal 反馈给 Product、Research、Engineering 和 GTM。
- 将一次性部署沉淀成可复用模式、参考架构和工具。

Anthropic Economic Index 的信号说明，理解 AI 工作影响时不能只看“是否自动化”，还要看任务复杂度、人类和 AI 技能、工作/教育/个人场景、AI 自主度和任务成功率。Reo 的 eval 与内测也应该沿着这些维度观察人机协作。

## 新能力模型

Reo 求职材料应该证明 7 类能力。

| 能力 | 证明方式 |
| --- | --- |
| AI workflow design | 把访谈/会议材料转成可追溯洞察、PRD 草案和增长实验假设 |
| Eval literacy | 样本集、rubric、baseline、失败案例、成本和延迟 |
| Prototype-first execution | 用短周期 demo 替代长期抽象方案 |
| Human-AI collaboration design | 明确用户控制点、证据引用、置信度、人工修正和失败恢复 |
| Field discovery | 内测群、任务脚本、用户反馈、回访和现场问题 taxonomy |
| Deployment sense | 本地优先、provider 调用边界、密钥边界、发布风险和最小运维 |
| Pattern codification | 把内测反馈和部署经验沉淀成模板、playbook、eval set 和 roadmap decision |

## Reo 应该新增的作品集证据

### 1. AI-native PM 工作方式

材料中要展示：

- 不是先写完整 PRD，而是先定义问题、做 demo、跑 eval、找用户。
- 每个阶段都有 demo 或 eval 证据。
- 功能被模型能力变化重新评估，而不是固定在旧约束上。
- 复杂系统优先简化，避免为短期模型限制堆 workaround。

### 2. FDE 式用户现场能力

材料中要展示：

- 如何进入用户当前工作流。
- 用户原本如何整理访谈、会议和研究材料。
- Reo 插入工作流后减少了什么步骤。
- 用户在真实任务里哪里卡住。
- 哪些问题是产品问题，哪些是模型问题，哪些是数据/部署问题。
- 哪些反馈可以沉淀成通用模板或产品能力。

### 3. 人机协作边界

Demo 中必须展示：

- 哪些由 AI 自动生成。
- 哪些必须由用户确认。
- 哪些证据引用支持洞察。
- 哪些输出低置信度。
- 哪些内容需要人工修正。
- 何时阻止 AI 继续生成。

### 4. 模型能力复盘

每次重要模型或 provider 变化后，保留一个轻量复盘：

- 原来失败的样本是否变好。
- 原来需要 workaround 的提示词或流程是否可以删除。
- 是否可以提升输出质量、降低成本或减少交互步骤。
- 是否需要更新 eval set。

这不是追新模型，而是证明 AI PM 能跟上模型能力边界变化。

## 角色边界

| 角色 | Reo 如何体现 | 不做什么 |
| --- | --- | --- |
| AI PM | 用户问题、AI workflow、eval、路线图、取舍 | 不把作品集变成纯技术架构 |
| Growth PM | 内测招募、activation、retention、waitlist、实验 backlog | 不做虚假的大规模增长指标 |
| FDE-shaped PM | 用户现场、快速原型、部署边界、playbook、field signal | 不宣称自己是资深 FDE |
| 前端部署协作 | Electron、本地优先、发布风险、错误恢复、基础部署理解 | 不主投前端或平台工程师 |

## Reo 的新增面试叙事

推荐增加一段：

```text
我把 Reo 当作 AI-native 产品经理训练项目，而不是传统 PRD 项目。我的工作方式是短周期验证：先进入用户当前整理访谈和会议材料的工作流，做一个能跑的 AI workflow demo，再用 eval 样本和内测任务验证输出质量、用户控制点和激活阻力。增长副线用于验证获客和激活，FDE 式能力用于证明我能理解客户现场、部署边界和工程协作，但我的主投方向仍然是 AI 产品经理。
```

## Reo 后续应该补的材料

- 一页 AI-native PM operating model：问题、demo、eval、内测、路线图、模型复盘。
- 一页 human-AI collaboration map：用户、AI、证据、确认、修正、阻断。
- 一页 FDE-shaped field loop：用户现场、原型、部署边界、反馈、playbook、产品路线图。
- 一页 model release review：模型变化如何影响 Reo 的旧功能和 eval。

## 官方来源

- https://claude.com/blog/product-management-on-the-ai-exponential
- https://www.anthropic.com/careers/jobs/4985877008
- https://openai.com/careers/forward-deployed-engineer-nyc-new-york-city/
- https://openai.com/careers/forward-deployed-engineer-semiconductor-san-francisco/
- https://www.anthropic.com/research/anthropic-economic-index-january-2026-report
