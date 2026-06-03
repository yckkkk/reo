# Implementation Notes：Agent-created Works First Slice

本文件记录后续 M1 执行证据：RED 失败输出、GREEN 实现要点、review / simplify 结论、运行时视觉验证证据。

## 当前状态

- Phase 0 设计融合已完成；本 spec 是唯一 active spec。
- Phase 1-6 已完成；剩余长期工作由 `docs/initiatives/2026-06-03-agent-created-works/` 承接。

## 关键约束备忘

- 用户可见类型名是 `作品`，不是 `html`。
- Durable 合同是 `kind: artifact` + `format: html`。
- 渲染唯一路径是 opaque-origin iframe + main-owned readonly protocol + CSP。
- iframe 使用 `sandbox="allow-scripts"`，不加 `allow-same-origin`。
- 作品无 page -> host 通道；Widget 的 read-only `postMessage` 数据桥留 M2。
- 创建与更新都是 prompt-bridge；Reo 不创建空对象。
- renderer 不持有完整 prompt 文本、raw path 或可读文件列表。
- 内部生成式 UI 源材料只进入 skill/guideline/template/token 层；不复制 streaming runtime、RPC、CDN 或外联模型。
- 最终用户可见 skills 不提外部项目，也不要求用户 agent 访问 GitHub。

## Phase 日志

### Phase 1 - 文件合同与 Recognition

- RED：
  - `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "artifact html"` 先失败于合法作品未投影、作品补充未投影、缺入口计数/review 缺失。
  - `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main -- --test-name-pattern "artifact html"` 先失败于 projection discriminated union 不接受 `type: artifact`。
- GREEN：
  - workspace contract 增加 `artifact` Segment / Supplement projection variant，`format: html`，entry hash / byte length 和 `previewVersion`。
  - main 文件识别接受 `kind: artifact` + `format: html`，读取 `segment.html` / `supplement.html` 并收敛 manifest entry hash/bytes。
  - read model、summary 和 workspace index 等价判断增加 `artifactSegmentCount`；`hasAnyNote` 不把 artifact 当 note。
  - 缺入口作品进入 needs-review，reason 为 `missing-artifact-entry`，不进入正常投影。
- 验证：
  - `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "artifact html"` 通过，3 tests。
  - `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main -- --test-name-pattern "artifact html"` 通过，1 test。

### Phase 2 - 隔离预览能力

- RED：
  - `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main -- --test-name-pattern "artifact|content security|privileged schemes"` 先失败于缺失 `src/main/artifactProtocol.ts`。
- GREEN：
  - 新增纯 resolver `artifactProtocol.ts`，支持 `reo-artifact://<workspaceId>/segments/<segmentId>/segment.html`、同目录 sibling asset、supplement entry 和 `_vendor/<package>/<file>`。
  - artifact protocol 读取使用 no-follow leaf open、owner directory identity 校验、MIME allowlist、entry/asset byte cap；用户作品 response `Cache-Control: no-store`，vendor 使用 immutable cache。
  - response CSP 固定为 `default-src 'none'`、`connect-src 'none'`、`frame-src 'none'` 等最小授权。
  - Electron privileged scheme 增加 `reo-artifact`，`appProtocol` 增加 GET-only handler，app shell CSP 只在 `frame-src` 加入 `reo-artifact:`，不加入 `connect-src`。
- 验证：
  - `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main -- --test-name-pattern "artifact|content security|privileged schemes"` 通过，10 tests。

### Phase 3 - 渲染 Surface

- RED：
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "artifact"` 先失败于 artifact 片段仍显示 `转录` / Markdown fallback，artifact 补充没有 panel。
- GREEN：
  - `MemoryStudio` 增加 artifact segment / supplement type guard、`reo-artifact://` preview URL builder 和 sandbox iframe tabpanel。
  - 主片段内容 query 对 artifact 禁用，不读取 note/audio bridge；artifact 主 tab 显示 `作品`，补充 tab 复用 `作品补充` title。
  - 现有“非 audio 即 note”的菜单、语音生成、播放器分支收窄为 note-only；artifact 不暴露旧的正文/转录动作。
  - `MemoryStudioSegmentCard` 增加 artifact icon 与 entry size 展示，避免把 artifact 当 note 读取 `bodyByteLength`。
- 验证：
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "artifact"` 通过，2 tests。
  - `npm run typecheck:quick` 通过。
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx` 通过，3 tests。

### Phase 4 - 作品 Skill 群

- RED：
  - `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts npm run test:main -- --test-name-pattern "Reo agent skill entry|managed reo-works|managed Reo agent|reo-doctor skill script repairs managed config|initializeWorkspace creates named child"` 先失败于缺失 `DEFAULT_REO_WORKS_SKILL_MD` 和 `DEFAULT_REO_WORKS_DESIGN_SKILL_MD`。
- GREEN：
  - 新增托管 skill 群 `skills/reo-works/SKILL.md` 和 `skills/reo-works-design/SKILL.md`。
  - `reo-works` 负责作品片段/作品补充创建、更新、文件合同、禁止空白占位作品和验证边界。
  - `reo-works-design` 内置 Reo 化模块、复杂度预算、输出顺序、视觉 token、色阶、SVG text classes、沙箱和轻量性能规则。
  - `AGENTS.md` managed block、initialize/open upsert 和 `reo-doctor` repair 脚本同步管理新 skill 群。
  - 最终 skill 文本不包含外部项目 URL、GitHub 入口或外部来源名。
