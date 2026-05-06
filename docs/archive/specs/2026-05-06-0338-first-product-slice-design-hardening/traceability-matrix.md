# 可追溯矩阵

每个 requirement 必须追到 architecture、protocol、data、state、test 和 validation。`IMPL-*` 是后续 `$writing-plans` 的输入，不是当前可执行计划。

| 需求    | 架构视图                   | 接口契约                                               | 数据契约                                    | 状态 owner                              | 测试                       | 验证                      |
| ------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------- | --------------------------------------- | -------------------------- | ------------------------- |
| FR-001  | AV-MOD-RENDERER-WORKSPACE  | PC-001 `chooseDirectory`、PC-002 `initializeWorkspace` | DC-WorkspaceDraft                           | React Hook Form + component state       | RT-CreateWorkspaceForm     | Computer Use OS dialog    |
| FR-002  | AV-MAIN-WORKSPACE-FILES    | PC-002                                                 | DC-Workspace、DC-Index                      | workspace files + `.reo` metadata       | MT-workspaceFiles          | disk tree                 |
| FR-003  | AV-MAIN-WORKSPACE-FILES    | PC-002 `ERR_WORKSPACE_AGENTS_CONFLICT`                 | DC-WorkspaceInitPolicy                      | main filesystem guard                   | MT-workspaceConflict       | operation conflict check  |
| FR-004  | AV-MAIN-WORKSPACE-FILES    | PC-003 `openWorkspace`                                 | DC-WorkspaceSnapshot                        | TanStack Query for snapshot             | MT-openWorkspace、RT-query | reopen workspace          |
| FR-005  | AV-RENDERER-WORKSPACE-HOME | PC-003 result snapshot                                 | DC-WorkspaceEntry                           | TanStack Query + component render       | RT-WorkspaceHome           | viewport checks           |
| FR-006  | AV-RENDERER-WORKSPACE-HOME | none                                                   | none                                        | renderer render contract                | RT-ForbiddenCapabilities   | UI inspection             |
| FR-007  | AV-RENDERER-RECORDING      | PC-004 `createRecordingDraft`                          | DC-RecordingDraft                           | feature reducer                         | RT-MediaRecorderAdapter    | Computer Use mic          |
| FR-008  | AV-RENDERER-RECORDING      | PC-005 `appendAudioChunk`                              | DC-AudioArtifact                            | feature reducer                         | RT-RecordingOverlay        | reference validation      |
| FR-009  | AV-RENDERER-RECORDING      | PC-005                                                 | DC-AudioArtifact                            | recording reducer                       | RT-recordingMachine        | operation pause/resume    |
| FR-010  | AV-MAIN-DRAFTS             | PC-006 `finalizeRecordingDraft`                        | DC-Recording                                | main draft writer                       | RT-raceFinalize            | final append race test    |
| FR-011  | AV-MAIN-DRAFTS             | PC-006                                                 | DC-Recording、DC-Transcript、DC-Reflections | workspace files                         | MT-recordingDrafts         | disk file validation      |
| FR-012  | AV-RENDERER-EDITORS        | PC-010、PC-011                                         | DC-Transcript、DC-Reflections               | component editor state + workspace file | RT-autosave                | save failure operation    |
| FR-013  | AV-OPEN-RECORDING          | PC-007、PC-008、PC-009                                 | DC-RecordingDetail、DC-AudioBlob            | TanStack Query + Blob URL state         | RT-reopenPlayback          | restart smoke             |
| FR-014  | AV-WORKSPACE-AGENTS        | PC-002                                                 | DC-WorkspaceAgents                          | workspace root file                     | MT-agentsTemplate          | Codex CLI read-only       |
| FR-015  | AV-ERROR-SURFACES          | all PC error envelopes                                 | all DC schemas                              | per flow owner                          | MT/RT error tests          | manual error matrix       |
| NFR-001 | AV-ELECTRON-SECURITY       | PC sender validation                                   | none                                        | main process                            | MT-security                | runtime CSP/nav/window    |
| NFR-002 | AV-PRELOAD-BRIDGE          | all PC methods                                         | none                                        | preload bridge                          | MT-preloadBridge           | source inspection         |
| NFR-003 | AV-SCHEMA                  | all untrusted inputs                                   | metadata schemas                            | Zod schema owners                       | MT-schema                  | malformed fixture tests   |
| NFR-004 | AV-FS-TRANSACTIONS         | file write channels                                    | durable files                               | main writer                             | MT-atomicWrite             | crash window review       |
| NFR-005 | AV-FS-LOCK                 | workspace open/write channels                          | `.reo/workspace.lock`                       | main lock manager                       | MT-lock                    | multi-window check        |
| NFR-006 | AV-LAYOUT                  | none                                                   | none                                        | CSS/layout                              | RT-layout                  | viewport checks           |
| NFR-007 | AV-A11Y                    | component props                                        | none                                        | UI primitives                           | RT-accessibleNames         | keyboard inspection       |
| NFR-008 | AV-REFERENCE               | none                                                   | none                                        | design spec                             | RT-visual absence tests    | reference-map evidence    |
| NFR-009 | AV-QA                      | per slice                                              | per slice                                   | per slice                               | RED/GREEN/REFACTOR         | per-slice commits         |
| NFR-010 | AV-CODEX                   | none                                                   | workspace ordinary files                    | workspace files                         | MT-agentsTemplate          | Codex read-only hash diff |

## 后续实现输入 ID

| ID       | 范围                                                             |
| -------- | ---------------------------------------------------------------- |
| IMPL-001 | Renderer TSX/DOM behavior 测试基础                               |
| IMPL-002 | Preload + explicit IPC + Zod 基础                                |
| IMPL-003 | Workspace filesystem 和 recording draft 基础                     |
| IMPL-004 | Workspace data/query/form UI                                     |
| IMPL-005 | Workspace home UI 和最小 shadcn primitives                       |
| IMPL-006 | Recording overlay、MediaRecorder、autosave、playback             |
| IMPL-007 | Electron runtime、persistence、reference 和 Codex CLI validation |
