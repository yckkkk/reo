# 面试就绪准则

## 总结判断

Reo 继续作为转行 AI 产品经理主作品集。增长产品经理是副线，FDE 式用户现场与部署理解是新能力层，前端部署和工程协作能力是支撑项，不作为并列主线。

Reo 的求职 ROI 来自一个可评估的 AI 产品工作流，而不是完整商业化 SaaS 基建。招聘材料必须先展示用户问题、稳定 demo、AI eval、内测反馈和路线图取舍；商业化基础设施只保留为 public paid release gate。

产品差异化来自 Record to Create loop：Reo 让用户持续记录，然后让 Codex-style agent 在记忆空间上下文、`AGENTS.md`、skills、plugins 和设计系统约束下生成可追溯 artifact。

## 岗位定位

| 方向 | 定位 |
| --- | --- |
| AI 产品经理 | 主投方向，作品集标题和简历叙事围绕这个方向组织 |
| AI 应用产品经理 | 最匹配方向，强调把 AI 放进真实工作流 |
| AI 工具产品经理 | 可投方向，强调本地优先、证据引用、eval 和工作台 |
| 增长产品经理 | 副线，用内测群、waitlist、激活漏斗和反馈闭环证明 |
| FDE-shaped PM | 加分能力层，用用户现场、快速原型、部署边界、playbook 和 field signal 证明 |
| 技术型产品经理 | 加分项，用架构边界、隐私、成本、发布风险证明协作能力 |
| 前端部署工程师 | 不作为目标岗位，只作为产品经理理解工程落地的证据 |

## ICP 收缩

第一批作品集只服务一个主 ICP：

```text
需要整理用户访谈、会议复盘或研究材料的早期产品经理。
```

暂不同时覆盖创业者、研究型 PM、所有独立产品人和所有转行 AI PM。其他画像可以作为扩展用户，不进入第一版主叙事。

主任务：

- 整理用户访谈。
- 整理会议复盘。
- 从材料中提取需求、痛点、机会点和证据引用。
- 把洞察转成 PRD 草案、用户故事或增长实验假设。

## 最小作品集

只保留 5 个主交付物：

1. Demo video：5 分钟 AI 工作流，包含成功路径、失败恢复和 eval overlay。
2. AI eval report：20 到 30 条样本、baseline、失败分析、成本和延迟。
3. Product case study：8 到 12 页，讲用户、问题、workflow、指标和路线图。
4. Beta field loop pack：内测任务、反馈 taxonomy、feedback to roadmap log 和 3 条闭环。
5. Interview one-pager：简历 bullet、60 秒 pitch、主叙事、FAQ 和作品集入口。

AI-native PM operating model、human-AI collaboration map、FDE-shaped field loop、model release review 不再作为独立主交付物。它们只能嵌入上述 5 个交付物，或进入 appendix。

Agent-ready memory space、初始化 `AGENTS.md`、skills、plugins、生成式 AI surface 和设计系统约束 HTML creation 也不能新增主交付物。它们必须作为 demo、case study 或 appendix 的产品差异化证据。

只放 appendix 的内容：

- 商业化基础设施蓝图。
- 开源复用评估。
- AI Gateway 长期架构。
- Provider cost ledger。
- Model release review 详细记录。
- FDE field loop 原始日志。
- 前端部署 checklist。

## Demo 标准

唯一主 demo：

```text
导入一段用户访谈或会议材料
  -> Reo 生成带证据引用的需求、痛点、机会点、风险和下一步建议
  -> 用户选择一条洞察生成 PRD 草案或增长实验假设
  -> Reo 展示证据来源、置信度、失败恢复和成本延迟信息
```

Demo 必须准备三类样本：

- 稳定成功样本。
- 真实但有噪音的样本。
- 失败样本：空输入、低质量转写、证据缺失、敏感内容或幻觉输出。

Demo 使用三段式结构：

1. 成功路径：导入材料，生成洞察，选择一条洞察，生成 PRD 草案或增长实验假设。
2. 失败路径：低质量转写、证据缺失或敏感内容触发低置信度、阻断或修正建议。
3. 学习闭环：用户修改一条洞察，系统记录 correction reason，进入 eval set 或 feedback taxonomy，形成 roadmap decision。

