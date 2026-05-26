# Agent 快路径与 Reo Doctor

## 意图

Reo 连接 Codex-class agent 的原则是提高判断效率，而不是限制 agent 能力。Agent 和人类仍然可以编辑任意文件；Reo 应该给一般任务提供最快正确路径：直接编辑语义文件和目录，复杂一致性由 Reo 静默收敛。`AGENTS.md` 只解释 Reo、记忆空间和实体定义，并导航到技能；普通编辑/创建/重命名/移动范式由 `reo-edit` skill 承载，异常诊断由 `reo-doctor` skill 和 bundled script 承载。

## 已锁定

- 一般内容任务不要求 agent 理解 `content.tiptap.json`、hash、canonical JSON 或 `.reo/objects`。
- 片段名、补充名和 tab rail 命名属于语义文件操作；agent 可以通过目录名、Markdown 标题和正文语义直接修改。
- Reo 不禁止直接编辑 JSON 或 `.reo`；这些是高级恢复、异常测试或专家路径，不是默认快路径。
- 每个记忆空间 root 应静默补全 Reo 托管的 `AGENTS.md` 内容、`skills/reo-edit/SKILL.md`、`skills/reo-doctor/SKILL.md` 和 doctor skill 内脚本。
- `AGENTS.md` 不承载具体操作手册；它只承载定义、文件层解释、协作原则和技能导航。
- 补全策略是托管块升级：缺失则创建；旧 Reo 托管内容升级；用户自定义内容保留。
- 打开/刷新时只做确定性修复；冲突、重复 id、无法判定来源的损坏内容进入 needs-review，未来由 Inbox sidebar 承接。

## 成功标准

- 新建记忆空间带有定义导航型 `AGENTS.md`、`skills/reo-edit` 和 `skills/reo-doctor`。
- 旧记忆空间缺失 `AGENTS.md`、skills 或 skill 脚本时，打开后静默补齐。
- 有用户自定义 `AGENTS.md` 时，Reo 只更新托管块，不覆盖用户内容。
- `reo-edit` 记录普通文件编辑、创建、重命名、移动和 Tiptap toolbar 富文本 Markdown/HTML 表达。
- `reo-doctor` script 位于 skill 内，能检查并安全修复确定性 Reo agent 配置缺失。
- Codex CLI E2E 能在不推理 sidecar/hash 的情况下完成普通内容编辑验证。

## 非目标

- 不重写当前 Tiptap sidecar core 合同。
- 不强制阻止 agent 编辑 JSON 或 `.reo`。
- 不在本轮实现 Inbox UI。
