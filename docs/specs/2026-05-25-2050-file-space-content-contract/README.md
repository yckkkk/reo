# 文件空间内容合同

## 元信息

- 时间：2026-05-25 20:50 PDT
- 范围：人类和 Codex-class agent 通过普通文件系统创建、移动、重命名、编辑 Reo 内容对象的文件合同；Note Segment、Note SegmentSupplement、Markdown 表示、可选 Tiptap JSON 表示、对象扫描、自愈补全、冲突分类和验证标准。
- 非范围：改变当前 Tiptap 编辑器视觉、改变当前 Markdown 预览、内嵌 AI runtime、Tiptap AI Toolkit runtime 集成、完整多模态 Segment、Widget runtime、外部 agent SDK。

## 目标

Reo 的记忆空间必须首先是人类可直接操作的本地文件空间，同时也是 Codex-class agent 可直接操作的本地文件空间。Codex 不是特殊权限主体，只是更擅长批量编辑、结构化 JSON、富文本 mark 和验证修复的高级文件编辑者。

本设计的目标是：

- 人类可以用 Finder、编辑器或终端直接创建、移动、重命名和编辑内容对象。
- Codex 可以像操作普通工程项目一样直接读写 Reo 文件。
- Reo 打开或刷新时负责识别、补全、检查、修复和安全投影。
- 缺 manifest、缺 stable id、目录名不标准、index stale 这类技术不完整状态不应导致内容消失。
- 只有安全风险、重复身份不可解、跨 workspace 污染或不可恢复解析失败才拒绝投影。
- 当前编辑器和预览体验不改变。

## 设计原则

1. **文件空间是共享接口**：人类和 agent 面对同一套目录和文件，不建立 Codex-only 路径。
2. **内容对象高于表示格式**：Reo 操作的是 Memory、Segment、SegmentSupplement；Markdown、Tiptap JSON 和未来工具视图只是同一对象的表示。
3. **普通文件表达用户意图**：目录位置、`segment.md`、`supplement.md` 和正文内容优先表达用户想创建或移动什么。
4. **技术一致性由 Reo 承担**：`.reo/objects/*/*.json`、`.reo/index.json`、hash、projection freshness 和 content tab order 不应成为普通用户负担。
5. **低摩擦优先，安全边界不让步**：Reo 默认容错读取和自愈补全；symlink、路径逃逸、root swap、duplicate id、跨 workspace manifest 等仍必须阻断。
6. **JSON 可编辑但不是门槛**：Codex 和高级用户可以编辑 JSON；普通用户只写 Markdown 也应被接收。

## 当前事实

- 记忆空间 root 是 durable artifact source；DB 只能作为索引、关系、查询和处理状态层。
- 用户语义内容当前保存为普通 Markdown：Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。
- `.reo/workspace.json`、`.reo/index.json`、`.reo/objects/*/*.json`、draft、trash、lock 和 recovery marker 是 Reo 管理的技术完整性层。
- 当前 note Segment 和 note SegmentSupplement 的 UI 创建路径会通过 draft/finalize 写出 Markdown 和 manifest。
- 当前删除/恢复已使用目录移动模型；重命名已使用目录 basename 与 Markdown title 镜像模型。
- 当前 Tiptap 编辑器保存正文时使用 `editor.getMarkdown()`，高亮等富文本信息落在 Markdown dialect 或 Markdown-compatible HTML 中，不存在持久化 `tiptap.json`。

## 内容对象模型

一个 Reo 内容对象包含身份、语义正文、一个或多个表示，以及 Reo 管理的技术完整性层。

```text
Content Object
  identity:
    Workspace / Memory / Segment / SegmentSupplement
  semantic body:
    用户真正关心的内容
  representations:
    markdown
    content.tiptap.json       可选
    text/html/shorthand       未来读取或工具视图
  reo-managed integrity:
    .reo/objects/*/*.json
    .reo/index.json
    hashes / projection freshness / contentTabOrder
```

