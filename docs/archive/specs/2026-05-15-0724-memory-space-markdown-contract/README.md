# 记忆空间 Markdown 文件合同工作单元

## 时间

2026-05-15 07:24 America/Los_Angeles

## Objective

建立 Reo 记忆空间的新文件合同：Markdown/frontmatter 是用户与 agent 可编辑的语义层，`.reo` 是 Reo 技术完整性层，index/cache 可重建，普通文件可存在但不自动成为对象，HTML 默认不可信。

## 成功标准

- `AGENTS.md` 与 `.claude/CLAUDE.md` 声明 agent 可编辑和禁止编辑边界。
- `docs/current/*` 描述当前文件模型、扫描规则、数据 ownership、Electron 安全边界和验证要求。
- 用户对象目录只用 `memory.md`、`segment.md` 和 `supplement.md` 承载语义真源。
- 用户目录 JSON 文件不承载语义真源，不保留并行模型。
- 任意普通文件、HTML untrusted、非法 frontmatter、index rebuild 和资源路径 containment 有测试覆盖。
- `npm run verify:quick` 通过。

## 依据

- Codex 读取 `AGENTS.md` 作为项目指令入口。
- Claude Code 使用 `CLAUDE.md`，可通过导入复用 agent 指令。
- Obsidian Properties 使用 Markdown 顶部 YAML frontmatter，适合简单属性，不适合作为复杂嵌套状态库。
- VS Code 与 Git 的参考点是普通文件夹工作区、隐藏配置目录、文本 diff 与生成缓存排除。
- Electron 安全边界要求不信任任意本地 HTML，不把用户文件直接并入 trusted renderer。
- Context7 查询确认 `gray-matter` 是 Markdown frontmatter 解析/序列化的成熟方案，`yaml` 可作为 YAML 文档解析备选。

## 约束

- 产品未发布；本任务不写旧 JSON 语义模型兼容 reader、fallback、alias 或 shim。某条运行时路径切到 Markdown 文件合同后，必须删除对应旧分支和旧测试预期。
- 不创建 ContentNode、Block runtime、任意文件 registry、HTML preview runtime 或插件 runtime。
- 不实现 note、photo、video、imported_file 的完整 UI；只保留文件合同扩展空间。
- 不让 `.reo` 成为用户语义第二真源。
- 不让普通文件的存在改变 Reo 对象图。
- 补充内容统一使用 SegmentSupplement / supplement 文件模型。

## TDD 切入

- RED：Markdown object parser 解析合法 frontmatter/body，并拒绝非法 YAML、错误对象类型、保留字段被改坏、越界 primary resource。
- RED：workspace 扫描忽略普通 `.json/.md/.html` 文件，只承认合法 `memory.md`、`segment.md`、`supplement.md`。
- RED：HTML 普通文件不会被 renderer 当作 HTML 注入或执行。
- RED：删除 `.reo/index.*` 后能从 Markdown 对象重建 snapshot/detail。
- RED：用户目录 JSON 文件不再被当作语义真源。

## 验证清单

- [x] targeted main tests
- [x] targeted renderer tests
- [x] `npm run typecheck`
- [x] `npm run test:main`
- [x] `npm run test:renderer`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run verify:quick`

## 当前证据

- Markdown/frontmatter parser 只接受语义字段；对象 id、对象类型、schema version 和 primary resource path 不进入用户 frontmatter。
- 当前 parser 只接受已进入 runtime 的 `audio` kind，不把 `note`、`photo`、`video`、`imported_file` 或 `html` 预留类型当成合法对象。
- `npm run test:main` 已通过，覆盖 Markdown parser、保留字段拒绝、未来 kind 拒绝和 resource path containment。
- `npm run typecheck` 已通过。
- `npm run verify:quick` 已通过，包含 typecheck、main tests、renderer tests、lint 和 format:check。
- `docs/current/*`、`AGENTS.md` 和 `.claude/CLAUDE.md` 已写入当前 Markdown/frontmatter 语义层、`.reo/objects/*` 技术完整性层、普通文件不自动成对象和 HTML untrusted 规则。
- 第二轮只读审查结果为 PASS：`docs/current/electron.md` 使用 `supplement.md`，active docs/code/test 未发现旧 SegmentAttachment 或 finalized JSON 语义真源残留，`AGENTS.md` 与 `.claude/CLAUDE.md` 镜像一致。
