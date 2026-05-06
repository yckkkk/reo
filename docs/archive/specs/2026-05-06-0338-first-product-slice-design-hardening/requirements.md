# 需求基线

## 相关方

| 相关方           | 需求                                                              | 验收角色                         |
| ---------------- | ----------------------------------------------------------------- | -------------------------------- |
| 用户             | 用本地文件夹可靠记录 voice memory，并能重开继续编辑。             | 手动操作验收和磁盘文件验收       |
| Reo owner        | first slice 证明真实产品闭环，不变成玩具 MVP 或泛平台。           | 产品范围和质量判断               |
| 实现者           | 拿到明确的 module、contract、state、test 和验证路径。             | TDD 实现                         |
| QA               | 有可重复验证路径，能诱发错误和恢复场景。                          | 自动测试、Computer Use、磁盘验证 |
| 未来 AI consumer | Codex CLI 能读取 workspace `AGENTS.md` 和普通文件理解 recording。 | 只读验证                         |

## 运行语境

- 本地 Electron app。
- 用户选择本地文件夹作为 memory workspace。
- Renderer 保持 Web app 边界，不直接访问 Node 或 Electron API。
- Main process 通过窄 preload/IPC 执行 folder selection、workspace filesystem、recording file read/write。
- Workspace files 是用户内容真源；DB 不作为本 slice 用户内容真源。
- Codex CLI read-only validation 在 workspace folder 执行，并验证文件 hash 不变。

## 功能需求

| ID     | 需求                                                                                                                                                                                  | 验收方式                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| FR-001 | 用户能创建 memory workspace，输入标题和可选描述，选择本地文件夹。                                                                                                                     | 表单行为测试、OS dialog 操作验证                   |
| FR-002 | Reo 初始化 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json` 和 `recordings/`，运行期可创建 volatile `.reo/workspace.lock`，不创建无 UI consumer 的 photo/video/file/notes 目录。 | main 文件测试、磁盘验证                            |
| FR-003 | 已有 `AGENTS.md` 且没有 `.reo/workspace.json` 的文件夹必须阻止初始化，不覆盖用户文件。                                                                                                | main RED 测试、操作验证                            |
| FR-004 | 已有 `.reo/workspace.json` 的 folder 按 existing workspace 打开。                                                                                                                     | main 文件测试、renderer query/form 测试            |
| FR-005 | Workspace home 显示标题、辅助信息、一个 recording action、`Memory Content` 和 recording entries。                                                                                     | renderer component 测试、viewport evidence         |
| FR-006 | 第一版不显示未实现的 photo、video、file、film 能力。                                                                                                                                  | renderer absence tests                             |
| FR-007 | 用户能打开 recording overlay，授权麦克风后开始录音。                                                                                                                                  | renderer MediaRecorder adapter 测试、Computer Use  |
| FR-008 | 录音中显示计时、状态、waveform/progress 和明确标记为“本地草稿提示”的 live mock transcript；不得暗示真实 speech-to-text 已完成。                                                       | renderer state tests、reference validation         |
| FR-009 | 用户能 pause、resume、stop；pause 时计时和 transcript 暂停，resume 后恢复。                                                                                                           | state machine tests、operation validation          |
| FR-010 | stop 等待最终 audio chunk append 完成后再 finalize draft。                                                                                                                            | race regression test                               |
| FR-011 | stop 后保存 `audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。                                                                                                       | main file tests、disk validation                   |
| FR-012 | Transcript 和 reflections 是独立可编辑区域，独立 autosave、独立失败状态。                                                                                                             | renderer tests、save failure operation             |
| FR-013 | Reopen workspace 后能看到 recording entry，打开后能播放原始录音并继续编辑 transcript/reflections。                                                                                    | main open tests、Electron runtime smoke            |
| FR-014 | Workspace `AGENTS.md` 说明 Reo memory workspace、受管目录、recording 文件语义和 AI 操作边界。                                                                                         | file content tests、Codex CLI read-only validation |
| FR-015 | Unsupported schema、missing workspace、permission denial、save failure、corrupt metadata 都有可行动错误。                                                                             | error tests、manual validation                     |

## 质量需求