当前 phase 的 durable semantic truth 仍是 Markdown/frontmatter：`segment.md` 和 `supplement.md` 是人类与 agent 都可直接编辑的语义真源，`.reo` 是技术完整性层。Tiptap JSON 只能作为未来受 freshness contract 管理的辅助结构表示，不在本 spec 首期取代 Markdown。

## 最小文件合同

### 创建 Note Segment

人类或 agent 最少只需要在某个 Memory 下创建：

```text
memories/<memory-directory>/segments/<any-title>/segment.md
```

`segment.md` 可以只有正文：

```markdown
今天的想法……
```

也可以包含 frontmatter：

```markdown
---
title: 今天的想法
kind: note
---

正文……
```

Reo 打开或刷新时应：

- 将该目录识别为 note Segment 候选。
- 从 frontmatter、目录名或正文默认规则推断 title。
- 生成 stable `segmentId`。
- 默认保留用户创建的目录 basename 作为用户可见名称，不因缺 id 或不符合 `<id>--title` 形态而静默重命名。
- 生成 stable `segmentId` 后，implementation plan 必须先选择低摩擦 id carrier：Markdown frontmatter、Reo 管理 marker、central manifest path binding，或经产品确认后的目录规范化。不得在未证明必要性前默认改写用户目录名。
- 补 `.reo/objects/segments/<segmentId>.json`。
- 补 `kind: note` 和必要 frontmatter mirror。
- 刷新 `.reo/index.json`。
- 投影到该 Memory 的 Segment strip。

### 创建 Note SegmentSupplement

人类或 agent 最少只需要在某个 Segment 下创建：

```text
memories/<memory-directory>/segments/<segment-directory>/supplements/<any-title>/supplement.md
```

Reo 打开或刷新时应：

- 将该目录识别为 note SegmentSupplement 候选。
- 从 parent path 推断 `memoryId` 和 `segmentId`。
- 生成 stable `supplementId`。
- 默认保留用户创建的目录 basename 作为用户可见名称，不因缺 id 或不符合 `<id>--title` 形态而静默重命名。
- 生成 stable `supplementId` 后，implementation plan 必须复用 Segment 的 id carrier 决策。
- 补 `.reo/objects/supplements/<supplementId>.json`。
- 补 `kind: note` 和必要 frontmatter mirror。
- 刷新 parent Segment supplement projection。
- 不把 supplement 插入 Memory 顶层 Segment strip。

### 移动 Segment

人类或 agent 可以把整个 Segment 目录移动到另一个 Memory 的 `segments/` 下。

Reo 应：

- 保留 `segmentId`。
- 保留正文、attachments 和 supplements 子树。
- 更新 Segment manifest 的 `memoryId`。
- 更新所有 descendant Supplement manifest 的 `memoryId` 和 parent ownership。
- 刷新原 Memory 和目标 Memory 的 index/projection。
- 对无法迁移的 contentTabOrder 做归一化，不因 stale order 阻断对象投影。

跨父节点移动是高风险文件事务，不进入首期实现默认范围。进入 implementation plan 前必须补齐：

- source/target parent directory identity 复核。
- single-writer memory write lock 与 workspace index write queue。
- duplicate id、target collision、parent missing、descendant supplement ownership 的处理策略。
- move 提交点、partial failure rollback、file-written-index-stale 语义。
- renderer Query cache patch/invalidate 规则。

### 移动 SegmentSupplement

人类或 agent 可以把整个 Supplement 目录移动到另一个 Segment 的 `supplements/` 下。

Reo 应：

- 保留 `supplementId`。
- 保留正文和 attachments。
- 更新 Supplement manifest 的 `memoryId` 和 `segmentId`。
- 从旧 parent projection 移除。
- 加入新 parent projection。
- 修正旧 parent 和新 parent 的 contentTabOrder。

Supplement 跨 parent 移动同样是高风险文件事务，不进入首期实现默认范围。进入 implementation plan 前必须补齐同 Segment move 一致的 identity、lock、collision、rollback、index 和 Query cache 规则。

