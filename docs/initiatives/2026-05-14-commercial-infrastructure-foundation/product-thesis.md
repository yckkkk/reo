# Reo 产品创新主张

## 核心判断

Reo 的杀手锏不是单纯记录，也不是再做一个聊天式 AI 工具。

Reo 的核心创新是：

```text
更好的记录平台
  -> 结构化、本地优先、长期积累的记忆空间
  -> 可被 Codex-style agent 使用的上下文
  -> 受 Reo 设计系统和 workspace 规则约束的创作输出
```

用户不是把内容存进去后再手工复制给 AI。用户在 Reo 里持续记录、整理、沉淀，然后让 agent 基于记忆空间中的材料创作新的产物。

## 产品差异化

Reo 的差异化来自四层组合。

1. 记录层：Reo 是本地优先的记忆空间，用来保存访谈、会议、研究材料、片段、洞察和创作上下文。
2. 上下文层：记忆空间中的文件、结构、元数据、用户选择和项目规则共同组成 agent 可使用的上下文。
3. 创作层：Codex-style agent 可以利用这些上下文生成新的 HTML、文档、报告、页面、PRD、增长实验或其他 artifact。
4. 约束层：Reo 为记忆空间初始化 `AGENTS.md`、skills、插件和设计系统约束，让普通用户也能在可控规则下使用 agent。

## 关键产品能力

### 1. Agent-ready Memory Space

每个记忆空间都应该能成为 agent 可工作的文件夹。

Reo 为普通用户初始化：

- `AGENTS.md`：说明该记忆空间的目标、内容边界、写作/创作规则、安全限制和输出要求。
- Skills：提供可复用的工作流能力，例如整理访谈、生成 PRD、生成增长实验、生成设计系统约束页面。
- Plugins：连接可用的 agent 能力和工具边界。
- Templates：给普通用户可直接选择的任务入口，而不是要求用户自己写复杂 prompt。

这不是面向工程师的裸 agent workspace，而是面向普通用户的受控创作环境。

### 2. Generative AI Surfaces

Reo 的主页和记忆空间页面可以逐步加入生成式 AI 入口。

这些入口不应是泛聊天框，而应围绕具体任务：

- 从当前记忆空间生成产品洞察。
- 从访谈和会议材料生成 PRD 草案。
- 从用户反馈生成增长实验。
- 从记忆空间数据生成设计系统约束的 HTML 页面。
- 从长期记录生成报告、作品集页面、项目总结或发布材料。

### 3. Design-system-constrained HTML Creation

Reo 可以让用户利用 Codex-style agent，把记忆空间中的数据创作为类似 HTML artifact 的页面。

关键约束：

- 输出必须遵守 Reo 的设计系统风格。
- 输出必须能追溯到记忆空间中的材料。
- 输出必须允许用户确认、编辑和回滚。
- 输出必须避免 agent 脱离上下文自由发挥。
- 输出必须在安全边界内运行，不让普通用户暴露在复杂工程细节里。
- HTML artifact 当前只是普通输出文件或隔离预览候选；隔离预览能力完成前，Reo trusted renderer 不执行、不注入、不渲染用户 HTML。

这个能力可以成为 Reo 和普通笔记、普通 AI chat、普通文档工具的显著差异。

### 4. Record to Create Loop

Reo 的长期价值链是：

```text
记录
  -> 整理
  -> 沉淀上下文
  -> agent 基于上下文创作
  -> 用户确认和编辑
  -> 新 artifact 回到记忆空间
  -> 下次创作拥有更多上下文
```

这个循环比单次 AI 生成更重要。Reo 不只是帮用户生成一次，而是让用户的长期记录持续变成可复用的创作资本。

## 与求职作品集的关系

这些创新点必须服务现有 5 个主交付物，不新增第 6 个主交付物。

| 创新点                              | 放入哪个主交付物                                  |
| ----------------------------------- | ------------------------------------------------- |
| Agent-ready Memory Space            | Product case study、Demo video                    |
| 初始化 `AGENTS.md`、skills、plugins | Product case study appendix、Beta field loop pack |
| 主页和记忆空间生成式 AI 入口        | Demo video、Product case study                    |
| 设计系统约束 HTML 创作              | Demo video 的未来扩展示例或 appendix              |
| Record to Create Loop               | Product case study 主叙事                         |

求职主叙事可以升级为：

```text
Reo 是本地优先的 AI workflow 和创作上下文平台。它帮助用户把访谈、会议和研究记录沉淀成 agent 可使用的记忆空间，再通过受控的 Codex-style agent 工作流生成可追溯的产品洞察、PRD、增长实验和设计系统约束的 HTML artifact 文件。
```

## 取舍

第一阶段不追求完整 agent 平台。

必须先证明：

- 记录内容能否稳定进入 agent workflow。
- Agent 输出是否能追溯证据。
- 普通用户是否能理解任务入口。
- 用户是否信任生成结果。
- 生成 artifact 是否真的减少创作成本。

后置内容：

- 完整插件市场。
- 完整 skills 管理后台。
- 多 agent 协作。
- 复杂权限系统。
- 完整云端同步。
- 对外开放 agent SDK。

## 功能更新纪律

每次 Reo 增加或改变会影响求职叙事、商业化边界、agent 能力、记录工作流、生成式 AI surface、内测验证或 public release gate 的功能时，都必须同步检查本 initiative。

检查顺序：

1. 是否改变 5 个主交付物之一。
2. 是否改变 Reo 的产品差异化叙事。
3. 是否改变 demo、eval、内测包或 case study。
4. 是否改变商业化基础设施边界。
5. 是否应该只进入 appendix，而不是主线。

如果功能更新只属于当前产品事实，还必须按 `docs/current/*` 门禁更新当前真源。本 initiative 只记录求职、商业化、增长和产品差异化相关的长期判断。