| ID      | 需求                                                                                                                       | 验收方式                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| NFR-001 | Electron 安全基线不放松：sandbox、contextIsolation、nodeIntegration false、CSP、navigation/window-open/permission policy。 | main tests、Electron runtime verification      |
| NFR-002 | IPC 每个 product capability 一个显式 channel，不暴露 generic invoke/send/fs。                                              | preload bridge tests                           |
| NFR-003 | 不可信边界使用 Zod 校验：IPC payload、workspace metadata、recording metadata、form submit。                                | schema tests                                   |
| NFR-004 | Durable writes 使用 temp file、rename、file fsync、parent directory fsync，并有 crash window 说明。                        | main file tests、filesystem transaction review |
| NFR-005 | 同一 workspace 单写者；多窗口/多进程打开必须检测并拒绝或明确恢复。                                                         | lock tests、operation validation               |
| NFR-006 | UI 在 wide、narrow、900 x 620 下不溢出，长标题和长文本不遮挡 controls。                                                    | viewport evidence                              |
| NFR-007 | 所有 icon-only controls 使用 lucide 并有 accessible name；UI 不使用 emoji。                                                | component tests、manual inspection             |
| NFR-008 | 参考素材只影响结构、层级和 micro-interactions，视觉服从 Reo design system。                                                | reference-map 证据                             |
| NFR-009 | 每个 implementation slice 都有 RED/GREEN/REFACTOR、`npm run verify:quick`、docs/current update 和 commit。                 | per-slice verification                         |
| NFR-010 | Workspace 磁盘文件可被 Codex CLI read-only 验证且 hash 不变。                                                              | Codex CLI validation                           |

## 错误需求

| ID      | 错误                                    | 用户可见行为                                    | 数据保留                                |
| ------- | --------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| ERR-001 | OS dialog cancel                        | 回到同一 form，不显示 error。                   | 保留 title/description                  |
| ERR-002 | Folder permission denied                | 显示选择其他 folder 或调整权限。                | 保留 form values                        |
| ERR-003 | Existing `AGENTS.md` conflict           | 阻止初始化，说明 Reo 不覆盖。                   | 不写任何 workspace files                |
| ERR-004 | Unsupported `.reo/workspace.json`       | 显示 unsupported schema 和只读保护建议。        | 不迁移、不覆盖                          |
| ERR-005 | Workspace missing                       | 提示重新定位或从 recent 移除。                  | recent metadata 不当作 workspace truth  |
| ERR-006 | Mic permission denied                   | 录音失败，可重试。                              | 不创建 finalized recording              |
| ERR-007 | MediaRecorder unavailable/start failure | 显示当前环境不支持录音或设备被占用。            | draft 尝试 discard                      |
| ERR-008 | Audio append failure                    | recording 转 failed，保留可见 transcript 文本。 | 非空 `.part` 标记 recoverable           |
| ERR-009 | Finalize failure                        | 显示停止失败，保留 draft recovery。             | 不覆盖已有 `audio.webm`                 |
| ERR-010 | Transcript/reflections save failure     | 对应 editor 显示 `role="alert"`，允许重试。     | 保留 renderer 未保存文本和上次磁盘内容  |
| ERR-011 | Corrupt recording metadata              | entry 标记需要恢复或跳过。                      | 不删除用户 audio/transcript/reflections |

## 非目标

| ID     | 非目标                              | UI 规则                                                                           |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| NG-001 | 真实 speech-to-text 服务            | 只显示明确标记为本地草稿提示的 mock transcript，不显示 provider 设置或 token 输入 |
| NG-002 | Photo/video/file/film UI            | 不显示 disabled controls，不显示 placeholder section                              |
| NG-003 | 内置 AI runtime 或 agent chat       | 不创建 agent runtime、tool runtime、generic command layer                         |
| NG-004 | DB schema 和 migration              | 不创建 Drizzle config、SQLite 文件或 migration directory                          |
| NG-005 | Auth/session                        | 不显示登录、账户、同步、sharing                                                   |
| NG-006 | Packaging/updater                   | 不创建 Forge/updater UI、config 或 tests                                          |
| NG-007 | Sentry/electron-log subsystem       | 只设计 error envelope 和 local diagnostics shape                                  |
| NG-008 | Search、多 workspace query、tagging | 不显示搜索框、tag editor 或 global library                                        |
| NG-009 | Editor rich text                    | Transcript/reflections 是 plain textarea/Markdown text                            |

## 验收矩阵

| 需求组              | 自动证明                                              | 操作证明                                 | 收口证据                               |
| ------------------- | ----------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| Workspace creation  | main path tests、form tests、Zod tests                | OS dialog create/open/cancel             | spec verification + slice verification |
| Recording lifecycle | state machine、MediaRecorder adapter、IPC draft tests | record/pause/resume/stop                 | Computer Use evidence                  |
| Persistence         | file contract tests、hash checks                      | quit/restart/reopen                      | disk tree + shasum                     |
| UI quality          | renderer accessibility/state tests                    | wide/narrow/900x620 screenshots or notes | reference-map + QA matrix              |
| Security            | Electron policy tests、preload leak tests             | runtime CSP/nav/window/permission checks | electron.md update                     |
| Codex readability   | workspace AGENTS content tests                        | `codex exec -s read-only` with hash diff | verification.md                        |