### 编辑正文和标题

- 编辑 `segment.md` / `supplement.md` 正文是语义编辑。
- 编辑 frontmatter title 或目录 basename 是标题编辑。
- title 冲突轻微时 Reo 可自动选择目录名作为用户可见名称，并回写 frontmatter mirror。
- title 冲突严重且双方都像用户有意输入时进入 `needs-review`。

## 完整结构路径

Codex 或高级用户可以写出更完整结构，减少 Reo reconcile 工作：

```text
segment.md
attachments/
content.tiptap.json
```

对应 manifest 仍然位于 workspace root 的 Reo 技术层，不属于 Segment 目录子树：

```text
<workspace-root>/.reo/objects/segments/<segmentId>.json
```

但完整结构路径只是优化，不是门槛。若 Codex 写了 JSON，Reo 校验它；若没有写，Reo 补它。若人类只写 Markdown，Reo 不应惩罚。

优先级：

1. 普通目录和文件表达用户意图。
2. Markdown 表达可读语义内容。
3. Tiptap JSON 表达富文本结构能力。
4. `.reo/objects/*.json` 表达技术完整性。
5. `.reo/index.json` 永远是可重建缓存。

## Markdown 与 Tiptap JSON

当前 durable semantic truth 是 Markdown/frontmatter。Markdown 足以表达的内容继续优先落在 `.md`：

- 普通正文、标题、粗体、斜体、删除线、链接、列表、任务列表、引用、代码块、图片附件引用。
- 普通高亮 `==text==`。
- 少量 Reo 已知 Markdown-compatible HTML，例如 colored highlight。

当 Markdown 表达开始明显增加人类或 agent 负担时，后续 spec 可以引入 `content.tiptap.json` 视图：

- 多色高亮、underline、text align、复杂 mark 组合。
- 自定义 block、widget、callout 或未来 Tiptap node。
- agent 需要精确知道文本 mark/range，而不是解析 HTML 字符串。
- Markdown 与编辑器 round-trip 出现不可接受损耗。
- 需要局部结构化编辑、selection、comment、suggestion 或 tracked-change。

未来同步规则：

```text
只有 Markdown                 accepted / repaired
Markdown + JSON 且 hash 匹配  accepted
Markdown 更新                 JSON stale 或重建
JSON 更新                     Markdown projection 重建
两边都更新且不同源            needs-review
```

冲突判断不按格式偏好，而按 freshness metadata：

```json
{
  "schemaVersion": 1,
  "markdownHash": "...",
  "tiptapJsonHash": "...",
  "lastCanonicalEdit": "markdown",
  "lossless": true
}
```

这类 metadata 由 Reo 管理；Codex 可以读取和更新，但普通用户不需要知道。该能力不是首期 implementation plan 的默认范围。

## Reconcile 分类

Reo 打开或刷新时把文件变化分成四类。

### accepted

意图清楚、技术层一致或无需补全，直接投影：

- 正常编辑 `segment.md` / `supplement.md`。
- 目录名和 frontmatter title 轻微不一致。
- `.reo/index.json` 过期。
- Tiptap 高亮等内容使用 Reo 已知 Markdown dialect。
- 整个 Segment 目录被移动到另一个 Memory 下，且身份清楚。

### repaired

用户或 agent 意图清楚，但缺少技术细节，Reo 自动补全后投影：

- 新建了包含 `segment.md` 的目录，但目录名没有 stable id。
- 新建了包含 `supplement.md` 的目录，但目录名没有 stable id。
- 缺 `.reo/objects/segments/<id>.json` 或 `.reo/objects/supplements/<id>.json`。
- Markdown 有正文但缺 `kind: note`。
- manifest stale，但目录位置和 Markdown 能唯一推出对象身份。
- 移动对象后 manifest parent ownership 还未更新。

### needs-review

内容可读，但语义有歧义，不能静默修：