- 验证：
  - `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts npm run test:main -- --test-name-pattern "Reo agent skill entry|managed reo-works|managed Reo agent|reo-doctor skill script repairs managed config|initializeWorkspace creates named child"` 通过，5 tests。

### Phase 5 - 创建与更新 Prompt-bridge

- RED：
  - `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main -- --test-name-pattern "copyArtifactAgentPrompt|workspace preload bridge"` 先失败于 preload bridge 缺 `copyArtifactAgentPrompt` 和 main handler export。
  - `LoadedWorkspaceFrame.test.tsx` 增加三条用户行为 RED：FAB `作品` 只复制创建作品片段 prompt；content tab rail `作品补充` 只复制补充 prompt；已有作品片段 More 菜单复制更新 prompt。
- GREEN：
  - workspace contract 增加显式 `workspace:copyArtifactAgentPrompt` channel、strict discriminated union request 和 preload bridge 方法。
  - main handler 校验 trusted sender、active handle、workspaceId 和目标文件空间目录，由 main 生成完整 prompt 并写系统剪贴板；schema 拒绝 renderer 提供 `prompt` / `targetPath`。
  - prompt 只包含 workspace-relative POSIX path、target identity、文件合同、安全约束和 `skills/reo-works*` 入口，不包含 root path 或 workspace handle。
  - prompt target 定位复用现有 Memory / Segment / Supplement 文件空间目录命名不变量；它不创建目录、不写 durable object，也不要求 `.reo/objects` manifest 已完整存在。
  - `ExpressionDock` 新增 `作品` FAB action；无当前 Memory 时显示 disabled `作品暂不可用`。
  - `MemoryStudio` 补充菜单新增 `作品补充`，复用 selected Segment 的补充菜单结构，不进入录音/笔记 draft flow。
  - Artifact Segment / Supplement More 菜单新增可选 `让 Agent 更新作品` action；非 artifact 对象不显示该动作。
  - dev-only scenario bridge、renderer tests 和 workspace API wrapper mock 同步新 preload method。
- 验证：
  - `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main -- --test-name-pattern "copyArtifactAgentPrompt|workspace preload bridge"` 通过，10 tests。
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "artifact.*prompt|artifact segment prompt|artifact supplement prompt|artifact update prompt"` 通过，3 tests。
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "expression FAB|表达入口|red expression FAB"` 通过，2 tests。
  - `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts` 通过，3 tests。
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 通过，81 tests。
  - `npm run typecheck:quick` 通过。

### Phase 6 - 收口

- 文档压缩：
  - `README.md`、`docs/current/foundation.md`、`docs/current/product.md`、`docs/current/data.md`、`docs/current/electron.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/architecture.md`、`docs/current/quality.md`、`docs/current/roadmap.md` 已同步当前事实。
  - `docs/initiatives/2026-06-03-agent-created-works/` 已承接 M2 read-only data bridge、agent update lifecycle、vendor asset registry、performance guard 和后续验证，不把未完成能力写成当前事实。
- 简化 / 安全检查：
  - 作品预览展开复用现有 `EditorExpandShell`，没有为 artifact 单独新建 fullscreen shell。
  - `ArtifactPreviewPanel` 仍使用 `sandbox="allow-scripts"`；没有加入 `allow-same-origin`。
  - App shell CSP 只在 `frame-src` 接受 `reo-artifact:`；没有把 `reo-artifact:` 加入 `connect-src`。
  - 托管 skill / prompt 文本泄漏检查为空；检查范围覆盖 current docs、initiative、archive spec、managed skill 源文本和 prompt builder。
- 补充实现：
  - `EditorExpandShell` 增加可选 label / inline slot 参数，默认值保持笔记编辑器行为。
  - 作品片段和作品补充预览现在与文本编辑框一样可以展开为 fullscreen dialog；iframe URL、sandbox 和 readonly protocol 不变。
- 验证：
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "artifact"` 通过，5 tests。
  - `npm run typecheck:quick` 通过。
  - `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceFiles.test.ts,test/main/memoryFiles.test.ts,test/main/workspaceContract.test.ts npm run test:main -- --test-name-pattern "artifact|content security|privileged schemes|copyArtifactAgentPrompt|workspace preload bridge|Reo agent skill entry|managed reo-works|managed Reo agent|reo-doctor skill script repairs managed config|initializeWorkspace creates named child"` 通过，28 tests。
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 通过，81 tests；jsdom 对 `HTMLMediaElement.load()` 的既有 warning 不影响结果。
  - `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts` 通过，3 tests。
  - `npm run build:app` 通过；Node 输出既有 `DEP0205` warning。
  - `npm start` 到达 `[Main] App ready`；同次启动的 Electron renderer 参数包含 `--standard-schemes=reo-app,reo-attachment,reo-artifact`、`--secure-schemes=reo-app,reo-attachment,reo-artifact`、`--fetch-schemes=reo-attachment,reo-artifact` 和 `--streaming-schemes=reo-attachment,reo-artifact`。Computer Use 截图命中了同路径下已存在的 dev Electron 窗口（`localhost:5183`，PID 58450），未作为 production preview 视觉证据记录。
  - 归档后 `npm run verify:quick` 通过；期间 `backfillAudioDataSource` abort 时序测试出现一次全量并发下的偶发失败，focused 复跑通过，随后完整 `verify:quick` 复跑通过。
