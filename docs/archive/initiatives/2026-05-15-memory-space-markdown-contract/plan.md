# 记忆空间 Markdown 文件合同计划

## 文件模型

Reo 管理的语义对象由对象目录内的 Markdown 入口文件定义：

- Memory: `memory.md`
- Segment: `segment.md`
- Segment supplement: `supplement.md`

Markdown 正文承载长内容、转录、说明、注解、摘要和用户笔记。YAML frontmatter 只承载简单、稳定、低频变化的语义字段，不承载对象 id、对象类型、schema version、父子归属、资源 fingerprint 或 primary resource 绑定。

`.reo` 承载 Reo-only 技术完整性，包括 workspace identity、对象注册、父子归属、资源 fingerprint、事务、锁、草稿、恢复、trash 和索引状态。

`.reo/index.*` 是可删除并重建的缓存，不是用户语义真源。

产品尚未发布。运行时代码切换到本文件合同后，不保留旧 JSON 语义模型的兼容 reader、fallback、alias 或 shim；对应旧分支、旧测试预期和旧文案必须同批删除。

## 对象与资源边界

- Reo 对象必须有合法的对象入口 Markdown 文件。
- 普通文件可以出现在 workspace、Memory、Segment 或 supplement 目录中。
- 普通文件不因存在而自动成为 Reo 对象。
- Reo 只预览当前实现支持且通过对象合同显式引用的资源。
- HTML 默认是 untrusted resource；没有隔离预览能力时只能作为普通文件保存和引用。

## 产品实体

当前产品实体保持显式层级：

```text
Workspace -> Memory -> Segment -> SegmentSupplement
```

不使用通用 ContentNode / Block。跨对象关联使用 frontmatter 的轻量引用或 Markdown 链接表达，不用无限物理递归表达。

## Agent 合同

Agent 可以编辑：

- `memories/**/*.md` 中允许的语义 frontmatter 字段。
- `memories/**/*.md` 的 Markdown 正文。
- 当前对象目录内新增普通资源文件。

Agent 不得编辑：

- `.reo/**`
- 已有对象目录名、媒体文件名或 Reo-managed primary resource path。
- 任何 index/cache/lock/transaction/recovery/trash 文件。

对象 ID、schema version、父子归属、资源 fingerprint 和 primary resource 绑定不进入用户 frontmatter，由 `.reo` 技术完整性层持有。

## 验证

- Markdown/frontmatter parser 必须有行为测试。
- 文件扫描必须证明任意普通文件不会破坏 workspace open、detail read 或 index rebuild。
- HTML 文件必须证明不会被 trusted renderer 执行或作为 HTML 注入。
- 用户目录 JSON 文件不得作为语义真源。
- 删除 `.reo/index.*` 后必须能重建 snapshot/detail。