- 一个新文件夹里同时出现 `segment.md` 和 `supplement.md`。
- 同一目录同时像 note、html 或 imported file。
- Supplement 被移动后 parent Segment 不明确。
- 同一 Markdown 可以解释成多个对象。
- 文件名和 frontmatter title 冲突严重，且双方都像用户有意输入。
- Markdown 和 Tiptap JSON 都被编辑，且 freshness metadata 显示不是同一版本。

### rejected

只用于安全风险或不可恢复状态：

- symlink、path traversal、root swap、parent swap。
- duplicate stable id 且无法判断当前对象。
- manifest 指向另一个 workspace。
- 对象目录在 `.reo` 管理区、draft、trash 和 active tree 之间非法交叉。
- Markdown/frontmatter 无法恢复为文本内容。
- 文件过大或二进制伪装成 Markdown。

## Reconcile 流程

```text
1. 扫描候选文件空间节点
2. 识别对象身份
3. 读取语义内容
4. 校验或补全 manifest
5. 判断 representation freshness
6. 生成投影
7. 记录 accepted / repaired / needs-review / rejected
```

扫描入口只包含用户内容区：

```text
memories/*/memory.md
memories/*/segments/*/segment.md
memories/*/segments/*/supplements/*/supplement.md
```

不把 `.reo`、draft、trash、attachments 或普通孤立 JSON 当作内容对象入口。

身份识别优先级：

1. 目录名前缀里已有合法 id。
2. manifest 里已有 id，且 ownership 与路径不冲突。
3. Markdown frontmatter 或后续批准的 id carrier。
4. 都没有时由 Reo 生成新 id，并通过已批准的低摩擦 id carrier 持久化。

## 用户反馈模型

- `accepted`：直接显示，无提示。
- `repaired`：直接显示，轻提示或受控诊断记录，不阻断。
- `needs-review`：显示为待检查内容，提供人话操作。
- `rejected`：不进入内容流，只进入受控诊断或错误报告。

首期不新增 generic diagnostic IPC，不暴露 raw path，不把 `.reo` 内部结构作为普通 renderer surface。诊断只能通过受控产品 surface、typed error envelope 或 main-owned 脱敏日志表达。用户可见文案不暴露 manifest、schema、hash 等内部细节。示例：

- “已将 2 个新笔记加入 Reo。”
- “发现 1 个待检查内容。”
- “这个文件夹里有多个正文文件，Reo 不确定它应该作为片段还是补充。”
- “有 1 个文件夹因安全原因未读取。”

Codex 可以通过受控诊断输出或直接读取文件空间状态继续修复文件，但不获得新的通用 raw path / generic IPC 能力。

## 验证标准

核心验收场景：

1. 人类创建 `segments/我的新想法/segment.md` 且正文无 frontmatter，Reo 自动纳入 note Segment。
2. 人类创建 `supplements/补充观察/supplement.md`，Reo 自动纳入 parent Segment 的 supplement tab。
3. 第二阶段中，人类或 Codex 移动整个 Segment 目录到另一个 Memory，Reo 保留正文、attachments、supplements 并更新 parent ownership。
4. 第二阶段中，人类或 Codex 移动 Supplement 到另一个 Segment，Reo 更新 old/new parent projection。
5. 当前 Markdown dialect 能保留普通高亮、colored highlight、underline、heading、task list、alignment 和 image attachment 的已支持能力，或给出明确降级状态。
6. 未来引入 `content.tiptap.json` 后，证明 Markdown-only、JSON-only、双方同源、双方冲突四类状态不会静默覆盖。
7. symlink、path traversal、duplicate stable id、跨 workspace manifest 和 `.reo` 管理区伪造对象不会进入内容投影。

成功信号：

- 人类不看内部文档也能完成最常见创建、移动、编辑。
- Codex 能直接读文件结构并完成批量整理。
- Reo 不因为缺 manifest 或 index stale 让内容消失。
- 自动修复不改变用户语义正文。
- `needs-review` 足够少，只用于真实歧义。
- `rejected` 只用于安全和不可恢复问题。
- 当前编辑器和预览视觉不变。