如果 demo 展示 Codex-style 创作，只能作为成功路径的扩展：基于已确认洞察和记忆空间上下文生成一个设计系统约束的 HTML artifact。该扩展不能取代主 demo 的洞察、证据、eval 和反馈闭环。

Demo 末尾展示 eval overlay，只保留 3 个指标：

- 证据引用正确率。
- 人工修正时间。
- Cost per accepted insight。

## AI Eval 标准

Eval 必须覆盖：

- 准确性。
- 完整性。
- 证据引用正确性。
- Schema compliance rate。
- Source coverage。
- Unsupported claim rate。
- 幻觉率。
- 可操作性。
- Decision usefulness。
- 延迟。
- 成本。
- 人工修正时间。
- Retry or recovery success rate。
- Sensitive data handling success rate。
- Autonomy level accuracy。

必须有 baseline：

- 人工整理。
- 普通聊天式 AI。
- Reo workflow。

建议 North Star Metric：

```text
每周被用户保留并继续编辑的可追溯洞察数。
```

辅助指标：

- Time to first insight。
- Insight acceptance rate。
- Evidence correction rate。
- Hallucination report rate。
- Cost per successful insight。
- 7 day revisit。

面试中优先展示 6 个指标：

- 证据引用正确率。
- Unsupported claim rate。
- 人工修正时间。
- Insight acceptance rate。
- Cost per accepted insight。
- 7 day revisit。

Eval 样本结构：

- 5 条干净用户访谈。
- 5 条噪音会议材料。
- 5 条模糊材料。
- 5 条证据稀疏材料。
- 5 条敏感或隐私材料。
- 可选 5 条内测真实材料。

## 内测运营标准

内测群不是聊天群，而是小型 beta program。

第一轮 cohort：

- 招募 15 人。
- 有效完成 8 到 12 份任务反馈。
- 主体是早期 PM 或转行 AI PM。
- 补充少量独立产品人或创业者。

入选条件：

- 最近 30 天做过用户访谈、会议复盘、竞品研究或需求整理。
- 愿意完成一次 20 分钟任务。
- 同意反馈被匿名整理进 case study。

内测任务：

1. 导入一段访谈或会议材料。
2. 生成洞察。
3. 检查每条洞察是否有证据引用。
4. 把一条洞察改成 PRD 用户故事或增长实验假设。
5. 标记会保留、删除、修改的输出。
6. 回答是否节省整理时间、是否提升洞察可信度。
7. 判断是否愿意下次继续使用。

必须产出：

- 招募画像。
- 招募文案。
- 入群问卷。
- 任务脚本。
- 反馈表。
- 问题 taxonomy。
- Feedback to roadmap log。
- 版本回访记录。

补充产出：

- FDE-shaped field loop：用户现场、原型、部署边界、反馈、playbook、产品路线图。
- Human-AI collaboration map：用户确认点、AI 自主度、证据引用、人工修正和阻断条件。
- Agent setup evidence：初始化 `AGENTS.md`、skills、plugins 和普通用户任务模板如何降低 agent 使用门槛。

## 2/4/8 周路线

### 2 周：建立 AI PM 可信核心

只做：

- 锁定 ICP。
- 完成 5 分钟 demo v1。
- 加入 human-AI 控制点：用户确认、人工修正、证据缺失阻断、低置信提示。
- 定义 eval rubric：准确性、完整性、证据引用正确性、unsupported claim、可操作性、人工修正时间、延迟和成本。
- 准备 10 条样本并跑第一版评估。
- 写 case study 大纲和 60 秒 pitch。
- 准备内测招募文案、screener、任务脚本和反馈表。

不做：

- 支付、会员、登录、阿里云、后台、完整 AI Gateway、完整官网。

### 4 周：补齐 AI eval 和增长证据

只做：

- 扩展到 20 到 30 条 eval 样本。
- 完成人工整理、普通聊天式 AI、Reo workflow baseline 对比。
- 记录单次成本、平均延迟、失败率和人工修正时间。
- 跑第一轮内测，招募 15 人，完成 8 到 12 份有效任务反馈。
- 做 landing page 或 waitlist。
- 建立指标树和事件字典。
- 形成 3 条 feedback to roadmap 闭环。

