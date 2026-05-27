# Tasks

## Success Criteria

- 每个 dogfood 场景都有真实 invocation、file effects、projection evidence 和 friction classification。
- 至少覆盖普通 Markdown/目录编辑和 `content.tiptap.json` JSON-only 富结构编辑。
- 至少一个场景使用真实 `codex exec` 在记忆空间 root 运行，而不是只用 repo 内测试模拟。
- 任何优化建议都先归因到 `AGENTS.md`、`skills/reo-edit`、`skills/reo-doctor`、Reo system 或 test/dev tooling。
- 如果发现 Reo 系统缺陷，先补 focused failing test，再实现；不把系统缺陷转嫁给 agent 说明文。

## Phase 1: Spec And Fixture Discovery

- [x] 读取 Reo 入口文档和 data/flow/frontend/quality current 真源。
- [x] 使用 `request_user_input` 锁定首期为 dogfood 证据优先。
- [x] 通过 Context7 和本机 `codex exec --help` 确认当前 Codex CLI 非交互入口。
- [x] 建立状态机、不可变约束、观察模型和摩擦归因框架。
- [x] 盘点当前可用测试记忆空间；首期选择“测试”记忆空间。
- [x] 确认目标记忆空间存在 managed `AGENTS.md`、`skills/reo-edit`、`skills/reo-doctor`；记录当前运行 app 与源码模板可能存在的刷新差异。

## Phase 2: Dogfood Scenario Matrix

- [x] 场景 A：用 `codex exec` 对现有 Segment 执行“重命名 + 创建 note Supplement”，记录 agent 行为和 Reo 投影。
- [x] 场景 B：用 `codex exec` 新建 Memory，记录是否只改普通文件和目录。
- [x] 场景 C：用 `codex exec` 在现有 Memory 下新建 note Segment。
- [x] 场景 D：用 `codex exec` 重命名并跨 Segment 移动 Supplement。
- [x] 场景 E：用 `codex exec` 修改同节点 `content.tiptap.json` 的彩色高亮和下划线，验证 Markdown mirror 与 UI 投影。
- [x] 场景 F：模拟人类文件操作修改 Memory space root 名称或 metadata mirror，验证 Reo 收敛。
- [x] 场景 G：在 Reo 已选中同一 active workspace 时进行外部文件改动，验证 passive watcher 自动刷新，不依赖点击记忆空间或重新选择。

## Phase 3: Evidence And Classification

- [x] 场景 A 记录 invocation、final response、文件 diff、是否触碰 `.reo`、是否提到 hash/manifest/sidecar。
- [x] 场景 A 对摩擦点做 owner 分类：`AGENTS.md`、`skills/reo-edit`、Reo system、test/dev tooling。
- [x] 场景 A 判断是否存在“agent 做对但 Reo 不收敛”的系统缺陷：workspace open/selection 收敛通过，active watcher 另测。
- [x] 场景 A 判断是否存在“agent 完成但思考路径过重”的入口/skill 缺陷：存在，全局 memory 检索造成明显 token 膨胀。
- [x] 场景 B-G 重复同样证据和归因。

## Phase 4: Follow-up Boundary

- [x] 如果只需优化入口或技能，写出最小改动 proposal，不直接扩大到系统实现。
- [x] 将普通任务 stop condition 作为首个入口/skill 模板优化。
- [x] 为 managed agent 模板输出补充回归断言。
- [x] 如果需要系统修复，拆出 focused failing test 和最小实现 slice。
- [x] 如发现长期规则改变，压缩更新 `docs/current/*`；当前已有 current 规则覆盖 root basename title truth，无需新增。
- [x] 收口前运行 scoped verification：`npm run typecheck:quick` 与 `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`。
- [x] 提交前运行 `npm run verify:quick`。