## 推荐首期范围

首期只覆盖最小但完整的 Note 文件创建与 reconcile 闭环：

```text
note Segment 文件创建
note SegmentSupplement 文件创建
Markdown dialect 能力矩阵
reconcile 诊断分类
安全拒绝
```

目录移动作为第二阶段；`content.tiptap.json` 先作为设计预留和验证矩阵，不作为首期必须落地内容。这样保持 Reo 不被 Markdown 限死，同时避免第一阶段实现膨胀。

## Implementation Plan 输入

首期 implementation plan 必须从这些输入出发：

- 只实现 note Segment / note SegmentSupplement 的直接文件创建识别、自愈补全、index reconcile 和安全拒绝。
- 不实现跨 Memory Segment move，不实现跨 Segment Supplement move；仅保留设计和测试矩阵。
- 不实现 `content.tiptap.json` 持久同步；仅保留 Markdown dialect 能力矩阵和未来 JSON 表示决策点。
- 不新增 generic diagnostic IPC，不暴露 raw path。
- 需要执行真实 TDD，因为该工作命中文件系统、manifest、index rebuild、安全边界和用户可见 workflow。
- 需要判断是否更新 `docs/current/data.md` 和 `docs/current/flow.md`：只有当实现改变稳定文件合同、reconcile 规则或安全边界时才压缩写入 current。

## Open Questions

- **低摩擦 id carrier**：人类创建无 id 目录后，Reo 应把 stable id 写入 Markdown frontmatter、Reo 管理 marker、central manifest path binding，还是经确认后规范化目录名？首期不得默认静默重命名用户目录。
- **扫描边界**：首期需要定义候选目录数量、Markdown 文件大小、frontmatter 解析失败和 HTML-in-Markdown 的扫描上限。
- **HTML 不可信边界**：Markdown-compatible HTML 只作为文本内容进入现有编辑/预览管线，不新增 Electron 权限、外链或脚本执行能力。
- **JSON 启用条件**：`content.tiptap.json` 只有在 Markdown dialect 能力矩阵证明负担过高或 round-trip 不可接受后，才进入独立 spec。
- **待检查 UI**：首期是否需要可见 `needs-review` surface，还是先通过 safe error/diagnostic summary 证明主流程，不阻断 accepted/repaired。

## Stop Conditions

出现以下情况时停止 implementation plan 或实现，回到设计确认：

- 低摩擦 id carrier 需要引入新的隐藏第二真源，且无法证明比目录规范化更简单。
- 直接文件创建必须放松 symlink、path traversal、root identity、parent identity、trusted sender 或 lock 边界才可实现。
- 首期 scope 被迫同时实现目录移动、Tiptap JSON 同步或 generic diagnostic IPC。
- accepted/repaired 规则会静默覆盖用户正文、删除附件或改写用户可见标题。
- current 文档与源码事实冲突，无法只通过 task spec 表达新规则。

## 官方依据

- Tiptap Markdown extension 支持 Markdown 作为编辑器 import/export bridge，但 Markdown round-trip 仍需要针对 Reo 能力矩阵测试。
- Tiptap AI Toolkit / Server AI Toolkit 的当前范式是让 AI 通过结构化内容读取、JSON/Markdown/Text/HTML 输出和 replace/insert 工具操作文档，而不是要求 agent 只编辑一种格式。
- 对 Reo 来说，官方范式的产品化对应物不是“只选 Markdown”或“只选 JSON”，而是内容对象合同 + 多表示视图 + 可验证 reconcile。

参考：

- https://tiptap.dev/docs/content-ai/getting-started/overview
- https://tiptap.dev/docs/content-ai/capabilities/ai-toolkit
- https://tiptap.dev/docs/content-ai/capabilities/server-ai-toolkit/api-reference/tools