不做：

- 复杂 SEO、生产遥测、真实收费、云资源落地、完整后台。

### 8 周：形成招聘级作品集

只做：

- 打磨 demo v2，覆盖成功路径、失败路径和敏感内容处理。
- 完成 8 到 12 页 case study。
- 完成 5 分钟演示视频。
- 完成简历项目 bullet 和面试问答稿。
- 跑第二轮内测或回访，验证 top 2 改动。
- 加 appendix：商业化 release gate、FDE field loop、model release review 和架构边界。

不做：

- 真实支付、手机号或微信登录、阿里云生产部署、OpenMeter/Lago 生产集成、完整 admin、完整 CMS。

## 风险与修正

| 风险 | 严重程度 | 最小修正 |
| --- | --- | --- |
| 项目太工程化 | 高 | 作品集首页只放 demo、eval、用户反馈和 case study |
| 商业化基础设施过重 | 高 | 商业化只保留 public paid release gate |
| 用户验证不足 | 高 | 两周内招募 10 到 15 个 beta 用户，至少完成 8 份任务反馈 |
| 没有真实指标 | 高 | 至少记录报名率、任务完成率、洞察生成率、洞察保留率和 7 日回访意愿 |
| Demo 不稳定 | 高 | 准备固定样本、真实样本、失败样本，现场演稳定路径 |
| Eval 停留在口头 | 高 | 完成 20 到 30 条样本评分表和 baseline |
| 叙事不像 PM | 中高 | 所有材料按用户问题、取舍、指标、结果、下一步组织 |
| 目标岗位过散 | 中高 | 简历标题只写 AI Product Manager |
| 行业定位不清 | 中 | 先锁 PM productivity 或 product research workflow |
| 材料不招聘友好 | 高 | 做一页 portfolio landing，入口是问题、demo、结果、eval、反馈和角色 |

## 每周验收门槛

每周只验收三件事：

- Demo 是否更稳定。
- Eval 是否新增样本或新增失败分析。
- 用户是否完成真实任务并产生反馈。

如果本周工作不能推动这三件事之一，默认后置。

Reo 功能更新后，还必须检查本 initiative 是否需要同步：

- 是否改变主 demo。
- 是否改变 eval 或内测任务。
- 是否改变 Record to Create 产品差异化。
- 是否改变商业化 release gate。
- 是否只是 appendix 内容。

## 简历叙事

简历标题：

```text
AI Product Manager | AI Workflow, Eval, and Growth Validation
```

英文版本：

```text
Designed and built Reo, a local-first AI workflow and creation-context tool that turns user interviews and meeting notes into traceable product insights, PRD drafts, growth hypotheses, and design-system-constrained artifacts. Defined human-AI collaboration boundaries across AI-generated insights, evidence citations, user confirmation points, manual correction, confidence signals, and blocking conditions. Designed an agent-ready memory space model with workspace rules, skills, plugins, and templates so Codex-style agents can use user records as controlled creation context. Built an eval framework across accuracy, completeness, evidence citation correctness, unsupported claim rate, hallucination rate, latency, cost, and human correction time, with baseline comparison against manual synthesis and generic chat-based AI. Ran a structured beta workflow with task scripts, feedback taxonomy, and feedback-to-roadmap logs to convert field signals into reusable templates, eval cases, and roadmap decisions.
```

中文版本：

```text
设计并推进 Reo，本地优先的 AI 产品工作流与创作上下文工具，用于将用户访谈和会议材料转化为可追溯产品洞察、PRD 草案、增长实验假设和设计系统约束 artifact。定义人机协作边界，覆盖 AI 自动生成、证据引用、用户确认点、人工修正、置信度提示和阻断条件。设计 agent-ready memory space 模型，通过 workspace 规则、skills、plugins 和模板，让 Codex-style agent 将用户记录作为受控创作上下文。设计 AI eval 体系，评估准确性、完整性、证据引用正确性、无证据结论比例、幻觉率、延迟、成本和人工修正时间，并对比人工整理、通用聊天式 AI 和 Reo workflow。通过结构化内测任务、反馈 taxonomy 和 feedback-to-roadmap log，将用户现场信号沉淀为复用模板、eval case 和路线图决策。
```
